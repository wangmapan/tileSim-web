/** @vitest-environment jsdom */

import { enableAutoUnmount, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AttributionView from "../../src/views/AttributionView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
const { state } = useDashboard();
const options = () => ({
  global: {
    plugins: [createPinia()],
    stubs: {
      RunBoundEvidencePanel: true,
      ExecutionVisualizationPanel: { template: '<div class="visualization-panel" />' },
      ArtifactEvidenceLink: {
        props: ["sourcePath"],
        template: '<span class="evidence-stub" :data-source="sourcePath" />',
      },
    },
  },
});
beforeEach(() => {
  setLocale("zh-CN");
  state.runId = "run-review";
  state.bundle.tail = {
    report_id: "review",
    explained_entity: { kind: "request", id: "request-review" },
    confidence: 0,
    completeness: 0.75,
    attribution_ranking: [],
    attribution_audit: {},
  };
});
afterEach(() => setLocale("zh-CN"));
async function openReview() {
  const wrapper = mount(AttributionView, options());
  await wrapper.get('[data-help-anchor="attribution-ranking"]').trigger("click");
  return wrapper;
}
async function expand(wrapper, selector) {
  const details = wrapper.get(selector);
  details.element.open = true;
  await details.trigger("toggle");
}

describe("attribution evidence presentation", () => {
  it("keeps zero, missing and out-of-range shares distinct without invented bar lengths", async () => {
    state.bundle.tail.attribution_ranking = [0, undefined, -0.1, 1.2, 0.35].map((share, index) => ({
      attribution_id: `item-${index}`,
      subsystem: "S6",
      rank: 5 - index,
      share,
      score_ps: "9007199254740993",
    }));
    const wrapper = await openReview();
    const rows = wrapper.findAll(".ranking-row");
    expect(rows[0].get(".rank-bar span").element.style.width).toBe("0%");
    expect(rows[0].text()).toContain("0%");
    expect(rows[1].find(".rank-bar span").exists()).toBe(false);
    expect(rows[1].get(".attribution-share").text()).toBe("—");
    for (const row of rows.slice(2, 4)) {
      expect(row.find(".rank-bar span").exists()).toBe(false);
      expect(row.text()).toContain("不绘制份额条");
    }
    expect(rows[2].text()).toContain("-10%");
    expect(rows[3].text()).toContain("120%");
    expect(rows[4].get(".rank-bar span").element.style.width).toBe("35%");
    expect(rows[0].text()).toContain("9,007,199,254,740,993");
    expect(rows.map((row) => row.get(".rank-index").text())).toEqual(["5", "4", "3", "2", "1"]);
    expect(wrapper.get(".attribution-primary-summary").text()).toContain("不代表真实系统准确率");
  });

  it("paginates original evidence positions and defers audit and cause details", async () => {
    state.bundle.tail.attribution_ranking = [
      { attribution_id: "host", subsystem: "S7", rank: 99, share: 0.5 },
      ...Array.from({ length: 60 }, (_, index) => ({
        attribution_id: `item-${index}`,
        subsystem: "S6",
        rank: index + 1,
        component_code: `component-${index}`,
        share: 0.2,
      })),
    ];
    state.bundle.tail.cause_chain = Array.from({ length: 60 }, (_, index) => ({
      cause_id: `cause-${index}`,
      subsystem: "S6",
      title: `cause-${index}`,
    }));
    const wrapper = await openReview();
    expect(wrapper.findAll(".ranking-row")).toHaveLength(25);
    expect(wrapper.findAll(".attribution-output-plane tbody tr")).toHaveLength(1);
    expect(wrapper.findAll(".attribution-audit-grid, .cause-chain li")).toHaveLength(0);
    await wrapper.get('[aria-label="贡献项分页"] button:last-child').trigger("click");
    expect(wrapper.findAll(".ranking-row")[0].text()).toContain("component-25");
    expect(wrapper.findAll(".ranking-row")[0].get(".evidence-stub").attributes("data-source")).toBe(
      "tail-cause-chain:/attribution_ranking/26",
    );
    await expand(wrapper, ".attribution-cause-disclosure");
    expect(wrapper.findAll(".cause-chain li")).toHaveLength(25);
    await wrapper.get('[aria-label="原因记录分页"] button:last-child').trigger("click");
    expect(wrapper.findAll(".cause-chain li")[0].get("span").text()).toBe("26");
    expect(wrapper.findAll(".cause-chain li")[0].get(".evidence-stub").attributes("data-source")).toBe(
      "tail-cause-chain:/cause_chain/25",
    );
    const order = wrapper
      .findAll(
        ".attribution-primary-summary, .visualization-panel, .attribution-ranking-panel, .attribution-audit, .attribution-cause-disclosure",
      )
      .map((node) =>
        node
          .classes()
          .find((name) =>
            [
              "attribution-primary-summary",
              "visualization-panel",
              "attribution-ranking-panel",
              "attribution-audit",
              "attribution-cause-disclosure",
            ].includes(name),
          ),
      );
    expect(order).toEqual([
      "attribution-primary-summary",
      "visualization-panel",
      "attribution-ranking-panel",
      "attribution-audit",
      "attribution-cause-disclosure",
    ]);
    state.bundle.tail = {
      report_id: "replacement",
      attribution_ranking: [{ subsystem: "S6", component_code: "replacement" }],
    };
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".ranking-row")).toHaveLength(1);
    expect(wrapper.findAll(".cause-chain li")).toHaveLength(0);
  });

  it("does not treat unreported audit booleans as failure and preserves false explicitly", async () => {
    const wrapper = await openReview();
    await expand(wrapper, ".attribution-audit");
    const fields = wrapper.findAll(".attribution-audit-grid > div");
    expect(fields[3].text()).toContain("未报告");
    expect(fields[4].text()).toContain("未报告");
    state.bundle.tail.attribution_audit.conserved = false;
    state.bundle.tail.attribution_audit.propagation_complete = true;
    await wrapper.vm.$nextTick();
    expect(fields[3].text()).toContain("未通过");
    expect(fields[4].text()).toContain("完整");
    setLocale("en-US");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".attribution-primary-summary").text()).toContain("not real-system accuracy");
    expect(wrapper.get(".attribution-no-records").text()).toContain("No latency contributions");
  });
});
