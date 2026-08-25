"""Per-test limits and the wall-clock deadline formula.

The limits of a problem apply to each test on its own, never as a shared budget for
the whole run.
"""

from __future__ import annotations

from dataclasses import dataclass

# The hard kill happens at twice the problem's time limit.
DEFAULT_WALL_FACTOR = 2.0


def wall_deadline_ms(time_limit_ms: int, wall_factor: float = DEFAULT_WALL_FACTOR) -> int:
    """Hard wall timeout for one test run: at least the time limit itself."""
    limit = max(1, int(time_limit_ms))
    return max(limit, int(limit * wall_factor))


@dataclass(frozen=True)
class RunLimits:
    """What one test run is allowed to use."""

    time_limit_ms: int
    memory_limit_mb: int
    wall_factor: float = DEFAULT_WALL_FACTOR

    @property
    def wall_deadline_ms(self) -> int:
        return wall_deadline_ms(self.time_limit_ms, self.wall_factor)

    @property
    def memory_limit_kb(self) -> int:
        return max(1, int(self.memory_limit_mb)) * 1024
