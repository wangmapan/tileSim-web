"""Run input materialization and TileSimCLI execution orchestration."""

from __future__ import annotations

import hashlib
import json
import math
import os
import subprocess
import tempfile
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from services.run_intake import RUN_INTAKE_ISSUE_FIELDS


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


# ---------------------------------------------------------------------------
# Read-only Run Intake v2 lowering call (WP-2C-02, service layer only)
# ---------------------------------------------------------------------------

RUN_INTAKE_CLI_OPERATION = "validate-run-intake"
RUN_INTAKE_CLI_ALIAS_OPERATION = "run-intake-preview"
RUN_INTAKE_CLI_TIMEOUT_SECONDS = 45
# The published CLI contract defines exactly two judged exit codes: 0 (accepted) and
# 1 (blocked, with the issues JSON on stdout).  Anything else is reported verbatim
# instead of being guessed.
RUN_INTAKE_CLI_JUDGED_EXIT_CODES = (0, 1)
RUN_INTAKE_CLI_STAGING_PREFIX = "tilesim-run-intake-"
RUN_INTAKE_CLI_STAGED_FILE_NAME = "run-intake.json"

RUN_INTAKE_CLI_RESULT_FIELDS = (
    "operation",
    "exit_code",
    "status",
    "issues",
    "representable",
    "non_representable_reasons",
)

RUN_INTAKE_CLI_INPUT_CODE = "run_intake_cli_input_not_serializable"
RUN_INTAKE_CLI_UNAVAILABLE_CODE = "run_intake_cli_unavailable"
RUN_INTAKE_CLI_EXECUTION_ERROR_CODE = "run_intake_cli_execution_error"
RUN_INTAKE_CLI_TIMEOUT_CODE = "run_intake_cli_timeout"
RUN_INTAKE_CLI_INVALID_JSON_CODE = "run_intake_cli_invalid_json"
RUN_INTAKE_CLI_UNEXPECTED_EXIT_CODE = "run_intake_cli_unexpected_exit"
RUN_INTAKE_CLI_ISSUE_NOT_REPRESENTABLE_CODE = "run_intake_cli_issue_not_representable"
# Same semantics as the Week 7 endpoint's ``week7_capacity_reached``: one shared Bridge
# operation slot is already occupied and the caller must not be parked on it.
RUN_INTAKE_CAPACITY_REACHED_CODE = "run_intake_capacity_reached"


@dataclass
class RunIntakeCliError(RuntimeError):
    """Three-part failure (``code`` / ``message`` / ``retryable``), mirroring Week 7."""

    code: str
    message: str
    retryable: bool = False

    def __str__(self) -> str:
        return self.message


def _reject_nonfinite(value: str) -> None:
    raise ValueError(f"non-finite JSON number: {value}")


def _reject_nonfinite_document(value: object, path: str = "$") -> None:
    """Refuse non-finite numbers and non-string keys before anything is staged."""
    if isinstance(value, float) and not math.isfinite(value):
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_INPUT_CODE,
            f"The Run Intake document carries a non-finite number at {path}; the Bridge "
            "stages a lossless copy and never writes NaN or Infinity.",
            retryable=False,
        )
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise RunIntakeCliError(
                    RUN_INTAKE_CLI_INPUT_CODE,
                    f"The Run Intake document has a non-string object key at {path}; "
                    "staging a faithful copy must not rewrite keys.",
                    retryable=False,
                )
            _reject_nonfinite_document(item, f"{path}/{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _reject_nonfinite_document(item, f"{path}/{index}")


def _faithful_json_body(document: object) -> str:
    """Return the caller's document as lossless JSON, or fail closed.

    The staged copy must be the same JSON the caller submitted: no key is added,
    renamed or dropped, every object key stays a string, and integers keep their exact
    decimal value because :mod:`json` writes a Python ``int`` without a float
    round-trip (``18446744073709551615`` is never emitted as ``1.8446744073709552e+19``).
    A non-finite number is refused instead of being written as the non-standard ``NaN``
    / ``Infinity`` tokens, mirroring ``week7._reject_nonfinite``.
    """
    _reject_nonfinite_document(document)
    try:
        return json.dumps(document, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_INPUT_CODE,
            f"The Run Intake document cannot be staged as lossless JSON: {error}",
            retryable=False,
        ) from error


def _read_run_intake_stdout(
    payload: object, exit_code: int
) -> tuple[str, list, list[str]]:
    """Split the CLI payload into verbatim ``status`` / ``issues`` plus unrepresentable reasons.

    The issues array is read verbatim: key names, values and ordering are never
    rewritten, and no issue field is ever added.  A payload that does not expose a
    string ``status`` and an array of issue objects cannot be represented at all and
    fails closed with ``run_intake_cli_issue_not_representable``.  An assessable array
    whose members are missing Run Intake issue fields is reported through the reasons
    list instead, so the raw payload still reaches the caller unchanged.
    """
    if not isinstance(payload, dict):
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_ISSUE_NOT_REPRESENTABLE_CODE,
            f"TileSimCLI exited {exit_code} with JSON that is not the published "
            f"{RUN_INTAKE_CLI_OPERATION} envelope object; the Bridge reports that instead "
            "of guessing an issue shape.",
            retryable=False,
        )
    status = payload.get("status")
    issues = payload.get("issues")
    assessable = isinstance(status, str) and isinstance(issues, list)
    if assessable:
        assessable = all(isinstance(issue, dict) for issue in issues)
    if not assessable:
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_ISSUE_NOT_REPRESENTABLE_CODE,
            f"TileSimCLI exited {exit_code} with JSON that does not expose a string status "
            "and an array of issue objects; the Bridge reports that instead of rewriting "
            "the payload.",
            retryable=False,
        )
    reasons: list[str] = []
    for index, issue in enumerate(issues):
        missing = [name for name in RUN_INTAKE_ISSUE_FIELDS if name not in issue]
        if missing:
            reasons.append(f"issues[{index}] is missing {', '.join(missing)}")
        elif not isinstance(issue["blocking"], bool):
            reasons.append(f"issues[{index}].blocking is not boolean")
    return status, issues, reasons


