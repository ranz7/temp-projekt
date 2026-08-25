"""
What the service keeps: the jobs it is running, the results it still holds, and the
seam it calls to judge.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import threading
import unittest
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CHECKERS_ROOT = Path(__file__).resolve().parents[1]

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))

from common.contract import (  # noqa: E402
    ACCEPTED,
    INTERNAL_ERROR,
    PASSED,
    ContractError,
    FinalReport,
    JudgeRequest,
    TestReport,
)
from common.jobs import AtCapacityError, JobRegistry, ShuttingDownError  # noqa: E402
from common.judging import (  # noqa: E402
    JudgeUnavailableError,
    coerce_report,
    judge_submission,
    load_judge,
)


def new_uuid() -> str:
    return str(uuid.uuid4())


def a_request(submission_id: str | None = None) -> JudgeRequest:
    return JudgeRequest(
        submission_id=submission_id or new_uuid(),
        problem_slug="minimizing-coins",
        package_directory="minimizing-coins",
        language="python",
        source_code="print(1)\n",
    )


def a_report() -> FinalReport:
    return FinalReport(
        status=ACCEPTED,
        score=18,
        max_score=18,
        tests=[TestReport(ordinal=1, visibility="hidden", verdict=PASSED, passed=True)],
    )


class Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class RegistryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="checker-jobs-"))
        self.addCleanup(shutil.rmtree, root, True)
        self.packages_path = root / "problems"
        self.scratch_root = root / "scratch"

    def registry(self, judge: Any, **overrides: Any) -> JobRegistry:
        settings: dict[str, Any] = {
            "packages_path": self.packages_path,
            "scratch_root": self.scratch_root,
            "capacity": 2,
        }
        settings.update(overrides)
        made = JobRegistry(judge, **settings)
        self.addCleanup(made.shutdown, 5)
        return made


class ResultLifetimeTests(RegistryTestCase):
    def test_a_result_is_kept_for_the_configured_time_and_then_dropped(self) -> None:
        clock = Clock()
        registry = self.registry(
            lambda *_a, **_k: a_report(), result_ttl_seconds=900.0, clock=clock
        )

        record, started = registry.submit(a_request())

        self.assertTrue(started)
        self.assertIsNotNone(record.thread)
        record.thread.join(5)

        clock.now = 899.0
        self.assertIsNotNone(registry.get(record.job_id))

        clock.now = 901.0
        self.assertIsNone(registry.get(record.job_id))


class CapacityTests(RegistryTestCase):
    def test_a_full_registry_refuses_and_never_queues(self) -> None:
        release = threading.Event()
        self.addCleanup(release.set)

        def judge(*_args: Any, **_kwargs: Any) -> FinalReport:
            release.wait(5)
            return a_report()

        registry = self.registry(judge, capacity=1)
        registry.submit(a_request())

        with self.assertRaises(AtCapacityError):
            registry.submit(a_request())

        self.assertEqual(registry.busy, 1)


class ShutdownTests(RegistryTestCase):
    def test_shutdown_fails_what_is_still_running_and_clears_the_scratch(self) -> None:
        release = threading.Event()
        self.addCleanup(release.set)

        def judge(*_args: Any, **_kwargs: Any) -> FinalReport:
            release.wait(10)
            return a_report()

        registry = self.registry(judge)
        record, _ = registry.submit(a_request())
        registry.shutdown(0.1)

        self.assertEqual(record.status, "done")
        self.assertIsNotNone(record.result)
        self.assertEqual(record.result.status, INTERNAL_ERROR)
        self.assertFalse(self.scratch_root.exists())

        with self.assertRaises(ShuttingDownError):
            registry.submit(a_request())


class SeamTests(unittest.TestCase):
    def test_a_missing_judge_is_a_readable_error(self) -> None:
        with self.assertRaises(JudgeUnavailableError):
            load_judge("no.such.module:judge_on_disk")

        with self.assertRaises(JudgeUnavailableError):
            load_judge("common.judging:not_a_function")

        with self.assertRaises(JudgeUnavailableError):
            load_judge("common.judging")

    def test_the_seam_calls_the_entry_point_it_was_given(self) -> None:
        report = judge_submission(
            a_request(),
            packages_path=Path("/problems"),
            scratch_path=Path("/tmp/scratch"),
            entry_point=f"{__name__}:stub_judge",
        )

        self.assertEqual(report.status, ACCEPTED)
        self.assertEqual(report.tests[0].ordinal, 1)

    def test_a_judge_may_answer_with_its_own_report_object(self) -> None:
        report = coerce_report(
            OtherReport(
                status=ACCEPTED,
                score=3.0,
                max_score=3.0,
                tests=[
                    OtherTest(
                        ordinal=2,
                        name="002",
                        visibility="hidden",
                        verdict=PASSED,
                        passed=True,
                        points_awarded=1.0,
                        presses=7,
                    )
                ],
            )
        )
        payload = report.to_payload()

        self.assertEqual(payload["tests"][0]["name"], "002")
        self.assertEqual(payload["tests"][0]["presses"], 7)
        self.assertNotIn("problemTestId", payload["tests"][0])

    def test_an_unreadable_answer_is_refused(self) -> None:
        with self.assertRaises(ContractError):
            coerce_report(object())


@dataclass(frozen=True)
class OtherTest:
    """A test row shaped the way a judge of its own might build one."""

    ordinal: int
    name: str
    visibility: str
    verdict: str
    passed: bool
    points_awarded: float
    presses: int | None = None


@dataclass(frozen=True)
class OtherReport:
    """A report shaped the way a judge of its own might build one."""

    status: str
    score: float
    max_score: float
    tests: list[OtherTest]


def stub_judge(
    _request: JudgeRequest, *, packages_path: Path, scratch_path: Path
) -> FinalReport:
    """The judge the seam test resolves by name."""
    assert packages_path and scratch_path
    return a_report()


if __name__ == "__main__":
    unittest.main()
