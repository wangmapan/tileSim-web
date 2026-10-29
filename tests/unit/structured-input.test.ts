import { describe, expect, it } from "vitest";
import { createRunRequest as validateCreateRunRequest } from "../../src/contracts/generated/experiment-validators.js";
import { topologyModuleBindingMaxItems } from "../../src/features/run-experiment/input-schema-meta";
import {
  addDomain,
  addModuleBinding,
  addTopologyDevice,
  appendRequestRow,
  clearParticipants,
  cloneJson,
  domainIdsOf,
  duplicateRequestRow,
  moduleBindingNamesOf,
  moduleBindingReferences,
  MODULE_NAME_PREFIX,
  nextDomainId,
  nextModuleBindingName,
  parseJsonDocument,
  patchJsonDocument,
  participantDeviceIdsOf,
  requestParticipantCountIssue,
  removeDevice,
  removeDomain,
  removeModuleBinding,
  removeRequestRow,
  renameDevice,
  renameDomain,
  renameModuleBinding,
  rewriteParticipants,
  rewriteParticipantsForExistingTp,
  rewriteRequestParallelism,
  runtimeRequestsOf,
  seedEntriesFromControls,
  seedStructuredInput,
  serializeJsonDocument,
  setDeviceCount,
  setGpuCount,
  setDomainMember,
  setDomainModuleBinding,
  setDomainType,
  setModuleBindingKind,
  setModuleBindingText,
  topologyDevicesOf,
  topologyDomainsOf,
  validateRuntimeRequests,
  writeControlPointer,
  readControlPointer,
  type JsonObject,
} from "../../src/features/run-experiment/structured-input";
import { parseTopologyDocument } from "../../src/features/run-experiment/topology-graph";
import type { ExperimentControlDescriptor } from "../../src/features/run-experiment/types";

/**
 * Two properties are load-bearing here and must not regress:
 *
 *  1. Fidelity (R1). The JSON text is the single source of truth. Anything the
 *     panel does not render — unknown keys, unknown nested shapes — must survive
 *     a form-to-raw-to-form round trip byte for byte. These tests deliberately
 *     inject vendor-style unknown keys and compare deep structures.
 *  2. Range provenance. `kv_admission_watermark` is 0..1 inside a runtime policy
 *     but 0.05..1 as a run override. A policy edit must accept 0.02; if a range
 *     were ever hand-copied from the override schema instead, this test fails.
 */

const runtimeTrace = (): JsonObject => ({
  trace_name: "fixture-trace",
  policy: { batch_scheduler: "fifo", max_batch_size: 4 },
  requests: [
    { request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0", "gpu1"] },
    { request_id: "req_b", arrival_time_ps: 10, phase: "decode", tp_degree: 2, participants: ["gpu0", "gpu1"] },
  ],
});

const topology = (): JsonObject => ({
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
    ],
    module_bindings: [
      { module_name: "su-module", module_kind: "scale_up", override_params: { bandwidth_gbps: 900, latency_us: 1 } },
      { module_name: "so-module", module_kind: "scale_out", override_params: { bandwidth_gbps: 100, latency_us: 10 } },
    ],
    domains: [
      {
        domain_id: "su0",
        domain_type: "scale_up",
        member_devices: ["gpu0", "gpu1"],
        module_binding: "su-module",
      },
    ],
    links: [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }],
  },
});

/** A vendor key the panel has no control for, at two different nesting depths. */
const UNKNOWN_KEYS: JsonObject = {
  x_vendor_extension: { nested: [1, 2, { deep: null }], flag: true },
  unknown_top_level: "keep-me",
};

const runtimeText = (): string => serializeJsonDocument({ ...UNKNOWN_KEYS, ...runtimeTrace() });
const topologyText = (): string => serializeJsonDocument({ ...UNKNOWN_KEYS, ...topology() });

