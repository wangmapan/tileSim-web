import { defineGuide } from "../schema";

export const metricsGuide = defineGuide({
  id: "metrics",
  title: "这里回答“请求有多快”",
  description: "先看汇总延迟和吞吐，再比较单个请求；精确 ps 原值始终按无损路径展示。",
  takeaway: "延迟越低、吞吐越高通常越好，但 0、missing 和不适用必须分别解释。",
  steps: [
    {
      id: "summary",
      title: "先读汇总指标",
      body: "吞吐表示完成速度；TTFT、TPOT 和端到端 P95/P99 分别回答不同的等待问题。",
      anchor: "metrics-summary",
    },
    {
      id: "evidence",
      title: "需要时打开指标证据",
      body: "每个汇总指标都有稳定证据入口；它指向后端报告字段，不由前端重算。",
      anchor: "metrics-evidence",
    },
    {
      id: "requests",
      title: "比较单个请求",
      body: "在请求表中寻找尾部慢请求，并区分真实的零值、缺失值和不适用状态。",
      anchor: "metrics-requests",
    },
    {
      id: "interpret",
      title: "结合证据边界解释",
      body: "指标必须与负载、trace 来源、requested/resolved fidelity 和结果可信度一起判断。",
      anchor: "metrics-interpretation",
    },
  ],
  terms: [
    { id: "ttft", term: "TTFT", definition: "从请求到达至首个 Token 返回的时间。" },
    { id: "tpot", term: "TPOT", definition: "首个 Token 之后，连续生成每个 Token 的平均间隔。" },
    { id: "percentile", term: "P95 / P99", definition: "95% / 99% 的样本不超过该值，用于观察尾延迟。" },
  ],
  next: { label: "下一步：分析慢请求原因", routeName: "attribution" },
  advanced: {
    title: "最后再看精确证据",
    body: "审计时再核对无损 uint64 ps、Schema identity、artifact SHA-256 和 JSON Pointer；不要把 missing 当成 0。",
  },
});
