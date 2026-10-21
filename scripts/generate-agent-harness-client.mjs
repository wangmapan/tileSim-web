import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const openapiPath = resolve(root, "bridge/contracts/openapi.json");
const schemaDirectory = resolve(root, "bridge/contracts/schemas/agent-harness");
const outputPath = resolve(root, "src/contracts/generated/agent-harness.ts");
const prettierConfig = (await resolveConfig(outputPath)) ?? {};

const CONTRACT_REVISION = "2026-10-17.wpa.v1";
const SCHEMA_SET_REVISION = "sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73";
const SUCCESSOR_CONTRACT_REVISION = "2026-10-18.wpb.v1";
const EXECUTION_CONTRACT_REVISION = "2026-10-18.wpc.v1";
const OPTIMIZATION_CONTRACT_REVISION = "2026-10-19.wpd.v1";
const BATCH_CONTRACT_REVISION = "2026-10-19.wpe.v1";
// Keep the generated successor client bound to the canonical Bridge contract
// set.  This value includes the Stage 3A schemas and the restored WP-A
// workflow enum; `bridge/check_schema_set_revision.py` is the runtime oracle.
const SUCCESSOR_SCHEMA_SET_REVISION = "sha256:75db95b271671c336276f5082810e2eb5b3362b1d8aa2cb0a81a59af416a8c84";
const schemaNames = [
  "agent-operation",
  "agent-turn",
  "workflow-event",
  "checkpoint",
  "tool-call",
  "tool-result",
  "experiment-draft",
  "approval",
  "study",
  "candidate",
];
const expectedIdentities = Object.fromEntries(
  schemaNames.map((name) => [name, `tilesim.agent_harness.${name.replaceAll("-", "_")}.v1`]),
);
const openapi = JSON.parse(await readFile(openapiPath, "utf8"));
for (const name of schemaNames) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, `${name}.schema.json`), "utf8"));
  if (schema.$id !== expectedIdentities[name]) {
    throw new Error(`Agent Harness schema identity drift: ${name}`);
  }
}
for (const [file, identity] of [
  ["experiment-draft-v2.schema.json", "tilesim.agent_harness.experiment_draft.v2"],
  ["draft-validation-report.schema.json", "tilesim.agent_harness.draft_validation_report.v1"],
  ["approval-v2.schema.json", "tilesim.agent_harness.approval.v2"],
]) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, file), "utf8"));
  if (schema.$id !== identity) throw new Error(`Agent Harness successor schema identity drift: ${file}`);
}
for (const [file, identity] of [
  ["execution-request.schema.json", "tilesim.agent_harness.execution_request.v1"],
  ["execution-operation.schema.json", "tilesim.agent_harness.execution_operation.v1"],
  ["execution-event.schema.json", "tilesim.agent_harness.execution_event.v1"],
  ["execution-result-reference.schema.json", "tilesim.agent_harness.execution_result_reference.v1"],
  ["execution-mutation-request.schema.json", "tilesim.agent_harness.execution_mutation_request.v1"],
]) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, file), "utf8"));
  if (schema.$id !== identity) throw new Error(`Agent Harness execution schema identity drift: ${file}`);
}
if (openapi["x-tilesim-contract"]?.agent_harness?.execution_contract_revision !== EXECUTION_CONTRACT_REVISION) {
  throw new Error("OpenAPI Agent Harness execution contract revision drift.");
}
const executionIdentities = openapi["x-tilesim-contract"]?.agent_harness?.execution_schema_identities ?? [];
for (const identity of [
  "tilesim.agent_harness.execution_request.v1",
  "tilesim.agent_harness.execution_operation.v1",
  "tilesim.agent_harness.execution_event.v1",
  "tilesim.agent_harness.execution_result_reference.v1",
  "tilesim.agent_harness.execution_mutation_request.v1",
]) {
  if (!executionIdentities.includes(identity)) throw new Error(`OpenAPI execution schema identity drift: ${identity}`);
}
if (openapi["x-tilesim-contract"]?.agent_harness?.contract_revision !== CONTRACT_REVISION) {
  throw new Error("OpenAPI Agent Harness contract revision drift.");
}
for (const [path, operationId] of [
  ["/agent/harness-capabilities", "agentHarnessCapabilities"],
  ["/agent/tools", "agentHarnessTools"],
  ["/agent/operations", "listAgentHarnessOperations"],
  ["/agent/operations/{operation_id}", "getAgentHarnessOperation"],
  ["/agent/operations/{operation_id}/events", "getAgentHarnessEvents"],
  ["/agent/tools/call", "callAgentHarnessTool"],
]) {
  const operation = Object.values(openapi.paths?.[path] ?? {}).find(
    (candidate) => candidate?.operationId === operationId,
  );
  if (operation?.operationId !== operationId) throw new Error(`OpenAPI operation drift: ${operationId}`);
}
const optimizationSchemas = [
  ["optimization-session.schema.json", "tilesim.agent_harness.optimization_session.v1"],
  ["optimization-candidate.schema.json", "tilesim.agent_harness.optimization_candidate.v1"],
  ["optimization-objective.schema.json", "tilesim.agent_harness.optimization_objective.v1"],
  ["optimization-constraint.schema.json", "tilesim.agent_harness.optimization_constraint.v1"],
  ["optimization-tool-invocation.schema.json", "tilesim.agent_harness.optimization_tool_invocation.v1"],
  ["optimization-tool-result.schema.json", "tilesim.agent_harness.optimization_tool_result.v1"],
  ["optimization-iteration.schema.json", "tilesim.agent_harness.optimization_iteration.v1"],
  ["optimization-evaluation.schema.json", "tilesim.agent_harness.optimization_evaluation.v1"],
  ["optimization-checkpoint.schema.json", "tilesim.agent_harness.optimization_checkpoint.v1"],
  ["optimization-stop-reason.schema.json", "tilesim.agent_harness.optimization_stop_reason.v1"],
  ["optimization-approval.schema.json", "tilesim.agent_harness.optimization_approval.v1"],
  ["optimization-action.schema.json", "tilesim.agent_harness.optimization_action.v1"],
  ["optimization-summary.schema.json", "tilesim.agent_harness.optimization_summary.v1"],
  ["optimization-event.schema.json", "tilesim.agent_harness.optimization_event.v1"],
];
for (const [file, identity] of optimizationSchemas) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, file), "utf8"));
  if (schema.$id !== identity) throw new Error(`Optimization schema identity drift: ${file}`);
}
const batchSchemas = [
  ["batch-session.schema.json", "tilesim.agent_harness.batch_session.v1"],
  ["experiment-plan.schema.json", "tilesim.agent_harness.experiment_plan.v1"],
  ["candidate-set.schema.json", "tilesim.agent_harness.candidate_set.v1"],
  ["run-slot.schema.json", "tilesim.agent_harness.run_slot.v1"],
  ["batch-objective.schema.json", "tilesim.agent_harness.batch_objective.v1"],
  ["batch-budget.schema.json", "tilesim.agent_harness.batch_budget.v1"],
  ["concurrency-policy.schema.json", "tilesim.agent_harness.concurrency_policy.v1"],
  ["stop-policy.schema.json", "tilesim.agent_harness.stop_policy.v1"],
  ["batch-checkpoint.schema.json", "tilesim.agent_harness.batch_checkpoint.v1"],
  ["batch-summary.schema.json", "tilesim.agent_harness.batch_summary.v1"],
  ["batch-run-result.schema.json", "tilesim.agent_harness.batch_run_result.v1"],
  ["batch-failure-recovery.schema.json", "tilesim.agent_harness.batch_failure_recovery.v1"],
  ["batch-stop-reason.schema.json", "tilesim.agent_harness.stop_reason.v1"],
  ["batch-approval.schema.json", "tilesim.agent_harness.batch_approval.v1"],
  ["batch-event.schema.json", "tilesim.agent_harness.batch_event.v1"],
  ["batch-action.schema.json", "tilesim.agent_harness.batch_action.v1"],
];
for (const [file, identity] of batchSchemas) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, file), "utf8"));
  if (schema.$id !== identity) throw new Error(`Batch schema identity drift: ${file}`);
}
if (openapi["x-tilesim-contract"]?.agent_harness?.optimization?.contract_revision !== OPTIMIZATION_CONTRACT_REVISION) {
  throw new Error("OpenAPI optimization contract revision drift.");
}
for (const [path, operationId] of [
  ["/agent/optimization/sessions", "createOptimizationSession"],
  ["/agent/optimization/sessions", "listOptimizationSessions"],
  ["/agent/optimization/sessions/{session_id}", "getOptimizationSession"],
  ["/agent/optimization/sessions/{session_id}/events", "getOptimizationSessionEvents"],
  ["/agent/optimization/sessions/{session_id}/events/stream", "streamOptimizationSessionEvents"],
  ["/agent/optimization/sessions/{session_id}/candidates/{candidate_id}/approve", "approveOptimizationCandidate"],
  ["/agent/optimization/sessions/{session_id}/{action}", "mutateOptimizationSession"],
]) {
  const operation = Object.values(openapi.paths?.[path] ?? {}).find(
    (candidate) => candidate?.operationId === operationId,
  );
  if (operation?.operationId !== operationId) throw new Error(`OpenAPI optimization operation drift: ${operationId}`);
}
if (openapi["x-tilesim-contract"]?.agent_harness?.batch?.contract_revision !== BATCH_CONTRACT_REVISION) {
  throw new Error("OpenAPI batch contract revision drift.");
}
for (const [path, operationId] of [
  ["/agent/batches", "createBatch"],
  ["/agent/batches", "listBatches"],
  ["/agent/batches/{batch_id}", "getBatch"],
  ["/agent/batches/{batch_id}/events", "getBatchEvents"],
  ["/agent/batches/{batch_id}/events/stream", "streamBatchEvents"],
  ["/agent/batches/{batch_id}/approve", "approveBatch"],
  ["/agent/batches/{batch_id}/{action}", "mutateBatch"],
]) {
  const operation = Object.values(openapi.paths?.[path] ?? {}).find(
    (candidate) => candidate?.operationId === operationId,
  );
  if (operation?.operationId !== operationId) throw new Error(`OpenAPI batch operation drift: ${operationId}`);
}
for (const [path, operationId] of [
  ["/agent/drafts", "createAgentHarnessDraft"],
  ["/agent/drafts/{draft_id}", "getAgentHarnessDraft"],
  ["/agent/drafts/{draft_id}", "deleteAgentHarnessDraft"],
  ["/agent/drafts/{draft_id}/validate", "validateAgentHarnessDraft"],
  ["/agent/drafts/{draft_id}/events", "getAgentHarnessDraftEvents"],
  ["/agent/drafts/{draft_id}/events/stream", "streamAgentHarnessDraftEvents"],
  ["/agent/drafts/{draft_id}/approvals", "createAgentHarnessDraftApproval"],
  ["/agent/drafts/{draft_id}/approvals/{approval_id}", "getAgentHarnessDraftApproval"],
  ["/agent/drafts/{draft_id}/approvals/{approval_id}/reject", "rejectAgentHarnessDraftApproval"],
  ["/agent/drafts/{draft_id}/approvals/{approval_id}/revoke", "revokeAgentHarnessDraftApproval"],
  ["/agent/executions", "submitAgentExecution"],
  ["/agent/executions/{operation_id}", "getAgentExecution"],
  ["/agent/executions/{operation_id}/events", "getAgentExecutionEvents"],
  ["/agent/executions/{operation_id}/events/stream", "streamAgentExecutionEvents"],
  ["/agent/executions/{operation_id}/result", "getAgentExecutionResult"],
  ["/agent/executions/{operation_id}/{action}", "mutateAgentExecution"],
]) {
  const operation = Object.values(openapi.paths?.[path] ?? {}).find(
    (candidate) => candidate?.operationId === operationId,
  );
  if (operation?.operationId !== operationId) throw new Error(`OpenAPI successor operation drift: ${operationId}`);
}

