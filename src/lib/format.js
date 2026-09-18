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

function formatScaledInteger(value, scale, unit) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  let whole = absolute / scale;
  let hundredths = ((absolute % scale) * 100n + scale / 2n) / scale;
  if (hundredths === 100n) {
    whole += 1n;
    hundredths = 0n;
  }
  const fraction = hundredths.toString().padStart(2, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString(currentLocale())}${fraction ? `.${fraction}` : ""} ${unit}`;
}

export function formatPicoseconds(value) {
  let integer;
  try {
    if (typeof value === "bigint") integer = value;
    else if (typeof value === "string" && /^-?\d+$/.test(value)) integer = BigInt(value);
    else if (typeof value === "number" && Number.isSafeInteger(value)) integer = BigInt(value);
  } catch {
    integer = undefined;
  }
  if (integer === undefined) return "—";
  const absolute = integer < 0n ? -integer : integer;
  if (absolute >= 1_000_000_000_000n) return formatScaledInteger(integer, 1_000_000_000_000n, "s");
  if (absolute >= 1_000_000_000n) return formatScaledInteger(integer, 1_000_000_000n, "ms");
  if (absolute >= 1_000_000n) return formatScaledInteger(integer, 1_000_000n, "µs");
  if (absolute >= 1_000n) return formatScaledInteger(integer, 1_000n, "ns");
  return `${integer.toLocaleString(currentLocale())} ps`;
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
    synthetic_trace: "合成数据",
    real_trace: "真实采集数据",
    compatibility_harness_trace: "兼容测试数据",
    uncalibrated: "未校准",
    exploratory: "探索性结论",
    covered: "已覆盖",
    analytical: "估算（Analytical）",
    des: "离散事件模拟（DES）",
    cycle: "周期级模拟（Cycle）",
    queue_delay: "排队等待",
    congestion_delay: "拥塞等待",
    runtime: "实际执行",
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
