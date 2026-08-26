"""
Waiting for orphans nobody else will.

The judge waits for every process of every run it starts, group by group, and that is
the fast path. This is the net underneath it. In a container the checker service is
process 1, and process 1 inherits every orphan on the machine, including ones it never
started: the deployment gate that runs `bwrap ... /bin/true` to prove the sandbox works
leaves bubblewrap's helper behind exactly that way. Nobody else can ever wait for those,
so process 1 has to, or they sit there until the machine runs out of processes.

Three rules keep the sweeper off anything that is being waited for:

- A run holds its process group from before it is started until after it has been
  waited for, and the sweeper skips those groups.
- Anything in this process's own group was started by a caller that is waiting for it
  right now - the compiler, a problem's checker script - so the sweeper skips those too.
- Anything else must have been sitting there, ended and unwaited for, for several
  seconds before it is taken. A caller that is waiting for its own child reaps it in
  the same breath; only a real orphan is still there seconds later.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)

PROC = Path("/proc")

# How often to look, and how long something must have been left behind to be taken.
ORPHAN_SWEEP_SECONDS = 2.0
ORPHAN_GRACE_SECONDS = 4.0

_sweep_lock = threading.Lock()
_state_lock = threading.Lock()
_active_groups: set[int] = set()
# Zombie process id -> when this sweeper first saw it.
_seen_since: dict[int, float] = {}

_thread: threading.Thread | None = None
_stop = threading.Event()


@contextmanager
def starting_a_run() -> Iterator[None]:
    """Hold the sweeper off while a run is started and its group written down."""
    with _sweep_lock:
        yield


def claim_run(pgid: int) -> None:
    """This process group belongs to a run that is being waited for."""
    with _state_lock:
        _active_groups.add(int(pgid))


def release_run(pgid: int) -> None:
    """The run is over and everything it started has been waited for."""
    with _state_lock:
        _active_groups.discard(int(pgid))


def active_groups() -> set[int]:
    with _state_lock:
        return set(_active_groups)


def _read_stat(pid: str) -> tuple[str, int, int] | None:
    """The state, parent and process group of one process, or nothing."""
    try:
        raw = (PROC / pid / "stat").read_text(encoding="utf-8")
    except (OSError, ValueError):
        return None

    try:
        # The command sits in brackets and may hold spaces, so read past it.
        fields = raw[raw.rindex(")") + 2 :].split()
        return fields[0], int(fields[1]), int(fields[2])
    except (ValueError, IndexError):
        return None


def zombie_children() -> list[tuple[int, int]]:
    """Our own children that have ended and that nobody has waited for."""
    if not PROC.is_dir():
        return []

    mine = os.getpid()
    found: list[tuple[int, int]] = []

    try:
        entries = os.listdir(PROC)
    except OSError:
        return []

    for entry in entries:
        if not entry.isdigit():
            continue

        stat = _read_stat(entry)

        if stat is None:
            continue

        state, ppid, pgid = stat

        if state.startswith("Z") and ppid == mine:
            found.append((int(entry), pgid))
    return found


def sweep_orphans(*, grace_seconds: float = ORPHAN_GRACE_SECONDS) -> list[int]:
    """Wait for everything left under us that no caller of ours is waiting for."""
    reaped: list[int] = []

    with _sweep_lock:
        try:
            my_group = os.getpgrp()
        except OSError:
            my_group = -1

        running = active_groups()
        now = time.monotonic()
        zombies = zombie_children()
        _seen_since.update(
            {pid: _seen_since.get(pid, now) for pid, _pgid in zombies}
        )

        for pid, pgid in zombies:
            if pgid == my_group or pgid in running:
                # Someone in this process is waiting for that one right now.
                continue
            if now - _seen_since.get(pid, now) < max(0.0, grace_seconds):
                continue

            try:
                waited, _status = os.waitpid(pid, os.WNOHANG)
            except (ChildProcessError, OSError):
                _seen_since.pop(pid, None)
                continue

            if waited:
                reaped.append(waited)
                _seen_since.pop(waited, None)

        still_there = {pid for pid, _pgid in zombies}

        for pid in list(_seen_since):
            if pid not in still_there:
                _seen_since.pop(pid, None)

    if reaped:
        logger.info("Waited for %d orphaned process(es) nobody else would: %s", len(reaped), reaped)
    return reaped


def _sweep_forever(interval_seconds: float, grace_seconds: float) -> None:
    while not _stop.wait(interval_seconds):
        try:
            sweep_orphans(grace_seconds=grace_seconds)
        except Exception as error:  # noqa: BLE001 - the net must never take the service down
            logger.debug("The orphan sweep did not finish: %s", error)


def should_install() -> bool:
    """Only process 1 inherits other people's orphans, and only Linux shows them."""
    return os.getpid() == 1 and PROC.is_dir()


def install_orphan_reaper(
    *,
    force: bool = False,
    interval_seconds: float = ORPHAN_SWEEP_SECONDS,
    grace_seconds: float = ORPHAN_GRACE_SECONDS,
) -> bool:
    """Start the sweeper if this process is the one that inherits orphans."""
    global _thread

    if not (force or should_install()):
        return False

    with _state_lock:
        if _thread is not None and _thread.is_alive():
            return True

        _stop.clear()
        _thread = threading.Thread(
            target=_sweep_forever,
            args=(interval_seconds, grace_seconds),
            name="orphan-sweeper",
            daemon=True,
        )
        _thread.start()

    logger.info("Waiting for orphaned processes every %.1f seconds.", interval_seconds)
    return True


def stop_orphan_reaper(*, timeout_seconds: float = 2.0) -> None:
    """Stop the sweeper. Only the tests need this; the service stops with the process."""
    global _thread
    _stop.set()

    with _state_lock:
        thread = _thread
        _thread = None

    if thread is not None:
        thread.join(timeout_seconds)
