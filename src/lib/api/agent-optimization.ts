import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_AUTHORIZATION_CONTRACT_REVISION,
  AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  GeneratedAgentHarnessClient,
  type AgentHarnessBackendIdentity,
  type AgentHarnessOptimizationActionRequest,
  type AgentHarnessOptimizationApprovalRequest,
  type AgentHarnessOptimizationAuthorization,
  type AgentHarnessOptimizationAuthorizationGetResponse,
  type AgentHarnessOptimizationAuthorizationRequest,
  type AgentHarnessOptimizationAuthorizationResponse,
  type AgentHarnessOptimizationCandidate,
  type AgentHarnessOptimizationCreateRequest,
  type AgentHarnessOptimizationDetail as GeneratedAgentHarnessOptimizationDetail,
  type AgentHarnessOptimizationSession as GeneratedAgentHarnessOptimizationSession,
  type AgentHarnessOptimizationSessionEventsResponse,
} from "../../contracts/generated/agent-harness";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, apiRoots, isRecord, parseResponse } from "./transport";
import { readSseFrames } from "./sse";

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

const PUBLISHED_SCHEMA_SET_REVISIONS: ReadonlySet<string> = new Set([
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
]);
const OPTIMIZATION_STATES = new Set([
  "draft",
  "submitted",
  "queued",
  "running",
  "waiting_tool",
  "waiting_approval",
  "paused",
  "retrying",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "manual_intervention_required",
]);
// A manual-intervention stop is terminal for event observation even though
// the durable state machine still permits the explicit cancel action.  Keep
// this read-side set separate from Bridge transition guards.
const OPTIMIZATION_TERMINAL_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "manual_intervention_required",
]);
const OPTIMIZATION_AGENT_EVENT_NAMES = new Set([
  "agent.step",
  "agent.tool_call",
  "agent.tool_result",
  "agent.verdict",
  "agent.degraded",
  "agent.ask_user",
]);
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

function assertOptimizationMetadata(schemaSetRevision: string, apiVersion: string): void {
  if (apiVersion !== AGENT_HARNESS_API_VERSION)
    throw contractError("unsupported_api_contract", "Optimization API version is not published.", "/api_version");
  if (!PUBLISHED_SCHEMA_SET_REVISIONS.has(schemaSetRevision))
    throw contractError(
      "schema_revision_mismatch",
      "Optimization schema-set revision is stale.",
      "/schema_set_revision",
    );
}

function assertOptimizationProvenance(value: unknown): void {
  if (!isRecord(value) || stable(value) !== stable(OPTIMIZATION_PROVENANCE))
    throw contractError("provenance_mismatch", "Optimization provenance boundary is not preserved.", "/provenance");
}

function assertOptimizationEvent(value: unknown, sessionId: string, previousSequence: number): Record<string, unknown> {
  if (!isRecord(value))
    throw contractError("invalid_optimization_event", "Optimization event is not an object.", "/events");
  const allowed = [
    "schema_identity",
    "contract_revision",
    "session_id",
    "event_id",
    "sequence",
    "state",
    "node",
    "payload_digest",
    "created_at",
    "provenance",
  ];
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown)
    throw contractError(
      "invalid_optimization_event",
      "Optimization event contains an unknown field.",
      `/events/${unknown}`,
    );
  if (value.schema_identity !== "tilesim.agent_harness.optimization_event.v1")
    throw contractError(
      "schema_identity_mismatch",
      "Optimization event schema identity is not published.",
      "/events/schema_identity",
    );
  if (value.contract_revision !== AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION)
    throw contractError(
      "contract_revision_mismatch",
      "Optimization event contract revision is stale.",
      "/events/contract_revision",
    );
  if (value.session_id !== sessionId || !boundedString(value.event_id, 256))
    throw contractError(
      "session_binding_mismatch",
      "Optimization event does not belong to the requested session.",
      "/events/session_id",
    );
  if (
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence !== previousSequence + 1
  )
    throw contractError("event_sequence_gap", "Optimization event sequence is not contiguous.", "/events/sequence");
  if (!boundedString(value.state, 128) || !OPTIMIZATION_STATES.has(value.state))
    throw contractError("invalid_optimization_event", "Optimization event state is not published.", "/events/state");
  if (
    !boundedString(value.node, 128) ||
    typeof value.payload_digest !== "string" ||
    !DIGEST_PATTERN.test(value.payload_digest)
  )
    throw contractError(
      "invalid_optimization_event",
      "Optimization event payload identity is invalid.",
      "/events/payload_digest",
    );
  if (
    typeof value.created_at !== "string" ||
    !ISO_DATE_TIME_PATTERN.test(value.created_at) ||
    Number.isNaN(Date.parse(value.created_at))
  )
    throw contractError("invalid_optimization_event", "Optimization event timestamp is invalid.", "/events/created_at");
  assertOptimizationProvenance(value.provenance);
  return value;
}

