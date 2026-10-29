"""Decision loop and deterministic L3 authorization for bounded Agent work.

The loop owns no persistence and never writes a store.  Every observation and
side effect is supplied by dependency-injected ``emit`` and ``tool_dispatch``
callbacks.  This keeps model choice separate from the Bridge's veto and
execution boundaries and makes the whole policy testable without a provider.
"""

from __future__ import annotations

import inspect
import json
import math
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

# The Bridge runs with ``bridge`` on ``sys.path`` and imports this module as
# ``services.agent_loop`` (a top-level package).  Keep a package-relative
# fallback for callers that import the whole repository as a package, but do
# not use a parent-relative import as the primary path: ``services`` has no
# parent in the normal Bridge process.
try:
    from agent_harness.authorization import AuthorizationError, PROVENANCE, _validate_budget
    from agent_harness.contracts import canonical_sha256
except ImportError:  # pragma: no cover - repository-package import mode
    from ..agent_harness.authorization import AuthorizationError, PROVENANCE, _validate_budget
    from ..agent_harness.contracts import canonical_sha256


ALLOWED_ACTIONS = {"propose_candidate", "inspect", "stop", "ask_user"}
# The authorization envelope uses user-facing capability names while the
# model loop uses decision primitives. Keep this translation deterministic so
# a grant for one primitive cannot silently authorize another. ``stop`` and
# ``ask_user`` are safety/control exits and remain available when a caller
# grants only a narrower mutating capability.
AUTHORIZATION_ACTION_FOR_DECISION = {
    "inspect": "analyze",
    "propose_candidate": "draft",
}
STOP_REASONS = {"no_improvement", "objective_reached", "out_of_scope", "needs_human"}
DENIAL_CODES = {
    "authorization_inactive",
    "action_not_allowed",
    "tool_not_authorized",
    "schema_violation",
    "parameter_out_of_grant",
    "step_misaligned",
    "protected_field",
    "budget_exhausted",
    "duplicate_candidate",
    "objective_mismatch",
}
MAX_OBSERVATIONS = 6
MAX_OBSERVATION_CHARACTERS = 1200
MAX_CONSECUTIVE_DENIALS = 3

# These errors describe a broken authorization/identity fence rather than a
# model proposal that can be corrected on the next turn.  They must never be
# converted into an ordinary tool observation: doing so would let the model
# continue deciding (and, in the server worker, potentially fall back to a
# rule candidate) after the authority that bound the turn has disappeared.
FAIL_CLOSED_TOOL_ERRORS = frozenset(
    {
        "authorization_inactive",
        "authorization_revoked",
        "authorization_required",
        "authorization_expired",
        "authorization_invalid",
        "invalid_budget",
        "authorization_digest_mismatch",
        "invalid_tool_allowlist",
        "protected_field",
        "snapshot_mismatch",
        "schema_revision_mismatch",
        "backend_identity_mismatch",
        "principal_mismatch",
        "workspace_mismatch",
        "session_not_found",
    }
)

DECISION_SCHEMA_VERSION = "tilesim.bridge.agent_decision.v1"


