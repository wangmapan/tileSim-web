import type { AgentIntentRequest, AgentIntentResponse } from "../../contracts/bridge-api";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../contracts/generated/bridge-contracts";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import {
  agentIntentRequest as validateAgentIntentRequest,
  agentIntentResponse as validateAgentIntentResponse,
} from "../../contracts/generated/agent-intent-validators.js";
import { apiRequestWithMetadata } from "./transport";
import { BridgeApiError } from "./errors";
import { agentPageDirectory } from "../../entities/navigation/model";

export const AGENT_INTENT_PROTOCOL = "tilesim.agent_intent.v1" as const;
export const AGENT_INTENT_REQUEST_SCHEMA = "tilesim.agent_intent.request.v1" as const;
export const AGENT_INTENT_RESPONSE_SCHEMA = "tilesim.agent_intent.response.v1" as const;
export const AGENT_INTENT_CONTRACT_REVISION = "2026-10-28.agent-intent.v1" as const;

export type AgentIntentFailureKind =
  "preflight_request_invalid" | "schema_revision_mismatch" | "invalid_response" | "bridge_error" | "transport_failure";

/**
 * A bounded failure summary for optional diagnostics.
 *
 * This intentionally carries no request, response, error message, or request
 * id.  The intent request can contain user-authored text and the Bridge error
 * response may contain provider-facing details, so callers only get the
 * stable failure class, a bounded structured code, and transport metadata.
 */
export interface AgentIntentFailureDiagnostic {
  readonly kind: AgentIntentFailureKind;
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;
}

export type AgentIntentFailure = AgentIntentFailureDiagnostic;

export interface AgentIntentRequestOptions {
  signal?: AbortSignal;
  sessionId?: string;
  onFailure?: (failure: AgentIntentFailureDiagnostic) => void;
}

function reportFailure(options: AgentIntentRequestOptions, failure: AgentIntentFailureDiagnostic): void {
  try {
    options.onFailure?.(failure);
  } catch {
    // Diagnostics are observability only; a caller's callback must not change
    // the fail-closed return behaviour of the request.
  }
}

function safeStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function safeCode(value: unknown): string {
  // Codes are response-controlled too. Only the endpoint's published failure
  // codes and transport-generated HTTP codes may leave this boundary.
  const knownCodes = [
    "agent_intent_provider_timeout",
    "agent_intent_provider_unavailable",
    // Older Bridges used the assistant-model error names for this endpoint.
    // Keep them bounded and actionable during a rolling frontend/Bridge update.
    "assistant_model_timeout",
    "assistant_model_unavailable",
    "invalid_agent_intent_request",
    "invalid_assistant_model_session",
    "non_json_response",
  ];
  return typeof value === "string" && (knownCodes.includes(value) || /^http_[1-5][0-9]{2}$/.test(value))
    ? value
    : "bridge_error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function closedWorldResponse(value: AgentIntentResponse, request: AgentIntentRequest): AgentIntentResponse {
  if (!validateAgentIntentResponse(value)) throw new Error("agent intent response does not match the published schema");
  if (
    value.schema_identity !== AGENT_INTENT_RESPONSE_SCHEMA ||
    value.contract_revision !== AGENT_INTENT_CONTRACT_REVISION ||
    value.protocol !== AGENT_INTENT_PROTOCOL ||
    value.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION
  )
    throw new Error("agent intent identity mismatch");
  if (
    value.session_id !== request.session_id ||
    value.current_page_id !== request.current_page.page_id ||
    value.current_context_revision !== request.current_page.context_revision ||
    value.user_goal !== request.user_goal ||
    value.run_id !== request.run_id ||
    value.run_context_revision !== request.run_context_revision ||
    value.input_snapshot_digest !== request.input_snapshot_digest ||
    stableJson(value.backend_identity) !== stableJson(request.backend_identity)
  )
    throw new Error("agent intent binding mismatch");
  const pages = new Map(request.page_catalog.map((page) => [page.page_id, page]));
  const candidateIds = new Set<string>();
  if (
    !Array.isArray(value.candidate_pages) ||
    value.candidate_pages.some((candidate) => {
      if (candidateIds.has(candidate.page_id)) return true;
      candidateIds.add(candidate.page_id);
      const page = pages.get(candidate.page_id);
      return (
        !page ||
        page.route_name !== candidate.route_name ||
        candidate.required_capabilities.some((capability) => !page.capability_ids.includes(capability))
      );
    })
  )
    throw new Error("agent intent candidate page outside catalog");
  const capabilities = new Set(request.page_catalog.flatMap((page) => page.capability_ids));
  if (
    !Array.isArray(value.required_capabilities) ||
    value.required_capabilities.some((capability) => !capabilities.has(capability))
  )
    throw new Error("agent intent capability outside catalog");
  if (!Array.isArray(value.suggested_steps) || !Array.isArray(value.clarification_questions))
    throw new Error("agent intent output malformed");
  return value;
}

