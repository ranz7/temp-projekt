"""
The verdict of one run, before its output is looked at.

The order is a rule of the specification and this function is the only place it is
written down: memory over the limit first, then time over the limit or killed by the
wall clock, then a non-zero exit or a signal, and only then the output comparison,
which the caller does when this returns `RUN_FINISHED`.
"""

from __future__ import annotations

from common.contract import MEMORY_LIMIT, RUNTIME_ERROR, TIME_LIMIT

from .limits import RunLimits

# The process ended cleanly and within its limits, so its output decides.
RUN_FINISHED = "finished"


def classify_run(
    *,
    exit_code: int | None,
    cpu_ms: int,
    memory_kb: int,
    limits: RunLimits,
    killed_by_wall: bool = False,
    killed_by_oom: bool = False,
    signal_number: int | None = None,
) -> str:
    """Map what one run used to a verdict, or to `RUN_FINISHED`."""
    if killed_by_oom:
        return MEMORY_LIMIT
    if memory_kb > limits.memory_limit_kb:
        return MEMORY_LIMIT
    if killed_by_wall or cpu_ms > limits.time_limit_ms:
        return TIME_LIMIT
    if exit_code is None or exit_code != 0 or signal_number:
        return RUNTIME_ERROR
    return RUN_FINISHED
