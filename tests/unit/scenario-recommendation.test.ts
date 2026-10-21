import { describe, expect, it } from "vitest";
import {
  buildExperimentSurface,
  buildParameterCatalog,
  buildDeterministicRequestCountRecommendation,
  describeAgentParameterCatalog,
  explicitRequestCount,
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

function catalogOf(runtime = runtimeJson, topology = topologyJson): ParameterCatalogEntry[] {
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
  return buildParameterCatalog({ form, surface, runtimeJson: runtime, topologyJson: topology });
}

describe("model proposal validation", () => {
  it.each([
    ["配置一份64请求实验方案", 64],
    ["配置 16 个请求", 16],
    ["并发 8 个请求", 8],
    ["请求数量：32", 32],
    ["把请求数量从 4 改为 64", 64],
  ])("识别明确的请求数量（%s）", (instruction, expected) => {
    expect(explicitRequestCount(instruction)).toBe(expected);
  });

  it("不把 TP 后面的数字误当成请求数量", () => {
    expect(explicitRequestCount("把每个请求的 TP8 保持不变")).toBeNull();
    expect(explicitRequestCount("把每个请求的 TP 8 保持不变")).toBeNull();
  });

  it("不为‘几个请求’猜测数量，并为明确数量生成可写的集合规模方案", () => {
    expect(explicitRequestCount("配置几个请求")).toBeNull();
    const recommendation = buildDeterministicRequestCountRecommendation("配置一份64请求实验方案", catalogOf());
    expect(recommendation?.plan.items).toHaveLength(1);
    expect(recommendation?.plan.items[0]).toMatchObject({
      path: "runtime_trace/requests",
      next: "64",
      target: "runtime_trace",
    });
    expect(recommendation?.incomplete).toEqual([]);
    expect(recommendation?.warnings?.[0]).toContain("安全兜底");
    expect(
      buildDeterministicRequestCountRecommendation("配置 64 个请求并生成完整 topology JSON", catalogOf()),
    ).toBeNull();
    expect(buildDeterministicRequestCountRecommendation("配置 64 个请求，拓扑保持当前", catalogOf())).not.toBeNull();
  });

  it("accepts a complete synthetic topology document instead of treating links as guessed hardware", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "仿真 16 卡拓扑",
        rationale: "生成可校验的 synthetic fabric。",
        settings: [],
        structured_inputs: {
          runtime_trace: {
            trace_name: "agent-runtime",
            trace_provenance: {
              source_mode: "synthetic_trace",
              calibration_level: "uncalibrated",
              allowed_claim_scope: "exploratory",
            },
            policy: { max_batch_size: 4 },
            requests: [{ request_id: "r0", phase: "prefill", tp_degree: 1, participants: ["gpu0"] }],
          },
          topology: {
            scenario_name: "agent-topology",
            provenance: {
              source_mode: "synthetic_trace",
              calibration_level: "uncalibrated",
              allowed_claim_scope: "synthetic_consistency_only",
            },
            topology: {
              topology_name: "synthetic",
              devices: [{ device_id: "gpu0", device_type: "GPU" }],
              module_bindings: [{ module_name: "su", module_kind: "scale_up" }],
              domains: [{ domain_id: "d0", domain_type: "scale_up", member_devices: ["gpu0"], module_binding: "su" }],
              links: [],
            },
          },
        },
      },
      catalogOf(),
    );
    expect(JSON.parse(recommendation?.structuredInputs?.topologyJson ?? "{}")).toMatchObject({
      topology: { links: [] },
    });
    expect(recommendation?.incomplete).toEqual([]);
  });
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

  it("keeps every existing request TP address in the bounded model context", () => {
    const runtime = JSON.stringify({
      trace_name: "three-request-trace",
      policy: { batch_scheduler: "fifo", max_batch_size: 4 },
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: index % 2 ? "decode" : "prefill",
        tp_degree: 2,
        participants: ["gpu0"],
      })),
    });
    const context = describeAgentParameterCatalog(catalogOf(runtime));
    expect(context.length).toBeLessThanOrEqual(2_000);
    expect(context).toContain("runtime_trace/requests[0]/tp_degree");
    expect(context).toContain("runtime_trace/requests[1]/tp_degree");
    expect(context).toContain("runtime_trace/requests[2]/tp_degree");
  });

  it("does not advertise identity keys that the atomic Agent writer cannot rename safely", () => {
    const context = describeAgentParameterCatalog(catalogOf());
    expect(context).not.toContain("topology/devices[0]/device_id");
    expect(context).not.toContain("device_id");
  });

  it("rejects a partial TP set when a model expands the device collection", () => {
    const runtime = JSON.stringify({
      trace_name: "three-request-trace",
      policy: { batch_scheduler: "fifo", max_batch_size: 4 },
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: "prefill",
        tp_degree: 4,
        participants: ["gpu0", "gpu1", "gpu2", "gpu3"],
      })),
    });
    const recommendation = modelScenarioRecommendation(
      {
        title: "8 卡实验",
        rationale: "扩容到 8 张卡并将请求并行度设为 TP8。",
        settings: [
          { key: "topology/devices", value: "8", why: "扩大设备集合。" },
          { key: "runtime_trace/requests[0]/tp_degree", value: "8", why: "同步第 1 条请求。" },
          { key: "runtime_trace/requests[1]/tp_degree", value: "8", why: "同步第 2 条请求。" },
        ],
      },
      catalogOf(runtime),
    );
    expect(recommendation?.incomplete?.some((item) => item.includes("requests[2]/tp_degree"))).toBe(true);
  });

  it("keeps a safe scalar card plan applicable when Bridge rejects optional structured JSON", () => {
    const runtime = JSON.stringify({
      trace_name: "three-request-trace",
      policy: { batch_scheduler: "fifo", max_batch_size: 4 },
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: "prefill",
        tp_degree: 4,
        participants: ["gpu0", "gpu1", "gpu2", "gpu3"],
      })),
    });
    const recommendation = modelScenarioRecommendation(
      {
        title: "8 卡实验",
        rationale: "把设备规模和每条请求的并行度同步到 8。",
        instruction: "配置一次 8 卡实验方案",
        settings: [
          { key: "topology/devices", value: "8", why: "扩大设备集合。" },
          ...[0, 1, 2].map((index) => ({
            key: `runtime_trace/requests[${index}]/tp_degree`,
            value: "8",
            why: `同步第 ${index + 1} 条请求。`,
          })),
        ],
        dropped: [
          { key: "structured_inputs", reason: "custom_inputs must contain runtime_trace and topology objects." },
        ],
      },
      catalogOf(runtime),
    );
    expect(recommendation?.incomplete).toEqual([]);
    expect(recommendation?.warnings?.join(" ")).toContain("structured_inputs 未被 Bridge 接受");
    expect(recommendation?.plan.items).toHaveLength(4);
  });

  it("still blocks a rejected structured document when the user explicitly requests complete topology JSON", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "8 卡仿真拓扑",
        rationale: "需要完整的 links 和 domains。",
        instruction: "请用结构化 JSON 配置完整互联拓扑并生成 8 卡方案",
        settings: [{ key: "topology/devices", value: "8", why: "扩大设备集合。" }],
        dropped: [{ key: "structured_inputs", reason: "complete_topology_requires_links_array" }],
      },
      catalogOf(),
    );
    expect(recommendation?.incomplete?.join(" ")).toContain("structured_inputs 未被 Bridge 接受");
    expect(recommendation?.warnings).toBeUndefined();
  });

  it.each([3, 16, 32])("accepts a complete arbitrary %i-card composition", (count) => {
    const runtime = JSON.stringify({
      trace_name: "three-request-trace",
      policy: { batch_scheduler: "fifo", max_batch_size: 4 },
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: "prefill",
        tp_degree: 2,
        participants: ["gpu0", "gpu1"],
      })),
    });
    const recommendation = modelScenarioRecommendation(
      {
        title: `${count} 卡实验`,
        rationale: `调整到 ${count} 张卡，并让每条请求使用 TP${count}。`,
        settings: [
          { key: "topology/devices", value: String(count), why: "调整设备集合。" },
          ...[0, 1, 2].map((index) => ({
            key: `runtime_trace/requests[${index}]/tp_degree`,
            value: String(count),
            why: `同步第 ${index + 1} 条请求。`,
          })),
        ],
      },
      catalogOf(runtime),
    );
    expect(recommendation?.incomplete).toEqual([]);
    expect(recommendation?.plan.items.map((item) => item.next)).toEqual([
      String(count),
      String(count),
      String(count),
      String(count),
    ]);
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
