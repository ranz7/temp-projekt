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
"""

from .judge import problem_packages_path, run_judge, scratch_root
from .package import PackageError
from .report import JudgeCancelled, JudgeRequest, JudgeResult, TestResult

__all__ = [
    "JudgeCancelled",
    "JudgeRequest",
    "JudgeResult",
    "PackageError",
    "TestResult",
    "problem_packages_path",
    "run_judge",
    "scratch_root",
]
