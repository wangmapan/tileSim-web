/**
 * The parameter-edit engine behind the assistant's write path.
 *
 * It is deliberately a two-step, fully deterministic pipeline:
 *
 *   plan(...)  → 每行解析成 `路径 = 值`，按目录校验类型/范围/枚举，不认识的如实回报
 *   apply(...) → 只把通过校验的项写进文档，逐项给出「旧值 → 新值」回执
 *
 * Nothing is written by planning, and applying never rewrites a document the
 * edits do not touch: both document writes go through `patchJsonDocument`, so
 * keys the panel does not render survive verbatim.
 *
 * Both entry points read the same plan: a sentence the user wrote
 * (`参数路径 = 值`) and a scenario recommendation that was resolved against the
 * catalogue (see `scenario-recommendation.ts`) differ only in where the lines
 * came from, so they are validated and reported identically.
 */
import type { AgentParameterEdit } from "../../entities/agent-command";
import type { ParameterCatalogEntry, ParameterKind, ParameterTarget } from "./parameter-catalog";
import {
  StructuredInputError,
  deviceIdsOf,
  deviceReferences,
  patchJsonDocument,
  setDeviceCount,
  setRequestCount,
  type JsonObject,
} from "./structured-input";

/** A planned edit carries the resolved contract shape plus what the user typed. */
export type ParameterEditItem = AgentParameterEdit & { raw: string; kind: ParameterKind };

export type ParameterEditProblem = {
  raw: string;
  reason: string;
};

export type ParameterEditPlan = {
  items: readonly ParameterEditItem[];
  rejected: readonly ParameterEditProblem[];
  unknown: readonly ParameterEditProblem[];
};

const ASSIGNMENT_PATTERN = /([^=：\n\r]+?)\s*[=：]\s*([^=：\n\r]*)/gu;
const LINE_PATTERN = /[\n\r;；]+/u;

/** Units a user may append to a numeric value, mapped to the key suffix they suit. */
const UNIT_SUFFIXES: readonly { words: readonly string[]; suffixes: readonly string[] }[] = [
  { words: ["gbps", "gb/s", "g/s"], suffixes: ["_gbps"] },
  { words: ["mbps", "mb/s"], suffixes: ["_mbps"] },
  { words: ["us", "μs", "µs"], suffixes: ["_us"] },
  { words: ["ms"], suffixes: ["_ms"] },
  { words: ["ps"], suffixes: ["_ps"] },
  { words: ["ns"], suffixes: ["_ns"] },
  { words: ["tokens", "token"], suffixes: ["_tokens"] },
  { words: ["bytes", "byte"], suffixes: ["_bytes"] },
];

const BOOLEAN_TRUE = new Set(["true", "yes", "on", "1", "是", "真", "开", "启用"]);
const BOOLEAN_FALSE = new Set(["false", "no", "off", "0", "否", "假", "关", "停用"]);

/** The kinds this editor can write: one value per line. */
const SCALAR_KINDS: ReadonlySet<ParameterKind> = new Set<ParameterKind>([
  "integer",
  "number",
  "string",
  "boolean",
  "enum",
  "count",
]);

