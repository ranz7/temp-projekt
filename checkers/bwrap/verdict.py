"""
The verdict of one run.

`classify_run` decides what one run used, before its output is looked at. The order is
a rule of the specification and this function is the only place it is written down:
memory over the limit first, then time over the limit or killed by the wall clock,
then a non-zero exit or a signal, and only then the output, which the caller judges
when this returns `RUN_FINISHED`.

`read_grader_verdict` is the other half, for an interactive problem: the verdict is
whatever the problem's own grader printed, and nothing is compared against a file.
"""

from __future__ import annotations

from dataclasses import dataclass

from .limits import RunLimits
from .report import MEMORY_LIMIT, PASSED, RUNTIME_ERROR, TIME_LIMIT, WRONG_ANSWER

# The process ended cleanly and within its limits, so its output decides.
RUN_FINISHED = "finished"

# What the grader is asked to print, exactly as the reference grader spells it.
ACCEPTED_PREFIX = "Accepted:"
WRONG_ANSWER_PREFIX = "Wrong Answer:"

# The grader said something this judge does not understand, so nobody is failed for it.
GRADER_UNRECOGNISED = "unrecognised"
# The program ended without the grader saying anything at all.
GRADER_SILENT = "silent"


def classify_run(
    *,
    exit_code: int | None,
    cpu_ms: int,
    memory_kb: int,
    limits: RunLimits,
    killed_by_wall: bool = False,
    killed_by_oom: bool = False,
    signal_number: int | None = None,
) -> str:
    """Map what one run used to a verdict, or to `RUN_FINISHED`."""
    if killed_by_oom:
        return MEMORY_LIMIT
    if memory_kb > limits.memory_limit_kb:
        return MEMORY_LIMIT
    if killed_by_wall or cpu_ms > limits.time_limit_ms:
        return TIME_LIMIT
    if exit_code is None or exit_code != 0 or signal_number:
        return RUNTIME_ERROR
    return RUN_FINISHED


@dataclass(frozen=True)
class GraderVerdict:
    """What an interactive problem's grader said about one run."""

    verdict: str
    message: str | None = None
    presses: int | None = None


def _parse_presses(rest: str) -> int | None:
    try:
        return int(rest.strip().split()[0])
    except (IndexError, ValueError):
        return None


def read_grader_verdict(output: str) -> GraderVerdict:
    """Read the grader's own words out of what the program printed.

    The grader prints its verdict and stops, so its line is the last recognised one.
    A solution that prints `Accepted:` itself cannot help itself: the grader's own line
    comes after it and is the one that counts.
    """
    lines = [line.strip() for line in (output or "").splitlines()]

    for line in reversed(lines):
        if line.startswith(ACCEPTED_PREFIX):
            presses = _parse_presses(line[len(ACCEPTED_PREFIX) :])

            if presses is None:
                return GraderVerdict(
                    verdict=GRADER_UNRECOGNISED,
                    message=f"the grader said {line!r}, which names no number of presses",
                )
            return GraderVerdict(verdict=PASSED, message=None, presses=presses)

        if line.startswith(WRONG_ANSWER_PREFIX):
            reason = line[len(WRONG_ANSWER_PREFIX) :].strip()
            return GraderVerdict(
                verdict=WRONG_ANSWER,
                message=f"wrong answer: {reason}" if reason else "wrong answer",
            )

    if not any(lines):
        # Nothing was printed at all: the program stopped before the grader could speak.
        return GraderVerdict(
            verdict=GRADER_SILENT,
            message="the program ended without the grader reporting anything",
        )

    said = next(line for line in reversed(lines) if line)
    return GraderVerdict(
        verdict=GRADER_UNRECOGNISED,
        message=f"the grader printed {said!r}, which this checker does not recognise",
    )
