"""
The small HTTP service every checker machine runs.

The application asks this service to judge a submission and then asks it for the
answer; the checker never calls the application back. Three routes, contract
version 2, standard library only - a checker should not carry a web framework just
to say "still here" and "here is your verdict".

`GET /health` needs no key, so a deployment can see whether the machine is alive.
Everything else needs `X-Service-Key`, compared in constant time.
"""

from __future__ import annotations

import hmac
import json
import logging
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .config import CheckerConfig
from .contract import (
    CONTRACT_VERSION,
    HEALTH_PATH,
    JUDGE_PATH,
    SERVICE_KEY_HEADER,
    ContractError,
    ContractVersionError,
    FinalReport,
    JudgeRequest,
    envelope,
    parse_judge_request,
)
from .jobs import AtCapacityError, JobRegistry, ShuttingDownError
from .judging import Judge, JudgeUnavailableError, judge_submission, load_judge
from .scratch import clear_scratch_root

logger = logging.getLogger(__name__)

# A submission's source code, generously. Anything larger is refused unread.
MAX_BODY_BYTES = 2_000_000


def problem_directories(packages_path: Path) -> list[str]:
    """The problem packages that are actually on this machine's disk."""
    try:
        entries = sorted(path for path in Path(packages_path).iterdir() if path.is_dir())
    except OSError:
        return []

    return [
        path.name
        for path in entries
        if (path / "problem.json").is_file() or (path / "tests").is_dir()
    ]


def lazy_judge(entry_point: str) -> Judge:
    """Resolve the judge on first use, so a broken sandbox is one bad submission."""

    def judge(
        request: JudgeRequest, *, packages_path: Path, scratch_path: Path
    ) -> FinalReport:
        return judge_submission(
            request,
            packages_path=packages_path,
            scratch_path=scratch_path,
            entry_point=entry_point,
        )

    return judge


class CheckerService:
    """What the three routes need: the configuration and the running jobs."""

    def __init__(self, config: CheckerConfig, registry: JobRegistry) -> None:
        self.config = config
        self.registry = registry

    def authorised(self, provided: str | None) -> bool:
        expected = self.config.service_key

        if expected is None:
            return False
        return hmac.compare_digest(provided or "", expected)

    def health_payload(self) -> dict[str, Any]:
        return envelope(
            ok=True,
            busy=self.registry.busy,
            capacity=self.registry.capacity,
            problems=problem_directories(self.config.problem_packages_path),
            version=self.config.version,
        )


class CheckerRequestHandler(BaseHTTPRequestHandler):
    """The three routes. `service` is filled in by `create_server`."""

    server_version = f"oj-checker/{CONTRACT_VERSION}"
    protocol_version = "HTTP/1.1"
    service: CheckerService

    # -- answering --------------------------------------------------------------

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: int, reason: str) -> None:
        self._send_json(status, envelope(error=reason))

    def _read_body(self) -> Any:
        raw_length = self.headers.get("Content-Length")

        try:
            length = int(raw_length or 0)
        except ValueError:
            raise ContractError("Content-Length is not a number") from None

        if length <= 0:
            raise ContractError("the request has no body")

        if length > MAX_BODY_BYTES:
            raise ContractError(f"the request body is larger than {MAX_BODY_BYTES} bytes")

        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ContractError(f"the request body is not JSON: {error}") from error

    def _authorised(self) -> bool:
        if self.service.authorised(self.headers.get(SERVICE_KEY_HEADER)):
            return True

        if self.service.config.service_key is None:
            self._send_error(
                401,
                "this checker has no SERVICE_KEY set, so it judges nothing",
            )
        else:
            self._send_error(401, "a valid X-Service-Key header is required")
        return False

    # -- routes -----------------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 - the name comes from the standard library
        path = self._path()

        if path == HEALTH_PATH:
            self._send_json(200, self.service.health_payload())
            return

        if path.startswith(f"{JUDGE_PATH}/"):
            if not self._authorised():
                return
            self._answer_job(path[len(JUDGE_PATH) + 1 :])
            return

        self._send_error(404, f"{self.path} is not a route of this checker")

    def do_POST(self) -> None:  # noqa: N802 - the name comes from the standard library
        path = self._path()

        if path != JUDGE_PATH:
            self._send_error(404, f"{self.path} is not a route of this checker")
            return

        if not self._authorised():
            return

        try:
            request = parse_judge_request(self._read_body())
        except ContractVersionError as error:
            self._send_error(400, str(error))
            return
        except ContractError as error:
            self._send_error(400, str(error))
            return

        try:
            record, started = self.service.registry.submit(request)
        except AtCapacityError as error:
            self._send_error(503, str(error))
            return
        except ShuttingDownError as error:
            self._send_error(503, str(error))
            return

        if started:
            logger.info(
                "Judging submission %s (%s, %s) as job %s.",
                request.submission_id,
                request.problem_slug,
                request.language,
                record.job_id,
            )
        self._send_json(202, envelope(jobId=record.job_id))

    def _answer_job(self, job_id: str) -> None:
        record = self.service.registry.get(job_id)

        if record is None:
            self._send_error(404, f"this checker has no job {job_id}")
            return

        self._send_json(200, record.to_payload())

    def _path(self) -> str:
        path = self.path.split("?", 1)[0]

        if len(path) > 1 and path.endswith("/"):
            path = path.rstrip("/")
        return path or "/"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        """Health checks run every few seconds; they do not belong in the log."""
        logger.debug("%s %s", self.address_string(), format % args)


def create_server(config: CheckerConfig, registry: JobRegistry) -> ThreadingHTTPServer:
    """A server bound to `CHECKER_BIND:CHECKER_PORT`, not yet serving."""
    service = CheckerService(config, registry)
    handler = type(
        "BoundCheckerRequestHandler", (CheckerRequestHandler,), {"service": service}
    )
    server = ThreadingHTTPServer((config.bind, config.port), handler)
    server.daemon_threads = True
    return server


def build_registry(config: CheckerConfig) -> JobRegistry:
    return JobRegistry(
        lazy_judge(config.judge_entry_point),
        packages_path=config.problem_packages_path,
        scratch_root=config.scratch_path,
        capacity=config.capacity,
        result_ttl_seconds=config.result_ttl_seconds,
    )


def serve(config: CheckerConfig) -> int:
    """Run until SIGINT or SIGTERM, then stop cleanly. Returns the exit code."""
    clear_scratch_root(config.scratch_path)
    registry = build_registry(config)
    server = create_server(config, registry)

    try:
        load_judge(config.judge_entry_point)
    except JudgeUnavailableError as error:
        logger.warning("The judge is not usable on this machine yet: %s", error)

    def handle(signal_number: int, _frame: object) -> None:
        logger.info("Signal %s received; stopping.", signal_number)
        threading.Thread(target=server.shutdown, name="shutdown", daemon=True).start()

    signal.signal(signal.SIGINT, handle)
    signal.signal(signal.SIGTERM, handle)

    if config.service_key is None:
        logger.warning(
            "SERVICE_KEY is not set: this checker answers /health and refuses "
            "everything else."
        )

    logger.info(
        "Checker %s listening on %s:%s for %s submissions at a time.",
        config.version,
        config.bind,
        server.server_address[1],
        config.capacity,
    )

    try:
        server.serve_forever()
    finally:
        server.server_close()
        registry.shutdown(config.shutdown_grace_seconds)
        logger.info("Checker stopped.")

    return 0
