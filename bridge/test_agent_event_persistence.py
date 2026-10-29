import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path

import server
from agent_harness.optimization import OptimizationError, OptimizationStore


class AgentEventPersistenceTest(unittest.TestCase):
    def test_event_write_failure_is_bounded_unknown_outcome(self) -> None:
        with patch.object(server.optimization_store, "record_agent_event", side_effect=RuntimeError("disk full")):
            with self.assertRaises(OptimizationError) as captured:
                server._optimization_set_agent_event("opt-missing", "agent.step", {"kind": "test"})
        self.assertEqual(captured.exception.code, "event_persistence_failed")
        self.assertTrue(captured.exception.unknown_outcome)
        self.assertFalse(captured.exception.retryable)

    def test_waiting_approval_can_enter_recovery_after_audit_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": "tilesim.agent_harness.optimization_session.v1",
                "contract_revision": "2026-10-19.wpd.v1",
                "principal": "local-user",
                "workspace_id": "local",
                "input_snapshot_digest": "sha256:" + "a" * 64,
                "schema_set_revision": "sha256:" + "b" * 64,
                "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
                "objective": {"metric_path": "/metrics/p95", "direction": "minimize"},
                "constraints": [],
                "budget": {"max_iterations": 1},
                "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True,
                "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="audit-recovery")
            store.transition(session["session_id"], "queued", expected={"waiting_approval"})
            store.transition(session["session_id"], "running", expected={"queued"})
            store.transition(session["session_id"], "waiting_approval", expected={"running"})
            store.transition(
                session["session_id"],
                "recovery_required",
                expected={"waiting_approval"},
                error={"code": "event_persistence_failed", "unknown_outcome": True},
            )
            current = store.get(session["session_id"])
            self.assertEqual(current["state"], "recovery_required")
            self.assertTrue(current["error"]["unknown_outcome"])
            store.close()


if __name__ == "__main__":
    unittest.main()
