"""The environment a checker machine is configured with."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

CHECKERS_ROOT = Path(__file__).resolve().parents[1]

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))

from common.config import CheckerConfig, ConfigError  # noqa: E402
from common.judging import DEFAULT_JUDGE_ENTRY_POINT  # noqa: E402


def with_environment(**variables: str) -> mock._patch_dict:
    return mock.patch.dict("os.environ", {"CHECKER_VERSION": "test", **variables}, clear=True)


class DefaultTests(unittest.TestCase):
    def test_the_defaults_keep_the_service_on_loopback(self) -> None:
        with with_environment():
            config = CheckerConfig.from_environment()

        self.assertEqual(config.bind, "127.0.0.1")
        self.assertEqual(config.port, 8080)
        self.assertEqual(config.capacity, 2)
        self.assertEqual(config.problem_packages_path, Path("/problems"))
        self.assertEqual(config.scratch_path, Path("/tmp/online-judge"))
        self.assertEqual(config.result_ttl_seconds, 900.0)
        self.assertEqual(config.judge_entry_point, DEFAULT_JUDGE_ENTRY_POINT)

    def test_without_a_key_the_service_refuses_calls(self) -> None:
        with with_environment():
            config = CheckerConfig.from_environment()

        self.assertIsNone(config.service_key)
        self.assertFalse(config.accepts_calls)

    def test_a_configured_key_is_accepted(self) -> None:
        with with_environment(SERVICE_KEY=" a-shared-key "):
            config = CheckerConfig.from_environment()

        self.assertEqual(config.service_key, "a-shared-key")
        self.assertTrue(config.accepts_calls)


class OverrideTests(unittest.TestCase):
    def test_the_environment_wins(self) -> None:
        with with_environment(
            SERVICE_KEY="key",
            CHECKER_BIND="0.0.0.0",
            CHECKER_PORT="9001",
            CHECKER_CAPACITY="4",
            PROBLEM_PACKAGES_PATH="/srv/problems",
            CHECKER_SCRATCH_PATH="/srv/scratch",
            CHECKER_RESULT_TTL_SECONDS="1200",
            CHECKER_JUDGE="tests.test_api_jobs:stub_judge",
            CHECKER_VERSION="abc1234",
        ):
            config = CheckerConfig.from_environment()

        self.assertEqual(config.bind, "0.0.0.0")
        self.assertEqual(config.port, 9001)
        self.assertEqual(config.capacity, 4)
        self.assertEqual(config.problem_packages_path, Path("/srv/problems"))
        self.assertEqual(config.scratch_path, Path("/srv/scratch"))
        self.assertEqual(config.result_ttl_seconds, 1200.0)
        self.assertEqual(config.judge_entry_point, "tests.test_api_jobs:stub_judge")
        self.assertEqual(config.version, "abc1234")

    def test_a_nonsense_value_stops_the_service(self) -> None:
        for name, value in (
            ("CHECKER_PORT", "http"),
            ("CHECKER_CAPACITY", "0"),
            ("CHECKER_CAPACITY", "1.5"),
            ("CHECKER_RESULT_TTL_SECONDS", "-1"),
        ):
            with self.subTest(name=name, value=value):
                with with_environment(**{name: value}), self.assertRaises(ConfigError):
                    CheckerConfig.from_environment()


if __name__ == "__main__":
    unittest.main()
