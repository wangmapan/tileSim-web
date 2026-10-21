/** Resolve and validate proposals returned by the assistant model.
 *
 * There is intentionally no scenario keyword table or local natural-language
 * planner here. The model chooses a proposal; the browser only validates it
 * against the live catalogue and applies it atomically after user confirmation.
 */
import { planParameterEdits, validateAgentStructuredInputs, type ParameterEditPlan } from "./parameter-edit";
import { projectCollectionEntries, type ParameterCatalogEntry, type ParameterTarget } from "./parameter-catalog";
import type { AgentParameterStructuredInputs } from "../../entities/agent-command";

/** Which surface wins when a model key exists more than once. */
const TARGET_PREFERENCE: readonly ParameterTarget[] = ["control", "form", "runtime_trace", "topology"];

const EMPTY_PLAN: ParameterEditPlan = { items: [], rejected: [], unknown: [] };

export type ScenarioRecommendation = {
  profile: null;
  tie: readonly never[];
  title: string;
  /** Why these values, plus what the catalogue could not honour. */
  rationale: string;
  plan: ParameterEditPlan;
  /** Preset keys the current page's catalogue does not expose. */
  skipped: readonly string[];
  /** Paths where the user's own assignment replaced the preset value. */
  overridden: readonly string[];
  /**
   * Per-value reasons keyed by edit path. Only a model proposal carries them:
   * a built-in preset explains the set as a whole, one value at a time is worth
   * explaining because a model picked each value separately.
   */
  reasons?: Readonly<Record<string, string>>;
  /** Missing/refused model values make the proposed set unsafe to apply as a whole. */
  incomplete?: readonly string[];
  /** Non-blocking notices, such as a rejected optional JSON document beside a safe scalar plan. */
  warnings?: readonly string[];
  /** Complete synthetic JSON documents returned by the model, before page validation. */
  structuredInputs?: AgentParameterStructuredInputs;
};

