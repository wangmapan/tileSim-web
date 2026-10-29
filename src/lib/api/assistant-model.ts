import type {
  AssistantModelCatalogueResponse,
  AssistantModelDescriptorResponse,
  AssistantModelPlanResponse,
  AssistantModelSelectionResponse,
} from "../../contracts/bridge-api";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../contracts/generated/bridge-contracts";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import { isRecord, apiRoots, apiRequestWithMetadata } from "./transport";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { readSseFrames } from "./sse";

/** The protocol identity every plan from the assistant model channel must carry. */
const ASSISTANT_MODEL_PROTOCOL = "tilesim.assistant_model.v1";
/** The chat envelope identity the Bridge writes on its prose, error and done events. */
const ASSISTANT_CHAT_SCHEMA_VERSION = "tilesim.bridge.assistant_model_chat.v1";
const RESULT_ANALYSIS_CHAT_SCHEMA_VERSION = "tilesim.bridge.result_analysis_chat.v1";
const ASSISTANT_MODEL_DESCRIPTOR_SCHEMA_VERSION = "tilesim.bridge.assistant_model_descriptor.v1";
const ASSISTANT_MODEL_PLAN_SCHEMA_VERSION = "tilesim.bridge.assistant_model_plan.v1";
const ASSISTANT_MODEL_CATALOGUE_SCHEMA_VERSION = "tilesim.bridge.assistant_model_catalogue.v1";
const ASSISTANT_MODEL_SELECTION_SCHEMA_VERSION = "tilesim.bridge.assistant_model_selection.v1";
const ASSISTANT_MODEL_API_VERSION = "tilesim.bridge.api.v1";
const ASSISTANT_MODEL_SESSION_HEADER = "X-TileSim-Assistant-Session";

type AssistantModelRequestOptions = { signal?: AbortSignal; sessionId?: string };

function assistantModelHeaders(sessionId?: string): Record<string, string> {
  return sessionId && sessionId.trim() ? { [ASSISTANT_MODEL_SESSION_HEADER]: sessionId.trim() } : {};
}

