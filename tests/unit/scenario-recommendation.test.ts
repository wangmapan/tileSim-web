import { describe, expect, it } from "vitest";
import {
  buildExperimentSurface,
  buildParameterCatalog,
  describeAgentParameterCatalog,
  createExperimentForm,
  modelScenarioRecommendation,
  parameterKeyOf,
  resolveCatalogPath,
  type ParameterCatalogEntry,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

const runtimeJson = JSON.stringify({
  trace_name: "model-proposal",
  policy: { batch_scheduler: "fifo", max_batch_size: 4 },
  requests: [{ request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0"] }],
});
const topologyJson = JSON.stringify({
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
    ],
    module_bindings: [],
    domains: [],
    links: [],
  },
});

function catalogOf(): ParameterCatalogEntry[] {
  const surface = buildExperimentSurface(
    {
      scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
      fidelity_policies: ["default", "des"],
      input_modes: ["controls", "json"],
      design_space_modes: ["built_in_synthetic"],
      gpu_participation_modes: ["gpu_free"],
    },
    f8Capabilities,
    createF8ExperimentDescriptor(),
    "supported",
  );
  const form = createExperimentForm(surface);
  form.parameterValues["s1.runtime.max_batch_size"] = 4;
  return buildParameterCatalog({ form, surface, runtimeJson, topologyJson });
}

describe("model proposal validation", () => {
  it("gives the model the live structured-input boundary without inventing fields", () => {
    const catalog = catalogOf();
    const structuredContext = describeAgentParameterCatalog(catalog);
    expect(structuredContext).toContain("输入模式=structured_input");
    expect(structuredContext).toContain("topology/devices");
    expect(structuredContext).toContain("runtime_trace/requests");
    expect(structuredContext.length).toBeLessThanOrEqual(2_000);

    const controlsOnly = catalog.filter(
      (entry) =>
        entry.path !== "topology/devices" && entry.path !== "runtime_trace/requests" && !entry.path.includes("["),
    );
    const controlsContext = describeAgentParameterCatalog(controlsOnly);
    expect(controlsContext).toContain("输入模式=controls_only");
    expect(controlsContext).toContain("不要提出 topology/devices");
    expect(controlsContext).not.toContain("runtime_trace/requests[0]/tp_degree");
  });

  it("resolves model keys against the live catalogue without a scenario matcher", () => {
    const catalog = catalogOf();
    expect(resolveCatalogPath("max_batch_size", catalog)).toBe("overrides/runtime/max_batch_size");
    expect(resolveCatalogPath("not_published", catalog)).toBeNull();
    expect(parameterKeyOf("runtime_trace/requests[0]/tp_degree")).toBe("tp_degree");
  });

  it("accepts an assistant proposal and carries reasons into an atomic plan", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "模型推荐方案",
        rationale: "调整现有运行参数。",
        settings: [
          { key: "max_batch_size", value: "8", why: "降低单批等待。" },
          { key: "batch_scheduler", value: "fifo", why: "保持当前调度。" },
        ],
      },
      catalogOf(),
    );
    expect(recommendation?.profile).toBeNull();
    expect(recommendation?.plan.items.map((item) => item.next)).toEqual(["8", "fifo"]);
    expect(recommendation?.reasons?.["overrides/runtime/max_batch_size"]).toBe("降低单批等待。");
  });

  it("fails closed when the model asks for a field outside the published surface", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "8 卡试验",
        rationale: "扩展设备清单。",
        settings: [{ key: "topology/devices", value: "8", why: "设备数量。" }],
      },
      catalogOf().filter((entry) => entry.path !== "topology/devices"),
    );
    expect(recommendation).toBeNull();
  });

  it("keeps rejected, dropped and unknown model values incomplete", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "模型方案",
        rationale: "需要人工核对。",
        settings: [
          { key: "max_active_requests", value: "8", why: "保留一项可应用值。" },
          { key: "max_batch_size", value: "not-a-number", why: "非法值。" },
          { key: "missing_field", value: "1", why: "不存在。" },
        ],
        dropped: [{ key: "topology/links", reason: "引用不完整。" }],
      },
      catalogOf(),
    );
    expect(recommendation?.incomplete?.join(" ")).toContain("missing_field");
    expect(recommendation?.incomplete?.join(" ")).toContain("topology/links");
    expect(recommendation?.plan.rejected.length).toBe(1);
  });
});
