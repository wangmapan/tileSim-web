/**
 * Proposal-only Agent Harness contracts for Phase 0/WP-A.
 *
 * This module is intentionally a Web/domain model, not a Bridge contract. It
 * is never sent to /api/runs, never persisted as an operation store, and never
 * turns a fixture into an execution capability. A future Bridge release may
 * publish successor schemas after the proposal is reviewed.
 */

export const AGENT_HARNESS_PUBLICATION_STATUS = "proposal_non_published" as const;
export const AGENT_HARNESS_SCHEMA_SET_SCOPE = "not_in_bridge_schema_set" as const;
export const AGENT_HARNESS_PROPOSAL_REVISION = "2026-10-17.wpa.v0" as const;

export const AGENT_HARNESS_SCHEMA_IDENTITIES = {
  agent_operation: "tilesim.agent_harness.agent_operation.v0",
  agent_turn: "tilesim.agent_harness.agent_turn.v0",
  workflow_event: "tilesim.agent_harness.workflow_event.v0",
  checkpoint: "tilesim.agent_harness.checkpoint.v0",
  tool_call: "tilesim.agent_harness.tool_call.v0",
  tool_result: "tilesim.agent_harness.tool_result.v0",
  experiment_draft: "tilesim.agent_harness.experiment_draft.v0",
  approval: "tilesim.agent_harness.approval.v0",
  study: "tilesim.agent_harness.study.v0",
  candidate: "tilesim.agent_harness.candidate.v0",
  error: "tilesim.agent_harness.error.v0",
} as const;

export type AgentHarnessSchemaIdentity =
  (typeof AGENT_HARNESS_SCHEMA_IDENTITIES)[keyof typeof AGENT_HARNESS_SCHEMA_IDENTITIES];

export type AgentOperationState =
  | "draft"
  | "submitted"
  | "queued"
  | "running"
  | "waiting_tool"
  | "waiting_approval"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovery_required"
  | "manual_intervention_required";

export const TERMINAL_OPERATION_STATES: readonly AgentOperationState[] = ["completed", "failed", "cancelled"];
export const BLOCKED_OPERATION_STATES: readonly AgentOperationState[] = [
  "recovery_required",
  "manual_intervention_required",
];

export type AgentToolOutcome = "succeeded" | "rejected" | "retryable_failure" | "terminal_failure" | "unknown_outcome";

export type AgentHarnessAvailability =
  "available" | "unavailable" | "not_exposed" | "rejected" | "failed" | "cancelled" | "completed";

export type AgentHarnessSource = "fixture" | "bridge_proposal" | "bridge_published";
export type JsonPointer = string;

export interface AgentHarnessObjectMeta {
  schema_identity: AgentHarnessSchemaIdentity;
  contract_revision: typeof AGENT_HARNESS_PROPOSAL_REVISION;
  publication_status: typeof AGENT_HARNESS_PUBLICATION_STATUS;
  operation_id: string;
  turn_id: string | null;
  run_id: string | null;
  snapshot_digest: string | null;
  schema_set_revision: string | null;
  policy_revision: string;
}

export interface AgentHarnessRetention {
  retention_class: "short_lived" | "run_local" | "user_visible";
  expires_at: string | null;
  delete_state: "not_requested" | "requested" | "deleted" | "delete_failed";
  delete_semantics: "idempotent_graph_delete" | "not_exposed";
  forbidden_payloads: readonly ["credential", "hidden_reasoning", "provider_raw_response", "unshown_evidence_payload"];
}

export interface AgentOperation extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.agent_operation;
  operation_id: string;
  turn_id: null;
  state: AgentOperationState;
  state_revision: number;
  workflow_revision: string;
  model_revision: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
  outcome: AgentToolOutcome | "cancelled" | null;
  cancellation_fence: number | null;
  source: AgentHarnessSource;
  availability: AgentHarnessAvailability;
  retention: AgentHarnessRetention;
}

export interface AgentTurn extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.agent_turn;
  turn_id: string;
  parent_turn_id: string | null;
  state: AgentOperationState;
  sequence: number;
  user_message_summary: string;
  evidence_set_digest: string | null;
  source: AgentHarnessSource;
  availability: AgentHarnessAvailability;
  retention: AgentHarnessRetention;
}

export type WorkflowEventKind =
  | "submitted"
  | "queued"
  | "started"
  | "waiting_tool"
  | "waiting_approval"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovery_required"
  | "manual_intervention_required"
  | "tool_result_recorded"
  | "approval_recorded";

export type WorkflowTransitionKind = "normal" | "retry" | "resume" | "cancel";

