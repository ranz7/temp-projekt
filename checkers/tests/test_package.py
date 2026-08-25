"""
Reading a problem from this machine's own disk: its limits, its kind, its checker,
its grader and its tests.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from bwrap.package import (
    PackageError,
    hidden_test_path,
    list_test_stems,
    load_package,
    package_root,
    read_problem_json,
)

from .test_judge_fixtures import (
    PROBLEMS_PATH,
    SHIPPED_PACKAGE,
    write_interactive_package,
    write_package,
)


class LoadPackageTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.addCleanup(self._directory.cleanup)

    def test_samples_come_first_and_are_worth_nothing(self) -> None:
        write_package(
            self.root,
            "fixture",
            samples=[("01", "1\n", "1\n")],
            hidden=[("01", "2\n", "2\n"), ("02", "3\n", "3\n")],
        )
        package = load_package(self.root, "fixture")

        self.assertEqual([test.ordinal for test in package.tests], [1, 2, 3])
        self.assertEqual(
            [test.visibility for test in package.tests], ["public", "hidden", "hidden"]
        )
        self.assertEqual([test.points for test in package.tests], [0.0, 1.0, 1.0])
        self.assertEqual(package.hidden_points, 2)
        self.assertEqual(package.kind, "stdio")
        self.assertIsNone(package.grader)

    def test_the_limits_come_from_the_package(self) -> None:
        write_package(
            self.root,
            "fixture",
            problem={"limits": {"timeLimitMs": 1500, "memoryLimitMb": 64}},
            samples=[("01", "1\n", "1\n")],
        )
        package = load_package(self.root, "fixture")

        self.assertEqual(package.time_limit_ms, 1500)
        self.assertEqual(package.memory_limit_mb, 64)

    def test_a_custom_checker_is_found_inside_the_package(self) -> None:
        directory = write_package(
            self.root,
            "fixture",
            problem={"checker": {"type": "custom", "path": "checker/checker.py"}},
            samples=[("01", "1\n", "1\n")],
        )
        (directory / "checker").mkdir()
        (directory / "checker" / "checker.py").write_text("print(1)\n", encoding="utf-8")
        package = load_package(self.root, "fixture")

        self.assertEqual(package.checker_type, "custom")
        self.assertEqual(package.checker_path.name, "checker.py")

    def test_a_custom_checker_that_is_not_there_is_refused(self) -> None:
        write_package(
            self.root,
            "fixture",
            problem={"checker": {"type": "custom", "path": "checker/checker.py"}},
            samples=[("01", "1\n", "1\n")],
        )

        with self.assertRaises(PackageError):
            load_package(self.root, "fixture")

    def test_an_interactive_package_names_its_grader_and_has_no_expected_output(self) -> None:
        write_interactive_package(
            self.root,
            "stub",
            grader_source="int main() { return 0; }\n",
            samples=[("01", "ABXY\n", None)],
            hidden=[("01", "AB\n", None)],
        )
        package = load_package(self.root, "stub")

        self.assertTrue(package.is_interactive)
        self.assertEqual(package.grader.submission_file_name, "combo.cpp")
        self.assertEqual([source.name for source in package.grader.sources], ["grader.cpp"])
        self.assertEqual([header.name for header in package.grader.headers], ["combo.h"])
        self.assertTrue(all(test.expected_path is None for test in package.tests))
        self.assertEqual(package.hidden_points, 1)

    def test_a_package_with_no_test_at_all_is_refused(self) -> None:
        write_package(self.root, "empty")

        with self.assertRaises(PackageError):
            load_package(self.root, "empty")

    def test_a_package_this_worker_does_not_have(self) -> None:
        with self.assertRaises(PackageError):
            load_package(self.root, "not-a-problem")


@unittest.skipUnless(
    (PROBLEMS_PATH / SHIPPED_PACKAGE / "problem.json").is_file(),
    "the shipped problem package is not there",
)
class ShippedPackageTests(unittest.TestCase):
    def test_the_package_is_found(self) -> None:
        self.assertTrue(package_root(PROBLEMS_PATH, SHIPPED_PACKAGE).is_dir())

    def test_the_metadata_names_the_limits(self) -> None:
        problem = read_problem_json(PROBLEMS_PATH, SHIPPED_PACKAGE)

        self.assertEqual(problem["limits"]["timeLimitMs"], 1000)
        self.assertEqual(problem["limits"]["memoryLimitMb"], 64)
        self.assertEqual(problem["checker"]["type"], "token")

    def test_the_shipped_problem_loads_with_one_sample_and_hidden_tests(self) -> None:
        package = load_package(PROBLEMS_PATH, SHIPPED_PACKAGE)

        self.assertEqual(package.kind, "stdio")
        self.assertEqual(package.time_limit_ms, 1000)
        self.assertEqual(package.tests[0].visibility, "public")
        self.assertGreaterEqual(package.hidden_points, 15)

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


if __name__ == "__main__":
    unittest.main()
