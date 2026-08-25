"""
The compile step, ported from the reference judge (`tests/test_compile.py`).

Python is only staged, but the step still has to produce a runnable command and to
refuse a language this checker does not handle.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from bwrap.compile import PYTHON_SOURCE_NAME, compile_submission


class CompileTests(unittest.TestCase):
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
            result = compile_submission("cpp", "int main(){}", Path(directory))

        self.assertFalse(result.ok)
        self.assertIn("cpp", result.compiler_message)

    def test_an_empty_submission_still_compiles(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = compile_submission("python", "", Path(directory))

        self.assertTrue(result.ok)


if __name__ == "__main__":
    unittest.main()