function assertOptimizationTerminal(value: unknown, sessionId: string, lastSequence: number): void {
  if (!isRecord(value) || Object.keys(value).some((key) => !["session_id", "state"].includes(key)))
    throw contractError("invalid_optimization_event", "Optimization terminal frame is not closed.", "/events/terminal");
  if (
    value.session_id !== sessionId ||
    typeof value.state !== "string" ||
    !OPTIMIZATION_TERMINAL_STATES.has(value.state)
  )
    throw contractError(
      "invalid_optimization_event",
      "Optimization terminal frame is not bound to the session.",
      "/events/terminal",
    );
  if (lastSequence < 1)
    throw contractError(
      "event_sequence_gap",
      "Optimization terminal frame has no preceding event.",
      "/events/terminal",
    );
}

export interface AgentOptimizationBinding {
  schema_set_revision: string;
  backend_identity: AgentHarnessBackendIdentity;
  input_snapshot_digest: string;
}

/**
 * The optimization session contract predates the authorization envelope.
 * Keep the generated bootstrap shape intact, but widen the read projection in
 * this adapter: a session is created with `automatic_submission: false` and
 * receives its immutable authorization later through the authorization
 * endpoint.  Treating `automatic_submission` as a literal `false` here would
 * make a valid bounded-autonomous session impossible to consume in the UI.
 */
export type AgentHarnessOptimizationSession = Omit<GeneratedAgentHarnessOptimizationSession, "automatic_submission"> & {
  // The compatibility field remains false for the bootstrap request.  An
  // autonomous grant is represented by the bound authorization envelope,
  // never by flipping this legacy flag.
  automatic_submission: false;
  autonomy?: "off" | "propose" | "auto";
  authorization_id?: string | null;
  authorization?: AgentHarnessOptimizationAuthorization | null;
  agent_turns?: Array<Record<string, unknown>>;
};
export type AgentHarnessOptimizationDetail = Omit<GeneratedAgentHarnessOptimizationDetail, "session"> & {
  session: AgentHarnessOptimizationSession;
  authorization?: AgentHarnessOptimizationAuthorization | null;
  agent_turns?: Array<Record<string, unknown>>;
};

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

const AUTHORIZATION_STATUSES = new Set(["active", "exhausted", "revoked", "expired"]);
const AUTHORIZATION_AUTONOMY_LEVELS = new Set(["bounded_autonomous", "human_approves_each"]);
const AUTHORIZATION_ACTIONS = new Set(["explain", "navigate", "analyze", "report", "draft", "execute"]);
const AUTHORIZATION_TOOLS = new Set([
  "get_capability_catalog",
  "get_run_status",
  "list_run_evidence",
  "query_verified_metrics",
]);
const AUTHORIZATION_PAGES = new Set([
  "overview",
  "execution",
  "replay",
  "metrics",
  "fabric",
  "attribution",
  "validation",
  "raw_evidence",
  "evidence_agent",
  "evidence_lab",
  "design_space",
  "history",
  "experiment",
]);
const AUTHORIZATION_BUDGET_LIMITS: Record<string, number> = {
  max_rounds: 20,
  max_runs: 20,
  max_seconds: 3600,
  max_failures: 5,
  max_model_calls: 60,
  max_tool_calls_per_round: 4,
  max_navigation_attempts: 8,
  max_run_creations: 1,
  max_execution_time_ms: 3_600_000,
};

