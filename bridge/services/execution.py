"""Run input materialization and TileSimCLI execution orchestration."""

from __future__ import annotations

import hashlib
import json
import subprocess
import threading
from collections.abc import Callable
from pathlib import Path


ProcessRunner = Callable[..., subprocess.CompletedProcess[str]]

TOPOLOGY_SCHEMA_IDENTITY = "tilesim.s6_topology_input.v1"
TRACE_SOURCE_MODES = {"real_trace", "synthetic_trace", "compatibility_harness_trace"}


def bind_topology_contract(topology: dict, run_id: str, *, default_source_mode: str) -> dict:
    """Bind a run-local topology artifact without inferring domain joins in the browser."""
    provenance = topology.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {
            "source_mode": default_source_mode,
            "calibration_level": "uncalibrated",
            "allowed_claim_scope": "exploratory",
        }
    source_mode = provenance.get("source_mode")
    if source_mode not in TRACE_SOURCE_MODES:
        raise ValueError("topology provenance source_mode is unsupported")
    if not isinstance(provenance.get("calibration_level"), str) or not provenance[
        "calibration_level"
    ]:
        raise ValueError("topology provenance calibration_level is required")
    if not isinstance(provenance.get("allowed_claim_scope"), str) or not provenance[
        "allowed_claim_scope"
    ]:
        raise ValueError("topology provenance allowed_claim_scope is required")

    topology["schema_version"] = TOPOLOGY_SCHEMA_IDENTITY
    topology["run_id"] = run_id
    topology["provenance"] = dict(provenance)
    domains = topology.get("topology", {}).get("domains", [])
    seen: set[str] = set()
    for index, domain in enumerate(domains):
        domain_id = domain.get("domain_id")
        if not isinstance(domain_id, str) or not domain_id or domain_id in seen:
            raise ValueError("topology domain_id values must be nonempty and unique")
        seen.add(domain_id)
        domain["domain_kind"] = domain.get("domain_type")
        domain["subject"] = {
            "kind": "fabric_domain",
            "id": domain_id,
            "fabric_domain_id": domain_id,
        }
        domain["json_pointer"] = f"/topology/domains/{index}"
        domain["provenance"] = dict(provenance)
    return topology


