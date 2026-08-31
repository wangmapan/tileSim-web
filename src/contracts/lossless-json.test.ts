import { describe, expect, it } from "vitest";
import { losslessIntegerToBigInt, parseJsonLossless } from "./lossless-json";

describe("lossless JSON contract boundary", () => {
  it("keeps unsafe picosecond integers exact while retaining normal numbers", () => {
    const parsed = parseJsonLossless('{"time_ps":9007199254740993,"latency_us":19.17}') as {
      time_ps: string;
      latency_us: number;
    };
    expect(parsed.time_ps).toBe("9007199254740993");
    expect(losslessIntegerToBigInt(parsed.time_ps)).toBe(9007199254740993n);
    expect(parsed.latency_us).toBe(19.17);
  });

  it("rejects duplicate keys instead of silently replacing evidence", () => {
    expect(() => parseJsonLossless('{"time_ps":1,"time_ps":2}')).toThrow(/duplicate key/i);
  });
});
