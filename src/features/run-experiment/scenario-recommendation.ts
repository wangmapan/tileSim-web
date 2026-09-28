/**
 * Turns one sentence about a scenario into a reviewable set of parameter edits.
 *
 * The pipeline stays deterministic, and deliberately reuses the same planner the
 * explicit `参数路径 = 值` input goes through — a recommendation is therefore
 * validated, range-checked and reported exactly like something the user typed:
 *
 *   1. the sentence's own assignments are planned first, so a user who writes
 *      `最大 batch = 32` gets that value and not the preset's;
 *   2. a built-in profile is matched by keyword (see `scenario-profiles.ts`);
 *   3. every preset setting is resolved against the *live* catalogue — a key the
 *      page does not expose is reported as skipped, never invented;
 *   4. the two are merged, preset first, and the result is a plan that writes
 *      nothing until the user presses 应用到面板.
 *
 * A profile key is resolved to the address that needs no channel move
 * (`control` before `runtime_trace`), because the alternative would make a
 * one-click recommendation silently switch the submission channel.
 */
import { assignmentSegments, planParameterEdits, type ParameterEditPlan } from "./parameter-edit";
import { projectCollectionEntries, type ParameterCatalogEntry, type ParameterTarget } from "./parameter-catalog";
import { matchScenarioProfiles, looksInterrogative, type ScenarioProfile } from "./scenario-profiles";

/**
 * Which surface wins when a key exists more than once. The knob comes first on
 * purpose: knobs travel on the scalar `overrides` channel, so a recommendation
 * built from them can be applied without moving the submission off `controls`.
 */
const TARGET_PREFERENCE: readonly ParameterTarget[] = ["control", "form", "runtime_trace", "topology"];

const EMPTY_PLAN: ParameterEditPlan = { items: [], rejected: [], unknown: [] };

