"""
Starting the contestant program inside bubblewrap.

Ported from the reference judge (`outer/spawn_sandboxed.py`). The sandbox unshares
the network and the process table, mounts the system directories read only, gives the
job's own scratch directory as the single writable place, and clears the environment.

`JUDGE_SANDBOX=none` runs the program with no sandbox at all. That exists for
developing on a machine without bubblewrap and is unsafe for anything but code you
wrote yourself; the default is the sandbox.

A run joins its cgroup itself, in the moment between being started and becoming the
program: a one-line shell writes its own process id into the leaf and then becomes the
command. Moving the process from outside afterwards is too late, because bubblewrap
has already started the program by then and only processes started after the move
inherit the leaf. That is what makes the measurement and the limits cover the program
rather than the sandbox around it.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

BOX = "/box"

DEFAULT_BWRAP_PATH = "/usr/bin/bwrap"

SHELL = "/bin/sh"

# Write our own id into the leaf, then become the command, keeping the same id.
JOIN_CGROUP_SCRIPT = 'printf %s "$$" > "$1" 2>/dev/null; shift; exec "$@"'
JOIN_CGROUP_NAME = "oj-join-cgroup"

# System trees the interpreter and the dynamic linker need, mounted read only.
SYSTEM_READ_ONLY = ("/usr", "/lib", "/lib64", "/lib32", "/bin", "/sbin", "/etc/alternatives")


@dataclass
class SpawnSpec:
    """Everything needed to start one test run."""

    work_dir: Path
    run_argv: Sequence[str]
    stdin_path: Path | None = None
    stdout_path: Path | None = None
    stderr_path: Path | None = None
    extra_read_only: Sequence[Path] = field(default_factory=tuple)
    sandbox: str | None = None
    # `<leaf>/cgroup.procs`: the run puts itself in that leaf before it starts.
    cgroup_procs_path: Path | None = None


def resolve_sandbox_mode(override: str | None = None) -> str:
    """`bwrap` or `none`. Sandboxing is on unless the environment turns it off."""
    raw = (override or os.environ.get("JUDGE_SANDBOX") or "bwrap").strip().lower()

    if raw in ("none", "off", "0", "false"):
        return "none"
    if raw in ("bwrap", "bubblewrap", "jail", "on", "1", "true"):
        return "bwrap"
    raise ValueError(f"JUDGE_SANDBOX must be bwrap or none, got {raw!r}")


def bwrap_path() -> str | None:
    """The bubblewrap binary, or None when this machine has none."""
    configured = os.environ.get("BWRAP_PATH")

    if configured:
        return configured if Path(configured).exists() else None

    if Path(DEFAULT_BWRAP_PATH).exists():
        return DEFAULT_BWRAP_PATH
    return shutil.which("bwrap")


def rewrite_argv_for_box(run_argv: Sequence[str], work_dir: Path) -> list[str]:
    """Paths inside the scratch directory are named `/box/...` inside the sandbox."""
    work = Path(work_dir).resolve()
    rewritten: list[str] = []

    for argument in run_argv:
        try:
            candidate = Path(argument)

            if candidate.is_absolute():
                resolved = candidate.resolve()
                try:
                    relative = resolved.relative_to(work)
                    rewritten.append(f"{BOX}/{relative.as_posix()}")
                    continue
                except ValueError:
                    pass
        except (OSError, RuntimeError):
            pass
        rewritten.append(argument)

    return rewritten


def build_bwrap_argv(spec: SpawnSpec, *, executable: str | None = None) -> list[str]:
    """The bubblewrap command line for one run."""
    binary = executable or bwrap_path()

    if binary is None:
        raise RuntimeError(
            "bubblewrap is not installed. Install it, or set JUDGE_SANDBOX=none, "
            "which runs submissions unsandboxed and is unsafe."
        )

    work = Path(spec.work_dir).resolve()
    work.mkdir(parents=True, exist_ok=True)

    argv: list[str] = [
        binary,
        "--unshare-net",
        "--unshare-pid",
        "--unshare-ipc",
        "--unshare-uts",
        "--die-with-parent",
        "--new-session",
        "--tmpfs",
        "/tmp",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
    ]

    for host_path in SYSTEM_READ_ONLY:
        if Path(host_path).exists():
            argv.extend(["--ro-bind", host_path, host_path])

    if not Path("/bin").exists() and Path("/usr/bin").exists():
        argv.extend(["--symlink", "usr/bin", "/bin"])

    # The job's own directory is the only writable place in the sandbox.
    argv.extend(["--bind", str(work), BOX, "--chdir", BOX])

    for mount in spec.extra_read_only:
        resolved = Path(mount).resolve()

        if resolved.exists():
            argv.extend(["--ro-bind", str(resolved), str(resolved)])

    argv.extend(
        [
            "--clearenv",
            "--setenv",
            "PATH",
            "/usr/bin:/bin",
            "--setenv",
            "HOME",
            BOX,
            "--setenv",
            "LANG",
            "C.UTF-8",
            "--setenv",
            "PYTHONHASHSEED",
            "0",
            "--setenv",
            "PYTHONDONTWRITEBYTECODE",
            "1",
        ]
    )

    argv.append("--")
    argv.extend(rewrite_argv_for_box(list(spec.run_argv), work))
    return argv


def join_cgroup_argv(command: Sequence[str], cgroup_procs_path: Path) -> list[str]:
    """Wrap a command so it joins the leaf before it becomes the program."""
    return [
        SHELL,
        "-c",
        JOIN_CGROUP_SCRIPT,
        JOIN_CGROUP_NAME,
        str(cgroup_procs_path),
        *command,
    ]


def _open_stdio(spec: SpawnSpec):
    stdin = subprocess.DEVNULL
    stdout = subprocess.DEVNULL
    stderr = subprocess.DEVNULL
    opened: list = []

    if spec.stdin_path is not None:
        handle = open(spec.stdin_path, "rb")
        opened.append(handle)
        stdin = handle
    if spec.stdout_path is not None:
        Path(spec.stdout_path).parent.mkdir(parents=True, exist_ok=True)
        handle = open(spec.stdout_path, "wb")
        opened.append(handle)
        stdout = handle
    if spec.stderr_path is not None:
        Path(spec.stderr_path).parent.mkdir(parents=True, exist_ok=True)
        handle = open(spec.stderr_path, "wb")
        opened.append(handle)
        stderr = handle

    return stdin, stdout, stderr, opened


def spawn_sandboxed(spec: SpawnSpec) -> subprocess.Popen:
    """Start one test run in its own session, so the whole tree can be killed."""
    mode = resolve_sandbox_mode(spec.sandbox)

    if not spec.run_argv:
        raise ValueError("there is nothing to run")

    if mode == "bwrap":
        command = build_bwrap_argv(spec)
        cwd = None
    else:
        command = list(spec.run_argv)
        cwd = str(Path(spec.work_dir).resolve())

    if spec.cgroup_procs_path is not None and Path(SHELL).exists():
        command = join_cgroup_argv(command, spec.cgroup_procs_path)

    stdin, stdout, stderr, opened = _open_stdio(spec)

    try:
        return subprocess.Popen(
            command,
            stdin=stdin,
            stdout=stdout,
            stderr=stderr,
            cwd=cwd,
            start_new_session=True,
            close_fds=True,
        )
    finally:
        for handle in opened:
            try:
                handle.close()
            except OSError:
                pass
