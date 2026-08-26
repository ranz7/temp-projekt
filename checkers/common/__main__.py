"""Entry point of the checker service: `python -m common` or `oj-checker`."""

from __future__ import annotations

import logging
import sys

from .config import CheckerConfig, ConfigError
from .logging_setup import setup_logging
from .service import serve

logger = logging.getLogger("checker")


def main() -> int:
    setup_logging()

    try:
        config = CheckerConfig.from_environment()
    except ConfigError as error:
        logger.error("The checker is not configured: %s", error)
        return 2

    return serve(config)


if __name__ == "__main__":
    sys.exit(main())
