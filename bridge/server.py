#!/usr/bin/env python3
"""TileSim Web local bridge.

This intentionally small server serves the standalone dashboard and exposes a
strict, allow-listed execution surface for the local TileSimCLI binary.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


WEB_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = WEB_ROOT / "dist" if (WEB_ROOT / "dist/index.html").is_file() else WEB_ROOT
TILESIM_ROOT = Path(os.environ.get("TILESIM_ROOT", "/mnt/d/tileSim"))
TILESIM_CLI = Path(os.environ.get("TILESIM_CLI", "/home/mapanwang/tilesim-build/TileSimCLI"))
DEPLOYMENT_MANIFEST = Path(
    os.environ.get("TILESIM_DEPLOYMENT_MANIFEST", "/mnt/d/tileSim-web/runtime/backend-current.json")
)
RUNS_ROOT = WEB_ROOT / "runs"

SCENARIOS = {
    "s1_des_example": {
        "label": "S1 -> S6 synthetic runtime example",
        "from": "S1",
        "to": "S6",
        "trace": TILESIM_ROOT / "docs/examples/s1_runtime_trace.json",
        "topology": TILESIM_ROOT / "docs/examples/modular_fabric_scenario.json",
    }
}
ALLOWED_FIDELITY_POLICIES = {"default", "des"}
ALLOWED_GPU_PARTICIPATION_MODES = {"gpu_free"}
MAX_CUSTOM_INPUT_BYTES = 1_000_000
MAX_REQUEST_BYTES = 2_100_000
runs: dict[str, dict] = {}
runs_lock = threading.Lock()

SCHEDULERS = {"fifo", "decode_priority", "fabric_backpressure_aware"}


def git_value(*args: str) -> str:
    try:
        completed = subprocess.run(
            ["git", "-C", str(TILESIM_ROOT), *args],
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    return completed.stdout.strip() if completed.returncode == 0 and completed.stdout.strip() else "unknown"


def deployment_manifest() -> dict:
    try:
        value = json.loads(DEPLOYMENT_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def backend_identity() -> dict:
    manifest = deployment_manifest()
    source_revision = git_value("rev-parse", "HEAD")
    build_revision = os.environ.get("TILESIM_BUILD_REVISION") or manifest.get("build_revision") or "unknown"
    versions_match = source_revision != "unknown" and build_revision != "unknown" and source_revision == build_revision
    branch = git_value("branch", "--show-current")
    return {
        "tilesim_root": str(TILESIM_ROOT),
        "tilesim_cli": str(TILESIM_CLI),
        "backend_revision": source_revision,
        "backend_branch": branch if branch != "unknown" else manifest.get("source_ref", "detached"),
        "source_revision": source_revision,
        "build_revision": build_revision,
        "versions_match": versions_match,
        "deployment_mode": manifest.get("deployment_mode", "unmanaged"),
        "deployment_ref": manifest.get("source_ref", "unknown"),
        "deployed_at": manifest.get("deployed_at", "unknown"),
        "deployment_manifest": str(DEPLOYMENT_MANIFEST),
    }


def runtime_capabilities() -> dict:
    unavailable = {
        "schema_version": "tilesim.runtime_capabilities.v1",
        "default_gpu_participation_mode": "gpu_free",
        "cycle_scope": "S6_hotspot_refinement_only",
        "dependencies": {
            "gpu_hardware": {
                "available": False,
                "version": "",
                "reason": "TileSimCLI_capability_discovery_unavailable",
            },
            "verilator_cycle": {
                "available": False,
                "version": "",
                "reason": "TileSimCLI_capability_discovery_unavailable",
            },
            "astra_sim": {
                "available": False,
                "version": "",
                "reason": "real_ASTRA_executable_and_Chakra_root_not_configured",
            },
        },
    }
    if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
        return unavailable
    try:
        completed = subprocess.run(
            [str(TILESIM_CLI), "capabilities"],
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )
        discovered = json.loads(completed.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return unavailable
    if completed.returncode != 0 or discovered.get("schema_version") != unavailable["schema_version"]:
        return unavailable
    discovered["run_surface"] = {
        "gpu_participation_modes": ["gpu_free"],
        "cycle_hotspot_request_available": False,
        "cycle_hotspot_request_reason":
            "The web bridge does not yet expose the explicit S6 hotspot window request schema.",
        "real_network_observation_channel": "S8_evidence_only",
    }
    return discovered


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json(handler: SimpleHTTPRequestHandler, status: HTTPStatus, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    add_cors_headers(handler)
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def add_cors_headers(handler: SimpleHTTPRequestHandler) -> None:
    """Allow only the local Vite development origin; production is same-origin."""
    origin = handler.headers.get("Origin", "")
    if origin in {"http://127.0.0.1:4173", "http://localhost:4173"}:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")


def write_json_file(handler: SimpleHTTPRequestHandler, path: Path) -> None:
    """Serve an allow-listed local JSON artifact for in-browser inspection."""
    try:
        body = path.read_bytes()
        json.loads(body)
    except (OSError, json.JSONDecodeError):
        return write_json(handler, HTTPStatus.NOT_FOUND, {"error": "JSON artifact was not found."})
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    add_cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def load_reports(run: dict) -> dict:
    reports = {}
    for kind, path in run["report_paths"].items():
        if path.is_file():
            reports[kind] = json.loads(path.read_text(encoding="utf-8"))
    return reports


def report_paths_for(run_dir: Path) -> dict[str, Path]:
    return {
        "run": run_dir / "run-result.json",
        "metrics": run_dir / "metrics.json",
        "validation": run_dir / "validation.json",
        "tail": run_dir / "tail-cause-chain.json",
        "execution_envelope": run_dir / "execution-envelope.json",
    }


def json_artifact_paths_for(run_dir: Path) -> dict[str, Path]:
    """Return only the JSON artifacts that the browser may preview."""
    return {
        "input-runtime-trace": run_dir / "input-runtime-trace.json",
        "input-topology": run_dir / "input-topology.json",
        "run-result": run_dir / "run-result.json",
        "metrics": run_dir / "metrics.json",
        "validation": run_dir / "validation.json",
        "tail-cause-chain": run_dir / "tail-cause-chain.json",
        "execution-envelope": run_dir / "execution-envelope.json",
        "metadata": run_dir / "run-metadata.json",
    }


def safe_run_directory(run_id: str) -> Path | None:
    if not run_id.startswith("run-") or Path(run_id).name != run_id:
        return None
    candidate = (RUNS_ROOT / run_id).resolve()
    return candidate if candidate.parent == RUNS_ROOT.resolve() and candidate.is_dir() else None


def read_json_file(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except (OSError, json.JSONDecodeError):
        return {}


def update_run_metadata(run_dir: Path, **updates: object) -> None:
    """Keep the durable run status aligned with the in-memory task state."""
    metadata_path = run_dir / "run-metadata.json"
    metadata = read_json_file(metadata_path)
    metadata.update(updates)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def run_digest(report_paths: dict[str, Path]) -> dict:
    run_report = read_json_file(report_paths["run"])
    metrics = read_json_file(report_paths["metrics"])
    validation = read_json_file(report_paths["validation"])
    return {
        "end_to_end_latency_us": run_report.get("summary", {}).get("end_to_end_latency_us"),
        "throughput_requests_per_second": metrics.get("summary", {}).get("throughput_requests_per_second"),
        "completed_request_count": metrics.get("summary", {}).get("completed_request_count"),
        "request_count": metrics.get("summary", {}).get("request_count"),
        "validation_lane": validation.get("validation_lane"),
        "evidence_tier": metrics.get("evidence_tier") or validation.get("evidence_tier"),
    }


def persisted_run(run_id: str) -> dict | None:
    run_dir = safe_run_directory(run_id)
    if run_dir is None:
        return None
    report_paths = report_paths_for(run_dir)
    metadata = read_json_file(run_dir / "run-metadata.json")
    if not metadata:
        metadata = {"run_id": run_id, "created_at": datetime.fromtimestamp(
            run_dir.stat().st_mtime, tz=timezone.utc
        ).isoformat(), "scenario_id": "unknown", "input_mode": "legacy"}
    metadata["run_id"] = run_id
    metadata["status"] = "completed" if report_paths["run"].is_file() else metadata.get("status", "incomplete")
    metadata["report_paths"] = report_paths
    metadata["digest"] = run_digest(report_paths)
    return metadata


def public_run(run: dict) -> dict:
    public = {key: value for key, value in run.items() if key not in {"report_paths", "stdout", "stderr"}}
    if "digest" not in public and "report_paths" in run:
        public["digest"] = run_digest(run["report_paths"])
    return public


def validate_run_name(value: object) -> str:
    if value is None:
        return "未命名实验"
    if not isinstance(value, str):
        raise ValueError("run_name must be a string.")
    name = value.strip()
    if not name:
        return "未命名实验"
    if len(name) > 80 or any(ord(char) < 32 for char in name):
        raise ValueError("run_name must contain 1 to 80 printable characters.")
    return name


def is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def bounded_number(value: object, label: str, minimum: float, maximum: float, integer: bool = False) -> int | float:
    if not is_number(value) or value < minimum or value > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}.")
    if integer and int(value) != value:
        raise ValueError(f"{label} must be an integer.")
    return int(value) if integer else float(value)


def validate_overrides(value: object) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("overrides must be an object.")
    allowed_sections = {"runtime", "workload", "fabric"}
    if unknown := set(value) - allowed_sections:
        raise ValueError(f"Unsupported override section: {', '.join(sorted(unknown))}.")

    clean: dict[str, dict] = {}
    runtime = value.get("runtime", {})
    if not isinstance(runtime, dict):
        raise ValueError("overrides.runtime must be an object.")
    if unknown := set(runtime) - {"batch_scheduler", "max_batch_size", "kv_capacity_tokens"}:
        raise ValueError(f"Unsupported runtime override: {', '.join(sorted(unknown))}.")
    if "batch_scheduler" in runtime:
        if runtime["batch_scheduler"] not in SCHEDULERS:
            raise ValueError("batch_scheduler is not allow-listed.")
        clean.setdefault("runtime", {})["batch_scheduler"] = runtime["batch_scheduler"]
    if "max_batch_size" in runtime:
        clean.setdefault("runtime", {})["max_batch_size"] = bounded_number(
            runtime["max_batch_size"], "max_batch_size", 1, 64, integer=True
        )
    if "kv_capacity_tokens" in runtime:
        clean.setdefault("runtime", {})["kv_capacity_tokens"] = bounded_number(
            runtime["kv_capacity_tokens"], "kv_capacity_tokens", 256, 1_000_000, integer=True
        )

    workload = value.get("workload", {})
    if not isinstance(workload, dict):
        raise ValueError("overrides.workload must be an object.")
    if unknown := set(workload) - {"message_size_multiplier"}:
        raise ValueError(f"Unsupported workload override: {', '.join(sorted(unknown))}.")
    if "message_size_multiplier" in workload:
        clean.setdefault("workload", {})["message_size_multiplier"] = bounded_number(
            workload["message_size_multiplier"], "message_size_multiplier", 0.25, 8.0
        )

    fabric = value.get("fabric", {})
    if not isinstance(fabric, dict):
        raise ValueError("overrides.fabric must be an object.")
    fabric_bounds = {
        "scale_up_bandwidth_gbps": (25, 2_000),
        "scale_up_latency_us": (0.05, 100),
        "scale_out_bandwidth_gbps": (10, 2_000),
        "scale_out_latency_us": (0.1, 500),
    }
    if unknown := set(fabric) - set(fabric_bounds):
        raise ValueError(f"Unsupported Fabric override: {', '.join(sorted(unknown))}.")
    for key, (minimum, maximum) in fabric_bounds.items():
        if key in fabric:
            clean.setdefault("fabric", {})[key] = bounded_number(fabric[key], key, minimum, maximum)
    return clean


def validate_custom_inputs(value: object) -> dict:
    """Accept only a bounded pair of JSON documents for the fixed hosted S1->S6 path."""
    if not isinstance(value, dict) or set(value) != {"runtime_trace", "topology"}:
        raise ValueError("custom_inputs must contain runtime_trace and topology objects.")
    for name, document in value.items():
        if not isinstance(document, dict):
            raise ValueError(f"custom_inputs.{name} must be a JSON object.")
        if len(json.dumps(document, ensure_ascii=False).encode("utf-8")) > MAX_CUSTOM_INPUT_BYTES:
            raise ValueError(f"custom_inputs.{name} exceeds the 1 MB limit.")

    trace = value["runtime_trace"]
    if not isinstance(trace.get("policy"), dict) or not isinstance(trace.get("requests"), list):
        raise ValueError("runtime_trace requires policy and requests fields.")
    if not 1 <= len(trace["requests"]) <= 1_024:
        raise ValueError("runtime_trace.requests must contain between 1 and 1024 requests.")
    if not all(isinstance(request, dict) for request in trace["requests"]):
        raise ValueError("runtime_trace.requests must contain JSON objects.")

    topology = value["topology"]
    topology_root = topology.get("topology")
    if not isinstance(topology_root, dict):
        raise ValueError("topology requires a topology object.")
    for key, maximum in {"devices": 1_024, "module_bindings": 64, "domains": 64}.items():
        values = topology_root.get(key)
        if not isinstance(values, list) or len(values) > maximum:
            raise ValueError(f"topology.topology.{key} must be a list with at most {maximum} entries.")
    return {"runtime_trace": trace, "topology": topology}


def materialize_inputs(run_dir: Path, scenario: dict, overrides: dict) -> dict:
    """Create a run-local, schema-preserving input pair from an allow-listed base scenario."""
    trace = json.loads(scenario["trace"].read_text(encoding="utf-8"))
    topology = json.loads(scenario["topology"].read_text(encoding="utf-8"))

    trace.setdefault("policy", {}).update(overrides.get("runtime", {}))
    multiplier = overrides.get("workload", {}).get("message_size_multiplier", 1.0)
    if multiplier != 1.0:
        for request in trace.get("requests", []):
            request["message_size_bytes"] = max(1, round(request["message_size_bytes"] * multiplier))

    fabric = overrides.get("fabric", {})
    for binding in topology.get("topology", {}).get("module_bindings", []):
        params = binding.setdefault("override_params", {})
        if binding.get("module_kind") == "scale_up":
            if "scale_up_bandwidth_gbps" in fabric:
                params["bandwidth_gbps"] = fabric["scale_up_bandwidth_gbps"]
            if "scale_up_latency_us" in fabric:
                params["latency_us"] = fabric["scale_up_latency_us"]
        if binding.get("module_kind") == "scale_out":
            if "scale_out_bandwidth_gbps" in fabric:
                params["bandwidth_gbps"] = fabric["scale_out_bandwidth_gbps"]
            if "scale_out_latency_us" in fabric:
                params["latency_us"] = fabric["scale_out_latency_us"]

    trace_path = run_dir / "input-runtime-trace.json"
    topology_path = run_dir / "input-topology.json"
    trace_path.write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding="utf-8")
    topology_path.write_text(json.dumps(topology, ensure_ascii=False, indent=2), encoding="utf-8")
    return {**scenario, "trace": trace_path, "topology": topology_path}


def materialize_custom_inputs(run_dir: Path, scenario: dict, inputs: dict) -> dict:
    trace_path = run_dir / "input-runtime-trace.json"
    topology_path = run_dir / "input-topology.json"
    trace_path.write_text(json.dumps(inputs["runtime_trace"], ensure_ascii=False, indent=2), encoding="utf-8")
    topology_path.write_text(json.dumps(inputs["topology"], ensure_ascii=False, indent=2), encoding="utf-8")
    return {**scenario, "trace": trace_path, "topology": topology_path}


def execute_run(run_id: str, scenario: dict, fidelity_policy: str) -> None:
    run_dir = RUNS_ROOT / run_id
    report_paths = report_paths_for(run_dir)
    command = [
        str(TILESIM_CLI), "run", "--mode", "dev", "--from", scenario["from"], "--to", scenario["to"],
        "--trace", str(scenario["trace"]), "--topology", str(scenario["topology"]),
        "--fidelity-policy", fidelity_policy, "--out", str(report_paths["run"]),
        "--metrics-report-out", str(report_paths["metrics"]),
        "--validation-report-out", str(report_paths["validation"]),
        "--tail-report-out", str(report_paths["tail"]),
        "--execution-envelope-out", str(report_paths["execution_envelope"]),
    ]
    try:
        completed = subprocess.run(
            command, cwd=TILESIM_ROOT, text=True, capture_output=True, timeout=180, check=False
        )
        if completed.returncode == 0 and completed.stdout.strip():
            try:
                primary_report = json.loads(completed.stdout)
                report_paths["run"].write_text(
                    json.dumps(primary_report, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            except json.JSONDecodeError:
                # Artifact reports are still valid when a future CLI emits non-JSON stdout.
                pass
        with runs_lock:
            run = runs[run_id]
            run["finished_at"] = now()
            run["exit_code"] = completed.returncode
            run["stdout"] = completed.stdout[-4000:]
            run["stderr"] = completed.stderr[-4000:]
            run["report_paths"] = report_paths
            if completed.returncode == 0:
                run["status"] = "completed"
            else:
                run["status"] = "failed"
                run["error"] = "TileSimCLI returned a non-zero exit code."
            metadata_updates = {
                "status": run["status"],
                "finished_at": run["finished_at"],
                "exit_code": run["exit_code"],
                "error": run.get("error", ""),
            }
        update_run_metadata(run_dir, **metadata_updates)
    except (OSError, subprocess.TimeoutExpired) as error:
        with runs_lock:
            run = runs[run_id]
            run["status"] = "failed"
            run["finished_at"] = now()
            run["error"] = str(error)
            failed_at = run["finished_at"]
            failure = run["error"]
        try:
            update_run_metadata(run_dir, status="failed", finished_at=failed_at, error=failure)
        except OSError:
            pass


class BridgeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print("[TileSim Web] " + format % args)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
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
                "input_modes": ["controls", "json"],
                "gpu_participation_modes": sorted(ALLOWED_GPU_PARTICIPATION_MODES),
            })
        if path == "/api/capabilities":
            return write_json(self, HTTPStatus.OK, runtime_capabilities())
        parts = path.strip("/").split("/")
        if path == "/api/runs":
            return self.list_runs()
        if len(parts) == 3 and parts[:2] == ["api", "templates"]:
            scenario = SCENARIOS.get(parts[2])
            if scenario is None:
                return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Template scenario was not found."})
            return write_json(self, HTTPStatus.OK, {
                "scenario_id": parts[2],
                "runtime_trace": json.loads(scenario["trace"].read_text(encoding="utf-8")),
                "topology": json.loads(scenario["topology"].read_text(encoding="utf-8")),
            })
        if len(parts) == 3 and parts[:2] == ["api", "runs"]:
            return self.get_run(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "reports":
            return self.get_reports(parts[2])
        if len(parts) == 5 and parts[:2] == ["api", "runs"] and parts[3] == "files":
            return self.get_json_artifact(parts[2], parts[4])
        return super().do_GET()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        add_cors_headers(self)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "name":
            return self.rename_run(parts[2])
        if path != "/api/runs":
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Unknown endpoint."})
        if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
            return write_json(self, HTTPStatus.SERVICE_UNAVAILABLE, {"error": "TileSimCLI is not available to the bridge."})
        identity = backend_identity()
        if not identity["versions_match"]:
            return write_json(self, HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "Backend source and TileSimCLI build revisions do not match; run scripts/update-backend.ps1."
            })
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            scenario_id = request.get("scenario_id")
            fidelity_policy = request.get("fidelity_policy", "des")
            gpu_participation_mode = request.get("gpu_participation_mode", "gpu_free")
            run_name = validate_run_name(request.get("run_name"))
            if scenario_id not in SCENARIOS:
                raise ValueError("Scenario is not allow-listed.")
            if fidelity_policy not in ALLOWED_FIDELITY_POLICIES:
                raise ValueError("Fidelity policy is not allow-listed.")
            if gpu_participation_mode not in ALLOWED_GPU_PARTICIPATION_MODES:
                raise ValueError(
                    "GPU participation mode is unavailable on this controlled run surface; "
                    "gpu_free is required."
                )
            has_overrides = "overrides" in request
            has_custom_inputs = "custom_inputs" in request
            if has_overrides and has_custom_inputs:
                raise ValueError("Use either overrides or custom_inputs, not both.")
            overrides = validate_overrides(request.get("overrides")) if has_overrides else {}
            custom_inputs = validate_custom_inputs(request["custom_inputs"]) if has_custom_inputs else None
        except (ValueError, json.JSONDecodeError) as error:
            return write_json(self, HTTPStatus.BAD_REQUEST, {"error": str(error)})

        run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
        run_dir = RUNS_ROOT / run_id
        run_dir.mkdir(parents=True, exist_ok=False)
        try:
            input_mode = "json" if custom_inputs is not None else "controls"
            resolved_scenario = (
                materialize_custom_inputs(run_dir, SCENARIOS[scenario_id], custom_inputs)
                if custom_inputs is not None
                else materialize_inputs(run_dir, SCENARIOS[scenario_id], overrides)
            )
        except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
            return write_json(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Could not prepare run inputs: {error}"})
        metadata = {
            "run_id": run_id, "status": "running", "created_at": now(), "scenario_id": scenario_id,
            "run_name": run_name, "fidelity_policy": fidelity_policy,
            "gpu_participation_mode": gpu_participation_mode,
            "input_mode": input_mode, "overrides": overrides,
            "input_files": {"runtime_trace": "input-runtime-trace.json", "topology": "input-topology.json"},
        }
        try:
            (run_dir / "run-metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError as error:
            return write_json(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Could not save run metadata: {error}"})
        with runs_lock:
            runs[run_id] = metadata.copy()
        threading.Thread(target=execute_run, args=(run_id, resolved_scenario, fidelity_policy), daemon=True).start()
        return write_json(self, HTTPStatus.ACCEPTED, {
            "run_id": run_id, "run_name": run_name, "status": "running", "input_mode": input_mode, "overrides": overrides,
            "input_files": {"runtime_trace": "input-runtime-trace.json", "topology": "input-topology.json"},
        })

    def get_run(self, run_id: str) -> None:
        with runs_lock:
            run = runs.get(run_id)
        if run is None:
            run = persisted_run(run_id)
        if run is None:
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Run was not found."})
        return write_json(self, HTTPStatus.OK, public_run(run))

    def rename_run(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Run was not found."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            run_name = validate_run_name(request.get("run_name"))
        except (ValueError, json.JSONDecodeError) as error:
            return write_json(self, HTTPStatus.BAD_REQUEST, {"error": str(error)})

        metadata = read_json_file(run_dir / "run-metadata.json")
        if not metadata:
            stored = persisted_run(run_id)
            metadata = {key: value for key, value in (stored or {}).items()
                        if key not in {"report_paths", "digest"}}
        metadata["run_id"] = run_id
        metadata["run_name"] = run_name
        try:
            (run_dir / "run-metadata.json").write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except OSError as error:
            return write_json(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Could not save run name: {error}"})
        with runs_lock:
            if run_id in runs:
                runs[run_id]["run_name"] = run_name
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "run_name": run_name})

    def get_reports(self, run_id: str) -> None:
        with runs_lock:
            run = runs.get(run_id)
        if run is None:
            run = persisted_run(run_id)
        if run is None:
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Run was not found."})
        if run["status"] != "completed":
            return write_json(self, HTTPStatus.CONFLICT, {"error": "Run has not completed."})
        reports = load_reports(run)
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "reports": reports})

    def get_json_artifact(self, run_id: str, artifact: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "Run was not found."})
        path = json_artifact_paths_for(run_dir).get(artifact)
        if path is None:
            return write_json(self, HTTPStatus.NOT_FOUND, {"error": "JSON artifact was not found."})
        return write_json_file(self, path)

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
    server = ThreadingHTTPServer(("127.0.0.1", 5173), BridgeHandler)
    print(f"TileSim Web bridge listening at http://127.0.0.1:5173 (UI: {STATIC_ROOT}, CLI: {TILESIM_CLI})")
    server.serve_forever()


if __name__ == "__main__":
    main()