const PLAN_KEYS = [
  "schema_version",
  "schema_set_revision",
  "protocol",
  "provider_id",
  "model_id",
  "served_model",
  "instruction",
  "answer_state",
  "title",
  "rationale",
  "settings",
  "structured_inputs",
  "dropped",
  "applied",
  "executed",
] as const;

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

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
  options: AssistantModelRequestOptions = {},
): Promise<AssistantModelPlanResponse | null> {
  try {
    const { payload, schemaSetRevision, apiVersion } = await apiRequestWithMetadata<AssistantModelPlanResponse>(
      bridgePaths.planAgentScenario(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...assistantModelHeaders(options.sessionId) },
        body: JSON.stringify({ instruction }),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    return schemaSetRevision === BRIDGE_SCHEMA_SET_REVISION && apiVersion === ASSISTANT_MODEL_API_VERSION
      ? trustedPlan(payload, instruction)
      : null;
  } catch {
    return null;
  }
}

/** Accepts a plan only when it claims nothing was applied and nothing was executed. */
function trustedPlan(payload: unknown, expectedInstruction?: string): AssistantModelPlanResponse | null {
  if (!isRecord(payload)) return null;
  if (!hasOnlyKeys(payload, PLAN_KEYS)) return null;
  if (payload.schema_version !== ASSISTANT_MODEL_PLAN_SCHEMA_VERSION) return null;
  if (payload.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION) return null;
  if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
  // A channel that claims to have written or run something is not trusted.
  if (payload.applied !== false || payload.executed !== false) return null;
  if (!Array.isArray(payload.settings) || payload.settings.length > 64) return null;
  if (!boundedString(payload.provider_id, 200) || !boundedString(payload.model_id, 200)) return null;
  if (!boundedString(payload.served_model, 200) || !boundedString(payload.instruction, 2_000)) return null;
  if (!boundedString(payload.title, 80, true) || !boundedString(payload.rationale, 600, true)) return null;
  if (!(["settings", "prose_only", "settings_unparsed"] as const).includes(payload.answer_state as never)) return null;
  if (expectedInstruction !== undefined && payload.instruction.trim() !== expectedInstruction.trim()) return null;
  if (!Array.isArray(payload.dropped) || payload.dropped.length > 64) return null;
  if (
    payload.settings.some(
      (entry) =>
        !isRecord(entry) ||
        !hasOnlyKeys(entry, ["key", "value", "why"]) ||
        !boundedString(entry.key, 256) ||
        !boundedString(entry.value, 2_000, true) ||
        !boundedString(entry.why, 240, true),
    )
  )
    return null;
  if (
    payload.dropped.some(
      (entry) =>
        !isRecord(entry) ||
        !hasOnlyKeys(entry, ["key", "reason"]) ||
        !boundedString(entry.key, 256) ||
        !boundedString(entry.reason, 240),
    )
  )
    return null;
  if (payload.structured_inputs !== undefined) {
    if (!isRecord(payload.structured_inputs) || !hasOnlyKeys(payload.structured_inputs, ["runtime_trace", "topology"]))
      return null;
    if (!isRecord(payload.structured_inputs.runtime_trace) || !isRecord(payload.structured_inputs.topology))
      return null;
  }
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
  options: AssistantModelRequestOptions = {},
): Promise<AssistantModelDescriptorResponse | null> {
  try {
    const { payload, schemaSetRevision, apiVersion } = await apiRequestWithMetadata<AssistantModelDescriptorResponse>(
      bridgePaths.assistantModelDescriptor(),
      {
        headers: assistantModelHeaders(options.sessionId),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (schemaSetRevision !== BRIDGE_SCHEMA_SET_REVISION || apiVersion !== ASSISTANT_MODEL_API_VERSION) return null;
    if (
      !isRecord(payload) ||
      !hasOnlyKeys(payload, [
        "schema_version",
        "schema_set_revision",
        "protocol",
        "availability",
        "configured",
        "degradation_state",
        "detail",
        "provider",
        "limits",
      ])
    )
      return null;
    if (
      payload.schema_version !== ASSISTANT_MODEL_DESCRIPTOR_SCHEMA_VERSION ||
      payload.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION
    )
      return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    if (
      payload.configured !== true ||
      payload.availability !== "available" ||
      payload.degradation_state !== "available"
    )
      return null;
    if (
      !boundedString(payload.detail, 2_000) ||
      !isRecord(payload.provider) ||
      !hasOnlyKeys(payload.provider, ["configured", "provider_id", "model_id", "model_revision"])
    )
      return null;
    if (
      payload.provider.configured !== true ||
      !boundedString(payload.provider.provider_id, 200) ||
      !boundedString(payload.provider.model_id, 200) ||
      !boundedString(payload.provider.model_revision, 200)
    )
      return null;
    if (
      !isRecord(payload.limits) ||
      !hasOnlyKeys(payload.limits, ["maximum_instruction_characters", "maximum_settings"])
    )
      return null;
    if (
      !Number.isSafeInteger(payload.limits.maximum_instruction_characters) ||
      payload.limits.maximum_instruction_characters < 1 ||
      !Number.isSafeInteger(payload.limits.maximum_settings) ||
      payload.limits.maximum_settings < 1
    )
      return null;
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
  options: AssistantModelRequestOptions = {},
): Promise<AssistantModelCatalogueResponse | null> {
  try {
    const { payload, schemaSetRevision, apiVersion } = await apiRequestWithMetadata<AssistantModelCatalogueResponse>(
      bridgePaths.assistantModelCatalogue(),
      {
        headers: assistantModelHeaders(options.sessionId),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (schemaSetRevision !== BRIDGE_SCHEMA_SET_REVISION || apiVersion !== ASSISTANT_MODEL_API_VERSION) return null;
    if (
      !isRecord(payload) ||
      !hasOnlyKeys(payload, [
        "schema_version",
        "schema_set_revision",
        "protocol",
        "provider_id",
        "models",
        "count",
        "selected_model",
        "session_override",
      ])
    )
      return null;
    if (
      payload.schema_version !== ASSISTANT_MODEL_CATALOGUE_SCHEMA_VERSION ||
      payload.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION
    )
      return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    if (typeof payload.selected_model !== "string") return null;
    if (!Array.isArray(payload.models)) return null;
    if (payload.models.some((entry) => !boundedString(entry, 200))) return null;
    const models = payload.models.filter((entry): entry is string => boundedString(entry, 200));
    // The contract promises at least one identity, and an empty catalogue would silently empty the
    // dropdown, so a list that lost every entry on the way here is refused rather than shown.
    const [head, ...tail] = models;
    if (
      head === undefined ||
      models.length !== new Set(models).size ||
      !Number.isSafeInteger(payload.count) ||
      payload.count !== models.length ||
      !boundedString(payload.selected_model, 200) ||
      !models.includes(payload.selected_model) ||
      typeof payload.session_override !== "boolean"
    )
      return null;
    return { ...(payload as unknown as AssistantModelCatalogueResponse), models: [head, ...tail] };
  } catch {
    return null;
  }
}

/**
 * Asks the Bridge to use one model identity from now on.
 *
 * The switch is assistant-session-scoped: it takes effect for the next answer in that browser session
 * without restarting the backend,
 * and it is forgotten when the Bridge process is restarted. A reply that claims to have written the
 * saved configuration is rejected, because the saved configuration belongs to the launcher and this
 * call is not allowed to change it. Every refusal is `null`, so a caller keeps its previous identity.
 */
export async function selectAssistantModel(
  model: string,
  options: AssistantModelRequestOptions = {},
): Promise<AssistantModelSelectionResponse | null> {
  try {
    const { payload, schemaSetRevision, apiVersion } = await apiRequestWithMetadata<AssistantModelSelectionResponse>(
      bridgePaths.selectAssistantModel(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...assistantModelHeaders(options.sessionId) },
        body: JSON.stringify({ model }),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (schemaSetRevision !== BRIDGE_SCHEMA_SET_REVISION || apiVersion !== ASSISTANT_MODEL_API_VERSION) return null;
    if (
      !isRecord(payload) ||
      !hasOnlyKeys(payload, [
        "schema_version",
        "schema_set_revision",
        "protocol",
        "provider_id",
        "selected_model",
        "previous_model",
        "in_force",
        "persisted",
        "session_only",
      ])
    )
      return null;
    if (
      payload.schema_version !== ASSISTANT_MODEL_SELECTION_SCHEMA_VERSION ||
      payload.schema_set_revision !== BRIDGE_SCHEMA_SET_REVISION
    )
      return null;
    if (payload.protocol !== ASSISTANT_MODEL_PROTOCOL) return null;
    // A channel that claims to have persisted the choice, or to have made it permanent, is not trusted.
    if (payload.persisted !== false || payload.session_only !== true) return null;
    if (payload.in_force !== true) return null;
    if (
      payload.selected_model !== model.trim() ||
      !boundedString(payload.selected_model, 200) ||
      !boundedString(payload.previous_model, 200)
    )
      return null;
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
    throw new Error("invalid_sse_json");
  }
}

function streamProtocolFailure(outcome: { failure: string }, message = "模型回答格式不受支持。"): void {
  if (!outcome.failure) outcome.failure = message;
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
  options: AssistantModelRequestOptions = {},
): Promise<AssistantChatOutcome | null> {
  let response: Response;
  try {
    response = await fetch(`${apiRoots()[0]}${bridgePaths.streamAgentScenarioChat()}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...assistantModelHeaders(options.sessionId),
      },
      body: JSON.stringify({ messages: request.messages, panel_values: request.panel_values }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // A cancelled request is reported as such; anything else means the channel could not be reached.
    return options.signal?.aborted ? { answer: "", plan: null, failure: "", cancelled: true } : null;
  }
  if (!response.ok) return null;
  if (
    response.headers.get("x-tilesim-schema-set-revision") !== BRIDGE_SCHEMA_SET_REVISION ||
    response.headers.get("x-tilesim-api-version") !== ASSISTANT_MODEL_API_VERSION
  )
    return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) return null;

  const outcome: AssistantChatOutcome = { answer: "", plan: null, failure: "", cancelled: false };
  let sawDone = false;
  let sawError = false;
  let sawPlan = false;
  const expectedInstruction = [...request.messages].reverse().find((message) => message.role === "user")?.content;
  try {
    for await (const frame of readSseFrames(response)) {
      if (sawDone || sawError) {
        streamProtocolFailure(outcome);
        break;
      }
      if (frame.event === "prose") {
        const payload = parseFrameData(frame.data);
        if (isRecord(payload) && payload.schema_version !== ASSISTANT_CHAT_SCHEMA_VERSION) continue;
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version", "text"]) ||
          !boundedString(payload.text, 24_000, true)
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        outcome.answer = payload.text;
        callbacks.onAnswer(payload.text);
        continue;
      }
      if (frame.event === "plan") {
        if (sawPlan) {
          streamProtocolFailure(outcome);
          break;
        }
        const plan = trustedPlan(parseFrameData(frame.data), expectedInstruction);
        if (plan) {
          outcome.plan = plan;
          sawPlan = true;
          callbacks.onPlan(plan);
        } else streamProtocolFailure(outcome);
        continue;
      }
      if (frame.event === "error") {
        const payload = parseFrameData(frame.data);
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version", "code", "message", "retryable"]) ||
          payload.schema_version !== ASSISTANT_CHAT_SCHEMA_VERSION ||
          !boundedString(payload.code, 128) ||
          !boundedString(payload.message, 2_000) ||
          typeof payload.retryable !== "boolean"
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        outcome.failure = payload.message;
        sawError = true;
        continue;
      }
      if (frame.event === "done") {
        const payload = parseFrameData(frame.data);
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version"]) ||
          payload.schema_version !== ASSISTANT_CHAT_SCHEMA_VERSION
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        sawDone = true;
        continue;
      }
      streamProtocolFailure(outcome);
      break;
    }
  } catch (error) {
    // A stream cut mid-answer still leaves the caller with whatever prose already arrived. A stop the
    // user asked for is reported as cancelled rather than as a failure, because it is not one.
    if (options.signal?.aborted) outcome.cancelled = true;
    else if (!outcome.failure)
      outcome.failure =
        error instanceof Error && error.message === "invalid_sse_json"
          ? "模型回答格式不受支持。"
          : "模型回答的连接中断了。";
  }
  if (!outcome.cancelled && !outcome.failure && (!sawDone || !outcome.plan)) outcome.failure = "模型回答没有正常结束。";
  if (sawError && !outcome.failure) outcome.failure = "模型没有答完这次请求。";
  // A plan is actionable only when the complete stream reached its normal
  // terminal frame.  Providers/proxies can emit a plan and then fail or send
  // an unknown frame; retaining that partial plan would let the caller apply
  // data from an incomplete response.  The prose remains available for the
  // user, but the plan is fail-closed.
  if (outcome.failure || outcome.cancelled) outcome.plan = null;
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
  options: AssistantModelRequestOptions = {},
): Promise<AssistantResultAnalysisOutcome | null> {
  let response: Response;
  try {
    response = await fetch(`${apiRoots()[0]}${bridgePaths.streamAgentResultAnalysis()}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...assistantModelHeaders(options.sessionId),
      },
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
  if (
    response.headers.get("x-tilesim-schema-set-revision") !== BRIDGE_SCHEMA_SET_REVISION ||
    response.headers.get("x-tilesim-api-version") !== ASSISTANT_MODEL_API_VERSION
  )
    return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) return null;

  const outcome: AssistantResultAnalysisOutcome = { answer: "", failure: "", cancelled: false };
  let sawDone = false;
  let sawError = false;
  try {
    for await (const frame of readSseFrames(response)) {
      if (sawDone || sawError) {
        streamProtocolFailure(outcome);
        break;
      }
      if (frame.event === "prose") {
        const payload = parseFrameData(frame.data);
        if (isRecord(payload) && payload.schema_version !== RESULT_ANALYSIS_CHAT_SCHEMA_VERSION) continue;
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version", "text"]) ||
          !boundedString(payload.text, 24_000, true)
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        outcome.answer = payload.text;
        callbacks.onAnswer(payload.text);
        continue;
      }
      if (frame.event === "error") {
        const payload = parseFrameData(frame.data);
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version", "code", "message", "retryable"]) ||
          payload.schema_version !== RESULT_ANALYSIS_CHAT_SCHEMA_VERSION ||
          !boundedString(payload.code, 128) ||
          !boundedString(payload.message, 2_000) ||
          typeof payload.retryable !== "boolean"
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        outcome.failure = payload.message;
        sawError = true;
        continue;
      }
      if (frame.event === "done") {
        const payload = parseFrameData(frame.data);
        if (
          !isRecord(payload) ||
          !hasOnlyKeys(payload, ["schema_version"]) ||
          payload.schema_version !== RESULT_ANALYSIS_CHAT_SCHEMA_VERSION
        ) {
          streamProtocolFailure(outcome);
          break;
        }
        sawDone = true;
        continue;
      }
      streamProtocolFailure(outcome);
      break;
    }
  } catch {
    if (options.signal?.aborted) outcome.cancelled = true;
    else if (!outcome.failure) outcome.failure = "模型回答的连接中断了。";
  }
  if (!outcome.cancelled && !outcome.failure && !sawDone) outcome.failure = "模型回答没有正常结束。";
  return outcome;
}
