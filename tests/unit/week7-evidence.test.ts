import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  evidenceMap: vi.fn(),
  calibration: vi.fn(),
  orchestration: vi.fn(),
}));

vi.mock("../../src/lib/api", () => ({
  bridgeApi: {
    week7EvidenceMap: apiMocks.evidenceMap,
    runWeek7CalibrationExample: apiMocks.calibration,
    runWeek7OrchestrationExample: apiMocks.orchestration,
  },
}));

import { fetchWeek7Evidence } from "../../src/features/week7-evidence";
import { queryClient } from "../../src/lib/query-client";

const evidenceMap = {
  schema_version: "tilesim.s9.report_field_evidence_map.v1alpha1",
  status: "pass",
  rules: [],
};
const calibration = {
  schema_version: "tilesim.calibration.workflow_report.v1alpha1",
  report_id: "calibration",
  manifest_id: "manifest",
  status: "passed",
  evidence_tier: "offline_fixture_consistency",
  allowed_claim_scope: "workflow_consistency_only",
  scopes: [],
  errors: [],
};
const orchestration = {
  schema_version: "tilesim.agent.orchestration_report.v1alpha1",
  intent_id: "intent",
  status: "completed",
  run_instance_id: "run",
  frozen_configuration_digest: "frozen",
  simulation_result_status: "partial",
  simulation_result_digest: "result",
  tool_calls: [],
  artifact_results: [],
  errors: [],
};

describe("Week 7 evidence queries", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    apiMocks.evidenceMap.mockResolvedValue(evidenceMap);
    apiMocks.calibration.mockResolvedValue(calibration);
    apiMocks.orchestration.mockResolvedValue(orchestration);
  });

  it("executes the fixed operations sequentially for the single-slot Bridge", async () => {
    const order: string[] = [];
    apiMocks.evidenceMap.mockImplementation(async () => {
      order.push("evidence-map");
      return evidenceMap;
    });
    apiMocks.calibration.mockImplementation(async () => {
      order.push("calibration");
      return calibration;
    });
    apiMocks.orchestration.mockImplementation(async () => {
      order.push("orchestration");
      return orchestration;
    });

    await fetchWeek7Evidence({ backendIdentity: "backend-a", schemaRevision: "schema-a" });

    expect(order).toEqual(["evidence-map", "calibration", "orchestration"]);
  });

  it("separates cached evidence when the schema-set revision changes", async () => {
    await fetchWeek7Evidence({ backendIdentity: "backend-a", schemaRevision: "schema-a" });
    await fetchWeek7Evidence({ backendIdentity: "backend-a", schemaRevision: "schema-a" });
    await fetchWeek7Evidence({ backendIdentity: "backend-a", schemaRevision: "schema-b" });

    expect(apiMocks.evidenceMap).toHaveBeenCalledTimes(2);
    expect(apiMocks.calibration).toHaveBeenCalledTimes(2);
    expect(apiMocks.orchestration).toHaveBeenCalledTimes(2);
  });
});
