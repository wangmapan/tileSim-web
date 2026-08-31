import type { ExecutionRecord, LayerVisualization } from "../execution-inspector/model-api";
import type { ReportValue, StructuredPerformanceReport, StructuredSubsystemSection } from "./model";
import { currentLocale, t } from "../../i18n";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsonText(value: unknown) {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item), 2)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function compactJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

function translated(source: string, params: Record<string, string | number> = {}) {
  return escapeHtml(t(source, params));
}

function display(value: unknown, unit = "") {
  if (value === null || value === undefined || value === "" || value === "—") return t("缺失");
  if (unit === "%ratio" && typeof value === "number")
    return `${(value * 100).toLocaleString(currentLocale(), { maximumFractionDigits: 2 })}%`;
  if (typeof value === "number") {
    const number = value.toLocaleString(currentLocale(), { maximumFractionDigits: 4 });
    return unit ? `${number} ${unit}` : number;
  }
  if (typeof value === "object") return compactJson(value);
  return unit ? `${String(value)} ${unit}` : String(value);
}

function availabilityClass(value: unknown) {
  return value === null || value === undefined || value === "" || value === "—" ? "missing" : "";
}

function renderMetrics(metrics: ReportValue[]) {
  return `<div class="metrics">${metrics
    .map(
      (metric) => `<article class="metric ${metric.availability === "missing" ? "missing" : ""}">
        <small>${escapeHtml(metric.label)}</small>
        <strong>${escapeHtml(display(metric.value, metric.unit))}</strong>
        ${metric.hint ? `<span>${escapeHtml(metric.hint)}</span>` : ""}
      </article>`,
    )
    .join("")}</div>`;
}

