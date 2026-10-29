import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  AGENT_HARNESS_BATCH_CONTRACT_REVISION,
  GeneratedAgentHarnessClient,
  type AgentHarnessBackendIdentity,
  type AgentHarnessBatchActionRequest,
  type AgentHarnessBatchApprovalRequest,
  type AgentHarnessBatchCreateRequest,
  type AgentHarnessBatchDetail,
  type AgentHarnessBatchEventsResponse,
  type AgentHarnessBatchSession,
} from "../../contracts/generated/agent-harness";
import { agentHarnessPaths } from "../../contracts/generated/agent-harness";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { BridgeApiError } from "./errors";
import { readSseFrames } from "./sse";
import { apiRequestWithMetadata, apiRoots, isRecord, parseResponse } from "./transport";

export const BATCH_PROVENANCE = {
  deployment_mode: "local_dev",
  source_mode: "synthetic_trace",
  claim_scope: "exploratory",
  production_status: "not_for_production",
} as const;

const BATCH_SCOPES =
  "agent:read_run,agent:read_draft,agent:read_evidence,agent:write_draft,agent:approve_draft,agent:submit_experiment,agent:cancel_experiment,agent:retry_experiment,agent:resume_experiment";
const client = new GeneratedAgentHarnessClient({
  request: (path, options = {}) =>
    apiRequestWithMetadata(path, {
      ...options,
      headers: { ...Object.fromEntries(new Headers(options.headers).entries()), "X-TileSim-Scopes": BATCH_SCOPES },
    }),
});
const PUBLISHED_SCHEMA_SET_REVISIONS: ReadonlySet<string> = new Set([
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
]);
const BATCH_EVENT_STATES = new Set([
  "draft",
  "validated",
  "waiting_approval",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "manual_intervention_required",
]);
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export interface AgentBatchBinding {
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  input_snapshot_digest: string;
}
function error(code: string, message: string, fieldPath: string | null = null): BridgeApiError {
  return new BridgeApiError(message, { status: 0, code, fieldPath, retryable: false, terminalFailure: true });
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function assertResponseMetadata(schemaSetRevision: string, apiVersion: string): void {
  if (apiVersion !== AGENT_HARNESS_API_VERSION)
    throw error("unsupported_api_contract", "Batch API version is not published.", "/api_version");
  if (!PUBLISHED_SCHEMA_SET_REVISIONS.has(schemaSetRevision))
    throw error("schema_revision_mismatch", "Batch schema-set revision is stale.", "/schema_set_revision");
}
function assertBatch(value: unknown, binding?: AgentBatchBinding | null): AgentHarnessBatchSession {
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.batch_session.v1")
    throw error("schema_identity_mismatch", "Batch schema identity is not published.", "/schema_identity");
  if (value.contract_revision !== AGENT_HARNESS_BATCH_CONTRACT_REVISION)
    throw error("contract_revision_mismatch", "Batch contract revision is stale.", "/contract_revision");
  if (!PUBLISHED_SCHEMA_SET_REVISIONS.has(value.schema_set_revision as string))
    throw error("schema_revision_mismatch", "Batch schema-set revision is stale.", "/schema_set_revision");
  if (value.local_dev !== true || value.approval_required !== true)
    throw error("local_dev_boundary_violation", "Batch is not explicitly local-dev and approval-gated.");
  if (stable(value.provenance) !== stable(BATCH_PROVENANCE))
    throw error("provenance_mismatch", "Batch provenance boundary is not preserved.", "/provenance");
  if (binding) {
    if (value.schema_set_revision !== binding.schema_set_revision)
      throw error("schema_revision_mismatch", "Batch schema-set revision is stale.", "/schema_set_revision");
    if (stable(value.backend_identity) !== stable(binding.backend_identity))
      throw error("backend_identity_mismatch", "Batch backend identity is stale.", "/backend_identity");
    if (value.input_snapshot_digest !== binding.input_snapshot_digest)
      throw error("snapshot_mismatch", "Batch snapshot is stale.", "/input_snapshot_digest");
  }
  return value as unknown as AgentHarnessBatchSession;
}

function assertBatchEvent(value: unknown, batchId: string, previousSequence: number): Record<string, unknown> {
  if (!isRecord(value)) throw error("invalid_batch_event", "Batch event is not an object.", "/events");
  const allowed = [
    "schema_identity",
    "contract_revision",
    "batch_id",
    "event_id",
    "sequence",
    "state",
    "node",
    "payload_digest",
    "created_at",
    "provenance",
  ];
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw error("invalid_batch_event", "Batch event contains an unknown field.", `/events/${unknown}`);
  if (value.schema_identity !== "tilesim.agent_harness.batch_event.v1")
    throw error("schema_identity_mismatch", "Batch event schema identity is not published.", "/events/schema_identity");
  if (value.contract_revision !== AGENT_HARNESS_BATCH_CONTRACT_REVISION)
    throw error("contract_revision_mismatch", "Batch event contract revision is stale.", "/events/contract_revision");
  if (value.batch_id !== batchId || typeof value.event_id !== "string" || !value.event_id)
    throw error("batch_id_mismatch", "Batch event does not belong to the requested batch.", "/events/batch_id");
  if (
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence !== previousSequence + 1
  )
    throw error("event_sequence_gap", "Batch event sequence is not contiguous.", "/events/sequence");
  if (typeof value.state !== "string" || !BATCH_EVENT_STATES.has(value.state))
    throw error("invalid_batch_event", "Batch event state is not published.", "/events/state");
  if (
    typeof value.node !== "string" ||
    !value.node ||
    typeof value.payload_digest !== "string" ||
    !DIGEST_PATTERN.test(value.payload_digest)
  )
    throw error("invalid_batch_event", "Batch event payload identity is invalid.", "/events/payload_digest");
  if (
    typeof value.created_at !== "string" ||
    !ISO_DATE_TIME_PATTERN.test(value.created_at) ||
    Number.isNaN(Date.parse(value.created_at))
  )
    throw error("invalid_batch_event", "Batch event timestamp is invalid.", "/events/created_at");
  if (stable(value.provenance) !== stable(BATCH_PROVENANCE))
    throw error("provenance_mismatch", "Batch event provenance is not preserved.", "/events/provenance");
  return value;
}
function assertDetail(
  value: unknown,
  binding?: AgentBatchBinding | null,
  expectedBatchId?: string,
): AgentHarnessBatchDetail {
  if (!isRecord(value) || !isRecord(value.batch) || !Array.isArray(value.events) || !Array.isArray(value.candidates))
    throw error("invalid_batch_detail", "Batch detail is incomplete.");
  const batch = assertBatch(value.batch, binding);
  if (expectedBatchId && batch.batch_id !== expectedBatchId)
    throw error("batch_id_mismatch", "Batch response does not match the requested batch.", "/batch/batch_id");
  const events = value.events as Array<Record<string, unknown>>;
  let previousSequence = 0;
  for (const event of events)
    previousSequence = (assertBatchEvent(event, batch.batch_id, previousSequence), event.sequence as number);
  if (
    events.some((event) => event.batch_id !== batch.batch_id) ||
    (value.candidates as Array<Record<string, unknown>>).some((candidate) => candidate.batch_id !== batch.batch_id)
  )
    throw error("batch_id_mismatch", "Batch detail contains records from another batch.", "/events");
  return { ...(value as unknown as AgentHarnessBatchDetail), batch, events };
}

const BATCH_TERMINAL_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "manual_intervention_required",
]);

