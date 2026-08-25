"""One log format for both workers, with the level taken from the environment."""

from __future__ import annotations

import logging
import os


def setup_logging(default_level: str = "INFO") -> None:
    level = (os.environ.get("CHECKER_LOG_LEVEL") or default_level).upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s %(message)s",
    )
