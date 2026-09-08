/** @vitest-environment jsdom */

import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import OverviewView from "../../src/views/OverviewView.vue";
import UtilizationMeasure from "../../src/components/ui/UtilizationMeasure.vue";
import StatusPill from "../../src/components/StatusPill.vue";
import { useDashboard } from "../../src/store/dashboard";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
const { state } = useDashboard();
beforeEach(() => {
  setLocale("zh-CN");
  state.isDemo = false;
  state.runId = null;
  state.artifactManifest = null;
  state.bundle.run = { status: "partial", summary: { end_to_end_latency_us: 0 } };
  state.bundle.metrics = { system_summary: { fabric_domain_utilization: [] } };
});
afterEach(() => setLocale("zh-CN"));

describe("utilization measure", () => {
  it.each([
    [0, "0%", "0%"],
    [0.67, "67%", "67%"],
    [1, "100%", "100%"],
    [undefined, "—", null],
    [null, "—", null],
    [-0.1, "-10%", null],
    [1.2, "120%", null],
    [NaN, "—", null],
  ])("preserves %s without inventing or clipping the displayed value", (value, text, width) => {
    const wrapper = mount(UtilizationMeasure, { props: { value, text } });
    expect(wrapper.get("strong").text()).toBe(text);
    const bar = wrapper.find(".utilization-measure__track > span");
    expect(bar.exists()).toBe(width !== null);
    if (width !== null) expect(bar.element.style.width).toBe(width);
  });
});

describe("overview workbench", () => {
  it.each(["failed", "running", "unknown", undefined])("does not describe %s as a completed run", (status) => {
    state.bundle.run.status = status;
    const wrapper = mount(OverviewView);
    expect(wrapper.get(".analysis-stage__primary h2").text()).toBe("运行摘要");
    expect(wrapper.getComponent(StatusPill).props("value")).toBe(status || "unknown");
    expect(wrapper.get(".analysis-stage__primary").text()).not.toContain("已完成");
    expect(wrapper.get(".hero-measure strong").text()).toBe("0");
  });

  it("keeps the partial boundary, caps domain DOM and preserves report order", async () => {
    state.bundle.metrics.system_summary.fabric_domain_utilization = Array.from({ length: 100 }, (_, index) => ({
      domain_id: `domain-${index}`,
      utilization_ratio: index === 0 ? 0 : undefined,
    }));
    const wrapper = mount(OverviewView);
    expect(wrapper.getComponent(StatusPill).props("value")).toBe("partial");
    expect(wrapper.getComponent(StatusPill).text()).toBe("部分完成");
    const rows = wrapper.findAll(".overview-domain-list tr");
    expect(rows).toHaveLength(6);
    expect(rows[0].text()).toContain("domain-0");
    expect(rows[0].text()).toContain("0%");
    expect(rows[1].text()).toContain("—");
    expect(rows[5].text()).toContain("domain-5");
    state.bundle.metrics = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".overview-domain-list tr")).toHaveLength(0);
    expect(wrapper.get(".overview-network-empty").text()).toContain("不以请求数或总时长推算");
  });

  it("uses current module terminology without rewriting the raw bottleneck report", async () => {
    state.bundle.run.bottleneck_report = { primary_subsystem: "S6", title: "raw-S6", detail: "unmodified evidence" };
    const wrapper = mount(OverviewView);
    expect(wrapper.get(".finding-panel h2").text()).toBe("网络与硬件资源模块");
    expect(wrapper.get(".finding-raw-disclosure").text()).toContain("raw-S6");
    setLocale("en-US");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".finding-panel h2").text()).toBe("Network and hardware resources");
    expect(wrapper.get(".overview-network-empty").text()).not.toMatch(/[\u3400-\u9fff]/u);
    expect(wrapper.get(".overview-analysis-index").text()).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("shows reported delays with explicit units, retaining zero and missing values", () => {
    state.bundle.metrics.system_summary.fabric_domain_utilization = [
      { domain_id: "domain-zero", utilization_ratio: 0, queue_delay_us: 0, congestion_delay_us: 12.34 },
      { domain_id: "domain-missing" },
    ];
    const wrapper = mount(OverviewView);
    const headers = wrapper.findAll(".overview-network-table thead th");
    expect(headers.map((header) => header.text())).toEqual(["域", "利用率0–100%", "队列延迟µs", "拥塞延迟µs"]);
    const rows = wrapper.findAll(".overview-domain-list tr");
    expect(rows[0].get('th[scope="row"]').text()).toBe("domain-zero");
    expect(rows[0].findAll("td").map((cell) => cell.text())).toEqual(["0%", "0", "12.34"]);
    expect(rows[1].findAll("td").map((cell) => cell.text())).toEqual(["—", "—", "—"]);
    expect(wrapper.get(".hero-measure strong").text()).toBe("0");
    expect(wrapper.get(".workbench-note").text()).toContain("不相加解释为请求耗时");
  });

  it("retains one overview control per analysis destination", () => {
    const wrapper = mount(OverviewView);
    const labels = wrapper.findAll("button").map((button) => button.text());
    for (const label of ["查看执行过程", "查看性能指标", "结果可信度", "查看网络与通信"]) {
      expect(labels.filter((text) => text === label)).toHaveLength(1);
    }
  });
});
