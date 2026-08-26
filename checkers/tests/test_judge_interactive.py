"""
Interactive problems, judged the way `combo` is.

The submission and the problem's grader are built into one program, the test file is
fed to it, and the verdict is whatever the grader printed. The first tests use the
real IOI grader from the reference checkout; the rest use small stub graders written
here, so the rules about a silent or a surprising grader need no reference at all.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from bwrap.pipeline import judge_submission
from bwrap.report import JudgeRequest

from .test_judge_fixtures import (
    COMBO_SECRET,
    CORRECT_COMBO,
    PROBLEMS_PATH,
    WRONG_COMBO,
    require_cpp,
    require_wait4,
    write_interactive_package,
    write_reference_combo_package,
)

# A submission that only has to exist: the stub graders below never call it.
EMPTY_COMBO = '#include "combo.h"\n#include <string>\nstd::string guess_sequence(int N) '
EMPTY_COMBO += '{ return std::string(N, \'A\'); }\n'

SILENT_GRADER = """
#include <cstdio>
#include <string>
#include "combo.h"

int press(std::string p) { return 0; }

int main() {
  char buffer[64];
  if (scanf("%s", buffer) != 1) { return 1; }
  std::string secret = buffer;
  guess_sequence(secret.length());
  return 0;
}
"""

SURPRISING_GRADER = """
#include <cstdio>
#include <string>
#include "combo.h"

int press(std::string p) { return 0; }

int main() {
  char buffer[64];
  if (scanf("%s", buffer) != 1) { return 1; }
  printf("Everything is fine\\n");
  return 0;
}
"""

CRASHING_GRADER = """
#include <cstdio>
#include <cstdlib>
#include <string>
#include "combo.h"

int press(std::string p) { return 0; }

int main() {
  char buffer[64];
  if (scanf("%s", buffer) != 1) { return 1; }
  abort();
}
"""

SLOW_GRADER = """
#include <cstdio>
#include <string>
#include "combo.h"

int press(std::string p) { return 0; }

