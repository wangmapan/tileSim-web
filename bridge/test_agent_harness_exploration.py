from __future__ import annotations

import unittest

from agent_harness.exploration import (
    ExplorationError,
    EXPLORATION_SCHEMA_IDENTITIES,
    assert_context_current,
    assert_authorization_active,
    bind_authorization,
    create_one_run,
    consume_model_call,
    consume_tool_call,
    finish_report,
    generate_candidate,
    mark_context_expired,
    mark_authorization_expired,
    mark_authorization_revoked,
    new_exploration_state,
    pause_exploration,
    project_candidate,
    project_evaluation,
    project_event,
    project_session,
    project_summary,
    read_verified_metric,
    resume_exploration,
    should_continue,
    snapshot_context,
    stop_exploration,
    update_best,
    validate_budget,
    validate_candidate,
    validate_context,
    wait_run_terminal,
)
from agent_harness.contracts import canonical_sha256


BACKEND = {"source_revision": "source", "versions_match": True}
CONTEXT = {
    "context_revision": "ctx-1",
    "input_snapshot_digest": canonical_sha256({"scenario": "demo", "width": 2}),
    "schema_set_revision": canonical_sha256({"schema": "current"}),
    "parameter_catalog_revision": "catalog-1",
    "backend_identity": BACKEND,
    "current_page": "experiment",
    "available_parameters": ["/request_count", "/batch_size"],
}
BASE_CONFIG = {"request_count": 8, "batch_size": 2, "scenario_id": "demo"}
GRANTS = [
    {"pointer": "/request_count", "min": 1, "max": 32, "step": 1, "kind": "int"},
    {"pointer": "/batch_size", "min": 1, "max": 16, "step": 1, "kind": "int"},
]
OBJECTIVE = {
    "metric_path": "/metrics/p95",
    "direction": "minimize",
    "minimum_improvement": 0.5,
    "plateau_rounds": 3,
}


def state(**kwargs):
    budget = kwargs.pop("budget", {"max_rounds": 10, "max_runs": 10})
    objective = kwargs.pop("objective", OBJECTIVE)
    return new_exploration_state(
        session_id="explore-1",
        principal="local-user",
        workspace_id="local",
        context=CONTEXT,
        objective=objective,
        parameter_grants=GRANTS,
        base_config=BASE_CONFIG,
        budget=budget,
        authorization_id="explore-authz-1",
        **kwargs,
    )


def authorized(value):
    authorization = {
        "authorization_id": "explore-authz-1",
        "session_id": "explore-1",
        "task_type": "explore_experiment",
        "run_context_revision": None,
        "principal": "local-user",
        "workspace_id": "local",
        "context_revision": CONTEXT["context_revision"],
        "input_snapshot_digest": CONTEXT["input_snapshot_digest"],
        "schema_set_revision": CONTEXT["schema_set_revision"],
        "parameter_catalog_revision": CONTEXT["parameter_catalog_revision"],
        "backend_identity": BACKEND,
        "status": "active",
        "autonomy_level": "bounded_autonomous",
        "budget": value["budget"],
        "parameter_grants": GRANTS,
        "objective": value["objective"],
        "allowed_pages": ["experiment", "execution", "metrics"],
        "allowed_actions": ["navigate", "analyze", "execute", "report"],
        "tool_allowlist": ["query_verified_metrics"],
        "protected": {
            "context_revision": CONTEXT["context_revision"],
            "run_context_revision": CONTEXT.get("run_context_revision"),
            "input_snapshot_digest": CONTEXT["input_snapshot_digest"],
            "schema_set_revision": CONTEXT["schema_set_revision"],
            "backend_identity": BACKEND,
            "parameter_catalog_revision": CONTEXT["parameter_catalog_revision"],
        },
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["authorization"],
        "contract_revision": "2026-10-29.wpg.v2",
        "issued_by": "local-user",
        "issued_at": "2026-10-29T00:00:00+00:00",
        "expires_at": "2099-01-01T00:00:00+00:00",
        "revoked_at": None,
        "provenance": {
            "deployment_mode": "local_dev",
            "source_mode": "synthetic_trace",
            "claim_scope": "exploratory",
            "production_status": "not_for_production",
        },
    }
    authorization["authorization_digest"] = canonical_sha256(authorization)
    return bind_authorization(value, authorization)


def create_run(current, run_id):
    return create_one_run(
        current,
        {
            "run_id": run_id,
            "idempotency_key": current["current_candidate"]["run_idempotency_key"],
        },
    )


