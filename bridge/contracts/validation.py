"""Pure validation for the controlled TileSim Bridge request surface."""

from __future__ import annotations

import json
import math
import re

from .experiment_descriptor import (
    DEFAULT_DESIGN_SPACE_CANDIDATES_SCHEMA_IDENTITY,
    DESIGN_SPACE_CANDIDATES_SCHEMA_V1,
    DESIGN_SPACE_CANDIDATES_SCHEMA_V2,
    PARAMETER_BY_SECTION_KEY,
    PARAMETER_DEFINITIONS,
    ParameterDefinition,
    parameter_is_available,
)

MAX_CUSTOM_INPUT_BYTES = 1_000_000
MAX_DESIGN_SPACE_CANDIDATES = 256
MAX_DESIGN_SPACE_TRANSFERS = 100_000
DESIGN_SPACE_DES_PROMOTION_UNCERTAINTY_THRESHOLD = 0.70
MAX_EXACT_JSON_INTEGER = 9_007_199_254_740_991

SCHEDULERS = set(PARAMETER_BY_SECTION_KEY[("runtime", "batch_scheduler")].enum_values)


class RequestValidationError(ValueError):
    def __init__(
        self,
        message: str,
        field_path: str = "/",
        *,
        nested_schema_identity: str | None = None,
    ) -> None:
        super().__init__(message)
        self.field_path = field_path
        self.nested_schema_identity = nested_schema_identity


def pointer_for_label(label: str) -> str:
    normalized = re.sub(r"\[(\d+)\]", r".\1", label).strip(".")
    return "/" + "/".join(part for part in normalized.split(".") if part)


def request_validation_error(error: ValueError, default_path: str = "/") -> RequestValidationError:
    if isinstance(error, RequestValidationError):
        return error
    message = str(error)
    dotted = re.search(
        r"(?:custom_inputs|runtime_trace|topology|design_space_candidates)"
        r"(?:\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\])+",
        message,
    )
    if dotted:
        label = dotted.group(0)
        if label.startswith("runtime_trace") or label.startswith("topology"):
            label = "custom_inputs." + label
        return RequestValidationError(message, pointer_for_label(label))
    return RequestValidationError(message, default_path)

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
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return isinstance(value, int) or math.isfinite(value)


def bounded_number(
    value: object,
    label: str,
    minimum: float,
    maximum: float,
    integer: bool = False,
    field_path: str | None = None,
) -> int | float:
    if not is_number(value) or value < minimum or value > maximum:
        raise RequestValidationError(
            f"{label} must be between {minimum} and {maximum}.",
            field_path or pointer_for_label(label),
        )
    if integer and int(value) != value:
        raise RequestValidationError(
            f"{label} must be an integer.",
            field_path or pointer_for_label(label),
        )
    return int(value) if integer else float(value)


def validate_parameter_value(value: object, definition: ParameterDefinition) -> object:
    """Apply the same enum/range/integer contract published by the descriptor."""
    pointer = definition.request_json_pointer
    if definition.value_type == "enum":
        if not isinstance(value, str) or value not in definition.enum_values:
            raise RequestValidationError(
                f"{definition.field_id} is not allow-listed.",
                pointer,
            )
        return value
    return bounded_number(
        value,
        definition.field_id,
        definition.minimum,
        definition.maximum,
        integer=definition.integer_only,
        field_path=pointer,
    )


