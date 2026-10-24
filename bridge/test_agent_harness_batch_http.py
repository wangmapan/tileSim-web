from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from agent_harness.batch import BatchStore, canonical_sha256


class BatchHttpTests(unittest.TestCase):
    def setUp(self):
        import server
        self.server = server
        self.temp = tempfile.TemporaryDirectory()
        if server.agent_harness_queue is not None:
            server.agent_harness_queue.stop()
        server.batch_store = BatchStore(Path(self.temp.name) / "batch.sqlite3")
        self.original_submit = server._optimization_submit_formal
        self.original_batch_evaluation = server._batch_verified_evaluation
        self.original_stage3_lookup = server.agent_harness_store.get_stage3_by_operation
        server.BRIDGE_SERVER_ADDRESS = None
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True); self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.headers = {"Content-Type": "application/json", "X-TileSim-Principal": "local-user", "X-TileSim-Workspace": "local-workspace", "X-TileSim-Scopes": "agent:write_draft,agent:read_draft,agent:read_run,agent:approve_draft,agent:submit_experiment,agent:cancel_experiment,agent:resume_experiment,agent:retry_experiment"}

    def tearDown(self):
        self.server._optimization_submit_formal = self.original_submit
        self.server._batch_verified_evaluation = self.original_batch_evaluation
        self.server.agent_harness_store.get_stage3_by_operation = self.original_stage3_lookup
        if self.server.agent_harness_queue is not None:
            self.server.agent_harness_queue.stop()
        self.httpd.shutdown(); self.httpd.server_close(); self.server.batch_store.close(); self.temp.cleanup()

    def call(self, path, payload=None, key="batch-http-key"):
        headers = {**self.headers, "Idempotency-Key": key}
        req = urllib.request.Request(self.base + path, data=None if payload is None else json.dumps(payload).encode(), headers=headers, method="GET" if payload is None else "POST")
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read())

    def test_create_replay_approval_boundary_and_event_replay(self):
        identity = self.server.harness_backend_identity()
        body = {"schema_identity": "tilesim.agent_harness.batch_session.v1", "contract_revision": "2026-10-19.wpe.v1", "input_snapshot_digest": canonical_sha256({"batch": 1}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": identity, "plan": {"kind": "http"}, "candidate_set": [{"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}], "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize"}, "local_dev": True, "approval_required": True, "auto_execute": False}
        status, created = self.call("/api/agent/batches", body, "batch-http-create")
        self.assertEqual(status, 201); batch_id = created["batch"]["batch_id"]; self.assertEqual(created["batch"]["state"], "waiting_approval")
        status, replay = self.call("/api/agent/batches", body, "batch-http-create")
        self.assertEqual(status, 200); self.assertTrue(replay["idempotent_replay"])
        status, detail = self.call(f"/api/agent/batches/{batch_id}")
        self.assertEqual(status, 200); self.assertEqual(detail["detail"]["events"][0]["sequence"], 1)
        digest = canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(body["plan"]), "snapshot_digest": body["input_snapshot_digest"]})
        status, approved = self.call(f"/api/agent/batches/{batch_id}/approve", {"approval_digest": digest}, "batch-http-approve")
        self.assertEqual(status, 200); self.assertEqual(approved["approval"]["status"], "approved")
        _, events = self.call(f"/api/agent/batches/{batch_id}/events")
        self.assertGreaterEqual(len(events["events"]), 1); self.assertEqual(events["provenance"]["production_status"], "not_for_production")

    def test_approved_batch_runs_each_slot_through_formal_execution_projection(self):
        self.server._optimization_submit_formal = lambda _session, candidate, _approval: f"op-batch-{candidate['candidate_id']}"
        self.server._batch_verified_evaluation = lambda batch, candidate, execution: {
            "schema_identity": self.server.BATCH_SCHEMA_IDENTITIES["result"],
            "contract_revision": self.server.BATCH_CONTRACT_REVISION,
            "batch_id": batch["batch_id"], "candidate_id": candidate["candidate_id"], "status": "completed",
            "operation_id": execution["operation_id"], "run_id": "run-batch-test",
            "artifact_manifest_digest": "sha256:" + "a" * 64,
            "objective": {"schema_identity": self.server.BATCH_SCHEMA_IDENTITIES["objective"], "contract_revision": self.server.BATCH_CONTRACT_REVISION, "metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize", "policy_revision": self.server.BATCH_POLICY_REVISION, "digest": "sha256:" + "b" * 64, "value": 10, "status": "verified"},
            "evidence": [{"run_id": "run-batch-test", "manifest_digest": "sha256:" + "a" * 64, "json_pointer": "/tail_latency_summary/ttft_ps/p95_ps", "tool_output_digest": "sha256:" + "c" * 64}],
            "snapshot_digest": batch["input_snapshot_digest"], "schema_set_revision": batch["schema_set_revision"], "backend_identity": batch["backend_identity"], "provenance": self.server.BATCH_PROVENANCE,
        }
        self.server.agent_harness_store.get_stage3_by_operation = lambda operation_id: {"operation_id": operation_id, "state": "completed", "result": {"schema_identity": self.server.EXECUTION_SCHEMA_IDENTITIES["result"], "run_id": "run-batch-test", "manifest_digest": "sha256:" + "a" * 64, "schema_set_revision": self.server.SCHEMA_SET_REVISION, "provenance": {"source_mode": "synthetic_trace", "claim_scope": "exploratory"}}}
        identity = self.server.harness_backend_identity()
        body = {"schema_identity": "tilesim.agent_harness.batch_session.v1", "contract_revision": "2026-10-19.wpe.v1", "input_snapshot_digest": canonical_sha256({"batch": 2}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": identity, "plan": {"kind": "worker"}, "candidate_set": [{"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}], "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize"}, "local_dev": True, "approval_required": True, "auto_execute": True}
        _, created = self.call("/api/agent/batches", body, "batch-worker-create")
        batch_id = created["batch"]["batch_id"]
        digest = canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(body["plan"]), "snapshot_digest": body["input_snapshot_digest"]})
        self.call(f"/api/agent/batches/{batch_id}/approve", {"approval_digest": digest}, "batch-worker-approve")
        import time
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/batches/{batch_id}")
            if snapshot["batch"]["state"] in {"completed", "failed", "recovery_required"}:
                break
            time.sleep(0.05)
        self.assertEqual(snapshot["batch"]["state"], "completed")
        self.assertEqual(snapshot["detail"]["candidates"][0]["status"], "completed")
        self.assertEqual(snapshot["detail"]["summary"]["best_candidate_id"], snapshot["detail"]["candidates"][0]["candidate_id"])
        self.assertEqual(snapshot["detail"]["candidates"][0]["result"]["objective"]["status"], "verified")

    def test_batch_records_verified_objective_and_stops_on_no_improvement(self):
        self.server._optimization_submit_formal = lambda _session, candidate, _approval: f"op-batch-{candidate['candidate_id']}"
        self.server.agent_harness_store.get_stage3_by_operation = lambda operation_id: {
            "operation_id": operation_id, "state": "completed", "input_snapshot_digest": self.server._current_batch_snapshot,
            "backend_identity": self.server._current_batch_backend,
            "result": {"schema_identity": self.server.EXECUTION_SCHEMA_IDENTITIES["result"], "run_id": f"run-{operation_id}", "manifest_digest": "sha256:" + "a" * 64, "schema_set_revision": self.server.SCHEMA_SET_REVISION, "provenance": {"source_mode": "synthetic_trace", "claim_scope": "exploratory"}},
        }
        values = {0: 10, 1: 5, 2: 6}
        def evaluate(batch, candidate, execution):
            value = values[candidate["sequence"]]
            return {"schema_identity": self.server.BATCH_SCHEMA_IDENTITIES["result"], "contract_revision": self.server.BATCH_CONTRACT_REVISION, "batch_id": batch["batch_id"], "candidate_id": candidate["candidate_id"], "status": "completed", "operation_id": execution["operation_id"], "run_id": execution["result"]["run_id"], "artifact_manifest_digest": execution["result"]["manifest_digest"], "objective": {"schema_identity": self.server.BATCH_SCHEMA_IDENTITIES["objective"], "contract_revision": self.server.BATCH_CONTRACT_REVISION, "metric_path": "/metrics/p95", "direction": "minimize", "policy_revision": self.server.BATCH_POLICY_REVISION, "digest": "sha256:" + ("b" * 64), "value": value, "status": "verified"}, "evidence": [], "snapshot_digest": batch["input_snapshot_digest"], "schema_set_revision": batch["schema_set_revision"], "backend_identity": batch["backend_identity"], "provenance": self.server.BATCH_PROVENANCE}
        self.server._batch_verified_evaluation = evaluate
        identity = self.server.harness_backend_identity()
        body = {"schema_identity": "tilesim.agent_harness.batch_session.v1", "contract_revision": "2026-10-19.wpe.v1", "input_snapshot_digest": canonical_sha256({"batch": 3}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": identity, "plan": {"kind": "no-improvement"}, "candidate_set": [{"scenario_id": "s1_des_example", "variant": index} for index in range(3)], "objective": {"metric_path": "/metrics/p95", "direction": "minimize"}, "budget": {"max_candidates": 3, "max_runs": 3, "max_no_improvement": 1}, "local_dev": True, "approval_required": True, "auto_execute": True}
        self.server._current_batch_snapshot = body["input_snapshot_digest"]
        self.server._current_batch_backend = identity
        _, created = self.call("/api/agent/batches", body, "batch-best-create")
        batch_id = created["batch"]["batch_id"]
        digest = canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(body["plan"]), "snapshot_digest": body["input_snapshot_digest"]})
        self.call(f"/api/agent/batches/{batch_id}/approve", {"approval_digest": digest}, "batch-best-approve")
        import time
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/batches/{batch_id}")
            if snapshot["batch"]["state"] in {"completed", "failed", "recovery_required"}:
                break
            time.sleep(0.05)
        self.assertEqual(snapshot["batch"]["state"], "completed")
        self.assertEqual(snapshot["detail"]["summary"]["stop_reason"]["reason"], "no_improvement")
        self.assertEqual(snapshot["detail"]["summary"]["best_value"], 5.0)
        self.assertEqual(snapshot["detail"]["summary"]["best_candidate_id"], snapshot["detail"]["candidates"][1]["candidate_id"])

    def test_failure_budget_is_hard_even_when_failure_policy_continues(self):
        identity = self.server.harness_backend_identity()
        body = {"schema_identity": "tilesim.agent_harness.batch_session.v1", "contract_revision": "2026-10-19.wpe.v1", "input_snapshot_digest": canonical_sha256({"batch": "failure-budget"}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": identity, "plan": {"kind": "failure-budget"}, "candidate_set": [{}, {"variant": 1}], "objective": {"metric_path": "/metrics/p95", "direction": "minimize"}, "budget": {"max_candidates": 2, "max_runs": 2, "max_failures": 1}, "stop_policy": {"on_failure": "continue", "on_no_improvement": "stop"}, "local_dev": True, "approval_required": True, "auto_execute": True}
        _, created = self.call("/api/agent/batches", body, "batch-failure-budget-create")
        batch_id = created["batch"]["batch_id"]
        digest = canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(body["plan"]), "snapshot_digest": body["input_snapshot_digest"]})
        self.call(f"/api/agent/batches/{batch_id}/approve", {"approval_digest": digest}, "batch-failure-budget-approve")
        import time
        deadline = time.monotonic() + 3
        snapshot = None
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/batches/{batch_id}")
            if snapshot["batch"]["state"] in {"completed", "failed", "recovery_required", "manual_intervention_required"}:
                break
            time.sleep(0.05)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["batch"]["state"], "failed")
        self.assertEqual(snapshot["detail"]["summary"]["stop_reason"]["reason"], "failure_budget")
        self.assertEqual(sum(candidate["status"] == "failed" for candidate in snapshot["detail"]["candidates"]), 1)

    def test_manual_intervention_execution_is_not_downgraded_to_retryable_failure(self):
        self.server._optimization_submit_formal = lambda _session, candidate, _approval: f"op-manual-{candidate['candidate_id']}"
        self.server.agent_harness_store.get_stage3_by_operation = lambda operation_id: {
            "operation_id": operation_id,
            "state": "manual_intervention_required",
            "unknown_outcome": True,
            "error": {"code": "provider_unknown_outcome", "unknown_outcome": True},
        }
        identity = self.server.harness_backend_identity()
        body = {
            "schema_identity": "tilesim.agent_harness.batch_session.v1",
            "contract_revision": "2026-10-19.wpe.v1",
            "input_snapshot_digest": canonical_sha256({"batch": "manual-intervention"}),
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": identity,
            "plan": {"kind": "manual-intervention"},
            "candidate_set": [{"scenario_id": "s1_des_example"}],
            "objective": {"metric_path": "/metrics/p95", "direction": "minimize"},
            "local_dev": True,
            "approval_required": True,
            "auto_execute": True,
        }
        _, created = self.call("/api/agent/batches", body, "batch-manual-create")
        batch_id = created["batch"]["batch_id"]
        digest = canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(body["plan"]), "snapshot_digest": body["input_snapshot_digest"]})
        self.call(f"/api/agent/batches/{batch_id}/approve", {"approval_digest": digest}, "batch-manual-approve")
        import time
        deadline = time.monotonic() + 3
        snapshot = None
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/batches/{batch_id}")
            if snapshot["batch"]["state"] in {"completed", "failed", "recovery_required", "manual_intervention_required"}:
                break
            time.sleep(0.05)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["batch"]["state"], "manual_intervention_required")
        candidate = snapshot["detail"]["candidates"][0]
        self.assertEqual(candidate["status"], "manual_intervention_required")
        self.assertTrue(candidate["failure"]["unknown_outcome"])


if __name__ == "__main__":
    unittest.main()
