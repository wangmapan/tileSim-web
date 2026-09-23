import { describe, expect, it } from "vitest";
import runOverridesSchema from "../../bridge/contracts/schemas/run-overrides.schema.json";
import runtimeTraceSchema from "../../bridge/contracts/schemas/runtime-trace-input.schema.json";
import topologyRequestSchema from "../../bridge/contracts/schemas/topology-request-input.schema.json";
import {
  advancedRuntimePolicyKeys,
  commonRuntimePolicyKeys,
  describeBounds,
  moduleBindingOverrideFields,
  policyField,
  requestParticipantsMaxItems,
  runtimePolicyFields,
  runtimeRequestFields,
  runtimeRequestMaxItems,
  runtimeRequestMinItems,
  topologyDeviceFields,
  topologyDeviceMaxItems,
  type SchemaFieldMeta,
} from "../../src/features/run-experiment/input-schema-meta";

/**
 * The panel must derive every control attribute from the contract instead of
 * restating it. These tests re-read the raw schema documents and compare them
 * field by field, so a hand-written constant that drifts from the contract fails
 * here instead of at submit time.
 */
type RawNode = Record<string, unknown>;

const runtimePolicySchema = (runtimeTraceSchema.properties.policy as RawNode).properties as Record<string, RawNode>;
const runtimeRequestSchema = ((runtimeTraceSchema.properties.requests as RawNode).items as RawNode)
  .properties as Record<string, RawNode>;
const runtimeRequestNode = runtimeTraceSchema.properties.requests as RawNode;
const topologyRoot = (topologyRequestSchema.properties.topology as RawNode).properties as Record<string, RawNode>;
const topologyDevicesNode = topologyRoot.devices as RawNode;
const moduleBindingItems = (topologyRoot.module_bindings as RawNode).items as RawNode;
const overrideParamsSchema = (moduleBindingItems.properties as Record<string, RawNode>).override_params as RawNode;

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function expectMatchesSchema(meta: SchemaFieldMeta, node: RawNode) {
  const declarations = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  const enumValues = Array.isArray(node.enum) ? node.enum.filter((entry) => typeof entry === "string") : [];

  expect(meta.minimum).toBe(numberOrNull(node.minimum));
  expect(meta.maximum).toBe(numberOrNull(node.maximum));
  expect(meta.exclusiveMinimum).toBe(numberOrNull(node.exclusiveMinimum));
  expect(meta.maxItems).toBe(numberOrNull(node.maxItems));
  expect(meta.minLength).toBe(numberOrNull(node.minLength));
  expect(meta.maxLength).toBe(numberOrNull(node.maxLength));
  expect(meta.enumValues).toEqual(enumValues);
  expect(meta.integerOnly).toBe(declarations.includes("integer"));
  if (node.enum !== undefined) expect(meta.kind).toBe("enum");
  if (declarations.includes("boolean")) expect(meta.kind).toBe("boolean");
}

describe("runtime policy metadata", () => {
  it("exposes exactly the policy keys declared by the trace schema", () => {
    expect(runtimePolicyFields.map((field) => field.key)).toEqual(Object.keys(runtimePolicySchema));
    expect(runtimePolicyFields).toHaveLength(17);
  });

  it("matches the schema declaration for every policy field", () => {
    runtimePolicyFields.forEach((field) => expectMatchesSchema(field, runtimePolicySchema[field.key]));
  });

  it("uses the policy-range guard for every runtime field it can edit", () => {
    // Anchor: batch_scheduler is an enum with the four schedulers the contract allows.
    expect(policyField("batch_scheduler").kind).toBe("enum");
    expect(policyField("batch_scheduler").enumValues).toEqual([
      "fifo",
      "decode_priority",
      "fabric_backpressure_aware",
      "starvation_aware",
    ]);
    expect(policyField("max_active_requests").minimum).toBe(0);
    expect(policyField("max_active_requests").maximum).toBe(1024);
    expect(policyField("long_context_threshold_tokens").kind).toBe("integer");
    expect(policyField("decode_penalty_per_threshold").kind).toBe("number");
    expect(policyField("fabric_backpressure_active").kind).toBe("boolean");
  });
});

describe("policy metadata never borrows run-override ranges", () => {
  const overrideRuntime = (runOverridesSchema.properties.runtime as RawNode).properties as Record<string, RawNode>;

  it("keeps kv_admission_watermark at the 0..1 policy range, not the 0.05..1 override range", () => {
    expect(overrideRuntime.kv_admission_watermark.minimum).toBe(0.05);
    expect(overrideRuntime.kv_admission_watermark.maximum).toBe(1.0);
    expect(policyField("kv_admission_watermark").minimum).toBe(0);
    expect(policyField("kv_admission_watermark").maximum).toBe(1);
    expect(policyField("kv_admission_watermark").minimum).not.toBe(overrideRuntime.kv_admission_watermark.minimum);
  });

  it("keeps max_batch_size at the 0..1024 policy range, not the 1..64 override range", () => {
    expect(overrideRuntime.max_batch_size.minimum).toBe(1);
    expect(overrideRuntime.max_batch_size.maximum).toBe(64);
    expect(policyField("max_batch_size").minimum).toBe(0);
    expect(policyField("max_batch_size").maximum).toBe(1024);
  });
});