describe("R1 dual-view fidelity", () => {
  it("round-trips a document through parse and serialise without loss", () => {
    const original = { ...UNKNOWN_KEYS, ...runtimeTrace() };
    const parsed = parseJsonDocument(serializeJsonDocument(original), "Runtime trace");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(original);
  });

  it("preserves unknown keys verbatim while a policy control is edited", () => {
    const edited = patchJsonDocument(runtimeText(), "Runtime trace", (draft) => {
      (draft.policy as JsonObject).kv_admission_watermark = 0.02;
    });
    const after = JSON.parse(edited) as JsonObject;
    expect(after.x_vendor_extension).toEqual(UNKNOWN_KEYS.x_vendor_extension);
    expect(after.unknown_top_level).toBe("keep-me");
    expect((after.policy as JsonObject).kv_admission_watermark).toBe(0.02);
    // Untouched pre-existing policy keys are still there.
    expect((after.policy as JsonObject).batch_scheduler).toBe("fifo");
  });

  it("preserves unknown keys through a full form -> raw -> form cycle", () => {
    // Simulate four control edits in a row, each re-parsing the previous text
    // (this is exactly what the components do: text is the single source).
    let runtime = runtimeText();
    runtime = patchJsonDocument(runtime, "Runtime trace", (draft) => {
      (draft.policy as JsonObject).kv_admission_watermark = 0.02;
    });
    runtime = patchJsonDocument(runtime, "Runtime trace", (draft) => {
      appendRequestRow(draft);
    });
    runtime = patchJsonDocument(runtime, "Runtime trace", (draft) => {
      duplicateRequestRow(draft, 0);
    });
    runtime = patchJsonDocument(runtime, "Runtime trace", (draft) => {
      removeRequestRow(draft, 1);
    });

    let topo = topologyText();
    topo = patchJsonDocument(topo, "Fabric topology", (draft) => {
      setDeviceCount(draft, 4);
    });
    topo = patchJsonDocument(topo, "Fabric topology", (draft) => {
      removeDevice(draft, "gpu3");
    });

    for (const [text, label] of [
      [runtime, "runtime"],
      [topo, "topology"],
    ] as const) {
      const value = JSON.parse(text) as JsonObject;
      expect(value.x_vendor_extension, label).toEqual(UNKNOWN_KEYS.x_vendor_extension);
      expect(value.unknown_top_level, label).toBe("keep-me");
    }

    // And the form view can still read the structures it renders.
    const runtimeDoc = JSON.parse(runtime) as JsonObject;
    expect(runtimeRequestsOf(runtimeDoc)?.length).toBe(3);
    const topoDoc = JSON.parse(topo) as JsonObject;
    expect(topologyDevicesOf(topoDoc)?.length).toBe(3);
  });

  it("keeps the rendered structures intact after an unrelated edit", () => {
    const edited = patchJsonDocument(runtimeText(), "Runtime trace", (draft) => {
      (draft.policy as JsonObject).batch_scheduler = "decode_priority";
    });
    const after = JSON.parse(edited) as JsonObject;
    expect(after.requests).toEqual(runtimeTrace().requests);
    expect(after.trace_name).toBe("fixture-trace");
  });
});

describe("quick-control projection", () => {
  it("reads a policy scalar from the structured runtime document", () => {
    expect(
      readControlPointer({
        runtimeJson: runtimeText(),
        topologyJson: topologyText(),
        pointer: "/overrides/runtime/max_batch_size",
      }),
    ).toEqual({ supported: true, found: true, value: 4 });
  });

  it("refuses to guess a scalar when module bindings disagree", () => {
    const changed = JSON.parse(topologyText()) as JsonObject;
    const modules = (changed.topology as JsonObject).module_bindings as JsonObject[];
    modules[0].override_params = { bandwidth_gbps: 901 };
    modules.push({ module_name: "su-module-2", module_kind: "scale_up", override_params: { bandwidth_gbps: 902 } });
    expect(
      readControlPointer({
        runtimeJson: runtimeText(),
        topologyJson: serializeJsonDocument(changed),
        pointer: "/overrides/fabric/scale_up_bandwidth_gbps",
      }),
    ).toEqual({ supported: true, found: false });
  });
});

