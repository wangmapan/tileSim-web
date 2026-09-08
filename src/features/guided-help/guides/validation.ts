import { defineGuide } from "../schema";

export const validationGuide = defineGuide({
  id: "validation",
  title: "结果可信度",
  description: "核对数据来源、校准与验证状态、实际仿真精度和证据缺口，确定当前结果能够支持的结论。",
  takeaway:
    "synthetic consistency 是合成一致性检查，不能表述为 held-out validation。真实轨迹、合成轨迹与兼容性辅助轨迹保持独立来源标注。",
  steps: [
    {
      id: "scope",
      title: "结论适用范围",
      body: "结论范围由报告中的来源、校准和验证证据共同限定。探索性结果、有限外推、条件预测与真实校准验证不能混为同一等级。",
      anchor: "validation-scope",
    },
    {
      id: "gaps",
      title: "未关闭缺口",
      body: "未关闭缺口可能限制指标解释或场景覆盖。缺失、未覆盖、不适用和不支持的 Schema 分别保留；未覆盖不能按数值零处理。",
      anchor: "validation-gaps",
    },
    {
      id: "provenance",
      title: "来源与校准",
      body: "real_trace 表示真实系统采集；synthetic_trace 表示生成数据；compatibility_harness_trace 表示兼容性或语义仿真提取。采集来源不自动证明已经完成校准，校准也不替代独立留出验证。",
      anchor: "validation-provenance",
    },
    {
      id: "fidelity",
      title: "请求精度与实际精度",
      body: "requested fidelity 与 resolved fidelity 分别表示目标和实际采用的精度。Analytical、DES、Cycle 的含义取决于实际执行后端；GPU 参与本身不代表周期级保真度。",
      anchor: "validation-fidelity",
    },
  ],
  terms: [
    {
      id: "held-out",
      term: "held-out validation",
      definition: "用未参与校准的独立真实 trace 或测量验证结果。",
    },
    {
      id: "consistency",
      term: "synthetic consistency",
      definition: "检查合成数据内部是否一致，不证明真实硬件准确性。",
    },
    {
      id: "coverage",
      term: "not covered",
      definition: "报告范围没有覆盖该项；它不等于数值为 0。",
    },
  ],
  next: {
    label: "运行概览",
    routeName: "overview",
  },
  advanced: {
    title: "原始记录与复核",
    body: "逐项验证记录提供检查结果与原始字段位置。使用 Schema identity、SHA-256 和 JSON Pointer 复核证据时，应同时记录验证场景与未覆盖范围。",
  },
});
