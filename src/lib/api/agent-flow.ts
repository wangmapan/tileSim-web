import type {
  AgentFlowArtifactBinding,
  AgentFlowNavigationObservation as GeneratedAgentFlowNavigationObservation,
  AgentFlowEvent,
  AgentFlowIdentityBinding,
  AgentFlowResumeRequest,
  AgentFlowResumeResponse,
  AgentFlowRevokeRequest,
  AgentFlowRevokeResponse,
  AgentFlowStartRequest,
  AgentFlowStartResponse,
  AgentFlowState,
  AgentFlowStatusResponse,
  AgentFlowEventsResponse,
} from "../../contracts/generated/bridge-contracts";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../contracts/generated/bridge-contracts";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { BridgeApiError } from "./errors";
import { readSseFrames } from "./sse";
import { apiRequestWithMetadata, apiRoots, isRecord, parseResponse } from "./transport";
import { agentPageDirectory } from "../../entities/navigation/model";
import {
  agentFlowEventsResponse as validateAgentFlowEventsResponse,
  agentFlowEvent as validateAgentFlowEventSchema,
  agentFlowResumeRequest as validateAgentFlowResumeRequest,
  agentFlowResumeResponse as validateAgentFlowResumeResponse,
  agentFlowRevokeRequest as validateAgentFlowRevokeRequest,
  agentFlowRevokeResponse as validateAgentFlowRevokeResponse,
  agentFlowStartRequest as validateAgentFlowStartRequest,
  agentFlowStartResponse as validateAgentFlowStartResponse,
  agentFlowStatusResponse as validateAgentFlowStatusResponse,
  agentFlowState as validateAgentFlowStateSchema,
} from "../../contracts/generated/agent-flow-validators.js";

export const AGENT_FLOW_SCHEMA_IDENTITY = "tilesim.agent_flow.state.v1" as const;
export const AGENT_FLOW_EVENT_SCHEMA_IDENTITY = "tilesim.agent_flow.event.v1" as const;
export const AGENT_FLOW_START_SCHEMA_IDENTITY = "tilesim.agent_flow.start_request.v1" as const;
export const AGENT_FLOW_RESUME_SCHEMA_IDENTITY = "tilesim.agent_flow.resume_request.v1" as const;
export const AGENT_FLOW_REVOKE_SCHEMA_IDENTITY = "tilesim.agent_flow.revoke_request.v1" as const;
export const AGENT_FLOW_API_VERSION = "tilesim.bridge.api.v1" as const;
export const AGENT_FLOW_CONTRACT_REVISION = "2026-10-28.flow.v2" as const;
/** Canonical revision emitted from bridge/contracts by the generator. */
export const AGENT_FLOW_SCHEMA_SET_REVISION = BRIDGE_SCHEMA_SET_REVISION;
export const AGENT_FLOW_SCOPES =
  "agent:start_flow,agent:read_flow,agent:resume_flow,agent:read_run,agent:read_evidence";

export type AgentFlowStatus = AgentFlowState["status"];
export type AgentFlowAction = AgentFlowResumeRequest["action"];
export type AgentFlowBinding = AgentFlowIdentityBinding;
export type AgentFlowArtifact = AgentFlowArtifactBinding;
export type AgentFlowStart = AgentFlowStartRequest;
export type AgentFlowResume = AgentFlowResumeRequest;
export type AgentFlowEvidenceStatus =
  "validated" | "deterministic_fallback" | "partial" | "truncated" | "missing" | "provider_unavailable";
export type AgentFlowReportStatus = "not_started" | "ready" | "ready_with_limitations" | "not_applicable";
export type AgentFlowPendingAction = NonNullable<AgentFlowState["pending_action"]>;

/**
 * The resume endpoint is a durable mutation. Keep the key for one exact
 * request so a response lost after the Bridge committed can be replayed with
 * the same Idempotency-Key instead of issuing a second transition.
 */
export interface AgentFlowResumeIdempotencyState {
  request_digest: string;
  key: string;
}
export type {
  AgentFlowArtifactBinding,
  AgentFlowEvent,
  AgentFlowIdentityBinding,
  AgentFlowResumeRequest,
  AgentFlowResumeResponse,
  AgentFlowRevokeRequest,
  AgentFlowRevokeResponse,
  AgentFlowStartRequest,
  AgentFlowStartResponse,
  AgentFlowState,
  AgentFlowStatusResponse,
  AgentFlowEventsResponse,
};
export type AgentFlowNavigationObservation = GeneratedAgentFlowNavigationObservation;

const SCHEMA_SET_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ARTIFACT_SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ARTIFACT_BYTES_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const FLOW_RESUME_IDEMPOTENCY_PREFIX = "flow-resume-";
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const AGENT_FLOW_INTENTS = [
  "explain",
  "existing_run_analysis",
  "user_report",
  "configuration_draft",
  "navigation",
  "unsupported_execution",
] as const;
const AGENT_FLOW_STATUSES = [
  "created",
  "running",
  "waiting_user",
  "completed",
  "draft_ready",
  "stale",
  "refused",
  "cancelled",
  "failed",
] as const;
const AGENT_FLOW_PENDING_ACTIONS = ["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation"] as const;
const AGENT_FLOW_EVENT_TYPES = [
  "flow_started",
  "node_started",
  "node_completed",
  "interrupt",
  "approval_required",
  "state_changed",
  "terminal",
  "error",
] as const;
// Keep the runtime closed-world set string-typed so values arriving from a
// validated JSON payload can be checked without widening or unsafe casts.
const AGENT_FLOW_PAGE_IDS: ReadonlySet<string> = new Set(agentPageDirectory.map((page) => page.page_id));

function isPublishedValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function invalidBinding(message: string, fieldPath: string): BridgeApiError {
  return flowError("invalid_flow_binding", message, fieldPath);
}

