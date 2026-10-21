import { parseJsonLossless } from "../../contracts/lossless-json";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_CONTRACT_REVISION,
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
  AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
  AGENT_HARNESS_BATCH_CONTRACT_REVISION,
  AGENT_HARNESS_TOOL_REGISTRY_REVISION,
  agentHarnessPaths,
  GeneratedAgentHarnessClient,
  type AgentHarnessBackendIdentity,
  type AgentHarnessApprovalCreateRequest,
  type AgentHarnessApprovalV2,
  type AgentHarnessApprovalStatus,
  type AgentHarnessDraftCreateRequest,
  type AgentHarnessDraftDeleteResponse,
  type AgentHarnessDraftResponse,
  type AgentHarnessDraftStatus,
  type AgentHarnessDraftValidationRequest,
  type AgentHarnessDraftValidationReportV1,
  type AgentHarnessExperimentDraftV2,
  type AgentHarnessCapabilitySnapshot,
  type AgentHarnessErrorDetails,
  type AgentHarnessEventsResponse,
  type AgentHarnessOperation,
  type AgentHarnessOperationCreateRequest,
  type AgentHarnessOperationListResponse,
  type AgentHarnessOperationResponse,
  type AgentHarnessToolCallRequest,
  type AgentHarnessToolCatalog,
  type AgentHarnessToolName,
  type AgentHarnessToolOutcome,
  type AgentHarnessToolResult,
  type AgentHarnessValidationStatus,
  type AgentHarnessWorkflowEvent,
  type AgentHarnessWorkflowState,
  type AgentHarnessExecutionEvent,
  type AgentHarnessExecutionMutationRequest,
  type AgentHarnessExecutionOperation,
  type AgentHarnessExecutionRequest,
} from "../../contracts/generated/agent-harness";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, apiRoots, isRecord, parseResponse } from "./transport";
import { parseSseFrame } from "./sse";

export {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_CONTRACT_REVISION,
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
  AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
  AGENT_HARNESS_BATCH_CONTRACT_REVISION,
  AGENT_HARNESS_TOOL_REGISTRY_REVISION,
};
export type {
  AgentHarnessBackendIdentity,
  AgentHarnessApprovalCreateRequest,
  AgentHarnessApprovalResponseV2,
  AgentHarnessApprovalV2,
  AgentHarnessApprovalStatus,
  AgentHarnessDraftCreateRequest,
  AgentHarnessDraftDeleteResponse,
  AgentHarnessDraftEventsResponse,
  AgentHarnessDraftResponse,
  AgentHarnessDraftStatus,
  AgentHarnessDraftValidationRequest,
  AgentHarnessDraftValidationReportV1,
  AgentHarnessExperimentDraftV2,
  AgentHarnessCapabilitySnapshot,
  AgentHarnessErrorDetails,
  AgentHarnessOperation,
  AgentHarnessOperationCreateRequest,
  AgentHarnessOperationListResponse,
  AgentHarnessToolCatalog,
  AgentHarnessToolName,
  AgentHarnessToolOutcome,
  AgentHarnessToolResult,
  AgentHarnessValidationResponse,
  AgentHarnessValidationStatus,
  AgentHarnessWorkflowEvent,
  AgentHarnessWorkflowState,
  AgentHarnessExecutionEvent,
  AgentHarnessExecutionMutationRequest,
  AgentHarnessExecutionOperation,
  AgentHarnessExecutionRequest,
} from "../../contracts/generated/agent-harness";
export type {
  AgentHarnessOptimizationActionRequest,
  AgentHarnessOptimizationApprovalRequest,
  AgentHarnessOptimizationCandidate,
  AgentHarnessOptimizationCreateRequest,
  AgentHarnessOptimizationDetail,
  AgentHarnessOptimizationSession,
  AgentHarnessOptimizationSessionEventsResponse,
  AgentHarnessBatchSession,
  AgentHarnessBatchDetail,
  AgentHarnessBatchCandidate,
  AgentHarnessBatchActionRequest,
  AgentHarnessBatchCreateRequest,
} from "../../contracts/generated/agent-harness";

const toolScopes: Record<AgentHarnessToolName, string> = {
  get_capability_catalog: "agent:read_capability",
  get_run_status: "agent:read_run",
  list_run_evidence: "agent:read_evidence",
  query_verified_metrics: "agent:read_evidence",
};
const toolNames = Object.keys(toolScopes) as AgentHarnessToolName[];
const terminalStates = new Set<AgentHarnessWorkflowState>(["completed", "failed", "cancelled"]);
const publishedSchemaSetRevisions: ReadonlySet<string> = new Set([
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
]);
const pointerPattern = /^(?:|\/(?:[^~/]|~[01])*)*$/u;

function isPublishedSchemaSetRevision(value: unknown): boolean {
  return typeof value === "string" && publishedSchemaSetRevisions.has(value);
}

const client = new GeneratedAgentHarnessClient({
  request: (path, options) => apiRequestWithMetadata(path, options),
});

export interface AgentHarnessBinding {
  backend_identity: AgentHarnessBackendIdentity;
  schema_set_revision: string;
  run_id: string | null;
  snapshot_digest: string | null;
}

export type AgentHarnessBindingMismatch =
  "schema_set_revision_changed" | "backend_identity_changed" | "run_changed" | "snapshot_changed";

export interface AgentHarnessOperationProjection {
  operation: AgentHarnessOperation | null;
  events: AgentHarnessWorkflowEvent[];
  state: AgentHarnessWorkflowState | null;
  terminal: boolean;
  source: "initial" | "sse" | "polling";
  last_event_sequence: number;
  duplicate_event_ids: string[];
  rejected_event_ids: string[];
  late_event_ids: string[];
  stale_reason: AgentHarnessBindingMismatch | null;
  requires_recovery: boolean;
  error: AgentHarnessErrorDetails | null;
}

/** A list item plus its durable detail projection for the read-only task center. */
export interface AgentHarnessOperationSnapshot {
  operation: AgentHarnessOperation;
  projection: AgentHarnessOperationProjection | null;
  error: BridgeApiError | null;
}

export interface AgentHarnessToolInvocation {
  operation: AgentHarnessOperation | null;
  tool_result: AgentHarnessToolResult | null;
  outcome: AgentHarnessToolOutcome;
  tool_name: AgentHarnessToolName;
  status: "available" | "rejected" | "failed" | "unknown_outcome";
  error: AgentHarnessErrorDetails | null;
  result: unknown;
}

export interface AgentHarnessVerifiedArtifactEntry {
  artifact_id: string;
  report_kind: string | null;
  file_name: string;
  media_type: "application/json";
  bytes: number | string | bigint;
  sha256: string;
  schema_identity: string;
  contract_status: "supported" | "legacy_compatibility" | "not_applicable";
  content_status?: "ready" | "expected_absence";
}

export interface AgentHarnessVerifiedArtifactManifest {
  schema_version: "tilesim.bridge.artifact_manifest.v2";
  api_version: typeof AGENT_HARNESS_API_VERSION;
  schema_set_revision: string;
  run_id: string;
  artifacts: AgentHarnessVerifiedArtifactEntry[];
  rejected_artifacts: Array<Record<string, unknown>>;
}

