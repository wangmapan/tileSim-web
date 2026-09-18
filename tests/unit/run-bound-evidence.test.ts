/** @vitest-environment jsdom */

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { ArtifactManifestResponse } from "../../src/lib/api";
import { routeForView } from "../../src/app/router";
import type { RunInputs } from "../../src/contracts/report-model";
import { buildRunBoundEvidenceChain, partitionCausalAttributions } from "../../src/features/run-bound-evidence";
import { normalizeApiReports } from "../../src/lib/reports";
import { useEvidenceSelectionStore } from "../../src/stores/evidence-selection";

const runId = "run-f6b-week8";
const requestId = "req-p99";
const schemaRevision = `sha256:${"e".repeat(64)}`;

function subject(kind: "request" | "fabric_phase", id: string) {
  return kind === "request" ? { kind, id, request_id: id } : { kind, id, phase_id: id, request_id: requestId };
}

function evidenceRef(artifactId: "metrics", pointer: string, evidenceSubject = subject("request", requestId)) {
  return {
    run_id: runId,
    artifact_id: artifactId,
    schema_identity: "tilesim.metrics_report.v1",
    json_pointer: pointer,
    availability: "available",
    subject: evidenceSubject,
  };
}

function rawReports() {
  return {
    metrics: {
      schema_version: "tilesim.metrics_report.v1",
      run_id: runId,
      report_id: "week8-metrics",
      summary: {},
      request_metrics: [{ request_id: requestId, end_to_end_latency_ps: 9007199254740993123n }],
      percentile_subjects: [
        {
          metric_kind: "end_to_end_latency_ps",
          percentile: 99,
          value_ps: "9007199254740993123",
          selection_rule: "nearest_rank_backend_selected",
          selection_semantics: "single_request",
          selected_request_id: requestId,
          member_request_ids: [requestId],
          subject_refs: [subject("request", requestId)],
        },
      ],
      system_summary: {
        phase_fabric_contributions: [
          {
            request_id: requestId,
            phase_id: "phase-p99",
            memory_event_id: "memory-p99",
            device_task_id: "device-p99",
            collective_id: "collective-p99",
            not_s5_collective: false,
          },
        ],
      },
    },
    execution_envelope: {
      schema_version: "tilesim.s7_execution_envelope.v1",
      run_id: runId,
      envelope_id: "envelope-week8",
      host_path: "S7",
      evidence_refs: [],
      stages: [
        {
          stage_id: "stage-p99",
          subject_refs: [subject("request", requestId)],
          evidence_refs: [evidenceRef("metrics", "/request_metrics/0")],
        },
      ],
    },
    validation: {
      schema_version: "tilesim.validation_report.v1",
      run_id: runId,
      report_id: "week8-validation",
      validation_lane: "synthetic_consistency",
      checks: [
        {
          check_id: "check-p99",
          subject_refs: [subject("request", requestId)],
          evidence_refs: [evidenceRef("metrics", "/request_metrics/0")],
        },
      ],
    },
    tail: {
      schema_version: "tilesim.tail_cause_chain_report.v1",
      run_id: runId,
      report_id: "week8-tail-cause",
      explained_entity: { kind: "request", id: requestId },
      cause_chain: [
        {
          cause_id: "cause-p99",
          subsystem: "S6",
          subject_refs: [subject("request", requestId), subject("fabric_phase", "phase-p99")],
          evidence_refs: [
            evidenceRef(
              "metrics",
              "/system_summary/phase_fabric_contributions/0",
              subject("fabric_phase", "phase-p99"),
            ),
          ],
        },
      ],
      attribution_ranking: [
        {
          attribution_id: "attribution-p99",
          subsystem: "S6",
          subject_refs: [subject("request", requestId)],
          evidence_refs: [evidenceRef("metrics", "/request_metrics/0")],
        },
      ],
    },
    run_bound_des_evidence: {
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
      },
      state_summary: {
        schema_version: "tilesim.simulation.partitioned_des_state_summary.v1",
        logical_time_ps: "9007199254740993123",
        partition_count: 2,
        committed_event_count: "9007199254740993000",
        pending_event_count: 0,
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
      stream: { record_count: 2, total_record_count: 2, truncated: false, records: [] },
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
    },
  };
}

