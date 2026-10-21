"""Stage-2 draft/validation/approval security and zero-side-effect tests."""
from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from agent_harness.contracts import canonical_sha256
from agent_harness.store import DurableHarnessStore, HarnessStoreError


class Stage2HttpTest(unittest.TestCase):
    def setUp(self):
        import server
        self.server = server
        self.tmp = tempfile.TemporaryDirectory()
        server.agent_harness_store = DurableHarnessStore(Path(self.tmp.name) / "stage2.sqlite")
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.snapshot = canonical_sha256({"page": "draft-test"})
        self.headers = {"Content-Type": "application/json", "X-TileSim-Scopes": "agent:read_draft,agent:write_draft,agent:approve_draft,agent:read_capability"}
        self.request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close(); self.server.agent_harness_store.close(); self.tmp.cleanup()

    def call(self, path, payload=None, *, method=None, headers=None):
        h = dict(self.headers); h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=None if payload is None else json.dumps(payload).encode(), headers=h, method=method or ("POST" if payload is not None else "GET"))
        try:
            response = urllib.request.urlopen(req, timeout=5)
            return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def draft_payload(self, **extra):
        value = {"workspace_id": "local-workspace", "run_scope": "draft-only", "input_snapshot_digest": self.snapshot, "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": self.server.harness_backend_identity(), "parameter_catalog_revision": "catalog-v1", "validator_revision": "validator-v1", "field_diffs": [], "assumptions": [], "evidence_refs": [], "budget_request": {}, "risk_flags": [], "create_run_request": self.request}
        value.update(extra); return value

    def make_draft(self, key="draft-key-01"):
        status, body = self.call("/api/agent/drafts", self.draft_payload(), headers={"Idempotency-Key": key})
        self.assertEqual(status, 201, body); return body["draft"]

    def validate(self, draft, key="validate-key-01", payload=None, **headers):
        h = {"Idempotency-Key": key, "X-TileSim-Input-Snapshot": self.snapshot}; h.update(headers)
        return self.call(f"/api/agent/drafts/{draft['draft_id']}/validate", payload if payload is not None else {"create_run_request": self.request}, headers=h)

    def test_01_create_is_run_free(self):
        before = len(self.server.runs); draft = self.make_draft(); self.assertFalse(draft.get("would_create_run")); self.assertEqual(len(self.server.runs), before)

    def test_02_validate_is_run_free(self):
        draft = self.make_draft(); status, body = self.validate(draft); self.assertEqual(status, 200); self.assertFalse(body["validation"]["would_create_run"]); self.assertEqual(len(self.server.runs), 0)

    def test_03_approval_is_run_free(self):
        draft = self.make_draft(); _, report = self.validate(draft); status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}/approvals", {"validation_id": report["validation"]["validation_id"], "expires_at": "2099-01-01T00:00:00+00:00"}, headers={"Idempotency-Key": "approval-key-01"}); self.assertEqual(status, 201); self.assertFalse(body["would_create_run"]); self.assertEqual(len(self.server.runs), 0)

    def test_04_reject_is_run_free(self):
        approval = self._approval(); status, body = self.call(f"/api/agent/drafts/{approval['draft_id']}/approvals/{approval['approval_id']}/reject", {"reason": "manual"}, headers={"Idempotency-Key": "reject-key-01"}); self.assertEqual(status, 200); self.assertEqual(body["approval"]["status"], "rejected"); self.assertEqual(len(self.server.runs), 0)

    def test_05_revoke_is_run_free(self):
        approval = self._approval(); status, body = self.call(f"/api/agent/drafts/{approval['draft_id']}/approvals/{approval['approval_id']}/revoke", {"reason": "changed"}, headers={"Idempotency-Key": "revoke-key-01"}); self.assertEqual(status, 200); self.assertEqual(body["approval"]["status"], "revoked")

    def test_06_same_draft_key_replays(self):
        first = self.make_draft(); status, replay = self.call("/api/agent/drafts", self.draft_payload(), headers={"Idempotency-Key": "draft-key-01"}); self.assertEqual(status, 200); self.assertTrue(replay["idempotent_replay"]); self.assertEqual(first["draft_id"], replay["draft"]["draft_id"])

    def test_06b_same_validation_key_replays_and_conflicts_on_payload_change(self):
        draft = self.make_draft("draft-key-validation-replay")
        status, first = self.validate(draft, "validate-key-replay")
        self.assertEqual(status, 200)
        status, replay = self.validate(draft, "validate-key-replay")
        self.assertEqual(status, 200)
        self.assertTrue(replay["idempotent_replay"])
        self.assertEqual(first["validation"]["validation_id"], replay["validation"]["validation_id"])
        status, body = self.validate(draft, "validate-key-replay", payload={"create_run_request": {"scenario_id": "not-allow-listed"}})
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "idempotency_payload_mismatch")

    def test_07_different_payload_same_key_conflicts(self):
        self.make_draft(); payload = self.draft_payload(run_scope="other"); status, body = self.call("/api/agent/drafts", payload, headers={"Idempotency-Key": "draft-key-01"}); self.assertEqual(status, 409); self.assertEqual(body["error"]["code"], "idempotency_payload_mismatch")

    def test_08_missing_idempotency_is_rejected(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload()); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "missing_idempotency_key")

    def test_09_unknown_field_fails_closed(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(poison="x"), headers={"Idempotency-Key": "draft-key-02"}); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "unknown_field")

    def test_10_principal_isolation(self):
        draft = self.make_draft(); status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}", headers={"X-TileSim-Principal": "other"}); self.assertEqual(status, 403); self.assertIn(body["error"]["code"], {"draft_access_denied", "scope_denied"})

    def test_11_workspace_isolation(self):
        draft = self.make_draft(); status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}", headers={"X-TileSim-Workspace": "other"}); self.assertEqual(status, 403); self.assertEqual(body["error"]["code"], "draft_access_denied")

    def test_12_snapshot_mismatch(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(input_snapshot_digest=canonical_sha256({"other": True})), headers={"Idempotency-Key": "draft-key-03", "X-TileSim-Input-Snapshot": self.snapshot}); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "snapshot_mismatch")

    def test_13_schema_mismatch(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(schema_set_revision="sha256:" + "0" * 64), headers={"Idempotency-Key": "draft-key-04"}); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "schema_revision_mismatch")

    def test_14_backend_mismatch(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(backend_identity={"source_revision": "poison"}), headers={"Idempotency-Key": "draft-key-05"}); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "backend_identity_mismatch")

    def test_15_invalid_request_is_not_approvable(self):
        draft = self.make_draft(); status, body = self.validate(draft, payload={"create_run_request": {"scenario_id": "not-allow-listed"}}); self.assertEqual(status, 200); self.assertEqual(body["validation"]["status"], "invalid"); status, _ = self.call(f"/api/agent/drafts/{draft['draft_id']}/approvals", {"validation_id": body["validation"]["validation_id"], "expires_at": "2099-01-01T00:00:00+00:00"}, headers={"Idempotency-Key": "approval-key-02"}); self.assertEqual(status, 409)

    def test_16_approval_digest_is_bound(self):
        approval = self._approval(); status, body = self.call(f"/api/agent/drafts/{approval['draft_id']}/approvals/{approval['approval_id']}", headers={"X-TileSim-Principal": "other"}); self.assertEqual(status, 403); self.assertIn(body["error"]["code"], {"approval_access_denied", "scope_denied"})

    def test_17_delete_is_run_free_and_not_readable(self):
        draft = self.make_draft(); status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}", method="DELETE", headers={"Idempotency-Key": "delete-key-01"}); self.assertEqual(status, 200); self.assertTrue(body["deleted"]); self.assertEqual(len(self.server.runs), 0); status, _ = self.call(f"/api/agent/drafts/{draft['draft_id']}"); self.assertEqual(status, 404)

    def test_18_events_replay(self):
        draft = self.make_draft(); status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}/events"); self.assertEqual(status, 200); self.assertGreaterEqual(len(body["events"]), 1); self.assertEqual(body["events"][0]["draft_id"], draft["draft_id"])

    def test_18b_events_accept_read_scope_without_write_scope(self):
        draft = self.make_draft("draft-key-read-events")
        status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}/events", headers={"X-TileSim-Scopes": "agent:read_draft"})
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(body["events"]), 1)

    def test_19_large_body_rejected(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(assumptions=["x" * 512] * 300), headers={"Idempotency-Key": "draft-key-06"}); self.assertEqual(status, 400); self.assertEqual(body["error"]["code"], "invalid_field")

    def test_20_malicious_json_pointer_is_rejected(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(field_diffs=[{"field_id": "x", "json_pointer": "/a#b", "change": "replace"}]), headers={"Idempotency-Key": "draft-key-07"}); self.assertEqual(status, 400); self.assertIn(body["error"]["code"], {"invalid_json_pointer", "invalid_field"})

    def test_21_shell_url_and_path_are_data_not_capabilities(self):
        status, body = self.call("/api/agent/drafts", self.draft_payload(create_run_request={"shell": "rm -rf /", "url": "https://evil.invalid", "path": "C:/secret"}), headers={"Idempotency-Key": "draft-key-08"}); self.assertEqual(status, 201); self.assertIn(body["draft"]["status"], {"invalid", "draft"}); self.assertEqual(len(self.server.runs), 0)

    def test_22_replay_after_reject_does_not_reapprove(self):
        approval = self._approval(); self.call(f"/api/agent/drafts/{approval['draft_id']}/approvals/{approval['approval_id']}/reject", {"reason": "no"}, headers={"Idempotency-Key": "reject-key-02"}); status, body = self.call(f"/api/agent/drafts/{approval['draft_id']}/approvals/{approval['approval_id']}/revoke", {}, headers={"Idempotency-Key": "revoke-key-02"}); self.assertEqual(status, 409); self.assertEqual(body["error"]["code"], "approval_terminal")

    def test_23_expired_approval_is_not_approved(self):
        draft = self.make_draft("draft-key-expired"); _, report = self.validate(draft, "validate-key-expired")
        status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}/approvals", {"validation_id": report["validation"]["validation_id"], "expires_at": "2000-01-01T00:00:00+00:00"}, headers={"Idempotency-Key": "approval-key-expired"})
        self.assertEqual(status, 201); self.assertEqual(body["approval"]["status"], "expired")

    def _approval(self):
        draft = self.make_draft("draft-key-approval")
        _, report = self.validate(draft, "validate-key-approval")
        status, body = self.call(f"/api/agent/drafts/{draft['draft_id']}/approvals", {"validation_id": report["validation"]["validation_id"], "expires_at": "2099-01-01T00:00:00+00:00"}, headers={"Idempotency-Key": "approval-key-approval"})
        self.assertEqual(status, 201); return body["approval"]