int main() {
  char buffer[64];
  if (scanf("%s", buffer) != 1) { return 1; }
  volatile double total = 0;
  for (long i = 0; i < 4000000000L; ++i) { total += i; }
  printf("Accepted: 1\\n");
  return 0;
}
"""


def judge(package_directory: str, source_code: str, packages_path: Path):
    job = JudgeRequest(
        submission_id="0198df77-9122-7000-8000-000000000009",
        problem_slug=package_directory,
        package_directory=package_directory,
        language="cpp",
        source_code=source_code,
    )

    with (
        tempfile.TemporaryDirectory() as directory,
        mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}),
    ):
        return judge_submission(
            job,
            Path(directory),
            packages_path=packages_path,
            python_executable=sys.executable,
        )


class InteractiveBase(unittest.TestCase):
    def setUp(self) -> None:
        require_wait4()
        require_cpp()
        self._directory = tempfile.TemporaryDirectory()
        self.packages_path = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)


class ReferenceGraderTests(InteractiveBase):
    """The real grader from the reference checkout, end to end."""

    def setUp(self) -> None:
        super().setUp()
        write_reference_combo_package(
            self.packages_path,
            "combo",
            samples=[("01", f"{COMBO_SECRET}\n", None)],
            hidden=[("01", "ABXYBXYBXY\n", None), ("02", "XY\n", None)],
        )

    def test_a_correct_solution_is_accepted_and_its_presses_are_counted(self) -> None:
        report = judge("combo", CORRECT_COMBO, self.packages_path)

        self.assertEqual(report.status, "accepted")
        self.assertEqual([test.verdict for test in report.tests], ["passed"] * 3)
        self.assertEqual(report.score, 2)
        self.assertEqual(report.max_score, 2)

        for test in report.tests:
            self.assertIsNotNone(test.presses)
            self.assertGreater(test.presses, 0)

        # The sample shows what the grader answered, in place of an expected output.
        self.assertIn("Accepted:", report.tests[0].actual_output)

    def test_a_wrong_solution_is_a_wrong_answer(self) -> None:
        report = judge("combo", WRONG_COMBO, self.packages_path)

        self.assertEqual(report.status, "wrong_answer")
        self.assertEqual(report.score, 0)
        self.assertEqual(report.tests[0].verdict, "wrong_answer")
        self.assertIn("wrong guess", report.tests[0].message)
        self.assertIsNone(report.tests[0].presses)

    def test_a_solution_that_will_not_compile_shows_the_compiler_message(self) -> None:
        report = judge("combo", "this is not c++\n", self.packages_path)

        self.assertEqual(report.status, "compilation_error")
        self.assertEqual(report.tests, [])
        self.assertIn("combo.cpp", report.compile_message)

    def test_python_is_refused_for_a_problem_whose_grader_is_cpp(self) -> None:
        job = JudgeRequest(
            submission_id="0198df77-9122-7000-8000-00000000000a",
            problem_slug="combo",
            package_directory="combo",
            language="python",
            source_code="print('hi')\n",
        )

        with (
            tempfile.TemporaryDirectory() as directory,
            mock.patch.dict("os.environ", {"JUDGE_SANDBOX": "none"}),
        ):
            report = judge_submission(
                job, Path(directory), packages_path=self.packages_path
            )

        self.assertEqual(report.status, "compilation_error")
        self.assertIn("C++", report.compile_message)


class StubGraderTests(InteractiveBase):
    """The three rules about what a grader says, driven by graders written here."""

    def _package(self, grader_source: str, **problem) -> None:
        write_interactive_package(
            self.packages_path,
            "stub",
            grader_source=grader_source,
            samples=[("01", f"{COMBO_SECRET}\n", None)],
            problem=problem or None,
        )

    def test_a_grader_that_says_nothing_is_a_runtime_error(self) -> None:
        self._package(SILENT_GRADER)
        report = judge("stub", EMPTY_COMBO, self.packages_path)

        self.assertEqual(report.status, "runtime_error")
        self.assertEqual(report.tests[0].verdict, "runtime_error")
        self.assertIn("without the grader reporting", report.tests[0].message)

    def test_a_grader_that_says_something_else_is_an_internal_error(self) -> None:
        self._package(SURPRISING_GRADER)
        report = judge("stub", EMPTY_COMBO, self.packages_path)

        self.assertEqual(report.status, "internal_error")
        self.assertEqual(report.tests, [])
        self.assertIn("Everything is fine", report.compile_message)

    def test_a_program_that_dies_is_a_runtime_error(self) -> None:
        self._package(CRASHING_GRADER)
        report = judge("stub", EMPTY_COMBO, self.packages_path)

        self.assertEqual(report.status, "runtime_error")
        self.assertEqual(report.tests[0].verdict, "runtime_error")

    def test_a_run_past_the_time_limit_is_a_time_limit(self) -> None:
        self._package(SLOW_GRADER, limits={"timeLimitMs": 200, "memoryLimitMb": 256})
        report = judge("stub", EMPTY_COMBO, self.packages_path)

        self.assertEqual(report.status, "time_limit")
        self.assertEqual(report.tests[0].verdict, "time_limit")


@unittest.skipUnless(
    (PROBLEMS_PATH / "combo" / "problem.json").is_file(),
    "the shipped interactive problem is not there",
)
class ShippedComboTests(unittest.TestCase):
    """The interactive problem as it ships in this repository."""

    def setUp(self) -> None:
        require_wait4()
        require_cpp()

    def test_the_known_solution_wins_every_point(self) -> None:
        report = judge("combo", CORRECT_COMBO, PROBLEMS_PATH)

        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.score, report.max_score)
        self.assertTrue(all(test.presses for test in report.tests))

    def test_a_wrong_solution_is_not_accepted(self) -> None:
        """Always guessing the same button matches a test or two and nothing more."""
        report = judge("combo", WRONG_COMBO, PROBLEMS_PATH)

        self.assertEqual(report.status, "wrong_answer")
        self.assertLess(report.score, report.max_score)


if __name__ == "__main__":
    unittest.main()
