import { describe, expect, it } from "vitest";
import { losslessIntegerToBigInt } from "../../src/contracts/lossless-json";
import type { Availability, ReportBundle } from "../../src/contracts/report-model";
import {
  buildMetricsCoverage,
  buildRunCoverage,
  buildRunVerdict,
  buildTailCoverage,
  buildValidationCoverage,
  buildEnvelopeCoverage,
} from "../../src/features/report-coverage";
import type { CoverageGroup } from "../../src/features/report-coverage";
import { availabilityLabel, availabilityStates } from "../../src/features/report-coverage";
import { buildWeek8ExecutionSummary } from "../../src/features/run-bound-evidence/week8-execution";
import { normalizeApiReports } from "../../src/lib/reports";

const runId = "run-coverage-1";

function emptyBundle(overrides: Partial<ReportBundle> = {}): ReportBundle {
  return {
    run: null,
    metrics: null,
    validation: null,
    tail: null,
    design_space: null,
    execution_envelope: null,
    run_bound_des_evidence: null,
    unsupported: {},
    compatibility: {},
    ...overrides,
  };
}

function fieldOf(groups: CoverageGroup[], key: string) {
  for (const group of groups) {
    const match = group.fields.find((item) => item.key === key);
    if (match) return match;
  }
  throw new Error(`missing coverage field ${key}`);
}

function listOf(groups: CoverageGroup[], key: string) {
  for (const group of groups) {
    const match = group.lists.find((item) => item.key === key);
    if (match) return match;
  }
  throw new Error(`missing coverage list ${key}`);
}

function cellOf(list: ReturnType<typeof listOf>, rowIndex: number, cellKey: string) {
  const cell = list.records[rowIndex].cells.find((item) => item.key === cellKey);
  if (!cell) throw new Error(`missing cell ${cellKey}`);
  return cell;
}

describe("availability five-state semantics", () => {
  it("keeps every state distinct in copy", () => {
    const labels = availabilityStates.map((state) => availabilityLabel(state));
    expect(new Set(labels).size).toBe(5);
    expect(labels).toEqual(["报告已提供", "预期缺省", "未覆盖", "缺失", "不支持的 Schema"]);
  });

  it("keeps a reported 0 as an available value rather than an absence", () => {
    const bundle = emptyBundle({
      metrics: {
        report_id: "m",
        summary: { request_count: 0, completed_request_count: 0, rejected_request_count: 0 },
      },
    });
    const field = fieldOf(buildMetricsCoverage(bundle), "summary.rejected_request_count");
    expect(field.text).toBe("0");
    expect(field.availability).toBe<Availability>("available");
  });

  it("distinguishes missing, expected_absence and not_covered from the resolution entries", () => {
    const base = {
      report_id: "m",
      summary: {},
    };
    const missing = emptyBundle({ metrics: base });
    expect(fieldOf(buildMetricsCoverage(missing), "ttft_ps.p95_ps").availability).toBe<Availability>("missing");

    const expected = emptyBundle({
      metrics: base,
      validation: {
        report_id: "v",
        resolution_entries: [{ subsystem: "S1", expected_absence: true, resolution: "expected_absence" }],
      },
    });
    expect(fieldOf(buildMetricsCoverage(expected), "ttft_ps.p95_ps").availability).toBe<Availability>(
      "expected_absence",
    );

    const notCovered = emptyBundle({
      metrics: base,
      validation: {
        report_id: "v",
        resolution_entries: [{ subsystem: "S1", not_covered: true, resolution: "not_covered" }],
      },
    });
    expect(fieldOf(buildMetricsCoverage(notCovered), "ttft_ps.p95_ps").availability).toBe<Availability>("not_covered");
  });

  it("marks an unadapted report version as unsupported_schema", () => {
    const bundle = emptyBundle({
      metrics: { report_id: "m", summary: {} },
      compatibility: {
        metrics: { status: "unsupported_schema", schema: "tilesim.metrics_report.v9", supported: false, issues: [] },
      },
    });
    expect(fieldOf(buildMetricsCoverage(bundle), "ttft_ps.p95_ps").availability).toBe<Availability>(
      "unsupported_schema",
    );
  });

  it("resolves row cells through the same parser as their fields", () => {
    const bundle = emptyBundle({
      metrics: { report_id: "m", summary: {}, resolution_entries: [{ subsystem: "S1" }] },
    });
    const list = listOf(buildMetricsCoverage(bundle), "resolution_entries");
    expect(cellOf(list, 0, "subsystem").availability).toBe<Availability>("available");
    expect(cellOf(list, 0, "requested_fidelity").availability).toBe<Availability>("missing");
    expect(cellOf(list, 0, "requested_fidelity").text).toBeNull();
  });

  it("keeps a reported false cell available instead of absent", () => {
    const bundle = emptyBundle({
      metrics: {
        report_id: "m",
        summary: {},
        resolution_entries: [{ subsystem: "S1", downgraded: false, fallback: false, expected_absence: false }],
      },
    });
    const list = listOf(buildMetricsCoverage(bundle), "resolution_entries");
    expect(cellOf(list, 0, "downgraded")).toMatchObject({ text: "否", availability: "available" });
    expect(cellOf(list, 0, "fallback").availability).toBe<Availability>("available");
  });

  it("reports an unsupported schema on both the list container and its row cells", () => {
    const withoutEntries = emptyBundle({
      metrics: { report_id: "m", summary: {} },
      compatibility: {
        metrics: { status: "unsupported_schema", schema: "tilesim.metrics_report.v9", supported: false, issues: [] },
      },
    });
    expect(listOf(buildMetricsCoverage(withoutEntries), "resolution_entries").availability).toBe<Availability>(
      "unsupported_schema",
    );

    const withEntries = emptyBundle({
      metrics: { report_id: "m", summary: {}, resolution_entries: [{ subsystem: "S1" }] },
      compatibility: {
        metrics: { status: "unsupported_schema", schema: "tilesim.metrics_report.v9", supported: false, issues: [] },
      },
    });
    const list = listOf(buildMetricsCoverage(withEntries), "resolution_entries");
    expect(list.availability).toBe<Availability>("available");
    expect(cellOf(list, 0, "requested_fidelity").availability).toBe<Availability>("unsupported_schema");
    expect(cellOf(list, 0, "subsystem").availability).toBe<Availability>("available");
  });

  it("keeps a resolved not_covered and expected_absence out of the missing state", () => {
    const entries = { report_id: "m", summary: {}, resolution_entries: [{ subsystem: "S1" }] };
    const notCovered = emptyBundle({
      metrics: entries,
      validation: {
        report_id: "v",
        resolution_entries: [{ subsystem: "S1", not_covered: true, resolution: "not_covered" }],
      },
    });
    const notCoveredCell = cellOf(listOf(buildMetricsCoverage(notCovered), "resolution_entries"), 0, "state");
    expect(notCoveredCell.availability).toBe<Availability>("not_covered");

    const expected = emptyBundle({
      metrics: entries,
      validation: {
        report_id: "v",
        resolution_entries: [{ subsystem: "S1", expected_absence: true, resolution: "expected_absence" }],
      },
    });
    const expectedCell = cellOf(listOf(buildMetricsCoverage(expected), "resolution_entries"), 0, "state");
    expect(expectedCell.availability).toBe<Availability>("expected_absence");
    expect(new Set([notCoveredCell.availability, expectedCell.availability]).size).toBe(2);
  });
});

