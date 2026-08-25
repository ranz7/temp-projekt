"""
Reading a problem from the worker's own filesystem.

Everything one submission needs is on this machine, under
`PROBLEM_PACKAGES_PATH/<packageDirectory>/`: `problem.json`, the public `samples/`,
the hidden `tests/`, and for an interactive problem the `grader/` it is built with.
Nothing about a test travels over the network.

A public sample is worth nothing; every hidden test carries points. Tests are
numbered samples first, then hidden tests, both in file-name order.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .report import HIDDEN, PUBLIC

TESTS_DIRECTORY = "tests"
SAMPLES_DIRECTORY = "samples"

STDIO = "stdio"
INTERACTIVE = "interactive"

TOKEN_CHECKER = "token"
CUSTOM_CHECKER = "custom"

# Used only when the package does not say otherwise.
DEFAULT_TIME_LIMIT_MS = 1000
DEFAULT_MEMORY_LIMIT_MB = 256
DEFAULT_POINTS_PER_HIDDEN_TEST = 1.0


class PackageError(RuntimeError):
    """The problem package this submission needs is missing or incomplete."""


def package_root(packages_path: Path, package_directory: str) -> Path:
    root = Path(packages_path) / package_directory

    if not root.is_dir():
        raise PackageError(f"the problem package {package_directory} is not on this worker")
    return root


def read_problem_json(packages_path: Path, package_directory: str) -> dict[str, Any]:
    """The package metadata: limits, kind, checker and grader all come from here."""
    path = package_root(packages_path, package_directory) / "problem.json"

    if not path.is_file():
        raise PackageError(f"{package_directory} has no problem.json")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PackageError(f"{package_directory}/problem.json cannot be read: {error}") from error


def resolve_inside(directory: Path, file_name: str) -> Path:
    """A file inside `directory`, refusing anything that points outside it."""
    directory = Path(directory).resolve()
    candidate = (directory / file_name).resolve()

    if candidate != directory and directory not in candidate.parents:
        raise PackageError(f"{file_name!r} points outside {directory}")
    return candidate


def hidden_test_path(packages_path: Path, package_directory: str, file_name: str) -> Path:
    """`PROBLEM_PACKAGES_PATH/<package>/tests/<file>`."""
    tests_directory = package_root(packages_path, package_directory) / TESTS_DIRECTORY

    if not tests_directory.is_dir():
        raise PackageError(f"{package_directory} has no {TESTS_DIRECTORY} directory")

    path = resolve_inside(tests_directory, file_name)

    if not path.is_file():
        raise PackageError(f"{package_directory}/{TESTS_DIRECTORY}/{file_name} is missing")
    return path


def checker_script_path(packages_path: Path, package_directory: str, checker_path: str) -> Path:
    """The problem's own checker, named relative to the package directory."""
    root = package_root(packages_path, package_directory)
    path = resolve_inside(root, checker_path)

    if not path.is_file():
        raise PackageError(f"{package_directory}/{checker_path} is missing")
    return path


def list_test_stems(tests_directory: Path) -> list[str]:
    """Test names that have both an input and an expected output, in order."""
    directory = Path(tests_directory)

    if not directory.is_dir():
        return []

    inputs = {path.stem for path in directory.glob("*.in")}
    outputs = {path.stem for path in directory.glob("*.out")}
    return sorted(inputs & outputs)


def list_input_stems(tests_directory: Path) -> list[str]:
    """Test names that have an input, in order. An interactive test has nothing else."""
    directory = Path(tests_directory)

    if not directory.is_dir():
        return []
    return sorted(path.stem for path in directory.glob("*.in"))


@dataclass(frozen=True)
class GraderSpec:
    """How an interactive problem's grader is built together with the submission."""

    language: str
    sources: tuple[Path, ...]
    headers: tuple[Path, ...]
    submission_file_name: str


@dataclass(frozen=True)
class PackageTest:
    """One test, already found on disk."""

    ordinal: int
    name: str
    visibility: str
    points: float
    input_path: Path
    # An interactive test has no expected output: the grader decides.
    expected_path: Path | None = None

    @property
    def is_hidden(self) -> bool:
        return self.visibility == HIDDEN


@dataclass(frozen=True)
class ProblemPackage:
    """One problem, as this machine holds it."""

    directory: str
    root: Path
    kind: str
    time_limit_ms: int
    memory_limit_mb: int
    checker_type: str
    checker_path: Path | None = None
    grader: GraderSpec | None = None
    languages: tuple[str, ...] = ()
    tests: list[PackageTest] = field(default_factory=list)

    @property
    def is_interactive(self) -> bool:
        return self.kind == INTERACTIVE

    @property
    def hidden_points(self) -> float:
        """The maximum score: samples are worth nothing."""
        return sum(test.points for test in self.tests if test.is_hidden)


