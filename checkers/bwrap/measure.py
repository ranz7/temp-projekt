"""
Resource measurement for one sandboxed run.

Ported from the reference judge (`outer/measure.py`).

- CPU time comes from the run's cgroup when there is one, and from `wait4` otherwise.
  The cgroup is the only source that is right under the sandbox: the program is a
  grandchild of the process the judge waits for, and its CPU time never reaches
  `wait4`, which reports a couple of milliseconds for a run that burned seconds.
- Peak memory is `memory.peak` of the run's cgroup when there is one, and the
  process rusage otherwise.
- A run the kernel killed for going over its memory shows up in `memory.events`. It
  has to, because such a run is stopped at the limit and so never measures above it.
- Every process a run started is waited for before the run is done with. Bubblewrap
  starts a helper of its own inside the run's process group; nobody else will ever
  wait for it, and one left behind per test is what fills a machine's process table
  and stops any further sandbox from starting.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .cgroup import read_cpu_usage_ms, read_oom_kills

logger = logging.getLogger(__name__)

# How long to keep waiting for the rest of a run to end after its first process has.
REAP_DEADLINE_SECONDS = 5.0
REAP_PAUSE_SECONDS = 0.005


def reap_process_group(pgid: int, *, deadline_seconds: float = REAP_DEADLINE_SECONDS) -> list[int]:
    """Wait for everything left in a run's process group, and say what was left.

    A run is one process group, so this waits for that group and nothing else: another
    submission being judged at the same time is a different group and is never touched.
    """
    collected: list[int] = []
    deadline = time.monotonic() + max(0.0, deadline_seconds)

    while True:
        try:
            pid, _status = os.waitpid(-int(pgid), os.WNOHANG)
        except ChildProcessError:
            # Nothing of this run is left to wait for, which is where it should end.
            return collected
        except OSError as error:
            logger.debug("Could not wait for the run's process group: %s", error)
            return collected

        if pid:
            collected.append(pid)
            continue
        if time.monotonic() >= deadline:
            logger.warning(
                "A run left processes behind in group %s that would not end.", pgid
            )
            return collected

        time.sleep(REAP_PAUSE_SECONDS)


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
    killed_by_oom: bool = False,
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

        # The cgroup counts every process the run started, `wait4` only what it was
        # handed back, so the larger of the two is the honest number.
        cgroup_cpu_ms = read_cpu_usage_ms(cgroup_path)

        if cgroup_cpu_ms is not None:
            cpu_ms = max(cpu_ms, cgroup_cpu_ms)

        killed_by_oom = killed_by_oom or read_oom_kills(cgroup_path) > 0

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
        killed_by_oom=killed_by_oom,
    )
