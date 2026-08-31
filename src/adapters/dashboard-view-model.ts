import type { Availability, LosslessInteger, ReportBundle, ReportKind, SourcedValue } from "../contracts/report-model";

function unavailable(bundle: ReportBundle, reportKind: ReportKind, subsystems: string[]): Availability {
  const compatibility = bundle.compatibility[reportKind];
  if (compatibility && !compatibility.supported) return "unsupported_schema";
  const entries = bundle.validation?.resolution_entries || bundle.metrics?.resolution_entries || [];
  const relevant = entries.filter((entry) => subsystems.includes(entry.subsystem));
  if (relevant.some((entry) => entry.not_covered || entry.resolution === "not_covered")) return "not_covered";
  if (relevant.some((entry) => entry.expected_absence || entry.resolution === "expected_absence")) {
    return "expected_absence";
  }
  return "missing";
}

function sourced<T>(
  bundle: ReportBundle,
  value: T | null | undefined,
  sourcePaths: string[],
  reportKind: ReportKind,
  subsystems: string[] = [],
  derivation: SourcedValue<T>["derivation"] = "identity",
): SourcedValue<T> {
  return {
    value: value ?? null,
    sourcePaths,
    derivation,
    availability: value === undefined || value === null ? unavailable(bundle, reportKind, subsystems) : "available",
  };
}

export interface DashboardViewModel {
  overview: {
    status: SourcedValue<string>;
    claimSummary: SourcedValue<string>;
    endToEndLatencyUs: SourcedValue<number>;
    runtimeEventCount: SourcedValue<number>;
    fabricRecordCount: SourcedValue<number>;
    validationCompleteness: SourcedValue<number>;
    throughputRequestsPerSecond: SourcedValue<number>;
    requestCount: SourcedValue<number>;
    completedRequestCount: SourcedValue<number>;
    rangeLabel: SourcedValue<string>;
    hostPath: SourcedValue<string>;
    executionPath: SourcedValue<string>;
    hasTailAttribution: SourcedValue<boolean>;
  };
  metrics: {
    throughputRequestsPerSecond: SourcedValue<number>;
    requestCount: SourcedValue<number>;
    completedRequestCount: SourcedValue<number>;
    ttftP95Ps: SourcedValue<LosslessInteger>;
    ttftP99Ps: SourcedValue<LosslessInteger>;
    tpotP95Ps: SourcedValue<LosslessInteger>;
    tpotP99Ps: SourcedValue<LosslessInteger>;
    endToEndP95Ps: SourcedValue<LosslessInteger>;
    endToEndP99Ps: SourcedValue<LosslessInteger>;
  };
}

export function buildDashboardViewModel(bundle: ReportBundle): DashboardViewModel {
  const run = bundle.run;
  const metrics = bundle.metrics;
  const summary = metrics?.summary;
  const tail = metrics?.tail_latency_summary;
  return {
    overview: {
      status: sourced(bundle, run?.status, ["/run/status"], "run"),
      claimSummary: sourced(
        bundle,
        metrics?.claim_scope_summary ?? run?.cause,
        ["/metrics/claim_scope_summary", "/run/cause"],
        metrics?.claim_scope_summary === undefined ? "run" : "metrics",
        [],
        metrics?.claim_scope_summary === undefined ? "fallback" : "identity",
      ),
      endToEndLatencyUs: sourced(
        bundle,
        run?.summary.end_to_end_latency_us,
        ["/run/summary/end_to_end_latency_us"],
        "run",
        ["S1"],
      ),
      runtimeEventCount: sourced(
        bundle,
        run?.summary.runtime_event_count,
        ["/run/summary/runtime_event_count"],
        "run",
        ["S1"],
      ),
      fabricRecordCount: sourced(
        bundle,
        run?.summary.fabric_record_count,
        ["/run/summary/fabric_record_count"],
        "run",
        ["S6"],
      ),
      validationCompleteness: sourced(
        bundle,
        run?.summary.validation_completeness,
        ["/run/summary/validation_completeness"],
        "run",
      ),
      throughputRequestsPerSecond: sourced(
        bundle,
        summary?.throughput_requests_per_second,
        ["/metrics/summary/throughput_requests_per_second"],
        "metrics",
        ["S1"],
      ),
      requestCount: sourced(bundle, summary?.request_count, ["/metrics/summary/request_count"], "metrics", ["S1"]),
      completedRequestCount: sourced(
        bundle,
        summary?.completed_request_count,
        ["/metrics/summary/completed_request_count"],
        "metrics",
        ["S1"],
      ),
      rangeLabel: sourced(bundle, run?.summary.range_label, ["/run/summary/range_label"], "run"),
      hostPath: sourced(bundle, run?.summary.host_path, ["/run/summary/host_path"], "run"),
      executionPath: sourced(bundle, run?.summary.execution_path, ["/run/summary/execution_path"], "run"),
      hasTailAttribution: sourced(
        bundle,
        run?.summary.has_tail_attribution,
        ["/run/summary/has_tail_attribution"],
        "run",
      ),
    },
    metrics: {
      throughputRequestsPerSecond: sourced(
        bundle,
        summary?.throughput_requests_per_second,
        ["/metrics/summary/throughput_requests_per_second"],
        "metrics",
        ["S1"],
      ),
      requestCount: sourced(bundle, summary?.request_count, ["/metrics/summary/request_count"], "metrics", ["S1"]),
      completedRequestCount: sourced(
        bundle,
        summary?.completed_request_count,
        ["/metrics/summary/completed_request_count"],
        "metrics",
        ["S1"],
      ),
      ttftP95Ps: sourced(bundle, tail?.ttft_ps?.p95_ps, ["/metrics/tail_latency_summary/ttft_ps/p95_ps"], "metrics", [
        "S1",
      ]),
      ttftP99Ps: sourced(bundle, tail?.ttft_ps?.p99_ps, ["/metrics/tail_latency_summary/ttft_ps/p99_ps"], "metrics", [
        "S1",
      ]),
      tpotP95Ps: sourced(bundle, tail?.tpot_ps?.p95_ps, ["/metrics/tail_latency_summary/tpot_ps/p95_ps"], "metrics", [
        "S1",
      ]),
      tpotP99Ps: sourced(bundle, tail?.tpot_ps?.p99_ps, ["/metrics/tail_latency_summary/tpot_ps/p99_ps"], "metrics", [
        "S1",
      ]),
      endToEndP95Ps: sourced(
        bundle,
        tail?.end_to_end_latency_ps?.p95_ps,
        ["/metrics/tail_latency_summary/end_to_end_latency_ps/p95_ps"],
        "metrics",
        ["S1"],
      ),
      endToEndP99Ps: sourced(
        bundle,
        tail?.end_to_end_latency_ps?.p99_ps,
        ["/metrics/tail_latency_summary/end_to_end_latency_ps/p99_ps"],
        "metrics",
        ["S1"],
      ),
    },
  };
}
