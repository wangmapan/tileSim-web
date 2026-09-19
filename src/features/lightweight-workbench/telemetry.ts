/**
 * Host-observable, redacted telemetry for the lightweight workbench.
 *
 * This module deliberately has no network transport and never persists data.
 * A host may listen for `tilesim:lightweight-telemetry` and forward the
 * already-sanitised detail to its approved telemetry pipeline.
 */
export const LIGHTWEIGHT_TELEMETRY_EVENT = "tilesim:lightweight-telemetry";

export type LightweightTelemetryEvent =
  | "workbench_choice_viewed"
  | "workbench_selected"
  | "lightweight_task_selected"
  | "lightweight_submit_started"
  | "lightweight_result_state"
  | "lightweight_switch_to_professional"
  | "lightweight_error";

type TelemetryValue = string | number | boolean;
type TelemetryPayload = Record<string, TelemetryValue | undefined>;

const allowedPayloadKeys: Record<LightweightTelemetryEvent, readonly string[]> = {
  workbench_choice_viewed: [],
  workbench_selected: ["mode", "source"],
  lightweight_task_selected: ["task_id", "example"],
  lightweight_submit_started: ["task_id", "context_revision_hash"],
  lightweight_result_state: ["state", "provenance_class", "latency_bucket"],
  lightweight_switch_to_professional: ["source_section", "target_route_class"],
  lightweight_error: ["error_code", "retryable", "latency_bucket"],
};

let sessionId: string | null = null;

function anonymousSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = globalThis.crypto?.randomUUID?.() || `session-${Math.random().toString(36).slice(2, 12)}`;
  } catch {
    sessionId = "session-unknown";
  }
  return sessionId;
}

function viewportBucket(): string {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 800) return "lt-800";
  if (window.innerWidth < 1200) return "800-1199";
  return "gte-1200";
}

/** Emit only enum/hash/bucket data through a non-persistent browser event. */
export function emitLightweightTelemetry(event: LightweightTelemetryEvent, payload: TelemetryPayload = {}): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const detail: Record<string, TelemetryValue> = {
    event,
    session_id: anonymousSessionId(),
    viewport_bucket: viewportBucket(),
  };
  const allowedKeys = allowedPayloadKeys[event] || [];
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && allowedKeys.includes(key)) detail[key] = value;
  }
  try {
    window.dispatchEvent(new CustomEvent(LIGHTWEIGHT_TELEMETRY_EVENT, { detail }));
  } catch {
    // Telemetry is optional and must never block navigation or task work.
  }
}

/** Small deterministic hash for context revisions; the source is never emitted. */
export function telemetryHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
