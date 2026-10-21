import { describe, expect, it } from "vitest";
import {
  applyParameterEdits,
  previewParameterEdits,
  buildExperimentSurface,
  buildParameterCatalog,
  createExperimentForm,
  planParameterEdits,
  validateAgentStructuredInputs,
  type ParameterCatalogEntry,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

/**
 * The parameter-edit prototype is what lets the assistant reach past the frozen
 * eight-field subset. These pin the three things that decide whether that is
 * safe: what the catalogue exposes, what the planner refuses, and that a write
 * never disturbs the rest of a document.
 *
 * Ranges and enum values are read from the catalogue rather than hard-coded, so
 * a contract bump that changes them cannot make this file silently wrong.
 */

const runtimeJson = JSON.stringify(
  {
    trace_name: "assistant-trace",
    policy: { batch_scheduler: "fifo", max_batch_size: 4 },
    requests: [
      { request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0", "gpu1"] },
      { request_id: "req_b", arrival_time_ps: 10, phase: "decode", tp_degree: 2, participants: ["gpu0", "gpu1"] },
    ],
  },
  null,
  2,
);

const topologyJson = JSON.stringify(
  {
    topology: {
      devices: [
        { device_id: "gpu0", device_type: "GPU" },
        { device_id: "gpu1", device_type: "GPU" },
      ],
      module_bindings: [
        {
          module_name: "su-module",
          module_kind: "scale_up",
          override_params: { bandwidth_gbps: 900, latency_us: 0.8 },
        },
      ],
      domains: [
        { domain_id: "su0", domain_type: "scale_up", member_devices: ["gpu0", "gpu1"], module_binding: "su-module" },
      ],
      links: [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0", bandwidth_gbps: 900, latency_us: 0.8 }],
    },
  },
  null,
  2,
);

const syntheticStructuredInputs = {
  runtime_trace: {
    trace_name: "agent-synthetic",
    trace_provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "exploratory",
    },
    policy: { max_batch_size: 4 },
    requests: [{ request_id: "req0", phase: "prefill", tp_degree: 2, participants: ["gpu0", "gpu1"] }],
  },
  topology: {
    scenario_name: "agent-fabric",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "synthetic_consistency_only",
    },
    topology: {
      topology_name: "synthetic-two-gpu",
      devices: [
        { device_id: "gpu0", device_type: "GPU", group_id: "node0" },
        { device_id: "gpu1", device_type: "GPU", group_id: "node0" },
      ],
      module_bindings: [{ module_name: "su", module_kind: "scale_up" }],
      domains: [
        {
          domain_id: "su0",
          domain_type: "scale_up",
          member_devices: ["gpu0", "gpu1"],
          module_binding: "su",
        },
      ],
      links: [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0", bandwidth_gbps: 450, latency_us: 0.8 }],
    },
  },
};

const catalogInput = {
  scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
  fidelity_policies: ["default", "des"],
  input_modes: ["controls", "json"],
  design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
  gpu_participation_modes: ["gpu_free"],
};

/** One request row, so a key-only address is unambiguous. */
const singleRowRuntimeJson = JSON.stringify(
  {
    trace_name: "one-row",
    policy: { batch_scheduler: "fifo" },
    requests: [{ request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0"] }],
  },
  null,
  2,
);

function build() {
  const surface = buildExperimentSurface(catalogInput, f8Capabilities, createF8ExperimentDescriptor(), "supported");
  const form = createExperimentForm(surface);
  form.parameterValues["s1.runtime.max_batch_size"] = 4;
  return { surface, form };
}

function catalogOf(runtime = runtimeJson, topology = topologyJson): ParameterCatalogEntry[] {
  const { surface, form } = build();
  return buildParameterCatalog({ form, surface, runtimeJson: runtime, topologyJson: topology });
}

function entryAt(catalog: readonly ParameterCatalogEntry[], path: string): ParameterCatalogEntry {
  const entry = catalog.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`catalogue is missing ${path}`);
  return entry;
}

describe("parameter catalogue", () => {
  it("addresses the knobs, both documents and the top-level fields", () => {
    const catalog = catalogOf();
    const paths = catalog.map((entry) => entry.path);
    expect(paths).toContain("overrides/runtime/max_batch_size");
    expect(paths).toContain("run_name");
    expect(paths).toContain("fidelity_policy");
    expect(paths).toContain("runtime_trace/policy/batch_scheduler");
    expect(paths).toContain("runtime_trace/requests[1]/tp_degree");
    expect(paths).toContain("topology/devices[1]/device_type");
    expect(paths).toContain("topology/links[0]/bandwidth_gbps");
    expect(paths).toContain("topology/domains[0]/default_fidelity");
    expect(paths).toContain("topology/module_bindings[0]/override_params/queue_factor");
  });

  it("points a knob entry at its descriptor field and current value", () => {
    const knob = entryAt(catalogOf(), "overrides/runtime/max_batch_size");
    expect(knob.target).toBe("control");
    expect(knob.fieldId).toBe("s1.runtime.max_batch_size");
    expect(knob.current).toBe("4");
  });

  it("keeps lists out of the scalar surface", () => {
    const catalog = catalogOf();
    expect(catalog.some((entry) => entry.path.endsWith("/member_devices"))).toBe(false);
    expect(catalog.some((entry) => entry.path.endsWith("/participants"))).toBe(false);
  });

  it("marks identity keys and validates link endpoints against existing ids", () => {
    const catalog = catalogOf();
    expect(entryAt(catalog, "topology/devices[0]/device_id").referenceKey).toBe(true);
    expect(entryAt(catalog, "topology/module_bindings[0]/module_name").referenceKey).toBe(true);
    expect(entryAt(catalog, "topology/domains[0]/module_binding").referenceKey).toBe(true);
    expect(entryAt(catalog, "topology/links[0]/src_device").referenceValues).toEqual(["gpu0", "gpu1"]);
    expect(entryAt(catalog, "topology/links[0]/domain_id").referenceValues).toEqual(["su0"]);
  });

  it("drops a field the descriptor marks unavailable", () => {
    const { surface, form } = build();
    surface.controlGroups = surface.controlGroups.map((group) => ({
      ...group,
      fields: group.fields.map((field) =>
        field.fieldId === "s1.runtime.max_batch_size" ? { ...field, available: false } : field,
      ),
    }));
    const catalog = buildParameterCatalog({ form, surface, runtimeJson, topologyJson });
    expect(catalog.some((entry) => entry.path === "overrides/runtime/max_batch_size")).toBe(false);
    expect(catalog.some((entry) => entry.path.startsWith("overrides/"))).toBe(true);
  });

  it("adds no document entries while a document is empty", () => {
    const { surface, form } = build();
    const catalog = buildParameterCatalog({ form, surface, runtimeJson: "", topologyJson: "" });
    expect(catalog.some((entry) => entry.path.startsWith("runtime_trace/"))).toBe(false);
    expect(catalog.some((entry) => entry.path.startsWith("topology/"))).toBe(false);
    expect(catalog.some((entry) => entry.path.startsWith("overrides/"))).toBe(true);
  });

  it("contributes nothing for a document that does not parse", () => {
    const { surface, form } = build();
    const catalog = buildParameterCatalog({ form, surface, runtimeJson: "{not json", topologyJson: "" });
    expect(catalog.some((entry) => entry.path.startsWith("runtime_trace/"))).toBe(false);
  });
});

describe("parameter edit planner", () => {
  it("resolves a full path", () => {
    const plan = planParameterEdits("runtime_trace/policy/batch_scheduler = fifo", catalogOf());
    expect(plan.unknown).toEqual([]);
    expect(plan.rejected).toEqual([]);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].path).toBe("runtime_trace/policy/batch_scheduler");
    expect(plan.items[0].value).toBe("fifo");
    expect(plan.items[0].previous).toBe("fifo");
  });

  it("resolves a unique short path and a unique key", () => {
    expect(planParameterEdits("policy/kv_capacity_tokens = 4096", catalogOf()).items[0].path).toBe(
      "runtime_trace/policy/kv_capacity_tokens",
    );
    const singleRow = catalogOf(singleRowRuntimeJson);
    expect(planParameterEdits("tp_degree = 4", singleRow).items[0].path).toBe("runtime_trace/requests[0]/tp_degree");
  });

  it("refuses a key that several rows answer to", () => {
    const plan = planParameterEdits("tp_degree = 4", catalogOf());
    expect(plan.items).toEqual([]);
    expect(plan.unknown[0].reason).toContain("requests[0]/tp_degree");
    expect(plan.unknown[0].reason).toContain("requests[1]/tp_degree");
  });

  it("splits several assignments and reports what it could not use", () => {
    const plan = planParameterEdits("run_name = 演示运行\n拓扑里加两张卡", catalogOf());
    expect(plan.items.map((item) => item.path)).toEqual(["run_name"]);
    expect(plan.items[0].value).toBe("演示运行");
    expect(plan.unknown).toHaveLength(1);
    expect(plan.unknown[0].reason).toContain("没有「=」");
  });

  it("refuses an ambiguous key instead of guessing", () => {
    const catalog = catalogOf();
    // Both a knob and a policy key answer to this name; they are different
    // documents with different ranges, so the planner must not pick one.
    const plan = planParameterEdits("max_batch_size = 8", catalog);
    expect(plan.items).toEqual([]);
    expect(plan.unknown[0].reason).toContain("overrides/runtime/max_batch_size");
    expect(plan.unknown[0].reason).toContain("runtime_trace/policy/max_batch_size");
  });

  it("refuses an unknown name and a missing assignment", () => {
    const catalog = catalogOf();
    expect(planParameterEdits("不存在的参数 = 1", catalog).unknown[0].reason).toContain("目录里没有");
    expect(planParameterEdits("把 batch 调大一点", catalog).unknown[0].reason).toContain("没有「=」");
  });

  it("refuses an identity key edit", () => {
    const plan = planParameterEdits("topology/devices[0]/device_id = gpu9", catalogOf());
    expect(plan.items).toEqual([]);
    expect(plan.rejected[0].reason).toContain("引用键");
  });

  it("refuses a link endpoint that does not exist", () => {
    const plan = planParameterEdits("topology/links[0]/src_device = gpu9", catalogOf());
    expect(plan.items).toEqual([]);
    expect(plan.rejected[0].reason).toContain("gpu0");
  });

  it("accepts an existing link endpoint", () => {
    const plan = planParameterEdits("topology/links[0]/src_device = gpu1", catalogOf());
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].value).toBe("gpu1");
  });

  it("refuses a duplicate path inside one instruction", () => {
    const plan = planParameterEdits("run_name = a; run_name = b", catalogOf());
    expect(plan.items).toHaveLength(1);
    expect(plan.rejected[0].reason).toContain("两次");
  });

  it("type-checks values against the entry, not against the text", () => {
    const catalog: ParameterCatalogEntry[] = [
      {
        path: "demo/integer",
        label: "整数",
        kind: "integer",
        enumValues: [],
        minimum: 1,
        maximum: 10,
        minimumInclusive: true,
        maximumInclusive: true,
        integerOnly: true,
        maxLength: null,
        target: "runtime_trace",
        fieldId: null,
        current: "4",
      },
      {
        path: "demo/ratio",
        label: "比例",
        kind: "number",
        enumValues: [],
        minimum: 0,
        maximum: 1,
        minimumInclusive: true,
        maximumInclusive: false,
        integerOnly: false,
        maxLength: null,
        target: "runtime_trace",
        fieldId: null,
        current: null,
      },
      {
        path: "demo/enum",
        label: "枚举",
        kind: "enum",
        enumValues: ["alpha", "beta"],
        minimum: null,
        maximum: null,
        minimumInclusive: true,
        maximumInclusive: true,
        integerOnly: false,
        maxLength: null,
        target: "runtime_trace",
        fieldId: null,
        current: null,
      },
      {
        path: "demo/flag",
        label: "开关",
        kind: "boolean",
        enumValues: [],
        minimum: null,
        maximum: null,
        minimumInclusive: true,
        maximumInclusive: true,
        integerOnly: false,
        maxLength: null,
        target: "runtime_trace",
        fieldId: null,
        current: null,
      },
      {
        path: "demo/bandwidth_gbps",
        label: "带宽",
        kind: "number",
        enumValues: [],
        minimum: 0,
        maximum: null,
        minimumInclusive: true,
        maximumInclusive: true,
        integerOnly: false,
        maxLength: null,
        target: "runtime_trace",
        fieldId: null,
        current: null,
      },
    ];

    expect(planParameterEdits("demo/integer = 11", catalog).rejected[0].reason).toContain("不能大于 10");
    expect(planParameterEdits("demo/integer = 0", catalog).rejected[0].reason).toContain("不能小于 1");
    expect(planParameterEdits("demo/integer = 2.5", catalog).rejected[0].reason).toContain("只接受整数");
    expect(planParameterEdits("demo/ratio = 1", catalog).rejected[0].reason).toContain("不能大于");
    expect(planParameterEdits("demo/ratio = 0", catalog).items[0].value).toBe(0);
    expect(planParameterEdits("demo/ratio = 50%", catalog).rejected[0].reason).toContain("百分号");
    expect(planParameterEdits("demo/enum = gamma", catalog).rejected[0].reason).toContain("alpha / beta");
    expect(planParameterEdits("demo/enum = beta", catalog).items[0].value).toBe("beta");
    expect(planParameterEdits("demo/flag = 是", catalog).items[0].value).toBe(true);
    expect(planParameterEdits("demo/flag = 也许", catalog).rejected[0].reason).toContain("true");
    expect(planParameterEdits("demo/bandwidth_gbps = 400Gbps", catalog).items[0].value).toBe(400);
    expect(planParameterEdits("demo/integer = 4us", catalog).rejected[0].reason).toContain("单位");
  });

  it("resolves a descriptor label", () => {
    const catalog: ParameterCatalogEntry[] = [
      {
        path: "overrides/runtime/max_batch_size",
        label: "最大批大小",
        kind: "integer",
        enumValues: [],
        minimum: 1,
        maximum: 1024,
        minimumInclusive: true,
        maximumInclusive: true,
        integerOnly: true,
        maxLength: null,
        target: "control",
        fieldId: "s1.runtime.max_batch_size",
        current: "4",
      },
    ];
    const plan = planParameterEdits("最大批大小 = 16", catalog);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].fieldId).toBe("s1.runtime.max_batch_size");
    expect(plan.items[0].target).toBe("control");
  });
});

