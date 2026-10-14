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

function isChatMessage(value: unknown): value is AssistantChatMessage {
  return isRecord(value) && (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
}

function isTypedBlock(value: unknown): value is AgentTypedBlock {
  if (!isRecord(value) || typeof value.block_type !== "string" || typeof value.block_id !== "string") return false;
  // Typed blocks are already closed-world renderable values. Keep a conservative
  // allow-list here so old or tampered localStorage data can never reintroduce
  // provider payloads into the panel.
  return [
    "user_message",
    "assistant_message",
    "explanation",
    "capability_result",
    "draft_summary",
    "validation_result",
    "clarification",
    "unsupported",
    "parameter_edits",
    "formal_error",
  ].includes(value.block_type);
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
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.created_at !== "string")
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
    updated_at: typeof value.updated_at === "string" ? value.updated_at : value.created_at,
    expires_at:
      typeof value.expires_at === "string"
        ? value.expires_at
        : expiryFrom(typeof value.updated_at === "string" ? value.updated_at : value.created_at),
    messages,
    blocks,
    context_revision: typeof value.context_revision === "string" ? value.context_revision.slice(0, 512) : null,
    last_instruction: typeof value.last_instruction === "string" ? clipText(value.last_instruction) : null,
    capability: isRecord(value.capability)
      ? (sanitizePersistedValue(value.capability) as unknown as Phase1CapabilityProjection)
      : null,
    turn_sequence:
      typeof value.turn_sequence === "number" && Number.isSafeInteger(value.turn_sequence) ? value.turn_sequence : 0,
    edit_sequence:
      typeof value.edit_sequence === "number" && Number.isSafeInteger(value.edit_sequence) ? value.edit_sequence : 0,
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
      sessions: sessions.value,
    };
    try {
      let serialized = JSON.stringify(payload);
      // Old sessions are trimmed from the least-recently-updated end until the
      // browser cache stays within the explicit retention budget.
      while (serializedBytes(serialized) > AGENT_SESSION_MAX_BYTES && sessions.value.length > 1) {
        const removableIndex = [...sessions.value]
          .map((session, index) => ({ session, index }))
          .reverse()
          .find(({ session }) => session.id !== activeSessionId.value)?.index;
        if (removableIndex === undefined) break;
        sessions.value.splice(removableIndex, 1);
        serialized = JSON.stringify({ ...payload, sessions: sessions.value });
      }
      // A single session must also respect the total cache budget. Trim only
      // persisted history, leaving the current in-memory transcript intact so
      // the panel does not unexpectedly lose visible content mid-turn.
      const active = currentRecord();
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
