# 全局右侧 Agent 对话栏规范

> 文档 ID：`AO-16`
>
> 类型：跨页面产品与前端架构设计（`proposed`）
>
> 前置阅读：[产品与用户体验](02_PRODUCT_AND_USER_EXPERIENCE.md)、[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)、[会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)、[模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)

## 1. 产品定位

TileSim 应在桌面页面右侧提供一个跨页面常驻的 Agent 对话栏。它不是 Evidence Agent 页面的一块附属区域，而是整个工作台统一的“TileSim 助手工作区”：用户可以在浏览参数、实验、运行、执行、指标、网络和证据页面时，随时用自然语言让 Agent 解释当前内容、生成草案、校验配置、发起经过审批的操作或继续分析。

右侧对话栏解决的是“用户不知道下一步去哪个页面、需要填什么、结果怎样连起来”的问题。它不改变各业务模块的事实所有权，也不让模型获得隐式全局权限。

## 2. 目标

- 用户不离开当前页面即可询问和完成相关任务；
- Agent 能接收明确、最小、可审计的当前页面上下文；
- 对话、草案、校验、审批、运行和证据使用 typed blocks 呈现；
- 常用能力从固定四类问题扩展为 descriptor-driven action/skill catalog；
- 普通用户先看到解释和下一步，专业细节按需展开；
- 多个前端和后端 Agent 可以围绕稳定接口并行开发；
- 在 conversation/workflow contract 未发布前，不伪造正式多轮和写操作。

## 3. 非目标

- 不把所有页面功能重新实现一遍放进侧栏；
- 不自动读取整个页面 DOM、所有 artifact 或用户未选择的数据；
- 不因用户打开侧栏就调用 Provider；
- 不允许模型直接修改表单、创建 run、取消任务或导航到敏感资源；
- 不把侧栏 transcript 当作参数或运行真源；
- 不在浏览器持久化 credential、Provider raw response、hidden reasoning 或完整 artifact；
- 不在没有正式 contract 时用本地消息数组冒充可恢复多轮会话。

## 4. 用户可让 Agent 完成的任务

### 4.1 页面理解

- “这个页面是做什么的？”
- “我现在看的指标、图和状态分别是什么意思？”
- “为什么这个参数当前不可用？”
- “这里的 DES、Trace 来源和 GPU 参与方式有什么区别？”

页面说明来自版本化页面 capability/context，不从 DOM 文案自由推断。

### 4.2 实验配置

- 从自然语言目标生成实验草案；
- 设置当前正式支持的调度、batch、KV 和网络参数；
- 后续选择模型、引擎、设备、卡数、TP/PP/EP 和请求模板；
- 对选中表单字段解释单位、来源、支持范围和影响路径；
- 给出多个有界候选及差异。

只有 catalog 中 `agent_exposed` 且真实 executed 的字段才能进入可运行草案。

### 4.3 校验与规划

- 检查显存、KV、并行度、placement、网络和预算；
- 找出冲突、未知条件和 unsupported 能力；
- 解释 deterministic validation issue；
- 把修复候选应用到新 draft revision。

关键计算全部来自确定性服务。

### 4.4 运行操作

- 展示将执行的 request、候选数、等待、成本和可信范围；
- 用户审批精确 digest 后创建 run；
- 查看 operation/run 进度；
- 在正式支持时请求取消；
- 从失败、断流或进程重启恢复。

侧栏只是 workflow UI；写副作用由 Bridge 服务端审批和幂等门禁控制。

### 4.5 结果和证据

- 解释当前 run 的结论、依据、限制和下一步；
- 定位请求、执行、KV、设备、集合通信和网络证据；
- 展开 atomic claim 的精确 citation；
- 解释 stale、partial、refused、truncated 和正式错误；
- 后续比较兼容 run 并生成下一轮草案。

### 4.6 工作台操作辅助

- 导航到 Agent 明确引用的页面、run、artifact、字段或 Pointer；
- 将侧栏中选中的 draft/issue/citation 在主页面定位；
- 保存用户明确同意的单位或展示偏好；
- 导出 redacted 草案、校验摘要或证据引用。

导航和定位属于低风险 UI action；数据写入和运行操作仍需独立权限。

## 5. 能力发布矩阵

