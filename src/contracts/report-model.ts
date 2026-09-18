import type {
  DesignSpaceReportContract,
  ExecutionEnvelopeContract,
  MetricsReportContract,
  RunReportContract,
  TailReportContract,
  ValidationReportContract,
} from "./generated/report-identities";
import type {
  EvidenceRef as F6BEvidenceRef,
  Provenance,
  S7RunBoundDesEvidenceV1,
  SubjectRef as F6BSubjectRef,
} from "./generated/bridge-contracts";

export type ReportKind =
  "run" | "metrics" | "validation" | "tail" | "design_space" | "execution_envelope" | "run_bound_des_evidence";
export type Availability = "available" | "expected_absence" | "not_covered" | "missing" | "unsupported_schema";
export type LosslessInteger = number | string | bigint;
export type Scalar = string | number | boolean | null;
export type SubjectRef = F6BSubjectRef;
export type EvidenceRef = F6BEvidenceRef;
export type RunBoundDesEvidenceReport = S7RunBoundDesEvidenceV1;

export interface SourcedValue<T> {
  value: T | null;
  sourcePaths: string[];
  derivation: "identity" | "fallback" | "count" | "deduplicate" | "unit_conversion";
  availability: Availability;
}

export interface EvidenceSummary {
  sourceMode: string;
  calibration: string;
  claimScope: string;
  lane: string;
  tier: string;
}

export interface ReportSummary {
  trace_name?: string;
  range_label?: string;
  host_path?: string;
  execution_path?: string;
  preferred_entrypoint?: string;
  end_to_end_latency_us?: number;
  runtime_event_count?: number;
  fabric_record_count?: number;
  validation_completeness?: number;
  has_tail_attribution?: boolean;
}

export interface FidelityResolution {
  subsystem: string;
  requested_fidelity?: string;
  actual_fidelity?: string;
  resolution?: string;
  state?: string;
  downgraded?: boolean;
  fallback?: boolean;
  expected_absence?: boolean;
  not_covered?: boolean;
  claim_scope_impact?: string;
  detail?: string;
}

/**
 * Serialized by `WindTunnel.cpp` `to_json(const ResolvedFidelityProfile &)`
 * (backend struct `include/Core/WindTunnel.h:76-84`).
 */
export interface ResolvedFidelityProfile {
  range_label?: string;
  has_downgrades?: boolean;
  has_fallbacks?: boolean;
  has_not_covered?: boolean;
  has_expected_absence?: boolean;
  claim_scope_summary?: string;
  entries?: FidelityResolution[];

  [key: string]: unknown;
}

export interface ImplementationEntry {
  subsystem: string;
  subsystem_name?: string;
  analytical_status?: string;
  effective_tier?: string;
  des_status?: string;
  cycle_status?: string;
  evidence?: string;
  gap?: string;
}

/**
 * Serialized by `WindTunnel.cpp` `to_json(const MultiGranularityProfile &)`
 * (backend struct `include/Core/WindTunnel.h:254-269`).
 */
export interface CapabilityRegistryEntry {
  subsystem?: string;
  subsystem_name?: string;
  analytical_capability?: string;
  des_capability?: string;
  cycle_capability?: string;
  des_contract_role?: string;
  des_required_for_host_contract?: boolean;

  [key: string]: unknown;
}

export interface MultiGranularityProfile {
  requested_tier?: string;
  capability_registry?: { registry_version?: string; entries?: CapabilityRegistryEntry[] };
  requested_tier_state?: string;
  unsupported_reason?: string;
  des_completion_state?: string;
  des_contract_state?: string;
  des_required_subsystem_count?: number;
  des_satisfied_subsystem_count?: number;
  des_contract_gaps?: string[];
  has_des_gap?: boolean;
  has_cycle_gap?: boolean;
  summary?: string;
  entries?: ImplementationEntry[];

  [key: string]: unknown;
}

/**
 * The backend field is named `partial_artifacts` but `WindTunnel.cpp`
 * `to_json(const WindTunnelRunResult &)` writes it under the JSON key
 * `artifacts` (only `artifact_id` / `state` / `evidence_requirement` /
 * `absence_reason` / `detail`; `payload_json` is not serialized there).
 */