describe("request table validation", () => {
  it("accepts the shipped-shaped two-row table", () => {
    expect(validateRuntimeRequests(runtimeTrace().requests).issues).toEqual([]);
  });

  it("reports a descending arrival_time_ps", () => {
    const requests = [
      { request_id: "a", arrival_time_ps: 10 },
      { request_id: "b", arrival_time_ps: 5 },
    ];
    const issues = validateRuntimeRequests(requests).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("arrival_time_ps");
    expect(issues[0].message).toContain("必须非递减");
  });

  it("reports a duplicated request_id", () => {
    const requests = [
      { request_id: "same", arrival_time_ps: 0 },
      { request_id: "same", arrival_time_ps: 1 },
    ];
    const issues = validateRuntimeRequests(requests).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("重复");
  });

  it("reports an empty request_id", () => {
    const issues = validateRuntimeRequests([{ request_id: "", arrival_time_ps: 0 }]).issues;
    expect(issues.some((issue) => issue.field === "request_id")).toBe(true);
  });

  it("rejects 1025 rows and accepts 1024", () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ request_id: `r${index}`, arrival_time_ps: index }));
    expect(validateRuntimeRequests(rows(1024)).issues).toEqual([]);
    const tooMany = validateRuntimeRequests(rows(1025)).issues;
    expect(tooMany).toHaveLength(1);
    expect(tooMany[0].message).toContain("1024");
  });

  it("rejects an empty request list", () => {
    const issues = validateRuntimeRequests([]).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("row");
  });

  it("rejects an out-of-range tp_degree and a non-string participant", () => {
    const issues = validateRuntimeRequests([{ request_id: "a", tp_degree: 0, participants: ["gpu0", 7] }]).issues;
    expect(issues.some((issue) => issue.field === "tp_degree")).toBe(true);
    expect(issues.some((issue) => issue.field === "participants")).toBe(true);
  });

  it("requires explicit participants to match tp_degree", () => {
    const issues = validateRuntimeRequests([
      { request_id: "a", tp_degree: 2, participants: ["gpu0", "gpu1", "gpu2"] },
    ]).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("tp_degree");
    expect(issues[0].message).toContain("参与设备数量");
  });

  it.each([
    ["participants missing", { request_id: "a", tp_degree: 2 }, null],
    ["participants empty", { request_id: "a", tp_degree: 2, participants: [] }, null],
    ["participants match", { request_id: "a", tp_degree: 2, participants: ["gpu0", "gpu1"] }, null],
  ])("keeps engine-derived or valid participants: %s", (_label, row, expected) => {
    expect(requestParticipantCountIssue(0, row)).toEqual(expected);
  });

  it("reports a non-integer TP when explicit participants are present", () => {
    const issue = requestParticipantCountIssue(0, { request_id: "a", tp_degree: 2.5, participants: ["gpu0", "gpu1"] });
    expect(issue?.field).toBe("tp_degree");
    expect(issue?.message).toContain("必须等于参与设备数量");
  });

  it.each([
    ["non-string", ["gpu0", 1]],
    ["empty", ["gpu0", ""]],
  ])("reports an invalid participant identity: %s", (_label, participants) => {
    const issue = requestParticipantCountIssue(0, { request_id: "a", tp_degree: 2, participants });
    expect(issue?.field).toBe("participants");
    expect(issue?.message).toContain("非空字符串");
  });
});

describe("request row operations", () => {
  it("appends a row that keeps arrival non-decreasing and reuses tp_degree", () => {
    const doc = runtimeTrace();
    appendRequestRow(doc);
    const requests = runtimeRequestsOf(doc) as JsonObject[];
    expect(requests).toHaveLength(3);
    const added = requests[2];
    expect(String(added.request_id).length).toBeGreaterThan(0);
    expect(added.arrival_time_ps).toBe(10);
    expect(added.tp_degree).toBe(2);
    expect(validateRuntimeRequests(requests).issues).toEqual([]);
  });

  it("duplicates a row directly beneath the source with a fresh id", () => {
    const doc = runtimeTrace();
    duplicateRequestRow(doc, 0);
    const requests = runtimeRequestsOf(doc) as JsonObject[];
    expect(requests).toHaveLength(3);
    expect(requests[1].participants).toEqual(["gpu0", "gpu1"]);
    expect(requests[1].request_id).not.toBe("req_a");
    expect(validateRuntimeRequests(requests).issues).toEqual([]);
  });

  it("refuses to drop below the contract minimum of one row", () => {
    const doc = { policy: {}, requests: [{ request_id: "only" }] };
    expect(() => removeRequestRow(doc, 0)).toThrowError();
  });

  it("rewrites every participants list with the new device set", () => {
    const doc = runtimeTrace();
    expect(rewriteParticipants(doc, ["gpu0", "gpu1", "gpu2", "gpu3"])).toBe(2);
    for (const row of runtimeRequestsOf(doc) as JsonObject[]) {
      expect(row.participants).toEqual(["gpu0", "gpu1", "gpu2", "gpu3"]);
    }
  });

  it("can explicitly synchronize TP and participants for a resized inventory", () => {
    const doc = runtimeTrace();
    expect(rewriteRequestParallelism(doc, ["gpu0", "gpu1", "gpu2", "gpu3"])).toBe(2);
    for (const row of runtimeRequestsOf(doc) as JsonObject[]) {
      expect(row.tp_degree).toBe(4);
      expect(row.participants).toEqual(["gpu0", "gpu1", "gpu2", "gpu3"]);
    }
  });

  it("keeps an existing TP valid by selecting a prefix of the new inventory", () => {
    const doc = runtimeTrace();
    expect(rewriteParticipantsForExistingTp(doc, ["gpu0", "gpu1", "gpu2", "gpu3"])).toBe(2);
    for (const row of runtimeRequestsOf(doc) as JsonObject[]) {
      expect(row.tp_degree).toBe(2);
      expect(row.participants).toEqual(["gpu0", "gpu1"]);
    }
  });

  it("refuses to preserve a TP larger than the new device set", () => {
    const doc = runtimeTrace();
    (runtimeRequestsOf(doc) as JsonObject[])[0].tp_degree = 4;
    expect(() => rewriteParticipantsForExistingTp(doc, ["gpu0", "gpu1"])).toThrowError(/TP/);
  });

  it("refuses a duplicated device identity when rewriting request participants", () => {
    const doc = runtimeTrace();
    expect(() => rewriteRequestParallelism(doc, ["gpu0", "gpu0"])).toThrowError(/重复 device_id/);
  });

  it("clears participants and counts rows left without tp_degree", () => {
    const doc = runtimeTrace();
    (runtimeRequestsOf(doc) as JsonObject[])[1].tp_degree = undefined;
    delete (runtimeRequestsOf(doc) as JsonObject[])[1].tp_degree;
    const outcome = clearParticipants(doc);
    expect(outcome.cleared).toBe(2);
    expect(outcome.missingTpDegree).toBe(1);
    for (const row of runtimeRequestsOf(doc) as JsonObject[]) {
      expect("participants" in row).toBe(false);
    }
  });
});

