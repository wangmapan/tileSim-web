"""Safety-bounded single-agent orchestration state and LangGraph adapter.

This module deliberately does not activate LangGraph as a Bridge server
runtime dependency.  ``bridge/requirements.txt`` is an explicit, pinned
optional environment for review and future integration; the standard Bridge
process does not import it automatically.  The pure transition engine below
is the reviewable state contract; ``build_langgraph_graph`` compiles the same
node layout only when a pinned LangGraph installation and durable checkpointer
are explicitly provided, and otherwise fails closed.  It never owns runs,
artifacts, citations, or user configuration.
"""

from __future__ import annotations

from copy import deepcopy
import re
from pathlib import Path
import threading
from typing import Any, TypedDict
from uuid import uuid4


ORCHESTRATOR_IDENTITY = "tilesim.agent.single_orchestrator.v1"
ORCHESTRATOR_NODE_ORDER = (
    "receive_input",
    "normalize_intent",
    "clarify_if_needed",
    "capability_gate",
    "load_current_context",
    "deterministic_validate",
    "prepare_evidence",
    "await_user_confirmation",
    "execute_report_action",
    "mark_report_ready",
    "terminal",
)

# Navigation is deliberately represented as route identities, never URLs or
# callable names.  This is the same closed page vocabulary published by the
# Web router; a model may select one of these ids but cannot invent a route.
PUBLISHED_PAGE_DIRECTORY: tuple[dict[str, Any], ...] = tuple(
    {
        "page_id": page_id,
        "route_name": page_id,
        "capabilities": tuple(capabilities),
        # Keep the run-binding policy in the Bridge-side published directory
        # as well as in the Web catalog. The intent provider must not be able
        # to forge this bit by sending a modified page catalog.
        "supports_run": page_id not in {"evidence_lab", "design_space", "history", "experiment"},
    }
    for page_id, capabilities in (
        ("overview", ("overview",)),
        ("execution", ("execution", "run_bound")),
        ("replay", ("execution_replay", "run_bound")),
        ("metrics", ("metrics", "run_bound")),
        ("fabric", ("fabric", "run_bound")),
        ("attribution", ("attribution", "run_bound")),
        ("validation", ("validation", "run_bound")),
        ("raw_evidence", ("raw_evidence", "run_bound")),
        ("evidence_agent", ("evidence_agent", "run_bound")),
        ("evidence_lab", ("evidence_lab",)),
        ("design_space", ("design_space",)),
        ("history", ("history",)),
        ("experiment", ("experiment", "configuration")),
    )
)
PUBLISHED_PAGE_BY_ID = {item["page_id"]: item for item in PUBLISHED_PAGE_DIRECTORY}
NAVIGATION_MAX_ATTEMPTS = 8
NAVIGATION_OBSERVATION_KEYS = frozenset(
    {
        "target_page",
        "actual_page",
        "page_correct",
        "current_page_capabilities",
        "current_run_id",
        "current_context_revision",
        "failure_type",
        "retry_allowed",
    }
)

SUPPORTED_INTENTS = frozenset(
    {
        "explain_current_page",
        "analyze_existing_run",
        "generate_user_run_report",
        "configure_experiment_draft",
        "navigate_page",
        "unsupported_execution_request",
    }
)
TERMINAL_STATUSES = frozenset({"completed", "draft_ready", "stale", "refused", "cancelled", "failed"})
WAITING_STATUSES = frozenset({"waiting_user"})


class AgentOrchestratorState(TypedDict, total=False):
    """Small JSON-serializable state envelope shared by transitions and LangGraph."""

    session_id: str
    flow_id: str
    user_goal: str
    intent: str
    route_name: str
    run_id: str | None
    run_context_revision: str | None
    backend_identity: dict[str, Any] | None
    schema_set_revision: str | None
    input_snapshot_digest: str | None
    # Immutable authorization identity and the explicit runtime budget.  The
    # flow adapter binds these values to every durable transition; the graph
    # itself never invents a default permission envelope.
    authorization_id: str | None
    authorization_digest: str | None
    authorization_budget: dict[str, int] | None
    authorization_status: str
    artifact_bindings: list[dict[str, Any]]
    validation: dict[str, Any]
    evidence_status: str
    approval_status: str
    pending_user_action: str | None
    report_status: str
    graph_status: str
    current_node: str
    terminal_reason: str | None
    event_sequence: int
    last_event: dict[str, Any]
    # Navigation fields are bounded, JSON-safe observations.  They never
    # contain a URL, router instruction, raw provider output, or callable.
    current_page: str | None
    current_page_capabilities: list[str]
    current_context_revision: str | None
    required_capabilities: list[str]
    allowed_pages: list[str]
    allowed_actions: list[str]
    visited_pages: list[str]
    navigation_attempts: int
    max_navigation_attempts: int
    navigation_failures: list[dict[str, Any]]
    last_navigation_observation: dict[str, Any] | None
    navigation_target: str | None
    navigation_observation: dict[str, Any] | None
    # Runtime usage counters are carried through every deterministic
    # transition so the flow authorization projection never resets to zero
    # after a checkpoint or resume.
    model_calls: int
    tool_calls_per_round: int
    run_creations: int
    execution_time_ms: int


class AgentOrchestratorResult(TypedDict):
    state: AgentOrchestratorState
    event: dict[str, Any]


class LangGraphDependencyUnavailable(RuntimeError):
    """Raised instead of silently substituting another graph runtime."""

    code = "langgraph_dependency_unavailable"


class LangGraphCheckpointerRequired(RuntimeError):
    """Raised when an interrupt-capable graph is built without persistence."""

    code = "langgraph_checkpointer_required"


class LangGraphRuntimeUnavailable(RuntimeError):
    """Raised when the explicitly requested HTTP runtime cannot be loaded."""

    code = "langgraph_runtime_unavailable"