def validate_overrides(value: object, *, capabilities: dict | None = None) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise RequestValidationError("overrides must be an object.", "/overrides")
    allowed_sections = {definition.section_and_key[0] for definition in PARAMETER_DEFINITIONS}
    if unknown := set(value) - allowed_sections:
        field = sorted(unknown)[0]
        raise RequestValidationError(
            f"Unsupported override section: {', '.join(sorted(unknown))}.",
            f"/overrides/{field}",
        )

    clean: dict[str, dict] = {}
    for section in sorted(allowed_sections):
        section_value = value.get(section, {})
        if not isinstance(section_value, dict):
            raise RequestValidationError(
                f"overrides.{section} must be an object.",
                f"/overrides/{section}",
            )
        allowed_keys = {
            definition.section_and_key[1]
            for definition in PARAMETER_DEFINITIONS
            if definition.section_and_key[0] == section
        }
        if unknown := set(section_value) - allowed_keys:
            field = sorted(unknown)[0]
            raise RequestValidationError(
                f"Unsupported {section} override: {', '.join(sorted(unknown))}.",
                f"/overrides/{section}/{field}",
            )
        for key, raw_value in section_value.items():
            definition = PARAMETER_BY_SECTION_KEY[(section, key)]
            if capabilities is not None and not parameter_is_available(definition, capabilities):
                raise RequestValidationError(
                    f"{definition.field_id} is unavailable for the current runtime capability set.",
                    definition.request_json_pointer,
                )
            clean.setdefault(section, {})[key] = validate_parameter_value(raw_value, definition)
    return clean


def reject_unknown_fields(document: dict, allowed: set[str], label: str) -> None:
    if unknown := set(document) - allowed:
        field = sorted(unknown)[0]
        raise RequestValidationError(
            f"Unsupported {label} field: {', '.join(sorted(unknown))}.",
            pointer_for_label(f"{label}.{field}"),
        )


def validate_optional_numbers(
    document: dict,
    label: str,
    specifications: dict[str, tuple[int | float, int | float, bool]],
) -> None:
    for field, (minimum, maximum, integer_only) in specifications.items():
        if field in document:
            bounded_number(
                document[field],
                f"{label}.{field}",
                minimum,
                maximum,
                integer=integer_only,
                field_path=pointer_for_label(f"{label}.{field}"),
            )


def validate_optional_strings(
    document: dict,
    label: str,
    fields: set[str],
    *,
    required_nonempty: set[str] | None = None,
) -> None:
    required_nonempty = required_nonempty or set()
    for field in fields:
        if field not in document:
            if field in required_nonempty:
                raise RequestValidationError(
                    f"{label}.{field} is required.",
                    pointer_for_label(f"{label}.{field}"),
                )
            continue
        value = document[field]
        if not isinstance(value, str) or len(value) > 512 or (field in required_nonempty and not value):
            raise RequestValidationError(
                f"{label}.{field} must be a bounded string.",
                pointer_for_label(f"{label}.{field}"),
            )


def validate_string_array(value: object, label: str, maximum: int = 1_024) -> None:
    if (
        not isinstance(value, list)
        or len(value) > maximum
        or not all(isinstance(item, str) and item for item in value)
    ):
        raise RequestValidationError(
            f"{label} must be a bounded array of nonempty strings.",
            pointer_for_label(label),
        )


