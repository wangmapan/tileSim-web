import type {
  ApiManifestResponse,
  ArtifactManifestResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentResponse,
  HealthResponse,
} from "../../src/contracts/bridge-api";
import type { ReportBundle, RunInputs } from "../../src/contracts/report-model";
import { normalizeApiReports } from "../../src/lib/reports";
import { buildStructuredPerformanceReport } from "../../src/features/structured-report";

export const f9RunId = "run-f9-contract";
export const f9RequestId = "req-f9-p99";
export const f9SchemaRevision = "sha256:5c6653e0fd7c367300ce5eba3200575e81170911ec952557f948931c6cb545aa";

export function createEvidenceAgentDescriptor(configured = true): EvidenceAgentDescriptorResponse {
  return {
    schema_version: "tilesim.bridge.evidence_agent_descriptor.v1",
    schema_set_revision: f9SchemaRevision,
    descriptor_revision: `sha256:${"d".repeat(64)}`,
    availability: configured ? "available" : "unavailable",
    degradation: configured
      ? { state: "none", reason_code: "none", detail: "Provider configured." }
      : { state: "not_configured", reason_code: "provider_unavailable", detail: "Provider is not configured." },
    availability_predicate: {
      capability_path: "/provider/configured",
      operator: "equals",
      expected_value: true,
      evaluated_available: configured,
    },
    schema_identities: {
      request: "tilesim.bridge.evidence_agent_request.v1",
      response: "tilesim.bridge.evidence_agent_response.v1",
      citation: "tilesim.bridge.evidence_agent_citation.v1",
      snapshot_reference: "tilesim.bridge.evidence_snapshot_reference.v1",
      structured_report: "tilesim.web.structured-performance-report.v2",
    },
    provider: {
      configured,
      provider_id: configured ? "fixture-provider" : "not_configured",
      model_id: configured ? "fixture-model" : "not_configured",
      model_revision: configured ? "fixture-model-v1" : "not_configured",
    },
    revisions: { prompt_template_revision: "prompt-v1", policy_revision: "policy-v1" },
    supported_locales: ["zh-CN", "en-US"],
    supported_task_kinds: ["explain_p99", "explain_tail", "summarize_validation", "draft_conditional_recommendations"],
    limits: {
      maximum_request_bytes: 1_000_000,
      maximum_question_characters: 4000,
      maximum_artifacts: 16,
      maximum_records_per_artifact: 2048,
      maximum_claims: 128,
      maximum_output_characters: 100_000,
    },
    digest_contract: {
      algorithm: "sha256",
      output_encoding: "lowercase_hex_with_sha256_prefix",
      canonicalization: "tilesim.bridge.canonical_json.v1",
      text_encoding: "utf-8",
      object_key_order: "unicode_code_point_ascending",
      array_order: "preserved",
      separators: "comma_colon_no_whitespace",
      non_ascii_escaping: "preserve_utf8",
      integer_encoding: "canonical_decimal_json_token_lossless",
      non_finite_numbers: "forbidden",
      artifact_manifest_material: "entire_verified_manifest_object",
      input_snapshot_material_fields: [
        "schema_version",
        "schema_set_revision",
        "run_id",
        "structured_report_schema_identity",
        "snapshot_reference",
        "artifact_allow_list",
      ],
      excluded_untrusted_fields: ["locale", "task_kind", "client_request_id", "user_question"],
    } as EvidenceAgentDescriptorResponse["digest_contract"],
    tools: {
      allowed: ["verified_snapshot_read", "citation_resolution"],
      forbidden: ["shell", "arbitrary_file", "arbitrary_path", "arbitrary_http"],
      allow_list_expansion: false,
    },
    persistence: {
      mode: "run_local_terminal_metadata_only",
      retention_seconds: 3600,
      snapshot_payload_retained: false,
      user_question_retained: false,
      hidden_reasoning_retained: false,
    },
    redaction: {
      user_question: "digest_only",
      artifact_content: "not_retained",
      credentials: "never_retained",
      hidden_chain_of_thought: "never_returned_or_retained",
    },
    execution: {
      mode: "synchronous_terminal",
      timeout_ms: 30_000,
      cancellation: "not_applicable_after_synchronous_terminal_response",
      maximum_concurrent_operations: 1,
      retry: "same_idempotency_key_and_same_payload_replays_terminal_result",
      terminal_recovery: "run_local_redacted_terminal_record",
    },
  };
}

export const f9Health: HealthResponse = {
  source_revision: "source-f9",
  build_revision: "build-f9",
  source_state_digest: "source-state-f9",
  build_state_digest: "build-state-f9",
  versions_match: true,
  state_digests_match: true,
  execution_ready: true,
  cli_available: true,
};

