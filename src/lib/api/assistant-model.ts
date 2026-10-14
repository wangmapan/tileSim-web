import type {
  AssistantModelCatalogueResponse,
  AssistantModelDescriptorResponse,
  AssistantModelPlanResponse,
  AssistantModelSelectionResponse,
} from "../../contracts/bridge-api";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import { isRecord, apiRoots, apiRequestWithMetadata } from "./transport";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { readSseFrames } from "./sse";

/** The protocol identity every plan from the assistant model channel must carry. */
const ASSISTANT_MODEL_PROTOCOL = "tilesim.assistant_model.v1";
/** The chat envelope identity the Bridge writes on its prose, error and done events. */
const ASSISTANT_CHAT_SCHEMA_VERSION = "tilesim.bridge.assistant_model_chat.v1";
const RESULT_ANALYSIS_CHAT_SCHEMA_VERSION = "tilesim.bridge.result_analysis_chat.v1";

/** One replayed conversation turn. Only these two roles are accepted by the Bridge. */
export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResultAnalysisContext {
  run_id: string;
  sections: readonly { title: string; body: string }[];
  evidence_paths: readonly string[];
  evidence: {
    manifest_status: "verified" | "unavailable" | "run_mismatch";
    artifact_count: number;
    full_content_count: number;
    summary_only_count: number;
    unavailable_count: number;
    rejected_count: number;
    artifacts: readonly {
      artifact_id: string;
      file_name: string;
      report_kind: string | null;
      schema_identity: string;
      sha256: string;
      bytes: string;
      contract_status: "supported" | "legacy_compatibility" | "not_applicable";
      content_status: "full" | "summary_only" | "unavailable" | "not_applicable" | "expected_absence";
      content?: unknown;
      omission_reason?: "too_large_for_model_context" | "verification_failed";
    }[];
    rejected_artifacts: readonly {
      artifact_id: string;
      schema_identity: string;
      reason: string;
      json_pointer: string;
    }[];
  };
}

/**
 * Asks the Bridge's assistant model channel for one scenario plan.
 *
 * The channel is optional on purpose. Every failure - no channel configured on
 * this Bridge (503), a Bridge that does not publish the route yet (404), a
 * transport error, a payload that is not one plan - comes back as `null`, so a
 * caller can fail closed without applying anything. Nothing here writes a
 * document or creates a run: the response is a proposal, and applying it stays
 * a user action.
 */
