"""
The seam between the HTTP service and whatever actually runs a submission.

The service knows one function:

    run_judge(request, *, packages_path=<packages>, scratch_path=<empty directory>)

`request` names the submission - its id, its problem, the package directory, the
language and the source text. Everything else - tests, limits, the problem's own
checker or grader - the judge reads from `packages_path/<package_directory>/`.
`scratch_path` is a directory made for this job alone and deleted when it ends, so
the judge may write anything it likes inside it.
The answer is a report: an object carrying `status`, `score`, `max_score`,
`compile_message`, `max_cpu_ms`, `max_memory_kb` and `tests`, each test row carrying
`ordinal`, `visibility`, `verdict`, `passed`, `points_awarded`, `message`,
`actual_output`, `time_ms`, `memory_kb` and, where the judge has them, `name` and
`presses`. `common.contract.FinalReport` is that shape; a judge may answer with its
own equivalent object and this module reads it by attribute.

The judge is resolved lazily, so the service starts, answers `/health` and reports a
readable internal error even on a machine where the sandbox is missing or broken.
`CHECKER_JUDGE` points the seam somewhere else, which is how the tests run without a
compiler or a sandbox.
"""

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any, Protocol

from .contract import ContractError, FinalReport, JudgeRequest, TestReport

logger = logging.getLogger(__name__)

DEFAULT_JUDGE_ENTRY_POINT = "bwrap:run_judge"


class JudgeUnavailableError(RuntimeError):
    """The judge behind the seam cannot be loaded on this machine."""


class Judge(Protocol):
    """What the service calls to judge one submission."""

    def __call__(
        self, request: JudgeRequest, *, packages_path: Path, scratch_path: Path
    ) -> FinalReport: ...


def load_judge(entry_point: str) -> Any:
    """Resolve `module:function`, raising a readable error when it is not there."""
    module_name, separator, attribute = entry_point.partition(":")

    if not separator or not module_name or not attribute:
        raise JudgeUnavailableError(
            f"a judge entry point must read module:function, got {entry_point!r}"
        )

    try:
        module = importlib.import_module(module_name)
    except Exception as error:
        raise JudgeUnavailableError(
            f"the judge {entry_point} cannot be imported: {error}"
        ) from error

    judge = getattr(module, attribute, None)

    if judge is None or not callable(judge):
        raise JudgeUnavailableError(f"{entry_point} is not a function")

    return judge


def _test_report(row: Any) -> TestReport:
    try:
        return TestReport(
            ordinal=int(row.ordinal),
            visibility=str(row.visibility),
            verdict=str(row.verdict),
            passed=bool(row.passed),
            points_awarded=float(getattr(row, "points_awarded", 0.0) or 0.0),
            message=getattr(row, "message", None),
            actual_output=getattr(row, "actual_output", None),
            time_ms=int(getattr(row, "time_ms", 0) or 0),
            memory_kb=int(getattr(row, "memory_kb", 0) or 0),
            name=getattr(row, "name", None),
            presses=getattr(row, "presses", None),
        )
    except AttributeError as error:
        raise ContractError(f"a test row from the judge is missing {error}") from error


def coerce_report(answer: Any) -> FinalReport:
    """Read whatever the judge answered as one contract report."""
    if isinstance(answer, FinalReport):
        return answer

    try:
        return FinalReport(
            status=str(answer.status),
            score=float(getattr(answer, "score", 0.0) or 0.0),
            max_score=float(getattr(answer, "max_score", 0.0) or 0.0),
            compile_message=getattr(answer, "compile_message", None),
            max_cpu_ms=int(getattr(answer, "max_cpu_ms", 0) or 0),
            max_memory_kb=int(getattr(answer, "max_memory_kb", 0) or 0),
            tests=[_test_report(row) for row in getattr(answer, "tests", []) or []],
        )
    except AttributeError as error:
        raise ContractError(f"the judge answered something unreadable: {error}") from error


def judge_submission(
    request: JudgeRequest,
    *,
    packages_path: Path,
    scratch_path: Path,
    entry_point: str = DEFAULT_JUDGE_ENTRY_POINT,
) -> FinalReport:
    """The one call the service makes to judge a submission."""
    judge = load_judge(entry_point)
    return coerce_report(
        judge(request, packages_path=packages_path, scratch_path=scratch_path)
    )
