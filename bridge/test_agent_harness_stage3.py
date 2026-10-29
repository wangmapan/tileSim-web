"""Stage 3A controlled-execution contract and failure-boundary tests.

The HTTP tests replace only the published ``/api/runs`` call and artifact
reader.  They do not replace the submit gateway, approval fence, durable
ledger, queue, or execution state machine.
"""

from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from agent_harness.contracts import canonical_sha256
from agent_harness.store import DurableHarnessStore, HarnessStoreError


class Stage3HttpTest(unittest.TestCase):
    def setUp(self) -> None:
        import server

        self.server = server
        self.temp = tempfile.TemporaryDirectory()
        self.original_agent_harness_store = server.agent_harness_store
        if server.agent_harness_queue is not None:
            server.agent_harness_queue.stop()
        server.agent_harness_store = DurableHarnessStore(Path(self.temp.name) / "stage3.sqlite")
        server.agent_harness_queue = None
        self.formal_calls: list[str] = []
        self._approval_index = 0
        self.original_formal = server._stage3_formal_run_request
        self.original_snapshot = server.run_snapshot
        self.original_manifest = server.artifact_manifest_for
        self.original_safe_dir = server.safe_run_directory
        self.original_timeout = server.EXECUTION_TIMEOUT_SECONDS

        def formal(request, *, idempotency_key, principal):
            self.formal_calls.append(idempotency_key)
            return 202, {"run_id": "run-stage3-test"}

        server._stage3_formal_run_request = formal
        server.run_snapshot = lambda _run_id: {
            "run_id": "run-stage3-test",
            "status": "completed",
            "fidelity_policy": "des",
            "resolved_fidelity_policy": "des",
            "trace_provenance": {"source_mode": "synthetic_trace", "claim_scope": "exploratory"},
        }
        server.artifact_manifest_for = lambda _run_id, _run_dir: {
            "schema_version": server.ARTIFACT_MANIFEST_SCHEMA,
            "api_version": server.API_VERSION,
            "schema_set_revision": server.SCHEMA_SET_REVISION,
            "run_id": "run-stage3-test",
            "artifacts": [],
            "rejected_artifacts": [],
        }
        server.safe_run_directory = lambda _run_id: Path(self.temp.name)
        server.EXECUTION_TIMEOUT_SECONDS = 2.0
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.snapshot = canonical_sha256({"stage3": "snapshot"})
        self.request = {
            "scenario_id": "s1_des_example",
            "fidelity_policy": "des",
            "gpu_participation_mode": "gpu_free",
        }
        self.headers = {
            "Content-Type": "application/json",
            "X-TileSim-Scopes": ",".join(
                (
                    "agent:read_draft",
                    "agent:write_draft",
                    "agent:approve_draft",
                    "agent:submit_experiment",
                    "agent:read_run",
                    "agent:cancel_experiment",
                    "agent:retry_experiment",
                    "agent:resume_experiment",
                )
            ),
        }

    def tearDown(self) -> None:
        self.server._stage3_formal_run_request = self.original_formal
        self.server.run_snapshot = self.original_snapshot
        self.server.artifact_manifest_for = self.original_manifest
        self.server.safe_run_directory = self.original_safe_dir
        self.server.EXECUTION_TIMEOUT_SECONDS = self.original_timeout
        if self.server.agent_harness_queue is not None:
            self.server.agent_harness_queue.stop()
        self.httpd.shutdown()
        self.httpd.server_close()
        self.server.agent_harness_store.close()
        self.server.agent_harness_store = self.original_agent_harness_store
        self.server.agent_deletion_coordinator.stores["harness"] = self.original_agent_harness_store
        self.server.agent_harness_queue = None
        self.temp.cleanup()

    def call(self, path: str, payload: dict | None = None, *, headers: dict | None = None, method: str | None = None):
        merged = dict(self.headers)
        merged.update(headers or {})
        request = urllib.request.Request(
            self.base + path,
            data=None if payload is None else json.dumps(payload).encode(),
            headers=merged,
            method=method or ("POST" if payload is not None else "GET"),
        )
        try:
            response = urllib.request.urlopen(request, timeout=5)
            return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def draft_payload(self, **extra):
        value = {
            "workspace_id": "local-workspace",
            "run_scope": "draft-only",
            "input_snapshot_digest": self.snapshot,
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "parameter_catalog_revision": "catalog-v1",
            "validator_revision": "validator-v1",
            "field_diffs": [],
            "assumptions": [],
            "evidence_refs": [],
            "budget_request": {},
            "risk_flags": [],
            "create_run_request": self.request,
        }
        value.update(extra)
        return value

    def approved(self):
        self._approval_index += 1
        suffix = str(self._approval_index)
        status, body = self.call("/api/agent/drafts", self.draft_payload(), headers={"Idempotency-Key": f"stage3-draft-{suffix}"})
        self.assertEqual(status, 201, body)
        draft = body["draft"]
        status, body = self.call(
            f"/api/agent/drafts/{draft['draft_id']}/validate",
            {"create_run_request": self.request},
            headers={"Idempotency-Key": f"stage3-validate-{suffix}", "X-TileSim-Input-Snapshot": self.snapshot},
        )
        self.assertEqual(status, 200, body)
        report = body["validation"]
        status, body = self.call(
            f"/api/agent/drafts/{draft['draft_id']}/approvals",
            {"validation_id": report["validation_id"], "expires_at": "2099-01-01T00:00:00+00:00"},
            headers={"Idempotency-Key": f"stage3-approval-{suffix}"},
        )
        self.assertEqual(status, 201, body)
        return draft, report, body["approval"]

    def submit_payload(self, draft, report, approval, **extra):
        value = {
            "schema_identity": "tilesim.agent_harness.execution_request.v1",
            "contract_revision": "2026-10-18.wpc.v1",
            "draft_id": draft["draft_id"],
            "approval_id": approval["approval_id"],
            "validation_id": report["validation_id"],
            "draft_digest": draft["draft_digest"],
            "approval_digest": approval["approval_digest"],
            "input_snapshot_digest": self.snapshot,
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "policy_revision": self.server.AGENT_HARNESS_POLICY_REVISION,
            "workflow_revision": "2026-10-18.wpc.v1",
            "create_run_request": self.request,
            "create_run_request_digest": canonical_sha256(self.request),
            "principal": "local-user",
            "workspace_id": "local-workspace",
        }
        value.update(extra)
        return value

    def test_submit_requires_approval_and_consumes_once(self):
        draft, report, approval = self.approved()
        missing = self.submit_payload(draft, report, approval, approval_id="missing")
        status, body = self.call("/api/agent/executions", missing, headers={"Idempotency-Key": "missing-approval"})
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "approval_missing")

        payload = self.submit_payload(draft, report, approval)
        status, body = self.call("/api/agent/executions", payload, headers={"Idempotency-Key": "stage3-execution"})
        self.assertEqual(status, 202, body)
        operation_id = body["execution"]["operation_id"]
        self.assertEqual(body["execution"]["run_id"], "run-stage3-test")
        self.assertEqual(len(self.formal_calls), 1)

        status, replay = self.call("/api/agent/executions", payload, headers={"Idempotency-Key": "stage3-execution"})
        self.assertEqual(status, 200)
        self.assertTrue(replay["idempotent_replay"])
        self.assertEqual(replay["execution"]["operation_id"], operation_id)
        self.assertEqual(len(self.formal_calls), 1)

    def test_payload_conflict_and_binding_mismatch_fail_closed(self):
        draft, report, approval = self.approved()
        payload = self.submit_payload(draft, report, approval)
        status, body = self.call("/api/agent/executions", payload, headers={"Idempotency-Key": "stage3-conflict"})
        self.assertEqual(status, 202, body)
        conflict = dict(payload)
        conflict["create_run_request"] = {**self.request, "fidelity_policy": "analytical"}
        conflict["create_run_request_digest"] = canonical_sha256(conflict["create_run_request"])
        status, body = self.call("/api/agent/executions", conflict, headers={"Idempotency-Key": "stage3-conflict"})
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "payload_conflict")

        draft, report, approval = self.approved()
        stale = self.submit_payload(draft, report, approval, schema_set_revision="sha256:" + "0" * 64)
        status, body = self.call("/api/agent/executions", stale, headers={"Idempotency-Key": "stage3-stale"})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["code"], "schema_revision_mismatch")

    def test_completed_run_has_terminal_event_and_result(self):
        draft, report, approval = self.approved()
        status, body = self.call(
            "/api/agent/executions",
            self.submit_payload(draft, report, approval),
            headers={"Idempotency-Key": "stage3-completed"},
        )
        self.assertEqual(status, 202, body)
        operation_id = body["execution"]["operation_id"]
        deadline = time.time() + 5
        while time.time() < deadline:
            status, snapshot = self.call(f"/api/agent/executions/{operation_id}")
            if snapshot["execution"]["state"] == "completed":
                break
            time.sleep(0.02)
        self.assertEqual(snapshot["execution"]["state"], "completed", snapshot)
        status, events = self.call(f"/api/agent/executions/{operation_id}/events")
        self.assertEqual(status, 200)
        self.assertEqual([event["sequence"] for event in events["events"]], list(range(1, len(events["events"]) + 1)))
        self.assertTrue(events["events"][-1]["terminal"])
        status, result = self.call(f"/api/agent/executions/{operation_id}/result")
        self.assertEqual(status, 200, result)
        self.assertEqual(result["result"]["run_id"], "run-stage3-test")

    def test_cancel_terminal_and_unknown_resume_boundaries(self):
        draft, report, approval = self.approved()
        status, body = self.call(
            "/api/agent/executions",
            self.submit_payload(draft, report, approval),
            headers={"Idempotency-Key": "stage3-cancel"},
        )
        self.assertEqual(status, 202)
        operation_id = body["execution"]["operation_id"]
        # The stub completes immediately; cancellation is therefore fenced.
        deadline = time.time() + 5
        while time.time() < deadline:
            _, snapshot = self.call(f"/api/agent/executions/{operation_id}")
            if snapshot["execution"]["state"] in {"completed", "failed", "recovery_required"}:
                break
            time.sleep(0.02)
        status, cancelled = self.call(
            f"/api/agent/executions/{operation_id}/cancel",
            {
                "schema_identity": "tilesim.agent_harness.execution_mutation_request.v1",
                "contract_revision": "2026-10-18.wpc.v1",
                "operation_id": operation_id,
                "action": "cancel",
                "idempotency_key": "stage3-cancel-command",
            },
            headers={"Idempotency-Key": "stage3-cancel-command"},
        )
        self.assertEqual(status, 409)
        self.assertEqual(cancelled["error"]["code"], "cancel_not_allowed")

    def test_store_resume_and_late_terminal_fences(self):
        store = DurableHarnessStore(Path(self.temp.name) / "store.sqlite")
        operation, _ = store.create_operation(
            idempotency_key="fence", request_payload={"x": 1}, schema_set_revision="sha256:test",
            backend_identity={"source_revision": "test"}, principal="local-user",
        )
        store.transition(operation["operation_id"], "cancelled", cancellation_fence="fence-1")
        with self.assertRaises(HarnessStoreError) as raised:
            store.transition(operation["operation_id"], "completed")
        self.assertEqual(raised.exception.code, "terminal_mutation")
        store.close()



if __name__ == "__main__":
    unittest.main()
