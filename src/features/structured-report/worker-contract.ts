import { setLocale, type AppLocale } from "../../i18n";
import { buildStructuredPerformanceReport, type StructuredReportContext } from "./model";
import { renderStructuredPerformanceReportHtml } from "./render-html";

export interface StructuredReportWorkerRequest {
  requestId: string;
  context: StructuredReportContext;
  locale: AppLocale;
}

export interface StructuredReportWorkerSuccess {
  requestId: string;
  ok: true;
  report: ReturnType<typeof buildStructuredPerformanceReport>;
  html: string;
}

export interface StructuredReportWorkerFailure {
  requestId: string;
  ok: false;
  error: string;
}

export type StructuredReportWorkerResponse = StructuredReportWorkerSuccess | StructuredReportWorkerFailure;

export function buildStructuredReportWorkerResponse(
  request: StructuredReportWorkerRequest,
): StructuredReportWorkerSuccess {
  setLocale(request.locale);
  const report = buildStructuredPerformanceReport(request.context);
  return {
    requestId: request.requestId,
    ok: true,
    report,
    html: renderStructuredPerformanceReportHtml(report),
  };
}
