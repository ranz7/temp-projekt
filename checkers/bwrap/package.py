"""
Finding a problem's files on the worker's own filesystem.

A hidden test's content never travels over HTTP: the job names the files and this
module turns those names into paths under `PROBLEM_PACKAGES_PATH`. A name that tries
to leave the package's tests directory is refused.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

TESTS_DIRECTORY = "tests"


class PackageError(RuntimeError):
    """The problem package this job needs is missing or incomplete."""


def package_root(packages_path: Path, package_directory: str) -> Path:
    root = Path(packages_path) / package_directory

    if not root.is_dir():
        raise PackageError(f"the problem package {package_directory} is not on this worker")
    return root


def read_problem_json(packages_path: Path, package_directory: str) -> dict[str, Any]:
    """The package metadata. Limits still come from the job, never from here."""
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
    """`PROBLEM_PACKAGES_PATH/<package>/tests/<file>`, as the contract says."""
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
