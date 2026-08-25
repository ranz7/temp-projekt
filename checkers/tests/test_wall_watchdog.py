"""
The wall-clock kill, ported from the reference judge (`tests/test_wall_watchdog.py`).

Timing is asserted as a wide band, never as an exact millisecond.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import unittest

from bwrap.limits import wall_deadline_ms
from bwrap.wall_watchdog import WallWatchdog

from .helpers import require_wait4


def spawn_sleeper(seconds: int = 30) -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "-c", f"import time; time.sleep({seconds})"],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class WallDeadlineFormulaTests(unittest.TestCase):
    """Pure: the deadline is twice the problem's time limit."""

    def test_the_default_factor_doubles(self) -> None:
        self.assertEqual(wall_deadline_ms(1000), 2000)
        self.assertEqual(wall_deadline_ms(100), 200)

    def test_another_factor(self) -> None:
        self.assertEqual(wall_deadline_ms(1000, 3.0), 3000)

    def test_never_below_one_millisecond(self) -> None:
        self.assertGreaterEqual(wall_deadline_ms(0), 1)
        self.assertGreaterEqual(wall_deadline_ms(-5), 1)


class WallWatchdogTests(unittest.TestCase):
    def test_a_sleeping_program_is_killed(self) -> None:
        require_wait4()
        deadline_ms = 200
        started = time.monotonic()
        process = spawn_sleeper()
        watchdog = WallWatchdog(deadline_ms)
        watchdog.arm(process.pid)

        limit = started + 5.0

        while process.poll() is None and time.monotonic() < limit:
            time.sleep(0.01)

        self.assertIsNotNone(process.poll(), "the watchdog should have killed the program")
        code = process.wait(timeout=1)

        self.assertTrue(watchdog.fired)
        self.assertEqual(code, -signal.SIGKILL)
        watchdog.cancel()

    def test_a_short_program_is_left_alone(self) -> None:
        require_wait4()
        process = subprocess.Popen(
            [sys.executable, "-c", "print(1)"],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
        )
        watchdog = WallWatchdog(5000)
        watchdog.arm(process.pid)
        code = process.wait(timeout=10)
        watchdog.cancel()

        self.assertEqual(code, 0)
        self.assertFalse(watchdog.fired)

    def test_the_cgroup_is_killed_too(self) -> None:
        require_wait4()
        killed: list[str] = []
        process = spawn_sleeper()
        watchdog = WallWatchdog(150)
        watchdog.arm(process.pid, on_timeout_extra=lambda: killed.append("cgroup"))

        limit = time.monotonic() + 5.0

        while process.poll() is None and time.monotonic() < limit:
            time.sleep(0.01)

        process.wait(timeout=1)

        self.assertEqual(killed, ["cgroup"])
        watchdog.cancel()

    def test_nothing_has_fired_before_the_deadline(self) -> None:
        require_wait4()
        process = spawn_sleeper()
        watchdog = WallWatchdog(5000)
        watchdog.arm(process.pid)

        self.assertFalse(watchdog.fired)

        watchdog.cancel()

        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=2)


if __name__ == "__main__":
    unittest.main()
