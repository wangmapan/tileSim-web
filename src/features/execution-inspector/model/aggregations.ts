import type { ExecutionStage, FidelityResolution, ReportBundle, ReportSummary } from "../../../contracts/report-model";
import type { ExecutionFact, ExecutionRecord, ExecutionStat, LayerId } from "./types";

export function uniqueBy<T>(items: T[] | undefined, keyOf: (item: T) => string | undefined): T[] {
  const found = new Map<string, T>();
  for (const item of items || []) {
    const key = keyOf(item);
    if (key && !found.has(key)) found.set(key, item);
  }
  return [...found.values()];
}

export function groupBy<T>(items: T[] | undefined, keyOf: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items || []) {
    const key = keyOf(item);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function finiteValues<T extends object>(items: T[], key: keyof T): number[] {
  return items
    .map((item) => item[key])
    .filter((value): value is T[keyof T] & number => typeof value === "number" && Number.isFinite(value));
}

export function sum<T extends object>(items: T[], key: keyof T): number {
  return finiteValues(items, key).reduce((total, value) => total + value, 0);
}

export function max<T extends object>(items: T[], key: keyof T): number | null {
  const values = finiteValues(items, key);
  return values.length ? Math.max(...values) : null;
}

export function list<T extends object>(items: T[], key: keyof T): string {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].join("、") || "—";
}

export function stat(label: string, value: unknown, unit = "", hint = ""): ExecutionStat {
  return { label, value, unit, hint };
}

export function fact(label: string, value: unknown, unit = ""): ExecutionFact {
  return { label, value, unit };
}

export function resolutionMap(bundle: ReportBundle): Map<string, FidelityResolution> {
  const entries = bundle?.validation?.resolution_entries || bundle?.metrics?.resolution_entries || [];
  return new Map(entries.map((entry) => [entry.subsystem, entry]));
}

export function matchingStage(stages: ExecutionStage[], subsystem: LayerId): ExecutionStage | undefined {
  return stages.find(
    (stage) =>
      stage.subsystem === subsystem ||
      String(stage.subsystem || "")
        .split("/")
        .includes(subsystem),
  );
}

export function matchingSubsystem(value: unknown, subsystem: LayerId): boolean {
  return String(value || "")
    .split("/")
    .includes(subsystem);
}

export function evidenceState(
  id: LayerId,
  resolution: FidelityResolution | null,
  records: ExecutionRecord[],
  runSummary: ReportSummary,
): string {
  if (resolution?.expected_absence || resolution?.resolution === "expected_absence") return "expected_absence";
  if (resolution?.not_covered || resolution?.resolution === "not_covered") return "not_covered";
  if (id === "S1" && Number.isFinite(runSummary.runtime_event_count)) return "reported";
  if (id === "S2") return resolution ? "declaration_only" : "missing";
  if (records.length) return "reported";
  if (id === "S6" && Number.isFinite(runSummary.fabric_record_count)) return "reported";
  return resolution ? "declaration_only" : "missing";
}

export function sourceFor(id: LayerId): string {
  const sources: Record<LayerId, string> = {
    S0: "validation.trace_provenance + resolution_entries",
    S1: "input-runtime-trace + run.summary + metrics.request_metrics",
    S2: "resolution_entries + multi_granularity_profile",
    S3: "metrics.system_summary.phase_fabric_contributions[*].memory_*",
    S4: "metrics.system_summary.phase_fabric_contributions[*].device_*",
    S5: "metrics.resource_convergence + phase_fabric_contributions[*].collective_id",
    S6: "metrics.system_summary + request_fabric_contributions",
  };
  return sources[id];
}