const source = `// Generated from bridge/contracts/openapi.json and bridge/contracts/schemas/agent-harness. Do not edit by hand.

export const AGENT_HARNESS_CONTRACT_REVISION = ${JSON.stringify(CONTRACT_REVISION)} as const;
export const AGENT_HARNESS_SCHEMA_SET_REVISION = ${JSON.stringify(SCHEMA_SET_REVISION)} as const;
export const AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION = ${JSON.stringify(SUCCESSOR_CONTRACT_REVISION)} as const;
export const AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION = ${JSON.stringify(SUCCESSOR_SCHEMA_SET_REVISION)} as const;
export const AGENT_HARNESS_EXECUTION_CONTRACT_REVISION = ${JSON.stringify(EXECUTION_CONTRACT_REVISION)} as const;
export const AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION = ${JSON.stringify(OPTIMIZATION_CONTRACT_REVISION)} as const;
export const AGENT_HARNESS_BATCH_CONTRACT_REVISION = ${JSON.stringify(BATCH_CONTRACT_REVISION)} as const;
export const AGENT_HARNESS_TOOL_REGISTRY_REVISION = "2026-10-17.tools.v1" as const;
export const AGENT_HARNESS_BATCH_TOOL_REGISTRY_REVISION = "2026-10-19.tools.v3" as const;
export const AGENT_HARNESS_API_VERSION = "tilesim.bridge.api.v1" as const;

export type AgentHarnessWorkflowState =
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
export type AgentHarnessTerminalState = "completed" | "failed" | "cancelled";
export type AgentHarnessToolOutcome =
  | "succeeded"
  | "rejected"
  | "retryable_failure"
  | "terminal_failure"
  | "unknown_outcome";
export type AgentHarnessToolName =
  | "get_capability_catalog"
  | "get_run_status"
  | "list_run_evidence"
  | "query_verified_metrics";

export type AgentHarnessSchemaIdentity =
  | "tilesim.agent_harness.agent_operation.v1"
  | "tilesim.agent_harness.agent_turn.v1"
  | "tilesim.agent_harness.workflow_event.v1"
  | "tilesim.agent_harness.checkpoint.v1"
  | "tilesim.agent_harness.tool_call.v1"
  | "tilesim.agent_harness.tool_result.v1"
  | "tilesim.agent_harness.experiment_draft.v1"
  | "tilesim.agent_harness.approval.v1"
  | "tilesim.agent_harness.study.v1"
  | "tilesim.agent_harness.candidate.v1";

export type AgentHarnessSuccessorSchemaIdentity =
  | "tilesim.agent_harness.experiment_draft.v2"
  | "tilesim.agent_harness.draft_validation_report.v1"
  | "tilesim.agent_harness.approval.v2";

export type AgentHarnessExecutionSchemaIdentity =
  | "tilesim.agent_harness.execution_request.v1"
  | "tilesim.agent_harness.execution_operation.v1"
  | "tilesim.agent_harness.execution_event.v1"
  | "tilesim.agent_harness.execution_result_reference.v1"
  | "tilesim.agent_harness.execution_mutation_request.v1";

export type AgentHarnessOptimizationState =
  | "draft" | "submitted" | "queued" | "running" | "waiting_tool" | "waiting_approval" | "paused"
  | "retrying" | "completed" | "failed" | "cancelled" | "recovery_required" | "manual_intervention_required";
export type AgentHarnessOptimizationSchemaIdentity =
  | "tilesim.agent_harness.optimization_session.v1"
  | "tilesim.agent_harness.optimization_candidate.v1"
  | "tilesim.agent_harness.optimization_objective.v1"
  | "tilesim.agent_harness.optimization_constraint.v1"
  | "tilesim.agent_harness.optimization_tool_invocation.v1"
  | "tilesim.agent_harness.optimization_tool_result.v1"
  | "tilesim.agent_harness.optimization_iteration.v1"
  | "tilesim.agent_harness.optimization_evaluation.v1"
  | "tilesim.agent_harness.optimization_checkpoint.v1"
  | "tilesim.agent_harness.optimization_stop_reason.v1"
  | "tilesim.agent_harness.optimization_approval.v1"
  | "tilesim.agent_harness.optimization_summary.v1"
  | "tilesim.agent_harness.optimization_event.v1";

export type AgentHarnessBatchState = "draft" | "validated" | "waiting_approval" | "queued" | "running" | "paused" | "completed" | "failed" | "cancelled" | "recovery_required" | "manual_intervention_required";
export type AgentHarnessBatchSchemaIdentity =
  | "tilesim.agent_harness.batch_session.v1" | "tilesim.agent_harness.experiment_plan.v1" | "tilesim.agent_harness.candidate_set.v1"
  | "tilesim.agent_harness.run_slot.v1" | "tilesim.agent_harness.batch_objective.v1" | "tilesim.agent_harness.batch_budget.v1"
  | "tilesim.agent_harness.concurrency_policy.v1" | "tilesim.agent_harness.stop_policy.v1" | "tilesim.agent_harness.batch_checkpoint.v1"
  | "tilesim.agent_harness.batch_summary.v1" | "tilesim.agent_harness.batch_run_result.v1" | "tilesim.agent_harness.batch_failure_recovery.v1"
  | "tilesim.agent_harness.batch_approval.v1" | "tilesim.agent_harness.batch_event.v1";

export type AgentHarnessDraftStatus =
  | "draft"
  | "validated"
  | "invalid"
  | "unsupported"
  | "unavailable"
  | "stale"
  | "expired"
  | "deleted";
export type AgentHarnessValidationStatus =
  | "valid"
  | "invalid"
  | "unsupported"
  | "unavailable"
  | "stale"
  | "expired"
  | "rejected";
export type AgentHarnessApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "revoked" | "stale";

export interface AgentHarnessBackendIdentity {
  [key: string]: unknown;
}

export interface AgentHarnessCommon {
  schema_identity: string;
  contract_revision: typeof AGENT_HARNESS_CONTRACT_REVISION;
  operation_id: string;
  turn_id: string;
  run_id: string | null;
  snapshot_digest: string | null;
  workflow_state: AgentHarnessWorkflowState;
  schema_set_revision: string;
  policy_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  created_at: string;
  updated_at: string;
}

export interface AgentHarnessExperimentDraftV2 {
  schema_identity: "tilesim.agent_harness.experiment_draft.v2";
  contract_revision: typeof AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION;
  draft_id: string;
  operation_id: string;
  conversation_id?: string | null;
  turn_id?: string | null;
  principal: string;
  workspace_id: string;
  run_scope: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  parameter_catalog_revision: string;
  validator_revision: string;
  policy_revision: string;
  field_diffs: Array<Record<string, unknown>>;
  assumptions: string[];
  evidence_refs: string[];
  budget_request: Record<string, unknown>;
  risk_flags: string[];
  status: AgentHarnessDraftStatus;
  created_at: string;
  expires_at: string;
  draft_digest: string;
  idempotency_key: string;
  would_create_run: false;
  create_run_request_digest?: string | null;
}

export interface AgentHarnessDraftValidationReportV1 {
  schema_identity: "tilesim.agent_harness.draft_validation_report.v1";
  contract_revision: typeof AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION;
  draft_id: string;
  draft_digest: string;
  validation_id: string;
  principal: string;
  workspace_id: string;
  input_snapshot_digest: string;
  validator_revision: string;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  policy_revision: string;
  status: AgentHarnessValidationStatus;
  issues: Array<Record<string, unknown>>;
  field_results: Array<Record<string, unknown>>;
  unsupported_fields: string[];
  stale_reasons: string[];
  budget_estimate: Record<string, unknown>;
  risk_flags: string[];
  would_create_run: false;
  validated_create_run_request_digest: string;
  created_at: string;
}

export interface AgentHarnessApprovalV2 {
  schema_identity: "tilesim.agent_harness.approval.v2";
  contract_revision: typeof AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION;
  approval_id: string;
  draft_id: string;
  draft_digest: string;
  validation_id: string;
  principal: string;
  workspace_id: string;
  policy_revision: string;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  status: AgentHarnessApprovalStatus;
  created_at: string;
  expires_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  revoked_at: string | null;
  reason: string | null;
  approval_digest: string;
  single_use: boolean;
  consumed: boolean;
}

export interface AgentHarnessOperation extends AgentHarnessCommon {
  schema_identity: "tilesim.agent_harness.agent_operation.v1";
  idempotency_key: string;
  request_digest: string;
  principal: string;
  operation_kind: string;
  queue_delay_ms: number;
  attempt_count: number;
  checkpoint_id: string | null;
  last_error: AgentHarnessErrorDetails | null;
  cancellation_fence: string | null;
  lease: Record<string, unknown>;
  retention: Record<string, unknown>;
}

export interface AgentHarnessWorkflowEvent extends AgentHarnessCommon {
  schema_identity: "tilesim.agent_harness.workflow_event.v1";
  event_id: string;
  sequence: number;
  parent_event_id: string | null;
  node: string;
  payload_digest: string;
  terminal: boolean;
  idempotency_key: string;
}

export interface AgentHarnessCheckpoint extends AgentHarnessCommon {
  schema_identity: "tilesim.agent_harness.checkpoint.v1";
  checkpoint_id: string;
  state_digest: string;
  last_event_sequence: number;
  side_effect_digests: string[];
  resume_policy: Record<string, unknown>;
}

export interface AgentHarnessToolCall extends AgentHarnessCommon {
  schema_identity: "tilesim.agent_harness.tool_call.v1";
  tool_call_id: string;
  tool_name: string;
  tool_revision: string;
  input_digest: string;
  scope: string;
  permission_decision: "allow" | "deny";
  idempotency_key: string;
  timeout_ms: number;
  retry_policy: Record<string, unknown>;
}

export interface AgentHarnessToolResult extends AgentHarnessCommon {
  schema_identity: "tilesim.agent_harness.tool_result.v1";
  tool_call_id: string;
  tool_name: string;
  tool_revision: string;
  outcome: AgentHarnessToolOutcome;
  output_digest: string | null;
  retryable: boolean;
  terminal_failure: boolean;
  unknown_outcome: boolean;
  error_code: string | null;
  field_path: string | null;
  result?: unknown;
  replayed?: boolean;
}

export interface AgentHarnessErrorDetails {
  code: string;
  message?: string;
  field_path: string | null;
  retryable: boolean;
  terminal_failure: boolean;
  unknown_outcome: boolean;
}

export interface AgentHarnessErrorEnvelope {
  schema_identity: "tilesim.agent_harness.error.v1";
  contract_revision: typeof AGENT_HARNESS_CONTRACT_REVISION;
  error: AgentHarnessErrorDetails;
  request_id: string;
}

export interface AgentHarnessOperationCreateRequest {
  operation_kind?: "read_only";
  idempotency_key: string;
  run_id?: string;
  snapshot_digest?: string;
  principal?: string;
  turn_id?: string;
}

export interface AgentHarnessDraftCreateRequest {
  draft_id?: string;
  operation_id?: string;
  conversation_id?: string | null;
  turn_id?: string | null;
  principal?: string;
  workspace_id?: string;
  run_scope?: string;
  input_snapshot_digest?: string;
  schema_set_revision?: string;
  backend_identity?: AgentHarnessBackendIdentity;
  parameter_catalog_revision?: string;
  validator_revision?: string;
  policy_revision?: string;
  field_diffs?: Array<Record<string, unknown>>;
  assumptions?: string[];
  evidence_refs?: string[];
  budget_request?: Record<string, unknown>;
  risk_flags?: string[];
  expires_at?: string;
  create_run_request?: Record<string, unknown>;
  request?: Record<string, unknown>;
  idempotency_key?: string;
}

export interface AgentHarnessDraftValidationRequest {
  create_run_request?: Record<string, unknown>;
  request?: Record<string, unknown>;
  input_snapshot_digest?: string;
  validated_create_run_request_digest?: string;
  idempotency_key?: string;
}

export interface AgentHarnessApprovalCreateRequest {
  approval_id?: string;
  validation_id?: string;
  expires_at?: string;
  reason?: string | null;
  single_use?: boolean;
  approval_digest?: string;
  idempotency_key?: string;
}

export interface AgentHarnessToolCallRequest {
  operation_id: string;
  tool_name: AgentHarnessToolName;
  input: Record<string, unknown>;
  principal?: string;
  scope?: string;
}

export interface AgentHarnessToolDefinition {
  tool_name: AgentHarnessToolName;
  tool_revision: string;
  required_scope: string;
  timeout_ms: number;
  retryable: boolean;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  permission: {
    allow_shell: false;
    allow_arbitrary_path: false;
    allow_arbitrary_url: false;
    allow_network: false;
  };
}

export interface AgentHarnessCapabilitySnapshot {
  schema_identity: "tilesim.agent_harness.capability_snapshot.v1";
  contract_revision: typeof AGENT_HARNESS_CONTRACT_REVISION;
  schema_set_revision: string;
  policy_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  durable_store: Record<string, unknown>;
  workflow_states: AgentHarnessWorkflowState[];
  tools: AgentHarnessToolDefinition[];
  write_tools: string[];
  autonomous_optimization: boolean;
  provider_acceptance: string;
}

export interface AgentHarnessToolCatalog {
  schema_identity: "tilesim.agent_harness.tool_catalog.v1";
  contract_revision: typeof AGENT_HARNESS_TOOL_REGISTRY_REVISION;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  tools: AgentHarnessToolDefinition[];
  write_tools: string[];
}

export interface AgentHarnessOperationResponse {
  operation: AgentHarnessOperation;
  events?: AgentHarnessWorkflowEvent[];
  idempotent_replay?: boolean;
  action?: string;
}
export interface AgentHarnessOperationListResponse {
  operations: AgentHarnessOperation[];
}
export interface AgentHarnessEventsResponse {
  operation?: AgentHarnessOperation;
  events: AgentHarnessWorkflowEvent[];
  after_sequence?: number;
  terminal?: boolean;
}
export interface AgentHarnessToolCallResponse {
  operation: AgentHarnessOperation;
  tool_result: AgentHarnessToolResult;
}

export interface AgentHarnessDraftResponse {
  draft: AgentHarnessExperimentDraftV2;
  validation?: AgentHarnessDraftValidationReportV1 | null;
  idempotent_replay?: boolean;
  would_create_run: false;
}
export interface AgentHarnessValidationResponse {
  validation: AgentHarnessDraftValidationReportV1;
  idempotent_replay?: boolean;
  would_create_run: false;
}
export interface AgentHarnessDraftEventsResponse {
  draft_id: string;
  events: Array<Record<string, unknown>>;
  after_sequence?: number;
  terminal: boolean;
}
export interface AgentHarnessApprovalResponseV2 {
  approval: AgentHarnessApprovalV2;
  idempotent_replay?: boolean;
  would_create_run: false;
}
export interface AgentHarnessDraftDeleteResponse {
  draft_id: string;
  deleted: true;
  would_create_run: false;
}
export interface AgentHarnessExecutionOperation {
  schema_identity: "tilesim.agent_harness.execution_operation.v1";
  contract_revision: typeof AGENT_HARNESS_EXECUTION_CONTRACT_REVISION;
  execution_id: string;
  operation_id: string;
  draft_id: string;
  approval_id: string;
  validation_id: string;
  draft_digest: string;
  approval_digest: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  policy_revision: string;
  workflow_revision: string;
  idempotency_key: string;
  request_digest: string;
  principal: string;
  workspace_id: string;
  run_id: string | null;
  state: AgentHarnessWorkflowState | "preparing" | "waiting_artifacts" | "cancel_requested";
  created_at: string;
  updated_at: string;
  attempt_count: number;
  retryable: boolean;
  unknown_outcome: boolean;
  cancellation_fence: string | null;
  result: Record<string, unknown> | null;
  error: AgentHarnessErrorDetails | null;
}
export interface AgentHarnessExecutionRequest {
  schema_identity: "tilesim.agent_harness.execution_request.v1";
  contract_revision: typeof AGENT_HARNESS_EXECUTION_CONTRACT_REVISION;
  draft_id: string;
  approval_id: string;
  validation_id: string;
  draft_digest: string;
  approval_digest: string;
  input_snapshot_digest: string;
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  policy_revision: string;
  workflow_revision: string;
  create_run_request: Record<string, unknown>;
  create_run_request_digest: string;
  principal?: string;
  workspace_id?: string;
  idempotency_key: string;
}
export interface AgentHarnessExecutionMutationRequest {
  schema_identity: "tilesim.agent_harness.execution_mutation_request.v1";
  contract_revision: typeof AGENT_HARNESS_EXECUTION_CONTRACT_REVISION;
  operation_id: string;
  action: "cancel" | "retry" | "resume";
  idempotency_key: string;
}
export interface AgentHarnessExecutionEvent {
  schema_identity: "tilesim.agent_harness.execution_event.v1";
  contract_revision: typeof AGENT_HARNESS_EXECUTION_CONTRACT_REVISION;
  event_id: string;
  sequence: number;
  operation_id: string;
  execution_id: string;
  draft_id: string;
  approval_id: string;
  run_id: string | null;
  node: string;
  state: AgentHarnessExecutionOperation["state"];
  created_at: string;
  payload_digest: string;
  terminal: boolean;
  retryable: boolean;
}
export interface AgentHarnessExecutionResponse {
  execution: AgentHarnessExecutionOperation;
  operation: AgentHarnessOperation;
  idempotent_replay?: boolean;
  action?: string;
}
export interface AgentHarnessExecutionEventsResponse {
  execution: AgentHarnessExecutionOperation;
  operation: AgentHarnessOperation;
  events: AgentHarnessExecutionEvent[];
  after_sequence: number;
  terminal: boolean;
}
export interface AgentHarnessExecutionResultResponse { result: Record<string, unknown>; }

export interface AgentHarnessOptimizationSession {
  schema_identity: "tilesim.agent_harness.optimization_session.v1";
  contract_revision: typeof AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION;
  session_id: string; principal: string; workspace_id: string; input_snapshot_digest: string;
  schema_set_revision: string; backend_identity: AgentHarnessBackendIdentity; policy_revision: string;
  objective: Record<string, unknown>; constraints: Array<Record<string, unknown>>; budget: Record<string, number>;
  base_config: Record<string, unknown>; execution_request?: Record<string, unknown> | null;
  local_dev: true; automatic_submission: false; state?: AgentHarnessOptimizationState;
  current_candidate_id?: string | null; current_iteration?: number; run_count?: number; failure_count?: number;
  active_operation_id?: string | null; summary?: Record<string, unknown> | null;
  created_at?: string; updated_at?: string; provenance: Record<string, unknown>;
  error?: Record<string, unknown> | null;
}
export interface AgentHarnessOptimizationCandidate { schema_identity: "tilesim.agent_harness.optimization_candidate.v1"; contract_revision: typeof AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION; candidate_id: string; session_id: string; candidate_digest: string; config: Record<string, unknown>; diff: Record<string, unknown>; status: string; approval_id?: string | null; approval_digest?: string | null; provenance: Record<string, unknown>; [key: string]: unknown; }
export interface AgentHarnessOptimizationDetail { session: AgentHarnessOptimizationSession; candidate: AgentHarnessOptimizationCandidate | null; candidates: AgentHarnessOptimizationCandidate[]; iterations: Array<Record<string, unknown>>; evaluations?: Array<Record<string, unknown>>; events: Array<Record<string, unknown>>; checkpoint: Record<string, unknown> | null; approval: Record<string, unknown> | null; tool_invocations: Array<Record<string, unknown>>; summary?: Record<string, unknown> | null; }
export interface AgentHarnessOptimizationSessionResponse { session: AgentHarnessOptimizationSession; detail?: AgentHarnessOptimizationDetail; provenance: Record<string, unknown>; idempotent_replay?: boolean; }
export interface AgentHarnessOptimizationSessionListResponse { sessions: AgentHarnessOptimizationSession[]; provenance: Record<string, unknown>; }
export interface AgentHarnessOptimizationSessionEventsResponse { session_id: string; events: Array<Record<string, unknown>>; after_sequence?: number; terminal: boolean; provenance: Record<string, unknown>; }
export interface AgentHarnessOptimizationCreateRequest extends Partial<AgentHarnessOptimizationSession> { schema_identity: "tilesim.agent_harness.optimization_session.v1"; contract_revision: typeof AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION; idempotency_key?: string; }
export interface AgentHarnessOptimizationApprovalRequest { session_id?: string; candidate_id?: string; approval_digest?: string; expires_at?: string; idempotency_key?: string; }
export interface AgentHarnessOptimizationActionRequest { session_id: string; action: "pause" | "resume" | "cancel" | "retry"; recovery_acknowledged?: boolean; idempotency_key?: string; }
export interface AgentHarnessBatchSession { schema_identity: "tilesim.agent_harness.batch_session.v1"; contract_revision: typeof AGENT_HARNESS_BATCH_CONTRACT_REVISION; batch_id: string; principal: string; workspace_id: string; input_snapshot_digest: string; schema_set_revision: string; backend_identity: AgentHarnessBackendIdentity; policy_revision: string; plan: Record<string, unknown>; candidate_set: Record<string, unknown>[]; objective: Record<string, unknown>; budget: Record<string, number>; concurrency_policy: Record<string, unknown>; stop_policy: Record<string, unknown>; approval_required: true; auto_execute: boolean; local_dev: true; state?: AgentHarnessBatchState; status?: AgentHarnessBatchState; approval?: Record<string, unknown>; summary?: Record<string, unknown> | null; provenance: Record<string, unknown>; created_at?: string; updated_at?: string; }
export interface AgentHarnessBatchCandidate { schema_identity: "tilesim.agent_harness.candidate_set.v1"; contract_revision: typeof AGENT_HARNESS_BATCH_CONTRACT_REVISION; candidate_id: string; batch_id: string; sequence: number; parent_candidate_id: string | null; candidate_digest: string; principal: string; workspace_id: string; snapshot_digest: string; backend_identity: AgentHarnessBackendIdentity; schema_set_revision: string; policy_revision: string; config: Record<string, unknown>; diff: Record<string, unknown>; status: string; operation_id?: string | null; run_id?: string | null; artifact_manifest_digest?: string | null; result?: Record<string, unknown> | null; failure?: Record<string, unknown> | null; provenance: Record<string, unknown>; }
export interface AgentHarnessBatchDetail { batch: AgentHarnessBatchSession; candidates: AgentHarnessBatchCandidate[]; events: Array<Record<string, unknown>>; checkpoint?: Record<string, unknown> | null; lease?: Record<string, unknown> | null; summary?: Record<string, unknown>; }
export interface AgentHarnessBatchResponse { batch: AgentHarnessBatchSession; detail?: AgentHarnessBatchDetail; provenance: Record<string, unknown>; idempotent_replay?: boolean; }
export interface AgentHarnessBatchListResponse { batches: AgentHarnessBatchSession[]; provenance: Record<string, unknown>; }
export interface AgentHarnessBatchEventsResponse { batch_id: string; events: Array<Record<string, unknown>>; after_sequence: number; terminal: boolean; provenance: Record<string, unknown>; }
export interface AgentHarnessBatchCreateRequest extends Partial<AgentHarnessBatchSession> { schema_identity: "tilesim.agent_harness.batch_session.v1"; contract_revision: typeof AGENT_HARNESS_BATCH_CONTRACT_REVISION; input_snapshot_digest: string; schema_set_revision: string; backend_identity: AgentHarnessBackendIdentity; plan: Record<string, unknown>; candidate_set: Record<string, unknown>[]; objective: Record<string, unknown>; execution_request?: Record<string, unknown> | null; local_dev: true; approval_required: true; auto_execute?: boolean; }
export interface AgentHarnessBatchApprovalRequest { approval_digest?: string; expires_at?: string; idempotency_key?: string; }
export interface AgentHarnessBatchActionRequest { batch_id: string; action: "start" | "pause" | "resume" | "cancel" | "retry"; recovery_acknowledged?: boolean; idempotency_key?: string; }

export interface AgentHarnessResponseMetadata<T> {
  payload: T;
  schemaSetRevision: string;
  apiVersion: string;
}
export interface AgentHarnessTransport {
  request<T>(path: string, options?: RequestInit): Promise<AgentHarnessResponseMetadata<T>>;
}

export const agentHarnessPaths = {
  capabilities: () => "/agent/harness-capabilities",
  tools: () => "/agent/tools",
  operations: () => "/agent/operations",
  operation: (operationId: string) => \`/agent/operations/\${encodeURIComponent(operationId)}\`,
  events: (operationId: string) => \`/agent/operations/\${encodeURIComponent(operationId)}/events\`,
  eventStream: (operationId: string) => \`/agent/operations/\${encodeURIComponent(operationId)}/events/stream\`,
  toolCall: () => "/agent/tools/call",
  drafts: () => "/agent/drafts",
  draft: (draftId: string) => \`/agent/drafts/\${encodeURIComponent(draftId)}\`,
  draftValidate: (draftId: string) => \`\${agentHarnessPaths.draft(draftId)}/validate\`,
  draftEvents: (draftId: string) => \`\${agentHarnessPaths.draft(draftId)}/events\`,
  draftEventStream: (draftId: string) => \`\${agentHarnessPaths.draft(draftId)}/events/stream\`,
  draftApprovals: (draftId: string) => \`\${agentHarnessPaths.draft(draftId)}/approvals\`,
  draftApproval: (draftId: string, approvalId: string) => \`\${agentHarnessPaths.draftApprovals(draftId)}/\${encodeURIComponent(approvalId)}\`,
  draftApprovalReject: (draftId: string, approvalId: string) => \`\${agentHarnessPaths.draftApproval(draftId, approvalId)}/reject\`,
  draftApprovalRevoke: (draftId: string, approvalId: string) => \`\${agentHarnessPaths.draftApproval(draftId, approvalId)}/revoke\`,
  executions: () => "/agent/executions",
  execution: (operationId: string) => \`/agent/executions/\${encodeURIComponent(operationId)}\`,
  executionEvents: (operationId: string) => \`\${agentHarnessPaths.execution(operationId)}/events\`,
  executionEventStream: (operationId: string) => \`\${agentHarnessPaths.execution(operationId)}/events/stream\`,
  executionResult: (operationId: string) => \`\${agentHarnessPaths.execution(operationId)}/result\`,
  executionAction: (operationId: string, action: "cancel" | "retry" | "resume") => \`\${agentHarnessPaths.execution(operationId)}/\${action}\`,
  optimizationSessions: () => "/agent/optimization/sessions",
  optimizationSession: (sessionId: string) => \`/agent/optimization/sessions/\${encodeURIComponent(sessionId)}\`,
  optimizationEvents: (sessionId: string) => \`\${agentHarnessPaths.optimizationSession(sessionId)}/events\`,
  optimizationApprove: (sessionId: string, candidateId: string) => \`\${agentHarnessPaths.optimizationSession(sessionId)}/candidates/\${encodeURIComponent(candidateId)}/approve\`,
  optimizationAction: (sessionId: string, action: "pause" | "resume" | "cancel" | "retry") => \`\${agentHarnessPaths.optimizationSession(sessionId)}/\${action}\`,
  batches: () => "/agent/batches",
  batch: (batchId: string) => \`/agent/batches/\${encodeURIComponent(batchId)}\`,
  batchEvents: (batchId: string) => \`\${agentHarnessPaths.batch(batchId)}/events\`,
  batchEventStream: (batchId: string) => \`\${agentHarnessPaths.batch(batchId)}/events/stream\`,
  batchApprove: (batchId: string) => \`\${agentHarnessPaths.batch(batchId)}/approve\`,
  batchAction: (batchId: string, action: "start" | "pause" | "resume" | "cancel" | "retry") => \`\${agentHarnessPaths.batch(batchId)}/\${action}\`,
} as const;

export class GeneratedAgentHarnessClient {
  constructor(private readonly transport: AgentHarnessTransport) {}

  capabilities() {
    return this.transport.request<AgentHarnessCapabilitySnapshot>(agentHarnessPaths.capabilities());
  }

  tools() {
    return this.transport.request<AgentHarnessToolCatalog>(agentHarnessPaths.tools());
  }

  createOperation(body: AgentHarnessOperationCreateRequest) {
    return this.transport.request<AgentHarnessOperationResponse>(agentHarnessPaths.operations(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key },
      body: JSON.stringify(body),
    });
  }

  listOperations() {
    return this.transport.request<AgentHarnessOperationListResponse>(agentHarnessPaths.operations());
  }

  operation(operationId: string) {
    return this.transport.request<AgentHarnessOperationResponse>(agentHarnessPaths.operation(operationId));
  }

  events(operationId: string, lastEventId = "0") {
    const headers: Record<string, string> = {};
    if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId;
    return this.transport.request<AgentHarnessEventsResponse>(agentHarnessPaths.events(operationId), { headers });
  }

  callTool(body: AgentHarnessToolCallRequest) {
    return this.transport.request<AgentHarnessToolCallResponse>(agentHarnessPaths.toolCall(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  createDraft(body: AgentHarnessDraftCreateRequest, idempotencyKey: string) {
    return this.transport.request<AgentHarnessDraftResponse>(agentHarnessPaths.drafts(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  draft(draftId: string) {
    return this.transport.request<AgentHarnessDraftResponse>(agentHarnessPaths.draft(draftId));
  }

  deleteDraft(draftId: string, idempotencyKey: string) {
    return this.transport.request<AgentHarnessDraftDeleteResponse>(agentHarnessPaths.draft(draftId), {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  validateDraft(draftId: string, body: AgentHarnessDraftValidationRequest, idempotencyKey: string) {
    return this.transport.request<AgentHarnessValidationResponse>(agentHarnessPaths.draftValidate(draftId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  draftEvents(draftId: string, lastEventId = "0") {
    const headers: Record<string, string> = {};
    if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId;
    return this.transport.request<AgentHarnessDraftEventsResponse>(agentHarnessPaths.draftEvents(draftId), { headers });
  }

  draftEventStream(draftId: string) {
    return agentHarnessPaths.draftEventStream(draftId);
  }

  createDraftApproval(draftId: string, body: AgentHarnessApprovalCreateRequest, idempotencyKey: string) {
    return this.transport.request<AgentHarnessApprovalResponseV2>(agentHarnessPaths.draftApprovals(draftId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  draftApproval(draftId: string, approvalId: string) {
    return this.transport.request<AgentHarnessApprovalResponseV2>(agentHarnessPaths.draftApproval(draftId, approvalId));
  }

  rejectDraftApproval(draftId: string, approvalId: string, reason: string, idempotencyKey: string) {
    return this.transport.request<AgentHarnessApprovalResponseV2>(agentHarnessPaths.draftApprovalReject(draftId, approvalId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason }),
    });
  }

  revokeDraftApproval(draftId: string, approvalId: string, reason: string, idempotencyKey: string) {
    return this.transport.request<AgentHarnessApprovalResponseV2>(agentHarnessPaths.draftApprovalRevoke(draftId, approvalId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason }),
    });
  }

  submitExecution(body: AgentHarnessExecutionRequest) {
    return this.transport.request<AgentHarnessExecutionResponse>(agentHarnessPaths.executions(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key ?? "" },
      body: JSON.stringify(body),
    });
  }
  execution(operationId: string) {
    return this.transport.request<AgentHarnessExecutionResponse>(agentHarnessPaths.execution(operationId));
  }
  executionEvents(operationId: string, lastEventId = "0") {
    const headers: Record<string, string> = {};
    if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId;
    return this.transport.request<AgentHarnessExecutionEventsResponse>(agentHarnessPaths.executionEvents(operationId), { headers });
  }
  executionResult(operationId: string) {
    return this.transport.request<AgentHarnessExecutionResultResponse>(agentHarnessPaths.executionResult(operationId));
  }
  executionAction(operationId: string, action: "cancel" | "retry" | "resume", body: AgentHarnessExecutionMutationRequest) {
    return this.transport.request<AgentHarnessExecutionResponse>(agentHarnessPaths.executionAction(operationId, action), {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key }, body: JSON.stringify(body),
    });
  }
  listOptimizationSessions() {
    return this.transport.request<AgentHarnessOptimizationSessionListResponse>(agentHarnessPaths.optimizationSessions());
  }
  createOptimizationSession(body: AgentHarnessOptimizationCreateRequest, idempotencyKey: string) {
    return this.transport.request<AgentHarnessOptimizationSessionResponse>(agentHarnessPaths.optimizationSessions(), {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body),
    });
  }
  optimizationSession(sessionId: string) {
    return this.transport.request<AgentHarnessOptimizationSessionResponse>(agentHarnessPaths.optimizationSession(sessionId));
  }
  optimizationEvents(sessionId: string, lastEventId = "0") {
    const headers: Record<string, string> = {};
    if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId;
    return this.transport.request<AgentHarnessOptimizationSessionEventsResponse>(agentHarnessPaths.optimizationEvents(sessionId), { headers });
  }
  approveOptimizationCandidate(sessionId: string, candidateId: string, body: AgentHarnessOptimizationApprovalRequest, idempotencyKey: string) {
    return this.transport.request<AgentHarnessOptimizationSessionResponse>(agentHarnessPaths.optimizationApprove(sessionId, candidateId), {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body),
    });
  }
  mutateOptimizationSession(sessionId: string, action: "pause" | "resume" | "cancel" | "retry", body: AgentHarnessOptimizationActionRequest) {
    return this.transport.request<AgentHarnessOptimizationSessionResponse>(agentHarnessPaths.optimizationAction(sessionId, action), {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key ?? "" }, body: JSON.stringify(body),
    });
  }
  listBatches() { return this.transport.request<AgentHarnessBatchListResponse>(agentHarnessPaths.batches()); }
  createBatch(body: AgentHarnessBatchCreateRequest, idempotencyKey: string) { return this.transport.request<AgentHarnessBatchResponse>(agentHarnessPaths.batches(), { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) }); }
  batch(batchId: string) { return this.transport.request<AgentHarnessBatchResponse>(agentHarnessPaths.batch(batchId)); }
  batchEvents(batchId: string, lastEventId = "0") { const headers: Record<string, string> = {}; if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId; return this.transport.request<AgentHarnessBatchEventsResponse>(agentHarnessPaths.batchEvents(batchId), { headers }); }
  approveBatch(batchId: string, body: AgentHarnessBatchApprovalRequest, idempotencyKey: string) { return this.transport.request<AgentHarnessBatchResponse>(agentHarnessPaths.batchApprove(batchId), { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) }); }
  mutateBatch(batchId: string, action: AgentHarnessBatchActionRequest["action"], body: AgentHarnessBatchActionRequest) { return this.transport.request<AgentHarnessBatchResponse>(agentHarnessPaths.batchAction(batchId, action), { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key ?? "" }, body: JSON.stringify(body) }); }
}
`;
const generated = await format(source, { ...prettierConfig, filepath: outputPath });

function hasGeneratedDrift(current, next) {
  return current.replaceAll("\r\n", "\n") !== next.replaceAll("\r\n", "\n");
}

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    // Missing output is reported as drift below.
  }
  if (hasGeneratedDrift(current, generated)) {
    process.stderr.write("Generated Agent Harness client is stale. Run pnpm contracts:generate.\n");
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
  process.stdout.write(`Generated ${outputPath}\n`);
}
