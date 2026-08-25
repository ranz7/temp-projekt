"""
The entry point the rest of the checker calls, and the shape of what it answers.

`run_judge` takes one submission, reads that problem from this machine's disk, judges
it in a scratch directory of its own and deletes that directory afterwards.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from bwrap import JudgeRequest, run_judge
from bwrap.package import PackageError

from .test_judge_fixtures import (
    ECHO_INPUT_PYTHON,
    PROBLEMS_PATH,
    require_wait4,
    write_package,
)


def request(package_directory: str, source_code: str = ECHO_INPUT_PYTHON) -> JudgeRequest:
    return JudgeRequest(
        submission_id="0198df77-9122-7000-8000-000000000021",
        problem_slug=package_directory,
        package_directory=package_directory,
        language="python",
        source_code=source_code,
    )


class RunJudgeTests(unittest.TestCase):
    def setUp(self) -> None:
        require_wait4()
        self._packages = tempfile.TemporaryDirectory()
        self._scratch = tempfile.TemporaryDirectory()
        self.packages_path = Path(self._packages.name)
        self.scratch_path = Path(self._scratch.name)
        self.addCleanup(self._packages.cleanup)
        self.addCleanup(self._scratch.cleanup)

    def run_judge(self, job: JudgeRequest):
        with mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}):
            return run_judge(
                job,
                packages_path=self.packages_path,
                scratch_path=self.scratch_path,
                python_executable=sys.executable,
            )

    def test_a_submission_is_judged_and_its_scratch_directory_goes(self) -> None:
        write_package(
            self.packages_path,
            "fixture",
            samples=[("01", "hello\n", "hello\n")],
            hidden=[("01", "7\n", "7\n")],
        )
        result = self.run_judge(request("fixture"))

        self.assertEqual(result.status, "accepted")
        self.assertEqual(list(self.scratch_path.iterdir()), [])

    def test_the_report_is_json_the_app_can_store(self) -> None:
        write_package(self.packages_path, "fixture", hidden=[("01", "7\n", "7\n")])
        payload = self.run_judge(request("fixture")).to_payload()

        self.assertEqual(
            sorted(payload),
            ["compileMessage", "maxCpuMs", "maxMemoryKb", "maxScore", "score", "status", "tests"],
        )
        self.assertEqual(
            sorted(payload["tests"][0]),
            [
                "actualOutput",
                "memoryKb",
                "message",
                "name",
                "ordinal",
                "passed",
                "pointsAwarded",
                "presses",
                "timeMs",
                "verdict",
                "visibility",
            ],
        )
        # It survives a round trip, so it can be sent as it is.
        self.assertEqual(json.loads(json.dumps(payload))["status"], "accepted")

    def test_a_request_can_be_read_from_json(self) -> None:
        job = JudgeRequest.from_payload(
            {
                "submissionId": "0198df77-9122-7000-8000-000000000022",
                "problemSlug": "cf-4-A",
                "packageDirectory": "cf-4-A",
                "language": "python",
                "sourceCode": "print(1)\n",
            }
        )

        self.assertEqual(job.package_directory, "cf-4-A")
        self.assertEqual(job.to_payload()["sourceCode"], "print(1)\n")

    def test_a_problem_this_machine_does_not_hold(self) -> None:
        with self.assertRaises(PackageError):
            self.run_judge(request("not-a-problem"))

        # Nothing is left behind by a submission that could not be judged.
        self.assertEqual(list(self.scratch_path.iterdir()), [])


class ShippedPackagesTests(unittest.TestCase):
    """Every problem in the repository must be readable by this judge."""

    def test_each_shipped_package_loads(self) -> None:
        from bwrap.package import load_package

        directories = sorted(
            path.parent.name for path in PROBLEMS_PATH.glob("*/problem.json")
        )

        if not directories:
            self.skipTest("no problem package is checked out")

        for directory in directories:
            with self.subTest(package=directory):
                package = load_package(PROBLEMS_PATH, directory)

                self.assertGreater(len(package.tests), 0)
                self.assertGreater(package.time_limit_ms, 0)
                self.assertGreater(package.memory_limit_mb, 0)

                if package.is_interactive:
                    self.assertIsNotNone(package.grader)
                    self.assertTrue(all(test.expected_path is None for test in package.tests))
                else:
                    self.assertTrue(all(test.expected_path is not None for test in package.tests))

    def test_a_shipped_model_solution_is_accepted(self) -> None:
        """Where a package ships a Python model solution, this judge accepts it."""
        require_wait4()
        models = sorted(PROBLEMS_PATH.glob("*/model/sol.py"))

        if not models:
            self.skipTest("no package ships a Python model solution")

        for model in models:
            directory = model.parent.parent

            if not (directory / "problem.json").is_file():
                continue

            with self.subTest(package=directory.name):
                job = request(directory.name, model.read_text(encoding="utf-8"))

                with (
                    tempfile.TemporaryDirectory() as scratch,
                    mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}),
                ):
                    result = run_judge(
                        job,
                        packages_path=PROBLEMS_PATH,
                        scratch_path=Path(scratch),
                        python_executable=sys.executable,
                    )

                self.assertEqual(result.status, "accepted")
                self.assertEqual(result.score, result.max_score)


if __name__ == "__main__":
    unittest.main()
