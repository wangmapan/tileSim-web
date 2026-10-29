# TileSim Agent 面试准备质量收口与修复计划

> 日期：2026-10-29
> 状态：施工中（P0-C01、P1-F01、flow revoke、服务端 execution-time ledger 与导航失败持久化已完成；其余项目继续按门禁推进）；本文件不代表整体实现完成。
> 当前能力边界：`local_dev + synthetic_trace + exploratory + not_for_production`

### 2026-10-29 施工复核追加记录

本轮继续施工并复核：

- Flow authorization revoke 已接入 canonical schema/OpenAPI/generated client、Bridge durable route 和前端导航停止按钮；撤销要求完整 immutable authorization envelope，写入 `revoked`/terminal event，精确幂等重放，resume/revoke 竞态 fail-closed。
- `max_execution_time_ms` 改为 Bridge 基于 durable `created_at` 的服务端账本；超时不会继续调用 runtime，状态为 `failed / execution_time_budget_exhausted`，授权 usage/remaining 与 GET 投影保持一致。
- 浏览器导航恢复在每个失败候选后提交一次同一 flow 的 durable observation，再使用更新 cursor 选择未访问候选；编排层保存 bounded `navigation_failures`，不再只保留最终成功观察。
- 当前 canonical schema-set oracle 为 `sha256:bb7dc63f42c11f01b38cb4c958353452905486d1513436e99168de60888ef6c4`；该 revision 变化来自本轮已授权 revoke contract/generated 发布，不改写历史记录。

本轮在保留既有工作树的前提下完成并复核了以下收口：

- `bridge/agent_harness/contracts.py` 已补齐三个 optimization authorization schema identity；
  `test_21_schema_identity_manifest_has_no_drift` 已通过。
- `src/App.vue` 的导航 resume 已携带同一 flow 的 authorization id/digest/budget；run-bound flow
  和模型意图请求在缺少真实 `input_snapshot_digest` 时 fail-closed。
- `bridge/providers/agent_intent.py` 现在要求请求 page catalog 与 Bridge 发布目录的
  capability 集合和 `supports_run` 完全一致；伪造目录不会进入模型调用。
- `unsupported_execution` 即使携带授权也保持 `refused/execution_not_supported_read_only`，
  不会被审计为 completed 或执行成功。
- 当前 canonical schema-set oracle 为
  `sha256:6c3b799abc38e6952eac0a6472ba202e37b48ba408553e4732dff46c8fb21d59`；本条不改历史基线数字。

仍开放的问题包括 transition-level 事件不是实时长连接、LangGraph optional/not active，以及普通 UI
对 Harness 技术细节的收口；这些不能在面试中描述为生产自主 Agent 能力。

## 1. 结论先行

当前 TileSim 已经有结构化意图契约、durable flow、受控 Harness、审批/预算对象和
fail-closed 的 stale/idempotency 语义，但还不能诚实地称为完整自主 Agent，也不能作为
生产执行系统来介绍。本轮确认：一个真实交付门禁失败、一个并发正确性缺陷，以及多个
实现语义与面试叙事不一致的问题。

本计划的顺序是：先修契约、身份、并发和删除生命周期；再收口节点和事件语义；最后在
明确授权后评估真正的模型计划/工具/观察/replan loop。计划完成不等于修复完成。

## 2. 非目标与硬边界

- 不接入 Run Intake v2 `/api/runs` create-run，不新增 `agent_exposed`、Profile 或设备/卡数能力。
- 不把 fixture、synthetic trace、deterministic fallback 或 local-dev batch 结果升级为真实验证、真实 GPU、calibration、held-out validation 或生产 GO。
- 不调用 Provider/live acceptance，不读取或输出 Provider credential，不操作真实用户 run。
- 不修改 `D:\tileSim`，不停止、重启或替换 `127.0.0.1:5173`，不部署。
- 本轮只做只读审查和计划文档；不修改 Bridge contract、generated client、revision 或 allowlist；不 commit、不 push。

## 3. 审查基线与方法

本轮检查了工作树、Agent Harness/flow/intent schema、Bridge provider/service/server、前端
App/flow/API/session/side-bar、删除协调器和现有测试，并复现了契约身份失败。

