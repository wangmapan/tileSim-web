// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReportBundle } from "../../src/contracts/report-model";
import type { ApiManifestResponse, ApiRun, ArtifactManifestResponse } from "../../src/lib/api";
import { BridgeApiError } from "../../src/lib/api";
import { normalizeApiReports } from "../../src/lib/reports";
import { useDashboard } from "../../src/store/dashboard";
import { useLightweightStore, type LightweightRunContext } from "../../src/stores/lightweight";
import LightweightPrepareView from "../../src/views/LightweightPrepareView.vue";
import LightweightRunView from "../../src/views/LightweightRunView.vue";
import LightweightResultsView from "../../src/views/LightweightResultsView.vue";
import LightweightWorkbenchView from "../../src/views/LightweightWorkbenchView.vue";
import {
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";
import reportBundles from "../fixtures/report-bundles.json";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getTemplate: vi.fn(),
  getStatus: vi.fn(),
  fetchRunEvidence: vi.fn(),
  fetchRunHistory: vi.fn(),
}));

vi.mock("../../src/features/run-experiment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/run-experiment")>();
  return {
    ...actual,
    runExperiment: {
      ...actual.runExperiment,
      create: mocks.create,
      getTemplate: mocks.getTemplate,
      getStatus: mocks.getStatus,
    },
  };
});

vi.mock("../../src/features/run-evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/run-evidence")>();
  return { ...actual, fetchRunEvidence: mocks.fetchRunEvidence };
});

vi.mock("../../src/features/run-history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/run-history")>();
  return { ...actual, fetchRunHistory: mocks.fetchRunHistory };
});

type FixtureCase = (typeof reportBundles.cases)[number];

const completeFixture = reportBundles.cases.find((item) => item.id === "synthetic-s1-s6-complete") as FixtureCase;

function routerFor() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/lightweight", name: "lightweight", component: LightweightWorkbenchView },
      { path: "/lightweight/prepare", name: "lightweight_prepare", component: LightweightPrepareView },
      { path: "/lightweight/runs", name: "lightweight_runs", component: LightweightRunView },
      { path: "/lightweight/runs/:runId", name: "lightweight_run", component: LightweightRunView },
      { path: "/lightweight/results", name: "lightweight_results", component: LightweightResultsView },
      { path: "/experiment", name: "experiment", component: { template: "<div />" } },
      { path: "/overview", name: "overview", component: { template: "<div />" } },
    ],
  });
}

async function mountAt(
  component:
    | typeof LightweightWorkbenchView
    | typeof LightweightPrepareView
    | typeof LightweightRunView
    | typeof LightweightResultsView,
  path: string,
  props: Record<string, unknown> = {},
) {
  const router = routerFor();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, {
    props,
    global: { plugins: [router] },
  });
  await flushPromises();
  return { wrapper, router };
}

function resetDashboard() {
  const dashboard = useDashboard();
  dashboard.clearExperimentSubmission();
  dashboard.state.toasts.splice(0, dashboard.state.toasts.length);
  dashboard.state.bridge.available = true;
  dashboard.state.bridge.connected = true;
  dashboard.state.bridge.checking = false;
  dashboard.state.bridge.identity = null;
  dashboard.state.bridge.manifest = {
    schema_version: "tilesim.bridge.manifest.v1",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: "sha256:unit-test-schema",
    error_schema_version: "tilesim.bridge.error.v1",
    artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
    known_report_schema_identities: {},
    endpoints: {},
    legacy_unversioned: false,
  } as ApiManifestResponse;
  dashboard.state.catalog.scenarios = [];
  dashboard.state.catalog.fidelity_policies = ["default", "des"];
  Object.assign(dashboard.state.capabilities, structuredClone(f8Capabilities));
  dashboard.state.experiment.descriptor = null;
  dashboard.state.experiment.status = "legacy_compatibility";
  dashboard.state.experiment.error = "experiment_descriptor_unavailable";
  const lightweight = useLightweightStore();
  lightweight.draft.form = null;
  lightweight.draft.mode = "controls";
  lightweight.setRun(null);
  lightweight.reports.bundle = null;
  lightweight.reports.inputs = null;
  lightweight.reports.artifactManifest = null;
  mocks.create.mockReset();
  mocks.getTemplate.mockReset();
  mocks.getStatus.mockReset();
  mocks.fetchRunEvidence.mockReset();
  mocks.fetchRunHistory.mockReset();
  mocks.fetchRunHistory.mockResolvedValue({ runs: [] });
  dashboard.state.history.runs.splice(0, dashboard.state.history.runs.length);
}

