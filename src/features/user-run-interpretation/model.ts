import type { ArtifactManifestResponse } from "../../contracts/bridge-api";
import type { ReportBundle, RunInputs } from "../../contracts/report-model";
import type { ValidatedEvidenceAgentResult } from "../../entities/evidence-agent";
import type { EvidenceAgentBinding } from "../../entities/evidence-agent";
import { buildExecutionResult } from "../execution-inspector";
import type { LayerVisualization } from "../execution-inspector";
import { formatNumber, formatPercent, formatPicoseconds, statusLabel } from "../../lib/format";

export const userRunInterpretationSchema = "tilesim.web.user-run-interpretation.v1";

export interface UserRunInterpretationArtifactIdentity {
  artifact_id: string;
  report_kind: string | null;
  schema_identity: string;
  sha256: string;
  bytes: string;
  contract_status: string;
}

export type UserRunInterpretationManifestStatus =
  | "verified"
  | "unavailable"
  | "run_mismatch"
  | "missing"
  | "unsupported_schema"
  | "schema_revision_mismatch"
  | "artifact_identity_missing";

export interface UserRunInterpretationEvidenceStatus {
  manifest_status: UserRunInterpretationManifestStatus;
  rejected_artifacts: Array<{
    artifact_id: string;
    schema_identity: string;
    reason: string;
    json_pointer: string;
  }>;
  unavailable_artifacts: string[];
  unsupported_schema: string[];
  artifact_identity_missing: string[];
  schema_revision_mismatch: boolean;
}

export interface UserRunInterpretationBinding {
  run_id: string | null;
  backend_identity: string | null;
  schema_set_revision: string | null;
  input_snapshot_digest: string | null;
  artifacts: UserRunInterpretationArtifactIdentity[];
}

export interface UserRunInterpretationItem {
  title: string;
  text: string;
  source: "reported_metric" | "backend_report" | "deterministic_boundary" | "validated_agent";
  source_paths: string[];
}

export interface UserRunInterpretationNextStep extends UserRunInterpretationItem {
  conditional: boolean;
  citations: UserRunInterpretationArtifactIdentity[];
}

export interface UserRunInterpretationChart {
  id: string;
  title: string;
  description: string;
  kind: LayerVisualization["kind"];
  unit: string;
  columns: string[];
  rows: LayerVisualization["rows"];
  source_paths: string[];
  empty_reason?: string;
}

export interface UserRunInterpretationReport {
  schema_version: typeof userRunInterpretationSchema;
  generated_at: string;
  generator: {
    name: "TileSim Web";
    mode: "deterministic_frontend_export";
    simulation_recomputation: false;
  };
  binding: UserRunInterpretationBinding;
  evidence_status: UserRunInterpretationEvidenceStatus;
  run_name: string;
  run_status: string | null;
  run_summary: UserRunInterpretationItem[];
  key_results: UserRunInterpretationItem[];
  findings: UserRunInterpretationItem[];
  charts: UserRunInterpretationChart[];
  attention_items: UserRunInterpretationItem[];
  next_steps: UserRunInterpretationNextStep[];
  evidence_boundary: {
    source_mode: string | null;
    calibration_level: string | null;
    allowed_claim_scope: string | null;
    requested_fidelity: string | null;
    resolved_fidelity: string | null;
    execution_mode: string | null;
    note: string;
  };
  generation_status: "deterministic" | "deterministic_with_validated_agent_recommendation";
}

