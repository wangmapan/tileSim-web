/**
 * Deterministic clarification answer binding (WP-2C-06).
 *
 * The read-only copilot asks at most three blocking questions per turn and
 * renders one button per option. Until this module existed, clicking a button
 * only changed the status line: the answer never reached the compiler, so the
 * option had no effect. This module turns one answered option back into a new
 * `IntentCompilerInput` so `compileIntent` can be re-run on it.
 *
 * Two clarification shapes exist in the frozen Phase 1 contract and they are
 * answered differently:
 *
 * - field disambiguation (`option_id = "field:<field_id>"`,
 *   `serialized_value = <field_id>`): the question asks which field a generic
 *   term such as "带宽" refers to. A field selection cannot be expressed with
 *   `current_values`, so the canonical alias of the chosen field is written back
 *   into the original instruction, leaving every other character untouched.
 * - value clarification (`option_id = "option:<field_id>:<n>"`,
 *   `serialized_value = <candidate value>`): the question asks for one explicit
 *   value for an already identified field. The chosen candidate is materialised
 *   with the value type and canonical unit taken from the capability field
 *   projection (never guessed) and written back into that field's own clause.
 *
 * Both shapes fail closed: an answer that does not belong to the current
 * clarification block, an option that does not belong to its question, a value
 * that cannot be represented losslessly for the projected field type, or a
 * clause that cannot be located unambiguously produce an explicit failure
 * instead of a silently ignored click or a fabricated draft.
 *
 * `current_values` is carried through unchanged, for both shapes. It is the
 * baseline the draft diff is computed against (`compiler.ts:380-381`), and the
 * frozen compiler only ever hands it to `normalizeMultiplier`
 * (`normalizers.ts:402`); latency, bandwidth, integer and enum candidates are
 * normalized from the clause text alone. So writing the answered value into
 * `current_values` cannot answer a blocking question: the same question comes
 * back, and when the clause already names the value the `valuesEqual`
 * short-circuit reports `no_op / values_unchanged`. The value text therefore
 * goes into the field's own clause while `current_values` stays the baseline.
 * `tests/unit/agent-clarification-binding.test.ts` pins both halves of this.
 */
import { clauseSpanForMatch, instructionClauses } from "./clause-selection";
import { compileIntent } from "./compiler";
import { FIELD_ALIASES, type CurrentSubsetFieldId } from "./constants";
import { findAliasMatches } from "./normalizers";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  type ClarificationQuestion,
  type DraftFieldValue,
  type IntentCompilerInput,
  type IntentCompilerOutput,
  type PageContextEnvelope,
  type Phase1CapabilityFieldProjection,
  type Phase1CapabilityProjection,
} from "./types";

const fieldOptionPrefix = "field:";
const valueOptionPrefix = "option:";

const bareDecimalPattern = /^[+-]?\d+(?:\.\d+)?$/u;
const nonNegativeIntegerPattern = /^\d+$/u;
const trailingDelimiterPattern = /(?:[,，;；。]|\band\b|以及|并且)\s*$/iu;

const familyCues: readonly { suffix: string; pattern: RegExp }[] = [
  { suffix: "bandwidth_gbps", pattern: /(?:bandwidth|带宽)/iu },
  { suffix: "latency_us", pattern: /(?:latency|时延|延迟)/iu },
];

export interface ClarificationAnswer {
  question_id: string;
  option_id: string;
  serialized_value: string;
}

export interface ClarificationBindingInput {
  /** Questions of the clarification block currently rendered in the sidebar. */
  questions: readonly ClarificationQuestion[];
  answer: ClarificationAnswer;
  /** Instruction whose compilation produced the current clarification block. */
  instruction: string;
  capability: Phase1CapabilityProjection;
  current_values: Readonly<Record<string, DraftFieldValue | null>>;
  locale: "zh-CN" | "en-US";
  context: PageContextEnvelope;
}

export type ClarificationBindingFailureCode =
  | "clarification_question_not_in_block"
  | "clarification_option_not_in_question"
  | "clarification_answer_value_mismatch"
  | "clarification_option_shape_unsupported"
  | "clarification_field_not_projected"
  | "clarification_alias_unavailable"
  | "clarification_clause_not_located"
  | "clarification_clause_ambiguous"
  | "clarification_value_type_mismatch"
  | "clarification_binding_self_check_failed";

export interface ClarificationBindingFailure {
  ok: false;
  reason_code: ClarificationBindingFailureCode;
  detail: string;
}