function assertArtifactBindings(value: unknown): AgentFlowArtifactBinding[] {
  if (!Array.isArray(value) || value.length > 256)
    throw invalidBinding("Flow artifact binding is incomplete.", "/binding/artifact_bindings");
  return value.map((artifact, index) => {
    const path = `/binding/artifact_bindings/${index}`;
    if (!isRecord(artifact)) throw invalidBinding("Flow artifact binding must be an object.", path);
    if (!boundedString(artifact.artifact_id, 256))
      throw invalidBinding("Artifact id is invalid.", `${path}/artifact_id`);
    if (!boundedString(artifact.schema_identity, 256))
      throw invalidBinding("Artifact schema identity is invalid.", `${path}/schema_identity`);
    if (typeof artifact.sha256 !== "string" || !ARTIFACT_SHA256_PATTERN.test(artifact.sha256))
      throw invalidBinding("Artifact sha256 is invalid.", `${path}/sha256`);
    if (typeof artifact.bytes !== "string" || !ARTIFACT_BYTES_PATTERN.test(artifact.bytes))
      throw invalidBinding("Artifact bytes are invalid.", `${path}/bytes`);
    const unknown = Object.keys(artifact).filter(
      (key) => !["artifact_id", "schema_identity", "sha256", "bytes"].includes(key),
    );
    if (unknown.length)
      throw invalidBinding("Flow artifact binding contains an unknown field.", `${path}/${unknown[0]}`);
    return artifact as unknown as AgentFlowArtifactBinding;
  });
}

function assertBindingShape(value: unknown): AgentFlowBinding {
  if (!isRecord(value)) throw invalidBinding("Flow identity binding is incomplete.", "/binding");
  const allowed = [
    "session_id",
    "flow_id",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "schema_set_revision",
    "input_snapshot_digest",
    "artifact_bindings",
  ];
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw invalidBinding("Flow identity binding contains an unknown field.", `/binding/${unknown[0]}`);
  for (const field of allowed) {
    if (!hasOwn(value, field)) throw invalidBinding("Flow identity binding is incomplete.", `/binding/${field}`);
  }
  if (!boundedString(value.session_id, 128))
    throw invalidBinding("Flow session identity is invalid.", "/binding/session_id");
  if (value.flow_id !== null && !boundedString(value.flow_id, 128))
    throw invalidBinding("Flow id identity is invalid.", "/binding/flow_id");
  if (value.run_id !== null && !boundedString(value.run_id, 128))
    throw invalidBinding("Run id identity is invalid.", "/binding/run_id");
  if (value.run_context_revision !== null && !boundedString(value.run_context_revision, 256))
    throw invalidBinding("Run context revision is invalid.", "/binding/run_context_revision");
  if ((value.run_id === null) !== (value.run_context_revision === null))
    throw invalidBinding("run_id and run_context_revision must be supplied together.", "/binding");
  if (!isRecord(value.backend_identity))
    throw invalidBinding("Backend identity is invalid.", "/binding/backend_identity");
  if (typeof value.schema_set_revision !== "string" || !SCHEMA_SET_REVISION_PATTERN.test(value.schema_set_revision))
    throw invalidBinding("Schema-set revision is invalid.", "/binding/schema_set_revision");
  if (
    value.input_snapshot_digest !== null &&
    (typeof value.input_snapshot_digest !== "string" || !SCHEMA_SET_REVISION_PATTERN.test(value.input_snapshot_digest))
  )
    throw invalidBinding("Input snapshot digest is invalid.", "/binding/input_snapshot_digest");
  const artifactBindings = assertArtifactBindings(value.artifact_bindings);
  return { ...(value as unknown as AgentFlowBinding), artifact_bindings: artifactBindings };
}

function flowError(code: string, message: string, fieldPath: string | null = null): BridgeApiError {
  return new BridgeApiError(message, { status: 0, code, fieldPath, retryable: false, terminalFailure: true });
}

const NAVIGATION_FAILURE_TYPES: ReadonlySet<string | null> = new Set([
  null,
  "navigation_error",
  "context_unavailable",
  "context_invalid",
  "page_mismatch",
  "capability_missing",
  "stale_identity",
]);