export interface PartialArtifactDescriptor {
  artifact_id?: string;
  state?: string;
  evidence_requirement?: string;
  absence_reason?: string;
  detail?: string;
  payload_json?: unknown;

  [key: string]: unknown;
}

export interface BottleneckReport {
  primary_subsystem?: string;
  title?: string;
  detail?: string;
  supporting_artifacts?: string[];

  [key: string]: unknown;
}

export interface RunReport extends Omit<RunReportContract, "summary"> {
  report_kind: "wind_tunnel_run_result";
  contract_version: "wind_tunnel.run.v1alpha1";
  status?: string;
  error_code?: string;
  cause?: string;
  /**
   * Authoritative backend remediation guidance written next to `cause`
   * (`WindTunnel.h:284`, values built at `WindTunnel.cpp:6315-6362`).
   * Display verbatim; never rewrite, summarize or soften it.
   */
  next_action?: string;
  completeness?: number;
  summary: ReportSummary;
  resolved_fidelity_profile?: ResolvedFidelityProfile;
  multi_granularity_profile?: MultiGranularityProfile;
  bottleneck_report?: BottleneckReport;
  artifacts?: PartialArtifactDescriptor[];
  [key: string]: unknown;
}

export interface PercentileSummary {
  p95_ps?: LosslessInteger;
  p99_ps?: LosslessInteger;
}

/**
 * `SimulationTypes.cpp:160-170` `metric_distribution_to_json`.
 * `p50_ps` and `max_ps` are part of the serialized shape.
 */
export interface MetricDistributionSummary extends PercentileSummary {
  sample_count?: LosslessInteger;
  p50_ps?: LosslessInteger;
  max_ps?: LosslessInteger;
  [key: string]: unknown;
}

export interface RequestMetric {
  request_id: string;
  status?: string;
  arrival_time_ps?: LosslessInteger;
  first_token_time_ps?: LosslessInteger;
  completion_time_ps?: LosslessInteger;
  ttft_ps?: LosslessInteger;
  tpot_ps?: LosslessInteger;
  end_to_end_latency_ps?: LosslessInteger;
  has_first_token_time?: boolean;
  has_ttft_sample?: boolean;
  has_tpot_sample?: boolean;
  has_end_to_end_latency_sample?: boolean;
  decode_step_count?: number;
  batch_issue_count?: number;
  [key: string]: unknown;
}

export interface PercentileSubject {
  metric_kind: "ttft_ps" | "tpot_ps" | "end_to_end_latency_ps";
  percentile: 50 | 95 | 99;
  value_ps: LosslessInteger;
  selection_rule: string;
  selection_semantics: "single_request" | "tie_no_single_request" | "not_applicable";
  selected_request_id: string;
  member_request_ids: string[];
  subject_refs: SubjectRef[];
}

export interface PhaseFabricContribution {
  request_id?: string;
  phase_id?: string;
  collective_id?: string;
  domain_id?: string;
  transfer_kind?: string;
  runtime_us?: number;
  queue_delay_us?: number;
  congestion_delay_us?: number;
  memory_event_id?: string;
  memory_operation?: string;
  memory_match_status?: string;
  memory_latency_us?: number;
  device_task_id?: string;
  device_profile?: string;
  device_stream_id?: string;
  device_match_status?: string;
  device_latency_us?: number;
  device_occupancy_ratio?: number;
  device_contention_delay_us?: number;
  resource_convergence_status?: string;
  not_s5_collective?: boolean;
  [key: string]: unknown;
}

export interface RequestFabricContribution {
  request_id?: string;
  record_count?: number;
  runtime_us?: number;
  queue_delay_us?: number;
  congestion_delay_us?: number;
  queue_delay_ratio?: number;
  congestion_delay_ratio?: number;
  dominant_domain_id?: string;
  dominant_delay_kind?: string;
  dominant_collective_id?: string;
  dominant_phase_id?: string;
  [key: string]: unknown;
}

export interface FabricDomainUtilization {
  domain_id?: string;
  record_count?: LosslessInteger;
  busy_time_ps?: LosslessInteger;
  observation_window_ps?: LosslessInteger;
  utilization_ratio?: number;
  queue_delay_us?: number;
  congestion_delay_us?: number;
  runtime_us?: number;
  topology_domain_ref?: EvidenceRef;
  [key: string]: unknown;
}

