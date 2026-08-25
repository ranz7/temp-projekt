"""
Fixtures the judge tests share: problem packages built in a temporary directory.

This module holds no test of its own. It builds packages that look exactly like the
ones a checker machine holds - `problem.json`, `samples/`, `tests/`, and for an
interactive problem a `grader/` - so the judge is exercised the way it really runs.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import unittest
from pathlib import Path
from typing import Iterable, Sequence

CHECKERS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CHECKERS_ROOT.parent
PROBLEMS_PATH = REPO_ROOT / "problems"
SHIPPED_PACKAGE = "cf-4-A"

# The reference interactive problem, read only, kept out of git.
REFERENCE_COMBO = REPO_ROOT / ".ai" / "problems" / "combo" / "combo" / "cpp"

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))

from bwrap.compile import cpp_compiler_path  # noqa: E402

ECHO_INPUT_PYTHON = "import sys\nprint(sys.stdin.read().strip())\n"

COMBO_HEADER = "#include <string>\nstd::string guess_sequence(int N);\nint press(std::string p);\n"

ECHO_INPUT_CPP = """
#include <iostream>
#include <string>
int main() {
  std::string token;
  std::cin >> token;
  std::cout << token << std::endl;
  return 0;
}
"""


def require_wait4() -> None:
    """Process measurement needs a Unix python."""
    if not hasattr(os, "wait4"):
        raise unittest.SkipTest("os.wait4 is missing, so runs cannot be measured here")


def require_cpp() -> None:
    """C++ tests need a compiler; a machine without one skips them."""
    if cpp_compiler_path() is None:
        raise unittest.SkipTest("g++ is not on PATH, so C++ cannot be built here")


def require_reference_grader() -> None:
    if not (REFERENCE_COMBO / "grader.cpp").is_file():
        raise unittest.SkipTest(f"the reference grader is not checked out under {REFERENCE_COMBO}")


def write_test_files(
    directory: Path, cases: Iterable[tuple[str, str, str | None]]
) -> None:
    """Each case is a name, its input, and its expected output or nothing."""
    directory.mkdir(parents=True, exist_ok=True)

    for name, given, expected in cases:
        (directory / f"{name}.in").write_text(given, encoding="utf-8")

        if expected is not None:
            (directory / f"{name}.out").write_text(expected, encoding="utf-8")


def write_package(
    root: Path,
    name: str,
    *,
    problem: dict | None = None,
    samples: Sequence[tuple[str, str, str | None]] = (),
    hidden: Sequence[tuple[str, str, str | None]] = (),
) -> Path:
    """Build one problem package under `root` and return its directory."""
    directory = Path(root) / name
    directory.mkdir(parents=True, exist_ok=True)
    metadata = {
        "id": name,
        "kind": "stdio",
        "limits": {"timeLimitMs": 2000, "memoryLimitMb": 256},
        "checker": {"type": "token"},
    }
    metadata.update(problem or {})
    (directory / "problem.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    write_test_files(directory / "samples", samples)
    write_test_files(directory / "tests", hidden)
    return directory


def write_interactive_package(
    root: Path,
    name: str,
    *,
    grader_source: str,
    header_source: str = COMBO_HEADER,
    submission_file_name: str = "combo.cpp",
    samples: Sequence[tuple[str, str, str | None]] = (),
    hidden: Sequence[tuple[str, str, str | None]] = (),
    problem: dict | None = None,
) -> Path:
    """An interactive package: tests carry an input and no expected output."""
    metadata = {
        "kind": "interactive",
        "languages": ["cpp"],
        "grader": {
            "language": "cpp",
            "sources": ["grader/grader.cpp"],
            "headers": ["grader/combo.h"],
            "submissionFileName": submission_file_name,
        },
    }
    metadata.update(problem or {})
    directory = write_package(root, name, problem=metadata, samples=samples, hidden=hidden)
    grader_directory = directory / "grader"
    grader_directory.mkdir(parents=True, exist_ok=True)
    (grader_directory / "grader.cpp").write_text(grader_source, encoding="utf-8")
    (grader_directory / "combo.h").write_text(header_source, encoding="utf-8")
    return directory


def write_reference_combo_package(
    root: Path,
    name: str = "combo",
    *,
    samples: Sequence[tuple[str, str, str | None]] = (),
    hidden: Sequence[tuple[str, str, str | None]] = (),
) -> Path:
    """The real IOI grader, copied out of the reference checkout."""
    require_reference_grader()
    directory = write_interactive_package(
        root,
        name,
        grader_source=(REFERENCE_COMBO / "grader.cpp").read_text(encoding="utf-8"),
        samples=samples,
        hidden=hidden,
    )
    shutil.copyfile(REFERENCE_COMBO / "combo.h", directory / "grader" / "combo.h")
    return directory


COMBO_SECRET = "ABXYY"

# The known solution: find the first button, then extend the sequence one at a time.
CORRECT_COMBO = """
#include "combo.h"
#include <string>

std::string guess_sequence(int N) {
  std::string found;

  if (press("AB") > 0) {
    found = press("A") > 0 ? "A" : "B";
  } else {
    found = press("X") > 0 ? "X" : "Y";
  }

  std::string others;
  for (char button : std::string("ABXY")) {
    if (button != found[0]) {
      others += button;
    }
  }

  for (int i = 1; i < N - 1; ++i) {
    std::string question = found + others[0] + others[0];
    question += found + others[0] + others[1];
    question += found + others[0] + others[2];
    question += found + others[1];
    int coins = press(question);

    if (coins == i + 2) {
      found += others[0];
    } else if (coins == i + 1) {
      found += others[1];
    } else {
      found += others[2];
    }
  }

  if (N > 1) {
    for (char button : others) {
      if (press(found + button) == N) {
        found += button;
        break;
      }
    }
  }

  return found;
}
"""

WRONG_COMBO = """
#include "combo.h"
#include <string>

std::string guess_sequence(int N) {
  return std::string(N, 'A');
}
"""
