const reportKinds = ["run", "metrics", "validation", "tail"];

export function classifyReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error("报告根节点必须是 JSON 对象。");
  if (report.request_metrics || report.metric_lane || String(report.report_id || "").endsWith("-metrics"))
    return "metrics";
  if (report.checks || report.validation_lane || String(report.report_id || "").endsWith("-validation"))
    return "validation";
  if (report.attribution_ranking || report.cause_chain || String(report.report_id || "").includes("tail-cause"))
    return "tail";
  if (report.summary || report.report_kind === "wind_tunnel_run_result") return "run";
  throw new Error("无法识别该 JSON；请选择 TileSim 的 run、metrics、validation 或 tail report。");
}

export function traceIdentity(report) {
  return report?.trace_name || report?.summary?.trace_name || "";
}

export function bundleReports(reports) {
  const bundle = { run: null, metrics: null, validation: null, tail: null };
  const identities = new Set();
  for (const report of reports) {
    const kind = classifyReport(report);
    if (bundle[kind]) throw new Error(`重复导入了 ${kind} 报告。`);
    bundle[kind] = report;
    const identity = traceIdentity(report);
    if (identity) identities.add(identity);
  }
  if (identities.size > 1) throw new Error(`所选报告来自不同 Trace：${[...identities].join("、")}。请勿混合展示。`);
  return bundle;
}

export function normalizeApiReports(reports = {}) {
  const bundle = {};
  for (const kind of reportKinds) bundle[kind] = reports[kind] || null;
  return bundle;
}

export function bundleIdentity(bundle) {
  for (const kind of reportKinds) {
    const identity = traceIdentity(bundle?.[kind]);
    if (identity) return identity;
  }
  return "未命名报告";
}

export function evidenceSummary(bundle) {
  const validation = bundle?.validation || {};
  const metrics = bundle?.metrics || {};
  const provenance = validation.trace_provenance || {};
  return {
    sourceMode: provenance.source_mode || "unknown",
    calibration: provenance.calibration_level || "unknown",
    claimScope: provenance.allowed_claim_scope || "unknown",
    lane: validation.validation_lane || metrics.metric_lane || "report_import",
    tier: metrics.evidence_tier || validation.evidence_tier || "unknown",
  };
}

export function isCompleteBundle(bundle) {
  return reportKinds.every((kind) => Boolean(bundle?.[kind]));
}