class AgentLoopError(RuntimeError):
    """Fail-closed prompt construction error with a stable audit code."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

# These are decision primitives, rather than Bridge tools.  Publishing them as
# function tools is important: otherwise an OpenAI-compatible model can only
# emit a candidate as free-form JSON prose and has no reliable way to select
# the action channel.  They remain bounded by ``authorize_action`` below.
DECISION_TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "propose_candidate": {
        "type": "object",
        "properties": {
            "config": {"type": "object"},
            "reason": {"type": "string", "maxLength": 240},
            "expected_effect": {"type": "string", "maxLength": 240},
        },
        "required": ["config"],
        "additionalProperties": False,
    },
    "stop": {
        "type": "object",
        "properties": {"reason": {"type": "string", "enum": sorted(STOP_REASONS)}},
        "required": ["reason"],
        "additionalProperties": False,
    },
    "ask_user": {
        "type": "object",
        "properties": {"question": {"type": "string", "minLength": 1, "maxLength": 240}},
        "required": ["question"],
        "additionalProperties": False,
    },
}


def _deny(code: str, *, field_path: str | None = None, hint: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"verdict": "deny", "code": code}
    if field_path:
        result["field_path"] = field_path
    if hint:
        result["hint"] = hint
    return result


def _allow() -> dict[str, str]:
    return {"verdict": "allow"}


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc)


def _is_expired(authorization: Mapping[str, Any]) -> bool:
    expires = _parse_time(authorization.get("expires_at"))
    return expires is None or expires <= datetime.now(timezone.utc)


def _tool_names() -> set[str]:
    # The decision loop dispatches through the closed read-only gateway below.
    # Do not merge the optimization session's descriptive registry here: those
    # names are capability metadata, not callable gateway handlers, and would
    # otherwise let an authorization publish tools that always fail at runtime.
    names: set[str] = set()
    try:
        try:
            from agent_harness.tools import TOOL_DEFINITIONS
        except ImportError:  # pragma: no cover - repository-package import mode
            from ..agent_harness.tools import TOOL_DEFINITIONS

        names.update(TOOL_DEFINITIONS)
    except Exception:
        pass
    return names


def _tool_schema(tool_name: str) -> dict[str, Any] | None:
    try:
        try:
            from agent_harness.tools import TOOL_INPUT_SCHEMAS
        except ImportError:  # pragma: no cover - repository-package import mode
            from ..agent_harness.tools import TOOL_INPUT_SCHEMAS

        value = TOOL_INPUT_SCHEMAS.get(tool_name)
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def _validate_tool_arguments(tool_name: str, arguments: Any) -> bool:
    try:
        try:
            from agent_harness.tools import validate_tool_arguments
        except ImportError:  # pragma: no cover - repository-package import mode
            from ..agent_harness.tools import validate_tool_arguments

        validate_tool_arguments(tool_name, arguments)
        return True
    except ImportError:
        pass
    except Exception as error:
        # Optimization tools are published by the durable optimization
        # registry, while the read-only harness gateway owns the narrower
        # TOOL_INPUT_SCHEMAS catalogue. Keep those published tools callable
        # through the injected optimization dispatcher, but still require an
        # object payload; the stage-2 validator remains the final gate.
        if getattr(error, "code", None) != "unknown_tool" or tool_name not in _tool_names():
            return False
    schema = _tool_schema(tool_name)
    if schema is None:
        # Optimization-only tool names are still checked for an object shape;
        # their deeper validation remains in the injected gateway.
        return isinstance(arguments, dict)
    if not isinstance(arguments, dict) or schema.get("type") != "object":
        return False
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    if schema.get("additionalProperties") is False and any(key not in properties for key in arguments):
        return False
    if any(key not in arguments for key in required):
        return False
    for key, value in arguments.items():
        rule = properties.get(key, {})
        if rule.get("type") == "string" and not isinstance(value, str):
            return False
        if rule.get("type") == "array" and not isinstance(value, list):
            return False
        if "enum" in rule and value not in rule["enum"]:
            return False
    return True


def _flatten_pointers(value: Any, prefix: str = "") -> dict[str, Any]:
    if not isinstance(value, (dict, list)):
        return {prefix or "/": value}
    result: dict[str, Any] = {}
    items = value.items() if isinstance(value, dict) else enumerate(value)
    for key, item in items:
        pointer = f"{prefix}/{key}" if prefix else f"/{key}"
        if isinstance(item, (dict, list)) and item:
            result.update(_flatten_pointers(item, pointer))
        else:
            result[pointer] = item
    return result


def _candidate_changes(action: Mapping[str, Any]) -> dict[str, Any]:
    changes = action.get("changes")
    if isinstance(changes, dict):
        if any(isinstance(key, str) and key.startswith("/") for key in changes):
            return {str(key): value for key, value in changes.items()}
    config = action.get("config", action.get("candidate", {}))
    if not isinstance(config, dict):
        return {}
    if any(isinstance(key, str) and key.startswith("/") for key in config):
        return {str(key): value for key, value in config.items()}
    return _flatten_pointers(config)


def _grant_for(pointer: str, grants: Any) -> Mapping[str, Any] | None:
    if not isinstance(grants, list):
        return None
    for grant in grants:
        if isinstance(grant, dict) and grant.get("pointer") == pointer:
            return grant
    return None


def _protected_pointer(pointer: str) -> bool:
    tokens = {
        item.replace("~1", "/").replace("~0", "~")
        for item in pointer.split("/")
        if item
    }
    return bool(tokens & {"provenance", "source_mode", "claim_scope", "production_status", "schema_set_revision", "backend_identity", "fidelity", "requested_fidelity", "resolved_fidelity", "fidelity_mode"})


def _budget_state(state: Mapping[str, Any], authorization: Mapping[str, Any]) -> dict[str, int | float]:
    budget = _runtime_budget(authorization)
    return {
        "max_rounds": budget["max_rounds"],
        "max_runs": budget["max_runs"],
        "max_seconds": budget["max_seconds"],
        "max_failures": budget["max_failures"],
        "max_model_calls": budget["max_model_calls"],
        "max_tool_calls_per_round": budget["max_tool_calls_per_round"],
        "max_navigation_attempts": budget["max_navigation_attempts"],
        "max_run_creations": budget["max_run_creations"],
        "max_execution_time_ms": budget["max_execution_time_ms"],
        "rounds": int(state.get("rounds", state.get("round", state.get("current_round", 0))) or 0),
        "runs": int(state.get("run_count", state.get("runs", 0)) or 0),
        "failures": int(state.get("failure_count", state.get("failures", 0)) or 0),
        "model_calls": int(state.get("model_calls", 0) or 0),
        "tool_calls": int(state.get("tool_calls_this_round", state.get("tool_calls", 0)) or 0),
        "navigation_attempts": int(state.get("navigation_attempts", 0) or 0),
        "run_creations": int(state.get("run_creations", 0) or 0),
        "execution_time_ms": int(state.get("execution_time_ms", 0) or 0),
        "elapsed_seconds": float(state.get("elapsed_seconds", 0) or 0),
    }


def _runtime_budget(authorization: Mapping[str, Any]) -> dict[str, int]:
    """Return the signed runtime budget, without repairing old envelopes.

    The worker may receive a legacy authorization from durable storage.  A
    missing call limit is an authorization failure, never an invitation to use
    a process-local default.  Keep validation in the authorization module so
    the issuer, verifier and runtime share the same bounds.
    """

    if not isinstance(authorization, Mapping):
        raise AuthorizationError("invalid_budget", "Authorization budget is required.", "/budget")
    budget = authorization.get("budget")
    return _validate_budget(budget, require_agent_call_limits=True)


def remaining_budget(*, authorization: Mapping[str, Any], state: Mapping[str, Any]) -> dict[str, int | float]:
    values = _budget_state(state, authorization)
    return {
        "rounds": max(0, int(values["max_rounds"] - values["rounds"])),
        "runs": max(0, int(values["max_runs"] - values["runs"])),
        "seconds": max(0.0, float(values["max_seconds"] - values["elapsed_seconds"])),
        "failures": max(0, int(values["max_failures"] - values["failures"])),
        "model_calls": max(0, int(values["max_model_calls"] - values["model_calls"])),
        "tool_calls": max(0, int(values["max_tool_calls_per_round"] - values["tool_calls"])),
        "navigation_attempts": max(0, int(values["max_navigation_attempts"] - values["navigation_attempts"])),
        "run_creations": max(0, int(values["max_run_creations"] - values["run_creations"])),
        "execution_time_ms": max(0, int(values["max_execution_time_ms"] - values["execution_time_ms"])),
    }


def _budget_denial(authorization: Mapping[str, Any], state: Mapping[str, Any]) -> dict[str, Any] | None:
    values = _budget_state(state, authorization)
    checks = (
        (values["rounds"] >= values["max_rounds"], "/budget/max_rounds", "round_limit"),
        (values["runs"] >= values["max_runs"], "/budget/max_runs", "run_limit"),
        (values["elapsed_seconds"] >= values["max_seconds"], "/budget/max_seconds", "time_limit"),
        (values["failures"] >= values["max_failures"], "/budget/max_failures", "failure_limit"),
        (values["model_calls"] >= values["max_model_calls"], "/budget/max_model_calls", "model_call_limit"),
        (values["tool_calls"] >= values["max_tool_calls_per_round"], "/budget/max_tool_calls_per_round", "tool_budget_exhausted"),
        (values["navigation_attempts"] >= values["max_navigation_attempts"], "/budget/max_navigation_attempts", "navigation_budget_exhausted"),
        (values["run_creations"] >= values["max_run_creations"], "/budget/max_run_creations", "run_creation_limit"),
        (values["execution_time_ms"] >= values["max_execution_time_ms"], "/budget/max_execution_time_ms", "execution_time_limit"),
    )
    for exhausted, path, hint in checks:
        if exhausted:
            return _deny("budget_exhausted", field_path=path, hint=hint)
    return None


def _decision_budget_state(state: Mapping[str, Any]) -> dict[str, Any]:
    """Check the action against the budget available before this model call.

    The loop increments ``model_calls`` before asking the model for a decision.
    That call is already authorized by the pre-call guard; the resulting
    decision must still be allowed to execute.  Subtract only the in-flight
    call for the veto check, while retaining the cumulative counter in the
    returned receipt and durable state.
    """
    prepared = dict(state)
    model_calls = int(prepared.get("model_calls", 0) or 0)
    prepared["model_calls"] = max(0, model_calls - 1)
    return prepared


def _duplicate_candidate(action: Mapping[str, Any], state: Mapping[str, Any]) -> bool:
    config = action.get("config", action.get("candidate", {}))
    # Never trust a model-supplied digest: it can choose a fresh label for an
    # identical configuration and bypass the duplicate fence.  The candidate
    # digest used by the durable store may add session/sequence context, but
    # this local comparison deliberately uses the canonical config digest.
    digest = canonical_sha256(config)
    # Durable candidate digests include session/sequence metadata and therefore
    # cannot identify the same configuration across rounds.  Inspect both the
    # legacy digest list and full candidate documents when available; the latter
    # lets the worker compare the canonical configuration digest directly.
    items: list[Any] = []
    for key in ("candidate_digests", "candidate_config_digests", "candidates"):
        value = state.get(key)
        if isinstance(value, list):
            items.extend(value)
    for item in items:
        if isinstance(item, str) and item == digest:
            return True
        if isinstance(item, dict):
            if item.get("candidate_digest") == digest or item.get("digest") == digest:
                return True
            if isinstance(item.get("config"), dict) and canonical_sha256(item["config"]) == digest:
                return True
    return False


def _decision_shape_verdict(action: Mapping[str, Any], kind: Any) -> dict[str, Any] | None:
    """Validate the closed decision union before applying semantic policy.

    ``run_agent_turn`` normally receives the normalized provider adapter
    output, but callers can inject a model callable directly.  The veto layer
    therefore owns one final closed-shape check so an injected/raw decision
    cannot smuggle ignored fields or omit the fields needed by its union arm.
    ``schema_version`` is optional for backwards-compatible injected tests,
    but when present it must identify the published Agent decision schema.
    """

    if not isinstance(action, Mapping):
        return _deny("action_not_allowed")
    raw_kind = action.get("kind")
    if raw_kind == "tool_call":
        normalized_kind = "tool_call"
    else:
        normalized_kind = kind
    allowed_by_kind: dict[str, set[str]] = {
        "tool_call": {"kind", "tool_name", "arguments", "reason", "schema_version"},
        "inspect": {"kind", "tool_name", "arguments", "reason", "schema_version"},
        # ``changes``/``candidate``/``metric_path``/``objective`` are retained
        # as explicit compatibility members because the durable optimization
        # adapter consumes them; they are not an open-ended extra-field escape.
        "propose_candidate": {
            "kind",
            "config",
            "changes",
            "candidate",
            "candidate_digest",
            "reason",
            "expected_effect",
            "metric_path",
            "objective",
            "schema_version",
        },
        "stop": {"kind", "reason", "schema_version"},
        "ask_user": {"kind", "question", "schema_version"},
    }
    allowed = allowed_by_kind.get(str(normalized_kind))
    if allowed is None:
        return None
    unknown = sorted(str(key) for key in action if key not in allowed)
    if unknown:
        return _deny("schema_violation", field_path=f"/{unknown[0]}", hint="Decision fields are closed.")
    if "schema_version" in action and action.get("schema_version") != DECISION_SCHEMA_VERSION:
        return _deny("schema_violation", field_path="/schema_version", hint="Use the published Agent decision schema.")
    if normalized_kind in {"tool_call", "inspect"}:
        if not isinstance(action.get("tool_name"), str) or not action.get("tool_name"):
            return _deny("schema_violation", field_path="/tool_name")
        if not isinstance(action.get("arguments"), dict):
            return _deny("schema_violation", field_path="/arguments")
    elif normalized_kind == "propose_candidate":
        config = action.get("config")
        changes = action.get("changes")
        candidate = action.get("candidate")
        if config is None and changes is None and candidate is None:
            return _deny("schema_violation", field_path="/config")
        if config is not None and not isinstance(config, dict):
            return _deny("schema_violation", field_path="/config")
        if changes is not None and not isinstance(changes, dict):
            return _deny("schema_violation", field_path="/changes")
        if candidate is not None and not isinstance(candidate, dict):
            return _deny("schema_violation", field_path="/candidate")
    elif normalized_kind == "stop":
        if not isinstance(action.get("reason"), str):
            return _deny("schema_violation", field_path="/reason")
    elif normalized_kind == "ask_user":
        if not isinstance(action.get("question"), str) or not action.get("question", "").strip():
            return _deny("schema_violation", field_path="/question")
    return None


def authorize_action(*, authorization: Mapping[str, Any], action: Mapping[str, Any], state: Mapping[str, Any]) -> dict[str, Any]:
    """Apply the fixed, cheap-to-expensive veto order from the autonomy contract."""
    if not isinstance(authorization, Mapping) or authorization.get("status") != "active" or _is_expired(authorization):
        return _deny("authorization_inactive")
    try:
        _runtime_budget(authorization)
    except AuthorizationError as error:
        return _deny("authorization_invalid", field_path=error.field_path, hint="Issue a fresh authorization with explicit call limits.")
    if not isinstance(action, Mapping):
        return _deny("action_not_allowed")
    kind = action.get("kind")
    if kind == "tool_call":
        kind = "inspect"
    if kind not in ALLOWED_ACTIONS:
        return _deny("action_not_allowed")
    required_authorization_action = AUTHORIZATION_ACTION_FOR_DECISION.get(kind)
    if required_authorization_action is not None:
        allowed_actions = authorization.get("allowed_actions")
        if (
            not isinstance(allowed_actions, (list, tuple, set))
            or required_authorization_action not in allowed_actions
        ):
            return _deny("action_not_allowed", field_path="/allowed_actions")
    tool_name = action.get("tool_name")
    # Keep the policy's required cheap-to-expensive order: an unknown or
    # ungranted tool must be rejected before looking at its untrusted
    # arguments.  Otherwise a model could turn an authorization failure into
    # a misleading schema error (and callers might retry the wrong thing).
    if kind == "inspect":
        if (
            not isinstance(tool_name, str)
            or tool_name not in set(authorization.get("tool_allowlist", []))
            or tool_name not in _tool_names()
        ):
            return _deny("tool_not_authorized", field_path="/tool_name")
        shape_denial = _decision_shape_verdict(action, kind)
        if shape_denial:
            return shape_denial
        if not _validate_tool_arguments(str(tool_name), action.get("arguments", {})):
            return _deny("schema_violation", field_path="/arguments")
    else:
        shape_denial = _decision_shape_verdict(action, kind)
        if shape_denial:
            return shape_denial
    if kind == "stop" and action.get("reason") not in STOP_REASONS:
        return _deny("schema_violation", field_path="/reason")
    if kind == "propose_candidate":
        changes = _candidate_changes(action)
        if not changes:
            return _deny("schema_violation", field_path="/config")
        for pointer, value in changes.items():
            grant = _grant_for(pointer, authorization.get("parameter_grants"))
            if grant is None:
                return _deny("parameter_out_of_grant", field_path=pointer)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
                return _deny("schema_violation", field_path=pointer)
            minimum, maximum, step = grant.get("min"), grant.get("max"), grant.get("step")
            if any(isinstance(item, bool) or not isinstance(item, (int, float)) or not math.isfinite(float(item)) for item in (minimum, maximum, step)) or step <= 0:
                return _deny("schema_violation", field_path=pointer)
            grant_kind = grant.get("kind", "number")
            if grant_kind in {"int", "integer"} and not float(value).is_integer():
                return _deny("schema_violation", field_path=pointer)
            if value < minimum or value > maximum:
                return _deny("parameter_out_of_grant", field_path=pointer)
            quotient = (value - minimum) / step
            if abs(quotient - round(quotient)) > 1e-9:
                return _deny("step_misaligned", field_path=pointer)
    protected = authorization.get("protected") if isinstance(authorization.get("protected"), Mapping) else {}
    if kind == "propose_candidate":
        for pointer in _candidate_changes(action):
            if pointer in protected or _protected_pointer(pointer):
                return _deny("protected_field", field_path=pointer)
    budget_denial = _budget_denial(authorization, state)
    if budget_denial:
        return budget_denial
    if kind == "propose_candidate" and _duplicate_candidate(action, state):
        return _deny("duplicate_candidate", field_path="/config")
    objective = authorization.get("objective") if isinstance(authorization.get("objective"), Mapping) else {}
    action_metric = action.get("metric_path", action.get("objective", {}).get("metric_path") if isinstance(action.get("objective"), Mapping) else None)
    if action_metric is not None and action_metric != objective.get("metric_path"):
        return _deny("objective_mismatch", field_path="/objective/metric_path")
    return _allow()


def _bounded_observation(value: Any) -> str:
    try:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) if not isinstance(value, str) else value
    except (TypeError, ValueError):
        text = str(value)
    return text[:MAX_OBSERVATION_CHARACTERS]


def build_agent_messages(*, authorization: Mapping[str, Any], state: Mapping[str, Any], observations: list[Any]) -> list[dict[str, str]]:
    """Build a bounded prompt; old logs are deliberately not copied wholesale."""
    boundary = {
        "authorization_id": authorization.get("authorization_id"),
        "autonomy_level": authorization.get("autonomy_level"),
        "budget": authorization.get("budget"),
        "parameter_grants": authorization.get("parameter_grants", []),
        "objective": authorization.get("objective"),
        "tool_allowlist": authorization.get("tool_allowlist", []),
        "allowed_pages": authorization.get("allowed_pages", []),
        "allowed_actions": authorization.get("allowed_actions", []),
        "protected": authorization.get("protected", {}),
        "provenance": PROVENANCE,
    }
    # Keep the user frame within the existing prompt budget even after the
    # explicit empty-history markers below are added.  The evidence itself is
    # already bounded; this small headroom is for the closed state envelope.
    recent = [_bounded_observation(item)[:1100] for item in observations[-MAX_OBSERVATIONS:]]
    # An empty history is an explicit fact, not an omitted field.  Omitting it
    # lets a model infer that no attempt ledger was available, which is a
    # different (and unsafe) claim from "the current session has no attempts".
    history = state.get("attempt_history", [])
    if not isinstance(history, list):
        raise AgentLoopError("attempt_history_invalid", "Attempt history must be a bounded array.")
    if len(history) > 16:
        raise AgentLoopError("attempt_history_invalid", "Attempt history exceeds the model-facing entry budget.")
    try:
        history_text = json.dumps(history, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except (TypeError, ValueError) as error:
        raise AgentLoopError("attempt_history_invalid", "Attempt history is not strict JSON.") from error
    if len(history_text) > 12000:
        raise AgentLoopError("attempt_history_invalid", "Attempt history exceeds the model-facing character budget.")
    forbidden_history_keys = {"config", "artifact", "artifacts", "credential", "credentials", "provider_response", "raw_response", "hidden_reasoning"}
    if any(isinstance(item, dict) and forbidden_history_keys.intersection(item) for item in history):
        raise AgentLoopError("attempt_history_invalid", "Attempt history contains a forbidden raw payload.")
    state_view = {
        key: state.get(key)
        for key in (
            "round",
            "rounds",
            "run_count",
            "failure_count",
            "best_metric",
            "last_candidate_digest",
            # Never include a full candidate configuration in a model prompt.
            # Candidate documents remain server-side and are represented only
            # by the bounded attempt_history summary and digests below.
            "last_verified_evaluation",
            "run_id",
            "objective_metric_path",
            "attempt_history",
            "attempt_history_digest",
            "attempt_history_truncated",
            "attempt_history_omitted_count",
        )
        if key in state
    }
    state_view["attempt_history"] = history
    state_view.setdefault("attempt_history_truncated", False)
    state_view.setdefault("attempt_history_omitted_count", 0)
    state_view.setdefault("attempt_history_digest", canonical_sha256({"entries": history, "empty": not history}))
    return [
        {
            "role": "system",
            "content": "You are a bounded TileSim agent. Choose the next action from propose_candidate, inspect, stop, or ask_user. Never alter protected identity/provenance fields, and never claim synthetic evidence is production validation. Authorization boundary (read-only): " + json.dumps(boundary, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        },
        {
            "role": "user",
            "content": json.dumps({"state": state_view, "recent_observations": recent}, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        },
    ]


def _call_model(model_call: Callable[..., Any], messages: list[dict[str, str]], authorization: Mapping[str, Any], state: Mapping[str, Any]) -> Any:
    # Publish the same closed argument schemas used by the gateway.  A model
    # must not have to guess whether a tool accepts ``run_id`` or which
    # fields are optional; the loop and the dispatcher share this catalogue.
    tools = []
    for name, schema in DECISION_TOOL_SCHEMAS.items():
        tools.append({"type": "function", "function": {"name": name, "parameters": schema}})
    for name in authorization.get("tool_allowlist", []):
        if name in DECISION_TOOL_SCHEMAS:
            continue
        schema = _tool_schema(str(name)) or {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        }
        # Match the OpenAI-compatible function-tool envelope consumed by
        # assistant_model.agent_decision.  The schema itself remains the
        # canonical TOOL_INPUT_SCHEMAS object for published read tools.
        tools.append({"type": "function", "function": {"name": name, "parameters": schema}})
    try:
        parameters = inspect.signature(model_call).parameters
    except (TypeError, ValueError):
        return model_call(messages, tools, state)
    accepts_kwargs = any(parameter.kind is inspect.Parameter.VAR_KEYWORD for parameter in parameters.values())
    if accepts_kwargs or {"messages", "tools", "state"}.issubset(parameters):
        return model_call(messages=messages, tools=tools, state=state)
    positional = [parameter for parameter in parameters.values() if parameter.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)]
    if len(positional) >= 3:
        return model_call(messages, tools, state)
    if len(positional) >= 2:
        return model_call(messages, tools)
    return model_call(messages)


def _emit(emit: Callable[..., Any] | None, event_type: str, payload: Any) -> None:
    if emit is None:
        return
    try:
        emit(event_type, payload)
    except TypeError:
        emit({"type": event_type, "payload": payload})


def _dispatch(tool_dispatch: Callable[..., Any], *, tool_name: str, arguments: dict[str, Any], idempotency_key: str, state: Mapping[str, Any]) -> Any:
    try:
        parameters = inspect.signature(tool_dispatch).parameters
    except (TypeError, ValueError):
        return tool_dispatch(tool_name, arguments, idempotency_key, state)
    accepts_kwargs = any(parameter.kind is inspect.Parameter.VAR_KEYWORD for parameter in parameters.values())
    if accepts_kwargs or {"tool_name", "arguments", "idempotency_key", "state"}.issubset(parameters):
        return tool_dispatch(tool_name=tool_name, arguments=arguments, idempotency_key=idempotency_key, state=state)
    positional = [parameter for parameter in parameters.values() if parameter.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)]
    if len(positional) >= 4:
        return tool_dispatch(tool_name, arguments, idempotency_key, state)
    if len(positional) >= 3:
        return tool_dispatch(tool_name, arguments, idempotency_key)
    return tool_dispatch(tool_name, arguments)


def _run_agent_turn_impl(*, authorization: Mapping[str, Any], state: Mapping[str, Any], model_call: Callable[..., Any],
                   tool_dispatch: Callable[..., Any], limits: Mapping[str, Any] | Any, emit: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Run one model/observation turn with bounded retries and no persistence."""
    try:
        signed_budget = _runtime_budget(authorization)
    except AuthorizationError as error:
        verdict = _deny("authorization_invalid", field_path=error.field_path, hint="Issue a fresh authorization with explicit call limits.")
        _emit(emit, "agent.verdict", verdict)
        return {
            "decision": {"kind": "stop", "reason": "authorization_invalid"},
            "observations": [{"kind": "security_error", **verdict}],
            "denials": 0,
            "stop": "authorization_invalid",
            "security_error": "authorization_invalid",
            "steps": [],
            "model_calls": int(state.get("model_calls", 0) or 0) if isinstance(state, Mapping) else 0,
        }
    # ``limits`` is retained as a compatibility argument for injected tests,
    # but it can only narrow the signed authorization budget.  Missing values
    # are read from the authorization itself, never from process defaults.
    if isinstance(limits, Mapping):
        requested_tool_calls = limits.get("max_tool_calls_per_round", signed_budget["max_tool_calls_per_round"])
        requested_model_calls = limits.get("max_model_calls", signed_budget["max_model_calls"])
    else:
        requested_tool_calls = getattr(limits, "max_tool_calls_per_round", signed_budget["max_tool_calls_per_round"])
        requested_model_calls = getattr(limits, "max_model_calls", signed_budget["max_model_calls"])
    if isinstance(requested_tool_calls, bool) or not isinstance(requested_tool_calls, int):
        requested_tool_calls = signed_budget["max_tool_calls_per_round"]
    if isinstance(requested_model_calls, bool) or not isinstance(requested_model_calls, int):
        requested_model_calls = signed_budget["max_model_calls"]
    max_tool_calls = min(signed_budget["max_tool_calls_per_round"], max(0, requested_tool_calls))
    seeded_observations = state.get("initial_observations") if isinstance(state, Mapping) else None
    observations: list[Any] = list(seeded_observations[-MAX_OBSERVATIONS:]) if isinstance(seeded_observations, list) else []
    steps: list[dict[str, Any]] = []
    denials = 0
    local_state = dict(state)
    max_model_calls = min(signed_budget["max_model_calls"], max(0, requested_model_calls))
    for step_index in range(max_tool_calls):
        if int(local_state.get("tool_calls_this_round", 0) or 0) >= max_tool_calls:
            return {
                "decision": {"kind": "stop", "reason": "tool_budget_exhausted"},
                "observations": observations,
                "denials": denials,
                "stop": "tool_budget_exhausted",
                "steps": steps,
                "model_calls": int(local_state.get("model_calls", 0) or 0),
            }
        if int(local_state.get("model_calls", 0) or 0) >= max_model_calls:
            return {
                "decision": {"kind": "stop", "reason": "model_call_limit"},
                "observations": observations,
                "denials": denials,
                "stop": "model_call_limit",
                "steps": steps,
                "model_calls": int(local_state.get("model_calls", 0) or 0),
            }
        local_state["model_calls"] = int(local_state.get("model_calls", 0) or 0) + 1
        messages = build_agent_messages(authorization=authorization, state=local_state, observations=observations)
        try:
            decision = _call_model(model_call, messages, authorization, local_state)
        except Exception as error:  # Provider errors are handled by the caller as degradation.
            observation = {"kind": "model_error", "code": "provider_error", "detail": str(error)[:240]}
            observations.append(observation)
            _emit(emit, "agent.degraded", observation)
            return {"decision": {"kind": "stop", "reason": "needs_human", "parse_error": "provider_error"}, "observations": observations, "denials": denials, "stop": "needs_human", "steps": steps, "model_calls": int(local_state.get("model_calls", 0) or 0)}
        if not isinstance(decision, dict):
            # A malformed provider response is an observation, not an action.
            # Keep it inside the same bounded denial path so no store/tool can
            # be touched and the model gets a chance to recover.
            denials += 1
            verdict = _deny("schema_violation", field_path="/decision", hint="Return one closed JSON decision object.")
            observation = {"kind": "agent.verdict", **verdict}
            observations.append(observation)
            steps.append({"decision": decision, "verdict": verdict})
            _emit(emit, "agent.verdict", verdict)
            if denials >= MAX_CONSECUTIVE_DENIALS:
                _emit(emit, "agent.degraded", {"code": "consecutive_denials", "count": denials})
                return {
                    "decision": {"kind": "stop", "reason": "consecutive_denials"},
                    "observations": observations,
                    "denials": denials,
                    "stop": "consecutive_denials",
                    "steps": steps,
                    "model_calls": int(local_state.get("model_calls", 0) or 0),
                }
            continue
        # The provider adapter deliberately converts malformed tool-call JSON
        # into a bounded ``stop/needs_human`` decision so it never leaks raw
        # provider text.  That marker must still travel through the L3 veto
        # path as a schema denial: ending the turn immediately would hide the
        # malformed action from the audit trail and would skip the model's
        # bounded retry opportunity.
        if decision.get("parse_error"):
            denials += 1
            verdict = _deny(
                "schema_violation",
                field_path="/decision",
                hint="Return valid JSON tool arguments matching the published schema.",
            )
            observation = {"kind": "agent.verdict", **verdict}
            observations.append(observation)
            steps.append({"decision": decision, "verdict": verdict})
            _emit(emit, "agent.verdict", verdict)
            if denials >= MAX_CONSECUTIVE_DENIALS:
                _emit(emit, "agent.degraded", {"code": "consecutive_denials", "count": denials})
                return {
                    "decision": {"kind": "stop", "reason": "consecutive_denials"},
                    "observations": observations,
                    "denials": denials,
                    "stop": "consecutive_denials",
                    "steps": steps,
                    "model_calls": int(local_state.get("model_calls", 0) or 0),
                }
            continue
        kind = decision.get("kind")
        if kind in {"stop", "ask_user"}:
            # Interactive/terminal decisions are still subject to the same
            # deterministic boundary and budget checks.  ``ask_user`` has no
            # side effect, but it must not become a way to bypass an expired
            # authorization or an exhausted session.
            verdict = authorize_action(
                authorization=authorization,
                action=decision,
                state=_decision_budget_state(local_state),
            )
            if verdict["verdict"] == "deny":
                denials += 1
                observation = {"kind": "agent.verdict", **verdict}
                observations.append(observation)
                steps.append({"decision": decision, "verdict": verdict})
                _emit(emit, "agent.verdict", verdict)
                if denials >= MAX_CONSECUTIVE_DENIALS:
                    _emit(emit, "agent.degraded", {"code": "consecutive_denials", "count": denials})
                    return {
                        "decision": {"kind": "stop", "reason": "consecutive_denials"},
                        "observations": observations,
                        "denials": denials,
                        "stop": "consecutive_denials",
                        "steps": steps,
                        "model_calls": int(local_state.get("model_calls", 0) or 0),
                    }
                continue
            steps.append({"kind": kind, "decision": decision, "verdict": verdict})
            _emit(emit, "agent.step", {"kind": kind, "reason": decision.get("reason", decision.get("question"))})
            return {"decision": decision, "observations": observations, "denials": denials, "stop": decision.get("reason", decision.get("question")), "steps": steps, "model_calls": int(local_state.get("model_calls", 0) or 0)}
        if kind == "tool_call":
            decision = {**decision, "kind": "inspect"}
        verdict = authorize_action(
            authorization=authorization,
            action=decision,
            state=_decision_budget_state(local_state),
        )
        if verdict["verdict"] == "deny":
            denials += 1
            observation = {"kind": "agent.verdict", **verdict}
            observations.append(observation)
            steps.append({"decision": decision, "verdict": verdict})
            _emit(emit, "agent.verdict", verdict)
            if denials >= MAX_CONSECUTIVE_DENIALS:
                _emit(emit, "agent.degraded", {"code": "consecutive_denials", "count": denials})
                return {
                    "decision": {"kind": "stop", "reason": "consecutive_denials"},
                    "observations": observations,
                    "denials": denials,
                    "stop": "consecutive_denials",
                    "steps": steps,
                    "model_calls": int(local_state.get("model_calls", 0) or 0),
                }
            continue
        if decision.get("kind") == "propose_candidate":
            steps.append({"decision": decision, "verdict": verdict})
            _emit(emit, "agent.step", {"kind": "propose_candidate", "candidate_digest": canonical_sha256(decision.get("config", {}))})
            return {"decision": decision, "observations": observations, "denials": denials, "stop": None, "steps": steps, "model_calls": int(local_state.get("model_calls", 0) or 0)}
        tool_name = str(decision.get("tool_name"))
        arguments = decision.get("arguments", {})
        idem = canonical_sha256({"session_id": authorization.get("session_id"), "round": local_state.get("round", local_state.get("rounds", 0)), "tool_name": tool_name, "arguments": arguments})
        _emit(emit, "agent.tool_call", {"tool_name": tool_name, "idempotency_key": idem})
        try:
            result = _dispatch(tool_dispatch, tool_name=tool_name, arguments=arguments, idempotency_key=idem, state=local_state)
        except Exception as error:
            error_code = getattr(error, "code", "tool_error")
            if error_code in FAIL_CLOSED_TOOL_ERRORS:
                # A revoked/stale identity is not a recoverable model
                # denial.  Stop before another model call and expose only the
                # bounded code; never hand the caller a rule-fallback path.
                security_verdict = _deny(str(error_code), hint="The authorization or identity fence is no longer valid.")
                observation = {"kind": "security_error", **security_verdict}
                observations.append(observation)
                steps.append({"decision": decision, "tool_name": tool_name, "verdict": security_verdict, "idempotency_key": idem})
                _emit(emit, "agent.verdict", security_verdict)
                return {
                    "decision": {"kind": "stop", "reason": "authorization_revoked", "security_error": str(error_code)},
                    "observations": observations,
                    "denials": denials,
                    "stop": "authorization_revoked",
                    "security_error": str(error_code),
                    "steps": steps,
                    "model_calls": int(local_state.get("model_calls", 0) or 0),
                }
            result = {"outcome": "rejected", "error_code": error_code, "detail": str(error)[:240]}
        if isinstance(result, Mapping) and result.get("error_code") in FAIL_CLOSED_TOOL_ERRORS:
            error_code = str(result.get("error_code"))
            security_verdict = _deny(error_code, hint="The authorization or identity fence is no longer valid.")
            observation = {"kind": "security_error", **security_verdict}
            observations.append(observation)
            steps.append({"decision": decision, "tool_name": tool_name, "verdict": security_verdict, "idempotency_key": idem})
            _emit(emit, "agent.verdict", security_verdict)
            return {
                "decision": {"kind": "stop", "reason": "authorization_revoked", "security_error": error_code},
                "observations": observations,
                "denials": denials,
                "stop": "authorization_revoked",
                "security_error": error_code,
                "steps": steps,
                "model_calls": int(local_state.get("model_calls", 0) or 0),
            }
        observation = {"kind": "tool_result", "tool_name": tool_name, "result": result}
        observations.append(observation)
        local_state["tool_calls_this_round"] = int(local_state.get("tool_calls_this_round", 0)) + 1
        steps.append({"decision": decision, "tool_name": tool_name, "result": result, "idempotency_key": idem})
        _emit(emit, "agent.tool_result", {"tool_name": tool_name, "result": result, "idempotency_key": idem})
    return {
        "decision": {"kind": "stop", "reason": "tool_budget_exhausted"},
        "observations": observations,
        "denials": denials,
        "stop": "tool_budget_exhausted",
        "steps": steps,
        "model_calls": int(local_state.get("model_calls", 0) or 0),
    }


