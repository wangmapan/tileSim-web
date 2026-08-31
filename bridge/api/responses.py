"""Versioned HTTP response helpers shared by Bridge API routes."""

from __future__ import annotations

import json
import re
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path


def request_id_for(handler: SimpleHTTPRequestHandler) -> str:
    existing = getattr(handler, "_tilesim_request_id", "")
    if existing:
        return existing
    candidate = handler.headers.get("X-Request-ID", "").strip()
    request_id = (
        candidate
        if re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", candidate)
        else uuid.uuid4().hex
    )
    handler._tilesim_request_id = request_id
    return request_id


def add_cors_headers(handler: SimpleHTTPRequestHandler) -> None:
    """Allow only the local Vite development origin; production is same-origin."""
    origin = handler.headers.get("Origin", "")
    if origin in {"http://127.0.0.1:4173", "http://localhost:4173"}:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")


def add_contract_headers(
    handler: SimpleHTTPRequestHandler,
    *,
    api_version: str,
    schema_set_revision: str,
) -> None:
    handler.send_header("X-Request-ID", request_id_for(handler))
    handler.send_header("X-TileSim-API-Version", api_version)
    handler.send_header("X-TileSim-Schema-Set-Revision", schema_set_revision)
    handler.send_header(
        "Access-Control-Expose-Headers",
        "X-Request-ID, X-TileSim-API-Version, X-TileSim-Schema-Set-Revision",
    )


def write_json(
    handler: SimpleHTTPRequestHandler,
    status: HTTPStatus,
    payload: dict,
    *,
    api_version: str,
    schema_set_revision: str,
) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    add_contract_headers(
        handler,
        api_version=api_version,
        schema_set_revision=schema_set_revision,
    )
    add_cors_headers(handler)
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Request-ID, Idempotency-Key, Last-Event-ID",
    )
    handler.end_headers()
    handler.wfile.write(body)


def write_error(
    handler: SimpleHTTPRequestHandler,
    status: HTTPStatus,
    code: str,
    message: str,
    *,
    error_schema_version: str,
    api_version: str,
    schema_set_revision: str,
    field_path: str | None = None,
    retryable: bool | None = None,
) -> None:
    return write_json(
        handler,
        status,
        {
            "schema_version": error_schema_version,
            "error": {
                "code": code,
                "message": message,
                "field_path": field_path,
                "retryable": status >= 500 if retryable is None else retryable,
            },
            "request_id": request_id_for(handler),
        },
        api_version=api_version,
        schema_set_revision=schema_set_revision,
    )


def api_manifest(
    openapi_contract: dict,
    *,
    manifest_schema: str,
    api_version: str,
    schema_set_revision: str,
    error_schema_version: str,
    artifact_manifest_schema: str,
    known_report_schema_identities: list,
    experiment_descriptor_contract: dict,
    run_creation_contract: dict,
    run_event_contract: dict,
    evidence_agent_contract: dict,
) -> dict:
    endpoints = {}
    for path, path_item in openapi_contract["paths"].items():
        for method in ("get", "post"):
            operation = path_item.get(method)
            if operation is not None:
                endpoints[operation["operationId"]] = f"{method.upper()} /api{path}"
    return {
        "schema_version": manifest_schema,
        "api_version": api_version,
        "schema_set_revision": schema_set_revision,
        "error_schema_version": error_schema_version,
        "artifact_manifest_schema_version": artifact_manifest_schema,
        "known_report_schema_identities": known_report_schema_identities,
        "experiment_descriptor": experiment_descriptor_contract,
        "run_creation": run_creation_contract,
        "run_events": run_event_contract,
        "evidence_agent": evidence_agent_contract,
        "endpoints": endpoints,
    }


def write_json_file(
    handler: SimpleHTTPRequestHandler,
    path: Path,
    *,
    api_version: str,
    schema_set_revision: str,
    write_not_found,
) -> None:
    """Serve an allow-listed local JSON artifact for in-browser inspection."""
    try:
        body = path.read_bytes()
        json.loads(body)
    except (OSError, json.JSONDecodeError):
        return write_not_found()
    return write_json_bytes(
        handler,
        body,
        api_version=api_version,
        schema_set_revision=schema_set_revision,
    )


def write_json_bytes(
    handler: SimpleHTTPRequestHandler,
    body: bytes,
    *,
    api_version: str,
    schema_set_revision: str,
) -> None:
    """Serve already validated bytes so manifest hashing and response bytes stay identical."""
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    add_contract_headers(
        handler,
        api_version=api_version,
        schema_set_revision=schema_set_revision,
    )
    add_cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def write_sse_event(
    handler: SimpleHTTPRequestHandler,
    *,
    event: str,
    data: dict,
    event_id: str | None = None,
) -> None:
    lines = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    lines.extend(f"data: {line}" for line in serialized.splitlines() or [""])
    handler.wfile.write(("\n".join(lines) + "\n\n").encode("utf-8"))
    handler.wfile.flush()
