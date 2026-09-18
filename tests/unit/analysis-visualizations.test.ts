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
          tpot_ps: undefined,
          end_to_end_latency_ps: "9007199254740993",
        },
      ],
    } as MetricsReport);

    expect(visualization.kind).toBe("bar");
    expect(visualization.rows[0].values[0]).toBe(0);
    expect(visualization.rows[0].values[1]).toBeNull();
    expect(visualization.rows[0].rawValues).toEqual(["0", "", "9007199254740993"]);
    expect(visualization.derivation).toBe("unit_conversion");
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
    expect(visualization.rows[0].label).toContain("S6");
    expect(visualization.rows[0].rawValues).toEqual(["9007199254740993"]);
    expect(visualization.rawUnit).toBe("ps");
  });
});