| 项目 | 实际事实 |
| --- | --- |
| Web branch / HEAD | `codex/experiment-layout-polish` / `28016188951338a033eedeb9f8303c08e38ee7bd` |
| 工作树 | 约 183 行 status、124 个文件 changed/untracked；全部按用户或其他 Agent 改动保护，未清理 |
| 当前 schema-set oracle | `python bridge/check_schema_set_revision.py` 输出 `sha256:69e724a56d73a1b4fe14c698cb9ba7823de587c17e810c439377655fa4cbb237` |
| 当前生成物 | `src/contracts/generated/bridge-contracts.ts` 绑定同一 `69e724...` |
| 文档漂移 | `docs/README.md:5-6` 仍显示 `3677e6...`；历史 `docs/AI_HANDOFF.md` 条目还出现 `495627...`、`dcee...`、`dd9fad...`；历史数字不能覆盖脚本/生成物 oracle |
| 直接失败 | `bridge/test_agent_harness.py:139-144` 的 `test_21_schema_identity_manifest_has_no_drift` |
| 失败重现 | `cd D:\tileSim-web\bridge; python -m unittest test_agent_harness.HarnessStoreFaultInjectionTest.test_21_schema_identity_manifest_has_no_drift`：失败，缺三个 authorization identity |
| 未作为本轮证据运行 | 全量 Vitest/typecheck/lint/build/Bridge 全量、完整 E2E、CTest、Provider/live acceptance；不能把历史 handoff 数字冒充本轮结果 |

### 3.1 契约失败的精确内容

`bridge/agent_harness/contracts.py:26-84` 的 `SCHEMA_IDENTITIES` 没有：

- `optimization_authorization_request`
- `optimization_authorization`
- `optimization_authorization_response`

但相应 JSON 已存在于 `bridge/contracts/schemas/agent-harness/`，并且
`scripts/generate-agent-harness-client.mjs:153-170` 已处理这些 schema。故这是 registry/
manifest 交付不完整，不是应放宽测试的问题。

## 4. 问题分级矩阵

| ID | 问题 | 级别 | 结论/首要处理 |
| --- | --- | --- | --- |
| P0-C01 | schema identity registry 漏三个 authorization schema | P0 | **已修复**：补 canonical registry，drift 回归通过 |
| P0-C02 | assistant model 是进程级 `_session_model` | P0 | 改为 session/principal/workspace/turn 绑定和请求快照 |
| P0-C03 | 授权预算未完整绑定 flow/receipt | P0 | 同一 immutable authorization digest 贯穿 start/resume/events |
| P0-C04 | 意图判定仍有历史关键词路由残留（可达性待回归确认） | P0（架构/叙事） | 模型输出只给结构化候选，安全 policy 不能变成正向猜测器 |
| P1-F01 | `compose_report` 不组装报告 | P1 | **已修复**：改名为 `mark_report_ready`，明确正文仍由报告展示层生成 |
| P1-F02 | flow/optimization/batch/harness SSE 是回放后关闭 | P1 | 改称 replay + polling，或另开 live stream 设计 |
| P1-F03 | batch `max_concurrency` 固定 1 | P1 | 明确 bounded serial；未来并发需新契约与调度证据 |
| P1-F04 | 软删/永久删接口名相近 | P1 | 统一用户永久删除入口，软删限 retention 内部 |
| P1-F05 | LangGraph 默认 optional/not active | P1 | 不得把 deterministic adapter 说成已激活 LangGraph |
| P1-F06 | input/run/artifact/context fence 不总有真实 digest | P1 | run-bound 缺失进入 stale/unavailable，不把 null 当匹配 |
| P1-F07 | `assistant-intent` 与 `agent-intent` 两套 schema/generated 并存 | P1 | 标记 legacy/迁移或合并为单一 active contract |
| P1-F08 | intent response 校验 risk/confirmation/steps/questions，但前端主要只消费 intent/page/capability | P1 | 将字段接入 policy/receipt，或删除未消费字段 |
| P1-F09 | `simulation_execution` 与 flow 的 `unsupported_execution` enum 不一致 | P1 | 明确 canonical mapping；当前仍是拒绝/未执行 |
| P1-F10 | flow HTTP event 是 transition-level 压缩，不是 11 节点逐节点轨迹 | P1 | 不把 node 字段当真实执行 trace；需要时新增正式 event append |
| P2-U01 | 侧栏泄露 Harness、retention、内部 identity | P2 | 普通视图聚焦目标/下一步；诊断进 advanced/evidence |
| P2-T01 | 时序、并发、live append、恢复证据不足 | P2 | 加交错、重启、replay、stale、预算和撤销测试 |

