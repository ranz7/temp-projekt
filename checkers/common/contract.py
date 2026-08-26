"""
Contract version 2 between the Next.js app and one checker machine.

`checkers/CONTRACT.md` is the agreement; this module is its Python side. Payloads
are plain dictionaries at the edge and dataclasses everywhere inside, so a field
name is spelled once.

Direction matters: in version 2 the application calls the checker. A checker never
calls the application, and it reads every problem's data from its own disk.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

CONTRACT_VERSION = 2

SERVICE_KEY_HEADER = "X-Service-Key"

HEALTH_PATH = "/health"
JUDGE_PATH = "/judge"

# Final submission statuses the app accepts.
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

# Per-test verdicts the app accepts. There is no per-test internal error: a job the
# checker cannot run at all becomes an internal error for the whole submission.
PASSED = "passed"
TEST_VERDICTS = frozenset({PASSED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR})

VISIBILITIES = frozenset({"public", "hidden"})

# Job lifecycle, as the app polls it.
RUNNING = "running"
DONE = "done"


class ContractError(RuntimeError):
    """A request this checker refuses to interpret."""


class ContractVersionError(ContractError):
    """The caller speaks a different contract version, so nothing is guessed at."""


def require_contract_version(payload: Any) -> dict[str, Any]:
    """Every request must name contract version 2; anything else is an error."""
    if not isinstance(payload, dict):
        raise ContractError("the request body is not a JSON object")

    version = payload.get("contractVersion")

    if version != CONTRACT_VERSION:
        raise ContractVersionError(
            f"this checker speaks contract version {CONTRACT_VERSION}, "
            f"the request says {version!r}"
        )
    return payload


def envelope(**fields: Any) -> dict[str, Any]:
    """Every answer this checker sends names its contract version first."""
    return {"contractVersion": CONTRACT_VERSION, **fields}


@dataclass(frozen=True)
class JudgeRequest:
    """One submission the application asked this machine to judge.

    Everything else - the tests, the limits, the problem's own checker or grader -
    is read from `PROBLEM_PACKAGES_PATH/<package_directory>/` on this machine.
    """

    submission_id: str
    problem_slug: str
    package_directory: str
    language: str
    source_code: str


def _required_text(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)

    if not isinstance(value, str) or value.strip() == "":
        raise ContractError(f"{key} is required and must be a non-empty string")
    return value.strip()


def parse_judge_request(payload: Any) -> JudgeRequest:
    """Read a `POST /judge` body, refusing anything that is not the contract."""
    body = require_contract_version(payload)
    package_directory = _required_text(body, "packageDirectory")

    if package_directory != Path(package_directory).name or package_directory in (".", ".."):
        raise ContractError("packageDirectory must be a single directory name")

    source_code = body.get("sourceCode")

    if not isinstance(source_code, str) or source_code == "":
        raise ContractError("sourceCode is required and must be a non-empty string")

    return JudgeRequest(
        submission_id=_required_text(body, "submissionId"),
        problem_slug=_required_text(body, "problemSlug"),
        package_directory=package_directory,
        language=_required_text(body, "language").lower(),
        source_code=source_code,
    )


@dataclass(frozen=True)
class TestReport:
    """One row of the per-test list the person sees.

    The row carries no database id: the application matches rows to its own tests by
    `ordinal`, so a checker never has to be told what the database calls a test.

    `name` is the test file's stem, when the judge knows it, and `presses` is the
    number of button presses an interactive problem's grader counted. Both are null
    for a judge or a problem that has nothing to say there.
    """

    ordinal: int
    visibility: str
    verdict: str
    passed: bool
    points_awarded: float = 0.0
    message: str | None = None
    actual_output: str | None = None
    time_ms: int = 0
    memory_kb: int = 0
    name: str | None = None
    presses: int | None = None

    def to_payload(self) -> dict[str, Any]:
        if self.verdict not in TEST_VERDICTS:
            raise ContractError(f"unknown test verdict {self.verdict!r}")

        if self.visibility not in VISIBILITIES:
            raise ContractError(f"unknown test visibility {self.visibility!r}")

        return {
            "ordinal": int(self.ordinal),
            "visibility": self.visibility,
            "verdict": self.verdict,
            "passed": bool(self.passed),
            "pointsAwarded": max(0.0, float(self.points_awarded)),
            "message": self.message,
            "actualOutput": self.actual_output,
            "timeMs": max(0, int(self.time_ms)),
            "memoryKb": max(0, int(self.memory_kb)),
            "name": self.name,
            "presses": None if self.presses is None else int(self.presses),
        }


@dataclass(frozen=True)
class FinalReport:
    """The verdict of one submission."""

    status: str
    score: float = 0.0
    max_score: float = 0.0
    compile_message: str | None = None
    max_cpu_ms: int = 0
    max_memory_kb: int = 0
    tests: list[TestReport] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        if self.status not in FINAL_STATUSES:
            raise ContractError(f"unknown submission status {self.status!r}")

        return {
            "status": self.status,
            "score": max(0.0, float(self.score)),
            "maxScore": max(0.0, float(self.max_score)),
            "compileMessage": self.compile_message,
            "maxCpuMs": max(0, int(self.max_cpu_ms)),
            "maxMemoryKb": max(0, int(self.max_memory_kb)),
            "tests": [test.to_payload() for test in self.tests],
        }


def internal_error(message: str, *, max_score: float = 0.0) -> FinalReport:
    """The readable version of "this checker broke while judging your solution"."""
    return FinalReport(
        status=INTERNAL_ERROR,
        score=0.0,
        max_score=max_score,
        compile_message=message,
        tests=[],
    )
