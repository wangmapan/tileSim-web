import { toRaw } from "vue";
import { currentLocale } from "../../i18n";
import type { StructuredReportContext } from "./model";
import { buildStructuredPerformanceReport } from "./model";
import { renderStructuredPerformanceReportHtml } from "./render-html";
import type { StructuredReportWorkerRequest, StructuredReportWorkerResponse } from "./worker-contract";

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

function cloneWorkerContext(context: StructuredReportContext): StructuredReportContext {
  return structuredClone({
    ...context,
    bundle: toRaw(context.bundle),
    inputs: toRaw(context.inputs),
    artifactManifest: context.artifactManifest ? toRaw(context.artifactManifest) : context.artifactManifest,
  });
}

function createWorkerExport(
  context: StructuredReportContext,
): Promise<ReturnType<typeof createStructuredReportExport>> {
  const requestId = `structured-report:${crypto.randomUUID()}`;
  const request: StructuredReportWorkerRequest = {
    requestId,
    context: cloneWorkerContext(context),
    locale: currentLocale(),
  };
  const worker = new Worker(new URL("./structured-report.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const finish = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<StructuredReportWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;
      finish();
      if (!event.data.ok) {
        reject(new Error(event.data.error));
        return;
      }
      resolve({
        report: event.data.report,
        html: event.data.html,
        filename: `${safeFilename(context.runName)}-structured-performance-report.html`,
      });
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Structured report Worker failed."));
    };
    worker.postMessage(request);
  });
}

export async function createStructuredReportExportAsync(context: StructuredReportContext) {
  if (typeof Worker === "undefined" || typeof structuredClone === "undefined") {
    return createStructuredReportExport(context);
  }
  try {
    return await createWorkerExport(context);
  } catch {
    return createStructuredReportExport(context);
  }
}

export async function downloadStructuredPerformanceReport(context: StructuredReportContext) {
  const exported = await createStructuredReportExportAsync(context);
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
