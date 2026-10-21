/**
 * The addressable parameter surface behind the assistant's parameter-edit mode.
 *
 * The configuration assistant is not limited to a fixed card count or a small
 * hand-picked field list. This catalogue enumerates every scalar the panel can
 * actually write, so one instruction can address any of them. Nothing here is
 * hand-written — field names, kinds, ranges and enums all
 * come from the descriptor surface plus `input-schema-meta`, which itself
 * derives from the two contract schemas that govern `custom_inputs`.
 *
 * `path` is the address a user types. It is deliberately **document-relative**:
 * every path is exactly the location of the value inside the document that owns
 * it, so applying an edit needs no prefix rewriting.
 *
 *   - `overrides/runtime/max_batch_size`   → the quick-control knob
 *   - `policy/max_active_requests`         → `custom_inputs.runtime_trace.policy`
 *   - `requests[0]/tp_degree`              → `custom_inputs.runtime_trace.requests`
 *   - `topology/devices[0]/device_type`    → `custom_inputs.topology.topology`
 *   - `topology/module_bindings[0]/override_params/bandwidth_gbps`
 *   - `run_name`                           → top-level request field
 *   - `topology/devices`                   → the **size** of that collection
 *
 * Only leaves are listed: objects and arrays are addressed through their
 * elements, so every element entry can be written with one scalar assignment.
 * The one exception is the size of a collection, which is a leaf in its own
 * right — a caller can state a number of cards, and cannot state a new element.
 */
import {
  moduleBindingFields,
  moduleBindingOverrideFields,
  runtimePolicyFields,
  runtimeRequestFields,
  runtimeRequestMaxItems,
  runtimeRequestMinItems,
  topologyDeviceFields,
  topologyDeviceMaxItems,
  topologyDomainFields,
  topologyLinkFields,
  type FieldKind,
  type SchemaFieldMeta,
} from "./input-schema-meta";
import type { ExperimentControlDescriptor, ExperimentFormState, ExperimentSurface } from "./types";
import type { AgentParameterTarget } from "../../entities/agent-command";
import { engineModeOf } from "./runtime-engine";

/** Where an edit is written, which decides which document the panel patches. */
export type ParameterTarget = AgentParameterTarget;

/**
 * A schema-derived kind, plus `count`: the size of a collection.
 *
 * No contract schema declares a `count` — it is the editor's own reading of an
 * array's `length`, and it exists so that "显卡数量改成 8" is an addressable
 * instruction instead of something only a button in the panel can do. A size is
 * a scalar a caller can state; the elements it governs are not.
 */
export type ParameterKind = FieldKind | "count";

export type ParameterCatalogEntry = {
  /** Address accepted by the editor, e.g. `topology/devices[1]/device_type`. */
  path: string;
  /** The descriptor's Chinese label when the surface declares one. */
  label: string;
  kind: ParameterKind;
  enumValues: readonly string[];
  minimum: number | null;
  maximum: number | null;
  minimumInclusive: boolean;
  maximumInclusive: boolean;
  integerOnly: boolean;
  maxLength: number | null;
  target: ParameterTarget;
  /** Set for `control` entries so the caller can write the knob. */
  fieldId: string | null;
  /** Serialized current value, or null when the key/knob is unset. */
  current: string | null;
  /**
   * Identity key (`device_id`, `domain_id`, `module_name`, a domain's
   * `module_binding`). Renaming one of these is only correct together with
   * every field that references it, which the panel's own editors do and a
   * single scalar assignment cannot — so the editor refuses them outright.
   */
  referenceKey?: boolean;
  /** When set, the written value must be one of these existing ids. */
  referenceValues?: readonly string[] | null;
  /** Projected element: only addressable when the same plan grows this collection. */
  dependsOn?: "topology/devices" | "runtime_trace/requests";
};

export type ParameterCatalogSource = {
  form: ExperimentFormState;
  surface: ExperimentSurface;
  runtimeJson: string;
  topologyJson: string;
};

/**
 * The model receives the live writable surface as a bounded, human-readable
 * message.  This deliberately is not a second contract field: the Bridge
 * already validates the transcript, while the page remains the authority that
 * accepts or rejects the returned settings.  Keep this projection short enough
 * for one conversation message and prefer collection entries because they are
 * the fields that distinguish structured input from the knob-only page.
 */