def run_intake_cli_validation(
    document: object,
    *,
    slot: threading.Lock,
    tilesim_cli: Path,
    tilesim_root: Path,
    process_runner: ProcessRunner = subprocess.run,
) -> dict:
    """Validate one Run Intake v2 document through the read-only TileSimCLI entry point.

    Read-only: this call creates no run, writes no ``runs/`` entry, reserves no run id,
    imports no run repository and performs no persistence of any kind.  The only file it
    writes is a short-lived staged copy of the caller's document inside a Bridge-owned
    :mod:`tempfile` directory, which is removed before the call returns.

    The command line is a fixed allow-list
    (``[tilesim_cli, validate-run-intake, --run-intake, <staged>]``): no argv, path or
    argument of any kind travels from the request into the command, and the staged path
    is always chosen by the Bridge.  The caller injects the Bridge single-operation slot
    (``server.week7_operation_lock`` once an endpoint is wired in a later work package),
    the function never creates a lock of its own, and a slot that is already held is
    reported as ``run_intake_capacity_reached`` rather than waited on.

    The returned mapping is **not** a published contract type, and it must not be
    mistaken for one: its members are ``operation`` / ``exit_code`` / ``status`` /
    ``issues`` / ``representable`` / ``non_representable_reasons``.  ``status`` and
    ``issues`` are the CLI stdout read verbatim.  ``representable`` is True exactly when
    every issue carries ``code`` / ``message`` / ``field_path`` / ``blocking`` /
    ``safe_next_action`` and ``blocking`` is boolean, i.e. exactly when the issues could
    legally fill the published ``backend_issues`` array; whenever it is False those
    issues must not enter any contract field.  The call never fabricates ``message`` or
    ``safe_next_action`` and never reverse-looks-up copy from an issue code.

    A blocked judgement is a judged outcome, not a transport failure: ``exit_code`` 1
    with parseable stdout returns this typed result.  An empty ``issues`` array is never
    an "all clear" - it is only readable together with ``status`` and ``exit_code``.
    """
    body = _faithful_json_body(document)

    if not (tilesim_cli.is_file() and os.access(tilesim_cli, os.X_OK)):
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_UNAVAILABLE_CODE,
            "TileSimCLI is not available to the bridge, so Run Intake v2 was not validated. "
            "This is not an accepted or an empty result.",
            retryable=True,
        )

    if not slot.acquire(blocking=False):
        raise RunIntakeCliError(
            RUN_INTAKE_CAPACITY_REACHED_CODE,
            "The shared Bridge operation slot is already occupied.",
            retryable=True,
        )
    try:
        with tempfile.TemporaryDirectory(prefix=RUN_INTAKE_CLI_STAGING_PREFIX) as staging:
            staged = Path(staging) / RUN_INTAKE_CLI_STAGED_FILE_NAME
            try:
                staged.write_text(body, encoding="utf-8")
                completed = process_runner(
                    [
                        str(tilesim_cli),
                        RUN_INTAKE_CLI_OPERATION,
                        "--run-intake",
                        str(staged),
                    ],
                    cwd=tilesim_root,
                    text=True,
                    capture_output=True,
                    timeout=RUN_INTAKE_CLI_TIMEOUT_SECONDS,
                    check=False,
                )
            except subprocess.TimeoutExpired as error:
                raise RunIntakeCliError(
                    RUN_INTAKE_CLI_TIMEOUT_CODE,
                    "The Run Intake validation exceeded its "
                    f"{RUN_INTAKE_CLI_TIMEOUT_SECONDS} second limit.",
                    retryable=True,
                ) from error
            except OSError as error:
                raise RunIntakeCliError(
                    RUN_INTAKE_CLI_EXECUTION_ERROR_CODE,
                    f"The Run Intake validation could not be executed: {error}",
                    retryable=True,
                ) from error
    finally:
        slot.release()

    exit_code = completed.returncode
    if exit_code not in RUN_INTAKE_CLI_JUDGED_EXIT_CODES:
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_UNEXPECTED_EXIT_CODE,
            f"TileSimCLI returned exit code {exit_code} for {RUN_INTAKE_CLI_OPERATION}; the "
            "published CLI contract defines only 0 (accepted) and 1 (blocked), so the code "
            "is reported as-is instead of being interpreted.",
            retryable=False,
        )
    try:
        payload = json.loads(completed.stdout, parse_constant=_reject_nonfinite)
    except (json.JSONDecodeError, ValueError) as error:
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_INVALID_JSON_CODE,
            "TileSimCLI returned stdout that is not valid finite JSON, so no Run Intake "
            "judgement can be read from it.",
            retryable=False,
        ) from error
    try:
        _reject_nonfinite_document(payload)
    except RunIntakeCliError as error:
        raise RunIntakeCliError(
            RUN_INTAKE_CLI_INVALID_JSON_CODE, error.message, retryable=False
        ) from error

    status, issues, reasons = _read_run_intake_stdout(payload, exit_code)
    return {
        "operation": RUN_INTAKE_CLI_OPERATION,
        "exit_code": exit_code,
        "status": status,
        "issues": issues,
        "representable": not reasons,
        "non_representable_reasons": reasons,
    }
