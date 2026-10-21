"""Stage-0/WP-A backend regression and failure-injection tests.

These tests exercise the durable Bridge boundary without invoking TileSimCLI or
an external Provider.  Provider live acceptance remains explicitly pending.
"""

from __future__ import annotations

import tempfile
import unittest
import json
import threading
import urllib.error
import urllib.request
from http import HTTPStatus
from pathlib import Path

from agent_harness.contracts import HarnessContractError, canonical_sha256
from agent_harness.store import DurableHarnessStore, HarnessStoreError
from agent_harness.contracts import SCHEMA_IDENTITIES


class HarnessStoreFaultInjectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.store = DurableHarnessStore(Path(self.temp.name) / "harness.sqlite3")
        self.backend = {"source_revision": "source-test", "build_revision": "build-test"}
        self.operation, self.replayed = self.store.create_operation(
            idempotency_key="idem-1", request_payload={"tool": "get_run_status"},
            schema_set_revision="sha256:test", backend_identity=self.backend, principal="local-user",
        )
        self.assertFalse(self.replayed)

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def test_01_provider_timeout_is_retryable_without_raw_response(self):
        self.store.transition(self.operation["operation_id"], "failed", error={"code": "provider_timeout", "retryable": True})
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["last_error"]["code"], "provider_timeout")

    def test_02_bridge_temporarily_unavailable_is_retryable(self):
        with self.assertRaises(HarnessStoreError):
            self.store.transition("missing", "running")

    def test_03_worker_process_exit_recovers(self):
        self.store.transition(self.operation["operation_id"], "running")
        self.store.recover_incomplete()
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "recovery_required")

    def test_03b_visibility_timeout_recovers_unknown_worker(self):
        self.store.claim_lease(self.operation["operation_id"], worker_id="worker-a", visibility_timeout_seconds=1)
        self.store.transition(self.operation["operation_id"], "running")
        self.store._connection.execute("UPDATE operations SET lease_json=? WHERE operation_id=?", (self.store._json({"worker_id": "worker-a", "visibility_timeout_at": "2000-01-01T00:00:00+00:00"}), self.operation["operation_id"]))
        self.store.recover_expired_leases(now_iso="2026-10-17T00:00:00+00:00")
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["workflow_state"], "recovery_required")

    def test_04_bridge_restart_recovery_is_durable(self):
        path = self.store.path
        self.store.close()
        reopened = DurableHarnessStore(path)
        self.assertIsNotNone(reopened.get_operation(self.operation["operation_id"]))
        reopened.close()

    def test_05_checkpoint_restore(self):
        checkpoint = self.store.save_checkpoint(self.operation["operation_id"], checkpoint_id="cp-1", state_digest="sha256:state", last_event_sequence=0, side_effect_digests=[], resume_policy={"max_attempts": 1}, schema_set_revision="sha256:test", backend_identity=self.backend)
        self.assertEqual(self.store.get_checkpoint("cp-1")["state_digest"], checkpoint["state_digest"])

    def test_06_duplicate_event_is_deduped(self):
        first = self.store.append_event(self.operation["operation_id"], event_id="evt-1", sequence=1, node="queue", state="queued", payload_digest="sha256:p")
        second = self.store.append_event(self.operation["operation_id"], event_id="evt-1", sequence=1, node="queue", state="queued", payload_digest="sha256:p")
        self.assertEqual(first["event_id"], second["event_id"])

    def test_07_out_of_order_event_is_rejected(self):
        with self.assertRaises(HarnessStoreError) as raised:
            self.store.append_event(self.operation["operation_id"], event_id="evt-2", sequence=2, node="queue", state="queued", payload_digest="sha256:p")
        self.assertEqual(raised.exception.code, "event_out_of_order")

    def test_08_duplicate_resume_is_rejected(self):
        self.store.transition(self.operation["operation_id"], "queued", expected={"queued"})
        with self.assertRaises(HarnessStoreError) as raised:
            self.store.transition(self.operation["operation_id"], "queued", expected={"recovery_required"})
        self.assertEqual(raised.exception.code, "state_conflict")

    def test_09_cancel_fence_rejects_late_terminal(self):
        self.store.transition(self.operation["operation_id"], "cancelled", cancellation_fence="fence-1")
        with self.assertRaises(HarnessStoreError) as raised:
            self.store.transition(self.operation["operation_id"], "completed")
        self.assertEqual(raised.exception.code, "terminal_mutation")
        with self.assertRaises(HarnessStoreError) as raised:
            self.store.append_event(self.operation["operation_id"], event_id="late", sequence=1, node="tool", state="completed", payload_digest="sha256:late", terminal=True)
        self.assertEqual(raised.exception.code, "cancelled_late_result")

    def test_10_approval_expiry_is_metadata_only(self):
        approval = self.store.save_approval(operation_id=self.operation["operation_id"], approval_digest="sha256:a", draft_digest="sha256:d", principal="local-user", approved_at="2026-01-01T00:00:00Z", expires_at="2026-01-01T00:00:01Z", decision="approved", schema_set_revision="sha256:test", backend_identity=self.backend)
        self.assertEqual(approval["decision"], "approved")

    def test_11_schema_revision_binding_is_persisted(self):
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["schema_set_revision"], "sha256:test")

    def test_12_backend_identity_binding_is_persisted(self):
        self.assertEqual(self.store.get_operation(self.operation["operation_id"])["backend_identity"], self.backend)

    def test_13_permission_deny_does_not_create_side_effect(self):
        self.assertEqual(self.store.list_side_effects(self.operation["operation_id"]), [])

    def test_14_tool_call_identity_is_idempotent(self):
        self.store.record_tool_call(operation_id=self.operation["operation_id"], tool_call_id="tool-1", tool_name="get_run_status", tool_revision="1", idempotency_key="tool-key", input_digest="sha256:i", permission_decision="allow")
        with self.assertRaises(HarnessStoreError):
            self.store.record_tool_call(operation_id=self.operation["operation_id"], tool_call_id="tool-2", tool_name="get_run_status", tool_revision="1", idempotency_key="tool-key", input_digest="sha256:different", permission_decision="allow")

    def test_15_artifact_digest_is_identity_not_payload(self):
        self.assertTrue(canonical_sha256({"sha256": "x"}).startswith("sha256:"))

    def test_16_unknown_outcome_is_not_retryable(self):
        self.store.transition(self.operation["operation_id"], "failed", error={"code": "unknown_side_effect", "retryable": False, "unknown_outcome": True})
        self.assertTrue(self.store.get_operation(self.operation["operation_id"])["last_error"]["unknown_outcome"])

    def test_17_same_key_same_payload_replays(self):
        same, replayed = self.store.create_operation(idempotency_key="idem-1", request_payload={"tool": "get_run_status"}, schema_set_revision="sha256:test", backend_identity=self.backend, principal="local-user")
        self.assertTrue(replayed)
        self.assertEqual(same["operation_id"], self.operation["operation_id"])

    def test_18_same_key_different_payload_conflicts(self):
        with self.assertRaises(HarnessStoreError) as raised:
            self.store.create_operation(idempotency_key="idem-1", request_payload={"tool": "query_verified_metrics"}, schema_set_revision="sha256:test", backend_identity=self.backend, principal="local-user")
        self.assertEqual(raised.exception.code, "idempotency_payload_mismatch")

    def test_19_retention_delete(self):
        self.assertTrue(self.store.delete_operation(self.operation["operation_id"]))
        self.assertIsNone(self.store.get_operation(self.operation["operation_id"]))

    def test_20_forbidden_document_fields_fail_closed(self):
        with self.assertRaises(HarnessContractError) as raised:
            from agent_harness.contracts import validate_document
            validate_document("agent_operation", {"credential": "secret"})
        self.assertIn(raised.exception.code, {"unknown_field", "missing_field"})

    def test_21_schema_identity_manifest_has_no_drift(self):
        root = Path(__file__).resolve().parent / "contracts" / "schemas" / "agent-harness"
        names = {path.name.removesuffix(".schema.json").replace("-", "_"): json.loads(path.read_text(encoding="utf-8"))["$id"] for path in root.glob("*.schema.json") if path.name not in {"common.schema.json", "error.schema.json"}}
        self.assertEqual(set(SCHEMA_IDENTITIES), set(names))
        for name, identity in SCHEMA_IDENTITIES.items():
            self.assertEqual(names[name], identity)


