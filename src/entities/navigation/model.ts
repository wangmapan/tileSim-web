export const navItems = [
  { id: "overview", group: "结果", label: "运行概览", description: "结论与关键数字" },
  { id: "execution", group: "结果", label: "分层结果", description: "S0–S6 执行链路" },
  { id: "metrics", group: "结果", label: "性能指标", description: "请求与尾延迟" },
  { id: "fabric", group: "结果", label: "Fabric 分析", description: "域、利用率与背压" },
  { id: "attribution", group: "证据", label: "尾延迟归因", description: "跨子系统贡献" },
  { id: "validation", group: "证据", label: "证据与验证", description: "来源与保真度" },
  { id: "evidence_agent", group: "证据", label: "只读证据 Agent", description: "引用约束的独立草稿" },
  { id: "evidence_lab", group: "证据", label: "Week 7 证据链", description: "校准、血缘与 Agent" },
  { id: "design_space", group: "实验", label: "设计空间", description: "S6 候选与 DES 晋升" },
  { id: "history", group: "实验", label: "运行记录", description: "查找、打开与对比" },
] as const;

export type WorkspaceView = (typeof navItems)[number]["id"] | "experiment";

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "experiment" || navItems.some((item) => item.id === value);
}
