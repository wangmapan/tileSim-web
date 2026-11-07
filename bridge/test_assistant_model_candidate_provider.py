"""Acceptance tests for the opt-in assistant-model candidate adapter.

All replies are injected through the existing assistant transport hook.  The
tests exercise the real adapter and candidate boundary without opening a
socket, calling 5173, or creating a production run.
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
import time
from pathlib import Path

from providers import assistant_model
from services.candidate_generator import ModelCandidateGenerator
from services.exploration_graph import build_exploration_graph
from repositories.explorations import ExplorationRepository
from services.exploration_worker import ExplorationWorker
from services.run_executor import LocalSyntheticRunExecutor
from agent_harness import exploration as exploration_domain
try:
    from bridge.test_agent_harness_exploration import authorized, state as exploration_state
    from bridge.test_candidate_generator_stage5 import REVISION, base_state
except ModuleNotFoundError:  # Running from the bridge directory.
    from test_agent_harness_exploration import authorized, state as exploration_state
    from test_candidate_generator_stage5 import REVISION, base_state


def _reply(document: object, *, reasoning: str | None = None) -> dict:
    message = {"role": "assistant", "content": json.dumps(document, ensure_ascii=False)}
    if reasoning is not None:
        # The adapter must drop this field rather than expose or persist it.
        message["reasoning_content"] = reasoning
    return {
        "id": "chatcmpl-local-acceptance",
        "model": "controlled-test-model",
        "choices": [{"index": 0, "finish_reason": "stop", "message": message}],
    }


class AssistantModelCandidateProviderAcceptanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.saved = {name: os.environ.pop(name, None) for name in (
            assistant_model.BASE_URL_ENV,
            assistant_model.API_KEY_ENV,
            assistant_model.MODEL_ENV,
            assistant_model.TIMEOUT_ENV,
            assistant_model.EXPLORATION_MODEL_CANDIDATES_ENV,
            assistant_model.AGENT_EXPLORATION_MODEL_CANDIDATES_ENV,
        )}
        os.environ.update({
            assistant_model.BASE_URL_ENV: "http://127.0.0.1:19876/v1",
            assistant_model.API_KEY_ENV: "local-test-key",
            assistant_model.MODEL_ENV: "controlled-test-model",
            assistant_model.TIMEOUT_ENV: "1000",
        })

    def tearDown(self) -> None:
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    @staticmethod
    def proposal(**overrides):
        result = {
            "schema_identity": "tilesim.agent_harness.exploration_model_candidate.v1",
            "contract_revision": "2026-11-02.wpi.v1",
            "schema_set_revision": REVISION,
            "deployment_candidate_id": "deployment-b",
            "changes": {"/runtime/max_batch_size": 5},
            "reason": "前四次结果显示中等批量更稳定",
            "source": "model",
        }
        result.update(overrides)
        return result

    def test_provider_sends_closed_schema_and_full_history_then_returns_fifth_candidate(self) -> None:
        payloads: list[dict] = []

        def transport(config, payload):  # noqa: ANN001
            self.assertEqual(config.endpoint, "http://127.0.0.1:19876/v1/chat/completions")
            self.assertEqual(config.api_key, "local-test-key")
            self.assertEqual(config.model_id, "controlled-test-model")
            self.assertEqual(config.timeout_ms, 1000)
            payloads.append(payload)
            return _reply(self.proposal(), reasoning="hidden-test-reasoning")

        from providers.assistant_model import AssistantModelCandidateProvider

        provider = AssistantModelCandidateProvider(transport=transport)
        context = __import__("services.candidate_generator", fromlist=["build_model_context"]).build_model_context(base_state())
        result = provider.generate(context)
        self.assertEqual(result["changes"], {"/runtime/max_batch_size": 5})
        self.assertEqual(len(context["executed_candidates"]), 4)
        self.assertEqual(context["executed_candidates"][3]["evaluation"]["scenario_evaluations"][1]["run_id"], "run-4-high")
        self.assertEqual(len(payloads), 1)
        payload = payloads[0]
        self.assertEqual(payload["response_format"]["type"], "json_schema")
        self.assertTrue(payload["response_format"]["json_schema"]["strict"])
        self.assertEqual(payload["response_format"]["json_schema"]["schema"]["additionalProperties"], False)
        serialized = json.dumps(result, ensure_ascii=False)
        self.assertNotIn("hidden-test-reasoning", serialized)
        self.assertNotIn("chatcmpl-local-acceptance", serialized)
        self.assertNotIn("controlled-test-model", serialized)

    def test_model_history_adjustment_survives_candidate_boundary(self) -> None:
        def transport(_config, _payload):  # noqa: ANN001
            return _reply(self.proposal(changes={"/runtime/max_batch_size": 6}))

        generator = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=transport))
        result = generator.generate(base_state())
        self.assertTrue(result["available"])
        self.assertEqual(result["source"], "模型辅助候选")
        self.assertEqual(result["changes"], {"/runtime/max_batch_size": 6})
        # Only the normalized reason and closed DTO are durable projections.
        self.assertNotIn("前四次", json.dumps(result, ensure_ascii=False))
        self.assertNotIn("reason_digest", result["model_proposal"])

    def test_invalid_json_and_timeout_fall_back_to_deterministic_generation(self) -> None:
        def invalid_transport(_config, _payload):  # noqa: ANN001
            return _reply("not an object")

        invalid = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=invalid_transport)).generate(base_state())
        self.assertTrue(invalid["available"])
        self.assertTrue(invalid["fallback_from_model"])
        self.assertEqual(invalid["source"], "确定性扫描")

        def timeout_transport(_config, _payload):  # noqa: ANN001
            raise assistant_model.ProviderTimeoutError("controlled timeout")

        timed_out = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=timeout_transport)).generate(base_state())
        self.assertTrue(timed_out["available"])
        self.assertTrue(timed_out["fallback_from_model"])
        self.assertIn("controlled timeout", timed_out["model_failure_reason"])

    def test_provider_rejects_schema_value_type_before_candidate_generation(self) -> None:
        context = __import__("services.candidate_generator", fromlist=["build_model_context"]).build_model_context(base_state())
        provider = assistant_model.AssistantModelCandidateProvider(
            transport=lambda _c, _p: _reply(self.proposal(changes={"/runtime/max_batch_size": True}))
        )
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            provider.generate(context)

    def test_provider_rejects_forbidden_top_level_generation_field(self) -> None:
        context = __import__("services.candidate_generator", fromlist=["build_model_context"]).build_model_context(base_state())
        forbidden = self.proposal(gpu_count=2)
        provider = assistant_model.AssistantModelCandidateProvider(
            transport=lambda _c, _p: _reply(forbidden)
        )
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            provider.generate(context)

    def test_unauthorized_unpublished_and_duplicate_outputs_are_rejected(self) -> None:
        cases = (
            {"changes": {"/runtime/unknown": 5}},
            {"deployment_candidate_id": "draft"},
        )
        for override in cases:
            with self.subTest(override=override):
                state = base_state()
                if override.get("deployment_candidate_id") == "draft":
                    state["deployment_candidates"] = [{"candidate_id": "draft", "status": "draft", "published": False, "executable": False}]
                proposal = self.proposal(**override)
                generator = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=lambda _c, _p, p=proposal: _reply(p)))
                result = generator.generate(state)
                self.assertTrue(result["fallback_from_model"])

        state = base_state()
        proposal = self.proposal()
        from services.candidate_generator import _candidate_digest

        state["candidate_history"] = [{
            "candidate_digest": _candidate_digest(state, proposal["changes"], state["deployment_candidates"][1], state["run_strategy"]),
            "combination_key": "model:already-used",
        }]
        duplicate = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=lambda _c, _p: _reply(proposal))).generate(state)
        self.assertTrue(duplicate["fallback_from_model"])

    def test_no_fallback_candidate_enters_manual_intervention_without_execution(self) -> None:
        class NoFallback:
            source = "确定性扫描"

            def generate(self, _state):
                return {"available": False, "source": self.source, "reason": "no fallback"}

        current = authorized(exploration_state(budget={"max_rounds": 1, "max_runs": 2, "max_model_calls": 1}))
        current["deployment_candidates"] = []
        current["phase"] = "generate_candidate"
        current["status"] = "exploring"

        def no_candidate_transport(_config, payload):  # noqa: ANN001
            context = json.loads(payload["messages"][1]["content"])
            return _reply(self.proposal(deployment_candidate_id=None, schema_set_revision=context["schema_set_revision"]))

        result = ModelCandidateGenerator(
            assistant_model.AssistantModelCandidateProvider(
                transport=no_candidate_transport
            ),
            fallback=NoFallback(),
        ).generate(current)
        self.assertFalse(result["available"])
        self.assertTrue(result["fallback_from_model"])

        graph, _ = build_exploration_graph(
            str(Path(tempfile.mkdtemp()) / "manual-intervention.sqlite3"),
            candidate_generator=ModelCandidateGenerator(
                assistant_model.AssistantModelCandidateProvider(
                    transport=no_candidate_transport
                ),
                fallback=NoFallback(),
            ),
        )
        graph_result = graph.invoke(
            {"session_id": current["session_id"], "domain_state": current},
            {"configurable": {"thread_id": current["session_id"]}},
        )
        self.assertEqual(graph_result["domain_state"]["status"], "manual_intervention_required")
        self.assertEqual(graph_result["domain_state"]["stop_reason"]["reason"], "manual_intervention_required")
        self.assertEqual(graph_result["domain_state"]["stop_reason"]["detail"], "candidate_generation_failed")

    def test_switch_is_off_by_default_and_only_selects_provider_when_enabled(self) -> None:
        self.assertFalse(assistant_model.exploration_model_candidates_enabled())
        os.environ[assistant_model.EXPLORATION_MODEL_CANDIDATES_ENV] = "on"
        self.assertTrue(assistant_model.exploration_model_candidates_enabled())

    def test_isolated_langgraph_worker_smoke_is_serial_and_local_synthetic(self) -> None:
        """Run one model candidate through the real graph/worker boundary.

        This is intentionally a local synthetic smoke, rather than an external
        Provider or production TileSim acceptance.  The injected transport is
        the only model implementation used by the test.
        """
        current = authorized(exploration_state(budget={"max_rounds": 1, "max_runs": 2, "max_model_calls": 1}))
        current["fixed_resources"] = {"engine": "published-engine", "gpu_type": "fixed", "gpu_count": 2}
        current["deployment_candidates"] = [{
            "candidate_id": "deployment-a",
            "status": "published",
            "published": True,
            "executable": True,
            "resource_binding": {"group": "a"},
        }]
        current["run_strategy"] = {"batch_scheduler": "continuous"}
        current["workload_scenarios"] = [
            {"scenario_id": "smoke-low", "description": "local synthetic low load"},
            {"scenario_id": "smoke-high", "description": "local synthetic high load"},
        ]

        calls: list[dict] = []

        def transport(_config, payload):  # noqa: ANN001
            calls.append(payload)
            context = json.loads(payload["messages"][1]["content"])
            proposal = self.proposal(
                schema_set_revision=context["schema_set_revision"],
                deployment_candidate_id="deployment-a",
                changes={"/request_count": 12},
            )
            return _reply(proposal)

        generator = ModelCandidateGenerator(assistant_model.AssistantModelCandidateProvider(transport=transport))
        root = Path(os.environ.get("TEMP", tempfile.gettempdir())) / ("tilesim-stage5-smoke-" + os.urandom(6).hex())
        root.mkdir(parents=True, exist_ok=True)
        repository = ExplorationRepository(root / "exploration.sqlite3")
        graph, _ = build_exploration_graph(str(root / "checkpoint.sqlite3"), candidate_generator=generator)
        worker = ExplorationWorker(repository, executor=LocalSyntheticRunExecutor(), graph=graph)
        repository.create(current)
        worker.start(current["session_id"])
        deadline = time.time() + 5
        while time.time() < deadline:
            saved = repository.get(current["session_id"])
            if saved and saved.get("status") in exploration_domain.TERMINAL_STATES:
                break
            time.sleep(0.02)
        saved = repository.get(current["session_id"])
        self.assertIsNotNone(saved)
        self.assertEqual(saved["status"], "budget_exhausted")
        self.assertEqual(saved["run_count"], 2)
        self.assertEqual(saved["model_calls"], 1)
        self.assertEqual(saved["current_candidate"]["origin"], "model")
        self.assertEqual(saved["current_candidate"]["deployment_candidate_id"], "deployment-a")
        self.assertEqual(len(saved.get("run_history", [])), 2)
        self.assertEqual(len({item["run_id"] for item in saved["run_history"]}), 2)
        self.assertEqual({item["scenario_id"] for item in saved["run_history"]}, {"smoke-low", "smoke-high"})
        self.assertEqual(saved["provenance"]["source_mode"], "synthetic_trace")
        self.assertEqual(saved["provenance"]["deployment_mode"], "local_dev")
        self.assertEqual(saved["stop_reason"]["reason"], "max_rounds")
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