function contractError(code: string, message: string, fieldPath: string | null = null): BridgeApiError {
  return new BridgeApiError(message, {
    status: 0,
    code,
    fieldPath,
    retryable: false,
    terminalFailure: true,
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function identityKey(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function assertMetadata(schemaSetRevision: string, apiVersion: string): void {
  if (apiVersion !== AGENT_HARNESS_API_VERSION) {
    throw contractError("unsupported_api_contract", "Agent Harness API version is not published.");
  }
  if (!isPublishedSchemaSetRevision(schemaSetRevision)) {
    throw contractError(
      "schema_revision_mismatch",
      "Agent Harness schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
}

function assertCommon(value: unknown, expectedIdentity: string): asserts value is Record<string, unknown> {
  if (!isRecord(value))
    throw contractError("invalid_agent_harness_payload", "Agent Harness response must be an object.");
  if (value.schema_identity !== expectedIdentity) {
    throw contractError(
      "schema_identity_mismatch",
      "Agent Harness response schema identity is not published.",
      "/schema_identity",
    );
  }
  if (value.contract_revision !== AGENT_HARNESS_CONTRACT_REVISION) {
    throw contractError(
      "contract_revision_mismatch",
      "Agent Harness contract revision is stale.",
      "/contract_revision",
    );
  }
  if (typeof value.schema_set_revision !== "string" || !isPublishedSchemaSetRevision(value.schema_set_revision)) {
    throw contractError(
      "schema_revision_mismatch",
      "Agent Harness payload schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
  if (typeof value.operation_id !== "string" || typeof value.turn_id !== "string") {
    throw contractError(
      "invalid_agent_harness_identity",
      "Operation and turn identities are required.",
      "/operation_id",
    );
  }
  if (typeof value.backend_identity !== "object" || !value.backend_identity) {
    throw contractError("invalid_backend_identity", "Backend identity is required.", "/backend_identity");
  }
}

function assertOperation(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessOperation {
  assertMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  assertCommon(value, "tilesim.agent_harness.agent_operation.v1");
  if (
    typeof value.workflow_state !== "string" ||
    (!terminalStates.has(value.workflow_state as AgentHarnessWorkflowState) &&
      ![
        "draft",
        "submitted",
        "queued",
        "running",
        "waiting_tool",
        "waiting_approval",
        "retrying",
        "recovery_required",
        "manual_intervention_required",
      ].includes(value.workflow_state))
  ) {
    throw contractError("invalid_workflow_state", "Unknown Agent Harness workflow state.", "/workflow_state");
  }
  return value as unknown as AgentHarnessOperation;
}

function assertOperationList(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessOperationListResponse {
  assertMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  if (!isRecord(value) || !Array.isArray(value.operations)) {
    throw contractError(
      "invalid_operation_list",
      "Agent Harness operation list is not a closed response.",
      "/operations",
    );
  }
  return { operations: value.operations.map((operation) => assertOperation(operation, metadata)) };
}

function assertEvent(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessWorkflowEvent {
  assertMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  assertCommon(value, "tilesim.agent_harness.workflow_event.v1");
  if (
    typeof value.event_id !== "string" ||
    typeof value.sequence !== "number" ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1
  ) {
    throw contractError("invalid_event_sequence", "Workflow event identity or sequence is invalid.", "/sequence");
  }
  if (
    typeof value.payload_digest !== "string" ||
    typeof value.node !== "string" ||
    typeof value.terminal !== "boolean"
  ) {
    throw contractError("invalid_workflow_event", "Workflow event payload is incomplete.");
  }
  return value as unknown as AgentHarnessWorkflowEvent;
}

function assertOperationResponse(
  response: AgentHarnessOperationResponse,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessOperationResponse {
  assertOperation(response.operation, metadata);
  if (response.events) {
    response.events = response.events.map((event) => {
      const checked = assertEvent(event, metadata);
      if (
        checked.operation_id !== response.operation.operation_id ||
        checked.turn_id !== response.operation.turn_id ||
        checked.run_id !== response.operation.run_id ||
        checked.snapshot_digest !== response.operation.snapshot_digest ||
        checked.schema_set_revision !== response.operation.schema_set_revision ||
        identityKey(checked.backend_identity) !== identityKey(response.operation.backend_identity)
      ) {
        throw contractError(
          "operation_binding_mismatch",
          "Workflow event does not belong to the requested operation.",
          "/events",
        );
      }
      return checked;
    });
  }
  return response;
}

function assertToolResult(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessToolResult {
  assertMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  assertCommon(value, "tilesim.agent_harness.tool_result.v1");
  if (!toolNames.includes(value.tool_name as AgentHarnessToolName)) {
    throw contractError("unknown_tool", "Tool result names a tool that is not exposed.", "/tool_name");
  }
  if (
    typeof value.tool_call_id !== "string" ||
    typeof value.tool_revision !== "string" ||
    !["succeeded", "rejected", "retryable_failure", "terminal_failure", "unknown_outcome"].includes(
      String(value.outcome),
    )
  ) {
    throw contractError("invalid_tool_result", "Tool result is not a closed v1 result.");
  }
  if (
    typeof value.retryable !== "boolean" ||
    typeof value.terminal_failure !== "boolean" ||
    typeof value.unknown_outcome !== "boolean"
  ) {
    throw contractError("invalid_tool_result", "Tool result failure flags are invalid.");
  }
  return value as unknown as AgentHarnessToolResult;
}

function assertBackendIdentity(
  actual: AgentHarnessBackendIdentity,
  expected: AgentHarnessBackendIdentity | null,
): void {
  if (expected && identityKey(actual) !== identityKey(expected)) {
    throw contractError(
      "backend_identity_mismatch",
      "Agent Harness response belongs to another backend identity.",
      "/backend_identity",
    );
  }
}

export function validateAgentHarnessVerifiedArtifactManifest(
  value: unknown,
  expectedRunId: string,
): AgentHarnessVerifiedArtifactManifest {
  if (
    !isRecord(value) ||
    value.schema_version !== "tilesim.bridge.artifact_manifest.v2" ||
    value.api_version !== AGENT_HARNESS_API_VERSION
  ) {
    throw contractError(
      "artifact_schema_mismatch",
      "Tool result is not a supported artifact manifest.",
      "/result/schema_version",
    );
  }
  if (
    !isPublishedSchemaSetRevision(value.schema_set_revision) ||
    value.run_id !== expectedRunId ||
    !Array.isArray(value.artifacts) ||
    !Array.isArray(value.rejected_artifacts)
  ) {
    throw contractError(
      "artifact_binding_mismatch",
      "Artifact manifest is not bound to the current schema-set or run.",
      "/result/run_id",
    );
  }
  for (const [index, entry] of value.artifacts.entries()) {
    if (
      !isRecord(entry) ||
      typeof entry.artifact_id !== "string" ||
      typeof entry.file_name !== "string" ||
      entry.file_name.includes("/") ||
      entry.file_name.includes("\\") ||
      entry.media_type !== "application/json" ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(entry.sha256) ||
      typeof entry.schema_identity !== "string" ||
      !["supported", "legacy_compatibility", "not_applicable"].includes(String(entry.contract_status))
    ) {
      throw contractError(
        "artifact_identity_invalid",
        "Artifact identity, SHA-256, bytes or schema is invalid.",
        `/result/artifacts/${index}`,
      );
    }
    if (
      !(typeof entry.bytes === "number" || typeof entry.bytes === "string" || typeof entry.bytes === "bigint") ||
      (typeof entry.bytes === "number" && (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0))
    ) {
      throw contractError(
        "artifact_bytes_invalid",
        "Artifact byte count must remain lossless.",
        `/result/artifacts/${index}/bytes`,
      );
    }
  }
  return value as unknown as AgentHarnessVerifiedArtifactManifest;
}

export function validateAgentHarnessMetricsPointers(
  value: unknown,
  requestedPointers: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value))
    throw contractError("metrics_result_invalid", "Verified metrics result is not an object.", "/result");
  for (const pointer of requestedPointers) {
    if (!pointerPattern.test(pointer) || !Object.prototype.hasOwnProperty.call(value, pointer)) {
      throw contractError(
        "artifact_pointer_not_found",
        "Verified metrics result does not contain the requested JSON Pointer.",
        "/input/json_pointers",
      );
    }
  }
  return value;
}

export async function getAgentHarnessCapabilities(): Promise<AgentHarnessCapabilitySnapshot> {
  const response = await client.capabilities();
  assertMetadata(response.schemaSetRevision, response.apiVersion);
  if (response.payload.schema_identity !== "tilesim.agent_harness.capability_snapshot.v1") {
    throw contractError(
      "schema_identity_mismatch",
      "Capability snapshot identity is not published.",
      "/schema_identity",
    );
  }
  if (response.payload.contract_revision !== AGENT_HARNESS_CONTRACT_REVISION) {
    throw contractError(
      "contract_revision_mismatch",
      "Capability snapshot contract revision is stale.",
      "/contract_revision",
    );
  }
  if (!isPublishedSchemaSetRevision(response.payload.schema_set_revision)) {
    throw contractError(
      "schema_revision_mismatch",
      "Capability snapshot schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
  if (
    !Array.isArray(response.payload.write_tools) ||
    response.payload.write_tools.length !== 0 ||
    response.payload.autonomous_optimization !== false
  ) {
    throw contractError(
      "unsafe_capability_surface",
      "The published Harness surface contains a write or autonomous capability.",
    );
  }
  if (!Array.isArray(response.payload.tools)) {
    throw contractError("invalid_capability_snapshot", "Capability snapshot tool list is invalid.", "/tools");
  }
  const publishedNames = response.payload.tools.map((tool) => tool.tool_name);
  if (publishedNames.some((name) => !toolNames.includes(name)) || new Set(publishedNames).size !== toolNames.length) {
    throw contractError(
      "unknown_tool",
      "Capability snapshot contains an unapproved or missing read-only tool.",
      "/tools",
    );
  }
  return response.payload;
}

export async function getAgentHarnessToolCatalog(
  expectedBackendIdentity: AgentHarnessBackendIdentity | null = null,
): Promise<AgentHarnessToolCatalog> {
  const response = await client.tools();
  assertMetadata(response.schemaSetRevision, response.apiVersion);
  const catalog = response.payload;
  if (
    catalog.schema_identity !== "tilesim.agent_harness.tool_catalog.v1" ||
    catalog.contract_revision !== AGENT_HARNESS_TOOL_REGISTRY_REVISION
  ) {
    throw contractError(
      "tool_registry_revision_mismatch",
      "Tool registry revision is not published.",
      "/contract_revision",
    );
  }
  if (
    !isPublishedSchemaSetRevision(catalog.schema_set_revision) ||
    !Array.isArray(catalog.write_tools) ||
    catalog.write_tools.length !== 0
  ) {
    throw contractError("schema_revision_mismatch", "Tool catalog schema-set or write surface is invalid.");
  }
  assertBackendIdentity(catalog.backend_identity, expectedBackendIdentity);
  if (
    !Array.isArray(catalog.tools) ||
    catalog.tools.length !== toolNames.length ||
    catalog.tools.some((tool) => !toolNames.includes(tool.tool_name))
  ) {
    throw contractError("unknown_tool", "Tool catalog contains a tool outside the read-only allow-list.", "/tools");
  }
  for (const tool of catalog.tools) {
    if (
      tool.tool_revision !== "1" ||
      tool.required_scope !== toolScopes[tool.tool_name] ||
      tool.permission.allow_shell ||
      tool.permission.allow_arbitrary_path ||
      tool.permission.allow_arbitrary_url ||
      tool.permission.allow_network
    ) {
      throw contractError(
        "unsafe_tool_surface",
        "Tool catalog exposes an unsafe or incorrectly scoped tool.",
        "/tools",
      );
    }
  }
  return catalog;
}

export async function createAgentHarnessReadOnlyOperation(
  request: Omit<AgentHarnessOperationCreateRequest, "operation_kind" | "idempotency_key"> & {
    idempotency_key?: string;
  } = {},
): Promise<AgentHarnessOperation> {
  const body: AgentHarnessOperationCreateRequest = {
    operation_kind: "read_only",
    idempotency_key: request.idempotency_key || `web-read:${crypto.randomUUID()}`,
    ...(request.run_id ? { run_id: request.run_id } : {}),
    ...(request.snapshot_digest ? { snapshot_digest: request.snapshot_digest } : {}),
    ...(request.principal ? { principal: request.principal } : {}),
    ...(request.turn_id ? { turn_id: request.turn_id } : {}),
  };
  const response = await client.createOperation(body);
  assertOperationResponse(response.payload, response);
  return response.payload.operation;
}

function validateToolInput(toolName: AgentHarnessToolName, input: Record<string, unknown>): void {
  const allowed = new Set([
    "run_id",
    "snapshot_digest",
    "artifact_id",
    "json_pointers",
    "principal",
    "scope",
    "idempotency_key",
  ]);
  const unknown = Object.keys(input).find((key) => !allowed.has(key));
  if (unknown) throw contractError("unknown_field", "Tool input is closed.", `/input/${unknown}`);
  if (toolName !== "get_capability_catalog" && (typeof input.run_id !== "string" || !input.run_id)) {
    throw contractError("invalid_tool_input", "A run_id is required for this read-only tool.", "/input/run_id");
  }
  if (input.scope !== undefined && input.scope !== toolScopes[toolName]) {
    throw contractError(
      "tool_scope_denied",
      "Requested scope does not match the published tool scope.",
      "/input/scope",
    );
  }
  if (toolName === "query_verified_metrics") {
    if (input.artifact_id !== undefined && input.artifact_id !== "metrics") {
      throw contractError(
        "artifact_not_allowlisted",
        "Only the verified metrics artifact is allow-listed.",
        "/input/artifact_id",
      );
    }
    if (
      input.json_pointers !== undefined &&
      (!Array.isArray(input.json_pointers) ||
        input.json_pointers.length > 32 ||
        input.json_pointers.some((pointer) => typeof pointer !== "string" || !pointerPattern.test(pointer)))
    ) {
      throw contractError(
        "invalid_json_pointer",
        "json_pointers must be a bounded RFC 6901 list.",
        "/input/json_pointers",
      );
    }
  }
}

function invocationFromError(toolName: AgentHarnessToolName, error: unknown): AgentHarnessToolInvocation {
  const bridgeError = error instanceof BridgeApiError ? error : null;
  const details: AgentHarnessErrorDetails = {
    code: bridgeError?.code || "transport_failure",
    message: bridgeError?.message || "The read-only tool result could not be established.",
    field_path: bridgeError?.fieldPath || null,
    retryable: bridgeError?.retryable === true,
    terminal_failure: bridgeError?.terminalFailure !== false,
    unknown_outcome: bridgeError?.unknownOutcome === true,
  };
  return {
    operation: null,
    tool_result: null,
    outcome: details.unknown_outcome ? "unknown_outcome" : details.retryable ? "retryable_failure" : "rejected",
    tool_name: toolName,
    status: details.unknown_outcome ? "unknown_outcome" : details.retryable ? "failed" : "rejected",
    error: details,
    result: null,
  };
}

export async function callAgentHarnessReadOnlyTool(
  operationId: string,
  toolName: AgentHarnessToolName,
  input: Record<string, unknown> = {},
  expectedBackendIdentity: AgentHarnessBackendIdentity | null = null,
  verifiedManifest: AgentHarnessVerifiedArtifactManifest | null = null,
): Promise<AgentHarnessToolInvocation> {
  if (!toolNames.includes(toolName))
    return invocationFromError(toolName, contractError("unknown_tool", "Tool is not exposed.", "/tool_name"));
  try {
    validateToolInput(toolName, input);
    const body: AgentHarnessToolCallRequest = {
      operation_id: operationId,
      tool_name: toolName,
      input,
      scope: toolScopes[toolName],
    };
    const response = await client.callTool(body);
    const operation = assertOperation(response.payload.operation, response);
    assertBackendIdentity(operation.backend_identity, expectedBackendIdentity);
    if (input.run_id !== undefined && input.run_id !== operation.run_id) {
      throw contractError(
        "run_binding_mismatch",
        "Tool input run does not match the bound operation.",
        "/input/run_id",
      );
    }
    if (input.snapshot_digest !== undefined && input.snapshot_digest !== operation.snapshot_digest) {
      throw contractError(
        "snapshot_mismatch",
        "Tool input snapshot does not match the bound operation.",
        "/input/snapshot_digest",
      );
    }
    const result = assertToolResult(response.payload.tool_result, response);
    if (result.operation_id !== operation.operation_id || result.tool_name !== toolName) {
      throw contractError("operation_binding_mismatch", "Tool result does not belong to the requested operation.");
    }
    if (toolName === "list_run_evidence" && result.outcome === "succeeded") {
      validateAgentHarnessVerifiedArtifactManifest(result.result, String(input.run_id));
    }
    if (toolName === "get_capability_catalog" && result.outcome === "succeeded") {
      const catalog = result.result;
      if (
        !isRecord(catalog) ||
        catalog.schema_identity !== "tilesim.agent_harness.capability_snapshot.v1" ||
        catalog.contract_revision !== AGENT_HARNESS_CONTRACT_REVISION ||
        !isPublishedSchemaSetRevision(catalog.schema_set_revision) ||
        !Array.isArray(catalog.write_tools) ||
        catalog.write_tools.length !== 0 ||
        catalog.autonomous_optimization !== false
      ) {
        throw contractError(
          "invalid_tool_result",
          "Capability catalog tool result is not a closed read-only snapshot.",
          "/result",
        );
      }
    }
    if (toolName === "get_run_status" && result.outcome === "succeeded") {
      if (!isRecord(result.result) || result.result.run_id !== input.run_id) {
        throw contractError(
          "run_binding_mismatch",
          "Run status result is not bound to the requested run.",
          "/result/run_id",
        );
      }
    }
    if (toolName === "query_verified_metrics" && result.outcome === "succeeded") {
      if (verifiedManifest) {
        const metrics = verifiedManifest.artifacts.find((entry) => entry.artifact_id === "metrics");
        if (!metrics || metrics.contract_status !== "supported" || metrics.content_status === "expected_absence") {
          throw contractError(
            "artifact_not_allowlisted",
            "Verified metrics artifact is not available in the bound manifest.",
            "/artifacts/metrics",
          );
        }
      }
      validateAgentHarnessMetricsPointers(
        result.result,
        (input.json_pointers as string[] | undefined) || ["/system_summary", "/request_metrics"],
      );
    }
    return {
      operation,
      tool_result: result,
      outcome: result.outcome,
      tool_name: toolName,
      status:
        result.outcome === "succeeded"
          ? "available"
          : result.unknown_outcome
            ? "unknown_outcome"
            : result.outcome === "rejected"
              ? "rejected"
              : "failed",
      error: result.error_code
        ? {
            code: result.error_code,
            field_path: result.field_path,
            retryable: result.retryable,
            terminal_failure: result.terminal_failure,
            unknown_outcome: result.unknown_outcome,
          }
        : null,
      result: result.result ?? null,
    };
  } catch (error) {
    return invocationFromError(toolName, error);
  }
}

export interface AgentHarnessReadOnlyToolRequest {
  run_id?: string;
  snapshot_digest?: string;
  artifact_id?: "metrics";
  json_pointers?: string[];
  principal?: string;
  idempotency_key?: string;
  /** Previously validated manifest metadata; never serialized into tool input. */
  verified_manifest?: AgentHarnessVerifiedArtifactManifest;
}

/** Run exactly one published read-only tool through one durable read-only operation. */
export async function executeAgentHarnessReadOnlyTool(
  toolName: AgentHarnessToolName,
  request: AgentHarnessReadOnlyToolRequest = {},
): Promise<AgentHarnessToolInvocation> {
  if (!toolNames.includes(toolName))
    return invocationFromError(toolName, contractError("unknown_tool", "Tool is not exposed.", "/tool_name"));
  try {
    const { verified_manifest: verifiedManifest, ...toolInput } = request;
    validateToolInput(toolName, toolInput as Record<string, unknown>);
    const operation = await createAgentHarnessReadOnlyOperation({
      run_id: request.run_id,
      snapshot_digest: request.snapshot_digest,
      principal: request.principal,
      idempotency_key: request.idempotency_key,
    });
    const invocation = await callAgentHarnessReadOnlyTool(
      operation.operation_id,
      toolName,
      { ...toolInput, scope: toolScopes[toolName] },
      operation.backend_identity,
      verifiedManifest || null,
    );
    return { ...invocation, operation: invocation.operation || operation };
  } catch (error) {
    return invocationFromError(toolName, error);
  }
}

export const getCapabilityCatalog = (request?: AgentHarnessReadOnlyToolRequest) =>
  executeAgentHarnessReadOnlyTool("get_capability_catalog", request);
export const getRunStatus = (request: AgentHarnessReadOnlyToolRequest) =>
  executeAgentHarnessReadOnlyTool("get_run_status", request);
export const listRunEvidence = (request: AgentHarnessReadOnlyToolRequest) =>
  executeAgentHarnessReadOnlyTool("list_run_evidence", request);
export const queryVerifiedMetrics = (request: AgentHarnessReadOnlyToolRequest) =>
  executeAgentHarnessReadOnlyTool("query_verified_metrics", request);

export function projectAgentHarnessEvents(
  events: readonly AgentHarnessWorkflowEvent[],
  operation: AgentHarnessOperation | null = null,
  source: AgentHarnessOperationProjection["source"] = "initial",
  expectedBinding: AgentHarnessBinding | null = null,
): AgentHarnessOperationProjection {
  const accepted: AgentHarnessWorkflowEvent[] = [];
  const byId = new Map<string, AgentHarnessWorkflowEvent>();
  const duplicate_event_ids: string[] = [];
  const rejected_event_ids: string[] = [];
  const late_event_ids: string[] = [];
  let state: AgentHarnessWorkflowState | null = events.length ? null : operation?.workflow_state || null;
  let requiresRecovery = false;
  const error: AgentHarnessErrorDetails | null = operation?.last_error || null;
  let lastSequence = 0;
  for (const event of events) {
    if (
      operation &&
      (event.operation_id !== operation.operation_id ||
        event.turn_id !== operation.turn_id ||
        event.run_id !== operation.run_id ||
        event.snapshot_digest !== operation.snapshot_digest ||
        event.schema_set_revision !== operation.schema_set_revision ||
        identityKey(event.backend_identity) !== identityKey(operation.backend_identity))
    ) {
      rejected_event_ids.push(event.event_id);
      requiresRecovery = true;
      continue;
    }
    const prior = byId.get(event.event_id);
    if (prior) {
      if (prior.payload_digest === event.payload_digest && prior.sequence === event.sequence)
        duplicate_event_ids.push(event.event_id);
      else {
        rejected_event_ids.push(event.event_id);
        requiresRecovery = true;
      }
      continue;
    }
    if (event.sequence <= lastSequence) {
      rejected_event_ids.push(event.event_id);
      requiresRecovery = true;
      continue;
    }
    if (event.sequence !== lastSequence + 1) {
      rejected_event_ids.push(event.event_id);
      requiresRecovery = true;
      continue;
    }
    if (state && terminalStates.has(state)) {
      late_event_ids.push(event.event_id);
      continue;
    }
    byId.set(event.event_id, event);
    accepted.push(event);
    lastSequence = event.sequence;
    state = event.workflow_state;
    if (event.terminal || terminalStates.has(state)) state = event.workflow_state;
  }
  if (requiresRecovery) state = "recovery_required";
  let stale_reason: AgentHarnessBindingMismatch | null = null;
  if (operation && expectedBinding) {
    if (operation.schema_set_revision !== expectedBinding.schema_set_revision)
      stale_reason = "schema_set_revision_changed";
    else if (identityKey(operation.backend_identity) !== identityKey(expectedBinding.backend_identity))
      stale_reason = "backend_identity_changed";
    else if (operation.run_id !== expectedBinding.run_id) stale_reason = "run_changed";
    else if (operation.snapshot_digest !== expectedBinding.snapshot_digest) stale_reason = "snapshot_changed";
  }
  if (stale_reason) state = "recovery_required";
  return {
    operation,
    events: accepted,
    state,
    terminal: Boolean(state && terminalStates.has(state)),
    source,
    last_event_sequence: lastSequence,
    duplicate_event_ids,
    rejected_event_ids,
    late_event_ids,
    stale_reason,
    requires_recovery: requiresRecovery || Boolean(stale_reason),
    error,
  };
}

function mergeOperationProjection(
  operation: AgentHarnessOperation,
  events: readonly AgentHarnessWorkflowEvent[],
  source: AgentHarnessOperationProjection["source"],
  expectedBinding: AgentHarnessBinding | null,
): AgentHarnessOperationProjection {
  return projectAgentHarnessEvents(events, operation, source, expectedBinding);
}

export async function getAgentHarnessOperation(
  operationId: string,
  expectedBinding: AgentHarnessBinding | null = null,
): Promise<AgentHarnessOperationProjection> {
  const response = await client.operation(operationId);
  const operationResponse = assertOperationResponse(response.payload, response);
  if (operationResponse.operation.operation_id !== operationId) {
    throw contractError(
      "operation_binding_mismatch",
      "Operation detail does not belong to the requested operation.",
      "/operation_id",
    );
  }
  return mergeOperationProjection(
    operationResponse.operation,
    operationResponse.events || [],
    "initial",
    expectedBinding,
  );
}

export async function getAgentHarnessOperations(): Promise<AgentHarnessOperation[]> {
  const response = await client.listOperations();
  return assertOperationList(response.payload, response).operations;
}

export async function getAgentHarnessOperationSnapshots(
  runId: string | null = null,
): Promise<AgentHarnessOperationSnapshot[]> {
  const operations = (await getAgentHarnessOperations()).filter((operation) => operation.run_id === runId);
  return Promise.all(
    operations.map(async (operation) => {
      const expectedBinding: AgentHarnessBinding = {
        backend_identity: operation.backend_identity,
        schema_set_revision: operation.schema_set_revision,
        run_id: operation.run_id,
        snapshot_digest: operation.snapshot_digest,
      };
      try {
        return {
          operation,
          projection: await getAgentHarnessOperation(operation.operation_id, expectedBinding),
          error: null,
        } satisfies AgentHarnessOperationSnapshot;
      } catch (error) {
        const bridgeError = error instanceof BridgeApiError ? error : null;
        return {
          operation,
          projection: null,
          error:
            bridgeError ||
            contractError("operation_snapshot_unavailable", "The operation snapshot could not be established."),
        } satisfies AgentHarnessOperationSnapshot;
      }
    }),
  );
}

async function getAgentHarnessEvents(
  operationId: string,
  lastEventSequence: number,
): Promise<{ response: AgentHarnessEventsResponse; metadata: { schemaSetRevision: string; apiVersion: string } }> {
  const response = await client.events(operationId, String(lastEventSequence));
  assertMetadata(response.schemaSetRevision, response.apiVersion);
  if (response.payload.operation) assertOperation(response.payload.operation, response);
  response.payload.events = response.payload.events.map((event) => assertEvent(event, response));
  return { response: response.payload, metadata: response };
}

export interface ObserveAgentHarnessOptions {
  expectedBinding?: AgentHarnessBinding | null;
  lastEventSequence?: number;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  preferSse?: boolean;
  onProjection?: (projection: AgentHarnessOperationProjection) => void;
}

function wait(interval: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, interval);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason || new DOMException("Agent Harness observation cancelled.", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function observeAgentHarnessOperation(
  operationId: string,
  options: ObserveAgentHarnessOptions = {},
): Promise<AgentHarnessOperationProjection> {
  const expectedBinding = options.expectedBinding || null;
  let projection = await getAgentHarnessOperation(operationId, expectedBinding);
  options.onProjection?.(projection);
  if (projection.terminal || projection.requires_recovery) return projection;
  let lastSequence = options.lastEventSequence ?? projection.last_event_sequence;
  if (options.preferSse !== false) {
    try {
      const response = await fetch(`${apiRoots()[0]}${agentHarnessPaths.eventStream(operationId)}`, {
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          ...(lastSequence > 0 ? { "Last-Event-ID": String(lastSequence) } : {}),
        },
        signal: options.signal,
      });
      if (!response.ok) await parseResponse<never>(response);
      const apiVersion = response.headers.get("x-tilesim-api-version") || "";
      const schemaSetRevision = response.headers.get("x-tilesim-schema-set-revision") || "";
      assertMetadata(schemaSetRevision, apiVersion);
      if (!response.body) throw contractError("sse_unavailable", "Agent Harness event stream has no body.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamed: AgentHarnessWorkflowEvent[] = [...projection.events];
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        buffer = buffer.replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = parseSseFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (frame?.event === "workflow" && frame.data) {
            const event = assertEvent(parseJsonLossless(frame.data), { schemaSetRevision, apiVersion });
            streamed.push(event);
            lastSequence = Math.max(lastSequence, event.sequence);
            if (!projection.operation)
              throw contractError("invalid_agent_harness_payload", "SSE returned no operation identity.");
            projection = mergeOperationProjection(projection.operation, streamed, "sse", expectedBinding);
            options.onProjection?.(projection);
          }
          if (frame?.event === "terminal") {
            if (!projection.operation)
              throw contractError("invalid_agent_harness_payload", "SSE returned no operation identity.");
            projection = mergeOperationProjection(projection.operation, streamed, "sse", expectedBinding);
            options.onProjection?.(projection);
            return projection;
          }
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
        if (projection.terminal || projection.requires_recovery) return projection;
      }
      if (projection.terminal || projection.requires_recovery) return projection;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // The stream is advisory. Durable polling below is the recovery path.
    }
  }
  const maxAttempts = options.maxPollAttempts ?? 20;
  const interval = options.pollIntervalMs ?? 500;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    options.signal?.throwIfAborted();
    if (attempt > 0) await wait(interval, options.signal);
    const { response } = await getAgentHarnessEvents(operationId, lastSequence);
    const operation = response.operation || projection.operation;
    if (!operation) throw contractError("invalid_agent_harness_payload", "Polling returned no operation identity.");
    projection = mergeOperationProjection(
      operation,
      [...projection.events, ...response.events],
      "polling",
      expectedBinding,
    );
    lastSequence = projection.last_event_sequence;
    options.onProjection?.(projection);
    if (projection.terminal || projection.requires_recovery) return projection;
  }
  return projection;
}

/**
 * WP-B is deliberately a separate adapter from the WP-A operation/tool
 * adapter above. Drafts and approvals are durable Bridge records, but they
 * are still run-free: every response is required to carry
 * `would_create_run: false` before it can enter the UI.
 */
export interface AgentHarnessDraftBinding {
  principal?: string | null;
  workspace_id?: string | null;
  input_snapshot_digest?: string | null;
  schema_set_revision?: string | null;
  backend_identity?: AgentHarnessBackendIdentity | null;
  policy_revision?: string | null;
  draft_digest?: string | null;
  validation_id?: string | null;
}

export interface AgentHarnessDraftEventsProjection {
  draft_id: string;
  events: Array<Record<string, unknown>>;
  after_sequence: number;
  terminal: boolean;
}

function validateDraftEvents(
  events: unknown[],
  draftId: string,
  lastEventSequence = 0,
  expected: AgentHarnessDraftBinding | null = null,
): Array<Record<string, unknown>> {
  let previous = lastEventSequence;
  return events.map((event) => {
    if (!isRecord(event)) {
      throw contractError("invalid_workflow_event", "Draft event must be an object.", "/events");
    }
    if (
      event.schema_identity !== "tilesim.agent_harness.workflow_event.v1" ||
      event.contract_revision !== AGENT_HARNESS_CONTRACT_REVISION ||
      event.schema_set_revision !== AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION ||
      event.draft_id !== draftId ||
      typeof event.event_id !== "string" ||
      typeof event.sequence !== "number" ||
      !Number.isInteger(event.sequence) ||
      event.sequence <= previous
    ) {
      throw contractError("invalid_workflow_event", "Draft event identity or sequence is invalid.", "/events");
    }
    previous = event.sequence;
    assertSuccessorBinding(event, expected);
    return event;
  });
}

const successorDraftStatuses = new Set<AgentHarnessDraftStatus>([
  "draft",
  "validated",
  "invalid",
  "unsupported",
  "unavailable",
  "stale",
  "expired",
  "deleted",
]);
const successorValidationStatuses = new Set<AgentHarnessValidationStatus>([
  "valid",
  "invalid",
  "unsupported",
  "unavailable",
  "stale",
  "expired",
  "rejected",
]);
const successorApprovalStatuses = new Set<AgentHarnessApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "expired",
  "revoked",
  "stale",
]);
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const draftCreateFields = new Set([
  "draft_id",
  "operation_id",
  "conversation_id",
  "turn_id",
  "principal",
  "workspace_id",
  "run_scope",
  "input_snapshot_digest",
  "schema_set_revision",
  "backend_identity",
  "parameter_catalog_revision",
  "validator_revision",
  "policy_revision",
  "field_diffs",
  "assumptions",
  "evidence_refs",
  "budget_request",
  "risk_flags",
  "expires_at",
  "create_run_request",
  "request",
  "idempotency_key",
]);
const draftValidationFields = new Set([
  "create_run_request",
  "request",
  "input_snapshot_digest",
  "validated_create_run_request_digest",
  "idempotency_key",
]);
const approvalCreateFields = new Set([
  "approval_id",
  "validation_id",
  "expires_at",
  "reason",
  "single_use",
  "approval_digest",
  "idempotency_key",
]);

function assertSuccessorMetadata(schemaSetRevision: string, apiVersion: string): void {
  if (apiVersion !== AGENT_HARNESS_API_VERSION) {
    throw contractError("unsupported_api_contract", "Agent Harness API version is not published.");
  }
  if (schemaSetRevision !== AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION) {
    throw contractError(
      "schema_revision_mismatch",
      "Agent Harness successor schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
}

function assertSuccessorRecord(value: unknown, identity: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw contractError("invalid_agent_harness_payload", "Agent Harness successor response must be an object.");
  }
  if (value.schema_identity !== identity) {
    throw contractError(
      "schema_identity_mismatch",
      "Agent Harness successor schema identity is not published.",
      "/schema_identity",
    );
  }
  if (value.contract_revision !== AGENT_HARNESS_SUCCESSOR_CONTRACT_REVISION) {
    throw contractError(
      "contract_revision_mismatch",
      "Agent Harness successor contract revision is stale.",
      "/contract_revision",
    );
  }
  if (value.schema_set_revision !== AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION) {
    throw contractError(
      "schema_revision_mismatch",
      "Agent Harness successor record schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
  if (
    typeof value.backend_identity !== "object" ||
    value.backend_identity === null ||
    Array.isArray(value.backend_identity)
  ) {
    throw contractError("invalid_backend_identity", "Backend identity is required.", "/backend_identity");
  }
  if (Object.keys(value.backend_identity).length === 0) {
    throw contractError("invalid_backend_identity", "Backend identity is required.", "/backend_identity");
  }
  if (value.policy_revision !== "tilesim.agent_harness.policy.v1") {
    throw contractError("policy_revision_mismatch", "Agent Harness policy revision is stale.", "/policy_revision");
  }
}

function assertSuccessorBinding(value: Record<string, unknown>, expected: AgentHarnessDraftBinding | null): void {
  if (!expected) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue === undefined || expectedValue === null) continue;
    const actual = value[key];
    const matches =
      key === "backend_identity" ? identityKey(actual) === identityKey(expectedValue) : actual === expectedValue;
    if (!matches) {
      const pointer = `/${key}`;
      throw contractError(
        key === "schema_set_revision"
          ? "schema_revision_mismatch"
          : key === "backend_identity"
            ? "backend_identity_mismatch"
            : key === "input_snapshot_digest"
              ? "snapshot_mismatch"
              : "draft_binding_mismatch",
        "Agent Harness successor record is bound to a different draft context.",
        pointer,
      );
    }
  }
}

function assertRunFreeResponse(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value) || value.would_create_run !== false) {
    throw contractError(
      "unsafe_run_capability",
      "Agent Harness draft response must not create a run.",
      "/would_create_run",
    );
  }
}

function closedRequest<T extends Record<string, unknown>>(value: T, allowed: Set<string>): T {
  if (!isRecord(value)) throw contractError("invalid_argument", "Agent Harness request must be an object.");
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown)
    throw contractError("unknown_field", "Agent Harness request contains an unsupported field.", `/${unknown}`);
  return value;
}

function idempotencyKey(prefix: string, supplied?: string): string {
  const key = supplied || `web-${prefix}:${crypto.randomUUID()}`;
  if (!/^[A-Za-z0-9._:-]{1,256}$/u.test(key)) {
    throw contractError("invalid_argument", "Idempotency key is not a bounded identifier.", "/headers/Idempotency-Key");
  }
  return key;
}

function assertDraftResponse(
  response: AgentHarnessDraftResponse,
  metadata: { schemaSetRevision: string; apiVersion: string },
  expectedDraftId: string | null = null,
  expected: AgentHarnessDraftBinding | null = null,
): AgentHarnessExperimentDraftV2 {
  assertSuccessorMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  assertRunFreeResponse(response);
  if (!isRecord(response.draft))
    throw contractError("invalid_agent_harness_payload", "Draft response is missing draft.", "/draft");
  assertSuccessorRecord(response.draft, "tilesim.agent_harness.experiment_draft.v2");
  if (expectedDraftId && response.draft.draft_id !== expectedDraftId) {
    throw contractError(
      "draft_binding_mismatch",
      "Draft response does not belong to the requested draft.",
      "/draft/draft_id",
    );
  }
  if (
    typeof response.draft.draft_id !== "string" ||
    typeof response.draft.operation_id !== "string" ||
    typeof response.draft.principal !== "string" ||
    typeof response.draft.workspace_id !== "string"
  ) {
    throw contractError("invalid_agent_harness_identity", "Draft identity is incomplete.", "/draft/draft_id");
  }
  if (response.draft.policy_revision !== "tilesim.agent_harness.policy.v1") {
    throw contractError("policy_revision_mismatch", "Draft policy revision is stale.", "/draft/policy_revision");
  }
  if (
    !digestPattern.test(String(response.draft.draft_digest)) ||
    !digestPattern.test(String(response.draft.input_snapshot_digest))
  ) {
    throw contractError("invalid_digest", "Draft digest or input snapshot digest is invalid.", "/draft/draft_digest");
  }
  if (!successorDraftStatuses.has(response.draft.status)) {
    throw contractError("invalid_status", "Draft status is not published.", "/draft/status");
  }
  if (response.draft.would_create_run !== false) {
    throw contractError("unsafe_run_capability", "Draft must remain run-free.", "/draft/would_create_run");
  }
  assertSuccessorBinding(response.draft, expected);
  if (response.validation !== undefined && response.validation !== null) {
    assertValidationRecord(response.validation, response.draft.draft_id, response.draft.draft_digest, expected);
  }
  return response.draft;
}

function assertValidationRecord(
  value: unknown,
  expectedDraftId: string,
  expectedDraftDigest: string,
  expected: AgentHarnessDraftBinding | null = null,
): AgentHarnessDraftValidationReportV1 {
  assertSuccessorRecord(value, "tilesim.agent_harness.draft_validation_report.v1");
  if (value.draft_id !== expectedDraftId || value.draft_digest !== expectedDraftDigest) {
    throw contractError(
      "draft_binding_mismatch",
      "Validation report is not bound to the requested draft.",
      "/draft_digest",
    );
  }
  if (
    typeof value.principal !== "string" ||
    typeof value.workspace_id !== "string" ||
    typeof value.validation_id !== "string"
  ) {
    throw contractError("invalid_agent_harness_identity", "Validation identity is incomplete.", "/validation_id");
  }
  if (
    !digestPattern.test(String(value.input_snapshot_digest)) ||
    !digestPattern.test(String(value.validated_create_run_request_digest))
  ) {
    throw contractError(
      "invalid_digest",
      "Validation report digest is invalid.",
      "/validated_create_run_request_digest",
    );
  }
  if (!successorValidationStatuses.has(value.status as AgentHarnessValidationStatus)) {
    throw contractError("invalid_status", "Validation status is not published.", "/status");
  }
  if (value.would_create_run !== false) {
    throw contractError("unsafe_run_capability", "Validation must remain run-free.", "/would_create_run");
  }
  assertSuccessorBinding(value, expected);
  return value as unknown as AgentHarnessDraftValidationReportV1;
}

function assertApprovalRecord(
  value: unknown,
  expectedDraftId: string,
  expected: AgentHarnessDraftBinding | null = null,
): AgentHarnessApprovalV2 {
  assertSuccessorRecord(value, "tilesim.agent_harness.approval.v2");
  if (value.draft_id !== expectedDraftId) {
    throw contractError("draft_binding_mismatch", "Approval is not bound to the requested draft.", "/draft_id");
  }
  if (
    typeof value.principal !== "string" ||
    typeof value.workspace_id !== "string" ||
    typeof value.policy_revision !== "string"
  ) {
    throw contractError("invalid_agent_harness_identity", "Approval identity is incomplete.", "/approval_id");
  }
  if (
    typeof value.approval_id !== "string" ||
    typeof value.validation_id !== "string" ||
    typeof value.approval_digest !== "string" ||
    !digestPattern.test(value.draft_digest as string) ||
    !digestPattern.test(value.approval_digest as string)
  ) {
    throw contractError("invalid_digest", "Approval identity or digest is invalid.", "/approval_digest");
  }
  if (!successorApprovalStatuses.has(value.status as AgentHarnessApprovalStatus)) {
    throw contractError("invalid_status", "Approval status is not published.", "/status");
  }
  if (typeof value.single_use !== "boolean" || typeof value.consumed !== "boolean") {
    throw contractError("invalid_approval", "Approval replay flags are invalid.", "/consumed");
  }
  assertSuccessorBinding(value, expected);
  return value as unknown as AgentHarnessApprovalV2;
}

export async function createAgentHarnessDraft(
  request: AgentHarnessDraftCreateRequest,
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null } = {},
): Promise<AgentHarnessExperimentDraftV2> {
  const body = closedRequest({ ...request }, draftCreateFields);
  const key = idempotencyKey("draft", options.idempotencyKey);
  if (body.idempotency_key !== undefined && body.idempotency_key !== key) {
    throw contractError(
      "idempotency_key_mismatch",
      "Body idempotency key must match the request header.",
      "/idempotency_key",
    );
  }
  body.idempotency_key = key;
  const response = await client.createDraft(body, key);
  return assertDraftResponse(response.payload, response, null, options.expectedBinding || null);
}

export async function getAgentHarnessDraft(
  draftId: string,
  expectedBinding: AgentHarnessDraftBinding | null = null,
): Promise<AgentHarnessDraftResponse> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  const response = await client.draft(draftId);
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  assertDraftResponse(response.payload, response, draftId, expectedBinding);
  return response.payload;
}

export async function validateAgentHarnessDraft(
  draftId: string,
  request: AgentHarnessDraftValidationRequest = {},
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null } = {},
): Promise<AgentHarnessDraftValidationReportV1> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  const body = closedRequest({ ...request }, draftValidationFields);
  const key = idempotencyKey("validate", options.idempotencyKey);
  if (body.idempotency_key !== undefined && body.idempotency_key !== key) {
    throw contractError(
      "idempotency_key_mismatch",
      "Body idempotency key must match the request header.",
      "/idempotency_key",
    );
  }
  body.idempotency_key = key;
  const draftResponse = await client.draft(draftId);
  assertSuccessorMetadata(draftResponse.schemaSetRevision, draftResponse.apiVersion);
  const draft = assertDraftResponse(draftResponse.payload, draftResponse, draftId, options.expectedBinding || null);
  const response = await client.validateDraft(draftId, body, key);
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  if (!isRecord(response.payload.validation))
    throw contractError("invalid_agent_harness_payload", "Validation response is missing a report.", "/validation");
  return assertValidationRecord(
    response.payload.validation,
    draft.draft_id,
    draft.draft_digest,
    options.expectedBinding || null,
  );
}

export async function getAgentHarnessDraftEvents(
  draftId: string,
  lastEventSequence = 0,
  expectedBinding: AgentHarnessDraftBinding | null = null,
): Promise<AgentHarnessDraftEventsProjection> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  if (!Number.isInteger(lastEventSequence) || lastEventSequence < 0) {
    throw contractError(
      "invalid_argument",
      "Last event sequence must be a non-negative integer.",
      "/headers/Last-Event-ID",
    );
  }
  const response = await client.draftEvents(draftId, String(lastEventSequence));
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  const payload = response.payload;
  if (
    !isRecord(payload) ||
    payload.draft_id !== draftId ||
    !Array.isArray(payload.events) ||
    typeof payload.terminal !== "boolean"
  ) {
    throw contractError(
      "invalid_agent_harness_payload",
      "Draft event response is not bound to the requested draft.",
      "/draft_id",
    );
  }
  const events = validateDraftEvents(payload.events, draftId, lastEventSequence, expectedBinding);
  return {
    draft_id: draftId,
    events,
    after_sequence: typeof payload.after_sequence === "number" ? payload.after_sequence : lastEventSequence,
    terminal: payload.terminal,
  };
}

export async function streamAgentHarnessDraftEvents(
  draftId: string,
  options: {
    lastEventSequence?: number;
    signal?: AbortSignal;
    onEvent?: (event: Record<string, unknown>) => void;
    expectedBinding?: AgentHarnessDraftBinding | null;
  } = {},
): Promise<AgentHarnessDraftEventsProjection> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  const lastEventSequence = options.lastEventSequence ?? 0;
  const response = await fetch(`${apiRoots()[0]}${client.draftEventStream(draftId)}`, {
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      ...(lastEventSequence > 0 ? { "Last-Event-ID": String(lastEventSequence) } : {}),
    },
    signal: options.signal,
  });
  if (!response.ok) await parseResponse<never>(response);
  assertSuccessorMetadata(
    response.headers.get("x-tilesim-schema-set-revision") || "",
    response.headers.get("x-tilesim-api-version") || "",
  );
  if (!response.body) throw contractError("sse_unavailable", "Draft event stream has no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<Record<string, unknown>> = [];
  let terminal = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = parseSseFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (frame?.event === "workflow" && frame.data) {
        const [event] = validateDraftEvents(
          [parseJsonLossless(frame.data)],
          draftId,
          (events.at(-1)?.sequence as number) || lastEventSequence,
          options.expectedBinding || null,
        );
        events.push(event);
        options.onEvent?.(event);
      } else if (frame?.event === "terminal") {
        terminal = true;
      }
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  return {
    draft_id: draftId,
    events,
    after_sequence: (events.at(-1)?.sequence as number) || lastEventSequence,
    terminal,
  };
}

export async function deleteAgentHarnessDraft(
  draftId: string,
  idempotencyKeyValue?: string,
): Promise<AgentHarnessDraftDeleteResponse> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  const response = await client.deleteDraft(draftId, idempotencyKey("delete-draft", idempotencyKeyValue));
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  const payload = response.payload;
  if (!isRecord(payload) || payload.draft_id !== draftId || payload.deleted !== true) {
    throw contractError("invalid_agent_harness_payload", "Draft deletion response is invalid.", "/deleted");
  }
  return payload as AgentHarnessDraftDeleteResponse;
}

export async function createAgentHarnessDraftApproval(
  draftId: string,
  request: AgentHarnessApprovalCreateRequest,
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null } = {},
): Promise<AgentHarnessApprovalV2> {
  if (!draftId) throw contractError("invalid_argument", "Draft id is required.", "/draft_id");
  const body = closedRequest({ ...request }, approvalCreateFields);
  const key = idempotencyKey("approval", options.idempotencyKey);
  if (body.idempotency_key !== undefined && body.idempotency_key !== key) {
    throw contractError(
      "idempotency_key_mismatch",
      "Body idempotency key must match the request header.",
      "/idempotency_key",
    );
  }
  body.idempotency_key = key;
  const draftResponse = await client.draft(draftId);
  assertSuccessorMetadata(draftResponse.schemaSetRevision, draftResponse.apiVersion);
  const draft = assertDraftResponse(draftResponse.payload, draftResponse, draftId, options.expectedBinding || null);
  const response = await client.createDraftApproval(draftId, body, key);
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  return assertApprovalRecord(response.payload.approval, draft.draft_id, {
    ...(options.expectedBinding || {}),
    draft_digest: draft.draft_digest,
  });
}

