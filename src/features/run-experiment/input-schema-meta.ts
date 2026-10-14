/**
 * Control metadata for the structured JSON input panel.
 *
 * The panel must never hand-write field names, types, ranges, required flags,
 * enums or `maxItems`. Everything below is derived from the two contract
 * schemas that actually govern `custom_inputs`:
 *
 *   - bridge/contracts/schemas/runtime-trace-input.schema.json
 *   - bridge/contracts/schemas/topology-request-input.schema.json
 *
 * `run-overrides.schema.json` is imported for ONE purpose only: to decide which
 * runtime policy keys belong to the "common" group (the keys the quick controls
 * also expose). Its ranges are deliberately NOT used, because they differ for
 * several keys — `kv_admission_watermark` is (0,1] in a policy and 0.05..1 in a
 * run override, and `max_batch_size` is 1..1024 versus 1..64.
 */
import runOverridesSchemaJson from "../../../bridge/contracts/schemas/run-overrides.schema.json";
import runtimeTraceSchemaJson from "../../../bridge/contracts/schemas/runtime-trace-input.schema.json";
import topologyRequestSchemaJson from "../../../bridge/contracts/schemas/topology-request-input.schema.json";

export type JsonSchemaNode = {
  type?: string | string[];
  enum?: readonly unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  required?: readonly string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  $ref?: string;
  additionalProperties?: boolean | JsonSchemaNode;
};

export type FieldKind = "integer" | "number" | "string" | "boolean" | "enum" | "stringArray" | "object" | "unknown";

export type SchemaFieldMeta = {
  key: string;
  kind: FieldKind;
  integerOnly: boolean;
  minimum: number | null;
  maximum: number | null;
  exclusiveMinimum: number | null;
  enumValues: readonly string[];
  maxItems: number | null;
  minLength: number | null;
  maxLength: number | null;
  required: boolean;
};

const runtimeTraceSchema = runtimeTraceSchemaJson as unknown as JsonSchemaNode;
const topologyRequestSchema = topologyRequestSchemaJson as unknown as JsonSchemaNode;
const runOverridesSchema = runOverridesSchemaJson as unknown as JsonSchemaNode;

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(`contract metadata is incomplete: ${message}`);
  return value;
}

function objectAt(node: JsonSchemaNode | undefined, path: string): JsonSchemaNode {
  return required(node, path);
}

function declaredTypes(node: JsonSchemaNode): readonly string[] {
  if (Array.isArray(node.type)) return node.type;
  return node.type ? [node.type] : [];
}

function kindOf(node: JsonSchemaNode): FieldKind {
  if (node.enum) return "enum";
  const types = declaredTypes(node);
  if (types.includes("integer")) return "integer";
  if (types.includes("number")) return "number";
  if (types.includes("boolean")) return "boolean";
  if (types.includes("string")) return "string";
  if (types.includes("array")) {
    return declaredTypes(node.items || {}).includes("string") ? "stringArray" : "unknown";
  }
  if (types.includes("object")) return "object";
  return "unknown";
}

function deriveField(key: string, node: JsonSchemaNode, requiredKey: boolean): SchemaFieldMeta {
  const kind = kindOf(node);
  return {
    key,
    kind,
    integerOnly: kind === "integer",
    minimum: typeof node.minimum === "number" ? node.minimum : null,
    maximum: typeof node.maximum === "number" ? node.maximum : null,
    exclusiveMinimum: typeof node.exclusiveMinimum === "number" ? node.exclusiveMinimum : null,
    enumValues: (node.enum || []).filter((entry): entry is string => typeof entry === "string"),
    maxItems: typeof node.maxItems === "number" ? node.maxItems : null,
    minLength: typeof node.minLength === "number" ? node.minLength : null,
    maxLength: typeof node.maxLength === "number" ? node.maxLength : null,
    required: requiredKey,
  };
}

/** Derives one metadata row per declared property of an object node. */
function deriveFields(node: JsonSchemaNode, path: string): SchemaFieldMeta[] {
  const source = node.properties;
  if (!source) throw new Error(`contract metadata is incomplete: ${path}.properties`);
  const requiredSet = new Set<string>(node.required || []);
  return Object.entries(source).map(([key, child]) => deriveField(key, child, requiredSet.has(key)));
}

/** Walks `parent.properties?.[key]` without widening through the index signature. */
function propertyAt(node: JsonSchemaNode, key: string, path: string): JsonSchemaNode {
  return objectAt(node.properties?.[key], `${path}.${key}`);
}

function arrayItemsAt(node: JsonSchemaNode, key: string, path: string): JsonSchemaNode {
  return objectAt(propertyAt(node, key, path).items, `${path}.${key}.items`);
}

/* ------------------------------------------------------------------ runtime */

const runtimeProperties = objectAt(runtimeTraceSchema, "runtime-trace");
const policySchema = propertyAt(runtimeProperties, "policy", "runtime-trace");
const requestsSchema = propertyAt(runtimeProperties, "requests", "runtime-trace");
const requestItemsSchema = objectAt(requestsSchema.items, "runtime-trace.requests.items");

export const runtimePolicyFields: readonly SchemaFieldMeta[] = deriveFields(policySchema, "runtime-trace.policy");
export const runtimeRequestFields: readonly SchemaFieldMeta[] = deriveFields(
  requestItemsSchema,
  "runtime-trace.requests.items",
);

const policyByKey = new Map(runtimePolicyFields.map((field) => [field.key, field]));

