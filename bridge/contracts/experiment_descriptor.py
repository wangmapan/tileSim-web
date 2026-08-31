"""Single source of truth for the F8 controlled experiment request surface."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any


EXPERIMENT_DESCRIPTOR_SCHEMA_IDENTITY = "tilesim.bridge.experiment_descriptor.v1"
CREATE_RUN_SCHEMA_IDENTITY = "tilesim.bridge.create_run_request.v1"
DESCRIPTOR_ID = "f8-s0-s1-s6-controlled-run-surface"

SCENARIO_OPTIONS = (
    {
        "scenario_id": "s1_des_example",
        "label": "S1 -> S6 synthetic runtime example",
        "available": True,
        "unavailable_reason": None,
    },
)

REQUESTED_FIDELITY_OPTIONS = (
    {
        "fidelity_policy": "default",
        "requested_tier": "policy_default",
        "available": True,
        "unavailable_reason": None,
        "capability_predicate": None,
    },
    {
        "fidelity_policy": "des",
        "requested_tier": "DES",
        "available": True,
        "unavailable_reason": None,
        "capability_predicate": None,
    },
    {
        "fidelity_policy": "cycle",
        "requested_tier": "Cycle",
        "available": False,
        "unavailable_reason": "explicit_s6_cycle_hotspot_request_surface_not_exposed",
        "capability_predicate": {
            "capability_path": "/run_surface/cycle_hotspot_request_available",
            "operator": "equals",
            "expected_value": True,
            "evaluated_available": False,
        },
    },
)

GPU_PARTICIPATION_MODES = (
    {
        "gpu_participation_mode": "gpu_free",
        "available": True,
        "unavailable_reason": None,
    },
)

INPUT_MODES = (
    {"input_mode": "controls", "available": True, "unavailable_reason": None},
    {"input_mode": "json", "available": True, "unavailable_reason": None},
)

DESIGN_SPACE_MODES = (
    {
        "design_space_mode": "built_in_synthetic",
        "available": True,
        "unavailable_reason": None,
    },
    {
        "design_space_mode": "strict_s6_manifest",
        "available": True,
        "unavailable_reason": None,
    },
)

SOURCE_MODE_OPTIONS = (
    {
        "source_mode": "synthetic_trace",
        "available": True,
        "unavailable_reason": None,
        "allowed_claim_scope": "synthetic_consistency_and_exploratory_s6_only",
        "calibration_requirement": "not_required_for_consistency_only",
        "applicable_input_modes": ["controls", "json"],
        "capability_predicate": None,
    },
    {
        "source_mode": "real_trace",
        "available": False,
        "unavailable_reason": "real_trace_submission_not_exposed",
        "allowed_claim_scope": "held_out_fidelity_only_with_real_calibrated_evidence",
        "calibration_requirement": "calibrated_and_held_out_validation_required",
        "applicable_input_modes": ["json"],
        "capability_predicate": {
            "capability_path": "/run_surface/real_trace_submission_available",
            "operator": "equals",
            "expected_value": True,
            "evaluated_available": False,
        },
    },
    {
        "source_mode": "compatibility_harness_trace",
        "available": False,
        "unavailable_reason": "compatibility_harness_submission_not_exposed",
        "allowed_claim_scope": "semantic_extraction_and_compatibility_consistency_only",
        "calibration_requirement": "not_ground_truth_fidelity_evidence",
        "applicable_input_modes": ["json"],
        "capability_predicate": {
            "capability_path": "/run_surface/compatibility_harness_submission_available",
            "operator": "equals",
            "expected_value": True,
            "evaluated_available": False,
        },
    },
)


@dataclass(frozen=True)
class ParameterDefinition:
    field_id: str
    subsystem: str
    group_id: str
    display_order: int
    request_json_pointer: str
    value_type: str
    enum_values: tuple[str, ...] = ()
    minimum: int | float | None = None
    maximum: int | float | None = None
    integer_only: bool = False
    step: int | float | None = None
    unit: str = "dimensionless"

    @property
    def section_and_key(self) -> tuple[str, str]:
        parts = self.request_json_pointer.strip("/").split("/")
        if len(parts) != 3 or parts[0] != "overrides":
            raise RuntimeError(f"Unsupported parameter pointer: {self.request_json_pointer}")
        return parts[1], parts[2]


PARAMETER_DEFINITIONS = (
    ParameterDefinition(
        "s0.workload.message_size_multiplier",
        "S0",
        "s0_workload",
        100,
        "/overrides/workload/message_size_multiplier",
        "number",
        minimum=0.25,
        maximum=8.0,
        unit="ratio",
    ),
    ParameterDefinition(
        "s1.runtime.batch_scheduler",
        "S1",
        "s1_runtime",
        200,
        "/overrides/runtime/batch_scheduler",
        "enum",
        enum_values=("fifo", "decode_priority", "fabric_backpressure_aware"),
        unit="scheduler_policy",
    ),
    ParameterDefinition(
        "s1.runtime.max_batch_size",
        "S1",
        "s1_runtime",
        210,
        "/overrides/runtime/max_batch_size",
        "integer",
        minimum=1,
        maximum=64,
        integer_only=True,
        step=1,
        unit="requests_per_batch",
    ),
    ParameterDefinition(
        "s1.runtime.kv_capacity_tokens",
        "S1",
        "s1_runtime",
        220,
        "/overrides/runtime/kv_capacity_tokens",
        "integer",
        minimum=256,
        maximum=1_000_000,
        integer_only=True,
        step=1,
        unit="tokens",
    ),
    ParameterDefinition(
        "s6.fabric.scale_up_bandwidth_gbps",
        "S6",
        "s6_fabric",
        600,
        "/overrides/fabric/scale_up_bandwidth_gbps",
        "number",
        minimum=25,
        maximum=2_000,
        unit="Gbps",
    ),
    ParameterDefinition(
        "s6.fabric.scale_up_latency_us",
        "S6",
        "s6_fabric",
        610,
        "/overrides/fabric/scale_up_latency_us",
        "number",
        minimum=0.05,
        maximum=100,
        unit="us",
    ),
    ParameterDefinition(
        "s6.fabric.scale_out_bandwidth_gbps",
        "S6",
        "s6_fabric",
        620,
        "/overrides/fabric/scale_out_bandwidth_gbps",
        "number",
        minimum=10,
        maximum=2_000,
        unit="Gbps",
    ),
    ParameterDefinition(
        "s6.fabric.scale_out_latency_us",
        "S6",
        "s6_fabric",
        630,
        "/overrides/fabric/scale_out_latency_us",
        "number",
        minimum=0.1,
        maximum=500,
        unit="us",
    ),
)

PARAMETER_BY_POINTER = {
    definition.request_json_pointer: definition for definition in PARAMETER_DEFINITIONS
}
PARAMETER_BY_SECTION_KEY = {
    definition.section_and_key: definition for definition in PARAMETER_DEFINITIONS
}
PARAMETER_FIELD_IDS = tuple(definition.field_id for definition in PARAMETER_DEFINITIONS)

PARAMETER_GROUPS = (
    {"group_id": "s0_workload", "subsystem": "S0", "display_order": 100, "status": "exposed"},
    {"group_id": "s1_runtime", "subsystem": "S1", "display_order": 200, "status": "exposed"},
    {"group_id": "s6_fabric", "subsystem": "S6", "display_order": 600, "status": "exposed"},
)

SUBSYSTEM_PARAMETER_COVERAGE = tuple(
    {
        "subsystem": subsystem,
        "status": "exposed" if subsystem in {"S0", "S1", "S6"} else "not_exposed",
        "parameter_field_ids": [
            definition.field_id
            for definition in PARAMETER_DEFINITIONS
            if definition.subsystem == subsystem
        ],
        "reason": None
        if subsystem in {"S0", "S1", "S6"}
        else "no_formal_create_run_parameter_surface",
    }
    for subsystem in ("S0", "S1", "S2", "S3", "S4", "S5", "S6")
)


def _json_pointer_get(document: object, pointer: str) -> object:
    current = document
    for token in pointer.strip("/").split("/") if pointer != "/" else []:
        token = token.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, dict) or token not in current:
            return None
        current = current[token]
    return current


def evaluate_capability_predicate(capabilities: dict, predicate: dict) -> bool:
    actual = _json_pointer_get(capabilities, predicate["capability_path"])
    operator = predicate["operator"]
    expected = predicate["expected_value"]
    if operator == "equals":
        return actual == expected
    if operator == "contains":
        return isinstance(actual, list) and expected in actual
    raise RuntimeError(f"Unsupported capability operator: {operator}")


def parameter_capability_predicate(definition: ParameterDefinition, capabilities: dict) -> dict:
    predicate = {
        "capability_path": "/run_surface/override_parameter_field_ids",
        "operator": "contains",
        "expected_value": definition.field_id,
    }
    return {
        **predicate,
        "evaluated_available": evaluate_capability_predicate(capabilities, predicate),
    }


def parameter_is_available(definition: ParameterDefinition, capabilities: dict) -> bool:
    return parameter_capability_predicate(definition, capabilities)["evaluated_available"]


def _parameter_descriptor(definition: ParameterDefinition, capabilities: dict) -> dict:
    predicate = parameter_capability_predicate(definition, capabilities)
    descriptor = {
        **asdict(definition),
        "enum_values": list(definition.enum_values),
        "required": False,
        "explicit_default_available": False,
        "minimum_inclusive": definition.minimum is not None,
        "maximum_inclusive": definition.maximum is not None,
        "capability_predicate": predicate,
        "available": predicate["evaluated_available"],
        "unavailable_reason": (
            None if predicate["evaluated_available"] else "parameter_capability_not_available"
        ),
        "applicable_input_modes": ["controls"],
        "applicable_scenarios": ["s1_des_example"],
    }
    return descriptor


def _descriptor_revision_payload() -> dict[str, Any]:
    return {
        "descriptor_id": DESCRIPTOR_ID,
        "create_run_schema_identity": CREATE_RUN_SCHEMA_IDENTITY,
        "scenarios": SCENARIO_OPTIONS,
        "requested_fidelity_options": REQUESTED_FIDELITY_OPTIONS,
        "gpu_participation_modes": GPU_PARTICIPATION_MODES,
        "input_modes": INPUT_MODES,
        "design_space_modes": DESIGN_SPACE_MODES,
        "source_mode_options": SOURCE_MODE_OPTIONS,
        "parameter_groups": PARAMETER_GROUPS,
        "subsystem_parameter_coverage": SUBSYSTEM_PARAMETER_COVERAGE,
        "parameter_definitions": [asdict(definition) for definition in PARAMETER_DEFINITIONS],
    }


DESCRIPTOR_REVISION = "sha256:" + hashlib.sha256(
    json.dumps(
        _descriptor_revision_payload(),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
).hexdigest()


def build_experiment_descriptor(schema_set_revision: str, capabilities: dict) -> dict:
    """Build a schema-set-bound descriptor without upgrading unavailable capabilities."""
    return {
        "schema_version": EXPERIMENT_DESCRIPTOR_SCHEMA_IDENTITY,
        "schema_set_revision": schema_set_revision,
        "descriptor_id": DESCRIPTOR_ID,
        "descriptor_revision": DESCRIPTOR_REVISION,
        "create_run_schema_identity": CREATE_RUN_SCHEMA_IDENTITY,
        "scenarios": [dict(option) for option in SCENARIO_OPTIONS],
        "requested_fidelity_options": [dict(option) for option in REQUESTED_FIDELITY_OPTIONS],
        "gpu_participation_modes": [dict(option) for option in GPU_PARTICIPATION_MODES],
        "input_modes": [dict(option) for option in INPUT_MODES],
        "design_space_modes": [dict(option) for option in DESIGN_SPACE_MODES],
        "source_mode_options": [dict(option) for option in SOURCE_MODE_OPTIONS],
        "parameter_groups": [dict(group) for group in PARAMETER_GROUPS],
        "subsystem_parameter_coverage": [dict(item) for item in SUBSYSTEM_PARAMETER_COVERAGE],
        "parameter_descriptors": [
            _parameter_descriptor(definition, capabilities)
            for definition in PARAMETER_DEFINITIONS
        ],
        "resolved_fidelity_source": "run_execution_envelope_and_validation_reports",
    }
