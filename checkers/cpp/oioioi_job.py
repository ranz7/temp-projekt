"""
Submit once, then poll.

Ported from the reference adapter (`sprawdzarka/oioioi_job.py`). The OIOIOI
submission id is written into the job's scratch directory as soon as it is known, so
a worker that was restarted picks the polling back up instead of sending the same
source a second time.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .oioioi_client import (
    OioioiClient,
    OioioiError,
    OioioiUnavailable,
    is_early_failure,
    parse_score,
    report_is_complete,
)

logger = logging.getLogger(__name__)

STATE_FILE_NAME = "oioioi.json"


@dataclass(frozen=True)
class OioioiOutcome:
    """What OIOIOI said, or why it could not say anything."""

    ok: bool
    oioioi_id: int | None = None
    status: str | None = None
    score: int | None = None
    max_score: int | None = None
    time_ms: int | None = None
    memory_kb: int | None = None
    message: str | None = None
    # True when the job should go back to the queue rather than get a verdict.
    unavailable: bool = False


def read_state(scratch: Path) -> dict:
    path = Path(scratch) / STATE_FILE_NAME

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_state(scratch: Path, state: dict) -> None:
    path = Path(scratch) / STATE_FILE_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state), encoding="utf-8")


def remembered_submission_id(scratch: Path) -> int | None:
    value = read_state(scratch).get("oioioiSubmissionId")

    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _text_or_none(value: object) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _outcome_from_report(
    oioioi_id: int, report: dict, fallback_status: str | None
) -> OioioiOutcome:
    return OioioiOutcome(
        ok=True,
        oioioi_id=oioioi_id,
        status=_text_or_none(report.get("verdict")) or fallback_status,
        score=parse_score(report.get("score")),
        max_score=parse_score(report.get("max_score")),
        time_ms=parse_score(report.get("time_ms")),
        memory_kb=parse_score(report.get("memory_kb")),
    )


def run_oioioi_job(
    *,
    client: OioioiClient,
    scratch: Path,
    short_name: str,
    source_code: str,
    poll_seconds: float = 2.0,
    poll_timeout_seconds: float = 600.0,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    stop: threading.Event | None = None,
) -> OioioiOutcome:
    """Get one C++ submission judged by OIOIOI."""
    if not short_name:
        return OioioiOutcome(ok=False, message="the problem has no OIOIOI short name")
    if not source_code.strip():
        return OioioiOutcome(ok=False, message="the submission is empty")

    oioioi_id = remembered_submission_id(scratch)

    if oioioi_id is None:
        try:
            oioioi_id = client.submit(short_name, source_code)
        except OioioiUnavailable as error:
            return OioioiOutcome(ok=False, unavailable=True, message=str(error))
        except OioioiError as error:
            return OioioiOutcome(ok=False, message=str(error))

        # Written before anything else can go wrong, so a restart never submits twice.
        write_state(scratch, {"oioioiSubmissionId": int(oioioi_id), "shortName": short_name})
        logger.info("OIOIOI took submission %s for %s.", oioioi_id, short_name)

    deadline = monotonic() + poll_timeout_seconds
    last_outage: str | None = None

    while monotonic() < deadline:
        if stop is not None and stop.is_set():
            return OioioiOutcome(
                ok=False,
                oioioi_id=oioioi_id,
                unavailable=True,
                message="the checker is shutting down before OIOIOI answered",
            )

        try:
            report = client.get_submission_report(oioioi_id)
        except OioioiUnavailable as error:
            last_outage = str(error)
            sleep(poll_seconds)
            continue
        except OioioiError as error:
            # A report that is not there yet reads as a plain HTTP error; keep waiting.
            last_outage = str(error)
            sleep(poll_seconds)
            continue

        if not isinstance(report, dict):
            sleep(poll_seconds)
            continue

        status = _text_or_none(report.get("verdict") or report.get("status"))

        if report_is_complete(report) or is_early_failure(status):
            return _outcome_from_report(oioioi_id, report, status)

        sleep(poll_seconds)

    reason = "OIOIOI did not report a result in time"

    if last_outage:
        reason = f"{reason} ({last_outage})"

    return OioioiOutcome(ok=False, oioioi_id=oioioi_id, unavailable=True, message=reason)
