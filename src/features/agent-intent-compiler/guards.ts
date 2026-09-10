import { EXPECTED_FIELD_POINTERS } from "./constants";
import { compareDecimals, parseDecimal } from "./decimal";
import type { IntentCompilerInput, IntentCompilerOutput, Phase1CapabilityFieldProjection } from "./types";
import { PHASE1_LOCAL_CONTRACT_REVISION } from "./types";

const revisionPattern = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDraftFieldValue(value: unknown): boolean {
  if (!isRecord(value) || typeof value.serialized_value !== "string") return false;
  if (value.value_type === "enum" || value.value_type === "string") return true;
  if (value.value_type === "integer" || value.value_type === "uint64") return /^\d+$/u.test(value.serialized_value);
  if (value.value_type === "decimal" || value.value_type === "number")
    return Boolean(parseDecimal(value.serialized_value));
  if (value.value_type === "boolean") return value.serialized_value === "true" || value.serialized_value === "false";
  return value.value_type === "null" && value.serialized_value === "null";
}

function isStaleState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    ["fresh", "stale"].includes(String(value.state)) &&
    [
      "none",
      "page_context_revision_changed",
      "catalog_revision_changed",
      "schema_set_revision_changed",
      "capability_snapshot_revision_changed",
    ].includes(String(value.reason)) &&
    typeof value.expected_revision === "string" &&
    typeof value.current_revision === "string"
  );
}

function isValidationIssue(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.issue_id === "string" &&
    typeof value.rule_id === "string" &&
    ["error", "warning", "info"].includes(String(value.severity)) &&
    typeof value.blocking === "boolean" &&
    ["fail", "unknown", "stale"].includes(String(value.status)) &&
    Array.isArray(value.field_ids) &&
    value.field_ids.every((fieldId) => typeof fieldId === "string") &&
    typeof value.message === "string" &&
    isRecord(value.facts) &&
    Object.values(value.facts).every((fact) => typeof fact === "string") &&
    Array.isArray(value.repair_candidates)
  );
}

function isSlot(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.field_id === null || typeof value.field_id === "string") &&
    typeof value.original_text === "string" &&
    (value.candidate_value === null || isDraftFieldValue(value.candidate_value)) &&
    (value.original_unit === null || typeof value.original_unit === "string") &&
    (value.canonical_unit === null || typeof value.canonical_unit === "string") &&
    ["required", "preferred", "maximum", "minimum", "forbidden"].includes(String(value.modality)) &&
    ["single", "range", "set"].includes(String(value.cardinality)) &&
    ["resolved", "ambiguous", "unknown", "unsupported"].includes(String(value.resolution)) &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every((alternative) => typeof alternative === "string") &&
    (value.reason_code === null || typeof value.reason_code === "string")
  );
}

function isQuestion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.question_id === "string" &&
    value.blocking === true &&
    typeof value.reason_code === "string" &&
    typeof value.prompt === "string" &&
    Array.isArray(value.field_ids) &&
    value.field_ids.every((fieldId) => typeof fieldId === "string") &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.option_id === "string" &&
        typeof option.label === "string" &&
        typeof option.serialized_value === "string",
    )
  );
}

function isUnsupportedResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.status === "unsupported" &&
    typeof value.reason_code === "string" &&
    Array.isArray(value.understood) &&
    value.understood.every((item) => typeof item === "string") &&
    Array.isArray(value.unsupported_items) &&
    value.unsupported_items.every(
      (item) =>
        isRecord(item) &&
        typeof item.text === "string" &&
        typeof item.capability === "string" &&
        (item.gap_id === null || typeof item.gap_id === "string"),
    ) &&
    Array.isArray(value.safe_next_actions) &&
    value.safe_next_actions.every((action) => typeof action === "string")
  );
}

function isDraft(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const fields = value.fields;
  const diff = value.diff;
  const validation = value.validation;
  return (
    value.contract_revision === PHASE1_LOCAL_CONTRACT_REVISION &&
    value.status === "draft" &&
    value.notice === "not_a_run" &&
    typeof value.task_summary === "string" &&
    value.target_request_identity === "tilesim.bridge.create_run_request.v1" &&
    Array.isArray(fields) &&
    fields.every(
      (field) =>
        isRecord(field) &&
        typeof field.field_id === "string" &&
        EXPECTED_FIELD_POINTERS[field.field_id as keyof typeof EXPECTED_FIELD_POINTERS] ===
          field.request_json_pointer &&
        (field.original_value === null || isDraftFieldValue(field.original_value)) &&
        isDraftFieldValue(field.proposed_value) &&
        typeof field.unit === "string" &&
        ["user", "profile", "template", "calculator", "system"].includes(String(field.value_source)) &&
        ["available", "conditional", "not_exposed", "unsupported", "unresolved_not_executed", "unavailable"].includes(
          String(field.capability_state),
        ) &&
        ["available", "conditional"].includes(String(field.capability_state)) &&
        Array.isArray(field.validation_issues) &&
        field.validation_issues.every(isValidationIssue) &&
        typeof field.catalog_revision === "string" &&
        typeof field.capability_snapshot_revision === "string" &&
        typeof field.context_revision === "string" &&
        isStaleState(field.stale),
    ) &&
    Array.isArray(diff) &&
    diff.every(
      (item) =>
        isRecord(item) &&
        typeof item.field_id === "string" &&
        EXPECTED_FIELD_POINTERS[item.field_id as keyof typeof EXPECTED_FIELD_POINTERS] === item.request_json_pointer &&
        ["add", "replace", "remove"].includes(String(item.change)) &&
        (item.original_value === null || isDraftFieldValue(item.original_value)) &&
        (item.proposed_value === null || isDraftFieldValue(item.proposed_value)) &&
        typeof item.unit === "string" &&
        ["user", "profile", "template", "calculator", "system"].includes(String(item.value_source)),
    ) &&
    isRecord(validation) &&
    ["valid", "invalid", "unknown", "stale"].includes(String(validation.overall)) &&
    Array.isArray(validation.issues) &&
    validation.issues.every(isValidationIssue) &&
    Array.isArray(value.unresolved) &&
    value.unresolved.every((item) => typeof item === "string") &&
    typeof value.catalog_revision === "string" &&
    typeof value.capability_snapshot_revision === "string" &&
    typeof value.schema_set_revision === "string" &&
    typeof value.context_revision === "string" &&
    isStaleState(value.stale)
  );
}

