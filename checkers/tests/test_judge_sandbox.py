"""
What a run leaves behind, and whose fault a sandbox that will not start is.

Two rules live here. Every process a run starts is waited for, including the helper
bubblewrap starts inside the run and including a run that was killed: one left behind
per test fills a machine's process table, and then no further submission can be judged
at all while the machine still looks healthy. And a sandbox that will not start is
this machine's failure, not the person's, so it is an internal error for the whole
submission rather than a verdict saying their program crashed.

The zombie test needs the real sandbox and a Linux process table, so it skips
elsewhere with the reason. The sandbox-failure tests need neither: they stand a fake
bubblewrap in the way that fails the way the real one does.
"""

from __future__ import annotations

import ctypes
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from bwrap.package import PackageError
from bwrap.pipeline import judge_submission
from bwrap.report import JudgeRequest
from bwrap.spawn import sandbox_failure_message

from .test_judge_fixtures import ECHO_INPUT_PYTHON, require_wait4, write_package
from .test_judge_measure import sandbox_problem

# Real complaints bubblewrap makes before the program has run at all.
OUT_OF_PROCESSES = "bwrap: Can't fork for pid 1: Resource temporarily unavailable"
BAD_MOUNT = "bwrap: Failed to make / slave: Permission denied"
NO_PROC = "bwrap: Can't mount proc on /newroot/proc: Operation not permitted"

PR_SET_CHILD_SUBREAPER = 36


def become_a_subreaper() -> bool:
    """Ask the kernel to reparent this run's orphans to us, so we can count them."""
    try:
        libc = ctypes.CDLL("libc.so.6", use_errno=True)
        return libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) == 0
    except (OSError, AttributeError):
        return False


def own_zombies() -> list[int]:
    """Our own children that have ended and that nobody has waited for."""
    left: list[int] = []
    mine = str(os.getpid())

    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            status = (Path("/proc") / entry / "status").read_text(encoding="utf-8")
        except OSError:
            continue

        fields = {
            line.split(":", 1)[0]: line.split(":", 1)[1].strip()
            for line in status.splitlines()
            if ":" in line
        }

        if fields.get("State", "").startswith("Z") and fields.get("PPid") == mine:
            left.append(int(entry))
    return left


def fake_bwrap(directory: Path, message: str, *, exit_code: int = 1) -> Path:
    """A bubblewrap that fails the way the real one does when a machine is full."""
    path = Path(directory) / "bwrap"
    path.write_text(
        f'#!/bin/sh\necho "{message}" >&2\nexit {exit_code}\n',
        encoding="utf-8",
    )
    path.chmod(0o755)
    return path


class SandboxFailureWordsTests(unittest.TestCase):
    """Told apart by what the sandbox says, never by the exit code alone."""

    def test_the_machine_being_out_of_processes(self) -> None:
        self.assertEqual(
            sandbox_failure_message(OUT_OF_PROCESSES + "\n"),
            "Can't fork for pid 1: Resource temporarily unavailable",
        )

    def test_a_mount_it_could_not_make(self) -> None:
        self.assertIsNotNone(sandbox_failure_message(BAD_MOUNT))
        self.assertIsNotNone(sandbox_failure_message(NO_PROC))

    def test_a_program_that_crashed_says_nothing_of_the_sort(self) -> None:
        self.assertIsNone(sandbox_failure_message("Traceback (most recent call last):\n"))
        self.assertIsNone(sandbox_failure_message(""))

    def test_a_program_naming_the_sandbox_later_is_still_its_own_failure(self) -> None:
        """Only the first thing said counts: after it, the program's output begins."""
        self.assertIsNone(sandbox_failure_message("Traceback\nbwrap: not really\n"))


