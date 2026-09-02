import { defineGuide } from "../schema";

export const experimentGuide = defineGuide({
  id: "experiment",
  title: "先从一个可复现的小实验开始",
  description: "按顺序填写必需参数，确认预览后再运行；不确定时可以保留默认值。",
  takeaway: "先确认数据来源、请求精度和最终可用精度，再提交实验。",
  steps: [
    {
      id: "identity",
      title: "给实验命名并选择场景",
      body: "名称用于稍后在运行记录中查找；场景决定可用字段和默认值。",
      anchor: "experiment-identity",
    },
    {
      id: "inputs",
      title: "按顺序检查输入",
      body: "先确认工作负载和 trace 来源，再检查运行时与网络配置；不熟悉的字段可以保留 descriptor 提供的默认值。",
      anchor: "experiment-inputs",
    },
    {
      id: "fidelity",
      title: "分开看请求精度和最终精度",
      body: "requested fidelity 是你提出的目标，resolved fidelity 是各环节实际可执行的精度，两者可能不同。",
      anchor: "experiment-capabilities",
    },
    {
      id: "preview",
      title: "运行前核对预览",
      body: "确认必填项、适用性和输入来源无误后再运行；错误会指向稳定字段，而不是由帮助层改写请求。",
      anchor: "experiment-submit",
    },
  ],
  terms: [
    {
      id: "source-mode",
      term: "trace 来源",
      definition: "real_trace、synthetic_trace 与 compatibility_harness_trace 是不同来源，不能互相升级。",
    },
    {
      id: "fidelity",
      term: "Analytical / DES / Cycle",
      definition: "它们是仿真精度层级；Cycle 只适用于真实实现的热点细化，不代表全栈都达到周期级。",
    },
  ],
  next: { label: "下一步：运行完成后查看概览", routeName: "overview" },
  advanced: {
    title: "最后再看字段契约",
    body: "排查提交问题时再查看 field_id、request JSON Pointer、Schema identity 与 capability；这些信息不会改变 Provider 或 Bridge 行为。",
  },
});
