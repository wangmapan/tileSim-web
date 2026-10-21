"""Fail-closed preparation manifests for Stage 3A acceptance review.

These documents deliberately contain identities, digests, bounded statuses and
review metadata only.  They are not Provider acceptance results and never
store credentials, prompts, raw responses, hidden reasoning or full evidence
payloads.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from .contracts import EXECUTION_CONTRACT_REVISION, canonical_sha256

PROVIDER_ACCEPTANCE_SCHEMA_IDENTITY = "tilesim.agent_harness.provider_acceptance_manifest.v1"
PROVIDER_ACCEPTANCE_REVISION = "2026-10-18.3a.acceptance.v1"
REVIEW_PACKAGE_SCHEMA_IDENTITY = "tilesim.agent_harness.evidence_citation_review_package.v1"
REVIEW_PACKAGE_REVISION = "2026-10-18.3a.review.v1"
PROVIDER_PROTOCOL = "tilesim.evidence_agent_provider.v1"

PENDING_STATES = {"live_acceptance_pending", "not_configured", "blocked", "not_run"}
ACCEPTANCE_STATES = PENDING_STATES | {"accepted", "rejected"}
CASE_STATES = {"not_run", "passed", "failed", "blocked"}
REVIEW_STATES = {"not_run", "blocked", "completed"}

PROVIDER_CASES: tuple[dict[str, str], ...] = (
    {"case_id": "PA-SUCCESS-001", "lane": "success", "requirement": "one authenticated successful repetition"},
    {"case_id": "PA-REFUSAL-001", "lane": "refusal_or_invalid_response", "requirement": "structured refusal or invalid response"},
    {"case_id": "PA-TIMEOUT-001", "lane": "timeout_or_unavailable", "requirement": "timeout or unavailable terminal"},
    {"case_id": "PA-IDENTITY-001", "lane": "identity_mismatch", "requirement": "provider/model/revision mismatch rejection"},
)

REVIEW_REQUIREMENTS: tuple[str, ...] = (
    "citation_entailment",
    "citation_pointer_and_artifact_identity",
    "run_schema_sha_bytes_binding",
    "lossless_numeric_values",
    "provenance_and_fidelity_boundary",
    "availability_state_distinction",
    "cross_run_snapshot_artifact_isolation",
    "refusal_and_limitation_language",
    "credential_raw_response_hidden_reasoning_redaction",
)

_FORBIDDEN_KEY_NAMES = {
    "credential",
    "credentials",
    "api_key",
    "apikey",
    "authorization",
    "raw_response",
    "provider_response",
    "response_body",
    "hidden_reasoning",
    "prompt",
    "system_prompt",
    "user_prompt",
    "request_payload",
    "response_payload",
    "evidence_payload",
}


class AcceptancePreparationError(ValueError):
    """Raised when a preparation manifest is incomplete or unsafe."""


DEPLOYMENT_IDENTITY_STATUSES = {
    "not_run",
    "deployment_manifest_missing",
    "deployment_schema_mismatch",
    "deployment_identity_mismatch",
    "deployment_identity_incomplete",
    "matched",
}


def deployment_identity_diagnostic(
    *,
    current_schema_set_revision: str,
    deployment_manifest_path: str | Path | None,
    backend_identity: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a redacted, fail-closed comparison of source and deployment identity.

    Only public revisions, digests, path and booleans are returned.  The
    deployment manifest is read but never modified.  A missing or malformed
    manifest is a bounded diagnostic state rather than an implicit match.
    """

    _require_digest(current_schema_set_revision, "/source_schema_set_revision")
    identity = dict(backend_identity or {})
    path_value = str(deployment_manifest_path) if deployment_manifest_path else None
    manifest_path = Path(path_value) if path_value else None
    manifest: dict[str, Any] = {}
    manifest_present = False
    if manifest_path is not None and manifest_path.is_file():
        manifest_present = True
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            loaded = {}
        if isinstance(loaded, dict):
            manifest = loaded

    manifest_schema_set_revision = manifest.get("schema_set_revision")
    schema_set_match = manifest_schema_set_revision == current_schema_set_revision
    def _identity_or_manifest(key: str) -> Any:
        candidate = identity.get(key)
        if candidate not in (None, "", "not_supplied", "unknown"):
            return candidate
        return manifest.get(key)

    source_revision = _identity_or_manifest("source_revision")
    build_revision = _identity_or_manifest("build_revision")
    source_state_digest = _identity_or_manifest("source_state_digest")
    build_state_digest = _identity_or_manifest("build_state_digest")
    source_build_revision_match = (
        source_revision == build_revision if source_revision and build_revision else None
    )
    source_build_state_digest_match = (
        source_state_digest == build_state_digest if source_state_digest and build_state_digest else None
    )
    if identity.get("state_digests_match") is False and identity.get("source_state_digest") not in (None, "", "not_supplied", "unknown"):
        source_build_state_digest_match = False
    backend_versions_match = identity.get("versions_match")
    if not isinstance(backend_versions_match, bool) or identity.get("source_revision") in (None, "", "not_supplied", "unknown"):
        backend_versions_match = (
            source_build_revision_match is True
            and source_build_state_digest_match is True
        )
    identity_match = bool(
        manifest_present
        and schema_set_match
        and source_build_revision_match is True
        and source_build_state_digest_match is True
        and backend_versions_match
    )
    if not manifest_path or not manifest_present or not manifest:
        status = "not_run" if not manifest_path else "deployment_manifest_missing"
    elif not schema_set_match:
        status = "deployment_schema_mismatch"
    elif not identity_match:
        status = "deployment_identity_mismatch" if backend_versions_match is not True else "deployment_identity_incomplete"
    else:
        status = "matched"
    return {
        "status": status,
        "manifest_path": path_value,
        "manifest_present": manifest_present,
        "manifest_schema_set_revision": manifest_schema_set_revision if isinstance(manifest_schema_set_revision, str) else None,
        "source_schema_set_revision": current_schema_set_revision,
        "schema_set_match": schema_set_match,
        "source_revision": source_revision if isinstance(source_revision, str) else None,
        "build_revision": build_revision if isinstance(build_revision, str) else None,
        "source_build_revision_match": source_build_revision_match,
        "source_state_digest": source_state_digest if isinstance(source_state_digest, str) else None,
        "build_state_digest": build_state_digest if isinstance(build_state_digest, str) else None,
        "source_build_state_digest_match": source_build_state_digest_match,
        "backend_versions_match": backend_versions_match,
        "identity_match": identity_match,
    }


