"""
Checker service configuration, read from the environment only.

No host name, port, path or key is written into the source: every value below
comes from an environment variable documented in `checkers/CONTRACT.md` and in
`checkers/README.md`.

The bind address defaults to loopback on purpose. The application reaches a
checker machine through an SSH tunnel, so the service must not be exposed to the
internet unless somebody deliberately sets `CHECKER_BIND`.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .judging import DEFAULT_JUDGE_ENTRY_POINT

PACKAGE_VERSION = "2.0.0"

DEFAULT_PROBLEM_PACKAGES_PATH = "/problems"
DEFAULT_SCRATCH_PATH = "/tmp/online-judge"
DEFAULT_BIND = "127.0.0.1"
DEFAULT_PORT = 8080
DEFAULT_CAPACITY = 2
DEFAULT_RESULT_TTL_SECONDS = 900.0
DEFAULT_SHUTDOWN_GRACE_SECONDS = 30.0


class ConfigError(RuntimeError):
    """An environment variable is present but unusable."""


def _text(name: str, default: str) -> str:
    raw = os.environ.get(name)

    if raw is None or raw.strip() == "":
        return default
    return raw.strip()


def _optional_text(name: str) -> str | None:
    raw = os.environ.get(name)

    if raw is None or raw.strip() == "":
        return None
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


def _whole_number(name: str, default: int) -> int:
    value = _number(name, float(default))

    if value != int(value):
        raise ConfigError(f"{name} must be a whole number, got {value}")
    return int(value)


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


def git_revision() -> str | None:
    """The checkout this service runs from, when it is a checkout at all."""
    root = Path(__file__).resolve().parents[2]

    try:
        finished = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    if finished.returncode != 0:
        return None

    revision = finished.stdout.strip()
    return revision or None


@dataclass(frozen=True)
class CheckerConfig:
    """Everything the checker service needs to listen and to judge."""

    service_key: str | None
    problem_packages_path: Path
    scratch_path: Path
    bind: str
    port: int
    capacity: int
    result_ttl_seconds: float
    shutdown_grace_seconds: float
    judge_entry_point: str
    version: str

    @property
    def accepts_calls(self) -> bool:
        """Without a key the service answers only `/health`."""
        return self.service_key is not None

    @classmethod
    def from_environment(cls) -> CheckerConfig:
        capacity = _whole_number("CHECKER_CAPACITY", DEFAULT_CAPACITY)

        return cls(
            service_key=_optional_text("SERVICE_KEY"),
            problem_packages_path=Path(
                _text("PROBLEM_PACKAGES_PATH", DEFAULT_PROBLEM_PACKAGES_PATH)
            ),
            scratch_path=Path(_text("CHECKER_SCRATCH_PATH", DEFAULT_SCRATCH_PATH)),
            bind=_text("CHECKER_BIND", DEFAULT_BIND),
            port=_port("CHECKER_PORT", DEFAULT_PORT),
            capacity=capacity,
            result_ttl_seconds=_number(
                "CHECKER_RESULT_TTL_SECONDS", DEFAULT_RESULT_TTL_SECONDS
            ),
            shutdown_grace_seconds=_number(
                "CHECKER_SHUTDOWN_GRACE_SECONDS", DEFAULT_SHUTDOWN_GRACE_SECONDS
            ),
            judge_entry_point=_text("CHECKER_JUDGE", DEFAULT_JUDGE_ENTRY_POINT),
            version=_optional_text("CHECKER_VERSION")
            or git_revision()
            or PACKAGE_VERSION,
        )
