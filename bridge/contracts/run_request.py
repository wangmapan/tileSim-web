"""Parse one Bridge run request into a validated application command."""

from __future__ import annotations

from dataclasses import dataclass

from .validation import (
    RequestValidationError,
    request_validation_error,
    validate_custom_inputs,
    validate_design_space_candidates,
    validate_overrides,
    validate_run_name,
)


@dataclass(frozen=True)
class ValidatedRunRequest:
    scenario_id: str
    fidelity_policy: str
    gpu_participation_mode: str
    run_name: str
    overrides: dict
    custom_inputs: dict | None
    design_space_candidates: dict | None
    design_space_candidate_schema_identity: str | None
    trace_package_id: str | None


def validate_run_request(
    request: dict,
    *,
    scenario_ids: set[str],
    fidelity_policies: set[str],
    gpu_participation_modes: set[str],
    capabilities: dict | None = None,
) -> ValidatedRunRequest:
    allowed_request_fields = {
        "scenario_id",
        "fidelity_policy",
        "gpu_participation_mode",
        "run_name",
        "overrides",
        "custom_inputs",
        "design_space_candidates",
        "trace_package_id",
    }
    if unknown := set(request) - allowed_request_fields:
        field = sorted(unknown)[0]
        raise RequestValidationError(
            f"Unsupported run request field: {', '.join(sorted(unknown))}.",
            f"/{field}",
        )

    scenario_id = request.get("scenario_id")
    fidelity_policy = request.get("fidelity_policy", "des")
    gpu_participation_mode = request.get("gpu_participation_mode", "gpu_free")
    try:
        run_name = validate_run_name(request.get("run_name"))
    except ValueError as error:
        raise RequestValidationError(str(error), "/run_name") from error
    if scenario_id not in scenario_ids:
        raise RequestValidationError("Scenario is not allow-listed.", "/scenario_id")
    if fidelity_policy not in fidelity_policies:
        raise RequestValidationError("Fidelity policy is not allow-listed.", "/fidelity_policy")
    if gpu_participation_mode not in gpu_participation_modes:
        raise RequestValidationError(
            "GPU participation mode is unavailable on this controlled run surface; "
            "gpu_free is required.",
            "/gpu_participation_mode",
        )

    has_overrides = "overrides" in request
    has_custom_inputs = "custom_inputs" in request
    has_trace_package = "trace_package_id" in request
    if has_overrides and has_custom_inputs:
        raise RequestValidationError("Use either overrides or custom_inputs, not both.", "/custom_inputs")
    if has_trace_package and (has_overrides or has_custom_inputs):
        raise RequestValidationError(
            "Trace-package mode cannot be combined with overrides or custom_inputs.",
            "/trace_package_id",
        )
    if has_trace_package and "design_space_candidates" in request:
        raise RequestValidationError(
            "Trace-package mode cannot be combined with design_space_candidates.",
            "/design_space_candidates",
        )
    trace_package_id = request.get("trace_package_id")
    if has_trace_package and (
        not isinstance(trace_package_id, str)
        or not trace_package_id
        or len(trace_package_id) > 128
    ):
        raise RequestValidationError(
            "trace_package_id must be a nonempty stable identifier of at most 128 characters.",
            "/trace_package_id",
        )
    try:
        overrides = (
            validate_overrides(request.get("overrides"), capabilities=capabilities)
            if has_overrides
            else {}
        )
        custom_inputs = validate_custom_inputs(request["custom_inputs"]) if has_custom_inputs else None
        design_space_candidates = (
            validate_design_space_candidates(
                request["design_space_candidates"],
                des_promotion_enabled=fidelity_policy == "des",
            )
            if "design_space_candidates" in request
            else None
        )
    except ValueError as error:
        default_path = (
            "/design_space_candidates"
            if "design-space" in str(error) or "design_space_candidates" in str(error)
            else "/custom_inputs"
            if has_custom_inputs
            else "/overrides"
        )
        raise request_validation_error(error, default_path) from error

    return ValidatedRunRequest(
        scenario_id=scenario_id,
        fidelity_policy=fidelity_policy,
        gpu_participation_mode=gpu_participation_mode,
        run_name=run_name,
        overrides=overrides,
        custom_inputs=custom_inputs,
        design_space_candidates=design_space_candidates,
        design_space_candidate_schema_identity=(
            design_space_candidates["schema_version"]
            if design_space_candidates is not None
            else None
        ),
        trace_package_id=trace_package_id if has_trace_package else None,
    )
