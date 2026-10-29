import { describe, expect, it } from "vitest";
import {
  clampReplaySpeed,
  DEFAULT_REPLAY_SPEED,
  MAX_REPLAY_SPEED,
  MIN_REPLAY_SPEED,
  REPLAY_SPEED_OPTIONS,
  replaySpeedLabel,
} from "../../src/features/execution-replay/model/speed";

describe("execution replay slow-motion speed", () => {
  it("defaults to one-two-thousandth speed and never offers a faster rate", () => {
    expect(DEFAULT_REPLAY_SPEED).toBe(0.0005);
    expect(Math.max(...REPLAY_SPEED_OPTIONS)).toBe(MAX_REPLAY_SPEED);
    expect(MAX_REPLAY_SPEED).toBe(0.001);
    expect(MIN_REPLAY_SPEED).toBe(0.00005);
    expect(replaySpeedLabel(DEFAULT_REPLAY_SPEED)).toContain("1/2000");
  });

  it("clamps invalid or out-of-range values to the inspection-safe range", () => {
    expect(clampReplaySpeed(Number.NaN)).toBe(DEFAULT_REPLAY_SPEED);
    expect(clampReplaySpeed(2)).toBe(MAX_REPLAY_SPEED);
    expect(clampReplaySpeed(0.00001)).toBe(MIN_REPLAY_SPEED);
    expect(clampReplaySpeed(0.005)).toBe(MAX_REPLAY_SPEED);
  });
});
