from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
from pathlib import Path

from agent_harness.contracts import canonical_sha256
from agent_harness.optimization import OptimizationStore


class OptimizationHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        import server

        self.server = server
        self.temp = tempfile.TemporaryDirectory()
        self.original_agent_harness_store = server.agent_harness_store
        self.original_optimization_store = server.optimization_store
        if server.agent_harness_queue is not None:
            server.agent_harness_queue.stop()
        server.agent_harness_store = server.DurableHarnessStore(Path(self.temp.name) / "harness.sqlite3")
        server.agent_harness_queue = None
        server.optimization_store = OptimizationStore(Path(self.temp.name) / "optimization.sqlite3")
        server.original_formal = server._stage3_formal_run_request
        server.original_snapshot = server.run_snapshot
        server.original_manifest = server.artifact_manifest_for
        server.original_safe = server.safe_run_directory
        server.original_artifact = server._harness_artifact
        server.original_validate_manifest = server._stage3_validate_manifest
        server.original_timeout = server.EXECUTION_TIMEOUT_SECONDS
        server._stage3_formal_run_request = lambda request, *, idempotency_key, principal: (202, {"run_id": "run-opt-test"})
        server.run_snapshot = lambda _run_id: {"run_id": "run-opt-test", "status": "completed", "fidelity_policy": "des", "resolved_fidelity_policy": "des", "trace_provenance": {"source_mode": "synthetic_trace", "claim_scope": "exploratory"}}
        server.artifact_manifest_for = lambda _run_id, _run_dir: {"schema_version": server.ARTIFACT_MANIFEST_SCHEMA, "api_version": server.API_VERSION, "schema_set_revision": server.SCHEMA_SET_REVISION, "run_id": "run-opt-test", "artifacts": [], "rejected_artifacts": []}
        server._stage3_validate_manifest = lambda manifest, *, run_id, run_dir: manifest
        server.safe_run_directory = lambda _run_id: Path(self.temp.name)
        server.EXECUTION_TIMEOUT_SECONDS = 2.0
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True); self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.headers = {"Content-Type": "application/json", "X-TileSim-Principal": "local-user", "X-TileSim-Workspace": "local-workspace", "X-TileSim-Scopes": "agent:write_draft,agent:approve_draft,agent:submit_experiment,agent:read_run,agent:read_evidence,agent:cancel_experiment,agent:resume_experiment"}

    def tearDown(self) -> None:
        self.server._stage3_formal_run_request = self.server.original_formal
        self.server.run_snapshot = self.server.original_snapshot
        self.server.artifact_manifest_for = self.server.original_manifest
        self.server.safe_run_directory = self.server.original_safe
        self.server._harness_artifact = self.server.original_artifact
        self.server._stage3_validate_manifest = self.server.original_validate_manifest
        self.server.EXECUTION_TIMEOUT_SECONDS = self.server.original_timeout
        if self.server.agent_harness_queue is not None: self.server.agent_harness_queue.stop()
        self.httpd.shutdown(); self.httpd.server_close(); self.server.agent_harness_store.close(); self.server.optimization_store.close()
        self.server.agent_harness_store = self.original_agent_harness_store
        self.server.agent_deletion_coordinator.stores["harness"] = self.original_agent_harness_store
        self.server.optimization_store = self.original_optimization_store
        self.server.agent_deletion_coordinator.stores["optimization"] = self.original_optimization_store
        self.server.agent_harness_queue = None
        self.temp.cleanup()

    def call(self, path: str, payload: dict | None = None, *, key: str = "optimization-http-1"):
        headers = {**self.headers, "Idempotency-Key": key}
        request = urllib.request.Request(self.base + path, data=None if payload is None else json.dumps(payload).encode(), headers=headers, method="GET" if payload is None else "POST")
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.status, json.loads(response.read())

    def call_error(self, path: str, payload: dict, *, key: str):
        try:
            self.call(path, payload, key=key)
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())
        self.fail("expected an HTTP error")

    def stream(self, path: str, *, last_event_id: str | None = None):
        headers = {**self.headers, "Accept": "text/event-stream"}
        if last_event_id is not None:
            headers["Last-Event-ID"] = last_event_id
        request = urllib.request.Request(self.base + path, headers=headers, method="GET")
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.status, response.read().decode("utf-8"), response.headers

    def test_optimization_stream_publishes_named_agent_frames_without_duplicate_cursors(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {
            "schema_identity": "tilesim.agent_harness.optimization_session.v1",
            "contract_revision": "2026-10-19.wpd.v1",
            "input_snapshot_digest": canonical_sha256({"opt": "sse"}),
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
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-sse-create")
        session_id = created["session"]["session_id"]
        diagnostic_nodes = (
            "agent.step",
            "agent.tool_call",
            "agent.tool_result",
            "agent.verdict",
            "agent.degraded",
            "agent.ask_user",
        )
        for node in diagnostic_nodes:
            self.server.optimization_store.record_agent_event(session_id, node, {"kind": node})

        status, stream, headers = self.stream(f"/api/agent/optimization/sessions/{session_id}/events/stream")
        self.assertEqual(status, 200)
        self.assertIn("text/event-stream", headers.get("Content-Type", ""))
        self.assertEqual(stream.count("event: workflow"), len(diagnostic_nodes) + 1)
        for node in diagnostic_nodes:
            self.assertEqual(stream.count(f"event: {node}"), 1)
        self.assertEqual(stream.count("id: 1"), 1)
        self.assertEqual(stream.count("id: 7"), 1)

        replay_status, replay, _ = self.stream(
            f"/api/agent/optimization/sessions/{session_id}/events/stream", last_event_id="1"
        )
        self.assertEqual(replay_status, 200)
        self.assertNotIn('"sequence":1', replay)
        self.assertIn('"sequence":7', replay)
        self.assertEqual(replay.count("event: workflow"), len(diagnostic_nodes))
        for node in diagnostic_nodes:
            self.assertEqual(replay.count(f"event: {node}"), 1)
        self.assertEqual(replay.count("id: 7"), 1)

    def test_event_replay_rejects_signed_empty_and_unbounded_cursors(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {
            "schema_identity": "tilesim.agent_harness.optimization_session.v1",
            "contract_revision": "2026-10-19.wpd.v1",
            "input_snapshot_digest": canonical_sha256({"opt": "cursor-validation"}),
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "constraints": [], "budget": {"max_iterations": 1, "max_runs": 1},
            "base_config": request, "execution_request": request,
            "local_dev": True, "automatic_submission": False,
        }
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-cursor-validation")
        session_id = created["session"]["session_id"]
        for cursor in ("+1", "-0", "", "9" * 5000):
            with self.subTest(cursor=cursor[:8] or "empty"):
                with self.assertRaises(urllib.error.HTTPError) as raised:
                    self.stream(f"/api/agent/optimization/sessions/{session_id}/events/stream", last_event_id=cursor)
                self.assertEqual(raised.exception.code, 400)
                payload = json.loads(raised.exception.read())
                self.assertEqual(payload["error"]["code"], "invalid_last_event_id")

    def test_manual_approval_starts_formal_execution_and_preserves_provenance(self) -> None:
        health_status, health = self.call("/api/health")
        self.assertEqual(health_status, 200)
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {"schema_identity": "tilesim.agent_harness.optimization_session.v1", "contract_revision": "2026-10-19.wpd.v1", "input_snapshot_digest": canonical_sha256({"opt": "snapshot"}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": self.server.harness_backend_identity(), "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize"}, "constraints": [], "budget": {"max_iterations": 1, "max_runs": 1, "max_seconds": 60, "max_concurrency": 1, "max_failures": 1}, "base_config": request, "execution_request": request, "local_dev": True, "automatic_submission": False}
        status, created = self.call("/api/agent/optimization/sessions", body, key="optimization-http-create")
        self.assertEqual(status, 201)
        session = created["session"]; candidate = created["detail"]["candidate"]
        self.assertEqual(session["state"], "waiting_approval")
        self.assertEqual(created["provenance"]["production_status"], "not_for_production")
        status, approved = self.call(f"/api/agent/optimization/sessions/{session['session_id']}/candidates/{candidate['candidate_id']}/approve", {}, key="optimization-http-approve")
        self.assertEqual(status, 202)
        self.assertEqual(approved["approval"]["status"], "approved")
        deadline = time.monotonic() + 5
        final = None
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/optimization/sessions/{session['session_id']}")
            final = snapshot["detail"]["session"]
            if final["state"] in {"completed", "failed", "recovery_required"}: break
            time.sleep(0.1)
        self.assertIsNotNone(final)
        self.assertIn(final["state"], {"completed", "failed", "recovery_required"})
        _, events = self.call(f"/api/agent/optimization/sessions/{session['session_id']}/events")
        self.assertGreaterEqual(len(events["events"]), 3)
        self.assertEqual(events["provenance"]["source_mode"], "synthetic_trace")

    def test_completed_execution_reads_only_verified_metric_and_stops_at_budget(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        metric_sha = "a" * 64
        self.server.artifact_manifest_for = lambda _run_id, _run_dir: {
            "schema_version": self.server.ARTIFACT_MANIFEST_SCHEMA,
            "api_version": self.server.API_VERSION,
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "run_id": "run-opt-test",
            "artifacts": [{"artifact_id": "metrics", "file_name": "metrics.json", "schema_identity": "tilesim.metrics-report.v1", "bytes": 24, "sha256": metric_sha}],
            "rejected_artifacts": [],
        }
        self.server._harness_artifact = lambda _run_id, _artifact_id: {"document": {"tail_latency_summary": {"ttft_ps": {"p95_ps": 42}}}, "sha256": metric_sha, "bytes": 24}
        body = {"schema_identity": "tilesim.agent_harness.optimization_session.v1", "contract_revision": "2026-10-19.wpd.v1", "input_snapshot_digest": canonical_sha256({"opt": "verified"}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": self.server.harness_backend_identity(), "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize"}, "constraints": [], "budget": {"max_iterations": 1, "max_runs": 1, "max_seconds": 60, "max_concurrency": 1, "max_failures": 1}, "base_config": request, "execution_request": request, "local_dev": True, "automatic_submission": False}
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-verified-create")
        session = created["session"]; candidate = created["detail"]["candidate"]
        self.call(f"/api/agent/optimization/sessions/{session['session_id']}/candidates/{candidate['candidate_id']}/approve", {}, key="optimization-verified-approve")
        deadline = time.monotonic() + 6
        final_detail = None
        while time.monotonic() < deadline:
            _, snapshot = self.call(f"/api/agent/optimization/sessions/{session['session_id']}")
            final_detail = snapshot["detail"]
            if final_detail["session"]["state"] in {"completed", "failed", "recovery_required"}:
                break
            time.sleep(0.1)
        self.assertIsNotNone(final_detail)
        self.assertEqual(final_detail["session"]["state"], "completed")
        self.assertEqual(final_detail["evaluations"][0]["objective"]["value"], 42)
        self.assertEqual(final_detail["summary"]["stop_reason"]["reason"], "iteration_limit")
        self.assertTrue(any(item["tool_name"] == "query_verified_metrics" for item in final_detail["tool_invocations"]))

    def test_recovery_resume_requires_ack_and_creates_fresh_approval_fence(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {"schema_identity": "tilesim.agent_harness.optimization_session.v1", "contract_revision": "2026-10-19.wpd.v1", "input_snapshot_digest": canonical_sha256({"opt": "recovery"}), "schema_set_revision": self.server.SCHEMA_SET_REVISION, "backend_identity": self.server.harness_backend_identity(), "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps"}, "constraints": [], "budget": {"max_iterations": 2}, "base_config": request, "execution_request": request, "local_dev": True, "automatic_submission": False}
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-recovery-create")
        session_id = created["session"]["session_id"]
        self.server.optimization_store.transition(session_id, "queued", expected={"waiting_approval"})
        self.server.optimization_store.transition(session_id, "recovery_required", expected={"queued"}, error={"code": "unknown_outcome", "unknown_outcome": True})
        status, error = self.call_error(f"/api/agent/optimization/sessions/{session_id}/resume", {"session_id": session_id, "action": "resume"}, key="optimization-recovery-no-ack")
        self.assertEqual(status, 409)
        self.assertEqual(error["error"]["code"], "recovery_acknowledgement_required")
        status, resumed = self.call(f"/api/agent/optimization/sessions/{session_id}/resume", {"session_id": session_id, "action": "resume", "recovery_acknowledged": True}, key="optimization-recovery-ack")
        self.assertEqual(status, 200)
        self.assertEqual(resumed["session"]["state"], "waiting_approval")
        self.assertEqual(len(resumed["detail"]["candidates"]), 2)

    def test_manual_intervention_is_a_terminal_observation_for_replay(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {
            "schema_identity": "tilesim.agent_harness.optimization_session.v1",
            "contract_revision": "2026-10-19.wpd.v1",
            "input_snapshot_digest": canonical_sha256({"opt": "manual-terminal"}),
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "constraints": [], "budget": {"max_iterations": 1, "max_runs": 1},
            "base_config": request, "execution_request": request,
            "local_dev": True, "automatic_submission": False,
        }
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-manual-terminal")
        session_id = created["session"]["session_id"]
        self.server.optimization_store.transition(session_id, "queued", expected={"waiting_approval"})
        self.server.optimization_store.transition(
            session_id,
            "recovery_required",
            expected={"queued"},
            error={"code": "unknown_outcome", "unknown_outcome": True},
        )
        self.server.optimization_store.transition(session_id, "manual_intervention_required", expected={"recovery_required"})
        status, replay = self.call(f"/api/agent/optimization/sessions/{session_id}/events")
        self.assertEqual(status, 200)
        self.assertTrue(replay["terminal"])
        status, stream, _headers = self.stream(f"/api/agent/optimization/sessions/{session_id}/events/stream")
        self.assertEqual(status, 200)
        self.assertIn('event: terminal', stream)
        self.assertIn('"state":"manual_intervention_required"', stream)

    def test_event_replay_fails_closed_on_a_durable_sequence_gap(self) -> None:
        request = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        body = {
            "schema_identity": "tilesim.agent_harness.optimization_session.v1",
            "contract_revision": "2026-10-19.wpd.v1",
            "input_snapshot_digest": canonical_sha256({"opt": "event-gap"}),
            "schema_set_revision": self.server.SCHEMA_SET_REVISION,
            "backend_identity": self.server.harness_backend_identity(),
            "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "constraints": [], "budget": {"max_iterations": 1, "max_runs": 1},
            "base_config": request, "execution_request": request,
            "local_dev": True, "automatic_submission": False,
        }
        _, created = self.call("/api/agent/optimization/sessions", body, key="optimization-event-gap")
        session_id = created["session"]["session_id"]
        self.server.optimization_store.record_agent_event(session_id, "agent.step", {"kind": "gap"})
        self.server.optimization_store.db.execute(
            "UPDATE events SET sequence=sequence+1 WHERE session_id=? AND sequence=2",
            (session_id,),
        )
        with self.assertRaises(urllib.error.HTTPError) as raised:
            self.call(f"/api/agent/optimization/sessions/{session_id}/events")
        self.assertEqual(raised.exception.code, 409)
        payload = json.loads(raised.exception.read())
        self.assertEqual(payload["error"]["code"], "event_sequence_gap")


if __name__ == "__main__":
    unittest.main()
