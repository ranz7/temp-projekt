"""
The compile step.

Python is only staged; C++ is really built, on its own or together with an interactive
problem's grader. A machine without a C++ compiler skips the C++ tests.
"""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from bwrap.compile import (
    CPP_SOURCE_NAME,
    PROGRAM_NAME,
    PYTHON_SOURCE_NAME,
    compile_submission,
)
from bwrap.package import GraderSpec

from .test_judge_fixtures import COMBO_HEADER, ECHO_INPUT_CPP, require_cpp

STUB_GRADER = """
#include <cstdio>
#include <string>
#include "combo.h"

int press(std::string p) { return (int)p.length(); }

int main() {
  printf("Accepted: %d\\n", press(guess_sequence(3)));
  return 0;
}
"""

STUB_SUBMISSION = """
#include "combo.h"
#include <string>

std::string guess_sequence(int N) { return std::string(N, 'A'); }
"""


class PythonCompileTests(unittest.TestCase):
    def test_python_is_staged_and_runnable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission(
                "python", "print('hi')\n", Path(directory), python_executable="/usr/bin/python3"
            )

            self.assertTrue(result.ok)
            self.assertEqual(result.artifact_path.name, PYTHON_SOURCE_NAME)
            self.assertEqual(result.artifact_path.read_text(encoding="utf-8"), "print('hi')\n")
            self.assertEqual(list(result.run_argv)[0], "/usr/bin/python3")
            self.assertEqual(list(result.run_argv)[1], str(result.artifact_path))

    def test_the_work_directory_is_created(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory) / "nested" / "work"
            result = compile_submission("python", "x = 1\n", work)

            self.assertTrue(result.ok)
            self.assertTrue(work.is_dir())

    def test_a_language_this_checker_does_not_handle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission("ruby", "puts 'hi'", Path(directory))

        self.assertFalse(result.ok)
        self.assertIn("ruby", result.compiler_message)

    def test_an_empty_submission_still_compiles(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission("python", "", Path(directory))

        self.assertTrue(result.ok)


class CppCompileTests(unittest.TestCase):
    def setUp(self) -> None:
        require_cpp()

    def test_cpp_is_built_into_one_binary_that_runs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission("cpp", ECHO_INPUT_CPP, Path(directory))

            self.assertTrue(result.ok, result.compiler_message)
            self.assertEqual(result.artifact_path.name, PROGRAM_NAME)
            self.assertEqual(list(result.run_argv), [str(result.artifact_path)])

            finished = subprocess.run(
                list(result.run_argv),
                input="hello\n",
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )

            self.assertEqual(finished.stdout.strip(), "hello")

    def test_cpp_that_does_not_compile_carries_the_compiler_message(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission("cpp", "int main() { no such thing }\n", Path(directory))

        self.assertFalse(result.ok)
        self.assertIn(CPP_SOURCE_NAME, result.compiler_message)
        self.assertIn("error", result.compiler_message.lower())

    def test_a_grader_and_a_submission_become_one_program(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / "package" / "grader"
            package.mkdir(parents=True)
            (package / "grader.cpp").write_text(STUB_GRADER, encoding="utf-8")
            (package / "combo.h").write_text(COMBO_HEADER, encoding="utf-8")
            work = Path(directory) / "work"
            result = compile_submission(
                "cpp",
                STUB_SUBMISSION,
                work,
                grader=GraderSpec(
                    language="cpp",
                    sources=(package / "grader.cpp",),
                    headers=(package / "combo.h",),
                    submission_file_name="combo.cpp",
                ),
            )

            self.assertTrue(result.ok, result.compiler_message)
            # The submission is saved under the name the grader includes.
            self.assertTrue((work / "combo.cpp").is_file())
            self.assertTrue((work / "grader.cpp").is_file())
            self.assertTrue((work / "combo.h").is_file())

            finished = subprocess.run(
                list(result.run_argv), capture_output=True, text=True, timeout=10, check=False
            )

            self.assertEqual(finished.stdout.strip(), "Accepted: 3")

    def test_an_interactive_problem_takes_cpp_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / "grader"
            package.mkdir(parents=True)
            (package / "grader.cpp").write_text(STUB_GRADER, encoding="utf-8")
            result = compile_submission(
                "python",
                "print('hi')\n",
                Path(directory) / "work",
                grader=GraderSpec(
                    language="cpp",
                    sources=(package / "grader.cpp",),
                    headers=(),
                    submission_file_name="combo.cpp",
                ),
            )

        self.assertFalse(result.ok)
        self.assertIn("C++", result.compiler_message)


if __name__ == "__main__":
    unittest.main()
