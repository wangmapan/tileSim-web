"""Published Agent Harness successor contract and fail-closed validation."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

SCHEMA_SET_IDENTITY = "tilesim.agent_harness"
CONTRACT_REVISION = "2026-10-17.wpa.v1"
# Stage-2 publishes a successor for the draft/validation/approval records.
# The WP-A operation/tool records keep the v1 revision for compatibility.
SUCCESSOR_CONTRACT_REVISION = "2026-10-18.wpb.v1"
EXECUTION_CONTRACT_REVISION = "2026-10-18.wpc.v1"
POLICY_REVISION = "tilesim.agent_harness.policy.v1"

WORKFLOW_STATES = (
    "draft", "submitted", "queued", "running", "waiting_tool", "waiting_approval",
    "retrying", "completed", "failed", "cancelled", "recovery_required",
    "manual_intervention_required",
)
TERMINAL_STATES = {"completed", "failed", "cancelled"}
TOOL_OUTCOMES = ("succeeded", "rejected", "retryable_failure", "terminal_failure", "unknown_outcome")
SCHEMA_IDENTITIES = {
    name: f"{SCHEMA_SET_IDENTITY}.{name}.v1"
    for name in (
        "agent_operation", "agent_turn", "workflow_event", "checkpoint", "tool_call",
        "tool_result", "experiment_draft", "approval", "study", "candidate",
    )
}
STAGE2_SCHEMA_IDENTITIES = {
    "experiment_draft": "tilesim.agent_harness.experiment_draft.v2",
    "draft_validation_report": "tilesim.agent_harness.draft_validation_report.v1",
    "approval": "tilesim.agent_harness.approval.v2",
}
EXECUTION_SCHEMA_IDENTITIES = {
    "request": "tilesim.agent_harness.execution_request.v1",
    "operation": "tilesim.agent_harness.execution_operation.v1",
    "event": "tilesim.agent_harness.execution_event.v1",
    "result": "tilesim.agent_harness.execution_result_reference.v1",
    "mutation": "tilesim.agent_harness.execution_mutation_request.v1",
}
SCHEMA_IDENTITIES.update({
    "experiment_draft_v2": STAGE2_SCHEMA_IDENTITIES["experiment_draft"],
    "draft_validation_report": STAGE2_SCHEMA_IDENTITIES["draft_validation_report"],
    "approval_v2": STAGE2_SCHEMA_IDENTITIES["approval"],
    "execution_request": EXECUTION_SCHEMA_IDENTITIES["request"],
    "execution_operation": EXECUTION_SCHEMA_IDENTITIES["operation"],
    "execution_event": EXECUTION_SCHEMA_IDENTITIES["event"],
    "execution_result_reference": EXECUTION_SCHEMA_IDENTITIES["result"],
    "execution_mutation_request": EXECUTION_SCHEMA_IDENTITIES["mutation"],
})
# Stage 4 owns a successor namespace so the proposal-era WP-A identities remain
# immutable while the durable optimization records gain their own revision.
SCHEMA_IDENTITIES.update({
    f"optimization_{name}": f"tilesim.agent_harness.optimization_{name}.v1"
    for name in (
        "session", "candidate", "objective", "constraint", "tool_invocation", "tool_result",
        "iteration", "evaluation", "checkpoint", "stop_reason", "approval", "action", "summary", "event",
    )
})
# Stage 5 batch records are published as first-class schemas. Keep their
# filename-derived keys in this registry as well so the manifest check cannot
# silently drift when a batch schema is added. The existing candidate/stop
# records retain their canonical identities where the batch schema reuses them.
SCHEMA_IDENTITIES.update({
    "candidate_set": "tilesim.agent_harness.candidate_set.v1",
    "experiment_plan": "tilesim.agent_harness.experiment_plan.v1",
    "concurrency_policy": "tilesim.agent_harness.concurrency_policy.v1",
    "stop_policy": "tilesim.agent_harness.stop_policy.v1",
    "run_slot": "tilesim.agent_harness.run_slot.v1",
    "batch_session": "tilesim.agent_harness.batch_session.v1",
    "batch_event": "tilesim.agent_harness.batch_event.v1",
    "batch_action": "tilesim.agent_harness.batch_action.v1",
    "batch_approval": "tilesim.agent_harness.batch_approval.v1",
    "batch_objective": "tilesim.agent_harness.batch_objective.v1",
    "batch_budget": "tilesim.agent_harness.batch_budget.v1",
    "batch_checkpoint": "tilesim.agent_harness.batch_checkpoint.v1",
    "batch_failure_recovery": "tilesim.agent_harness.batch_failure_recovery.v1",
    "batch_run_result": "tilesim.agent_harness.batch_run_result.v1",
    "batch_stop_reason": "tilesim.agent_harness.stop_reason.v1",
    "batch_summary": "tilesim.agent_harness.batch_summary.v1",
})
ERROR_SCHEMA_IDENTITY = f"{SCHEMA_SET_IDENTITY}.error.v1"

_IDENTITY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$")
_POINTER_RE = re.compile(r"^(?:|/(?:[^~/]|~[01])*)*$")


class HarnessContractError(ValueError):
    """A stable, JSON-Pointer-addressed contract failure."""

    def __init__(self, code: str, message: str, field_path: str | None = None, *, retryable: bool = False,
                 terminal_failure: bool = True, unknown_outcome: bool = False, status: int = 400):
        super().__init__(message)
        self.code = code
        self.field_path = field_path
        self.retryable = retryable
        self.terminal_failure = terminal_failure
        self.unknown_outcome = unknown_outcome
        self.status = status


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_string(value: Any, pointer: str, *, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not value or not _IDENTITY_RE.fullmatch(value):
        raise HarnessContractError("invalid_field", "Expected a bounded identifier string.", pointer)


def _require_pointer(value: Any, pointer: str) -> None:
    if value is None:
        return
    if not isinstance(value, str) or not _POINTER_RE.fullmatch(value):
        raise HarnessContractError("invalid_json_pointer", "Expected an RFC 6901 JSON Pointer.", pointer)


COMMON_REQUIRED = {
    "schema_identity", "contract_revision", "operation_id", "turn_id", "run_id", "snapshot_digest",
    "workflow_state", "schema_set_revision", "policy_revision", "backend_identity", "created_at", "updated_at",
}
OBJECT_FIELDS: dict[str, tuple[set[str], set[str]]] = {
    "agent_operation": (COMMON_REQUIRED | {"idempotency_key", "request_digest", "principal", "operation_kind", "queue_delay_ms", "attempt_count", "checkpoint_id", "last_error", "cancellation_fence", "lease", "retention"}, COMMON_REQUIRED | {"idempotency_key", "request_digest", "principal", "operation_kind", "queue_delay_ms", "attempt_count", "checkpoint_id", "last_error", "cancellation_fence", "lease", "retention"}),
    "agent_turn": (COMMON_REQUIRED | {"parent_turn_id", "actor", "input_digest", "output_digest"}, COMMON_REQUIRED | {"actor", "input_digest"}),
    "workflow_event": (COMMON_REQUIRED | {"event_id", "sequence", "parent_event_id", "node", "payload_digest", "terminal", "idempotency_key", "draft_id", "approval_id"}, COMMON_REQUIRED | {"event_id", "sequence", "node", "payload_digest", "terminal", "idempotency_key"}),
    "checkpoint": (COMMON_REQUIRED | {"checkpoint_id", "state_digest", "last_event_sequence", "side_effect_digests", "resume_policy"}, COMMON_REQUIRED | {"checkpoint_id", "state_digest", "last_event_sequence", "side_effect_digests", "resume_policy"}),
    "tool_call": (COMMON_REQUIRED | {"tool_call_id", "tool_name", "tool_revision", "input_digest", "scope", "permission_decision", "idempotency_key", "timeout_ms", "retry_policy"}, COMMON_REQUIRED | {"tool_call_id", "tool_name", "tool_revision", "input_digest", "scope", "permission_decision", "idempotency_key", "timeout_ms", "retry_policy"}),
    "tool_result": (COMMON_REQUIRED | {"tool_call_id", "tool_name", "tool_revision", "outcome", "output_digest", "retryable", "terminal_failure", "unknown_outcome", "error_code", "field_path"}, COMMON_REQUIRED | {"tool_call_id", "tool_name", "tool_revision", "outcome", "output_digest", "retryable", "terminal_failure", "unknown_outcome"}),
    "experiment_draft": (COMMON_REQUIRED | {"draft_digest", "creates_run", "diff_digest", "validator_revision"}, COMMON_REQUIRED | {"draft_digest", "creates_run", "diff_digest", "validator_revision"}),
    "approval": (COMMON_REQUIRED | {"approval_digest", "draft_digest", "principal", "approved_at", "expires_at", "decision"}, COMMON_REQUIRED | {"approval_digest", "draft_digest", "principal", "approved_at", "expires_at", "decision"}),
    "study": (COMMON_REQUIRED | {"study_digest", "objective_digest", "constraint_digest", "budget_digest", "automatic_submission"}, COMMON_REQUIRED | {"study_digest", "objective_digest", "constraint_digest", "budget_digest", "automatic_submission"}),
    "candidate": (COMMON_REQUIRED | {"candidate_id", "candidate_digest", "source", "run_binding"}, COMMON_REQUIRED | {"candidate_id", "candidate_digest", "source", "run_binding"}),
}


def validate_document(name: str, document: dict[str, Any], *, expected_schema_set_revision: str | None = None,
                      expected_backend_identity: str | None = None) -> dict[str, Any]:
    if name in {"experiment_draft_v2", "approval_v2", "draft_validation_report"}:
        if not isinstance(document, dict):
            raise HarnessContractError("invalid_document", "Object must be a JSON object.", "/")
        expected_identity = SCHEMA_IDENTITIES[name]
        if document.get("schema_identity") != expected_identity:
            raise HarnessContractError("schema_revision_mismatch", "Schema identity is not published.", "/schema_identity")
        if document.get("contract_revision") != SUCCESSOR_CONTRACT_REVISION:
            raise HarnessContractError("schema_revision_mismatch", "Successor contract revision is not current.", "/contract_revision")
        if expected_schema_set_revision is not None and document.get("schema_set_revision") != expected_schema_set_revision:
            raise HarnessContractError("schema_revision_mismatch", "Schema-set revision does not match this Bridge.", "/schema_set_revision")
        required = {
            "experiment_draft_v2": {"schema_identity", "contract_revision", "draft_id", "operation_id", "principal", "workspace_id", "run_scope", "input_snapshot_digest", "schema_set_revision", "backend_identity", "parameter_catalog_revision", "validator_revision", "policy_revision", "field_diffs", "assumptions", "evidence_refs", "budget_request", "risk_flags", "status", "created_at", "expires_at", "draft_digest", "idempotency_key", "would_create_run"},
            "approval_v2": {"schema_identity", "contract_revision", "approval_id", "draft_id", "draft_digest", "validation_id", "principal", "workspace_id", "policy_revision", "schema_set_revision", "backend_identity", "status", "created_at", "expires_at", "approved_at", "rejected_at", "revoked_at", "reason", "approval_digest", "single_use", "consumed"},
            "draft_validation_report": {"schema_identity", "contract_revision", "draft_id", "draft_digest", "validation_id", "principal", "workspace_id", "input_snapshot_digest", "validator_revision", "schema_set_revision", "backend_identity", "policy_revision", "status", "issues", "field_results", "unsupported_fields", "stale_reasons", "budget_estimate", "risk_flags", "would_create_run", "validated_create_run_request_digest", "created_at"},
        }[name]
        missing = sorted(required - set(document))
        if missing:
            raise HarnessContractError("missing_field", "Required field is missing.", f"/{missing[0]}")
        unknown = sorted(set(document) - required - {"conversation_id", "turn_id", "create_run_request_digest"})
        if unknown:
            raise HarnessContractError("unknown_field", "Unknown field is rejected.", f"/{unknown[0]}")
        if document.get("would_create_run") is not False:
            raise HarnessContractError("run_side_effect_forbidden", "Stage-2 records cannot create a run.", "/would_create_run")
        return document
    if name not in OBJECT_FIELDS:
        raise HarnessContractError("unknown_schema_identity", "Unknown Agent Harness object.", "/schema_identity")
    if not isinstance(document, dict):
        raise HarnessContractError("invalid_document", "Object must be a JSON object.", "/")
    allowed, required = OBJECT_FIELDS[name]
    unknown = sorted(set(document) - allowed)
    if unknown:
        raise HarnessContractError("unknown_field", "Unknown fields are rejected by the closed contract.", f"/{unknown[0]}")
    missing = sorted(required - set(document))
    if missing:
        raise HarnessContractError("missing_field", "Required field is missing.", f"/{missing[0]}")
    expected_identity = SCHEMA_IDENTITIES[name]
    if document.get("schema_identity") != expected_identity:
        raise HarnessContractError("schema_revision_mismatch", "Schema identity or revision is not published.", "/schema_identity")
    if document.get("contract_revision") != CONTRACT_REVISION:
        raise HarnessContractError("schema_revision_mismatch", "Object contract revision is not current.", "/contract_revision")
    if expected_schema_set_revision is not None and document.get("schema_set_revision") != expected_schema_set_revision:
        raise HarnessContractError("schema_revision_mismatch", "Schema-set revision does not match this Bridge.", "/schema_set_revision")
    if expected_backend_identity is not None and document.get("backend_identity") != expected_backend_identity:
        raise HarnessContractError("backend_identity_mismatch", "Backend identity does not match the checkpoint or approval.", "/backend_identity")
    for key in ("operation_id", "turn_id", "schema_set_revision", "policy_revision"):
        _require_string(document.get(key), f"/{key}")
    if not isinstance(document.get("backend_identity"), (dict, str)) or not document.get("backend_identity"):
        raise HarnessContractError("invalid_field", "backend_identity must be a non-empty identity object.", "/backend_identity")
    _require_string(document.get("run_id"), "/run_id", nullable=True)
    _require_string(document.get("snapshot_digest"), "/snapshot_digest", nullable=True)
    _require_string(document.get("workflow_state"), "/workflow_state")
    if document["workflow_state"] not in WORKFLOW_STATES:
        raise HarnessContractError("invalid_workflow_state", "Unknown workflow state.", "/workflow_state")
    if "event_id" in document:
        _require_string(document["event_id"], "/event_id")
        if not isinstance(document.get("sequence"), int) or document["sequence"] < 1:
            raise HarnessContractError("invalid_event_sequence", "Event sequence must be a positive integer.", "/sequence")
        if not isinstance(document.get("terminal"), bool):
            raise HarnessContractError("invalid_field", "terminal must be boolean.", "/terminal")
    if "outcome" in document and document["outcome"] not in TOOL_OUTCOMES:
        raise HarnessContractError("invalid_tool_outcome", "Unknown tool outcome.", "/outcome")
    if "field_path" in document:
        _require_pointer(document["field_path"], "/field_path")
    return document


def operation_identity(*, operation_id: str, turn_id: str, schema_set_revision: str, backend_identity: str,
                       run_id: str | None = None, snapshot_digest: str | None = None,
                       idempotency_key: str, request_digest: str, operation_kind: str = "read_only",
                       principal: str = "anonymous", state: str = "draft") -> dict[str, Any]:
    timestamp = utc_now()
    return {
        "schema_identity": SCHEMA_IDENTITIES["agent_operation"], "contract_revision": CONTRACT_REVISION,
        "operation_id": operation_id, "turn_id": turn_id, "run_id": run_id, "snapshot_digest": snapshot_digest,
        "workflow_state": state, "schema_set_revision": schema_set_revision, "policy_revision": POLICY_REVISION,
        "backend_identity": backend_identity, "created_at": timestamp, "updated_at": timestamp,
        "idempotency_key": idempotency_key, "request_digest": request_digest, "principal": principal,
        "operation_kind": operation_kind, "queue_delay_ms": 0, "attempt_count": 0, "checkpoint_id": None,
        "last_error": None, "cancellation_fence": None,
        "lease": {"worker_id": None, "leased_at": None, "heartbeat_at": None, "visibility_timeout_at": None},
        "retention": {"expires_at": None, "deleted_at": None},
    }
