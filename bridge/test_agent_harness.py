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

from agent_harness.contracts import (
    EXPLORATION_CONTRACT_REVISION,
    EXPLORATION_SCHEMA_IDENTITIES,
    HarnessContractError,
    canonical_sha256,
    validate_document,
)
from agent_harness.store import DurableHarnessStore, HarnessStoreError
from agent_harness.contracts import SCHEMA_IDENTITIES


class ExplorationContractValidationTest(unittest.TestCase):
    """Regression coverage for the closed exploration successor DTO family."""

    schema_set_revision = "sha256:" + "a" * 64
    backend_identity = {"source_revision": "source-test", "build_revision": "build-test"}
    provenance = {
        "deployment_mode": "local_dev",
        "source_mode": "synthetic_trace",
        "claim_scope": "exploratory",
        "production_status": "not_for_production",
    }
    budget = {
        "max_rounds": 10,
        "max_runs": 10,
        "max_concurrency": 1,
        "max_no_improvement": 3,
        "max_failures": 2,
        "max_execution_time_ms": 900000,
        "max_model_calls": 24,
        "max_tool_calls_per_round": 4,
    }
    objective = {
        "metric_path": "/metrics/p95",
        "direction": "minimize",
        "minimum_improvement": 0,
        "plateau_rounds": 3,
    }
    grant = {"pointer": "/request_count", "min": 1, "max": 32, "step": 1, "kind": "int"}

    def _identity(self, name: str) -> dict:
        common = {
            "schema_identity": EXPLORATION_SCHEMA_IDENTITIES[name],
            "contract_revision": EXPLORATION_CONTRACT_REVISION,
        }
        if name == "session":
            return {
                **common,
                "session_id": "explore-contract-test",
                "task_type": "explore_experiment",
                "principal": "local-user",
                "workspace_id": "local",
                "run_id": None,
                "context_revision": "ctx-1",
                "run_context_revision": None,
                "input_snapshot_digest": self.schema_set_revision,
                "schema_set_revision": self.schema_set_revision,
                "backend_identity": self.backend_identity,
                "parameter_catalog_revision": "catalog-1",
                "policy_revision": "tilesim.agent_harness.serial_exploration.policy.v2",
                "objective": self.objective,
                "parameter_grants": [self.grant],
                "budget": self.budget,
                "base_config": {"request_count": 8},
                "allowed_pages": ["experiment"],
                "allowed_actions": ["analyze"],
                "state": "waiting_authorization",
                "current_page_id": "experiment",
                "current_round": 0,
                "run_count": 0,
                "failure_count": 0,
                "no_improvement_count": 0,
                "active_run_id": None,
                "best_candidate_id": None,
                "authorization_id": None,
                "authorization_digest": None,
                "context_lock": {"locked": True},
                "local_dev": True,
                "automatic_submission": True,
                "provenance": self.provenance,
                "stop_reason": None,
                "created_at": "2026-10-29T00:00:00Z",
                "updated_at": "2026-10-29T00:00:00Z",
            }
        if name == "candidate":
            return {
                **common,
                "candidate_id": "candidate-1",
                "session_id": "explore-contract-test",
                "sequence": 1,
                "parent_candidate_id": None,
                "candidate_digest": self.schema_set_revision,
                "config": {"request_count": 8},
                "changed_fields": ["/request_count"],
                "status": "generated",
                "authorization_id": "explore-authz-1",
                "run_id": None,
                "run_idempotency_key": "explore-run-1",
                "metric_value": None,
                "metric_verified": False,
                "provenance": self.provenance,
            }
        if name == "iteration":
            return {
                **common,
                "session_id": "explore-contract-test",
                "iteration_id": "iteration-1",
                "sequence": 1,
                "candidate_id": "candidate-1",
                "state": "generated",
                "run_id": None,
                "metric_verified": False,
                "created_at": "2026-10-29T00:00:00Z",
                "provenance": self.provenance,
            }
        if name == "evaluation":
            return {
                **common,
                "session_id": "explore-contract-test",
                "candidate_id": "candidate-1",
                "run_id": "run-1",
                "objective": self.objective,
                "evidence": [],
                "provenance": self.provenance,
            }
        if name == "checkpoint":
            return {
                **common,
                "session_id": "explore-contract-test",
                "checkpoint_id": "checkpoint-1",
                "state_digest": self.schema_set_revision,
                "last_event_sequence": 0,
                "active_run_id": None,
                "context_revision": "ctx-1",
                "authorization_digest": self.schema_set_revision,
                "provenance": self.provenance,
            }
        if name == "summary":
            return {
                **common,
                "session_id": "explore-contract-test",
                "state": "completed",
                "round_count": 0,
                "evaluated_count": 0,
                "run_count": 0,
                "failure_count": 0,
                "best_candidate_id": None,
                "best_value": None,
                "stop_reason": self._identity("stop_reason"),
                "rounds": [],
                "provenance": self.provenance,
            }
        if name == "event":
            return {
                **common,
                "event_id": "event-1",
                "session_id": "explore-contract-test",
                "sequence": 1,
                "event_type": "created",
                "node": "prepare_exploration",
                "state": "waiting_authorization",
                "payload_digest": self.schema_set_revision,
                "created_at": "2026-10-29T00:00:00Z",
                "provenance": self.provenance,
            }
        if name == "stop_reason":
            return {
                **common,
                "reason": "completed",
                "detail": "No more rounds were requested.",
                "provenance": self.provenance,
            }
        if name == "authorization_request":
            return {
                **common,
                "session_id": "explore-contract-test",
                "task_type": "explore_experiment",
                "context_revision": "ctx-1",
                "run_context_revision": None,
                "input_snapshot_digest": self.schema_set_revision,
                "schema_set_revision": self.schema_set_revision,
                "backend_identity": self.backend_identity,
                "parameter_catalog_revision": "catalog-1",
                "autonomy_level": "bounded_autonomous",
                "budget": self.budget,
                "parameter_grants": [self.grant],
                "objective": self.objective,
                "tool_allowlist": ["query_verified_metrics"],
                "allowed_pages": ["experiment"],
                "allowed_actions": ["analyze"],
            }
        if name == "authorization":
            return {
                **common,
                "authorization_id": "explore-authz-1",
                "session_id": "explore-contract-test",
                "task_type": "explore_experiment",
                "principal": "local-user",
                "workspace_id": "local",
                "context_revision": "ctx-1",
                "run_context_revision": None,
                "input_snapshot_digest": self.schema_set_revision,
                "schema_set_revision": self.schema_set_revision,
                "backend_identity": self.backend_identity,
                "parameter_catalog_revision": "catalog-1",
                "autonomy_level": "bounded_autonomous",
                "budget": self.budget,
                "parameter_grants": [self.grant],
                "objective": self.objective,
                "tool_allowlist": ["query_verified_metrics"],
                "allowed_pages": ["experiment"],
                "allowed_actions": ["analyze"],
                "protected": {},
                "status": "active",
                "issued_by": "local-user",
                "issued_at": "2026-10-29T00:00:00Z",
                "expires_at": "2026-10-29T01:00:00Z",
                "revoked_at": None,
                "provenance": self.provenance,
                "authorization_digest": self.schema_set_revision,
            }
        raise AssertionError(name)

    def _response(self) -> dict:
        return {
            "authorization": self._identity("authorization"),
            "session": self._identity("session"),
            "detail": {},
            "autonomous_started": False,
            "provenance": self.provenance,
        }

    def test_identity_bearing_records_share_revision_and_binding_checks(self):
        for name in EXPLORATION_SCHEMA_IDENTITIES:
            if name in {"provenance", "budget", "objective", "parameter_grant", "authorization_response"}:
                continue
            with self.subTest(name=name):
                document = self._identity(name)
                self.assertIs(validate_document(
                    f"exploration_{name}",
                    document,
                    expected_schema_set_revision=self.schema_set_revision,
                    expected_backend_identity=self.backend_identity,
                ), document)

        wrong_identity = self._identity("session")
        wrong_identity["schema_identity"] = "tilesim.agent_harness.exploration_session.v1"
        with self.assertRaisesRegex(HarnessContractError, "schema identity"):
            validate_document("exploration_session", wrong_identity)

        wrong_revision = self._identity("candidate")
        wrong_revision["contract_revision"] = "2026-10-28.wpf.v1"
        with self.assertRaisesRegex(HarnessContractError, "contract revision"):
            validate_document("exploration_candidate", wrong_revision)

        wrong_schema_set = self._identity("authorization_request")
        wrong_schema_set["schema_set_revision"] = "sha256:" + "b" * 64
        with self.assertRaisesRegex(HarnessContractError, "Schema-set revision"):
            validate_document(
                "exploration_authorization_request",
                wrong_schema_set,
                expected_schema_set_revision=self.schema_set_revision,
            )

        wrong_backend = self._identity("authorization_request")
        wrong_backend["backend_identity"] = {"source_revision": "other"}
        with self.assertRaisesRegex(HarnessContractError, "Backend identity"):
            validate_document(
                "exploration_authorization_request",
                wrong_backend,
                expected_backend_identity=self.backend_identity,
            )

        wrong_page = self._identity("session")
        wrong_page["allowed_pages"] = ["https://evil.invalid"]
        with self.assertRaisesRegex(HarnessContractError, "published page/action"):
            validate_document("exploration_session", wrong_page)

    def test_support_dtos_are_closed_without_fabricating_top_level_identity(self):
        support = {
            "provenance": self.provenance,
            "budget": self.budget,
            "objective": self.objective,
            "parameter_grant": self.grant,
        }
        for name, document in support.items():
            with self.subTest(name=name):
                result = validate_document(f"exploration_{name}", document)
                self.assertIs(result, document)
                with self.assertRaisesRegex(HarnessContractError, "Unknown fields"):
                    validate_document(f"exploration_{name}", {**document, "schema_identity": "spoof"})
                missing = dict(document)
                missing.pop(next(iter(document)))
                with self.assertRaisesRegex(HarnessContractError, "Required field"):
                    validate_document(f"exploration_{name}", missing)

    def test_authorization_response_is_a_closed_known_envelope(self):
        response = self._response()
        self.assertIs(
            validate_document(
                "exploration_authorization_response",
                response,
                expected_schema_set_revision=self.schema_set_revision,
                expected_backend_identity=self.backend_identity,
            ),
            response,
        )
        with self.assertRaisesRegex(HarnessContractError, "Unknown fields"):
            validate_document("exploration_authorization_response", {**response, "credential": "forbidden"})
        missing = dict(response)
        missing.pop("authorization")
        with self.assertRaisesRegex(HarnessContractError, "Required field"):
            validate_document("exploration_authorization_response", missing)
        nested = self._response()
        nested["authorization"]["schema_identity"] = "tilesim.agent_harness.exploration_authorization.v1"
        with self.assertRaisesRegex(HarnessContractError, "schema identity"):
            validate_document("exploration_authorization_response", nested)


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
        self.original_agent_harness_store = server.agent_harness_store
        if server.agent_harness_queue is not None:
            server.agent_harness_queue.stop()
        server.agent_harness_store = DurableHarnessStore(Path(self.temp.name) / "harness-http.sqlite3")
        server.agent_harness_queue = None
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
        self.server.agent_harness_store = self.original_agent_harness_store
        self.server.agent_deletion_coordinator.stores["harness"] = self.original_agent_harness_store
        self.server.agent_harness_queue = None
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

    def test_http_event_replay_rejects_noncanonical_cursors(self):
        status, created = self.request("/api/agent/operations", {"operation_kind": "read_only", "idempotency_key": "http-cursor"})
        self.assertEqual(status, HTTPStatus.ACCEPTED)
        operation_id = created["operation"]["operation_id"]
        for cursor in ("+1", "-0", "", "9" * 5000):
            with self.subTest(cursor=cursor[:8] or "empty"):
                status, payload = self.request(
                    f"/api/agent/operations/{operation_id}/events",
                    headers={"Last-Event-ID": cursor},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"]["code"], "invalid_last_event_id")

    def test_http_recovery_boundary_is_terminal_for_replay_and_sse(self):
        if self.server.agent_harness_queue is not None:
            self.server.agent_harness_queue.stop()
            self.server.agent_harness_queue = None
        operation, replayed = self.server.agent_harness_store.create_operation(
            idempotency_key="http-recovery-boundary",
            request_payload={"operation_kind": "read_only"},
            schema_set_revision=self.server.SCHEMA_SET_REVISION,
            backend_identity=self.server.harness_backend_identity(),
            principal="local-user",
        )
        self.assertFalse(replayed)
        operation_id = operation["operation_id"]
        self.server.agent_harness_store.transition(operation_id, "recovery_required", expected={"queued"})
        self.server.harness_operation_event(operation_id, node="recovery", state="recovery_required", terminal=True)

        status, replay = self.request(f"/api/agent/operations/{operation_id}/events")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(replay["terminal"])
        self.assertEqual(replay["operation"]["workflow_state"], "recovery_required")

        request = urllib.request.Request(
            f"{self.base}/api/agent/operations/{operation_id}/events/stream",
            headers={**self.headers, "Accept": "text/event-stream"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            stream = response.read().decode("utf-8")
        self.assertIn("event: terminal", stream)
        self.assertIn('"state":"recovery_required"', stream)


if __name__ == "__main__":
    unittest.main()
