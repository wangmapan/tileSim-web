import { describe, expect, it } from "vitest";

const pageSources = import.meta.glob("../../src/views/Lightweight*.vue", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;
const page = (name: string) => pageSources[`../../src/views/${name}`] || "";

describe("lightweight page contract boundaries", () => {
  it("keeps views orchestrating through public feature entrypoints", () => {
    for (const name of ["LightweightPrepareView.vue", "LightweightRunView.vue", "LightweightResultsView.vue"]) {
      const source = page(name);
      expect(source).not.toMatch(/bridgeApi/);
      expect(source).not.toMatch(/setTimeout\s*\(/);
    }
  });

  it("publishes lightweight prepare context through the shared run-experiment adapter", () => {
    const prepare = page("LightweightPrepareView.vue");
    expect(prepare).toContain("buildExperimentAgentContextPublication");
    expect(prepare).toContain("ExperimentAgentContextPublisher");
    expect(prepare).toContain("agentContextPublisher");
    expect(prepare).toContain('pageId: "lightweight-prepare"');
    expect(prepare).toContain('routeName: "lightweight_prepare"');
    expect(prepare).toContain('displayLabel: "轻量实验配置"');
    expect(prepare).not.toContain("createLightweightAgentAdapter");
  });

  it("does not synthesize progress or coerce missing metrics to zero", () => {
    const run = page("LightweightRunView.vue");
    const results = page("LightweightResultsView.vue");
    expect(run).toContain("setInterval");
    expect(run).toContain("terminal");
    expect(results).toContain('t("missing")');
    expect(results).toContain("fabric_utilization_ratio == null");
    expect(results).toContain("trace_provenance");
  });

  it("keeps run evidence identity and polling stop semantics visible", () => {
    const run = page("LightweightRunView.vue");
    expect(run).toContain("artifact SHA-256");
    expect(run).toContain("schema revision");
    expect(run).toContain("已停止自动轮询（终态）");
    expect(run).toContain("重新配置");
    expect(run).toContain("statusDetail");
  });

  it("presents result provenance before detail and preserves unsupported states", () => {
    const results = page("LightweightResultsView.vue");
    expect(results).toContain("证据索引");
    expect(results).toContain("unsupported_schema");
    expect(results).toContain("staleManifest");
    expect(results).toContain("resolvedFidelity");
    expect(results).toContain("通信域利用率（%）");
    expect(results).toContain("未生成演示图表");
    expect(results).not.toContain("完成一次正式 run 后，真实报告会显示在这里");
  });

  it("keeps the lightweight landing page free of inline tutorial cards and helper copy", () => {
    const home = page("LightweightWorkbenchView.vue");
    expect(home).toContain("ensureBridgeReady");
    expect(home).toContain("loadHistory");
    expect(home).not.toContain("用必要配置完成真实 run");
    expect(home).not.toContain("从实验名称、场景、输入来源");
    expect(home).not.toContain("查看同一实验的完整细节");
    expect(home).not.toContain("LightweightLearningCards");
    expect(home).not.toContain("LightweightTaskCards");
  });

  it("keeps the desktop confirmation action discoverable without covering narrow layouts", () => {
    const prepare = page("LightweightPrepareView.vue");
    expect(prepare).toContain("position: sticky");
    expect(prepare).toContain("@media (min-width: 1100px)");
  });
});
