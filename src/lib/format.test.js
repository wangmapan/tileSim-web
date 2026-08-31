import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("lossless number formatting", () => {
  it("formats an unsafe integer string without converting it to Number", () => {
    expect(formatNumber("9007199254740993")).toBe("9,007,199,254,740,993");
  });
});
