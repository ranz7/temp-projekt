"""
The claim / heartbeat / result / release loop both workers run.

One turn of the loop:

1. wait briefly for a Redis nudge, which is only a hint,
2. claim a job from the app anyway,
3. say the submission is running and start beating its lease,
4. judge it in a fresh scratch directory,
5. post the final result, or release the job when it cannot be judged now,
6. delete the scratch directory.

A crash while judging one submission is reported as an internal error for that
submission; the worker itself keeps going.
"""

from __future__ import annotations

import logging
import signal
import threading
import traceback
from pathlib import Path
from typing import Protocol

from .app_client import AppClient, AppUnreachableError
from .config import WorkerConfig
from .contract import ContractError, FinalReport, Job, Release, internal_error
from .health import HealthServer
from .heartbeat import Heartbeat
from .scratch import ScratchDirectory, clear_scratch_root, open_scratch
from .wakeup import WakeUpListener

logger = logging.getLogger(__name__)

# How long a readable failure message may be before it is cut short.
MESSAGE_LIMIT = 4000


class Judge(Protocol):
    """What a worker plugs into the loop."""

    name: str
    languages: list[str]
    # False for a worker whose scratch directory must be empty for every job.
    reuse_scratch: bool
    # Set by the worker: a judge that waits for something long watches this event.
    stop: threading.Event | None

    def judge(self, job: Job, scratch: Path) -> FinalReport | Release:
        """Judge one submission, or ask for it to be queued again."""


def clip(message: str, limit: int = MESSAGE_LIMIT) -> str:
    text = message.strip()

    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... ({len(text) - limit} more characters)"


class Worker:
    """One process: a health endpoint, a wake-up listener and the judging loop."""

    def __init__(
        self,
        config: WorkerConfig,
        judge: Judge,
        *,
        client: AppClient | None = None,
        listener: WakeUpListener | None = None,
        health: HealthServer | None = None,
    ) -> None:
        self.config = config
        self.judge = judge
        self.client = client or AppClient(
            config.app_url,
            config.service_key,
            timeout_seconds=config.request_timeout_seconds,
        )
        self.listener = listener or WakeUpListener(config.redis_url, config.redis_stream)
        self.health = health
        self.stop = threading.Event()
        # A judge that can take a long time watches this to give a job back instead
        # of holding a shutdown open.
        setattr(self.judge, "stop", self.stop)

    # -- shutdown ---------------------------------------------------------------

    def install_signal_handlers(self) -> None:
        """SIGINT and SIGTERM stop claiming; the job in flight still finishes."""

        def handle(signal_number: int, _frame: object) -> None:
            logger.info(
                "Signal %s received; finishing the current job and stopping.", signal_number
            )
            self.stop.set()

        signal.signal(signal.SIGINT, handle)
        signal.signal(signal.SIGTERM, handle)

    # -- one job ----------------------------------------------------------------

    def _judge_job(self, job: Job, scratch: ScratchDirectory) -> FinalReport | Release:
        try:
            return self.judge.judge(job, scratch.path)
        except Exception as error:
            logger.error(
                "Judging submission %s failed: %s\n%s",
                job.submission_id,
                error,
                traceback.format_exc(),
            )
            return internal_error(
                clip(f"The checker could not finish this submission: {error}"),
                max_score=job.hidden_points,
            )

    def handle_job(self, job: Job) -> bool:
        """Report progress, judge, answer. Never raises for a judging failure.

        Returns whether the submission was actually judged. A job given back to the
        queue answers False, so the loop waits before it claims again instead of
        taking the same waiting submission over and over.
        """
        logger.info(
            "Judging submission %s (%s, %s).", job.submission_id, job.problem_slug, job.language
        )
        scratch = open_scratch(
            self.config.scratch_path,
            self.judge.name,
            job.submission_id,
            reuse=self.judge.reuse_scratch,
        )
        keep_scratch = False

        try:
            self.client.report_running(job.submission_id, job.claim_id)
            heartbeat = Heartbeat(
                self.client, job.submission_id, job.claim_id, self.config.heartbeat_seconds
            ).start()

            try:
                outcome = self._judge_job(job, scratch)
            finally:
                heartbeat.stop()

            if isinstance(outcome, Release):
                keep_scratch = outcome.keep_scratch
                logger.info(
                    "Giving submission %s back to the queue: %s",
                    job.submission_id,
                    outcome.reason,
                )
                self.client.release(job.submission_id, job.claim_id, clip(outcome.reason, 500))

                return False

            logger.info(
                "Submission %s is %s (%s of %s points).",
                job.submission_id,
                outcome.status,
                outcome.score,
                outcome.max_score,
            )
            self.client.report_result(job.submission_id, job.claim_id, outcome)

            return True
        except (AppUnreachableError, ContractError) as error:
            # The app is the only place a result can go. Losing it means the lease
            # runs out and the submission is handed to somebody else.
            logger.error("Could not report on submission %s: %s", job.submission_id, error)

            return False
        finally:
            if not keep_scratch:
                scratch.remove()

    # -- the loop ---------------------------------------------------------------

    def run_once(self) -> bool:
        """Claim and handle at most one job.

        Returns whether the worker may claim again straight away. Nothing to do and a
        job handed back both answer False, so the caller waits either way.
        """
        try:
            job = self.client.claim(self.config.worker_id, self.judge.languages)
        except AppUnreachableError as error:
            logger.warning("Could not claim work: %s", error)
            self.stop.wait(self.config.poll_seconds)
            return False
        except ContractError as error:
            logger.error("Refusing to claim work: %s", error)
            self.stop.wait(self.config.poll_seconds)
            return False

        if job is None:
            return False

        return self.handle_job(job)

    def run(self) -> int:
        """Run until a signal stops the worker. Returns the process exit code."""
        # A worker that resumes work after a restart keeps what its previous life
        # left behind; every other worker starts from an empty directory.
        if not self.judge.reuse_scratch:
            clear_scratch_root(self.config.scratch_path, self.judge.name)

        if self.health is None:
            self.health = HealthServer(self.config.health_port)
        self.health.start()

        logger.info(
            "Worker %s started for %s.", self.config.worker_id, ", ".join(self.judge.languages)
        )

        try:
            while not self.stop.is_set():
                if self.run_once():
                    # A worker that just judged something keeps draining before it
                    # goes back to waiting on the stream. A submission it could not
                    # judge waits instead, so an outage does not turn into a worker
                    # and an app burning through claims for a job nobody can take.
                    continue
                if self.stop.is_set():
                    break
                self.listener.wait(self.config.poll_seconds)
        finally:
            self.listener.close()
            self.health.stop()

            if not self.judge.reuse_scratch:
                clear_scratch_root(self.config.scratch_path, self.judge.name)
            logger.info("Worker %s stopped.", self.config.worker_id)

        return 0