class HarnessHttpGatewayTest(unittest.TestCase):
    def setUp(self) -> None:
        import server
        self.server = server
        self.temp = tempfile.TemporaryDirectory()
        server.agent_harness_store = DurableHarnessStore(Path(self.temp.name) / "harness-http.sqlite3")
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.headers = {"Content-Type": "application/json", "X-TileSim-Scopes": "agent:read_capability,agent:read_run,agent:read_evidence"}

    def tearDown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.server.ensure_harness_queue().stop()
        self.server.agent_harness_store.close()
        self.temp.cleanup()

    def request(self, path: str, payload: dict | None = None, *, headers: dict | None = None):
        merged = dict(self.headers)
        merged.update(headers or {})
        request = urllib.request.Request(self.base + path, data=json.dumps(payload).encode() if payload is not None else None, headers=merged, method="POST" if payload is not None else "GET")
        try:
            response = urllib.request.urlopen(request, timeout=5)
            return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_http_idempotency_permission_and_event_recovery(self):
        status, first = self.request("/api/agent/operations", {"operation_kind": "read_only", "idempotency_key": "http-idem"})
        self.assertEqual(status, HTTPStatus.ACCEPTED)
        operation_id = first["operation"]["operation_id"]
        status, replay = self.request("/api/agent/operations", {"operation_kind": "read_only", "idempotency_key": "http-idem"})
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(replay["operation"]["operation_id"], operation_id)
        status, conflict = self.request("/api/agent/operations", {"operation_kind": "different", "idempotency_key": "http-idem"})
        self.assertEqual(status, HTTPStatus.CONFLICT)
        self.assertEqual(conflict["error"]["code"], "idempotency_payload_mismatch")
        status, denied = self.request(f"/api/agent/operations/{operation_id}", headers={"X-TileSim-Principal": "other"})
        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        status, unknown = self.request("/api/agent/tools/call", {"operation_id": operation_id, "tool_name": "not_published", "input": {}})
        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(unknown["error"]["code"], "unknown_tool")
        status, missing_event = self.request(f"/api/agent/operations/{operation_id}/events", headers={"Last-Event-ID": "999"})
        self.assertEqual(status, HTTPStatus.NOT_FOUND)
        self.assertEqual(missing_event["error"]["code"], "event_not_found")


if __name__ == "__main__":
    unittest.main()
