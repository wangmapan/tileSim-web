import type { AgentIntentResponse } from "../../contracts/bridge-api";
import type { PageContextEnvelope } from "../../entities/agent-orchestration";

export type ExplorationPlanningStatus = "needs_clarification" | "unsupported" | "ready";
export interface ExplorationPlanningResult {
  status: ExplorationPlanningStatus;
  missing: readonly string[];
  questions: readonly string[];
  recommendations: readonly { field: string; value: string; reason: string }[];
  unsupported: readonly string[];
}

const fixedResourceLabels = [
  ["model", "模型"],
  ["engine", "推理引擎"],
  ["gpu_type", "GPU 类型"],
  ["gpu_count", "GPU 卡数"],
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function hasAnyKey(value: unknown, keys: readonly string[]): boolean {
  const current = record(value);
  if (!current) return false;
  if (keys.some((key) => current[key] !== undefined && current[key] !== null && current[key] !== "")) return true;
  return Object.values(current).some((child) => hasAnyKey(child, keys));
}
function hasFixedResource(context: PageContextEnvelope, key: string): boolean {
  const aliases: Record<string, readonly string[]> = {
    model: ["model", "model_id", "model_name"],
    engine: ["engine", "engine_id", "inference_engine"],
    gpu_type: ["gpu_type", "device_type", "accelerator"],
    gpu_count: ["gpu_count", "device_count", "cards"],
  };
  return hasAnyKey(context.run_request, aliases[key] || [key]) ||
    context.resources.some((resource) => resource.resource_id.toLowerCase().includes(key));
}

/** Read-only exploration preflight. Recommendations are never request values. */
export function planExplorationPreflight(
  context: PageContextEnvelope,
  intent: Pick<AgentIntentResponse, "exploration_objective">,
): ExplorationPlanningResult {
  const missing: string[] = [];
  const recommendations: { field: string; value: string; reason: string }[] = [];
  const questions: string[] = [];
  for (const [key, label] of fixedResourceLabels) {
    if (!hasFixedResource(context, key)) missing.push(label);
  }
  if (missing.length) {
    recommendations.push({
      field: "固定资源",
      value: "确认当前页面已选模型、引擎、GPU 类型和卡数",
      reason: "部署候选只能在固定资源条件下比较，避免把资源变化误判为方案收益。",
    });
    questions.push("请确认模型、推理引擎、GPU 类型和卡数；这些固定资源是否按当前页面选择？");
  }
  const runRequest = record(context.run_request);
  const hasWorkload = Boolean(runRequest?.scenario_id) || context.resources.some((resource) => resource.resource_type === "chart_subject");
  if (!hasWorkload) {
    missing.push("工作负载场景");
    recommendations.push({
      field: "工作负载场景",
      value: "低、中、高三个请求负载场景",
      reason: "多个场景可以避免只在单一请求条件下得到偶然最优方案。",
    });
    questions.push("请确认工作负载场景；是否采用低、中、高三个请求负载？");
  }
  if (!intent.exploration_objective) {
    missing.push("主要优化指标");
    recommendations.push({
      field: "主要优化指标",
      value: "端到端延迟 P99（越小越好）",
      reason: "P99 能覆盖尾延迟，适合作为默认服务质量目标。",
    });
    questions.push("请确认主要优化指标；是否以端到端延迟 P99 为主要目标？");
  }
  const unsupported = context.resources
    .filter((resource) => /gpu|parallel|topology|collective|kv/i.test(resource.resource_id) && resource.availability !== "available")
    .map((resource) => resource.display_label || resource.resource_id);
  if (unsupported.length) return { status: "unsupported", missing: [], questions: [], recommendations: [], unsupported };
  return { status: missing.length ? "needs_clarification" : "ready", missing, questions: questions.slice(0, 3), recommendations, unsupported: [] };
}

export function formatExplorationPlanningMessage(result: ExplorationPlanningResult): string {
  if (result.status === "unsupported") {
    return `当前能力目录暂不支持：${result.unsupported.join("、")}。可运行范围是固定资源下选择后端已发布部署候选，再探索批处理调度、最大批处理规模和 KV Cache；确认前不会创建运行或占用实验槽位。`;
  }
  if (result.status === "ready") return "规划信息已完整；下一步仍需用户确认草案后才会授权自动探索。";
  const questions = result.questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
  const recommendations = result.recommendations.map((item) => `推荐：${item.field} = ${item.value}\n理由：${item.reason}`).join("\n");
  return `信息不足，先补充以下最多三个关键问题：\n${questions}\n\n${recommendations}\n\n请确认推荐值或提供你的值。确认前不会生成实验草案、创建运行、调用正式执行器、占用唯一实验槽位或锁定实验页面。`;
}
