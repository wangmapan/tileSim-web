import { EXPECTED_FIELD_POINTERS, UNSUPPORTED_CAPABILITIES } from "./constants";
import { validateIntentCompilerInput } from "./guards";
import { findAliasMatches, normalizeCandidate, validateCandidate, type AliasMatch } from "./normalizers";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  type ClarificationQuestion,
  type CurrentSubsetExperimentDraft,
  type DeterministicValidationIssue,
  type DraftFieldValue,
  type IntentCompilerInput,
  type IntentCompilerOutput,
  type IntentSlot,
  type UnsupportedCapabilityResult,
} from "./types";

function capabilityCheckRoute(instruction: string): boolean {
  return /(?:can\s+i|is\s+.+supported|why\s+.+unavailable|capabilit|支持|能否|可否|为什么.*不可用)/iu.test(instruction);
}

function unsupportedResult(
  reasonCode: string,
  items: UnsupportedCapabilityResult["unsupported_items"],
  understood: readonly string[],
): UnsupportedCapabilityResult {
  return {
    status: "unsupported",
    reason_code: reasonCode,
    understood,
    unsupported_items: items,
    safe_next_actions: [
      "Limit the request to the published eight-field create-run subset.",
      "Inspect the capability catalog reason and the owning Gap before expanding scope.",
    ],
  };
}

function invalidInputOutput(reasonCode: string): IntentCompilerOutput {
  const contextProblem = reasonCode.startsWith("page_context_");
  return {
    kind: "unsupported",
    route: "capability_check",
    slots: [],
    result: unsupportedResult(
      contextProblem ? reasonCode : "compiler_input_fail_closed",
      [{ text: reasonCode, capability: "phase1_compiler_input", gap_id: null }],
      [],
    ),
  };
}

