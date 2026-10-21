import {
  AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
  GeneratedAgentHarnessClient,
  type AgentHarnessBackendIdentity,
  type AgentHarnessOptimizationActionRequest,
  type AgentHarnessOptimizationApprovalRequest,
  type AgentHarnessOptimizationCandidate,
  type AgentHarnessOptimizationCreateRequest,
  type AgentHarnessOptimizationDetail,
  type AgentHarnessOptimizationSession,
  type AgentHarnessOptimizationSessionEventsResponse,
} from "../../contracts/generated/agent-harness";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, isRecord } from "./transport";

export const OPTIMIZATION_PROVENANCE = {
  deployment_mode: "local_dev",
  source_mode: "synthetic_trace",
  claim_scope: "exploratory",
  production_status: "not_for_production",
} as const;

// The local Bridge keeps mutation scopes opt-in.  The optimization panel is
// the only browser surface allowed to request these bounded local-dev scopes;
// it still cannot request shell, arbitrary URL or arbitrary file access.
const OPTIMIZATION_SCOPES =
  "agent:read_run,agent:read_draft,agent:read_evidence,agent:write_draft,agent:approve_draft,agent:submit_experiment,agent:cancel_experiment,agent:retry_experiment,agent:resume_experiment";
const client = new GeneratedAgentHarnessClient({
  request: (path, options = {}) =>
    apiRequestWithMetadata(path, {
      ...options,
      headers: {
        ...Object.fromEntries(new Headers(options.headers).entries()),
        "X-TileSim-Scopes": OPTIMIZATION_SCOPES,
      },
    }),
});

export interface AgentOptimizationBinding {
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  input_snapshot_digest: string;
}

function contractError(code: string, message: string, fieldPath: string | null = null): BridgeApiError {
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

function assertSession(value: unknown, binding?: AgentOptimizationBinding | null): AgentHarnessOptimizationSession {
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.optimization_session.v1")
    throw contractError(
      "schema_identity_mismatch",
      "Optimization session schema identity is not published.",
      "/schema_identity",
    );
  if (value.contract_revision !== AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION)
    throw contractError("contract_revision_mismatch", "Optimization contract revision is stale.", "/contract_revision");
  if (value.local_dev !== true || value.automatic_submission !== false)
    throw contractError(
      "local_dev_boundary_violation",
      "Optimization session is not explicitly local-dev/manual approval.",
    );
  if (stable(value.provenance) !== stable(OPTIMIZATION_PROVENANCE))
    throw contractError("provenance_mismatch", "Optimization provenance boundary is not preserved.", "/provenance");
  if (binding) {
    if (value.schema_set_revision !== binding.schema_set_revision)
      throw contractError(
        "schema_revision_mismatch",
        "Optimization session schema-set revision is stale.",
        "/schema_set_revision",
      );
    if (stable(value.backend_identity) !== stable(binding.backend_identity))
      throw contractError(
        "backend_identity_mismatch",
        "Optimization session backend identity is stale.",
        "/backend_identity",
      );
    if (value.input_snapshot_digest !== binding.input_snapshot_digest)
      throw contractError("snapshot_mismatch", "Optimization session snapshot is stale.", "/input_snapshot_digest");
  }
  return value as unknown as AgentHarnessOptimizationSession;
}

function assertDetail(value: unknown, binding?: AgentOptimizationBinding | null): AgentHarnessOptimizationDetail {
  if (!isRecord(value) || !isRecord(value.session))
    throw contractError("invalid_optimization_detail", "Optimization detail is not a closed response.");
  const session = assertSession(value.session, binding);
  if (!Array.isArray(value.events) || !Array.isArray(value.candidates) || !Array.isArray(value.iterations))
    throw contractError("invalid_optimization_detail", "Optimization detail is incomplete.");
  const events = value.events as Array<Record<string, unknown>>;
  const sequences = events.map((event) => event.sequence);
  if (sequences.some((sequence, index) => sequence !== index + 1))
    throw contractError("event_sequence_gap", "Optimization event sequence is not contiguous.", "/events");
  return { ...(value as unknown as AgentHarnessOptimizationDetail), session, events };
}

export async function listAgentOptimizationSessions(): Promise<AgentHarnessOptimizationSession[]> {
  const response = await client.listOptimizationSessions();
  const sessions = response.payload.sessions;
  return sessions.map((session) => assertSession(session));
}

export async function getAgentOptimizationSession(
  sessionId: string,
  binding?: AgentOptimizationBinding | null,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.optimizationSession(sessionId);
  return assertDetail(response.payload.detail ?? response.payload, binding);
}

export async function createAgentOptimizationSession(
  request: AgentHarnessOptimizationCreateRequest,
  idempotencyKey = request.idempotency_key || `opt-create-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.createOptimizationSession(request, idempotencyKey);
  return assertDetail(response.payload.detail ?? response.payload);
}

export async function approveAgentOptimizationCandidate(
  sessionId: string,
  candidateId: string,
  body: AgentHarnessOptimizationApprovalRequest = {},
  idempotencyKey = body.idempotency_key || `opt-approve-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.approveOptimizationCandidate(sessionId, candidateId, body, idempotencyKey);
  return assertDetail(response.payload.detail ?? response.payload);
}

export async function mutateAgentOptimizationSession(
  sessionId: string,
  action: "pause" | "resume" | "cancel" | "retry",
  recoveryAcknowledged = false,
  idempotencyKey = `opt-${action}-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const body: AgentHarnessOptimizationActionRequest = {
    session_id: sessionId,
    action,
    ...(recoveryAcknowledged ? { recovery_acknowledged: true } : {}),
    idempotency_key: idempotencyKey,
  };
  const response = await client.mutateOptimizationSession(sessionId, action, body);
  return assertDetail(response.payload.detail ?? response.payload);
}

export async function getAgentOptimizationEvents(
  sessionId: string,
  lastEventId = "0",
): Promise<AgentHarnessOptimizationSessionEventsResponse> {
  const response = await client.optimizationEvents(sessionId, lastEventId);
  if (
    !Array.isArray(response.payload.events) ||
    response.payload.provenance?.production_status !== "not_for_production"
  )
    throw contractError("invalid_optimization_events", "Optimization events are not a bounded local-dev response.");
  return response.payload;
}

export interface ObserveAgentOptimizationOptions {
  lastEventSequence?: number;
  signal?: AbortSignal;
  onEvent?: (event: Record<string, unknown>) => void;
}

export async function observeAgentOptimizationEvents(
  sessionId: string,
  options: ObserveAgentOptimizationOptions = {},
): Promise<void> {
  const after = options.lastEventSequence || 0;
  const response = await fetch(`/api/agent/optimization/sessions/${encodeURIComponent(sessionId)}/events/stream`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream", ...(after ? { "Last-Event-ID": String(after) } : {}) },
    signal: options.signal,
  });
  if (!response.ok || !response.body)
    throw contractError("sse_unavailable", "Optimization event stream is unavailable.");
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

export function currentOptimizationCandidate(
  detail: AgentHarnessOptimizationDetail,
): AgentHarnessOptimizationCandidate | null {
  return detail.candidate;
}

export function optimizationStateLabel(state: string | null | undefined): string {
  const labels: Record<string, string> = {
    waiting_approval: "等待批准",
    queued: "排队中",
    running: "执行中",
    paused: "已暂停",
    completed: "已完成",
    failed: "失败",
    recovery_required: "需要恢复",
    cancelled: "已取消",
    manual_intervention_required: "需要人工介入",
    retrying: "重试中",
    waiting_tool: "等待工具",
  };
  return (state && labels[state]) || "不可用";
}