function runContext(overrides: Partial<LightweightRunContext> = {}): LightweightRunContext {
  return {
    runId: "run-lightweight-1",
    runName: "fixture run",
    payloadText: "{}",
    artifactSha256: "sha256:artifact",
    schemaSetRevision: "sha256:schema",
    backendIdentity: null,
    requestedFidelity: "default",
    resolvedFidelity: null,
    status: "completed",
    stage: "completed",
    error: null,
    startedAt: "2026-09-16T00:00:00Z",
    updatedAt: "2026-09-16T00:00:01Z",
    ...overrides,
  };
}

type MutableFixtureReports = {
  run: NonNullable<ReportBundle["run"]>;
  metrics: NonNullable<ReportBundle["metrics"]>;
};

function fixtureBundle(mutator?: (reports: MutableFixtureReports) => void): ReportBundle {
  const bundle = normalizeApiReports(structuredClone(completeFixture.reports));
  if (!bundle.run || !bundle.metrics) throw new Error("complete fixture must contain run and metrics reports");
  mutator?.({ run: bundle.run, metrics: bundle.metrics });
  return bundle;
}

function manifest(overrides: Record<string, unknown> = {}): ArtifactManifestResponse {
  return {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: "sha256:schema",
    run_id: "run-lightweight-1",
    artifacts: [
      {
        artifact_id: "run-result",
        report_kind: "run",
        file_name: "run.json",
        media_type: "application/json",
        bytes: 1,
        sha256: "sha256:artifact",
        schema_identity: "wind_tunnel.run.v1alpha1",
        contract_status: "supported",
      },
    ],
    rejected_artifacts: [],
    ...overrides,
  } as ArtifactManifestResponse;
}

