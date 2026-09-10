/** @vitest-environment jsdom */

import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, onMounted, onUnmounted } from "vue";
import ExecutionVisualizationPanel from "../../src/features/execution-inspector/components/ExecutionVisualizationPanel.vue";
import type { LayerVisualization } from "../../src/features/execution-inspector/model/types";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
afterEach(() => setLocale("zh-CN"));

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
    expect(wrapper.text()).toContain("输入来源模式");
    expect(wrapper.text()).toContain("真实系统采集 Trace");
    expect(wrapper.text()).toContain("技术字段：source_mode = real_trace");
    expect(wrapper.text()).toContain("/validation/trace_provenance/source_mode");
    expect(wrapper.text()).toContain("字段质量提醒");
    expect(wrapper.text()).toContain("calibration_level");
  });

  it("uses explained English labels and retains raw field/value pairs", () => {
    setLocale("en-US");
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "semantic-matrix-en",
          kind: "matrix",
          title: "来源",
          description: "状态字段。",
          question: "报告声明了什么来源？",
          firstLook: "先看报告值。",
          boundary: "分类值不用于数值比较。",
          rationale: "分类数据不使用数量图。",
          unit: "",
          sourcePaths: ["validation:/trace_provenance/source_mode"],
          derivation: "identity",
          columns: ["报告值"],
          series: [],
          rows: [
            {
              label: "source_mode",
              values: ["synthetic_trace"],
              sourcePath: "validation:/trace_provenance/source_mode",
            },
          ],
        },
      },
    });
    expect(wrapper.text()).toContain("Input source mode");
    expect(wrapper.text()).toContain("Synthetic trace");
    expect(wrapper.text()).toContain("Generated, not captured from a real system");
    expect(wrapper.text()).toContain("Technical field: source_mode = synthetic_trace");
  });

  it("shows safe unknown-field and unknown-value fallbacks with raw traceability", () => {
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "unknown-matrix",
          kind: "matrix",
          title: "来源",
          description: "状态字段。",
          question: "报告声明了什么来源？",
          firstLook: "先看报告值。",
          boundary: "分类值不用于数值比较。",
          rationale: "分类数据不使用数量图。",
          unit: "",
          sourcePaths: ["validation:/future_field"],
          derivation: "identity",
          columns: ["报告值"],
          series: [],
          rows: [{ label: "future_field", values: ["future_value"], sourcePath: "validation:/future_field" }],
        },
      },
    });
    expect(wrapper.text()).toContain("未收录字段");
    expect(wrapper.text()).toContain("未识别值");
    expect(wrapper.text()).toContain("future_field = future_value");
    expect(wrapper.text()).toContain("validation:/future_field");
  });

  it("keeps self-explanatory calibration and fidelity states compact", () => {
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: {
        visualization: {
          id: "compact-fidelity-matrix",
          kind: "matrix",
          title: "精细度",
          description: "状态字段。",
          question: "本次使用什么精细度？",
          firstLook: "先看报告值。",
          boundary: "分类值不用于数值比较。",
          rationale: "分类数据不使用数量图。",
          unit: "",
          sourcePaths: ["validation:/resolution_entries/0"],
          derivation: "identity",
          columns: ["报告值"],
          series: [],
          rows: [
            {
              label: "calibration_level",
              values: ["uncalibrated"],
              sourcePath: "validation:/trace_provenance/calibration_level",
            },
            {
              label: "requested_fidelity",
              values: ["des"],
              sourcePath: "validation:/resolution_entries/0/requested_fidelity",
            },
            {
              label: "actual_fidelity",
              values: ["analytical"],
              sourcePath: "validation:/resolution_entries/0/actual_fidelity",
            },
          ],
        },
      },
    });
    expect(wrapper.text()).toContain("校准级别未校准");
    expect(wrapper.text()).toContain("请求的仿真精细度离散事件模拟（DES）");
    expect(wrapper.text()).toContain("实际仿真精细度分析估算（Analytical）");
    expect(wrapper.text()).toContain("calibration_level = uncalibrated");
    expect(wrapper.text()).not.toContain("真实测量校准证据");
    expect(wrapper.text()).not.toContain("全局时间轴上的动态事件模拟");
    expect(wrapper.text()).not.toContain("结构化成本模型估算");
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
    expect(wrapper.findAll(".visualization-table-scroll tbody tr")).toHaveLength(0);
    const disclosure = wrapper.get<HTMLDetailsElement>(".visualization-data");
    disclosure.element.open = true;
    await disclosure.trigger("toggle");
    expect(wrapper.findAll(".visualization-table-scroll tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("end_to_end_latency_ps: 0 ps");
    wrapper.findComponent({ name: "AsyncComponentWrapper" }).vm.$emit("rowSelected", 0);
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".visualization-selection").text()).toContain("request-0");
    expect(wrapper.find('.visualization-selection [data-source-path="metrics:/request_metrics/0"]').exists()).toBe(
      true,
    );
  });

  it("pages exact field values only while expanded without remounting the chart", async () => {
    let mounts = 0;
    let disposals = 0;
    const chartProbe = defineComponent({
      setup() {
        onMounted(() => {
          mounts += 1;
        });
        onUnmounted(() => {
          disposals += 1;
        });
        return () => h("div", { class: "chart-probe" });
      },
    });
    const visualization: LayerVisualization = {
      id: "paged-evidence",
      kind: "bar",
      title: "请求比较",
      description: "报告原值",
      question: "",
      firstLook: "",
      boundary: "不补造数据。",
      rationale: "",
      unit: "µs",
      sourcePaths: ["metrics:/request_metrics"],
      derivation: "identity",
      columns: ["值"],
      rawColumns: ["exact_ps"],
      rawUnit: "ps",
      series: [{ name: "值" }],
      rows: Array.from({ length: 60 }, (_, index) => ({
        label: `request-${index}`,
        values: [index === 0 ? 0 : null],
        rawValues: [index === 50 ? "9007199254740993" : "0"],
        sourcePath: `metrics:/request_metrics/${index}`,
        status: index === 59 ? "reported" : undefined,
      })),
    };
    const wrapper = mount(ExecutionVisualizationPanel, {
      props: { visualization, showBoundary: true },
      global: { stubs: { ExecutionChart: chartProbe, ArtifactEvidenceLink: true } },
    });
    await flushPromises();
    expect(mounts).toBe(1);
    expect(wrapper.find(".visualization-table-scroll").exists()).toBe(false);
    expect(wrapper.get(".visualization-boundary").text()).toContain("不补造数据");
    const disclosure = wrapper.get<HTMLDetailsElement>(".visualization-data");
    disclosure.element.open = true;
    await disclosure.trigger("toggle");
    expect(wrapper.findAll("tbody tr")).toHaveLength(25);
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("0");
    expect(wrapper.get("thead").text()).toContain("报告状态");
    await wrapper.get(".record-pager button:last-child").trigger("click");
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("request-25");
    await wrapper.get(".record-pager button:last-child").trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("9007199254740993");
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("metrics:/request_metrics/50");
    wrapper.findComponent(chartProbe).vm.$emit("rowSelected", 0);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".visualization-selection").exists()).toBe(true);
    await wrapper.setProps({ visualization: { ...visualization, rows: visualization.rows.slice(0, 2) } });
    expect(wrapper.find(".visualization-selection").exists()).toBe(false);
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.find(".record-pager").exists()).toBe(false);
    disclosure.element.open = false;
    await disclosure.trigger("toggle");
    expect(wrapper.find(".visualization-table-scroll").exists()).toBe(false);
    expect(mounts).toBe(1);
    expect(disposals).toBe(0);
    wrapper.unmount();
    expect(disposals).toBe(1);
  });
});