function assertAuthorization(value: unknown, expectedSessionId?: string): AgentHarnessOptimizationAuthorization {
  if (!isRecord(value))
    throw contractError("invalid_authorization", "Authorization envelope is not an object.", "/authorization");
  const allowed = [
    "schema_identity",
    "contract_revision",
    "authorization_id",
    "session_id",
    "principal",
    "workspace_id",
    "schema_set_revision",
    "backend_identity",
    "input_snapshot_digest",
    "autonomy_level",
    "budget",
    "parameter_grants",
    "objective",
    "tool_allowlist",
    "allowed_pages",
    "allowed_actions",
    "protected",
    "status",
    "issued_by",
    "issued_at",
    "expires_at",
    "revoked_at",
    "provenance",
    "authorization_digest",
  ];
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown)
    throw contractError(
      "invalid_authorization",
      "Authorization envelope contains an unknown field.",
      `/authorization/${unknown}`,
    );
  if (value.schema_identity !== "tilesim.agent_harness.optimization_authorization.v1")
    throw contractError(
      "schema_identity_mismatch",
      "Authorization schema identity is stale.",
      "/authorization/schema_identity",
    );
  if (value.contract_revision !== AGENT_HARNESS_AUTHORIZATION_CONTRACT_REVISION)
    throw contractError(
      "contract_revision_mismatch",
      "Authorization contract revision is stale.",
      "/authorization/contract_revision",
    );
  if (!boundedString(value.authorization_id, 128) || !value.authorization_id.startsWith("authz-"))
    throw contractError(
      "invalid_authorization",
      "Authorization identity is invalid.",
      "/authorization/authorization_id",
    );
  if (expectedSessionId && value.session_id !== expectedSessionId)
    throw contractError(
      "session_binding_mismatch",
      "Authorization is bound to another session.",
      "/authorization/session_id",
    );
  if (
    !boundedString(value.session_id, 128) ||
    !boundedString(value.principal, 256) ||
    !boundedString(value.workspace_id, 256)
  )
    throw contractError(
      "invalid_authorization",
      "Authorization subject binding is invalid.",
      "/authorization/session_id",
    );
  if (
    !DIGEST_PATTERN.test(String(value.schema_set_revision)) ||
    !DIGEST_PATTERN.test(String(value.input_snapshot_digest)) ||
    !DIGEST_PATTERN.test(String(value.authorization_digest))
  )
    throw contractError(
      "invalid_authorization",
      "Authorization digest binding is invalid.",
      "/authorization/authorization_digest",
    );
  if (
    !isRecord(value.backend_identity) ||
    !AUTHORIZATION_AUTONOMY_LEVELS.has(String(value.autonomy_level)) ||
    !AUTHORIZATION_STATUSES.has(String(value.status))
  )
    throw contractError(
      "invalid_authorization",
      "Authorization identity or status is invalid.",
      "/authorization/status",
    );
  if (!isRecord(value.budget))
    throw contractError("invalid_authorization", "Authorization budget is missing.", "/authorization/budget");
  const budgetKeys = new Set(Object.keys(value.budget));
  if (
    budgetKeys.size !== Object.keys(AUTHORIZATION_BUDGET_LIMITS).length ||
    [...budgetKeys].some((name) => !(name in AUTHORIZATION_BUDGET_LIMITS))
  )
    throw contractError("invalid_budget", "Authorization budget contains unknown fields.", "/authorization/budget");
  for (const [name, limit] of Object.entries(AUTHORIZATION_BUDGET_LIMITS)) {
    const item = value.budget[name];
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 1 || item > limit)
      throw contractError(
        "invalid_budget",
        `Authorization budget ${name} is invalid.`,
        `/authorization/budget/${name}`,
      );
  }
  if (
    !Array.isArray(value.tool_allowlist) ||
    value.tool_allowlist.length === 0 ||
    new Set(value.tool_allowlist).size !== value.tool_allowlist.length ||
    value.tool_allowlist.some((item) => !boundedString(item, 128) || !AUTHORIZATION_TOOLS.has(item as string))
  )
    throw contractError(
      "invalid_authorization",
      "Authorization tool allow-list is invalid.",
      "/authorization/tool_allowlist",
    );
  for (const field of ["allowed_pages", "allowed_actions"] as const) {
    const items = value[field];
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      new Set(items).size !== items.length ||
      items.some((item) => !boundedString(item, 128))
    )
      throw contractError("invalid_authorization", `Authorization ${field} is invalid.`, `/authorization/${field}`);
    if (field === "allowed_pages" && items.some((item) => !AUTHORIZATION_PAGES.has(item as string)))
      throw contractError(
        "invalid_authorization",
        "Authorization page is unpublished.",
        "/authorization/allowed_pages",
      );
    if (field === "allowed_actions" && items.some((item) => !AUTHORIZATION_ACTIONS.has(item as string)))
      throw contractError(
        "invalid_authorization",
        "Authorization action is unpublished.",
        "/authorization/allowed_actions",
      );
  }
  if (
    !Array.isArray(value.parameter_grants) ||
    !isRecord(value.objective) ||
    !isRecord(value.protected) ||
    !isRecord(value.provenance)
  )
    throw contractError("invalid_authorization", "Authorization envelope is incomplete.", "/authorization");
  for (const [index, grant] of value.parameter_grants.entries()) {
    if (
      !isRecord(grant) ||
      Object.keys(grant).some((key) => !["pointer", "min", "max", "step", "kind"].includes(key)) ||
      !boundedString(grant.pointer, 512) ||
      !grant.pointer.startsWith("/") ||
      typeof grant.min !== "number" ||
      typeof grant.max !== "number" ||
      typeof grant.step !== "number" ||
      !Number.isFinite(grant.min) ||
      !Number.isFinite(grant.max) ||
      !Number.isFinite(grant.step) ||
      grant.min >= grant.max ||
      grant.step <= 0 ||
      (grant.kind !== undefined && !["int", "integer", "number", "float"].includes(String(grant.kind)))
    )
      throw contractError(
        "invalid_authorization",
        "Authorization parameter grant is invalid.",
        `/authorization/parameter_grants/${index}`,
      );
  }
  const objectiveMinimumImprovement = value.objective.minimum_improvement;
  const objectivePlateauRounds = value.objective.plateau_rounds;
  if (
    Object.keys(value.objective).some(
      (key) => !["metric_path", "direction", "minimum_improvement", "plateau_rounds"].includes(key),
    ) ||
    !boundedString(value.objective.metric_path, 512) ||
    !value.objective.metric_path.startsWith("/") ||
    !["minimize", "maximize"].includes(String(value.objective.direction)) ||
    (objectiveMinimumImprovement !== undefined &&
      (typeof objectiveMinimumImprovement !== "number" || objectiveMinimumImprovement < 0)) ||
    (objectivePlateauRounds !== undefined &&
      (typeof objectivePlateauRounds !== "number" ||
        !Number.isSafeInteger(objectivePlateauRounds) ||
        objectivePlateauRounds < 1 ||
        objectivePlateauRounds > 20))
  )
    throw contractError("invalid_authorization", "Authorization objective is invalid.", "/authorization/objective");
  if (
    Object.keys(value.protected).some(
      (key) => !["source_mode", "claim_scope", "schema_set_revision", "backend_identity"].includes(key),
    ) ||
    value.protected.source_mode !== "synthetic_trace" ||
    value.protected.claim_scope !== "exploratory" ||
    value.protected.schema_set_revision !== value.schema_set_revision ||
    stable(value.protected.backend_identity) !== stable(value.backend_identity)
  )
    throw contractError(
      "invalid_authorization",
      "Authorization protected binding is invalid.",
      "/authorization/protected",
    );
  if (
    value.provenance.deployment_mode !== "local_dev" ||
    value.provenance.source_mode !== "synthetic_trace" ||
    value.provenance.claim_scope !== "exploratory" ||
    value.provenance.production_status !== "not_for_production"
  )
    throw contractError(
      "provenance_mismatch",
      "Authorization provenance boundary is not preserved.",
      "/authorization/provenance",
    );
  return value as unknown as AgentHarnessOptimizationAuthorization;
}