export interface WorkflowEvent extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.workflow_event;
  event_id: string;
  sequence: number;
  event_kind: WorkflowEventKind;
  state: AgentOperationState;
  transition_kind: WorkflowTransitionKind;
  occurred_at: string;
  payload_digest: string;
  dedupe_key: string;
  idempotency_key: string;
  producer_revision: string;
}

export interface Checkpoint extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.checkpoint;
  checkpoint_id: string;
  state: AgentOperationState;
  completed_event_sequence: number;
  state_digest: string;
  workflow_revision: string;
  code_revision: string;
  side_effects: readonly SideEffectReceipt[];
  resume_policy: "resume_if_revision_matches" | "manual_intervention_required" | "not_exposed";
}

export interface SideEffectReceipt {
  effect_id: string;
  effect_kind: "provider_call" | "tool_call" | "run_creation" | "artifact_read";
  idempotency_key: string;
  command_digest: string;
  outcome: "completed" | "rejected" | "failed" | "unknown_outcome";
  output_identity: string | null;
}

export interface ToolScope {
  run_id: string | null;
  snapshot_digest: string | null;
  allowed_artifact_ids: readonly string[];
  allow_network: false;
  allow_shell: false;
  allow_arbitrary_path: false;
  allow_arbitrary_url: false;
}

export interface ToolCall extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.tool_call;
  tool_call_id: string;
  tool_name: string;
  tool_revision: string;
  input_digest: string;
  scope: ToolScope;
  permission: "allowed" | "rejected" | "not_exposed";
  approval_id: string | null;
  idempotency_key: string;
  proposed_side_effect: "none" | "run_creation" | "configuration_write" | "unknown";
  outcome: AgentToolOutcome | null;
}

export interface ToolResult extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.tool_result;
  tool_result_id: string;
  tool_call_id: string;
  tool_revision: string;
  outcome: AgentToolOutcome;
  output_digest: string | null;
  evidence_reference_ids: readonly string[];
  error_code: AgentHarnessErrorCode | null;
  field_path: JsonPointer | null;
  retryable: boolean;
  unknown_outcome: boolean;
}

export type ExperimentDraftState = "draft" | "validated" | "rejected" | "stale" | "expired";

export interface ExperimentDraft extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.experiment_draft;
  draft_id: string;
  draft_digest: string;
  state: ExperimentDraftState;
  input_snapshot_digest: string;
  validator_revision: string;
  field_diff_digest: string;
  expires_at: string;
  stale_reason: AgentHarnessStaleReason | null;
  creates_run: false;
  source: AgentHarnessSource;
  availability: AgentHarnessAvailability;
}

export type ApprovalState = "pending" | "approved" | "rejected" | "expired" | "stale";

export interface Approval extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.approval;
  approval_id: string;
  draft_id: string;
  draft_digest: string;
  approval_digest: string;
  principal_id: string;
  policy_revision: string;
  state: ApprovalState;
  approved_at: string | null;
  expires_at: string;
  stale_reason: AgentHarnessStaleReason | null;
  creates_run: false;
  availability: AgentHarnessAvailability;
}

export interface Study extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.study;
  study_id: string;
  objective_summary: string;
  constraints_digest: string;
  budget: { max_candidates: number; max_runs: number; max_total_ms: number | null };
  stop_policy_digest: string;
  state: "draft" | "rejected" | "not_exposed";
  automatic_submission: false;
  availability: AgentHarnessAvailability;
}

export interface Candidate extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.candidate;
  candidate_id: string;
  parent_candidate_id: string | null;
  draft_id: string;
  draft_digest: string;
  run_id: null;
  metrics_snapshot_digest: null;
  state: "proposed" | "rejected" | "not_exposed";
  availability: AgentHarnessAvailability;
}

export const AGENT_HARNESS_ERROR_CODES = [
  "invalid_argument",
  "capability_unavailable",
  "capability_not_exposed",
  "schema_revision_mismatch",
  "stale_draft",
  "approval_expired",
  "approval_stale",
  "provider_timeout",
  "bridge_unavailable",
  "worker_crashed",
  "duplicate_event",
  "event_sequence_gap",
  "event_sequence_conflict",
  "duplicate_resume",
  "cancelled_late_result",
  "unknown_side_effect_outcome",
  "prompt_injection",
  "tool_scope_violation",
  "cross_run_scope_violation",
  "duplicate_side_effect",
  "retention_delete_failed",
  "operation_terminal",
] as const;
export type AgentHarnessErrorCode = (typeof AGENT_HARNESS_ERROR_CODES)[number];

