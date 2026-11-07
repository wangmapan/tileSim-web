/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import AgentExplorationAuthorizationCard from "../../src/features/agent-exploration/components/AgentExplorationAuthorizationCard.vue";
import AgentExplorationPlanningCard from "../../src/features/agent-exploration/components/AgentExplorationPlanningCard.vue";
import AgentExplorationPanel from "../../src/features/agent-exploration/components/AgentExplorationPanel.vue";
import { shouldUnlockAfterCancel } from "../../src/features/agent-exploration/exploration-lock";
import { cancelExplorationLifecycle } from "../../src/features/agent-exploration/lifecycle";

const session = {
  session_id: "exploration-ui",
  current_page_id: "experiment",
  objective: { metric_path: "/metrics/latency_us", direction: "minimize" },
  budget: {
    max_rounds: 10,
    max_runs: 10,
    max_concurrency: 1,
    max_no_improvement: 3,
    max_failures: 2,
    max_execution_time_ms: 900000,
    max_model_calls: 24,
    max_tool_calls_per_round: 4,
  },
  state: "waiting_authorization",
  parameter_grants: [{ pointer: "/x", min: 1, max: 4, step: 1, kind: "number" }],
  allowed_pages: ["experiment", "execution", "metrics"],
};

describe("Agent exploration controls", () => {
  it("keeps planning recommendations separate until explicit confirmation", async () => {
    const wrapper = mount(AgentExplorationPlanningCard, {
      props: {
        planning: {
          plan: {
            status: "awaiting_confirmation",
            message: "请检查规划",
            questions: [{ prompt: "是否采用低、中、高场景？" }],
            recommendations: [{ field: "主要优化指标", value: "端到端延迟 P99", reason: "覆盖尾延迟" }],
            would_create_run: false,
            would_claim_slot: false,
          },
        },
      },
    });
    expect(wrapper.text()).toContain("端到端延迟 P99");
    expect(wrapper.text()).toContain("确认前：不创建运行");
    await wrapper.get("[data-agent-exploration-plan-confirm]").trigger("click");
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });

  it("renders the one-click authorization button and bounded budget", () => {
    const wrapper = mount(AgentExplorationAuthorizationCard, { props: { session: session as never } });
    expect(wrapper.text()).toContain("允许助手自动探索");
    expect(wrapper.text()).toContain("10 / 10");
    expect(wrapper.text()).toContain("并发数");
  });

  it("renders progress controls after authorization", async () => {
    const detail = {
      session: { ...session, state: "exploring", current_round: 1, run_count: 1, best_candidate_id: null },
      candidate: null,
      summary: null,
    };
    const wrapper = mount(AgentExplorationPanel, { props: { detail: detail as never } });
    expect(wrapper.find("[data-agent-exploration-progress]").exists()).toBe(true);
    expect(wrapper.text()).toContain("自动探索进度");
    expect(wrapper.text()).toContain("暂停");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("pause")).toHaveLength(1);
  });

  it.each(["recovery_required", "manual_intervention_required", "context_expired", "run_failed"])(
    "shows Chinese recovery state and no controls for %s",
    (state) => {
      const detail = { session: { ...session, state, current_round: 1, run_count: 1 }, candidate: null, summary: null };
      const wrapper = mount(AgentExplorationPanel, { props: { detail: detail as never } });
      expect(wrapper.text()).not.toContain(state);
      expect(wrapper.find("button").exists()).toBe(false);
    },
  );

  it("only unlocks after confirmed cancellation", () => {
    expect(shouldUnlockAfterCancel("cancelled")).toBe(true);
    expect(shouldUnlockAfterCancel("recovery_required")).toBe(false);
    expect(shouldUnlockAfterCancel("manual_intervention_required")).toBe(false);
  });

  it.each([
    ["cancelled", true, ""],
    ["recovery_required", false, "实验结果仍无法确认，需要恢复处理"],
    ["manual_intervention_required", false, "自动探索需要人工处理，页面仍保持锁定"],
    ["context_expired", false, "页面上下文已过期，页面仍保持锁定"],
    ["run_failed", false, "实验失败，页面仍保持锁定"],
  ])("cancel lifecycle handles %s", async (state, unlocks, message) => {
    const unlock = vi.fn();
    const setStatus = vi.fn();
    await cancelExplorationLifecycle({
      sessionId: "exploration-ui",
      cancel: async () => ({ session: { state } } as never),
      unlock,
      setStatus,
    });
    expect(unlock).toHaveBeenCalledTimes(unlocks ? 1 : 0);
    if (message) expect(setStatus).toHaveBeenCalledWith(message);
  });

  it("keeps lock when cancel request fails", async () => {
    const unlock = vi.fn();
    await cancelExplorationLifecycle({
      sessionId: "exploration-ui",
      cancel: async () => { throw new Error("network"); },
      unlock,
      setStatus: vi.fn(),
    });
    expect(unlock).not.toHaveBeenCalled();
  });
});