function clauseForMatch(instruction: string, matches: readonly AliasMatch[], index: number): string {
  const match = matches[index];
  const previousEnd = index === 0 ? 0 : matches[index - 1].end;
  const nextStart = index + 1 < matches.length ? matches[index + 1].start : instruction.length;
  const prefix = instruction.slice(Math.max(previousEnd, match.start - 24), match.start);
  const meaningfulPrefix =
    /(?:不要|不得|禁止|至少|至多|最大|最小|do\s+not|don't|without|at\s+(?:least|most)|min|max)/iu.test(prefix)
      ? prefix
      : "";
  return `${meaningfulPrefix}${instruction.slice(match.start, nextStart)}`
    .replace(/(?:\band\b|以及|并且)\s*$/iu, "")
    .trim();
}

function unsupportedItems(instruction: string) {
  return UNSUPPORTED_CAPABILITIES.flatMap((entry) => {
    const match = instruction.match(entry.pattern);
    return match ? [{ text: match[0], capability: entry.capability, gap_id: entry.gap_id }] : [];
  });
}

function unknownConfigurationClauses(
  instruction: string,
  fields: IntentCompilerInput["capability"]["fields"],
): string[] {
  return instruction
    .split(/[,，;；。]|\band\b|以及|并且/iu)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .filter((clause) => /\d/u.test(clause))
    .filter((clause) => findAliasMatches(clause, fields).length === 0)
    .filter((clause) => unsupportedItems(clause).length === 0);
}

function genericAmbiguity(
  instruction: string,
  fields: IntentCompilerInput["capability"]["fields"],
): IntentCompilerOutput | null {
  const directional = /(?:scale[- ]?(?:up|out)|纵向|横向)/iu.test(instruction);
  const genericBandwidth = /(?:bandwidth|带宽)/iu.test(instruction);
  const genericLatency = /(?:latency|时延|延迟)/iu.test(instruction);
  if (directional || (!genericBandwidth && !genericLatency)) return null;
  const candidateFields = fields.filter((field) =>
    genericBandwidth ? field.field_id.endsWith("bandwidth_gbps") : field.field_id.endsWith("latency_us"),
  );
  const reasonCode = genericBandwidth ? "ambiguous_network_direction_unit_or_scope" : "ambiguous_network_direction";
  const slot: IntentSlot = {
    field_id: null,
    original_text: instruction.trim(),
    candidate_value: null,
    original_unit: null,
    canonical_unit: null,
    modality: "required",
    cardinality: "single",
    resolution: "ambiguous",
    alternatives: candidateFields.map((field) => field.field_id),
    reason_code: reasonCode,
  };
  return {
    kind: "clarification",
    route: "configure",
    slots: [slot],
    questions: [
      {
        question_id: `clarify:${reasonCode}`,
        blocking: true,
        reason_code: reasonCode,
        prompt: genericBandwidth
          ? "请明确纵向或横向扩展网络，并说明 bit/byte 与 per-link/aggregate。"
          : "请明确这是纵向还是横向扩展网络时延。",
        field_ids: candidateFields.map((field) => field.field_id),
        options: candidateFields.map((field) => ({
          option_id: `field:${field.field_id}`,
          label: field.field_id,
          serialized_value: field.field_id,
        })),
      },
    ],
  };
}

function clarificationQuestion(
  input: IntentCompilerInput,
  slot: IntentSlot,
  reasonCode: string,
  options: readonly { label: string; value: string }[],
): ClarificationQuestion {
  const promptByReason: Record<string, readonly [string, string]> = {
    ambiguous_bandwidth_unit_or_scope: [
      "请明确带宽是 bit/s 还是 byte/s，以及 per-link 还是 aggregate。",
      "Specify bit/s versus byte/s and per-link versus aggregate bandwidth.",
    ],
    range_requires_single_value: [
      "当前字段需要单值；请选择范围中的明确值。",
      "This field needs one value; choose an explicit point.",
    ],
    negated_enum_requires_replacement: [
      "否定当前枚举后，请选择明确替代值。",
      "Choose an explicit replacement for the negated enum.",
    ],
    negated_numeric_value_requires_replacement: ["请给出明确替代数值。", "Provide an explicit replacement value."],
    numeric_value_missing: ["请给出明确数值和单位。", "Provide an explicit value and unit."],
    integer_value_missing: ["请给出明确整数。", "Provide an explicit integer."],
    integer_value_invalid: ["请给出无损可解释的非负整数。", "Provide an exact non-negative integer."],
    enum_value_missing_or_unknown: ["请选择目录声明的调度策略。", "Choose a scheduler policy declared by the catalog."],
    latency_value_or_unit_missing: [
      "请给出明确时延及 ps/ns/us/ms/s 单位。",
      "Provide latency with ps/ns/us/ms/s units.",
    ],
  };
  const prompt = promptByReason[reasonCode]?.[input.locale === "zh-CN" ? 0 : 1] ?? "请补充该字段的明确值。";
  return {
    question_id: `clarify:${slot.field_id ?? "unknown"}:${reasonCode}`,
    blocking: true,
    reason_code: reasonCode,
    prompt,
    field_ids: slot.field_id ? [slot.field_id] : [],
    options: options.slice(0, 4).map((option, index) => ({
      option_id: `option:${slot.field_id ?? "unknown"}:${index + 1}`,
      label: option.label,
      serialized_value: option.value,
    })),
  };
}

function staleState(revision: string) {
  return { state: "fresh" as const, reason: "none" as const, expected_revision: revision, current_revision: revision };
}

function valuesEqual(left: DraftFieldValue | null, right: DraftFieldValue): boolean {
  return left?.value_type === right.value_type && left.serialized_value === right.serialized_value;
}

export function compileIntent(input: IntentCompilerInput): IntentCompilerOutput {
  const inputError = validateIntentCompilerInput(input);
  if (inputError) return invalidInputOutput(inputError);
  if (
    /(?:\/overrides\/|request_json_pointer|__proto__|constructor\s*[:=]|schema_identity\s*[:=]|```|\{\s*")/iu.test(
      input.instruction,
    )
  ) {
    return {
      kind: "unsupported",
      route: "unsupported",
      slots: [],
      result: unsupportedResult(
        "schema_breakout_rejected",
        [{ text: "structured control injection", capability: "arbitrary_contract_field", gap_id: null }],
        [],
      ),
    };
  }

  const matches = findAliasMatches(input.instruction, input.capability.fields);
  const generic = matches.length === 0 ? genericAmbiguity(input.instruction, input.capability.fields) : null;
  if (generic) return generic;

  const unsupported = unsupportedItems(input.instruction);
  const route = capabilityCheckRoute(input.instruction) ? "capability_check" : "unsupported";
  if (unsupported.length) {
    return {
      kind: "unsupported",
      route,
      slots: matches.map((match) => ({
        field_id: match.fieldId,
        original_text: match.alias,
        candidate_value: null,
        original_unit: null,
        canonical_unit: match.field.canonical_unit,
        modality: "required",
        cardinality: "single",
        resolution: "unsupported",
        alternatives: [],
        reason_code: "mixed_request_contains_unsupported_capability",
      })),
      result: unsupportedResult(
        "unsupported_capability",
        unsupported,
        matches.map((match) => match.fieldId),
      ),
    };
  }

  const normalized = matches.map((match, index) =>
    normalizeCandidate(match, clauseForMatch(input.instruction, matches, index), input.current_values[match.fieldId]),
  );
  const blockedCapability = matches.filter(
    (match) => !["available", "conditional"].includes(match.field.capability_state),
  );
  if (blockedCapability.length) {
    const blockedIds = new Set(blockedCapability.map((match) => match.fieldId));
    return {
      kind: "unsupported",
      route: capabilityCheckRoute(input.instruction) ? "capability_check" : "unsupported",
      slots: normalized.map(({ slot }) =>
        blockedIds.has(slot.field_id as never)
          ? {
              ...slot,
              candidate_value: null,
              resolution: "unsupported" as const,
              reason_code: "field_not_agent_exposed",
            }
          : slot,
      ),
      result: unsupportedResult(
        "field_not_agent_exposed",
        blockedCapability.map((match) => ({
          text: match.alias,
          capability: match.fieldId,
          gap_id: null,
        })),
        matches.filter((match) => !blockedIds.has(match.fieldId)).map((match) => match.fieldId),
      ),
    };
  }

  const mixedGenericAmbiguity = input.instruction
    .split(/[,，;；。]|\band\b|以及|并且/iu)
    .map((clause) => clause.trim())
    .filter((clause) => clause && findAliasMatches(clause, input.capability.fields).length === 0)
    .map((clause) => genericAmbiguity(clause, input.capability.fields))
    .find((output) => output?.kind === "clarification");
  if (mixedGenericAmbiguity?.kind === "clarification") {
    return {
      ...mixedGenericAmbiguity,
      slots: [...normalized.map((candidate) => candidate.slot), ...mixedGenericAmbiguity.slots],
    };
  }

  const unknown = unknownConfigurationClauses(input.instruction, input.capability.fields);
  if (unknown.length) {
    return {
      kind: "unsupported",
      route: capabilityCheckRoute(input.instruction) ? "capability_check" : "unsupported",
      slots: [
        ...matches.map((match) => ({
          field_id: match.fieldId,
          original_text: match.alias,
          candidate_value: null,
          original_unit: null,
          canonical_unit: match.field.canonical_unit,
          modality: "required" as const,
          cardinality: "single" as const,
          resolution: "unknown" as const,
          alternatives: [],
          reason_code: "mixed_request_contains_unknown_field",
        })),
        {
          field_id: null,
          original_text: unknown[0],
          candidate_value: null,
          original_unit: null,
          canonical_unit: null,
          modality: "required" as const,
          cardinality: "single" as const,
          resolution: "unknown" as const,
          alternatives: [],
          reason_code: "unknown_field",
        },
      ],
      result: unsupportedResult(
        "unknown_field",
        unknown.map((text) => ({ text, capability: "unknown", gap_id: null })),
        matches.map((match) => match.fieldId),
      ),
    };
  }

  if (!matches.length) {
    if (/(?:set|change|replace|configure|设置|改成|替换|配置)/iu.test(input.instruction)) {
      return {
        kind: "unsupported",
        route: capabilityCheckRoute(input.instruction) ? "capability_check" : "unsupported",
        slots: [
          {
            field_id: null,
            original_text: input.instruction.trim(),
            candidate_value: null,
            original_unit: null,
            canonical_unit: null,
            modality: "required",
            cardinality: "single",
            resolution: "unknown",
            alternatives: [],
            reason_code: "unknown_field",
          },
        ],
        result: unsupportedResult(
          "unknown_field",
          [{ text: "unknown field", capability: "unknown", gap_id: null }],
          [],
        ),
      };
    }
    return {
      kind: "no_op",
      route: capabilityCheckRoute(input.instruction) ? "capability_check" : "configure",
      reason_code: "no_supported_field_change",
    };
  }

  const questions = normalized
    .filter((candidate) => candidate.issue?.kind === "clarification")
    .slice(0, 3)
    .map((candidate) => {
      const issue = candidate.issue as Extract<NonNullable<typeof candidate.issue>, { kind: "clarification" }>;
      return clarificationQuestion(input, candidate.slot, issue.reasonCode, issue.options);
    });
  if (questions.length) {
    return {
      kind: "clarification",
      route: "configure",
      slots: normalized.map((candidate) => candidate.slot),
      questions: questions as [ClarificationQuestion, ...ClarificationQuestion[]],
    };
  }

  const fields = normalized.flatMap((candidate, index) => {
    const value = candidate.slot.candidate_value;
    if (!value || !candidate.slot.field_id) return [];
    const match = matches[index];
    const validation = validateCandidate(match.field, value);
    const validationIssues: DeterministicValidationIssue[] = validation
      ? [
          {
            issue_id: `issue:${match.fieldId}:${validation.reasonCode}`,
            rule_id: `phase1.current_subset.${validation.reasonCode}.v1`,
            severity: "error",
            blocking: true,
            status: "fail",
            field_ids: [match.fieldId],
            message: validation.message,
            facts: {
              actual: value.serialized_value,
              minimum: match.field.minimum ?? "none",
              maximum: match.field.maximum ?? "none",
              canonical_unit: match.field.canonical_unit,
            },
            repair_candidates: [],
          },
        ]
      : [];
    const original = input.current_values[match.fieldId] ?? null;
    if (!validation && valuesEqual(original, value)) return [];
    return [
      {
        field_id: match.fieldId,
        request_json_pointer: EXPECTED_FIELD_POINTERS[match.fieldId],
        original_value: original,
        proposed_value: value,
        unit: match.field.canonical_unit,
        value_source: "user" as const,
        capability_state: match.field.capability_state,
        validation_issues: validationIssues,
        catalog_revision: input.capability.catalog_revision,
        capability_snapshot_revision: input.capability.capability_snapshot_revision,
        context_revision: input.context.context_revision,
        stale: staleState(input.context.context_revision),
      },
    ];
  });
  if (!fields.length) return { kind: "no_op", route: "configure", reason_code: "values_unchanged" };
  const validationIssues = fields.flatMap((field) => field.validation_issues);
  const draft: CurrentSubsetExperimentDraft = {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    status: "draft",
    notice: "not_a_run",
    task_summary:
      input.locale === "zh-CN" ? `更新 ${fields.length} 个当前支持参数` : `Update ${fields.length} supported field(s)`,
    target_request_identity: "tilesim.bridge.create_run_request.v1",
    fields,
    diff: fields.map((field) => ({
      field_id: field.field_id,
      request_json_pointer: field.request_json_pointer,
      change: field.original_value === null ? ("add" as const) : ("replace" as const),
      original_value: field.original_value,
      proposed_value: field.proposed_value,
      unit: field.unit,
      value_source: field.value_source,
    })),
    validation: { overall: validationIssues.length ? "invalid" : "valid", issues: validationIssues },
    unresolved: validationIssues.flatMap((issue) => issue.field_ids),
    catalog_revision: input.capability.catalog_revision,
    capability_snapshot_revision: input.capability.capability_snapshot_revision,
    schema_set_revision: input.capability.schema_set_revision,
    context_revision: input.context.context_revision,
    stale: staleState(input.context.context_revision),
  };
  return { kind: "draft", route: "configure", slots: normalized.map((candidate) => candidate.slot), draft };
}