def _read_limits(problem: dict[str, Any]) -> tuple[int, int]:
    limits = problem.get("limits") or {}

    try:
        time_limit_ms = int(limits.get("timeLimitMs") or DEFAULT_TIME_LIMIT_MS)
        memory_limit_mb = int(limits.get("memoryLimitMb") or DEFAULT_MEMORY_LIMIT_MB)
    except (TypeError, ValueError) as error:
        raise PackageError(f"the limits cannot be read: {error}") from error

    return max(1, time_limit_ms), max(1, memory_limit_mb)


def _read_checker(root: Path, problem: dict[str, Any]) -> tuple[str, Path | None]:
    checker = problem.get("checker") or {}
    checker_type = str(checker.get("type") or TOKEN_CHECKER).strip().lower()

    if checker_type != CUSTOM_CHECKER:
        return TOKEN_CHECKER, None

    named = checker.get("path") or checker.get("script")

    if not named:
        raise PackageError("the problem asks for a custom checker but names no script")

    path = resolve_inside(root, str(named))

    if not path.is_file():
        raise PackageError(f"the problem checker {named} is not on this worker")
    return CUSTOM_CHECKER, path


def _read_grader(root: Path, problem: dict[str, Any]) -> GraderSpec:
    grader = problem.get("grader") or {}
    sources = [str(name) for name in grader.get("sources") or []]
    headers = [str(name) for name in grader.get("headers") or []]
    submission_file_name = str(grader.get("submissionFileName") or "").strip()

    if not sources:
        raise PackageError("an interactive problem must name its grader sources")
    if not submission_file_name:
        raise PackageError("an interactive problem must name the file the submission becomes")

    resolved_sources = []
    resolved_headers = []

    for name in sources:
        path = resolve_inside(root, name)

        if not path.is_file():
            raise PackageError(f"the grader source {name} is not on this worker")
        resolved_sources.append(path)

    for name in headers:
        path = resolve_inside(root, name)

        if not path.is_file():
            raise PackageError(f"the grader header {name} is not on this worker")
        resolved_headers.append(path)

    return GraderSpec(
        language=str(grader.get("language") or "cpp").strip().lower(),
        sources=tuple(resolved_sources),
        headers=tuple(resolved_headers),
        submission_file_name=Path(submission_file_name).name,
    )


def _points_per_hidden_test(problem: dict[str, Any]) -> float:
    tests = problem.get("tests") or {}

    try:
        return float(tests.get("points", DEFAULT_POINTS_PER_HIDDEN_TEST))
    except (TypeError, ValueError):
        return DEFAULT_POINTS_PER_HIDDEN_TEST


def _collect_tests(root: Path, *, interactive: bool, points: float) -> list[PackageTest]:
    """Samples first, then the hidden tests, numbered from one."""
    collected: list[PackageTest] = []
    ordinal = 0

    for visibility, directory in ((PUBLIC, SAMPLES_DIRECTORY), (HIDDEN, TESTS_DIRECTORY)):
        path = root / directory
        stems = list_input_stems(path) if interactive else list_test_stems(path)

        for stem in stems:
            ordinal += 1
            collected.append(
                PackageTest(
                    ordinal=ordinal,
                    name=stem,
                    visibility=visibility,
                    points=0.0 if visibility == PUBLIC else points,
                    input_path=path / f"{stem}.in",
                    expected_path=None if interactive else path / f"{stem}.out",
                )
            )

    if not collected:
        raise PackageError("the problem package holds no test at all")
    return collected


def load_package(packages_path: Path, package_directory: str) -> ProblemPackage:
    """Read one problem package: its limits, its kind, its checker and its tests."""
    root = package_root(packages_path, package_directory)
    problem = read_problem_json(packages_path, package_directory)
    kind = str(problem.get("kind") or STDIO).strip().lower()
    time_limit_ms, memory_limit_mb = _read_limits(problem)
    interactive = kind == INTERACTIVE
    checker_type = TOKEN_CHECKER
    checker_path: Path | None = None
    grader = None

    if interactive:
        # An interactive problem's grader is the only judge of its output.
        grader = _read_grader(root, problem)
    else:
        checker_type, checker_path = _read_checker(root, problem)

    languages = tuple(str(name).strip().lower() for name in problem.get("languages") or [])
    points = _points_per_hidden_test(problem)

    return ProblemPackage(
        directory=package_directory,
        root=root,
        kind=kind,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=memory_limit_mb,
        checker_type=checker_type,
        checker_path=checker_path,
        grader=grader,
        languages=languages,
        tests=_collect_tests(root, interactive=interactive, points=points),
    )
