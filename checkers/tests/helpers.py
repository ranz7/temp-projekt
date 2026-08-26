"""
Shared test helpers.

The process-based tests follow the reference judge's rule: assert qualitative bounds,
never an exact millisecond, and skip cleanly when the machine cannot run them.
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid
from pathlib import Path

CHECKERS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CHECKERS_ROOT.parent
PROBLEMS_PATH = REPO_ROOT / "problems"
SHIPPED_PACKAGE = "cf-4-A"

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))


def require_wait4() -> None:
    """Process measurement needs a Unix python."""
    if not hasattr(os, "wait4"):
        raise unittest.SkipTest("os.wait4 is missing, so runs cannot be measured here")


def new_uuid() -> str:
    return str(uuid.uuid4())
