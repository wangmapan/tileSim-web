export const navItems = [
  { id: "overview", group: "分析", label: "运行概览", description: "结论与关键数字" },
  { id: "execution", group: "分析", label: "执行过程", description: "一次请求经过了哪些环节" },
  { id: "metrics", group: "分析", label: "性能指标", description: "请求速度与尾延迟" },
  { id: "fabric", group: "分析", label: "网络与通信", description: "通信负载、排队与拥塞" },
  { id: "attribution", group: "分析", label: "慢请求原因", description: "为什么某些请求更慢" },
  { id: "validation", group: "分析", label: "结果可信度", description: "这些结果能信到什么程度" },
  { id: "design_space", group: "实验", label: "方案对比", description: "比较不同配置方案" },
  { id: "history", group: "实验", label: "运行记录", description: "查找、打开与对比" },
  { id: "evidence_agent", group: "工具", label: "AI 解释", description: "基于已有证据解释结果" },
  { id: "evidence_lab", group: "工具", label: "校准与追踪", description: "查看校准状态和数据来源" },
] as const;

export type WorkspaceView = (typeof navItems)[number]["id"] | "experiment";

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "experiment" || navItems.some((item) => item.id === value);
}
