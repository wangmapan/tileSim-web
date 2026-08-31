import type {
  CompatibilityResult,
  EvidenceSummary,
  ReportBundle,
  ReportByKind,
  ReportKind,
} from "../contracts/report-model";
import { t } from "../i18n";
import { adaptReport, reportCompatibility } from "../adapters/report-registry";

export { reportCompatibility, reportSchemaIdentity } from "../adapters/report-registry";

const coreReportKinds: ReportKind[] = ["run", "metrics", "validation", "tail"];
export const reportKinds: ReportKind[] = [
  ...coreReportKinds,
  "design_space",
  "execution_envelope",
  "run_bound_des_evidence",
];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(report: JsonRecord, key: string): string {
  return typeof report[key] === "string" ? report[key] : "";
}

function emptyBundle(): ReportBundle {
  return {
    run: null,
    metrics: null,
    validation: null,
    tail: null,
    design_space: null,
    execution_envelope: null,
    run_bound_des_evidence: null,
    unsupported: {},
    compatibility: {},
  };
}

export function classifyReport(report: unknown): ReportKind {
  if (!isRecord(report)) throw new Error(t("报告根节点必须是 JSON 对象。"));
  if (report.schema_version === "tilesim.s7_run_bound_des_evidence.v1") return "run_bound_des_evidence";
  if (report.schema_version === "tilesim.design_space_report.v1") return "design_space";
  if (report.report_kind === "design_space_report" || report.design_space_lane) return "design_space";
  if (report.envelope_id || (report.host_path && Array.isArray(report.stages))) return "execution_envelope";
  const reportId = stringField(report, "report_id");
  if (report.request_metrics || report.metric_lane || reportId.endsWith("-metrics")) return "metrics";
  if (report.checks || report.validation_lane || reportId.endsWith("-validation")) return "validation";
  if (report.attribution_ranking || report.cause_chain || reportId.includes("tail-cause")) return "tail";
  if (report.summary || report.report_kind === "wind_tunnel_run_result") return "run";
  throw new Error(
    t("无法识别该 JSON；请选择 TileSim 的 run、metrics、validation、tail、design-space 或 execution-envelope report。"),
  );
}

export function traceIdentity(report: unknown): string {
  if (!isRecord(report)) return "";
  if (typeof report.trace_name === "string") return report.trace_name;
  return isRecord(report.summary) && typeof report.summary.trace_name === "string" ? report.summary.trace_name : "";
}

function assignReport<K extends ReportKind>(bundle: ReportBundle, kind: K, report: ReportByKind[K]): void {
  // Computed assignment is centralized because TypeScript cannot correlate this key with ReportByKind.
  (bundle as unknown as Record<ReportKind, ReportByKind[ReportKind] | null>)[kind] = report;
}

function adaptIntoBundle(bundle: ReportBundle, kind: ReportKind, report: unknown): void {
  const adapted = adaptReport(kind, report);
  bundle.compatibility[kind] = adapted.compatibility;
  if (adapted.report) assignReport(bundle, kind, adapted.report);
  else bundle.unsupported[kind] = adapted.raw;
}

export function bundleReports(reports: unknown[]): ReportBundle {
  const bundle = emptyBundle();
  const identities = new Set<string>();
  for (const report of reports) {
    const kind = classifyReport(report);
    if (bundle[kind] || bundle.unsupported[kind]) throw new Error(t("重复导入了 {kind} 报告。", { kind }));
    adaptIntoBundle(bundle, kind, report);
    const identity = traceIdentity(report);
    if (identity) identities.add(identity);
  }
  if (identities.size > 1)
    throw new Error(
      t("所选报告来自不同 Trace：{identities}。请勿混合展示。", { identities: [...identities].join(", ") }),
    );
  return bundle;
}

export function normalizeApiReports(reports: unknown = {}): ReportBundle {
  const bundle = emptyBundle();
  const source = isRecord(reports) ? reports : {};
  for (const kind of reportKinds) {
    const report = source[kind];
    if (report !== undefined && report !== null) adaptIntoBundle(bundle, kind, report);
  }
  return bundle;
}

export function bundleIdentity(bundle: ReportBundle): string {
  for (const kind of reportKinds) {
    const identity = traceIdentity(bundle[kind] || bundle.unsupported[kind]);
    if (identity) return identity;
  }
  return t("未命名报告");
}

export interface UnsupportedSchemaReport extends CompatibilityResult {
  kind: ReportKind;
  report: JsonRecord;
}

export function unsupportedSchemaReports(bundle: ReportBundle): UnsupportedSchemaReport[] {
  return Object.entries(bundle.unsupported).map(([kind, report]) => ({
    kind: kind as ReportKind,
    report: report || {},
    ...(bundle.compatibility[kind as ReportKind] || reportCompatibility(kind as ReportKind, report)),
  }));
}

export function evidenceSummary(bundle: ReportBundle): EvidenceSummary {
  const validation = bundle.validation;
  const metrics = bundle.metrics;
  const designSpace = bundle.design_space;
  const provenance = validation?.trace_provenance;
  return {
    sourceMode: provenance?.source_mode || designSpace?.candidate_source_mode || "unknown",
    calibration: provenance?.calibration_level || designSpace?.candidate_calibration_level || "unknown",
    claimScope: provenance?.allowed_claim_scope || designSpace?.candidate_allowed_claim_scope || "unknown",
    lane: validation?.validation_lane || metrics?.metric_lane || designSpace?.validation_lane || "report_import",
    tier: metrics?.evidence_tier || validation?.evidence_tier || designSpace?.evidence_tier || "unknown",
  };
}

export function isCompleteBundle(bundle: ReportBundle): boolean {
  return coreReportKinds.every((kind) => Boolean(bundle[kind]));
}