| 能力                                | 当前可展示                   | 正式开放前置                                        |
| ----------------------------------- | ---------------------------- | --------------------------------------------------- |
| 页面帮助和术语解释                  | 可使用现有静态/typed context | 不得扩写运行能力                                    |
| 当前 run 的 Evidence Agent 四类任务 | 可通过现有 descriptor v2     | 保持 request/response/citation/snapshot v1          |
| 当前八参数自然语言草案              | `proposed`                   | capability catalog + typed draft + equivalence test |
| 多轮主动澄清                        | 不可正式使用                 | Conversation/Turn/Goal contract                     |
| 模型、卡数、并行配置                | 不可正式使用                 | Profiles + calculators + 后端累计 lowering          |
| 创建 run                            | 不可由对话直接使用           | Approval + Workflow + idempotent create-run         |
| 取消/恢复                           | 不可正式使用                 | Operation/Event/Checkpoint + cancel fence           |
| 跨 run 比较                         | 不可正式使用                 | Comparison/Comparability contract                   |
| MCP/A2A/外部工具                    | 不开放                       | Tool registry、安全评测和独立协议适配               |

侧栏根据运行时 capability 动态隐藏或禁用动作，并解释解锁条件；不能以灰色按钮暗示已经具备后端能力。

## 6. 桌面布局

产品只面向电脑网页端。右侧栏至少有四种 UI 状态：

- `closed`：完全关闭，但保留明确入口；
- `collapsed`：窄条，仅显示打开、未读/待处理状态；
- `open`：默认宽度，与当前主页面并排；
- `expanded`：用户主动扩大，用于查看长草案、校验和 citation。

用户可调整宽度，系统保存的只是本机 UI 偏好，不是 conversation 数据。主页面应有最小可用宽度；空间不足时侧栏覆盖或进入 expanded workspace，而不是把图表和表单挤压到不可用。

侧栏打开/关闭不得重建当前页面 query、清除 run 或丢失未提交表单。路由变化时对话容器保持，但当前页面上下文作为新 revision 更新。

## 7. 对话栏信息结构

从上到下建议为：

1. **Header**：助手名称、当前任务、capability 状态、关闭/展开；
2. **Context Bar**：当前页面、run、选中对象和用户明确附加的证据；
3. **Conversation Timeline**：用户消息与 typed response blocks；
4. **Pending Work**：澄清、draft、validation、approval 或 operation；
5. **Composer**：输入、附加当前选择、停止生成和提交；
6. **Status Footer**：等待、连接、Provider/operation 正式状态。

Header 不长期展示模型名、SHA 或 contract 小字。模型/provider identity、revision、citation 和诊断信息进入“专业详情”。

> **2026-09-22 修订（已实现）**：Conversation Timeline 的“用户消息 + typed response”落地为两个新的 typed block：
> `user_message`（用户自己那一句）与 `assistant_message`（模型的回答，带**写它的模型名**、`streaming` 与 `error`
> 三个字段）。回答是**边写边显**的：每次可见增量都以 `prose` 事件把**到目前为止的全文**重发一次，面板直接整体替换
> 该块正文，不需要前端自行拼接增量；只要 `streaming` 为真，块内就保持一行“正在写回答…”状态，**短回答也不会被误当
> 已写完**。断流或停止后正文保留，并在同一块内说明原因。
>
> 多轮上下文只由**面板已显示的内容**构成：前端保留最近若干轮 `{role, content}` 并在下一次请求里整体回放，Bridge
> **不持久化** transcript（见本文 §12 状态所有权、§19 留存）。因此这条链路提供的是**有界的对话连续性**，
> 不是 §5 矩阵里那行需要 Conversation/Turn/Goal contract 的“正式多轮”；刷新即失，也不假装已持久化。
>
> 隐藏 reasoning（`delta.reasoning_content` / `delta.reasoning`）在 provider 适配层被丢弃：既不返回、也不落盘。

## 8. Typed Message Blocks

Timeline 不只渲染自由文本，至少支持：