function manifest(status: "supported" | "legacy_compatibility" = "supported"): ArtifactManifestResponse {
  const entries = [
    ["input-runtime-trace", null, "input-runtime-trace.json", ""],
    ["metrics", "metrics", "metrics.json", "tilesim.metrics_report.v1"],
    ["validation", "validation", "validation.json", "tilesim.validation_report.v1"],
    ["tail-cause-chain", "tail", "tail-cause-chain.json", "tilesim.tail_cause_chain_report.v1"],
    ["execution-envelope", "execution_envelope", "execution-envelope.json", "tilesim.s7_execution_envelope.v1"],
    ["week8-run-evidence", "run_bound_des_evidence", "week8-run-evidence.json", "tilesim.s7_run_bound_des_evidence.v1"],
  ] as const;
  return {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: schemaRevision,
    run_id: runId,
    artifacts: entries.map(([artifactId, reportKind, fileName, schemaIdentity], index) => ({
      artifact_id: artifactId,
      report_kind: reportKind,
      file_name: fileName,
      media_type: "application/json",
      bytes: 100 + index,
      sha256: String(index + 1).repeat(64),
      schema_identity: schemaIdentity,
      contract_status: artifactId === "input-runtime-trace" ? "not_applicable" : status,
    })),
    rejected_artifacts: [],
  };
}

function inputs(): RunInputs {
  return { runtime_trace: { requests: [{ request_id: requestId }] }, topology: null };
}

function chainFor(reports = rawReports(), artifactManifest = manifest(), selectedRequestId: string | null = requestId) {
  const bundle = normalizeApiReports(reports);
  return {
    bundle,
    chain: buildRunBoundEvidenceChain({
      runId,
      requestId: selectedRequestId,
      bundle,
      inputs: inputs(),
      artifactManifest,
    }),
  };
}

