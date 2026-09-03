"""F9C Provider execution, redacted terminal persistence, and idempotent replay."""

from __future__ import annotations

import hashlib
import threading
import uuid
from pathlib import Path

from contracts import evidence_agent as contract
from providers import evidence_agent as provider_contract


class EvidenceAgentIdempotencyConflict(ValueError):
    pass


class EvidenceAgentTerminalNotRetained(ValueError):
    pass


_live_terminal_cache: dict[str, dict] = {}
_live_terminal_cache_lock = threading.Lock()
_TERMINAL_CLASSES = {
    "claim_free_bridge_terminal",
    "claims_bearing_terminal",
    "claim_free_provider_terminal",
}


def _record_path(run_dir: Path, idempotency_key: str) -> Path:
    key_digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    return run_dir / "agent-evidence-analyses" / f"{key_digest}.json"


def _http_status(response: dict) -> int:
    state = response["completion_state"]
    refusal = response.get("refusal")
    if isinstance(refusal, dict) and refusal.get("reason_code") == "provider_unavailable":
        return 503
    if state == "timeout":
        return 504
    if state == "failed":
        return 502
    return 200


def _redacted_record(
    *,
    request: dict,
    idempotency_key: str,
    payload_digest: str,
    response: dict,
    http_status: int,
    terminal_class: str,
) -> dict:
    if terminal_class not in _TERMINAL_CLASSES:
        raise ValueError("Evidence Agent terminal class is invalid.")
    retained_refusal = response["refusal"]
    if terminal_class == "claim_free_provider_terminal":
        # A Provider refusal detail is validated output content, not Bridge metadata.
        # Keep only bounded terminal fields below so the Provider response cannot be
        # reconstructed after restart.
        retained_refusal = None
    return {
        "record_schema_version": contract.TERMINAL_RECORD_SCHEMA_IDENTITY,
        "request_payload_sha256": payload_digest,
        "idempotency_key_sha256": hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest(),
        "run_id": request["run_id"],
        "input_snapshot_digest": request["input_snapshot_digest"],
        "schema_set_revision": request["schema_set_revision"],
        "http_status": http_status,
        "terminal_class": terminal_class,
        "terminal_metadata": {
            "request_id": response["request_id"],
            "client_request_id": response["client_request_id"],
            "completion_state": response["completion_state"],
            "provider": response["provider"],
            "revisions": response["revisions"],
            "refusal": retained_refusal,
            "partial": response["partial"],
            "truncated": response["truncated"],
            "degradation": response["degradation"],
            "audit_summary": response["audit_summary"],
            "claim_count": len(response["claims"]),
            "generated_at": response["generated_at"],
            "persistence": response["persistence"],
            "staleness": response["staleness"],
            "response_canonical_sha256": contract.canonical_sha256(response),
        },
        "redaction": {
            "snapshot_payload_retained": False,
            "artifact_payload_retained": False,
            "user_question_retained": False,
            "provider_raw_response_retained": False,
            "validated_model_claims_retained": False,
            "hidden_reasoning_retained": False,
            "credentials_retained": False,
        },
    }