def _validate_deployment_identity_diagnostic(value: Any) -> None:
    if not isinstance(value, dict):
        raise AcceptancePreparationError("deployment identity diagnostic must be an object")
    if value.get("status") not in DEPLOYMENT_IDENTITY_STATUSES:
        raise AcceptancePreparationError("deployment identity diagnostic status is invalid")
    for key in (
        "manifest_present",
        "schema_set_match",
        "identity_match",
        "backend_versions_match",
    ):
        if not isinstance(value.get(key), bool):
            raise AcceptancePreparationError(f"deployment identity diagnostic {key} must be boolean")
    for key in ("source_build_revision_match", "source_build_state_digest_match"):
        if value.get(key) not in {True, False, None}:
            raise AcceptancePreparationError(f"deployment identity diagnostic {key} must be boolean or null")
    if value.get("status") == "matched" and value.get("identity_match") is not True:
        raise AcceptancePreparationError("matched deployment identity must have identity_match=true")
    if value.get("status") != "matched" and value.get("identity_match") is True:
        raise AcceptancePreparationError("non-matched deployment identity cannot have identity_match=true")


def _reject_forbidden_keys(value: Any, path: str = "/") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).casefold().replace("-", "_")
            safe_retention_flag = normalized.endswith("_persisted") and isinstance(child, bool)
            sensitive_name = (
                normalized in _FORBIDDEN_KEY_NAMES
                or "credential" in normalized
                or "hidden_reasoning" in normalized
                or "raw_provider_response" in normalized
            )
            if sensitive_name and not safe_retention_flag:
                raise AcceptancePreparationError(f"forbidden sensitive field at {path}{key}")
            _reject_forbidden_keys(child, f"{path}{key}/")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_forbidden_keys(child, f"{path}{index}/")


