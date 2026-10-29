import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import type { AgentSessionSummary, Phase1CapabilityProjection, AgentTypedBlock } from "../entities/agent-orchestration";
import type { AssistantChatMessage } from "../lib/api/assistant-model";

const storageKey = "tilesim-web.agent-sessions.v1";
const storageVersion = 1;
const maxSessionTitleLength = 48;
export const AGENT_SESSION_RETENTION_DAYS = 7;
export const AGENT_SESSION_MAX_COUNT = 8;
export const AGENT_SESSION_MAX_BYTES = 200_000;
const retentionMs = AGENT_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const maxMessageLength = 2_000;
const maxBlockTextLength = 2_000;
const maxBlocksPerSession = 80;
const maxMessagesPerSession = 24;
const forbiddenPersistenceKeys = /credential|token|secret|password|hidden.?reasoning|raw.?response|evidence.?payload/iu;
const secretPatterns = [
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/giu,
  /\bBearer\s+[-A-Za-z0-9._~+/]+=*/giu,
] as const;

export interface AgentSessionRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  messages: AssistantChatMessage[];
  blocks: AgentTypedBlock[];
  context_revision: string | null;
  last_instruction: string | null;
  capability: Phase1CapabilityProjection | null;
  turn_sequence: number;
  edit_sequence: number;
}

interface PersistedAgentSessions {
  version: typeof storageVersion;
  active_session_id: string;
  sessions: AgentSessionRecord[];
}

export const AGENT_SESSION_RETENTION_NOTICE = `本地会话缓存：最多 ${AGENT_SESSION_MAX_COUNT} 个会话，${AGENT_SESSION_RETENTION_DAYS} 天后自动过期，总大小上限 ${Math.round(AGENT_SESSION_MAX_BYTES / 1000)} KB。仅保存裁剪后的可见内容，不是服务端 Conversation store；可随时删除。`;

function now(): string {
  return new Date().toISOString();
}

function expiryFrom(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + retentionMs).toISOString();
}

