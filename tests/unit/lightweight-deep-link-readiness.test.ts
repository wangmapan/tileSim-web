/** @vitest-environment jsdom */

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({ fetchBridgeBootstrap: vi.fn() }));
const runMocks = vi.hoisted(() => ({ getStatus: vi.fn() }));
const evidenceMocks = vi.hoisted(() => ({ fetchRunEvidence: vi.fn() }));

vi.mock("../../src/features/bridge-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/bridge-status")>();
  return { ...actual, fetchBridgeBootstrap: bridgeMocks.fetchBridgeBootstrap };
});
vi.mock("../../src/features/run-experiment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/run-experiment")>();
  return { ...actual, runExperiment: { ...actual.runExperiment, getStatus: runMocks.getStatus } };
});
vi.mock("../../src/features/run-evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/run-evidence")>();
  return { ...actual, fetchRunEvidence: evidenceMocks.fetchRunEvidence };
});

import LightweightResultsView from "../../src/views/LightweightResultsView.vue";
import LightweightRunView from "../../src/views/LightweightRunView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { useLightweightStore } from "../../src/stores/lightweight";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function bootstrapFixture() {
  return {
    manifest: {
      schema_version: "tilesim.bridge.manifest.v1",
      api_version: "tilesim.bridge.api.v1",
      schema_set_revision: "sha256:deep-link-schema",
      error_schema_version: "tilesim.bridge.error.v1",
      artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
      known_report_schema_identities: {},
      endpoints: {},
      legacy_unversioned: false,
    },
    health: {
      execution_ready: true,
      cli_available: true,
      versions_match: true,
      source_revision: "deep-link-source",
      build_revision: "deep-link-build",
      source_state_digest: "deep-link-source-digest",
      build_state_digest: "deep-link-build-digest",
      deployment_ref: "deep-link-fixture",
      backend_branch: "fixture",
    },
    catalog: { scenarios: [], fidelity_policies: ["default"] },
    capabilities: {
      default_gpu_participation_mode: "gpu_free",
      cycle_scope: "S6_hotspot_refinement_only",
      dependencies: {},
      run_surface: {},
    },
    experimentDescriptor: null,
    experimentDescriptorStatus: "legacy_compatibility" as const,
    experimentDescriptorError: "fixture_descriptor_unavailable",
    evidenceAgentDescriptor: null,
    evidenceAgentDescriptorStatus: "legacy_compatibility" as const,
    evidenceAgentDescriptorError: "fixture_evidence_agent_unavailable",
  };
}

function routerFor() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/lightweight/runs/:runId", name: "lightweight_run", component: LightweightRunView },
      { path: "/lightweight/results", name: "lightweight_results", component: LightweightResultsView },
      { path: "/lightweight", name: "lightweight", component: { template: "<div />" } },
      { path: "/lightweight/prepare", name: "lightweight_prepare", component: { template: "<div />" } },
      { path: "/overview", name: "overview", component: { template: "<div />" } },
    ],
  });
}

function resetStores() {
  const dashboard = useDashboard();
  dashboard.state.bridge.connected = false;
  dashboard.state.bridge.available = false;
  dashboard.state.bridge.checking = true;
  dashboard.state.bridge.manifest = null;
  dashboard.state.bridge.identity = null;
  dashboard.state.experiment.descriptor = null;
  dashboard.state.evidenceAgent.descriptor = null;
  const lightweight = useLightweightStore();
  lightweight.setRun(null);
  lightweight.reports.bundle = null;
  lightweight.reports.inputs = null;
  lightweight.reports.artifactManifest = null;
  bridgeMocks.fetchBridgeBootstrap.mockReset();
  runMocks.getStatus.mockReset();
  evidenceMocks.fetchRunEvidence.mockReset();
}

beforeEach(resetStores);
afterEach(() => {
  vi.useRealTimers();
});

describe("lightweight deep-link Bridge readiness", () => {
  it("waits for manifest bootstrap before reading a run status", async () => {
    const pending = deferred<ReturnType<typeof bootstrapFixture>>();
    bridgeMocks.fetchBridgeBootstrap.mockReturnValue(pending.promise);
    runMocks.getStatus.mockResolvedValue({ run_id: "run-deep-link-1", status: "running" });

    const router = routerFor();
    await router.push("/lightweight/runs/run-deep-link-1");
    await router.isReady();
    const wrapper = mount(LightweightRunView, { global: { plugins: [router] } });
    await flushPromises();
    await flushPromises();

    expect(runMocks.getStatus).not.toHaveBeenCalled();
    pending.resolve(bootstrapFixture());
    await flushPromises();
    expect(runMocks.getStatus).toHaveBeenCalledWith("run-deep-link-1");

    wrapper.unmount();
  });

  it("waits for manifest bootstrap before reading a deep-linked report", async () => {
    const pending = deferred<ReturnType<typeof bootstrapFixture>>();
    bridgeMocks.fetchBridgeBootstrap.mockReturnValue(pending.promise);
    evidenceMocks.fetchRunEvidence.mockResolvedValue({
      payload: { reports: {} },
      inputs: null,
      artifactManifest: null,
    });

    const router = routerFor();
    await router.push("/lightweight/results?run=run-deep-link-2");
    await router.isReady();
    const wrapper = mount(LightweightResultsView, { global: { plugins: [router] } });
    await flushPromises();

    expect(evidenceMocks.fetchRunEvidence).not.toHaveBeenCalled();
    pending.resolve(bootstrapFixture());
    await flushPromises();
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledWith("run-deep-link-2", expect.any(Object));

    wrapper.unmount();
  });

  it("fails closed when bootstrap is unavailable instead of issuing a status read", async () => {
    bridgeMocks.fetchBridgeBootstrap.mockRejectedValue(new Error("fixture bridge unavailable"));
    const router = routerFor();
    await router.push("/lightweight/runs/run-deep-link-unavailable");
    await router.isReady();
    const wrapper = mount(LightweightRunView, { global: { plugins: [router] } });
    await flushPromises();
    await flushPromises();

    expect(runMocks.getStatus).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Bridge 不可用");
    wrapper.unmount();
  });
});
