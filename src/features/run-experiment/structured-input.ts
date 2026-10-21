/**
 * Pure helpers behind the structured JSON input panel.
 *
 * Guiding rules:
 *  - The JSON text is the single source of truth. Every edit parses the text,
 *    mutates a deep copy and re-serialises the whole document, so keys this
 *    panel does not render are preserved verbatim instead of being rebuilt from
 *    the visible control set.
 *  - Nothing here validates against a hand-written copy of the contract: the
 *    limits come from `input-schema-meta` (schema-derived) and the final gate is
 *    the generated `createRunRequest` validator.
 */
import {
  DEVICE_ID_PREFIX,
  moduleBindingFields,
  moduleBindingOverrideFields,
  requestParticipantsMaxItems,
  runtimePolicyFields,
  runtimeRequestMaxItems,
  runtimeRequestMinItems,
  topologyDeviceMaxItems,
  topologyDomainMaxItems,
  topologyModuleBindingMaxItems,
} from "./input-schema-meta";
import type { ExperimentControlDescriptor, ParameterValue } from "./types";

export type JsonObject = Record<string, unknown>;

export type DocumentParse = { ok: true; value: JsonObject; error: "" } | { ok: false; value: null; error: string };

export class StructuredInputError extends Error {}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseJsonDocument(text: string, label: string): DocumentParse {
  if (!text.trim()) return { ok: false, value: null, error: `${label} 为空：请先加载场景模板或粘贴 JSON。` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, value: null, error: `${label} 不是合法 JSON：${error instanceof Error ? error.message : ""}` };
  }
  if (!isJsonObject(parsed)) return { ok: false, value: null, error: `${label} 的根必须是 JSON 对象。` };
  return { ok: true, value: parsed, error: "" };
}

export function serializeJsonDocument(value: JsonObject): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Parses `text`, hands a deep copy to `mutate`, and returns the serialised
 * result. Unrendered keys survive because nothing is rebuilt from scratch.
 */
export function patchJsonDocument(text: string, label: string, mutate: (draft: JsonObject) => void): string {
  const parsed = parseJsonDocument(text, label);
  if (!parsed.ok) throw new StructuredInputError(parsed.error);
  const draft = cloneJson(parsed.value);
  mutate(draft);
  return serializeJsonDocument(draft);
}

export function objectChild(parent: JsonObject, key: string): JsonObject | null {
  return isJsonObject(parent[key]) ? (parent[key] as JsonObject) : null;
}

export function arrayChild(parent: JsonObject, key: string): unknown[] | null {
  return Array.isArray(parent[key]) ? (parent[key] as unknown[]) : null;
}

/** Reads a nested object path, creating plain objects only when `create` is set. */
export function ensureObjectPath(parent: JsonObject, keys: readonly string[], create: boolean): JsonObject | null {
  let cursor: JsonObject = parent;
  for (const key of keys) {
    const next = objectChild(cursor, key);
    if (next) {
      cursor = next;
      continue;
    }
    if (!create || cursor[key] !== undefined) return null;
    const created: JsonObject = {};
    cursor[key] = created;
    cursor = created;
  }
  return cursor;
}

/** Assigns a value, or removes the key entirely when `value` is `undefined`. */
export function assignEntry(parent: JsonObject, key: string, value: unknown): void {
  if (value === undefined) delete parent[key];
  else parent[key] = value;
}

/* ------------------------------------------------------------------ runtime */

export function runtimePolicyOf(document: JsonObject): JsonObject | null {
  return objectChild(document, "policy");
}

export function runtimeRequestsOf(document: JsonObject): unknown[] | null {
  return arrayChild(document, "requests");
}

export type RequestIssue = {
  index: number;
  field: "row" | "request_id" | "arrival_time_ps" | "tp_degree" | "participants" | "phase";
  message: string;
};

function integerIssue(
  index: number,
  field: RequestIssue["field"],
  label: string,
  value: unknown,
  minimum: number,
  maximum: number,
): RequestIssue | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { index, field, message: `第 ${index + 1} 行：${label} 必须是整数。` };
  }
  if (value < minimum || value > maximum) {
    return { index, field, message: `第 ${index + 1} 行：${label} 必须在 ${minimum}~${maximum} 之间。` };
  }
  return null;
}

/**
 * Immediate request-table checks. `arrival_time_ps` ordering mirrors the
 * loader's non-decreasing requirement (D:\tileSim\src\S0_Workload\WorkloadLoader.cpp:426-428).
 */
