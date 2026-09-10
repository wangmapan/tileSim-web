import {
  PHASE1_AGENT_EXPOSED_FIELD_IDS,
  PHASE1_LOCAL_CONTRACT_REVISION,
  type DraftFieldValue,
  type PageContextEnvelope,
  type Phase1AgentExposedFieldId,
} from "../../entities/agent-orchestration";
import type { ExperimentFormState, ExperimentInputMode, ExperimentSurface, ParameterValue } from "./types";

export interface ExperimentAgentContextPublication {
  context: PageContextEnvelope;
  current_values: Readonly<Record<Phase1AgentExposedFieldId, DraftFieldValue | null>>;
}

export type ExperimentAgentContextPublisher = (publication: ExperimentAgentContextPublication) => void;

function serializeParameterValue(
  fieldId: Phase1AgentExposedFieldId,
  value: ParameterValue,
  surface: ExperimentSurface,
): DraftFieldValue | null {
  if (value === undefined || value === null) return null;
  const descriptor = surface.controlGroups.flatMap((group) => group.fields).find((field) => field.fieldId === fieldId);
  if (!descriptor) return null;
  if (descriptor.valueType === "enum" || descriptor.valueType === "string") {
    return { value_type: "enum", serialized_value: String(value) };
  }
  const serializedValue = typeof value === "number" ? value.toString() : String(value).trim();
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(serializedValue)) return null;
  if (descriptor.valueType === "integer") {
    if (!/^-?(?:0|[1-9][0-9]*)$/.test(serializedValue)) return null;
    return { value_type: "integer", serialized_value: serializedValue };
  }
  return { value_type: "number", serialized_value: serializedValue };
}

export function buildExperimentAgentContextPublication(input: {
  form: ExperimentFormState;
  surface: ExperimentSurface;
  mode: ExperimentInputMode;
  contextRevision: string;
  runId: string | null;
}): ExperimentAgentContextPublication {
  const available = input.surface.contractStatus !== "contract_error" && input.mode === "controls";
  const resources = PHASE1_AGENT_EXPOSED_FIELD_IDS.map((fieldId) => ({
    resource_type: "field" as const,
    resource_id: fieldId,
    revision: input.contextRevision,
    display_label:
      input.surface.controlGroups.flatMap((group) => group.fields).find((field) => field.fieldId === fieldId)?.label ??
      fieldId,
    availability: available ? ("available" as const) : ("unavailable" as const),
  }));
  const currentValues = Object.fromEntries(
    PHASE1_AGENT_EXPOSED_FIELD_IDS.map((fieldId) => [
      fieldId,
      serializeParameterValue(fieldId, input.form.parameterValues[fieldId], input.surface),
    ]),
  ) as Record<Phase1AgentExposedFieldId, DraftFieldValue | null>;
  return {
    context: {
      contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
      page_id: "run-experiment",
      route_name: "experiment",
      context_revision: input.contextRevision,
      workspace_ref: null,
      run_ref: input.runId ? { run_id: input.runId, revision: input.runId } : null,
      selected_entity: {
        entity_type: "experiment_form",
        entity_id: "current-unsaved-experiment",
        revision: input.contextRevision,
      },
      resources,
      supported_actions: available ? ["explain", "configure_current_subset", "check_capability"] : ["explain"],
      data_classification: "workspace_internal",
      allowed_purposes: available ? ["explain", "draft"] : ["explain"],
      expires_at: null,
      display_label: available ? "当前实验参数" : "当前实验输入模式不支持参数草案",
      availability: available ? "available" : "unavailable",
    },
    current_values: currentValues,
  };
}