export interface AgentHarnessError extends AgentHarnessObjectMeta {
  schema_identity: typeof AGENT_HARNESS_SCHEMA_IDENTITIES.error;
  code: AgentHarnessErrorCode;
  message: string;
  field_path: JsonPointer | null;
  retryable: boolean;
  terminal_failure: boolean;
  unknown_outcome: boolean;
  availability: Extract<AgentHarnessAvailability, "rejected" | "failed" | "unavailable" | "not_exposed">;
}

export type AgentHarnessStaleReason =
  | "schema_revision_changed"
  | "run_changed"
  | "snapshot_changed"
  | "policy_revision_changed"
  | "workflow_revision_changed"
  | "draft_expired"
  | "approval_expired";

export interface AgentHarnessBinding {
  schema_set_revision: string | null;
  run_id: string | null;
  snapshot_digest: string | null;
  policy_revision: string;
  workflow_revision: string;
}

export interface AgentHarnessProjection {
  source: AgentHarnessSource;
  publication_status: typeof AGENT_HARNESS_PUBLICATION_STATUS;
  availability: AgentHarnessAvailability;
  state: AgentOperationState | null;
  operation_id: string | null;
  turn_id: string | null;
  run_id: string | null;
  snapshot_digest: string | null;
  event_count: number;
  duplicate_event_ids: readonly string[];
  rejected_event_ids: readonly string[];
  stale_reason: AgentHarnessStaleReason | null;
  error: AgentHarnessError | null;
}

export interface WorkflowProjection {
  state: AgentOperationState;
  accepted_events: readonly WorkflowEvent[];
  duplicate_event_ids: readonly string[];
  rejected_event_ids: readonly string[];
  out_of_order_event_ids: readonly string[];
  sequence_conflict: boolean;
  expected_next_sequence: number;
  requires_recovery: boolean;
  late_event_ids: readonly string[];
}