export interface UserRunInterpretationContext {
  bundle: ReportBundle;
  inputs: RunInputs;
  runId: string | null;
  runName: string;
  artifactManifest: ArtifactManifestResponse | null;
  backendIdentity: string | null;
  schemaSetRevision?: string | null;
  generatedAt?: string;
  validatedAgentResult?: ValidatedEvidenceAgentResult | null;
  evidenceAgentBinding?: EvidenceAgentBinding | null;
  currentEvidenceAgentBinding?: EvidenceAgentBinding | null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function artifactIdentities(manifest: ArtifactManifestResponse | null): UserRunInterpretationArtifactIdentity[] {
  return (manifest?.artifacts || []).map((artifact) => ({
    artifact_id: artifact.artifact_id,
    report_kind: artifact.report_kind ?? null,
    schema_identity: artifact.schema_identity || "not_applicable",
    sha256: artifact.sha256,
    bytes: String(artifact.bytes),
    contract_status: artifact.contract_status,
  }));
}

export function userRunInterpretationEvidenceStatus(
  context: UserRunInterpretationContext,
): UserRunInterpretationEvidenceStatus {
  const manifest = context.artifactManifest;
  if (!manifest) {
    return {
      manifest_status: "unavailable",
      rejected_artifacts: [],
      unavailable_artifacts: [],
      unsupported_schema: [],
      artifact_identity_missing: [],
      schema_revision_mismatch: false,
    };
  }
  const rejected_artifacts = (manifest.rejected_artifacts || []).map((item) => ({
    artifact_id: item.artifact_id,
    schema_identity: item.schema_identity,
    reason: item.reason,
    json_pointer: item.json_pointer,
  }));
  const unsupported_schema = rejected_artifacts
    .filter((item) => item.reason === "unsupported_schema")
    .map((item) => item.artifact_id);
  const unavailable_artifacts = manifest.artifacts
    .filter((artifact) => artifact.content_status === "expected_absence")
    .map((artifact) => artifact.artifact_id);
  const artifact_identity_missing = manifest.artifacts
    .filter(
      (artifact) =>
        !artifact.artifact_id ||
        !artifact.schema_identity ||
        !artifact.sha256 ||
        !/^(?:sha256:)?[a-f0-9]{64}$/i.test(artifact.sha256),
    )
    .map((artifact) => artifact.artifact_id || "未命名 artifact");
  const schema_revision_mismatch = Boolean(
    context.schemaSetRevision && manifest.schema_set_revision !== context.schemaSetRevision,
  );
  let manifest_status: UserRunInterpretationManifestStatus = "verified";
  if (manifest.run_id !== context.runId) manifest_status = "run_mismatch";
  else if (schema_revision_mismatch) manifest_status = "schema_revision_mismatch";
  else if (unsupported_schema.length) manifest_status = "unsupported_schema";
  else if (artifact_identity_missing.length) manifest_status = "artifact_identity_missing";
  else if (!manifest.artifacts.length) manifest_status = "missing";
  return {
    manifest_status,
    rejected_artifacts,
    unavailable_artifacts,
    unsupported_schema,
    artifact_identity_missing,
    schema_revision_mismatch,
  };
}

export function captureUserRunInterpretationBinding(
  context: UserRunInterpretationContext,
): UserRunInterpretationBinding {
  return {
    run_id: context.runId,
    backend_identity: context.backendIdentity,
    schema_set_revision: context.artifactManifest?.schema_set_revision || context.schemaSetRevision || null,
    // The evidence API does not expose a canonical input snapshot digest for ordinary run reports.
    // Keep this explicitly unavailable rather than hashing or inventing a frontend digest.
    input_snapshot_digest: null,
    artifacts: artifactIdentities(context.artifactManifest),
  };
}

export function userRunInterpretationBindingMatches(
  captured: UserRunInterpretationBinding,
  current: UserRunInterpretationContext,
): boolean {
  const status = userRunInterpretationEvidenceStatus(current);
  if (
    status.manifest_status === "run_mismatch" ||
    status.manifest_status === "schema_revision_mismatch" ||
    status.manifest_status === "unsupported_schema"
  )
    return false;
  const next = captureUserRunInterpretationBinding(current);
  return JSON.stringify(captured) === JSON.stringify(next);
}

function metricItem(title: string, text: string, path: string): UserRunInterpretationItem {
  return { title, text, source: "reported_metric", source_paths: [path] };
}

function reportItem(
  title: string,
  text: string,
  source_paths: string[],
  source: UserRunInterpretationItem["source"] = "backend_report",
): UserRunInterpretationItem {
  return { title, text, source, source_paths };
}

function validatedRecommendationItems(
  result: ValidatedEvidenceAgentResult | null | undefined,
  manifest: ArtifactManifestResponse | null,
  runId: string | null,
  backendIdentity: string | null,
  evidenceAgentBinding: EvidenceAgentBinding | null | undefined,
  currentEvidenceAgentBinding: EvidenceAgentBinding | null | undefined,
): UserRunInterpretationNextStep[] {
  if (
    !result ||
    !["available_draft", "partial", "truncated"].includes(result.state) ||
    result.invalidClaimIds.length > 0 ||
    !runId ||
    !manifest ||
    !evidenceAgentBinding ||
    !currentEvidenceAgentBinding ||
    !evidenceAgentBinding.inputSnapshotDigest ||
    evidenceAgentBinding.runId !== runId ||
    evidenceAgentBinding.backendIdentity !== backendIdentity ||
    evidenceAgentBinding.schemaSetRevision !== manifest.schema_set_revision ||
    JSON.stringify(evidenceAgentBinding) !== JSON.stringify(currentEvidenceAgentBinding)
  )
    return [];
  const identities = artifactIdentities(manifest);
  return result.response.claims
    .filter(
      (claim) =>
        claim.claim_kind === "conditional_recommendation" &&
        claim.scope.recommendation_semantics === "conditional_not_executed" &&
        claim.citations.length > 0,
    )
    .slice(0, 3)
    .map((claim): UserRunInterpretationNextStep | null => {
      const citations = claim.citations
        .filter(
          (citation) =>
            typeof citation.json_pointer === "string" &&
            typeof citation.subject?.kind === "string" &&
            typeof citation.subject?.id === "string" &&
            citation.subject.id.length > 0,
        )
        .map((citation) =>
          identities.find(
            (identity) =>
              citation.run_id === runId &&
              identity.artifact_id === citation.artifact_id &&
              identity.schema_identity === citation.schema_identity &&
              identity.sha256 === citation.sha256,
          ),
        )
        .filter((identity): identity is UserRunInterpretationArtifactIdentity => Boolean(identity));
      return citations.length === claim.citations.length
        ? {
            title: "条件建议（尚未执行）",
            text: claim.text,
            source: "validated_agent" as const,
            source_paths: claim.citations.map((citation) => `${citation.artifact_id}:${citation.json_pointer}`),
            conditional: true,
            citations,
          }
        : null;
    })
    .filter((item): item is UserRunInterpretationNextStep => Boolean(item));
}

function chartProjection(bundle: ReportBundle, inputs: RunInputs, runId: string | null): UserRunInterpretationChart[] {
  const execution = buildExecutionResult(bundle, inputs);
  const charts = execution.layers
    .flatMap((layer) => layer.visualizations)
    .filter((visualization) => visualization.kind !== "none")
    .slice(0, 4)
    .map((visualization) => ({
      id: visualization.id,
      title: visualization.title,
      description: visualization.description,
      kind: visualization.kind,
      unit: visualization.unit,
      columns: visualization.columns,
      rows: visualization.rows,
      source_paths: visualization.sourcePaths,
      ...(visualization.emptyReason ? { empty_reason: visualization.emptyReason } : {}),
    }));
  // A chart without a run identity is still truthful for a fixture/demo, but the report
  // binding remains explicit and the UI labels it as local deterministic material.
  void runId;
  return charts;
}

export function buildUserRunInterpretationReport(context: UserRunInterpretationContext): UserRunInterpretationReport {
  const { bundle } = context;
  const run = bundle.run;
  const metrics = bundle.metrics;
  const summary = metrics?.summary;
  const provenance = bundle.validation?.trace_provenance || metrics?.trace_provenance;
  const fidelity = run?.resolved_fidelity_profile;
  const runSummary: UserRunInterpretationItem[] = [];
  const keyResults: UserRunInterpretationItem[] = [];
  const findings: UserRunInterpretationItem[] = [];
  const attention: UserRunInterpretationItem[] = [];

  runSummary.push(
    reportItem(
      "运行状态",
      run ? statusLabel(run.status || "unknown") : "报告未提供运行状态",
      ["/run/status"],
      run ? "backend_report" : "deterministic_boundary",
    ),
  );
  if (summary?.request_count !== undefined && summary.completed_request_count !== undefined) {
    runSummary.push(
      metricItem(
        "请求完成情况",
        `${formatNumber(summary.completed_request_count, 0)} / ${formatNumber(summary.request_count, 0)}`,
        "/metrics/summary",
      ),
    );
  } else if (metrics) {
    attention.push(
      reportItem(
        "请求完成情况",
        "未报告完整的请求总数与完成数；缺失值不按 0 处理。",
        ["/metrics/summary"],
        "deterministic_boundary",
      ),
    );
  }
  if (summary?.throughput_requests_per_second !== undefined) {
    keyResults.push(
      metricItem(
        "吞吐",
        `${formatNumber(summary.throughput_requests_per_second)} req/s`,
        "/metrics/summary/throughput_requests_per_second",
      ),
    );
  }
  const p99 = metrics?.tail_latency_summary;
  if (p99?.ttft_ps?.p99_ps !== undefined) {
    keyResults.push(
      metricItem("TTFT P99", formatPicoseconds(p99.ttft_ps.p99_ps), "/metrics/tail_latency_summary/ttft_ps/p99_ps"),
    );
  }
  if (p99?.tpot_ps?.p99_ps !== undefined) {
    keyResults.push(
      metricItem("TPOT P99", formatPicoseconds(p99.tpot_ps.p99_ps), "/metrics/tail_latency_summary/tpot_ps/p99_ps"),
    );
  }
  if (runSummary.length < 5 && run?.summary?.validation_completeness !== undefined) {
    runSummary.push(
      metricItem(
        "验证完整度",
        formatPercent(run.summary.validation_completeness),
        "/run/summary/validation_completeness",
      ),
    );
  }
  if (run?.status && run.status !== "completed") {
    attention.push(
      reportItem(
        "运行未完成",
        "运行状态不是 completed；本报告只整理已提供的字段，不代表一次完整成功实验。",
        ["/run/status"],
        "deterministic_boundary",
      ),
    );
  }
  if (!metrics) {
    attention.push(
      reportItem(
        "性能指标",
        "性能指标报告缺失；吞吐与尾延迟未报告，不能当作 0。",
        ["/metrics"],
        "deterministic_boundary",
      ),
    );
  }
  if (run?.bottleneck_report) {
    const bottleneck = run.bottleneck_report;
    findings.push(
      reportItem(
        "后端瓶颈报告",
        [
          asText(bottleneck.title) || asText(bottleneck.primary_subsystem) || "已报告但未命名",
          asText(bottleneck.detail),
        ]
          .filter(Boolean)
          .join("："),
        ["/run/bottleneck_report"],
      ),
    );
  }
  if (run?.cause) findings.push(reportItem("后端原因说明", run.cause, ["/run/cause"]));
  if (provenance) {
    findings.push(
      reportItem(
        "证据范围",
        `Trace=${provenance.source_mode || "未报告"}；校准=${provenance.calibration_level || "未报告"}；允许声明=${provenance.allowed_claim_scope || "未报告"}`,
        ["/validation/trace_provenance", "/metrics/trace_provenance"],
        "deterministic_boundary",
      ),
    );
  } else {
    attention.push(
      reportItem(
        "证据范围",
        "未找到 Trace 来源与校准声明；不能据此声称真实系统验证。",
        ["/validation/trace_provenance"],
        "deterministic_boundary",
      ),
    );
  }
  const gaps = bundle.validation?.open_gaps || [];
  if (gaps.length) {
    attention.push(
      reportItem("验证缺口", `验证报告还有 ${gaps.length} 项开放缺口。`, ["/validation/open_gaps"], "backend_report"),
    );
  }

  const nextSteps: UserRunInterpretationNextStep[] = [];
  if (run?.next_action) {
    nextSteps.push({
      ...reportItem("后端下一步", run.next_action, ["/run/next_action"]),
      conditional: false,
      citations: [],
    });
  }
  nextSteps.push(
    ...validatedRecommendationItems(
      context.validatedAgentResult,
      context.artifactManifest,
      context.runId,
      context.backendIdentity,
      context.evidenceAgentBinding,
      context.currentEvidenceAgentBinding,
    ),
  );
  if (!nextSteps.length) {
    nextSteps.push({
      ...reportItem("后续建议", "暂无有依据的后续建议。", [], "deterministic_boundary"),
      conditional: false,
      citations: [],
    });
  }

  const binding = captureUserRunInterpretationBinding(context);
  const evidenceStatus = userRunInterpretationEvidenceStatus(context);
  if (evidenceStatus.manifest_status !== "verified") {
    const statusText: Record<UserRunInterpretationManifestStatus, string> = {
      verified: "证据清单已校验。",
      unavailable: "没有可用的 artifact manifest；本报告只整理已加载的结果字段。",
      run_mismatch: "artifact manifest 与当前运行身份不一致；不能把这些 artifact 归到当前运行。",
      missing: "artifact manifest 没有可用 artifact；缺失值不按 0 处理。",
      unsupported_schema: "有 artifact 使用不支持的 schema；相关证据不会被读取或套用。",
      schema_revision_mismatch: "artifact manifest 与当前 schema revision 不一致；报告不能安全导出。",
      artifact_identity_missing: "有 artifact 缺少完整身份；相关证据不会被静默采用。",
    };
    attention.unshift(
      reportItem(
        "证据清单状态",
        statusText[evidenceStatus.manifest_status],
        ["/artifact_manifest"],
        "deterministic_boundary",
      ),
    );
  }
  if (evidenceStatus.rejected_artifacts.length) {
    attention.unshift(
      reportItem(
        "被拒绝的证据",
        `artifact manifest 拒绝了 ${evidenceStatus.rejected_artifacts.length} 项 artifact；报告不会把它们当作缺失的 0。`,
        ["/artifact_manifest/rejected_artifacts"],
        "deterministic_boundary",
      ),
    );
  }
  const desEvidence = bundle.run_bound_des_evidence;
  const report: UserRunInterpretationReport = {
    schema_version: userRunInterpretationSchema,
    generated_at: context.generatedAt || new Date().toISOString(),
    generator: { name: "TileSim Web", mode: "deterministic_frontend_export", simulation_recomputation: false },
    binding,
    evidence_status: evidenceStatus,
    run_name: context.runName,
    run_status: run?.status || null,
    run_summary: runSummary.slice(0, 5),
    key_results: keyResults.slice(0, 5),
    findings: findings.slice(0, 3),
    charts: chartProjection(bundle, context.inputs, context.runId),
    attention_items: attention.slice(0, 3),
    next_steps: nextSteps.slice(0, 3),
    evidence_boundary: {
      source_mode: provenance?.source_mode || null,
      calibration_level: provenance?.calibration_level || null,
      allowed_claim_scope: provenance?.allowed_claim_scope || null,
      requested_fidelity: desEvidence?.requested_fidelity || fidelity?.range_label || null,
      resolved_fidelity: desEvidence?.resolved_fidelity || null,
      execution_mode: desEvidence?.execution_mode || null,
      note: "本报告只整理后端已报告字段与已验证条件建议，不重新执行模拟、不补造根因、不把 synthetic_trace 升级为 real_trace。",
    },
    generation_status:
      validatedRecommendationItems(
        context.validatedAgentResult,
        context.artifactManifest,
        context.runId,
        context.backendIdentity,
        context.evidenceAgentBinding,
        context.currentEvidenceAgentBinding,
      ).length > 0
        ? "deterministic_with_validated_agent_recommendation"
        : "deterministic",
  };
  return report;
}
