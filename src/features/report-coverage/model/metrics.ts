import type { MetricDistributionSummary, ReportBundle } from "../../../contracts/report-model";
import type { CoverageField, CoverageGroup } from "../types";
import {
  buildList,
  bool,
  bytes,
  cell,
  count,
  field,
  group,
  listText,
  microseconds,
  picoseconds,
  ratio,
  record,
  referenceText,
  stringList,
  withUnit,
  type Scope,
} from "./shared";

function distributionFields(
  scope: Scope,
  prefix: string,
  basePath: string,
  summary: MetricDistributionSummary | undefined,
): CoverageField[] {
  return [
    field(scope, `${prefix}.sample_count`, summary?.sample_count, `${basePath}/sample_count`, count, { mono: true }),
    field(scope, `${prefix}.p50_ps`, summary?.p50_ps, `${basePath}/p50_ps`, picoseconds, { mono: true }),
    field(scope, `${prefix}.p95_ps`, summary?.p95_ps, `${basePath}/p95_ps`, picoseconds, { mono: true }),
    field(scope, `${prefix}.p99_ps`, summary?.p99_ps, `${basePath}/p99_ps`, picoseconds, { mono: true }),
    field(scope, `${prefix}.max_ps`, summary?.max_ps, `${basePath}/max_ps`, picoseconds, { mono: true }),
  ];
}

