import { defineGuide } from "../schema";

export const historyGuide = defineGuide({
  id: "history",
  title: "从这里打开或对比以前的实验",
  description: "点击实验名称查看结果；需要比较时，依次选择两个已完成实验。",
  takeaway: "A/B 对比只比较两次独立运行的已报告结果，缺失字段不会被补成 0。",
  steps: [
    {
      id: "runs",
      title: "先找到目标实验",
      body: "用名称、运行 ID 和完成状态确认实验；给实验命名可以减少后续误选。",
      anchor: "history-runs",
    },
    {
      id: "open",
      title: "打开一次运行",
      body: "点击运行名称进入其结果；页面只恢复已验证的报告和输入上下文。",
      anchor: "history-open",
    },
    {
      id: "compare",
      title: "选择两个实验做 A/B 对比",
      body: "先选择 A，再选择 B；只有用户开始选择后才显示比较工作区。",
      anchor: "history-compare",
    },
    {
      id: "interpret",
      title: "检查比较是否公平",
      body: "确认负载、来源和 resolved fidelity 可比；0、missing、not covered 与 not applicable 不应混为一项差值。",
      anchor: "history-results",
    },
  ],
  terms: [
    { id: "ab", term: "A/B 对比", definition: "把两次独立运行的同类已报告指标并排比较。" },
    { id: "binding", term: "运行绑定", definition: "报告、输入、artifact 清单与同一 run ID 的绑定关系。" },
  ],
  next: { label: "下一步：新建对照实验", routeName: "experiment" },
  advanced: {
    title: "最后再核对身份",
    body: "复现时再查看 backend identity、schema-set revision、artifact SHA-256 和完整报告；比较层不重算模拟结论。",
  },
});