## 5. 用户列出的七项问题

### 5.1 契约身份注册表红门禁（P0-C01）

证据见 §3.1。修复时只能在明确 contract/generated 发布窗口中增加准确的 filename-derived
key → `$id` 映射；如 schema 内容改变，必须由 canonical schema 重新生成，不能手改 generated
文件或只扩大 allowlist。

验收：`test_21...` 通过；`pnpm contracts:generate`（仅 schema 有变化时）、
`pnpm contracts:check`、Bridge discovery、旧 identity/跨 revision/未知 identity fail-closed
均通过；generated diff 无无关格式化。

### 5.2 assistant model 进程全局状态（P0-C02）

证据：`bridge/providers/assistant_model.py:124-130` 定义 `_session_model`；`:397-414`
的 getter/setter 读写它；`:417-453` 的 `config_from_environment()` 每个请求读取它；
`:574-595` 的 `select_model()` 修改它。`bridge/server.py:5084-5135` 的 HTTP 选择请求
没有 session/principal/workspace/flow 绑定。当前测试主要覆盖单线程选择，未覆盖两个 session
交错和流内配置快照。

修复：选择记录绑定 `session_id + workspace_id + principal`，必要时绑定 conversation/turn，
带有限 TTL、撤销/stale fence；请求进入模型调用时创建不可变 `AssistantModelConfig` 快照，
chat/intent/result-analysis 的整条流只使用该快照；选择记录和 receipt 不得含 credential、
raw Provider response 或 hidden reasoning。

回归：A/B 选择不同模型互不覆盖；A 流开始后 B/A 切换不影响 A；清除只影响当前绑定；
跨 principal/workspace、过期、replay 和不同 payload fail-closed；无 Provider 时用注入 transport
测试，不能调用 live Provider。

### 5.3 `compose_report` 名称与实现不符（P1-F01）

`bridge/services/agent_orchestrator.py:804-811` 只把 `report_status` 置为 `ready`；
`execute_report_action()` `:785-801` 也主要是状态标记。正文实际由 `src/App.vue` 的
`presentResultAnalysis()` 和前端结果分析/fallback 生成，不是该节点产出。

二选一：

1. 将节点改名为 `prepare_report_result`/`mark_report_ready`，同步 node enum、事件、文案和测试；或
2. 让它消费验证过的 evidence/citations/artifact bindings，输出有界、可审计的 report
   projection（claims、citations、limitations、provenance），不重算指标、不伪造引用、不接 create-run。

验收必须证明节点输出真的包含 projection/reference，或者明确证明改名后不再声称“已组装正文”；
旧 run/manifest/schema/artifact、无证据状态都必须拒绝或显示空态。

### 5.4 SSE 不是实时推送（P1-F02）

`bridge/server.py:846-872` flow、`:1057-1080` draft、`:1580-1604` stage3、`:2867-2920`
optimization、`:3350-3380` batch、`:4254-4285` Harness stream 都先读 durable events，写出
已有事件和 terminal（如已终态）后关闭；`run` stream `:5259-5305` 才等待变化并发 heartbeat。
前端 `src/lib/api/agent-flow.ts:864+` / `src/App.vue:1238+` 已用 EOF 后 polling 恢复。

当前最小安全方案：产品、API description、typed block 和测试名称统一说“可恢复事件回放 +
durable polling”，不要说 realtime。若要 live，另开设计：append-while-open、heartbeat、
idle/terminal timeout、Last-Event-ID/cursor、慢消费者、断线、资源上限和 shutdown 行为，
并测试 sequence gap、重复和跨 flow 污染。

### 5.5 batch 并发固定为 1（P1-F03）

`bridge/contracts/schemas/agent-harness/concurrency-policy.schema.json:10` 用 `const: 1`；
`bridge/agent_harness/batch.py:130,184-194` 拒绝并归一化其他值；`bridge/server.py:3147-3308`
是单 worker 串行候选循环；阶段基线也明确该选择。

