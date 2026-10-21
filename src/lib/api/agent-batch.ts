import {
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
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, isRecord } from "./transport";

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
function assertBatch(value: unknown, binding?: AgentBatchBinding | null): AgentHarnessBatchSession {
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.batch_session.v1")
    throw error("schema_identity_mismatch", "Batch schema identity is not published.", "/schema_identity");
  if (value.contract_revision !== AGENT_HARNESS_BATCH_CONTRACT_REVISION)
    throw error("contract_revision_mismatch", "Batch contract revision is stale.", "/contract_revision");
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
function assertDetail(value: unknown, binding?: AgentBatchBinding | null): AgentHarnessBatchDetail {
  if (!isRecord(value) || !isRecord(value.batch) || !Array.isArray(value.events) || !Array.isArray(value.candidates))
    throw error("invalid_batch_detail", "Batch detail is incomplete.");
  const batch = assertBatch(value.batch, binding);
  const events = value.events as Array<Record<string, unknown>>;
  if (events.some((event, index) => event.sequence !== index + 1))
    throw error("event_sequence_gap", "Batch event sequence is not contiguous.", "/events");
  return { ...(value as unknown as AgentHarnessBatchDetail), batch, events };
}

export async function listAgentBatches(): Promise<AgentHarnessBatchSession[]> {
  const response = await client.listBatches();
  return response.payload.batches.map((batch) => assertBatch(batch));
}
export async function getAgentBatch(
  batchId: string,
  binding?: AgentBatchBinding | null,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.batch(batchId);
  return assertDetail(response.payload.detail ?? response.payload, binding);
}
export async function createAgentBatch(
  request: AgentHarnessBatchCreateRequest,
  idempotencyKey = `batch-create-${crypto.randomUUID()}`,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.createBatch(request, idempotencyKey);
  return assertDetail(response.payload.detail ?? response.payload);
}
export async function approveAgentBatch(
  batchId: string,
  body: AgentHarnessBatchApprovalRequest = {},
  idempotencyKey = `batch-approve-${crypto.randomUUID()}`,
): Promise<AgentHarnessBatchDetail> {
  const response = await client.approveBatch(batchId, body, idempotencyKey);
  return assertDetail(response.payload.detail ?? response.payload);
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
  return assertDetail(response.payload.detail ?? response.payload);
}
export async function getAgentBatchEvents(
  batchId: string,
  lastEventId = "0",
): Promise<AgentHarnessBatchEventsResponse> {
  const response = await client.batchEvents(batchId, lastEventId);
  if (
    !Array.isArray(response.payload.events) ||
    response.payload.provenance?.production_status !== "not_for_production"
  )
    throw error("invalid_batch_events", "Batch events are not bounded local-dev data.");
  const after = Number(lastEventId);
  const events = response.payload.events as Array<Record<string, unknown>>;
  if (!Number.isInteger(after) || events.some((event, index) => event.sequence !== after + index + 1))
    throw error("event_sequence_gap", "Batch event replay is not contiguous.", "/events");
  return response.payload;
}
export interface ObserveAgentBatchOptions {
  lastEventSequence?: number;
  signal?: AbortSignal;
  onEvent?: (event: Record<string, unknown>) => void;
}
export async function observeAgentBatchEvents(batchId: string, options: ObserveAgentBatchOptions = {}): Promise<void> {
  const after = options.lastEventSequence || 0;
  const response = await fetch(`/api/agent/batches/${encodeURIComponent(batchId)}/events/stream`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream", ...(after ? { "Last-Event-ID": String(after) } : {}) },
    signal: options.signal,
  });
  if (!response.ok || !response.body) throw error("sse_unavailable", "Batch event stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) options.onEvent?.(JSON.parse(data) as Record<string, unknown>);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) return;
  }
}
