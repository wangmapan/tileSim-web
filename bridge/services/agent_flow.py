"""Independent durable adapter for the single LangGraph-oriented flow.

The adapter owns HTTP-facing identity and approval semantics while the graph
nodes remain in :mod:`services.agent_orchestrator`.  It never creates runs,
writes experiment configuration, invokes a Provider, or exposes hidden model
output.  State is written after every transition so a process restart resumes
from the last durable event rather than guessing.
"""

from __future__ import annotations

import hashlib
import json
import re
import threading
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from repositories.agent_flows import AgentFlowStore, AgentFlowStoreError, utc_now
from services.agent_orchestrator import (
    LangGraphRuntimeUnavailable,
    SUPPORTED_INTENTS,
    TERMINAL_STATUSES,
    binding_matches,
    new_state,
    resume as orchestrator_resume,
    run_until_pause,
    page_directory,
)


FLOW_START_SCHEMA_IDENTITY = "tilesim.agent_flow.start_request.v1"
FLOW_RESUME_SCHEMA_IDENTITY = "tilesim.agent_flow.resume_request.v1"
FLOW_SCHEMA_IDENTITY = "tilesim.agent_flow.state.v1"
FLOW_EVENT_SCHEMA_IDENTITY = "tilesim.agent_flow.event.v1"
FLOW_ERROR_SCHEMA_IDENTITY = "tilesim.agent_flow.error.v1"
FLOW_CONTRACT_REVISION = "2026-10-28.flow.v2"
FLOW_POLICY_REVISION = "tilesim.agent_flow.policy.v1"
FLOW_STATUSES = frozenset({
    "created", "running", "waiting_user", "completed", "draft_ready",
    "stale", "refused", "cancelled", "failed",
})
FLOW_TERMINAL_STATUSES = frozenset({"completed", "draft_ready", "stale", "refused", "cancelled", "failed"})
FLOW_ACTIONS = frozenset({"clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation", "cancel", "reject"})
FLOW_SCOPES = frozenset({"agent:start_flow", "agent:read_flow", "agent:resume_flow"})
_FLOW_ID = re.compile(r"^flow-[A-Za-z0-9]+$")
_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
_ARTIFACT_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_AUTHORIZATION_ID = re.compile(r"^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_AUTHORIZATION_BUDGET_LIMITS = {
    "max_navigation_attempts": 8,
    "max_model_calls": 60,
    "max_tool_calls_per_round": 4,
    "max_run_creations": 1,
    "max_execution_time_ms": 3_600_000,
}

_CANONICAL_TO_ORCHESTRATOR = {
    "explain": "explain_current_page",
    "existing_run_analysis": "analyze_existing_run",
    "user_report": "generate_user_run_report",
    "configuration_draft": "configure_experiment_draft",
    "navigation": "navigate_page",
    "unsupported_execution": "unsupported_execution_request",
}
_ORCHESTRATOR_TO_CANONICAL = {value: key for key, value in _CANONICAL_TO_ORCHESTRATOR.items()}


class AgentFlowError(AgentFlowStoreError):
    """Contract-visible flow failure with a stable JSON code."""

    def __init__(self, code: str, message: str, *, status: int = 400, retryable: bool = False, field_path: str = "/"):
        super().__init__(code, message, status=status, retryable=retryable)
        self.field_path = field_path


def _validate_flow_id(value: Any, field_path: str = "/flow_id") -> None:
    """Keep URL/state flow identities aligned with the published FlowId schema."""

    if not isinstance(value, str) or len(value) > 128 or not _FLOW_ID.fullmatch(value):
        raise AgentFlowError(
            "invalid_field",
            "flow_id must match the published flow-[A-Za-z0-9]+ identity pattern.",
            field_path=field_path,
        )


def _validate_navigation_start_fields(document: dict[str, Any]) -> None:
    """Validate optional navigation observations before they enter durable state."""

    published_pages = {entry["page_id"] for entry in page_directory()}
    published_actions = {"explain", "navigate", "analyze", "report", "draft", "execute"}
    if "current_page" in document and document["current_page"] is not None:
        if not isinstance(document["current_page"], str) or document["current_page"] not in published_pages:
            raise AgentFlowError("invalid_field", "current_page is not a published page id.", field_path="/current_page")
    list_fields = {
        "current_page_capabilities": False,
        "required_capabilities": False,
        "allowed_pages": True,
        "allowed_actions": False,
    }
    for field, pages_only in list_fields.items():
        if field not in document:
            continue
        value = document[field]
        if not isinstance(value, list) or len(value) > 32:
            raise AgentFlowError("invalid_field", f"{field} must be a bounded unique string list.", field_path=f"/{field}")
        if any(not isinstance(item, str) or not item or len(item) > 128 for item in value):
            raise AgentFlowError("invalid_field", f"{field} contains an invalid item.", field_path=f"/{field}")
        if len(set(value)) != len(value):
            raise AgentFlowError("invalid_field", f"{field} must contain unique items.", field_path=f"/{field}")
        if pages_only and any(item not in published_pages for item in value):
            raise AgentFlowError("invalid_field", f"{field} contains an unpublished page.", field_path=f"/{field}")
        if field == "allowed_actions" and any(item not in published_actions for item in value):
            raise AgentFlowError("invalid_field", f"{field} contains an unpublished action.", field_path=f"/{field}")
    for field in ("navigation_attempts", "max_navigation_attempts"):
        if field not in document:
            continue
        value = document[field]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 8:
            raise AgentFlowError("invalid_field", f"{field} must be an integer from 0 to 8.", field_path=f"/{field}")
    if "current_context_revision" in document and document["current_context_revision"] is not None:
        value = document["current_context_revision"]
        if not isinstance(value, str) or not value or len(value) > 256:
            raise AgentFlowError("invalid_field", "current_context_revision is invalid.", field_path="/current_context_revision")
    if document.get("intent") == "navigation":
        allowed_pages = document.get("allowed_pages")
        allowed_actions = document.get("allowed_actions")
        max_attempts = document.get("max_navigation_attempts")
        if not isinstance(allowed_pages, list) or not allowed_pages:
            raise AgentFlowError("authorization_required", "navigation requires an explicit allowed_pages list.", status=403, field_path="/allowed_pages")
        if not isinstance(allowed_actions, list) or "navigate" not in allowed_actions or any(action != "navigate" for action in allowed_actions):
            raise AgentFlowError("authorization_required", "navigation requires the explicit navigate action grant.", status=403, field_path="/allowed_actions")
        if isinstance(max_attempts, bool) or not isinstance(max_attempts, int) or max_attempts <= 0:
            raise AgentFlowError("authorization_required", "navigation requires a positive max_navigation_attempts budget.", status=403, field_path="/max_navigation_attempts")
        published_by_id = {entry["page_id"]: entry for entry in page_directory()}
        if any("run_bound" in published_by_id[page]["capabilities"] for page in allowed_pages):
            if not isinstance(document.get("run_id"), str) or not document.get("run_id") or not isinstance(document.get("run_context_revision"), str) or not document.get("run_context_revision"):
                raise AgentFlowError("binding_required", "run-bound navigation pages require run identity binding.", field_path="/run_id")


def _authorization_material(document: dict[str, Any]) -> dict[str, Any]:
    """Return the closed, digestable authorization material for a flow.

    The browser may propose a navigation envelope, but the Bridge is the
    authority that validates and persists it.  Keeping this material small and
    deterministic lets the resume path compare one immutable digest without
    persisting arbitrary client metadata or model output.
    """

    return {
        "authorization_id": document.get("authorization_id"),
        "budget": deepcopy(document.get("authorization_budget")),
        "allowed_pages": deepcopy(document.get("allowed_pages")),
        "allowed_actions": deepcopy(document.get("allowed_actions")),
    }


def _validate_authorization_start_fields(document: dict[str, Any]) -> dict[str, Any] | None:
    """Validate an explicit immutable flow authorization envelope.

    Navigation is the only flow action currently carrying an authorization
    envelope.  It must include every budget field and the digest must cover the
    exact page/action allow-list; omitted or partial values fail closed rather
    than falling back to a local default.
    """

    auth_fields = {"authorization_id", "authorization_digest", "authorization_budget"}
    supplied = auth_fields.intersection(document)
    if not supplied:
        if document.get("intent") == "navigation":
            raise AgentFlowError(
                "authorization_required",
                "navigation requires an explicit authorization envelope.",
                status=403,
                field_path="/authorization_digest",
            )
        return None
    missing = sorted(auth_fields - set(document))
    if missing:
        raise AgentFlowError("authorization_required", "Authorization envelope is incomplete.", status=403, field_path=f"/{missing[0]}")
    authorization_id = document.get("authorization_id")
    if not isinstance(authorization_id, str) or not _AUTHORIZATION_ID.fullmatch(authorization_id):
        raise AgentFlowError("invalid_field", "authorization_id is invalid.", field_path="/authorization_id")
    digest = document.get("authorization_digest")
    _validate_digest(digest, "/authorization_digest", nullable=False)
    budget = document.get("authorization_budget")
    if not isinstance(budget, dict):
        raise AgentFlowError("invalid_field", "authorization_budget must be an object.", field_path="/authorization_budget")
    expected_fields = set(_AUTHORIZATION_BUDGET_LIMITS)
    unknown = sorted(set(budget) - expected_fields)
    if unknown:
        raise AgentFlowError("unknown_field", "authorization_budget is closed.", field_path=f"/authorization_budget/{unknown[0]}")
    missing_budget = sorted(expected_fields - set(budget))
    if missing_budget:
        raise AgentFlowError("authorization_required", "Authorization budget is incomplete.", status=403, field_path=f"/authorization_budget/{missing_budget[0]}")
    normalized_budget: dict[str, int] = {}
    for name, maximum in _AUTHORIZATION_BUDGET_LIMITS.items():
        value = budget[name]
        if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > maximum:
            raise AgentFlowError("invalid_field", f"{name} must be a positive integer within the local-dev bound.", field_path=f"/authorization_budget/{name}")
        normalized_budget[name] = value
    expected_digest = canonical_sha256({
        "authorization_id": authorization_id,
        "budget": normalized_budget,
        # Allow-list order is not permission.  Normalize it before hashing so
        # the durable graph (which stores page ids canonically sorted) and the
        # issuing client sign the same immutable envelope.
        "allowed_pages": sorted(document.get("allowed_pages") or []),
        "allowed_actions": sorted(document.get("allowed_actions") or []),
    })
    if digest != expected_digest:
        raise AgentFlowError("authorization_digest_mismatch", "Authorization digest does not match the immutable flow envelope.", status=409, field_path="/authorization_digest")
    # ``max_navigation_attempts`` also exists at the flow-state level because
    # the deterministic navigation graph consumes it directly. Bind that
    # unsigned state field to the signed authorization budget so a caller
    # cannot authorize one attempt while presenting a larger graph budget.
    if document.get("intent") == "navigation":
        declared_attempts = document.get("max_navigation_attempts")
        if (
            isinstance(declared_attempts, bool)
            or not isinstance(declared_attempts, int)
            or declared_attempts > normalized_budget["max_navigation_attempts"]
        ):
            raise AgentFlowError(
                "authorization_budget_mismatch",
                "max_navigation_attempts cannot exceed the signed authorization budget.",
                status=409,
                field_path="/max_navigation_attempts",
            )
    if document.get("intent") == "navigation" and (not isinstance(document.get("allowed_pages"), list) or not isinstance(document.get("allowed_actions"), list)):
        raise AgentFlowError("authorization_required", "Navigation authorization must bind its page and action allow-lists.", status=403, field_path="/allowed_pages")
    return {"authorization_id": authorization_id, "authorization_digest": digest, "authorization_budget": normalized_budget}


