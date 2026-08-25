"""
Per-job scratch directories.

A worker keeps nothing between jobs: everything one submission needs lives under
`CHECKER_SCRATCH_PATH/<worker>/<submissionId>` and goes away when the job ends,
whether it was judged, failed or given back.

The directory is named after the submission rather than the claim, so a worker that
was restarted mid-job finds what its previous life left behind. Only the C++ worker
uses that, to avoid sending the same source to OIOIOI twice.
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


def open_scratch(
    root: Path, worker_name: str, submission_id: str, *, reuse: bool
) -> ScratchDirectory:
    """Create the job's directory. `reuse=False` wipes whatever a crash left there."""
    safe = "".join(
        character for character in submission_id if character.isalnum() or character in "-_"
    )
    path = Path(root) / worker_name / (safe or "job")

    if path.exists() and not reuse:
        shutil.rmtree(path, ignore_errors=True)

    path.mkdir(parents=True, exist_ok=True)
    return ScratchDirectory(path=path)


def clear_scratch_root(root: Path, worker_name: str) -> None:
    """Drop every leftover directory. Used at start-up and at shutdown."""
    shutil.rmtree(Path(root) / worker_name, ignore_errors=True)
