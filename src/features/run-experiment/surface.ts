import type { CapabilitiesResponse, CatalogResponse, ExperimentDescriptorResponse } from "../../contracts/bridge-api";
import { createRunRequestSchema } from "../../contracts/generated/create-run-schema";
import { expectedParameterPointers } from "./parameter-contract";
import type {
  CanonicalSubsystem,
  ContractStatus,
  ExperimentControlDescriptor,
  ExperimentControlGroup,
  ExperimentInputMode,
  ExperimentSurface,
  UnknownRecord,
} from "./types";

const fieldLabels: Record<string, string> = {
  "s0.workload.message_size_multiplier": "通信负载倍率",
  "s1.runtime.batch_scheduler": "调度策略",
  "s1.runtime.max_batch_size": "最大 batch",
  "s1.runtime.kv_capacity_tokens": "KV 容量",
  "s6.fabric.scale_up_bandwidth_gbps": "Scale-up 带宽",
  "s6.fabric.scale_up_latency_us": "Scale-up 延迟",
  "s6.fabric.scale_out_bandwidth_gbps": "Scale-out 带宽",
  "s6.fabric.scale_out_latency_us": "Scale-out 延迟",
};

const groupPresentation = {
  S0: { title: "Workload controls", detail: "通信负载输入" },
  S1: { title: "Runtime policy", detail: "调度、批处理与 KV 准入" },
  S6: { title: "Fabric parameters", detail: "Scale-up 与 Scale-out" },
} as const;

function compatibilityField(
  fieldId: string,
  requestJsonPointer: string,
  options: {
    minimum?: number;
    maximum?: number;
    step?: number;
    integer?: boolean;
    unit?: string;
    options?: string[];
    defaultValue: string | number;
  },
): ExperimentControlDescriptor {
  return {
    fieldId,
    label: fieldLabels[fieldId] || fieldId,
    kind: options.options ? "select" : "number",
    requestJsonPointer,
    valueType: options.options ? "enum" : options.integer ? "integer" : "number",
    options: options.options || [],
    minimum: options.minimum,
    maximum: options.maximum,
    minimumInclusive: true,
    maximumInclusive: true,
    step: options.step,
    integer: Boolean(options.integer),
    unit: options.unit || "dimensionless",
    required: false,
    explicitDefaultAvailable: true,
    defaultValue: options.defaultValue,
    available: true,
    unavailableReason: null,
    applicableInputModes: ["controls"],
    applicableScenarios: ["s1_des_example"],
    contractStatus: "frontend_compatibility",
  };
}

export const compatibilityControlFields: ExperimentControlDescriptor[] = [
  compatibilityField("s0.workload.message_size_multiplier", "/overrides/workload/message_size_multiplier", {
    minimum: 0.25,
    maximum: 8,
    step: 0.25,
    defaultValue: 1,
  }),
  compatibilityField("s1.runtime.batch_scheduler", "/overrides/runtime/batch_scheduler", {
    options: ["fifo", "decode_priority", "fabric_backpressure_aware"],
    defaultValue: "decode_priority",
  }),
  compatibilityField("s1.runtime.max_batch_size", "/overrides/runtime/max_batch_size", {
    minimum: 1,
    maximum: 64,
    step: 1,
    integer: true,
    defaultValue: 2,
  }),
  compatibilityField("s1.runtime.kv_capacity_tokens", "/overrides/runtime/kv_capacity_tokens", {
    minimum: 256,
    maximum: 1_000_000,
    step: 256,
    integer: true,
    unit: "tokens",
    defaultValue: 4096,
  }),
  compatibilityField("s6.fabric.scale_up_bandwidth_gbps", "/overrides/fabric/scale_up_bandwidth_gbps", {
    minimum: 25,
    maximum: 2000,
    step: 1,
    unit: "Gbps",
    defaultValue: 450,
  }),
  compatibilityField("s6.fabric.scale_up_latency_us", "/overrides/fabric/scale_up_latency_us", {
    minimum: 0.05,
    maximum: 100,
    step: 0.05,
    unit: "us",
    defaultValue: 0.8,
  }),
  compatibilityField("s6.fabric.scale_out_bandwidth_gbps", "/overrides/fabric/scale_out_bandwidth_gbps", {
    minimum: 10,
    maximum: 2000,
    step: 1,
    unit: "Gbps",
    defaultValue: 200,
  }),
  compatibilityField("s6.fabric.scale_out_latency_us", "/overrides/fabric/scale_out_latency_us", {
    minimum: 0.1,
    maximum: 500,
    step: 0.1,
    unit: "us",
    defaultValue: 4,
  }),
];