def _require_digest(value: Any, path: str, *, allow_none: bool = False) -> None:
    if value is None and allow_none:
        return
    if not isinstance(value, str) or not value.startswith("sha256:") or len(value) != 71:
        raise AcceptancePreparationError(f"{path} must be a sha256 digest")


def _public_provider_identity(identity: dict[str, Any] | None) -> dict[str, Any]:
    source = identity or {}
    allowed = {"configured", "provider_id", "model_id", "model_revision"}
    result = {key: source.get(key, "not_configured") for key in allowed}
    result["configured"] = result["configured"] is True
    return result


def _default_provider_cases() -> list[dict[str, Any]]:
    return [
        {
            **definition,
            "state": "not_run",
            "repetition": 0,
            "terminal_state": "not_run",
            "request_digest": None,
            "response_digest": None,
            "latency_ms": None,
            "cost_summary": None,
            "error_code": None,
            "hard_gate": "not_run",
        }
        for definition in PROVIDER_CASES
    ]


def build_provider_acceptance_manifest(
    *,
    schema_set_revision: str,
    backend_identity: dict[str, Any],
    descriptor_identity: str,
    descriptor_revision: str,
    prompt_template_revision: str,
    policy_revision: str,
    provider_identity: dict[str, Any] | None = None,
    capability_probe: dict[str, Any] | None = None,
    deployment_identity: dict[str, Any] | None = None,
    cases: Iterable[dict[str, Any]] | None = None,
    command_digest: str | None = None,
    acceptance_state: str = "live_acceptance_pending",
    reviewer_state: str = "not_run",
    reason: str = "No authenticated Provider acceptance repetition was executed.",
) -> dict[str, Any]:
    _require_digest(schema_set_revision, "/schema_set_revision")
    if acceptance_state not in ACCEPTANCE_STATES:
        raise AcceptancePreparationError("unsupported Provider acceptance state")
    if reviewer_state not in REVIEW_STATES:
        raise AcceptancePreparationError("unsupported Provider reviewer state")
    if not descriptor_identity or not descriptor_revision or not prompt_template_revision or not policy_revision:
        raise AcceptancePreparationError("descriptor and policy identities are required")
    normalized_cases = [dict(item) for item in (cases if cases is not None else _default_provider_cases())]
    case_ids = [item.get("case_id") for item in normalized_cases]
    expected_ids = [item["case_id"] for item in PROVIDER_CASES]
    if case_ids != expected_ids:
        raise AcceptancePreparationError("Provider acceptance cases must use the stable ordered case IDs")
    for index, item in enumerate(normalized_cases):
        if item.get("state") not in CASE_STATES:
            raise AcceptancePreparationError(f"invalid Provider case state at /cases/{index}/state")
        if not isinstance(item.get("repetition"), int) or item["repetition"] < 0:
            raise AcceptancePreparationError(f"invalid repetition at /cases/{index}/repetition")
        for digest_key in ("request_digest", "response_digest"):
            _require_digest(item.get(digest_key), f"/cases/{index}/{digest_key}", allow_none=True)
    probe = dict(capability_probe or {"state": "not_run", "reason": "No authenticated capability probe was run."})
    if probe.get("state") not in {"not_run", "passed", "failed", "blocked"}:
        raise AcceptancePreparationError("invalid capability probe state")
    body = {
        "schema_identity": PROVIDER_ACCEPTANCE_SCHEMA_IDENTITY,
        "revision": PROVIDER_ACCEPTANCE_REVISION,
        "execution_contract_revision": EXECUTION_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
        "backend_identity": dict(backend_identity),
        "deployment_identity": dict(
            deployment_identity
            or deployment_identity_diagnostic(
                current_schema_set_revision=schema_set_revision,
                deployment_manifest_path=None,
                backend_identity=backend_identity,
            )
        ),
        "descriptor": {
            "schema_identity": descriptor_identity,
            "descriptor_revision": descriptor_revision,
            "prompt_template_revision": prompt_template_revision,
            "policy_revision": policy_revision,
        },
        "provider": _public_provider_identity(provider_identity),
        "provider_protocol": PROVIDER_PROTOCOL,
        "capability_probe": probe,
        "evidence_binding": {
            "state": "not_run",
            "run_id": None,
            "snapshot_digest": None,
            "artifact_manifest_digest": None,
            "artifact_sha256_bytes": [],
        },
        "cases": normalized_cases,
        "acceptance": {
            "state": acceptance_state,
            "reason": reason,
            "success_repetition_count": sum(
                item.get("repetition", 0) for item in normalized_cases if item.get("lane") == "success" and item.get("state") == "passed"
            ),
            "hard_gate": acceptance_state == "accepted",
            "skipped_not_run_lanes": [item["lane"] for item in normalized_cases if item.get("state") == "not_run"],
        },
        "command_digest": command_digest,
        "reviewer_state": reviewer_state,
        "retention": {
            "class": "redacted_identity_only",
            "credential_persisted": False,
            "raw_provider_response_persisted": False,
            "hidden_reasoning_persisted": False,
        },
    }
    _reject_forbidden_keys(body)
    _validate_deployment_identity_diagnostic(body["deployment_identity"])
    body["manifest_digest"] = canonical_sha256(body)
    validate_provider_acceptance_manifest(body)
    return body


