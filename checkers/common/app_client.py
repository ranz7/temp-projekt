"""
The worker's side of the app HTTP contract: claim, heartbeat, result, release.

Only the standard library is used. Every request carries the shared key header and
`contractVersion: 1`, and every answer must name the same version or the call fails.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any, Callable

from .contract import (
    CLAIM_PATH,
    CONTRACT_VERSION,
    HEARTBEAT_PATH,
    RELEASE_PATH,
    RESULT_PATH,
    SERVICE_KEY_HEADER,
    ContractError,
    FinalReport,
    Job,
    parse_job,
    require_contract_version,
)

logger = logging.getLogger(__name__)

UrlOpen = Callable[..., Any]


class AppUnreachableError(RuntimeError):
    """The app did not answer. The worker waits and tries again."""


class AppClient:
    """Talks to the Next.js app. One instance per worker, reused for every job."""

    def __init__(
        self,
        base_url: str,
        service_key: str,
        *,
        timeout_seconds: float = 15.0,
        urlopen: UrlOpen | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_key = service_key
        self.timeout_seconds = timeout_seconds
        self._urlopen = urlopen or urllib.request.urlopen

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps({"contractVersion": CONTRACT_VERSION, **payload}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                SERVICE_KEY_HEADER: self.service_key,
            },
        )

        try:
            with self._urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:500]
            status = int(getattr(error, "code", 0) or 0)

            if status in (401, 403):
                raise ContractError(
                    f"the app refused the service key on {path}: {detail}"
                ) from error
            raise AppUnreachableError(f"{path} answered HTTP {status}: {detail}") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise AppUnreachableError(f"{path} did not answer: {error}") from error

        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ContractError(f"{path} did not answer JSON") from error

        return require_contract_version(parsed)

    def claim(self, worker_id: str, languages: list[str]) -> Job | None:
        """Ask for one submission. `None` means there is nothing to do right now."""
        answer = self._post(CLAIM_PATH, {"workerId": worker_id, "languages": languages})
        job = answer.get("job")

        if job is None:
            return None
        return parse_job(job)

    def heartbeat(self, submission_id: str, claim_id: str) -> None:
        self._post(HEARTBEAT_PATH, {"submissionId": submission_id, "claimId": claim_id})

    def report_running(self, submission_id: str, claim_id: str) -> None:
        self._post(
            RESULT_PATH,
            {"submissionId": submission_id, "claimId": claim_id, "status": "running"},
        )

    def report_result(self, submission_id: str, claim_id: str, report: FinalReport) -> None:
        self._post(
            RESULT_PATH,
            {
                "submissionId": submission_id,
                "claimId": claim_id,
                **report.to_payload(),
            },
        )

    def release(self, submission_id: str, claim_id: str, reason: str) -> None:
        self._post(
            RELEASE_PATH,
            {
                "submissionId": submission_id,
                "claimId": claim_id,
                "reason": reason or "the worker cannot judge this submission now",
            },
        )
