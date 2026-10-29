import { defineGuide } from "../schema";

export const replayGuide = defineGuide({
  id: "replay",
  title: "执行回放",
  description: "按时间查看已报告的运行期事件、网络路径和集合通信步骤。",
  takeaway: "回放只播放后端已报告的证据，不从拓扑或汇总指标推断路径、步骤或数据包。",
  steps: [
    {
      id: "overview",
      title: "回放范围",
      body: "先确认运行身份、时间范围和证据覆盖状态；页面不会把缺失字段补成动画。",
      anchor: "replay-overview",
    },
    {
      id: "controls",
      title: "播放控制",
      body: "使用播放、暂停、逐步前进和慢放速度控制查看记录；减少动态效果时可改用按事件前进。",
      anchor: "replay-controls",
    },
    {
      id: "timeline",
      title: "时间轴与详情",
      body: "时间轴只排列已报告的阶段、事件和路径。选择任一条目后，右侧详情会定位到同一份证据。",
      anchor: "replay-timeline",
    },
    {
      id: "topology",
      title: "路径与集合通信",
      body: "拓扑高亮和集合步骤均来自后端 canonical 工件，不从拓扑连线推断实际路径，也不把聚合指标拆成伪事件。",
      anchor: "replay-evidence",
    },
  ],
  terms: [
    { id: "coverage", term: "证据覆盖", definition: "当前运行已报告并通过身份校验的回放字段范围。" },
    { id: "actual-path", term: "实际路径", definition: "后端 Fabric 工件明确报告的设备节点序列，不由前端拓扑推断。" },
    {
      id: "collective-step",
      term: "集合步骤",
      definition: "后端报告的 collective round/chunk 记录，保留原始步骤边界。",
    },
  ],
  next: { label: "执行过程", routeName: "execution" },
  advanced: {
    title: "原始记录与复核",
    body: "复核回放时核对 Schema identity、工件 SHA-256、JSON Pointer 和时间字段；缺失路径或步骤不会被前端生成。",
  },
});