const rawRun = {
  report_kind: "wind_tunnel_run_result",
  contract_version: "wind_tunnel.run.v1alpha1",
  status: "incomplete",
  error_code: "des_contract_gap",
  cause: "DES contract not satisfied for S4.",
  next_action: "rerun with --fidelity-policy des",
  completeness: 0.5,
  summary: {
    trace_name: "trace-coverage",
    range_label: "S1->S6",
    host_path: "S7",
    execution_path: "hosted",
    preferred_entrypoint: "S1",
    has_tail_attribution: true,
    end_to_end_latency_us: 0,
  },
  resolved_fidelity_profile: {
    range_label: "S1->S6",
    has_downgrades: true,
    has_fallbacks: false,
    has_not_covered: true,
    has_expected_absence: false,
    claim_scope_summary: "engineering_execution_consistency_only",
    entries: [
      {
        subsystem: "S4",
        requested_fidelity: "des",
        actual_fidelity: "analytical",
        resolution: "downgraded",
        state: "resolved",
        downgraded: true,
        fallback: false,
        not_covered: false,
        expected_absence: false,
        claim_scope_impact: "device latency is estimated, not executed",
        detail: "no device execution evidence",
      },
    ],
  },
  multi_granularity_profile: {
    requested_tier: "des",
    capability_registry: {
      registry_version: "cap-registry-v1",
      entries: [
        {
          subsystem: "S4",
          subsystem_name: "Device",
          analytical_capability: "supported",
          des_capability: "supported",
          cycle_capability: "not_supported",
          des_contract_role: "required",
          des_required_for_host_contract: true,
        },
        {
          subsystem: "S5",
          des_contract_role: "optional",
          des_required_for_host_contract: false,
        },
      ],
    },
    requested_tier_state: "partially_supported",
    unsupported_reason: "",
    des_completion_state: "partial",
    des_contract_state: "unsatisfied",
    des_required_subsystem_count: 2,
    des_satisfied_subsystem_count: 1,
    des_contract_gaps: ["S4 des evidence missing"],
    has_des_gap: true,
    has_cycle_gap: false,
    summary: "one required subsystem missing DES evidence",
    entries: [{ subsystem: "S4", analytical_status: "supported", des_status: "missing", effective_tier: "analytical" }],
  },
  bottleneck_report: {
    primary_subsystem: "S4",
    title: "device bound",
    detail: "raw detail",
    supporting_artifacts: ["metrics", "validation"],
  },
  artifacts: [
    {
      artifact_id: "week8-run-evidence",
      state: "expected_absence",
      evidence_requirement: "required",
      absence_reason: "des_not_requested_for_this_boundary",
      detail: "no DES execution for this run",
    },
  ],
};

