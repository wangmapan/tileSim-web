import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLayerVisualizations, buildStageTimeline } from "../../src/features/execution-inspector";
import { chartOption } from "../../src/features/execution-inspector/charts/chart-options";
import type { ReportBundle } from "../../src/contracts/report-model";
import type { LayerVisualization } from "../../src/features/execution-inspector/model/types";

const inputs = { runtime_trace: null, topology: null };

afterEach(() => vi.unstubAllGlobals());

function bundleWithPhases(phases: Array<Record<string, unknown>>): ReportBundle {
  return {
    run: null,
    validation: null,
    tail: null,
    design_space: null,
    execution_envelope: null,
    unsupported: {},
    compatibility: {},
    metrics: {
      report_id: "visualization-test",
      system_summary: { phase_fabric_contributions: phases },
    },
  } as ReportBundle;
}

describe("execution visualization selection", () => {
  it("uses a field matrix for categorical provenance instead of a quantity chart", () => {
    const bundle = bundleWithPhases([]);
    bundle.validation = {
      report_id: "validation",
      trace_provenance: {
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "exploratory",
      },
    };
    const visualization = buildLayerVisualizations("S0", bundle, inputs)[0];
    expect(visualization.kind).toBe("matrix");
    expect(visualization.rows.find((row) => row.label === "source_mode")?.values[0]).toBe("synthetic_trace");
  });

  it("deduplicates S3 events and keeps a real zero distinct from missing", () => {
    const visualization = buildLayerVisualizations(
      "S3",
      bundleWithPhases([
        { memory_event_id: "m0", memory_latency_us: 0 },
        { memory_event_id: "m0", memory_latency_us: 0 },
        { memory_event_id: "m1" },
      ]),
      inputs,
    )[0];
    expect(visualization.kind).toBe("bar");
    expect(visualization.rows).toHaveLength(1);
    expect(visualization.rows[0].values[0]).toBe(0);
  });

  it("uses scatter only for at least three complete S4 samples", () => {
    const twoSamples = bundleWithPhases([
      { device_task_id: "d0", device_latency_us: 2, device_occupancy_ratio: 0.2 },
      { device_task_id: "d1", device_latency_us: 3, device_occupancy_ratio: 0.3 },
    ]);
    const threeSamples = bundleWithPhases([
      ...(twoSamples.metrics?.system_summary?.phase_fabric_contributions || []),
      { device_task_id: "d2", device_latency_us: 4, device_occupancy_ratio: 0.4 },
    ]);
    expect(buildLayerVisualizations("S4", twoSamples, inputs)[0].kind).toBe("bar");
    expect(buildLayerVisualizations("S4", threeSamples, inputs)[0].kind).toBe("scatter");
  });

  it("keeps runtime, queue, and congestion in named S5 stacked series", () => {
    const visualization = buildLayerVisualizations(
      "S5",
      bundleWithPhases([
        { collective_id: "c0", runtime_us: 4, queue_delay_us: 2, congestion_delay_us: 1 },
        { collective_id: "c0", runtime_us: 6, queue_delay_us: 3, congestion_delay_us: 0.5 },
      ]),
      inputs,
    )[0];
    expect(visualization.kind).toBe("stacked-bar");
    expect(visualization.columns).toEqual(["Runtime", "Queue", "Congestion"]);
    expect(visualization.rows[0].values).toEqual([10, 5, 1.5]);
  });
});

describe("S7 stage timeline", () => {
  it("preserves raw ps values while converting safe relative positions to ns", () => {
    const timeline = buildStageTimeline([
      { stage_id: "runtime", subsystem: "S1", start_time_ps: "90071992547409930", end_time_ps: "90071992547410930" },
      { stage_id: "fabric", subsystem: "S6", start_time_ps: "90071992547410930", end_time_ps: "90071992547412930" },
    ]);
    expect(timeline.kind).toBe("timeline");
    expect(timeline.rows[0].values).toEqual([0, 1]);
    expect(timeline.rows[1].values).toEqual([1, 2]);
    expect(timeline.rows[0].rawValues).toEqual(["90071992547409930", "90071992547410930"]);
  });

  it("fails closed when every stage has a negative duration", () => {
    const timeline = buildStageTimeline([{ stage_id: "invalid", start_time_ps: 20, end_time_ps: 10 }]);
    expect(timeline.kind).toBe("none");
    expect(timeline.emptyReason).toContain("负时长");
  });

  it("disables ECharts-generated aria text that exposes internal NaN timeline dimensions", () => {
    const timeline = buildStageTimeline([
      { stage_id: "runtime", subsystem: "S1", start_time_ps: 0, end_time_ps: 1000 },
    ]);
    expect(chartOption(timeline).aria).toEqual({ enabled: false });
  });
});

describe("chart motion preference", () => {
  const visualization: LayerVisualization = {
    id: "motion-test",
    kind: "bar",
    title: "Motion test",
    description: "",
    question: "How is the value distributed?",
    firstLook: "Inspect the reported value.",
    boundary: "The chart does not infer new facts.",
    rationale: "",
    unit: "µs",
    sourcePaths: ["metrics.rows"],
    derivation: "identity",
    columns: ["latency"],
    series: [{ name: "Latency", color: "#3376a3" }],
    rows: [{ label: "sample", values: [1], sourcePath: "metrics.rows.0" }],
  };

  it("disables ECharts animation when the operating system requests reduced motion", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const option = chartOption(visualization);
    expect(option.animationDuration).toBe(0);
    expect(option.animationDurationUpdate).toBe(0);
  });

  it("keeps the default chart reveal short", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const option = chartOption(visualization);
    expect(option.animationDuration).toBe(260);
    expect(option.animationDurationUpdate).toBe(260);
  });
});
