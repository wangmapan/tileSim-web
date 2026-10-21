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
    expect(wrapper.get(".agent-copilot-shell__header").text()).toContain("小拓 · TileSim 助手");
    expect(wrapper.get(".agent-composer__label").text()).toBe("描述要理解或调整的内容");
    expect(wrapper.get("textarea").attributes("placeholder")).not.toContain("你");
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

  it("keeps an unfinished composer draft mounted while the rail is collapsed", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks: [] },
    });
    const textarea = wrapper.get("textarea");
    await textarea.setValue("跨工作台仍需保留的输入");

    await wrapper.setProps({ modelValue: "collapsed" });
    expect(wrapper.get("textarea").element.value).toBe("跨工作台仍需保留的输入");

    await wrapper.get('button[aria-label="展开 TileSim 助手"]').trigger("click");
    await wrapper.setProps({ modelValue: "open" });
    expect(wrapper.get("textarea").element.value).toBe("跨工作台仍需保留的输入");
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

  it("labels run-bound contexts as explain-only instead of implying draft access", () => {
    const wrapper = mount(AgentCopilotShell, {
      props: {
        modelValue: "open",
        context: { ...pageContext(), allowed_purposes: ["explain"], supported_actions: ["explain"] },
        blocks: [],
      },
    });

    expect(wrapper.text()).toContain("仅解释当前页面 · 不会修改实验或开始运行");
    expect(wrapper.text()).not.toContain("仅生成草案 · 不会开始运行");
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
    // The shell footer is the single polite live region for state changes. The
    // transcript remains a navigable log but does not repeat every streamed delta.
    expect(wrapper.get('[role="log"]').attributes("aria-live")).toBe("off");
  });

  it("keeps desktop zoom and motion safeguards in the feature-scoped layout", () => {
    expect(shellSource).toContain("max-width: calc(100vw - 48px)");
    expect(shellSource).toContain("overflow-x: hidden");
    expect(shellSource).toContain("@media (max-width: 720px)");
    expect(shellSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("conversation turns", () => {
  it("opens with task choices and forwards each choice without creating a run", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [] } });
    expect(wrapper.text()).toContain("你好，需要小拓帮忙做些什么");
    const choices = wrapper.findAll(".agent-block-empty__choices button");
    expect(choices.map((button) => button.text())).toEqual(["配置实验", "分析实验结果", "学习怎么看结果"]);
    await choices[0].trigger("click");
    await choices[1].trigger("click");
    await choices[2].trigger("click");
    expect(wrapper.emitted("start")?.map(([task]) => task)).toEqual(["configure", "analyze", "learn"]);
  });

  it("shows the user's own turn and the model's answer with the model that wrote it", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          { block_type: "user_message", block_id: "user:1", text: "低延迟在线服务" },
          {
            block_type: "assistant_message",
            block_id: "assistant:1",
            text: "先压小批量。\n并发上限降一档。",
            streaming: false,
            model_id: "deepseek-v4-flash",
            error: "",
          },
        ] as AgentTypedBlock[],
      },
    });

    const user = wrapper.get('[data-block-type="user_message"]');
    expect(user.get(".agent-block__eyebrow").text()).toBe("用户");
    expect(user.get(".agent-block__speaker img").attributes("src")).toContain("user-avatar.svg");
    expect(user.get(".agent-block__speaker img").attributes("alt")).toBe("");
    expect(wrapper.get('[data-block-type="user_message"] .agent-block__utterance').text()).toBe("低延迟在线服务");
    const answer = wrapper.get('[data-block-type="assistant_message"]');
    expect(answer.get(".agent-block__eyebrow").text()).toBe("小拓 · deepseek-v4-flash");
    expect(answer.get(".agent-block__speaker img").attributes("src")).toContain("atuo-avatar.svg");
    // The line break the model wrote is kept: an answer is prose, not a label.
    expect(answer.get(".agent-block__answer").text()).toBe("先压小批量。\n并发上限降一档。");
    expect(answer.find('[role="status"]').exists()).toBe(false);
  });

  it("keeps saying the answer is unfinished while it is still arriving", async () => {
    const streaming: AgentTypedBlock[] = [
      {
        block_type: "assistant_message",
        block_id: "assistant:1",
        text: "先压",
        streaming: true,
        model_id: "deepseek-v4-flash",
        error: "",
      },
    ];
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: streaming } });

    // Both halves matter: the words that have arrived are on screen, and the
    // block still says it is being written - so a short answer is never mistaken
    // for a finished one.
    expect(wrapper.get(".agent-block__answer").text()).toBe("先压");
    expect(wrapper.get('[role="status"]').text()).toBe("正在写回答…");

    await wrapper.setProps({
      blocks: [
        {
          block_type: "assistant_message",
          block_id: "assistant:1",
          text: "先压小批量。",
          streaming: false,
          model_id: "deepseek-v4-flash",
          error: "",
        },
      ] as AgentTypedBlock[],
    });

    expect(wrapper.get(".agent-block__answer").text()).toBe("先压小批量。");
    // The panel's status role is the shell's footer; the block stops claiming to
    // be unfinished the moment it is not.
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it("waits without an empty answer box while the first token is on its way", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            block_type: "assistant_message",
            block_id: "assistant:1",
            text: "",
            streaming: true,
            model_id: "",
            error: "",
          },
        ] as AgentTypedBlock[],
      },
    });

    // No model is named before the channel has answered, so the eyebrow stays bare.
    expect(wrapper.get(".agent-block__eyebrow").text()).toBe("小拓");
    expect(wrapper.get(".agent-block__answer--waiting").text()).toBe("正在想…");
  });

  it("keeps what was written and explains why it stopped", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            block_type: "assistant_message",
            block_id: "assistant:1",
            text: "先压小批量。",
            streaming: false,
            model_id: "deepseek-v4-flash",
            error: "模型回答的连接中断了。",
          },
        ] as AgentTypedBlock[],
      },
    });

    expect(wrapper.get(".agent-block__answer").text()).toBe("先压小批量。");
    expect(wrapper.get(".agent-block__answer-note").text()).toBe("模型回答的连接中断了。");
  });
});

