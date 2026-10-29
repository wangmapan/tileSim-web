"""Pure authorization-envelope primitives for bounded autonomous work.

The authorization document is the only object that can turn a local
optimization session from ``human_approves_each`` into a bounded autonomous
loop.  This module deliberately has no storage, HTTP or model dependency so
the binding and digest rules can be tested without starting the Bridge.
"""

from __future__ import annotations

import copy
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .contracts import canonical_sha256


SCHEMA_IDENTITY = "tilesim.agent_harness.optimization_authorization.v1"
AUTHORIZATION_CONTRACT_REVISION = "2026-10-28.wpf.v1"
AUTONOMY_LEVELS = {"bounded_autonomous", "human_approves_each"}
AUTHORIZATION_STATUSES = {"active", "exhausted", "revoked", "expired"}
MAX_AUTHORIZATION_TTL_SECONDS = 4 * 60 * 60
DEFAULT_AUTHORIZATION_TTL_SECONDS = 60 * 60
PROVENANCE = {
    "deployment_mode": "local_dev",
    "source_mode": "synthetic_trace",
    "claim_scope": "exploratory",
    "production_status": "not_for_production",
}

# Authorization envelopes are immutable closed documents.  Keep this list in
# the pure verifier as a second line of defence for records read from durable
# storage: a caller must not be able to append an unrecognised field and then
# make the document appear valid merely by recomputing its public digest.
_ENVELOPE_FIELDS = frozenset(
    {
        "schema_identity",
        "contract_revision",
        "authorization_id",
        "session_id",
        "principal",
        "workspace_id",
        "schema_set_revision",
        "backend_identity",
        "input_snapshot_digest",
        "autonomy_level",
        "budget",
        "parameter_grants",
        "objective",
        "tool_allowlist",
        "allowed_pages",
        "allowed_actions",
        "protected",
        "status",
        "issued_by",
        "issued_at",
        "expires_at",
        "revoked_at",
        "provenance",
        "authorization_digest",
    }
)