def run_agent_turn(*, authorization: Mapping[str, Any], state: Mapping[str, Any], model_call: Callable[..., Any],
                   tool_dispatch: Callable[..., Any], limits: Mapping[str, Any] | Any,
                   emit: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Run one bounded turn and attach auditable usage counters.

    The implementation above intentionally keeps its early-return branches
    simple.  This wrapper adds the same usage projection to every branch,
    including authorization/schema failures, so receipts never need to infer
    tool usage from provider text.
    """
    result = _run_agent_turn_impl(
        authorization=authorization,
        state=state,
        model_call=model_call,
        tool_dispatch=tool_dispatch,
        limits=limits,
        emit=emit,
    )
    steps = result.get("steps") if isinstance(result, dict) else []
    tool_calls_used = sum(
        1
        for step in (steps if isinstance(steps, list) else [])
        if isinstance(step, Mapping) and isinstance(step.get("tool_name"), str)
    )
    result["tool_calls_used"] = tool_calls_used
    try:
        budget = _runtime_budget(authorization)
        model_calls = int(result.get("model_calls", state.get("model_calls", 0)) or 0)
        result["remaining_budget"] = {
            "model_calls": max(0, budget["max_model_calls"] - model_calls),
            "tool_calls_per_round": max(0, budget["max_tool_calls_per_round"] - tool_calls_used),
            "navigation_attempts": max(0, budget["max_navigation_attempts"] - int(state.get("navigation_attempts", 0) or 0)),
            "run_creations": max(0, budget["max_run_creations"] - int(state.get("run_creations", 0) or 0)),
            "execution_time_ms": max(0, budget["max_execution_time_ms"] - int(state.get("execution_time_ms", 0) or 0)),
        }
    except (AuthorizationError, TypeError, ValueError):
        result["remaining_budget"] = None
    return result


__all__ = [
    "AgentLoopError",
    "ALLOWED_ACTIONS",
    "DENIAL_CODES",
    "MAX_CONSECUTIVE_DENIALS",
    "FAIL_CLOSED_TOOL_ERRORS",
    "STOP_REASONS",
    "authorize_action",
    "build_agent_messages",
    "remaining_budget",
    "run_agent_turn",
]
