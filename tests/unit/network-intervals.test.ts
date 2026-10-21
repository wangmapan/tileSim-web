import { describe, expect, it } from "vitest";
import { analyzeNetworkIntervals } from "../../src/features/execution-inspector";

describe("network interval attribution", () => {
  it("detects overlap and duplicate explanations without adding parent wait twice", () => {
    const result = analyzeNetworkIntervals([
      {
        component_code: "queue",
        demand_id: "d0",
        link_id: "l0",
        attempt: "9007199254740993",
        start_time_ps: 0,
        end_time_ps: 10,
      },
      {
        component_code: "service",
        demand_id: "d0",
        link_id: "l0",
        attempt: "9007199254740993",
        start_time_ps: 5,
        end_time_ps: 15,
      },
      {
        component_code: "service",
        demand_id: "d0",
        link_id: "l0",
        attempt: "9007199254740993",
        start_time_ps: 5,
        end_time_ps: 15,
      },
    ]);
    expect(result.valid).toHaveLength(3);
    expect(result.overlapPairs).toBe(3);
    expect(result.duplicateCount).toBe(1);
  });

  it("keeps empty and reversed intervals unavailable", () => {
    const result = analyzeNetworkIntervals([
      { start_time_ps: 4, end_time_ps: 4 },
      { start_time_ps: 8, end_time_ps: 2 },
    ]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });
});
