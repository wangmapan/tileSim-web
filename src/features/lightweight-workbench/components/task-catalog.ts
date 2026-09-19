export type LightweightTaskCategoryId = "understand" | "prepare" | "interpret" | "example";

export interface LightweightTaskTemplate {
  id: string;
  title: string;
  summary: string;
  audience: string;
  duration: string;
  readonly: boolean;
  artifacts: string;
  sideEffects: string;
  /** Example templates are illustrative only and must never be presented as live evidence. */
  kind: "task" | "example";
  exampleLabel?: string;
}

export interface LightweightTaskCategory {
  id: LightweightTaskCategoryId;
  title: string;
  description: string;
  templates: readonly LightweightTaskTemplate[];
}

/**
 * Legacy informational catalog. Keep each category to at most two cards so a
 * compatibility link remains scannable; cards only choose a setup starting
 * point and never replace the canonical form or formal-run submission.
 */
export const LIGHTWEIGHT_TASK_CATEGORIES: readonly LightweightTaskCategory[] = [
  {
    id: "understand",
    title: "了解",
    description: "先建立输入、模拟和结果之间的基本概念。",
    templates: [
      {
        id: "understand-flow",
        title: "看懂 TileSim 的基本流程",
        summary: "用三张概念卡了解输入、模拟和结果各自做什么。",
        audience: "第一次接触 TileSim 的用户",
        duration: "约 5 分钟",
        readonly: true,
        artifacts: "概念卡和术语提示",
        sideEffects: "说明卡仅本地展示；不会创建运行或调用 Provider",
        kind: "task",
      },
      {
        id: "understand-terms",
        title: "认识常见参数",
        summary: "从 batch、延迟和带宽开始，知道它们在流程中的位置。",
        audience: "需要先补充基础知识的用户",
        duration: "约 8 分钟",
        readonly: true,
        artifacts: "术语解释和专业版跳转",
        sideEffects: "说明卡仅本地展示；不会修改草案或运行状态",
        kind: "task",
      },
    ],
  },
  {
    id: "prepare",
    title: "准备",
    description: "按目标整理一个可检查的配置草案。",
    templates: [
      {
        id: "prepare-batch",
        title: "准备一个 batch 草案",
        summary: "用普通语言描述目标，整理 max batch size 等已支持字段。",
        audience: "想先写下配置想法、还不准备运行的用户",
        duration: "约 3 分钟",
        readonly: true,
        artifacts: "本页生命周期内的草案摘要",
        sideEffects: "说明卡只保留在当前页面；不会创建运行或调用 Provider",
        kind: "task",
      },
      {
        id: "prepare-network",
        title: "准备网络参数草案",
        summary: "记录带宽和延迟目标，并明确仍缺少哪些信息。",
        audience: "需要先梳理网络目标的用户",
        duration: "约 4 分钟",
        readonly: true,
        artifacts: "字段、单位和缺口清单",
        sideEffects: "说明卡只做解析；刷新后不恢复草案正文，不会创建运行",
        kind: "task",
      },
    ],
  },
  {
    id: "interpret",
    title: "解读",
    description: "阅读已有合法运行的结果、依据和限制。",
    templates: [
      {
        id: "interpret-summary",
        title: "读懂已有结果摘要",
        summary: "从结论、依据和限制开始阅读一个已有 run。",
        audience: "已经有 run、想先看结论的用户",
        duration: "约 5 分钟",
        readonly: true,
        artifacts: "结果摘要和证据索引（只读卡片）",
        sideEffects: "说明卡只读取已有合法 run；不会重新运行或调用 Provider",
        kind: "task",
      },
      {
        id: "interpret-limits",
        title: "检查结果限制",
        summary: "识别 missing、unknown、stale 和 synthetic 等状态。",
        audience: "担心把示例或不完整证据当成结论的用户",
        duration: "约 6 分钟",
        readonly: true,
        artifacts: "限制清单和专业详情链接",
        sideEffects: "说明卡只读；不会改变 run、artifact 或 Evidence selection",
        kind: "task",
      },
    ],
  },
  {
    id: "example",
    title: "示例",
    description: "通过预置场景熟悉界面和字段，不代表真实证据。",
    templates: [
      {
        id: "example-throughput",
        title: "示例：吞吐优先",
        summary: "查看一个带 example 标记的吞吐目标输入和展示方式。",
        audience: "希望先浏览完整流程的用户",
        duration: "约 3 分钟",
        readonly: true,
        artifacts: "预置输入和示例状态",
        sideEffects: "example 说明卡；不会创建运行、校准或真实结果",
        kind: "example",
        exampleLabel: "example · 不代表真实结果或校准证据",
      },
      {
        id: "example-latency",
        title: "示例：延迟优先",
        summary: "查看一个带 example 标记的延迟目标场景。",
        audience: "想比较不同目标表达方式的用户",
        duration: "约 3 分钟",
        readonly: true,
        artifacts: "预置输入和限制说明",
        sideEffects: "example 说明卡；不会创建运行、校准或真实结果",
        kind: "example",
        exampleLabel: "example · 不代表真实结果或校准证据",
      },
    ],
  },
] as const;

export function findLightweightTaskTemplate(templateId: string): LightweightTaskTemplate | null {
  for (const category of LIGHTWEIGHT_TASK_CATEGORIES) {
    const template = category.templates.find((item) => item.id === templateId);
    if (template) return template;
  }
  return null;
}