function serializedBytes(value: string): number {
  return typeof TextEncoder === "undefined" ? value.length : new TextEncoder().encode(value).byteLength;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() || `agent-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? " " : character;
  }).join("");
}

function cleanTitle(value: unknown): string {
  if (typeof value !== "string") return "新会话";
  const title = clipText(value, maxSessionTitleLength).replace(/\s+/gu, " ").trim();
  return title || "新会话";
}

function clipText(value: string, limit = maxMessageLength): string {
  let cleaned = stripControlCharacters(value);
  for (const pattern of secretPatterns) cleaned = cleaned.replace(pattern, "[REDACTED]");
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function sanitizePersistedValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return clipText(value, maxBlockTextLength);
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizePersistedValue(item, depth + 1));
  if (value && typeof value === "object" && depth < 8) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenPersistenceKeys.test(key)) continue;
      // Structured JSON previews are derived from the live page draft. They can
      // be large and become stale after a reload, so persist the plan metadata
      // but deliberately rebuild/omit this transient view instead of storing a
      // clipped JSON document that could look complete.
      if (key === "jsonPreview") continue;
      result[key] = sanitizePersistedValue(child, depth + 1);
    }
    return result;
  }
  return value;
}

function titleFromInstruction(instruction: string): string {
  const title = stripControlCharacters(instruction).replace(/\s+/gu, " ").trim();
  return cleanTitle(title || "新会话");
}

function emptySession(): AgentSessionRecord {
  const timestamp = now();
  return {
    id: newId(),
    title: "新会话",
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: expiryFrom(timestamp),
    messages: [],
    blocks: [],
    context_revision: null,
    last_instruction: null,
    capability: null,
    turn_sequence: 0,
    edit_sequence: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

function isChatMessage(value: unknown): value is AssistantChatMessage {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => key === "role" || key === "content") &&
    (value.role === "user" || value.role === "assistant") &&
    boundedString(value.content, maxMessageLength)
  );
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isTypedBlock(value: unknown): value is AgentTypedBlock {
  if (!isRecord(value) || typeof value.block_type !== "string" || !boundedString(value.block_id, 256)) return false;
  // Typed blocks are already closed-world renderable values. Keep a conservative
  // allow-list here so old or tampered localStorage data can never reintroduce
  // provider payloads into the panel.
  if (
    ![
      "user_message",
      "assistant_message",
      "explanation",
      "capability_result",
      "draft_summary",
      "validation_result",
      "clarification",
      "unsupported",
      "parameter_edits",
      "report_action",
      "agent_navigation",
      "agent_flow",
      "formal_error",
    ].includes(value.block_type)
  )
    return false;
  if (value.block_type === "agent_navigation") {
    const allowed = [
      "block_type",
      "block_id",
      "flow_id",
      "event_sequence",
      "binding",
      "target_pages",
      "required_capabilities",
      "authorization",
      "status",
      "detail",
      "observation",
      "created_at",
    ];
    if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
    if (
      (value.flow_id !== undefined && !boundedString(value.flow_id, 128)) ||
      (value.event_sequence !== undefined &&
        (typeof value.event_sequence !== "number" || !Number.isSafeInteger(value.event_sequence) || value.event_sequence < 0)) ||
      !Array.isArray(value.target_pages) ||
      value.target_pages.length > 32 ||
      value.target_pages.some((page) => !boundedString(page, 128)) ||
      new Set(value.target_pages).size !== value.target_pages.length ||
      !Array.isArray(value.required_capabilities) ||
      value.required_capabilities.length > 32 ||
      value.required_capabilities.some((capability) => !boundedString(capability, 128)) ||
      !["pending", "running", "succeeded", "waiting_user", "stale", "failed"].includes(value.status as string) ||
      !boundedString(value.detail, 2_000) ||
      !isRecord(value.authorization)
    )
      return false;
    const authorization = value.authorization;
    const numericBudget: Array<[string, number]> = [
      ["max_navigation_attempts", 8],
      ["max_model_calls", 60],
      ["max_tool_calls_per_round", 4],
      ["max_run_creations", 1],
      ["max_execution_time_ms", 3_600_000],
    ];
    if (
      Object.keys(authorization).some(
        (key) =>
          ![
            // The authorization identity is part of the user-visible typed
            // block because a reload must re-submit the exact signed grant.
            // Keep it in the closed-world persistence allow-list; otherwise
            // every navigation proposal carrying a digest is discarded on
            // hydration and cannot be resumed safely.
            "authorization_id",
            "authorization_digest",
            "max_navigation_attempts",
            "max_model_calls",
            "max_tool_calls_per_round",
            "max_run_creations",
            "max_execution_time_ms",
            "allowed_pages",
            "allowed_actions",
          ].includes(key),
      ) ||
      (authorization.authorization_id !== undefined &&
        (!boundedString(authorization.authorization_id, 128) ||
          !/^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(authorization.authorization_id))) ||
      (authorization.authorization_digest !== undefined &&
        (typeof authorization.authorization_digest !== "string" ||
          !/^sha256:[0-9a-f]{64}$/u.test(authorization.authorization_digest))) ||
      numericBudget.some(
        ([key, maximum]) =>
          !Number.isSafeInteger(authorization[key]) ||
          Number(authorization[key]) <= 0 ||
          Number(authorization[key]) > maximum,
      ) ||
      !Array.isArray(authorization.allowed_pages) ||
      !Array.isArray(authorization.allowed_actions) ||
      authorization.allowed_pages.length === 0 ||
      authorization.allowed_pages.length > 32 ||
      authorization.allowed_pages.some((page) => !boundedString(page, 128)) ||
      new Set(authorization.allowed_pages).size !== authorization.allowed_pages.length ||
      authorization.allowed_actions.length === 0 ||
      authorization.allowed_actions.some((action) => action !== "navigate")
    )
      return false;
    if (value.binding !== undefined) {
      if (!isRecord(value.binding)) return false;
      if (
        !boundedString(value.binding.session_id, 128) ||
        (value.binding.flow_id !== null && !boundedString(value.binding.flow_id, 128)) ||
        (value.binding.run_id !== null && !boundedString(value.binding.run_id, 128)) ||
        (value.binding.run_context_revision !== null && !boundedString(value.binding.run_context_revision, 256)) ||
        !isRecord(value.binding.backend_identity) ||
        typeof value.binding.schema_set_revision !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(value.binding.schema_set_revision) ||
        !Array.isArray(value.binding.artifact_bindings)
      )
        return false;
    }
    return true;
  }
  if (value.block_type !== "agent_flow") return true;
  const statuses = [
    "created",
    "running",
    "waiting_user",
    "draft_ready",
    "completed",
    "stale",
    "refused",
    "cancelled",
    "failed",
  ];
  if (!boundedString(value.flow_id, 128) || !/^flow-[A-Za-z0-9]+$/u.test(value.flow_id)) return false;
  if (!statuses.includes(value.status as string) || !boundedString(value.phase, 128)) return false;
  if (!boundedString(value.title, 256) || !boundedString(value.detail, 2_000)) return false;
  if (value.page_id !== undefined && value.page_id !== null && !boundedString(value.page_id, 128)) return false;
  if (value.context_revision !== undefined && value.context_revision !== null && !boundedString(value.context_revision, 256))
    return false;
  if (
    !["validated", "deterministic_fallback", "partial", "truncated", "missing", "provider_unavailable"].includes(
      value.evidence_status as string,
    ) ||
    !["not_started", "ready", "ready_with_limitations", "not_applicable"].includes(value.report_status as string)
  )
    return false;
  if (value.terminal_reason !== null && !boundedString(value.terminal_reason, 256)) return false;
  if (value.user_goal !== undefined && !boundedString(value.user_goal, 2_000)) return false;
  if (value.local_notice !== undefined && !boundedString(value.local_notice, 2_000)) return false;
  if (
    value.event_sequence !== undefined &&
    (typeof value.event_sequence !== "number" ||
      !Number.isSafeInteger(value.event_sequence) ||
      value.event_sequence < 0)
  )
    return false;
  if (value.pending_action !== null) {
    if (!isRecord(value.pending_action)) return false;
    if (
      Object.keys(value.pending_action).some((key) => !["action", "prompt", "reason", "intent_options"].includes(key))
    )
      return false;
    if (
      !("action" in value.pending_action) ||
      !["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation"].includes(
        value.pending_action.action as string,
      )
    )
      return false;
    if (!boundedString(value.pending_action.prompt, 2_000) || !boundedString(value.pending_action.reason, 2_000))
      return false;
    if (value.pending_action.intent_options !== undefined) {
      if (!Array.isArray(value.pending_action.intent_options) || value.pending_action.intent_options.length > 16)
        return false;
      if (
        value.pending_action.intent_options.some(
          (option) =>
            !isRecord(option) ||
            Object.keys(option).some((key) => !["intent", "label"].includes(key)) ||
            !["explain", "existing_run_analysis", "user_report", "configuration_draft"].includes(
              option.intent as string,
            ) ||
            !boundedString(option.label, 256),
        )
      )
        return false;
    }
  }
  if (
    ["completed", "draft_ready", "stale", "refused", "cancelled", "failed"].includes(value.status as string) &&
    value.pending_action !== null
  )
    return false;
  const binding = value.binding;
  if (!isRecord(binding)) return false;
  const requiredBindingFields = [
    "session_id",
    "flow_id",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "schema_set_revision",
    "input_snapshot_digest",
    "artifact_bindings",
  ];
  if (
    requiredBindingFields.some((field) => !Object.prototype.hasOwnProperty.call(binding, field)) ||
    Object.keys(binding).some((key) => !requiredBindingFields.includes(key))
  )
    return false;
  if (!boundedString(binding.session_id, 128) || binding.flow_id !== value.flow_id) return false;
  if (binding.run_id !== null && !boundedString(binding.run_id, 128)) return false;
  if (binding.run_context_revision !== null && !boundedString(binding.run_context_revision, 256)) return false;
  if ((binding.run_id === null) !== (binding.run_context_revision === null)) return false;
  if (!isRecord(binding.backend_identity)) return false;
  if (typeof binding.schema_set_revision !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(binding.schema_set_revision))
    return false;
  if (
    binding.input_snapshot_digest !== null &&
    (typeof binding.input_snapshot_digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(binding.input_snapshot_digest))
  )
    return false;
  if (!Array.isArray(binding.artifact_bindings) || binding.artifact_bindings.length > 256) return false;
  return binding.artifact_bindings.every(
    (artifact) =>
      isRecord(artifact) &&
      Object.keys(artifact).every((key) => ["artifact_id", "schema_identity", "sha256", "bytes"].includes(key)) &&
      boundedString(artifact.artifact_id, 256) &&
      boundedString(artifact.schema_identity, 256) &&
      typeof artifact.sha256 === "string" &&
      /^[0-9a-f]{64}$/u.test(artifact.sha256) &&
      typeof artifact.bytes === "string" &&
      /^(?:0|[1-9][0-9]*)$/u.test(artifact.bytes),
  );
}

const capabilityFieldKeys = [
  "field_id",
  "aliases",
  "value_type",
  "canonical_unit",
  "accepted_units",
  "request_json_pointer",
  "enum_values",
  "minimum",
  "maximum",
  "integer_only",
  "capability_state",
] as const;

function restoreCapability(value: unknown): Phase1CapabilityProjection | null {
  if (
    !isRecord(value) ||
    ![
      "catalog_identity",
      "catalog_revision",
      "capability_snapshot_revision",
      "schema_set_revision",
      "target_request_identity",
      "fields",
    ].every((key) => Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some(
      (key) =>
        ![
          "catalog_identity",
          "catalog_revision",
          "capability_snapshot_revision",
          "schema_set_revision",
          "target_request_identity",
          "fields",
        ].includes(key),
    )
  )
    return null;
  if (
    value.catalog_identity !== "tilesim.bridge.agent_orchestration_capability_catalog.v1" ||
    value.target_request_identity !== "tilesim.bridge.create_run_request.v1" ||
    !boundedString(value.catalog_revision, 256) ||
    !boundedString(value.capability_snapshot_revision, 256) ||
    !boundedString(value.schema_set_revision, 256) ||
    !Array.isArray(value.fields) ||
    value.fields.length > 256
  )
    return null;
  for (const field of value.fields) {
    if (
      !isRecord(field) ||
      Object.keys(field).some((key) => !capabilityFieldKeys.includes(key as (typeof capabilityFieldKeys)[number])) ||
      capabilityFieldKeys.some((key) => !Object.prototype.hasOwnProperty.call(field, key)) ||
      !boundedString(field.field_id, 256) ||
      !Array.isArray(field.aliases) ||
      field.aliases.length > 32 ||
      field.aliases.some((alias) => !boundedString(alias, 256, true)) ||
      !["enum", "integer", "number"].includes(field.value_type as string) ||
      !boundedString(field.canonical_unit, 128, true) ||
      !Array.isArray(field.accepted_units) ||
      field.accepted_units.length > 32 ||
      field.accepted_units.some((unit) => !boundedString(unit, 128, true)) ||
      !boundedString(field.request_json_pointer, 512) ||
      !Array.isArray(field.enum_values) ||
      field.enum_values.length > 256 ||
      field.enum_values.some((entry) => !boundedString(entry, 256, true)) ||
      (field.minimum !== null && !boundedString(field.minimum, 128, true)) ||
      (field.maximum !== null && !boundedString(field.maximum, 128, true)) ||
      typeof field.integer_only !== "boolean" ||
      !["available", "conditional", "not_exposed", "unsupported", "unresolved_not_executed", "unavailable"].includes(
        field.capability_state as string,
      )
    )
      return null;
  }
  return sanitizePersistedValue(value) as unknown as Phase1CapabilityProjection;
}

function restoreBlock(value: unknown): AgentTypedBlock | null {
  if (!isTypedBlock(value)) return null;
  const sanitized = sanitizePersistedValue(value) as AgentTypedBlock;
  // A hard reload can happen while an SSE answer is streaming. Never restore a
  // block that promises an answer is still arriving when no stream exists any
  // more; keep the visible text and explain why it stopped.
  if (sanitized.block_type === "assistant_message" && sanitized.streaming) {
    return {
      ...sanitized,
      streaming: false,
      error: sanitized.error || "上次回答在页面关闭前未完成，可以重新提问。",
    };
  }
  return sanitized;
}

function restoreSession(value: unknown): AgentSessionRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !isValidTimestamp(value.created_at) ||
    (value.updated_at !== undefined && !isValidTimestamp(value.updated_at)) ||
    (value.expires_at !== undefined && !isValidTimestamp(value.expires_at))
  )
    return null;
  const messages = Array.isArray(value.messages)
    ? value.messages
        .filter(isChatMessage)
        .slice(-maxMessagesPerSession)
        .map((message) => ({ ...message, content: clipText(message.content) }))
    : [];
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(restoreBlock).filter((block): block is AgentTypedBlock => block !== null)
    : [];
  return {
    id: value.id.slice(0, 160),
    title: cleanTitle(value.title),
    created_at: value.created_at,
    updated_at: isValidTimestamp(value.updated_at) ? value.updated_at : value.created_at,
    expires_at: isValidTimestamp(value.expires_at)
      ? value.expires_at
      : expiryFrom(isValidTimestamp(value.updated_at) ? value.updated_at : value.created_at),
    messages,
    blocks,
    context_revision: typeof value.context_revision === "string" ? value.context_revision.slice(0, 512) : null,
    last_instruction: typeof value.last_instruction === "string" ? clipText(value.last_instruction) : null,
    capability: restoreCapability(value.capability),
    turn_sequence:
      typeof value.turn_sequence === "number" && Number.isSafeInteger(value.turn_sequence) && value.turn_sequence >= 0
        ? value.turn_sequence
        : 0,
    edit_sequence:
      typeof value.edit_sequence === "number" && Number.isSafeInteger(value.edit_sequence) && value.edit_sequence >= 0
        ? value.edit_sequence
        : 0,
  };
}

function restore(): PersistedAgentSessions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = JSON.parse(raw || "null");
    if (!isRecord(parsed) || parsed.version !== storageVersion || !Array.isArray(parsed.sessions)) return null;
    const currentTime = Date.now();
    const sessions = parsed.sessions
      .map(restoreSession)
      .filter(
        (session): session is AgentSessionRecord =>
          session !== null && new Date(session.expires_at).getTime() > currentTime,
      )
      .slice(0, AGENT_SESSION_MAX_COUNT);
    if (!sessions.length) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // A read-only storage still permits an empty in-memory session.
      }
      return null;
    }
    const active =
      typeof parsed.active_session_id === "string" &&
      sessions.some((session) => session.id === parsed.active_session_id)
        ? parsed.active_session_id
        : sessions[0].id;
    const restored: PersistedAgentSessions = { version: storageVersion, active_session_id: active, sessions };
    // Remove expired, over-count, or legacy-unsanitized records as soon as the
    // cache is read. Otherwise filtering them only in memory would leave the
    // supposedly expired transcript in browser storage indefinitely.
    try {
      const normalized = JSON.stringify(restored);
      if (normalized !== raw) window.localStorage.setItem(storageKey, normalized);
    } catch {
      // A read-only or quota-full storage still permits an in-memory restore.
    }
    return restored;
  } catch {
    return null;
  }
}

export const useAgentSessionsStore = defineStore("agent-sessions", () => {
  const restored = restore();
  const initialSessions = restored?.sessions || [emptySession()];
  const sessions = ref<AgentSessionRecord[]>(initialSessions);
  const activeSessionId = ref(restored?.active_session_id || initialSessions[0].id);
  const blocks = shallowRef<readonly AgentTypedBlock[]>([]);
  const messages = shallowRef<readonly AssistantChatMessage[]>([]);
  const contextRevision = ref<string | null>(null);
  const lastInstruction = ref<string | null>(null);
  const capability = shallowRef<Phase1CapabilityProjection | null>(null);
  const turnSequence = ref(0);
  const editSequence = ref(0);
  const hydrated = ref(Boolean(restored));
  const persistenceError = ref(false);
  const retentionNotice = AGENT_SESSION_RETENTION_NOTICE;

  function currentRecord(): AgentSessionRecord {
    return sessions.value.find((session) => session.id === activeSessionId.value) || sessions.value[0];
  }

  function loadRecord(record: AgentSessionRecord): void {
    activeSessionId.value = record.id;
    blocks.value = record.blocks;
    messages.value = record.messages;
    contextRevision.value = record.context_revision;
    lastInstruction.value = record.last_instruction;
    capability.value = record.capability;
    turnSequence.value = record.turn_sequence;
    editSequence.value = record.edit_sequence;
  }

  function saveCurrent(): void {
    const record = currentRecord();
    if (!record) return;
    record.blocks = blocks.value
      .slice(-maxBlocksPerSession)
      .map((block) => sanitizePersistedValue(block) as AgentTypedBlock);
    record.messages = messages.value
      .slice(-maxMessagesPerSession)
      .map((message) => ({ role: message.role, content: clipText(message.content) }));
    record.context_revision = contextRevision.value;
    record.last_instruction = lastInstruction.value;
    record.capability = capability.value;
    record.turn_sequence = turnSequence.value;
    record.edit_sequence = editSequence.value;
    record.updated_at = now();
    record.expires_at = expiryFrom(record.updated_at);
  }

  function persist(): void {
    if (typeof window === "undefined") return;
    saveCurrent();
    sessions.value.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    sessions.value = sessions.value.slice(0, AGENT_SESSION_MAX_COUNT);
    const payload: PersistedAgentSessions = {
      version: storageVersion,
      active_session_id: activeSessionId.value,
      // Budget trimming below is persistence-only. Do not mutate the live
      // record arrays: a quota failure or an oversized cache must never erase
      // text that is still visible in the open conversation.
      sessions: sessions.value.map((session) => ({
        ...session,
        blocks: [...session.blocks],
        messages: [...session.messages],
      })),
    };
    try {
      let serialized = JSON.stringify(payload);
      // Old sessions are trimmed from the least-recently-updated end until the
      // browser cache stays within the explicit retention budget.
      while (serializedBytes(serialized) > AGENT_SESSION_MAX_BYTES && payload.sessions.length > 1) {
        const removableIndex = [...payload.sessions]
          .map((session, index) => ({ session, index }))
          .reverse()
          .find(({ session }) => session.id !== activeSessionId.value)?.index;
        if (removableIndex === undefined) break;
        payload.sessions.splice(removableIndex, 1);
        serialized = JSON.stringify(payload);
      }
      // A single session must also respect the total cache budget. Trim only
      // persisted history, leaving the current in-memory transcript intact so
      // the panel does not unexpectedly lose visible content mid-turn.
      const active = payload.sessions.find((session) => session.id === activeSessionId.value);
      if (!active) {
        window.localStorage.setItem(storageKey, serialized);
        persistenceError.value = false;
        return;
      }
      while (serializedBytes(serialized) > AGENT_SESSION_MAX_BYTES) {
        if (active.blocks.length > 1) active.blocks.shift();
        else if (active.messages.length > 1) active.messages.shift();
        else if (active.blocks.length) active.blocks = [];
        else if (active.messages.length) active.messages = [];
        else if (active.capability) active.capability = null;
        else if (active.last_instruction) active.last_instruction = null;
        else break;
        serialized = JSON.stringify(payload);
      }
      window.localStorage.setItem(storageKey, serialized);
      persistenceError.value = false;
    } catch {
      persistenceError.value = true;
    }
  }

  function createSession(title = "新会话"): string {
    persist();
    const record = emptySession();
    record.title = cleanTitle(title);
    sessions.value.unshift(record);
    loadRecord(record);
    persist();
    return record.id;
  }

  function selectSession(id: string): boolean {
    if (id === activeSessionId.value) return true;
    const record = sessions.value.find((session) => session.id === id);
    if (!record) return false;
    persist();
    loadRecord(record);
    persist();
    return true;
  }

  function deleteSession(id: string): boolean {
    const index = sessions.value.findIndex((session) => session.id === id);
    if (index < 0) return false;
    persist();
    sessions.value.splice(index, 1);
    if (!sessions.value.length) sessions.value.push(emptySession());
    if (activeSessionId.value === id) {
      const replacement = [...sessions.value].sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
      loadRecord(replacement);
    }
    persist();
    return true;
  }

  function clearAllSessions(): void {
    cancelActiveSessionData();
    const record = emptySession();
    sessions.value = [record];
    loadRecord(record);
    try {
      window.localStorage.removeItem(storageKey);
      persistenceError.value = false;
    } catch {
      persistenceError.value = true;
    }
  }

  function cancelActiveSessionData(): void {
    blocks.value = [];
    messages.value = [];
    contextRevision.value = null;
    lastInstruction.value = null;
    capability.value = null;
    turnSequence.value = 0;
    editSequence.value = 0;
  }

  function titleFromFirstInstruction(instruction: string): void {
    const record = currentRecord();
    if (!record || record.title !== "新会话" || !instruction.trim()) return;
    record.title = titleFromInstruction(instruction);
    record.updated_at = now();
    record.expires_at = expiryFrom(record.updated_at);
    persist();
  }

  function summaries(): AgentSessionSummary[] {
    return sessions.value
      .map((session) => ({
        id: session.id,
        title: session.title,
        updated_at: session.updated_at,
        message_count: session.messages.length,
        block_count: session.blocks.length,
      }))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }

  loadRecord(currentRecord());
  watch([blocks, messages, contextRevision, lastInstruction, capability, turnSequence, editSequence], () => persist(), {
    deep: true,
  });

  return {
    sessions,
    activeSessionId,
    blocks,
    messages,
    contextRevision,
    lastInstruction,
    capability,
    turnSequence,
    editSequence,
    hydrated,
    persistenceError,
    retentionNotice,
    storageKey,
    storageBytes: computed(() => {
      try {
        const value = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
        return value ? serializedBytes(value) : 0;
      } catch {
        return 0;
      }
    }),
    summaries,
    createSession,
    selectSession,
    deleteSession,
    clearAllSessions,
    titleFromFirstInstruction,
    persist,
  };
});