export interface ResourceConvergence {
  has_evidence?: boolean;
  summary?: string;
  collective_phase_count?: number;
  converged_request_count?: number;
  missing_memory_event_count?: number;
  missing_device_task_count?: number;
  [key: string]: unknown;
}

/** `SimulationTypes.cpp:407-422` `resource_boundary_evidence_to_json`. */
export interface ResourceBoundaryEvidenceSummary {
  source_subsystem?: string;
  trace_kind?: string;
  evidence_count?: LosslessInteger;
  total_bytes?: LosslessInteger;
  peak_bytes?: LosslessInteger;
  total_estimated_latency_us?: number;
  max_estimated_latency_us?: number;
  dominant_evidence_id?: string;
  dominant_operation?: string;
  dominant_profile?: string;

  [key: string]: unknown;
}

export interface ResourceBoundaryEvidence {
  has_evidence?: boolean;
  summary?: ResourceBoundaryEvidenceSummary;

  [key: string]: unknown;
}

/** `SimulationTypes.cpp:362-387` `pd_disaggregation_summary_to_json`. */
export interface PdDisaggregationSummary {
  has_handoff_evidence?: boolean;
  handoff_record_count?: LosslessInteger;
  handoff_busy_time_ps?: LosslessInteger;
  handoff_latency_us?: number;
  handoff_queue_delay_us?: number;
  handoff_congestion_delay_us?: number;
  handoff_runtime_us?: number;
  handoff_ready_event_count?: LosslessInteger;
  decode_wait_for_handoff_ps?: LosslessInteger;
  decode_wait_after_handoff_ps?: LosslessInteger;
  max_decode_wait_for_handoff_ps?: LosslessInteger;
  max_decode_wait_after_handoff_ps?: LosslessInteger;
  dominant_runtime_handoff_request_id?: string;
  dominant_runtime_handoff_id?: string;
  dominant_handoff_request_id?: string;
  dominant_handoff_phase_id?: string;
  dominant_handoff_domain_id?: string;
  dominant_handoff_id?: string;
  dominant_source_placement_group_id?: string;
  dominant_destination_placement_group_id?: string;

  [key: string]: unknown;
}

/**
 * `SimulationTypes.cpp:2140-2155` / `WindTunnel.cpp:2950-2975`
 * `resolution_control` block. Shared by the metrics and validation reports.
 */
export interface ResolutionControl {
  range_label?: string;
  has_downgrades?: boolean;
  has_fallbacks?: boolean;
  has_not_covered?: boolean;
  has_expected_absence?: boolean;
  downgrade_count?: LosslessInteger;
  fallback_count?: LosslessInteger;
  not_covered_count?: LosslessInteger;
  expected_absence_count?: LosslessInteger;
  dominant_resolution?: string;
  dominant_subsystem?: string;
  dominant_detail?: string;
  claim_scope_summary?: string;

  [key: string]: unknown;
}

/** `SimulationTypes.cpp:2158-2172` / `WindTunnel.cpp:2940-2949` `des_contract` block. */
export interface DesContractSummary {
  des_contract_state?: string;
  des_required_subsystem_count?: LosslessInteger;
  des_satisfied_subsystem_count?: LosslessInteger;
  des_contract_gaps?: string[];

  [key: string]: unknown;
}

export interface FidelityControl {
  requested_tier?: string;
  requested_tier_state?: string;
  unsupported_reason?: string;
  capability_registry_version?: string;
  capability_registry_entry_count?: LosslessInteger;
  des_required_capability_count?: LosslessInteger;

  [key: string]: unknown;
}

export interface ObservationWindow {
  start_time_ps?: LosslessInteger;
  end_time_ps?: LosslessInteger;
  [key: string]: unknown;
}

