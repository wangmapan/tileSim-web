import type {
  AgentHarnessAvailability,
  AgentHarnessProjection,
  AgentOperationState,
} from "../../entities/agent-orchestration";
import type {
  AgentHarnessApprovalStatus,
  AgentHarnessDraftStatus,
  AgentHarnessValidationStatus,
} from "../../lib/api/agent-harness";

export interface AgentHarnessStatusCardProps {
  projection: AgentHarnessProjection;
  title?: string;
}

const stateLabels: Record<AgentOperationState, { zh: string; en: string }> = {
  draft: { zh: "草案", en: "Draft" },
  submitted: { zh: "已提交", en: "Submitted" },
  queued: { zh: "排队中", en: "Queued" },
  running: { zh: "运行中", en: "Running" },
  waiting_tool: { zh: "等待工具", en: "Waiting for tool" },
  waiting_approval: { zh: "等待审批", en: "Waiting for approval" },
  retrying: { zh: "重试中", en: "Retrying" },
  completed: { zh: "已完成", en: "Completed" },
  failed: { zh: "失败", en: "Failed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
  recovery_required: { zh: "需要恢复", en: "Recovery required" },
  manual_intervention_required: { zh: "需要人工介入", en: "Manual intervention required" },
};

const availabilityLabels: Record<AgentHarnessAvailability, { zh: string; en: string }> = {
  available: { zh: "可用", en: "Available" },
  unavailable: { zh: "不可用", en: "Unavailable" },
  not_exposed: { zh: "未暴露", en: "Not exposed" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  failed: { zh: "失败", en: "Failed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
  completed: { zh: "已完成", en: "Completed" },
};

export function agentHarnessStateLabel(state: AgentOperationState, locale: "zh-CN" | "en-US" = "zh-CN") {
  return stateLabels[state][locale === "en-US" ? "en" : "zh"];
}

export function agentHarnessAvailabilityLabel(
  availability: AgentHarnessAvailability,
  locale: "zh-CN" | "en-US" = "zh-CN",
) {
  return availabilityLabels[availability][locale === "en-US" ? "en" : "zh"];
}

const draftStatusLabels: Record<AgentHarnessDraftStatus, { zh: string; en: string }> = {
  draft: { zh: "草案", en: "Draft" },
  validated: { zh: "已校验", en: "Validated" },
  invalid: { zh: "参数非法", en: "Invalid" },
  unsupported: { zh: "不支持", en: "Unsupported" },
  unavailable: { zh: "不可用", en: "Unavailable" },
  stale: { zh: "已过期绑定", en: "Stale" },
  expired: { zh: "已过期", en: "Expired" },
  deleted: { zh: "已删除", en: "Deleted" },
};

const validationStatusLabels: Record<AgentHarnessValidationStatus, { zh: string; en: string }> = {
  valid: { zh: "校验通过", en: "Valid" },
  invalid: { zh: "参数非法", en: "Invalid" },
  unsupported: { zh: "不支持", en: "Unsupported" },
  unavailable: { zh: "不可用", en: "Unavailable" },
  stale: { zh: "绑定过期", en: "Stale" },
  expired: { zh: "已过期", en: "Expired" },
  rejected: { zh: "已拒绝", en: "Rejected" },
};

const approvalStatusLabels: Record<AgentHarnessApprovalStatus, { zh: string; en: string }> = {
  pending: { zh: "待审批", en: "Pending" },
  approved: { zh: "已批准", en: "Approved" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  expired: { zh: "已过期", en: "Expired" },
  revoked: { zh: "已撤销", en: "Revoked" },
  stale: { zh: "已失效", en: "Stale" },
};

export function agentHarnessDraftStatusLabel(status: AgentHarnessDraftStatus, locale: "zh-CN" | "en-US" = "zh-CN") {
  return draftStatusLabels[status][locale === "en-US" ? "en" : "zh"];
}

export function agentHarnessValidationStatusLabel(
  status: AgentHarnessValidationStatus,
  locale: "zh-CN" | "en-US" = "zh-CN",
) {
  return validationStatusLabels[status][locale === "en-US" ? "en" : "zh"];
}

export function agentHarnessApprovalStatusLabel(
  status: AgentHarnessApprovalStatus,
  locale: "zh-CN" | "en-US" = "zh-CN",
) {
  return approvalStatusLabels[status][locale === "en-US" ? "en" : "zh"];
}
