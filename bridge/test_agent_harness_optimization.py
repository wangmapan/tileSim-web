from __future__ import annotations

import tempfile
import unittest
import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from agent_harness.optimization import (
    CONTRACT_REVISION,
    PROVENANCE,
    SCHEMA_IDENTITIES,
    OptimizationError,
    OptimizationStore,
    canonical_sha256,
    validate_budget,
    validate_session_request,
)
from agent_harness.authorization import issue_authorization, revoke_authorization


class OptimizationContractTests(unittest.TestCase):
    def test_phase4_manifest_splits_are_disjoint_and_local_only(self) -> None:
        manifest_path = Path(__file__).parents[1] / "tests" / "fixtures" / "agent-harness" / "phase4-local-evaluation-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["publication_status"], "local_dev_only")
        self.assertFalse(manifest["fixture_results_are_live_evidence"])
        self.assertEqual(manifest["provenance"]["production_status"], "not_for_production")
        seen: set[str] = set()
        for case_ids in manifest["splits"].values():
            self.assertTrue(seen.isdisjoint(case_ids))
            seen.update(case_ids)
        self.assertEqual(seen, {case["id"] for case in manifest["cases"]})

    def test_budget_is_bounded_and_closed(self) -> None:
        self.assertEqual(validate_budget({"max_iterations": 2})["max_iterations"], 2)
        with self.assertRaisesRegex(OptimizationError, "closed"):
            validate_budget({"shell": True})
        with self.assertRaises(OptimizationError):
            validate_budget({"max_concurrency": 2})

    def test_session_requires_explicit_local_dev_and_manual_approval(self) -> None:
        identity = {"source_revision": "source", "versions_match": True}
        base = {
            "schema_identity": SCHEMA_IDENTITIES["session"],
            "contract_revision": CONTRACT_REVISION,
            "input_snapshot_digest": canonical_sha256({"snapshot": 1}),
            "schema_set_revision": canonical_sha256({"schema": 1}),
            "backend_identity": identity,
            "objective": {"metric_path": "/tail_latency_summary/ttft_ps/p95_ps", "direction": "minimize"},
            "constraints": [],
            "budget": {"max_iterations": 2},
            "base_config": {"scenario_id": "s1_des_example"},
            "local_dev": True,
            "automatic_submission": False,
        }
        normalized = validate_session_request(base, principal="local-user", workspace_id="local", schema_set_revision=base["schema_set_revision"], backend_identity=identity)
        self.assertTrue(normalized["local_dev"])
        with self.assertRaisesRegex(OptimizationError, "Automatic"):
            validate_session_request({**base, "automatic_submission": True}, principal="local-user", workspace_id="local", schema_set_revision=base["schema_set_revision"], backend_identity=identity)
        bootstrap = validate_session_request(
            {**base, "autonomy": "auto"},
            principal="local-user",
            workspace_id="local",
            schema_set_revision=base["schema_set_revision"],
            backend_identity=identity,
        )
        self.assertEqual(bootstrap["autonomy"], "auto")
        self.assertIsNone(bootstrap["authorization_id"])

    def test_store_approval_event_and_checkpoint_are_durable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            session_document = {
                "schema_identity": SCHEMA_IDENTITIES["session"],
                "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local",
                "input_snapshot_digest": canonical_sha256({"snapshot": 1}),
                "schema_set_revision": canonical_sha256({"schema": 1}),
                "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1",
                "objective": {"metric_path": "/metrics/p95", "direction": "minimize"}, "constraints": [],
                "budget": {"max_iterations": 2, "max_runs": 2, "max_seconds": 60, "max_concurrency": 1, "max_failures": 1},
                "base_config": {"scenario_id": "s1_des_example"}, "local_dev": True, "automatic_submission": False,
            }
            session, replay = store.create(session_document, idempotency_key="optimization-test-create")
            self.assertFalse(replay)
            self.assertEqual(session["state"], "waiting_approval")
            candidate = store.candidate(session["session_id"])
            assert candidate is not None
            approval_digest = canonical_sha256({"candidate_digest": candidate["candidate_digest"], "session_id": session["session_id"]})
            approval = store.approve(session["session_id"], candidate["candidate_id"], principal="local-user", digest=approval_digest, expires_at="2099-01-01T00:00:00+00:00")
            self.assertEqual(approval["status"], "approved")
            detail = store.detail(session["session_id"])
            assert detail is not None
            self.assertGreaterEqual(len(detail["events"]), 2)
            checkpoint = store.save_checkpoint(session["session_id"], {"candidate_digest": candidate["candidate_digest"]})
            self.assertEqual(checkpoint["schema_identity"], SCHEMA_IDENTITIES["checkpoint"])
            self.assertEqual(store.get(session["session_id"])["state"], "queued")
            store.close()

    def test_waiting_user_does_not_reopen_an_already_approved_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            identity = {"source_revision": "source", "versions_match": True}
            session = {
                "schema_identity": SCHEMA_IDENTITIES["session"],
                "contract_revision": CONTRACT_REVISION,
                "input_snapshot_digest": canonical_sha256({"snapshot": "duplicate"}),
                "schema_set_revision": canonical_sha256({"schema": "duplicate"}),
                "backend_identity": identity,
                "objective": {"metric_path": "/metric", "direction": "minimize"},
                "constraints": [],
                "budget": {"max_iterations": 2},
                "base_config": {"scenario_id": "s1_des_example", "width": 2},
                "local_dev": True,
                "automatic_submission": False,
                "principal": "local-user",
                "workspace_id": "local",
            }
            try:
                created, _replay = store.create(session, idempotency_key="duplicate-session")
                candidate = store.candidate(created["session_id"])
                self.assertIsNotNone(candidate)
                approval_digest = canonical_sha256({"candidate_digest": candidate["candidate_digest"], "session_id": created["session_id"]})
                store.approve(created["session_id"], candidate["candidate_id"], principal="local-user", digest=approval_digest, expires_at="2099-01-01T00:00:00+00:00")
                store.mark_candidate_waiting_approval(created["session_id"], candidate["candidate_id"])
                preserved = store.candidate(created["session_id"], candidate["candidate_id"])
                self.assertEqual(preserved["status"], "approved")
                with self.assertRaises(OptimizationError):
                    store.approve(created["session_id"], candidate["candidate_id"], principal="local-user", digest=approval_digest, expires_at="2099-01-01T00:00:00+00:00")
            finally:
                store.close()

    def test_unknown_tool_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            with self.assertRaisesRegex(OptimizationError, "allowlist"):
                store.record_tool("missing", "shell", {}, iteration_id=None, idempotency_key="tool-test")
            store.close()

    def test_approval_is_single_use_and_terminal_states_are_fenced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": 2}),
                "schema_set_revision": canonical_sha256({"schema": 2}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-fence-test")
            candidate = store.candidate(session["session_id"])
            assert candidate is not None
            digest = canonical_sha256({"candidate_digest": candidate["candidate_digest"], "session_id": session["session_id"]})
            approval = store.approve(session["session_id"], candidate["candidate_id"], principal="local-user", digest=digest, expires_at="2099-01-01T00:00:00+00:00")
            store.consume_approval(session["session_id"], approval["approval_id"], principal="local-user", candidate_digest=candidate["candidate_digest"])
            with self.assertRaisesRegex(OptimizationError, "single-use"):
                store.consume_approval(session["session_id"], approval["approval_id"], principal="local-user", candidate_digest=candidate["candidate_digest"])
            store.transition(session["session_id"], "failed", expected={"queued"})
            with self.assertRaisesRegex(OptimizationError, "Terminal"):
                store.transition(session["session_id"], "running", expected={"failed"})
            store.close()

    def test_autonomous_consume_rechecks_active_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": "authz"}),
                "schema_set_revision": canonical_sha256({"schema": "authz"}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-authz-fence")
            auth = issue_authorization(
                session=session,
                grants=[{"pointer": "/devices/0/width", "min": 1, "max": 64, "step": 1, "kind": "int"}],
                objective={"metric_path": "/metrics/p95", "direction": "minimize"},
                budget={"max_rounds": 2, "max_runs": 2, "max_seconds": 60, "max_failures": 1, "max_model_calls": 2, "max_tool_calls_per_round": 1, "max_navigation_attempts": 2, "max_run_creations": 1, "max_execution_time_ms": 60_000},
                tool_allowlist=["query_verified_metrics"], autonomy_level="bounded_autonomous", issued_by="local-user",
                allowed_pages=["overview", "execution"], allowed_actions=["navigate", "execute"],
            )
            store.set_authorization(session["session_id"], auth)
            self.assertEqual(store.get(session["session_id"])["autonomy"], "auto")
            candidate = store.candidate(session["session_id"])
            assert candidate is not None
            grant = store.approve_autonomous(session["session_id"], candidate["candidate_id"], principal="local-user", authorization_digest=auth["authorization_digest"], expires_at=(datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat())
            entered = threading.Event()
            revoked = threading.Event()

            def revoke_while_fenced() -> None:
                entered.wait(2)
                store.revoke_authorization(session["session_id"], revoke_authorization(auth, actor="local-user"))
                revoked.set()

            revoker = threading.Thread(target=revoke_while_fenced)
            revoker.start()
            with store.authorization_submission_fence(session["session_id"], principal="local-user", authorization_digest=auth["authorization_digest"]):
                entered.set()
                self.assertFalse(revoked.wait(0.05))
                store._consume_approval_locked(
                    session["session_id"], grant["approval_id"], principal="local-user",
                    candidate_digest=candidate["candidate_digest"], approval_digest=grant["approval_digest"],
                    authorization_digest=auth["authorization_digest"],
                )
            revoker.join(timeout=2)
            self.assertTrue(revoked.is_set())
            with self.assertRaisesRegex(OptimizationError, "not active"):
                store.consume_approval(session["session_id"], grant["approval_id"], principal="local-user", candidate_digest=candidate["candidate_digest"], approval_digest=grant["approval_digest"], authorization_digest=auth["authorization_digest"])
            # The fence consumed the single-use grant before the queued revoke
            # could acquire the store lock; the revocation is therefore
            # ordered after this submission attempt.
            self.assertTrue(store.latest_approval(session["session_id"])["consumed"])
            self.assertEqual(store.get(session["session_id"])["autonomy"], "off")
            store.close()

    def test_autonomous_submission_fence_rechecks_live_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": "fence-identity"}),
                "schema_set_revision": canonical_sha256({"schema": "fence-identity"}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-authz-fence-identity")
            auth = issue_authorization(
                session=session,
                grants=[{"pointer": "/devices/0/width", "min": 1, "max": 64, "step": 1, "kind": "int"}],
                objective={"metric_path": "/metrics/p95", "direction": "minimize"},
                budget={"max_rounds": 2, "max_runs": 2, "max_seconds": 60, "max_failures": 1, "max_model_calls": 2, "max_tool_calls_per_round": 1, "max_navigation_attempts": 2, "max_run_creations": 1, "max_execution_time_ms": 60_000},
                tool_allowlist=["query_verified_metrics"], autonomy_level="bounded_autonomous", issued_by="local-user",
                allowed_pages=["overview", "execution"], allowed_actions=["navigate", "execute"],
            )
            store.set_authorization(session["session_id"], auth)
            with self.assertRaisesRegex(OptimizationError, "workspace"):
                with store.authorization_submission_fence(
                    session["session_id"], principal="local-user", authorization_digest=auth["authorization_digest"],
                    workspace_id="different-workspace", schema_set_revision=session["schema_set_revision"],
                    backend_identity=session["backend_identity"], input_snapshot_digest=session["input_snapshot_digest"],
                ):
                    self.fail("fence must reject a changed workspace identity")
            store.close()

    def test_agent_model_call_counter_is_durable_across_turns(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": "counter"}),
                "schema_set_revision": canonical_sha256({"schema": "counter"}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-counter")
            store.record_agent_turn(session["session_id"], {"kind": "inspect", "model_calls_used": 2, "summary": "first"})
            store.record_agent_turn(session["session_id"], {"kind": "stop", "model_calls_used": 3, "summary": "second"})
            self.assertEqual(store.get(session["session_id"])["agent_model_calls"], 5)
            store.close()

    def test_agent_turn_receipt_preserves_signed_budget_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": "receipt"}),
                "schema_set_revision": canonical_sha256({"schema": "receipt"}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-receipt")
            receipt = {
                "kind": "stop",
                "model_calls_used": 1,
                "authorization_digest": "sha256:" + "a" * 64,
                "max_model_calls": 24,
                "max_tool_calls_per_round": 4,
            }
            store.record_agent_turn(session["session_id"], receipt)
            self.assertEqual(store.get(session["session_id"])["agent_turns"][0]["authorization_digest"], receipt["authorization_digest"])
            self.assertEqual(store.get(session["session_id"])["agent_turns"][0]["max_model_calls"], 24)
            self.assertEqual(store.get(session["session_id"])["agent_turns"][0]["max_tool_calls_per_round"], 4)
            store.close()

    def test_recovery_requires_explicit_fresh_approval(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = OptimizationStore(Path(directory) / "optimization.sqlite3")
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": 3}),
                "schema_set_revision": canonical_sha256({"schema": 3}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-recovery")
            store.transition(session["session_id"], "queued", expected={"waiting_approval"})
            store.transition(session["session_id"], "recovery_required", expected={"queued"}, error={"code": "unknown_outcome", "unknown_outcome": True})
            with self.assertRaisesRegex(OptimizationError, "transition"):
                store.transition(session["session_id"], "running", expected={"recovery_required"})
            self.assertEqual(store.get(session["session_id"])["status"], "recovery_required")
            store.close()

    def test_restart_recovery_keeps_state_and_status_in_sync(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "optimization.sqlite3"
            store = OptimizationStore(path)
            document = {
                "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION,
                "principal": "local-user", "workspace_id": "local", "input_snapshot_digest": canonical_sha256({"snapshot": 4}),
                "schema_set_revision": canonical_sha256({"schema": 4}), "backend_identity": {"source_revision": "source"},
                "policy_revision": "tilesim.agent_harness.local_optimization.policy.v1", "objective": {"metric_path": "/metrics/p95"},
                "constraints": [], "budget": {"max_iterations": 2}, "base_config": {"scenario_id": "s1_des_example"},
                "local_dev": True, "automatic_submission": False,
            }
            session, _ = store.create(document, idempotency_key="optimization-restart")
            store.transition(session["session_id"], "queued", expected={"waiting_approval"})
            store.close()
            reopened = OptimizationStore(path)
            reopened.recover_inflight()
            current = reopened.get(session["session_id"])
            self.assertEqual(current["state"], "recovery_required")
            self.assertEqual(current["status"], "recovery_required")
            reopened.close()


if __name__ == "__main__":
    unittest.main()
