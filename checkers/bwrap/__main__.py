"""Entry point of the sandboxed Python checker: `python -m bwrap`."""

from __future__ import annotations

import logging
import sys

from common.config import ConfigError, WorkerConfig
from common.logging_setup import setup_logging
from common.worker import Worker

from .judge import SandboxedPythonJudge
from .spawn import bwrap_path, resolve_sandbox_mode

logger = logging.getLogger("bwrap")


def main() -> int:
    setup_logging()

    try:
        config = WorkerConfig.from_environment(worker_id_prefix="bwrap")
    except ConfigError as error:
        logger.error("The checker is not configured: %s", error)
        return 2

    try:
        mode = resolve_sandbox_mode()
    except ValueError as error:
        logger.error("%s", error)
        return 2

    if mode == "none":
        logger.warning(
            "JUDGE_SANDBOX=none: submissions run with no sandbox at all. "
            "Only ever do this on a development machine, with code you wrote yourself."
        )
    elif bwrap_path() is None:
        logger.error(
            "bubblewrap is not installed and JUDGE_SANDBOX is not none, so no "
            "submission could be run safely. Install bubblewrap or set BWRAP_PATH."
        )
        return 2

    worker = Worker(config, SandboxedPythonJudge(config))
    worker.install_signal_handlers()
    return worker.run()


if __name__ == "__main__":
    sys.exit(main())