describe("runtime policy grouping", () => {
  const overrideRuntimeKeys = Object.keys(
    (runOverridesSchema.properties.runtime as RawNode).properties as Record<string, RawNode>,
  );

  it("keeps the common group identical to the keys the quick controls expose", () => {
    expect(overrideRuntimeKeys).toHaveLength(8);
    expect(commonRuntimePolicyKeys).toEqual(overrideRuntimeKeys);
  });

  it("splits the 17 policy keys into 8 common and 9 advanced keys", () => {
    expect(advancedRuntimePolicyKeys).toHaveLength(9);
    expect([...commonRuntimePolicyKeys, ...advancedRuntimePolicyKeys].sort()).toEqual(
      runtimePolicyFields.map((field) => field.key).sort(),
    );
  });
});

describe("runtime request metadata", () => {
  it("matches the schema declaration for every request field", () => {
    expect(runtimeRequestFields.map((field) => field.key)).toEqual(Object.keys(runtimeRequestSchema));
    runtimeRequestFields.forEach((field) => expectMatchesSchema(field, runtimeRequestSchema[field.key]));
  });

  it("carries the bounds the request table checks against", () => {
    expect(runtimeRequestMaxItems).toBe(runtimeRequestNode.maxItems);
    expect(runtimeRequestMinItems).toBe(runtimeRequestNode.minItems);
    expect(runtimeRequestMaxItems).toBe(1024);
    expect(runtimeRequestMinItems).toBe(1);
    const tpDegree = runtimeRequestFields.find((field) => field.key === "tp_degree");
    expect(tpDegree?.minimum).toBe(1);
    expect(tpDegree?.maximum).toBe(1024);
    expect(runtimeRequestFields.find((field) => field.key === "phase")?.enumValues).toEqual(["prefill", "decode"]);
    const participants = runtimeRequestFields.find((field) => field.key === "participants");
    expect(participants?.kind).toBe("stringArray");
    expect(participants?.maxItems).toBe(requestParticipantsMaxItems);
    expect(requestParticipantsMaxItems).toBe(1024);
    expect(runtimeRequestFields.find((field) => field.key === "request_id")?.required).toBe(true);
  });
});

describe("topology metadata", () => {
  it("matches the schema declaration for every device field", () => {
    const deviceProperties = (topologyDevicesNode.items as RawNode).properties as Record<string, RawNode>;
    expect(topologyDeviceFields.map((field) => field.key)).toEqual(Object.keys(deviceProperties));
    topologyDeviceFields.forEach((field) => expectMatchesSchema(field, deviceProperties[field.key]));
    expect(topologyDeviceMaxItems).toBe(topologyDevicesNode.maxItems);
    expect(topologyDeviceMaxItems).toBe(1024);
  });

  it("matches the schema declaration for every module binding override parameter", () => {
    const overrideProperties = overrideParamsSchema.properties as Record<string, RawNode>;
    expect(moduleBindingOverrideFields.map((field) => field.key)).toEqual(Object.keys(overrideProperties));
    moduleBindingOverrideFields.forEach((field) => expectMatchesSchema(field, overrideProperties[field.key]));
    expect(moduleBindingOverrideFields.find((field) => field.key === "bandwidth_gbps")?.exclusiveMinimum).toBe(0);
    expect(moduleBindingOverrideFields.find((field) => field.key === "oversubscription_factor")?.minimum).toBe(1);
  });
});

describe("bounds rendering", () => {
  it("keeps the exact contract range in the tooltip when the visible text is shortened", () => {
    // arrival_time_ps is a uint64 capped at the JS safe-integer guard, which is
    // not a bound a reader can act on, so only the exact tooltip carries it.
    const arrival = describeBounds(policyField("prefill_starvation_threshold_ps"), "integer");
    expect(arrival.text).toBe("integer · ≥ 0");
    expect(arrival.title).toBe("integer · 0 ~ 9007199254740991");
  });

  it("shows a real ceiling verbatim", () => {
    const batchLimit = describeBounds(policyField("fabric_backpressure_prefill_batch_limit"), "integer");
    expect(batchLimit.text).toBe("integer · 0 ~ 1024");
    expect(batchLimit.title).toBe("integer · 0 ~ 1024");
  });

  it("shows a lower bound only where the schema declares one", () => {
    const overhead = describeBounds(policyField("kv_fragmentation_overhead"), "integer");
    expect(overhead.text).toBe("≥ 0");
    expect(overhead.title).toBe("0 ~ +∞");
  });

  it("renders enums and booleans without a numeric range", () => {
    const scheduler = describeBounds(policyField("batch_scheduler"), "integer");
    expect(scheduler.text).toBe(policyField("batch_scheduler").enumValues.join(" · "));
    expect(describeBounds(policyField("fabric_backpressure_active")).text).toBe("true · false");
  });

  it("marks integer-only fields only when the caller supplies the label", () => {
    // The request table never marked them; passing nothing must stay silent.
    expect(describeBounds(policyField("kv_page_size_tokens")).text).toBe("≥ 0");
    expect(describeBounds(policyField("kv_page_size_tokens"), "integer").text).toBe("integer · ≥ 0");
  });
});
