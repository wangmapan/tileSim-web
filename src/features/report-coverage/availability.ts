import type { Availability } from "../../contracts/report-model";
import { t } from "../../i18n";

export type AvailabilityTone = "positive" | "neutral" | "warning" | "danger";

/**
 * The five display states defined by `src/adapters/dashboard-view-model.ts:3-13`.
 * They must stay mutually distinguishable in copy and tone: a state is never
 * collapsed into a shared "—" or "not applicable" placeholder.
 */
export const availabilityStates: readonly Availability[] = [
  "available",
  "expected_absence",
  "not_covered",
  "missing",
  "unsupported_schema",
];

const availabilityLabels: Record<Availability, string> = {
  available: "报告已提供",
  expected_absence: "预期缺省",
  not_covered: "未覆盖",
  missing: "缺失",
  unsupported_schema: "不支持的 Schema",
};

const availabilityDescriptions: Record<Availability, string> = {
  available: "后端报告提供了该字段；前端只做显示、来源标注与显示级换算。",
  expected_absence: "后端未写出该字段，且该环节按请求边界属于预期缺省，不是采集失败。",
  not_covered: "请求的仿真范围不覆盖该字段，报告不会给出对应数值。",
  missing: "报告未提供该字段；前端不会推算、补造或用其它总量代替。",
  unsupported_schema: "报告版本尚未适配，该字段未解析；原始 JSON 仍完整保留。",
};

const availabilityTones: Record<Availability, AvailabilityTone> = {
  available: "positive",
  expected_absence: "neutral",
  not_covered: "neutral",
  missing: "warning",
  unsupported_schema: "danger",
};

export function availabilityLabel(availability: Availability): string {
  return t(availabilityLabels[availability]);
}

export function availabilityDescription(availability: Availability): string {
  return t(availabilityDescriptions[availability]);
}

export function availabilityTone(availability: Availability): AvailabilityTone {
  return availabilityTones[availability];
}

/**
 * Resolve the display state for a plain scalar that is missing from the bundle.
 * Values that are present (including `0`, `false` and `[]`) stay `available`.
 */
export function availabilityFor(value: unknown, resolveMissing: () => Availability): Availability {
  return value === undefined || value === null ? resolveMissing() : "available";
}

/**
 * Resolve the display state of a value whose rendering site carries no further backend scope
 * (no report kind, subsystem, resolution entry or compatibility block). Present values — including
 * `0`, `false`, `[]` and reported strings — stay `available`; an absent value is reported as
 * `missing` and never guessed into `not_covered` / `expected_absence` / `unsupported_schema`.
 * Shared by the screen record table and its HTML export so both print the same label and tone.
 */
export function availabilityOfValue(value: unknown): Availability {
  return availabilityFor(value, () => "missing");
}
