"""
Submit once and poll, ported from the reference adapter (`tests/test_oioioi_job.py`).

OIOIOI is stubbed in process: no network is touched anywhere in this file.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from cpp.oioioi_client import OioioiHttpError, OioioiSubmitUncertain, OioioiUnavailable
from cpp.oioioi_job import remembered_submission_id, run_oioioi_job

SOURCE = "int main(){}"


class FakeOioioi:
    """A stand-in for OIOIOI that answers from a script."""

    def __init__(self, reports: list | None = None, submit_error: Exception | None = None) -> None:
        self.submits = 0
        self.reports = list(reports or [])
        self.submit_error = submit_error
        self.report_calls = 0

    def submit(self, short_name: str, code: str) -> int:
        self.submits += 1

        if self.submit_error is not None:
            raise self.submit_error
        return 7

    def get_submission_report(self, oioioi_id: int) -> dict:
        self.report_calls += 1

        if not self.reports:
            return {"complete": False}

        answer = self.reports.pop(0)

        if isinstance(answer, BaseException):
            raise answer
        return answer


def run(client, scratch: Path, **overrides):
    settings = {
        "client": client,
        "scratch": scratch,
        "short_name": "cf-4-A",
        "source_code": SOURCE,
        "poll_seconds": 0.0,
        "sleep": lambda _seconds: None,
    }
    settings.update(overrides)
    return run_oioioi_job(**settings)


class OioioiJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.scratch = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_the_submission_id_is_remembered_and_never_sent_twice(self) -> None:
        client = FakeOioioi(
            [
                {"complete": False},
                {"complete": False},
                {
                    "complete": True,
                    "verdict": "OK",
                    "score": 100,
                    "max_score": 100,
                    "time_ms": 4,
                    "memory_kb": 800,
                },
            ]
        )
        outcome = run(client, self.scratch)

        self.assertTrue(outcome.ok)
        self.assertEqual(outcome.oioioi_id, 7)
        self.assertEqual(outcome.status, "OK")
        self.assertEqual(outcome.time_ms, 4)
        self.assertEqual(outcome.memory_kb, 800)
        self.assertEqual(client.submits, 1)
        self.assertEqual(remembered_submission_id(self.scratch), 7)

        # A restart finds the id in the scratch directory and only polls.
        resumed_client = FakeOioioi([{"complete": True, "verdict": "WA"}])
        resumed = run(resumed_client, self.scratch)

        self.assertTrue(resumed.ok)
        self.assertEqual(resumed.status, "WA")
        self.assertEqual(resumed_client.submits, 0)

    def test_an_unreachable_oioioi_asks_for_the_job_back(self) -> None:
        client = FakeOioioi(submit_error=OioioiUnavailable("connection refused"))
        outcome = run(client, self.scratch)

        self.assertFalse(outcome.ok)
        self.assertTrue(outcome.unavailable)
        self.assertIn("connection refused", outcome.message)
        self.assertIsNone(remembered_submission_id(self.scratch))

    def test_a_lost_submit_answer_is_never_repeated_by_itself(self) -> None:
        client = FakeOioioi(submit_error=OioioiSubmitUncertain("no answer in time"))
        outcome = run(client, self.scratch)

        self.assertTrue(outcome.unavailable)
        self.assertEqual(client.submits, 1)

    def test_a_submission_oioioi_refuses_is_a_real_answer(self) -> None:
        client = FakeOioioi(submit_error=OioioiHttpError(400, '{"file":["required"]}'))
        outcome = run(client, self.scratch)

        self.assertFalse(outcome.ok)
        self.assertFalse(outcome.unavailable)
        self.assertIn("400", outcome.message)

    def test_a_report_that_is_not_there_yet_is_polled_again(self) -> None:
        client = FakeOioioi(
            [
                OioioiHttpError(404, '{"detail": "Not found."}'),
                {"complete": True, "verdict": "OK", "score": 100, "time_ms": 1},
            ]
        )
        outcome = run(client, self.scratch)

        self.assertTrue(outcome.ok)
        self.assertEqual(outcome.status, "OK")

    def test_an_outage_while_polling_asks_for_the_job_back(self) -> None:
        client = FakeOioioi([OioioiUnavailable("gateway down")] * 5)
        ticks = iter([0.0, 0.0, 1.0, 2.0, 3.0, 999.0])
        outcome = run(
            client,
            self.scratch,
            monotonic=lambda: next(ticks, 999.0),
            poll_timeout_seconds=5,
        )

        self.assertFalse(outcome.ok)
        self.assertTrue(outcome.unavailable)
        self.assertIn("gateway down", outcome.message)

    def test_a_compile_error_ends_the_wait_without_a_complete_report(self) -> None:
        client = FakeOioioi([{"verdict": "CE", "complete": False}])
        outcome = run(client, self.scratch)

        self.assertTrue(outcome.ok)
        self.assertEqual(outcome.status, "CE")

    def test_an_empty_submission_is_refused_before_anything_is_sent(self) -> None:
        client = FakeOioioi()
        outcome = run(client, self.scratch, source_code="   ")

        self.assertFalse(outcome.ok)
        self.assertFalse(outcome.unavailable)
        self.assertEqual(client.submits, 0)

    def test_a_problem_without_a_short_name_is_refused(self) -> None:
        client = FakeOioioi()
        outcome = run(client, self.scratch, short_name="")

        self.assertFalse(outcome.ok)
        self.assertEqual(client.submits, 0)


if __name__ == "__main__":
    unittest.main()