export async function getAgentHarnessDraftApproval(
  draftId: string,
  approvalId: string,
  expectedBinding: AgentHarnessDraftBinding | null = null,
): Promise<AgentHarnessApprovalV2> {
  if (!draftId || !approvalId)
    throw contractError("invalid_argument", "Draft and approval ids are required.", "/approval_id");
  const response = await client.draftApproval(draftId, approvalId);
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  const approval = assertApprovalRecord(response.payload.approval, draftId, expectedBinding);
  if (approval.approval_id !== approvalId)
    throw contractError(
      "approval_binding_mismatch",
      "Approval does not belong to the requested approval id.",
      "/approval_id",
    );
  return approval;
}

async function mutateAgentHarnessDraftApproval(
  action: "reject" | "revoke",
  draftId: string,
  approvalId: string,
  reason: string,
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null } = {},
): Promise<AgentHarnessApprovalV2> {
  if (!draftId || !approvalId)
    throw contractError("invalid_argument", "Draft and approval ids are required.", "/approval_id");
  if (typeof reason !== "string" || reason.length > 512)
    throw contractError("invalid_argument", "Approval reason is bounded.", "/reason");
  const key = idempotencyKey(`${action}-approval`, options.idempotencyKey);
  const response =
    action === "reject"
      ? await client.rejectDraftApproval(draftId, approvalId, reason, key)
      : await client.revokeDraftApproval(draftId, approvalId, reason, key);
  assertSuccessorMetadata(response.schemaSetRevision, response.apiVersion);
  assertRunFreeResponse(response.payload);
  const approval = assertApprovalRecord(response.payload.approval, draftId, options.expectedBinding);
  if (approval.approval_id !== approvalId)
    throw contractError(
      "approval_binding_mismatch",
      "Approval does not belong to the requested approval id.",
      "/approval_id",
    );
  if (action === "reject" && approval.status !== "rejected")
    throw contractError("invalid_status", "Reject did not produce a rejected approval.", "/status");
  if (action === "revoke" && approval.status !== "revoked")
    throw contractError("invalid_status", "Revoke did not produce a revoked approval.", "/status");
  return approval;
}

