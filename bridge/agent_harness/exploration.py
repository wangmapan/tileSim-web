"""Pure deterministic state machine for automatic experiment exploration.

This module is deliberately independent from the existing v1 optimization
store and HTTP adapter.  It models the successor semantics needed by the
serial exploration loop without performing a run, calling a model, reading a
provider, or writing durable state.  A service may persist the returned dict
after every transition and use the same functions during recovery.

The public contract is intentionally DTO-like while the successor HTTP/worker
adapter is not active.  The old ``optimization_*_v1`` records therefore remain
untouched and continue to represent the manual approval workflow.
"""

from __future__ import annotations

import copy
import math
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

from .contracts import (
    EXPLORATION_CONTRACT_REVISION,
    EXPLORATION_ACTIONS,
    EXPLORATION_PAGE_IDS,
    EXPLORATION_POLICY_REVISION,
    EXPLORATION_SCHEMA_IDENTITIES,
    HarnessContractError,
    canonical_sha256,
    validate_document,
)

EXPLORATION_PROVENANCE = {
    "deployment_mode": "local_dev",
    "source_mode": "synthetic_trace",
    "claim_scope": "exploratory",
    "production_status": "not_for_production",
}

DEFAULT_EXPLORATION_BUDGET: dict[str, int] = {
    "max_rounds": 10,
    "max_runs": 10,
    "max_concurrency": 1,
    "max_no_improvement": 3,
    "max_failures": 2,
    "max_execution_time_ms": 900_000,
    "max_model_calls": 24,
    "max_tool_calls_per_round": 4,
}

EXPLORATION_BUDGET_LIMITS: dict[str, int] = {
    "max_rounds": 50,
    "max_runs": 50,
    "max_concurrency": 1,
    "max_no_improvement": 20,
    "max_failures": 10,
    "max_execution_time_ms": 3_600_000,
    "max_model_calls": 200,
    "max_tool_calls_per_round": 16,
}

EXPLORATION_STATES = {
    "waiting_authorization",
    "exploring",
    "waiting_run",
    "comparing",
    "completed",
    "paused",
    "cancelled",
    "parameter_validation_failed",
    "run_failed",
    "authorization_expired",
    "authorization_revoked",
    "budget_exhausted",
    "context_expired",
    "recovery_required",
    "manual_intervention_required",
}
TERMINAL_STATES = {
    "completed",
    "cancelled",
    "parameter_validation_failed",
    "run_failed",
    "authorization_expired",
    "authorization_revoked",
    "budget_exhausted",
    "context_expired",
    "recovery_required",
    "manual_intervention_required",
}


