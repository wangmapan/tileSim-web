/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ExecutionVisualizationPanel from "../../src/features/execution-inspector/components/ExecutionVisualizationPanel.vue";

describe("execution visualization panel", () => {
  it("does not initialize a chart for unavailable data", () => {
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "empty",
          kind: "none",
          title: "没有数据",
          description: "保留字段表。",
          rationale: "数据不足。",
          unit: "",
          sourcePaths: [],
          derivation: "identity",
          columns: ["值"],
          series: [],
          rows: [],
          emptyReason: "JSON 中没有对应字段。",
        },
      },
    });
    expect(wrapper.find(".execution-chart").exists()).toBe(false);
    expect(wrapper.text()).toContain("JSON 中没有对应字段");
  });

  it("shows matrix values and their JSON source paths without a chart", () => {
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "matrix",
          kind: "matrix",
          title: "来源",
          description: "状态字段。",
          rationale: "分类数据不使用数量图。",
          unit: "",
          sourcePaths: ["/validation/trace_provenance/source_mode"],
          derivation: "identity",
          columns: ["报告值"],
          series: [],
          rows: [
            {
              label: "source_mode",
              values: ["real_trace"],
              sourcePath: "/validation/trace_provenance/source_mode",
            },
            {
              label: "calibration_level",
              values: [null],
              sourcePath: "/validation/trace_provenance/calibration_level",
            },
          ],
        },
      },
    });
    expect(wrapper.find(".execution-chart").exists()).toBe(false);
    expect(wrapper.text()).toContain("real_trace");
    expect(wrapper.text()).toContain("/validation/trace_provenance/source_mode");
    expect(wrapper.text()).toContain("字段质量提醒");
    expect(wrapper.text()).toContain("calibration_level");
  });
});