describe("device inventory operations", () => {
  it("keeps fabric nodes out of the GPU participant inventory", () => {
    const doc = topology();
    addTopologyDevice(doc, "Switch", "sw");
    addTopologyDevice(doc, "NIC", "nic");
    expect(participantDeviceIdsOf(doc)).toEqual(["gpu0", "gpu1"]);
    const change = setGpuCount(doc, 3);
    expect(change.added).toEqual(["gpu2"]);
    expect((topologyDevicesOf(doc) as JsonObject[]).map((device) => device.device_type)).toEqual([
      "GPU",
      "GPU",
      "Switch",
      "NIC",
      "GPU",
    ]);
  });

  it("grows to the requested count with consecutive gpu{n} names", () => {
    const doc = topology();
    const change = setDeviceCount(doc, 4);
    expect(change.added).toEqual(["gpu2", "gpu3"]);
    expect(topologyDevicesOf(doc)?.length).toBe(4);
  });

  it("skips names already in use when adding", () => {
    const doc = topology();
    (topologyDevicesOf(doc) as JsonObject[])[1].device_id = "gpu7";
    const change = setDeviceCount(doc, 4);
    // gpu0 and gpu7 are taken, so the next free consecutive names are gpu1/gpu2.
    expect(change.added).toEqual(["gpu1", "gpu2"]);
  });

  it("reports the references cleaned up when shrinking", () => {
    const doc = topology();
    const change = setDeviceCount(doc, 1);
    expect(change.removed).toEqual(["gpu1"]);
    // gpu1 was a domain member and one end of the only link.
    expect(change.cleaned).toHaveLength(1);
    const cleaned = change.cleaned[0];
    expect(cleaned.domains).toEqual(["su0"]);
    expect(cleaned.links).toEqual([0]);
    const topo = doc.topology as JsonObject;
    expect(topo.domains).toEqual([
      { domain_id: "su0", domain_type: "scale_up", member_devices: ["gpu0"], module_binding: "su-module" },
    ]);
    expect(topo.links).toEqual([]);
  });

  it("renames a device and rewrites domains and links references", () => {
    const doc = topology();
    renameDevice(doc, "gpu1", "gpu9");
    const topo = doc.topology as JsonObject;
    expect((topo.domains as JsonObject[])[0].member_devices).toEqual(["gpu0", "gpu9"]);
    expect((topo.links as JsonObject[])[0].dst_device).toBe("gpu9");
  });

  it("refuses a rename onto an existing device_id", () => {
    const doc = topology();
    expect(() => renameDevice(doc, "gpu0", "gpu1")).toThrowError();
  });

  it("rejects a card count above the contract maximum", () => {
    const doc = topology();
    expect(() => setDeviceCount(doc, 1025)).toThrowError();
  });
});

