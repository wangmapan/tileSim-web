// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentCopilotShell from "../../src/features/agent-copilot-shell/AgentCopilotShell.vue";
import { PHASE1_LOCAL_CONTRACT_REVISION } from "../../src/entities/agent-orchestration";

const context = {
  contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
  page_id: "test-page",
  route_name: "experiment",
  context_revision: "context:test",
  workspace_ref: null,
  run_ref: null,
  selected_entity: null,
  resources: [],
  supported_actions: ["explain"] as const,
  data_classification: "public" as const,
  allowed_purposes: ["explain"] as const,
  expires_at: null,
  display_label: "实验设置",
  availability: "available" as const,
};

describe("AgentCopilotShell accessibility", () => {
  it("uses one live region for status without assigning status to footer", () => {
    const wrapper = mount(AgentCopilotShell, {
      props: {
        modelValue: "open",
        context,
        blocks: [],
        statusLabel: "正在等待模型",
        persistenceError: true,
        sessions: [{ id: "s1", title: "新会话", updated_at: "2026-09-28T00:00:00Z", message_count: 0, block_count: 0 }],
        activeSessionId: "s1",
        retentionNotice: "本地会话缓存：7 天后自动过期",
      },
    });

    const footer = wrapper.find(".agent-copilot-shell__footer");
    expect(footer.exists()).toBe(true);
    expect(footer.element.tagName).toBe("DIV");
    expect(footer.attributes("role")).toBeUndefined();
    expect(footer.attributes("aria-live")).toBe("polite");
    expect(footer.attributes("aria-atomic")).toBe("true");
    expect(footer.text()).toContain("正在等待模型");
    expect(footer.text()).toContain("本机存储不可用");
    expect(wrapper.find("footer[role='status']").exists()).toBe(false);
    expect(wrapper.find(".agent-copilot-shell__retention").text()).toContain("7 天");
    expect(wrapper.find("button[aria-label='清理全部本地会话']").exists()).toBe(true);
    wrapper.unmount();
  });

  it("exposes a deletable local-session action without adding another live region", async () => {
    const wrapper = mount(AgentCopilotShell, {
      props: { modelValue: "open", context, blocks: [], sessions: [], retentionNotice: "本地缓存" },
    });
    expect(wrapper.findAll("[aria-live='polite']").length).toBe(1);
    wrapper.unmount();
  });
});
