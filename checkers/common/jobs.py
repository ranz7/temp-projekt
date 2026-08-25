"""
The jobs one checker machine is judging right now, and the results it still holds.

`POST /judge` puts a job here and answers immediately; `GET /judge/<jobId>` reads it
back. The machine judges at most `CHECKER_CAPACITY` submissions at once and queues
nothing: a full machine says so, and the application sends the submission elsewhere.

A crash inside the judge becomes an internal error for that submission alone. The
registry itself, and therefore the service, keeps going.
"""

from __future__ import annotations

import logging
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .contract import DONE, RUNNING, FinalReport, JudgeRequest, envelope, internal_error
from .judging import Judge
from .scratch import ScratchDirectory, clear_scratch_root, open_scratch

logger = logging.getLogger(__name__)

# How long a readable failure message may be before it is cut short.
MESSAGE_LIMIT = 4000


def clip(message: str, limit: int = MESSAGE_LIMIT) -> str:
    text = message.strip()

    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... ({len(text) - limit} more characters)"


class AtCapacityError(RuntimeError):
    """This machine is already judging as much as it may."""


class ShuttingDownError(RuntimeError):
    """This machine is stopping and takes no new work."""


@dataclass
class JobRecord:
    """One submission this machine was asked to judge."""

    job_id: str
    submission_id: str
    status: str = RUNNING
    result: FinalReport | None = None
    finished_at: float | None = None
    thread: threading.Thread | None = field(default=None, repr=False)

    def to_payload(self) -> dict[str, Any]:
        if self.status == RUNNING or self.result is None:
            return envelope(status=RUNNING)
        return envelope(status=DONE, result=self.result.to_payload())


class JobRegistry:
    """Runs jobs on background threads and remembers their results for a while."""

    def __init__(
        self,
        judge: Judge,
        *,
        packages_path: Path,
        scratch_root: Path,
        capacity: int = 2,
        result_ttl_seconds: float = 900.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._judge = judge
        self._packages_path = Path(packages_path)
        self._scratch_root = Path(scratch_root)
        self.capacity = max(1, int(capacity))
        self._result_ttl_seconds = float(result_ttl_seconds)
        self._clock = clock
        self._lock = threading.Lock()
        self._jobs: dict[str, JobRecord] = {}
        self._running_submissions: dict[str, str] = {}
        self._closed = False

    # -- reading ----------------------------------------------------------------

    @property
    def busy(self) -> int:
        with self._lock:
            return len(self._running_submissions)

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            self._forget_old_results()
            return self._jobs.get(job_id)

    # -- accepting work ---------------------------------------------------------

    def submit(self, request: JudgeRequest) -> tuple[JobRecord, bool]:
        """Start judging, or hand back the job already judging this submission.

        The second value says whether this call started the work, so the caller can
        tell a fresh job from a repeated request for one already running.
        """
        with self._lock:
            if self._closed:
                raise ShuttingDownError("this checker is shutting down and takes no new work")

            self._forget_old_results()
            running_job_id = self._running_submissions.get(request.submission_id)

            if running_job_id is not None:
                return self._jobs[running_job_id], False

            if len(self._running_submissions) >= self.capacity:
                raise AtCapacityError(
                    f"this checker is judging {len(self._running_submissions)} of "
                    f"{self.capacity} submissions and takes no more"
                )

            record = JobRecord(job_id=uuid.uuid4().hex, submission_id=request.submission_id)
            self._jobs[record.job_id] = record
            self._running_submissions[request.submission_id] = record.job_id

        record.thread = threading.Thread(
            target=self._run,
            args=(record, request),
            name=f"judge-{record.job_id[:8]}",
            daemon=True,
        )
        record.thread.start()
        return record, True

    # -- doing the work ---------------------------------------------------------

    def _run(self, record: JobRecord, request: JudgeRequest) -> None:
        scratch: ScratchDirectory | None = None

        try:
            scratch = open_scratch(self._scratch_root, record.job_id)
            result = self._judge(
                request, packages_path=self._packages_path, scratch_path=scratch.path
            )

            if not isinstance(result, FinalReport):
                result = internal_error(
                    "The checker's judge answered something this service does not understand."
                )
        except Exception as error:  # noqa: BLE001 - one broken job must not kill the service
            logger.error(
                "Judging submission %s failed: %s\n%s",
                request.submission_id,
                error,
                traceback.format_exc(),
            )
            result = internal_error(
                clip(f"The checker could not finish this submission: {error}")
            )
        finally:
            if scratch is not None:
                scratch.remove()

        self._finish(record, result)

    def _finish(self, record: JobRecord, result: FinalReport) -> None:
        with self._lock:
            if record.status == DONE:
                return

            record.status = DONE
            record.result = result
            record.finished_at = self._clock()

            if self._running_submissions.get(record.submission_id) == record.job_id:
                del self._running_submissions[record.submission_id]

        logger.info(
            "Submission %s is %s (%s of %s points).",
            record.submission_id,
            result.status,
            result.score,
            result.max_score,
        )

    def _forget_old_results(self) -> None:
        """Drop results the application has had long enough to read. Holds the lock."""
        now = self._clock()
        expired = [
            job_id
            for job_id, record in self._jobs.items()
            if record.finished_at is not None
            and now - record.finished_at > self._result_ttl_seconds
        ]

        for job_id in expired:
            del self._jobs[job_id]

    # -- stopping ---------------------------------------------------------------

    def shutdown(self, grace_seconds: float = 30.0) -> None:
        """Stop accepting, let running jobs finish, fail whatever is still going."""
        with self._lock:
            self._closed = True
            running = [
                record
                for record in self._jobs.values()
                if record.status == RUNNING and record.thread is not None
            ]

        deadline = time.monotonic() + max(0.0, grace_seconds)

        for record in running:
            remaining = deadline - time.monotonic()

            if record.thread is not None and remaining > 0:
                record.thread.join(timeout=remaining)

        for record in running:
            self._finish(
                record,
                internal_error("The checker was stopped while judging this submission."),
            )

        clear_scratch_root(self._scratch_root)
