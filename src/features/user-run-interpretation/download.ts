import type { UserRunInterpretationContext } from "./model";
import {
  buildUserRunInterpretationReport,
  userRunInterpretationBindingMatches,
  userRunInterpretationEvidenceStatus,
} from "./model";
import { renderUserRunInterpretationHtml } from "./render-html";

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

export function createUserRunInterpretationExport(context: UserRunInterpretationContext) {
  if (!context.runId) throw new Error("结果解读报告需要绑定已加载的 run。");
  const evidenceStatus = userRunInterpretationEvidenceStatus(context);
  if (evidenceStatus.manifest_status === "run_mismatch")
    throw new Error("artifact manifest 与当前 run 不一致，不能安全导出。");
  if (evidenceStatus.manifest_status === "schema_revision_mismatch")
    throw new Error("schema revision 已变化，请重新加载结果后再导出。");
  if (evidenceStatus.manifest_status === "unsupported_schema")
    throw new Error("存在不支持的 artifact schema，不能安全导出。");
  if (context.validatedAgentResult && context.evidenceAgentBinding && context.artifactManifest) {
    if (["stale", "refused", "failed", "timeout", "cancelled"].includes(context.validatedAgentResult.state)) {
      throw new Error("Evidence Agent 结果已失效，不能安全导出。");
    }
    if (context.validatedAgentResult.invalidClaimIds.length) {
      throw new Error("Evidence Agent 存在未通过校验的 claim，不能安全导出。");
    }
    if (
      context.currentEvidenceAgentBinding &&
      JSON.stringify(context.evidenceAgentBinding) !== JSON.stringify(context.currentEvidenceAgentBinding)
    ) {
      throw new Error("Evidence Agent 当前绑定已变化，请重新生成。");
    }
    if (
      context.evidenceAgentBinding.runId !== context.runId ||
      context.evidenceAgentBinding.schemaSetRevision !== context.artifactManifest.schema_set_revision ||
      !context.evidenceAgentBinding.inputSnapshotDigest
    ) {
      throw new Error("Evidence Agent 结果绑定已变化，请重新生成。");
    }
  }
  const report = buildUserRunInterpretationReport(context);
  return {
    report,
    html: renderUserRunInterpretationHtml(report),
    filename: `${safeFilename(context.runName)}-run-interpretation-report.html`,
  };
}

export function assertUserRunInterpretationCurrent(
  captured: ReturnType<typeof buildUserRunInterpretationReport>["binding"],
  current: UserRunInterpretationContext,
) {
  if (!userRunInterpretationBindingMatches(captured, current)) {
    throw new Error("结果解读报告上下文已变化，请重新生成。");
  }
}

export function downloadUserRunInterpretationExport(exported: ReturnType<typeof createUserRunInterpretationExport>) {
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

export async function downloadUserRunInterpretationReport(context: UserRunInterpretationContext) {
  return downloadUserRunInterpretationExport(createUserRunInterpretationExport(context));
}
