import { defineGuide } from "../schema";

export const fabricGuide = defineGuide({
  id: "fabric",
  title: "这里回答“通信是否在排队”",
  description: "先看后端报告的主要通信瓶颈，再比较网络域和请求贡献；拓扑与契约按需展开。",
  takeaway: "主导域、排队等待和拥塞等待都来自后端证据，前端不会猜测网络原因。",
  steps: [
    {
      id: "summary",
      title: "先看总体通信状态",
      body: "资源占用、最长等待和通信范围数量用于判断是否值得继续深入。",
      anchor: "fabric-summary",
    },
    {
      id: "hotspot",
      title: "阅读当前主要通信瓶颈",
      body: "主导域和主导延迟类型是后端明确报告的重点；缺失时页面不会补造。",
      anchor: "fabric-hotspot",
    },
    {
      id: "domains",
      title: "比较通信范围",
      body: "按相同单位比较各网络域的占用和等待，并把 not covered 与实际零等待分开。",
      anchor: "fabric-domains",
    },
    {
      id: "requests",
      title: "查看请求贡献",
      body: "需要定位尾部请求时再查看 request contribution，并沿证据链接返回原始字段。",
      anchor: "fabric-requests",
    },
  ],
  terms: [
    { id: "backpressure", term: "背压", definition: "下游资源忙时，上游传输被迫等待的现象。" },
    { id: "queue", term: "排队等待", definition: "请求已经到达通信资源，但尚未开始服务的等待。" },
    { id: "congestion", term: "拥塞等待", definition: "多条通信竞争有限链路或缓冲区造成的额外等待。" },
  ],
  next: { label: "下一步：查看慢请求原因", routeName: "attribution" },
  advanced: {
    title: "最后再看拓扑与契约",
    body: "审计时再展开逐域 topology、Schema identity、SHA-256 和 Pointer；S6 结果不能扩写成未执行的 S1/S3/S4/S5 原因。",
  },
});
