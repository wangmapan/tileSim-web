import type { ReportBundle } from "../../contracts/report-model";
import type { ArtifactManifestResponse } from "../../lib/api";
import { artifactAvailability, identityAware, reference } from "./evidence-references";
import type { RunBoundAvailability, Week8ExecutionSummary } from "./types";

export function buildWeek8ExecutionSummary(
  runId: string | null,
  bundle: ReportBundle,
  manifest: ArtifactManifestResponse | null,
): Week8ExecutionSummary {
  const empty = (availability: RunBoundAvailability, detail: string): Week8ExecutionSummary => ({
    availability,
    requestedFidelity: null,
    resolvedFidelity: null,
    executionMode: null,
    fallback: null,
    provenance: null,
    stateSummary: null,
    differential: null,
    stream: null,
    checkpoint: null,
    reference: null,
    detail,
  });
  const report = bundle.run_bound_des_evidence;
  if (!report) {
    const degraded = artifactAvailability(manifest, "week8-run-evidence");
    return empty(
      degraded || "missing",
      degraded === "not_applicable"
        ? "本次运行明确不适用 DES execution artifact。"
        : "当前 run 未提供 S7 execution artifact。",
    );
  }
  if (!runId || report.run_id !== runId)
    return empty("invalid_reference", "S7 execution artifact 的 run_id 与当前运行不一致。");
  let availability: RunBoundAvailability = identityAware(manifest, ["week8-run-evidence"], "available");
  if (report.fallback.used || !report.differential.matched || report.stream.truncated) availability = "partial";
  return {
    availability,
    requestedFidelity: report.requested_fidelity,
    resolvedFidelity: report.resolved_fidelity,
    executionMode: report.execution_mode,
    fallback: report.fallback,
    provenance: {
      sourceMode: report.provenance.source_mode,
      calibrationLevel: report.provenance.calibration_level,
      allowedClaimScope: report.provenance.allowed_claim_scope,
    },
    stateSummary: {
      logicalTimePs: report.state_summary.logical_time_ps,
      partitionCount: report.state_summary.partition_count,
      committedEventCount: report.state_summary.committed_event_count,
      pendingEventCount: report.state_summary.pending_event_count,
    },
    differential: {
      compared: report.differential.compared,
      matched: report.differential.matched,
      partitionedDigest: report.differential.partitioned_digest,
      referenceDigest: report.differential.reference_digest,
      mismatchCode: report.differential.mismatch_code,
    },
    stream: {
      recordCount: report.stream.record_count,
      totalRecordCount: report.stream.total_record_count,
      truncated: report.stream.truncated,
    },
    checkpoint: {
      archiveSchemaIdentity: report.checkpoint.archive_schema_identity,
      archiveDigest: report.checkpoint.archive_digest,
      partitionConfigurationDigest: report.checkpoint.partition_configuration_digest,
      checkpointLogicalTimePs: report.checkpoint.checkpoint_logical_time_ps,
      committedEventCount: report.checkpoint.committed_event_count,
      pendingEventCount: report.checkpoint.pending_event_count,
      completedIdentityCount: report.checkpoint.completed_identity_count,
      subjectVersionCount: report.checkpoint.subject_version_count,
      payloadAvailability: report.checkpoint.payload_availability,
    },
    reference: reference(manifest, "week8-run-evidence", "", "run", runId, "S7 execution artifact"),
    detail: report.fallback.used
      ? "后端明确使用 single-process fallback；以 partial 展示，不升级为 partitioned DES。"
      : "后端报告 partitioned DES，并保留 differential、stream 与 checkpoint metadata。",
  };
}
