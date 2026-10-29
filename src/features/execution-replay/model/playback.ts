import type { ReplayEvent, ReplayStage } from "./types";
import { eventTime } from "./normalize";

export type ReplayEventState = "pending" | "active" | "completed";

function isNonNegativeInteger(value: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(value);
}

function compareTimes(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

/**
 * Keep playback boundaries deterministic even when a caller supplies an
 * unsorted/duplicated list (for example, while two artifacts are refreshing).
 * Invalid values are ignored instead of turning a keyboard step into a thrown
 * BigInt conversion error.
 */
function normalizedTimes(times: string[]): string[] {
  return [...new Set(times.filter(isNonNegativeInteger))].sort(compareTimes);
}

/**
 * Return a bounded progress value without converting 64-bit simulation times
 * to Number before subtracting. The replay timeline keeps ps values lossless;
 * the topology token is the one place that needs a fractional display value.
 */
export function intervalProgress(cursorPs: string, timing: { startPs: string; endPs: string }): number {
  const start = BigInt(timing.startPs);
  const end = BigInt(timing.endPs);
  const cursor = BigInt(cursorPs);
  const span = end - start;
  if (span <= 0n || cursor <= start) return 0;
  if (cursor >= end) return 1;
  const scale = 1_000_000n;
  const scaled = ((cursor - start) * scale) / span;
  return Number(scaled) / Number(scale);
}

export function eventState(event: ReplayEvent, cursorPs: string): ReplayEventState {
  const cursor = BigInt(cursorPs);
  if (event.timing.type === "instant") return BigInt(event.timing.atPs) <= cursor ? "completed" : "pending";
  const start = BigInt(event.timing.startPs);
  const end = BigInt(event.timing.endPs);
  if (cursor < start) return "pending";
  if (cursor < end) return "active";
  return "completed";
}

export function stageState(stage: ReplayStage, cursorPs: string): ReplayEventState {
  if (!stage.timing) return stage.pointPs && BigInt(stage.pointPs) <= BigInt(cursorPs) ? "completed" : "pending";
  const cursor = BigInt(cursorPs);
  if (cursor < BigInt(stage.timing.startPs)) return "pending";
  if (cursor < BigInt(stage.timing.endPs)) return "active";
  return "completed";
}

export function playbackTimes(events: ReplayEvent[], stages: ReplayStage[]): string[] {
  const values = [
    ...events.flatMap((event) =>
      event.timing.type === "interval" ? [event.timing.startPs, event.timing.endPs] : [eventTime(event)],
    ),
    ...stages.flatMap((stage) => [stage.timing?.startPs, stage.timing?.endPs, stage.pointPs]),
  ].filter((value): value is string => Boolean(value));
  return normalizedTimes(values);
}

export function nextPlaybackTime(currentPs: string, times: string[], direction: 1 | -1): string {
  const orderedTimes = normalizedTimes(times);
  if (!orderedTimes.length || !isNonNegativeInteger(currentPs)) return currentPs;
  const current = BigInt(currentPs);
  const candidates =
    direction > 0
      ? orderedTimes.filter((time) => BigInt(time) > current)
      : orderedTimes.filter((time) => BigInt(time) < current);
  // At either boundary, remain on that boundary. This is intentionally not a
  // wrap-around: keyboard stepping must never jump a user to another phase.
  return direction > 0 ? candidates[0] || orderedTimes[orderedTimes.length - 1] : candidates.at(-1) || orderedTimes[0];
}

export function nextStageTime(currentPs: string, stages: ReplayStage[], direction: 1 | -1): string {
  const times = stages
    .flatMap((stage) => [stage.timing?.startPs, stage.timing?.endPs, stage.pointPs])
    .filter((value): value is string => Boolean(value));
  return nextPlaybackTime(currentPs, times, direction);
}