function compatibilityGroups(): ExperimentControlGroup[] {
  return (["S0", "S1", "S6"] as const).map((subsystem, index) => ({
    groupId: `${subsystem.toLowerCase()}_compatibility`,
    subsystem,
    ...groupPresentation[subsystem],
    displayOrder: index * 100,
    fields: compatibilityControlFields.filter((field) => field.fieldId.startsWith(subsystem.toLowerCase())),
  }));
}

export const experimentControlGroups = compatibilityGroups();
const schemaProperties = createRunRequestSchema.properties;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function supportedValues(contractValues: readonly string[], advertisedValues: unknown): string[] {
  const advertised = stringArray(advertisedValues);
  return advertised.length ? contractValues.filter((value) => advertised.includes(value)) : [...contractValues];
}

function commonValues(left: string[], right: string[]): string[] {
  if (!left.length) return right;
  if (!right.length) return left;
  return left.filter((value) => right.includes(value));
}

function jsonPointerValue(document: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let current = document;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.hasOwn(current, token)) {
      return undefined;
    }
    current = (current as UnknownRecord)[token];
  }
  return current;
}

function predicateAvailable(
  capabilities: unknown,
  predicate: { capability_path: string; operator: string; expected_value: unknown },
): boolean {
  const actual = jsonPointerValue(capabilities, predicate.capability_path);
  if (predicate.operator === "equals") return actual === predicate.expected_value;
  if (predicate.operator === "contains") return Array.isArray(actual) && actual.includes(predicate.expected_value);
  return false;
}