describe("F6B / Week 8 request-bound evidence", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("uses the backend-selected P99 single request and exact S1/S3-S9 IDs", () => {
    const { chain } = chainFor();
    const nodes = new Map(chain.nodes.map((node) => [node.subsystem, node]));

    expect(chain.percentileSubjects[0]).toMatchObject({
      metricKind: "end_to_end_latency_ps",
      semantics: "single_request",
      selectedRequestId: requestId,
      availability: "available",
      valuePs: 9007199254740993123n,
    });
    expect(nodes.get("S1")?.entityIds).toEqual([requestId]);
    expect(nodes.get("S1")?.availability).toBe("available");
    expect(nodes.get("S3")?.entityIds).toEqual(["memory-p99"]);
    expect(nodes.get("S4")?.entityIds).toEqual(["device-p99"]);
    expect(nodes.get("S5")?.entityIds).toEqual(["collective-p99"]);
    expect(nodes.get("S6")?.entityIds).toEqual([requestId, "phase-p99"]);
    expect(nodes.get("S7")?.entityIds).toEqual(["stage-p99"]);
    expect(nodes.get("S8")?.entityIds).toEqual(["check-p99"]);
    expect(nodes.get("S9")?.entityIds).toEqual(["cause-p99", "attribution-p99"]);
    expect(nodes.get("S7")?.references).toEqual(
      expect.arrayContaining([expect.objectContaining({ jsonPointer: "/stages/0", sha256: "5".repeat(64) })]),
    );
    expect(chain.week8Execution).toMatchObject({
      availability: "available",
      requestedFidelity: "des",
      resolvedFidelity: "des",
      executionMode: "partitioned_des",
      provenance: { sourceMode: "synthetic_trace", allowedClaimScope: "synthetic_consistency" },
      stateSummary: { logicalTimePs: 9007199254740993123n, pendingEventCount: 0n },
    });
  });

  it("keeps a P99 tie as the complete member set without selecting one request", () => {
    const reports = rawReports();
    reports.metrics.percentile_subjects[0] = {
      ...reports.metrics.percentile_subjects[0],
      selection_semantics: "tie_no_single_request",
      selected_request_id: "",
      member_request_ids: ["req-a", "req-b"],
      subject_refs: [subject("request", "req-a"), subject("request", "req-b")],
    };
    reports.metrics.request_metrics.push({ request_id: "req-a", end_to_end_latency_ps: 10n });
    reports.metrics.request_metrics.push({ request_id: "req-b", end_to_end_latency_ps: 10n });
    const { chain } = chainFor(reports, manifest(), null);
    expect(chain.percentileSubjects[0]).toMatchObject({
      semantics: "tie_no_single_request",
      selectedRequestId: null,
      memberRequestIds: ["req-a", "req-b"],
      availability: "available",
    });
  });

  it("fails duplicate stable IDs closed as ambiguous_reference", () => {
    const reports = rawReports();
    reports.execution_envelope.stages.push(structuredClone(reports.execution_envelope.stages[0]));
    reports.metrics.system_summary.phase_fabric_contributions.push(
      structuredClone(reports.metrics.system_summary.phase_fabric_contributions[0]),
    );
    const { chain } = chainFor(reports);
    expect(chain.nodes.find((node) => node.subsystem === "S7")?.availability).toBe("ambiguous_reference");
    for (const subsystem of ["S3", "S4", "S5", "S6"] as const)
      expect(chain.nodes.find((node) => node.subsystem === subsystem)?.availability).toBe("ambiguous_reference");
  });

  it.each([
    ["dangling subject", "/request_metrics/0", subject("request", "req-missing")],
    ["wrong JSON Pointer", "/request_metrics/99", subject("request", requestId)],
  ])("fails a %s EvidenceRef closed", (_label, pointer, targetSubject) => {
    const reports = rawReports();
    reports.execution_envelope.stages[0].evidence_refs = [evidenceRef("metrics", pointer, targetSubject)];
    const { chain } = chainFor(reports);
    expect(chain.nodes.find((node) => node.subsystem === "S7")?.availability).toBe("invalid_reference");
  });

  it("distinguishes zero, missing, and not_applicable", () => {
    const reports = rawReports();
    reports.metrics.percentile_subjects[0] = {
      ...reports.metrics.percentile_subjects[0],
      value_ps: "0",
      selection_semantics: "not_applicable",
      selected_request_id: "",
      member_request_ids: [],
      subject_refs: [],
    };
    reports.metrics.system_summary.phase_fabric_contributions[0].device_task_id = "";
    reports.metrics.system_summary.phase_fabric_contributions[0].collective_id = "";
    reports.metrics.system_summary.phase_fabric_contributions[0].not_s5_collective = true;
    const { chain } = chainFor(reports);
    expect(chain.percentileSubjects[0]).toMatchObject({ valuePs: 0n, availability: "not_applicable" });
    expect(chain.nodes.find((node) => node.subsystem === "S4")?.availability).toBe("missing");
    expect(chain.nodes.find((node) => node.subsystem === "S5")?.availability).toBe("not_applicable");
  });

  it("shows explicit fallback as partial without upgrading synthetic provenance", () => {
    const reports = rawReports();
    reports.run_bound_des_evidence.execution_mode = "single_process_fallback";
    reports.run_bound_des_evidence.fallback = {
      policy: "single_process_reference",
      used: true,
      reason: "partition worker unavailable",
    };
    reports.run_bound_des_evidence.differential.matched = false;
    const { chain } = chainFor(reports);
    expect(chain.week8Execution).toMatchObject({
      availability: "partial",
      executionMode: "single_process_fallback",
      fallback: { used: true, reason: "partition worker unavailable" },
      provenance: { sourceMode: "synthetic_trace" },
    });
  });

  it("keeps S7-S9 out of the S0-S6 causal ranking", () => {
    const partitioned = partitionCausalAttributions([
      { attribution_id: "attr-s6", subsystem: "S6" },
      { attribution_id: "attr-s7", subsystem: "S7" },
      { attribution_id: "attr-s8", subsystem: "S8" },
      { attribution_id: "attr-s9", subsystem: "S9" },
    ]);
    expect(partitioned.causal.map(({ item }) => item.attribution_id)).toEqual(["attr-s6"]);
    expect(partitioned.outputPlane.map(({ item }) => item.attribution_id)).toEqual(["attr-s7", "attr-s8", "attr-s9"]);
  });

  it("surfaces unsupported schema and legacy compatibility without claiming closure", () => {
    const unsupported = manifest();
    unsupported.artifacts = unsupported.artifacts.filter((entry) => entry.artifact_id !== "week8-run-evidence");
    unsupported.rejected_artifacts.push({
      artifact_id: "week8-run-evidence",
      file_name: "week8-run-evidence.json",
      reason: "unsupported_schema",
      schema_identity: "tilesim.s7_run_bound_des_evidence.v999",
      json_pointer: "/schema_version",
    });
    const reports = rawReports();
    delete (reports as Partial<typeof reports>).run_bound_des_evidence;
    expect(chainFor(reports, unsupported).chain).toMatchObject({
      contractState: "unsupported_schema",
      week8Execution: { availability: "unsupported_schema" },
    });

    const legacyChain = chainFor(rawReports(), manifest("legacy_compatibility")).chain;
    expect(legacyChain.contractState).toBe("compatibility_unversioned");
    expect(legacyChain.nodes.find((node) => node.subsystem === "S7")?.availability).toBe("legacy_compatibility");
  });

  it("preserves a request only within the same run and carries it in page routes", () => {
    const selection = useEvidenceSelectionStore();
    selection.select(runId, requestId);
    selection.synchronizeRoute(runId, undefined);
    expect(selection.requestForRun(runId)).toBe(requestId);
    selection.synchronizeRoute("run-other", undefined);
    expect(selection.requestForRun("run-other")).toBeNull();
    selection.synchronizeRoute("run-other", "req-2");
    expect(routeForView("validation", "run-other", "req-2")).toEqual({
      name: "validation",
      query: { run: "run-other", evidence_request: "req-2" },
    });
  });
});
