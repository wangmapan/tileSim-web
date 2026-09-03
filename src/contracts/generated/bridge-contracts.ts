// Generated from bridge/contracts OpenAPI and JSON Schema. Do not edit by hand.

export type CreateRunRequest = {
  [k: string]: unknown;
} & {
  scenario_id: "s1_des_example";
  fidelity_policy?: "default" | "des";
  gpu_participation_mode?: "gpu_free";
  run_name?: string | null;
  overrides?: TileSimControlledS0S1S6RunOverrides;
  custom_inputs?: ControlledCustomInputsForTheHostedS1ToS6Path;
  design_space_candidates?: StrictS6OnlyDesignSpaceCandidateManifest;
  trace_package_id?: string;
};
export type GpuOptions = {
  gpu_participation_mode: "gpu_free";
  available: boolean;
  unavailable_reason: string | null;
}[];
export type InputOptions = {
  input_mode: "controls" | "json" | "trace_package";
  available: boolean;
  unavailable_reason: string | null;
}[];
export type DesignSpaceOptions = {
  design_space_mode: "built_in_synthetic" | "strict_s6_manifest";
  available: boolean;
  unavailable_reason: string | null;
}[];
export type S7RunBoundDesEvidenceV1 = {
  [k: string]: unknown;
} & {
  schema_version: "tilesim.s7_run_bound_des_evidence.v1";
  run_id: string;
  requested_fidelity: "des";
  resolved_fidelity: "des";
  execution_mode: "partitioned_des" | "single_process_fallback";
  fallback: {
    policy: "fail_closed" | "single_process_reference";
    used: boolean;
    reason: string;
  };
  provenance: Provenance;
  state_summary: {
    schema_version: "tilesim.simulation.partitioned_des_state_summary.v1";
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    logical_time_ps: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    partition_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    committed_event_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    pending_event_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    stream_record_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    total_stream_record_count: bigint;
    stream_records_truncated: boolean;
    provenance: Provenance;
    [k: string]: unknown;
  };
  differential: {
    compared: boolean;
    matched: boolean;
    partitioned_digest: string;
    reference_digest: string;
    mismatch_code: string;
  };
  stream: {
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    record_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    total_record_count: bigint;
    truncated: boolean;
    records: {
      [k: string]: unknown;
    }[];
  };
  checkpoint: {
    archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1";
    archive_digest: string;
    partition_configuration_digest: string;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    checkpoint_logical_time_ps: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    committed_event_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    pending_event_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    completed_identity_count: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    subject_version_count: bigint;
    payload_availability: "not_exposed";
    provenance: Provenance;
  };
};

