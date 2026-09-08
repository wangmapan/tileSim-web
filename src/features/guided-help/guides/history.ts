import { defineGuide } from "../schema";

export const historyGuide = defineGuide({
  id: "history",
  title: "运行记录",
  description: "查找和恢复实验上下文，查看运行状态，或选择两次已完成运行进行 A/B 对比。",
  takeaway:
    "A/B 对比展示两次独立运行的已报告结果。比较前应确认工作负载、数据来源和实际仿真精度可比，缺失字段不能补为零。",
  steps: [
    {
      id: "runs",
      title: "查找运行",
      body: "运行名称、ID 和状态用于识别实验。名称便于阅读，稳定运行 ID 用于区分报告、输入和证据归属。",
      anchor: "history-runs",
    },
    {
      id: "open",
      title: "恢复实验上下文",
      body: "打开运行名称后，页面恢复该运行已验证的报告与输入。加载失败时应保留明确错误，不把失败状态解释为没有结果。",
      anchor: "history-open",
    },
    {
      id: "compare",
      title: "A/B 选择",
      body: "依次选择 A 与 B 建立对照。两者是独立运行；比较工作区展示各自值和已支持的差异，不把两个运行的证据合并为一次实验。",
      anchor: "history-compare",
    },
    {
      id: "interpret",
      title: "比较条件",
      body: "负载、配置、Trace 来源与 resolved fidelity 的差异可能改变指标含义。零值、缺失、未覆盖和不适用应分别解释。",
      anchor: "history-results",
    },
  ],
  terms: [
    {
      id: "ab",
      term: "A/B 对比",
      definition: "把两次独立运行的同类已报告指标并排比较。",
    },
    {
      id: "binding",
      term: "运行绑定",
      definition: "报告、输入、artifact 清单与同一 run ID 的绑定关系。",
    },
  ],
  next: {
    label: "新建实验",
    routeName: "experiment",
  },
  advanced: {
    title: "原始记录与复核",
    body: "复现与审计需要运行 ID、backend identity、schema-set revision、工件 SHA-256 和原始报告。对比视图不重新执行仿真或改写结论。",
  },
});