function validField(field: Phase1CapabilityFieldProjection): boolean {
  const expectedPointer = EXPECTED_FIELD_POINTERS[field.field_id as keyof typeof EXPECTED_FIELD_POINTERS];
  const basicShape =
    typeof expectedPointer === "string" &&
    field.request_json_pointer === expectedPointer &&
    Array.isArray(field.aliases) &&
    field.aliases.every((alias) => typeof alias === "string") &&
    ["enum", "integer", "number"].includes(field.value_type) &&
    typeof field.canonical_unit === "string" &&
    Array.isArray(field.accepted_units) &&
    Array.isArray(field.enum_values) &&
    (field.minimum === null || typeof field.minimum === "string") &&
    (field.maximum === null || typeof field.maximum === "string") &&
    typeof field.integer_only === "boolean" &&
    ["available", "conditional", "not_exposed", "unsupported", "unresolved_not_executed", "unavailable"].includes(
      field.capability_state,
    );
  if (!basicShape || !field.accepted_units.includes(field.canonical_unit)) return false;
  if (field.value_type === "enum") {
    return (
      field.enum_values.length > 0 &&
      new Set(field.enum_values).size === field.enum_values.length &&
      field.minimum === null &&
      field.maximum === null &&
      !field.integer_only
    );
  }
  if (field.enum_values.length > 0 || field.minimum === null || field.maximum === null) return false;
  if (!parseDecimal(field.minimum) || !parseDecimal(field.maximum)) return false;
  if (compareDecimals(field.minimum, field.maximum) === 1) return false;
  return field.value_type !== "integer" || field.integer_only;
}

export function validateIntentCompilerInput(input: IntentCompilerInput): string | null {
  if (
    input.contract_revision !== PHASE1_LOCAL_CONTRACT_REVISION ||
    input.context.contract_revision !== PHASE1_LOCAL_CONTRACT_REVISION
  ) {
    return "local_contract_revision_mismatch";
  }
  if (!input.instruction.trim() || Array.from(input.instruction).length > 4_000) return "instruction_length_invalid";
  if (!(["zh-CN", "en-US"] as const).includes(input.locale)) return "locale_unsupported";
  if (
    input.capability.catalog_identity !== "tilesim.bridge.agent_orchestration_capability_catalog.v1" ||
    input.capability.target_request_identity !== "tilesim.bridge.create_run_request.v1"
  ) {
    return "capability_identity_mismatch";
  }
  if (
    !revisionPattern.test(input.capability.catalog_revision) ||
    !revisionPattern.test(input.capability.capability_snapshot_revision) ||
    !revisionPattern.test(input.capability.schema_set_revision)
  ) {
    return "capability_revision_invalid";
  }
  if (
    input.capability.fields.length !== Object.keys(EXPECTED_FIELD_POINTERS).length ||
    new Set(input.capability.fields.map((field) => field.field_id)).size !== input.capability.fields.length ||
    !input.capability.fields.every(validField)
  ) {
    return "capability_projection_drift";
  }
  const aliasOwners = new Map<string, string>();
  for (const field of input.capability.fields) {
    for (const alias of field.aliases) {
      const normalizedAlias = alias.normalize("NFKC").trim().toLocaleLowerCase("en-US");
      const owner = aliasOwners.get(normalizedAlias);
      if (normalizedAlias && owner && owner !== field.field_id) return "capability_alias_ambiguous";
      if (normalizedAlias) aliasOwners.set(normalizedAlias, field.field_id);
    }
  }
  if (Object.keys(input.current_values).some((fieldId) => !(fieldId in EXPECTED_FIELD_POINTERS))) {
    return "current_values_unknown_field";
  }
  if (Object.values(input.current_values).some((value) => value !== null && !isDraftFieldValue(value))) {
    return "current_values_invalid";
  }
  if (input.context.availability === "stale") return "page_context_stale";
  if (input.context.availability !== "available") return "page_context_unavailable";
  if (
    !input.context.supported_actions.includes("configure_current_subset") ||
    !input.context.allowed_purposes.includes("draft")
  ) {
    return "page_context_draft_not_allowed";
  }
  return null;
}

export function isIntentCompilerOutput(value: unknown): value is IntentCompilerOutput {
  if (!isRecord(value)) return false;
  const output = value;
  if (output.kind === "no_op") {
    return ["configure", "capability_check"].includes(String(output.route)) && typeof output.reason_code === "string";
  }
  if (!Array.isArray(output.slots) || !output.slots.every(isSlot)) return false;
  if (output.kind === "draft") {
    return output.route === "configure" && isDraft(output.draft);
  }
  if (output.kind === "clarification") {
    return (
      ["configure", "capability_check"].includes(String(output.route)) &&
      Array.isArray(output.questions) &&
      output.questions.length >= 1 &&
      output.questions.length <= 3 &&
      output.questions.every(isQuestion)
    );
  }
  if (output.kind === "unsupported") {
    return ["unsupported", "capability_check"].includes(String(output.route)) && isUnsupportedResult(output.result);
  }
  return false;
}
