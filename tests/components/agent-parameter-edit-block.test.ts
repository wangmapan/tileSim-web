/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentTypedBlockList from "../../src/features/agent-copilot-shell/AgentTypedBlockList.vue";
import { markAgentBlocksStale } from "../../src/features/agent-copilot-integration";
import type { AgentTypedBlock } from "../../src/features/agent-copilot-shell";

/**
 * The parameter-edit prototype is the only block whose payload the user pushes
 * back into the page, so its three states are pinned here: a plan waiting for
 * confirmation, a plan the page has answered, and a plan the page has moved on
 * from. The last one must stop being applicable rather than be quietly
 * rewritten — a plan addresses exact indices and the values it read.
 */

type PlanBlock = Extract<AgentTypedBlock, { block_type: "parameter_edits" }>;

const plan: PlanBlock = {
  block_type: "parameter_edits",
  block_id: "parameter-edits:1",
  edits: [
    {
      path: "runtime_trace/policy/max_active_requests",
      label: "max_active_requests",
      target: "runtime_trace",
      fieldId: null,
      previous: "4",
      next: "8",
      value: 8,
    },
    {
      path: "overrides/runtime/kv_capacity_tokens",
      label: "KV 容量",
      target: "control",
      fieldId: "s1.runtime.kv_capacity_tokens",
      previous: null,
      next: "4096",
      value: 4096,
    },
  ],
  rejected: [],
  unknown: [],
  receipts: null,
  channelMoved: false,
  note: "",
  title: "",
  rationale: "",
  plan_revision: "context:lightweight_prepare:1",
};

function section(wrapper: ReturnType<typeof mount>, type: string) {
  return wrapper.get(`[data-block-type="${type}"]`);
}

describe("parameter edit block", () => {
  it("presents a plan as pending and only emits apply when the button is pressed", async () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [plan] } });
    const block = section(wrapper, "parameter_edits");

    expect(wrapper.text()).toContain("待写入 2 项");
    expect(wrapper.text()).toContain("还没写进面板");

    const rows = block.findAll(".agent-block__diff-list li");
    expect(rows).toHaveLength(2);
    // The reader has to be able to see which document a value lands in, not just
    // a friendly label, because one instruction can reach more than one of them.
    expect(rows[0].text()).toContain("runtime_trace/policy/max_active_requests");
    expect(rows[0].text().replace(/\s+/gu, " ")).toContain("4 → 8");
    // An unset previous value has nothing to point from, so there is no arrow.
    expect(rows[1].text().replace(/\s+/gu, " ")).toContain("4096");
    expect(rows[1].text()).not.toContain("→");

    expect(wrapper.emitted("apply")).toBeUndefined();
    await block.get(".agent-block__options button").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([["parameter-edits:1"]]);
  });

  it("replaces the button with the page's receipt once the plan is applied", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            receipts: [
              {
                path: "runtime_trace/policy/max_active_requests",
                label: "max_active_requests",
                previous: "4",
                next: "8",
                status: "applied",
                reason: "",
              },
            ],
            channelMoved: true,
            note: "已写入 1 项；没有创建运行",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("已写入面板");
    expect(wrapper.text()).toContain("已写入 1 项；没有创建运行");
    // The edits moved to the custom-input channel, so say so rather than let the
    // user believe the quick-control knobs alone now carry them.
    expect(wrapper.text()).toContain("自定义输入");
    expect(section(wrapper, "parameter_edits").find(".agent-block__options").exists()).toBe(false);
    expect(wrapper.emitted("apply")).toBeUndefined();
  });

  it("heads a scenario recommendation with its name and reasoning", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            title: "推荐方案：高吞吐 / 离线批量",
            rationale: "把每批塞满、放宽容纳上限，吞吐优先。预设里的 kv_capacity_tokens 找不到，已跳过。",
          },
        ],
      },
    });
    const block = section(wrapper, "parameter_edits");

    expect(block.find(".agent-block__eyebrow").text()).toBe("推荐方案");
    expect(block.get("h3").text()).toBe("推荐方案：高吞吐 / 离线批量");
    // The reasoning is what makes a one-click preset reviewable, so it has to be
    // on screen before the button, not tucked into a details element.
    expect(block.text()).toContain("预设里的 kv_capacity_tokens 找不到，已跳过。");
    expect(block.text()).toContain("还没写进面板");
    expect(block.find(".agent-block__options button").exists()).toBe(true);
  });

  it("offers no button when a recommendation resolved nothing", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            edits: [],
            title: "推荐方案：单卡冒烟 / 先跑通",
            rejected: [{ raw: "max_batch_size", reason: "面板里的控件不接受这个值。" }],
          },
        ],
      },
    });

    expect(section(wrapper, "parameter_edits").find(".agent-block__options").exists()).toBe(false);
    expect(wrapper.text()).toContain("没有写（校验未通过）");
  });

  it("reports the items a page refused instead of showing the whole plan as applied", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            receipts: [
              {
                path: "overrides/runtime/kv_capacity_tokens",
                label: "KV 容量",
                previous: null,
                next: "4096",
                status: "rejected",
                reason: "面板里的控件不接受这个值。",
              },
            ],
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("没有写入面板");
    expect(wrapper.text()).toContain("面板拒绝了这几项");
    expect(wrapper.text()).toContain("KV 容量");
    expect(wrapper.text()).toContain("面板里的控件不接受这个值。");
  });

  it("shows what was not understood alongside the part that can be written", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            rejected: [{ raw: "tp_degree = 4", reason: "「tp_degree」对应 2 个参数，请写完整路径。" }],
            unknown: [{ raw: "把 batch 调大一点", reason: "这一行没有「=」。" }],
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("待写入 2 项");
    expect(wrapper.text()).toContain("没有写（校验未通过）");
    expect(wrapper.text()).toContain("没有看懂");
    expect(wrapper.text()).toContain("这一行没有「=」。");
    // A partly-understood batch must not be applied as if it were complete.
    expect(section(wrapper, "parameter_edits").find(".agent-block__options button").exists()).toBe(false);
  });
});