def build_evidence_review_package(
    *,
    schema_set_revision: str,
    acceptance_manifest_digest: str,
    hosted_smoke_manifest_digest: str | None = None,
    cases: Iterable[dict[str, Any]] | None = None,
    review_state: str = "not_run",
    reviewer_ids: Iterable[str] = (),
    not_run_reason: str = "No independent human reviewer record was supplied.",
) -> dict[str, Any]:
    _require_digest(schema_set_revision, "/schema_set_revision")
    _require_digest(acceptance_manifest_digest, "/source/acceptance_manifest_digest")
    _require_digest(hosted_smoke_manifest_digest, "/source/hosted_smoke_manifest_digest", allow_none=True)
    if review_state not in REVIEW_STATES:
        raise AcceptancePreparationError("unsupported evidence review state")
    normalized_cases = [dict(item) for item in (cases or [])]
    for index, item in enumerate(normalized_cases):
        for key in ("case_id", "operation_id", "run_id", "snapshot_digest", "artifacts", "claims"):
            if key not in item:
                raise AcceptancePreparationError(f"review case {index} is missing {key}")
        _require_digest(item["snapshot_digest"], f"/cases/{index}/snapshot_digest")
        if not isinstance(item["artifacts"], list) or not isinstance(item["claims"], list):
            raise AcceptancePreparationError(f"review case {index} artifacts/claims must be arrays")
    reviewers = list(reviewer_ids)
    body = {
        "schema_identity": REVIEW_PACKAGE_SCHEMA_IDENTITY,
        "revision": REVIEW_PACKAGE_REVISION,
        "execution_contract_revision": EXECUTION_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
        "source": {
            "acceptance_manifest_digest": acceptance_manifest_digest,
            "hosted_smoke_manifest_digest": hosted_smoke_manifest_digest,
        },
        "case_contract": {
            "required_fields": [
                "case_id",
                "operation_id",
                "run_id",
                "snapshot_digest",
                "artifacts",
                "claims",
            ],
            "citation_fields": [
                "schema_identity",
                "artifact_id",
                "sha256",
                "bytes",
                "json_pointer",
                "subject",
                "provenance",
                "requested_fidelity",
                "resolved_fidelity",
                "claim_scope",
            ],
        },
        "review": {
            "state": review_state,
            "reviewer_count": len(reviewers),
            "reviewer_ids": reviewers,
            "required_checks": list(REVIEW_REQUIREMENTS),
            "hard_gate": review_state == "completed",
            "not_run_reason": None if review_state == "completed" else not_run_reason,
        },
        "cases": normalized_cases,
        "retention": {
            "class": "redacted_identity_only",
            "claim_payload_persisted": False,
            "raw_provider_response_persisted": False,
            "hidden_reasoning_persisted": False,
        },
    }
    _reject_forbidden_keys(body)
    body["package_digest"] = canonical_sha256(body)
    validate_evidence_review_package(body)
    return body


