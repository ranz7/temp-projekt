"""
Output comparison, ported from the reference judge (`tests/test_compare.py`).
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from bwrap.compare import is_full_score, run_custom_checker, token_compare, token_compare_files


class TokenCompareTests(unittest.TestCase):
    def test_whitespace_does_not_matter(self) -> None:
        self.assertTrue(token_compare("a  b\n", "a b"))
        self.assertTrue(token_compare("1\n2\n", "1 2"))
        self.assertTrue(token_compare("YES\n", "  YES  "))

    def test_different_tokens_do_matter(self) -> None:
        self.assertFalse(token_compare("a", "b"))
        self.assertFalse(token_compare("a b", "a b c"))
        self.assertFalse(token_compare("YES", "yes"))

    def test_nothing_matches_nothing(self) -> None:
        self.assertTrue(token_compare("", ""))
        self.assertTrue(token_compare("   \n", ""))

    def test_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            expected = root / "expected.out"
            actual = root / "actual.out"
            expected.write_text("yes\n", encoding="utf-8")
            actual.write_text("yes\n", encoding="utf-8")

            self.assertTrue(token_compare_files(expected, actual))

            actual.write_text("no\n", encoding="utf-8")
            self.assertFalse(token_compare_files(expected, actual))


class CustomCheckerTests(unittest.TestCase):
    def _package(self, root: Path, body: str) -> Path:
        checker = root / "checker.py"
        checker.write_text(body, encoding="utf-8")
        (root / "in.txt").write_text("8\n", encoding="utf-8")
        (root / "expected.txt").write_text("YES\n", encoding="utf-8")
        (root / "actual.txt").write_text("yes\n", encoding="utf-8")
        return checker

    def test_only_a_full_score_passes(self) -> None:
        self.assertTrue(is_full_score(1.0))
        self.assertFalse(is_full_score(0.999))

    def test_a_checker_prints_its_score(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checker = self._package(root, "print(0.5)\n")
            score = run_custom_checker(
                checker, root / "in.txt", root / "expected.txt", root / "actual.txt"
            )

        self.assertEqual(score, 0.5)
        self.assertFalse(is_full_score(score))

    def test_a_score_outside_the_range_is_clamped(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checker = self._package(root, "print(7)\n")
            score = run_custom_checker(
                checker, root / "in.txt", root / "expected.txt", root / "actual.txt"
            )

        self.assertEqual(score, 1.0)

    def test_a_checker_that_says_nothing_is_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checker = self._package(root, "pass\n")

            with self.assertRaises(RuntimeError):
                run_custom_checker(
                    checker, root / "in.txt", root / "expected.txt", root / "actual.txt"
                )


if __name__ == "__main__":
    unittest.main()
