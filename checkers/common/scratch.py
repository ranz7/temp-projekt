"""
Per-job scratch directories.

A checker machine keeps nothing between jobs: everything one submission needs lives
under `CHECKER_SCRATCH_PATH/<jobId>` and goes away when the job ends, whether it was
judged or blew up. The whole root is emptied at start-up and again at shutdown, so a
crash leaves nothing behind either.
"""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ScratchDirectory:
    """One job's writable workspace."""

    path: Path

    def remove(self) -> None:
        shutil.rmtree(self.path, ignore_errors=True)


def safe_name(name: str) -> str:
    """A directory name that cannot escape the scratch root."""
    cleaned = "".join(
        character for character in name if character.isalnum() or character in "-_"
    )
    return cleaned or "job"


def open_scratch(root: Path, job_id: str) -> ScratchDirectory:
    """Create the job's own empty directory, wiping whatever was there."""
    path = Path(root) / safe_name(job_id)

    if path.exists():
        shutil.rmtree(path, ignore_errors=True)

    path.mkdir(parents=True, exist_ok=True)
    return ScratchDirectory(path=path)


def clear_scratch_root(root: Path) -> None:
    """Drop every leftover directory. Used at start-up and at shutdown."""
    shutil.rmtree(Path(root), ignore_errors=True)
