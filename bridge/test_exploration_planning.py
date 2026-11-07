import unittest

from agent_harness.exploration_planning import (
    PLANNING_CONTRACT_REVISION,
    PLANNING_SCHEMA_IDENTITIES,
    PlanningError,
    confirm_exploration_plan,
    evaluate_multi_metric,
    pareto_front,
    plan_exploration,
    validate_planning_document,
)
from services.exploration_service import ExplorationService, ExplorationServiceError


def context():
    return {
        "run_request": {"scenario_id": "s1", "model_id": "model-a", "engine": "engine-a", "gpu_type": "A100", "gpu_count": 4},
        "deployment_candidates": [
            {"candidate_id": "published-a", "status": "published", "published": True, "executable": True},
            {"candidate_id": "unfinished", "status": "unpublished", "published": False, "executable": False},
        ],
        "workload_scenarios": [{"scenario_id": "low"}, {"scenario_id": "high"}],
    }


class ExplorationPlanningTests(unittest.TestCase):
    def test_missing_information_is_clarification_and_has_no_side_effect_flags(self):
        result = plan_exploration(context={}, request={})
        self.assertEqual(result["status"], "needs_clarification")
        self.assertLessEqual(len(result["questions"]), 3)
        self.assertFalse(result["would_create_run"])
        self.assertFalse(result["would_claim_slot"])
        self.assertTrue(result["recommendations"])

    def test_unpublished_profiles_are_not_candidates(self):
        result = plan_exploration(context=context(), request={"objective": {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"}})
        self.assertEqual(result["status"], "awaiting_confirmation")
        self.assertEqual([c["candidate_id"] for c in result["deployment_candidates"]], ["published-a"])

    def test_model_supplied_candidates_cannot_become_execution_candidates(self):
        result = plan_exploration(
            context={
                "run_request": context()["run_request"],
                "workload_scenarios": context()["workload_scenarios"],
            },
            request={
                "deployment_candidates": [{"candidate_id": "forged", "status": "published", "published": True, "executable": True}],
                "objective": {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"},
            },
        )
        self.assertEqual(result["deployment_candidates"], [])
        self.assertEqual(result["status"], "needs_clarification")

    def test_recommendations_are_not_frozen_until_user_confirmation(self):
        draft = plan_exploration(context=context(), request={"objective": {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"}})
        with self.assertRaises(PlanningError):
            confirm_exploration_plan(draft, principal="user", confirmation={"confirmed": False})
        confirmed = confirm_exploration_plan(draft, principal="user", confirmation={"confirmed": True})
        self.assertEqual(confirmed["status"], "draft_ready")
        self.assertTrue(all(item["confirmed"] for item in confirmed["recommendations"]))
        self.assertFalse(confirmed["would_create_run"])

    def test_multi_metric_constraints_eliminate_candidate(self):
        objective = {
            "primary_objective": {"metric_path": "/throughput/output_tokens_per_second", "direction": "maximize"},
            "constraints": [{"metric_path": "/latency/end_to_end/p99", "operator": "<=", "threshold": 2000}],
            "aggregation": "all_scenarios",
        }
        result = evaluate_multi_metric(candidate_id="candidate-a", objective=objective, scenario_results=[
            {"scenario_id": "low", "status": "completed", "metrics": {"throughput": {"output_tokens_per_second": 100}, "latency": {"end_to_end": {"p99": 1500}}}},
            {"scenario_id": "high", "status": "completed", "metrics": {"throughput": {"output_tokens_per_second": 200}, "latency": {"end_to_end": {"p99": 2500}}}},
        ])
        self.assertFalse(result["eligible"])
        self.assertEqual(result["reason"], "hard_constraint_failed")

    def test_pareto_front_keeps_non_dominated_candidates(self):
        rows = [
            {"candidate_id": "a", "eligible": True, "objective_value": 10, "direction": "maximize"},
            {"candidate_id": "b", "eligible": True, "objective_value": 8, "direction": "maximize"},
            {"candidate_id": "c", "eligible": False, "objective_value": 99, "direction": "maximize"},
        ]
        self.assertEqual([row["candidate_id"] for row in pareto_front(rows)], ["a"])

    def test_pareto_front_keeps_vector_tradeoffs(self):
        rows = [
            {"candidate_id": "latency", "eligible": True, "objective_values": [10, 90], "directions": ["minimize", "maximize"]},
            {"candidate_id": "throughput", "eligible": True, "objective_values": [12, 110], "directions": ["minimize", "maximize"]},
            {"candidate_id": "dominated", "eligible": True, "objective_values": [14, 80], "directions": ["minimize", "maximize"]},
        ]
        self.assertEqual({row["candidate_id"] for row in pareto_front(rows)}, {"latency", "throughput"})

    def test_planning_documents_are_closed_and_identity_bound(self):
        document = {"schema_identity": PLANNING_SCHEMA_IDENTITIES["recommendation"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": "sha256:" + "0" * 64, "recommendation_id": "r", "field": "x", "value": 1, "source": "system_recommendation", "reason": "r", "confirmed": False}
        self.assertEqual(validate_planning_document("recommendation", document)["recommendation_id"], "r")
        with self.assertRaises(PlanningError):
            validate_planning_document("recommendation", {**document, "shell": "forbidden"})

    def test_service_rejects_unconfirmed_plan_before_repository_create(self):
        class Repository:
            def __init__(self): self.created = 0
            def create(self, _state): self.created += 1
            def list(self, *_args): return []
        repository = Repository()
        service = ExplorationService(repository, schema_set_revision="sha256:" + "a" * 64, backend_identity={"backend_id": "test"})
        plan = plan_exploration(context={}, request={})
        with self.assertRaises(ExplorationServiceError) as raised:
            service.create({"plan": plan, "context": {}}, "user", "workspace")
        self.assertEqual(raised.exception.code, "planning_confirmation_required")
        self.assertEqual(repository.created, 0)

    def test_service_rejects_tampered_confirmed_plan_before_repository_create(self):
        class Repository:
            def __init__(self): self.created = 0
            def create(self, _state): self.created += 1
            def list(self, *_args): return []
        repository = Repository()
        service = ExplorationService(repository, schema_set_revision="sha256:" + "a" * 64, backend_identity={"backend_id": "test"})
        draft = plan_exploration(context=context(), request={"objective": {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"}}, schema_set_revision="sha256:" + "a" * 64)
        confirmed = confirm_exploration_plan(draft, principal="user", confirmation={"confirmed": True, "source": "user"})
        confirmed["objective"]["primary_objective"]["metric_path"] = "/latency/ttft/p99"
        with self.assertRaises(ExplorationServiceError) as raised:
            service.create({"plan": confirmed, "context": {}}, "user", "workspace")
        self.assertEqual(raised.exception.code, "planning_digest_mismatch")
        self.assertEqual(repository.created, 0)


if __name__ == "__main__":
    unittest.main()
