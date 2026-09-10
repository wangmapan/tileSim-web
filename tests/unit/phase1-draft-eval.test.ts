import { describe, expect, it } from "vitest";
import frozenSubsetDocument from "../fixtures/phase1-agent-orchestration/frozen-current-subset.json";
import corpusDocument from "../fixtures/phase1-agent-orchestration/intent-evaluation-corpus.json";
import {
  CURRENT_SUBSET_POINTERS,
  CURRENT_SUBSET_UNITS,
  aggregateDraftValidation,
  buildCurrentSubsetExperimentDraft,
  buildDraftField,
  buildRemovalDiff,
  compareDecimalText,
  preserveDraftFieldValue,
  resolveDraftStaleness,
  validateDraftFieldValue,
  type DeterministicValidationIssue,
  type DraftFieldValue,
  type DraftRevisionBinding,
  type DraftRevisionPair,
  type Phase1CapabilityFieldProjection,
} from "../../src/features/experiment-draft";
import { buildExperimentRequest } from "../../src/features/run-experiment";
import { auditPhase1Corpus, runCanonicalEquivalenceVectors } from "../oracles/phase1-draft-eval.mjs";

interface FrozenField {
  field_id: string;
  value_type: "enum" | "integer" | "number";
  unit: string;
  minimum?: string;
  maximum?: string;
  enum_values?: string[];
  request_json_pointer: string;
}

interface FrozenSubsetFixture {
  catalog_revision: string;
  schema_set_revision: string;
  fields: FrozenField[];
}

const frozenSubset = frozenSubsetDocument as unknown as FrozenSubsetFixture;
const baseRevision: DraftRevisionBinding = {
  catalog_revision: frozenSubset.catalog_revision,
  capability_snapshot_revision: "sha256:phase1-fixture-capability-snapshot",
  schema_set_revision: frozenSubset.schema_set_revision,
  context_revision: "context:experiment:1",
};

function revisions(current: Partial<DraftRevisionBinding> = {}): DraftRevisionPair {
  return { expected: baseRevision, current: { ...baseRevision, ...current } };
}

function descriptor(
  fieldId: string,
  capabilityState: Phase1CapabilityFieldProjection["capability_state"] = "available",
): Phase1CapabilityFieldProjection {
  const field = frozenSubset.fields.find((entry) => entry.field_id === fieldId);
  if (!field) throw new Error(`Missing frozen field: ${fieldId}`);
  return {
    field_id: field.field_id,
    aliases: [],
    value_type: field.value_type,
    canonical_unit: field.unit,
    accepted_units: [field.unit],
    request_json_pointer: field.request_json_pointer,
    enum_values: field.enum_values ?? [],
    minimum: field.minimum ?? null,
    maximum: field.maximum ?? null,
    integer_only: field.value_type === "integer",
    capability_state: capabilityState,
  } satisfies Phase1CapabilityFieldProjection;
}

function value(valueType: DraftFieldValue["value_type"], serializedValue: string): DraftFieldValue {
  return { value_type: valueType, serialized_value: serializedValue } as DraftFieldValue;
}

describe("Phase 1 draft evaluation corpus", () => {
  it("keeps 100+ stable bilingual cases in four isolated eval splits", () => {
    const result = auditPhase1Corpus(corpusDocument, frozenSubsetDocument);

    expect(result.case_count).toBe(128);
    expect(Object.values(result.split_counts).every((count) => count > 0)).toBe(true);
    expect(result.chinese).toBeGreaterThan(0);
    expect(result.english).toBeGreaterThan(0);
    expect(result.mixed).toBeGreaterThan(0);
  });

  it("calls the existing public request builder for all eight equivalence vectors", () => {
    expect(runCanonicalEquivalenceVectors(corpusDocument, frozenSubsetDocument, buildExperimentRequest)).toEqual({
      vector_count: 8,
      passed: 8,
    });
  });

  it("reports equivalence failures with stable case ID, expected, actual, and minimal reproduction", () => {
    const broken = structuredClone(corpusDocument);
    const target = broken.cases.find((entry) => entry.canonical_equivalence);
    if (!target?.canonical_equivalence) throw new Error("Expected a canonical equivalence fixture.");
    target.canonical_equivalence.expected_request.fidelity_policy = "default";

    expect(() => runCanonicalEquivalenceVectors(broken, frozenSubsetDocument, buildExperimentRequest)).toThrowError(
      expect.objectContaining({
        case_id: target.case_id,
        expected: target.canonical_equivalence.expected_request,
        minimal_reproduction: target.minimal_reproduction,
      }),
    );
  });

  it("pins the exact eight field-to-Pointer mappings", () => {
    expect(Object.entries(CURRENT_SUBSET_POINTERS)).toEqual(
      frozenSubset.fields.map((field) => [field.field_id, field.request_json_pointer]),
    );
    expect(Object.entries(CURRENT_SUBSET_UNITS)).toEqual(
      frozenSubset.fields.map((field) => [field.field_id, field.unit]),
    );
  });
});

