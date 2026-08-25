"""
Wall-clock kill switch.

Ported from the reference judge (`outer/wall_watchdog.py`). A test that outlives its
wall deadline has its whole process group killed, so a program that forks children or
ignores signals still ends.
"""

from __future__ import annotations

import os
import signal
import threading


class WallWatchdog:
    """Hard-kills a process group once the wall deadline passes."""

    def __init__(self, wall_deadline_ms: int) -> None:
        self.wall_deadline_ms = max(1, int(wall_deadline_ms))
        self._fired = False
        self._timer: threading.Timer | None = None
        self._pgid: int | None = None
        self._on_timeout_extra = None

    def _on_timeout(self) -> None:
        self._fired = True

        if self._on_timeout_extra is not None:
            try:
                self._on_timeout_extra()
            except Exception:
                pass

        if self._pgid is None:
            return
        try:
            os.killpg(self._pgid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass

    def arm(self, pgid: int, on_timeout_extra=None) -> None:
        """Start the countdown for one process group.

        `on_timeout_extra` also kills the run's cgroup, which catches a process that
        left its group behind with `setsid`.
        """
        self.cancel()
        self._pgid = pgid
        self._fired = False
        self._on_timeout_extra = on_timeout_extra
        self._timer = threading.Timer(self.wall_deadline_ms / 1000.0, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()

    def cancel(self) -> None:
        if self._timer is not None and not self._fired:
            self._timer.cancel()
        self._timer = None

    @property
    def fired(self) -> bool:
        return self._fired