- `explanation`：普通语言说明；
- `clarification`：1–3 个阻塞问题；
- `capability_result`：可用/不可用、原因和依赖；
- `draft_summary`：字段、来源、diff 和 unresolved；
- `validation_result`：errors/warnings/unknowns 和修复候选；
- `approval_request`：副作用、预算、等待和 exact digest；
- `operation_progress`：节点、进度、恢复和取消；
- `evidence_result`：结论、依据、限制、下一步；
- `citation`：按需展开精确 identity；
- `formal_error`：稳定 code、影响和安全下一步。

每个 block 绑定正式对象 reference 和 revision。自由文本不得携带隐藏的表单 patch、tool call 或 approval。

## 9. Composer

Composer 支持自然语言和显式上下文附件：

- “附加当前页面”；
- “附加当前 run”；
- “附加已选参数/候选/图表点/claim”。

> **2026-09-22 修订（已实现）**：Composer 不再提供意图模式选择。本节原文中的两条——“仅询问，不修改草案”、
> “已有正式草案时选择‘提出修改’”——**已随模式单选项一起删除**，改为**一个输入框**：用户描述一个场景，
> 前端判读后给出**推荐方案**（含理由与“应用到面板”按钮）；也可直接写 `参数路径 = 值` 得到确定性改动；
> 提问句则只解释。判读与推荐**全部在前端本地完成**，不额外请求 capability 快照；
> **任何一路都不会创建运行**，只有用户点“应用到面板”才写入面板。

默认不上传整个页面或完整 artifact。提交前显示将发送的 context 类型和数量；受限、过大或不兼容对象不能附加。

Enter/换行行为、IME 中文输入、停止生成和错误恢复必须明确。发送期间不得锁死主页面操作。

> **2026-09-22 修订（已实现）**：回答边写边显期间，提交按钮换成**“停止”**——停止只结束本次回答（已收到的正文保留
> 并说明“已停止这次回答”），**不是失败**，与通道不可用区分开。此时仍可继续写下一句，但 Enter 不会开始第二轮，
> 避免在同一轮上叠加请求。
>
> 通道是可选的，**没配模型时行为与从前完全一致**：Bridge 在流开始前用普通 JSON 回应（未配置 `503`、尚未发布该
> 路由 `404`、请求非法 `400`），前端据此**退回内置预设与本地规则**，不把半开的流当结果。模型提案一律只在用户点
> “应用到面板”后写入，任何一路都不创建运行。

## 10. Page Context Envelope

每个业务页面通过只读 `AgentContextProvider` 向侧栏发布最小上下文，不允许侧栏抓取组件内部状态。Envelope 建议包含：

- page/route stable ID 和 context revision；
- current workspace/run/backend/schema identities；
- selected entity type/ID；
- available context resources 的 typed references；
- page-supported Agent actions；
- field IDs、artifact refs 或 chart subject refs；
- data classification、allowed purpose 和 expiry；
- display label 的本地化 key；
- stale/availability status。

Envelope 不包含 credential、完整 artifact payload、未提交敏感表单、DOM HTML 或任意回调函数。

## 11. 上下文选择规则

- 用户问题默认只绑定当前 page ID，不自动绑定所有数据；
- 当前 run 是 workspace 中已校验加载的 run，不使用尚未完成的 URL 请求值；
- 页面选择变化只更新 context revision，不重写历史 turn；
- 如果用户问题依赖已变化选择，旧 response 标 stale 或明确保持其原 snapshot；
- 主页面跳转由 typed navigation target 执行，拒绝模型生成的任意 URL；
- 多 run 同时存在时必须让用户选择 owning run。

## 12. 状态所有权

| 状态                      | Owner                               | 前端保存方式                |
| ------------------------- | ----------------------------------- | --------------------------- |
| 侧栏开关、宽度、expanded  | Agent shell UI                      | Pinia/local UI preference   |
| current page context      | 各 feature context adapter          | 内存、revisioned、只读      |
| conversation/turn         | Bridge conversation service         | TanStack Query/server state |
| draft/validation/approval | 各正式 domain service               | Query cache + object refs   |
| operation/progress        | workflow service                    | Query/SSE snapshot          |
| current run               | 既有 workspace/run state            | 只引用，不复制              |
| Evidence response         | Evidence Agent query/store 既有边界 | 保持 lease/stale 规则       |

侧栏 shell 不成为新的全局业务 store。它只编排子模块和展示当前 references。

