/** @vitest-environment jsdom */

// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest runs Node tests, while the browser tsconfig intentionally omits Node types.
import { resolve } from "node:path";
import { defineComponent, h, nextTick, ref, shallowRef } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentCopilotShell from "../../src/features/agent-copilot-shell/AgentCopilotShell.vue";
import { formalErrorBlock, intentOutputToTypedBlocks } from "../../src/features/agent-copilot-integration";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  compileIntent,
  resolveClarificationAnswer,
  type ClarificationAnswer,
  type IntentCompilerInput,
  type Phase1CapabilityFieldProjection,
} from "../../src/features/agent-intent-compiler";
import type { AgentTypedBlock, DraftFieldValue } from "../../src/entities/agent-orchestration";
import appSource from "../../src/App.vue?raw";

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
  "s1.runtime.batch_scheduler": { value_type: "enum", serialized_value: "fifo" },
  "s1.runtime.max_batch_size": { value_type: "integer", serialized_value: "2" },
  "s1.runtime.kv_capacity_tokens": { value_type: "integer", serialized_value: "4096" },
  "s6.fabric.scale_up_bandwidth_gbps": { value_type: "number", serialized_value: "450" },
  "s6.fabric.scale_up_latency_us": { value_type: "number", serialized_value: "0.8" },
  "s6.fabric.scale_out_bandwidth_gbps": { value_type: "number", serialized_value: "200" },
  "s6.fabric.scale_out_latency_us": { value_type: "number", serialized_value: "4" },
};

