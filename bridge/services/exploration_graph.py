"""LangGraph controller for the serial automatic exploration runtime."""
from __future__ import annotations

import sqlite3
from typing import Any, TypedDict

from agent_harness import exploration as domain
from services.candidate_generator import CandidateGenerator, DeterministicCandidateGenerator
from services.run_executor import RunExecutor

try:
    from langgraph.checkpoint.sqlite import SqliteSaver
    from langgraph.graph import END, StateGraph
except ModuleNotFoundError as error:  # pragma: no cover
    SqliteSaver = None
    END = "__end__"
    StateGraph = None
    _LANGGRAPH_IMPORT_ERROR = error


class ExplorationGraphDependencyError(RuntimeError):
    code = "langgraph_dependency_missing"


class ExplorationGraphState(TypedDict, total=False):
    session_id: str
    domain_state: dict[str, Any]
    resume_at: str
    waiting_for: str
    external_result: dict[str, Any]
    node: str
    checkpoint: int


def _require_langgraph() -> None:
    if StateGraph is None or SqliteSaver is None:
        raise ExplorationGraphDependencyError(
            "LangGraph and langgraph-checkpoint-sqlite are required for automatic exploration runtime."
        ) from _LANGGRAPH_IMPORT_ERROR


def _domain(state: ExplorationGraphState) -> dict[str, Any]:
    value = state.get("domain_state")
    if not isinstance(value, dict):
        raise ValueError("exploration graph requires a domain_state")
    return value