describe("C0-1 run coverage", () => {
  const bundle = normalizeApiReports({ run: rawRun });
  const groups = buildRunCoverage(bundle);

  it("renders next_action verbatim next to cause", () => {
    const nextAction = fieldOf(groups, "run.next_action");
    expect(nextAction.text).toBe("rerun with --fidelity-policy des");
    expect(nextAction.sourcePaths).toEqual(["/run/next_action"]);
    expect(nextAction.availability).toBe("available");
    expect(fieldOf(groups, "run.cause").text).toBe("DES contract not satisfied for S4.");
    const verdict = buildRunVerdict(bundle);
    expect(verdict?.nextAction.text).toBe("rerun with --fidelity-policy des");
    expect(verdict?.cause.text).toBe("DES contract not satisfied for S4.");
  });

  it("lists partial artifacts with the backend absence reason", () => {
    const list = listOf(groups, "run.artifacts");
    expect(list.availability).toBe("available");
    expect(cellOf(list, 0, "artifact_id").text).toBe("week8-run-evidence");
    expect(cellOf(list, 0, "absence_reason").text).toBe("des_not_requested_for_this_boundary");
    expect(cellOf(list, 0, "payload_json").availability).toBe("missing");
  });

  it("exposes capability registry roles and host-contract requirement as explicit yes/no", () => {
    const list = listOf(groups, "capability_registry.entries");
    expect(list.records).toHaveLength(2);
    expect(cellOf(list, 0, "des_contract_role").text).toBe("required");
    expect(cellOf(list, 0, "des_required_for_host_contract").text).toBe("是");
    expect(cellOf(list, 1, "des_required_for_host_contract").text).toBe("否");
    expect(cellOf(list, 0, "cycle_capability").text).toBe("not_supported");
    expect(fieldOf(groups, "capability_registry.registry_version").text).toBe("cap-registry-v1");
  });

  it("renders DES aggregates, contract gaps and supporting artifacts", () => {
    expect(fieldOf(groups, "des_contract_state").text).toBe("unsatisfied");
    expect(fieldOf(groups, "des_required_subsystem_count").text).toBe("2");
    expect(fieldOf(groups, "des_satisfied_subsystem_count").text).toBe("1");
    expect(fieldOf(groups, "has_des_gap").text).toBe("是");
    expect(fieldOf(groups, "has_cycle_gap").text).toBe("否");
    expect(fieldOf(groups, "unsupported_reason").text).toBe("（报告为空字符串）");
    expect(listOf(groups, "des_contract_gaps").records).toHaveLength(1);
    expect(listOf(groups, "bottleneck_report.supporting_artifacts").records).toHaveLength(2);
  });

  it("keeps requested and actual fidelity separate with per-entry claim scope impact", () => {
    expect(fieldOf(groups, "has_downgrades").text).toBe("是");
    expect(fieldOf(groups, "has_fallbacks").text).toBe("否");
    expect(fieldOf(groups, "has_not_covered").text).toBe("是");
    expect(fieldOf(groups, "has_expected_absence").text).toBe("否");
    const entries = listOf(groups, "resolved_fidelity_profile.entries");
    expect(cellOf(entries, 0, "requested_fidelity").text).toBe("des");
    expect(cellOf(entries, 0, "actual_fidelity").text).toBe("analytical");
    expect(cellOf(entries, 0, "downgraded").text).toBe("是");
    expect(cellOf(entries, 0, "not_covered").text).toBe("否");
    expect(cellOf(entries, 0, "claim_scope_impact").text).toBe("device latency is estimated, not executed");
  });

  it("renders the run summary entry point, host path and tail-attribution flag", () => {
    expect(fieldOf(groups, "summary.preferred_entrypoint").text).toBe("S1");
    expect(fieldOf(groups, "summary.host_path").text).toBe("S7");
    expect(fieldOf(groups, "summary.execution_path").text).toBe("hosted");
    expect(fieldOf(groups, "summary.has_tail_attribution").text).toBe("是");
    expect(fieldOf(groups, "run.completeness").text).toBe("0.5");
  });

  it("states which absence applies when a run sub-field is not reported", () => {
    const sparse = normalizeApiReports({ run: { ...rawRun, next_action: undefined, artifacts: undefined } });
    const sparseGroups = buildRunCoverage(sparse);
    expect(fieldOf(sparseGroups, "run.next_action").availability).toBe("missing");
    expect(fieldOf(sparseGroups, "run.next_action").text).toBeNull();
    expect(fieldOf(sparseGroups, "run.next_action").sourcePaths).toEqual(["/run/next_action"]);
    expect(listOf(sparseGroups, "run.artifacts").emptyNote).toBe(
      "报告未提供该字段；前端不会推算、补造或用其它总量代替。",
    );
  });
});