/** Case- and spacing-insensitive, so `大 batch` and `大batch` are one name. */
function normalize(text: string): string {
  return text
    .replace(/^[\s\-*•·>]+/u, "")
    .replace(/[`"'「」“”]/gu, "")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

/** `topology/devices[1]/device_type` → `device_type`. */
export function parameterKeyOf(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1].replace(/\[\d+\]$/u, "");
}

/**
 * Resolves a bare catalogue key such as `max_batch_size` to one address.
 *
 * Unlike the editor's own resolution this never reports an ambiguity: a key that
 * exists both as a knob and as a policy field is not a mistake here, it is the
 * normal case, and the preference order above decides. A key the catalogue does
 * not carry at all returns null so the caller can report it as skipped.
 */
export function resolveCatalogPath(name: string, catalog: readonly ParameterCatalogEntry[]): string | null {
  const exact = catalog.find((entry) => entry.path === name);
  if (exact) return exact.path;
  const wanted = normalize(name);
  const candidates = catalog.filter((entry) => normalize(parameterKeyOf(entry.path)) === wanted);
  if (!candidates.length) return null;
  for (const target of TARGET_PREFERENCE) {
    const hit = candidates.find((entry) => entry.target === target);
    if (hit) return hit.path;
  }
  return candidates[0].path;
}

/** One proposed value with the model's own reason for it. */
export type ModelPlanInput = {
  title: string;
  rationale: string;
  settings: readonly { key: string; value: string; why: string }[];
  /** The user's visible request, used only to enforce explicit exclusions. */
  instruction?: string;
  /**
   * What the Bridge refused out of the proposal. The panel does not offer these,
   * but it has to say that they existed: a plan silently shorter than the answer
   * above it reads as if the model never asked for them.
   */
  dropped?: readonly { key: string; reason: string }[];
  structured_inputs?: { runtime_trace: unknown; topology: unknown };
};

/**
 * Read only an explicit request count from a user's sentence.
 *
 * This is intentionally narrower than a natural-language scenario planner:
 * the page can safely resize its existing request collection, but it cannot
 * infer a model, topology, scheduler or performance target from prose.  In
 * particular, "几个请求" has no number and therefore returns null.
 */
export function explicitRequestCount(instruction: string): number | null {
  const text = instruction.trim();
  if (!text) return null;
  const patterns = [
    /(?:请求(?:数|数量)?|requests?(?:\s*(?:count|number))?)\s*(?:从|由)\s*\d{1,5}\s*(?:改为|调整为|变为|到|至|->|→)\s*(\d{1,5})/iu,
    /(?:请求(?:数|数量)?|requests?(?:\s*(?:count|number))?)\s*(?:为|是|等于|=|:|：)?\s*(\d{1,5})/iu,
    /(?:^|[^\dA-Za-z_])\s*(\d{1,5})\s*(?:个|条)?\s*(?:并发\s*)?(?:请求|requests?)(?![A-Za-z])/iu,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    if (pattern === patterns[1] && /\bTP\s*$/iu.test(text.slice(0, match.index))) continue;
    const value = Number(match[1]);
    if (Number.isSafeInteger(value)) return value;
  }
  return null;
}

/**
 * Produce the smallest safe request-count plan when the model is unavailable
 * or answers only in prose.  Existing request rows are the only template: the
 * atomic writer appends/removes rows, keeps IDs unique, and preserves the
 * current request fields.  No model, topology, scheduling or metric value is
 * guessed here.
 */
export function buildDeterministicRequestCountRecommendation(
  instruction: string,
  catalog: readonly ParameterCatalogEntry[],
): ScenarioRecommendation | null {
  const count = explicitRequestCount(instruction);
  const entry = catalog.find((candidate) => candidate.path === "runtime_trace/requests" && candidate.kind === "count");
  // A request for complete JSON/topology needs the model/structured editor to
  // preserve and validate every cross-reference; a count-only fallback must
  // never make that larger request look satisfied.
  if (count === null || !entry || explicitlyRequestsStructuredInputs(instruction)) return null;

  const why = `按你明确指定的 ${count} 个请求调整集合规模；新增请求沿用当前页面模板，未推导其它仿真参数。`;
  const plan = planParameterEdits(`runtime_trace/requests = ${count}`, catalog);
  const incomplete = [
    ...plan.rejected.map((item) => `${item.raw}：${item.reason}`),
    ...plan.unknown.map((item) => `${item.raw}：${item.reason}`),
  ];
  return {
    profile: null,
    tie: [],
    title: `${count} 请求仿真方案（基础模板）`,
    rationale:
      `模型未返回可验证的完整方案，已按你明确给出的请求数量生成基础方案。${why}` +
      "模型、设备拓扑、调度策略、KV 容量和性能指标保持当前值；确认前不会写入面板。",
    plan,
    skipped: [],
    overridden: [],
    reasons: plan.items.length ? { [plan.items[0].path]: why } : {},
    incomplete,
    warnings: ["这是前端页面契约的安全兜底，不是模型推理结果；只处理明确数量，未替你猜测其它字段。"],
  };
}

function explicitlyExcludedPaths(instruction: string, catalog: readonly ParameterCatalogEntry[]): Set<string> {
  const excluded = new Set<string>();
  const clauses = instruction.match(/(?:不要|不许|禁止|无需)(?:再)?(?:修改|调整|设置|改动|配置)?[^。；\n]*/gu) || [];
  for (const clause of clauses) {
    const normalized = normalize(clause);
    for (const entry of catalog) {
      const names = [entry.path, entry.label, parameterKeyOf(entry.path)];
      if (names.some((name) => normalize(name).length >= 4 && normalized.includes(normalize(name)))) {
        excluded.add(entry.path);
      }
      if (/topology\/links/iu.test(normalized) && entry.path.startsWith("topology/links[")) excluded.add(entry.path);
      if (/topology\/domains/iu.test(normalized) && entry.path.startsWith("topology/domains["))
        excluded.add(entry.path);
      if (/设备数量|显卡数量/iu.test(normalized) && entry.path === "topology/devices") excluded.add(entry.path);
      if (/(?:^|[^a-z])tp(?:degree|[^a-z]|$)|张量并行/iu.test(normalized) && /\/tp_degree$/u.test(entry.path))
        excluded.add(entry.path);
    }
  }
  return excluded;
}

function explicitlyRequestsStructuredInputs(text: string): boolean {
  return /(?:structured[_ -]?inputs?|结构化(?:输入|JSON)?|自定义输入)/iu.test(text)
    ? true
    : /(?:完整|自定义).{0,12}(?:JSON|拓扑|互联|链路|links|domains|module[_ -]?bindings?)|(?:JSON|拓扑|互联|链路|links|domains|module[_ -]?bindings?).{0,12}(?:完整|配置|生成|修改|指定)/iu.test(
        text,
      );
}

/**
 * Turns a model proposal into the same reviewable plan as typed input.
 *
 * Nothing about the proposal is trusted: every key is resolved against the live
 * catalogue (an unresolvable one is reported as skipped, never invented) and every
 * value goes through the planner the typed input uses, so range, enum and surface
 * rules are enforced identically. The per-value `why` is carried along so the panel
 * can show the reason next to the value it explains. Returns null when nothing
 * could be resolved, which leaves the caller in its fail-closed state.
 */
export function modelScenarioRecommendation(
  payload: ModelPlanInput,
  catalog: readonly ParameterCatalogEntry[],
): ScenarioRecommendation | null {
  const lines: string[] = [];
  const proposed: Record<string, string> = {};
  const skipped: string[] = [];
  const projected = projectCollectionEntries(catalog, payload.settings);
  payload.settings.forEach((setting) => {
    const path = resolveCatalogPath(setting.key, projected);
    if (!path) {
      skipped.push(setting.key);
      return;
    }
    // One value per path: the first proposal for a path is the one offered.
    if (path in proposed) return;
    proposed[path] = setting.why;
    lines.push(`${path} = ${setting.value}`);
  });

  const structuredValidation = payload.structured_inputs
    ? validateAgentStructuredInputs(payload.structured_inputs)
    : null;
  const structuredInputs = structuredValidation?.ok ? structuredValidation.inputs : undefined;
  const plan = lines.length ? planParameterEdits(lines.join("\n"), catalog) : EMPTY_PLAN;
  if (!plan.items.length && !structuredInputs && !(structuredValidation && !structuredValidation.ok)) return null;

  // A proposed value can still be refused by the planner; dropping the reason of
  // any path that never reached the plan keeps the panel from explaining a value
  // it did not offer.
  const reasons: Record<string, string> = {};
  plan.items.forEach((item) => {
    const why = proposed[item.path];
    if (why) reasons[item.path] = why;
  });

  const parts = [payload.rationale.trim()];
  if (structuredInputs) {
    parts.push(
      "已生成完整 synthetic runtime_trace 与 topology JSON；应用前仍由页面按当前契约校验，连接关系仅代表仿真假设。 ",
    );
  }
  if (skipped.length) parts.push(`模型提到的 ${skipped.join("、")} 在当前页面找不到，已跳过。`);
  // `dropped` is what the Bridge refused before the page ever saw it, so an empty
  // list is the ordinary case and only a non-empty one is worth a sentence.
  const refused = payload.dropped?.length ?? 0;
  if (refused)
    parts.push(
      `模型另外提了 ${refused} 项，Bridge 未接受：${payload.dropped?.map((item) => `${item.key}（${item.reason}）`).join("、")}。`,
    );
  const structuredDrops = (payload.dropped ?? []).filter((item) => item.key === "structured_inputs");
  const scalarDrops = (payload.dropped ?? []).filter((item) => item.key !== "structured_inputs");
  // Only the user's request decides whether a complete JSON/topology was
  // required. Model prose often mentions topology while explaining a scalar
  // card-count plan; treating that explanation as an explicit requirement
  // would incorrectly block the safe scalar fallback.
  const requestText = payload.instruction || "";
  const structuredRequested = explicitlyRequestsStructuredInputs(requestText);
  const incomplete = [
    ...skipped.map((key) => `${key}：当前页面无此参数`),
    ...scalarDrops.map((item) => `${item.key}：${item.reason}`),
    ...plan.rejected.map((item) => `${item.raw}：${item.reason}`),
    ...plan.unknown.map((item) => `${item.raw}：${item.reason}`),
  ];
  const warnings: string[] = [];
  if (structuredDrops.length) {
    const reason = structuredDrops.map((item) => item.reason).join("；");
    const message = `structured_inputs 未被 Bridge 接受：${reason}`;
    if (structuredRequested) incomplete.push(message);
    else warnings.push(`${message}；当前设备数、请求 TP 和其它已验证标量仍可单独应用。`);
  }
  if (structuredValidation && !structuredValidation.ok) {
    const message = `structured_inputs：${structuredValidation.reason}`;
    if (structuredRequested) incomplete.push(message);
    else warnings.push(`${message} 当前标量改动仍可单独应用，完整 JSON 请在结构化输入页核对。`);
  }
  const excluded = explicitlyExcludedPaths(payload.instruction || "", projected);
  plan.items.forEach((item) => {
    if (excluded.has(item.path)) incomplete.push(`${item.path}：用户明确要求不要修改，此方案不能应用`);
  });
  const deviceCount = plan.items.find((item) => item.path === "topology/devices");
  const targetCount = deviceCount && typeof deviceCount.value === "number" ? deviceCount.value : null;
  const currentCount = Number(catalog.find((entry) => entry.path === "topology/devices")?.current);
  const describesNodes = /多节点|\d+\s*个?节点|multi.?node/iu.test(`${payload.title} ${payload.rationale}`);
  const assignsGroups = plan.items.some((item) => /^topology\/devices\[\d+\]\/group_id$/u.test(item.path));
  if (targetCount !== null && targetCount > currentCount && (describesNodes || assignsGroups)) {
    for (let index = 0; index < targetCount; index += 1) {
      const path = `topology/devices[${index}]/group_id`;
      const proposedGroup = plan.items.find((item) => item.path === path)?.next;
      const existingGroup = index < currentCount ? catalog.find((entry) => entry.path === path)?.current : null;
      if (!proposedGroup && !existingGroup) incomplete.push(`${path}：多节点方案缺少设备分组`);
    }
  }
  const tpClaim = /\bTP\s*[-:]?\s*(\d+)\b/iu.exec(`${payload.title} ${payload.rationale}`);
  if (tpClaim) {
    const path = "runtime_trace/requests[0]/tp_degree";
    const proposedTp = plan.items.find((item) => item.path === path)?.next;
    const existingTp = catalog.find((entry) => entry.path === path)?.current;
    if ((proposedTp ?? existingTp) !== tpClaim[1])
      incomplete.push(`${path}：方案声称 TP${tpClaim[1]}，但未配置对应并行度`);
  }
  // Any device-count change paired with TP edits must name every existing
  // request, and each TP must match the resulting inventory. Otherwise an
  // omitted request keeps its old parallelism and the page cannot safely choose
  // its participants. A count-only plan remains available for the structured
  // editor's explicit pairing prompt. This deliberately covers shrink, grow,
  // and arbitrary counts; the contract's maxItems is the only ceiling.
  if (targetCount !== null && targetCount !== currentCount) {
    const tpEdits = plan.items.filter((item) => /^runtime_trace\/requests\[\d+\]\/tp_degree$/u.test(item.path));
    if (tpEdits.length) {
      const requestCount = Number(catalog.find((entry) => entry.path === "runtime_trace/requests")?.current);
      const byIndex = new Map(tpEdits.map((item) => [Number(/\[(\d+)\]/u.exec(item.path)?.[1]), item.next]));
      for (let index = 0; index < requestCount; index += 1) {
        const path = `runtime_trace/requests[${index}]/tp_degree`;
        const proposed = byIndex.get(index);
        if (proposed === undefined) {
          incomplete.push(`${path}：调整到 ${targetCount} 张卡时必须同时明确每条现有请求的 TP`);
        } else if (proposed !== String(targetCount)) {
          incomplete.push(`${path}：必须与新的设备数 ${targetCount} 一致，不能保留为 ${proposed}`);
        }
      }
    }
  }
  if (
    targetCount !== null &&
    targetCount !== currentCount &&
    /完整.*(?:互联|拓扑)|(?:互联|拓扑).*完整/iu.test(`${payload.title} ${payload.rationale}`)
  ) {
    incomplete.push("topology/links、topology/domains：无法从设备分组推断连接关系，请在结构化输入核对后再运行");
  }
  return {
    profile: null,
    tie: [],
    title: payload.title.trim() || "模型推荐方案",
    rationale: parts.filter(Boolean).join(""),
    plan,
    skipped,
    overridden: [],
    reasons,
    incomplete,
    ...(warnings.length ? { warnings } : {}),
    ...(structuredInputs ? { structuredInputs } : {}),
  };
}
