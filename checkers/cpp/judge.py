"""
The C++ judge, as the worker loop sees it.

OIOIOI does the running, so this worker only submits, waits and translates. The rule
that matters: when OIOIOI is unreachable or not configured, the submission goes back
to the queue with a readable reason and keeps all of its attempts. It never becomes an
internal error, so an outage only delays a solution, it never fails it.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from common.config import ConfigError, OioioiConfig, WorkerConfig
from common.contract import (
    ACCEPTED,
    INTERNAL_ERROR,
    FinalReport,
    Job,
    Release,
)

from .oioioi_client import OioioiClient, OioioiUnavailable
from .oioioi_job import OioioiOutcome, run_oioioi_job
from .oioioi_map import map_status

logger = logging.getLogger(__name__)

UNAVAILABLE_PREFIX = "C++ checking is temporarily unavailable"


class OioioiCppJudge:
    """Judges `cpp` submissions by handing them to OIOIOI."""

    name = "cpp"
    languages = ["cpp"]
    # The OIOIOI submission id has to outlive a restart, so the directory stays until
    # the submission has a final result.
    reuse_scratch = True

    def __init__(self, config: WorkerConfig, client_factory=None) -> None:
        self.config = config
        self.stop: threading.Event | None = None
        self._client_factory = client_factory

    def _client(self) -> OioioiClient:
        if self._client_factory is not None:
            return self._client_factory()

        settings = OioioiConfig.from_environment()
        return OioioiClient(
            settings.url,
            settings.token,
            settings.contest_id,
            timeout_seconds=settings.request_timeout_seconds,
        )

    def _settings(self) -> OioioiConfig | None:
        try:
            return OioioiConfig.from_environment()
        except ConfigError:
            return None

    def judge(self, job: Job, scratch: Path) -> FinalReport | Release:
        settings = self._settings()

        try:
            client = self._client()
        except (ConfigError, OioioiUnavailable) as error:
            return Release(f"{UNAVAILABLE_PREFIX}: {error}", keep_scratch=False)

        outcome = run_oioioi_job(
            client=client,
            scratch=scratch,
            short_name=job.problem_slug,
            source_code=job.source_code,
            poll_seconds=settings.poll_seconds if settings else 2.0,
            poll_timeout_seconds=settings.poll_timeout_seconds if settings else 600.0,
            stop=self.stop,
        )

        return build_outcome(job, outcome)


def build_outcome(job: Job, outcome: OioioiOutcome) -> FinalReport | Release:
    """Turn what OIOIOI said into a report, or into a job that waits for it."""
    if outcome.unavailable:
        # Back to the queue: no verdict, no attempt used, no error shown to anybody.
        return Release(
            f"{UNAVAILABLE_PREFIX}: {outcome.message or 'OIOIOI could not be reached'}",
            # The submission id, when there is one, must survive so the same source is
            # never sent to OIOIOI twice.
            keep_scratch=outcome.oioioi_id is not None,
        )

    if not outcome.ok:
        return FinalReport(
            status=INTERNAL_ERROR,
            score=0.0,
            max_score=job.hidden_points,
            compile_message=outcome.message or "OIOIOI refused this submission",
            tests=[],
        )

    status = map_status(outcome.status)
    max_score = job.hidden_points
    # OIOIOI reports one verdict for the whole submission and no per-test rows, so a
    # solution it accepted earns every point and anything else earns none.
    score = max_score if status == ACCEPTED else 0.0
    message = None

    if status == INTERNAL_ERROR:
        message = f"OIOIOI answered {outcome.status or 'nothing'}"

    return FinalReport(
        status=status,
        score=score,
        max_score=max_score,
        compile_message=message,
        max_cpu_ms=outcome.time_ms or 0,
        max_memory_kb=outcome.memory_kb or 0,
        tests=[],
    )
