"""
Starting a run, ported from the reference judge (`tests/test_spawn.py`).

The bubblewrap command line is checked as data, so it is right on this machine too;
actually running under bubblewrap is a Linux-only test that skips elsewhere.
"""

from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from bwrap.measure import measure_process_group
from bwrap.spawn import (
    SpawnSpec,
    build_bwrap_argv,
    bwrap_path,
    resolve_sandbox_mode,
    rewrite_argv_for_box,
)

from .helpers import require_wait4


class SandboxModeTests(unittest.TestCase):
    def test_the_sandbox_is_on_unless_it_is_turned_off(self) -> None:
        environment = dict(os.environ)
        environment.pop("JUDGE_SANDBOX", None)

        with mock.patch.dict(os.environ, environment, clear=True):
            self.assertEqual(resolve_sandbox_mode(), "bwrap")

    def test_both_spellings(self) -> None:
        self.assertEqual(resolve_sandbox_mode("none"), "none")
        self.assertEqual(resolve_sandbox_mode("bwrap"), "bwrap")

    def test_anything_else_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            resolve_sandbox_mode("maybe")


class BwrapArgvTests(unittest.TestCase):
    def test_paths_in_the_scratch_directory_are_named_inside_the_box(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory).resolve()
            (work / "main.py").write_text("print(1)\n", encoding="utf-8")
            argv = rewrite_argv_for_box(["/usr/bin/python3", str(work / "main.py")], work)

        self.assertEqual(argv, ["/usr/bin/python3", "/box/main.py"])

    def test_the_sandbox_is_closed_and_the_scratch_directory_is_the_only_writable_place(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory).resolve()
            argv = build_bwrap_argv(
                SpawnSpec(work_dir=work, run_argv=["/usr/bin/python3", str(work / "main.py")]),
                executable="/usr/bin/bwrap",
            )

        self.assertEqual(argv[0], "/usr/bin/bwrap")
        self.assertIn("--unshare-net", argv)
        self.assertIn("--unshare-pid", argv)
        self.assertIn("--clearenv", argv)
        self.assertIn("--die-with-parent", argv)
        self.assertIn("--new-session", argv)
        # Exactly one read-write bind, and it is the job's own directory.
        self.assertEqual(argv.count("--bind"), 1)
        self.assertEqual(argv[argv.index("--bind") + 1], str(work))
        self.assertEqual(argv[argv.index("--bind") + 2], "/box")
        self.assertEqual(argv[-2:], ["/usr/bin/python3", "/box/main.py"])

    def test_the_system_directories_are_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            argv = build_bwrap_argv(
                SpawnSpec(work_dir=Path(directory), run_argv=["/usr/bin/python3", "-c", "pass"]),
                executable="/usr/bin/bwrap",
            )

        mounted = [argv[index + 1] for index, item in enumerate(argv) if item == "--ro-bind"]

        self.assertIn("/usr", mounted)
        self.assertTrue(all(Path(path).exists() for path in mounted))


class RunWithoutSandboxTests(unittest.TestCase):
    """`JUDGE_SANDBOX=none` is what a development machine without bubblewrap uses."""

    def test_a_program_reads_its_input_and_writes_its_output(self) -> None:
        require_wait4()

        from bwrap.spawn import spawn_sandboxed

        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            source = work / "echo.py"
            source.write_text("import sys; print(sys.stdin.read().strip())\n", encoding="utf-8")
            given = work / "in.txt"
            given.write_text("hello\n", encoding="utf-8")
            produced = work / "out.txt"

            started = time.monotonic()
            process = spawn_sandboxed(
                SpawnSpec(
                    work_dir=work,
                    run_argv=[sys.executable, str(source)],
                    stdin_path=given,
                    stdout_path=produced,
                    stderr_path=work / "err.txt",
                    sandbox="none",
                )
            )
            sample = measure_process_group(process.pid, start_monotonic=started)
            process.returncode = sample.exit_code

            self.assertEqual(sample.exit_code, 0)
            self.assertEqual(produced.read_text(encoding="utf-8").strip(), "hello")
            self.assertGreaterEqual(sample.memory_kb, 0)


@unittest.skipIf(bwrap_path() is None, "bubblewrap is not installed on this machine")
class RunInsideTheSandboxTests(unittest.TestCase):
    def test_the_program_cannot_reach_the_network(self) -> None:
        require_wait4()

        from bwrap.spawn import spawn_sandboxed

        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            source = work / "net.py"
            source.write_text(
                "import socket\n"
                "try:\n"
                "    socket.create_connection(('127.0.0.1', 80), timeout=1)\n"
                "    print('reached')\n"
                "except OSError:\n"
                "    print('blocked')\n",
                encoding="utf-8",
            )
            produced = work / "out.txt"
            started = time.monotonic()
            process = spawn_sandboxed(
                SpawnSpec(
                    work_dir=work,
                    # The interpreter running the tests: an image need not have
                    # one at /usr/bin/python3, and the run has to really start.
                    run_argv=[sys.executable, str(source)],
                    stdout_path=produced,
                    sandbox="bwrap",
                )
            )
            sample = measure_process_group(process.pid, start_monotonic=started)
            process.returncode = sample.exit_code

            self.assertEqual(produced.read_text(encoding="utf-8").strip(), "blocked")


if __name__ == "__main__":
    unittest.main()
