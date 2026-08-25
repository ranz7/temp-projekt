"""
Judging a whole submission, end to end.

These tests run real programs with `JUDGE_SANDBOX=none`, which is what a development
machine without bubblewrap does; the sandbox itself is covered in `test_spawn.py`.
Every problem is a package on disk, exactly as a checker machine holds it.
"""

from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from bwrap.package import PackageError
from bwrap.pipeline import judge_submission
from bwrap.report import JudgeCancelled, JudgeRequest

from .test_judge_fixtures import (
    ECHO_INPUT_CPP,
    ECHO_INPUT_PYTHON,
    PROBLEMS_PATH,
    SHIPPED_PACKAGE,
    require_cpp,
    require_wait4,
    write_package,
)

CUSTOM_CHECKER = """
import sys

values = open(sys.argv[1], encoding="utf-8").read().split()
answer = open(sys.argv[3], encoding="utf-8").read().split()
print("1" if answer and int(answer[0]) % int(values[0]) == 0 else "0")
"""


def request(
    *,
    package_directory: str,
    language: str = "python",
    source_code: str = ECHO_INPUT_PYTHON,
) -> JudgeRequest:
    return JudgeRequest(
        submission_id="0198df77-9122-7000-8000-000000000001",
        problem_slug=package_directory,
        package_directory=package_directory,
        language=language,
        source_code=source_code,
    )


def judge(job: JudgeRequest, *, packages_path: Path, stop=None):
    with (
        tempfile.TemporaryDirectory() as directory,
        mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}),
    ):
        return judge_submission(
            job,
            Path(directory),
            packages_path=packages_path,
            python_executable=sys.executable,
            stop=stop,
        )


class JudgeSubmissionTests(unittest.TestCase):
    """One temporary package per test, built to say exactly what the test needs."""

    def setUp(self) -> None:
        require_wait4()
        self._directory = tempfile.TemporaryDirectory()
        self.packages_path = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def judge(self, *, source_code: str, language: str = "python", **package) -> object:
        write_package(self.packages_path, "fixture", **package)
        return judge(
            request(package_directory="fixture", language=language, source_code=source_code),
            packages_path=self.packages_path,
        )

    def test_a_correct_solution_is_accepted(self) -> None:
        report = self.judge(
            source_code=ECHO_INPUT_PYTHON,
            samples=[("01", "hello\n", "hello\n")],
            hidden=[("01", "42\n", "42\n")],
        )

        self.assertEqual(report.status, "accepted")
        self.assertEqual([test.verdict for test in report.tests], ["passed", "passed"])
        self.assertEqual([test.visibility for test in report.tests], ["public", "hidden"])
        self.assertEqual(report.score, 1)
        self.assertEqual(report.max_score, 1)

    def test_whitespace_alone_never_fails_a_solution(self) -> None:
        report = self.judge(
            source_code="print('  YES  ')\n", samples=[("01", "8\n", "YES\n")]
        )

        self.assertEqual(report.status, "accepted")

    def test_a_wrong_answer_still_runs_every_test(self) -> None:
        report = self.judge(
            source_code="print('NO')\n",
            samples=[("01", "8\n", "NO\n"), ("02", "9\n", "YES\n"), ("03", "10\n", "NO\n")],
        )

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
        report = self.judge(
            source_code=source,
            problem={"limits": {"timeLimitMs": 300, "memoryLimitMb": 256}},
            samples=[("01", "quick\n", "YES\n"), ("02", "slow\n", "NO\n")],
        )

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual(report.tests[0].verdict, "wrong_answer")
        self.assertEqual(report.tests[1].verdict, "time_limit")

    def test_a_program_that_crashes_is_a_runtime_error(self) -> None:
        report = self.judge(
            source_code="raise SystemExit(3)\n", samples=[("01", "8\n", "YES\n")]
        )

        self.assertEqual(report.status, "runtime_error")
        self.assertIn("runtime error", report.tests[0].message)

    def test_a_program_that_never_ends_hits_the_wall_clock(self) -> None:
        report = self.judge(
            source_code="import time\ntime.sleep(30)\n",
            problem={"limits": {"timeLimitMs": 200, "memoryLimitMb": 256}},
            samples=[("01", "8\n", "YES\n")],
        )

        self.assertEqual(report.status, "time_limit")

    def test_too_much_memory_and_too_much_time_reads_as_memory(self) -> None:
        """The verdict order, end to end: memory is decided before time."""
        source = (
            "import time\n"
            "blocks = [b'x' * (1024 * 1024) for _ in range(160)]\n"
            "time.sleep(30)\n"
        )
        report = self.judge(
            source_code=source,
            problem={"limits": {"timeLimitMs": 300, "memoryLimitMb": 32}},
            samples=[("01", "8\n", "YES\n")],
        )

        self.assertEqual(report.status, "memory_limit")
        self.assertEqual(report.tests[0].verdict, "memory_limit")

    def test_a_language_this_checker_cannot_run_is_a_compilation_error(self) -> None:
        report = self.judge(
            source_code="puts 'hi'", language="ruby", samples=[("01", "", "")]
        )

        self.assertEqual(report.status, "compilation_error")
        self.assertEqual(report.tests, [])
        self.assertIn("ruby", report.compile_message)

    def test_shutting_down_leaves_the_submission_waiting(self) -> None:
        stop = threading.Event()
        stop.set()
        write_package(self.packages_path, "fixture", samples=[("01", "hi\n", "hi\n")])

        with self.assertRaises(JudgeCancelled):
            judge(
                request(package_directory="fixture"),
                packages_path=self.packages_path,
                stop=stop,
            )

    def test_a_package_this_machine_does_not_have(self) -> None:
        with self.assertRaises(PackageError):
            judge(request(package_directory="not-a-problem"), packages_path=self.packages_path)

    def test_a_solution_is_accepted_only_when_every_hidden_test_passes(self) -> None:
        """One hidden test out of two failing must not be accepted, and only the
        passed one's points count - not zero, not the full total."""
        source = (
            "import sys\n"
            "value = sys.stdin.read().strip()\n"
            "print('one' if value == '1' else 'WRONG')\n"
        )
        report = self.judge(
            source_code=source,
            problem={"tests": {"points": 2}},
            hidden=[("01", "1\n", "one\n"), ("02", "2\n", "two\n")],
        )

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual([test.passed for test in report.tests], [True, False])
        # Only the passed test's points count - not zero, and not the full 4.
        self.assertEqual(report.score, 2)
        self.assertEqual(report.max_score, 4)

    def test_a_hidden_row_never_carries_the_program_output(self) -> None:
        report = self.judge(
            source_code="print('NO')\n", hidden=[("01", "8\n", "YES\n")]
        )

        self.assertEqual(report.status, "wrong_answer")
        self.assertIsNone(report.tests[0].actual_output)
        self.assertIsNone(report.tests[0].message)
        self.assertEqual(report.score, 0)
        self.assertEqual(report.max_score, 1)

    def test_a_checker_script_outside_the_package_is_refused(self) -> None:
        (self.packages_path / "checker").mkdir(parents=True, exist_ok=True)
        script = self.packages_path / "checker" / "checker.py"
        script.write_text(CUSTOM_CHECKER, encoding="utf-8")
        write_package(
            self.packages_path,
            "fixture",
            problem={"checker": {"type": "custom", "path": "../checker/checker.py"}},
            samples=[("01", "5\n", "5\n")],
        )

        with self.assertRaises(PackageError):
            # A checker outside the package is refused before anything is run.
            judge(request(package_directory="fixture"), packages_path=self.packages_path)

    def test_a_custom_checker_inside_the_package_decides(self) -> None:
        directory = write_package(
            self.packages_path,
            "fixture",
            problem={"checker": {"type": "custom", "path": "checker/checker.py"}},
            samples=[("01", "5\n", "5\n")],
            hidden=[("01", "7\n", "7\n")],
        )
        (directory / "checker").mkdir(parents=True, exist_ok=True)
        (directory / "checker" / "checker.py").write_text(CUSTOM_CHECKER, encoding="utf-8")

        report = judge(
            request(
                package_directory="fixture",
                source_code="import sys\nprint(int(sys.stdin.read()) * 3)\n",
            ),
            packages_path=self.packages_path,
        )

        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.score, 1)