function formalDescriptorError(
  descriptor: ExperimentDescriptorResponse,
  capabilities: CapabilitiesResponse | UnknownRecord,
): string {
  const fieldIds = descriptor.parameter_descriptors.map((field) => field.field_id);
  const pointers = descriptor.parameter_descriptors.map((field) => field.request_json_pointer);
  if (new Set(fieldIds).size !== fieldIds.length) return "duplicate_parameter_field_id";
  if (new Set(pointers).size !== pointers.length) return "duplicate_parameter_request_json_pointer";
  if (
    pointers.length !== expectedParameterPointers.size ||
    pointers.some((pointer) => !expectedParameterPointers.has(pointer))
  ) {
    return "unexpected_parameter_surface";
  }
  const groupIds = descriptor.parameter_groups.map((group) => group.group_id);
  if (new Set(groupIds).size !== groupIds.length) return "duplicate_parameter_group_id";
  const coverageSubsystems = descriptor.subsystem_parameter_coverage.map((item) => item.subsystem);
  if (new Set(coverageSubsystems).size !== 7) return "invalid_subsystem_parameter_coverage";
  for (const subsystem of ["S2", "S3", "S4", "S5"] as const) {
    if (
      descriptor.subsystem_parameter_coverage.find((item) => item.subsystem === subsystem)?.status !== "not_exposed"
    ) {
      return "unexpected_exposed_subsystem";
    }
  }
  const groupById = new Map(descriptor.parameter_groups.map((group) => [group.group_id, group]));
  for (const field of descriptor.parameter_descriptors) {
    const group = groupById.get(field.group_id);
    const evaluated = predicateAvailable(capabilities, field.capability_predicate);
    if (
      !group ||
      group.subsystem !== field.subsystem ||
      !["S0", "S1", "S6"].includes(field.subsystem) ||
      !field.applicable_input_modes.includes("controls") ||
      field.capability_predicate.evaluated_available !== evaluated ||
      field.available !== evaluated
    ) {
      return "parameter_descriptor_capability_mismatch";
    }
  }
  const sourceById = new Map(descriptor.source_mode_options.map((option) => [option.source_mode, option]));
  if (
    sourceById.get("synthetic_trace")?.available !== true ||
    sourceById.get("real_trace")?.available !== false ||
    sourceById.get("compatibility_harness_trace")?.available !== false
  ) {
    return "source_provenance_promotion_rejected";
  }
  for (const option of descriptor.source_mode_options) {
    if (option.capability_predicate) {
      const evaluated = predicateAvailable(capabilities, option.capability_predicate);
      if (option.capability_predicate.evaluated_available !== evaluated || option.available !== evaluated) {
        return "source_mode_capability_mismatch";
      }
    }
  }
  const cycle = descriptor.requested_fidelity_options.find((option) => option.fidelity_policy === "cycle");
  if (!cycle || cycle.available) return "cycle_request_surface_must_be_unavailable";
  for (const option of descriptor.requested_fidelity_options) {
    if (option.capability_predicate) {
      const evaluated = predicateAvailable(capabilities, option.capability_predicate);
      if (option.capability_predicate.evaluated_available !== evaluated || option.available !== evaluated) {
        return "requested_fidelity_capability_mismatch";
      }
    }
  }
  return "";
}

function formalControlGroups(descriptor: ExperimentDescriptorResponse): ExperimentControlGroup[] {
  const fields = descriptor.parameter_descriptors.map<ExperimentControlDescriptor>((field) => ({
    fieldId: field.field_id,
    label: fieldLabels[field.field_id] || field.field_id,
    kind: field.value_type === "enum" ? "select" : "number",
    requestJsonPointer: field.request_json_pointer,
    valueType: field.value_type,
    options: field.enum_values,
    minimum: field.minimum ?? undefined,
    maximum: field.maximum ?? undefined,
    minimumInclusive: field.minimum_inclusive,
    maximumInclusive: field.maximum_inclusive,
    step: field.step ?? undefined,
    integer: field.integer_only,
    unit: field.unit,
    required: field.required,
    explicitDefaultAvailable: field.explicit_default_available,
    defaultValue: field.explicit_default_available ? field.default_value : undefined,
    available: field.available,
    unavailableReason: field.unavailable_reason,
    applicableInputModes: field.applicable_input_modes,
    applicableScenarios: field.applicable_scenarios,
    contractStatus: "backend_descriptor",
  }));
  return descriptor.parameter_groups
    .filter((group): group is typeof group & { subsystem: "S0" | "S1" | "S6" } =>
      ["S0", "S1", "S6"].includes(group.subsystem),
    )
    .sort((left, right) => left.display_order - right.display_order)
    .map((group) => ({
      groupId: group.group_id,
      subsystem: group.subsystem,
      ...groupPresentation[group.subsystem],
      displayOrder: group.display_order,
      fields: fields
        .filter(
          (field) =>
            descriptor.parameter_descriptors.find((item) => item.field_id === field.fieldId)?.group_id ===
            group.group_id,
        )
        .sort(
          (left, right) =>
            (descriptor.parameter_descriptors.find((item) => item.field_id === left.fieldId)?.display_order || 0) -
            (descriptor.parameter_descriptors.find((item) => item.field_id === right.fieldId)?.display_order || 0),
        ),
    }));
}

