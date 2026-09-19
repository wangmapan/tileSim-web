/**
 * Copy owned by the topology-editor workstream.
 *
 * Technical field names, IDs and backend diagnostics stay unchanged; these
 * entries cover the editor chrome and accessibility labels only.
 */
export const topologyEditorEnglishCatalog: Readonly<Record<string, string>> = {
  网络拓扑可视化编辑器: "Network topology visual editor",
  网络拓扑: "Network topology",
  "拖动节点调整布局；开启连接后，从一个设备拖到另一个设备即可写入 links。":
    "Drag nodes to adjust layout; enable connection mode to create links between devices.",
  连接设备: "Connect devices",
  退出连接: "Exit connection mode",
  "连接 domain": "Connection domain",
  "选择连接 domain": "Choose connection domain",
  请选择: "Choose one",
  "输入合法拓扑 JSON 后，这里会显示设备与连接。":
    "Devices and connections appear here after valid topology JSON is entered.",
  设备连接图: "Device connection graph",
  域成员关系: "Domain membership",
  "域 {id}，{type}，{count} 个成员设备": "Domain {id}, {type}, {count} member devices",
  "设备 {label}": "Device {label}",
  "{count} 个设备": "{count} devices",
  "连接 {src} 与 {dst}，domain {domain}": "Connection between {src} and {dst}, domain {domain}",
  拓扑图例: "Topology legend",
  "实线：显式连接（links）": "Solid: explicit connections (links)",
  "虚线：domain 成员关系（仅展示）": "Dashed: domain membership (display only)",
  "{devices} 个设备 · {domains} 个 domain · {links} 条显式连接":
    "{devices} devices · {domains} domains · {links} explicit connections",
  "当前没有显式 links；图中的虚线只表达设备属于哪个 domain，不会写入 links。开启“连接设备”后，可拖拽两个设备创建连接。":
    "There are no explicit links. Dashed lines show domain membership only and are not written to links. Enable “Connect devices” to create a connection between two devices.",
  连接属性: "Connection properties",
  关闭连接属性: "Close connection properties",
  删除连接: "Delete connection",
  拓扑域: "Topology domains",
  "{id} · {type} · {count} 个设备": "{id} · {type} · {count} devices",
  "后端指出拓扑字段：{path}": "The backend identified a topology field: {path}",
  "布局坐标仅存在于本次编辑，不会写入提交 JSON。边属性保持缺失与 0 的原始语义。":
    "Layout coordinates exist only in this editing session and are not written to the submitted JSON. Edge properties preserve the original missing-versus-zero semantics.",
  "Fabric topology JSON": "Fabric topology JSON",
};
