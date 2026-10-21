"""Run the Stage 3A release gate and emit a redacted evidence manifest.

The output path is intentionally caller supplied (or a system temporary file)
so runs, SQLite state and test artifacts never become repository state.  The
command is fail-closed: a missing hosted-smoke record or pending Provider
acceptance produces a NO-GO manifest and exit code 2.
"""

from __future__ import annotations

import argparse
import atexit
import gc
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any

from agent_harness.release_gate import (
    build_release_gate_manifest,
    cli_build_identity,
    matrix_case_ids,
    validate_release_gate_manifest,
    write_release_gate_manifest,
)
from agent_harness.hosted_smoke import run_hosted_smoke


def _suite(*test_classes: type[unittest.TestCase]) -> unittest.TestSuite:
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    for test_class in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(test_class))
    return suite


class _RecordingResult(unittest.TextTestResult):
    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.case_results: dict[str, str] = {}

    @staticmethod
    def _matrix_case(test: unittest.case.TestCase) -> str | None:
        match = re.search(r"test_AH3_F(\d{2})", test.id())
        return f"AH3-F{match.group(1)}" if match else None

    def addSuccess(self, test):  # noqa: N802 - unittest API
        super().addSuccess(test)
        case_id = self._matrix_case(test)
        if case_id:
            self.case_results[case_id] = "pass"

    def addFailure(self, test, err):  # noqa: N802 - unittest API
        super().addFailure(test, err)
        case_id = self._matrix_case(test)
        if case_id:
            self.case_results[case_id] = "fail"

    def addError(self, test, err):  # noqa: N802 - unittest API
        super().addError(test, err)
        case_id = self._matrix_case(test)
        if case_id:
            self.case_results[case_id] = "fail"


class _RecordingRunner(unittest.TextTestRunner):
    resultclass = _RecordingResult


def _close_server_resources(server: Any, *initial_resources: Any) -> None:
    """Stop every queue/store retained by the release-gate process.

    The HTTP tests intentionally swap ``server.agent_harness_store`` for an
    isolated store per test class.  On Windows the original module-level
    SQLite connection can otherwise keep the temporary directory locked even
    after the active test store has been closed.  De-duplicate by object
    identity because a queue owns the same store object it receives.
    """
    queues: list[Any] = []
    stores: list[Any] = []
    for candidate in (
        *initial_resources,
        getattr(server, "agent_harness_queue", None),
        getattr(server, "agent_harness_store", None),
    ):
        if candidate is None:
            continue
        if hasattr(candidate, "stop"):
            if all(candidate is not item for item in queues):
                queues.append(candidate)
        elif hasattr(candidate, "close"):
            if all(candidate is not item for item in stores):
                stores.append(candidate)
    for queue in queues:
        queue_store = getattr(queue, "store", None)
        if queue_store is not None and hasattr(queue_store, "close"):
            if all(queue_store is not item for item in stores):
                stores.append(queue_store)
    for queue in queues:
        try:
            queue.stop()
        except Exception:
            pass
    for store in stores:
        try:
            store.close()
        except Exception:
            pass
    # Release any transient sqlite/thread references before rmtree on Windows.
    gc.collect()


def _load_stage3_tests() -> tuple[type[unittest.TestCase], ...]:
    from test_agent_harness import HarnessHttpGatewayTest, HarnessStoreFaultInjectionTest
    from test_agent_harness_stage3 import Stage3HttpTest
    from test_agent_harness_stage3_matrix import Stage3FaultMatrixTest

    return HarnessStoreFaultInjectionTest, HarnessHttpGatewayTest, Stage3FaultMatrixTest, Stage3HttpTest


def _run_tests(verbosity: int) -> tuple[bool, dict[str, str], dict[str, Any]]:
    test_classes = _load_stage3_tests()
    runner = _RecordingRunner(verbosity=verbosity)
    result = runner.run(_suite(*test_classes))
    case_results = {case_id: result.case_results.get(case_id, "not_run") for case_id in matrix_case_ids()}
    return result.wasSuccessful(), case_results, {
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(getattr(result, "skipped", [])),
    }


def _read_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("JSON evidence must be an object")
    return value


