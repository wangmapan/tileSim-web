"""Durable redacted terminal handling for the read-only F9 evidence Agent surface."""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from contracts.evidence_agent import provider_unavailable_response, validate_response


class EvidenceAgentIdempotencyConflict(ValueError):
    pass


def _record_path(run_dir: Path, idempotency_key: str) -> Path:
    key_digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    directory = run_dir / "agent-evidence-analyses"
    return directory / f"{key_digest}.json"


def terminal_provider_unavailable(
    *,
    run_dir: Path,
    request: dict,
    idempotency_key: str,
    payload_digest: str,
    schema_set_revision: str,
    read_json,
    atomic_write_json,
) -> tuple[int, dict, bool]:
    """Return or recover one redacted terminal result without retaining evidence content."""
    path = _record_path(run_dir, idempotency_key)
    existing = read_json(path)
    if existing:
        if existing.get("request_payload_sha256") != payload_digest:
            raise EvidenceAgentIdempotencyConflict(
                "Idempotency-Key was already used with a different Agent request payload."
            )
        response = existing.get("response")
        if not isinstance(response, dict):
            raise ValueError("Persisted evidence Agent terminal record is malformed.")
        validate_response(response, request)
        return int(existing.get("http_status", 503)), response, True

    request_id = f"agent-{uuid.uuid4().hex}"
    response = provider_unavailable_response(request, request_id, schema_set_revision)
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(
        path,
        {
            "record_schema_version": "tilesim.bridge.evidence_agent_terminal_record.v1",
            "request_payload_sha256": payload_digest,
            "idempotency_key_sha256": hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest(),
            "run_id": request["run_id"],
            "input_snapshot_digest": request["input_snapshot_digest"],
            "schema_set_revision": schema_set_revision,
            "http_status": 503,
            "response": response,
            "redaction": {
                "snapshot_payload_retained": False,
                "user_question_retained": False,
                "hidden_reasoning_retained": False,
            },
        },
    )
    return 503, response, False
