import type { HealthResponse } from "../../contracts/bridge-api";

export interface BridgeStatusPresentation {
  available: boolean;
  synchronized: boolean;
  title: string;
  detail: string;
}

function shortRevision(revision: string | undefined): string {
  return revision && revision !== "unknown" ? revision.slice(0, 7) : "未知";
}

function bridgeStatusTitle(health: HealthResponse, legacyApi: boolean, available: boolean): string {
  if (legacyApi) return "Bridge 兼容只读模式";
  if (available) return "独立后端已同步";
  if (health.cli_available && !health.versions_match) return "后端版本不一致";
  return "执行后端不可用";
}

export function buildBridgeStatusPresentation(health: HealthResponse, legacyApi: boolean): BridgeStatusPresentation {
  const available = Boolean(health.execution_ready) && !legacyApi;
  const sourceRevision = shortRevision(health.source_revision);
  const buildRevision = shortRevision(health.build_revision);
  const detail = legacyApi
    ? `API 尚未版本化 · 历史报告可读 · 源码 ${sourceRevision} / CLI ${buildRevision}`
    : `${health.deployment_ref || health.backend_branch || "未托管"} · 源码 ${sourceRevision} / CLI ${buildRevision}`;

  return {
    available,
    synchronized: Boolean(health.versions_match) && !legacyApi,
    title: bridgeStatusTitle(health, legacyApi, available),
    detail,
  };
}
