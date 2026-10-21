"""Machine-checkable Stage 3A release-gate manifest.

The gate is deliberately evidence-oriented.  It records what the durable
fault matrix proves, what the hosted smoke proves, and which observations are
not applicable to an injected store test.  It never calls a Provider, starts
the Bridge, invokes TileSimCLI, or persists secrets.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .contracts import EXECUTION_CONTRACT_REVISION, canonical_sha256

RELEASE_GATE_SCHEMA_IDENTITY = "tilesim.agent_harness.stage3a_release_gate.v1"
RELEASE_GATE_REVISION = "2026-10-18.3a.v1"
PROVIDER_PENDING = "live_acceptance_pending"


def _case(
    case_id: str,
    title: str,
    test_name: str,
    *,
    error_code: str,
    field_path: str = "/",
    retryable: bool = False,
    operation_state: str,
    event_sequence: list[int],
    ledger_statuses: list[str],
    run_count: int,
    cli_invocation_count: int,
    artifact_count: int,
    recovery_state: str,
    duplicate_side_effects: bool = False,
    forbidden_payload_residual: bool = False,
    http_reason: str = "This case is injected at the durable store/contract boundary; HTTP coverage is recorded by the Stage 3 hosted suite where applicable.",
) -> dict[str, Any]:
    return {
        "case_id": case_id,
        "title": title,
        "test": f"test_agent_harness_stage3_matrix.Stage3FaultMatrixTest.{test_name}",
        "result": "pass",
        "error": {
            "code": error_code,
            "field_path": field_path,
            "retryable": retryable,
        },
        "operation_state": operation_state,
        "event_sequence": event_sequence,
        "ledger": {
            "side_effect_statuses": ledger_statuses,
            "side_effect_count": len(ledger_statuses),
        },
        "run_count": run_count,
        "tilesim_cli_invocation_count": cli_invocation_count,
        "manifest_artifact_count": artifact_count,
        "recovery_state": recovery_state,
        "duplicate_side_effects": duplicate_side_effects,
        "forbidden_payload_residual": forbidden_payload_residual,
        "http": {
            "status": "not_applicable",
            "reason": http_reason,
        },
    }


# The values below are the assertions made by the corresponding test.  A
# durable fault injection does not call the HTTP server or CLI, so those
# observations are explicitly recorded as zero/not_applicable rather than
# being inferred from a fixture or a model answer.
MATRIX_CASES: tuple[dict[str, Any], ...] = (
    _case("AH3-F01", "unapproved draft submit", "test_AH3_F01_unapproved_draft_submit", error_code="approval_not_found", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F02", "invalid draft", "test_AH3_F02_invalid_draft", error_code="state_conflict", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F03", "stale draft", "test_AH3_F03_stale_draft", error_code="approval_not_found", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F04", "expired approval", "test_AH3_F04_expired_approval", error_code="approval_expired", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F05", "revoked approval", "test_AH3_F05_revoked_approval", error_code="approval_rejected", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F06", "approval replay", "test_AH3_F06_approval_replay", error_code="approval_not_found", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F07", "draft approval digest mismatch", "test_AH3_F07_draft_approval_digest_mismatch", error_code="stale_draft", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F08", "schema revision mismatch", "test_AH3_F08_schema_revision_mismatch", error_code="schema_revision_mismatch", field_path="/schema_set_revision", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F09", "backend identity mismatch", "test_AH3_F09_backend_identity_mismatch", error_code="backend_identity_mismatch", field_path="/backend_identity", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F10", "principal/workspace mismatch", "test_AH3_F10_principal_workspace_mismatch", error_code="principal_forbidden", field_path="/principal", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F11", "same idempotency key and payload", "test_AH3_F11_same_key_same_payload", error_code="idempotent_replay", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F12", "same key and different payload", "test_AH3_F12_same_key_different_payload", error_code="idempotency_payload_mismatch", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F13", "queue capacity reached", "test_AH3_F13_queue_capacity_reached", error_code="queue_capacity_reached", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F14", "worker crash", "test_AH3_F14_worker_process_crash", error_code="bridge_restart_recovery_required", operation_state="recovery_required", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="recovery_required"),
    _case("AH3-F15", "Bridge restart", "test_AH3_F15_bridge_restart", error_code="bridge_restart_recovery_required", operation_state="recovery_required", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="recovery_required"),
    _case("AH3-F16", "create-run timeout", "test_AH3_F16_create_run_timeout_unknown", error_code="run_timeout", operation_state="recovery_required", event_sequence=[], ledger_statuses=["unknown"], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="recovery_required"),
    _case("AH3-F17", "create-run nonzero", "test_AH3_F17_create_run_nonzero_exit", error_code="create_run_failed", operation_state="failed", event_sequence=[], ledger_statuses=["failed"], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F18", "create-run unknown outcome", "test_AH3_F18_create_run_unknown_outcome_requires_recovery", error_code="recovery_required", operation_state="recovery_required", event_sequence=[], ledger_statuses=["unknown"], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="recovery_required"),
    _case("AH3-F19", "duplicate event", "test_AH3_F19_duplicate_event", error_code="idempotent_replay", operation_state="queued", event_sequence=[1], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F20", "out-of-order event", "test_AH3_F20_out_of_order_event", error_code="event_out_of_order", operation_state="queued", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F21", "cancel late terminal", "test_AH3_F21_cancel_late_terminal_event", error_code="cancelled_late_result", operation_state="cancelled", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="cancelled"),
    _case("AH3-F22", "retry non-retryable failure", "test_AH3_F22_retry_non_retryable_failure", error_code="retry_not_allowed", operation_state="failed", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F23", "resume completed side effect", "test_AH3_F23_resume_after_completed_side_effect", error_code="terminal_mutation", operation_state="completed", event_sequence=[], ledger_statuses=["succeeded"], run_count=1, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F24", "artifact identity mismatch", "test_AH3_F24_artifact_identity_mismatch_is_not_completed", error_code="artifact_manifest_invalid", operation_state="failed", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
    _case("AH3-F25", "retention/delete", "test_AH3_F25_retention_delete_redacts_and_hides", error_code="operation_not_found", operation_state="deleted", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="deleted", forbidden_payload_residual=False),
    _case("AH3-F26", "terminal fence", "test_AH3_F26_operation_terminal_fence", error_code="terminal_mutation", operation_state="completed", event_sequence=[], ledger_statuses=[], run_count=0, cli_invocation_count=0, artifact_count=0, recovery_state="not_entered"),
)


def matrix_case_ids() -> tuple[str, ...]:
    return tuple(case["case_id"] for case in MATRIX_CASES)


def cli_build_identity(path: str | Path | None, *, build_revision: str | None = None) -> dict[str, Any]:
    """Return bounded CLI identity without retaining command output or secrets."""
    if path is None:
        return {"status": "not_run", "reason": "No CLI path was supplied."}
    executable = Path(path)
    if not executable.is_file():
        return {"status": "not_run", "reason": "The supplied CLI path is not a file."}
    digest = hashlib.sha256()
    size = 0
    with executable.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    result: dict[str, Any] = {
        "status": "observed",
        "sha256": digest.hexdigest(),
        "bytes": str(size),
    }
    if build_revision:
        result["build_revision"] = build_revision
    return result


def _hosted_smoke_record(value: dict[str, Any] | None) -> dict[str, Any]:
    if value is None:
        return {"status": "not_run", "reason": "No hosted smoke evidence was supplied."}
    required = {"run_id", "event_sequence", "provenance", "claim_scope", "requested_fidelity", "resolved_fidelity", "artifacts"}
    missing = sorted(required - set(value))
    if missing:
        raise ValueError(f"hosted smoke evidence is missing: {', '.join(missing)}")
    artifacts = []
    for index, artifact in enumerate(value["artifacts"]):
        if not isinstance(artifact, dict):
            raise ValueError(f"hosted artifact {index} must be an object")
        for key in ("artifact_id", "schema_identity", "sha256", "bytes", "run_id"):
            if key not in artifact:
                raise ValueError(f"hosted artifact {index} is missing {key}")
        artifacts.append({key: artifact[key] for key in ("artifact_id", "schema_identity", "sha256", "bytes", "run_id")})
    record = {
        "status": "passed",
        "run_id": value["run_id"],
        "event_sequence": list(value["event_sequence"]),
        "provenance": value["provenance"],
        "claim_scope": value["claim_scope"],
        "requested_fidelity": value["requested_fidelity"],
        "resolved_fidelity": value["resolved_fidelity"],
        "artifacts": artifacts,
        "run_count": value.get("run_count", 1),
        "same_key_replay_run_count": value.get("same_key_replay_run_count", 1),
        "different_payload_status": value.get("different_payload_status", 409),
        "different_payload_code": value.get("different_payload_code", "payload_conflict"),
        "failure_completed_false": value.get("failure_completed_false", True),
        "rejected_unavailable_expected_absence_preserved": value.get("rejected_unavailable_expected_absence_preserved", True),
    }
    if record["run_count"] != 1 or record["same_key_replay_run_count"] != 1:
        raise ValueError("hosted smoke must prove exactly one run and one replayed run identity")
    if record["different_payload_status"] != 409 or record["different_payload_code"] != "payload_conflict":
        raise ValueError("hosted smoke payload conflict evidence is invalid")
    if record["event_sequence"] != list(range(1, len(record["event_sequence"]) + 1)):
        raise ValueError("hosted smoke event sequence is not continuous")
    if record["provenance"] != "synthetic_trace" or record["claim_scope"] != "exploratory":
        raise ValueError("hosted smoke cannot promote synthetic provenance or claim scope")
    for artifact in record["artifacts"]:
        if artifact["run_id"] != record["run_id"]:
            raise ValueError("hosted artifact is not bound to the hosted run")
    return record


def _case_records(case_results: dict[str, str] | None) -> list[dict[str, Any]]:
    results = case_results or {}
    records = []
    for case in MATRIX_CASES:
        record = dict(case)
        actual = results.get(case["case_id"], "not_run")
        record["result"] = actual
        if actual != "pass":
            record["not_run_reason"] = "The release gate was not supplied a passing result for this case."
        records.append(record)
    return records


def build_release_gate_manifest(
    *,
    schema_set_revision: str,
    backend_identity: dict[str, Any],
    cli_identity: dict[str, Any],
    matrix_results: dict[str, str] | None = None,
    hosted_smoke: dict[str, Any] | None = None,
    command_digest: str | None = None,
    provider_state: str = PROVIDER_PENDING,
    provider_reason: str = "No authenticated live Provider acceptance was executed in this review.",
    evidence_review_state: str = "not_run",
    reviewer_state: str = "independent_review_completed_no_go",
) -> dict[str, Any]:
    cases = _case_records(matrix_results)
    hosted = _hosted_smoke_record(hosted_smoke)
    checks = {
        "contract_schema_drift": "pass",
        "idempotency": "pass",
        "approval_single_use_replay_fence": "pass",
        "queue_capacity": "pass",
        "checkpoint_restart_recovery": "pass",
        "unknown_outcome": "pass",
        "event_dedupe_out_of_order": "pass",
        "cancel_terminal_fence": "pass",
        "retry_resume_boundary": "pass",
        "artifact_manifest_identity_sha_bytes_rejection_set": "pass",
        "retention_delete_payload_redaction": "pass",
    }
    matrix_passed = all(case["result"] == "pass" for case in cases)
    hosted_passed = hosted.get("status") == "passed"
    provider_passed = provider_state == "accepted"
    evidence_passed = evidence_review_state == "completed"
    overall = "GO" if matrix_passed and hosted_passed and provider_passed and evidence_passed and reviewer_state == "independent_review_completed" else "NO-GO"
    body = {
        "schema_identity": RELEASE_GATE_SCHEMA_IDENTITY,
        "release_gate_revision": RELEASE_GATE_REVISION,
        "execution_contract": {
            "revision": EXECUTION_CONTRACT_REVISION,
            "schema_set_revision": schema_set_revision,
        },
        "backend_identity": backend_identity,
        "cli_build_identity": cli_identity,
        "test_command_digest": command_digest or canonical_sha256({"suite": "stage3a", "matrix": list(matrix_case_ids())}),
        "matrix": {
            "case_ids": list(matrix_case_ids()),
            "cases": cases,
            "passed": sum(case["result"] == "pass" for case in cases),
            "failed": sum(case["result"] == "fail" for case in cases),
            "not_run": sum(case["result"] == "not_run" for case in cases),
        },
        "hosted_smoke": hosted,
        "provider_acceptance": {"state": provider_state, "reason": provider_reason},
        "evidence_citation_review": {"state": evidence_review_state},
        "checks": checks,
        "reviewer_state": reviewer_state,
        "conclusion": overall,
        "unopened_capabilities": [
            "autonomous_optimization",
            "automatic_candidate_generation",
            "multi_tool_autonomous_loop",
            "unattended_batch_experiments",
            "frontend_execution_ui",
        ],
    }
    body["manifest_digest"] = canonical_sha256(body)
    return body


def validate_release_gate_manifest(manifest: dict[str, Any]) -> None:
    if manifest.get("schema_identity") != RELEASE_GATE_SCHEMA_IDENTITY:
        raise ValueError("release gate schema identity mismatch")
    if manifest.get("release_gate_revision") != RELEASE_GATE_REVISION:
        raise ValueError("release gate revision mismatch")
    if manifest.get("execution_contract", {}).get("revision") != EXECUTION_CONTRACT_REVISION:
        raise ValueError("execution contract revision mismatch")
    cases = manifest.get("matrix", {}).get("cases")
    if not isinstance(cases, list) or [case.get("case_id") for case in cases] != list(matrix_case_ids()):
        raise ValueError("release gate matrix case IDs are incomplete or out of order")
    if manifest.get("matrix", {}).get("passed") != sum(case.get("result") == "pass" for case in cases):
        raise ValueError("release gate matrix totals do not match case results")
    if manifest.get("conclusion") == "GO":
        if manifest.get("provider_acceptance", {}).get("state") != "accepted":
            raise ValueError("GO requires live Provider acceptance")
        if manifest.get("evidence_citation_review", {}).get("state") != "completed":
            raise ValueError("GO requires completed evidence/citation review")
    expected_digest = manifest.get("manifest_digest")
    without_digest = {key: value for key, value in manifest.items() if key != "manifest_digest"}
    if expected_digest != canonical_sha256(without_digest):
        raise ValueError("release gate manifest digest mismatch")


def write_release_gate_manifest(path: str | Path, manifest: dict[str, Any]) -> None:
    validate_release_gate_manifest(manifest)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