function assertNavigationObservation(
  value: unknown,
  fieldPath: string,
  allowedPages?: readonly string[],
  maxAttempts?: number,
) {
  if (!isRecord(value)) throw flowError("invalid_flow_payload", "Flow navigation observation is invalid.", fieldPath);
  const required = [
    "target_page",
    "actual_page",
    "page_correct",
    "current_page_capabilities",
    "current_run_id",
    "current_context_revision",
    "failure_type",
    "retry_allowed",
    "visited_pages",
    "navigation_attempts",
  ];
  const unknown = Object.keys(value).filter((key) => !required.includes(key));
  if (unknown.length)
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation observation contains an unknown field.",
      `${fieldPath}/${unknown[0]}`,
    );
  const target = value.target_page;
  const actual = value.actual_page;
  if (typeof target !== "string" || !AGENT_FLOW_PAGE_IDS.has(target))
    throw flowError("invalid_flow_payload", "Flow navigation target is not published.", `${fieldPath}/target_page`);
  if (actual !== null && (typeof actual !== "string" || !AGENT_FLOW_PAGE_IDS.has(actual)))
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation actual page is not published.",
      `${fieldPath}/actual_page`,
    );
  if (
    allowedPages &&
    (!allowedPages.includes(target) ||
      (value.visited_pages instanceof Array &&
        value.visited_pages.some((page) => !allowedPages.includes(String(page)))))
  )
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation page is outside the authorization list.",
      `${fieldPath}/target_page`,
    );
  if (typeof value.page_correct !== "boolean" || typeof value.retry_allowed !== "boolean")
    throw flowError("invalid_flow_payload", "Flow navigation booleans are invalid.", fieldPath);
  const capabilities = value.current_page_capabilities;
  if (
    !Array.isArray(capabilities) ||
    capabilities.length > 32 ||
    capabilities.some((item) => typeof item !== "string" || !item || item.length > 128) ||
    new Set(capabilities).size !== capabilities.length
  )
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation capabilities are invalid.",
      `${fieldPath}/current_page_capabilities`,
    );
  const visited = value.visited_pages;
  if (
    !Array.isArray(visited) ||
    visited.length > 8 ||
    visited.some((page) => typeof page !== "string" || !AGENT_FLOW_PAGE_IDS.has(page)) ||
    new Set(visited).size !== visited.length
  )
    throw flowError("invalid_flow_payload", "Flow navigation visited pages are invalid.", `${fieldPath}/visited_pages`);
  const attempts = value.navigation_attempts;
  if (
    typeof attempts !== "number" ||
    !Number.isSafeInteger(attempts) ||
    attempts < 0 ||
    attempts > 8 ||
    attempts !== visited.length ||
    !visited.includes(target) ||
    (maxAttempts !== undefined && attempts > maxAttempts)
  )
    throw flowError(
      "invalid_event_sequence",
      "Flow navigation attempt count is invalid.",
      `${fieldPath}/navigation_attempts`,
    );
  if (
    value.current_run_id !== null &&
    (typeof value.current_run_id !== "string" || !value.current_run_id || value.current_run_id.length > 128)
  )
    throw flowError("invalid_flow_payload", "Flow navigation run identity is invalid.", `${fieldPath}/current_run_id`);
  if (
    value.current_context_revision !== null &&
    (typeof value.current_context_revision !== "string" ||
      !value.current_context_revision ||
      value.current_context_revision.length > 256)
  )
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation context revision is invalid.",
      `${fieldPath}/current_context_revision`,
    );
  const failureType = value.failure_type;
  if (
    (typeof failureType !== "string" && failureType !== null) ||
    !NAVIGATION_FAILURE_TYPES.has(failureType as string | null)
  )
    throw flowError(
      "invalid_flow_payload",
      "Flow navigation failure type is not published.",
      `${fieldPath}/failure_type`,
    );
  if (value.page_correct && (actual !== target || value.failure_type !== null))
    throw flowError("invalid_flow_payload", "Correct navigation must match its target without a failure.", fieldPath);
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

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw flowError("crypto_unavailable", "SHA-256 is unavailable for flow resume retry.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Derives a bounded, deterministic key from the complete resume payload. The
 * payload includes flow/action/current_event_sequence, so a changed cursor,
 * action, binding, or clarification is a new mutation; an exact retry gets
 * the same key. The digest also avoids putting user text or identity details
 * into the HTTP header and remains within the Bridge's 8..128 character bound.
 */
export async function agentFlowResumeIdempotencyState(
  request: AgentFlowResumeRequest,
  previous: AgentFlowResumeIdempotencyState | null = null,
): Promise<AgentFlowResumeIdempotencyState> {
  const requestDigest = await sha256Hex(stable(request));
  if (previous?.request_digest === requestDigest) return previous;
  return { request_digest: requestDigest, key: `${FLOW_RESUME_IDEMPOTENCY_PREFIX}${requestDigest}` };
}

function assertBinding(
  value: unknown,
  expected?: AgentFlowBinding | null,
  expectedSchemaRevision: string | null = AGENT_FLOW_SCHEMA_SET_REVISION,
): AgentFlowBinding {
  const binding = assertBindingShape(value);
  if (expectedSchemaRevision && binding.schema_set_revision !== expectedSchemaRevision)
    throw flowError(
      "schema_revision_mismatch",
      "Flow binding schema-set revision is stale.",
      "/binding/schema_set_revision",
    );
  if (expected && stable(binding) !== stable(expected))
    throw flowError("stale_binding", "Flow binding is stale.", "/binding");
  return binding;
}

function assertState(
  value: unknown,
  expected?: AgentFlowBinding | null,
  expectedSchemaRevision: string | null = AGENT_FLOW_SCHEMA_SET_REVISION,
): AgentFlowState {
  if (!isRecord(value) || value.schema_identity !== AGENT_FLOW_SCHEMA_IDENTITY)
    throw flowError(
      "schema_identity_mismatch",
      "Flow state schema identity is not published.",
      "/flow/schema_identity",
    );
  if (value.contract_revision !== AGENT_FLOW_CONTRACT_REVISION)
    throw flowError("contract_revision_mismatch", "Flow contract revision is stale.", "/flow/contract_revision");
  if (!boundedString(value.flow_id, 128) || !boundedString(value.session_id, 128))
    throw flowError("invalid_flow_payload", "Flow state identity is incomplete.", "/flow");
  if (!boundedString(value.principal, 128))
    throw flowError("invalid_flow_payload", "Flow principal identity is invalid.", "/flow/principal");
  if (!boundedString(value.workspace_id, 128))
    throw flowError("invalid_flow_payload", "Flow workspace identity is invalid.", "/flow/workspace_id");
  if (!isPublishedValue(value.intent, AGENT_FLOW_INTENTS))
    throw flowError("invalid_flow_payload", "Flow intent is not published.", "/flow/intent");
  if (!isPublishedValue(value.status, AGENT_FLOW_STATUSES))
    throw flowError("invalid_flow_payload", "Flow status is not published.", "/flow/status");
  if (
    ["completed", "draft_ready", "stale", "refused", "cancelled", "failed"].includes(String(value.status)) &&
    value.pending_action !== null
  )
    throw flowError(
      "invalid_flow_payload",
      "Terminal flow state cannot carry a pending action.",
      "/flow/pending_action",
    );
  const unknownStateKeys = Object.keys(value).filter(
    (key) =>
      ![
        "schema_identity",
        "contract_revision",
        "flow_id",
        "session_id",
        "principal",
        "workspace_id",
        "intent",
        "status",
        "node",
        "event_sequence",
        "binding",
        "pending_action",
        "approval",
        "authorization",
        "validation",
        "evidence",
        "report",
        "terminal_reason",
        "checkpoint_id",
        "created_at",
        "updated_at",
        "current_page",
        "current_page_capabilities",
        "current_context_revision",
        "required_capabilities",
        "allowed_pages",
        "allowed_actions",
        "visited_pages",
        "navigation_attempts",
        "max_navigation_attempts",
        "navigation_failures",
        "last_navigation_observation",
        "navigation_target",
      ].includes(key),
  );
  if (unknownStateKeys.length)
    throw flowError("invalid_flow_payload", "Flow state contains an unknown field.", `/flow/${unknownStateKeys[0]}`);
  if (value.authorization !== null && value.authorization !== undefined) {
    if (!isRecord(value.authorization))
      throw flowError("invalid_flow_payload", "Flow authorization is invalid.", "/flow/authorization");
    const authorizationKeys = ["status", "authorization_id", "authorization_digest", "budget", "usage", "remaining"];
    const unknownAuthorizationKeys = Object.keys(value.authorization).filter((key) => !authorizationKeys.includes(key));
    if (unknownAuthorizationKeys.length)
      throw flowError("invalid_flow_payload", "Flow authorization contains an unknown field.", `/flow/authorization/${unknownAuthorizationKeys[0]}`);
    if (!isPublishedValue(value.authorization.status, ["active", "revoked", "expired", "exhausted"] as const))
      throw flowError("invalid_flow_payload", "Flow authorization status is invalid.", "/flow/authorization/status");
    if (!boundedString(value.authorization.authorization_id, 128) || !/^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.authorization.authorization_id))
      throw flowError("invalid_flow_payload", "Flow authorization id is invalid.", "/flow/authorization/authorization_id");
    if (typeof value.authorization.authorization_digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value.authorization.authorization_digest))
      throw flowError("invalid_flow_payload", "Flow authorization digest is invalid.", "/flow/authorization/authorization_digest");
    for (const section of ["budget", "usage", "remaining"] as const) {
      if (!isRecord(value.authorization[section]))
        throw flowError("invalid_flow_payload", "Flow authorization budget section is invalid.", `/flow/authorization/${section}`);
    }
  }
  const navigationPages = ["current_page", "navigation_target"] as const;
  for (const field of navigationPages) {
    const page = value[field];
    if (page !== undefined && page !== null && (typeof page !== "string" || !AGENT_FLOW_PAGE_IDS.has(page)))
      throw flowError("invalid_flow_payload", "Flow navigation page is not published.", `/flow/${field}`);
  }
  for (const field of ["allowed_pages", "visited_pages"] as const) {
    const pages = value[field];
    if (
      pages !== undefined &&
      (!Array.isArray(pages) ||
        pages.length > (field === "visited_pages" ? 8 : 32) ||
        pages.some((page) => typeof page !== "string" || !AGENT_FLOW_PAGE_IDS.has(page)) ||
        new Set(pages).size !== pages.length)
    )
      throw flowError("invalid_flow_payload", "Flow navigation page list is not published.", `/flow/${field}`);
  }
  for (const field of ["current_page_capabilities", "required_capabilities", "allowed_actions"] as const) {
    const values = value[field];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length > 32 ||
        values.some((item) => typeof item !== "string" || !item || item.length > 128) ||
        new Set(values).size !== values.length)
    )
      throw flowError("invalid_flow_payload", "Flow navigation capability list is invalid.", `/flow/${field}`);
  }
  for (const field of ["navigation_attempts", "max_navigation_attempts"] as const) {
    const attempts = value[field];
    if (
      attempts !== undefined &&
      (typeof attempts !== "number" || !Number.isSafeInteger(attempts) || attempts < 0 || attempts > 8)
    )
      throw flowError("invalid_event_sequence", "Flow navigation budget is invalid.", `/flow/${field}`);
  }
  if (
    typeof value.navigation_attempts === "number" &&
    typeof value.max_navigation_attempts === "number" &&
    value.navigation_attempts > value.max_navigation_attempts
  )
    throw flowError(
      "invalid_event_sequence",
      "Flow navigation attempts exceed the budget.",
      "/flow/navigation_attempts",
    );
  if (value.last_navigation_observation !== undefined && value.last_navigation_observation !== null) {
    assertNavigationObservation(
      value.last_navigation_observation,
      "/flow/last_navigation_observation",
      Array.isArray(value.allowed_pages) ? value.allowed_pages : undefined,
      typeof value.max_navigation_attempts === "number" ? value.max_navigation_attempts : undefined,
    );
  }
  if (!boundedString(value.node, 128)) throw flowError("invalid_flow_payload", "Flow node is invalid.", "/flow/node");
  if (value.pending_action !== null && !isPublishedValue(value.pending_action, AGENT_FLOW_PENDING_ACTIONS))
    throw flowError("invalid_flow_payload", "Flow pending action is not published.", "/flow/pending_action");
  for (const [field, fieldValue] of Object.entries({
    approval: value.approval,
    validation: value.validation,
    evidence: value.evidence,
    report: value.report,
  })) {
    if (fieldValue !== null && !isRecord(fieldValue))
      throw flowError("invalid_flow_payload", `Flow ${field} value is invalid.`, `/flow/${field}`);
  }
  if (
    value.terminal_reason !== null &&
    (typeof value.terminal_reason !== "string" || value.terminal_reason.length > 256)
  )
    throw flowError("invalid_flow_payload", "Flow terminal reason is invalid.", "/flow/terminal_reason");
  if (value.checkpoint_id !== null && (typeof value.checkpoint_id !== "string" || value.checkpoint_id.length > 256))
    throw flowError("invalid_flow_payload", "Flow checkpoint identity is invalid.", "/flow/checkpoint_id");
  if (
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string" ||
    !ISO_DATE_TIME_PATTERN.test(value.created_at) ||
    !ISO_DATE_TIME_PATTERN.test(value.updated_at) ||
    Number.isNaN(Date.parse(value.created_at)) ||
    Number.isNaN(Date.parse(value.updated_at))
  )
    throw flowError("invalid_flow_payload", "Flow timestamps are invalid.", "/flow/created_at");
  if (typeof value.event_sequence !== "number" || !Number.isInteger(value.event_sequence) || value.event_sequence < 0)
    throw flowError("invalid_event_sequence", "Flow state event sequence is invalid.", "/flow/event_sequence");
  const binding = assertBinding(value.binding, expected, expectedSchemaRevision);
  if (binding.flow_id !== value.flow_id || binding.session_id !== value.session_id)
    throw flowError("binding_mismatch", "Flow state and binding identity differ.", "/flow/binding");
  if (!validateAgentFlowStateSchema(value))
    throw flowError("invalid_flow_payload", "Flow state does not match the published schema.", "/flow");
  return { ...(value as unknown as AgentFlowState), binding };
}