describe("stale parameter plans", () => {
  it("leaves the plan alone so its addressed values decide whether it applies", () => {
    // Marking used to clear the revision, which refused the plan on the next
    // press whatever the page's values said. A republication is not evidence
    // that the values this plan names moved, so the block keeps its revision
    // and the apply step judges the addresses themselves.
    const [marked] = markAgentBlocksStale([plan], "context:lightweight_prepare:2");

    expect(marked).toBe(plan);
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [marked] } });
    expect(wrapper.text()).toContain("待写入 2 项");
    expect(wrapper.text()).toContain("runtime_trace/policy/max_active_requests");
    expect(section(wrapper, "parameter_edits").find(".agent-block__options button").exists()).toBe(true);
  });

  it("leaves an unrelated block untouched", () => {
    const explanation: AgentTypedBlock = {
      block_type: "explanation",
      block_id: "explain:1",
      title: "页面用途",
      body: "这里用于配置受控仿真实验。",
    };

    const [marked] = markAgentBlocksStale([explanation], "context:lightweight_prepare:2");

    expect(marked).toBe(explanation);
  });

  it("still ages out a draft the page has moved past", () => {
    const draft: AgentTypedBlock = {
      block_type: "validation_result",
      block_id: "phase1-validation",
      overall: "valid",
      issues: [],
    };

    const [marked] = markAgentBlocksStale([draft], "context:lightweight_prepare:2");

    expect(marked.block_type === "validation_result" && marked.overall).toBe("stale");
  });
});

/**
 * A model proposal picks every value separately, so the reasoning belongs next
 * to the value it explains rather than in one paragraph above the list. It is
 * only ever shown for values the panel actually offered, so the section never
 * explains a value that is not on screen.
 */
describe("per-value reasons", () => {
  it("shows the reason beside the value it explains", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            title: "模型推荐方案",
            rationale: "把每批塞满、放宽容纳上限，吞吐优先。",
            reasons: {
              "overrides/runtime/kv_capacity_tokens": "KV 容量按每张卡的可用显存反推。",
              "runtime_trace/policy/max_active_requests": "并发上限抬高，避免请求排队。",
            },
          },
        ],
      },
    });
    const block = section(wrapper, "parameter_edits");
    const sections = block.findAll("section.agent-block__section");
    const reasons = sections.find(
      (candidate) => candidate.find("h4").exists() && candidate.get("h4").text() === "为什么这么设",
    );

    expect(reasons).toBeDefined();
    const rows = reasons?.findAll("li") ?? [];
    // The order follows the diff list, not the reason map, so the reader meets
    // the values in the same order twice.
    expect(rows.map((row) => row.find("strong").text())).toEqual(["max_active_requests", "KV 容量"]);
    expect(rows[1].text()).toContain("KV 容量按每张卡的可用显存反推。");
    // The generic rationale stays on screen too; it explains the plan as a whole.
    expect(block.text()).toContain("把每批塞满、放宽容纳上限，吞吐优先。");
    // Explaining the values must not cost the plan its apply button.
    expect(block.find(".agent-block__options button").exists()).toBe(true);
  });

  it("says nothing when the proposal carries no reasons", () => {
    const wrapper = mount(AgentTypedBlockList, { props: { blocks: [plan] } });
    const block = section(wrapper, "parameter_edits");

    expect(block.text()).not.toContain("为什么这么设");
    expect(block.findAll("section.agent-block__section")).toHaveLength(0);
  });

  it("ignores a reason for a value the panel did not offer", () => {
    const wrapper = mount(AgentTypedBlockList, {
      props: {
        blocks: [
          {
            ...plan,
            reasons: { "runtime_trace/policy/no_such_parameter": "这个值其实没被写进计划。" },
          },
        ],
      },
    });

    expect(wrapper.text()).not.toContain("为什么这么设");
    expect(wrapper.text()).not.toContain("这个值其实没被写进计划。");
  });
});