const rawMetrics = {
  schema_version: "tilesim.metrics_report.v1",
  run_id: runId,
  report_id: "coverage-metrics",
  metric_scope: "s1_runtime_request_level",
  evidence_tier: "synthetic_consistency",
  observation_window: { start_time_ps: 0, end_time_ps: "9007199254740993123" },
  summary: {
    request_count: 4,
    completed_request_count: 3,
    rejected_request_count: 1,
    throughput_requests_per_second: 0,
  },
  tail_latency_summary: {
    ttft_ps: { sample_count: 3, p50_ps: 10, p95_ps: 20, p99_ps: 30, max_ps: 40 },
    tpot_ps: { sample_count: 3, p50_ps: 1, p95_ps: 2, p99_ps: 3, max_ps: 4 },
    end_to_end_latency_ps: { sample_count: 3, p50_ps: 100, p95_ps: 200, p99_ps: 300, max_ps: 400 },
  },
  boundary_notes: ["The observation window is 0; throughput is reported as 0."],
  resource_boundary_evidence: {
    has_evidence: true,
    summary: {
      source_subsystem: "S4",
      trace_kind: "memory",
      evidence_count: 2,
      total_bytes: "9007199254740993123",
      peak_bytes: 128,
      total_estimated_latency_us: 12.5,
      max_estimated_latency_us: 8,
      dominant_evidence_id: "mem-2",
      dominant_operation: "read",
      dominant_profile: "hbm",
    },
  },
  system_summary: {
    has_fabric_timeline: true,
    fabric_record_count: 2,
    fabric_busy_time_ps: 120,
    phase_fabric_contributions: [],
    pd_disaggregation: {
      has_handoff_evidence: true,
      handoff_record_count: 2,
      handoff_busy_time_ps: 60,
      decode_wait_for_handoff_ps: 10,
      decode_wait_after_handoff_ps: 20,
      dominant_handoff_id: "handoff-1",
      dominant_source_placement_group_id: "pg-src",
      dominant_destination_placement_group_id: "pg-dst",
    },
  },
  fidelity_control: {
    requested_tier: "des",
    requested_tier_state: "supported",
    capability_registry_version: "cap-registry-v1",
    capability_registry_entry_count: 6,
    des_required_capability_count: 3,
  },
  des_contract: {
    des_contract_state: "satisfied",
    des_required_subsystem_count: 3,
    des_satisfied_subsystem_count: 3,
    des_contract_gaps: [],
  },
  resolution_control: {
    range_label: "S1->S6",
    has_downgrades: true,
    has_fallbacks: false,
    has_not_covered: true,
    has_expected_absence: false,
    downgrade_count: 1,
    fallback_count: 0,
    not_covered_count: 2,
    expected_absence_count: 0,
    dominant_resolution: "downgraded",
    dominant_subsystem: "S4",
    dominant_detail: "estimated",
    claim_scope_summary: "engineering_execution_consistency_only",
  },
  resolution_entries: [{ subsystem: "S4", requested_fidelity: "des", actual_fidelity: "analytical" }],
  request_metrics: [
    {
      request_id: "req-a",
      status: "completed",
      arrival_time_ps: 0,
      first_token_time_ps: 10,
      completion_time_ps: 20,
      has_first_token_time: true,
      has_ttft_sample: true,
      has_tpot_sample: false,
      has_end_to_end_latency_sample: true,
      decode_step_count: 2,
      batch_issue_count: 1,
    },
  ],
  percentile_subjects: [
    {
      metric_kind: "ttft_ps",
      percentile: 50,
      value_ps: 10,
      selection_rule: "nearest_rank_backend_selected",
      selection_semantics: "single_request",
      selected_request_id: "req-a",
      member_request_ids: ["req-a"],
      subject_refs: [{ kind: "request", id: "req-a" }],
    },
    {
      metric_kind: "ttft_ps",
      percentile: 95,
      value_ps: 20,
      selection_rule: "nearest_rank_backend_selected",
      selection_semantics: "single_request",
      selected_request_id: "req-a",
      member_request_ids: ["req-a"],
      subject_refs: [{ kind: "request", id: "req-a" }],
    },
    {
      metric_kind: "ttft_ps",
      percentile: 99,
      value_ps: 30,
      selection_rule: "nearest_rank_backend_selected",
      selection_semantics: "single_request",
      selected_request_id: "req-a",
      member_request_ids: ["req-a"],
      subject_refs: [{ kind: "request", id: "req-a" }],
    },
  ],
};

