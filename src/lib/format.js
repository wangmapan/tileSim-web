import { currentLocale, t } from "../i18n";

export function formatNumber(value, digits = 2) {
  if (typeof value === "bigint") return value.toLocaleString(currentLocale());
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value).toLocaleString(currentLocale());
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(currentLocale(), { maximumFractionDigits: digits });
}

export function formatPercent(value, digits = 0) {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value * 100, digits)}%` : "—";
}

export function formatDate(value) {
  if (!value) return t("时间未知");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("时间未知") : date.toLocaleString(currentLocale(), { hour12: false });
}

export function shortId(value, length = 10) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function statusLabel(value) {
  const labels = {
    completed: "已完成",
    running: "运行中",
    failed: "失败",
    incomplete: "不完整",
    partial: "部分完成",
    complete: "完整",
    missing: "缺失",
    pass: "通过",
    fail: "失败",
    expected_absence: "预期缺省",
    reported: "有报告记录",
    declaration_only: "仅解析声明",
    matched: "已匹配",
    synthetic_consistency: "合成一致性",
    synthetic_consistency_with_resource_convergence: "合成一致性 · 含资源汇合",
    synthetic_trace: "合成 Trace",
    real_trace: "真实 Trace",
    compatibility_harness_trace: "兼容夹具 Trace",
    uncalibrated: "未校准",
    exploratory: "探索性结论",
    covered: "已覆盖",
    analytical: "Analytical",
    des: "DES",
    cycle: "Cycle",
    unknown: "未知",
  };
  return labels[value] ? t(labels[value]) : String(value || t("未知")).replaceAll("_", " ");
}

export function statusTone(value) {
  if (["completed", "complete", "pass", "real_trace", "covered", "reported", "matched"].includes(value))
    return "positive";
  if (["failed", "fail", "not_covered"].includes(value)) return "danger";
  if (["running", "partial", "missing", "synthetic_trace", "synthetic_consistency", "uncalibrated"].includes(value))
    return "warning";
  return "neutral";
}