class LangGraphSqliteRuntime:
    """Small, explicitly opt-in LangGraph runtime for local development.

    The public Bridge flow store remains the API/event source of truth.  This
    class only owns the framework checkpoint needed to resume an interrupted
    graph after a process restart.  It is deliberately constructed by the
    server only when the caller opts into the pinned optional dependency.
    """

    mode = "langgraph_sqlite_local"

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        try:
            from langgraph.checkpoint.sqlite import SqliteSaver
        except ImportError as error:  # pragma: no cover - dependency-gated
            raise LangGraphRuntimeUnavailable(
                "The pinned LangGraph SQLite checkpointer is not installed."
            ) from error
        self._context = SqliteSaver.from_conn_string(str(self.path))
        try:
            self._checkpointer = self._context.__enter__()
            self._graph = build_langgraph_graph(checkpointer=self._checkpointer)
        except Exception:
            self._context.__exit__(*__import__("sys").exc_info())
            raise

    def close(self) -> None:
        with self._lock:
            if self._context is not None:
                self._context.__exit__(None, None, None)
                self._context = None

    @staticmethod
    def _config(flow_id: str) -> dict[str, Any]:
        return {"configurable": {"thread_id": flow_id}}

    @staticmethod
    def _pending(snapshot: Any) -> tuple[str | None, str | None]:
        for task in getattr(snapshot, "tasks", ()) or ():
            for item in getattr(task, "interrupts", ()) or ():
                value = getattr(item, "value", None)
                if isinstance(value, dict):
                    pending = value.get("pending_user_action")
                    if isinstance(pending, str) and pending:
                        node = {
                            "clarify_intent": "clarify_if_needed",
                            "confirm_report": "await_user_confirmation",
                            "confirm_draft": "await_user_confirmation",
                        }.get(pending, "await_user_confirmation")
                        return pending, node
        return None, None

    def _snapshot_state(self, flow_id: str, *, require: bool = True) -> tuple[dict[str, Any], Any]:
        snapshot = self._graph.get_state(self._config(flow_id))
        values = deepcopy(getattr(snapshot, "values", None) or {})
        if require and not values:
            raise LangGraphRuntimeUnavailable(
                "The durable LangGraph checkpoint for this flow is missing."
            )
        pending, node = self._pending(snapshot)
        if pending:
            # LangGraph checkpoints the state immediately before the node that
            # called interrupt().  Surface the node's waiting state in the
            # Bridge envelope without mutating the framework checkpoint.
            values["graph_status"] = "waiting_user"
            values["pending_user_action"] = pending
            values["current_node"] = node
        return values, snapshot

    @staticmethod
    def _event(state: AgentOrchestratorState) -> dict[str, Any]:
        last = state.get("last_event") or {}
        if state.get("graph_status") == "waiting_user":
            return {
                "type": "interrupt",
                "node": state.get("current_node") or "await_user_confirmation",
                "reason": state.get("pending_user_action") or "user_action_required",
            }
        if state.get("graph_status") in TERMINAL_STATUSES:
            return {
                "type": "terminal",
                "node": state.get("current_node") or "terminal",
                "reason": state.get("terminal_reason"),
                "status": state.get("graph_status"),
            }
        return {
            "type": str(last.get("type") or "stage"),
            "node": state.get("current_node") or last.get("node") or "receive_input",
            **({"reason": last["reason"]} if last.get("reason") else {}),
        }

    def start(self, state: AgentOrchestratorState) -> AgentOrchestratorResult:
        with self._lock:
            if self._snapshot_state(state["flow_id"], require=False)[0]:
                raise LangGraphRuntimeUnavailable("A durable checkpoint already exists for this flow id.")
            self._graph.invoke(state, self._config(state["flow_id"]))
            values, _ = self._snapshot_state(state["flow_id"])
            return {"state": values, "event": self._event(values)}  # type: ignore[return-value]

    def resume(
        self,
        flow_id: str,
        action: str,
        *,
        current_binding: dict[str, Any],
        intent: str | None = None,
        navigation_observation: dict[str, Any] | None = None,
    ) -> AgentOrchestratorResult:
        with self._lock:
            values, snapshot = self._snapshot_state(flow_id)
            if not getattr(snapshot, "next", ()):
                return _blocked(values, "flow_is_not_waiting_for_user", "terminal")
            from langgraph.types import Command

            resume_value: dict[str, Any] = {"action": action, "current_binding": current_binding}
            if intent is not None:
                resume_value["intent"] = intent
            if navigation_observation is not None:
                resume_value["navigation_observation"] = navigation_observation
            self._graph.invoke(Command(resume=resume_value), self._config(flow_id))
            next_values, _ = self._snapshot_state(flow_id)
            return {"state": next_values, "event": self._event(next_values)}  # type: ignore[return-value]


def _event(state: AgentOrchestratorState, event_type: str, node: str, reason: str | None = None) -> dict[str, Any]:
    sequence = int(state.get("event_sequence", 0)) + 1
    result: dict[str, Any] = {"sequence": sequence, "type": event_type, "node": node}
    if reason:
        result["reason"] = reason
    return result


def _result(state: AgentOrchestratorState, event: dict[str, Any]) -> AgentOrchestratorResult:
    state["event_sequence"] = int(event["sequence"])
    state["last_event"] = event
    return {"state": state, "event": event}


def _copy(state: AgentOrchestratorState) -> AgentOrchestratorState:
    return deepcopy(state)


def page_directory() -> list[dict[str, Any]]:
    """Return the immutable, model-visible page directory.

    The result is copied so callers cannot mutate the server's allow-list.  A
    page id is an internal route identity; it is intentionally not a URL and
    is never interpreted as a function name.
    """

    return [
        {"page_id": item["page_id"], "route_name": item["route_name"], "capabilities": list(item["capabilities"])}
        for item in PUBLISHED_PAGE_DIRECTORY
    ]


def _safe_page_id(value: Any) -> str | None:
    if not isinstance(value, str) or value not in PUBLISHED_PAGE_BY_ID:
        return None
    return value


def _validate_navigation_history(value: Any, allowed_pages: Any) -> str | None:
    """Validate durable navigation history without repairing it in place.

    A checkpoint is an authorization-bound audit record, not user input that
    can be normalized by dropping entries.  Silently filtering an unknown or
    unauthorized page would make a corrupted/old checkpoint look like a fresh
    flow and could permit a second attempt that the durable history intended
    to fence.  Return a stable reason for the caller to reject the cycle.
    """

    if value is None:
        return None
    if not isinstance(value, (list, tuple)):
        return "visited_pages_not_a_sequence"
    if len(value) > NAVIGATION_MAX_ATTEMPTS:
        return "visited_pages_exceed_navigation_limit"
    seen: set[str] = set()
    allowed = set(allowed_pages) if isinstance(allowed_pages, (list, tuple, set)) else set()
    for page in value:
        if _safe_page_id(page) is None:
            return "visited_page_not_published"
        if page in seen:
            return "visited_pages_duplicate"
        if page not in allowed:
            return "visited_page_not_authorized"
        seen.add(page)
    return None


