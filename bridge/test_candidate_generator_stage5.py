import unittest
import tempfile
from pathlib import Path

from services.candidate_generator import (
    MODEL_CANDIDATE_CONTRACT_REVISION,
    MODEL_CANDIDATE_SCHEMA_IDENTITY,
    ModelCandidateGenerator,
    build_model_context,
    _candidate_digest,
)
from services.exploration_graph import build_exploration_graph
try:
    from bridge.test_agent_harness_exploration import authorized, state
except ModuleNotFoundError:  # Running from the bridge directory.
    from test_agent_harness_exploration import authorized, state


REVISION = "sha256:" + "a" * 64


def base_state():
    return {
        "session_id": "explore-stage5",
        "schema_set_revision": REVISION,
        "fixed_resources": {"engine": "published-engine", "gpu_type": "fixed-by-user", "gpu_count": 2},
        "deployment_candidates": [
            {"candidate_id": "deployment-a", "status": "published", "published": True, "executable": True, "resource_binding": {"group": "a"}},
            {"candidate_id": "deployment-b", "status": "published", "published": True, "executable": True, "resource_binding": {"group": "b"}},
        ],
        "parameter_grants": [{"pointer": "/runtime/max_batch_size", "min": 1, "max": 8, "step": 1, "kind": "int"}],
        "base_config": {"runtime": {"max_batch_size": 2}},
        "run_strategy": {"batch_scheduler": "continuous"},
        "workload_scenarios": [{"scenario_id": "low"}, {"scenario_id": "high"}],
        "objective": {"metric_path": "/metrics/latency/p95", "direction": "minimize"},
        "budget": {"max_rounds": 10, "max_runs": 10, "max_model_calls": 24, "max_tool_calls_per_round": 4},
        "model_calls": 4,
        "run_count": 4,
        "round_count": 4,
        "tool_calls_this_round": 0,
        "best_candidate_id": "candidate-1",
        "best_value": 10.0,
        "summary": {"pareto_candidates": ["candidate-1", "candidate-2"]},
        "candidate_evaluations": [{"candidate_id": "candidate-1", "eligible": True, "objective_value": 10.0}],
        "candidate_history": [
            {
                "candidate_id": f"candidate-{index}",
                "candidate_digest": f"sha256:{index:064x}",
                "sequence": index,
                "origin": "rule",
                "config": {"runtime": {"max_batch_size": index}},
                "changed_fields": ["/runtime/max_batch_size"],
                "deployment_candidate_id": "deployment-a",
                "evaluation": {
                    "scenario_evaluations": [
                        {"scenario_id": "low", "run_id": f"run-{index}-low", "metric_path": "/metrics/latency/p95", "evidence": [{"run_id": f"run-{index}-low"}], "constraints": [{"passed": True}]},
                        {"scenario_id": "high", "run_id": f"run-{index}-high", "metric_path": "/metrics/latency/p95", "evidence": [{"run_id": f"run-{index}-high"}], "constraints": [{"passed": True}]},
                    ],
                    "objective": {"value": float(index)},
                },
            }
            for index in range(1, 5)
        ],
    }


class RecordingProvider:
    def __init__(self, proposal):
        self.proposal = proposal
        self.contexts = []

    def generate(self, context):
        self.contexts.append(context)
        return self.proposal


class FailingProvider:
    def generate(self, context):
        raise RuntimeError("model channel unavailable")


