"""
cgroup v2 leaves, ported from the reference judge (`tests/test_cgroup.py`).

The live tests need a writable cgroup v2 tree, which a container gets and a laptop
usually does not. Without one they skip with the reason; they never fail.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import unittest
import uuid
from pathlib import Path

from bwrap.cgroup import (
    add_process,
    cgroup_root,
    create_leaf,
    kill_all,
    memory_peak_kb,
    remove_leaf,
)


def cgroup_problem() -> str | None:
    """None when a leaf can be created and dropped, otherwise the reason it cannot."""
    root = cgroup_root()

    if root is None:
        return "there is no cgroup v2 hierarchy on this machine"
    try:
        leaf = create_leaf(f"probe-{uuid.uuid4().hex[:8]}", memory_limit_mb=8, pids_max=16)
        remove_leaf(leaf)
        return None
    except Exception as error:
        return f"the cgroup tree is not writable: {error}"


CGROUP_PROBLEM = cgroup_problem()


def require_cgroup() -> None:
    if CGROUP_PROBLEM is not None:
        raise unittest.SkipTest(
            f"{CGROUP_PROBLEM}. Run these in the checker container, which has one."
        )


class CgroupProbeTests(unittest.TestCase):
    """Always runs: it only reports what this machine can do."""

    def test_the_root_is_a_directory_or_nothing(self) -> None:
        root = cgroup_root()

        self.assertTrue(root is None or isinstance(root, Path))

        if root is not None:
            self.assertTrue((root / "cgroup.controllers").is_file())

    def test_the_probe_says_why_the_live_tests_skip(self) -> None:
        self.assertTrue(CGROUP_PROBLEM is None or len(CGROUP_PROBLEM) > 0)


@unittest.skipUnless(hasattr(os, "wait4"), "process tests need a Unix python")
class CgroupLiveTests(unittest.TestCase):
    def test_a_leaf_carries_the_limits(self) -> None:
        require_cgroup()
        name = f"test-{uuid.uuid4().hex[:8]}"
        leaf = create_leaf(name, memory_limit_mb=16, pids_max=32)

        try:
            self.assertEqual(leaf.path.name, name)
            self.assertEqual(int((leaf.path / "memory.max").read_text().strip()), 16 * 1024 * 1024)
            self.assertEqual(int((leaf.path / "pids.max").read_text().strip()), 32)
        finally:
            remove_leaf(leaf)

        self.assertFalse(leaf.path.exists())

    def test_a_process_joins_the_leaf_and_can_be_killed(self) -> None:
        require_cgroup()
        leaf = create_leaf(f"test-{uuid.uuid4().hex[:8]}", memory_limit_mb=64, pids_max=64)
        process = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True
        )

        try:
            add_process(leaf, process.pid)
            self.assertIn(str(process.pid), (leaf.path / "cgroup.procs").read_text())
            kill_all(leaf)

            for _attempt in range(50):
                if process.poll() is not None:
                    break
                time.sleep(0.02)

            self.assertIsNotNone(process.poll())
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=2)
            remove_leaf(leaf)

    def test_the_peak_memory_can_be_read_back(self) -> None:
        require_cgroup()
        leaf = create_leaf(f"test-{uuid.uuid4().hex[:8]}", memory_limit_mb=64)

        try:
            peak = memory_peak_kb(leaf)

            self.assertIsNotNone(peak)
            self.assertGreaterEqual(peak, 0)
        finally:
            remove_leaf(leaf)


if __name__ == "__main__":
    unittest.main()
