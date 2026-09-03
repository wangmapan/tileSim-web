import type { EvidenceAgentRequest } from "../../contracts/generated/bridge-contracts";
import type { Claim } from "../../contracts/generated/bridge-contracts";

export const evidenceAgentStatusLabels: Record<string, string> = {
  idle: "等待提问",
  submitting: "正在生成解释",
  available_draft: "解释已生成，待确认",
  refused: "已拒答",
  failed: "生成失败",
  partial: "部分结果",
  truncated: "输出已截断",
  timeout: "请求超时",
  cancelled: "请求已取消",
  stale: "结果已过期",
  concurrency_limit: "正在处理其他问题",
  provider_unavailable: "AI 服务暂不可用",
  provider_disabled: "AI 服务已关闭",
  terminal_result_not_retained: "上次结果无法恢复",
  idempotency_payload_mismatch: "当前问题与上次提交冲突",
  unsupported_schema: "当前结果版本暂不支持",
  contract_error: "AI 解释暂不可用",
};

export const evidenceAgentTaskLabels: Record<EvidenceAgentRequest["task_kind"], string> = {
  explain_p99: "解释 P99",
  explain_tail: "解释尾延迟",
  summarize_validation: "总结验证边界",
  draft_conditional_recommendations: "起草条件建议",
};

export type EvidenceAgentClaimGroupId = "conclusion" | "limitations" | "next_steps" | "help";

export interface EvidenceAgentPresentedClaim {
  claim: Claim;
  originalIndex: number;
}

export interface EvidenceAgentClaimGroup {
  id: EvidenceAgentClaimGroupId;
  claims: EvidenceAgentPresentedClaim[];
}

const claimGroupByKind: Record<Claim["claim_kind"], EvidenceAgentClaimGroupId> = {
  numeric_fact: "conclusion",
  comparative_fact: "conclusion",
  reported_attribution: "conclusion",
  validation_boundary: "limitations",
  provenance_boundary: "limitations",
  fidelity_boundary: "limitations",
  architecture_correction: "limitations",
  conditional_recommendation: "next_steps",
  help_text: "help",
};

export function groupEvidenceAgentClaims(claims: Claim[]): EvidenceAgentClaimGroup[] {
  const groups: EvidenceAgentClaimGroup[] = [
    { id: "conclusion", claims: [] },
    { id: "limitations", claims: [] },
    { id: "next_steps", claims: [] },
    { id: "help", claims: [] },
  ];
  const groupById = new Map(groups.map((group) => [group.id, group]));
  claims.forEach((claim, originalIndex) => {
    groupById.get(claimGroupByKind[claim.claim_kind])?.claims.push({ claim, originalIndex });
  });
  return groups;
}
