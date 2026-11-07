"""Single-consumer adapter around the durable LangGraph exploration controller."""
from __future__ import annotations

import queue
import threading
import copy
from typing import Any

from agent_harness import exploration as domain
from repositories.explorations import ExplorationRepository, ExplorationRepositoryError
from services.run_executor import LocalSyntheticRunExecutor, RunExecutor


class ExplorationWorker:
    def __init__(self, repository: ExplorationRepository, *, executor: RunExecutor | None = None, graph=None):
        self.repository = repository
        self.executor = executor or LocalSyntheticRunExecutor()
        self.graph = graph
        self._queue: queue.Queue[str] = queue.Queue()
        self._thread: threading.Thread | None = None
        self._scheduled: set[str] = set()
        self._lock = threading.RLock()

    def start(self, session_id: str) -> None:
        if self.graph is None:
            raise RuntimeError("automatic exploration requires an active LangGraph controller")
        with self._lock:
            if session_id not in self._scheduled:
                self._scheduled.add(session_id)
                self._queue.put(session_id)
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._consume, daemon=True, name="exploration-worker")
                self._thread.start()

    def _consume(self) -> None:
        while True:
            session_id = self._queue.get()
            try:
                self._run(session_id)
            finally:
                with self._lock:
                    self._scheduled.discard(session_id)
                self._queue.task_done()

    def _save(self, state: dict[str, Any], *, expected_version: int | None = None) -> dict[str, Any]:
        saved = self.repository.save(state, expected_version=expected_version)
        self.repository.save_checkpoint(
            saved["session_id"],
            {"session_id": saved["session_id"], "state": saved, "last_event_sequence": len(saved.get("events", []))},
        )
        return saved

    def _external(self, waiting_for: str, state: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any]:
        # The page publishes the complete validated create-run request as part
        # of its immutable context. Pass it through the execution envelope so
        # a formal adapter can reuse it without making the worker construct a
        # second request shape. Synthetic executors ignore this field.
        execution_authorization = dict(authorization)
        context_snapshot = state.get("context_snapshot")
        if isinstance(context_snapshot, dict) and isinstance(context_snapshot.get("run_request"), dict):
            execution_authorization["run_request"] = copy.deepcopy(context_snapshot["run_request"])
        scenario = state.get("active_scenario")
        if isinstance(scenario, dict) and isinstance(execution_authorization.get("run_request"), dict):
            # Scenario ids are published plan values.  They are selected by
            # the graph, never synthesized from model text or arbitrary URLs.
            scenario_id = scenario.get("scenario_id")
            if isinstance(scenario_id, str) and scenario_id:
                execution_authorization["run_request"]["scenario_id"] = scenario_id
        candidate = state.get("current_candidate") or {}
        if isinstance(candidate, dict):
            execution_authorization["candidate_summary"] = copy.deepcopy(candidate.get("deployment_candidate_summary") or candidate.get("deployment_candidate"))
            execution_authorization["run_strategy_summary"] = copy.deepcopy(candidate.get("run_strategy"))
            execution_authorization["planning_plan_digest"] = state.get("planning_plan", {}).get("draft_digest") if isinstance(state.get("planning_plan"), dict) else None
            execution_authorization["scenario_summary"] = copy.deepcopy((scenario or {}).get("scenario_summary") if isinstance(scenario, dict) else scenario) or copy.deepcopy(scenario)
        if waiting_for == "create_run":
            execution_authorization["execution_envelope"] = {
                "session_id": state.get("session_id"),
                "candidate_id": candidate.get("candidate_id"),
                "deployment_candidate_id": candidate.get("deployment_candidate_id"),
                "scenario_id": (scenario or {}).get("scenario_id") if isinstance(scenario, dict) else None,
                "run_strategy_digest": candidate.get("run_strategy_digest"),
                "candidate_summary": copy.deepcopy(candidate.get("deployment_candidate_summary") or candidate.get("deployment_candidate")),
                "scenario_summary": copy.deepcopy((scenario or {}).get("scenario_summary") if isinstance(scenario, dict) else scenario) or copy.deepcopy(scenario),
                "run_strategy_summary": copy.deepcopy(candidate.get("run_strategy")),
                "model_proposal": copy.deepcopy(candidate.get("model_proposal")),
                "model_context_digest": candidate.get("model_context_digest"),
                "planning_plan_digest": state.get("planning_plan", {}).get("draft_digest") if isinstance(state.get("planning_plan"), dict) else None,
            }
        if waiting_for == "create_run":
            return self.executor.create_run(state["current_candidate"], execution_authorization)
        if waiting_for == "wait_run":
            return self.executor.wait_for_terminal(state["current_run"])
        if waiting_for == "read_verified_metrics":
            objective = state.get("objective") or {}
            primary = objective.get("primary_objective") if isinstance(objective.get("primary_objective"), dict) else objective
            primary_path = primary.get("metric_path")
            if not isinstance(primary_path, str) or not primary_path:
                raise ExplorationRepositoryError("objective_invalid", "The exploration objective has no metric path.")
            paths = [primary_path]
            for constraint in objective.get("constraints", []) if isinstance(objective.get("constraints"), list) else []:
                path = constraint.get("metric_path") if isinstance(constraint, dict) else None
                if isinstance(path, str) and path not in paths:
                    paths.append(path)
            observations = [self.executor.read_verified_metrics(state["current_run"], path) for path in paths]
            primary_observation = observations[0]
            if primary_observation.get("status") != "verified" or len(observations) == 1:
                return primary_observation
            # Keep primary evidence bound to the objective pointer while
            # carrying all verified scalar values in a nested map for the
            # multi-scenario evaluator.
            metrics: dict[str, Any] = {}
            for path, observation in zip(paths, observations):
                if observation.get("status") != "verified":
                    return observation
                cursor = metrics
                tokens = path.lstrip("/").split("/")
                for token in tokens[:-1]:
                    token = token.replace("~1", "/").replace("~0", "~")
                    cursor = cursor.setdefault(token, {})
                if tokens:
                    leaf = tokens[-1].replace("~1", "/").replace("~0", "~")
                    cursor[leaf] = observation.get("value")
            return {**primary_observation, "metrics": metrics}
        raise ExplorationRepositoryError("graph_wait_invalid", f"Unknown graph external request: {waiting_for}")

    def _run(self, session_id: str) -> None:
        state = self.repository.get(session_id)
        if not state:
            return
        external_result: dict[str, Any] | None = None
        resume_at: str | None = None
        try:
            while state.get("status") not in domain.TERMINAL_STATES:
                if external_result is None and isinstance(state.get("_pending_external"), dict):
                    external_result = dict(state["_pending_external"])
                    resume_at = state.get("_pending_resume_at") or resume_at
                # Reconcile a graph invocation that completed before the
                # repository write (for example a process restart).  The
                # checkpoint is authoritative for graph state; a pending
                # envelope is cleared only after that checkpoint consumed it.
                checkpoint_state = self.graph.get_state({"configurable": {"thread_id": session_id}})
                checkpoint_values = getattr(checkpoint_state, "values", {}) or {}
                checkpoint_number = int(checkpoint_values.get("checkpoint", 0) or 0)
                persisted_number = int(state.get("_graph_checkpoint", 0) or 0)
                if checkpoint_number > persisted_number and isinstance(checkpoint_values.get("domain_state"), dict):
                    recovered = copy.deepcopy(checkpoint_values["domain_state"])
                    recovered["_graph_checkpoint"] = checkpoint_number
                    recovered.pop("_pending_external", None)
                    recovered.pop("_pending_resume_at", None)
                    recovered.pop("_external_in_flight", None)
                    state = self._save(recovered, expected_version=int(state.get("_state_version", 0)))
                    continue
                if state.get("_external_in_flight") and not state.get("_pending_external"):
                    inflight = state["_external_in_flight"]
                    waiting = inflight.get("waiting_for")
                    candidate = state.get("current_candidate") or {}
                    key = candidate.get("run_idempotency_key")
                    effect = self.repository.run_effect(key) if isinstance(key, str) and getattr(self.executor, "repository", None) is not None else None
                    # A create request with no durable response cannot be
                    # replayed blindly. Formal adapters must enter recovery;
                    # GET-based wait/metric observations remain safe to repeat.
                    if waiting == "create_run":
                        if effect and effect.get("side_effect_status") in {"submitted", "terminal", "verified"} and effect.get("run_id"):
                            recovered = dict(state)
                            recovered["_pending_external"] = {"run_id": effect["run_id"], "status": "running", "idempotency_key": key}
                            recovered["_pending_resume_at"] = inflight.get("resume_at") or "create_single_run"
                            recovered.pop("_external_in_flight", None)
                            state = self._save(recovered, expected_version=int(state.get("_state_version", 0)))
                            continue
                        if effect and getattr(self.executor, "repository", None) is not None:
                            authorization = state.get("authorization")
                            try:
                                replay = self._external("create_run", state, authorization)
                            except Exception:
                                replay = {"status": "unknown"}
                            if replay.get("run_id") and replay.get("status") != "unknown":
                                recovered = dict(state)
                                recovered["_pending_external"] = replay
                                recovered["_pending_resume_at"] = inflight.get("resume_at") or "create_single_run"
                                recovered.pop("_external_in_flight", None)
                                state = self._save(recovered, expected_version=int(state.get("_state_version", 0)))
                                continue
                        state = domain._stop(state, "recovery_required", "external_result_unknown", unknown_outcome=True)
                        self._save(state, expected_version=int(state.get("_state_version", 0)))
                        return
                    if effect is None:
                        state = domain._stop(state, "recovery_required", "external_result_unknown", unknown_outcome=True)
                        self._save(state, expected_version=int(state.get("_state_version", 0)))
                        return
                    state = dict(state)
                    state.pop("_external_in_flight", None)
                    state = self._save(state, expected_version=int(state.get("_state_version", 0)))
                    continue
                if state.get("status") == "paused":
                    return
                state_version = int(state.get("_state_version", 0))
                graph_input: dict[str, Any] = {
                    "session_id": session_id,
                    "domain_state": state,
                }
                if resume_at:
                    graph_input["resume_at"] = resume_at
                if external_result is not None:
                    graph_input["external_result"] = external_result
                else:
                    graph_input["external_result"] = {}
                result = self.graph.invoke(graph_input, {"configurable": {"thread_id": session_id}})
                state = result["domain_state"]
                waiting_for = result.get("waiting_for") or ""
                resume_at = result.get("resume_at") or None
                external_result = None
                state["_graph_checkpoint"] = int(result.get("checkpoint", 0) or 0)
                state.pop("_pending_external", None)
                state.pop("_pending_resume_at", None)
                state.pop("_external_in_flight", None)
                latest_before_save = self.repository.get(session_id) or state
                if int(latest_before_save.get("_state_version", 0)) != state_version:
                    if latest_before_save.get("status") in {"paused", *domain.TERMINAL_STATES}:
                        return
                    state = domain._stop(latest_before_save, "recovery_required", "state_version_conflict", unknown_outcome=True)
                    self._save(state, expected_version=int(latest_before_save.get("_state_version", 0)))
                    return
                state = self._save(state, expected_version=state_version)
                if state.get("status") in domain.TERMINAL_STATES:
                    self.repository.release_slot(session_id)
                    return
                if not waiting_for:
                    continue
                before_external = self.repository.get(session_id) or state
                if before_external.get("status") in {"paused", "cancelled", *domain.TERMINAL_STATES}:
                    return
                authorization = before_external.get("authorization")
                domain.assert_authorization_active(before_external, authorization)
                before_external = dict(before_external)
                before_external["_external_in_flight"] = {
                    "waiting_for": waiting_for,
                    "resume_at": resume_at,
                    "candidate_id": (before_external.get("current_candidate") or {}).get("candidate_id"),
                    "run_id": (before_external.get("current_run") or {}).get("run_id"),
                }
                before_external = self._save(
                    before_external,
                    expected_version=int(before_external.get("_state_version", 0)),
                )
                inflight_version = int(before_external.get("_state_version", 0))
                external_result = self._external(waiting_for, before_external, authorization)
                if waiting_for == "create_run" and external_result.get("status") not in {"unknown", "cancelled"} and external_result.get("run_id"):
                    # Keep the durable lease tied to the concrete run as soon
                    # as the executor accepts it.  The lease is never released
                    # while cancellation remains unknown.
                    self.repository.claim_slot(session_id, str(external_result["run_id"]), before_external.get("updated_at", ""))
                current = self.repository.get(session_id) or before_external
                if current.get("status") == "paused":
                    paused = dict(current)
                    paused["_pending_external"] = external_result
                    paused["_pending_resume_at"] = resume_at
                    paused.pop("_external_in_flight", None)
                    self._save(paused, expected_version=int(current.get("_state_version", 0)))
                    return
                if current.get("status") in {"cancelled", *domain.TERMINAL_STATES}:
                    completed_after_stop = dict(current)
                    completed_after_stop.pop("_external_in_flight", None)
                    self._save(completed_after_stop, expected_version=int(current.get("_state_version", 0)))
                    return
                current = dict(current)
                current["_pending_external"] = external_result
                current["_pending_resume_at"] = resume_at
                current.pop("_external_in_flight", None)
                if int(current.get("_state_version", 0)) != inflight_version:
                    if current.get("status") in {"paused", "cancelled", *domain.TERMINAL_STATES}:
                        return
                    current = domain._stop(current, "recovery_required", "state_version_conflict", unknown_outcome=True)
                    self._save(current, expected_version=int(current.get("_state_version", 0)))
                    return
                current = self._save(current, expected_version=inflight_version)
                state = current
            if state.get("phase") == "finish_report":
                finished = domain.finish_report(state)
                self._save(finished, expected_version=int(state.get("_state_version", 0)))
                self.repository.release_slot(session_id)
        except domain.ExplorationError as error:
            current = self.repository.get(session_id) or state
            if current.get("status") in domain.TERMINAL_STATES:
                return
            current = domain._stop(current, "recovery_required" if error.unknown_outcome else "run_failed", error.code, unknown_outcome=error.unknown_outcome)
            self._save(current)
            if not error.unknown_outcome:
                self.repository.release_slot(session_id)
        except ExplorationRepositoryError as error:
            current = self.repository.get(session_id) or state
            if current.get("status") in domain.TERMINAL_STATES:
                return
            current = domain._stop(current, "recovery_required", error.code, unknown_outcome=True)
            self._save(current)
        except Exception as error:
            current = self.repository.get(session_id) or state
            if current.get("status") in domain.TERMINAL_STATES:
                return
            current = domain._stop(current, "recovery_required", type(error).__name__, unknown_outcome=True)
            self._save(current)
