/**
 * Phase 1 local Web/domain contracts for the read-only Agent copilot.
 *
 * These types are intentionally not Bridge contracts. They carry only a
 * single-turn, current-capability-subset draft and must never be serialized as
 * a durable conversation, approval, operation, or create-run request.
 */

export const PHASE1_LOCAL_CONTRACT_REVISION = "tilesim.web.agent_orchestration.phase1.local.v1" as const;

export const PHASE1_AGENT_EXPOSED_FIELD_IDS = [
  "s0.workload.message_size_multiplier",
  "s1.runtime.batch_scheduler",
  "s1.runtime.max_batch_size",
  "s1.runtime.kv_capacity_tokens",
  "s6.fabric.scale_up_bandwidth_gbps",
  "s6.fabric.scale_up_latency_us",
  "s6.fabric.scale_out_bandwidth_gbps",
  "s6.fabric.scale_out_latency_us",
] as const;

export type Phase1AgentExposedFieldId = (typeof PHASE1_AGENT_EXPOSED_FIELD_IDS)[number];

export type AgentTaskRoute = "configure" | "capability_check" | "unsupported";

export type AgentCopilotPanelState = "closed" | "collapsed" | "open" | "expanded";

export interface AgentCopilotSubmitPayload {
  instruction: string;
  context_revision: string | null;
  purpose: "explain" | "draft";
}

export type ContextAvailability = "available" | "unavailable" | "stale";

export interface ContextStaleState {
  state: "fresh" | "stale";
  reason:
    | "none"
    | "page_context_revision_changed"
    | "catalog_revision_changed"
    | "schema_set_revision_changed"
    | "capability_snapshot_revision_changed";
  expected_revision: string;
  current_revision: string;
}

export interface AgentContextResourceRef {
  resource_type: "run" | "experiment_form" | "field" | "artifact" | "chart_subject";
  resource_id: string;
  revision: string;
  display_label: string;
  availability: ContextAvailability;
}

/** Minimal, typed, read-only page projection. Never contains DOM or callbacks. */
export interface PageContextEnvelope {
  contract_revision: typeof PHASE1_LOCAL_CONTRACT_REVISION;
  page_id: string;
  route_name: string;
  context_revision: string;
  workspace_ref: string | null;
  run_ref: { run_id: string; revision: string } | null;
  selected_entity: { entity_type: string; entity_id: string; revision: string } | null;
  resources: readonly AgentContextResourceRef[];
  supported_actions: readonly ("explain" | "configure_current_subset" | "check_capability")[];
  data_classification: "public" | "workspace_internal";
  allowed_purposes: readonly ("explain" | "draft")[];
  expires_at: string | null;
  display_label: string;
  availability: ContextAvailability;
}

export type DraftValueSource = "user" | "profile" | "template" | "calculator" | "system";

/**
 * Serialized values keep integers/uint64/decimal text lossless. Consumers may
 * parse bounded numeric fields only after descriptor validation.
 */
export type DraftFieldValue =
  | { value_type: "enum" | "string"; serialized_value: string }
  | { value_type: "integer" | "uint64" | "decimal" | "number"; serialized_value: string }
  | { value_type: "boolean"; serialized_value: "true" | "false" }
  | { value_type: "null"; serialized_value: "null" };

export type DraftCapabilityState =
  "available" | "conditional" | "not_exposed" | "unsupported" | "unresolved_not_executed" | "unavailable";

export interface DeterministicValidationIssue {
  issue_id: string;
  rule_id: string;
  severity: "error" | "warning" | "info";
  blocking: boolean;
  status: "fail" | "unknown" | "stale";
  field_ids: readonly string[];
  message: string;
  facts: Readonly<Record<string, string>>;
  repair_candidates: readonly {
    label: string;
    field_id: string;
    proposed_value: DraftFieldValue;
  }[];
}

export interface DraftField {
  field_id: string;
  request_json_pointer: string;
  original_value: DraftFieldValue | null;
  proposed_value: DraftFieldValue;
  unit: string;
  value_source: DraftValueSource;
  capability_state: DraftCapabilityState;
  validation_issues: readonly DeterministicValidationIssue[];
  catalog_revision: string;
  capability_snapshot_revision: string;
  context_revision: string;
  stale: ContextStaleState;
}