beforeEach(() => {
  resetDashboard();
  vi.stubGlobal("crypto", { randomUUID: () => "lightweight-test-key" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LightweightWorkbenchView run handoff", () => {
  it("uses the explicit URL run instead of a different first history entry", async () => {
    const dashboard = useDashboard();
    const historyRuns: ApiRun[] = [
      { run_id: "run-other", run_name: "other history", status: "completed", fidelity_policy: "default" },
      { run_id: "run-target", run_name: "target history", status: "running", fidelity_policy: "des" },
    ];
    dashboard.state.history.runs = historyRuns;
    mocks.fetchRunHistory.mockResolvedValue({ runs: historyRuns });

    const { wrapper } = await mountAt(LightweightWorkbenchView, "/lightweight?run=run-target");

    expect(wrapper.get("h2").text()).toBe("target history");
    expect(wrapper.text()).toContain("run-target");
    expect(wrapper.text()).not.toContain("other history");
    wrapper.unmount();
  });
});

describe("LightweightPrepareView contract and submission boundary", () => {
  it("publishes the canonical experiment context for the shared Agent", async () => {
    const publication = vi.fn();
    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare", {
      agentContextPublisher: publication,
    });

    expect(publication).toHaveBeenCalled();
    const latest = publication.mock.lastCall?.[0];
    expect(latest.context).toMatchObject({
      page_id: "lightweight-prepare",
      route_name: "lightweight_prepare",
      display_label: "轻量实验配置",
      availability: "available",
    });
    expect(latest.context.supported_actions).toContain("configure_current_subset");
    expect(latest.current_values).toHaveProperty("s1.runtime.max_batch_size");
    expect(wrapper.find(".status-badge--positive").exists()).toBe(true);
    wrapper.unmount();
  });

  it("loads the selected scenario template into JSON input mode", async () => {
    mocks.getTemplate.mockResolvedValue({
      scenario_id: "s1_des_example",
      runtime_trace: { trace_name: "template-runtime", requests: [] },
      topology: { devices: [], links: [] },
    });
    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare");

    const jsonMode = wrapper.findAll("button").find((button) => button.text().includes("JSON 输入"));
    expect(jsonMode).toBeDefined();
    await jsonMode!.trigger("click");
    const templateButton = wrapper.findAll("button").find((button) => button.text().includes("加载场景模板"));
    expect(templateButton).toBeDefined();
    await templateButton!.trigger("click");
    await flushPromises();

    expect(mocks.getTemplate).toHaveBeenCalledWith("s1_des_example");
    const textareas = wrapper.findAll("textarea");
    expect(textareas[0].element.value).toContain('"template-runtime"');
    expect(textareas[1].element.value).toContain('"devices"');
    wrapper.unmount();
  });

  it("builds a canonical request preview and submits it with a lightweight idempotency key", async () => {
    mocks.create.mockResolvedValue({ run_id: "run-preview-1", run_name: "preview" });
    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare");

    const submit = wrapper.find("button.button--primary");
    expect(submit.attributes("disabled")).toBeUndefined();
    await submit.trigger("click");
    await flushPromises();

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario_id: "s1_des_example",
        fidelity_policy: expect.any(String),
        gpu_participation_mode: "gpu_free",
        overrides: expect.objectContaining({ workload: expect.any(Object), runtime: expect.any(Object) }),
      }),
      "lightweight-lightweight-test-key",
    );
    expect(useLightweightStore().run.value?.runId).toBe("run-preview-1");
    wrapper.unmount();
  });

  it("restores the session draft when the prepare page is remounted", async () => {
    const first = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    await first.wrapper.get('[data-field-id="s1.runtime.max_batch_size"] input').setValue("6");
    await first.wrapper.get(".form-grid--identity .field--wide input").setValue("保留这次配置");
    await flushPromises();
    first.wrapper.unmount();

    const second = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    expect(second.wrapper.get('[data-field-id="s1.runtime.max_batch_size"] input').element).toHaveProperty(
      "value",
      "6",
    );
    expect(second.wrapper.get(".form-grid--identity .field--wide input").element).toHaveProperty(
      "value",
      "保留这次配置",
    );
    expect(useLightweightStore().draft.mode).toBe("controls");
    second.wrapper.unmount();
  });

  it("keeps validation and submission disabled while the Bridge is unavailable", async () => {
    const dashboard = useDashboard();
    dashboard.state.bridge.available = false;
    dashboard.state.bridge.connected = false;
    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare");

    expect(wrapper.find('[role="alert"]').text()).toContain("Bridge");
    expect(wrapper.find("button.button--primary").attributes("disabled")).toBeDefined();
    expect(mocks.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("shows required-field validation and disables unavailable descriptor fields", async () => {
    const dashboard = useDashboard();
    const descriptor = createF8ExperimentDescriptor();
    descriptor.parameter_descriptors[0].required = true;
    descriptor.parameter_descriptors[0].available = false;
    descriptor.parameter_descriptors[0].unavailable_reason = "fixture capability unavailable";
    descriptor.parameter_descriptors[0].capability_predicate.evaluated_available = false;
    dashboard.state.capabilities.run_surface!.override_parameter_field_ids = descriptor.parameter_descriptors
      .slice(1)
      .map((field) => field.field_id);
    dashboard.state.experiment.descriptor = descriptor;
    dashboard.state.experiment.status = "supported";

    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    const unavailable = wrapper.find('[data-field-id="s0.workload.message_size_multiplier"] input');
    expect(unavailable.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("fixture capability unavailable");
    expect(wrapper.text()).toContain("待修正");
    expect(wrapper.find("button.button--primary").attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });

  it("clears a pending submission after definitive 4xx and retains it for retryable errors", async () => {
    const dashboard = useDashboard();
    mocks.create.mockRejectedValueOnce(
      new BridgeApiError("validation failed", { status: 400, code: "invalid_request", retryable: false }),
    );
    const first = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    await first.wrapper.find("button.button--primary").trigger("click");
    await flushPromises();
    expect(dashboard.state.experimentSubmission).toEqual({ payloadText: "", idempotencyKey: "", runId: "" });
    first.wrapper.unmount();

    mocks.create.mockRejectedValueOnce(
      new BridgeApiError("service unavailable", { status: 503, code: "temporarily_unavailable", retryable: true }),
    );
    const second = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    await second.wrapper.find("button.button--primary").trigger("click");
    await flushPromises();
    expect(dashboard.state.experimentSubmission.idempotencyKey).toBe("lightweight-lightweight-test-key");
    expect(dashboard.state.experimentSubmission.payloadText).toContain('"scenario_id"');
    second.wrapper.unmount();
  });

  it("reuses the retained idempotency key when retrying the same canonical payload", async () => {
    mocks.create
      .mockRejectedValueOnce(
        new BridgeApiError("temporary failure", { status: 503, code: "temporary", retryable: true }),
      )
      .mockResolvedValueOnce({ run_id: "run-retry-1", run_name: "retry" });
    const { wrapper } = await mountAt(LightweightPrepareView, "/lightweight/prepare");
    const submit = wrapper.find("button.button--primary");
    await submit.trigger("click");
    await flushPromises();
    await submit.trigger("click");
    await flushPromises();

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][1]).toBe("lightweight-lightweight-test-key");
    expect(mocks.create.mock.calls[1][1]).toBe(mocks.create.mock.calls[0][1]);
    expect(useLightweightStore().run.value?.runId).toBe("run-retry-1");
    wrapper.unmount();
  });
});

describe("LightweightRunView status, polling, and evidence", () => {
  it("restores a run from its URL, polls queued/running, reads evidence on completion, and stops", async () => {
    mocks.getStatus
      .mockResolvedValueOnce({ run_id: "run-lightweight-1", run_name: "fixture run", status: "preparing" })
      .mockResolvedValueOnce({ run_id: "run-lightweight-1", run_name: "fixture run", status: "queued" })
      .mockResolvedValueOnce({ run_id: "run-lightweight-1", run_name: "fixture run", status: "running" })
      .mockResolvedValueOnce({
        run_id: "run-lightweight-1",
        run_name: "fixture run",
        status: "completed",
        fidelity_policy: "default",
      });
    mocks.fetchRunEvidence.mockResolvedValue({
      payload: {
        reports: {
          run: {
            ...structuredClone(completeFixture.reports.run),
            status: "completed",
            resolved_fidelity_profile: { entries: [{ subsystem: "S1", actual_fidelity: "DES" }] },
          },
          metrics: structuredClone(completeFixture.reports.metrics),
        },
      },
      inputs: null,
      artifactManifest: manifest(),
    });

    vi.useFakeTimers();
    const { wrapper } = await mountAt(LightweightRunView, "/lightweight/runs/run-lightweight-1");
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("准备中");

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("排队中");

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(mocks.getStatus).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).toContain("运行中");

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(mocks.getStatus).toHaveBeenCalledTimes(4);
    expect(mocks.fetchRunEvidence).toHaveBeenCalledWith("run-lightweight-1", expect.any(Object));
    expect(wrapper.text()).toContain("已完成");
    expect(wrapper.text()).toContain("DES");
    expect(wrapper.text()).toContain("已停止自动轮询（终态）");

    await vi.advanceTimersByTimeAsync(10_000);
    await flushPromises();
    expect(mocks.getStatus).toHaveBeenCalledTimes(4);
    expect(useLightweightStore().run.value?.resolvedFidelity).toBe("DES");
    wrapper.unmount();
  });

  it.each(["failed", "unavailable", "incomplete"] as const)(
    "renders the %s terminal boundary without evidence promotion",
    async (status) => {
      mocks.getStatus.mockResolvedValue({ run_id: "run-lightweight-1", status });
      const { wrapper } = await mountAt(LightweightRunView, "/lightweight/runs/run-lightweight-1");
      await flushPromises();
      expect(wrapper.text()).toContain(
        status === "failed" ? "运行失败" : status === "unavailable" ? "Bridge 不可用" : "结果不完整",
      );
      expect(wrapper.text()).toContain("已停止自动轮询（终态）");
      expect(mocks.fetchRunEvidence).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );
});

describe("LightweightResultsView report fidelity and field boundaries", () => {
  async function mountResults(
    bundle: ReportBundle,
    options: { manifest?: ArtifactManifestResponse | null; run?: Partial<LightweightRunContext> } = {},
  ) {
    const lightweight = useLightweightStore();
    lightweight.setRun(runContext(options.run));
    lightweight.setReports({
      bundle,
      artifactManifest: options.manifest === undefined ? manifest() : options.manifest,
    });
    return mountAt(LightweightResultsView, "/lightweight/results?run=run-lightweight-1");
  }

  it("renders real report fields, distinguishes legal zero from missing, and preserves provenance lanes", async () => {
    const bundle = fixtureBundle((reports) => {
      reports.run.status = "completed";
      reports.run.summary.end_to_end_latency_us = 0;
      reports.metrics.summary = { ...(reports.metrics.summary || {}), throughput_requests_per_second: 0 };
      reports.metrics.system_summary = {
        ...(reports.metrics.system_summary || {}),
        fabric_utilization_ratio: 0,
        fabric_domain_utilization: [
          { domain_id: "scale-up", utilization_ratio: 0 },
          // The report adapter treats an explicit null as a missing value; keep
          // this malformed fixture local to the boundary test rather than
          // widening the canonical generated contract type.
          { domain_id: "scale-out", utilization_ratio: null as unknown as number },
        ],
      };
      reports.metrics.trace_provenance = {
        ...(reports.metrics.trace_provenance || {}),
        source_mode: "synthetic_trace",
      };
      reports.metrics.metric_lane = "synthetic_consistency";
    });
    const { wrapper } = await mountResults(bundle);
    expect(wrapper.text()).toContain("0.0%");
    expect(wrapper.text()).toContain("0 req/s");
    expect(wrapper.text()).toContain("missing");
    expect(wrapper.text()).toContain("synthetic_trace");
    expect(wrapper.text()).toContain("synthetic_consistency");
    expect(wrapper.text()).not.toContain("held_out_real_trace");
    expect(wrapper.findAll(".bar-row")).toHaveLength(2);
    wrapper.unmount();
  });

  it.each(["real_trace", "synthetic_trace", "compatibility_harness_trace"] as const)(
    "renders %s provenance as reported without upgrading the lane",
    async (sourceMode) => {
      const bundle = fixtureBundle((reports) => {
        reports.metrics.trace_provenance = {
          ...(reports.metrics.trace_provenance || {}),
          source_mode: sourceMode,
        };
        reports.metrics.metric_lane = `${sourceMode}:fixture`;
      });
      const { wrapper } = await mountResults(bundle);
      expect(wrapper.text()).toContain(sourceMode);
      expect(wrapper.text()).toContain(`${sourceMode}:fixture`);
      expect(wrapper.text()).not.toContain("held_out_real_trace");
      wrapper.unmount();
    },
  );

  it("uses the first legal repeated run query and displays backend-resolved fidelity", async () => {
    const bundle = fixtureBundle((reports) => {
      reports.run.status = "completed";
      reports.run.resolved_fidelity_profile = {
        entries: [{ subsystem: "S1", requested_fidelity: "cycle", actual_fidelity: "Analytical" }],
      };
    });
    const lightweight = useLightweightStore();
    lightweight.setRun(runContext({ requestedFidelity: "cycle" }));
    lightweight.setReports({ bundle, artifactManifest: manifest() });
    const router = routerFor();
    await router.push("/lightweight/results?run=run-lightweight-1&run=run-other");
    await router.isReady();
    const wrapper = mount(LightweightResultsView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("run-lightweight-1");
    expect(wrapper.text()).toContain("Analytical");
    expect(wrapper.text()).not.toContain("cycle ·");
    wrapper.unmount();
  });

  it("does not reuse a cached report when the route changes to another run", async () => {
    const lightweight = useLightweightStore();
    lightweight.setRun(runContext({ runId: "run-lightweight-1" }));
    lightweight.setReports({
      bundle: fixtureBundle(),
      artifactManifest: manifest({ run_id: "run-lightweight-1" }),
    });
    const replacement = fixtureBundle((reports) => {
      reports.run.status = "completed";
      reports.run.summary.trace_name = "fixture-second-run";
    });
    mocks.fetchRunEvidence.mockResolvedValue({
      payload: { reports: replacement },
      inputs: null,
      artifactManifest: manifest({ run_id: "run-lightweight-2" }),
    });
    const router = routerFor();
    await router.push("/lightweight/results?run=run-lightweight-1");
    await router.isReady();
    const wrapper = mount(LightweightResultsView, { global: { plugins: [router] } });
    await flushPromises();
    expect(mocks.fetchRunEvidence).not.toHaveBeenCalled();

    await router.push("/lightweight/results?run=run-lightweight-2");
    await flushPromises();
    expect(mocks.fetchRunEvidence).toHaveBeenCalledWith("run-lightweight-2", expect.any(Object));
    expect(useLightweightStore().reports.bundle?.run?.summary.trace_name).toBe("fixture-second-run");
    expect(useLightweightStore().reports.bundle?.run?.summary.trace_name).not.toBe("fixture-synthetic::events");
    wrapper.unmount();
  });

  it.each([
    ["stale", { schema_set_revision: "sha256:other" }, "stale"],
    [
      "unsupported",
      { rejected_artifacts: [{ artifact_id: "metrics", reason: "future schema" }] },
      "unsupported_schema",
    ],
  ] as const)("exposes %s artifact boundary", async (_name, override, expected) => {
    const bundle = fixtureBundle();
    const { wrapper } = await mountResults(bundle, { manifest: manifest(override) });
    expect(wrapper.find(".status-badge").attributes("data-status")).toBe(expected);
    expect(wrapper.text()).toContain(expected === "stale" ? "stale" : "unsupported schema");
    wrapper.unmount();
  });

  it("marks a report stale when the URL artifact digest does not match the verified manifest", async () => {
    const lightweight = useLightweightStore();
    lightweight.setRun(runContext());
    lightweight.setReports({ bundle: fixtureBundle(), artifactManifest: manifest() });
    const router = routerFor();
    await router.push("/lightweight/results?run=run-lightweight-1&artifact_sha256=sha256:not-the-artifact");
    await router.isReady();
    const wrapper = mount(LightweightResultsView, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.find(".status-badge").attributes("data-status")).toBe("stale");
    expect(wrapper.findAll(".bar-row")).toHaveLength(0);
    wrapper.unmount();
  });

  it("marks a report stale when a report payload declares a different run ID", async () => {
    const bundle = fixtureBundle((reports) => {
      reports.run.run_id = "run-other";
    });
    const { wrapper } = await mountResults(bundle);
    expect(wrapper.find(".status-badge").attributes("data-status")).toBe("stale");
    expect(wrapper.findAll(".bar-row")).toHaveLength(0);
    wrapper.unmount();
  });

  it("does not draw a decorative chart when the report has no domain field", async () => {
    const bundle = fixtureBundle((reports) => {
      reports.metrics.system_summary = {
        ...(reports.metrics.system_summary || {}),
        fabric_domain_utilization: [],
      };
      if (reports.metrics.system_summary) delete reports.metrics.system_summary.fabric_utilization_ratio;
    });
    const { wrapper } = await mountResults(bundle);
    expect(wrapper.findAll(".bar-row")).toHaveLength(0);
    expect(wrapper.find(".lightweight-missing").text()).toContain("未生成演示图表");
    expect(wrapper.text()).toContain("missing");
    wrapper.unmount();
  });

  it("does not draw a chart without a verified artifact manifest", async () => {
    const fetched = fixtureBundle();
    mocks.fetchRunEvidence.mockResolvedValue({
      payload: { reports: fetched },
      inputs: null,
      artifactManifest: null,
    });
    const { wrapper } = await mountResults(fixtureBundle(), { manifest: null });
    await flushPromises();
    expect(wrapper.findAll(".bar-row")).toHaveLength(0);
    expect(wrapper.find(".lightweight-missing").exists()).toBe(true);
    expect(wrapper.find(".lightweight-missing").text()).toContain("缺少已验证 artifact manifest");
    wrapper.unmount();
  });

  it("shows missing/not-covered when the run report is absent", async () => {
    const metricsOnly = normalizeApiReports({ metrics: structuredClone(completeFixture.reports.metrics) });
    const { wrapper } = await mountResults(metricsOnly, { manifest: manifest() });
    expect(wrapper.find(".status-badge").attributes("data-status")).toBe("missing");
    expect(wrapper.findAll(".bar-row")).toHaveLength(0);
    expect(wrapper.text()).toContain("missing");
    wrapper.unmount();
  });
});

describe("canonical request preview helper used by LightweightPrepareView", () => {
  it("rejects required and unavailable values without inventing defaults", () => {
    const surface = buildExperimentSurface(
      { scenarios: [], fidelity_policies: ["default", "des"], input_modes: ["controls", "json", "trace_package"] },
      f8Capabilities as never,
    );
    const requiredField = { ...surface.controlGroups[0].fields[0], required: true };
    const unavailableField = { ...surface.controlGroups[0].fields[1], available: false };
    const testSurface = {
      ...surface,
      controlGroups: [
        {
          ...surface.controlGroups[0],
          fields: [requiredField, unavailableField, ...surface.controlGroups[0].fields.slice(2)],
        },
        ...surface.controlGroups.slice(1),
      ],
      canSubmit: true,
    };
    const form = createExperimentForm(testSurface);
    form.parameterValues[requiredField.fieldId] = undefined;
    expect(
      buildExperimentRequestPreview({
        form,
        mode: "controls",
        surface: testSurface,
        runtimeJson: "",
        topologyJson: "",
        designSpaceJson: "",
      }).error?.fieldPath,
    ).toBe(requiredField.requestJsonPointer);
  });
});