def materialize_inputs(run_dir: Path, scenario: dict, overrides: dict) -> dict:
    """Create a run-local, schema-preserving input pair from an allow-listed scenario."""
    trace = json.loads(scenario["trace"].read_text(encoding="utf-8"))
    topology = json.loads(scenario["topology"].read_text(encoding="utf-8"))
    bind_topology_contract(topology, run_dir.name, default_source_mode="synthetic_trace")

    trace.setdefault("policy", {}).update(overrides.get("runtime", {}))
    multiplier = overrides.get("workload", {}).get("message_size_multiplier", 1.0)
    if multiplier != 1.0:
        for request in trace.get("requests", []):
            request["message_size_bytes"] = max(
                1,
                round(request["message_size_bytes"] * multiplier),
            )

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
    trace_path.write_text(
        json.dumps(inputs["runtime_trace"], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    topology = json.loads(json.dumps(inputs["topology"], ensure_ascii=False))
    bind_topology_contract(topology, run_dir.name, default_source_mode="synthetic_trace")
    topology_path.write_text(
        json.dumps(topology, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {**scenario, "trace": trace_path, "topology": topology_path}


def materialize_trace_package_inputs(
    run_dir: Path,
    scenario: dict,
    *,
    manifest_path: Path,
    manifest_sha256: str,
    source_mode: str,
) -> dict:
    """Materialize only the allow-listed topology; the CLI owns Trace-package intake."""
    topology = json.loads(scenario["topology"].read_text(encoding="utf-8"))
    bind_topology_contract(topology, run_dir.name, default_source_mode=source_mode)
    topology_path = run_dir / "input-topology.json"
    topology_path.write_text(
        json.dumps(topology, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {
        **scenario,
        "topology": topology_path,
        "trace_package": manifest_path,
        "trace_package_manifest_sha256": manifest_sha256,
    }


def trace_package_manifest_matches(scenario: dict) -> bool:
    expected = scenario.get("trace_package_manifest_sha256")
    manifest = scenario.get("trace_package")
    if not isinstance(expected, str):
        return True
    if not isinstance(manifest, Path):
        return False
    try:
        if manifest.is_symlink():
            return False
        body = manifest.read_bytes()
    except OSError:
        return False
    return "sha256:" + hashlib.sha256(body).hexdigest() == expected


def materialize_design_space_candidates(run_dir: Path, manifest: dict | None) -> Path | None:
    if manifest is None:
        return None
    path = run_dir / "input-design-space-candidates.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def execute_run(
    run_id: str,
    scenario: dict,
    fidelity_policy: str,
    *,
    runs_root: Path,
    tilesim_cli: Path,
    tilesim_root: Path,
    runs: dict[str, dict],
    runs_lock: threading.Lock,
    report_paths_for: Callable[[Path], dict[str, Path]],
    is_valid_json_file: Callable[[Path], bool],
    update_run_metadata: Callable[..., None],
    now: Callable[[], str],
    process_runner: ProcessRunner = subprocess.run,
) -> None:
    """Execute one allow-listed run and durably publish its terminal state."""
    run_dir = runs_root / run_id
    report_paths = report_paths_for(run_dir)
    command = [
        str(tilesim_cli),
        "run",
        "--mode",
        "dev",
    ]
    if scenario.get("trace_package") is not None:
        command.extend(["--trace-package", str(scenario["trace_package"])])
    else:
        command.extend(["--from", scenario["from"], "--trace", str(scenario["trace"])])
    command.extend([
        "--to",
        scenario["to"],
        "--topology",
        str(scenario["topology"]),
        "--fidelity-policy",
        fidelity_policy,
        "--run-id",
        run_id,
        "--out",
        str(report_paths["run"]),
        "--metrics-report-out",
        str(report_paths["metrics"]),
        "--validation-report-out",
        str(report_paths["validation"]),
        "--tail-report-out",
        str(report_paths["tail"]),
        "--design-space-report-out",
        str(report_paths["design_space"]),
        "--execution-envelope-out",
        str(report_paths["execution_envelope"]),
    ])
    if fidelity_policy == "des":
        command.extend(
            [
                "--run-bound-des-evidence-out",
                str(report_paths["run_bound_des_evidence"]),
            ]
        )
    if scenario.get("design_space_candidates") is not None:
        command.extend(["--design-space-candidates", str(scenario["design_space_candidates"])])

    if not trace_package_manifest_matches(scenario):
        failure = "Trace-package manifest changed after inspection; execution was rejected."
        failed_at = now()
        with runs_lock:
            run = runs[run_id]
            run["status"] = "failed"
            run["finished_at"] = failed_at
            run["error"] = failure
            run["failure_code"] = "trace_package_changed"
        try:
            update_run_metadata(
                run_dir,
                status="failed",
                finished_at=failed_at,
                error=failure,
                failure_code="trace_package_changed",
            )
        except OSError:
            pass
        return

    try:
        completed = process_runner(
            command,
            cwd=tilesim_root,
            text=True,
            capture_output=True,
            timeout=180,
            check=False,
        )
        if completed.returncode == 0 and completed.stdout.strip():
            try:
                primary_report = json.loads(completed.stdout)
                report_paths["run"].write_text(
                    json.dumps(primary_report, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
            except json.JSONDecodeError:
                # Artifact reports remain valid if a future CLI emits non-JSON stdout.
                pass
        trace_package_changed = not trace_package_manifest_matches(scenario)
        with runs_lock:
            run = runs[run_id]
            run["finished_at"] = now()
            run["exit_code"] = completed.returncode
            run["stdout"] = completed.stdout[-4000:]
            run["stderr"] = completed.stderr[-4000:]
            run["report_paths"] = report_paths
            if trace_package_changed:
                run["status"] = "failed"
                run["error"] = "Trace-package manifest changed during execution."
                run["failure_code"] = "trace_package_changed"
            elif completed.returncode == 0 and is_valid_json_file(report_paths["run"]):
                run["status"] = "completed"
            elif completed.returncode == 0:
                run["status"] = "failed"
                run["error"] = "TileSimCLI did not produce a valid primary run artifact."
                run["failure_code"] = "cli_missing_primary_artifact"
            else:
                run["status"] = "failed"
                run["error"] = "TileSimCLI returned a non-zero exit code."
                run["failure_code"] = "cli_nonzero_exit"
            metadata_updates = {
                "status": run["status"],
                "finished_at": run["finished_at"],
                "exit_code": run["exit_code"],
                "error": run.get("error", ""),
                "failure_code": run.get("failure_code", ""),
            }
        update_run_metadata(run_dir, **metadata_updates)
    except (OSError, subprocess.TimeoutExpired) as error:
        with runs_lock:
            run = runs[run_id]
            run["status"] = "failed"
            run["finished_at"] = now()
            run["error"] = str(error)
            run["failure_code"] = (
                "cli_timeout"
                if isinstance(error, subprocess.TimeoutExpired)
                else "cli_execution_error"
            )
            failed_at = run["finished_at"]
            failure = run["error"]
            failure_code = run["failure_code"]
        try:
            update_run_metadata(
                run_dir,
                status="failed",
                finished_at=failed_at,
                error=failure,
                failure_code=failure_code,
            )
        except OSError:
            pass


def start_run_execution(
    run_id: str,
    scenario: dict,
    fidelity_policy: str,
    *,
    execute: Callable[[str, dict, str], None],
) -> None:
    threading.Thread(
        target=execute,
        args=(run_id, scenario, fidelity_policy),
        daemon=True,
    ).start()
