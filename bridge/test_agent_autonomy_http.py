from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from agent_harness.contracts import canonical_sha256
from agent_harness.optimization import OptimizationStore


class OptimizationAuthorizationHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        import server

        self.server = server
        self.temp = tempfile.TemporaryDirectory()
        self.original_optimization_store = server.optimization_store
        server.optimization_store = OptimizationStore(Path(self.temp.name) / "optimization.sqlite3")
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.headers = {
            "Content-Type": "application/json",
            "X-TileSim-Principal": "local-user",
            "X-TileSim-Workspace": "local-workspace",
            "X-TileSim-Scopes": "agent:write_draft,agent:read_draft,agent:approve_draft",
        }

    def tearDown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.server.optimization_store.close()
        self.server.optimization_store = self.original_optimization_store
        self.server.agent_deletion_coordinator.stores["optimization"] = self.original_optimization_store
        self.temp.cleanup()

    def request(self, path: str, payload: dict | None = None, *, scopes: str | None = None, key: str = "authz-http-key"):
        headers = {**self.headers, "Idempotency-Key": key}
        if scopes is not None:
            headers["X-TileSim-Scopes"] = scopes
        request = urllib.request.Request(
            self.base + path,
            data=None if payload is None else json.dumps(payload).encode(),
            headers=headers,
            method="GET" if payload is None else "POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def create_session(self) -> str:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {
            "schema_identity": "tilesim.agent_harness.optimization_session.v1",
            "contract_revision": "2026-10-19.wpd.v1",
            "input_snapshot_digest": canonical_sha256({"authz": "snapshot"}),
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "constraints": [],
            "budget": {"max_iterations": 1, "max_runs": 1},
            "base_config": request,
            "execution_request": request,
            "local_dev": True,
            "automatic_submission": False,
        }
        status, response = self.request("/api/agent/optimization/sessions", body, key="authz-session-key")
        self.assertEqual(status, 201)
        return response["session"]["session_id"]

    def test_authorization_requires_approve_scope_and_is_bound(self) -> None:
        session_id = self.create_session()
        body = {
            "autonomy_level": "human_approves_each",
            "parameter_grants": [{"pointer": "/overrides/0", "min": 1, "max": 4, "step": 1, "kind": "int"}],
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "budget": {
                "max_rounds": 1,
                "max_runs": 1,
                "max_seconds": 60,
                "max_failures": 1,
                "max_model_calls": 2,
                "max_tool_calls_per_round": 1,
                "max_navigation_attempts": 1,
                "max_run_creations": 1,
                "max_execution_time_ms": 60_000,
            },
            "tool_allowlist": ["query_verified_metrics"],
            "allowed_pages": ["overview", "execution"],
            "allowed_actions": ["navigate", "execute"],
        }
        status, denied = self.request(f"/api/agent/optimization/sessions/{session_id}/authorization", body, scopes="agent:read_draft", key="authz-denied-key")
        self.assertEqual(status, 403)
        self.assertEqual(denied["error"]["code"], "scope_denied")
        status, created = self.request(f"/api/agent/optimization/sessions/{session_id}/authorization", body, key="authz-create-key")
        self.assertEqual(status, 201)
        authorization = created["authorization"]
        self.assertEqual(authorization["principal"], "local-user")
        self.assertEqual(authorization["workspace_id"], "local-workspace")
        self.assertEqual(authorization["schema_set_revision"], self.server.SCHEMA_SET_REVISION)
        self.assertEqual(authorization["budget"]["max_model_calls"], 2)
        self.assertEqual(authorization["budget"]["max_tool_calls_per_round"], 1)
        replay_status, replayed = self.request(
            f"/api/agent/optimization/sessions/{session_id}/authorization",
            body,
            key="authz-create-key",
        )
        self.assertEqual(replay_status, 200)
        self.assertTrue(replayed["idempotent_replay"])
        self.assertEqual(replayed["authorization"]["authorization_digest"], authorization["authorization_digest"])
        mismatch_status, mismatch = self.request(
            f"/api/agent/optimization/sessions/{session_id}/authorization",
            {**body, "ttl_seconds": 120},
            key="authz-create-key",
        )
        self.assertEqual(mismatch_status, 409)
        self.assertEqual(mismatch["error"]["code"], "idempotency_payload_mismatch")
        status, current = self.request(f"/api/agent/optimization/sessions/{session_id}/authorization")
        self.assertEqual(status, 200)
        self.assertEqual(current["authorization"]["authorization_digest"], authorization["authorization_digest"])
        status, revoked = self.request(f"/api/agent/optimization/sessions/{session_id}/authorization/revoke", {}, key="authz-revoke-key")
        self.assertEqual(status, 200)
        self.assertEqual(revoked["authorization"]["status"], "revoked")
        replay_status, replayed_revoke = self.request(
            f"/api/agent/optimization/sessions/{session_id}/authorization/revoke", {}, key="authz-revoke-key"
        )
        self.assertEqual(replay_status, 200)
        self.assertTrue(replayed_revoke["idempotent_replay"])
        self.assertEqual(
            replayed_revoke["authorization"]["authorization_digest"],
            revoked["authorization"]["authorization_digest"],
        )
        mismatch_status, mismatch_revoke = self.request(
            f"/api/agent/optimization/sessions/{session_id}/authorization/revoke",
            {"reason": "different"},
            key="authz-revoke-key",
        )
        self.assertEqual(mismatch_status, 409)
        self.assertEqual(mismatch_revoke["error"]["code"], "idempotency_payload_mismatch")


if __name__ == "__main__":
    unittest.main()