class ExplorationError(ValueError):
    """Stable deterministic error returned by exploration validation."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        field_path: str = "/",
        retryable: bool = False,
        unknown_outcome: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.field_path = field_path
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome


def _copy(value: Any) -> Any:
    return copy.deepcopy(value)


def _nonempty(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ExplorationError("invalid_context", "Expected a non-empty string.", field_path=path)
    return value


def _digest(value: Any, path: str) -> str:
    value = _nonempty(value, path)
    if not value.startswith("sha256:") or len(value) != len("sha256:") + 64:
        raise ExplorationError("invalid_digest", "Expected a sha256 digest.", field_path=path)
    digest = value.removeprefix("sha256:")
    if any(character not in "0123456789abcdef" for character in digest):
        raise ExplorationError("invalid_digest", "Expected a lowercase sha256 digest.", field_path=path)
    return value


def _identity_digest(value: Any) -> str:
    # backend identity is an object in the public API, but a digest keeps
    # equality checks stable when callers use an equivalent mapping order.
    return canonical_sha256(value)


def validate_budget(budget: Mapping[str, Any] | None) -> dict[str, int]:
    """Validate the v2 serial exploration resource budget.

    The budget is closed and bounded.  In particular, concurrency is not a
    tunable optimization knob: a serial exploration session always has one
    active experiment.
    """

    supplied = {} if budget is None else dict(budget)
    unknown = sorted(set(supplied) - set(DEFAULT_EXPLORATION_BUDGET))
    if unknown:
        raise ExplorationError("unknown_field", "Exploration budget is closed.", field_path=f"/budget/{unknown[0]}")
    result: dict[str, int] = {}
    for name, default in DEFAULT_EXPLORATION_BUDGET.items():
        value = supplied.get(name, default)
        limit = EXPLORATION_BUDGET_LIMITS[name]
        if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > limit:
            raise ExplorationError(
                "invalid_budget",
                f"{name} is outside the serial exploration bound.",
                field_path=f"/budget/{name}",
            )
        result[name] = value
    if result["max_concurrency"] != 1:
        # Keep a distinct stable code so a UI can explain the serial-only
        # guarantee without treating it as a generic range error.
        raise ExplorationError(
            "serial_only",
            "Automatic exploration permits exactly one active experiment.",
            field_path="/budget/max_concurrency",
        )
    return result


def _unescape_pointer_token(token: str) -> str:
    return token.replace("~1", "/").replace("~0", "~")


def _pointer_tokens(pointer: str, path: str = "/pointer") -> list[str]:
    if not isinstance(pointer, str) or not pointer.startswith("/") or pointer == "/":
        raise ExplorationError("invalid_pointer", "Parameter pointers must be non-root JSON Pointers.", field_path=path)
    raw_tokens = pointer[1:].split("/")
    for token in raw_tokens:
        index = 0
        while index < len(token):
            if token[index] == "~":
                if index + 1 >= len(token) or token[index + 1] not in {"0", "1"}:
                    raise ExplorationError("invalid_pointer", "Parameter pointers must use RFC 6901 escapes.", field_path=path)
                index += 2
            else:
                index += 1
    return [_unescape_pointer_token(token) for token in raw_tokens]


def _get_pointer(document: Any, pointer: str) -> tuple[bool, Any]:
    current = document
    for token in _pointer_tokens(pointer):
        if isinstance(current, Mapping) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            return False, None
    return True, current


def _set_pointer(document: Any, pointer: str, value: Any) -> Any:
    tokens = _pointer_tokens(pointer)
    result = _copy(document)
    current = result
    for token in tokens[:-1]:
        if isinstance(current, dict) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            raise ExplorationError("parameter_unavailable", "Parameter pointer is not present in the base configuration.", field_path=f"/changes/{pointer.lstrip('/')}")
    leaf = tokens[-1]
    if isinstance(current, dict) and leaf in current:
        current[leaf] = _copy(value)
    elif isinstance(current, list) and leaf.isdigit() and int(leaf) < len(current):
        current[int(leaf)] = _copy(value)
    else:
        raise ExplorationError("parameter_unavailable", "Parameter pointer is not present in the base configuration.", field_path=f"/changes/{pointer.lstrip('/')}")
    return result


def _protected_pointer(pointer: str) -> bool:
    protected = {
        "context_revision",
        "input_snapshot_digest",
        "schema_set_revision",
        "backend_identity",
        "parameter_catalog_revision",
        "provenance",
        "source_mode",
        "claim_scope",
        "production_status",
        "fidelity",
        "requested_fidelity",
        "resolved_fidelity",
    }
    return any(token in protected for token in _pointer_tokens(pointer))


def validate_parameter_grants(grants: Any) -> list[dict[str, Any]]:
    if not isinstance(grants, list):
        raise ExplorationError("invalid_parameter_grants", "parameter_grants must be an array.", field_path="/parameter_grants")
    if not grants:
        raise ExplorationError(
            "parameters_unavailable",
            "At least one authorized experiment parameter is required.",
            field_path="/parameter_grants",
        )
    if len(grants) > 64:
        raise ExplorationError("invalid_parameter_grants", "No more than 64 parameter grants are permitted.", field_path="/parameter_grants")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, grant in enumerate(grants):
        path = f"/parameter_grants/{index}"
        if not isinstance(grant, Mapping):
            raise ExplorationError("invalid_parameter_grant", "Each parameter grant must be an object.", field_path=path)
        unknown = sorted(set(grant) - {"pointer", "min", "max", "step", "kind"})
        if unknown:
            raise ExplorationError("unknown_field", "Parameter grants are closed.", field_path=f"{path}/{unknown[0]}")
        pointer = _nonempty(grant.get("pointer"), f"{path}/pointer")
        _pointer_tokens(pointer, f"{path}/pointer")
        if _protected_pointer(pointer):
            raise ExplorationError("protected_field", "Protected experiment identity fields cannot be granted.", field_path=f"{path}/pointer")
        if pointer in seen:
            raise ExplorationError("duplicate_parameter_grant", "Each parameter pointer may be granted once.", field_path=f"{path}/pointer")
        seen.add(pointer)
        values: dict[str, int | float | str] = {"pointer": pointer}
        for name in ("min", "max", "step"):
            value = grant.get(name)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
                raise ExplorationError("invalid_parameter_grant", "Grant bounds must be finite numbers.", field_path=f"{path}/{name}")
            values[name] = value
        if values["min"] >= values["max"]:
            raise ExplorationError("invalid_parameter_grant", "Grant min must be less than max.", field_path=f"{path}/min")
        if values["step"] <= 0:
            raise ExplorationError("invalid_parameter_grant", "Grant step must be positive.", field_path=f"{path}/step")
        if "kind" not in grant:
            raise ExplorationError("invalid_parameter_grant", "Grant kind is required.", field_path=f"{path}/kind")
        kind = grant["kind"]
        if kind not in {"int", "integer", "number", "float"}:
            raise ExplorationError("invalid_parameter_grant", "Grant kind is unsupported.", field_path=f"{path}/kind")
        if kind in {"int", "integer"} and any(float(values[name]) != int(values[name]) for name in ("min", "max", "step")):
            raise ExplorationError("invalid_parameter_grant", "Integer grants require integer bounds and step.", field_path=f"{path}/kind")
        values["kind"] = kind
        normalized.append(values)
    return normalized


def validate_objective(objective: Any) -> dict[str, Any]:
    if not isinstance(objective, Mapping):
        raise ExplorationError("invalid_objective", "Objective must be an object.", field_path="/objective")
    unknown = sorted(set(objective) - {"metric_path", "direction", "minimum_improvement", "plateau_rounds", "primary_objective", "constraints", "aggregation"})
    if unknown:
        raise ExplorationError("unknown_field", "Objective is closed.", field_path=f"/objective/{unknown[0]}")
    primary = objective.get("primary_objective")
    if primary is not None:
        if not isinstance(primary, Mapping):
            raise ExplorationError("invalid_objective", "primary_objective must be an object.", field_path="/objective/primary_objective")
        primary_unknown = sorted(set(primary) - {"metric_path", "direction"})
        if primary_unknown:
            raise ExplorationError("unknown_field", "primary_objective is closed.", field_path=f"/objective/primary_objective/{primary_unknown[0]}")
        metric_path = _nonempty(primary.get("metric_path"), "/objective/primary_objective/metric_path")
        direction = primary.get("direction")
    else:
        metric_path = _nonempty(objective.get("metric_path"), "/objective/metric_path")
        direction = objective.get("direction")
    _pointer_tokens(metric_path, "/objective/metric_path")
    if _protected_pointer(metric_path):
        raise ExplorationError("protected_field", "The objective cannot target a protected identity field.", field_path="/objective/metric_path")
    if direction not in {"minimize", "maximize"}:
        raise ExplorationError("invalid_objective", "Objective direction must be minimize or maximize.", field_path="/objective/direction")
    minimum = objective.get("minimum_improvement", 0.0)
    if isinstance(minimum, bool) or not isinstance(minimum, (int, float)) or not math.isfinite(float(minimum)) or minimum < 0:
        raise ExplorationError("invalid_objective", "minimum_improvement must be non-negative.", field_path="/objective/minimum_improvement")
    plateau = objective.get("plateau_rounds", 3)
    if isinstance(plateau, bool) or not isinstance(plateau, int) or plateau < 1 or plateau > 20:
        raise ExplorationError("invalid_objective", "plateau_rounds is outside the exploration bound.", field_path="/objective/plateau_rounds")
    constraints = objective.get("constraints", [])
    if not isinstance(constraints, list) or len(constraints) > 16:
        raise ExplorationError("invalid_constraints", "constraints must be an array with at most 16 entries.", field_path="/objective/constraints")
    normalized_constraints: list[dict[str, Any]] = []
    for index, constraint in enumerate(constraints):
        path = f"/objective/constraints/{index}"
        if not isinstance(constraint, Mapping) or set(constraint) - {"metric_path", "operator", "threshold", "unit"} or not {"metric_path", "operator", "threshold"}.issubset(constraint):
            raise ExplorationError("invalid_constraint", "Each hard constraint requires metric_path, operator and threshold.", field_path=path)
        constraint_path = _nonempty(constraint.get("metric_path"), f"{path}/metric_path")
        _pointer_tokens(constraint_path, f"{path}/metric_path")
        operator = constraint.get("operator")
        if operator not in {"<", "<=", "=", ">=", ">"}:
            raise ExplorationError("invalid_constraint", "Constraint operator is unsupported.", field_path=f"{path}/operator")
        threshold = constraint.get("threshold")
        if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(float(threshold)):
            raise ExplorationError("invalid_constraint", "Constraint threshold must be finite.", field_path=f"{path}/threshold")
        normalized_constraints.append({"metric_path": constraint_path, "operator": operator, "threshold": threshold, **({"unit": constraint["unit"]} if "unit" in constraint else {})})
    aggregation = objective.get("aggregation", "all_scenarios")
    if aggregation not in {"all_scenarios", "mean", "max", "min", "p95"}:
        raise ExplorationError("invalid_aggregation", "Scenario aggregation is unsupported.", field_path="/objective/aggregation")
    return {
        "metric_path": metric_path,
        "direction": direction,
        "minimum_improvement": minimum,
        "plateau_rounds": plateau,
        "primary_objective": {"metric_path": metric_path, "direction": direction},
        "constraints": normalized_constraints,
        "aggregation": aggregation,
    }


def validate_context(
    context: Any,
    *,
    require_experiment_parameters: bool = True,
    expected_schema_set_revision: str | None = None,
    expected_backend_identity: Mapping[str, Any] | None = None,
    expected_parameter_catalog_revision: str | None = None,
) -> dict[str, Any]:
    """Validate a page/run context before a session is created."""

    if not isinstance(context, Mapping):
        raise ExplorationError("context_unavailable", "An experiment context is required.", field_path="/context")
    normalized = _copy(dict(context))
    _nonempty(normalized.get("context_revision"), "/context/context_revision")
    _digest(normalized.get("input_snapshot_digest"), "/context/input_snapshot_digest")
    _digest(normalized.get("schema_set_revision"), "/context/schema_set_revision")
    _nonempty(normalized.get("parameter_catalog_revision"), "/context/parameter_catalog_revision")
    backend = normalized.get("backend_identity")
    if not isinstance(backend, Mapping) or not backend:
        raise ExplorationError("context_unavailable", "Backend identity is required.", field_path="/context/backend_identity")
    if expected_schema_set_revision is not None and normalized["schema_set_revision"] != expected_schema_set_revision:
        raise ExplorationError(
            "context_revision_mismatch",
            "The context schema-set revision does not match the active Bridge.",
            field_path="/context/schema_set_revision",
        )
    if expected_backend_identity is not None and _identity_digest(backend) != _identity_digest(expected_backend_identity):
        raise ExplorationError(
            "context_revision_mismatch",
            "The context backend identity does not match the active Bridge.",
            field_path="/context/backend_identity",
        )
    if (
        expected_parameter_catalog_revision is not None
        and normalized["parameter_catalog_revision"] != expected_parameter_catalog_revision
    ):
        raise ExplorationError(
            "context_revision_mismatch",
            "The context parameter catalog is stale.",
            field_path="/context/parameter_catalog_revision",
        )
    run_id = normalized.get("run_id")
    run_context_revision = normalized.get("run_context_revision")
    if run_id is not None and (not isinstance(run_id, str) or not run_id.strip()):
        raise ExplorationError("context_unavailable", "run_id must be a non-empty string when supplied.", field_path="/context/run_id")
    if run_context_revision is not None and (not isinstance(run_context_revision, str) or not run_context_revision.strip()):
        raise ExplorationError(
            "context_unavailable",
            "run_context_revision must be a non-empty string when supplied.",
            field_path="/context/run_context_revision",
        )
    if (run_id is None) != (run_context_revision is None):
        raise ExplorationError(
            "context_unavailable",
            "run_id and run_context_revision must be supplied together.",
            field_path="/context/run_context_revision",
        )
    page = normalized.get("current_page")
    if page not in EXPLORATION_PAGE_IDS:
        raise ExplorationError("context_page_not_allowed", "Automatic exploration is not available on this page.", field_path="/context/current_page")
    if require_experiment_parameters:
        parameters = normalized.get("available_parameters")
        if not isinstance(parameters, list) or not parameters:
            raise ExplorationError("parameters_unavailable", "The current page has no usable experiment parameters.", field_path="/context/available_parameters")
    return normalized


def context_binding(context: Mapping[str, Any]) -> dict[str, Any]:
    """Return the immutable identity fence for a context snapshot."""

    required = validate_context(context, require_experiment_parameters=False)
    return {
        # The observed run id may change as each serial candidate completes;
        # the immutable fence is the base run context revision and snapshot.
        "context_revision": required["context_revision"],
        "run_context_revision": required.get("run_context_revision"),
        "input_snapshot_digest": required["input_snapshot_digest"],
        "schema_set_revision": required["schema_set_revision"],
        "parameter_catalog_revision": required["parameter_catalog_revision"],
        "backend_identity_digest": _identity_digest(required["backend_identity"]),
    }


def assert_context_current(state: Mapping[str, Any], context: Mapping[str, Any]) -> None:
    expected = state.get("context_binding")
    if not isinstance(expected, Mapping):
        raise ExplorationError("context_expired", "The exploration has no immutable context binding.")
    actual = context_binding(context)
    if any(actual.get(key) != expected.get(key) for key in expected):
        raise ExplorationError("context_expired", "The experiment context changed during exploration.", field_path="/context")


def _event(state: dict[str, Any], event_type: str, phase: str, payload: Mapping[str, Any] | None = None) -> None:
    events = state.setdefault("events", [])
    sequence = len(events) + 1
    created_at = datetime.now(timezone.utc).isoformat()
    state["state"] = state.get("status")
    state["current_round"] = int(state.get("round_count", state.get("current_round", 0)) or 0)
    active_run = state.get("current_run")
    state["active_run_id"] = active_run.get("run_id") if isinstance(active_run, Mapping) else state.get("active_run_id")
    state["updated_at"] = created_at
    node = "update_best_candidate" if phase == "update_best" else phase
    item = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["event"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "event_id": f"explore-event-{state.get('session_id')}-{sequence}",
        "session_id": state.get("session_id"),
        "sequence": sequence,
        "event_type": event_type,
        "node": node,
        "state": state.get("status"),
        "payload_digest": canonical_sha256(payload or {}),
        "created_at": created_at,
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }
    events.append(item)


def _transition(state: Mapping[str, Any], *, status: str | None = None, phase: str | None = None, error: Mapping[str, Any] | None = None) -> dict[str, Any]:
    current = _copy(dict(state))
    if current.get("status") in TERMINAL_STATES and status and status != current.get("status"):
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot change state.")
    if status is not None:
        if status not in EXPLORATION_STATES:
            raise ExplorationError("invalid_state", "Unknown exploration state.", field_path="/status")
        current["status"] = status
    if phase is not None:
        current["phase"] = phase
    if error is not None:
        current["error"] = _copy(dict(error))
    return current


def new_exploration_state(
    *,
    session_id: str,
    principal: str,
    workspace_id: str,
    context: Mapping[str, Any],
    objective: Mapping[str, Any],
    parameter_grants: list[Mapping[str, Any]],
    base_config: Mapping[str, Any],
    budget: Mapping[str, Any] | None = None,
    authorization_id: str | None = None,
    prior_candidates: list[Mapping[str, Any]] | None = None,
    started_at: str | None = None,
    expected_schema_set_revision: str | None = None,
    expected_backend_identity: Mapping[str, Any] | None = None,
    expected_parameter_catalog_revision: str | None = None,
) -> dict[str, Any]:
    """Construct a pending v2 exploration session after deterministic checks."""

    session_id = _nonempty(session_id, "/session_id")
    principal = _nonempty(principal, "/principal")
    workspace_id = _nonempty(workspace_id, "/workspace_id")
    normalized_context = validate_context(
        context,
        expected_schema_set_revision=expected_schema_set_revision,
        expected_backend_identity=expected_backend_identity,
        expected_parameter_catalog_revision=expected_parameter_catalog_revision,
    )
    normalized_objective = validate_objective(objective)
    grants = validate_parameter_grants(parameter_grants)
    available_parameters = normalized_context.get("available_parameters")
    available_pointers = {
        item
        if isinstance(item, str)
        else item.get("pointer")
        if isinstance(item, Mapping)
        else None
        for item in available_parameters
    }
    # Context projections may carry richer catalog entries whose pointer key
    # is owned by a later adapter.  Enforce the binding whenever this boundary
    # can interpret every published entry; otherwise the formal candidate
    # validator remains the authoritative pointer check.
    if available_pointers and None not in available_pointers:
        unavailable = sorted(
            grant["pointer"] for grant in grants if grant["pointer"] not in available_pointers
        )
        if unavailable:
            raise ExplorationError(
                "parameter_unavailable",
                "An authorized parameter is not published by the current experiment context.",
                field_path=f"/parameter_grants/{unavailable[0]}",
            )
    if not isinstance(base_config, Mapping) or not base_config:
        raise ExplorationError("parameters_unavailable", "A non-empty base configuration is required.", field_path="/base_config")
    normalized_budget = validate_budget(budget)
    if authorization_id is not None:
        _nonempty(authorization_id, "/authorization_id")
    prior = [_copy(item) for item in (prior_candidates or [])]
    seen: list[str] = []
    run_history: list[dict[str, Any]] = []
    for index, candidate in enumerate(prior):
        if not isinstance(candidate, Mapping) or not isinstance(candidate.get("candidate_digest"), str):
            raise ExplorationError("invalid_candidate_history", "Prior candidate history is malformed.", field_path=f"/prior_candidates/{index}")
        if candidate.get("session_id") not in (None, session_id):
            raise ExplorationError("candidate_identity_mismatch", "Prior candidate belongs to another exploration session.", field_path=f"/prior_candidates/{index}/session_id")
        digest = candidate["candidate_digest"]
        if digest in seen:
            raise ExplorationError("duplicate_candidate", "Prior candidate history contains a duplicate.", field_path=f"/prior_candidates/{index}")
        seen.append(digest)
        prior_run_id = candidate.get("run_id")
        prior_key = candidate.get("run_idempotency_key")
        if prior_run_id is not None or prior_key is not None:
            if not isinstance(prior_run_id, str) or not prior_run_id.strip() or not isinstance(prior_key, str) or not prior_key.strip():
                raise ExplorationError("invalid_candidate_history", "A prior candidate run binding is incomplete.", field_path=f"/prior_candidates/{index}")
            if any(item.get("run_id") == prior_run_id for item in run_history):
                raise ExplorationError("duplicate_run_identity", "Prior candidate history reuses a run_id.", field_path=f"/prior_candidates/{index}/run_id")
            if any(item.get("idempotency_key") == prior_key for item in run_history):
                raise ExplorationError("duplicate_idempotency_key", "Prior candidate history reuses an idempotency key.", field_path=f"/prior_candidates/{index}/run_idempotency_key")
            run_history.append({
                "run_id": prior_run_id,
                "idempotency_key": prior_key,
                "candidate_id": candidate.get("candidate_id"),
                "candidate_digest": digest,
                "status": "completed",
            })
    timestamp = started_at or datetime.now(timezone.utc).isoformat()
    state: dict[str, Any] = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["session"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": session_id,
        "task_type": "explore_experiment",
        "principal": principal,
        "workspace_id": workspace_id,
        "status": "waiting_authorization",
        "phase": "prepare_exploration",
        "context_binding": context_binding(normalized_context),
        "context_snapshot": _copy(normalized_context),
        "fixed_resources": _copy(normalized_context.get("fixed_resources", {})),
        "current_page": normalized_context.get("current_page"),
        "current_page_id": normalized_context.get("current_page"),
        "run_id": normalized_context.get("run_id"),
        "context_revision": normalized_context["context_revision"],
        "run_context_revision": normalized_context.get("run_context_revision"),
        "input_snapshot_digest": normalized_context["input_snapshot_digest"],
        "schema_set_revision": normalized_context["schema_set_revision"],
        "backend_identity": _copy(normalized_context["backend_identity"]),
        "parameter_catalog_revision": normalized_context["parameter_catalog_revision"],
        "policy_revision": EXPLORATION_POLICY_REVISION,
        "allowed_pages": list(EXPLORATION_PAGE_IDS),
        "allowed_actions": list(EXPLORATION_ACTIONS),
        "context_lock": {
            "page_ids": list(EXPLORATION_PAGE_IDS),
            "context_revision": normalized_context["context_revision"],
            "input_snapshot_digest": normalized_context["input_snapshot_digest"],
            "locked": True,
        },
        "objective": normalized_objective,
        "parameter_grants": grants,
        "base_config": _copy(dict(base_config)),
        "budget": normalized_budget,
        "authorization_id": authorization_id,
        "authorization_digest": None,
        "round_count": 0,
        "current_round": 0,
        "run_count": 0,
        "failure_count": 0,
        "no_improvement_count": 0,
        "model_calls": 0,
        "tool_calls": 0,
        "tool_calls_this_round": 0,
        "elapsed_time_ms": 0,
        "candidate_history": prior,
        "candidate_digests": seen,
        "run_history": run_history,
        "current_candidate": None,
        "current_run": None,
        "active_run_id": None,
        "current_evaluation": None,
        "best_candidate_id": None,
        "best_value": None,
        "best_completed_round": None,
        "stop_reason": None,
        "started_at": timestamp,
        "updated_at": timestamp,
        "events": [],
        "provenance": _copy(EXPLORATION_PROVENANCE),
        "local_dev": True,
        "automatic_submission": True,
        "created_at": timestamp,
    }
    _event(state, "created", "prepare_exploration", {"session_id": session_id})
    return state


def prepare_exploration(state: Mapping[str, Any]) -> dict[str, Any]:
    """Move a validated draft to the authorization checkpoint."""

    current = _transition(state, status="waiting_authorization", phase="snapshot_context")
    _event(current, "prepare", "prepare_exploration")
    return current


def snapshot_context(state: Mapping[str, Any], context: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Freeze the input identity while allowing the observed page to move."""

    current = _copy(dict(state))
    if current.get("status") in TERMINAL_STATES:
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot snapshot context.")
    # ``{}`` is an explicit observation and must fail validation; using
    # truthiness here would silently reuse the previous snapshot and let a
    # malformed page/context update pass the fence.
    observed = validate_context(current.get("context_snapshot") if context is None else context)
    if context is not None:
        # A caller may provide the first live observation, but it may not
        # replace the immutable input identity after authorization.
        if current.get("context_binding"):
            assert_context_current(current, observed)
    current["context_snapshot"] = _copy(observed)
    current["current_page"] = observed.get("current_page")
    current["current_page_id"] = observed.get("current_page")
    active_authorization = isinstance(current.get("authorization"), Mapping) and current["authorization"].get("status") == "active"
    if current.get("status") == "paused":
        # Observation is not a resume command. Keep an explicitly paused
        # session paused until the caller invokes resume_exploration().
        current["phase"] = "paused"
    elif isinstance(current.get("current_run"), Mapping):
        current["phase"] = "wait_run_terminal"
        current["status"] = "waiting_run" if active_authorization else "waiting_authorization"
    else:
        candidate = current.get("current_candidate")
        candidate_status = candidate.get("status") if isinstance(candidate, Mapping) else None
        current["phase"] = {"generated": "validate_candidate", "validated": "create_one_run"}.get(candidate_status, "generate_candidate")
        current["status"] = "exploring" if active_authorization else "waiting_authorization"
    _event(current, "context_snapshot", "snapshot_context", {"context_binding": current.get("context_binding")})
    return current


