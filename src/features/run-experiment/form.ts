import { createRunRequestSchema } from "../../contracts/generated/create-run-schema";
import { compatibilityControlFields } from "./surface";
import type { ExperimentFormState, ExperimentSurface, ParameterValue } from "./types";

const schemaProperties = createRunRequestSchema.properties;

export function createExperimentForm(surface?: ExperimentSurface): ExperimentFormState {
  const parameterValues: Record<string, ParameterValue> = {};
  for (const field of surface?.controlGroups.flatMap((group) => group.fields) || compatibilityControlFields) {
    parameterValues[field.fieldId] = field.explicitDefaultAvailable ? field.defaultValue : undefined;
  }
  return {
    scenario_id: surface?.scenarios[0]?.value ?? schemaProperties.scenario_id.enum[0],
    fidelity_policy: surface?.defaultFidelityPolicy ?? schemaProperties.fidelity_policy.default,
    gpu_participation_mode: surface?.defaultGpuParticipationMode ?? schemaProperties.gpu_participation_mode.default,
    run_name: "",
    parameterValues,
  };
}

export function reconcileExperimentForm(form: ExperimentFormState, surface: ExperimentSurface): void {
  if (!surface.scenarios.some((option) => option.value === form.scenario_id)) {
    form.scenario_id = surface.scenarios[0]?.value ?? "";
  }
  if (!surface.fidelityPolicies.includes(form.fidelity_policy)) {
    form.fidelity_policy = surface.defaultFidelityPolicy || surface.fidelityPolicies[0] || "";
  }
  if (!surface.gpuParticipationModes.includes(form.gpu_participation_mode)) {
    form.gpu_participation_mode = surface.defaultGpuParticipationMode;
  }
  const nextValues: Record<string, ParameterValue> = {};
  for (const field of surface.controlGroups.flatMap((group) => group.fields)) {
    nextValues[field.fieldId] = Object.hasOwn(form.parameterValues, field.fieldId)
      ? form.parameterValues[field.fieldId]
      : field.explicitDefaultAvailable
        ? field.defaultValue
        : undefined;
  }
  form.parameterValues = nextValues;
}

export function resetExperimentControls(form: ExperimentFormState, surface: ExperimentSurface): void {
  for (const field of surface.controlGroups.flatMap((group) => group.fields)) {
    form.parameterValues[field.fieldId] = field.explicitDefaultAvailable ? field.defaultValue : undefined;
  }
}
