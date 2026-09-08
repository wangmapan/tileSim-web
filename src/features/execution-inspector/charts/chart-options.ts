import type { EChartsCoreOption } from "echarts/core";
import type { LayerVisualization } from "../model/types";
import { t } from "../../../i18n";

function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function formatAxisNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function compactAxisValue(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${formatAxisNumber(value / 1_000_000)}m`;
  if (absolute >= 1_000) return `${formatAxisNumber(value / 1_000)}k`;
  return formatAxisNumber(value);
}

function visibleRows(visualization: LayerVisualization) {
  return visualization.rows.slice(0, 12);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export function chartOption(visualization: LayerVisualization): EChartsCoreOption {
  const rows = visibleRows(visualization);
  const animationDuration = prefersReducedMotion() ? 0 : 260;
  const ink = cssColor("--ink", "#25302c");
  const muted = cssColor("--muted", "#66736d");
  const line = cssColor("--line-strong", "#cfd7d2");
  const split = cssColor("--line", "#e8ece9");
  const panel = cssColor("--panel-strong", "#ffffff");
  const fontFamily = cssColor("--font-sans", "system-ui, sans-serif");
  const palette = ["#3376a3", "#357868", "#a8732a", "#b35d4f", "#727e8b"].map((fallback, index) =>
    cssColor(`--chart-series-${index + 1}`, fallback),
  );
  const seriesColors = visualization.series.map((series, index) => series.color || palette[index % palette.length]);
  const axisLabel = { color: muted, fontSize: 12 };
  const axisLine = { lineStyle: { color: line } };
  const splitLine = { lineStyle: { color: split, type: "dashed" as const } };
  const common: EChartsCoreOption = {
    animation: !prefersReducedMotion(),
    animationDuration,
    animationDurationUpdate: animationDuration,
    // The chart host supplies a localized accessible name and the adjacent field table exposes
    // every plotted value. ECharts' generated SVG description serializes internal bar-layout
    // dimensions and can announce synthetic NaN values for stacked timelines.
    aria: { enabled: false },
    color: seriesColors.length ? seriesColors : palette,
    textStyle: { fontFamily, color: ink },
    tooltip: {
      trigger: visualization.kind === "scatter" ? "item" : "axis",
      confine: true,
      backgroundColor: panel,
      borderColor: line,
      borderWidth: 1,
      padding: [8, 10],
      extraCssText: "border-radius:4px;box-shadow:none;max-width:100%;white-space:normal;overflow-wrap:anywhere",
      textStyle: { color: ink, fontFamily, fontSize: 12 },
    },
  };

  if (visualization.kind === "scatter") {
    const yIsRatio = visualization.columns[1]?.toLowerCase().includes("occupancy") || visualization.unit === "%";
    const occupancies = rows
      .map((row) => row.values[1])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return {
      ...common,
      grid: { top: 22, right: 24, bottom: 48, left: 66, containLabel: false },
      xAxis: {
        type: "value",
        name: visualization.columns[0] || t("数值"),
        nameLocation: "middle",
        nameGap: 32,
        axisLabel: { ...axisLabel, hideOverlap: true, formatter: compactAxisValue },
        axisLine,
        splitLine,
      },
      yAxis: {
        type: "value",
        name: visualization.columns[1] || t("数值"),
        min: yIsRatio ? Math.min(0, ...occupancies) : undefined,
        max: yIsRatio ? Math.max(1, ...occupancies) : undefined,
        axisLabel: yIsRatio
          ? { ...axisLabel, formatter: (value: number) => `${Math.round(value * 100)}%` }
          : { ...axisLabel, hideOverlap: true, formatter: compactAxisValue },
        axisLine,
        splitLine,
      },
      series: [
        {
          name: visualization.series[0]?.name || t("样本"),
          type: "scatter",
          symbolSize: (value: unknown, params: { dataIndex: number }) =>
            rows[params.dataIndex]?.status === "pareto_member" ? 17 : 13,
          data: rows.map((row) => ({
            name: row.label,
            value: row.values,
            itemStyle: row.status === "pareto_member" ? { borderColor: ink, borderWidth: 2 } : undefined,
          })),
        },
      ],
    };
  }

  if (visualization.kind === "timeline") {
    return {
      ...common,
      grid: { top: 18, right: 18, bottom: 42, left: 112 },
      xAxis: {
        type: "value",
        name: t("相对时间 (ns)"),
        nameLocation: "middle",
        nameGap: 28,
        axisLabel: { ...axisLabel, hideOverlap: true, formatter: compactAxisValue },
        axisLine,
        splitLine,
      },
      yAxis: {
        type: "category",
        data: rows.map((row) => row.label),
        inverse: true,
        axisLabel: { ...axisLabel, width: 98, overflow: "truncate" },
        axisLine,
      },
      series: [
        {
          name: t("相对开始"),
          type: "bar",
          stack: "stage",
          silent: true,
          itemStyle: { color: "transparent" },
          emphasis: { disabled: true },
          data: rows.map((row) => row.values[0]),
        },
        {
          name: t("持续时间"),
          type: "bar",
          stack: "stage",
          barMaxWidth: 18,
          itemStyle: { color: seriesColors[1] || palette[1], borderRadius: 3 },
          data: rows.map((row) => row.values[1]),
        },
      ],
    };
  }

  const isRatio = visualization.unit === "%";
  return {
    ...common,
    legend:
      visualization.series.length > 1
        ? { top: 0, right: 8, itemWidth: 11, itemHeight: 8, textStyle: axisLabel }
        : undefined,
    grid: { top: visualization.series.length > 1 ? 34 : 18, right: 22, bottom: 38, left: 118 },
    xAxis: {
      type: "value",
      name: visualization.unit,
      nameLocation: "middle",
      nameGap: 28,
      min: isRatio ? 0 : undefined,
      max: isRatio ? 1 : undefined,
      axisLabel: isRatio ? { ...axisLabel, formatter: (value: number) => `${Math.round(value * 100)}%` } : axisLabel,
      axisLine,
      splitLine,
    },
    yAxis: {
      type: "category",
      data: rows.map((row) => row.label),
      inverse: true,
      axisLabel: { ...axisLabel, width: 105, overflow: "truncate" },
      axisLine,
    },
    series: visualization.series.map((series, seriesIndex) => ({
      name: series.name,
      type: "bar",
      stack: visualization.kind === "stacked-bar" ? "contribution" : undefined,
      barMaxWidth: 18,
      itemStyle: { color: seriesColors[seriesIndex], borderRadius: visualization.kind === "stacked-bar" ? 0 : 3 },
      data: rows.map((row) => row.values[seriesIndex]),
    })),
  };
}
