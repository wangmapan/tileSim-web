import type { CreateRunRequest } from "../../contracts/bridge-api";
import { createRunRequestSchema } from "../../contracts/generated/create-run-schema";
import {
  createRunRequest as validateCreateRunRequest,
  designSpaceCandidates as validateDesignSpaceCandidates,
} from "../../contracts/generated/experiment-validators.js";
import { expectedParameterPointers } from "./parameter-contract";
import {
  ExperimentRequestError,
  type BuildExperimentRequestOptions,
  type ExperimentControlDescriptor,
  type ExperimentErrorTarget,
  type ExperimentFormState,
  type ExperimentRequestPreview,
  type ExperimentSurface,
  type ParameterValue,
  type UnknownRecord,
} from "./types";

const schemaProperties = createRunRequestSchema.properties;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function requireSupported(value: string, supported: readonly string[], fieldPath: string): void {
  if (!supported.includes(value)) {
    throw new ExperimentRequestError(`Unsupported value: ${value || "missing"}.`, fieldPath);
  }
}

function parseJsonObject(text: string, fieldPath: string, label: string): UnknownRecord {
  if (!text.trim()) throw new ExperimentRequestError(`${label} is required.`, fieldPath);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ExperimentRequestError(`${label} must have an object root.`, fieldPath);
    }
    return value as UnknownRecord;
  } catch (error) {
    if (error instanceof ExperimentRequestError) throw error;
    throw new ExperimentRequestError(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      fieldPath,
    );
  }
}

function controlValue(form: ExperimentFormState, field: ExperimentControlDescriptor): ParameterValue {
  const value = form.parameterValues[field.fieldId];
  if (value === undefined || value === null || value === "") {
    if (field.required) throw new ExperimentRequestError(`${field.fieldId} is required.`, field.requestJsonPointer);
    return undefined;
  }
  if (!field.available) throw new ExperimentRequestError(`${field.fieldId} is unavailable.`, field.requestJsonPointer);
  if (field.kind === "select") {
    if (typeof value !== "string" || !field.options.includes(value)) {
      throw new ExperimentRequestError(`Unsupported value: ${String(value)}.`, field.requestJsonPointer);
    }
    return value;
  }
  const numberValue = Number(value);
  const belowMinimum =
    field.minimum !== undefined &&
    (field.minimumInclusive ? numberValue < field.minimum : numberValue <= field.minimum);
  const aboveMaximum =
    field.maximum !== undefined &&
    (field.maximumInclusive ? numberValue > field.maximum : numberValue >= field.maximum);
  if (
    !Number.isFinite(numberValue) ||
    (field.integer && !Number.isInteger(numberValue)) ||
    belowMinimum ||
    aboveMaximum
  ) {
    throw new ExperimentRequestError(`${field.fieldId} is outside the descriptor range.`, field.requestJsonPointer);
  }
  return numberValue;
}

function setRequestValueByPointer(target: UnknownRecord, pointer: string, value: string | number | boolean): void {
  if (!expectedParameterPointers.has(pointer))
    throw new ExperimentRequestError("Unsupported request Pointer.", pointer);
  const tokens = pointer
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cursor = target;
  for (const token of tokens.slice(0, -1)) {
    cursor[token] = asRecord(cursor[token]);
    cursor = cursor[token] as UnknownRecord;
  }
  cursor[tokens.at(-1) as string] = value;
}

function validationPointer(validator: unknown, root = ""): string {
  const errors = (
    validator as {
      errors?: {
        instancePath?: string;
        params?: { missingProperty?: string; additionalProperty?: string };
      }[];
    }
  ).errors;
  const first = errors?.[0];
  const property = first?.params?.missingProperty || first?.params?.additionalProperty;
  return `${root}${first?.instancePath || ""}${property ? `/${property}` : ""}` || root;
}

