"""HTTP-facing service for the automatic exploration resource."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from agent_harness import exploration as domain
from agent_harness.contracts import EXPLORATION_CONTRACT_REVISION, EXPLORATION_SCHEMA_IDENTITIES, canonical_sha256
from agent_harness.exploration_planning import plan_exploration, confirm_exploration_plan, PlanningError, validate_planning_document
from repositories.explorations import ExplorationRepository, ExplorationRepositoryError
from services.exploration_worker import ExplorationWorker


class ExplorationServiceError(ValueError):
    def __init__(self, code: str, message: str, *, status: int = 400, field_path: str = "/"):
        super().__init__(message); self.code = code; self.status = status; self.field_path = field_path


PROVENANCE = domain.EXPLORATION_PROVENANCE


class ExplorationService:
    def __init__(self, repository: ExplorationRepository, *, schema_set_revision: str, backend_identity: dict[str, Any] | Any, worker: ExplorationWorker | None = None):
        self.repository = repository
        self.schema_set_revision = schema_set_revision
        self.backend_identity = backend_identity
        self.worker = worker or ExplorationWorker(repository)

    def _backend(self) -> dict[str, Any]:
        return self.backend_identity() if callable(self.backend_identity) else self.backend_identity

    def _detail(self, state: dict[str, Any]) -> dict[str, Any]:
        return {"session": domain.project_session(state), "candidate": domain.project_candidate(state.get("current_candidate")), "evaluation": domain.project_evaluation(state.get("current_evaluation")), "summary": domain.project_summary(state.get("summary")), "events": [domain.project_event(event) for event in state.get("events", [])]}

    def plan(self, body: dict[str, Any]) -> dict[str, Any]:
        """Read-only planning checkpoint; it never touches the repository or slot."""
        try:
            result = plan_exploration(context=body.get("context") or {}, request=body.get("request") or body, schema_set_revision=self.schema_set_revision)
        except PlanningError as error:
            raise ExplorationServiceError(error.code, str(error), field_path=error.field_path) from error
        return {"plan": result, "provenance": PROVENANCE, "side_effects": {"run_created": False, "slot_claimed": False, "executor_called": False, "page_locked": False}}

    def confirm_plan(self, body: dict[str, Any], principal: str) -> dict[str, Any]:
        """Freeze a plan after explicit user confirmation, still without execution."""
        try:
            plan = body.get("plan") or {}
            if isinstance(plan, dict) and plan.get("schema_set_revision") != self.schema_set_revision:
                raise PlanningError("schema_revision_mismatch", "Planning schema-set revision is not current.", field_path="/plan/schema_set_revision")
            result = confirm_exploration_plan(plan, principal=principal, confirmation=body.get("confirmation") or {})
        except PlanningError as error:
            raise ExplorationServiceError(error.code, str(error), field_path=error.field_path) from error
        return {"plan": result, "provenance": PROVENANCE, "side_effects": {"run_created": False, "slot_claimed": False, "executor_called": False, "page_locked": False}}

    def create(self, body: dict[str, Any], principal: str, workspace_id: str) -> dict[str, Any]:
        context = body.get("context")
        try:
            planning_plan = body.get("planning_plan") or body.get("plan")
            if planning_plan is not None:
                validate_planning_document("plan", planning_plan)
                if planning_plan.get("status") != "draft_ready" or not isinstance(planning_plan.get("confirmation"), dict) or planning_plan["confirmation"].get("confirmed") is not True:
                    raise domain.ExplorationError("planning_confirmation_required", "请先确认探索草案；确认前不会创建探索会话。", field_path="/planning_plan/confirmation")
                if planning_plan.get("schema_set_revision") != self.schema_set_revision:
                    raise domain.ExplorationError("planning_schema_revision_mismatch", "请重新规划；规划草案与当前契约版本不一致。", field_path="/planning_plan/schema_set_revision")
                confirmation = planning_plan["confirmation"]
                if confirmation.get("source") != "user" or confirmation.get("confirmed_by") != principal:
                    raise domain.ExplorationError("planning_confirmation_invalid", "探索草案必须由当前用户显式确认。", field_path="/planning_plan/confirmation")
                expected_digest = canonical_sha256({key: value for key, value in planning_plan.items() if key != "draft_digest"})
                if planning_plan.get("draft_digest") != expected_digest:
                    raise domain.ExplorationError("planning_digest_mismatch", "探索草案内容已变化，请重新规划并确认。", field_path="/planning_plan/draft_digest")
                recommendations = planning_plan.get("recommendations")
                if isinstance(recommendations, list) and any(
                    not isinstance(item, dict) or item.get("confirmed") is not True or item.get("confirmed_by") != principal
                    for item in recommendations
                ):
                    raise domain.ExplorationError("planning_confirmation_invalid", "所有系统建议必须先经过用户确认。", field_path="/planning_plan/recommendations")
            context = domain.validate_context(context, expected_schema_set_revision=self.schema_set_revision, expected_backend_identity=self._backend())
            objective = (planning_plan.get("objective") if isinstance(planning_plan, dict) else None) or body.get("objective") or {"metric_path": "/metrics/latency_us", "direction": "minimize"}
            # Deployment planning records carry their own identity metadata. The
            # existing exploration state machine consumes the deliberately
            # smaller runtime objective contract, so lower only this boundary
            # while retaining the full confirmed plan in the session snapshot.
            if isinstance(planning_plan, dict) and isinstance(objective, dict) and "primary_objective" in objective:
                objective = {key: value for key, value in objective.items() if key not in {"schema_identity", "contract_revision", "schema_set_revision"}}
                objective["constraints"] = [
                    {key: value for key, value in item.items() if key not in {"schema_identity", "contract_revision", "schema_set_revision"}}
                    for item in objective.get("constraints", [])
                    if isinstance(item, dict)
                ]
            objective = domain.validate_objective(objective)
            grants = domain.validate_parameter_grants(body.get("parameter_grants"))
            budget = domain.validate_budget(body.get("budget"))
            sid = body.get("session_id") or f"exploration-{uuid.uuid4().hex}"
            state = domain.new_exploration_state(session_id=sid, principal=principal, workspace_id=workspace_id, context=context, objective=objective, parameter_grants=grants, base_config=body.get("base_config") or context.get("base_config") or {"value": 0}, budget=budget, expected_schema_set_revision=self.schema_set_revision, expected_backend_identity=self._backend())
            run_request = body.get("run_request")
            if run_request is not None:
                if not isinstance(run_request, dict):
                    raise domain.ExplorationError("invalid_run_request", "run_request must be an object.", field_path="/run_request")
                state["context_snapshot"] = {**state.get("context_snapshot", {}), "run_request": run_request}
            if isinstance(planning_plan, dict):
                state["planning_plan"] = dict(planning_plan)
                candidates = planning_plan.get("deployment_candidates")
                if isinstance(candidates, list):
                    state["deployment_candidates"] = [dict(item) for item in candidates if isinstance(item, dict)]
                fixed_resources = planning_plan.get("fixed_resources")
                if isinstance(fixed_resources, dict):
                    state["fixed_resources"] = dict(fixed_resources)
                strategy = planning_plan.get("run_strategy")
                if isinstance(strategy, dict):
                    state["run_strategy"] = dict(strategy)
                    state["run_strategy_digest"] = canonical_sha256(strategy)
                scenarios = planning_plan.get("workload_scenarios")
                if isinstance(scenarios, list):
                    # The graph consumes this immutable, user-confirmed
                    # projection.  It is never populated from model prose or
                    # from an unconfirmed recommendation.
                    state["workload_scenarios"] = [dict(item) for item in scenarios if isinstance(item, dict)]
                    state["scenario_index"] = 0
                    state["scenario_results"] = []
        except PlanningError as error:
            raise ExplorationServiceError(error.code, str(error), field_path=error.field_path) from error
        except domain.ExplorationError as error:
            raise ExplorationServiceError(error.code, str(error), field_path=error.field_path) from error
        self.repository.create(state)
        return {"session": domain.project_session(state), "detail": self._detail(state), "provenance": PROVENANCE}

    def get(self, session_id: str, principal: str, workspace_id: str) -> dict[str, Any]:
        state = self._owned(session_id, principal, workspace_id)
        return {"session": domain.project_session(state), "detail": self._detail(state), "provenance": PROVENANCE}

    def list(self, principal: str, workspace_id: str) -> dict[str, Any]:
        items = self.repository.list(principal, workspace_id)
        return {"sessions": [domain.project_session(item) for item in items], "provenance": PROVENANCE}

    def authorize(self, session_id: str, body: dict[str, Any], principal: str, workspace_id: str) -> dict[str, Any]:
        state = self._owned(session_id, principal, workspace_id)
        active_slot = self.repository.active_slot()
        if active_slot and active_slot.get("session_id") != session_id:
            raise ExplorationServiceError("exploration_busy", "当前已有自动探索占用唯一实验槽位。", status=409)
        existing = state.get("authorization")
        if existing and body.get("authorization_digest") == existing.get("authorization_digest"):
            return {"authorization": existing, "session": domain.project_session(state), "detail": self._detail(state), "autonomous_started": True, "idempotent_replay": True, "provenance": PROVENANCE}
        requested_budget = body.get("budget", state["budget"])
        budget = domain.validate_budget(requested_budget)
        now = datetime.now(timezone.utc)
        planning_plan = state.get("planning_plan") if isinstance(state.get("planning_plan"), dict) else None
        auth = {"schema_identity": EXPLORATION_SCHEMA_IDENTITIES["authorization"], "contract_revision": EXPLORATION_CONTRACT_REVISION, "authorization_id": f"explore-authz-{uuid.uuid4().hex}", "session_id": session_id, "task_type": "explore_experiment", "principal": principal, "workspace_id": workspace_id, "context_revision": state["context_revision"], "run_context_revision": state.get("run_context_revision"), "input_snapshot_digest": state["input_snapshot_digest"], "schema_set_revision": state["schema_set_revision"], "backend_identity": state["backend_identity"], "parameter_catalog_revision": state["parameter_catalog_revision"], "autonomy_level": "bounded_autonomous", "budget": budget, "parameter_grants": state["parameter_grants"], "objective": state["objective"], "tool_allowlist": ["create_run", "wait_for_terminal", "read_verified_metrics"], "allowed_pages": state["allowed_pages"], "allowed_actions": state["allowed_actions"], "protected": {"context_revision": state["context_revision"], "run_context_revision": state.get("run_context_revision"), "input_snapshot_digest": state["input_snapshot_digest"], "schema_set_revision": state["schema_set_revision"], "backend_identity": state["backend_identity"], "parameter_catalog_revision": state["parameter_catalog_revision"]}, "status": "active", "issued_by": principal, "issued_at": now.isoformat(), "expires_at": (now + timedelta(minutes=15)).isoformat(), "revoked_at": None, "provenance": PROVENANCE, "planning_plan_digest": planning_plan.get("draft_digest") if planning_plan else None, "planning_confirmation": planning_plan.get("confirmation") if planning_plan else None, "run_strategy": state.get("run_strategy"), "run_strategy_digest": state.get("run_strategy_digest"), "deployment_candidates": state.get("deployment_candidates", [])}
        auth["authorization_digest"] = canonical_sha256(auth)
        try:
            state = domain.bind_authorization(state, auth)
        except domain.ExplorationError as error:
            raise ExplorationServiceError(error.code, str(error), field_path=error.field_path, status=409 if error.code in {"reauthorization_required", "authorization_binding_mismatch"} else 400) from error
        # Reserve the single exploration slot for the whole authorized session.
        # The worker fills in the concrete run id before each experiment; keeping
        # the session lease between rounds prevents a second session from being
        # accepted during the candidate-generation gap.
        try:
            self.repository.claim_slot(session_id, "", state["updated_at"])
            self.repository.save(state)
        except Exception:
            self.repository.release_slot(session_id)
            raise
        self.worker.start(session_id)
        return {"authorization": auth, "session": domain.project_session(state), "detail": self._detail(state), "autonomous_started": True, "idempotent_replay": False, "provenance": PROVENANCE}

    def action(self, session_id: str, action: str, principal: str, workspace_id: str) -> dict[str, Any]:
        state = self._owned(session_id, principal, workspace_id)
        try:
            if action == "pause": state = domain.pause_exploration(state)
            elif action == "resume":
                state = domain.resume_exploration(state)
                state = self.repository.save(state, expected_version=int(state.get("_state_version", 0)))
                self.worker.start(session_id)
                return {"session": domain.project_session(state), "detail": self._detail(state), "action": action, "provenance": PROVENANCE}
            elif action == "cancel":
                run = state.get("current_run")
                if isinstance(run, dict):
                    # The domain keeps the minimal run identity for its state
                    # machine.  The formal cancel boundary also requires the
                    # immutable session bindings, so add those bindings at the
                    # service edge instead of teaching the graph about HTTP.
                    cancel_identity = {
                        **run,
                        "principal": state.get("principal"),
                        "workspace_id": state.get("workspace_id"),
                        "backend_identity": state.get("backend_identity"),
                        "schema_set_revision": state.get("schema_set_revision"),
                    }
                    result = self.worker.executor.cancel(cancel_identity)
                    latest = self.repository.get(session_id) or state
                    if result.get("status") == "unknown":
                        state = domain._stop(latest, "recovery_required", "cancel_unknown", unknown_outcome=True)
                    else:
                        # A pause/cancel written while the executor was
                        # responding wins over the stale in-memory snapshot.
                        state = domain.stop_exploration(latest, reason="manual_stop")
                        state["current_run"] = {**run, "status": result.get("status", "cancelled")}
                else:
                    state = domain.stop_exploration(self.repository.get(session_id) or state, reason="manual_stop")
            else: raise ExplorationServiceError("invalid_action", "Unsupported exploration action.")
        except domain.ExplorationError as error:
            raise ExplorationServiceError(error.code, str(error), status=409, field_path=error.field_path) from error
        state = self.repository.save(state, expected_version=int(state.get("_state_version", 0)))
        if action == "cancel" and state.get("status") == "cancelled":
            self.repository.release_slot(session_id)
        return {"session": domain.project_session(state), "detail": self._detail(state), "action": action, "provenance": PROVENANCE}

    def _owned(self, session_id: str, principal: str, workspace_id: str) -> dict[str, Any]:
        state = self.repository.get(session_id)
        if state is None: raise ExplorationServiceError("exploration_not_found", "Exploration session was not found.", status=404)
        if state.get("principal") != principal or state.get("workspace_id") != workspace_id: raise ExplorationServiceError("exploration_access_denied", "Exploration session is not owned by this caller.", status=403)
        return state
