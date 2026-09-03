import { defineGuide } from "../schema";

export const evidenceLabGuide = defineGuide({
  id: "evidence_lab",
  title: "这里查看数据从哪里来、是否经过校准",
  description: "日常查看结果不必先读这些技术信息；需要审计、复现或追踪转换时再使用。",
  takeaway: "真实 trace 验证、合成一致性检查与 compatibility harness 提取是三种不同证据等级。",
  steps: [
    {
      id: "map",
      title: "先看证据地图",
      body: "确认 S0–S6 哪些边界有证据、来源是什么，以及哪些项目明确缺失或未覆盖。",
      anchor: "evidence_lab-map",
    },
    {
      id: "calibration",
      title: "查看校准状态",
      body: "区分真实硬件校准、离线示例和未校准状态；示例运行不能升级成正式校准资产。",
      anchor: "evidence_lab-calibration",
    },
    {
      id: "lineage",
      title: "追踪字段血缘",
      body: "从输入经过稳定转换到输出字段，核对 provenance、单位和无损整数路径。",
      anchor: "evidence_lab-lineage",
    },
    {
      id: "orchestration",
      title: "最后查看确定性编排",
      body: "固定编排展示可复现的处理顺序，不是生成式 Agent，也不会产生新的根因结论。",
      anchor: "evidence_lab-orchestration",
    },
  ],
  terms: [
    { id: "provenance", term: "provenance", definition: "证据的来源、生成方式、校准等级和允许声明范围。" },
    { id: "lineage", term: "字段血缘", definition: "一个输出字段从哪个输入、转换和证据位置得到。" },
    { id: "calibration", term: "校准", definition: "用真实测量调整模型参数；离线 fixture 只能证明流程一致。" },
  ],
  next: { label: "下一步：核对结果可信度", routeName: "validation" },
  advanced: {
    title: "最后再看身份与摘要",
    body: "审计时再核对 schema-set revision、backend identity、SHA-256、Pointer 和完整契约；uint64 ps/bytes/count 始终保持无损。",
  },
});
