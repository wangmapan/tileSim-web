import {
  CREATE_RUN_REQUEST_IDENTITY,
  PHASE1_LOCAL_CONTRACT_REVISION,
  type BuildCurrentSubsetDraftInput,
  type BuildDraftFieldInput,
  type ContextStaleState,
  type CurrentSubsetExperimentDraft,
  type DeterministicValidationIssue,
  type DraftDiffItem,
  type DraftField,
  type DraftFieldValue,
  type DraftRevisionPair,
  type Phase1CapabilityFieldProjection,
} from "./types";

export const CURRENT_SUBSET_POINTERS = {
  "s0.workload.message_size_multiplier": "/overrides/workload/message_size_multiplier",
  "s1.runtime.batch_scheduler": "/overrides/runtime/batch_scheduler",
  "s1.runtime.max_batch_size": "/overrides/runtime/max_batch_size",
  "s1.runtime.kv_capacity_tokens": "/overrides/runtime/kv_capacity_tokens",
  "s6.fabric.scale_up_bandwidth_gbps": "/overrides/fabric/scale_up_bandwidth_gbps",
  "s6.fabric.scale_up_latency_us": "/overrides/fabric/scale_up_latency_us",
  "s6.fabric.scale_out_bandwidth_gbps": "/overrides/fabric/scale_out_bandwidth_gbps",
  "s6.fabric.scale_out_latency_us": "/overrides/fabric/scale_out_latency_us",
} as const;

export const CURRENT_SUBSET_UNITS = {
  "s0.workload.message_size_multiplier": "ratio",
  "s1.runtime.batch_scheduler": "scheduler_policy",
  "s1.runtime.max_batch_size": "requests_per_batch",
  "s1.runtime.kv_capacity_tokens": "tokens",
  "s6.fabric.scale_up_bandwidth_gbps": "Gbps",
  "s6.fabric.scale_up_latency_us": "us",
  "s6.fabric.scale_out_bandwidth_gbps": "Gbps",
  "s6.fabric.scale_out_latency_us": "us",
} as const;

const uint64Maximum = 18_446_744_073_709_551_615n;
const canonicalInteger = /^-?(?:0|[1-9][0-9]*)$/;
const canonicalUnsignedInteger = /^(?:0|[1-9][0-9]*)$/;
const canonicalDecimal = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function issue(
  fieldId: string,
  ruleId: string,
  message: string,
  facts: Readonly<Record<string, string>>,
  status: DeterministicValidationIssue["status"] = "fail",
): DeterministicValidationIssue {
  return {
    issue_id: `${fieldId}:${ruleId}`,
    rule_id: ruleId,
    severity: "error",
    blocking: true,
    status,
    field_ids: [fieldId],
    message,
    facts,
    repair_candidates: [],
  };
}

function assertSerializedValue(value: DraftFieldValue): void {
  const text = value.serialized_value;
  if (value.value_type === "null") {
    if (text !== "null") throw new TypeError("A null draft value must serialize exactly as null.");
    return;
  }
  if (value.value_type === "boolean") {
    if (text !== "true" && text !== "false") throw new TypeError("A boolean draft value must be true or false.");
    return;
  }
  if (value.value_type === "integer" && !canonicalInteger.test(text)) {
    throw new TypeError("An integer draft value must use canonical decimal text.");
  }
  if (value.value_type === "uint64") {
    if (!canonicalUnsignedInteger.test(text) || BigInt(text) > uint64Maximum) {
      throw new TypeError("A uint64 draft value must be lossless canonical decimal text.");
    }
  }
  if ((value.value_type === "decimal" || value.value_type === "number") && !canonicalDecimal.test(text)) {
    throw new TypeError("A decimal draft value must use finite canonical decimal text.");
  }
}

export function preserveDraftFieldValue(value: DraftFieldValue): DraftFieldValue {
  assertSerializedValue(value);
  return { ...value } as DraftFieldValue;
}

function decimalParts(text: string): { numerator: bigint; scale: number } {
  if (!canonicalDecimal.test(text)) throw new TypeError(`Invalid decimal text: ${text}`);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [integer, fraction = ""] = unsigned.split(".");
  const magnitude = BigInt(`${integer}${fraction}`);
  return { numerator: negative ? -magnitude : magnitude, scale: fraction.length };
}

export function compareDecimalText(left: string, right: string): -1 | 0 | 1 {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const scaledA = a.numerator * 10n ** BigInt(scale - a.scale);
  const scaledB = b.numerator * 10n ** BigInt(scale - b.scale);
  return scaledA < scaledB ? -1 : scaledA > scaledB ? 1 : 0;
}

export function draftValuesEqual(left: DraftFieldValue | null, right: DraftFieldValue | null): boolean {
  return left === null
    ? right === null
    : right !== null && left.value_type === right.value_type && left.serialized_value === right.serialized_value;
}

