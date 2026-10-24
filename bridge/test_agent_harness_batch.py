from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from agent_harness.batch import BatchError, BatchStore, CONTRACT_REVISION, PROVENANCE, SCHEMA_IDENTITIES, canonical_sha256, validate_batch_request


def document(candidate_set=None):
    identity = {"source_revision": "local", "versions_match": True}
    return {"schema_identity": SCHEMA_IDENTITIES["batch"], "contract_revision": CONTRACT_REVISION, "input_snapshot_digest": canonical_sha256({"snapshot": 1}), "schema_set_revision": canonical_sha256({"schema": 1}), "backend_identity": identity, "plan": {"kind": "bounded"}, "candidate_set": candidate_set or [{"scenario_id": "s1_des_example"}], "objective": {"metric_path": "/metrics/p95", "direction": "minimize"}, "local_dev": True, "approval_required": True, "auto_execute": False}


class BatchContractTests(unittest.TestCase):
    def test_validation_is_local_only_and_budget_is_bounded(self):
        raw = document()
        normalized = validate_batch_request(raw, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])
        self.assertTrue(normalized["local_dev"])
        self.assertEqual(normalized["budget"]["max_concurrency"], 1)
        with self.assertRaisesRegex(BatchError, "closed"):
            validate_batch_request({**raw, "shell": True}, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])

    def test_candidate_set_cannot_exceed_candidate_budget(self):
        raw = document(candidate_set=[{"scenario_id": "s1"}, {"scenario_id": "s2"}])
        with self.assertRaisesRegex(BatchError, "max_candidates"):
            validate_batch_request({**raw, "budget": {"max_candidates": 1}}, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])

    def test_idempotency_conflict_duplicate_candidate_and_delete_fence(self):
        with tempfile.TemporaryDirectory() as directory:
            store = BatchStore(Path(directory) / "batch.sqlite3")
            raw = document()
            normalized = validate_batch_request(raw, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])
            batch, replay = store.create(normalized, idempotency_key="batch-idempotency")
            self.assertFalse(replay)
            same, replay = store.create(normalized, idempotency_key="batch-idempotency")
            self.assertTrue(replay); self.assertEqual(same["batch_id"], batch["batch_id"])
            with self.assertRaises(BatchError):
                store.create({**normalized, "candidate_set": [{"scenario_id": "different"}]}, idempotency_key="batch-idempotency")
            with self.assertRaisesRegex(BatchError, "Idempotency"):
                store.create({**normalized, "objective": {"metric_path": "/metrics/other", "direction": "minimize"}}, idempotency_key="batch-idempotency")
            self.assertTrue(store.delete(batch["batch_id"]))
            self.assertIsNone(store.get(batch["batch_id"]))
            store.close()

    def test_approval_single_use_lease_and_restart_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "batch.sqlite3"
            raw = document(); normalized = validate_batch_request(raw, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])
            store = BatchStore(path); batch, _ = store.create(normalized, idempotency_key="batch-approval")
            digest = canonical_sha256({"batch_id": batch["batch_id"], "plan_digest": canonical_sha256(batch["plan"]), "snapshot_digest": batch["input_snapshot_digest"]})
            approval = store.approve(batch["batch_id"], approval_digest=digest, expires_at="2099-01-01T00:00:00+00:00")
            store.consume_approval(batch["batch_id"])
            with self.assertRaisesRegex(BatchError, "single-use"):
                store.consume_approval(batch["batch_id"])
            self.assertTrue(store.acquire_lease(batch["batch_id"], "worker-a"))
            store.transition(batch["batch_id"], "queued", expected={"waiting_approval"})
            store.close()
            reopened = BatchStore(path)
            self.assertEqual(reopened.recover_inflight(), 1)
            self.assertEqual(reopened.get(batch["batch_id"])["state"], "recovery_required")
            recovered_candidate = reopened.candidates(batch["batch_id"])[0]
            self.assertEqual(recovered_candidate["status"], "recovery_required")
            self.assertTrue(recovered_candidate["failure"]["unknown_outcome"])
            self.assertEqual(reopened.mark_recovery_for_manual_intervention(batch["batch_id"]), 1)
            self.assertEqual(reopened.get(batch["batch_id"])["state"], "recovery_required")
            self.assertEqual(reopened.candidate(batch["batch_id"], recovered_candidate["candidate_id"])["status"], "manual_intervention_required")
            self.assertEqual(reopened.summary(batch["batch_id"])["counts"]["manual_intervention_required"], 1)
            reopened.transition(batch["batch_id"], "manual_intervention_required", expected={"recovery_required"})
            self.assertEqual(reopened.get(batch["batch_id"])["state"], "manual_intervention_required")
            reopened.close()

    def test_progress_best_value_and_retention_removes_bounded_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            store = BatchStore(Path(directory) / "batch.sqlite3")
            raw = document(); normalized = validate_batch_request(raw, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])
            batch, _ = store.create(normalized, idempotency_key="batch-retention")
            candidate = store.candidates(batch["batch_id"])[0]
            store.update_candidate(batch["batch_id"], candidate["candidate_id"], status="completed", result={"objective": {"value": 3}})
            store.set_progress(batch["batch_id"], best_candidate_id=candidate["candidate_id"], best_value=3, no_improvement_count=0, evaluated_count=1)
            self.assertEqual(store.summary(batch["batch_id"])["best_value"], 3)
            self.assertTrue(store.delete(batch["batch_id"]))
            self.assertEqual(store.db.execute("SELECT COUNT(*) FROM batch_candidates WHERE batch_id=?", (batch["batch_id"],)).fetchone()[0], 0)
            self.assertEqual(store.db.execute("SELECT COUNT(*) FROM batch_events WHERE batch_id=?", (batch["batch_id"],)).fetchone()[0], 0)
            store.close()

    def test_retry_requires_retryable_failure_and_fresh_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            store = BatchStore(Path(directory) / "batch.sqlite3")
            raw = document(); normalized = validate_batch_request({**raw, "budget": {"max_retries": 1}}, principal="local-user", workspace_id="local", schema_set_revision=raw["schema_set_revision"], backend_identity=raw["backend_identity"])
            batch, _ = store.create(normalized, idempotency_key="batch-retry")
            candidate = store.candidates(batch["batch_id"])[0]
            store.transition(batch["batch_id"], "queued", expected={"waiting_approval"})
            store.transition(batch["batch_id"], "running", expected={"queued"})
            store.update_candidate(batch["batch_id"], candidate["candidate_id"], status="failed", failure={"code": "temporary", "retryable": True, "unknown_outcome": False})
            store.transition(batch["batch_id"], "failed", expected={"running"})
            store.set_runtime_metadata(batch["batch_id"], started_at_epoch=1234.0, failure_count=1)
            self.assertEqual(store.prepare_retry(batch["batch_id"], max_retries=1), 1)
            self.assertEqual(store.get(batch["batch_id"])["runtime"]["started_at_epoch"], 1234.0)
            self.assertEqual(store.get(batch["batch_id"])["runtime"]["failure_count"], 1)
            store.transition(batch["batch_id"], "waiting_approval", expected={"failed"}, allow_retry=True)
            retried = store.candidate(batch["batch_id"], candidate["candidate_id"])
            self.assertEqual(retried["status"], "waiting_approval")
            self.assertEqual(retried["retry_count"], 1)
            store.transition(batch["batch_id"], "queued", expected={"waiting_approval"})
            store.transition(batch["batch_id"], "running", expected={"queued"})
            store.update_candidate(batch["batch_id"], candidate["candidate_id"], status="failed", failure={"code": "temporary", "retryable": True, "unknown_outcome": False})
            store.transition(batch["batch_id"], "failed", expected={"running"})
            with self.assertRaisesRegex(BatchError, "exhausted"):
                store.prepare_retry(batch["batch_id"], max_retries=1)
            store.close()


if __name__ == "__main__":
    unittest.main()
