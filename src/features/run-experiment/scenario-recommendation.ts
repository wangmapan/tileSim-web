/** Resolve and validate proposals returned by the assistant model.
 *
 * There is intentionally no scenario keyword table or local natural-language
 * planner here. The model chooses a proposal; the browser only validates it
 * against the live catalogue and applies it atomically after user confirmation.
 */
import { planParameterEdits, type ParameterEditPlan } from "./parameter-edit";
import { projectCollectionEntries, type ParameterCatalogEntry, type ParameterTarget } from "./parameter-catalog";

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
};

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

  const plan = lines.length ? planParameterEdits(lines.join("\n"), catalog) : EMPTY_PLAN;
  if (!plan.items.length) return null;

  // A proposed value can still be refused by the planner; dropping the reason of
  // any path that never reached the plan keeps the panel from explaining a value
  // it did not offer.
  const reasons: Record<string, string> = {};
  plan.items.forEach((item) => {
    const why = proposed[item.path];
    if (why) reasons[item.path] = why;
  });

  const parts = [payload.rationale.trim()];
  if (skipped.length) parts.push(`模型提到的 ${skipped.join("、")} 在当前页面找不到，已跳过。`);
  // `dropped` is what the Bridge refused before the page ever saw it, so an empty
  // list is the ordinary case and only a non-empty one is worth a sentence.
  const refused = payload.dropped?.length ?? 0;
  if (refused)
    parts.push(
      `模型另外提了 ${refused} 项，Bridge 未接受：${payload.dropped?.map((item) => `${item.key}（${item.reason}）`).join("、")}。`,
    );
  const incomplete = [
    ...skipped.map((key) => `${key}：当前页面无此参数`),
    ...(payload.dropped ?? []).map((item) => `${item.key}：${item.reason}`),
    ...plan.rejected.map((item) => `${item.raw}：${item.reason}`),
    ...plan.unknown.map((item) => `${item.raw}：${item.reason}`),
  ];
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
  if (
    targetCount !== null &&
    targetCount > currentCount &&
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
  };
}
