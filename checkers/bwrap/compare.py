"""
Output comparison. Contestant output is never trusted, so it is only ever read.

Ported from the reference judge (`outer/compare.py`).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

CHECKER_TIMEOUT_SECONDS = 10.0

# A checker score this close to one counts as a full score.
FULL_SCORE_EPSILON = 1e-9


def token_compare(expected: str, actual: str) -> bool:
    """Whitespace-insensitive comparison: only the sequence of tokens has to match."""
    return expected.split() == actual.split()


def token_compare_files(expected_path: Path, actual_path: Path) -> bool:
    expected = Path(expected_path).read_text(encoding="utf-8", errors="replace")
    actual = Path(actual_path).read_text(encoding="utf-8", errors="replace")
    return token_compare(expected, actual)


def is_full_score(score: float) -> bool:
    return score >= 1.0 - FULL_SCORE_EPSILON


def run_custom_checker(
    checker_path: Path,
    input_path: Path,
    expected_path: Path,
    actual_path: Path,
    *,
    python_executable: str = "python3",
    timeout_seconds: float = CHECKER_TIMEOUT_SECONDS,
) -> float:
    """Run the problem's own checker; it prints a score between 0 and 1 on stdout."""
    checker_path = Path(checker_path)

    if not checker_path.is_file():
        raise FileNotFoundError(f"the problem names a checker that is not there: {checker_path}")

    process = subprocess.run(
        [
            python_executable,
            str(checker_path),
            str(input_path),
            str(expected_path),
            str(actual_path),
        ],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )

    if process.returncode != 0:
        detail = (process.stderr or process.stdout or "").strip()
        raise RuntimeError(f"the checker exited {process.returncode}: {detail}")

    lines = (process.stdout or "").strip().splitlines()

    if not lines:
        raise RuntimeError("the checker printed nothing")

    try:
        score = float(lines[0].split()[0])
    except (ValueError, IndexError) as error:
        raise RuntimeError(f"the checker printed {lines[0]!r} instead of a score") from error

    return max(0.0, min(1.0, score))
