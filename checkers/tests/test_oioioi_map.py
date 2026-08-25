"""
The OIOIOI status table, ported from the reference adapter (`tests/test_oioioi_map.py`).
"""

from __future__ import annotations

import unittest

from cpp.oioioi_map import map_status


class MapStatusTests(unittest.TestCase):
    def test_the_whole_table(self) -> None:
        expected = {
            "OK": "accepted",
            "INI_OK": "accepted",
            "WA": "wrong_answer",
            "TLE": "time_limit",
            "MLE": "memory_limit",
            "RE": "runtime_error",
            "RTE": "runtime_error",
            "RV": "runtime_error",
            "CE": "compilation_error",
            "INI_ERR": "wrong_answer",
            "SE": "internal_error",
            "ERR": "internal_error",
        }

        for oioioi_status, ours in expected.items():
            with self.subTest(status=oioioi_status):
                self.assertEqual(map_status(oioioi_status), ours)

    def test_anything_unknown_is_an_internal_error(self) -> None:
        self.assertEqual(map_status("SOMETHING_NEW"), "internal_error")
        self.assertEqual(map_status(None), "internal_error")
        self.assertEqual(map_status(""), "internal_error")

    def test_the_status_is_read_regardless_of_capitals_and_spaces(self) -> None:
        self.assertEqual(map_status(" ok "), "accepted")


if __name__ == "__main__":
    unittest.main()