export const f9ApiManifest: ApiManifestResponse = {
  schema_version: "tilesim.bridge.manifest.v1",
  api_version: "tilesim.bridge.api.v1",
  schema_set_revision: f9SchemaRevision,
  error_schema_version: "tilesim.bridge.error.v1",
  artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
  known_report_schema_identities: {},
  experiment_descriptor: {
    endpoint: "GET /api/experiment-schema",
    schema_identity: "tilesim.bridge.experiment_descriptor.v1",
    create_run_schema_identity: "tilesim.bridge.create_run_request.v1",
  },
  evidence_agent: {
    capability_endpoint: "GET /api/agent/evidence-capabilities",
    analysis_endpoint: "POST /api/runs/{run_id}/agent/evidence-analyses",
    descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v1",
    request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
    response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
    citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1",
    snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1",
    structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
    idempotency_header: "Idempotency-Key",
    execution_mode: "synchronous_terminal",
  },
  run_creation: {
    idempotency_header: "Idempotency-Key",
    idempotency_required: true,
    payload_identity: "canonical_json_sha256",
  },
  run_events: {
    endpoint: "GET /api/runs/{run_id}/events",
    media_type: "text/event-stream",
    resume_header: "Last-Event-ID",
    event_ids: { active: "1", terminal: "2" },
  },
  endpoints: {},
};

function subject(kind: "request" | "fabric_phase", id: string) {
  return kind === "request" ? { kind, id, request_id: id } : { kind, id, phase_id: id, request_id: f9RequestId };
}

function evidenceRef(pointer: string) {
  return {
    run_id: f9RunId,
    artifact_id: "metrics",
    schema_identity: "tilesim.metrics_report.v1",
    json_pointer: pointer,
    availability: "available",
    subject: subject("request", f9RequestId),
  };
}

export function createF9RunContext() {
  const provenance = {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
  };
  const reports = {
    metrics: {
      schema_version: "tilesim.metrics_report.v1",
      run_id: f9RunId,
      report_id: "metrics-f9",
      trace_provenance: provenance,
      summary: { request_count: 1, completed_request_count: 1 },
      request_metrics: [{ request_id: f9RequestId, end_to_end_latency_ps: "9007199254740993123" }],
      percentile_subjects: [
        {
          metric_kind: "end_to_end_latency_ps",
          percentile: 99,
          value_ps: "9007199254740993123",
          selection_rule: "nearest_rank_backend_selected",
          selection_semantics: "single_request",
          selected_request_id: f9RequestId,
          member_request_ids: [f9RequestId],
          subject_refs: [subject("request", f9RequestId)],
        },
      ],
      system_summary: {
        phase_fabric_contributions: [
          {
            request_id: f9RequestId,
            phase_id: "phase-f9",
            memory_event_id: "memory-f9",
            device_task_id: "device-f9",
            collective_id: "collective-f9",
            not_s5_collective: false,
          },
        ],
        request_fabric_contributions: [],
        fabric_domain_utilization: [],
      },
    },
    execution_envelope: {
      schema_version: "tilesim.s7_execution_envelope.v1",
      run_id: f9RunId,
      envelope_id: "envelope-f9",
      host_path: "S7",
      stages: [
        {
          stage_id: "stage-f9",
          subsystem: "S7",
          subject_refs: [subject("request", f9RequestId)],
          evidence_refs: [evidenceRef("/request_metrics/0")],
        },
      ],
    },
    validation: {
      schema_version: "tilesim.validation_report.v1",
      run_id: f9RunId,
      report_id: "validation-f9",
      validation_lane: "synthetic_consistency",
      evidence_tier: "synthetic_consistency",
      trace_provenance: provenance,
      checks: [
        {
          check_id: "check-f9",
          status: "pass",
          subsystem: "S8",
          subject_refs: [subject("request", f9RequestId)],
          evidence_refs: [evidenceRef("/request_metrics/0")],
        },
      ],
      resolution_entries: [],
      open_gaps: [],
    },
    tail: {
      schema_version: "tilesim.tail_cause_chain_report.v1",
      run_id: f9RunId,
      report_id: "tail-f9",
      explained_entity: { kind: "request", id: f9RequestId },
      cause_chain: [
        {
          cause_id: "cause-f9",
          subsystem: "S6",
          subject_refs: [subject("request", f9RequestId)],
          evidence_refs: [evidenceRef("/request_metrics/0")],
        },
      ],
      attribution_ranking: [
        {
          attribution_id: "attribution-f9",
          subsystem: "S6",
          subject_refs: [subject("request", f9RequestId)],
          evidence_refs: [evidenceRef("/request_metrics/0")],
        },
      ],
    },
    run_bound_des_evidence: {
      schema_version: "tilesim.s7_run_bound_des_evidence.v1",
      run_id: f9RunId,
      requested_fidelity: "des",
      resolved_fidelity: "des",
      execution_mode: "partitioned_des",
      fallback: { policy: "single_process_reference", used: false, reason: "" },
      provenance,
      state_summary: {
        schema_version: "tilesim.simulation.partitioned_des_state_summary.v1",
        logical_time_ps: "9007199254740993123",
        partition_count: 2,
        committed_event_count: 9,
        pending_event_count: 0,
        stream_record_count: 1,
        total_stream_record_count: 1,
        stream_records_truncated: false,
        provenance,
      },
      differential: {
        compared: true,
        matched: true,
        partitioned_digest: "partitioned",
        reference_digest: "reference",
        mismatch_code: "none",
      },
      stream: { record_count: 1, total_record_count: 1, truncated: false, records: [] },
      checkpoint: {
        archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1",
        archive_digest: "archive",
        partition_configuration_digest: "partition",
        checkpoint_logical_time_ps: "9007199254740993123",
        committed_event_count: 9,
        pending_event_count: 0,
        completed_identity_count: 1,
        subject_version_count: 1,
        payload_availability: "not_exposed",
        provenance,
      },
    },
  };
  const bundle = normalizeApiReports(reports) as ReportBundle;
  const inputs: RunInputs = {
    runtime_trace: { requests: [{ request_id: f9RequestId }], policy: {} },
    topology: null,
  };
  const artifacts = [
    ["input-runtime-trace", null, "tilesim.runtime_trace_input.v1", 97],
    ["metrics", "metrics", "tilesim.metrics_report.v1", "9007199254740993123"],
    ["validation", "validation", "tilesim.validation_report.v1", 401],
    ["tail-cause-chain", "tail", "tilesim.tail_cause_chain_report.v1", 501],
    ["execution-envelope", "execution_envelope", "tilesim.s7_execution_envelope.v1", 601],
    ["week8-run-evidence", "run_bound_des_evidence", "tilesim.s7_run_bound_des_evidence.v1", 701],
  ].map(([artifactId, reportKind, schemaIdentity, bytes], index) => ({
    artifact_id: artifactId as string,
    report_kind: reportKind as string | null,
    file_name: `${artifactId}.json`,
    media_type: "application/json" as const,
    bytes: bytes as number | string,
    sha256: String(index + 1).repeat(64),
    schema_identity: schemaIdentity as string,
    contract_status: "supported" as const,
  }));
  const manifest: ArtifactManifestResponse = {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: f9SchemaRevision,
    run_id: f9RunId,
    artifacts,
    rejected_artifacts: [],
  };
  const structuredReport = buildStructuredPerformanceReport({
    bundle,
    inputs,
    runId: f9RunId,
    runName: "F9 fixture",
    artifactManifest: manifest,
    selectedRequestId: f9RequestId,
    generatedAt: "2026-08-31T00:00:00.000Z",
  });
  return { bundle, inputs, manifest, structuredReport };
}