export type ClarificationBindingResult =
  | {
      ok: true;
      shape: "field_disambiguation";
      field_id: string;
      alias: string;
      rewritten_instruction: string;
      compiler_input: IntentCompilerInput;
    }
  | {
      ok: true;
      shape: "value_clarification";
      field_id: string;
      alias: string;
      value_type: Phase1CapabilityFieldProjection["value_type"];
      canonical_unit: string;
      option_value: string;
      rewritten_instruction: string;
      compiler_input: IntentCompilerInput;
    }
  | ClarificationBindingFailure;

export type ClarificationRebindResult =
  | {
      ok: true;
      output: IntentCompilerOutput;
      instruction: string;
      field_id: string;
      shape: "field_disambiguation" | "value_clarification";
    }
  | {
      ok: false;
      code: ClarificationBindingFailureCode | "clarification_recompute_failed";
      detail: string;
    };

function failure(reason_code: ClarificationBindingFailureCode, detail: string): ClarificationBindingFailure {
  return { ok: false, reason_code, detail };
}

function tighten(text: string): string {
  return text.replace(/\s{2,}/gu, " ").trim();
}

function projectedField(
  capability: Phase1CapabilityProjection,
  fieldId: string,
): Phase1CapabilityFieldProjection | null {
  return capability.fields.find((field) => field.field_id === fieldId) ?? null;
}

/** Canonical alias, reusing the alias table that owns the matched aliases. */
function canonicalAlias(field: Phase1CapabilityFieldProjection): string | null {
  const fromTable = FIELD_ALIASES[field.field_id as CurrentSubsetFieldId] ?? [];
  const alias = [...fromTable, ...field.aliases].find((candidate) => candidate.trim().length > 0);
  return alias ? alias.trim() : null;
}

function familyCue(fieldId: string): RegExp | null {
  return familyCues.find((cue) => fieldId.endsWith(cue.suffix))?.pattern ?? null;
}

/**
 * Materialises one option value for the projected field type. Returns null when
 * the candidate cannot be represented without guessing the type or fabricating
 * a unit.
 */
function valueTextForOption(field: Phase1CapabilityFieldProjection, optionValue: string): string | null {
  const candidate = optionValue.trim();
  if (!candidate) return null;
  if (field.value_type === "enum") return candidate;
  if (field.value_type === "integer") return nonNegativeIntegerPattern.test(candidate) ? candidate : null;
  if (!/\d/u.test(candidate)) return null;
  return bareDecimalPattern.test(candidate) ? `${candidate} ${field.canonical_unit}` : candidate;
}

function parseValueOptionId(optionId: string): { fieldId: string; ordinal: string } | null {
  if (!optionId.startsWith(valueOptionPrefix)) return null;
  const rest = optionId.slice(valueOptionPrefix.length);
  const separator = rest.lastIndexOf(":");
  if (separator <= 0) return null;
  const ordinal = rest.slice(separator + 1);
  if (!nonNegativeIntegerPattern.test(ordinal)) return null;
  return { fieldId: rest.slice(0, separator), ordinal };
}

function parseFieldOptionId(optionId: string): string | null {
  if (!optionId.startsWith(fieldOptionPrefix)) return null;
  const fieldId = optionId.slice(fieldOptionPrefix.length).trim();
  return fieldId.length > 0 ? fieldId : null;
}

function compilerInputFor(input: ClarificationBindingInput, instruction: string): IntentCompilerInput {
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    instruction,
    locale: input.locale,
    capability: input.capability,
    current_values: input.current_values,
    context: input.context,
  };
}

/** The rewritten instruction must select exactly the answered field. */
function selfCheckFailure(
  input: ClarificationBindingInput,
  field: Phase1CapabilityFieldProjection,
  rewrittenInstruction: string,
): ClarificationBindingFailure | null {
  const matches = findAliasMatches(rewrittenInstruction, input.capability.fields);
  return matches.some((match) => match.fieldId === field.field_id)
    ? null
    : failure("clarification_binding_self_check_failed", "field_not_recoverable_from_rewritten_instruction");
}

function bindFieldDisambiguation(
  input: ClarificationBindingInput,
  field: Phase1CapabilityFieldProjection,
  alias: string,
): ClarificationBindingResult {
  const cue = familyCue(field.field_id);
  if (!cue) {
    return failure("clarification_option_shape_unsupported", "field_disambiguation_without_generic_family_cue");
  }
  let insertAt = 0;
  if (findAliasMatches(input.instruction, input.capability.fields).length > 0) {
    const candidates = instructionClauses(input.instruction).filter(
      (clause) =>
        clause.text.trim().length > 0 &&
        cue.test(clause.text) &&
        findAliasMatches(clause.text, input.capability.fields).length === 0,
    );
    if (!candidates.length) return failure("clarification_clause_not_located", "no_alias_free_generic_clause");
    if (candidates.length > 1) {
      return failure("clarification_clause_ambiguous", `generic_clause_count:${candidates.length}`);
    }
    const [clause] = candidates;
    insertAt = clause.start + (clause.text.length - clause.text.trimStart().length);
  }
  const rewritten = tighten(`${input.instruction.slice(0, insertAt)}${alias} ${input.instruction.slice(insertAt)}`);
  const selfCheck = selfCheckFailure(input, field, rewritten);
  if (selfCheck) return selfCheck;
  return {
    ok: true,
    shape: "field_disambiguation",
    field_id: field.field_id,
    alias,
    rewritten_instruction: rewritten,
    compiler_input: compilerInputFor(input, rewritten),
  };
}

