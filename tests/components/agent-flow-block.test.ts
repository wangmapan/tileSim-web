// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AgentTypedBlockList from "../../src/features/agent-copilot-shell/AgentTypedBlockList.vue";
import type { AgentTypedBlock } from "../../src/entities/agent-orchestration";

function block(overrides: Partial<Extract<AgentTypedBlock, { block_type: "agent_flow" }>> = {}) {
  return {
    block_type: "agent_flow" as const,
    block_id: "flow-block-1",
    flow_id: "flow-test",
    status: "waiting_user" as const,
    phase: "等待用户确认",
    title: "结果解读流程",
    detail: "只整理已验证结果，不会创建运行。",
    pending_action: { action: "confirm_report" as const, prompt: "是否生成报告草案？", reason: "报告需要人工确认" },
    evidence_status: "deterministic_fallback" as const,
    report_status: "not_started" as const,
    terminal_reason: null,
    binding: {
      session_id: "session-test",
      flow_id: "flow-test",
      run_id: "run-test",
      run_context_revision: "ctx-1",
      backend_identity: { backend: "fixture" },
      schema_set_revision: "sha256:e55441d53139a6014b4a2a78c457d77b3c7e919069b9214dc40ad5568cdb08db",
      input_snapshot_digest: null,
      artifact_bindings: [],
    },
    ...overrides,
  } satisfies Extract<AgentTypedBlock, { block_type: "agent_flow" }>;
}

describe("Agent flow typed block", () => {
  it("renders a confirmation and emits only a flow resume action", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [block()] } });
    expect(wrapper.text()).toContain("结果解读流程");
    expect(wrapper.text()).toContain("只整理已验证结果");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("flow-resume")).toEqual([[{ blockId: "flow-block-1", action: "confirm_report" }]]);
  });

  it("disables durable flow actions while a resume is in flight", async () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: { blocks: [block()], flowResumePending: true },
    });
    const button = wrapper.get("button");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    expect(button.attributes("aria-busy")).toBe("true");
    await button.trigger("click");
    expect(wrapper.emitted("flow-resume")).toBeUndefined();
  });

  it("renders the bounded visible user goal retained for reload-safe draft resume", () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [block({ user_goal: "配置一个只读草案" })] } });
    expect(wrapper.text()).toContain("请求：配置一个只读草案");
  });

  it("shows stale flow as non-continuable without exposing internal binding details", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [block({ status: "stale", pending_action: null, terminal_reason: "stale_binding" })],
      },
    });
    expect(wrapper.text()).toContain("已过期");
    expect(wrapper.text()).toContain("流程不能继续");
    expect(wrapper.find("dt").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("sha256:e55441d53139a6014b4a2a78c457d77b3c7e919069b9214dc40ad5568cdb08db");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("keeps internal phase and evidence metadata collapsed by default", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [block()] } });
    const details = wrapper.get(".agent-block__flow-details");
    expect((details.element as HTMLDetailsElement).open).toBe(false);
    await details.get("summary").trigger("click");
    expect(details.text()).toContain("等待用户确认");
    expect(details.text()).toContain("本地确定性整理");
  });

  it("surfaces partial evidence without upgrading it to validation", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: { blocks: [block({ status: "completed", pending_action: null, evidence_status: "partial" })] },
    });
    expect(wrapper.text()).toContain("证据不完整");
    expect(wrapper.text()).not.toContain("已校验证据");
  });

  it("emits an explicit intent when a clarification option is selected", async () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          block({
            pending_action: {
              action: "clarify_intent",
              prompt: "请选择意图",
              reason: "需要明确只读路径",
              intent_options: [{ intent: "explain", label: "说明当前页面" }],
            },
          }),
        ],
      },
    });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("flow-resume")).toEqual([
      [{ blockId: "flow-block-1", action: "clarify_intent", intent: "explain" }],
    ]);
  });

  it("does not expose a second navigation approval in the durable flow card", async () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          block({
            title: "页面导航流程",
            detail: "将打开已授权的指标页面。",
            pending_action: {
              action: "confirm_navigation",
              prompt: "是否打开助手建议的目标页面？",
              reason: "只会跳转到已发布页面。",
            },
          }),
        ],
      },
    });
    expect(wrapper.text()).toContain("不会再次要求批准");
    expect(wrapper.findAll("button")).toHaveLength(1); // cancel only; navigation is confirmed by its own card
    expect(wrapper.emitted("flow-resume")).toBeUndefined();
  });

  it("shows published page labels instead of internal page ids", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            block_type: "agent_navigation",
            block_id: "navigation-labels",
            flow_id: "flow-navigation",
            status: "pending",
            detail: "将打开已授权页面。",
            target_pages: ["metrics", "fabric"],
            required_capabilities: ["metrics"],
            authorization: {
              authorization_id: "authz-navigation",
              authorization_digest: "sha256:" + "a".repeat(64),
              max_navigation_attempts: 2,
              max_model_calls: 1,
              max_tool_calls_per_round: 2,
              max_run_creations: 0,
              max_execution_time_ms: 30_000,
              allowed_pages: ["metrics", "fabric"],
              allowed_actions: ["navigate"],
            },
            event_sequence: 1,
            binding: {
              session_id: "session-test",
              flow_id: "flow-navigation",
              run_id: null,
              run_context_revision: null,
              backend_identity: { backend: "fixture" },
              schema_set_revision: "sha256:" + "e".repeat(64),
              input_snapshot_digest: null,
              artifact_bindings: [],
            },
          },
        ],
      },
    });
    expect(wrapper.text()).toContain("性能指标");
    expect(wrapper.text()).toContain("网络与通信");
    expect(wrapper.text()).not.toContain("metrics");
    expect(wrapper.text()).not.toContain("fabric");
  });
});