function normalizeName(text: string): string {
  return text
    .replace(/^[\s\-*•·>]+/u, "")
    .replace(/[`"'「」“”]/gu, "")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function lastSegment(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1].replace(/\[\d+\]$/u, "");
}

function shortPath(path: string): string {
  const segments = path.split("/");
  return segments.slice(1).join("/");
}

type CatalogIndex = {
  byFull: Map<string, ParameterCatalogEntry>;
  byShort: Map<string, ParameterCatalogEntry[]>;
  byKey: Map<string, ParameterCatalogEntry[]>;
  byLabel: Map<string, ParameterCatalogEntry[]>;
};

function indexCatalog(catalog: readonly ParameterCatalogEntry[]): CatalogIndex {
  const byFull = new Map<string, ParameterCatalogEntry>();
  const byShort = new Map<string, ParameterCatalogEntry[]>();
  const byKey = new Map<string, ParameterCatalogEntry[]>();
  const byLabel = new Map<string, ParameterCatalogEntry[]>();
  const push = (map: Map<string, ParameterCatalogEntry[]>, key: string, entry: ParameterCatalogEntry): void => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  };
  catalog.forEach((entry) => {
    byFull.set(normalizeName(entry.path), entry);
    push(byShort, normalizeName(shortPath(entry.path)), entry);
    const key = normalizeName(lastSegment(entry.path));
    push(byKey, key, entry);
    // A document field has no display name of its own, so its label *is* its
    // key. Registering that in the label tier would be harmless if the tier ran
    // last, but it runs before the key tier — so a name that several fields
    // answer to (`max_batch_size` is both a knob and a policy key) would quietly
    // resolve to whichever field happens to be the "labelled" one instead of
    // being reported as ambiguous.
    const label = normalizeName(entry.label);
    if (label !== key) push(byLabel, label, entry);
  });
  return { byFull, byShort, byKey, byLabel };
}

type Resolution = { ok: true; entry: ParameterCatalogEntry } | { ok: false; reason: string };

function resolveEntry(name: string, index: CatalogIndex): Resolution {
  const key = normalizeName(name);
  if (!key) return { ok: false, reason: "赋值号左边是空的。" };
  const exact = index.byFull.get(key);
  if (exact) return { ok: true, entry: exact };
  const tiers: readonly Map<string, ParameterCatalogEntry[]>[] = [index.byShort, index.byLabel, index.byKey];
  for (const tier of tiers) {
    const candidates = tier.get(key);
    if (!candidates || !candidates.length) continue;
    if (candidates.length === 1) return { ok: true, entry: candidates[0] };
    const paths = [...new Set(candidates.map((candidate) => candidate.path))];
    return {
      ok: false,
      reason: `「${name.trim()}」对应 ${paths.length} 个参数，请写完整路径：${paths.join("、")}`,
    };
  }
  return { ok: false, reason: `目录里没有「${name.trim()}」这个参数。` };
}

/** Strips a unit the user appended, but only when the key's suffix accepts it. */
function stripUnit(text: string, key: string): { ok: true; text: string } | { ok: false; reason: string } {
  const match = /^([-+]?\d+(?:\.\d+)?)\s*([A-Za-z%μµ/]+)$/u.exec(text);
  if (!match) return { ok: true, text };
  const value = match[1];
  const unit = match[2].toLowerCase();
  if (unit === "%") return { ok: false, reason: `「${key}」不接受百分号写法，请写 0~1 之间的小数。` };
  const group = UNIT_SUFFIXES.find((candidate) => candidate.words.includes(unit));
  if (!group) return { ok: false, reason: `不认识单位「${match[2]}」。` };
  if (!group.suffixes.some((suffix) => key.toLowerCase().endsWith(suffix))) {
    return { ok: false, reason: `「${key}」的单位不是「${match[2]}」，请去掉单位再写数值。` };
  }
  return { ok: true, text: value };
}

type ValueResult = { ok: true; value: string | number | boolean } | { ok: false; reason: string };

function parseValue(entry: ParameterCatalogEntry, rawValue: string): ValueResult {
  if (!SCALAR_KINDS.has(entry.kind)) {
    return { ok: false, reason: `「${entry.path}」不是可写入的标量参数。` };
  }
  const text = rawValue
    .trim()
    .replace(/^[`"'「」“”]/u, "")
    .replace(/[`"'「」“”]$/u, "")
    .trim();
  if (!text) return { ok: false, reason: `「${entry.path}」缺少数值。` };
  if (entry.referenceKey) {
    // A single scalar assignment cannot keep `participants`, `member_devices`
    // and links in step with a renamed id, so these are refused rather than
    // left to corrupt the document.
    return {
      ok: false,
      reason: `「${entry.path}」是引用键，改名必须同步引用它的其它字段，请在面板里改。`,
    };
  }
  if (entry.referenceValues && !entry.referenceValues.includes(text)) {
    return {
      ok: false,
      reason: entry.referenceValues.length
        ? `「${entry.path}」只能指向已存在的 id：${entry.referenceValues.join("、")}。`
        : `「${entry.path}」需要指向一个已存在的 id，但拓扑里还没有。`,
    };
  }
  if (entry.kind === "boolean") {
    const normalized = text.toLowerCase();
    if (BOOLEAN_TRUE.has(normalized)) return { ok: true, value: true };
    if (BOOLEAN_FALSE.has(normalized)) return { ok: true, value: false };
    return { ok: false, reason: `「${entry.path}」需要 true 或 false。` };
  }
  if (entry.kind === "enum") {
    const match = entry.enumValues.find((candidate) => candidate.toLowerCase() === text.toLowerCase());
    if (match) return { ok: true, value: match };
    return {
      ok: false,
      reason: entry.enumValues.length
        ? `「${entry.path}」只能是：${entry.enumValues.join(" / ")}。`
        : `「${entry.path}」不接受这个取值。`,
    };
  }
  if (entry.kind === "string") {
    if (entry.maxLength !== null && text.length > entry.maxLength) {
      return { ok: false, reason: `「${entry.path}」最多 ${entry.maxLength} 个字符。` };
    }
    return { ok: true, value: text };
  }
  const stripped = stripUnit(text, lastSegment(entry.path));
  if (!stripped.ok) return { ok: false, reason: stripped.reason };
  const numeric = stripped.text;
  if (!/^[-+]?\d+(?:\.\d+)?$/u.test(numeric)) {
    return { ok: false, reason: `「${entry.path}」需要一个数值，收到「${rawValue.trim()}」。` };
  }
  if (entry.integerOnly && !/^[-+]?\d+$/u.test(numeric)) {
    return { ok: false, reason: `「${entry.path}」只接受整数。` };
  }
  const value = Number(numeric);
  if (!Number.isFinite(value)) return { ok: false, reason: `「${entry.path}」的数值无法解析。` };
  if (entry.minimum !== null) {
    if (entry.minimumInclusive ? value < entry.minimum : value <= entry.minimum) {
      return { ok: false, reason: `「${entry.path}」不能小于 ${entry.minimum}。` };
    }
  }
  if (entry.maximum !== null) {
    if (entry.maximumInclusive ? value > entry.maximum : value >= entry.maximum) {
      return { ok: false, reason: `「${entry.path}」不能大于 ${entry.maximum}。` };
    }
  }
  return { ok: true, value };
}

function pairsOf(line: string): { pairs: { name: string; value: string }[]; leftovers: string[] } {
  const pairs: { name: string; value: string }[] = [];
  const leftovers: string[] = [];
  let cursor = 0;
  for (const match of line.matchAll(ASSIGNMENT_PATTERN)) {
    const index = match.index ?? 0;
    const before = line.slice(cursor, index).trim();
    if (before) leftovers.push(before);
    pairs.push({ name: match[1], value: match[2] });
    cursor = index + match[0].length;
  }
  const tail = line.slice(cursor).trim();
  if (tail) leftovers.push(tail);
  return { pairs, leftovers };
}

/**
 * A comma splits one line into two assignments, but only when what follows it
 * carries an assignment of its own. Chinese input almost always separates
 * several changes with `，`, and treating it as an ordinary character would fold
 * the second change into the first one's value; requiring a following `=` keeps
 * a comma that is part of a value (`run_name = a,b`) intact.
 */
const ASSIGNMENT_SEPARATOR_PATTERN = /[,，、]+(?=[^,，、]*[=：])/u;

function splitAssignments(line: string): string[] {
  return line.split(ASSIGNMENT_SEPARATOR_PATTERN);
}

/**
 * The parts of an instruction that address a parameter, in the order typed.
 *
 * The recommender uses this to read a user's own values out of a sentence that
 * is mostly prose ("高吞吐场景，最大 batch = 32"), so the prose is not reported
 * as an unusable line. An instruction with no assignment at all yields nothing.
 */
export function assignmentSegments(instruction: string): string[] {
  return instruction
    .split(LINE_PATTERN)
    .flatMap((line) => splitAssignments(line))
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && /[=：]/u.test(segment));
}

/**
 * Turns one instruction into a plan. Every line must be `参数 = 值`; a line
 * without an assignment is reported as unusable rather than guessed at, because
 * this mode writes to the form and a guess would be a silent wrong value.
 */
export function planParameterEdits(instruction: string, catalog: readonly ParameterCatalogEntry[]): ParameterEditPlan {
  const index = indexCatalog(catalog);
  const items: ParameterEditItem[] = [];
  const rejected: ParameterEditProblem[] = [];
  const unknown: ParameterEditProblem[] = [];
  const seen = new Set<string>();

  instruction
    .split(LINE_PATTERN)
    .flatMap((line) => splitAssignments(line))
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const { pairs, leftovers } = pairsOf(line);
      if (!pairs.length) {
        unknown.push({
          raw: line,
          reason: "这一行没有「=」，本模式要求写成「参数路径 = 值」。",
        });
        return;
      }
      leftovers.forEach((leftover) => {
        if (/\d/u.test(leftover) || /[\u3400-\u9fff]/u.test(leftover)) {
          unknown.push({ raw: leftover, reason: "这段文字没有和任何参数对应上。" });
        }
      });
      pairs.forEach((pair) => {
        // The value may carry a trailing separator that survived the split.
        const value = pair.value.replace(/[\s,，、]+$/u, "");
        const resolution = resolveEntry(pair.name, index);
        if (!resolution.ok) {
          unknown.push({ raw: `${pair.name.trim()} = ${value}`, reason: resolution.reason });
          return;
        }
        const entry = resolution.entry;
        const parsed = parseValue(entry, value);
        if (!parsed.ok) {
          rejected.push({ raw: `${pair.name.trim()} = ${value}`, reason: parsed.reason });
          return;
        }
        if (seen.has(entry.path)) {
          rejected.push({ raw: `${pair.name.trim()} = ${value}`, reason: `「${entry.path}」在同一句话里出现了两次。` });
          return;
        }
        seen.add(entry.path);
        items.push({
          path: entry.path,
          raw: pair.name.trim(),
          label: entry.label,
          kind: entry.kind,
          target: entry.target,
          fieldId: entry.fieldId,
          previous: entry.current,
          next: serializeForDisplay(parsed.value),
          value: parsed.value,
        });
      });
    });

  return { items, rejected, unknown };
}

function serializeForDisplay(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

type PathSegment = string | number;

/** `topology/devices[1]/name` → `["topology", "devices", 1, "name"]`. */
function segmentsOf(path: string): PathSegment[] | null {
  const segments: PathSegment[] = [];
  for (const token of path.split("/")) {
    const match = /^([^[\]]+)(?:\[(\d+)\])?$/u.exec(token);
    if (!match) return null;
    segments.push(match[1]);
    if (match[2] !== undefined) segments.push(Number(match[2]));
  }
  return segments;
}

/**
 * Where a document's payload starts, given the document its address names.
 *
 * The runtime trace is the payload itself; the fabric document wraps its
 * contents in a `topology` key (`topologyOf()` in `structured-input.ts`). The
 * catalogue's addresses name the document, so the wrapper is added here once
 * rather than appearing in every path a user has to type.
 */
function payloadRootOf(target: ParameterTarget): readonly PathSegment[] | null {
  if (target === "runtime_trace") return [];
  if (target === "topology") return ["topology"];
  return null;
}

/**
 * Assigns one leaf. Containers are never created for numeric segments: an index
 * that the catalogue listed must still exist, otherwise the document changed
 * between planning and applying and the edit must fail loudly.
 */
function assignLeaf(draft: Record<string, unknown>, segments: readonly PathSegment[], value: unknown): void {
  let cursor: Record<string, unknown> | unknown[] = draft;
  for (let position = 0; position < segments.length - 1; position += 1) {
    const key = segments[position];
    const next = segments[position + 1];
    if (typeof key === "number") {
      if (!Array.isArray(cursor)) throw new Error("路径在数组位置上遇到非数组。");
      const existing = cursor[key];
      if (existing === undefined) throw new Error(`数组下标 ${key} 不存在。`);
      if (typeof next === "number") {
        if (!Array.isArray(existing)) throw new Error(`下标 ${key} 不是数组。`);
      } else if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
        throw new Error(`下标 ${key} 不是对象。`);
      }
      cursor = existing as Record<string, unknown> | unknown[];
      continue;
    }
    if (Array.isArray(cursor)) throw new Error(`路径在 ${key} 处类型不符。`);
    let child = cursor[key];
    if (child === undefined) {
      if (typeof next === "number") throw new Error(`缺少数组 ${key}。`);
      child = {};
      cursor[key] = child;
    }
    if (typeof next === "number") {
      if (!Array.isArray(child)) throw new Error(`${key} 不是数组。`);
    } else if (typeof child !== "object" || child === null || Array.isArray(child)) {
      throw new Error(`${key} 不是对象。`);
    }
    cursor = child as Record<string, unknown> | unknown[];
  }
  const last = segments[segments.length - 1];
  if (typeof last === "number") {
    if (!Array.isArray(cursor)) throw new Error("路径末尾落在非数组上。");
    cursor[last] = value;
    return;
  }
  if (Array.isArray(cursor)) throw new Error("路径末尾落在数组上。");
  cursor[last] = value;
}

export type AppliedParameterEdit = AgentParameterEdit;

export type ParameterApplyOutcome = {
  applied: readonly AppliedParameterEdit[];
  rejected: readonly ParameterEditProblem[];
  runtimeJson: string;
  topologyJson: string;
  /**
   * True when at least one edit only reaches the backend on the `custom_inputs`
   * channel. The caller must then open the structured editors, because the
   * scalar `overrides` channel never carries requests, devices or topology.
   */
  requiresStructuredInput: boolean;
};

function toApplied(item: AgentParameterEdit): AppliedParameterEdit {
  return {
    path: item.path,
    label: item.label,
    target: item.target,
    fieldId: item.fieldId,
    previous: item.previous,
    next: item.next,
    value: item.value,
  };
}

/**
 * The collection sizes this editor can change, keyed by the address the
 * catalogue publishes for them.
 *
 * A size address must never reach `assignLeaf`: that would replace the array
 * with a number and silently destroy every element it held. Only the two
 * collections with a documented resize rule are listed here — a bare number
 * cannot express a new link, domain or module binding, because each of those
 * also has to name what the new element refers to.
 *
 * Shrinking the device list is refused while anything still points at the
 * devices that would go: the panel's own count control deletes those links and
 * domain members, and reports that it did, but an edit the user never saw is
 * not a clean-up this path gets to perform.
 */
const COLLECTION_RESIZERS: Record<string, (document: JsonObject, count: number) => void> = {
  "topology/devices": (document, count) => {
    const existing = deviceIdsOf(document);
    if (count < existing.length) {
      const blocking = existing
        .slice(count)
        .map((deviceId) => ({ deviceId, references: deviceReferences(document, deviceId) }))
        .filter((entry) => entry.references.domains.length || entry.references.links.length);
      if (blocking.length) {
        const detail = blocking
          .map((entry) => {
            const parts: string[] = [];
            if (entry.references.domains.length) parts.push(`域 ${entry.references.domains.join("、")}`);
            if (entry.references.links.length) parts.push(`${entry.references.links.length} 条连线`);
            return `${entry.deviceId}（${parts.join("、")}）`;
          })
          .join("；");
        throw new StructuredInputError(`减少卡数会删掉 ${detail} 正在引用的设备，请在面板里改，那里会一并清理引用。`);
      }
    }
    setDeviceCount(document, count);
  },
  "runtime_trace/requests": (document, count) => {
    setRequestCount(document, count);
  },
};

/**
 * Writes the plan into the two documents. Knob (`control`) and top-level
 * (`form`) items are returned for the caller to write into its own form state;
 * this function never touches reactive state it does not own.
 *
 * It accepts the contract shape rather than the richer plan item, because the
 * page receiving edits over the command channel only ever sees the former.
 */
export function applyParameterEdits(options: {
  items: readonly AgentParameterEdit[];
  runtimeJson: string;
  topologyJson: string;
}): ParameterApplyOutcome {
  const applied: AppliedParameterEdit[] = [];
  const rejected: ParameterEditProblem[] = [];
  let runtimeJson = options.runtimeJson;
  let topologyJson = options.topologyJson;
  let requiresStructuredInput = false;

  const documentItems = options.items.filter((item) => item.target === "runtime_trace" || item.target === "topology");
  const stateItems = options.items.filter((item) => item.target === "control" || item.target === "form");

  stateItems.forEach((item) => {
    applied.push(toApplied(item));
  });

  documentItems.forEach((item) => {
    const root = payloadRootOf(item.target);
    const segments = segmentsOf(item.path);
    // The address must name the document it claims to write to. These items
    // cross the agent-command boundary, so a path arriving from elsewhere is
    // not trusted to be shaped like one this catalogue produced: writing a
    // mis-shaped path would silently create a stray key instead of failing.
    if (!root || !segments || segments[0] !== item.target) {
      rejected.push({ raw: item.path, reason: "路径格式无法解析。" });
      return;
    }
    const label = item.target === "runtime_trace" ? "Runtime trace" : "Fabric topology";
    const source = item.target === "runtime_trace" ? runtimeJson : topologyJson;
    const resize = COLLECTION_RESIZERS[item.path];
    if (resize) {
      if (typeof item.value !== "number" || !Number.isInteger(item.value)) {
        rejected.push({ raw: item.path, reason: `「${item.path}」需要元素个数，请写整数。` });
        return;
      }
      const count = item.value;
      try {
        const resized = patchJsonDocument(source, label, (draft) => {
          resize(draft, count);
        });
        if (item.target === "runtime_trace") runtimeJson = resized;
        else topologyJson = resized;
        requiresStructuredInput = true;
        applied.push(toApplied(item));
      } catch (error) {
        rejected.push({ raw: item.path, reason: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    try {
      const patched = patchJsonDocument(source, label, (draft) => {
        assignLeaf(draft as Record<string, unknown>, [...root, ...segments.slice(1)], item.value);
      });
      if (item.target === "runtime_trace") runtimeJson = patched;
      else topologyJson = patched;
      requiresStructuredInput = true;
      applied.push(toApplied(item));
    } catch (error) {
      rejected.push({ raw: item.path, reason: error instanceof Error ? error.message : String(error) });
    }
  });

  return { applied, rejected, runtimeJson, topologyJson, requiresStructuredInput };
}
