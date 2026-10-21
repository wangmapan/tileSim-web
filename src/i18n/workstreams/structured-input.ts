/**
 * Copy owned by the structured-input workstream.
 *
 * Covers the phase-4 structured input panel: advanced run policy, request table,
 * device inventory and topology links/module bindings.
 *
 * Field labels are deliberately plain language ("设备编号" rather than the raw
 * contract key `device_id`); the raw key stays available as a `title` tooltip so
 * a field can still be matched against a backend diagnostic Pointer.
 *
 * A few short generic keys ("行", "操作", "无", "未设置", "整数") are shared with
 * pre-existing call sites; their meanings are identical there, so no split is
 * needed. Keys already translated in `english-catalog.ts` (调度策略, KV 容量,
 * KV 准入水位, 未设置（省略字段）) are intentionally NOT repeated here.
 */
export const structuredInputEnglishCatalog: Readonly<Record<string, string>> = {
  查看说明: "View explanation",
  查看字段范围: "View field range",
  /* Configuration page hierarchy and concise labels. */
  工作负载: "Workload",
  运行策略: "Runtime policy",
  互联参数: "Fabric parameters",
  "用于历史记录和结果回溯。": "Used to identify the run in history and trace results.",
  以运行后的验证报告为准: "The post-run validation report is authoritative.",
  真实网络观测仅作为证据: "Real network observations are evidence only.",
  "先选输入方式，再调整需要的参数。": "Choose an input method, then adjust the parameters you need.",
  "需要配置请求、设备或拓扑时，打开完整输入。":
    "Open full input when you need to configure requests, devices or topology.",
  "完整输入已启用。上方参数会同步到对应的输入文档。":
    "Full input is enabled. Changes above are mirrored into the corresponding input documents.",
  "可选。需要自定义候选时再展开。": "Optional. Expand when you need custom candidates.",
  "留空使用内置候选。": "Leave blank to use the built-in candidates.",
  "必要时查看执行门槛与版本信息。": "Open when you need execution gates or version information.",
  可执行: "Runnable",
  兼容模式: "Compatibility mode",
  契约错误: "Contract error",
  "JSON 输入": "JSON input",
  不合并: "Not combined",
  外部清单: "External manifest",
  内置网络候选: "Built-in network candidates",
  设计空间候选: "Design-space candidates",
  "可选：tilesim.design_space.candidates.v1 或 v2": "Optional: tilesim.design_space.candidates.v1 or v2",
  "仅支持网络与通信参数；最终范围与执行预算由 Bridge 校验。":
    "Only network and communication parameters are supported; Bridge validates the final range and execution budget.",
  "运行时 Trace": "runtime Trace",
  运行时输入请求: "Runtime input requests",
  "加载模板或粘贴运行时 Trace": "Load a template or paste a runtime Trace",
  仅网络与通信: "Network and communication only",
  信用链路热点细化: "Credit-link hotspot refinement",
  "Hotspot Cycle": "Hotspot Cycle",
  实际执行的参数: "Executed parameters",
  "只有网络与通信参数参与当前候选执行；unresolved_not_executed 不是默认值，也不参与排名。":
    "Only network and communication parameters participate in this candidate; unresolved_not_executed is neither a default nor ranked.",
  工作负载输入: "Workload input",
  运行时: "Runtime",
  执行语义: "Execution semantics",
  内存资源: "Memory resources",
  设备计算: "Device compute",
  集合通信: "Collective communication",
  网络执行: "Network execution",
  "内存、设备与集合通信": "Memory, device, and collective communication",
  统一仿真执行: "Unified simulation execution",
  "校准、验证与归因输出": "Calibration, validation, and attribution output",
  等待本地服务: "Waiting for local service",
  连接本地服务后可运行: "Connect the local service to run",
  /* Quick-control tab: entry point, channel note, empty-document hint. */
  "用表单配置全部输入 →": "Configure all inputs with forms →",
  "导入拓扑 JSON": "Import topology JSON",
  整数: "integer",
  "每个请求 / 显卡数量 / 拓扑连线": "Per-request / device count / topology links",
  "旋钮只有 {count} 个参数，装不下请求表和设备清单；这三样只能走 custom_inputs，启用后本次提交改用它。":
    "The knobs cover only {count} parameters, which cannot carry a request table or a device list; those three only travel on custom_inputs. This submission switches to that channel once enabled.",
  "停用，回到只用旋钮": "Turn off and go back to knobs only",
  "本次提交方式：结构化输入（custom_inputs）。上方旋钮改的参数会同步写入 policy，Fabric 参数写入 module_bindings。":
    "This submission uses structured input (custom_inputs). Knobs edited above are mirrored into policy, and Fabric parameters into module_bindings.",
  "已停用结构化编辑，本次提交改回 overrides。": "Structured editing is off; this submission goes back to overrides.",
  "runtime trace 还是空的。请先点「用表单配置全部输入」载入场景模板，或到「JSON 输入」页签粘贴内容。":
    "The runtime trace is still empty. Click “Configure all inputs with forms” to load a scenario template, or paste content in the JSON input tab.",

  /* R3: a changed device inventory versus the request table's participants. */
  "设备清单已变化，但 runtime trace 还是空的：加载模板后再决定请求表里的参与设备怎么办。":
    "The device inventory changed, but the runtime trace is still empty: load a template before deciding what to do with the request table's participants.",
  "设备清单现在是 {count} 张卡。只加卡而不改请求不会改变结果，请选择如何处理请求表：":
    "The device inventory now has {count} cards. Adding cards without changing requests would change nothing; choose how to handle the request table:",
  "① 把每条请求的参与设备改成新集合": "① Rewrite each request's participants to the new set",
  "② 清空参与设备，保留并行卡数": "② Clear participants and keep the parallel degree",
  "① 同步 TP 与参与设备到新集合": "① Synchronize TP and participants to the new set",
  "② 保留原 TP，按新集合选择参与设备": "② Keep the existing TP and select participants from the new set",
  "③ 清空参与设备，保留并行卡数": "③ Clear participants and keep the parallel degree",
  稍后再说: "Decide later",
  "已把 {count} 条请求的 TP 与参与设备同步到 {devices}。请继续核对 domains 和 links。":
    "Synchronized TP and participants for {count} requests to {devices}. Continue checking domains and links.",
  "已按原 TP 为 {count} 条请求选择参与设备。请确认每条请求的 TP/participants 与拓扑一致。":
    "Selected participants for {count} requests using the existing TP. Confirm each request's TP/participants match the topology.",
  "已把 {count} 条请求的参与设备改成 {devices}。并行卡数不会跟着变，请自行核对。":
    "Rewrote the participants of {count} requests to {devices}. The parallel degree did not follow, so verify it yourself.",
  "已清空 {count} 条请求的参与设备；其中 {missing} 条没填并行卡数，需要补上。":
    "Cleared the participants of {count} requests; {missing} of them have no parallel degree and need one.",

  /* Advanced run policy: only the runtime_trace.policy keys the knobs cannot reach. */
  进阶运行策略: "Advanced run policy",
  "只放旋钮管不到的 {count} 个参数；浅色数字是后端缺省值，不写入输入 JSON。填写后覆盖，清空则恢复缺省值。":
    "Only the {count} parameters the knobs cannot reach. Faint numbers are backend defaults, not written to input JSON. Enter a value to override; clear it to restore the default.",
  "后端默认 {value}（未写入）": "Backend default {value} (not written)",
  "后端默认 {value}（省略字段）": "Backend default {value} (field omitted)",
  "runtime trace 缺少 policy 对象，运行策略暂不可编辑。":
    "The runtime trace has no policy object, so the run policy cannot be edited yet.",
  "runtime trace 缺少 policy 对象。": "The runtime trace has no policy object.",
  收起进阶参数: "Collapse advanced parameters",
  "展开进阶参数（{count} 项）": "Expand advanced parameters ({count})",
  "{field} 超出契约范围：{hint}": "{field} is outside the contract range: {hint}",

  /* Run policy field labels (runtime_trace.policy keys). */
  批大小上限: "Max batch size",
  并发请求上限: "Max active requests",
  "开局 KV 占用": "Initial KV tokens",
  长上下文阈值: "Long-context threshold",
  每档解码减速: "Decode penalty per threshold",
  "prefill 饿死阈值": "Prefill starvation threshold",
  "PD 交接延迟": "PD handoff delay",
  "PD 交接队列服务时间": "PD handoff queue service time",
  "KV 页大小": "KV page size",
  "KV 碎片开销": "KV fragmentation overhead",
  "Fabric 反压开关": "Fabric backpressure switch",
  "Fabric 反压延迟": "Fabric backpressure delay",
  "Fabric 反压节流阈值": "Fabric backpressure throttle threshold",
  "Fabric 反压 prefill 批上限": "Fabric backpressure prefill batch limit",

  /* Request table. */
  请求表: "Request table",
  请求编号: "Request number",
  模型标识: "Model identity",
  到达时间: "Arrival time",
  阶段: "Phase",
  "输入 token 数": "Prompt tokens",
  "输出 token 数": "Decode tokens",
  "KV token 数": "KV tokens",
  优先级: "Priority",
  并行卡数: "Parallel degree",
  参与设备: "Participating devices",
  集合通信类型: "Collective type",
  通信字节数: "Message bytes",
  放置组: "Placement group",
  分离组: "Disaggregation group",
  "KV 交接编号": "KV handoff ID",
  仿真模型标识: "Simulation model identity",
  未填写: "Not filled",
  "模型标识用于请求分组和结果关联；它不是模型结构配置。当前结构化输入不会根据名称自动补齐层数、hidden size 等参数。":
    "The model identity groups requests and links results; it is not a model-shape configuration. The structured input does not infer layers, hidden size, or similar parameters from the name.",
  "可填写任意仿真模型标识，例如 llama3-8b": "Enter any simulation model identity, for example llama3-8b",
  "共 {count} 行，契约允许 {min} ~ {max} 行。": "{count} rows; the contract allows {min} to {max}.",
  "契约允许 {min} ~ {max} 行。": "The contract allows {min} to {max} rows.",
  添加请求行: "Add request row",
  "runtime trace 缺少 requests 数组，请求表暂不可编辑。":
    "The runtime trace has no requests array, so the request table cannot be edited yet.",
  "请求表（可横向滚动）": "Request table (horizontally scrollable)",
  "复制第 {row} 行": "Duplicate row {row}",
  "删除第 {row} 行": "Delete row {row}",
  "留空＝不写这个字段，由引擎按并行卡数挑设备":
    "Leave blank to omit this field; the engine then picks devices by the parallel degree",
  "这 {count} 个字段表格里没有控件，提交时会原样保留：{fields}":
    "These {count} fields have no control in the table and are preserved verbatim on submit: {fields}",
  行: "Row",
  操作: "Actions",
  未设置: "Not set",
  "自动按 TP 选择": "Choose automatically by TP",
  点击选择: "Click to choose",

  /* Device inventory. */
  设备清单: "Device inventory",
  设备编号: "Device number",
  设备类型: "Device type",
  分组编号: "Group number",
  "最多 {max} 台。新增设备按 gpu0、gpu1 的顺序命名，自动跳过重名。":
    "Up to {max}. New devices are named gpu0, gpu1, … in order, skipping duplicates.",
  卡数: "Card count",
  "topology JSON 缺少 devices 数组，设备清单暂不可编辑。":
    "The topology JSON has no devices array, so the device inventory cannot be edited yet.",
  "当前没有设备。把「卡数」改为大于 0 即可新增。": "There are no devices. Set Card count above 0 to add some.",
  "契约里还有 {count} 个非字符串设备字段没有控件，请直接在原始 JSON 里编辑：{fields}":
    "{count} non-string device fields in the contract have no control; edit them directly in the raw JSON: {fields}",
  "卡数必须是整数。": "Card count must be an integer.",
  "卡数必须是非负整数。": "Card count must be a non-negative integer.",
  无: "None",
  "卡数减少，已删除 {removed}，并清理了引用：{cleaned}":
    "Card count decreased; removed {removed} and cleaned up references: {cleaned}",
  "device_id 不能为空。": "device_id must not be empty.",
  "设备编号不能为空。": "A device number must not be empty.",
  "已把 {from} 改名为 {to}，并同步更新了 domains 与 links 中的引用。":
    "Renamed {from} to {to} and updated the references in domains and links.",
  "删除 {device} 时它仍被引用（{refs}），已一并从 domains 与 links 中移除。":
    "{device} was still referenced ({refs}) when deleted; those references were also removed from domains and links.",
  "已删除 {device}。": "Deleted {device}.",
  "删除设备 {device}": "Delete device {device}",
  "topology JSON 缺少 topology 对象。": "The topology JSON has no topology object.",

  /* Module binding parameters and topology link diagnostics. */
  模块绑定参数: "Module binding parameters",
  新增模型: "Add module",
  模型名: "Module name",
  类型: "Type",
  版本: "Version",
  配置档: "Config profile",
  "每行一个网络模型（module_bindings）；域必须绑定其中一个，所以这里空着就没法新增域。最多 {max} 个。":
    "One network model per row (module_bindings); every domain must bind one, so domains cannot be added while this list is empty. Up to {max}.",
  "还没有网络模型。点「新增模型」加一条，再把它绑给需要的域。":
    "No network model yet. Click Add module to add one, then bind it to the domains that need it.",
  "以下几项写进 module_bindings[].override_params；留空表示省略该键。":
    "The fields below are written to module_bindings[].override_params; leave blank to omit the key.",
  "已新增模型 {name}（机内高速互联）。名字只是占位符，请改成你实际要用的模块名。":
    "Added model {name} (intra-node interconnect). The name is only a placeholder — replace it with the module you actually use.",
  "已把模型 {from} 改名为 {to}，并同步更新了 {count} 个域的绑定。":
    "Renamed model {from} to {to} and updated the binding of {count} domains.",
  "已把模型 {from} 改名为 {to}。": "Renamed model {from} to {to}.",
  "模型 {name} 的类型已改为 {kind}，但域 {domains} 的类型对不上，请核对。":
    "Model {name} is now {kind}, but domain(s) {domains} disagree; please double-check.",
  "模型 {name} 的类型已改为 {kind}。": "Model {name} is now {kind}.",
  "已删除模型 {name}。": "Deleted model {name}.",
  "删除模型 {name}": "Delete model {name}",
  "无法连接：请先定义至少一个 domain。": "Cannot connect: define at least one domain first.",
  "无法连接：请先在连接模式中明确选择 domain。": "Cannot connect: choose a domain explicitly in connection mode first.",
  所属域: "Domain",
  默认保真度: "Default fidelity",
  失败策略: "Failure policy",
  Analytical: "Analytical",
  DES: "DES",
  允许降级: "Allow fallback",
  拒绝运行: "Fail closed",
  "带宽（Gbps）": "Bandwidth (Gbps)",
  "延迟（us）": "Latency (us)",
  队列系数: "Queue factor",
  超额订阅系数: "Oversubscription factor",

  /* Domain list and the one-at-a-time device entry. */
  新增设备: "Add device",
  "已新增设备 {device}，设备类型默认 GPU；记得把它勾进需要的域。":
    "Added device {device} with device type GPU; remember to tick it into the domains it belongs to.",
  域清单: "Domain list",
  新增域: "Add domain",
  域名: "Domain name",
  域类型: "Domain type",
  所用网络模型: "Network model",
  "机内高速互联（scale_up）": "Intra-node interconnect (scale_up)",
  "跨机网络（scale_out）": "Inter-node network (scale_out)",
  "最多 {max} 个域。域就是「一批卡共用的同一套网络」；新增域自动命名 su0、so0，并绑定一个已存在的网络模型。":
    "Up to {max} domains. A domain is one network shared by a group of cards; new domains are named su0, so0, … and bound to an existing network model.",
  "topology JSON 缺少 domains 数组，域清单暂不可编辑。":
    "The topology JSON has no domains array, so the domain list cannot be edited yet.",
  "当前没有域。点「新增域」创建第一个，再勾选它包含哪些卡。":
    "There are no domains. Click Add domain to create the first one, then tick the cards it contains.",
  "域的数量不能超过 {max} 个。": "The number of domains cannot exceed {max}.",
  "topology 里还没有 module_bindings：新增域必须绑定一个网络模型，请先在「模块绑定参数」里补一个，或在原始 JSON 里补一条 module_bindings。":
    "The topology has no module_bindings yet: a new domain must bind a network model, so add one under Module binding parameters first, or add a module_bindings entry in the raw JSON.",
  "已新增域 {domain}（{type}），绑定网络模型 {module}。成员设备还是空的，勾选要加入的卡。":
    "Added domain {domain} ({type}) bound to network model {module}. Its member list is empty — tick the cards it contains.",
  "域名不能为空。": "A domain name must not be empty.",
  "已把域 {from} 改名为 {to}，并同步更新了 links 里的 domain_id。":
    "Renamed domain {from} to {to} and updated domain_id in links.",
  "域 {domain} 的类型已改为 {type}。": "Domain {domain} is now of type {type}.",
  "域 {domain} 现在是 {type}，但它绑定的模型 {module} 属于 {kind}：两边对不上，请核对「模块绑定参数」。":
    "Domain {domain} is now {type}, but its bound model {module} is {kind}: the two disagree, check Module binding parameters.",
  "域 {domain} 现在绑定网络模型 {module}。": "Domain {domain} now binds network model {module}.",
  "域 {domain} 现在绑定模型 {module}（{kind}），和它的域类型 {type} 对不上，请核对。":
    "Domain {domain} now binds model {module} ({kind}), which disagrees with its domain type {type}; please double-check.",
  "已删除域 {domain}，它下面的 {count} 条连接也一并删除。":
    "Deleted domain {domain}; its {count} links were deleted as well.",
  "已删除域 {domain}。": "Deleted domain {domain}.",
  "删除域 {domain}": "Delete domain {domain}",
  "已选 {selected} / 共 {total} 张卡": "{selected} of {total} cards selected",
  "还没有设备，先在「设备清单」里加卡。": "No devices yet; add cards in Device inventory first.",
  "这个域是 {type}，但绑定的模型 {module} 属于 {kind}，两边对不上，请核对「模块绑定参数」。":
    "This domain is {type}, but its bound model {module} is {kind}; the two disagree, check Module binding parameters.",
  "这个域还没有成员设备：它不会承载任何通信。": "This domain has no member devices, so it carries no traffic.",
  "契约里还有 {count} 个可选域字段没有控件（留空即省略），要改请直接在原始 JSON 里编辑：{fields}":
    "{count} optional domain fields in the contract have no control (blank means omitted); edit them directly in the raw JSON: {fields}",
};
