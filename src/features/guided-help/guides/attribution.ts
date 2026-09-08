import { defineGuide } from "../schema";

export const attributionGuide = defineGuide({
  id: "attribution",
  title: "慢请求原因",
  description: "关联请求、资源与网络证据，查看后端报告给出的延迟贡献、原因链和归因审计。",
  takeaway:
    "延迟因果排名只包含目标系统的已报告原因。统一仿真执行、校准验证和指标输出记录保留为审计证据，不作为延迟来源。",
  steps: [
    {
      id: "request",
      title: "请求上下文",
      body: "请求选择使用稳定 request ID，并在支持请求证据的分析页面之间保留。没有明确身份关联时，页面不按时间接近或文本相似度拼接证据。",
      anchor: "attribution-request",
    },
    {
      id: "chain",
      title: "跨模块证据链",
      body: "请求证据连接运行时、并列资源操作和网络阶段。KV Cache、设备与集合通信保持并列；已绑定、部分证据、缺失和引用无效是不同状态。",
      anchor: "attribution-chain",
    },
    {
      id: "ranking",
      title: "贡献排名",
      body: "尾延迟归因保留报告顺序、排名与占比。占比条使用固定范围，不重新归一化；报告没有给出的贡献项不会补入排名。",
      anchor: "attribution-ranking",
    },
    {
      id: "audit",
      title: "归因审计",
      body: "审计用于检查守恒、传播和引用完整性。守恒通过不代表传播链完整，报告置信度也不等于真实系统预测准确率。",
      anchor: "attribution-audit",
    },
  ],
  terms: [
    {
      id: "causal-ranking",
      term: "延迟因果排名",
      definition: "后端报告给出的延迟原因排序，不包含仿真控制平面与结果输出记录。",
    },
    {
      id: "share",
      term: "贡献占比",
      definition: "报告归给某项原因的相对份额；不能由前端重新聚合。",
    },
    {
      id: "cause-chain",
      term: "cause chain",
      definition: "用稳定实体 ID 和证据引用串联的原因链。",
    },
  ],
  next: {
    label: "结果可信度",
    routeName: "validation",
  },
  advanced: {
    title: "原始记录与复核",
    body: "原始证据通过运行 ID、工件、Schema、SHA-256 和 JSON Pointer 定位。原因链是报告提供的解释，不能单独替代真实系统因果实验。",
  },
});
