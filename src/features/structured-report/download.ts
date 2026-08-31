import type { StructuredReportContext } from "./model";
import { buildStructuredPerformanceReport } from "./model";
import { renderStructuredPerformanceReportHtml } from "./render-html";

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\p{Cc}/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  return normalized || "tilesim-run";
}

export function createStructuredReportExport(context: StructuredReportContext) {
  const report = buildStructuredPerformanceReport(context);
  return {
    report,
    html: renderStructuredPerformanceReportHtml(report),
    filename: `${safeFilename(context.runName)}-structured-performance-report.html`,
  };
}

export function downloadStructuredPerformanceReport(context: StructuredReportContext) {
  const exported = createStructuredReportExport(context);
  const url = URL.createObjectURL(new Blob([exported.html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exported.filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return exported.filename;
}
