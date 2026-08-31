import { describe, expect, it } from "vitest";
import {
  buildStructuredPerformanceReport,
  createStructuredReportExport,
  createStructuredReportExportAsync,
  renderStructuredPerformanceReportHtml,
  type StructuredReportContext,
} from "../../src/features/structured-report";
import type { ArtifactManifestResponse } from "../../src/contracts/bridge-api";
import type { EvidenceRef, ReportBundle } from "../../src/contracts/report-model";
import { fixtureCase } from "../helpers/fixtures";
import { setLocale } from "../../src/i18n";
import { buildStructuredReportWorkerResponse } from "../../src/features/structured-report/worker-contract";

const generatedAt = "2026-08-28T01:02:03.000Z";

function context(fixtureId = "synthetic-s1-s6-complete"): StructuredReportContext {
  const fixture = fixtureCase(fixtureId);
  const manifest: ArtifactManifestResponse = {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: "sha256:test-schema-set",
    run_id: "run-report-test",
    artifacts: [
      {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: 123,
        sha256: "a".repeat(64),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      },
    ],
    rejected_artifacts: [],
  };
  return {
    bundle: fixture.reports as ReportBundle,
    inputs: fixture.inputs,
    runId: "run-report-test",
    runName: fixture.id,
    artifactManifest: manifest,
    selectedRequestId: null,
    generatedAt,
  };
}

function week8Context() {
  const reportContext = context();
  const requestId = "req-0";
  reportContext.selectedRequestId = requestId;
  reportContext.bundle.metrics!.percentile_subjects = [
    {
      metric_kind: "end_to_end_latency_ps",
      percentile: 99,
      value_ps: 9007199254740993123n,
      selection_rule: "nearest_rank_backend_selected",
      selection_semantics: "single_request",
      selected_request_id: requestId,
      member_request_ids: [requestId],
      subject_refs: [{ kind: "request", id: requestId, request_id: requestId }],
    },
  ];
  const evidenceRef = (
    jsonPointer: string,
    kind: "request" | "fabric_phase" = "request",
    id = requestId,
  ): EvidenceRef => ({
    run_id: reportContext.runId!,
    artifact_id: "metrics",
    schema_identity: "tilesim.metrics_report.v1",
    json_pointer: jsonPointer,
    availability: "available" as const,
    subject: { kind, id, request_id: requestId, ...(kind === "fabric_phase" ? { phase_id: id } : {}) },
  });
  reportContext.bundle.execution_envelope!.run_id = reportContext.runId!;
  reportContext.bundle.execution_envelope!.stages = [
    {
      stage_id: "stage-req-0",
      subsystem: "S7",
      subject_refs: [{ kind: "request", id: requestId, request_id: requestId }],
      evidence_refs: [evidenceRef("/request_metrics/0")],
    },
  ];
  reportContext.bundle.validation!.run_id = reportContext.runId!;
  reportContext.bundle.validation!.checks = [
    {
      check_id: "check-req-0",
      subsystem: "S8",
      status: "pass",
      subject_refs: [{ kind: "request", id: requestId, request_id: requestId }],
      evidence_refs: [evidenceRef("/request_metrics/0")],
    },
  ];
  reportContext.bundle.tail!.run_id = reportContext.runId!;
  reportContext.bundle.tail!.cause_chain = [
    {
      cause_id: "cause-req-0",
      subsystem: "S6",
      subject_refs: [
        { kind: "request", id: requestId, request_id: requestId },
        { kind: "fabric_phase", id: "phase-0", request_id: requestId, phase_id: "phase-0" },
      ],
      evidence_refs: [evidenceRef("/system_summary/phase_fabric_contributions/0", "fabric_phase", "phase-0")],
    },
  ];
  reportContext.bundle.tail!.attribution_ranking = [
    {
      attribution_id: "attribution-req-0",
      subsystem: "S6",
      subject_refs: [{ kind: "request", id: requestId, request_id: requestId }],
      evidence_refs: [evidenceRef("/request_metrics/0")],
    },
  ];
  reportContext.bundle.run_bound_des_evidence = {
    schema_version: "tilesim.s7_run_bound_des_evidence.v1",
    run_id: reportContext.runId!,
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
      logical_time_ps: 9007199254740993123n,
      partition_count: 2n,
      committed_event_count: 9007199254740993000n,
      pending_event_count: 0n,
      provenance: {
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency",
      },
      stream_record_count: 2n,
      total_stream_record_count: 2n,
      stream_records_truncated: false,
    },
    differential: {
      compared: true,
      matched: true,
      partitioned_digest: "partitioned-digest",
      reference_digest: "reference-digest",
      mismatch_code: "",
    },
    stream: { record_count: 2n, total_record_count: 2n, truncated: false, records: [] },
    checkpoint: {
      archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1",
      archive_digest: "archive-digest",
      partition_configuration_digest: "partition-configuration-digest",
      checkpoint_logical_time_ps: 9007199254740993123n,
      committed_event_count: 9007199254740993000n,
      pending_event_count: 0n,
      completed_identity_count: 1n,
      subject_version_count: 1n,
      payload_availability: "not_exposed",
      provenance: {
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency",
      },
    },
  };
  const artifacts = [
    ["validation", "validation", "tilesim.validation_report.v1"],
    ["tail-cause-chain", "tail", "tilesim.tail_cause_chain_report.v1"],
    ["execution-envelope", "execution_envelope", "tilesim.s7_execution_envelope.v1"],
    ["week8-run-evidence", "run_bound_des_evidence", "tilesim.s7_run_bound_des_evidence.v1"],
  ] as const;
  reportContext.artifactManifest!.artifacts.push(
    ...artifacts.map(([artifactId, reportKind, schemaIdentity], index) => ({
      artifact_id: artifactId,
      report_kind: reportKind,
      file_name: `${artifactId}.json`,
      media_type: "application/json" as const,
      bytes: 200 + index,
      sha256: String(index + 2).repeat(64),
      schema_identity: schemaIdentity,
      contract_status: "supported" as const,
    })),
  );
  return reportContext;
}