def _validate_navigation_allowlist(value: Any) -> str | None:
    """Reject malformed/unknown authorization pages instead of narrowing them."""

    if not isinstance(value, (list, tuple, set)):
        return "navigation_allowlist_required"
    if not value:
        return "navigation_allowlist_empty"
    if len(value) > 32:
        return "navigation_allowlist_exceeds_limit"
    normalized = list(value)
    if any(_safe_page_id(page) is None for page in normalized):
        return "navigation_page_not_published"
    if len(set(normalized)) != len(normalized):
        return "navigation_allowlist_duplicate"
    return None


def _safe_capabilities(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple, set)):
        return []
    result = sorted({item for item in value if isinstance(item, str) and item and len(item) <= 128})
    return result[:32]


def select_navigation_target(
    candidates: Any,
    *,
    required_capabilities: Any = (),
    allowed_pages: Any = (),
    visited_pages: Any = (),
) -> str | None:
    """Select the first safe page from a model-proposed candidate list.

    Candidate order is meaningful (the model's ranked plan), but every entry is
    checked against the published directory, explicit authorization and the
    no-repeat fence.  Unknown pages and malformed entries are ignored rather
    than interpreted as URLs or router commands.
    """

    if not isinstance(candidates, (list, tuple)):
        return None
    required = set(_safe_capabilities(required_capabilities))
    allowed = set(_safe_page_id(item) for item in allowed_pages) if isinstance(allowed_pages, (list, tuple, set)) else set()
    visited = set(_safe_page_id(item) for item in visited_pages) if isinstance(visited_pages, (list, tuple, set)) else set()
    for candidate in candidates:
        page_id = candidate.get("page_id") if isinstance(candidate, dict) else candidate
        page_id = _safe_page_id(page_id)
        if page_id is None or page_id in visited or page_id not in allowed:
            continue
        capabilities = set(PUBLISHED_PAGE_BY_ID[page_id]["capabilities"])
        if required and not required.issubset(capabilities):
            continue
        return page_id
    return None


def _navigation_observation(
    *,
    target_page: str | None,
    actual_page: str | None,
    page_correct: bool,
    current_page_capabilities: Any,
    current_run_id: str | None,
    current_context_revision: str | None,
    failure_type: str | None,
    retry_allowed: bool,
    visited_pages: Any = (),
    navigation_attempts: int = 0,
) -> dict[str, Any]:
    """Build a closed, bounded observation returned by a navigation attempt."""

    target = _safe_page_id(target_page)
    actual = _safe_page_id(actual_page)
    if target is None:
        raise ValueError("navigation_target_not_published")
    return {
        "target_page": target,
        "actual_page": actual,
        "page_correct": bool(page_correct),
        "current_page_capabilities": _safe_capabilities(current_page_capabilities),
        "current_run_id": current_run_id if isinstance(current_run_id, str) else None,
        "current_context_revision": current_context_revision if isinstance(current_context_revision, str) else None,
        "failure_type": failure_type if isinstance(failure_type, str) and failure_type else None,
        "retry_allowed": bool(retry_allowed),
        "visited_pages": [item for item in (_safe_page_id(value) for value in visited_pages) if item][:NAVIGATION_MAX_ATTEMPTS],
        "navigation_attempts": max(0, min(int(navigation_attempts), NAVIGATION_MAX_ATTEMPTS)),
    }


def _record_navigation_failure(state: AgentOrchestratorState, observation: Any) -> None:
    """Copy one bounded failed observation into the durable navigation history.

    The browser executor may try more than one authorized candidate during a
    single user-approved turn.  Keep the failure summary on the flow state so
    a later status read can explain why replanning happened; successful
    observations are not failures and are intentionally omitted.
    """

    if not isinstance(observation, dict) or observation.get("page_correct") is True:
        return
    page = observation.get("target_page")
    if not isinstance(page, str) or page not in PUBLISHED_PAGE_BY_ID:
        return
    failure_type = observation.get("failure_type")
    failure = {
        "page": page,
        "type": failure_type if isinstance(failure_type, str) and failure_type else "page_mismatch",
    }
    failures = state.get("navigation_failures")
    if not isinstance(failures, list):
        failures = []
    # A page is fenced after its first attempt.  Do not create duplicate
    # durable entries if a replayed observation reaches the pure transition.
    if not any(isinstance(item, dict) and item.get("page") == page for item in failures):
        failures.append(failure)
    state["navigation_failures"] = failures[-NAVIGATION_MAX_ATTEMPTS:]


