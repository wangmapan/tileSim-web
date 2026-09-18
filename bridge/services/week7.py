"""Allow-listed Week 7 evidence workflows.

The browser never supplies paths or CLI arguments. Every operation is bound to
one checked-in fixture or a read-only report command in the deployed TileSim
worktree.
"""

from __future__ import annotations

import json
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass
class Week7ExecutionError(RuntimeError):
    code: str
    message: str
    retryable: bool = False

    def __str__(self) -> str:
        return self.message


OPERATIONS = {
    "evidence_map": {
        "arguments": ["evidence-map"],
        "schema_version": "tilesim.s9.report_field_evidence_map.v1alpha1",
        "schema_file": "week7-evidence-map.schema.json",
    },
    "calibration_example": {
        "arguments": [
            "calibrate",
            "--calibration-assets",
            "docs/examples/validation/week7/offline_calibration_assets_v1.json",
        ],
        "schema_version": "tilesim.calibration.workflow_report.v1alpha1",
        "schema_file": "week7-calibration.schema.json",
    },
    "orchestration_example": {
        "arguments": [
            "orchestrate",
            "--intent",
            "docs/examples/agent/week7_synthetic_s1_s6_intent.json",
        ],
        "schema_version": "tilesim.agent.orchestration_report.v1alpha1",
        "schema_file": "week7-orchestration.schema.json",
    },
}

SCHEMA_ROOT = Path(__file__).resolve().parents[1] / "contracts" / "schemas"
RESPONSE_SCHEMAS = {
    operation_id: json.loads((SCHEMA_ROOT / operation["schema_file"]).read_text(encoding="utf-8"))
    for operation_id, operation in OPERATIONS.items()
}


def _reject_nonfinite(value: str) -> None:
    raise ValueError(f"non-finite JSON number: {value}")


def _matches_schema_type(value: object, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and (not isinstance(value, float) or math.isfinite(value))
        )
    raise RuntimeError(f"Unsupported Week 7 response schema type: {expected}")


def _validate_response_value(value: object, schema: dict, path: str = "$") -> None:
    if "const" in schema and value != schema["const"]:
        raise ValueError(f"{path} does not match the registered constant")
    expected_type = schema.get("type")
    if expected_type is not None and not _matches_schema_type(value, expected_type):
        raise ValueError(f"{path} must be {expected_type}")
    if "minimum" in schema and value < schema["minimum"]:
        raise ValueError(f"{path} is below the registered minimum")
    if isinstance(value, dict):
        required = schema.get("required", [])
        for field in required:
            if field not in value:
                raise ValueError(f"{path}.{field} is required")
        properties = schema.get("properties", {})
        for field, field_schema in properties.items():
            if field in value:
                _validate_response_value(value[field], field_schema, f"{path}.{field}")
        additional = schema.get("additionalProperties", True)
        for field in set(value) - set(properties):
            if additional is False:
                raise ValueError(f"{path}.{field} is not registered")
            if isinstance(additional, dict):
                _validate_response_value(value[field], additional, f"{path}.{field}")
    if isinstance(value, list) and isinstance(schema.get("items"), dict):
        for index, item in enumerate(value):
            _validate_response_value(item, schema["items"], f"{path}[{index}]")


def _validate_finite_numbers(value: object, path: str = "$") -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError(f"{path} must be finite")
    if isinstance(value, dict):
        for field, item in value.items():
            _validate_finite_numbers(item, f"{path}.{field}")
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_finite_numbers(item, f"{path}[{index}]")


def _validate_response_contract(operation_id: str, payload: object) -> None:
    try:
        _validate_finite_numbers(payload)
        _validate_response_value(payload, RESPONSE_SCHEMAS[operation_id])
    except (KeyError, TypeError, ValueError) as error:
        raise Week7ExecutionError(
            "week7_schema_mismatch",
            f"TileSimCLI returned a Week 7 report that failed its response contract: {error}",
        ) from error


def _verify_checked_in_inputs(operation: dict, tilesim_root: Path) -> None:
    root = tilesim_root.resolve()
    for argument in operation["arguments"]:
        if not argument.startswith("docs/"):
            continue
        candidate = (root / argument).resolve()
        try:
            candidate.relative_to(root)
        except ValueError as error:
            raise Week7ExecutionError(
                "week7_input_outside_backend",
                "The registered Week 7 input escaped the deployed TileSim worktree.",
            ) from error
        if not candidate.is_file():
            raise Week7ExecutionError(
                "week7_input_missing",
                f"The registered Week 7 input is missing: {argument}",
            )


def execute_week7_operation(
    operation_id: str,
    *,
    tilesim_cli: Path,
    tilesim_root: Path,
    process_runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> dict:
    operation = OPERATIONS.get(operation_id)
    if operation is None:
        raise Week7ExecutionError("week7_operation_unknown", "Unknown Week 7 operation.")
    _verify_checked_in_inputs(operation, tilesim_root)
    try:
        completed = process_runner(
            [str(tilesim_cli), *operation["arguments"]],
            cwd=tilesim_root,
            text=True,
            capture_output=True,
            timeout=45,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise Week7ExecutionError(
            "week7_operation_timeout",
            "The Week 7 operation exceeded its 45 second limit.",
            retryable=True,
        ) from error
    except OSError as error:
        raise Week7ExecutionError(
            "week7_cli_execution_error",
            f"Could not start the Week 7 operation: {error}",
            retryable=True,
        ) from error
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "TileSimCLI returned a non-zero exit code.").strip()
        raise Week7ExecutionError("week7_cli_nonzero_exit", detail, retryable=False)
    try:
        payload = json.loads(completed.stdout, parse_constant=_reject_nonfinite)
    except (json.JSONDecodeError, ValueError) as error:
        raise Week7ExecutionError(
            "week7_invalid_json",
            "TileSimCLI returned an invalid Week 7 JSON report.",
        ) from error
    _validate_response_contract(operation_id, payload)
    return payload
