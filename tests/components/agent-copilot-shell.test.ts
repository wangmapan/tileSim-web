/** @vitest-environment jsdom */

import { defineComponent, h, nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  compareAgentContexts,
  createAgentContextRegistry,
  type PageContextEnvelope,
} from "../../src/entities/agent-context";
import AgentComposer from "../../src/features/agent-copilot-shell/AgentComposer.vue";
import AgentCopilotEntry from "../../src/features/agent-copilot-shell/AgentCopilotEntry.vue";
import AgentCopilotErrorBoundary from "../../src/features/agent-copilot-shell/AgentCopilotErrorBoundary.vue";
import AgentCopilotShell from "../../src/features/agent-copilot-shell/AgentCopilotShell.vue";
import AgentTypedBlockList from "../../src/features/agent-copilot-shell/AgentTypedBlockList.vue";
import type {
  AgentTypedBlock,
  CurrentSubsetExperimentDraft,
  DeterministicValidationIssue,
} from "../../src/features/agent-copilot-shell";
import shellSource from "../../src/features/agent-copilot-shell/AgentCopilotShell.vue?raw";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function pageContext(revision = "context:experiment:1", pageId = "experiment"): PageContextEnvelope {
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    page_id: pageId,
    route_name: pageId,
    context_revision: revision,
    workspace_ref: "workspace:local",
    run_ref: { run_id: "run-20260909-fixture", revision: "run:1" },
    selected_entity: {
      entity_type: "field",
      entity_id: "s1.runtime.max_batch_size",
      revision: "field:1",
    },
    resources: [
      {
        resource_type: "field",
        resource_id: "s1.runtime.max_batch_size",
        revision: "field:1",
        display_label: "最大 batch",
        availability: "available",
      },
    ],
    supported_actions: ["explain", "configure_current_subset", "check_capability"],
    data_classification: "workspace_internal",
    allowed_purposes: ["explain", "draft"],
    expires_at: null,
    display_label: "新建实验",
    availability: "available",
  };
}

const issue: DeterministicValidationIssue = {
  issue_id: "issue:max-batch",
  rule_id: "tilesim.phase1.max_batch.range",
  severity: "error",
  blocking: true,
  status: "fail",
  field_ids: ["s1.runtime.max_batch_size"],
  message: "最大 batch 超出当前正式范围。",
  facts: { maximum: "64" },
  repair_candidates: [
    {
      label: "调整为 64",
      field_id: "s1.runtime.max_batch_size",
      proposed_value: { value_type: "integer", serialized_value: "64" },
    },
  ],
};

const draft: CurrentSubsetExperimentDraft = {
  contract_revision: "tilesim.web.agent_orchestration.phase1.local.v1",
  status: "draft",
  notice: "not_a_run",
  task_summary: "调整当前正式参数子集",
  target_request_identity: "tilesim.bridge.create_run_request.v1",
  fields: [
    {
      field_id: "s1.runtime.max_batch_size",
      request_json_pointer: "/overrides/runtime/max_batch_size",
      original_value: { value_type: "integer", serialized_value: "2" },
      proposed_value: { value_type: "integer", serialized_value: "8" },
      unit: "requests_per_batch",
      value_source: "user",
      capability_state: "available",
      validation_issues: [],
      catalog_revision: sha("a"),
      capability_snapshot_revision: sha("b"),
      context_revision: "context:experiment:1",
      stale: {
        state: "fresh",
        reason: "none",
        expected_revision: "context:experiment:1",
        current_revision: "context:experiment:1",
      },
    },
  ],
  diff: [
    {
      field_id: "s1.runtime.max_batch_size",
      request_json_pointer: "/overrides/runtime/max_batch_size",
      change: "replace",
      original_value: { value_type: "integer", serialized_value: "2" },
      proposed_value: { value_type: "integer", serialized_value: "8" },
      unit: "requests_per_batch",
      value_source: "user",
    },
  ],
  validation: { overall: "valid", issues: [] },
  unresolved: [],
  catalog_revision: sha("a"),
  capability_snapshot_revision: sha("b"),
  schema_set_revision: sha("c"),
  context_revision: "context:experiment:1",
  stale: {
    state: "fresh",
    reason: "none",
    expected_revision: "context:experiment:1",
    current_revision: "context:experiment:1",
  },
};

const unsupportedResult = {
  status: "unsupported" as const,
  reason_code: "field_not_exposed",
  understood: ["你希望设置设备数量。"],
  unsupported_items: [{ text: "设备数量", capability: "当前版本未开放", gap_id: "GAP-DEVICE-001" }],
  safe_next_actions: ["先使用当前正式八参数子集。"],
};

