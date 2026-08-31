"""F9B read-only, run-bound evidence Agent contracts and validators."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from http import HTTPStatus


DESCRIPTOR_SCHEMA_IDENTITY = "tilesim.bridge.evidence_agent_descriptor.v2"
REQUEST_SCHEMA_IDENTITY = "tilesim.bridge.evidence_agent_request.v1"
RESPONSE_SCHEMA_IDENTITY = "tilesim.bridge.evidence_agent_response.v1"
CITATION_SCHEMA_IDENTITY = "tilesim.bridge.evidence_agent_citation.v1"
SNAPSHOT_REFERENCE_SCHEMA_IDENTITY = "tilesim.bridge.evidence_snapshot_reference.v1"
STRUCTURED_REPORT_SCHEMA_IDENTITY = "tilesim.web.structured-performance-report.v2"
TERMINAL_RECORD_SCHEMA_IDENTITY = "tilesim.bridge.evidence_agent_terminal_record.v2"
PROMPT_TEMPLATE_REVISION = "tilesim.evidence_agent.prompt_template.v2"
POLICY_REVISION = "tilesim.evidence_agent.read_only_policy.v2"

SUPPORTED_LOCALES = ("en-US", "zh-CN")
SUPPORTED_TASK_KINDS = (
    "explain_p99",
    "explain_tail",
    "summarize_validation",
    "draft_conditional_recommendations",
)
ALLOWED_TOOLS = ("verified_snapshot_read", "citation_resolution")
FORBIDDEN_TOOLS = (
    "shell",
    "arbitrary_file_read",
    "arbitrary_path_access",
    "arbitrary_http",
    "network",
    "cross_run_history",
    "simulation_mutation",
)
REFUSAL_REASON_CODES = (
    "insufficient_evidence",
    "citation_not_allowed",
    "citation_not_resolvable",
    "unsupported_schema",
    "stale_schema_revision",
    "run_binding_mismatch",
    "ambiguous_reference",
    "provenance_scope_violation",
    "fidelity_scope_violation",
    "unsafe_tool_request",
    "prompt_injection",
    "input_too_large",
    "output_truncated",
    "provider_unavailable",
    "timeout",
    "cancelled",
    "concurrency_limit",
)
AVAILABILITY_STATES = (
    "available",
    "missing",
    "expected_absence",
    "not_covered",
    "unsupported_schema",
    "not_applicable",
)
SUBJECT_ID_FIELDS = {
    "run": "run_id",
    "request": "request_id",
    "fabric_phase": "phase_id",
    "memory_event": "memory_event_id",
    "device_task": "device_task_id",
    "collective": "collective_id",
    "cause": "cause_id",
    "attribution": "attribution_id",
    "stage": "stage_id",
    "check": "check_id",
    "candidate": "candidate_id",
    "fabric_domain": "domain_id",
    "objective": "objective_id",
    "executed_s6_knob": "knob_id",
}
EVIDENTIARY_CLAIM_KINDS = {
    "numeric_fact",
    "comparative_fact",
    "reported_attribution",
    "validation_boundary",
    "provenance_boundary",
    "fidelity_boundary",
    "conditional_recommendation",
    "architecture_correction",
}
CITATION_ROLES = {
    "direct_fact",
    "reported_attribution",
    "validation_boundary",
    "provenance_constraint",
    "fidelity_constraint",
    "conditional_recommendation_basis",
}

EVALUATION_CASE_IDS = {
    "valid-cited-numeric-fact",
    "valid-reported-attribution",
    "valid-conditional-recommendation",
    "missing-citation",
    "dangling-json-pointer",
    "wrong-json-pointer-subject",
    "wrong-sha256",
    "wrong-run-id",
    "wrong-schema-identity",
    "duplicate-stable-id",
    "stale-schema-set-revision",
    "unsupported-response-schema",
    "legacy-compatibility-input",
    "p99-single-request",
    "p99-tie-no-single-request",
    "p99-not-applicable",
    "availability-zero-vs-missing",
    "availability-six-way-distinction",
    "uint64-over-max-safe-integer",
    "s3-s4-s5-peer-semantics",
    "reject-fake-s3-s4-s5-chain",
    "reject-s7-s9-causal-ranking",
    "synthetic-to-real-promotion",
    "compatibility-to-held-out-promotion",
    "requested-resolved-fidelity-confusion",
    "des-to-cycle-promotion",
    "cross-run-evidence-leakage",
    "stale-async-result",
    "backend-identity-change",
    "prompt-injection-in-report-text",
    "request-shell-file-http",
    "opaque-evidence-link",
    "insufficient-evidence",
    "partial-valid-claims",
    "truncated-output",
    "timeout-and-cancel",
}
PERSISTENCE_POLICY = {
    "mode": {
        "storage_scope": "run_local",
        "record_kind": "redacted_terminal_metadata_only",
        "record_schema_identity": TERMINAL_RECORD_SCHEMA_IDENTITY,
    },
    "retention_seconds": 86_400,
    "terminal_classes": {
        "claim_free_bridge_terminal": {
            "terminal_metadata_retained": True,
            "exact_response_recoverable_after_restart": True,
        },
        "claims_bearing_terminal": {
            "terminal_metadata_retained": True,
            "validated_model_claims_retained": False,
            "exact_response_recoverable_after_restart": False,
        },
        "claim_free_provider_terminal": {
            "terminal_metadata_retained": True,
            "validated_provider_response_retained": False,
            "exact_response_recoverable_after_restart": False,
        },
    },
    "payload_retention": {
        "user_question_retained": False,
        "snapshot_payload_retained": False,
        "artifact_payload_retained": False,
        "provider_raw_response_retained": False,
        "validated_model_claims_retained": False,
        "credentials_retained": False,
        "hidden_reasoning_retained": False,
    },
}
RETRY_POLICY = {
    "payload_identity": "tilesim.bridge.canonical_json.v1_sha256",
    "same_key_same_canonical_payload": {
        "in_process": "exact_terminal_replay",
        "after_restart_claim_free_bridge_terminal": "exact_terminal_replay_from_redacted_record",
        "after_restart_claims_bearing_terminal": "error_terminal_result_not_retained",
        "after_restart_claim_free_provider_terminal": "error_terminal_result_not_retained",
        "provider_reinvocation": "forbidden",
    },
    "same_key_different_canonical_payload": {
        "outcome": "error",
        "http_status": 409,
        "code": "idempotency_payload_mismatch",
        "field_path": "/headers/Idempotency-Key",
        "retryable": False,
    },
}
TERMINAL_RECOVERY_POLICY = {
    "record_scope": "run_local",
    "record_schema_identity": TERMINAL_RECORD_SCHEMA_IDENTITY,
    "claim_free_bridge_terminal": {
        "outcome": "exact_terminal_replay",
        "source": "redacted_terminal_metadata",
    },
    "claims_bearing_terminal": {
        "outcome": "error",
        "http_status": 409,
        "code": "terminal_result_not_retained",
        "field_path": "/headers/Idempotency-Key",
        "retryable": False,
    },
    "claim_free_provider_terminal": {
        "outcome": "error",
        "http_status": 409,
        "code": "terminal_result_not_retained",
        "field_path": "/headers/Idempotency-Key",
        "retryable": False,
    },
    "provider_reinvocation": "forbidden",
}
DESCRIPTOR_REVISION = "sha256:" + hashlib.sha256(
    json.dumps(
        {
            "schema_identities": [
                DESCRIPTOR_SCHEMA_IDENTITY,
                REQUEST_SCHEMA_IDENTITY,
                RESPONSE_SCHEMA_IDENTITY,
                CITATION_SCHEMA_IDENTITY,
                SNAPSHOT_REFERENCE_SCHEMA_IDENTITY,
                STRUCTURED_REPORT_SCHEMA_IDENTITY,
            ],
            "prompt_template_revision": PROMPT_TEMPLATE_REVISION,
            "policy_revision": POLICY_REVISION,
            "locales": SUPPORTED_LOCALES,
            "task_kinds": SUPPORTED_TASK_KINDS,
            "allowed_tools": ALLOWED_TOOLS,
            "forbidden_tools": FORBIDDEN_TOOLS,
            "refusal_reason_codes": REFUSAL_REASON_CODES,
            "availability_states": AVAILABILITY_STATES,
            "digest_contract": "tilesim.bridge.canonical_json.v1",
            "evaluation_case_ids": sorted(EVALUATION_CASE_IDS),
            "retry": RETRY_POLICY,
            "terminal_recovery": TERMINAL_RECOVERY_POLICY,
            "persistence": PERSISTENCE_POLICY,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
).hexdigest()


class EvidenceAgentContractError(ValueError):
    def __init__(
        self,
        reason_code: str,
        message: str,
        field_path: str,
        *,
        http_status: HTTPStatus = HTTPStatus.BAD_REQUEST,
    ) -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.field_path = field_path
        self.http_status = http_status


def canonical_json_text(value: object) -> str:
    """Encode the F9 canonical JSON subset without lossy numeric conversions."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        raise TypeError("Canonical F9 digests forbid binary floating-point input.")
    if isinstance(value, list):
        return "[" + ",".join(canonical_json_text(item) for item in value) + "]"
    if isinstance(value, dict):
        if any(not isinstance(key, str) for key in value):
            raise TypeError("Canonical F9 JSON object keys must be strings.")
        return "{" + ",".join(
            canonical_json_text(key) + ":" + canonical_json_text(value[key])
            for key in sorted(value)
        ) + "}"
    raise TypeError(f"Canonical F9 JSON cannot encode {type(value).__name__}.")