def execute_navigation_cycle(
    state: AgentOrchestratorState,
    candidates: Any,
    *,
    navigate,
    read_context,
    required_capabilities: Any = None,
    allowed_pages: Any = None,
    max_attempts: int | None = None,
) -> AgentOrchestratorResult:
    """Navigate through a bounded ranked plan and re-read page context.

    ``navigate`` and ``read_context`` are deterministic application adapters;
    they receive/return page identities and context data only.  The model
    cannot provide a URL or invoke either callback.  Every failed attempt is
    recorded, a page is never attempted twice, and identity changes stop the
    cycle as stale before another candidate is tried.
    """

    current = _copy(state)
    configured_allowed = allowed_pages if allowed_pages is not None else current.get("allowed_pages")
    # A navigation cycle without an explicit allow-list is not safe.  The
    # caller may obtain the list from the published page directory, but this
    # function must not silently broaden an authorization envelope.
    allowlist_error = _validate_navigation_allowlist(configured_allowed)
    if allowlist_error:
        return _blocked(current, "navigation_allowlist_invalid", "authorization_check")
    current["allowed_pages"] = sorted(configured_allowed)
    history_error = _validate_navigation_history(current.get("visited_pages", []), current["allowed_pages"])
    if history_error:
        return _blocked(current, "navigation_history_invalid", "authorization_check")
    configured_actions = current.get("allowed_actions")
    if (
        not isinstance(configured_actions, (list, tuple, set))
        or list(configured_actions) != ["navigate"]
    ):
        return _blocked(current, "navigation_action_not_authorized", "authorization_check")
    # Navigation is granted only by the single explicit action.  Do not
    # silently discard extra/unknown action grants from a corrupted envelope.
    current["allowed_actions"] = ["navigate"]
    current["required_capabilities"] = _safe_capabilities(
        required_capabilities if required_capabilities is not None else current.get("required_capabilities", [])
    )
    # The history was validated above; preserve it exactly rather than
    # silently dropping entries from a durable checkpoint.
    current["visited_pages"] = list(current.get("visited_pages", []))
    current["navigation_failures"] = [
        item for item in current.get("navigation_failures", []) if isinstance(item, dict)
    ][-NAVIGATION_MAX_ATTEMPTS:]
    current["navigation_attempts"] = max(0, int(current.get("navigation_attempts", 0) or 0))
    configured_max = max_attempts if max_attempts is not None else current.get("max_navigation_attempts")
    if isinstance(configured_max, bool) or not isinstance(configured_max, int) or configured_max <= 0:
        return _blocked(current, "navigation_budget_invalid", "authorization_check")
    current["max_navigation_attempts"] = min(configured_max, NAVIGATION_MAX_ATTEMPTS)

    while current["navigation_attempts"] < current["max_navigation_attempts"]:
        target = select_navigation_target(
            candidates,
            required_capabilities=current["required_capabilities"],
            allowed_pages=current["allowed_pages"],
            visited_pages=current["visited_pages"],
        )
        if target is None:
            current["graph_status"] = "waiting_user"
            current["pending_user_action"] = None
            current["current_node"] = "replan"
            current["terminal_reason"] = "navigation_no_safe_candidate"
            return _result(current, _event(current, "interrupt", "replan", "navigation_no_safe_candidate"))

        current["navigation_attempts"] += 1
        current["visited_pages"].append(target)
        failure_type: str | None = None
        try:
            navigate(target)
        except Exception as error:  # adapter failures are observations, not uncaught control flow
            failure_type = "navigation_error"
            current["navigation_failures"].append({"page": target, "type": failure_type, "detail": str(error)[:160]})

        try:
            observed = read_context()
        except Exception as error:
            observed = {}
            failure_type = failure_type or "context_unavailable"
            current["navigation_failures"].append({"page": target, "type": failure_type, "detail": str(error)[:160]})
        if not isinstance(observed, dict):
            observed = {}
            failure_type = failure_type or "context_invalid"
        actual_page = _safe_page_id(observed.get("page_id") or observed.get("route_name"))
        capabilities = _safe_capabilities(observed.get("capabilities") or observed.get("supported_actions"))
        actual_run = observed.get("run_id") if isinstance(observed.get("run_id"), str) else None
        actual_revision = observed.get("context_revision") if isinstance(observed.get("context_revision"), str) else None
        stale_reason = None
        if current.get("run_id") is not None and actual_run != current.get("run_id"):
            stale_reason = "run_binding_changed_during_navigation"
        elif current.get("run_context_revision") is not None and actual_revision != current.get("run_context_revision"):
            stale_reason = "context_revision_changed_during_navigation"
        elif current.get("backend_identity") is not None and observed.get("backend_identity") != current.get("backend_identity"):
            stale_reason = "backend_identity_changed_during_navigation"
        elif current.get("schema_set_revision") is not None and observed.get("schema_set_revision") != current.get("schema_set_revision"):
            stale_reason = "schema_revision_changed_during_navigation"
        elif current.get("input_snapshot_digest") is not None and observed.get("input_snapshot_digest") != current.get("input_snapshot_digest"):
            stale_reason = "input_snapshot_changed_during_navigation"
        elif "artifact_bindings" in observed and observed.get("artifact_bindings") != current.get("artifact_bindings", []):
            stale_reason = "artifact_binding_changed_during_navigation"
        if stale_reason:
            observation = _navigation_observation(
                target_page=target,
                actual_page=actual_page,
                page_correct=False,
                current_page_capabilities=capabilities,
                current_run_id=actual_run,
                current_context_revision=actual_revision,
                failure_type="stale_identity",
                retry_allowed=False,
                visited_pages=current["visited_pages"],
                navigation_attempts=current["navigation_attempts"],
            )
            current["last_navigation_observation"] = observation
            current["navigation_failures"].append({"page": target, "type": "stale_identity"})
            return _terminal(current, "stale", stale_reason, "verifying_context")
        page_correct = actual_page == target and not failure_type
        missing = set(current["required_capabilities"]) - set(capabilities)
        if missing:
            failure_type = failure_type or "capability_missing"
            page_correct = False
        observation = _navigation_observation(
            target_page=target,
            actual_page=actual_page,
            page_correct=page_correct,
            current_page_capabilities=capabilities,
            current_run_id=actual_run,
            current_context_revision=actual_revision,
            failure_type=failure_type,
            retry_allowed=current["navigation_attempts"] < current["max_navigation_attempts"],
            visited_pages=current["visited_pages"],
            navigation_attempts=current["navigation_attempts"],
        )
        current["last_navigation_observation"] = observation
        current["current_page"] = actual_page
        current["current_page_capabilities"] = capabilities
        current["current_context_revision"] = actual_revision
        if page_correct:
            current["navigation_target"] = target
            current["current_node"] = "verifying_context"
            return _result(current, _event(current, "stage", "verifying_context"))
        current["navigation_failures"].append({"page": target, "type": failure_type or "page_mismatch"})

    current["graph_status"] = "waiting_user"
    current["pending_user_action"] = None
    current["current_node"] = "replan"
    current["terminal_reason"] = "navigation_budget_exhausted"
    return _result(current, _event(current, "interrupt", "replan", "navigation_budget_exhausted"))


