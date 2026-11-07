import unittest

from agent_harness.exploration import prepare_scenario_run
from agent_harness.exploration_planning import evaluate_multi_metric, pareto_front
from services.candidate_generator import DeterministicCandidateGenerator


class DeploymentExplorationStage2To4Tests(unittest.TestCase):
    def _state(self, history=None):
        return {
            "deployment_candidates": [
                {"schema_identity": "tilesim.agent_harness.deployment_exploration_deployment_candidate.v1", "candidate_id": "published-a", "status": "published", "published": True, "executable": True, "resource_binding": {"gpu_count": 1}},
                {"schema_identity": "tilesim.agent_harness.deployment_exploration_deployment_candidate.v1", "candidate_id": "published-b", "status": "published", "published": True, "executable": True, "resource_binding": {"gpu_count": 1}},
            ],
            "parameter_grants": [{"pointer": "/x", "min": 1, "max": 3, "step": 1, "kind": "number"}],
            "base_config": {"x": 2},
            "objective": {"direction": "minimize"},
            "candidate_history": history or [],
        }

    def test_published_deployments_are_deterministic_outer_scan_dimension(self):
        generator = DeterministicCandidateGenerator()
        first = generator.generate(self._state())
        self.assertEqual(first["deployment_candidate"]["candidate_id"], "published-a")
        second = generator.generate(self._state([{"combination_key": first["combination_key"]}]))
        self.assertEqual(second["deployment_candidate"]["candidate_id"], "published-a")
        third = generator.generate(self._state([{"combination_key": first["combination_key"]}, {"combination_key": second["combination_key"]}]))
        self.assertEqual(third["deployment_candidate"]["candidate_id"], "published-b")
        self.assertNotEqual(first["combination_key"], third["combination_key"])

    def test_scenario_summary_changes_run_idempotency_key(self):
        candidate = {
            "candidate_id": "candidate-a",
            "candidate_base_run_idempotency_key": "candidate-key",
            "candidate_idempotency_key": "candidate-key",
            "status": "validated",
        }
        low = prepare_scenario_run({"current_candidate": candidate, "workload_scenarios": [{"scenario_id": "low", "input_tokens": 32}, {"scenario_id": "high", "input_tokens": 256}], "scenario_index": 0})
        high = prepare_scenario_run({"current_candidate": candidate, "workload_scenarios": [{"scenario_id": "low", "input_tokens": 32}, {"scenario_id": "high", "input_tokens": 256}], "scenario_index": 1})
        self.assertNotEqual(low["current_candidate"]["run_idempotency_key"], high["current_candidate"]["run_idempotency_key"])
        self.assertEqual(low["current_candidate"]["scenario_id"], "low")
        self.assertEqual(high["current_candidate"]["scenario_id"], "high")

    def test_missing_metric_evidence_is_ineligible(self):
        result = evaluate_multi_metric(
            candidate_id="candidate-a",
            objective={"primary_objective": {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"}},
            scenario_results=[{"scenario_id": "low", "run_id": "run-1", "status": "verified", "metrics": {"latency": {"end_to_end": {"p99": 100}}}}],
        )
        self.assertFalse(result["eligible"])
        self.assertEqual(result["reason"], "required_evidence_unavailable")

    def test_tradeoff_rows_remain_in_pareto_front(self):
        rows = [
            {"candidate_id": "latency", "eligible": True, "objective_values": [10, 90], "directions": ["minimize", "maximize"]},
            {"candidate_id": "throughput", "eligible": True, "objective_values": [12, 110], "directions": ["minimize", "maximize"]},
        ]
        self.assertEqual({item["candidate_id"] for item in pareto_front(rows)}, {"latency", "throughput"})


if __name__ == "__main__":
    unittest.main()
