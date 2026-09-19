// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  bindClarificationAnswer,
  compileIntent,
  resolveClarificationAnswer,
  type ClarificationBindingInput,
  type IntentCompilerInput,
  type Phase1CapabilityFieldProjection,
} from "../../src/features/agent-intent-compiler";
import type { DraftFieldValue } from "../../src/entities/agent-orchestration";

interface FrozenFixture {
  catalog_revision: string;
  schema_set_revision: string;
  target_request_identity: "tilesim.bridge.create_run_request.v1";
  fields: Array<{
    field_id: string;
    value_type: "enum" | "integer" | "number";
    unit: string;
    minimum?: string;
    maximum?: string;
    enum_values?: string[];
    request_json_pointer: string;
  }>;
}

const frozenFixture = JSON.parse(
  readFileSync(resolve("tests/fixtures/phase1-agent-orchestration/frozen-current-subset.json"), "utf8"),
) as FrozenFixture;
const snapshotRevision = `sha256:${"5".repeat(64)}`;

function projectedField(field: FrozenFixture["fields"][number]): Phase1CapabilityFieldProjection {
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
    capability_state: "available",
  };
}

const currentValues: Record<string, DraftFieldValue> = {
  "s0.workload.message_size_multiplier": { value_type: "number", serialized_value: "1" },
  "s1.runtime.batch_scheduler": { value_type: "enum", serialized_value: "decode_priority" },
  "s1.runtime.max_batch_size": { value_type: "integer", serialized_value: "2" },
  "s1.runtime.kv_capacity_tokens": { value_type: "integer", serialized_value: "4096" },
  "s6.fabric.scale_up_bandwidth_gbps": { value_type: "number", serialized_value: "450" },
  "s6.fabric.scale_up_latency_us": { value_type: "number", serialized_value: "0.8" },
  "s6.fabric.scale_out_bandwidth_gbps": { value_type: "number", serialized_value: "200" },
  "s6.fabric.scale_out_latency_us": { value_type: "number", serialized_value: "4" },
};

/**
 * Baseline used by the enum case: the user rejects FIFO, so FIFO is what the
 * workspace currently holds. Answering with the already-active value would make
 * the compiler short-circuit to `no_op` (`values_unchanged`) instead of a draft.
 */
const schedulerBaseline: Record<string, DraftFieldValue> = {
  ...currentValues,
  "s1.runtime.batch_scheduler": { value_type: "enum", serialized_value: "fifo" },
};

function compilerInput(
  instruction: string,
  locale: "zh-CN" | "en-US" = "zh-CN",
  values: Record<string, DraftFieldValue> = currentValues,
): IntentCompilerInput {
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    instruction,
    locale,
    capability: {
      catalog_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1",
      catalog_revision: frozenFixture.catalog_revision,
      capability_snapshot_revision: snapshotRevision,
      schema_set_revision: frozenFixture.schema_set_revision,
      target_request_identity: frozenFixture.target_request_identity,
      fields: frozenFixture.fields.map(projectedField),
    },
    current_values: structuredClone(values),
    context: {
      contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
      page_id: "run-experiment",
      route_name: "experiment",
      context_revision: "context:phase1:1",
      workspace_ref: "workspace:local",
      run_ref: null,
      selected_entity: null,
      resources: [],
      supported_actions: ["explain", "configure_current_subset", "check_capability"],
      data_classification: "workspace_internal",
      allowed_purposes: ["explain", "draft"],
      expires_at: null,
      display_label: "实验配置",
      availability: "available",
    },
  };
}

/**
 * Compiles `instruction`, then builds the binding input for the question that
 * owns `optionId` exactly the way `src/App.vue` does.
 */
