import { defineGuide } from "../schema";

export const executionGuide = defineGuide({
  id: "execution",
  title: "这里展示一次请求经过了哪些环节",
  description: "从输入、调度和执行计划，进入并列资源语义，再汇合到网络；专业记录按需展开。",
  takeaway: "S3、S4、S5 是并列资源环节；S7 只负责把执行放在同一时间轴上。",
  steps: [
    {
      id: "flow",
      title: "从左到右阅读执行路线",
      body: "先看 S0 → S1 → S2，再看并列的 S3/S4/S5，最后看 S6；不要把三个资源环节读成顺序链。",
      anchor: "execution-flow",
    },
    {
      id: "select",
      title: "点击一个环节",
      body: "选择节点后，下方只显示该环节在当前运行中的指标、状态和可视化。",
      anchor: "execution-selection",
    },
    {
      id: "detail",
      title: "先读指标，再看记录",
      body: "先读已报告的关键指标；结构化记录和字段边界只在需要追踪时展开。",
      anchor: "execution-detail",
    },
    {
      id: "host",
      title: "按需查看 S7 执行宿主",
      body: "S7 记录各环节在统一模拟时间轴上的开始和结束，不是新的业务层，也不进入延迟因果排名。",
      anchor: "execution-host",
    },
  ],
  terms: [
    { id: "kv", term: "KV 缓存（S3）", definition: "保存生成过程中注意力所需的键值状态，属于内存语义。" },
    { id: "collective", term: "集合通信（S5）", definition: "多个设备协同完成的广播、归约等通信语义。" },
    { id: "host", term: "执行宿主（S7）", definition: "让多个子系统共享同一模拟时间轴的执行环境。" },
  ],
  next: { label: "下一步：查看性能指标", routeName: "metrics" },
  advanced: {
    title: "最后再看实现证据",
    body: "只有审计时才需要 Schema、字段来源、SHA-256、Pointer、结构化记录和完整 JSON；帮助层不会把关联证据升级成 canonical trace。",
  },
});