const blocks: readonly AgentTypedBlock[] = [
  { block_type: "explanation", block_id: "explain:1", title: "页面用途", body: "这里用于配置受控仿真实验。" },
  { block_type: "capability_result", block_id: "capability:1", result: unsupportedResult },
  { block_type: "draft_summary", block_id: "draft:1", draft },
  { block_type: "validation_result", block_id: "validation:1", overall: "invalid", issues: [issue] },
  {
    block_type: "clarification",
    block_id: "clarification:1",
    questions: [
      {
        question_id: "question:bandwidth",
        blocking: true,
        reason_code: "unit_ambiguous",
        prompt: "100G 指的是每链路 Gbps 吗？",
        field_ids: ["s6.fabric.scale_out_bandwidth_gbps"],
        options: [{ option_id: "gbps", label: "每链路 100 Gbps", serialized_value: "100" }],
      },
    ],
  },
  { block_type: "unsupported", block_id: "unsupported:1", result: unsupportedResult },
  {
    block_type: "formal_error",
    block_id: "error:1",
    code: "phase1_contract_invalid",
    message: "返回结构未通过冻结契约校验。",
    safe_next_action: "刷新能力快照后重试。",
  },
];

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Agent context registry", () => {
  it("keeps immutable typed envelopes and reports route or revision changes as stale", () => {
    const registry = createAgentContextRegistry();
    const original = pageContext();
    const snapshots: (PageContextEnvelope | null)[] = [];
    const unsubscribe = registry.subscribe((value) => snapshots.push(value));
    const unregister = registry.register("experiment-provider", original);

    expect(registry.current()).toEqual(original);
    const attached = registry.current();
    original.resources[0].display_label = "外部修改";
    expect(registry.current()?.resources[0].display_label).toBe("最大 batch");

    registry.update("experiment-provider", pageContext("context:experiment:2"));
    expect(registry.compare(attached)).toEqual({
      state: "stale",
      reason: "context_revision_changed",
      expected_revision: "context:experiment:1",
      current_revision: "context:experiment:2",
    });
    expect(snapshots.at(-1)?.context_revision).toBe("context:experiment:2");

    expect(compareAgentContexts(attached, pageContext("context:overview:1", "overview")).reason).toBe("page_changed");
    unsubscribe();
    unregister();
    expect(registry.current()).toBeNull();
  });

  it("fails closed for envelopes that extend or alter the frozen shape", () => {
    const registry = createAgentContextRegistry();
    const invalid = { ...pageContext(), credential: "must-not-enter-context" } as PageContextEnvelope;
    expect(() => registry.register("invalid", invalid)).toThrowError("invalid_phase1_page_context_envelope");
    expect(registry.current()).toBeNull();
  });
});

describe("typed result presentation", () => {
  it("renders every frozen Phase 1 block with the task hierarchy and technical details collapsed", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks } });

    expect(wrapper.findAll('[data-block-type="explanation"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="capability_result"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="draft_summary"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="validation_result"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="clarification"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="unsupported"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-block-type="formal_error"]')).toHaveLength(1);
    expect(wrapper.text()).toContain("理解结果");
    expect(wrapper.text()).toContain("建议修改");
    expect(wrapper.text()).toContain("限制和下一步");
    expect(wrapper.text()).toContain("这是草案，尚未创建运行。");
    expect(wrapper.get(".agent-block__diff-list strong").text().replace(/\s+/g, " ")).toBe(
      "2 → 8 · requests_per_batch",
    );
    expect(wrapper.findAll("details").every((details) => details.attributes("open") === undefined)).toBe(true);

    await wrapper.get(".agent-block__options button").trigger("click");
    expect(wrapper.emitted("answer")?.[0]).toEqual([
      { question_id: "question:bandwidth", option_id: "gbps", serialized_value: "100" },
    ]);
  });

  it("fails closed for an unknown block without rendering its payload", () => {
    const unknown = {
      block_type: "approval_request",
      block_id: "unknown:1",
      raw_provider_response: "secret payload must not render",
    } as unknown as AgentTypedBlock;
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [unknown] } });

    expect(wrapper.get('[role="alert"]').text()).toContain("无法显示的结果块");
    expect(wrapper.text()).not.toContain("secret payload must not render");
  });
});

