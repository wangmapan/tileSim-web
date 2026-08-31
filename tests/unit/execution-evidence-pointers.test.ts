import { describe, expect, it } from "vitest";
import {
  attributionSource,
  causeSource,
  executionStageSource,
  phaseContributionSource,
  phaseRecordSource,
  requestMetricSource,
  validationCheckSource,
} from "../../src/features/execution-inspector";

describe("execution evidence Pointers", () => {
  it("materializes array Pointers only after a unique stable-ID match", () => {
    expect(validationCheckSource([{ check_id: "check-a" }, { check_id: "check-b" }], "check-b")).toBe(
      "validation:/checks/1",
    );
    expect(attributionSource([{ attribution_id: "attr-a" }, { attribution_id: "attr-b" }], "attr-a")).toBe(
      "tail-cause-chain:/attribution_ranking/0",
    );
    expect(executionStageSource([{ stage_id: "stage-a" }, { stage_id: "stage-b" }], "stage-b")).toBe(
      "execution-envelope:/stages/1",
    );
    expect(requestMetricSource([{ request_id: "req-a" }], "req-a", "ttft_ps")).toBe(
      "metrics:/request_metrics/0/ttft_ps",
    );
    expect(causeSource([{ cause_id: "cause-a" }], "cause-a")).toBe("tail-cause-chain:/cause_chain/0");
    const sharedMemoryPhases = [
      { phase_id: "phase-a", memory_event_id: "memory-a" },
      { phase_id: "phase-b", memory_event_id: "memory-a" },
    ];
    expect(phaseRecordSource(sharedMemoryPhases, sharedMemoryPhases[1], "memory_event_id")).toBe(
      "metrics:/system_summary/phase_fabric_contributions/1",
    );
  });

  it("fails closed for missing and duplicate stable IDs", () => {
    expect(validationCheckSource([{ check_id: "duplicate" }, { check_id: "duplicate" }], "duplicate")).toBeNull();
    expect(attributionSource([{ component_code: "opaque" }], undefined)).toBeNull();
    expect(executionStageSource([{ stage_id: "stage-a" }], "missing")).toBeNull();
    expect(
      phaseContributionSource(
        [
          { phase_id: "phase-a", collective_id: "collective-a" },
          { phase_id: "phase-b", collective_id: "collective-a" },
        ],
        { field: "collective_id", id: "collective-a" },
      ),
    ).toBeNull();
  });
});