def build_exploration_graph(
    checkpoint_path: str,
    *,
    candidate_generator: CandidateGenerator | None = None,
    executor: RunExecutor | None = None,
):
    """Compile a real state graph with SQLite WAL checkpoints.

    External execution is represented as a durable ``waiting_for`` request;
    the single Worker performs that call and invokes the graph again with the
    result.  The graph owns every domain transition.
    """
    _require_langgraph()
    generator = candidate_generator or DeterministicCandidateGenerator()
    # The executor remains an injected boundary even though the Worker owns
    # the blocking call; graph nodes emit the durable request that selects it.
    executor_type = getattr(executor, "executor_type", "local_synthetic")

    def transition(name: str, update):
        def run(state: ExplorationGraphState) -> dict[str, Any]:
            current = _domain(state)
            next_state = update(current, state)
            next_state = dict(next_state)
            consume_external = bool(next_state.pop("_consume_external", False))
            next_state.pop("_executor_type", None)
            return {
                "domain_state": next_state,
                "node": name,
                # External results are one-shot inputs.  Keep the envelope
                # while routing through ``receive_request`` and clear it only
                # in the node that consumed it.  This prevents a checkpointed
                # result from being lost before the resume node runs.
                "external_result": {} if consume_external else state.get("external_result", {}),
                "waiting_for": next_state.pop("_waiting_for", ""),
                "resume_at": next_state.pop("_resume_at", ""),
                "checkpoint": int(state.get("checkpoint", 0)) + 1,
            }

        return run

    def receive(current, state):
        if state.get("resume_at"):
            return {**current, "_resume_at": state["resume_at"]}
        phase_routes = {
            "wait_run_terminal": "wait_run",
            "validate_candidate": "validate_candidate",
            "create_one_run": "create_single_run",
            "read_verified_metric": "evaluate_result",
            "update_best": "compare_best",
            "should_continue": "decide_continue",
            "paused": "pause_or_resume",
        }
        if current.get("phase") == "generate_candidate" and getattr(generator, "uses_model", False):
            return {**current, "_resume_at": "generate_model_candidate"}
        if current.get("phase") in phase_routes:
            return {**current, "_resume_at": phase_routes[current["phase"]]}
        return {**current, "phase": "snapshot_context"}

    def validate_context(current, state):
        return domain.snapshot_context(current)

    def _materialize_candidate(current, proposal, *, model_mode: bool):
        if not proposal.get("available"):
            return domain._stop(
                current,
                "manual_intervention_required" if model_mode else "no_improvement",
                "candidate_generation_failed" if model_mode else "max_no_improvement",
            )
        if proposal.get("fallback_from_model"):
            current = dict(current)
            current["last_model_failure"] = proposal.get("model_failure_reason")
            domain._event(current, "model_candidate_fallback", "generate_candidate", {"reason": proposal.get("model_failure_reason")})
        origin = "model" if model_mode and not proposal.get("fallback_from_model") else "rule"
        return domain.generate_candidate(
            current,
            proposal["changes"],
            origin=origin,
            reason=proposal.get("reason"),
            deployment_candidate=proposal.get("deployment_candidate"),
            run_strategy=proposal.get("run_strategy"),
            combination_key=proposal.get("combination_key"),
            model_proposal=proposal.get("model_proposal"),
            model_context_digest=proposal.get("model_context_digest"),
        )

    def generate_candidate(current, state):
        return _materialize_candidate(current, generator.generate(current), model_mode=False)

    def generate_model_candidate(current, state):
        # Count the model call before invoking the provider.  This keeps the
        # budget fence in the durable domain state and makes a model provider
        # unable to bypass the signed exploration budget.
        current = domain.consume_model_call(current)
        if current.get("status") in domain.TERMINAL_STATES:
            return current
        return _materialize_candidate(current, generator.generate(current), model_mode=True)

    def create_single_run(current, state):
        # A confirmed plan may bind several workload scenarios to one
        # candidate.  Select exactly one scenario before crossing the run
        # executor boundary; the next scenario is selected only after the
        # previous run's evidence has been consumed.
        current = domain.prepare_scenario_run(current)
        result = state.get("external_result")
        if not isinstance(result, dict) or not result:
            current = domain.consume_tool_call(current)
            if current.get("status") in domain.TERMINAL_STATES:
                return current
            return {**current, "_waiting_for": "create_run", "_resume_at": "create_single_run", "_executor_type": executor_type}
        next_state = domain.create_one_run(current, result)
        return {**next_state, "_waiting_for": "wait_run", "_resume_at": "wait_run", "_consume_external": True}

    def wait_run(current, state):
        result = state.get("external_result")
        if not isinstance(result, dict) or not result:
            current = domain.consume_tool_call(current)
            if current.get("status") in domain.TERMINAL_STATES:
                return current
            return {**current, "_waiting_for": "wait_run", "_resume_at": "wait_run", "_executor_type": executor_type}
        next_state = domain.wait_run_terminal(current, result)
        if next_state.get("status") not in domain.TERMINAL_STATES:
            return {**next_state, "_waiting_for": "read_verified_metrics", "_resume_at": "evaluate_result", "_consume_external": True}
        return {**next_state, "_consume_external": True}

    def evaluate_result(current, state):
        result = state.get("external_result")
        if not isinstance(result, dict) or not result:
            current = domain.consume_tool_call(current)
            if current.get("status") in domain.TERMINAL_STATES:
                return current
            return {**current, "_waiting_for": "read_verified_metrics", "_resume_at": "evaluate_result", "_executor_type": executor_type}
        next_state = domain.complete_scenario_metric(current, result)
        return {**next_state, "_consume_external": True}

    graph = StateGraph(ExplorationGraphState)
    graph.add_node("receive_request", transition("receive_request", receive))
    graph.add_node("validate_context", transition("validate_context", validate_context))
    graph.add_node("generate_candidate", transition("generate_candidate", generate_candidate))
    graph.add_node("generate_model_candidate", transition("generate_model_candidate", generate_model_candidate))
    graph.add_node("validate_candidate", transition("validate_candidate", lambda current, state: domain.validate_candidate(current)))
    graph.add_node("create_single_run", transition("create_single_run", create_single_run))
    graph.add_node("wait_run", transition("wait_run", wait_run))
    graph.add_node("evaluate_result", transition("evaluate_result", evaluate_result))
    graph.add_node("compare_best", transition("compare_best", lambda current, state: domain.update_best(current)))
    graph.add_node("decide_continue", transition("decide_continue", lambda current, state: domain.should_continue(current, elapsed_time_ms=current.get("elapsed_time_ms", 0))))
    graph.add_node("pause_or_resume", transition("pause_or_resume", lambda current, state: current))
    graph.add_node("complete", transition("complete", lambda current, state: domain.finish_report(current)))

    graph.set_entry_point("receive_request")
    graph.add_conditional_edges("receive_request", lambda value: value.get("resume_at") or "validate_context", {name: name for name in ("validate_context", "generate_candidate", "generate_model_candidate", "validate_candidate", "create_single_run", "wait_run", "evaluate_result", "compare_best", "decide_continue", "pause_or_resume", "complete")})
    graph.add_conditional_edges("validate_context", lambda value: "generate_model_candidate" if getattr(generator, "uses_model", False) else "generate_candidate", {"generate_candidate": "generate_candidate", "generate_model_candidate": "generate_model_candidate"})
    for generation_node in ("generate_candidate", "generate_model_candidate"):
        graph.add_conditional_edges(generation_node, lambda value: "complete" if value.get("domain_state", {}).get("status") in domain.TERMINAL_STATES else "validate_candidate", {"validate_candidate": "validate_candidate", "complete": "complete"})
    graph.add_conditional_edges("validate_candidate", lambda value: "complete" if value.get("domain_state", {}).get("status") in domain.TERMINAL_STATES else "create_single_run", {"create_single_run": "create_single_run", "complete": "complete"})
    graph.add_conditional_edges("create_single_run", lambda value: END if value.get("waiting_for") else "wait_run", {"wait_run": "wait_run", END: END})
    graph.add_conditional_edges("wait_run", lambda value: END if value.get("waiting_for") else "evaluate_result", {"evaluate_result": "evaluate_result", END: END})
    graph.add_conditional_edges("evaluate_result", lambda value: END if value.get("waiting_for") else ("create_single_run" if value.get("domain_state", {}).get("phase") == "create_one_run" else "compare_best"), {"create_single_run": "create_single_run", "compare_best": "compare_best", END: END})
    graph.add_edge("compare_best", "decide_continue")
    graph.add_conditional_edges("decide_continue", lambda value: "complete" if value.get("domain_state", {}).get("status") in domain.TERMINAL_STATES else "pause_or_resume", {"complete": "complete", "pause_or_resume": "pause_or_resume"})
    graph.add_conditional_edges("pause_or_resume", lambda value: "complete" if value.get("domain_state", {}).get("status") in domain.TERMINAL_STATES else ("generate_model_candidate" if getattr(generator, "uses_model", False) else "generate_candidate"), {"complete": "complete", "generate_candidate": "generate_candidate", "generate_model_candidate": "generate_model_candidate"})
    graph.add_edge("complete", END)
    connection = sqlite3.connect(checkpoint_path, check_same_thread=False)
    connection.execute("PRAGMA journal_mode=WAL")
    saver = SqliteSaver(connection)
    return graph.compile(checkpointer=saver), saver
