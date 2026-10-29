import { currentLocale } from "../../i18n";
import type { UserRunInterpretationReport, UserRunInterpretationItem, UserRunInterpretationChart } from "./model";

function evidenceStatusLabel(status: UserRunInterpretationReport["evidence_status"]["manifest_status"]): string {
  return (
    {
      verified: "已核对",
      unavailable: "暂不可用",
      run_mismatch: "与当前运行不一致",
      missing: "没有可用证据",
      unsupported_schema: "存在不支持的格式",
      schema_revision_mismatch: "版本不一致",
      artifact_identity_missing: "证据身份不完整",
    } as const
  )[status];
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]));
  return value;
}

function displayItem(item: UserRunInterpretationItem) {
  return `<article class="item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text).replaceAll("\n", "<br>")}</p><span class="source-kind">${escapeHtml(item.source === "deterministic_boundary" ? "边界说明" : item.source === "validated_agent" ? "已验证条件建议" : "已报告字段")}</span>${item.source_paths.length ? `<details class="evidence-details"><summary>查看证据依据</summary><small>${escapeHtml(item.source_paths.join(" · "))}</small></details>` : ""}</article>`;
}

function numericValues(chart: UserRunInterpretationChart) {
  return chart.rows.flatMap((row) =>
    row.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
}

function renderBarChart(chart: UserRunInterpretationChart) {
  const values = numericValues(chart);
  if (!values.length) return "";
  const max = Math.max(...values, 0);
  const width = 720;
  const rowHeight = 28;
  const height = Math.max(72, chart.rows.length * rowHeight + 28);
  const seriesCount = Math.max(chart.columns.length, 1);
  const colors = ["#39766b", "#d2913d", "#b65b53", "#587fb0"];
  const rows = chart.rows
    .slice(0, 12)
    .map((row, rowIndex) => {
      const y = 22 + rowIndex * rowHeight;
      const slot = Math.max(10, (width - 180) / seriesCount - 6);
      return `<text x="0" y="${y + 13}" class="chart-label">${escapeHtml(row.label)}</text>${row.values
        .slice(0, seriesCount)
        .map((value, index) => {
          if (typeof value !== "number" || !Number.isFinite(value))
            return `<text x="${180 + index * (slot + 6)}" y="${y + 13}" class="chart-missing">—</text>`;
          const barWidth = max ? Math.max(2, (value / max) * slot) : 0;
          const x = 180 + index * (slot + 6);
          return `<rect x="${x}" y="${y + 2}" width="${barWidth}" height="16" rx="2" fill="${colors[index % colors.length]}"><title>${escapeHtml(chart.columns[index] || "值")}: ${escapeHtml(value)} ${escapeHtml(chart.unit)}</title></rect>`;
        })
        .join("")}`;
    })
    .join("");
  return `<svg class="bar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)}">${rows}</svg>`;
}

function renderScatterChart(chart: UserRunInterpretationChart) {
  const points = chart.rows.flatMap((row) => row.values.slice(0, 2).map((value, index) => ({ row, value, index })));
  const valid = points.filter(({ value }) => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return "";
  const max = Math.max(...valid.map(({ value }) => value as number), 1);
  const circles = valid
    .map(({ row, value, index }, pointIndex) => {
      const x = 34 + ((value as number) / max) * 650;
      const y = 24 + (pointIndex % Math.max(chart.rows.length, 1)) * 24;
      return `<circle cx="${x}" cy="${y}" r="5" fill="${index ? "#d2913d" : "#39766b"}"><title>${escapeHtml(row.label)}: ${escapeHtml(value)} ${escapeHtml(chart.unit)}</title></circle>`;
    })
    .join("");
  return `<svg class="scatter-chart" viewBox="0 0 720 80" role="img" aria-label="${escapeHtml(chart.title)}"><line x1="34" y1="60" x2="684" y2="60" stroke="currentColor" opacity=".25"/>${circles}</svg>`;
}

function renderTimelineChart(chart: UserRunInterpretationChart) {
  const valid = chart.rows.flatMap((row, index) => row.values.slice(0, 1).map((value) => ({ row, value, index })));
  const numeric = valid.filter(({ value }) => typeof value === "number" && Number.isFinite(value));
  if (!numeric.length) return "";
  const max = Math.max(...numeric.map(({ value }) => value as number), 1);
  const marks = numeric
    .map(({ row, value, index }) => {
      const x = 24 + ((value as number) / max) * 660;
      return `<circle cx="${x}" cy="30" r="5" fill="#39766b"><title>${escapeHtml(row.label)}: ${escapeHtml(value)} ${escapeHtml(chart.unit)}</title></circle><text x="${x}" y="58" class="chart-label" text-anchor="middle">${escapeHtml(String(index + 1))}</text>`;
    })
    .join("");
  return `<svg class="timeline-chart" viewBox="0 0 720 72" role="img" aria-label="${escapeHtml(chart.title)}"><line x1="24" y1="30" x2="684" y2="30" stroke="#39766b" stroke-width="3" opacity=".45"/>${marks}</svg>`;
}

function renderGraphic(chart: UserRunInterpretationChart) {
  if (chart.kind === "bar" || chart.kind === "stacked-bar") return renderBarChart(chart);
  if (chart.kind === "scatter") return renderScatterChart(chart);
  if (chart.kind === "timeline") return renderTimelineChart(chart);
  return "";
}

function renderCharts(report: UserRunInterpretationReport) {
  if (!report.charts.length) return `<p class="muted">没有可安全投影的图表；不补造视觉指标。</p>`;
  return report.charts
    .map(
      (chart) =>
        `<article class="chart"><header><div><h3>${escapeHtml(chart.title)}</h3><p>${escapeHtml(chart.description)}</p></div><code>${escapeHtml(chart.kind)}</code></header>${
          chart.rows.length
            ? `${renderGraphic(chart)}<div class="chart-rows">${chart.rows
                .slice(0, 12)
                .map(
                  (row) =>
                    `<div class="chart-row"><b>${escapeHtml(row.label)}</b><span>${escapeHtml(row.values.map((value) => String(value ?? "未报告")).join(" · "))} ${escapeHtml(chart.unit)}</span></div>`,
                )
                .join("")}</div>`
            : `<p class="muted">${escapeHtml(chart.empty_reason || "没有完整样本")}</p>`
        }<details class="evidence-details"><summary>查看证据依据</summary><small>${escapeHtml(chart.source_paths.join(" · ") || "没有可用来源路径")}</small></details></article>`,
    )
    .join("");
}

function renderNextSteps(report: UserRunInterpretationReport) {
  return report.next_steps
    .map(
      (step) =>
        `<article class="item next-step"><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p>${step.conditional ? `<span class="pill">条件建议，尚未执行</span>` : ""}<details class="evidence-details"><summary>查看证据依据</summary><small>${escapeHtml(step.source_paths.join(" · ") || "暂无证据路径")}</small></details></article>`,
    )
    .join("");
}

function css() {
  return `:root{color-scheme:light;--ink:#1f2933;--muted:#65727d;--line:#d8dee4;--paper:#fff;--soft:#f3f6f8;--accent:#0b6e69;--warn:#9a6116}*{box-sizing:border-box}body{margin:0;background:#edf1f3;color:var(--ink);font:15px/1.65 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1060px;margin:0 auto;padding:42px 28px 72px}.cover,.section{background:var(--paper);border:1px solid var(--line);padding:30px 34px;margin-bottom:18px}.eyebrow{letter-spacing:.16em;font-size:11px;color:var(--accent);font-weight:700}.cover h1{font-size:34px;line-height:1.2;margin:8px 0 12px}.cover>p{color:var(--muted)}.notice{border-left:3px solid var(--accent);background:var(--soft);padding:12px 14px;margin:22px 0}.identity{display:flex;flex-wrap:wrap;gap:12px}.identity div{min-width:180px;flex:1;border-top:1px solid var(--line);padding-top:8px}.identity small,.item small,.chart small{display:block;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.identity b{display:block;overflow-wrap:anywhere}.section h2{font-size:22px;margin:0 0 16px}.section h3{font-size:16px;margin:0 0 5px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.item,.chart{border:1px solid var(--line);background:#fbfcfc;padding:14px 16px}.item p,.chart p{margin:4px 0 8px;white-space:pre-wrap}.chart header{display:flex;justify-content:space-between;gap:12px}.chart-rows{display:grid;gap:6px;margin:12px 0}.chart-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:5px}.chart-row span{color:var(--muted);text-align:right}.bar-chart,.scatter-chart,.timeline-chart{display:block;width:100%;height:auto;margin:16px 0;color:var(--muted)}.chart-label{font-size:11px;fill:currentColor}.chart-missing{font-size:12px;fill:var(--muted)}.muted{color:var(--muted)}.pill{display:inline-block;background:#f6ecd8;color:var(--warn);padding:2px 7px;border-radius:3px;font-size:12px;margin:4px 0}.source-kind{display:inline-block;color:var(--muted);font-size:12px}.evidence-details{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}.evidence-details summary{cursor:pointer;color:var(--accent);font-size:12px}.foot{color:var(--muted);font-size:12px;margin-top:18px;overflow-wrap:anywhere}@media(max-width:700px){main{padding:18px 12px}.cover,.section{padding:22px 18px}.identity,.grid{grid-template-columns:1fr}.chart-row{display:block}.chart-row span{display:block;text-align:left}}`;
}

export function renderUserRunInterpretationHtml(report: UserRunInterpretationReport): string {
  const identity = report.binding;
  const lang = currentLocale() === "en-US" ? "en" : "zh-CN";
  const embedded = JSON.stringify(jsonSafe(report))
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.run_name || identity.run_id || "TileSim")} · 结果解读报告</title><style>${css()}</style></head><body><main><section class="cover"><p class="eyebrow">TILESIM USER RUN INTERPRETATION</p><h1>${escapeHtml(report.run_name || "用户运行结果")}</h1><p>这是面向用户的只读整理，帮助快速回答“发生了什么、哪些结果可引用、下一步是什么”。</p><div class="notice"><b>证据边界：</b>${escapeHtml(report.evidence_boundary.note)}</div><div class="identity"><div><small>运行状态</small><b>${escapeHtml(report.run_status || "未报告")}</b></div><div><small>证据清单</small><b>${escapeHtml(evidenceStatusLabel(report.evidence_status.manifest_status))}</b></div><div><small>生成方式</small><b>${escapeHtml(report.generation_status === "deterministic_with_validated_agent_recommendation" ? "确定性整理 + 已验证条件建议" : "确定性整理")}</b></div></div><details class="evidence-details"><summary>查看证据依据</summary><div class="identity"><div><small>Run identity</small><b>${escapeHtml(identity.run_id || "未绑定")}</b></div><div><small>Backend identity</small><b>${escapeHtml(identity.backend_identity || "不可用")}</b></div><div><small>Schema revision</small><b>${escapeHtml(identity.schema_set_revision || "不可用")}</b></div><div><small>Input snapshot digest</small><b>${escapeHtml(identity.input_snapshot_digest || "不可用")}</b></div></div></details></section><section class="section"><h2>运行速览</h2><div class="grid">${report.run_summary.map(displayItem).join("")}</div></section><section class="section"><h2>关键结果</h2><div class="grid">${report.key_results.length ? report.key_results.map(displayItem).join("") : `<p class="muted">没有足够的已报告指标。</p>`}</div></section><section class="section"><h2>发现与证据边界</h2><div class="grid">${report.findings.length ? report.findings.map(displayItem).join("") : `<p class="muted">当前没有可引用的后端发现。</p>`}</div><p class="foot">来源模式：${escapeHtml(report.evidence_boundary.source_mode || "未报告")} · 校准：${escapeHtml(report.evidence_boundary.calibration_level || "未报告")} · 允许声明：${escapeHtml(report.evidence_boundary.allowed_claim_scope || "未报告")} · requested fidelity：${escapeHtml(report.evidence_boundary.requested_fidelity || "未报告")} · resolved fidelity：${escapeHtml(report.evidence_boundary.resolved_fidelity || "未报告")}</p></section><section class="section"><h2>可视化摘要</h2>${renderCharts(report)}</section><section class="section"><h2>需要留意</h2><div class="grid">${report.attention_items.length ? report.attention_items.map(displayItem).join("") : `<p class="muted">没有额外的已报告提醒。</p>`}</div></section><section class="section"><h2>下一步</h2><div class="grid">${renderNextSteps(report)}</div></section><section class="section"><h2>证据依据</h2><details class="evidence-details"><summary>查看 artifact 身份与 rejected 状态</summary><div class="grid">${identity.artifacts.length ? identity.artifacts.map((artifact) => `<article class="item"><h3>${escapeHtml(artifact.artifact_id)}</h3><p>${escapeHtml(artifact.report_kind || "未分类")}</p><small>${escapeHtml(artifact.schema_identity)} · ${escapeHtml(artifact.sha256)} · ${escapeHtml(artifact.bytes)} bytes · ${escapeHtml(artifact.contract_status)}</small></article>`).join("") : `<p class="muted">没有 artifact manifest 身份可显示。</p>`}${report.evidence_status.rejected_artifacts.map((artifact) => `<article class="item"><h3>${escapeHtml(artifact.artifact_id)}</h3><p>Bridge 拒绝：${escapeHtml(artifact.reason)}</p><small>${escapeHtml(artifact.schema_identity)} · ${escapeHtml(artifact.json_pointer)}</small></article>`).join("")}</div></details></section><p class="foot">生成时间 ${escapeHtml(report.generated_at)} · Schema ${escapeHtml(report.schema_version)} · 完整 artifact 正文未嵌入；请回到结果页查看原始证据。</p><script type="application/json" id="tilesim-user-run-interpretation">${embedded}</script></main></body></html>`;
}

export { escapeHtml };
