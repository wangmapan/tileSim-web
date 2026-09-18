import { defineGuide } from "../schema";

export const evidenceLabGuide = defineGuide({
  id: "evidence_lab",
  title: "校准与追踪",
  description: "查看证据覆盖、校准工作流、字段来源以及固定工具调用编排，用于复现和审计。",
  takeaway:
    "真实轨迹验证、合成一致性检查和兼容性辅助轨迹提取不是同一种证据。固定示例工作流的成功不能替代真实校准或独立验证。",
  steps: [
    {
      id: "map",
      title: "证据覆盖",
      body: "证据地图按建模边界列出来源、可用性和缺口。未覆盖项必须保留，不应通过相邻模块已有数据推定其可用。",
      anchor: "evidence_lab-map",
    },
    {
      id: "calibration",
      title: "校准工作流",
      body: "工作流记录输入、处理阶段和检查结果。真实测量校准、离线示例和未校准状态分别标识；示例运行不产生正式校准资产的等价声明。",
      anchor: "evidence_lab-calibration",
    },
    {
      id: "lineage",
      title: "字段来源与转换",
      body: "字段血缘连接输入、转换规则与输出位置。核查时保持来源模式、单位和无损整数表示一致，避免把推断字段表述为直接观测。",
      anchor: "evidence_lab-lineage",
    },
    {
      id: "orchestration",
      title: "固定工具编排",
      body: "固定编排展示可复现的调用顺序与结果。它不是生成式 Agent，不会创建新的根因结论；执行状态以各阶段报告为准。",
      anchor: "evidence_lab-orchestration",
    },
  ],
  terms: [
    {
      id: "provenance",
      term: "provenance",
      definition: "证据的来源、生成方式、校准等级和允许声明范围。",
    },
    {
      id: "lineage",
      term: "字段血缘",
      definition: "一个输出字段从哪个输入、转换和证据位置得到。",
    },
    {
      id: "calibration",
      term: "校准",
      definition: "使用真实测量调整模型参数。合成示例只能用于流程或内部一致性检查。",
    },
  ],
  next: {
    label: "结果可信度",
    routeName: "validation",
  },
  advanced: {
    title: "原始记录与复核",
    body: "使用 schema-set revision、backend identity、SHA-256、JSON Pointer 和原始契约复核处理链。uint64 ps、bytes 与 count 保持无损。",
  },
});