function publishedPageCatalog(value: AgentIntentRequest["page_catalog"]): boolean {
  // This function is intentionally called before the generated validator so
  // that a caller cannot make us inspect an untrusted catalog.  Keep the
  // preflight total: malformed JavaScript callers may pass `undefined`, a
  // scalar, or an oversized list even though the TypeScript type says array.
  // A malformed request must fail closed by returning false, not by throwing
  // while attempting to call `.every()`.
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  const published = new Map<string, (typeof agentPageDirectory)[number]>(
    agentPageDirectory.map((page) => [page.page_id, page]),
  );
  return value.every((page) => {
    if (
      !isRecord(page) ||
      typeof page.page_id !== "string" ||
      typeof page.route_name !== "string" ||
      typeof page.supports_run !== "boolean" ||
      !Array.isArray(page.capability_ids)
    )
      return false;
    const entry = published.get(page.page_id);
    return Boolean(
      entry &&
      page.route_name === entry.route_name &&
      page.supports_run === entry.supports_run &&
      page.capability_ids.length === entry.capability_ids.length &&
      page.capability_ids.every((capability) => (entry.capability_ids as readonly string[]).includes(capability)),
    );
  });
}

export async function requestAgentIntent(
  request: AgentIntentRequest,
  options: AgentIntentRequestOptions = {},
): Promise<AgentIntentResponse | null> {
  const sessionHeader = typeof options.sessionId === "string" ? options.sessionId.trim() : undefined;
  let validRequest: boolean;
  try {
    validRequest =
      isRecord(request) &&
      request.schema_identity === AGENT_INTENT_REQUEST_SCHEMA &&
      request.contract_revision === AGENT_INTENT_CONTRACT_REVISION &&
      request.schema_set_revision === BRIDGE_SCHEMA_SET_REVISION &&
      publishedPageCatalog(request.page_catalog) &&
      validateAgentIntentRequest(request) &&
      (sessionHeader === undefined || sessionHeader === request.session_id);
  } catch {
    validRequest = false;
  }
  if (!validRequest) {
    reportFailure(options, {
      kind: "preflight_request_invalid",
      code: "preflight_request_invalid",
      status: null,
      retryable: false,
    });
    return null;
  }
  try {
    const { payload, schemaSetRevision, apiVersion } = await apiRequestWithMetadata<AgentIntentResponse>(
      bridgePaths.agentIntent(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionHeader ? { "X-TileSim-Assistant-Session": sessionHeader } : {}),
        },
        body: JSON.stringify(request),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (schemaSetRevision !== BRIDGE_SCHEMA_SET_REVISION || apiVersion !== "tilesim.bridge.api.v1") {
      reportFailure(options, {
        kind: "schema_revision_mismatch",
        code: "schema_revision_mismatch",
        status: null,
        retryable: false,
      });
      return null;
    }
    try {
      return closedWorldResponse(payload, request);
    } catch {
      reportFailure(options, {
        kind: "invalid_response",
        code: "invalid_response",
        status: null,
        retryable: false,
      });
      return null;
    }
  } catch (error) {
    if (error instanceof BridgeApiError) {
      if (error.code === "non_json_response") {
        reportFailure(options, {
          kind: "invalid_response",
          code: "invalid_response",
          status: safeStatus(error.status),
          retryable: false,
        });
        return null;
      }
      reportFailure(options, {
        kind: "bridge_error",
        code: safeCode(error.code),
        status: safeStatus(error.status),
        retryable: error.retryable,
      });
    } else if (error instanceof SyntaxError) {
      reportFailure(options, {
        kind: "invalid_response",
        code: "invalid_response",
        status: null,
        retryable: false,
      });
    } else {
      reportFailure(options, {
        kind: "transport_failure",
        code: "transport_failure",
        status: null,
        retryable: !options.signal?.aborted,
      });
    }
    return null;
  }
}