## 13. 与主页面协作

双向协作通过 typed commands：

- `focus_field(field_id)`；
- `open_run(run_id)`；
- `open_artifact(artifact_ref, pointer)`；
- `preview_draft(draft_ref)`；
- `apply_draft_patch(patch_ref)`；
- `show_validation_issue(issue_ref)`。

主页面负责决定该命令是否适用并返回 acknowledged/rejected/stale。侧栏不能 import 其他 feature 内部组件或直接修改其 store。

## 14. 导航与会话连续性

- 同一 conversation 可以跨页面继续，但每个 turn 固定 page context snapshot；
- 打开 Agent 引用的页面时保留对话滚动和 pending task；
- 切换 workspace/run 时必须提示上下文变化，未完成草案或 claims 按契约 stale；
- 新建 conversation、切换 conversation 和清除 transcript 是显式动作；
- 若 retention 未获同意，刷新后可以不恢复 transcript，但不得假装已持久化；
- 深链接只包含非敏感 object IDs，不包含问题、payload 或 credential。

## 15. 审批和高风险操作体验

Approval block 必须在侧栏内完整显示关键 diff、运行数量、fidelity、预算、等待、数据范围和副作用，并提供“查看完整草案”入口。批准与普通发送按钮视觉和语义分开。

以下情况禁止批准：validation invalid/unknown/stale、profile drift、权限不足、预算超限或 compiled digest 不一致。修改任何字段后旧 approval block 标 stale，不能重复点击。

## 16. 状态与错误

必须分别展示：

- 正在生成语言结果；
- 等待用户澄清；
- 正在确定性校验；
- 等待审批；
- run/operation queued/running；
- Provider partial/refused/truncated；
- stale；
- 两类 409；
- 502/503/504；
- workflow failed；
- cancel requested/cancelled/cancel not supported。

错误只影响对应 turn/block/operation，不能清空整个对话或当前 run。重试必须说明会否调用 Provider、会否产生副作用以及是否使用原 key。

## 17. 可访问性与键盘

- 提供全局快捷键打开/关闭侧栏，快捷键可发现且不与浏览器冲突；
- 打开后焦点可选择留在主页面或进入 composer，不强制抢焦点；
- Esc 只关闭当前弹层/expanded 状态，不丢失输入；
- timeline 使用合适的 log/feed 语义，异步更新礼貌播报；
- clarification、draft action、approval 和 citation 都是原生键盘控件；
- 主页面与侧栏之间焦点跳转有明确返回点；
- 不依靠 hover/color 表达上下文、stale 或风险；
- 支持中文 IME、200% 缩放、reduced-motion 和长 identity 换行。

## 18. 性能与生命周期

- 侧栏代码应独立 lazy-loaded，未打开时不加载 Provider/workflow 大模块；
- 打开侧栏不重新请求全部 artifact，只查询最小 capability/context；
- 长 timeline 使用窗口化或分页，但不能破坏读屏顺序；
- route/context 高频变化去抖并按 revision 丢弃旧响应；
- SSE 断开回退 operation snapshot/polling，不把断流视为失败；
- 大型 citation/detail 按需查询；
- 侧栏崩溃应被 error boundary 隔离，不影响主工作台。

## 19. 安全、隐私与留存

- Page Context Envelope 和附件在发送前按权限、用途和大小过滤；
- 页面/文档/artifact 文本视为不可信数据；
- 模型无法通过回复获得导航、写操作或外部 URL 权限；
- 对话服务端绑定 principal/workspace，拒绝客户端伪造 run/resource；
- credential、hidden reasoning、raw Provider response、完整 artifact 和 validated claims 副本不持久化；
- 用户原文、偏好和 transcript 必须有 consent、expiry、delete；
- telemetry 只保存 IDs、revisions、状态、计数和 redacted 摘要。

## 20. 前端组件边界

建议拆分为：

- `AgentCopilotShell`：全局装载、宽度和 lifecycle；
- `AgentContextRegistry`：注册页面 provider，只读聚合 context refs；
- `AgentConversationTimeline`：按 typed blocks 渲染；
- `AgentComposer`：输入和显式附件；
- `AgentDraftBlock`、`AgentValidationBlock`、`AgentApprovalBlock`；
- `AgentOperationBlock`；
- `AgentEvidenceBlock` 和 citation detail；
- 每个业务 feature 自己的 `agent-context-adapter`。

