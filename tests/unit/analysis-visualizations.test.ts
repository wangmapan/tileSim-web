import { describe, expect, it } from "vitest";
import type { DesignSpaceReport, MetricsReport } from "../../src/contracts/report-model";
import {
  buildAttributionVisualization,
  buildDesignSpaceVisualization,
  buildFabricCompositionVisualizations,
  buildRequestLatencyVisualization,
} from "../../src/features/execution-inspector";

describe("analysis visualization models", () => {
  it("keeps a real zero distinct from missing and preserves exact request ps", () => {
    const visualization = buildRequestLatencyVisualization({
      report_id: "metrics",
      request_metrics: [
        {
          request_id: "request-0",
          status: "completed",
          ttft_ps: 0,
          has_ttft_sample: true,
          tpot_ps: undefined,
          has_tpot_sample: false,
          end_to_end_latency_ps: "9007199254740993",
          has_end_to_end_latency_sample: true,
        },
      ],
    } as MetricsReport);

    expect(visualization.kind).toBe("bar");
    expect(visualization.rows[0].values[0]).toBe(0);
    expect(visualization.rows[0].values[1]).toBeNull();
    expect(visualization.rows[0].rawValues).toEqual(["0", "", "9007199254740993"]);
    expect(visualization.derivation).toBe("unit_conversion");
  });

  it("fails closed when a uint64 latency has already been rounded into an unsafe number", () => {
    const visualization = buildRequestLatencyVisualization({
      report_id: "metrics-unsafe-number",
      request_metrics: [
        {
          request_id: "request-unsafe",
          ttft_ps: Number.MAX_SAFE_INTEGER + 2,
          has_ttft_sample: true,
        },
      ],
    } as MetricsReport);

    expect(visualization.rows[0].values[0]).toBeNull();
    expect(visualization.rows[0].rawValues?.[0]).toBe("");
    expect(visualization.rows[0].valueStatuses?.[0]).toBe("sample_unavailable");
  });

  it("keeps inferred, synthetic, and fallback samples explicit in the visualization", () => {
    const visualization = buildRequestLatencyVisualization({
      report_id: "metrics-provenance",
      trace_provenance: { source_mode: "synthetic_trace" },
      request_metrics: [
        {
          request_id: "request-provenance",
          ttft_ps: 10,
          has_ttft_sample: true,
          ttft_ps_source: "inferred",
          tpot_ps: 20,
          has_tpot_sample: true,
          tpot_ps_source: "fallback",
          end_to_end_latency_ps: 30,
          has_end_to_end_latency_sample: true,
        },
      ],
    } as MetricsReport);

    expect(visualization.rows[0].values).toEqual([0.00001, 0.00002, 0.00003]);
    expect(visualization.rows[0].valueStatuses).toEqual(["sample_inferred", "sample_fallback", "sample_synthetic"]);
    expect(visualization.rows[0].rawValues).toEqual(["10", "20", "30"]);
  });

  it("labels explicitly observed samples separately from generic reported samples", () => {
    const visualization = buildRequestLatencyVisualization({
      report_id: "metrics-observed",
      request_metrics: [
        {
          request_id: "request-observed",
          ttft_ps: 10,
          has_ttft_sample: true,
          ttft_ps_source: "observed",
        },
      ],
    } as MetricsReport);

    expect(visualization.rows[0].valueStatuses?.[0]).toBe("sample_observed");
  });

  it("uses direct Fabric fields without recomputing runtime, queue, or congestion", () => {
    const [domain, request] = buildFabricCompositionVisualizations({
      report_id: "metrics",
      system_summary: {
        fabric_domain_utilization: [
          { domain_id: "domain-0", runtime_us: 8, queue_delay_us: 0, congestion_delay_us: undefined },
        ],
        request_fabric_contributions: [
          { request_id: "request-0", runtime_us: 5, queue_delay_us: 2, congestion_delay_us: 1 },
        ],
      },
    } as MetricsReport);

    expect(domain.kind).toBe("stacked-bar");
    expect(domain.derivation).toBe("identity");
    expect(domain.rows[0].values).toEqual([8, 0, null]);
    expect(request.rows[0].values).toEqual([5, 2, 1]);
  });

  it("plots only formal objectives and preserves backend Pareto membership", () => {
    const report = {
      execution_scope: "S6_only",
      ranking: [
        {
          candidate_id: "candidate-a",
          final_rank: 2,
          pareto_member: true,
          dominance_status: "non_dominated",
          projected_p99_latency_us: 1,
          objectives: [
            {
              objective_id: "p99",
              metric_kind: "p99",
              direction: "minimize",
              value: 20,
              unit: "µs",
              availability: "available",
              evidence_ref: {},
            },
            {
              objective_id: "throughput",
              metric_kind: "throughput",
              direction: "maximize",
              value: 100,
              unit: "req/s",
              availability: "available",
              evidence_ref: {},
            },
          ],
        },
        {
          candidate_id: "candidate-b",
          final_rank: 1,
          pareto_member: false,
          dominance_status: "dominated",
          projected_p99_latency_us: 999,
          objectives: [
            {
              objective_id: "p99",
              metric_kind: "p99",
              direction: "minimize",
              value: 10,
              unit: "µs",
              availability: "available",
              evidence_ref: {},
            },
            {
              objective_id: "throughput",
              metric_kind: "throughput",
              direction: "maximize",
              value: 200,
              unit: "req/s",
              availability: "available",
              evidence_ref: {},
            },
          ],
        },
      ],
    } as DesignSpaceReport;
    const visualization = buildDesignSpaceVisualization(
      report,
      (candidateIndex, objectiveIndex) =>
        `design-space-report:/candidates/${candidateIndex}/objectives/${objectiveIndex}`,
      (candidateIndex) => `design-space-report:/candidates/${candidateIndex}`,
    );

    expect(visualization.kind).toBe("scatter");
    expect(visualization.rows[0].values).toEqual([20, 100]);
    expect(visualization.rows[0].status).toBe("pareto_member");
    expect(visualization.rows[1].status).toBe("dominated");
    expect(visualization.rows[1].values).not.toContain(999);
    expect(visualization.boundary).toContain("不计算 Pareto");
  });

  it("does not reconstruct Pareto when formal objectives are absent", () => {
    const visualization = buildDesignSpaceVisualization({
      execution_scope: "S6_only",
      ranking: [{ candidate_id: "projected-only", projected_p95_latency_us: 1, projected_p99_latency_us: 2 }],
    } as DesignSpaceReport);
    expect(visualization.kind).toBe("none");
    expect(visualization.emptyReason).toContain("不会用 projected 指标重建 Pareto");
  });

  it("keeps S7/S8/S9 output records outside the S0-S6 attribution chart", () => {
    const visualization = buildAttributionVisualization([
      { attribution_id: "cause-s6", subsystem: "S6", component_code: "fabric", score_ps: "9007199254740993" },
      { attribution_id: "host-s7", subsystem: "S7", component_code: "host", score_ps: 8 },
      { attribution_id: "validation-s8", subsystem: "S8", component_code: "validation", score_ps: 7 },
      { attribution_id: "output-s9", subsystem: "S9", component_code: "metrics", score_ps: 6 },
    ]);

    expect(visualization.rows).toHaveLength(1);
    expect(visualization.rows[0].label).toContain("网络与硬件资源模块");
    expect(visualization.rows[0].rawValues).toEqual(["9007199254740993"]);
    expect(visualization.rawUnit).toBe("ps");
  });

  it("renders canonical floating-point attribution scores while preserving their raw text", () => {
    const visualization = buildAttributionVisualization([
      {
        attribution_id: "fractional-score",
        subsystem: "S3",
        component_code: "kv",
        score_ps: 1500000.5,
      },
      {
        attribution_id: "legacy-fractional-score",
        subsystem: "S4",
        component_code: "device",
        score_ps: "2500000.25",
      },
    ]);
    expect(visualization.rows[0].values[0]).toBeCloseTo(1.5000005);
    expect(visualization.rows[0].rawValues).toEqual(["1500000.5"]);
    expect(visualization.rows[1].values[0]).toBeCloseTo(2.50000025);
    expect(visualization.rows[1].rawValues).toEqual(["2500000.25"]);
  });
});
