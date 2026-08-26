"""
What the judge is asked and what it answers.

The judge no longer receives test data over the network. A request names one
submission - its id, its problem, the package directory that problem's files live in,
the language and the source text - and everything else is read from that directory on
this machine's own disk.

Statuses and per-test verdicts are the words the app stores, spelled once here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Final statuses of one submission.
ACCEPTED = "accepted"
WRONG_ANSWER = "wrong_answer"
TIME_LIMIT = "time_limit"
MEMORY_LIMIT = "memory_limit"
RUNTIME_ERROR = "runtime_error"
COMPILATION_ERROR = "compilation_error"
INTERNAL_ERROR = "internal_error"

FINAL_STATUSES = frozenset(
    {
        ACCEPTED,
        WRONG_ANSWER,
        TIME_LIMIT,
        MEMORY_LIMIT,
        RUNTIME_ERROR,
        COMPILATION_ERROR,
        INTERNAL_ERROR,
    }
)

# Per-test verdicts. There is no per-test internal error: a test the judge cannot make
# sense of stops the whole submission with an internal error and no rows.
PASSED = "passed"
TEST_VERDICTS = frozenset({PASSED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR})

PUBLIC = "public"
HIDDEN = "hidden"


class JudgeCancelled(RuntimeError):
    """Judging was stopped part way, so the submission is still waiting."""


class ReportError(RuntimeError):
    """A report was built with a word the app does not accept."""


@dataclass(frozen=True)
class JudgeRequest:
    """One submission to judge, as the caller hands it over."""

    submission_id: str
    problem_slug: str
    package_directory: str
    language: str
    source_code: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> JudgeRequest:
        try:
            return cls(
                submission_id=str(payload["submissionId"]),
                problem_slug=str(payload["problemSlug"]),
                package_directory=str(payload["packageDirectory"]),
                language=str(payload["language"]),
                source_code=str(payload.get("sourceCode") or ""),
            )
        except (KeyError, TypeError) as error:
            raise ReportError(f"the judge request is incomplete: {error}") from error

    def to_payload(self) -> dict[str, Any]:
        return {
            "submissionId": self.submission_id,
            "problemSlug": self.problem_slug,
            "packageDirectory": self.package_directory,
            "language": self.language,
            "sourceCode": self.source_code,
        }


@dataclass(frozen=True)
class TestResult:
    """One row of the per-test list the person sees.

    `name` is the test file's stem, so the caller can line a row up with the test it
    stored. `presses` is only ever filled in for an interactive problem: it is the
    number of button presses the grader counted.
    """

    ordinal: int
    name: str
    visibility: str
    verdict: str
    passed: bool
    points_awarded: float
    message: str | None = None
    actual_output: str | None = None
    time_ms: int = 0
    memory_kb: int = 0
    presses: int | None = None

    @property
    def is_hidden(self) -> bool:
        return self.visibility == HIDDEN

    def to_payload(self) -> dict[str, Any]:
        if self.verdict not in TEST_VERDICTS:
            raise ReportError(f"unknown test verdict {self.verdict!r}")

        return {
            "ordinal": self.ordinal,
            "name": self.name,
            "visibility": self.visibility,
            "verdict": self.verdict,
            "passed": self.passed,
            "pointsAwarded": max(0.0, float(self.points_awarded)),
            "message": self.message,
            "actualOutput": self.actual_output,
            "timeMs": max(0, int(self.time_ms)),
            "memoryKb": max(0, int(self.memory_kb)),
            "presses": self.presses,
        }


@dataclass(frozen=True)
class JudgeResult:
    """The verdict of one submission."""

    status: str
    score: float = 0.0
    max_score: float = 0.0
    compile_message: str | None = None
    max_cpu_ms: int = 0
    max_memory_kb: int = 0
    tests: list[TestResult] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        if self.status not in FINAL_STATUSES:
            raise ReportError(f"unknown submission status {self.status!r}")

        return {
            "status": self.status,
            "score": max(0.0, float(self.score)),
            "maxScore": max(0.0, float(self.max_score)),
            "compileMessage": self.compile_message,
            "maxCpuMs": max(0, int(self.max_cpu_ms)),
            "maxMemoryKb": max(0, int(self.max_memory_kb)),
            "tests": [test.to_payload() for test in self.tests],
        }


def compilation_error(message: str, *, max_score: float = 0.0) -> JudgeResult:
    """A submission that will not build has no test rows at all."""
    return JudgeResult(
        status=COMPILATION_ERROR,
        score=0.0,
        max_score=max_score,
        compile_message=message,
        tests=[],
    )


def internal_error(message: str, *, max_score: float = 0.0) -> JudgeResult:
    """The readable version of "this checker could not judge your solution"."""
    return JudgeResult(
        status=INTERNAL_ERROR,
        score=0.0,
        max_score=max_score,
        compile_message=message,
        tests=[],
    )
