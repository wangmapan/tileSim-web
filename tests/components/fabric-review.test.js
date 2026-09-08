/** @vitest-environment jsdom */

import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import FabricView from "../../src/views/FabricView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
const { state } = useDashboard();
const options = { global: { stubs: { ExecutionVisualizationPanel: true, ArtifactEvidenceLink: true } } };
beforeEach(() => {
  setLocale("zh-CN");
  state.artifactManifest = null;
  state.inputs.topology = null;
  state.bundle.metrics = {
    report_id: "fabric-review",
    system_summary: {
      fabric_utilization_ratio: 0,
      fabric_domain_utilization: [{ domain_id: "domain-0", utilization_ratio: 0, runtime_us: 0 }],
    },
  };
});
afterEach(() => setLocale("zh-CN"));

describe("network evidence presentation", () => {
  it("does not claim a reported hotspot when the domain or delay type is missing", async () => {
    const wrapper = mount(FabricView, options);
    expect(wrapper.get(".fabric-hotspot-panel").text()).toContain("主要通信瓶颈信息不完整");
    expect(wrapper.get(".fabric-hotspot-panel").text()).not.toContain("后端报告指出");
    state.bundle.metrics.system_summary.dominant_fabric_backpressure_domain_id = "domain-0";
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".fabric-hotspot-panel h2").text()).toContain("信息不完整");
    state.bundle.metrics.system_summary.dominant_fabric_backpressure_kind = "queue";
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".fabric-hotspot-panel h2").text()).toBe("当前主要通信瓶颈");
    expect(wrapper.get(".fabric-domain-table tbody tr").text()).toContain("0%");
    expect(wrapper.get(".fabric-domain-table tbody tr").text()).toContain("— µs");
    expect(wrapper.get(".fabric-domain-table tbody tr").text()).toContain("0 µs");
  });

  it("bounds domain and request DOM while retaining report order and deferred details", async () => {
    state.bundle.metrics.system_summary.fabric_domain_utilization = Array.from({ length: 60 }, (_, index) => ({
      domain_id: `domain-${index}`,
      utilization_ratio: 0,
    }));
    state.bundle.metrics.system_summary.request_fabric_contributions = Array.from({ length: 60 }, (_, index) => ({
      request_id: `request-${index}`,
      queue_delay_us: 0,
    }));
    const wrapper = mount(FabricView, options);
    expect(wrapper.findAll(".domain-card")).toHaveLength(0);
    expect(wrapper.findAll(".fabric-domain-table tbody tr")).toHaveLength(25);
    expect(wrapper.findAll(".fabric-request-table tbody tr")).toHaveLength(25);
    await wrapper.get('[aria-label="请求通信贡献分页"] button:last-child').trigger("click");
    expect(wrapper.findAll(".fabric-request-table tbody tr")[0].text()).toContain("request-25");
    const details = wrapper.get(".fabric-domain-disclosure");
    details.element.open = true;
    await details.trigger("toggle");
    expect(wrapper.findAll(".domain-card")).toHaveLength(25);
    await wrapper.get('[aria-label="通信范围详情分页"] button:last-child').trigger("click");
    expect(wrapper.findAll(".domain-card")[0].text()).toContain("domain-25");
    expect(wrapper.findAll(".fabric-domain-table tbody tr")[0].text()).toContain("domain-25");
    details.element.open = false;
    await details.trigger("toggle");
    expect(wrapper.findAll(".domain-card")).toHaveLength(0);
  });

  it("keeps missing summaries as an empty state in both languages", async () => {
    state.bundle.metrics = null;
    const wrapper = mount(FabricView, options);
    expect(wrapper.get(".empty-state").text()).toContain("还没有网络与通信数据");
    expect(wrapper.find(".fabric-summary").exists()).toBe(false);
    setLocale("en-US");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".empty-state").text()).not.toContain("网络");
  });
});