describe("domain list operations", () => {
  it("names a new domain after its type and skips names already in use", () => {
    expect(nextDomainId(["su0", "su2"], "scale_up")).toBe("su1");
    expect(nextDomainId([], "scale_out")).toBe("so0");
  });

  it("adds an empty domain bound to a declared module", () => {
    const doc = topology();
    const id = nextDomainId(domainIdsOf(doc), "scale_up");
    addDomain(doc, { domain_id: id, domain_type: "scale_up", module_binding: "su-module" });
    expect(id).toBe("su1");
    expect(topologyDomainsOf(doc)?.at(-1)).toEqual({
      domain_id: "su1",
      domain_type: "scale_up",
      member_devices: [],
      module_binding: "su-module",
    });
  });

  it("refuses a duplicate domain_id and a blank module binding", () => {
    const doc = topology();
    expect(() =>
      addDomain(doc, { domain_id: "su0", domain_type: "scale_up", module_binding: "su-module" }),
    ).toThrowError();
    expect(() => addDomain(doc, { domain_id: "su1", domain_type: "scale_up", module_binding: "  " })).toThrowError();
  });

  it("lists the declared module names for the binding picker", () => {
    expect(moduleBindingNamesOf(topology())).toEqual([
      { name: "su-module", kind: "scale_up" },
      { name: "so-module", kind: "scale_out" },
    ]);
  });

  it("ticks a device in and out of a domain", () => {
    const doc = topology();
    setDomainMember(doc, "su0", "gpu1", false);
    expect((topologyDomainsOf(doc) as JsonObject[])[0].member_devices).toEqual(["gpu0"]);
    setDomainMember(doc, "su0", "gpu1", true);
    expect((topologyDomainsOf(doc) as JsonObject[])[0].member_devices).toEqual(["gpu0", "gpu1"]);
  });

  it("refuses to tick in a device that is not in the device list", () => {
    const doc = topology();
    expect(() => setDomainMember(doc, "su0", "gpu9", true)).toThrowError();
  });

  it("switches the type and the bound module of a domain", () => {
    const doc = topology();
    setDomainType(doc, "su0", "scale_out");
    setDomainModuleBinding(doc, "su0", "so-module");
    const domain = (topologyDomainsOf(doc) as JsonObject[])[0];
    expect(domain.domain_type).toBe("scale_out");
    expect(domain.module_binding).toBe("so-module");
  });

  it("renames a domain and rewrites the links that pointed at it", () => {
    const doc = topology();
    renameDomain(doc, "su0", "su9");
    const topo = doc.topology as JsonObject;
    expect((topo.links as JsonObject[])[0].domain_id).toBe("su9");
    expect(domainIdsOf(doc)).toEqual(["su9"]);
  });

  it("refuses a rename onto an existing domain_id", () => {
    const doc = topology();
    addDomain(doc, { domain_id: "su1", domain_type: "scale_up", module_binding: "su-module" });
    expect(() => renameDomain(doc, "su0", "su1")).toThrowError();
  });

  it("removes a domain together with the links that belonged to it", () => {
    const doc = topology();
    const references = removeDomain(doc, "su0");
    expect(references.links).toEqual([0]);
    expect(domainIdsOf(doc)).toEqual([]);
    expect((doc.topology as JsonObject).links).toEqual([]);
  });

  /**
   * `removeDomain` exists because the strict parser rejects a link whose domain
   * is gone. Both halves are asserted: the cleaned document parses, and the
   * un-cleaned one does not.
   */
  it("keeps the document acceptable to the strict topology parser", () => {
    const doc = topology();
    addDomain(doc, { domain_id: "so0", domain_type: "scale_out", module_binding: "so-module" });
    setDomainMember(doc, "so0", "gpu1", true);
    expect(parseTopologyDocument(serializeJsonDocument(doc)).error).toBe("");

    const orphaned = cloneJson(doc);
    const orphanTopology = orphaned.topology as JsonObject;
    orphanTopology.domains = (orphanTopology.domains as JsonObject[]).filter((entry) => entry.domain_id !== "su0");
    expect(parseTopologyDocument(serializeJsonDocument(orphaned)).error).toContain("domain 不存在");
  });

  it("keeps the document submittable after adding a domain and its members", () => {
    let text = topologyText();
    text = patchJsonDocument(text, "Fabric topology", (draft) => {
      addDomain(draft, { domain_id: "so0", domain_type: "scale_out", module_binding: "so-module" });
      setDomainMember(draft, "so0", "gpu0", true);
      setDomainMember(draft, "so0", "gpu1", true);
    });
    const doc = JSON.parse(text) as JsonObject;
    const request = {
      scenario_id: "s1_des_example",
      custom_inputs: {
        runtime_trace: runtimeTrace(),
        topology: { topology: doc.topology },
      },
    };
    expect(validateCreateRunRequest(request)).toBe(true);
    // A blank module binding violates the contract, so the assertion above is
    // not vacuous.
    const broken = JSON.parse(JSON.stringify(request)) as JsonObject;
    const brokenTopology = ((broken.custom_inputs as JsonObject).topology as JsonObject).topology as JsonObject;
    ((brokenTopology.domains as JsonObject[])[1] as JsonObject).module_binding = "";
    expect(validateCreateRunRequest(broken)).toBe(false);
  });
});

