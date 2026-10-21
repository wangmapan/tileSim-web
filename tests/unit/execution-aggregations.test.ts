import { describe, expect, it } from "vitest";
import { evidenceState } from "../../src/features/execution-inspector/model/aggregations";

describe("execution evidence state", () => {
  it("treats lossless runtime and fabric counts as reported", () => {
    const summary = {
      runtime_event_count: "9007199254740993",
      fabric_record_count: 0n,
    };
    expect(evidenceState("S1", null, [], summary)).toBe("reported");
    expect(evidenceState("S6", null, [], summary)).toBe("reported");
  });

  it("keeps absent counts missing instead of treating them as zero", () => {
    expect(evidenceState("S1", null, [], {})).toBe("missing");
    expect(evidenceState("S6", null, [], {})).toBe("missing");
  });
});
