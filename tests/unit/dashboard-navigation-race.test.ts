/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoBundle } from "../../src/data/demo";
import type { ApiManifestResponse } from "../../src/contracts/bridge-api";

const evidenceMocks = vi.hoisted(() => ({ fetchRunEvidence: vi.fn() }));
const bridgeMocks = vi.hoisted(() => ({ fetchBridgeBootstrap: vi.fn() }));

vi.mock("../../src/features/run-evidence", () => ({
  fetchRunEvidence: evidenceMocks.fetchRunEvidence,
}));
vi.mock("../../src/features/bridge-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/bridge-status")>();
  return { ...actual, fetchBridgeBootstrap: bridgeMocks.fetchBridgeBootstrap };
});

import { useDashboard } from "../../src/store/dashboard";
import { busyClaimCount } from "../../src/store/dashboard-state";

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
      schema_set_revision: "sha256:fixture-schema",
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
      source_revision: "fixture-source",
      build_revision: "fixture-build",
      source_state_digest: "fixture-source-digest",
      build_state_digest: "fixture-build-digest",
      deployment_ref: "fixture",
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

describe("dashboard navigation concurrency", () => {
  beforeEach(() => {
    evidenceMocks.fetchRunEvidence.mockReset();
    bridgeMocks.fetchBridgeBootstrap.mockReset();
    localStorage.clear();
    const dashboard = useDashboard();
    dashboard.applyBundle(demoBundle, { runId: null, runName: "demo", isDemo: true });
    dashboard.state.bridge.connected = false;
    dashboard.state.history.selected = [];
  });

  it("keeps the busy state until the newest run request settles", async () => {
    const dashboard = useDashboard();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation((runId: string) =>
      runId === "run-first" ? first.promise : second.promise,
    );
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = null;

    const firstNavigation = dashboard.synchronizeNavigation("execution", "run-first");
    const secondNavigation = dashboard.synchronizeNavigation("execution", "run-second");
    first.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await firstNavigation;

    expect(dashboard.state.busy).toBe(true);

    second.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await secondNavigation;

    expect(dashboard.state.busy).toBe(false);
    expect(dashboard.state.runId).toBe("run-second");
  });

  it("releases a superseded run restore when the destination is backend-global", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockReturnValue(pending.promise);
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = null;

    const runRestore = dashboard.synchronizeNavigation("execution", "run-first");
    expect(dashboard.state.busy).toBe(true);

    await dashboard.synchronizeNavigation("evidence_lab", null);
    expect(dashboard.state.busy).toBe(false);

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await runRestore;
    expect(dashboard.state.busy).toBe(false);
  });

  it("does not claim a deep-linked run identity while the Bridge is disconnected", async () => {
    const dashboard = useDashboard();
    bridgeMocks.fetchBridgeBootstrap.mockRejectedValue(new Error("bridge unavailable"));

    await dashboard.initialize({ view: "execution", runId: "run-unavailable" });

    expect(dashboard.state.bridge.connected).toBe(false);
    expect(dashboard.state.runId).toBeNull();
    expect(evidenceMocks.fetchRunEvidence).not.toHaveBeenCalled();
  });

  it("shares one Bridge bootstrap promise with deep-linked child pages", async () => {
    const dashboard = useDashboard();
    const pending = deferred<ReturnType<typeof bootstrapFixture>>();
    bridgeMocks.fetchBridgeBootstrap.mockReturnValue(pending.promise);
    dashboard.state.bridge.connected = false;
    dashboard.state.bridge.checking = true;

    const first = dashboard.ensureBridgeReady();
    const second = dashboard.ensureBridgeReady();

    expect(bridgeMocks.fetchBridgeBootstrap).toHaveBeenCalledTimes(1);
    expect(dashboard.state.bridge.checking).toBe(true);

    pending.resolve(bootstrapFixture());
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(dashboard.state.bridge.connected).toBe(true);
    expect((dashboard.state.bridge.manifest as ApiManifestResponse | null)?.schema_set_revision).toBe(
      "sha256:fixture-schema",
    );
    expect(dashboard.state.bridge.checking).toBe(false);
  });

  it("does not treat a connected state without a manifest as run-page ready", async () => {
    const dashboard = useDashboard();
    const pending = deferred<ReturnType<typeof bootstrapFixture>>();
    bridgeMocks.fetchBridgeBootstrap.mockReturnValue(pending.promise);
    dashboard.state.bridge.connected = true;
    dashboard.state.bridge.checking = false;
    dashboard.state.bridge.manifest = null;

    const ready = dashboard.ensureBridgeReady();

    expect(bridgeMocks.fetchBridgeBootstrap).toHaveBeenCalledTimes(1);
    pending.resolve(bootstrapFixture());
    await expect(ready).resolves.toBe(true);
    // The assignment to `manifest = null` above intentionally narrows the
    // reactive proxy for TypeScript's control-flow analysis. Read the value
    // through a widened test-only view after the async bootstrap completes.
    const manifest = dashboard.state.bridge.manifest as { schema_set_revision?: string } | null;
    expect(manifest?.schema_set_revision).toBe("sha256:fixture-schema");
  });

  it("persists clearing all comparison selections through the store action", () => {
    const dashboard = useDashboard();
    dashboard.state.history.selected = ["run-a", "run-b"];

    dashboard.clearComparisons();

    expect(dashboard.state.history.selected).toEqual([]);
    expect(JSON.parse(localStorage.getItem("tilesim-web.dashboard-state.v2") || "null").comparisonIds).toEqual([]);
  });

  it("clears the orphan busy state when the evidence lab supersedes an in-flight synchronization", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation(() => pending.promise);
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = null;

    const superseded = dashboard.synchronizeNavigation("execution", "run-slow");
    expect(dashboard.state.busy).toBe(true);

    // (a) view === "evidence_lab" returns early without issuing a fetch (dashboard.ts:107).
    const replacement = dashboard.synchronizeNavigation("evidence_lab", null);
    await replacement;

    expect(dashboard.state.busy).toBe(false);
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledTimes(1);

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await superseded;

    expect(dashboard.state.busy).toBe(false);
  });

  it("clears the orphan busy state when the navigation targets the already-open run", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation(() => pending.promise);
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = "run-open";

    const superseded = dashboard.synchronizeNavigation("metrics", "run-other");
    expect(dashboard.state.busy).toBe(true);

    // (b) requestedRunId === state.runId returns early
    // (dashboard.ts:116; was :109 before the claim-token fix shifted the block).
    const replacement = dashboard.synchronizeNavigation("execution", "run-open");
    await replacement;

    expect(dashboard.state.busy).toBe(false);
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledTimes(1);

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await superseded;

    expect(dashboard.state.busy).toBe(false);
  });

  it("clears the orphan busy state when a navigation without a run resets to the demo bundle", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation(() => pending.promise);
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = "run-open";

    const superseded = dashboard.synchronizeNavigation("metrics", "run-other");
    expect(dashboard.state.busy).toBe(true);

    // (c) !requestedRunId resets to the demo bundle and returns early (dashboard.ts:110-114).
    const replacement = dashboard.synchronizeNavigation("overview", null);
    await replacement;

    expect(dashboard.state.busy).toBe(false);
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledTimes(1);
    expect(dashboard.state.runId).toBeNull();
    expect(dashboard.state.runName).toBe("内置示例");

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await superseded;

    expect(dashboard.state.busy).toBe(false);
  });

  it("clears the orphan busy state when a disconnected bridge supersedes the synchronization", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation(() => pending.promise);
    dashboard.state.bridge.connected = true;

    const superseded = dashboard.synchronizeNavigation("execution", "run-slow");
    expect(dashboard.state.busy).toBe(true);

    dashboard.state.bridge.connected = false;
    // (d) !state.bridge.connected returns early
    // (dashboard.ts:122; was :115 before the claim-token fix shifted the block).
    const replacement = dashboard.synchronizeNavigation("metrics", "run-other");
    await replacement;

    expect(dashboard.state.busy).toBe(false);
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledTimes(1);

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await superseded;

    expect(dashboard.state.busy).toBe(false);
    expect(busyClaimCount()).toBe(0);
  });

  it("keeps the busy state owned by an in-flight run open while a navigation supersedes it", async () => {
    const dashboard = useDashboard();
    const pending = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation(() => pending.promise);
    dashboard.state.bridge.connected = true;

    const openedRun = dashboard.openRun("run-open");
    expect(dashboard.state.busy).toBe(true);

    await dashboard.synchronizeNavigation("evidence_lab", null);

    expect(dashboard.state.busy).toBe(true);

    pending.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await openedRun;

    expect(dashboard.state.busy).toBe(false);
  });

  it("keeps a superseded synchronization from clearing the busy state of an in-flight run open", async () => {
    const dashboard = useDashboard();
    const navigationRequest = deferred<unknown>();
    const runOpenRequest = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation((runId: string) =>
      runId === "run-open" ? runOpenRequest.promise : navigationRequest.promise,
    );
    dashboard.state.bridge.connected = true;
    dashboard.state.runId = null;

    const openedRun = dashboard.openRun("run-open");
    const superseded = dashboard.synchronizeNavigation("execution", "run-slow");
    await dashboard.synchronizeNavigation("evidence_lab", null);

    navigationRequest.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await superseded;

    expect(dashboard.state.busy).toBe(true);
    expect(evidenceMocks.fetchRunEvidence).toHaveBeenCalledTimes(2);

    runOpenRequest.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await openedRun;

    expect(dashboard.state.busy).toBe(false);
    expect(busyClaimCount()).toBe(0);
  });

  it("keeps the busy state until the last concurrent run open settles", async () => {
    const dashboard = useDashboard();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    evidenceMocks.fetchRunEvidence.mockImplementation((runId: string) =>
      runId === "run-a" ? first.promise : second.promise,
    );
    dashboard.state.bridge.connected = true;

    const openA = dashboard.openRun("run-a");
    const openB = dashboard.openRun("run-b");

    first.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await openA;

    expect(dashboard.state.busy).toBe(true);

    second.resolve({ payload: { reports: demoBundle }, inputs: {}, artifactManifest: null });
    await openB;

    expect(dashboard.state.busy).toBe(false);
  });

  it("preserves the selected run while visiting the backend-global evidence lab", async () => {
    const dashboard = useDashboard();
    dashboard.state.runId = "run-preserved";
    dashboard.state.runName = "Preserved run";

    await dashboard.synchronizeNavigation("evidence_lab", null);

    expect(dashboard.state.view).toBe("evidence_lab");
    expect(dashboard.state.runId).toBe("run-preserved");
    expect(JSON.parse(localStorage.getItem("tilesim-web.dashboard-state.v2") || "null").runId).toBe("run-preserved");
  });
});
