import { defineGuide } from "../schema";

export const unsupportedSchemaGuide = defineGuide({
  id: "unsupported_schema",
  title: "这个报告版本暂时不能安全地结构化展示",
  description: "原始字段仍然保留；页面不会把未知结构显示成空值，也不会套用旧 Schema 猜测含义。",
  takeaway: "Unsupported Schema 是兼容性边界，不等于没有数据、数值为 0 或运行失败。",
  steps: [
    {
      id: "notice",
      title: "先读阻断原因",
      body: "确认是未知 Schema、校验失败还是 Bridge 主动拒绝 artifact；这些状态含义不同。",
      anchor: "unsupported_schema-notice",
    },
    {
      id: "identity",
      title: "记录受影响的报告身份",
      body: "保存报告类型、Schema identity 和精确 issue，便于 adapter 或契约更新后复核。",
      anchor: "unsupported_schema-identities",
    },
    {
      id: "raw",
      title: "按需查看原始 JSON",
      body: "原始查看器只显示完整字段，不会把未知字段解释成现有指标。",
      anchor: "unsupported_schema-raw",
    },
    {
      id: "next",
      title: "选择安全的下一步",
      body: "可以打开其他已支持运行，或等待 versioned adapter 更新；不要通过降级 Schema 绕过失败关闭。",
      anchor: "unsupported_schema-next",
    },
  ],
  terms: [
    { id: "schema", term: "Schema identity", definition: "标识报告结构和字段语义的版本化身份。" },
    { id: "adapter", term: "versioned adapter", definition: "把已知报告版本安全转换成稳定页面模型的适配器。" },
    { id: "fail-closed", term: "失败关闭", definition: "无法验证结构时停止解释，但保留原始证据。" },
  ],
  next: { label: "下一步：打开运行记录", routeName: "history" },
  advanced: {
    title: "最后再核对完整契约",
    body: "修复兼容性时再核对 Schema、backend identity、schema-set revision、artifact SHA-256、Pointer 和原始 bytes。",
  },
});
