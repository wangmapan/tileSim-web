import { defineGuide } from "../schema";

export const designSpaceGuide = defineGuide({
  id: "design_space",
  title: "方案对比",
  description: "比较候选配置的报告指标、排名和细化结果，并核对每个变量的实际执行范围。",
  takeaway:
    "候选排名只在当前负载、模型、执行范围和仿真精度内成立，不代表全系统或真实硬件最优。进入更高精度阶段不等于完成校准。",
  steps: [
    {
      id: "scope",
      title: "执行范围",
      body: "当比较仅执行网络配置时，未执行的运行时、缓存、设备或集合通信变量保留 unresolved_not_executed。不能把候选配置中出现的变量全部视为已经模拟。",
      anchor: "design_space-scope",
    },
    {
      id: "summary",
      title: "候选与细化阶段",
      body: "候选数量、筛选和细化记录说明实际参与比较的方案。Analytical 用于广泛筛选，DES 用于动态行为分析，Cycle 用于具备条件的局部机制细化；当前可用阶段以报告为准。",
      anchor: "design_space-summary",
    },
    {
      id: "ranking",
      title: "排名与多目标比较",
      body: "排名、P95/P99 和 Pareto 集直接来自报告。比较需要同时考虑指标方向、实际执行范围以及候选是否进入后续细化。",
      anchor: "design_space-ranking",
    },
    {
      id: "evidence",
      title: "候选配置与证据",
      body: "候选记录区分请求参数和实际采用参数。复现时保留 candidate ID、输入配置及对应报告，不根据显示结果反推未报告参数。",
      anchor: "design_space-evidence",
    },
  ],
  terms: [
    {
      id: "pareto",
      term: "Pareto 集",
      definition: "在多个目标上不存在被另一方案全面压倒的候选集合。",
    },
    {
      id: "promotion",
      term: "进一步精细模拟",
      definition: "把少量候选提升到更高仿真精度继续比较，不代表结果已校准。",
    },
    {
      id: "scope",
      term: "execution_scope",
      definition: "本次运行实际执行和比较的模块与参数范围。",
    },
  ],
  next: {
    label: "新建实验",
    routeName: "experiment",
  },
  advanced: {
    title: "原始记录与复核",
    body: "使用 manifest、Schema、SHA-256、JSON Pointer 以及原始排名字段核查候选。前端不扩写未执行变量，也不重新计算最优方案。",
  },
});