export function policyField(key: string): SchemaFieldMeta {
  return required(policyByKey.get(key), `runtime policy key ${key}`);
}

export const runtimeRequestMaxItems = required(requestsSchema.maxItems, "runtime-trace.requests.maxItems");
export const runtimeRequestMinItems = required(requestsSchema.minItems, "runtime-trace.requests.minItems");
export const requestParticipantsMaxItems = required(
  propertyAt(requestItemsSchema, "participants", "runtime-trace.requests.items").maxItems,
  "runtime-trace.requests.items.participants.maxItems",
);

/**
 * The "common" group is the set of runtime policy keys the quick controls also
 * expose. Membership is read from `run-overrides.schema.json`; ranges still come
 * from the policy schema so the two surfaces cannot disagree here.
 */
const overrideRootProperties = runOverridesSchema.properties as Record<string, JsonSchemaNode> | undefined;
const overrideRuntimeKeys: string[] = Object.keys(overrideRootProperties?.runtime?.properties || {});
export const commonRuntimePolicyKeys: readonly string[] = overrideRuntimeKeys.filter((key) => policyByKey.has(key));
export const advancedRuntimePolicyKeys: readonly string[] = runtimePolicyFields
  .map((field) => field.key)
  .filter((key) => !commonRuntimePolicyKeys.includes(key));

/* ----------------------------------------------------------------- topology */

const topologyRoot = propertyAt(topologyRequestSchema, "topology", "topology-request");

export const topologyDeviceFields: readonly SchemaFieldMeta[] = deriveFields(
  arrayItemsAt(topologyRoot, "devices", "topology"),
  "topology.devices.items",
);
export const topologyLinkFields: readonly SchemaFieldMeta[] = deriveFields(
  arrayItemsAt(topologyRoot, "links", "topology"),
  "topology.links.items",
);
export const topologyDomainFields: readonly SchemaFieldMeta[] = deriveFields(
  arrayItemsAt(topologyRoot, "domains", "topology"),
  "topology.domains.items",
);
export const moduleBindingFields: readonly SchemaFieldMeta[] = deriveFields(
  arrayItemsAt(topologyRoot, "module_bindings", "topology"),
  "topology.module_bindings.items",
);
export const moduleBindingOverrideFields: readonly SchemaFieldMeta[] = deriveFields(
  propertyAt(
    arrayItemsAt(topologyRoot, "module_bindings", "topology"),
    "override_params",
    "topology.module_bindings.items",
  ),
  "topology.module_bindings.items.override_params",
);

export const topologyDeviceMaxItems = required(
  propertyAt(topologyRoot, "devices", "topology").maxItems,
  "topology.devices.maxItems",
);
export const topologyModuleBindingMaxItems = required(
  propertyAt(topologyRoot, "module_bindings", "topology").maxItems,
  "topology.module_bindings.maxItems",
);
export const topologyLinkMaxItems = required(
  propertyAt(topologyRoot, "links", "topology").maxItems,
  "topology.links.maxItems",
);
export const topologyDomainMaxItems = required(
  propertyAt(topologyRoot, "domains", "topology").maxItems,
  "topology.domains.maxItems",
);

/**
 * Editor-only naming for auto-generated device ids. This is not contract
 * metadata: the contract only requires a non-empty string of at most 256
 * characters. Names keep the `gpu{n}` convention of the shipped template and
 * skip already-used suffixes.
 */
export const DEVICE_ID_PREFIX = "gpu";

/**
 * The ceiling the contract puts on a uint64 field. It is an artefact of the
 * schema, not a bound a reader can act on, so it is kept out of the visible
 * hint (see `describeBounds`) and only ever shown as an exact tooltip.
 */
const SAFE_INTEGER_CEILING = Number.MAX_SAFE_INTEGER;

export type BoundsText = {
  /** Compact text for the space under a control. */
  text: string;
  /** The exact contract range, verbatim numbers included. */
  title: string;
};

/**
 * Renders a field's contract bounds twice: once short enough to sit under an
 * input without wrapping, and once exact. Nothing is dropped — a range whose
 * ceiling is the safe-integer guard shows as "≥ 0" while the tooltip still
 * carries "0 ~ 9007199254740991".
 *
 * `integerLabel` is supplied by the caller because this module has no `t()`.
 * It is optional: a surface that never marked integer-only fields (the request
 * table) keeps that behaviour.
 */
export function describeBounds(meta: SchemaFieldMeta, integerLabel?: string): BoundsText {
  if (meta.kind === "enum") {
    const text = meta.enumValues.join(" · ");
    return { text, title: text };
  }
  if (meta.kind === "boolean") return { text: "true · false", title: "true · false" };
  const hasCeiling = meta.maximum !== null && meta.maximum !== SAFE_INTEGER_CEILING;
  const exact: string[] = [];
  const short: string[] = [];
  if (meta.integerOnly && integerLabel) {
    exact.push(integerLabel);
    short.push(integerLabel);
  }
  if (meta.minimum !== null || meta.maximum !== null) {
    exact.push(`${meta.minimum ?? "-∞"} ~ ${meta.maximum ?? "+∞"}`);
    if (meta.minimum !== null && hasCeiling) short.push(`${meta.minimum} ~ ${meta.maximum}`);
    else if (meta.minimum !== null) short.push(`≥ ${meta.minimum}`);
    else if (hasCeiling) short.push(`≤ ${meta.maximum}`);
  }
  return { text: short.join(" · "), title: exact.join(" · ") };
}