def bind_authorization(state: Mapping[str, Any], authorization: Mapping[str, Any]) -> dict[str, Any]:
    """Bind one immutable v2 authorization envelope to a session."""

    if not isinstance(authorization, Mapping):
        raise ExplorationError("authorization_invalid", "Authorization must be an object.", field_path="/authorization")
    current = _copy(dict(state))
    if current.get("status") in TERMINAL_STATES:
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot bind a new authorization.")
    existing_authorization = current.get("authorization")
    if existing_authorization is not None and not isinstance(existing_authorization, Mapping):
        raise ExplorationError("authorization_invalid", "Persisted authorization binding is malformed.", field_path="/authorization")
    for name in ("authorization_id", "session_id", "task_type", "principal", "workspace_id", "context_revision", "run_context_revision", "input_snapshot_digest", "schema_set_revision", "parameter_catalog_revision", "backend_identity"):
        if name not in authorization:
            raise ExplorationError("authorization_invalid", "Authorization binding is incomplete.", field_path=f"/authorization/{name}")
    if not isinstance(authorization.get("authorization_id"), str) or not authorization["authorization_id"].startswith("explore-authz-"):
        raise ExplorationError("authorization_invalid", "Exploration authorization_id must use the published prefix.", field_path="/authorization/authorization_id")
    if authorization.get("session_id") != current.get("session_id"):
        raise ExplorationError("session_mismatch", "Authorization belongs to another exploration session.", field_path="/authorization/session_id")
    if authorization.get("task_type") != "explore_experiment":
        raise ExplorationError("task_type_mismatch", "Authorization is not for automatic experiment exploration.", field_path="/authorization/task_type")
    if authorization.get("autonomy_level") != "bounded_autonomous":
        raise ExplorationError("invalid_autonomy_level", "Exploration authorization must be bounded autonomous.", field_path="/authorization/autonomy_level")
    for name in ("principal", "workspace_id"):
        if authorization.get(name) != current.get(name):
            raise ExplorationError("authorization_binding_mismatch", "Authorization identity does not match the session.", field_path=f"/authorization/{name}")
    context_binding_value = current.get("context_binding") or {}
    mapping = {
        "context_revision": "context_revision",
        "run_context_revision": "run_context_revision",
        "input_snapshot_digest": "input_snapshot_digest",
        "schema_set_revision": "schema_set_revision",
        "parameter_catalog_revision": "parameter_catalog_revision",
    }
    for auth_name, binding_name in mapping.items():
        if authorization.get(auth_name) != context_binding_value.get(binding_name):
            raise ExplorationError("authorization_binding_mismatch", "Authorization context does not match the frozen snapshot.", field_path=f"/authorization/{auth_name}")
    if _identity_digest(authorization.get("backend_identity")) != context_binding_value.get("backend_identity_digest"):
        raise ExplorationError("authorization_binding_mismatch", "Authorization backend identity does not match the frozen snapshot.", field_path="/authorization/backend_identity")
    if authorization.get("status") != "active":
        raise ExplorationError("authorization_inactive", "Authorization is not active.", field_path="/authorization/status")
    expires_at = authorization.get("expires_at")
    if not isinstance(expires_at, str) or not expires_at.strip():
        raise ExplorationError("authorization_invalid", "Authorization expiry is required.", field_path="/authorization/expires_at")
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ExplorationError("authorization_invalid", "Authorization expiry is invalid.", field_path="/authorization/expires_at") from error
    if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
        raise ExplorationError("authorization_expired", "Exploration authorization has expired.", field_path="/authorization/expires_at")
    allowed_pages = authorization.get("allowed_pages")
    if (
        not isinstance(allowed_pages, list)
        or not allowed_pages
        or len(set(allowed_pages)) != len(allowed_pages)
        or any(page not in EXPLORATION_PAGE_IDS for page in allowed_pages)
    ):
        raise ExplorationError(
            "invalid_page_allowlist",
            "Authorization pages must use the published exploration page identifiers.",
            field_path="/authorization/allowed_pages",
        )
    allowed_actions = authorization.get("allowed_actions")
    if (
        not isinstance(allowed_actions, list)
        or not allowed_actions
        or len(set(allowed_actions)) != len(allowed_actions)
        or any(action not in EXPLORATION_ACTIONS for action in allowed_actions)
    ):
        raise ExplorationError(
            "invalid_action_allowlist",
            "Authorization actions must use the published exploration actions.",
            field_path="/authorization/allowed_actions",
        )
    tool_allowlist = authorization.get("tool_allowlist")
    if (
        not isinstance(tool_allowlist, list)
        or not tool_allowlist
        or len(set(tool_allowlist)) != len(tool_allowlist)
        or any(not isinstance(tool, str) or not tool.strip() for tool in tool_allowlist)
    ):
        raise ExplorationError(
            "invalid_tool_allowlist",
            "Authorization tools must be a non-empty unique list of names.",
            field_path="/authorization/tool_allowlist",
        )
    current_page = current.get("current_page_id", current.get("current_page"))
    if current_page not in allowed_pages:
        raise ExplorationError(
            "authorization_binding_mismatch",
            "The current exploration page is not included in the authorization allowlist.",
            field_path="/authorization/allowed_pages",
        )
    # Validate the published successor envelope before accepting it as runtime
    # authority.  The fallback validator is intentionally closed-world and
    # checks the v2 identity/revision, while the state-machine checks below
    # bind the envelope to this session's immutable context.
    try:
        validate_document(
            "exploration_authorization",
            dict(authorization),
            expected_schema_set_revision=context_binding_value.get("schema_set_revision"),
            expected_backend_identity=current.get("backend_identity"),
        )
    except HarnessContractError as error:
        raise ExplorationError(
            error.code,
            str(error),
            field_path=error.field_path or "/authorization",
        ) from error
    if authorization.get("provenance") != EXPLORATION_PROVENANCE:
        raise ExplorationError(
            "provenance_mismatch",
            "Exploration authorization provenance is not the published local synthetic boundary.",
            field_path="/authorization/provenance",
        )
    protected = authorization.get("protected")
    protected_fields = {
        "context_revision",
        "run_context_revision",
        "input_snapshot_digest",
        "schema_set_revision",
        "backend_identity",
        "parameter_catalog_revision",
    }
    if not isinstance(protected, Mapping) or set(protected) != protected_fields:
        raise ExplorationError(
            "authorization_invalid",
            "Authorization protected context is incomplete or contains unknown fields.",
            field_path="/authorization/protected",
        )
    for name in (
        "context_revision",
        "run_context_revision",
        "input_snapshot_digest",
        "schema_set_revision",
        "parameter_catalog_revision",
    ):
        if protected.get(name) != context_binding_value.get(name):
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization protected context does not match the frozen snapshot.",
                field_path=f"/authorization/protected/{name}",
            )
    if _identity_digest(protected.get("backend_identity")) != context_binding_value.get("backend_identity_digest"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization protected backend identity does not match the frozen snapshot.",
            field_path="/authorization/protected/backend_identity",
        )
    budget = validate_budget(authorization.get("budget"))
    grants = validate_parameter_grants(authorization.get("parameter_grants"))
    objective = validate_objective(authorization.get("objective"))
    if objective != current.get("objective"):
        raise ExplorationError("authorization_binding_mismatch", "Authorization objective does not match the exploration plan.", field_path="/authorization/objective")
    if grants != current.get("parameter_grants"):
        raise ExplorationError("authorization_binding_mismatch", "Authorization grants do not match the exploration plan.", field_path="/authorization/parameter_grants")
    authorization_digest = _digest(
        authorization.get("authorization_digest"),
        "/authorization/authorization_digest",
    )
    unsigned_authorization = _copy(dict(authorization))
    unsigned_authorization.pop("authorization_digest", None)
    if authorization_digest != canonical_sha256(unsigned_authorization):
        raise ExplorationError(
            "authorization_digest_mismatch",
            "Authorization digest does not match the immutable v2 envelope.",
            field_path="/authorization/authorization_digest",
        )
    if isinstance(existing_authorization, Mapping):
        existing_id = existing_authorization.get("authorization_id")
        existing_digest = existing_authorization.get("authorization_digest")
        if authorization.get("authorization_id") == existing_id and authorization_digest == existing_digest:
            # A retried authorization request may replay the exact immutable
            # envelope. It must not restart a paused session or append a
            # second binding event; the caller can explicitly resume it.
            if budget != current.get("budget"):
                raise ExplorationError(
                    "authorization_binding_mismatch",
                    "Authorization replay does not match the bound exploration budget.",
                    field_path="/authorization/budget",
                )
            return current
        if current.get("status") != "paused":
            raise ExplorationError(
                "reauthorization_required",
                "A changed authorization requires an explicit paused exploration.",
                field_path="/authorization/authorization_id",
            )
        if isinstance(current.get("current_run"), Mapping):
            raise ExplorationError(
                "reauthorization_requires_idle",
                "Finish or recover the active run before changing authorization.",
                field_path="/current_run",
            )
        if authorization.get("authorization_id") == existing_id:
            raise ExplorationError(
                "authorization_binding_mismatch",
                "A changed authorization must use a new authorization_id.",
                field_path="/authorization/authorization_id",
            )
        # Explicit paused reauthorization may change the resource budget, but
        # it cannot retroactively make already-consumed work fit a smaller
        # budget. Increasing the budget is never implicit while active.
        consumed_limits = {
            "max_rounds": int(current.get("round_count", 0) or 0),
            "max_runs": int(current.get("run_count", 0) or 0),
            "max_failures": int(current.get("failure_count", 0) or 0),
            "max_no_improvement": int(current.get("no_improvement_count", 0) or 0),
            "max_execution_time_ms": int(current.get("elapsed_time_ms", 0) or 0),
            "max_model_calls": int(current.get("model_calls", 0) or 0),
            "max_tool_calls_per_round": int(current.get("tool_calls_this_round", 0) or 0),
        }
        for name, consumed in consumed_limits.items():
            if budget[name] < consumed:
                raise ExplorationError(
                    "authorization_binding_mismatch",
                    "Reauthorization budget is below already-consumed exploration usage.",
                    field_path=f"/authorization/budget/{name}",
                )
    else:
        planned_authorization_id = current.get("planned_authorization_id", current.get("authorization_id"))
        if planned_authorization_id is not None and authorization.get("authorization_id") != planned_authorization_id:
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization identity does not match the planned exploration grant.",
                field_path="/authorization/authorization_id",
            )
        # The first authorization must exactly match the plan shown to the
        # user. A larger or smaller budget is only meaningful through the
        # explicit paused reauthorization branch above.
        if budget != current.get("budget"):
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization budget does not match the frozen exploration budget.",
                field_path="/authorization/budget",
            )
    current["authorization_id"] = authorization.get("authorization_id")
    current["authorization_digest"] = authorization_digest
    current["budget"] = budget
    current["status"] = "exploring"
    current["phase"] = "snapshot_context"
    current["authorization"] = _copy(dict(authorization))
    if isinstance(existing_authorization, Mapping) and isinstance(current.get("current_candidate"), Mapping):
        current["current_candidate"] = {
            **_copy(dict(current["current_candidate"])),
            "authorization_id": current["authorization_id"],
        }
    _event(
        current,
        "authorized",
        "prepare_exploration",
        {"authorization_id": current["authorization_id"], "reauthorization": isinstance(existing_authorization, Mapping)},
    )
    return current


