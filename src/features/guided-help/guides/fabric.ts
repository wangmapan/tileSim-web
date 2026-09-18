import { defineGuide } from "../schema";

export const fabricGuide = defineGuide({
  id: "fabric",
  title: "网络与通信",
  description: "分析网络域的利用率、排队与拥塞等待、请求贡献和已报告拓扑，定位通信相关瓶颈。",
  takeaway: "路径、队列和完成状态以网络执行报告为准。输入通信需求、模型推断与真实网络观测应保持独立标注。",
  steps: [
    {
      id: "summary",
      title: "通信摘要",
      body: "资源占用、等待时间和网络域覆盖情况提供运行层面的通信概况。未覆盖的网络域不应解释为没有流量或没有等待。",
      anchor: "fabric-summary",
    },
    {
      id: "hotspot",
      title: "主要瓶颈",
      body: "主导网络域和延迟类型来自后端报告。报告未给出原因时，页面保留缺失状态，不根据图表颜色或数值接近推断拥塞原因。",
      anchor: "fabric-hotspot",
    },
    {
      id: "domains",
      title: "网络域比较",
      body: "在统一单位下比较不同网络域的利用率、排队与拥塞等待。纵向扩展和横向扩展网络的范围及拓扑层级以当前配置为准。",
      anchor: "fabric-domains",
    },
    {
      id: "requests",
      title: "请求贡献与证据",
      body: "请求贡献用于关联通信开销与请求上下文。通过原始证据链接核对报告位置，再结合慢请求原因页面分析等待传播。",
      anchor: "fabric-requests",
    },
  ],
  terms: [
    {
      id: "backpressure",
      term: "反压",
      definition: "下游资源无法继续接收或服务时，对上游传输与执行产生的等待反馈。",
    },
    {
      id: "queue",
      term: "排队等待",
      definition: "请求已经到达通信资源，但尚未开始服务的等待。",
    },
    {
      id: "congestion",
      term: "拥塞等待",
      definition: "多条通信竞争有限链路或缓冲区造成的额外等待。",
    },
  ],
  next: {
    label: "慢请求原因",
    routeName: "attribution",
  },
  advanced: {
    title: "原始记录与复核",
    body: "拓扑和逐域记录提供 Schema identity、SHA-256 与 JSON Pointer。仅网络范围的结果不能扩写为未执行的运行时、缓存、设备或集合通信结论。",
  },
});
