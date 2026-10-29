"""Closed, read-only Agent Harness tool registry and permission gateway."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any, Callable

from .contracts import canonical_sha256
from .contracts import CONTRACT_REVISION, SCHEMA_IDENTITIES, POLICY_REVISION, utc_now
from .store import DurableHarnessStore, HarnessStoreError

TOOL_REGISTRY_REVISION = "2026-10-17.tools.v1"


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    revision: str
    scope: str
    timeout_ms: int
    retryable: bool
    description: str


TOOL_DEFINITIONS = {
    "get_capability_catalog": ToolDefinition("get_capability_catalog", "1", "agent:read_capability", 2000, True, "Read the published Bridge capability catalog."),
    "get_run_status": ToolDefinition("get_run_status", "1", "agent:read_run", 2000, True, "Read one run's public status and identity."),
    "list_run_evidence": ToolDefinition("list_run_evidence", "1", "agent:read_evidence", 3000, True, "Read a verified artifact manifest for one run."),
    "query_verified_metrics": ToolDefinition("query_verified_metrics", "1", "agent:read_evidence", 3000, True, "Read selected, verified fields from a metrics artifact."),
}

# The model-facing argument contract is deliberately separate from the gateway
# metadata carried by a trusted caller (principal, scope and idempotency).  The
# latter is accepted by ``_closed_input`` for backwards compatibility, but is
# never advertised as a field the model may choose.  Keeping this mapping next
# to the registry means the capability catalogue and the decision-loop
# validator cannot silently drift apart.
TOOL_INPUT_SCHEMAS: dict[str, dict[str, Any]] = {
    "get_capability_catalog": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    },
    "get_run_status": {
        "type": "object",
        "properties": {
            "run_id": {"type": "string", "minLength": 1, "maxLength": 128},
        },
        "required": ["run_id"],
        "additionalProperties": False,
    },
    "list_run_evidence": {
        "type": "object",
        "properties": {
            "run_id": {"type": "string", "minLength": 1, "maxLength": 128},
        },
        "required": ["run_id"],
        "additionalProperties": False,
    },
    "query_verified_metrics": {
        "type": "object",
        "properties": {
            "run_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "artifact_id": {"type": "string", "enum": ["metrics"]},
            "json_pointers": {
                "type": "array",
                "maxItems": 32,
                "items": {"type": "string", "pattern": r"^/"},
            },
        },
        "required": ["run_id"],
        "additionalProperties": False,
    },
}

# These fields are generated/checked by the authenticated gateway.  They are
# intentionally not part of TOOL_INPUT_SCHEMAS: exposing them would let a
# model impersonate a principal or bind a call to a different operation.
_GATEWAY_METADATA_FIELDS = frozenset(
    {"snapshot_digest", "principal", "scope", "idempotency_key"}
)


def _schema_properties(tool_name: str) -> set[str]:
    schema = TOOL_INPUT_SCHEMAS.get(tool_name)
    if not isinstance(schema, dict):
        return set()
    properties = schema.get("properties")
    return set(properties) if isinstance(properties, dict) else set()


def _validate_schema_value(value: Any, schema: dict[str, Any], path: str) -> None:
    """Validate the small closed JSON-schema subset used by the tool gateway."""

    expected = schema.get("type")
    if expected == "string":
        if not isinstance(value, str):
            raise ToolGatewayError("schema_violation", "Expected a string.", path, status=400)
        minimum = schema.get("minLength")
        maximum = schema.get("maxLength")
        if isinstance(minimum, int) and len(value) < minimum:
            raise ToolGatewayError("schema_violation", "String is shorter than the allowed minimum.", path, status=400)
        if isinstance(maximum, int) and len(value) > maximum:
            raise ToolGatewayError("schema_violation", "String exceeds the allowed maximum.", path, status=400)
        enum = schema.get("enum")
        if isinstance(enum, list) and value not in enum:
            raise ToolGatewayError("schema_violation", "Value is not in the allow-list.", path, status=400)
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.search(pattern, value) is None:
            raise ToolGatewayError("schema_violation", "String does not match the required pattern.", path, status=400)
        return
    if expected == "array":
        if not isinstance(value, list):
            raise ToolGatewayError("schema_violation", "Expected an array.", path, status=400)
        maximum = schema.get("maxItems")
        if isinstance(maximum, int) and len(value) > maximum:
            raise ToolGatewayError("schema_violation", "Array contains too many items.", path, status=400)
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                _validate_schema_value(item, item_schema, f"{path}/{index}")
        return
    if expected == "object" and not isinstance(value, dict):
        raise ToolGatewayError("schema_violation", "Expected an object.", path, status=400)


def validate_tool_arguments(tool_name: str, arguments: Any) -> None:
    """Validate model-supplied tool arguments against the published schema.

    This is intentionally fail-closed and side-effect free.  Callers should
    invoke it before dispatching a tool; an invalid call never reaches the
    durable tool-call ledger or the underlying run/artifact readers.
    """

    schema = TOOL_INPUT_SCHEMAS.get(tool_name)
    if schema is None or tool_name not in TOOL_DEFINITIONS:
        raise ToolGatewayError("unknown_tool", "Tool is not published.", "/tool_name")
    if not isinstance(arguments, dict):
        raise ToolGatewayError("schema_violation", "Tool arguments must be an object.", "/arguments", status=400)
    properties = schema.get("properties", {})
    if not isinstance(properties, dict):
        properties = {}
    unknown = sorted(set(arguments) - set(properties))
    if schema.get("additionalProperties") is False and unknown:
        raise ToolGatewayError("schema_violation", "Tool arguments are closed.", f"/arguments/{unknown[0]}", status=400)
    required = schema.get("required", [])
    if isinstance(required, list):
        for key in required:
            if key not in arguments:
                raise ToolGatewayError("schema_violation", f"{key} is required.", f"/arguments/{key}", status=400)
    for key, value in arguments.items():
        rule = properties.get(key)
        if isinstance(rule, dict):
            _validate_schema_value(value, rule, f"/arguments/{key}")


def _assert_schema_registry_consistency() -> None:
    if set(TOOL_INPUT_SCHEMAS) != set(TOOL_DEFINITIONS):
        raise RuntimeError("Tool definitions and input schemas must have identical names.")
    for name, schema in TOOL_INPUT_SCHEMAS.items():
        if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
            raise RuntimeError(f"Tool schema for {name} must be a closed object.")
        properties = schema.get("properties")
        if not isinstance(properties, dict):
            raise RuntimeError(f"Tool schema for {name} must declare properties.")
        required = schema.get("required")
        if not isinstance(required, list) or any(key not in properties for key in required):
            raise RuntimeError(f"Tool schema for {name} has invalid required fields.")


_assert_schema_registry_consistency()


class ToolGatewayError(ValueError):
    def __init__(self, code: str, message: str, field_path: str | None = None, *, status: int = 403, retryable: bool = False, unknown_outcome: bool = False):
        super().__init__(message)
        self.code = code
        self.field_path = field_path
        self.status = status
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome


def catalog(*, schema_set_revision: str, backend_identity: Any) -> dict[str, Any]:
    _assert_schema_registry_consistency()
    return {
        "schema_identity": "tilesim.agent_harness.tool_catalog.v1",
        "contract_revision": TOOL_REGISTRY_REVISION,
        "schema_set_revision": schema_set_revision,
        "backend_identity": backend_identity,
        "tools": [
            {"tool_name": item.name, "tool_revision": item.revision, "required_scope": item.scope,
             "timeout_ms": item.timeout_ms, "retryable": item.retryable, "description": item.description,
             "input_schema": json.loads(json.dumps(TOOL_INPUT_SCHEMAS[item.name])),
             "output_schema": {"type": "object", "additionalProperties": False},
             "permission": {"allow_shell": False, "allow_arbitrary_path": False, "allow_arbitrary_url": False, "allow_network": False}}
            for item in TOOL_DEFINITIONS.values()
        ],
        "write_tools": [],
    }


def _closed_input(tool: ToolDefinition, payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ToolGatewayError("invalid_tool_input", "Tool input must be an object.", "/input", status=400)
    allowed = _schema_properties(tool.name) | _GATEWAY_METADATA_FIELDS
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise ToolGatewayError("schema_violation", "Tool input is closed.", f"/input/{unknown[0]}", status=400)
    model_arguments = {key: value for key, value in payload.items() if key not in _GATEWAY_METADATA_FIELDS}
    validate_tool_arguments(tool.name, model_arguments)
    for metadata_key in _GATEWAY_METADATA_FIELDS & set(payload):
        if not isinstance(payload[metadata_key], str) or not payload[metadata_key]:
            raise ToolGatewayError("schema_violation", f"{metadata_key} must be a non-empty string.", f"/input/{metadata_key}", status=400)
    if tool.name in {"get_run_status", "list_run_evidence", "query_verified_metrics"}:
        if not isinstance(payload.get("run_id"), str) or not payload["run_id"]:
            raise ToolGatewayError("invalid_tool_input", "run_id is required.", "/input/run_id", status=400)
    if tool.name == "query_verified_metrics":
        if payload.get("artifact_id", "metrics") != "metrics":
            raise ToolGatewayError("artifact_not_allowlisted", "Only the verified metrics artifact is allow-listed.", "/input/artifact_id")
        pointers = payload.get("json_pointers", ["/system_summary", "/request_metrics"])
        if not isinstance(pointers, list) or len(pointers) > 32 or any(not isinstance(item, str) or not item.startswith("/") for item in pointers):
            raise ToolGatewayError("invalid_json_pointer", "json_pointers must be a bounded list of JSON Pointers.", "/input/json_pointers", status=400)
    return payload


def _pointer_get(value: Any, pointer: str) -> Any:
    if pointer == "":
        return value
    current = value
    for token in pointer.lstrip("/").split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            raise ToolGatewayError("artifact_pointer_not_found", "Requested JSON Pointer is not present.", f"/input/json_pointers")
    return current


def dispatch(*, store: DurableHarnessStore, operation_id: str, tool_name: str, payload: dict[str, Any],
             principal: str, scopes: set[str], schema_set_revision: str, backend_identity: Any,
             get_catalog: Callable[[], dict[str, Any]], get_run: Callable[[str], dict[str, Any] | None],
             get_manifest: Callable[[str], dict[str, Any]], get_artifact: Callable[[str, str], dict[str, Any]],
             run_owner: Callable[[str, str], bool] | None = None) -> dict[str, Any]:
    tool = TOOL_DEFINITIONS.get(tool_name)
    if tool is None:
        raise ToolGatewayError("unknown_tool", "Tool is not published.", "/tool_name")
    if tool.scope not in scopes:
        raise ToolGatewayError("tool_scope_denied", "Principal does not hold the required tool scope.", "/scope")
    payload = _closed_input(tool, payload)
    if payload.get("scope") and payload["scope"] != tool.scope:
        raise ToolGatewayError("tool_scope_denied", "Requested scope does not match the published tool scope.", "/input/scope")
    if payload.get("principal") and payload["principal"] != principal:
        raise ToolGatewayError("principal_mismatch", "Tool principal does not match the authenticated subject.", "/input/principal")
    run_id = payload.get("run_id")
    if run_id and run_owner and not run_owner(principal, run_id):
        raise ToolGatewayError("run_access_denied", "Run is not owned by the current principal.", "/input/run_id")
    if payload.get("snapshot_digest"):
        run = get_run(run_id) if run_id else None
        if not run or run.get("snapshot_digest") != payload["snapshot_digest"]:
            raise ToolGatewayError("snapshot_mismatch", "Snapshot does not match the bound run.", "/input/snapshot_digest", status=409)
    input_digest = canonical_sha256(payload)
    tool_call_id = f"tool-{hashlib.sha256((operation_id + tool_name + input_digest).encode()).hexdigest()[:20]}"
    previous = store.record_tool_call(operation_id=operation_id, tool_call_id=tool_call_id, tool_name=tool.name,
                                      tool_revision=tool.revision, idempotency_key=payload.get("idempotency_key", input_digest),
                                      input_digest=input_digest, permission_decision="allow")
    if previous and previous.get("outcome"):
        operation = store.get_operation(operation_id) or {}
        return {"schema_identity": SCHEMA_IDENTITIES["tool_result"], "contract_revision": CONTRACT_REVISION,
                "operation_id": operation_id, "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
                "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": operation.get("workflow_state"),
                "schema_set_revision": schema_set_revision, "policy_revision": POLICY_REVISION,
                "backend_identity": backend_identity, "created_at": utc_now(), "updated_at": utc_now(),
                "tool_call_id": tool_call_id, "tool_name": tool.name, "tool_revision": tool.revision,
                "outcome": previous["outcome"], "output_digest": previous.get("output_digest"),
                "retryable": bool(previous.get("retryable")), "terminal_failure": bool(previous.get("terminal_failure")),
                "unknown_outcome": bool(previous.get("unknown_outcome")), "error_code": previous.get("error_code"),
                "field_path": None, "replayed": True}
    try:
        if tool.name == "get_capability_catalog":
            result = get_catalog()
        elif tool.name == "get_run_status":
            result = get_run(run_id)
            if result is None:
                raise ToolGatewayError("run_not_found", "Run was not found.", "/input/run_id", status=404)
        elif tool.name == "list_run_evidence":
            result = get_manifest(run_id)
        else:
            manifest = get_manifest(run_id)
            artifact = get_artifact(run_id, "metrics")
            manifest_entry = next((entry for entry in manifest.get("artifacts", []) if entry.get("artifact_id") == "metrics"), None)
            if manifest_entry is None:
                raise ToolGatewayError("artifact_not_allowlisted", "Metrics is not present in the verified manifest.", "/input/artifact_id", status=409)
            if manifest_entry.get("sha256") and artifact.get("sha256") and manifest_entry["sha256"] != artifact["sha256"]:
                raise ToolGatewayError("artifact_sha_mismatch", "Artifact digest does not match the manifest.", "/artifacts/metrics/sha256", status=409)
            if manifest_entry.get("bytes") is not None and manifest_entry["bytes"] != artifact.get("bytes"):
                raise ToolGatewayError("artifact_bytes_mismatch", "Artifact byte length does not match the manifest.", "/artifacts/metrics/bytes", status=409)
            document = artifact.get("document", artifact)
            result = {pointer: _pointer_get(document, pointer) for pointer in payload.get("json_pointers", ["/system_summary", "/request_metrics"])}
        output_digest = canonical_sha256(result)
        store.finish_tool_call(tool_call_id=tool_call_id, outcome="succeeded", output_digest=output_digest)
        operation = store.get_operation(operation_id) or {}
        return {"schema_identity": SCHEMA_IDENTITIES["tool_result"], "contract_revision": CONTRACT_REVISION,
                "operation_id": operation_id, "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
                "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": operation.get("workflow_state"),
                "schema_set_revision": schema_set_revision, "policy_revision": POLICY_REVISION,
                "backend_identity": backend_identity, "created_at": utc_now(), "updated_at": utc_now(),
                "tool_call_id": tool_call_id, "tool_name": tool.name, "tool_revision": tool.revision,
                "outcome": "succeeded", "output_digest": output_digest, "retryable": False,
                "terminal_failure": False, "unknown_outcome": False, "error_code": None, "field_path": None,
                "result": result, "replayed": False}
    except ToolGatewayError as error:
        store.finish_tool_call(tool_call_id=tool_call_id, outcome="rejected" if not error.retryable else "retryable_failure", error_code=error.code, retryable=error.retryable, terminal_failure=not error.retryable)
        raise
    except Exception:
        store.finish_tool_call(tool_call_id=tool_call_id, outcome="unknown_outcome", error_code="tool_unknown_outcome", unknown_outcome=True)
        raise ToolGatewayError("tool_unknown_outcome", "Tool result could not be safely established.", status=503, retryable=False, unknown_outcome=True)
