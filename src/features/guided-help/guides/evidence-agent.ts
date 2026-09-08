import { defineGuide } from "../schema";

export const evidenceAgentGuide = defineGuide({
  id: "evidence_agent",
  title: "AI 解释",
  description: "基于当前运行可引用的证据生成分析草稿，并逐条核对陈述、引用和适用范围。",
  takeaway:
    "生成内容需用户确认。AI 草稿不修改确定性报告，不补造模拟事实；引用结构通过校验也不代表陈述含义已经得到人工验证。",
  steps: [
    {
      id: "availability",
      title: "服务与证据状态",
      body: "证据就绪与模型服务可用是独立条件。服务不可用时仍可查阅原始报告；能力探测、测试夹具和真实模型请求不能作为同一种验收证据。",
      anchor: "evidence_agent-availability",
    },
    {
      id: "request",
      title: "请求选择",
      body: "选择当前运行中的请求后，提交预览显示可引用证据及执行边界。稳定 request ID 与证据快照共同约束解释范围。",
      anchor: "evidence_agent-request",
    },
    {
      id: "question",
      title: "问题与提交",
      body: "问题应限定于已有指标、归因或证据限制。提交前核对来源范围和等待上限；帮助文档不会发送模型请求、自动重试或更换服务配置。",
      anchor: "evidence_agent-question",
    },
    {
      id: "confirm",
      title: "草稿与引用复核",
      body: "结论、限制和条件建议分别列出。通过引用核对运行、工件、SHA-256 与 JSON Pointer；失效绑定、拒答、部分结果和截断不能视为完整有效回答。",
      anchor: "evidence_agent-result",
    },
  ],
  terms: [
    {
      id: "deterministic",
      term: "确定性报告",
      definition: "仿真与报告处理流程生成的结构化输出；内容仍受来源、校准和证据范围约束。",
    },
    {
      id: "citation",
      term: "引用",
      definition: "把一条 AI claim 绑定到当前运行中已验证的 artifact 与字段位置。",
    },
    {
      id: "confirmation",
      term: "需用户确认",
      definition: "AI 生成内容在人工核对前不能视为确定性结论。",
    },
  ],
  next: {
    label: "慢请求原因",
    routeName: "attribution",
  },
  advanced: {
    title: "原始记录与复核",
    body: "服务详情保留 descriptor、Provider/model identity、保留策略和错误状态。排查重复提交时应保留原始请求及幂等 key；不要把新的 key 当作原请求的重试。",
  },
});
