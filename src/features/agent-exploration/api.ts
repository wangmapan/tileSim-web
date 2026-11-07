import { apiRequest } from "../../lib/api/transport";
import type { ExplorationAuthorizationResponse, ExplorationCreateRequest, ExplorationPlanningRequest, ExplorationPlanningResponse, ExplorationResponse } from "./types";

const path = (id: string, suffix = "") => `/agent/explorations/${encodeURIComponent(id)}${suffix}`;
export const planExploration = (request: ExplorationPlanningRequest) =>
  apiRequest<ExplorationPlanningResponse>("/agent/explorations/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
export const confirmExplorationPlan = (plan: Record<string, unknown>, confirmation: Record<string, unknown>) =>
  apiRequest<ExplorationPlanningResponse>("/agent/explorations/plan/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, confirmation }),
  });
export const createExploration = (request: ExplorationCreateRequest) =>
  apiRequest<ExplorationResponse>("/agent/explorations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `exploration-create-${crypto.randomUUID()}` },
    body: JSON.stringify(request),
  });
export const listExplorations = () => apiRequest<{ sessions: ExplorationResponse["session"][] }>("/agent/explorations");
export const getExploration = (id: string) => apiRequest<ExplorationResponse>(path(id));
export const authorizeExploration = (id: string, budget?: unknown) =>
  apiRequest<ExplorationAuthorizationResponse>(path(id, "/authorization"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `exploration-auth-${id}` },
    body: JSON.stringify(budget ? { budget } : {}),
  });
export const explorationAction = (id: string, action: "pause" | "resume" | "cancel") =>
  apiRequest<ExplorationResponse>(path(id, `/${action}`), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `exploration-${action}-${id}-${Date.now()}` },
    body: "{}",
  });
export const getExplorationEvents = (id: string, after = 0) =>
  apiRequest<{ events: unknown[]; terminal?: boolean }>(path(id, `/events${after ? `?after=${after}` : ""}`));

/** Replay-first observer. The short SSE endpoint is optional; polling remains
 * the durable source of truth and detects sequence gaps after reconnects. */
export async function observeExplorationEvents(
  id: string,
  onEvents: (events: unknown[], terminal: boolean) => void,
  signal?: AbortSignal,
): Promise<void> {
  let after = 0;
  while (!signal?.aborted) {
    const replay = await getExplorationEvents(id, after);
    const events = replay.events || [];
    if (events.length) {
      const sequences = events.map((event) => Number((event as { sequence?: unknown }).sequence));
      const first = sequences[0];
      if (Number.isFinite(first) && first > after + 1) throw new Error("exploration_event_gap");
      after = sequences.reduce((max, sequence) => (Number.isFinite(sequence) ? Math.max(max, sequence) : max), after);
      onEvents(events, Boolean((replay as { terminal?: boolean }).terminal));
    } else if ((replay as { terminal?: boolean }).terminal) {
      onEvents([], true);
      return;
    }
    if ((replay as { terminal?: boolean }).terminal) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1000);
      signal?.addEventListener("abort", () => { window.clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}
