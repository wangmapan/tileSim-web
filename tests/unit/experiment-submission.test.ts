/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});

describe("experiment submission recovery", () => {
  it("restores an ambiguous POST key and payload after a module reload", async () => {
    const firstStore = await import("../../src/store/dashboard");
    firstStore.useDashboard().updateExperimentSubmission({
      payloadText: '{"scenario_id":"s1_des_example"}',
      idempotencyKey: "run-reload-safe-key",
      runId: "",
    });

    expect(JSON.parse(window.sessionStorage.getItem("tilesim-web.experiment-submission.v1") || "null")).toMatchObject({
      idempotencyKey: "run-reload-safe-key",
    });

    vi.resetModules();
    const restoredStore = await import("../../src/store/dashboard");
    expect(restoredStore.useDashboard().state.experimentSubmission).toEqual({
      payloadText: '{"scenario_id":"s1_des_example"}',
      idempotencyKey: "run-reload-safe-key",
      runId: "",
    });
  });
});
