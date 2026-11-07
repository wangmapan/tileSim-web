import type { ExplorationResponse } from "./types";
import { shouldUnlockAfterCancel } from "./exploration-lock";

const statusMessages: Record<string, string> = {
  recovery_required: "实验结果仍无法确认，需要恢复处理",
  manual_intervention_required: "自动探索需要人工处理，页面仍保持锁定",
  context_expired: "页面上下文已过期，页面仍保持锁定",
  run_failed: "实验失败，页面仍保持锁定",
};

export async function cancelExplorationLifecycle(options: {
  sessionId: string;
  cancel: (sessionId: string) => Promise<ExplorationResponse>;
  unlock: () => void;
  setStatus: (message: string) => void;
}): Promise<ExplorationResponse | null> {
  try {
    const response = await options.cancel(options.sessionId);
    const state = response.session.state;
    if (shouldUnlockAfterCancel(state)) options.unlock();
    else if (statusMessages[state]) options.setStatus(statusMessages[state]);
    return response;
  } catch {
    // A failed stop leaves the existing page lock untouched.
    return null;
  }
}