def _validate_record(
    record: object,
    *,
    request: dict,
    idempotency_key: str,
    payload_digest: str,
) -> dict:
    if not isinstance(record, dict):
        raise ValueError("Persisted evidence Agent terminal record is malformed.")
    if set(record) != {
        "record_schema_version",
        "request_payload_sha256",
        "idempotency_key_sha256",
        "run_id",
        "input_snapshot_digest",
        "schema_set_revision",
        "http_status",
        "terminal_class",
        "terminal_metadata",
        "redaction",
    }:
        raise ValueError("Persisted evidence Agent terminal record has unsupported fields.")
    if record.get("request_payload_sha256") != payload_digest:
        raise EvidenceAgentIdempotencyConflict(
            "Idempotency-Key was already used with a different Agent request payload."
        )
    expected_bindings = {
        "record_schema_version": contract.TERMINAL_RECORD_SCHEMA_IDENTITY,
        "idempotency_key_sha256": hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest(),
        "run_id": request["run_id"],
        "input_snapshot_digest": request["input_snapshot_digest"],
        "schema_set_revision": request["schema_set_revision"],
    }
    if any(record.get(field) != expected for field, expected in expected_bindings.items()):
        raise ValueError("Persisted evidence Agent terminal binding is invalid.")
    if record.get("terminal_class") not in _TERMINAL_CLASSES:
        raise ValueError("Persisted evidence Agent terminal class is invalid.")
    if record.get("http_status") not in {200, 502, 503, 504}:
        raise ValueError("Persisted evidence Agent HTTP status is invalid.")
    redaction = record.get("redaction")
    required_redaction = {
        "snapshot_payload_retained",
        "artifact_payload_retained",
        "user_question_retained",
        "provider_raw_response_retained",
        "validated_model_claims_retained",
        "hidden_reasoning_retained",
        "credentials_retained",
    }
    if (
        not isinstance(redaction, dict)
        or set(redaction) != required_redaction
        or any(redaction.values())
    ):
        raise ValueError("Persisted evidence Agent redaction policy is invalid.")
    metadata = record.get("terminal_metadata")
    required_metadata = {
        "request_id",
        "client_request_id",
        "completion_state",
        "provider",
        "revisions",
        "refusal",
        "partial",
        "truncated",
        "degradation",
        "audit_summary",
        "claim_count",
        "generated_at",
        "persistence",
        "staleness",
        "response_canonical_sha256",
    }
    if not isinstance(metadata, dict) or set(metadata) != required_metadata:
        raise ValueError("Persisted evidence Agent terminal metadata is malformed.")
    claim_count = metadata.get("claim_count")
    if not isinstance(claim_count, int) or isinstance(claim_count, bool) or claim_count < 0:
        raise ValueError("Persisted evidence Agent claim count is invalid.")
    if (record["terminal_class"] == "claims_bearing_terminal") != (claim_count > 0):
        raise ValueError("Persisted evidence Agent terminal class does not match its claim count.")
    response_digest = metadata.get("response_canonical_sha256")
    digest_hex = response_digest[7:] if isinstance(response_digest, str) else ""
    if len(digest_hex) != 64 or any(character not in "0123456789abcdef" for character in digest_hex):
        raise ValueError("Persisted evidence Agent terminal digest is invalid.")
    return record


def _recover_claim_free_bridge_terminal(record: dict, request: dict) -> dict:
    metadata = record["terminal_metadata"]
    response = {
        "schema_version": contract.RESPONSE_SCHEMA_IDENTITY,
        "schema_set_revision": record["schema_set_revision"],
        "request_id": metadata["request_id"],
        "client_request_id": metadata["client_request_id"],
        "run_id": record["run_id"],
        "input_snapshot_digest": record["input_snapshot_digest"],
        "completion_state": metadata["completion_state"],
        "provider": metadata["provider"],
        "revisions": metadata["revisions"],
        "claims": [],
        "refusal": metadata["refusal"],
        "partial": metadata["partial"],
        "truncated": metadata["truncated"],
        "degradation": metadata["degradation"],
        "audit_summary": metadata["audit_summary"],
        "generated_at": metadata["generated_at"],
        "persistence": metadata["persistence"],
        "staleness": metadata["staleness"],
    }
    contract.validate_response(response, request)
    if metadata["response_canonical_sha256"] != contract.canonical_sha256(response):
        raise ValueError("Persisted evidence Agent terminal digest is invalid.")
    return response


def _controlled_failure(
    *,
    request: dict,
    request_id: str,
    schema_set_revision: str,
    provider: dict,
    completion_state: str,
    reason_code: str,
    detail: str,
    retryable: bool,
) -> dict:
    return contract.terminal_refusal_response(
        request,
        request_id,
        schema_set_revision,
        provider=provider,
        completion_state=completion_state,
        reason_code=reason_code,
        detail=detail,
        retryable=retryable,
    )


