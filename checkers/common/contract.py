"""
Contract version 1 between the checker workers and the Next.js app.

`checkers/CONTRACT.md` is the agreement; this module is its Python side. Payloads
are plain dictionaries at the edge and dataclasses everywhere inside, so a field
name is spelled once.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

CONTRACT_VERSION = 1

SERVICE_KEY_HEADER = "X-Service-Key"

CLAIM_PATH = "/api/internal/checker/claim"
HEARTBEAT_PATH = "/api/internal/checker/heartbeat"
RESULT_PATH = "/api/internal/checker/result"
RELEASE_PATH = "/api/internal/checker/release"

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
# worker cannot run at all becomes an internal error for the whole submission.
PASSED = "passed"
TEST_VERDICTS = frozenset({PASSED, WRONG_ANSWER, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR})


class ContractError(RuntimeError):
    """The app answered something this worker refuses to interpret."""


class ContractVersionError(ContractError):
    """The app speaks a different contract version, so the worker stops guessing."""


def require_contract_version(payload: Any) -> dict[str, Any]:
    """Every answer must name contract version 1; anything else is an error."""
    if not isinstance(payload, dict):
        raise ContractError("the app answered something that is not a JSON object")

    version = payload.get("contractVersion")

    if version != CONTRACT_VERSION:
        raise ContractVersionError(
            f"this worker speaks contract version {CONTRACT_VERSION}, "
            f"the app answered {version!r}"
        )
    return payload


@dataclass(frozen=True)
class JobTest:
    """One test of a claimed job.

    A public test carries its input and expected output inline. A hidden test carries
    only file names; their content is read from the worker's own package directory and
    never travels over HTTP.
    """

    problem_test_id: str
    ordinal: int
    visibility: str
    points: float
    input_text: str | None = None
    expected_output: str | None = None
    input_file: str | None = None
    output_file: str | None = None

    @property
    def is_hidden(self) -> bool:
        return self.visibility == "hidden"


@dataclass(frozen=True)
class Job:
    """One leased submission to judge."""

    submission_id: str
    claim_id: str
    problem_slug: str
    package_directory: str
    language: str
    source_code: str
    time_limit_ms: int
    memory_limit_mb: int
    checker_type: str
    checker_path: str | None
    tests: list[JobTest] = field(default_factory=list)

    @property
    def hidden_points(self) -> float:
        """The maximum score: samples are worth nothing."""
        return sum(test.points for test in self.tests if test.is_hidden)


def parse_job_test(payload: dict[str, Any]) -> JobTest:
    visibility = payload.get("visibility")

    if visibility not in ("public", "hidden"):
        raise ContractError(f"unknown test visibility {visibility!r}")

    if visibility == "hidden":
        input_file = payload.get("inputFile")
        output_file = payload.get("outputFile")

        if not input_file or not output_file:
            raise ContractError("a hidden test must name an input and an output file")

        return JobTest(
            problem_test_id=str(payload["problemTestId"]),
            ordinal=int(payload["ordinal"]),
            visibility="hidden",
            points=float(payload.get("points") or 0),
            input_file=str(input_file),
            output_file=str(output_file),
        )

    return JobTest(
        problem_test_id=str(payload["problemTestId"]),
        ordinal=int(payload["ordinal"]),
        visibility="public",
        points=float(payload.get("points") or 0),
        input_text=str(payload.get("input") or ""),
        expected_output=str(payload.get("expectedOutput") or ""),
    )


def parse_job(payload: dict[str, Any]) -> Job:
    try:
        tests = [parse_job_test(test) for test in payload.get("tests") or []]

        return Job(
            submission_id=str(payload["submissionId"]),
            claim_id=str(payload["claimId"]),
            problem_slug=str(payload["problemSlug"]),
            package_directory=str(payload["packageDirectory"]),
            language=str(payload["language"]),
            source_code=str(payload.get("sourceCode") or ""),
            time_limit_ms=int(payload["timeLimitMs"]),
            memory_limit_mb=int(payload["memoryLimitMb"]),
            checker_type=str(payload.get("checkerType") or "token"),
            checker_path=payload.get("checkerPath") or None,
            tests=sorted(tests, key=lambda test: test.ordinal),
        )
    except ContractError:
        raise
    except (KeyError, TypeError, ValueError) as error:
        raise ContractError(f"the claimed job does not match the contract: {error}") from error


@dataclass(frozen=True)
class TestReport:
    """One row of the per-test list the person sees."""

    problem_test_id: str
    ordinal: int
    verdict: str
    passed: bool
    points_awarded: float
    message: str | None
    actual_output: str | None
    time_ms: int
    memory_kb: int

    def to_payload(self) -> dict[str, Any]:
        if self.verdict not in TEST_VERDICTS:
            raise ContractError(f"unknown test verdict {self.verdict!r}")

        return {
            "problemTestId": self.problem_test_id,
            "ordinal": self.ordinal,
            "verdict": self.verdict,
            "passed": self.passed,
            "pointsAwarded": max(0.0, float(self.points_awarded)),
            "message": self.message,
            "actualOutput": self.actual_output,
            "timeMs": max(0, int(self.time_ms)),
            "memoryKb": max(0, int(self.memory_kb)),
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


@dataclass(frozen=True)
class Release:
    """The worker cannot judge this job now, so the app queues it again.

    `keep_scratch` holds the job's scratch directory back from the usual cleanup, so
    the C++ worker does not submit the same source to OIOIOI twice after an outage.
    """

    reason: str
    keep_scratch: bool = False


JudgeOutcome = FinalReport | Release


def internal_error(message: str, *, max_score: float = 0.0) -> FinalReport:
    """The readable version of "this worker broke while judging your solution"."""
    return FinalReport(
        status=INTERNAL_ERROR,
        score=0.0,
        max_score=max_score,
        compile_message=message,
        tests=[],
    )
