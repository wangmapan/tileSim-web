import type { ArtifactManifestResponse } from "../../contracts/bridge-api";
import type {
  AttributionItem,
  AttributionAudit,
  CauseItem,
  DesignCandidate,
  FidelityResolution,
  ImplementationEntry,
  ReportBundle,
  RequestMetric,
  RunInputs,
  ValidationCheck,
} from "../../contracts/report-model";
import { buildExecutionResult, executionStageSource } from "../execution-inspector/model-api";
import type { ExecutionRecord, ExecutionStat, LayerId, LayerVisualization } from "../execution-inspector/model-api";
import { buildDesignSpaceAnalysis, buildF7Capabilities, buildFabricAnalysis } from "../f7-analysis";
import type { F7Availability, F7Capability, F7EvidenceIdentity } from "../f7-analysis";
import { buildRunBoundEvidenceChain } from "../run-bound-evidence/model-api";
import type {
  PercentileNavigation,
  RunBoundAvailability,
  RunBoundEvidenceChain,
  RunBoundEvidenceNode,
  RunBoundReference,
  Week8ExecutionSummary,
} from "../run-bound-evidence/model-api";
import { t } from "../../i18n";

export const structuredReportSchema = "tilesim.web.structured-performance-report.v2";

export interface StructuredReportContext {
  bundle: ReportBundle;
  inputs: RunInputs;
  runId: string | null;
  runName: string;
  artifactManifest: ArtifactManifestResponse | null;
  selectedRequestId: string | null;
  generatedAt?: string;
}

export interface ReportValue {
  label: string;
  value: unknown;
  unit: string;
  availability: "available" | "missing";
  hint?: string;
}

export interface StructuredSubsystemSection {
  subsystem: LayerId;
  name: string;
  title: string;
  role: string;
  evidence_state: string;
  source_pattern: string;
  detail: string;
  fidelity: FidelityResolution | null;
  implementation: ImplementationEntry | null;
  performance_metrics: ReportValue[];
  structured_records: ExecutionRecord[];
  validation_checks: ValidationCheck[];
  reported_attribution: AttributionItem[];
  visualizations: LayerVisualization[];
}

export interface StructuredRunBoundReference {
  run_id: string | null;
  artifact_id: string;
  schema_identity: string;
  sha256: string | null;
  json_pointer: string;
  subject: { kind: string; id: string };
  label: string;
}

export interface StructuredRunBoundEvidence {
  selected_request_id: string | null;
  selection_availability: "selected" | "missing";
  contract_state: RunBoundEvidenceChain["contractState"];
  percentile_subjects: Array<{
    metric_kind: PercentileNavigation["metricKind"];
    percentile: PercentileNavigation["percentile"];
    value_ps: PercentileNavigation["valuePs"];
    selection_rule: string;
    selection_semantics: PercentileNavigation["semantics"];
    selected_request_id: string | null;
    member_request_ids: string[];
    availability: RunBoundAvailability;
    detail: string;
    reference: StructuredRunBoundReference | null;
  }>;
  nodes: Array<{
    subsystem: RunBoundEvidenceNode["subsystem"];
    title: string;
    availability: RunBoundAvailability;
    detail: string;
    entity_ids: string[];
    references: StructuredRunBoundReference[];
  }>;
  week8_execution: {
    availability: RunBoundAvailability;
    requested_fidelity: string | null;
    resolved_fidelity: string | null;
    execution_mode: string | null;
    fallback: Week8ExecutionSummary["fallback"];
    provenance: Week8ExecutionSummary["provenance"];
    state_summary: Week8ExecutionSummary["stateSummary"];
    differential: Week8ExecutionSummary["differential"];
    stream: Week8ExecutionSummary["stream"];
    checkpoint: Week8ExecutionSummary["checkpoint"];
    reference: StructuredRunBoundReference | null;
    detail: string;
  };
  gaps: string[];
}