function assertEvent(
  value: unknown,
  flowId: string,
  previous: number,
  expected?: AgentFlowBinding | null,
  expectedSchemaRevision: string = AGENT_FLOW_SCHEMA_SET_REVISION,
): AgentFlowEvent {
  if (!isRecord(value) || value.schema_identity !== AGENT_FLOW_EVENT_SCHEMA_IDENTITY)
    throw flowError(
      "schema_identity_mismatch",
      "Flow event schema identity is not published.",
      "/events/schema_identity",
    );
  if (value.contract_revision !== AGENT_FLOW_CONTRACT_REVISION)
    throw flowError(
      "contract_revision_mismatch",
      "Flow event contract revision is stale.",
      "/events/contract_revision",
    );
  if (value.flow_id !== flowId || !boundedString(value.event_id, 256))
    throw flowError("invalid_event_sequence", "Flow event identity is invalid.", "/events");
  if (!boundedString(value.session_id, 128))
    throw flowError("invalid_event_sequence", "Flow event session identity is invalid.", "/events/session_id");
  if (!boundedString(value.node, 128))
    throw flowError("invalid_event_sequence", "Flow event node is invalid.", "/events/node");
  if (!isPublishedValue(value.event_type, AGENT_FLOW_EVENT_TYPES))
    throw flowError("invalid_event_type", "Flow event type is not published.", "/events/event_type");
  const unknownEventKeys = Object.keys(value).filter(
    (key) =>
      ![
        "schema_identity",
        "contract_revision",
        "event_id",
        "sequence",
        "flow_id",
        "session_id",
        "node",
        "event_type",
        "state",
        "binding",
        "pending_action",
        "payload",
        "created_at",
      ].includes(key),
  );
  if (unknownEventKeys.length)
    throw flowError("invalid_event_type", "Flow event contains an unknown field.", `/events/${unknownEventKeys[0]}`);
  if (typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence !== previous + 1)
    throw flowError("event_sequence_gap", "Flow event sequence is not contiguous.", "/events/sequence");
  if (value.pending_action !== null && !isPublishedValue(value.pending_action, AGENT_FLOW_PENDING_ACTIONS))
    throw flowError("invalid_event_type", "Flow event pending action is not published.", "/events/pending_action");
  if (
    !isRecord(value.payload) ||
    typeof value.created_at !== "string" ||
    !ISO_DATE_TIME_PATTERN.test(value.created_at) ||
    Number.isNaN(Date.parse(value.created_at))
  )
    throw flowError("invalid_event_type", "Flow event payload is invalid.", "/events");
  const binding = assertBinding(value.binding, expected, expectedSchemaRevision);
  if (binding.flow_id !== flowId)
    throw flowError(
      "binding_mismatch",
      "Flow event binding does not match the requested flow.",
      "/events/binding/flow_id",
    );
  if (value.session_id !== binding.session_id)
    throw flowError("binding_mismatch", "Flow event and binding session identities differ.", "/events/session_id");
  const state = assertState(value.state, binding, expectedSchemaRevision);
  if (state.flow_id !== flowId)
    throw flowError("binding_mismatch", "Flow event state does not match the requested flow.", "/events/state/flow_id");
  if (state.event_sequence !== value.sequence)
    throw flowError("invalid_event_sequence", "Flow event and state sequences differ.", "/events/state/event_sequence");
  if (state.pending_action !== value.pending_action)
    throw flowError("binding_mismatch", "Flow event and state pending actions differ.", "/events/pending_action");
  if (!validateAgentFlowEventSchema(value))
    throw flowError("invalid_event_type", "Flow event does not match the published schema.", "/events");
  return { ...(value as unknown as AgentFlowEvent), binding, state };
}