def require_synthetic_provenance(document: object, label: str) -> None:
    if document is None:
        return
    if not isinstance(document, dict):
        raise RequestValidationError(f"{label} must be an object.", pointer_for_label(label))
    allowed = (
        {
            "source_mode",
            "calibration_level",
            "allowed_claim_scope",
            "source_id",
            "generation_path",
            "capture_or_generation_time",
            "upstream_tooling",
            "trace_kind",
            "notes",
        }
        if label.endswith("trace_provenance")
        else {"source_mode", "calibration_level", "allowed_claim_scope"}
    )
    reject_unknown_fields(document, allowed, label)
    for field in ("source_mode", "calibration_level", "allowed_claim_scope"):
        if not isinstance(document.get(field), str) or not document[field]:
            raise RequestValidationError(
                f"{label}.{field} is required.",
                pointer_for_label(f"{label}.{field}"),
            )
    if document["source_mode"] != "synthetic_trace":
        raise RequestValidationError(
            f"{label}.source_mode is not exposed by the controlled web run surface.",
            pointer_for_label(f"{label}.source_mode"),
        )
    if document["calibration_level"] not in {"uncalibrated", "partially_calibrated"}:
        raise RequestValidationError(
            f"{label}.calibration_level would upgrade synthetic provenance.",
            pointer_for_label(f"{label}.calibration_level"),
        )
    if document["allowed_claim_scope"] not in {
        "exploratory",
        "exploratory_s6_only",
        "synthetic_consistency",
        "synthetic_consistency_only",
        "workflow_consistency_only",
    }:
        raise RequestValidationError(
            f"{label}.allowed_claim_scope is not valid for synthetic provenance.",
            pointer_for_label(f"{label}.allowed_claim_scope"),
        )


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
    reject_unknown_fields(
        trace,
        {"trace_name", "trace_provenance", "policy", "requests"},
        "custom_inputs.runtime_trace",
    )
    validate_optional_strings(trace, "custom_inputs.runtime_trace", {"trace_name"})
    require_synthetic_provenance(
        trace.get("trace_provenance"),
        "custom_inputs.runtime_trace.trace_provenance",
    )
    if not isinstance(trace.get("policy"), dict) or not isinstance(trace.get("requests"), list):
        raise ValueError("runtime_trace requires policy and requests fields.")
    reject_unknown_fields(
        trace["policy"],
        {
            "kv_capacity_tokens",
            "initial_kv_tokens",
            "max_active_requests",
            "max_batch_size",
            "batch_scheduler",
            "prefill_starvation_threshold_ps",
            "pd_handoff_delay_ps",
            "pd_handoff_queue_service_ps",
            "kv_page_size_tokens",
            "kv_fragmentation_overhead",
            "kv_admission_watermark",
            "fabric_backpressure_active",
            "fabric_backpressure_delay_us",
            "fabric_backpressure_throttle_threshold_us",
            "fabric_backpressure_prefill_batch_limit",
            "long_context_threshold_tokens",
            "decode_penalty_per_threshold",
        },
        "custom_inputs.runtime_trace.policy",
    )
    policy_label = "custom_inputs.runtime_trace.policy"
    validate_optional_numbers(
        trace["policy"],
        policy_label,
        {
            "kv_capacity_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
            "initial_kv_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
            "max_active_requests": (0, 1_024, True),
            "max_batch_size": (0, 1_024, True),
            "prefill_starvation_threshold_ps": (0, MAX_EXACT_JSON_INTEGER, True),
            "pd_handoff_delay_ps": (0, MAX_EXACT_JSON_INTEGER, True),
            "pd_handoff_queue_service_ps": (0, MAX_EXACT_JSON_INTEGER, True),
            "kv_page_size_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
            "kv_fragmentation_overhead": (0, MAX_EXACT_JSON_INTEGER, False),
            "kv_admission_watermark": (0, 1, False),
            "fabric_backpressure_delay_us": (0, MAX_EXACT_JSON_INTEGER, False),
            "fabric_backpressure_throttle_threshold_us": (0, MAX_EXACT_JSON_INTEGER, False),
            "fabric_backpressure_prefill_batch_limit": (0, 1_024, True),
            "long_context_threshold_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
            "decode_penalty_per_threshold": (0, MAX_EXACT_JSON_INTEGER, False),
        },
    )
    if "batch_scheduler" in trace["policy"] and trace["policy"]["batch_scheduler"] not in SCHEDULERS:
        raise RequestValidationError(
            "runtime trace batch_scheduler is not allow-listed.",
            "/custom_inputs/runtime_trace/policy/batch_scheduler",
        )
    if "fabric_backpressure_active" in trace["policy"] and not isinstance(
        trace["policy"]["fabric_backpressure_active"], bool
    ):
        raise RequestValidationError(
            "runtime trace fabric_backpressure_active must be boolean.",
            "/custom_inputs/runtime_trace/policy/fabric_backpressure_active",
        )
    if not 1 <= len(trace["requests"]) <= 1_024:
        raise ValueError("runtime_trace.requests must contain between 1 and 1024 requests.")
    if not all(isinstance(request, dict) for request in trace["requests"]):
        raise ValueError("runtime_trace.requests must contain JSON objects.")
    runtime_request_fields = {
        "request_id",
        "model_id",
        "arrival_time_ps",
        "phase",
        "prompt_tokens",
        "decode_tokens",
        "kv_tokens",
        "priority_class",
        "tp_degree",
        "participants",
        "collective_type",
        "message_size_bytes",
        "placement_group_id",
        "disaggregation_group_id",
        "kv_handoff_id",
    }
    request_ids: set[str] = set()
    for index, request in enumerate(trace["requests"]):
        label = f"custom_inputs.runtime_trace.requests[{index}]"
        reject_unknown_fields(request, runtime_request_fields, label)
        request_id = request.get("request_id")
        if not isinstance(request_id, str) or not request_id or request_id in request_ids:
            raise RequestValidationError(
                "runtime_trace request_id values must be nonempty and unique.",
                pointer_for_label(f"{label}.request_id"),
            )
        request_ids.add(request_id)
        validate_optional_strings(
            request,
            label,
            {
                "request_id",
                "model_id",
                "collective_type",
                "placement_group_id",
                "disaggregation_group_id",
                "kv_handoff_id",
            },
            required_nonempty={"request_id"},
        )
        validate_optional_numbers(
            request,
            label,
            {
                "arrival_time_ps": (0, MAX_EXACT_JSON_INTEGER, True),
                "prompt_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
                "decode_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
                "kv_tokens": (0, MAX_EXACT_JSON_INTEGER, True),
                "priority_class": (-MAX_EXACT_JSON_INTEGER, MAX_EXACT_JSON_INTEGER, True),
                "tp_degree": (1, 1_024, True),
                "message_size_bytes": (0, MAX_EXACT_JSON_INTEGER, True),
            },
        )
        if "phase" in request and request["phase"] not in {"prefill", "decode"}:
            raise RequestValidationError(
                f"{label}.phase is unsupported.",
                pointer_for_label(f"{label}.phase"),
            )
        if "participants" in request:
            validate_string_array(request["participants"], f"{label}.participants")

    topology = value["topology"]
    reject_unknown_fields(
        topology,
        {"scenario_name", "provenance", "topology", "workload"},
        "custom_inputs.topology",
    )
    validate_optional_strings(topology, "custom_inputs.topology", {"scenario_name"})
    require_synthetic_provenance(
        topology.get("provenance"),
        "custom_inputs.topology.provenance",
    )
    topology_root = topology.get("topology")
    if not isinstance(topology_root, dict):
        raise ValueError("topology requires a topology object.")
    reject_unknown_fields(
        topology_root,
        {
            "topology_name",
            "routing_policies",
            "transport_policies",
            "calibration_profiles",
            "devices",
            "links",
            "module_bindings",
            "domains",
        },
        "custom_inputs.topology.topology",
    )
    validate_optional_strings(
        topology_root,
        "custom_inputs.topology.topology",
        {"topology_name"},
    )
    for map_name in ("routing_policies", "transport_policies", "calibration_profiles"):
        if map_name not in topology_root:
            continue
        mapping = topology_root[map_name]
        if not isinstance(mapping, dict) or any(
            isinstance(item, (dict, list)) or not isinstance(item, (str, int, float, bool))
            or (isinstance(item, float) and not math.isfinite(item))
            for item in mapping.values()
        ):
            raise RequestValidationError(
                f"custom_inputs.topology.topology.{map_name} must be a scalar map.",
                f"/custom_inputs/topology/topology/{map_name}",
            )
    for key, maximum in {"devices": 1_024, "module_bindings": 64, "domains": 64}.items():
        values = topology_root.get(key)
        if not isinstance(values, list) or len(values) > maximum:
            raise ValueError(f"topology.topology.{key} must be a list with at most {maximum} entries.")
    domain_ids: set[str] = set()
    for index, device in enumerate(topology_root["devices"]):
        if not isinstance(device, dict):
            raise ValueError(f"topology.topology.devices[{index}] must be an object.")
        reject_unknown_fields(
            device,
            {"device_id", "device_type", "group_id"},
            f"custom_inputs.topology.topology.devices[{index}]",
        )
        validate_optional_strings(
            device,
            f"custom_inputs.topology.topology.devices[{index}]",
            {"device_id", "device_type", "group_id"},
            required_nonempty={"device_id"},
        )
    for index, binding in enumerate(topology_root["module_bindings"]):
        if not isinstance(binding, dict):
            raise ValueError(f"topology.topology.module_bindings[{index}] must be an object.")
        label = f"custom_inputs.topology.topology.module_bindings[{index}]"
        reject_unknown_fields(
            binding,
            {"module_name", "module_version", "module_kind", "config_profile", "override_params"},
            label,
        )
        validate_optional_strings(
            binding,
            label,
            {"module_name", "module_version", "config_profile"},
            required_nonempty={"module_name"},
        )
        if binding.get("module_kind") not in {"scale_up", "scale_out"}:
            raise RequestValidationError(
                f"{label}.module_kind is unsupported.",
                pointer_for_label(f"{label}.module_kind"),
            )
        override_params = binding.get("override_params", {})
        if not isinstance(override_params, dict):
            raise RequestValidationError(
                f"{label}.override_params must be an object.",
                pointer_for_label(f"{label}.override_params"),
            )
        reject_unknown_fields(
            override_params,
            {"bandwidth_gbps", "latency_us", "queue_factor", "oversubscription_factor"},
            f"{label}.override_params",
        )
        validate_optional_numbers(
            override_params,
            f"{label}.override_params",
            {
                "bandwidth_gbps": (0.000001, 100_000, False),
                "latency_us": (0, 1_000_000, False),
                "queue_factor": (0, 1_000_000, False),
                "oversubscription_factor": (1, 1_000_000, False),
            },
        )
    links = topology_root.get("links", [])
    if not isinstance(links, list) or len(links) > MAX_DESIGN_SPACE_TRANSFERS:
        raise RequestValidationError(
            "custom_inputs.topology.topology.links must be a bounded array.",
            "/custom_inputs/topology/topology/links",
        )
    for index, link in enumerate(links):
        if not isinstance(link, dict):
            raise RequestValidationError(
                f"custom_inputs.topology.topology.links[{index}] must be an object.",
                f"/custom_inputs/topology/topology/links/{index}",
            )
        reject_unknown_fields(
            link,
            {"src_device", "dst_device", "domain_id", "bandwidth_gbps", "latency_us"},
            f"custom_inputs.topology.topology.links[{index}]",
        )
        link_label = f"custom_inputs.topology.topology.links[{index}]"
        validate_optional_strings(
            link,
            link_label,
            {"src_device", "dst_device", "domain_id"},
            required_nonempty={"src_device", "dst_device", "domain_id"},
        )
        validate_optional_numbers(
            link,
            link_label,
            {
                "bandwidth_gbps": (0, 100_000, False),
                "latency_us": (0, 1_000_000, False),
            },
        )
    for index, domain in enumerate(topology_root["domains"]):
        if not isinstance(domain, dict):
            raise ValueError(f"topology.topology.domains[{index}] must be an object.")
        reject_unknown_fields(
            domain,
            {
                "domain_id",
                "domain_type",
                "member_devices",
                "module_binding",
                "default_fidelity",
                "failure_policy",
            },
            f"custom_inputs.topology.topology.domains[{index}]",
        )
        domain_id = domain.get("domain_id")
        if not isinstance(domain_id, str) or not domain_id or domain_id in domain_ids:
            raise ValueError("topology domain_id values must be nonempty and unique.")
        domain_ids.add(domain_id)
        domain_label = f"custom_inputs.topology.topology.domains[{index}]"
        validate_optional_strings(
            domain,
            domain_label,
            {"domain_id", "module_binding"},
            required_nonempty={"domain_id", "module_binding"},
        )
        if domain.get("domain_type") not in {"scale_up", "scale_out"}:
            raise RequestValidationError(
                f"{domain_label}.domain_type is unsupported.",
                pointer_for_label(f"{domain_label}.domain_type"),
            )
        if "member_devices" not in domain:
            raise RequestValidationError(
                f"{domain_label}.member_devices is required.",
                pointer_for_label(f"{domain_label}.member_devices"),
            )
        validate_string_array(domain["member_devices"], f"{domain_label}.member_devices")
        if domain.get("default_fidelity", "analytical") not in {"analytical", "des"}:
            raise RequestValidationError(
                f"{domain_label}.default_fidelity is unsupported.",
                pointer_for_label(f"{domain_label}.default_fidelity"),
            )
        if domain.get("failure_policy", "fallback") not in {"fallback", "fail_closed"}:
            raise RequestValidationError(
                f"{domain_label}.failure_policy is unsupported.",
                pointer_for_label(f"{domain_label}.failure_policy"),
            )
    workload = topology.get("workload")
    if workload is not None:
        if not isinstance(workload, dict):
            raise RequestValidationError(
                "custom_inputs.topology.workload must be an object.",
                "/custom_inputs/topology/workload",
            )
        reject_unknown_fields(workload, {"requests"}, "custom_inputs.topology.workload")
        requests = workload.get("requests")
        if not isinstance(requests, list) or len(requests) > MAX_DESIGN_SPACE_TRANSFERS:
            raise RequestValidationError(
                "custom_inputs.topology.workload.requests must be a bounded array.",
                "/custom_inputs/topology/workload/requests",
            )
        topology_request_fields = {
            "request_id",
            "batch_id",
            "phase",
            "collective_type",
            "message_size_bytes",
            "message_size_mb",
            "tp_degree",
            "participants",
            "release_time_ps",
            "memory_latency_ps",
            "device_latency_ps",
        }
        for index, request in enumerate(requests):
            if not isinstance(request, dict):
                raise RequestValidationError(
                    f"custom_inputs.topology.workload.requests[{index}] must be an object.",
                    f"/custom_inputs/topology/workload/requests/{index}",
                )
            reject_unknown_fields(
                request,
                topology_request_fields,
                f"custom_inputs.topology.workload.requests[{index}]",
            )
            request_label = f"custom_inputs.topology.workload.requests[{index}]"
            validate_optional_strings(
                request,
                request_label,
                {"request_id", "batch_id", "collective_type"},
                required_nonempty={"request_id"},
            )
            validate_optional_numbers(
                request,
                request_label,
                {
                    "message_size_bytes": (0, MAX_EXACT_JSON_INTEGER, True),
                    "message_size_mb": (0, MAX_EXACT_JSON_INTEGER, False),
                    "tp_degree": (1, 1_024, True),
                    "release_time_ps": (0, MAX_EXACT_JSON_INTEGER, True),
                    "memory_latency_ps": (0, MAX_EXACT_JSON_INTEGER, True),
                    "device_latency_ps": (0, MAX_EXACT_JSON_INTEGER, True),
                },
            )
            if "phase" in request and request["phase"] not in {"prefill", "decode"}:
                raise RequestValidationError(
                    f"{request_label}.phase is unsupported.",
                    pointer_for_label(f"{request_label}.phase"),
                )
            if "participants" in request:
                validate_string_array(request["participants"], f"{request_label}.participants")
    return {"runtime_trace": trace, "topology": topology}


