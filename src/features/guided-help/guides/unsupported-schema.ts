import { defineGuide } from "../schema";

export const unsupportedSchemaGuide = defineGuide({
  id: "unsupported_schema",
  title: "报告兼容性",
  description: "说明未知或不支持的报告结构如何处理，以及如何保留身份和原始证据用于后续复核。",
  takeaway:
    "不支持的 Schema 是兼容性边界，不等于无数据、数值零或运行失败。无法验证结构时停止语义解释，但保留原始证据。",
  steps: [
    {
      id: "notice",
      title: "兼容性状态",
      body: "未知 Schema、字段校验失败和工件被拒绝有不同原因。页面不会套用旧结构猜测新字段，也不会将未知结构渲染成正常空状态。",
      anchor: "unsupported_schema-notice",
    },
    {
      id: "identity",
      title: "报告身份",
      body: "保留受影响的报告类型、Schema identity 和具体问题位置，便于在受支持适配器更新后重新核查。",
      anchor: "unsupported_schema-identities",
    },
    {
      id: "raw",
      title: "原始数据保留",
      body: "原始查看器保留字段内容，但不将未知字段解释为当前页面指标。原始数据可见不代表该结构已经受支持。",
      anchor: "unsupported_schema-raw",
    },
    {
      id: "next",
      title: "兼容性处理",
      body: "可以查看其他受支持的运行，或通过正式版本化适配器处理该报告。不要降低 Schema 标识或修改字段绕过校验。",
      anchor: "unsupported_schema-next",
    },
  ],
  terms: [
    {
      id: "schema",
      term: "Schema identity",
      definition: "标识报告结构和字段语义的版本化身份。",
    },
    {
      id: "adapter",
      term: "versioned adapter",
      definition: "把已知报告版本安全转换成稳定页面模型的适配器。",
    },
    {
      id: "fail-closed",
      term: "失败关闭",
      definition: "无法验证结构时停止解释，但保留原始证据。",
    },
  ],
  next: {
    label: "运行记录",
    routeName: "history",
  },
  advanced: {
    title: "原始记录与复核",
    body: "兼容性复核需要 Schema、backend identity、schema-set revision、工件 SHA-256、JSON Pointer 与原始字节。修复应发生在明确的适配契约中，而不是帮助层。",
  },
});
