// New visualization copy belongs here so parallel work does not edit the shared legacy catalog.
export const visualizationEnglishCatalog: Readonly<Record<string, string>> = {
  回答的问题: "Question answered",
  先看哪里: "First look",
  解释边界: "Interpretation boundary",
  查看数据与证据: "View data and evidence",
  仅字段表: "Field table only",
  状态矩阵: "State matrix",
  水平条形图: "Horizontal bar chart",
  堆叠水平条形图: "Stacked horizontal bar chart",
  散点图: "Scatter plot",
  区间时间轴: "Interval timeline",
  设备计算: "Device compute",
  输入与请求: "Input and requests",
  调度与运行: "Scheduling and runtime",
  计算步骤: "Compute steps",
  "内存与 KV": "Memory and KV",
  多设备协同: "Multi-device coordination",
  网络与通信: "Network and communication",
  "说明本次实验接收了哪些请求和输入。": "Shows which requests and inputs this experiment received.",
  "说明请求如何排队、分批并进入执行。": "Shows how requests queue, batch, and enter execution.",
  "说明请求被拆成了哪些计算步骤。": "Shows the compute steps into which requests were decomposed.",
  "说明 KV 缓存和内存的使用情况。": "Shows KV cache and memory usage.",
  "说明设备上执行了哪些计算任务。": "Shows compute tasks executed on devices.",
  "说明多个设备之间如何协同通信。": "Shows how multiple devices coordinate communication.",
  "说明网络传输、排队和拥塞情况。": "Shows network transfer, queueing, and congestion.",
  "输入范围：{value}": "Input scope: {value}",
  "{value} 条调度记录": "{value} scheduling records",
  "模拟精度：{value}": "Simulation fidelity: {value}",
  "{value} 条内存记录": "{value} memory records",
  "{value} 个计算任务": "{value} compute tasks",
  "{value} 条协同记录": "{value} coordination records",
  "{value} 条网络记录": "{value} network records",
  调度记录: "Scheduling records",
  内存记录: "Memory records",
  计算任务: "Compute tasks",
  协同通信记录: "Collective communication records",
  网络记录: "Network records",
  "当前报告是否提供了足够且适合绘图的数据？": "Does the current report provide enough suitable data to chart?",
  "先看缺失或降级原因，再决定是否查看原始记录。":
    "Review the missing or fallback reason before opening the raw record.",
  "没有数据时不补零、不插值，也不生成仅用于占位的图形。":
    "When data is absent, do not fill with zero, interpolate, or draw a placeholder chart.",
  "这些分类声明和状态字段分别是什么？": "What do these categorical declarations and states report?",
  "先看报告值，再沿字段来源核对 provenance、fidelity 或实现状态。":
    "Read the reported value first, then follow its source to verify provenance, fidelity, or implementation state.",
  "分类状态没有连续数值含义，不能据此计算距离、趋势或等级分数。":
    "Categorical states have no continuous numeric meaning and cannot produce distances, trends, or scores.",
  "不同请求带来了多少 prompt、decode 与 KV token？":
    "How many prompt, decode, and KV tokens does each request contain?",
  "先找总量较大的请求，再回到完整字段表核对三类 token。":
    "Find requests with larger totals, then verify all three token fields in the complete table.",
  "这里只比较后端输入数量，不推断调度、延迟或因果关系。":
    "This compares backend-reported input counts without inferring scheduling, latency, or causality.",
  "哪些 memory event 的报告延迟更高？": "Which memory events have higher reported latency?",
  "先看最长条，再按 memory_event_id 回到完整记录。":
    "Start with the longest bar, then use memory_event_id to inspect the complete record.",
  "按稳定事件 ID 做展示级去重；不重算内存延迟，也不把 S3 与 S4/S5 串联。":
    "Deduplicate for display by stable event ID; do not recompute memory latency or chain S3 through S4/S5.",
  "设备任务的延迟与 occupancy 如何共同分布？": "How are device-task latency and occupancy distributed together?",
  "先看远离主要点群的任务，再核对它的精确字段和证据。":
    "Inspect tasks far from the main cluster, then verify their exact fields and evidence.",
  "散点只显示报告变量的关系，不证明 occupancy 导致延迟。":
    "The scatter plot shows reported-variable association and does not prove that occupancy causes latency.",
  "现有设备任务中哪些报告延迟更高？": "Which reported device tasks have higher latency?",
  "先看最长条，再核对字段表中的完整任务记录。":
    "Start with the longest bar, then verify the complete task record in the field table.",
  "完整双变量样本少于 3 个，因此不展示也不推断 latency–occupancy 分布。":
    "With fewer than three complete paired samples, do not display or infer a latency-occupancy distribution.",
  "每个 collective 的 runtime、queue 与 congestion 报告构成是什么？":
    "What reported runtime, queue, and congestion components make up each collective?",
  "先看 queue 和 congestion 占比较显眼的条目，再核对完整 phase 记录。":
    "Start with entries where queue or congestion stands out, then verify the complete phase record.",
  "只对同一 collective、同单位后端字段做显示级合计；不生成新的模拟指标。":
    "Only sum same-unit backend fields within one collective for display; do not create a new simulation metric.",
  "每个请求的 Fabric runtime、queue 与 congestion 报告构成是什么？":
    "What reported Fabric runtime, queue, and congestion components make up each request?",
  "先看 queue 或 congestion 较高的请求，再进入它的正式 evidence pointer。":
    "Start with requests with higher queue or congestion, then open their formal evidence pointers.",
  "三项均直接来自请求记录；前端不补造未报告贡献，也不推断主导原因。":
    "All three values come directly from request records; the frontend neither fills missing contributions nor infers a dominant cause.",
  "哪些 Fabric domain 的报告利用率更高？": "Which Fabric domains have higher reported utilization?",
  "先看利用率较高的域，再与 queue/congestion 字段和 topology 证据一起判断。":
    "Start with higher-utilization domains, then interpret them with queue/congestion fields and topology evidence.",
  "利用率是模拟报告值，不等同于真实集群链路计数器，也不单独证明拥塞。":
    "Utilization is a simulated reported value, not a real-cluster link counter or proof of congestion by itself.",
  "S0–S6 的已报告阶段如何落在 S7 的同一全局时间轴上？":
    "How do reported S0-S6 stages appear on S7's shared global timeline?",
  "先看阶段顺序、重叠和持续时间，再查看精确 start/end ps。":
    "Review stage order, overlap, and duration before inspecting exact start/end picoseconds.",
  "S7 是统一执行宿主，不是 latency causal ranking；非法或超安全范围的区间失败关闭。":
    "S7 is the unified execution host, not a latency cause; invalid or unsafe-range intervals fail closed.",
  已选择图表项: "Selected chart item",
  "查看当前 run 的正式证据": "View formal evidence for the current run",
  "该图表项没有可导航的精确 evidence pointer。": "This chart item has no navigable exact evidence pointer.",
  来源: "Source",
  单位: "Unit",
  没有字段来源: "No field source",
  报告状态: "Reported status",
  报告值: "Reported value",
  数值: "Value",
  上一步: "Previous step",
  下一步: "Next step",
  逐步查看执行路线: "Step through the execution path",
  "第 {current} / {total} 步": "Step {current} of {total}",
  通信时间构成图: "Communication-time composition charts",
  请求延迟比较: "Request latency comparison",
  "并列比较每个请求的 TTFT、TPOT 与端到端延迟；图中换算为 µs，字段表保留精确 ps。":
    "Compare TTFT, TPOT, and end-to-end latency per request; the chart uses µs while the table preserves exact ps.",
  "哪些请求开始响应、连续生成或全部完成得更慢？": "Which requests are slower to start responding, generate, or finish?",
  "先找端到端最长的请求，再比较它的 TTFT 与 TPOT 构成。":
    "Find the longest end-to-end request, then compare its TTFT and TPOT.",
  "三项均直接来自 request_metrics；前端只做 ps→µs 显示换算，不计算分位数或补造缺失指标。":
    "All three values come from request_metrics; the UI only converts ps to µs and neither calculates percentiles nor invents missing metrics.",
  "请求是离散实体，同单位延迟适合分组水平条形图；不使用暗示时间趋势的折线图。":
    "Requests are discrete entities, so grouped horizontal bars compare same-unit latency without implying a time trend.",
  "没有 request_metrics；这不等于存在 0 µs 请求。": "No request_metrics are present; this does not mean 0 µs requests.",
  "boundary run 可以没有 TTFT/TPOT；missing、not applicable 与真实 0 必须分开。":
    "A boundary run may omit TTFT/TPOT; missing, not applicable, and real zero remain distinct.",
  通信域时间构成: "Communication-domain time composition",
  "逐域并列显示后端报告的 runtime、queue 与 congestion 字段。":
    "Show backend-reported runtime, queue, and congestion fields for each domain.",
  "每个通信域的执行、排队和拥塞时间分别有多少？":
    "How much execution, queueing, and congestion time does each domain report?",
  "先看 queue 或 congestion 较突出的域，再与主导瓶颈和 topology 证据交叉检查。":
    "Start with domains that stand out for queueing or congestion, then cross-check the reported bottleneck and topology evidence.",
  "不把三个字段重新解释为完整端到端延迟；利用率与时间构成也不能单独证明因果。":
    "The three fields are not reinterpreted as full end-to-end latency; utilization and composition alone do not prove causality.",
  "同一域内三个同单位后端字段适合堆叠比较，字段表保留每个原值。":
    "Three same-unit backend fields suit stacked comparison, with every original value retained in the table.",
  请求通信时间构成: "Request communication-time composition",
  "逐请求并列显示后端报告的 runtime、queue 与 congestion 字段。":
    "Show backend-reported runtime, queue, and congestion fields for each request.",
  "哪些请求把更多时间花在通信执行、排队或拥塞上？":
    "Which requests spend more reported time in communication execution, queueing, or congestion?",
  "先看 queue/congestion 较高的请求，再通过稳定 request_id 查看正式证据。":
    "Start with requests that have higher queueing or congestion, then inspect formal evidence through stable request_id.",
  "只展示 request_fabric_contributions；dominant phase 仍以正式稳定 ID 连接，不按数值猜测。":
    "Only request_fabric_contributions are shown; dominant phases remain linked by formal stable IDs, never guessed from values.",
  "请求是离散实体，三个同单位字段适合堆叠水平条形图。":
    "Requests are discrete entities, and three same-unit fields suit stacked horizontal bars.",
  "正式 Objective 候选图": "Formal-objective candidate chart",
  "使用后端正式 objectives 的前两个可用维度定位候选，并原样标注 Pareto membership。":
    "Position candidates using the first two available formal backend objectives and preserve reported Pareto membership.",
  "可配对的正式 objective 不足，降级为首个可用 objective 的候选条形图。":
    "When paired formal objectives are insufficient, fall back to a bar chart of the first available objective.",
  "候选在正式 objectives 上如何权衡，哪些被后端标记为 Pareto member？":
    "How do candidates trade off formal objectives, and which are backend-reported Pareto members?",
  "先看标记为 pareto_member 的候选，再核对方向、单位、rank 与正式 objective evidence。":
    "Start with reported pareto_member candidates, then verify direction, unit, rank, and formal objective evidence.",
  "前端不计算 Pareto、dominance、rank 或 promotion reason；当前 execution_scope 必须保持 S6_only。":
    "The UI does not calculate Pareto, dominance, rank, or promotion reason; execution_scope remains S6_only.",
  "两个正式定量 objective 且至少两个完整候选适合散点比较；membership 仅使用报告标签。":
    "Two formal quantitative objectives and at least two complete candidates support a scatter comparison; membership uses report labels only.",
  "正式双 objective 数据不足时不伪造二维关系，改用单 objective 条形图。":
    "Insufficient formal two-objective data falls back to a single-objective bar chart instead of inventing a 2D relationship.",
  Candidate: "Candidate",
  "没有正式 objectives 可绘制；前端不会用 projected 指标重建 Pareto。":
    "No formal objectives are available to plot; the UI will not reconstruct Pareto from projected metrics.",
  "Pareto membership、dominance、rank 与 promotion reason 必须来自正式后端报告。":
    "Pareto membership, dominance, rank, and promotion reason must come from the formal backend report.",
  "S0–S6 延迟贡献": "S0–S6 latency contributions",
  "按报告顺序显示 S0–S6 attribution score；图中换算为 µs，字段表保留精确 ps。":
    "Show S0–S6 attribution scores in report order; the chart uses µs while the table preserves exact ps.",
  "报告把当前尾延迟分数分配给了哪些 S0–S6 子系统记录？":
    "Which S0–S6 subsystem records receive the current tail-latency score?",
  "先看分数较高的条目，再阅读其 detail 和正式 evidence pointer。":
    "Start with higher scores, then read their detail and formal evidence pointer.",
  "只显示报告 ranking；不把 S7/S8/S9 输出记录混入，也不把排序当作真实系统因果证明。":
    "Only the reported ranking is shown; S7/S8/S9 records stay separate, and ranking is not treated as real-system causal proof.",
  "后端已给出有序离散贡献项，水平条形图便于比较且不改变正式 rank。":
    "The backend provides ordered discrete contributions; horizontal bars aid comparison without changing formal rank.",
  "没有 S0–S6 attribution_ranking 记录。": "No S0–S6 attribution_ranking records are available.",
  "S7 是执行宿主，S8/S9 是输出面；三者不能进入 latency causal ranking。":
    "S7 is the execution host and S8/S9 are output planes; none belongs in latency causal ranking.",
  "执行宿主、验证与输出记录": "Execution-host, validation, and output records",
  "这些记录原样保留供审计，但与上方 S0–S6 latency causal ranking 明确分区。":
    "These records are preserved for audit and clearly separated from the S0–S6 latency causal ranking above.",
  报告说明: "Report detail",
  "保留完整字段与缺失原因，不为不可用数据生成占位图。":
    "Retain complete fields and the absence reason without generating a placeholder chart.",
  "先看降级原因，再决定是否检查原始 artifact。":
    "Read the degradation reason first, then decide whether to inspect the raw artifact.",
  "缺少正式字段或数值超出安全显示范围时失败关闭。":
    "Fail closed when formal fields are missing or values exceed the safe display range.",
};