describe("C0-2 metrics coverage", () => {
  const bundle = normalizeApiReports({ metrics: rawMetrics });
  const groups = buildMetricsCoverage(bundle);

  it("shows p50, p95, p99 and max for all three distributions", () => {
    for (const prefix of ["ttft_ps", "tpot_ps", "end_to_end_latency_ps"]) {
      for (const key of ["sample_count", "p50_ps", "p95_ps", "p99_ps", "max_ps"]) {
        const field = fieldOf(groups, `${prefix}.${key}`);
        expect(field.text).not.toBeNull();
        expect(field.availability).toBe("available");
      }
    }
    expect(fieldOf(groups, "ttft_ps.p50_ps").text).toContain("10");
    expect(fieldOf(groups, "ttft_ps.max_ps").text).toContain("40");
  });

  it("renders the observation window, boundary notes and rejected request count", () => {
    expect(fieldOf(groups, "observation_window.start_time_ps").text).toContain("0");
    expect(fieldOf(groups, "observation_window.end_time_ps").sourcePaths).toEqual([
      "/metrics/observation_window/end_time_ps",
    ]);
    expect(listOf(groups, "boundary_notes").records[0].cells[0].text).toBe(
      "The observation window is 0; throughput is reported as 0.",
    );
    expect(fieldOf(groups, "summary.rejected_request_count").text).toBe("1");
  });

  it("renders resource boundary evidence without dropping the raw byte integer", () => {
    expect(fieldOf(groups, "resource_boundary_evidence.has_evidence").text).toBe("是");
    expect(fieldOf(groups, "total_bytes").text).toBe("9,007,199,254,740,993,123 B");
    expect(fieldOf(groups, "dominant_operation").text).toBe("read");
  });

  it("renders the PD disaggregation block including decode wait timings", () => {
    expect(fieldOf(groups, "handoff_record_count").text).toBe("2");
    expect(fieldOf(groups, "decode_wait_for_handoff_ps").text).not.toBeNull();
    expect(fieldOf(groups, "decode_wait_after_handoff_ps").text).not.toBeNull();
    expect(fieldOf(groups, "dominant_source_placement_group_id").text).toBe("pg-src");
    expect(fieldOf(groups, "dominant_destination_placement_group_id").text).toBe("pg-dst");
  });

  it("renders metric scope, capability counts and the four resolution flags with counts", () => {
    expect(fieldOf(groups, "metric_scope").text).toBe("s1_runtime_request_level");
    expect(fieldOf(groups, "capability_registry_entry_count").text).toBe("6");
    expect(fieldOf(groups, "des_required_capability_count").text).toBe("3");
    expect(fieldOf(groups, "resolution.has_downgrades").text).toBe("是");
    expect(fieldOf(groups, "resolution.has_fallbacks").text).toBe("否");
    expect(fieldOf(groups, "resolution.has_not_covered").text).toBe("是");
    expect(fieldOf(groups, "resolution.has_expected_absence").text).toBe("否");
    expect(fieldOf(groups, "resolution.downgrade_count").text).toBe("1");
    expect(fieldOf(groups, "resolution.fallback_count").text).toBe("0");
    expect(fieldOf(groups, "resolution.not_covered_count").text).toBe("2");
    expect(fieldOf(groups, "resolution.expected_absence_count").text).toBe("0");
    expect(fieldOf(groups, "resolution.dominant_subsystem").text).toBe("S4");
  });

  it("renders request timing, sample flags and every percentile subject", () => {
    const requests = listOf(groups, "request_metrics");
    expect(cellOf(requests, 0, "arrival_time_ps").text).not.toBeNull();
    expect(cellOf(requests, 0, "first_token_time_ps").text).not.toBeNull();
    expect(cellOf(requests, 0, "completion_time_ps").text).not.toBeNull();
    expect(cellOf(requests, 0, "has_ttft_sample").text).toBe("是");
    expect(cellOf(requests, 0, "has_tpot_sample").text).toBe("否");

    const subjects = listOf(groups, "percentile_subjects");
    expect(subjects.records).toHaveLength(3);
    expect(subjects.records.map((row) => row.cells.find((cell) => cell.key === "percentile")?.text)).toEqual([
      "50",
      "95",
      "99",
    ]);
    expect(cellOf(subjects, 0, "subject_refs").text).toBe("request:req-a");
  });

  it("reports has_fabric_timeline as an explicit boolean fact", () => {
    const withoutTimeline = normalizeApiReports({
      metrics: { ...rawMetrics, system_summary: { ...rawMetrics.system_summary, has_fabric_timeline: false } },
    });
    const field = fieldOf(buildMetricsCoverage(withoutTimeline), "system_summary.has_fabric_timeline");
    expect(field.text).toBe("否");
    expect(field.fact).toBe(true);
  });
});