def new_state(
    *,
    session_id: str,
    user_goal: str,
    flow_id: str | None = None,
    context: dict[str, Any] | None = None,
) -> AgentOrchestratorState:
    """Create a bounded state without hashing or inventing canonical input identity."""

    context = context or {}
    allowed_pages = context.get("allowed_pages")
    if isinstance(allowed_pages, (list, tuple, set)):
        normalized_allowed_pages = sorted({_safe_page_id(item) for item in allowed_pages if _safe_page_id(item)})
    else:
        normalized_allowed_pages = []
    max_navigation_attempts = context.get("max_navigation_attempts")
    if isinstance(max_navigation_attempts, bool) or not isinstance(max_navigation_attempts, int):
        max_navigation_attempts = 0
    else:
        max_navigation_attempts = max(0, min(max_navigation_attempts, NAVIGATION_MAX_ATTEMPTS))
    navigation_attempts = context.get("navigation_attempts")
    if isinstance(navigation_attempts, bool) or not isinstance(navigation_attempts, int):
        navigation_attempts = 0
    else:
        navigation_attempts = max(0, min(navigation_attempts, NAVIGATION_MAX_ATTEMPTS))
    return {
        "session_id": session_id,
        # A caller that already owns a durable flow may provide its identity in
        # the context.  Keep the explicit argument authoritative, while still
        # allowing the pure/LangGraph adapter to carry one stable flow id into
        # its interrupt payload and resume binding.
        "flow_id": flow_id or context.get("flow_id") or f"flow-{uuid4().hex}",
        "user_goal": user_goal,
        "intent": str(context.get("intent") or ""),
        "route_name": str(context.get("route_name") or ""),
        "run_id": context.get("run_id"),
        "run_context_revision": context.get("run_context_revision"),
        "backend_identity": deepcopy(context.get("backend_identity")),
        "schema_set_revision": context.get("schema_set_revision"),
        # ``None`` means unavailable.  The graph never hashes inputs locally.
        "input_snapshot_digest": context.get("input_snapshot_digest"),
        "authorization_id": context.get("authorization_id"),
        "authorization_digest": context.get("authorization_digest"),
        "authorization_budget": deepcopy(context.get("authorization_budget")) if isinstance(context.get("authorization_budget"), dict) else None,
        # Read-only flows have no authorization envelope, but the internal
        # state still needs a published status value.  Serialising an empty
        # string makes an otherwise valid checkpoint indistinguishable from
        # corruption once the durable flow validator enforces the closed
        # authorization-state enum.
        "authorization_status": str(context.get("authorization_status") or "active"),
        "artifact_bindings": deepcopy(context.get("artifact_bindings") or []),
        "validation": deepcopy(context.get("validation") or {}),
        "evidence_status": str(context.get("evidence_status") or "missing"),
        "approval_status": "not_required",
        "pending_user_action": None,
        "report_status": "not_started",
        "graph_status": "created",
        "current_node": "receive_input",
        "terminal_reason": None,
        "event_sequence": 0,
        "last_event": {},
        "current_page": _safe_page_id(context.get("current_page") or context.get("route_name")),
        "current_page_capabilities": _safe_capabilities(context.get("current_page_capabilities")),
        "current_context_revision": context.get("current_context_revision") or context.get("run_context_revision"),
        "required_capabilities": _safe_capabilities(context.get("required_capabilities")),
        "allowed_pages": normalized_allowed_pages,
        "allowed_actions": _safe_capabilities(context.get("allowed_actions")),
        "visited_pages": [
            item
            for item in (
                _safe_page_id(value)
                for value in (context.get("visited_pages", []) if isinstance(context.get("visited_pages", []), (list, tuple, set)) else [])
            )
            if item
        ][:NAVIGATION_MAX_ATTEMPTS],
        "navigation_attempts": navigation_attempts,
        "max_navigation_attempts": max_navigation_attempts,
        "navigation_failures": [],
        "last_navigation_observation": None,
        "navigation_target": None,
        "model_calls": max(0, int(context.get("model_calls", 0) or 0)),
        "tool_calls_per_round": max(0, int(context.get("tool_calls_per_round", 0) or 0)),
        "run_creations": max(0, int(context.get("run_creations", 0) or 0)),
        "execution_time_ms": max(0, int(context.get("execution_time_ms", 0) or 0)),
    }


def _terminal(state: AgentOrchestratorState, status: str, reason: str, node: str) -> AgentOrchestratorResult:
    state["graph_status"] = status
    state["terminal_reason"] = reason
    state["pending_user_action"] = None
    event_type = status if status in {"stale", "refused", "cancelled", "failed"} else "terminal"
    event = _event(state, event_type, node, reason)
    event["status"] = status
    return _result(state, event)


def _blocked(state: AgentOrchestratorState, reason: str, node: str) -> AgentOrchestratorResult:
    state["graph_status"] = "refused"
    state["approval_status"] = "not_required"
    return _terminal(state, "refused", reason, node)


def receive_input(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if not state.get("session_id") or not state.get("user_goal"):
        return _blocked(state, "session_and_user_goal_required", "receive_input")
    state["graph_status"] = "running"
    state["current_node"] = "receive_input"
    return _result(state, _event(state, "stage", "receive_input"))


def normalize_intent(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES:
        return _result(state, state.get("last_event") or _event(state, "terminal", "normalize_intent"))
    # Intent classification belongs to the model-backed, closed-world intent
    # endpoint. The deterministic orchestrator must never infer an action from
    # user prose when a caller omitted or supplied an unknown intent: keyword
    # guessing could turn a failed classification into an execution, report,
    # or configuration flow. Keep the value empty so the next node emits the
    # published clarification interrupt.
    if state.get("intent") not in SUPPORTED_INTENTS:
        state["intent"] = ""
    state["route_name"] = state.get("intent", "")
    state["current_node"] = "normalize_intent"
    return _result(state, _event(state, "stage", "normalize_intent"))


def clarify_if_needed(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES:
        return _result(state, state.get("last_event") or _event(state, "terminal", "clarify_if_needed"))
    if state.get("intent") not in SUPPORTED_INTENTS:
        state["graph_status"] = "waiting_user"
        state["pending_user_action"] = "clarify_intent"
        state["current_node"] = "clarify_if_needed"
        return _result(state, _event(state, "interrupt", "clarify_if_needed", "intent_required"))
    state["current_node"] = "clarify_if_needed"
    return _result(state, _event(state, "stage", "clarify_if_needed"))


def capability_gate(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "capability_gate"))
    state["current_node"] = "capability_gate"
    if state.get("intent") == "unsupported_execution_request":
        # This flow is a read-only planning surface.  An authorization
        # envelope must never turn an execution request into a successful
        # flow: run creation belongs to the separate, explicitly gated
        # execution surface, which is not connected here.  Refuse both
        # authorized and unauthorized requests so the durable status cannot
        # be mistaken for an executed or accepted simulation.
        return _blocked(state, "execution_not_supported_read_only", "capability_gate")
    return _result(state, _event(state, "stage", "capability_gate"))


def load_current_context(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "load_current_context"))
    state["current_node"] = "load_current_context"
    if state.get("intent") in {"analyze_existing_run", "generate_user_run_report"}:
        required = ("run_id", "run_context_revision", "backend_identity", "schema_set_revision")
        if any(not state.get(field) for field in required):
            return _blocked(state, "run_context_binding_required", "load_current_context")
    return _result(state, _event(state, "stage", "load_current_context"))


def _valid_artifact_bindings(bindings: object) -> bool:
    if not isinstance(bindings, list):
        return False
    for binding in bindings:
        if not isinstance(binding, dict):
            return False
        if not all(isinstance(binding.get(field), str) and binding[field] for field in ("artifact_id", "schema_identity", "sha256")):
            return False
        bytes_value = binding.get("bytes")
        if type(bytes_value) is int:
            valid_bytes = bytes_value >= 0
        elif isinstance(bytes_value, str):
            valid_bytes = bool(re.fullmatch(r"(?:0|[1-9][0-9]*)", bytes_value))
        else:
            valid_bytes = False
        if not valid_bytes:
            return False
    return True


def deterministic_validate(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "deterministic_validate"))
    state["current_node"] = "deterministic_validate"
    if state.get("input_snapshot_digest") is not None and not isinstance(state.get("input_snapshot_digest"), str):
        return _blocked(state, "input_snapshot_digest_unavailable_or_invalid", "deterministic_validate")
    if state.get("intent") in {"analyze_existing_run", "generate_user_run_report"}:
        if not _valid_artifact_bindings(state.get("artifact_bindings")):
            return _blocked(state, "artifact_identity_missing", "deterministic_validate")
        validation = state.get("validation") or {}
        validation_status = validation.get("status")
        if validation_status in {"invalid", "refused", "stale", "artifact_mismatch"}:
            return _blocked(state, "evidence_validation_rejected", "deterministic_validate")
        if validation_status == "unsupported_schema":
            return _blocked(state, "unsupported_schema", "deterministic_validate")
    return _result(state, _event(state, "stage", "deterministic_validate"))


