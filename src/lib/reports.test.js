import { describe, expect, it } from "vitest";
import { bundleReports, classifyReport, evidenceSummary, normalizeApiReports, reportCompatibility } from "./reports";

describe("report adapters", () => {
  it("classifies the six TileSim report kinds", () => {
    expect(classifyReport({ summary: {} })).toBe("run");
    expect(classifyReport({ metric_lane: "synthetic_consistency" })).toBe("metrics");
    expect(classifyReport({ validation_lane: "synthetic_consistency" })).toBe("validation");
    expect(classifyReport({ cause_chain: [] })).toBe("tail");
    expect(classifyReport({ report_kind: "design_space_report", validation_lane: "synthetic_consistency" })).toBe(
      "design_space",
    );
    expect(classifyReport({ envelope_id: "env-1", stages: [] })).toBe("execution_envelope");
  });

  it("rejects a mixed-trace import", () => {
    expect(() =>
      bundleReports([
        { summary: { trace_name: "trace-a" } },
        { metric_lane: "synthetic_consistency", trace_name: "trace-b" },
      ]),
    ).toThrow(/不同 Trace/);
  });

  it("clears omitted report kinds instead of retaining stale data", () => {
    const bundle = normalizeApiReports({ metrics: { metric_lane: "synthetic_consistency" } });
    expect(bundle.run).toBeNull();
    expect(bundle.validation).toBeNull();
    expect(bundle.tail).toBeNull();
    expect(bundle.design_space).toBeNull();
    expect(bundle.execution_envelope).toBeNull();
  });

  it("derives provenance from validation without upgrading the claim", () => {
    const summary = evidenceSummary({
      validation: {
        trace_provenance: {
          source_mode: "synthetic_trace",
          calibration_level: "uncalibrated",
          allowed_claim_scope: "exploratory",
        },
      },
    });
    expect(summary).toMatchObject({
      sourceMode: "synthetic_trace",
      calibration: "uncalibrated",
      claimScope: "exploratory",
    });
  });

  it("bundles design-space reports without making them mandatory for legacy bundles", () => {
    const designSpace = {
      report_kind: "design_space_report",
      trace_name: "trace-a",
      ranking: [],
    };
    expect(bundleReports([designSpace]).design_space).toBe(designSpace);
    expect(normalizeApiReports({ design_space: designSpace }).design_space).toBe(designSpace);
  });

  it("prefers the report contract identity when generic and contract versions coexist", () => {
    expect(
      reportCompatibility("run", {
        report_kind: "wind_tunnel_run_result",
        schema_version: "generic.container.v1",
        contract_version: "wind_tunnel.run.v1alpha1",
        summary: { trace_name: "trace-a", range_label: "S1->S6" },
      }),
    ).toMatchObject({ status: "supported", schema: "wind_tunnel.run.v1alpha1" });
  });

  it("uses design-space provenance for a standalone import", () => {
    expect(
      evidenceSummary({
        design_space: {
          candidate_source_mode: "synthetic_trace",
          candidate_calibration_level: "uncalibrated",
          candidate_allowed_claim_scope: "exploratory_s6_only",
          validation_lane: "synthetic_consistency",
          evidence_tier: "synthetic_consistency",
        },
      }),
    ).toMatchObject({
      sourceMode: "synthetic_trace",
      calibration: "uncalibrated",
      claimScope: "exploratory_s6_only",
      lane: "synthetic_consistency",
      tier: "synthetic_consistency",
    });
  });
});