function requestHeaders(extra: Record<string, string | undefined> = {}): Record<string, string> {
  const headers: Record<string, string> = { "X-TileSim-Scopes": AGENT_FLOW_SCOPES };
  for (const [key, value] of Object.entries(extra)) if (value) headers[key] = value;
  return headers;
}

function assertResponseMetadata(revision: string, apiVersion: string, expectedRevision: string): void {
  if (apiVersion !== AGENT_FLOW_API_VERSION)
    throw flowError("unsupported_api_contract", "Flow API version is not published.", "/api_version");
  if (expectedRevision !== AGENT_FLOW_SCHEMA_SET_REVISION || !revision || revision !== AGENT_FLOW_SCHEMA_SET_REVISION)
    throw flowError("schema_revision_mismatch", "Flow response schema-set revision is stale.", "/schema_set_revision");
}

function assertResponseEnvelope(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!isRecord(value)) throw flowError("invalid_flow_payload", `${label} response is not an object.`, "/response");
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length)
    throw flowError("invalid_flow_payload", `${label} response contains an unknown field.`, `/response/${unknown[0]}`);
  for (const key of keys) {
    if (!hasOwn(value, key))
      throw flowError("invalid_flow_payload", `${label} response is missing a field.`, `/response/${key}`);
  }
  return value;
}

