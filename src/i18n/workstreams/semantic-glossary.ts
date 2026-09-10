// English copy for the deterministic semantic presentation dictionary.
export const semanticGlossaryEnglishCatalog: Readonly<Record<string, string>> = {
  统一仿真内核模块: "Unified simulation kernel module",
  校准验证与指标归因模块: "Calibration, validation, metrics, and attribution module",
  三个并列资源模块: "Three peer resource modules",
  输入来源模式: "Input source mode",
  "Trace 语义类型": "Trace semantic type",
  请求的仿真精细度: "Requested simulation fidelity",
  实际仿真精细度: "Actual simulation fidelity",
  精细度解析结果: "Fidelity resolution",
  生效精细度层级: "Effective fidelity tier",
  "DES 实现状态": "DES implementation status",
  "Cycle 实现状态": "Cycle implementation status",
  "真实测量校准状态。": "Real-measurement calibration status.",
  "输入来源及其证据边界。": "Input source and evidence boundary.",
  "报告允许支持的结论范围。": "Conclusion scope supported by the report.",
  "Trace 进入仿真的语义边界。": "Semantic boundary where the Trace enters simulation.",
  "请求使用的仿真精细度。": "Requested simulation fidelity.",
  "本次实际采用的仿真精细度。": "Simulation fidelity used in this run.",
  "该模块对请求精细度的解析结果。": "This module's resolved fidelity.",
  "最终生效的仿真精细度层级。": "Final effective simulation fidelity tier.",
  "DES 路径在该模块的状态。": "DES path status for this module.",
  "Cycle 路径在该模块的状态。": "Cycle path status for this module.",
  "本次报告中的证据状态。": "Evidence state in this report.",
  "前端对字段的展示方式。": "How the field is displayed.",
  "数据或证据的可用状态。": "Data or evidence availability.",
  "阶段记录的执行语义。": "Execution meaning of the stage record.",
  "后端声明的证据层级。": "Evidence tier declared by the backend.",
  "本次报告采用的验证路径。": "Validation path used by this report.",
  当前证据状态: "Current evidence state",
  字段展示方式: "Field presentation method",
  数据可用状态: "Data availability",
  执行阶段类型: "Execution stage type",
  验证路径: "Validation lane",
  "来自真实系统采集。": "Captured from a real system.",
  "由生成器产生，不是真实采集。": "Generated, not captured from a real system.",
  "来自兼容测试工具，不代表硬件等价。": "From a compatibility harness; not hardware-equivalent.",
  "当前没有真实测量校准证据。": "No real-measurement calibration evidence.",
  "仅部分完成校准。": "Only partly calibrated.",
  "已在声明范围内完成校准。": "Calibrated within the declared scope.",
  "已通过独立真实 Trace 验证。": "Validated with an independent real Trace.",
  "用于机制探索或候选筛选。": "For mechanism exploration or screening.",
  "用于同一证据边界内对比。": "For comparison within one evidence boundary.",
  "校准范围内的条件预测。": "Conditional prediction within the calibrated scope.",
  "独立真实 Trace 留出验证。": "Held-out validation with a real Trace.",
  "使用未参与校准的真实 Trace。": "Uses a real Trace excluded from calibration.",
  "独立留出指标，含资源汇合证据。": "Held-out metric with resource-convergence evidence.",
  "合成输入下的一致性检查。": "Consistency check with synthetic input.",
  "合成输入下一致性检查，含资源汇合。": "Synthetic-input consistency check with resource convergence.",
  "声明边界内的一致性检查。": "Consistency check within the declared boundary.",
  "仅覆盖网络与硬件资源模块的探索。": "Exploration limited to network and hardware resources.",
  "仅支持工作流与契约一致性检查。": "Workflow and contract consistency only.",
  "多文件 Trace 包清单。": "Manifest for a multi-file Trace package.",
  "结构化成本模型估算。": "Structured cost-model estimate.",
  "全局时间轴上的动态事件模拟。": "Dynamic event simulation on the global timeline.",
  "局部窗口的周期状态细化。": "Cycle-state refinement for a local window.",
  "由后端策略决定具体精细度。": "The backend policy chooses the fidelity.",
  "该模块在声明边界内有后端覆盖。": "Backend coverage exists within the declared boundary.",
  "当前报告包含该模块的记录。": "This report contains records for the module.",
  "仅有边界或精细度声明。": "Boundary or fidelity declaration only.",
  "按请求边界预期不出现。": "Expected to be absent at this boundary.",
  "当前证据路径未覆盖。": "Not covered by the current evidence path.",
  "报告未提供所需数据。": "Required data was not provided.",
  "报告未确定当前状态。": "The report does not determine the state.",
  "该项完整匹配。": "This item is fully matched.",
  "已与对应证据匹配。": "Matched to the corresponding evidence.",
  "该检查已通过。": "This check passed.",
  "该检查未通过。": "This check failed.",
  "该路径已完成。": "This path completed.",
  "该路径仍在运行。": "This path is still running.",
  "该路径执行失败。": "This path failed.",
  "该路径未完整完成。": "This path did not complete fully.",
  "来自输入 Trace 的记录。": "Record from the input Trace.",
  "等待队列服务。": "Waiting for queue service.",
  "等待拥塞消退。": "Waiting for congestion to clear.",
  "报告的实际执行时间。": "Execution time reported by the backend.",
  "位于 Pareto 前沿。": "On the Pareto front.",
  "没有候选方案支配该项。": "No candidate dominates this item.",
  "存在候选方案优于该项。": "Another candidate dominates this item.",
  "缺少足够比较目标。": "Insufficient objectives for comparison.",
  "本次没有完成评估。": "Not evaluated in this run.",
  "使用后端允许的回退值。": "Uses the backend's permitted fallback value.",
  "按记录数量展示。": "Displayed as a record count.",
  "按稳定标识去重展示。": "Deduplicated by stable identifier for display.",
  "当前契约支持。": "Supported by the current contract.",
  "旧版数据未提供版本标识。": "Legacy data has no version identity.",
  "报告 Schema 校验失败。": "Report Schema validation failed.",
  "仅在声明条件下可用。": "Available only under the declared conditions.",
  "缺少所需配置。": "Required profile is missing.",
  "缺少校准证据。": "Calibration evidence is missing.",
  "缺少独立留出验证证据。": "Held-out validation evidence is missing.",
  "当前对象或场景不适用。": "Not applicable to this object or scenario.",
  "当前数据或能力不可用。": "Data or capability is currently unavailable.",
  "当前契约检查通过。": "Current contract checks passed.",
  "所属路径本次未执行。": "The owning path did not execute in this run.",
  "直接展示后端值。": "Displays the backend value directly.",
  "按稳定标识分组展示。": "Groups display by stable identifier.",
  "对同组同单位字段求和展示。": "Sums same-group, same-unit fields for display.",
  "仅改变显示单位。": "Changes the display unit only.",
  "后端已实现并有本次运行证据。": "Implemented with evidence from this run.",
  "仅部分满足实现或证据条件。": "Only partly meets implementation or evidence conditions.",
  "仅能关联到本次运行。": "Can only be linked to this run.",
  "同一标识匹配到多个记录。": "The identifier matches multiple records.",
  "缺少可验证 Schema 身份或 SHA-256。": "Verifiable Schema identity or SHA-256 is missing.",
  "按旧版兼容契约只读展示。": "Read-only display under a legacy compatibility contract.",
  "引用未通过一致性检查。": "The reference failed consistency checks.",
  "当前契约缺少所需结构化信息。": "The current contract lacks required structure.",
  "报告声明该审计项通过。": "The report marks this audit item as passed.",
  "存在缺口或降级条件。": "A gap or degraded condition exists.",
  "仅有部分归因链路或审计证据。": "Only partial attribution or audit evidence is present.",
  "本次未请求该精细度路径。": "This fidelity path was not requested.",
  "后端契约不要求独立求解器。": "The backend contract requires no independent solver.",
  "该路径尚未实现。": "This path is not implemented.",
  "该能力已规划但尚未实现。": "Planned but not implemented.",
  "仅有接口或占位声明。": "Interface or placeholder declaration only.",
  "通过相邻模块汇合，不是独立 DES 证据。": "Converges through adjacent modules, not independent DES evidence.",
  "仅部分路径满足 DES 条件。": "Only part of the path meets DES conditions.",
  "分析语义通过资源汇合进入 DES。": "Analytical semantics enter DES through resource convergence.",
  "统一时间轴上的运行时事件区间。": "Runtime event interval on the shared timeline.",
  "并列资源语义的汇合阶段。": "Peer resource-semantics convergence stage.",
  "网络执行、排队与拥塞阶段。": "Network execution, queueing, and congestion stage.",
  "Schema 不在前端允许范围内。": "Schema is outside the frontend allow-list.",
  "说明输入是实际系统采集、人工生成，还是由兼容测试工具产生；它直接限制证据强度。":
    "Indicates whether the input was captured from a real system, generated, or produced by a compatibility harness; it directly limits evidence strength.",
  "说明本次数据或模型是否已用真实测量校准，以及校准证据所处阶段。":
    "Indicates whether the data or model was calibrated with real measurements and the stage reached by that evidence.",
  "说明这份报告最多可以支持哪一类结论，前端不会扩大这个边界。":
    "Defines the strongest conclusion this report can support; the frontend does not widen this boundary.",
  "说明输入 Trace 从哪个稳定语义边界进入仿真，而不是文件格式或可信度等级。":
    "Identifies the stable semantic boundary where the Trace enters simulation, not its file format or trust level.",
  "说明运行请求希望使用的求解精细度；它不等同于后端实际达到的精细度。":
    "The solver fidelity requested for the run; it is not the fidelity the backend actually achieved.",
  "说明该模块在本次运行中实际采用的求解精细度，可能与请求值不同。":
    "The solver fidelity actually used by this module in the run; it may differ from the requested value.",
  "说明请求精细度在该模块是否被覆盖、降级、排除或按边界预期缺省。":
    "Reports whether the requested fidelity was covered, downgraded, excluded, or intentionally absent at this boundary.",
  "说明实现配置最终生效的精细度层级；仅反映后端报告，不升级证据等级。":
    "The implementation tier that took effect; it mirrors the backend report without upgrading evidence strength.",
  "说明离散事件模拟路径在该模块的实现或执行状态。":
    "The implementation or execution state of the discrete-event simulation path for this module.",
  "说明周期级细化路径在该模块的实现或请求状态；不能由 DES 状态推断。":
    "The implementation or request state of cycle-level refinement; it cannot be inferred from DES status.",
  "说明页面在本次报告中找到了哪一种证据状态，不代表真实系统准确率。":
    "Identifies the evidence state found in this report; it does not represent real-system accuracy.",
  "说明前端如何展示后端字段；只允许原样显示、展示级分组、同单位求和或单位换算。":
    "Explains how the frontend presents backend fields: identity, display-only grouping, same-unit summation, or unit conversion.",
  "说明目标数据为何可用或不可用，并严格区分缺失、未覆盖、预期缺省和不适用。":
    "Explains why data is available or unavailable, distinguishing missing, not covered, expected absence, and not applicable.",
  "说明统一时间轴上这条阶段记录代表的后端执行语义。":
    "Identifies the backend execution meaning of this stage on the shared timeline.",
  "说明后端为这组证据声明的层级；它不等同于仿真精细度或准确率。":
    "The evidence tier declared by the backend; it is not simulation fidelity or an accuracy score.",
  "说明本次报告采用的验证路径，例如合成一致性检查或独立真实 Trace 验证。":
    "The validation path used by this report, such as synthetic consistency or held-out real-Trace validation.",
  未收录字段: "Uncatalogued field",
  "未知字段，保留原字段名。": "Unknown field; original name retained.",
  "前端尚无此字段的确定性解释；保留后端字段名供排障。":
    "The frontend has no deterministic explanation for this field; the backend field name is retained for diagnosis.",
  报告未提供: "Not provided by report",
  "报告未提供这个字段值。": "This field value was not provided.",
  未识别值: "Unrecognised value",
  "未知值，保留后端原值。": "Unknown value; backend value retained.",
  "报告中没有这个字段值；前端不会按零、不适用或预期缺省处理。":
    "The report does not contain this field value; the frontend does not treat it as zero, not applicable, or expected absence.",
  "前端尚无此值的确定性解释；保留后端原值，不推断或升级其语义。":
    "The frontend has no deterministic explanation for this value; it preserves the backend value without inference or semantic upgrade.",
  "技术字段：{field} = {value}": "Technical field: {field} = {value}",
  "真实系统采集 Trace": "Real-system trace",
  "人工生成 Trace": "Synthetic trace",
  "兼容测试工具 Trace": "Compatibility-harness trace",
  部分校准: "Partially calibrated",
  已校准: "Calibrated",
  已通过独立留出验证: "Held-out validated",
  对比性结论: "Comparative claims",
  校准范围内预测: "Calibrated-scope prediction",
  独立留出验证: "Held-out validation",
  "独立真实 Trace 留出验证路径": "Held-out real-Trace validation lane",
  "独立留出指标证据（含资源汇合）": "Held-out metric evidence (with resource convergence)",
  合成一致性检查: "Synthetic consistency check",
  "合成一致性检查（含资源汇合）": "Synthetic consistency check (with resource convergence)",
  边界一致性检查: "Boundary consistency check",
  仅网络范围的探索性结论: "Network-only exploratory claims",
  仅工作流一致性: "Workflow consistency only",
  "工作负载输入 Trace": "Workload input trace",
  "推理运行时 Trace": "Inference-runtime trace",
  "执行语义 Trace": "Execution-semantics trace",
  "Kernel 语义 Trace": "Kernel-semantics trace",
  "KV Cache 与内存 Trace": "KV Cache and memory trace",
  "设备任务 Trace": "Device-task trace",
  "集合通信 Trace": "Collective-communication trace",
  "Trace 包清单": "Trace package manifest",
  "分析估算（Analytical）": "Analytical estimation",
  "周期级细化（Cycle）": "Cycle-level refinement",
  使用默认精细度策略: "Use default fidelity policy",
  仅有解析声明: "Declaration only",
  按边界预期缺省: "Expected absence at this boundary",
  当前证据未覆盖: "Not covered by current evidence",
  所需数据缺失: "Required data missing",
  状态未知: "Unknown state",
  不适用于此项: "Not applicable",
  当前不可用: "Currently unavailable",
  当前可用: "Available",
  输入记录: "Input record",
  "Pareto 成员": "Pareto member",
  未被支配: "Non-dominated",
  已被支配: "Dominated",
  目标不足: "Insufficient objectives",
  未评估: "Not evaluated",
  回退展示: "Fallback display",
  计数展示: "Count display",
  去重展示: "Deduplicated display",
  已支持: "Supported",
  旧版未带版本: "Legacy unversioned",
  "Schema 无效": "Invalid Schema",
  有条件可用: "Conditionally available",
  配置缺失: "Profile missing",
  缺少校准: "Calibration missing",
  缺少留出验证: "Held-out validation missing",
  "未执行，因而未解析": "Unresolved because not executed",
  原样展示: "Identity display",
  仅展示级分组: "Display-only grouping",
  同单位展示级求和: "Display-only same-unit sum",
  仅显示单位换算: "Display-only unit conversion",
  已实现并有本次运行证据: "Implemented with run evidence",
  部分满足: "Partially satisfied",
  仅有运行级关联: "Run-level association only",
  证据引用不唯一: "Ambiguous evidence reference",
  产物身份信息缺失: "Artifact identity missing",
  旧版兼容证据: "Legacy-compatible evidence",
  证据引用无效: "Invalid evidence reference",
  当前契约存在缺口: "Current contract gap",
  审计通过: "Audit passed",
  结果受限: "Result constrained",
  部分归因证据: "Partial attribution evidence",
  本次未请求: "Not requested for this run",
  该模块无需独立实现: "No independent implementation required",
  尚未实现: "Not implemented",
  "已规划，尚未实现": "Planned, not implemented",
  仅占位接口: "Placeholder only",
  仅通过相邻模块汇合: "Adjacent-module convergence only",
  "部分 DES": "Partial DES",
  "分析模型到 DES 的桥接": "Analytical-to-DES bridge",
  运行时事件窗口: "Runtime event window",
  并列资源语义汇合: "Peer resource-semantics convergence",
  网络执行实现: "Network realization",
  "Schema 不受支持": "Unsupported schema",
  "输入来自真实系统、Profiler、Exporter 或基准工具；具体结论仍受校准级别和允许声明范围限制。":
    "The input was captured from a real system, profiler, exporter, or benchmark; calibration and allowed claim scope still limit conclusions.",
  "输入由生成器产生，不是真实系统采集；适合开发和机制探索，不能作为真实系统保真度依据。":
    "The input was produced by a generator rather than captured from a real system; it supports development and exploration, not real-system fidelity claims.",
  "输入来自兼容或语义仿真工具；可用于语义提取与交叉检查，不能宣称硬件等价。":
    "The input came from a compatibility or semantic-emulation harness; it supports semantic extraction and cross-checking, not hardware equivalence.",
  "当前没有可声明的真实测量校准证据；结果不能显示成已校准预测。":
    "No claimable real-measurement calibration evidence is present; the result cannot be presented as a calibrated prediction.",
  "只有部分模型或适用范围完成校准；未校准部分和外推条件仍限制结论。":
    "Only part of the model or applicability range is calibrated; uncalibrated areas and extrapolation conditions still limit conclusions.",
  "报告声明已在指定范围内完成校准；是否经过独立留出验证仍需单独判断。":
    "The report declares calibration within a stated scope; held-out validation must still be assessed separately.",
  "报告声明已使用未参与校准的真实 Trace 验证；结论只适用于所声明的验证范围。":
    "The report declares validation against real Traces excluded from calibration; conclusions apply only to the stated validation scope.",
  "结果可用于机制探索和候选筛选，不能描述成真实系统验证或已校准预测。":
    "The result supports mechanism exploration and candidate screening, not real-system validation or calibrated prediction.",
  "结果可用于同一证据边界内的方案对比，不自动支持绝对性能或真实系统保真度声明。":
    "The result supports comparisons within one evidence boundary, not absolute performance or real-system fidelity claims by default.",
  "结果可作为已声明校准范围内的条件预测；超出范围仍需说明外推假设。":
    "The result is a conditional prediction within the declared calibration scope; extrapolation assumptions remain necessary outside it.",
  "结果可用于已声明范围内的真实 Trace 留出验证结论，不应外推到未验证环境。":
    "The result supports held-out real-Trace validation within the declared scope and should not be extended to unvalidated regimes.",
  "验证路径使用未参与校准的真实 Trace；结论仍只适用于报告声明的验证范围。":
    "The validation lane uses real Traces excluded from calibration; conclusions still apply only to the scope declared by the report.",
  "报告声明指标来自独立真实 Trace 留出验证，并包含资源语义汇合证据；这不扩大已声明的适用范围。":
    "The report declares metric evidence from held-out real-Trace validation with resource-semantics convergence; this does not widen the declared applicability scope.",
  "只证明合成输入下的契约或机制一致性，不等于真实系统校准或留出验证。":
    "This only checks contract or mechanism consistency under synthetic input; it is not real-system calibration or held-out validation.",
  "合成输入下同时检查了资源语义汇合；仍不构成真实系统保真度证据。":
    "Resource-semantics convergence was also checked under synthetic input; this is still not real-system fidelity evidence.",
  "只检查声明边界内的语义和结果一致性，边界外行为不在结论范围内。":
    "Only semantics and results inside the declared boundary are checked; behavior outside it is out of scope.",
  "结论只覆盖网络与硬件资源模块的探索，不包含未执行模块。":
    "Claims cover exploration in the network and hardware resources module only, excluding unexecuted modules.",
  "只支持工作流与契约一致性检查，不支持真实系统性能或保真度声明。":
    "Supports workflow and contract consistency checks only, not real-system performance or fidelity claims.",
  "Trace 从工作负载抽象与负载描述语言模块边界进入。":
    "The Trace enters at the workload abstraction and description language module boundary.",
  "从推理引擎与服务运行时模块边界进入。": "Enters at the inference engine and serving runtime boundary.",
  "从执行语义建模模块边界进入。": "Enters at the execution semantics modeling boundary.",
  "从执行语义建模模块的 Kernel 入口进入。":
    "Enters through the Kernel entry of the execution semantics modeling module.",
  "从 KV Cache 建模模块边界进入。": "Enters at the KV Cache modeling boundary.",
  "从设备性能建模模块边界进入。": "Enters at the device performance modeling boundary.",
  "从集合通信语义模块边界进入。": "Enters at the collective communication semantics boundary.",
  "Trace 从推理引擎与服务运行时模块边界进入，包含请求与运行时语义。":
    "The Trace enters at the inference engine and serving runtime boundary with request and runtime semantics.",
  "Trace 从执行语义建模模块边界进入，描述执行结构与依赖。":
    "The Trace enters at the execution semantics modeling boundary and describes execution structure and dependencies.",
  "Trace 从执行语义建模模块的 Kernel 兼容入口进入。":
    "The Trace enters through the kernel-compatible entry of the execution semantics modeling module.",
  "Trace 从 KV Cache 建模模块边界进入。": "The Trace enters at the KV Cache modeling module boundary.",
  "Trace 从设备性能建模模块边界进入。": "The Trace enters at the device performance modeling module boundary.",
  "Trace 从集合通信语义模块边界进入。": "The Trace enters at the collective communication semantics module boundary.",
  "值描述一个多文件 Trace 包清单；实际入口类型由包内入口声明决定。":
    "This value identifies a multi-file Trace package manifest; the package entry declaration determines the actual input type.",
  "使用结构化成本模型进行估算，不包含 DES 动态排序或 Cycle 状态推进。":
    "Uses structured cost models without DES dynamic ordering or Cycle state transitions.",
  "在全局时间轴上推进动态事件、等待、竞争和反馈；不等于周期级模拟。":
    "Advances dynamic events, waits, contention, and feedback on the global timeline; it is not cycle-level simulation.",
  "使用目标周期状态和控制更新细化局部窗口；不能由 Analytical 或 DES 自动升级得到。":
    "Refines local windows with target cycle state and control updates; it cannot be inferred or upgraded from Analytical or DES.",
  "请求未固定具体精细度，由后端策略解析；实际结果必须另行查看。":
    "The request does not fix a fidelity; the backend policy resolves it and the actual result must be inspected separately.",
  "该模块在声明边界内有后端覆盖；仍需结合实际精细度和证据范围解读。":
    "The module is covered within the declared boundary; actual fidelity and evidence scope still constrain interpretation.",
  "当前报告包含该模块的记录；这只说明数据存在，不代表已校准或已验证。":
    "The report contains records for this module; presence alone does not mean calibrated or validated.",
  "报告只声明了边界或精细度解析，没有可展开的模块级执行明细。":
    "The report only declares a boundary or fidelity resolution and contains no module-level execution detail.",
  "该数据位于本次请求边界之外，因此预期不出现；这不是执行失败，也不能当作零。":
    "The data is outside the requested boundary and is intentionally absent; this is neither a failure nor zero.",
  "当前公开证据路径不能支持这一行为；它与预期缺省不同，必须保留为证据缺口。":
    "The current evidence lane cannot support this behavior; unlike expected absence, it remains an evidence gap.",
  "按当前契约原本需要数据，但报告没有提供；它与不适用或预期缺省不同。":
    "The current contract expects data, but the report does not provide it; this differs from not applicable or expected absence.",
  "报告无法确定当前状态；前端不会猜测或升级为任何已知状态。":
    "The report cannot determine the state; the frontend does not guess or upgrade it.",
  "该字段在当前对象或场景没有语义，不表示缺失、失败或数值为零。":
    "The field has no meaning for this object or scenario; it does not mean missing, failed, or zero.",
  "数据或能力当前不可访问；具体原因应由相邻说明或后端原始信息给出。":
    "The data or capability is not accessible; adjacent context or the original backend explanation should give the reason.",
  "数据通过当前契约检查并可访问；这不自动提高校准或验证等级。":
    "The data passed current contract checks and is accessible; this does not upgrade calibration or validation strength.",
  "本次运行没有执行该变量所属路径，因此后端没有解析其结果；前端不会补默认值。":
    "The run did not execute the path that owns this variable, so the backend did not resolve it; the frontend supplies no default.",
  "前端直接展示后端值，不分组、不求和，也不改变单位。":
    "The frontend displays the backend value directly without grouping, summation, or unit changes.",
  "前端按稳定标识整理重复显示，保留后端原值，不生成新的仿真结果。":
    "The frontend organises repeated display by stable identifiers while preserving backend values and creating no new simulation result.",
  "前端只对已声明的同组、同单位后端字段求和用于展示，不重算仿真。":
    "The frontend sums declared fields only within the same group and unit for display; it does not recompute simulation.",
  "前端只改变显示单位；技术详情继续保留后端原始值和原始单位。":
    "The frontend changes display units only; technical details retain the original backend value and unit.",
  "后端声明相应路径已实现且本次运行满足其证据条件；不代表已完成真实系统验证。":
    "The backend declares the path implemented and this run meets its evidence conditions; this is not real-system validation.",
  "只满足了部分实现或证据条件，未满足部分仍限制结论。":
    "Only some implementation or evidence conditions are met; unmet conditions still constrain conclusions.",
  "证据只能关联到本次运行，不能精确绑定到当前请求或记录。":
    "Evidence can be associated only with this run, not precisely bound to the current request or record.",
  "同一标识匹配到多个候选记录，前端拒绝按顺序或位置猜测目标。":
    "The same identifier matches multiple candidate records; the frontend refuses to guess a target by order or position.",
  "报告产物缺少可验证的 Schema 身份或 SHA-256，因而不能建立完整证据链接。":
    "The report artifact lacks a verifiable schema identity or SHA-256, so a complete evidence link cannot be established.",
  "数据可按旧版兼容契约只读展示，但不具备当前版本的完整证据保证。":
    "The data can be shown read-only under the legacy compatibility contract but lacks the current version's complete evidence guarantees.",
  "引用的运行、产物、JSON Pointer 或目标标识未通过一致性检查。":
    "The referenced run, artifact, JSON Pointer, or target identifier failed consistency checks.",
  "当前契约没有提供建立该关联所需的结构化信息；前端不会自行补造。":
    "The current contract does not provide the structured information required for this association; the frontend does not fabricate it.",
  "报告声明该审计项通过；这不自动代表真实系统验证已完成。":
    "The report declares this audit item passed; that does not mean real-system validation is complete.",
  "报告可用但存在明确缺口或降级条件，结论必须保留这些限制。":
    "The report is usable but has explicit gaps or downgrade conditions that must remain attached to conclusions.",
  "归因报告只有部分链路或审计证据，不应视为完整因果解释。":
    "The attribution report has only partial chain or audit evidence and is not a complete causal explanation.",
  "本次运行没有请求该精细度路径；不能据此判断实现已完成或失败。":
    "This fidelity path was not requested for the run; it says neither implemented nor failed.",
  "后端契约不要求该模块拥有独立的此级求解器；这不表示缺失。":
    "The backend contract does not require an independent solver at this tier for the module; this is not missing.",
  "后端声明该路径尚未实现，不能把其他精细度结果显示成这一层级。":
    "The backend declares this path unimplemented; results from another fidelity cannot be presented as this tier.",
  "该能力仍在规划中，本次结果不包含相应实现证据。":
    "The capability is planned; this run contains no implementation evidence for it.",
  "当前只有接口或占位声明，没有可用于正式结论的实现证据。":
    "Only an interface or placeholder declaration exists, with no implementation evidence for formal claims.",
  "证据通过相邻模块的汇合路径进入结果，并非该模块独立 DES 执行证据。":
    "Evidence enters through adjacent-module convergence rather than independent DES execution in this module.",
  "只有部分路径满足 DES 条件；不能把整条链路称为完整 DES。":
    "Only part of the path meets DES conditions; the full chain cannot be called complete DES.",
  "本模块提供受控分析语义，并通过资源汇合进入 DES；不等于独立模块 DES。":
    "The module supplies controlled analytical semantics that enter DES through resource convergence; this is not independent module DES.",
  "统一时间轴上的推理运行时事件区间。": "The inference-runtime event interval on the shared timeline.",
  "KV Cache、设备和集合通信语义在进入网络执行前的并列汇合阶段。":
    "The peer convergence stage for KV Cache, device, and collective semantics before network execution.",
  "通信需求进入网络与硬件资源模块后的执行、排队、拥塞和完成阶段。":
    "The execution, queueing, congestion, and completion stage after demand enters the network and hardware resources module.",
  "报告 Schema 不在当前前端允许范围内；页面失败关闭并保留原始数据。":
    "The report schema is outside the frontend allow-list; the page fails closed and preserves raw data.",
  后端说明: "Backend explanation",
  后端原文: "Backend original",
  "本次报告没有提供说明。": "The report provides no explanation.",
  "本次运行从推理引擎与服务运行时模块边界开始，因此上游模块不在本次执行范围内。":
    "This run starts at the inference engine and serving runtime boundary, so upstream modules are outside the execution scope.",
  "本次报告包含推理引擎与服务运行时模块的 DES 证据。":
    "This report contains DES evidence for the inference engine and serving runtime module.",
  "本次报告包含执行语义从运行时输出向资源语义转换的证据。":
    "This report contains evidence that runtime outputs were lowered into resource semantics.",
  "本次报告包含 KV Cache 与内存语义证据。": "This report contains KV Cache and memory semantics evidence.",
  "本次报告包含设备任务与性能语义证据。": "This report contains device-task and performance semantics evidence.",
  "本次报告包含集合通信语义证据。": "This report contains collective communication semantics evidence.",
  "本次报告包含网络执行、排队或拥塞语义证据。":
    "This report contains network execution, queueing, or congestion semantics evidence.",
  "合成数据只能支持一致性或探索性检查，不能支持独立真实 Trace 留出验证结论。":
    "Synthetic data supports consistency or exploratory checks only, not held-out real-Trace validation claims.",
  "合成数据检查不能替代使用独立真实 Trace 进行的保真度验证。":
    "Synthetic-data checks cannot replace fidelity validation with independent real Traces.",
  "本次运行从推理引擎与服务运行时模块的规范边界开始，因此工作负载抽象与负载描述语言模块按边界预期缺省。":
    "This run starts at the canonical inference engine and serving runtime boundary, so the workload module is intentionally absent.",
  "托管执行路径按依赖顺序生成推理运行时 DES 事件。":
    "The hosted path emits inference-runtime DES events in dependency order.",
  "运行时输出先转换为执行语义，再进入集合通信实现。":
    "Runtime outputs are lowered into execution semantics before collective realization.",
  "KV Cache 与内存语义在资源汇合前包含按依赖排序的 DES 事件证据。":
    "KV Cache and memory semantics contain dependency-ordered DES event evidence before resource convergence.",
  "设备性能语义在资源汇合前包含按依赖排序的 DES 任务证据。":
    "Device performance semantics contain dependency-ordered DES task evidence before resource convergence.",
  "集合通信语义在执行语义转换后包含按依赖排序的 DES 阶段证据。":
    "Collective communication semantics contain dependency-ordered DES phase evidence after lowering.",
  "本次实现支持工作负载重放、合成生成、来源记录，以及从工作负载到运行时的语义转换。":
    "This implementation supports workload replay, synthetic generation, provenance, and workload-to-runtime lowering.",
  "该模块当前不需要独立的 DES 求解层级。": "This module does not currently require an independent DES solver tier.",
  "执行语义建模模块当前承担语义转换边界，不是独立求解器层级。":
    "The execution semantics modeling module is a semantic-lowering boundary, not an independent solver tier.",
  "该语义边界不计为 DES 实现缺口。": "This semantic boundary does not count as a DES implementation gap.",
  "面向网络执行的集合通信阶段已完整匹配 KV Cache、设备与集合通信资源语义。":
    "Fabric-bound collective phases fully match KV Cache, device, and collective communication resource semantics.",
  "资源语义仅部分匹配；形成跨模块结论前，应先检查缺失的 KV Cache 或设备证据。":
    "Resource semantics are partially matched; inspect missing KV Cache or device evidence before cross-module claims.",
  "本次指标报告没有附带资源语义汇合证据。":
    "No resource-semantics convergence evidence is attached to this metrics report.",
  "Fixture 记录的推理运行时阶段。": "Inference-runtime stage recorded by the fixture.",
  "Fixture 记录的 KV Cache、设备与集合通信并列资源阶段。":
    "Peer KV Cache, device, and collective communication resource stage recorded by the fixture.",
  "Fixture 记录的网络执行阶段。": "Network realization stage recorded by the fixture.",
  "该请求在进入首个批次前发生等待。": "The request waited before entering its first batch.",
  "Fixture 报告该阶段以排队等待为主。": "The fixture reports queueing wait as dominant in this phase.",
  "Fixture 报告的排队等待贡献。": "Queueing-wait contribution reported by the fixture.",
  "本次运行从推理引擎与服务运行时模块开始。": "This run starts at the inference engine and serving runtime module.",
  "包含推理引擎与服务运行时模块的 DES 证据。":
    "Contains DES evidence for the inference engine and serving runtime module.",
  "包含运行时到执行语义的转换证据。": "Contains runtime-to-execution-semantics lowering evidence.",
  "包含 KV Cache 与内存证据。": "Contains KV Cache and memory evidence.",
  "包含设备任务与性能证据。": "Contains device-task and performance evidence.",
  "包含集合通信证据。": "Contains collective communication evidence.",
  "包含网络执行、排队或拥塞证据。": "Contains network execution, queueing, or congestion evidence.",
  "合成数据仅支持一致性或探索性检查。": "Synthetic data supports consistency or exploratory checks only.",
  "合成数据检查不能替代真实 Trace 留出验证。": "Synthetic-data checks cannot replace held-out real-Trace validation.",
  "本次运行从推理引擎与服务运行时模块边界开始，工作负载模块按边界缺省。":
    "This run starts at the inference engine and serving runtime boundary; the workload module is absent by design.",
  "托管路径生成按依赖排序的运行时 DES 事件。": "The hosted path emits dependency-ordered runtime DES events.",
  "运行时输出先转换为执行语义，再进入集合通信。":
    "Runtime outputs are lowered into execution semantics before collective communication.",
  "KV Cache 与内存语义包含 DES 事件证据。": "KV Cache and memory semantics contain DES event evidence.",
  "设备性能语义包含 DES 任务证据。": "Device performance semantics contain DES task evidence.",
  "集合通信语义包含 DES 阶段证据。": "Collective communication semantics contain DES stage evidence.",
  "支持工作负载重放、合成生成、来源记录和语义转换。":
    "Supports workload replay, synthetic generation, provenance, and semantic lowering.",
  "该模块无需独立 DES 层级。": "This module requires no independent DES tier.",
  "执行语义建模模块当前是语义转换边界。":
    "The execution semantics modeling module is currently a semantic-lowering boundary.",
  "该语义边界不计 DES 缺口。": "This semantic boundary does not count as a DES gap.",
  "网络集合通信阶段已匹配资源语义。": "Fabric-bound collective stages match resource semantics.",
  "资源语义仅部分匹配。": "Resource semantics are only partly matched.",
  "本次指标报告没有资源汇合证据。": "This metrics report contains no resource-convergence evidence.",
  "Fixture 记录的运行时阶段。": "Runtime stage recorded by the fixture.",
  "Fixture 记录的并列资源阶段。": "Peer resource stage recorded by the fixture.",
  "请求在首个批次前等待。": "The request waited before its first batch.",
  "该阶段以排队等待为主。": "Queueing wait dominates this stage.",
  运行时批处理等待: "Runtime batching wait",
  网络排队等待: "Network queueing wait",
};
