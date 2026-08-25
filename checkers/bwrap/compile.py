"""
The compile step.

Python is not compiled: the submission is staged into the job's scratch directory and
run from there. The step is kept anyway, so another language only has to fill in its
own branch, and so a language that does fail to build already has somewhere to report
its compiler message from.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

DEFAULT_PYTHON_PATH = "/usr/bin/python3"

# The file the submission is staged as, inside the job's scratch directory.
PYTHON_SOURCE_NAME = "main.py"


@dataclass(frozen=True)
class CompileResult:
    """Whether the submission is runnable, and how to run it."""

    ok: bool
    language: str
    run_argv: Sequence[str] = field(default_factory=tuple)
    artifact_path: Path | None = None
    compiler_message: str = ""


def submission_python_path() -> str:
    """The interpreter submissions are run with."""
    return os.environ.get("PYTHON_PATH") or DEFAULT_PYTHON_PATH


def compile_submission(
    language: str,
    source_code: str,
    work_dir: Path,
    *,
    python_executable: str | None = None,
) -> CompileResult:
    """Prepare one submission for running, once, before any test."""
    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    normalised = (language or "").strip().lower()

    if normalised in ("python", "python3", "py"):
        destination = work_dir / PYTHON_SOURCE_NAME

        try:
            destination.write_text(source_code, encoding="utf-8")
        except OSError as error:
            return CompileResult(
                ok=False,
                language="python",
                compiler_message=f"the submission could not be written out: {error}",
            )

        interpreter = python_executable or submission_python_path()
        return CompileResult(
            ok=True,
            language="python",
            run_argv=(interpreter, str(destination)),
            artifact_path=destination,
        )

    return CompileResult(
        ok=False,
        language=normalised or "unknown",
        compiler_message=f"this checker does not handle {language!r} submissions",
    )
