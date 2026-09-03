import { defineGuide } from "../schema";

export const attributionGuide = defineGuide({
  id: "attribution",
  title: "这里回答“为什么这个请求更慢”",
  description: "选择一个请求后，沿后端报告中的证据查看各环节贡献；页面不会自行推断因果。",
  takeaway: "只把 S0–S6 的明确归因项放进 latency causal ranking；S7、S8、S9 不是延迟原因。",
  steps: [
    {
      id: "request",
      title: "先选择一个请求",
      body: "请求选择会在指标、归因、执行和 AI 解释之间共享；没有稳定 request ID 时不会拼接证据。",
      anchor: "attribution-request",
    },
    {
      id: "chain",
      title: "沿跨子系统证据链核对",
      body: "S3/S4/S5 必须作为并列资源证据阅读，不能从时间接近或文本相似度推断连接。",
      anchor: "attribution-chain",
    },
    {
      id: "ranking",
      title: "切换到尾延迟归因",
      body: "点击 S9 尾延迟归因，再阅读后端报告给出的主导原因排名和占比。",
      anchor: "attribution-ranking",
    },
    {
      id: "audit",
      title: "按需打开归因审计",
      body: "只有在复核结论时才查看稳定 ID、可用性原因和原始证据链接。",
      anchor: "attribution-audit",
    },
  ],
  terms: [
    {
      id: "causal-ranking",
      term: "causal ranking",
      definition: "后端报告给出的延迟原因排序，不包含执行宿主和输出子系统。",
    },
    { id: "share", term: "贡献占比", definition: "报告归给某项原因的相对份额；不能由前端重新聚合。" },
    { id: "cause-chain", term: "cause chain", definition: "用稳定实体 ID 和证据引用串联的原因链。" },
  ],
  next: { label: "下一步：核对结果可信度", routeName: "validation" },
  advanced: {
    title: "最后再看归因契约",
    body: "审计时再核对 subject、artifact、Schema、SHA-256 与 Pointer；S7/S8/S9 只作为执行、验证和输出证据，不进入 causal ranking。",
  },
});
