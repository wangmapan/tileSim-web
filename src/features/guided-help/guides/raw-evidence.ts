import { defineGuide } from "../schema";

export const rawEvidenceGuide = defineGuide({
  id: "raw_evidence",
  title: "原始证据",
  description: "查看已登记工件的完整 JSON，通过搜索、字段定位和身份核对复核页面结论。",
  takeaway:
    "查看器保留完整原始数据和复制内容。uint64 ps、bytes、count 不转换为有损 JavaScript number；搜索和定位不会改写字段。",
  steps: [
    {
      id: "open",
      title: "加载原始报告",
      body: "展开原始证据区域后加载对应工件。未加载、不可用、身份不匹配和内容为空是不同状态，应依据具体提示处理。",
      anchor: "raw_evidence-open",
    },
    {
      id: "artifact",
      title: "工件选择",
      body: "工件必须属于当前运行的可信清单。由页面证据链接进入时，核对 artifact ID 与当前选择，避免将其他运行的同名文件用于引用。",
      anchor: "raw_evidence-artifact",
    },
    {
      id: "pointer",
      title: "搜索与字段定位",
      body: "JSON Pointer 定位精确字段，搜索标出匹配行。不存在的 Pointer 应保留为定位错误，不能改用相近字段代替。",
      anchor: "raw_evidence-search",
    },
    {
      id: "verify",
      title: "引用身份",
      body: "引用前核对 run、Schema identity、SHA-256 与 JSON Pointer。复制或导出的原始内容保持完整，不以可视区域的行数截断。",
      anchor: "raw_evidence-verify",
    },
  ],
  terms: [
    {
      id: "artifact",
      term: "artifact",
      definition: "一次运行产出的已登记输入或报告文件。",
    },
    {
      id: "pointer",
      term: "JSON Pointer",
      definition: "按照 RFC 6901 标识 JSON 文档中精确字段的位置。",
    },
    {
      id: "sha",
      term: "SHA-256",
      definition: "用于核对文件 bytes 是否与可信清单完全一致的摘要。",
    },
  ],
  next: {
    label: "结果可信度",
    routeName: "validation",
  },
  advanced: {
    title: "原始记录与复核",
    body: "完整身份链包括 backend identity、schema-set revision、Schema identity、工件 SHA-256、JSON Pointer 与原始字节。摘要匹配仅证明文件身份，不等于内容结论已经验证。",
  },
});
