"""Model-backed intent proposal adapter with a strict, read-only boundary."""
from __future__ import annotations

import json
import re
from typing import Any

from . import assistant_model
from .assistant_model import ProviderError, ProviderStructuredOutputError, ProviderUnavailableError, ProviderTimeoutError
from services.agent_orchestrator import PUBLISHED_PAGE_BY_ID

PROTOCOL = "tilesim.agent_intent.v1"
SCHEMA_IDENTITY = "tilesim.agent_intent.response.v1"
REQUEST_SCHEMA_IDENTITY = "tilesim.agent_intent.request.v1"
CONTRACT_REVISION = "2026-10-28.agent-intent.v1"
INTENTS = frozenset({"explain", "existing_run_analysis", "user_report", "configuration_draft", "navigation", "simulation_execution", "unsupported_execution"})
_SCHEMA_SET_REVISION = re.compile(r"^sha256:[0-9a-f]{64}$")

SYSTEM_PROMPT = """You classify a TileSim user goal. Return exactly one JSON object matching tilesim.agent_intent.response.v1.
Use only intent enum values and page entries supplied by the request. Candidate pages must be copied from page_catalog;
never invent routes or capabilities. Do not include analysis, markdown, user text, credentials, or hidden reasoning.
Execution is only a proposal: never claim that a run was created, started, or executed. If uncertain, use clarification_questions
and a low-risk explain/navigation proposal. Keep reasons and steps concise."""


