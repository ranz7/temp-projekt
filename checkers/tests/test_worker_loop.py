"""The shared loop: report, judge, answer, clean up, and survive a broken judge."""

from __future__ import annotations

import tempfile
import threading
import unittest
from pathlib import Path

from common.app_client import AppUnreachableError
from common.config import WorkerConfig
from common.contract import FinalReport, Job, Release
from common.worker import Worker

from .helpers import make_job


class FakeClient:
    """Stands in for the app: remembers what the worker reported."""

    def __init__(self, jobs: list[Job] | None = None) -> None:
        self.jobs = list(jobs or [])
        self.claims = 0
        self.running: list[tuple[str, str]] = []
        self.heartbeats: list[tuple[str, str]] = []
        self.results: list[tuple[str, FinalReport]] = []
        self.releases: list[tuple[str, str]] = []
        self.claim_error: Exception | None = None

    def claim(self, worker_id: str, languages: list[str]) -> Job | None:
        self.claims += 1

        if self.claim_error is not None:
            raise self.claim_error
        return self.jobs.pop(0) if self.jobs else None

    def report_running(self, submission_id: str, claim_id: str) -> None:
        self.running.append((submission_id, claim_id))

    def heartbeat(self, submission_id: str, claim_id: str) -> None:
        self.heartbeats.append((submission_id, claim_id))

    def report_result(self, submission_id: str, claim_id: str, report: FinalReport) -> None:
        self.results.append((submission_id, report))

    def release(self, submission_id: str, claim_id: str, reason: str) -> None:
        self.releases.append((submission_id, reason))


class FakeListener:
    def __init__(self) -> None:
        self.waits = 0

    def wait(self, timeout_seconds: float) -> bool:
        self.waits += 1
        return False

    def close(self) -> None:
        return None


class RecordingJudge:
    name = "fake"
    languages = ["python"]
    reuse_scratch = False

    def __init__(self, outcome) -> None:
        self.outcome = outcome
        self.stop: threading.Event | None = None
        self.seen_scratch: Path | None = None

    def judge(self, job: Job, scratch: Path) -> FinalReport | Release:
        self.seen_scratch = scratch
        (scratch / "left-behind.txt").write_text("x", encoding="utf-8")

        if isinstance(self.outcome, BaseException):
            raise self.outcome
        return self.outcome


class WorkerLoopTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.config = WorkerConfig(
            app_url="http://app:3000",
            service_key="secret",
            worker_id="test-1",
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

    def _worker(self, judge, client: FakeClient) -> Worker:
        return Worker(self.config, judge, client=client, listener=FakeListener())

    def test_a_judged_submission_is_reported(self) -> None:
        job = make_job()
        client = FakeClient([job])
        judge = RecordingJudge(FinalReport(status="accepted", score=2, max_score=2))
        worker = self._worker(judge, client)

        self.assertTrue(worker.run_once())
        self.assertEqual(client.running, [(job.submission_id, job.claim_id)])
        self.assertEqual(client.results[0][1].status, "accepted")
        self.assertEqual(client.releases, [])

    def test_the_scratch_directory_does_not_outlive_the_job(self) -> None:
        client = FakeClient([make_job()])
        judge = RecordingJudge(FinalReport(status="accepted"))
        self._worker(judge, client).run_once()

        self.assertIsNotNone(judge.seen_scratch)
        self.assertFalse(judge.seen_scratch.exists())

    def test_a_judge_that_throws_becomes_an_internal_error(self) -> None:
        job = make_job()
        client = FakeClient([job])
        worker = self._worker(RecordingJudge(RuntimeError("the sandbox fell over")), client)

        self.assertTrue(worker.run_once())

        _submission_id, report = client.results[0]
        self.assertEqual(report.status, "internal_error")
        self.assertIn("the sandbox fell over", report.compile_message)
        self.assertEqual(report.tests, [])
        # The worker is still usable afterwards.
        self.assertFalse(worker.run_once())

    def test_a_release_never_reports_a_result(self) -> None:
        job = make_job(language="cpp")
        client = FakeClient([job])
        judge = RecordingJudge(Release("C++ checking is temporarily unavailable"))
        self._worker(judge, client).run_once()

        self.assertEqual(client.results, [])
        self.assertEqual(len(client.releases), 1)
        self.assertIn("temporarily unavailable", client.releases[0][1])

    def test_a_kept_scratch_directory_survives_a_release(self) -> None:
        class KeepingJudge(RecordingJudge):
            reuse_scratch = True

        client = FakeClient([make_job(language="cpp")])
        judge = KeepingJudge(Release("OIOIOI is unreachable", keep_scratch=True))
        self._worker(judge, client).run_once()

        self.assertTrue(judge.seen_scratch.exists())

    def test_no_work_is_not_an_error(self) -> None:
        client = FakeClient([])
        worker = self._worker(RecordingJudge(FinalReport(status="accepted")), client)

        self.assertFalse(worker.run_once())
        self.assertEqual(client.results, [])

    def test_an_app_that_is_down_does_not_stop_the_worker(self) -> None:
        client = FakeClient([])
        client.claim_error = AppUnreachableError("connection refused")
        worker = self._worker(RecordingJudge(FinalReport(status="accepted")), client)

        self.assertFalse(worker.run_once())
        self.assertEqual(client.claims, 1)

    def test_the_judge_is_told_when_the_worker_stops(self) -> None:
        judge = RecordingJudge(FinalReport(status="accepted"))
        worker = self._worker(judge, FakeClient([]))

        self.assertIs(judge.stop, worker.stop)


if __name__ == "__main__":
    unittest.main()