export function buildExperimentRequest(options: BuildExperimentRequestOptions): CreateRunRequest {
  const { form, mode, surface } = options;
  if (!surface.canSubmit || surface.contractStatus === "contract_error") {
    throw new ExperimentRequestError(surface.contractError || "Experiment contract is unavailable.", "contract_error");
  }
  requireSupported(
    form.scenario_id,
    surface.scenarios.map((scenario) => scenario.value),
    "/scenario_id",
  );
  requireSupported(form.fidelity_policy, surface.fidelityPolicies, "/fidelity_policy");
  requireSupported(form.gpu_participation_mode, surface.gpuParticipationModes, "/gpu_participation_mode");
  requireSupported(mode, surface.inputModes, "/input_mode");
  if (form.run_name.length > schemaProperties.run_name.maxLength) {
    throw new ExperimentRequestError(
      `Run name exceeds ${schemaProperties.run_name.maxLength} characters.`,
      "/run_name",
    );
  }

  const request: UnknownRecord = {
    scenario_id: form.scenario_id,
    fidelity_policy: form.fidelity_policy,
    gpu_participation_mode: form.gpu_participation_mode,
  };
  if (form.run_name.trim()) request.run_name = form.run_name.trim();
  if (mode === "controls") {
    for (const field of surface.controlGroups.flatMap((group) => group.fields)) {
      if (!field.applicableInputModes.includes(mode) || !field.applicableScenarios.includes(form.scenario_id)) continue;
      const value = controlValue(form, field);
      if (value !== undefined && value !== null) setRequestValueByPointer(request, field.requestJsonPointer, value);
    }
  } else {
    request.custom_inputs = {
      runtime_trace: parseJsonObject(options.runtimeJson, "/custom_inputs/runtime_trace", "Runtime trace"),
      topology: parseJsonObject(options.topologyJson, "/custom_inputs/topology", "Fabric topology"),
    };
  }
  if (options.designSpaceJson.trim()) {
    const designSpace = parseJsonObject(
      options.designSpaceJson,
      "/design_space_candidates",
      "Design-space candidate manifest",
    );
    if (!validateDesignSpaceCandidates(designSpace)) {
      throw new ExperimentRequestError(
        "Design-space candidate manifest does not match tilesim.design_space.s6_candidates.v1.",
        validationPointer(validateDesignSpaceCandidates, "/design_space_candidates"),
      );
    }
    request.design_space_candidates = designSpace;
  }
  if (!validateCreateRunRequest(request)) {
    throw new ExperimentRequestError(
      "Request does not match tilesim.bridge.create_run_request.v1.",
      validationPointer(validateCreateRunRequest),
    );
  }
  return request as CreateRunRequest;
}

export function resolveExperimentErrorPointer(
  surface: ExperimentSurface,
  fieldPath: string,
): ExperimentErrorTarget | null {
  const matches = surface.controlGroups
    .flatMap((group) => group.fields)
    .filter((field) => field.requestJsonPointer === fieldPath);
  if (matches.length === 1) return { fieldPath, controlPointer: fieldPath, fieldId: matches[0].fieldId };
  if (matches.length > 1) return null;
  const exactPointers = new Set([
    "/scenario_id",
    "/fidelity_policy",
    "/gpu_participation_mode",
    "/run_name",
    "/input_mode",
  ]);
  if (exactPointers.has(fieldPath)) return { fieldPath, controlPointer: fieldPath, fieldId: null };
  for (const root of ["/custom_inputs/runtime_trace", "/custom_inputs/topology", "/design_space_candidates"]) {
    if (fieldPath === root || fieldPath.startsWith(`${root}/`)) {
      return { fieldPath, controlPointer: root, fieldId: null };
    }
  }
  return null;
}

export function buildExperimentRequestPreview(options: BuildExperimentRequestOptions): ExperimentRequestPreview {
  try {
    const request = buildExperimentRequest(options);
    return { request, text: JSON.stringify(request, null, 2), error: null };
  } catch (error) {
    const requestError =
      error instanceof ExperimentRequestError
        ? error
        : new ExperimentRequestError(error instanceof Error ? error.message : String(error), "");
    return { request: null, text: "", error: requestError };
  }
}
