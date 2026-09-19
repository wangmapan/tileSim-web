import { describe, expect, it } from "vitest";
import { parseTopologyDocument } from "../../src/features/run-experiment/topology-graph";

const valid = {
  topology_name: "demo",
  devices: [{ device_id: "gpu-0", device_type: "gpu" }, { device_id: "gpu-1" }],
  module_bindings: [{ module_name: "nvlink", module_kind: "scale_up" }],
  domains: [{ domain_id: "d0", domain_type: "scale_up", member_devices: ["gpu-0", "gpu-1"], module_binding: "nvlink" }],
  links: [{ src_device: "gpu-0", dst_device: "gpu-1", domain_id: "d0", latency_us: 0 }],
};
const validEnvelope = {
  scenario_name: "demo",
  provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory_s6_only",
  },
  topology: valid,
  workload: { requests: [] },
};

describe("topology graph model", () => {
  it("accepts supported topology and preserves missing versus zero fields", () => {
    const result = parseTopologyDocument(JSON.stringify(validEnvelope));
    expect(result.error).toBe("");
    expect(result.document?.links?.[0]).toEqual(expect.objectContaining({ latency_us: 0 }));
    expect(result.document?.links?.[0]).not.toHaveProperty("bandwidth_gbps");
  });
  it("accepts canonical topology-request envelope and preserves non-topology sections", () => {
    const result = parseTopologyDocument(
      JSON.stringify({
        scenario_name: "demo",
        provenance: {
          source_mode: "synthetic_trace",
          calibration_level: "uncalibrated",
          allowed_claim_scope: "exploratory_s6_only",
        },
        topology: valid,
        workload: { requests: [] },
      }),
    );
    expect(result.error).toBe("");
    expect(result.envelope).toBeTruthy();
    expect(result.document?.devices).toHaveLength(2);
  });
  it.each([
    ["bare topology", valid],
    ["missing topology", { scenario_name: "demo" }],
    ["empty scenario name", { ...validEnvelope, scenario_name: "" }],
    ["empty topology name", { ...validEnvelope, topology: { ...valid, topology_name: "" } }],
    ["incomplete provenance", { topology: valid, provenance: { source_mode: "synthetic_trace" } }],
    ["null links", { topology: { ...valid, links: null } }],
    ["invalid workload request", { topology: valid, workload: { requests: [{ request_id: "r", tp_degree: 0 }] } }],
  ])("fails closed for non-submit-ready %s", (_label, value) => {
    const result = parseTopologyDocument(JSON.stringify(value));
    expect(result.document).toBeNull();
    expect(result.error).toBeTruthy();
  });
  it.each([
    ["unknown root field", { ...valid, flow: "invented" }],
    ["unknown link field", { ...valid, links: [{ ...valid.links[0], traffic_gbps: 2 }] }],
    ["missing endpoint", { ...valid, links: [{ ...valid.links[0], dst_device: "missing" }] }],
    ["missing domain", { ...valid, links: [{ ...valid.links[0], domain_id: "missing" }] }],
    ["unknown module field", { ...valid, module_bindings: [{ ...valid.module_bindings[0], x: true }] }],
    ["dangling domain member", { ...valid, domains: [{ ...valid.domains[0], member_devices: ["gpu-0", "missing"] }] }],
  ])("fails closed for %s", (_label, value) => {
    expect(parseTopologyDocument(JSON.stringify(value)).document).toBeNull();
    expect(parseTopologyDocument(JSON.stringify(value)).error).toBeTruthy();
  });
  it("reports malformed JSON without throwing", () => {
    expect(parseTopologyDocument("{").error).toContain("JSON");
  });
});
