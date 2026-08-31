/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoBundle } from "../../src/data/demo";

const evidenceMocks = vi.hoisted(() => ({ fetchRunEvidence: vi.fn() }));
const bridgeMocks = vi.hoisted(() => ({ fetchBridgeBootstrap: vi.fn() }));

vi.mock("../../src/features/run-evidence", () => ({
  fetchRunEvidence: evidenceMocks.fetchRunEvidence,
}));
vi.mock("../../src/features/bridge-status", () => ({
  fetchBridgeBootstrap: bridgeMocks.fetchBridgeBootstrap,
}));

import { useDashboard } from "../../src/store/dashboard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
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

  it("does not claim a deep-linked run identity while the Bridge is disconnected", async () => {
    const dashboard = useDashboard();
    bridgeMocks.fetchBridgeBootstrap.mockRejectedValue(new Error("bridge unavailable"));

    await dashboard.initialize({ view: "execution", runId: "run-unavailable" });

    expect(dashboard.state.bridge.connected).toBe(false);
    expect(dashboard.state.runId).toBeNull();
    expect(evidenceMocks.fetchRunEvidence).not.toHaveBeenCalled();
  });

  it("persists clearing all comparison selections through the store action", () => {
    const dashboard = useDashboard();
    dashboard.state.history.selected = ["run-a", "run-b"];

    dashboard.clearComparisons();

    expect(dashboard.state.history.selected).toEqual([]);
    expect(JSON.parse(localStorage.getItem("tilesim-web.dashboard-state.v2") || "null").comparisonIds).toEqual([]);
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
