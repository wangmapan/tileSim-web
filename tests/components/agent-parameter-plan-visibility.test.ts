/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentTypedBlockList from "../../src/features/agent-copilot-shell/AgentTypedBlockList.vue";
import type { AgentTypedBlock } from "../../src/entities/agent-orchestration";

function block(incomplete: readonly string[] = []): AgentTypedBlock {
  return {
    block_type: "parameter_edits",
    block_id: "plan-16",
    title: "16 卡 TP16 多节点",
    rationale: "拟扩容到 16 卡。",
    edits: [
      {
        path: "topology/devices",
        label: "设备数量",
        target: "topology",
        fieldId: null,
        previous: "4",
        next: "16",
        value: 16,
      },
    ],
    rejected: [],
    unknown: [],
    receipts: null,
    channelMoved: false,
    note: "",
    reasons: {},
    incomplete,
    plan_revision: "revision-1",
  };
}

describe("assistant parameter-plan visibility", () => {
  it("offers the confirm action only for a complete plan", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [block()] } });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("apply")?.[0]).toEqual(["plan-16"]);
  });

  it("names omitted addresses and never offers an incomplete plan for application", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: { blocks: [block(["topology/devices[15]/group_id：多节点方案缺少设备分组"])] },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("方案不完整");
    expect(wrapper.text()).toContain("topology/devices[15]/group_id");
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("确认无误后按下按钮");
  });
});
