import { describe, expect, it } from "vitest";
import { formatNumber, formatPicoseconds } from "./format";

describe("lossless number formatting", () => {
  it("formats an unsafe integer string without converting it to Number", () => {
    expect(formatNumber("9007199254740993")).toBe("9,007,199,254,740,993");
  });

  it("adds a readable duration without losing the exact picosecond integer", () => {
    expect(formatPicoseconds("29229054936")).toBe("29.23 ms");
    expect(formatPicoseconds("9007199254740993")).toBe("9,007.2 s");
    expect(formatNumber("9007199254740993")).toBe("9,007,199,254,740,993");
  });
});