export function describeAgentParameterCatalog(catalog: readonly ParameterCatalogEntry[]): string {
  // Identity fields are intentionally present in the page catalogue so the
  // structured editor can render them and the atomic writer can refuse a bare
  // rename. They are not safe Agent assignments: a single device_id change
  // would leave participants, links, domains and module references behind. The
  // Bridge publishes the same boundary, so do not put these keys in the model
  // context where they would only come back as unknown_parameter omissions.
  const modelCatalog = catalog.filter((entry) => !entry.referenceKey);
  const hasStructuredCollections = catalog.some(
    (entry) => entry.path === "topology/devices" || entry.path === "runtime_trace/requests",
  );
  const priority = (entry: ParameterCatalogEntry): number => {
    if (entry.path === "topology/devices" || entry.path === "runtime_trace/requests") return 0;
    // Every existing request's TP degree is safety-critical for a device-count
    // change. Keep all of these ahead of the verbose per-row fields so a short
    // model context cannot expose requests 0 and 1 while silently hiding 2.
    if (/^runtime_trace\/requests\[\d+\]\/tp_degree$/u.test(entry.path)) return 1;
    if (entry.path.startsWith("runtime_trace/requests[")) return 2;
    if (entry.path.startsWith("topology/devices[")) return 3;
    if (entry.path.startsWith("topology/")) return 4;
    if (entry.target === "control") return 5;
    return 6;
  };
  const sorted = [...modelCatalog].sort(
    (left, right) => priority(left) - priority(right) || left.path.localeCompare(right.path),
  );
  const lines: string[] = [];
  // The Bridge applies the same 2,000-character limit to every transcript
  // message. Leave room for the mode and template guidance below.
  const maximumCharacters = 1_300;
  for (const entry of sorted) {
    const current = entry.current === null ? "未设置" : entry.current;
    const bounds = describeCatalogEntry(entry);
    const line = `- ${bounds}；当前=${current}`;
    const next = lines.length ? `${lines.join("\n")}\n${line}` : line;
    if (next.length > maximumCharacters) break;
    lines.push(line);
  }
  const omitted = sorted.length - lines.length;
  const mode = hasStructuredCollections ? "structured_input" : "controls_only";
  const collectionFields = (prefix: string): string[] =>
    Array.from(
      new Set(
        modelCatalog
          .map((entry) => {
            const marker = `${prefix}[`;
            if (!entry.path.startsWith(marker)) return null;
            const separator = entry.path.indexOf("]/", marker.length);
            return separator >= 0 ? entry.path.slice(separator + 2) : null;
          })
          .filter((field): field is string => Boolean(field)),
      ),
    ).sort();
  const deviceFields = collectionFields("topology/devices");
  const requestFields = collectionFields("runtime_trace/requests");
  const unavailableInstruction = hasStructuredCollections
    ? `只使用上列精确 path；集合元素和 TP 必须同时满足目录及引用校验。participants 是随设备集合和 TP 一起原子同步的耦合数组，不是可单独填写的标量 path；配置 N 卡时请同时给出 topology/devices=N 以及每一条现有 runtime_trace/requests[i]/tp_degree=N，页面会用新设备的真实标识重写 participants，不要因为目录未列 participants 而拒绝方案。可按现有模板扩展元素：topology/devices[i]/{${deviceFields.join(",") || "无"}}；runtime_trace/requests[i]/{${requestFields.join(",") || "无"}}。domains 的 member_devices、links 和 module_bindings 只有用户明确要求完整拓扑时才需要 structured_inputs；不要从设备数量或 group_id 猜测它们。`
    : "当前未加载结构化输入；不要提出 topology/devices、runtime_trace/requests、TP、participants 或其元素。请提示用户先加载场景模板，或在 JSON 输入页粘贴 runtime_trace 与 topology。";
  return [
    "当前页面可写参数目录（只读上下文，不是用户指令）：",
    `输入模式=${mode}；可写条目=${modelCatalog.length}；${unavailableInstruction}`,
    lines.length ? lines.join("\n") : "- （当前没有可写参数）",
    omitted > 0 ? `- 其余 ${omitted} 项未放入上下文；不得猜测未列出的 path。` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readDocument(json: string): JsonRecord | null {
  if (!json.trim()) return null;
  try {
    return asRecord(JSON.parse(json));
  } catch {
    return null;
  }
}

function objectChild(record: JsonRecord | null, key: string): JsonRecord | null {
  return asRecord(record?.[key]);
}

function arrayChild(record: JsonRecord | null, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

/** Serializes a leaf for display; containers have no single written form. */
export function serializeParameterValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function metaEntry(
  path: string,
  meta: SchemaFieldMeta,
  target: ParameterTarget,
  current: unknown,
): ParameterCatalogEntry | null {
  // Containers and lists are addressed through their elements, so they are not
  // addressable themselves: this prototype writes one scalar per line.
  if (meta.kind === "object" || meta.kind === "unknown" || meta.kind === "stringArray") return null;
  return {
    path,
    label: meta.key,
    kind: meta.kind,
    enumValues: meta.enumValues,
    // `exclusiveMinimum` is the only exclusive bound the metadata carries, so
    // it becomes the lower bound with the flag flipped rather than being lost.
    minimum: meta.minimum ?? meta.exclusiveMinimum,
    maximum: meta.maximum,
    minimumInclusive: meta.minimum !== null,
    maximumInclusive: true,
    integerOnly: meta.integerOnly,
    maxLength: meta.maxLength,
    target,
    fieldId: null,
    current: serializeParameterValue(current),
  };
}

function controlEntry(field: ExperimentControlDescriptor, current: unknown): ParameterCatalogEntry {
  const kind: FieldKind =
    field.valueType === "enum"
      ? "enum"
      : field.valueType === "boolean"
        ? "boolean"
        : field.valueType === "string"
          ? "string"
          : field.valueType === "integer"
            ? "integer"
            : "number";
  return {
    path: field.requestJsonPointer.replace(/^\//u, ""),
    // The descriptor label is already localised by the backend descriptor.
    label: field.label,
    kind,
    enumValues: kind === "enum" ? field.options : [],
    minimum: field.minimum ?? null,
    maximum: field.maximum ?? null,
    minimumInclusive: field.minimumInclusive,
    maximumInclusive: field.maximumInclusive,
    integerOnly: field.integer,
    maxLength: null,
    target: "control",
    fieldId: field.fieldId,
    current: serializeParameterValue(current),
  };
}

function arrayEntries(
  prefix: string,
  items: readonly unknown[],
  fields: readonly SchemaFieldMeta[],
  target: ParameterTarget,
  keep: (item: JsonRecord) => boolean = () => true,
): ParameterCatalogEntry[] {
  const entries: ParameterCatalogEntry[] = [];
  items.forEach((item, index) => {
    const record = asRecord(item);
    if (!record || !keep(record)) return;
    fields.forEach((meta) => {
      const entry = metaEntry(`${prefix}[${index}]/${meta.key}`, meta, target, record[meta.key]);
      if (entry) entries.push(entry);
    });
  });
  return entries;
}

/**
 * Expose only the future leaves a proposal actually names, and only when that
 * proposal also contains a valid growth of their owning collection. The schema
 * metadata is the same as for existing rows; no arbitrary path or new link is
 * made addressable. The application step creates the rows before writing them.
 */
export function projectCollectionEntries(
  catalog: readonly ParameterCatalogEntry[],
  settings: readonly { key: string; value: string }[],
): ParameterCatalogEntry[] {
  const projected = [...catalog];
  const known = new Set(catalog.map((entry) => entry.path));
  const collections = [
    { path: "topology/devices" as const, fields: topologyDeviceFields, target: "topology" as const },
    { path: "runtime_trace/requests" as const, fields: runtimeRequestFields, target: "runtime_trace" as const },
  ];
  for (const collection of collections) {
    const size = catalog.find((entry) => entry.path === collection.path && entry.kind === "count");
    const proposed = settings.find((setting) => setting.key === collection.path || setting.key === size?.label);
    if (!size || !proposed || !/^\d+$/u.test(proposed.value.trim())) continue;
    const current = Number(size.current);
    const next = Number(proposed.value.trim());
    if (!Number.isSafeInteger(next) || next <= current || next > (size.maximum ?? current)) continue;
    for (const setting of settings) {
      const match = /^(topology\/devices|runtime_trace\/requests)\[(\d+)\]\/([^/]+)$/u.exec(setting.key);
      if (!match || match[1] !== collection.path) continue;
      const index = Number(match[2]);
      if (!Number.isSafeInteger(index) || index < current || index >= next || known.has(setting.key)) continue;
      const meta = collection.fields.find((field) => field.key === match[3]);
      if (!meta) continue;
      const inherited =
        collection.path === "topology/devices"
          ? meta.key === "device_type"
            ? "GPU"
            : undefined
          : ["arrival_time_ps", "tp_degree"].includes(meta.key)
            ? catalog.find((entry) => entry.path === `${collection.path}[${current - 1}]/${meta.key}`)?.current
            : undefined;
      const entry = metaEntry(setting.key, meta, collection.target, inherited);
      if (!entry) continue;
      entry.dependsOn = collection.path;
      if (meta.key === "device_id" || meta.key === "request_id") entry.referenceKey = true;
      projected.push(entry);
      known.add(entry.path);
    }
  }
  return projected;
}

function overrideParamEntries(prefix: string, bindings: readonly unknown[]): ParameterCatalogEntry[] {
  const entries: ParameterCatalogEntry[] = [];
  bindings.forEach((item, index) => {
    const binding = asRecord(item);
    const params = objectChild(binding, "override_params");
    if (!params) return;
    moduleBindingOverrideFields.forEach((meta) => {
      const entry = metaEntry(`${prefix}[${index}]/override_params/${meta.key}`, meta, "topology", params[meta.key]);
      if (entry) entries.push(entry);
    });
  });
  return entries;
}

/**
 * Marks the fields whose value is an identity or a cross-reference, so the
 * editor can refuse the ones that would silently dangle. A device id rename
 * also rewrites participants, links and domain members; a link endpoint just
 * has to name something that exists.
 */
function applyReferenceRules(entries: ParameterCatalogEntry[], topology: JsonRecord | null): void {
  const deviceIds = arrayChild(topology, "devices")
    .map((device) => serializeParameterValue(asRecord(device)?.device_id))
    .filter((id): id is string => Boolean(id));
  const domainIds = arrayChild(topology, "domains")
    .map((domain) => serializeParameterValue(asRecord(domain)?.domain_id))
    .filter((id): id is string => Boolean(id));
  const identityKeys =
    /^topology\/(?:devices\[\d+\]\/device_id|domains\[\d+\]\/(?:domain_id|module_binding)|module_bindings\[\d+\]\/module_name)$/u;
  entries.forEach((entry) => {
    if (entry.target !== "topology") return;
    if (identityKeys.test(entry.path)) {
      entry.referenceKey = true;
      return;
    }
    if (/^topology\/links\[\d+\]\/(?:src_device|dst_device)$/u.test(entry.path)) {
      entry.referenceValues = deviceIds;
      return;
    }
    if (/^topology\/links\[\d+\]\/domain_id$/u.test(entry.path)) entry.referenceValues = domainIds;
  });
}

/**
 * A collection that the document actually declares, or `null`.
 *
 * `arrayChild` answers an absent key with an empty list, which is the right
 * default when a missing list simply contributes no elements. A size address
 * cannot use it: "0 elements" and "no such list" are different promises, and
 * only the second must stay off the surface.
 */
function declaredArray(record: JsonRecord, key: string): unknown[] | null {
  const value = record[key];
  return Array.isArray(value) ? value : null;
}

/** One collection size, bounded the way the panel's own control bounds it. */
function countEntry(
  path: string,
  label: string,
  current: number,
  minimum: number | null,
  maximum: number | null,
  target: ParameterTarget,
): ParameterCatalogEntry {
  return {
    path,
    label,
    kind: "count",
    enumValues: [],
    minimum,
    maximum,
    minimumInclusive: true,
    maximumInclusive: true,
    integerOnly: true,
    maxLength: null,
    target,
    fieldId: null,
    current: String(current),
  };
}

/**
 * Builds the catalogue from the descriptor surface and the two input documents.
 *
 * A document that does not parse contributes no entries instead of throwing:
 * the panel already surfaces its own parse error, and the assistant must not
 * invent addresses for a document it cannot read.
 */
export function buildParameterCatalog(source: ParameterCatalogSource): ParameterCatalogEntry[] {
  const entries: ParameterCatalogEntry[] = [];
  const fields = source.surface.controlGroups.flatMap((group) => group.fields);
  const parameterValues = source.form.parameterValues || {};
  const runtimeDocument = readDocument(source.runtimeJson);
  const versionedEngine = runtimeDocument && engineModeOf(runtimeDocument) !== "generic";

  fields.forEach((field) => {
    if (!field.available) return;
    if (versionedEngine && field.fieldId === "s1.runtime.batch_scheduler") return;
    if (!field.applicableInputModes.includes("controls")) return;
    entries.push(controlEntry(field, parameterValues[field.fieldId]));
  });

  const topLevel: readonly { path: string; label: string; enumValues: readonly string[]; current: unknown }[] = [
    {
      path: "scenario_id",
      label: "scenario_id",
      enumValues: source.surface.scenarios.map((s) => s.value),
      current: source.form.scenario_id,
    },
    {
      path: "fidelity_policy",
      label: "fidelity_policy",
      enumValues: source.surface.fidelityPolicies,
      current: source.form.fidelity_policy,
    },
    {
      path: "gpu_participation_mode",
      label: "gpu_participation_mode",
      enumValues: source.surface.gpuParticipationModes,
      current: source.form.gpu_participation_mode,
    },
    { path: "run_name", label: "run_name", enumValues: [], current: source.form.run_name },
  ];
  topLevel.forEach((item) => {
    entries.push({
      path: item.path,
      label: item.label,
      kind: item.enumValues.length ? "enum" : "string",
      enumValues: item.enumValues,
      minimum: null,
      maximum: null,
      minimumInclusive: true,
      maximumInclusive: true,
      integerOnly: false,
      maxLength: item.path === "run_name" ? 80 : 200,
      target: "form",
      fieldId: null,
      current: serializeParameterValue(item.current),
    });
  });

  // An unreadable or absent document contributes nothing: the catalogue is a
  // promise that an address can be written, and neither can here. Both documents
  // are read here rather than later so the collection sizes below can be listed
  // before the elements they govern, which keeps them inside the short window of
  // values the assistant forwards to a model.
  const topology = objectChild(readDocument(source.topologyJson), "topology");

  // A collection's size is an address of its own, and the two collections the
  // panel can resize in one action are the ones offered here: devices (the card
  // count) and requests. links, domains and module_bindings are only ever added
  // through an editor that also has to name what the new element refers to, so
  // a bare number cannot express them and they are deliberately absent.
  const requestRows = runtimeDocument ? declaredArray(runtimeDocument, "requests") : null;
  if (requestRows) {
    entries.push(
      countEntry(
        "runtime_trace/requests",
        "请求条数",
        requestRows.length,
        runtimeRequestMinItems,
        runtimeRequestMaxItems,
        "runtime_trace",
      ),
    );
  }
  const deviceRows = topology ? declaredArray(topology, "devices") : null;
  if (deviceRows) {
    // The lower bound is the panel's own card-count input, which stops at 0.
    entries.push(
      countEntry("topology/devices", "设备数量（显卡数量）", deviceRows.length, 0, topologyDeviceMaxItems, "topology"),
    );
  }

  if (runtimeDocument) {
    const policy = objectChild(runtimeDocument, "policy");
    runtimePolicyFields.forEach((meta) => {
      if (versionedEngine && meta.key === "batch_scheduler") return;
      const entry = metaEntry(`runtime_trace/policy/${meta.key}`, meta, "runtime_trace", policy?.[meta.key]);
      if (entry) entries.push(entry);
    });
    entries.push(
      ...arrayEntries(
        "runtime_trace/requests",
        arrayChild(runtimeDocument, "requests"),
        runtimeRequestFields.filter((meta) => meta.key !== "phase"),
        "runtime_trace",
      ),
    );
  }

  entries.push(...arrayEntries("topology/devices", arrayChild(topology, "devices"), topologyDeviceFields, "topology"));
  entries.push(...arrayEntries("topology/links", arrayChild(topology, "links"), topologyLinkFields, "topology"));
  entries.push(...arrayEntries("topology/domains", arrayChild(topology, "domains"), topologyDomainFields, "topology"));
  entries.push(
    ...arrayEntries(
      "topology/module_bindings",
      arrayChild(topology, "module_bindings"),
      moduleBindingFields,
      "topology",
    ),
  );
  entries.push(...overrideParamEntries("topology/module_bindings", arrayChild(topology, "module_bindings")));
  applyReferenceRules(entries, topology);

  return entries;
}

/** Human-readable text for one entry, used by the panel and the assistant. */
export function describeCatalogEntry(entry: ParameterCatalogEntry): string {
  if (entry.kind === "enum" && entry.enumValues.length) return `${entry.path} · ${entry.enumValues.join(" / ")}`;
  if (entry.kind === "boolean") return `${entry.path} · true / false`;
  const bounds: string[] = [];
  if (entry.minimum !== null || entry.maximum !== null) {
    bounds.push(`${entry.minimum ?? "-∞"} ~ ${entry.maximum ?? "+∞"}`);
  }
  if (entry.maxLength !== null) bounds.push(`≤ ${entry.maxLength} 字符`);
  return bounds.length ? `${entry.path} · ${bounds.join(" · ")}` : entry.path;
}
