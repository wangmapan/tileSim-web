// Generated from bridge/contracts OpenAPI and JSON Schema. Do not edit by hand.

export const BRIDGE_SCHEMA_SET_REVISION = "sha256:0085e3a4e89576fff168f29d811be581c7107b9bd3f8fabf9834d651f3c606b3";

export type CreateRunRequest = {
  [k: string]: unknown;
} & {
  scenario_id: "s1_des_example" | "dense_des_package" | "pd_disaggregation_example";
  fidelity_policy?: "default" | "des";
  gpu_participation_mode?: "gpu_free";
  run_name?: string | null;
  overrides?: TileSimControlledS0S1S6RunOverrides;
  custom_inputs?: ControlledCustomInputsForTheHostedS1ToS6Path;
  design_space_candidates?: StrictS6OnlyDesignSpaceCandidateManifest | StrictS6OnlyDesignSpaceCandidateManifestV2;
  trace_package_id?: string;
};
export type ControlledS1RuntimeTraceRequestInput = {
  [k: string]: unknown;
} & {
  trace_name?: string;
  engine_type?: "legacy_generic" | "vllm" | "sglang" | "tensorrt_llm";
  engine_semantic_version?:
    "legacy_generic.v1" | "vllm.0.6.semantic.v1" | "sglang.0.4.semantic.v1" | "tensorrt_llm.0.12.semantic.v1";
  /**
   * @maxItems 3
   */
  requested_features?:
    | []
    | [
        | "continuous_batching"
        | "prefix_aware_scheduling"
        | "inflight_batching"
        | "paged_kv_cache"
        | "capacity_aware_scheduling",
      ]
    | [
        (
          | "continuous_batching"
          | "prefix_aware_scheduling"
          | "inflight_batching"
          | "paged_kv_cache"
          | "capacity_aware_scheduling"
        ),
        (
          | "continuous_batching"
          | "prefix_aware_scheduling"
          | "inflight_batching"
          | "paged_kv_cache"
          | "capacity_aware_scheduling"
        ),
      ]
    | [
        (
          | "continuous_batching"
          | "prefix_aware_scheduling"
          | "inflight_batching"
          | "paged_kv_cache"
          | "capacity_aware_scheduling"
        ),
        (
          | "continuous_batching"
          | "prefix_aware_scheduling"
          | "inflight_batching"
          | "paged_kv_cache"
          | "capacity_aware_scheduling"
        ),
        (
          | "continuous_batching"
          | "prefix_aware_scheduling"
          | "inflight_batching"
          | "paged_kv_cache"
          | "capacity_aware_scheduling"
        ),
      ];
  trace_provenance?: {
    source_mode: "synthetic_trace";
    calibration_level: "uncalibrated";
    allowed_claim_scope: "exploratory";
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
    batch_scheduler?: "fifo" | "decode_priority" | "fabric_backpressure_aware" | "starvation_aware";
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
      phase?: "prefill" | "decode" | "request";
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
      phase?: "prefill" | "decode" | "request";
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
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2RunIntakeSchemaJson = {
  [k: string]: unknown;
} & {
  schema_identity: "tilesim.bridge.agent_orchestration_run_intake.v2";
  schema_revision: string;
  intake_id: string;
  canonical_digest: string;
  profile_binding: HttpsTilesimLocalContractsAgentOrchestrationPhase2ProfileBindingSchemaJson;
  device_count: string;
  parallelism: {
    tensor: string;
    pipeline: string;
    expert: string;
  };
  placement: {
    policy_identity: string;
    policy_revision: string;
    /**
     * @minItems 1
     */
    assignments: [
      {
        rank: string;
        device_id: string;
        endpoint_id: string;
      },
      ...{
        rank: string;
        device_id: string;
        endpoint_id: string;
      }[],
    ];
  };
  kv_cache: {
    policy_reference: StableReference;
    capacity_bytes: string;
  };
  collective_policy: StableReference;
  workload: {
    template_reference: ProfileReference & {
      family?: "workload";
      identity?: "tilesim.bridge.agent_orchestration_workload_profile.v2";
      [k: string]: unknown;
    };
    allowed_overrides: {
      pointer: string;
      value: string;
      unit: string | null;
      provenance_kind: "user_supplied";
    }[];
  };
  topology_network_binding: {
    topology_reference: ProfileReference & {
      family?: "topology";
      identity?: "tilesim.bridge.agent_orchestration_topology_profile.v2";
      [k: string]: unknown;
    };
    network_policy_reference: StableReference;
  };
  requested_fidelity: "Analytical" | "DES" | "Cycle";
  gpu_participation_mode: "gpu_free" | "gpu_assisted_trace" | "gpu_in_loop";
  trace_source: {
    mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
    reference: StableReference;
    allowed_claim_scope:
      | "exploration"
      | "synthetic_consistency"
      | "limited_extrapolation"
      | "similar_regime_conditional_prediction"
      | "real_calibrated_validation";
  };
  slos: {
    metric_identity: string;
    scope: "request" | "run" | "network";
    operator: "lte" | "gte";
    target: string;
    unit: string;
    window: string;
  }[];
  budget: {
    candidate_count: string;
    run_count: string;
    simulation_time_ps: string;
    wall_time_ps: string;
  };
};
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2CalculatorReceiptSchemaJson = {
  schema_identity: "tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1";
  schema_revision: string;
  receipt_identity: string;
  receipt_revision: string;
  receipt_type:
    | "model_weight_memory"
    | "kv_capacity"
    | "parallelism"
    | "placement"
    | "collective_network"
    | "workload_distribution"
    | "slo_budget";
  calculator_identity: string;
  algorithm_revision: string;
  /**
   * @minItems 1
   */
  input_references: [StableReference, ...StableReference[]];
  /**
   * @minItems 1
   */
  units: [string, ...string[]];
  result:
    | {
        kind: "exact";
        value: string;
        unit: string;
      }
    | {
        kind: "interval";
        lower: string;
        upper: string;
        unit: string;
        confidence: string;
      }
    | {
        kind: "unknown";
        reason_code: string;
      };
  rounding_policy: "exact" | "floor" | "ceiling" | "half_even" | "outward_interval";
  assumptions: string[];
  uncertainty: {
    kind: "none" | "bounded" | "unbounded";
    description: string;
  };
  /**
   * @minItems 1
   */
  rule_ids: [string, ...string[]];
  repair_candidates: {
    action_identity: string;
    target_pointer: string;
    safe: boolean;
    description: string;
  }[];
  claim_scope_ceiling:
    | "exploration"
    | "synthetic_consistency"
    | "limited_extrapolation"
    | "similar_regime_conditional_prediction"
    | "real_calibrated_validation";
  typed_facts: {
    primary_quantity: string;
    constraint_status: "satisfied" | "violated" | "unknown";
  };
} & (
  | {
      receipt_type?: "model_weight_memory";
      receipt_identity?: "tilesim.bridge.agent_orchestration_model_weight_memory_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "kv_capacity";
      receipt_identity?: "tilesim.bridge.agent_orchestration_kv_capacity_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "parallelism";
      receipt_identity?: "tilesim.bridge.agent_orchestration_parallelism_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "placement";
      receipt_identity?: "tilesim.bridge.agent_orchestration_placement_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "collective_network";
      receipt_identity?: "tilesim.bridge.agent_orchestration_collective_network_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "workload_distribution";
      receipt_identity?: "tilesim.bridge.agent_orchestration_workload_distribution_receipt.v1";
      [k: string]: unknown;
    }
  | {
      receipt_type?: "slo_budget";
      receipt_identity?: "tilesim.bridge.agent_orchestration_slo_budget_receipt.v1";
      [k: string]: unknown;
    }
);
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2ModelProfileSchemaJson = ProfileEnvelope & {
  schema_identity?: "tilesim.bridge.agent_orchestration_model_profile.v2";
  profile_family?: "model";
  facts?: {
    architecture: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    parameter_count: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    layer_count: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    hidden_size: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    expert_structure: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    tensor_layout: Fact & {
      value?: string;
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
};
export type ProfileEnvelope = {
  [k: string]: unknown;
} & {
  schema_identity: string;
  schema_revision: string;
  profile_family: "model" | "engine" | "device" | "topology" | "workload";
  profile_id: string;
  profile_revision: string;
  canonical_digest: string;
  display: {
    name: string;
    description: string;
    labels: string[];
  };
  source_reference: string;
  source_kind:
    | "real_trace"
    | "synthetic_trace"
    | "compatibility_harness_trace"
    | "reviewed_registry"
    | "vendor_specification"
    | "user_input";
  license: {
    spdx_id: string;
    redistribution_allowed: boolean;
    notice_reference?: string | null;
  };
  valid_regime: {
    description: string;
    /**
     * @minItems 1
     */
    constraints: [string, ...string[]];
  };
  lifecycle: {
    introduced_at: string;
    updated_at: string;
    expires_at: string | null;
    status: "available" | "deprecated" | "expired" | "revoked" | "unavailable";
  };
  calibration_status: "not_applicable" | "missing" | "fixture_consistency_only" | "calibrated";
  calibration_binding: StableReference | null;
  held_out_validation_status: "missing" | "fixture_consistency_only" | "validated";
  held_out_validation_binding: StableReference | null;
  allowed_claim_scope:
    | "exploration"
    | "synthetic_consistency"
    | "limited_extrapolation"
    | "similar_regime_conditional_prediction"
    | "real_calibrated_validation";
  sensitivity: "public" | "internal" | "restricted";
  visibility: "catalog" | "project" | "private";
  facts: {
    [k: string]: unknown;
  };
};
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2EngineProfileSchemaJson = ProfileEnvelope & {
  schema_identity?: "tilesim.bridge.agent_orchestration_engine_profile.v2";
  profile_family?: "engine";
  facts?: {
    engine_name: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    engine_version: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    semantic_profile: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    batching_policy: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    supported_features: Fact & {
      value?: string[];
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
};
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2DeviceProfileSchemaJson = ProfileEnvelope & {
  schema_identity?: "tilesim.bridge.agent_orchestration_device_profile.v2";
  profile_family?: "device";
  facts?: {
    device_model: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    memory_capacity_bytes: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    compute_profile_reference: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    interconnect_endpoints: Fact & {
      value?: string;
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
};
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2TopologyProfileSchemaJson = ProfileEnvelope & {
  schema_identity?: "tilesim.bridge.agent_orchestration_topology_profile.v2";
  profile_family?: "topology";
  facts?: {
    topology_kind: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    endpoint_count: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    link_bandwidth_gbps: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    link_latency_ps: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    routing_policy: Fact & {
      value?: string;
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
};
export type HttpsTilesimLocalContractsAgentOrchestrationPhase2WorkloadProfileSchemaJson = ProfileEnvelope & {
  schema_identity?: "tilesim.bridge.agent_orchestration_workload_profile.v2";
  profile_family?: "workload";
  facts?: {
    template_kind: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    request_count: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    input_tokens: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    output_tokens: Fact & {
      value?: string;
      [k: string]: unknown;
    };
    arrival_process: Fact & {
      value?: string;
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
};

export interface BridgeApiContracts {
  manifest?: ApiManifestResponse;
  error?: ErrorResponse;
  artifactManifest?: ArtifactManifestResponse;
  expectedAbsenceDescriptor?: ExpectedAbsenceArtifactDescriptor;
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
  executionReplay?: ExecutionReplayArtifact;
  runtimeEventTrace?: RuntimeEventTrace;
  runtimeEventSummary?: RuntimeEventSummary;
  runtimeRequestSummaries?: RuntimeRequestSummaries;
  runtimeAnalysis?: RuntimeAnalysis;
  validationReport?: ValidationReportV1;
  week8RunEvidence?: S7RunBoundDesEvidenceV1;
  evidenceAgentDescriptor?: EvidenceAgentDescriptor;
  evidenceAgentRequest?: EvidenceAgentRequest;
  evidenceAgentResponse?: EvidenceAgentResponse;
  evidenceAgentCitation?: EvidenceAgentCitation;
  agentOrchestrationCapabilitySnapshot?: AgentOrchestrationCapabilitySnapshot;
  agentOrchestrationRunIntakePreviewRequest?: AgentOrchestrationRunIntakePreviewRequest;
  agentOrchestrationRunIntakePreviewResponse?: AgentOrchestrationRunIntakePreviewResponse;
  agentOrchestrationProfileBindingV1?: HttpsTilesimLocalContractsAgentOrchestrationPhase2ProfileBindingSchemaJson;
  agentOrchestrationRunIntakeV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2RunIntakeSchemaJson;
  agentOrchestrationValidationReportV1?: HttpsTilesimLocalContractsAgentOrchestrationPhase2ValidationReportSchemaJson;
  agentOrchestrationCalculatorReceiptV1?: HttpsTilesimLocalContractsAgentOrchestrationPhase2CalculatorReceiptSchemaJson;
  agentOrchestrationIdempotencyRetentionPolicyV1?: HttpsTilesimLocalContractsAgentOrchestrationPhase2IdempotencyRetentionPolicySchemaJson;
  agentOrchestrationModelProfileV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2ModelProfileSchemaJson;
  agentOrchestrationEngineProfileV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2EngineProfileSchemaJson;
  agentOrchestrationDeviceProfileV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2DeviceProfileSchemaJson;
  agentOrchestrationTopologyProfileV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2TopologyProfileSchemaJson;
  agentOrchestrationWorkloadProfileV2?: HttpsTilesimLocalContractsAgentOrchestrationPhase2WorkloadProfileSchemaJson;
  agentFlowArtifactBinding?: AgentFlowArtifactBinding;
  agentFlowIdentityBinding?: AgentFlowIdentityBinding;
  agentFlowNavigationObservation?: AgentFlowNavigationObservation;
  agentFlowStartRequest?: AgentFlowStartRequest;
  agentFlowResumeRequest?: AgentFlowResumeRequest;
  agentFlowState?: AgentFlowState;
  agentFlowEvent?: AgentFlowEvent;
  agentFlowStartResponse?: AgentFlowStartResponse;
  agentFlowStatusResponse?: AgentFlowStatusResponse;
  agentFlowEventsResponse?: AgentFlowEventsResponse;
  agentFlowResumeResponse?: AgentFlowResumeResponse;
  agentIntentPageEntry?: AgentIntentPageEntry;
  agentIntentRequest?: AgentIntentRequest;
  agentIntentResponse?: AgentIntentResponse;
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
  agent_orchestration_capability: {
    endpoint: "GET /api/agent/orchestration-capabilities";
    snapshot_schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1";
    catalog_schema_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1";
    parameter_descriptor_schema_identity: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1";
    /**
     * @minItems 5
     * @maxItems 5
     */
    profile_schema_identities: [
      (
        | "tilesim.bridge.agent_orchestration_model_profile.v1"
        | "tilesim.bridge.agent_orchestration_engine_profile.v1"
        | "tilesim.bridge.agent_orchestration_device_profile.v1"
        | "tilesim.bridge.agent_orchestration_topology_profile.v1"
        | "tilesim.bridge.agent_orchestration_workload_profile.v1"
      ),
      (
        | "tilesim.bridge.agent_orchestration_model_profile.v1"
        | "tilesim.bridge.agent_orchestration_engine_profile.v1"
        | "tilesim.bridge.agent_orchestration_device_profile.v1"
        | "tilesim.bridge.agent_orchestration_topology_profile.v1"
        | "tilesim.bridge.agent_orchestration_workload_profile.v1"
      ),
      (
        | "tilesim.bridge.agent_orchestration_model_profile.v1"
        | "tilesim.bridge.agent_orchestration_engine_profile.v1"
        | "tilesim.bridge.agent_orchestration_device_profile.v1"
        | "tilesim.bridge.agent_orchestration_topology_profile.v1"
        | "tilesim.bridge.agent_orchestration_workload_profile.v1"
      ),
      (
        | "tilesim.bridge.agent_orchestration_model_profile.v1"
        | "tilesim.bridge.agent_orchestration_engine_profile.v1"
        | "tilesim.bridge.agent_orchestration_device_profile.v1"
        | "tilesim.bridge.agent_orchestration_topology_profile.v1"
        | "tilesim.bridge.agent_orchestration_workload_profile.v1"
      ),
      (
        | "tilesim.bridge.agent_orchestration_model_profile.v1"
        | "tilesim.bridge.agent_orchestration_engine_profile.v1"
        | "tilesim.bridge.agent_orchestration_device_profile.v1"
        | "tilesim.bridge.agent_orchestration_topology_profile.v1"
        | "tilesim.bridge.agent_orchestration_workload_profile.v1"
      ),
    ];
    catalog_revision: string;
    contract_package_revision: string;
  };
  agent_flow: {
    contract_revision: "2026-10-28.flow.v2";
    runtime_mode: "deterministic_transition_adapter";
    langgraph_runtime_status: "optional_not_active";
    activation_boundary: "local_dev_only";
    /**
     * @minItems 13
     * @maxItems 13
     */
    schema_identities: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    endpoints: {
      start: "POST /api/agent/flows";
      status: "GET /api/agent/flows/{flow_id}";
      events: "GET /api/agent/flows/{flow_id}/events";
      stream: "GET /api/agent/flows/{flow_id}/events/stream";
      resume: "POST /api/agent/flows/{flow_id}/resume";
      revoke_authorization: "POST /api/agent/flows/{flow_id}/authorization/revoke";
    };
    scopes: {
      start: "agent:start_flow";
      read: "agent:read_flow";
      resume: "agent:resume_flow";
    };
    idempotency_header: "Idempotency-Key";
    event_resume_header: "Last-Event-ID";
    local_dev: true;
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
    create_run: false;
    provider_acceptance: "pending";
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
    nested_schema_identity?: string;
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
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  bytes: bigint;
  sha256: string;
  schema_identity: string;
  contract_status: "supported" | "legacy_compatibility" | "not_applicable";
  content_status?: "ready" | "expected_absence";
}
export interface RejectedArtifactManifestEntry {
  artifact_id: string;
  file_name: string;
  reason: "invalid_json" | "unsupported_schema" | "run_binding_mismatch" | "self_hash_cycle" | "contract_violation";
  schema_identity: string;
  json_pointer: string;
}
export interface ExpectedAbsenceArtifactDescriptor {
  schema_version: "tilesim.wind_tunnel_artifact_descriptor.v1";
  run_id: string;
  artifact_id: string;
  state: "expected_absence";
  evidence_requirement: string;
  absence_reason: "not_expected_for_boundary";
  detail: string;
}
export interface TileSimControlledS0S1S6RunOverrides {
  runtime?: {
    batch_scheduler?: "fifo" | "decode_priority" | "fabric_backpressure_aware" | "starvation_aware";
    max_batch_size?: number;
    kv_capacity_tokens?: number;
    max_active_requests?: number;
    initial_kv_tokens?: number;
    kv_admission_watermark?: number;
    long_context_threshold_tokens?: number;
    decode_penalty_per_threshold?: number;
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
      link_id?: string;
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
  schema_version?: "tilesim.design_space.s6_candidates.v1";
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
export interface StrictS6OnlyDesignSpaceCandidateManifestV2 {
  schema_version: "tilesim.design_space.s6_candidates.v2";
  manifest_id: string;
  source_mode: "synthetic_trace";
  calibration_level: "uncalibrated";
  allowed_claim_scope: "exploratory";
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
   * @minItems 2
   * @maxItems 2
   */
  design_space_candidate_schema_options: [DesignSpaceCandidateSchemaOption, DesignSpaceCandidateSchemaOption];
  default_design_space_candidate_schema_identity: "tilesim.design_space.s6_candidates.v1";
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
   * @minItems 13
   * @maxItems 13
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
export interface DesignSpaceCandidateSchemaOption {
  schema_identity: "tilesim.design_space.s6_candidates.v1" | "tilesim.design_space.s6_candidates.v2";
  available: true;
  unavailable_reason: null;
  default_when_omitted: boolean;
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
  stderr_summary?: string;
  cli_error_code?: string;
  cli_field_path?: string;
  cli_cause?: string;
  cli_next_action?: string;
  digest?: {
    end_to_end_latency_us?: number | null;
    throughput_requests_per_second?: number | null;
    completed_request_count?: bigint | null;
    request_count?: bigint | null;
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
  request_metrics: RequestMetric[];
  trace_provenance?: Provenance;
  observation_window?: {
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    start_time_ps?: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    end_time_ps?: bigint;
    [k: string]: unknown;
  };
  summary?: {
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    request_count?: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    completed_request_count?: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    rejected_request_count?: bigint;
    throughput_requests_per_second?: number;
    [k: string]: unknown;
  };
  tail_latency_summary?: {
    ttft_ps?: MetricDistribution;
    tpot_ps?: MetricDistribution;
    end_to_end_latency_ps?: MetricDistribution;
    [k: string]: unknown;
  };
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
      utilization_ratio?: number;
      queue_delay_us?: number;
      congestion_delay_us?: number;
      runtime_us?: number;
      queue_delay_ratio?: number;
      congestion_delay_ratio?: number;
      [k: string]: unknown;
    }[];
    phase_fabric_contributions: {
      request_id: string;
      phase_id: string;
      memory_event_id: string;
      device_task_id: string;
      collective_id: string;
      not_s5_collective: boolean;
      domain_id?: string;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      record_count?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      busy_time_ps?: bigint;
      queue_delay_us?: number;
      congestion_delay_us?: number;
      runtime_us?: number;
      queue_delay_ratio?: number;
      congestion_delay_ratio?: number;
      dominant_delay_kind?: string;
      memory_operation?: string;
      memory_match_status?: string;
      memory_latency_us?: number;
      device_profile?: string;
      device_profile_selection?: string;
      device_profile_asset_id?: string;
      device_profile_claim_scope?: string;
      device_stream_id?: string;
      device_match_status?: string;
      device_latency_us?: number;
      device_occupancy_ratio?: number;
      device_contention_delay_us?: number;
      network_profile?: string;
      network_profile_selection?: string;
      network_profile_asset_id?: string;
      network_profile_claim_scope?: string;
      resource_convergence_status?: string;
      transfer_kind?: string;
      pd_handoff_id?: string;
      pd_disaggregation_group_id?: string;
      pd_source_placement_group_id?: string;
      pd_destination_placement_group_id?: string;
      [k: string]: unknown;
    }[];
    request_fabric_contributions?: {
      request_id?: string;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      record_count?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      busy_time_ps?: bigint;
      runtime_us?: number;
      queue_delay_us?: number;
      congestion_delay_us?: number;
      queue_delay_ratio?: number;
      congestion_delay_ratio?: number;
      dominant_domain_id?: string;
      dominant_phase_id?: string;
      dominant_collective_id?: string;
      dominant_delay_kind?: string;
      network_profile?: string;
      network_profile_selection?: string;
      network_profile_asset_id?: string;
      network_profile_claim_scope?: string;
      [k: string]: unknown;
    }[];
    request_network_wait_intervals?: RequestNetworkWaitInterval[];
    device_metrics?: DeviceMetrics[];
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    representative_device_task_count?: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    unmapped_device_task_count?: bigint;
    pd_disaggregation?: {
      has_handoff_evidence?: boolean;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      handoff_record_count?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      handoff_busy_time_ps?: bigint;
      handoff_latency_us?: number;
      handoff_queue_delay_us?: number;
      handoff_congestion_delay_us?: number;
      handoff_runtime_us?: number;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      handoff_ready_event_count?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      decode_wait_for_handoff_ps?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      decode_wait_after_handoff_ps?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      max_decode_wait_for_handoff_ps?: bigint;
      /**
       * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
       */
      max_decode_wait_after_handoff_ps?: bigint;
      dominant_runtime_handoff_request_id?: string;
      dominant_runtime_handoff_id?: string;
      dominant_handoff_request_id?: string;
      dominant_handoff_phase_id?: string;
      dominant_handoff_domain_id?: string;
      dominant_handoff_id?: string;
      dominant_source_placement_group_id?: string;
      dominant_destination_placement_group_id?: string;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface RequestMetric {
  request_id: string;
  status?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  arrival_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  first_token_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  completion_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  ttft_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  tpot_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_to_end_latency_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  decode_step_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  batch_issue_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  network_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  network_backpressure_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_allocation_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_pressure_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_remote_read_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_migration_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_pd_handoff_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_bytes_read?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_bytes_migrated?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_eviction_bytes?: bigint;
  kv_source_identity?: string;
  kv_destination_identity?: string;
  dominant_kv_wait_reason?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  device_wait_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  collective_wait_ps?: bigint;
  dominant_wait_reason?: string;
  device_profile?: string;
  device_profile_selection?: string;
  device_profile_asset_id?: string;
  device_profile_claim_scope?: string;
  network_profile?: string;
  network_profile_selection?: string;
  network_profile_asset_id?: string;
  network_profile_claim_scope?: string;
  has_first_token_time?: boolean;
  has_ttft_sample?: boolean;
  has_tpot_sample?: boolean;
  has_end_to_end_latency_sample?: boolean;
  [k: string]: unknown;
}
export interface Provenance {
  source_mode: "real_trace" | "synthetic_trace" | "compatibility_harness_trace";
  calibration_level: string;
  allowed_claim_scope: string;
  [k: string]: unknown;
}
export interface MetricDistribution {
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  sample_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  p50_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  p95_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  p99_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  max_ps?: bigint;
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
export interface RequestNetworkWaitInterval {
  request_id?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps?: bigint;
  collective?: boolean;
  [k: string]: unknown;
}
export interface DeviceMetrics {
  device_id?: string;
  device_type?: string;
  group_id?: string;
  evidence_state?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  task_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  prefill_task_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  decode_task_count?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  modeled_memory_bytes?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  service_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  active_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  observation_window_ps?: bigint;
  active_time_ratio?: number;
  hardware_counter_state?: string;
  [k: string]: unknown;
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
  cause_chain: Cause[];
  attribution_ranking: Attribution[];
  [k: string]: unknown;
}
export interface Cause {
  cause_id: string;
  subject_refs: SubjectRef[];
  evidence_refs: EvidenceRef[];
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps?: bigint;
  subsystem?: string;
  cause_code?: string;
  title?: string;
  evidence?: string;
  model_execution_call_id?: string;
  execution_id?: string;
  kv_operation_id?: string;
  network_demand_id?: string;
  device_task_id?: string;
  collective_id?: string;
  pd_handoff_id?: string;
  pd_disaggregation_group_id?: string;
  pd_source_placement_group_id?: string;
  pd_destination_placement_group_id?: string;
  network_intervals?: NetworkInterval[];
  [k: string]: unknown;
}
export interface NetworkInterval {
  component_code?: string;
  demand_id?: string;
  link_id?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  attempt?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps?: bigint;
  evidence?: string;
  unresolved_reason?: string;
  evidence_refs?: EvidenceRef[];
  [k: string]: unknown;
}
export interface Attribution {
  attribution_id: string;
  subject_refs: SubjectRef[];
  evidence_refs: EvidenceRef[];
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  rank?: bigint;
  score_ps?: number;
  share?: number;
  subsystem?: string;
  component_code?: string;
  title?: string;
  detail?: string;
  [k: string]: unknown;
}
export interface S7ExecutionEnvelopeV1 {
  schema_version: "tilesim.s7_execution_envelope.v1";
  run_id: string;
  runtime_engine_type?: string;
  runtime_engine_semantic_version?: string;
  runtime_input_mode?: "" | "legacy_generic" | "dynamic_request" | "observed_replay";
  semantic_profile_applied?: boolean;
  evidence_refs: EvidenceRef[];
  stages: {
    stage_id: string;
    subject_refs: SubjectRef[];
    evidence_refs: EvidenceRef[];
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface ExecutionReplayArtifact {
  schema_version: "tilesim.execution_replay.v1";
  run_id: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  finish_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps: bigint;
  fabric: FabricReport;
  collective_steps: CollectiveStep[];
}
export interface FabricReport {
  scenario_name: string;
  end_to_end_latency_us: number;
  timeline: ExecutionRecord[];
  module_stats: {
    module_id: string;
    module_kind: string;
    fidelity_level: string;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    total_bytes: bigint;
    total_queue_delay_us: number;
    total_congestion_delay_us: number;
    total_runtime_us: number;
    total_algorithm_rounds: number;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    transfers_executed: bigint;
  }[];
  fallback_reasons: string[];
  hotspots: {
    hotspot_type: string;
    resource_scope: string;
    phase_id: string;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    time_window_ps: bigint;
    required_observation: string;
  }[];
}
export interface ExecutionRecord {
  request_id: string;
  collective_id: string;
  phase_id: string;
  collective_algorithm: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  collective_rounds: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  participant_count: bigint;
  module_id: string;
  domain_id: string;
  module_kind: string;
  fidelity_level: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  release_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  memory_latency_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  device_latency_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  finish_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  queue_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  serialization_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  congestion_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  profile_queueing_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  propagation_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  service_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  completion_delay_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  backpressure_delay_ps: bigint;
  profile_id: string;
  profile_selection: string;
  profile_asset_id: string;
  profile_asset_sha256: string;
  profile_source_id: string;
  profile_generation_path: string;
  profile_source_mode: string;
  profile_calibration_level: string;
  profile_claim_scope: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  service_busy_time_ps: bigint;
  has_service_busy_time: boolean;
  elapsed_time_includes_queue_delay: boolean;
  resource_annotations: {
    [k: string]: string;
  };
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  retransmission_count: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  flow_control_stall_count: bigint;
  actual_path: string[];
  link_endpoints: {
    [k: string]: {
      source: string;
      destination: string;
    };
  };
  execution_events: {
    kind: string;
    phase_id: string;
    link_id: string;
    port_id: string;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    time_ps: bigint;
    /**
     * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
     */
    attempt: bigint;
  }[];
}
export interface CollectiveStep {
  step_id: string;
  collective_id: string;
  demand_id?: string;
  phase_id: string;
  phase?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  round: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  chunk: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps: bigint;
  source_device: string;
  destination_device: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  bytes: bigint;
  dependencies: string[];
  state: string;
}
export interface RuntimeEventTrace {
  schema_version: "tilesim.s1_runtime_event_trace.v1";
  run_id: string;
  trace_name: string;
  events: Event[];
  [k: string]: unknown;
}
export interface Event {
  kind: string;
  request_id: string;
  batch_id: string;
  batch_request_ids: string[];
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  event_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  logical_step: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  kv_tokens: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  active_requests: bigint;
  [k: string]: unknown;
}
export interface RuntimeEventSummary {
  schema_version: "tilesim.s1_runtime_event_summary.v1";
  run_id: string;
  has_events: boolean;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  total_events: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  first_event_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  last_event_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  peak_active_requests: bigint;
  monotonic_time_order: boolean;
  contiguous_logical_steps: boolean;
  [k: string]: unknown;
}
export interface RuntimeRequestSummaries {
  schema_version: "tilesim.s1_runtime_request_summaries.v1";
  run_id: string;
  requests: Request[];
  [k: string]: unknown;
}
export interface Request {
  request_id: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  arrival_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  admit_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  first_batch_issue_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  first_token_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  completion_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  final_kv_tokens: bigint;
  [k: string]: unknown;
}
export interface RuntimeAnalysis {
  schema_version: "tilesim.s1_runtime_analysis.v1";
  run_id: string;
  trace_name: string;
  summary: Summary;
  requests: Request[];
  events: Event[];
  [k: string]: unknown;
}
export interface Summary {
  has_events: boolean;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  total_events: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  first_event_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  last_event_time_ps: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  peak_active_requests: bigint;
  monotonic_time_order: boolean;
  contiguous_logical_steps: boolean;
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
export interface AgentOrchestrationCapabilitySnapshot {
  schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1";
  publication_status: "published";
  snapshot_id: string;
  snapshot_revision: string;
  snapshot_digest: string;
  canonicalization_identity: "tilesim.bridge.canonical_json.v1";
  catalog: AgentOrchestrationCapabilityCatalog;
  release_binding: {
    web_source_identity: "tilesim.web.git";
    web_source_revision: string;
    web_build_revision: string;
    backend_identity: "tilesim.backend.git";
    backend_revision: string;
    schema_set_revision: string;
    experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1";
    experiment_descriptor_revision: string;
    create_run_identity: "tilesim.bridge.create_run_request.v1";
    catalog_revision: string;
    contract_package_revision: string;
    /**
     * @minItems 2
     * @maxItems 2
     */
    nested_design_space_identities: [unknown, unknown];
    default_nested_design_space_identity:
      "tilesim.design_space.s6_candidates.v1" | "tilesim.design_space.s6_candidates.v2";
  };
  drift_policy: {
    release_binding_mismatch: "fail_closed";
    catalog_revision_mismatch: "fail_closed";
    unknown_identity_or_status: "fail_closed";
  };
}
export interface AgentOrchestrationCapabilityCatalog {
  schema_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1";
  publication_status: "published";
  catalog_id: string;
  catalog_revision: string;
  catalog_digest: string;
  contract_package_revision: string;
  parameter_descriptor_schema_identity: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1";
  parameter_descriptor_schema_revision: string;
  parameter_descriptor_schema_digest: string;
  /**
   * @minItems 8
   * @maxItems 8
   */
  parameter_descriptors: [
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
  ];
  /**
   * @minItems 5
   * @maxItems 5
   */
  profile_families: [
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
  ];
  profile_records: {
    /**
     * @maxItems 0
     */
    model: [];
    /**
     * @maxItems 0
     */
    engine: [];
    /**
     * @maxItems 0
     */
    device: [];
    /**
     * @maxItems 0
     */
    topology: [];
    /**
     * @maxItems 0
     */
    workload: [];
  };
  /**
   * @minItems 8
   * @maxItems 8
   */
  agent_exposed_field_ids: [string, string, string, string, string, string, string, string];
  /**
   * @minItems 9
   * @maxItems 9
   */
  not_exposed_capabilities: [
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
  ];
  /**
   * @minItems 2
   * @maxItems 2
   */
  claim_scope_ceiling: [unknown, unknown];
}
export interface AgentOrchestrationParameterDescriptor {
  field_id: string;
  owner_module:
    | "工作负载抽象与负载描述语言模块"
    | "推理引擎与服务运行时模块"
    | "执行语义建模模块"
    | "KV Cache 建模模块"
    | "设备性能建模模块"
    | "集合通信语义模块"
    | "网络与硬件资源模块"
    | "统一仿真内核模块"
    | "场景与探索编排模块"
    | "校准验证与指标归因模块"
    | "基于 Agent 的仿真编排模块";
  value_type: "number" | "integer" | "enum";
  canonical_unit: string;
  /**
   * @minItems 1
   */
  accepted_units: [string, ...string[]];
  constraints: {
    minimum?: string;
    maximum?: string;
    step?: string;
    /**
     * @minItems 1
     */
    enum?: [string, ...string[]];
  };
  applicability: {
    status: "available" | "conditional";
    /**
     * @minItems 1
     */
    conditions: [string, ...string[]];
  };
  request_identity: "tilesim.bridge.create_run_request.v1";
  request_json_pointer: string;
  lowering_stage: string;
  /**
   * @minItems 1
   */
  execution_evidence: [EvidenceReference, ...EvidenceReference[]];
  capability_state: {
    described: CapabilityDimension;
    accepted: CapabilityDimension;
    validated: CapabilityDimension;
    lowered: CapabilityDimension;
    executed: CapabilityDimension;
    observable: CapabilityDimension;
    calibrated: CapabilityDimension;
    held_out_validated: CapabilityDimension;
    agent_exposed: CapabilityDimension;
  };
  /**
   * @minItems 1
   */
  reason_codes: [
    (
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    ),
    ...(
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    )[],
  ];
  /**
   * @minItems 2
   * @maxItems 2
   */
  claim_scope_ceiling: [unknown, unknown];
  resolved_fidelity: "Analytical" | "DES" | "mixed";
}
export interface EvidenceReference {
  repository: "D:/tileSim" | "D:/tileSim-web";
  revision: string;
  path: string;
  test_case: string;
  evidence_class: "contract" | "lowering" | "synthetic_deterministic_execution" | "artifact_observation";
  /**
   * @minItems 1
   */
  artifact_pointers: [string, ...string[]];
}
export interface CapabilityDimension {
  state: "affirmed" | "denied";
  reason_code:
    | "execution_closure_proven"
    | "gap_kv_001_logical_admission_only"
    | "profile_missing"
    | "minimal_engine_profiles_not_catalog_published"
    | "create_run_engine_selection_not_exposed"
    | "calibration_missing"
    | "held_out_validation_missing"
    | "not_exposed_to_agent"
    | "resolved_scale_out_analytical";
}
export interface ProfileAvailability {
  family: "model" | "engine" | "device" | "topology" | "workload";
  schema_identity: string;
  schema_revision: string;
  schema_digest: string;
  schema_status: "published";
  actual_profile_count: 0;
  data_status: "profile_missing" | "conditional";
  runtime_availability: "unavailable";
  /**
   * @minItems 1
   */
  reason_codes: [
    (
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    ),
    ...(
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    )[],
  ];
  calibration_status: "calibration_missing";
  held_out_validation_status: "held_out_validation_missing";
}
export interface NotExposedCapability {
  capability_id:
    | "model_selection"
    | "device_selection"
    | "engine_selection"
    | "tensor_parallel_degree"
    | "pipeline_parallel_degree"
    | "expert_parallel_degree"
    | "physical_kv_policy"
    | "collective_algorithm"
    | "slo";
  state: "not_exposed";
  reason_code: "not_exposed_to_agent";
}
/**
 * Request envelope for the read-only Run Intake v2 preview endpoint. It carries only what the browser legitimately owns: the nested Run Intake v2 payload exactly as it would appear inside a create-run v1 body, or an explicit null for a create-run request that has no nested Agent orchestration payload. Every judging input that could forge an accepted verdict is server-owned and therefore not accepted here: expected_revision, registered revisions, profile_records, backend lowering issues, claim_requires_calibration and the dispatcher route are all fixed by the server. additionalProperties is false so a client that tries to supply one of those fields is rejected instead of silently ignored.
 */
export interface AgentOrchestrationRunIntakePreviewRequest {
  /**
   * The nested Agent orchestration submission. An explicit null is the expected-absence case: the create-run v1 accept set is unchanged because no nested payload is present. Omitting the key is a request-validation failure, not an expected absence.
   */
  intake: null | HttpsTilesimLocalContractsAgentOrchestrationPhase2RunIntakeSchemaJson;
}
export interface HttpsTilesimLocalContractsAgentOrchestrationPhase2ProfileBindingSchemaJson {
  schema_identity: "tilesim.bridge.agent_orchestration_profile_binding.v1";
  schema_revision: string;
  binding_id: string;
  binding_digest: string;
  model: ProfileReference & {
    family?: "model";
    identity?: "tilesim.bridge.agent_orchestration_model_profile.v2";
    [k: string]: unknown;
  };
  engine: ProfileReference & {
    family?: "engine";
    identity?: "tilesim.bridge.agent_orchestration_engine_profile.v2";
    [k: string]: unknown;
  };
  device: ProfileReference & {
    family?: "device";
    identity?: "tilesim.bridge.agent_orchestration_device_profile.v2";
    [k: string]: unknown;
  };
  topology: ProfileReference & {
    family?: "topology";
    identity?: "tilesim.bridge.agent_orchestration_topology_profile.v2";
    [k: string]: unknown;
  };
  workload: ProfileReference & {
    family?: "workload";
    identity?: "tilesim.bridge.agent_orchestration_workload_profile.v2";
    [k: string]: unknown;
  };
  fidelity: "Analytical" | "DES" | "Cycle";
  gpu_participation_mode: "gpu_free" | "gpu_assisted_trace" | "gpu_in_loop";
}
export interface ProfileReference {
  family: "model" | "engine" | "device" | "topology" | "workload";
  profile_id: string;
  identity: string;
  revision: string;
  digest: string;
}
export interface StableReference {
  identity: string;
  revision: string;
  digest: string;
}
/**
 * Typed read-only Run Intake v2 preview verdict. This body is the service result passed through verbatim: the endpoint adds, removes and rewrites nothing, so judgement.code is the single home of the published compatibility vocabulary and is never duplicated into the error envelope. The endpoint returns this body for every submission the published contract can judge, including rejections; HTTP status only separates transport outcomes (200 judged, 400 unjudgeable request, 503 unavailable published contract). The response identity is published by this document and by the X-TileSim-API-Version and X-TileSim-Schema-Set-Revision response headers, not by a body field. Every value here describes intent only: run_creation is always not_performed, run_acceptance always not_accepted_by_current_api and persistence.write_capability always absent, so no consumer may read this body as evidence that a run exists, was accepted or was persisted.
 */
export interface AgentOrchestrationRunIntakePreviewResponse {
  service: "agent_orchestration_run_intake_preview";
  /**
   * Dispatcher generation that produced this judgement. The server always reports its own generation; a request cannot select a different one.
   */
  route: "nested_run_intake_v2" | "legacy_nested_intake_server" | "create_run_v1";
  run_creation: "not_performed";
  run_acceptance: "not_accepted_by_current_api";
  judgement: Judgement;
  /**
   * Echo of the accepted submission's own declared facts; it is copied, never recomputed. Null whenever the submission was rejected or no nested payload was present.
   */
  intake: null | IntakeSummary;
  /**
   * Fail-closed Profile resolution. Null when the submission was rejected or carried no nested payload. When present with resolved false, no candidate, ranking or fallback value exists anywhere in this response.
   */
  profile_binding: null | ProfileBinding;
  /**
   * Replay judgement for a retained Idempotency-Key record. Null means not evaluated, which for this endpoint currently means the Bridge keeps no Run Intake v2 key store; null never means the key is free.
   */
  idempotency: null | Judgement;
  /**
   * Backend lowering issues passed through verbatim. Empty means the Bridge has no lowering result to forward, not that lowering passed.
   */
  backend_issues: BackendIssue[];
  /**
   * blocked whenever any blocking issue or unresolved Profile reference exists; unknown only when nothing is known to block. It is never an execution or acceptance statement.
   */
  planning_status: "blocked" | "unknown";
  persistence: Persistence;
}
export interface Judgement {
  /**
   * False means the published compatibility matrix demands a rejection; accepted never carries a code.
   */
  accepted: boolean;
  code:
    | null
    | (
        | "unknown_nested_identity"
        | "explicit_migration_required"
        | "unsupported_contract_identity"
        | "missing_contract_identity"
        | "unknown_contract_identity"
        | "unknown_contract_revision"
        | "mixed_contract_version"
        | "idempotency_payload_mismatch"
        | "validation_report_stale"
      );
  scenario:
    | null
    | (
        | "old_client_to_new_server"
        | "new_client_to_old_server"
        | "v1_to_successor"
        | "successor_to_v1"
        | "identity_missing"
        | "unknown_identity"
        | "unknown_revision"
        | "mixed_version_payload"
        | "exact_replay"
        | "payload_mismatch"
        | "retained_historical_run"
        | "stale_profile_binding"
      );
  expected:
    | null
    | (
        | "accept_v1_unchanged"
        | "reject"
        | "reject_no_implicit_upgrade"
        | "reject_no_downgrade"
        | "accept_exact_replay"
        | "accept_exact_replay_original_identity"
      );
  /**
   * Stable resolution token; it is the only place where two rows of the same code are told apart.
   */
  detail: string;
  field_path: string;
  message: string;
  facts: {
    [k: string]: unknown;
  };
}
/**
 * Verbatim echo of the accepted submission's own declared facts. The runtime validator (bridge/contracts/agent_orchestration_phase2/validator.py) is the published-acceptance authority and enforces identity, schema_revision, intake_id, canonical_digest and the nested binding, but not the requested_fidelity, gpu_participation_mode or trace_source.mode enums, so those three stay unconstrained strings here: this document must describe what the endpoint can actually emit.
 */
export interface IntakeSummary {
  identity: "tilesim.bridge.agent_orchestration_run_intake.v2";
  /**
   * Copied from schema_revision; the runtime validator requires a sha256 here.
   */
  revision: string;
  /**
   * Copied from intake_id; the runtime validator requires a stable id here.
   */
  intake_id: string;
  /**
   * Exactly what the submission declared; the preview never recomputes or verifies it.
   */
  declared_canonical_digest: string;
  /**
   * Declared value, copied verbatim; it is not a resolved-fidelity statement and the preview does not map Analytical or DES onto Cycle.
   */
  requested_fidelity: string;
  gpu_participation_mode: string;
  /**
   * Copied from trace_source.mode; the preview does not upgrade trace provenance.
   */
  trace_source_mode: string;
}
export interface ProfileBinding {
  resolved: boolean;
  issues: ProfileIssue[];
  records_available: {
    model: number;
    engine: number;
    device: number;
    topology: number;
    workload: number;
  };
  planning_status: "blocked" | "unknown";
}
export interface ProfileIssue {
  code:
    | "profile_missing"
    | "unknown_profile"
    | "profile_unavailable"
    | "profile_ambiguous"
    | "profile_expired"
    | "profile_revision_mismatch"
    | "profile_digest_mismatch"
    | "profile_combination_incompatible"
    | "calibration_missing"
    | "execution_evidence_missing";
  message: string;
  field_path: string;
  blocking: true;
  safe_next_action: string;
}
export interface BackendIssue {
  /**
   * Verbatim backend code; the Bridge never renames it.
   */
  code: string;
  message: string;
  field_path: string;
  blocking: boolean;
  safe_next_action: string;
  [k: string]: unknown;
}
export interface Persistence {
  write_capability: "absent";
  /**
   * @minItems 3
   */
  forbidden_persistence: [
    "credential" | "hidden_reasoning" | "raw_provider_response",
    "credential" | "hidden_reasoning" | "raw_provider_response",
    "credential" | "hidden_reasoning" | "raw_provider_response",
    ...("credential" | "hidden_reasoning" | "raw_provider_response")[],
  ];
  idempotency: {
    same_key_same_payload: "exact_replay_or_terminal_not_retained";
    same_key_different_payload: "reject_409_idempotency_payload_mismatch";
    version_change: "different_payload_reject_same_key";
    profile_revision_change: "different_payload_reject_same_key";
    crash_retry: "resume_or_terminalize_without_duplicate_side_effect";
  };
  retention: {
    retained_result: "exact_replay_with_original_contract_identity";
    not_retained_result: "reject_terminal_not_retained";
    delete: "tombstone_key_without_payload_or_result";
    expiry: "tombstone_key_without_payload_or_result";
  };
}
export interface HttpsTilesimLocalContractsAgentOrchestrationPhase2ValidationReportSchemaJson {
  schema_identity: "tilesim.bridge.agent_orchestration_validation_report.v1";
  schema_revision: string;
  report_id: string;
  report_digest: string;
  input_binding: {
    kind: "draft" | "run_intake";
    identity: string;
    revision: string;
    digest: string;
  };
  profile_snapshot_binding: StableReference;
  capability_snapshot_binding: StableReference;
  backend_binding: {
    backend_revision: string;
    schema_set_revision: string;
  };
  validation_policy_revision: string;
  overall_status: "valid" | "invalid" | "infeasible" | "unsupported" | "unknown" | "stale" | "internal_failure";
  issues: Issue[];
  /**
   * @minItems 1
   */
  calculator_receipts: [
    HttpsTilesimLocalContractsAgentOrchestrationPhase2CalculatorReceiptSchemaJson,
    ...HttpsTilesimLocalContractsAgentOrchestrationPhase2CalculatorReceiptSchemaJson[],
  ];
  compiled_request_preview: {
    target_identity: string;
    target_revision: string;
    canonical_payload_digest: string;
    redacted_payload: {
      [k: string]: unknown;
    };
  };
  field_to_pointer_map: {
    source_field: string;
    target_pointer: string;
  }[];
  candidate_plan: {
    candidate_count: string;
    run_count: string;
    planning_status: "ready" | "blocked" | "unknown";
  };
  budget: {
    requested_runs: string;
    accepted_runs: string;
    wall_time_ps: string;
    status: "within_budget" | "exceeded" | "unknown";
  };
  claim_scope_ceiling:
    | "exploration"
    | "synthetic_consistency"
    | "limited_extrapolation"
    | "similar_regime_conditional_prediction"
    | "real_calibrated_validation";
  stale_binding: {
    is_stale: boolean;
    reasons: (
      | "profile_revision_or_digest_changed"
      | "capability_snapshot_changed"
      | "backend_or_schema_revision_changed"
      | "validation_policy_changed"
      | "calculator_algorithm_changed"
      | "workload_template_changed"
      | "compiled_request_changed"
      | "approval_missing_or_expired"
    )[];
    /**
     * @minItems 8
     */
    checked_bindings: [string, string, string, string, string, string, string, string, ...string[]];
  };
}
export interface Issue {
  rule_id: string;
  category:
    | "invalid"
    | "infeasible"
    | "unsupported"
    | "unknown"
    | "stale"
    | "profile_missing"
    | "revision_mismatch"
    | "calibration_missing"
    | "evidence_scope_insufficient"
    | "lowering_missing"
    | "budget_exceeded"
    | "calculator_unavailable"
    | "internal_failure";
  severity: "info" | "warning" | "error" | "fatal";
  blocking: boolean;
  status: "open" | "resolved" | "waived" | "not_applicable";
  field_references: string[];
  profile_references: ProfileReference[];
  facts: {
    [k: string]: string | boolean | null;
  };
  repair_candidates: {
    action_identity: string;
    description: string;
    safe: boolean;
  }[];
  supporting_receipt: StableReference | null;
  retryable: boolean;
  safe_next_action: string;
}
export interface HttpsTilesimLocalContractsAgentOrchestrationPhase2IdempotencyRetentionPolicySchemaJson {
  schema_identity: "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1";
  schema_revision: string;
  canonicalization_identity: "tilesim.bridge.canonical_json.v1";
  idempotency: {
    same_key_same_payload: "exact_replay_or_terminal_not_retained";
    same_key_different_payload: "reject_409_idempotency_payload_mismatch";
    version_change: "different_payload_reject_same_key";
    profile_revision_change: "different_payload_reject_same_key";
    crash_retry: "resume_or_terminalize_without_duplicate_side_effect";
  };
  retention: {
    retained_result: "exact_replay_with_original_contract_identity";
    not_retained_result: "reject_terminal_not_retained";
    delete: "tombstone_key_without_payload_or_result";
    expiry: "tombstone_key_without_payload_or_result";
  };
  /**
   * @minItems 3
   */
  forbidden_persistence: [
    "credential" | "hidden_reasoning" | "raw_provider_response",
    "credential" | "hidden_reasoning" | "raw_provider_response",
    "credential" | "hidden_reasoning" | "raw_provider_response",
    ...("credential" | "hidden_reasoning" | "raw_provider_response")[],
  ];
}
export interface Fact {
  value: unknown;
  unit: string | null;
  provenance: FieldProvenance;
}
export interface FieldProvenance {
  kind: "observed" | "externally_specified" | "inferred" | "modelled" | "user_supplied";
  source_reference: string;
  source_field: string;
  observed_at?: string | null;
  confidence?: string;
  evidence_scope:
    | "exploration"
    | "synthetic_consistency"
    | "limited_extrapolation"
    | "similar_regime_conditional_prediction"
    | "real_calibrated_validation";
}
export interface AgentFlowArtifactBinding {
  artifact_id: string;
  schema_identity: string;
  sha256: string;
  bytes: string;
}
export interface AgentFlowIdentityBinding {
  session_id: string;
  flow_id: string | null;
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  schema_set_revision: string;
  input_snapshot_digest: string | null;
  /**
   * @maxItems 256
   */
  artifact_bindings: AgentFlowArtifactBinding[];
}
export interface AgentFlowNavigationObservation {
  target_page: string;
  actual_page: string | null;
  page_correct: boolean;
  /**
   * @maxItems 32
   */
  current_page_capabilities: string[];
  current_run_id: string | null;
  current_context_revision: string | null;
  failure_type:
    | "navigation_error"
    | "context_unavailable"
    | "context_invalid"
    | "page_mismatch"
    | "capability_missing"
    | "stale_identity"
    | null;
  retry_allowed: boolean;
  /**
   * @maxItems 8
   */
  visited_pages:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
  navigation_attempts: number;
}
export interface AgentFlowStartRequest {
  schema_identity: "tilesim.agent_flow.start_request.v1";
  contract_revision: "2026-10-28.flow.v2";
  session_id: string;
  user_goal: string;
  intent:
    | "explain"
    | "existing_run_analysis"
    | "user_report"
    | "configuration_draft"
    | "navigation"
    | "unsupported_execution";
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  schema_set_revision: string;
  input_snapshot_digest: string | null;
  evidence_status?:
    "validated" | "deterministic_fallback" | "partial" | "truncated" | "missing" | "provider_unavailable";
  /**
   * @maxItems 256
   */
  artifact_bindings: AgentFlowArtifactBinding[];
  current_page?: string | null;
  /**
   * @maxItems 32
   */
  current_page_capabilities?: string[];
  current_context_revision?: string | null;
  /**
   * @maxItems 32
   */
  required_capabilities?: string[];
  /**
   * @maxItems 32
   */
  allowed_pages?: string[];
  /**
   * @maxItems 32
   */
  allowed_actions?: string[];
  navigation_attempts?: number;
  max_navigation_attempts?: number;
  authorization_id?: string;
  authorization_digest?: string;
  authorization_budget?: AuthorizationBudget;
  principal?: string;
  workspace_id?: string;
}
export interface AuthorizationBudget {
  max_navigation_attempts: number;
  max_model_calls: number;
  max_tool_calls_per_round: number;
  max_run_creations: number;
  max_execution_time_ms: number;
}
export interface AgentFlowResumeRequest {
  schema_identity: "tilesim.agent_flow.resume_request.v1";
  contract_revision: "2026-10-28.flow.v2";
  flow_id: string;
  session_id: string;
  action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | "cancel" | "reject";
  intent?:
    | "explain"
    | "existing_run_analysis"
    | "user_report"
    | "configuration_draft"
    | "navigation"
    | "unsupported_execution";
  pending_action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | null;
  navigation_observation?: AgentFlowNavigationObservation;
  current_binding: AgentFlowIdentityBinding;
  current_event_sequence: number;
  clarification?: string | null;
  reason?: string | null;
  approval_digest?: string | null;
  authorization_id?: string;
  authorization_digest?: string;
  authorization_budget?: {
    max_navigation_attempts: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  principal?: string;
  workspace_id?: string;
}
export interface AgentFlowState {
  schema_identity: "tilesim.agent_flow.state.v1";
  contract_revision: "2026-10-28.flow.v2";
  flow_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  intent:
    | "explain"
    | "existing_run_analysis"
    | "user_report"
    | "configuration_draft"
    | "navigation"
    | "unsupported_execution";
  status:
    "created" | "running" | "waiting_user" | "completed" | "draft_ready" | "stale" | "refused" | "cancelled" | "failed";
  node: string;
  event_sequence: number;
  binding: AgentFlowIdentityBinding;
  pending_action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | null;
  approval: {
    [k: string]: unknown;
  } | null;
  authorization: {
    status: "active" | "revoked" | "expired" | "exhausted";
    authorization_id: string;
    authorization_digest: string;
    budget: AuthorizationBudget;
    usage: {
      navigation_attempts: number;
      model_calls: number;
      tool_calls_per_round: number;
      run_creations: number;
      execution_time_ms: number;
    };
    remaining: {
      max_navigation_attempts: number;
      max_model_calls: number;
      max_tool_calls_per_round: number;
      max_run_creations: number;
      max_execution_time_ms: number;
    };
  } | null;
  validation: {
    [k: string]: unknown;
  } | null;
  evidence: {
    [k: string]: unknown;
  } | null;
  report: {
    [k: string]: unknown;
  } | null;
  terminal_reason: string | null;
  checkpoint_id: string | null;
  created_at: string;
  updated_at: string;
  current_page?: string | null;
  /**
   * @maxItems 32
   */
  current_page_capabilities?: string[];
  current_context_revision?: string | null;
  /**
   * @maxItems 32
   */
  required_capabilities?: string[];
  /**
   * @maxItems 32
   */
  allowed_pages?: string[];
  /**
   * @maxItems 32
   */
  allowed_actions?: string[];
  /**
   * @maxItems 8
   */
  visited_pages?:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
  navigation_attempts?: number;
  max_navigation_attempts?: number;
  /**
   * @maxItems 8
   */
  navigation_failures?:
    | []
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ];
  last_navigation_observation?: AgentFlowNavigationObservation | null;
  navigation_target?: string | null;
}
export interface AgentFlowEvent {
  schema_identity: "tilesim.agent_flow.event.v1";
  contract_revision: "2026-10-28.flow.v2";
  event_id: string;
  sequence: number;
  flow_id: string;
  session_id: string;
  node: string;
  event_type:
    | "flow_started"
    | "node_started"
    | "node_completed"
    | "interrupt"
    | "approval_required"
    | "state_changed"
    | "terminal"
    | "error";
  state: AgentFlowState;
  binding: AgentFlowIdentityBinding;
  pending_action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | null;
  payload: {
    [k: string]: unknown;
  };
  created_at: string;
}
export interface AgentFlowStartResponse {
  flow: AgentFlowState;
  idempotent_replay: boolean;
}
export interface AgentFlowStatusResponse {
  flow: AgentFlowState;
}
export interface AgentFlowEventsResponse {
  flow: AgentFlowState;
  events: AgentFlowEvent[];
  after_sequence: number;
  terminal: boolean;
}
export interface AgentFlowResumeResponse {
  flow: AgentFlowState;
  events: AgentFlowEvent[];
  idempotent_replay: boolean;
  action: string;
}
export interface AgentIntentPageEntry {
  page_id: string;
  route_name: string;
  /**
   * @maxItems 64
   */
  capability_ids: string[];
  supports_run: boolean;
  context_revision?: string;
}
export interface AgentIntentRequest {
  schema_identity: "tilesim.agent_intent.request.v1";
  contract_revision: "2026-10-28.agent-intent.v1";
  session_id: string;
  user_goal: string;
  current_page: {
    page_id: string;
    route_name: string;
    /**
     * @maxItems 64
     */
    capability_ids: string[];
    context_revision: string;
  };
  /**
   * @minItems 1
   * @maxItems 64
   */
  page_catalog: [
    {
      page_id: string;
      route_name: string;
      /**
       * @maxItems 64
       */
      capability_ids: string[];
      supports_run: boolean;
    },
    ...{
      page_id: string;
      route_name: string;
      /**
       * @maxItems 64
       */
      capability_ids: string[];
      supports_run: boolean;
    }[],
  ];
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  schema_set_revision: string;
  input_snapshot_digest: string | null;
}
export interface AgentIntentResponse {
  schema_identity: "tilesim.agent_intent.response.v1";
  contract_revision: "2026-10-28.agent-intent.v1";
  schema_set_revision: string;
  protocol: "tilesim.agent_intent.v1";
  session_id: string;
  user_goal: string;
  intent:
    | "explain"
    | "existing_run_analysis"
    | "user_report"
    | "configuration_draft"
    | "navigation"
    | "simulation_execution"
    | "unsupported_execution";
  current_page_id: string;
  current_context_revision: string;
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string | null;
  /**
   * @maxItems 32
   */
  candidate_pages: {
    page_id: string;
    route_name: string;
    /**
     * @maxItems 64
     */
    required_capabilities: string[];
    reason: string;
  }[];
  /**
   * @maxItems 64
   */
  required_capabilities: string[];
  risk_level: "low" | "medium" | "high" | "critical";
  requires_user_confirmation: boolean;
  /**
   * @maxItems 16
   */
  suggested_steps:
    | []
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ]
    | [
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
        {
          kind: "navigate" | "observe" | "clarify" | "authorize" | "execute" | "report";
          description: string;
          page_id: string | null;
        },
      ];
  /**
   * @maxItems 8
   */
  clarification_questions:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
}

export interface RequestAttributionArtifact {
  schema_version: "tilesim.request_attribution.v1";
  run_id: string;
  /**
   * @minItems 1
   */
  requests: [
    {
      schema_version: "tilesim.tail_cause_chain_report.v1";
      run_id: string;
      report_id: string;
      explained_entity: {
        kind: "request";
        id: string;
        [k: string]: unknown;
      };
      /**
       * @minItems 1
       */
      cause_chain: [AttributionRow, ...AttributionRow[]];
      /**
       * @minItems 1
       */
      attribution_ranking: [AttributionRow, ...AttributionRow[]];
      [k: string]: unknown;
    },
    ...{
      schema_version: "tilesim.tail_cause_chain_report.v1";
      run_id: string;
      report_id: string;
      explained_entity: {
        kind: "request";
        id: string;
        [k: string]: unknown;
      };
      /**
       * @minItems 1
       */
      cause_chain: [AttributionRow, ...AttributionRow[]];
      /**
       * @minItems 1
       */
      attribution_ranking: [AttributionRow, ...AttributionRow[]];
      [k: string]: unknown;
    }[],
  ];
  metrics: {
    schema_version: "tilesim.metrics_report.v1";
    run_id: string;
    /**
     * @minItems 1
     */
    request_metrics: [
      {
        request_id: string;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        ttft_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        tpot_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        end_to_end_latency_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        network_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        device_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        collective_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_bytes_read?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_bytes_migrated?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_eviction_bytes?: bigint;
        has_ttft_sample?: boolean;
        has_tpot_sample?: boolean;
        has_end_to_end_latency_sample?: boolean;
        [k: string]: unknown;
      },
      ...{
        request_id: string;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        ttft_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        tpot_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        end_to_end_latency_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        network_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        device_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        collective_wait_ps?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_bytes_read?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_bytes_migrated?: bigint;
        /**
         * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
         */
        kv_eviction_bytes?: bigint;
        has_ttft_sample?: boolean;
        has_tpot_sample?: boolean;
        has_end_to_end_latency_sample?: boolean;
        [k: string]: unknown;
      }[],
    ];
    [k: string]: unknown;
  };
  evidence: {
    run_id: string;
    des_committed_event_digest: string;
    des_events: unknown[];
    resource_operations: unknown[];
    network_demands: unknown[];
    fabric: {
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
}
export interface AttributionRow {
  attribution_id?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  rank?: bigint;
  subject_refs: {
    [k: string]: unknown;
  }[];
  /**
   * @minItems 1
   */
  evidence_refs: [RequestAttributionEvidenceRef, ...RequestAttributionEvidenceRef[]];
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps?: bigint;
  subsystem?: string;
  cause_code?: string;
  title?: string;
  evidence?: string;
  component_code?: string;
  detail?: string;
  score_ps?: number;
  share?: number;
  evidence_link?: string;
  model_execution_call_id?: string;
  execution_id?: string;
  kv_operation_id?: string;
  network_demand_id?: string;
  device_task_id?: string;
  collective_id?: string;
  pd_handoff_id?: string;
  pd_disaggregation_group_id?: string;
  pd_source_placement_group_id?: string;
  pd_destination_placement_group_id?: string;
  network_intervals?: RequestAttributionNetworkInterval[];
  [k: string]: unknown;
}
export interface RequestAttributionEvidenceRef {
  run_id: string;
  artifact_id: "request_attribution";
  schema_identity: "tilesim.request_attribution.v1";
  json_pointer: string;
  availability: "available";
  subject: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface RequestAttributionNetworkInterval {
  component_code?: string;
  demand_id?: string;
  link_id?: string;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  attempt?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  start_time_ps?: bigint;
  /**
   * A JSON integer that MUST be parsed and retained losslessly; JavaScript Number is not a conforming representation.
   */
  end_time_ps?: bigint;
  evidence?: string;
  unresolved_reason?: string;
  evidence_refs?: RequestAttributionEvidenceRef[];
  [k: string]: unknown;
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
  model_ids: string[];
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

export interface DeleteRunResponse {
  run_id: string;
  deleted: true;
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

export interface AssistantModelChatRequest {
  /**
   * The transcript the client already shows, oldest first, ending with the user's turn. Only the user and assistant roles are accepted.
   *
   * @minItems 1
   * @maxItems 12
   */
  messages:
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ];
  /**
   * The current panel values, keyed by bare parameter name. Read-only context for the model; never executed or written.
   */
  panel_values?: {
    [k: string]: string;
  };
}

export interface AssistantResultAnalysisRequest {
  /**
   * The client-side transcript, ending with the user's result question.
   *
   * @minItems 1
   * @maxItems 12
   */
  messages:
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ]
    | [
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
        {
          role: "user" | "assistant";
          content: string;
        },
      ];
  context: {
    run_id: string;
    /**
     * @minItems 1
     * @maxItems 8
     */
    sections:
      | [
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ]
      | [
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
          {
            title: string;
            body: string;
          },
        ];
    /**
     * @maxItems 64
     */
    evidence_paths: string[];
    evidence: {
      manifest_status: "verified" | "unavailable" | "run_mismatch";
      artifact_count: number;
      full_content_count: number;
      summary_only_count: number;
      unavailable_count: number;
      rejected_count: number;
      /**
       * @maxItems 32
       */
      artifacts: {
        artifact_id: string;
        file_name: string;
        report_kind: string | null;
        schema_identity: string;
        sha256: string;
        bytes: string;
        contract_status: "supported" | "legacy_compatibility" | "not_applicable";
        content_status: "full" | "summary_only" | "unavailable" | "not_applicable" | "expected_absence";
        content?: unknown;
        omission_reason?: "too_large_for_model_context" | "verification_failed";
      }[];
      /**
       * @maxItems 64
       */
      rejected_artifacts: {
        artifact_id: string;
        schema_identity: string;
        reason: string;
        json_pointer: string;
      }[];
    };
  };
}

export interface AssistantModelDescriptorResponse {
  schema_version: string;
  schema_set_revision: string;
  protocol: string;
  availability: "available" | "unavailable";
  configured: boolean;
  degradation_state: "available" | "not_configured" | "misconfigured";
  detail: string;
  provider: {
    configured: boolean;
    provider_id: string;
    model_id: string;
    model_revision: string;
  };
  limits: {
    maximum_instruction_characters: number;
    maximum_settings: number;
  };
}

export interface AssistantModelPlanRequest {
  instruction: string;
}

export interface AssistantModelPlanResponse {
  schema_version: string;
  schema_set_revision: string;
  protocol: string;
  provider_id: string;
  model_id: string;
  served_model: string;
  instruction: string;
  /**
   * settings: a settings block was read. prose_only: the model answered in prose and proposed nothing. settings_unparsed: a settings block was present but could not be read, so no value is proposed.
   */
  answer_state: "settings" | "prose_only" | "settings_unparsed";
  title: string;
  rationale: string;
  settings: {
    key: string;
    value: string;
    why: string;
  }[];
  /**
   * Optional complete synthetic runtime_trace and topology proposal. The page validates and applies it atomically; it never creates a run.
   */
  structured_inputs?: {
    /**
     * Validated synthetic runtime trace document.
     */
    runtime_trace: {
      [k: string]: unknown;
    };
    /**
     * Validated synthetic topology document.
     */
    topology: {
      [k: string]: unknown;
    };
  };
  dropped: {
    key: string;
    reason: string;
  }[];
  applied: boolean;
  executed: boolean;
}

export interface AssistantModelCatalogueResponse {
  schema_version: string;
  schema_set_revision: string;
  protocol: string;
  provider_id: string;
  /**
   * The model identities the configured service publishes, in the order it published them and without duplicates. Read with the credential the channel already holds; the credential is never part of this response.
   *
   * @minItems 1
   */
  models: [string, ...string[]];
  count: number;
  /**
   * The identity the next request will use: a panel selection when one is in force for this process, otherwise the configured identity.
   */
  selected_model: string;
  /**
   * True when selected_model came from a panel selection for this process rather than from the saved configuration.
   */
  session_override: boolean;
}

export interface AssistantModelSelectionRequest {
  model: string;
}

export interface AssistantModelSelectionResponse {
  schema_version: string;
  schema_set_revision: string;
  protocol: string;
  provider_id: string;
  selected_model: string;
  previous_model: string;
  /**
   * True, always: the identity is the one this Bridge process uses from the next request on.
   */
  in_force: boolean;
  /**
   * False, always: this endpoint never writes the saved configuration, which stays owned by the launcher.
   */
  persisted: boolean;
  /**
   * True, always: the selection lasts until this Bridge process is restarted.
   */
  session_only: boolean;
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

export interface AgentOrchestrationCapabilitySnapshotResponse {
  schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1";
  publication_status: "published";
  snapshot_id: string;
  snapshot_revision: string;
  snapshot_digest: string;
  canonicalization_identity: "tilesim.bridge.canonical_json.v1";
  catalog: AgentOrchestrationCapabilityCatalog;
  release_binding: {
    web_source_identity: "tilesim.web.git";
    web_source_revision: string;
    web_build_revision: string;
    backend_identity: "tilesim.backend.git";
    backend_revision: string;
    schema_set_revision: string;
    experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1";
    experiment_descriptor_revision: string;
    create_run_identity: "tilesim.bridge.create_run_request.v1";
    catalog_revision: string;
    contract_package_revision: string;
    /**
     * @minItems 2
     * @maxItems 2
     */
    nested_design_space_identities: [unknown, unknown];
    default_nested_design_space_identity:
      "tilesim.design_space.s6_candidates.v1" | "tilesim.design_space.s6_candidates.v2";
  };
  drift_policy: {
    release_binding_mismatch: "fail_closed";
    catalog_revision_mismatch: "fail_closed";
    unknown_identity_or_status: "fail_closed";
  };
}
export interface AgentOrchestrationCapabilityCatalog {
  schema_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1";
  publication_status: "published";
  catalog_id: string;
  catalog_revision: string;
  catalog_digest: string;
  contract_package_revision: string;
  parameter_descriptor_schema_identity: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1";
  parameter_descriptor_schema_revision: string;
  parameter_descriptor_schema_digest: string;
  /**
   * @minItems 8
   * @maxItems 8
   */
  parameter_descriptors: [
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
    AgentOrchestrationParameterDescriptor,
  ];
  /**
   * @minItems 5
   * @maxItems 5
   */
  profile_families: [
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
    ProfileAvailability,
  ];
  profile_records: {
    /**
     * @maxItems 0
     */
    model: [];
    /**
     * @maxItems 0
     */
    engine: [];
    /**
     * @maxItems 0
     */
    device: [];
    /**
     * @maxItems 0
     */
    topology: [];
    /**
     * @maxItems 0
     */
    workload: [];
  };
  /**
   * @minItems 8
   * @maxItems 8
   */
  agent_exposed_field_ids: [string, string, string, string, string, string, string, string];
  /**
   * @minItems 9
   * @maxItems 9
   */
  not_exposed_capabilities: [
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
    NotExposedCapability,
  ];
  /**
   * @minItems 2
   * @maxItems 2
   */
  claim_scope_ceiling: [unknown, unknown];
}
export interface AgentOrchestrationParameterDescriptor {
  field_id: string;
  owner_module:
    | "工作负载抽象与负载描述语言模块"
    | "推理引擎与服务运行时模块"
    | "执行语义建模模块"
    | "KV Cache 建模模块"
    | "设备性能建模模块"
    | "集合通信语义模块"
    | "网络与硬件资源模块"
    | "统一仿真内核模块"
    | "场景与探索编排模块"
    | "校准验证与指标归因模块"
    | "基于 Agent 的仿真编排模块";
  value_type: "number" | "integer" | "enum";
  canonical_unit: string;
  /**
   * @minItems 1
   */
  accepted_units: [string, ...string[]];
  constraints: {
    minimum?: string;
    maximum?: string;
    step?: string;
    /**
     * @minItems 1
     */
    enum?: [string, ...string[]];
  };
  applicability: {
    status: "available" | "conditional";
    /**
     * @minItems 1
     */
    conditions: [string, ...string[]];
  };
  request_identity: "tilesim.bridge.create_run_request.v1";
  request_json_pointer: string;
  lowering_stage: string;
  /**
   * @minItems 1
   */
  execution_evidence: [EvidenceReference, ...EvidenceReference[]];
  capability_state: {
    described: CapabilityDimension;
    accepted: CapabilityDimension;
    validated: CapabilityDimension;
    lowered: CapabilityDimension;
    executed: CapabilityDimension;
    observable: CapabilityDimension;
    calibrated: CapabilityDimension;
    held_out_validated: CapabilityDimension;
    agent_exposed: CapabilityDimension;
  };
  /**
   * @minItems 1
   */
  reason_codes: [
    (
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    ),
    ...(
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    )[],
  ];
  /**
   * @minItems 2
   * @maxItems 2
   */
  claim_scope_ceiling: [unknown, unknown];
  resolved_fidelity: "Analytical" | "DES" | "mixed";
}
export interface EvidenceReference {
  repository: "D:/tileSim" | "D:/tileSim-web";
  revision: string;
  path: string;
  test_case: string;
  evidence_class: "contract" | "lowering" | "synthetic_deterministic_execution" | "artifact_observation";
  /**
   * @minItems 1
   */
  artifact_pointers: [string, ...string[]];
}
export interface CapabilityDimension {
  state: "affirmed" | "denied";
  reason_code:
    | "execution_closure_proven"
    | "gap_kv_001_logical_admission_only"
    | "profile_missing"
    | "minimal_engine_profiles_not_catalog_published"
    | "create_run_engine_selection_not_exposed"
    | "calibration_missing"
    | "held_out_validation_missing"
    | "not_exposed_to_agent"
    | "resolved_scale_out_analytical";
}
export interface ProfileAvailability {
  family: "model" | "engine" | "device" | "topology" | "workload";
  schema_identity: string;
  schema_revision: string;
  schema_digest: string;
  schema_status: "published";
  actual_profile_count: 0;
  data_status: "profile_missing" | "conditional";
  runtime_availability: "unavailable";
  /**
   * @minItems 1
   */
  reason_codes: [
    (
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    ),
    ...(
      | "execution_closure_proven"
      | "gap_kv_001_logical_admission_only"
      | "profile_missing"
      | "minimal_engine_profiles_not_catalog_published"
      | "create_run_engine_selection_not_exposed"
      | "calibration_missing"
      | "held_out_validation_missing"
      | "not_exposed_to_agent"
      | "resolved_scale_out_analytical"
    )[],
  ];
  calibration_status: "calibration_missing";
  held_out_validation_status: "held_out_validation_missing";
}
export interface NotExposedCapability {
  capability_id:
    | "model_selection"
    | "device_selection"
    | "engine_selection"
    | "tensor_parallel_degree"
    | "pipeline_parallel_degree"
    | "expert_parallel_degree"
    | "physical_kv_policy"
    | "collective_algorithm"
    | "slo";
  state: "not_exposed";
  reason_code: "not_exposed_to_agent";
}

export interface OptimizationSessionCreateRequest {
  [k: string]: unknown;
}

export interface OptimizationApprovalRequest {
  candidate_id?: string;
  approval_digest?: string;
  expires_at?: string;
  idempotency_key?: string;
}

export interface OptimizationActionRequest {
  session_id: string;
  action: "pause" | "resume" | "cancel" | "retry";
  idempotency_key?: string;
}

export interface OptimizationSessionResponse {
  session: TilesimAgentHarnessOptimizationSessionV1;
  detail?: {
    [k: string]: unknown;
  };
  provenance: {
    [k: string]: unknown;
  };
  idempotent_replay?: boolean;
}
export interface TilesimAgentHarnessOptimizationSessionV1 {
  schema_identity: "tilesim.agent_harness.optimization_session.v1";
  contract_revision: "2026-10-19.wpd.v1";
  session_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_optimization.policy.v1";
  objective: {
    [k: string]: unknown;
  };
  /**
   * @maxItems 32
   */
  constraints: unknown[];
  budget: {
    [k: string]: unknown;
  };
  base_config: {
    [k: string]: unknown;
  };
  local_dev: true;
  automatic_submission: false;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  current_candidate_id?: string | null;
  current_iteration?: number;
  run_count?: number;
  failure_count?: number;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  autonomy?: "off" | "propose" | "auto";
  authorization_id?: string | null;
  authorization_digest?: string | null;
  authorization?: TilesimAgentHarnessOptimizationAuthorizationV1;
  /**
   * @maxItems 128
   */
  agent_turns?: {
    [k: string]: unknown;
  }[];
  active_operation_id?: string | null;
  summary?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}
export interface TilesimAgentHarnessOptimizationAuthorizationV1 {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1";
  contract_revision: "2026-10-28.wpf.v1";
  authorization_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string;
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds: number;
    max_runs: number;
    max_seconds: number;
    max_failures: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement: number;
    plateau_rounds: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  protected: {
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    schema_set_revision: string;
    backend_identity: {
      [k: string]: unknown;
    };
  };
  status: "active" | "exhausted" | "revoked" | "expired";
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
  authorization_digest: string;
  ttl_seconds?: number;
}

export interface OptimizationSessionListResponse {
  sessions: TilesimAgentHarnessOptimizationSessionV1[];
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessOptimizationSessionV1 {
  schema_identity: "tilesim.agent_harness.optimization_session.v1";
  contract_revision: "2026-10-19.wpd.v1";
  session_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_optimization.policy.v1";
  objective: {
    [k: string]: unknown;
  };
  /**
   * @maxItems 32
   */
  constraints: unknown[];
  budget: {
    [k: string]: unknown;
  };
  base_config: {
    [k: string]: unknown;
  };
  local_dev: true;
  automatic_submission: false;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  current_candidate_id?: string | null;
  current_iteration?: number;
  run_count?: number;
  failure_count?: number;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  autonomy?: "off" | "propose" | "auto";
  authorization_id?: string | null;
  authorization_digest?: string | null;
  authorization?: TilesimAgentHarnessOptimizationAuthorizationV1;
  /**
   * @maxItems 128
   */
  agent_turns?: {
    [k: string]: unknown;
  }[];
  active_operation_id?: string | null;
  summary?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}
export interface TilesimAgentHarnessOptimizationAuthorizationV1 {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1";
  contract_revision: "2026-10-28.wpf.v1";
  authorization_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string;
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds: number;
    max_runs: number;
    max_seconds: number;
    max_failures: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement: number;
    plateau_rounds: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  protected: {
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    schema_set_revision: string;
    backend_identity: {
      [k: string]: unknown;
    };
  };
  status: "active" | "exhausted" | "revoked" | "expired";
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
  authorization_digest: string;
  ttl_seconds?: number;
}

export interface OptimizationSessionEventsResponse {
  session_id: string;
  events: TilesimAgentHarnessOptimizationEventV1[];
  after_sequence?: number;
  terminal: boolean;
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessOptimizationEventV1 {
  schema_identity: "tilesim.agent_harness.optimization_event.v1";
  contract_revision: "2026-10-19.wpd.v1";
  session_id: string;
  event_id: string;
  sequence: number;
  state: string;
  node: string;
  payload_digest: string;
  created_at?: string;
  provenance: {
    [k: string]: unknown;
  };
}

export interface OptimizationApprovalResponse {
  approval: TilesimAgentHarnessOptimizationApprovalV1;
  session: TilesimAgentHarnessOptimizationSessionV1;
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessOptimizationApprovalV1 {
  schema_identity: "tilesim.agent_harness.optimization_approval.v1";
  contract_revision: "2026-10-19.wpd.v1";
  approval_id: string;
  session_id: string;
  candidate_id: string;
  candidate_digest: string;
  approval_digest: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: string;
  status: "approved" | "rejected" | "expired" | "revoked" | "stale";
  expires_at: string;
  consumed: boolean;
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessOptimizationSessionV1 {
  schema_identity: "tilesim.agent_harness.optimization_session.v1";
  contract_revision: "2026-10-19.wpd.v1";
  session_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_optimization.policy.v1";
  objective: {
    [k: string]: unknown;
  };
  /**
   * @maxItems 32
   */
  constraints: unknown[];
  budget: {
    [k: string]: unknown;
  };
  base_config: {
    [k: string]: unknown;
  };
  local_dev: true;
  automatic_submission: false;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  current_candidate_id?: string | null;
  current_iteration?: number;
  run_count?: number;
  failure_count?: number;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  autonomy?: "off" | "propose" | "auto";
  authorization_id?: string | null;
  authorization_digest?: string | null;
  authorization?: TilesimAgentHarnessOptimizationAuthorizationV1;
  /**
   * @maxItems 128
   */
  agent_turns?: {
    [k: string]: unknown;
  }[];
  active_operation_id?: string | null;
  summary?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}
export interface TilesimAgentHarnessOptimizationAuthorizationV1 {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1";
  contract_revision: "2026-10-28.wpf.v1";
  authorization_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string;
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds: number;
    max_runs: number;
    max_seconds: number;
    max_failures: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement: number;
    plateau_rounds: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  protected: {
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    schema_set_revision: string;
    backend_identity: {
      [k: string]: unknown;
    };
  };
  status: "active" | "exhausted" | "revoked" | "expired";
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
  authorization_digest: string;
  ttl_seconds?: number;
}

export interface OptimizationAuthorizationGetResponse {
  authorization: TilesimAgentHarnessOptimizationAuthorizationV1 | null;
  session_id: string;
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessOptimizationAuthorizationV1 {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1";
  contract_revision: "2026-10-28.wpf.v1";
  authorization_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string;
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds: number;
    max_runs: number;
    max_seconds: number;
    max_failures: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement: number;
    plateau_rounds: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  protected: {
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    schema_set_revision: string;
    backend_identity: {
      [k: string]: unknown;
    };
  };
  status: "active" | "exhausted" | "revoked" | "expired";
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
  authorization_digest: string;
  ttl_seconds?: number;
}

export interface OptimizationAuthorizationRequest {
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds?: number;
    max_runs?: number;
    max_seconds?: number;
    max_failures?: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind?: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement?: number;
    plateau_rounds?: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  ttl_seconds?: number;
}

export interface OptimizationAuthorizationResponse {
  authorization: TilesimAgentHarnessOptimizationAuthorizationV1;
  session: TilesimAgentHarnessOptimizationSessionV1;
  detail: {
    [k: string]: unknown;
  };
  idempotent_replay?: boolean;
  autonomous_started?: boolean;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
}
export interface TilesimAgentHarnessOptimizationAuthorizationV1 {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1";
  contract_revision: "2026-10-28.wpf.v1";
  authorization_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  input_snapshot_digest: string;
  autonomy_level: "bounded_autonomous" | "human_approves_each";
  budget: {
    max_rounds: number;
    max_runs: number;
    max_seconds: number;
    max_failures: number;
    max_model_calls: number;
    max_tool_calls_per_round: number;
    max_navigation_attempts: number;
    max_run_creations: number;
    max_execution_time_ms: number;
  };
  /**
   * @maxItems 64
   */
  parameter_grants: {
    pointer: string;
    min: number;
    max: number;
    step: number;
    kind: "int" | "integer" | "number" | "float";
  }[];
  objective: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement: number;
    plateau_rounds: number;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  tool_allowlist: [
    "get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics",
    ...("get_capability_catalog" | "get_run_status" | "list_run_evidence" | "query_verified_metrics")[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_pages: [
    (
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    ),
    ...(
      | "overview"
      | "execution"
      | "replay"
      | "metrics"
      | "fabric"
      | "attribution"
      | "validation"
      | "raw_evidence"
      | "evidence_agent"
      | "evidence_lab"
      | "design_space"
      | "history"
      | "experiment"
    )[],
  ];
  /**
   * @minItems 1
   * @maxItems 32
   */
  allowed_actions: [
    "explain" | "navigate" | "analyze" | "report" | "draft" | "execute",
    ...("explain" | "navigate" | "analyze" | "report" | "draft" | "execute")[],
  ];
  protected: {
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    schema_set_revision: string;
    backend_identity: {
      [k: string]: unknown;
    };
  };
  status: "active" | "exhausted" | "revoked" | "expired";
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  provenance: {
    deployment_mode: "local_dev";
    source_mode: "synthetic_trace";
    claim_scope: "exploratory";
    production_status: "not_for_production";
  };
  authorization_digest: string;
  ttl_seconds?: number;
}
export interface TilesimAgentHarnessOptimizationSessionV1 {
  schema_identity: "tilesim.agent_harness.optimization_session.v1";
  contract_revision: "2026-10-19.wpd.v1";
  session_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_optimization.policy.v1";
  objective: {
    [k: string]: unknown;
  };
  /**
   * @maxItems 32
   */
  constraints: unknown[];
  budget: {
    [k: string]: unknown;
  };
  base_config: {
    [k: string]: unknown;
  };
  local_dev: true;
  automatic_submission: false;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  current_candidate_id?: string | null;
  current_iteration?: number;
  run_count?: number;
  failure_count?: number;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  autonomy?: "off" | "propose" | "auto";
  authorization_id?: string | null;
  authorization_digest?: string | null;
  authorization?: TilesimAgentHarnessOptimizationAuthorizationV1;
  /**
   * @maxItems 128
   */
  agent_turns?: {
    [k: string]: unknown;
  }[];
  active_operation_id?: string | null;
  summary?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface BatchActionRequest {
  batch_id: string;
  action: "start" | "pause" | "resume" | "cancel" | "retry";
  recovery_acknowledged?: boolean;
  idempotency_key?: string;
}

export interface BatchApprovalRequest {
  approval_digest?: string;
  expires_at?: string;
  idempotency_key?: string;
}

export interface BatchCreateRequest {
  schema_identity: "tilesim.agent_harness.batch_session.v1";
  contract_revision: "2026-10-19.wpe.v1";
}

export interface BatchEventsResponse {
  batch_id: string;
  events: TilesimAgentHarnessBatchEventV1[];
  after_sequence?: number;
  terminal: boolean;
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessBatchEventV1 {
  schema_identity: "tilesim.agent_harness.batch_event.v1";
  contract_revision: "2026-10-19.wpe.v1";
  batch_id: string;
  event_id: string;
  sequence: number;
  state: string;
  node: string;
  payload_digest: string;
  created_at?: string;
  provenance: {
    [k: string]: unknown;
  };
}

export interface BatchListResponse {
  batches: TilesimAgentHarnessBatchSessionV1[];
  provenance: {
    [k: string]: unknown;
  };
}
export interface TilesimAgentHarnessBatchSessionV1 {
  schema_identity: "tilesim.agent_harness.batch_session.v1";
  contract_revision: "2026-10-19.wpe.v1";
  batch_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_batch.policy.v1";
  plan: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  candidate_set: [
    {
      [k: string]: unknown;
    },
    ...{
      [k: string]: unknown;
    }[],
  ];
  objective: TilesimAgentHarnessBatchObjectiveV1;
  budget: TilesimAgentHarnessBatchBudgetV1;
  concurrency_policy: TilesimAgentHarnessConcurrencyPolicyV1;
  stop_policy: TilesimAgentHarnessStopPolicyV1;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  approval_required: true;
  auto_execute: boolean;
  local_dev: true;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  status?: string;
  approval?: TilesimAgentHarnessBatchApprovalV1;
  summary?: {
    [k: string]: unknown;
  } | null;
  stop_reason?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}
export interface TilesimAgentHarnessBatchObjectiveV1 {
  schema_identity: "tilesim.agent_harness.batch_objective.v1";
  contract_revision: "2026-10-19.wpe.v1";
  metric_path: string;
  direction: "minimize" | "maximize";
  policy_revision: string;
  digest?: string;
  value?: number | null;
  status?: "pending" | "verified" | "unavailable" | "rejected";
}
export interface TilesimAgentHarnessBatchBudgetV1 {
  max_candidates: number;
  max_runs: number;
  max_seconds: number;
  max_concurrency: 1;
  max_failures: number;
  max_retries: number;
  resource_units: number;
  max_no_improvement: number;
}
export interface TilesimAgentHarnessConcurrencyPolicyV1 {
  schema_identity: "tilesim.agent_harness.concurrency_policy.v1";
  contract_revision: "2026-10-19.wpe.v1";
  max_concurrency: 1;
  queue_policy: "bounded_fifo";
}
export interface TilesimAgentHarnessStopPolicyV1 {
  schema_identity: "tilesim.agent_harness.stop_policy.v1";
  contract_revision: "2026-10-19.wpe.v1";
  on_failure: "continue" | "stop";
  on_no_improvement: "stop";
}
export interface TilesimAgentHarnessBatchApprovalV1 {
  schema_identity: "tilesim.agent_harness.batch_approval.v1";
  contract_revision: "2026-10-19.wpe.v1";
  approval_id: string;
  batch_id: string;
  approval_digest: string;
  status: "approved" | "consumed" | "expired" | "revoked";
  single_use: true;
  consumed: boolean;
  expires_at: string;
  consumed_at?: string;
  created_at?: string;
  provenance: {
    [k: string]: unknown;
  };
}

export interface BatchResponse {
  batch: TilesimAgentHarnessBatchSessionV1;
  detail?: {
    [k: string]: unknown;
  };
  provenance: {
    [k: string]: unknown;
  };
  idempotent_replay?: boolean;
}
export interface TilesimAgentHarnessBatchSessionV1 {
  schema_identity: "tilesim.agent_harness.batch_session.v1";
  contract_revision: "2026-10-19.wpe.v1";
  batch_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: {
    [k: string]: unknown;
  };
  policy_revision: "tilesim.agent_harness.local_batch.policy.v1";
  plan: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   * @maxItems 32
   */
  candidate_set: [
    {
      [k: string]: unknown;
    },
    ...{
      [k: string]: unknown;
    }[],
  ];
  objective: TilesimAgentHarnessBatchObjectiveV1;
  budget: TilesimAgentHarnessBatchBudgetV1;
  concurrency_policy: TilesimAgentHarnessConcurrencyPolicyV1;
  stop_policy: TilesimAgentHarnessStopPolicyV1;
  execution_request?: {
    [k: string]: unknown;
  } | null;
  approval_required: true;
  auto_execute: boolean;
  local_dev: true;
  provenance: {
    [k: string]: unknown;
  };
  state?: string;
  status?: string;
  approval?: TilesimAgentHarnessBatchApprovalV1;
  summary?: {
    [k: string]: unknown;
  } | null;
  stop_reason?: {
    [k: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}
export interface TilesimAgentHarnessBatchObjectiveV1 {
  schema_identity: "tilesim.agent_harness.batch_objective.v1";
  contract_revision: "2026-10-19.wpe.v1";
  metric_path: string;
  direction: "minimize" | "maximize";
  policy_revision: string;
  digest?: string;
  value?: number | null;
  status?: "pending" | "verified" | "unavailable" | "rejected";
}
export interface TilesimAgentHarnessBatchBudgetV1 {
  max_candidates: number;
  max_runs: number;
  max_seconds: number;
  max_concurrency: 1;
  max_failures: number;
  max_retries: number;
  resource_units: number;
  max_no_improvement: number;
}
export interface TilesimAgentHarnessConcurrencyPolicyV1 {
  schema_identity: "tilesim.agent_harness.concurrency_policy.v1";
  contract_revision: "2026-10-19.wpe.v1";
  max_concurrency: 1;
  queue_policy: "bounded_fifo";
}
export interface TilesimAgentHarnessStopPolicyV1 {
  schema_identity: "tilesim.agent_harness.stop_policy.v1";
  contract_revision: "2026-10-19.wpe.v1";
  on_failure: "continue" | "stop";
  on_no_improvement: "stop";
}
export interface TilesimAgentHarnessBatchApprovalV1 {
  schema_identity: "tilesim.agent_harness.batch_approval.v1";
  contract_revision: "2026-10-19.wpe.v1";
  approval_id: string;
  batch_id: string;
  approval_digest: string;
  status: "approved" | "consumed" | "expired" | "revoked";
  single_use: true;
  consumed: boolean;
  expires_at: string;
  consumed_at?: string;
  created_at?: string;
  provenance: {
    [k: string]: unknown;
  };
}

export interface AgentFlowRevokeRequest {
  schema_identity: "tilesim.agent_flow.revoke_request.v1";
  contract_revision: "2026-10-28.flow.v2";
  flow_id: string;
  session_id: string;
  current_binding: AgentFlowIdentityBinding;
  current_event_sequence: number;
  authorization_id: string;
  authorization_digest: string;
  authorization_budget: AuthorizationBudget;
  principal?: string;
  workspace_id?: string;
}
export interface AgentFlowIdentityBinding {
  session_id: string;
  flow_id: string | null;
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  schema_set_revision: string;
  input_snapshot_digest: string | null;
  /**
   * @maxItems 256
   */
  artifact_bindings: AgentFlowArtifactBinding[];
}
export interface AgentFlowArtifactBinding {
  artifact_id: string;
  schema_identity: string;
  sha256: string;
  bytes: string;
}
export interface AuthorizationBudget {
  max_navigation_attempts: number;
  max_model_calls: number;
  max_tool_calls_per_round: number;
  max_run_creations: number;
  max_execution_time_ms: number;
}

export interface AgentFlowRevokeResponse {
  flow: AgentFlowState;
  events: AgentFlowEvent[];
  idempotent_replay: boolean;
  action: "revoke_authorization";
}
export interface AgentFlowState {
  schema_identity: "tilesim.agent_flow.state.v1";
  contract_revision: "2026-10-28.flow.v2";
  flow_id: string;
  session_id: string;
  principal: string;
  workspace_id: string;
  intent:
    | "explain"
    | "existing_run_analysis"
    | "user_report"
    | "configuration_draft"
    | "navigation"
    | "unsupported_execution";
  status:
    "created" | "running" | "waiting_user" | "completed" | "draft_ready" | "stale" | "refused" | "cancelled" | "failed";
  node: string;
  event_sequence: number;
  binding: AgentFlowIdentityBinding;
  pending_action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | null;
  approval: {
    [k: string]: unknown;
  } | null;
  authorization: {
    status: "active" | "revoked" | "expired" | "exhausted";
    authorization_id: string;
    authorization_digest: string;
    budget: AuthorizationBudget;
    usage: {
      navigation_attempts: number;
      model_calls: number;
      tool_calls_per_round: number;
      run_creations: number;
      execution_time_ms: number;
    };
    remaining: {
      max_navigation_attempts: number;
      max_model_calls: number;
      max_tool_calls_per_round: number;
      max_run_creations: number;
      max_execution_time_ms: number;
    };
  } | null;
  validation: {
    [k: string]: unknown;
  } | null;
  evidence: {
    [k: string]: unknown;
  } | null;
  report: {
    [k: string]: unknown;
  } | null;
  terminal_reason: string | null;
  checkpoint_id: string | null;
  created_at: string;
  updated_at: string;
  current_page?: string | null;
  /**
   * @maxItems 32
   */
  current_page_capabilities?: string[];
  current_context_revision?: string | null;
  /**
   * @maxItems 32
   */
  required_capabilities?: string[];
  /**
   * @maxItems 32
   */
  allowed_pages?: string[];
  /**
   * @maxItems 32
   */
  allowed_actions?: string[];
  /**
   * @maxItems 8
   */
  visited_pages?:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
  navigation_attempts?: number;
  max_navigation_attempts?: number;
  /**
   * @maxItems 8
   */
  navigation_failures?:
    | []
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ]
    | [
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
        {
          page: string;
          type: string;
          detail?: string;
        },
      ];
  last_navigation_observation?: AgentFlowNavigationObservation | null;
  navigation_target?: string | null;
}
export interface AgentFlowIdentityBinding {
  session_id: string;
  flow_id: string | null;
  run_id: string | null;
  run_context_revision: string | null;
  backend_identity: {
    [k: string]: unknown;
  };
  schema_set_revision: string;
  input_snapshot_digest: string | null;
  /**
   * @maxItems 256
   */
  artifact_bindings: AgentFlowArtifactBinding[];
}
export interface AgentFlowArtifactBinding {
  artifact_id: string;
  schema_identity: string;
  sha256: string;
  bytes: string;
}
export interface AuthorizationBudget {
  max_navigation_attempts: number;
  max_model_calls: number;
  max_tool_calls_per_round: number;
  max_run_creations: number;
  max_execution_time_ms: number;
}
export interface AgentFlowNavigationObservation {
  target_page: string;
  actual_page: string | null;
  page_correct: boolean;
  /**
   * @maxItems 32
   */
  current_page_capabilities: string[];
  current_run_id: string | null;
  current_context_revision: string | null;
  failure_type:
    | "navigation_error"
    | "context_unavailable"
    | "context_invalid"
    | "page_mismatch"
    | "capability_missing"
    | "stale_identity"
    | null;
  retry_allowed: boolean;
  /**
   * @maxItems 8
   */
  visited_pages:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
  navigation_attempts: number;
}
export interface AgentFlowEvent {
  schema_identity: "tilesim.agent_flow.event.v1";
  contract_revision: "2026-10-28.flow.v2";
  event_id: string;
  sequence: number;
  flow_id: string;
  session_id: string;
  node: string;
  event_type:
    | "flow_started"
    | "node_started"
    | "node_completed"
    | "interrupt"
    | "approval_required"
    | "state_changed"
    | "terminal"
    | "error";
  state: AgentFlowState;
  binding: AgentFlowIdentityBinding;
  pending_action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | null;
  payload: {
    [k: string]: unknown;
  };
  created_at: string;
}

export type CreateRunResponse = ApiRun & { idempotent_replay: boolean };