export function validateRuntimeRequests(
  requests: unknown,
  versionedReplay = false,
): { issues: RequestIssue[]; rows: number } {
  if (!Array.isArray(requests))
    return { issues: [{ index: -1, field: "row", message: "requests 必须是数组。" }], rows: 0 };
  const issues: RequestIssue[] = [];
  const rows = requests.length;
  if (rows < runtimeRequestMinItems)
    issues.push({ index: -1, field: "row", message: `至少需要 ${runtimeRequestMinItems} 条请求。` });
  if (rows > runtimeRequestMaxItems)
    issues.push({ index: -1, field: "row", message: `请求行不能超过 ${runtimeRequestMaxItems} 条。` });
  const seen = new Set<string>();
  let previousArrival: number | null = null;
  requests.forEach((row, index) => {
    if (!isJsonObject(row)) {
      issues.push({ index, field: "row", message: `第 ${index + 1} 行必须是对象。` });
      return;
    }
    const requestId = row.request_id;
    if (typeof requestId !== "string" || !requestId.length) {
      issues.push({ index, field: "request_id", message: `第 ${index + 1} 行：request_id 不能为空。` });
    } else if (seen.has(requestId) && !versionedReplay) {
      issues.push({ index, field: "request_id", message: `第 ${index + 1} 行：request_id「${requestId}」重复。` });
    } else {
      seen.add(requestId);
    }
    const arrival = row.arrival_time_ps;
    const arrivalIssue = integerIssue(
      index,
      "arrival_time_ps",
      "到达时间（arrival_time_ps）",
      arrival,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (arrivalIssue) issues.push(arrivalIssue);
    else if (typeof arrival === "number") {
      if (previousArrival !== null && arrival < previousArrival) {
        issues.push({
          index,
          field: "arrival_time_ps",
          message: `第 ${index + 1} 行：到达时间 ${arrival} 小于上一行的 ${previousArrival}（必须非递减）。`,
        });
      }
      previousArrival = arrival;
    }
    const tpIssue = integerIssue(index, "tp_degree", "tp_degree", row.tp_degree, 1, 1024);
    if (tpIssue) issues.push(tpIssue);
    if (row.participants !== undefined) {
      if (!Array.isArray(row.participants)) {
        issues.push({ index, field: "participants", message: `第 ${index + 1} 行：participants 必须是字符串数组。` });
      } else if (row.participants.length > requestParticipantsMaxItems) {
        issues.push({
          index,
          field: "participants",
          message: `第 ${index + 1} 行：participants 不能超过 ${requestParticipantsMaxItems} 项。`,
        });
      } else if (row.participants.some((entry) => typeof entry !== "string" || !entry.length)) {
        issues.push({
          index,
          field: "participants",
          message: `第 ${index + 1} 行：participants 每一项都必须是非空字符串。`,
        });
      }
    }
    if (row.phase !== undefined && row.phase !== "prefill" && row.phase !== "decode" && row.phase !== "request") {
      issues.push({ index, field: "phase", message: `第 ${index + 1} 行：phase 只能是 prefill、decode 或 request。` });
    }
  });
  return { issues, rows };
}

export function parseParticipantsText(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function formatParticipantsText(value: unknown): string {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string").join(", ") : "";
}

function uniqueRequestId(existing: Set<string>): string {
  for (let index = 0; index < 100_000; index += 1) {
    const candidate = `req_${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new StructuredInputError("无法生成新的 request_id。");
}

/** Appends a row that keeps the non-decreasing arrival invariant and copies tp_degree. */
export function appendRequestRow(document: JsonObject): void {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  if (requests.length >= runtimeRequestMaxItems)
    throw new StructuredInputError(`请求行不能超过 ${runtimeRequestMaxItems} 条。`);
  const ids = new Set(
    requests
      .map((row) => (isJsonObject(row) ? row.request_id : undefined))
      .filter((value): value is string => typeof value === "string"),
  );
  const last = isJsonObject(requests.at(-1)) ? (requests.at(-1) as JsonObject) : null;
  const row: JsonObject = { request_id: uniqueRequestId(ids) };
  if (last && typeof last.arrival_time_ps === "number") row.arrival_time_ps = last.arrival_time_ps;
  if (last && typeof last.tp_degree === "number") row.tp_degree = last.tp_degree;
  requests.push(row);
}

export function duplicateRequestRow(document: JsonObject, index: number): void {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  if (requests.length >= runtimeRequestMaxItems)
    throw new StructuredInputError(`请求行不能超过 ${runtimeRequestMaxItems} 条。`);
  const source = requests[index];
  if (!isJsonObject(source)) throw new StructuredInputError(`第 ${index + 1} 行不是对象，无法复制。`);
  const ids = new Set(
    requests
      .map((row) => (isJsonObject(row) ? row.request_id : undefined))
      .filter((value): value is string => typeof value === "string"),
  );
  const copy = cloneJson(source);
  copy.request_id = uniqueRequestId(ids);
  requests.splice(index + 1, 0, copy);
}

export function removeRequestRow(document: JsonObject, index: number): void {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  if (requests.length <= runtimeRequestMinItems)
    throw new StructuredInputError(`至少需要 ${runtimeRequestMinItems} 条请求，无法继续删除。`);
  requests.splice(index, 1);
}

/**
 * Grows or shrinks the request list through the row helpers above, so a bulk
 * change and a single click obey the same invariants: a new row keeps the
 * non-decreasing arrival order and copies `tp_degree` from its predecessor, and
 * the list never drops below the contract's minimum.
 *
 * Rows are added at the end and removed from the end, which is what keeps the
 * indexes of the rows a caller did not name unchanged.
 */
export function setRequestCount(document: JsonObject, count: number): { added: number; removed: number } {
  if (!Number.isInteger(count) || count < runtimeRequestMinItems) {
    throw new StructuredInputError(`请求条数至少是 ${runtimeRequestMinItems} 条。`);
  }
  if (count > runtimeRequestMaxItems) throw new StructuredInputError(`请求条数不能超过 ${runtimeRequestMaxItems} 条。`);
  if (!runtimeRequestsOf(document)) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  let added = 0;
  let removed = 0;
  while ((runtimeRequestsOf(document) || []).length < count) {
    appendRequestRow(document);
    added += 1;
  }
  while ((runtimeRequestsOf(document) || []).length > count) {
    const requests = runtimeRequestsOf(document) || [];
    removeRequestRow(document, requests.length - 1);
    removed += 1;
  }
  return { added, removed };
}

/** Option ① of the device-count pairing notice: rewrite every participants list. */
export function rewriteParticipants(document: JsonObject, deviceIds: readonly string[]): number {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  let rewritten = 0;
  requests.forEach((row) => {
    if (!isJsonObject(row)) return;
    row.participants = [...deviceIds];
    rewritten += 1;
  });
  return rewritten;
}

/** Keeps the existing TP degree while selecting that many devices from the new inventory. */
export function rewriteParticipantsForExistingTp(document: JsonObject, deviceIds: readonly string[]): number {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  if (!deviceIds.length) throw new StructuredInputError("至少需要一张设备才能设置请求参与设备。");
  if (new Set(deviceIds).size !== deviceIds.length)
    throw new StructuredInputError("设备清单包含重复 device_id，不能安全设置请求参与设备。");
  let rewritten = 0;
  requests.forEach((row, index) => {
    if (!isJsonObject(row)) return;
    const tp = row.tp_degree;
    if (typeof tp !== "number" || !Number.isInteger(tp) || tp < 1 || tp > deviceIds.length) {
      throw new StructuredInputError(
        `第 ${index + 1} 条请求的 TP 必须在 1~${deviceIds.length} 之间，才能保留原并行度。`,
      );
    }
    row.participants = deviceIds.slice(0, tp);
    rewritten += 1;
  });
  return rewritten;
}

/**
 * Couples a resized device inventory to every request in one explicit action.
 *
 * Device count and tensor parallelism are separate contract fields, so changing
 * one must never silently rewrite the other.  The structured editor calls this
 * helper only after the user chooses the "TP 与参与设备一起改" pairing action;
 * the assistant can therefore offer the same safe, reviewable operation without
 * inventing a participants array in its scalar parameter catalogue.
 */
export function rewriteRequestParallelism(document: JsonObject, deviceIds: readonly string[]): number {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  if (!deviceIds.length) throw new StructuredInputError("至少需要一张设备才能设置请求参与设备。");
  if (new Set(deviceIds).size !== deviceIds.length)
    throw new StructuredInputError("设备清单包含重复 device_id，不能安全设置请求参与设备。");
  let rewritten = 0;
  requests.forEach((row) => {
    if (!isJsonObject(row)) return;
    row.tp_degree = deviceIds.length;
    row.participants = [...deviceIds];
    rewritten += 1;
  });
  return rewritten;
}

/** Option ② of the device-count pairing notice: drop participants so the engine derives them. */
export function clearParticipants(document: JsonObject): { cleared: number; missingTpDegree: number } {
  const requests = runtimeRequestsOf(document);
  if (!requests) throw new StructuredInputError("runtime trace 缺少 requests 数组。");
  let cleared = 0;
  let missingTpDegree = 0;
  requests.forEach((row) => {
    if (!isJsonObject(row)) return;
    if (row.participants !== undefined) cleared += 1;
    delete row.participants;
    if (typeof row.tp_degree !== "number") missingTpDegree += 1;
  });
  return { cleared, missingTpDegree };
}

/* ----------------------------------------------------------------- topology */

export function topologyOf(document: JsonObject): JsonObject | null {
  return objectChild(document, "topology");
}

export function topologyDevicesOf(document: JsonObject): unknown[] | null {
  const topology = topologyOf(document);
  return topology ? arrayChild(topology, "devices") : null;
}

export function deviceIdsOf(document: JsonObject): string[] {
  const devices = topologyDevicesOf(document) || [];
  return devices
    .map((entry) => (isJsonObject(entry) ? entry.device_id : undefined))
    .filter((value): value is string => typeof value === "string");
}

export type DeviceReference = { domains: string[]; links: number[] };

export function deviceReferences(document: JsonObject, deviceId: string): DeviceReference {
  const topology = topologyOf(document);
  const domains: string[] = [];
  const links: number[] = [];
  const domainList = topology ? arrayChild(topology, "domains") || [] : [];
  domainList.forEach((entry) => {
    if (!isJsonObject(entry)) return;
    const members = arrayChild(entry, "member_devices");
    if (members?.includes(deviceId) && typeof entry.domain_id === "string") domains.push(entry.domain_id);
  });
  const linkList = topology ? arrayChild(topology, "links") || [] : [];
  linkList.forEach((entry, index) => {
    if (!isJsonObject(entry)) return;
    if (entry.src_device === deviceId || entry.dst_device === deviceId) links.push(index);
  });
  return { domains, links };
}

export function nextDeviceId(existing: readonly string[]): string {
  const used = new Set(existing);
  for (let index = 0; index < topologyDeviceMaxItems * 2; index += 1) {
    const candidate = `${DEVICE_ID_PREFIX}${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new StructuredInputError("无法生成新的 device_id。");
}

/**
 * Renames a device and every reference to it. A bare rename would leave
 * `domains[].member_devices` and `links[]` pointing at a device that no longer
 * exists, which the topology validator rejects outright, so the references are
 * rewritten in the same patch.
 */
export function renameDevice(document: JsonObject, from: string, to: string): void {
  if (from === to) return;
  if (!to.length) throw new StructuredInputError("device_id 不能为空。");
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const devices = arrayChild(topology, "devices");
  if (!devices) throw new StructuredInputError("topology JSON 缺少 devices 数组。");
  const ids = deviceIdsOf(document);
  if (ids.includes(to)) throw new StructuredInputError(`device_id「${to}」已存在。`);
  devices.forEach((entry) => {
    if (isJsonObject(entry) && entry.device_id === from) entry.device_id = to;
  });
  (arrayChild(topology, "domains") || []).forEach((entry) => {
    if (!isJsonObject(entry)) return;
    const members = arrayChild(entry, "member_devices");
    if (!members) return;
    entry.member_devices = members.map((member) => (member === from ? to : member));
  });
  (arrayChild(topology, "links") || []).forEach((entry) => {
    if (!isJsonObject(entry)) return;
    if (entry.src_device === from) entry.src_device = to;
    if (entry.dst_device === from) entry.dst_device = to;
  });
}

/** Removes a device and every reference to it, keeping the topology self-consistent. */
export function removeDevice(document: JsonObject, deviceId: string): DeviceReference {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const devices = arrayChild(topology, "devices");
  if (!devices) throw new StructuredInputError("topology JSON 缺少 devices 数组。");
  const references = deviceReferences(document, deviceId);
  const remaining = devices.filter((entry) => !(isJsonObject(entry) && entry.device_id === deviceId));
  topology.devices = remaining;
  (arrayChild(topology, "domains") || []).forEach((entry) => {
    if (!isJsonObject(entry)) return;
    const members = arrayChild(entry, "member_devices");
    if (!members || !members.includes(deviceId)) return;
    entry.member_devices = members.filter((member) => member !== deviceId);
  });
  const links = arrayChild(topology, "links");
  if (links) topology.links = links.filter((_, index) => !references.links.includes(index));
  return references;
}

export type DeviceCountChange = {
  added: string[];
  removed: string[];
  cleaned: DeviceReference[];
};

/**
 * Grows or shrinks the device list. Growth names devices `gpu{n}` while skipping
 * names already in use; shrinkage removes from the tail and cleans the
 * references those devices had, reporting every clean-up for the caller to show.
 */
export function setDeviceCount(document: JsonObject, count: number): DeviceCountChange {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const devices = arrayChild(topology, "devices");
  if (!devices) throw new StructuredInputError("topology JSON 缺少 devices 数组。");
  if (!Number.isInteger(count) || count < 0) throw new StructuredInputError("卡数必须是非负整数。");
  if (count > topologyDeviceMaxItems) throw new StructuredInputError(`卡数不能超过 ${topologyDeviceMaxItems}。`);
  const existing = deviceIdsOf(document);
  const added: string[] = [];
  while (devices.length < count) {
    const deviceId = nextDeviceId(existing.concat(added));
    devices.push({ device_id: deviceId, device_type: "GPU" });
    added.push(deviceId);
  }
  const removed: string[] = [];
  const cleaned: DeviceReference[] = [];
  // `removeDevice` rewrites `topology.devices`, so the id list is re-read each
  // turn instead of holding a stale array reference from before the rewrite.
  while (deviceIdsOf(document).length > count) {
    const deviceId = deviceIdsOf(document).at(-1);
    if (!deviceId) break;
    const references = removeDevice(document, deviceId);
    removed.push(deviceId);
    if (references.domains.length || references.links.length) cleaned.push(references);
  }
  return { added, removed, cleaned };
}

/* ------------------------------------------------------------------ domains */

export type DomainType = "scale_up" | "scale_out";

export function topologyDomainsOf(document: JsonObject): unknown[] | null {
  const topology = topologyOf(document);
  return topology ? arrayChild(topology, "domains") : null;
}

export function domainIdsOf(document: JsonObject): string[] {
  return (topologyDomainsOf(document) || [])
    .map((entry) => (isJsonObject(entry) ? entry.domain_id : undefined))
    .filter((value): value is string => typeof value === "string");
}

/**
 * The `module_name` / `module_kind` pairs a new domain can bind to. A domain
 * whose `module_binding` names no declared module is schema-valid but
 * semantically dead, so the panel only ever offers names that exist.
 */
export function moduleBindingNamesOf(document: JsonObject): { name: string; kind: string }[] {
  const topology = topologyOf(document);
  const bindings = topology ? arrayChild(topology, "module_bindings") || [] : [];
  return bindings
    .filter(isJsonObject)
    .map((entry) => ({
      name: typeof entry.module_name === "string" ? entry.module_name : "",
      kind: typeof entry.module_kind === "string" ? entry.module_kind : "",
    }))
    .filter((entry) => entry.name.length > 0);
}

/**
 * Editor-only naming for new domains: the contract only requires a non-empty
 * string, so the prefix mirrors the shipped template (`su0` / `so0`) and skips
 * suffixes already in use.
 */
export const DOMAIN_ID_PREFIX: Record<DomainType, string> = { scale_up: "su", scale_out: "so" };

export function nextDomainId(existing: readonly string[], domainType: DomainType): string {
  const used = new Set(existing);
  const prefix = DOMAIN_ID_PREFIX[domainType];
  for (let index = 0; index < topologyDomainMaxItems * 2; index += 1) {
    const candidate = `${prefix}${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new StructuredInputError("无法生成新的 domain_id。");
}

export type DomainReference = { links: number[] };

export function domainReferences(document: JsonObject, domainId: string): DomainReference {
  const topology = topologyOf(document);
  const links: number[] = [];
  (topology ? arrayChild(topology, "links") || [] : []).forEach((entry, index) => {
    if (isJsonObject(entry) && entry.domain_id === domainId) links.push(index);
  });
  return { links };
}

function domainAt(document: JsonObject, domainId: string): JsonObject {
  const domains = topologyDomainsOf(document);
  if (!domains) throw new StructuredInputError("topology JSON 缺少 domains 数组。");
  const found = domains.find((entry) => isJsonObject(entry) && entry.domain_id === domainId);
  if (!found || !isJsonObject(found)) throw new StructuredInputError(`找不到 domain「${domainId}」。`);
  return found;
}

/**
 * Adds an empty domain. `module_binding` is required by the contract, so it
 * cannot be left for later; members start empty and are ticked in the panel.
 */
export function addDomain(
  document: JsonObject,
  entry: { domain_id: string; domain_type: DomainType; module_binding: string },
): void {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const domains = arrayChild(topology, "domains");
  if (!domains) throw new StructuredInputError("topology JSON 缺少 domains 数组。");
  if (domains.length >= topologyDomainMaxItems)
    throw new StructuredInputError(`域的数量不能超过 ${topologyDomainMaxItems}。`);
  const domainId = entry.domain_id.trim();
  if (!domainId) throw new StructuredInputError("domain_id 不能为空。");
  if (domainIdsOf(document).includes(domainId)) throw new StructuredInputError(`domain_id「${domainId}」已存在。`);
  const moduleBinding = entry.module_binding.trim();
  if (!moduleBinding) throw new StructuredInputError("新增域必须指定一个 module_binding。");
  domains.push({
    domain_id: domainId,
    domain_type: entry.domain_type,
    member_devices: [],
    module_binding: moduleBinding,
  });
}

/**
 * Renames a domain and every `links[].domain_id` that pointed at it. A bare
 * rename would leave links pointing at a domain that no longer exists, which the
 * topology validator rejects outright, so the references are rewritten in the
 * same patch.
 */
export function renameDomain(document: JsonObject, from: string, to: string): void {
  if (from === to) return;
  const next = to.trim();
  if (!next) throw new StructuredInputError("domain_id 不能为空。");
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const domains = arrayChild(topology, "domains");
  if (!domains) throw new StructuredInputError("topology JSON 缺少 domains 数组。");
  if (domainIdsOf(document).includes(next)) throw new StructuredInputError(`domain_id「${next}」已存在。`);
  let renamed = 0;
  domains.forEach((entry) => {
    if (!isJsonObject(entry) || entry.domain_id !== from) return;
    entry.domain_id = next;
    renamed += 1;
  });
  if (!renamed) throw new StructuredInputError(`找不到 domain「${from}」。`);
  (arrayChild(topology, "links") || []).forEach((entry) => {
    if (isJsonObject(entry) && entry.domain_id === from) entry.domain_id = next;
  });
}

export function setDomainType(document: JsonObject, domainId: string, domainType: DomainType): void {
  domainAt(document, domainId).domain_type = domainType;
}

export function setDomainModuleBinding(document: JsonObject, domainId: string, moduleBinding: string): void {
  const next = moduleBinding.trim();
  if (!next) throw new StructuredInputError("module_binding 不能为空。");
  domainAt(document, domainId).module_binding = next;
}

/** Adds or removes one device from a domain's member list. */
export function setDomainMember(document: JsonObject, domainId: string, deviceId: string, include: boolean): void {
  const domain = domainAt(document, domainId);
  const members = arrayChild(domain, "member_devices");
  if (!members) throw new StructuredInputError("域缺少 member_devices 数组。");
  if (include && !deviceIdsOf(document).includes(deviceId))
    throw new StructuredInputError(`设备「${deviceId}」不存在。`);
  const next = include
    ? members.includes(deviceId)
      ? members
      : members.concat(deviceId)
    : members.filter((member) => member !== deviceId);
  domain.member_devices = next;
}

/**
 * Removes a domain together with the links that belonged to it. A link whose
 * `domain_id` no longer exists is rejected by the topology validator, so those
 * links have to be dropped in the same patch; the count is returned for the
 * caller to report.
 */
export function removeDomain(document: JsonObject, domainId: string): DomainReference {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const domains = arrayChild(topology, "domains");
  if (!domains) throw new StructuredInputError("topology JSON 缺少 domains 数组。");
  const references = domainReferences(document, domainId);
  topology.domains = domains.filter((entry) => !(isJsonObject(entry) && entry.domain_id === domainId));
  const links = arrayChild(topology, "links");
  if (links) topology.links = links.filter((_, index) => !references.links.includes(index));
  return references;
}

/* ------------------------------------------------------------ module_bindings */

export type ModuleKind = DomainType;

export function moduleBindingsOf(document: JsonObject): unknown[] | null {
  const topology = topologyOf(document);
  return topology ? arrayChild(topology, "module_bindings") : null;
}

export type ModuleReference = { domains: string[] };

/**
 * Domains whose `module_binding` names this module. `domain.module_binding` is a
 * required key, so removing a module that a domain still names cannot be papered
 * over by clearing the domain: the caller has to refuse and report these names.
 */
export function moduleBindingReferences(document: JsonObject, moduleName: string): ModuleReference {
  const domains = topologyDomainsOf(document) || [];
  const referencing = domains
    .map((entry) => (isJsonObject(entry) ? entry : null))
    .filter((entry): entry is JsonObject => entry !== null && entry.module_binding === moduleName)
    .map((entry) => (typeof entry.domain_id === "string" ? entry.domain_id : ""))
    .filter((value) => value.length > 0);
  return { domains: referencing };
}

function moduleBindingAt(document: JsonObject, moduleName: string): JsonObject {
  const bindings = moduleBindingsOf(document);
  if (!bindings) throw new StructuredInputError("topology JSON 缺少 module_bindings 数组。");
  const found = bindings.find((entry) => isJsonObject(entry) && entry.module_name === moduleName);
  if (!found || !isJsonObject(found)) throw new StructuredInputError(`找不到模型「${moduleName}」。`);
  return found;
}

function moduleFieldMeta(key: string): (typeof moduleBindingFields)[number] | undefined {
  return moduleBindingFields.find((field) => field.key === key);
}

/**
 * Editor-only placeholder naming. The contract only asks for a non-empty string,
 * but the backend resolves `module_name` against real modules, so the generated
 * name is deliberately neutral (`model_1`) and the panel says to replace it —
 * inventing a plausible-looking module name would be a fabricated fact.
 */
export const MODULE_NAME_PREFIX = "model";

export function nextModuleBindingName(existing: readonly string[]): string {
  const used = new Set(existing);
  for (let index = 0; index < topologyModuleBindingMaxItems * 2; index += 1) {
    const candidate = `${MODULE_NAME_PREFIX}_${index + 1}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new StructuredInputError("无法生成新的 module_name。");
}

export function addModuleBinding(document: JsonObject, entry: { module_name: string; module_kind: ModuleKind }): void {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const bindings = arrayChild(topology, "module_bindings");
  if (!bindings) throw new StructuredInputError("topology JSON 缺少 module_bindings 数组。");
  if (bindings.length >= topologyModuleBindingMaxItems)
    throw new StructuredInputError(`模型数量不能超过 ${topologyModuleBindingMaxItems} 个。`);
  const name = entry.module_name.trim();
  if (!name) throw new StructuredInputError("module_name 不能为空。");
  const maxLength = moduleFieldMeta("module_name")?.maxLength;
  if (typeof maxLength === "number" && name.length > maxLength)
    throw new StructuredInputError(`module_name 不能超过 ${maxLength} 个字符。`);
  if (moduleBindingNamesOf(document).some((binding) => binding.name === name))
    throw new StructuredInputError(`模型名「${name}」已存在。`);
  bindings.push({ module_name: name, module_kind: entry.module_kind });
}

/**
 * Renames a module and every `domains[].module_binding` that named it. A bare
 * rename would leave domains pointing at a module that no longer exists, and
 * `domain.module_binding` is required, so the references are rewritten in the
 * same patch.
 */
export function renameModuleBinding(document: JsonObject, from: string, to: string): void {
  if (from === to) return;
  const next = to.trim();
  if (!next) throw new StructuredInputError("module_name 不能为空。");
  const maxLength = moduleFieldMeta("module_name")?.maxLength;
  if (typeof maxLength === "number" && next.length > maxLength)
    throw new StructuredInputError(`module_name 不能超过 ${maxLength} 个字符。`);
  const bindings = moduleBindingsOf(document);
  if (!bindings) throw new StructuredInputError("topology JSON 缺少 module_bindings 数组。");
  if (moduleBindingNamesOf(document).some((binding) => binding.name === next))
    throw new StructuredInputError(`模型名「${next}」已存在。`);
  let renamed = 0;
  bindings.forEach((entry) => {
    if (!isJsonObject(entry) || entry.module_name !== from) return;
    entry.module_name = next;
    renamed += 1;
  });
  if (!renamed) throw new StructuredInputError(`找不到模型「${from}」。`);
  (topologyDomainsOf(document) || []).forEach((entry) => {
    if (isJsonObject(entry) && entry.module_binding === from) entry.module_binding = next;
  });
}

export function setModuleBindingKind(document: JsonObject, moduleName: string, kind: ModuleKind): void {
  moduleBindingAt(document, moduleName).module_kind = kind;
}

/**
 * Writes the optional string keys (`module_version`, `config_profile`). An empty
 * value removes the key instead of writing `""`, because the contract treats
 * "absent" and "empty text" differently in the report.
 */
export function setModuleBindingText(
  document: JsonObject,
  moduleName: string,
  key: "module_version" | "config_profile",
  value: string,
): void {
  const binding = moduleBindingAt(document, moduleName);
  const trimmed = value.trim();
  if (!trimmed) {
    delete binding[key];
    return;
  }
  const maxLength = moduleFieldMeta(key)?.maxLength;
  if (typeof maxLength === "number" && trimmed.length > maxLength)
    throw new StructuredInputError(`${key} 不能超过 ${maxLength} 个字符。`);
  binding[key] = trimmed;
}

/**
 * Removes a module that no domain names any more. A module still referenced by a
 * domain is refused — with the referencing domain ids — because deleting it would
 * leave those domains without the `module_binding` the contract requires.
 */
export function removeModuleBinding(document: JsonObject, moduleName: string): ModuleReference {
  const topology = topologyOf(document);
  if (!topology) throw new StructuredInputError("topology JSON 缺少 topology 对象。");
  const bindings = arrayChild(topology, "module_bindings");
  if (!bindings) throw new StructuredInputError("topology JSON 缺少 module_bindings 数组。");
  if (!bindings.some((entry) => isJsonObject(entry) && entry.module_name === moduleName))
    throw new StructuredInputError(`找不到模型「${moduleName}」。`);
  const references = moduleBindingReferences(document, moduleName);
  if (references.domains.length)
    throw new StructuredInputError(
      `模型「${moduleName}」还被这些域绑定：${references.domains.join("、")}。请先把它们改绑到别的模型，或先删掉这些域。`,
    );
  topology.module_bindings = bindings.filter((entry) => !(isJsonObject(entry) && entry.module_name === moduleName));
  return references;
}

/* ---------------------------------------------------------------- R2 seeding */

export type SeedEntry = { pointer: string; value: string | number | boolean };

/**
 * `impedes` marks a note that reports something the user still has to act on, so
 * the caller can show it as a warning instead of a success toast.
 */
export type SeedNote = { code: string; message: string; impedes: boolean };

export type SeedResult = { runtimeJson: string; topologyJson: string; notes: SeedNote[] };

const RUNTIME_POINTER_PREFIX = "/overrides/runtime/";
const FABRIC_POINTER_PREFIX = "/overrides/fabric/";
const WORKLOAD_POINTER_PREFIX = "/overrides/workload/";

/** Builds the transferable entries from the descriptor-backed control surface. */
export function seedEntriesFromControls(
  fields: readonly ExperimentControlDescriptor[],
  parameterValues: Record<string, ParameterValue>,
): SeedEntry[] {
  const entries: SeedEntry[] = [];
  fields.forEach((field) => {
    if (!field.available) return;
    if (!field.applicableInputModes.includes("controls")) return;
    const value = parameterValues[field.fieldId];
    if (value === undefined || value === null || value === "") return;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
    entries.push({ pointer: field.requestJsonPointer, value });
  });
  return entries;
}

/**
 * Transfers the quick-control values into the structured documents.
 *
 * Runtime policy keys land in `runtime_trace.policy`; fabric bandwidth/latency
 * keys land in the matching `module_bindings[].override_params`. The workload
 * message-size multiplier is deliberately NOT rescaled — the quick-control value
 * is a multiplier applied to a different message-size source, so any conversion
 * would be a guess; a note is returned instead.
 */
export function seedStructuredInput(options: {
  runtimeJson: string;
  topologyJson: string;
  entries: readonly SeedEntry[];
  /** Defaults to the policy keys the trace schema declares. */
  policyKeys?: readonly string[];
  /** Defaults to the override parameters the topology schema declares. */
  overrideKeys?: readonly string[];
}): SeedResult {
  const notes: SeedNote[] = [];
  let runtimeJson = options.runtimeJson;
  let topologyJson = options.topologyJson;
  const policyKeys: readonly string[] = options.policyKeys || runtimePolicyFields.map((field) => field.key);
  const overrideKeys: readonly string[] = options.overrideKeys || moduleBindingOverrideFields.map((field) => field.key);

  const runtimeEntries = options.entries.filter((entry) => entry.pointer.startsWith(RUNTIME_POINTER_PREFIX));
  const fabricEntries = options.entries.filter((entry) => entry.pointer.startsWith(FABRIC_POINTER_PREFIX));
  const workloadEntries = options.entries.filter((entry) => entry.pointer.startsWith(WORKLOAD_POINTER_PREFIX));

  if (runtimeEntries.length) {
    const parsed = parseJsonDocument(runtimeJson, "Runtime trace");
    if (!parsed.ok) {
      notes.push({ code: "runtime_unavailable", message: `未写入 runtime 旋钮：${parsed.error}`, impedes: true });
    } else {
      const applied = runtimeEntries.filter((entry) =>
        policyKeys.includes(entry.pointer.slice(RUNTIME_POINTER_PREFIX.length)),
      );
      try {
        runtimeJson = patchJsonDocument(runtimeJson, "Runtime trace", (draft) => {
          const policy = ensureObjectPath(draft, ["policy"], true);
          if (!policy) throw new StructuredInputError("runtime trace 缺少 policy 对象。");
          applied.forEach((entry) => {
            policy[entry.pointer.slice(RUNTIME_POINTER_PREFIX.length)] = entry.value;
          });
        });
        notes.push({
          code: "runtime_seeded",
          message: `已把 ${applied.length} 个 runtime 旋钮写入 policy。`,
          impedes: false,
        });
        const skipped = runtimeEntries.length - applied.length;
        if (skipped > 0)
          notes.push({
            code: "runtime_skipped",
            message: `有 ${skipped} 个 runtime 旋钮没有对应的 policy 键，未写入。`,
            impedes: true,
          });
      } catch (error) {
        notes.push({
          code: "runtime_unavailable",
          message: `未写入 runtime 旋钮：${error instanceof Error ? error.message : String(error)}`,
          impedes: true,
        });
      }
    }
  }

  if (fabricEntries.length) {
    const parsed = parseJsonDocument(topologyJson, "Fabric topology");
    if (!parsed.ok) {
      notes.push({ code: "topology_unavailable", message: `未写入 fabric 旋钮：${parsed.error}`, impedes: true });
    } else {
      const written: string[] = [];
      const missing: string[] = [];
      try {
        topologyJson = patchJsonDocument(topologyJson, "Fabric topology", (draft) => {
          const topology = ensureObjectPath(draft, ["topology"], false);
          const bindings = topology ? arrayChild(topology, "module_bindings") || [] : [];
          fabricEntries.forEach((entry) => {
            const suffix = entry.pointer.slice(FABRIC_POINTER_PREFIX.length);
            const match = overrideKeys
              .map((key) => ({ key, kind: suffix.slice(0, suffix.length - key.length - 1) }))
              .find((candidate) => suffix === `${candidate.kind}_${candidate.key}`);
            if (!match) {
              missing.push(suffix);
              return;
            }
            let targets = 0;
            bindings.forEach((binding) => {
              if (!isJsonObject(binding) || binding.module_kind !== match.kind) return;
              const params = isJsonObject(binding.override_params) ? (binding.override_params as JsonObject) : {};
              binding.override_params = params;
              params[match.key] = entry.value;
              targets += 1;
            });
            if (targets === 0) missing.push(`${match.kind}.${match.key}`);
            else written.push(`${match.kind}.${match.key}`);
          });
        });
        if (written.length)
          notes.push({
            code: "fabric_seeded",
            message: `已把 ${written.length} 个 fabric 旋钮写入 module_bindings。`,
            impedes: false,
          });
        if (missing.length)
          notes.push({
            code: "fabric_missing_binding",
            message: `拓扑里没有对应的 module_binding，未写入：${missing.join("、")}。`,
            impedes: true,
          });
      } catch (error) {
        notes.push({
          code: "topology_unavailable",
          message: `未写入 fabric 旋钮：${error instanceof Error ? error.message : String(error)}`,
          impedes: true,
        });
      }
    }
  }

  if (workloadEntries.length) {
    notes.push({
      code: "workload_multiplier_not_rescaled",
      impedes: true,
      message:
        "workload.message_size_multiplier 是快捷控制的乘数，作用对象与 runtime_trace/topology 里的消息大小不同，本面板不会自动折算，请按需在 JSON 里自行设置。",
    });
  }

  return { runtimeJson, topologyJson, notes };
}

export type ControlWriteResult = { runtimeJson: string; topologyJson: string; note: SeedNote | null };

/**
 * Reads the structured documents back into the scalar control surface.
 *
 * The structured editors and the quick controls are two views over the same
 * draft, not two independent sources of truth.  A control pointer is allowed
 * to be read only when the corresponding structured document owns that value;
 * workload.message_size_multiplier intentionally remains unsupported because
 * it is a multiplier with no lossless document equivalent.  `found: false`
 * means the owning document omitted the optional key and lets the caller show
 * the same "unset" state as the JSON editor.
 */
export type ControlReadResult = {
  supported: boolean;
  found: boolean;
  value?: string | number | boolean;
};

function scalarValue(value: unknown): string | number | boolean | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

export function readControlPointer(options: {
  runtimeJson: string;
  topologyJson: string;
  pointer: string;
  policyKeys?: readonly string[];
  overrideKeys?: readonly string[];
}): ControlReadResult {
  const policyKeys: readonly string[] = options.policyKeys || runtimePolicyFields.map((field) => field.key);
  const overrideKeys: readonly string[] = options.overrideKeys || moduleBindingOverrideFields.map((field) => field.key);

  if (options.pointer.startsWith(RUNTIME_POINTER_PREFIX)) {
    const key = options.pointer.slice(RUNTIME_POINTER_PREFIX.length);
    if (!policyKeys.includes(key)) return { supported: false, found: false };
    const parsed = parseJsonDocument(options.runtimeJson, "Runtime trace");
    if (!parsed.ok) return { supported: false, found: false };
    const policy = runtimePolicyOf(parsed.value);
    if (!policy) return { supported: false, found: false };
    if (!Object.hasOwn(policy, key)) return { supported: true, found: false };
    const value = scalarValue(policy[key]);
    return value === undefined ? { supported: true, found: false } : { supported: true, found: true, value };
  }

  if (options.pointer.startsWith(FABRIC_POINTER_PREFIX)) {
    const suffix = options.pointer.slice(FABRIC_POINTER_PREFIX.length);
    const match = overrideKeys
      .map((key) => ({ key, kind: suffix.slice(0, suffix.length - key.length - 1) }))
      .find((candidate) => suffix === `${candidate.kind}_${candidate.key}`);
    if (!match) return { supported: false, found: false };
    const parsed = parseJsonDocument(options.topologyJson, "Fabric topology");
    if (!parsed.ok) return { supported: true, found: false };
    const topology = topologyOf(parsed.value);
    const bindings = topology ? arrayChild(topology, "module_bindings") || [] : [];
    const matchingBindings = bindings.filter(
      (binding): binding is JsonObject => isJsonObject(binding) && binding.module_kind === match.kind,
    );
    if (!matchingBindings.length) return { supported: false, found: false };
    const values = matchingBindings
      .map((binding) => {
        const params = isJsonObject(binding.override_params) ? binding.override_params : null;
        return params && Object.hasOwn(params, match.key) ? scalarValue(params[match.key]) : undefined;
      })
      .filter((value): value is string | number | boolean => value !== undefined);
    if (!values.length) return { supported: true, found: false };
    const first = values[0];
    // A single control cannot represent divergent bindings.  Leave it alone
    // rather than silently selecting one module's value.
    if (values.some((value) => value !== first)) return { supported: true, found: false };
    return { supported: true, found: true, value: first };
  }

  return { supported: false, found: false };
}

/**
 * Mirrors one quick-control knob into the structured documents.
 *
 * While the structured editor sits open next to the knobs both surfaces claim
 * the same keys, so this deliberately touches only the key the knob owns:
 * a value typed straight into the form or the raw JSON is never collateral
 * damage from an unrelated knob edit. `value === undefined` removes the key,
 * which is exactly what the knob's "未设置（省略字段）" option means.
 */
export function writeControlPointer(options: {
  runtimeJson: string;
  topologyJson: string;
  pointer: string;
  value: string | number | boolean | undefined;
  /** Defaults to the policy keys the trace schema declares. */
  policyKeys?: readonly string[];
  /** Defaults to the override parameters the topology schema declares. */
  overrideKeys?: readonly string[];
}): ControlWriteResult {
  const policyKeys: readonly string[] = options.policyKeys || runtimePolicyFields.map((field) => field.key);
  const overrideKeys: readonly string[] = options.overrideKeys || moduleBindingOverrideFields.map((field) => field.key);
  const unchanged = { runtimeJson: options.runtimeJson, topologyJson: options.topologyJson };

  if (options.pointer.startsWith(RUNTIME_POINTER_PREFIX)) {
    const key = options.pointer.slice(RUNTIME_POINTER_PREFIX.length);
    if (!policyKeys.includes(key))
      return { ...unchanged, note: { code: "runtime_no_key", message: `policy 没有 ${key} 这个键。`, impedes: true } };
    try {
      const runtimeJson = patchJsonDocument(options.runtimeJson, "Runtime trace", (draft) => {
        const policy = ensureObjectPath(draft, ["policy"], true);
        if (!policy) throw new StructuredInputError("runtime trace 缺少 policy 对象。");
        assignEntry(policy, key, options.value);
      });
      return { runtimeJson, topologyJson: options.topologyJson, note: null };
    } catch (error) {
      return {
        ...unchanged,
        note: {
          code: "runtime_unavailable",
          message: `旋钮 ${key} 未写入：${error instanceof Error ? error.message : String(error)}`,
          impedes: true,
        },
      };
    }
  }

  if (options.pointer.startsWith(FABRIC_POINTER_PREFIX)) {
    const suffix = options.pointer.slice(FABRIC_POINTER_PREFIX.length);
    const match = overrideKeys
      .map((key) => ({ key, kind: suffix.slice(0, suffix.length - key.length - 1) }))
      .find((candidate) => suffix === `${candidate.kind}_${candidate.key}`);
    if (!match)
      return {
        ...unchanged,
        note: { code: "fabric_no_param", message: `override_params 没有 ${suffix} 这个键。`, impedes: true },
      };
    let targets = 0;
    try {
      const topologyJson = patchJsonDocument(options.topologyJson, "Fabric topology", (draft) => {
        const topology = ensureObjectPath(draft, ["topology"], false);
        const bindings = topology ? arrayChild(topology, "module_bindings") || [] : [];
        bindings.forEach((binding) => {
          if (!isJsonObject(binding) || binding.module_kind !== match.kind) return;
          const params = isJsonObject(binding.override_params) ? (binding.override_params as JsonObject) : {};
          binding.override_params = params;
          assignEntry(params, match.key, options.value);
          targets += 1;
        });
      });
      if (targets === 0)
        return {
          ...unchanged,
          note: {
            code: "fabric_missing_binding",
            message: `拓扑里没有 ${match.kind} 模块绑定，${match.key} 未写入。`,
            impedes: true,
          },
        };
      return { runtimeJson: options.runtimeJson, topologyJson, note: null };
    } catch (error) {
      return {
        ...unchanged,
        note: {
          code: "topology_unavailable",
          message: `旋钮 ${suffix} 未写入：${error instanceof Error ? error.message : String(error)}`,
          impedes: true,
        },
      };
    }
  }

  if (options.pointer.startsWith(WORKLOAD_POINTER_PREFIX)) {
    if (options.value === undefined) return { ...unchanged, note: null };
    return {
      ...unchanged,
      note: {
        code: "workload_multiplier_not_rescaled",
        message:
          "workload.message_size_multiplier 在结构化输入里没有对应物，未折算；请直接改每条请求的 message_size_bytes。",
        impedes: true,
      },
    };
  }

  return {
    ...unchanged,
    note: { code: "unsupported_pointer", message: `不支持的旋钮指针 ${options.pointer}。`, impedes: true },
  };
}
