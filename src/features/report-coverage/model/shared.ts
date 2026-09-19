import { unavailable } from "../../../adapters/dashboard-view-model";
import type { ReportBundle, ReportKind } from "../../../contracts/report-model";
import { t } from "../../../i18n";
import { formatNumber, formatPercent, formatPicoseconds } from "../../../lib/format";
import { availabilityDescription, availabilityFor } from "../availability";
import type {
  CoverageCell,
  CoverageColumn,
  CoverageField,
  CoverageGroup,
  CoverageList,
  CoverageRecord,
} from "../types";

export type Formatter = (value: unknown) => string;

export interface Scope {
  bundle: ReportBundle;
  kind: ReportKind;
  /** Subsystems used by `unavailable()` to pick expected_absence / not_covered. */
  subsystems: string[];
}

/** Display-level unit conversion; the raw integer field is always shown next to it. */
export function withUnit(value: unknown, unit: string): string {
  if (typeof value === "bigint") return `${formatNumber(value)} ${unit}`;
  if (typeof value === "number") return Number.isFinite(value) ? `${formatNumber(value)} ${unit}` : String(value);
  if (typeof value === "string") return /^-?\d+$/.test(value) ? `${formatNumber(value)} ${unit}` : value;
  return String(value);
}

/** Identity conversion: keeps reported strings, distinguishes an explicitly empty one. */
export function text(value: unknown): string {
  if (typeof value === "string") return value === "" ? t("（报告为空字符串）") : value;
  if (typeof value === "boolean") return value ? t("是") : t("否");
  if (value === null || value === undefined) return t("（未写出）");
  return String(value);
}

export function count(value: unknown): string {
  return formatNumber(value, 0);
}

export function bool(value: unknown): string {
  return value === true ? t("是") : value === false ? t("否") : text(value);
}

export function picoseconds(value: unknown): string {
  return formatPicoseconds(value);
}

export function microseconds(value: unknown): string {
  return withUnit(value, "µs");
}

/** Lossless byte counts: the raw 64-bit integer is preserved. */
export function bytes(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (typeof value === "string" && !/^-?\d+$/.test(value)) return value;
  return `${formatNumber(value, 0)} B`;
}

export function ratio(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? formatPercent(value, 2) : String(value);
}

export function numberText(value: unknown): string {
  return typeof value === "number" && !Number.isFinite(value) ? String(value) : formatNumber(value, 4);
}

export function listText(value: unknown): string {
  if (!Array.isArray(value)) return text(value);
  if (value.length === 0) return t("（空列表）");
  return value.map((item) => text(item)).join("、");
}

/** Structured SubjectRef / EvidenceRef arrays rendered as `kind:id`. */
export function referenceText(value: unknown): string {
  if (!Array.isArray(value)) return text(value);
  if (value.length === 0) return t("（空列表）");
  return value.map(referenceEntryText).join("、");
}

function referenceEntryText(item: unknown): string {
  if (item && typeof item === "object") {
    const ref = item as Record<string, unknown>;
    // SubjectRef: `{ kind, id }` -> `request:req-a`
    if ("kind" in ref && "id" in ref) return `${String(ref.kind)}:${String(ref.id)}`;
    // Artifact pointer (same convention as ArtifactEvidenceLink sources):
    // `{ artifact_id, json_pointer }` -> `metrics:/request_metrics/0`
    if (typeof ref.artifact_id === "string") {
      return `${ref.artifact_id}:${typeof ref.json_pointer === "string" ? ref.json_pointer : ""}`;
    }
    if (typeof ref.source_path === "string") return ref.source_path;
  }
  return text(item);
}

export function jsonText(value: unknown): string {
  if (value === undefined || value === null) return t("（未写出）");
  try {
    return JSON.stringify(value);
  } catch {
    return text(value);
  }
}

export function field(
  scope: Scope,
  key: string,
  value: unknown,
  path: string | string[],
  format: Formatter = text,
  extra: Partial<CoverageField> = {},
): CoverageField {
  const present = value !== undefined && value !== null;
  return {
    key,
    label: key,
    text: present ? format(value) : null,
    sourcePaths: Array.isArray(path) ? path : [path],
    availability: availabilityFor(value, () => unavailable(scope.bundle, scope.kind, scope.subsystems)),
    ...extra,
  };
}

export function cell(
  scope: Scope,
  key: string,
  value: unknown,
  format: Formatter = text,
  extra: Partial<CoverageCell> = {},
): CoverageCell {
  const present = value !== undefined && value !== null;
  return {
    key,
    label: key,
    text: present ? format(value) : null,
    // Row cells resolve absence through the same parser as `field()`: an unadapted report version
    // (`unsupported_schema`) or a `not_covered` / `expected_absence` resolution must never be
    // demoted to a bare "missing" cell. Present values (including 0, false and []) stay available.
    availability: availabilityFor(value, () => unavailable(scope.bundle, scope.kind, scope.subsystems)),
    ...extra,
  };
}

export interface ListOptions {
  description?: string;
  /** Copy used when the backend reported the array but it has no entries. */
  emptyEntryNote?: string;
}

export function buildList(
  scope: Scope,
  key: string,
  title: string,
  values: readonly unknown[] | undefined,
  sourcePath: string,
  columns: CoverageColumn[],
  toRecord: (item: unknown, index: number) => CoverageRecord,
  options: ListOptions = {},
): CoverageList {
  const availability = availabilityFor(values, () => unavailable(scope.bundle, scope.kind, scope.subsystems));
  const present = Array.isArray(values);
  return {
    key,
    title,
    description: options.description,
    columns,
    records: present ? values.map((item, index) => toRecord(item, index)) : [],
    sourcePaths: [sourcePath],
    availability,
    emptyNote: present
      ? (options.emptyEntryNote ?? t("报告提供了该列表，但条目数为 0。"))
      : availabilityDescription(availability),
  };
}

/** Convenience wrapper: a single-column list of backend strings. */
export function stringList(
  scope: Scope,
  key: string,
  values: readonly unknown[] | undefined,
  sourcePath: string,
  options: ListOptions = {},
): CoverageList {
  return buildList(
    scope,
    key,
    key,
    values,
    sourcePath,
    [{ key: "value", label: "value" }],
    (item, index) => ({ key: `${key}-${index}`, cells: [cell(scope, "value", item)] }),
    options,
  );
}

export function record(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

export function groupAvailability(fields: CoverageField[], lists: CoverageList[]): CoverageGroup["availability"] {
  const states = [...fields.map((item) => item.availability), ...lists.map((item) => item.availability)];
  if (states.includes("available")) return "available";
  for (const state of ["unsupported_schema", "not_covered", "expected_absence", "missing"] as const) {
    if (states.includes(state)) return state;
  }
  return "missing";
}

export function group(
  key: string,
  title: string,
  fields: CoverageField[],
  lists: CoverageList[] = [],
  description?: string,
): CoverageGroup {
  return { key, title, description, availability: groupAvailability(fields, lists), fields, lists };
}