describe("structured performance report", () => {
  it("exports the complete S0-S9 evidence flow without generating agent conclusions", () => {
    const report = buildStructuredPerformanceReport(context());
    expect(report.modeled_subsystems.map((section) => section.subsystem)).toEqual([
      "S0",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
    ]);
    expect(report.execution_host_s7.stages).toHaveLength(3);
    expect(report.validation_s8.status).toBe("reported");
    expect(report.metrics_and_attribution_s9.request_metrics).toHaveLength(1);
    expect(report.performance_evidence_appendix.phase_fabric_contributions).toHaveLength(2);
    expect(report.performance_evidence_appendix.fabric_contract).toMatchObject({
      artifact_availability: "available",
      topology_join_availability: "artifact_identity_missing",
      domain_references: [
        {
          domain_id: "scale-up",
          availability: "available",
          evidence: { sourcePath: "metrics:/system_summary/fabric_domain_utilization/0" },
        },
      ],
      request_references: [
        {
          request_id: "req-0",
          dominant_phase_id: "phase-0",
          dominant_phase_evidence: { sourcePath: "metrics:/system_summary/phase_fabric_contributions/0" },
        },
      ],
    });
    expect(report.design_space_appendix.contract_capabilities.find((item) => item.key === "pareto")?.availability).toBe(
      "contract_gap",
    );
    expect(
      report.modeled_subsystems.find((section) => section.subsystem === "S3")?.structured_records[0].sourcePath,
    ).toBe("metrics:/system_summary/phase_fabric_contributions/0");
    expect(report.evidence_boundary.artifact_index[0].sha256).toBe("a".repeat(64));
    expect(report.agent_analysis).toMatchObject({
      status: "not_generated",
      root_cause_analysis: null,
      optimization_recommendations: null,
    });
  });

  it("keeps real zero distinct from missing in boundary reports", () => {
    const report = buildStructuredPerformanceReport(context("boundary-expected-absence"));
    const runtimeEvents = report.run_overview.reported_summary.find((item) => item.label === "Runtime events");
    const endToEnd = report.run_overview.reported_summary.find((item) => item.label === "端到端延迟");
    expect(runtimeEvents).toMatchObject({ value: 0, availability: "available" });
    expect(endToEnd).toMatchObject({ value: null, availability: "missing" });
  });

  it("preserves lossless ps values in the embedded machine-readable report", () => {
    const reportContext = context();
    reportContext.bundle.execution_envelope!.stages[0].start_time_ps = "90071992547409931";
    reportContext.bundle.execution_envelope!.stages[0].end_time_ps = "90071992547410931";
    const html = renderStructuredPerformanceReportHtml(buildStructuredPerformanceReport(reportContext));
    const embedded = html.match(
      /<script type="application\/json" id="tilesim-structured-report">([\s\S]+?)<\/script>/,
    )?.[1];
    expect(embedded).toBeTruthy();
    const parsed = JSON.parse(embedded!);
    expect(parsed.execution_host_s7.raw_stages[0].start_time_ps).toBe("90071992547409931");
  });

  it("exports the selected request, exact F6B references, peer resources, and Week 8 execution metadata", () => {
    const report = buildStructuredPerformanceReport(week8Context());
    expect(report.schema_version).toBe("tilesim.web.structured-performance-report.v2");
    expect(report.run_bound_evidence.selected_request_id).toBe("req-0");
    expect(report.run_bound_evidence.percentile_subjects[0]).toMatchObject({
      selection_semantics: "single_request",
      selected_request_id: "req-0",
      member_request_ids: ["req-0"],
    });
    expect(report.run_bound_evidence.nodes.map((node) => node.subsystem)).toEqual([
      "S1",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      "S9",
    ]);
    expect(report.run_bound_evidence.nodes.slice(1, 4).map((node) => node.subsystem)).toEqual(["S3", "S4", "S5"]);
    expect(report.run_bound_evidence.nodes.find((node) => node.subsystem === "S7")?.references[0]).toMatchObject({
      run_id: "run-report-test",
      artifact_id: "execution-envelope",
      schema_identity: "tilesim.s7_execution_envelope.v1",
      json_pointer: "/stages/0",
      subject: { kind: "stage", id: "stage-req-0" },
    });
    expect(report.run_bound_evidence.week8_execution).toMatchObject({
      requested_fidelity: "des",
      resolved_fidelity: "des",
      execution_mode: "partitioned_des",
      provenance: { sourceMode: "synthetic_trace", allowedClaimScope: "synthetic_consistency" },
    });
  });

  it("serializes bigint values as exact decimal strings in the embedded v2 report", () => {
    const html = renderStructuredPerformanceReportHtml(buildStructuredPerformanceReport(week8Context()));
    const embedded = html.match(
      /<script type="application\/json" id="tilesim-structured-report">([\s\S]+?)<\/script>/,
    )?.[1];
    const parsed = JSON.parse(embedded!);
    expect(parsed.run_bound_evidence.percentile_subjects[0].value_ps).toBe("9007199254740993123");
    expect(parsed.run_bound_evidence.week8_execution.state_summary.logicalTimePs).toBe("9007199254740993123");
    expect(parsed.run_bound_evidence.week8_execution.checkpoint.checkpointLogicalTimePs).toBe("9007199254740993123");
  });

  it("exports an explicit missing selection without auto-selecting the backend P99 request", () => {
    const reportContext = week8Context();
    reportContext.selectedRequestId = null;
    const report = buildStructuredPerformanceReport(reportContext);
    expect(report.run_bound_evidence).toMatchObject({
      selected_request_id: null,
      selection_availability: "missing",
      nodes: [],
    });
    expect(report.run_bound_evidence.percentile_subjects[0].selected_request_id).toBe("req-0");
    expect(renderStructuredPerformanceReportHtml(report)).toContain("未选择 request；导出不会自动选择 P99");
  });

  it("escapes document markup and embedded JSON while keeping a safe filename", () => {
    const reportContext = context();
    reportContext.runName = '</script><img src=x onerror="alert(1)"> : run';
    const exported = createStructuredReportExport(reportContext);
    expect(exported.html).not.toContain('</script><img src=x onerror="alert(1)">');
    expect(exported.html).toContain("&lt;/script&gt;&lt;img");
    expect(exported.html).toContain("\\u003c/script\\u003e");
    expect(exported.filename).not.toMatch(/[<>:"/\\|?*]/);
    expect(exported.filename).toMatch(/-structured-performance-report\.html$/);
  });

  it("keeps the asynchronous export API equivalent when Worker execution is unavailable", async () => {
    const reportContext = context();
    const synchronous = createStructuredReportExport(reportContext);
    const asynchronous = await createStructuredReportExportAsync(reportContext);
    expect(asynchronous).toEqual(synchronous);
  });

  it("builds the complete report and HTML through the Worker contract", () => {
    const response = buildStructuredReportWorkerResponse({
      requestId: "structured-report:test",
      context: context(),
      locale: "en-US",
    });
    expect(response.requestId).toBe("structured-report:test");
    expect(response.report.schema_version).toBe("tilesim.web.structured-performance-report.v2");
    expect(response.html).toContain('<html lang="en">');
    setLocale("zh-CN");
  });

  it("renders human-readable charts, complete evidence appendix, and explicit pending analysis", () => {
    const html = createStructuredReportExport(context()).html;
    expect(html).toContain("TILESIM STRUCTURED PERFORMANCE REPORT");
    expect(html).toContain("S3 / S4 / S5 并列资源语义");
    expect(html).toContain('class="export-bars"');
    expect(html).toContain('id="appendix"');
    expect(html).toContain('id="design-space"');
    expect(html).toContain("候选完整证据");
    expect(html).toContain("fixture-manifest#candidate-0");
    expect(html).toContain("Phase fabric contributions");
    expect(html).toContain("字段质量提醒");
    expect(html).toContain("具体根因");
    expect(html).toContain("尚未生成");
  });

  it("renders the human-readable document in the selected language", () => {
    setLocale("en-US");
    try {
      const html = createStructuredReportExport(context()).html;
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("Global overview");
      expect(html).toContain("Complete performance evidence details");
      expect(html).toContain("Root-cause analysis and optimization recommendations");
    } finally {
      setLocale("zh-CN");
    }
  });
});