export interface StructuredPerformanceReport {
  schema_version: typeof structuredReportSchema;
  generated_at: string;
  generator: {
    name: "TileSim Web";
    mode: "deterministic_frontend_export";
    simulation_recomputation: false;
  };
  report_identity: {
    run_id: string | null;
    run_name: string;
    trace_name: string | null;
    run_status: string | null;
    modeled_range: string | null;
    execution_host: string | null;
  };
  evidence_boundary: {
    source_mode: string | null;
    calibration_level: string | null;
    allowed_claim_scope: string | null;
    validation_lane: string | null;
    evidence_tier: string | null;
    metric_lane: string | null;
    schema_set_revision: string | null;
    artifact_index: Array<{
      artifact_id: string;
      report_kind: string | null;
      sha256: string;
      schema_identity: string;
    }>;
  };
  process_model: {
    canonical_flow: "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6";
    execution_host: "S7";
    validation_plane: "S8";
    metrics_and_attribution_plane: "S9";
    resource_semantics_note: string;
  };
  run_overview: {
    reported_summary: ReportValue[];
    reported_bottleneck: Record<string, unknown> | null;
    observation_window: Record<string, unknown> | null;
    resource_convergence: Record<string, unknown> | null;
  };
  input_configuration: {
    runtime_policy: Record<string, unknown> | null;
    topology: Record<string, unknown> | null;
  };
  modeled_subsystems: StructuredSubsystemSection[];
  execution_host_s7: {
    description: string;
    stages: StructuredPerformanceReport["modeled_subsystems"][number]["structured_records"];
    timeline: LayerVisualization;
    raw_stages: Array<Record<string, unknown>>;
  };
  validation_s8: {
    status: "reported" | "missing";
    completeness: number | null;
    lane: string | null;
    evidence_tier: string | null;
    claim_scope_summary: string | null;
    provenance: Record<string, unknown> | null;
    fidelity_resolution: FidelityResolution[];
    checks: ValidationCheck[];
    open_gaps: string[];
  };
  metrics_and_attribution_s9: {
    status: "reported" | "missing";
    request_metrics: RequestMetric[];
    tail_latency_summary: Record<string, unknown> | null;
    reported_attribution: AttributionItem[];
    reported_cause_chain: CauseItem[];
    attribution_audit: AttributionAudit | null;
  };
  run_bound_evidence: StructuredRunBoundEvidence;
  performance_evidence_appendix: {
    fabric_contract: {
      artifact_availability: string;
      artifact_evidence: F7EvidenceIdentity;
      topology_join_availability: F7Availability;
      domain_references: Array<{
        domain_id: string | null;
        availability: string;
        evidence: F7EvidenceIdentity;
        topology_availability: string;
        topology_evidence: F7EvidenceIdentity;
        topology_domain: Record<string, unknown> | null;
      }>;
      request_references: Array<{
        request_id: string | null;
        availability: string;
        evidence: F7EvidenceIdentity;
        dominant_phase_id: string | null;
        dominant_phase_availability: string;
        dominant_phase_evidence: F7EvidenceIdentity;
      }>;
    };
    workload_requests: Array<Record<string, unknown>>;
    request_metrics: Array<Record<string, unknown>>;
    phase_fabric_contributions: Array<Record<string, unknown>>;
    request_fabric_contributions: Array<Record<string, unknown>>;
    fabric_domain_utilization: Array<Record<string, unknown>>;
  };
  design_space_appendix: {
    availability: F7Availability;
    execution_scope: string | null;
    report_summary: Record<string, unknown> | null;
    candidates: DesignCandidate[];
    analytical_vs_des_disagreements: Array<Record<string, unknown>>;
    contract_capabilities: F7Capability[];
    formal_contract: {
      artifact_evidence: F7EvidenceIdentity;
      pareto_front_id: string | null;
      objective_set_id: string | null;
      navigation_scope: "artifact_record" | null;
      candidate_references: Array<{
        candidate_id: string;
        availability: F7Availability;
        evidence: F7EvidenceIdentity;
        objective_references: F7EvidenceIdentity[];
        knob_requested_references: F7EvidenceIdentity[];
        knob_resolved_references: F7EvidenceIdentity[];
      }>;
    };
  };
  agent_analysis: {
    status: "not_generated";
    root_cause_analysis: null;
    optimization_recommendations: null;
    note: string;
  };
}