短期 UI、README、receipt、面试能力矩阵只能说“bounded serial batch/单并发批处理”。长期要
并发，必须新 contract revision，设计 slot lease、资源容量、公平性、预算计数、取消、恢复、
幂等、unknown outcome 和隔离测试；不能只把 1 改大。

### 5.6 11 节点没有模型调用（P1-F05/P2-F01）

`bridge/services/agent_orchestrator.py:644-658` 的 `normalize_intent()` 只接受已传入 enum，
`:664-686` 是确定性 capability gate。模型调用在独立 `bridge/providers/agent_intent.py`，
由 `src/App.vue:1338-1345` 调用；`build_langgraph_graph()` 只在可选依赖和显式 checkpointer
下编译，runtime 在 `bridge/server.py:598-599` 为 `deterministic_transition_adapter` /
`optional_not_active`。

准确定位是“模型辅助闭世界意图准入 + 确定性安全状态机”，不是自主编排 Agent。若面试要求
真正 Agent，单独实现受控 loop：模型计划 → 白名单工具 → 观察 → 预算计数 → 必要时 replan →
终止；所有调用绑定 identity，stale/unknown/revoke/budget exhausted 立即停机。未完成前，
产品与面试材料必须使用当前准确说法。

### 5.7 删除接口语义相近（P1-F04）

`bridge/agent_harness/store.py:650-665` 的 `delete_operation()` 是软删/脱敏，保留 root/事件；
`:667-729` 的 `delete_operation_permanently()` 才删 events、checkpoints、tool calls、
approvals、side effects、stage2/stage3 和 root。用户 `DELETE` 在 `bridge/server.py:4346+`
经 `bridge/services/agent_deletion.py` 走跨 store permanent coordinator，行为当前正确，但名字
仍易误用；`bridge/test_agent_harness.py:129-131` 直接测试历史软删也增加了误解风险。

修复：公开命名区分 `retain_operation_tombstone()` 与 `purge_operation_graph_permanently()`；
软删仅 retention/purge job 内部可调用，用户 API 明确跨 store 永久删除、幂等、权限和 partial
failure。同步 OpenAPI/README/receipt。回归覆盖：所有子表无残留、principal/workspace 拒绝、
partial failure 可重试、相同 key replay 稳定、旧 stream/checkpoint/recovery 不复活。

## 6. 其他必须纳入的风险

### 6.1 授权预算和 flow binding

`bridge/agent_harness/authorization.py:181-227` 已要求显式的
`max_navigation_attempts`、`max_model_calls`、`max_tool_calls_per_round`、
`max_run_creations`、`max_execution_time_ms` 和页面/动作白名单；但
`bridge/contracts/schemas/agent-flow/start-request.schema.json:7-62` 主要发布导航预算，
`src/App.vue:1357-1367` 还硬编码导航预算。下一阶段必须让 authorization issuance、flow
start/resume、durable state、events 和 receipt 使用同一 immutable envelope/digest；缺失、零、
负数、浮点、超上限、撤销、replay、clarification 和 retry 都 fail-closed 并计入预算。前端只
展示 Bridge 返回的已用/剩余值，不自行推算权威预算。

更具体地说，`AgentOrchestratorState` 虽在
`bridge/services/agent_orchestrator.py:105` 声明 `authorization_digest`，但
`bridge/services/agent_flow.py` 的 canonical state（约 `:371-420`）和 start 输入（约
`:515`）没有把它及完整预算使用/剩余持久化进 durable flow。当前导航授权因此主要是前端
typed block 的投影，而不是可验证的签发 envelope；在 authz id/digest、usage ledger 和
receipt 闭合前，不得宣称授权闭环。

### 6.2 意图 fallback 与身份绑定

`src/lib/api/agent-intent.ts` 已对 enum、候选页面、能力和 revision 做闭世界校验，失败返回
null；`src/App.vue` 约 `:2750+` 会记录 `intent_unavailable`。但 `src/App.vue` 约
`:2870+` 仍有 `looksInterrogative()`、`isUnsupportedExecutionRequest()` 等历史分支；必须
确认可达性，删除不可达正向 fallback 或明确 safety-deny 优先级。模型失败只能 clarification/
waiting_user。intent 必须绑定 session、当前页面/context version、run、backend、schema 和
input snapshot；缺失或变化进入 stale/unavailable，不能用 null 当作匹配。