export interface DraftDiffItem {
  field_id: string;
  request_json_pointer: string;
  change: "add" | "replace" | "remove";
  original_value: DraftFieldValue | null;
  proposed_value: DraftFieldValue | null;
  unit: string;
  value_source: DraftValueSource;
}

/** Current-subset in-memory draft. It is not a formal Experiment Draft. */
export interface CurrentSubsetExperimentDraft {
  contract_revision: typeof PHASE1_LOCAL_CONTRACT_REVISION;
  status: "draft";
  notice: "not_a_run";
  task_summary: string;
  target_request_identity: "tilesim.bridge.create_run_request.v1";
  fields: readonly DraftField[];
  diff: readonly DraftDiffItem[];
  validation: {
    overall: "valid" | "invalid" | "unknown" | "stale";
    issues: readonly DeterministicValidationIssue[];
  };
  unresolved: readonly string[];
  catalog_revision: string;
  capability_snapshot_revision: string;
  schema_set_revision: string;
  context_revision: string;
  stale: ContextStaleState;
}

export interface Phase1CapabilityFieldProjection {
  field_id: string;
  aliases: readonly string[];
  value_type: "enum" | "integer" | "number";
  canonical_unit: string;
  accepted_units: readonly string[];
  request_json_pointer: string;
  enum_values: readonly string[];
  minimum: string | null;
  maximum: string | null;
  integer_only: boolean;
  capability_state: DraftCapabilityState;
}

export interface Phase1CapabilityProjection {
  catalog_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1";
  catalog_revision: string;
  capability_snapshot_revision: string;
  schema_set_revision: string;
  target_request_identity: "tilesim.bridge.create_run_request.v1";
  fields: readonly Phase1CapabilityFieldProjection[];
}

export interface IntentCompilerInput {
  contract_revision: typeof PHASE1_LOCAL_CONTRACT_REVISION;
  instruction: string;
  locale: "zh-CN" | "en-US";
  capability: Phase1CapabilityProjection;
  current_values: Readonly<Record<string, DraftFieldValue | null>>;
  context: PageContextEnvelope;
}

export interface IntentSlot {
  field_id: string | null;
  original_text: string;
  candidate_value: DraftFieldValue | null;
  original_unit: string | null;
  canonical_unit: string | null;
  modality: "required" | "preferred" | "maximum" | "minimum" | "forbidden";
  cardinality: "single" | "range" | "set";
  resolution: "resolved" | "ambiguous" | "unknown" | "unsupported";
  alternatives: readonly string[];
  reason_code: string | null;
}

export interface ClarificationQuestion {
  question_id: string;
  blocking: true;
  reason_code: string;
  prompt: string;
  field_ids: readonly string[];
  options: readonly { option_id: string; label: string; serialized_value: string }[];
}

export interface UnsupportedCapabilityResult {
  status: "unsupported";
  reason_code: string;
  understood: readonly string[];
  unsupported_items: readonly { text: string; capability: string; gap_id: string | null }[];
  safe_next_actions: readonly string[];
}

export type IntentCompilerOutput =
  | {
      kind: "draft";
      route: "configure";
      slots: readonly IntentSlot[];
      draft: CurrentSubsetExperimentDraft;
    }
  | {
      kind: "clarification";
      route: "configure" | "capability_check";
      slots: readonly IntentSlot[];
      questions: readonly [ClarificationQuestion, ...ClarificationQuestion[]];
    }
  | {
      kind: "unsupported";
      route: "unsupported" | "capability_check";
      slots: readonly IntentSlot[];
      result: UnsupportedCapabilityResult;
    }
  | { kind: "no_op"; route: "configure" | "capability_check"; reason_code: string };

export type AgentTypedBlock =
  | { block_type: "explanation"; block_id: string; title: string; body: string }
  | { block_type: "capability_result"; block_id: string; result: UnsupportedCapabilityResult }
  | { block_type: "draft_summary"; block_id: string; draft: CurrentSubsetExperimentDraft }
  | {
      block_type: "validation_result";
      block_id: string;
      overall: CurrentSubsetExperimentDraft["validation"]["overall"];
      issues: readonly DeterministicValidationIssue[];
    }
  | { block_type: "clarification"; block_id: string; questions: readonly ClarificationQuestion[] }
  | { block_type: "unsupported"; block_id: string; result: UnsupportedCapabilityResult }
  | { block_type: "formal_error"; block_id: string; code: string; message: string; safe_next_action: string };
