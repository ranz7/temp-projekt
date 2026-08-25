"""
The C++ worker as a whole, with OIOIOI stubbed in process.

The rule this file exists for: an OIOIOI that cannot be reached gives the submission
back to the queue. It never becomes an internal error and it never uses an attempt.
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from common.config import WorkerConfig
from common.contract import FinalReport, Release
from cpp.judge import OioioiCppJudge, build_outcome
from cpp.oioioi_client import OioioiUnavailable
from cpp.oioioi_job import OioioiOutcome, remembered_submission_id

from .helpers import hidden_test, make_job
from .test_oioioi_job import FakeOioioi
from .test_worker_loop import FakeClient, FakeListener

from common.worker import Worker


# The C++ worker reads these from the environment; the tests keep the waiting short.
OIOIOI_ENVIRONMENT = {
    "OIOIOI_URL": "http://oioioi.test",
    "OIOIOI_TOKEN": "token",
    "OIOIOI_CONTEST_ID": "contest",
    "OIOIOI_POLL_SECONDS": "0.001",
    "OIOIOI_POLL_TIMEOUT_SECONDS": "0.05",
}


def cpp_job(points: float = 3.0):
    return make_job(
        language="cpp",
        source_code="int main(){}",
        tests=[hidden_test(1, "01.in", "01.out", points=points)],
    )


class BuildOutcomeTests(unittest.TestCase):
    def test_an_accepted_solution_earns_every_hidden_point(self) -> None:
        report = build_outcome(
            cpp_job(3),
            OioioiOutcome(ok=True, oioioi_id=7, status="OK", time_ms=15, memory_kb=4200),
        )

        self.assertIsInstance(report, FinalReport)
        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.score, 3)
        self.assertEqual(report.max_score, 3)
        self.assertEqual(report.max_cpu_ms, 15)
        self.assertEqual(report.max_memory_kb, 4200)
        # OIOIOI reports one verdict for the whole submission, so there are no rows.
        self.assertEqual(report.tests, [])

    def test_a_wrong_answer_earns_nothing(self) -> None:
        report = build_outcome(cpp_job(3), OioioiOutcome(ok=True, oioioi_id=7, status="WA"))

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual(report.score, 0)
        self.assertEqual(report.max_score, 3)

    def test_a_compile_error(self) -> None:
        report = build_outcome(cpp_job(), OioioiOutcome(ok=True, oioioi_id=7, status="CE"))

        self.assertEqual(report.status, "compilation_error")
        self.assertEqual(report.tests, [])

    def test_a_status_nobody_knows_is_an_internal_error(self) -> None:
        report = build_outcome(cpp_job(), OioioiOutcome(ok=True, oioioi_id=7, status="SE"))

        self.assertEqual(report.status, "internal_error")
        self.assertIn("SE", report.compile_message)

    def test_an_unreachable_oioioi_gives_the_job_back(self) -> None:
        outcome = build_outcome(
            cpp_job(),
            OioioiOutcome(ok=False, unavailable=True, message="connection refused"),
        )

        self.assertIsInstance(outcome, Release)
        self.assertIn("temporarily unavailable", outcome.reason)
        self.assertIn("connection refused", outcome.reason)

    def test_a_release_after_a_submit_keeps_what_it_knows(self) -> None:
        outcome = build_outcome(
            cpp_job(),
            OioioiOutcome(ok=False, oioioi_id=7, unavailable=True, message="OIOIOI went away"),
        )

        self.assertTrue(outcome.keep_scratch)

    def test_a_submission_oioioi_refused_is_an_internal_error(self) -> None:
        report = build_outcome(
            cpp_job(), OioioiOutcome(ok=False, message="HTTP 400: unknown problem")
        )

        self.assertIsInstance(report, FinalReport)
        self.assertEqual(report.status, "internal_error")
        self.assertIn("400", report.compile_message)


class CppWorkerTests(unittest.TestCase):
    """The judge inside the real worker loop, with a fake app and a fake OIOIOI."""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.config = WorkerConfig(
            app_url="http://app:3000",
            service_key="secret",
            worker_id="cpp-1",
            problem_packages_path=Path("/problems"),
            poll_seconds=0.01,
            heartbeat_seconds=0.01,
            scratch_path=Path(self.temporary.name),
            health_port=0,
            redis_url="redis://127.0.0.1:6379",
            redis_stream="oj.submissions",
            request_timeout_seconds=1.0,
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _run(self, job, oioioi: FakeOioioi) -> FakeClient:
        judge = OioioiCppJudge(self.config, client_factory=lambda: oioioi)
        client = FakeClient([job])

        with mock.patch.dict(os.environ, OIOIOI_ENVIRONMENT):
            Worker(self.config, judge, client=client, listener=FakeListener()).run_once()
        return client

    def test_an_outage_produces_a_release_and_no_result(self) -> None:
        job = cpp_job()
        oioioi = FakeOioioi(submit_error=OioioiUnavailable("connection refused"))
        client = self._run(job, oioioi)

        self.assertEqual(client.results, [])
        self.assertEqual(len(client.releases), 1)
        self.assertIn("C++ checking is temporarily unavailable", client.releases[0][1])

    def test_a_judged_submission_is_reported_once(self) -> None:
        job = cpp_job(2)
        oioioi = FakeOioioi([{"complete": True, "verdict": "OK", "time_ms": 3, "memory_kb": 900}])
        client = self._run(job, oioioi)

        self.assertEqual(client.releases, [])
        self.assertEqual(client.results[0][1].status, "accepted")
        self.assertEqual(client.results[0][1].score, 2)
        self.assertEqual(oioioi.submits, 1)

    def test_a_restart_resumes_polling_instead_of_submitting_again(self) -> None:
        job = cpp_job()
        # First attempt: submitted, then OIOIOI disappears while the report is polled.
        first = FakeOioioi([OioioiUnavailable("gateway down")] * 20)
        worker_client = self._run(job, first)

        self.assertEqual(len(worker_client.releases), 1)
        self.assertEqual(first.submits, 1)

        scratch = Path(self.temporary.name) / "cpp" / job.submission_id
        self.assertEqual(remembered_submission_id(scratch), 7)

        # The same submission comes back with a new claim; nothing is submitted twice.
        second = FakeOioioi([{"complete": True, "verdict": "OK"}])
        client = self._run(job, second)

        self.assertEqual(second.submits, 0)
        self.assertEqual(client.results[0][1].status, "accepted")


if __name__ == "__main__":
    unittest.main()