function availability(value: unknown): ReportValue["availability"] {
  return value === undefined || value === null || value === "" || value === "—" ? "missing" : "available";
}

function reportValue(label: string, value: unknown, unit = "", hint = ""): ReportValue {
  return {
    label: t(label),
    value: value ?? null,
    unit,
    availability: availability(value),
    ...(hint ? { hint: t(hint) } : {}),
  };
}

function valuesFromStats(stats: ExecutionStat[]): ReportValue[] {
  return stats.map((item) => reportValue(item.label, item.value, item.unit, item.hint));
}

function stageRecords(bundle: ReportBundle): ExecutionRecord[] {
  const stages = bundle.execution_envelope?.stages || [];
  return stages.map((stage) => ({
    id: stage.stage_id,
    title: stage.stage_kind || String(stage["title"] || "execution stage"),
    subtitle: stage.subsystem,
    sourcePath: executionStageSource(stages, stage.stage_id) || undefined,
    facts: [
      { label: t("开始时间"), value: stage.start_time_ps ?? null, unit: "ps" },
      { label: t("结束时间"), value: stage.end_time_ps ?? null, unit: "ps" },
      { label: t("说明"), value: stage.detail ?? null, unit: "" },
    ],
  }));
}

function artifactIndex(manifest: ArtifactManifestResponse | null) {
  return (manifest?.artifacts || []).map((artifact) => ({
    artifact_id: artifact.artifact_id,
    report_kind: artifact.report_kind ?? null,
    sha256: artifact.sha256,
    schema_identity: artifact.schema_identity,
  }));
}

function structuredReference(runId: string | null, reference: RunBoundReference): StructuredRunBoundReference {
  return {
    run_id: runId,
    artifact_id: reference.artifactId,
    schema_identity: reference.schemaIdentity,
    sha256: reference.sha256,
    json_pointer: reference.jsonPointer,
    subject: { kind: reference.entityKind, id: reference.entityId },
    label: reference.label,
  };
}

function structuredRunBoundEvidence(chain: RunBoundEvidenceChain): StructuredRunBoundEvidence {
  const mapReference = (reference: RunBoundReference | null) =>
    reference ? structuredReference(chain.runId, reference) : null;
  return {
    selected_request_id: chain.requestId,
    selection_availability: chain.requestId ? "selected" : "missing",
    contract_state: chain.contractState,
    percentile_subjects: chain.percentileSubjects.map((subject) => ({
      metric_kind: subject.metricKind,
      percentile: subject.percentile,
      value_ps: subject.valuePs,
      selection_rule: subject.selectionRule,
      selection_semantics: subject.semantics,
      selected_request_id: subject.selectedRequestId,
      member_request_ids: subject.memberRequestIds,
      availability: subject.availability,
      detail: subject.detail,
      reference: mapReference(subject.reference),
    })),
    nodes: chain.nodes.map((node) => ({
      subsystem: node.subsystem,
      title: node.title,
      availability: node.availability,
      detail: node.detail,
      entity_ids: node.entityIds,
      references: node.references.map((reference) => structuredReference(chain.runId, reference)),
    })),
    week8_execution: {
      availability: chain.week8Execution.availability,
      requested_fidelity: chain.week8Execution.requestedFidelity,
      resolved_fidelity: chain.week8Execution.resolvedFidelity,
      execution_mode: chain.week8Execution.executionMode,
      fallback: chain.week8Execution.fallback,
      provenance: chain.week8Execution.provenance,
      state_summary: chain.week8Execution.stateSummary,
      differential: chain.week8Execution.differential,
      stream: chain.week8Execution.stream,
      checkpoint: chain.week8Execution.checkpoint,
      reference: mapReference(chain.week8Execution.reference),
      detail: chain.week8Execution.detail,
    },
    gaps: chain.gaps,
  };
}

