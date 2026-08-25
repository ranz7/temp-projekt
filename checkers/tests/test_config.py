"""Configuration comes from the environment and nowhere else."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest import mock

from common.config import ConfigError, OioioiConfig, WorkerConfig


class WorkerConfigTests(unittest.TestCase):
    def test_defaults_fill_everything_but_the_key(self) -> None:
        with mock.patch.dict(os.environ, {"SERVICE_KEY": "secret"}, clear=True):
            config = WorkerConfig.from_environment(worker_id_prefix="bwrap")

        self.assertEqual(config.app_url, "http://127.0.0.1:3000")
        self.assertEqual(config.problem_packages_path, Path("/problems"))
        self.assertEqual(config.poll_seconds, 1.0)
        self.assertEqual(config.heartbeat_seconds, 20.0)
        self.assertEqual(config.scratch_path, Path("/tmp/online-judge"))
        self.assertEqual(config.health_port, 8080)
        self.assertEqual(config.redis_stream, "oj.submissions")
        self.assertTrue(config.worker_id.startswith("bwrap-"))

    def test_service_key_is_required(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ConfigError):
                WorkerConfig.from_environment(worker_id_prefix="cpp")

    def test_environment_wins_over_defaults(self) -> None:
        given = {
            "SERVICE_KEY": "secret",
            "APP_URL": "http://app:3000/",
            "WORKER_ID": "bwrap-7",
            "PROBLEM_PACKAGES_PATH": "/mnt/problems",
            "CHECKER_POLL_SECONDS": "0.5",
            "CHECKER_HEARTBEAT_SECONDS": "5",
            "CHECKER_SCRATCH_PATH": "/scratch",
            "CHECKER_HEALTH_PORT": "9000",
            "REDIS_URL": "redis://cache:6379",
            "REDIS_STREAM": "other.stream",
        }

        with mock.patch.dict(os.environ, given, clear=True):
            config = WorkerConfig.from_environment(worker_id_prefix="bwrap")

        self.assertEqual(config.app_url, "http://app:3000")
        self.assertEqual(config.worker_id, "bwrap-7")
        self.assertEqual(config.problem_packages_path, Path("/mnt/problems"))
        self.assertEqual(config.poll_seconds, 0.5)
        self.assertEqual(config.health_port, 9000)
        self.assertEqual(config.redis_stream, "other.stream")

    def test_a_broken_number_is_refused(self) -> None:
        with mock.patch.dict(
            os.environ, {"SERVICE_KEY": "secret", "CHECKER_POLL_SECONDS": "soon"}, clear=True
        ):
            with self.assertRaises(ConfigError):
                WorkerConfig.from_environment(worker_id_prefix="bwrap")


class OioioiConfigTests(unittest.TestCase):
    def test_missing_settings_are_refused(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ConfigError):
                OioioiConfig.from_environment()

    def test_defaults(self) -> None:
        given = {
            "OIOIOI_URL": "http://oioioi/",
            "OIOIOI_TOKEN": "token",
            "OIOIOI_CONTEST_ID": "contest",
        }

        with mock.patch.dict(os.environ, given, clear=True):
            settings = OioioiConfig.from_environment()

        self.assertEqual(settings.url, "http://oioioi")
        self.assertEqual(settings.poll_seconds, 2.0)
        self.assertEqual(settings.request_timeout_seconds, 10.0)


if __name__ == "__main__":
    unittest.main()