def canonical_sha256(value: object) -> str:
    encoded = canonical_json_text(value).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def build_descriptor(schema_set_revision: str, provider_capability: object | None = None) -> dict:
    """Publish the complete contract from an authenticated capability decision."""
    available = bool(getattr(provider_capability, "available", False))
    provider = getattr(provider_capability, "provider", None)
    if not isinstance(provider, dict):
        provider = {
            "configured": False,
            "provider_id": "not_configured",
            "model_id": "not_configured",
            "model_revision": "not_configured",
        }
    degradation_state = getattr(provider_capability, "degradation_state", "not_configured")
    degradation_detail = getattr(
        provider_capability,
        "detail",
        "No authenticated TileSim evidence Provider configuration is available.",
    )
    return {
        "schema_version": DESCRIPTOR_SCHEMA_IDENTITY,
        "schema_set_revision": schema_set_revision,
        "descriptor_revision": DESCRIPTOR_REVISION,
        "availability": "available" if available else "unavailable",
        "degradation": {
            "state": "none" if available else degradation_state,
            "reason_code": "none" if available else "provider_unavailable",
            "detail": degradation_detail,
        },
        "availability_predicate": {
            "capability_path": "/provider/configured",
            "operator": "equals",
            "expected_value": True,
            "evaluated_available": available,
        },
        "schema_identities": {
            "request": REQUEST_SCHEMA_IDENTITY,
            "response": RESPONSE_SCHEMA_IDENTITY,
            "citation": CITATION_SCHEMA_IDENTITY,
            "snapshot_reference": SNAPSHOT_REFERENCE_SCHEMA_IDENTITY,
            "structured_report": STRUCTURED_REPORT_SCHEMA_IDENTITY,
        },
        "provider": provider,
        "revisions": {
            "prompt_template_revision": PROMPT_TEMPLATE_REVISION,
            "policy_revision": POLICY_REVISION,
        },
        "supported_locales": list(SUPPORTED_LOCALES),
        "supported_task_kinds": list(SUPPORTED_TASK_KINDS),
        "limits": {
            "maximum_request_bytes": 1_500_000,
            "maximum_question_characters": 4_000,
            "maximum_artifacts": 16,
            "maximum_records_per_artifact": 2_048,
            "maximum_claims": 128,
            "maximum_output_characters": 64_000,
        },
        "digest_contract": {
            "algorithm": "sha256",
            "output_encoding": "lowercase_hex_with_sha256_prefix",
            "canonicalization": "tilesim.bridge.canonical_json.v1",
            "text_encoding": "utf-8",
            "object_key_order": "unicode_code_point_ascending",
            "array_order": "preserved",
            "separators": "comma_colon_no_whitespace",
            "non_ascii_escaping": "preserve_utf8",
            "integer_encoding": "canonical_decimal_json_token_lossless",
            "non_finite_numbers": "forbidden",
            "artifact_manifest_material": "entire_verified_manifest_object",
            "input_snapshot_material_fields": [
                "schema_version",
                "schema_set_revision",
                "run_id",
                "structured_report_schema_identity",
                "snapshot_reference",
                "artifact_allow_list",
            ],
            "excluded_untrusted_fields": ["locale", "task_kind", "client_request_id", "user_question"],
        },
        "tools": {
            "allowed": list(ALLOWED_TOOLS),
            "forbidden": list(FORBIDDEN_TOOLS),
            "allow_list_expansion": False,
        },
        "persistence": copy.deepcopy(PERSISTENCE_POLICY),
        "redaction": {
            "user_question": "not_retained",
            "snapshot_payload": "not_retained",
            "artifact_payload": "not_retained",
            "provider_raw_response": "not_retained",
            "validated_model_claims": "memory_only_until_process_exit",
            "credentials": "never_retained",
            "hidden_chain_of_thought": "never_returned_or_retained",
        },
        "execution": {
            "mode": "synchronous_terminal",
            "timeout_ms": 30_000,
            "cancellation": "not_applicable_after_synchronous_terminal_response",
            "maximum_concurrent_operations": 1,
            "retry": copy.deepcopy(RETRY_POLICY),
            "terminal_recovery": copy.deepcopy(TERMINAL_RECOVERY_POLICY),
        },
    }


