export const navItems = [
  { id: "overview", group: "分析", label: "运行概览", description: "结论与关键数字" },
  { id: "execution", group: "分析", label: "分层结果", description: "S0–S6 执行链路" },
  { id: "metrics", group: "分析", label: "性能指标", description: "请求与尾延迟" },
  { id: "fabric", group: "分析", label: "Fabric 分析", description: "域、利用率与背压" },
  { id: "attribution", group: "分析", label: "请求证据", description: "跨子系统关联链与尾归因" },
  { id: "validation", group: "分析", label: "验证边界", description: "来源、保真度与缺口" },
  { id: "design_space", group: "实验", label: "设计空间", description: "S6 候选与 DES 晋升" },
  { id: "history", group: "实验", label: "运行记录", description: "查找、打开与对比" },
  { id: "evidence_agent", group: "工具", label: "证据 Agent", description: "引用约束的只读草稿" },
  { id: "evidence_lab", group: "工具", label: "校准与血缘", description: "校准、血缘与固定工具" },
] as const;

export type WorkspaceView = (typeof navItems)[number]["id"] | "experiment";

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "experiment" || navItems.some((item) => item.id === value);
}
