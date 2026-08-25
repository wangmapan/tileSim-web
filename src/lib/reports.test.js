import { describe, expect, it } from "vitest";
import { bundleReports, classifyReport, evidenceSummary, normalizeApiReports } from "./reports";

describe("report adapters", () => {
  it("classifies the four TileSim report kinds", () => {
    expect(classifyReport({ summary: {} })).toBe("run");
    expect(classifyReport({ metric_lane: "synthetic_consistency" })).toBe("metrics");
    expect(classifyReport({ validation_lane: "synthetic_consistency" })).toBe("validation");
    expect(classifyReport({ cause_chain: [] })).toBe("tail");
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
});
