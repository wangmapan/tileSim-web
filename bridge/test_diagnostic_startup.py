"""Regression tests for deployment-time read-only Bridge diagnostics."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class DiagnosticStartupTests(unittest.TestCase):
    def _environment(self, state_root: Path) -> dict[str, str]:
        environment = os.environ.copy()
        environment.update(
            {
                "TILESIM_WEB_STATE_ROOT": str(state_root),
                "TILESIM_ROOT": str(Path(__file__).resolve().parents[1]),
            }
        )
        return environment

    def test_print_commands_do_not_open_a_corrupt_runtime_database(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary)
            runtime = state_root / "runtime"
            runtime.mkdir()
            database = runtime / "agent-harness-optimization.sqlite3"
            database.write_bytes(b"not a sqlite database")

            for argument, pattern in (
                ("--print-source-state-digest", r"^[0-9a-f]{64}$"),
                ("--print-schema-set-revision", r"^sha256:[0-9a-f]{64}$"),
            ):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).with_name("server.py")), argument],
                    cwd=Path(__file__).resolve().parent,
                    env=self._environment(state_root),
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertRegex(result.stdout.strip(), pattern)
                self.assertNotIn("database disk image is malformed", result.stderr)

            self.assertEqual(database.read_bytes(), b"not a sqlite database")

    def test_schema_revision_check_does_not_open_runtime_database(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary)
            runtime = state_root / "runtime"
            runtime.mkdir()
            database = runtime / "agent-harness-optimization.sqlite3"
            database.write_bytes(b"not a sqlite database")
            result = subprocess.run(
                [sys.executable, "check_schema_set_revision.py"],
                cwd=Path(__file__).resolve().parent,
                env=self._environment(state_root),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertRegex(result.stdout.strip(), r"^sha256:[0-9a-f]{64}$")
            self.assertNotIn("database disk image is malformed", result.stderr)
            self.assertEqual(database.read_bytes(), b"not a sqlite database")


if __name__ == "__main__":
    unittest.main()
