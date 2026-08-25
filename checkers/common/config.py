"""
Worker configuration, read from the environment only.

No host name, port, path or key is written into the source: every value below
comes from an environment variable documented in `checkers/CONTRACT.md` and in
`checkers/README.md`.
"""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

DEFAULT_APP_URL = "http://127.0.0.1:3000"
DEFAULT_PROBLEM_PACKAGES_PATH = "/problems"
DEFAULT_POLL_SECONDS = 1.0
DEFAULT_HEARTBEAT_SECONDS = 20.0
DEFAULT_SCRATCH_PATH = "/tmp/online-judge"
DEFAULT_HEALTH_PORT = 8080
DEFAULT_REDIS_URL = "redis://127.0.0.1:6379"
DEFAULT_REDIS_STREAM = "oj.submissions"
DEFAULT_REQUEST_TIMEOUT_SECONDS = 15.0


class ConfigError(RuntimeError):
    """A required environment variable is missing or unusable."""


def _text(name: str, default: str | None = None) -> str:
    raw = os.environ.get(name)

    if raw is None or raw.strip() == "":
        if default is None:
            raise ConfigError(f"{name} is required and has no default")
        return default
    return raw.strip()


def _number(name: str, default: float) -> float:
    raw = os.environ.get(name)

    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw.strip())
    except ValueError as error:
        raise ConfigError(f"{name} must be a number, got {raw!r}") from error
    if value <= 0:
        raise ConfigError(f"{name} must be greater than zero, got {value}")
    return value


def _port(name: str, default: int) -> int:
    raw = os.environ.get(name)

    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw.strip())
    except ValueError as error:
        raise ConfigError(f"{name} must be a port number, got {raw!r}") from error
    if not 0 < value < 65536:
        raise ConfigError(f"{name} must be a port number, got {value}")
    return value


def default_worker_id(prefix: str) -> str:
    """A stable-enough identity when the deployment does not set one."""
    return f"{prefix}-{socket.gethostname()}"


@dataclass(frozen=True)
class WorkerConfig:
    """Everything a worker needs to talk to the app and to run one job."""

    app_url: str
    service_key: str
    worker_id: str
    problem_packages_path: Path
    poll_seconds: float
    heartbeat_seconds: float
    scratch_path: Path
    health_port: int
    redis_url: str
    redis_stream: str
    request_timeout_seconds: float

    @classmethod
    def from_environment(cls, *, worker_id_prefix: str) -> WorkerConfig:
        return cls(
            app_url=_text("APP_URL", DEFAULT_APP_URL).rstrip("/"),
            service_key=_text("SERVICE_KEY"),
            worker_id=_text("WORKER_ID", default_worker_id(worker_id_prefix)),
            problem_packages_path=Path(
                _text("PROBLEM_PACKAGES_PATH", DEFAULT_PROBLEM_PACKAGES_PATH)
            ),
            poll_seconds=_number("CHECKER_POLL_SECONDS", DEFAULT_POLL_SECONDS),
            heartbeat_seconds=_number(
                "CHECKER_HEARTBEAT_SECONDS", DEFAULT_HEARTBEAT_SECONDS
            ),
            scratch_path=Path(_text("CHECKER_SCRATCH_PATH", DEFAULT_SCRATCH_PATH)),
            health_port=_port("CHECKER_HEALTH_PORT", DEFAULT_HEALTH_PORT),
            redis_url=_text("REDIS_URL", DEFAULT_REDIS_URL),
            redis_stream=_text("REDIS_STREAM", DEFAULT_REDIS_STREAM),
            request_timeout_seconds=_number(
                "CHECKER_REQUEST_TIMEOUT_SECONDS", DEFAULT_REQUEST_TIMEOUT_SECONDS
            ),
        )


@dataclass(frozen=True)
class OioioiConfig:
    """The extra settings only the C++ worker reads."""

    url: str
    token: str
    contest_id: str
    poll_seconds: float
    request_timeout_seconds: float
    poll_timeout_seconds: float

    @classmethod
    def from_environment(cls) -> OioioiConfig:
        """Raises ConfigError when OIOIOI is not configured, so the job is released."""
        return cls(
            url=_text("OIOIOI_URL").rstrip("/"),
            token=_text("OIOIOI_TOKEN"),
            contest_id=_text("OIOIOI_CONTEST_ID"),
            poll_seconds=_number("OIOIOI_POLL_SECONDS", 2.0),
            request_timeout_seconds=_number("OIOIOI_REQUEST_TIMEOUT_SECONDS", 10.0),
            poll_timeout_seconds=_number("OIOIOI_POLL_TIMEOUT_SECONDS", 600.0),
        )
