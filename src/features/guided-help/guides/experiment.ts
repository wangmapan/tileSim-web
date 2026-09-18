import { defineGuide } from "../schema";

export const experimentGuide = defineGuide({
  id: "experiment",
  title: "新建实验",
  description: "配置工作负载、Trace package、运行时和网络参数，检查仿真能力与请求预览后提交实验。",
  takeaway: "输入来源与仿真精度是独立维度。合成轨迹和兼容性辅助轨迹不能因采用更高精度后端而升级为真实测量证据。",
  steps: [
    {
      id: "identity",
      title: "实验名称与场景",
      body: "实验名称用于运行记录中的识别。场景决定可配置字段、默认值和适用条件；切换场景后应重新检查参数预览。",
      anchor: "experiment-identity",
    },
    {
      id: "inputs",
      title: "输入与 Trace package",
      body: "输入包括工作负载、运行时和网络配置。使用 Trace package 时，应核对来源模式、校准级别、观测与推断字段以及允许声明范围。网络流轨迹描述通信需求，不代表模拟网络已经执行的路径或拥塞状态。",
      anchor: "experiment-inputs",
    },
    {
      id: "fidelity",
      title: "仿真精度与能力",
      body: "requested fidelity 表示请求精度，resolved fidelity 表示实际采用的精度。Analytical、DES、Cycle 的可用范围以服务能力和各环节的执行配置为准。",
      anchor: "experiment-capabilities",
    },
    {
      id: "preview",
      title: "预览、校验与提交",
      body: "提交前核对必填字段、单位、输入来源及实际执行范围。校验错误指向对应字段；帮助文档不会修改参数、补全缺失证据或代为提交实验。",
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
  next: {
    label: "运行概览",
    routeName: "overview",
  },
  advanced: {
    title: "原始记录与复核",
    body: "字段契约中的 field_id、JSON Pointer、Schema identity 和 capability 用于复现请求及排查校验问题。保留提交时的配置和输入身份。",
  },
});
