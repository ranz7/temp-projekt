"""
Resource measurement for one sandboxed run.

Ported from the reference judge (`outer/measure.py`).

- CPU time is user plus system time from `wait4`.
- Peak memory is `memory.peak` of the run's cgroup when there is one, and the
  process rusage otherwise.
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class MeasureSample:
    """What one finished run used."""

    cpu_ms: int
    wall_ms: int
    memory_kb: int
    exit_code: int | None
    signal_number: int | None = None
    killed_by_wall: bool = False
    killed_by_oom: bool = False


def rusage_memory_kb(max_rss: int) -> int:
    """`ru_maxrss` counts KiB on Linux and bytes on macOS."""
    if sys.platform == "darwin":
        return int(max_rss) // 1024
    return int(max_rss)


def read_memory_peak_kb(cgroup_path: str | Path) -> int | None:
    try:
        raw = (Path(cgroup_path) / "memory.peak").read_text(encoding="utf-8").strip()
        return int(raw) // 1024
    except (OSError, ValueError):
        return None


def measure_process_group(
    pid: int,
    *,
    start_monotonic: float,
    cgroup_path: str | None = None,
    killed_by_wall: bool = False,
    wall_fired: Callable[[], bool] | None = None,
) -> MeasureSample:
    """Wait for the run to end and report what it used."""
    if not hasattr(os, "wait4"):
        raise RuntimeError("this worker needs a Unix python with os.wait4")

    _pid, status, rusage = os.wait4(pid, 0)
    cpu_ms = int((rusage.ru_utime + rusage.ru_stime) * 1000)
    wall_ms = max(0, int((time.monotonic() - start_monotonic) * 1000))

    exit_code: int | None = None
    signal_number: int | None = None

    if os.WIFEXITED(status):
        exit_code = os.WEXITSTATUS(status)
    elif os.WIFSIGNALED(status):
        signal_number = os.WTERMSIG(status)
        exit_code = -signal_number

    memory_kb = rusage_memory_kb(rusage.ru_maxrss)

    if cgroup_path:
        peak = read_memory_peak_kb(cgroup_path)

        if peak is not None:
            memory_kb = peak

    if wall_fired is not None:
        try:
            killed_by_wall = bool(killed_by_wall or wall_fired())
        except Exception:
            pass

    return MeasureSample(
        cpu_ms=cpu_ms,
        wall_ms=wall_ms,
        memory_kb=memory_kb,
        exit_code=exit_code,
        signal_number=signal_number,
        killed_by_wall=killed_by_wall,
    )