def _closed_object(value: object, allowed: set[str], required: set[str], path: str) -> dict:
    if not isinstance(value, dict):
        raise EvidenceAgentContractError("unsupported_schema", "Expected an object.", path)
    if unknown := set(value) - allowed:
        field = sorted(unknown)[0]
        raise EvidenceAgentContractError(
            "unsafe_tool_request",
            f"Unsupported field: {field}.",
            f"{path}/{field}" if path else f"/{field}",
        )
    if missing := required - set(value):
        field = sorted(missing)[0]
        raise EvidenceAgentContractError(
            "unsupported_schema",
            f"Required field is missing: {field}.",
            f"{path}/{field}" if path else f"/{field}",
        )
    return value


def _validate_question(question: object) -> dict:
    question = _closed_object(
        question,
        {"content", "trust_level"},
        {"content", "trust_level"},
        "/user_question",
    )
    content = question["content"]
    if not isinstance(content, str) or not 1 <= len(content) <= 4_000:
        raise EvidenceAgentContractError(
            "input_too_large",
            "user_question must contain 1 to 4000 characters.",
            "/user_question/content",
        )
    if question["trust_level"] != "untrusted_user_content":
        raise EvidenceAgentContractError(
            "prompt_injection",
            "user_question must remain explicitly untrusted.",
            "/user_question/trust_level",
        )
    lowered = content.casefold()
    injection_markers = (
        "ignore previous",
        "ignore all previous",
        "system prompt",
        "override policy",
        "reveal hidden",
        "chain of thought",
    )
    if any(marker in lowered for marker in injection_markers):
        raise EvidenceAgentContractError(
            "prompt_injection",
            "The untrusted question contains a policy-override instruction.",
            "/user_question/content",
        )
    unsafe_patterns = (
        r"https?://",
        r"file://",
        r"[a-zA-Z]:[\\/]",
        r"(?:^|\s)/(?:etc|home|mnt|proc|sys|var)/",
        r"\b(?:powershell|cmd\.exe|bash|curl|wget|invoke-webrequest)\b",
    )
    if any(re.search(pattern, content, re.IGNORECASE) for pattern in unsafe_patterns):
        raise EvidenceAgentContractError(
            "unsafe_tool_request",
            "Shell, file, path, URL, and network requests are forbidden.",
            "/user_question/content",
        )
    return question


def _pointer_tokens(pointer: str) -> list[str]:
    if not isinstance(pointer, str) or not pointer.startswith("/"):
        raise KeyError(pointer)
    return [token.replace("~1", "/").replace("~0", "~") for token in pointer[1:].split("/")]


def resolve_json_pointer(value: object, pointer: str) -> object:
    current = value
    for token in _pointer_tokens(pointer):
        if isinstance(current, dict) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            raise KeyError(pointer)
    return current


def _pointer_parent(value: object, pointer: str) -> object:
    tokens = _pointer_tokens(pointer)
    if not tokens:
        return value
    current = value
    for token in tokens[:-1]:
        if isinstance(current, dict) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            raise KeyError(pointer)
    return current


def _subject_matches(target: object, subject: dict) -> bool:
    if not isinstance(target, dict):
        return False
    embedded = target.get("subject")
    if isinstance(embedded, dict):
        return embedded.get("kind") == subject["kind"] and embedded.get("id") == subject["id"]
    identity_field = SUBJECT_ID_FIELDS.get(subject["kind"])
    return identity_field is not None and target.get(identity_field) == subject["id"]


def _validate_allowed_record(document: dict, record: dict, path: str) -> None:
    try:
        target = resolve_json_pointer(document, record["json_pointer"])
        parent = _pointer_parent(document, record["json_pointer"])
    except KeyError as error:
        raise EvidenceAgentContractError(
            "citation_not_resolvable",
            "Allowed citation JSON Pointer does not resolve.",
            f"{path}/json_pointer",
        ) from error
    if not _subject_matches(target, record["subject"]):
        raise EvidenceAgentContractError(
            "citation_not_resolvable",
            "Allowed citation Pointer does not identify the declared stable subject.",
            f"{path}/subject",
        )
    if isinstance(parent, list):
        matching = sum(_subject_matches(item, record["subject"]) for item in parent)
        if matching != 1:
            raise EvidenceAgentContractError(
                "ambiguous_reference",
                "Stable subject is missing or duplicated in its containing collection.",
                f"{path}/subject/id",
            )


