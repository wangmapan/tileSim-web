import { describe, expect, it } from "vitest";
import {
  buildFabricRouteEvidence,
  executionEventCount,
  linkEndpointEntries,
  routePathText,
} from "../../src/features/execution-inspector/model/fabric-routes";

const connected = {
  evidence: {
    fabric: {
      timeline: [
        {
          request_id: "r1",
          phase_id: "p1",
          module_id: "flow_des",
          domain_id: "su0",
          fidelity_level: "des",
          actual_path: ["gpu0", "switch0", "gpu1"],
          link_endpoints: {
            l0: { source: "gpu0", destination: "switch0" },
            l1: { source: "switch0", destination: "gpu1" },
          },
          transfers_executed: "18446744073709551615",
          end_to_end_latency_us: "18446744073709551614",
          execution_events: [
            { kind: "enqueue", link_id: "l0", time_ps: "9007199254740993" },
            { kind: "transfer_complete", link_id: "l1", time_ps: "9007199254740994" },
          ],
        },
      ],
      module_stats: [
        {
          module_id: "su0",
          domain_id: "su0",
          transfers_executed: "18446744073709551615",
          total_bytes: "18446744073709551615",
          total_runtime_us: "18446744073709551615",
        },
      ],
      fallback_reasons: [],
    },
  },
};

describe("fabric route adapter", () => {
  it("indexes backend-selected multi-hop routes without calculating values", () => {
    const evidence = buildFabricRouteEvidence(connected, "r1");
    expect(evidence.state).toBe("connected");
    expect(evidence.recordIndexes).toEqual([0]);
    expect(routePathText(evidence.records[0]?.actual_path)).toBe("gpu0 → switch0 → gpu1");
    expect(linkEndpointEntries(evidence.records[0]?.link_endpoints)).toEqual([
      { id: "l0", source: "gpu0", destination: "switch0" },
      { id: "l1", source: "switch0", destination: "gpu1" },
    ]);
    expect(evidence.records[0]?.transfers_executed).toBe("18446744073709551615");
    expect(evidence.records[0]?.end_to_end_latency_us).toBe("18446744073709551614");
    expect(executionEventCount(evidence.records[0]?.execution_events)).toBe(2);
  });

  it("distinguishes empty links, partial records, and route_unavailable", () => {
    expect(buildFabricRouteEvidence({ evidence: { fabric: { timeline: [], module_stats: [] } } }, "r1").state).toBe(
      "unavailable",
    );
    expect(
      buildFabricRouteEvidence(
        {
          evidence: { fabric: { timeline: [{ request_id: "r1", actual_path: ["gpu0", "gpu1"], link_endpoints: {} }] } },
        },
        "r1",
      ).state,
    ).toBe("partial");
    expect(
      buildFabricRouteEvidence(
        {
          evidence: {
            fabric: {
              timeline: [{ request_id: "r1", fallback_reason: "route_unavailable: missing link" }],
              fallback_reasons: ["route_unavailable: missing link"],
            },
          },
        },
        "r1",
      ).state,
    ).toBe("route_unavailable");
    expect(
      buildFabricRouteEvidence(
        {
          evidence: {
            fabric: {
              timeline: [
                {
                  request_id: "r1",
                  actual_path: ["gpu0", "gpu1"],
                  link_endpoints: { l0: { source: "gpu0", destination: "gpu1" } },
                },
              ],
              fallback_reasons: ["route_unavailable: request r2"],
            },
          },
        },
        "r1",
      ).state,
    ).toBe("connected");
  });

  it("does not infer a route from topology input", () => {
    const evidence = buildFabricRouteEvidence({ evidence: { fabric: { timeline: [], fallback_reasons: [] } } }, "r1", {
      topology: { links: [{ src_device: "gpu0", dst_device: "gpu1" }] },
    });
    expect(evidence.state).toBe("unavailable");
    expect(evidence.topologyLinkCount).toBe(1);
    expect(routePathText(undefined)).toBe("");
  });
});
