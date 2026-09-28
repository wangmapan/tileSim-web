import type { OperationEvent, OperationPhase, OperationState } from "./types";

export const initialOperationState = (): OperationState => ({
  operationId: null,
  sequence: 0,
  phase: "idle",
  message: "准备就绪",
  elapsedMs: 0,
  error: null,
});

export function reduceOperation(state: OperationState, event: OperationEvent): OperationState {
  if (state.operationId && event.operationId !== state.operationId) return state;
  if (event.sequence <= state.sequence) return state;
  return {
    operationId: event.operationId,
    sequence: event.sequence,
    phase: event.phase,
    message: event.message,
    elapsedMs: event.elapsedMs,
    error: event.error ?? null,
  };
}

export function isOperationActive(phase: OperationPhase): boolean {
  return !["idle", "succeeded", "failed", "blocked"].includes(phase);
}

export const phaseLabel: Record<OperationPhase, string> = {
  idle: "准备就绪",
  checking_environment: "检查环境",
  starting: "启动服务",
  validating: "验证部署",
  fetching: "获取版本",
  building_backend: "构建后端",
  testing_backend: "验证后端",
  testing_web: "验证 Web",
  building_web: "构建 Web",
  publishing_release: "发布本地版本",
  restarting: "重启服务",
  succeeded: "操作完成",
  failed: "操作失败",
  blocked: "操作已阻止",
};

export function appendBoundedLog(lines: string[], next: string, limit = 400): string[] {
  const normalized = next.replaceAll("\u0000", "").slice(-4000);
  if (!normalized.trim()) return lines;
  return [...lines, normalized].slice(-limit);
}