function compilerInput(instruction: string): IntentCompilerInput {
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    instruction,
    locale: "zh-CN",
    capability: {
      catalog_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1",
      catalog_revision: frozenFixture.catalog_revision,
      capability_snapshot_revision: `sha256:${"5".repeat(64)}`,
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

/**
 * Renders the real copilot sidebar next to a stand-in for the main workspace and
 * drives it exactly the way `src/App.vue` does: the `answer` payload emitted by
 * an option button is bound back to the instruction that produced the current
 * clarification block, the deterministic compiler runs again, and the sidebar
 * blocks are replaced with the recomputed result. The source guard at the end of
 * this file keeps this harness honest about that contract.
 */
function renderSidebar(input: IntentCompilerInput) {
  const blocks = shallowRef<readonly AgentTypedBlock[]>(intentOutputToTypedBlocks(compileIntent(input)));
  const instruction = shallowRef(input.instruction);
  const status = ref("可以开始");
  const workspace = ref("工作台内容未受影响");

  function answer(payload: ClarificationAnswer): void {
    const questions = blocks.value.find((block) => block.block_type === "clarification")?.questions ?? null;
    if (!questions) {
      blocks.value = [formalErrorBlock("phase1_clarification_binding_unavailable", "当前没有可绑定的澄清问题。")];
      status.value = "选项无法绑定，草案未更新";
      return;
    }
    const outcome = resolveClarificationAnswer({
      questions,
      answer: payload,
      instruction: instruction.value,
      capability: input.capability,
      current_values: input.current_values,
      locale: input.locale,
      context: input.context,
    });
    if (!outcome.ok) {
      blocks.value = [
        formalErrorBlock(outcome.code, "所选选项无法与当前澄清问题绑定，草案未更新；请重新描述要调整的字段和值。"),
      ];
      status.value = "选项无法绑定，草案未更新";
      return;
    }
    instruction.value = outcome.instruction;
    blocks.value = intentOutputToTypedBlocks(outcome.output);
    status.value = outcome.output.kind === "draft" ? "已按所选选项重算草案，尚未创建运行" : "已按所选选项重算";
  }

  const Harness = defineComponent({
    name: "ClarificationSidebarHarness",
    setup: () => () =>
      h("div", [
        h("p", { "data-testid": "workspace" }, workspace.value),
        h(AgentCopilotShell, {
          modelValue: "open",
          context: input.context,
          blocks: blocks.value,
          onAnswer: answer,
        }),
      ]),
  });

  return { Harness, blocks, instruction, status, workspace, answer };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("clarification answer round trip", () => {
  it("turns a clicked option button into the recomputed draft shown in the sidebar", async () => {
    const input = compilerInput("横向扩展时延设置为 1 到 3 us");
    const compiled = compileIntent(input);
    expect(compiled.kind).toBe("clarification");
    if (compiled.kind !== "clarification") return;
    const [question] = compiled.questions;
    const answerIndex = question.options.findIndex(
      (option) => option.option_id === "option:s6.fabric.scale_out_latency_us:2",
    );
    expect(answerIndex).toBeGreaterThanOrEqual(0);

    const { Harness, blocks } = renderSidebar(input);
    const wrapper = mount(Harness);

    // Before the click the sidebar is blocked on the question.
    expect(wrapper.findAll('[data-block-type="clarification"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="draft_summary"]')).toHaveLength(0);
    expect(wrapper.text()).toContain(question.prompt);

    const buttons = wrapper.findAll(".agent-block__options button");
    expect(buttons.length).toBe(question.options.length);
    await buttons[answerIndex].trigger("click");

    // The answered question is replaced by the result of the recomputation.
    expect(blocks.value.every((block) => block.block_type !== "clarification")).toBe(true);
    expect(wrapper.findAll('[data-block-type="clarification"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-block-type="draft_summary"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain(question.prompt);
    expect(wrapper.get(".agent-block__diff-list strong").text().replace(/\s+/g, " ")).toBe("4 → 3 · us");
    expect(wrapper.text()).toContain("这是草案，尚未创建运行。");
    // The main workspace is never part of the recomputation.
    expect(wrapper.get('[data-testid="workspace"]').text()).toBe("工作台内容未受影响");
  });

  it("replaces a field-disambiguation question with the narrowed follow-up question", async () => {
    const input = compilerInput("带宽设置为 100G");
    const compiled = compileIntent(input);
    expect(compiled.kind).toBe("clarification");
    if (compiled.kind !== "clarification") return;
    const [question] = compiled.questions;
    expect(question.options.map((option) => option.option_id)).toContain("field:s6.fabric.scale_up_bandwidth_gbps");

    const { Harness, blocks } = renderSidebar(input);
    const wrapper = mount(Harness);
    expect(wrapper.text()).toContain(question.prompt);

    const index = question.options.findIndex(
      (option) => option.option_id === "field:s6.fabric.scale_up_bandwidth_gbps",
    );
    await wrapper.findAll(".agent-block__options button")[index].trigger("click");

    const recomputed = blocks.value.find((block) => block.block_type === "clarification");
    expect(recomputed).toBeDefined();
    if (recomputed?.block_type !== "clarification") return;
    expect(recomputed.questions).toHaveLength(1);
    // The generic prompt is gone; the click narrowed the question to one field.
    expect(recomputed.questions[0].question_id).not.toBe(question.question_id);
    expect(recomputed.questions[0].field_ids).toEqual(["s6.fabric.scale_up_bandwidth_gbps"]);
    expect(wrapper.findAll('[data-block-type="clarification"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain(question.prompt);
    expect(wrapper.text()).toContain(recomputed.questions[0].prompt);
    expect(wrapper.findAll('[data-block-type="draft_summary"]')).toHaveLength(0);
  });

  it("shows an existing formal error block instead of a draft when the answer cannot be bound", async () => {
    const input = compilerInput("横向扩展时延设置为 1 到 3 us");
    const { Harness, blocks, instruction, status, answer } = renderSidebar(input);
    const wrapper = mount(Harness);
    const before = instruction.value;

    // A payload that no question in the current block owns, e.g. a stale button
    // from a block that has already been replaced.
    answer({
      question_id: "clarify:stale-block",
      option_id: "option:s6.fabric.scale_out_latency_us:2",
      serialized_value: "3",
    });
    await nextTick();

    expect(blocks.value).toHaveLength(1);
    expect(blocks.value[0]).toMatchObject({
      block_type: "formal_error",
      code: "clarification_question_not_in_block",
    });
    expect(wrapper.findAll('[data-block-type="formal_error"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="draft_summary"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-block-type="clarification"]')).toHaveLength(0);
    expect(wrapper.text()).toContain("草案未更新");
    expect(status.value).toBe("选项无法绑定，草案未更新");
    // The instruction is not advanced, so the previous draft can never be
    // presented as the result of this rejected click.
    expect(instruction.value).toBe(before);
    expect(wrapper.get('[data-testid="workspace"]').text()).toBe("工作台内容未受影响");
  });
});

describe("App shell wiring for clarification answers", () => {
  it("rebinds the answered option through the binding module and replaces the sidebar blocks", () => {
    const callback = appSource.slice(
      appSource.indexOf("function answerAgentClarification"),
      appSource.indexOf("const requestedRunId = computed"),
    );

    expect(callback).toContain("resolveClarificationAnswer({");
    expect(callback).toContain("questions: clarification");
    expect(callback).toContain("agentBlocks.value = intentOutputToTypedBlocks(outcome.output)");
    expect(callback).toContain("agentLastInstruction.value = outcome.instruction");
    expect(callback).toContain("formalErrorBlock(outcome.code");
    // The stub this work package replaces must not come back.
    expect(appSource).not.toContain("请在输入框中补充选择后重新提交");
  });
});