const rawValidation = {
  schema_version: "tilesim.validation_report.v1",
  run_id: runId,
  report_id: "coverage-validation",
  validation_scope: "S1->S6",
  validation_lane: "synthetic_consistency",
  evidence_tier: "synthetic_consistency",
  claim_scope_summary: "engineering_execution_consistency_only",
  baseline_package_id: "baseline-v3",
  trace_provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
    source_id: "fixture-trace-1",
    generation_path: "tools/generate_fixture.py",
    capture_or_generation_time: "2026-09-17T00:00:00Z",
    upstream_tooling: "tilesim-fixturegen/1",
    trace_kind: "synthetic_consistency",
  },
  des_contract: {
    des_contract_state: "satisfied",
    des_required_subsystem_count: 3,
    des_satisfied_subsystem_count: 3,
    des_contract_gaps: ["S4"],
  },
  resolution_control: {
    has_downgrades: false,
    has_fallbacks: true,
    has_not_covered: false,
    has_expected_absence: false,
    downgrade_count: 0,
    fallback_count: 1,
    not_covered_count: 0,
    expected_absence_count: 0,
    dominant_resolution: "fallback",
    dominant_subsystem: "S4",
    dominant_detail: "single-process reference used",
    claim_scope_summary: "engineering_execution_consistency_only",
  },
  resolution_entries: [{ subsystem: "S4", requested_fidelity: "des", actual_fidelity: "des" }],
  error_budget: [
    {
      metric_id: "ttft_p95",
      subsystem: "S1",
      observed_value: 20,
      expected_value: 21,
      absolute_error: 1,
      tolerance: 2,
      unit: "us",
      status: "within_budget",
    },
  ],
  benchmark_manifests: ["benchmarks/a.json"],
  calibration_inputs: ["calibration/b.json"],
  checks: [
    {
      check_id: "check-1",
      subsystem: "S1",
      status: "pass",
      subject_refs: [{ kind: "request", id: "req-a" }],
      evidence_refs: [
        {
          run_id: runId,
          artifact_id: "metrics",
          schema_identity: "tilesim.metrics_report.v1",
          json_pointer: "/request_metrics/0",
        },
      ],
    },
  ],
  open_gaps: [],
};

describe("C0-3 validation coverage", () => {
  const bundle = normalizeApiReports({ validation: rawValidation });
  const groups = buildValidationCoverage(bundle);

  it("renders the error budget matrix entries", () => {
    const budget = listOf(groups, "error_budget");
    expect(cellOf(budget, 0, "metric_id").text).toBe("ttft_p95");
    expect(cellOf(budget, 0, "observed_value").text).toBe("20");
    expect(cellOf(budget, 0, "tolerance").text).toBe("2");
    expect(cellOf(budget, 0, "unit").text).toBe("us");
    expect(cellOf(budget, 0, "status").text).toBe("within_budget");
  });

  it("renders validation scope, baseline, manifests and calibration inputs", () => {
    expect(fieldOf(groups, "validation_scope").text).toBe("S1->S6");
    expect(fieldOf(groups, "validation_lane").text).toBe("synthetic_consistency");
    expect(fieldOf(groups, "evidence_tier").text).toBe("synthetic_consistency");
    expect(fieldOf(groups, "baseline_package_id").text).toBe("baseline-v3");
    expect(listOf(groups, "benchmark_manifests").records).toHaveLength(1);
    expect(listOf(groups, "calibration_inputs").records).toHaveLength(1);
  });

  it("renders trace provenance detail fields", () => {
    expect(fieldOf(groups, "trace_provenance.source_id").text).toBe("fixture-trace-1");
    expect(fieldOf(groups, "trace_provenance.generation_path").text).toBe("tools/generate_fixture.py");
    expect(fieldOf(groups, "trace_provenance.capture_or_generation_time").text).toBe("2026-09-17T00:00:00Z");
    expect(fieldOf(groups, "trace_provenance.upstream_tooling").text).toBe("tilesim-fixturegen/1");
    expect(fieldOf(groups, "trace_provenance.trace_kind").text).toBe("synthetic_consistency");
  });

  it("renders DES contract aggregates and the resolution dominant fields", () => {
    expect(fieldOf(groups, "des_contract.des_contract_state").text).toBe("satisfied");
    expect(fieldOf(groups, "des_contract.des_required_subsystem_count").text).toBe("3");
    expect(fieldOf(groups, "resolution.has_fallbacks").text).toBe("是");
    expect(fieldOf(groups, "resolution.has_downgrades").text).toBe("否");
    expect(fieldOf(groups, "resolution.fallback_count").text).toBe("1");
    expect(fieldOf(groups, "resolution.dominant_resolution").text).toBe("fallback");
    expect(fieldOf(groups, "resolution.dominant_detail").text).toBe("single-process reference used");
    expect(listOf(groups, "des_contract.des_contract_gaps").records).toHaveLength(1);
  });

  it("renders check references as navigable kind:id citations", () => {
    const checks = listOf(groups, "checks");
    expect(cellOf(checks, 0, "subject_refs").text).toBe("request:req-a");
    // Artifact-pointer refs reuse the ArtifactEvidenceLink source convention
    // (`artifact_id:json_pointer`) instead of degrading to `[object Object]`.
    expect(cellOf(checks, 0, "evidence_refs").text).toBe("metrics:/request_metrics/0");
  });

  it("marks resolution entry references as missing when the backend omits them", () => {
    const entries = listOf(groups, "resolution_entries");
    expect(cellOf(entries, 0, "subject_refs").availability).toBe("missing");
    expect(cellOf(entries, 0, "evidence_refs").text).toBeNull();
  });
});

