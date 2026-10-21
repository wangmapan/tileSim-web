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
            reopened = BatchStore(path); self.assertEqual(reopened.recover_inflight(), 1); self.assertEqual(reopened.get(batch["batch_id"])["state"], "recovery_required"); reopened.close()

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


if __name__ == "__main__":
    unittest.main()