function assertSession(
  value: unknown,
  binding?: AgentOptimizationBinding | null,
  expectedSchemaRevision?: string,
): AgentHarnessOptimizationSession {
  if (!isRecord(value) || value.schema_identity !== "tilesim.agent_harness.optimization_session.v1")
    throw contractError(
      "schema_identity_mismatch",
      "Optimization session schema identity is not published.",
      "/schema_identity",
    );
  if (value.contract_revision !== AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION)
    throw contractError("contract_revision_mismatch", "Optimization contract revision is stale.", "/contract_revision");
  const hasAutonomousAuthorization =
    value.autonomy === "auto" &&
    boundedString(value.authorization_id, 128) &&
    isRecord(value.authorization) &&
    value.authorization.status === "active" &&
    value.authorization.autonomy_level === "bounded_autonomous" &&
    value.authorization.authorization_id === value.authorization_id;
  if (value.authorization !== undefined && value.authorization !== null)
    assertAuthorization(value.authorization, value.session_id as string);
  const hasLegacyAutonomousEnvelope =
    value.automatic_submission === true && value.autonomy === "auto" && boundedString(value.authorization_id, 128);
  if (
    value.local_dev !== true ||
    (value.automatic_submission !== false && !hasLegacyAutonomousEnvelope) ||
    (value.autonomy === "auto" && !hasAutonomousAuthorization && !hasLegacyAutonomousEnvelope)
  )
    throw contractError(
      "local_dev_boundary_violation",
      "Optimization session is not explicitly local-dev/manual approval.",
    );
  if (stable(value.provenance) !== stable(OPTIMIZATION_PROVENANCE))
    throw contractError("provenance_mismatch", "Optimization provenance boundary is not preserved.", "/provenance");
  if (!PUBLISHED_SCHEMA_SET_REVISIONS.has(value.schema_set_revision as string))
    throw contractError(
      "schema_revision_mismatch",
      "Optimization session schema-set revision is stale.",
      "/schema_set_revision",
    );
  if (expectedSchemaRevision && value.schema_set_revision !== expectedSchemaRevision)
    throw contractError(
      "schema_revision_mismatch",
      "Optimization session metadata does not match its payload.",
      "/schema_set_revision",
    );
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

function assertDetail(
  value: unknown,
  binding?: AgentOptimizationBinding | null,
  expectedSessionId?: string,
  expectedSchemaRevision?: string,
): AgentHarnessOptimizationDetail {
  if (!isRecord(value) || !isRecord(value.session))
    throw contractError("invalid_optimization_detail", "Optimization detail is not a closed response.");
  const session = assertSession(value.session, binding, expectedSchemaRevision);
  if (expectedSessionId && session.session_id !== expectedSessionId)
    throw contractError(
      "session_binding_mismatch",
      "Optimization detail does not match the requested session.",
      "/session/session_id",
    );
  if (!Array.isArray(value.events) || !Array.isArray(value.candidates) || !Array.isArray(value.iterations))
    throw contractError("invalid_optimization_detail", "Optimization detail is incomplete.");
  const events = value.events as Array<Record<string, unknown>>;
  let previous = 0;
  for (const event of events)
    previous = (assertOptimizationEvent(event, session.session_id, previous), event.sequence as number);
  const candidates = value.candidates as Array<Record<string, unknown>>;
  for (const candidate of candidates) {
    if (
      candidate.session_id !== session.session_id ||
      candidate.contract_revision !== AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION ||
      !PUBLISHED_SCHEMA_SET_REVISIONS.has(candidate.schema_set_revision as string) ||
      stable(candidate.provenance) !== stable(OPTIMIZATION_PROVENANCE)
    )
      throw contractError(
        "session_binding_mismatch",
        "Optimization candidate does not belong to the session.",
        "/candidates",
      );
    if (candidate.origin !== "model" && candidate.origin !== "rule")
      throw contractError(
        "invalid_candidate_origin",
        "Optimization candidate origin is not a published value.",
        "/candidates/origin",
      );
    if (candidate.authorization_id !== null && !boundedString(candidate.authorization_id, 128))
      throw contractError(
        "invalid_authorization",
        "Optimization candidate authorization identity is invalid.",
        "/candidates/authorization_id",
      );
  }
  return { ...(value as unknown as AgentHarnessOptimizationDetail), session, events };
}

export async function listAgentOptimizationSessions(): Promise<AgentHarnessOptimizationSession[]> {
  const response = await client.listOptimizationSessions();
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  const sessions = response.payload.sessions;
  return sessions.map((session) => assertSession(session, null, response.schemaSetRevision));
}

export async function getAgentOptimizationSession(
  sessionId: string,
  binding?: AgentOptimizationBinding | null,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.optimizationSession(sessionId);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, binding, sessionId, response.schemaSetRevision);
}

