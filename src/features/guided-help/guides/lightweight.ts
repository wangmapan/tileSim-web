import { defineGuide } from "../schema";

const lightweightTerms = [
  {
    id: "requested-resolved-fidelity",
    term: "requested / resolved fidelity",
    definition: "requested fidelity 是提交意图；resolved fidelity 只能由后端运行报告确认。",
  },
  {
    id: "missing-boundary",
    term: "missing / not covered",
    definition: "缺失或未覆盖字段保持原状态，不会被前端补成 0，也不会被解释为真实证据。",
  },
] as const;

export const lightweightGuide = defineGuide({
  id: "lightweight",
  title: "轻量版开始",
  description: "从新建实验开始，恢复已有运行，或打开结果摘要。页面帮助集中说明轻量版的范围和证据边界。",
  takeaway: "轻量版可以提交正式 run；Agent 只提供解释和草案辅助，不能替代校验或越权创建运行。",
  steps: [
    {
      id: "start",
      title: "开始或继续实验",
      body: "使用新建实验进入基础配置；已有运行会保留 run ID 和可恢复的结果上下文。",
      anchor: "lightweight-start-primary",
    },
    {
      id: "recent",
      title: "最近运行",
      body: "最近运行区域只显示后端返回的状态和请求精度，不根据前端计时器猜测进度。",
      anchor: "lightweight-start-recent",
    },
    {
      id: "results",
      title: "结果摘要",
      body: "完成运行后，结果页只读取已验证的 report、artifact 和 schema 字段。",
      anchor: "lightweight-start-results",
    },
  ],
  terms: lightweightTerms,
  next: { label: "新建实验", routeName: "lightweight_prepare" },
  advanced: {
    title: "专业版与高级能力",
    body: "完整 design space、trace package 深度编辑、完整拓扑和更高阶 Agent 能力仍在专业版及其公开能力范围内；schema identity 仍由后端契约维护。",
  },
});

export const lightweightPrepareGuide = defineGuide({
  id: "lightweight_prepare",
  title: "轻量版配置",
  description: "填写必要的实验身份、输入来源和 requested fidelity，确认 canonical request 后提交正式 run。",
  takeaway:
    "输入来源、requested fidelity 和 resolved fidelity 是不同语义；提交前只确认请求，实际解析结果由后端报告返回。",
  steps: [
    {
      id: "identity",
      title: "实验身份",
      body: "实验名称和场景用于生成可追溯的 canonical request。",
      anchor: "lightweight_prepare-identity",
    },
    {
      id: "inputs",
      title: "输入与能力",
      body: "不可用能力保持禁用；输入来源和公开能力状态来自 descriptor/capability。",
      anchor: "lightweight_prepare-inputs",
    },
    {
      id: "submit",
      title: "校验与提交",
      body: "校验通过后才可以创建正式 run；重复提交会复用已有 idempotency key。",
      anchor: "lightweight_prepare-submit",
    },
  ],
  terms: lightweightTerms,
  next: { label: "查看运行状态", routeName: "lightweight_run" },
  advanced: {
    title: "高级配置",
    body: "完整 design space、trace package、拓扑编辑和高级 profile 可在专业版继续编辑；schema identity 仍由后端契约维护。",
  },
});

export const lightweightRunGuide = defineGuide({
  id: "lightweight_run",
  title: "轻量版运行状态",
  description: "查看后端返回的 queued、preparing、running、completed、failed、unavailable 或 incomplete 状态。",
  takeaway: "页面不显示前端估算的百分比或剩余时间；终态会停止轮询，刷新合法 run URL 会按 run ID 恢复。",
  steps: [
    {
      id: "status",
      title: "当前状态",
      body: "状态和失败原因来自 Bridge；状态变化由后端响应决定。",
      anchor: "lightweight_run-status",
    },
    {
      id: "identity",
      title: "运行身份",
      body: "run ID、backend identity、schema revision 和 artifact SHA-256 用于恢复和复核同一运行。",
      anchor: "lightweight_run-identity",
    },
    {
      id: "actions",
      title: "下一步动作",
      body: "完成运行后查看结果；失败或不完整时重新配置，不把异常状态解释为成功。",
      anchor: "lightweight_run-actions",
    },
  ],
  terms: lightweightTerms,
  next: { label: "查看结果摘要", routeName: "lightweight_results" },
  advanced: {
    title: "恢复语义",
    body: "合法 run URL 只恢复对应的运行状态和证据上下文，不会创建新 run，也不会清除专业版上下文；schema identity 仍由后端契约维护。",
  },
});

export const lightweightResultsGuide = defineGuide({
  id: "lightweight_results",
  title: "轻量版结果摘要",
  description: "按结论、证据和字段细节阅读已验证结果。来源、fidelity、schema 和 artifact 身份会保持可见。",
  takeaway:
    "real_trace、synthetic_trace 和 compatibility_harness_trace 不会互相升级；0、missing、stale 与 unsupported 也必须分开阅读。",
  steps: [
    {
      id: "summary",
      title: "结果结论",
      body: "关键指标保留后端单位和字段路径；合法 0 会显示为 0。",
      anchor: "lightweight_results-summary",
    },
    {
      id: "chart",
      title: "必要图表",
      body: "只有报告提供真实逐域字段时才绘制利用率图表；字段缺失时显示边界状态。",
      anchor: "lightweight_results-chart",
    },
    {
      id: "integrity",
      title: "证据索引",
      body: "manifest、schema revision、artifact SHA-256 和 contract status 用于确认结果身份。",
      anchor: "lightweight_results-integrity",
    },
  ],
  terms: lightweightTerms,
  next: { label: "回到轻量版开始", routeName: "lightweight" },
  advanced: {
    title: "专业版细节",
    body: "需要完整执行、验证、Fabric、设计空间或 Evidence 详情时，进入专业版并保留当前 run query 上下文；schema identity 仍由后端契约维护。",
  },
});
