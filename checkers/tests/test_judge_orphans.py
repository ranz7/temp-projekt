"""
Orphans nobody else will ever wait for.

The judge waits for the processes of its own runs, group by group. This is the net
underneath: in a container the checker service is process 1, so every orphan on the
machine is handed to it, including ones it never started. The deployment gate that
runs `bwrap ... /bin/true` to prove the sandbox works leaves bubblewrap's helper
behind exactly that way - one per deployment, for ever, on a machine that looks
perfectly healthy.

These need a Linux process table. To make them true wherever they run rather than only
as process 1, the test asks the kernel to hand it the orphans instead.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path

from bwrap.orphans import (
    install_orphan_reaper,
    should_install,
    stop_orphan_reaper,
    sweep_orphans,
    zombie_children,
)
from bwrap.pipeline import judge_submission
from bwrap.report import JudgeRequest
from bwrap.spawn import bwrap_path

from .test_judge_fixtures import ECHO_INPUT_PYTHON, require_wait4, write_package
from .test_judge_sandbox import become_a_subreaper

# A process that leaves a child of its own behind and goes, the way the outer
# bubblewrap of the deployment gate does.
ORPHAN_MAKER = (
    "import os, time\n"
    "if os.fork():\n"
    "    os._exit(0)\n"
    "time.sleep(0.2)\n"
    "os._exit(0)\n"
)


def wait_until(condition, *, seconds: float = 20.0, pause: float = 0.1) -> bool:
    deadline = time.monotonic() + seconds

    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(pause)
    return False


def in_the_process_table(pid: int) -> bool:
    return (Path("/proc") / str(pid)).is_dir()


class OrphanBase(unittest.TestCase):
    def setUp(self) -> None:
        require_wait4()

        if not Path("/proc").is_dir():
            self.skipTest("this machine has no /proc, so it has no process table to read")
        if not become_a_subreaper():
            self.skipTest("this machine will not hand this test the orphans to wait for")

        self.addCleanup(stop_orphan_reaper)
        self.addCleanup(sweep_orphans, grace_seconds=0.0)

    def drop_an_orphan(self, argv: list[str] | None = None) -> int:
        """Leave a process under us that nobody but us can ever wait for."""
        command = argv or [sys.executable, "-c", ORPHAN_MAKER]
        # Its own session, as anything coming in from outside the service has.
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        process.wait()
        found: list[int] = []

        def orphan_arrived() -> bool:
            for pid, _pgid in zombie_children():
                if pid != process.pid:
                    found.append(pid)
                    return True
            return False

        if not wait_until(orphan_arrived, seconds=10.0):
            self.skipTest("no orphan was handed to this test, so there is nothing to wait for")
        return found[0]


class OrphansAreWaitedForTests(OrphanBase):
    def test_an_orphan_dropped_from_outside_is_waited_for(self) -> None:
        orphan = self.drop_an_orphan()

        self.assertIn(orphan, [pid for pid, _pgid in zombie_children()])
        self.assertEqual(sweep_orphans(grace_seconds=0.0), [orphan])
        self.assertFalse(in_the_process_table(orphan))

    def test_the_running_service_clears_one_by_itself(self) -> None:
        """Started, left an orphan from outside, and after a moment it is gone."""
        self.assertTrue(
            install_orphan_reaper(force=True, interval_seconds=0.1, grace_seconds=0.2)
        )
        orphan = self.drop_an_orphan()

        self.assertTrue(
            wait_until(lambda: not in_the_process_table(orphan), seconds=20.0),
            "the orphan was still in the process table",
        )

    def test_something_that_has_only_just_ended_is_left_alone(self) -> None:
        """A caller waiting for its own child reaps it at once; an orphan does not."""
        orphan = self.drop_an_orphan()

        self.assertEqual(sweep_orphans(grace_seconds=60.0), [])
        self.assertTrue(in_the_process_table(orphan))
        self.assertEqual(sweep_orphans(grace_seconds=0.0), [orphan])


@unittest.skipUnless(bwrap_path() is not None, "bubblewrap is not installed on this machine")
class TheDeploymentGateTests(OrphanBase):
    """The gate that proves the sandbox works must not cost a process for ever."""

    def test_the_gate_leaves_nothing_behind_after_a_sweep(self) -> None:
        gate = [
            bwrap_path(),
            "--unshare-pid",
            "--unshare-net",
            "--die-with-parent",
            "--ro-bind",
            "/usr",
            "/usr",
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            "--",
            "/bin/true",
        ]

        if not Path("/bin/true").exists():
            self.skipTest("/bin/true is not on this machine")

        orphan = self.drop_an_orphan(gate)

        self.assertEqual(sweep_orphans(grace_seconds=0.0), [orphan])
        self.assertFalse(in_the_process_table(orphan))


class JudgingIsNeverInterferedWithTests(OrphanBase):
    """The sweeper must never take a result from the run the judge is waiting for."""

    def test_a_submission_is_judged_normally_under_an_eager_sweeper(self) -> None:
        install_orphan_reaper(force=True, interval_seconds=0.01, grace_seconds=0.0)

        with tempfile.TemporaryDirectory() as packages:
            root = Path(packages)
            write_package(
                root,
                "many",
                hidden=[(f"{index:02d}", f"{index}\n", f"{index}\n") for index in range(1, 21)],
            )
            request = JudgeRequest(
                submission_id=str(uuid.uuid4()),
                problem_slug="many",
                package_directory="many",
                language="python",
                source_code=ECHO_INPUT_PYTHON,
            )

            with tempfile.TemporaryDirectory() as scratch:
                result = judge_submission(
                    request,
                    Path(scratch),
                    packages_path=root,
                    python_executable=sys.executable,
                )

        self.assertEqual(result.status, "accepted")
        self.assertEqual(len(result.tests), 20)
        self.assertTrue(all(test.verdict == "passed" for test in result.tests))


class OnlyProcessOneSweepsTests(unittest.TestCase):
    def test_a_process_that_inherits_no_orphans_does_not_sweep(self) -> None:
        if os.getpid() == 1:
            self.skipTest("this process is process 1, so sweeping is exactly its job")

        self.assertFalse(should_install())
        self.assertFalse(install_orphan_reaper())


if __name__ == "__main__":
    unittest.main()
