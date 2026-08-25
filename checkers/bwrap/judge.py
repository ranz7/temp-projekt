"""The sandboxed judge, as the worker loop sees it."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from common.config import WorkerConfig
from common.contract import FinalReport, Job, Release

from .compile import submission_python_path
from .package import PackageError, checker_script_path
from .pipeline import judge_submission

logger = logging.getLogger(__name__)


class SandboxedPythonJudge:
    """Judges `python` submissions in a bubblewrap sandbox with cgroup limits."""

    name = "bwrap"
    languages = ["python"]
    # Every submission starts from an empty directory: nothing survives a job.
    reuse_scratch = False

    def __init__(self, config: WorkerConfig) -> None:
        self.config = config
        self.stop: threading.Event | None = None

    def judge(self, job: Job, scratch: Path) -> FinalReport | Release:
        checker_script = None

        if job.checker_type == "custom" and job.checker_path:
            try:
                checker_script = checker_script_path(
                    self.config.problem_packages_path, job.package_directory, job.checker_path
                )
            except PackageError as error:
                logger.warning("Problem checker unavailable: %s", error)

        return judge_submission(
            job,
            scratch,
            packages_path=self.config.problem_packages_path,
            python_executable=submission_python_path(),
            checker_script=checker_script,
            stop=self.stop,
        )
