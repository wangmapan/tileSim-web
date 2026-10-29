import type { AgentIntentRequest, AgentIntentResponse } from "../../contracts/bridge-api";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../contracts/generated/bridge-contracts";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import {
  agentIntentRequest as validateAgentIntentRequest,
  agentIntentResponse as validateAgentIntentResponse,
} from "../../contracts/generated/agent-intent-validators.js";
import { apiRequestWithMetadata } from "./transport";
import { agentPageDirectory } from "../../entities/navigation/model";

export const AGENT_INTENT_PROTOCOL = "tilesim.agent_intent.v1" as const;
export const AGENT_INTENT_REQUEST_SCHEMA = "tilesim.agent_intent.request.v1" as const;
export const AGENT_INTENT_RESPONSE_SCHEMA = "tilesim.agent_intent.response.v1" as const;
export const AGENT_INTENT_CONTRACT_REVISION = "2026-10-28.agent-intent.v1" as const;

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
  options: { signal?: AbortSignal; sessionId?: string } = {},
): Promise<AgentIntentResponse | null> {
  const sessionHeader = options.sessionId?.trim();
  if (
    !isRecord(request) ||
    request.schema_identity !== AGENT_INTENT_REQUEST_SCHEMA ||
    request.contract_revision !== AGENT_INTENT_CONTRACT_REVISION ||
    request.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION ||
    !publishedPageCatalog(request.page_catalog) ||
    !validateAgentIntentRequest(request) ||
    (sessionHeader !== undefined && sessionHeader !== request.session_id)
  )
    return null;
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
    if (schemaSetRevision !== BRIDGE_SCHEMA_SET_REVISION || apiVersion !== "tilesim.bridge.api.v1") return null;
    return closedWorldResponse(payload, request);
  } catch {
    return null;
  }
}
