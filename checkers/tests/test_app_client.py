"""The app client: the shared key, the contract version and the four calls."""

from __future__ import annotations

import io
import json
import unittest
import urllib.error

from common.app_client import AppClient, AppUnreachableError
from common.contract import ContractError, ContractVersionError, FinalReport

from .test_contract import claim_payload


class FakeResponse(io.BytesIO):
    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_exception: object) -> None:
        self.close()


class RecordingOpener:
    """Stands in for urlopen and remembers every request the worker made."""

    def __init__(self, answers: list[object]) -> None:
        self.answers = answers
        self.requests: list = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        answer = self.answers.pop(0) if self.answers else {"contractVersion": 1}

        if isinstance(answer, BaseException):
            raise answer
        return FakeResponse(json.dumps(answer).encode("utf-8"))

    @property
    def last_body(self) -> dict:
        return json.loads(self.requests[-1].data.decode("utf-8"))


class AppClientTests(unittest.TestCase):
    def test_claim_carries_the_key_and_the_version(self) -> None:
        opener = RecordingOpener([{"contractVersion": 1, "job": None}])
        client = AppClient("http://app:3000", "secret", urlopen=opener)

        self.assertIsNone(client.claim("bwrap-1", ["python"]))

        request = opener.requests[-1]
        self.assertTrue(request.full_url.endswith("/api/internal/checker/claim"))
        self.assertEqual(request.get_header("X-service-key"), "secret")
        self.assertEqual(opener.last_body["contractVersion"], 1)
        self.assertEqual(opener.last_body["languages"], ["python"])

    def test_a_different_contract_version_is_refused(self) -> None:
        opener = RecordingOpener([{"contractVersion": 2, "job": None}])
        client = AppClient("http://app:3000", "secret", urlopen=opener)

        with self.assertRaises(ContractVersionError):
            client.claim("bwrap-1", ["python"])

    def test_a_claimed_job_is_parsed(self) -> None:
        opener = RecordingOpener([{"contractVersion": 1, "job": claim_payload()}])
        client = AppClient("http://app:3000", "secret", urlopen=opener)
        job = client.claim("bwrap-1", ["python"])

        self.assertIsNotNone(job)
        self.assertEqual(job.problem_slug, "cf-4-A")
        self.assertEqual(len(job.tests), 2)

    def test_running_and_result_and_release_shapes(self) -> None:
        opener = RecordingOpener([{"contractVersion": 1}] * 3)
        client = AppClient("http://app:3000", "secret", urlopen=opener)

        client.report_running("submission", "claim")
        self.assertEqual(opener.last_body["status"], "running")
        self.assertNotIn("score", opener.last_body)

        client.report_result(
            "submission", "claim", FinalReport(status="accepted", score=3, max_score=3)
        )
        body = opener.last_body
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["score"], 3)
        self.assertEqual(body["tests"], [])

        client.release("submission", "claim", "OIOIOI is unreachable")
        self.assertEqual(opener.last_body["reason"], "OIOIOI is unreachable")
        self.assertTrue(opener.requests[-1].full_url.endswith("/release"))

    def test_a_refused_key_is_a_contract_error(self) -> None:
        error = urllib.error.HTTPError(
            "http://app:3000/api/internal/checker/claim", 401, "no", {}, io.BytesIO(b"nope")
        )
        client = AppClient("http://app:3000", "wrong", urlopen=RecordingOpener([error]))

        with self.assertRaises(ContractError):
            client.claim("bwrap-1", ["python"])

    def test_an_app_that_does_not_answer_is_survivable(self) -> None:
        client = AppClient(
            "http://app:3000",
            "secret",
            urlopen=RecordingOpener([urllib.error.URLError("connection refused")]),
        )

        with self.assertRaises(AppUnreachableError):
            client.claim("bwrap-1", ["python"])


if __name__ == "__main__":
    unittest.main()