def validate_design_space_candidates(
    value: object,
    *,
    des_promotion_enabled: bool = True,
) -> dict:
    """Validate a versioned S6-only manifest and return its explicit identity."""
    if not isinstance(value, dict):
        raise ValueError("design_space_candidates must be a JSON object.")
    schema_identity = value.get(
        "schema_version",
        DEFAULT_DESIGN_SPACE_CANDIDATES_SCHEMA_IDENTITY,
    )
    if not isinstance(schema_identity, str) or schema_identity not in {
        DESIGN_SPACE_CANDIDATES_SCHEMA_V1,
        DESIGN_SPACE_CANDIDATES_SCHEMA_V2,
    }:
        raise RequestValidationError(
            "design-space schema_version is not supported.",
            "/design_space_candidates/schema_version",
            nested_schema_identity=(
                schema_identity if isinstance(schema_identity, str) else None
            ),
        )

    manifest = value
    if "schema_version" not in value:
        manifest = {**value, "schema_version": schema_identity}

    try:
        return _validate_design_space_candidates_version(
            manifest,
            schema_identity=schema_identity,
            des_promotion_enabled=des_promotion_enabled,
        )
    except ValueError as error:
        validation = request_validation_error(error, "/design_space_candidates")
        if validation.nested_schema_identity == schema_identity:
            raise
        raise RequestValidationError(
            str(validation),
            validation.field_path,
            nested_schema_identity=schema_identity,
        ) from error


