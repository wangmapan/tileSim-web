export const navItems = [
  { id: "overview", group: "运行", label: "运行概览", description: "结论与关键数字" },
  { id: "execution", group: "运行", label: "执行过程", description: "请求经过的环节" },
  { id: "replay", group: "运行", label: "执行回放", description: "按时间查看已报告记录" },
  { id: "history", group: "运行", label: "运行记录", description: "查找、打开与对比" },
  { id: "metrics", group: "结果", label: "性能指标", description: "请求速度与尾延迟" },
  { id: "fabric", group: "结果", label: "网络与通信", description: "通信负载与拥塞" },
  { id: "attribution", group: "结果", label: "慢请求原因", description: "请求变慢的原因" },
  { id: "validation", group: "结果", label: "结果可信度", description: "结果来源与边界" },
  { id: "design_space", group: "结果", label: "方案对比", description: "比较不同配置方案" },
  { id: "raw_evidence", group: "证据", label: "原始证据", description: "检索运行工件" },
  { id: "evidence_lab", group: "证据", label: "校准与追踪", description: "查看校准与来源" },
] as const;

export type WorkspaceView = (typeof navItems)[number]["id"] | "experiment" | "evidence_agent";

/**
 * Closed page identities published to the Agent.  These are route identities,
 * never URLs or callable names; model output is accepted only when it points
 * back into this directory.
 */
export const agentPageDirectory = [
  {
    page_id: "overview",
    display_label: "运行概览",
    route_name: "overview",
    capability_ids: ["overview"],
    supports_run: true,
  },
  {
    page_id: "execution",
    display_label: "执行过程",
    route_name: "execution",
    capability_ids: ["execution", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "replay",
    display_label: "执行回放",
    route_name: "replay",
    capability_ids: ["execution_replay", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "metrics",
    display_label: "性能指标",
    route_name: "metrics",
    capability_ids: ["metrics", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "fabric",
    display_label: "网络与通信",
    route_name: "fabric",
    capability_ids: ["fabric", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "attribution",
    display_label: "慢请求原因",
    route_name: "attribution",
    capability_ids: ["attribution", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "validation",
    display_label: "结果可信度",
    route_name: "validation",
    capability_ids: ["validation", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "raw_evidence",
    display_label: "原始证据",
    route_name: "raw_evidence",
    capability_ids: ["raw_evidence", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "evidence_agent",
    display_label: "证据助手",
    route_name: "evidence_agent",
    capability_ids: ["evidence_agent", "run_bound"],
    supports_run: true,
  },
  {
    page_id: "evidence_lab",
    display_label: "校准与追踪",
    route_name: "evidence_lab",
    capability_ids: ["evidence_lab"],
    supports_run: false,
  },
  {
    page_id: "design_space",
    display_label: "方案对比",
    route_name: "design_space",
    capability_ids: ["design_space"],
    supports_run: false,
  },
  {
    page_id: "history",
    display_label: "运行记录",
    route_name: "history",
    capability_ids: ["history"],
    supports_run: false,
  },
  {
    page_id: "experiment",
    display_label: "实验配置",
    route_name: "experiment",
    capability_ids: ["experiment", "configuration"],
    supports_run: false,
  },
] as const;

export type AgentPublishedPage = (typeof agentPageDirectory)[number];

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "experiment" || value === "evidence_agent" || navItems.some((item) => item.id === value);
}