describe("R2 carry-in from the quick controls", () => {
  const descriptor = (fieldId: string, requestJsonPointer: string): ExperimentControlDescriptor =>
    ({
      fieldId,
      requestJsonPointer,
      available: true,
      applicableInputModes: ["controls", "json"],
      label: fieldId,
      controlKind: "number",
    }) as unknown as ExperimentControlDescriptor;

  it("separates runtime, fabric and workload pointers", () => {
    const entries = seedEntriesFromControls(
      [
        descriptor("a", "/overrides/runtime/max_active_requests"),
        descriptor("b", "/overrides/fabric/scale_up_bandwidth_gbps"),
        descriptor("c", "/overrides/workload/message_size_multiplier"),
      ],
      { a: 8, b: 900, c: 2 },
    );
    expect(entries.map((entry) => entry.pointer)).toEqual([
      "/overrides/runtime/max_active_requests",
      "/overrides/fabric/scale_up_bandwidth_gbps",
      "/overrides/workload/message_size_multiplier",
    ]);
  });

  it("writes runtime keys into policy and fabric keys into the matching binding", () => {
    const result = seedStructuredInput({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      entries: [
        { pointer: "/overrides/runtime/max_active_requests", value: 8 },
        { pointer: "/overrides/runtime/kv_admission_watermark", value: 0.02 },
        { pointer: "/overrides/fabric/scale_up_bandwidth_gbps", value: 1234 },
      ],
    });

    const runtime = JSON.parse(result.runtimeJson) as JsonObject;
    expect((runtime.policy as JsonObject).max_active_requests).toBe(8);
    // 0.02 only survives because the policy range (0..1) is used, not the
    // override range (0.05..1).
    expect((runtime.policy as JsonObject).kv_admission_watermark).toBe(0.02);
    expect(runtime.x_vendor_extension).toEqual(UNKNOWN_KEYS.x_vendor_extension);

    const topo = JSON.parse(result.topologyJson) as JsonObject;
    const bindings = (topo.topology as JsonObject).module_bindings as JsonObject[];
    expect((bindings[0].override_params as JsonObject).bandwidth_gbps).toBe(1234);
    // scale_out is untouched.
    expect((bindings[1].override_params as JsonObject).bandwidth_gbps).toBe(100);

    expect(result.notes.some((note) => note.code === "runtime_seeded" && !note.impedes)).toBe(true);
    expect(result.notes.some((note) => note.code === "fabric_seeded" && !note.impedes)).toBe(true);
  });

  it("does not silently rescale the workload multiplier", () => {
    const result = seedStructuredInput({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      entries: [{ pointer: "/overrides/workload/message_size_multiplier", value: 2 }],
    });
    const note = result.notes.find((entry) => entry.code === "workload_multiplier_not_rescaled");
    expect(note).toBeDefined();
    expect(note?.impedes).toBe(true);
    // Nothing was written anywhere for this pointer.
    expect(result.runtimeJson).toBe(runtimeText());
    expect(result.topologyJson).toBe(topologyText());
  });

  it("reports rather than throws when the runtime trace is empty", () => {
    const result = seedStructuredInput({
      runtimeJson: "",
      topologyJson: topologyText(),
      entries: [{ pointer: "/overrides/runtime/max_active_requests", value: 8 }],
    });
    expect(result.runtimeJson).toBe("");
    expect(result.notes.some((note) => note.code === "runtime_unavailable" && note.impedes)).toBe(true);
  });
});

