import { defineGuide } from "../schema";

export const validationGuide = defineGuide({
  id: "validation",
  title: "先确认这些结果能信到什么程度",
  description: "数据来源、校准状态、requested/resolved fidelity 和未关闭缺口，决定结果可支持的结论范围。",
  takeaway: "synthetic consistency 不能描述成 held-out validation，三种 trace 来源也不能相互升级。",
  steps: [
    {
      id: "scope",
      title: "先读可支持的结论范围",
      body: "确认当前结果只适合探索、可以比较方案，还是具备独立真实数据验证。",
      anchor: "validation-scope",
    },
    {
      id: "gaps",
      title: "优先查看未关闭缺口",
      body: "open gap 会限制结论强度；missing、not covered、not applicable 和 unsupported schema 各有不同含义。",
      anchor: "validation-gaps",
    },
    {
      id: "provenance",
      title: "核对数据来源和校准",
      body: "real_trace、synthetic_trace 和 compatibility_harness_trace 必须按原 provenance 显示；离线 fixture 不是硬件校准。",
      anchor: "validation-provenance",
    },
    {
      id: "fidelity",
      title: "展开各环节最终精度",
      body: "requested fidelity 与 resolved fidelity 分开阅读；Analytical 或 DES 不能因为目标较高就显示成 Cycle。",
      anchor: "validation-fidelity",
    },
  ],
  terms: [
    { id: "held-out", term: "held-out validation", definition: "用未参与校准的独立真实 trace 或测量验证结果。" },
    {
      id: "consistency",
      term: "synthetic consistency",
      definition: "检查合成数据内部是否一致，不证明真实硬件准确性。",
    },
    { id: "coverage", term: "not covered", definition: "报告范围没有覆盖该项；它不等于数值为 0。" },
  ],
  next: { label: "下一步：回到运行概览", routeName: "overview" },
  advanced: {
    title: "最后再看验证契约",
    body: "审计时再展开逐项检查、Schema identity、SHA-256、Pointer 和完整报告；S8/S9 是验证与输出子系统，不是延迟原因。",
  },
});