describe("Agent copilot shell interaction", () => {
  it("supports open, expanded, collapsed and closed state transitions without clearing content", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks },
    });

    expect(wrapper.attributes("data-state")).toBe("open");
    expect(wrapper.findAll(".agent-block")).toHaveLength(blocks.length);
    await wrapper.get('button[aria-pressed="false"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["expanded"]);

    await wrapper.setProps({ modelValue: "expanded" });
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["open"]);

    await wrapper.setProps({ modelValue: "collapsed" });
    expect(wrapper.find(".agent-copilot-shell__rail").exists()).toBe(true);
    await wrapper.get('button[aria-label="展开 TileSim 助手"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["open"]);
    expect(blocks).toHaveLength(7);
  });

  it("retains existing results and marks them stale when route context revision changes", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks },
    });
    const before = wrapper.findAll(".agent-block").length;

    await wrapper.setProps({ context: pageContext("context:experiment:2") });

    expect(wrapper.findAll(".agent-block")).toHaveLength(before);
    expect(wrapper.text()).toContain("页面或选择已更新；现有内容仍按原上下文保留");
    expect(wrapper.text()).toContain("现有内容使用旧上下文");
  });

  it("offers an accessible keyboard resize control with bounded width", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks: [], initialWidth: 420 },
    });
    const separator = wrapper.get('[role="separator"]');

    expect(separator.attributes("aria-valuenow")).toBe("420");
    expect(separator.attributes("aria-valuemin")).toBe("340");
    await separator.trigger("keydown", { key: "ArrowLeft" });
    expect(wrapper.emitted("resize")?.at(-1)).toEqual([436]);
    await separator.trigger("keydown", { key: "Home" });
    expect(wrapper.emitted("resize")?.at(-1)).toEqual([340]);

    separator.element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100 }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 80 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(wrapper.emitted("resize")?.at(-1)).toEqual([360]);
    expect(wrapper.get('[role="log"]').attributes("aria-live")).toBe("polite");
  });

  it("keeps desktop zoom and motion safeguards in the feature-scoped layout", () => {
    expect(shellSource).toContain("max-width: calc(100vw - 48px)");
    expect(shellSource).toContain("overflow-x: hidden");
    expect(shellSource).toContain("@media (max-width: 720px)");
    expect(shellSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("composer, focus and lazy isolation", () => {
  it("does not submit Enter before Chinese IME composition ends", async () => {
    const wrapper = mount(AgentComposer, { props: { allowDraft: true } });
    const textarea = wrapper.get("textarea");
    await textarea.setValue("把最大 batch 调整为 8");
    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")).toBeUndefined();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")?.[0]).toEqual([{ instruction: "把最大 batch 调整为 8", purpose: "explain" }]);
  });

  it("loads the shell only after opening and restores focus after close", async () => {
    const loader = vi.fn(async () => ({ default: AgentCopilotShell }));
    const wrapper = mount(AgentCopilotEntry, {
      props: { context: pageContext(), blocks: [], loader, focusOnOpen: true },
      attachTo: document.body,
    });
    const trigger = wrapper.get(".agent-copilot-entry__trigger");
    (trigger.element as HTMLElement).focus();
    expect(loader).not.toHaveBeenCalled();

    await trigger.trigger("click");
    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(AgentCopilotShell).exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get("textarea").element);

    await wrapper.get(".agent-copilot-shell__header-actions button:last-child").trigger("click");
    await nextTick();
    expect(document.activeElement).toBe(trigger.element);
    expect(wrapper.findComponent(AgentCopilotShell).exists()).toBe(true);
    wrapper.unmount();
  });

  it("isolates lazy-load and descendant render failures from the host workspace", async () => {
    const loader = vi
      .fn<() => Promise<{ default: object }>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValue({ default: AgentCopilotShell });
    const entry = mount(AgentCopilotEntry, {
      props: { context: pageContext(), blocks: [], loader },
    });
    await entry.get(".agent-copilot-entry__trigger").trigger("click");
    await flushPromises();
    expect(entry.get('[role="alert"]').text()).toContain("主工作台未受影响");
    await entry.get(".agent-copilot-entry__error button").trigger("click");
    await flushPromises();
    expect(entry.findComponent(AgentCopilotShell).exists()).toBe(true);

    const BrokenChild = defineComponent({
      setup() {
        return () => {
          throw new Error("isolated render failure");
        };
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boundary = mount(AgentCopilotErrorBoundary, { slots: { default: () => h(BrokenChild) } });
    await nextTick();
    expect(boundary.get('[role="alert"]').text()).toContain("主工作台仍可继续使用");
    consoleError.mockRestore();
  });
});
