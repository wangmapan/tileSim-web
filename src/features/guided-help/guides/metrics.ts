import { defineGuide } from "../schema";

export const metricsGuide = defineGuide({
  id: "metrics",
  title: "性能指标",
  description: "查看汇总延迟、吞吐和逐请求指标，并通过证据链接核查原始值、单位和指标定义。",
  takeaway: "数值 0、缺失、未覆盖和不适用分别表达不同状态。比较结果时需要保持负载、来源和实际仿真精度可比。",
  steps: [
    {
      id: "summary",
      title: "汇总指标",
      body: "TTFT 表示首 Token 等待，TPOT 表示后续 Token 的生成间隔，端到端延迟表示请求整体耗时。吞吐与尾延迟应结合负载条件一起解读。",
      anchor: "metrics-summary",
    },
    {
      id: "evidence",
      title: "指标证据",
      body: "证据入口定位到当前运行的报告字段。图表中的显示级单位换算不改变原始 ps 值，汇总指标不在前端重新计算。",
      anchor: "metrics-evidence",
    },
    {
      id: "requests",
      title: "逐请求比较",
      body: "请求表保留请求标识及已报告指标。P95/P99 对象关联以报告提供的选择语义为准，不按相同数值或数组位置推断。",
      anchor: "metrics-requests",
    },
    {
      id: "interpret",
      title: "结果解释",
      body: "使用绝对延迟或吞吐进行规划前，应核对结果可信度、校准条件和未覆盖行为。合成一致性检查不能替代独立真实轨迹验证。",
      anchor: "metrics-interpretation",
    },
  ],
  terms: [
    {
      id: "ttft",
      term: "TTFT",
      definition: "从请求到达至首个 Token 返回的时间。",
    },
    {
      id: "tpot",
      term: "TPOT",
      definition: "首个 Token 之后，连续生成每个 Token 的平均间隔。",
    },
    {
      id: "percentile",
      term: "P95 / P99",
      definition: "95% / 99% 的样本不超过该值，用于观察尾延迟。",
    },
  ],
  next: {
    label: "慢请求原因",
    routeName: "attribution",
  },
  advanced: {
    title: "原始记录与复核",
    body: "精确核查使用无损 uint64 ps、Schema identity、工件 SHA-256 和 JSON Pointer。缺失值不能替换为零后参与差值计算。",
  },
});
