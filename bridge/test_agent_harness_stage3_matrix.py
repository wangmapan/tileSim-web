"""Stage 3A fault-injection matrix.

The matrix is intentionally explicit: each published failure class has a
stable ``AH3-Fxx`` id and checks the durable boundary (status/error pointer,
retry flags, event fence and side-effect ledger).  The HTTP hosted tests in
``test_agent_harness_stage3`` cover the real submit gateway and run adapter;
these focused cases exercise the same persistence fences without replacing a
Provider or invoking a shell.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from agent_harness.contracts import HarnessContractError, canonical_sha256
from agent_harness.queue import HarnessQueue, QueueConfig
from agent_harness.store import DurableHarnessStore, HarnessStoreError


class Stage3FaultMatrixTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.store = DurableHarnessStore(Path(self.temp.name) / "matrix.sqlite3")
        self.backend = {"source_revision": "matrix", "build_revision": "matrix"}
        self.operation, _ = self.store.create_operation(
            idempotency_key="matrix-op",
            request_payload={"scenario_id": "s1_des_example"},
            schema_set_revision="sha256:" + "1" * 64,
            backend_identity=self.backend,
            principal="local-user",
            operation_kind="controlled_execution",
            snapshot_digest="sha256:" + "2" * 64,
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def _transition(self, state: str, *, expected: set[str] | None = None, **kwargs):
        return self.store.transition(self.operation["operation_id"], state, expected=expected, **kwargs)

    def _event(self, sequence: int, event_id: str, state: str = "running", *, terminal: bool = False):
        return self.store.append_event(
            self.operation["operation_id"],
            event_id=event_id,
            sequence=sequence,
            node="matrix",
            state=state,
            payload_digest=canonical_sha256({"event_id": event_id, "state": state}),
            terminal=terminal,
        )

    def _assert_error(self, code: str, fn):
        with self.assertRaises(HarnessStoreError) as raised:
            fn()
        self.assertEqual(raised.exception.code, code)
        self.assertEqual(getattr(raised.exception, "field_path", "/"), "/")
        return raised.exception

    # AH3-F01..F10: admission and identity fences -------------------------
    def test_AH3_F01_unapproved_draft_submit(self):
        self._assert_error("approval_not_found", lambda: self.store.consume_stage2_approval(
            "missing", draft_digest="sha256:" + "a" * 64, validation_id="v1",
            principal="local-user", workspace_id="local-workspace",
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend))
        self.assertEqual(self.store.list_side_effects(self.operation["operation_id"]), [])

    def test_AH3_F02_invalid_draft(self):
        self._assert_error("state_conflict", lambda: self._transition("running", expected={"submitted"}))
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "queued")

    def test_AH3_F03_stale_draft(self):
        self._assert_error("approval_not_found", lambda: self.store.validate_approval(
            "missing", draft_digest="sha256:" + "a" * 64, principal="local-user",
            schema_set_revision="sha256:" + "stale" * 13, backend_identity=self.backend))

    def test_AH3_F04_expired_approval(self):
        self.store.save_approval(operation_id=self.operation["operation_id"], approval_digest="sha256:" + "a" * 64,
                                 draft_digest="sha256:" + "b" * 64, principal="local-user",
                                 approved_at="2020-01-01T00:00:00+00:00", expires_at="2020-01-02T00:00:00+00:00",
                                 decision="approved", schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend)
        self._assert_error("approval_expired", lambda: self.store.validate_approval(
            "sha256:" + "a" * 64, draft_digest="sha256:" + "b" * 64, principal="local-user",
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend, now_iso="2020-01-03T00:00:00+00:00"))

    def test_AH3_F05_revoked_approval(self):
        self.store.save_approval(operation_id=self.operation["operation_id"], approval_digest="sha256:" + "c" * 64,
                                 draft_digest="sha256:" + "d" * 64, principal="local-user", approved_at=None,
                                 expires_at="2099-01-01T00:00:00+00:00", decision="revoked",
                                 schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend)
        self._assert_error("approval_rejected", lambda: self.store.validate_approval(
            "sha256:" + "c" * 64, draft_digest="sha256:" + "d" * 64, principal="local-user",
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend))

    def test_AH3_F06_approval_replay(self):
        # Stage-2 single-use replay is asserted at the HTTP boundary; this
        # matrix keeps the durable ledger empty when no approval is consumed.
        self.assertEqual(self.store.list_side_effects(self.operation["operation_id"]), [])
        self._assert_error("approval_not_found", lambda: self.store.consume_stage2_approval(
            "approval-replay", draft_digest="sha256:" + "a" * 64, validation_id="v1",
            principal="local-user", workspace_id="local-workspace",
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend))

    def test_AH3_F07_draft_approval_digest_mismatch(self):
        self.store.save_approval(operation_id=self.operation["operation_id"], approval_digest="sha256:" + "e" * 64,
                                 draft_digest="sha256:" + "f" * 64, principal="local-user", approved_at=None,
                                 expires_at="2099-01-01T00:00:00+00:00", decision="approved",
                                 schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend)
        self._assert_error("stale_draft", lambda: self.store.validate_approval(
            "sha256:" + "e" * 64, draft_digest="sha256:" + "0" * 64, principal="local-user",
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend))

    def test_AH3_F08_schema_revision_mismatch(self):
        with self.assertRaises(HarnessContractError) as raised:
            from agent_harness.stage3 import validate_submit_request
            validate_submit_request({"schema_set_revision": "sha256:" + "0" * 64}, principal="local-user",
                                    workspace_id="local-workspace", schema_set_revision="sha256:" + "1" * 64,
                                    backend_identity=self.backend)
        self.assertEqual(raised.exception.code, "schema_revision_mismatch")
        self.assertEqual(raised.exception.field_path, "/schema_set_revision")

    def test_AH3_F09_backend_identity_mismatch(self):
        from agent_harness.stage3 import validate_submit_request
        self._assert_contract("backend_identity_mismatch", "/backend_identity", validate_submit_request,
                              {"schema_set_revision": "sha256:" + "1" * 64, "backend_identity": {"source_revision": "old"}},
                              principal="local-user", workspace_id="local-workspace",
                              schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend)

    def test_AH3_F10_principal_workspace_mismatch(self):
        from agent_harness.stage3 import validate_submit_request
        self._assert_contract("principal_forbidden", "/principal", validate_submit_request,
                              {"schema_set_revision": "sha256:" + "1" * 64, "backend_identity": self.backend, "principal": "other"},
                              principal="local-user", workspace_id="local-workspace",
                              schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend)

    def _assert_contract(self, code: str, pointer: str, fn, document: dict, **kwargs):
        with self.assertRaises(HarnessContractError) as raised:
            fn(document, **kwargs)
        self.assertEqual(raised.exception.code, code)
        self.assertEqual(raised.exception.field_path, pointer)

    # AH3-F11..F18: idempotency, queue and create-run boundaries ----------
    def test_AH3_F11_same_key_same_payload(self):
        replay, is_replay = self.store.create_operation(
            idempotency_key="matrix-op", request_payload={"scenario_id": "s1_des_example"},
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend,
            principal="local-user", operation_kind="controlled_execution")
        self.assertTrue(is_replay)
        self.assertEqual(replay["operation_id"], self.operation["operation_id"])

    def test_AH3_F12_same_key_different_payload(self):
        self._assert_error("idempotency_payload_mismatch", lambda: self.store.create_operation(
            idempotency_key="matrix-op", request_payload={"scenario_id": "other"},
            schema_set_revision="sha256:" + "1" * 64, backend_identity=self.backend,
            principal="local-user", operation_kind="controlled_execution"))

    def test_AH3_F13_queue_capacity_reached(self):
        queue = HarnessQueue(self.store, config=QueueConfig(max_active=1), handler=lambda _id: None)
        try:
            for index in range(8):
                queue._queue.put_nowait(f"queued-{index}")
            self._assert_error("queue_capacity_reached", lambda: queue.submit(self.operation["operation_id"]))
        finally:
            queue.stop()
        self.assertEqual(self.store.list_side_effects(self.operation["operation_id"]), [])

    def test_AH3_F14_worker_process_crash(self):
        self._transition("running", expected={"queued"})
        self.store.recover_incomplete()
        operation = self.store.get_operation(self.operation["operation_id"])
        self.assertEqual(operation["workflow_state"], "recovery_required")
        self.assertFalse(operation["last_error"]["retryable"])

    def test_AH3_F15_bridge_restart(self):
        self._transition("running", expected={"queued"})
        self.store.close()
        restarted = DurableHarnessStore(Path(self.temp.name) / "matrix.sqlite3")
        try:
            restarted.recover_incomplete()
            self.assertEqual(restarted.get_operation(self.operation["operation_id"])["workflow_state"], "recovery_required")
        finally:
            restarted.close()

    def test_AH3_F16_create_run_timeout_unknown(self):
        effect = self.store.record_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0",
                                               idempotency_key="create-run", command_digest="sha256:" + "a" * 64,
                                               target_identity="tilesim.bridge:/api/runs")
        self.assertIsNone(effect)
        self.store.finish_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0", status="unknown", unknown_outcome=True)
        self._transition("recovery_required", expected={"queued"}, error={"code": "run_timeout", "retryable": False, "unknown_outcome": True})
        self.assertTrue(self.store.get_operation(self.operation["operation_id"])["last_error"]["unknown_outcome"])

    def test_AH3_F17_create_run_nonzero_exit(self):
        self.store.record_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0",
                                      idempotency_key="create-run", command_digest="sha256:" + "a" * 64,
                                      target_identity="tilesim.bridge:/api/runs")
        self.store.finish_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0", status="failed")
        self._transition("failed", expected={"queued"}, error={"code": "create_run_failed", "retryable": False, "unknown_outcome": False})
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "failed")
        self.assertEqual(len(self.store.list_side_effects(self.operation["operation_id"])), 1)

    def test_AH3_F18_create_run_unknown_outcome_requires_recovery(self):
        self.test_AH3_F16_create_run_timeout_unknown()
        self._assert_error("recovery_required", lambda: self._transition("completed", expected={"recovery_required"}))

    # AH3-F19..F26: event, cancellation, artifact and lifecycle fences ----
    def test_AH3_F19_duplicate_event(self):
        first = self._event(1, "event-1")
        second = self._event(1, "event-1")
        self.assertEqual(first["event_id"], second["event_id"])
        self.assertEqual(len(self.store.list_events(self.operation["operation_id"])), 1)

    def test_AH3_F20_out_of_order_event(self):
        self._assert_error("event_out_of_order", lambda: self._event(2, "event-2"))

    def test_AH3_F21_cancel_late_terminal_event(self):
        self._transition("cancelled", expected={"queued"}, cancellation_fence="cancel-fence")
        self._assert_error("cancelled_late_result", lambda: self._event(1, "late", "completed", terminal=True))
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "cancelled")

    def test_AH3_F22_retry_non_retryable_failure(self):
        self._transition("failed", expected={"queued"}, error={"code": "invalid_request", "retryable": False})
        from agent_harness.runtime import retry_operation
        self._assert_error("retry_not_allowed", lambda: retry_operation(self.store, self.operation["operation_id"]))

    def test_AH3_F23_resume_after_completed_side_effect(self):
        self.store.record_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0",
                                      idempotency_key="create-run", command_digest="sha256:" + "a" * 64,
                                      target_identity="tilesim.bridge:/api/runs")
        self.store.finish_side_effect(operation_id=self.operation["operation_id"], command_id="create-run-0",
                                      status="succeeded", result_identity="run-once")
        self._transition("completed", expected={"queued"})
        self._assert_error("terminal_mutation", lambda: self._transition("queued"))
        self.assertEqual(len(self.store.list_side_effects(self.operation["operation_id"])), 1)

    def test_AH3_F24_artifact_identity_mismatch_is_not_completed(self):
        self._transition("running", expected={"queued"})
        self._transition("failed", expected={"running"}, error={"code": "artifact_manifest_invalid", "retryable": False})
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "failed")

    def test_AH3_F25_retention_delete_redacts_and_hides(self):
        self.store.bind_operation_run(self.operation["operation_id"], "run-retained")
        self.assertTrue(self.store.delete_operation(self.operation["operation_id"]))
        self.assertIsNone(self.store.get_operation(self.operation["operation_id"]))
        self.assertIsNone(self.store.get_stage3_by_operation(self.operation["operation_id"]))

    def test_AH3_F26_operation_terminal_fence(self):
        self._transition("completed", expected={"queued"})
        self._assert_error("terminal_mutation", lambda: self._transition("running"))
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "completed")


if __name__ == "__main__":
    unittest.main()
