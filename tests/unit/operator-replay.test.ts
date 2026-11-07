import { describe, expect, it } from "vitest";
import { normalizeReplayDocument } from "../../src/features/execution-replay";
import type { ReplayNormalizeInput } from "../../src/features/execution-replay/model/types";
const input = (): ReplayNormalizeInput => ({
  runId: "run",
  backendIdentity: "backend",
  schemaSetRevision: "schema",
  artifactSha256: "sha",
  requestAttribution: {
    artifactId: "request-attribution",
    sha256: "sha",
    availability: "available",
    schemaIdentity: "tilesim.request_attribution.v1",
    value: {
      run_id: "run",
      evidence: {
        resource_operations: [
          {
            operation_id: "op",
            fragment_id: "fragment",
            start_time_ps: "9007199254740993",
            completion_time_ps: "9007199254740999",
            attributes: {
              kernel_launch_id: "launch",
              kernel_launch_begin_ps: "9007199254740992",
              kernel_launch_end_ps: "9007199254741000",
            },
          },
        ],
      },
    },
  },
});
describe("operator events use the shared reported timeline", () => {
  it("uses exact reported intervals for range, fragments and kernel launches without inventing waves", () => {
    const d = normalizeReplayDocument(input());
    expect(d.hasValidRange).toBe(true);
    expect(d.startPs).toBe("9007199254740992");
    expect(d.endPs).toBe("9007199254741000");
    expect(d.events.map((e) => e.kind)).toEqual(["operator_kernel", "operator_fragment"]);
    expect(d.events[1].fragmentId).toBe("fragment");
    expect(d.events[1].sourcePath).toBe("request-attribution:/evidence/resource_operations/0");
  });
  it.each(["run", "schema"])("refuses %s identity drift", (kind) => {
    const value = input();
    if (kind === "run") (value.requestAttribution!.value as Record<string, unknown>).run_id = "other";
    else value.requestAttribution!.schemaIdentity = "future";
    expect(normalizeReplayDocument(value).events).toEqual([]);
  });
  it("replays reported buffer grants and request metrics on the same exact clock", () => {
    const value = input();
    const report = value.requestAttribution!.value as {
      evidence: { resource_operations: { attributes: Record<string, string> }[]; des_events?: unknown[] };
      metrics?: unknown;
    };
    report.evidence.resource_operations[0].attributes.execution_buffer_wait_ps = "0";
    report.evidence.des_events = [
      { event_id: "grant", subject_id: "fragment", event_kind: "buffer_grant", event_time_ps: "9007199254740994" },
    ];
    report.metrics = {
      request_metrics: [
        {
          request_id: "req",
          arrival_time_ps: "9007199254740992",
          completion_time_ps: "9007199254741000",
          has_end_to_end_latency_sample: true,
        },
      ],
    };
    const d = normalizeReplayDocument(value);
    expect(d.events.find((e) => e.eventId === "buffer:grant")?.timing).toEqual({
      type: "instant",
      atPs: "9007199254740994",
    });
    expect(d.events.find((e) => e.eventId === "request-metric:req")?.sourcePath).toBe(
      "request-attribution:/metrics/request_metrics/0",
    );
  });
});
