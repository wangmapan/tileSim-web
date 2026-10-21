"""Stage 3A controlled execution contract and workflow helpers.

The execution surface is deliberately narrow: one validated draft, one human
approval, one idempotent submit command and one Bridge run.  This module owns
contract validation and the redacted execution record; the actual run remains
owned by the existing ``/api/runs`` endpoint and run repository.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .contracts import HarnessContractError, POLICY_REVISION, canonical_sha256


EXECUTION_CONTRACT_REVISION = "2026-10-18.wpc.v1"
EXECUTION_SCHEMA_IDENTITIES = {
    "request": "tilesim.agent_harness.execution_request.v1",
    "operation": "tilesim.agent_harness.execution_operation.v1",
    "event": "tilesim.agent_harness.execution_event.v1",
    "result": "tilesim.agent_harness.execution_result_reference.v1",
    "mutation": "tilesim.agent_harness.execution_mutation_request.v1",
}

EXECUTION_STATES = {
    "submitted",
    "queued",
    "preparing",
    "running",
    "waiting_artifacts",
    "completed",
    "failed",
    "cancel_requested",
    "cancelled",
    "retrying",
    "recovery_required",
    "manual_intervention_required",
}
EXECUTION_TERMINAL_STATES = {
    "completed",
    "failed",
    "cancelled",
    "recovery_required",
    "manual_intervention_required",
}
EXECUTION_CANCELABLE_STATES = {"queued", "preparing", "running", "waiting_artifacts"}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_string(value: Any, pointer: str, label: str, *, max_length: int = 256) -> str:
    if not isinstance(value, str) or not value or len(value) > max_length:
        raise HarnessContractError("invalid_field", f"{label} must be a bounded non-empty string.", pointer)
    return value


def _require_digest(value: Any, pointer: str, label: str) -> str:
    value = _require_string(value, pointer, label)
    if len(value) != 71 or not value.startswith("sha256:"):
        raise HarnessContractError("invalid_digest", f"{label} must be a canonical sha256 digest.", pointer)
    return value


def validate_submit_request(
    document: dict[str, Any],
    *,
    principal: str,
    workspace_id: str,
    schema_set_revision: str,
    backend_identity: dict[str, Any],
) -> dict[str, Any]:
    """Validate the closed submit envelope before any side effect is started."""

    allowed = {
        "schema_identity",
        "contract_revision",
        "draft_id",
        "approval_id",
        "validation_id",
        "draft_digest",
        "approval_digest",
        "input_snapshot_digest",
        "schema_set_revision",
        "backend_identity",
        "policy_revision",
        "workflow_revision",
        "create_run_request",
        "create_run_request_digest",
        "principal",
        "workspace_id",
        "idempotency_key",
    }
    unknown = sorted(set(document) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", "Unknown execution submit field is rejected.", f"/{unknown[0]}")
    if document.get("schema_identity", EXECUTION_SCHEMA_IDENTITIES["request"]) != EXECUTION_SCHEMA_IDENTITIES["request"]:
        raise HarnessContractError("schema_revision_mismatch", "Execution request schema identity is not current.", "/schema_identity")
    if document.get("contract_revision", EXECUTION_CONTRACT_REVISION) != EXECUTION_CONTRACT_REVISION:
        raise HarnessContractError("schema_revision_mismatch", "Execution contract revision is not current.", "/contract_revision")
    if document.get("principal", principal) != principal:
        raise HarnessContractError("principal_forbidden", "Execution principal does not match the local subject.", "/principal", status=403)
    if document.get("workspace_id", workspace_id) != workspace_id:
        raise HarnessContractError("principal_forbidden", "Execution workspace does not match the local workspace.", "/workspace_id", status=403)
    if document.get("schema_set_revision") != schema_set_revision:
        raise HarnessContractError("schema_revision_mismatch", "Execution schema-set revision is not current.", "/schema_set_revision")
    if document.get("backend_identity") != backend_identity:
        raise HarnessContractError("backend_identity_mismatch", "Execution backend identity is not current.", "/backend_identity")
    if document.get("policy_revision", POLICY_REVISION) != POLICY_REVISION:
        raise HarnessContractError("policy_revision_mismatch", "Execution policy revision is not current.", "/policy_revision")
    workflow_revision = _require_string(document.get("workflow_revision", EXECUTION_CONTRACT_REVISION), "/workflow_revision", "workflow_revision")
    if workflow_revision != EXECUTION_CONTRACT_REVISION:
        raise HarnessContractError("schema_revision_mismatch", "workflow_revision is not current.", "/workflow_revision")
    for field in ("draft_id", "approval_id", "validation_id"):
        _require_string(document.get(field), f"/{field}", field)
    for field in ("draft_digest", "approval_digest", "input_snapshot_digest", "create_run_request_digest"):
        _require_digest(document.get(field), f"/{field}", field)
    request = document.get("create_run_request")
    if not isinstance(request, dict) or not request:
        raise HarnessContractError("invalid_field", "create_run_request must be a non-empty object.", "/create_run_request")
    key = document.get("idempotency_key")
    if key is not None:
        _require_string(key, "/idempotency_key", "idempotency_key")
    return {
        **document,
        "schema_identity": EXECUTION_SCHEMA_IDENTITIES["request"],
        "contract_revision": EXECUTION_CONTRACT_REVISION,
        "principal": principal,
        "workspace_id": workspace_id,
        "policy_revision": POLICY_REVISION,
        "workflow_revision": workflow_revision,
    }


def request_digest(request: dict[str, Any]) -> str:
    return canonical_sha256(request)


def validate_mutation_request(document: dict[str, Any], *, operation_id: str, action: str, idempotency_key: str) -> dict[str, Any]:
    allowed = {"schema_identity", "contract_revision", "operation_id", "action", "idempotency_key"}
    unknown = sorted(set(document) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", "Unknown execution mutation field is rejected.", f"/{unknown[0]}")
    if document.get("schema_identity") != EXECUTION_SCHEMA_IDENTITIES["mutation"]:
        raise HarnessContractError("schema_revision_mismatch", "Execution mutation schema identity is not current.", "/schema_identity")
    if document.get("contract_revision") != EXECUTION_CONTRACT_REVISION:
        raise HarnessContractError("schema_revision_mismatch", "Execution mutation contract revision is not current.", "/contract_revision")
    if document.get("operation_id") != operation_id:
        raise HarnessContractError("payload_conflict", "Mutation operation_id does not match the path.", "/operation_id")
    if document.get("action") != action:
        raise HarnessContractError("payload_conflict", "Mutation action does not match the path.", "/action")
    if document.get("idempotency_key") != idempotency_key:
        raise HarnessContractError("idempotency_key_mismatch", "Mutation idempotency_key must match Idempotency-Key.", "/idempotency_key")
    return document


def execution_operation(
    *,
    operation_id: str,
    execution_id: str,
    draft_id: str,
    approval_id: str,
    validation_id: str,
    draft_digest: str,
    approval_digest: str,
    input_snapshot_digest: str,
    schema_set_revision: str,
    backend_identity: dict[str, Any],
    policy_revision: str,
    workflow_revision: str,
    idempotency_key: str,
    request_digest_value: str,
    principal: str,
    workspace_id: str,
    state: str = "submitted",
) -> dict[str, Any]:
    now = _iso_now()
    return {
        "schema_identity": EXECUTION_SCHEMA_IDENTITIES["operation"],
        "contract_revision": EXECUTION_CONTRACT_REVISION,
        "execution_id": execution_id,
        "operation_id": operation_id,
        "draft_id": draft_id,
        "approval_id": approval_id,
        "validation_id": validation_id,
        "draft_digest": draft_digest,
        "approval_digest": approval_digest,
        "input_snapshot_digest": input_snapshot_digest,
        "schema_set_revision": schema_set_revision,
        "backend_identity": backend_identity,
        "policy_revision": policy_revision,
        "workflow_revision": workflow_revision,
        "idempotency_key": idempotency_key,
        "request_digest": request_digest_value,
        "principal": principal,
        "workspace_id": workspace_id,
        "run_id": None,
        "state": state,
        "created_at": now,
        "updated_at": now,
        "attempt_count": 0,
        "retryable": False,
        "unknown_outcome": False,
        "cancellation_fence": None,
        "result": None,
        "error": None,
    }


def event_payload_digest(payload: dict[str, Any]) -> str:
    # Payloads are intentionally digests only in the durable event log.
    return canonical_sha256(payload)


def result_reference(
    *,
    operation: dict[str, Any],
    run: dict[str, Any],
    manifest: dict[str, Any],
    manifest_digest: str,
) -> dict[str, Any]:
    artifacts = []
    for item in manifest.get("artifacts", []):
        artifacts.append(
            {
                "artifact_id": item.get("artifact_id"),
                "file_name": item.get("file_name"),
                "schema_identity": item.get("schema_identity"),
                "bytes": item.get("bytes"),
                "sha256": item.get("sha256"),
                "contract_status": item.get("contract_status"),
                "content_status": item.get("content_status"),
            }
        )
    return {
        "schema_identity": EXECUTION_SCHEMA_IDENTITIES["result"],
        "contract_revision": EXECUTION_CONTRACT_REVISION,
        "operation_id": operation["operation_id"],
        "execution_id": operation["execution_id"],
        "draft_id": operation["draft_id"],
        "approval_id": operation["approval_id"],
        "run_id": run.get("run_id"),
        "run_status": run.get("status"),
        "manifest_schema_identity": manifest.get("schema_version"),
        "manifest_digest": manifest_digest,
        "schema_set_revision": manifest.get("schema_set_revision"),
        "requested_fidelity": run.get("fidelity_policy"),
        "resolved_fidelity": run.get("resolved_fidelity_policy", run.get("fidelity_policy")),
        "provenance": run.get("trace_provenance") or run.get("provenance") or {"source_mode": "synthetic_trace", "claim_scope": "exploratory"},
        "artifacts": artifacts,
        "rejected_artifacts": manifest.get("rejected_artifacts", []),
    }