export interface BridgeApiContracts {
  manifest?: ApiManifestResponse;
  error?: ErrorResponse;
  artifactManifest?: ArtifactManifestResponse;
  createRunRequest?: CreateRunRequest;
  runOverrides?: TileSimControlledS0S1S6RunOverrides;
  customRunInputs?: ControlledCustomInputsForTheHostedS1ToS6Path;
  runtimeTraceInput?: ControlledS1RuntimeTraceRequestInput;
  topologyRequestInput?: ControlledPreMaterializationS6TopologyRequestInput;
  designSpaceCandidates?: StrictS6OnlyDesignSpaceCandidateManifest;
  experimentDescriptor?: ExperimentDescriptorResponse;
  tracePackageCatalog?: TracePackageCatalogResponse;
  tracePackageInspect?: TracePackageInspectResponse;
  run?: ApiRun;
  runList?: RunListResponse;
  reports?: ReportsResponse;
  metricsReport?: MetricsReportV1;
  designSpaceReport?: DesignSpaceReportV1;
  topologyInput?: S6TopologyInputV1;
  tailCauseChainReport?: TailCauseChainReportV1;
  executionEnvelope?: S7ExecutionEnvelopeV1;
  validationReport?: ValidationReportV1;
  week8RunEvidence?: S7RunBoundDesEvidenceV1;
  evidenceAgentDescriptor?: EvidenceAgentDescriptor;
  evidenceAgentRequest?: EvidenceAgentRequest;
  evidenceAgentResponse?: EvidenceAgentResponse;
  evidenceAgentCitation?: EvidenceAgentCitation;
}
export interface ApiManifestResponse {
  schema_version: "tilesim.bridge.manifest.v1";
  api_version: "tilesim.bridge.api.v1";
  schema_set_revision: string;
  error_schema_version: "tilesim.bridge.error.v1";
  artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2";
  known_report_schema_identities: {
    [k: string]: string[];
  };
  experiment_descriptor: {
    endpoint: "GET /api/experiment-schema";
    schema_identity: "tilesim.bridge.experiment_descriptor.v1";
    create_run_schema_identity: "tilesim.bridge.create_run_request.v1";
  };
  trace_packages: {
    catalog_endpoint: "GET /api/trace-packages";
    inspect_endpoint: "POST /api/trace-packages/{package_id}/inspect";
    package_schema_identity: "tilesim.trace_package.v1alpha1";
    catalog_schema_identity: "tilesim.bridge.trace_package_catalog.v1";
    inspect_schema_identity: "tilesim.bridge.trace_package_inspect.v1";
    /**
     * @minItems 1
     * @maxItems 1
     */
    submission_source_modes: ["synthetic_trace"];
  };
  evidence_agent: {
    capability_endpoint: "GET /api/agent/evidence-capabilities";
    analysis_endpoint: "POST /api/runs/{run_id}/agent/evidence-analyses";
    descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2";
    descriptor_revision: "sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357";
    request_schema_identity: "tilesim.bridge.evidence_agent_request.v1";
    response_schema_identity: "tilesim.bridge.evidence_agent_response.v1";
    citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1";
    snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1";
    structured_report_schema_identity: "tilesim.web.structured-performance-report.v2";
    idempotency_header: "Idempotency-Key";
    execution_mode: "synchronous_terminal";
  };
  run_creation: {
    idempotency_header: "Idempotency-Key";
    idempotency_required: true;
    payload_identity: "canonical_json_sha256";
  };
  run_events: {
    endpoint: "GET /api/runs/{run_id}/events";
    media_type: "text/event-stream";
    resume_header: "Last-Event-ID";
    event_ids: {
      active: "1";
      terminal: "2";
    };
  };
  endpoints: {
    [k: string]: string;
  };
  legacy_unversioned?: boolean;
}
export interface ErrorResponse {
  schema_version: "tilesim.bridge.error.v1";
  error: {
    code: string;
    message: string;
    field_path: string | null;
    retryable: boolean;
  };
  request_id: string;
}
export interface ArtifactManifestResponse {
  schema_version: "tilesim.bridge.artifact_manifest.v2";
  api_version: "tilesim.bridge.api.v1";
  schema_set_revision: string;
  run_id: string;
  artifacts: ArtifactManifestEntry[];
  rejected_artifacts: RejectedArtifactManifestEntry[];
}
export interface ArtifactManifestEntry {
  artifact_id: string;
  report_kind: string | null;
  file_name: string;
  media_type: "application/json";
  bytes: number;
  sha256: string;
  schema_identity: string;
  contract_status: "supported" | "legacy_compatibility" | "not_applicable";
}
export interface RejectedArtifactManifestEntry {
  artifact_id: string;
  file_name: string;
  reason: "invalid_json" | "unsupported_schema" | "run_binding_mismatch" | "self_hash_cycle" | "contract_violation";
  schema_identity: string;
  json_pointer: string;
}
export interface TileSimControlledS0S1S6RunOverrides {
  runtime?: {
    batch_scheduler?: "fifo" | "decode_priority" | "fabric_backpressure_aware";
    max_batch_size?: number;
    kv_capacity_tokens?: number;
  };
  workload?: {
    message_size_multiplier?: number;
  };
  fabric?: {
    scale_up_bandwidth_gbps?: number;
    scale_up_latency_us?: number;
    scale_out_bandwidth_gbps?: number;
    scale_out_latency_us?: number;
  };
}
export interface ControlledCustomInputsForTheHostedS1ToS6Path {
  runtime_trace: ControlledS1RuntimeTraceRequestInput;
  topology: ControlledPreMaterializationS6TopologyRequestInput;
}
export interface ControlledS1RuntimeTraceRequestInput {
  trace_name?: string;
  trace_provenance?: {
    source_mode: "synthetic_trace";
    calibration_level: "uncalibrated" | "partially_calibrated";
    allowed_claim_scope:
      | "exploratory"
      | "exploratory_s6_only"
      | "synthetic_consistency"
      | "synthetic_consistency_only"
      | "workflow_consistency_only";
    source_id?: string;
    generation_path?: string;
    capture_or_generation_time?: string;
    upstream_tooling?: string;
    trace_kind?: string;
    /**
     * @maxItems 64
     */
    notes?: string[];
  };
  policy: {
    kv_capacity_tokens?: number;
    initial_kv_tokens?: number;
    max_active_requests?: number;
    max_batch_size?: number;
    batch_scheduler?: "fifo" | "decode_priority" | "fabric_backpressure_aware";
    prefill_starvation_threshold_ps?: number;
    pd_handoff_delay_ps?: number;
    pd_handoff_queue_service_ps?: number;
    kv_page_size_tokens?: number;
    kv_fragmentation_overhead?: number;
    kv_admission_watermark?: number;
    fabric_backpressure_active?: boolean;
    fabric_backpressure_delay_us?: number;
    fabric_backpressure_throttle_threshold_us?: number;
    fabric_backpressure_prefill_batch_limit?: number;
    long_context_threshold_tokens?: number;
    decode_penalty_per_threshold?: number;
  };
  /**
   * @minItems 1
   * @maxItems 1024
   */
  requests: [
    {
      request_id: string;
      model_id?: string;
      arrival_time_ps?: number;
      phase?: "prefill" | "decode";
      prompt_tokens?: number;
      decode_tokens?: number;
      kv_tokens?: number;
      priority_class?: number;
      tp_degree?: number;
      /**
       * @maxItems 1024
       */
      participants?: string[];
      collective_type?: string;
      message_size_bytes?: number;
      placement_group_id?: string;
      disaggregation_group_id?: string;
      kv_handoff_id?: string;
    },
    ...{
      request_id: string;
      model_id?: string;
      arrival_time_ps?: number;
      phase?: "prefill" | "decode";
      prompt_tokens?: number;
      decode_tokens?: number;
      kv_tokens?: number;
      priority_class?: number;
      tp_degree?: number;
      /**
       * @maxItems 1024
       */
      participants?: string[];
      collective_type?: string;
      message_size_bytes?: number;
      placement_group_id?: string;
      disaggregation_group_id?: string;
      kv_handoff_id?: string;
    }[],
  ];
}
export interface ControlledPreMaterializationS6TopologyRequestInput {
  scenario_name?: string;
  provenance?: {
    source_mode: "synthetic_trace";
    calibration_level: "uncalibrated" | "partially_calibrated";
    allowed_claim_scope:
      | "exploratory"
      | "exploratory_s6_only"
      | "synthetic_consistency"
      | "synthetic_consistency_only"
      | "workflow_consistency_only";
  };
  topology: {
    topology_name?: string;
    routing_policies?: StringMap;
    transport_policies?: StringMap;
    calibration_profiles?: StringMap;
    /**
     * @maxItems 1024
     */
    devices: {
      device_id: string;
      device_type?: string;
      group_id?: string;
    }[];
    /**
     * @maxItems 100000
     */
    links?: {
      src_device: string;
      dst_device: string;
      domain_id: string;
      bandwidth_gbps?: number;
      latency_us?: number;
    }[];
    /**
     * @maxItems 64
     */
    module_bindings: {
      module_name: string;
      module_version?: string;
      module_kind: "scale_up" | "scale_out";
      config_profile?: string;
      override_params?: {
        bandwidth_gbps?: number;
        latency_us?: number;
        queue_factor?: number;
        oversubscription_factor?: number;
      };
    }[];
    /**
     * @maxItems 64
     */
    domains: {
      domain_id: string;
      domain_type: "scale_up" | "scale_out";
      /**
       * @maxItems 1024
       */
      member_devices: string[];
      module_binding: string;
      default_fidelity?: "analytical" | "des";
      failure_policy?: "fallback" | "fail_closed";
    }[];
  };
  workload?: {
    /**
     * @maxItems 100000
     */
    requests: {
      request_id: string;
      batch_id?: string;
      phase?: "prefill" | "decode";
      collective_type?: string;
      message_size_bytes?: number;
      message_size_mb?: number;
      tp_degree?: number;
      /**
       * @maxItems 1024
       */
      participants?: string[];
      release_time_ps?: number;
      memory_latency_ps?: number;
      device_latency_ps?: number;
    }[];
  };
}
export interface StringMap {
  [k: string]: string | number | boolean;
}
export interface StrictS6OnlyDesignSpaceCandidateManifest {
  schema_version: "tilesim.design_space.s6_candidates.v1";
  manifest_id: string;
  source_mode: "synthetic_trace";
  calibration_level: "uncalibrated" | "partially_calibrated";
  allowed_claim_scope:
    | "exploratory"
    | "exploratory_s6_only"
    | "synthetic_consistency"
    | "synthetic_consistency_only"
    | "workflow_consistency_only";
  /**
   * @minItems 1
   * @maxItems 256
   */
  candidates: [
    {
      candidate_id: string;
      name: string;
      bandwidth_gbps: number;
      latency_us: number;
      oversubscription_factor: number;
      request_count: number;
      message_bytes: number;
      release_interval_ps: number;
      uncertainty_score: number;
      tail_risk: boolean;
      promotion_hint?: string;
      source_id: string;
    },
    ...{
      candidate_id: string;
      name: string;
      bandwidth_gbps: number;
      latency_us: number;
      oversubscription_factor: number;
      request_count: number;
      message_bytes: number;
      release_interval_ps: number;
      uncertainty_score: number;
      tail_risk: boolean;
      promotion_hint?: string;
      source_id: string;
    }[],
  ];
}
export interface ExperimentDescriptorResponse {
  schema_version: "tilesim.bridge.experiment_descriptor.v1";
  schema_set_revision: string;
  descriptor_id: string;
  descriptor_revision: string;
  create_run_schema_identity: "tilesim.bridge.create_run_request.v1";
  scenarios: {
    scenario_id: string;
    label: string;
    available: boolean;
    unavailable_reason: string | null;
  }[];
  requested_fidelity_options: {
    fidelity_policy: "default" | "des" | "cycle";
    requested_tier: "policy_default" | "DES" | "Cycle";
    available: boolean;
    unavailable_reason: string | null;
    capability_predicate: CapabilityPredicate | null;
  }[];
  gpu_participation_modes: GpuOptions;
  input_modes: InputOptions;
  design_space_modes: DesignSpaceOptions;
  /**
   * @minItems 3
   * @maxItems 3
   */
  source_mode_options: [
    {
      source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
      available: boolean;
      unavailable_reason: string | null;
      allowed_claim_scope: string;
      calibration_requirement: string;
      applicable_input_modes: ("controls" | "json" | "trace_package")[];
      capability_predicate: CapabilityPredicate | null;
    },
    {
      source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
      available: boolean;
      unavailable_reason: string | null;
      allowed_claim_scope: string;
      calibration_requirement: string;
      applicable_input_modes: ("controls" | "json" | "trace_package")[];
      capability_predicate: CapabilityPredicate | null;
    },
    {
      source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
      available: boolean;
      unavailable_reason: string | null;
      allowed_claim_scope: string;
      calibration_requirement: string;
      applicable_input_modes: ("controls" | "json" | "trace_package")[];
      capability_predicate: CapabilityPredicate | null;
    },
  ];
  parameter_groups: {
    group_id: string;
    subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
    display_order: number;
    status: "exposed" | "not_exposed" | "unsupported";
  }[];
  /**
   * @minItems 7
   * @maxItems 7
   */
  subsystem_parameter_coverage: [
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
    {
      subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
      status: "exposed" | "not_exposed" | "unsupported";
      parameter_field_ids: string[];
      reason: string | null;
    },
  ];
  /**
   * @minItems 8
   * @maxItems 8
   */
  parameter_descriptors: [
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
    ParameterDescriptor,
  ];
  resolved_fidelity_source: "run_execution_envelope_and_validation_reports";
}
export interface CapabilityPredicate {
  capability_path: string;
  operator: "equals" | "contains";
  expected_value: string | boolean;
  evaluated_available: boolean;
}
export interface ParameterDescriptor {
  field_id: string;
  subsystem: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
  group_id: string;
  display_order: number;
  request_json_pointer: string;
  value_type: "integer" | "number" | "boolean" | "string" | "enum";
  enum_values: string[];
  minimum: number | number | null;
  maximum: number | number | null;
  minimum_inclusive: boolean;
  maximum_inclusive: boolean;
  integer_only: boolean;
  step: number | number | null;
  unit: string;
  required: boolean;
  explicit_default_available: boolean;
  default_value?: number | number | boolean | string | null;
  capability_predicate: CapabilityPredicate;
  available: boolean;
  unavailable_reason: string | null;
  applicable_input_modes: ("controls" | "json")[];
  applicable_scenarios: string[];
}
export interface TracePackageCatalogResponse {
  schema_version: "tilesim.bridge.trace_package_catalog.v1";
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1";
  schema_set_revision: string;
  backend_identity: TracePackageBackendIdentity;
  capability: TracePackageCapability;
  packages: TracePackageItem[];
  discovery_errors: TracePackageError[];
}
export interface TracePackageBackendIdentity {
  source_revision?: string;
  build_revision?: string;
  source_state_digest?: string;
  build_state_digest?: string;
  versions_match?: boolean;
  state_digests_match?: boolean;
  deployment_mode?: string;
  deployment_ref?: string;
}
export interface TracePackageCapability {
  available: boolean;
  reason: string | null;
}
export interface TracePackageItem {
  package_id: string;
  producer?: TracePackageProducer;
  experiment_id?: string;
  physical_run_id?: string;
  entry_boundary?: "S0" | "S1" | "S2" | "S3" | "S4" | "S5";
  entry_trace_kind?:
    "s0_workload" | "s1_runtime" | "s2_execution" | "s2_kernel" | "s3_memory" | "s4_device" | "s5_collective";
  trace_provenance?: TracePackageProvenance;
  manifest_sha256: string;
  inspect_status: "valid" | "invalid";
  inspect_errors: TracePackageError[];
  submission_available: boolean;
  unavailable_reason: string | null;
  artifact_integrity: TracePackageArtifactIntegrity;
}
export interface TracePackageProducer {
  name: string;
  version: string;
}
export interface TracePackageProvenance {
  source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
  calibration_level: "uncalibrated" | "partially_calibrated" | "calibrated" | "held_out_validated";
  allowed_claim_scope: "exploratory" | "comparative" | "calibrated_prediction" | "held_out_validation";
  source_id: string;
  generation_path: string;
  capture_or_generation_time: string;
  upstream_tooling: string;
  trace_kind: "trace_package";
  /**
   * @minItems 1
   */
  notes: [string, ...string[]];
}
export interface TracePackageError {
  candidate?: string;
  code: string;
  message: string;
}
export interface TracePackageArtifactIntegrity {
  complete: boolean;
  semantic_artifact_count: number;
  semantic_roles: ("request" | "batch" | "iteration" | "tile_execution" | "kv_cache" | "network_flow")[];
  sha256_verified: boolean;
  entry_trace_verified: boolean;
}
export interface TracePackageInspectResponse {
  schema_version: "tilesim.bridge.trace_package_inspect.v1";
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1";
  schema_set_revision: string;
  backend_identity: TracePackageBackendIdentity;
  package: TracePackageItem;
}
export interface ApiRun {
  run_id: string;
  run_name?: string | null;
  status?: "preparing" | "running" | "completed" | "failed" | "incomplete";
  input_mode?: "controls" | "json" | "trace_package" | "legacy";
  created_at?: string;
  finished_at?: string;
  scenario_id?: string;
  fidelity_policy?: string;
  gpu_participation_mode?: string;
  design_space_mode?: string;
  trace_package?: {
    package_id: string;
    manifest_sha256: string;
    entry_boundary: "S0" | "S1" | "S2" | "S3" | "S4" | "S5";
    entry_trace_kind: string;
    trace_provenance: {
      [k: string]: unknown;
    };
  };
  error?: string;
  failure_code?: string;
  exit_code?: number;
  digest?: {
    end_to_end_latency_us?: number | null;
    throughput_requests_per_second?: number | null;
    completed_request_count?: number | null;
    request_count?: number | null;
    validation_lane?: string | null;
    evidence_tier?: string | null;
    [k: string]: unknown;
  };
  idempotent_replay?: boolean;
  [k: string]: unknown;
}
export interface RunListResponse {
  runs: ApiRun[];
}
export interface ReportsResponse {
  run_id: string;
  reports: {
    [k: string]: unknown;
  };
}
export interface MetricsReportV1 {
  schema_version: "tilesim.metrics_report.v1";
  run_id: string;
  request_metrics: {
    request_id: string;
    [k: string]: unknown;
  }[];
  percentile_subjects: {
    metric_kind: "ttft_ps" | "tpot_ps" | "end_to_end_latency_ps";
    percentile: 50 | 95 | 99;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    value_ps: bigint;
    selection_rule: string;
    selection_semantics: "single_request" | "tie_no_single_request" | "not_applicable";
    selected_request_id: string;
    member_request_ids: string[];
    subject_refs: SubjectRef[];
  }[];
  system_summary: {
    fabric_domain_utilization: {
      domain_id: string;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      record_count: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      busy_time_ps: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      observation_window_ps: bigint;
      /**
       * @minItems 1
       */
      subject_refs: [SubjectRef, ...SubjectRef[]];
      topology_domain_ref: EvidenceRef;
      [k: string]: unknown;
    }[];
    phase_fabric_contributions: {
      request_id: string;
      phase_id: string;
      memory_event_id: string;
      device_task_id: string;
      collective_id: string;
      not_s5_collective: boolean;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface SubjectRef {
  kind:
    | "run"
    | "request"
    | "fabric_phase"
    | "memory_event"
    | "device_task"
    | "collective"
    | "cause"
    | "attribution"
    | "stage"
    | "check"
    | "candidate"
    | "fabric_domain"
    | "objective"
    | "executed_s6_knob"
    | "backend_run_instance";
  id: string;
  request_id?: string;
  phase_id?: string;
  memory_event_id?: string;
  device_task_id?: string;
  collective_id?: string;
  cause_id?: string;
  attribution_id?: string;
  stage_id?: string;
  check_id?: string;
  candidate_id?: string;
  fabric_domain_id?: string;
  objective_id?: string;
  knob_id?: string;
  backend_run_instance_id?: string;
}
export interface EvidenceRef {
  run_id: string;
  artifact_id:
    | "metrics"
    | "tail-cause-chain"
    | "execution-envelope"
    | "validation"
    | "week8-run-evidence"
    | "design-space"
    | "input-topology";
  schema_identity: string;
  json_pointer: string;
  availability:
    | "available"
    | "partial"
    | "run_scope_only"
    | "not_applicable"
    | "missing"
    | "contract_gap"
    | "artifact_identity_missing"
    | "ambiguous_reference"
    | "not_covered"
    | "unsupported_schema"
    | "unresolved_not_executed";
  subject: SubjectRef;
}
export interface DesignSpaceReportV1 {
  schema_version: "tilesim.design_space_report.v1";
  contract_version?: "tilesim.design_space_report.v1";
  run_id: string;
  report_id: string;
  execution_scope: "S6_only";
  provenance: Provenance;
  validation_lane: string;
  evidence_tier: string;
  claim_scope_summary: string;
  pareto_front_id: string;
  objective_set_id: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  candidate_count: bigint;
  candidates: {
    candidate_id: string;
    requested_fidelity: "analytical" | "des";
    resolved_fidelity: "analytical" | "des";
    /**
     * @minItems 1
     */
    subject_refs: [SubjectRef, ...SubjectRef[]];
    /**
     * @minItems 1
     */
    evidence_refs: [EvidenceRef, ...EvidenceRef[]];
    navigation: {
      navigation_scope: "artifact_record";
      bridge_run_id: null;
      backend_run_instance_id: string;
      parent_run_id: string;
      candidate_id: string;
      record_ref: EvidenceRef;
    };
    pareto_front_id: string;
    objective_set_id: string;
    pareto_member: boolean | null;
    dominated_by_candidate_ids: string[];
    dominates_candidate_ids: string[];
    dominance_status: "non_dominated" | "dominated" | "insufficient_objectives" | "not_evaluated";
    dominance_reason_code: string;
    objectives: {
      [k: string]: unknown;
    }[];
    executed_s6_knobs: {
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface Provenance {
  source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
  calibration_level: string;
  allowed_claim_scope: string;
  [k: string]: unknown;
}
export interface S6TopologyInputV1 {
  schema_version: "tilesim.s6_topology_input.v1";
  run_id: string;
  provenance: Provenance;
  topology: {
    topology_name: string;
    devices: {
      [k: string]: unknown;
    }[];
    module_bindings: {
      [k: string]: unknown;
    }[];
    domains: {
      domain_id: string;
      domain_type: string;
      domain_kind: string;
      subject: SubjectRef;
      json_pointer: string;
      provenance: Provenance;
      member_devices?: string[];
      module_binding?: string;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface TailCauseChainReportV1 {
  schema_version: "tilesim.tail_cause_chain_report.v1";
  run_id: string;
  cause_chain: {
    cause_id: string;
    subject_refs: SubjectRef[];
    evidence_refs: EvidenceRef[];
    [k: string]: unknown;
  }[];
  attribution_ranking: {
    attribution_id: string;
    subject_refs: SubjectRef[];
    evidence_refs: EvidenceRef[];
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface S7ExecutionEnvelopeV1 {
  schema_version: "tilesim.s7_execution_envelope.v1";
  run_id: string;
  evidence_refs: EvidenceRef[];
  stages: {
    stage_id: string;
    subject_refs: SubjectRef[];
    evidence_refs: EvidenceRef[];
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface ValidationReportV1 {
  schema_version: "tilesim.validation_report.v1";
  run_id: string;
  checks: {
    check_id: string;
    subject_refs: SubjectRef[];
    evidence_refs: EvidenceRef[];
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface EvidenceAgentDescriptor {
  schema_version: "tilesim.bridge.evidence_agent_descriptor.v2";
  schema_set_revision: string;
  descriptor_revision: string;
  availability: "available" | "degraded" | "unavailable" | "disabled";
  degradation: {
    state: "none" | "not_configured" | "temporarily_unavailable" | "disabled_by_policy";
    reason_code: "none" | "provider_unavailable" | "provider_disabled";
    detail: string;
  };
  availability_predicate: {
    capability_path: "/provider/configured";
    operator: "equals";
    expected_value: true;
    evaluated_available: boolean;
  };
  schema_identities: {
    request: "tilesim.bridge.evidence_agent_request.v1";
    response: "tilesim.bridge.evidence_agent_response.v1";
    citation: "tilesim.bridge.evidence_agent_citation.v1";
    snapshot_reference: "tilesim.bridge.evidence_snapshot_reference.v1";
    structured_report: "tilesim.web.structured-performance-report.v2";
  };
  provider: Provider;
  revisions: Revisions;
  supported_locales: ("en-US" | "zh-CN")[];
  supported_task_kinds: (
    "explain_p99" | "explain_tail" | "summarize_validation" | "draft_conditional_recommendations"
  )[];
  limits: {
    maximum_request_bytes: number;
    maximum_question_characters: number;
    maximum_artifacts: number;
    maximum_records_per_artifact: number;
    maximum_claims: number;
    maximum_output_characters: number;
  };
  digest_contract: {
    algorithm: "sha256";
    output_encoding: "lowercase_hex_with_sha256_prefix";
    canonicalization: "tilesim.bridge.canonical_json.v1";
    text_encoding: "utf-8";
    object_key_order: "unicode_code_point_ascending";
    array_order: "preserved";
    separators: "comma_colon_no_whitespace";
    non_ascii_escaping: "preserve_utf8";
    integer_encoding: "canonical_decimal_json_token_lossless";
    non_finite_numbers: "forbidden";
    artifact_manifest_material: "entire_verified_manifest_object";
    /**
     * @minItems 6
     * @maxItems 6
     */
    input_snapshot_material_fields: never[];
    /**
     * @minItems 4
     * @maxItems 4
     */
    excluded_untrusted_fields: never[];
  };
  tools: {
    allowed: ("verified_snapshot_read" | "citation_resolution")[];
    forbidden: string[];
    allow_list_expansion: false;
  };
  persistence: PersistencePolicy;
  redaction: {
    user_question: "not_retained";
    snapshot_payload: "not_retained";
    artifact_payload: "not_retained";
    provider_raw_response: "not_retained";
    validated_model_claims: "memory_only_until_process_exit";
    credentials: "never_retained";
    hidden_chain_of_thought: "never_returned_or_retained";
  };
  execution: {
    mode: "synchronous_terminal";
    timeout_ms: number;
    cancellation: "not_applicable_after_synchronous_terminal_response";
    maximum_concurrent_operations: 1;
    retry: RetryPolicy;
    terminal_recovery: TerminalRecoveryPolicy;
  };
}
export interface Provider {
  configured: boolean;
  provider_id: string;
  model_id: string;
  model_revision: string;
}
export interface Revisions {
  prompt_template_revision: string;
  policy_revision: string;
}
export interface PersistencePolicy {
  mode: {
    storage_scope: "run_local";
    record_kind: "redacted_terminal_metadata_only";
    record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2";
  };
  retention_seconds: number;
  terminal_classes: {
    claim_free_bridge_terminal: {
      terminal_metadata_retained: true;
      exact_response_recoverable_after_restart: true;
    };
    claims_bearing_terminal: {
      terminal_metadata_retained: true;
      validated_model_claims_retained: false;
      exact_response_recoverable_after_restart: false;
    };
    claim_free_provider_terminal: {
      terminal_metadata_retained: true;
      validated_provider_response_retained: false;
      exact_response_recoverable_after_restart: false;
    };
  };
  payload_retention: {
    user_question_retained: false;
    snapshot_payload_retained: false;
    artifact_payload_retained: false;
    provider_raw_response_retained: false;
    validated_model_claims_retained: false;
    credentials_retained: false;
    hidden_reasoning_retained: false;
  };
}
export interface RetryPolicy {
  payload_identity: "tilesim.bridge.canonical_json.v1_sha256";
  same_key_same_canonical_payload: {
    in_process: "exact_terminal_replay";
    after_restart_claim_free_bridge_terminal: "exact_terminal_replay_from_redacted_record";
    after_restart_claims_bearing_terminal: "error_terminal_result_not_retained";
    after_restart_claim_free_provider_terminal: "error_terminal_result_not_retained";
    provider_reinvocation: "forbidden";
  };
  same_key_different_canonical_payload: ErrorOutcome & {
    code?: "idempotency_payload_mismatch";
    [k: string]: unknown;
  };
}
export interface ErrorOutcome {
  outcome: "error";
  http_status: 409;
  code: "idempotency_payload_mismatch" | "terminal_result_not_retained";
  field_path: "/headers/Idempotency-Key";
  retryable: false;
}
export interface TerminalRecoveryPolicy {
  record_scope: "run_local";
  record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2";
  claim_free_bridge_terminal: {
    outcome: "exact_terminal_replay";
    source: "redacted_terminal_metadata";
  };
  claims_bearing_terminal: ErrorOutcome & {
    code?: "terminal_result_not_retained";
    [k: string]: unknown;
  };
  claim_free_provider_terminal: ErrorOutcome & {
    code?: "terminal_result_not_retained";
    [k: string]: unknown;
  };
  provider_reinvocation: "forbidden";
}
export interface EvidenceAgentRequest {
  schema_version: "tilesim.bridge.evidence_agent_request.v1";
  schema_set_revision: string;
  run_id: string;
  input_snapshot_digest: string;
  structured_report_schema_identity: "tilesim.web.structured-performance-report.v2";
  snapshot_reference: SnapshotReference;
  /**
   * @minItems 1
   * @maxItems 16
   */
  artifact_allow_list:
    | [ArtifactAllowListEntry]
    | [ArtifactAllowListEntry, ArtifactAllowListEntry]
    | [ArtifactAllowListEntry, ArtifactAllowListEntry, ArtifactAllowListEntry]
    | [ArtifactAllowListEntry, ArtifactAllowListEntry, ArtifactAllowListEntry, ArtifactAllowListEntry]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ]
    | [
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
        ArtifactAllowListEntry,
      ];
  locale: "en-US" | "zh-CN";
  task_kind: "explain_p99" | "explain_tail" | "summarize_validation" | "draft_conditional_recommendations";
  client_request_id: string;
  user_question: {
    content: string;
    trust_level: "untrusted_user_content";
  };
}
export interface SnapshotReference {
  schema_version: "tilesim.bridge.evidence_snapshot_reference.v1";
  artifact_manifest_schema_identity: "tilesim.bridge.artifact_manifest.v2";
  artifact_manifest_canonical_sha256: string;
  backend_identity: {
    source_revision: string;
    build_revision: string;
    source_state_digest: string;
    build_state_digest: string;
    versions_match: boolean;
    state_digests_match: boolean;
  };
  evidence_scope: EvidenceScope;
}
export interface EvidenceScope {
  source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
  calibration_level: string;
  allowed_claim_scope: string;
  claim_scope_class:
    "synthetic_consistency" | "exploratory" | "compatibility_only" | "real_trace_calibrated" | "held_out_validated";
  requested_fidelity: "policy_default" | "analytical" | "des";
  resolved_fidelity: "analytical" | "des" | "mixed" | "not_applicable";
  execution_mode: "analytical" | "des" | "partitioned_des" | "single_process_fallback" | "mixed" | "not_applicable";
  canonical_flow: "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6";
  resource_semantics_relation: "S3_S4_S5_peer";
  execution_host: "S7";
  validation_plane: "S8";
  output_plane: "S9";
  percentile_subject: PercentileSubject;
  availability_states_present: (
    "available" | "missing" | "expected_absence" | "not_covered" | "unsupported_schema" | "not_applicable"
  )[];
}
export interface PercentileSubject {
  selection_semantics: "single_request" | "tie_no_single_request" | "not_applicable" | "missing";
  selected_request_id: string | null;
  member_request_ids: string[];
}
export interface ArtifactAllowListEntry {
  run_id: string;
  artifact_id: string;
  schema_identity: string;
  sha256: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  bytes: bigint;
  /**
   * @minItems 1
   * @maxItems 2048
   */
  allowed_records: [AllowedRecord, ...AllowedRecord[]];
}
export interface AllowedRecord {
  json_pointer: string;
  subject: Subject;
}
export interface Subject {
  kind:
    | "run"
    | "request"
    | "fabric_phase"
    | "memory_event"
    | "device_task"
    | "collective"
    | "cause"
    | "attribution"
    | "stage"
    | "check"
    | "candidate"
    | "fabric_domain"
    | "objective"
    | "executed_s6_knob";
  id: string;
}
export interface EvidenceAgentResponse {
  schema_version: "tilesim.bridge.evidence_agent_response.v1";
  schema_set_revision: string;
  request_id: string;
  client_request_id: string;
  run_id: string;
  input_snapshot_digest: string;
  completion_state: "completed" | "refused" | "partial" | "truncated" | "failed" | "timeout" | "cancelled";
  provider: Provider1;
  revisions: {
    prompt_template_revision: string;
    policy_revision: string;
  };
  /**
   * @maxItems 128
   */
  claims: Claim[];
  refusal: null | Refusal;
  partial: boolean;
  truncated: boolean;
  degradation: {
    state: string;
    reason_code: string;
  };
  audit_summary: {
    operations: ("verified_snapshot_read" | "citation_resolution")[];
    tool_invocation_count: number;
    hidden_reasoning_returned: false;
  };
  generated_at: string;
  persistence: {
    mode: "run_local_terminal_metadata_only";
    retained_until: string | null;
    snapshot_payload_retained: false;
    user_question_retained: false;
  };
  staleness: {
    state: "current_at_generation" | "stale";
    binding_fields: ("run_id" | "input_snapshot_digest" | "schema_set_revision" | "backend_identity")[];
  };
}
export interface Provider1 {
  configured: boolean;
  provider_id: string;
  model_id: string;
  model_revision: string;
}
export interface Claim {
  claim_id: string;
  claim_kind:
    | "numeric_fact"
    | "comparative_fact"
    | "reported_attribution"
    | "validation_boundary"
    | "provenance_boundary"
    | "fidelity_boundary"
    | "conditional_recommendation"
    | "architecture_correction"
    | "help_text";
  text: string;
  citations: EvidenceAgentCitation[];
  scope: Scope;
  percentile_subject?: PercentileSubject1;
}
export interface EvidenceAgentCitation {
  schema_version: "tilesim.bridge.evidence_agent_citation.v1";
  run_id: string;
  artifact_id: string;
  schema_identity: string;
  sha256: string;
  json_pointer: string;
  subject: Subject1;
  citation_role:
    | "direct_fact"
    | "reported_attribution"
    | "validation_boundary"
    | "provenance_constraint"
    | "fidelity_constraint"
    | "conditional_recommendation_basis";
  availability: "available" | "missing" | "expected_absence" | "not_covered" | "unsupported_schema" | "not_applicable";
  value?: LosslessNumber;
  unit?: string;
}
export interface Subject1 {
  kind:
    | "run"
    | "request"
    | "fabric_phase"
    | "memory_event"
    | "device_task"
    | "collective"
    | "cause"
    | "attribution"
    | "stage"
    | "check"
    | "candidate"
    | "fabric_domain"
    | "objective"
    | "executed_s6_knob";
  id: string;
}
export interface LosslessNumber {
  encoding: "decimal_string";
  numeric_kind: "uint64" | "sint64" | "decimal";
  decimal: string;
}
export interface Scope {
  source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
  requested_fidelity: "policy_default" | "analytical" | "des";
  resolved_fidelity: "analytical" | "des" | "mixed" | "not_applicable";
  execution_mode: "analytical" | "des" | "partitioned_des" | "single_process_fallback" | "mixed" | "not_applicable";
  resource_semantics_relation: "S3_S4_S5_peer";
  causal_subsystems: ("S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6")[];
  attribution_semantics: "not_applicable" | "reported_attribution_only";
  recommendation_semantics: "not_applicable" | "conditional_not_executed";
}
export interface PercentileSubject1 {
  selection_semantics: "single_request" | "tie_no_single_request" | "not_applicable" | "missing";
  selected_request_id: string | null;
  member_request_ids: string[];
}
export interface Refusal {
  reason_code:
    | "insufficient_evidence"
    | "citation_not_allowed"
    | "citation_not_resolvable"
    | "unsupported_schema"
    | "stale_schema_revision"
    | "run_binding_mismatch"
    | "ambiguous_reference"
    | "provenance_scope_violation"
    | "fidelity_scope_violation"
    | "unsafe_tool_request"
    | "prompt_injection"
    | "input_too_large"
    | "output_truncated"
    | "provider_unavailable"
    | "timeout"
    | "cancelled"
    | "concurrency_limit";
  detail: string;
  retryable: boolean;
}

export interface HealthResponse {
  versions_match?: boolean;
  execution_ready?: boolean;
  cli_available?: boolean;
  source_revision?: string;
  build_revision?: string;
  source_state_digest?: string;
  build_state_digest?: string;
  state_digests_match?: boolean;
  deployment_mode?: string;
  deployment_ref?: string;
  deployed_at?: string;
  backend_branch?: string;
  tilesim_root?: string;
  tilesim_cli?: string;
  [k: string]: unknown;
}

export interface CatalogResponse {
  scenarios: {
    scenario_id: string;
    label: string;
  }[];
  fidelity_policies: ("default" | "des")[];
  input_modes: ("controls" | "json" | "trace_package")[];
  design_space_modes: ("built_in_synthetic" | "strict_s6_manifest")[];
  gpu_participation_modes: "gpu_free"[];
}

export interface CapabilitiesResponse {
  schema_version: "tilesim.runtime_capabilities.v1";
  default_gpu_participation_mode: string;
  cycle_scope: string;
  dependencies: {
    [k: string]: {
      available?: boolean;
      version?: string;
      reason?: string;
      [k: string]: unknown;
    };
  };
  run_surface: {
    gpu_participation_modes: "gpu_free"[];
    input_modes: ("controls" | "json" | "trace_package")[];
    design_space_modes: ("built_in_synthetic" | "strict_s6_manifest")[];
    source_modes: "synthetic_trace"[];
    override_parameter_subsystems: ("S0" | "S1" | "S6")[];
    override_parameter_field_ids: string[];
    cycle_hotspot_request_available: false;
    cycle_hotspot_request_reason: string;
    real_trace_submission_available: false;
    compatibility_harness_submission_available: false;
    real_network_observation_channel: "S8_evidence_only";
  };
  [k: string]: unknown;
}

export interface TemplateResponse {
  scenario_id: string;
  runtime_trace: {
    [k: string]: unknown;
  };
  topology: {
    [k: string]: unknown;
  };
}

export interface RenameRunRequest {
  run_name: string;
}

export interface RenameRunResponse {
  run_id: string;
  run_name: string;
}

export interface Week7EvidenceMapResponse {
  schema_version: "tilesim.s9.report_field_evidence_map.v1alpha1";
  status: string;
  rules: {
    report_kind: string;
    field_path: string;
    source_object: string;
    computation_rule: string;
    validation_check: string;
    allowed_claim: string;
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}

export interface Week7CalibrationResponse {
  schema_version: "tilesim.calibration.workflow_report.v1alpha1";
  report_id: string;
  manifest_id: string;
  status: string;
  evidence_tier: string;
  allowed_claim_scope: string;
  scopes: {
    subsystem: string;
    fit_scope: string;
    input_unit: string;
    observed_unit: string;
    operating_region: {
      [k: string]: string;
    };
    calibration_sample_count: number;
    held_out_sample_count: number;
    selected_model: {
      model_kind: string;
      slope: number;
      intercept: number;
      selection_mae: number;
      [k: string]: unknown;
    };
    held_out_mae: number;
    held_out_p95_relative_error: number;
    held_out_max_relative_error: number;
    relative_error_budget: number;
    error_budget_passed: boolean;
    calibration_asset_ids: string[];
    calibration_asset_sha256: string[];
    held_out_asset_ids: string[];
    held_out_asset_sha256: string[];
    [k: string]: unknown;
  }[];
  errors: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}

export interface Week7OrchestrationResponse {
  schema_version: "tilesim.agent.orchestration_report.v1alpha1";
  intent_id: string;
  status: string;
  run_instance_id: string;
  frozen_configuration_digest: string;
  simulation_result_status: string;
  simulation_result_digest: string;
  tool_calls: {
    sequence: number;
    tool_name: string;
    status: string;
    input_digest: string;
    output_reference: string;
    [k: string]: unknown;
  }[];
  artifact_results: {
    artifact_id: string;
    state: string;
    payload_digest: string;
    [k: string]: unknown;
  }[];
  errors: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}

export type Revision = string;

export interface EvidenceAgentDescriptorResponse {
  schema_version: "tilesim.bridge.evidence_agent_descriptor.v2";
  schema_set_revision: Revision;
  descriptor_revision: Revision;
  availability: "available" | "degraded" | "unavailable" | "disabled";
  degradation: {
    state: "none" | "not_configured" | "temporarily_unavailable" | "disabled_by_policy";
    reason_code: "none" | "provider_unavailable" | "provider_disabled";
    detail: string;
  };
  availability_predicate: {
    capability_path: "/provider/configured";
    operator: "equals";
    expected_value: true;
    evaluated_available: boolean;
  };
  schema_identities: {
    request: "tilesim.bridge.evidence_agent_request.v1";
    response: "tilesim.bridge.evidence_agent_response.v1";
    citation: "tilesim.bridge.evidence_agent_citation.v1";
    snapshot_reference: "tilesim.bridge.evidence_snapshot_reference.v1";
    structured_report: "tilesim.web.structured-performance-report.v2";
  };
  provider: Provider;
  revisions: Revisions;
  supported_locales: ("en-US" | "zh-CN")[];
  supported_task_kinds: (
    "explain_p99" | "explain_tail" | "summarize_validation" | "draft_conditional_recommendations"
  )[];
  limits: {
    maximum_request_bytes: number;
    maximum_question_characters: number;
    maximum_artifacts: number;
    maximum_records_per_artifact: number;
    maximum_claims: number;
    maximum_output_characters: number;
  };
  digest_contract: {
    algorithm: "sha256";
    output_encoding: "lowercase_hex_with_sha256_prefix";
    canonicalization: "tilesim.bridge.canonical_json.v1";
    text_encoding: "utf-8";
    object_key_order: "unicode_code_point_ascending";
    array_order: "preserved";
    separators: "comma_colon_no_whitespace";
    non_ascii_escaping: "preserve_utf8";
    integer_encoding: "canonical_decimal_json_token_lossless";
    non_finite_numbers: "forbidden";
    artifact_manifest_material: "entire_verified_manifest_object";
    /**
     * @minItems 6
     * @maxItems 6
     */
    input_snapshot_material_fields: never[];
    /**
     * @minItems 4
     * @maxItems 4
     */
    excluded_untrusted_fields: never[];
  };
  tools: {
    allowed: ("verified_snapshot_read" | "citation_resolution")[];
    forbidden: string[];
    allow_list_expansion: false;
  };
  persistence: PersistencePolicy;
  redaction: {
    user_question: "not_retained";
    snapshot_payload: "not_retained";
    artifact_payload: "not_retained";
    provider_raw_response: "not_retained";
    validated_model_claims: "memory_only_until_process_exit";
    credentials: "never_retained";
    hidden_chain_of_thought: "never_returned_or_retained";
  };
  execution: {
    mode: "synchronous_terminal";
    timeout_ms: number;
    cancellation: "not_applicable_after_synchronous_terminal_response";
    maximum_concurrent_operations: 1;
    retry: RetryPolicy;
    terminal_recovery: TerminalRecoveryPolicy;
  };
}
export interface Provider {
  configured: boolean;
  provider_id: string;
  model_id: string;
  model_revision: string;
}
export interface Revisions {
  prompt_template_revision: string;
  policy_revision: string;
}
export interface PersistencePolicy {
  mode: {
    storage_scope: "run_local";
    record_kind: "redacted_terminal_metadata_only";
    record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2";
  };
  retention_seconds: number;
  terminal_classes: {
    claim_free_bridge_terminal: {
      terminal_metadata_retained: true;
      exact_response_recoverable_after_restart: true;
    };
    claims_bearing_terminal: {
      terminal_metadata_retained: true;
      validated_model_claims_retained: false;
      exact_response_recoverable_after_restart: false;
    };
    claim_free_provider_terminal: {
      terminal_metadata_retained: true;
      validated_provider_response_retained: false;
      exact_response_recoverable_after_restart: false;
    };
  };
  payload_retention: {
    user_question_retained: false;
    snapshot_payload_retained: false;
    artifact_payload_retained: false;
    provider_raw_response_retained: false;
    validated_model_claims_retained: false;
    credentials_retained: false;
    hidden_reasoning_retained: false;
  };
}
export interface RetryPolicy {
  payload_identity: "tilesim.bridge.canonical_json.v1_sha256";
  same_key_same_canonical_payload: {
    in_process: "exact_terminal_replay";
    after_restart_claim_free_bridge_terminal: "exact_terminal_replay_from_redacted_record";
    after_restart_claims_bearing_terminal: "error_terminal_result_not_retained";
    after_restart_claim_free_provider_terminal: "error_terminal_result_not_retained";
    provider_reinvocation: "forbidden";
  };
  same_key_different_canonical_payload: ErrorOutcome & {
    code?: "idempotency_payload_mismatch";
    [k: string]: unknown;
  };
}
export interface ErrorOutcome {
  outcome: "error";
  http_status: 409;
  code: "idempotency_payload_mismatch" | "terminal_result_not_retained";
  field_path: "/headers/Idempotency-Key";
  retryable: false;
}
export interface TerminalRecoveryPolicy {
  record_scope: "run_local";
  record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2";
  claim_free_bridge_terminal: {
    outcome: "exact_terminal_replay";
    source: "redacted_terminal_metadata";
  };
  claims_bearing_terminal: ErrorOutcome & {
    code?: "terminal_result_not_retained";
    [k: string]: unknown;
  };
  claim_free_provider_terminal: ErrorOutcome & {
    code?: "terminal_result_not_retained";
    [k: string]: unknown;
  };
  provider_reinvocation: "forbidden";
}

export type CreateRunResponse = ApiRun & { idempotent_replay: boolean };