describe("contract gate on a form-produced document", () => {
  it("passes the generated createRunRequest validator", () => {
    let topoText = topologyText();
    topoText = patchJsonDocument(topoText, "Fabric topology", (draft) => {
      setDeviceCount(draft, 4);
    });
    const doc = JSON.parse(topoText) as JsonObject;

    const request = {
      scenario_id: "s1_des_example",
      custom_inputs: {
        runtime_trace: {
          ...runtimeTrace(),
          policy: { ...(runtimeTrace().policy as JsonObject), kv_admission_watermark: 0.02 },
        },
        // `custom_inputs.topology` is the topology-request-input document, whose
        // own `topology` member holds devices/module_bindings/domains.
        topology: { topology: doc.topology },
      },
    };

    expect(validateCreateRunRequest(request)).toBe(true);
    // And the same request with a contract-violating watermark is rejected, so
    // the assertion above is not vacuous.
    const broken = JSON.parse(JSON.stringify(request)) as JsonObject;
    const brokenRuntime = (broken.custom_inputs as JsonObject).runtime_trace as JsonObject;
    (brokenRuntime.policy as JsonObject).kv_admission_watermark = 5;
    expect(validateCreateRunRequest(broken)).toBe(false);
  });
});

/**
 * The knobs stay visible while the structured editors are open, so an edited
 * knob is mirrored into the document one key at a time. Anything the knob does
 * not own must come through untouched — that is what keeps a hand-typed policy
 * value from being collateral damage.
 */
describe("mirroring a single knob into the structured documents", () => {
  it("writes and then removes the runtime policy key it owns", () => {
    const written = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/runtime/max_batch_size",
      value: 16,
    });
    expect(((JSON.parse(written.runtimeJson) as JsonObject).policy as JsonObject).max_batch_size).toBe(16);
    expect(written.note).toBeNull();

    const cleared = writeControlPointer({
      runtimeJson: written.runtimeJson,
      topologyJson: written.topologyJson,
      pointer: "/overrides/runtime/max_batch_size",
      value: undefined,
    });
    expect("max_batch_size" in ((JSON.parse(cleared.runtimeJson) as JsonObject).policy as JsonObject)).toBe(false);
    // Untouched keys, including the vendor extension, are still there.
    expect((JSON.parse(cleared.runtimeJson) as JsonObject).x_vendor_extension).toEqual(UNKNOWN_KEYS.x_vendor_extension);
  });

  it("writes the fabric knob into every binding of the matching module kind", () => {
    const result = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/fabric/scale_up_bandwidth_gbps",
      value: 4321,
    });
    const bindings = ((JSON.parse(result.topologyJson) as JsonObject).topology as JsonObject)
      .module_bindings as JsonObject[];
    expect((bindings[0].override_params as JsonObject).bandwidth_gbps).toBe(4321);
    expect((bindings[1].override_params as JsonObject).bandwidth_gbps).toBe(100);
    expect(result.runtimeJson).toBe(runtimeText());
    expect(result.note).toBeNull();
  });

  it("accepts a policy value the override range would have rejected", () => {
    const result = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/runtime/kv_admission_watermark",
      // 0.02 is legal as a policy (0..1) but not as a run override (0.05..1).
      value: 0.02,
    });
    expect(((JSON.parse(result.runtimeJson) as JsonObject).policy as JsonObject).kv_admission_watermark).toBe(0.02);
    expect(result.note).toBeNull();
  });

  it("explains instead of writing when the pointer has no home", () => {
    const result = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/runtime/not_a_policy_key",
      value: 1,
    });
    expect(result.runtimeJson).toBe(runtimeText());
    expect(result.note?.code).toBe("runtime_no_key");
    expect(result.note?.impedes).toBe(true);
  });

  it("explains instead of writing when no module binding of that kind exists", () => {
    const result = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/fabric/nosuchkind_bandwidth_gbps",
      value: 100,
    });
    expect(result.topologyJson).toBe(topologyText());
    expect(result.note?.code).toBe("fabric_missing_binding");
  });

  it("never rescales the workload multiplier", () => {
    const result = writeControlPointer({
      runtimeJson: runtimeText(),
      topologyJson: topologyText(),
      pointer: "/overrides/workload/message_size_multiplier",
      value: 2,
    });
    expect(result.runtimeJson).toBe(runtimeText());
    expect(result.topologyJson).toBe(topologyText());
    expect(result.note?.code).toBe("workload_multiplier_not_rescaled");
    expect(result.note?.impedes).toBe(true);
  });
});

