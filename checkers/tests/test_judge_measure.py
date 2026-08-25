"""
What a run is measured to have used.

The trap this pins down: under the sandbox the program is a grandchild of the process
the judge waits for, so `wait4` reports a millisecond or two for a run that burned
seconds. The run's own cgroup is the only honest source, and a run reaches its cgroup
by putting itself there before it starts the program.

The live tests need bubblewrap and a writable cgroup v2 tree, which the checker
container has and a laptop does not. They skip with the reason rather than passing on
a machine that cannot measure anything.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from bwrap.cgroup import cgroup_root, create_leaf, read_cpu_usage_ms, read_oom_kills, remove_leaf
from bwrap.compile import compile_submission
from bwrap.limits import RunLimits
from bwrap.pipeline import run_one_test
from bwrap.spawn import SHELL, SpawnSpec, bwrap_path, join_cgroup_argv, resolve_sandbox_mode

from .test_judge_fixtures import require_wait4

# A program that really burns processor time, and one that only waits.
BURN = (
    "import time\n"
    "end = time.process_time() + {seconds}\n"
    "total = 0\n"
    "while time.process_time() < end:\n"
    "    total += 1\n"
    "print(total)\n"
)
SLEEP = "import time\ntime.sleep({seconds})\nprint('slept')\n"
HOG = "blocks = [b'x' * (1024 * 1024) for _ in range({megabytes})]\nprint(len(blocks))\n"


def sandbox_problem() -> str | None:
    """None when a run can be sandboxed and measured here, otherwise the reason."""
    if resolve_sandbox_mode() == "none":
        return "JUDGE_SANDBOX=none, so a sandboxed run cannot be measured here"
    if bwrap_path() is None:
        return "bubblewrap is not installed on this machine"
    if cgroup_root() is None:
        return "there is no cgroup v2 hierarchy on this machine"
    try:
        leaf = create_leaf(f"probe-{uuid.uuid4().hex[:8]}", memory_limit_mb=8, pids_max=16)
        remove_leaf(leaf)
    except Exception as error:
        return f"the cgroup tree is not writable: {error}"
    return None


class JoinTheCgroupTests(unittest.TestCase):
    """A run joins its leaf itself, because moving it afterwards is too late."""

    def test_the_command_is_wrapped_so_it_joins_first(self) -> None:
        argv = join_cgroup_argv(["/usr/bin/bwrap", "--die-with-parent"], Path("/x/cgroup.procs"))

        self.assertEqual(argv[0], SHELL)
        self.assertIn("/x/cgroup.procs", argv)
        # The command still runs, as the same process, after the leaf is joined.
        self.assertEqual(argv[-2:], ["/usr/bin/bwrap", "--die-with-parent"])
        self.assertIn("exec", argv[2])

    def test_a_run_with_no_cgroup_is_not_wrapped(self) -> None:
        spec = SpawnSpec(work_dir=Path("/tmp"), run_argv=["/bin/true"])

        self.assertIsNone(spec.cgroup_procs_path)


class CgroupReadingTests(unittest.TestCase):
    """The two files the measurement now depends on, read from a directory we wrote."""

    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.path = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def test_cpu_time_is_read_in_milliseconds(self) -> None:
        (self.path / "cpu.stat").write_text(
            "usage_usec 2010456\nuser_usec 2000000\nsystem_usec 10456\n", encoding="utf-8"
        )

        self.assertEqual(read_cpu_usage_ms(self.path), 2010)

    def test_no_cpu_file_at_all(self) -> None:
        self.assertIsNone(read_cpu_usage_ms(self.path))

    def test_a_kill_for_going_over_the_memory_is_counted(self) -> None:
        (self.path / "memory.events").write_text(
            "low 0\nhigh 0\nmax 35\noom 1\noom_kill 1\n", encoding="utf-8"
        )

        self.assertEqual(read_oom_kills(self.path), 1)

    def test_a_run_the_kernel_never_killed(self) -> None:
        (self.path / "memory.events").write_text("low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\n")

        self.assertEqual(read_oom_kills(self.path), 0)
        self.assertEqual(read_oom_kills(self.path / "nowhere"), 0)


class MeasuredRunTests(unittest.TestCase):
    """Real runs, sandboxed, measured against what they were told to do."""

    def setUp(self) -> None:
        require_wait4()
        problem = sandbox_problem()

        if problem is not None:
            self.skipTest(problem)

        self._directory = tempfile.TemporaryDirectory()
        self.directory = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def run_source(self, source: str, *, time_limit_ms: int, memory_limit_mb: int = 256):
        work = self.directory / uuid.uuid4().hex[:8]
        compiled = compile_submission("python", source, work, python_executable=sys.executable)
        self.assertTrue(compiled.ok, compiled.compiler_message)
        stdin = work / "input.txt"
        stdin.write_text("", encoding="utf-8")

        return run_one_test(
            run_argv=compiled.run_argv,
            work_dir=work,
            input_path=stdin,
            limits=RunLimits(time_limit_ms=time_limit_ms, memory_limit_mb=memory_limit_mb),
            run_name=f"measure-{uuid.uuid4().hex[:8]}",
        )

    def test_a_run_that_burns_a_second_and_a_half_reports_it(self) -> None:
        """Against the broken measurement this reported zero."""
        outcome = self.run_source(BURN.format(seconds=1.5), time_limit_ms=10000)

        self.assertEqual(outcome.verdict, "finished")
        self.assertGreater(outcome.cpu_ms, 800)
        self.assertLess(outcome.cpu_ms, 5000)

    def test_a_run_that_only_sleeps_reports_almost_no_processor_time(self) -> None:
        """Sleeping is not computing, so the two must not measure the same."""
        outcome = self.run_source(SLEEP.format(seconds=1.5), time_limit_ms=10000)

        self.assertEqual(outcome.verdict, "finished")
        self.assertLess(outcome.cpu_ms, 500)

    def test_a_run_killed_by_the_clock_still_reports_what_it_burned(self) -> None:
        outcome = self.run_source(BURN.format(seconds=30), time_limit_ms=500)

        self.assertEqual(outcome.verdict, "time_limit")
        self.assertGreater(outcome.cpu_ms, 300)

    def test_processor_time_over_the_limit_is_a_time_limit_on_its_own(self) -> None:
        """The rule can fire from the measurement, not only from the wall-clock kill."""
        outcome = self.run_source(BURN.format(seconds=1.0), time_limit_ms=300)

        self.assertEqual(outcome.verdict, "time_limit")
        self.assertGreater(outcome.cpu_ms, 300)

    def test_a_program_over_its_memory_is_a_memory_limit(self) -> None:
        """The kernel stops it at the limit, so the kill is what says it went over."""
        outcome = self.run_source(HOG.format(megabytes=400), time_limit_ms=10000, memory_limit_mb=64)

        self.assertEqual(outcome.verdict, "memory_limit")

    def test_the_measurement_is_the_program_and_not_the_sandbox(self) -> None:
        """Both numbers come from the run itself, so neither reads as empty."""
        with mock.patch.dict("os.environ", {}, clear=False):
            outcome = self.run_source(BURN.format(seconds=1.0), time_limit_ms=10000)

        self.assertGreater(outcome.cpu_ms, 500)
        self.assertGreater(outcome.memory_kb, 1024)


if __name__ == "__main__":
    unittest.main()