export function createCompletedAgentResponse(
  inputSnapshotDigest: string,
  clientRequestId: string,
  citation: EvidenceAgentResponse["claims"][number]["citations"][number],
): EvidenceAgentResponse {
  return {
    schema_version: "tilesim.bridge.evidence_agent_response.v1",
    schema_set_revision: f9SchemaRevision,
    request_id: "agent-fixture-response",
    client_request_id: clientRequestId,
    run_id: f9RunId,
    input_snapshot_digest: inputSnapshotDigest,
    completion_state: "completed",
    provider: createEvidenceAgentDescriptor(true).provider,
    revisions: createEvidenceAgentDescriptor(true).revisions,
    claims: [
      {
        claim_id: "claim-f9-1",
        claim_kind: "numeric_fact",
        text: "The cited request latency is reported without recomputation.",
        citations: [citation],
        scope: {
          source_mode: "synthetic_trace",
          requested_fidelity: "des",
          resolved_fidelity: "des",
          execution_mode: "partitioned_des",
          resource_semantics_relation: "S3_S4_S5_peer",
          causal_subsystems: ["S1", "S6"],
          attribution_semantics: "not_applicable",
          recommendation_semantics: "not_applicable",
        },
      },
    ],
    refusal: null,
    partial: false,
    truncated: false,
    degradation: { state: "none", reason_code: "none" },
    audit_summary: {
      operations: ["verified_snapshot_read", "citation_resolution"],
      tool_invocation_count: 2,
      hidden_reasoning_returned: false,
    },
    generated_at: "2026-08-31T00:00:00.000Z",
    persistence: {
      mode: "run_local_terminal_metadata_only",
      retained_until: null,
      snapshot_payload_retained: false,
      user_question_retained: false,
    },
    staleness: {
      state: "current_at_generation",
      binding_fields: ["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"],
    },
  };
}