class CppSubmissionTests(unittest.TestCase):
    """C++ is compiled and run here now, in the same sandbox as Python."""

    def setUp(self) -> None:
        require_wait4()
        require_cpp()
        self._directory = tempfile.TemporaryDirectory()
        self.packages_path = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def test_a_cpp_program_that_echoes_its_input_is_accepted(self) -> None:
        write_package(
            self.packages_path,
            "fixture",
            samples=[("01", "hello\n", "hello\n")],
            hidden=[("01", "42\n", "42\n")],
        )
        report = judge(
            request(package_directory="fixture", language="cpp", source_code=ECHO_INPUT_CPP),
            packages_path=self.packages_path,
        )

        self.assertEqual(report.status, "accepted")
        self.assertEqual([test.verdict for test in report.tests], ["passed", "passed"])
        self.assertEqual(report.score, 1)

    def test_cpp_that_does_not_compile_reports_the_compiler_message(self) -> None:
        write_package(self.packages_path, "fixture", samples=[("01", "1\n", "1\n")])
        report = judge(
            request(
                package_directory="fixture",
                language="cpp",
                source_code="int main() { this is not c++ }\n",
            ),
            packages_path=self.packages_path,
        )

        self.assertEqual(report.status, "compilation_error")
        self.assertEqual(report.tests, [])
        self.assertIn("main.cpp", report.compile_message)
        self.assertIn("error", report.compile_message.lower())
        # The message names the file the person wrote, not a path on this machine.
        self.assertNotIn(str(self.packages_path), report.compile_message)


@unittest.skipUnless(
    (PROBLEMS_PATH / SHIPPED_PACKAGE / "problem.json").is_file(),
    "the shipped problem package is not there",
)
class ShippedProblemTests(unittest.TestCase):
    """The Watermelon problem in the repository, judged the way the app asks for it."""

    def setUp(self) -> None:
        require_wait4()

    def test_a_watermelon_solution_scores_every_hidden_point(self) -> None:
        report = judge(
            request(
                package_directory=SHIPPED_PACKAGE,
                source_code="w = int(input())\nprint('YES' if w > 2 and w % 2 == 0 else 'NO')\n",
            ),
            packages_path=PROBLEMS_PATH,
        )

        self.assertEqual(report.status, "accepted")
        self.assertGreater(report.max_score, 0)
        self.assertEqual(report.score, report.max_score)
        self.assertEqual(report.tests[0].visibility, "public")

    def test_a_wrong_watermelon_solution_scores_less_than_the_maximum(self) -> None:
        """Always answering NO passes the odd weights only, so it is not accepted."""
        report = judge(
            request(package_directory=SHIPPED_PACKAGE, source_code="print('NO')\n"),
            packages_path=PROBLEMS_PATH,
        )

        self.assertEqual(report.status, "wrong_answer")
        self.assertLess(report.score, report.max_score)
        self.assertTrue(all(test.actual_output is None for test in report.tests if test.is_hidden))


if __name__ == "__main__":
    unittest.main()