describe("parameter edit apply", () => {
  it("builds a JSON proposal through the same atomic validation path", () => {
    const plan = planParameterEdits("runtime_trace/policy/max_batch_size = 8", catalogOf());
    const preview = previewParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    expect(preview?.runtimeJson).toContain('"max_batch_size": 8');
    expect(preview?.topologyJson).toBe(topologyJson);
  });

  it("also shows the one-shot overrides JSON for a quick-control-only plan", () => {
    const plan = planParameterEdits("overrides/runtime/max_batch_size = 8", catalogOf());
    const preview = previewParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    expect(preview?.overridesJson).toContain('"max_batch_size": 8');
    expect(preview?.runtimeJson).toBe(runtimeJson);
  });

  it("writes a policy key and leaves the rest of the document alone", () => {
    const catalog = catalogOf();
    const entry = entryAt(catalog, "runtime_trace/policy/batch_scheduler");
    const next = entry.enumValues.find((value) => value !== entry.current) ?? entry.enumValues[0];
    const plan = planParameterEdits(`runtime_trace/policy/batch_scheduler = ${next}`, catalog);
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    const document = JSON.parse(outcome.runtimeJson);
    expect(outcome.rejected).toEqual([]);
    expect(outcome.applied).toHaveLength(1);
    expect(outcome.applied[0].previous).toBe(entry.current);
    expect(outcome.requiresStructuredInput).toBe(true);
    expect(document.policy.batch_scheduler).toBe(next);
    expect(document.policy.max_batch_size).toBe(4);
    expect(document.trace_name).toBe("assistant-trace");
    expect(document.requests).toHaveLength(2);
    expect(outcome.topologyJson).toBe(topologyJson);
  });

  it("writes one array element without touching its siblings", () => {
    const plan = planParameterEdits("runtime_trace/requests[1]/tp_degree = 4", catalogOf());
    const withoutPinnedParticipants = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: [
        { ...JSON.parse(runtimeJson).requests[0] },
        { ...JSON.parse(runtimeJson).requests[1], participants: undefined },
      ],
    });
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: withoutPinnedParticipants, topologyJson });
    const document = JSON.parse(outcome.runtimeJson);
    expect(document.requests[1].tp_degree).toBe(4);
    expect(document.requests[0].tp_degree).toBe(2);
    expect(document.requests[1].request_id).toBe("req_b");
  });

  it("refuses TP16 over a pinned two-card participants list without changing any document", () => {
    const plan = planParameterEdits("topology/devices = 16\nruntime_trace/requests[0]/tp_degree = 16", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    expect(outcome.applied).toEqual([]);
    expect(outcome.rejected[0].reason).toContain("participants 仍固定为 2 张卡");
    expect(outcome.topologyJson).toBe(topologyJson);
    expect(outcome.runtimeJson).toBe(runtimeJson);
  });

  it("patches the topology document and keeps unrendered keys", () => {
    const plan = planParameterEdits("topology/domains[0]/default_fidelity = des", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    const document = JSON.parse(outcome.topologyJson);
    expect(document.topology.domains[0].default_fidelity).toBe("des");
    expect(document.topology.domains[0].member_devices).toEqual(["gpu0", "gpu1"]);
    expect(document.topology.module_bindings[0].override_params.bandwidth_gbps).toBe(900);
    expect(outcome.runtimeJson).toBe(runtimeJson);
  });

  it("reports a rejected write instead of throwing when the document is empty", () => {
    const plan = planParameterEdits("runtime_trace/policy/batch_scheduler = fifo", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: "", topologyJson: "" });
    expect(outcome.applied).toEqual([]);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.runtimeJson).toBe("");
    expect(outcome.requiresStructuredInput).toBe(false);
  });

  it("returns knob and top-level edits without touching either document", () => {
    const plan = planParameterEdits("overrides/runtime/max_batch_size = 8", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    expect(outcome.applied).toHaveLength(1);
    expect(outcome.applied[0].target).toBe("control");
    expect(outcome.applied[0].fieldId).toBe("s1.runtime.max_batch_size");
    expect(outcome.runtimeJson).toBe(runtimeJson);
    expect(outcome.topologyJson).toBe(topologyJson);
    expect(outcome.requiresStructuredInput).toBe(false);
  });
});

