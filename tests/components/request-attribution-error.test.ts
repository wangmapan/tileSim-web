/** @vitest-environment jsdom */
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import RequestAttributionPanel from "../../src/features/execution-inspector/components/RequestAttributionPanel.vue";
import type { ArtifactManifestResponse } from "../../src/lib/api";

const fetchVerifiedArtifact = vi.hoisted(() => vi.fn());
vi.mock("../../src/features/run-evidence", () => ({ fetchVerifiedArtifact }));

const manifest = {
  artifacts: [
    {
      artifact_id: "request-attribution",
      sha256: "sha256:test",
      bytes: 1,
      content_status: "available",
      contract_status: "supported",
      schema_identity: "test",
    },
  ],
  rejected_artifacts: [],
} as unknown as ArtifactManifestResponse;

function mountLoaded(selectedRequestId: string | null, requests: unknown[]) {
  fetchVerifiedArtifact.mockResolvedValue({ requests });
  return mount(RequestAttributionPanel, {
    props: {
      runId: "run-attribution",
      run: null,
      runMetadata: null,
      artifactManifest: manifest,
      backendRevision: "test",
      bridgeManifest: null,
      selectedRequestId,
    },
    global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
  });
}

describe("request attribution failure contract", () => {
  it("exposes the CLI code, duplicate pointer, remediation and retry without a fake cause chain", () => {
    const wrapper = mount(RequestAttributionPanel, {
      props: {
        runId: "run-duplicate",
        run: null,
        runMetadata: {
          run_id: "run-duplicate",
          status: "failed",
          cli_error_code: "REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED",
          cli_field_path: "/requests/1/request_id",
          cli_cause: "S0 workload request r1 duplicates /requests/0/request_id",
          cli_next_action:
            "Change the duplicated request_id values, then rerun attribution; no attribution artifact was produced.",
        },
        artifactManifest: null,
        backendRevision: "test",
        bridgeManifest: null,
        selectedRequestId: null,
      },
      global: { stubs: { RouterLink: { template: "<a href='/experiment'><slot /></a>" } } },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED");
    expect(wrapper.get('[role="alert"]').text()).toContain("/requests/1/request_id");
    expect(wrapper.get('[role="alert"]').text()).toContain("/requests/0/request_id");
    expect(wrapper.get('[role="alert"]').text()).toContain("未产生逐请求归因工件");
    expect(wrapper.get("a").attributes("href")).toBe("/experiment");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("fails closed when selectedRequestId is absent instead of choosing reports[0]", async () => {
    const wrapper = mountLoaded(null, [
      { report_id: "r0", explained_entity: { kind: "request", id: "r0" }, cause_chain: [] },
    ]);
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("请求不存在/数据不可用");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("states the applicability contract gap when no attribution artifact is declared", () => {
    const wrapper = mount(RequestAttributionPanel, {
      props: {
        runId: "run-no-attribution-contract",
        run: null,
        runMetadata: null,
        artifactManifest: { artifacts: [], rejected_artifacts: [] } as unknown as ArtifactManifestResponse,
        backendRevision: "test",
        bridgeManifest: null,
        selectedRequestId: "r1",
      },
      global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
    });
    expect(wrapper.text()).toContain("适用性保持未知");
  });

  it("fails closed when selectedRequestId has duplicate reports", async () => {
    const wrapper = mountLoaded("r1", [
      { report_id: "a", explained_entity: { kind: "request", id: "r1" }, cause_chain: [] },
      { report_id: "b", explained_entity: { kind: "request", id: "r1" }, cause_chain: [] },
    ]);
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("请求 ID 重复");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("does not match a non-request entity with the same id", async () => {
    const wrapper = mountLoaded("r1", [
      { report_id: "other", explained_entity: { kind: "execution", id: "r1" }, cause_chain: [] },
    ]);
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("请求不存在/数据不可用");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows backend-selected fabric hops and keeps route_unavailable fail-closed", async () => {
    const wrapper = mountLoaded("r1", [
      {
        report_id: "r1-report",
        explained_entity: { kind: "request", id: "r1" },
        cause_chain: [],
      },
    ]);
    fetchVerifiedArtifact.mockResolvedValueOnce({
      requests: [
        {
          report_id: "r1-report",
          explained_entity: { kind: "request", id: "r1" },
          cause_chain: [],
        },
      ],
      evidence: {
        fabric: {
          timeline: [
            {
              request_id: "r1",
              phase_id: "phase-1",
              module_id: "flow_des",
              domain_id: "su0",
              actual_path: ["gpu0", "gpu1"],
              link_endpoints: { l0: { source: "gpu0", destination: "gpu1" } },
              transfers_executed: "18446744073709551615",
              end_to_end_latency_us: "9007199254740993",
              execution_events: [{ kind: "enqueue", link_id: "l0", time_ps: "9007199254740994" }],
            },
          ],
          module_stats: [],
          fallback_reasons: [],
        },
      },
    });
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("gpu0 → gpu1");
    expect(wrapper.text()).toContain("18446744073709551615");
    expect(wrapper.text()).toContain("9007199254740993");
    expect(wrapper.text()).toContain("l0");

    const unavailable = mountLoaded("r1", [
      { report_id: "r1-report", explained_entity: { kind: "request", id: "r1" }, cause_chain: [] },
    ]);
    fetchVerifiedArtifact.mockResolvedValueOnce({
      requests: [{ report_id: "r1-report", explained_entity: { kind: "request", id: "r1" }, cause_chain: [] }],
      evidence: {
        fabric: {
          timeline: [{ request_id: "r1", fallback_reason: "route_unavailable" }],
          fallback_reasons: ["route_unavailable"],
        },
      },
    });
    await unavailable.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(unavailable.text()).toContain("route_unavailable");
    expect(unavailable.text()).toContain("后端未找到可用路由");
  });

  it("reports an empty attribution payload without inventing a request", async () => {
    const wrapper = mountLoaded("r1", []);
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("归因报告为空");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows only backend-declared cross-subsystem links and marks missing links unlinked", async () => {
    const wrapper = mountLoaded("r1", [
      {
        report_id: "r1-report",
        explained_entity: { kind: "request", id: "r1" },
        cause_chain: [
          {
            cause_id: "cause-1",
            subsystem: "S3",
            cause_code: "kv_remote_read",
            model_execution_call_id: "model-call-1",
            execution_id: "execution-1",
            kv_operation_id: "kv-op-1",
            network_demand_id: "demand-1",
            device_task_id: "device-task-1",
            collective_id: "collective-1",
            pd_handoff_id: "handoff-1",
            pd_disaggregation_group_id: "pd-group-1",
            pd_source_placement_group_id: "prefill-group",
            pd_destination_placement_group_id: "decode-group",
          },
        ],
      },
    ]);
    await wrapper.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("model-call-1");
    expect(wrapper.text()).toContain("handoff-1");
    expect(wrapper.text()).toContain("prefill-group");
    expect(wrapper.text()).toContain("decode-group");

    const missing = mountLoaded("r1", [
      {
        report_id: "r1-report",
        explained_entity: { kind: "request", id: "r1" },
        cause_chain: [{ cause_id: "cause-1", subsystem: "S4", cause_code: "device_wait" }],
      },
    ]);
    await missing.get("button.button--secondary").trigger("click");
    await flushPromises();
    expect(missing.text()).toContain("未关联");
  });
});