export interface MetricsReport extends Omit<MetricsReportContract, "summary" | "request_metrics"> {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  metric_lane?: string;
  evidence_tier?: string;
  claim_scope_summary?: string;
  summary?: {
    throughput_requests_per_second?: number;
    request_count?: number;
    completed_request_count?: number;
    rejected_request_count?: number;
  };
  tail_latency_summary?: {
    ttft_ps?: MetricDistributionSummary;
    tpot_ps?: MetricDistributionSummary;
    end_to_end_latency_ps?: MetricDistributionSummary;
  };
  request_metrics?: RequestMetric[];
  percentile_subjects?: PercentileSubject[];
  run_id?: string;
  resolution_entries?: FidelityResolution[];
  resolution_control?: ResolutionControl;
  fidelity_control?: FidelityControl;
  des_contract?: DesContractSummary;
  trace_provenance?: TraceProvenance;
  resource_convergence?: ResourceConvergence;
  resource_boundary_evidence?: ResourceBoundaryEvidence;
  observation_window?: ObservationWindow;
  /** Backend-authored boundary statements (`SimulationTypes.cpp:2224-2229`). */
  boundary_notes?: string[];
  metric_scope?: string;
  system_summary?: {
    has_fabric_timeline?: boolean;
    fabric_record_count?: number;
    active_fabric_domain_count?: number;
    fabric_busy_time_ps?: LosslessInteger;
    fabric_observation_window_ps?: LosslessInteger;
    fabric_utilization_ratio?: number;
    has_fabric_backpressure_signal?: boolean;
    fabric_backpressure_event_count?: number;
    max_fabric_backpressure_delay_us?: number;
    dominant_fabric_backpressure_domain_id?: string;
    dominant_fabric_backpressure_kind?: string;
    phase_fabric_contributions?: PhaseFabricContribution[];
    request_fabric_contributions?: RequestFabricContribution[];
    fabric_domain_utilization?: FabricDomainUtilization[];
    pd_disaggregation?: PdDisaggregationSummary;
  };
  [key: string]: unknown;
}

export interface TraceProvenance {
  source_mode?: string;
  calibration_level?: string;
  allowed_claim_scope?: string;
  source_id?: string;
  generation_path?: string;
  capture_or_generation_time?: string;
  upstream_tooling?: string;
  trace_kind?: string;
  notes?: string[];
  [key: string]: unknown;
}

