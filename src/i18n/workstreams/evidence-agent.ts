// New Evidence Agent copy belongs here so parallel work does not edit the shared legacy catalog.
export const evidenceAgentEnglishCatalog: Readonly<Record<string, string>> = {
  结论: "Findings",
  限制: "Limitations",
  补充说明: "Additional context",
  查看结果技术身份: "View result technical identity",
  "部分结果保留已验证 claims；未完成部分不会由前端补写。":
    "The partial result keeps validated claims; the frontend does not fill unfinished content.",
  "输出已截断，不能视为完整回答。": "The output was truncated and is not a complete answer.",
  "正式 HTTP 502 EvidenceAgentResponse；completion_state=failed。":
    "Formal HTTP 502 EvidenceAgentResponse; completion_state=failed.",
  "正式 HTTP 503 EvidenceAgentResponse；reason_code=provider_unavailable。":
    "Formal HTTP 503 EvidenceAgentResponse; reason_code=provider_unavailable.",
  "正式 HTTP 504 EvidenceAgentResponse；completion_state=timeout。":
    "Formal HTTP 504 EvidenceAgentResponse; completion_state=timeout.",
  "请求已取消；前端不会把未完成输出补成终态。":
    "The request was cancelled; the frontend does not turn unfinished output into a terminal result.",
  "查看引用依据（{count}）": "View citation evidence ({count})",
  "打开原始证据 {index}": "Open source evidence {index}",
  查看引用技术身份: "View citation technical identity",
  "查看 claim 技术身份": "View claim technical identity",
  当前没有此类内容: "No content in this group",
};