class AuthorizationError(ValueError):
    """Stable, field-addressed authorization validation failure."""

    def __init__(self, code: str, message: str, field_path: str = "/"):
        super().__init__(message)
        self.code = code
        self.field_path = field_path


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _require_nonempty_string(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AuthorizationError("invalid_authorization", "Expected a non-empty string.", path)
    return value


def _require_digest(value: Any, path: str) -> str:
    """Require the canonical digest shape used by bound session inputs."""

    text = _require_nonempty_string(value, path)
    if not text.startswith("sha256:") or len(text) != len("sha256:") + 64:
        raise AuthorizationError("invalid_digest", "Expected a sha256 digest.", path)
    try:
        int(text.removeprefix("sha256:"), 16)
    except ValueError as error:
        raise AuthorizationError("invalid_digest", "Expected a sha256 digest.", path) from error
    return text


def _number(value: Any, path: str, *, positive: bool = False) -> int | float:
    try:
        finite = math.isfinite(float(value))
    except (TypeError, ValueError, OverflowError):
        finite = False
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not finite:
        raise AuthorizationError("invalid_parameter_grant", "Expected a finite number.", path)
    if positive and value <= 0:
        raise AuthorizationError("invalid_parameter_grant", "Expected a positive number.", path)
    return value


def _contract_revision(document: dict[str, Any]) -> str:
    return str(document.get("contract_revision", ""))


def _is_protected_pointer(pointer: Any) -> bool:
    if not isinstance(pointer, str):
        return False
    tokens = [token.replace("~1", "/").replace("~0", "~") for token in pointer.split("/") if token]
    protected = {
        "source_mode",
        "claim_scope",
        "production_status",
        "schema_set_revision",
        "backend_identity",
        "fidelity",
        "requested_fidelity",
        "resolved_fidelity",
        "fidelity_mode",
        "provenance",
    }
    return any(token in protected for token in tokens)


def _validate_grants(grants: Any) -> list[dict[str, Any]]:
    if not isinstance(grants, list):
        raise AuthorizationError("invalid_parameter_grants", "parameter_grants must be an array.", "/parameter_grants")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    allowed_keys = {"pointer", "min", "max", "step", "kind"}
    for index, item in enumerate(grants):
        path = f"/parameter_grants/{index}"
        if not isinstance(item, dict):
            raise AuthorizationError("invalid_parameter_grant", "Each parameter grant must be an object.", path)
        unknown = sorted(set(item) - allowed_keys)
        if unknown:
            raise AuthorizationError("invalid_parameter_grant", "Parameter grants are closed.", f"{path}/{unknown[0]}")
        pointer = _require_nonempty_string(item.get("pointer"), f"{path}/pointer")
        if not pointer.startswith("/") or _is_protected_pointer(pointer):
            raise AuthorizationError("protected_field", "Protected identity and provenance fields cannot be granted.", f"{path}/pointer")
        if pointer in seen:
            raise AuthorizationError("duplicate_parameter_grant", "Each pointer may be granted only once.", f"{path}/pointer")
        seen.add(pointer)
        minimum = _number(item.get("min"), f"{path}/min")
        maximum = _number(item.get("max"), f"{path}/max")
        step = _number(item.get("step"), f"{path}/step", positive=True)
        if minimum >= maximum:
            raise AuthorizationError("invalid_parameter_grant", "Grant min must be less than max.", f"{path}/min")
        kind = item.get("kind", "number")
        if kind not in {"int", "integer", "number", "float"}:
            raise AuthorizationError("invalid_parameter_grant", "Grant kind is unsupported.", f"{path}/kind")
        normalized.append({"pointer": pointer, "min": minimum, "max": maximum, "step": step, "kind": kind})
    return normalized


def _validate_budget(budget: Any, *, require_agent_call_limits: bool = False) -> dict[str, int]:
    if not isinstance(budget, dict):
        raise AuthorizationError("invalid_budget", "Budget must be an object.", "/budget")
    defaults = {
        "max_rounds": 5,
        "max_runs": 5,
        "max_seconds": 900,
        "max_failures": 2,
        "max_model_calls": 24,
        "max_tool_calls_per_round": 4,
        "max_navigation_attempts": 4,
        "max_run_creations": 1,
        "max_execution_time_ms": 900_000,
    }
    limits = {
        "max_rounds": 20,
        "max_runs": 20,
        "max_seconds": 3600,
        "max_failures": 5,
        "max_model_calls": 60,
        "max_tool_calls_per_round": 4,
        "max_navigation_attempts": 8,
        "max_run_creations": 1,
        "max_execution_time_ms": 3_600_000,
    }
    unknown = sorted(set(budget) - set(defaults))
    if unknown:
        raise AuthorizationError("invalid_budget", "Budget is closed.", f"/budget/{unknown[0]}")
    result: dict[str, int] = {}
    for name, default in defaults.items():
        # The authorization envelope is the runtime authority.  Its two
        # agent-call limits must therefore be explicitly signed into the
        # document; silently repairing an old/malformed envelope here would
        # let replay or restart regain a larger budget than the issuer chose.
        if require_agent_call_limits and name in {
            "max_model_calls",
            "max_tool_calls_per_round",
            "max_navigation_attempts",
            "max_run_creations",
            "max_execution_time_ms",
        } and name not in budget:
            raise AuthorizationError("invalid_budget", f"{name} is required in an authorization envelope.", f"/budget/{name}")
        value = budget.get(name, default)
        if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > limits[name]:
            raise AuthorizationError("invalid_budget", f"{name} is outside the local-dev bound.", f"/budget/{name}")
        result[name] = value
    return result


_DEFAULT_ALLOWED_PAGES = (
    "overview",
    "execution",
    "replay",
    "metrics",
    "fabric",
    "attribution",
    "validation",
    "raw_evidence",
    "evidence_agent",
    "evidence_lab",
    "design_space",
    "history",
    "experiment",
)
_PUBLISHED_ALLOWED_PAGES = frozenset(_DEFAULT_ALLOWED_PAGES)
_PUBLISHED_ALLOWED_ACTIONS = frozenset({"explain", "navigate", "analyze", "report", "draft", "execute"})


def _validate_allow_list(value: Any, *, name: str, published: frozenset[str], default: tuple[str, ...]) -> list[str]:
    value = default if value is None else value
    if (
        not isinstance(value, (list, tuple))
        or not value
        or len(value) > 32
        or any(not isinstance(item, str) or not item.strip() for item in value)
        or len(set(value)) != len(value)
        or any(item not in published for item in value)
    ):
        raise AuthorizationError("invalid_authorization", f"{name} contains an unpublished or malformed value.", f"/{name}")
    return list(value)


def _validate_objective(objective: Any) -> dict[str, Any]:
    if not isinstance(objective, dict):
        raise AuthorizationError("invalid_objective", "Objective must be an object.", "/objective")
    allowed = {"metric_path", "direction", "minimum_improvement", "plateau_rounds"}
    unknown = sorted(set(objective) - allowed)
    if unknown:
        raise AuthorizationError("invalid_objective", "Objective is closed.", f"/objective/{unknown[0]}")
    metric_path = _require_nonempty_string(objective.get("metric_path"), "/objective/metric_path")
    if not metric_path.startswith("/") or _is_protected_pointer(metric_path):
        raise AuthorizationError("protected_field", "Objective cannot target a protected field.", "/objective/metric_path")
    direction = objective.get("direction")
    if direction not in {"minimize", "maximize"}:
        raise AuthorizationError("invalid_objective", "Objective direction must be minimize or maximize.", "/objective/direction")
    minimum_improvement = objective.get("minimum_improvement", 0.0)
    if isinstance(minimum_improvement, bool) or not isinstance(minimum_improvement, (int, float)) or not math.isfinite(float(minimum_improvement)) or minimum_improvement < 0:
        raise AuthorizationError("invalid_objective", "minimum_improvement must be non-negative.", "/objective/minimum_improvement")
    plateau_rounds = objective.get("plateau_rounds", 3)
    if isinstance(plateau_rounds, bool) or not isinstance(plateau_rounds, int) or plateau_rounds < 1 or plateau_rounds > 20:
        raise AuthorizationError("invalid_objective", "plateau_rounds is outside the local-dev bound.", "/objective/plateau_rounds")
    return {
        "metric_path": metric_path,
        "direction": direction,
        "minimum_improvement": minimum_improvement,
        "plateau_rounds": plateau_rounds,
    }


def _published_tool_names() -> set[str]:
    """Return the closed gateway registry without creating an import cycle.

    Authorization envelopes are pure values, but their tool allow-list still
    has to be bounded by the actual gateway.  Importing lazily keeps the
    authorization module usable while the harness package is initializing;
    an import failure is treated as an empty registry (fail closed).
    """

    try:
        from .tools import TOOL_DEFINITIONS
    except (ImportError, AttributeError):  # pragma: no cover - package bootstrap
        return set()
    return set(TOOL_DEFINITIONS)


def _validate_tool_allowlist(value: Any) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() for item in value)
        or len(set(value)) != len(value)
    ):
        raise AuthorizationError("invalid_tool_allowlist", "tool_allowlist must contain unique tool names.", "/tool_allowlist")
    published = _published_tool_names()
    for index, name in enumerate(value):
        if name not in published:
            raise AuthorizationError(
                "invalid_tool_allowlist",
                "tool_allowlist contains an unpublished gateway tool.",
                f"/tool_allowlist/{index}",
            )
    return list(value)


