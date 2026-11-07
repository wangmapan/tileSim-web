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
  "查看 fidelity 说明": "View fidelity explanation",
  请求精度: "Requested fidelity",
  查看请求精度说明: "View requested fidelity explanation",
  运行数据: "Runtime data",
  "实际采用的精度仅从运行后的执行记录与验证报告读取。":
    "The actual fidelity is read only from the post-run execution record and validation report.",
  "查看 GPU 参与说明": "View GPU participation explanation",
  运行操作: "Run action",
  "标准推理运行（合成示例）": "Standard inference run (synthetic example)",
  "高密度离散事件模拟（仅导入 Trace 包）": "High-density discrete-event simulation (Trace package import only)",
  "预填充 / 解码分离运行（PD 示例）": "Prefill / Decode split run (PD example)",
  "先选输入方式，再调整需要的参数。": "Choose an input method, then adjust the parameters you need.",
  输入模块: "Input modules",
  "按模块切换，逐步完成工作负载、请求、拓扑与互联参数。":
    "Switch modules to configure workload, requests, topology, and fabric parameters step by step.",
  当前调整模块: "Current module",
  请求: "Requests",
  拓扑: "Topology",
  "请求行、模型与参与设备": "Request rows, models, and participating devices",
  "显卡、网络域与连线": "GPUs, network domains, and links",
  快捷参数: "Quick parameters",
  "快捷参数 + 进阶策略": "Quick parameters + advanced policy",
  含进阶策略: "Includes advanced policy",
  可编辑请求表: "Editable request table",
  可编辑拓扑: "Editable topology",
  需要检查: "Needs review",
  可直接调整: "Ready to adjust",
  结构化输入不可用: "Structured input unavailable",
  "当前契约不可用，结构化 custom_inputs 编辑已禁用。":
    "The current contract is unavailable; structured custom_inputs editing is disabled.",
  "当前实验契约不可用，结构化 custom_inputs 编辑已禁用。":
    "The current experiment contract is unavailable; structured custom_inputs editing is disabled.",
  "当前能力未发布 JSON 输入，结构化 custom_inputs 编辑已禁用。":
    "JSON input is not published by the current capability; structured custom_inputs editing is disabled.",
  "结构化输入已关闭；当前只提交快捷参数。": "Structured input is off; only quick parameters will be submitted.",
  "当前 schema revision 已变化，旧输入草稿未迁移；请重新加载模板或粘贴与当前 revision 匹配的 JSON。":
    "The schema revision changed; the old input draft was not migrated. Reload a template or paste JSON for the current revision.",
  "模板没有返回完整 runtime_trace 和 topology。": "The template did not return a complete runtime_trace and topology.",
  "runtime trace 还是空的。请先加载场景模板，或到 JSON 输入页签粘贴内容。":
    "The runtime trace is still empty. Load a scenario template first, or paste content in the JSON input tab.",
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
  后端可用模型: "Models available from the backend",
  "后端可用模型：{models}": "Models available from the backend: {models}",
  "用于关联请求结果，不代表模型结构。": "Links request results; it does not describe model structure.",
  "GPU 会参与请求；交换机等拓扑节点不会自动加入请求。":
    "GPUs participate in requests; topology nodes such as switches are not added to requests automatically.",
  "域用于分组节点并指定通信模型；最多 {max} 个。":
    "Domains group nodes and select a communication model; up to {max} are allowed.",
  "仅覆盖信用链路热点，不代表全栈 Cycle。": "Covers only credit-link hotspots; it does not represent full-stack Cycle.",
  "源码 revision 与 CLI build revision 必须一致。": "Source and CLI build revisions must match.",
  "源码变化后会关闭执行。": "Source changes disable execution.",
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
  "导入拓扑 JSON": "Import topology JSON",
  整数: "integer",
  "每个请求 / 显卡数量 / 拓扑连线": "Per-request / device count / topology links",
  "本次提交方式：结构化输入（custom_inputs）。上方旋钮改的参数会同步写入 policy，Fabric 参数写入 module_bindings。":
    "This submission uses structured input (custom_inputs). Knobs edited above are mirrored into policy, and Fabric parameters into module_bindings.",

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
  "并行卡数必须等于参与设备数量（当前为 {tp}，参与设备为 {count} 个）。":
    "Parallel card count must equal the participant count (currently {tp} versus {count} devices).",
  点击选择: "Click to choose",

  /* Device inventory. */
  设备清单: "Device inventory",
  设备编号: "Device number",
  设备类型: "Device type",
  分组编号: "Group number",
  计算组: "Compute group",
  "先给设备填写相同的计算组编号，画布会自动形成一个计算组。每张卡只有一个计算组；scale_up / scale_out 通信域在下面单独配置，不需要把一张卡拖进两个域。":
    "Give devices in one compute group the same group ID; the canvas groups them automatically. Each card has one compute group; configure scale_up / scale_out domains separately below.",
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
  域清单: "Communication domains",
  通信域清单: "Communication domain list",
  通信域: "Communication domain",
  "通信域 ID": "Communication domain ID",
  后端域类型: "Backend domain type",
  后端端点: "Backend endpoints",
  "通信域是后端网络资源，不是设备所有权。设备归属由设备清单中的计算组决定，最多 {max} 个通信域。":
    "Communication domains are backend network resources, not device ownership. Device ownership comes from Compute group in Device inventory; up to {max} domains are allowed.",
  新增通信域: "Add communication domain",
  "设备清单里的计算组决定节点归属；这里仅配置后端通信域。scale_up 用于组内通信，scale_out 用于组间通信，scale_out 的端点列表可以和 scale_up 重叠。":
    "Compute group in Device inventory determines ownership; configure backend communication domains here. scale_up is intra-group, scale_out is inter-group, and scale_out endpoints may overlap scale_up endpoints.",
  "当前没有通信域。点「新增通信域」创建组内通信；形成多个计算组后，组间通信域会自动准备。":
    "There are no communication domains. Add one for intra-group communication; an inter-group domain is prepared after multiple compute groups exist.",
  "这是组间通信域：它汇总跨计算组的 endpoint。成员重叠是后端端点语义，不代表这些卡属于两个计算组。":
    "This is an inter-group communication domain. It aggregates endpoints across compute groups; overlap is backend endpoint scope and does not assign a card to two groups.",
  后端绑定与运行策略: "Backend binding and run policy",
  "组间端点（自动汇总）": "Inter-group endpoints (derived)",
  "先在设备清单中填写至少两个计算组，并配置组内通信域。":
    "Enter at least two compute groups in Device inventory and configure their intra-group domains first.",
  "已新增组内通信域 {domain}，绑定网络模型 {module}；请在后端端点中选择设备。":
    "Added intra-group communication domain {domain} bound to network model {module}; select devices under Backend endpoints.",
  "已根据计算组自动准备组间通信域，请在后端端点中核对。":
    "An inter-group communication domain was prepared from the compute groups; verify its backend endpoints.",
  "当前没有可用于 {type} 的网络模型。请先在「模块绑定参数」中声明匹配的 module_binding。":
    "No network model is available for {type}. Declare a matching module_binding under Module binding parameters first.",
  "域 {domain} 的类型已改为 {type}，并绑定匹配模型 {module}。":
    "Domain {domain} is now {type} and uses matching model {module}.",
  "模型 {module} 属于 {kind}，不能绑定到 {type} 域。请先切换域类型。":
    "Model {module} is {kind} and cannot bind to a {type} domain. Change the domain type first.",
  计算节点组: "Compute node groups",
  新增域: "Add domain",
  新增超级节点: "Add compute group",
  新增设备组: "Add compute group",
  添加跨机网络: "Add inter-node network",
  "后端域类型（高级）": "Backend domain type (advanced)",
  "高级：后端域类型": "Advanced: backend domain type",
  域名: "Domain name",
  域类型: "Domain type",
  所用网络模型: "Network model",
  "机内高速互联（scale_up）": "Intra-node interconnect (scale_up)",
  "跨机网络（scale_out）": "Inter-node network (scale_out)",
  "跨机网络 {domains}": "Inter-node network {domains}",
  未入超级节点: "Not assigned to a compute group",
  未入设备组: "Not assigned to a compute group",
  "最多 {max} 个域。域就是「一批卡共用的同一套网络」；新增域自动命名 su0、so0，并绑定一个已存在的网络模型。":
    "Up to {max} domains. A domain is one network shared by a group of cards; new domains are named su0, so0, … and bound to an existing network model.",
  "最多 {max} 个域。域就是「一组节点共用的同一套网络」；新增域自动命名 su0、so0，并绑定一个已存在的网络模型。":
    "Up to {max} domains. A domain is one network shared by a group of nodes; new domains are named su0, so0, … and bound to an existing network model.",
  "topology JSON 缺少 domains 数组，域清单暂不可编辑。":
    "The topology JSON has no domains array, so the domain list cannot be edited yet.",
  "当前没有域。点「新增域」创建第一个，再勾选它包含哪些卡。":
    "There are no domains. Click Add domain to create the first one, then tick the cards it contains.",
  "当前没有域。点「新增域」创建第一个，再勾选它包含哪些节点。":
    "There are no domains. Click Add domain to create the first one, then tick the nodes it contains.",
  "普通流程把 scale_up 域作为组内网络；scale_out 只用于设备组之间的跨组连接。最多 {max} 个域。":
    "The normal workflow uses scale_up for intra-group networking; scale_out is reserved for links between compute groups. Up to {max} domains.",
  "当前没有设备组。点「新增设备组」创建第一个；跨组网络会在两个设备组之间单独配置。":
    "There are no compute groups. Click Add compute group to create the first; configure scale-out networking between groups separately.",
  "当前 topology 没有声明可用于计算节点组的 scale_up 网络模型；请先在高级「模块绑定参数」中声明一个，不能把跨机模型冒充机内互联。":
    "This topology has no scale_up network model for a compute node group. Declare one in the advanced Module binding parameters first; an inter-node model cannot stand in for an intra-node link.",
  "已新增设备组 {domain}，绑定组内网络模型 {module}；请在成员清单中选择设备。":
    "Added compute group {domain} bound to intra-group network model {module}; choose its devices in the member list.",
  "${device} 已属于设备组「${owner}」，一张卡只能归属一个设备组。":
    '${device} already belongs to compute group "${owner}"; a device can belong to only one compute group.',
  "至少要有两个超级节点，才能建立跨机网络。":
    "At least two super nodes are required before an inter-node network can be created.",
  "当前 topology 没有声明可用的 scale_out 网络模型，不能伪造跨机连接能力。":
    "This topology has not declared a scale_out network model, so inter-node networking cannot be fabricated.",
  "已新增跨机网络 {domain}，绑定网络模型 {module}。":
    "Added inter-node network {domain} bound to network model {module}.",
  "先创建并分配设备组的组内网络（scale_up）。当至少两个设备组都已有成员时，跨组网络（scale_out）会自动生成；它只汇总 endpoint，不会改变设备组归属。":
    "Create and assign intra-group networks (scale_up) first. Once at least two compute groups have members, the scale_out domain is generated automatically; it aggregates endpoints without changing group ownership.",
  "这是横向扩展网络：它汇总各个设备组的 endpoint，用于跨组通信；成员重叠是后端 endpoint 语义，不代表这些卡属于两个设备组。":
    "This is a scale-out network. It aggregates endpoints from the compute groups for cross-group communication; overlapping members are endpoint scope and do not put a card in two groups.",
  "跨机 endpoint": "Scale-out endpoints",
  "先在设备组的组内网络中选择设备。": "Select devices in the compute group's intra-group network first.",
  "域的数量不能超过 {max} 个。": "The number of domains cannot exceed {max}.",
  "topology 里还没有 module_bindings：新增域必须绑定一个网络模型，请先在「模块绑定参数」里补一个，或在原始 JSON 里补一条 module_bindings。":
    "The topology has no module_bindings yet: a new domain must bind a network model, so add one under Module binding parameters first, or add a module_bindings entry in the raw JSON.",
  "已新增域 {domain}（{type}），绑定网络模型 {module}。成员设备还是空的，勾选要加入的卡。":
    "Added domain {domain} ({type}) bound to network model {module}. Its member list is empty — tick the cards it contains.",
  "已新增域 {domain}（{type}），绑定网络模型 {module}。成员设备还是空的，勾选要加入的节点。":
    "Added domain {domain} ({type}) bound to network model {module}. Its member list is empty — tick the nodes it contains.",
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
  "已选 {selected} / 共 {total} 个节点": "{selected} of {total} nodes selected",
  "还没有设备，先在「设备清单」里加卡。": "No devices yet; add cards in Device inventory first.",
  "还没有设备，先在「设备清单」里添加节点。": "No devices yet; add nodes in Device inventory first.",
  "这个域是 {type}，但绑定的模型 {module} 属于 {kind}，两边对不上，请核对「模块绑定参数」。":
    "This domain is {type}, but its bound model {module} is {kind}; the two disagree, check Module binding parameters.",
  "这个域还没有成员设备：它不会承载任何通信。": "This domain has no member devices, so it carries no traffic.",
  "契约里还有 {count} 个可选域字段没有控件（留空即省略），要改请直接在原始 JSON 里编辑：{fields}":
    "{count} optional domain fields in the contract have no control (blank means omitted); edit them directly in the raw JSON: {fields}",
};
