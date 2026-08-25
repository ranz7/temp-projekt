"""
Shared test helpers.

The process-based tests follow the reference judge's rule: assert qualitative bounds,
never an exact millisecond, and skip cleanly when the machine cannot run them.
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid
from pathlib import Path

CHECKERS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CHECKERS_ROOT.parent
PROBLEMS_PATH = REPO_ROOT / "problems"
SHIPPED_PACKAGE = "cf-4-A"

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))

from common.contract import Job, JobTest  # noqa: E402


def require_wait4() -> None:
    """Process measurement needs a Unix python."""
    if not hasattr(os, "wait4"):
        raise unittest.SkipTest("os.wait4 is missing, so runs cannot be measured here")


def new_uuid() -> str:
    return str(uuid.uuid4())


def public_test(ordinal: int, given: str, expected: str, points: float = 0.0) -> JobTest:
    return JobTest(
        problem_test_id=new_uuid(),
        ordinal=ordinal,
        visibility="public",
        points=points,
        input_text=given,
        expected_output=expected,
    )


def hidden_test(ordinal: int, input_file: str, output_file: str, points: float = 1.0) -> JobTest:
    return JobTest(
        problem_test_id=new_uuid(),
        ordinal=ordinal,
        visibility="hidden",
        points=points,
        input_file=input_file,
        output_file=output_file,
    )


def make_job(
    *,
    language: str = "python",
    source_code: str = "print(input())\n",
    tests: list[JobTest] | None = None,
    time_limit_ms: int = 2000,
    memory_limit_mb: int = 256,
    checker_type: str = "token",
    checker_path: str | None = None,
    package_directory: str = SHIPPED_PACKAGE,
    problem_slug: str = SHIPPED_PACKAGE,
) -> Job:
    return Job(
        submission_id=new_uuid(),
        claim_id=new_uuid(),
        problem_slug=problem_slug,
        package_directory=package_directory,
        language=language,
        source_code=source_code,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=memory_limit_mb,
        checker_type=checker_type,
        checker_path=checker_path,
        tests=list(tests or []),
    )
