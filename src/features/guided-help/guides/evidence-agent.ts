import { defineGuide } from "../schema";

export const evidenceAgentGuide = defineGuide({
  id: "evidence_agent",
  title: "不知道怎么解读时，可以让 AI 帮忙说明",
  description: "AI 只读取当前实验中可引用的证据，不会修改 deterministic report；生成内容仍需用户确认。",
  takeaway: "先选择请求，再提出一个可由现有证据回答的问题；AI 结果永远不能覆盖确定性报告。",
  steps: [
    {
      id: "availability",
      title: "先确认 AI 服务是否可用",
      body: "服务不可用时继续查看确定性报告；不要把 fixture 或草稿能力当成 live Provider 结果。",
      anchor: "evidence_agent-availability",
    },
    {
      id: "request",
      title: "选择要解释的请求",
      body: "只选择当前运行中具备稳定 request ID 和可引用证据的请求。",
      anchor: "evidence_agent-request",
    },
    {
      id: "question",
      title: "提出范围明确的问题",
      body: "询问现有指标、归因或限制；AI 不能生成新的模拟事实或替代缺失证据。",
      anchor: "evidence_agent-question",
    },
    {
      id: "confirm",
      title: "逐条核对回答和引用",
      body: "生成内容保留“需用户确认”；按引用回到原报告，确认 run、artifact、SHA 和 Pointer 一致。",
      anchor: "evidence_agent-result",
    },
  ],
  terms: [
    {
      id: "deterministic",
      term: "deterministic report",
      definition: "TileSim 与 Bridge 生成的结构化确定性报告，是模拟事实来源。",
    },
    { id: "citation", term: "引用", definition: "把一条 AI claim 绑定到当前运行中已验证的 artifact 与字段位置。" },
    { id: "confirmation", term: "需用户确认", definition: "AI 生成内容在人工核对前不能视为确定性结论。" },
  ],
  next: { label: "下一步：返回慢请求原因", routeName: "attribution" },
  advanced: {
    title: "最后再看服务契约",
    body: "排查时再查看 descriptor、Provider/model identity、retention、409/502/503/504、Schema、SHA 和 Pointer；不要自动更换幂等 key。",
  },
});
