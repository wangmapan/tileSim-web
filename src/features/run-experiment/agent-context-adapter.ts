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
  /**
   * Whether the shared Bridge/schema bootstrap has completed for this page.
   * Callers can keep the richer form context mounted while fail-closing the
   * Agent until a manifest is present.
   */
  pageAvailable?: boolean;
  pageId?: string;
  routeName?: string;
  displayLabel?: string;
}): ExperimentAgentContextPublication {
  const surfaceFields = input.surface.controlGroups.flatMap((group) => group.fields);
  const pageReady =
    input.pageAvailable !== false && input.surface.contractStatus !== "contract_error" && input.mode === "controls";
  const allAgentFieldsAvailable = PHASE1_AGENT_EXPOSED_FIELD_IDS.every(
    (fieldId) => surfaceFields.find((candidate) => candidate.fieldId === fieldId)?.available === true,
  );
  // The shared Agent may explain a partially described form, but it must not
  // advertise a draft surface when any of the frozen fields is unavailable.
  // This keeps a descriptor capability gap fail-closed instead of allowing a
  // stale capability snapshot to produce a seemingly valid draft.
  const draftAvailable = pageReady && allAgentFieldsAvailable;
  const resources = PHASE1_AGENT_EXPOSED_FIELD_IDS.map((fieldId) => {
    const field = surfaceFields.find((candidate) => candidate.fieldId === fieldId);
    return {
      resource_type: "field" as const,
      resource_id: fieldId,
      revision: input.contextRevision,
      display_label: field?.label ?? fieldId,
      // Keep the page context aligned with the descriptor, not just the
      // input mode. An unavailable/omitted field must not appear as a usable
      // Agent target even when the surrounding form is otherwise valid.
      availability: pageReady && field?.available === true ? ("available" as const) : ("unavailable" as const),
    };
  });
  const currentValues = Object.fromEntries(
    PHASE1_AGENT_EXPOSED_FIELD_IDS.map((fieldId) => [
      fieldId,
      serializeParameterValue(fieldId, input.form.parameterValues[fieldId], input.surface),
    ]),
  ) as Record<Phase1AgentExposedFieldId, DraftFieldValue | null>;
  return {
    context: {
      contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
      page_id: input.pageId || "run-experiment",
      route_name: input.routeName || "experiment",
      context_revision: input.contextRevision,
      workspace_ref: null,
      run_ref: input.runId ? { run_id: input.runId, revision: input.runId } : null,
      selected_entity: {
        entity_type: "experiment_form",
        entity_id: "current-unsaved-experiment",
        revision: input.contextRevision,
      },
      resources,
      supported_actions: draftAvailable
        ? ["explain", "configure_current_subset", "check_capability"]
        : pageReady
          ? ["explain", "check_capability"]
          : ["explain"],
      data_classification: "workspace_internal",
      allowed_purposes: draftAvailable ? ["explain", "draft"] : ["explain"],
      expires_at: null,
      display_label: draftAvailable
        ? input.displayLabel || "当前实验参数"
        : input.displayLabel
          ? `${input.displayLabel} · 当前能力不支持参数草案`
          : "当前能力不支持参数草案",
      availability: pageReady ? "available" : "unavailable",
    },
    current_values: currentValues,
  };
}