function assertBooleanEnvelopeField(value: Record<string, unknown>, key: string): boolean {
  if (typeof value[key] !== "boolean")
    throw flowError("invalid_flow_payload", `Flow response ${key} is invalid.`, `/response/${key}`);
  return value[key] as boolean;
}

function assertGeneratedFlowSchema(
  validator: (value: unknown) => boolean,
  value: unknown,
  label: string,
  fieldPath = "/response",
): void {
  if (!validator(value))
    throw flowError("invalid_flow_payload", `${label} does not match the published schema.`, fieldPath);
}

function assertEventsEnvelopeField(value: Record<string, unknown>): AgentFlowEvent[] {
  if (!Array.isArray(value.events))
    throw flowError("invalid_flow_payload", "Flow response events are invalid.", "/response/events");
  return value.events as AgentFlowEvent[];
}

function assertCanonicalSchemaRevision(value: string, fieldPath: string): void {
  if (value !== AGENT_FLOW_SCHEMA_SET_REVISION)
    throw flowError("schema_revision_mismatch", "Flow schema-set revision is stale.", fieldPath);
}

function assertEventCursor(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw flowError("invalid_event_sequence", "Flow event cursor must be a non-negative integer.", fieldPath);
  return value;
}

function assertStartBinding(state: AgentFlowState, request: AgentFlowStartRequest): void {
  const expected = {
    session_id: request.session_id,
    flow_id: state.flow_id,
    run_id: request.run_id,
    run_context_revision: request.run_context_revision,
    backend_identity: request.backend_identity,
    schema_set_revision: request.schema_set_revision,
    input_snapshot_digest: request.input_snapshot_digest,
    artifact_bindings: request.artifact_bindings,
  };
  const expectedBinding = assertBindingShape(expected);
  if (state.binding.schema_set_revision !== request.schema_set_revision)
    throw flowError(
      "schema_revision_mismatch",
      "Flow response binding schema-set revision is stale.",
      "/flow/binding/schema_set_revision",
    );
  if (stable(state.binding) !== stable(expectedBinding))
    throw flowError("binding_mismatch", "Flow response identity does not match the start request.", "/flow/binding");
}

function assertTerminalConsistency(status: AgentFlowStatus, terminal: boolean, fieldPath: string): void {
  const terminalStatus = ["completed", "draft_ready", "stale", "refused", "cancelled", "failed"].includes(status);
  if (terminal !== terminalStatus)
    throw flowError("invalid_flow_payload", "Flow terminal marker does not match its status.", fieldPath);
}

export const agentFlowPaths = {
  flows: bridgePaths.startAgentFlow,
  flow: bridgePaths.getAgentFlow,
  events: bridgePaths.getAgentFlowEvents,
  stream: bridgePaths.streamAgentFlowEvents,
  resume: bridgePaths.resumeAgentFlow,
  revokeAuthorization: bridgePaths.revokeAgentFlowAuthorization,
} as const;

export async function createAgentFlow(
  request: AgentFlowStartRequest,
  idempotencyKey = `flow-start-${crypto.randomUUID()}`,
): Promise<AgentFlowState> {
  if (
    request.schema_identity !== AGENT_FLOW_START_SCHEMA_IDENTITY ||
    request.contract_revision !== AGENT_FLOW_CONTRACT_REVISION
  )
    throw flowError("contract_revision_mismatch", "Flow start request is stale.", "/contract_revision");
  assertCanonicalSchemaRevision(request.schema_set_revision, "/schema_set_revision");
  assertGeneratedFlowSchema(validateAgentFlowStartRequest, request, "Flow start request", "/request");
  const response = await apiRequestWithMetadata<AgentFlowStartResponse>(agentFlowPaths.flows(), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify(request),
  });
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion, request.schema_set_revision);
  const envelope = assertResponseEnvelope(response.payload, ["flow", "idempotent_replay"], "Flow start");
  assertBooleanEnvelopeField(envelope, "idempotent_replay");
  const flow = assertState(envelope.flow, null, null);
  assertGeneratedFlowSchema(validateAgentFlowStartResponse, envelope, "Flow start response");
  assertStartBinding(flow, request);
  return flow;
}

export async function getAgentFlow(flowId: string, binding?: AgentFlowBinding | null): Promise<AgentFlowState> {
  if (binding) assertCanonicalSchemaRevision(binding.schema_set_revision, "/binding/schema_set_revision");
  const response = await apiRequestWithMetadata<AgentFlowStatusResponse>(agentFlowPaths.flow(flowId), {
    headers: requestHeaders(),
  });
  assertResponseMetadata(
    response.schemaSetRevision,
    response.apiVersion,
    binding?.schema_set_revision || AGENT_FLOW_SCHEMA_SET_REVISION,
  );
  const envelope = assertResponseEnvelope(response.payload, ["flow"], "Flow status");
  const flow = assertState(envelope.flow, binding, binding?.schema_set_revision || AGENT_FLOW_SCHEMA_SET_REVISION);
  // The URL is part of the flow identity.  A compromised, stale, or
  // misrouted Bridge response must not hydrate a different flow merely
  // because its payload happens to satisfy the state schema.
  if (flow.flow_id !== flowId)
    throw flowError("binding_mismatch", "Flow status identity does not match the requested flow.", "/flow/flow_id");
  assertGeneratedFlowSchema(validateAgentFlowStatusResponse, envelope, "Flow status response");
  return flow;
}