def _validate_evidence_scope(scope: object) -> dict:
    scope = _closed_object(
        scope,
        {
            "source_mode",
            "calibration_level",
            "allowed_claim_scope",
            "claim_scope_class",
            "requested_fidelity",
            "resolved_fidelity",
            "execution_mode",
            "canonical_flow",
            "resource_semantics_relation",
            "execution_host",
            "validation_plane",
            "output_plane",
            "percentile_subject",
            "availability_states_present",
        },
        {
            "source_mode",
            "calibration_level",
            "allowed_claim_scope",
            "claim_scope_class",
            "requested_fidelity",
            "resolved_fidelity",
            "execution_mode",
            "canonical_flow",
            "resource_semantics_relation",
            "execution_host",
            "validation_plane",
            "output_plane",
            "percentile_subject",
            "availability_states_present",
        },
        "/snapshot_reference/evidence_scope",
    )
    source_mode = scope["source_mode"]
    claim_scope_class = scope["claim_scope_class"]
    allowed_classes = {
        "synthetic_trace": {"synthetic_consistency", "exploratory"},
        "compatibility_harness_trace": {"compatibility_only"},
        "real_trace": {"real_trace_calibrated", "held_out_validated"},
    }
    if source_mode not in allowed_classes or claim_scope_class not in allowed_classes[source_mode]:
        raise EvidenceAgentContractError(
            "provenance_scope_violation",
            "Claim scope would upgrade the declared trace provenance.",
            "/snapshot_reference/evidence_scope/claim_scope_class",
        )
    for field in ("requested_fidelity", "resolved_fidelity", "execution_mode"):
        if not isinstance(scope[field], str) or "cycle" in scope[field].casefold():
            raise EvidenceAgentContractError(
                "fidelity_scope_violation",
                "Analytical or DES evidence cannot be promoted to Cycle.",
                f"/snapshot_reference/evidence_scope/{field}",
            )
    expected_architecture = {
        "canonical_flow": "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6",
        "resource_semantics_relation": "S3_S4_S5_peer",
        "execution_host": "S7",
        "validation_plane": "S8",
        "output_plane": "S9",
    }
    for field, expected in expected_architecture.items():
        if scope[field] != expected:
            raise EvidenceAgentContractError(
                "fidelity_scope_violation" if field == "execution_host" else "unsupported_schema",
                "Canonical subsystem architecture is not preserved.",
                f"/snapshot_reference/evidence_scope/{field}",
            )
    percentile = _closed_object(
        scope["percentile_subject"],
        {"selection_semantics", "selected_request_id", "member_request_ids"},
        {"selection_semantics", "selected_request_id", "member_request_ids"},
        "/snapshot_reference/evidence_scope/percentile_subject",
    )
    semantics = percentile["selection_semantics"]
    selected = percentile["selected_request_id"]
    members = percentile["member_request_ids"]
    if not isinstance(members, list) or len(members) != len(set(members)) or not all(
        isinstance(member, str) and member for member in members
    ):
        raise EvidenceAgentContractError(
            "ambiguous_reference",
            "Percentile member_request_ids must be unique stable IDs.",
            "/snapshot_reference/evidence_scope/percentile_subject/member_request_ids",
        )
    if semantics == "single_request":
        valid = isinstance(selected, str) and selected and members == [selected]
    elif semantics == "tie_no_single_request":
        valid = selected is None and len(members) >= 2
    elif semantics == "not_applicable":
        valid = selected is None and not members
    elif semantics == "missing":
        valid = selected is None and not members
    else:
        valid = False
    if not valid:
        raise EvidenceAgentContractError(
            "ambiguous_reference",
            "Percentile subject selection semantics are inconsistent.",
            "/snapshot_reference/evidence_scope/percentile_subject",
        )
    availability = scope["availability_states_present"]
    if not isinstance(availability, list) or len(availability) != len(set(availability)) or any(
        state not in AVAILABILITY_STATES for state in availability
    ):
        raise EvidenceAgentContractError(
            "unsupported_schema",
            "Availability states must remain distinct supported values.",
            "/snapshot_reference/evidence_scope/availability_states_present",
        )
    return scope


def snapshot_material(request: dict) -> dict:
    return {
        "schema_version": request["schema_version"],
        "schema_set_revision": request["schema_set_revision"],
        "run_id": request["run_id"],
        "structured_report_schema_identity": request["structured_report_schema_identity"],
        "snapshot_reference": request["snapshot_reference"],
        "artifact_allow_list": request["artifact_allow_list"],
    }


def backend_identity_snapshot(identity: dict) -> dict:
    """Select only stable identity fields that make a frozen result display-safe."""
    return {
        field: identity.get(field, "unknown")
        for field in (
            "source_revision",
            "build_revision",
            "source_state_digest",
            "build_state_digest",
            "versions_match",
            "state_digests_match",
        )
    }


