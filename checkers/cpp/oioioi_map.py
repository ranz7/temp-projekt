"""
Turning an OIOIOI status into one of ours.

Ported from the reference adapter (`sprawdzarka/oioioi_map.py`). Anything this table
does not name, including a system error, is an internal error: the checker will not
guess what happened to somebody's solution.
"""

from __future__ import annotations

from common.contract import (
    ACCEPTED,
    COMPILATION_ERROR,
    INTERNAL_ERROR,
    MEMORY_LIMIT,
    RUNTIME_ERROR,
    TIME_LIMIT,
    WRONG_ANSWER,
)

STATUS_MAP = {
    "OK": ACCEPTED,
    "INI_OK": ACCEPTED,
    "WA": WRONG_ANSWER,
    "TLE": TIME_LIMIT,
    "MLE": MEMORY_LIMIT,
    "RE": RUNTIME_ERROR,
    "RTE": RUNTIME_ERROR,
    "RV": RUNTIME_ERROR,
    "CE": COMPILATION_ERROR,
    # The initial tests failed, which is a wrong answer on the samples.
    "INI_ERR": WRONG_ANSWER,
    "SE": INTERNAL_ERROR,
    "ERR": INTERNAL_ERROR,
}


def map_status(status: str | None) -> str:
    """The submission status a person sees for an OIOIOI verdict."""
    if not status:
        return INTERNAL_ERROR
    return STATUS_MAP.get(str(status).strip().upper(), INTERNAL_ERROR)
