"""
Judging one submission: build it once, then run every test.

Every test runs even after one has failed, so the person is shown a complete list.
The submission's own status is the verdict of the first failing test, and its score is
the points of the hidden tests that passed; public samples are worth nothing.

An ordinary problem compares the program's output with the expected file, or scores it
with the problem's own checker script. An interactive problem has no expected file at
all: the submission is built into one program with the problem's grader, and the
verdict is whatever that grader printed.
"""

from __future__ import annotations

import logging
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from .cgroup import CgroupLeaf, add_process, create_leaf, kill_all, remove_leaf
from .compare import is_full_score, run_custom_checker, token_compare_files
from .compile import compile_submission, submission_python_path
from .limits import RunLimits
from .measure import measure_process_group
from .package import CUSTOM_CHECKER, PackageTest, ProblemPackage, load_package
from .report import (
    ACCEPTED,
    MEMORY_LIMIT,
    PASSED,
    RUNTIME_ERROR,
    TIME_LIMIT,
    WRONG_ANSWER,
    JudgeCancelled,
    JudgeRequest,
    JudgeResult,
    TestResult,
    compilation_error,
    internal_error,
)
from .spawn import SpawnSpec, spawn_sandboxed
from .verdict import (
    GRADER_SILENT,
    GRADER_UNRECOGNISED,
    RUN_FINISHED,
    classify_run,
    read_grader_verdict,
)
from .wall_watchdog import WallWatchdog

logger = logging.getLogger(__name__)

# How much of a program's output is kept for the page that shows it.
OUTPUT_PREVIEW_LIMIT = 4000

# How much of the end of a program's output is searched for the grader's verdict.
GRADER_TAIL_LIMIT = 64 * 1024