const TRANSITIONS: Readonly<Record<AgentOperationState, readonly AgentOperationState[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["queued", "waiting_approval", "failed", "cancelled"],
  queued: ["running", "cancelled", "failed"],
  running: [
    "waiting_tool",
    "waiting_approval",
    "retrying",
    "completed",
    "failed",
    "cancelled",
    "recovery_required",
    "manual_intervention_required",
  ],
  waiting_tool: ["running", "retrying", "failed", "cancelled", "recovery_required", "manual_intervention_required"],
  waiting_approval: ["queued", "failed", "cancelled", "manual_intervention_required"],
  retrying: ["running", "failed", "cancelled", "recovery_required", "manual_intervention_required"],
  recovery_required: ["queued", "manual_intervention_required", "cancelled"],
  manual_intervention_required: ["queued", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

function isTransitionAllowed(from: AgentOperationState, to: AgentOperationState, kind: WorkflowTransitionKind) {
  if (!TRANSITIONS[from].includes(to)) return false;
  if ((from === "recovery_required" || from === "manual_intervention_required") && kind !== "resume") return false;
  if (from === "cancelled") return false;
  return true;
}

/**
 * Deterministic fixture reducer. It models at-least-once delivery and fences
 * terminal/cancelled operations. It is deliberately not a queue or a store.
 */
export function projectWorkflowEvents(
  events: readonly WorkflowEvent[],
  initialState: AgentOperationState = "draft",
): WorkflowProjection {
  const acceptedById = new Map<string, WorkflowEvent>();
  const duplicateEventIds: string[] = [];
  const rejectedEventIds: string[] = [];
  const outOfOrderEventIds: string[] = [];
  const lateEventIds: string[] = [];
  let conflictingDuplicate = false;
  let previousArrivalSequence = 0;

  for (const event of events) {
    if (acceptedById.has(event.event_id)) {
      const previous = acceptedById.get(event.event_id)!;
      if (previous.payload_digest === event.payload_digest) duplicateEventIds.push(event.event_id);
      else {
        rejectedEventIds.push(event.event_id);
        conflictingDuplicate = true;
      }
      continue;
    }
    if (event.sequence < previousArrivalSequence) outOfOrderEventIds.push(event.event_id);
    previousArrivalSequence = Math.max(previousArrivalSequence, event.sequence);
    if (event.sequence < 1 || !Number.isInteger(event.sequence)) {
      rejectedEventIds.push(event.event_id);
      continue;
    }
    acceptedById.set(event.event_id, event);
  }

  const orderedEvents = [...acceptedById.values()].sort(
    (a, b) => a.sequence - b.sequence || a.event_id.localeCompare(b.event_id),
  );
  const seenSequences = new Set<number>();
  let state = initialState;
  let expectedNextSequence = 1;
  let requiresRecovery = conflictingDuplicate;
  let sequenceConflict = conflictingDuplicate;
  const acceptedEvents: WorkflowEvent[] = [];

  for (const event of orderedEvents) {
    if (seenSequences.has(event.sequence)) {
      rejectedEventIds.push(event.event_id);
      requiresRecovery = true;
      sequenceConflict = true;
      continue;
    }
    seenSequences.add(event.sequence);
    if (event.sequence !== expectedNextSequence) {
      rejectedEventIds.push(event.event_id);
      requiresRecovery = true;
      continue;
    }
    if (state === "cancelled") {
      lateEventIds.push(event.event_id);
      rejectedEventIds.push(event.event_id);
      continue;
    }
    if (!isTransitionAllowed(state, event.state, event.transition_kind)) {
      rejectedEventIds.push(event.event_id);
      requiresRecovery = requiresRecovery || TERMINAL_OPERATION_STATES.includes(state);
      continue;
    }
    state = event.state;
    acceptedEvents.push(event);
    expectedNextSequence += 1;
  }

  if (outOfOrderEventIds.length > 0) requiresRecovery = true;
  if (requiresRecovery && !TERMINAL_OPERATION_STATES.includes(state)) state = "recovery_required";
  return {
    state,
    accepted_events: acceptedEvents,
    duplicate_event_ids: duplicateEventIds,
    rejected_event_ids: rejectedEventIds,
    out_of_order_event_ids: outOfOrderEventIds,
    sequence_conflict: sequenceConflict,
    expected_next_sequence: expectedNextSequence,
    requires_recovery: requiresRecovery,
    late_event_ids: lateEventIds,
  };
}

export function approvalFreshness(
  approval: Pick<Approval, "state" | "expires_at" | "draft_digest" | "policy_revision">,
  current: Pick<AgentHarnessBinding, "policy_revision"> & { draft_digest: string },
  now = new Date(),
): ApprovalState {
  if (approval.state !== "approved") return approval.state;
  if (Date.parse(approval.expires_at) <= now.getTime()) return "expired";
  if (approval.draft_digest !== current.draft_digest || approval.policy_revision !== current.policy_revision)
    return "stale";
  return "approved";
}

export function staleReasonForBinding(
  expected: AgentHarnessBinding,
  current: AgentHarnessBinding,
): AgentHarnessStaleReason | null {
  if (expected.schema_set_revision !== current.schema_set_revision) return "schema_revision_changed";
  if (expected.run_id !== current.run_id) return "run_changed";
  if (expected.snapshot_digest !== current.snapshot_digest) return "snapshot_changed";
  if (expected.policy_revision !== current.policy_revision) return "policy_revision_changed";
  if (expected.workflow_revision !== current.workflow_revision) return "workflow_revision_changed";
  return null;
}

export function isJsonPointer(value: string | null): value is JsonPointer {
  return value === null || value === "" || (value.startsWith("/") && !value.includes("#"));
}

export function fixtureProjection(
  projection: WorkflowProjection,
  operationId: string | null = null,
): AgentHarnessProjection {
  const state = projection.state;
  const availability: AgentHarnessAvailability =
    state === "completed"
      ? "completed"
      : state === "cancelled"
        ? "cancelled"
        : state === "failed"
          ? "failed"
          : "not_exposed";
  return {
    source: "fixture",
    publication_status: AGENT_HARNESS_PUBLICATION_STATUS,
    availability,
    state,
    operation_id: operationId,
    turn_id: null,
    run_id: null,
    snapshot_digest: null,
    event_count: projection.accepted_events.length,
    duplicate_event_ids: projection.duplicate_event_ids,
    rejected_event_ids: projection.rejected_event_ids,
    stale_reason: null,
    error: projection.requires_recovery
      ? {
          schema_identity: AGENT_HARNESS_SCHEMA_IDENTITIES.error,
          contract_revision: AGENT_HARNESS_PROPOSAL_REVISION,
          publication_status: AGENT_HARNESS_PUBLICATION_STATUS,
          operation_id: operationId ?? "fixture-operation",
          turn_id: null,
          run_id: null,
          snapshot_digest: null,
          schema_set_revision: null,
          policy_revision: "fixture-only",
          code: projection.out_of_order_event_ids.length
            ? "event_sequence_gap"
            : projection.sequence_conflict
              ? "event_sequence_conflict"
              : "operation_terminal",
          message: "仅为契约 fixture：事件顺序或终态 fence 需要恢复检查。",
          field_path: "/sequence",
          retryable: false,
          terminal_failure: false,
          unknown_outcome: projection.late_event_ids.length > 0,
          availability: "rejected",
        }
      : null,
  };
}