def _validate_design_space_candidates_version(
    value: dict,
    *,
    schema_identity: str,
    des_promotion_enabled: bool,
) -> dict:
    is_v2 = schema_identity == DESIGN_SPACE_CANDIDATES_SCHEMA_V2
    root_fields = {
        "schema_version",
        "manifest_id",
        "source_mode",
        "calibration_level",
        "allowed_claim_scope",
        "candidates",
    }
    if unknown := set(value) - root_fields:
        raise ValueError(f"Unsupported design-space manifest field: {', '.join(sorted(unknown))}.")
    if missing := root_fields - set(value):
        raise ValueError(f"Missing design-space manifest field: {', '.join(sorted(missing))}.")
    if value["schema_version"] != schema_identity:
        raise RequestValidationError(
            "design-space schema_version is not supported.",
            "/design_space_candidates/schema_version",
            nested_schema_identity=schema_identity,
        )
    if not isinstance(value["manifest_id"], str) or not 1 <= len(value["manifest_id"]) <= 160:
        raise ValueError("design-space manifest_id must contain 1 to 160 characters.")
    if value["source_mode"] != "synthetic_trace":
        raise RequestValidationError(
            "design-space source_mode is not exposed by the controlled web run surface.",
            "/design_space_candidates/source_mode",
        )
    calibration_levels = {"uncalibrated"} if is_v2 else {
        "uncalibrated",
        "partially_calibrated",
    }
    if value["calibration_level"] not in calibration_levels:
        raise RequestValidationError(
            "design-space calibration_level is not supported.",
            "/design_space_candidates/calibration_level",
        )
    allowed_claim_scopes = {"exploratory"} if is_v2 else {
        "exploratory",
        "exploratory_s6_only",
        "synthetic_consistency",
        "synthetic_consistency_only",
        "workflow_consistency_only",
    }
    if value["allowed_claim_scope"] not in allowed_claim_scopes:
        raise RequestValidationError(
            "design-space allowed_claim_scope is not valid for synthetic provenance.",
            "/design_space_candidates/allowed_claim_scope",
        )
    candidates = value["candidates"]
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= MAX_DESIGN_SPACE_CANDIDATES:
        raise ValueError(
            f"design-space candidates must contain between 1 and {MAX_DESIGN_SPACE_CANDIDATES} entries."
        )

    required_candidate_fields = {
        "candidate_id",
        "name",
        "bandwidth_gbps",
        "latency_us",
        "oversubscription_factor",
        "request_count",
        "message_bytes",
        "release_interval_ps",
        "uncertainty_score",
        "tail_risk",
        "source_id",
    }
    allowed_candidate_fields = required_candidate_fields | {"promotion_hint"}
    candidate_ids: set[str] = set()
    canonical_inputs: set[tuple] = set()
    promoted_transfer_count = 0
    top_k_transfer_reserve = 0
    total_transfers = 0
    for index, candidate in enumerate(candidates):
        prefix = f"design_space_candidates.candidates[{index}]"
        if not isinstance(candidate, dict):
            raise ValueError(f"{prefix} must be an object.")
        if unknown := set(candidate) - allowed_candidate_fields:
            raise ValueError(f"Unsupported {prefix} field: {', '.join(sorted(unknown))}.")
        if missing := required_candidate_fields - set(candidate):
            raise ValueError(f"Missing {prefix} field: {', '.join(sorted(missing))}.")
        for field in ("candidate_id", "name", "source_id"):
            if not isinstance(candidate[field], str) or not 1 <= len(candidate[field]) <= 512:
                raise ValueError(f"{prefix}.{field} must be a nonempty bounded string.")
        hint = candidate.get("promotion_hint", "")
        if not isinstance(hint, str) or len(hint) > 160:
            raise ValueError(f"{prefix}.promotion_hint must be a string of at most 160 characters.")
        if candidate["candidate_id"] in candidate_ids:
            raise ValueError("design-space candidate_id values must be unique.")
        candidate_ids.add(candidate["candidate_id"])

        bandwidth = bounded_number(candidate["bandwidth_gbps"], f"{prefix}.bandwidth_gbps", 0.000001, 100_000)
        latency = bounded_number(candidate["latency_us"], f"{prefix}.latency_us", 0, 1_000_000)
        oversubscription = bounded_number(
            candidate["oversubscription_factor"],
            f"{prefix}.oversubscription_factor",
            1 if is_v2 else 0.000001,
            1_000_000,
        )
        request_count = bounded_number(
            candidate["request_count"], f"{prefix}.request_count", 1, MAX_DESIGN_SPACE_TRANSFERS, integer=True
        )
        message_bytes = bounded_number(
            candidate["message_bytes"], f"{prefix}.message_bytes", 1, MAX_EXACT_JSON_INTEGER, integer=True
        )
        release_interval = bounded_number(
            candidate["release_interval_ps"],
            f"{prefix}.release_interval_ps",
            0,
            MAX_EXACT_JSON_INTEGER,
            integer=True,
        )
        uncertainty = bounded_number(candidate["uncertainty_score"], f"{prefix}.uncertainty_score", 0, 1)
        if not isinstance(candidate["tail_risk"], bool):
            raise ValueError(f"{prefix}.tail_risk must be boolean.")
        total_transfers += request_count
        if total_transfers > MAX_DESIGN_SPACE_TRANSFERS:
            raise ValueError(
                f"design-space candidates exceed the {MAX_DESIGN_SPACE_TRANSFERS} transfer execution budget."
            )
        canonical = (
            bandwidth,
            latency,
            oversubscription,
            request_count,
            message_bytes,
            release_interval,
        )
        if not is_v2:
            canonical += (uncertainty, candidate["tail_risk"])
        if canonical in canonical_inputs:
            raise ValueError("design-space canonical candidate inputs must be unique.")
        canonical_inputs.add(canonical)
        if is_v2:
            if (
                uncertainty >= DESIGN_SPACE_DES_PROMOTION_UNCERTAINTY_THRESHOLD
                or candidate["tail_risk"]
            ):
                promoted_transfer_count += request_count
            else:
                top_k_transfer_reserve = max(top_k_transfer_reserve, request_count)
    if (
        is_v2
        and des_promotion_enabled
        and total_transfers + promoted_transfer_count + top_k_transfer_reserve
        > MAX_DESIGN_SPACE_TRANSFERS
    ):
        raise ValueError(
            "design-space candidates exceed the bounded aggregate Analytical and promoted DES transfer execution budget."
        )
    return value
