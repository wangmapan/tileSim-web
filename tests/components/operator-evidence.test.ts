// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import OperatorEvidencePanel from "../../src/features/execution-inspector/components/OperatorEvidencePanel.vue";
import SourceSemanticsPanel from "../../src/features/execution-inspector/components/SourceSemanticsPanel.vue";
import { bridgeApi } from "../../src/lib/api";
import { queryClient } from "../../src/lib/query-client";
const entry = (id = "request-attribution", schema = "tilesim.request_attribution.v1") => ({
  artifact_id: id,
  sha256: "a".repeat(64),
  bytes: 100,
  schema_identity: schema,
  run_id: "run-test",
});
const fragment = {
  operation_id: "op",
  fragment_id: "fragment",
  state: "completed",
  start_time_ps: "9007199254740993",
  completion_time_ps: "9007199254740999",
  attributes: {
    kernel_view: "expanded",
    kernel_timing_evidence: "modeled_synchronized_waves_not_measured_cta_timing",
    tp_rank: "1",
    output_admission_policy: "safe_window_v1",
    source_kernel_sha256: "reported-source-sha",
    resource_lane: "gpu1",
    "buffer_capacity_bytes::rank1/output": "9007199254740993",
    "buffer_final_occupied_bytes::rank1/output": "0",
  },
};
const props = (entries = [entry()]) => ({
  runId: "run-test",
  backendIdentity: "backend-test",
  schemaSetRevision: "schema-test",
  artifactManifest: { run_id: "run-test", artifacts: entries } as never,
  bridgeManifest: null,
});
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  queryClient.clear();
  vi.restoreAllMocks();
});
async function render(
  component: typeof OperatorEvidencePanel | typeof SourceSemanticsPanel,
  options: Record<string, unknown>,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: "raw_evidence", path: "/raw-evidence", component: { template: "<div />" } },
      { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
    ],
  });
  await router.push("/execution");
  await router.isReady();
  const w = mount(component, { props: options as never, global: { plugins: [router] } });
  wrappers.push(w);
  await flushPromises();
  return w;
}
describe("reported operator evidence", () => {
  it("shows missing evidence without inventing rows", async () => {
    const w = await render(OperatorEvidencePanel, props([]));
    expect(w.text()).toContain("missing");
    expect(w.findAll("tbody tr")).toHaveLength(0);
  });
  it("shows loading while SHA verification is pending", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockReturnValue(new Promise(() => {}));
    const w = await render(OperatorEvidencePanel, props());
    expect(w.text()).toContain("pending · 正在校验工件 SHA256");
  });
  it("shows verified empty evidence as expected absence", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockResolvedValue({
      run_id: "run-test",
      evidence: { resource_operations: [] },
    });
    const w = await render(OperatorEvidencePanel, props());
    expect(w.text()).toContain("expected_absence");
  });
  it("rejects unsupported schema before reading the artifact", async () => {
    const fetch = vi.spyOn(bridgeApi, "getVerifiedArtifact");
    const w = await render(OperatorEvidencePanel, props([entry("request-attribution", "future.v9")]));
    expect(w.text()).toContain("unsupported_schema");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows artifact errors and refuses an identity mismatch", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockRejectedValue(new Error("SHA mismatch"));
    const w = await render(OperatorEvidencePanel, props());
    expect(w.text()).toContain("error · SHA mismatch");
    await w.setProps({ artifactManifest: { run_id: "wrong", artifacts: [entry()] } as never });
    expect(w.text()).toContain("身份不匹配");
  });
  it("opens fragment details with exact counters, rank, source hash and admission evidence", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockResolvedValue({
      run_id: "run-test",
      evidence: { resource_operations: [fragment] },
    });
    const w = await render(OperatorEvidencePanel, props());
    await w.get("tbody button").trigger("click");
    const detail = w.get('[aria-label="执行片段详情"]');
    expect(detail.text()).toContain("reported-source-sha");
    expect(detail.text()).toContain("safe_window_v1");
    expect(detail.text()).toContain("buffer_capacity_bytes::rank1/output");
    expect(detail.text()).toContain("modeled_synchronized_waves_not_measured_cta_timing");
    expect(w.text()).toContain("9007199254740993");
    expect(w.get("tbody tr").text()).toContain("1 / gpu1");
    expect(w.findAll("a").some((a) => a.attributes("href")?.includes("backend_identity=backend-test"))).toBe(true);
    await w.get("select").setValue("aggregate");
    expect(w.findAll("tbody tr")).toHaveLength(0);
    await w.get("select").setValue("expanded");
    expect(w.findAll("tbody tr")).toHaveLength(1);
    await w.setProps({ artifactManifest: { run_id: "wrong", artifacts: [entry()] } as never });
    expect(w.findAll("tbody tr")).toHaveLength(0);
  });
  it("shows reported rank programs and output buffer admission in the input snapshot", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockResolvedValue({
      config_sha256: "actual-config",
      input: { mode: "tilelang_source" },
      dense_execution: {
        model_id: "model",
        model_revision: "v1",
        tilelang_kernels: [
          {
            selection_id: "select",
            phase: "prefill",
            operation: "attention_output",
            instances: ["layer_0::attention_output"],
            rank_programs: { gpu0: {}, gpu1: {} },
            output_policy: "tile_ready_allreduce",
            output_buffer_slots: 2,
            output_admission_policy: "safe_window_v1",
          },
        ],
      },
      sources: [{ source_sha256: "actual-source" }],
    });
    const w = await render(SourceSemanticsPanel, {
      ...props([entry("input-execution", "tilesim.bridge.execution_input_snapshot.v1")]),
      artifactId: "input-execution",
    });
    expect(w.text()).toContain("gpu0");
    expect(w.text()).toContain("gpu1");
    expect(w.text()).toContain("actual-source");
    expect(w.text()).toContain("safe_window_v1");
  });
  it("keeps CPU structure-only results separate from numerical execution", async () => {
    vi.spyOn(bridgeApi, "getVerifiedArtifact").mockResolvedValue({
      config_sha256: "actual-config",
      results: [
        {
          selection_id: "select",
          rank: "representative",
          status: "not_covered",
          reason: "Structure-only program",
          result: null,
        },
      ],
    });
    const w = await render(SourceSemanticsPanel, {
      ...props([entry("source-semantics", "tilesim.bridge.source_semantics.v1")]),
      artifactId: "source-semantics",
    });
    expect(w.text()).toContain("not_covered");
    expect(w.text()).toContain("不与共享回放游标叠加");
    expect(w.find("tbody").exists()).toBe(false);
  });
});
