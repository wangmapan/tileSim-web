import { defineGuide } from "../schema";

export const overviewGuide = defineGuide({
  id: "overview",
  title: "运行概览",
  description: "运行概览汇总当前实验的执行状态、核心指标和报告限制，并提供执行、网络与验证分析的入口。",
  takeaway:
    "运行完成表示执行结束，不代表模型已通过真实系统验证。指标应在报告声明的数据来源、校准状态和适用范围内使用。",
  steps: [
    {
      id: "status",
      title: "运行状态与服务连接",
      body: "当前实验区域显示运行名称及证据范围。服务连接状态与实验状态分别报告；未连接服务时，示例或导入报告不应视为已提交运行。",
      anchor: "overview-status",
    },
    {
      id: "numbers",
      title: "核心指标",
      body: "总时长、吞吐与请求完成数来自运行报告。数值缺失时保留缺失状态；验证完整度反映字段覆盖，不是预测准确率。",
      anchor: "overview-metrics",
    },
    {
      id: "finding",
      title: "瓶颈摘要",
      body: "瓶颈摘要呈现后端报告给出的主要贡献项。需要核查具体请求或网络等待时，可进入慢请求原因或网络与通信页面查看对应证据。",
      anchor: "overview-finding",
    },
    {
      id: "next",
      title: "分析页面",
      body: "执行过程展示运行结构，性能指标用于比较请求表现，结果可信度列出校准状态和未关闭缺口。页面之间的分析应使用同一运行上下文。",
      anchor: "overview-actions",
    },
  ],
  terms: [
    {
      id: "throughput",
      term: "吞吐",
      definition: "单位时间内完成的请求数量，通常与延迟一起判断。",
    },
    {
      id: "completeness",
      term: "验证完整度",
      definition: "需要的验证字段被覆盖的比例；它不是模型准确率，也不等于真实硬件验证。",
    },
  ],
  next: {
    label: "执行过程",
    routeName: "execution",
  },
  advanced: {
    title: "原始记录与复核",
    body: "原始工件包含已登记的输入和报告。复核时核对运行 ID、Schema identity、SHA-256 和 JSON Pointer，确认摘要与原始字段一致。",
  },
});
