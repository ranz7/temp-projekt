"""Entry point of the C++ checker: `python -m cpp`."""

from __future__ import annotations

import logging
import sys

from common.config import ConfigError, OioioiConfig, WorkerConfig
from common.logging_setup import setup_logging
from common.worker import Worker

from .judge import OioioiCppJudge

logger = logging.getLogger("cpp")


def main() -> int:
    setup_logging()

    try:
        config = WorkerConfig.from_environment(worker_id_prefix="cpp")
    except ConfigError as error:
        logger.error("The checker is not configured: %s", error)
        return 2

    try:
        OioioiConfig.from_environment()
    except ConfigError as error:
        # Not fatal on purpose: the worker runs, claims C++ work and gives it straight
        # back, so a submission waits for OIOIOI instead of failing.
        logger.warning(
            "OIOIOI is not configured (%s). C++ submissions will wait in the queue.", error
        )

    worker = Worker(config, OioioiCppJudge(config))
    worker.install_signal_handlers()
    return worker.run()


if __name__ == "__main__":
    sys.exit(main())