export function resolveDraftStaleness(revisions: DraftRevisionPair): ContextStaleState {
  const checks = [
    ["context_revision", "page_context_revision_changed"],
    ["catalog_revision", "catalog_revision_changed"],
    ["schema_set_revision", "schema_set_revision_changed"],
    ["capability_snapshot_revision", "capability_snapshot_revision_changed"],
  ] as const;
  for (const [key, reason] of checks) {
    if (revisions.expected[key] !== revisions.current[key]) {
      return {
        state: "stale",
        reason,
        expected_revision: revisions.expected[key],
        current_revision: revisions.current[key],
      };
    }
  }
  return {
    state: "fresh",
    reason: "none",
    expected_revision: revisions.expected.context_revision,
    current_revision: revisions.current.context_revision,
  };
}

export function validateDraftFieldValue(
  descriptor: Phase1CapabilityFieldProjection,
  proposedValue: DraftFieldValue,
): readonly DeterministicValidationIssue[] {
  const issues: DeterministicValidationIssue[] = [];
  const expectedPointer = CURRENT_SUBSET_POINTERS[descriptor.field_id as keyof typeof CURRENT_SUBSET_POINTERS];
  const expectedUnit = CURRENT_SUBSET_UNITS[descriptor.field_id as keyof typeof CURRENT_SUBSET_UNITS];
  if (!expectedPointer || descriptor.request_json_pointer !== expectedPointer) {
    issues.push(
      issue(descriptor.field_id, "phase1.pointer_mismatch", "The field is not bound to its frozen request Pointer.", {
        expected: expectedPointer ?? "unsupported_field",
        actual: descriptor.request_json_pointer,
      }),
    );
  }
  if (
    !expectedUnit ||
    descriptor.canonical_unit !== expectedUnit ||
    !descriptor.accepted_units.includes(descriptor.canonical_unit)
  ) {
    issues.push(
      issue(descriptor.field_id, "phase1.unit_mismatch", "The field is not bound to its frozen canonical unit.", {
        expected: expectedUnit ?? "unsupported_field",
        actual: descriptor.canonical_unit,
        accepted_units: descriptor.accepted_units.join(","),
      }),
    );
  }
  if (descriptor.capability_state !== "available" && descriptor.capability_state !== "conditional") {
    issues.push(
      issue(
        descriptor.field_id,
        "phase1.capability_not_executable",
        "The field is not executable in this capability snapshot.",
        {
          capability_state: descriptor.capability_state,
        },
      ),
    );
  }
  try {
    assertSerializedValue(proposedValue);
  } catch (error) {
    issues.push(
      issue(
        descriptor.field_id,
        "phase1.lossless_value_invalid",
        "The serialized value is not lossless and canonical.",
        {
          value_type: proposedValue.value_type,
          serialized_value: proposedValue.serialized_value,
          detail: error instanceof Error ? error.message : String(error),
        },
      ),
    );
    return issues;
  }
  if (proposedValue.value_type === "null") {
    issues.push(
      issue(
        descriptor.field_id,
        "phase1.explicit_null_unsupported",
        "The current create-run field does not accept null.",
        {
          serialized_value: proposedValue.serialized_value,
        },
      ),
    );
    return issues;
  }
  if (descriptor.value_type !== proposedValue.value_type) {
    issues.push(
      issue(
        descriptor.field_id,
        "phase1.value_type_mismatch",
        "The proposed value type does not match the descriptor.",
        {
          expected: descriptor.value_type,
          actual: proposedValue.value_type,
        },
      ),
    );
    return issues;
  }
  if (descriptor.value_type === "enum") {
    if (!descriptor.enum_values.includes(proposedValue.serialized_value)) {
      issues.push(
        issue(descriptor.field_id, "phase1.enum_not_allowed", "The enum value is not declared by the descriptor.", {
          actual: proposedValue.serialized_value,
          allowed: descriptor.enum_values.join(","),
        }),
      );
    }
    return issues;
  }
  if (descriptor.integer_only && !canonicalUnsignedInteger.test(proposedValue.serialized_value)) {
    issues.push(
      issue(descriptor.field_id, "phase1.integer_required", "The descriptor requires a non-negative integer.", {
        actual: proposedValue.serialized_value,
      }),
    );
    return issues;
  }
  if (descriptor.minimum !== null && compareDecimalText(proposedValue.serialized_value, descriptor.minimum) < 0) {
    issues.push(
      issue(descriptor.field_id, "phase1.minimum", "The value is below the descriptor minimum.", {
        actual: proposedValue.serialized_value,
        minimum: descriptor.minimum,
        unit: descriptor.canonical_unit,
      }),
    );
  }
  if (descriptor.maximum !== null && compareDecimalText(proposedValue.serialized_value, descriptor.maximum) > 0) {
    issues.push(
      issue(descriptor.field_id, "phase1.maximum", "The value is above the descriptor maximum.", {
        actual: proposedValue.serialized_value,
        maximum: descriptor.maximum,
        unit: descriptor.canonical_unit,
      }),
    );
  }
  return issues;
}

