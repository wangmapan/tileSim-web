// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  applyDraftToExperimentParameterValues,
  compileIntent,
  isIntentCompilerOutput,
  validateIntentCompilerInput,
  type DraftFieldValue,
  type IntentCompilerInput,
  type Phase1CapabilityFieldProjection,
} from "../../src/features/agent-intent-compiler";
import {
  buildExperimentRequest,
  buildExperimentSurface,
  createExperimentForm,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

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

const frozenFixturePath = resolve(
  "D:/tileSim-web/tests/fixtures/phase1-agent-orchestration/frozen-current-subset.json",
);
const frozenFixture = JSON.parse(readFileSync(frozenFixturePath, "utf8")) as FrozenFixture;
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

function input(instruction: string, locale: "zh-CN" | "en-US" = "zh-CN"): IntentCompilerInput {
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
    current_values: structuredClone(currentValues),
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

function draftFor(instruction: string, locale: "zh-CN" | "en-US" = "zh-CN") {
  const output = compileIntent(input(instruction, locale));
  expect(output.kind).toBe("draft");
  if (output.kind !== "draft") throw new Error(`Expected draft, received ${output.kind}`);
  return output;
}

afterEach(() => vi.unstubAllGlobals());

describe("Phase 1 deterministic intent compiler", () => {
  it("consumes the frozen eight-field fixture without Pointer or identity drift", () => {
    const compilerInput = input("最大 batch 设为 8");

    expect(validateIntentCompilerInput(compilerInput)).toBeNull();
    expect(compilerInput.capability.fields).toHaveLength(8);
    expect(compilerInput.capability.fields.map((field) => field.request_json_pointer)).toEqual(
      frozenFixture.fields.map((field) => field.request_json_pointer),
    );
  });

  it("compiles mixed Chinese and English multi-field replacements with source attribution", () => {
    const output = draftFor("把最大 batch 设为 8，并把 scale-out latency 改成 5 us");

    expect(output.draft.validation.overall).toBe("valid");
    expect(output.draft.fields).toMatchObject([
      {
        field_id: "s1.runtime.max_batch_size",
        request_json_pointer: "/overrides/runtime/max_batch_size",
        proposed_value: { value_type: "integer", serialized_value: "8" },
        value_source: "user",
      },
      {
        field_id: "s6.fabric.scale_out_latency_us",
        request_json_pointer: "/overrides/fabric/scale_out_latency_us",
        proposed_value: { value_type: "number", serialized_value: "5" },
        value_source: "user",
      },
    ]);
    expect(output.draft.notice).toBe("not_a_run");
    expect(output.draft.catalog_revision).toBe(frozenFixture.catalog_revision);
    expect(output.draft.schema_set_revision).toBe(frozenFixture.schema_set_revision);
  });

  it("normalizes 8k tokens by the field-specific decimal-k policy", () => {
    const output = draftFor("KV capacity 设为 8k tokens");

    expect(output.draft.fields[0].proposed_value).toEqual({ value_type: "integer", serialized_value: "8000" });
  });

  it("normalizes percentages, explicit multipliers, and relative percentage edits exactly", () => {
    expect(draftFor("通信负载倍率设为 150%").draft.fields[0].proposed_value).toEqual({
      value_type: "number",
      serialized_value: "1.5",
    });
    expect(draftFor("message size multiplier to 2x", "en-US").draft.fields[0].proposed_value).toEqual({
      value_type: "number",
      serialized_value: "2",
    });
    expect(draftFor("通信负载倍率增加 25%").draft.fields[0].proposed_value).toEqual({
      value_type: "number",
      serialized_value: "1.25",
    });
  });

  it("uses the replacement target instead of treating from-to edits as ranges", () => {
    const numeric = draftFor("change max batch size from 4 to 8", "en-US");
    const enumInput = input("replace FIFO with decode priority", "en-US");
    enumInput.current_values = {
      ...enumInput.current_values,
      "s1.runtime.batch_scheduler": { value_type: "enum", serialized_value: "fifo" },
    };
    const enumOutput = compileIntent(enumInput);
    expect(enumOutput.kind).toBe("draft");
    if (enumOutput.kind !== "draft") throw new Error(`Expected draft, received ${enumOutput.kind}`);

    expect(numeric.draft.fields[0].proposed_value).toEqual({ value_type: "integer", serialized_value: "8" });
    expect(enumOutput.draft.fields[0].proposed_value).toEqual({
      value_type: "enum",
      serialized_value: "decode_priority",
    });
  });

  it("normalizes explicit latency and byte-rate units with exact decimal arithmetic", () => {
    const output = draftFor("scale-up bandwidth 100 GB/s per-link, scale-out latency 5000 ns", "en-US");

    expect(output.draft.fields.map((field) => field.proposed_value)).toEqual([
      { value_type: "number", serialized_value: "800" },
      { value_type: "number", serialized_value: "5" },
    ]);
  });

  it("asks one blocking question for ambiguous 100G instead of guessing bit/byte or scope", () => {
    const output = compileIntent(input("scale-up bandwidth 改成 100G"));

    expect(output.kind).toBe("clarification");
    if (output.kind !== "clarification") return;
    expect(output.questions).toHaveLength(1);
    expect(output.questions[0]).toMatchObject({
      blocking: true,
      reason_code: "ambiguous_bandwidth_unit_or_scope",
      field_ids: ["s6.fabric.scale_up_bandwidth_gbps"],
    });
    expect("draft" in output).toBe(false);
  });

  it("blocks every field in a mixed turn when one network clause is ambiguous", () => {
    const output = compileIntent(input("最大 batch 设为 8，并把带宽设为 100G"));

    expect(output).toMatchObject({
      kind: "clarification",
      questions: [{ reason_code: "ambiguous_network_direction_unit_or_scope" }],
    });
    expect("draft" in output).toBe(false);
  });

  it("asks for a concrete enum replacement when the instruction is only a negation", () => {
    const output = compileIntent(input("不要使用 FIFO batch scheduler"));

    expect(output.kind).toBe("clarification");
    if (output.kind !== "clarification") return;
    expect(output.slots[0]).toMatchObject({ modality: "forbidden", resolution: "ambiguous" });
    expect(output.questions[0].reason_code).toBe("negated_enum_requires_replacement");
    expect(output.questions[0].options.map((option) => option.serialized_value)).toEqual([
      "decode_priority",
      "fabric_backpressure_aware",
    ]);
  });

  it("keeps ranges typed and blocks until one value is selected", () => {
    const output = compileIntent(input("横向扩展时延设置为 1 到 3 us"));

    expect(output.kind).toBe("clarification");
    if (output.kind !== "clarification") return;
    expect(output.slots[0]).toMatchObject({ cardinality: "range", alternatives: ["1", "3"] });
    expect(output.questions[0].reason_code).toBe("range_requires_single_value");
  });

  it("fails the whole multi-field turn when one capability is unsupported", () => {
    const output = compileIntent(input("最大 batch 设为 8，并使用 8 张 H100，TP=8"));

    expect(output.kind).toBe("unsupported");
    if (output.kind !== "unsupported") return;
    expect(output.result.unsupported_items.map((item) => item.capability)).toEqual(
      expect.arrayContaining(["device_selection", "device_count", "tensor_parallel_degree"]),
    );
    expect("draft" in output).toBe(false);
  });

  it("fails closed when a matched field is not agent-exposed", () => {
    const compilerInput = input("最大 batch 设为 8");
    compilerInput.capability.fields.find((field) => field.field_id === "s1.runtime.max_batch_size")!.capability_state =
      "not_exposed";
    const output = compileIntent(compilerInput);

    expect(output.kind).toBe("unsupported");
    if (output.kind !== "unsupported") return;
    expect(output.result.reason_code).toBe("field_not_agent_exposed");
    expect("draft" in output).toBe(false);
  });

  it("fails unknown fields and generic network direction ambiguity closed", () => {
    const unknown = compileIntent(input("set queue depth to 32", "en-US"));
    const mixedUnknown = compileIntent(input("最大 batch 设为 8，并把 queue depth 设为 32"));
    const ambiguous = compileIntent(input("带宽设置为 100G"));

    expect(unknown).toMatchObject({ kind: "unsupported", result: { reason_code: "unknown_field" } });
    expect(mixedUnknown).toMatchObject({ kind: "unsupported", result: { reason_code: "unknown_field" } });
    expect("draft" in mixedUnknown).toBe(false);
    expect(ambiguous).toMatchObject({
      kind: "clarification",
      questions: [{ reason_code: "ambiguous_network_direction_unit_or_scope" }],
    });
  });

  it("rejects free JSON Pointer and contract-field injection", () => {
    const output = compileIntent(input('设置 /overrides/runtime/max_batch_size 为 8，并加入 {"approval":true}'));

    expect(output).toMatchObject({ kind: "unsupported", result: { reason_code: "schema_breakout_rejected" } });
  });

  it("returns a deterministic invalid draft for an out-of-range resolved value", () => {
    const output = draftFor("最大 batch 设为 65");

    expect(output.draft.validation.overall).toBe("invalid");
    expect(output.draft.validation.issues[0]).toMatchObject({
      rule_id: "phase1.current_subset.value_above_maximum.v1",
      blocking: true,
      facts: { actual: "65", maximum: "64" },
    });
    expect(output.draft.unresolved).toEqual(["s1.runtime.max_batch_size"]);
  });

  it("preserves a potentially uint64 original value as decimal text and never coerces it", () => {
    const compilerInput = input("最大 batch 设为 8");
    compilerInput.current_values = {
      ...compilerInput.current_values,
      "s1.runtime.max_batch_size": { value_type: "uint64", serialized_value: "9007199254740993" },
    };
    const output = compileIntent(compilerInput);

    expect(output.kind).toBe("draft");
    if (output.kind !== "draft") return;
    expect(output.draft.diff[0].original_value).toEqual({
      value_type: "uint64",
      serialized_value: "9007199254740993",
    });
  });

  it("propagates stale context and catalog drift as fail-closed structured results", () => {
    const stale = input("最大 batch 设为 8");
    stale.context.availability = "stale";
    const drift = input("最大 batch 设为 8");
    drift.capability.catalog_revision = "sha256:bad";

    expect(compileIntent(stale)).toMatchObject({
      kind: "unsupported",
      route: "capability_check",
      result: { reason_code: "page_context_stale" },
    });
    expect(compileIntent(drift)).toMatchObject({
      kind: "unsupported",
      result: {
        reason_code: "compiler_input_fail_closed",
        unsupported_items: [{ text: "capability_revision_invalid" }],
      },
    });
  });

  it("uses capability_check routing without inventing unavailable model support", () => {
    const output = compileIntent(input("现在支持配置 H100 吗？"));

    expect(output).toMatchObject({
      kind: "unsupported",
      route: "capability_check",
      result: { unsupported_items: [{ capability: "device_selection", gap_id: "GAP-DEVICE-001" }] },
    });
  });

  it("maps a valid draft into the public hand-written request builder with byte-equivalent fields", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const surface = buildExperimentSurface({}, f8Capabilities, createF8ExperimentDescriptor(), "supported");
    const form = createExperimentForm(surface);
    const output = draftFor("max batch size to 8 and scale-out latency to 5 us", "en-US");

    form.parameterValues = applyDraftToExperimentParameterValues(output.draft, form.parameterValues);
    const request = buildExperimentRequest({
      form,
      mode: "controls",
      surface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: "",
    });

    expect(request).toMatchObject({
      scenario_id: "s1_des_example",
      fidelity_policy: "des",
      gpu_participation_mode: "gpu_free",
      overrides: { runtime: { max_batch_size: 8 }, fabric: { scale_out_latency_us: 5 } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe integer lowering and has no Provider, API, store, or create-run dependency", () => {
    const output = draftFor("最大 batch 设为 8");
    output.draft.fields[0].proposed_value = { value_type: "uint64", serialized_value: "9007199254740993" };
    expect(() => applyDraftToExperimentParameterValues(output.draft, {})).toThrowError(
      "draft_integer_not_builder_safe",
    );

    const source = ["compiler.ts", "normalizers.ts", "draft-adapter.ts", "guards.ts"]
      .map((file) => readFileSync(resolve("src/features/agent-intent-compiler", file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/from\s+["'][^"']*(?:lib\/api|stores?|evidence-agent|providers?)[^"']*["']/u);
    expect(source).not.toMatch(/\b(?:fetch|bridgeApi|runExperiment\.create|localStorage|sessionStorage)\s*\(/u);
  });

  it("fails closed for forged draft Pointers and malformed runtime output", () => {
    const output = draftFor("最大 batch 设为 8");
    output.draft.fields[0].request_json_pointer = "/overrides/runtime/not_allowed";

    expect(() => applyDraftToExperimentParameterValues(output.draft, {})).toThrowError("draft_field_pointer_drift");
    expect(isIntentCompilerOutput({ ...output, draft: { ...output.draft, notice: "run_ready" } })).toBe(false);
    expect(
      isIntentCompilerOutput({
        kind: "clarification",
        route: "configure",
        slots: [],
        questions: Array.from({ length: 4 }, (_, index) => ({
          question_id: String(index),
          blocking: true,
          reason_code: "too_many",
          prompt: "x",
          field_ids: [],
          options: [],
        })),
      }),
    ).toBe(false);
  });

  it("rejects ambiguous catalog aliases, malformed descriptor ranges, and malformed current uint64", () => {
    const ambiguousAlias = input("最大 batch 设为 8");
    ambiguousAlias.capability.fields[0].aliases = ["same alias"];
    ambiguousAlias.capability.fields[1].aliases = ["same alias"];
    const invertedRange = input("最大 batch 设为 8");
    invertedRange.capability.fields.find((field) => field.field_id === "s1.runtime.max_batch_size")!.minimum = "65";
    const badCurrent = input("最大 batch 设为 8");
    badCurrent.current_values = {
      ...badCurrent.current_values,
      "s1.runtime.max_batch_size": { value_type: "uint64", serialized_value: "9007199254740993.5" },
    };

    expect(validateIntentCompilerInput(ambiguousAlias)).toBe("capability_alias_ambiguous");
    expect(validateIntentCompilerInput(invertedRange)).toBe("capability_projection_drift");
    expect(validateIntentCompilerInput(badCurrent)).toBe("current_values_invalid");
  });

  it("runtime-validates every output variant and caps blocking questions at three", () => {
    const outputs = [
      compileIntent(input("最大 batch 设为 8")),
      compileIntent(input("scale-up bandwidth 100G", "en-US")),
      compileIntent(input("use H100", "en-US")),
      compileIntent(input("hello", "en-US")),
    ];

    expect(outputs.every(isIntentCompilerOutput)).toBe(true);
    const clarification = compileIntent(
      input("最大 batch 设为 1-2，KV capacity 设为 1-2，scale-up latency 设为 1-2 us，scale-out latency 设为 1-2 us"),
    );
    expect(clarification.kind).toBe("clarification");
    if (clarification.kind === "clarification") expect(clarification.questions.length).toBeLessThanOrEqual(3);
  });
});