describe("Phase 1 lossless draft values", () => {
  it("preserves uint64 values above JavaScript's safe integer exactly", () => {
    expect(preserveDraftFieldValue({ value_type: "uint64", serialized_value: "9007199254740993123" })).toEqual({
      value_type: "uint64",
      serialized_value: "9007199254740993123",
    });
    expect(preserveDraftFieldValue({ value_type: "uint64", serialized_value: "18446744073709551615" })).toEqual({
      value_type: "uint64",
      serialized_value: "18446744073709551615",
    });
    expect(() => preserveDraftFieldValue({ value_type: "uint64", serialized_value: "18446744073709551616" })).toThrow(
      "uint64",
    );
  });

  it("compares decimal boundaries without converting through Number", () => {
    expect(compareDecimalText("9007199254740993123.000", "9007199254740993123")).toBe(0);
    expect(compareDecimalText("0.049", "0.05")).toBe(-1);
    expect(compareDecimalText("2000.0001", "2000")).toBe(1);
  });

  it("keeps missing, zero, explicit null, and removal distinct", () => {
    const maxBatch = descriptor("s1.runtime.max_batch_size");
    const zeroIssues = validateDraftFieldValue(maxBatch, { value_type: "integer", serialized_value: "0" });
    const nullIssues = validateDraftFieldValue(maxBatch, { value_type: "null", serialized_value: "null" });
    const field = buildDraftField({
      descriptor: maxBatch,
      original_value: { value_type: "integer", serialized_value: "8" },
      proposed_value: { value_type: "integer", serialized_value: "16" },
      value_source: "user",
      revisions: revisions(),
    });

    expect(zeroIssues.map((entry) => entry.rule_id)).toEqual(["phase1.minimum"]);
    expect(nullIssues.map((entry) => entry.rule_id)).toEqual(["phase1.explicit_null_unsupported"]);
    expect(buildRemovalDiff(field)).toMatchObject({
      change: "remove",
      original_value: { serialized_value: "8" },
      proposed_value: null,
    });
    expect(
      buildCurrentSubsetExperimentDraft({ task_summary: "No field supplied", fields: [], revisions: revisions() }),
    ).toMatchObject({
      fields: [],
      diff: [],
      validation: { overall: "valid", issues: [] },
    });
  });
});