def _validate_request_catalog(request: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Validate the caller-published page context before invoking the model.

    The HTTP adapter performs the same shape check, but this provider is also
    called directly by tests and optional integrations.  Keeping the boundary
    here prevents a forged current page or duplicate catalog entry from being
    reflected into an otherwise well-formed model response.
    """
    catalog = request.get("page_catalog")
    current = request.get("current_page")
    if not isinstance(catalog, list) or not catalog or len(catalog) > 64 or not isinstance(current, dict):
        raise ProviderStructuredOutputError("The intent request page context is invalid.")
    pages: dict[str, dict[str, Any]] = {}
    for page in catalog:
        if not isinstance(page, dict) or set(page) != {"page_id", "route_name", "capability_ids", "supports_run"}:
            raise ProviderStructuredOutputError("The intent request page catalog is not closed.")
        page_id = page.get("page_id")
        route_name = page.get("route_name")
        capabilities = page.get("capability_ids")
        if (
            not isinstance(page_id, str)
            or not page_id
            or len(page_id) > 128
            or page_id in pages
            or not isinstance(route_name, str)
            or not route_name
            or len(route_name) > 128
            or not isinstance(capabilities, list)
            or len(capabilities) > 64
            or any(not isinstance(capability, str) or not capability or len(capability) > 128 for capability in capabilities)
            or len(set(capabilities)) != len(capabilities)
            or not isinstance(page.get("supports_run"), bool)
        ):
            raise ProviderStructuredOutputError("The intent request page catalog is invalid.")
        published = PUBLISHED_PAGE_BY_ID.get(page_id)
        if published is None or route_name != published.get("route_name"):
            raise ProviderStructuredOutputError("The intent request selected a page outside the published directory.")
        published_capabilities = set(published.get("capabilities", ()))
        if set(capabilities) != published_capabilities or page.get("supports_run") != published.get("supports_run"):
            raise ProviderStructuredOutputError("The intent request page capabilities or run binding do not match the published directory.")
        pages[page_id] = page
    if set(current) != {"page_id", "route_name", "context_revision", "capability_ids"}:
        raise ProviderStructuredOutputError("The intent request current page is not closed.")
    current_id = current.get("page_id")
    if (
        not isinstance(current_id, str)
        or current_id not in pages
        or current.get("route_name") != pages[current_id]["route_name"]
        or current.get("capability_ids") != pages[current_id]["capability_ids"]
        or not isinstance(current.get("context_revision"), str)
        or not current["context_revision"]
        or len(current["context_revision"]) > 256
    ):
        raise ProviderStructuredOutputError("The intent request current page is invalid.")
    return pages


def validate_request(
    request: dict[str, Any],
    schema_set_revision: str,
    expected_backend_identity: dict[str, Any] | None = None,
) -> None:
    """Validate the complete intent request before any model call.

    The HTTP handler performs a cheap envelope check, but that check must not
    become the contract validator: malformed identity fields (for example a
    lone run context revision or an untagged digest) would otherwise reach the
    Provider and be reflected into a response.  Keep this boundary equivalent
    to the published JSON schema and fail closed before transport invocation.
    """

    if not isinstance(request, dict):
        raise ProviderStructuredOutputError("The intent request must be an object.")
    allowed = {
        "schema_identity",
        "contract_revision",
        "session_id",
        "user_goal",
        "current_page",
        "page_catalog",
        "run_id",
        "run_context_revision",
        "backend_identity",
        "schema_set_revision",
        "input_snapshot_digest",
    }
    if set(request) != allowed:
        raise ProviderStructuredOutputError("The intent request is not closed.")
    if request.get("schema_identity") != REQUEST_SCHEMA_IDENTITY or request.get("contract_revision") != CONTRACT_REVISION:
        raise ProviderStructuredOutputError("The intent request identity is stale.")
    session_id = request.get("session_id")
    if not isinstance(session_id, str) or not session_id.strip() or len(session_id) > 128:
        raise ProviderStructuredOutputError("The intent request session identity is invalid.")
    user_goal = request.get("user_goal")
    if not isinstance(user_goal, str) or not user_goal.strip() or len(user_goal) > 20_000:
        raise ProviderStructuredOutputError("The intent request goal is invalid.")
    run_id = request.get("run_id")
    run_context_revision = request.get("run_context_revision")
    if run_id is not None and (not isinstance(run_id, str) or not run_id.strip() or len(run_id) > 128):
        raise ProviderStructuredOutputError("The intent request run identity is invalid.")
    if run_context_revision is not None and (
        not isinstance(run_context_revision, str) or not run_context_revision.strip() or len(run_context_revision) > 256
    ):
        raise ProviderStructuredOutputError("The intent request run context revision is invalid.")
    if (run_id is None) != (run_context_revision is None):
        raise ProviderStructuredOutputError("The intent request run identity must be paired with its context revision.")
    backend_identity = request.get("backend_identity")
    if not isinstance(backend_identity, dict):
        raise ProviderStructuredOutputError("The intent request backend identity is invalid.")
    if expected_backend_identity is not None and backend_identity != expected_backend_identity:
        raise ProviderStructuredOutputError("The intent request backend identity is stale.")
    supplied_schema_revision = request.get("schema_set_revision")
    if not isinstance(supplied_schema_revision, str) or not _SCHEMA_SET_REVISION.fullmatch(supplied_schema_revision):
        raise ProviderStructuredOutputError("The intent request schema-set revision is invalid.")
    if supplied_schema_revision != schema_set_revision:
        raise ProviderStructuredOutputError("The intent request schema-set revision is stale.")
    input_digest = request.get("input_snapshot_digest")
    if input_digest is not None and (not isinstance(input_digest, str) or not _SCHEMA_SET_REVISION.fullmatch(input_digest)):
        raise ProviderStructuredOutputError("The intent request input snapshot digest is invalid.")
    _validate_request_catalog(request)


def _json_output(reply: Any) -> dict[str, Any]:
    if not isinstance(reply, dict):
        raise ProviderStructuredOutputError("The intent Provider did not return a JSON object.")
    choices = reply.get("choices")
    if not isinstance(choices, list) or len(choices) != 1 or not isinstance(choices[0], dict):
        raise ProviderStructuredOutputError("The intent Provider returned an invalid completion.")
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise ProviderStructuredOutputError("The intent Provider returned an empty completion.")
    try:
        value = json.loads(content)
    except (TypeError, ValueError) as error:
        raise ProviderStructuredOutputError("The intent Provider returned invalid structured output.") from error
    if not isinstance(value, dict):
        raise ProviderStructuredOutputError("The intent Provider returned an invalid structured output.")
    return value


def _validate_response(value: dict[str, Any], request: dict[str, Any], schema_set_revision: str) -> dict[str, Any]:
    allowed = {"schema_identity", "contract_revision", "schema_set_revision", "protocol", "session_id", "user_goal", "intent", "current_page_id", "current_context_revision", "run_id", "run_context_revision", "backend_identity", "input_snapshot_digest", "candidate_pages", "required_capabilities", "risk_level", "requires_user_confirmation", "suggested_steps", "clarification_questions"}
    required = allowed - {"schema_identity", "contract_revision", "schema_set_revision", "protocol", "session_id", "user_goal", "current_page_id", "current_context_revision", "run_id", "run_context_revision", "backend_identity", "input_snapshot_digest"}
    if set(value) - allowed or not required.issubset(value) or value.get("intent") not in INTENTS:
        raise ProviderStructuredOutputError("The intent Provider output was outside the contract.")
    catalog = _validate_request_catalog(request)
    # The caller publishes the catalog, but keep the provider boundary closed
    # as well: a forged request cannot turn an arbitrary URL/function name into
    # an executable navigation target.
    for page_id, page in catalog.items():
        published = PUBLISHED_PAGE_BY_ID.get(page_id)
        if published is None or page.get("route_name") != published.get("route_name"):
            raise ProviderStructuredOutputError("The intent request selected a page outside the published directory.")
        declared = page.get("capability_ids")
        if not isinstance(declared, list) or set(declared) != set(published.get("capabilities", ())):
            raise ProviderStructuredOutputError("The intent request selected an unavailable page capability.")
    candidates = value.get("candidate_pages")
    if not isinstance(candidates, list) or len(candidates) > 32:
        raise ProviderStructuredOutputError("The intent Provider returned invalid candidate pages.")
    checked = []
    candidate_ids: set[str] = set()
    for item in candidates:
        if not isinstance(item, dict) or set(item) != {"page_id", "route_name", "required_capabilities", "reason"}:
            raise ProviderStructuredOutputError("The intent Provider returned an invalid candidate page.")
        page = catalog.get(item.get("page_id"))
        if page is None or item.get("route_name") != page.get("route_name"):
            raise ProviderStructuredOutputError("The intent Provider selected a page outside the published catalog.")
        if item["page_id"] in candidate_ids:
            raise ProviderStructuredOutputError("The intent Provider repeated a candidate page.")
        candidate_ids.add(item["page_id"])
        capabilities = item.get("required_capabilities")
        if (
            not isinstance(capabilities, list)
            or len(capabilities) > 64
            or len(set(capabilities)) != len(capabilities)
            or any(not isinstance(cap, str) or not cap or len(cap) > 128 for cap in capabilities)
            or any(cap not in page.get("capability_ids", []) for cap in capabilities)
            or not isinstance(item.get("reason"), str)
            or not item["reason"].strip()
            or len(item["reason"]) > 500
        ):
            raise ProviderStructuredOutputError("The intent Provider selected an unavailable capability.")
        checked.append({"page_id": page["page_id"], "route_name": page["route_name"], "required_capabilities": capabilities, "reason": str(item["reason"])[:500]})
    required_capabilities = value.get("required_capabilities")
    all_capabilities = {c for page in request["page_catalog"] for c in page.get("capability_ids", [])}
    if (
        not isinstance(required_capabilities, list)
        or len(required_capabilities) > 64
        or len(set(required_capabilities)) != len(required_capabilities)
        or any(not isinstance(cap, str) or not cap or len(cap) > 128 or cap not in all_capabilities for cap in required_capabilities)
    ):
        raise ProviderStructuredOutputError("The intent Provider returned an unavailable capability.")
    if value.get("risk_level") not in {"low", "medium", "high", "critical"}:
        raise ProviderStructuredOutputError("The intent Provider returned an invalid risk level.")
    if not isinstance(value.get("requires_user_confirmation"), bool):
        raise ProviderStructuredOutputError("The intent Provider returned an invalid confirmation marker.")
    steps = value.get("suggested_steps")
    if not isinstance(steps, list) or len(steps) > 16:
        raise ProviderStructuredOutputError("The intent Provider returned invalid suggested steps.")
    allowed_step_kinds = {"navigate", "observe", "clarify", "authorize", "execute", "report"}
    checked_steps = []
    for step in steps:
        if not isinstance(step, dict) or set(step) != {"kind", "description", "page_id"}:
            raise ProviderStructuredOutputError("The intent Provider returned an invalid suggested step.")
        if step.get("kind") not in allowed_step_kinds:
            raise ProviderStructuredOutputError("The intent Provider returned an unpublished suggested step kind.")
        description = step.get("description")
        if not isinstance(description, str) or not description.strip() or len(description) > 500:
            raise ProviderStructuredOutputError("The intent Provider returned an invalid suggested step description.")
        step_page = step.get("page_id")
        if step_page is not None and (not isinstance(step_page, str) or step_page not in catalog):
            raise ProviderStructuredOutputError("The intent Provider returned a suggested page outside the catalog.")
        checked_steps.append({"kind": step["kind"], "description": description, "page_id": step_page})
    questions = value.get("clarification_questions")
    if (
        not isinstance(questions, list)
        or len(questions) > 8
        or any(not isinstance(question, str) or not question.strip() or len(question) > 500 for question in questions)
    ):
        raise ProviderStructuredOutputError("The intent Provider returned invalid clarification questions.")
    if value.get("risk_level") not in {"low", "medium", "high", "critical"}:
        raise ProviderStructuredOutputError("The intent Provider returned an invalid risk level.")
    if not isinstance(value.get("requires_user_confirmation"), bool):
        raise ProviderStructuredOutputError("The intent Provider returned an invalid confirmation flag.")
    steps = value.get("suggested_steps")
    if not isinstance(steps, list) or len(steps) > 16:
        raise ProviderStructuredOutputError("The intent Provider returned invalid suggested steps.")
    step_kinds = {"navigate", "observe", "clarify", "authorize", "execute", "report"}
    for step in steps:
        if not isinstance(step, dict) or set(step) != {"kind", "description", "page_id"}:
            raise ProviderStructuredOutputError("The intent Provider returned an invalid suggested step.")
        if step.get("kind") not in step_kinds or not isinstance(step.get("description"), str) or not step["description"].strip() or len(step["description"]) > 500:
            raise ProviderStructuredOutputError("The intent Provider returned an invalid suggested step.")
        page_id = step.get("page_id")
        if page_id is not None and page_id not in catalog:
            raise ProviderStructuredOutputError("The intent Provider suggested a page outside the catalog.")
    questions = value.get("clarification_questions")
    if not isinstance(questions, list) or len(questions) > 8 or any(not isinstance(question, str) or not question.strip() or len(question) > 500 for question in questions):
        raise ProviderStructuredOutputError("The intent Provider returned invalid clarification questions.")
    # Bind all identity fields to the request; the model cannot forge them.
    result = dict(value)
    result.update({"schema_identity": SCHEMA_IDENTITY, "contract_revision": CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "protocol": PROTOCOL, "session_id": request["session_id"], "user_goal": request["user_goal"], "current_page_id": request["current_page"]["page_id"], "current_context_revision": request["current_page"]["context_revision"], "run_id": request.get("run_id"), "run_context_revision": request.get("run_context_revision"), "backend_identity": request["backend_identity"], "input_snapshot_digest": request.get("input_snapshot_digest"), "candidate_pages": checked, "required_capabilities": required_capabilities, "suggested_steps": checked_steps, "clarification_questions": questions})
    return result


def classify(
    request: dict[str, Any],
    schema_set_revision: str,
    *,
    transport=None,
    expected_backend_identity: dict[str, Any] | None = None,
    scope: str | None = None,
    config: assistant_model.AssistantModelConfig | None = None,
) -> dict[str, Any]:
    validate_request(request, schema_set_revision, expected_backend_identity)
    config = config or assistant_model.config_from_environment(scope)
    if config is None:
        raise ProviderUnavailableError("No assistant model channel is configured.")
    payload = {"model": config.model, "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": json.dumps(request, ensure_ascii=False, separators=(",", ":"))}], "response_format": {"type": "json_object"}, "stream": False}
    reply = (transport or assistant_model.post_json)(assistant_model._provider_config(config), payload)
    return _validate_response(_json_output(reply), request, schema_set_revision)