def assert_authorization_active(state: Mapping[str, Any], authorization: Mapping[str, Any] | None = None) -> None:
    # An explicitly supplied empty mapping is invalid input, not a request to
    # fall back to the persisted authorization.
    value = state.get("authorization") if authorization is None else authorization
    if not isinstance(value, Mapping) or value.get("status") != "active":
        raise ExplorationError("authorization_inactive", "Exploration authorization is not active.")
    if value.get("authorization_id") != state.get("authorization_id"):
        raise ExplorationError("authorization_binding_mismatch", "Authorization identity changed during exploration.")
    expected_digest = state.get("authorization_digest")
    actual_digest = value.get("authorization_digest")
    if expected_digest and actual_digest != expected_digest:
        raise ExplorationError("authorization_binding_mismatch", "Authorization digest changed during exploration.", field_path="/authorization/authorization_digest")
    try:
        validate_document(
            "exploration_authorization",
            dict(value),
            expected_schema_set_revision=state.get("schema_set_revision"),
            expected_backend_identity=state.get("backend_identity"),
        )
    except HarnessContractError as error:
        raise ExplorationError(
            error.code,
            str(error),
            field_path=error.field_path or "/authorization",
        ) from error
    for name in ("session_id", "task_type", "principal", "workspace_id", "autonomy_level"):
        expected = "explore_experiment" if name == "task_type" else ("bounded_autonomous" if name == "autonomy_level" else state.get(name))
        if value.get(name) != expected:
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization identity changed during exploration.",
                field_path=f"/authorization/{name}",
            )
    context_binding_value = state.get("context_binding") or {}
    for auth_name, binding_name in {
        "context_revision": "context_revision",
        "run_context_revision": "run_context_revision",
        "input_snapshot_digest": "input_snapshot_digest",
        "schema_set_revision": "schema_set_revision",
        "parameter_catalog_revision": "parameter_catalog_revision",
    }.items():
        if value.get(auth_name) != context_binding_value.get(binding_name):
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization context changed during exploration.",
                field_path=f"/authorization/{auth_name}",
            )
    if _identity_digest(value.get("backend_identity")) != context_binding_value.get("backend_identity_digest"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization backend identity changed during exploration.",
            field_path="/authorization/backend_identity",
        )
    candidate = state.get("current_candidate")
    if isinstance(candidate, Mapping) and candidate.get("authorization_id") != state.get("authorization_id"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Current candidate is bound to a different authorization.",
            field_path="/current_candidate/authorization_id",
        )
    allowed_pages = value.get("allowed_pages")
    if (
        not isinstance(allowed_pages, list)
        or not allowed_pages
        or len(set(allowed_pages)) != len(allowed_pages)
        or any(page not in EXPLORATION_PAGE_IDS for page in allowed_pages)
    ):
        raise ExplorationError("invalid_page_allowlist", "Authorization pages must use the published exploration page identifiers.", field_path="/authorization/allowed_pages")
    allowed_actions = value.get("allowed_actions")
    if (
        not isinstance(allowed_actions, list)
        or not allowed_actions
        or len(set(allowed_actions)) != len(allowed_actions)
        or any(action not in EXPLORATION_ACTIONS for action in allowed_actions)
    ):
        raise ExplorationError("invalid_action_allowlist", "Authorization actions must use the published exploration actions.", field_path="/authorization/allowed_actions")
    tool_allowlist = value.get("tool_allowlist")
    if (
        not isinstance(tool_allowlist, list)
        or not tool_allowlist
        or len(set(tool_allowlist)) != len(tool_allowlist)
        or any(not isinstance(tool, str) or not tool.strip() for tool in tool_allowlist)
    ):
        raise ExplorationError("invalid_tool_allowlist", "Authorization tools must be a non-empty unique list of names.", field_path="/authorization/tool_allowlist")
    if value.get("provenance") != EXPLORATION_PROVENANCE:
        raise ExplorationError("provenance_mismatch", "Exploration authorization provenance is not the published local synthetic boundary.", field_path="/authorization/provenance")
    unsigned_authorization = _copy(dict(value))
    unsigned_authorization.pop("authorization_digest", None)
    if actual_digest != canonical_sha256(unsigned_authorization):
        raise ExplorationError(
            "authorization_digest_mismatch",
            "Authorization digest does not match the immutable v2 envelope.",
            field_path="/authorization/authorization_digest",
        )
    protected = value.get("protected")
    protected_fields = {
        "context_revision",
        "run_context_revision",
        "input_snapshot_digest",
        "schema_set_revision",
        "backend_identity",
        "parameter_catalog_revision",
    }
    if not isinstance(protected, Mapping) or set(protected) != protected_fields:
        raise ExplorationError(
            "authorization_invalid",
            "Authorization protected context is incomplete or contains unknown fields.",
            field_path="/authorization/protected",
        )
    for name in (
        "context_revision",
        "run_context_revision",
        "input_snapshot_digest",
        "schema_set_revision",
        "parameter_catalog_revision",
    ):
        if protected.get(name) != context_binding_value.get(name):
            raise ExplorationError(
                "authorization_binding_mismatch",
                "Authorization protected context does not match the frozen snapshot.",
                field_path=f"/authorization/protected/{name}",
            )
    if _identity_digest(protected.get("backend_identity")) != context_binding_value.get("backend_identity_digest"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization protected backend identity does not match the frozen snapshot.",
            field_path="/authorization/protected/backend_identity",
        )
    if validate_budget(value.get("budget")) != state.get("budget"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization budget changed during exploration.",
            field_path="/authorization/budget",
        )
    if validate_parameter_grants(value.get("parameter_grants")) != state.get("parameter_grants"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization parameter grants changed during exploration.",
            field_path="/authorization/parameter_grants",
        )
    if validate_objective(value.get("objective")) != state.get("objective"):
        raise ExplorationError(
            "authorization_binding_mismatch",
            "Authorization objective changed during exploration.",
            field_path="/authorization/objective",
        )
    expires_at = value.get("expires_at")
    if not isinstance(expires_at, str) or not expires_at.strip():
        raise ExplorationError("authorization_invalid", "Authorization expiry is required.", field_path="/authorization/expires_at")
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ExplorationError("authorization_invalid", "Authorization expiry is invalid.", field_path="/authorization/expires_at") from error
    if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
        raise ExplorationError("authorization_expired", "Exploration authorization has expired.", field_path="/authorization/expires_at")


def _require_authorized(state: Mapping[str, Any]) -> None:
    """Gate every candidate/run side effect on the active v2 grant."""

    if not state.get("authorization_id"):
        raise ExplorationError("authorization_required", "Automatic exploration requires an explicit authorization.", field_path="/authorization_id")
    assert_authorization_active(state)
    observed = state.get("context_snapshot")
    if isinstance(observed, Mapping):
        assert_context_current(state, observed)
    authorization = state.get("authorization")
    current_page = state.get("current_page")
    current_page_id = state.get("current_page_id", current_page)
    allowed_pages = authorization.get("allowed_pages") if isinstance(authorization, Mapping) else None
    if isinstance(allowed_pages, (list, tuple, set)) and (
        current_page not in allowed_pages
        or current_page_id not in allowed_pages
        or current_page_id != current_page
    ):
        raise ExplorationError("context_expired", "The current page is outside the authorized exploration pages.", field_path="/current_page")


def _grant_for(grants: list[Mapping[str, Any]], pointer: str) -> Mapping[str, Any] | None:
    return next((grant for grant in grants if grant.get("pointer") == pointer), None)