function bindingFor(
  instruction: string,
  optionId: string,
  locale: "zh-CN" | "en-US" = "zh-CN",
  values: Record<string, DraftFieldValue> = currentValues,
) {
  const compilerInputValue = compilerInput(instruction, locale, values);
  const output = compileIntent(compilerInputValue);
  if (output.kind !== "clarification") throw new Error(`Expected clarification, received ${output.kind}`);
  const question = output.questions.find((candidate) =>
    candidate.options.some((option) => option.option_id === optionId),
  );
  if (!question) throw new Error(`No question owns option ${optionId}`);
  const option = question.options.find((candidate) => candidate.option_id === optionId)!;
  const bindingInput: ClarificationBindingInput = {
    questions: output.questions,
    answer: {
      question_id: question.question_id,
      option_id: option.option_id,
      serialized_value: option.serialized_value,
    },
    instruction: compilerInputValue.instruction,
    capability: compilerInputValue.capability,
    current_values: compilerInputValue.current_values,
    locale,
    context: compilerInputValue.context,
  };
  return { bindingInput, question, option, output };
}

const sourceFiles = ["clarification-binding.ts", "clause-selection.ts", "compiler.ts", "normalizers.ts"];

describe("clarification answer binding: field disambiguation", () => {
  it("writes the canonical alias of the chosen field back without touching the rest of the instruction", () => {
    const { bindingInput } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_up_bandwidth_gbps");
    const result = bindClarificationAnswer(bindingInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shape).toBe("field_disambiguation");
    expect(result.field_id).toBe("s6.fabric.scale_up_bandwidth_gbps");
    expect(result.alias).toBe("scale-up bandwidth");
    expect(result.rewritten_instruction).toBe("scale-up bandwidth 带宽设置为 100G");
  });

  it("recompiles the alias-bound instruction into the next blocking question instead of a draft", () => {
    const { bindingInput } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_out_bandwidth_gbps");
    const rebound = resolveClarificationAnswer(bindingInput);

    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(rebound.instruction).toContain("scale-out bandwidth");
    expect(rebound.output.kind).toBe("clarification");
    if (rebound.output.kind !== "clarification") return;
    expect(rebound.output.questions[0]).toMatchObject({
      reason_code: "ambiguous_bandwidth_unit_or_scope",
      field_ids: ["s6.fabric.scale_out_bandwidth_gbps"],
    });
    expect("draft" in rebound.output).toBe(false);
  });

  it("keeps the other clauses of a mixed instruction untouched", () => {
    const { bindingInput } = bindingFor(
      "最大 batch 设为 8，并把带宽设为 100G",
      "field:s6.fabric.scale_out_bandwidth_gbps",
    );
    const result = bindClarificationAnswer(bindingInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rewritten_instruction).toContain("最大 batch 设为 8");
    expect(result.rewritten_instruction).toContain("并把带宽设为 100G");

    const rebound = resolveClarificationAnswer(bindingInput);
    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "clarification") throw new Error("Expected clarification");
    expect(rebound.output.questions[0].field_ids).toEqual(["s6.fabric.scale_out_bandwidth_gbps"]);
    expect(rebound.output.slots.find((slot) => slot.field_id === "s1.runtime.max_batch_size")?.candidate_value).toEqual(
      { value_type: "integer", serialized_value: "8" },
    );
  });
});

