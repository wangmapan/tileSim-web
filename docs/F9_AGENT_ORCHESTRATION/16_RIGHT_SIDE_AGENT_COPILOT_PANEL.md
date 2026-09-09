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
- “附加已选参数/候选/图表点/claim”；
- “仅询问，不修改草案”；
- 已有正式草案时选择“提出修改”。

默认不上传整个页面或完整 artifact。提交前显示将发送的 context 类型和数量；受限、过大或不兼容对象不能附加。

Enter/换行行为、IME 中文输入、停止生成和错误恢复必须明确。发送期间不得锁死主页面操作。

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
