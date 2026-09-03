import { defineGuide } from "../schema";

export const overviewGuide = defineGuide({
  id: "overview",
  title: "先判断这次实验是否值得继续分析",
  description: "先看运行是否完成、结果有什么限制，再看关键数字。",
  takeaway: "限制提示与后端报告的当前重点，是进入其他分析页前最重要的上下文。",
  steps: [
    {
      id: "status",
      title: "确认运行状态和证据限制",
      body: "先读结果摘要；如果标记为证据范围受限，只把结果用于趋势观察和方案探索。",
      anchor: "overview-status",
    },
    {
      id: "numbers",
      title: "查看四个关键数字",
      body: "从总时长、吞吐和请求完成数开始；验证完整度表示字段覆盖，不是准确率。",
      anchor: "overview-metrics",
    },
    {
      id: "finding",
      title: "阅读本次重点",
      body: "主瓶颈来自后端报告。页面只呈现这项结论，不会在前端重新计算或猜测原因。",
      anchor: "overview-finding",
    },
    {
      id: "next",
      title: "选择下一条分析路径",
      body: "想看请求如何运行就进入执行过程；想比较速度就进入性能指标；想核对限制就进入结果可信度。",
      anchor: "overview-actions",
    },
  ],
  terms: [
    { id: "throughput", term: "吞吐", definition: "单位时间内完成的请求数量，通常与延迟一起判断。" },
    {
      id: "completeness",
      term: "验证完整度",
      definition: "需要的验证字段被覆盖的比例；它不是模型准确率，也不等于真实硬件验证。",
    },
  ],
  next: { label: "下一步：查看执行过程", routeName: "execution" },
  advanced: {
    title: "最后再看原始工件",
    body: "需要审计时再展开原始工件，并核对 Schema identity、artifact SHA-256、JSON Pointer 和完整 JSON。",
  },
});