def _published_deployment_candidate(state: Mapping[str, Any], candidate: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Resolve a deployment only from the frozen, published capability list."""

    if candidate is None:
        return None
    candidate_id = candidate.get("candidate_id")
    if not isinstance(candidate_id, str) or not candidate_id:
        raise ExplorationError("deployment_candidate_invalid", "A deployment candidate must have a published candidate_id.", field_path="/deployment_candidate/candidate_id")
    for item in state.get("deployment_candidates", []):
        if (
            isinstance(item, Mapping)
            and item.get("candidate_id") == candidate_id
            and item.get("published") is True
            and item.get("executable") is True
            and item.get("status", "published") == "published"
        ):
            fixed = state.get("fixed_resources")
            binding = item.get("resource_binding") if isinstance(item, Mapping) else None
            if isinstance(fixed, Mapping) and isinstance(binding, Mapping):
                aliases = {
                    "model": ("model", "model_id", "model_name"),
                    "engine": ("engine", "engine_id", "inference_engine"),
                    "gpu_type": ("gpu_type", "device_type", "accelerator"),
                    "gpu_count": ("gpu_count", "device_count", "cards"),
                }
                for names in aliases.values():
                    fixed_value = next((fixed[name] for name in names if name in fixed), None)
                    binding_value = next((binding[name] for name in names if name in binding), None)
                    if fixed_value is not None and binding_value is not None and fixed_value != binding_value:
                        raise ExplorationError(
                            "deployment_resource_mismatch",
                            "Deployment candidate does not match the fixed resource plan.",
                            field_path="/deployment_candidate/resource_binding",
                        )
            return _copy(dict(item))
    if state.get("deployment_candidates"):
        raise ExplorationError("deployment_candidate_unavailable", "Deployment candidate is not published and executable in the bound capability catalog.", field_path="/deployment_candidate/candidate_id")
    return _copy(dict(candidate))


def _value_allowed(value: Any, grant: Mapping[str, Any]) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        return False
    kind = grant.get("kind", "number")
    if kind in {"int", "integer"} and (not isinstance(value, int) or isinstance(value, bool)):
        return False
    if not grant["min"] <= value <= grant["max"]:
        return False
    step = float(grant["step"])
    offset = (float(value) - float(grant["min"])) / step
    return math.isclose(offset, round(offset), rel_tol=0.0, abs_tol=1e-9)


def generate_candidate(
    state: Mapping[str, Any],
    changes: Mapping[str, Any],
    *,
    origin: str = "model",
    reason: str | None = None,
    deployment_candidate: Mapping[str, Any] | None = None,
    run_strategy: Mapping[str, Any] | None = None,
    combination_key: str | None = None,
    model_proposal: Mapping[str, Any] | None = None,
    model_context_digest: str | None = None,
) -> dict[str, Any]:
    """Materialize exactly one candidate from pointer/value changes."""

    current = _copy(dict(state))
    if current.get("status") in TERMINAL_STATES:
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot generate a candidate.")
    _require_authorized(current)
    if current.get("phase") not in {"generate_candidate", "should_continue", "create_one_run"}:
        raise ExplorationError("invalid_phase", "Candidate generation is not valid at the current phase.", field_path="/phase")
    if not isinstance(changes, Mapping) or not changes:
        raise ExplorationError("candidate_empty", "A candidate must change at least one authorized parameter.", field_path="/changes")
    if origin not in {"model", "rule"}:
        raise ExplorationError("invalid_candidate_origin", "Candidate origin must be model or rule.", field_path="/origin")
    resolved_deployment = _published_deployment_candidate(current, deployment_candidate)
    config = _copy(current["base_config"])
    changed_paths: list[str] = []
    for pointer, value in changes.items():
        grant = _grant_for(current.get("parameter_grants", []), pointer)
        if grant is None:
            raise ExplorationError("parameter_not_authorized", "Candidate changed a parameter outside the authorization grant.", field_path=f"/changes/{pointer}")
        if not _value_allowed(value, grant):
            raise ExplorationError("parameter_out_of_range", "Candidate value is outside the authorization grant.", field_path=f"/changes/{pointer}")
        found, old_value = _get_pointer(config, pointer)
        if not found:
            raise ExplorationError("parameter_unavailable", "Parameter pointer is not present in the base configuration.", field_path=f"/changes/{pointer}")
        if old_value == value:
            continue
        config = _set_pointer(config, pointer, value)
        changed_paths.append(pointer)
    if not changed_paths and not isinstance(deployment_candidate, Mapping):
        raise ExplorationError("candidate_unchanged", "Candidate must differ from the base configuration.", field_path="/changes")
    digest = canonical_sha256({
        "session_id": current["session_id"],
        "config": config,
        "deployment_candidate_id": deployment_candidate.get("candidate_id") if isinstance(deployment_candidate, Mapping) else None,
        "run_strategy": _copy(dict(run_strategy)) if isinstance(run_strategy, Mapping) else None,
    })
    if digest in current.get("candidate_digests", []):
        raise ExplorationError("duplicate_candidate", "This candidate has already been executed.", field_path="/changes")
    sequence = len(current.get("candidate_history", [])) + 1
    parent = current.get("candidate_history", [])[-1] if current.get("candidate_history") else None
    candidate = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["candidate"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "candidate_id": f"explore-candidate-{digest.removeprefix('sha256:')[:16]}",
        "session_id": current["session_id"],
        "sequence": sequence,
        "candidate_digest": digest,
        "parent_candidate_id": parent.get("candidate_id") if isinstance(parent, Mapping) else None,
        "config": config,
        "changed_fields": sorted(changed_paths),
        "deployment_candidate": _copy(dict(resolved_deployment)) if isinstance(resolved_deployment, Mapping) else None,
        "deployment_candidate_id": resolved_deployment.get("candidate_id") if isinstance(resolved_deployment, Mapping) else None,
        "deployment_candidate_summary": _copy(dict(resolved_deployment)) if isinstance(resolved_deployment, Mapping) else None,
        "candidate_summary": _copy(dict(resolved_deployment)) if isinstance(resolved_deployment, Mapping) else None,
        "resource_binding": _copy(resolved_deployment.get("resource_binding")) if isinstance(resolved_deployment, Mapping) else None,
        "run_strategy": _copy(dict(run_strategy)) if isinstance(run_strategy, Mapping) else None,
        "run_strategy_digest": canonical_sha256(run_strategy) if isinstance(run_strategy, Mapping) else None,
        "combination_key": combination_key,
        "status": "generated",
        "origin": origin,
        "reason": reason,
        "authorization_id": _nonempty(current.get("authorization_id"), "/authorization_id"),
        "run_id": None,
        "run_idempotency_key": f"exploration:{current['session_id']}:{digest}",
        "candidate_idempotency_key": f"exploration:{current['session_id']}:candidate:{digest}",
        # The base key is retained so each workload scenario can receive its
        # own idempotent run without changing the candidate identity.
        "candidate_base_run_idempotency_key": f"exploration:{current['session_id']}:{digest}",
        "metric_value": None,
        "metric_verified": False,
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }
    if isinstance(model_proposal, Mapping):
        candidate["model_proposal"] = _copy(dict(model_proposal))
        candidate["model_context_digest"] = model_context_digest
    current["current_candidate"] = candidate
    current["phase"] = "validate_candidate"
    _event(current, "candidate_generated", "generate_candidate", {"candidate_digest": digest, "sequence": sequence})
    return current


def prepare_scenario_run(state: Mapping[str, Any]) -> dict[str, Any]:
    """Bind the next workload scenario to the one run about to be created.

    Scenario execution remains serial: this function only changes the
    idempotency key and records which published scenario is active.  It does
    not call an executor or reserve a slot.
    """
    current = _copy(dict(state))
    scenarios = current.get("workload_scenarios")
    if not isinstance(scenarios, list) or not scenarios:
        current["active_scenario"] = {"scenario_id": "default"}
        return current
    index = int(current.get("scenario_index", 0) or 0)
    if index < 0 or index >= len(scenarios):
        raise ExplorationError("scenario_unavailable", "The workload scenario index is outside the confirmed plan.", field_path="/scenario_index")
    scenario = scenarios[index]
    if not isinstance(scenario, Mapping) or not isinstance(scenario.get("scenario_id"), str):
        raise ExplorationError("scenario_invalid", "A workload scenario is missing its published scenario_id.", field_path=f"/workload_scenarios/{index}")
    candidate = current.get("current_candidate")
    if not isinstance(candidate, Mapping):
        raise ExplorationError("candidate_missing", "A candidate is required before selecting a workload scenario.")
    base_key = candidate.get("candidate_base_run_idempotency_key") or candidate.get("candidate_idempotency_key") or candidate.get("run_idempotency_key")
    if not isinstance(base_key, str) or not base_key:
        raise ExplorationError("idempotency_key_missing", "The candidate has no stable idempotency key.")
    scenario_copy = _copy(dict(scenario))
    scenario_digest = canonical_sha256(scenario_copy)
    current["active_scenario"] = scenario_copy
    current["current_candidate"] = {
        **_copy(dict(candidate)),
        "run_idempotency_key": f"{base_key}:run:scenario:{scenario_digest}",
        "scenario_id": scenario["scenario_id"],
        "scenario_summary": scenario_copy,
    }
    return current


def complete_scenario_metric(state: Mapping[str, Any], metric: Mapping[str, Any]) -> dict[str, Any]:
    """Record one verified scenario metric and advance or aggregate it."""
    current = _copy(dict(state))
    evaluated = read_verified_metric(current, metric)
    current = evaluated
    scenario = current.get("active_scenario") if isinstance(current.get("active_scenario"), Mapping) else {"scenario_id": "default"}
    metrics = metric.get("metrics") if isinstance(metric, Mapping) else None
    if not isinstance(metrics, Mapping):
        # Keep the evidence-bound value usable by the aggregator without
        # inventing any other metric fields.
        metrics = {}
        cursor = metrics
        tokens = str(metric.get("metric_path", "")).lstrip("/").split("/")
        for token in tokens[:-1]:
            cursor[token.replace("~1", "/").replace("~0", "~")] = {}
            cursor = cursor[token.replace("~1", "/").replace("~0", "~")]
        if tokens:
            cursor[tokens[-1].replace("~1", "/").replace("~0", "~")] = metric.get("value")
    row = {
        "scenario_id": scenario.get("scenario_id"),
        "status": "verified",
        "metrics": metrics,
        "run_id": metric.get("run_id"),
        "metric_path": metric.get("metric_path"),
        "evidence": _copy(metric.get("evidence", [])),
    }
    results = [*current.get("scenario_results", []), row]
    scenarios = current.get("workload_scenarios")
    if isinstance(scenarios, list) and len(scenarios) > 1 and len(results) < len(scenarios):
        candidate = current.get("current_candidate")
        current["scenario_results"] = results
        current["scenario_index"] = len(results)
        current["current_run"] = None
        current["active_run_id"] = None
        current["current_evaluation"] = None
        if isinstance(candidate, Mapping):
            current["current_candidate"] = {**_copy(dict(candidate)), "status": "validated", "run_id": None}
        current["status"] = "exploring"
        current["phase"] = "create_one_run"
        _event(current, "scenario_completed", "read_verified_metric", {"scenario_id": scenario.get("scenario_id"), "completed": len(results), "total": len(scenarios)})
        return current
    current["scenario_results"] = results
    if len(results) >= 1:
        # The planning evaluator is the single source of truth for scenario
        # aggregation and hard constraints.  It deliberately returns an
        # ineligible result when a required metric or evidence is absent.
        from .exploration_planning import evaluate_multi_metric
        objective = current.get("objective") if isinstance(current.get("objective"), Mapping) else {}
        primary = objective.get("primary_objective") if isinstance(objective.get("primary_objective"), Mapping) else objective
        planning_objective = {
            "primary_objective": {
                "metric_path": primary.get("metric_path") if isinstance(primary, Mapping) else None,
                "direction": primary.get("direction") if isinstance(primary, Mapping) else "minimize",
            },
            "constraints": objective.get("constraints", []),
            "aggregation": objective.get("aggregation", "all_scenarios"),
        }
        multi = evaluate_multi_metric(candidate_id=str((current.get("current_candidate") or {}).get("candidate_id")), objective=planning_objective, scenario_results=results, schema_set_revision=current.get("schema_set_revision", "sha256:" + "0" * 64))
        prior_evaluation = evaluated.get("current_evaluation") if isinstance(evaluated.get("current_evaluation"), Mapping) else {}
        multi_value = multi.get("objective_value")
        current["current_evaluation"] = {
            **_copy(dict(prior_evaluation)),
            "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["evaluation"],
            "contract_revision": EXPLORATION_CONTRACT_REVISION,
            "session_id": current.get("session_id"),
            "candidate_id": (current.get("current_candidate") or {}).get("candidate_id"),
            "run_id": results[-1].get("run_id"),
            "objective": {
                "metric_path": planning_objective["primary_objective"]["metric_path"],
                "direction": planning_objective["primary_objective"]["direction"],
                "value": multi_value,
                "status": "verified" if multi_value is not None else "unavailable",
                "eligible": bool(multi.get("eligible")),
            },
            "scenario_evaluations": _copy(multi.get("scenario_evaluations", [])),
            "constraints": _copy(multi.get("constraints", [])),
            "evaluation": _copy(multi),
            "evidence": [evidence for item in results for evidence in (item.get("evidence") or []) if isinstance(evidence, Mapping)],
            "provenance": _copy(EXPLORATION_PROVENANCE),
        }
    if len(results) > 1:
        # Keep the legacy fields populated for callers that display a scalar
        # scenario aggregate directly from the reducer.
        objective = current.get("objective") if isinstance(current.get("objective"), Mapping) else {}
        objective = current.get("objective") if isinstance(current.get("objective"), Mapping) else {}
        primary = objective.get("primary_objective") if isinstance(objective.get("primary_objective"), Mapping) else objective
        path = primary.get("metric_path") if isinstance(primary, Mapping) else None
        direction = primary.get("direction") if isinstance(primary, Mapping) else "minimize"
        values: list[float] = []
        constraints: list[dict[str, Any]] = []
        def pointer_value(document: Any, pointer: str) -> Any:
            current_value = document
            for token in str(pointer).lstrip("/").split("/"):
                token = token.replace("~1", "/").replace("~0", "~")
                if not isinstance(current_value, Mapping) or token not in current_value: return None
                current_value = current_value[token]
            return current_value
        for result in results:
            value = pointer_value(result.get("metrics"), str(path))
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)): values.append(float(value))
            for constraint in objective.get("constraints", []) if isinstance(objective.get("constraints"), list) else []:
                actual = pointer_value(result.get("metrics"), str(constraint.get("metric_path")))
                threshold = constraint.get("threshold")
                operator = constraint.get("operator")
                passed = isinstance(actual, (int, float)) and not isinstance(actual, bool) and isinstance(threshold, (int, float)) and {"<": actual < threshold, "<=": actual <= threshold, "=": math.isclose(float(actual), float(threshold)), ">=": actual >= threshold, ">": actual > threshold}.get(operator, False)
                constraints.append({"scenario_id": result.get("scenario_id"), "metric_path": constraint.get("metric_path"), "operator": operator, "threshold": threshold, "actual": actual, "passed": passed})
        if values:
            objective_value = sum(values) / len(values)
            if isinstance(current.get("current_evaluation"), Mapping):
                current["current_evaluation"] = {**_copy(dict(current["current_evaluation"])), "objective": {**_copy(dict(current["current_evaluation"].get("objective", {}))), "value": objective_value, "direction": direction, "aggregation": objective.get("aggregation", "all_scenarios"), "eligible": len(values) == len(results) and all(item["passed"] for item in constraints)}, "scenario_evaluations": _copy(results), "constraints": constraints}
    return current


def validate_candidate(
    state: Mapping[str, Any],
    *,
    validator: Callable[[Mapping[str, Any]], Any] | None = None,
) -> dict[str, Any]:
    """Run deterministic grant checks and an optional existing validator."""

    current = _copy(dict(state))
    _require_authorized(current)
    candidate = current.get("current_candidate")
    if not isinstance(candidate, Mapping):
        raise ExplorationError("candidate_missing", "No generated candidate is available.", field_path="/current_candidate")
    # Rebuild from the candidate diff so a persisted candidate cannot smuggle
    # an ungranted field into the next phase.
    changes = {pointer: _get_pointer(candidate.get("config"), pointer)[1] for pointer in candidate.get("changed_fields", [])}
    rebuilt = generate_candidate(
        {
            **current,
            # Re-materialization is an internal integrity check, not a new
            # workflow step.  Use the generator's input phase on the copied
            # state; the generated event is intentionally discarded below.
            "phase": "generate_candidate",
            "candidate_digests": [digest for digest in current.get("candidate_digests", []) if digest != candidate.get("candidate_digest")],
        },
        changes,
        origin="model",
        reason=None,
        deployment_candidate=candidate.get("deployment_candidate") if isinstance(candidate.get("deployment_candidate"), Mapping) else None,
        run_strategy=candidate.get("run_strategy") if isinstance(candidate.get("run_strategy"), Mapping) else None,
        combination_key=candidate.get("combination_key"),
    )
    rebuilt_candidate = rebuilt["current_candidate"]
    if rebuilt_candidate.get("candidate_digest") != candidate.get("candidate_digest"):
        raise ExplorationError("candidate_digest_mismatch", "Persisted candidate digest does not match its configuration.")
    if validator is not None:
        try:
            result = validator(rebuilt_candidate["config"])
        except ExplorationError:
            raise
        except Exception as error:  # deterministic validator failures are input failures
            raise ExplorationError("candidate_invalid", "The experiment validator rejected the candidate.") from error
        if result is False or (isinstance(result, tuple) and result and result[0] is False):
            detail = result[1] if isinstance(result, tuple) and len(result) > 1 else "The experiment validator rejected the candidate."
            raise ExplorationError("candidate_invalid", str(detail), field_path="/current_candidate/config")
    current["current_candidate"] = {**_copy(dict(candidate)), "status": "validated", "changed_fields": _copy(candidate.get("changed_fields", []))}
    current["phase"] = "create_one_run"
    _event(current, "candidate_validated", "validate_candidate", {"candidate_digest": candidate.get("candidate_digest")})
    return current


def create_one_run(state: Mapping[str, Any], run: Mapping[str, Any]) -> dict[str, Any]:
    """Bind one formal run identity; no second active run is permitted."""

    current = _copy(dict(state))
    if current.get("status") in TERMINAL_STATES:
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot create a run.")
    _require_authorized(current)
    if current.get("phase") != "create_one_run":
        raise ExplorationError("invalid_phase", "A run can only be created after candidate validation.", field_path="/phase")
    if current.get("current_run") is not None:
        raise ExplorationError("concurrency_violation", "An exploration already has an active run.")
    candidate = current.get("current_candidate")
    if not isinstance(candidate, Mapping) or candidate.get("status") != "validated":
        raise ExplorationError("candidate_not_validated", "Only a validated candidate can create a run.")
    if not isinstance(run, Mapping):
        raise ExplorationError("run_identity_missing", "The formal run identity is required.", field_path="/run")
    run_id = _nonempty(run.get("run_id"), "/run/run_id")
    idempotency_key = _nonempty(run.get("idempotency_key"), "/run/idempotency_key")
    expected_idempotency_key = candidate.get("run_idempotency_key")
    if idempotency_key != expected_idempotency_key:
        raise ExplorationError(
            "idempotency_key_mismatch",
            "The formal run must use the candidate's deterministic idempotency key.",
            field_path="/run/idempotency_key",
        )
    run_history = current.get("run_history")
    if run_history is None:
        run_history = []
        # Checkpoints created before the run-history ledger existed can still
        # be resumed safely: reconstruct completed bindings from the immutable
        # candidate history before accepting another formal run.
        for prior_candidate in current.get("candidate_history", []):
            if not isinstance(prior_candidate, Mapping):
                continue
            prior_run_id = prior_candidate.get("run_id")
            prior_key = prior_candidate.get("run_idempotency_key")
            if prior_run_id is not None or prior_key is not None:
                if not isinstance(prior_run_id, str) or not prior_run_id.strip() or not isinstance(prior_key, str) or not prior_key.strip():
                    raise ExplorationError("run_history_invalid", "Persisted candidate run binding is malformed.", field_path="/candidate_history")
                run_history.append(
                    {
                        "run_id": prior_run_id,
                        "idempotency_key": prior_key,
                        "candidate_id": prior_candidate.get("candidate_id"),
                        "candidate_digest": prior_candidate.get("candidate_digest"),
                        "status": "completed",
                    }
                )
    elif not isinstance(run_history, list):
        raise ExplorationError("run_history_invalid", "Persisted run history is malformed.", field_path="/run_history")
    seen_run_ids: set[str] = set()
    seen_idempotency_keys: set[str] = set()
    for prior in run_history:
        if not isinstance(prior, Mapping):
            raise ExplorationError("run_history_invalid", "Persisted run history is malformed.", field_path="/run_history")
        if (
            not isinstance(prior.get("run_id"), str)
            or not prior.get("run_id", "").strip()
            or not isinstance(prior.get("idempotency_key"), str)
            or not prior.get("idempotency_key", "").strip()
        ):
            raise ExplorationError("run_history_invalid", "Persisted run history is malformed.", field_path="/run_history")
        prior_run_id = prior["run_id"]
        prior_key = prior["idempotency_key"]
        if prior_run_id in seen_run_ids:
            raise ExplorationError("duplicate_run_identity", "Persisted run history reuses a run_id.", field_path="/run_history")
        if prior_key in seen_idempotency_keys:
            raise ExplorationError("duplicate_idempotency_key", "Persisted run history reuses an idempotency key.", field_path="/run_history")
        seen_run_ids.add(prior_run_id)
        seen_idempotency_keys.add(prior_key)
        if prior.get("run_id") == run_id:
            raise ExplorationError("duplicate_run_identity", "A run_id may only be used once in an exploration session.", field_path="/run/run_id")
        if prior.get("idempotency_key") == idempotency_key:
            raise ExplorationError("duplicate_idempotency_key", "An idempotency key may only be used once in an exploration session.", field_path="/run/idempotency_key")
    if current.get("run_count", 0) >= current["budget"]["max_runs"]:
        return _stop(current, "budget_exhausted", "max_runs")
    current["run_count"] += 1
    current["current_run"] = {
        "run_id": run_id,
        "idempotency_key": idempotency_key,
        "candidate_id": candidate["candidate_id"],
        "candidate_digest": candidate["candidate_digest"],
        "candidate_idempotency_key": candidate.get("candidate_idempotency_key"),
        "deployment_candidate_id": candidate.get("deployment_candidate_id"),
        "scenario_id": candidate.get("scenario_id"),
        "scenario_summary": _copy(candidate.get("scenario_summary")),
        "run_strategy_digest": candidate.get("run_strategy_digest"),
        "status": "created",
    }
    current["run_history"] = [
        *run_history,
        {
            "run_id": run_id,
            "idempotency_key": idempotency_key,
            "candidate_id": candidate["candidate_id"],
            "candidate_digest": candidate["candidate_digest"],
            "candidate_idempotency_key": candidate.get("candidate_idempotency_key"),
            "deployment_candidate_id": candidate.get("deployment_candidate_id"),
            "scenario_id": candidate.get("scenario_id"),
            "scenario_summary": _copy(candidate.get("scenario_summary")),
            "run_strategy_digest": candidate.get("run_strategy_digest"),
            "status": "created",
        },
    ]
    current["current_candidate"] = {**_copy(dict(candidate)), "status": "running"}
    current["current_candidate"]["run_id"] = run_id
    current["current_candidate"]["run_idempotency_key"] = idempotency_key
    current["active_run_id"] = run_id
    current["status"] = "waiting_run"
    current["phase"] = "wait_run_terminal"
    _event(current, "run_created", "create_one_run", {"run_id": run_id, "candidate_id": candidate["candidate_id"]})
    return current


def wait_run_terminal(state: Mapping[str, Any], outcome: Mapping[str, Any]) -> dict[str, Any]:
    """Consume one terminal run observation, preserving unknown-result recovery."""

    current = _copy(dict(state))
    _require_authorized(current)
    if current.get("phase") != "wait_run_terminal" or not isinstance(current.get("current_run"), Mapping):
        raise ExplorationError("invalid_phase", "No run is waiting for a terminal observation.", field_path="/phase")
    run_status = outcome.get("status") if isinstance(outcome, Mapping) else None
    if run_status not in {"completed", "failed", "cancelled", "unknown"}:
        raise ExplorationError("run_not_terminal", "The run observation is not terminal.", field_path="/outcome/status")
    run = {**_copy(dict(current["current_run"])), "status": run_status}
    current["current_run"] = run
    current["active_run_id"] = run.get("run_id")
    current["run_history"] = [
        {**_copy(dict(item)), "status": run_status}
        if isinstance(item, Mapping) and item.get("run_id") == run.get("run_id")
        else _copy(item)
        for item in current.get("run_history", [])
    ]
    if run_status == "unknown":
        if isinstance(current.get("current_candidate"), Mapping):
            current["current_candidate"] = {**_copy(dict(current["current_candidate"])), "status": "recovery_required"}
        return _stop(current, "recovery_required", "unknown_run_outcome", unknown_outcome=True)
    if run_status == "cancelled":
        if isinstance(current.get("current_candidate"), Mapping):
            current["current_candidate"] = {**_copy(dict(current["current_candidate"])), "status": "failed"}
        return _stop(current, "cancelled", "run_cancelled")
    if run_status == "failed":
        current["failure_count"] += 1
        retryable = bool(outcome.get("retryable"))
        if retryable and current["failure_count"] < current["budget"]["max_failures"]:
            candidate = current.get("current_candidate")
            if isinstance(candidate, Mapping):
                retry_count = int(candidate.get("retry_count", 0) or 0) + 1
                retry_key = f"exploration:{current['session_id']}:{candidate['candidate_digest']}:attempt-{retry_count}"
                current["current_candidate"] = {
                    **_copy(dict(candidate)),
                    "status": "validated",
                    "run_id": None,
                    "run_idempotency_key": retry_key,
                    "retry_count": retry_count,
                }
            current["current_run"] = None
            current["active_run_id"] = None
            current["status"] = "exploring"
            current["phase"] = "create_one_run"
            _event(current, "run_retry", "wait_run_terminal", {"failure_count": current["failure_count"]})
            return current
        if isinstance(current.get("current_candidate"), Mapping):
            current["current_candidate"] = {**_copy(dict(current["current_candidate"])), "status": "failed"}
        return _stop(current, "run_failed", "failure_limit" if current["failure_count"] >= current["budget"]["max_failures"] else "run_failed")
    current["status"] = "comparing"
    current["phase"] = "read_verified_metric"
    _event(current, "run_completed", "wait_run_terminal", {"run_id": run["run_id"]})
    return current


def read_verified_metric(state: Mapping[str, Any], metric: Mapping[str, Any]) -> dict[str, Any]:
    """Accept exactly one verified, identity-bound objective metric."""

    current = _copy(dict(state))
    _require_authorized(current)
    if current.get("phase") != "read_verified_metric":
        raise ExplorationError("invalid_phase", "A verified metric can only be read after a completed run.", field_path="/phase")
    if not isinstance(metric, Mapping):
        raise ExplorationError("objective_unavailable", "The metric response is missing.", field_path="/metric")
    objective = current["objective"]
    if metric.get("status") != "verified":
        raise ExplorationError("metric_not_verified", "Only verified metrics may guide exploration.", field_path="/metric/status")
    if metric.get("metric_path") != objective["metric_path"]:
        raise ExplorationError("metric_mismatch", "Metric path does not match the authorized objective.", field_path="/metric/metric_path")
    value = metric.get("value")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise ExplorationError("objective_unavailable", "The verified objective is not a finite number.", field_path="/metric/value")
    run = current.get("current_run")
    if not isinstance(run, Mapping) or metric.get("run_id") != run.get("run_id"):
        raise ExplorationError("metric_binding_mismatch", "Metric evidence belongs to another run.", field_path="/metric/run_id")
    evidence = metric.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        raise ExplorationError("metric_evidence_missing", "A verified metric requires evidence identity.", field_path="/metric/evidence")
    for index, item in enumerate(evidence):
        if (
            not isinstance(item, Mapping)
            or set(item) != {"run_id", "manifest_digest", "json_pointer", "tool_output_digest"}
            or any(not isinstance(item.get(key), str) or not item.get(key) for key in ("run_id", "manifest_digest", "json_pointer", "tool_output_digest"))
        ):
            raise ExplorationError("metric_evidence_invalid", "Metric evidence identity is incomplete.", field_path=f"/metric/evidence/{index}")
        _digest(item["manifest_digest"], f"/metric/evidence/{index}/manifest_digest")
        _digest(item["tool_output_digest"], f"/metric/evidence/{index}/tool_output_digest")
        _pointer_tokens(item["json_pointer"], f"/metric/evidence/{index}/json_pointer")
        if item.get("run_id") != run.get("run_id") or item.get("json_pointer") != objective["metric_path"]:
            raise ExplorationError("metric_binding_mismatch", "Metric evidence is not bound to the objective run/pointer.", field_path=f"/metric/evidence/{index}")
    candidate = current.get("current_candidate")
    if not isinstance(candidate, Mapping):
        raise ExplorationError("candidate_missing", "No candidate is bound to the completed run.")
    evaluation = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["evaluation"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": current["session_id"],
        "run_id": run.get("run_id"),
        "candidate_id": candidate["candidate_id"],
        "objective": {
            "metric_path": objective["metric_path"],
            "direction": objective["direction"],
            "value": value,
            "status": "verified",
        },
        "evidence": _copy(list(evidence)),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }
    current["current_evaluation"] = evaluation
    current["phase"] = "update_best"
    _event(current, "metric_verified", "read_verified_metric", {"candidate_id": candidate["candidate_id"], "value": value})
    return current


def update_best(state: Mapping[str, Any]) -> dict[str, Any]:
    """Compare the verified metric deterministically and retain the earliest tie."""

    current = _copy(dict(state))
    _require_authorized(current)
    evaluation = current.get("current_evaluation")
    candidate = current.get("current_candidate")
    if not isinstance(evaluation, Mapping) or not isinstance(candidate, Mapping):
        raise ExplorationError("evaluation_missing", "A verified evaluation is required before comparison.")
    objective_evaluation = evaluation.get("objective")
    if not isinstance(objective_evaluation, Mapping):
        raise ExplorationError("evaluation_invalid", "Evaluation objective is missing.")
    value = objective_evaluation.get("value")
    direction = current["objective"]["direction"]
    minimum = float(current["objective"].get("minimum_improvement", 0.0))
    eligible = objective_evaluation.get("eligible", True) is True and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))
    previous = current.get("best_value")
    if not eligible:
        # Hard-constraint violations are recorded for auditability but can
        # never become the best candidate, even when their primary metric is
        # numerically attractive.
        improved = False
    elif previous is None:
        improved = True
    elif minimum == 0:
        # With no threshold, equality is a tie and the earlier completion
        # remains best.
        improved = value < float(previous) if direction == "minimize" else value > float(previous)
    else:
        # The configured threshold is inclusive: a delta exactly equal to the
        # minimum requested improvement counts as an improvement.
        improved = value <= float(previous) - minimum if direction == "minimize" else value >= float(previous) + minimum
    if improved:
        current["best_value"] = value
        current["best_candidate_id"] = candidate["candidate_id"]
        current["best_completed_round"] = current.get("round_count", 0)
        current["no_improvement_count"] = 0
        # Keep only the current candidate marked as best.  Earlier best
        # candidates remain part of the immutable ledger as evaluated rows.
        current["candidate_history"] = [
            {**_copy(dict(item)), "status": "evaluated"}
            if isinstance(item, Mapping) and item.get("status") == "best"
            else _copy(item)
            for item in current.get("candidate_history", [])
        ]
    else:
        # Equal values and below-threshold deltas intentionally retain the
        # earlier candidate; this also makes replay independent of dict order.
        current["no_improvement_count"] = int(current.get("no_improvement_count", 0)) + 1
    current["current_candidate"] = {
        **_copy(dict(candidate)),
        "status": "best" if improved else "evaluated",
        "metric_value": value,
        "metric_verified": eligible,
        "evaluation": _copy(dict(evaluation)),
        "is_best": improved,
        **({"eligible": eligible} if "eligible" in objective_evaluation else {}),
    }
    current["candidate_history"] = [*current.get("candidate_history", []), _copy(current["current_candidate"])]
    current["candidate_digests"] = [*current.get("candidate_digests", []), candidate["candidate_digest"]]
    current["round_count"] = int(current.get("round_count", 0)) + 1
    current["current_round"] = current["round_count"]
    current["current_run"] = None
    current["active_run_id"] = None
    current["current_evaluation"] = None
    run_id = None
    evidence = evaluation.get("evidence")
    if isinstance(evidence, list) and evidence and isinstance(evidence[0], Mapping):
        run_id = evidence[0].get("run_id")
    current.setdefault("iterations", []).append(
        {
            "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["iteration"],
            "contract_revision": EXPLORATION_CONTRACT_REVISION,
            "session_id": current["session_id"],
            "iteration_id": f"explore-iteration-{current['session_id']}-{current['round_count']}",
            "sequence": current["round_count"],
            "candidate_id": candidate["candidate_id"],
            "state": "completed",
            "run_id": run_id,
            "metric_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "provenance": _copy(EXPLORATION_PROVENANCE),
        }
    )
    current["status"] = "comparing"
    current["phase"] = "should_continue"
    _event(current, "best_updated" if improved else "no_improvement", "update_best", {"candidate_id": candidate["candidate_id"], "value": value, "improved": improved})
    return current


def _stop(state: Mapping[str, Any], reason: str, detail: str, *, unknown_outcome: bool = False) -> dict[str, Any]:
    current = _copy(dict(state))
    state_name = "cancelled" if reason in {"stopped", "cancelled", "run_cancelled"} else (reason if reason in TERMINAL_STATES else "completed")
    if current.get("status") in TERMINAL_STATES and current.get("status") != state_name:
        raise ExplorationError("terminal_mutation", "A terminal exploration cannot change state.")
    canonical_reason = {
        "budget_exhausted": {
            "max_rounds": "max_rounds",
            "max_runs": "max_runs",
            "max_failures": "max_failures",
            "max_execution_time_ms": "max_execution_time",
            "max_model_calls": "max_model_calls",
            "max_tool_calls_per_round": "max_tool_calls_per_round",
        }.get(detail, "max_rounds"),
        "no_improvement": "max_no_improvement",
        "run_failed": "max_failures" if detail == "failure_limit" else "run_failed",
        "stopped": "manual_stop",
    }.get(reason, reason)
    if reason == "cancelled":
        # A run cancellation is distinct from the user pressing Stop; both
        # leave the session cancelled but the report must retain the cause.
        canonical_reason = "run_cancelled" if detail == "run_cancelled" else "manual_stop"
    current["status"] = state_name
    current["phase"] = "finish_report"
    current["stop_reason"] = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["stop_reason"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "reason": canonical_reason,
        "detail": detail,
        "unknown_outcome": unknown_outcome,
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }
    if canonical_reason in {"max_rounds", "max_runs", "max_no_improvement", "max_failures", "max_execution_time", "max_model_calls", "max_tool_calls_per_round"} and isinstance(current.get("authorization"), Mapping):
        current["authorization"] = {**_copy(dict(current["authorization"])), "status": "exhausted"}
    _event(current, "stopped", "should_continue", {"reason": reason, "detail": detail})
    return current


def should_continue(state: Mapping[str, Any], *, elapsed_time_ms: int | None = None) -> dict[str, Any]:
    """Apply all deterministic stop policies after an evaluated round."""

    current = _copy(dict(state))
    _require_authorized(current)
    if current.get("phase") != "should_continue":
        raise ExplorationError("invalid_phase", "Continuation can only be decided after comparison.", field_path="/phase")
    if elapsed_time_ms is not None:
        if isinstance(elapsed_time_ms, bool) or not isinstance(elapsed_time_ms, int) or elapsed_time_ms < 0:
            raise ExplorationError("invalid_elapsed_time", "elapsed_time_ms must be a non-negative integer.", field_path="/elapsed_time_ms")
        current["elapsed_time_ms"] = elapsed_time_ms
    budget = current["budget"]
    if current.get("round_count", 0) >= budget["max_rounds"]:
        return _stop(current, "budget_exhausted", "max_rounds")
    if current.get("run_count", 0) >= budget["max_runs"]:
        return _stop(current, "budget_exhausted", "max_runs")
    if current.get("failure_count", 0) >= budget["max_failures"]:
        return _stop(current, "budget_exhausted", "max_failures")
    plateau_limit = min(
        budget["max_no_improvement"],
        int(current.get("objective", {}).get("plateau_rounds", budget["max_no_improvement"])),
    )
    if current.get("no_improvement_count", 0) >= plateau_limit:
        return _stop(current, "no_improvement", "max_no_improvement")
    if current.get("elapsed_time_ms", 0) >= budget["max_execution_time_ms"]:
        return _stop(current, "budget_exhausted", "max_execution_time_ms")
    current["status"] = "exploring"
    current["phase"] = "generate_candidate"
    # Tool-call budget is scoped to one exploration round.  Retries in the
    # same round retain their usage; only a completed comparison that is
    # allowed to continue opens a fresh per-round allowance.
    current["tool_calls_this_round"] = 0
    _event(current, "continue", "should_continue", {"round_count": current.get("round_count", 0)})
    return current


def consume_model_call(state: Mapping[str, Any], *, count: int = 1) -> dict[str, Any]:
    """Consume model-call budget before asking for a candidate explanation."""

    current = _copy(dict(state))
    _require_authorized(current)
    if current.get("status") not in {"exploring", "waiting_run", "comparing"}:
        raise ExplorationError("invalid_transition", "Model calls require an active exploration.", field_path="/status")
    if isinstance(count, bool) or not isinstance(count, int) or count < 1:
        raise ExplorationError("invalid_call_count", "count must be a positive integer.", field_path="/count")
    used = int(current.get("model_calls", 0) or 0)
    if used + count > current["budget"]["max_model_calls"]:
        return _stop(current, "budget_exhausted", "max_model_calls")
    current["model_calls"] = used + count
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    return current


def consume_tool_call(state: Mapping[str, Any], *, count: int = 1) -> dict[str, Any]:
    """Consume the bounded per-round tool-call allowance."""

    current = _copy(dict(state))
    _require_authorized(current)
    if current.get("status") not in {"exploring", "waiting_run", "comparing"}:
        raise ExplorationError("invalid_transition", "Tool calls require an active exploration.", field_path="/status")
    if isinstance(count, bool) or not isinstance(count, int) or count < 1:
        raise ExplorationError("invalid_call_count", "count must be a positive integer.", field_path="/count")
    used_round = int(current.get("tool_calls_this_round", 0) or 0)
    if used_round + count > current["budget"]["max_tool_calls_per_round"]:
        return _stop(current, "budget_exhausted", "max_tool_calls_per_round")
    current["tool_calls_this_round"] = used_round + count
    current["tool_calls"] = int(current.get("tool_calls", 0) or 0) + count
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    return current


def finish_report(state: Mapping[str, Any]) -> dict[str, Any]:
    """Produce a bounded report projection from the deterministic ledger."""

    current = _copy(dict(state))
    if current.get("phase") != "finish_report" and current.get("status") not in TERMINAL_STATES:
        raise ExplorationError("invalid_phase", "Exploration is not ready for a final report.", field_path="/phase")
    if current.get("status") not in TERMINAL_STATES:
        current["status"] = "completed"
    if not isinstance(current.get("stop_reason"), Mapping):
        current["stop_reason"] = {
            "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["stop_reason"],
            "contract_revision": EXPLORATION_CONTRACT_REVISION,
            "reason": "completed",
            "detail": "completed",
            "unknown_outcome": False,
            "provenance": _copy(EXPLORATION_PROVENANCE),
        }
    history = []
    for candidate in current.get("candidate_history", []):
        if not isinstance(candidate, Mapping):
            continue
        evaluation = candidate.get("evaluation") if isinstance(candidate.get("evaluation"), Mapping) else None
        objective_evaluation = evaluation.get("objective") if isinstance(evaluation, Mapping) else None
        history.append({
            "candidate_id": candidate.get("candidate_id"),
            "sequence": candidate.get("sequence"),
            "status": candidate.get("status"),
            "changed_fields": _copy(candidate.get("changed_fields", [])),
            "metric": _copy({"value": objective_evaluation.get("value"), "metric_path": objective_evaluation.get("metric_path"), "status": objective_evaluation.get("status")} if isinstance(objective_evaluation, Mapping) else None),
            "deployment_candidate_id": candidate.get("deployment_candidate_id"),
            "candidate_summary": _copy(candidate.get("candidate_summary") or candidate.get("deployment_candidate_summary")),
            "run_strategy": _copy(candidate.get("run_strategy")),
            "scenarios": _copy(evaluation.get("scenario_evaluations", [])) if isinstance(evaluation, Mapping) else [],
        })
    from .exploration_planning import pareto_front
    evaluations: list[dict[str, Any]] = []
    for candidate in current.get("candidate_history", []):
        if not isinstance(candidate, Mapping):
            continue
        evaluation = candidate.get("evaluation") if isinstance(candidate.get("evaluation"), Mapping) else {}
        nested = evaluation.get("evaluation") if isinstance(evaluation.get("evaluation"), Mapping) else evaluation
        objective = evaluation.get("objective") if isinstance(evaluation.get("objective"), Mapping) else {}
        row = {
            **_copy(dict(nested)),
            "candidate_id": candidate.get("candidate_id"),
            "deployment_candidate_id": candidate.get("deployment_candidate_id"),
            "candidate_summary": _copy(candidate.get("candidate_summary") or candidate.get("deployment_candidate_summary")),
            "scenario_results": _copy(evaluation.get("scenario_evaluations", [])),
            "objective_value": nested.get("objective_value", objective.get("value")),
            "direction": nested.get("direction", objective.get("direction", current.get("objective", {}).get("direction", "minimize"))),
            "eligible": nested.get("eligible", objective.get("eligible", False)) is True,
        }
        evaluations.append(row)
    qualified = [row for row in evaluations if row.get("eligible") is True]
    failed = [row for row in evaluations if row.get("eligible") is not True]
    pareto = pareto_front(qualified)
    recommended = current.get("best_candidate_id") if len(pareto) <= 1 else None
    current["evaluations"] = evaluations
    current["summary"] = {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["summary"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": current.get("session_id"),
        "state": current.get("status"),
        "evaluated_count": current.get("round_count", 0),
        "best_candidate_id": current.get("best_candidate_id"),
        "best_value": current.get("best_value"),
        "round_count": current.get("round_count", 0),
        "run_count": current.get("run_count", 0),
        "failure_count": current.get("failure_count", 0),
        "stop_reason": _copy(current["stop_reason"]),
        "rounds": history,
        "qualified_candidates": [row.get("candidate_id") for row in qualified],
        "constraint_failed_candidates": [row.get("candidate_id") for row in failed],
        "pareto_candidates": [row.get("candidate_id") for row in pareto],
        "recommended_candidate_id": recommended,
        "candidate_evaluations": _copy(evaluations),
        "stop_reason_code": current.get("stop_reason", {}).get("reason") if isinstance(current.get("stop_reason"), Mapping) else None,
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }
    current["phase"] = "finished"
    _event(current, "finished", "finish_report", {"best_candidate_id": current.get("best_candidate_id")})
    return current


def pause_exploration(state: Mapping[str, Any]) -> dict[str, Any]:
    if state.get("status") not in {"exploring", "waiting_run", "comparing"}:
        raise ExplorationError("invalid_transition", "Only an active exploration can be paused.")
    current = _transition(state, status="paused", phase="paused")
    _event(current, "paused", "pause")
    return current


def resume_exploration(state: Mapping[str, Any]) -> dict[str, Any]:
    current = _copy(dict(state))
    if current.get("status") != "paused":
        raise ExplorationError("invalid_transition", "Only a paused exploration can resume.")
    # Resume is a side-effect boundary: re-check the immutable authorization,
    # expiry and context fence instead of trusting the paused checkpoint.
    _require_authorized(current)
    if isinstance(current.get("current_run"), Mapping):
        current["status"] = "waiting_run"
        current["phase"] = "wait_run_terminal"
    else:
        candidate = current.get("current_candidate")
        candidate_status = candidate.get("status") if isinstance(candidate, Mapping) else None
        current["status"] = "exploring"
        current["phase"] = {"generated": "validate_candidate", "validated": "create_one_run"}.get(candidate_status, "generate_candidate")
    _event(current, "resumed", current["phase"])
    return current


def stop_exploration(state: Mapping[str, Any], *, reason: str = "manual_stop") -> dict[str, Any]:
    return _stop(state, "cancelled", reason)


def mark_context_expired(state: Mapping[str, Any], *, detail: str = "context_changed") -> dict[str, Any]:
    return _stop(state, "context_expired", detail)


def mark_authorization_expired(state: Mapping[str, Any], *, detail: str = "authorization_expired") -> dict[str, Any]:
    """Stop the loop when the immutable execution grant reaches its expiry."""

    current = _stop(state, "authorization_expired", detail)
    if isinstance(current.get("authorization"), Mapping):
        current["authorization"] = {**_copy(dict(current["authorization"])), "status": "expired"}
    return current


def mark_authorization_revoked(state: Mapping[str, Any], *, detail: str = "authorization_revoked") -> dict[str, Any]:
    """Stop the loop after the user revokes the execution grant."""

    current = _stop(state, "authorization_revoked", detail)
    if isinstance(current.get("authorization"), Mapping):
        current["authorization"] = {
            **_copy(dict(current["authorization"])),
            "status": "revoked",
            "revoked_at": current.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        }
    return current


def project_session(state: Mapping[str, Any]) -> dict[str, Any]:
    """Return the closed v2 session DTO, excluding internal reducer fields."""

    stop_reason = state.get("stop_reason")
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["session"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": state.get("session_id"),
        "task_type": "explore_experiment",
        "principal": state.get("principal"),
        "workspace_id": state.get("workspace_id"),
        "run_id": state.get("run_id"),
        "context_revision": state.get("context_revision"),
        "run_context_revision": state.get("run_context_revision"),
        "input_snapshot_digest": state.get("input_snapshot_digest"),
        "schema_set_revision": state.get("schema_set_revision"),
        "backend_identity": _copy(state.get("backend_identity")),
        "parameter_catalog_revision": state.get("parameter_catalog_revision"),
        "policy_revision": EXPLORATION_POLICY_REVISION,
        "objective": _copy(state.get("objective")),
        "parameter_grants": _copy(state.get("parameter_grants", [])),
        "budget": _copy(state.get("budget")),
        "base_config": _copy(state.get("base_config")),
        "allowed_pages": _copy(state.get("allowed_pages", [])),
        "allowed_actions": _copy(state.get("allowed_actions", [])),
        "state": state.get("state", state.get("status")),
        "current_round": int(state.get("current_round", state.get("round_count", 0)) or 0),
        "run_count": int(state.get("run_count", 0) or 0),
        "failure_count": int(state.get("failure_count", 0) or 0),
        "no_improvement_count": int(state.get("no_improvement_count", 0) or 0),
        "active_run_id": state.get("active_run_id"),
        "best_candidate_id": state.get("best_candidate_id"),
        "authorization_id": state.get("authorization_id"),
        "authorization_digest": state.get("authorization_digest"),
        "planning_plan_digest": (state.get("planning_plan") or {}).get("draft_digest") if isinstance(state.get("planning_plan"), Mapping) else None,
        "planning_confirmation": _copy((state.get("planning_plan") or {}).get("confirmation")) if isinstance(state.get("planning_plan"), Mapping) else None,
        "deployment_candidates": _copy(state.get("deployment_candidates", [])),
        "run_strategy": _copy(state.get("run_strategy")),
        "run_strategy_digest": state.get("run_strategy_digest"),
        "current_page_id": state.get("current_page_id", state.get("current_page")),
        "context_lock": _copy(state.get("context_lock")),
        "local_dev": True,
        "automatic_submission": True,
        "provenance": _copy(EXPLORATION_PROVENANCE),
        "stop_reason": _copy(stop_reason),
        "created_at": state.get("created_at", state.get("started_at")),
        "updated_at": state.get("updated_at", state.get("created_at", state.get("started_at"))),
        **({"error": _copy(state.get("error"))} if "error" in state else {}),
    }


def project_candidate(candidate: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Return the closed candidate DTO used by the v2 contract."""

    if not isinstance(candidate, Mapping):
        return None
    status = candidate.get("status")
    # ``completed`` was the internal name used by the initial reducer draft;
    # the successor contract separates the best candidate from other
    # evaluated candidates.  Normalize persisted draft records at the
    # projection boundary so old checkpoints cannot leak an invalid enum.
    if status == "completed":
        status = "best" if candidate.get("is_best") else "evaluated"
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["candidate"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "candidate_id": candidate.get("candidate_id"),
        "session_id": candidate.get("session_id"),
        "sequence": int(candidate.get("sequence", 1) or 1),
        "parent_candidate_id": candidate.get("parent_candidate_id"),
        "candidate_digest": candidate.get("candidate_digest"),
        "config": _copy(candidate.get("config")),
        "changed_fields": _copy(candidate.get("changed_fields", [])),
        "deployment_candidate": _copy(candidate.get("deployment_candidate")),
        "deployment_candidate_id": candidate.get("deployment_candidate_id"),
        "deployment_candidate_summary": _copy(candidate.get("deployment_candidate_summary")),
        "candidate_summary": _copy(candidate.get("candidate_summary") or candidate.get("deployment_candidate_summary")),
        "resource_binding": _copy(candidate.get("resource_binding")),
        "run_strategy": _copy(candidate.get("run_strategy")),
        "run_strategy_digest": candidate.get("run_strategy_digest"),
        "combination_key": candidate.get("combination_key"),
        "candidate_idempotency_key": candidate.get("candidate_idempotency_key"),
        "scenario_id": candidate.get("scenario_id"),
        "scenario_summary": _copy(candidate.get("scenario_summary")),
        "model_proposal": _copy(candidate.get("model_proposal")),
        "model_context_digest": candidate.get("model_context_digest"),
        "origin": candidate.get("origin"),
        "reason": candidate.get("reason"),
        "status": status,
        "authorization_id": candidate.get("authorization_id"),
        "run_id": candidate.get("run_id"),
        "run_idempotency_key": candidate.get("run_idempotency_key"),
        "metric_value": candidate.get("metric_value"),
        "metric_verified": bool(candidate.get("metric_verified", False)),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }


def project_evaluation(evaluation: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(evaluation, Mapping):
        return None
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["evaluation"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": evaluation.get("session_id"),
        "candidate_id": evaluation.get("candidate_id"),
        "run_id": evaluation.get("run_id"),
        "objective": _copy(evaluation.get("objective")),
        "evidence": _copy(evaluation.get("evidence", [])),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }


def project_event(event: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(event, Mapping):
        return None
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["event"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "event_id": event.get("event_id"),
        "session_id": event.get("session_id"),
        "sequence": event.get("sequence"),
        "event_type": event.get("event_type"),
        "node": event.get("node"),
        "state": event.get("state"),
        "payload_digest": event.get("payload_digest"),
        "created_at": event.get("created_at"),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }


def project_stop_reason(reason: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(reason, Mapping):
        return None
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["stop_reason"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "reason": reason.get("reason"),
        "detail": reason.get("detail"),
        "unknown_outcome": bool(reason.get("unknown_outcome", False)),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }


def project_summary(summary: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(summary, Mapping):
        return None
    stop_reason = summary.get("stop_reason")
    if isinstance(stop_reason, Mapping):
        projected_stop_reason = project_stop_reason(stop_reason)
    elif isinstance(stop_reason, str) and stop_reason:
        # Accept legacy in-memory summaries while always emitting the v2
        # object-shaped stop reason.
        projected_stop_reason = project_stop_reason({"reason": stop_reason, "detail": stop_reason})
    else:
        projected_stop_reason = project_stop_reason({"reason": "completed", "detail": "completed"})
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["summary"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": summary.get("session_id"),
        "state": summary.get("state"),
        "round_count": summary.get("round_count", summary.get("evaluated_count", 0)),
        "evaluated_count": summary.get("evaluated_count", 0),
        "run_count": summary.get("run_count", 0),
        "failure_count": summary.get("failure_count", 0),
        "best_candidate_id": summary.get("best_candidate_id"),
        "best_value": summary.get("best_value"),
        "stop_reason": projected_stop_reason,
        "rounds": _copy(summary.get("rounds", [])),
        "qualified_candidates": _copy(summary.get("qualified_candidates", [])),
        "constraint_failed_candidates": _copy(summary.get("constraint_failed_candidates", [])),
        "pareto_candidates": _copy(summary.get("pareto_candidates", [])),
        "recommended_candidate_id": summary.get("recommended_candidate_id"),
        "candidate_evaluations": _copy(summary.get("candidate_evaluations", [])),
        "stop_reason_code": summary.get("stop_reason_code"),
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }


def project_checkpoint(state: Mapping[str, Any], *, checkpoint_id: str, authorization_digest: str) -> dict[str, Any]:
    """Create the minimal closed checkpoint DTO for a durable adapter."""

    _nonempty(checkpoint_id, "/checkpoint_id")
    _digest(authorization_digest, "/authorization_digest")
    events = state.get("events") if isinstance(state.get("events"), list) else []
    return {
        "schema_identity": EXPLORATION_SCHEMA_IDENTITIES["checkpoint"],
        "contract_revision": EXPLORATION_CONTRACT_REVISION,
        "session_id": state.get("session_id"),
        "checkpoint_id": checkpoint_id,
        "state_digest": canonical_sha256(project_session(state)),
        "last_event_sequence": len(events),
        "active_run_id": state.get("active_run_id"),
        "context_revision": state.get("context_revision"),
        "authorization_digest": authorization_digest,
        "provenance": _copy(EXPLORATION_PROVENANCE),
    }