def prepare_evidence(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "prepare_evidence"))
    state["current_node"] = "prepare_evidence"
    if state.get("intent") in {"analyze_existing_run", "generate_user_run_report"}:
        evidence_status = state.get("evidence_status")
        if evidence_status == "provider_unavailable":
            state["evidence_status"] = "deterministic_fallback"
        elif evidence_status not in {"validated", "deterministic_fallback", "partial", "truncated"}:
            return _blocked(state, "evidence_unavailable_or_uncited", "prepare_evidence")
        if evidence_status in {"partial", "truncated"}:
            state["report_status"] = "ready_with_limitations"
    return _result(state, _event(state, "stage", "prepare_evidence"))


def await_user_confirmation(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "await_user_confirmation"))
    state["current_node"] = "await_user_confirmation"
    if state.get("intent") == "generate_user_run_report":
        state["graph_status"] = "waiting_user"
        state["approval_status"] = "pending"
        state["pending_user_action"] = "confirm_report"
        return _result(state, _event(state, "interrupt", "await_user_confirmation", "confirm_report"))
    if state.get("intent") == "configure_experiment_draft":
        state["graph_status"] = "waiting_user"
        state["approval_status"] = "pending"
        state["pending_user_action"] = "confirm_draft"
        return _result(state, _event(state, "interrupt", "await_user_confirmation", "confirm_draft"))
    if state.get("intent") == "navigate_page":
        # The browser-side page transition is an explicitly authorized local
        # adapter.  Start the durable flow at a single approval boundary and
        # let the Web executor submit an observation after it has actually
        # read the new page context.  This avoids presenting a second
        # confirmation button while still retaining a replayable checkpoint.
        state["graph_status"] = "waiting_user"
        state["approval_status"] = "pending"
        state["pending_user_action"] = "confirm_navigation"
        state["current_node"] = "await_user_confirmation"
        return _result(state, _event(state, "approval_required", "await_user_confirmation", "confirm_navigation"))
    return _result(state, _event(state, "stage", "await_user_confirmation"))


def execute_report_action(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "execute_report_action"))
    state["current_node"] = "execute_report_action"
    if state.get("intent") == "unsupported_execution_request":
        return _blocked(state, "execution_not_supported_read_only", "execute_report_action")
    if state.get("intent") == "generate_user_run_report":
        if state.get("approval_status") != "confirmed":
            return _blocked(state, "report_confirmation_required", "execute_report_action")
        if state.get("evidence_status") in {"partial", "truncated"}:
            state["report_status"] = "ready_with_limitations"
        else:
            state["report_status"] = "ready"
        return _result(state, _event(state, "stage", "execute_report_action"))
    if state.get("intent") == "configure_experiment_draft":
        state["report_status"] = "not_applicable"
        return _result(state, _event(state, "stage", "execute_report_action"))
    return _result(state, _event(state, "stage", "execute_report_action"))