def validate_provider_acceptance_manifest(manifest: dict[str, Any]) -> None:
    if manifest.get("schema_identity") != PROVIDER_ACCEPTANCE_SCHEMA_IDENTITY:
        raise AcceptancePreparationError("Provider acceptance schema identity mismatch")
    if manifest.get("revision") != PROVIDER_ACCEPTANCE_REVISION:
        raise AcceptancePreparationError("Provider acceptance revision mismatch")
    if manifest.get("execution_contract_revision") != EXECUTION_CONTRACT_REVISION:
        raise AcceptancePreparationError("Provider acceptance execution contract mismatch")
    _require_digest(manifest.get("schema_set_revision"), "/schema_set_revision")
    _reject_forbidden_keys(manifest)
    _validate_deployment_identity_diagnostic(manifest.get("deployment_identity"))
    acceptance = manifest.get("acceptance")
    if not isinstance(acceptance, dict) or acceptance.get("state") not in ACCEPTANCE_STATES:
        raise AcceptancePreparationError("Provider acceptance state is invalid")
    cases = manifest.get("cases")
    if not isinstance(cases, list) or [item.get("case_id") for item in cases] != [item["case_id"] for item in PROVIDER_CASES]:
        raise AcceptancePreparationError("Provider acceptance case set is incomplete")
    if acceptance.get("state") == "accepted":
        if manifest.get("capability_probe", {}).get("state") != "passed":
            raise AcceptancePreparationError("accepted Provider manifest requires a passed capability probe")
        if manifest.get("reviewer_state") != "completed":
            raise AcceptancePreparationError("accepted Provider manifest requires completed independent review")
        if manifest.get("deployment_identity", {}).get("status") != "matched":
            raise AcceptancePreparationError("accepted Provider manifest requires a matched deployment identity")
        if not any(item.get("lane") == "success" and item.get("state") == "passed" and item.get("repetition", 0) > 0 for item in cases):
            raise AcceptancePreparationError("accepted Provider manifest requires a successful repetition")
    expected_digest = manifest.get("manifest_digest")
    without_digest = {key: value for key, value in manifest.items() if key != "manifest_digest"}
    if expected_digest != canonical_sha256(without_digest):
        raise AcceptancePreparationError("Provider acceptance manifest digest mismatch")


def validate_evidence_review_package(package: dict[str, Any]) -> None:
    if package.get("schema_identity") != REVIEW_PACKAGE_SCHEMA_IDENTITY:
        raise AcceptancePreparationError("review package schema identity mismatch")
    if package.get("revision") != REVIEW_PACKAGE_REVISION:
        raise AcceptancePreparationError("review package revision mismatch")
    if package.get("execution_contract_revision") != EXECUTION_CONTRACT_REVISION:
        raise AcceptancePreparationError("review package execution contract mismatch")
    _require_digest(package.get("schema_set_revision"), "/schema_set_revision")
    _reject_forbidden_keys(package)
    review = package.get("review")
    if not isinstance(review, dict) or review.get("state") not in REVIEW_STATES:
        raise AcceptancePreparationError("review state is invalid")
    if review.get("state") == "completed" and int(review.get("reviewer_count", 0)) < 2:
        raise AcceptancePreparationError("completed review requires two independent reviewers")
    expected_digest = package.get("package_digest")
    without_digest = {key: value for key, value in package.items() if key != "package_digest"}
    if expected_digest != canonical_sha256(without_digest):
        raise AcceptancePreparationError("review package digest mismatch")


def write_preparation_document(path: str | Path, document: dict[str, Any]) -> None:
    if not isinstance(document, dict):
        raise AcceptancePreparationError("preparation document must be an object")
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