def _command_digest(argv: list[str]) -> str:
    # Keep the command identity, but never include environment values such as
    # Provider endpoints or credentials.
    from agent_harness.contracts import canonical_sha256

    return canonical_sha256({"argv": argv, "suite": "stage3a-release-gate"})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="External JSON manifest path; defaults to a system temporary file.")
    parser.add_argument("--hosted-evidence", help="External redacted hosted-smoke evidence JSON.")
    parser.add_argument("--run-hosted-smoke", action="store_true", help="Run one disposable synthetic hosted smoke on an ephemeral loopback port.")
    parser.add_argument("--tilesim-root", default=os.environ.get("TILESIM_ROOT"))
    parser.add_argument("--tilesim-cli", default=os.environ.get("TILESIM_CLI"))
    parser.add_argument("--deployment-manifest", default=os.environ.get("TILESIM_DEPLOYMENT_MANIFEST"))
    parser.add_argument("--verbosity", type=int, default=1)
    args = parser.parse_args(argv)

    # Importing server creates the durable store.  Point it at a system temp
    # root before import so this review cannot write repository runtime state.
    temp_state = tempfile.TemporaryDirectory(prefix="tilesim-stage3a-gate-")
    atexit.register(temp_state.cleanup)
    # Always override inherited state paths: the gate must remain disposable
    # even when the caller shell is configured for a persistent Bridge.
    os.environ["TILESIM_WEB_STATE_ROOT"] = temp_state.name
    os.environ["TILESIM_AGENT_HARNESS_DB"] = str(Path(temp_state.name) / "agent-harness.sqlite3")
    if args.tilesim_root:
        os.environ["TILESIM_ROOT"] = args.tilesim_root
    if args.tilesim_cli:
        os.environ["TILESIM_CLI"] = args.tilesim_cli
    if args.deployment_manifest:
        os.environ["TILESIM_DEPLOYMENT_MANIFEST"] = args.deployment_manifest

    import server

    # Keep references to the module-level resources.  The test suites replace
    # these globals with isolated stores, so the original store would
    # otherwise survive until interpreter shutdown and lock temp_state.
    initial_queue = getattr(server, "agent_harness_queue", None)
    initial_store = getattr(server, "agent_harness_store", None)

    def close_runtime_resources() -> None:
        _close_server_resources(server, initial_queue, initial_store)

    # Register after TemporaryDirectory.cleanup so this callback runs first
    # (atexit is LIFO) if an assertion or smoke failure aborts the gate.
    atexit.register(close_runtime_resources)

    test_ok, matrix_results, test_summary = _run_tests(args.verbosity)
    backend = server.backend_identity()
    cli = cli_build_identity(args.tilesim_cli or os.environ.get("TILESIM_CLI"), build_revision=backend.get("build_revision"))
    hosted = _read_json(args.hosted_evidence)
    if args.run_hosted_smoke:
        if not args.tilesim_root or not args.tilesim_cli:
            raise SystemExit("--run-hosted-smoke requires --tilesim-root and --tilesim-cli")
        hosted = run_hosted_smoke(
            tilesim_root=args.tilesim_root,
            tilesim_cli=args.tilesim_cli,
            deployment_manifest=args.deployment_manifest,
        )
    manifest = build_release_gate_manifest(
        schema_set_revision=server.SCHEMA_SET_REVISION,
        backend_identity={key: value for key, value in backend.items() if key not in {"tilesim_root", "tilesim_cli", "deployment_manifest"}},
        cli_identity=cli,
        matrix_results=matrix_results if test_ok else {case_id: ("pass" if result == "pass" else "fail") for case_id, result in matrix_results.items()},
        hosted_smoke=hosted,
        command_digest=_command_digest(sys.argv if argv is None else [sys.argv[0], *argv]),
        provider_state="live_acceptance_pending",
        provider_reason="Authenticated live Provider acceptance is intentionally not executed by this review task.",
        evidence_review_state="not_run",
        reviewer_state="independent_review_completed_no_go",
    )
    manifest["test_summary"] = test_summary
    manifest["test_summary"]["test_suite_passed"] = test_ok
    # Recompute after adding the test summary so the digest covers the full
    # manifest that is written and reviewed.
    from agent_harness.contracts import canonical_sha256

    manifest.pop("manifest_digest", None)
    manifest["manifest_digest"] = canonical_sha256(manifest)
    validate_release_gate_manifest(manifest)

    output = Path(args.output) if args.output else Path(tempfile.mkstemp(prefix="tilesim-stage3a-release-gate-", suffix=".json")[1])
    write_release_gate_manifest(output, manifest)
    print(json.dumps({"manifest": str(output), "conclusion": manifest["conclusion"], "test_summary": test_summary}, ensure_ascii=False))
    close_runtime_resources()
    temp_state.cleanup()
    return 0 if manifest["conclusion"] == "GO" else 2


if __name__ == "__main__":
    raise SystemExit(main())