Shell 不访问业务 store 内部字段；block 不直接调用 Provider/create-run；context adapter 不创建 conversation 或草案。

## 21. 并行开发拆分

契约冻结后可以拆为互不覆盖的开发线：

| 开发线              | 独占范围                            | 输入契约                        | 不得修改                         |
| ------------------- | ----------------------------------- | ------------------------------- | -------------------------------- |
| Shell/Layout        | 侧栏容器、resize、lazy lifecycle    | panel UI model                  | conversation/domain/业务 feature |
| Conversation UI     | timeline/composer/block registry    | Conversation/Turn/block schemas | 全局 app shell、Provider         |
| Context Registry    | provider interface/aggregation      | Page Context Envelope           | 各业务 feature 内部              |
| Feature Adapters    | 单个 feature 的 context mapping     | provider interface              | shell、其他 feature              |
| Draft/Validation UI | typed draft/issues/diff             | draft/validation contracts      | request builder/calculator       |
| Workflow UI         | approval/progress/cancel            | operation/event contracts       | create-run service               |
| Evidence UI         | claims/citations/status             | Evidence v1 + future adapter    | response validator/store core    |
| Accessibility/E2E   | keyboard/focus/cross-route fixtures | stable DOM/action IDs           | 业务实现逻辑                     |

App shell、router、全局 CSS/i18n、contract/generated client 和 shared E2E snapshot 由集成 owner 单槽修改。每个 feature adapter 使用独立目录和测试，便于多个 Agent 并行。

## 22. 分阶段实施

> 实现进度（2026-09-17）：Stage 0 已完成；Stage 2 的自然语言草案部分已完成（八字段 compiler、别名/单位归一、澄清、
> unsupported fail-closed、capability 投影），但 typed blocks 只覆盖 10 类中的 7 类，缺 `approval_request`、
> `operation_progress`、`evidence_result`、`citation`。Stage 1、3、4 未开始。逐项事实见
> [当前基线](01_CURRENT_BASELINE_AND_GAPS.md) 与 [Phase 2C Web 集成计划](23_PHASE2C_WEB_INTEGRATION_PLAN.md)。

Stage 0–4 是**实现顺序**，不是能力授权：进入某一 Stage 前，其依赖的 contract 必须先正式发布，且不得用前端模拟补齐尚未
发布的契约。

### Stage 0：只读 Shell

实现侧栏布局、开关、resize、context bar 和静态页面帮助；不创建会话、不调用 Provider。验证主页面不回归。

### Stage 1：当前 Evidence 接入

用适配器展示当前 Evidence Agent 的正式四类任务和结果，保持原 lease、stale、409、502/503/504；不能伪装多轮。

### Stage 2：自然语言草案

接入 capability catalog、intent compiler、typed draft 和 validation；仍不创建 run。

### Stage 3：正式多轮与审批

Conversation/Turn/Goal、retention 和 approval contract 发布后，启用可恢复对话和精确确认。

### Stage 4：运行与证据闭环

接入 operation/create-run/monitor/cancel、RAG、跨 run 比较和下一轮实验；按 capability 逐项开放。

## 23. 测试与验收

- closed/collapsed/open/expanded 和 resize；
- 路由变化、run 切换、选择变化和 context revision；
- 主页面 state/query 不因侧栏生命周期重建；
- typed block exhaustiveness 和未知 block fail closed；
- keyboard/focus/IME/reader/zoom/reduced-motion；
- context attachment allow-list、ACL、size 和 stale；
- draft/validation/approval revision propagation；
- operation reconnect/cancel/late terminal；
- Evidence Agent DOM、lease、两类 409、502/503/504 回归；
- Provider 未配置、不可用或 timeout；
- prompt injection、恶意 artifact、任意 URL/navigation；
- lazy-load、性能预算和 shell error isolation；
- 多个 feature adapters 的 dependency check，禁止内部 import。

## 24. 验收指标

