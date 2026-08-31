export const f9SchemaRevision = "sha256:5c6653e0fd7c367300ce5eba3200575e81170911ec952557f948931c6cb545aa";
export const f9DescriptorRevision = "sha256:d68d4d18046e99452e56ac442ac9e4382e3cbcb593cf2bf228fbbd06a7c6f851";

export function createEvidenceAgentDescriptor(configured = true) {
  return {
    schema_version: "tilesim.bridge.evidence_agent_descriptor.v2",
    schema_set_revision: f9SchemaRevision,
    descriptor_revision: f9DescriptorRevision,
    availability: configured ? "available" : "unavailable",
    degradation: configured
      ? { state: "none", reason_code: "none", detail: "Provider configured." }
      : {
          state: "not_configured",
          reason_code: "provider_unavailable",
          detail:
            "Provider is not configured. This intentionally long capability detail verifies desktop wrapping without implying a live answer.",
        },
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
    },
    tools: {
      allowed: ["verified_snapshot_read", "citation_resolution"],
      forbidden: ["shell", "arbitrary_file", "arbitrary_path", "arbitrary_http"],
      allow_list_expansion: false,
    },
    persistence: {
      mode: {
        storage_scope: "run_local",
        record_kind: "redacted_terminal_metadata_only",
        record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2",
      },
      retention_seconds: 3600,
      terminal_classes: {
        claim_free_bridge_terminal: {
          terminal_metadata_retained: true,
          exact_response_recoverable_after_restart: true,
        },
        claims_bearing_terminal: {
          terminal_metadata_retained: true,
          validated_model_claims_retained: false,
          exact_response_recoverable_after_restart: false,
        },
        claim_free_provider_terminal: {
          terminal_metadata_retained: true,
          validated_provider_response_retained: false,
          exact_response_recoverable_after_restart: false,
        },
      },
      payload_retention: {
        user_question_retained: false,
        snapshot_payload_retained: false,
        artifact_payload_retained: false,
        provider_raw_response_retained: false,
        validated_model_claims_retained: false,
        credentials_retained: false,
        hidden_reasoning_retained: false,
      },
    },
    redaction: {
      user_question: "not_retained",
      snapshot_payload: "not_retained",
      artifact_payload: "not_retained",
      provider_raw_response: "not_retained",
      validated_model_claims: "memory_only_until_process_exit",
      credentials: "never_retained",
      hidden_chain_of_thought: "never_returned_or_retained",
    },
    execution: {
      mode: "synchronous_terminal",
      timeout_ms: 30_000,
      cancellation: "not_applicable_after_synchronous_terminal_response",
      maximum_concurrent_operations: 1,
      retry: {
        payload_identity: "tilesim.bridge.canonical_json.v1_sha256",
        same_key_same_canonical_payload: {
          in_process: "exact_terminal_replay",
          after_restart_claim_free_bridge_terminal: "exact_terminal_replay_from_redacted_record",
          after_restart_claims_bearing_terminal: "error_terminal_result_not_retained",
          after_restart_claim_free_provider_terminal: "error_terminal_result_not_retained",
          provider_reinvocation: "forbidden",
        },
        same_key_different_canonical_payload: {
          outcome: "error",
          http_status: 409,
          code: "idempotency_payload_mismatch",
          field_path: "/headers/Idempotency-Key",
          retryable: false,
        },
      },
      terminal_recovery: {
        record_scope: "run_local",
        record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2",
        claim_free_bridge_terminal: {
          outcome: "exact_terminal_replay",
          source: "redacted_terminal_metadata",
        },
        claims_bearing_terminal: {
          outcome: "error",
          http_status: 409,
          code: "terminal_result_not_retained",
          field_path: "/headers/Idempotency-Key",
          retryable: false,
        },
        claim_free_provider_terminal: {
          outcome: "error",
          http_status: 409,
          code: "terminal_result_not_retained",
          field_path: "/headers/Idempotency-Key",
          retryable: false,
        },
        provider_reinvocation: "forbidden",
      },
    },
  };
}
