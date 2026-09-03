import { defineGuide } from "../schema";

export const designSpaceGuide = defineGuide({
  id: "design_space",
  title: "这里用于比较不同配置方案",
  description: "先看排名、P95/P99 与实际比较范围，再按需展开 Pareto 和专业证据。",
  takeaway: "第 1 名只在当前模拟条件和当前执行范围内更优，不代表完整系统或真实硬件最优。",
  steps: [
    {
      id: "scope",
      title: "确认实际比较范围",
      body: "当前设计空间只执行 S6 时，S1/S3/S4/S5 候选变量仍是 unresolved_not_executed。",
      anchor: "design_space-scope",
    },
    {
      id: "summary",
      title: "查看候选数量和细化数量",
      body: "先确认有多少方案参与分析，以及哪些方案进入了更细的模拟。",
      anchor: "design_space-summary",
    },
    {
      id: "ranking",
      title: "比较排名和尾延迟",
      body: "排名直接来自后端报告；先看 P95/P99，再看是否进入 Pareto 集和更高精度阶段。",
      anchor: "design_space-ranking",
    },
    {
      id: "evidence",
      title: "按需核对候选证据",
      body: "只在复现或审计时展开 requested/resolved knobs、candidate ID 和原始 artifact 记录。",
      anchor: "design_space-evidence",
    },
  ],
  terms: [
    { id: "pareto", term: "Pareto 集", definition: "在多个目标上不存在被另一方案全面压倒的候选集合。" },
    { id: "promotion", term: "进一步精细模拟", definition: "把少量候选提升到更高仿真精度继续比较，不代表结果已校准。" },
    { id: "scope", term: "execution_scope", definition: "本轮实际执行和比较的子系统范围。" },
  ],
  next: { label: "下一步：新建一个对照实验", routeName: "experiment" },
  advanced: {
    title: "最后再看候选契约",
    body: "需要审计时再查看算法、manifest、Schema、SHA-256、Pointer、analytical_rank 和 final_rank；前端不会扩写未执行变量。",
  },
});