export async function requestAssistantPlan(
  instruction: string,
  options: { signal?: AbortSignal } = {},
): Promise<AssistantModelPlanResponse | null> {
  try {
    const { payload } = await apiRequestWithMetadata<AssistantModelPlanResponse>(bridgePaths.planAgentScenario(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return trustedPlan(payload);
  } catch {
    return null;
  }
}

/** Accepts a plan only when it claims nothing was applied and nothing was executed. */
function trustedPlan(payload: unknown): AssistantModelPlanResponse | null {
  if (!isRecord(payload)) return null;
  if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
  // A channel that claims to have written or run something is not trusted.
  if (payload.applied !== false || payload.executed !== false) return null;
  if (!Array.isArray(payload.settings)) return null;
  return payload as unknown as AssistantModelPlanResponse;
}

/**
 * Asks the Bridge whether this machine has an assistant model channel at all.
 *
 * This is what lets the panel leave a machine without a channel completely untouched: the model
 * controls are shown only when the Bridge reports a configured channel. Every failure - a Bridge that
 * does not publish the route yet, a transport error, a payload that is not one descriptor - is `null`,
 * which is read as "no channel", i.e. the panel keeps its previous behaviour.
 */
export async function fetchAssistantModelDescriptor(
  options: { signal?: AbortSignal } = {},
): Promise<AssistantModelDescriptorResponse | null> {
  try {
    const { payload } = await apiRequestWithMetadata<AssistantModelDescriptorResponse>(
      bridgePaths.assistantModelDescriptor(),
      { ...(options.signal ? { signal: options.signal } : {}) },
    );
    if (!isRecord(payload)) return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    if (payload.configured !== true) return null;
    return payload as unknown as AssistantModelDescriptorResponse;
  } catch {
    return null;
  }
}

/**
 * Reads the model identities the Bridge's assistant channel publishes.
 *
 * The list is read by the Bridge with the credential it already holds, so the key never reaches this
 * page. Like every other call on this optional channel, every failure - no channel configured on this
 * Bridge, a Bridge that does not publish the route yet, a catalogue the service would not hand over,
 * a transport error, a payload that is not one catalogue - comes back as `null`, and a panel that got
 * no catalogue simply keeps the identity it already had.
 */
export async function fetchAssistantModelCatalogue(
  options: { signal?: AbortSignal } = {},
): Promise<AssistantModelCatalogueResponse | null> {
  try {
    const { payload } = await apiRequestWithMetadata<AssistantModelCatalogueResponse>(
      bridgePaths.assistantModelCatalogue(),
      { ...(options.signal ? { signal: options.signal } : {}) },
    );
    if (!isRecord(payload)) return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    if (typeof payload.selected_model !== "string") return null;
    if (!Array.isArray(payload.models)) return null;
    const models = payload.models.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    );
    // The contract promises at least one identity, and an empty catalogue would silently empty the
    // dropdown, so a list that lost every entry on the way here is refused rather than shown.
    const [head, ...tail] = models;
    if (head === undefined) return null;
    return { ...(payload as unknown as AssistantModelCatalogueResponse), models: [head, ...tail] };
  } catch {
    return null;
  }
}

/**
 * Asks the Bridge to use one model identity from now on.
 *
 * The switch is session-scoped: it takes effect for the next answer without restarting the backend,
 * and it is forgotten when the Bridge process is restarted. A reply that claims to have written the
 * saved configuration is rejected, because the saved configuration belongs to the launcher and this
 * call is not allowed to change it. Every refusal is `null`, so a caller keeps its previous identity.
 */
export async function selectAssistantModel(
  model: string,
  options: { signal?: AbortSignal } = {},
): Promise<AssistantModelSelectionResponse | null> {
  try {
    const { payload } = await apiRequestWithMetadata<AssistantModelSelectionResponse>(
      bridgePaths.selectAssistantModel(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (!isRecord(payload)) return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    // A channel that claims to have persisted the choice, or to have made it permanent, is not trusted.
    if (payload.persisted !== false || payload.session_only !== true) return null;
    if (payload.in_force !== true) return null;
    if (typeof payload.selected_model !== "string" || !payload.selected_model) return null;
    return payload as unknown as AssistantModelSelectionResponse;
  } catch {
    return null;
  }
}

/** One event payload, or null when the frame did not carry readable JSON. */
function parseFrameData(data: string): unknown {
  try {
    return parseJsonLossless(data);
  } catch {
    return null;
  }
}

export interface AssistantChatOutcome {
  /** The answer the model wrote, in full, as the last prose event carried it. */
  answer: string;
  /** The validated plan, when the stream reached one. */
  plan: AssistantModelPlanResponse | null;
  /** A short, safe description of why the stream stopped early. Empty on success. */
  failure: string;
  /** True when the caller aborted the stream. */
  cancelled: boolean;
}

/**
 * Streams one conversation turn from the assistant model channel.
 *
 * Every visible answer delta arrives as a `prose` event carrying the answer *so far*, so the panel can
 * render the text while it is still being written, and the turn ends with one validated `plan` event.
 * The Bridge refuses an unusable request and an unconfigured channel with an ordinary JSON response
 * before the stream starts, and those - plus any transport failure before the first event - come back
 * as `null`, which lets a configuration caller fail closed without inventing a plan.
 *
 * Nothing here writes a document or creates a run, and the transcript is not persisted by the Bridge:
 * it is replayed by the caller from what the panel already shows.
 */
export async function streamAssistantChat(
  request: { messages: readonly AssistantChatMessage[]; panel_values: Readonly<Record<string, string>> },
  callbacks: {
    /**
     * Receives the whole visible answer so far, not one delta.
     *
     * This is the only callback, because it is the only thing that changes *while* the stream is open
     * and can change many times. How the turn ended is reported once, by the returned outcome.
     */
    onAnswer: (text: string) => void;
    /** Receives the validated plan as soon as it arrives, so the panel can label the answer at once. */
    onPlan: (plan: AssistantModelPlanResponse) => void;
  },
  options: { signal?: AbortSignal } = {},
): Promise<AssistantChatOutcome | null> {
  let response: Response;
  try {
    response = await fetch(`${apiRoots()[0]}${bridgePaths.streamAgentScenarioChat()}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages: request.messages, panel_values: request.panel_values }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // A cancelled request is reported as such; anything else means the channel could not be reached.
    return options.signal?.aborted ? { answer: "", plan: null, failure: "", cancelled: true } : null;
  }
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) return null;

  const outcome: AssistantChatOutcome = { answer: "", plan: null, failure: "", cancelled: false };
  try {
    for await (const frame of readSseFrames(response)) {
      if (frame.event === "prose") {
        const payload = parseFrameData(frame.data);
        if (isRecord(payload) && payload.schema_version === ASSISTANT_CHAT_SCHEMA_VERSION) {
          const text = payload.text;
          if (typeof text === "string") {
            outcome.answer = text;
            callbacks.onAnswer(text);
          }
        }
        continue;
      }
      if (frame.event === "plan") {
        const plan = trustedPlan(parseFrameData(frame.data));
        if (plan) {
          outcome.plan = plan;
          callbacks.onPlan(plan);
        }
        continue;
      }
      if (frame.event === "error") {
        const payload = parseFrameData(frame.data);
        outcome.failure =
          isRecord(payload) && typeof payload.message === "string" && payload.message
            ? payload.message
            : "模型没有答完这次请求。";
      }
    }
  } catch {
    // A stream cut mid-answer still leaves the caller with whatever prose already arrived. A stop the
    // user asked for is reported as cancelled rather than as a failure, because it is not one.
    if (options.signal?.aborted) outcome.cancelled = true;
    else if (!outcome.failure) outcome.failure = "模型回答的连接中断了。";
  }
  return outcome;
}

export interface AssistantResultAnalysisOutcome {
  answer: string;
  failure: string;
  cancelled: boolean;
}

/**
 * Streams one read-only answer about the currently verified run.  This is a
 * separate route from scenario chat because it cannot produce a parameter plan
 * and its system prompt is grounded in a bounded report projection.
 */
export async function streamAssistantResultAnalysis(
  request: {
    messages: readonly AssistantChatMessage[];
    context: AssistantResultAnalysisContext;
  },
  callbacks: { onAnswer: (text: string) => void },
  options: { signal?: AbortSignal } = {},
): Promise<AssistantResultAnalysisOutcome | null> {
  let response: Response;
  try {
    response = await fetch(`${apiRoots()[0]}${bridgePaths.streamAgentResultAnalysis()}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages: request.messages, context: request.context }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    return options.signal?.aborted ? { answer: "", failure: "", cancelled: true } : null;
  }
  if (!response.ok) {
    // A malformed evidence projection is a client/Bridge contract problem, not
    // an unavailable provider. Keep the optional-channel fallback, but retain
    // a safe diagnostic so the shell can distinguish a 400 from a network/503
    // failure without exposing the response body or any provider details.
    if (response.status === 400) {
      let code = "";
      try {
        const payload = parseJsonLossless(await response.text());
        if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.code === "string") {
          code = payload.error.code;
        }
      } catch {
        // The status itself is enough when the Bridge did not return JSON.
      }
      return {
        answer: "",
        failure: `模型请求未通过校验（${code || "HTTP 400"}）。`,
        cancelled: false,
      };
    }
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) return null;

  const outcome: AssistantResultAnalysisOutcome = { answer: "", failure: "", cancelled: false };
  try {
    for await (const frame of readSseFrames(response)) {
      if (frame.event === "prose") {
        const payload = parseFrameData(frame.data);
        if (isRecord(payload) && payload.schema_version === RESULT_ANALYSIS_CHAT_SCHEMA_VERSION) {
          const text = payload.text;
          if (typeof text === "string") {
            outcome.answer = text;
            callbacks.onAnswer(text);
          }
        }
        continue;
      }
      if (frame.event === "error") {
        const payload = parseFrameData(frame.data);
        outcome.failure =
          isRecord(payload) && typeof payload.message === "string" && payload.message
            ? payload.message
            : "模型没有答完这次结果分析。";
      }
    }
  } catch {
    if (options.signal?.aborted) outcome.cancelled = true;
    else if (!outcome.failure) outcome.failure = "模型回答的连接中断了。";
  }
  return outcome;
}