export function buildMetricsCoverage(bundle: ReportBundle): CoverageGroup[] {
  const metrics = bundle.metrics;
  if (!metrics) return [];
  const scope: Scope = { bundle, kind: "metrics", subsystems: ["S1"] };
  const fabricScope: Scope = { bundle, kind: "metrics", subsystems: ["S6"] };
  const tail = metrics.tail_latency_summary;
  const system = metrics.system_summary;
  const pd = system?.pd_disaggregation;
  const boundary = metrics.resource_boundary_evidence;
  const boundarySummary = boundary?.summary;
  const control = metrics.resolution_control;
  const fidelityControl = metrics.fidelity_control;
  const desContract = metrics.des_contract;

  const distributionFieldsList = [
    ...distributionFields(scope, "ttft_ps", "/metrics/tail_latency_summary/ttft_ps", tail?.ttft_ps),
    ...distributionFields(scope, "tpot_ps", "/metrics/tail_latency_summary/tpot_ps", tail?.tpot_ps),
    ...distributionFields(
      scope,
      "end_to_end_latency_ps",
      "/metrics/tail_latency_summary/end_to_end_latency_ps",
      tail?.end_to_end_latency_ps,
    ),
  ];

  const observationFields = [
    field(
      scope,
      "observation_window.start_time_ps",
      metrics.observation_window?.start_time_ps,
      "/metrics/observation_window/start_time_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      scope,
      "observation_window.end_time_ps",
      metrics.observation_window?.end_time_ps,
      "/metrics/observation_window/end_time_ps",
      picoseconds,
      { mono: true },
    ),
  ];

  const boundaryFields = [
    field(
      scope,
      "resource_boundary_evidence.has_evidence",
      boundary?.has_evidence,
      "/metrics/resource_boundary_evidence/has_evidence",
      bool,
      {
        fact: true,
      },
    ),
    field(
      scope,
      "source_subsystem",
      boundarySummary?.source_subsystem,
      "/metrics/resource_boundary_evidence/summary/source_subsystem",
    ),
    field(scope, "trace_kind", boundarySummary?.trace_kind, "/metrics/resource_boundary_evidence/summary/trace_kind"),
    field(
      scope,
      "evidence_count",
      boundarySummary?.evidence_count,
      "/metrics/resource_boundary_evidence/summary/evidence_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "total_bytes",
      boundarySummary?.total_bytes,
      "/metrics/resource_boundary_evidence/summary/total_bytes",
      bytes,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "peak_bytes",
      boundarySummary?.peak_bytes,
      "/metrics/resource_boundary_evidence/summary/peak_bytes",
      bytes,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "total_estimated_latency_us",
      boundarySummary?.total_estimated_latency_us,
      "/metrics/resource_boundary_evidence/summary/total_estimated_latency_us",
      microseconds,
    ),
    field(
      scope,
      "max_estimated_latency_us",
      boundarySummary?.max_estimated_latency_us,
      "/metrics/resource_boundary_evidence/summary/max_estimated_latency_us",
      microseconds,
    ),
    field(
      scope,
      "dominant_evidence_id",
      boundarySummary?.dominant_evidence_id,
      "/metrics/resource_boundary_evidence/summary/dominant_evidence_id",
    ),
    field(
      scope,
      "dominant_operation",
      boundarySummary?.dominant_operation,
      "/metrics/resource_boundary_evidence/summary/dominant_operation",
    ),
    field(
      scope,
      "dominant_profile",
      boundarySummary?.dominant_profile,
      "/metrics/resource_boundary_evidence/summary/dominant_profile",
    ),
  ];

  const pdFields = [
    field(
      fabricScope,
      "has_handoff_evidence",
      pd?.has_handoff_evidence,
      "/metrics/system_summary/pd_disaggregation/has_handoff_evidence",
      bool,
      {
        fact: true,
      },
    ),
    field(
      fabricScope,
      "handoff_record_count",
      pd?.handoff_record_count,
      "/metrics/system_summary/pd_disaggregation/handoff_record_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      fabricScope,
      "handoff_busy_time_ps",
      pd?.handoff_busy_time_ps,
      "/metrics/system_summary/pd_disaggregation/handoff_busy_time_ps",
      picoseconds,
      {
        mono: true,
      },
    ),
    field(
      fabricScope,
      "handoff_latency_us",
      pd?.handoff_latency_us,
      "/metrics/system_summary/pd_disaggregation/handoff_latency_us",
      microseconds,
    ),
    field(
      fabricScope,
      "handoff_queue_delay_us",
      pd?.handoff_queue_delay_us,
      "/metrics/system_summary/pd_disaggregation/handoff_queue_delay_us",
      microseconds,
    ),
    field(
      fabricScope,
      "handoff_congestion_delay_us",
      pd?.handoff_congestion_delay_us,
      "/metrics/system_summary/pd_disaggregation/handoff_congestion_delay_us",
      microseconds,
    ),
    field(
      fabricScope,
      "handoff_runtime_us",
      pd?.handoff_runtime_us,
      "/metrics/system_summary/pd_disaggregation/handoff_runtime_us",
      microseconds,
    ),
    field(
      fabricScope,
      "handoff_ready_event_count",
      pd?.handoff_ready_event_count,
      "/metrics/system_summary/pd_disaggregation/handoff_ready_event_count",
      count,
      { mono: true },
    ),
    field(
      fabricScope,
      "decode_wait_for_handoff_ps",
      pd?.decode_wait_for_handoff_ps,
      "/metrics/system_summary/pd_disaggregation/decode_wait_for_handoff_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      fabricScope,
      "decode_wait_after_handoff_ps",
      pd?.decode_wait_after_handoff_ps,
      "/metrics/system_summary/pd_disaggregation/decode_wait_after_handoff_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      fabricScope,
      "max_decode_wait_for_handoff_ps",
      pd?.max_decode_wait_for_handoff_ps,
      "/metrics/system_summary/pd_disaggregation/max_decode_wait_for_handoff_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      fabricScope,
      "max_decode_wait_after_handoff_ps",
      pd?.max_decode_wait_after_handoff_ps,
      "/metrics/system_summary/pd_disaggregation/max_decode_wait_after_handoff_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      fabricScope,
      "dominant_runtime_handoff_request_id",
      pd?.dominant_runtime_handoff_request_id,
      "/metrics/system_summary/pd_disaggregation/dominant_runtime_handoff_request_id",
    ),
    field(
      fabricScope,
      "dominant_runtime_handoff_id",
      pd?.dominant_runtime_handoff_id,
      "/metrics/system_summary/pd_disaggregation/dominant_runtime_handoff_id",
    ),
    field(
      fabricScope,
      "dominant_handoff_request_id",
      pd?.dominant_handoff_request_id,
      "/metrics/system_summary/pd_disaggregation/dominant_handoff_request_id",
    ),
    field(
      fabricScope,
      "dominant_handoff_phase_id",
      pd?.dominant_handoff_phase_id,
      "/metrics/system_summary/pd_disaggregation/dominant_handoff_phase_id",
    ),
    field(
      fabricScope,
      "dominant_handoff_domain_id",
      pd?.dominant_handoff_domain_id,
      "/metrics/system_summary/pd_disaggregation/dominant_handoff_domain_id",
    ),
    field(
      fabricScope,
      "dominant_handoff_id",
      pd?.dominant_handoff_id,
      "/metrics/system_summary/pd_disaggregation/dominant_handoff_id",
    ),
    field(
      fabricScope,
      "dominant_source_placement_group_id",
      pd?.dominant_source_placement_group_id,
      "/metrics/system_summary/pd_disaggregation/dominant_source_placement_group_id",
    ),
    field(
      fabricScope,
      "dominant_destination_placement_group_id",
      pd?.dominant_destination_placement_group_id,
      "/metrics/system_summary/pd_disaggregation/dominant_destination_placement_group_id",
    ),
  ];

  const requestBoundaryFields = [
    field(
      scope,
      "summary.rejected_request_count",
      metrics.summary?.rejected_request_count,
      "/metrics/summary/rejected_request_count",
      count,
      {
        mono: true,
      },
    ),
    field(scope, "metric_scope", metrics.metric_scope, "/metrics/metric_scope"),
    field(
      scope,
      "fidelity_control.capability_registry_version",
      fidelityControl?.capability_registry_version,
      "/metrics/fidelity_control/capability_registry_version",
    ),
    field(
      scope,
      "capability_registry_entry_count",
      fidelityControl?.capability_registry_entry_count,
      "/metrics/fidelity_control/capability_registry_entry_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "des_required_capability_count",
      fidelityControl?.des_required_capability_count,
      "/metrics/fidelity_control/des_required_capability_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "fidelity_control.requested_tier",
      fidelityControl?.requested_tier,
      "/metrics/fidelity_control/requested_tier",
    ),
    field(
      scope,
      "requested_tier_state",
      fidelityControl?.requested_tier_state,
      "/metrics/fidelity_control/requested_tier_state",
    ),
    field(
      scope,
      "unsupported_reason",
      fidelityControl?.unsupported_reason,
      "/metrics/fidelity_control/unsupported_reason",
    ),
  ];

  const resolutionFields = [
    field(scope, "resolution_control.range_label", control?.range_label, "/metrics/resolution_control/range_label"),
    field(
      scope,
      "resolution.has_downgrades",
      control?.has_downgrades,
      "/metrics/resolution_control/has_downgrades",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "resolution.has_fallbacks",
      control?.has_fallbacks,
      "/metrics/resolution_control/has_fallbacks",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "resolution.has_not_covered",
      control?.has_not_covered,
      "/metrics/resolution_control/has_not_covered",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "resolution.has_expected_absence",
      control?.has_expected_absence,
      "/metrics/resolution_control/has_expected_absence",
      bool,
      {
        fact: true,
      },
    ),
    field(
      scope,
      "resolution.downgrade_count",
      control?.downgrade_count,
      "/metrics/resolution_control/downgrade_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "resolution.fallback_count",
      control?.fallback_count,
      "/metrics/resolution_control/fallback_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "resolution.not_covered_count",
      control?.not_covered_count,
      "/metrics/resolution_control/not_covered_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "resolution.expected_absence_count",
      control?.expected_absence_count,
      "/metrics/resolution_control/expected_absence_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "resolution.dominant_resolution",
      control?.dominant_resolution,
      "/metrics/resolution_control/dominant_resolution",
    ),
    field(
      scope,
      "resolution.dominant_subsystem",
      control?.dominant_subsystem,
      "/metrics/resolution_control/dominant_subsystem",
    ),
    field(scope, "resolution.dominant_detail", control?.dominant_detail, "/metrics/resolution_control/dominant_detail"),
    field(
      scope,
      "resolution.claim_scope_summary",
      control?.claim_scope_summary,
      "/metrics/resolution_control/claim_scope_summary",
    ),
    field(
      scope,
      "des_contract.des_contract_state",
      desContract?.des_contract_state,
      "/metrics/des_contract/des_contract_state",
    ),
    field(
      scope,
      "des_contract.des_required_subsystem_count",
      desContract?.des_required_subsystem_count,
      "/metrics/des_contract/des_required_subsystem_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "des_contract.des_satisfied_subsystem_count",
      desContract?.des_satisfied_subsystem_count,
      "/metrics/des_contract/des_satisfied_subsystem_count",
      count,
      { mono: true },
    ),
  ];

  const fabricFields = [
    field(
      fabricScope,
      "system_summary.has_fabric_timeline",
      system?.has_fabric_timeline,
      "/metrics/system_summary/has_fabric_timeline",
      bool,
      {
        fact: true,
      },
    ),
    field(
      fabricScope,
      "system_summary.fabric_busy_time_ps",
      system?.fabric_busy_time_ps,
      "/metrics/system_summary/fabric_busy_time_ps",
      picoseconds,
      {
        mono: true,
      },
    ),
    field(
      fabricScope,
      "system_summary.fabric_observation_window_ps",
      system?.fabric_observation_window_ps,
      "/metrics/system_summary/fabric_observation_window_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      fabricScope,
      "system_summary.fabric_utilization_ratio",
      system?.fabric_utilization_ratio,
      "/metrics/system_summary/fabric_utilization_ratio",
      ratio,
    ),
    field(
      fabricScope,
      "system_summary.has_fabric_backpressure_signal",
      system?.has_fabric_backpressure_signal,
      "/metrics/system_summary/has_fabric_backpressure_signal",
      bool,
      { fact: true },
    ),
    field(
      fabricScope,
      "system_summary.fabric_backpressure_event_count",
      system?.fabric_backpressure_event_count,
      "/metrics/system_summary/fabric_backpressure_event_count",
      count,
      { mono: true },
    ),
    field(
      fabricScope,
      "system_summary.max_fabric_backpressure_delay_us",
      system?.max_fabric_backpressure_delay_us,
      "/metrics/system_summary/max_fabric_backpressure_delay_us",
      microseconds,
    ),
    field(
      fabricScope,
      "system_summary.dominant_fabric_backpressure_domain_id",
      system?.dominant_fabric_backpressure_domain_id,
      "/metrics/system_summary/dominant_fabric_backpressure_domain_id",
    ),
    field(
      fabricScope,
      "system_summary.dominant_fabric_backpressure_kind",
      system?.dominant_fabric_backpressure_kind,
      "/metrics/system_summary/dominant_fabric_backpressure_kind",
    ),
  ];

  return [
    group(
      "metric-distributions",
      "分布摘要（sample_count / p50 / p95 / p99 / max）",
      distributionFieldsList,
      [],
      "三个分布摘要各自独立展示 p50、p95、p99 与 max；不把某一分位数当作整体结论。",
    ),
    group(
      "metric-observation-window",
      "观测窗口",
      observationFields,
      [],
      "观测窗口为 0 表示该边界没有产生可观测样本；后端会另行写出 boundary_notes。",
    ),
    group(
      "metric-boundary-notes",
      "后端边界说明",
      [],
      [
        stringList(scope, "boundary_notes", metrics.boundary_notes, "metrics:/boundary_notes", {
          description: "后端明确写下的边界说明（例如「观测窗口为 0，吞吐按 0 报告」）；原样显示，不改写。",
        }),
      ],
    ),
    group(
      "metric-resource-boundary-evidence",
      "资源边界证据",
      boundaryFields,
      [],
      "has_evidence 为 false 时下列明细按缺失标记；前端不会用请求数或总量推算。",
    ),
    group(
      "metric-pd-disaggregation",
      "PD 分离（prefill / decode）",
      pdFields,
      [],
      "PD 分离字段来自 system_summary.pd_disaggregation；延迟与等待时间按后端字段分开显示，不相加解释。",
    ),
    group(
      "metric-request-boundary",
      "请求边界与能力计数",
      requestBoundaryFields,
      [],
      "计数与版本号来自后端；unsupported_reason 为空字符串表示后端未给出原因，不等于缺失。",
    ),
    group(
      "metric-resolution-control",
      "精度解析聚合与 DES 契约",
      resolutionFields,
      [],
      "四个 has_* 与四个计数分别对应 downgrade / fallback / not_covered / expected_absence，互不合并。",
    ),
    group(
      "metric-des-contract-gaps",
      "指标侧 DES 契约缺口",
      [],
      [
        stringList(
          scope,
          "des_contract.des_contract_gaps",
          desContract?.des_contract_gaps,
          "metrics:/des_contract/des_contract_gaps",
        ),
      ],
    ),
    group(
      "metric-resolution-entries",
      "指标侧逐环节精度解析",
      [],
      [
        buildList(
          scope,
          "resolution_entries",
          "resolution_entries",
          metrics.resolution_entries,
          "metrics:/resolution_entries",
          [
            { key: "subsystem", label: "subsystem" },
            { key: "requested_fidelity", label: "requested_fidelity" },
            { key: "actual_fidelity", label: "actual_fidelity" },
            { key: "resolution", label: "resolution" },
            { key: "state", label: "state" },
            { key: "downgraded", label: "downgraded" },
            { key: "fallback", label: "fallback" },
            { key: "not_covered", label: "not_covered" },
            { key: "expected_absence", label: "expected_absence" },
            { key: "claim_scope_impact", label: "claim_scope_impact" },
            { key: "detail", label: "detail" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.subsystem ?? index)}`,
              cells: [
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "requested_fidelity", entry.requested_fidelity),
                cell(scope, "actual_fidelity", entry.actual_fidelity),
                cell(scope, "resolution", entry.resolution),
                cell(scope, "state", entry.state),
                cell(scope, "downgraded", entry.downgraded, bool),
                cell(scope, "fallback", entry.fallback, bool),
                cell(scope, "not_covered", entry.not_covered, bool),
                cell(scope, "expected_absence", entry.expected_absence, bool),
                cell(scope, "claim_scope_impact", entry.claim_scope_impact),
                cell(scope, "detail", entry.detail),
              ],
            };
          },
        ),
      ],
    ),
    group(
      "metric-request-metrics",
      "逐请求时间与样本标志",
      [],
      [
        buildList(
          scope,
          "request_metrics",
          "request_metrics",
          metrics.request_metrics,
          "metrics:/request_metrics",
          [
            { key: "request_id", label: "request_id", mono: true },
            { key: "status", label: "status" },
            { key: "arrival_time_ps", label: "arrival_time_ps", numeric: true },
            { key: "first_token_time_ps", label: "first_token_time_ps", numeric: true },
            { key: "completion_time_ps", label: "completion_time_ps", numeric: true },
            { key: "ttft_ps", label: "ttft_ps", numeric: true },
            { key: "tpot_ps", label: "tpot_ps", numeric: true },
            { key: "end_to_end_latency_ps", label: "end_to_end_latency_ps", numeric: true },
            { key: "has_first_token_time", label: "has_first_token_time" },
            { key: "has_ttft_sample", label: "has_ttft_sample" },
            { key: "has_tpot_sample", label: "has_tpot_sample" },
            { key: "has_end_to_end_latency_sample", label: "has_end_to_end_latency_sample" },
            { key: "decode_step_count", label: "decode_step_count", numeric: true },
            { key: "batch_issue_count", label: "batch_issue_count", numeric: true },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.request_id ?? index)}`,
              cells: [
                cell(scope, "request_id", entry.request_id, undefined, { mono: true }),
                cell(scope, "status", entry.status),
                cell(scope, "arrival_time_ps", entry.arrival_time_ps, picoseconds, { numeric: true }),
                cell(scope, "first_token_time_ps", entry.first_token_time_ps, picoseconds, { numeric: true }),
                cell(scope, "completion_time_ps", entry.completion_time_ps, picoseconds, { numeric: true }),
                cell(scope, "ttft_ps", entry.ttft_ps, picoseconds, { numeric: true }),
                cell(scope, "tpot_ps", entry.tpot_ps, picoseconds, { numeric: true }),
                cell(scope, "end_to_end_latency_ps", entry.end_to_end_latency_ps, picoseconds, { numeric: true }),
                cell(scope, "has_first_token_time", entry.has_first_token_time, bool),
                cell(scope, "has_ttft_sample", entry.has_ttft_sample, bool),
                cell(scope, "has_tpot_sample", entry.has_tpot_sample, bool),
                cell(scope, "has_end_to_end_latency_sample", entry.has_end_to_end_latency_sample, bool),
                cell(scope, "decode_step_count", entry.decode_step_count, count, { numeric: true }),
                cell(scope, "batch_issue_count", entry.batch_issue_count, count, { numeric: true }),
              ],
            };
          },
          {
            description:
              "时间戳与 ps 值走无损 JSON 路径，显示换算保留原始整数；has_*_sample 为 false 表示后端没有把该请求纳入对应分位数样本。",
          },
        ),
      ],
    ),
    group(
      "metric-percentile-subjects",
      "分位数主体（P50 / P95 / P99）",
      [],
      [
        buildList(
          scope,
          "percentile_subjects",
          "percentile_subjects",
          metrics.percentile_subjects,
          "metrics:/percentile_subjects",
          [
            { key: "metric_kind", label: "metric_kind" },
            { key: "percentile", label: "percentile", numeric: true },
            { key: "value_ps", label: "value_ps", numeric: true },
            { key: "selection_rule", label: "selection_rule" },
            { key: "selection_semantics", label: "selection_semantics" },
            { key: "selected_request_id", label: "selected_request_id", mono: true },
            { key: "member_request_ids", label: "member_request_ids" },
            { key: "subject_refs", label: "subject_refs" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.metric_kind ?? "")}-${String(entry.percentile ?? index)}`,
              cells: [
                cell(scope, "metric_kind", entry.metric_kind),
                cell(scope, "percentile", entry.percentile, count, { numeric: true }),
                cell(scope, "value_ps", entry.value_ps, (value) => withUnit(value, "ps"), { numeric: true }),
                cell(scope, "selection_rule", entry.selection_rule),
                cell(scope, "selection_semantics", entry.selection_semantics),
                cell(scope, "selected_request_id", entry.selected_request_id, undefined, { mono: true }),
                cell(scope, "member_request_ids", entry.member_request_ids, listText),
                cell(scope, "subject_refs", entry.subject_refs, referenceText),
              ],
            };
          },
          {
            description:
              "P50、P95、P99 三种分位数条目全部保留；selection_rule 与 selected_request_id 由后端给出，前端不自行挑选代表请求。",
          },
        ),
      ],
    ),
    group(
      "metric-fabric-summary",
      "网络时间线与占用",
      fabricFields,
      [],
      "has_fabric_timeline 为 false 表示后端没有写出网络时间线；该布尔事实不得显示为「已采集」。",
    ),
  ];
}