function baseOptions(
  catalogValue: CatalogResponse | UnknownRecord,
  capabilitiesValue: CapabilitiesResponse | UnknownRecord,
) {
  const catalog = asRecord(catalogValue);
  const capabilities = asRecord(capabilitiesValue);
  const runSurface = asRecord(capabilities.run_surface);
  const schemaScenarioIds = stringArray(schemaProperties.scenario_id.enum);
  const catalogScenarios = Array.isArray(catalog.scenarios)
    ? catalog.scenarios
        .map(asRecord)
        .filter(
          (scenario) => typeof scenario.scenario_id === "string" && schemaScenarioIds.includes(scenario.scenario_id),
        )
        .map((scenario) => ({
          value: scenario.scenario_id as string,
          label: typeof scenario.label === "string" ? scenario.label : (scenario.scenario_id as string),
        }))
    : [];
  const scenarios = catalogScenarios.length
    ? catalogScenarios
    : schemaScenarioIds.map((value) => ({ value, label: value }));
  const fidelityPolicies = supportedValues(schemaProperties.fidelity_policy.enum, catalog.fidelity_policies);
  const gpuParticipationModes = commonValues(
    supportedValues([schemaProperties.gpu_participation_mode.const], catalog.gpu_participation_modes),
    stringArray(runSurface.gpu_participation_modes),
  );
  const schemaInputModes: ExperimentInputMode[] = [
    ...(Object.hasOwn(schemaProperties, "overrides") ? (["controls"] as const) : []),
    ...(Object.hasOwn(schemaProperties, "custom_inputs") ? (["json"] as const) : []),
    ...(Object.hasOwn(schemaProperties, "trace_package_id") ? (["trace_package"] as const) : []),
  ];
  const inputModes = supportedValues(schemaInputModes, catalog.input_modes).filter(
    (value): value is ExperimentInputMode => value === "controls" || value === "json" || value === "trace_package",
  );
  const designSpaceModes = commonValues(
    stringArray(catalog.design_space_modes),
    stringArray(runSurface.design_space_modes),
  );
  const advertisedGpuDefault =
    typeof capabilities.default_gpu_participation_mode === "string"
      ? capabilities.default_gpu_participation_mode
      : schemaProperties.gpu_participation_mode.default;
  return {
    scenarios,
    fidelityPolicies,
    gpuParticipationModes,
    inputModes,
    designSpaceModes,
    defaultFidelityPolicy: schemaProperties.fidelity_policy.default,
    defaultGpuParticipationMode: gpuParticipationModes.includes(advertisedGpuDefault)
      ? advertisedGpuDefault
      : (gpuParticipationModes[0] ?? ""),
  };
}

