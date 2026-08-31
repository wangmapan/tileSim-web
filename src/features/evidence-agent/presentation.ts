import type { EvidenceAgentRequest } from "../../contracts/generated/bridge-contracts";

export const evidenceAgentStatusLabels: Record<string, string> = {
  idle: "等待提问",
  submitting: "正在生成证据草稿",
  available_draft: "待确认草稿",
  refused: "已拒答",
  failed: "Provider 响应失败",
  partial: "部分结果",
  truncated: "输出已截断",
  timeout: "请求超时",
  cancelled: "请求已取消",
  stale: "结果已过期",
  concurrency_limit: "并发槽已占用",
  provider_unavailable: "Provider 未配置",
  provider_disabled: "Provider 已禁用",
  terminal_result_not_retained: "终态结果未留存",
  idempotency_payload_mismatch: "幂等载荷不匹配",
  unsupported_schema: "不支持的 Schema",
  contract_error: "Agent 契约不可用",
};

export const evidenceAgentTaskLabels: Record<EvidenceAgentRequest["task_kind"], string> = {
  explain_p99: "解释 P99",
  explain_tail: "解释尾延迟",
  summarize_validation: "总结验证边界",
  draft_conditional_recommendations: "起草条件建议",
};
