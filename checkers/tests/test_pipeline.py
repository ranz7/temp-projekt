"""
Judging a whole submission, end to end.

These tests run real programs with `JUDGE_SANDBOX=none`, which is what a development
machine without bubblewrap does; the sandbox itself is covered in `test_spawn.py`.
"""

from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from bwrap.pipeline import judge_submission
from common.contract import Release

from .helpers import (
    PROBLEMS_PATH,
    SHIPPED_PACKAGE,
    hidden_test,
    make_job,
    public_test,
    require_wait4,
)

ECHO_INPUT = "import sys\nprint(sys.stdin.read().strip())\n"


def judge(job, *, packages_path: Path = PROBLEMS_PATH, stop=None):
    with tempfile.TemporaryDirectory() as directory:
        with mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}):
            return judge_submission(
                job,
                Path(directory),
                packages_path=packages_path,
                python_executable=sys.executable,
                stop=stop,
            )


class JudgeSubmissionTests(unittest.TestCase):
    def setUp(self) -> None:
        require_wait4()

    def test_a_correct_solution_is_accepted(self) -> None:
        job = make_job(
            source_code=ECHO_INPUT,
            tests=[public_test(1, "hello\n", "hello\n"), public_test(2, "42\n", "42\n")],
        )
        report = judge(job)

        self.assertEqual(report.status, "accepted")
        self.assertEqual([test.verdict for test in report.tests], ["passed", "passed"])
        self.assertEqual(report.max_score, 0)

    def test_whitespace_alone_never_fails_a_solution(self) -> None:
        job = make_job(
            source_code="print('  YES  ')\n", tests=[public_test(1, "8\n", "YES\n")]
        )

        self.assertEqual(judge(job).status, "accepted")

    def test_a_wrong_answer_still_runs_every_test(self) -> None:
        job = make_job(
            source_code="print('NO')\n",
            tests=[
                public_test(1, "8\n", "NO\n"),
                public_test(2, "9\n", "YES\n"),
                public_test(3, "10\n", "NO\n"),
            ],
        )
        report = judge(job)

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual(
            [test.verdict for test in report.tests], ["passed", "wrong_answer", "passed"]
        )

    def test_the_submission_takes_the_first_failure(self) -> None:
        """A slow test after a wrong answer does not change what the person is told."""
        source = (
            "import sys, time\n"
            "value = sys.stdin.read().strip()\n"
            "if value == 'slow':\n"
            "    time.sleep(5)\n"
            "print('NO')\n"
        )
        job = make_job(
            source_code=source,
            time_limit_ms=300,
            tests=[public_test(1, "quick\n", "YES\n"), public_test(2, "slow\n", "NO\n")],
        )
        report = judge(job)

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual(report.tests[0].verdict, "wrong_answer")
        self.assertEqual(report.tests[1].verdict, "time_limit")

    def test_a_program_that_crashes_is_a_runtime_error(self) -> None:
        job = make_job(
            source_code="raise SystemExit(3)\n", tests=[public_test(1, "8\n", "YES\n")]
        )
        report = judge(job)

        self.assertEqual(report.status, "runtime_error")
        self.assertIn("runtime error", report.tests[0].message)

    def test_a_program_that_never_ends_hits_the_wall_clock(self) -> None:
        job = make_job(
            source_code="import time\ntime.sleep(30)\n",
            time_limit_ms=200,
            tests=[public_test(1, "8\n", "YES\n")],
        )
        report = judge(job)

        self.assertEqual(report.status, "time_limit")

    def test_too_much_memory_and_too_much_time_reads_as_memory(self) -> None:
        """The verdict order, end to end: memory is decided before time."""
        source = (
            "import time\n"
            "blocks = [b'x' * (1024 * 1024) for _ in range(160)]\n"
            "time.sleep(30)\n"
        )
        job = make_job(
            source_code=source,
            time_limit_ms=300,
            memory_limit_mb=32,
            tests=[public_test(1, "8\n", "YES\n")],
        )
        report = judge(job)

        self.assertEqual(report.status, "memory_limit")
        self.assertEqual(report.tests[0].verdict, "memory_limit")

    def test_a_language_this_checker_cannot_run_is_a_compilation_error(self) -> None:
        job = make_job(language="cpp", source_code="int main(){}", tests=[public_test(1, "", "")])
        report = judge(job)

        self.assertEqual(report.status, "compilation_error")
        self.assertEqual(report.tests, [])
        self.assertIn("cpp", report.compile_message)

    def test_shutting_down_gives_the_job_back(self) -> None:
        stop = threading.Event()
        stop.set()
        job = make_job(source_code=ECHO_INPUT, tests=[public_test(1, "hi\n", "hi\n")])
        outcome = judge(job, stop=stop)

        self.assertIsInstance(outcome, Release)

    def test_a_test_file_this_worker_does_not_have_fails_the_submission(self) -> None:
        job = make_job(source_code=ECHO_INPUT, tests=[hidden_test(1, "999.in", "999.out")])

        with self.assertRaises(RuntimeError):
            judge(job)


@unittest.skipUnless(
    (PROBLEMS_PATH / SHIPPED_PACKAGE / "tests" / "01.in").is_file(),
    "the shipped problem package is not there",
)
class ShippedProblemTests(unittest.TestCase):
    """The one problem in the repository, judged the way the app would ask for it."""

    def setUp(self) -> None:
        require_wait4()

    def test_a_watermelon_solution_scores_every_hidden_point(self) -> None:
        job = make_job(
            source_code="w = int(input())\nprint('YES' if w > 2 and w % 2 == 0 else 'NO')\n",
            time_limit_ms=2000,
            memory_limit_mb=256,
            tests=[
                public_test(1, "8\n", "YES\n"),
                hidden_test(2, "01.in", "01.out", points=1),
                hidden_test(3, "02.in", "02.out", points=1),
                hidden_test(4, "03.in", "03.out", points=1),
            ],
        )
        report = judge(job)

        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.score, 3)
        self.assertEqual(report.max_score, 3)

    def test_hidden_rows_never_carry_the_program_output(self) -> None:
        job = make_job(
            source_code="print('NO')\n",
            tests=[hidden_test(1, "01.in", "01.out", points=2)],
        )
        report = judge(job)

        self.assertEqual(report.status, "wrong_answer")
        self.assertIsNone(report.tests[0].actual_output)
        self.assertIsNone(report.tests[0].message)
        self.assertEqual(report.score, 0)
        self.assertEqual(report.max_score, 2)


if __name__ == "__main__":
    unittest.main()
