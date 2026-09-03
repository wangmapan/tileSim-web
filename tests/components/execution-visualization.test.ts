/** @vitest-environment jsdom */

import { flushPromises, mount } from "@vue/test-utils";
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
          question: "是否有足够数据？",
          firstLook: "先看缺失原因。",
          boundary: "不补造数据。",
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
    expect(wrapper.find(".visualization-reading-protocol").exists()).toBe(false);
    expect(wrapper.get(".visualization-caption").text()).toBe("保留字段表。");
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
          question: "报告声明了什么来源？",
          firstLook: "先看报告值。",
          boundary: "分类值不用于数值比较。",
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

  it("keeps the complete table and exposes the selected row's exact evidence source", async () => {
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "selectable",
          kind: "bar",
          title: "请求比较",
          description: "直接显示报告值。",
          question: "哪个请求更慢？",
          firstLook: "先看最长条。",
          boundary: "不重算指标。",
          rationale: "离散请求使用条形图。",
          unit: "µs",
          sourcePaths: ["metrics:/request_metrics/*/end_to_end_latency_ps"],
          derivation: "unit_conversion",
          columns: ["端到端"],
          rawColumns: ["end_to_end_latency_ps"],
          rawUnit: "ps",
          series: [{ name: "端到端" }],
          rows: [
            {
              label: "request-0",
              values: [12.5],
              rawValues: ["12500000"],
              sourcePath: "metrics:/request_metrics/0",
            },
            {
              label: "request-1",
              values: [0],
              rawValues: ["0"],
              sourcePath: "metrics:/request_metrics/1",
            },
          ],
        },
      },
      global: {
        stubs: {
          ArtifactEvidenceLink: {
            props: ["sourcePath", "label"],
            template: '<a class="evidence-link-stub" :data-source-path="sourcePath">{{ label }}</a>',
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.find(".visualization-reading-protocol").exists()).toBe(false);
    expect(wrapper.get(".visualization-caption").text()).toBe("直接显示报告值。");
    expect(wrapper.findAll(".visualization-table-scroll tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("end_to_end_latency_ps: 0 ps");
    wrapper.findComponent({ name: "AsyncComponentWrapper" }).vm.$emit("rowSelected", 0);
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".visualization-selection").text()).toContain("request-0");
    expect(wrapper.find('.visualization-selection [data-source-path="metrics:/request_metrics/0"]').exists()).toBe(
      true,
    );
  });
});
