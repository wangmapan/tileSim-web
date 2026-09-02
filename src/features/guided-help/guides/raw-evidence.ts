import { defineGuide } from "../schema";

export const rawEvidenceGuide = defineGuide({
  id: "raw_evidence",
  title: "原始证据查看器用于复核，不是阅读结果的第一步",
  description: "先在普通页面找到结论，再用 artifact、搜索和 JSON Pointer 回到完整原始字段。",
  takeaway: "查看器不会改写、截断复制内容或把 uint64 ps/bytes/count 转成有损 JavaScript number。",
  steps: [
    {
      id: "open",
      title: "展开完整 JSON 证据",
      body: "只有需要审计或排查时再加载；未展开时不会占用主页面阅读空间。",
      anchor: "raw_evidence-open",
    },
    {
      id: "artifact",
      title: "选择正确的 artifact",
      body: "根据页面证据链接提供的 artifact ID 选择文件，并确认它属于当前 run 的可信清单。",
      anchor: "raw_evidence-artifact",
    },
    {
      id: "pointer",
      title: "搜索或定位 JSON Pointer",
      body: "Pointer 指向精确字段；搜索仅高亮匹配行，不改变完整 JSON。",
      anchor: "raw_evidence-search",
    },
    {
      id: "verify",
      title: "核对身份后再引用",
      body: "确认 run、Schema identity、artifact SHA-256 与 Pointer 一致，再把原始字段用于审计。",
      anchor: "raw_evidence-verify",
    },
  ],
  terms: [
    { id: "artifact", term: "artifact", definition: "一次运行产出的已登记输入或报告文件。" },
    { id: "pointer", term: "JSON Pointer", definition: "按照 RFC 6901 标识 JSON 文档中精确字段的位置。" },
    { id: "sha", term: "SHA-256", definition: "用于核对文件 bytes 是否与可信清单完全一致的摘要。" },
  ],
  next: { label: "下一步：核对结果可信度", routeName: "validation" },
  advanced: {
    title: "最后再看完整身份链",
    body: "只有复现与契约审计需要同时核对 backend identity、schema-set revision、Schema identity、artifact SHA-256、Pointer 与原始 bytes。",
  },
});