describe("clarification answer binding: value clarification", () => {
  it("binds a range answer through the projected value type and the current_values baseline", () => {
    const { bindingInput } = bindingFor("横向扩展时延设置为 1 到 3 us", "option:s6.fabric.scale_out_latency_us:2");
    const result = bindClarificationAnswer(bindingInput);

    expect(result.ok).toBe(true);
    if (!result.ok || result.shape !== "value_clarification") throw new Error("Expected a value clarification binding");
    expect(result.field_id).toBe("s6.fabric.scale_out_latency_us");
    expect(result.value_type).toBe("number");
    expect(result.canonical_unit).toBe("us");
    expect(result.option_value).toBe("3");
    expect(result.rewritten_instruction).toBe("scale-out latency = 3 us");
    expect(result.compiler_input.current_values).toBe(bindingInput.current_values);

    const rebound = resolveClarificationAnswer(bindingInput);
    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "draft") throw new Error("Expected a draft");
    expect(rebound.output.draft.fields[0]).toMatchObject({
      field_id: "s6.fabric.scale_out_latency_us",
      proposed_value: { value_type: "number", serialized_value: "3" },
      original_value: { value_type: "number", serialized_value: "4" },
      value_source: "user",
    });
    expect(rebound.output.draft.validation.overall).toBe("valid");
  });

  it("drops the negated cue when a replacement enum value is selected", () => {
    const { bindingInput } = bindingFor(
      "不要使用 FIFO batch scheduler",
      "option:s1.runtime.batch_scheduler:1",
      "zh-CN",
      schedulerBaseline,
    );
    const result = bindClarificationAnswer(bindingInput);

    expect(result.ok).toBe(true);
    if (!result.ok || result.shape !== "value_clarification") throw new Error("Expected a value clarification binding");
    expect(result.value_type).toBe("enum");
    // The enum projection never gains a unit suffix: value_type drives serialization.
    expect(result.rewritten_instruction).toBe("batch scheduler = decode_priority");
    expect(result.canonical_unit).toBe("scheduler_policy");

    const rebound = resolveClarificationAnswer(bindingInput);
    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "draft") throw new Error("Expected a draft");
    expect(rebound.output.draft.fields[0]).toMatchObject({
      field_id: "s1.runtime.batch_scheduler",
      original_value: { value_type: "enum", serialized_value: "fifo" },
      proposed_value: { value_type: "enum", serialized_value: "decode_priority" },
      value_source: "user",
    });
    expect(rebound.output.draft.validation.overall).toBe("valid");
  });

  it("binds a unit-bearing bandwidth candidate without reinterpreting its unit", () => {
    const { bindingInput } = bindingFor(
      "scale-up bandwidth 改成 100G",
      "option:s6.fabric.scale_up_bandwidth_gbps:1",
      "en-US",
    );
    const rebound = resolveClarificationAnswer(bindingInput);

    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "draft") throw new Error("Expected a draft");
    expect(rebound.instruction).toBe("scale-up bandwidth = 100 Gbps per-link");
    expect(rebound.output.draft.fields[0].proposed_value).toEqual({ value_type: "number", serialized_value: "100" });
  });

  it("answers one blocking question while the other one stays open", () => {
    const { bindingInput } = bindingFor(
      "最大 batch 设为 1-2，横向扩展时延设置为 1 到 3 us",
      "option:s1.runtime.max_batch_size:2",
    );
    const rebound = resolveClarificationAnswer(bindingInput);

    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "clarification") throw new Error("Expected clarification");
    expect(rebound.output.questions).toHaveLength(1);
    expect(rebound.output.questions[0].field_ids).toEqual(["s6.fabric.scale_out_latency_us"]);
  });

  it("rewrites the field clause because current_values cannot carry the answer", () => {
    // `current_values` is the baseline the draft diff is computed against
    // (`compiler.ts:380-381`) and is only forwarded to `normalizeMultiplier`
    // (`normalizers.ts:402`). Latency, bandwidth, integer and enum candidates are
    // normalized from the clause text alone, so writing the answered value into
    // `current_values` leaves the blocking question exactly as it was.
    const instruction = "横向扩展时延设置为 1 到 3 us";
    const answered: Record<string, DraftFieldValue> = {
      ...currentValues,
      "s6.fabric.scale_out_latency_us": { value_type: "number", serialized_value: "3" },
    };
    const unchanged = compileIntent(compilerInput(instruction, "zh-CN", answered));

    expect(unchanged.kind).toBe("clarification");
    if (unchanged.kind !== "clarification") return;
    expect(unchanged.questions[0]).toMatchObject({
      reason_code: "range_requires_single_value",
      field_ids: ["s6.fabric.scale_out_latency_us"],
    });

    // Rewriting the clause the compiler actually reads does close the loop, and
    // the answered value still needs the projected type to be serialised.
    const rebound = resolveClarificationAnswer(
      bindingFor(instruction, "option:s6.fabric.scale_out_latency_us:2").bindingInput,
    );
    expect(rebound.ok).toBe(true);
    if (!rebound.ok || rebound.output.kind !== "draft") throw new Error("Expected a draft");
    expect(rebound.instruction).toBe("scale-out latency = 3 us");
    expect(rebound.output.draft.fields[0].proposed_value).toEqual({ value_type: "number", serialized_value: "3" });
  });
});

