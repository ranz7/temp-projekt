"""
The verdict matrix, ported from the reference judge (`tests/test_classify.py`).

Pure and deterministic: no processes are started here.
"""

from __future__ import annotations

import unittest

from bwrap.limits import RunLimits
from bwrap.verdict import RUN_FINISHED, classify_run


class ClassifyRunTests(unittest.TestCase):
    def setUp(self) -> None:
        self.limits = RunLimits(time_limit_ms=1000, memory_limit_mb=64)

    def test_a_clean_run_leaves_the_output_to_decide(self) -> None:
        self.assertEqual(
            classify_run(exit_code=0, cpu_ms=10, memory_kb=1024, limits=self.limits),
            RUN_FINISHED,
        )

    def test_cpu_over_the_limit_is_a_time_limit(self) -> None:
        self.assertEqual(
            classify_run(exit_code=0, cpu_ms=1001, memory_kb=100, limits=self.limits),
            "time_limit",
        )

    def test_the_wall_clock_kill_is_a_time_limit(self) -> None:
        self.assertEqual(
            classify_run(
                exit_code=-9,
                cpu_ms=1,
                memory_kb=100,
                limits=self.limits,
                killed_by_wall=True,
                signal_number=9,
            ),
            "time_limit",
        )

    def test_memory_over_the_limit(self) -> None:
        over = 64 * 1024 + 1

        self.assertEqual(
            classify_run(exit_code=0, cpu_ms=1, memory_kb=over, limits=self.limits),
            "memory_limit",
        )

    def test_memory_at_the_limit_is_still_allowed(self) -> None:
        self.assertEqual(
            classify_run(exit_code=0, cpu_ms=1, memory_kb=64 * 1024, limits=self.limits),
            RUN_FINISHED,
        )

    def test_the_kernel_saying_out_of_memory(self) -> None:
        self.assertEqual(
            classify_run(
                exit_code=-9, cpu_ms=1, memory_kb=100, limits=self.limits, killed_by_oom=True
            ),
            "memory_limit",
        )

    def test_memory_comes_before_time(self) -> None:
        """The rule that matters: too much memory and too much time reads as memory."""
        self.assertEqual(
            classify_run(
                exit_code=-9,
                cpu_ms=5000,
                memory_kb=64 * 1024 + 1,
                limits=self.limits,
                killed_by_wall=True,
                signal_number=9,
            ),
            "memory_limit",
        )

    def test_time_comes_before_a_bad_exit(self) -> None:
        self.assertEqual(
            classify_run(exit_code=1, cpu_ms=2000, memory_kb=100, limits=self.limits),
            "time_limit",
        )

    def test_a_non_zero_exit_is_a_runtime_error(self) -> None:
        self.assertEqual(
            classify_run(exit_code=1, cpu_ms=1, memory_kb=100, limits=self.limits),
            "runtime_error",
        )

    def test_a_signal_without_the_wall_clock_is_a_runtime_error(self) -> None:
        self.assertEqual(
            classify_run(
                exit_code=-9, cpu_ms=1, memory_kb=100, limits=self.limits, signal_number=9
            ),
            "runtime_error",
        )

    def test_no_exit_code_at_all_is_a_runtime_error(self) -> None:
        self.assertEqual(
            classify_run(exit_code=None, cpu_ms=1, memory_kb=100, limits=self.limits),
            "runtime_error",
        )


class LimitsTests(unittest.TestCase):
    def test_the_wall_deadline_doubles_the_time_limit(self) -> None:
        limits = RunLimits(time_limit_ms=1000, memory_limit_mb=64)

        self.assertEqual(limits.wall_deadline_ms, 2000)
        self.assertEqual(limits.memory_limit_kb, 65536)


if __name__ == "__main__":
    unittest.main()
