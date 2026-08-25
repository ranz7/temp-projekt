"""
Judging one Python submission: stage the source once, then run every test.

Every test runs even after one has failed, so the person is shown a complete list.
The submission's own status is the verdict of the first failing test, and its score
is the points of the hidden tests that passed.
"""

from __future__ import annotations

import logging
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from common.contract import (
    ACCEPTED,
    COMPILATION_ERROR,
    MEMORY_LIMIT,
    PASSED,
    RUNTIME_ERROR,
    TIME_LIMIT,
    WRONG_ANSWER,
    FinalReport,
    Job,
    JobTest,
    Release,
    TestReport,
)

from .cgroup import CgroupLeaf, add_process, create_leaf, kill_all, remove_leaf
from .compare import is_full_score, run_custom_checker, token_compare_files
from .compile import compile_submission
from .limits import RunLimits
from .measure import measure_process_group
from .package import PackageError, hidden_test_path
from .spawn import SpawnSpec, spawn_sandboxed
from .verdict import RUN_FINISHED, classify_run
from .wall_watchdog import WallWatchdog

logger = logging.getLogger(__name__)

# How much of a program's output is kept for the page that shows it.
OUTPUT_PREVIEW_LIMIT = 4000


@dataclass(frozen=True)
class TestPaths:
    """Where one test's input and expected output live for this run."""

    input_path: Path
    expected_path: Path


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


def prepare_test_paths(
    job: Job, test: JobTest, *, scratch: Path, packages_path: Path
) -> TestPaths:
    """A sample is written out of the payload; a hidden test is read from the disk."""
    if test.is_hidden:
        return TestPaths(
            input_path=hidden_test_path(
                packages_path, job.package_directory, test.input_file or ""
            ),
            expected_path=hidden_test_path(
                packages_path, job.package_directory, test.output_file or ""
            ),
        )

    directory = Path(scratch) / "samples"
    directory.mkdir(parents=True, exist_ok=True)
    input_path = directory / f"{test.ordinal:03d}.in"
    expected_path = directory / f"{test.ordinal:03d}.out"
    input_path.write_text(test.input_text or "", encoding="utf-8")
    expected_path.write_text(test.expected_output or "", encoding="utf-8")
    return TestPaths(input_path=input_path, expected_path=expected_path)


def _open_cgroup(name: str, limits: RunLimits) -> CgroupLeaf | None:
    """A leaf for this run, or nothing when the cgroup tree is not writable."""
    try:
        return create_leaf(name, memory_limit_mb=limits.memory_limit_mb)
    except Exception as error:
        logger.debug("Running without cgroup limits: %s", error)
        return None


@dataclass(frozen=True)
class RunOutcome:
    """One finished test run, before its output was compared."""

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
    paths: TestPaths,
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
                stdin_path=paths.input_path,
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
    job: Job,
    paths: TestPaths,
    stdout_path: Path,
    *,
    checker_script: Path | None,
) -> tuple[bool, str | None]:
    """Whitespace-insensitive by default; a problem may bring its own checker."""
    if job.checker_type == "custom":
        if checker_script is None:
            return False, "the problem names a checker script that is not there"
        try:
            score = run_custom_checker(
                checker_script,
                paths.input_path,
                paths.expected_path,
                stdout_path,
                python_executable=sys.executable,
            )
        except Exception as error:
            return False, f"the problem checker failed: {error}"

        if is_full_score(score):
            return True, None
        return False, f"the problem checker scored this answer {score:g} out of 1"

    if token_compare_files(paths.expected_path, stdout_path):
        return True, None
    return False, "wrong answer"


def _submission_status(first_failure: str | None) -> str:
    if first_failure is None or first_failure == PASSED:
        return ACCEPTED
    return first_failure


def judge_submission(
    job: Job,
    scratch: Path,
    *,
    packages_path: Path,
    python_executable: str | None = None,
    checker_script: Path | None = None,
    stop: threading.Event | None = None,
) -> FinalReport | Release:
    """Judge one submission end to end and build the report the app stores."""
    work_dir = Path(scratch) / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    limits = RunLimits(time_limit_ms=job.time_limit_ms, memory_limit_mb=job.memory_limit_mb)

    compiled = compile_submission(
        job.language, job.source_code, work_dir, python_executable=python_executable
    )

    if not compiled.ok:
        # A submission that will not build has no test rows at all.
        return FinalReport(
            status=COMPILATION_ERROR,
            score=0.0,
            max_score=job.hidden_points,
            compile_message=clip(compiled.compiler_message or "the submission does not compile"),
            tests=[],
        )

    reports: list[TestReport] = []
    first_failure: str | None = None
    score = 0.0
    max_cpu_ms = 0
    max_memory_kb = 0

    for test in job.tests:
        if stop is not None and stop.is_set():
            return Release("the checker is shutting down", keep_scratch=False)

        try:
            paths = prepare_test_paths(job, test, scratch=scratch, packages_path=packages_path)
        except (PackageError, OSError) as error:
            # Without the test files nothing can be judged, so the whole submission
            # fails rather than one test quietly turning into a wrong answer.
            raise RuntimeError(f"test {test.ordinal} cannot be read: {error}") from error

        outcome = run_one_test(
            run_argv=compiled.run_argv,
            work_dir=work_dir,
            paths=paths,
            limits=limits,
            run_name=f"test-{test.ordinal:03d}",
        )
        max_cpu_ms = max(max_cpu_ms, outcome.cpu_ms)
        max_memory_kb = max(max_memory_kb, outcome.memory_kb)

        verdict = outcome.verdict
        message: str | None = None

        if verdict == RUN_FINISHED:
            correct, message = compare_output(
                job, paths, outcome.stdout_path, checker_script=checker_script
            )
            verdict = PASSED if correct else WRONG_ANSWER
        elif verdict == TIME_LIMIT:
            message = "time limit exceeded"
        elif verdict == MEMORY_LIMIT:
            message = "memory limit exceeded"
        elif verdict == RUNTIME_ERROR:
            detail = read_preview(outcome.stderr_path, 500).strip()
            message = f"runtime error (exit code {outcome.exit_code})"

            if outcome.signal_number:
                message = f"runtime error (killed by signal {outcome.signal_number})"
            if detail:
                message = f"{message}: {detail}"

        passed = verdict == PASSED

        if passed and test.is_hidden:
            score += test.points
        if not passed and first_failure is None:
            first_failure = verdict

        reports.append(
            TestReport(
                problem_test_id=test.problem_test_id,
                ordinal=test.ordinal,
                verdict=verdict,
                passed=passed,
                points_awarded=test.points if passed else 0.0,
                # A hidden test never gives its content or the program's output back.
                message=None if test.is_hidden else message,
                actual_output=None if test.is_hidden else read_preview(outcome.stdout_path),
                time_ms=outcome.cpu_ms,
                memory_kb=outcome.memory_kb,
            )
        )

    return FinalReport(
        status=_submission_status(first_failure),
        score=score,
        max_score=job.hidden_points,
        compile_message=None,
        max_cpu_ms=max_cpu_ms,
        max_memory_kb=max_memory_kb,
        tests=reports,
    )
