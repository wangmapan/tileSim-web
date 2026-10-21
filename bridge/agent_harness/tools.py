"""Closed, read-only Agent Harness tool registry and permission gateway."""

from __future__ import annotations

import hashlib
import json
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


class ToolGatewayError(ValueError):
    def __init__(self, code: str, message: str, field_path: str | None = None, *, status: int = 403, retryable: bool = False, unknown_outcome: bool = False):
        super().__init__(message)
        self.code = code
        self.field_path = field_path
        self.status = status
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome


def catalog(*, schema_set_revision: str, backend_identity: Any) -> dict[str, Any]:
    return {
        "schema_identity": "tilesim.agent_harness.tool_catalog.v1",
        "contract_revision": TOOL_REGISTRY_REVISION,
        "schema_set_revision": schema_set_revision,
        "backend_identity": backend_identity,
        "tools": [
            {"tool_name": item.name, "tool_revision": item.revision, "required_scope": item.scope,
             "timeout_ms": item.timeout_ms, "retryable": item.retryable, "description": item.description,
             "input_schema": {"type": "object", "additionalProperties": False},
             "output_schema": {"type": "object", "additionalProperties": False},
             "permission": {"allow_shell": False, "allow_arbitrary_path": False, "allow_arbitrary_url": False, "allow_network": False}}
            for item in TOOL_DEFINITIONS.values()
        ],
        "write_tools": [],
    }


def _closed_input(tool: ToolDefinition, payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ToolGatewayError("invalid_tool_input", "Tool input must be an object.", "/input", status=400)
    allowed = {"run_id", "snapshot_digest", "artifact_id", "json_pointers", "principal", "scope", "idempotency_key"}
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise ToolGatewayError("unknown_field", "Tool input is closed.", f"/input/{unknown[0]}", status=400)
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
