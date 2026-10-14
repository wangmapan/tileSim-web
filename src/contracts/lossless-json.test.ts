import { describe, expect, it } from "vitest";
import { losslessIntegerToBigInt, parseJsonLossless, stringifyJsonLossless } from "./lossless-json";

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

  it("serializes normalized BigInt fields as exact JSON numbers without changing strings", () => {
    const text = stringifyJsonLossless({
      time_ps: 9007199254740993n,
      count: 49n,
      label: "9007199254740993",
      latency_us: 19.17,
    });
    expect(text).toBe('{"time_ps":9007199254740993,"count":49,"label":"9007199254740993","latency_us":19.17}');
    expect((parseJsonLossless(text) as { time_ps: string }).time_ps).toBe("9007199254740993");
  });
});
