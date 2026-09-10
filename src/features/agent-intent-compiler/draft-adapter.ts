import { EXPECTED_FIELD_POINTERS } from "./constants";
import type { CurrentSubsetExperimentDraft, DraftFieldValue } from "./types";
import { PHASE1_LOCAL_CONTRACT_REVISION } from "./types";

export type ExperimentParameterValue = string | number | boolean | null | undefined;

function builderValue(value: DraftFieldValue): ExperimentParameterValue {
  if (value.value_type === "enum" || value.value_type === "string") return value.serialized_value;
  if (value.value_type === "boolean") return value.serialized_value === "true";
  if (value.value_type === "null") return null;
  const parsed = Number(value.serialized_value);
  if (!Number.isFinite(parsed)) throw new Error("draft_value_not_builder_safe");
  if (["integer", "uint64"].includes(value.value_type) && !Number.isSafeInteger(parsed)) {
    throw new Error("draft_integer_not_builder_safe");
  }
  return parsed;
}

/**
 * Pure adjacent-boundary mapping for the existing controls form. This does not
 * build or submit a create-run request.
 */
export function applyDraftToExperimentParameterValues(
  draft: CurrentSubsetExperimentDraft,
  current: Readonly<Record<string, ExperimentParameterValue>>,
): Record<string, ExperimentParameterValue> {
  if (
    draft.contract_revision !== PHASE1_LOCAL_CONTRACT_REVISION ||
    draft.target_request_identity !== "tilesim.bridge.create_run_request.v1" ||
    draft.validation.overall !== "valid" ||
    draft.stale.state !== "fresh"
  ) {
    throw new Error("draft_not_valid_or_fresh");
  }
  const next = { ...current };
  for (const field of draft.fields) {
    const expectedPointer = EXPECTED_FIELD_POINTERS[field.field_id as keyof typeof EXPECTED_FIELD_POINTERS];
    if (!expectedPointer || field.request_json_pointer !== expectedPointer)
      throw new Error("draft_field_pointer_drift");
    if (
      !["available", "conditional"].includes(field.capability_state) ||
      field.validation_issues.length > 0 ||
      field.stale.state !== "fresh" ||
      field.catalog_revision !== draft.catalog_revision ||
      field.capability_snapshot_revision !== draft.capability_snapshot_revision ||
      field.context_revision !== draft.context_revision
    ) {
      throw new Error("draft_field_not_executable");
    }
    next[field.field_id] = builderValue(field.proposed_value);
  }
  return next;
}