def clip(text: str, limit: int = OUTPUT_PREVIEW_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... ({len(text) - limit} more characters)"


def read_preview(path: Path, limit: int = OUTPUT_PREVIEW_LIMIT) -> str:
    try:
        raw = path.read_bytes()
    except OSError:
        return ""
    return clip(raw[: limit * 2].decode("utf-8", errors="replace"), limit)


def read_tail(path: Path, limit: int = GRADER_TAIL_LIMIT) -> str:
    """The end of a file. The grader speaks last, so its line is at the end."""
    try:
        with open(path, "rb") as handle:
            handle.seek(0, 2)
            handle.seek(max(0, handle.tell() - limit))
            raw = handle.read()
    except OSError:
        return ""
    return raw.decode("utf-8", errors="replace")


def _open_cgroup(name: str, limits: RunLimits) -> CgroupLeaf | None:
    """A leaf for this run, or nothing when the cgroup tree is not writable."""
    try:
        return create_leaf(name, memory_limit_mb=limits.memory_limit_mb)
    except Exception as error:
        logger.debug("Running without cgroup limits: %s", error)
        return None


@dataclass(frozen=True)
class RunOutcome:
    """One finished test run, before its output was looked at."""

    verdict: str
    cpu_ms: int
    memory_kb: int
    exit_code: int | None
    signal_number: int | None
    stdout_path: Path
    stderr_path: Path


def run_one_test(
    *,
    run_argv: Sequence[str],
    work_dir: Path,
    input_path: Path,
    limits: RunLimits,
    run_name: str,
) -> RunOutcome:
    """Run the program once against one test, under the sandbox and the limits."""
    stdout_path = Path(work_dir) / f"{run_name}.stdout"
    stderr_path = Path(work_dir) / f"{run_name}.stderr"
    leaf = _open_cgroup(run_name, limits)
    cgroup_path = str(leaf.path) if leaf is not None else None
    watchdog = WallWatchdog(limits.wall_deadline_ms)
    process = None

    try:
        started = time.monotonic()
        process = spawn_sandboxed(
            SpawnSpec(
                work_dir=Path(work_dir),
                run_argv=list(run_argv),
                stdin_path=input_path,
                stdout_path=stdout_path,
                stderr_path=stderr_path,
            )
        )

        if leaf is not None:
            try:
                # Immediately after the spawn, so the limits cover the whole run.
                add_process(leaf, process.pid)
            except Exception as error:
                logger.debug("Could not put the run in its cgroup: %s", error)
                cgroup_path = None

        watchdog.arm(
            process.pid,
            on_timeout_extra=(lambda: kill_all(leaf)) if leaf is not None else None,
        )
        sample = measure_process_group(
            process.pid,
            start_monotonic=started,
            cgroup_path=cgroup_path,
            wall_fired=lambda: watchdog.fired,
        )
        watchdog.cancel()
        process.returncode = sample.exit_code if sample.exit_code is not None else -1

        verdict = classify_run(
            exit_code=sample.exit_code,
            cpu_ms=sample.cpu_ms,
            memory_kb=sample.memory_kb,
            limits=limits,
            killed_by_wall=sample.killed_by_wall,
            killed_by_oom=sample.killed_by_oom,
            signal_number=sample.signal_number,
        )

        return RunOutcome(
            verdict=verdict,
            cpu_ms=sample.cpu_ms,
            memory_kb=sample.memory_kb,
            exit_code=sample.exit_code,
            signal_number=sample.signal_number,
            stdout_path=stdout_path,
            stderr_path=stderr_path,
        )
    finally:
        watchdog.cancel()

        if process is not None and process.poll() is None:
            try:
                import os
                import signal as signal_module

                os.killpg(process.pid, signal_module.SIGKILL)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass

        if leaf is not None:
            try:
                remove_leaf(leaf)
            except Exception:
                pass


def compare_output(
    package: ProblemPackage, test: PackageTest, stdout_path: Path
) -> tuple[bool, str | None]:
    """Whitespace-insensitive by default; a problem may bring its own checker."""
    if test.expected_path is None:
        return False, "this test has no expected output"

    if package.checker_type == CUSTOM_CHECKER:
        if package.checker_path is None:
            return False, "the problem names a checker script that is not there"
        try:
            score = run_custom_checker(
                package.checker_path,
                test.input_path,
                test.expected_path,
                stdout_path,
                python_executable=sys.executable,
            )
        except Exception as error:
            return False, f"the problem checker failed: {error}"

        if is_full_score(score):
            return True, None
        return False, f"the problem checker scored this answer {score:g} out of 1"

    if token_compare_files(test.expected_path, stdout_path):
        return True, None
    return False, "wrong answer"


@dataclass(frozen=True)
class _TestOutcome:
    """One judged test, before it becomes a row."""

    verdict: str
    message: str | None = None
    presses: int | None = None
    internal_error_message: str | None = None


def _judge_ordinary_run(
    package: ProblemPackage, test: PackageTest, outcome: RunOutcome
) -> _TestOutcome:
    correct, message = compare_output(package, test, outcome.stdout_path)
    return _TestOutcome(verdict=PASSED if correct else WRONG_ANSWER, message=message)


def _judge_interactive_run(test: PackageTest, outcome: RunOutcome) -> _TestOutcome:
    """The grader's own words are the verdict; nothing is compared against a file."""
    said = read_grader_verdict(read_tail(outcome.stdout_path))

    if said.verdict == GRADER_SILENT:
        return _TestOutcome(verdict=RUNTIME_ERROR, message=said.message)
    if said.verdict == GRADER_UNRECOGNISED:
        return _TestOutcome(
            verdict=RUNTIME_ERROR,
            internal_error_message=f"test {test.ordinal}: {said.message}",
        )
    return _TestOutcome(verdict=said.verdict, message=said.message, presses=said.presses)


def _runtime_error_message(outcome: RunOutcome) -> str:
    detail = read_preview(outcome.stderr_path, 500).strip()
    message = f"runtime error (exit code {outcome.exit_code})"

    if outcome.signal_number:
        message = f"runtime error (killed by signal {outcome.signal_number})"
    if detail:
        message = f"{message}: {detail}"
    return message


def _submission_status(first_failure: str | None) -> str:
    if first_failure is None or first_failure == PASSED:
        return ACCEPTED
    return first_failure


def judge_submission(
    request: JudgeRequest,
    scratch: Path,
    *,
    packages_path: Path,
    python_executable: str | None = None,
    stop: threading.Event | None = None,
) -> JudgeResult:
    """Judge one submission end to end and build the report the app stores.

    Raises `PackageError` when this machine cannot read the problem at all, and
    `JudgeCancelled` when `stop` is set part way, so the submission stays waiting
    instead of being failed.
    """
    package = load_package(packages_path, request.package_directory)
    work_dir = Path(scratch) / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    limits = RunLimits(
        time_limit_ms=package.time_limit_ms, memory_limit_mb=package.memory_limit_mb
    )
    max_score = package.hidden_points

    compiled = compile_submission(
        request.language,
        request.source_code,
        work_dir,
        python_executable=python_executable or submission_python_path(),
        grader=package.grader,
    )

    if not compiled.ok:
        # A submission that will not build has no test rows at all.
        return compilation_error(
            clip(compiled.compiler_message or "the submission does not compile"),
            max_score=max_score,
        )

    rows: list[TestResult] = []
    first_failure: str | None = None
    score = 0.0
    max_cpu_ms = 0
    max_memory_kb = 0

    for test in package.tests:
        if stop is not None and stop.is_set():
            raise JudgeCancelled("the checker is shutting down")

        outcome = run_one_test(
            run_argv=compiled.run_argv,
            work_dir=work_dir,
            input_path=test.input_path,
            limits=limits,
            run_name=f"test-{test.ordinal:03d}",
        )
        max_cpu_ms = max(max_cpu_ms, outcome.cpu_ms)
        max_memory_kb = max(max_memory_kb, outcome.memory_kb)

        if outcome.verdict == RUN_FINISHED:
            if package.is_interactive:
                judged = _judge_interactive_run(test, outcome)
            else:
                judged = _judge_ordinary_run(package, test, outcome)
        elif outcome.verdict == TIME_LIMIT:
            judged = _TestOutcome(verdict=TIME_LIMIT, message="time limit exceeded")
        elif outcome.verdict == MEMORY_LIMIT:
            judged = _TestOutcome(verdict=MEMORY_LIMIT, message="memory limit exceeded")
        else:
            judged = _TestOutcome(
                verdict=RUNTIME_ERROR, message=_runtime_error_message(outcome)
            )

        if judged.internal_error_message is not None:
            # The grader said something nobody can act on, so nothing is judged at all.
            return internal_error(clip(judged.internal_error_message), max_score=max_score)

        passed = judged.verdict == PASSED

        if passed and test.is_hidden:
            score += test.points
        if not passed and first_failure is None:
            first_failure = judged.verdict

        rows.append(
            TestResult(
                ordinal=test.ordinal,
                name=test.name,
                visibility=test.visibility,
                verdict=judged.verdict,
                passed=passed,
                points_awarded=test.points if passed else 0.0,
                # A hidden test never gives its content or the program's output back.
                message=None if test.is_hidden else judged.message,
                actual_output=None if test.is_hidden else read_preview(outcome.stdout_path),
                time_ms=outcome.cpu_ms,
                memory_kb=outcome.memory_kb,
                presses=judged.presses,
            )
        )

    return JudgeResult(
        status=_submission_status(first_failure),
        score=score,
        max_score=max_score,
        compile_message=None,
        max_cpu_ms=max_cpu_ms,
        max_memory_kb=max_memory_kb,
        tests=rows,
    )
