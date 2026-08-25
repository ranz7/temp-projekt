"""
Finding a problem's files, in the spirit of the reference judge's package tests
(`tests/test_package_loader.py`), against the one problem this repository ships.
"""

from __future__ import annotations

import unittest

from bwrap.package import (
    PackageError,
    hidden_test_path,
    list_test_stems,
    package_root,
    read_problem_json,
)

from .helpers import PROBLEMS_PATH, SHIPPED_PACKAGE


@unittest.skipUnless(
    (PROBLEMS_PATH / SHIPPED_PACKAGE).is_dir(), "the shipped problem package is not there"
)
class ShippedPackageTests(unittest.TestCase):
    def test_the_package_is_found(self) -> None:
        root = package_root(PROBLEMS_PATH, SHIPPED_PACKAGE)

        self.assertTrue(root.is_dir())

    def test_the_metadata_names_the_limits(self) -> None:
        problem = read_problem_json(PROBLEMS_PATH, SHIPPED_PACKAGE)

        self.assertEqual(problem["limits"]["timeLimitMs"], 1000)
        self.assertEqual(problem["limits"]["memoryLimitMb"], 64)
        self.assertEqual(problem["checker"]["type"], "token")

    def test_tests_come_in_pairs(self) -> None:
        stems = list_test_stems(PROBLEMS_PATH / SHIPPED_PACKAGE / "tests")

        self.assertIn("01", stems)
        self.assertEqual(stems, sorted(stems))
        self.assertGreaterEqual(len(stems), 15)

    def test_a_hidden_test_is_read_from_the_worker_filesystem(self) -> None:
        path = hidden_test_path(PROBLEMS_PATH, SHIPPED_PACKAGE, "01.in")

        self.assertTrue(path.is_file())
        self.assertTrue(path.read_text(encoding="utf-8").strip().isdigit())

    def test_a_file_name_cannot_leave_the_tests_directory(self) -> None:
        with self.assertRaises(PackageError):
            hidden_test_path(PROBLEMS_PATH, SHIPPED_PACKAGE, "../problem.json")

    def test_a_missing_file_says_so(self) -> None:
        with self.assertRaises(PackageError):
            hidden_test_path(PROBLEMS_PATH, SHIPPED_PACKAGE, "999.in")


class MissingPackageTests(unittest.TestCase):
    def test_a_package_this_worker_does_not_have(self) -> None:
        with self.assertRaises(PackageError):
            package_root(PROBLEMS_PATH, "not-a-problem")

    def test_no_tests_directory_means_no_stems(self) -> None:
        self.assertEqual(list_test_stems(PROBLEMS_PATH / "not-a-problem" / "tests"), [])


if __name__ == "__main__":
    unittest.main()