此外，`bridge/providers/agent_intent.py:167-264` 对 `risk_level`、
`requires_user_confirmation`、`suggested_steps` 和 `clarification_questions` 做了校验，
但 `src/App.vue:2774-2847` 主要只按 `intent`、`candidate_pages` 和
`required_capabilities` 路由；这些模型字段没有真正进入授权、typed block 或 receipt。要么
把字段映射为确定性 policy/用户提示并测试，要么从正式 schema 删除未消费字段，不能把装饰性
结构化输出当成 Agent 能力。

同时，`bridge/contracts/schemas/assistant-intent/` 与
`bridge/contracts/schemas/agent-intent/` 两套 schema/generated identity 并存，运行时主要
使用 `agent_intent`。必须明确 `assistant-intent` 是 legacy、迁移中间态还是应隔离/删除，
并让 manifest、generated client 和 runtime 只认一个 active intent contract。

`agent_intent.py:16` 允许 `simulation_execution`，而
`bridge/contracts/schemas/agent-flow/start-request.schema.json:25-27`、state/resume schema
只接受 `unsupported_execution`；`src/App.vue:2779-2786` 将模型识别到的仿真执行强行映射到
拒绝分支。当前应明确显示“未执行”，或在正式 contract 窗口统一 enum；不能把该 mapping
描述成仿真执行已接入。

### 6.3 retention、隐私和恢复

`src/stores/agent-sessions.ts:8-11` 当前限制 8 sessions、7 天、200,000 bytes；
`:512-650` 负责过期过滤、数量/大小裁剪和异常 fail-safe。需要回归证明本地缓存不是服务端
Conversation store，且 credential、hidden reasoning、raw Provider response 和完整 artifact
不进入 localStorage 或 durable events。区分 Web session cache、Bridge flow/Harness store、
report/artifact source of truth；删除和重启恢复不能把其中一个当成另一个。

### 6.4 UI 信息密度

`src/features/agent-copilot-shell/AgentCopilotShell.vue:434-481` 仍渲染 session、retention、
model bar；props/API 在 `:63-101` 仍保留 Harness projection/timeline/task-center；
`AgentContextBar.vue` 还显示 `display_label`。普通用户主面板只应看到目标、结论、下一步、
必要状态和三个 quick-start 入口；Harness 技术面板、模型/会话设置、retention/delete 说明、
route/context/SHA/JSON Pointer 默认移入 advanced/evidence details。保留 API/emit 和审计能力，
避免用隐藏文字规避安全/可访问性测试。

### 6.5 flow 事件粒度（P1）

`bridge/services/agent_flow.py` 将内部图运行压缩为每次 HTTP transition 一个 bounded event；
11 个 orchestrator node 并不等价于 11 条 durable node event，resume 也不会自动产生逐节点
耗时/模型调用轨迹。当前 event 的 `node` 字段不能被面试叙事当成完整执行 trace。若需要展示
每节点执行、模型调用、工具观察或耗时，必须新增正式 event schema、单调 sequence、payload
digest、checkpoint/receipt 绑定和缺口恢复测试；在那之前只称 transition-level audit event。

## 7. 分阶段执行路线

### Phase 0：事实与发布门禁

1. 冻结 branch/HEAD/status、schema oracle 和未提交清单。
2. 在授权的 contract 窗口修 registry drift，生成并审查所有受影响文件。
3. 新增 dated handoff 说明当前 oracle，历史 revision 原文不改。
4. 先跑受影响 Bridge 单测、contracts check、docs check、typecheck。

### Phase 1：正确性、权限、删除和并发

1. 完成模型选择作用域与 request-start config snapshot。
2. 把完整授权 budget/digest 绑定 flow、resume、event、receipt。
3. 统一跨 store permanent erase，软删仅 retention 内部，补幂等/partial failure。
4. 完成 input/run/artifact/backend/schema/context fence 和未知结果停机测试。

### Phase 2：语义与生命周期

1. `mark_report_ready` 已完成改名；后续若要输出 report projection，必须另行定义并绑定验证过的证据。
2. 将一次性 SSE 正式称 replay + polling；若实现 live，单独定义连接与资源语义。
3. 把 batch 单并发上限写入 UI/receipt/面试矩阵；不暗示并发。
4. 补 flow resume、旧 cursor、事件顺序、重启、stale、revoke、recovery_required 测试。

