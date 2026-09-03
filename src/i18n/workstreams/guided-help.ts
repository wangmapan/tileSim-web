// Guided-help copy is isolated here so this workstream does not edit the shared legacy catalog.
export const guidedHelpEnglishCatalog: Readonly<Record<string, string>> = {
  重点: "Key takeaway",
  开始逐步指引: "Start step-by-step guide",
  查看使用指引: "View usage guide",
  查看原始证据指引: "View raw-evidence guide",
  页面逐步指引: "Page guide",
  关闭指引: "Close guide",
  指引步骤: "Guide steps",
  "第 {current} / {total} 步": "Step {current} of {total}",
  定位到页面位置: "Locate on page",
  "此步骤对应的内容在当前页面状态下暂不可见。": "This step's content is not visible in the current page state.",
  术语解释: "Glossary",
  完成本页后: "After this page",
  跳过指引: "Skip guide",
  上一步: "Previous",
  完成: "Finish",
  "第 {current} 步：{title}": "Step {current}: {title}",

  "限制提示与后端报告的当前重点，是进入其他分析页前最重要的上下文。":
    "Limit notices and the backend-reported focus are the essential context before deeper analysis.",
  "下一步：查看执行过程": "Next: View execution flow",
  最后再看原始工件: "Inspect raw artifacts last",
  "需要审计时再展开原始工件，并核对 Schema identity、artifact SHA-256、JSON Pointer 和完整 JSON。":
    "For audits, expand raw artifacts and verify the schema identity, artifact SHA-256, JSON Pointer, and complete JSON.",
  确认运行状态和证据限制: "Confirm run status and evidence limits",
  "先读结果摘要；如果标记为证据范围受限，只把结果用于趋势观察和方案探索。":
    "Read the result summary first. If evidence is limited, use the result only for trends and option exploration.",
  查看四个关键数字: "Review the four key numbers",
  "从总时长、吞吐和请求完成数开始；验证完整度表示字段覆盖，不是准确率。":
    "Start with total duration, throughput, and completed requests; validation completeness is field coverage, not accuracy.",
  阅读本次重点: "Read this run's focus",
  "主瓶颈来自后端报告。页面只呈现这项结论，不会在前端重新计算或猜测原因。":
    "The primary bottleneck comes from the backend report. The page presents it without recalculating or guessing.",
  选择下一条分析路径: "Choose the next analysis path",
  "想看请求如何运行就进入执行过程；想比较速度就进入性能指标；想核对限制就进入结果可信度。":
    "Use Execution flow for request progression, Performance metrics for speed, or Result confidence for limitations.",
  "单位时间内完成的请求数量，通常与延迟一起判断。":
    "The number of requests completed per unit time, normally interpreted with latency.",
  "需要的验证字段被覆盖的比例；它不是模型准确率，也不等于真实硬件验证。":
    "The share of required validation fields covered; it is neither model accuracy nor real-hardware validation.",

  "先确认数据来源、请求精度和最终可用精度，再提交实验。":
    "Confirm data source, requested fidelity, and resolved fidelity before submitting.",
  "下一步：运行完成后查看概览": "Next: View the overview after completion",
  最后再看字段契约: "Inspect field contracts last",
  "排查提交问题时再查看 field_id、request JSON Pointer、Schema identity 与 capability；这些信息不会改变 Provider 或 Bridge 行为。":
    "When troubleshooting submission, inspect field_id, request JSON Pointer, schema identity, and capability; they do not alter Provider or Bridge behavior.",
  给实验命名并选择场景: "Name the experiment and choose a scenario",
  "名称用于稍后在运行记录中查找；场景决定可用字段和默认值。":
    "The name helps find the run later; the scenario determines available fields and defaults.",
  按顺序检查输入: "Review inputs in order",
  "先确认工作负载和 trace 来源，再检查运行时与网络配置；不熟悉的字段可以保留 descriptor 提供的默认值。":
    "Confirm workload and trace source, then runtime and network settings; keep descriptor defaults for unfamiliar fields.",
  分开看请求精度和最终精度: "Separate requested and resolved fidelity",
  "requested fidelity 是你提出的目标，resolved fidelity 是各环节实际可执行的精度，两者可能不同。":
    "Requested fidelity is the target; resolved fidelity is what each stage can execute, and they may differ.",
  运行前核对预览: "Review the preview before running",
  "确认必填项、适用性和输入来源无误后再运行；错误会指向稳定字段，而不是由帮助层改写请求。":
    "Run only after checking required fields, applicability, and source; errors point to stable fields without help-layer rewrites.",
  "trace 来源": "Trace source",
  "real_trace、synthetic_trace 与 compatibility_harness_trace 是不同来源，不能互相升级。":
    "real_trace, synthetic_trace, and compatibility_harness_trace are distinct sources and cannot be upgraded into one another.",
  "Analytical / DES / Cycle": "Analytical / DES / Cycle",
  "它们是仿真精度层级；Cycle 只适用于真实实现的热点细化，不代表全栈都达到周期级。":
    "These are fidelity tiers; Cycle applies only to implemented hotspot refinement, not the entire stack.",

  "从输入、调度和执行计划，进入并列资源语义，再汇合到网络；专业记录按需展开。":
    "Follow input, scheduling, and execution plan into peer resource semantics and then the network; expand technical records as needed.",
  "S3、S4、S5 是并列资源环节；S7 只负责把执行放在同一时间轴上。":
    "S3, S4, and S5 are peer resource stages; S7 only hosts execution on one timeline.",
  "下一步：查看性能指标": "Next: View performance metrics",
  最后再看实现证据: "Inspect implementation evidence last",
  "只有审计时才需要 Schema、字段来源、SHA-256、Pointer、结构化记录和完整 JSON；帮助层不会把关联证据升级成 canonical trace。":
    "Only audits need schema, field sources, SHA-256, Pointer, structured records, and full JSON; help never upgrades related evidence into a canonical trace.",
  从左到右阅读执行路线: "Read the execution path left to right",
  "先看 S0 → S1 → S2，再看并列的 S3/S4/S5，最后看 S6；不要把三个资源环节读成顺序链。":
    "Read S0 → S1 → S2, then peer S3/S4/S5, and finally S6; do not read the three resource stages as a sequence.",
  点击一个环节: "Select a stage",
  "选择节点后，下方只显示该环节在当前运行中的指标、状态和可视化。":
    "After selecting a node, the section below shows only that stage's current-run metrics, state, and visuals.",
  先读指标再看记录: "Read metrics before records",
  "先读指标，再看记录": "Read metrics before records",
  "先读已报告的关键指标；结构化记录和字段边界只在需要追踪时展开。":
    "Read reported key metrics first; expand structured records and field boundaries only for tracing.",
  按需查看S7执行宿主: "Inspect the S7 execution host when needed",
  "按需查看 S7 执行宿主": "Inspect the S7 execution host when needed",
  "S7 记录各环节在统一模拟时间轴上的开始和结束，不是新的业务层，也不进入延迟因果排名。":
    "S7 records stage start and end times on one simulation timeline; it is not a business layer or latency cause.",
  "KV 缓存（S3）": "KV cache (S3)",
  "保存生成过程中注意力所需的键值状态，属于内存语义。":
    "Stores attention key/value state during generation and belongs to memory semantics.",
  "多个设备协同完成的广播、归约等通信语义。":
    "Communication semantics such as broadcast and reduction performed across devices.",
  "让多个子系统共享同一模拟时间轴的执行环境。":
    "The execution environment that lets subsystems share one simulation timeline.",

  "先看汇总延迟和吞吐，再比较单个请求；精确 ps 原值始终按无损路径展示。":
    "Review summary latency and throughput, then individual requests; exact ps values stay lossless.",
  "延迟越低、吞吐越高通常越好，但 0、missing 和不适用必须分别解释。":
    "Lower latency and higher throughput are usually better, but 0, missing, and not applicable are distinct.",
  "下一步：分析慢请求原因": "Next: Analyze slow-request causes",
  最后再看精确证据: "Inspect exact evidence last",
  "审计时再核对无损 uint64 ps、Schema identity、artifact SHA-256 和 JSON Pointer；不要把 missing 当成 0。":
    "For audits, verify lossless uint64 ps, schema identity, artifact SHA-256, and JSON Pointer; never treat missing as 0.",
  先读汇总指标: "Read summary metrics first",
  "吞吐表示完成速度；TTFT、TPOT 和端到端 P95/P99 分别回答不同的等待问题。":
    "Throughput shows completion rate; TTFT, TPOT, and end-to-end P95/P99 answer different latency questions.",
  需要时打开指标证据: "Open metric evidence when needed",
  "每个汇总指标都有稳定证据入口；它指向后端报告字段，不由前端重算。":
    "Each summary metric has a stable evidence link to a backend field and is not recalculated in the frontend.",
  比较单个请求: "Compare individual requests",
  "在请求表中寻找尾部慢请求，并区分真实的零值、缺失值和不适用状态。":
    "Find tail requests in the table and distinguish real zero, missing, and not-applicable states.",
  结合证据边界解释: "Interpret with evidence boundaries",
  "指标必须与负载、trace 来源、requested/resolved fidelity 和结果可信度一起判断。":
    "Interpret metrics with workload, trace source, requested/resolved fidelity, and result confidence.",
  TTFT: "TTFT",
  "从请求到达至首个 Token 返回的时间。": "Time from request arrival to the first returned token.",
  TPOT: "TPOT",
  "首个 Token 之后，连续生成每个 Token 的平均间隔。":
    "Average interval between generated tokens after the first token.",
  "P95 / P99": "P95 / P99",
  "95% / 99% 的样本不超过该值，用于观察尾延迟。":
    "The value not exceeded by 95% / 99% of samples, used to examine tail latency.",

  "先看后端报告的主要通信瓶颈，再比较网络域和请求贡献；拓扑与契约按需展开。":
    "Start with the backend-reported communication bottleneck, then compare domains and request contributions; expand topology and contracts as needed.",
  "主导域、排队等待和拥塞等待都来自后端证据，前端不会猜测网络原因。":
    "The dominant domain, queueing, and congestion waits all come from backend evidence; the frontend does not guess causes.",
  "下一步：查看慢请求原因": "Next: View slow-request causes",
  最后再看拓扑与契约: "Inspect topology and contracts last",
  "审计时再展开逐域 topology、Schema identity、SHA-256 和 Pointer；S6 结果不能扩写成未执行的 S1/S3/S4/S5 原因。":
    "For audits, expand per-domain topology, schema identity, SHA-256, and Pointer; S6 results cannot be expanded into unexecuted S1/S3/S4/S5 causes.",
  先看总体通信状态: "Review overall communication status",
  "资源占用、最长等待和通信范围数量用于判断是否值得继续深入。":
    "Utilization, longest wait, and communication-scope count indicate whether deeper analysis is useful.",
  阅读当前主要通信瓶颈: "Read the main communication bottleneck",
  "主导域和主导延迟类型是后端明确报告的重点；缺失时页面不会补造。":
    "The dominant domain and delay type are explicitly reported by the backend; the page does not fabricate missing values.",
  比较通信范围: "Compare communication scopes",
  "按相同单位比较各网络域的占用和等待，并把 not covered 与实际零等待分开。":
    "Compare domain utilization and waits in the same units, keeping not covered distinct from an actual zero wait.",
  查看请求贡献: "Review request contributions",
  "需要定位尾部请求时再查看 request contribution，并沿证据链接返回原始字段。":
    "Use request contribution to locate tail requests, then follow evidence links to original fields.",
  背压: "Backpressure",
  "下游资源忙时，上游传输被迫等待的现象。":
    "A condition where busy downstream resources force upstream transfers to wait.",
  "请求已经到达通信资源，但尚未开始服务的等待。":
    "Time after a request reaches a communication resource but before service starts.",
  "多条通信竞争有限链路或缓冲区造成的额外等待。":
    "Additional wait caused by transfers competing for limited links or buffers.",

  "选择一个请求后，沿后端报告中的证据查看各环节贡献；页面不会自行推断因果。":
    "Select a request and follow backend-reported evidence across stages; the page does not infer causality.",
  "只把 S0–S6 的明确归因项放进 latency causal ranking；S7、S8、S9 不是延迟原因。":
    "Only explicit S0–S6 attribution items belong in the latency causal ranking; S7, S8, and S9 are not latency causes.",
  "下一步：核对结果可信度": "Next: Check result confidence",
  最后再看归因契约: "Inspect attribution contracts last",
  "审计时再核对 subject、artifact、Schema、SHA-256 与 Pointer；S7/S8/S9 只作为执行、验证和输出证据，不进入 causal ranking。":
    "For audits, verify subject, artifact, schema, SHA-256, and Pointer; S7/S8/S9 are execution, validation, and output evidence, not causal ranking entries.",
  先选择一个请求: "Select a request first",
  "请求选择会在指标、归因、执行和 AI 解释之间共享；没有稳定 request ID 时不会拼接证据。":
    "Request selection is shared across metrics, attribution, execution, and AI explanation; evidence is not joined without a stable request ID.",
  阅读主导原因排名: "Read the dominant-cause ranking",
  "排名和占比直接来自后端报告；先看第一项，再判断是否需要展开完整 cause chain。":
    "Ranking and share come directly from the backend report; start with the first item, then expand the cause chain if needed.",
  切换到尾延迟归因: "Switch to tail-latency attribution",
  "点击 S9 尾延迟归因，再阅读后端报告给出的主导原因排名和占比。":
    "Select S9 tail-latency attribution, then read the backend-reported dominant-cause ranking and shares.",
  沿跨子系统证据链核对: "Verify the cross-subsystem evidence chain",
  "S3/S4/S5 必须作为并列资源证据阅读，不能从时间接近或文本相似度推断连接。":
    "Read S3/S4/S5 as peer resource evidence; never infer joins from timing proximity or text similarity.",
  按需打开归因审计: "Open attribution audit when needed",
  "只有在复核结论时才查看稳定 ID、可用性原因和原始证据链接。":
    "Inspect stable IDs, availability reasons, and raw evidence links only when verifying a conclusion.",
  "causal ranking": "Causal ranking",
  "后端报告给出的延迟原因排序，不包含执行宿主和输出子系统。":
    "Backend-reported ordering of latency causes, excluding the execution host and output subsystems.",
  贡献占比: "Contribution share",
  "报告归给某项原因的相对份额；不能由前端重新聚合。":
    "The relative share the report assigns to a cause; the frontend cannot reaggregate it.",
  "cause chain": "Cause chain",
  "用稳定实体 ID 和证据引用串联的原因链。": "A cause chain connected by stable entity IDs and evidence references.",

  "数据来源、校准状态、requested/resolved fidelity 和未关闭缺口，决定结果可支持的结论范围。":
    "Data source, calibration, requested/resolved fidelity, and open gaps determine the supported claim scope.",
  "synthetic consistency 不能描述成 held-out validation，三种 trace 来源也不能相互升级。":
    "Synthetic consistency must not be described as held-out validation, and the three trace sources cannot be upgraded into one another.",
  "下一步：回到运行概览": "Next: Return to run overview",
  最后再看验证契约: "Inspect validation contracts last",
  "审计时再展开逐项检查、Schema identity、SHA-256、Pointer 和完整报告；S8/S9 是验证与输出子系统，不是延迟原因。":
    "For audits, expand checks, schema identity, SHA-256, Pointer, and the full report; S8/S9 validate and output, not cause latency.",
  先读可支持的结论范围: "Read the supported claim scope first",
  "确认当前结果只适合探索、可以比较方案，还是具备独立真实数据验证。":
    "Determine whether the result supports exploration, option comparison, or independent real-data validation.",
  优先查看未关闭缺口: "Review open gaps first",
  "open gap 会限制结论强度；missing、not covered、not applicable 和 unsupported schema 各有不同含义。":
    "An open gap limits claim strength; missing, not covered, not applicable, and unsupported schema have distinct meanings.",
  核对数据来源和校准: "Check data source and calibration",
  "real_trace、synthetic_trace 和 compatibility_harness_trace 必须按原 provenance 显示；离线 fixture 不是硬件校准。":
    "real_trace, synthetic_trace, and compatibility_harness_trace retain their provenance; an offline fixture is not hardware calibration.",
  展开各环节最终精度: "Expand each stage's resolved fidelity",
  "requested fidelity 与 resolved fidelity 分开阅读；Analytical 或 DES 不能因为目标较高就显示成 Cycle。":
    "Read requested and resolved fidelity separately; Analytical or DES cannot be shown as Cycle because the target was higher.",
  "held-out validation": "Held-out validation",
  "用未参与校准的独立真实 trace 或测量验证结果。":
    "Validation using independent real traces or measurements not used for calibration.",
  "synthetic consistency": "Synthetic consistency",
  "检查合成数据内部是否一致，不证明真实硬件准确性。":
    "Checks internal consistency of synthetic data; it does not prove real-hardware accuracy.",
  "not covered": "Not covered",
  "报告范围没有覆盖该项；它不等于数值为 0。": "The report scope does not cover this item; it is not a numeric zero.",

  "先看排名、P95/P99 与实际比较范围，再按需展开 Pareto 和专业证据。":
    "Start with ranking, P95/P99, and actual comparison scope, then expand Pareto and technical evidence as needed.",
  "第 1 名只在当前模拟条件和当前执行范围内更优，不代表完整系统或真实硬件最优。":
    "Rank 1 is better only under the current simulated conditions and execution scope, not for the full system or real hardware.",
  "下一步：新建一个对照实验": "Next: Create a control experiment",
  最后再看候选契约: "Inspect candidate contracts last",
  "需要审计时再查看算法、manifest、Schema、SHA-256、Pointer、analytical_rank 和 final_rank；前端不会扩写未执行变量。":
    "For audits, inspect algorithm, manifest, schema, SHA-256, Pointer, analytical_rank, and final_rank; the frontend does not expand unexecuted variables.",
  确认实际比较范围: "Confirm the actual comparison scope",
  "当前设计空间只执行 S6 时，S1/S3/S4/S5 候选变量仍是 unresolved_not_executed。":
    "When the design space executes only S6, S1/S3/S4/S5 candidate variables remain unresolved_not_executed.",
  查看候选数量和细化数量: "Review candidate and refinement counts",
  "先确认有多少方案参与分析，以及哪些方案进入了更细的模拟。":
    "Confirm how many options were analyzed and which entered higher-detail simulation.",
  比较排名和尾延迟: "Compare ranking and tail latency",
  "排名直接来自后端报告；先看 P95/P99，再看是否进入 Pareto 集和更高精度阶段。":
    "Ranking comes from the backend report; compare P95/P99, then Pareto membership and higher-fidelity stages.",
  按需核对候选证据: "Verify candidate evidence when needed",
  "只在复现或审计时展开 requested/resolved knobs、candidate ID 和原始 artifact 记录。":
    "Expand requested/resolved knobs, candidate ID, and raw artifact records only for reproduction or audit.",
  "Pareto 集": "Pareto set",
  "在多个目标上不存在被另一方案全面压倒的候选集合。":
    "Candidates that are not dominated by another option across all objectives.",
  "把少量候选提升到更高仿真精度继续比较，不代表结果已校准。":
    "Promotes a few candidates to higher simulation fidelity; it does not mean the result is calibrated.",
  execution_scope: "execution_scope",
  "本轮实际执行和比较的子系统范围。": "The subsystem scope actually executed and compared in this run.",

  "A/B 对比只比较两次独立运行的已报告结果，缺失字段不会被补成 0。":
    "A/B comparison uses reported results from two independent runs; missing fields are not filled with 0.",
  "下一步：新建对照实验": "Next: Create a control experiment",
  最后再核对身份: "Verify identities last",
  "复现时再查看 backend identity、schema-set revision、artifact SHA-256 和完整报告；比较层不重算模拟结论。":
    "For reproduction, inspect backend identity, schema-set revision, artifact SHA-256, and the full report; comparison does not recalculate simulation conclusions.",
  先找到目标实验: "Find the target experiment",
  "用名称、运行 ID 和完成状态确认实验；给实验命名可以减少后续误选。":
    "Confirm the experiment by name, run ID, and completion status; naming runs reduces later selection errors.",
  打开一次运行: "Open a run",
  "点击运行名称进入其结果；页面只恢复已验证的报告和输入上下文。":
    "Select the run name to view its results; the page restores only validated reports and input context.",
  "选择两个实验做 A/B 对比": "Select two experiments for A/B comparison",
  "先选择 A，再选择 B；只有用户开始选择后才显示比较工作区。":
    "Select A and then B; the comparison workspace appears only after selection begins.",
  检查比较是否公平: "Check whether the comparison is fair",
  "确认负载、来源和 resolved fidelity 可比；0、missing、not covered 与 not applicable 不应混为一项差值。":
    "Confirm comparable workload, source, and resolved fidelity; do not collapse 0, missing, not covered, and not applicable into one delta.",
  "A/B 对比": "A/B comparison",
  "把两次独立运行的同类已报告指标并排比较。":
    "Places comparable reported metrics from two independent runs side by side.",
  运行绑定: "Run binding",
  "报告、输入、artifact 清单与同一 run ID 的绑定关系。":
    "The binding of reports, inputs, and artifact manifest to the same run ID.",

  "AI 只读取当前实验中可引用的证据，不会修改 deterministic report；生成内容仍需用户确认。":
    "AI reads only citable evidence from the current run and never changes the deterministic report; users must confirm generated content.",
  "先选择请求，再提出一个可由现有证据回答的问题；AI 结果永远不能覆盖确定性报告。":
    "Select a request, then ask a question answerable by existing evidence; AI output never overrides the deterministic report.",
  "下一步：返回慢请求原因": "Next: Return to slow-request causes",
  最后再看服务契约: "Inspect service contracts last",
  "排查时再查看 descriptor、Provider/model identity、retention、409/502/503/504、Schema、SHA 和 Pointer；不要自动更换幂等 key。":
    "For troubleshooting, inspect descriptor, Provider/model identity, retention, 409/502/503/504, schema, SHA, and Pointer; never rotate the idempotency key automatically.",
  先确认AI服务是否可用: "Confirm AI service availability",
  "先确认 AI 服务是否可用": "Confirm AI service availability",
  "服务不可用时继续查看确定性报告；不要把 fixture 或草稿能力当成 live Provider 结果。":
    "When unavailable, continue with deterministic reports; never treat fixture or draft capability as a live Provider result.",
  选择要解释的请求: "Choose the request to explain",
  "只选择当前运行中具备稳定 request ID 和可引用证据的请求。":
    "Choose only a current-run request with a stable request ID and citable evidence.",
  提出范围明确的问题: "Ask a narrowly scoped question",
  "询问现有指标、归因或限制；AI 不能生成新的模拟事实或替代缺失证据。":
    "Ask about existing metrics, attribution, or limitations; AI cannot create simulation facts or replace missing evidence.",
  逐条核对回答和引用: "Verify each answer and citation",
  "生成内容保留“需用户确认”；按引用回到原报告，确认 run、artifact、SHA 和 Pointer 一致。":
    "Generated content remains user-confirmation-required; follow citations and verify run, artifact, SHA, and Pointer.",
  "deterministic report": "Deterministic report",
  "TileSim 与 Bridge 生成的结构化确定性报告，是模拟事实来源。":
    "The structured deterministic report generated by TileSim and Bridge, which is the source of simulation facts.",
  引用: "Citation",
  "把一条 AI claim 绑定到当前运行中已验证的 artifact 与字段位置。":
    "Binds an AI claim to a validated artifact and field location in the current run.",
  需用户确认: "User confirmation required",
  "AI 生成内容在人工核对前不能视为确定性结论。":
    "AI-generated content is not a deterministic conclusion until a person verifies it.",

  "日常查看结果不必先读这些技术信息；需要审计、复现或追踪转换时再使用。":
    "You do not need these technical details for routine review; use them for audit, reproduction, or transformation tracing.",
  "真实 trace 验证、合成一致性检查与 compatibility harness 提取是三种不同证据等级。":
    "Real-trace validation, synthetic consistency checks, and compatibility-harness extraction are distinct evidence levels.",
  最后再看身份与摘要: "Inspect identities and digests last",
  "审计时再核对 schema-set revision、backend identity、SHA-256、Pointer 和完整契约；uint64 ps/bytes/count 始终保持无损。":
    "For audits, verify schema-set revision, backend identity, SHA-256, Pointer, and full contracts; uint64 ps/bytes/count stay lossless.",
  先看证据地图: "Review the evidence map first",
  "确认 S0–S6 哪些边界有证据、来源是什么，以及哪些项目明确缺失或未覆盖。":
    "Confirm which S0–S6 boundaries have evidence, their sources, and which items are explicitly missing or not covered.",
  查看校准状态: "Review calibration status",
  "区分真实硬件校准、离线示例和未校准状态；示例运行不能升级成正式校准资产。":
    "Distinguish real-hardware calibration, offline examples, and uncalibrated states; examples cannot become formal calibration assets.",
  追踪字段血缘: "Trace field lineage",
  "从输入经过稳定转换到输出字段，核对 provenance、单位和无损整数路径。":
    "Trace stable transformations from input to output fields, checking provenance, units, and lossless integer paths.",
  最后查看确定性编排: "Review deterministic orchestration last",
  "固定编排展示可复现的处理顺序，不是生成式 Agent，也不会产生新的根因结论。":
    "Fixed orchestration shows a reproducible processing order; it is not a generative Agent and creates no new root-cause conclusions.",
  provenance: "Provenance",
  "证据的来源、生成方式、校准等级和允许声明范围。":
    "The evidence source, generation method, calibration level, and allowed claim scope.",
  字段血缘: "Field lineage",
  "一个输出字段从哪个输入、转换和证据位置得到。":
    "The input, transformation, and evidence location from which an output field derives.",
  "用真实测量调整模型参数；离线 fixture 只能证明流程一致。":
    "Adjusting model parameters with real measurements; an offline fixture proves only workflow consistency.",

  这个报告版本暂时不能安全地结构化展示: "This report version cannot yet be shown safely as a structured view",
  "原始字段仍然保留；页面不会把未知结构显示成空值，也不会套用旧 Schema 猜测含义。":
    "Original fields remain intact; the page does not show unknown structures as empty or guess with an older schema.",
  "Unsupported Schema 是兼容性边界，不等于没有数据、数值为 0 或运行失败。":
    "Unsupported Schema is a compatibility boundary, not no data, a numeric zero, or a failed run.",
  "下一步：打开运行记录": "Next: Open run history",
  最后再核对完整契约: "Verify the full contract last",
  "修复兼容性时再核对 Schema、backend identity、schema-set revision、artifact SHA-256、Pointer 和原始 bytes。":
    "When fixing compatibility, verify schema, backend identity, schema-set revision, artifact SHA-256, Pointer, and raw bytes.",
  先读阻断原因: "Read the blocking reason first",
  "确认是未知 Schema、校验失败还是 Bridge 主动拒绝 artifact；这些状态含义不同。":
    "Determine whether the cause is unknown schema, validation failure, or a Bridge-rejected artifact; these states differ.",
  记录受影响的报告身份: "Record the affected report identity",
  "保存报告类型、Schema identity 和精确 issue，便于 adapter 或契约更新后复核。":
    "Keep the report kind, schema identity, and exact issue for review after an adapter or contract update.",
  按需查看原始JSON: "Inspect raw JSON when needed",
  "按需查看原始 JSON": "Inspect raw JSON when needed",
  "原始查看器只显示完整字段，不会把未知字段解释成现有指标。":
    "The raw viewer shows complete fields and does not interpret unknown fields as existing metrics.",
  选择安全的下一步: "Choose a safe next step",
  "可以打开其他已支持运行，或等待 versioned adapter 更新；不要通过降级 Schema 绕过失败关闭。":
    "Open another supported run or wait for a versioned adapter update; do not bypass fail-closed behavior with an older schema.",
  "Schema identity": "Schema identity",
  "标识报告结构和字段语义的版本化身份。": "A versioned identity for a report's structure and field semantics.",
  "versioned adapter": "Versioned adapter",
  "把已知报告版本安全转换成稳定页面模型的适配器。":
    "An adapter that safely converts a known report version into a stable page model.",
  失败关闭: "Fail closed",
  "无法验证结构时停止解释，但保留原始证据。":
    "Stops interpretation when structure cannot be validated while preserving raw evidence.",

  原始证据查看器用于复核不是阅读结果的第一步: "The raw evidence viewer is for verification, not the first reading step",
  "原始证据查看器用于复核，不是阅读结果的第一步":
    "The raw evidence viewer is for verification, not the first reading step",
  "先在普通页面找到结论，再用 artifact、搜索和 JSON Pointer 回到完整原始字段。":
    "Find the conclusion on a regular page, then use artifact, search, and JSON Pointer to reach the complete raw field.",
  "查看器不会改写、截断复制内容或把 uint64 ps/bytes/count 转成有损 JavaScript number。":
    "The viewer does not rewrite or truncate copied content, or convert uint64 ps/bytes/count to a lossy JavaScript number.",
  最后再看完整身份链: "Inspect the full identity chain last",
  "只有复现与契约审计需要同时核对 backend identity、schema-set revision、Schema identity、artifact SHA-256、Pointer 与原始 bytes。":
    "Only reproduction and contract audits require backend identity, schema-set revision, schema identity, artifact SHA-256, Pointer, and raw bytes together.",
  展开完整JSON证据: "Expand complete JSON evidence",
  "展开完整 JSON 证据": "Expand complete JSON evidence",
  "只有需要审计或排查时再加载；未展开时不会占用主页面阅读空间。":
    "Load it only for auditing or troubleshooting; when collapsed, it does not consume the main reading area.",
  选择正确的artifact: "Choose the correct artifact",
  "选择正确的 artifact": "Choose the correct artifact",
  "根据页面证据链接提供的 artifact ID 选择文件，并确认它属于当前 run 的可信清单。":
    "Choose the file using the artifact ID from the evidence link and confirm it belongs to the current run's trusted manifest.",
  "搜索或定位 JSON Pointer": "Search or locate a JSON Pointer",
  "Pointer 指向精确字段；搜索仅高亮匹配行，不改变完整 JSON。":
    "A Pointer identifies an exact field; search only highlights matching lines and does not change the complete JSON.",
  核对身份后再引用: "Verify identities before citing",
  "确认 run、Schema identity、artifact SHA-256 与 Pointer 一致，再把原始字段用于审计。":
    "Confirm run, schema identity, artifact SHA-256, and Pointer before using the raw field in an audit.",
  artifact: "Artifact",
  "一次运行产出的已登记输入或报告文件。": "A registered input or report file produced by one run.",
  "JSON Pointer": "JSON Pointer",
  "按照 RFC 6901 标识 JSON 文档中精确字段的位置。": "An RFC 6901 location for an exact field in a JSON document.",
  "SHA-256": "SHA-256",
  "用于核对文件 bytes 是否与可信清单完全一致的摘要。":
    "A digest used to verify that file bytes exactly match the trusted manifest.",
  "下一步可以打开其他已支持的运行，或等待对应版本适配。":
    "Next, open another supported run or wait for an adapter for this version.",
};