export async function getAgentFlowEvents(
  flowId: string,
  afterSequence = 0,
  binding?: AgentFlowBinding | null,
): Promise<AgentFlowEventsResponse> {
  assertEventCursor(afterSequence, "/after_sequence");
  if (binding) assertCanonicalSchemaRevision(binding.schema_set_revision, "/binding/schema_set_revision");
  const response = await apiRequestWithMetadata<AgentFlowEventsResponse>(agentFlowPaths.events(flowId), {
    headers: requestHeaders({ "Last-Event-ID": String(afterSequence) }),
  });
  assertResponseMetadata(
    response.schemaSetRevision,
    response.apiVersion,
    binding?.schema_set_revision || AGENT_FLOW_SCHEMA_SET_REVISION,
  );
  const payload = assertResponseEnvelope(
    response.payload,
    ["flow", "events", "after_sequence", "terminal"],
    "Flow events",
  );
  const events = assertEventsEnvelopeField(payload);
  if (
    typeof payload.after_sequence !== "number" ||
    !Number.isSafeInteger(payload.after_sequence) ||
    payload.after_sequence < 0
  )
    throw flowError("invalid_flow_payload", "Flow response after_sequence is invalid.", "/response/after_sequence");
  const terminal = assertBooleanEnvelopeField(payload, "terminal");
  const expectedRevision = binding?.schema_set_revision || AGENT_FLOW_SCHEMA_SET_REVISION;
  const flow = assertState(payload.flow, binding, expectedRevision);
  if (payload.after_sequence !== afterSequence || flow.flow_id !== flowId)
    throw flowError("event_sequence_gap", "Flow event cursor does not match the request.", "/after_sequence");
  assertTerminalConsistency(flow.status, terminal, "/terminal");
  let previous = afterSequence;
  const checkedEvents = events.map((event) => {
    const checked = assertEvent(event, flowId, previous, flow.binding, expectedRevision);
    previous = checked.sequence;
    return checked;
  });
  if (previous !== flow.event_sequence)
    throw flowError("event_sequence_gap", "Flow events do not reach the published flow cursor.", "/events/sequence");
  assertGeneratedFlowSchema(validateAgentFlowEventsResponse, payload, "Flow events response");
  return { ...(payload as unknown as AgentFlowEventsResponse), flow, events: checkedEvents };
}

export async function resumeAgentFlow(
  flowId: string,
  request: AgentFlowResumeRequest,
  idempotencyKey = `flow-resume-${crypto.randomUUID()}`,
): Promise<AgentFlowResumeResponse> {
  if (
    request.schema_identity !== AGENT_FLOW_RESUME_SCHEMA_IDENTITY ||
    request.contract_revision !== AGENT_FLOW_CONTRACT_REVISION
  )
    throw flowError("contract_revision_mismatch", "Flow resume request is stale.", "/contract_revision");
  assertCanonicalSchemaRevision(request.current_binding.schema_set_revision, "/current_binding/schema_set_revision");
  if (request.flow_id !== flowId)
    throw flowError("flow_id_mismatch", "Flow resume id does not match the URL.", "/flow_id");
  if (request.navigation_observation)
    assertNavigationObservation(request.navigation_observation, "/navigation_observation");
  assertGeneratedFlowSchema(validateAgentFlowResumeRequest, request, "Flow resume request", "/request");
  const response = await apiRequestWithMetadata<AgentFlowResumeResponse>(agentFlowPaths.resume(flowId), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify(request),
  });
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion, request.current_binding.schema_set_revision);
  const envelope = assertResponseEnvelope(
    response.payload,
    ["flow", "events", "idempotent_replay", "action"],
    "Flow resume",
  );
  assertBooleanEnvelopeField(envelope, "idempotent_replay");
  if (!boundedString(envelope.action, 64))
    throw flowError("invalid_flow_payload", "Flow resume response action is invalid.", "/response/action");
  const expectedRevision = request.current_binding.schema_set_revision;
  const flow = assertState(envelope.flow, request.current_binding, expectedRevision);
  if (request.intent !== undefined && flow.intent !== request.intent)
    throw flowError("binding_mismatch", "Flow response intent does not match the resume request.", "/flow/intent");
  let previous = request.current_event_sequence;
  const events = assertEventsEnvelopeField(envelope).map((event) => {
    const checked = assertEvent(event, flowId, previous, flow.binding, expectedRevision);
    previous = checked.sequence;
    return checked;
  });
  if (previous !== flow.event_sequence)
    throw flowError(
      "event_sequence_gap",
      "Flow resume events do not reach the published flow cursor.",
      "/events/sequence",
    );
  if (envelope.action !== request.action)
    throw flowError("invalid_flow_payload", "Flow resume response action does not match the request.", "/action");
  assertGeneratedFlowSchema(validateAgentFlowResumeResponse, envelope, "Flow resume response");
  return { ...(envelope as unknown as AgentFlowResumeResponse), flow, events };
}