export async function createAgentOptimizationSession(
  request: AgentHarnessOptimizationCreateRequest,
  idempotencyKey = request.idempotency_key || `opt-create-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.createOptimizationSession(request, idempotencyKey);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, null, undefined, response.schemaSetRevision);
}

export async function getAgentOptimizationAuthorization(
  sessionId: string,
): Promise<AgentHarnessOptimizationAuthorization | null> {
  const response: {
    payload: AgentHarnessOptimizationAuthorizationGetResponse;
    schemaSetRevision: string;
    apiVersion: string;
  } = await client.optimizationAuthorization(sessionId);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  if (response.payload.session_id !== sessionId)
    throw contractError(
      "session_binding_mismatch",
      "Authorization response is bound to another session.",
      "/session_id",
    );
  if (response.payload.authorization === null) return null;
  return assertAuthorization(response.payload.authorization, sessionId);
}

export async function createAgentOptimizationAuthorization(
  sessionId: string,
  request: AgentHarnessOptimizationAuthorizationRequest,
  idempotencyKey = `opt-auth-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response: {
    payload: AgentHarnessOptimizationAuthorizationResponse;
    schemaSetRevision: string;
    apiVersion: string;
  } = await client.createOptimizationAuthorization(sessionId, request, idempotencyKey);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  assertAuthorization(response.payload.authorization, sessionId);
  return assertDetail(response.payload.detail, null, sessionId, response.schemaSetRevision);
}