def terminal_analysis(
    *,
    run_dir: Path,
    request: dict,
    artifact_documents: dict[str, dict],
    idempotency_key: str,
    payload_digest: str,
    schema_set_revision: str,
    provider_runtime: provider_contract.ProviderRuntime,
    read_json,
    atomic_write_json,
) -> tuple[int, dict, bool]:
    """Execute or replay one fixed-snapshot analysis without persisting model content."""
    path = _record_path(run_dir, idempotency_key)
    cache_key = str(path.resolve())
    existing = read_json(path)
    if existing:
        existing = _validate_record(
            existing,
            request=request,
            idempotency_key=idempotency_key,
            payload_digest=payload_digest,
        )
        with _live_terminal_cache_lock:
            cached = _live_terminal_cache.get(cache_key)
        if isinstance(cached, dict):
            contract.validate_response(cached, request)
            return int(existing.get("http_status", _http_status(cached))), cached, True
        if existing["terminal_class"] == "claim_free_bridge_terminal":
            replay = _recover_claim_free_bridge_terminal(existing, request)
            return int(existing.get("http_status", _http_status(replay))), replay, True
        raise EvidenceAgentTerminalNotRetained(
            "The prior validated model result was intentionally not persisted; automatic Provider replay is forbidden."
        )

    request_id = f"agent-{uuid.uuid4().hex}"
    capability = provider_runtime.capability()
    if not capability.available or provider_runtime.config is None:
        response = contract.provider_unavailable_response(request, request_id, schema_set_revision)
        status = 503
        terminal_class = "claim_free_bridge_terminal"
    else:
        provider_identity = provider_runtime.config.public_identity
        payload = provider_contract.build_analysis_payload(
            config=provider_runtime.config,
            request=request,
            request_id=request_id,
            artifact_documents=artifact_documents,
            resolve_pointer=contract.resolve_json_pointer,
            prompt_template_revision=contract.PROMPT_TEMPLATE_REVISION,
            policy_revision=contract.POLICY_REVISION,
        )
        try:
            response = provider_runtime.analyze(payload)
            contract.validate_response(
                response,
                request,
                expected_provider=provider_identity,
                expected_request_id=request_id,
            )
            terminal_class = (
                "claims_bearing_terminal" if response["claims"] else "claim_free_provider_terminal"
            )
        except provider_contract.ProviderTimeoutError:
            response = _controlled_failure(
                request=request,
                request_id=request_id,
                schema_set_revision=schema_set_revision,
                provider=provider_identity,
                completion_state="timeout",
                reason_code="timeout",
                detail="The authenticated evidence Provider timed out.",
                retryable=True,
            )
            terminal_class = "claim_free_bridge_terminal"
        except provider_contract.ProviderUnavailableError:
            provider_runtime.invalidate_capability()
            response = _controlled_failure(
                request=request,
                request_id=request_id,
                schema_set_revision=schema_set_revision,
                provider=provider_identity,
                completion_state="refused",
                reason_code="provider_unavailable",
                detail="The authenticated evidence Provider became unavailable.",
                retryable=True,
            )
            terminal_class = "claim_free_bridge_terminal"
        except provider_contract.ProviderStructuredOutputError:
            response = _controlled_failure(
                request=request,
                request_id=request_id,
                schema_set_revision=schema_set_revision,
                provider=provider_identity,
                completion_state="failed",
                reason_code="unsupported_schema",
                detail="Provider output was not a valid structured evidence response.",
                retryable=False,
            )
            terminal_class = "claim_free_bridge_terminal"
        except contract.EvidenceAgentContractError as error:
            reason = error.reason_code
            if reason not in contract.REFUSAL_REASON_CODES:
                reason = "unsupported_schema"
            response = _controlled_failure(
                request=request,
                request_id=request_id,
                schema_set_revision=schema_set_revision,
                provider=provider_identity,
                completion_state="failed",
                reason_code=reason,
                detail=(
                    "Provider output failed the Bridge evidence-contract validation at "
                    f"{error.field_path or '/'}"
                    "."
                ),
                retryable=False,
            )
            terminal_class = "claim_free_bridge_terminal"
        status = _http_status(response)

    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(
        path,
        _redacted_record(
            request=request,
            idempotency_key=idempotency_key,
            payload_digest=payload_digest,
            response=response,
            http_status=status,
            terminal_class=terminal_class,
        ),
    )
    with _live_terminal_cache_lock:
        _live_terminal_cache[cache_key] = response
    return status, response, False


def terminal_provider_unavailable(**kwargs) -> tuple[int, dict, bool]:
    """Compatibility wrapper retained for focused F9B callers and tests."""
    runtime = provider_contract.ProviderRuntime(None)
    return terminal_analysis(provider_runtime=runtime, artifact_documents={}, **kwargs)