describe("clarification answer binding: explicit rejection", () => {
  it("rejects answers whose question or option does not belong to the current block", () => {
    const { bindingInput, option } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_up_bandwidth_gbps");

    expect(
      bindClarificationAnswer({
        ...bindingInput,
        answer: { ...bindingInput.answer, question_id: "clarify:not-in-block" },
      }),
    ).toMatchObject({ ok: false, reason_code: "clarification_question_not_in_block" });
    // Membership is validated before the option id is parsed: a field-shaped id
    // that the current question does not offer is still "not in question".
    expect(
      bindClarificationAnswer({
        ...bindingInput,
        answer: {
          question_id: bindingInput.answer.question_id,
          option_id: "field:s1.runtime.max_batch_size",
          serialized_value: "s1.runtime.max_batch_size",
        },
      }),
    ).toMatchObject({ ok: false, reason_code: "clarification_option_not_in_question" });
    expect(
      bindClarificationAnswer({ ...bindingInput, answer: { ...bindingInput.answer, option_id: "unit:gbps" } }),
    ).toMatchObject({ ok: false, reason_code: "clarification_option_not_in_question" });
    expect(
      bindClarificationAnswer({
        ...bindingInput,
        answer: { ...bindingInput.answer, serialized_value: `${option.serialized_value}-tampered` },
      }),
    ).toMatchObject({ ok: false, reason_code: "clarification_answer_value_mismatch" });
  });

  it("rejects an option the question really offers but whose id shape is unknown", () => {
    const { bindingInput } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_up_bandwidth_gbps");
    const unknownShape: ClarificationBindingInput = {
      ...bindingInput,
      questions: [
        {
          question_id: "clarify:unknown-shape",
          blocking: true,
          reason_code: "ambiguous_network_direction_unit_or_scope",
          prompt: "forged",
          field_ids: ["s6.fabric.scale_up_bandwidth_gbps"],
          options: [{ option_id: "unit:gbps", label: "gbps", serialized_value: "gbps" }],
        },
      ],
      answer: { question_id: "clarify:unknown-shape", option_id: "unit:gbps", serialized_value: "gbps" },
    };

    expect(bindClarificationAnswer(unknownShape)).toMatchObject({
      ok: false,
      reason_code: "clarification_option_shape_unsupported",
    });
  });

  it("refuses a field option whose serialized value is a different field", () => {
    const { bindingInput } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_up_bandwidth_gbps");
    const forged: ClarificationBindingInput = {
      ...bindingInput,
      questions: [
        {
          question_id: "clarify:forged",
          blocking: true,
          reason_code: "ambiguous_network_direction_unit_or_scope",
          prompt: "forged",
          field_ids: ["s6.fabric.scale_up_bandwidth_gbps"],
          options: [
            {
              option_id: "field:s6.fabric.scale_up_bandwidth_gbps",
              label: "forged",
              serialized_value: "s6.fabric.scale_out_bandwidth_gbps",
            },
          ],
        },
      ],
      answer: {
        question_id: "clarify:forged",
        option_id: "field:s6.fabric.scale_up_bandwidth_gbps",
        serialized_value: "s6.fabric.scale_out_bandwidth_gbps",
      },
    };

    expect(bindClarificationAnswer(forged)).toMatchObject({
      ok: false,
      reason_code: "clarification_answer_value_mismatch",
    });
  });

  it("never guesses a value type that the capability projection does not allow", () => {
    const { bindingInput } = bindingFor("横向扩展时延设置为 1 到 3 us", "option:s6.fabric.scale_out_latency_us:2");
    const fractionalInteger: ClarificationBindingInput = {
      ...bindingInput,
      questions: [
        {
          question_id: "clarify:range",
          blocking: true,
          reason_code: "range_requires_single_value",
          prompt: "forged",
          field_ids: ["s1.runtime.max_batch_size"],
          options: [{ option_id: "option:s1.runtime.max_batch_size:1", label: "1.5", serialized_value: "1.5" }],
        },
      ],
      answer: {
        question_id: "clarify:range",
        option_id: "option:s1.runtime.max_batch_size:1",
        serialized_value: "1.5",
      },
    };
    const unitlessCandidate: ClarificationBindingInput = {
      ...fractionalInteger,
      questions: [
        {
          question_id: "clarify:range",
          blocking: true,
          reason_code: "range_requires_single_value",
          prompt: "forged",
          field_ids: ["s6.fabric.scale_out_latency_us"],
          options: [{ option_id: "option:s6.fabric.scale_out_latency_us:1", label: "us", serialized_value: "us" }],
        },
      ],
      answer: {
        question_id: "clarify:range",
        option_id: "option:s6.fabric.scale_out_latency_us:1",
        serialized_value: "us",
      },
    };

    expect(bindClarificationAnswer(fractionalInteger)).toMatchObject({
      ok: false,
      reason_code: "clarification_value_type_mismatch",
    });
    expect(bindClarificationAnswer(unitlessCandidate)).toMatchObject({
      ok: false,
      reason_code: "clarification_value_type_mismatch",
    });
  });

  it("rejects fields outside the projection and ambiguous generic clauses", () => {
    const { bindingInput } = bindingFor("带宽设置为 100G", "field:s6.fabric.scale_up_bandwidth_gbps");
    const unprojected: ClarificationBindingInput = {
      ...bindingInput,
      questions: [
        {
          question_id: "clarify:unprojected",
          blocking: true,
          reason_code: "ambiguous_network_direction",
          prompt: "forged",
          field_ids: ["s2.execution.tp_degree"],
          options: [
            {
              option_id: "option:s2.execution.tp_degree:1",
              label: "8",
              serialized_value: "8",
            },
          ],
        },
      ],
      answer: {
        question_id: "clarify:unprojected",
        option_id: "option:s2.execution.tp_degree:1",
        serialized_value: "8",
      },
    };
    const ambiguousClause = bindingFor(
      "最大 batch 设为 8，带宽设置为 100G，带宽设置为 200G",
      "field:s6.fabric.scale_up_bandwidth_gbps",
    ).bindingInput;

    expect(bindClarificationAnswer(unprojected)).toMatchObject({
      ok: false,
      reason_code: "clarification_field_not_projected",
    });
    expect(bindClarificationAnswer(ambiguousClause)).toMatchObject({
      ok: false,
      reason_code: "clarification_clause_ambiguous",
    });
    expect(resolveClarificationAnswer(ambiguousClause)).toMatchObject({
      ok: false,
      code: "clarification_clause_ambiguous",
    });
  });

  it("fails closed instead of drafting when the page context no longer allows a draft", () => {
    const { bindingInput } = bindingFor("横向扩展时延设置为 1 到 3 us", "option:s6.fabric.scale_out_latency_us:2");
    const stale: ClarificationBindingInput = {
      ...bindingInput,
      context: { ...bindingInput.context, availability: "stale" },
    };
    const rebound = resolveClarificationAnswer(stale);

    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(rebound.output.kind).toBe("unsupported");
    expect(rebound.output).toMatchObject({ result: { reason_code: "page_context_stale" } });
    expect("draft" in rebound.output).toBe(false);
  });
});

describe("clarification binding isolation", () => {
  it("replaces the answered question with the recomputed result instead of reusing the old one", () => {
    const { bindingInput, question } = bindingFor(
      "横向扩展时延设置为 1 到 3 us",
      "option:s6.fabric.scale_out_latency_us:2",
    );
    const rebound = resolveClarificationAnswer(bindingInput);

    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(rebound.output.kind).toBe("draft");
    expect(JSON.stringify(rebound.output)).not.toContain(question.question_id);
    expect(rebound.instruction).toContain("scale-out latency = 3 us");
  });

  it("keeps the binding module free of persistence, fetch, store, and provider access", () => {
    const source = sourceFiles
      .map((file) => readFileSync(resolve("src/features/agent-intent-compiler", file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from\s+["'][^"']*(?:lib\/api|stores?|evidence-agent|providers?)[^"']*["']/u);
    expect(source).not.toMatch(
      /\b(?:fetch|bridgeApi|runExperiment\.create|localStorage|sessionStorage|indexedDB)\s*[.(]/u,
    );
  });
});