describe("module_bindings as an editable list", () => {
  const parse = (text: string): JsonObject => JSON.parse(text) as JsonObject;
  const bindingsOf = (document: JsonObject): JsonObject[] =>
    (document.topology as JsonObject).module_bindings as JsonObject[];

  it("adds a module with the requested kind", () => {
    const added = patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
      addModuleBinding(draft, { module_name: "extra-module", module_kind: "scale_out" });
    });
    expect(moduleBindingNamesOf(parse(added))).toEqual([
      { name: "su-module", kind: "scale_up" },
      { name: "so-module", kind: "scale_out" },
      { name: "extra-module", kind: "scale_out" },
    ]);
  });

  it("generates a neutral unique placeholder name instead of a plausible module name", () => {
    expect(nextModuleBindingName(["su-module", "so-module"])).toBe(`${MODULE_NAME_PREFIX}_1`);
    expect(nextModuleBindingName([`${MODULE_NAME_PREFIX}_1`])).toBe(`${MODULE_NAME_PREFIX}_2`);
  });

  it("refuses a duplicate or empty module name", () => {
    expect(() =>
      patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
        addModuleBinding(draft, { module_name: "su-module", module_kind: "scale_up" });
      }),
    ).toThrow(/已存在/);
    expect(() =>
      patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
        addModuleBinding(draft, { module_name: "   ", module_kind: "scale_up" });
      }),
    ).toThrow(/不能为空/);
  });

  it("stops at the contract ceiling for module bindings", () => {
    const full = parse(topologyText());
    (full.topology as JsonObject).module_bindings = Array.from(
      { length: topologyModuleBindingMaxItems },
      (_, index) => ({ module_name: `m${index}`, module_kind: "scale_up" }),
    );
    expect(() =>
      patchJsonDocument(serializeJsonDocument(full), "Fabric topology", (draft) => {
        addModuleBinding(draft, { module_name: "one-too-many", module_kind: "scale_up" });
      }),
    ).toThrow(new RegExp(`不能超过 ${topologyModuleBindingMaxItems}`));
  });

  it("renames a module and rewrites every domain that named it", () => {
    const renamed = patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
      renameModuleBinding(draft, "su-module", "su-module-v2");
    });
    const document = parse(renamed);
    expect(moduleBindingNamesOf(document).map((entry) => entry.name)).toContain("su-module-v2");
    expect((topologyDomainsOf(document)?.[0] as JsonObject).module_binding).toBe("su-module-v2");
  });

  it("refuses a rename that would collide with another module", () => {
    expect(() =>
      patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
        renameModuleBinding(draft, "su-module", "so-module");
      }),
    ).toThrow(/已存在/);
  });

  it("switches a module kind without touching its override values", () => {
    const switched = patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
      setModuleBindingKind(draft, "su-module", "scale_out");
    });
    const bindings = moduleBindingNamesOf(parse(switched));
    expect(bindings.find((entry) => entry.name === "su-module")?.kind).toBe("scale_out");
    expect(bindingsOf(parse(switched))[0].override_params).toEqual({ bandwidth_gbps: 900, latency_us: 1 });
  });

  it("writes an optional text key, trims it, and removes it when cleared", () => {
    const written = patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
      setModuleBindingText(draft, "su-module", "module_version", " 1.2.3 ");
    });
    expect(bindingsOf(parse(written))[0].module_version).toBe("1.2.3");
    const cleared = patchJsonDocument(written, "Fabric topology", (draft) => {
      setModuleBindingText(draft, "su-module", "module_version", "   ");
    });
    expect("module_version" in bindingsOf(parse(cleared))[0]).toBe(false);
  });

  it("refuses an optional text value longer than the contract allows", () => {
    expect(() =>
      patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
        setModuleBindingText(draft, "su-module", "module_version", "v".repeat(81));
      }),
    ).toThrow(/不能超过/);
  });

  it("refuses to delete a module a domain still binds, naming that domain", () => {
    expect(() =>
      patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
        removeModuleBinding(draft, "su-module");
      }),
    ).toThrow(/su0/);
  });

  it("deletes an unreferenced module and leaves unrelated keys alone", () => {
    const removed = patchJsonDocument(topologyText(), "Fabric topology", (draft) => {
      removeModuleBinding(draft, "so-module");
    });
    const document = parse(removed);
    expect(moduleBindingNamesOf(document).map((entry) => entry.name)).toEqual(["su-module"]);
    expect(document.x_vendor_extension).toEqual(UNKNOWN_KEYS.x_vendor_extension);
  });

  it("reports which domains reference a module", () => {
    const document = parse(topologyText());
    expect(moduleBindingReferences(document, "su-module")).toEqual({ domains: ["su0"] });
    expect(moduleBindingReferences(document, "so-module")).toEqual({ domains: [] });
  });
});
