"""The Python side of contract version 1."""

from __future__ import annotations

import unittest

from common.contract import (
    CONTRACT_VERSION,
    ContractError,
    ContractVersionError,
    FinalReport,
    TestReport,
    parse_job,
    require_contract_version,
)


def claim_payload() -> dict:
    return {
        "submissionId": "0198df77-9122-7000-8000-000000000001",
        "claimId": "0198df77-9122-7000-8000-000000000002",
        "problemSlug": "cf-4-A",
        "packageDirectory": "cf-4-A",
        "language": "python",
        "sourceCode": "print('YES')\n",
        "timeLimitMs": 1000,
        "memoryLimitMb": 64,
        "checkerType": "token",
        "checkerPath": None,
        "tests": [
            {
                "problemTestId": "0198df77-9122-7000-8000-000000000004",
                "ordinal": 2,
                "visibility": "hidden",
                "points": 1,
                "inputFile": "002.in",
                "outputFile": "002.out",
            },
            {
                "problemTestId": "0198df77-9122-7000-8000-000000000003",
                "ordinal": 1,
                "visibility": "public",
                "points": 0,
                "input": "8\n",
                "expectedOutput": "YES\n",
            },
        ],
    }


class ContractVersionTests(unittest.TestCase):
    def test_the_agreed_version_passes(self) -> None:
        payload = require_contract_version({"contractVersion": CONTRACT_VERSION, "job": None})

        self.assertIsNone(payload["job"])

    def test_another_version_is_refused(self) -> None:
        with self.assertRaises(ContractVersionError):
            require_contract_version({"contractVersion": 2, "job": None})

    def test_a_missing_version_is_refused(self) -> None:
        with self.assertRaises(ContractVersionError):
            require_contract_version({"job": None})


class ParseJobTests(unittest.TestCase):
    def test_tests_arrive_in_order(self) -> None:
        job = parse_job(claim_payload())

        self.assertEqual([test.ordinal for test in job.tests], [1, 2])

    def test_a_hidden_test_carries_only_file_names(self) -> None:
        job = parse_job(claim_payload())
        hidden = job.tests[1]

        self.assertTrue(hidden.is_hidden)
        self.assertEqual(hidden.input_file, "002.in")
        self.assertEqual(hidden.output_file, "002.out")
        self.assertIsNone(hidden.input_text)
        self.assertIsNone(hidden.expected_output)

    def test_a_hidden_test_without_file_names_is_refused(self) -> None:
        payload = claim_payload()
        payload["tests"][0].pop("inputFile")

        with self.assertRaises(ContractError):
            parse_job(payload)

    def test_only_hidden_points_count_towards_the_maximum(self) -> None:
        job = parse_job(claim_payload())

        self.assertEqual(job.hidden_points, 1)


class ReportTests(unittest.TestCase):
    def test_a_report_becomes_the_agreed_payload(self) -> None:
        report = FinalReport(
            status="accepted",
            score=1,
            max_score=1,
            compile_message=None,
            max_cpu_ms=12,
            max_memory_kb=4096,
            tests=[
                TestReport(
                    problem_test_id="0198df77-9122-7000-8000-000000000003",
                    ordinal=1,
                    verdict="passed",
                    passed=True,
                    points_awarded=0,
                    message=None,
                    actual_output="YES\n",
                    time_ms=10,
                    memory_kb=4096,
                )
            ],
        )
        payload = report.to_payload()

        self.assertEqual(payload["status"], "accepted")
        self.assertEqual(payload["tests"][0]["verdict"], "passed")
        self.assertEqual(payload["maxMemoryKb"], 4096)

    def test_an_unknown_status_never_leaves_the_worker(self) -> None:
        with self.assertRaises(ContractError):
            FinalReport(status="almost").to_payload()

    def test_an_unknown_test_verdict_never_leaves_the_worker(self) -> None:
        with self.assertRaises(ContractError):
            TestReport(
                problem_test_id="x",
                ordinal=1,
                verdict="internal_error",
                passed=False,
                points_awarded=0,
                message=None,
                actual_output=None,
                time_ms=0,
                memory_kb=0,
            ).to_payload()


if __name__ == "__main__":
    unittest.main()