function renderKeyValues(value: Record<string, unknown> | null, empty = t("没有报告记录")) {
  if (!value || !Object.keys(value).length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<dl class="key-values">${Object.entries(value)
    .map(
      ([key, item]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd class="${availabilityClass(item)}">${escapeHtml(display(item))}</dd></div>`,
    )
    .join("")}</dl>`;
}

function renderRecords(records: ExecutionRecord[], title = t("结构化记录")) {
  if (!records.length) return `<p class="empty">${escapeHtml(t("没有{title}", { title }))}</p>`;
  const columns = [...new Set(records.flatMap((record) => record.facts.map((fact) => fact.label)))];
  return `<details><summary>${escapeHtml(title)} <span>${escapeHtml(t("{count} 条", { count: records.length }))}</span></summary>
    <div class="table-scroll"><table><thead><tr><th>${escapeHtml(t("记录"))}</th><th>${escapeHtml(t("状态"))}</th>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}<th>${escapeHtml(t("字段来源"))}</th></tr></thead>
    <tbody>${records
      .map(
        (record) =>
          `<tr><th><code>${escapeHtml(record.id)}</code><b>${escapeHtml(record.title)}</b>${record.subtitle ? `<small>${escapeHtml(record.subtitle)}</small>` : ""}</th><td>${escapeHtml(record.status || "—")}</td>${columns
            .map((column) => {
              const fact = record.facts.find((item) => item.label === column);
              return `<td class="${availabilityClass(fact?.value)}">${escapeHtml(fact ? display(fact.value, fact.unit) : t("不适用"))}</td>`;
            })
            .join("")}<td><code>${escapeHtml(record.sourcePath || t("见子系统 source pattern"))}</code></td></tr>`,
      )
      .join("")}</tbody></table></div></details>`;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function renderBarChart(visualization: LayerVisualization) {
  const stacked = visualization.kind === "stacked-bar";
  const maxima = visualization.rows.map((row) =>
    stacked
      ? row.values.reduce<number>((total, value) => total + Math.max(0, numeric(value)), 0)
      : Math.max(...row.values.map(numeric), 0),
  );
  const scale = Math.max(...maxima, 1);
  return `<div class="export-bars">${visualization.rows
    .map((row) => {
      const rowTotal = scale;
      const bars = row.values
        .map((value, index) => {
          const width = (Math.max(0, numeric(value)) / rowTotal) * 100;
          const series = visualization.series[index]?.name || visualization.columns[index];
          const color = visualization.series[index]?.color || ["#3f7868", "#567fb0", "#d89a45"][index % 3];
          return `<span title="${escapeHtml(`${series}: ${display(value, visualization.unit)}`)}" style="width:${width.toFixed(4)}%;background:${escapeHtml(color)};${stacked ? "" : "height:5px"}"></span>`;
        })
        .join("");
      return `<div class="export-bar-row"><b>${escapeHtml(row.label)}</b><div class="bar-track ${stacked ? "stacked" : "grouped"}"${stacked ? "" : ' style="height:auto;flex-direction:column;gap:2px"'}>${bars}</div><small>${row.values.map((value, index) => `${escapeHtml(visualization.columns[index])}: ${escapeHtml(display(value, visualization.unit))}`).join(" · ")}</small></div>`;
    })
    .join("")}</div>`;
}

function renderScatter(visualization: LayerVisualization) {
  const points = visualization.rows.filter(
    (row) => typeof row.values[0] === "number" && typeof row.values[1] === "number",
  );
  if (!points.length) return `<p class="empty">${escapeHtml(t("没有完整散点样本"))}</p>`;
  const xValues = points.map((row) => numeric(row.values[0]));
  const yValues = points.map((row) => numeric(row.values[1]));
  const xMin = Math.min(...xValues, 0);
  const xMax = Math.max(...xValues, 1);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);
  const x = (value: number) => 44 + ((value - xMin) / Math.max(xMax - xMin, 1)) * 520;
  const y = (value: number) => 168 - ((value - yMin) / Math.max(yMax - yMin, 1)) * 140;
  return `<svg class="export-scatter" viewBox="0 0 600 200" role="img" aria-label="${escapeHtml(visualization.description)}">
    <line x1="44" y1="168" x2="570" y2="168"/><line x1="44" y1="24" x2="44" y2="168"/>
    ${points.map((row) => `<circle cx="${x(numeric(row.values[0])).toFixed(2)}" cy="${y(numeric(row.values[1])).toFixed(2)}" r="5"><title>${escapeHtml(`${row.label}: ${row.values.join(", ")}`)}</title></circle>`).join("")}
    <text x="300" y="195">${escapeHtml(visualization.columns[0])}</text><text x="8" y="18">${escapeHtml(visualization.columns[1])}</text>
  </svg>`;
}

function renderTimeline(visualization: LayerVisualization) {
  const maximum = Math.max(...visualization.rows.map((row) => numeric(row.values[0]) + numeric(row.values[1])), 1);
  return `<div class="timeline">${visualization.rows
    .map((row) => {
      const left = (numeric(row.values[0]) / maximum) * 100;
      const width = Math.max((numeric(row.values[1]) / maximum) * 100, 0.35);
      return `<div class="timeline-row"><b>${escapeHtml(row.label)}</b><div class="timeline-track"><span style="left:${left.toFixed(4)}%;width:${width.toFixed(4)}%"></span></div><small>${escapeHtml(display(row.values[1], visualization.unit))}</small></div>`;
    })
    .join("")}</div>`;
}

function renderVisualization(visualization: LayerVisualization) {
  const issues = visualization.rows.flatMap((row) =>
    row.values.flatMap((value, index) => {
      const column = visualization.columns[index] || t("字段 {index}", { index: index + 1 });
      if (value === null) return [t("{label} · {column} 缺失", { label: row.label, column })];
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      const isRatio = visualization.unit === "%" || column.toLowerCase().includes("occupancy");
      if (isRatio && (value < 0 || value > 1))
        return [t("{label} · {column}={value} 超出 [0, 1]", { label: row.label, column, value })];
      if (!isRatio && value < 0) return [t("{label} · {column}={value} 为负值", { label: row.label, column, value })];
      return [];
    }),
  );
  let graphic: string;
  if (visualization.kind === "bar" || visualization.kind === "stacked-bar") graphic = renderBarChart(visualization);
  else if (visualization.kind === "scatter") graphic = renderScatter(visualization);
  else if (visualization.kind === "timeline") graphic = renderTimeline(visualization);
  else if (visualization.kind === "matrix") {
    graphic = `<div class="matrix">${visualization.rows.map((row) => `<div><code>${escapeHtml(row.label)}</code><b>${escapeHtml(display(row.values[0]))}</b><small>${escapeHtml(row.sourcePath)}</small></div>`).join("")}</div>`;
  } else graphic = `<p class="empty">${escapeHtml(visualization.emptyReason || t("不适合生成图表"))}</p>`;

  return `<article class="visualization"><header><div><h4>${escapeHtml(visualization.title)}</h4><p>${escapeHtml(visualization.description)}</p></div><span>${escapeHtml(visualization.kind)}</span></header>${graphic}<p class="rationale"><b>${escapeHtml(t("类型依据："))}</b>${escapeHtml(visualization.rationale)}</p>${
    issues.length
      ? `<div class="data-issues" style="margin:8px 0;padding:9px 11px;border:1px solid #e4d3ae;border-radius:6px;color:#684817;background:#fbf5e8"><b>${escapeHtml(t("字段质量提醒"))}</b><ul>${issues
          .slice(0, 10)
          .map((issue) => `<li>${escapeHtml(issue)}</li>`)
          .join(
            "",
          )}</ul>${issues.length > 10 ? `<small>${escapeHtml(t("另有 {count} 项，完整值见字段表和嵌入 JSON。", { count: issues.length - 10 }))}</small>` : ""}</div>`
      : ""
  }<small class="source">${visualization.sourcePaths.map(escapeHtml).join(" · ")}</small></article>`;
}

function renderChecks<T extends object>(checks: T[], title: string) {
  if (!checks.length) return `<p class="empty">${escapeHtml(t("没有{title}", { title }))}</p>`;
  const records = checks.map((item) => item as Record<string, unknown>);
  const columns = [...new Set(records.flatMap((item) => Object.keys(item)))];
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(title)}"><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${records.map((item) => `<tr>${columns.map((column) => `<td class="${availabilityClass(item[column])}">${escapeHtml(display(item[column]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderSubsystem(section: StructuredSubsystemSection) {
  return `<section id="${section.subsystem.toLowerCase()}" class="subsystem page-section">
    <header class="section-header"><span>${section.subsystem}</span><div><small>${escapeHtml(section.name)}</small><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.role)}</p></div><em>${escapeHtml(section.evidence_state)}</em></header>
    <p class="detail">${escapeHtml(section.detail)}</p>
    ${renderMetrics(section.performance_metrics)}
    <div class="two-column"><article><h3>${translated("Fidelity 解析")}</h3>${renderKeyValues(section.fidelity as Record<string, unknown> | null)}</article><article><h3>${translated("实现证据与限制")}</h3>${renderKeyValues(section.implementation as Record<string, unknown> | null)}</article></div>
    ${section.visualizations.map(renderVisualization).join("")}
    ${renderRecords(section.structured_records)}
    <details><summary>${translated("本层验证与报告归因")} <span>${translated("{count} 项", { count: section.validation_checks.length + section.reported_attribution.length })}</span></summary>${renderChecks(section.validation_checks, t("验证检查"))}${renderChecks(section.reported_attribution, t("报告归因"))}</details>
    <p class="source"><b>${translated("字段范围：")}</b>${escapeHtml(section.source_pattern)}</p>
  </section>`;
}

function renderDesignSpace(report: StructuredPerformanceReport["design_space_appendix"]) {
  if (report.availability === "missing") return `<p class="empty">${translated("没有设计空间报告")}</p>`;
  const candidates = report.candidates
    .map(
      (candidate) =>
        `<details><summary>#${escapeHtml(candidate.final_rank || "—")} ${escapeHtml(
          candidate.name || candidate.candidate_id,
        )} <span>${escapeHtml(candidate.resolved_fidelity || t("未知"))}</span></summary>${renderKeyValues(
          candidate as Record<string, unknown>,
        )}</details>`,
    )
    .join("");
  return `<div class="two-column"><article><h3>${translated("设计空间报告身份")}</h3>${renderKeyValues(
    report.report_summary,
  )}</article><article><h3>${translated("排名解释边界")}</h3><p>${translated(
    "排名以报告中的确定性 final_rank 为准；promotion hint 仅作输入备注。",
  )}</p><p><b>${translated("执行范围")}</b> ${escapeHtml(report.execution_scope || t("缺失"))}</p></article></div><h3>${translated(
    "设计空间契约能力",
  )}</h3>${renderChecks(report.contract_capabilities, t("设计空间契约能力"))}
  <h3>${translated("候选完整证据")}</h3>${candidates || `<p class="empty">${translated("没有报告记录")}</p>`}
  <h3>${translated("Analytical / DES 分歧")}</h3>${renderChecks(
    report.analytical_vs_des_disagreements,
    t("Analytical / DES 分歧"),
  )}`;
}

function renderRunBoundEvidence(report: StructuredPerformanceReport["run_bound_evidence"]) {
  const selectedRequest = report.selected_request_id
    ? `<code>${escapeHtml(report.selected_request_id)}</code>`
    : `<span class="missing">${translated("未选择 request；导出不会自动选择 P99")}</span>`;
  const percentileSubjects = report.percentile_subjects.length
    ? renderChecks(report.percentile_subjects, t("P99 subject"))
    : `<p class="empty">${translated("没有后端 percentile subject；前端没有推断 P99")}</p>`;
  const nodes = report.nodes.length
    ? report.nodes
        .map(
          (node) =>
            `<article class="run-bound-node"><header><b>${escapeHtml(node.subsystem)} · ${escapeHtml(
              node.title,
            )}</b><em>${escapeHtml(node.availability)}</em></header><p>${escapeHtml(node.detail)}</p><p><small>${translated(
              "稳定 ID",
            )}</small> ${node.entity_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" · ") || translated("缺失")}</p>${
              node.references.length
                ? `<details><summary>${translated("证据引用")} <span>${translated("{count} 项", {
                    count: node.references.length,
                  })}</span></summary>${renderChecks(node.references, t("证据引用"))}</details>`
                : `<p class="empty">${translated("没有可验证的证据引用")}</p>`
            }</article>`,
        )
        .join("")
    : `<p class="empty">${translated("未选择 request，因此没有生成 S1-S9 run-bound 节点")}</p>`;
  const week8 = report.week8_execution;
  return `<div class="two-column"><article><h3>${translated("请求选择")}</h3><p>${selectedRequest}</p><dl class="key-values"><div><dt>selection_availability</dt><dd>${escapeHtml(
    report.selection_availability,
  )}</dd></div><div><dt>contract_state</dt><dd>${escapeHtml(report.contract_state)}</dd></div></dl></article><article><h3>${translated(
    "S7 执行摘要",
  )}</h3>${renderKeyValues({
    availability: week8.availability,
    requested_fidelity: week8.requested_fidelity,
    resolved_fidelity: week8.resolved_fidelity,
    execution_mode: week8.execution_mode,
    fallback: week8.fallback,
    provenance: week8.provenance,
    state_summary: week8.state_summary,
    differential: week8.differential,
    stream: week8.stream,
    checkpoint: week8.checkpoint,
    reference: week8.reference,
  })}<p>${escapeHtml(week8.detail)}</p></article></div><h3>${translated("后端声明的 P99 subjects")}</h3>${
    percentileSubjects
  }<div class="peer-note"><b>${translated("并列资源语义")}</b><span>S3 Memory / KV</span><span>S4 Device</span><span>S5 Collective</span></div><div class="run-bound-grid">${nodes}</div><h3>${translated(
    "契约缺口",
  )}</h3>${
    report.gaps.length
      ? `<ul>${report.gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>`
      : `<p class="empty">${translated("当前导出没有记录额外 contract gap")}</p>`
  }`;
}

function css() {
  return `:root{--ink:#17201d;--muted:#59645f;--line:#dfe5e1;--soft:#f3f7f4;--accent:#27695a;--warn:#93611d}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#eef2ef;font:14px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei UI",sans-serif}main{width:min(1180px,calc(100% - 40px));margin:24px auto 70px}.cover,.page-section{margin-bottom:18px;padding:24px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:0 8px 24px #2032290c}.cover h1{margin:4px 0 6px;font-size:28px}.cover>p{color:var(--muted)}.eyebrow{color:var(--accent);font:700 12px ui-monospace,monospace;letter-spacing:.12em}.notice{padding:12px 14px;border-left:4px solid var(--warn);background:#fbf5e8;color:#684817}.identity,.metrics,.matrix,.two-column{display:grid;gap:8px}.identity{grid-template-columns:repeat(3,minmax(0,1fr));margin:18px 0}.identity div,.metric,.matrix div,.two-column>article{min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:7px;background:#fafbf9}.identity small,.metric small,.matrix small{display:block;color:var(--muted);overflow-wrap:anywhere}.identity b,.metric strong,.matrix b{display:block;margin-top:3px;overflow-wrap:anywhere}.toc{display:flex;flex-wrap:wrap;gap:6px}.toc a{padding:5px 9px;border-radius:5px;color:var(--accent);background:var(--soft);text-decoration:none;font-weight:700}.process{display:flex;gap:7px;align-items:stretch;margin:16px 0}.process span{display:grid;place-items:center;min-width:0;flex:1;padding:9px 6px;border:1px solid var(--line);border-radius:6px;background:var(--soft);font-weight:700;text-align:center}.process i{align-self:center;color:var(--muted)}.section-header{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:15px}.section-header>span{display:grid;place-items:center;width:46px;height:46px;border-radius:8px;color:#fff;background:var(--accent);font:700 14px ui-monospace,monospace}.section-header small,.section-header p{color:var(--muted)}.section-header h2{margin:1px 0}.section-header p{margin:0}.section-header em{padding:4px 8px;border-radius:999px;background:var(--soft);color:var(--accent);font-style:normal}.detail{color:var(--muted)}.metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin:14px 0}.metric.missing,.missing{color:#655d53;background:#f7f5f1}.metric span{display:block;color:var(--muted);font-size:12px}.two-column{grid-template-columns:repeat(2,minmax(0,1fr));margin:12px 0}.two-column h3{margin-top:0}.key-values{margin:0}.key-values div{display:grid;grid-template-columns:minmax(130px,.7fr) minmax(0,1fr);gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}.key-values dt{min-width:0;color:var(--muted);overflow-wrap:anywhere}.key-values dd{min-width:0;margin:0;overflow-wrap:anywhere}.visualization{margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:8px}.visualization>header{display:flex;justify-content:space-between;gap:12px}.visualization h4{margin:0}.visualization header p{margin:3px 0;color:var(--muted)}.visualization header>span{height:fit-content;padding:2px 6px;border-radius:999px;background:var(--soft);color:var(--accent);font-size:11px}.rationale,.source{color:var(--muted);overflow-wrap:anywhere}.run-bound-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.run-bound-node{min-width:0;padding:12px;border:1px solid var(--line);border-radius:8px;background:#fafbf9}.run-bound-node header{display:flex;justify-content:space-between;gap:8px}.run-bound-node header em{color:var(--accent);font-style:normal}.run-bound-node code{overflow-wrap:anywhere}.peer-note{display:grid;grid-template-columns:auto repeat(3,1fr);gap:8px;align-items:center;margin:12px 0;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--soft)}.peer-note span{text-align:center;font-weight:700}.export-bars{display:grid;gap:10px;margin:12px 0}.export-bar-row{display:grid;grid-template-columns:140px minmax(180px,1fr) minmax(210px,.75fr);gap:9px;align-items:center}.export-bar-row>b{overflow-wrap:anywhere}.export-bar-row small{color:var(--muted)}.bar-track,.timeline-track{display:flex;height:18px;overflow:hidden;border-radius:4px;background:#edf1ee}.bar-track.grouped{gap:2px;background:transparent}.bar-track.grouped span{height:18px;border-radius:3px}.bar-track.stacked span{height:100%}.export-scatter{display:block;width:100%;max-height:250px;margin:10px 0}.export-scatter line{stroke:#9daba4;stroke-width:1}.export-scatter circle{fill:#3f7868;stroke:#fff;stroke-width:2}.export-scatter text{fill:var(--muted);font-size:11px}.timeline{display:grid;gap:8px;margin:12px 0}.timeline-row{display:grid;grid-template-columns:150px minmax(220px,1fr) 100px;gap:8px;align-items:center}.timeline-track{position:relative}.timeline-track span{position:absolute;top:0;height:100%;border-radius:3px;background:var(--accent)}.matrix{grid-template-columns:repeat(3,minmax(0,1fr));margin:10px 0}.matrix code{overflow-wrap:anywhere}.table-scroll{max-height:580px;overflow:auto;margin:10px 0}table{width:100%;border-spacing:0;border-collapse:separate;font-size:12px}th,td{padding:7px 8px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-align:left;vertical-align:top;white-space:nowrap}tr>*:first-child{border-left:1px solid var(--line)}thead th{position:sticky;top:0;z-index:1;border-top:1px solid var(--line);background:#eef3f0}tbody th{background:#fafbf9;white-space:normal}tbody th code,tbody th b,tbody th small{display:block;overflow-wrap:anywhere}tbody th small{color:var(--muted)}details{margin:12px 0;border-top:1px solid var(--line)}summary{padding:10px 0;cursor:pointer;font-weight:700}summary span{float:right;color:var(--muted);font-weight:400}.empty{padding:10px;border:1px dashed var(--line);border-radius:6px;color:var(--muted);background:#fafbf9}.agent-pending{border-color:#e7d9bb;background:#fffdf8}.footer{color:var(--muted);text-align:center}@media(max-width:850px){.identity,.metrics,.matrix{grid-template-columns:repeat(2,minmax(0,1fr))}.two-column,.run-bound-grid{grid-template-columns:1fr}.export-bar-row,.timeline-row{grid-template-columns:110px minmax(150px,1fr)}.export-bar-row small,.timeline-row small{grid-column:2}.process{flex-wrap:wrap}.process span{flex-basis:25%}.peer-note{grid-template-columns:1fr}.peer-note span{text-align:left}}@media print{body{background:#fff}main{width:100%;margin:0}.cover,.page-section{break-inside:avoid;margin:0 0 12px;padding:16px;box-shadow:none}.subsystem{break-before:page}details{break-inside:auto}details>*{display:block}.table-scroll{max-height:none;overflow:visible}.toc{display:none}}`;
}

export function renderStructuredPerformanceReportHtml(report: StructuredPerformanceReport): string {
  const identity = report.report_identity;
  const evidence = report.evidence_boundary;
  const toc = [
    ...report.modeled_subsystems.map((item) => [item.subsystem.toLowerCase(), `${item.subsystem} ${item.title}`]),
    ["s7", t("S7 执行宿主")],
    ["s8", t("S8 验证")],
    ["s9", t("S9 指标与归因")],
    ["run-bound", t("请求证据链")],
    ["design-space", t("设计空间")],
    ["appendix", t("完整性能明细")],
    ["agent", t("Agent 分析预留")],
  ];
  const embedded = jsonText(report);
  return `<!doctype html><html lang="${currentLocale() === "en-US" ? "en" : "zh-CN"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(identity.run_name)} · ${translated("TileSim 结构化性能报告")}</title><style>${css()}</style></head><body><main>
  <section class="cover"><p class="eyebrow">TILESIM STRUCTURED PERFORMANCE REPORT</p><h1>${escapeHtml(identity.run_name)}</h1><p>${translated("沿 canonical flow 展示本次模拟的分层性能事实、执行阶段、验证和报告归因。")}</p><div class="notice"><b>${translated("证据边界：")}</b>${translated("本报告由前端确定性整理，不重新执行模拟，不生成新的根因判断或优化建议。")}</div>
  <div class="identity"><div><small>Run ID</small><b>${escapeHtml(identity.run_id || t("本地导入 / 内置示例"))}</b></div><div><small>Trace</small><b>${escapeHtml(identity.trace_name || t("缺失"))}</b></div><div><small>${translated("执行范围")}</small><b>${escapeHtml(identity.modeled_range || t("缺失"))}</b></div><div><small>${translated("来源模式")}</small><b>${escapeHtml(evidence.source_mode || t("缺失"))}</b></div><div><small>${translated("校准级别")}</small><b>${escapeHtml(evidence.calibration_level || t("缺失"))}</b></div><div><small>${translated("允许声明")}</small><b>${escapeHtml(evidence.allowed_claim_scope || t("缺失"))}</b></div></div>
  <nav class="toc">${toc.map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`).join("")}</nav></section>
  <section class="page-section"><h2>${translated("全局概览")}</h2>${renderMetrics(report.run_overview.reported_summary)}<div class="two-column"><article><h3>${translated("后端报告的瓶颈摘要")}</h3>${renderKeyValues(report.run_overview.reported_bottleneck, t("没有后端 bottleneck_report"))}</article><article><h3>${translated("证据与 Artifact 完整性")}</h3>${renderKeyValues(evidence as unknown as Record<string, unknown>)}</article><article><h3>Runtime policy</h3>${renderKeyValues(report.input_configuration.runtime_policy)}</article><article><h3>${translated("Topology 输入")}</h3>${renderKeyValues(report.input_configuration.topology)}</article></div><div class="process"><span>S0 Workload</span><i>→</i><span>S1 Runtime</span><i>→</i><span>S2 Execution</span><i>→</i><span>${translated("S3 / S4 / S5 并列资源语义")}</span><i>→</i><span>S6 Fabric</span></div><p>${escapeHtml(report.process_model.resource_semantics_note)}</p></section>
  ${report.modeled_subsystems.map(renderSubsystem).join("")}
  <section id="s7" class="page-section"><header class="section-header"><span>S7</span><div><small>Unified Simulation Kernel</small><h2>${translated("统一执行宿主")}</h2><p>${escapeHtml(report.execution_host_s7.description)}</p></div><em>${report.execution_host_s7.stages.length ? "reported" : "missing"}</em></header>${renderVisualization(report.execution_host_s7.timeline)}${renderRecords(report.execution_host_s7.stages, "Execution envelope stages")}</section>
  <section id="s8" class="page-section"><header class="section-header"><span>S8</span><div><small>Calibration and Validation</small><h2>${translated("证据与验证")}</h2><p>${translated("展示报告声明的 provenance、fidelity resolution、检查与未关闭问题。")}</p></div><em>${escapeHtml(report.validation_s8.status)}</em></header><div class="two-column"><article><h3>${translated("验证身份")}</h3>${renderKeyValues({ completeness: report.validation_s8.completeness, lane: report.validation_s8.lane, evidence_tier: report.validation_s8.evidence_tier, claim_scope_summary: report.validation_s8.claim_scope_summary })}</article><article><h3>Trace provenance</h3>${renderKeyValues(report.validation_s8.provenance)}</article></div><h3>Fidelity resolution</h3>${renderChecks(report.validation_s8.fidelity_resolution, "fidelity resolution")}<h3>Validation checks</h3>${renderChecks(report.validation_s8.checks, "validation checks")}<h3>Open gaps</h3>${report.validation_s8.open_gaps.length ? `<ul>${report.validation_s8.open_gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>` : `<p class="empty">${translated("报告没有 open gaps；这不自动代表真实留出验证已经完成。")}</p>`}</section>
  <section id="s9" class="page-section"><header class="section-header"><span>S9</span><div><small>Metrics and Attribution</small><h2>${translated("指标与报告归因")}</h2><p>${translated("保留请求级性能、tail summary 以及后端已报告的 attribution/cause chain。")}</p></div><em>${escapeHtml(report.metrics_and_attribution_s9.status)}</em></header><h3>Tail latency summary</h3>${renderKeyValues(report.metrics_and_attribution_s9.tail_latency_summary)}<h3>${translated("归因守恒与传播审计")}</h3>${renderKeyValues(report.metrics_and_attribution_s9.attribution_audit)}<h3>Request metrics</h3>${renderChecks(report.metrics_and_attribution_s9.request_metrics, "request metrics")}<h3>${translated("后端报告归因")}</h3>${renderChecks(report.metrics_and_attribution_s9.reported_attribution, "reported attribution")}<h3>${translated("后端报告原因链")}</h3>${renderChecks(report.metrics_and_attribution_s9.reported_cause_chain, "reported cause chain")}</section>
  <section id="run-bound" class="page-section"><header class="section-header"><span>LINK</span><div><small>REQUEST EVIDENCE</small><h2>${translated("请求证据链")}</h2><p>${translated("仅使用后端稳定 ID、manifest 身份和 JSON Pointer 连接当前 request 的 S1-S9 证据。")}</p></div><em>${escapeHtml(report.run_bound_evidence.contract_state)}</em></header>${renderRunBoundEvidence(report.run_bound_evidence)}</section>
  <section id="design-space" class="page-section"><header class="section-header"><span>DS</span><div><small>S6 DESIGN SPACE</small><h2>${translated("设计空间与选择性 DES")}</h2><p>${translated("保留候选排名、晋级过程、运行实例、证据边界和完整候选字段。")}</p></div><em>${escapeHtml(report.design_space_appendix.availability)}</em></header>${renderDesignSpace(report.design_space_appendix)}</section>
  <section id="appendix" class="page-section"><header class="section-header"><span>RAW</span><div><small>PERFORMANCE EVIDENCE APPENDIX</small><h2>${translated("完整性能证据明细")}</h2><p>${translated("保留结构化视图聚合前的请求、phase、Fabric contribution 和域利用率记录。")}</p></div><em>reported fields</em></header><h3>${translated("Fabric 证据身份")}</h3>${renderKeyValues(report.performance_evidence_appendix.fabric_contract as unknown as Record<string, unknown>)}<details><summary>Workload requests <span>${translated("{count} 条", { count: report.performance_evidence_appendix.workload_requests.length })}</span></summary>${renderChecks(report.performance_evidence_appendix.workload_requests, "workload requests")}</details><details><summary>Request metrics <span>${translated("{count} 条", { count: report.performance_evidence_appendix.request_metrics.length })}</span></summary>${renderChecks(report.performance_evidence_appendix.request_metrics, "request metrics")}</details><details><summary>Phase fabric contributions <span>${translated("{count} 条", { count: report.performance_evidence_appendix.phase_fabric_contributions.length })}</span></summary>${renderChecks(report.performance_evidence_appendix.phase_fabric_contributions, "phase fabric contributions")}</details><details><summary>Request fabric contributions <span>${translated("{count} 条", { count: report.performance_evidence_appendix.request_fabric_contributions.length })}</span></summary>${renderChecks(report.performance_evidence_appendix.request_fabric_contributions, "request fabric contributions")}</details><details><summary>Fabric domain utilization <span>${translated("{count} 条", { count: report.performance_evidence_appendix.fabric_domain_utilization.length })}</span></summary>${renderChecks(report.performance_evidence_appendix.fabric_domain_utilization, "fabric domain utilization")}</details></section>
  <section id="agent" class="page-section agent-pending"><header class="section-header"><span>AI</span><div><small>FUTURE EVIDENCE-AWARE AGENT</small><h2>${translated("根因分析与优化建议")}</h2><p>${escapeHtml(report.agent_analysis.note)}</p></div><em>${escapeHtml(report.agent_analysis.status)}</em></header><div class="two-column"><article><h3>${translated("具体根因")}</h3><p class="empty">${translated("尚未生成")}</p></article><article><h3>${translated("优化建议")}</h3><p class="empty">${translated("尚未生成")}</p></article></div></section>
  <p class="footer">${translated("生成时间")} ${escapeHtml(report.generated_at)} · Schema ${escapeHtml(report.schema_version)} · ${translated("完整机器可读数据已嵌入本文档")}</p>
  <script type="application/json" id="tilesim-structured-report">${embedded}</script></main></body></html>`;
}

export { escapeHtml };