export const rejectAgentHarnessDraftApproval = (
  draftId: string,
  approvalId: string,
  reason: string,
  options?: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null },
) => mutateAgentHarnessDraftApproval("reject", draftId, approvalId, reason, options);

export const revokeAgentHarnessDraftApproval = (
  draftId: string,
  approvalId: string,
  reason: string,
  options?: { idempotencyKey?: string; expectedBinding?: AgentHarnessDraftBinding | null },
) => mutateAgentHarnessDraftApproval("revoke", draftId, approvalId, reason, options);

/**
 * Stage 3B is deliberately a thin, fail-closed successor adapter.  The
 * Bridge remains the only owner of queue/run/checkpoint state; the browser
 * only submits an already validated and approved request and observes the
 * durable operation it returns.
 */
export interface AgentHarnessExecutionBinding {
  principal?: string | null;
  workspace_id?: string | null;
  draft_id?: string | null;
  approval_id?: string | null;
  validation_id?: string | null;
  draft_digest?: string | null;
  approval_digest?: string | null;
  input_snapshot_digest?: string | null;
  schema_set_revision?: string | null;
  backend_identity?: AgentHarnessBackendIdentity | null;
  policy_revision?: string | null;
  workflow_revision?: string | null;
}

export interface AgentHarnessExecutionResponse {
  execution: AgentHarnessExecutionOperation;
  operation: AgentHarnessOperation;
  idempotent_replay?: boolean;
  action?: string;
}