_NAVIGATION_FAILURE_TYPES = {
    None,
    "navigation_error",
    "context_unavailable",
    "context_invalid",
    "page_mismatch",
    "capability_missing",
    "stale_identity",
}


def _validate_navigation_observation(
    value: Any,
    *,
    field_path: str = "/navigation_observation",
    allowed_pages: Any = None,
    required_capabilities: Any = None,
    max_attempts: int | None = None,
) -> dict[str, Any]:
    """Validate a browser navigation observation before it enters durable state.

    The browser is the only component that can actually perform a route
    transition.  Its observation is therefore treated as untrusted input: it
    may contain published page identities and bounded capabilities only, never
    a URL, router command, or arbitrary callback name.
    """

    if not isinstance(value, dict):
        raise AgentFlowError("invalid_field", "navigation_observation must be an object.", field_path=field_path)
    required = {
        "target_page", "actual_page", "page_correct", "current_page_capabilities",
        "current_run_id", "current_context_revision", "failure_type", "retry_allowed",
        "visited_pages", "navigation_attempts",
    }
    unknown = sorted(set(value) - required)
    missing = sorted(required - set(value))
    if unknown:
        raise AgentFlowError("unknown_field", "navigation_observation is closed.", field_path=f"{field_path}/{unknown[0]}")
    if missing:
        raise AgentFlowError("invalid_field", "navigation_observation is incomplete.", field_path=f"{field_path}/{missing[0]}")
    published_pages = {entry["page_id"] for entry in page_directory()}
    target = value.get("target_page")
    actual = value.get("actual_page")
    if not isinstance(target, str) or target not in published_pages:
        raise AgentFlowError("invalid_field", "navigation target is not published.", field_path=f"{field_path}/target_page")
    if actual is not None and (not isinstance(actual, str) or actual not in published_pages):
        raise AgentFlowError("invalid_field", "navigation actual page is not published.", field_path=f"{field_path}/actual_page")
    if allowed_pages is not None and target not in set(allowed_pages):
        raise AgentFlowError("authorization_denied", "navigation target is outside the authorized page list.", status=403, field_path=f"{field_path}/target_page")
    if type(value.get("page_correct")) is not bool or type(value.get("retry_allowed")) is not bool:
        raise AgentFlowError("invalid_field", "navigation booleans are invalid.", field_path=field_path)
    capabilities = value.get("current_page_capabilities")
    if not isinstance(capabilities, list) or len(capabilities) > 32 or any(not isinstance(item, str) or not item or len(item) > 128 for item in capabilities) or len(set(capabilities)) != len(capabilities):
        raise AgentFlowError("invalid_field", "current_page_capabilities is invalid.", field_path=f"{field_path}/current_page_capabilities")
    if actual is None and capabilities:
        raise AgentFlowError(
            "invalid_field",
            "A missing actual page cannot claim page capabilities.",
            field_path=f"{field_path}/current_page_capabilities",
        )
    if actual is not None:
        published_capabilities = next(
            (set(entry["capabilities"]) for entry in page_directory() if entry["page_id"] == actual),
            set(),
        )
        if not set(capabilities).issubset(published_capabilities):
            raise AgentFlowError(
                "invalid_field",
                "current_page_capabilities are not published for the actual page.",
                field_path=f"{field_path}/current_page_capabilities",
            )
    visited = value.get("visited_pages")
    if not isinstance(visited, list) or len(visited) > 8 or any(not isinstance(item, str) or item not in published_pages for item in visited) or len(set(visited)) != len(visited):
        raise AgentFlowError("invalid_field", "visited_pages is invalid.", field_path=f"{field_path}/visited_pages")
    attempts = value.get("navigation_attempts")
    if isinstance(attempts, bool) or not isinstance(attempts, int) or attempts < 0 or attempts > 8:
        raise AgentFlowError("invalid_field", "navigation_attempts is invalid.", field_path=f"{field_path}/navigation_attempts")
    if attempts != len(visited):
        raise AgentFlowError("invalid_field", "navigation_attempts must match the unique visited page count.", field_path=f"{field_path}/navigation_attempts")
    if target not in visited:
        raise AgentFlowError("invalid_field", "visited_pages must include the target page.", field_path=f"{field_path}/visited_pages")
    if allowed_pages is not None and any(page not in set(allowed_pages) for page in visited):
        raise AgentFlowError("authorization_denied", "visited_pages contains an unauthorized page.", status=403, field_path=f"{field_path}/visited_pages")
    if max_attempts is not None and attempts > max_attempts:
        raise AgentFlowError("invalid_field", "navigation_attempts exceeds the authorized budget.", field_path=f"{field_path}/navigation_attempts")
    for field, max_length in (("current_run_id", 128), ("current_context_revision", 256)):
        item = value.get(field)
        if item is not None and (not isinstance(item, str) or not item or len(item) > max_length):
            raise AgentFlowError("invalid_field", f"{field} is invalid.", field_path=f"{field_path}/{field}")
    if value.get("failure_type") not in _NAVIGATION_FAILURE_TYPES:
        raise AgentFlowError("invalid_field", "navigation failure type is not published.", field_path=f"{field_path}/failure_type")
    if value.get("page_correct") and (actual != target or value.get("failure_type") is not None):
        raise AgentFlowError("invalid_field", "a correct navigation must match its target without a failure.", field_path=field_path)
    required = {item for item in (required_capabilities or []) if isinstance(item, str)}
    if value.get("page_correct") and not required.issubset(set(capabilities)):
        raise AgentFlowError("invalid_field", "a correct navigation is missing a required capability.", field_path=f"{field_path}/current_page_capabilities")
    return deepcopy(value)


def _validate_runtime_navigation_state(state: dict[str, Any]) -> None:
    """Fail closed before optional runtime state reaches ``_canonical_state``."""

    published_pages = {entry["page_id"] for entry in page_directory()}
    for field in ("current_page", "navigation_target"):
        value = state.get(field)
        if value is not None and (not isinstance(value, str) or value not in published_pages):
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation page is not published.", status=409, field_path=f"/state/{field}")
    for field in ("current_page_capabilities", "required_capabilities", "allowed_actions"):
        value = state.get(field, [])
        if not isinstance(value, list) or len(value) > 32 or any(not isinstance(item, str) or not item or len(item) > 128 for item in value) or len(set(value)) != len(value):
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation capability state is invalid.", status=409, field_path=f"/state/{field}")
    for field in ("allowed_pages", "visited_pages"):
        value = state.get(field, [])
        if not isinstance(value, list) or len(value) > (8 if field == "visited_pages" else 32) or any(not isinstance(item, str) or item not in published_pages for item in value) or len(set(value)) != len(value):
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation page state is invalid.", status=409, field_path=f"/state/{field}")
    for field in ("navigation_attempts", "max_navigation_attempts"):
        value = state.get(field, 0)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 8:
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation budget is invalid.", status=409, field_path=f"/state/{field}")
    if state.get("navigation_attempts", 0) > state.get("max_navigation_attempts", 0):
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            "LangGraph navigation usage exceeds its durable attempt budget.",
            status=409,
            field_path="/state/navigation_attempts",
        )
    if state.get("navigation_attempts", 0) < len(state.get("visited_pages", [])):
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            "LangGraph navigation usage is behind its durable visited-page history.",
            status=409,
            field_path="/state/navigation_attempts",
        )
    for field in ("model_calls", "tool_calls_per_round", "run_creations", "execution_time_ms"):
        value = state.get(field, 0)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph usage counter is invalid.", status=409, field_path=f"/state/{field}")
    failures = state.get("navigation_failures", [])
    if not isinstance(failures, list) or len(failures) > 8:
        raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation failures are invalid.", status=409, field_path="/state/navigation_failures")
    for index, failure in enumerate(failures):
        if not isinstance(failure, dict) or set(failure) - {"page", "type", "detail"} or not isinstance(failure.get("page"), str) or failure["page"] not in published_pages or not isinstance(failure.get("type"), str) or not failure["type"] or len(failure["type"]) > 64 or ("detail" in failure and (not isinstance(failure["detail"], str) or len(failure["detail"]) > 160)):
            raise AgentFlowError("langgraph_checkpoint_mismatch", "LangGraph navigation failure is invalid.", status=409, field_path=f"/state/navigation_failures/{index}")
    if state.get("last_navigation_observation") is not None:
        _validate_navigation_observation(
            state["last_navigation_observation"],
            field_path="/state/last_navigation_observation",
            allowed_pages=state.get("allowed_pages", []),
            required_capabilities=state.get("required_capabilities", []),
            max_attempts=state.get("max_navigation_attempts"),
        )
    authorization_status = state.get("authorization_status", "active")
    if authorization_status not in {"active", "revoked", "expired", "exhausted"}:
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            "LangGraph authorization status is not published.",
            status=409,
            field_path="/state/authorization_status",
        )
    if state.get("authorization_digest") is not None or state.get("authorization_id") is not None or state.get("authorization_budget") is not None:
        canonical_intent = _ORCHESTRATOR_TO_CANONICAL.get(str(state.get("intent") or ""), "unsupported_execution")
        _validate_authorization_start_fields({
            "intent": canonical_intent,
            "authorization_id": state.get("authorization_id"),
            "authorization_digest": state.get("authorization_digest"),
            "authorization_budget": state.get("authorization_budget"),
            "allowed_pages": state.get("allowed_pages"),
            "allowed_actions": state.get("allowed_actions"),
            "max_navigation_attempts": state.get("max_navigation_attempts"),
        })
        budget = state.get("authorization_budget")
        if (
            isinstance(budget, dict)
            and _ORCHESTRATOR_TO_CANONICAL.get(str(state.get("intent") or "")) == "navigation"
            and isinstance(state.get("max_navigation_attempts"), int)
            and state.get("max_navigation_attempts") > budget.get("max_navigation_attempts", 0)
        ):
            raise AgentFlowError(
                "langgraph_checkpoint_mismatch",
                "LangGraph navigation budget exceeds the durable authorization budget.",
                status=409,
                field_path="/state/max_navigation_attempts",
            )
        budget = state.get("authorization_budget")
        if isinstance(budget, dict):
            usage_limits = {
                "model_calls": budget.get("max_model_calls"),
                "tool_calls_per_round": budget.get("max_tool_calls_per_round"),
                "run_creations": budget.get("max_run_creations"),
                "execution_time_ms": budget.get("max_execution_time_ms"),
            }
            for usage_name, limit in usage_limits.items():
                usage_value = state.get(usage_name, 0)
                if (
                    isinstance(limit, bool)
                    or not isinstance(limit, int)
                    or isinstance(usage_value, bool)
                    or not isinstance(usage_value, int)
                    or usage_value < 0
                ):
                    raise AgentFlowError(
                        "langgraph_checkpoint_mismatch",
                        f"LangGraph authorization budget counter {usage_name} is invalid.",
                        status=409,
                        field_path=f"/state/{usage_name}",
                    )
                # Wall-clock usage can cross its deadline while the flow is
                # being observed; that is only valid once the server has
                # marked the authorization exhausted/expired. Other usage
                # counters must never exceed their signed budget.
                if usage_value > limit and not (
                    usage_name == "execution_time_ms"
                    and authorization_status in {"exhausted", "expired"}
                ):
                    raise AgentFlowError(
                        "langgraph_checkpoint_mismatch",
                        f"LangGraph authorization counter {usage_name} exceeds its budget.",
                        status=409,
                        field_path=f"/state/{usage_name}",
                    )


