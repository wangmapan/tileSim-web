import { describe, expect, it } from "vitest";
import {
  compareLosslessValues,
  losslessDeltaText,
  losslessPercentDeltaText,
} from "../../src/components/comparison-math";
import { formatNumber } from "../../src/lib/format";

describe("lossless comparison math", () => {
  it("compares and subtracts uint64 strings without Number precision loss", () => {
    const a = "9007199254740993";
    const b = "9007199254740995";
    expect(compareLosslessValues(a, b)).toBe(-1);
    expect(losslessDeltaText(a, b)).toBe("+2");
    expect(losslessPercentDeltaText(a, b)).toBe("0%");
  });

  it("keeps zero baselines unavailable for percent deltas", () => {
    expect(losslessPercentDeltaText(0, "1")).toBe("—");
    expect(compareLosslessValues(0n, 0)).toBe(0);
  });

  it("rejects unsafe integer numbers instead of comparing rounded values", () => {
    const unsafe = Number.MAX_SAFE_INTEGER + 2;
    expect(compareLosslessValues(unsafe, unsafe + 2)).toBeNull();
    expect(losslessDeltaText(unsafe, unsafe + 2)).toBe("—");
    expect(losslessPercentDeltaText(unsafe, unsafe + 2)).toBe("—");
    expect(formatNumber(unsafe)).toBe("—");
  });
});