export interface AgentHarnessExecutionProjection {
  execution: AgentHarnessExecutionOperation;
  operation: AgentHarnessOperation;
  events: AgentHarnessExecutionEvent[];
  state: AgentHarnessExecutionOperation["state"];
  terminal: boolean;
  source: "initial" | "sse" | "polling";
  last_event_sequence: number;
  duplicate_event_ids: string[];
  rejected_event_ids: string[];
  late_event_ids: string[];
  stale_reason: string | null;
  requires_recovery: boolean;
  error: AgentHarnessErrorDetails | null;
}

const executionStates = new Set<AgentHarnessExecutionOperation["state"]>([
  "submitted",
  "queued",
  "preparing",
  "running",
  "waiting_artifacts",
  "completed",
  "failed",
  "cancel_requested",
  "cancelled",
  "retrying",
  "recovery_required",
  "manual_intervention_required",
]);
const executionTerminalStates = new Set<AgentHarnessExecutionOperation["state"]>(["completed", "failed", "cancelled"]);
const executionRequestFields = new Set([
  "schema_identity",
  "contract_revision",
  "draft_id",
  "approval_id",
  "validation_id",
  "draft_digest",
  "approval_digest",
  "input_snapshot_digest",
  "schema_set_revision",
  "backend_identity",
  "policy_revision",
  "workflow_revision",
  "create_run_request",
  "create_run_request_digest",
  "principal",
  "workspace_id",
  "idempotency_key",
]);
function assertExecutionMetadata(schemaSetRevision: string, apiVersion: string): void {
  if (apiVersion !== AGENT_HARNESS_API_VERSION) {
    throw contractError("unsupported_api_contract", "Agent Harness execution API version is not published.");
  }
  if (schemaSetRevision !== AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION) {
    throw contractError(
      "schema_revision_mismatch",
      "Agent Harness execution schema-set revision is stale.",
      "/schema_set_revision",
    );
  }
}