def _validate_durable_projection_state(
    state: Any,
    *,
    record_sequence: Any | None = None,
) -> None:
    """Validate a persisted state before projecting it to the public API.

    ``_validate_runtime_navigation_state`` protects states returned by the
    optional runtime.  A row loaded from SQLite has a different trust
    boundary: it may have been written by an older worker, manually damaged,
    or partially migrated.  Projection code must never coerce malformed
    counters to zero (or raise a raw ``ValueError``), because doing so would
    either hide an authorization/accounting violation or turn a recoverable
    checkpoint mismatch into an HTTP 500.

    Every failure is therefore normalized to the contract-visible
    ``langgraph_checkpoint_mismatch`` error.  The caller can safely use this
    validator from GET, event replay, restart and the resume time-budget
    fence before performing any integer conversion.
    """

    def mismatch(message: str, field_path: str = "/state") -> None:
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            message,
            status=409,
            field_path=field_path,
        )

    if not isinstance(state, dict):
        mismatch("Durable flow state is not an object.")

    event_sequence = state.get("event_sequence")
    if isinstance(event_sequence, bool) or not isinstance(event_sequence, int) or event_sequence < 0:
        mismatch("Durable flow event sequence is invalid.", "/state/event_sequence")

    if record_sequence is not None:
        if isinstance(record_sequence, bool) or not isinstance(record_sequence, int) or record_sequence < 0:
            mismatch("Durable flow record sequence is invalid.", "/record/sequence")
        if event_sequence != record_sequence:
            mismatch("Durable flow state and event sequence disagree.", "/state/event_sequence")

    # This validator already checks every navigation/authorization counter and
    # the immutable authorization envelope.  Translate its input errors into a
    # checkpoint mismatch because these values came from durable storage, not a
    # new request that the caller can correct in-place.
    try:
        _validate_runtime_navigation_state(state)
    except AgentFlowError as error:
        mismatch(
            f"Durable flow state is invalid: {error}",
            getattr(error, "field_path", "/state"),
        )