### Phase 3：真正受控 Agent loop（可选，需单独授权）

仅在 Phase 0–2 通过且有明确授权后：

- 模型只能选择闭世界 action/tool，不产生 URL、router.push、Bridge endpoint 或任意函数名。
- deterministic policy 先 veto，工具返回 bounded observation；raw Provider response/credential/
  hidden reasoning 不入 state。
- 每次 model/tool call 写 digest-only event、durable checkpoint；预算和终止条件硬执行。
- stale、撤销、unknown outcome、超时、重启冲突进入 waiting/recovery，不自动猜测或重试。
- 仍只允许 local-dev synthetic path，不接 Run Intake v2/create-run，不开放无人值守生产执行。

### Phase 4：UX 与面试叙事

建立“代码证据—真实语义—允许说法—禁止说法—升级条件”矩阵，并通过临时 Edge fixture
验收 1440×1100、1024×768、light/dark、loading/error/stale/disabled、键盘焦点、长中文、
横向溢出和空态。普通用户先看到结论/重点/风险/下一步，内部 identity 和技术状态按需展开。

## 8. Definition of Ready / Done

### DoR

- schema oracle、OpenAPI manifest、registry、generated revision、Bridge runtime 一致，无 drift。
- 明确 deterministic adapter 与 optional LangGraph 的边界，依赖、版本、checkpointer 和 activation evidence 可复现。
- 每个模型/工具调用有 session/principal/workspace/turn/config snapshot；每个 event 有
  flow/run/context/backend/schema/input/artifact bindings。
- 删除、撤销、resume、SSE/polling、unknown outcome、stale 和预算有状态图和失败矩阵。
- 所有“实时、并发、自主、组装报告、执行成功”文案有代码和测试证据。

### DoD

- 受影响定向测试、Bridge unittest、contracts/docs/deps/typecheck/lint/build 和
  `git diff --check` 通过；skipped/not-reached 不计 passed。
- 有并发、时序、replay、重启、stale、revoke、budget、unknown outcome、deletion partial
  failure 和 evidence/report projection 测试。
- UI 视觉/a11y 通过；普通侧栏不暴露不必要 Harness 技术面板；高级诊断仍可按需读取。
- Handoff 记录实际命令/输出，未运行 E2E、CTest、Provider/live acceptance 明确标 `not-run`。
- 未获正式 contract 发布授权前不改 JSON/generated/revision/allowlist。

## 9. 面试叙事矩阵

| 主题 | 当前允许说 | 当前禁止说 |
| --- | --- | --- |
| 意图 | 模型驱动、闭世界、失败 fail-closed 的意图准入 | 模型可任意决定动作 |
| 编排 | deterministic transition adapter | 生产 LangGraph Agent 已运行 |
| 导航 | 白名单页面的受控本地导航观察 | 模型直接控制任意 router/浏览器 |
| 报告 | 已验证证据上的只读准备/导出 | 把 `mark_report_ready` 描述成完整正文生成节点 |
| 事件 | 可恢复事件回放 + durable polling | 当前多数端点是真实时推送 |
| 批处理 | local-dev 单并发候选评估 | 支持并发批量实验 |
| 执行 | 计划、授权、只读观察；create-run 未接入 | 已执行真实仿真/Provider |
| 证据 | local-dev、synthetic、exploratory，保留 provenance | production validation、calibration、held-out 或生产 GO |

## 10. 验证顺序与交接

实施每一批按以下顺序真实记录：受影响定向测试；`pnpm contracts:check`、`docs:check`、
`deps:check`；`pnpm typecheck`、`lint`、改动文件 format check、`build`、`git diff --check`；
Bridge `py_compile` 与相关 unittest；最后 `pnpm test`。E2E 仅在独立 fixture 端口、单 worker、
不与重门禁并发时运行。CTest、Provider/live acceptance、真实 GPU 和生产部署当前均为
`not-run`，不得伪报通过。

本轮已在不修改 canonical JSON/generated/revision 的前提下完成 P0-C01，并将编排节点改名为
`mark_report_ready` 以收口实际语义；P0-C02/C03/C04 等仍在施工和门禁中。未触碰
`D:\tileSim`、`127.0.0.1:5173`、Provider、credential、真实用户 run、commit、push 或部署。
计划完成不等于整体修复完成。
