/**
 * Copy owned by the lightweight-workbench workstream.
 *
 * Keep these strings out of the legacy/core catalog so the lightweight
 * information architecture can evolve independently from the professional
 * shell.  The Chinese source remains the product copy used by the current
 * locale; English is intentionally explicit about Agent and evidence
 * boundaries.
 */
export const lightweightWorkbenchEnglishCatalog: Readonly<Record<string, string>> = {
  轻量工作台: "Lightweight workbench",
  "TileSim 仿真实验台": "TileSim simulation workbench",
  选择适合你的工作台: "Choose the right workbench",
  "两种工作台共享同一套仿真事实和公开能力，但使用不同的信息组织方式。之后可以随时切换。":
    "Both workbenches share the same simulation facts and public capabilities, while organizing information differently. You can switch at any time.",
  工作台选择: "Workbench choice",
  "上次使用：轻量版": "Last used: Lightweight",
  "上次使用：专业版": "Last used: Professional",
  可以完成: "What you can do",
  "创建实验、提交正式 run、查看运行状态和结果摘要。":
    "Create an experiment, submit a formal run, and review status and result summaries.",
  "支持在当前公开能力范围内创建正式 run；Agent 仍不能越权提交。":
    "Formal runs are available within public capabilities; the Agent still cannot submit beyond its boundary.",
  "了解概念、准备单轮配置草案、阅读已有结果摘要和示例。":
    "Learn concepts, prepare a single-turn configuration draft, and read existing result summaries and examples.",
  "Agent 不会创建运行；草案只在当前页面有效，确认后由工作台提交。":
    "The Agent does not create a run; its draft stays local to this page until you review and submit it.",
  进入轻量版: "Enter Lightweight",
  "编辑实验输入、创建和观察运行、查看指标、验证、证据与历史。":
    "Edit experiment inputs, create and observe runs, and review metrics, validation, evidence and history.",
  "进入后可按现有权限创建正式运行，并查看完整结果。":
    "After entering, you can create formal runs under existing permissions and review complete results.",
  进入专业版: "Enter Professional",
  "不确定时，可以先从轻量版开始；模式切换不会清除已有运行或证据引用。":
    "If you are unsure, start with Lightweight; switching modes does not clear existing runs or evidence references.",
  开始: "Start",
  学习: "Learn",
  任务: "Tasks",
  选择一个实验任务: "Choose an experiment task",
  "从目标出发进入真实配置；任务说明不会创建 run，也不会替代校验。":
    "Start from a goal and move into real configuration; task guidance does not create a run or replace validation.",
  "先选目标，再配置实验": "Choose a goal, then configure the experiment",
  "选择后会进入新建实验页面，并保留当前 run 与证据上下文。":
    "Your choice opens experiment setup while preserving the current run and evidence context.",
  直接新建实验: "Create an experiment directly",
  来自任务: "From task",
  更换任务: "Change task",
  理解字段和结果边界: "Understand field and result boundaries",
  "这里是可选参考，不是运行前置步骤；你可以随时回到配置或结果页面。":
    "This is optional reference material, not a prerequisite; you can return to setup or results at any time.",
  运行状态: "Run status",
  状态告诉你下一步: "Status tells you what to do next",
  等待或准备执行: "Waiting or preparing to execute",
  后端正在执行: "The backend is executing",
  可以读取结果: "Results are ready to read",
  查看原因并按契约处理: "Review the reason and follow the contract",
  "报告字段不足，不能补造结论": "The report is incomplete; do not invent a conclusion",
  "来源和 fidelity 要分开看": "Read source and fidelity separately",
  "requested fidelity 是请求意图，resolved fidelity 只能由后端报告确认。":
    "Requested fidelity is intent; resolved fidelity can only be confirmed by the backend report.",
  "real_trace、synthetic_trace 和 compatibility_harness_trace 不会互相升级。":
    "real_trace, synthetic_trace and compatibility_harness_trace are never upgraded into one another.",
  "0 是合法数值；missing、not covered、stale 和 unsupported 各自代表不同边界。":
    "0 is a valid value; missing, not covered, stale and unsupported represent different boundaries.",
  去配置实验: "Configure an experiment",
  回到开始: "Back to start",
  草案: "Draft",
  帮助与限制: "Help and limits",
  轻量工作台导航: "Lightweight workbench navigation",
  轻量版页面帮助: "Lightweight page help",
  Trace: "Trace",
  "说明卡 · 约 3 分钟": "Informational card · about 3 minutes",
  "轻量版支持配置并提交正式实验；字段解释和结果阅读集中在右上角页面帮助。":
    "The lightweight workbench supports setup and formal submission; field explanations and result guidance live in the top-right page help.",
  "基础配置、正式 run、状态与结果摘要已开放；高级设计空间和多轮 Agent 仍受公开能力限制。":
    "Basic setup, formal runs, status and result summaries are available; advanced design space and multi-turn Agent features remain capability-bound.",
  "Agent 只生成解释和草案；正式 run 由工作台校验后提交，不会调用 Provider。":
    "The Agent only explains and drafts; the workbench validates and submits formal runs without calling a Provider.",
  "用必要配置和共享 Agent，校验并提交当前支持的正式 run。":
    "Use the required setup and shared Agent to validate and submit a supported formal run.",
  "说明卡仅本地展示；不会创建运行或调用 Provider":
    "Informational card only; it does not create a run or call a Provider",
  "说明卡仅本地展示；不会修改草案或运行状态": "Informational card only; it does not modify drafts or run state",
  "说明卡只做解析；刷新后不恢复草案正文，不会创建运行":
    "The informational card only parses input; its draft body is not restored after refresh and no run is created",
  "说明卡只保留在当前页面；不会创建运行或调用 Provider":
    "The informational card stays on this page; it does not create a run or call a Provider",
  "结果摘要和证据索引（只读卡片）": "Result summary and evidence index (informational card)",
  "说明卡只读取已有合法 run；不会重新运行或调用 Provider":
    "The informational card only reads an existing legal run; it does not rerun or call a Provider",
  "说明卡只读；不会改变 run、artifact 或 Evidence selection":
    "The informational card is read-only; it does not change the run, artifact or Evidence selection",
  "example 说明卡；不会创建运行、校准或真实结果":
    "Example informational card; it creates no run, calibration or real result",
  example: "example",
  "只读 · 当前阶段": "Read-only · current phase",
  "运行 · 当前阶段": "Run · current phase",
  "可提交正式 run": "Can submit a formal run",
  "轻量版支持配置、提交正式 run 和阅读已验证结果。":
    "The lightweight workbench supports setup, formal runs and verified result reading.",
  "旧版学习卡仅作说明；轻量工作台本身支持校验后提交正式 run。":
    "Legacy learning cards are informational only; the lightweight workbench itself can submit validated formal runs.",
  当前轻量能力: "Current lightweight capabilities",
  了解: "Understand",
  准备: "Prepare",
  解读: "Interpret",
  示例: "Examples",
  概念学习: "Concept learning",
  概念卡: "Concept card",
  任务模板: "Task template",
  首次引导: "First-time guide",
  空状态: "Empty state",
  了解当前实验配置: "Understand the current experiment setup",
  准备基础参数草案: "Prepare a basic parameter draft",
  解释已有结果: "Interpret an existing result",
  浏览示例场景: "Browse example scenarios",
  "适合刚开始接触 TileSim 的用户": "For people who are new to TileSim",
  "适合需要完整参数、运行和证据能力的用户": "For people who need complete parameter, run and evidence capabilities",
  预计耗时: "Estimated time",
  只读: "Read-only",
  产物: "Output",
  副作用: "Side effects",
  "不会调用 Provider": "Does not call a Provider",
  不会修改当前运行或证据选择: "Does not modify the current run or evidence selection",
  "示例 · 非真实结果": "Example · not a real result",
  "示例数据，不代表校准证据": "Example data; not calibration evidence",
  尚无可读取的运行: "No readable run yet",
  尚无当前页面草案: "No draft on this page yet",
  "请先选择一个任务或模板。": "Choose a task or template first.",
  "本页面草案只在当前页面生命周期内保留；刷新后不会恢复正文。":
    "A page draft exists only for this page lifetime; its body is not restored after refresh.",
  "当前 Bridge 不可用；轻量版仍可查看本地字段和页面帮助。":
    "The current Bridge is unavailable; local fields and page help remain available.",
  "暂无结果；先提交正式 run，完成后这里只读取已验证报告。":
    "No results yet; submit a formal run first, then this page reads only its verified reports.",
  "之后可以随时切换工作台。": "You can switch workbenches at any time.",
  切换到专业工作台: "Switch to professional workbench",
  切换到轻量工作台: "Switch to lightweight workbench",
  轻量工作台首页: "Lightweight workbench home",
  概念学习入口: "Concept guidance entry",
  任务模板入口: "Compatibility-card entry",
  当前页面草案: "Draft on this page",
  已有运行结果: "Existing run results",
  从基础概念开始: "Start with the basic concepts",
  "概念说明已移至右上角页面帮助。": "Concept guidance has moved to the top-right page help.",
  "页面说明已移至右上角页面帮助。": "Page guidance has moved to the top-right page help.",
  "主流程只保留配置、提交、运行状态和结果。":
    "The primary flow now contains only setup, submission, run status and results.",
  选择一个目标: "Choose a goal",
  "任务与学习入口已收敛到配置、结果和页面帮助。":
    "Task and learning entries are consolidated into setup, results and page help.",
  在当前页面保留你的草案: "Keep your draft on this page",
  "Agent 草案保留在当前会话；字段校验和正式提交仍由配置页完成。":
    "Agent drafts stay in the current session; field validation and formal submission remain on the setup page.",
  查看已有运行: "View existing runs",
  "结果摘要会保留 stale/unsupported 状态，不会补造结论。":
    "Result summaries retain stale/unsupported states and never invent conclusions.",
  从一个清晰目标开始: "Start with a clear goal",
  先建立一张共同的地图: "Build a shared map first",
  "用简短概念卡了解输入、模拟、结果和证据边界。":
    "Use concise concept cards to understand inputs, simulation, results and evidence boundaries.",
  选择一个清晰目标: "Choose a clear goal",
  "兼容说明卡按四类目标提供配置起点；选择只会导航到新建实验，正式提交需校验。":
    "Compatibility cards provide four goal-based setup starting points; selecting one only navigates to New experiment, where validation precedes submission.",
  把想法留在当前页面: "Keep your ideas on this page",
  "Agent 草案是页面生命周期内的本地材料；字段校验通过后由工作台提交正式 run。":
    "Agent drafts remain local to the page; after field validation, the workbench submits the formal run.",
  先确认你正在看的是什么: "Confirm what you are looking at first",
  "结果页只读取已有、合法且可验证的 run；没有 run 时不会猜测或生成结论。":
    "The results page only reads existing, legal and verifiable runs; it does not guess or generate conclusions without a run.",
  "轻量工作台聚焦开始、配置、运行与结果；说明集中在页面帮助。":
    "The lightweight workbench focuses on start, setup, runs and results; guidance is centralized in page help.",
  "旧任务入口已兼容重定向到新建实验。": "The legacy task entry redirects to New experiment for compatibility.",
  "当前阶段：L6R": "Current phase: L6R",
  "当前仅支持八个正式参数字段的单轮草案。":
    "Only single-turn drafts for the eight formal parameter fields are currently supported.",
  "模型、设备、卡数、TP/PP/EP、物理 KV、SLO 和工作负载模板仍受公开能力与专业版范围限制。":
    "Models, devices, card counts, TP/PP/EP, physical KV, SLO and workload templates remain bounded by published capabilities and the professional workbench.",
  "Agent 不创建正式运行、不调用 Provider，也不保存完整对话；工作台可提交。":
    "The Agent does not create a run or call a Provider, and full conversations are not saved; the workbench submission flow remains available.",
  "还需要一点信息才能安全生成草案。": "A little more information is needed to safely generate a draft.",
  "这项请求当前不可用，但可以继续处理已发布的八个参数。":
    "This request is currently unavailable, but the eight published parameters can still be handled.",
  "没有生成修改。": "No changes were generated.",
  "暂时无法连接到 Bridge": "Unable to connect to the Bridge for now",
  "Bridge 不可用时页面不伪造状态；恢复后可回到新建实验校验并提交。":
    "When Bridge is unavailable the page does not fake state; once it recovers, return to New experiment to validate and submit.",
  了解连接限制: "Learn about connection limits",
  还没有可查看的运行: "There are no runs to view yet",
  查看使用限制: "View usage limits",
  当前页面还没有草案: "This page has no draft yet",
  "选择一个说明卡后只会保留配置起点；Agent 草案正文不会自动写入专业版表单。":
    "Selecting an informational card only keeps a setup starting point; an Agent draft body is never written into the professional form automatically.",
  回到任务: "Back to Tasks",
  "需要帮助？": "Need help?",
  "高级模板和 Agent 能力按公开能力逐步开放；当前共享 Agent 可解释并生成草案。":
    "Advanced templates and Agent capabilities follow the published capability contract; the shared Agent currently explains and generates drafts.",
  "没有 Bridge 时，不会自动重试或伪造可用状态。":
    "Without a Bridge, the app does not retry automatically or fake availability.",
  "没有 run 时，结果页只展示清晰空状态。": "Without a run, the results page shows a clear empty state.",
  三步了解轻量工作台: "Understand the lightweight workbench in three steps",
  跳过引导: "Skip guide",
  重新查看引导: "View guide again",
  首次使用: "First use",
  "用概念卡熟悉仿真中的基本词汇。": "Use concept cards to learn basic simulation vocabulary.",
  "说明卡只选择配置起点；共享 Agent 草案保留在当前页面。":
    "An informational card only chooses a setup starting point; a shared-Agent draft stays on this page.",
  "已跳过首次引导。": "First-time guide skipped.",
  第一步: "Step one",
  "每张卡都会说明适用人群、耗时、只读性、产物和副作用。选择后只会打开本地内容，不会创建正式运行。":
    "Each card states its audience, duration, read-only status, output and side effects. Selecting one opens local content only and creates no formal run.",
  "你想完成什么？": "What would you like to do?",
  "查看页面帮助 →": "View page help →",
  "这些兼容说明卡不启用模型、设备、多卡并行、SLO 或 Provider；正式 run 请在新建实验页完成。":
    "These compatibility cards do not enable models, devices, multi-card parallelism, SLO or Provider calls; complete a formal run on New experiment.",
  概念卡和术语提示: "Concept cards and terminology prompts",
  术语解释和专业版跳转: "Terminology explanations and professional-workbench link",
  本页生命周期内的草案摘要: "Draft summary for this page lifetime",
  "字段、单位和缺口清单": "Field, unit and gap checklist",
  "结果摘要和证据索引（说明卡）": "Result summary and evidence index (informational card)",
  限制清单和专业详情链接: "Limitations checklist and professional details link",
  预置输入和示例状态: "Preset inputs and example state",
  预置输入和限制说明: "Preset inputs and limitations",
  "工作负载是什么？": "What is a workload?",
  "工作负载描述系统要处理的请求形态，例如消息大小和到达节奏。":
    "A workload describes the shape of requests a system handles, such as message size and arrival cadence.",
  "先说清楚要处理什么，再讨论系统怎样处理。":
    "Clarify what must be handled before discussing how the system handles it.",
  延迟与吞吐: "Latency and throughput",
  "延迟关注一次请求等多久，吞吐关注一段时间内完成多少请求。":
    "Latency is how long one request waits; throughput is how many requests finish over a period.",
  "两者可能互相牵制，结果应结合目标和证据阅读。": "They can trade off; read results together with goals and evidence.",
  "结果从哪里来？": "Where do results come from?",
  "这张说明卡只展示已有、合法且可验证的数据，不会补造指标。":
    "This informational card shows only existing, legal and verifiable data; it does not invent metrics.",
  "看见 unavailable、unknown 或 stale 时，应把它当作边界而不是结论。":
    "Treat unavailable, unknown or stale as a boundary, not a conclusion.",
  "记住：": "Remember:",
  "先建立输入、模拟和结果之间的基本概念。": "Build a basic understanding of inputs, simulation and results.",
  "看懂 TileSim 的基本流程": "Understand TileSim's basic flow",
  "用三张概念卡了解输入、模拟和结果各自做什么。":
    "Use three concept cards to learn what inputs, simulation and results each do.",
  "第一次接触 TileSim 的用户": "People encountering TileSim for the first time",
  "约 5 分钟": "About 5 minutes",
  认识常见参数: "Meet common parameters",
  "从 batch、延迟和带宽开始，知道它们在流程中的位置。":
    "Start with batch, latency and bandwidth and see where they fit in the flow.",
  需要先补充基础知识的用户: "People who need foundational context first",
  "约 8 分钟": "About 8 minutes",
  "按目标整理一个可检查的配置草案。": "Organize a checkable configuration draft around a goal.",
  "准备一个 batch 草案": "Prepare a batch draft",
  "用普通语言描述目标，整理 max batch size 等已支持字段。":
    "Describe the goal in plain language and organize supported fields such as max batch size.",
  "想先写下配置想法、还不准备运行的用户": "People who want to note configuration ideas before running",
  "约 3 分钟": "About 3 minutes",
  准备网络参数草案: "Prepare a network-parameter draft",
  "记录带宽和延迟目标，并明确仍缺少哪些信息。": "Record bandwidth and latency goals and make remaining gaps explicit.",
  需要先梳理网络目标的用户: "People who need to organize network goals first",
  "约 4 分钟": "About 4 minutes",
  "阅读已有合法运行的结果、依据和限制。": "Read results, evidence and limits from an existing legal run.",
  读懂已有结果摘要: "Read an existing result summary",
  "从结论、依据和限制开始阅读一个已有 run。":
    "Start with conclusions, evidence and limits when reading an existing run.",
  "已经有 run、想先看结论的用户": "People with a run who want to see conclusions first",
  检查结果限制: "Check result limits",
  "识别 missing、unknown、stale 和 synthetic 等状态。":
    "Recognize states such as missing, unknown, stale and synthetic.",
  担心把示例或不完整证据当成结论的用户:
    "People concerned about mistaking examples or incomplete evidence for conclusions",
  "约 6 分钟": "About 6 minutes",
  "通过预置场景熟悉界面和字段，不代表真实证据。":
    "Use preset scenarios to learn the interface and fields; they are not real evidence.",
  "示例：吞吐优先": "Example: throughput first",
  "查看一个带 example 标记的吞吐目标输入和展示方式。": "View an example-marked throughput goal input and presentation.",
  希望先浏览完整流程的用户: "People who want to browse a complete flow first",
  "example；不会创建运行、校准或真实结果": "Example; creates no run, calibration or real result",
  "example · 不代表真实结果或校准证据": "Example · not a real result or calibration evidence",
  "示例：延迟优先": "Example: latency first",
  "查看一个带 example 标记的延迟目标场景。": "View an example-marked latency-goal scenario.",
  想比较不同目标表达方式的用户: "People who want to compare ways of expressing goals",
  "先查看页面帮助 →": "Open page help first →",
  "进入新建实验 →": "Open New experiment →",
  "返回新建实验 →": "Back to New experiment →",
  "先查看页面帮助和结果边界 →": "Review page help and result boundaries first →",
  草案下一步: "Next step for drafts",
  结果载入状态: "Result loading status",
  结果页下一步: "Next step for results",
  "现在可以做什么？": "What can you do now?",
  "先查看页面帮助理解边界；Agent 草案不会自动写入专业版表单。":
    "Use page help to understand the boundaries first; an Agent draft is never written into the professional form automatically.",
  正在确认结果可用性: "Checking result availability",
  已选择模板: "Template selected",
  已选择一个运行: "A run is selected",
  "需要一个已有 run": "An existing run is required",
  "请打开合法的 run 深链接；轻量版不会重跑或猜测结果。":
    "Open a valid run deep link; the lightweight workbench will not rerun or guess results.",
  "只显示后端返回的真实阶段；没有真实百分比时不显示进度条。":
    "Only backend-returned stages are shown; no progress bar is rendered without a real percentage.",
  "后端已接收请求，正在准备执行环境。": "The backend accepted the request and is preparing the execution environment.",
  "请求已进入队列；页面会继续读取后端状态。": "The request is queued; the page will continue reading backend status.",
  "后端正在执行；不会显示前端估算的百分比或剩余时间。":
    "The backend is executing; frontend-estimated percentages and remaining time are not shown.",
  "运行已完成，可以读取真实报告和证据。": "The run completed; verified reports and evidence are ready to read.",
  "后端返回失败；修正配置后可以重新提交。": "The backend returned a failure; fix the configuration and submit again.",
  "当前无法从 Bridge 读取状态，请检查连接后重试。": "The Bridge status is unavailable; check the connection and retry.",
  "运行结束但报告字段不完整；缺失内容不会被补成 0。":
    "The run ended with incomplete report fields; missing values are not replaced with zero.",
  "等待后端返回运行状态。": "Waiting for the backend to return run status.",
  "已停止自动轮询（终态）": "Automatic polling stopped (terminal state)",
  "每 5 秒读取一次后端状态": "Reading backend status every 5 seconds",
  "artifact SHA-256": "artifact SHA-256",
  "完成后从 manifest 读取": "Read from manifest after completion",
  "schema revision": "schema revision",
  重新配置: "Reconfigure",
  "先看结论，再查看证据和字段细节。所有数值均保留后端返回的状态。":
    "Start with the conclusion, then inspect evidence and field details. Values retain backend status.",
  "通信域利用率（%）": "Communication-domain utilization (%)",
  "metrics.system_summary.fabric_domain_utilization · 后端字段":
    "metrics.system_summary.fabric_domain_utilization · backend field",
  证据索引: "Evidence index",
  "报告与 schema 身份": "Report and schema identity",
  "manifest 已验证": "Manifest verified",
  "manifest missing": "Manifest missing",
  "存在被拒绝或旧 schema artifact；相关字段不会被展示为可用结果。":
    "Rejected or legacy-schema artifacts are present; related fields are not shown as available results.",
  "unsupported schema": "Unsupported schema",
  stale: "Stale",
  结果不完整: "Incomplete result",
  运行失败: "Run failed",
  服务不可用: "Service unavailable",
  fidelity: "fidelity",
  数据通道: "data lane",
  轻量版开始: "Lightweight start",
  轻量版任务: "Lightweight tasks",
  轻量版配置: "Lightweight setup",
  轻量版运行状态: "Lightweight run status",
  轻量版结果摘要: "Lightweight result summary",
  "从新建实验开始，恢复已有运行，或打开结果摘要。页面帮助集中说明轻量版的范围和证据边界。":
    "Start a new experiment, resume an existing run, or open a result summary. Page help covers the lightweight scope and evidence boundaries.",
  "轻量版可以提交正式 run；Agent 只提供解释和草案辅助，不能替代校验或越权创建运行。":
    "The lightweight workbench can submit formal runs; the Agent only explains and assists with drafts and cannot replace validation or create runs beyond its boundary.",
  开始或继续实验: "Start or continue an experiment",
  "使用新建实验进入基础配置；已有运行会保留 run ID 和可恢复的结果上下文。":
    "Use New experiment for basic setup; existing runs retain their run ID and recoverable result context.",
  最近运行: "Recent run",
  "最近运行区域只显示后端返回的状态和请求精度，不根据前端计时器猜测进度。":
    "The recent-run area shows only backend status and requested fidelity; it does not infer progress from a frontend timer.",
  "完成运行后，结果页只读取已验证的 report、artifact 和 schema 字段。":
    "After completion, the results page reads only verified report, artifact, and schema fields.",
  "按目标选择基础实验任务，然后进入真实配置页面。选择任务不会创建 run。":
    "Choose a basic experiment task by goal, then continue to real setup. Choosing a task does not create a run.",
  "任务卡只负责选择配置起点；正式 run 必须在配置页完成校验后提交。":
    "Task cards only select a setup starting point; a formal run must be submitted after validation on the setup page.",
  选择任务: "Choose a task",
  "选择任务 →": "Choose task →",
  "任务卡中的场景、输入和产物用于帮助选择配置起点；示例会保留 example 标记。":
    "Task-card scenarios, inputs, and outputs help choose a setup starting point; examples retain their example marker.",
  "选择后会进入新建实验页面，并保留允许的 run 与页面上下文。":
    "The selection opens New experiment while preserving the allowed run and page context.",
  "兼容任务卡不会修改 canonical request，也不会代替 descriptor、capability 或字段校验。":
    "Compatibility cards do not modify the canonical request or replace descriptor, capability, or field validation.",
  "填写必要的实验身份、输入来源和 requested fidelity，确认 canonical request 后提交正式 run。":
    "Fill in experiment identity, input source, and requested fidelity, confirm the canonical request, and submit a formal run.",
  "实验名称和场景用于生成可追溯的 canonical request。":
    "The experiment name and scenario contribute to a traceable canonical request.",
  "输入来源、requested fidelity 和 resolved fidelity 是不同语义；提交前只确认请求，实际解析结果由后端报告返回。":
    "Input source, requested fidelity, and resolved fidelity have different meanings; setup confirms intent, while the backend report provides the resolved result.",
  输入与能力: "Inputs and capabilities",
  "不可用能力保持禁用；输入来源和公开能力状态来自 descriptor/capability。":
    "Unavailable capabilities remain disabled; input sources and public capability status come from the descriptor and capability contract.",
  校验与提交: "Validate and submit",
  "校验通过后才可以创建正式 run；重复提交会复用已有 idempotency key。":
    "A formal run can be created only after validation passes; duplicate submissions reuse the existing idempotency key.",
  "查看后端返回的 queued、preparing、running、completed、failed、unavailable 或 incomplete 状态。":
    "Review backend-returned queued, preparing, running, completed, failed, unavailable, or incomplete states.",
  当前状态: "Current status",
  "状态和失败原因来自 Bridge；状态变化由后端响应决定。":
    "Status and failure reasons come from the Bridge; changes are determined by backend responses.",
  运行身份: "Run identity",
  "run ID、backend identity、schema revision 和 artifact SHA-256 用于恢复和复核同一运行。":
    "Run ID, backend identity, schema revision, and artifact SHA-256 restore and verify the same run.",
  下一步动作: "Next action",
  "完成运行后查看结果；失败或不完整时重新配置，不把异常状态解释为成功。":
    "Open results after completion; reconfigure failed or incomplete runs instead of treating an exception as success.",
  "页面不显示前端估算的百分比或剩余时间；终态会停止轮询，刷新合法 run URL 会按 run ID 恢复。":
    "The page does not show frontend-estimated percentage or remaining time; terminal states stop polling and a refreshed valid run URL restores by run ID.",
  "合法 run URL 只恢复对应的运行状态和证据上下文，不会创建新 run，也不会清除专业版上下文。":
    "A valid run URL restores only that run's status and evidence context; it does not create a run or clear professional context.",
  结果结论: "Result conclusion",
  "按结论、证据和字段细节阅读已验证结果。来源、fidelity、schema 和 artifact 身份会保持可见。":
    "Read verified results through conclusions, evidence, and field details. Source, fidelity, schema, and artifact identity remain visible.",
  "关键指标保留后端单位和字段路径；合法 0 会显示为 0。":
    "Key metrics retain backend units and field paths; a valid zero is displayed as 0.",
  必要图表: "Required chart",
  "只有报告提供真实逐域字段时才绘制利用率图表；字段缺失时显示边界状态。":
    "The utilization chart is drawn only when the report provides real per-domain fields; missing fields show a boundary state.",
  "该报告没有逐域利用率字段（missing / not covered），未生成演示图表。":
    "The report has no per-domain utilization field (missing / not covered); no decorative chart was generated.",
  "报告身份已过期，未生成可用图表。": "The report identity is stale; no usable chart was generated.",
  "报告身份已过期或与当前 run 不一致，未生成可用图表。":
    "The report identity is stale or does not match the current run; no usable chart was generated.",
  "报告 schema 不受支持，未生成可用图表。": "The report schema is unsupported; no usable chart was generated.",
  "缺少已验证 artifact manifest，未生成演示图表。":
    "A verified artifact manifest is missing; no decorative chart was generated.",
  "manifest、schema revision、artifact SHA-256 和 contract status 用于确认结果身份。":
    "Manifest, schema revision, artifact SHA-256, and contract status confirm result identity.",
  专业版与高级能力: "Professional workbench and advanced capabilities",
  "完整 design space、trace package 深度编辑、完整拓扑和更高阶 Agent 能力仍在专业版及其公开能力范围内。":
    "Full design-space and trace-package editing, complete topology editing, and advanced Agent capabilities remain in the professional workbench within its public capability boundary.",
  高级配置: "Advanced setup",
  "完整 design space、trace package、拓扑编辑和高级 profile 可在专业版继续编辑。":
    "Continue editing full design space, trace packages, topology, and advanced profiles in the professional workbench.",
  恢复语义: "Recovery semantics",
  专业版细节: "Professional details",
  "需要完整执行、验证、Fabric、设计空间或 Evidence 详情时，进入专业版并保留当前 run query 上下文。":
    "For complete execution, validation, Fabric, design-space, or Evidence details, open the professional workbench with the current run query context preserved.",
  回到轻量版开始: "Back to lightweight start",
  选择实验任务: "Choose an experiment task",
  "requested / resolved fidelity": "requested / resolved fidelity",
  "requested fidelity 是提交意图；resolved fidelity 只能由后端运行报告确认。":
    "Requested fidelity is submission intent; resolved fidelity can only be confirmed by the backend run report.",
  "missing / not covered": "missing / not covered",
  "缺失或未覆盖字段保持原状态，不会被前端补成 0，也不会被解释为真实证据。":
    "Missing or uncovered fields retain their original state; the frontend does not fill them with zero or interpret them as real evidence.",
  配置实验: "Configure an experiment",
  任务选择边界: "Task-selection boundary",
  进入配置: "Open setup",
  查看运行状态: "View run status",
  查看结果摘要: "View result summary",
  "real_trace、synthetic_trace 和 compatibility_harness_trace 不会互相升级；0、missing、stale 与 unsupported 也必须分开阅读。":
    "real_trace, synthetic_trace, and compatibility_harness_trace are never upgraded into one another; 0, missing, stale, and unsupported must also be read separately.",
  "完整 design space、trace package 深度编辑、完整拓扑和更高阶 Agent 能力仍在专业版及其公开能力范围内；schema identity 仍由后端契约维护。":
    "Full design-space and trace-package editing, complete topology editing, and advanced Agent capabilities remain in the professional workbench within its public capability boundary; schema identity remains maintained by the backend contract.",
  "兼容任务卡不会修改 canonical request，也不会代替 descriptor、capability 或字段校验；schema identity 仍由后端契约维护。":
    "Compatibility cards do not modify the canonical request or replace descriptor, capability, or field validation; schema identity remains maintained by the backend contract.",
  "完整 design space、trace package、拓扑编辑和高级 profile 可在专业版继续编辑；schema identity 仍由后端契约维护。":
    "Continue editing full design space, trace packages, topology, and advanced profiles in the professional workbench; schema identity remains maintained by the backend contract.",
  "合法 run URL 只恢复对应的运行状态和证据上下文，不会创建新 run，也不会清除专业版上下文；schema identity 仍由后端契约维护。":
    "A valid run URL restores only that run's status and evidence context; it does not create a run or clear professional context, and schema identity remains maintained by the backend contract.",
  "需要完整执行、验证、Fabric、设计空间或 Evidence 详情时，进入专业版并保留当前 run query 上下文；schema identity 仍由后端契约维护。":
    "For complete execution, validation, Fabric, design-space, or Evidence details, open the professional workbench with the current run query context preserved; schema identity remains maintained by the backend contract.",
};