describe("composer while an answer is arriving", () => {
  it("offers a stop control instead of submit and never opens a second turn", async () => {
    const wrapper = mount(AgentComposer, { props: { busy: true } });
    await wrapper.get("textarea").setValue("再激进一点");

    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("模型正在回答；可以直接停止，也可以先写下一句");

    await wrapper.get(".agent-composer__stop").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);

    // Writing the next sentence while the answer arrives is allowed, but Enter
    // must not start a second turn on top of the first.
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("keeps the draft and goes back to submit once the answer is finished", async () => {
    const wrapper = mount(AgentComposer, { props: { busy: true } });
    await wrapper.get("textarea").setValue("再激进一点");
    await wrapper.setProps({ busy: false });

    expect(wrapper.find(".agent-composer__stop").exists()).toBe(false);
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")?.[0]).toEqual([{ instruction: "再激进一点" }]);
  });

  it("passes the stop through the shell so the panel can end the stream", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks: [], busy: true },
    });

    await wrapper.get(".agent-composer__stop").trigger("click");

    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});

describe("composer, focus and lazy isolation", () => {
  it("asks for the sentence alone, with no mode to choose first", () => {
    // The three mode radios are gone on purpose: the panel decides whether a
    // sentence is a scenario, an assignment or a question, and a user should not
    // have to pick the internal path before typing.
    const wrapper = mount(AgentComposer);

    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("仅询问");
    expect(wrapper.text()).not.toContain("提出草案修改");
    expect(wrapper.text()).not.toContain("直接改参数");
    expect(wrapper.text()).toContain("描述场景会交给配置助手生成方案");
  });

  it("does not submit Enter before Chinese IME composition ends", async () => {
    const wrapper = mount(AgentComposer);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("把最大 batch 调整为 8");
    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")).toBeUndefined();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")?.[0]).toEqual([{ instruction: "把最大 batch 调整为 8" }]);
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

  it("forwards the complete optimization session and candidate ids through the lazy entry", async () => {
    const provenance = {
      deployment_mode: "local_dev",
      source_mode: "synthetic_trace",
      claim_scope: "exploratory",
      production_status: "not_for_production",
    };
    const sessionId = "opt-session-long-id";
    const candidateId = "candidate-long-id";
    const session = {
      schema_identity: "tilesim.agent_harness.optimization_session.v1",
      contract_revision: "2026-10-19.wpd.v1",
      session_id: sessionId,
      principal: "local-user",
      workspace_id: "local",
      input_snapshot_digest: sha("a"),
      schema_set_revision: sha("b"),
      backend_identity: { backend_revision: "local" },
      policy_revision: "tilesim.agent_harness.local_optimization.policy.v1",
      objective: { metric_path: "/tail_latency_summary/ttft_ps/p95_ps", direction: "minimize" },
      constraints: [],
      budget: { max_iterations: 2 },
      base_config: { scenario_id: "s1_des_example" },
      local_dev: true,
      automatic_submission: false,
      state: "waiting_approval",
      current_iteration: 0,
      provenance,
    };
    const candidate = {
      schema_identity: "tilesim.agent_harness.optimization_candidate.v1",
      contract_revision: "2026-10-19.wpd.v1",
      candidate_id: candidateId,
      session_id: sessionId,
      candidate_digest: sha("c"),
      config: { scenario_id: "s1_des_example" },
      diff: { changed_fields: ["scenario_id"] },
      expected_side_effects: ["one bounded Stage-3 execution"],
      status: "waiting_approval",
      provenance,
    };
    const entry = mount(AgentCopilotEntry, {
      props: {
        modelValue: "open",
        context: pageContext(),
        blocks: [],
        optimizationSessions: [session] as never,
        optimizationDetail: {
          session,
          candidate,
          candidates: [candidate],
          iterations: [],
          events: [],
          checkpoint: null,
          approval: null,
          tool_invocations: [],
        } as never,
      },
    });
    await flushPromises();

    const approve = entry.findAll("button").find((button) => button.text().includes("批准候选并提交"));
    expect(approve).toBeDefined();
    await approve!.trigger("click");
    expect(entry.emitted("optimization-approve")?.at(-1)).toEqual([sessionId, candidateId]);
  });

  it("forwards optimization creation payloads through the lazy entry", async () => {
    const entry = mount(AgentCopilotEntry, {
      props: { modelValue: "open", context: pageContext(), blocks: [] },
    });
    await flushPromises();
    const createButton = entry.findAll("button").find((button) => button.text().includes("创建本地优化 session"));
    expect(createButton).toBeDefined();
    await createButton!.trigger("click");
    const createForm = entry.findAll("form").find((form) => form.text().includes("候选基础配置"));
    expect(createForm).toBeDefined();
    await createForm!.trigger("submit");
    expect(entry.emitted("optimization-create")?.at(-1)).toEqual([
      {
        objectivePath: "/tail_latency_summary/ttft_ps/p95_ps",
        direction: "minimize",
        baseConfigText: '{"scenario_id":"s1_des_example","fidelity_policy":"des","gpu_participation_mode":"gpu_free"}',
      },
    ]);
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

describe("choosing the model from the panel", () => {
  const openShell = (props: Record<string, unknown> = {}) =>
    mount(AgentCopilotShell, {
      props: { modelValue: "open", context: pageContext(), blocks: [], ...props },
    });

  it("adds nothing to a Bridge that publishes no model channel", () => {
    // A machine with no model must keep exactly the panel it had before, so the control is absent
    // rather than present-and-disabled.
    const wrapper = openShell();

    expect(wrapper.find("[data-agent-model-bar]").exists()).toBe(false);
    expect(wrapper.find("select").exists()).toBe(false);
  });

  it("offers the published identities and shows which one is answering", async () => {
    const wrapper = openShell({
      modelChannel: true,
      modelCatalogue: ["deepseek-v4-flash", "glm-5.1"],
      modelSelected: "glm-5.1",
    });

    const select = wrapper.get("select");
    expect(select.element.value).toBe("glm-5.1");
    expect(wrapper.findAll("option").map((option) => option.element.value)).toEqual(["deepseek-v4-flash", "glm-5.1"]);
    // The panel says how long the choice lasts; a control that moved silently would promise more
    // than this page can keep.
    expect(wrapper.text()).toContain("本次运行有效");

    await select.setValue("deepseek-v4-flash");
    expect(wrapper.emitted("select-model")?.at(-1)).toEqual(["deepseek-v4-flash"]);
  });

  it("keeps the answering identity in the list even when the service no longer publishes it", () => {
    // Showing a different model than the one answering would misdescribe the answer on screen.
    const wrapper = openShell({
      modelChannel: true,
      modelCatalogue: ["glm-5.1"],
      modelSelected: "deepseek-v4-flash",
    });

    expect(wrapper.findAll("option").map((option) => option.element.value)).toEqual(["deepseek-v4-flash", "glm-5.1"]);
    expect(wrapper.get("select").element.value).toBe("deepseek-v4-flash");
  });

  it("says the list could not be read and offers to try again", async () => {
    const wrapper = openShell({ modelChannel: true, modelCatalogue: [], modelSelected: "deepseek-v4-flash" });

    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.text()).toContain("模型列表暂时读不到");

    await wrapper.get("[data-agent-model-bar] button").trigger("click");
    expect(wrapper.emitted("refresh-models")).toHaveLength(1);
  });

  it("says it is still reading, and keeps the control disabled while it is", async () => {
    const wrapper = openShell({ modelChannel: true, modelCatalogue: [], modelPending: true });

    expect(wrapper.text()).toContain("正在读取模型列表…");
    expect(wrapper.get("[data-agent-model-bar] button").attributes("disabled")).toBeDefined();

    await wrapper.setProps({ modelCatalogue: ["glm-5.1"], modelSelected: "glm-5.1", modelPending: false });
    expect(wrapper.text()).toContain("本次运行有效");
    expect(wrapper.get("select").attributes("disabled")).toBeUndefined();
  });

  it("disables the control while a switch is being applied", () => {
    const wrapper = openShell({
      modelChannel: true,
      modelCatalogue: ["glm-5.1"],
      modelSelected: "glm-5.1",
      modelPending: true,
    });

    expect(wrapper.get("select").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("正在切换…");
  });

  it("hides the control while the panel is folded to its rail", () => {
    const wrapper = mount(AgentCopilotShell, {
      props: {
        modelValue: "collapsed",
        context: pageContext(),
        blocks: [],
        modelChannel: true,
        modelCatalogue: ["glm-5.1"],
        modelSelected: "glm-5.1",
      },
    });

    expect(wrapper.find("[data-agent-model-bar]").exists()).toBe(false);
  });

  it("carries the choice through the entry that hosts the panel", async () => {
    const entry = mount(AgentCopilotEntry, {
      props: {
        modelValue: "open",
        context: pageContext(),
        blocks: [],
        modelChannel: true,
        modelCatalogue: ["deepseek-v4-flash", "glm-5.1"],
        modelSelected: "deepseek-v4-flash",
      },
    });
    await flushPromises();

    await entry.get("select").setValue("glm-5.1");
    expect(entry.emitted("select-model")?.at(-1)).toEqual(["glm-5.1"]);
  });
});
