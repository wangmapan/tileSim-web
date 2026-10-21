"""Release-gate contract tests for the Stage 3A controlled execution review."""

from __future__ import annotations

import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path

from run_agent_harness_stage3_release_gate import _close_server_resources
from agent_harness.release_gate import (
    MATRIX_CASES,
    RELEASE_GATE_REVISION,
    RELEASE_GATE_SCHEMA_IDENTITY,
    build_release_gate_manifest,
    cli_build_identity,
    matrix_case_ids,
    validate_release_gate_manifest,
)


class Stage3ReleaseGateTest(unittest.TestCase):
    def test_runtime_cleanup_closes_original_and_replaced_resources(self) -> None:
        class FakeQueue:
            def __init__(self, store):
                self.store = store
                self.stop_calls = 0

            def stop(self):
                self.stop_calls += 1

        class FakeStore:
            def __init__(self):
                self.close_calls = 0

            def close(self):
                self.close_calls += 1

        original_store = FakeStore()
        replaced_store = FakeStore()
        original_queue = FakeQueue(original_store)
        replaced_queue = FakeQueue(replaced_store)
        server = SimpleNamespace(agent_harness_queue=replaced_queue, agent_harness_store=replaced_store)

        _close_server_resources(server, original_queue, original_store)

        self.assertEqual(original_queue.stop_calls, 1)
        self.assertEqual(replaced_queue.stop_calls, 1)
        self.assertEqual(original_store.close_calls, 1)
        self.assertEqual(replaced_store.close_calls, 1)

    def test_matrix_has_exactly_26_stable_cases_and_required_evidence(self) -> None:
        self.assertEqual(matrix_case_ids(), tuple(f"AH3-F{index:02d}" for index in range(1, 27)))
        self.assertEqual(len(MATRIX_CASES), 26)
        required = {
            "case_id",
            "title",
            "test",
            "result",
            "error",
            "operation_state",
            "event_sequence",
            "ledger",
            "run_count",
            "tilesim_cli_invocation_count",
            "manifest_artifact_count",
            "recovery_state",
            "duplicate_side_effects",
            "forbidden_payload_residual",
            "http",
        }
        for case in MATRIX_CASES:
            self.assertEqual(set(case) - required, set(), case["case_id"])
            self.assertEqual(set(case["error"]), {"code", "field_path", "retryable"})
            self.assertIn(case["http"]["status"], {"not_applicable", 200, 400, 403, 409, 422, 500, 502, 503, 504})
            self.assertTrue(case["field_path"] if "field_path" in case else case["error"]["field_path"])

    def test_pending_provider_cannot_produce_go(self) -> None:
        manifest = build_release_gate_manifest(
            schema_set_revision="sha256:" + "a" * 64,
            backend_identity={"source_revision": "review", "build_revision": "review"},
            cli_identity={"status": "not_run", "reason": "unit test"},
            matrix_results={case_id: "pass" for case_id in matrix_case_ids()},
            hosted_smoke={
                "run_id": "run-review",
                "event_sequence": [1, 2, 3, 4, 5],
                "provenance": "synthetic_trace",
                "claim_scope": "exploratory",
                "requested_fidelity": "des",
                "resolved_fidelity": "des",
                "artifacts": [],
            },
            provider_state="live_acceptance_pending",
            evidence_review_state="not_run",
        )
        validate_release_gate_manifest(manifest)
        self.assertEqual(manifest["schema_identity"], RELEASE_GATE_SCHEMA_IDENTITY)
        self.assertEqual(manifest["release_gate_revision"], RELEASE_GATE_REVISION)
        self.assertEqual(manifest["conclusion"], "NO-GO")

    def test_hosted_smoke_requires_run_bound_artifact_identity(self) -> None:
        with self.assertRaises(ValueError):
            build_release_gate_manifest(
                schema_set_revision="sha256:" + "b" * 64,
                backend_identity={},
                cli_identity={},
                matrix_results={case_id: "pass" for case_id in matrix_case_ids()},
                hosted_smoke={
                    "run_id": "run-review",
                    "event_sequence": [1],
                    "provenance": "synthetic_trace",
                    "claim_scope": "exploratory",
                    "requested_fidelity": "des",
                    "resolved_fidelity": "des",
                    "artifacts": [{"artifact_id": "metrics", "schema_identity": "x", "sha256": "a", "bytes": "1", "run_id": "another-run"}],
                },
            )

    def test_cli_identity_is_bounded_and_lossless_for_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "TileSimCLI"
            path.write_bytes(b"synthetic-build-identity")
            identity = cli_build_identity(path, build_revision="build-revision")
        self.assertEqual(identity["status"], "observed")
        self.assertEqual(identity["bytes"], str(len(b"synthetic-build-identity")))
        self.assertEqual(identity["build_revision"], "build-revision")
        self.assertEqual(len(identity["sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