def mark_report_ready(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    """Mark a validated report result as ready for the presentation layer.

    This transition intentionally does not compose report prose. Evidence
    validation and the user-facing projection remain owned by the report
    feature, so the node name reflects the durable graph's actual boundary.
    """
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") == "waiting_user":
        return _result(state, state.get("last_event") or _event(state, "stage", "mark_report_ready"))
    state["current_node"] = "mark_report_ready"
    if state.get("intent") in {"explain_current_page", "analyze_existing_run"}:
        state["report_status"] = "ready"
    return _result(state, _event(state, "stage", "mark_report_ready"))


def terminal(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    state = _copy(state)
    if state.get("graph_status") in TERMINAL_STATUSES:
        return _result(state, state.get("last_event") or _event(state, "terminal", "terminal"))
    if state.get("intent") == "unsupported_execution_request":
        return _terminal(state, "refused", "execution_not_supported_read_only", "terminal")
    if state.get("intent") == "configure_experiment_draft":
        return _terminal(state, "draft_ready", "draft_ready_no_execution", "terminal")
    return _terminal(state, "completed", "read_only_result_ready", "terminal")


_NODE_FUNCTIONS = {
    "receive_input": receive_input,
    "normalize_intent": normalize_intent,
    "clarify_if_needed": clarify_if_needed,
    "capability_gate": capability_gate,
    "load_current_context": load_current_context,
    "deterministic_validate": deterministic_validate,
    "prepare_evidence": prepare_evidence,
    "await_user_confirmation": await_user_confirmation,
    "execute_report_action": execute_report_action,
    "mark_report_ready": mark_report_ready,
    "terminal": terminal,
}


def run_until_pause(state: AgentOrchestratorState) -> AgentOrchestratorResult:
    """Advance deterministically until an interrupt or terminal state."""

    current = _copy(state)
    start = current.get("current_node") or ORCHESTRATOR_NODE_ORDER[0]
    try:
        index = ORCHESTRATOR_NODE_ORDER.index(start)
    except ValueError:
        return _blocked(current, "unknown_orchestrator_node", "terminal")
    last: AgentOrchestratorResult | None = None
    for node in ORCHESTRATOR_NODE_ORDER[index:]:
        last = _NODE_FUNCTIONS[node](current)
        current = last["state"]
        if current.get("graph_status") in TERMINAL_STATUSES or current.get("graph_status") in WAITING_STATUSES:
            return last
    return last or _terminal(current, "failed", "empty_orchestrator_graph", "terminal")


def binding_matches(expected: AgentOrchestratorState, current: dict[str, Any]) -> bool:
    """Compare every identity the graph is allowed to resume against."""

    fields = (
        "session_id",
        "flow_id",
        "run_id",
        "run_context_revision",
        "backend_identity",
        "schema_set_revision",
        "input_snapshot_digest",
    )
    for field in fields:
        if expected.get(field) != current.get(field):
            return False
    return expected.get("artifact_bindings", []) == current.get("artifact_bindings", [])


def resume(
    state: AgentOrchestratorState,
    action: str,
    *,
    current_binding: dict[str, Any] | None = None,
    intent: str | None = None,
    navigation_observation: dict[str, Any] | None = None,
) -> AgentOrchestratorResult:
    """Resume or terminate an interrupted flow after rechecking all bindings."""

    current = _copy(state)
    if current.get("graph_status") != "waiting_user":
        return _blocked(current, "flow_is_not_waiting_for_user", "terminal")
    # A resume is an identity-sensitive operation even for terminal actions
    # such as cancel/reject.  The HTTP adapter validates this before calling
    # us, but this pure entry point is also used directly by the optional
    # LangGraph adapter and must not allow an omitted or malformed binding to
    # bypass the stale check.  Keep the flow paused so callers can retry with
    # an explicit current snapshot instead of guessing identity.
    required_binding_fields = (
        "session_id",
        "flow_id",
        "run_id",
        "run_context_revision",
        "backend_identity",
        "schema_set_revision",
        "input_snapshot_digest",
        "artifact_bindings",
    )
    if not isinstance(current_binding, dict) or any(field not in current_binding for field in required_binding_fields):
        pending = current.get("pending_user_action")
        current["pending_user_action"] = pending if pending in {"clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation"} else None
        return _result(current, _event(current, "interrupt", current.get("current_node") or "await_user_confirmation", "binding_required"))
    if not binding_matches(current, current_binding):
        return _terminal(current, "stale", "binding_changed_before_resume", "stale")
    if navigation_observation is not None:
        current["navigation_observation"] = deepcopy(navigation_observation)
    # Keep the public action enum aligned with the durable interrupt that is
    # awaiting input.  Without this guard, e.g. ``clarify_intent`` sent to a
    # ``confirm_draft`` checkpoint falls through to the generic invalid-action
    # branch and invents the unpublished ``clarify_resume_action`` pending
    # value, which cannot be represented by the Flow state schema.
    pending = current.get("pending_user_action")
    allowed_pending_actions = {
        "clarify_intent": {"clarify", "clarify_intent"},
        "confirm_report": {"confirm", "confirm_report"},
        "confirm_draft": {"confirm", "confirm_draft"},
        "confirm_navigation": {"confirm_navigation"},
    }
    navigation_observation_action = (
        current.get("intent") == "navigate_page"
        and action == "confirm_navigation"
        and pending is None
        and isinstance(current.get("navigation_observation"), dict)
    )
    if action not in {"cancel", "reject"} and not navigation_observation_action and action not in allowed_pending_actions.get(pending, set()):
        return _result(
            current,
            _event(current, "interrupt", current.get("current_node") or "await_user_confirmation", "wrong_pending_action"),
        )
    if action in {"cancel", "cancelled"}:
        current["approval_status"] = "cancelled"
        return _terminal(current, "cancelled", "user_cancelled", "cancelled")
    if action in {"reject", "refuse", "refused"}:
        current["approval_status"] = "rejected"
        return _terminal(current, "refused", "user_refused", "refused")
    if pending == "clarify_intent":
        if action not in {"clarify", "clarify_intent"} or intent not in SUPPORTED_INTENTS:
            current["pending_user_action"] = "clarify_intent"
            return _result(current, _event(current, "interrupt", "clarify_if_needed", "intent_required"))
        current["intent"] = intent
        current["route_name"] = intent
        current["graph_status"] = "running"
        current["pending_user_action"] = None
        current["current_node"] = "capability_gate"
        return run_until_pause(current)
    if pending == "confirm_navigation":
        observation = current.get("navigation_observation")
        if action != "confirm_navigation" or current.get("intent") != "navigate_page":
            current["pending_user_action"] = pending
            return _result(current, _event(current, "approval_required", "await_user_confirmation", "confirm_navigation"))
        if not isinstance(observation, dict):
            current["approval_status"] = "confirmed"
            current["graph_status"] = "waiting_user"
            current["pending_user_action"] = None
            current["current_node"] = "navigation"
            return _result(current, _event(current, "state_changed", "navigation", "navigation_observation_required"))
        current["pending_user_action"] = None
        current["current_node"] = "verifying_context"
        current["last_navigation_observation"] = deepcopy(observation)
        _record_navigation_failure(current, observation)
        current["current_page"] = observation.get("actual_page")
        current["current_page_capabilities"] = list(observation.get("current_page_capabilities") or [])
        current["current_context_revision"] = observation.get("current_context_revision")
        current["visited_pages"] = list(observation.get("visited_pages") or [])
        current["navigation_attempts"] = int(observation.get("navigation_attempts", 0))
        target = observation.get("target_page")
        if observation.get("failure_type") == "stale_identity":
            return _terminal(current, "stale", "navigation_identity_changed", "verifying_context")
        if observation.get("page_correct") is True:
            current["navigation_target"] = target
            return _terminal(current, "completed", "navigation_completed", "verifying_context")
        current["graph_status"] = "waiting_user"
        current["terminal_reason"] = (
            "navigation_budget_exhausted"
            if current["navigation_attempts"] >= int(current.get("max_navigation_attempts", 0) or 0)
            else "navigation_retry_available"
        )
        if current["terminal_reason"] == "navigation_retry_available":
            current["pending_user_action"] = "confirm_navigation"
        return _result(current, _event(current, "interrupt", "replan", current["terminal_reason"]))
    if navigation_observation_action:
        observation = current["navigation_observation"]
        current["current_node"] = "verifying_context"
        current["last_navigation_observation"] = deepcopy(observation)
        _record_navigation_failure(current, observation)
        current["current_page"] = observation.get("actual_page")
        current["current_page_capabilities"] = list(observation.get("current_page_capabilities") or [])
        current["current_context_revision"] = observation.get("current_context_revision")
        current["visited_pages"] = list(observation.get("visited_pages") or [])
        current["navigation_attempts"] = int(observation.get("navigation_attempts", 0))
        target = observation.get("target_page")
        if observation.get("failure_type") == "stale_identity":
            return _terminal(current, "stale", "navigation_identity_changed", "verifying_context")
        if observation.get("page_correct") is True:
            current["navigation_target"] = target
            return _terminal(current, "completed", "navigation_completed", "verifying_context")
        current["graph_status"] = "waiting_user"
        current["terminal_reason"] = (
            "navigation_budget_exhausted"
            if current["navigation_attempts"] >= int(current.get("max_navigation_attempts", 0) or 0)
            else "navigation_retry_available"
        )
        if current["terminal_reason"] == "navigation_retry_available":
            current["pending_user_action"] = "confirm_navigation"
        return _result(current, _event(current, "interrupt", "replan", current["terminal_reason"]))
    if action not in {"confirm", "confirm_report", "confirm_draft"}:
        # Keep the published pending-action enum intact.  The HTTP adapter
        # rejects unknown actions before reaching this pure transition, but
        # the optional LangGraph adapter can call it directly.  Persisting an
        # invented value such as ``clarify_resume_action`` would make the
        # checkpoint impossible to validate or resume after restart.
        current["pending_user_action"] = pending
        return _result(current, _event(current, "interrupt", "await_user_confirmation", "unknown_resume_action"))
    expected_actions = {
        "confirm_report": {"confirm", "confirm_report"},
        "confirm_draft": {"confirm", "confirm_draft"},
    }
    if pending in expected_actions and action not in expected_actions[pending]:
        current["pending_user_action"] = pending
        return _result(current, _event(current, "interrupt", "await_user_confirmation", "wrong_pending_action"))
    current["approval_status"] = "confirmed"
    current["graph_status"] = "running"
    current["pending_user_action"] = None
    current["current_node"] = "execute_report_action"
    _result(current, _event(current, "resume", "await_user_confirmation", action))
    return run_until_pause(current)


def build_langgraph_graph(*, checkpointer: Any | None = None) -> Any:
    """Compile the node layout with LangGraph when explicitly installed.

    The import is intentionally local: importing the Bridge remains safe when
    the optional environment is absent. There is no fallback pretending to be
    LangGraph; callers must handle the explicit dependency error. Since every
    user pause uses ``interrupt()``, a durable checkpointer is mandatory even
    for a graph that is only used in local review.
    """

    try:
        from langgraph.graph import END, START, StateGraph
        from langgraph.types import interrupt
    except ImportError as error:  # pragma: no cover - environment-dependent branch
        raise LangGraphDependencyUnavailable(
            "LangGraph is not installed; dependency review and deployment pinning are required before activation."
        ) from error
    if checkpointer is None:
        raise LangGraphCheckpointerRequired(
            "An interrupt-capable LangGraph requires an explicit durable checkpointer; refusing an ephemeral graph."
        )

    graph = StateGraph(AgentOrchestratorState)

    def interrupt_payload(state: AgentOrchestratorState) -> dict[str, Any]:
        return {
            "flow_id": state.get("flow_id"),
            "pending_user_action": state.get("pending_user_action"),
            "binding": {
                field: state.get(field)
                for field in (
                    "session_id",
                    "flow_id",
                    "run_id",
                    "run_context_revision",
                    "backend_identity",
                    "schema_set_revision",
                    "input_snapshot_digest",
                    "artifact_bindings",
                )
            },
        }

    def resume_interrupt(prepared: AgentOrchestratorState) -> AgentOrchestratorState:
        """Keep the node paused when a user sends an invalid action.

        LangGraph restarts a node from its beginning after every interrupt
        resume.  If ``resume`` returns another waiting state, ending the node
        would leave a checkpoint with ``next=()`` and no interrupt to resume.
        Looping here creates a fresh interrupt in the same node, preserving a
        durable retry boundary for malformed or wrong-pending actions.
        """

        while prepared.get("graph_status") == "waiting_user":
            resume_value = interrupt(interrupt_payload(prepared))
            if not isinstance(resume_value, dict):
                continue
            current_binding = resume_value.get("current_binding")
            if not isinstance(current_binding, dict):
                # A direct LangGraph caller must echo the current identity
                # binding.  Without it, a stale confirmation (or a terminal
                # mutation after a context change) could bypass the same
                # comparison enforced by the HTTP flow adapter.
                continue
            prepared = resume(
                prepared,
                str(resume_value.get("action") or ""),
                current_binding=current_binding,
                intent=resume_value.get("intent"),
                    navigation_observation=resume_value.get("navigation_observation"),
            )["state"]
        return prepared

    def langgraph_clarification_node(state: AgentOrchestratorState) -> AgentOrchestratorState:
        prepared = clarify_if_needed(state)["state"]
        if prepared.get("graph_status") != "waiting_user":
            return prepared
        return resume_interrupt(prepared)

    def langgraph_confirmation_node(state: AgentOrchestratorState) -> AgentOrchestratorState:
        prepared = await_user_confirmation(state)["state"]
        if prepared.get("graph_status") != "waiting_user":
            return prepared
        return resume_interrupt(prepared)

    for name, function in _NODE_FUNCTIONS.items():
        if name == "clarify_if_needed":
            graph.add_node(name, langgraph_clarification_node)
        elif name == "await_user_confirmation":
            graph.add_node(name, langgraph_confirmation_node)
        else:
            graph.add_node(name, lambda state, function=function: function(state)["state"])
    graph.add_edge(START, "receive_input")

    def next_node(state: AgentOrchestratorState, fallback: str) -> str:
        if state.get("graph_status") in TERMINAL_STATUSES or state.get("graph_status") in WAITING_STATUSES:
            return END
        return fallback

    for left, right in zip(ORCHESTRATOR_NODE_ORDER, ORCHESTRATOR_NODE_ORDER[1:]):
        graph.add_conditional_edges(
            left,
            lambda state, fallback=right: next_node(state, fallback),
            {right: right, END: END},
        )
    graph.add_edge("terminal", END)
    return graph.compile(checkpointer=checkpointer)


def langgraph_runtime_status() -> dict[str, Any]:
    """Expose dependency truth for diagnostics, never as product capability."""

    try:
        import importlib.metadata

        importlib.metadata.version("langgraph")
    except (ImportError, importlib.metadata.PackageNotFoundError):
        return {"available": False, "mode": "dependency_blocked", "identity": ORCHESTRATOR_IDENTITY}
    return {
        "available": True,
        "mode": "optional_unreleased_runtime",
        "identity": ORCHESTRATOR_IDENTITY,
        "version": importlib.metadata.version("langgraph"),
    }