- 目标用户能在不离开当前页面的情况下完成当前阶段任务；
- 首次使用者知道可以问什么、当前附加了什么上下文；
- 侧栏打开不会改变 run、表单或 artifact 事实；
- unsupported/未发布能力误宣称为 0；
- 未审批写操作为 0；
- context/credential/raw payload 泄漏为 0；
- 跨页面继续任务时 context stale 处理正确率 100%；
- 所有业务 feature 通过 adapter 接入，不在 Shell 堆积分支逻辑。

## 25. 依赖、Gap 与更新触发器

依赖 `GAP-COPILOT-UI-001`、`GAP-CONV-001`、`GAP-DRAFT-001`、`GAP-APPROVAL-001`、`GAP-WORKFLOW-001`、`GAP-RAG-001` 和 `GAP-TOOLS-001`。

侧栏全局装载、Context Envelope、typed blocks、状态 owner、支持动作、approval/cancel、retention 或桌面布局变化时，必须更新本文以及 [产品体验](02_PRODUCT_AND_USER_EXPERIENCE.md)、[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md) 和 [并行开发规范](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)。

> **2026-09-22 修订（已实现）**：「应用到面板」不再因为一次空转的重发布而永久失效。
> 三处 context publisher（`App.vue` 的通用投影、`ExperimentView`、`LightweightPrepareView`）此前用**单调计数器**
> 生成 `context_revision`，而它们的 watcher 是 `deep: true` ⇒ **任一被监视对象被「碰到」就换号**（对象引用被替换、
> 深层写入但值不变、keep-alive 页面重入都会触发）。`parameter_edits.plan_revision` 取的是计划生成时的 revision，
> 这之后一换号，应用守卫就拒；`markAgentBlocksStale` 还会把 `plan_revision` 置 null，使那块计划**再也点不动**
> （用户所见：反复点「应用到面板」都回「页面上下文已变化」）。
> 现在改由 `src/entities/agent-context/revision.ts` 的 `createPageContextRevisionKeeper()` 统一持有：
> revision 只在**被发布内容（含 page identity 前缀）真正变化**时前进，内容没变时不发布也不换号。
> revision 字符串格式不变，`compareAgentContexts` / 编译器 / stale 标记的语义不变 —— 真正变化的页面照旧会被拒。
>
> **2026-09-22 第二次修订（已实现）**：判据从「令牌没换」改成「**这份计划要改的那些地址没动**」。
> 上一版只是让令牌少换号，令牌仍然是唯一判据；而**任何**未预料到的重发布（桥接自检把 `state.bridge.checking`
> 翻一次、描述符刷新、页面重进、发布内容里 `availability`/`parameter_catalog` 跟着翻）都会换号，
> 于是同一症状再次出现。现在由 `src/features/agent-copilot-integration/parameter-plan.ts` 的
> `assessParameterPlan()` 裁决，`parameter_edits` 的每条编辑都带着它读到的 `previous`：
> 逐个地址与页面当次发布的 `parameter_catalog[].current` 比对，**任一地址的值变了、或地址已不在目录里 → 拒绝**
> （错误详情仍是 `parameter_plan_stale`，但消息指名道姓说是哪个参数从什么变成了什么，或已不存在）；
> 全部相符 → 写入，`plan_revision` 与当前 revision 一致时标 `basis: "revision"`，不一致（期间重发布过但没动到这些地址）
> 时标 `basis: "values"` 并在回执里说明「页面在此期间刷新过一次，但这几项指向的值没有变」。
> 相应地把 `markAgentBlocksStale` 里对 `parameter_edits` 的 `plan_revision: null` 去掉（草案类 block 的 stale 语义不变）：
> 重发布本身不能作为「值动过」的证据，判定权交回给真正能判定的那一步。
> 守护测试：`tests/unit/agent-parameter-plan-applicability.test.ts`（含「令牌换号但地址未动仍然可写」等回归用例）。
>
> **2026-09-22 第三次修订（已实现）**：上一版 keeper 的「内容没变就不发布」把**声明**也一起省掉了，
> 这是另一条独立的失效路径。`AgentContextRegistry` 里通用投影与页面发布用的是**同一个 provider id**（`app-shell`），
> 谁最后发布谁生效；而 `App.vue` 的路由 watch 每次路由变化都会 `synchronizeAgentRouteContext()` 发一次
> **无参数目录**的通用投影（`allowed_purposes:["explain"]`、`parameter_catalog:[]`）。
> `ExperimentView` 在 `<KeepAlive include="ExperimentView">` 里、`LightweightPrepareView` 也在同一 shell 下复用，
> 回到页面时组件**不重新 setup**（keeper 不重置）⇒ 内容与上次相同 ⇒ `changed=false` 直接 return ⇒
> **页面的富上下文再也没被声明回来**，通用投影一直是生效上下文。
> 症状有二：面板把带 `参数 = 值` 的句子答成「这里可以说明当前页面状态；参数草案请在新建实验页配置」（draft 不在
> `allowed_purposes` 里）；以及 `parameter_edits` 的 `plan_revision` 取自富上下文、当前却是通用投影的号 ⇒ 点「应用」被拒。
> 现在：**保持 revision 稳定**与**每次都声明上下文**是两件事 —— 两个页面 publisher 每次都 `publish`（revision 仍由 keeper
> 钉住不变号），`App.vue` 的 `publishExperimentAgentContext()` 只在「生效上下文已经是这份发布（`page_id` + `context_revision`
> 都相同）」时才跳过 registry 更新，避免把同一个对象推给面板重复渲染。
> 守护测试：`tests/unit/agent-context-revision.test.ts` 新增两条（两个 publisher **不得**再出现 `if (!changed) return;`；
> shell 必须按 `page_id` + `context_revision` 判重）；端到端证据见 `tests/e2e/dashboard.spec.js:54`（该用例会
> `/experiment → /overview → /experiment` 往返，正是这条路径）。