export function buildExperimentSurface(
  catalogValue: CatalogResponse | UnknownRecord,
  capabilitiesValue: CapabilitiesResponse | UnknownRecord,
  descriptor: ExperimentDescriptorResponse | null = null,
  descriptorStatus: ContractStatus = "legacy_compatibility",
  descriptorError = "experiment_descriptor_unavailable",
): ExperimentSurface {
  const base = baseOptions(catalogValue, capabilitiesValue);
  if (!descriptor || descriptorStatus !== "supported") {
    const isContractError = descriptorStatus === "contract_error";
    return {
      schemaId: createRunRequestSchema.$id,
      descriptorId: "frontend_compatibility",
      descriptorRevision: "legacy:unversioned",
      schemaSetRevision: "legacy:unversioned",
      ...base,
      fidelityOptions: base.fidelityPolicies.map((value) => ({ value, available: true, reason: null })),
      sourceModeOptions: [
        {
          value: "synthetic_trace",
          available: true,
          reason: null,
          claimScope: "compatibility_only",
          calibrationRequirement: "not_claimed",
        },
      ],
      resolvedFidelitySource: "run_execution_envelope_and_validation_reports",
      contractStatus: isContractError ? "contract_error" : "legacy_compatibility",
      contractGaps: [descriptorError || "experiment_descriptor_unavailable"],
      contractError: isContractError ? descriptorError : "",
      controlGroups: isContractError ? [] : compatibilityGroups(),
      coverage: (["S0", "S1", "S2", "S3", "S4", "S5", "S6"] as CanonicalSubsystem[]).map((subsystem) => ({
        subsystem,
        status: ["S0", "S1", "S6"].includes(subsystem) ? "exposed" : "not_exposed",
        reason: ["S0", "S1", "S6"].includes(subsystem) ? null : "compatibility_surface_not_exposed",
        parameterFieldIds: compatibilityControlFields
          .filter((field) => field.fieldId.startsWith(subsystem.toLowerCase()))
          .map((field) => field.fieldId),
      })),
      canSubmit:
        !isContractError &&
        base.scenarios.length > 0 &&
        base.fidelityPolicies.length > 0 &&
        base.gpuParticipationModes.length > 0 &&
        base.inputModes.length > 0,
    };
  }

  const semanticError = formalDescriptorError(descriptor, capabilitiesValue);
  if (semanticError)
    return buildExperimentSurface(catalogValue, capabilitiesValue, null, "contract_error", semanticError);
  const descriptorScenarios = new Map(
    descriptor.scenarios.filter((item) => item.available).map((item) => [item.scenario_id, item]),
  );
  const scenarios = base.scenarios
    .filter((item) => descriptorScenarios.has(item.value))
    .map((item) => ({ ...item, label: descriptorScenarios.get(item.value)?.label || item.label }));
  const fidelityOptions = descriptor.requested_fidelity_options.map((option) => ({
    value: option.fidelity_policy,
    available: option.available,
    reason: option.unavailable_reason,
    detail: option.requested_tier,
  }));
  const fidelityPolicies = base.fidelityPolicies.filter(
    (value) => fidelityOptions.find((option) => option.value === value)?.available,
  );
  const inputModes = base.inputModes.filter((value) =>
    descriptor.input_modes.some((option) => option.input_mode === value && option.available),
  );
  const gpuParticipationModes = base.gpuParticipationModes.filter((value) =>
    descriptor.gpu_participation_modes.some((option) => option.gpu_participation_mode === value && option.available),
  );
  const designSpaceModes = base.designSpaceModes.filter((value) =>
    descriptor.design_space_modes.some((option) => option.design_space_mode === value && option.available),
  );
  const sourceModeOptions = descriptor.source_mode_options.map((option) => ({
    value: option.source_mode,
    available: option.available,
    reason: option.unavailable_reason,
    claimScope: option.allowed_claim_scope,
    calibrationRequirement: option.calibration_requirement,
  }));
  const controlGroups = formalControlGroups(descriptor);
  const coverage = descriptor.subsystem_parameter_coverage.map((item) => ({
    subsystem: item.subsystem,
    status: item.status,
    reason: item.reason,
    parameterFieldIds: [...item.parameter_field_ids],
  }));
  return {
    schemaId: createRunRequestSchema.$id,
    descriptorId: descriptor.descriptor_id,
    descriptorRevision: descriptor.descriptor_revision,
    schemaSetRevision: descriptor.schema_set_revision,
    ...base,
    scenarios,
    fidelityPolicies,
    inputModes,
    gpuParticipationModes,
    designSpaceModes,
    fidelityOptions,
    sourceModeOptions,
    defaultFidelityPolicy: fidelityPolicies.includes(base.defaultFidelityPolicy)
      ? base.defaultFidelityPolicy
      : (fidelityPolicies[0] ?? ""),
    resolvedFidelitySource: descriptor.resolved_fidelity_source,
    contractStatus: "supported",
    contractGaps: [],
    contractError: "",
    controlGroups,
    coverage,
    canSubmit:
      scenarios.length > 0 &&
      fidelityPolicies.length > 0 &&
      gpuParticipationModes.length > 0 &&
      inputModes.length > 0 &&
      controlGroups.flatMap((group) => group.fields).every((field) => !field.required || field.available),
  };
}
