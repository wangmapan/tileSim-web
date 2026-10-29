/**
 * Replay is a visual inspection tool, not a wall-clock benchmark. Keep every
 * selectable playback rate slow enough for a person to follow the active hop
 * and stage. Values are relative to the simulated timeline's original 1x
 * mapping. The fastest selectable rate is 1/1000: a replay is an inspection
 * surface, so a person must be able to follow a hop and its payload instead
 * of watching the cursor jump.
 */
export const REPLAY_SPEED_OPTIONS = [0.00005, 0.0001, 0.00025, 0.0005, 0.001] as const;
export const DEFAULT_REPLAY_SPEED = 0.0005;
export const MIN_REPLAY_SPEED = REPLAY_SPEED_OPTIONS[0];
export const MAX_REPLAY_SPEED = REPLAY_SPEED_OPTIONS[REPLAY_SPEED_OPTIONS.length - 1];

export function clampReplaySpeed(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_REPLAY_SPEED;
  return Math.min(MAX_REPLAY_SPEED, Math.max(MIN_REPLAY_SPEED, value));
}

export function replaySpeedLabel(value: number): string {
  const slowFactor = Math.round(1 / value);
  return `1/${slowFactor} 速度 · 慢 ${slowFactor} 倍`;
}