const rawTail = {
  schema_version: "tilesim.tail_cause_chain_report.v1",
  run_id: runId,
  report_id: "coverage-tail",
  symptom: "p99 end-to-end latency exceeded the SLO",
  explained_entity: { kind: "request", id: "req-a" },
  observation_window: { start_time_ps: 5, end_time_ps: 25 },
  cause_chain: [{ cause_id: "cause-1", subsystem: "S6", cause_code: "fabric_congestion" }],
  contributing_factors: [
    { subsystem: "S6", factor_code: "congestion_delay", detail: "fabric congestion", score: 0.7 },
    { subsystem: "S4", factor_code: "device_queue", detail: "device queue wait", score: 0.3 },
  ],
  attribution_ranking: [{ rank: 1, subsystem: "S6", component_code: "fabric", share: 0.7, score_ps: 100 }],
  validation_links: ["validation:/checks/0"],
  metric_evidence_links: ["metrics:/request_metrics/0"],
  resource_evidence_links: ["metrics:/system_summary/fabric_domain_utilization/0"],
  unresolved_gaps: ["S5 collective evidence not bound"],
};

describe("C0-4 tail coverage", () => {
  const bundle = normalizeApiReports({ tail: rawTail });
  const groups = buildTailCoverage(bundle);

  it("renders the symptom, explained entity kind and the observation window", () => {
    expect(fieldOf(groups, "symptom").text).toBe("p99 end-to-end latency exceeded the SLO");
    expect(fieldOf(groups, "explained_entity.kind").text).toBe("request");
    expect(fieldOf(groups, "observation_window.start_time_ps").text).not.toBeNull();
    expect(fieldOf(groups, "observation_window.end_time_ps").text).not.toBeNull();
  });

  it("keeps contributing factors as their own list, separate from the attribution ranking", () => {
    const factors = listOf(groups, "contributing_factors");
    expect(factors.records).toHaveLength(2);
    expect(cellOf(factors, 0, "factor_code").text).toBe("congestion_delay");
    expect(cellOf(factors, 0, "score").text).toBe("0.7");
    expect(groups.flatMap((group) => group.lists.map((list) => list.key))).not.toContain("attribution_ranking");
  });

  it("renders the three evidence link lists and the unresolved gaps", () => {
    expect(listOf(groups, "validation_links").records[0].cells[0].text).toBe("validation:/checks/0");
    expect(listOf(groups, "metric_evidence_links").records).toHaveLength(1);
    expect(listOf(groups, "resource_evidence_links").records).toHaveLength(1);
    expect(listOf(groups, "unresolved_gaps").records).toHaveLength(1);
  });
});

const rawEnvelope = {
  schema_version: "tilesim.s7_execution_envelope.v1",
  run_id: runId,
  envelope_id: "envelope-1",
  trace_name: "trace-coverage",
  host_path: "S7",
  range_label: "S1->S6",
  start_time_ps: 0,
  end_time_ps: 100,
  runtime_event_count: 0,
  fabric_record_count: 0,
  has_runtime_event_trace: false,
  has_tail_cause_chain_report: true,
  trace_provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
    source_id: "fixture-trace-1",
    trace_kind: "synthetic_consistency",
  },
  stages: [
    {
      stage_id: "stage-1",
      subsystem: "S1",
      stage_kind: "ingress",
      subject_refs: [{ kind: "request", id: "req-a" }],
      evidence_refs: [],
    },
  ],
  evidence_refs: [],
  notes: ["runtime event trace was not captured for this boundary"],
};