function bindValueClarification(
  input: ClarificationBindingInput,
  field: Phase1CapabilityFieldProjection,
  alias: string,
  optionValue: string,
): ClarificationBindingResult {
  const valueText = valueTextForOption(field, optionValue);
  if (!valueText) {
    return failure("clarification_value_type_mismatch", `value_not_representable:${field.value_type}`);
  }
  const matches = findAliasMatches(input.instruction, input.capability.fields);
  const index = matches.findIndex((match) => match.fieldId === field.field_id);
  if (index < 0) return failure("clarification_clause_not_located", "field_clause_not_found");
  const span = clauseSpanForMatch(input.instruction, matches, index);
  // The replaced span may end on the delimiter that joins it to the next
  // clause; keep that delimiter so the untouched clauses stay separated.
  const removed = input.instruction.slice(span.start, span.end);
  const trailing = removed.match(trailingDelimiterPattern)?.[0] ?? "";
  const joiner = trailing && !/^[,，;；。]/u.test(trailing) ? ` ${trailing}` : trailing;
  const rewritten = tighten(
    `${input.instruction.slice(0, span.start)}${alias} = ${valueText}${joiner}${input.instruction.slice(span.end)}`,
  );
  const selfCheck = selfCheckFailure(input, field, rewritten);
  if (selfCheck) return selfCheck;
  return {
    ok: true,
    shape: "value_clarification",
    field_id: field.field_id,
    alias,
    value_type: field.value_type,
    canonical_unit: field.canonical_unit,
    option_value: optionValue,
    rewritten_instruction: rewritten,
    compiler_input: compilerInputFor(input, rewritten),
  };
}

/** Binds one answered option to a new compiler input, or fails explicitly. */
export function bindClarificationAnswer(input: ClarificationBindingInput): ClarificationBindingResult {
  const question = input.questions.find((candidate) => candidate.question_id === input.answer.question_id);
  if (!question) return failure("clarification_question_not_in_block", "question_id_not_in_current_block");
  const option = question.options.find((candidate) => candidate.option_id === input.answer.option_id);
  if (!option) return failure("clarification_option_not_in_question", "option_id_not_in_current_question");
  if (option.serialized_value !== input.answer.serialized_value) {
    return failure("clarification_answer_value_mismatch", "serialized_value_differs_from_option");
  }

  const fieldOptionId = parseFieldOptionId(input.answer.option_id);
  const valueOptionId = parseValueOptionId(input.answer.option_id);
  if (fieldOptionId && valueOptionId) {
    return failure("clarification_option_shape_unsupported", "ambiguous_option_id_shape");
  }
  if (!fieldOptionId && !valueOptionId) {
    return failure("clarification_option_shape_unsupported", "unknown_option_id_shape");
  }
  if (fieldOptionId && option.serialized_value !== fieldOptionId) {
    return failure("clarification_answer_value_mismatch", "field_option_value_differs_from_field_id");
  }

  const fieldId = fieldOptionId ?? valueOptionId!.fieldId;
  const field = projectedField(input.capability, fieldId);
  if (!field) return failure("clarification_field_not_projected", `field_not_in_projection:${fieldId}`);
  const alias = canonicalAlias(field);
  if (!alias) return failure("clarification_alias_unavailable", `no_alias_for_field:${fieldId}`);

  return fieldOptionId
    ? bindFieldDisambiguation(input, field, alias)
    : bindValueClarification(input, field, alias, option.serialized_value);
}

/**
 * Binds one answered option and re-runs the deterministic compiler on the
 * resulting input. Never returns a draft that the compiler did not produce.
 */
export function resolveClarificationAnswer(input: ClarificationBindingInput): ClarificationRebindResult {
  const binding = bindClarificationAnswer(input);
  if (!binding.ok) return { ok: false, code: binding.reason_code, detail: binding.detail };
  try {
    return {
      ok: true,
      output: compileIntent(binding.compiler_input),
      instruction: binding.rewritten_instruction,
      field_id: binding.field_id,
      shape: binding.shape,
    };
  } catch (error) {
    return {
      ok: false,
      code: "clarification_recompute_failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