/**
 * The collection sizes. This is what makes "显卡数量改成 8" an instruction the
 * assistant can answer: the size of `topology/devices` IS the card count, so it
 * is an address rather than a field nobody publishes.
 */
describe("collection sizes", () => {
  it("offers the card count as an entry of its own", () => {
    const entry = entryAt(catalogOf(), "topology/devices");
    expect(entry.kind).toBe("count");
    expect(entry.target).toBe("topology");
    expect(entry.integerOnly).toBe(true);
    expect(entry.current).toBe("2");
    expect(entry.minimum).toBe(0);
    expect(entry.maximum).toBe(1024);
  });

  it("offers the request count with the contract's own minimum", () => {
    const entry = entryAt(catalogOf(), "runtime_trace/requests");
    expect(entry.kind).toBe("count");
    expect(entry.current).toBe("2");
    expect(entry.minimum).toBe(1);
  });

  it("offers no size for a document that is absent or unreadable", () => {
    const { surface, form } = build();
    const empty = buildParameterCatalog({ form, surface, runtimeJson: "", topologyJson: "" });
    expect(empty.some((entry) => entry.path === "topology/devices")).toBe(false);
    const broken = buildParameterCatalog({ form, surface, runtimeJson: "{not json", topologyJson: topologyJson });
    expect(broken.some((entry) => entry.path === "runtime_trace/requests")).toBe(false);
    expect(broken.some((entry) => entry.path === "topology/devices")).toBe(true);
  });

  it("plans a card count as a plain number", () => {
    const plan = planParameterEdits("topology/devices = 4", catalogOf());
    expect(plan.unknown).toEqual([]);
    expect(plan.rejected).toEqual([]);
    expect(plan.items[0].path).toBe("topology/devices");
    expect(plan.items[0].value).toBe(4);
    expect(plan.items[0].previous).toBe("2");
    expect(plan.items[0].next).toBe("4");
  });

  it("refuses a card count that is not a whole number of cards", () => {
    const catalog = catalogOf();
    expect(planParameterEdits("topology/devices = 2.5", catalog).rejected[0].reason).toContain("整数");
    expect(planParameterEdits("topology/devices = -1", catalog).rejected[0].reason).toContain("不能小于 0");
    expect(planParameterEdits("topology/devices = 4096", catalog).rejected[0].reason).toContain("不能大于");
  });

  it("grows the device list with names that skip the ones in use", () => {
    const plan = planParameterEdits("topology/devices = 4", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    const document = JSON.parse(outcome.topologyJson);
    expect(outcome.rejected).toEqual([]);
    expect(outcome.applied).toHaveLength(1);
    expect(outcome.requiresStructuredInput).toBe(true);
    expect(document.topology.devices.map((device: { device_id: string }) => device.device_id)).toEqual([
      "gpu0",
      "gpu1",
      "gpu2",
      "gpu3",
    ]);
    // A new device is a real entry the panel can then configure, not a number.
    expect(document.topology.devices[3].device_type).toBe("GPU");
    expect(outcome.runtimeJson).toBe(runtimeJson);
  });

  it("never replaces the device array with a number", () => {
    const plan = planParameterEdits("topology/devices = 4", catalogOf());
    const document = JSON.parse(applyParameterEdits({ items: plan.items, runtimeJson, topologyJson }).topologyJson);
    expect(Array.isArray(document.topology.devices)).toBe(true);
    expect(document.topology.topology_name).toBeUndefined();
  });

  it("refuses to shrink while a link still points at the device that would go", () => {
    const plan = planParameterEdits("topology/devices = 1", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    expect(outcome.applied).toEqual([]);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0].reason).toContain("gpu1");
    // The document is untouched, links included.
    expect(outcome.topologyJson).toBe(topologyJson);
  });

  it("shrinks an unreferenced tail device", () => {
    const grown = JSON.stringify({
      topology: {
        devices: [{ device_id: "gpu0" }, { device_id: "gpu1" }, { device_id: "gpu2" }],
        links: [],
        domains: [],
        module_bindings: [],
      },
    });
    const plan = planParameterEdits("topology/devices = 2", catalogOf(runtimeJson, grown));
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson: grown });
    const document = JSON.parse(outcome.topologyJson);
    expect(outcome.rejected).toEqual([]);
    expect(document.topology.devices.map((device: { device_id: string }) => device.device_id)).toEqual([
      "gpu0",
      "gpu1",
    ]);
  });

  it("grows and shrinks the request list, and keeps its minimum", () => {
    const grown = applyParameterEdits({
      items: planParameterEdits("runtime_trace/requests = 3", catalogOf()).items,
      runtimeJson,
      topologyJson,
    });
    const grownDocument = JSON.parse(grown.runtimeJson);
    expect(grown.rejected).toEqual([]);
    expect(grownDocument.requests).toHaveLength(3);
    // A new row copies the arrival order and the parallel degree of its predecessor.
    expect(grownDocument.requests[2].arrival_time_ps).toBe(10);
    expect(grownDocument.requests[2].tp_degree).toBe(2);
    expect(new Set(grownDocument.requests.map((row: { request_id: string }) => row.request_id)).size).toBe(3);

    const sixtyFour = applyParameterEdits({
      items: planParameterEdits("runtime_trace/requests = 64", catalogOf()).items,
      runtimeJson,
      topologyJson,
    });
    expect(sixtyFour.rejected).toEqual([]);
    expect(JSON.parse(sixtyFour.runtimeJson).requests).toHaveLength(64);
    expect(
      new Set(JSON.parse(sixtyFour.runtimeJson).requests.map((row: { request_id: string }) => row.request_id)).size,
    ).toBe(64);

    const shrunk = applyParameterEdits({
      items: planParameterEdits("runtime_trace/requests = 1", catalogOf()).items,
      runtimeJson,
      topologyJson,
    });
    expect(JSON.parse(shrunk.runtimeJson).requests).toHaveLength(1);
    expect(shrunk.rejected).toEqual([]);

    const refused = applyParameterEdits({
      items: planParameterEdits("runtime_trace/requests = 0", catalogOf()).items,
      runtimeJson,
      topologyJson,
    });
    expect(refused.applied).toEqual([]);
  });

  it("writes a size and an element of the same collection in one plan", () => {
    const plan = planParameterEdits("topology/devices = 4\n\ntopology/devices[1]/device_type = H100", catalogOf());
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson, topologyJson });
    const document = JSON.parse(outcome.topologyJson);
    expect(outcome.rejected).toEqual([]);
    expect(outcome.applied).toHaveLength(2);
    expect(document.topology.devices).toHaveLength(4);
    expect(document.topology.devices[1].device_type).toBe("H100");
    expect(document.topology.devices[3]).toEqual({ device_id: "gpu3", device_type: "GPU" });
  });

  it("plans and applies a 16-card four-node set even when growth is listed last", () => {
    const assignments = Array.from(
      { length: 16 },
      (_, index) => `topology/devices[${index}]/group_id = node${Math.floor(index / 4)}`,
    );
    assignments.unshift("runtime_trace/requests[0]/tp_degree = 16");
    assignments.push("topology/devices = 16");
    const plan = planParameterEdits(assignments.join("\n"), catalogOf());
    expect(plan.rejected).toEqual([]);
    expect(plan.unknown).toEqual([]);
    expect(plan.items).toHaveLength(18);
    expect(plan.items.find((item) => item.path === "topology/devices[15]/group_id")?.dependsOn).toBe(
      "topology/devices",
    );
    const unpinned = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: JSON.parse(runtimeJson).requests.map((row: { participants?: string[] }) => {
        const copy = { ...row };
        delete copy.participants;
        return copy;
      }),
    });
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: unpinned, topologyJson });
    expect(outcome.rejected).toEqual([]);
    expect(outcome.applied).toHaveLength(18);
    expect(
      JSON.parse(outcome.topologyJson).topology.devices.map((device: { group_id: string }) => device.group_id),
    ).toEqual(Array.from({ length: 16 }, (_, index) => `node${Math.floor(index / 4)}`));
    expect(JSON.parse(outcome.runtimeJson).requests[0].tp_degree).toBe(16);
  });

  it("applies an eight-card and multi-request TP change as one JSON transaction", () => {
    const assignments = [
      "topology/devices = 8",
      "runtime_trace/requests[0]/tp_degree = 8",
      "runtime_trace/requests[1]/tp_degree = 8",
    ];
    const unpinned = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: JSON.parse(runtimeJson).requests.map((row: { participants?: string[] }) => {
        const copy = { ...row };
        delete copy.participants;
        return copy;
      }),
    });
    const plan = planParameterEdits(assignments.join("\n"), catalogOf(unpinned, topologyJson));
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: unpinned, topologyJson });
    expect(outcome.rejected).toEqual([]);
    const runtime = JSON.parse(outcome.runtimeJson);
    const topology = JSON.parse(outcome.topologyJson);
    expect(topology.topology.devices).toHaveLength(8);
    expect(runtime.requests.map((row: { tp_degree: number }) => row.tp_degree)).toEqual([8, 8]);
    expect(outcome.requiresStructuredInput).toBe(true);
  });

  it("pairs every pinned request when a complete eight-card expansion names every TP", () => {
    const pinnedRuntime = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: index % 2 ? "decode" : "prefill",
        tp_degree: 4,
        participants: ["gpu0", "gpu1", "gpu2", "gpu3"],
      })),
    });
    const plan = planParameterEdits(
      [
        "topology/devices = 8",
        "runtime_trace/requests[0]/tp_degree = 8",
        "runtime_trace/requests[1]/tp_degree = 8",
        "runtime_trace/requests[2]/tp_degree = 8",
      ].join("\n"),
      catalogOf(pinnedRuntime, topologyJson),
    );
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: pinnedRuntime, topologyJson });
    expect(outcome.rejected).toEqual([]);
    const runtime = JSON.parse(outcome.runtimeJson);
    expect(runtime.requests.map((row: { tp_degree: number }) => row.tp_degree)).toEqual([8, 8, 8]);
    expect(runtime.requests.map((row: { participants: string[] }) => row.participants)).toEqual(
      [0, 1, 2].map(() => ["gpu0", "gpu1", "gpu2", "gpu3", "gpu4", "gpu5", "gpu6", "gpu7"]),
    );
  });

  it.each([3, 16, 32])("applies an arbitrary %i-card target without an eight-card special case", (count) => {
    const pinnedRuntime = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: [0, 1, 2].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: index % 2 ? "decode" : "prefill",
        tp_degree: 2,
        participants: ["gpu0", "gpu1"],
      })),
    });
    const plan = planParameterEdits(
      [
        `topology/devices = ${count}`,
        ...[0, 1, 2].map((index) => `runtime_trace/requests[${index}]/tp_degree = ${count}`),
      ].join("\n"),
      catalogOf(pinnedRuntime, topologyJson),
    );
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: pinnedRuntime, topologyJson });
    expect(outcome.rejected).toEqual([]);
    const runtime = JSON.parse(outcome.runtimeJson);
    const topology = JSON.parse(outcome.topologyJson);
    expect(topology.topology.devices).toHaveLength(count);
    expect(runtime.requests.map((row: { tp_degree: number }) => row.tp_degree)).toEqual([count, count, count]);
    expect(runtime.requests.map((row: { participants: string[] }) => row.participants)).toEqual(
      [0, 1, 2].map(() => Array.from({ length: count }, (_, index) => `gpu${index}`)),
    );
  });

  it("can atomically pair a same-sized inventory with a new TP", () => {
    const pinnedRuntime = JSON.stringify({
      ...JSON.parse(runtimeJson),
      requests: [0, 1].map((index) => ({
        request_id: `req_${index}`,
        arrival_time_ps: index,
        phase: "prefill",
        tp_degree: 1,
        participants: ["gpu0"],
      })),
    });
    const plan = planParameterEdits(
      "topology/devices = 2\nruntime_trace/requests[0]/tp_degree = 2\nruntime_trace/requests[1]/tp_degree = 2",
      catalogOf(pinnedRuntime, topologyJson),
    );
    const outcome = applyParameterEdits({ items: plan.items, runtimeJson: pinnedRuntime, topologyJson });
    expect(outcome.rejected).toEqual([]);
    expect(JSON.parse(outcome.runtimeJson).requests.map((row: { participants: string[] }) => row.participants)).toEqual(
      [
        ["gpu0", "gpu1"],
        ["gpu0", "gpu1"],
      ],
    );
  });

  it("rolls back a complete batch if a later projected write fails", () => {
    const plan = planParameterEdits(
      "run_name = sixteen\ntopology/devices = 16\ntopology/devices[15]/group_id = node3",
      catalogOf(),
    );
    const invalid = plan.items.map((item) =>
      item.path.endsWith("[15]/group_id") ? { ...item, path: "topology/devices[16]/group_id" } : item,
    );
    const outcome = applyParameterEdits({ items: invalid, runtimeJson, topologyJson });
    expect(outcome.applied).toEqual([]);
    expect(outcome.rejected[0].reason).toContain("回滚");
    expect(outcome.topologyJson).toBe(topologyJson);
    expect(outcome.runtimeJson).toBe(runtimeJson);
    expect(outcome.requiresStructuredInput).toBe(false);
  });

  it("does not address an element that does not exist yet", () => {
    // A future index without a matching growth in this same plan stays unavailable.
    const plan = planParameterEdits("topology/devices[2]/device_type = H100", catalogOf());
    expect(plan.items).toEqual([]);
    expect(plan.unknown).toHaveLength(1);
    expect(plan.unknown[0].reason).toContain("目录里没有");
  });
});

describe("complete synthetic Agent JSON proposals", () => {
  it("validates and applies devices, domains, links, and module bindings atomically", () => {
    const checked = validateAgentStructuredInputs(syntheticStructuredInputs);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const outcome = applyParameterEdits({
      items: [],
      runtimeJson,
      topologyJson,
      structuredInputs: checked.inputs,
    });
    expect(outcome.rejected).toEqual([]);
    expect(JSON.parse(outcome.topologyJson).topology.links).toHaveLength(1);
    expect(JSON.parse(outcome.topologyJson).provenance.source_mode).toBe("synthetic_trace");
    expect(outcome.requiresStructuredInput).toBe(true);
  });

  it("rejects a generated link that points to an unknown device", () => {
    const invalid = structuredClone(syntheticStructuredInputs);
    invalid.topology.topology.links[0].dst_device = "gpu99";
    const checked = validateAgentStructuredInputs(invalid);
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.reason).toContain("端点设备不存在");
  });
});