describe("C0-5 execution envelope coverage", () => {
  const bundle = normalizeApiReports({ execution_envelope: rawEnvelope });
  const groups = buildEnvelopeCoverage(bundle);

  it("renders envelope identity and time boundaries", () => {
    expect(fieldOf(groups, "envelope_id").text).toBe("envelope-1");
    expect(fieldOf(groups, "trace_name").text).toBe("trace-coverage");
    expect(fieldOf(groups, "start_time_ps").text).not.toBeNull();
    expect(fieldOf(groups, "end_time_ps").text).not.toBeNull();
  });

  it("renders the capture booleans as plain facts, never as 'captured'", () => {
    const runtimeTrace = fieldOf(groups, "has_runtime_event_trace");
    expect(runtimeTrace.text).toBe("否");
    expect(runtimeTrace.fact).toBe(true);
    const tailReport = fieldOf(groups, "has_tail_cause_chain_report");
    expect(tailReport.text).toBe("是");
  });

  it("renders the envelope notes and stage references", () => {
    expect(listOf(groups, "notes").records).toHaveLength(1);
    const stages = listOf(groups, "stages");
    expect(cellOf(stages, 0, "stage_id").text).toBe("stage-1");
    expect(cellOf(stages, 0, "subject_refs").text).toBe("request:req-a");
    expect(cellOf(stages, 0, "evidence_refs").text).toBe("（空列表）");
  });
});

const rawDes = {
  schema_version: "tilesim.s7_run_bound_des_evidence.v1",
  run_id: runId,
  requested_fidelity: "des",
  resolved_fidelity: "des",
  execution_mode: "partitioned_des",
  fallback: { policy: "single_process_reference", used: false, reason: "" },
  provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
    trace_kind: "synthetic_consistency",
  },
  state_summary: {
    schema_version: "tilesim.simulation.partitioned_des_state_summary.v1",
    logical_time_ps: "9007199254740993123",
    partition_count: 2,
    synchronization_window_count: 2,
    committed_event_count: "9007199254740993000",
    pending_event_count: 0,
    committed_event_digest: "committed-digest",
    validation_lane: "partitioned_vs_single_process_differential",
    claim_scope: "engineering_execution_consistency_only",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "synthetic_consistency",
    },
    stream_record_count: 2,
    total_stream_record_count: 2,
    stream_records_truncated: false,
  },
  differential: {
    compared: true,
    matched: true,
    partitioned_digest: "partitioned-digest",
    reference_digest: "reference-digest",
    mismatch_code: "",
  },
  stream: {
    record_count: 2,
    total_record_count: 2,
    truncated: false,
    records: [
      {
        window_start_ps: 0,
        window_end_ps: 10,
        partition_id: "partition-0",
        committed_event_count: 3,
        committed_event_digest: "digest-0",
      },
      { window_start_ps: 10, window_end_ps: 20, partition_id: "partition-1" },
    ],
  },
  checkpoint: {
    archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1",
    archive_digest: "archive-digest",
    partition_configuration_digest: "partition-config-digest",
    checkpoint_logical_time_ps: "9007199254740993123",
    committed_event_count: "9007199254740993000",
    pending_event_count: 0,
    completed_identity_count: 1,
    subject_version_count: 1,
    payload_availability: "not_exposed",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "synthetic_consistency",
    },
  },
};

describe("C0-6 run-bound DES evidence coverage", () => {
  const bundle = normalizeApiReports({ run_bound_des_evidence: rawDes });
  const summary = buildWeek8ExecutionSummary(runId, bundle, null);

  it("renders every state_summary field, not just the checkpoint counters", () => {
    expect(summary.stateSummary?.synchronizationWindowCount).toBe(2);
    expect(summary.stateSummary?.committedEventDigest).toBe("committed-digest");
    expect(summary.stateSummary?.validationLane).toBe("partitioned_vs_single_process_differential");
    expect(summary.stateSummary?.claimScope).toBe("engineering_execution_consistency_only");
    // `stream_record_count` sits on the backend lossless descriptor path, so it stays a
    // lossless integer rather than being narrowed to a JS number.
    expect(losslessIntegerToBigInt(summary.stateSummary!.streamRecordCount!)).toBe(BigInt(2));
    expect(losslessIntegerToBigInt(summary.stateSummary!.totalStreamRecordCount!)).toBe(BigInt(2));
    expect(summary.stateSummary?.streamRecordsTruncated).toBe(false);
  });

  it("exposes per-window stream records with lossless window boundaries", () => {
    expect(summary.streamRecords).toHaveLength(2);
    expect(summary.streamRecords[0].partitionId).toBe("partition-0");
    expect(summary.streamRecords[0].committedEventCount).toBe(3);
    expect(summary.streamRecords[0].committedEventDigest).toBe("digest-0");
    expect(summary.streamRecords[0].sourcePath).toBe("week8-run-evidence:/stream/records/0");
    expect(summary.streamRecords[1].sourcePath).toBe("week8-run-evidence:/stream/records/1");
  });

  it("marks an omitted per-window field as absent instead of fabricating a zero", () => {
    expect(summary.streamRecords[1].committedEventCount).toBeNull();
    expect(summary.streamRecords[1].committedEventDigest).toBeNull();
  });

  it("renders the full provenance instead of only the source mode", () => {
    expect(summary.provenance?.calibrationLevel).toBe("uncalibrated");
    expect(summary.provenance?.allowedClaimScope).toBe("synthetic_consistency");
    expect(summary.provenance?.traceKind).toBe("synthetic_consistency");
  });
});
