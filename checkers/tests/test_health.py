"""The health endpoint answers while the worker lives."""

from __future__ import annotations

import unittest
import urllib.error
import urllib.request

from common.health import HealthServer


class HealthServerTests(unittest.TestCase):
    def setUp(self) -> None:
        # Port 0 lets the machine pick a free one, so the tests never collide.
        self.server = HealthServer(0, host="127.0.0.1")
        self.server.start()
        self.base = f"http://127.0.0.1:{self.server.port}"

    def tearDown(self) -> None:
        self.server.stop()

    def test_health_answers_two_hundred(self) -> None:
        with urllib.request.urlopen(f"{self.base}/health", timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"ok", response.read())

    def test_anything_else_is_not_found(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as raised:
            urllib.request.urlopen(f"{self.base}/", timeout=5)

        self.assertEqual(raised.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