export async function revokeAgentOptimizationAuthorization(
  sessionId: string,
  idempotencyKey = `opt-auth-revoke-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response: {
    payload: AgentHarnessOptimizationAuthorizationResponse;
    schemaSetRevision: string;
    apiVersion: string;
  } = await client.revokeOptimizationAuthorization(sessionId, idempotencyKey);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  const authorization = assertAuthorization(response.payload.authorization, sessionId);
  if (authorization.status !== "revoked")
    throw contractError(
      "authorization_invalid",
      "Revocation response did not close the authorization envelope.",
      "/authorization/status",
    );
  return assertDetail(response.payload.detail, null, sessionId, response.schemaSetRevision);
}

export async function approveAgentOptimizationCandidate(
  sessionId: string,
  candidateId: string,
  body: AgentHarnessOptimizationApprovalRequest = {},
  idempotencyKey = body.idempotency_key || `opt-approve-${crypto.randomUUID()}`,
): Promise<AgentHarnessOptimizationDetail> {
  const response = await client.approveOptimizationCandidate(sessionId, candidateId, body, idempotencyKey);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, null, sessionId, response.schemaSetRevision);
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
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  return assertDetail(response.payload.detail ?? response.payload, null, sessionId, response.schemaSetRevision);
}

export async function getAgentOptimizationEvents(
  sessionId: string,
  lastEventId = "0",
): Promise<AgentHarnessOptimizationSessionEventsResponse> {
  const requestedAfter = Number(lastEventId);
  if (!Number.isSafeInteger(requestedAfter) || requestedAfter < 0)
    throw contractError("invalid_event_sequence", "Optimization event cursor is invalid.", "/headers/Last-Event-ID");
  const response = await client.optimizationEvents(sessionId, lastEventId);
  assertOptimizationMetadata(response.schemaSetRevision, response.apiVersion);
  if (
    !Array.isArray(response.payload.events) ||
    response.payload.session_id !== sessionId ||
    typeof response.payload.terminal !== "boolean"
  )
    throw contractError("invalid_optimization_events", "Optimization events are not a bounded local-dev response.");
  assertOptimizationProvenance(response.payload.provenance);
  let previous = requestedAfter;
  for (const event of response.payload.events)
    previous =
      (assertOptimizationEvent(event, sessionId, previous), (event as Record<string, unknown>).sequence as number);
  if (response.payload.after_sequence !== requestedAfter)
    throw contractError(
      "event_sequence_gap",
      "Optimization event replay cursor does not match the request.",
      "/after_sequence",
    );
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
  const after = options.lastEventSequence ?? 0;
  if (!Number.isSafeInteger(after) || after < 0)
    throw contractError("invalid_event_sequence", "Optimization event cursor is invalid.", "/last_event_sequence");
  const response = await fetch(`${apiRoots()[0]}${client.optimizationEventStream(sessionId)}`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream", ...(after ? { "Last-Event-ID": String(after) } : {}) },
    signal: options.signal,
  });
  if (!response.ok) await parseResponse<never>(response);
  if (!response.body || !(response.headers.get("content-type") || "").includes("text/event-stream"))
    throw contractError("sse_unavailable", "Optimization event stream is unavailable.");
  const revision = response.headers.get("x-tilesim-schema-set-revision") || "";
  const apiVersion = response.headers.get("x-tilesim-api-version") || "";
  // The stream is advisory, but frames still need the same contract metadata
  // as the JSON endpoints.  Do not pass arbitrary JSON from an SSE response
  // into the task panel.
  assertOptimizationMetadata(revision, apiVersion);
  let lastSequence = after;
  let sawTerminal = false;
  const seenEvents = new Map<number, string>();
  for await (const frame of readSseFrames(response)) {
    if (!frame.data) {
      if (frame.event !== "terminal") throw contractError("invalid_event", "Optimization event frame is empty.");
      continue;
    }
    const value = parseJsonLossless(frame.data);
    if (frame.event === "terminal") {
      assertOptimizationTerminal(value, sessionId, lastSequence);
      sawTerminal = true;
      continue;
    }
    if (frame.event !== "workflow" && !OPTIMIZATION_AGENT_EVENT_NAMES.has(frame.event))
      throw contractError("invalid_event", "Optimization event type is not published.");
    const duplicateSequence =
      frame.event !== "workflow" &&
      isRecord(value) &&
      typeof value.sequence === "number" &&
      seenEvents.has(value.sequence);
    const event = assertOptimizationEvent(
      value,
      sessionId,
      duplicateSequence ? (value.sequence as number) - 1 : lastSequence,
    );
    if (frame.event !== "workflow" && event.node !== frame.event)
      throw contractError("invalid_event", "Named optimization event does not match its node.", "/events/node");
    // The Bridge emits a workflow compatibility frame and, for Agent
    // diagnostics, an additive named frame for the same durable event.  Both
    // carry the same sequence; forward only the first one and fail closed if
    // a duplicate sequence carries different identity data.
    const fingerprint = `${event.event_id}|${event.node}|${event.state}|${event.payload_digest}`;
    const previousFingerprint = seenEvents.get(event.sequence as number);
    if (previousFingerprint !== undefined) {
      if (previousFingerprint !== fingerprint)
        throw contractError(
          "event_sequence_duplicate",
          "Optimization event sequence was reused with different data.",
          "/events/sequence",
        );
      continue;
    }
    seenEvents.set(event.sequence as number, fingerprint);
    lastSequence = event.sequence as number;
    options.onEvent?.(event);
  }
  if (!sawTerminal)
    throw contractError(
      "incomplete_optimization_stream",
      "Optimization event stream ended before a terminal state was published.",
      "/events/terminal",
    );
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