export type ScenarioRecommendation = {
  /** The matched profile, or null when the sentence described none. */
  profile: ScenarioProfile | null;
  /**
   * Non-empty when several profiles scored the same. The caller must ask which
   * one instead of picking: a wrong guess would write wrong values.
   */
  tie: readonly ScenarioProfile[];
  /** Heading for the plan, empty when no profile matched. */
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

/** The instruction with the parts that carry their own assignment removed. */
function proseOf(instruction: string, segments: readonly string[]): string {
  let text = instruction;
  segments.forEach((segment) => {
    const index = text.indexOf(segment);
    if (index >= 0) text = `${text.slice(0, index)} ${text.slice(index + segment.length)}`;
  });
  return text;
}

/**
 * True when the text names a parameter in full.
 *
 * A scenario has to be described, not named by a field: `把长上下文阈值改成 16384`
 * mentions the label `长上下文阈值`, so reading the shared word `长上下文` as a
 * scenario would add three knobs nobody asked for. The names checked are the ones
 * the panel shows (`最大 batch`) and the keys the documents use
 * (`max_batch_size`), and only ever in the prose — a name inside an assignment
 * (`最大 batch = 32`) is that assignment, not a field mention.
 */
function namesField(text: string, catalog: readonly ParameterCatalogEntry[]): boolean {
  const normalized = normalize(text);
  return catalog.some((entry) => {
    const label = normalize(entry.label);
    if (label.length > 2 && normalized.includes(label)) return true;
    const key = normalize(parameterKeyOf(entry.path));
    return key.length > 2 && normalized.includes(key);
  });
}

function composeRationale(profile: ScenarioProfile, skipped: readonly string[], overridden: readonly string[]): string {
  const parts = [profile.rationale];
  if (overridden.length) {
    parts.push(`你自己写的 ${overridden.join("、")} 覆盖了预设值。`);
  }
  if (skipped.length) {
    parts.push(`预设里的 ${skipped.join("、")} 在当前页面找不到，已跳过。`);
  }
  return parts.join("");
}

/**
 * Plans one sentence. Never throws: an unusable sentence comes back as a plan
 * whose `unknown`/`rejected` say what could not be understood, and no profile.
 */
export function recommendScenarioPlan(
  instruction: string,
  catalog: readonly ParameterCatalogEntry[],
): ScenarioRecommendation {
  const segments = assignmentSegments(instruction);
  // A scenario has to be described in prose. A sentence whose only words are a
  // field name and its value is a field request, so it is planned as one.
  const prose = segments.length ? proseOf(instruction, segments) : instruction;
  const { matched } = matchScenarioProfiles(prose);
  const profile = matched.length === 1 && !namesField(prose, catalog) ? matched[0] : null;
  if (!profile) {
    return {
      profile: null,
      tie: matched.length > 1 ? matched : [],
      title: "",
      rationale: "",
      plan: planParameterEdits(instruction, catalog),
      skipped: [],
      overridden: [],
    };
  }

  // Only the parts carrying their own assignment are planned as the user's
  // values; otherwise "高吞吐场景" itself would come back as an unusable line.
  const explicit = planParameterEdits(segments.join("\n"), catalog);
  const taken = new Map(explicit.items.map((item) => [item.path, item.raw]));
  const lines: string[] = [];
  const skipped: string[] = [];
  const overridden: string[] = [];

  profile.settings.forEach((setting) => {
    const path = resolveCatalogPath(setting.key, catalog);
    if (!path) {
      skipped.push(setting.key);
      return;
    }
    const explicitName = taken.get(path);
    if (explicitName !== undefined) {
      overridden.push(explicitName);
      return;
    }
    lines.push(`${path} = ${setting.value}`);
  });

  const preset = lines.length ? planParameterEdits(lines.join("\n"), catalog) : EMPTY_PLAN;
  return {
    profile,
    tie: [],
    title: `推荐方案：${profile.title}`,
    rationale: composeRationale(profile, skipped, overridden),
    plan: {
      items: [...preset.items, ...explicit.items],
      rejected: [...preset.rejected, ...explicit.rejected],
      unknown: [...preset.unknown, ...explicit.unknown],
    },
    skipped,
    overridden,
  };
}

/** True when the sentence produced something worth showing as a plan. */
export function hasRecommendation(recommendation: ScenarioRecommendation): boolean {
  return recommendation.profile !== null || recommendation.plan.items.length > 0;
}

/**
 * The text to hand to an assistant model, or null when the sentence must stay on
 * the deterministic paths above.
 *
 * A sentence that carries its own `参数 = 值` is already answered exactly by those
 * paths, and sending it to a model would swap an exact answer for a guess, so it
 * never leaves the page.
 *
 * On the **first** turn a question and a sentence that names a parameter in full
 * stay local too: on a page nothing has been discussed yet, both are answered
 * precisely from the catalogue. Once the panel is already in a conversation
 * (`continuing`), the sentence is handed over whatever its shape - a follow-up
 * such as 「再激进一点」 or 「为什么是 4?」 only means something with the earlier
 * turns attached, and those turns are exactly what a model is given.
 */
export function modelScenarioInstruction(
  instruction: string,
  catalog: readonly ParameterCatalogEntry[],
  continuing = false,
): string | null {
  const text = instruction.trim();
  if (!text) return null;
  if (assignmentSegments(text).length) return null;
  if (continuing) return text;
  if (looksInterrogative(text)) return null;
  if (namesField(text, catalog)) return null;
  return text;
}

/** One proposed value with the model's own reason for it. */
export type ModelPlanInput = {
  title: string;
  rationale: string;
  settings: readonly { key: string; value: string; why: string }[];
  /**
   * What the Bridge refused out of the proposal. The panel does not offer these,
   * but it has to say that they existed: a plan silently shorter than the answer
   * above it reads as if the model never asked for them.
   */
  dropped?: readonly { key: string; reason: string }[];
};

/**
 * Turns a model proposal into the same reviewable plan a built-in profile yields.
 *
 * Nothing about the proposal is trusted: every key is resolved against the live
 * catalogue (an unresolvable one is reported as skipped, never invented) and every
 * value goes through the planner the typed input uses, so range, enum and surface
 * rules are enforced identically. The per-value `why` is carried along so the panel
 * can show the reason next to the value it explains. Returns null when nothing
 * could be resolved, which sends the caller back to its local answer.
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