class Stage5CandidateGeneratorTests(unittest.TestCase):
    def proposal(self, **overrides):
        result = {
            "schema_identity": MODEL_CANDIDATE_SCHEMA_IDENTITY,
            "contract_revision": MODEL_CANDIDATE_CONTRACT_REVISION,
            "schema_set_revision": REVISION,
            "deployment_candidate_id": "deployment-b",
            "changes": {"/runtime/max_batch_size": 5},
            "reason": "历史结果显示中等批量更稳",
            "source": "model",
        }
        result.update(overrides)
        return result

    def test_context_contains_four_experiments_before_fifth_candidate(self):
        provider = RecordingProvider(self.proposal())
        result = ModelCandidateGenerator(provider).generate(base_state())
        self.assertTrue(result["available"])
        self.assertEqual(len(provider.contexts[0]["executed_candidates"]), 4)
        self.assertEqual(provider.contexts[0]["executed_candidates"][3]["evaluation"]["scenario_evaluations"][1]["run_id"], "run-4-high")
        self.assertEqual(provider.contexts[0]["current_best"]["candidate_id"], "candidate-1")
        self.assertEqual(provider.contexts[0]["pareto_candidates"], ["candidate-1", "candidate-2"])

    def test_context_projects_live_evaluations_and_pareto_before_final_report(self):
        state = base_state()
        state["summary"] = {}
        provider = RecordingProvider(self.proposal())
        ModelCandidateGenerator(provider).generate(state)
        context = provider.contexts[0]
        self.assertEqual(len(context["candidate_evaluations"]), 4)
        self.assertEqual(set(context["pareto_candidates"]), {"candidate-1"})

    def test_model_adjusts_only_authorized_field_and_resolves_published_deployment(self):
        provider = RecordingProvider(self.proposal())
        result = ModelCandidateGenerator(provider).generate(base_state())
        self.assertEqual(result["changes"], {"/runtime/max_batch_size": 5})
        self.assertEqual(result["deployment_candidate"]["candidate_id"], "deployment-b")
        self.assertEqual(result["run_strategy"], base_state()["run_strategy"])

    def test_unknown_or_unauthorized_model_output_falls_back(self):
        state = base_state()
        provider = RecordingProvider(self.proposal(changes={"/runtime/unknown": 5}))
        result = ModelCandidateGenerator(provider).generate(state)
        self.assertTrue(result["available"])
        self.assertTrue(result["fallback_from_model"])
        self.assertEqual(result["source"], "确定性扫描")

    def test_model_channel_failure_falls_back_before_execution(self):
        result = ModelCandidateGenerator(FailingProvider()).generate(base_state())
        self.assertTrue(result["available"])
        self.assertTrue(result["fallback_from_model"])
        self.assertEqual(result["source"], "确定性扫描")
        self.assertIn("model channel unavailable", result["model_failure_reason"])

    def test_out_of_range_model_value_falls_back_before_candidate_queue(self):
        provider = RecordingProvider(self.proposal(changes={"/runtime/max_batch_size": 99}))
        result = ModelCandidateGenerator(provider).generate(base_state())
        self.assertTrue(result["available"])
        self.assertTrue(result["fallback_from_model"])
        self.assertEqual(result["source"], "确定性扫描")

    def test_fixed_resource_mismatch_is_rejected_before_candidate_queue(self):
        state = base_state()
        state["deployment_candidates"][0]["resource_binding"] = {"gpu_count": 4}
        state["deployment_candidates"][1]["resource_binding"] = {"gpu_count": 4}
        provider = RecordingProvider(self.proposal())
        result = ModelCandidateGenerator(provider).generate(state)
        self.assertFalse(result["available"])
        self.assertTrue(result["fallback_from_model"])
        self.assertEqual(result["source"], "确定性扫描")

    def test_unpublished_deployment_has_no_fabricated_fallback(self):
        state = base_state()
        state["deployment_candidates"] = [{"candidate_id": "draft", "status": "draft", "published": False, "executable": False}]
        provider = RecordingProvider(self.proposal(deployment_candidate_id="draft"))
        result = ModelCandidateGenerator(provider).generate(state)
        self.assertFalse(result["available"])
        self.assertTrue(result["fallback_from_model"])

    def test_empty_capability_catalog_does_not_accept_null_deployment(self):
        state = base_state()
        state["deployment_candidates"] = []
        provider = RecordingProvider(self.proposal(deployment_candidate_id=None))
        result = ModelCandidateGenerator(provider).generate(state)
        self.assertFalse(result["available"])
        self.assertTrue(result["fallback_from_model"])

    def test_forbidden_topology_field_is_rejected(self):
        provider = RecordingProvider(self.proposal(gpu_count=2))
        result = ModelCandidateGenerator(provider).generate(base_state())
        self.assertTrue(result["fallback_from_model"])

    def test_duplicate_model_proposal_is_rejected_before_execution(self):
        state = base_state()
        state["candidate_history"] = [{"candidate_digest": "sha256:placeholder"}]
        provider = RecordingProvider(self.proposal())
        first = ModelCandidateGenerator(provider).generate(state)
        state["candidate_history"] = [{"candidate_digest": _candidate_digest(state, first["changes"], first["deployment_candidate"], state["run_strategy"])}]
        second = ModelCandidateGenerator(provider).generate(state)
        self.assertTrue(second["fallback_from_model"])


    def test_langgraph_model_node_consumes_one_call_and_stays_before_run_boundary(self):
        current = authorized(state())
        proposal = self.proposal(
            schema_set_revision=current["schema_set_revision"],
            deployment_candidate_id=None,
            changes={"/request_count": 12},
        )
        provider = RecordingProvider(proposal)
        graph, _ = build_exploration_graph(
            str(Path(tempfile.mkdtemp()) / "stage5-checkpoints.sqlite"),
            candidate_generator=ModelCandidateGenerator(provider),
        )
        result = graph.invoke(
            {"session_id": current["session_id"], "domain_state": current},
            {"configurable": {"thread_id": current["session_id"]}},
        )
        self.assertEqual(result["node"], "create_single_run")
        self.assertEqual(result["domain_state"]["model_calls"], 1)
        self.assertEqual(result["domain_state"]["phase"], "create_one_run")
        self.assertEqual(result["domain_state"]["current_candidate"]["origin"], "model")
        self.assertEqual(len(provider.contexts), 1)

    def test_checkpoint_after_model_generation_is_reused_after_graph_restart(self):
        current = authorized(state())
        provider = RecordingProvider(self.proposal(schema_set_revision=current["schema_set_revision"], deployment_candidate_id=None, changes={"/request_count": 12}))
        checkpoint = Path(tempfile.mkdtemp()) / "stage5-restart.sqlite"
        graph, _ = build_exploration_graph(str(checkpoint), candidate_generator=ModelCandidateGenerator(provider))
        first = graph.invoke(
            {"session_id": current["session_id"], "domain_state": current},
            {"configurable": {"thread_id": current["session_id"]}},
        )
        self.assertEqual(first["waiting_for"], "create_run")
        self.assertEqual(len(provider.contexts), 1)

        restarted_provider = RecordingProvider(self.proposal(schema_set_revision=current["schema_set_revision"], deployment_candidate_id=None, changes={"/request_count": 12}))
        restarted, _ = build_exploration_graph(str(checkpoint), candidate_generator=ModelCandidateGenerator(restarted_provider))
        checkpoint_values = restarted.get_state({"configurable": {"thread_id": current["session_id"]}}).values
        self.assertEqual(checkpoint_values["node"], "create_single_run")
        self.assertEqual(len(restarted_provider.contexts), 0)


if __name__ == "__main__":
    unittest.main()