export async function listAgentBatches(): Promise<AgentHarnessBatchSession[]> {
  const response = await client.listBatches();
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  return response.payload.batches.map((batch) => assertBatch(batch));
}
export async function getAgentBatch(
  batchId: string,
  binding?: AgentBatchBinding | null,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.batch(batchId);
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, binding, batchId);
}
export async function createAgentBatch(
  request: AgentHarnessBatchCreateRequest,
  idempotencyKey = `batch-create-${crypto.randomUUID()}`,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.createBatch(request, idempotencyKey);
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload);
}
export async function approveAgentBatch(
  batchId: string,
  body: AgentHarnessBatchApprovalRequest = {},
  idempotencyKey = `batch-approve-${crypto.randomUUID()}`,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.approveBatch(batchId, body, idempotencyKey);
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, null, batchId);
}
export async function mutateAgentBatch(
  batchId: string,
  action: AgentHarnessBatchActionRequest["action"],
  recoveryAcknowledged = false,
  idempotencyKey = `batch-${action}-${crypto.randomUUID()}`,
): Promise<AgentHarnessBatchDetail> {
  const body: AgentHarnessBatchActionRequest = {
    batch_id: batchId,
    action,
    idempotency_key: idempotencyKey,
    ...(recoveryAcknowledged ? { recovery_acknowledged: true } : {}),
  };
  const response = await client.mutateBatch(batchId, action, body);
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, null, batchId);
}
export async function getAgentBatchEvents(
  batchId: string,
  lastEventId = "0",
): Promise<AgentHarnessBatchEventsResponse> {
  const response = await client.batchEvents(batchId, lastEventId);
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion);
  if (response.payload.batch_id !== batchId)
    throw error("batch_id_mismatch", "Batch event replay belongs to another batch.", "/batch_id");
  if (
    !Array.isArray(response.payload.events) ||
    !Number.isSafeInteger(response.payload.after_sequence) ||
    typeof response.payload.terminal !== "boolean" ||
    stable(response.payload.provenance) !== stable(BATCH_PROVENANCE)
  )
    throw error("invalid_batch_events", "Batch events are not bounded local-dev data.");
  const after = Number(lastEventId);
  if (response.payload.after_sequence !== after)
    throw error("event_sequence_gap", "Batch event replay cursor does not match the request.", "/after_sequence");
  const events = response.payload.events as Array<Record<string, unknown>>;
  if (!Number.isSafeInteger(after) || after < 0)
    throw error("invalid_event_sequence", "Batch event cursor is invalid.", "/headers/Last-Event-ID");
  let previous = after;
  for (const event of events) previous = (assertBatchEvent(event, batchId, previous), event.sequence as number);
  return response.payload;
}
export interface ObserveAgentBatchOptions {
  lastEventSequence?: number;
  signal?: AbortSignal;
  onEvent?: (event: Record<string, unknown>) => void;
}
export async function observeAgentBatchEvents(batchId: string, options: ObserveAgentBatchOptions = {}): Promise<void> {
  const after = options.lastEventSequence ?? 0;
  if (!Number.isSafeInteger(after) || after < 0)
    throw error("invalid_event_sequence", "Batch event cursor is invalid.", "/last_event_sequence");
  let lastSequence = after;
  const response = await fetch(`${apiRoots()[0]}${agentHarnessPaths.batchEventStream(batchId)}`, {
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      "X-TileSim-Scopes": BATCH_SCOPES,
      ...(after ? { "Last-Event-ID": String(after) } : {}),
    },
    signal: options.signal,
  });
  if (!response.ok) await parseResponse<never>(response);
  assertResponseMetadata(
    response.headers.get("x-tilesim-schema-set-revision") || "",
    response.headers.get("x-tilesim-api-version") || "",
  );
  if (!response.body || !(response.headers.get("content-type") || "").includes("text/event-stream"))
    throw error("sse_unavailable", "Batch event stream is unavailable.");
  let sawTerminal = false;
  for await (const frame of readSseFrames(response)) {
    if (!frame.data) throw error("invalid_batch_event", "Batch event frame is empty.", "/event/data");
    const value = parseJsonLossless(frame.data);
    if (!isRecord(value) || value.batch_id !== batchId)
      throw error("batch_id_mismatch", "Batch event belongs to another batch.", "/batch_id");
    if (frame.event === "terminal") {
      if (
        Object.keys(value).some((key) => !["batch_id", "state"].includes(key)) ||
        typeof value.state !== "string" ||
        !BATCH_TERMINAL_STATES.has(value.state)
      )
        throw error("invalid_batch_event", "Batch terminal frame is not a published terminal state.", "/terminal");
      sawTerminal = true;
      continue;
    }
    if (frame.event !== "workflow") throw error("invalid_batch_event", "Batch event type is not published.", "/event");
    assertBatchEvent(value, batchId, lastSequence);
    if (!/^[0-9]+$/u.test(frame.id) || Number(frame.id) !== value.sequence)
      throw error("event_sequence_gap", "Batch event id does not match its sequence.", "/event/id");
    lastSequence = value.sequence;
    options.onEvent?.(value);
  }
  if (!sawTerminal)
    throw error(
      "incomplete_batch_stream",
      "Batch event stream ended before a terminal state was published.",
      "/event/terminal",
    );
}