class SandboxThatWillNotStartTests(unittest.TestCase):
    """End to end, with a bubblewrap that fails instead of the real one."""

    def setUp(self) -> None:
        require_wait4()
        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)
        write_package(
            self.root,
            "fixture",
            samples=[("01", "hi\n", "hi\n")],
            hidden=[("01", "42\n", "42\n")],
        )

    def judge_with(self, bwrap: Path):
        request = JudgeRequest(
            submission_id="0198df77-9122-7000-8000-000000000031",
            problem_slug="fixture",
            package_directory="fixture",
            language="python",
            source_code=ECHO_INPUT_PYTHON,
        )
        environment = {"JUDGE_SANDBOX": "bwrap", "BWRAP_PATH": str(bwrap)}

        with (
            tempfile.TemporaryDirectory() as scratch,
            mock.patch.dict("os.environ", environment),
        ):
            return judge_submission(
                request,
                Path(scratch),
                packages_path=self.root,
                python_executable=sys.executable,
            )

    def test_a_full_machine_is_an_internal_error_and_not_the_person_s_fault(self) -> None:
        result = self.judge_with(fake_bwrap(self.root, OUT_OF_PROCESSES))

        self.assertEqual(result.status, "internal_error")
        self.assertNotEqual(result.status, "runtime_error")
        self.assertEqual(result.tests, [])
        self.assertIn("sandbox could not start", result.compile_message)
        self.assertIn("Resource temporarily unavailable", result.compile_message)

    def test_a_sandbox_that_cannot_mount_says_so_too(self) -> None:
        result = self.judge_with(fake_bwrap(self.root, NO_PROC))

        self.assertEqual(result.status, "internal_error")
        self.assertIn("Can't mount proc", result.compile_message)

    def test_a_program_of_their_own_that_fails_is_still_their_verdict(self) -> None:
        """The same exit code, without the sandbox complaining, stays a runtime error."""
        result = self.judge_with(fake_bwrap(self.root, "Traceback (most recent call last):"))

        self.assertEqual(result.status, "runtime_error")
        self.assertEqual(len(result.tests), 2)


class NothingIsLeftBehindTests(unittest.TestCase):
    """Dozens of real sandboxed runs must not add one process to the machine."""

    def setUp(self) -> None:
        require_wait4()
        problem = sandbox_problem()

        if problem is not None:
            self.skipTest(problem)
        if not Path("/proc").is_dir():
            self.skipTest("this machine has no /proc to count processes in")
        if not become_a_subreaper():
            self.skipTest("this machine will not make the test a subreaper of its runs")

        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def judge(self, package: str):
        request = JudgeRequest(
            submission_id=str(uuid.uuid4()),
            problem_slug=package,
            package_directory=package,
            language="python",
            source_code=ECHO_INPUT_PYTHON,
        )

        with tempfile.TemporaryDirectory() as scratch:
            return judge_submission(
                request,
                Path(scratch),
                packages_path=self.root,
                python_executable=sys.executable,
            )

    def test_thirty_sandboxed_tests_leave_no_process_behind(self) -> None:
        write_package(
            self.root,
            "many",
            hidden=[(f"{index:02d}", f"{index}\n", f"{index}\n") for index in range(1, 31)],
        )
        before = len(own_zombies())
        result = self.judge("many")

        self.assertEqual(result.status, "accepted")
        self.assertEqual(len(result.tests), 30)
        self.assertEqual(len(own_zombies()), before)

    def test_runs_that_are_killed_leave_nothing_behind_either(self) -> None:
        """A run stopped by the clock has to be waited for just the same."""
        write_package(
            self.root,
            "slow",
            problem={"limits": {"timeLimitMs": 200, "memoryLimitMb": 256}},
            hidden=[(f"{index:02d}", "1\n", "1\n") for index in range(1, 6)],
        )
        before = len(own_zombies())
        request = JudgeRequest(
            submission_id=str(uuid.uuid4()),
            problem_slug="slow",
            package_directory="slow",
            language="python",
            source_code="import time\ntime.sleep(30)\n",
        )

        with tempfile.TemporaryDirectory() as scratch:
            result = judge_submission(
                request, Path(scratch), packages_path=self.root, python_executable=sys.executable
            )

        self.assertEqual(result.status, "time_limit")
        self.assertEqual(len(own_zombies()), before)

    def test_a_package_that_cannot_be_read_leaves_nothing_behind(self) -> None:
        before = len(own_zombies())

        with self.assertRaises(PackageError):
            self.judge("not-a-problem")

        self.assertEqual(len(own_zombies()), before)


if __name__ == "__main__":
    unittest.main()