class ExplorationStateMachineTests(unittest.TestCase):
    def test_default_budget_is_ten_serial_rounds_and_closed(self):
        budget = validate_budget(None)
        self.assertEqual(budget["max_rounds"], 10)
        self.assertEqual(budget["max_runs"], 10)
        self.assertEqual(budget["max_concurrency"], 1)
        with self.assertRaisesRegex(ExplorationError, "closed"):
            validate_budget({"shell": True})
        with self.assertRaisesRegex(ExplorationError, "serial"):
            validate_budget({"max_concurrency": 2})

    def test_authorization_lifecycle_stops_and_resume_rechecks_grant(self):
        current = snapshot_context(authorized(state()))
        paused = pause_exploration(current)
        paused["authorization"] = {**paused["authorization"], "status": "revoked"}
        with self.assertRaisesRegex(ExplorationError, "not active"):
            resume_exploration(paused)

        paused = pause_exploration(current)
        paused["authorization"] = {**paused["authorization"], "authorization_digest": "sha256:" + "f" * 64}
        with self.assertRaisesRegex(ExplorationError, "digest changed"):
            resume_exploration(paused)

        expired = mark_authorization_expired(current)
        self.assertEqual(expired["status"], "authorization_expired")
        self.assertEqual(expired["authorization"]["status"], "expired")
        self.assertEqual(expired["stop_reason"]["reason"], "authorization_expired")
        revoked = mark_authorization_revoked(current)
        self.assertEqual(revoked["status"], "authorization_revoked")
        self.assertEqual(revoked["authorization"]["status"], "revoked")
        with self.assertRaisesRegex(ExplorationError, "not active"):
            assert_authorization_active(current, {})

    def test_model_and_tool_call_budgets_fail_closed_and_reset_per_round(self):
        current = snapshot_context(authorized(state(budget={"max_rounds": 10, "max_runs": 10, "max_model_calls": 2})))
        current = consume_model_call(current)
        current = consume_model_call(current)
        exhausted = consume_model_call(current)
        self.assertEqual(exhausted["status"], "budget_exhausted")
        self.assertEqual(exhausted["stop_reason"]["reason"], "max_model_calls")

        current = snapshot_context(authorized(state(budget={"max_rounds": 10, "max_runs": 10, "max_tool_calls_per_round": 2})))
        current = consume_tool_call(current)
        current = consume_tool_call(current)
        exhausted = consume_tool_call(current)
        self.assertEqual(exhausted["status"], "budget_exhausted")
        self.assertEqual(exhausted["stop_reason"]["reason"], "max_tool_calls_per_round")

        current = snapshot_context(authorized(state(budget={"max_rounds": 10, "max_runs": 10, "max_tool_calls_per_round": 2})))
        current["phase"] = "should_continue"
        current["tool_calls_this_round"] = 2
        current = should_continue(current)
        self.assertEqual(current["tool_calls_this_round"], 0)

    def test_context_requires_parameters_and_detects_revision_change(self):
        self.assertEqual(validate_context(CONTEXT)["context_revision"], "ctx-1")
        with self.assertRaisesRegex(ExplorationError, "no usable"):
            validate_context({**CONTEXT, "available_parameters": []})
        with self.assertRaisesRegex(ExplorationError, "schema-set revision"):
            validate_context(CONTEXT, expected_schema_set_revision="sha256:" + "f" * 64)
        with self.assertRaisesRegex(ExplorationError, "backend identity"):
            validate_context(CONTEXT, expected_backend_identity={"source_revision": "other"})
        with self.assertRaisesRegex(ExplorationError, "parameter catalog"):
            validate_context(CONTEXT, expected_parameter_catalog_revision="catalog-2")
        with self.assertRaisesRegex(ExplorationError, "supplied together"):
            validate_context({**CONTEXT, "run_context_revision": "run-ctx-1"})
        current = state()
        assert_context_current(current, CONTEXT)
        with self.assertRaisesRegex(ExplorationError, "Expected a non-empty string"):
            snapshot_context(current, {})
        with self.assertRaisesRegex(ExplorationError, "changed"):
            assert_context_current(current, {**CONTEXT, "context_revision": "ctx-2"})

    def test_authorization_binds_identity_objective_and_grants(self):
        current = authorized(state())
        self.assertEqual(current["status"], "exploring")
        self.assertEqual(current["authorization_id"], "explore-authz-1")
        with self.assertRaisesRegex(ExplorationError, "published exploration page"):
            bind_authorization(
                state(),
                {**current["authorization"], "allowed_pages": ["https://evil.invalid"]},
            )

        malformed_identity = {**current["authorization"], "schema_identity": "tilesim.agent_harness.optimization_authorization.v1"}
        with self.assertRaisesRegex(ExplorationError, "schema identity"):
            bind_authorization(state(), malformed_identity)

        malformed_protected = {
            **current["authorization"],
            "protected": {**current["authorization"]["protected"], "context_revision": "ctx-other"},
        }
        with self.assertRaisesRegex(ExplorationError, "protected context"):
            bind_authorization(state(), malformed_protected)

        malformed_digest = {**current["authorization"], "authorization_digest": "sha256:" + "f" * 64}
        with self.assertRaisesRegex(ExplorationError, "digest"):
            bind_authorization(state(), malformed_digest)

    def test_run_creation_binds_candidate_key_and_rejects_reused_run_identity(self):
        current = snapshot_context(authorized(state()))
        current = generate_candidate(current, {"/request_count": 12})
        current = validate_candidate(current)
        with self.assertRaisesRegex(ExplorationError, "deterministic idempotency key"):
            create_one_run(current, {"run_id": "run-1", "idempotency_key": "caller-chosen"})
        self.assertEqual(current["run_count"], 0)

        current = create_run(current, "run-1")
        current = wait_run_terminal(current, {"status": "completed"})
        current = read_verified_metric(
            current,
            {
                "status": "verified",
                "run_id": "run-1",
                "metric_path": "/metrics/p95",
                "value": 10.0,
                "evidence": [{"run_id": "run-1", "manifest_digest": "sha256:" + "b" * 64, "json_pointer": "/metrics/p95", "tool_output_digest": "sha256:" + "c" * 64}],
            },
        )
        current = update_best(current)
        current = should_continue(current)
        current = generate_candidate(current, {"/request_count": 14})
        current = validate_candidate(current)
        with self.assertRaisesRegex(ExplorationError, "run_id may only be used once"):
            create_one_run(current, {"run_id": "run-1", "idempotency_key": current["current_candidate"]["run_idempotency_key"]})
        with self.assertRaisesRegex(ExplorationError, "published exploration actions"):
            bind_authorization(
                state(),
                {**current["authorization"], "allowed_actions": ["open_url"]},
            )
        with self.assertRaisesRegex(ExplorationError, "objective"):
            bind_authorization(
                state(),
                {
                    "authorization_id": "explore-authz-1",
                    "session_id": "explore-1",
                    "task_type": "explore_experiment",
                    "run_context_revision": None,
                    "principal": "local-user",
                    "workspace_id": "local",
                    "context_revision": CONTEXT["context_revision"],
                    "input_snapshot_digest": CONTEXT["input_snapshot_digest"],
                    "schema_set_revision": CONTEXT["schema_set_revision"],
                    "parameter_catalog_revision": CONTEXT["parameter_catalog_revision"],
                    "backend_identity": BACKEND,
                    "status": "active",
                    "autonomy_level": "bounded_autonomous",
                    "expires_at": "2099-01-01T00:00:00+00:00",
                    "budget": {"max_rounds": 10, "max_runs": 10},
                    "parameter_grants": GRANTS,
                    "objective": {**OBJECTIVE, "direction": "maximize"},
                    "allowed_pages": ["experiment", "execution", "metrics"],
                    "allowed_actions": ["navigate", "analyze", "execute", "report"],
                    "tool_allowlist": ["query_verified_metrics"],
                    "protected": {
                        "context_revision": CONTEXT["context_revision"],
                        "run_context_revision": CONTEXT.get("run_context_revision"),
                        "input_snapshot_digest": CONTEXT["input_snapshot_digest"],
                        "schema_set_revision": CONTEXT["schema_set_revision"],
                        "backend_identity": BACKEND,
                        "parameter_catalog_revision": CONTEXT["parameter_catalog_revision"],
                    },
                    "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["authorization"],
                    "contract_revision": "2026-10-29.wpg.v2",
                    "issued_by": "local-user",
                    "issued_at": "2026-10-29T00:00:00+00:00",
                    "expires_at": "2099-01-01T00:00:00+00:00",
                    "revoked_at": None,
                    "provenance": {
                        "deployment_mode": "local_dev",
                        "source_mode": "synthetic_trace",
                        "claim_scope": "exploratory",
                        "production_status": "not_for_production",
                    },
                    "authorization_digest": "sha256:" + "a" * 64,
                },
            )

    def test_authorization_cannot_replace_or_expand_frozen_budget(self):
        planned = state(budget={"max_rounds": 5, "max_runs": 5})
        baseline = authorized(planned)
        self.assertEqual(baseline["budget"], planned["budget"])

        expanded = {
            **baseline["authorization"],
            "budget": {**baseline["authorization"]["budget"], "max_rounds": 10, "max_runs": 10},
        }
        expanded["authorization_digest"] = canonical_sha256({key: value for key, value in expanded.items() if key != "authorization_digest"})
        with self.assertRaisesRegex(ExplorationError, "frozen exploration budget"):
            bind_authorization(planned, expanded)

        replaced = {
            **baseline["authorization"],
            "budget": {**baseline["authorization"]["budget"], "max_no_improvement": 1},
        }
        replaced["authorization_digest"] = canonical_sha256({key: value for key, value in replaced.items() if key != "authorization_digest"})
        with self.assertRaisesRegex(ExplorationError, "frozen exploration budget"):
            bind_authorization(planned, replaced)

    def test_authorization_replay_is_immutable_and_reauthorization_requires_pause(self):
        current = authorized(state())
        event_count = len(current["events"])
        replay = bind_authorization(current, current["authorization"])
        self.assertEqual(replay["authorization_digest"], current["authorization_digest"])
        self.assertEqual(len(replay["events"]), event_count)

        changed = {**current["authorization"], "expires_at": "2099-02-01T00:00:00+00:00"}
        changed["authorization_digest"] = canonical_sha256({key: value for key, value in changed.items() if key != "authorization_digest"})
        with self.assertRaisesRegex(ExplorationError, "explicit paused"):
            bind_authorization(current, changed)

        paused = pause_exploration(current)
        reauthorized = {
            **current["authorization"],
            "authorization_id": "explore-authz-2",
            "expires_at": "2099-02-01T00:00:00+00:00",
            "budget": {**current["authorization"]["budget"], "max_rounds": 20, "max_runs": 20},
        }
        reauthorized["authorization_digest"] = canonical_sha256({key: value for key, value in reauthorized.items() if key != "authorization_digest"})
        resumed = bind_authorization(paused, reauthorized)
        self.assertEqual(resumed["authorization_id"], "explore-authz-2")
        self.assertEqual(resumed["status"], "exploring")
        self.assertEqual(resumed["budget"]["max_rounds"], 20)

    def test_serial_candidate_validation_rejects_unauthorized_range_and_duplicate(self):
        current = snapshot_context(authorized(state()))
        current = generate_candidate(current, {"/request_count": 12}, reason="reduce tail")
        self.assertEqual(project_candidate(current["current_candidate"])["status"], "generated")
        self.assertEqual(project_event(current["events"][-1])["event_type"], "candidate_generated")
        session_projection = project_session(current)
        self.assertEqual(session_projection["current_page_id"], "experiment")
        self.assertEqual(session_projection["authorization_digest"], current["authorization_digest"])
        self.assertEqual(session_projection["base_config"], BASE_CONFIG)
        current = validate_candidate(current)
        self.assertEqual(current["current_candidate"]["status"], "validated")
        with self.assertRaisesRegex(ExplorationError, "outside the authorization"):
            generate_candidate(current, {"/scenario_id": 1})
        # Replaying the exact candidate is rejected even after the current
        # candidate has moved through validation.
        current = create_run(current, "run-1")
        current = wait_run_terminal(current, {"status": "completed"})
        current = read_verified_metric(
            current,
            {
                "status": "verified",
                "run_id": "run-1",
                "metric_path": "/metrics/p95",
                "value": 10.0,
                "evidence": [{"run_id": "run-1", "manifest_digest": "sha256:" + "b" * 64, "json_pointer": "/metrics/p95", "tool_output_digest": "sha256:" + "c" * 64}],
            },
        )
        self.assertEqual(project_evaluation(current["current_evaluation"])["run_id"], "run-1")
        current = update_best(current)
        current = should_continue(current)
        with self.assertRaisesRegex(ExplorationError, "already been executed"):
            generate_candidate(current, {"/request_count": 12})

    def test_verified_metric_compare_minimize_and_keep_earliest_tie(self):
        current = snapshot_context(authorized(state()))
        for index, (request_count, value) in enumerate(((12, 10.0), (14, 10.0), (16, 8.0)), start=1):
            current = generate_candidate(current, {"/request_count": request_count})
            current = validate_candidate(current)
            current = create_run(current, f"run-{index}")
            current = wait_run_terminal(current, {"status": "completed"})
            current = read_verified_metric(
                current,
                {
                    "status": "verified",
                    "run_id": f"run-{index}",
                    "metric_path": "/metrics/p95",
                    "value": value,
                    "evidence": [{"run_id": f"run-{index}", "manifest_digest": "sha256:" + str(index) * 64, "json_pointer": "/metrics/p95", "tool_output_digest": "sha256:" + str(index + 1) * 64}],
                },
            )
            current = update_best(current)
            if index < 3:
                current = should_continue(current)
        self.assertEqual(current["best_value"], 8.0)
        self.assertEqual(current["best_candidate_id"], current["candidate_history"][-1]["candidate_id"])
        self.assertEqual(current["candidate_history"][0]["status"], "evaluated")
        self.assertEqual(current["candidate_history"][1]["status"], "evaluated")
        self.assertEqual(current["candidate_history"][2]["status"], "best")

    def test_no_improvement_stop_uses_the_authorized_plateau_budget(self):
        current = snapshot_context(
            authorized(
                state(
                    budget={"max_rounds": 10, "max_runs": 10, "max_no_improvement": 2},
                    objective={**OBJECTIVE, "plateau_rounds": 2},
                )
            )
        )
        for index, request_count in enumerate((12, 14, 16), start=1):
            current = generate_candidate(current, {"/request_count": request_count})
            current = validate_candidate(current)
            current = create_run(current, f"run-flat-{index}")
            current = wait_run_terminal(current, {"status": "completed"})
            current = read_verified_metric(
                current,
                {
                    "status": "verified",
                    "run_id": f"run-flat-{index}",
                    "metric_path": "/metrics/p95",
                    "value": 10.0,
                    "evidence": [{"run_id": f"run-flat-{index}", "manifest_digest": "sha256:" + str(index + 4) * 64, "json_pointer": "/metrics/p95", "tool_output_digest": "sha256:" + str(index + 5) * 64}],
                },
            )
            current = update_best(current)
            current = should_continue(current)
        self.assertEqual(current["status"], "completed")
        self.assertEqual(current["stop_reason"]["reason"], "max_no_improvement")

    def test_unknown_run_outcome_enters_recovery_and_never_retries(self):
        current = snapshot_context(authorized(state()))
        current = generate_candidate(current, {"/request_count": 12})
        current = validate_candidate(current)
        current = create_run(current, "run-unknown")
        current = wait_run_terminal(current, {"status": "unknown"})
        self.assertEqual(current["status"], "recovery_required")
        self.assertTrue(current["stop_reason"]["unknown_outcome"])
        with self.assertRaisesRegex(ExplorationError, "terminal"):
            create_one_run(current, {"run_id": "run-duplicate", "idempotency_key": current["current_candidate"]["run_idempotency_key"]})

    def test_retryable_failure_reuses_same_candidate_and_stops_at_failure_budget(self):
        current = snapshot_context(authorized(state()))
        current["budget"]["max_failures"] = 2
        current = generate_candidate(current, {"/request_count": 12})
        current = validate_candidate(current)
        current = create_run(current, "run-fail-1")
        current = wait_run_terminal(current, {"status": "failed", "retryable": True})
        self.assertEqual(current["phase"], "create_one_run")
        self.assertEqual(current["current_candidate"]["candidate_id"], "explore-candidate-" + current["current_candidate"]["candidate_digest"].split(":", 1)[1][:16])
        self.assertIn(":attempt-1", current["current_candidate"]["run_idempotency_key"])
        current = create_run(current, "run-fail-2")
        current = wait_run_terminal(current, {"status": "failed", "retryable": True})
        self.assertEqual(current["status"], "run_failed")
        self.assertEqual(current["failure_count"], 2)

    def test_non_retryable_failure_preserves_run_failed_stop_reason(self):
        current = snapshot_context(authorized(state()))
        current = generate_candidate(current, {"/request_count": 12})
        current = validate_candidate(current)
        current = create_run(current, "run-hard-fail")
        current = wait_run_terminal(current, {"status": "failed", "retryable": False})
        self.assertEqual(current["status"], "run_failed")
        self.assertEqual(current["stop_reason"]["reason"], "run_failed")

    def test_stop_pause_resume_context_expiry_and_report(self):
        current = snapshot_context(authorized(state()))
        paused = pause_exploration(current)
        self.assertEqual(paused["status"], "paused")
        resumed = resume_exploration(paused)
        self.assertEqual(resumed["status"], "exploring")
        expired = mark_context_expired(resumed)
        self.assertEqual(expired["status"], "context_expired")
        report = finish_report(expired)
        self.assertEqual(report["summary"]["schema_identity"], EXPLORATION_SCHEMA_IDENTITIES["summary"])
        self.assertEqual(report["summary"]["stop_reason"]["reason"], "context_expired")
        summary_projection = project_summary(report["summary"])
        self.assertEqual(summary_projection["round_count"], 0)
        self.assertEqual(summary_projection["stop_reason"]["reason"], "context_expired")
        stopped = stop_exploration(snapshot_context(authorized(state())))
        self.assertEqual(stopped["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()