class Stage2StoreReplayTest(unittest.TestCase):
    def test_24_single_use_approval_replay_fence(self):
        with tempfile.TemporaryDirectory() as root:
            store = DurableHarnessStore(Path(root) / "stage2.sqlite")
            document = {"schema_identity": "tilesim.agent_harness.approval.v2", "contract_revision": "2026-10-18.wpb.v1", "approval_id": "approval-test", "draft_id": "draft-test", "draft_digest": "sha256:" + "a" * 64, "validation_id": "validation-test", "principal": "local-user", "workspace_id": "local-workspace", "policy_revision": "tilesim.agent_harness.policy.v1", "schema_set_revision": "sha256:" + "b" * 64, "backend_identity": {"source_revision": "test"}, "status": "approved", "created_at": "2099-01-01T00:00:00+00:00", "expires_at": "2099-01-02T00:00:00+00:00", "approved_at": "2099-01-01T00:00:00+00:00", "rejected_at": None, "revoked_at": None, "reason": None, "approval_digest": "sha256:" + "c" * 64, "single_use": True, "consumed": False}
            op, _ = store.create_operation(idempotency_key="stage2-op", request_payload={"draft": "draft-test"}, schema_set_revision=document["schema_set_revision"], backend_identity=document["backend_identity"], principal="local-user")
            draft = {"draft_id": "draft-test", "operation_id": op["operation_id"], "principal": "local-user", "workspace_id": "local-workspace", "input_snapshot_digest": "sha256:" + "d" * 64, "schema_set_revision": document["schema_set_revision"], "backend_identity": document["backend_identity"], "parameter_catalog_revision": "catalog", "validator_revision": "validator", "policy_revision": "tilesim.agent_harness.policy.v1", "run_scope": "draft-only", "field_diffs": [], "assumptions": [], "evidence_refs": [], "budget_request": {}, "risk_flags": [], "status": "validated", "created_at": document["created_at"], "expires_at": document["expires_at"], "draft_digest": document["draft_digest"], "idempotency_key": "draft-key", "would_create_run": False}
            store.save_stage2_draft(draft, operation_id=op["operation_id"], idempotency_key="draft-key", draft_digest=draft["draft_digest"])
            store.save_stage2_approval(document, idempotency_key="approval-key")
            first = store.consume_stage2_approval("approval-test", draft_digest=draft["draft_digest"], validation_id="validation-test", principal="local-user", workspace_id="local-workspace", schema_set_revision=document["schema_set_revision"], backend_identity=document["backend_identity"])
            self.assertTrue(first["consumed"])
            with self.assertRaises(HarnessStoreError) as raised:
                store.consume_stage2_approval("approval-test", draft_digest=draft["draft_digest"], validation_id="validation-test", principal="local-user", workspace_id="local-workspace", schema_set_revision=document["schema_set_revision"], backend_identity=document["backend_identity"])
            self.assertEqual(raised.exception.code, "approval_replay")
            store.close()


if __name__ == "__main__":
    unittest.main()