def canonical_sha256(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def _require_string(
    value: Any,
    field_path: str,
    *,
    nullable: bool = False,
    max_length: int | None = None,
) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not value.strip():
        raise AgentFlowError("invalid_field", "A non-empty string is required.", field_path=field_path)
    if max_length is not None and len(value) > max_length:
        raise AgentFlowError("invalid_field", "String length exceeds the published limit.", field_path=field_path)


def _validate_digest(value: Any, field_path: str, *, nullable: bool = True) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not _DIGEST.fullmatch(value):
        raise AgentFlowError("invalid_field", "Expected a sha256 digest.", field_path=field_path)


def _validate_artifact_sha256(value: Any, field_path: str) -> None:
    """Validate an artifact manifest digest, which is a bare SHA-256 hex string.

    Schema-set and input snapshot revisions use the ``sha256:`` tagged form,
    while artifact-manifest entries deliberately carry the raw 64-character
    digest.  Keeping these validators separate prevents a valid manifest from
    being rejected when it is used as a flow identity binding.
    """

    if not isinstance(value, str) or not _ARTIFACT_SHA256.fullmatch(value):
        raise AgentFlowError("invalid_field", "Artifact sha256 must be a 64-character hexadecimal digest.", field_path=field_path)


def validate_artifact_bindings(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 256:
        raise AgentFlowError("invalid_field", "artifact_bindings must be a bounded array.", field_path="/binding/artifact_bindings")
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        path = f"/binding/artifact_bindings/{index}"
        if not isinstance(item, dict):
            raise AgentFlowError("invalid_field", "Artifact binding must be an object.", field_path=path)
        unknown = sorted(set(item) - {"artifact_id", "schema_identity", "sha256", "bytes"})
        if unknown:
            raise AgentFlowError("unknown_field", "unknown artifact binding field.", field_path=f"{path}/{unknown[0]}")
        _require_string(item.get("artifact_id"), f"{path}/artifact_id", max_length=256)
        _require_string(item.get("schema_identity"), f"{path}/schema_identity", max_length=256)
        _require_string(item.get("sha256"), f"{path}/sha256", max_length=256)
        _validate_artifact_sha256(item.get("sha256"), f"{path}/sha256")
        bytes_value = item.get("bytes")
        if not (isinstance(bytes_value, str) and re.fullmatch(r"(?:0|[1-9][0-9]*)", bytes_value)):
            raise AgentFlowError("invalid_field", "Artifact bytes must be an unsigned decimal string.", field_path=f"{path}/bytes")
        result.append({"artifact_id": item["artifact_id"], "schema_identity": item["schema_identity"], "sha256": item["sha256"], "bytes": bytes_value})
    return result


def validate_binding(binding: Any, *, schema_set_revision: str, backend_identity: dict[str, Any], intent: str | None = None) -> dict[str, Any]:
    if binding is None:
        binding = {}
    if not isinstance(binding, dict):
        raise AgentFlowError("invalid_field", "binding must be an object.", field_path="/binding")
    unknown = sorted(set(binding) - {"session_id", "flow_id", "run_id", "run_context_revision", "backend_identity", "schema_set_revision", "input_snapshot_digest", "artifact_bindings"})
    if unknown:
        raise AgentFlowError("unknown_field", "Flow binding is closed.", field_path=f"/binding/{unknown[0]}")
    # These four fields are required by both the start and resume schemas.
    # Do not silently substitute the current Bridge identity when a caller
    # omits one: an incomplete binding would make a stale request appear
    # current and would violate the fail-closed identity contract.
    required_identity = ("backend_identity", "schema_set_revision", "input_snapshot_digest", "artifact_bindings")
    missing_identity = [key for key in required_identity if key not in binding]
    if missing_identity:
        raise AgentFlowError("binding_required", "Flow identity binding is incomplete.", field_path=f"/binding/{missing_identity[0]}")
    if not isinstance(binding.get("backend_identity"), dict):
        raise AgentFlowError("invalid_field", "backend_identity must be an object.", field_path="/binding/backend_identity")
    schema_value = binding.get("schema_set_revision")
    if not isinstance(schema_value, str) or not _DIGEST.fullmatch(schema_value):
        raise AgentFlowError("invalid_field", "schema_set_revision must be a sha256 digest.", field_path="/binding/schema_set_revision")
    if not isinstance(binding.get("artifact_bindings"), list):
        raise AgentFlowError("invalid_field", "artifact_bindings must be an array.", field_path="/binding/artifact_bindings")
    if "session_id" in binding and binding.get("session_id") is not None:
        _require_string(binding.get("session_id"), "/binding/session_id", max_length=128)
    if "flow_id" in binding and binding.get("flow_id") is not None:
        _require_string(binding.get("flow_id"), "/binding/flow_id", max_length=128)
    run_id = binding.get("run_id")
    context_revision = binding.get("run_context_revision")
    if run_id is not None:
        _require_string(run_id, "/binding/run_id", max_length=128)
        _require_string(context_revision, "/binding/run_context_revision", max_length=256)
    elif context_revision is not None:
        raise AgentFlowError("binding_required", "run_context_revision requires run_id.", field_path="/binding/run_context_revision")
    supplied_backend = binding.get("backend_identity")
    if supplied_backend is not None and supplied_backend != backend_identity:
        raise AgentFlowError("backend_identity_mismatch", "Flow backend identity does not match the current Bridge.", status=409, field_path="/binding/backend_identity")
    supplied_schema = binding.get("schema_set_revision")
    if supplied_schema is not None and supplied_schema != schema_set_revision:
        raise AgentFlowError("schema_revision_mismatch", "Flow schema-set revision is stale.", status=409, field_path="/binding/schema_set_revision")
    if intent in {"analyze_existing_run", "generate_user_run_report"} and (run_id is None or context_revision is None):
        raise AgentFlowError("binding_required", "Run-bound flow intents require run_id and run_context_revision.", field_path="/binding")
    input_digest = binding.get("input_snapshot_digest")
    _validate_digest(input_digest, "/binding/input_snapshot_digest")
    if intent in {"analyze_existing_run", "generate_user_run_report"} and input_digest is None:
        raise AgentFlowError(
            "binding_required",
            "Run-bound flow intents require a verified input_snapshot_digest.",
            field_path="/binding/input_snapshot_digest",
        )
    return {
        # Preserve the complete envelope when this validator is used for a
        # resume.  The pure orchestrator compares session/flow identity too;
        # dropping those two fields here would make the HTTP adapter unable to
        # enforce the same cross-thread fence.
        "session_id": binding.get("session_id"),
        "flow_id": binding.get("flow_id"),
        "run_id": run_id,
        "run_context_revision": context_revision,
        "backend_identity": deepcopy(supplied_backend if supplied_backend is not None else backend_identity),
        "schema_set_revision": supplied_schema if supplied_schema is not None else schema_set_revision,
        "input_snapshot_digest": input_digest,
        "artifact_bindings": validate_artifact_bindings(binding.get("artifact_bindings")),
    }


def _identity_binding(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "session_id": state.get("session_id"),
        "flow_id": state.get("flow_id"),
        "run_id": state.get("run_id"),
        "run_context_revision": state.get("run_context_revision"),
        "backend_identity": deepcopy(state.get("backend_identity")),
        "schema_set_revision": state.get("schema_set_revision"),
        "input_snapshot_digest": state.get("input_snapshot_digest"),
        "artifact_bindings": deepcopy(state.get("artifact_bindings") or []),
    }


def _elapsed_execution_ms(created_at: Any, *, now: str | None = None) -> int:
    """Read the server-owned wall-clock ledger for a durable flow.

    ``max_execution_time_ms`` is an authorization budget, so a browser-side
    deadline is only an advisory optimization.  The Bridge must derive usage
    from its durable creation timestamp before allowing another transition.
    Invalid persisted timestamps fail closed rather than silently resetting
    the ledger to zero.
    """

    if not isinstance(created_at, str) or not created_at:
        raise AgentFlowError("flow_timestamp_invalid", "Durable flow creation time is invalid.", status=409)
    try:
        started = datetime.fromisoformat(created_at)
        current = datetime.fromisoformat(now or utc_now())
    except (TypeError, ValueError) as error:
        raise AgentFlowError("flow_timestamp_invalid", "Durable flow creation time is invalid.", status=409) from error
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return max(0, int((current - started).total_seconds() * 1000))


def _merge_runtime_counter(
    runtime_state: dict[str, Any],
    previous_state: dict[str, Any],
    field: str,
) -> int:
    """Keep optional-runtime usage monotonic and fail closed on regressions.

    The deterministic adapter does not call a model or create a run, but the
    optional LangGraph adapter may.  Replacing its returned counters with the
    previous durable values would make those calls invisible to authorization
    accounting.  A checkpoint that regresses or emits a malformed counter is
    not safe to merge, so reject it before persisting the transition.
    """

    previous = previous_state.get(field, 0)
    candidate = runtime_state.get(field, previous)
    if (
        isinstance(previous, bool)
        or not isinstance(previous, int)
        or previous < 0
        or isinstance(candidate, bool)
        or not isinstance(candidate, int)
        or candidate < previous
    ):
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            f"LangGraph usage counter {field} is malformed or regressed.",
            status=409,
            field_path=f"/state/{field}",
        )
    runtime_state[field] = candidate
    return candidate


def _assert_runtime_authorization_unchanged(
    runtime_state: dict[str, Any],
    previous_state: dict[str, Any],
) -> None:
    """Keep the optional graph from changing the signed authorization envelope.

    The LangGraph checkpoint is an implementation detail, not an authority to
    issue permissions.  A buggy or stale runtime result must therefore never
    be allowed to drop the digest, widen an allow-list, or replace a budget
    before the Bridge persists the transition.  Server-owned budget exhaustion
    is applied after this fence, so the runtime status itself must remain the
    status that was durable when the transition began.
    """

    signed_fields = (
        "authorization_id",
        "authorization_digest",
        "authorization_budget",
        "allowed_pages",
        "allowed_actions",
    )
    for field in signed_fields:
        if runtime_state.get(field) != previous_state.get(field):
            raise AgentFlowError(
                "langgraph_checkpoint_mismatch",
                f"LangGraph checkpoint changed immutable authorization field {field}.",
                status=409,
                field_path=f"/state/{field}",
            )
    previous_status = previous_state.get("authorization_status", "active")
    runtime_status = runtime_state.get("authorization_status", "active")
    if runtime_status != previous_status:
        raise AgentFlowError(
            "langgraph_checkpoint_mismatch",
            "LangGraph checkpoint changed the durable authorization status.",
            status=409,
            field_path="/state/authorization_status",
        )


def _canonical_state(state: dict[str, Any], *, principal: str, workspace_id: str, created_at: str | None = None, updated_at: str | None = None) -> dict[str, Any]:
    authorization_budget = state.get("authorization_budget")
    authorization = None
    if isinstance(authorization_budget, dict) and state.get("authorization_digest"):
        usage = {
            "navigation_attempts": int(state.get("navigation_attempts", 0) or 0),
            "model_calls": int(state.get("model_calls", 0) or 0),
            "tool_calls_per_round": int(state.get("tool_calls_per_round", 0) or 0),
            "run_creations": int(state.get("run_creations", 0) or 0),
            "execution_time_ms": int(state.get("execution_time_ms", 0) or 0),
        }
        usage_by_budget = {
            "max_navigation_attempts": "navigation_attempts",
            "max_model_calls": "model_calls",
            "max_tool_calls_per_round": "tool_calls_per_round",
            "max_run_creations": "run_creations",
            "max_execution_time_ms": "execution_time_ms",
        }
        remaining = {
            name: max(0, int(value) - usage[usage_by_budget[name]])
            for name, value in authorization_budget.items()
            if name in usage_by_budget and isinstance(value, int)
        }
        authorization = {
            "status": state.get("authorization_status", "active"),
            "authorization_id": state.get("authorization_id"),
            "authorization_digest": state.get("authorization_digest"),
            "budget": deepcopy(authorization_budget),
            "usage": usage,
            "remaining": remaining,
        }
    return {
        "schema_identity": FLOW_SCHEMA_IDENTITY,
        "contract_revision": FLOW_CONTRACT_REVISION,
        "flow_id": state.get("flow_id"),
        "session_id": state.get("session_id"),
        "principal": principal,
        "workspace_id": workspace_id,
        "intent": _ORCHESTRATOR_TO_CANONICAL.get(str(state.get("intent") or ""), "unsupported_execution"),
        "status": state.get("graph_status", "created"),
        "node": state.get("current_node", "receive_input"),
        "event_sequence": int(state.get("event_sequence", 0)),
        "binding": _identity_binding(state),
        "pending_action": state.get("pending_user_action"),
        "approval": {"status": state.get("approval_status", "not_required")},
        "authorization": authorization,
        "validation": deepcopy(state.get("validation") or {}),
        "evidence": {"status": state.get("evidence_status", "missing")},
        "report": {"status": state.get("report_status", "not_started")},
        "terminal_reason": state.get("terminal_reason"),
        "checkpoint_id": f"{state.get('flow_id')}:event:{int(state.get('event_sequence', 0))}",
        "created_at": created_at or "1970-01-01T00:00:00+00:00",
        "updated_at": updated_at or created_at or "1970-01-01T00:00:00+00:00",
        # Navigation observations are durable flow state, not UI-only hints.
        # Keep them bounded by the orchestrator before they cross the API.
        "current_page": state.get("current_page"),
        "current_page_capabilities": list(state.get("current_page_capabilities") or [])[:32],
        "current_context_revision": state.get("current_context_revision"),
        "required_capabilities": list(state.get("required_capabilities") or [])[:32],
        "allowed_pages": list(state.get("allowed_pages") or [])[:32],
        "allowed_actions": list(state.get("allowed_actions") or [])[:32],
        "visited_pages": list(state.get("visited_pages") or [])[:8],
        "navigation_attempts": max(0, min(8, int(state.get("navigation_attempts", 0) or 0))),
        "max_navigation_attempts": max(0, min(8, int(state.get("max_navigation_attempts", 0) or 0))),
        "navigation_failures": deepcopy(state.get("navigation_failures") or [])[-8:],
        "last_navigation_observation": deepcopy(state.get("last_navigation_observation")),
        "navigation_target": state.get("navigation_target"),
    }


def _enrich_event(flow_id: str, state: dict[str, Any], event: dict[str, Any], *, sequence: int, principal: str, workspace_id: str) -> dict[str, Any]:
    event_created_at = utc_now()
    event_type = str(event.get("type") or "state")
    if event_type == "stage":
        event_type = "node_completed"
    elif event_type == "resume":
        event_type = "state_changed"
    elif event_type not in {"interrupt", "approval_required", "terminal", "error", "node_started", "node_completed", "state_changed"}:
        event_type = "error" if state.get("status") in {"failed", "refused", "stale"} else "state_changed"
    enriched = dict(event)
    enriched.update({
        "schema_identity": FLOW_EVENT_SCHEMA_IDENTITY,
        "contract_revision": FLOW_CONTRACT_REVISION,
        "flow_id": flow_id,
        "sequence": sequence,
        "event_id": f"{flow_id}:{sequence}",
        "event_type": event_type,
        "session_id": state.get("session_id"),
        "state": _canonical_state(state, principal=principal, workspace_id=workspace_id, created_at=event_created_at, updated_at=event_created_at),
        "binding": _identity_binding(state),
        "pending_action": state.get("pending_user_action"),
        "payload": {key: value for key, value in event.items() if key not in {"sequence", "type", "node"}},
        "created_at": event_created_at,
    })
    enriched.pop("type", None)
    enriched.pop("status", None)
    enriched.pop("pending_user_action", None)
    enriched.pop("reason", None)
    return enriched


def _public(record: dict[str, Any]) -> dict[str, Any]:
    state = deepcopy(record["state"])
    # A public read is also a durable checkpoint boundary.  Validate before
    # projecting counters or charging the wall-clock budget so malformed
    # persisted values fail closed as a 409 instead of becoming a raw 500 (or
    # being silently coerced to zero by the projection below).
    _validate_durable_projection_state(state, record_sequence=record.get("sequence"))
    # The durable row and its serialized checkpoint are separate identity
    # columns.  Do not project a state whose flow/session or binding identity
    # was altered out of band; returning it would let a stale checkpoint look
    # like the current flow after a restart.
    expected_document = record.get("document") if isinstance(record.get("document"), dict) else {}
    identity_fields = (
        ("flow_id", record.get("flow_id")),
        ("session_id", expected_document.get("session_id")),
        ("run_id", expected_document.get("run_id")),
        ("run_context_revision", expected_document.get("run_context_revision")),
        ("backend_identity", record.get("backend_identity")),
        ("schema_set_revision", record.get("schema_set_revision")),
        ("input_snapshot_digest", expected_document.get("input_snapshot_digest")),
        ("artifact_bindings", expected_document.get("artifact_bindings") or []),
    )
    for field, expected in identity_fields:
        if state.get(field) != expected:
            raise AgentFlowError(
                "langgraph_checkpoint_mismatch",
                f"Durable flow identity field {field} does not match its record.",
                status=409,
                field_path=f"/state/{field}",
            )
    # Project the server-owned wall-clock ledger on reads as well as writes.
    # This keeps the displayed remaining budget honest while a flow is paused
    # and makes a restart/second worker observe the same elapsed usage.  The
    # durable row is still updated only by a transition, so a GET cannot
    # manufacture an event or consume a resume cursor.
    budget = state.get("authorization_budget")
    if isinstance(budget, dict) and "max_execution_time_ms" in budget:
        # A paused flow still consumes its wall-clock grant, but a terminal
        # flow has already committed its final usage.  Do not keep charging a
        # completed/cancelled/failed flow on every later GET; that would make a
        # successful navigation appear exhausted merely because it was viewed
        # after the fact.  For an active, paused flow the projection is still
        # read-only: it reports exhausted without manufacturing an event.  The
        # next mutating resume persists the terminal failure durably.
        if state.get("graph_status") not in FLOW_TERMINAL_STATUSES:
            elapsed = _elapsed_execution_ms(record.get("created_at"))
            state["execution_time_ms"] = max(int(state.get("execution_time_ms", 0) or 0), elapsed)
            limit = budget.get("max_execution_time_ms")
            if (
                state.get("authorization_status", "active") == "active"
                and isinstance(limit, int)
                and not isinstance(limit, bool)
                and elapsed >= limit
            ):
                state["authorization_status"] = "exhausted"
    state["event_sequence"] = int(record["sequence"])
    canonical = _canonical_state(state, principal=record["principal"], workspace_id=record["workspace_id"], created_at=record["created_at"], updated_at=record["updated_at"])
    return canonical


class AgentFlowService:
    def __init__(
        self,
        store: AgentFlowStore,
        *,
        schema_set_revision: str,
        backend_identity_provider,
        runtime: Any | None = None,
        runtime_mode: str = "deterministic_transition_adapter",
        runtime_error: Exception | None = None,
    ):
        self.store = store
        self.schema_set_revision = schema_set_revision
        self.backend_identity_provider = backend_identity_provider
        self.runtime = runtime
        self.runtime_mode = runtime_mode
        self.runtime_error = runtime_error
        # A start retry must not execute an optional runtime twice when two
        # HTTP workers race before SQLite has a durable row to replay.  The
        # store remains the cross-process durable fence; this lock closes the
        # in-process side-effect window around the runtime invocation.
        self._start_lock = threading.RLock()
        # Resume has the same side-effect window as start. A response can be
        # lost after an optional LangGraph runtime advances its checkpoint but
        # before the Bridge replay row is committed. Serialize this path so
        # an exact retry cannot invoke the graph twice in one process.
        self._resume_lock = threading.RLock()

    def _runtime_unavailable(self) -> AgentFlowError:
        detail = str(self.runtime_error) if self.runtime_error else "The requested flow runtime is unavailable."
        return AgentFlowError("langgraph_runtime_unavailable", detail, status=503, retryable=True)

    def _backend(self) -> dict[str, Any]:
        value = self.backend_identity_provider()
        if not isinstance(value, dict):
            raise AgentFlowError("backend_identity_unavailable", "Current backend identity is unavailable.", status=503, retryable=True)
        return value

    @staticmethod
    def _assert_record_contract(record: dict[str, Any]) -> None:
        # Contract revisions are part of the durable flow identity. Never
        # re-emit a v1 row as a v2 state merely because the schema-set happens
        # to match; callers must explicitly start a fresh flow under the new
        # contract.
        if record.get("contract_revision") != FLOW_CONTRACT_REVISION:
            raise AgentFlowError(
                "contract_revision_mismatch",
                "Flow was created under an older contract revision.",
                status=409,
            )

    @staticmethod
    def _refresh_execution_ledger(record: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        """Return a state copy with server-derived execution usage.

        The timeout is evaluated from the durable row timestamp, never from a
        client-provided counter.  This is intentionally a small helper so the
        pre- and post-runtime fences use identical semantics.
        """

        state = deepcopy(record["state"])
        _validate_durable_projection_state(state, record_sequence=record.get("sequence"))
        budget = state.get("authorization_budget")
        if not isinstance(budget, dict) or "max_execution_time_ms" not in budget:
            return state, False
        limit = budget.get("max_execution_time_ms")
        if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1 or limit > _AUTHORIZATION_BUDGET_LIMITS["max_execution_time_ms"]:
            raise AgentFlowError(
                "authorization_budget_invalid",
                "max_execution_time_ms is invalid in the durable authorization envelope.",
                status=409,
                field_path="/authorization_budget/max_execution_time_ms",
            )
        elapsed = _elapsed_execution_ms(record.get("created_at"))
        state["execution_time_ms"] = max(int(state.get("execution_time_ms", 0) or 0), elapsed)
        return state, elapsed >= limit

    def start(self, document: dict[str, Any], *, principal: str, workspace_id: str, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        if not isinstance(document, dict):
            raise AgentFlowError("invalid_json", "Flow start body must be an object.")
        allowed = {"schema_identity", "contract_revision", "session_id", "user_goal", "intent", "run_id", "run_context_revision", "backend_identity", "schema_set_revision", "input_snapshot_digest", "evidence_status", "artifact_bindings", "principal", "workspace_id", "current_page", "current_page_capabilities", "current_context_revision", "required_capabilities", "allowed_pages", "allowed_actions", "navigation_attempts", "max_navigation_attempts", "authorization_id", "authorization_digest", "authorization_budget"}
        unknown = sorted(set(document) - allowed)
        if unknown:
            raise AgentFlowError("unknown_field", "Flow start input is closed.", field_path=f"/{unknown[0]}")
        _validate_navigation_start_fields(document)
        _require_string(document.get("session_id"), "/session_id", max_length=128)
        if document.get("schema_identity") != FLOW_START_SCHEMA_IDENTITY:
            raise AgentFlowError("schema_identity_mismatch", "Flow start schema identity is not published.", field_path="/schema_identity")
        if document.get("contract_revision") != FLOW_CONTRACT_REVISION:
            raise AgentFlowError("contract_revision_mismatch", "Flow start contract revision is stale.", status=409, field_path="/contract_revision")
        required = ("session_id", "user_goal", "intent", "run_id", "run_context_revision", "backend_identity", "schema_set_revision", "input_snapshot_digest", "artifact_bindings")
        missing = [key for key in required if key not in document]
        if missing:
            raise AgentFlowError("binding_required", "Flow start is missing a required identity field.", field_path=f"/{missing[0]}")
        _require_string(document.get("session_id"), "/session_id", max_length=128)
        _require_string(document.get("user_goal"), "/user_goal", max_length=20000)
        intent = document.get("intent")
        if not isinstance(intent, str) or intent not in _CANONICAL_TO_ORCHESTRATOR:
            raise AgentFlowError("unsupported_intent", "Flow intent is not supported.", field_path="/intent")
        authorization = _validate_authorization_start_fields(document)
        supplied_principal = document.get("principal")
        if supplied_principal is not None:
            _require_string(supplied_principal, "/principal", max_length=128)
        if supplied_principal is not None and supplied_principal != principal:
            raise AgentFlowError("principal_mismatch", "Flow principal does not match the local subject.", status=403, field_path="/principal")
        supplied_workspace = document.get("workspace_id")
        if supplied_workspace is not None:
            _require_string(supplied_workspace, "/workspace_id", max_length=128)
        if supplied_workspace is not None and supplied_workspace != workspace_id:
            raise AgentFlowError("workspace_mismatch", "Flow workspace does not match the local subject.", status=403, field_path="/workspace_id")
        binding = validate_binding({key: document.get(key) for key in ("run_id", "run_context_revision", "backend_identity", "schema_set_revision", "input_snapshot_digest", "artifact_bindings")}, schema_set_revision=self.schema_set_revision, backend_identity=self._backend(), intent=_CANONICAL_TO_ORCHESTRATOR[intent])
        evidence_status = document.get("evidence_status", "missing")
        if not isinstance(evidence_status, str) or evidence_status not in {"validated", "deterministic_fallback", "partial", "truncated", "missing", "provider_unavailable"}:
            raise AgentFlowError("invalid_field", "evidence_status is not a published evidence state.", field_path="/evidence_status")
        digest = canonical_sha256(document)
        try:
            existing = self.store.get_start_replay(
                idempotency_key,
                digest,
                principal=principal,
                workspace_id=workspace_id,
            )
        except AgentFlowStoreError as error:
            raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
        if existing is not None:
            self._assert_record_contract(existing)
            return _public(existing), True
        with self._start_lock:
            # Recheck after acquiring the lock: another request may have
            # committed the same key while this request was validating its
            # input.  This is what keeps the runtime invocation exactly once
            # for concurrent callers in one Bridge process.
            try:
                existing = self.store.get_start_replay(
                    idempotency_key,
                    digest,
                    principal=principal,
                    workspace_id=workspace_id,
                )
            except AgentFlowStoreError as error:
                raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
            if existing is not None:
                self._assert_record_contract(existing)
                return _public(existing), True
            state = new_state(
                session_id=document["session_id"],
                user_goal=document["user_goal"],
                flow_id=f"flow-{uuid4().hex}",
                context={
                    "intent": _CANONICAL_TO_ORCHESTRATOR[intent],
                    "evidence_status": evidence_status,
                    **(authorization or {}),
                    **binding,
                    # The model-backed navigation proposal has already spent
                    # one signed model-call budget before the durable flow is
                    # created.  Keep that usage in the flow projection instead
                    # of presenting a misleading zero counter after restart.
                    "model_calls": 1 if intent == "navigation" and authorization else 0,
                    "tool_calls_per_round": 0,
                    "run_creations": 0,
                    "execution_time_ms": 0,
                    **{key: document[key] for key in ("current_page", "current_page_capabilities", "current_context_revision", "required_capabilities", "allowed_pages", "allowed_actions", "navigation_attempts", "max_navigation_attempts") if key in document},
                },
            )
            if self.runtime_mode == "langgraph_sqlite_local":
                if self.runtime is None:
                    raise self._runtime_unavailable()
                try:
                    result = self.runtime.start(state)
                except LangGraphRuntimeUnavailable as error:
                    raise AgentFlowError("langgraph_runtime_unavailable", str(error), status=503, retryable=True) from error
                except Exception as error:
                    raise AgentFlowError(
                        "langgraph_runtime_error",
                        "The optional LangGraph runtime failed; flow outcome is unknown and requires intervention.",
                        status=409,
                    ) from error
            else:
                result = run_until_pause(state)
            if not isinstance(result, dict) or not isinstance(result.get("state"), dict) or not isinstance(result.get("event"), dict):
                raise AgentFlowError(
                    "langgraph_runtime_error",
                    "The optional LangGraph runtime returned an invalid transition; flow outcome is unknown.",
                    status=409,
                )
            runtime_state = result["state"]
            # Preserve the usage counters initialized before the first graph
            # transition.  Start has no browser observation yet, so all tool
            # and execution counters remain zero until a resume transition.
            _assert_runtime_authorization_unchanged(runtime_state, state)
            _merge_runtime_counter(runtime_state, state, "model_calls")
            _merge_runtime_counter(runtime_state, state, "run_creations")
            runtime_state["tool_calls_per_round"] = int(state.get("tool_calls_per_round", 0) or 0)
            runtime_state["execution_time_ms"] = int(state.get("execution_time_ms", 0) or 0)
            _validate_runtime_navigation_state(runtime_state)
            if (
                self.runtime_mode == "langgraph_sqlite_local"
                and (
                    runtime_state.get("flow_id") != state.get("flow_id")
                    or runtime_state.get("session_id") != state.get("session_id")
                    or not binding_matches(state, runtime_state)
                    or runtime_state.get("graph_status") not in FLOW_STATUSES
                    or runtime_state.get("pending_user_action") not in {None, "clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation"}
                )
            ):
                raise AgentFlowError(
                    "langgraph_checkpoint_mismatch",
                    "The optional LangGraph checkpoint identity or state is not compatible with the durable flow.",
                    status=409,
                )
            state = runtime_state
            # The pure graph emits one event per internal node.  The HTTP adapter
            # persists one bounded transition event per request, so normalize the
            # public sequence while retaining the graph's current node/state.
            state["event_sequence"] = 1
            event = _enrich_event(state["flow_id"], state, result["event"], sequence=1, principal=principal, workspace_id=workspace_id)
            try:
                record, replay = self.store.create(flow_id=state["flow_id"], idempotency_key=idempotency_key, payload_digest=digest, document=document, state=state, status=str(state.get("graph_status")), principal=principal, workspace_id=workspace_id, contract_revision=FLOW_CONTRACT_REVISION, schema_set_revision=self.schema_set_revision, backend_identity=binding["backend_identity"], event=event)
            except AgentFlowStoreError as error:
                raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
            return _public(record), replay

    def get(self, flow_id: str, *, principal: str, workspace_id: str) -> dict[str, Any]:
        _validate_flow_id(flow_id)
        record = self.store.get(flow_id)
        if record is None:
            raise AgentFlowError("flow_not_found", "Flow was not found.", status=404)
        if record["principal"] != principal or record["workspace_id"] != workspace_id:
            raise AgentFlowError("flow_access_denied", "Flow is not owned by this principal and workspace.", status=403)
        self._assert_record_contract(record)
        if record["schema_set_revision"] != self.schema_set_revision:
            raise AgentFlowError("schema_revision_mismatch", "Flow was created under an old schema-set revision.", status=409)
        if record["backend_identity"] != self._backend():
            raise AgentFlowError("backend_identity_mismatch", "Flow was created against a different backend identity.", status=409)
        _validate_durable_projection_state(record.get("state"), record_sequence=record.get("sequence"))
        return _public(record)

    def revoke_authorization(
        self,
        flow_id: str,
        document: dict[str, Any],
        *,
        principal: str,
        workspace_id: str,
        idempotency_key: str,
    ) -> tuple[dict[str, Any], bool]:
        """Durably revoke a flow authorization and stop any pending work.

        Revocation is intentionally separate from ``resume``: it is a
        security mutation that must remain available while a flow is waiting
        for user input, and it must never be interpreted as a user approval or
        clarification.  The request carries the complete immutable
        authorization envelope and current identity binding; every value is
        compared with the durable row before the atomic store transition.
        """

        _validate_flow_id(flow_id)
        record = self.store.get(flow_id)
        if record is None:
            raise AgentFlowError("flow_not_found", "Flow was not found.", status=404)
        if record["principal"] != principal or record["workspace_id"] != workspace_id:
            raise AgentFlowError("flow_access_denied", "Flow is not owned by this principal and workspace.", status=403)
        self._assert_record_contract(record)
        if record["schema_set_revision"] != self.schema_set_revision:
            raise AgentFlowError("schema_revision_mismatch", "Flow was created under an old schema-set revision.", status=409)
        if record["backend_identity"] != self._backend():
            raise AgentFlowError("backend_identity_mismatch", "Flow was created against a different backend identity.", status=409)
        _validate_durable_projection_state(record.get("state"), record_sequence=record.get("sequence"))
        if not isinstance(document, dict):
            raise AgentFlowError("invalid_json", "Authorization revoke body must be an object.")
        allowed = {
            "schema_identity",
            "contract_revision",
            "flow_id",
            "session_id",
            "current_binding",
            "current_event_sequence",
            "authorization_id",
            "authorization_digest",
            "authorization_budget",
            "principal",
            "workspace_id",
        }
        unknown = sorted(set(document) - allowed)
        if unknown:
            raise AgentFlowError("unknown_field", "Authorization revoke input is closed.", field_path=f"/{unknown[0]}")
        if document.get("schema_identity") != "tilesim.agent_flow.revoke_request.v1":
            raise AgentFlowError("schema_identity_mismatch", "Authorization revoke schema identity is not published.", field_path="/schema_identity")
        if document.get("contract_revision") != FLOW_CONTRACT_REVISION:
            raise AgentFlowError("contract_revision_mismatch", "Authorization revoke contract revision is stale.", status=409, field_path="/contract_revision")
        required_fields = (
            "flow_id",
            "session_id",
            "current_binding",
            "current_event_sequence",
            "authorization_id",
            "authorization_digest",
            "authorization_budget",
        )
        missing_fields = [field for field in required_fields if field not in document]
        if missing_fields:
            raise AgentFlowError(
                "invalid_field",
                "Authorization revoke input is incomplete.",
                field_path=f"/{missing_fields[0]}",
            )
        _require_string(document.get("session_id"), "/session_id", max_length=128)
        if document.get("flow_id") != flow_id or document.get("session_id") != record["state"].get("session_id"):
            raise AgentFlowError("binding_mismatch", "Flow or session identity does not match.", status=409, field_path="/flow_id")
        if document.get("principal") is not None:
            _require_string(document.get("principal"), "/principal", max_length=128)
            if document.get("principal") != principal:
                raise AgentFlowError("principal_mismatch", "Flow principal does not match the local subject.", status=403, field_path="/principal")
        if document.get("workspace_id") is not None:
            _require_string(document.get("workspace_id"), "/workspace_id", max_length=128)
            if document.get("workspace_id") != workspace_id:
                raise AgentFlowError("workspace_mismatch", "Flow workspace does not match the local subject.", status=403, field_path="/workspace_id")
        # Check the durable replay before validating the mutable cursor or
        # active status.  An exact retry must replay even though the first
        # revoke has already changed the flow to ``cancelled``/``revoked``.
        digest = canonical_sha256(document)
        try:
            replay, replayed = self.store.get_authorization_revoke_record(flow_id, idempotency_key, digest)
        except AgentFlowStoreError as error:
            raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
        if replayed:
            return replay, True  # type: ignore[return-value]
        durable_state = record["state"]
        authorization_id = document.get("authorization_id")
        if not isinstance(authorization_id, str) or not _AUTHORIZATION_ID.fullmatch(authorization_id):
            raise AgentFlowError("invalid_field", "authorization_id is invalid.", field_path="/authorization_id")
        _validate_digest(document.get("authorization_digest"), "/authorization_digest", nullable=False)
        if not isinstance(document.get("authorization_budget"), dict):
            raise AgentFlowError("invalid_field", "authorization_budget must be an object.", field_path="/authorization_budget")
        durable_auth = {
            "authorization_id": durable_state.get("authorization_id"),
            "authorization_digest": durable_state.get("authorization_digest"),
            "authorization_budget": durable_state.get("authorization_budget"),
        }
        if not durable_auth["authorization_digest"]:
            raise AgentFlowError("authorization_required", "This flow has no revocable authorization envelope.", status=403, field_path="/authorization_digest")
        for field in ("authorization_id", "authorization_digest", "authorization_budget"):
            if document.get(field) != durable_auth[field]:
                raise AgentFlowError("authorization_stale", "Authorization identity or budget changed before revoke.", status=409, field_path=f"/{field}")
        if durable_state.get("authorization_status", "active") != "active":
            raise AgentFlowError("authorization_inactive", "Flow authorization is no longer active.", status=409, field_path="/authorization_digest")
        current_event_sequence = document.get("current_event_sequence")
        if isinstance(current_event_sequence, bool) or not isinstance(current_event_sequence, int) or current_event_sequence < 0:
            raise AgentFlowError("invalid_field", "current_event_sequence must be a non-negative integer.", field_path="/current_event_sequence")
        if current_event_sequence != int(record["sequence"]):
            raise AgentFlowError("event_sequence_mismatch", "Authorization revoke cursor is stale.", status=409, field_path="/current_event_sequence")
        raw_binding = document.get("current_binding")
        if not isinstance(raw_binding, dict):
            raise AgentFlowError("binding_required", "Revoking a flow requires its current identity binding.", field_path="/current_binding")
        current_binding = validate_binding(
            raw_binding,
            schema_set_revision=self.schema_set_revision,
            backend_identity=self._backend(),
            intent=durable_state.get("intent") or None,
        )
        if raw_binding.get("session_id") != durable_state.get("session_id") or raw_binding.get("flow_id") != flow_id:
            raise AgentFlowError("binding_mismatch", "Current binding does not identify this flow.", status=409, field_path="/current_binding")
        if not binding_matches(durable_state, current_binding):
            raise AgentFlowError("stale_binding", "Flow identity binding changed before revoke.", status=409)
        with self._resume_lock:
            # Re-check the durable row while holding the same in-process fence
            # used by resume.  The store repeats the active-status check in its
            # transaction for cross-process callers.
            current = self.store.get(flow_id)
            if current is None:
                raise AgentFlowError("flow_not_found", "Flow was not found.", status=404)
            if current["principal"] != principal or current["workspace_id"] != workspace_id:
                raise AgentFlowError("flow_access_denied", "Flow is not owned by this principal and workspace.", status=403)
            if current["state"].get("authorization_digest") != durable_state.get("authorization_digest"):
                raise AgentFlowError("authorization_stale", "Authorization changed before revoke.", status=409, field_path="/authorization_digest")
            if current["state"].get("authorization_status", "active") != "active":
                raise AgentFlowError("authorization_inactive", "Flow authorization is no longer active.", status=409, field_path="/authorization_digest")
            if current["sequence"] != record["sequence"]:
                raise AgentFlowError("event_sequence_mismatch", "Authorization revoke cursor is stale.", status=409, field_path="/current_event_sequence")
            state = deepcopy(current["state"])
            state["authorization_status"] = "revoked"
            state["graph_status"] = "cancelled"
            state["pending_user_action"] = None
            state["current_node"] = "terminal"
            state["terminal_reason"] = "authorization_revoked"
            next_sequence = int(current["sequence"]) + 1
            state["event_sequence"] = next_sequence
            event = _enrich_event(
                flow_id,
                state,
                {"type": "terminal", "node": "authorization", "reason": "authorization_revoked", "status": "cancelled"},
                sequence=next_sequence,
                principal=principal,
                workspace_id=workspace_id,
            )
            try:
                response, replayed = self.store.transition_authorization_revoke(
                    flow_id,
                    idempotency_key,
                    digest,
                    state=state,
                    status="cancelled",
                    event=event,
                    response_factory=lambda updated: {
                        "flow": _public(updated),
                        "events": [event],
                        "idempotent_replay": False,
                        "action": "revoke_authorization",
                    },
                )
            except AgentFlowStoreError as error:
                raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
            return response, replayed

    def events(self, flow_id: str, *, principal: str, workspace_id: str, after_sequence: int = 0) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        _validate_flow_id(flow_id)
        current = self.get(flow_id, principal=principal, workspace_id=workspace_id)
        if isinstance(after_sequence, bool) or not isinstance(after_sequence, int) or after_sequence < 0:
            raise AgentFlowError("invalid_last_event_id", "Last-Event-ID must be a non-negative sequence.", field_path="/headers/Last-Event-ID")
        if after_sequence > 0 and not self.store.has_event(flow_id, after_sequence):
            raise AgentFlowError("event_not_found", "Last-Event-ID is not present in the durable flow event log.", status=404)
        events = self.store.events(flow_id, after_sequence=after_sequence)
        expected = after_sequence + 1
        for event in events:
            try:
                sequence = int(event.get("sequence"))
            except (AttributeError, TypeError, ValueError) as error:
                raise AgentFlowError("event_sequence_gap", "Flow event sequence is malformed.", status=409) from error
            if sequence != expected:
                raise AgentFlowError("event_sequence_gap", "Flow event sequence has a durable gap.", status=409)
            expected += 1
        if expected <= int(current["event_sequence"]):
            raise AgentFlowError("event_sequence_gap", "Flow event sequence has a durable gap.", status=409)
        return current, events

    def resume(self, flow_id: str, document: dict[str, Any], *, principal: str, workspace_id: str, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        _validate_flow_id(flow_id)
        record = self.store.get(flow_id)
        if record is None:
            raise AgentFlowError("flow_not_found", "Flow was not found.", status=404)
        if record["principal"] != principal or record["workspace_id"] != workspace_id:
            raise AgentFlowError("flow_access_denied", "Flow is not owned by this principal and workspace.", status=403)
        self._assert_record_contract(record)
        if record["schema_set_revision"] != self.schema_set_revision:
            raise AgentFlowError("schema_revision_mismatch", "Flow was created under an old schema-set revision.", status=409)
        if record["backend_identity"] != self._backend():
            raise AgentFlowError("backend_identity_mismatch", "Flow was created against a different backend identity.", status=409)
        _validate_durable_projection_state(record.get("state"), record_sequence=record.get("sequence"))
        if not isinstance(document, dict):
            raise AgentFlowError("invalid_json", "Resume body must be an object.")
        allowed = {"schema_identity", "contract_revision", "flow_id", "session_id", "action", "intent", "pending_action", "navigation_observation", "current_binding", "current_event_sequence", "clarification", "reason", "approval_digest", "principal", "workspace_id", "authorization_id", "authorization_digest", "authorization_budget"}
        unknown = sorted(set(document) - allowed)
        if unknown:
            raise AgentFlowError("unknown_field", "Flow resume input is closed.", field_path=f"/{unknown[0]}")
        if document.get("schema_identity") != FLOW_RESUME_SCHEMA_IDENTITY:
            raise AgentFlowError("schema_identity_mismatch", "Flow resume schema identity is not published.", field_path="/schema_identity")
        if document.get("contract_revision") != FLOW_CONTRACT_REVISION:
            raise AgentFlowError("contract_revision_mismatch", "Flow resume contract revision is stale.", status=409, field_path="/contract_revision")
        _validate_flow_id(document.get("flow_id"))
        _require_string(document.get("session_id"), "/session_id", max_length=128)
        if document.get("flow_id") != flow_id or document.get("session_id") != record["state"].get("session_id"):
            raise AgentFlowError("binding_mismatch", "Flow or session identity does not match.", status=409, field_path="/flow_id")
        supplied_intent = document.get("intent")
        expected_intent = _ORCHESTRATOR_TO_CANONICAL.get(str(record["state"].get("intent") or ""), "unsupported_execution")
        if supplied_intent is not None and (not isinstance(supplied_intent, str) or supplied_intent not in _CANONICAL_TO_ORCHESTRATOR):
            raise AgentFlowError("unsupported_intent", "Resume intent is not supported.", field_path="/intent")
        if document.get("action") != "clarify_intent" and supplied_intent is not None and supplied_intent != expected_intent:
            raise AgentFlowError("binding_mismatch", "Resume intent does not match the durable flow.", status=409, field_path="/intent")
        if document.get("principal") is not None:
            _require_string(document.get("principal"), "/principal", max_length=128)
            if document.get("principal") != principal:
                raise AgentFlowError("principal_mismatch", "Flow principal does not match the local subject.", status=403, field_path="/principal")
        if document.get("workspace_id") is not None:
            _require_string(document.get("workspace_id"), "/workspace_id", max_length=128)
        if document.get("workspace_id") is not None and document.get("workspace_id") != workspace_id:
            raise AgentFlowError("workspace_mismatch", "Flow workspace does not match the local subject.", status=403, field_path="/workspace_id")
        durable_auth = record["state"].get("authorization_digest")
        if durable_auth:
            if record["state"].get("authorization_status", "active") != "active":
                raise AgentFlowError(
                    "authorization_inactive",
                    "Flow authorization is no longer active.",
                    status=409,
                    field_path="/authorization_digest",
                )
            if document.get("authorization_id") != record["state"].get("authorization_id"):
                raise AgentFlowError("authorization_stale", "Authorization identity changed before resume.", status=409, field_path="/authorization_id")
            if document.get("authorization_digest") != durable_auth:
                raise AgentFlowError("authorization_stale", "Authorization digest changed before resume.", status=409, field_path="/authorization_digest")
            if document.get("authorization_budget") != record["state"].get("authorization_budget"):
                raise AgentFlowError("authorization_stale", "Authorization budget changed before resume.", status=409, field_path="/authorization_budget")
        elif any(key in document for key in ("authorization_id", "authorization_digest", "authorization_budget")):
            raise AgentFlowError("authorization_stale", "This flow has no durable authorization envelope.", status=409, field_path="/authorization_digest")
        action = document.get("action")
        if not isinstance(action, str) or action not in FLOW_ACTIONS:
            raise AgentFlowError("unsupported_action", "Resume action is not supported.", field_path="/action")
        if "clarification" in document and document.get("clarification") is not None:
            clarification = document.get("clarification")
            if not isinstance(clarification, str) or len(clarification) > 20000:
                raise AgentFlowError("invalid_field", "Clarification exceeds the published limit.", field_path="/clarification")
        if "reason" in document and document.get("reason") is not None:
            reason = document.get("reason")
            if not isinstance(reason, str) or len(reason) > 2000:
                raise AgentFlowError("invalid_field", "Reason exceeds the published limit.", field_path="/reason")
        if "approval_digest" in document and document.get("approval_digest") is not None:
            _require_string(document.get("approval_digest"), "/approval_digest", max_length=256)
        navigation_observation = document.get("navigation_observation")
        if navigation_observation is not None:
            navigation_observation = _validate_navigation_observation(
                navigation_observation,
                allowed_pages=record["state"].get("allowed_pages", []),
                required_capabilities=record["state"].get("required_capabilities", []),
                max_attempts=record["state"].get("max_navigation_attempts"),
            )
            expected_run = record["state"].get("run_id")
            if navigation_observation.get("current_run_id") != expected_run:
                raise AgentFlowError(
                    "stale_binding",
                    "Navigation observation run identity is stale.",
                    status=409,
                    field_path="/navigation_observation/current_run_id",
                )
        current_event_sequence = document.get("current_event_sequence")
        if isinstance(current_event_sequence, bool) or not isinstance(current_event_sequence, int) or current_event_sequence < 0:
            raise AgentFlowError("invalid_field", "current_event_sequence must be a non-negative integer.", field_path="/current_event_sequence")
        digest = canonical_sha256(document)
        raw_binding = document.get("current_binding")
        if not isinstance(raw_binding, dict):
            raise AgentFlowError("binding_required", "Resuming a flow requires its current identity binding.", field_path="/current_binding")
        current_binding = validate_binding(raw_binding, schema_set_revision=self.schema_set_revision, backend_identity=self._backend(), intent=record["state"].get("intent") or None)
        if raw_binding.get("session_id") != record["state"].get("session_id") or raw_binding.get("flow_id") != flow_id:
            raise AgentFlowError("binding_mismatch", "Current binding does not identify this flow.", status=409, field_path="/current_binding")
        if not binding_matches(record["state"], current_binding):
            raise AgentFlowError("stale_binding", "Flow identity binding changed before resume.", status=409)
        try:
            replay, replayed = self.store.get_resume_record(flow_id, idempotency_key, digest)
        except AgentFlowStoreError as error:
            raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
        if replayed:
            return replay, True  # type: ignore[return-value]
        if document.get("pending_action") != record["state"].get("pending_user_action"):
            raise AgentFlowError("pending_action_mismatch", "Resume pending action does not match the durable flow state.", status=409, field_path="/pending_action")
        if document.get("current_event_sequence") != int(record["sequence"]):
            raise AgentFlowError("event_sequence_mismatch", "Resume cursor is stale.", status=409, field_path="/current_event_sequence")
        if record["status"] in FLOW_TERMINAL_STATUSES:
            raise AgentFlowError("terminal_mutation", "A terminal flow cannot be resumed.", status=409)
        if record["status"] != "waiting_user":
            raise AgentFlowError("resume_not_allowed", "Flow is not waiting for a user action.", status=409)
        resume_intent = None
        if action == "clarify_intent":
            # Clarification is a display/audit note only. Never infer a route
            # from free-form text: the client must send one of the published
            # intent enum values so an ambiguous or adversarial phrase cannot
            # silently select a different flow.
            if supplied_intent is None:
                raise AgentFlowError("unsupported_intent", "Clarification requires an explicit supported intent.", field_path="/intent")
            resume_intent = _CANONICAL_TO_ORCHESTRATOR[supplied_intent]
        # Keep the replay check, optional runtime invocation, and durable
        # transition under one in-process fence. Without this second replay
        # check, concurrent callers using the same key could both advance an
        # optional LangGraph checkpoint before either response row existed.
        with self._resume_lock:
            try:
                replay, replayed = self.store.get_resume_record(flow_id, idempotency_key, digest)
            except AgentFlowStoreError as error:
                raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
            if replayed:
                return replay, True  # type: ignore[return-value]
            # The record validated before acquiring the fence may have been
            # advanced by another resume with a different idempotency key.
            # Refresh it before touching the runtime; otherwise a stale
            # waiting snapshot could invoke LangGraph again and only fail
            # later when the SQLite sequence fence rejects the transition.
            current = self.store.get(flow_id)
            if current is None:
                raise AgentFlowError("flow_not_found", "Flow was not found.", status=404)
            if current["principal"] != principal or current["workspace_id"] != workspace_id:
                raise AgentFlowError("flow_access_denied", "Flow is not owned by this principal and workspace.", status=403)
            self._assert_record_contract(current)
            if current["schema_set_revision"] != self.schema_set_revision:
                raise AgentFlowError("schema_revision_mismatch", "Flow was created under an old schema-set revision.", status=409)
            if current["backend_identity"] != self._backend():
                raise AgentFlowError("backend_identity_mismatch", "Flow was created against a different backend identity.", status=409)
            if not binding_matches(current["state"], current_binding):
                raise AgentFlowError("stale_binding", "Flow identity binding changed before resume.", status=409)
            if current["state"].get("authorization_digest") and current["state"].get("authorization_status", "active") != "active":
                raise AgentFlowError(
                    "authorization_inactive",
                    "Flow authorization is no longer active.",
                    status=409,
                    field_path="/authorization_digest",
                )
            record = current
            if document.get("pending_action") != record["state"].get("pending_user_action"):
                raise AgentFlowError("pending_action_mismatch", "Resume pending action does not match the durable flow state.", status=409, field_path="/pending_action")
            if document.get("current_event_sequence") != int(record["sequence"]):
                raise AgentFlowError("event_sequence_mismatch", "Resume cursor is stale.", status=409, field_path="/current_event_sequence")
            if record["status"] in FLOW_TERMINAL_STATUSES:
                raise AgentFlowError("terminal_mutation", "A terminal flow cannot be resumed.", status=409)
            if record["status"] != "waiting_user":
                raise AgentFlowError("resume_not_allowed", "Flow is not waiting for a user action.", status=409)
            pending_action = record["state"].get("pending_user_action")
            allowed_pending_actions = {
                "clarify_intent": {"clarify_intent"},
                "confirm_report": {"confirm_report"},
                "confirm_draft": {"confirm_draft"},
                "confirm_navigation": {"confirm_navigation"},
            }
            navigation_observation_action = (
                record["state"].get("intent") == "navigate_page"
                and action == "confirm_navigation"
                and pending_action is None
                and navigation_observation is not None
            )
            if action not in {"cancel", "reject"} and not navigation_observation_action and action not in allowed_pending_actions.get(pending_action, set()):
                raise AgentFlowError(
                    "pending_action_mismatch",
                    "Resume action does not match the durable pending user action.",
                    status=409,
                    field_path="/action",
                )
            # A browser-side navigation deadline cannot be authoritative: the
            # user may leave a flow paused and resume it from another tab or
            # after a process restart.  Refresh usage from the durable flow
            # timestamp before invoking any graph/runtime transition.  Human
            # cancel/reject remains available after expiry so an operator can
            # always close a stale approval boundary.
            ledger_state, execution_budget_exhausted = self._refresh_execution_ledger(record)
            if execution_budget_exhausted and action not in {"cancel", "reject"}:
                ledger_state["authorization_status"] = "exhausted"
                ledger_state["graph_status"] = "failed"
                ledger_state["approval_status"] = "not_required"
                ledger_state["pending_user_action"] = None
                ledger_state["current_node"] = "authorization_check"
                ledger_state["terminal_reason"] = "execution_time_budget_exhausted"
                next_sequence = int(record["sequence"]) + 1
                ledger_state["event_sequence"] = next_sequence
                event = _enrich_event(
                    flow_id,
                    ledger_state,
                    {
                        "type": "terminal",
                        "node": "authorization_check",
                        "reason": "execution_time_budget_exhausted",
                        "status": "failed",
                    },
                    sequence=next_sequence,
                    principal=principal,
                    workspace_id=workspace_id,
                )
                try:
                    response, replayed = self.store.transition_resume(
                        flow_id,
                        idempotency_key,
                        digest,
                        state=ledger_state,
                        status="failed",
                        event=event,
                        response_factory=lambda updated: {
                            **_public(updated),
                            "action": action,
                            "idempotent_replay": False,
                            "events": [event],
                        },
                    )
                except AgentFlowStoreError as error:
                    raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
                return response, replayed
            if navigation_observation is not None and action not in {"cancel", "reject"}:
                previous_attempts = int(record["state"].get("navigation_attempts", 0) or 0)
                observed_attempts = int(navigation_observation.get("navigation_attempts", previous_attempts) or previous_attempts)
                tool_calls = observed_attempts - previous_attempts
                budget = record["state"].get("authorization_budget")
                max_tool_calls = budget.get("max_tool_calls_per_round") if isinstance(budget, dict) else None
                if tool_calls < 0 or (
                    isinstance(max_tool_calls, int)
                    and not isinstance(max_tool_calls, bool)
                    and tool_calls > max_tool_calls
                ):
                    raise AgentFlowError(
                        "tool_call_budget_exhausted",
                        "Navigation observation exceeds the authorized tool-call budget for this round.",
                        status=409,
                        field_path="/navigation_observation/navigation_attempts",
                    )
            if self.runtime_mode == "langgraph_sqlite_local":
                if self.runtime is None:
                    raise self._runtime_unavailable()
                try:
                    runtime_kwargs = {"current_binding": current_binding, "intent": resume_intent}
                    if navigation_observation is not None:
                        runtime_kwargs["navigation_observation"] = navigation_observation
                    result = self.runtime.resume(flow_id, action, **runtime_kwargs)
                except LangGraphRuntimeUnavailable as error:
                    raise AgentFlowError("langgraph_runtime_unavailable", str(error), status=503, retryable=True) from error
                except Exception as error:
                    # A framework/checkpointer exception may occur after the
                    # graph has persisted its checkpoint but before the Bridge
                    # transition commits. Do not leak a raw 500 or advertise
                    # this mutation as safely retryable; stop at a bounded
                    # unknown-outcome error until the checkpoint is inspected.
                    raise AgentFlowError(
                        "langgraph_runtime_error",
                        "The optional LangGraph runtime failed; flow outcome is unknown and requires intervention.",
                        status=409,
                    ) from error
            else:
                result = orchestrator_resume(
                    record["state"],
                    action,
                    current_binding=current_binding,
                    intent=resume_intent,
                    navigation_observation=navigation_observation,
                )
            if not isinstance(result, dict) or not isinstance(result.get("state"), dict) or not isinstance(result.get("event"), dict):
                raise AgentFlowError(
                    "langgraph_runtime_error",
                    "The optional LangGraph runtime returned an invalid transition; flow outcome is unknown.",
                    status=409,
                )
            runtime_state = result["state"]
            previous_attempts = int(record["state"].get("navigation_attempts", 0) or 0)
            observed_attempts = int(navigation_observation.get("navigation_attempts", previous_attempts) or previous_attempts) if navigation_observation else previous_attempts
            _assert_runtime_authorization_unchanged(runtime_state, record["state"])
            _merge_runtime_counter(runtime_state, record["state"], "model_calls")
            observed_tool_calls = max(0, observed_attempts - previous_attempts)
            runtime_tool_calls = runtime_state.get("tool_calls_per_round", 0)
            if isinstance(runtime_tool_calls, bool) or not isinstance(runtime_tool_calls, int) or runtime_tool_calls < 0:
                raise AgentFlowError(
                    "langgraph_checkpoint_mismatch",
                    "LangGraph usage counter tool_calls_per_round is malformed.",
                    status=409,
                    field_path="/state/tool_calls_per_round",
                )
            runtime_state["tool_calls_per_round"] = max(observed_tool_calls, runtime_tool_calls)
            _merge_runtime_counter(runtime_state, record["state"], "run_creations")
            authorization_budget = record["state"].get("authorization_budget")
            if isinstance(authorization_budget, dict):
                usage_limits = {
                    "model_calls": authorization_budget.get("max_model_calls"),
                    "tool_calls_per_round": authorization_budget.get("max_tool_calls_per_round"),
                    "run_creations": authorization_budget.get("max_run_creations"),
                }
                for usage_name, limit in usage_limits.items():
                    usage_value = runtime_state.get(usage_name, 0)
                    if (
                        isinstance(limit, int)
                        and not isinstance(limit, bool)
                        and isinstance(usage_value, int)
                        and not isinstance(usage_value, bool)
                        and usage_value > limit
                    ):
                        raise AgentFlowError(
                            "authorization_budget_exhausted",
                            f"Flow transition exceeds the authorized {usage_name} budget.",
                            status=409,
                            field_path=f"/authorization/usage/{usage_name}",
                        )
            # Include time spent inside the optional runtime itself.  If the
            # transition crossed the signed deadline, discard its apparent
            # success and persist a terminal budget failure instead of
            # allowing a late graph result to consume an expired grant.
            elapsed_after = _elapsed_execution_ms(record.get("created_at"))
            runtime_state["execution_time_ms"] = max(
                int(ledger_state.get("execution_time_ms", 0) or 0),
                elapsed_after,
            )
            timeout_after = False
            budget = record["state"].get("authorization_budget")
            if isinstance(budget, dict):
                limit = budget.get("max_execution_time_ms")
                timeout_after = (
                    action not in {"cancel", "reject"}
                    and isinstance(limit, int)
                    and not isinstance(limit, bool)
                    and elapsed_after >= limit
                )
            if timeout_after:
                runtime_state = ledger_state
                runtime_state["execution_time_ms"] = max(
                    int(runtime_state.get("execution_time_ms", 0) or 0),
                    elapsed_after,
                )
                runtime_state["authorization_status"] = "exhausted"
                runtime_state["graph_status"] = "failed"
                runtime_state["approval_status"] = "not_required"
                runtime_state["pending_user_action"] = None
                runtime_state["current_node"] = "authorization_check"
                runtime_state["terminal_reason"] = "execution_time_budget_exhausted"
                transition_event = {
                    "type": "terminal",
                    "node": "authorization_check",
                    "reason": "execution_time_budget_exhausted",
                    "status": "failed",
                }
            else:
                transition_event = result["event"]
            _validate_runtime_navigation_state(runtime_state)
            if (
                runtime_state.get("flow_id") != flow_id
                or runtime_state.get("session_id") != record["state"].get("session_id")
                or not binding_matches(record["state"], runtime_state)
                or runtime_state.get("graph_status") not in FLOW_STATUSES
                or runtime_state.get("pending_user_action") not in {None, "clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation"}
            ):
                raise AgentFlowError(
                    "langgraph_checkpoint_mismatch",
                    "The optional LangGraph checkpoint identity or state is not compatible with the durable flow.",
                    status=409,
                )
            if (
                self.runtime_mode == "langgraph_sqlite_local"
                and runtime_state.get("terminal_reason") == "flow_is_not_waiting_for_user"
            ):
                # The optional framework checkpoint has already advanced, but
                # the Bridge flow/replay row is still waiting. Treat this as a
                # durable checkpoint mismatch rather than manufacturing a
                # refused terminal flow from an unknown response outcome.
                raise AgentFlowError(
                    "langgraph_checkpoint_mismatch",
                    "The LangGraph checkpoint is ahead of the durable flow state; refusing to mutate the flow.",
                    status=409,
                )
            state = runtime_state
            next_sequence = int(record["sequence"]) + 1
            state["event_sequence"] = next_sequence
            event = _enrich_event(flow_id, state, transition_event, sequence=next_sequence, principal=principal, workspace_id=workspace_id)
            try:
                response, replayed = self.store.transition_resume(
                    flow_id,
                    idempotency_key,
                    digest,
                    state=state,
                    status=str(state.get("graph_status")),
                    event=event,
                    response_factory=lambda updated: {
                        **_public(updated),
                        "action": action,
                        "idempotent_replay": False,
                        "events": [event],
                    },
                )
            except AgentFlowStoreError as error:
                raise AgentFlowError(error.code, str(error), status=error.status, retryable=error.retryable) from error
            if replayed:
                return response, True
            return response, False