/** `WindTunnel.cpp:2997-2999` `LayerErrorBudgetEntry`. */
export interface ErrorBudgetEntry {
  metric_id?: string;
  subsystem?: string;
  observed_value?: number;
  expected_value?: number;
  absolute_error?: number;
  tolerance?: number;
  unit?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ValidationCheck {
  check_id: string;
  subsystem?: string;
  status?: string;
  detail?: string;
  subject_refs?: SubjectRef[];
  evidence_refs?: EvidenceRef[];
  [key: string]: unknown;
}

export interface ValidationReport extends Omit<ValidationReportContract, "checks"> {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  validation_scope?: string;
  validation_lane?: string;
  evidence_tier?: string;
  claim_scope_summary?: string;
  completeness?: number;
  trace_provenance?: TraceProvenance;
  baseline_package_id?: string;
  benchmark_manifests?: string[];
  calibration_inputs?: string[];
  error_budget?: ErrorBudgetEntry[];
  des_contract?: DesContractSummary;
  resolution_control?: ResolutionControl;
  resolution_entries?: FidelityResolution[];
  checks?: ValidationCheck[];
  open_gaps?: string[];
  run_id?: string;
  [key: string]: unknown;
}

export interface AttributionItem {
  rank?: number;
  subsystem?: string;
  component_code?: string;
  detail?: string;
  evidence_link?: string;
  share?: number;
  score_ps?: LosslessInteger;
  attribution_id?: string;
  subject_refs?: SubjectRef[];
  evidence_refs?: EvidenceRef[];
  [key: string]: unknown;
}

export interface CauseItem {
  subsystem?: string;
  cause_code?: string;
  title?: string;
  evidence?: string;
  cause_id?: string;
  subject_refs?: SubjectRef[];
  evidence_refs?: EvidenceRef[];
  [key: string]: unknown;
}

export interface AttributionAudit {
  status?: string;
  evidence_tier?: string;
  score_total_ps?: LosslessInteger;
  share_sum?: number;
  conserved?: boolean;
  propagation_complete?: boolean;
  issues?: string[];
  [key: string]: unknown;
}

/** `SimulationTypes.cpp:1969-1979` `contributing_factors[]` entries. */
export interface ContributingFactor {
  subsystem?: string;
  factor_code?: string;
  detail?: string;
  score?: number;
  [key: string]: unknown;
}

export interface TailReport extends Omit<TailReportContract, "cause_chain"> {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  run_id?: string;
  /** Backend-authored one-line symptom statement (`SimulationTypes.h:539`). */
  symptom?: string;
  explained_entity?: { kind?: string; id?: string };
  observation_window?: ObservationWindow;
  confidence?: number;
  completeness?: number;
  cause_chain?: CauseItem[];
  contributing_factors?: ContributingFactor[];
  attribution_ranking?: AttributionItem[];
  attribution_audit?: AttributionAudit;
  validation_links?: string[];
  metric_evidence_links?: string[];
  resource_evidence_links?: string[];
  unresolved_gaps?: string[];
  [key: string]: unknown;
}

export interface ExecutionStage {
  stage_id: string;
  subsystem?: string;
  stage_kind?: string;
  detail?: string;
  start_time_ps?: LosslessInteger;
  end_time_ps?: LosslessInteger;
  subject_refs?: SubjectRef[];
  evidence_refs?: EvidenceRef[];
  [key: string]: unknown;
}

export interface ExecutionEnvelopeReport extends Omit<ExecutionEnvelopeContract, "stages" | "host_path"> {
  envelope_id?: string;
  run_id?: string;
  schema_version?: string;
  contract_version?: string;
  trace_name?: string;
  host_path?: "S7";
  range_label?: string;
  trace_provenance?: TraceProvenance;
  start_time_ps?: LosslessInteger;
  end_time_ps?: LosslessInteger;
  end_to_end_latency_us?: number;
  runtime_event_count?: number;
  fabric_record_count?: number;
  /** Boolean fact only: a `false` value must never be styled as "captured". */
  has_runtime_event_trace?: boolean;
  has_tail_cause_chain_report?: boolean;
  stages: ExecutionStage[];
  evidence_refs?: EvidenceRef[];
  notes?: string[];
  [key: string]: unknown;
}

export interface DesignCandidate {
  candidate_id: string;
  name?: string;
  screening_tier?: string;
  requested_fidelity?: string;
  resolved_fidelity?: string;
  promoted_to_des?: boolean;
  promotion_reason?: string;
  promotion_hint?: string;
  screening_score?: number;
  projected_ttft_us?: number;
  projected_tpot_us?: number;
  projected_p95_latency_us?: number;
  projected_p99_latency_us?: number;
  projected_throughput_requests_per_second?: number;
  metric_source?: string;
  metric_availability?: { ttft?: boolean; tpot?: boolean };
  analytical_run_instance_id?: string;
  des_run_instance_id?: string;
  analytical_rank?: number;
  final_rank?: number;
  deterministic_bounds_us?: {
    method?: string;
    p95?: { lower?: number; upper?: number };
    p99?: { lower?: number; upper?: number };
  };
  first_state_divergence?: { present?: boolean; index?: number; state_schema?: string };
  stop_reason?: string;
  candidate_knobs?: Record<string, string | number | boolean | null | undefined>;
  runtime_scheduler?: string;
  kv_policy?: string;
  device_profile?: string;
  topology_scale?: string;
  moe_expert_count?: number;
  moe_placement?: string;
  candidate_provenance?: string;
  validation_lane?: string;
  evidence_tier?: string;
  claim_scope_summary?: string;
  des_refinement_link?: string;
  validation_link?: string;
  metrics_link?: string;
  tail_attribution_link?: string;
  subsystem_attribution?: Array<{
    subsystem?: string;
    reason?: string;
    detail?: string;
    score_ps?: number;
  }>;
  subject_refs?: SubjectRef[];
  evidence_refs?: EvidenceRef[];
  navigation?: {
    navigation_scope: "artifact_record";
    bridge_run_id: null;
    backend_run_instance_id: string;
    parent_run_id: string;
    candidate_id: string;
    record_ref: EvidenceRef;
  };
  pareto_front_id?: string;
  objective_set_id?: string;
  pareto_member?: boolean | null;
  dominated_by_candidate_ids?: string[];
  dominates_candidate_ids?: string[];
  dominance_status?: "non_dominated" | "dominated" | "insufficient_objectives" | "not_evaluated";
  dominance_reason_code?: string;
  objectives?: Array<{
    objective_id: string;
    metric_kind: string;
    direction: "minimize" | "maximize";
    value: number | null;
    unit: string;
    availability: "available" | "missing" | "not_applicable" | "not_covered";
    evidence_ref: EvidenceRef;
  }>;
  executed_s6_knobs?: Array<{
    knob_id: string;
    subsystem: "S6";
    value_type: "uint64" | "real" | "string";
    value: LosslessInteger | number | string | null;
    unit: string;
    availability: "available" | "not_applicable" | "unresolved_not_executed";
    requested_value: LosslessInteger | number | string | null;
    resolved_value: LosslessInteger | number | string | null;
    source_ref: EvidenceRef;
    evidence_ref: EvidenceRef;
  }>;
  [key: string]: unknown;
}

export interface DesignSpaceReport extends Omit<
  DesignSpaceReportContract,
  "ranking" | "contract_version" | "report_kind"
> {
  report_kind?: "design_space_report";
  schema_version?: "tilesim.design_space_report.v1";
  contract_version?: "design_space.report.v1alpha1" | "tilesim.design_space_report.v1";
  run_id?: string;
  report_id?: string;
  trace_name?: string;
  host_path?: string;
  screening_tier?: string;
  design_space_lane?: string;
  execution_scope: "S6_only";
  resolved_fidelity_scope_status?: string;
  resolved_fidelity_dominant_resolution?: string;
  resolved_fidelity_dominant_subsystem?: string;
  candidate_count?: LosslessInteger;
  promoted_candidate_count?: number;
  validation_lane?: string;
  evidence_tier?: string;
  claim_scope_summary?: string;
  candidate_source?: string;
  candidate_source_mode?: string;
  candidate_calibration_level?: string;
  candidate_allowed_claim_scope?: string;
  manifest_id?: string;
  manifest_path?: string;
  manifest_validation_status?: string;
  manifest_validation_detail?: string;
  ranking: DesignCandidate[];
  provenance?: Provenance;
  pareto_front_id?: string;
  objective_set_id?: string;
  candidates?: DesignCandidate[];
  analytical_vs_des_disagreements?: Array<{
    candidate_id: string;
    analytical_rank?: number;
    des_rank?: number;
    detail?: string;
  }>;
  [key: string]: unknown;
}

export interface ReportByKind {
  run: RunReport;
  metrics: MetricsReport;
  validation: ValidationReport;
  tail: TailReport;
  design_space: DesignSpaceReport;
  execution_envelope: ExecutionEnvelopeReport;
  run_bound_des_evidence: RunBoundDesEvidenceReport;
}

export type CompatibilityStatus = "supported" | "legacy_unversioned" | "unsupported_schema" | "invalid_schema";

export interface CompatibilityResult {
  status: CompatibilityStatus;
  schema: string;
  supported: boolean;
  issues: string[];
}

export interface ReportBundle {
  run: RunReport | null;
  metrics: MetricsReport | null;
  validation: ValidationReport | null;
  tail: TailReport | null;
  design_space: DesignSpaceReport | null;
  execution_envelope: ExecutionEnvelopeReport | null;
  run_bound_des_evidence: RunBoundDesEvidenceReport | null;
  unsupported: Partial<Record<ReportKind, Record<string, unknown>>>;
  compatibility: Partial<Record<ReportKind, CompatibilityResult>>;
}

export interface RuntimeTraceInput {
  trace_name?: string;
  policy?: {
    batch_scheduler?: string;
    max_batch_size?: number;
    max_active_requests?: number;
    kv_capacity_tokens?: number;
    fabric_backpressure_active?: boolean;
    [key: string]: unknown;
  };
  requests?: Array<{
    request_id: string;
    phase?: string;
    model_id?: string;
    prompt_tokens?: number;
    decode_tokens?: number;
    kv_tokens?: number;
    priority_class?: string;
    collective_type?: string;
    tp_degree?: number;
    message_size_bytes?: LosslessInteger;
  }>;
  [key: string]: unknown;
}

export interface RunInputs {
  runtime_trace: RuntimeTraceInput | null;
  topology: Record<string, unknown> | null;
}
