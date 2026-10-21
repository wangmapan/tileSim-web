"""Stage-2 draft/validation/approval contracts.

The stage-2 records are intentionally separate from the WP-A operation records.
They contain identities, digests and bounded summaries only; the complete run
request is never persisted by the Harness.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
import re

from .contracts import (
    HarnessContractError,
    POLICY_REVISION,
    STAGE2_SCHEMA_IDENTITIES,
    SUCCESSOR_CONTRACT_REVISION,
    canonical_sha256,
)

VALIDATION_STATUSES = {"valid", "invalid", "unsupported", "unavailable", "stale", "expired", "rejected"}
DRAFT_STATUSES = {"draft", "validated", "invalid", "unsupported", "unavailable", "stale", "expired", "deleted"}
APPROVAL_STATUSES = {"pending", "approved", "rejected", "expired", "revoked", "stale"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_id(value: Any, pointer: str, label: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 256:
        raise HarnessContractError("invalid_field", f"{label} must be a bounded non-empty string.", pointer)
    return value


def require_digest(value: Any, pointer: str, label: str) -> str:
    value = require_id(value, pointer, label)
    if not value.startswith("sha256:") or len(value) != 71:
        raise HarnessContractError("invalid_digest", f"{label} must be a canonical sha256 digest.", pointer)
    return value


def require_identity(value: Any, pointer: str = "/backend_identity") -> dict[str, Any]:
    if not isinstance(value, dict) or not value or len(value) > 32:
        raise HarnessContractError("invalid_backend_identity", "backend_identity must be a bounded object.", pointer)
    if any(not isinstance(k, str) or len(k) > 96 for k in value):
        raise HarnessContractError("invalid_backend_identity", "backend_identity contains an invalid key.", pointer)
    return value


def _closed_object(value: Any, pointer: str, label: str, allowed: set[str], *, optional: bool = False) -> dict[str, Any]:
    if value is None and optional:
        return {}
    if not isinstance(value, dict):
        raise HarnessContractError("invalid_field", f"{label} must be an object.", pointer)
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", f"Unknown {label} field is rejected.", f"{pointer}/{unknown[0]}")
    return value


def validate_stage2_create(document: dict[str, Any], *, principal: str, workspace_id: str,
                           schema_set_revision: str, backend_identity: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "draft_id", "operation_id", "conversation_id", "turn_id", "principal", "workspace_id", "run_scope",
        "input_snapshot_digest", "schema_set_revision", "backend_identity", "parameter_catalog_revision",
        "validator_revision", "policy_revision", "field_diffs", "assumptions", "evidence_refs", "budget_request",
        "risk_flags", "expires_at", "create_run_request", "request", "idempotency_key",
    }
    unknown = sorted(set(document) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", "Unknown draft field is rejected.", f"/{unknown[0]}")
    if document.get("principal", principal) != principal:
        raise HarnessContractError("principal_mismatch", "Draft principal does not match the local subject.", "/principal", status=403)
    if document.get("workspace_id", workspace_id) != workspace_id:
        raise HarnessContractError("workspace_mismatch", "Draft workspace does not match the local workspace.", "/workspace_id", status=403)
    if document.get("schema_set_revision") != schema_set_revision:
        raise HarnessContractError("schema_revision_mismatch", "Draft schema-set revision is not current.", "/schema_set_revision")
    if document.get("backend_identity") != backend_identity:
        raise HarnessContractError("backend_identity_mismatch", "Draft backend identity is not current.", "/backend_identity")
    if document.get("policy_revision", POLICY_REVISION) != POLICY_REVISION:
        raise HarnessContractError("policy_revision_mismatch", "Draft policy revision is not current.", "/policy_revision")
    require_digest(document.get("input_snapshot_digest"), "/input_snapshot_digest", "input_snapshot_digest")
    for field in ("parameter_catalog_revision", "validator_revision"):
        require_id(document.get(field), f"/{field}", field)
    require_id(document.get("run_scope"), "/run_scope", "run_scope")
    for field in ("field_diffs", "assumptions", "evidence_refs", "risk_flags"):
        value = document.get(field, [] if field != "budget_request" else {})
        if not isinstance(value, list) or len(value) > 256:
            raise HarnessContractError("invalid_field", f"{field} must be a bounded array.", f"/{field}")
    for index, diff in enumerate(document.get("field_diffs", [])):
        if not isinstance(diff, dict):
            raise HarnessContractError("invalid_field", "field_diffs entries must be objects.", f"/field_diffs/{index}")
        pointer = diff.get("json_pointer")
        if pointer is not None and (not isinstance(pointer, str) or "#" in pointer or ".." in pointer or not re.fullmatch(r"^(?:|/(?:[^~/]|~[01])*)*$", pointer)):
            raise HarnessContractError("invalid_json_pointer", "field_diffs json_pointer must be an RFC 6901 pointer.", f"/field_diffs/{index}/json_pointer")
    budget = document.get("budget_request", {})
    if not isinstance(budget, dict) or len(budget) > 32:
        raise HarnessContractError("invalid_field", "budget_request must be a bounded object.", "/budget_request")
    request = document.get("create_run_request", document.get("request"))
    if request is not None and not isinstance(request, dict):
        raise HarnessContractError("invalid_field", "create_run_request must be an object.", "/create_run_request")
    if "expires_at" in document:
        require_id(document["expires_at"], "/expires_at", "expires_at")
    return {**document, "principal": principal, "workspace_id": workspace_id, "policy_revision": POLICY_REVISION,
            "create_run_request": request, "backend_identity": backend_identity,
            "schema_set_revision": schema_set_revision}


def validate_stage2_approval(document: dict[str, Any], *, principal: str, workspace_id: str,
                              schema_set_revision: str, backend_identity: dict[str, Any]) -> dict[str, Any]:
    allowed = {"approval_id", "draft_id", "draft_digest", "validation_id", "principal", "workspace_id", "policy_revision",
               "schema_set_revision", "backend_identity", "expires_at", "reason", "single_use", "idempotency_key", "approval_digest"}
    unknown = sorted(set(document) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", "Unknown approval field is rejected.", f"/{unknown[0]}")
    if document.get("principal", principal) != principal:
        raise HarnessContractError("principal_mismatch", "Approval principal does not match the local subject.", "/principal", status=403)
    if document.get("workspace_id", workspace_id) != workspace_id:
        raise HarnessContractError("workspace_mismatch", "Approval workspace does not match the local workspace.", "/workspace_id", status=403)
    if document.get("schema_set_revision") != schema_set_revision:
        raise HarnessContractError("schema_revision_mismatch", "Approval schema-set revision is not current.", "/schema_set_revision")
    if document.get("backend_identity") != backend_identity:
        raise HarnessContractError("backend_identity_mismatch", "Approval backend identity is not current.", "/backend_identity")
    if document.get("policy_revision", POLICY_REVISION) != POLICY_REVISION:
        raise HarnessContractError("policy_revision_mismatch", "Approval policy revision is not current.", "/policy_revision")
    require_id(document.get("draft_id"), "/draft_id", "draft_id")
    require_digest(document.get("draft_digest"), "/draft_digest", "draft_digest")
    require_id(document.get("validation_id"), "/validation_id", "validation_id")
    require_id(document.get("expires_at"), "/expires_at", "expires_at")
    if "single_use" in document and not isinstance(document["single_use"], bool):
        raise HarnessContractError("invalid_field", "single_use must be boolean.", "/single_use")
    return {**document, "principal": principal, "workspace_id": workspace_id, "policy_revision": POLICY_REVISION,
            "schema_set_revision": schema_set_revision, "backend_identity": backend_identity,
            "single_use": document.get("single_use", True)}


def validation_report(*, draft: dict[str, Any], validation_id: str, status: str, issues: list[dict[str, Any]],
                      field_results: list[dict[str, Any]], unsupported_fields: list[str], stale_reasons: list[str],
                      budget_estimate: dict[str, Any], risk_flags: list[str], validated_request_digest: str) -> dict[str, Any]:
    if status not in VALIDATION_STATUSES:
        raise HarnessContractError("invalid_validation_status", "Unknown validation status.", "/status")
    return {
        "schema_identity": STAGE2_SCHEMA_IDENTITIES["draft_validation_report"],
        "contract_revision": SUCCESSOR_CONTRACT_REVISION,
        "draft_id": draft["draft_id"], "draft_digest": draft["draft_digest"], "validation_id": validation_id,
        "principal": draft["principal"], "workspace_id": draft["workspace_id"],
        "input_snapshot_digest": draft["input_snapshot_digest"], "validator_revision": draft["validator_revision"],
        "schema_set_revision": draft["schema_set_revision"], "backend_identity": draft["backend_identity"],
        "policy_revision": draft["policy_revision"], "status": status, "issues": issues[:256],
        "field_results": field_results[:256], "unsupported_fields": unsupported_fields[:256],
        "stale_reasons": stale_reasons[:32], "budget_estimate": budget_estimate,
        "risk_flags": risk_flags[:256], "would_create_run": False,
        "validated_create_run_request_digest": validated_request_digest, "created_at": now_iso(),
    }


def draft_digest(document: dict[str, Any]) -> str:
    redacted = {key: value for key, value in document.items() if key not in {"create_run_request", "request", "idempotency_key", "draft_id", "operation_id", "created_at", "expires_at"}}
    return canonical_sha256(redacted)
