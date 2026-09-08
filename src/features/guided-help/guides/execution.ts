import { defineGuide } from "../schema";

export const executionGuide = defineGuide({
  id: "execution",
  title: "执行过程",
  description: "查看请求、运行时、执行语义、资源操作与网络活动在统一仿真时间轴上的组织及对应报告。",
  takeaway:
    "KV Cache、设备性能和集合通信是并列资源语义。仿真执行与控制平面管理时间和状态推进，不是第六个目标系统层，也不是延迟因果来源。",
  steps: [
    {
      id: "flow",
      title: "执行结构",
      body: "工作负载与请求进入推理引擎和服务运行时，由执行语义建模形成执行片段，再关联 KV Cache、设备和集合通信等资源操作。通信需求汇入网络与硬件资源模型。",
      anchor: "execution-flow",
    },
    {
      id: "select",
      title: "环节选择",
      body: "选择执行结构中的环节，可查看当前运行已报告的指标、记录与可视化。不同环节的可用字段取决于报告覆盖范围。",
      anchor: "execution-flow",
    },
    {
      id: "detail",
      title: "指标与执行记录",
      body: "摘要指标用于定位等待和通信开销；结构化记录提供时间、稳定标识与依赖关系。网络完成或反压可通过资源操作与执行依赖影响运行时推进和请求指标。",
      anchor: "execution-detail",
    },
    {
      id: "host",
      title: "仿真执行与控制平面",
      body: "执行详情记录统一时间轴上的状态推进。Analytical、DES、Cycle 是精度后端，不是业务层；Tile 是建模粒度，不是独立系统层或生命周期对象。",
      anchor: "execution-host",
    },
  ],
  terms: [
    {
      id: "kv",
      term: "KV Cache",
      definition: "保存注意力计算所需的键值状态。物理块、驻留和数据就绪属于资源语义。",
    },
    {
      id: "collective",
      term: "集合通信",
      definition: "多个设备参与的归约、广播等通信语义，与缓存及设备性能建模并列。",
    },
    {
      id: "host",
      term: "仿真执行与控制平面",
      definition: "管理统一时间轴、状态提交、等待与反馈以及精度后端。",
    },
  ],
  next: {
    label: "性能指标",
    routeName: "metrics",
  },
  advanced: {
    title: "原始记录与复核",
    body: "复核执行记录时核对 Schema、字段来源、SHA-256 和 JSON Pointer。关联记录只支持其已声明的证据范围，不自动构成真实系统执行轨迹。",
  },
});