function assertExecutionDigest(value: unknown, fieldPath: string, allowNull = false): void {
  if (allowNull && value === null) return;
  if (typeof value !== "string" || !digestPattern.test(value)) {
    throw contractError("invalid_digest", "Agent Harness execution digest is invalid.", fieldPath);
  }
}

function assertExecutionOperation(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessExecutionOperation {
  assertExecutionMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.execution_operation.v1") {
    throw contractError(
      "schema_identity_mismatch",
      "Execution operation schema identity is not published.",
      "/execution/schema_identity",
    );
  }
  if (value.contract_revision !== AGENT_HARNESS_EXECUTION_CONTRACT_REVISION) {
    throw contractError(
      "contract_revision_mismatch",
      "Execution operation contract revision is stale.",
      "/execution/contract_revision",
    );
  }
  for (const field of [
    "execution_id",
    "operation_id",
    "draft_id",
    "approval_id",
    "validation_id",
    "principal",
    "workspace_id",
    "policy_revision",
    "workflow_revision",
    "idempotency_key",
    "request_digest",
    "created_at",
    "updated_at",
  ]) {
    if (typeof value[field] !== "string" || !value[field]) {
      throw contractError(
        "invalid_execution_identity",
        "Execution operation identity is incomplete.",
        `/execution/${field}`,
      );
    }
  }
  if (!executionStates.has(value.state as AgentHarnessExecutionOperation["state"])) {
    throw contractError("invalid_workflow_state", "Execution workflow state is not published.", "/execution/state");
  }
  if (typeof value.backend_identity !== "object" || !value.backend_identity || Array.isArray(value.backend_identity)) {
    throw contractError(
      "invalid_backend_identity",
      "Execution backend identity is required.",
      "/execution/backend_identity",
    );
  }
  if (value.run_id !== null && typeof value.run_id !== "string") {
    throw contractError(
      "invalid_execution_identity",
      "Execution run identity must be a string or null.",
      "/execution/run_id",
    );
  }
  for (const [field, allowNull] of [
    ["draft_digest", false],
    ["approval_digest", false],
    ["input_snapshot_digest", false],
    ["schema_set_revision", false],
  ] as const) {
    assertExecutionDigest(value[field], `/execution/${field}`, allowNull);
  }
  if (value.schema_set_revision !== AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION) {
    throw contractError(
      "schema_revision_mismatch",
      "Execution operation schema-set revision is stale.",
      "/execution/schema_set_revision",
    );
  }
  for (const field of ["retryable", "unknown_outcome"] as const) {
    if (typeof value[field] !== "boolean")
      throw contractError("invalid_execution_state", "Execution failure flags are invalid.", `/execution/${field}`);
  }
  return value as unknown as AgentHarnessExecutionOperation;
}

