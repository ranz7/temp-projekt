"""
The compile step, run once per submission and reused by every test.

Python is not compiled: the submission is staged into the job's scratch directory and
run from there. C++ is built with `g++ -O2 -std=gnu++17` into one binary. An
interactive problem builds the problem's grader and the submission together into that
same single program, which is what the reference `compile_cpp.sh` does.

The compiler runs in the job's scratch directory with plain file names, so a compiler
message names `main.cpp` and never leaks a path from this machine.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

from .package import GraderSpec

DEFAULT_PYTHON_PATH = "/usr/bin/python3"
DEFAULT_CPP_COMPILER = "g++"

# The file the submission is staged as, inside the job's scratch directory.
PYTHON_SOURCE_NAME = "main.py"
CPP_SOURCE_NAME = "main.cpp"
PROGRAM_NAME = "program"

CPP_FLAGS = ("-O2", "-std=gnu++17")

# A build that has not finished by now is not going to.
COMPILE_TIMEOUT_SECONDS = 60.0

PYTHON_NAMES = ("python", "python3", "py")
CPP_NAMES = ("cpp", "c++", "cxx", "g++")


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


def cpp_compiler_path() -> str | None:
    """The C++ compiler, or nothing when this machine has none."""
    configured = os.environ.get("CPP_COMPILER_PATH")

    if configured:
        return configured if (Path(configured).exists() or shutil.which(configured)) else None
    return shutil.which(DEFAULT_CPP_COMPILER)


def normalise_language(language: str) -> str:
    normalised = (language or "").strip().lower()

    if normalised in PYTHON_NAMES:
        return "python"
    if normalised in CPP_NAMES:
        return "cpp"
    return normalised or "unknown"


def _write(destination: Path, text: str) -> str | None:
    """Write one staged file; returns a readable reason when it could not be written."""
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text, encoding="utf-8")
    except OSError as error:
        return f"the submission could not be written out: {error}"
    return None


def _run_compiler(compiler: str, sources: Sequence[str], work_dir: Path) -> tuple[bool, str]:
    """Build one program from files already staged in `work_dir`."""
    command = [compiler, *CPP_FLAGS, "-o", PROGRAM_NAME, *sources]

    try:
        process = subprocess.run(
            command,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, f"the compiler did not finish within {int(COMPILE_TIMEOUT_SECONDS)} seconds"
    except OSError as error:
        return False, f"the compiler could not be started: {error}"

    message = ((process.stderr or "") + (process.stdout or "")).strip()

    if process.returncode != 0:
        return False, message or f"the compiler exited {process.returncode}"
    return True, message


def compile_python(
    source_code: str, work_dir: Path, *, python_executable: str | None = None
) -> CompileResult:
    destination = work_dir / PYTHON_SOURCE_NAME
    failure = _write(destination, source_code)

    if failure is not None:
        return CompileResult(ok=False, language="python", compiler_message=failure)

    interpreter = python_executable or submission_python_path()
    return CompileResult(
        ok=True,
        language="python",
        run_argv=(interpreter, str(destination)),
        artifact_path=destination,
    )


def compile_cpp(source_code: str, work_dir: Path) -> CompileResult:
    """One C++ file, built into one binary that every test then reuses."""
    compiler = cpp_compiler_path()

    if compiler is None:
        return CompileResult(
            ok=False,
            language="cpp",
            compiler_message="this checker has no C++ compiler installed",
        )

    failure = _write(work_dir / CPP_SOURCE_NAME, source_code)

    if failure is not None:
        return CompileResult(ok=False, language="cpp", compiler_message=failure)

    ok, message = _run_compiler(compiler, [CPP_SOURCE_NAME], work_dir)

    if not ok:
        return CompileResult(ok=False, language="cpp", compiler_message=message)

    binary = work_dir / PROGRAM_NAME
    return CompileResult(
        ok=True,
        language="cpp",
        run_argv=(str(binary),),
        artifact_path=binary,
        compiler_message=message,
    )


def compile_with_grader(
    language: str, source_code: str, work_dir: Path, *, grader: GraderSpec
) -> CompileResult:
    """An interactive problem: the grader and the submission become one program."""
    normalised = normalise_language(language)

    if grader.language != "cpp":
        return CompileResult(
            ok=False,
            language=normalised,
            compiler_message=f"this checker cannot build a {grader.language} grader",
        )
    if normalised != "cpp":
        return CompileResult(
            ok=False,
            language=normalised,
            compiler_message="this problem is judged by a C++ grader, so it takes C++ only",
        )

    compiler = cpp_compiler_path()

    if compiler is None:
        return CompileResult(
            ok=False,
            language="cpp",
            compiler_message="this checker has no C++ compiler installed",
        )

    work_dir.mkdir(parents=True, exist_ok=True)
    sources: list[str] = []

    try:
        # The grader's own files sit next to the submission, exactly as the reference
        # build script arranges them, so `#include "combo.h"` finds its header.
        for header in grader.headers:
            shutil.copyfile(header, work_dir / header.name)
        for source in grader.sources:
            shutil.copyfile(source, work_dir / source.name)
            sources.append(source.name)
    except OSError as error:
        return CompileResult(
            ok=False,
            language="cpp",
            compiler_message=f"the problem grader could not be staged: {error}",
        )

    failure = _write(work_dir / grader.submission_file_name, source_code)

    if failure is not None:
        return CompileResult(ok=False, language="cpp", compiler_message=failure)

    sources.append(grader.submission_file_name)
    ok, message = _run_compiler(compiler, sources, work_dir)

    if not ok:
        return CompileResult(ok=False, language="cpp", compiler_message=message)

    binary = work_dir / PROGRAM_NAME
    return CompileResult(
        ok=True,
        language="cpp",
        run_argv=(str(binary),),
        artifact_path=binary,
        compiler_message=message,
    )


def compile_submission(
    language: str,
    source_code: str,
    work_dir: Path,
    *,
    python_executable: str | None = None,
    grader: GraderSpec | None = None,
) -> CompileResult:
    """Prepare one submission for running, once, before any test."""
    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    normalised = normalise_language(language)

    if grader is not None:
        return compile_with_grader(language, source_code, work_dir, grader=grader)
    if normalised == "python":
        return compile_python(source_code, work_dir, python_executable=python_executable)
    if normalised == "cpp":
        return compile_cpp(source_code, work_dir)

    return CompileResult(
        ok=False,
        language=normalised,
        compiler_message=f"this checker does not handle {language!r} submissions",
    )