export function buildStructuredPerformanceReport(context: StructuredReportContext): StructuredPerformanceReport {
  const { bundle, inputs } = context;
  const execution = buildExecutionResult(bundle, inputs);
  const metrics = bundle.metrics;
  const validation = bundle.validation;
  const provenance = validation?.trace_provenance || metrics?.trace_provenance;
  const summary = metrics?.summary;
  const runSummary = bundle.run?.summary;
  const runBoundEvidence = buildRunBoundEvidenceChain({
    runId: context.runId,
    requestId: context.selectedRequestId,
    bundle,
    inputs,
    artifactManifest: context.artifactManifest,
  });
  const fabricAnalysis = buildFabricAnalysis(metrics, context.artifactManifest, inputs.topology);
  const designSpaceAnalysis = buildDesignSpaceAnalysis(bundle.design_space, context.artifactManifest);
  const f7Capabilities = buildF7Capabilities(bundle.design_space, context.artifactManifest, metrics, inputs.topology);
  const designSpaceSummary = bundle.design_space
    ? Object.fromEntries(
        Object.entries(bundle.design_space).filter(
          ([key]) => !["ranking", "candidates", "analytical_vs_des_disagreements"].includes(key),
        ),
      )
    : null;

  return {
    schema_version: structuredReportSchema,
    generated_at: context.generatedAt || new Date().toISOString(),
    generator: { name: "TileSim Web", mode: "deterministic_frontend_export", simulation_recomputation: false },
    report_identity: {
      run_id: context.runId,
      run_name: context.runName,
      trace_name: runSummary?.trace_name || null,
      run_status: bundle.run?.status || null,
      modeled_range: runSummary?.range_label || null,
      execution_host: runSummary?.host_path || bundle.execution_envelope?.host_path || null,
    },
    evidence_boundary: {
      source_mode: provenance?.source_mode || null,
      calibration_level: provenance?.calibration_level || null,
      allowed_claim_scope: provenance?.allowed_claim_scope || null,
      validation_lane: validation?.validation_lane || null,
      evidence_tier: validation?.evidence_tier || metrics?.evidence_tier || null,
      metric_lane: metrics?.metric_lane || null,
      schema_set_revision: context.artifactManifest?.schema_set_revision || null,
      artifact_index: artifactIndex(context.artifactManifest),
    },
    process_model: {
      canonical_flow: "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6",
      execution_host: "S7",
      validation_plane: "S8",
      metrics_and_attribution_plane: "S9",
      resource_semantics_note: t("S3、S4、S5 是同一资源语义层中的并列子系统，不构成线性 S3 -> S4 -> S5 链。"),
    },
    run_overview: {
      reported_summary: [
        reportValue("端到端延迟", runSummary?.end_to_end_latency_us, "µs"),
        reportValue("Runtime events", runSummary?.runtime_event_count),
        reportValue("Fabric records", runSummary?.fabric_record_count),
        reportValue("请求数", summary?.request_count),
        reportValue("完成请求", summary?.completed_request_count),
        reportValue("拒绝请求", summary?.rejected_request_count),
        reportValue("吞吐", summary?.throughput_requests_per_second, "req/s"),
        reportValue("验证完整度", validation?.completeness, "%ratio"),
      ],
      reported_bottleneck: bundle.run?.bottleneck_report || null,
      observation_window: metrics?.observation_window || null,
      resource_convergence: metrics?.resource_convergence || null,
    },
    input_configuration: {
      runtime_policy: (inputs.runtime_trace?.policy as Record<string, unknown> | undefined) || null,
      topology: inputs.topology,
    },
    modeled_subsystems: execution.layers.map((layer) => ({
      subsystem: layer.id,
      name: layer.name,
      title: layer.title,
      role: layer.role,
      evidence_state: layer.evidenceState,
      source_pattern: layer.source,
      detail: layer.detail,
      fidelity: layer.resolution,
      implementation: layer.implementation,
      performance_metrics: valuesFromStats(layer.stats),
      structured_records: layer.records,
      validation_checks: layer.checks,
      reported_attribution: layer.attribution,
      visualizations: layer.visualizations,
    })),
    execution_host_s7: {
      description: t("S7 是统一执行宿主；stage 是 execution envelope，不等同于 S0-S6 canonical trace。"),
      stages: stageRecords(bundle),
      timeline: execution.timeline,
      raw_stages: (bundle.execution_envelope?.stages || []) as Array<Record<string, unknown>>,
    },
    validation_s8: {
      status: validation ? "reported" : "missing",
      completeness: validation?.completeness ?? null,
      lane: validation?.validation_lane || null,
      evidence_tier: validation?.evidence_tier || null,
      claim_scope_summary: typeof validation?.claim_scope_summary === "string" ? validation.claim_scope_summary : null,
      provenance: (validation?.trace_provenance as Record<string, unknown> | undefined) || null,
      fidelity_resolution: validation?.resolution_entries || metrics?.resolution_entries || [],
      checks: validation?.checks || [],
      open_gaps: validation?.open_gaps || [],
    },
    metrics_and_attribution_s9: {
      status: metrics || bundle.tail ? "reported" : "missing",
      request_metrics: metrics?.request_metrics || [],
      tail_latency_summary: (metrics?.tail_latency_summary as Record<string, unknown> | undefined) || null,
      reported_attribution: bundle.tail?.attribution_ranking || [],
      reported_cause_chain: bundle.tail?.cause_chain || [],
      attribution_audit: bundle.tail?.attribution_audit || null,
    },
    run_bound_evidence: structuredRunBoundEvidence(runBoundEvidence),
    performance_evidence_appendix: {
      fabric_contract: {
        artifact_availability: fabricAnalysis.artifactAvailability,
        artifact_evidence: fabricAnalysis.artifactEvidence,
        topology_join_availability: fabricAnalysis.topologyJoinAvailability,
        domain_references: fabricAnalysis.domains.map((domain) => ({
          domain_id: domain.domain_id || null,
          availability: domain.availability,
          evidence: domain.evidence,
          topology_availability: domain.topologyAvailability,
          topology_evidence: domain.topologyEvidence,
          topology_domain: (domain.topologyDomain as Record<string, unknown> | null) || null,
        })),
        request_references: fabricAnalysis.requests.map((request) => ({
          request_id: request.request_id || null,
          availability: request.availability,
          evidence: request.evidence,
          dominant_phase_id: request.dominant_phase_id || null,
          dominant_phase_availability: request.dominantPhaseAvailability,
          dominant_phase_evidence: request.dominantPhaseEvidence,
        })),
      },
      workload_requests: (inputs.runtime_trace?.requests || []) as Array<Record<string, unknown>>,
      request_metrics: (metrics?.request_metrics || []) as Array<Record<string, unknown>>,
      phase_fabric_contributions: (metrics?.system_summary?.phase_fabric_contributions || []) as Array<
        Record<string, unknown>
      >,
      request_fabric_contributions: (metrics?.system_summary?.request_fabric_contributions || []) as Array<
        Record<string, unknown>
      >,
      fabric_domain_utilization: (metrics?.system_summary?.fabric_domain_utilization || []) as Array<
        Record<string, unknown>
      >,
    },
    design_space_appendix: {
      availability: bundle.design_space ? designSpaceAnalysis.availability : "missing",
      execution_scope: bundle.design_space?.execution_scope || null,
      report_summary: designSpaceSummary,
      candidates: bundle.design_space?.candidates || bundle.design_space?.ranking || [],
      analytical_vs_des_disagreements: (bundle.design_space?.analytical_vs_des_disagreements || []) as Array<
        Record<string, unknown>
      >,
      contract_capabilities: f7Capabilities,
      formal_contract: {
        artifact_evidence: designSpaceAnalysis.artifactEvidence,
        pareto_front_id: designSpaceAnalysis.paretoFrontId,
        objective_set_id: designSpaceAnalysis.objectiveSetId,
        navigation_scope: designSpaceAnalysis.navigationScope,
        candidate_references: designSpaceAnalysis.candidates.map((candidate) => ({
          candidate_id: candidate.candidate.candidate_id,
          availability: candidate.availability,
          evidence: candidate.evidence,
          objective_references: candidate.objectiveReferences,
          knob_requested_references: candidate.knobRequestedReferences,
          knob_resolved_references: candidate.knobResolvedReferences,
        })),
      },
    },
    agent_analysis: {
      status: "not_generated",
      root_cause_analysis: null,
      optimization_recommendations: null,
      note: t("当前导出仅整理后端报告事实。具体根因判断和优化建议留待后续 evidence-aware Agent 生成。"),
    },
  };
}