def validate_authorization(body: Any, *, session: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalize an authorization request before it is issued.

    This is deliberately separate from :func:`issue_authorization`: callers can
    validate a user-facing request without minting an id, timestamp, or digest.
    The HTTP adapter uses the returned closed projection and then lets
    ``issue_authorization`` stamp all identity/provenance fields from ``session``.
    """

    if not isinstance(body, dict):
        raise AuthorizationError("invalid_authorization", "Authorization input must be an object.")
    allowed = {
        "autonomy_level",
        "budget",
        "parameter_grants",
        "objective",
        "tool_allowlist",
        "allowed_pages",
        "allowed_actions",
        "ttl_seconds",
    }
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise AuthorizationError("unknown_field", "Authorization input is closed.", f"/{unknown[0]}")
    autonomy_level = body.get("autonomy_level", "human_approves_each")
    if autonomy_level not in AUTONOMY_LEVELS:
        raise AuthorizationError("invalid_autonomy_level", "Unknown autonomy level.", "/autonomy_level")
    grants = _validate_grants(body.get("parameter_grants", []))
    objective = _validate_objective(body.get("objective", session.get("objective")))
    # Runtime authority must be explicit at issuance time. Defaults are not a
    # permission source: a missing model/tool/navigation/run/time limit fails
    # closed instead of silently widening the caller's grant.
    budget = _validate_budget(body.get("budget", {}), require_agent_call_limits=True)
    tool_allowlist = _validate_tool_allowlist(body.get("tool_allowlist", ["query_verified_metrics", "list_run_evidence"]))
    allowed_pages = _validate_allow_list(
        body.get("allowed_pages"), name="allowed_pages", published=_PUBLISHED_ALLOWED_PAGES, default=()
    )
    allowed_actions = _validate_allow_list(
        body.get("allowed_actions"), name="allowed_actions", published=_PUBLISHED_ALLOWED_ACTIONS, default=()
    )
    ttl_seconds = body.get("ttl_seconds", DEFAULT_AUTHORIZATION_TTL_SECONDS)
    if isinstance(ttl_seconds, bool) or not isinstance(ttl_seconds, int) or ttl_seconds < 1 or ttl_seconds > MAX_AUTHORIZATION_TTL_SECONDS:
        raise AuthorizationError("invalid_ttl", "Authorization TTL is outside the local-dev bound.", "/ttl_seconds")
    return {
        "autonomy_level": autonomy_level,
        "parameter_grants": grants,
        "objective": objective,
        "budget": budget,
        "tool_allowlist": list(tool_allowlist),
        "allowed_pages": allowed_pages,
        "allowed_actions": allowed_actions,
        "ttl_seconds": ttl_seconds,
    }


def authorization_digest(document: dict[str, Any]) -> str:
    """Return the canonical digest over every authorization field but itself."""
    if not isinstance(document, dict):
        raise AuthorizationError("invalid_authorization", "Authorization must be an object.")
    unsigned = copy.deepcopy(document)
    unsigned.pop("authorization_digest", None)
    return canonical_sha256(unsigned)


def issue_authorization(*, session: dict[str, Any], grants: Any, objective: Any, budget: Any,
                        tool_allowlist: Any, autonomy_level: str, issued_by: str,
                        allowed_pages: Any = None, allowed_actions: Any = None,
                        ttl_seconds: int = DEFAULT_AUTHORIZATION_TTL_SECONDS) -> dict[str, Any]:
    """Create a bound, immutable authorization envelope without performing I/O."""
    if not isinstance(session, dict):
        raise AuthorizationError("invalid_session", "Session must be an object.", "/session")
    principal = _require_nonempty_string(session.get("principal"), "/session/principal")
    workspace_id = _require_nonempty_string(session.get("workspace_id"), "/session/workspace_id")
    session_id = _require_nonempty_string(session.get("session_id"), "/session/session_id")
    schema_set_revision = _require_nonempty_string(session.get("schema_set_revision"), "/session/schema_set_revision")
    input_snapshot_digest = _require_digest(session.get("input_snapshot_digest"), "/session/input_snapshot_digest")
    backend_identity = session.get("backend_identity")
    if not isinstance(backend_identity, (dict, str)) or not backend_identity:
        raise AuthorizationError("invalid_session", "Session backend_identity is required.", "/session/backend_identity")
    if issued_by != principal:
        raise AuthorizationError("principal_mismatch", "Only the bound principal may issue authorization.", "/issued_by")
    if autonomy_level not in AUTONOMY_LEVELS:
        raise AuthorizationError("invalid_autonomy_level", "Unknown autonomy level.", "/autonomy_level")
    if isinstance(ttl_seconds, bool) or not isinstance(ttl_seconds, int) or ttl_seconds < 1 or ttl_seconds > MAX_AUTHORIZATION_TTL_SECONDS:
        raise AuthorizationError("invalid_ttl", "Authorization TTL is outside the local-dev bound.", "/ttl_seconds")
    normalized_grants = _validate_grants(grants)
    normalized_objective = _validate_objective(objective)
    # The signed envelope is the runtime authority. Do not repair missing
    # limits here; the issuer must explicitly choose every bounded field.
    normalized_budget = _validate_budget(budget, require_agent_call_limits=True)
    tool_allowlist = _validate_tool_allowlist(tool_allowlist)
    normalized_allowed_pages = _validate_allow_list(
        allowed_pages, name="allowed_pages", published=_PUBLISHED_ALLOWED_PAGES, default=()
    )
    normalized_allowed_actions = _validate_allow_list(
        allowed_actions, name="allowed_actions", published=_PUBLISHED_ALLOWED_ACTIONS, default=()
    )
    issued_at = _now()
    protected = {
        "source_mode": PROVENANCE["source_mode"],
        "claim_scope": PROVENANCE["claim_scope"],
        "schema_set_revision": schema_set_revision,
        "backend_identity": copy.deepcopy(backend_identity),
    }
    document: dict[str, Any] = {
        "schema_identity": SCHEMA_IDENTITY,
        "contract_revision": AUTHORIZATION_CONTRACT_REVISION,
        "authorization_id": f"authz-{uuid.uuid4().hex}",
        "session_id": session_id,
        "principal": principal,
        "workspace_id": workspace_id,
        "schema_set_revision": schema_set_revision,
        "backend_identity": copy.deepcopy(backend_identity),
        "input_snapshot_digest": input_snapshot_digest,
        "autonomy_level": autonomy_level,
        "budget": normalized_budget,
        "parameter_grants": normalized_grants,
        "objective": normalized_objective,
        "tool_allowlist": list(tool_allowlist),
        "allowed_pages": normalized_allowed_pages,
        "allowed_actions": normalized_allowed_actions,
        "protected": protected,
        "status": "active",
        "issued_by": principal,
        "issued_at": _timestamp(issued_at),
        "expires_at": _timestamp(issued_at + timedelta(seconds=ttl_seconds)),
        "revoked_at": None,
        "provenance": copy.deepcopy(PROVENANCE),
    }
    document["authorization_digest"] = authorization_digest(document)
    return document


def verify_authorization(document: dict[str, Any], *, session: dict[str, Any], principal: str,
                         workspace_id: str, schema_set_revision: str, backend_identity: Any) -> dict[str, Any]:
    """Verify the envelope's digest, time and identity binding without repairing it."""
    def invalid(code: str) -> dict[str, Any]:
        return {"valid": False, "code": code}

    if not isinstance(document, dict) or not isinstance(session, dict):
        return invalid("authorization_invalid")
    unknown = sorted(set(document) - _ENVELOPE_FIELDS)
    if unknown:
        return invalid("unknown_field")
    if document.get("schema_identity") != SCHEMA_IDENTITY or _contract_revision(document) != AUTHORIZATION_CONTRACT_REVISION:
        return invalid("schema_revision_mismatch")
    if document.get("authorization_digest") != authorization_digest(document):
        return invalid("authorization_digest_mismatch")
    if document.get("status") != "active":
        return invalid("authorization_inactive")
    if document.get("autonomy_level") not in AUTONOMY_LEVELS:
        return invalid("invalid_autonomy_level")
    if not isinstance(document.get("authorization_id"), str) or not document["authorization_id"].startswith("authz-"):
        return invalid("authorization_invalid")
    expires_at = _parse_timestamp(document.get("expires_at"))
    issued_at = _parse_timestamp(document.get("issued_at"))
    if expires_at is None or issued_at is None:
        return invalid("authorization_invalid")
    if expires_at <= _now():
        return invalid("authorization_expired")
    if expires_at <= issued_at:
        return invalid("authorization_invalid")
    if (expires_at - issued_at).total_seconds() > MAX_AUTHORIZATION_TTL_SECONDS:
        return invalid("invalid_ttl")
    expected = {
        "session_id": session.get("session_id"),
        "principal": principal,
        "workspace_id": workspace_id,
        "schema_set_revision": schema_set_revision,
        "backend_identity": backend_identity,
        "input_snapshot_digest": session.get("input_snapshot_digest"),
    }
    for key, value in expected.items():
        if document.get(key) != value:
            return invalid({
                "session_id": "session_mismatch",
                "principal": "principal_mismatch",
                "workspace_id": "workspace_mismatch",
                "schema_set_revision": "schema_revision_mismatch",
                "backend_identity": "backend_identity_mismatch",
                "input_snapshot_digest": "snapshot_mismatch",
            }[key])
    if document.get("issued_by") != principal:
        return invalid("principal_mismatch")
    protected = document.get("protected")
    if not isinstance(protected, dict):
        return invalid("protected_field")
    unknown_protected = sorted(set(protected) - {"source_mode", "claim_scope", "schema_set_revision", "backend_identity"})
    if unknown_protected:
        return invalid("unknown_field")
    if protected.get("source_mode") != PROVENANCE["source_mode"] or document.get("provenance") != PROVENANCE:
        return invalid("protected_field")
    if protected.get("claim_scope") != PROVENANCE["claim_scope"]:
        return invalid("protected_field")
    if protected.get("schema_set_revision") != schema_set_revision:
        return invalid("schema_revision_mismatch")
    if protected.get("backend_identity") != backend_identity:
        return invalid("backend_identity_mismatch")
    try:
        _validate_grants(document.get("parameter_grants"))
        _validate_objective(document.get("objective"))
        # Do not migrate missing limits during verification.  An authorization
        # persisted before the explicit-call-budget rule is not executable;
        # callers must issue a fresh envelope instead.
        _validate_budget(document.get("budget"), require_agent_call_limits=True)
        _validate_tool_allowlist(document.get("tool_allowlist"))
        _validate_allow_list(
            document.get("allowed_pages"), name="allowed_pages", published=_PUBLISHED_ALLOWED_PAGES, default=()
        )
        _validate_allow_list(
            document.get("allowed_actions"), name="allowed_actions", published=_PUBLISHED_ALLOWED_ACTIONS, default=()
        )
    except AuthorizationError as error:
        return invalid(error.code)
    return {"valid": True, "code": None}


def revoke_authorization(document: dict[str, Any], *, actor: str) -> dict[str, Any]:
    """Return a revoked copy; repeated revocation by the issuer is idempotent."""
    if not isinstance(document, dict):
        raise AuthorizationError("authorization_invalid", "Authorization must be an object.")
    if actor != document.get("issued_by"):
        raise AuthorizationError("revoke_forbidden", "Only the issuing principal may revoke authorization.", "/issued_by")
    revoked = copy.deepcopy(document)
    if revoked.get("status") == "revoked":
        return revoked
    revoked["status"] = "revoked"
    revoked["revoked_at"] = _timestamp(_now())
    revoked["authorization_digest"] = authorization_digest(revoked)
    return revoked


__all__ = [
    "AUTHORIZATION_STATUSES",
    "AUTHORIZATION_CONTRACT_REVISION",
    "AUTONOMY_LEVELS",
    "AuthorizationError",
    "DEFAULT_AUTHORIZATION_TTL_SECONDS",
    "MAX_AUTHORIZATION_TTL_SECONDS",
    "PROVENANCE",
    "SCHEMA_IDENTITY",
    "authorization_digest",
    "validate_authorization",
    "issue_authorization",
    "revoke_authorization",
    "verify_authorization",
]