function assertExecutionEvent(
  value: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
): AgentHarnessExecutionEvent {
  assertExecutionMetadata(metadata.schemaSetRevision, metadata.apiVersion);
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.execution_event.v1") {
    throw contractError(
      "schema_identity_mismatch",
      "Execution event schema identity is not published.",
      "/events/schema_identity",
    );
  }
  if (value.contract_revision !== AGENT_HARNESS_EXECUTION_CONTRACT_REVISION) {
    throw contractError(
      "contract_revision_mismatch",
      "Execution event contract revision is stale.",
      "/events/contract_revision",
    );
  }
  if (
    typeof value.event_id !== "string" ||
    typeof value.sequence !== "number" ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1
  ) {
    throw contractError(
      "invalid_event_sequence",
      "Execution event identity or sequence is invalid.",
      "/events/sequence",
    );
  }
  if (
    typeof value.operation_id !== "string" ||
    typeof value.execution_id !== "string" ||
    typeof value.node !== "string" ||
    typeof value.state !== "string"
  ) {
    throw contractError("invalid_execution_event", "Execution event identity is incomplete.", "/events");
  }
  assertExecutionDigest(value.payload_digest, "/events/payload_digest");
  if (typeof value.terminal !== "boolean" || typeof value.retryable !== "boolean") {
    throw contractError("invalid_execution_event", "Execution event flags are invalid.", "/events/terminal");
  }
  return value as unknown as AgentHarnessExecutionEvent;
}

function assertExecutionBinding(value: Record<string, unknown>, expected: AgentHarnessExecutionBinding | null): void {
  if (!expected) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue === undefined || expectedValue === null) continue;
    const actual = value[key];
    const matches =
      key === "backend_identity" ? identityKey(actual) === identityKey(expectedValue) : actual === expectedValue;
    if (!matches) {
      const code =
        key === "schema_set_revision"
          ? "schema_revision_mismatch"
          : key === "backend_identity"
            ? "backend_identity_mismatch"
            : key === "input_snapshot_digest"
              ? "snapshot_mismatch"
              : "execution_binding_mismatch";
      throw contractError(code, "Execution response belongs to a different approved context.", `/${key}`);
    }
  }
}

function assertExecutionResponse(
  payload: unknown,
  metadata: { schemaSetRevision: string; apiVersion: string },
  expected: AgentHarnessExecutionBinding | null = null,
): AgentHarnessExecutionResponse {
  if (!isRecord(payload) || !payload.execution || !payload.operation) {
    throw contractError("invalid_agent_harness_payload", "Execution response is incomplete.", "/execution");
  }
  const execution = assertExecutionOperation(payload.execution, metadata);
  const operation = assertOperation(payload.operation, {
    schemaSetRevision: metadata.schemaSetRevision,
    apiVersion: AGENT_HARNESS_API_VERSION,
  });
  if (operation.operation_id !== execution.operation_id) {
    throw contractError(
      "operation_binding_mismatch",
      "Execution and operation identities do not match.",
      "/operation/operation_id",
    );
  }
  assertExecutionBinding(execution as unknown as Record<string, unknown>, expected);
  return {
    execution,
    operation,
    idempotent_replay: payload.idempotent_replay === true,
    action: typeof payload.action === "string" ? payload.action : undefined,
  };
}

function assertExecutionResult(
  value: unknown,
  operationId: string,
  execution: AgentHarnessExecutionOperation,
): Record<string, unknown> {
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.execution_result_reference.v1") {
    throw contractError(
      "result_schema_mismatch",
      "Execution result reference schema identity is not published.",
      "/result/schema_identity",
    );
  }
  if (
    value.contract_revision !== AGENT_HARNESS_EXECUTION_CONTRACT_REVISION ||
    value.operation_id !== operationId ||
    value.execution_id !== execution.execution_id ||
    value.draft_id !== execution.draft_id ||
    value.approval_id !== execution.approval_id
  ) {
    throw contractError(
      "result_binding_mismatch",
      "Execution result is not bound to the requested operation.",
      "/result/operation_id",
    );
  }
  if (
    typeof value.run_id !== "string" ||
    value.run_status !== "completed" ||
    typeof value.manifest_schema_identity !== "string"
  ) {
    throw contractError("result_binding_mismatch", "Execution result run identity is incomplete.", "/result/run_id");
  }
  assertExecutionDigest(value.manifest_digest, "/result/manifest_digest");
  if (
    value.schema_set_revision !== execution.schema_set_revision ||
    !Array.isArray(value.artifacts) ||
    !Array.isArray(value.rejected_artifacts)
  ) {
    throw contractError(
      "artifact_manifest_invalid",
      "Execution result artifact identity is not closed.",
      "/result/artifacts",
    );
  }
  if (!isRecord(value.provenance))
    throw contractError("provenance_invalid", "Execution result provenance is missing.", "/result/provenance");
  return value;
}

export async function submitAgentHarnessExecution(
  request: AgentHarnessExecutionRequest,
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessExecutionBinding | null } = {},
): Promise<AgentHarnessExecutionResponse> {
  const body = closedRequest({ ...request }, executionRequestFields);
  const key = idempotencyKey("execution", options.idempotencyKey);
  if (body.idempotency_key !== undefined && body.idempotency_key !== key)
    throw contractError(
      "idempotency_key_mismatch",
      "Body idempotency key must match the request header.",
      "/idempotency_key",
    );
  body.idempotency_key = key;
  if (
    body.schema_identity !== "tilesim.agent_harness.execution_request.v1" ||
    body.contract_revision !== AGENT_HARNESS_EXECUTION_CONTRACT_REVISION
  )
    throw contractError(
      "schema_revision_mismatch",
      "Execution request contract revision is stale.",
      "/contract_revision",
    );
  const response = await client.submitExecution(body);
  return assertExecutionResponse(response.payload, response, options.expectedBinding || null);
}

export async function getAgentHarnessExecution(
  operationId: string,
  expectedBinding: AgentHarnessExecutionBinding | null = null,
): Promise<AgentHarnessExecutionResponse> {
  if (!operationId) throw contractError("invalid_argument", "Execution operation id is required.", "/operation_id");
  const response = await client.execution(operationId);
  return assertExecutionResponse(response.payload, response, expectedBinding);
}