> **2026-09-23 修订（已实现）**：助手可写参数面从「13 个 `overrides` 旋钮」扩到**整份表单**（含「显卡数量」与
> `gpu_participation_mode`）。此前桥接侧 `bridge/providers/assistant_model.py` 的规则表只由描述符的
> `PARAMETER_DEFINITIONS` 生成，`_validated_plan()` 只认那 13 个地址，模型给表单字段一律按 `unknown_parameter`
> **静默丢弃**；前端 `parameter-catalog.ts` 虽已枚举整份表单，但验收在桥接侧 ⇒ 「加显卡」这类诉求必然落空。
> 现在新增 `bridge/contracts/parameter_surface.py`：从 `run-overrides` / `runtime-trace-input` / `topology-request-input`
> 三份 schema ＋描述符**推导**出全部可写地址（`SURFACE_ADDRESSES`，64 条），`resolve_address()` 负责归一化与判错，
> `surface_catalogue_text()` 产出的目录文本与校验口径**同源**（模型看到的与能通过的是同一份东西）。
> 引用型字段（`device_id`/`domain_id`/`module_name`/`src_device`/`dst_device`/`module_binding`）、容器与数组本身继续排除；
> 元素地址以 `[i]` 占位，模型若直接写 `devices[i]/...` 会收到 `address_needs_an_index`（明确说缺索引，而非含糊的未知参数）。
> 前端新增 `kind: "count"`（**集合规模，不是 JSON 类型**）：`parameter-catalog.ts` 暴露 `topology/devices`
> （文案「设备数量（显卡数量）」）与 `runtime_trace/requests` 两条规模地址，`parameter-edit.ts` 用 `COLLECTION_RESIZERS`
> 调既有 `setDeviceCount` 与新增 `setRequestCount` 增删集合；缩容时若有 link/domain 仍引用将消失的设备，抛
> `StructuredInputError` 并点名该设备（不静默破坏拓扑）。一次方案的长度上限 `MAXIMUM_SETTINGS` 由 20 提到 **40**，
> 且该条数随目录文本写进 SYSTEM_PROMPT；前端把被丢条数 `dropped` 写进方案理由（`App.vue` 透传给
> `modelScenarioRecommendation`），用户在面板上能看到「还有几项没列进来」。
> 门禁：桥接三文件 **257 passed**（`test_parameter_surface` 25、`test_assistant_model` 62、`test_server` 170），
> 前端 Vitest **1056 passed / 8 skipped**；真机通道验证显示目录文本 78 行且命中所列四类地址，模型能给出 8 卡方案。
> 详见 `docs/AI_HANDOFF.md` 的 2026-09-23 节。