describe("Phase 1 deterministic validation and stale propagation", () => {
  it.each([
    ["context_revision", "context:experiment:2", "page_context_revision_changed"],
    ["catalog_revision", "sha256:catalog-new", "catalog_revision_changed"],
    ["schema_set_revision", "sha256:schema-new", "schema_set_revision_changed"],
    ["capability_snapshot_revision", "sha256:capability-new", "capability_snapshot_revision_changed"],
  ] as const)("fails closed when %s changes", (key, revision, expectedReason) => {
    expect(resolveDraftStaleness(revisions({ [key]: revision }))).toEqual({
      state: "stale",
      reason: expectedReason,
      expected_revision: baseRevision[key],
      current_revision: revision,
    });
  });

  it("aggregates a partially valid multi-field patch as invalid", () => {
    const valid = buildDraftField({
      descriptor: descriptor("s1.runtime.max_batch_size"),
      original_value: { value_type: "integer", serialized_value: "4" },
      proposed_value: { value_type: "integer", serialized_value: "8" },
      value_source: "user",
      revisions: revisions(),
    });
    const invalid = buildDraftField({
      descriptor: descriptor("s6.fabric.scale_up_bandwidth_gbps"),
      original_value: { value_type: "number", serialized_value: "400" },
      proposed_value: { value_type: "number", serialized_value: "5" },
      value_source: "user",
      revisions: revisions(),
    });
    const draft = buildCurrentSubsetExperimentDraft({
      task_summary: "Valid batch plus invalid bandwidth",
      fields: [valid, invalid],
      revisions: revisions(),
    });

    expect(valid.validation_issues).toEqual([]);
    expect(invalid.validation_issues.map((entry) => entry.rule_id)).toEqual(["phase1.minimum"]);
    expect(draft.validation.overall).toBe("invalid");
    expect(draft.notice).toBe("not_a_run");
    expect(draft.diff).toHaveLength(2);
  });

  it("propagates unsupported capability and revision stale states", () => {
    const unsupported = buildDraftField({
      descriptor: descriptor("s1.runtime.batch_scheduler", "not_exposed"),
      original_value: null,
      proposed_value: { value_type: "enum", serialized_value: "fifo" },
      value_source: "user",
      revisions: revisions({ catalog_revision: "sha256:catalog-new" }),
    });
    const draft = buildCurrentSubsetExperimentDraft({
      task_summary: "Unsupported stale field",
      fields: [unsupported],
      revisions: revisions({ catalog_revision: "sha256:catalog-new" }),
    });

    expect(unsupported.validation_issues.map((entry) => entry.rule_id)).toEqual([
      "phase1.capability_not_executable",
      "phase1.catalog_revision_changed",
    ]);
    expect(draft.validation.overall).toBe("stale");
    expect(draft.stale.reason).toBe("catalog_revision_changed");
  });

  it("fails closed for unknown fields, unsupported capability, and unit drift", () => {
    const unknown = {
      ...descriptor("s6.fabric.scale_out_bandwidth_gbps"),
      field_id: "s6.fabric.unknown_bandwidth",
      capability_state: "unsupported" as const,
      canonical_unit: "MBps",
      accepted_units: ["MBps"],
    };

    expect(validateDraftFieldValue(unknown, value("number", "100")).map((entry) => entry.rule_id)).toEqual([
      "phase1.pointer_mismatch",
      "phase1.unit_mismatch",
      "phase1.capability_not_executable",
    ]);
  });

  it("keeps not-applicable omission distinct from null and reports it as blocking", () => {
    const notApplicable: DeterministicValidationIssue = {
      issue_id: "s1.runtime.max_batch_size:phase1.not_applicable",
      rule_id: "phase1.not_applicable",
      severity: "error",
      blocking: true,
      status: "fail",
      field_ids: ["s1.runtime.max_batch_size"],
      message: "Controls are not applicable in trace-package mode.",
      facts: { input_mode: "trace_package" },
      repair_candidates: [],
    };
    const draft = buildCurrentSubsetExperimentDraft({
      task_summary: "Not applicable control",
      fields: [],
      unresolved: ["s1.runtime.max_batch_size"],
      issues: [notApplicable],
      revisions: revisions(),
    });

    expect(draft.fields).toEqual([]);
    expect(draft.unresolved).toEqual(["s1.runtime.max_batch_size"]);
    expect(draft.validation).toMatchObject({ overall: "invalid", issues: [notApplicable] });
  });

  it("does not let a warning hide an unknown or blocking failure", () => {
    const stale = resolveDraftStaleness(revisions());
    const base = {
      severity: "warning",
      field_ids: ["s1.runtime.max_batch_size"],
      message: "fixture",
      facts: {},
      repair_candidates: [],
    } as const;
    const issues: DeterministicValidationIssue[] = [
      { ...base, issue_id: "warning", rule_id: "warning", blocking: false, status: "fail" },
      { ...base, issue_id: "unknown", rule_id: "unknown", blocking: true, status: "unknown" },
    ];
    expect(aggregateDraftValidation([], issues, stale).overall).toBe("unknown");
    issues.push({ ...base, issue_id: "failure", rule_id: "failure", blocking: true, status: "fail" });
    expect(aggregateDraftValidation([], issues, stale).overall).toBe("invalid");
  });

  it("preserves exact diff values and source attribution without generating execution identities", () => {
    const field = buildDraftField({
      descriptor: descriptor("s6.fabric.scale_out_latency_us"),
      original_value: value("number", "4.0"),
      proposed_value: value("number", "4"),
      value_source: "template",
      revisions: revisions(),
    });
    const draft = buildCurrentSubsetExperimentDraft({
      task_summary: "Exact serialized diff",
      fields: [field],
      revisions: revisions(),
    });

    expect(draft.diff).toEqual([
      expect.objectContaining({
        change: "replace",
        original_value: { value_type: "number", serialized_value: "4.0" },
        proposed_value: { value_type: "number", serialized_value: "4" },
        value_source: "template",
      }),
    ]);
    expect(draft).not.toHaveProperty("digest");
    expect(draft).not.toHaveProperty("idempotency_key");
    expect(draft).not.toHaveProperty("approval");
    expect(draft).not.toHaveProperty("tool_call");
  });
});
