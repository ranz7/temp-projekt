"""
cgroup v2 leaves, one per test run.

Ported from the reference judge (`outer/cgroup.py`). The leaf caps memory and the
number of processes, and `cgroup.kill` stops a program that escaped its process group.
When the cgroup tree is not writable the caller carries on without it: the run is
still bounded by the wall-clock kill and measured through rusage.

The leaf is also where a run is measured. A sandboxed program is a grandchild of the
process the judge waits for, and the CPU time of that grandchild never reaches the
judge through `wait4`, so `cpu.stat` here is the only honest source. It keeps counting
for a run that was killed, and `memory.events` says whether the kernel killed the run
for going over its memory.
"""

from __future__ import annotations

import os
import signal
import time
from dataclasses import dataclass
from pathlib import Path

DEFAULT_CGROUP_ROOT = "/sys/fs/cgroup"

# The file a process writes its own id into to join a leaf.
CGROUP_PROCS = "cgroup.procs"

# A fork bomb never gets more than this many processes.
DEFAULT_PIDS_MAX = 128


@dataclass
class CgroupLeaf:
    """One leaf cgroup for a single test execution."""

    path: Path
    memory_max_bytes: int
    pids_max: int


def cgroup_root() -> Path | None:
    """The cgroup v2 mount, or None when this machine has none."""
    root = Path(os.environ.get("CGROUP_ROOT") or DEFAULT_CGROUP_ROOT)

    if not root.is_dir():
        return None
    if not (root / "cgroup.controllers").is_file():
        return None
    return root


def _enable_controllers(directory: Path, controllers: tuple[str, ...] = ("memory", "pids")) -> None:
    """Best effort: a controller a host will not delegate simply stays off."""
    subtree = directory / "cgroup.subtree_control"

    if not subtree.is_file():
        return
    try:
        current = subtree.read_text(encoding="utf-8").strip().split()
        needed = [f"+{name}" for name in controllers if name not in current]

        if needed:
            subtree.write_text(" ".join(needed) + "\n", encoding="utf-8")
    except OSError:
        return


def create_leaf(
    name: str,
    *,
    memory_limit_mb: int,
    pids_max: int = DEFAULT_PIDS_MAX,
    parent: Path | None = None,
) -> CgroupLeaf:
    """Create the leaf and write `memory.max` and `pids.max` into it."""
    root = cgroup_root()

    if root is None:
        raise RuntimeError("no cgroup v2 hierarchy on this machine")

    safe = name.replace("/", "_").replace("..", "_").strip() or "job"
    base = Path(parent) if parent is not None else (root / "oj")

    try:
        base.mkdir(parents=True, exist_ok=True)
        _enable_controllers(root)
        _enable_controllers(base)
    except OSError as error:
        raise RuntimeError(f"cannot use the cgroup parent {base}: {error}") from error

    leaf_path = base / safe

    try:
        leaf_path.mkdir(parents=False, exist_ok=False)
    except FileExistsError:
        if any(leaf_path.iterdir()):
            raise RuntimeError(f"the cgroup leaf {leaf_path} is already busy") from None
    except OSError as error:
        raise RuntimeError(f"cannot create the cgroup leaf {leaf_path}: {error}") from error

    memory_bytes = max(1, int(memory_limit_mb)) * 1024 * 1024
    processes = max(1, int(pids_max))

    try:
        (leaf_path / "memory.max").write_text(f"{memory_bytes}\n", encoding="utf-8")
        (leaf_path / "pids.max").write_text(f"{processes}\n", encoding="utf-8")
    except OSError as error:
        try:
            leaf_path.rmdir()
        except OSError:
            pass
        raise RuntimeError(f"cannot set the limits on {leaf_path}: {error}") from error

    return CgroupLeaf(path=leaf_path, memory_max_bytes=memory_bytes, pids_max=processes)


def procs_path(leaf: CgroupLeaf) -> Path:
    """The file a process joins the leaf by writing its own id into."""
    return Path(leaf.path) / CGROUP_PROCS


def add_process(leaf: CgroupLeaf, pid: int) -> None:
    """Move a process into the leaf, so its limits start counting.

    Only that one process moves: anything it had already started stays where it was,
    which is why a run joins its leaf itself, before it starts anything.
    """
    procs_path(leaf).write_text(f"{int(pid)}\n", encoding="utf-8")


def contains_process(leaf: CgroupLeaf, pid: int) -> bool:
    """Whether that process is in the leaf right now."""
    try:
        listed = procs_path(leaf).read_text(encoding="utf-8").split()
    except OSError:
        return False
    return str(int(pid)) in listed


def kill_all(leaf: CgroupLeaf) -> None:
    """Kill every process in the leaf, even one that left its process group."""
    path = Path(leaf.path)
    kill_file = path / "cgroup.kill"

    if kill_file.is_file():
        try:
            kill_file.write_text("1\n", encoding="utf-8")
            return
        except OSError:
            pass

    try:
        listed = (path / "cgroup.procs").read_text(encoding="utf-8")
    except OSError:
        return

    for line in listed.splitlines():
        line = line.strip()

        if not line:
            continue
        try:
            os.kill(int(line), signal.SIGKILL)
        except (ValueError, ProcessLookupError, PermissionError):
            continue


def read_cpu_usage_ms(path: Path | str) -> int | None:
    """The CPU time everything in the cgroup used, in milliseconds.

    This is what a run really spent, whether it ended by itself or was killed, and it
    covers every process it started.
    """
    try:
        raw = (Path(path) / "cpu.stat").read_text(encoding="utf-8")
    except OSError:
        return None

    for line in raw.splitlines():
        key, _, value = line.strip().partition(" ")

        if key == "usage_usec":
            try:
                return int(value.strip()) // 1000
            except ValueError:
                return None
    return None


def read_oom_kills(path: Path | str) -> int:
    """How many processes the kernel killed here for going over the memory limit."""
    try:
        raw = (Path(path) / "memory.events").read_text(encoding="utf-8")
    except OSError:
        return 0

    for line in raw.splitlines():
        key, _, value = line.strip().partition(" ")

        if key == "oom_kill":
            try:
                return int(value.strip())
            except ValueError:
                return 0
    return 0


def memory_peak_kb(leaf: CgroupLeaf) -> int | None:
    """The authoritative peak memory of the run, in KiB."""
    return read_memory_peak_kb(leaf.path)


def read_memory_peak_kb(path: Path | str) -> int | None:
    try:
        raw = (Path(path) / "memory.peak").read_text(encoding="utf-8").strip()
        return int(raw) // 1024
    except (OSError, ValueError):
        return None


def remove_leaf(leaf: CgroupLeaf, *, wait_empty_seconds: float = 0.5) -> None:
    """Kill what is left inside, wait for it to empty, then drop the leaf."""
    path = Path(leaf.path)
    kill_all(leaf)
    procs = path / "cgroup.procs"
    deadline = time.monotonic() + wait_empty_seconds

    while time.monotonic() < deadline:
        try:
            if not procs.read_text(encoding="utf-8").strip():
                break
        except OSError:
            break
        time.sleep(0.01)
        kill_all(leaf)

    try:
        path.rmdir()
    except OSError:
        kill_all(leaf)
        time.sleep(0.05)
        try:
            path.rmdir()
        except OSError:
            return