export async function getAgentHarnessExecutionEvents(
  operationId: string,
  lastEventSequence = 0,
  expectedBinding: AgentHarnessExecutionBinding | null = null,
): Promise<{
  execution: AgentHarnessExecutionOperation;
  operation: AgentHarnessOperation;
  events: AgentHarnessExecutionEvent[];
  after_sequence: number;
  terminal: boolean;
}> {
  if (!Number.isInteger(lastEventSequence) || lastEventSequence < 0)
    throw contractError(
      "invalid_argument",
      "Last event sequence must be a non-negative integer.",
      "/headers/Last-Event-ID",
    );
  const response = await client.executionEvents(operationId, String(lastEventSequence));
  const executionResponse = assertExecutionResponse(
    { execution: response.payload.execution, operation: response.payload.operation },
    response,
    expectedBinding,
  );
  const events = response.payload.events.map((event) => assertExecutionEvent(event, response));
  let previous = lastEventSequence;
  for (const event of events) {
    if (event.operation_id !== operationId || event.execution_id !== executionResponse.execution.execution_id)
      throw contractError(
        "operation_binding_mismatch",
        "Execution event does not belong to the requested operation.",
        "/events",
      );
    if (event.sequence <= previous)
      throw contractError(
        "invalid_event_sequence",
        "Execution event sequence is not strictly increasing.",
        "/events/sequence",
      );
    previous = event.sequence;
  }
  return {
    execution: executionResponse.execution,
    operation: executionResponse.operation,
    events,
    after_sequence: response.payload.after_sequence,
    terminal: response.payload.terminal,
  };
}

export async function getAgentHarnessExecutionResult(
  operationId: string,
  expectedBinding: AgentHarnessExecutionBinding | null = null,
): Promise<Record<string, unknown>> {
  const executionResponse = await getAgentHarnessExecution(operationId, expectedBinding);
  const response = await client.executionResult(operationId);
  assertExecutionMetadata(response.schemaSetRevision, response.apiVersion);
  return assertExecutionResult(response.payload.result, operationId, executionResponse.execution);
}

export interface AgentHarnessExecutionSnapshot {
  operation: AgentHarnessOperation;
  execution: AgentHarnessExecutionOperation | null;
  response: AgentHarnessExecutionResponse | null;
  projection: AgentHarnessExecutionProjection | null;
  result: Record<string, unknown> | null;
  error: BridgeApiError | null;
}

export async function getAgentHarnessExecutionSnapshots(
  runId: string | null = null,
): Promise<AgentHarnessExecutionSnapshot[]> {
  const operations = (await getAgentHarnessOperations()).filter(
    (operation) =>
      operation.operation_kind === "controlled_execution" && (runId === null || operation.run_id === runId),
  );
  return Promise.all(
    operations.map(async (operation) => {
      try {
        const response = await getAgentHarnessExecution(operation.operation_id, {
          backend_identity: operation.backend_identity,
          schema_set_revision: operation.schema_set_revision,
          input_snapshot_digest: operation.snapshot_digest,
        });
        const events = await getAgentHarnessExecutionEvents(operation.operation_id, 0, {
          backend_identity: operation.backend_identity,
          schema_set_revision: operation.schema_set_revision,
          input_snapshot_digest: operation.snapshot_digest,
        });
        const result =
          response.execution.state === "completed"
            ? await getAgentHarnessExecutionResult(operation.operation_id, {
                backend_identity: operation.backend_identity,
                schema_set_revision: operation.schema_set_revision,
                input_snapshot_digest: operation.snapshot_digest,
              })
            : null;
        return {
          operation,
          execution: response.execution,
          response,
          projection: mergeExecutionProjection(response.execution, response.operation, events.events, "polling", null),
          result,
          error: null,
        } satisfies AgentHarnessExecutionSnapshot;
      } catch (error) {
        return {
          operation,
          execution: null,
          response: null,
          projection: null,
          result: null,
          error:
            error instanceof BridgeApiError
              ? error
              : contractError("execution_unavailable", "Execution snapshot could not be established."),
        } satisfies AgentHarnessExecutionSnapshot;
      }
    }),
  );
}

export async function mutateAgentHarnessExecution(
  operationId: string,
  action: "cancel" | "retry" | "resume",
  options: { idempotencyKey?: string; expectedBinding?: AgentHarnessExecutionBinding | null } = {},
): Promise<AgentHarnessExecutionResponse> {
  const key = idempotencyKey(`${action}-execution`, options.idempotencyKey);
  const body: AgentHarnessExecutionMutationRequest = {
    schema_identity: "tilesim.agent_harness.execution_mutation_request.v1",
    contract_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
    operation_id: operationId,
    action,
    idempotency_key: key,
  };
  const response = await client.executionAction(operationId, action, body);
  return assertExecutionResponse(response.payload, response, options.expectedBinding || null);
}

export interface ObserveAgentHarnessExecutionOptions {
  expectedBinding?: AgentHarnessExecutionBinding | null;
  lastEventSequence?: number;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  preferSse?: boolean;
  onProjection?: (projection: AgentHarnessExecutionProjection) => void;
}

function mergeExecutionProjection(
  execution: AgentHarnessExecutionOperation,
  operation: AgentHarnessOperation,
  events: readonly AgentHarnessExecutionEvent[],
  source: AgentHarnessExecutionProjection["source"],
  expectedBinding: AgentHarnessExecutionBinding | null,
): AgentHarnessExecutionProjection {
  const accepted: AgentHarnessExecutionEvent[] = [];
  const seen = new Map<string, AgentHarnessExecutionEvent>();
  const duplicate_event_ids: string[] = [];
  const rejected_event_ids: string[] = [];
  const late_event_ids: string[] = [];
  let state: AgentHarnessExecutionOperation["state"] = execution.state;
  let lastSequence = 0;
  let requiresRecovery = execution.unknown_outcome || execution.state === "recovery_required";
  let sawTerminalEvent = false;
  for (const event of events) {
    const prior = seen.get(event.event_id);
    if (prior) {
      if (prior.sequence === event.sequence && prior.payload_digest === event.payload_digest)
        duplicate_event_ids.push(event.event_id);
      else {
        rejected_event_ids.push(event.event_id);
        requiresRecovery = true;
      }
      continue;
    }
    if (event.sequence <= lastSequence || event.sequence !== lastSequence + 1) {
      rejected_event_ids.push(event.event_id);
      requiresRecovery = true;
      continue;
    }
    if (sawTerminalEvent) {
      late_event_ids.push(event.event_id);
      continue;
    }
    seen.set(event.event_id, event);
    accepted.push(event);
    lastSequence = event.sequence;
    state = event.state;
    if (event.terminal || executionTerminalStates.has(event.state)) sawTerminalEvent = true;
  }
  let stale_reason: string | null = null;
  if (expectedBinding) {
    try {
      assertExecutionBinding(execution as unknown as Record<string, unknown>, expectedBinding);
    } catch (error) {
      stale_reason = error instanceof BridgeApiError ? error.code : "execution_binding_mismatch";
      requiresRecovery = true;
    }
  }
  if (requiresRecovery) state = "recovery_required";
  return {
    execution,
    operation,
    events: accepted,
    state,
    terminal: executionTerminalStates.has(state),
    source,
    last_event_sequence: lastSequence,
    duplicate_event_ids,
    rejected_event_ids,
    late_event_ids,
    stale_reason,
    requires_recovery: requiresRecovery,
    error: execution.error,
  };
}

export async function observeAgentHarnessExecution(
  operationId: string,
  options: ObserveAgentHarnessExecutionOptions = {},
): Promise<AgentHarnessExecutionProjection> {
  const expectedBinding = options.expectedBinding || null;
  const initial = await getAgentHarnessExecution(operationId, expectedBinding);
  let projection = mergeExecutionProjection(initial.execution, initial.operation, [], "initial", expectedBinding);
  options.onProjection?.(projection);
  if (projection.terminal || projection.requires_recovery) return projection;
  let lastSequence = options.lastEventSequence ?? 0;
  if (options.preferSse !== false) {
    try {
      const response = await fetch(`${apiRoots()[0]}${agentHarnessPaths.executionEventStream(operationId)}`, {
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          ...(lastSequence > 0 ? { "Last-Event-ID": String(lastSequence) } : {}),
        },
        signal: options.signal,
      });
      if (!response.ok) await parseResponse<never>(response);
      assertExecutionMetadata(
        response.headers.get("x-tilesim-schema-set-revision") || "",
        response.headers.get("x-tilesim-api-version") || "",
      );
      if (!response.body) throw contractError("sse_unavailable", "Execution event stream has no body.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamed: AgentHarnessExecutionEvent[] = [];
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = parseSseFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (frame?.event === "execution" && frame.data) {
            const event = assertExecutionEvent(parseJsonLossless(frame.data), {
              schemaSetRevision: response.headers.get("x-tilesim-schema-set-revision") || "",
              apiVersion: response.headers.get("x-tilesim-api-version") || "",
            });
            streamed.push(event);
            lastSequence = Math.max(lastSequence, event.sequence);
            projection = mergeExecutionProjection(
              initial.execution,
              initial.operation,
              streamed,
              "sse",
              expectedBinding,
            );
            options.onProjection?.(projection);
          }
          if (frame?.event === "terminal") return projection;
          boundary = buffer.indexOf("\n\n");
        }
        if (done || projection.terminal || projection.requires_recovery) return projection;
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
    }
  }
  const maxAttempts = options.maxPollAttempts ?? 20;
  const interval = options.pollIntervalMs ?? 500;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    options.signal?.throwIfAborted();
    if (attempt > 0) await wait(interval, options.signal);
    const response = await getAgentHarnessExecutionEvents(operationId, lastSequence, expectedBinding);
    projection = mergeExecutionProjection(
      response.execution,
      response.operation,
      [...projection.events, ...response.events],
      "polling",
      expectedBinding,
    );
    lastSequence = projection.last_event_sequence;
    options.onProjection?.(projection);
    if (projection.terminal || projection.requires_recovery) return projection;
  }
  return projection;
}
