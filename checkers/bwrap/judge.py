"""
The sandboxed judge, as the rest of the checker sees it.

`run_judge` is the one function other code calls: hand it a submission, it reads that
problem's package from this machine's own disk, judges every test in the bubblewrap
sandbox and gives back the report the app stores. Everything it writes lives in one
scratch directory that is deleted when the submission is done.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
import threading
from pathlib import Path

from .compile import submission_python_path
from .pipeline import judge_submission
from .report import JudgeRequest, JudgeResult

logger = logging.getLogger(__name__)

DEFAULT_PACKAGES_PATH = "/problems"
DEFAULT_SCRATCH_PATH = "/tmp/online-judge"


def problem_packages_path() -> Path:
    """Where this machine keeps the problems' test data."""
    return Path(os.environ.get("PROBLEM_PACKAGES_PATH") or DEFAULT_PACKAGES_PATH)


def scratch_root() -> Path:
    """Where one submission's working files live while it is judged."""
    return Path(os.environ.get("CHECKER_SCRATCH_PATH") or DEFAULT_SCRATCH_PATH)


def run_judge(
    request: JudgeRequest,
    *,
    packages_path: Path | None = None,
    scratch_path: Path | None = None,
    python_executable: str | None = None,
    stop: threading.Event | None = None,
) -> JudgeResult:
    """Judge one submission in a scratch directory of its own.

    Raises `PackageError` when this machine does not hold the problem, and
    `JudgeCancelled` when `stop` is set while the tests are running. Every other
    ending, including a submission that will not build, comes back as a `JudgeResult`.
    """
    root = Path(scratch_path or scratch_root())
    root.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix=f"{request.submission_id}-", dir=str(root)))

    try:
        return judge_submission(
            request,
            scratch,
            packages_path=Path(packages_path or problem_packages_path()),
            python_executable=python_executable or submission_python_path(),
            stop=stop,
        )
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
