#!/usr/bin/env python3
"""TileSim Web local bridge.

This intentionally small server serves the standalone dashboard and exposes a
strict, allow-listed execution surface for the local TileSimCLI binary.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from api import responses
from infra import identity
from repositories import runs as run_repository
from services import execution
from services import evidence_agent as evidence_agent_service
from services import week7

from contracts import evidence_agent
from contracts.experiment_descriptor import (
    DESIGN_SPACE_MODES,
    GPU_PARTICIPATION_MODES,
    INPUT_MODES,
    PARAMETER_DEFINITIONS,
    REQUESTED_FIDELITY_OPTIONS,
    SCENARIO_OPTIONS,
    build_experiment_descriptor,
)
from contracts.validation import (
    MAX_CUSTOM_INPUT_BYTES,
    MAX_DESIGN_SPACE_CANDIDATES,
    MAX_DESIGN_SPACE_TRANSFERS,
    MAX_EXACT_JSON_INTEGER,
    SCHEDULERS,
    RequestValidationError,
    bounded_number,
    is_number,
    pointer_for_label,
    request_validation_error,
    validate_custom_inputs,
    validate_design_space_candidates,
    validate_overrides,
    validate_run_name,
)
from contracts.run_request import validate_run_request


WEB_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = WEB_ROOT / "dist" if (WEB_ROOT / "dist/index.html").is_file() else WEB_ROOT
TILESIM_ROOT = Path(os.environ.get("TILESIM_ROOT", "/mnt/d/tileSim"))
TILESIM_CLI = Path(os.environ.get("TILESIM_CLI", "/home/mapanwang/tilesim-build/TileSimCLI"))
DEPLOYMENT_MANIFEST = Path(
    os.environ.get("TILESIM_DEPLOYMENT_MANIFEST", "/mnt/d/tileSim-web/runtime/backend-current.json")
)
RUNS_ROOT = WEB_ROOT / "runs"
CONTRACT_ROOT = WEB_ROOT / "bridge/contracts"


def load_contract_json(path: Path) -> dict:
    """Load a checked-in contract document; startup must fail closed if it is invalid."""
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Bridge contract must be a JSON object: {path}")
    return value


OPENAPI_CONTRACT = load_contract_json(CONTRACT_ROOT / "openapi.json")
CONTRACT_METADATA = OPENAPI_CONTRACT["x-tilesim-contract"]

SCENARIOS = {
    "s1_des_example": {
        "label": next(
            option["label"]
            for option in SCENARIO_OPTIONS
            if option["scenario_id"] == "s1_des_example"
        ),
        "from": "S1",
        "to": "S6",
        "trace": TILESIM_ROOT / "docs/examples/s1_runtime_trace.json",
        "topology": TILESIM_ROOT / "docs/examples/modular_fabric_scenario.json",
    }
}
ALLOWED_FIDELITY_POLICIES = {
    option["fidelity_policy"] for option in REQUESTED_FIDELITY_OPTIONS if option["available"]
}
ALLOWED_GPU_PARTICIPATION_MODES = {
    option["gpu_participation_mode"] for option in GPU_PARTICIPATION_MODES if option["available"]
}
MAX_REQUEST_BYTES = 2_100_000
MAX_EVIDENCE_AGENT_REQUEST_BYTES = 1_500_000
MAX_ACTIVE_RUNS = max(1, int(os.environ.get("TILESIM_MAX_ACTIVE_RUNS", "1")))
SSE_WAIT_TIMEOUT_SECONDS = 15.0
SSE_HEARTBEAT_SECONDS = 5.0
API_VERSION = CONTRACT_METADATA["api_version"]
API_MANIFEST_SCHEMA = CONTRACT_METADATA["manifest_schema"]
ERROR_SCHEMA_VERSION = CONTRACT_METADATA["error_schema"]
ARTIFACT_MANIFEST_SCHEMA = CONTRACT_METADATA["artifact_manifest_schema"]
KNOWN_REPORT_SCHEMA_IDENTITIES = CONTRACT_METADATA["known_report_schema_identities"]
EXPERIMENT_DESCRIPTOR_CONTRACT = CONTRACT_METADATA["experiment_descriptor"]
REPORT_FILE_NAMES = CONTRACT_METADATA["report_files"]
JSON_ARTIFACT_DEFINITIONS = CONTRACT_METADATA["artifacts"]
RUN_CREATION_CONTRACT = CONTRACT_METADATA["run_creation"]
RUN_EVENT_CONTRACT = CONTRACT_METADATA["run_events"]
EVIDENCE_AGENT_CONTRACT = CONTRACT_METADATA["evidence_agent"]
SCHEMA_SET_REVISION = "sha256:" + hashlib.sha256(
    json.dumps(
        {
            path.relative_to(CONTRACT_ROOT).as_posix(): load_contract_json(path)
            for path in sorted(CONTRACT_ROOT.rglob("*.json"))
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
).hexdigest()
runs: dict[str, dict] = {}
runs_lock = threading.Lock()
metadata_lock = threading.RLock()
BRIDGE_INSTANCE_ID = uuid.uuid4().hex
week7_operation_lock = threading.Lock()
evidence_agent_operation_lock = threading.Lock()

def resolve_linked_git_dir(root: Path) -> Path | None:
    return identity.resolve_linked_git_dir(root)


def git_command(root: Path, *args: str) -> list[str]:
    return identity.git_command(root, *args)


def git_value(*args: str) -> str:
    return identity.git_value(TILESIM_ROOT, *args)


def worktree_state_digest(root: Path = TILESIM_ROOT) -> str:
    return identity.worktree_state_digest(root)


def deployment_manifest() -> dict:
    return identity.deployment_manifest(DEPLOYMENT_MANIFEST)


def backend_identity() -> dict:
    return identity.backend_identity(TILESIM_ROOT, TILESIM_CLI, DEPLOYMENT_MANIFEST)


def runtime_capabilities() -> dict:
    return identity.runtime_capabilities(TILESIM_CLI)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_id_for(handler: SimpleHTTPRequestHandler) -> str:
    return responses.request_id_for(handler)


def add_contract_headers(handler: SimpleHTTPRequestHandler) -> None:
    return responses.add_contract_headers(
        handler,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def write_json(handler: SimpleHTTPRequestHandler, status: HTTPStatus, payload: dict) -> None:
    return responses.write_json(
        handler,
        status,
        payload,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def write_error(
    handler: SimpleHTTPRequestHandler,
    status: HTTPStatus,
    code: str,
    message: str,
    *,
    field_path: str | None = None,
    retryable: bool | None = None,
) -> None:
    return responses.write_error(
        handler,
        status,
        code,
        message,
        error_schema_version=ERROR_SCHEMA_VERSION,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        field_path=field_path,
        retryable=retryable,
    )


def api_manifest() -> dict:
    return responses.api_manifest(
        OPENAPI_CONTRACT,
        manifest_schema=API_MANIFEST_SCHEMA,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        error_schema_version=ERROR_SCHEMA_VERSION,
        artifact_manifest_schema=ARTIFACT_MANIFEST_SCHEMA,
        known_report_schema_identities=KNOWN_REPORT_SCHEMA_IDENTITIES,
        experiment_descriptor_contract=EXPERIMENT_DESCRIPTOR_CONTRACT,
        run_creation_contract=RUN_CREATION_CONTRACT,
        run_event_contract=RUN_EVENT_CONTRACT,
        evidence_agent_contract=EVIDENCE_AGENT_CONTRACT,
    )


def add_cors_headers(handler: SimpleHTTPRequestHandler) -> None:
    return responses.add_cors_headers(handler)


def write_json_file(handler: SimpleHTTPRequestHandler, path: Path) -> None:
    return responses.write_json_file(
        handler,
        path,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        write_not_found=lambda: write_error(
            handler,
            HTTPStatus.NOT_FOUND,
            "artifact_not_found",
            "JSON artifact was not found.",
            retryable=False,
        ),
    )


def write_json_artifact_body(handler: SimpleHTTPRequestHandler, body: bytes) -> None:
    return responses.write_json_bytes(
        handler,
        body,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def load_reports(run: dict) -> dict:
    return run_repository.load_reports(run, JSON_ARTIFACT_DEFINITIONS)


def report_paths_for(run_dir: Path) -> dict[str, Path]:
    return run_repository.report_paths_for(run_dir, REPORT_FILE_NAMES)


def json_artifact_paths_for(run_dir: Path) -> dict[str, Path]:
    return run_repository.json_artifact_paths_for(run_dir, JSON_ARTIFACT_DEFINITIONS)


def json_schema_identity(value: object) -> str:
    return run_repository.json_schema_identity(value)


def artifact_manifest_for(run_id: str, run_dir: Path) -> dict:
    return run_repository.artifact_manifest_for(
        run_id,
        run_dir,
        artifact_definitions=JSON_ARTIFACT_DEFINITIONS,
        artifact_manifest_schema=ARTIFACT_MANIFEST_SCHEMA,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def evidence_agent_artifact_documents(run_dir: Path, manifest: dict) -> dict[str, dict]:
    """Freeze only verified, fixed-name JSON artifacts from the manifest snapshot."""
    documents: dict[str, dict] = {}
    for entry in manifest.get("artifacts", []):
        if entry.get("contract_status") != "supported":
            continue
        artifact_id = entry.get("artifact_id")
        definition = JSON_ARTIFACT_DEFINITIONS.get(artifact_id)
        if not isinstance(definition, dict):
            continue
        path = run_dir / definition["file_name"]
        try:
            body = path.read_bytes()
            document = json.loads(body)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise run_repository.ArtifactManifestValidationError(
                f"Evidence Agent artifact {artifact_id} cannot be frozen as valid JSON."
            ) from error
        if (
            not isinstance(document, dict)
            or len(body) != entry.get("bytes")
            or hashlib.sha256(body).hexdigest() != entry.get("sha256")
            or json_schema_identity(document) != entry.get("schema_identity")
        ):
            raise run_repository.ArtifactManifestValidationError(
                f"Evidence Agent artifact {artifact_id} changed after manifest verification."
            )
        documents[artifact_id] = document
    return documents


def safe_run_directory(run_id: str) -> Path | None:
    return run_repository.safe_run_directory(run_id, RUNS_ROOT)


def read_json_file(path: Path) -> dict:
    return run_repository.read_json_file(path)


def is_valid_json_file(path: Path) -> bool:
    return run_repository.is_valid_json_file(path)


def atomic_write_json(path: Path, payload: dict) -> None:
    return run_repository.atomic_write_json(path, payload)


def update_run_metadata(run_dir: Path, **updates: object) -> None:
    with metadata_lock:
        return run_repository.update_run_metadata(
            run_dir,
            read_json=read_json_file,
            write_json=atomic_write_json,
            **updates,
        )


def run_digest(report_paths: dict[str, Path]) -> dict:
    return run_repository.run_digest(report_paths)


def persisted_run(run_id: str) -> dict | None:
    return run_repository.persisted_run(
        run_id,
        runs_root=RUNS_ROOT,
        report_file_names=REPORT_FILE_NAMES,
        bridge_instance_id=BRIDGE_INSTANCE_ID,
        now=now,
        write_json=atomic_write_json,
    )


def public_run(run: dict) -> dict:
    return run_repository.public_run(run)


def idempotency_key_for(handler: SimpleHTTPRequestHandler) -> str:
    key = handler.headers.get("Idempotency-Key", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
        raise RequestValidationError(
            "Idempotency-Key must contain 8 to 128 safe characters.",
            "/headers/Idempotency-Key",
        )
    return key


def request_payload_digest(request: dict) -> str:
    canonical = json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def reject_nonfinite_json(value: str) -> None:
    raise RequestValidationError(f"JSON number {value} is not finite.", "/")


def idempotent_run(key: str) -> dict | None:
    return run_repository.idempotent_run(
        key,
        runs=runs,
        runs_root=RUNS_ROOT,
        load_persisted_run=persisted_run,
    )


def creation_response(run: dict, *, idempotent_replay: bool) -> dict:
    return run_repository.creation_response(run, idempotent_replay=idempotent_replay)


def run_snapshot(run_id: str) -> dict | None:
    return run_repository.run_snapshot(
        run_id,
        runs=runs,
        runs_lock=runs_lock,
        load_persisted_run=persisted_run,
    )


def is_terminal_run(run: dict) -> bool:
    return run_repository.is_terminal_run(run)


def write_sse_event(
    handler: SimpleHTTPRequestHandler,
    *,
    event: str,
    data: dict,
    event_id: str | None = None,
) -> None:
    return responses.write_sse_event(handler, event=event, data=data, event_id=event_id)


def materialize_inputs(run_dir: Path, scenario: dict, overrides: dict) -> dict:
    return execution.materialize_inputs(run_dir, scenario, overrides)


def materialize_custom_inputs(run_dir: Path, scenario: dict, inputs: dict) -> dict:
    return execution.materialize_custom_inputs(run_dir, scenario, inputs)


def materialize_design_space_candidates(run_dir: Path, manifest: dict | None) -> Path | None:
    return execution.materialize_design_space_candidates(run_dir, manifest)


def execute_run(run_id: str, scenario: dict, fidelity_policy: str) -> None:
    return execution.execute_run(
        run_id,
        scenario,
        fidelity_policy,
        runs_root=RUNS_ROOT,
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        runs=runs,
        runs_lock=runs_lock,
        report_paths_for=report_paths_for,
        is_valid_json_file=is_valid_json_file,
        update_run_metadata=update_run_metadata,
        now=now,
        process_runner=subprocess.run,
    )


def start_run_execution(run_id: str, scenario: dict, fidelity_policy: str) -> None:
    return execution.start_run_execution(
        run_id,
        scenario,
        fidelity_policy,
        execute=execute_run,
    )


def execute_week7_operation(operation_id: str) -> dict:
    return week7.execute_week7_operation(
        operation_id,
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        process_runner=subprocess.run,
    )


class BridgeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print("[TileSim Web] " + format % args)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/manifest":
            return write_json(self, HTTPStatus.OK, api_manifest())
        if path == "/api/health":
            identity = backend_identity()
            cli_available = TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)
            return write_json(self, HTTPStatus.OK, {
                "cli_available": cli_available,
                "execution_ready": cli_available and identity["versions_match"],
                "tilesim_root_available": TILESIM_ROOT.is_dir(),
                "frontend_build_available": STATIC_ROOT != WEB_ROOT,
                "detail": "Bridge only permits allow-listed scenarios and structured arguments.",
                **identity,
            })
        if path == "/api/catalog":
            return write_json(self, HTTPStatus.OK, {
                "scenarios": [{"scenario_id": key, "label": value["label"]} for key, value in SCENARIOS.items()],
                "fidelity_policies": sorted(ALLOWED_FIDELITY_POLICIES),
                "input_modes": [option["input_mode"] for option in INPUT_MODES if option["available"]],
                "design_space_modes": [
                    option["design_space_mode"] for option in DESIGN_SPACE_MODES if option["available"]
                ],
                "gpu_participation_modes": sorted(ALLOWED_GPU_PARTICIPATION_MODES),
            })
        if path == "/api/capabilities":
            return write_json(self, HTTPStatus.OK, runtime_capabilities())
        if path == "/api/experiment-schema":
            return write_json(
                self,
                HTTPStatus.OK,
                build_experiment_descriptor(SCHEMA_SET_REVISION, runtime_capabilities()),
            )
        if path == "/api/agent/evidence-capabilities":
            return write_json(
                self,
                HTTPStatus.OK,
                evidence_agent.build_descriptor(SCHEMA_SET_REVISION),
            )
        if path == "/api/week7/evidence-map":
            return self.run_week7_operation("evidence_map")
        parts = path.strip("/").split("/")
        if path == "/api/runs":
            return self.list_runs()
        if len(parts) == 3 and parts[:2] == ["api", "templates"]:
            scenario = SCENARIOS.get(parts[2])
            if scenario is None:
                return write_error(
                    self,
                    HTTPStatus.NOT_FOUND,
                    "template_not_found",
                    "Template scenario was not found.",
                    field_path="/scenario_id",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, {
                "scenario_id": parts[2],
                "runtime_trace": json.loads(scenario["trace"].read_text(encoding="utf-8")),
                "topology": json.loads(scenario["topology"].read_text(encoding="utf-8")),
            })
        if len(parts) == 3 and parts[:2] == ["api", "runs"]:
            return self.get_run(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "events":
            return self.get_run_events(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "reports":
            return self.get_reports(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "artifacts":
            return self.get_artifact_manifest(parts[2])
        if len(parts) == 5 and parts[:2] == ["api", "runs"] and parts[3] == "files":
            return self.get_json_artifact(parts[2], parts[4])
        if path == "/api" or path.startswith("/api/"):
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "unknown_endpoint",
                "Unknown API endpoint.",
                retryable=False,
            )
        if Path(path).suffix == "" and (STATIC_ROOT / "index.html").is_file():
            self.path = "/index.html"
        return super().do_GET()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        add_contract_headers(self)
        add_cors_headers(self)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Request-ID, Idempotency-Key, Last-Event-ID",
        )
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        parts = path.strip("/").split("/")
        if path == "/api/week7/calibration-example":
            return self.run_week7_operation("calibration_example")
        if path == "/api/week7/orchestration-example":
            return self.run_week7_operation("orchestration_example")
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "name":
            return self.rename_run(parts[2])
        if (
            len(parts) == 5
            and parts[:2] == ["api", "runs"]
            and parts[3:] == ["agent", "evidence-analyses"]
        ):
            return self.create_evidence_analysis(parts[2])
        if path != "/api/runs":
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "unknown_endpoint",
                "Unknown API endpoint.",
                retryable=False,
            )

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise RequestValidationError("Request body must be between 1 byte and 2.1 MB.", "/")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise RequestValidationError("Request body must be a JSON object.", "/")
            idempotency_key = idempotency_key_for(self)
            payload_digest = request_payload_digest(request)
        except (ValueError, json.JSONDecodeError) as error:
            validation = request_validation_error(error)
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_request",
                str(validation),
                field_path=validation.field_path,
                retryable=False,
            )

        with runs_lock:
            existing = idempotent_run(idempotency_key)
            replay_digest = existing.get("request_payload_sha256") if existing is not None else None
            replay_response = (
                creation_response(existing, idempotent_replay=True) if existing is not None else None
            )
        if replay_response is not None:
            if replay_digest != payload_digest:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "idempotency_payload_mismatch",
                    "Idempotency-Key was already used with a different request payload.",
                    field_path="/headers/Idempotency-Key",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, replay_response)

        try:
            capabilities = runtime_capabilities()
            command = validate_run_request(
                request,
                scenario_ids=set(SCENARIOS),
                fidelity_policies=ALLOWED_FIDELITY_POLICIES,
                gpu_participation_modes=ALLOWED_GPU_PARTICIPATION_MODES,
                capabilities=capabilities,
            )
            scenario_id = command.scenario_id
            fidelity_policy = command.fidelity_policy
            gpu_participation_mode = command.gpu_participation_mode
            run_name = command.run_name
            overrides = command.overrides
            custom_inputs = command.custom_inputs
            design_space_candidates = command.design_space_candidates
        except (ValueError, json.JSONDecodeError) as error:
            validation = request_validation_error(error)
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_request",
                str(validation),
                field_path=validation.field_path,
                retryable=False,
            )

        if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "cli_unavailable",
                "TileSimCLI is not available to the bridge.",
            )
        identity = backend_identity()
        if not identity["versions_match"]:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "backend_identity_mismatch",
                "Backend source and TileSimCLI build revisions do not match; run scripts/update-backend.ps1.",
            )

        with runs_lock:
            existing = idempotent_run(idempotency_key)
            if existing is not None:
                replay_digest = existing.get("request_payload_sha256")
                replay_response = creation_response(existing, idempotent_replay=True)
                reservation_error = None
                capacity_reached = False
            else:
                replay_digest = None
                replay_response = None
                active_run_count = sum(
                    run.get("status") in {"preparing", "running"}
                    for run in runs.values()
                )
                capacity_reached = active_run_count >= MAX_ACTIVE_RUNS
                if capacity_reached:
                    reservation_error = None
                else:
                    run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
                    run_dir = RUNS_ROOT / run_id
                    input_mode = "json" if custom_inputs is not None else "controls"
                    metadata = {
                        "run_id": run_id,
                        "status": "preparing",
                        "created_at": now(),
                        "scenario_id": scenario_id,
                        "run_name": run_name,
                        "fidelity_policy": fidelity_policy,
                        "gpu_participation_mode": gpu_participation_mode,
                        "input_mode": input_mode,
                        "overrides": overrides,
                        "input_files": {
                            "runtime_trace": "input-runtime-trace.json",
                            "topology": "input-topology.json",
                        },
                        "design_space_mode": (
                            "external_manifest" if design_space_candidates is not None else "built_in_synthetic"
                        ),
                        "idempotency_key": idempotency_key,
                        "request_payload_sha256": payload_digest,
                        "bridge_instance_id": BRIDGE_INSTANCE_ID,
                        "bridge_pid": os.getpid(),
                    }
                    if design_space_candidates is not None:
                        metadata["input_files"]["design_space_candidates"] = "input-design-space-candidates.json"
                    try:
                        run_dir.mkdir(parents=True, exist_ok=False)
                        atomic_write_json(run_dir / "run-metadata.json", metadata)
                    except OSError as error:
                        reservation_error = error
                    else:
                        reservation_error = None
                        runs[run_id] = metadata.copy()

        if replay_response is not None:
            if replay_digest != payload_digest:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "idempotency_payload_mismatch",
                    "Idempotency-Key was already used with a different request payload.",
                    field_path="/headers/Idempotency-Key",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, replay_response)

        if capacity_reached:
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "run_capacity_reached",
                f"The local bridge already has {MAX_ACTIVE_RUNS} active run(s). Wait for completion and retry.",
                retryable=True,
            )

        if reservation_error is not None:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "idempotency_reservation_failed",
                f"Could not reserve durable run metadata: {reservation_error}",
                retryable=True,
            )

        try:
            resolved_scenario = (
                materialize_custom_inputs(run_dir, SCENARIOS[scenario_id], custom_inputs)
                if custom_inputs is not None
                else materialize_inputs(run_dir, SCENARIOS[scenario_id], overrides)
            )
            resolved_scenario["design_space_candidates"] = materialize_design_space_candidates(
                run_dir,
                design_space_candidates,
            )
            metadata["status"] = "running"
            atomic_write_json(run_dir / "run-metadata.json", metadata)
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            metadata["status"] = "failed"
            metadata["finished_at"] = now()
            metadata["error"] = f"Could not prepare run inputs: {error}"
            try:
                atomic_write_json(run_dir / "run-metadata.json", metadata)
            except OSError:
                pass
            with runs_lock:
                runs[run_id] = metadata.copy()
            return write_json(
                self,
                HTTPStatus.ACCEPTED,
                creation_response(metadata, idempotent_replay=False),
            )

        with runs_lock:
            runs[run_id] = metadata.copy()

        start_run_execution(run_id, resolved_scenario, fidelity_policy)
        return write_json(
            self,
            HTTPStatus.ACCEPTED,
            creation_response(metadata, idempotent_replay=False),
        )

    def run_week7_operation(self, operation_id: str) -> None:
        if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "cli_unavailable",
                "TileSimCLI is not available to the bridge.",
                retryable=True,
            )
        backend = backend_identity()
        if not backend["versions_match"]:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "backend_identity_mismatch",
                "The deployed TileSim source and CLI identity do not match.",
                retryable=True,
            )
        if not week7_operation_lock.acquire(blocking=False):
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "week7_capacity_reached",
                "Another Week 7 evidence operation is active.",
                retryable=True,
            )
        try:
            payload = execute_week7_operation(operation_id)
        except week7.Week7ExecutionError as error:
            return write_error(
                self,
                HTTPStatus.GATEWAY_TIMEOUT if error.code == "week7_operation_timeout" else HTTPStatus.BAD_GATEWAY,
                error.code,
                error.message,
                retryable=error.retryable,
            )
        finally:
            week7_operation_lock.release()
        return write_json(self, HTTPStatus.OK, payload)

    def get_run(self, run_id: str) -> None:
        run = run_snapshot(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        return write_json(self, HTTPStatus.OK, public_run(run))

    def get_run_events(self, run_id: str) -> None:
        raw_last_event_id = self.headers.get("Last-Event-ID", "").strip()
        if raw_last_event_id and raw_last_event_id not in {"0", "1", "2"}:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_last_event_id",
                "Last-Event-ID must be 0, 1, or 2.",
                field_path="/headers/Last-Event-ID",
                retryable=False,
            )
        last_event_id = int(raw_last_event_id or "0")
        run = run_snapshot(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        add_contract_headers(self)
        add_cors_headers(self)
        self.end_headers()

        try:
            if is_terminal_run(run):
                if last_event_id < 2:
                    write_sse_event(self, event="run", event_id="2", data=public_run(run))
                return
            if last_event_id < 1:
                write_sse_event(self, event="run", event_id="1", data=public_run(run))

            deadline = time.monotonic() + SSE_WAIT_TIMEOUT_SECONDS
            heartbeat_at = time.monotonic() + SSE_HEARTBEAT_SECONDS
            while time.monotonic() < deadline:
                time.sleep(0.1)
                run = run_snapshot(run_id)
                if run is None:
                    return
                if is_terminal_run(run):
                    write_sse_event(self, event="run", event_id="2", data=public_run(run))
                    return
                if time.monotonic() >= heartbeat_at:
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    heartbeat_at = time.monotonic() + SSE_HEARTBEAT_SECONDS
            write_sse_event(self, event="timeout", data={"run_id": run_id})
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def rename_run(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            run_name = validate_run_name(request.get("run_name"))
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_name_request",
                str(error),
                field_path="/run_name",
                retryable=False,
            )

        try:
            with metadata_lock:
                metadata = read_json_file(run_dir / "run-metadata.json")
                if not metadata:
                    stored = persisted_run(run_id)
                    metadata = {
                        key: value
                        for key, value in (stored or {}).items()
                        if key not in {"report_paths", "digest"}
                    }
                metadata["run_id"] = run_id
                metadata["run_name"] = run_name
                atomic_write_json(run_dir / "run-metadata.json", metadata)
        except OSError as error:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "run_name_write_failed",
                f"Could not save run name: {error}",
            )
        with runs_lock:
            if run_id in runs:
                runs[run_id]["run_name"] = run_name
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "run_name": run_name})

    def create_evidence_analysis(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(
                self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_EVIDENCE_AGENT_REQUEST_BYTES:
                raise evidence_agent.EvidenceAgentContractError(
                    "input_too_large",
                    "Evidence Agent request body must be between 1 byte and 1.5 MB.",
                    "/",
                )
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise evidence_agent.EvidenceAgentContractError(
                    "unsupported_schema", "Evidence Agent request must be a JSON object.", "/"
                )
            idempotency_key = idempotency_key_for(self)
            payload_digest = request_payload_digest(request)
            manifest = artifact_manifest_for(run_id, run_dir)
            documents = evidence_agent_artifact_documents(run_dir, manifest)
            evidence_agent.validate_request(
                request,
                path_run_id=run_id,
                schema_set_revision=SCHEMA_SET_REVISION,
                artifact_manifest=manifest,
                artifact_documents=documents,
                current_backend_identity=backend_identity(),
            )
        except evidence_agent.EvidenceAgentContractError as error:
            return write_error(
                self,
                error.http_status,
                error.reason_code,
                str(error),
                field_path=error.field_path,
                retryable=False,
            )
        except RequestValidationError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "unsupported_schema",
                str(error),
                field_path=error.field_path,
                retryable=False,
            )
        except run_repository.ArtifactManifestValidationError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "citation_not_resolvable",
                str(error),
                retryable=False,
            )
        except (ValueError, json.JSONDecodeError):
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "unsupported_schema",
                "Evidence Agent request is not valid strict JSON.",
                field_path="/",
                retryable=False,
            )

        if not evidence_agent_operation_lock.acquire(blocking=False):
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "concurrency_limit",
                "The single read-only evidence Agent operation slot is occupied.",
                retryable=True,
            )
        try:
            status, response, _ = evidence_agent_service.terminal_provider_unavailable(
                run_dir=run_dir,
                request=request,
                idempotency_key=idempotency_key,
                payload_digest=payload_digest,
                schema_set_revision=SCHEMA_SET_REVISION,
                read_json=read_json_file,
                atomic_write_json=atomic_write_json,
            )
        except evidence_agent_service.EvidenceAgentIdempotencyConflict as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "idempotency_payload_mismatch",
                str(error),
                field_path="/headers/Idempotency-Key",
                retryable=False,
            )
        except (OSError, ValueError) as error:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "terminal_recovery_failed",
                str(error),
                retryable=False,
            )
        finally:
            evidence_agent_operation_lock.release()
        return write_json(self, HTTPStatus(status), response)

    def get_reports(self, run_id: str) -> None:
        with runs_lock:
            run = runs.get(run_id)
        if run is None:
            run = persisted_run(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        if run["status"] != "completed":
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "run_not_completed",
                "Run has not completed.",
                retryable=True,
            )
        reports = load_reports(run)
        if "run" not in reports:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "primary_artifact_invalid",
                "The completed run no longer has a valid primary report artifact.",
                retryable=False,
            )
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "reports": reports})

    def get_json_artifact(self, run_id: str, artifact: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        path = json_artifact_paths_for(run_dir).get(artifact)
        if path is None:
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "artifact_not_found",
                "JSON artifact was not found.",
                field_path="/artifact_id",
                retryable=False,
            )
        try:
            inspected = run_repository.inspect_artifact(
                run_id, path, JSON_ARTIFACT_DEFINITIONS[artifact]
            )
        except run_repository.ArtifactContractError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                f"artifact_{error.reason}",
                str(error),
                field_path=error.json_pointer,
                retryable=False,
            )
        return write_json_artifact_body(self, inspected["body"])

    def get_artifact_manifest(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        try:
            manifest = artifact_manifest_for(run_id, run_dir)
        except run_repository.ArtifactManifestValidationError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "artifact_manifest_invalid",
                str(error),
                retryable=False,
            )
        return write_json(self, HTTPStatus.OK, manifest)

    def list_runs(self) -> None:
        with runs_lock:
            active = {run_id: public_run(run) for run_id, run in runs.items()}
        for run_dir in RUNS_ROOT.iterdir():
            if not run_dir.is_dir() or run_dir.name in active:
                continue
            stored = persisted_run(run_dir.name)
            if stored is not None:
                active[run_dir.name] = public_run(stored)
        ordered = sorted(active.values(), key=lambda run: run.get("created_at", ""), reverse=True)
        return write_json(self, HTTPStatus.OK, {"runs": ordered[:20]})


def main() -> None:
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        port = int(os.environ.get("TILESIM_WEB_PORT", "5173"))
    except ValueError as error:
        raise SystemExit("TILESIM_WEB_PORT must be an integer from 1 to 65535.") from error
    if not 1 <= port <= 65_535:
        raise SystemExit("TILESIM_WEB_PORT must be an integer from 1 to 65535.")
    server = ThreadingHTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"TileSim Web bridge listening at http://127.0.0.1:{port} (UI: {STATIC_ROOT}, CLI: {TILESIM_CLI})")
    server.serve_forever()


if __name__ == "__main__":
    if sys.argv[1:] == ["--print-source-state-digest"]:
        value = worktree_state_digest()
        if value == "unknown":
            raise SystemExit("Could not calculate the TileSim source-state digest.")
        print(value)
    else:
        main()