export function buildDraftField(input: BuildDraftFieldInput): DraftField {
  const stale = resolveDraftStaleness(input.revisions);
  const validationIssues = [...validateDraftFieldValue(input.descriptor, input.proposed_value)];
  if (stale.state === "stale") {
    validationIssues.push(
      issue(
        input.descriptor.field_id,
        `phase1.${stale.reason}`,
        "The draft field is stale against the current runtime revisions.",
        { expected: stale.expected_revision, current: stale.current_revision },
        "stale",
      ),
    );
  }
  return {
    field_id: input.descriptor.field_id,
    request_json_pointer: input.descriptor.request_json_pointer,
    original_value: input.original_value === null ? null : preserveDraftFieldValue(input.original_value),
    proposed_value: preserveDraftFieldValue(input.proposed_value),
    unit: input.descriptor.canonical_unit,
    value_source: input.value_source,
    capability_state: input.descriptor.capability_state,
    validation_issues: validationIssues,
    catalog_revision: input.revisions.expected.catalog_revision,
    capability_snapshot_revision: input.revisions.expected.capability_snapshot_revision,
    context_revision: input.revisions.expected.context_revision,
    stale,
  };
}

export function buildDraftDiff(fields: readonly DraftField[]): readonly DraftDiffItem[] {
  return fields
    .filter((field) => !draftValuesEqual(field.original_value, field.proposed_value))
    .map((field) => ({
      field_id: field.field_id,
      request_json_pointer: field.request_json_pointer,
      change: field.original_value === null ? "add" : "replace",
      original_value: field.original_value,
      proposed_value: field.proposed_value,
      unit: field.unit,
      value_source: field.value_source,
    }));
}

export function buildRemovalDiff(field: DraftField): DraftDiffItem {
  return {
    field_id: field.field_id,
    request_json_pointer: field.request_json_pointer,
    change: "remove",
    original_value: field.original_value ?? field.proposed_value,
    proposed_value: null,
    unit: field.unit,
    value_source: field.value_source,
  };
}

export function aggregateDraftValidation(
  fields: readonly DraftField[],
  additionalIssues: readonly DeterministicValidationIssue[],
  stale: ContextStaleState,
): CurrentSubsetExperimentDraft["validation"] {
  const issuesById = new Map<string, DeterministicValidationIssue>();
  for (const entry of [...fields.flatMap((field) => field.validation_issues), ...additionalIssues]) {
    if (!issuesById.has(entry.issue_id)) issuesById.set(entry.issue_id, entry);
  }
  const issues = [...issuesById.values()];
  const overall =
    stale.state === "stale" || issues.some((entry) => entry.status === "stale")
      ? "stale"
      : issues.some((entry) => entry.blocking && entry.status === "fail")
        ? "invalid"
        : issues.some((entry) => entry.blocking && entry.status === "unknown")
          ? "unknown"
          : "valid";
  return { overall, issues };
}

export function buildCurrentSubsetExperimentDraft(input: BuildCurrentSubsetDraftInput): CurrentSubsetExperimentDraft {
  const fieldIds = new Set<string>();
  const pointers = new Set<string>();
  const structuralIssues: DeterministicValidationIssue[] = [...(input.issues ?? [])];
  for (const field of input.fields) {
    if (fieldIds.has(field.field_id)) {
      structuralIssues.push(
        issue(field.field_id, "phase1.duplicate_field", "A field may appear at most once in a draft revision.", {
          field_id: field.field_id,
        }),
      );
    }
    if (pointers.has(field.request_json_pointer)) {
      structuralIssues.push(
        issue(field.field_id, "phase1.duplicate_pointer", "A request Pointer may appear at most once.", {
          request_json_pointer: field.request_json_pointer,
        }),
      );
    }
    fieldIds.add(field.field_id);
    pointers.add(field.request_json_pointer);
  }
  const stale = resolveDraftStaleness(input.revisions);
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    status: "draft",
    notice: "not_a_run",
    task_summary: input.task_summary,
    target_request_identity: CREATE_RUN_REQUEST_IDENTITY,
    fields: [...input.fields],
    diff: buildDraftDiff(input.fields),
    validation: aggregateDraftValidation(input.fields, structuralIssues, stale),
    unresolved: [...(input.unresolved ?? [])],
    catalog_revision: input.revisions.expected.catalog_revision,
    capability_snapshot_revision: input.revisions.expected.capability_snapshot_revision,
    schema_set_revision: input.revisions.expected.schema_set_revision,
    context_revision: input.revisions.expected.context_revision,
    stale,
  };
}
