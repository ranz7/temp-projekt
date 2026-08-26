"""
The sandboxed judge.

It judges Python and C++ submissions on this machine, in a bubblewrap sandbox with
cgroup limits, reading each problem's tests from this machine's own disk. Ordinary
problems are compared token by token or scored by the problem's checker script; an
interactive problem is built together with its grader, and that grader gives the
verdict.

    from bwrap import JudgeRequest, run_judge

    result = run_judge(JudgeRequest(...), packages_path=..., scratch_path=...)
    payload = result.to_payload()

Importing this package also starts waiting for orphaned processes, but only where that
is this process's job: in a container the checker service is process 1, and process 1
inherits every orphan on the machine whether it started it or not. See `orphans.py`.
"""

from .judge import problem_packages_path, run_judge, scratch_root
from .orphans import install_orphan_reaper, stop_orphan_reaper, sweep_orphans
from .package import PackageError
from .report import JudgeCancelled, JudgeRequest, JudgeResult, TestResult

__all__ = [
    "JudgeCancelled",
    "JudgeRequest",
    "JudgeResult",
    "PackageError",
    "TestResult",
    "install_orphan_reaper",
    "problem_packages_path",
    "run_judge",
    "scratch_root",
    "stop_orphan_reaper",
    "sweep_orphans",
]

# Does nothing unless this process is the one orphans are handed to.
install_orphan_reaper()