export async function revokeAgentFlowAuthorization(
  flowId: string,
  request: AgentFlowRevokeRequest,
  idempotencyKey = `flow-revoke-${crypto.randomUUID()}`,
): Promise<AgentFlowRevokeResponse> {
  if (
    request.schema_identity !== AGENT_FLOW_REVOKE_SCHEMA_IDENTITY ||
    request.contract_revision !== AGENT_FLOW_CONTRACT_REVISION
  )
    throw flowError("contract_revision_mismatch", "Flow authorization revoke request is stale.", "/contract_revision");
  assertCanonicalSchemaRevision(request.current_binding.schema_set_revision, "/current_binding/schema_set_revision");
  if (request.flow_id !== flowId)
    throw flowError("flow_id_mismatch", "Flow revoke id does not match the URL.", "/flow_id");
  assertGeneratedFlowSchema(validateAgentFlowRevokeRequest, request, "Flow authorization revoke request", "/request");
  const response = await apiRequestWithMetadata<AgentFlowRevokeResponse>(agentFlowPaths.revokeAuthorization(flowId), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify(request),
  });
  assertResponseMetadata(response.schemaSetRevision, response.apiVersion, request.current_binding.schema_set_revision);
  const envelope = assertResponseEnvelope(
    response.payload,
    ["flow", "events", "idempotent_replay", "action"],
    "Flow authorization revoke",
  );
  assertBooleanEnvelopeField(envelope, "idempotent_replay");
  if (envelope.action !== "revoke_authorization")
    throw flowError("invalid_flow_payload", "Flow revoke response action is invalid.", "/response/action");
  const expectedRevision = request.current_binding.schema_set_revision;
  const flow = assertState(envelope.flow, request.current_binding, expectedRevision);
  let previous = request.current_event_sequence;
  const events = assertEventsEnvelopeField(envelope).map((event) => {
    const checked = assertEvent(event, flowId, previous, flow.binding, expectedRevision);
    previous = checked.sequence;
    return checked;
  });
  if (previous !== flow.event_sequence)
    throw flowError("event_sequence_gap", "Flow revoke events do not reach the published flow cursor.", "/events/sequence");
  assertGeneratedFlowSchema(validateAgentFlowRevokeResponse, envelope, "Flow authorization revoke response");
  return { ...(envelope as unknown as AgentFlowRevokeResponse), flow, events };
}

export interface ObserveAgentFlowOptions {
  lastEventSequence?: number;
  signal?: AbortSignal;
  binding?: AgentFlowBinding | null;
  principal?: string;
  workspaceId?: string;
  onEvent?: (event: AgentFlowEvent) => void;
  onTerminal?: (state: AgentFlowState | null) => void;
}

export async function observeAgentFlowEvents(flowId: string, options: ObserveAgentFlowOptions = {}): Promise<void> {
  if (options.binding)
    assertCanonicalSchemaRevision(options.binding.schema_set_revision, "/binding/schema_set_revision");
  let lastSequence = options.lastEventSequence ?? 0;
  assertEventCursor(lastSequence, "/last_event_sequence");
  const response = await fetch(`${apiRoots()[0]}${agentFlowPaths.stream(flowId)}`, {
    cache: "no-store",
    headers: requestHeaders({
      Accept: "text/event-stream",
      "Last-Event-ID": lastSequence ? String(lastSequence) : undefined,
      "X-TileSim-Principal": options.principal,
      "X-TileSim-Workspace": options.workspaceId,
    }),
    signal: options.signal,
  });
  if (!response.ok) await parseResponse<never>(response);
  if (!response.body || !(response.headers.get("content-type") || "").includes("text/event-stream"))
    throw flowError("sse_unavailable", "Flow event stream is unavailable.");
  const expectedRevision = options.binding?.schema_set_revision || AGENT_FLOW_SCHEMA_SET_REVISION;
  let terminalSeen = false;
  assertResponseMetadata(
    response.headers.get("x-tilesim-schema-set-revision") || "",
    response.headers.get("x-tilesim-api-version") || "",
    expectedRevision,
  );
  for await (const frame of readSseFrames(response)) {
    // A flow frame always carries JSON data.  Ignore only comment/heartbeat
    // frames (which the parser does not yield); an id or event without data
    // is a truncated/misrouted replay and must not silently advance/close the
    // observer as if the flow had been observed successfully.
    if (!frame.data) {
      throw flowError("invalid_event_type", "Flow event stream contained an empty event frame.", "/events/data");
    }
    // A terminal frame closes this replay stream.  Do not accept a late flow
    // event (or a duplicate terminal) after it: otherwise a misordered SSE
    // producer could move the UI back from a durable terminal state and
    // re-expose a resume affordance.
    if (terminalSeen)
      throw flowError(
        "invalid_event_sequence",
        "Flow event stream contained data after its terminal frame.",
        "/events/terminal",
      );
    const value = parseJsonLossless(frame.data);
    if (frame.event === "terminal") {
      const terminalState =
        isRecord(value) && "flow" in value
          ? assertState(value.flow, options.binding, expectedRevision)
          : isRecord(value) && value.schema_identity === AGENT_FLOW_SCHEMA_IDENTITY
            ? assertState(value, options.binding, expectedRevision)
            : null;
      if (!terminalState)
        throw flowError(
          "invalid_event_type",
          "Flow terminal frame did not contain a published state.",
          "/events/terminal",
        );
      // A terminal frame is still part of the flow's replay stream. Do not
      // let an unbound/misrouted terminal payload switch the UI to another
      // flow, or move its state backwards after the last event we accepted.
      if (terminalState.flow_id !== flowId)
        throw flowError(
          "invalid_event_sequence",
          "Flow terminal state belongs to a different flow.",
          "/events/flow_id",
        );
      if (terminalState.event_sequence !== lastSequence)
        throw flowError(
          "event_sequence_gap",
          "Flow terminal state is not aligned with the last event.",
          "/events/state/event_sequence",
        );
      if (!flowIsTerminalStatus(terminalState.status))
        throw flowError(
          "invalid_flow_payload",
          "Flow terminal frame carries a non-terminal status.",
          "/events/terminal/status",
        );
      terminalSeen = true;
      options.onTerminal?.(terminalState);
      continue;
    }
    if (frame.event !== "flow")
      throw flowError("invalid_event_type", "Flow event stream contained an unknown event type.", "/events/event");
    const event = assertEvent(value, flowId, lastSequence, options.binding, expectedRevision);
    if (!/^[0-9]+$/.test(frame.id) || Number(frame.id) !== event.sequence)
      throw flowError("event_sequence_gap", "Flow SSE event id does not match its published sequence.", "/events/id");
    lastSequence = event.sequence;
    options.onEvent?.(event);
  }
}

function flowIsTerminalStatus(status: AgentFlowStatus): boolean {
  return ["completed", "draft_ready", "stale", "refused", "cancelled", "failed"].includes(status);
}
