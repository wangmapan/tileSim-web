export const guidedHelpEnglishCatalog: Readonly<Record<string, string>> = {
  重点: "Key takeaway",
  查看原始证据指引: "View raw-evidence guide",
  "单位时间内完成的请求数量，通常与延迟一起判断。":
    "The number of requests completed per unit time, normally interpreted with latency.",
  "需要的验证字段被覆盖的比例；它不是模型准确率，也不等于真实硬件验证。":
    "The share of required validation fields covered; it is neither model accuracy nor real-hardware validation.",
  "trace 来源": "Trace source",
  "real_trace、synthetic_trace 与 compatibility_harness_trace 是不同来源，不能互相升级。":
    "real_trace, synthetic_trace, and compatibility_harness_trace are distinct sources and cannot be upgraded into one another.",
  "Analytical / DES / Cycle": "Analytical / DES / Cycle",
  "它们是仿真精度层级；Cycle 只适用于真实实现的热点细化，不代表全栈都达到周期级。":
    "These are fidelity tiers; Cycle applies only to implemented hotspot refinement, not the entire stack.",
  TTFT: "TTFT",
  "从请求到达至首个 Token 返回的时间。": "Time from request arrival to the first returned token.",
  TPOT: "TPOT",
  "首个 Token 之后，连续生成每个 Token 的平均间隔。":
    "Average interval between generated tokens after the first token.",
  "P95 / P99": "P95 / P99",
  "95% / 99% 的样本不超过该值，用于观察尾延迟。":
    "The value not exceeded by 95% / 99% of samples, used to examine tail latency.",
  "请求已经到达通信资源，但尚未开始服务的等待。":
    "Time after a request reaches a communication resource but before service starts.",
  "多条通信竞争有限链路或缓冲区造成的额外等待。":
    "Additional wait caused by transfers competing for limited links or buffers.",
  贡献占比: "Contribution share",
  "报告归给某项原因的相对份额；不能由前端重新聚合。":
    "The relative share the report assigns to a cause; the frontend cannot reaggregate it.",
  "cause chain": "Cause chain",
  "用稳定实体 ID 和证据引用串联的原因链。": "A cause chain connected by stable entity IDs and evidence references.",
  "held-out validation": "Held-out validation",
  "用未参与校准的独立真实 trace 或测量验证结果。":
    "Validation using independent real traces or measurements not used for calibration.",
  "synthetic consistency": "Synthetic consistency",
  "检查合成数据内部是否一致，不证明真实硬件准确性。":
    "Checks internal consistency of synthetic data; it does not prove real-hardware accuracy.",
  "not covered": "Not covered",
  "报告范围没有覆盖该项；它不等于数值为 0。": "The report scope does not cover this item; it is not a numeric zero.",
  "Pareto 集": "Pareto set",
  "在多个目标上不存在被另一方案全面压倒的候选集合。":
    "Candidates that are not dominated by another option across all objectives.",
  "把少量候选提升到更高仿真精度继续比较，不代表结果已校准。":
    "Promotes a few candidates to higher simulation fidelity; it does not mean the result is calibrated.",
  execution_scope: "execution_scope",
  "A/B 对比": "A/B comparison",
  "把两次独立运行的同类已报告指标并排比较。":
    "Places comparable reported metrics from two independent runs side by side.",
  运行绑定: "Run binding",
  "报告、输入、artifact 清单与同一 run ID 的绑定关系。":
    "The binding of reports, inputs, and artifact manifest to the same run ID.",
  引用: "Citation",
  "把一条 AI claim 绑定到当前运行中已验证的 artifact 与字段位置。":
    "Binds an AI claim to a validated artifact and field location in the current run.",
  需用户确认: "User confirmation required",
  "AI 生成内容在人工核对前不能视为确定性结论。":
    "AI-generated content is not a deterministic conclusion until a person verifies it.",
  provenance: "Provenance",
  "证据的来源、生成方式、校准等级和允许声明范围。":
    "The evidence source, generation method, calibration level, and allowed claim scope.",
  字段血缘: "Field lineage",
  "一个输出字段从哪个输入、转换和证据位置得到。":
    "The input, transformation, and evidence location from which an output field derives.",
  "Schema identity": "Schema identity",
  "标识报告结构和字段语义的版本化身份。": "A versioned identity for a report's structure and field semantics.",
  "versioned adapter": "Versioned adapter",
  "把已知报告版本安全转换成稳定页面模型的适配器。":
    "An adapter that safely converts a known report version into a stable page model.",
  失败关闭: "Fail closed",
  "无法验证结构时停止解释，但保留原始证据。":
    "Stops interpretation when structure cannot be validated while preserving raw evidence.",
  artifact: "Artifact",
  "一次运行产出的已登记输入或报告文件。": "A registered input or report file produced by one run.",
  "JSON Pointer": "JSON Pointer",
  "按照 RFC 6901 标识 JSON 文档中精确字段的位置。": "An RFC 6901 location for an exact field in a JSON document.",
  "SHA-256": "SHA-256",
  "用于核对文件 bytes 是否与可信清单完全一致的摘要。":
    "A digest used to verify that file bytes exactly match the trusted manifest.",
  "下一步可以打开其他已支持的运行，或等待对应版本适配。":
    "Next, open another supported run or wait for an adapter for this version.",
  "关联请求、资源与网络证据，查看后端报告给出的延迟贡献、原因链和归因审计。":
    "Connect request, resource, and network evidence to inspect reported latency contributions, cause chains, and attribution audits.",
  "延迟因果排名只包含目标系统的已报告原因。统一仿真执行、校准验证和指标输出记录保留为审计证据，不作为延迟来源。":
    "Latency rankings contain reported causes from the modeled system. Simulation execution, calibration, validation, and metric output records remain audit evidence, not latency sources.",
  请求上下文: "Request context",
  "请求选择使用稳定 request ID，并在支持请求证据的分析页面之间保留。没有明确身份关联时，页面不按时间接近或文本相似度拼接证据。":
    "Request selection uses a stable request ID and is retained across compatible evidence views. Without explicit identities, the interface does not join evidence by time proximity or text similarity.",
  跨模块证据链: "Cross-module evidence",
  "请求证据连接运行时、并列资源操作和网络阶段。KV Cache、设备与集合通信保持并列；已绑定、部分证据、缺失和引用无效是不同状态。":
    "Request evidence links the runtime, peer resource operations, and network phases. KV Cache, device, and collective concerns remain peers. Bound, partial, missing, and invalid references are distinct states.",
  贡献排名: "Contribution ranking",
  "尾延迟归因保留报告顺序、排名与占比。占比条使用固定范围，不重新归一化；报告没有给出的贡献项不会补入排名。":
    "Tail attribution preserves reported order, ranks, and shares. Share bars use a fixed range without renormalization; unreported contributions are not added to the ranking.",
  归因审计: "Attribution audit",
  "审计用于检查守恒、传播和引用完整性。守恒通过不代表传播链完整，报告置信度也不等于真实系统预测准确率。":
    "Audits check conservation, propagation, and reference integrity. Passing conservation does not establish complete propagation, and reported confidence is not real-system prediction accuracy.",
  延迟因果排名: "Latency causal ranking",
  "后端报告给出的延迟原因排序，不包含仿真控制平面与结果输出记录。":
    "Reported ordering of latency causes, excluding the simulation control plane and result-output records.",
  原始记录与复核: "Source records and verification",
  "原始证据通过运行 ID、工件、Schema、SHA-256 和 JSON Pointer 定位。原因链是报告提供的解释，不能单独替代真实系统因果实验。":
    "Source evidence is located by run ID, artifact, schema, SHA-256, and JSON Pointer. A reported cause chain does not replace causal experiments on a real system.",
  "比较候选配置的报告指标、排名和细化结果，并核对每个变量的实际执行范围。":
    "Compare reported metrics, rankings, and refinement results for candidate configurations, including the executed scope of each variable.",
  "候选排名只在当前负载、模型、执行范围和仿真精度内成立，不代表全系统或真实硬件最优。进入更高精度阶段不等于完成校准。":
    "Candidate rankings apply only to the current workload, model, execution scope, and fidelity. They do not establish real-hardware or whole-system optimality. Higher-fidelity refinement is not calibration.",
  "当比较仅执行网络配置时，未执行的运行时、缓存、设备或集合通信变量保留 unresolved_not_executed。不能把候选配置中出现的变量全部视为已经模拟。":
    "When a comparison executes only network configuration, unexecuted runtime, cache, device, or collective variables retain unresolved_not_executed. Presence in a candidate configuration does not establish execution.",
  候选与细化阶段: "Candidates and refinement",
  "候选数量、筛选和细化记录说明实际参与比较的方案。Analytical 用于广泛筛选，DES 用于动态行为分析，Cycle 用于具备条件的局部机制细化；当前可用阶段以报告为准。":
    "Candidate, screening, and refinement records identify the options actually compared. Analytical supports broad screening, DES resolves dynamic behavior, and Cycle refines eligible local mechanisms. Available stages follow the report.",
  排名与多目标比较: "Rankings and multiple objectives",
  "排名、P95/P99 和 Pareto 集直接来自报告。比较需要同时考虑指标方向、实际执行范围以及候选是否进入后续细化。":
    "Rankings, P95/P99, and Pareto membership come directly from the report. Compare metric direction, executed scope, and whether candidates were promoted for refinement.",
  候选配置与证据: "Candidate configuration and evidence",
  "候选记录区分请求参数和实际采用参数。复现时保留 candidate ID、输入配置及对应报告，不根据显示结果反推未报告参数。":
    "Candidate records distinguish requested from resolved parameters. Preserve the candidate ID, input configuration, and report for reproduction; do not infer unreported parameters from displayed results.",
  "本次运行实际执行和比较的模块与参数范围。": "The modules and parameters actually executed and compared in the run.",
  "使用 manifest、Schema、SHA-256、JSON Pointer 以及原始排名字段核查候选。前端不扩写未执行变量，也不重新计算最优方案。":
    "Verify candidates through the manifest, schema, SHA-256, JSON Pointer, and original ranking fields. The frontend neither extends unexecuted variables nor recomputes an optimal candidate.",
  "基于当前运行可引用的证据生成分析草稿，并逐条核对陈述、引用和适用范围。":
    "Generate an analysis draft from citable evidence in the current run, then review each claim, citation, and scope.",
  "生成内容需用户确认。AI 草稿不修改确定性报告，不补造模拟事实；引用结构通过校验也不代表陈述含义已经得到人工验证。":
    "Generated content requires user confirmation. AI drafts do not modify deterministic reports or invent simulation facts. Valid citation structure does not establish human verification of a claim’s meaning.",
  服务与证据状态: "Service and evidence status",
  "证据就绪与模型服务可用是独立条件。服务不可用时仍可查阅原始报告；能力探测、测试夹具和真实模型请求不能作为同一种验收证据。":
    "Evidence readiness and model-service availability are separate conditions. Original reports remain available when the service is unavailable. Capability probes, test fixtures, and real model requests are distinct forms of evidence.",
  "选择当前运行中的请求后，提交预览显示可引用证据及执行边界。稳定 request ID 与证据快照共同约束解释范围。":
    "After selecting a request, the submission preview shows citable evidence and execution boundaries. The stable request ID and evidence snapshot constrain the explanation’s scope.",
  问题与提交: "Questions and submission",
  "问题应限定于已有指标、归因或证据限制。提交前核对来源范围和等待上限；帮助文档不会发送模型请求、自动重试或更换服务配置。":
    "Limit questions to existing metrics, attribution, or evidence limitations. Review source scope and timeout limits before submission. Help documentation does not send model requests, retry, or change service configuration.",
  草稿与引用复核: "Draft and citation review",
  "结论、限制和条件建议分别列出。通过引用核对运行、工件、SHA-256 与 JSON Pointer；失效绑定、拒答、部分结果和截断不能视为完整有效回答。":
    "Findings, limitations, and conditional recommendations are separated. Verify the run, artifact, SHA-256, and JSON Pointer for each citation. Stale bindings, refusals, partial results, and truncation are not complete valid answers.",
  确定性报告: "Deterministic report",
  "仿真与报告处理流程生成的结构化输出；内容仍受来源、校准和证据范围约束。":
    "Structured output from simulation and report processing, constrained by source, calibration, and evidence scope.",
  "服务详情保留 descriptor、Provider/model identity、保留策略和错误状态。排查重复提交时应保留原始请求及幂等 key；不要把新的 key 当作原请求的重试。":
    "Service details retain the descriptor, provider/model identity, retention policy, and error state. Preserve the original request and idempotency key when investigating duplicate submissions; a new key is not a retry of the original request.",
  "查看证据覆盖、校准工作流、字段来源以及固定工具调用编排，用于复现和审计。":
    "Inspect evidence coverage, calibration workflows, field lineage, and fixed tool-call orchestration for reproduction and audit.",
  "真实轨迹验证、合成一致性检查和兼容性辅助轨迹提取不是同一种证据。固定示例工作流的成功不能替代真实校准或独立验证。":
    "Real-trace validation, synthetic consistency, and compatibility-harness extraction are different evidence types. A successful fixed example workflow does not replace real calibration or held-out validation.",
  证据覆盖: "Evidence coverage",
  "证据地图按建模边界列出来源、可用性和缺口。未覆盖项必须保留，不应通过相邻模块已有数据推定其可用。":
    "The evidence map lists sources, availability, and gaps by modeling boundary. Keep uncovered items explicit rather than inferring availability from neighboring modules.",
  校准工作流: "Calibration workflow",
  "工作流记录输入、处理阶段和检查结果。真实测量校准、离线示例和未校准状态分别标识；示例运行不产生正式校准资产的等价声明。":
    "Workflow records describe inputs, processing stages, and checks. Real-measurement calibration, offline examples, and uncalibrated states are distinct; running an example does not establish equivalent calibration assets.",
  字段来源与转换: "Field sources and transformations",
  "字段血缘连接输入、转换规则与输出位置。核查时保持来源模式、单位和无损整数表示一致，避免把推断字段表述为直接观测。":
    "Field lineage links inputs, transformation rules, and output locations. Preserve source modes, units, and lossless integers, and do not describe inferred fields as direct observations.",
  固定工具编排: "Fixed tool orchestration",
  "固定编排展示可复现的调用顺序与结果。它不是生成式 Agent，不会创建新的根因结论；执行状态以各阶段报告为准。":
    "Fixed orchestration records reproducible call order and results. It is not a generative agent and does not create new root-cause conclusions. Execution state follows the stage reports.",
  "使用真实测量调整模型参数。合成示例只能用于流程或内部一致性检查。":
    "Adjusting model parameters using real measurements. Synthetic examples support workflow or internal consistency checks only.",
  "使用 schema-set revision、backend identity、SHA-256、JSON Pointer 和原始契约复核处理链。uint64 ps、bytes 与 count 保持无损。":
    "Use the schema-set revision, backend identity, SHA-256, JSON Pointer, and original contracts to verify the processing chain. Keep uint64 picoseconds, bytes, and counts lossless.",
  "查看请求、运行时、执行语义、资源操作与网络活动在统一仿真时间轴上的组织及对应报告。":
    "Inspect requests, runtime decisions, execution semantics, resource operations, and network activity on the shared simulation timeline.",
  "KV Cache、设备性能和集合通信是并列资源语义。仿真执行与控制平面管理时间和状态推进，不是第六个目标系统层，也不是延迟因果来源。":
    "KV Cache, device performance, and collective communication are peer resource concerns. The simulation execution and control plane manages time and state transitions; it is neither a sixth target-system layer nor a latency cause.",
  执行结构: "Execution structure",
  "工作负载与请求进入推理引擎和服务运行时，由执行语义建模形成执行片段，再关联 KV Cache、设备和集合通信等资源操作。通信需求汇入网络与硬件资源模型。":
    "Workloads and requests enter the inference engine and serving runtime. Execution-semantic modeling produces execution fragments associated with KV Cache, device, and collective operations. Communication demands converge on the network and hardware resource model.",
  环节选择: "Stage selection",
  "选择执行结构中的环节，可查看当前运行已报告的指标、记录与可视化。不同环节的可用字段取决于报告覆盖范围。":
    "Select a stage to view its reported metrics, records, and visualizations for the current run. Available fields depend on report coverage.",
  指标与执行记录: "Metrics and execution records",
  "摘要指标用于定位等待和通信开销；结构化记录提供时间、稳定标识与依赖关系。网络完成或反压可通过资源操作与执行依赖影响运行时推进和请求指标。":
    "Summary metrics help locate waits and communication costs. Structured records provide timing, stable identities, and dependencies. Network completion or backpressure can affect runtime progress and request metrics through resource operations and execution dependencies.",
  "执行详情记录统一时间轴上的状态推进。Analytical、DES、Cycle 是精度后端，不是业务层；Tile 是建模粒度，不是独立系统层或生命周期对象。":
    "Execution details describe state transitions on the shared timeline. Analytical, DES, and Cycle are fidelity backends, not business layers. Tile is a modeling granularity, not an independent system layer or lifecycle object.",
  "KV Cache": "KV Cache",
  "保存注意力计算所需的键值状态。物理块、驻留和数据就绪属于资源语义。":
    "Stores key/value state used by attention. Physical blocks, residency, and data readiness belong to resource semantics.",
  "多个设备参与的归约、广播等通信语义，与缓存及设备性能建模并列。":
    "Communication operations such as reduction and broadcast across devices, modeled alongside cache and device performance.",
  "管理统一时间轴、状态提交、等待与反馈以及精度后端。":
    "Manages the shared timeline, state commits, waits, feedback, and fidelity backends.",
  "复核执行记录时核对 Schema、字段来源、SHA-256 和 JSON Pointer。关联记录只支持其已声明的证据范围，不自动构成真实系统执行轨迹。":
    "Check schemas, field sources, SHA-256, and JSON Pointers when reviewing execution records. Associated records support only their declared evidence scope and do not automatically constitute a real-system execution trace.",
  "配置工作负载、Trace package、运行时和网络参数，检查仿真能力与请求预览后提交实验。":
    "Configure the workload, trace package, runtime, and network, then review supported simulation capabilities and the request before submission.",
  "输入来源与仿真精度是独立维度。合成轨迹和兼容性辅助轨迹不能因采用更高精度后端而升级为真实测量证据。":
    "Input source and simulation fidelity are independent dimensions. A higher-fidelity backend does not turn synthetic or compatibility-harness traces into measured evidence.",
  实验名称与场景: "Experiment name and scenario",
  "实验名称用于运行记录中的识别。场景决定可配置字段、默认值和适用条件；切换场景后应重新检查参数预览。":
    "The name identifies the experiment in run history. The scenario determines available fields, defaults, and applicability. Review the parameters again after changing scenarios.",
  "输入与 Trace package": "Inputs and trace packages",
  "输入包括工作负载、运行时和网络配置。使用 Trace package 时，应核对来源模式、校准级别、观测与推断字段以及允许声明范围。网络流轨迹描述通信需求，不代表模拟网络已经执行的路径或拥塞状态。":
    "Inputs cover workload, runtime, and network configuration. For a trace package, check its source mode, calibration level, observed versus inferred fields, and allowed claims. A network-flow trace describes communication demand, not a path or congestion state already executed by the simulated network.",
  仿真精度与能力: "Fidelity and capabilities",
  "requested fidelity 表示请求精度，resolved fidelity 表示实际采用的精度。Analytical、DES、Cycle 的可用范围以服务能力和各环节的执行配置为准。":
    "Requested fidelity is the requested level of detail; resolved fidelity is the level actually used. Available Analytical, DES, and Cycle coverage depends on service capabilities and each stage’s execution configuration.",
  "预览、校验与提交": "Preview, validation, and submission",
  "提交前核对必填字段、单位、输入来源及实际执行范围。校验错误指向对应字段；帮助文档不会修改参数、补全缺失证据或代为提交实验。":
    "Before submitting, review required fields, units, input sources, and execution scope. Validation errors identify the affected fields. Help documentation does not change parameters, supply evidence, or submit experiments.",
  "字段契约中的 field_id、JSON Pointer、Schema identity 和 capability 用于复现请求及排查校验问题。保留提交时的配置和输入身份。":
    "Use field_id, JSON Pointer, schema identity, and capability information to reproduce requests and diagnose validation errors. Retain the submitted configuration and input identities.",
  "分析网络域的利用率、排队与拥塞等待、请求贡献和已报告拓扑，定位通信相关瓶颈。":
    "Analyze network-domain utilization, queueing and congestion waits, request contributions, and reported topology to locate communication bottlenecks.",
  "路径、队列和完成状态以网络执行报告为准。输入通信需求、模型推断与真实网络观测应保持独立标注。":
    "Paths, queues, and completion states come from network execution reports. Keep input communication demands, model inferences, and real-network observations distinctly labeled.",
  通信摘要: "Communication summary",
  "资源占用、等待时间和网络域覆盖情况提供运行层面的通信概况。未覆盖的网络域不应解释为没有流量或没有等待。":
    "Resource occupancy, wait times, and network-domain coverage summarize communication for the run. An uncovered domain does not imply zero traffic or zero waiting.",
  主要瓶颈: "Primary bottleneck",
  "主导网络域和延迟类型来自后端报告。报告未给出原因时，页面保留缺失状态，不根据图表颜色或数值接近推断拥塞原因。":
    "The dominant network domain and latency type come from the backend report. When a cause is not reported, it remains missing; chart colors and similar values do not establish congestion causes.",
  网络域比较: "Network-domain comparison",
  "在统一单位下比较不同网络域的利用率、排队与拥塞等待。纵向扩展和横向扩展网络的范围及拓扑层级以当前配置为准。":
    "Compare utilization, queueing, and congestion waits across domains using consistent units. Scale-up and scale-out scope and topology hierarchy follow the current configuration.",
  请求贡献与证据: "Request contributions and evidence",
  "请求贡献用于关联通信开销与请求上下文。通过原始证据链接核对报告位置，再结合慢请求原因页面分析等待传播。":
    "Request contributions connect communication costs with request context. Verify report locations through evidence links, then use attribution to examine wait propagation.",
  反压: "Backpressure",
  "下游资源无法继续接收或服务时，对上游传输与执行产生的等待反馈。":
    "Waiting feedback to upstream transmission and execution when downstream resources cannot accept or serve more work.",
  "拓扑和逐域记录提供 Schema identity、SHA-256 与 JSON Pointer。仅网络范围的结果不能扩写为未执行的运行时、缓存、设备或集合通信结论。":
    "Topology and domain records provide schema identities, SHA-256, and JSON Pointers. Network-only results do not establish conclusions about unexecuted runtime, cache, device, or collective behavior.",
  "查找和恢复实验上下文，查看运行状态，或选择两次已完成运行进行 A/B 对比。":
    "Find and restore experiment contexts, inspect run status, or select two completed runs for an A/B comparison.",
  "A/B 对比展示两次独立运行的已报告结果。比较前应确认工作负载、数据来源和实际仿真精度可比，缺失字段不能补为零。":
    "A/B comparison presents reported results from two independent runs. Check workload, source, and resolved-fidelity compatibility; missing fields must not be replaced with zero.",
  查找运行: "Finding a run",
  "运行名称、ID 和状态用于识别实验。名称便于阅读，稳定运行 ID 用于区分报告、输入和证据归属。":
    "Names, IDs, and status identify experiments. Names improve readability; stable run IDs distinguish ownership of reports, inputs, and evidence.",
  恢复实验上下文: "Restoring experiment context",
  "打开运行名称后，页面恢复该运行已验证的报告与输入。加载失败时应保留明确错误，不把失败状态解释为没有结果。":
    "Opening a run restores its verified reports and inputs. Loading failures must remain explicit errors rather than being interpreted as an absence of results.",
  "A/B 选择": "A/B selection",
  "依次选择 A 与 B 建立对照。两者是独立运行；比较工作区展示各自值和已支持的差异，不把两个运行的证据合并为一次实验。":
    "Select A and B to establish a comparison. They remain independent runs; the workspace displays their values and supported differences without merging evidence into a single experiment.",
  比较条件: "Comparison conditions",
  "负载、配置、Trace 来源与 resolved fidelity 的差异可能改变指标含义。零值、缺失、未覆盖和不适用应分别解释。":
    "Differences in workload, configuration, trace source, and resolved fidelity can change metric meaning. Interpret zero, missing, not covered, and not applicable separately.",
  "复现与审计需要运行 ID、backend identity、schema-set revision、工件 SHA-256 和原始报告。对比视图不重新执行仿真或改写结论。":
    "Reproduction and audit require run ID, backend identity, schema-set revision, artifact SHA-256, and original reports. The comparison view does not rerun simulation or rewrite conclusions.",
  "查看汇总延迟、吞吐和逐请求指标，并通过证据链接核查原始值、单位和指标定义。":
    "Review aggregate latency, throughput, and per-request metrics, with evidence links to verify raw values, units, and definitions.",
  "数值 0、缺失、未覆盖和不适用分别表达不同状态。比较结果时需要保持负载、来源和实际仿真精度可比。":
    "Zero, missing, not covered, and not applicable are distinct states. Comparisons require compatible workloads, sources, and resolved fidelity.",
  汇总指标: "Aggregate metrics",
  "TTFT 表示首 Token 等待，TPOT 表示后续 Token 的生成间隔，端到端延迟表示请求整体耗时。吞吐与尾延迟应结合负载条件一起解读。":
    "TTFT describes the wait for the first token, TPOT describes subsequent token-generation intervals, and end-to-end latency describes total request duration. Interpret throughput and tail latency alongside workload conditions.",
  指标证据: "Metric evidence",
  "证据入口定位到当前运行的报告字段。图表中的显示级单位换算不改变原始 ps 值，汇总指标不在前端重新计算。":
    "Evidence links locate report fields for the current run. Display-unit conversions in charts do not alter original picosecond values, and the frontend does not recompute aggregates.",
  逐请求比较: "Per-request comparison",
  "请求表保留请求标识及已报告指标。P95/P99 对象关联以报告提供的选择语义为准，不按相同数值或数组位置推断。":
    "The request table retains request identities and reported metrics. P95/P99 subject associations follow the report’s selection semantics, not equal values or array positions.",
  结果解释: "Interpreting results",
  "使用绝对延迟或吞吐进行规划前，应核对结果可信度、校准条件和未覆盖行为。合成一致性检查不能替代独立真实轨迹验证。":
    "Before using absolute latency or throughput for planning, review confidence, calibration conditions, and uncovered behavior. Synthetic consistency checks do not replace held-out real-trace validation.",
  "精确核查使用无损 uint64 ps、Schema identity、工件 SHA-256 和 JSON Pointer。缺失值不能替换为零后参与差值计算。":
    "For exact verification, use lossless uint64 picoseconds, schema identity, artifact SHA-256, and JSON Pointer. Do not substitute zero for missing values when calculating differences.",
  "运行概览汇总当前实验的执行状态、核心指标和报告限制，并提供执行、网络与验证分析的入口。":
    "The overview summarizes the current experiment’s execution status, core metrics, and report limitations, with links to execution, network, and validation analysis.",
  "运行完成表示执行结束，不代表模型已通过真实系统验证。指标应在报告声明的数据来源、校准状态和适用范围内使用。":
    "A completed run has finished executing; it does not establish real-system validation. Interpret metrics within the report’s declared source, calibration status, and scope.",
  运行状态与服务连接: "Run status and service connection",
  "当前实验区域显示运行名称及证据范围。服务连接状态与实验状态分别报告；未连接服务时，示例或导入报告不应视为已提交运行。":
    "The current-experiment area identifies the run and its evidence scope. Service connectivity and run status are reported separately. Offline examples and imported reports are not submitted runs.",
  核心指标: "Core metrics",
  "总时长、吞吐与请求完成数来自运行报告。数值缺失时保留缺失状态；验证完整度反映字段覆盖，不是预测准确率。":
    "Duration, throughput, and completed-request counts come from the run report. Missing values remain missing. Validation completeness describes field coverage, not prediction accuracy.",
  瓶颈摘要: "Bottleneck summary",
  "瓶颈摘要呈现后端报告给出的主要贡献项。需要核查具体请求或网络等待时，可进入慢请求原因或网络与通信页面查看对应证据。":
    "The summary presents the main contributors identified by the backend report. Use attribution or network analysis to inspect evidence for individual requests and network waits.",
  分析页面: "Analysis pages",
  "执行过程展示运行结构，性能指标用于比较请求表现，结果可信度列出校准状态和未关闭缺口。页面之间的分析应使用同一运行上下文。":
    "Execution shows run structure, metrics compare request performance, and result confidence lists calibration status and open gaps. Keep the same run context when moving between analyses.",
  "原始工件包含已登记的输入和报告。复核时核对运行 ID、Schema identity、SHA-256 和 JSON Pointer，确认摘要与原始字段一致。":
    "Registered artifacts contain inputs and reports. Verify the run ID, schema identity, SHA-256, and JSON Pointer when checking a summary against its source.",
  原始证据: "Raw evidence",
  "查看已登记工件的完整 JSON，通过搜索、字段定位和身份核对复核页面结论。":
    "Inspect complete JSON for registered artifacts and verify displayed conclusions through search, field navigation, and identity checks.",
  "查看器保留完整原始数据和复制内容。uint64 ps、bytes、count 不转换为有损 JavaScript number；搜索和定位不会改写字段。":
    "The viewer preserves original data and copied content. It does not convert uint64 picoseconds, bytes, or counts to lossy JavaScript numbers. Search and navigation do not modify fields.",
  加载原始报告: "Loading a source report",
  "展开原始证据区域后加载对应工件。未加载、不可用、身份不匹配和内容为空是不同状态，应依据具体提示处理。":
    "Expanding the evidence area loads the selected artifact. Not loaded, unavailable, identity mismatch, and empty content are distinct states with different explanations.",
  工件选择: "Artifact selection",
  "工件必须属于当前运行的可信清单。由页面证据链接进入时，核对 artifact ID 与当前选择，避免将其他运行的同名文件用于引用。":
    "Artifacts must belong to the current run’s trusted manifest. When following an evidence link, verify the artifact ID and selection rather than citing a same-named file from another run.",
  搜索与字段定位: "Search and field navigation",
  "JSON Pointer 定位精确字段，搜索标出匹配行。不存在的 Pointer 应保留为定位错误，不能改用相近字段代替。":
    "JSON Pointers locate exact fields, while search identifies matching lines. A missing Pointer remains a navigation error; do not substitute a nearby field.",
  引用身份: "Citation identity",
  "引用前核对 run、Schema identity、SHA-256 与 JSON Pointer。复制或导出的原始内容保持完整，不以可视区域的行数截断。":
    "Before citing, verify the run, schema identity, SHA-256, and JSON Pointer. Copied or exported source content remains complete rather than being limited to visible lines.",
  "完整身份链包括 backend identity、schema-set revision、Schema identity、工件 SHA-256、JSON Pointer 与原始字节。摘要匹配仅证明文件身份，不等于内容结论已经验证。":
    "The identity chain includes backend identity, schema-set revision, schema identity, artifact SHA-256, JSON Pointer, and original bytes. Matching digests establish file identity, not validation of its conclusions.",
  报告兼容性: "Report compatibility",
  "说明未知或不支持的报告结构如何处理，以及如何保留身份和原始证据用于后续复核。":
    "Understand how unknown or unsupported report structures are handled and how to retain identities and source evidence for review.",
  "不支持的 Schema 是兼容性边界，不等于无数据、数值零或运行失败。无法验证结构时停止语义解释，但保留原始证据。":
    "An unsupported schema is a compatibility boundary, not an absence of data, a zero value, or a failed run. Stop semantic interpretation when structure cannot be verified, while retaining source evidence.",
  兼容性状态: "Compatibility status",
  "未知 Schema、字段校验失败和工件被拒绝有不同原因。页面不会套用旧结构猜测新字段，也不会将未知结构渲染成正常空状态。":
    "Unknown schemas, field-validation failures, and rejected artifacts have different causes. The interface does not apply an old structure to guess new fields or present unknown structures as normal empty states.",
  报告身份: "Report identity",
  "保留受影响的报告类型、Schema identity 和具体问题位置，便于在受支持适配器更新后重新核查。":
    "Retain the affected report type, schema identity, and exact issue location for review after a supported adapter becomes available.",
  原始数据保留: "Retaining source data",
  "原始查看器保留字段内容，但不将未知字段解释为当前页面指标。原始数据可见不代表该结构已经受支持。":
    "The source viewer retains field content without interpreting unknown fields as supported metrics. Visible raw data does not imply structural support.",
  兼容性处理: "Handling incompatibility",
  "可以查看其他受支持的运行，或通过正式版本化适配器处理该报告。不要降低 Schema 标识或修改字段绕过校验。":
    "Inspect another supported run or use an officially supported versioned adapter. Do not lower schema identifiers or alter fields to bypass validation.",
  "兼容性复核需要 Schema、backend identity、schema-set revision、工件 SHA-256、JSON Pointer 与原始字节。修复应发生在明确的适配契约中，而不是帮助层。":
    "Compatibility review requires the schema, backend identity, schema-set revision, artifact SHA-256, JSON Pointer, and original bytes. Fixes belong in explicit adapter contracts, not the help layer.",
  "核对数据来源、校准与验证状态、实际仿真精度和证据缺口，确定当前结果能够支持的结论。":
    "Review data sources, calibration and validation status, resolved fidelity, and evidence gaps to determine which claims the results support.",
  "synthetic consistency 是合成一致性检查，不能表述为 held-out validation。真实轨迹、合成轨迹与兼容性辅助轨迹保持独立来源标注。":
    "Synthetic consistency is an internal consistency check, not held-out validation. Real, synthetic, and compatibility-harness traces retain separate source labels.",
  结论适用范围: "Scope of claims",
  "结论范围由报告中的来源、校准和验证证据共同限定。探索性结果、有限外推、条件预测与真实校准验证不能混为同一等级。":
    "Claim scope is constrained by the report’s source, calibration, and validation evidence. Exploration, limited extrapolation, conditional prediction, and real calibrated validation are not interchangeable.",
  未关闭缺口: "Open gaps",
  "未关闭缺口可能限制指标解释或场景覆盖。缺失、未覆盖、不适用和不支持的 Schema 分别保留；未覆盖不能按数值零处理。":
    "Open gaps may limit metric interpretation or scenario coverage. Missing, not covered, not applicable, and unsupported-schema states remain distinct. Uncovered values must not be treated as zero.",
  来源与校准: "Sources and calibration",
  "real_trace 表示真实系统采集；synthetic_trace 表示生成数据；compatibility_harness_trace 表示兼容性或语义仿真提取。采集来源不自动证明已经完成校准，校准也不替代独立留出验证。":
    "real_trace denotes captured system traces; synthetic_trace denotes generated data; compatibility_harness_trace denotes compatibility or semantic-emulation extraction. Capture alone does not establish calibration, and calibration does not replace independent held-out validation.",
  请求精度与实际精度: "Requested and resolved fidelity",
  "requested fidelity 与 resolved fidelity 分别表示目标和实际采用的精度。Analytical、DES、Cycle 的含义取决于实际执行后端；GPU 参与本身不代表周期级保真度。":
    "Requested and resolved fidelity identify the target and the level actually used. Analytical, DES, and Cycle refer to the executed backend; GPU participation alone does not imply cycle-level fidelity.",
  "逐项验证记录提供检查结果与原始字段位置。使用 Schema identity、SHA-256 和 JSON Pointer 复核证据时，应同时记录验证场景与未覆盖范围。":
    "Individual validation records provide outcomes and source-field locations. When checking schema identities, SHA-256, and JSON Pointers, retain the validated scenario and uncovered scope.",
  帮助文档: "Documentation",
  关闭帮助: "Close help",
  帮助主题: "Help topics",
  搜索帮助主题: "Search help topics",
  实验与输入: "Experiments and inputs",
  结果分析: "Result analysis",
  证据与校准: "Evidence and calibration",
  参考资料: "Reference",
  "没有匹配的帮助主题。": "No matching help topics.",
  当前页面: "Current page",
  产品文档: "Product documentation",
  打开此页面: "Open this page",
  本文目录: "On this page",
  术语与定义: "Terms and definitions",
  适用范围与证据边界: "Scope and evidence boundaries",
  在页面中查看: "Locate on page",
  相关页面: "Related pages",
  使用说明: "Usage documentation",
  原始证据帮助: "Raw evidence help",
};