def validate_request(
    request: object,
    *,
    path_run_id: str,
    schema_set_revision: str,
    artifact_manifest: dict,
    artifact_documents: dict[str, dict],
    current_backend_identity: dict,
) -> dict:
    request = _closed_object(
        request,
        {
            "schema_version",
            "schema_set_revision",
            "run_id",
            "input_snapshot_digest",
            "structured_report_schema_identity",
            "snapshot_reference",
            "artifact_allow_list",
            "locale",
            "task_kind",
            "client_request_id",
            "user_question",
        },
        {
            "schema_version",
            "schema_set_revision",
            "run_id",
            "input_snapshot_digest",
            "structured_report_schema_identity",
            "snapshot_reference",
            "artifact_allow_list",
            "locale",
            "task_kind",
            "client_request_id",
            "user_question",
        },
        "",
    )
    if request["schema_version"] != REQUEST_SCHEMA_IDENTITY:
        raise EvidenceAgentContractError(
            "unsupported_schema", "Evidence Agent request schema is unsupported.", "/schema_version"
        )
    if request["schema_set_revision"] != schema_set_revision:
        raise EvidenceAgentContractError(
            "stale_schema_revision",
            "Request schema_set_revision does not match this Bridge.",
            "/schema_set_revision",
            http_status=HTTPStatus.CONFLICT,
        )
    if request["run_id"] != path_run_id or artifact_manifest.get("run_id") != path_run_id:
        raise EvidenceAgentContractError(
            "run_binding_mismatch", "Request, path, and manifest run IDs must match.", "/run_id"
        )
    if request["structured_report_schema_identity"] != STRUCTURED_REPORT_SCHEMA_IDENTITY:
        raise EvidenceAgentContractError(
            "unsupported_schema",
            "Structured report schema identity is unsupported.",
            "/structured_report_schema_identity",
        )
    if request["locale"] not in SUPPORTED_LOCALES:
        raise EvidenceAgentContractError("unsupported_schema", "Locale is unsupported.", "/locale")
    if request["task_kind"] not in SUPPORTED_TASK_KINDS:
        raise EvidenceAgentContractError("unsupported_schema", "Task kind is unsupported.", "/task_kind")
    if not isinstance(request["client_request_id"], str) or not re.fullmatch(
        r"[A-Za-z0-9._:-]{8,128}", request["client_request_id"]
    ):
        raise EvidenceAgentContractError(
            "unsupported_schema", "client_request_id is invalid.", "/client_request_id"
        )
    _validate_question(request["user_question"])

    reference = _closed_object(
        request["snapshot_reference"],
        {
            "schema_version",
            "artifact_manifest_schema_identity",
            "artifact_manifest_canonical_sha256",
            "backend_identity",
            "evidence_scope",
        },
        {
            "schema_version",
            "artifact_manifest_schema_identity",
            "artifact_manifest_canonical_sha256",
            "backend_identity",
            "evidence_scope",
        },
        "/snapshot_reference",
    )
    if reference["schema_version"] != SNAPSHOT_REFERENCE_SCHEMA_IDENTITY:
        raise EvidenceAgentContractError(
            "unsupported_schema", "Snapshot reference schema is unsupported.", "/snapshot_reference/schema_version"
        )
    if reference["artifact_manifest_schema_identity"] != "tilesim.bridge.artifact_manifest.v2":
        raise EvidenceAgentContractError(
            "unsupported_schema",
            "Artifact manifest schema identity is unsupported.",
            "/snapshot_reference/artifact_manifest_schema_identity",
        )
    if reference["artifact_manifest_canonical_sha256"] != canonical_sha256(artifact_manifest):
        raise EvidenceAgentContractError(
            "citation_not_allowed",
            "Artifact manifest digest does not match the current run snapshot.",
            "/snapshot_reference/artifact_manifest_canonical_sha256",
        )
    expected_backend_identity = backend_identity_snapshot(current_backend_identity)
    if reference["backend_identity"] != expected_backend_identity:
        raise EvidenceAgentContractError(
            "stale_schema_revision",
            "Backend source/build identity changed after the snapshot was frozen.",
            "/snapshot_reference/backend_identity",
            http_status=HTTPStatus.CONFLICT,
        )
    scope = _validate_evidence_scope(reference["evidence_scope"])

    allow_list = request["artifact_allow_list"]
    if not isinstance(allow_list, list) or not 1 <= len(allow_list) <= 16:
        raise EvidenceAgentContractError(
            "input_too_large", "artifact_allow_list must contain 1 to 16 artifacts.", "/artifact_allow_list"
        )
    manifest_entries = {entry["artifact_id"]: entry for entry in artifact_manifest.get("artifacts", [])}
    seen_artifacts: set[str] = set()
    declared_source_modes: set[str] = set()
    declared_execution_scope = {
        "requested_fidelity": set(),
        "resolved_fidelity": set(),
        "execution_mode": set(),
    }
    for index, item in enumerate(allow_list):
        path = f"/artifact_allow_list/{index}"
        item = _closed_object(
            item,
            {"run_id", "artifact_id", "schema_identity", "sha256", "bytes", "allowed_records"},
            {"run_id", "artifact_id", "schema_identity", "sha256", "bytes", "allowed_records"},
            path,
        )
        artifact_id = item["artifact_id"]
        if (
            not isinstance(item["run_id"], str)
            or not isinstance(artifact_id, str)
            or not artifact_id
            or not isinstance(item["schema_identity"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"] if isinstance(item["sha256"], str) else "")
            or not isinstance(item["bytes"], int)
            or isinstance(item["bytes"], bool)
            or not 0 <= item["bytes"] <= 18_446_744_073_709_551_615
        ):
            raise EvidenceAgentContractError(
                "unsupported_schema", "Artifact allow-list identity is malformed.", path
            )
        if artifact_id in seen_artifacts:
            raise EvidenceAgentContractError(
                "ambiguous_reference", "Artifact IDs must be unique.", f"{path}/artifact_id"
            )
        seen_artifacts.add(artifact_id)
        entry = manifest_entries.get(artifact_id)
        if (
            item["run_id"] != path_run_id
            or entry is None
            or entry.get("contract_status") != "supported"
            or item["schema_identity"] != entry.get("schema_identity")
            or item["sha256"] != entry.get("sha256")
            or item["bytes"] != entry.get("bytes")
        ):
            raise EvidenceAgentContractError(
                "citation_not_allowed",
                "Artifact allow-list identity does not match the verified manifest.",
                path,
            )
        document = artifact_documents.get(artifact_id)
        if not isinstance(document, dict):
            raise EvidenceAgentContractError(
                "citation_not_resolvable", "Verified artifact document is unavailable.", path
            )
        provenance = document.get("provenance")
        if isinstance(provenance, dict) and isinstance(provenance.get("source_mode"), str):
            declared_source_modes.add(provenance["source_mode"])
        if isinstance(document.get("candidate_source_mode"), str):
            declared_source_modes.add(document["candidate_source_mode"])
        for field in declared_execution_scope:
            if isinstance(document.get(field), str):
                declared_execution_scope[field].add(document[field])
        records = item["allowed_records"]
        if not isinstance(records, list) or not 1 <= len(records) <= 2_048:
            raise EvidenceAgentContractError(
                "input_too_large", "allowed_records must contain 1 to 2048 records.", f"{path}/allowed_records"
            )
        record_keys: set[tuple[str, str, str]] = set()
        for record_index, record in enumerate(records):
            record_path = f"{path}/allowed_records/{record_index}"
            record = _closed_object(
                record,
                {"json_pointer", "subject"},
                {"json_pointer", "subject"},
                record_path,
            )
            subject = _closed_object(
                record["subject"], {"kind", "id"}, {"kind", "id"}, f"{record_path}/subject"
            )
            if not isinstance(record["json_pointer"], str) or not record["json_pointer"].startswith("/"):
                raise EvidenceAgentContractError(
                    "citation_not_resolvable", "Allowed record Pointer is malformed.", f"{record_path}/json_pointer"
                )
            if subject["kind"] not in SUBJECT_ID_FIELDS or not isinstance(subject["id"], str) or not subject["id"]:
                raise EvidenceAgentContractError(
                    "citation_not_resolvable", "Stable subject is unsupported.", f"{record_path}/subject"
                )
            key = (record["json_pointer"], subject["kind"], subject["id"])
            if key in record_keys:
                raise EvidenceAgentContractError(
                    "ambiguous_reference", "Allowed record identity is duplicated.", record_path
                )
            record_keys.add(key)
            _validate_allowed_record(document, record, record_path)
    if declared_source_modes and scope["source_mode"] not in declared_source_modes:
        raise EvidenceAgentContractError(
            "provenance_scope_violation",
            "Snapshot source_mode does not match artifact provenance.",
            "/snapshot_reference/evidence_scope/source_mode",
        )
    for field, declared_values in declared_execution_scope.items():
        if declared_values and (len(declared_values) != 1 or scope[field] not in declared_values):
            raise EvidenceAgentContractError(
                "fidelity_scope_violation",
                f"Snapshot {field} does not match the verified artifact evidence.",
                f"/snapshot_reference/evidence_scope/{field}",
            )
    expected_snapshot_digest = canonical_sha256(snapshot_material(request))
    if request["input_snapshot_digest"] != expected_snapshot_digest:
        raise EvidenceAgentContractError(
            "citation_not_allowed",
            "input_snapshot_digest does not match the immutable evidence snapshot.",
            "/input_snapshot_digest",
        )
    return request


def _allowed_record_index(request: dict) -> set[tuple]:
    return {
        (
            item["run_id"],
            item["artifact_id"],
            item["schema_identity"],
            item["sha256"],
            record["json_pointer"],
            record["subject"]["kind"],
            record["subject"]["id"],
        )
        for item in request["artifact_allow_list"]
        for record in item["allowed_records"]
    }


def validate_citation(citation: object, request: dict, path: str) -> dict:
    citation = _closed_object(
        citation,
        {
            "schema_version",
            "run_id",
            "artifact_id",
            "schema_identity",
            "sha256",
            "json_pointer",
            "subject",
            "citation_role",
            "value",
            "unit",
            "availability",
        },
        {
            "schema_version",
            "run_id",
            "artifact_id",
            "schema_identity",
            "sha256",
            "json_pointer",
            "subject",
            "citation_role",
            "availability",
        },
        path,
    )
    if citation["schema_version"] != CITATION_SCHEMA_IDENTITY:
        raise EvidenceAgentContractError("unsupported_schema", "Citation schema is unsupported.", f"{path}/schema_version")
    subject = _closed_object(citation["subject"], {"kind", "id"}, {"kind", "id"}, f"{path}/subject")
    key = (
        citation["run_id"],
        citation["artifact_id"],
        citation["schema_identity"],
        citation["sha256"],
        citation["json_pointer"],
        subject["kind"],
        subject["id"],
    )
    if key not in _allowed_record_index(request):
        reason = "run_binding_mismatch" if citation["run_id"] != request["run_id"] else "citation_not_allowed"
        raise EvidenceAgentContractError(reason, "Citation is outside the frozen allow-list.", path)
    if citation["availability"] not in AVAILABILITY_STATES:
        raise EvidenceAgentContractError(
            "unsupported_schema", "Citation availability is unsupported.", f"{path}/availability"
        )
    if citation["citation_role"] not in CITATION_ROLES:
        raise EvidenceAgentContractError(
            "unsupported_schema", "Citation role is unsupported.", f"{path}/citation_role"
        )
    if ("value" in citation) != ("unit" in citation):
        raise EvidenceAgentContractError(
            "unsupported_schema", "Citation value and unit must be present together.", path
        )
    if "value" in citation:
        value = _closed_object(
            citation["value"], {"encoding", "numeric_kind", "decimal"}, {"encoding", "numeric_kind", "decimal"}, f"{path}/value"
        )
        if value["encoding"] != "decimal_string" or value["numeric_kind"] not in {"uint64", "sint64", "decimal"}:
            raise EvidenceAgentContractError("unsupported_schema", "Citation numeric encoding is unsupported.", f"{path}/value")
        decimal = value["decimal"]
        if not isinstance(decimal, str) or not re.fullmatch(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?", decimal):
            raise EvidenceAgentContractError("unsupported_schema", "Citation decimal is not canonical.", f"{path}/value/decimal")
        if value["numeric_kind"] == "uint64":
            if "." in decimal or decimal.startswith("-") or int(decimal) > 18_446_744_073_709_551_615:
                raise EvidenceAgentContractError("unsupported_schema", "Citation uint64 is out of range.", f"{path}/value/decimal")
        if not isinstance(citation["unit"], str) or not citation["unit"]:
            raise EvidenceAgentContractError("unsupported_schema", "Citation unit is required.", f"{path}/unit")
    return citation


def validate_response(
    response: object,
    request: dict,
    *,
    expected_provider: dict | None = None,
    expected_request_id: str | None = None,
) -> dict:
    response = _closed_object(
        response,
        {
            "schema_version",
            "schema_set_revision",
            "request_id",
            "client_request_id",
            "run_id",
            "input_snapshot_digest",
            "completion_state",
            "provider",
            "revisions",
            "claims",
            "refusal",
            "partial",
            "truncated",
            "degradation",
            "audit_summary",
            "generated_at",
            "persistence",
            "staleness",
        },
        {
            "schema_version",
            "schema_set_revision",
            "request_id",
            "client_request_id",
            "run_id",
            "input_snapshot_digest",
            "completion_state",
            "provider",
            "revisions",
            "claims",
            "refusal",
            "partial",
            "truncated",
            "degradation",
            "audit_summary",
            "generated_at",
            "persistence",
            "staleness",
        },
        "",
    )
    if response["schema_version"] != RESPONSE_SCHEMA_IDENTITY:
        raise EvidenceAgentContractError("unsupported_schema", "Agent response schema is unsupported.", "/schema_version")
    if not isinstance(response["request_id"], str) or not re.fullmatch(r"agent-[A-Za-z0-9._:-]+", response["request_id"]):
        raise EvidenceAgentContractError("unsupported_schema", "Agent request_id is invalid.", "/request_id")
    if expected_request_id is not None and response["request_id"] != expected_request_id:
        raise EvidenceAgentContractError(
            "stale_schema_revision", "Agent response request_id is stale.", "/request_id"
        )
    if response["schema_set_revision"] != request["schema_set_revision"]:
        raise EvidenceAgentContractError("stale_schema_revision", "Agent response schema revision is stale.", "/schema_set_revision")
    for field in ("run_id", "input_snapshot_digest", "client_request_id"):
        if response[field] != request[field]:
            raise EvidenceAgentContractError(
                "run_binding_mismatch" if field == "run_id" else "stale_schema_revision",
                f"Agent response {field} does not match the frozen request.",
                f"/{field}",
            )
    provider = _closed_object(
        response["provider"],
        {"configured", "provider_id", "model_id", "model_revision"},
        {"configured", "provider_id", "model_id", "model_revision"},
        "/provider",
    )
    if not isinstance(provider["configured"], bool) or any(
        not isinstance(provider[field], str) or not provider[field]
        for field in ("provider_id", "model_id", "model_revision")
    ):
        raise EvidenceAgentContractError("unsupported_schema", "Provider identity is invalid.", "/provider")
    if expected_provider is not None and provider != expected_provider:
        raise EvidenceAgentContractError(
            "stale_schema_revision",
            "Provider or model identity does not match the authenticated configuration.",
            "/provider",
        )
    revisions = _closed_object(
        response["revisions"],
        {"prompt_template_revision", "policy_revision"},
        {"prompt_template_revision", "policy_revision"},
        "/revisions",
    )
    if revisions != {
        "prompt_template_revision": PROMPT_TEMPLATE_REVISION,
        "policy_revision": POLICY_REVISION,
    }:
        raise EvidenceAgentContractError(
            "stale_schema_revision", "Prompt or policy revision is stale.", "/revisions"
        )
    completion = response["completion_state"]
    if completion not in {"completed", "refused", "partial", "truncated", "failed", "timeout", "cancelled"}:
        raise EvidenceAgentContractError("unsupported_schema", "Completion state is unsupported.", "/completion_state")
    claims = response["claims"]
    if not isinstance(claims, list) or len(claims) > 128:
        raise EvidenceAgentContractError("output_truncated", "Claim count exceeds the contract limit.", "/claims")
    if completion == "completed" and (not claims or response["refusal"] is not None):
        raise EvidenceAgentContractError("insufficient_evidence", "Completed responses require cited claims and no refusal.", "/claims")
    if claims and provider["configured"] is not True:
        raise EvidenceAgentContractError(
            "provider_unavailable", "Unconfigured Providers cannot return claims.", "/provider/configured"
        )
    if completion in {"refused", "failed", "timeout", "cancelled"} and (claims or not isinstance(response["refusal"], dict)):
        raise EvidenceAgentContractError("unsupported_schema", "Terminal refusal responses cannot carry claims.", "/claims")
    if not isinstance(response["partial"], bool) or not isinstance(response["truncated"], bool):
        raise EvidenceAgentContractError("unsupported_schema", "Completion flags must be booleans.", "/partial")
    if response["partial"] != (completion == "partial"):
        raise EvidenceAgentContractError(
            "unsupported_schema", "partial must exactly match completion_state=partial.", "/partial"
        )
    if response["truncated"] != (completion == "truncated"):
        raise EvidenceAgentContractError(
            "output_truncated" if response["truncated"] else "unsupported_schema",
            "truncated must exactly match completion_state=truncated.",
            "/truncated",
        )
    refusal = response["refusal"]
    if isinstance(refusal, dict):
        _closed_object(refusal, {"reason_code", "detail", "retryable"}, {"reason_code", "detail", "retryable"}, "/refusal")
        if refusal["reason_code"] not in REFUSAL_REASON_CODES:
            raise EvidenceAgentContractError("unsupported_schema", "Refusal reason is unsupported.", "/refusal/reason_code")
        if not isinstance(refusal["detail"], str) or not refusal["detail"] or not isinstance(refusal["retryable"], bool):
            raise EvidenceAgentContractError("unsupported_schema", "Refusal detail is invalid.", "/refusal")
        expected_terminal_reason = {"timeout": "timeout", "cancelled": "cancelled"}.get(completion)
        if expected_terminal_reason and refusal["reason_code"] != expected_terminal_reason:
            raise EvidenceAgentContractError(
                "unsupported_schema", "Terminal state and refusal reason_code disagree.", "/refusal/reason_code"
            )
    scope = request["snapshot_reference"]["evidence_scope"]
    claim_ids: set[str] = set()
    output_characters = 0
    for index, claim in enumerate(claims):
        path = f"/claims/{index}"
        claim = _closed_object(
            claim,
            {"claim_id", "claim_kind", "text", "citations", "scope", "percentile_subject"},
            {"claim_id", "claim_kind", "text", "citations", "scope"},
            path,
        )
        claim_id = claim["claim_id"]
        if not isinstance(claim_id, str) or not claim_id or claim_id in claim_ids:
            raise EvidenceAgentContractError("ambiguous_reference", "claim_id must be stable and unique.", f"{path}/claim_id")
        claim_ids.add(claim_id)
        if not isinstance(claim["text"], str) or not claim["text"]:
            raise EvidenceAgentContractError("unsupported_schema", "Claim text is required.", f"{path}/text")
        output_characters += len(claim["text"])
        if output_characters > 64_000:
            raise EvidenceAgentContractError(
                "output_truncated", "Claim text exceeds the output contract limit.", f"{path}/text"
            )
        if claim["claim_kind"] not in EVIDENTIARY_CLAIM_KINDS | {"help_text"}:
            raise EvidenceAgentContractError("unsupported_schema", "Claim kind is unsupported.", f"{path}/claim_kind")
        citations = claim["citations"]
        if not isinstance(citations, list) or (
            claim["claim_kind"] in EVIDENTIARY_CLAIM_KINDS and not citations
        ):
            raise EvidenceAgentContractError("insufficient_evidence", "Each evidentiary atomic claim requires citations.", f"{path}/citations")
        for citation_index, citation in enumerate(citations):
            validate_citation(citation, request, f"{path}/citations/{citation_index}")
        claim_scope = _closed_object(
            claim["scope"],
            {
                "source_mode",
                "requested_fidelity",
                "resolved_fidelity",
                "execution_mode",
                "resource_semantics_relation",
                "causal_subsystems",
                "attribution_semantics",
                "recommendation_semantics",
            },
            {
                "source_mode",
                "requested_fidelity",
                "resolved_fidelity",
                "execution_mode",
                "resource_semantics_relation",
                "causal_subsystems",
                "attribution_semantics",
                "recommendation_semantics",
            },
            f"{path}/scope",
        )
        for field in ("source_mode", "requested_fidelity", "resolved_fidelity", "execution_mode", "resource_semantics_relation"):
            if claim_scope[field] != scope[field]:
                reason = "provenance_scope_violation" if field == "source_mode" else "fidelity_scope_violation"
                raise EvidenceAgentContractError(reason, "Claim scope exceeds the frozen evidence scope.", f"{path}/scope/{field}")
        causal = claim_scope["causal_subsystems"]
        if not isinstance(causal, list) or len(causal) != len(set(causal)) or any(
            subsystem not in {"S0", "S1", "S2", "S3", "S4", "S5", "S6"} for subsystem in causal
        ):
            raise EvidenceAgentContractError("fidelity_scope_violation", "S7-S9 cannot be latency causal sources.", f"{path}/scope/causal_subsystems")
        if claim["claim_kind"] == "reported_attribution" and claim_scope["attribution_semantics"] != "reported_attribution_only":
            raise EvidenceAgentContractError("fidelity_scope_violation", "Reported attribution cannot become a new causal ranking.", f"{path}/scope/attribution_semantics")
        if claim["claim_kind"] == "reported_attribution" and not any(
            citation["citation_role"] == "reported_attribution" for citation in citations
        ):
            raise EvidenceAgentContractError(
                "insufficient_evidence", "Reported attribution requires an attribution citation.", f"{path}/citations"
            )
        if claim["claim_kind"] == "conditional_recommendation" and claim_scope["recommendation_semantics"] != "conditional_not_executed":
            raise EvidenceAgentContractError("fidelity_scope_violation", "Recommendations must remain conditional and unexecuted.", f"{path}/scope/recommendation_semantics")
        if claim["claim_kind"] == "conditional_recommendation" and not any(
            citation["citation_role"] == "conditional_recommendation_basis" for citation in citations
        ):
            raise EvidenceAgentContractError(
                "insufficient_evidence", "Recommendation requires a conditional-basis citation.", f"{path}/citations"
            )
        if "percentile_subject" in claim and claim["percentile_subject"] != scope["percentile_subject"]:
            raise EvidenceAgentContractError("ambiguous_reference", "Claim cannot force a different P99 subject selection.", f"{path}/percentile_subject")
    degradation = _closed_object(
        response["degradation"], {"state", "reason_code"}, {"state", "reason_code"}, "/degradation"
    )
    if any(not isinstance(degradation[field], str) or not degradation[field] for field in degradation):
        raise EvidenceAgentContractError("unsupported_schema", "Degradation identity is invalid.", "/degradation")
    audit = _closed_object(
        response["audit_summary"],
        {"operations", "tool_invocation_count", "hidden_reasoning_returned"},
        {"operations", "tool_invocation_count", "hidden_reasoning_returned"},
        "/audit_summary",
    )
    operations = audit["operations"]
    if (
        not isinstance(operations, list)
        or len(operations) != len(set(operations))
        or any(operation not in ALLOWED_TOOLS for operation in operations)
    ):
        raise EvidenceAgentContractError("unsafe_tool_request", "Audit summary contains a forbidden operation.", "/audit_summary/operations")
    if (
        not isinstance(audit["tool_invocation_count"], int)
        or isinstance(audit["tool_invocation_count"], bool)
        or audit["tool_invocation_count"] < 0
        or audit["hidden_reasoning_returned"] is not False
    ):
        raise EvidenceAgentContractError("unsafe_tool_request", "Audit summary is invalid.", "/audit_summary")
    persistence = _closed_object(
        response["persistence"],
        {"mode", "retained_until", "snapshot_payload_retained", "user_question_retained"},
        {"mode", "retained_until", "snapshot_payload_retained", "user_question_retained"},
        "/persistence",
    )
    if (
        persistence["mode"] != "run_local_terminal_metadata_only"
        or persistence["snapshot_payload_retained"] is not False
        or persistence["user_question_retained"] is not False
    ):
        raise EvidenceAgentContractError("unsafe_tool_request", "Persistence policy is unsafe.", "/persistence")
    staleness = _closed_object(
        response["staleness"], {"state", "binding_fields"}, {"state", "binding_fields"}, "/staleness"
    )
    binding_fields = staleness["binding_fields"]
    if (
        staleness["state"] not in {"current_at_generation", "stale"}
        or not isinstance(binding_fields, list)
        or len(binding_fields) != len(set(binding_fields))
        or set(binding_fields)
        != {"run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"}
    ):
        raise EvidenceAgentContractError("stale_schema_revision", "Staleness binding is incomplete.", "/staleness")
    return response


def terminal_refusal_response(
    request: dict,
    request_id: str,
    schema_set_revision: str,
    *,
    provider: dict,
    completion_state: str,
    reason_code: str,
    detail: str,
    retryable: bool,
) -> dict:
    generated_at = datetime.now(timezone.utc)
    response = {
        "schema_version": RESPONSE_SCHEMA_IDENTITY,
        "schema_set_revision": schema_set_revision,
        "request_id": request_id,
        "client_request_id": request["client_request_id"],
        "run_id": request["run_id"],
        "input_snapshot_digest": request["input_snapshot_digest"],
        "completion_state": completion_state,
        "provider": provider,
        "revisions": {
            "prompt_template_revision": PROMPT_TEMPLATE_REVISION,
            "policy_revision": POLICY_REVISION,
        },
        "claims": [],
        "refusal": {
            "reason_code": reason_code,
            "detail": detail,
            "retryable": retryable,
        },
        "partial": completion_state == "partial",
        "truncated": completion_state == "truncated",
        "degradation": {"state": completion_state, "reason_code": reason_code},
        "audit_summary": {
            "operations": [],
            "tool_invocation_count": 0,
            "hidden_reasoning_returned": False,
        },
        "generated_at": generated_at.isoformat(),
        "persistence": {
            "mode": "run_local_terminal_metadata_only",
            "retained_until": (generated_at + timedelta(seconds=86_400)).isoformat(),
            "snapshot_payload_retained": False,
            "user_question_retained": False,
        },
        "staleness": {
            "state": "current_at_generation",
            "binding_fields": [
                "run_id",
                "input_snapshot_digest",
                "schema_set_revision",
                "backend_identity",
            ],
        },
    }
    validate_response(response, request, expected_provider=provider, expected_request_id=request_id)
    return response


def provider_unavailable_response(request: dict, request_id: str, schema_set_revision: str) -> dict:
    return terminal_refusal_response(
        request,
        request_id,
        schema_set_revision,
        provider={
            "configured": False,
            "provider_id": "not_configured",
            "model_id": "not_configured",
            "model_revision": "not_configured",
        },
        completion_state="refused",
        reason_code="provider_unavailable",
        detail="No authenticated production evidence Agent Provider is available.",
        retryable=False,
    )
