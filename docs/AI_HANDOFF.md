# TileSim Web AI Handoff

## 2026-10-29 部署诊断 SQLite WAL 竞争修复（当前工作树）

- 修复部署脚本在停止旧 Bridge 前调用 `server.py --print-source-state-digest` 和
  `--print-schema-set-revision` 时的启动顺序缺陷：只读诊断现在在创建 Agent Harness 持久化
  store 前短路，不会打开用户的 WAL SQLite；`bridge/check_schema_set_revision.py` 同样显式进入
  只读诊断模式。这样旧的 5173 Bridge 仍持有 `/mnt/d` 上的 WAL 时，诊断不会把并发访问误报成
  source-state digest 失败。
- `scripts/deploy-local-backend.ps1` 的 Bridge 单测校验现在把所有 Agent Harness store 显式指向
  带随机后缀的 WSL `/tmp` state root，并在 finally 中做路径校验后的清理，不再把测试状态写回
  `runtime/`。
- 新增 `bridge/test_diagnostic_startup.py`：对损坏的临时优化数据库验证两个 print 命令及 schema
  revision check 成功、数据库字节不变。不会删除、重建或自动修复用户数据库。
- 本轮未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider credential、真实用户 run；部署仍需在用户环境
  重新执行，能力边界保持 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-29 Agent autonomy 复审第五轮：事件持久化 fail-closed（当前工作树，未提交、未部署）

- 发现并修复优化 Agent 事件写入失败被当作普通遥测处理的真实风险：`bridge/server.py` 的
  `_optimization_set_agent_event` 现在把非预期存储异常包装为 `event_persistence_failed`，并标记
  `unknown_outcome=true`；worker 不再继续模型重试、规则回退或自动提交，而是进入
  `recovery_required`/人工恢复边界。事件仍只持久化有界摘要与 digest，不写入完整模型文本。
- 新增 `bridge/test_agent_event_persistence.py`，注入事件存储故障并验证错误码、未知结果和不可自动重试语义，
  也覆盖 waiting-approval 状态进入 recovery 的窗口。定向优化测试为 **22 tests / OK**；Bridge `py_compile`
  通过；全量 Bridge discovery 为 **628 tests / 7 skipped / OK**。
- 前端最新全量 Vitest 为 **131 files / 1403 passed / 8 skipped**；`pnpm typecheck`、`pnpm lint`、
  `pnpm contracts:check`（canonical revision `sha256:0085e3a4e89576fff168f29d811be581c7107b9bd3f8fabf9834d651f3c606b3`）、
  `pnpm docs:check`、`pnpm deps:check` 和既有生成物检查保持通过。LangGraph flow 仍是
  `deterministic_transition_adapter` / `optional_not_active`，事件端点仍是可恢复回放 + durable polling，
  不宣称实时长连接。
- 规则 fallback 审查确认：意图识别失败不会回退关键词猜测；`deterministic_fallback` 仅用于已验证证据整理，
  未知意图进入 clarification/waiting_user。批处理仍为 `max_concurrency=1` bounded serial。
- 能力边界继续为 `local_dev + synthetic_trace + exploratory + not_for_production`；Run Intake v2/create-run、
  Provider/live acceptance、真实 GPU、CTest 与生产部署仍 blocked/not-run。未触碰 `D:\\tileSim`、
  `127.0.0.1:5173`、Provider credential、真实用户 run、commit 或 push。

## 2026-10-29 Agent autonomy 复审第四轮：导航历史与恢复终态 fail-closed（当前工作树，未提交、未部署）

- 纯导航执行器 `bridge/services/agent_orchestrator.py` 不再静默过滤 checkpoint 中的未知、重复或未授权
  `visited_pages`；未知页面/重复历史/未授权历史、空或含未知页面的 allowlist，以及额外 action grant 均拒绝，
  保留原始损坏历史并返回 `navigation_history_invalid`/授权检查失败。`bridge/test_agent_orchestrator.py` 新增回归。
- durable flow runtime 校验 `navigation_attempts` 不得超过授权上限、不得落后于 `visited_pages`，并重新校验
  observation 的实际页面与发布 capability 集合；不存在实际页面时不能声称拥有 capability。对应回归位于
  `bridge/test_agent_flow.py`。
- batch/optimization 的 JSON event replay 与 SSE 现在把 `recovery_required`、`manual_intervention_required` 作为
  观察终态，前端 `src/lib/api/agent-optimization.ts` 与 Harness 面板不再把人工介入状态误报为 active；事件序列
  gap 继续 409 fail-closed。相关 HTTP 回归覆盖 recovery/manual replay。
- Bridge Harness HTTP 测试在替换全局 SQLite store 后恢复原 store，消除了按 unittest discovery 顺序运行时的
  closed-database 污染；`PYTHONPATH=D:\\tileSim-web python -m unittest discover -q` 当前 **621 tests / 7 skipped / OK**。
- 本轮没有修改 contract JSON、generated client、schema revision 或 allowlist；canonical revision 仍为
  `sha256:0085e3a4e89576fff168f29d811be581c7107b9bd3f8fabf9834d651f3c606b3`。能力边界仍为
  `local_dev + synthetic_trace + exploratory + not_for_production`；Run Intake v2/create-run、Provider/live acceptance、
  CTest、真实 GPU 与生产部署仍 blocked/not-run。
- 未触碰 `D:\\tileSim`、`127.0.0.1:5173`、Provider credential、真实用户 run；未 commit、未 push。

## 2026-10-29 Agent autonomy 复审第三轮：契约 manifest、checkpoint 与生命周期收口（当前工作树，未提交、未部署）

- 本轮修复了真实的发布契约漂移：`assistant-intent` 现在在 `bridge/contracts/openapi.json` 中明确标为
  `legacy_compatibility`、`routable=false`，active HTTP/runtime 只使用 `agent-intent`；同时 Agent Flow
  manifest/schema/fixture/generated client 对齐 13 个 schema identity，并补齐
  `revoke_authorization` endpoint。`pnpm contracts:check` 当前 canonical revision 为
  `sha256:0085e3a4e89576fff168f29d811be581c7107b9bd3f8fabf9834d651f3c606b3`。
- durable flow projection 现在在 GET、事件回放、resume/revoke 和 restart 读取前校验 event sequence、导航计数、授权 usage
  与 envelope；字符串、负数、回退或损坏状态统一为 `langgraph_checkpoint_mismatch` / HTTP 409，禁止静默 `int()` 或归零。
- 前端导航生命周期继续保持 fail-closed：批准的目标路径过渡不会误 abort 自身 controller；会话切换/删除/卸载强制停止旧循环；未知
  `visited_pages` 不再被静默过滤。模型选择仍为 session/principal/workspace 绑定与请求级 immutable config snapshot；HTTP 选择/catalogue
  缺少 session header 时返回 400。
- 真实验证：前端 Vitest `131 files / 1395 passed / 8 skipped`；Bridge discovery `608 tests / 7 skipped / OK`；定向 Flow/intent/model
  测试与 `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm docs:check`、`pnpm deps:check`、`git diff --check` 已通过（最终契约生成后
  的全量复跑仍需按门禁顺序补齐）。构建仅保留既有大 chunk warning。
- 语义边界不变：Flow/optimization/batch/harness SSE 是可恢复事件回放 + durable polling，不宣称实时长连接；batch 是
  `max_concurrency=1` bounded serial；LangGraph runtime 为 `optional_not_active`；Run Intake v2/create-run、Provider/live acceptance、
  CTest、真实 GPU 与生产部署仍 blocked/not-run。能力保持 `local_dev + synthetic_trace + exploratory + not_for_production`。
- 本轮未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider credential、真实用户 run、部署；未 commit、未 push。

## 2026-10-29 Agent flow 施工后第二轮审查与门禁修复（当前工作树，未提交、未部署）

- 导航执行的两个响应丢失窗口已补齐：撤销与成功页面观察都使用同一幂等键做一次有界重放，
  仍不确定时通过 durable GET 对账；只有匹配已持久化的 `cancelled/revoked` 或 observation+sequence
  才恢复成功，否则保持 `stale`，不重新暴露旧动作。`src/App.vue` 与
  `tests/unit/agent-flow-app-integration.test.ts` 回归覆盖通过（App lifecycle 42、navigation 10）。
- Bridge flow 预算现在绑定同一签名授权 envelope：`max_navigation_attempts` 不得扩大授权预算；
  optional runtime 的 `model_calls`/`run_creations` 计数单调合并，类型回退和超预算均
  `langgraph_checkpoint_mismatch`/`authorization_budget_exhausted` fail-closed。
  `bridge/test_agent_flow.py` 定向 **45 tests OK**。
- 修复 Bridge manifest 测试对旧 11 个 flow identity 的硬编码，改为校验当前发布的 13 个 exact identity；
  `test_server.py` **191 tests OK**。Phase 2D registry 恢复只读兼容投影 API（不改变
  `runtime_status=unavailable`、`agent_exposed/calculator/ranking=false` 或空的
  `executable_combinations`），并将结构性 model facts 的 provenance/claim ceiling 保持在
  `externally_specified`/`exploration`；registry tests **8 tests OK**。
- 前端全量 Vitest **131 files / 1391 passed / 8 skipped**；`typecheck`、`lint`、`build`、
  `contracts:check`（canonical revision `sha256:bb7dc63f42c11f01b38cb4c958353452905486d1513436e99168de60888ef6c4`）、
  `docs:check`、`deps:check`、`git diff --check` 和 Bridge `py_compile` 通过。Prettier 对既有
  dirty 的 Vue/TS 文件仍报告格式差异，Python 文件无 parser；未做覆盖式格式化。
- 在 `bridge` 目录设置 `PYTHONPATH=D:\\tileSim-web` 后运行 `python -m unittest discover -q`，
  全量 Bridge discovery **604 tests / 7 skipped / OK**；日志中的 400/503 是故障注入测试的预期
  HTTP 结果，不是失败。显式 `test_server.py`、Agent flow/orchestrator/deletion/intent 和 registry
  套件也均已独立通过。
  CTest、E2E、Provider/live acceptance、真实 GPU、Run Intake v2 create-run 和生产部署仍未运行。
- 未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider credential、真实用户 run；未 commit、未 push。
  能力边界继续为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-29 Agent flow revoke、预算账本与导航恢复复核（当前工作树，未提交、未部署）

- Flow authorization revoke 已形成独立的 JSON/OpenAPI/generated client 链路：
  `POST /api/agent/flows/{flow_id}/authorization/revoke` 要求完整授权 envelope、当前 binding、
  cursor、principal/workspace 和幂等键；Bridge 以 durable 事务写入 `authorization_status=revoked`、
  `cancelled` terminal 状态及连续事件，精确重试返回同一 replay，撤销与 resume 竞态 fail-closed。
- 生成器已补齐 `AgentFlowRevokeRequest` / `AgentFlowRevokeResponse`，当前 canonical schema-set oracle
  为 `sha256:bb7dc63f42c11f01b38cb4c958353452905486d1513436e99168de60888ef6c4`；
  `pnpm contracts:check` 与 `pnpm typecheck` 通过。
- Flow 的 `max_execution_time_ms` 现在由 Bridge 根据 durable `created_at` 计算服务端权威使用量；
  resume 前和可选 runtime 返回后均重新检查，超时持久化为 `failed / execution_time_budget_exhausted`，
  授权标记为 exhausted，不继续导航或执行。GET 投影也显示最新 usage/remaining。
- 浏览器导航恢复会在每个失败候选后立即用同一 flow resume 写入 transition event，再使用更新后的
  cursor 尝试下一候选；Bridge 编排器保留 bounded `navigation_failures`。导航卡新增“停止这条建议”，
  通过 revoke endpoint 停止待执行授权，不再留下可继续的旧按钮。
- 定向证据：Bridge `test_agent_flow test_agent_orchestrator test_agent_deletion` 为 **78 tests / 7 skipped / OK**；
  前端 Flow/导航/App 定向为 **82 tests passed**，`typecheck` 通过。仍未 commit/push/deploy，
  未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider、credential 或真实用户 run。
- 语义边界不变：Flow SSE 是可恢复事件回放 + durable polling；LangGraph runtime 仍为
  `optional_not_active`；batch 仍是 `max_concurrency=1` bounded serial；能力仍为
  `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-29 Agent 意图 policy 与 schema-set 基线复核（当前工作树，未提交、未部署）

- `src/features/agent-intent-compiler/model-policy.ts` 将模型返回的 `risk_level`、
  `requires_user_confirmation`、`suggested_steps` 和 `clarification_questions` 投影为确定性
  policy：澄清问题会停止后续动作；高于 low 的风险、明确 execute 步骤和模型确认标记不会授予
  权限，导航仍只进入既有人工确认卡，仿真执行仍进入明确未执行/拒绝路径。模型输出不是事实或授权。
- 当前 schema-set oracle 与 generated client 均为
  `sha256:6c3b799abc38e6952eac0a6472ba202e37b48ba408553e4732dff46c8fb21d59`；本轮只运行生成物
  drift check，没有新增 canonical contract 字段。`assistant-intent` 仍是历史兼容 schema，实际
  active HTTP/runtime 路径为 `agent-intent`，两者未合并，后续应在正式迁移窗口处理。
- Flow/optimization/batch/harness 事件流的产品语义保持“可恢复事件回放 + durable polling”，
  前端状态文案不再把 Flow 回放称为实时通道；batch 仍为 `max_concurrency=1` 的 bounded serial。
- 新增意图 policy 回归：`tests/unit/agent-intent-model-policy.test.ts`；保留
  `local_dev + synthetic_trace + exploratory + not_for_production`，未接 create-run、Provider 或
  生产执行。
- 本条未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider、credential、真实用户 run、部署、commit 或 push。

## 2026-10-29 Agent 面试准备语义收口（当前工作树，未提交、未部署）

- 修正编排节点命名：`bridge/services/agent_orchestrator.py` 的 `compose_report` 已改为
  `mark_report_ready`。该 transition 只标记已经通过证据校验的结果可供报告展示层读取，不组装正文、claims
  或 citations；前端报告投影仍由结果报告 feature 负责，避免把状态标记误称为报告生成。
- Agent Harness schema identity registry 补齐 `optimization_authorization_request`、
  `optimization_authorization` 和 `optimization_authorization_response` 三个已发布 schema；未修改
  canonical JSON、generated client 或 revision。`test_21_schema_identity_manifest_has_no_drift` 已通过。
- 模型选择继续保持 session-scoped、request-start immutable config snapshot；assistant chat、intent 和只读结果分析
  的 Bridge 请求沿用同一 scope，正在进行的流不会因另一会话切换模型而改变。能力边界仍为
  `local_dev + synthetic_trace + exploratory + not_for_production`。
- 事件端点的准确语义仍是可恢复事件回放 + durable polling；当前未宣称多数 Agent 端点是真实时长连接。批处理仍为
  `max_concurrency=1` 的 bounded serial batch。用户删除走跨 store permanent graph erase，软删仅作为明确命名的 retention tombstone 兼容路径。
- 本条未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider、credential、真实用户 run、部署、commit 或 push。

## 2026-10-28 Agent autonomy authorization budget 收口（当前工作树，未提交、未部署）

- 授权 envelope 现在要求签发请求显式提供 `max_navigation_attempts`、`max_model_calls`、`max_tool_calls_per_round`、`max_run_creations` 和 `max_execution_time_ms`；缺失、零、负数、浮点数或超过 local-dev 上限均 fail-closed，不再从进程默认值恢复。`allowed_pages` 与 `allowed_actions` 也必须显式提供、非空、去重并来自发布目录；导航执行器只接受显式 `navigate` 动作。
- 授权 digest、验证、撤销、durable agent turn receipt 和剩余预算继续绑定这些字段；旧 envelope 在恢复/重放时不能重新获得默认预算。回归覆盖五类预算的缺失与边界值、白名单缺失/未发布值、HTTP 签发与幂等 replay。
- Agent Harness generated client 已与 canonical Bridge schema-set 绑定到 `sha256:495627d32f488aa46933795664c86a837c9ef05a211528b451054ec6ccce16a9`；`pnpm contracts:check` 通过。Agent Bridge 定向 **128 tests / 7 skipped / OK**，`test_server.py` **187 tests / OK**；Web 全量 **130 files / 1349 passed / 8 skipped**，`typecheck`、`lint`、`build`、`docs:check`、`deps:check`、`git diff --check` 和 Bridge `py_compile` 通过。HTTP 合并运行曾遇到一次 Windows `WinError 10053`，单测随后独立复跑通过。
- 仍保持 `local_dev + synthetic_trace + exploratory + not_for_production`；未接入 Run Intake v2/create-run 或生产执行，未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider、credential、真实用户 run、部署、commit 或 push。完整 E2E、CTest、Provider/live acceptance 未运行。

## 2026-10-28 Agent 面试路径收口（当前工作树，未提交、未部署）

- 修复配置页对明确“创建运行 / 启动运行 / 执行实验 / run it”请求的真实路由缺陷：`src/features/agent-intent-compiler/constants.ts` 暴露统一的 `isUnsupportedExecutionRequest()`，`src/App.vue` 在结果分析、疑问和配置草案分支之前将其绑定到 `unsupported_execution` flow；Bridge 在无授权时以 `authorization_required_for_execution` fail-closed，不能进入 `confirm_draft`，也不会调用 create-run。新增 `tests/unit/agent-execution-intent.test.ts` 和 App flow 回归断言。
- 最新 Web 全量 Vitest **128 files / 1340 passed / 8 skipped**；Agent flow/intent 定向 **67 passed**；`pnpm typecheck`、`pnpm lint`、`pnpm build`（仅既有大 chunk warning）、`contracts:check`（canonical schema-set revision `sha256:dcee3503...`）、`docs:check`、`deps:check`、`git diff --check` 通过。
- Bridge `test_server.py` **187 tests OK**，Agent flow/autonomy 定向拆分复跑 **80 tests / 7 skipped / OK**；同一组并行运行曾出现一次 Windows `WinError 10053` 连接中止，未视为代码断言通过。完整 Bridge discovery 仍有既有 Phase 2D registry 导入错误，真实 LangGraph runtime 仍未激活（`deterministic_transition_adapter` / `optional_not_active`）。
- 能力边界保持 `local_dev + synthetic_trace + exploratory + not_for_production`；未修改正式 contract/generated/revision，未接 create-run，未触碰 `D:\tileSim`、`127.0.0.1:5173`、Provider、credential、用户 run、部署、commit 或 push。

## 2026-10-27 执行回放第二轮审查与修补（当前工作树，未提交、未部署）

- 修复播放到时间终点后再次点击“播放”无法重播的问题：会从已验证时间范围的起点重新开始，并清空上一轮帧余量，不改变用户选择的慢放档位。
- 修复页面级空格快捷键与证据说明 `<summary>` 冒泡冲突；焦点在说明控件时只展开/收起说明，不会意外启动回放。Fabric/集合步骤的 SHA、Pointer 等技术证据保持默认收起，按需展开。
- 拓扑回放的物理链路和详情选中项都按 ID 预计算索引，避免大拓扑/大事件集在每帧或每次详情重绘时重复线性查找；令牌进度改用 `BigInt` 定点比例，避免 64 位 ps 时间戳转 `Number` 后的精度损失；没有改变路径校验或证据来源语义。
- 回放专项测试 **79 passed（6 files）**；全量 Vitest **1315 passed / 8 skipped（127 files）**；`pnpm typecheck`、`pnpm build`、改动文件 ESLint/Prettier、`git diff --check` 通过（build 仅有既有大 chunk warning）。视觉复核覆盖 1440×900、1920×1080、545×900、浅色/暗色模式，无横向溢出。未触碰后端、`127.0.0.1:5173`、部署、提交或推送。

## 2026-10-27 执行回放慢速档位与信息密度修补（当前工作树，未提交、未部署）

- 修复速度回弹：`ReplayControls` 的 `update:speed` 现在由父回放面板正确接收并写回状态；速度档位改为 **1/1000、1/2000、1/4000、1/10000、1/20000**，默认 **1/2000**，播放与重渲染后保持所选档位。
- “全部已报告证据”、集合通信步骤和拓扑路径证据默认收起；选中对应证据时自动展开并定位，保留虚拟列表、键盘焦点和完整后端记录，不删除或推断证据。
- 回放定向测试 **76 passed**；全量 Vitest **1312 passed / 8 skipped（127 files）**；`vue-tsc --noEmit`、改动文件 ESLint/Prettier、`git diff --check` 通过。临时 4175 预览检查了 1440×900 与 545×900，默认信息密度、速度控件和无横向溢出符合预期；未触碰 `127.0.0.1:5173`、后端、部署、提交或推送。

## 2026-10-26 执行回放同屏布局与数据流可视化修补（当前工作树，未提交、未部署）

- 回放主工作区改为桌面端左侧时间轴、右侧吸附式“设备与链路 / 详情”实时视图；集合步骤列表保留在下方，窄屏自动恢复纵向布局，避免播放时反复滚动寻找拓扑图。
- 拓扑回放新增“当前数据流”读出：优先展示后端已报告的 collective 阶段、round/chunk、源设备、目标设备和无损 bytes；Fabric 事件没有 bytes 时明确显示未报告。
- 只有 `available` route 且 `actual_path`、`linkIds` 与已验证 topology links 完整匹配时，才在 SVG 中显示沿真实链路移动的数据令牌；不从拓扑推断路径、不伪造 packet/flit。
- 回归：回放组件/查询/导航/速度/虚拟列表定向测试 **76 passed**；全量 Vitest **1311 passed / 8 skipped（127 files）**；`vue-tsc --noEmit`、改动文件 ESLint/Prettier、`git diff --check`、生产构建通过（仅既有大 chunk warning）。临时 4175 视觉复核确认宽屏首屏同屏、窄屏降级与无横溢出；未触碰 `127.0.0.1:5173`、后端、部署、提交或推送。

## 2026-10-26 执行回放独立模块与慢放默认值（当前工作树，未提交、未部署）

- 回放已从执行过程页拆为独立的 `/replay` 路由，并在侧边栏新增“执行回放”入口；执行过程页不再重复挂载回放面板。独立页继续复用现有运行身份、工件校验、路径/拓扑/集合证据和大列表窗口化能力。
- 播放默认速度固定为原速的 **1/100**（控件显示“1/100 速度 · 慢 100 倍”），可选档位仅更慢（最高不超过 1/100）；切换档位会清空上一档的帧余量，避免速度切换造成时间轴跳跃。
- 新增导航、速度和回放定向回归；本轮回放/导航相关测试、`vue-tsc --noEmit`、改动文件 ESLint/Prettier、生产构建均通过。未触碰后端、`127.0.0.1:5173`、部署、提交或推送。

## 2026-10-26 执行回放真实后端闭环与部署（当前工作树）

- 后端现在从真实 Fabric 执行状态导出 `tilesim.execution_replay.v1`：包含 `actual_path`、`link_endpoints`、`execution_events`、开始/结束时间和 S5 collective round/chunk 步骤；`ModuleStats::total_bytes` 全链路保持无损 `uint64`，不再输出浮点字节数。
- Bridge 在 S6 CLI 成功后校验 canonical execution replay；缺失或非法工件会以 `cli_invalid_execution_replay` 失败，不再把“运行成功但回放不可用”静默发布为 completed。未修改缺口提示文案，也未从拓扑推断路径、packet 或 flit。
- 正式部署脚本已从当前 `D:\tileSim` 工作树重建 WSL CLI 并原子更新 `runtime/backend-current.json`：source/build state `7e880db134b103290d9d437eb564daaf737ce9a0f2e4fd2c854344bddc031013`，CTest **102/102**，Bridge `test_server.py` **187 tests OK**，Web Vitest **1301 passed / 8 skipped**，生产构建通过；随后 5173 已切换到该 manifest，health `execution_ready=true`。
- 新建真实 run `run-20261026-182001-4e8f284b` 已 completed；回放工件为 `supported/ready`，含 **1164** 条 Fabric 路径、**8148** 条执行事件、**1164** 个 collective 步骤，时间范围 `100–21029082468 ps`，两个模块的 `total_bytes` 均为 JSON 整数。上述仍属于当前声明的 synthetic consistency/exploratory 证据边界。
- 部署摘要排除项新增 `tmp/`，避免回放探针和 Bridge 临时产物触发源码摘要误报；真实 Web 源文件变化仍会 fail-closed。未提交、未推送。

## 2026-10-26 Agent 侧栏转为对话优先（工作树，未提交、未部署）

- 普通用户侧栏不再挂载 Stage 4/5 Harness 技术面板，因此不会再展示 session、candidate、checkpoint、事件序列或“创建后再批准”等内部控件；
  底层 Harness props、事件、API 和后端审批边界保持不变。
- 会话选择、模型选择和本地缓存操作移入默认收起的“会话与模型设置”；标题、输入提示和空态入口改为更大的对话优先文案，保留三个快捷入口供用户开始对话或生成提示词。
- 回归位于 `tests/components/agent-copilot-shell.test.ts`、`tests/unit/agent-copilot-shell-accessibility.test.ts`：验证 Harness 数据即使存在也不渲染，三个快捷入口仍保留，模型/会话控制仍可在设置区使用。未修改 contract、generated client、Bridge、Provider 或执行能力。

## 2026-10-26 Agent 侧栏冗余上下文展示移除（工作树，未提交、未部署）

- 右侧助手不再渲染 `AgentContextBar` 这块重复的上下文卡片；页面上下文 envelope、revision/stale 比较、composer
  禁用守卫和状态 footer 保持不变。用户仍可通过助手标题/状态和对话内容获得必要反馈，不再展示
  `current-unsaved-experiment`、context revision、route、run ID 或引用数量等内部诊断字段。
- 回归位于 `tests/components/agent-copilot-shell.test.ts`：确认上下文卡片不挂载，并保留上下文变化后的 stale 状态提示。
  未修改 contract、generated client、Bridge、Provider 或执行能力。

## 2026-10-26 Agent 助手第二轮协议与数据一致性审查（工作树，未提交、未部署）

- 修复 `src/lib/api/agent-batch.ts` 的 batch replay 游标缺陷：`getAgentBatchEvents()` 现在要求返回的 `after_sequence` 是安全整数且与请求游标完全一致；batch detail 的事件也统一经过 schema identity、contract revision、batch binding、连续 sequence、state、digest、timestamp 和 provenance 校验，不再只检查序号和 `batch_id`。
- 修复 `src/lib/api/assistant-model.ts` 的模型目录一致性缺陷：只有 `selected_model` 确实出现在已发布 `models` 列表中时才接受 catalogue；聊天与结果解读 SSE 终态后拒绝继续到达的帧，聊天也拒绝重复 plan，避免 `done`/`error` 后的晚到 payload 污染显示或触发后续动作。
- 新增回归：`tests/unit/agent-batch-api.test.ts` 覆盖 replay cursor 漂移与 malformed detail event；`tests/unit/assistant-model-api.test.ts` 覆盖 selected identity 不在 catalogue；`tests/unit/assistant-model-chat.test.ts` 与 `tests/unit/assistant-result-analysis.test.ts` 覆盖终态后的 late frame。定向助手/API **68 passed**；全量 Vitest **124 files / 1289 passed / 8 skipped**。
- 质量门禁：`vue-tsc --noEmit`、ESLint、Vite build、`contracts:check`（canonical revision `sha256:3677e6e3c01d0970a1107d97b2d0b3452c20c0230f412f4a1567ab4933478a89`）、`docs:check`（54 active Markdown）、`deps:check`（336 source files）、改动文件 Prettier 与 `git diff --check` 通过；build 只有既有大 chunk warning，contracts 只有既有 Ajv `date-time` ignored warnings。
- Bridge 合并运行首次出现已知 Windows worker 连接中止，非断言失败；拆分重跑确认 `test_agent_flow.py + test_agent_orchestrator.py` **52 tests / 7 skipped / OK**，`test_server.py` **187 tests / OK**，py_compile 通过。完整 E2E、CTest、Provider/live acceptance 未运行；未触碰 `127.0.0.1:5173`、`D:\tileSim`、Provider、credential、用户 run、部署、commit 或 push。能力边界仍为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-26 Agent 助手全量审查：SSE 提前 EOF fail-closed 修复（工作树，未提交、未部署）

- 发现并修复两个真实客户端缺陷：`src/lib/api/agent-optimization.ts` 的 optimization SSE observer，以及 `src/lib/api/agent-batch.ts` 的 batch SSE observer，在只收到 workflow 帧后正常 EOF 时会错误地 resolve 成功，调用方可能把被截断的 advisory stream 当成完整观察结果。两者现在都要求收到并通过 identity/state 校验的 terminal 帧；否则分别抛出 `incomplete_optimization_stream` / `incomplete_batch_stream`，继续交由现有 durable polling/retry 边界处理。
- 新增 `tests/unit/agent-optimization-api.test.ts` 与 `tests/unit/agent-batch-api.test.ts` 回归，覆盖 workflow 后无 terminal 提前 EOF；原有完整 terminal、非法 terminal、sequence、schema metadata 和 incomplete SSE frame 断言继续保留。未改变 flow/harness observer 已有的 durable polling 语义。
- 本轮实测：定向 SSE **14 passed**；全量 Vitest **124 files / 1284 passed / 8 skipped**；`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm contracts:check`、`pnpm docs:check`（54 active Markdown）、`pnpm deps:check`（336 source files）、改动文件 Prettier 与 `git diff --check` 均通过。`contracts:check` canonical revision 为 `sha256:3677e6e3c01d0970a1107d97b2d0b3452c20c0230f412f4a1567ab4933478a89`，仅有既有 Ajv `date-time` ignored warnings；build 仅有既有大 chunk warning。
- Bridge `py_compile` 通过；`python -m unittest test_server.py test_agent_flow.py test_agent_orchestrator.py` 为 **239 tests / 7 skipped / OK**。完整 E2E、CTest、Provider/live acceptance 未运行；未触碰 `127.0.0.1:5173`、`D:\tileSim`、Provider、credential、用户 run、部署、commit 或 push。能力边界继续为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-26 LangGraph flow follow-up fail-closed 收口（工作树，未提交、未部署）

- `src/App.vue` 的 persisted flow 恢复现在共享 dashboard/navigation ready promise；会话切换会等待 bootstrap/deep-link 同步和 `nextTick()`，并以 session/route token 围栏旧恢复，避免暂态空 `runId` 把有效 flow 误判为 stale。`src/lib/api/agent-flow.ts` 另拒绝与 URL 不同的 status flow、终态携带 pending action、跨 flow 的嵌套 event binding/state，以及不完整 SSE frame；`src/lib/api/sse.ts` 在 EOF 遇到未闭合 frame 时 fail-closed，调用方继续走 durable polling/重试边界。
- 修复一个真实 typecheck 回归：`src/lib/api/agent-optimization.ts` 使用生成客户端实际发布的 `optimizationEventStream`，不再引用不存在的路径方法；`src/contracts/generated/agent-harness.ts` 与 `scripts/generate-agent-harness-client.mjs` 的 stream operation 保持一致。
- 本轮证据：全量 Vitest **123 files / 1272 passed / 8 skipped**；Agent Flow API/App 定向 **47 passed**；Bridge flow/orchestrator **52 tests / 7 skipped / OK**，`test_server.py` **187 tests OK**；Bridge `py_compile`、`vue-tsc --noEmit`、ESLint、Vite build、`contracts:check`、`docs:check`、`deps:check`、改动文件 Prettier 和 `git diff --check` 均通过。契约检查的 canonical revision 为 `sha256:3677e6e3c01d0970a1107d97b2d0b3452c20c0230f412f4a1567ab4933478a89`，仅有既有 Ajv `date-time` ignored warnings，build 仅有既有大 chunk warning。
- 完整 E2E、CTest、Provider/live acceptance 未运行；未触碰 `127.0.0.1:5173`、`D:\\tileSim`、Provider、credential、用户 run、部署、commit 或 push。标准 Bridge 仍为 deterministic transition adapter，optional LangGraph runtime 为 `optional_not_active`；能力边界继续是 `local_dev + synthetic_trace + exploratory + not_for_production`，Run Intake v2 DoR 与生产执行仍 blocked/pending。

## 2026-10-26 Agent 助手审查追加收口（工作树，未提交、未部署）

- `src/lib/api/agent-flow.ts` 对 start/status/events/resume 的外层 response envelope 增加闭世界字段、必填字段、布尔值、cursor 和 events 数组校验；未知字段、缺失字段或错误类型现在以 `invalid_flow_payload` fail-closed，不会被静默忽略。状态/event 内层仍继续走 generated validator、binding、sequence 和 terminal 一致性校验。
- `src/App.vue` 的实验配置页 explain flow 在只读流程完成后仍会追加用户可读的页面说明，不再只显示“流程已完成”状态块而吞掉答案；首次挂载与路由恢复继续等待 dashboard/deep-link 同步完成后再恢复 pending flow，避免临时空 `runId` 把有效流程误判为 stale。该恢复等待只增加身份保护，不覆盖实验页自己的 rich agent context。
- `src/stores/agent-sessions.ts` 恢复本地 transcript 时拒绝带未知字段、空内容或超长内容的 chat message，防止被篡改的 localStorage 字段进入下一次 Bridge 请求；对应回归位于 `tests/unit/agent-sessions.test.ts`。现有 quota 裁剪仍只作用于持久化副本，不删当前可见内存内容。
- 本轮回归：Agent 相关定向 **6 files / 107 passed**；全量 Vitest **123 files / 1264 passed / 8 skipped**；`vue-tsc --noEmit`、标准 `pnpm lint`、`pnpm build`、`contracts:check`、`docs:check`、`deps:check`、改动文件 Prettier 和 `git diff --check` 均通过。构建仅有既有大 chunk warning，契约检查仅有既有 Ajv `date-time` ignored warnings。
- 未运行完整 E2E、CTest、Provider/live acceptance；未修改正式契约 JSON、Bridge 后端、generated revision 或生产执行能力。5173、`D:\tileSim`、Provider、credential、用户 run、部署、commit 和 push 均未触碰。能力边界仍为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-26 Agent 助手全链路审查与最小修复（工作树，未提交、未部署）

- `src/lib/api/assistant-model.ts` 现在对 one-shot descriptor/plan/catalogue/selection 和两条 SSE 流统一校验 `tilesim.bridge.api.v1`、当前 generated schema-set revision、固定 schema identity、闭世界字段、plan instruction、模型目录计数/选择一致性与字段边界。SSE 对目标 envelope 的坏 JSON、未知 event、非法 plan/error/done 和缺少正常终态 fail-closed；非本频道 prose 仍忽略，不会把它当成用户回答。
- `src/lib/api/agent-flow.ts` 现在在语义 binding/sequence 检查前后结合 generated Agent Flow validators，拒绝未知根字段、非法日期时间、response terminal/status 不一致、resume action 错配和 terminal frame 的非终态；start binding 的 revision drift 与其他 identity mismatch 分开报告。`src/App.vue` 的取消操作立即递增 stream token、释放 busy/abort 状态并结束未完成 assistant block，避免 abort 尚未 settle 时旧回调污染新 turn。
- `src/stores/agent-sessions.ts` 对本地缓存的 created/updated/expires 时间戳、非负 sequence 和 capability projection 做 fail-closed 校验；损坏的 capability 不会重新注入助手上下文，过期/非法日期的会话不会恢复。超预算裁剪只作用于待写入副本，不再通过 localStorage quota/size 路径删掉当前内存中的可见消息或 block。
- 新增/收紧回归位于 `tests/unit/assistant-model-api.test.ts`、`assistant-model-chat.test.ts`、`agent-flow-api.test.ts`、`agent-flow-app-integration.test.ts`、`agent-sessions.test.ts`；没有修改正式 contract JSON、Bridge endpoint、generated contract revision 或生产执行能力。
- 实测：Agent 相关 **37 files / 403 passed**；全量 Vitest **123 files / 1253 passed / 8 skipped**；Bridge `test_server.py + test_agent_flow.py + test_agent_orchestrator.py` **233 tests / 7 skipped / OK**；`vue-tsc --noEmit`、全仓 ESLint、`git diff --check`、`contracts:check`、`docs:check`、`deps:check`、Vite build 均通过。`contracts:check` 仍只报告既有 Ajv `date-time` ignored warnings，build 仍只有既有大 chunk warning；本轮未运行完整 E2E。
- 后续 fail-closed 收口：flow start 的重复 Idempotency-Key 在进入 deterministic/optional runtime 前直接回放，Bridge 进程内并发由 start lock 串行化；客户端把 response binding revision、SSE frame id 和最终 event cursor 与 canonical schema/flow state 绑定；生成 Ajv validator 的 Node 原生 ESM helper 兼容 CJS default interop，并补实际调用回归。persisted agent-flow 在恢复前核对当前 run/context identity，损坏的 flow block 不进入 resume UI。补充门禁：全量 Vitest **123 files / 1255 passed / 8 skipped**；flow 前端定向 **46 passed**；`test_agent_flow + test_agent_orchestrator` **46 tests / 7 skipped / OK**，`test_server.py` **187 tests OK**；首次合并 Bridge 运行出现 Windows server worker 连接中止，拆分 canonical 套件后分别通过。完整 E2E 未运行。
- 5173、`D:\tileSim`、Provider、credential、用户 run、部署、commit 和 push 均未触碰。能力边界继续是 `local_dev + synthetic_trace + exploratory + not_for_production`；Run Intake v2 DoR、Profile records、真实 LangGraph HTTP runtime 和生产执行仍 blocked/pending。

## 2026-10-26 新建对话入口引导（工作树，未提交、未部署）

- 助手空状态的三个入口已更新为「了解助手能做什么」「从实验配置开始」「从已有结果开始」，移除过时的「学习怎么看结果」入口。
- 新用户引导只陈述当前已接入能力：解释页面和证据、生成并校验实验参数草案、只读解读已有运行结果；同时明确参数需用户确认，助手不会自动创建运行或调用真实 Provider。
- 「了解助手能做什么」使用现有 `explanation` typed block 展示能力、自然语言示例和安全边界，不新增 Bridge contract、LangGraph route 或执行副作用。事件联合类型已同步更新，旧 `learn` 任务不再从空状态发出。
- 受影响回归：`tests/components/agent-copilot-shell.test.ts` 覆盖入口文案、顺序、事件和旧文案移除；本轮不扩大到 Run Intake、Provider、生产执行或移动端。

## 2026-10-26 Flow 生命周期与幂等收口（工作树，未提交、未部署）

- `existing_run_analysis` flow 完成后，`src/App.vue` 会继续调用已验证的 `presentResultAnalysis`，不会只留下“流程已完成” typed block；结果分析仍受 run、schema、artifact 与 evidence binding 约束。
- resume 请求按完整 payload 生成 SHA-256 bounded `Idempotency-Key`；同一 mutation 在响应丢失后的重试复用原 key，action/cursor/binding 变化生成新 key，成功或上下文/会话失效后清理。该逻辑不改变 HTTP flow 的 deterministic adapter 语义。
- 当前实测门禁：前端 Vitest **123 files / 1222 passed / 8 skipped**；Bridge flow/orchestrator/`test_server` **230 tests / 7 skipped**；`typecheck`、`lint`、`contracts:check`、`docs:check`、`deps:check`、`build`、`git diff --check` 均通过。

## 2026-10-26 LangGraph HTTP 边界更正（工作树，未提交、未部署）

- `/api/agent/flows` 当前由 `bridge/services/agent_flow.py` 使用可审计的 SQLite WAL + deterministic transition engine 提供；它不是已接线的 LangGraph HTTP runtime。`build_langgraph_graph()` 仅在显式提供可选 `langgraph==1.2.17` 与 durable checkpointer 的隔离测试环境编译，标准 Bridge 进程不会自动加载该依赖。
- `/api/manifest.agent_flow` 与 OpenAPI metadata 现在明确发布 `runtime_mode=deterministic_transition_adapter`、`langgraph_runtime_status=optional_not_active`、`activation_boundary=local_dev_only`；前端 typed block 使用“只读助手流程”文案，不把 HTTP adapter 宣称为 LangGraph runtime。当前 canonical schema-set revision 为 `sha256:3677e6e3c01d0970a1107d97b2d0b3452c20c0230f412f4a1567ab4933478a89`，且已由 `bridge/check_schema_set_revision.py`、生成客户端和 manifest 对齐。能力仍为 `local_dev + synthetic_trace + exploratory + not_for_production`，不创建 run、不写配置、不调用 Provider。
- flow artifact binding 的 `bytes` schema 现在与 Bridge/前端无损十进制校验一致：只接受 `0` 或无前导零的十进制字符串；`01` 等值会 fail-closed。该契约修正已重新生成客户端和 validators，并使 schema-set revision 更新为上述值。
- flow resume 的 `clarify_intent` 现在只接受显式发布的 intent enum；Bridge 不再从 `clarification` 自由文本猜测路由，歧义或缺失 intent 会保持 fail-closed。对应 HTTP 回归覆盖见 `bridge/test_agent_flow.py`。
- Flow SSE 客户端现在也拒绝未发布的 event type；事件序列、flow/binding identity 和终态仍先经过连续性校验。
- 当前 flow HTTP adapter 的真实门禁包括 schema/API response headers、start/resume binding identity、幂等、权限、stale、event sequence、SQLite restart/rollback 与 non-retryable observer fail-closed；实际 LangGraph HTTP integration 仍 pending，不得把 optional runtime tests 当作 endpoint 已接线证据。

## 2026-10-25 最终 LangGraph/前端质量复核（工作树，未提交、未部署）

- 经用户授权，本轮正式纳入 LangGraph flow contract 发布窗口：canonical Bridge schema-set revision 更新为 `sha256:89982d73beec1c709f729c0ec3c1fbe295d7fb0d3db0ecafccc6e0b6fc7e9c1e`；`bridge/contracts/openapi.json`、`bridge/contracts/schemas/api-manifest.schema.json`、`bridge/contracts/schemas/bridge-api.schema.json` 与生成的 `src/contracts/generated/bridge-client.ts`、`src/contracts/generated/bridge-contracts.ts`、`src/contracts/generated/agent-flow-validators.js` 必须保持同一 revision。`/api/manifest` 现发布完整 10 项 flow schema identity、endpoint、scope、幂等和 `create_run=false` 边界；该变更仍仅限 `local_dev + synthetic_trace + exploratory + not_for_production`。
- 本轮最终实现文件为 `bridge/services/agent_orchestrator.py`、`bridge/test_agent_orchestrator.py` 和 `bridge/requirements.txt`；LangGraph **1.2.17** 在 Python **3.12.10** 隔离 `bridge/.venv` 中可导入。`build_langgraph_graph(checkpointer=InMemorySaver())` 实测返回 `CompiledStateGraph`；clarify/report interrupt 均可由 `Command(resume=...)` 恢复，确认后只读报告终态为 `completed / ready / read_only_result_ready`，stale、cancel、reject 和非法恢复重试均 fail-closed。未接 `server.py` endpoint、前端入口或正式用户服务，未创建 run、写配置、重算指标或调用 Provider。
- 最终 Bridge 验证：`python -m py_compile services/agent_orchestrator.py test_agent_orchestrator.py` 通过；隔离 venv `python -m unittest test_agent_orchestrator.py test_server.py` 为 **207 tests OK**（编排器 20、`test_server.py` 187）。前端全量 `pnpm test -- --reporter=dot` 为 **119 files / 1172 passed / 8 skipped**；typecheck、lint、build、contracts:check、docs:check（54 active Markdown）、deps:check（331 source files）、改动前端文件 Prettier 和 `git diff --check` 均通过。仓库级 `pnpm format:check` 仍有 **14 个既有格式警告**，未覆盖式格式化。
- 完整单 worker Edge E2E（临时 4173）实际为 **1 failed / 66 not reached**：warmup 导航在 90 秒超时，故暗色用例没有执行，不能把它当作暗色对比度通过或失败；此前 `--no-deps` 目标暗色用例也因 fixture 未完成挂载而超时，未取得新的 AA 断言结果。此前已保存的报告覆盖运行时对比度证据仍为 `#a0a4aa` 对 `#191a1c` **约 6.95:1**，并未放宽断言。
- `127.0.0.1:5173` 仍由原进程监听；临时 4173 已释放。未触碰 `D:\tileSim`、Provider、credential、用户 run、部署、commit 或 push。经用户授权，本轮已更新 LangGraph flow contract/generated client/schema-set revision 至 `sha256:89982d73beec1c709f729c0ec3c1fbe295d7fb0d3db0ecafccc6e0b6fc7e9c1e`；Agent Harness successor revision drift 与 Run Intake v2 DoR、Profile records、Bridge lowering execution evidence 仍另行 blocked/pending。能力边界仍为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-25 LangGraph interrupt/checkpoint 安全收口（工作树，未提交、未部署）

- `bridge/services/agent_orchestrator.py` 的 LangGraph 适配现在要求显式 checkpointer；缺少 checkpointer 直接抛出 `langgraph_checkpointer_required`，不允许构建一个运行到用户暂停时才失败的 ephemeral graph。澄清意图与报告/草案确认都通过真实 `interrupt()` 暂停，使用 `Command(resume=...)` 恢复；invalid clarification 或 wrong-pending confirmation 会重新 interrupt，不会留下 `next=()` 的无暂停 checkpoint；纯 transition engine 仍保留供无依赖的审查测试。
- 隔离 `bridge/.venv`（Python 3.12.10，`langgraph==1.2.17`）下真实 backend 回归为 **20 tests OK**，覆盖 clarification、report confirmation、cancel/reject、stale binding、非法恢复后的再次 interrupt、partial/truncated evidence 和无损十进制 bytes。标准库 Python 未安装可选依赖时，相关 backend tests 明确 skipped，dependency/checkpointer 缺失均 fail-closed。
- 当前没有 `server.py` endpoint、前端入口或生产路由接线；本适配不是用户可用的 Agent 服务。下一轮若获明确授权，只能先定义只读 adapter 输入/输出（session/flow、run/backend/schema/input/artifact bindings、validated evidence、approval、terminal reason）并复用现有 Bridge identity/citation validator；不得在此模块直接创建 run、写配置、调用 Provider 或替代正式 contract/generated client。

## 2026-10-25 LangGraph 真实运行时验证补充（工作树，未提交、未部署）

- 为单编排器增加可审计的 `bridge/requirements.txt`，固定 `langgraph==1.2.17` 及其完整传递依赖（`langchain-core==1.7.0`、checkpoint/prebuilt/sdk、pydantic、transport/runtime 等精确版本）。依赖只安装在工作树被忽略的 `bridge/.venv`（Python **3.12.10**）中；标准 Bridge 进程不会因该文件自动加载依赖，未改变现有部署契约。
- 使用该隔离环境实测 `build_langgraph_graph()` 返回 `CompiledStateGraph`；`InMemorySaver` 配置下首次 `invoke()` 产生真实 `__interrupt__`，随后用 `Command(resume={"action":"confirm_report", ...})` 恢复，最终得到 `graph_status=completed`、`report_status=ready`、`terminal_reason=read_only_result_ready`。该 smoke 验证未创建 run、未修改配置，也未调用 Provider。
- `bridge/services/agent_orchestrator.py` 仍是只读、单编排器适配：节点顺序和纯 transition engine 保持一致，LangGraph 缺依赖时显式抛出 `langgraph_dependency_unavailable`，不以伪造实现替代；resume 前继续比较 run/context/backend/schema/input/artifact identity，变化进入 `stale`，取消/拒绝保持明确终态。
- 当前 deterministic adapter 测试为 **12 tests OK**；真实 LangGraph backend 回归测试与依赖安装环境的完整 Bridge 回归仍需在本工作树继续执行。未修改 `bridge/contracts/**/*.json`、OpenAPI、generated client、schema revision 或前端 allowlist；Run Intake v2、create-run、Provider/真实 GPU 和生产编排仍不可用。整体能力继续限定为 `local_dev + synthetic_trace + exploratory + not_for_production`。

## 2026-10-25 LangGraph 单编排器适配审查（工作树，未提交、未部署）

- 新增 `bridge/services/agent_orchestrator.py`：以 `AgentOrchestratorState` 建模 session/flow、intent、route、run/context/backend/schema/input/artifact identity、validation/evidence、approval、pending action、report、terminal reason 和有序事件；节点顺序为 `receive_input -> normalize_intent -> clarify_if_needed -> capability_gate -> load_current_context -> deterministic_validate -> prepare_evidence -> await_user_confirmation -> execute_report_action -> mark_report_ready -> terminal`。只允许 explain、existing-run analysis、user report、configuration draft 和明确 blocked 的 execution request；不创建 run、不写配置、不计算指标、不替代 artifact/citation validator。
- `resume()` 在确认、取消、拒绝前重新比较 run、context revision、backend identity、schema revision、input snapshot digest 和 artifact bindings；变化进入 `stale`，模型不可用可进入确定性 fallback，unsupported execution 进入 `refused`。报告动作只产生 `report_status=ready`，实际下载仍由现有 `report_action` 与结果页公共导出入口负责（`src/App.vue:1153-1214`）。
- 当前 Python 3.12.10 环境没有 `langgraph`，仓库没有 Python 依赖 manifest/lock；因此 `build_langgraph_graph()` 只在显式提供 LangGraph 时编译同一节点布局，缺依赖明确抛 `langgraph_dependency_unavailable`，不在前端伪造 LangGraph，也未改变 Bridge 部署契约。当前 adapter/test 是架构适配与审查阶段，不是已激活的生产编排能力。
- 新增 `bridge/test_agent_orchestrator.py` **12 tests OK**，覆盖 clarify、capability blocked、validation/artifact rejection、unsupported schema、approval resume、cancel/refuse、stale binding、provider unavailable fallback、draft-only、unsupported execution、no-side-effect 和 dependency fail-closed。未修改 `bridge/contracts/**/*.json`、OpenAPI、generated client、schema revision 或 frontend allowlist。
- 结果报告定向 Playwright 在临时 4173 fixture 的 canonical 单 worker 重跑中，`assistant proposes` 与 `unknown schema` **2 passed**；完整报告下载用例在 120 秒上限内等待导出按钮超时，未把它算作通过。此前同一代码状态已有 3 条报告相关定向通过记录；本轮 LangGraph adapter 没有触碰前端 report_action。

## 2026-10-25 最终助手与结果报告质量复核（工作树，未提交、未部署）

- 暗色报告覆盖面板的真实样式已通过 Edge fixture 的运行时对比度断言：`--muted: #a0a4aa` 在当前深色画布 `#191a1c` 上约为 **6.95:1**；覆盖字段计数、分组/列表辅助文字和状态 badge 均未降低到 4.5:1 以下。状态仍按 positive / warning / danger / neutral 分色，未放宽断言、隐藏文字或更新视觉快照。
- 受影响 Vitest 定向套件为 **10 files / 185 passed**；全量 `pnpm test -- --reporter=dot` 为 **119 files / 1172 passed / 8 skipped**。`pnpm typecheck`、`pnpm lint`、`pnpm build`（仅既有 chunk warning）、`pnpm contracts:check`（schema-set `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`）、`pnpm docs:check`（54 active Markdown）、`pnpm deps:check`（331 source files）、`git diff --check` 均通过；Bridge `py_compile` 与 `python -m unittest test_server.py` 为 **187 tests OK**。
- 仓库级 `pnpm format:check` 仍报告 **14 个文件**（既有 Bridge/Tauri 生成 JSON、`docs/architecture/EXECUTION_REPLAY_DESIGN.md` 及本交接文档）；未运行覆盖式格式化。所有本轮涉及的 `src/` 与 `tests/` TypeScript/Vue/JS/CSS/JSON 文件单独 `prettier --check` 通过。
- 单 worker dashboard desktop E2E 实际为 **42 passed / 12 failed**（含 warmup，54 条已执行；无 skipped）。12 条失败逐条登记如下，均未作为通过处理：

  | 测试                       | 失败表现                                                                                | 根因分类                                                  | 当前处理                                                                |
  | -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
  | Phase 1 Agent 八字段草案   | 期望 `200 → 100`，页面显示当前结构化带宽值 `100`                                        | 结构化输入 dirty 改动与旧 fixture 预期不一致              | 保留 fail-closed 提交流程；不改快照/不伪造旧 diff                       |
  | Agent unknown field        | 期望旧“目录不可验证”文案，当前完整性 guard 先提示设备/请求/拓扑尚未发布                 | 结构化输入完整性语义改变，旧断言未到达 unknown-field 分支 | 保留无写入、无 create-run；单元与 full-surface Agent E2E 已覆盖拒绝边界 |
  | P99 表格                   | `.percentile-subjects` 中旧 `req-0` 按钮不存在                                          | 旧选择器/请求标签语义                                     | 不放宽选择器；保留证据链接与键盘回归                                    |
  | workflow Trace integrity   | `.trace-integrity-scope` 已不存在                                                       | 当前 InlineHelp passive 文案替代旧 DOM 选择器             | passive InlineHelp 已有组件回归与 a11y 验证                             |
  | runtime evidence lazy read | 首屏已产生 1 次 runtime-events 读取                                                     | 当前 ExecutionReplay query 为 eager 生命周期              | 保留 run-bound、分页和 stale 保护；未把 eager 误报为 lazy               |
  | synthetic evidence         | 单独 dashboard 复跑在后续 snapshot 出现高度/内容差异；完整轮次在 fabric 节点 click 超时 | 视觉快照差异 + fixture/worker 就绪性波动                  | 未覆盖旧快照、未延长无依据等待；SVG/空态/a11y 仍单测与浏览器检查        |
  | language switch            | 旧 `Review and run` heading 不存在                                                      | 当前页面文案/选择器已改变                                 | 不回退产品文案；保留语言切换与结果页定向验证                            |
  | F8 experiment builder      | 旧断言要求 `overrides`，实际使用 `custom_inputs`                                        | 结构化输入 canonical channel                              | 请求通道由契约约束，未扩大 allowlist                                    |
  | quick-control channel      | 空 JSON 文档时旧断言要求 `custom_inputs`                                                | controls-only 的显式标量通道语义                          | 保留 runtime-only/topology-only 防静默丢弃回归                          |
  | quick-control topology     | 旧断言期望 4 个节点，当前 fixture 页面未得到节点                                        | 结构化输入/模板 hydration fixture 就绪性                  | 独立拓扑 E2E 通过；未延长无依据等待                                     |
  | dark appearance            | 暗色截图高度/内容与旧基线不同                                                           | 视觉快照差异                                              | 暗色 AA 对比度循环已通过；未更新快照                                    |
  | boundary metrics           | `0/0 请求完成` 位于隐藏 tooltip                                                         | 文案改为 passive InlineHelp，旧断言要求直接可见           | 保留 unavailable/expected absence 语义；不隐藏数据规避断言              |

  暗色报告覆盖面板的对比度循环通过，失败发生在后续 snapshot，不是 AA 对比度缺陷；未放宽断言或选择器。
- 完整 Playwright E2E 最后以单 worker、临时 4173 fixture 运行：**48 passed / 12 failed / 6 skipped / 1 did not run**（67 条）。未到达的是依赖链上的 `large-artifact-worker`；随后使用 `--no-deps` 单独复跑，`artifact-worker.spec.js` **1 passed**。6 条 skipped 为 `live-week8.spec.js` 的部署/Provider 依赖，未伪造为通过；12 条失败与上表相同。完整运行期间没有停止或替换 5173。
- Playwright CLI 视觉检查使用临时 `127.0.0.1:4173` 页面，覆盖 1440×1100 / 1024×768 及 light/dark overview 截图；该临时 fixture 已关闭。用户的 `127.0.0.1:5173` 仍由原进程监听，未停止、重启或替换。
- 本轮未修改 `bridge/contracts/**/*.json`、generated client、schema revision 或 allowlist；未接 Run Intake v2 create-run。当前仍为 `local_dev + synthetic_trace + exploratory + not_for_production`，Run Intake v2 DoR、Profile records、Bridge lowering execution evidence 与 Agent Harness generated revision drift 继续 blocked/pending。未触碰 `D:\\tileSim`、Provider、credential、用户 run、部署、commit 或 push。

## 2026-10-25 用户运行结果解读报告收口（工作树，未提交、未部署）

- 结果页报告上下文现在通过 `useEvidenceAgentStore()` 读取已通过 `validateEvidenceAgentResult()` 的结果与 `resultBinding`；只有 `available_draft`/`partial`/`truncated` 且无 `invalidClaimIds`、当前 run/backend/schema/input digest 完全绑定、并带完整 artifact citation 的 `conditional_recommendation` 才会进入后续建议。stale/refused/failed/timeout/cancelled、无 citation 或不一致 claim 不进入报告，见 `src/views/ExecutionView.vue:40-185`、`src/features/user-run-interpretation/model.ts:145-235`。
- 报告模型增加 manifest evidence status、rejected artifact、unsupported schema、run mismatch、schema revision mismatch、artifact identity missing 和 unavailable 语义；普通证据不足仍生成确定性摘要，但 unsupported schema、run identity mismatch 和 schema revision mismatch 在公共 `createUserRunInterpretationExport()` 入口 fail-closed，见 `src/features/user-run-interpretation/model.ts:75-145`、`src/features/user-run-interpretation/download.ts:20-74`。
- HTML 报告主文不再默认展示 backend/schema/input digest、JSON Pointer 或 artifact SHA；这些内容移入“查看证据依据”折叠区。bar、stacked-bar、scatter、timeline 投影现在输出真实 SVG，缺失值保持缺失状态，见 `src/features/user-run-interpretation/render-html.ts:1-210`。
- 右侧助手新增本地 `report_action` typed confirmation block；助手只能提出“生成结果解读报告”，用户确认后才调用公共报告导出 API，非结果页不生成 run 报告。未新增 Bridge endpoint、正式 contract、generated client、schema revision 或 create-run 能力，见 `src/entities/agent-orchestration/phase1-contracts.ts:331-349`、`src/App.vue:1110-1215,1488-1510`。
- 实测门禁：`pnpm test` **116 files / 1147 passed / 8 skipped**；`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm contracts:check`（Bridge revision `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`）、`pnpm docs:check`（52 active Markdown）、`pnpm deps:check`（319 source files）、`git diff --check` 均通过；Bridge `py_compile` + `python -m unittest test_server.py` **187 tests OK**。受影响 Playwright Edge fixture（4173）合并运行 `--grep "run interpretation report|assistant proposes"` **3 passed**（含 warmup），未触碰 5173。
- 当前功能仍限于 `local_dev + synthetic_trace + exploratory + not_for_production`；Run Intake v2 DoR、五类 Profile records、Bridge lowering execution evidence 和 generated Agent Harness revision drift 均保持 blocked/pending。

## 2026-10-25 拓扑节点与自动排布收口（当前工作树，未提交、未部署）

- 拓扑编辑器补齐 GPU、CPU 主机、网卡、交换机、路由器、网络桥和存储等节点预设；契约仍保留开放的 `device_type` 字符串，不新增后端字段。GPU 卡数输入仅调整 GPU，新增网络节点不会进入请求 participants。
- 一键排布改为确定性的依赖零的分层布局：借鉴 Sugiyama/hierarchical graph drawing，将交换机/路由器置于上层、网卡/桥置于中层、计算/存储终端置于下层；无连接时保留按域网格兜底。并行边增加几何偏移，连线标签采用短文本，完整端点/link_id 放在 SVG hover title 中。
- 节点使用计算/主机/网络/存储/未知类别视觉语义，设备类型字段改为预设选择并保留未知类型回显；新增 `topology-layout.ts`、`topology-node-types.ts` 及布局和节点参与者回归测试。
- 定向与全量门禁：`pnpm typecheck`、改动文件 eslint/prettier、`git diff --check`、`pnpm build`、Vitest **116 files / 1140 passed / 8 skipped**、Topology Playwright **3 passed** 均通过；浏览器实测 1440×1100、1024×768 无横向溢出。4173 fixture 已停止，5173 未触碰。

## 2026-10-25 用户运行结果解读报告（工作树，未提交、未部署）

- 结果页新增独立的“导出结果解读报告”入口，保留“导出完整技术报告”；实现位于 `src/features/user-run-interpretation/` 与 `src/views/ExecutionView.vue:52,187-211,240-249`。报告由前端确定性整理，不重新执行模拟、不写入 run、不嵌入完整 artifact 正文。
- 报告绑定 `run_id`、backend identity、`schema_set_revision` 及 manifest artifact 的 `artifact_id/schema_identity/sha256/bytes/contract_status`；普通结果 API 没有 canonical `input_snapshot_digest` 时明确显示 `不可用`，不由前端自行哈希。生成前会比较绑定，run、后端、schema 或 artifact identity 变化则拒绝下载，回归覆盖见 `tests/unit/user-run-interpretation.test.ts`。
- key results、findings、attention items 与 charts 均限制数量并只读取已有报告/可视化；`0`、missing、expected absence 和未报告保持区分。下一步只允许后端 `run.next_action` 或已通过 Evidence Agent validator、带完整 citation 且 `recommendation_semantics=conditional_not_executed` 的条件建议，否则显示“暂无有依据的后续建议”。
- 当前 Bridge schema-set 仍为 `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`；generated Agent Harness revision drift 与 Run Intake v2 DoR blocked 不变。本功能仍属于 `local_dev + synthetic_trace + exploratory + not_for_production`，未新增 contract/generated/revision allowlist 或 create-run 能力。

## 2026-10-25 结构化输入 UI 收口与视觉验收（工作树，未提交、未部署）

- 结构化输入编辑器现在严格依赖 surface 的 `json` input mode 与非 `contract_error` 状态；controls-only 保留标量 controls，请求/拓扑 custom_inputs 模块使用真实 `disabled`/`aria-disabled`，对应回归覆盖见 `src/features/run-experiment/ExperimentInputPanel.vue:89-110,451-452` 与 `tests/components/structured-input-panel.test.ts:267-292`。
- controls 页的 runtime/topology JSON 只在两份文档都有内容时进入 `custom_inputs`；runtime-only、topology-only、非法 JSON 和 stale structured draft 均 fail-closed，两份为空仍走标量通道，见 `src/features/run-experiment/request.ts:217-243` 与 `tests/unit/structured-input-channel.test.ts:101-160`。TP/participants 校验保留空 participants 由后端按 TP 推导的语义，见 `src/features/run-experiment/structured-input.ts:120-137` 与 `tests/unit/structured-input.test.ts:252-282`。
- v2 session draft 使用 schema revision 绑定并移除已失效的 `structuredInput` 持久化字段；revision 变化标记 stale、禁止自动提交，模板 hydration 通过 token/controller、scenario、revision、mode、input mutation 与 mounted fencing 防止旧响应覆盖用户输入，见 `src/features/run-experiment/input-draft-session.ts:2-38`、`src/views/ExperimentView.vue:62-92,303-353`、`src/features/run-experiment/template-hydration.ts:25-37`。
- 独立 Edge fixture `127.0.0.1:4174` 已检查 1440×1100、1024×768、light/dark、runtime empty、template request/loading path（含完成后的 hydration）、完整 runtime/topology、validation error、runtime policy、request table、topology graph、设备/域/module 设置、键盘焦点、selected/disabled/error/loading 状态；截图保存在 `output/playwright/`。未停止、重启、替换或写入 5173；fixture 页面因现有 API base 自动尝试读取 5173，均被跨源失败并回退到 4174 fixture。
- 本轮继续收敛实验配置页的信息密度：移除模块卡副标题、当前模块重复标题、拓扑工具栏可见重复标题、请求参与设备“点击选择”、隐藏契约字段清单、Trace 内部字段名旁注和模块 override 原始 key；范围、模型目录和完整性边界改为字段旁问号或保留为真实错误/状态。定向组件回归 **61 passed**，全量 Vitest **116 files / 1140 passed / 8 skipped**，`vue-tsc --noEmit`、改动文件 eslint/prettier、`git diff --check` 与 `vite build` 均通过。
- 当前 Bridge schema-set 仍为 `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`；generated Agent Harness revision drift 与 Run Intake v2 DoR 阻塞保持不变，不新增生产执行能力。

## 2026-10-24 当前发布/契约基线收口审查（工作树，未提交、未部署）

- deployment portability 修复位于 `scripts/package-windows-release.ps1:30`：错误提示中的 WSL/native 示例均改为相对的 `./artifacts` 占位路径，不再嵌入本机用户名或 `D:\tileSim` 盘符；参数行为未改变。定向门禁 `tests/unit/deployment-portability.test.js`、`tests/unit/phase0d-evidence-reproducibility-oracle.test.mjs`、`tests/unit/release-traceability.test.js` 合计 **16 passed / 0 failed**。
- Phase 0D committed archive extraction 位于 `tests/oracles/phase0d-evidence-reproducibility.mjs:293-322`：使用 Python `tarfile` 的 UTF-8 流式提取，保留中文文件名（包括 `发布Windows测试包.cmd`），拒绝符号链接/硬链接和 resolved path escape；临时目录仍由 `verifyCommittedWebRelease()` 的 `finally` 清理（`tests/oracles/phase0d-evidence-reproducibility.mjs:438-489`）。
- 当前 Bridge runtime schema-set 为 `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`，而 generated Agent Harness 常量仍绑定 `sha256:29c1b985...` / `sha256:75db95b2...`（`src/contracts/generated/agent-harness.ts:3-8`；生成器常量见 `scripts/generate-agent-harness-client.mjs:9-20`）。本轮没有正式 contract/generated 发布授权，因此不修改 `bridge/contracts/**/*.json`、生成器或 generated 文件；该 drift 保持诊断状态，运行时继续由 `src/lib/api/agent-harness.ts:48-60,200-216` fail closed。
- Run Intake v2 DoR 仍未满足：五类 Profile records 为 `0/unavailable`，calculator/validation/retained-run recovery 和 lowering execution evidence 尚未闭合；Bridge 仍是只读 preview、未接 create-run。状态继续保持 `GAP-RUN-INTAKE-001=implementing` / Phase 2 blocked，不新增 `agent_exposed` 字段或 receipt UI。依据 `docs/F9_AGENT_ORCHESTRATION/14_CONTRACT_GAP_REGISTER.md:41,88-90` 与 `docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md:9.8-9.9`。

## 2026-10-24 启动器部署源码摘要误报修复（当前工作树，未部署）

用户提供的部署日志显示后端 **102/102 CTest**、Bridge 测试、前端 Vitest（**1097 passed / 8 skipped**）和生产构建均已完成，
但收尾阶段报 `TileSim Web source changed during build or validation`。根因是 `scripts/release-traceability.mjs` 的 Web 源码摘要把
`.gitignore` 中的启动器 Rust 构建目录 `tools/workbench-launcher/src-tauri/target` 计入了摘要；启动器/构建过程更新该目录时，
部署流程会误判源码被修改并安全中止。现已将 `target` 及其他开发/运行产物目录加入默认排除集合，并扩展摘要回归测试；未放宽真正源文件变化的保护，
也未跳过 CTest 或替换部署。定向摘要测试 **3 passed**，需在用户明确部署授权后重新运行启动器部署。

## 2026-10-24 Windows 发行与安装器实施进展（当前工作树，未部署）

按用户要求完成了 Windows 测试发行方案的代码对齐调研，并开始落地可重复的 ZIP payload 链路，当前实施依据为
[`docs/deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md)。方案决定同一版本同时生成签名安装器
`TileSimWebSetup-<version>-x64.exe` 和同源离线 `TileSimWebRuntime-<version>-x64.zip`，而不是发送根目录 Tauri EXE、
`dist/` 或开发机 `runtime/backend-current.json`。

本轮按源码确认：`tools/workbench-launcher` 目前仍以后端 checkout/WSL deployment 为前提；`bridge/server.py` 依赖
Python、后端资源、CLI、manifest 和环境变量；`scripts/start-backend.ps1` 通过 WSL 启动 `python3`，本机可见的
`D:\tileSim\build-tr1-wsl\TileSimCLI` 是 ELF；模型设置已有启动器 UI、Base URL 校验和 Windows 当前用户 DPAPI，
但配置仍写入 checkout 的 `runtime/evidence-agent.local.json`，不能直接进入发行包。当前方案首版采用预构建 WSL runtime，
待 Windows 原生 `TileSimCLI.exe` 通过独立 clean-machine gate 后再切换 native runtime。

本轮已新增但尚未部署/签收的工具：`scripts/doctor.ps1`（Windows/x64/WebView2/WSL/端口/磁盘预检）、
`scripts/package-windows-release.ps1`（同源 payload、release manifest、SHA-256 清单和离线 ZIP）、
`scripts/install-windows-runtime.ps1`（ZIP/解压 payload 完整性校验、staging/current/previous 指针和回滚骨架）、
`scripts/smoke-windows-release.ps1`（health/manifest identity smoke），
并让 `bridge/server.py` 与 `bridge/infra/identity.py` 支持从 packaged release manifest 提供无 Git identity。
这些工具已做 PowerShell 5.1 语法检查、payload 组装/解压/哈希校验和 Bridge 单元回归；当前 manifest 仍明确标记
`runtime_zip_only_installer_pending`，安装器尚未嵌入签名 launcher，也尚未实现 WSL import、Bridge health/smoke、
签名/SBOM、干净 Windows 安装验收或 DPAPI 配置迁移。因此仍不能宣称“下载后点击即用”，完整已部署路径仍是
Windows + WSL 源码 bootstrap。

本轮新增一键发布入口 `发布Windows测试包.cmd` 与 `scripts/publish-windows-release.ps1`，并在 `package.json` 增加
`publish:windows`。入口自动读取版本、发现旁边的 `D:\tileSim`/`docs\examples`，执行 doctor，再调用统一 ZIP 组装器；
`windows-native` 模式新增 `BackendCliPath` 透传，并可自动发现 `build-ca1\Release\TileSimCLI.exe` 等常见路径。
本地已用现有 native CLI 完成一键编排、ZIP 组装和临时安装校验；该验证跳过了发布门禁/Web 重建，不代表 native CLI
已完成 clean-machine acceptance。默认 WSL 模式仍会交互询问经过测试的 rootfs tar 与 runtime metadata。配置入口保留在
`%LocalAppData%\TileSim\config\evidence-agent.local.json`，只存 DPAPI 密文；API Key 不进发行包。

## 2026-10-24 轻量工作台完整移除（当前工作树，未部署）

轻量工作台已从运行时与前端产品表面完整移除：根路径直接进入专业工作台，原轻量路由不再装配，轻量页面、feature、Pinia store、模式切换、专属帮助主题、i18n 文案、单元测试与桌面 E2E 均已删除。专业工作台的实验配置、结果分析、共享助手和帮助基础设施保留。旧轻量设计与验收材料已从活跃文档目录删除；`docs/archive/` 中的 dated 记录仅作为历史证据保留，不代表当前可用功能。

## 2026-10-24 文档与代码基线复核（当前工作树，未部署）

本轮按 `AGENTS.md`、当前代码和运行时 contract 复核活跃文档。当前 Web `HEAD` 为 `2e7386457a9d3974af4e9d5bb42b5fa470f0ae56`
（分支 `codex/experiment-layout-polish`，工作树含既有未提交改动），`python bridge/check_schema_set_revision.py` 实测为
`sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`。Bridge 代码实际注册
`/api/agent/optimization/*` 与 `/api/agent/batches/*`，分别使用 `2026-10-19.wpd.v1`/`tools.v2` 和
`2026-10-19.wpe.v1`/`tools.v3`；阶段 5 local-dev 收尾仍为 `LOCAL_PHASE5_PASS`，不是生产 GO。

本轮已将结束的 Agent Harness 阶段 2/3A/3B/WP-D 记录、Phase 2C 派发计划和轻量工作台旧实施/remediation/L0 审计移入
`docs/archive/`；活跃入口只保留当前基线、稳定规范和未结束的产品/架构设计。历史记录原文未改写，当前数字和结论以本文件、
模块 current baseline、正式 contract 与实际代码为准。

> 本节之后的带日期条目是交接历史与证据索引；即使标题保留“当前工作树”，也不得覆盖本节和文件顶部最新事实。

## 2026-10-23 启动器部署失败诊断收口（当前工作树，未部署）

启动器部署仍严格要求后端 CTest 通过；本轮用户提供的后端日志为 **102 项中 16 项失败，`wsl.exe` exit 8**，主要失败信号是仿真路径不可用（`route_unavailable`），并伴随延迟/transfer 统计为 0。启动器现在会把这类失败归类为“后端仿真验证未通过”，直接提示检查 `topology.links`、`domain` 与请求 `participants` 的匹配关系，并明确失败不会替换上一份已验证部署；普通 CTest 失败则提示查看失败测试并修复后端。

启动器同时记录整段操作日志是否出现过 `route_unavailable`，即使该行早于 400 行日志尾部、后来被截断，最终错误仍保持上述分类。启动器 Rust 单测 **16 passed**，工作台 Vitest **12 passed**，启动器 `vue-tsc --noEmit`、`cargo fmt --check` 与改动文件 `git diff --check` 均通过。

这次修改没有跳过 CTest、没有把失败写成部署成功，也没有修改只读的 `D:\tileSim` 后端仓库。要真正完成部署，仍需修复后端仿真测试所使用的拓扑/路由配置，或恢复上一份已验证后端版本后再由启动器重试。

## 2026-10-22 Agent Harness 阶段 5 Local-Dev 收尾事实（工作树，未部署）

阶段 5 的 local-dev 批处理遗留问题已完成收口，结论为 `LOCAL_PHASE5_PASS`（仅本地开发闭合，非生产 GO）。
本轮修复并回归验证了候选数不得超过 `budget.max_candidates`、`max_failures` 为无条件硬上限、失败计数跨 worker
重启保留、批次时间预算跨恢复保持、worker lease 释放与暂停期间 heartbeat；批次达到失败上限时即使策略为
`continue` 也会停止，`stop` 则首个失败即停止。

重试现在只接受明确 `retryable=true` 且没有 `unknown_outcome` 的失败，受 `max_retries` 限制；重试会清理旧执行
身份、生成新的 Stage-2 draft/validation/approval/idempotency fence，并在重新执行前回到人工批准。未知副作用的
recovery acknowledgement 不会盲目重提，而是将未决候选和批次转为 `manual_intervention_required`。前端 Batch
Task Center 已显示该恢复边界；进入人工介入后不再提供批次取消或盲重试入口。SSE 使用共享 lossless framing、API path 和 scope，并拒绝跨 batch、乱序或过期
detail/event 数据。

定向证据：Bridge Stage 5/相关 Stage 3 tests 为 **21 passed / 0 failed**；前端 Harness 定向套件为 **35 passed / 0 failed**；
`vue-tsc --noEmit` 通过。未修改 contract/schema-set，因此不需要重新生成客户端。所有结果仍固定为
`local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`。Provider live acceptance、真实硬件、独立生产
evidence/citation entailment review、原始研究计划要求的独立 validation run 与生产 GO 仍为
`production_acceptance_pending`，不随本地闭合升级。

## 2026-10-19 Agent Harness 阶段 5 Local-Dev 当前事实（工作树，未部署）

阶段 5 已新增受控批量实验 successor contract `2026-10-19.wpe.v1`、tool registry
`2026-10-19.tools.v3`，当前 schema-set 为 `sha256:781b96e8389624f2d33abe800062367d28f2bb702abbec4f824d02413eaccd82`；独立 SQLite WAL batch store、批量审批/队列/状态/lease/heartbeat/checkpoint、SSE
事件回放和 TanStack Query 前端 Batch Task Center。批量对象均绑定 principal、workspace、snapshot、backend、
schema-set、policy 与 digest；实际运行仍只经正式 `POST /api/agent/executions`，没有新增 `/api/runs`、shell、
任意 URL/文件、外部 MCP/A2A 或生产无人值守入口。

本地批量状态支持 `waiting_approval`、`queued`、`running`、`paused`、`completed`、`failed`、`cancelled`、
`recovery_required` 和 `manual_intervention_required`。批量默认单并发，所有结果标记
`local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`。Bridge/worker 重启会围栏 queued/running
批次到 `recovery_required`，未知副作用不盲目重试；幂等 replay/conflict、取消终态、事件 sequence、
Last-Event-ID 和 polling fallback 均保持 fail-closed。生产 Provider acceptance、真实硬件、独立生产
evidence/citation review 和生产 GO 仍为 `production_acceptance_pending`。

本轮继续收口批量语义：completed candidate 只在通过正式 execution result 的 snapshot/schema/backend identity、
local synthetic provenance 和 `query_verified_metrics` allowlist JSON Pointer 后写入最小 objective/evidence 结果。
Batch summary 现在计算 `best_candidate_id`/`best_value`、评估计数和无改进计数，并输出
`candidate_set_exhausted`、`run_budget_exhausted`、`time_budget_exhausted`、`failure_budget` 或 `no_improvement`
停止原因。暂停恢复会恢复 running 状态并维持 lease heartbeat；事件缺口由前端拒绝并回退 polling；删除会清理
批量有界 SQLite 子记录。新增定向测试覆盖 objective/best candidate、no-improvement、recovery 和 retention。

本次复验还修正了助手侧栏的布局边界：侧栏改为纵向 flex，Harness 观察区独立滚动并受限于首屏高度；只有 Bridge
成功发布并通过 Harness capability snapshot 后才挂载批量/优化观察区，旧 Bridge 或 fixture 不会因未知端点生成
占位内容覆盖原对话区。相关前端组件/定向 Harness 测试、Bridge 阶段 3A/4/5 定向测试均通过；浏览器验证使用
临时 Playwright Vite，不触碰 127.0.0.1:5173。

## 2026-10-19 Agent Harness 阶段 4 Local-Dev 当前事实（工作树，未部署）

阶段 4 已接入受控的本地优化协调器，但范围严格限定为个人 local-dev。新的优化 contract 为
`2026-10-19.wpd.v1`，schema-set 当前为 `sha256:9ff2bdbb74e0932e3fb8fdefe64575d6b2d3c2d0313c1c930cc13aeb19942bf2`，
tool registry 为 `2026-10-19.tools.v2`。Bridge 使用独立 SQLite WAL 优化存储，session、candidate、approval、iteration、evaluation、
checkpoint、tool invocation、event 和 summary 只保存有界身份、digest、状态与 JSON Pointer；不保存 credential、raw Provider response、
hidden reasoning 或完整敏感 evidence payload。

当前闭环为：session → waiting_approval → queued/running → formal Stage-3 execution → identity/SHA/bytes/Pointer/provenance 校验的
verified metric → bounded next candidate 或 stop summary。候选配置只能来自已登记执行请求，并经正式 Stage-2 参数 validator；父候选、diff、
目标、约束、预期副作用和 evidence digest 均可追溯。每个候选要求人工批准，approval 单次消费且有 expiry/stale fence；失败只能显式 retry，
unknown outcome 进入 `recovery_required`；只有显式 acknowledgement 才能生成新的候选和 approval fence，禁止原地盲重试。取消有 terminal fence，Bridge 重启会把未完成 session 标记为 recovery_required。重复候选、重复
idempotency key、预算/迭代/运行/时间/失败上限和无改进均有停止语义。没有 shell、任意路径、任意 URL、外部 MCP/A2A 或直接 `/api/runs` 工具。

前端通过生成的 client、TanStack Query 和 Optimization Panel 展示 session/candidate/diff/objective/evaluation/tool digest、operation identity、
timeline、审批、暂停/恢复/取消/显式重试、刷新恢复和显式 local-dev session 创建；不使用 localStorage/Pinia 伪造优化服务端状态。所有结果继续标记
`local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`。生产 Provider acceptance、真实硬件、独立 evidence/citation review 与
held-out validation 仍为 `production_acceptance_pending`，阶段 4 不产生生产 GO。

本轮校正了 Optimization Panel 的默认 objective pointer：由不存在的
`/request_metrics/p95_ms` 改为正式 metrics schema 中的
`/tail_latency_summary/ttft_ps/p95_ps`，并同步更新 Bridge HTTP 与前端组件测试。临时端口浏览器实测完成
session → 人工批准 → 正式 execution → verified evaluation/checkpoint → completed，刷新后状态仍由 Bridge
恢复；旧 pointer 的 `artifact_pointer_not_found` 记录保留为 fail-closed 证据。阶段 4 local gate 为
`LOCAL_PHASE4_PASS`（local-dev only），生产 Provider acceptance、独立 review 和生产 GO 仍 pending。

阶段 4 收口复验：全量 Web Vitest 为 **115 files / 1172 passed / 8 skipped**；阶段 4 Bridge 优化 HTTP/contract
定向套件为 **11/11**；`pnpm contracts:generate` + `contracts:check`、`typecheck`、`lint`（0 error / 2 既有 warning）、
`build`、`docs:check`、`deps:check` 和 `git diff --check` 通过。Bridge 全量 discovery 为 **413 tests / 412 passed / 1
既有导入错误**（`contracts.agent_orchestration_phase2.tests.test_registry` 无法导入 `bridge`）；全仓 `format:check` 仍被
20 个既有/生成文件阻塞，本阶段新增/修改文件单独 Prettier 检查通过。临时 `127.0.0.1:4173`/Bridge 已停止，用户的
`127.0.0.1:5173` 未触碰。

## 2026-10-19 Agent Harness 阶段 3 local-dev / 3B 当前事实（工作树，未部署）

阶段 3 已在本地个人使用范围完成受控开发闭环；这不是生产发布批准，也不改变正式
`2026-10-18.wpc.v1` 的 fail-closed 规则。使用当前 TileSim checkout、Bridge schema-set、生成客户端和
Windows MSVC CLI 自动生成了新的 `local_dev` deployment manifest（不覆盖旧的
`runtime/backend-current.json`）：

- manifest：`C:\Users\MAPANW~1\AppData\Local\Temp\tilesim-stage3-local-msvc-5aab35d118194c53b9b6ed91d118a02e\local-dev-deployment-manifest.json`
- manifest digest：`sha256:d1f58f17f94d5b4ee7c922a15d7bc06350491300edb04577086b5c25e9d60236`
- schema-set：`sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50`
- source/build revision：`5e44db0abb1d1b73d6131b9212277e4ea97d2c8`
- source/build state digest：`4ee7fdaca4252d2fae5a9418c23e6a453a907964b7dd4a368c964651a4ebb7fc`

local-only gate 为 `LOCAL_ONLY_PASS`：deployment identity `matched`，AH3-F01–AH3-F26 为 26/26，
并完成 draft → validation → approval → execution → `/api/runs` → result、artifact identity、幂等 replay/conflict、
SSE/polling event replay（事件 `1..5`）。所有证据均标记 `local_dev`、`synthetic_trace`、`exploratory`、
`not_for_production`；Provider 为 `provider_unavailable_for_local_dev`，生产 acceptance 仍为
`production_acceptance_pending`，本地 review 状态为 `review_not_required_for_local_dev`。

前端 3B 已通过正式 WPC adapter 和 TanStack Query 接入 execution submit/status/events/SSE、`Last-Event-ID`
恢复、polling fallback、result reference、run/artifact identity 校验及显式 cancel/retry/resume。所有写请求带
`Idempotency-Key`，不由浏览器创建 run，也不使用 localStorage/Pinia 作为 operation store。任务中心明确展示
`failed`、`recovery_required`、`manual_intervention_required`、`cancelled`、`completed` 以及 local-dev 边界。

正式 3A release-gate 在同一源码状态下实际为 54/54 pass；其结论仍为 `NO-GO`，原因仅是 Provider live acceptance、
成功 repetition 和独立生产 evidence/citation review 尚未执行。阶段 4 多工具自主循环、自动候选、自动优化、
无人值守批量实验和外部 MCP/A2A 继续关闭。

## 2026-10-18 拓扑画布清除确认与全屏排布入口（当前工作树，未部署）

- 拓扑编辑器新增“清除画布”操作：点击后先展示确认条，只有再次点击“确认清除”才会生效；“取消”不会修改当前输入。
- 确认清除会删除当前仿真拓扑中的 `devices`、`domains` 和 `links`，保留 `module_bindings` 网络模型参数；同时清空前端卡片位置、选中连接、排布状态、缩放和平移状态，并同步设备数量为空。
- 全屏显卡连接工作台的顶部工具栏现在提供“按域一键排布”和“清除画布”，全屏后无需退出即可完成分组排布或发起清除确认。排布只改变画布中的前端位置，不写入拓扑 JSON。
- 本轮验证：`TopologyGraphEditor` 与结构化输入 i18n 定向测试 **38 passed**；`vue-tsc --noEmit`、目标 ESLint/Prettier、`git diff --check` 已通过。未操作 5173、Bridge、用户运行记录、Provider、提交或部署。

## 2026-10-18 Agent Harness 阶段 2 当前事实

Bridge 已发布 `2026-10-18.wpb.v1` successor：`tilesim.agent_harness.experiment_draft.v2`、
`tilesim.agent_harness.draft_validation_report.v1`、`tilesim.agent_harness.approval.v2`。WP-A `2026-10-17.wpa.v1`
兼容读取保留，proposal v0 不接受为运行时身份。

当前 canonical schema-set revision：`sha256:c7a23b668d29415315e1eca4fd8dc0a5ebdff908b8420a6e187f33cc710efb42`。

正式 API 覆盖 draft 创建/读取/校验/删除/events（含 SSE stream）和 approval 创建/读取/reject/revoke。所有写请求要求
`Idempotency-Key`，并校验 principal/workspace、payload digest、input snapshot、schema-set、backend identity、validator/policy
revision。SQLite WAL 只保存身份、digest、状态和有界摘要；删除、retention 到期、validation 替换和 identity 漂移会阻断批准。
`would_create_run` 始终为 `false`，不调用 `/api/runs`、TileSimCLI、run queue 或 artifact materializer；submit/cancel/retry/resume/
autonomous optimization 仍未开放。Provider acceptance 仍为 `live_acceptance_pending`。

## 2026-10-18 Agent Harness WP-B Web 接入

Web 已接入正式 WP-B draft/validation/approval successor contract（draft `v2`、validation report `v1`、approval `v2`），并使用生成的 `src/contracts/generated/agent-harness.ts` client。API adapter 位于 `src/lib/api/agent-harness.ts`，独立校验 successor contract/schema-set、backend/principal/workspace/snapshot/digest binding，并对所有响应强制 `would_create_run: false`。所有写请求使用 `Idempotency-Key`；删除、stale、expiry、reject、revoke 和 replay 结果均 fail closed。

Task Center/Copilot 通过公共 feature adapter 暴露 Draft Card、Validation Block、Approval Block；展示字段差异、证据引用、预算、风险、JSON Pointer、校验/审批状态和服务端 revision。没有新增 `/api/runs`、TileSimCLI、队列、submit/cancel/retry/resume 或自动优化入口，也不使用 localStorage/Pinia 作为服务端草案真相。Provider acceptance 仍为 `live_acceptance_pending`。

**事实日期**：2026-09-17（下文历史记录）／2026-09-19（本机实测基线，见「2026-09-19 仓库与基线更正」）

**产品范围**：电脑网页端、local Bridge、版本化契约和 Windows/WSL 本地部署

**当前状态**：Phase 1 全局 Agent 侧栏与八字段本地草案已发布；Phase 2A/2B 契约已正式发布并提交（`4d7f9fa`）；后端 Phase 2C
Run Intake Lowering 已落地，Bridge 侧 Run Intake v2 **只读预览**端点（WP-2C-01a/01b，工作树未提交）已注册但仍未与 lowering
接线；五类 Profile 真实记录仍为 `0/unavailable`，因此 Phase 2 的执行与数据侧仍被阻塞；未部署 5173

## 2026-10-17 Agent Harness 阶段 0 / WP-A（当前工作树）

- 已冻结 Agent/Bridge/run/S0–S5 基线并登记能力、权限、生命周期和评测切分：见 `docs/F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md`。
- 已新增 proposal-only Web/domain contract model（`src/entities/agent-orchestration/agent-harness-contract.ts`）和只读 fixture adapter；覆盖 `agent_operation`、`agent_turn`、`workflow_event`、`checkpoint`、`tool_call`、`tool_result`、`experiment_draft`、`approval`、`study`、`candidate`，以及 identity/revision、state、event dedupe/sequence、idempotency、approval stale/expiry、retention/delete、错误码和 JSON Pointer。
- 新增的 `AgentHarnessStatusCard` 只显示 fixture 来源和 `not_exposed`/`completed` 等展示状态，明确不代表 Bridge queue、checkpoint、真实 Provider 或 run 创建；没有新增 route、Bridge contract、OpenAPI、generated client 或后端入口。
- 评测 manifest `tests/fixtures/agent-harness/phase0-evaluation-manifest.json` 固定 19 个互斥 case，拆分为 train/validation/test/held-out-adversarial；fixture 结果不计入 live repetitions。
- 当前 schema-set revision（本机 `python bridge/check_schema_set_revision.py`）为 `sha256:d7abac1889dd1b8a05bae7972fec3c7bd448053393daaf52afc3af893cde793e`；Harness proposal 明确不在该 revision 中。阶段 1 当前 **NO-GO**：后端正式 schema、tool registry、durable store、checkpoint/ledger、真实 Provider acceptance 和恢复门禁均未完成。

## 2026-10-17 Agent Harness 前端阶段 1 只读接入（当前工作树，未部署）

- 本节是对上面 WP-A proposal-only 记录的后续事实补充，不改写历史验收数字。Bridge 正式 successor contract 已核对为 revision `2026-10-17.wpa.v1`，四个对象/tool schema 使用 `tilesim.agent_harness.*.v1`；本机 schema-set revision 为 `sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73`。
- Web 新增由 `pnpm contracts:generate` 生成并由 `contracts:check` 校验的 `src/contracts/generated/agent-harness.ts`，只包含正式 v1 DTO、headers/revision binding 和只读 client surface；没有生成 cancel/resume/retry/checkpoint/approval/delete 或其它写工具 client 方法。
- `src/lib/api/agent-harness.ts` 通过正式 `/api/agent/harness-capabilities`、`/api/agent/tools`、operation/events 和 `/api/agent/tools/call` 接入 `get_capability_catalog`、`get_run_status`、`list_run_evidence`、`query_verified_metrics`；校验 API/schema-set/contract/backend identity、run/snapshot、artifact SHA/bytes/schema/JSON Pointer 和五类 tool outcome，未知/跨 run/越权 fail closed。
- 前端 operation projection 以 Bridge snapshot/event 驱动，支持 terminal fence、event id 去重、乱序/冲突进入 `recovery_required`、SSE `Last-Event-ID` 恢复和 polling fallback；正式 v1 状态卡/只读工具时间线不伪造进度或证据覆盖率。`AgentHarnessStatusCard` 仍明确为 proposal-only fixture，不进入 v1 runtime path。
- 阶段 1 仍不开放 `submit_experiment`、cancel/retry/resume UI、checkpoint/approval 写入、自主优化、无人值守实验或 live Provider；Provider 状态仍为 `live_acceptance_pending`。

## 2026-10-17 Agent Harness WP-C 只读 Task Center（当前工作树，未部署）

- `AgentHarnessTaskCenter` 只消费正式 v1 operation list 与已有 snapshot/event projection；按当前 run 过滤 operation，跨 run 记录不会进入任务中心。
- 任务卡显示 workflow state、node、attempt count、错误原因和只读工具时间线；artifact 展示仅接受已校验的 id、schema、SHA-256、bytes 与 JSON Pointer。
- operation 列表读取失败明确显示 `unavailable`；取消、恢复、重试和审批写入显示 `not_exposed`，不提供按钮，不创建 run，不把本地状态当作服务端任务真相。
- 本批没有新增 Bridge contract/OpenAPI/schema，也没有开放任何写工具或自主运行入口。

## 2026-10-18 Agent Harness WP-C 事件快照与 WP-D 评估（当前工作树，未部署）

- Task Center 现在先按当前 run 过滤 operation list，再读取正式 operation detail/events；跨 run operation 不会触发 detail 读取或进入展示。
- 单个 operation detail 读取失败显示 `unavailable`，不会以列表快照补造阶段；正式事件 sequence 缺口会进入 `recovery_required`，而不是静默跳过。
- operation card 展示已校验的 workflow event sequence、node、state、created_at 和终态标记；没有新增写按钮、自动 resume 或 run 创建。
- WP-D durable runtime bake-off 已归档在 [`docs/archive/agent-orchestration/phase-records/27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md`](archive/agent-orchestration/phase-records/27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md)：其仍有效的决策是保留 Bridge 自有 SQLite WAL + bounded worker，不引入第二个 workflow runtime。阶段 2/3/4/5 的 local-dev successor 已分别落地，但生产 Provider/真实硬件/生产 GO 仍为 pending。
- 本轮验证：Harness 定向 Vitest **3 files / 19 passed**；全量 Web Vitest **111 files / 1146 passed / 8 skipped**；`vue-tsc --noEmit`、目标 ESLint（0 error）、目标 Prettier、`docs:check`（69 篇）、`deps:check`（333 source files）、`contracts:check`、生产构建和 `git diff --check` 均通过；Bridge `test_server.py + test_agent_harness.py` **208 tests / OK**，Agent Harness Schema Ajv 检查通过。
- 本批没有修改 Bridge 队列、durable store、ledger、OpenAPI 或 schema；没有操作 `127.0.0.1:5173`。

## 2026-10-18 Agent Harness Task Center 只读刷新（当前工作树，未部署）

- Task Center 对正式 operation snapshot 使用 5 秒只读刷新；`completed`、`failed`、`cancelled`、`recovery_required` 和 `manual_intervention_required` 到达后停止刷新。
- 刷新不会调用 cancel/resume/retry/checkpoint/approval，不会创建 run，也不会把浏览器状态写成服务端 operation 真相；空列表不会伪造任务。
- 新增测试覆盖活动状态刷新和终态/恢复边界；仍未修改 Bridge contract、队列、durable store、ledger 或 5173。

## 2026-10-18 Agent Harness 阶段 2 前置审计（当前工作树，未部署）

- 阶段 2 当前 **NO-GO**：canonical OpenAPI 没有 draft 创建/读取/校验/删除或 draft events endpoint；现有
  `/api/agent/approvals` 与 `/api/agent/approvals/{approval_digest}` 是 backend-only 最小内部入口，不构成正式
  draft/validation/approval 闭环，也没有 reject/revoke 路由。
- `experiment_draft.v1` 目前只包含 `draft_digest`、`creates_run=false`、`diff_digest` 和 `validator_revision`；没有
  `draft_validation_report` identity，也没有阶段 2 要求的 field diffs、assumptions、evidence refs、budget、risk、status、
  expiry、parameter catalog revision 与完整 snapshot/backend/policy binding。
- 当前生成 client 没有 draft/validation/approval 方法。前端因此没有新增审批 UI、按钮或写请求，不使用 localStorage/Pinia
  冒充服务端草案真相，不调用 `/api/agent/approvals`，不开放任何 run 创建、submit/cancel/retry、自主优化或 Provider 能力。
- 同步审计与完整缺口见 `docs/F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md` §12。下一步必须由
  后端先发布闭合 Schema/OpenAPI/生成物、权限与持久化/删除/幂等/stale/expiry/replay 语义，再重新评估阶段 2。

## 2026-10-17 实验配置下拉与预设（当前工作树）

- 固定枚举继续由后端 descriptor/schema 驱动下拉；请求表新增基于当前拓扑设备的 `tp_degree` 下拉和 `participants` 设备选择，并保留无拓扑时的自由输入回退。
- `participants` 选择器改为表格内展开式复选框：不需要 Ctrl，多张 GPU 可直接逐项勾选；菜单不再使用会被请求表裁切的悬浮层，设备较多时在选择器内部滚动。
- 模型标识、集合通信类型、放置组、分离组、KV 交接编号、设备类型/分组、模块版本/配置档增加浏览器原生建议列表；这些字段仍允许输入契约接受的自定义字符串。
- 调度策略、引擎画像、域类型、域保真度/失败策略、网络模型类型、连线所属域继续使用正式枚举下拉；带宽、延迟、KV、批大小等数值项增加常用预设建议，不限制自由数值。
- 所有选择都通过原有 JSON patch 通道写回，不新增后端字段、不猜测未在契约中声明的枚举。新增结构化输入回归覆盖 `30` 项；全量 Web Vitest **1118 passed / 8 skipped**，`vue-tsc`、ESLint、Prettier、生产构建、契约生成检查和 `git diff --check` 通过。

## 2026-10-17 本地运行记录删除与提示收敛

- 运行记录页新增删除入口和二次确认；仅 `completed`、`failed`、`incomplete` 记录可删除，`preparing` / `running` 返回 `409 run_active`。
- Bridge 新增 `DELETE /api/runs/{run_id}`，成功后删除 `STATE_ROOT/runs/<run_id>/` 及其工件；不存在返回 404，非终态返回 409。删除当前打开运行时，前端清空当前结果并保留在运行记录页。
- 运行期证据区域移除重复的模块说明和工件长段落，改为标题/字段旁的 `InlineHelp` 悬浮提示；错误、缺失、拒绝和大工件状态提示保留。
- 定向前端测试 11 项通过；Bridge `test_server.py` 185 项通过；契约生成检查、类型检查、ESLint、Prettier、Python 编译和 `git diff --check` 通过。

## 2026-10-17 拓扑画布缩放与全屏编辑（当前工作树）

- 拓扑显卡连接画布新增 75%–200% 缩放：缩小、放大和点击比例恢复 100%；缩放只改变画布显示尺寸，不修改 topology JSON。
- 浏览器支持 Fullscreen API 时显示“全屏编辑/退出全屏”，全屏后画布独立占满可用区域并保留横向/纵向滚动，适合复杂拓扑的拖拽和连线编辑；退出全屏后恢复原页面布局。
- 修正全屏网格布局的剩余空间分配，避免工具栏与画布之间出现大片空白；全屏和普通视图均保持现有拖拽连线语义与仿真输入边界。
- 验证：`TopologyGraphEditor` **21/21**，`vue-tsc --noEmit`、改动文件 ESLint、Prettier、`git diff --check` 通过；4173 浏览器复核覆盖缩放、100% 恢复、全屏进入/退出和全屏后画布可见性。未停止、重启或替换 5173。

## 2026-10-17 拓扑复杂输入边界与连线标签避让补充（当前工作树）

- 一键排布现在记录设备/domain 结构签名：外部 JSON 增加、删除或改动设备/域成员后，旧的“已排布”状态会自动失效，不会把旧坐标误套到新拓扑；保留的卡片坐标会按当前画布边界裁剪。
- 域内水平连线的标签会移到连线上方，垂直连线与跨域弧线保留可读间距；同一端点的并行 links 会按碰撞组错开标签，并将标签限制在画布可视范围内。
- 这些改动只影响前端画布布局与显示，不写入 topology JSON，不修改 domain、link、Bridge schema 或仿真语义。
- 新增并通过：`TopologyGraphEditor` **20/20**；拓扑 Playwright **3/3**；dashboard 拓扑快捷控制 Playwright **2/2**；`vue-tsc --noEmit`、改动文件 ESLint、Prettier、`git diff --check` 和生产构建均通过。

## 2026-10-17 拓扑一键排布复杂场景优化（当前工作树）

- 一键排布不再把同一视觉组强制排成单列：每个 domain 连通组按紧凑网格放置，组间按可用宽度自动横向排列，放不下时换行；重叠 domain 仍合并为一个组，未入域设备各自作为独立组。
- 增加画布滚动容器和高度上限，设备数量较多时不会把整个实验页无限拉长；卡片位置仍只存在于前端画布，不写入 topology JSON。
- 组内纵向间距为连线标签保留独立区域，避免跨域弧线、域内直线标签压住卡片；未改变连接语义、domain 判断、Bridge schema 或仿真输入。
- 验证：`TopologyGraphEditor` **16/16**、结构化输入组件 **29/29**、快捷控制拓扑流程 **2/2**，`vue-tsc --noEmit`、改动文件 ESLint、Prettier 和 `git diff --check` 通过；生产构建通过。

## 2026-10-16 拓扑显卡直连画布最终收口（当前工作树）

- 新建实验的拓扑首屏现在只保留显卡卡片、显式 `topology.links` 连线和三个摘要数字；设备域节点、关系图、域内/跨域关系清单与源/目标下拉添加表单均不再渲染。
- 连接编辑只保留一条直观路径：从一张显卡拖到另一张显卡即可新增，再拖同一对即可移除；点击已有连线才展开 domain、带宽、延迟和删除操作。卡数、domain 成员和网络模型参数统一放入默认收起的“高级拓扑设置”。
- 当前 canonical `s1_des_example` 模板明确返回 `gpu0`–`gpu3` 四张设备卡，但 `topology.links` 为空；前端只展示后端显式 links，不从请求 `participants` 或 domain 成员猜造连线。因此首次进入时会看到四张卡和“当前还没有显卡连接”，需要拖拽后才写入 link。
- 仿真语义保持不变：连线只代表 JSON 中的仿真输入，不代表真实 GPU 或物理网络；没有新增 Bridge 字段、后端仿真逻辑或关系推断。
- 验证：拓扑/结构化组件 **51/51**、拓扑 JSON Playwright **3/3**、快捷控制拖拽连接 Playwright **2/2**、`vue-tsc --noEmit`、改动文件 ESLint、Prettier 与 `git diff --check` 通过；1440px 视觉检查确认四张卡首屏可见且无横向溢出。

## 2026-10-16 拓扑连线语义与卡片布局补充（当前工作树）

- 连线现在按所属 domain 的显式 `domain_type` 标识：`scale_up` 显示“域内通信”实线，`scale_out` 显示“跨域通信”虚线弧线；连线中点标牌同时显示通信类型与 domain ID，卡片下方显示设备所属 domain，避免把两种通信混在一起。新增连线时同组设备优先选择 scale_up 域、不同组设备优先选择 scale_out 域；拖拽使用指针捕获，移动卡片不会丢失事件；布局仍只保存在前端画布，不写入提交 JSON。
- 卡片恢复可拖动布局：拖到空白处只移动本次画布位置，拖到另一张卡才写入/删除 `topology.links`；布局坐标仍不会写入提交 JSON。
- 验证：`TopologyGraphEditor` **12/12**、结构化输入组件 **29/29**；快捷控制连接/移动与 JSON 预览的定向 Playwright 用例均通过；覆盖域内/跨域标签、跨域弧线、分组自动选域、卡片移动后 JSON 不变、连接新增/删除与只读 JSON 预览。

## 2026-10-16 启动器部署 Bridge 门禁超时修复（当前工作树）

- 启动器日志中的 CTest **100/100 通过**；失败发生在 Bridge `test_server.py` 的 182 项 F9 HTTP 测试，WSL 冷启动/临时 Bridge 重启时测试客户端固定 5 秒超时，客户端先断开后服务端出现 `BrokenPipeError`，不属于仿真回归或前端构建失败。
- `bridge/test_server.py:1222-1227` 将 Bridge API 合约测试客户端超时提高到 30 秒，并保留失败传播；同一套 182 项测试复跑为 **OK（70.210 秒）**，未修改产品 Bridge、契约、仿真逻辑或部署端口。
- `tests/unit/deployment-portability.test.js` 8 项通过；本机未调用 `wsl.exe` 执行真实部署，5173 未停止、重启或替换。

## 2026-10-16 拓扑仿真关系视图收口（前置方案，已被上方最终收口覆盖）

- 针对拓扑页仍把域归属与连接关系混在交叉画布中的可用性问题，前端默认视图改为“域与设备”：首屏先展示设备归属、每个 domain 的成员设备、域内/跨域仿真连接计数和连接清单；关系图降为“关系图（辅助）”标签页，不再遮挡主阅读路径。
- 拓扑文案统一明确仿真语义：实线是 `links` 中的仿真连接，虚线是设备归属 domain 的说明关系；设备、domain 和连接均为仿真输入，不代表真实物理网络。未配置 links 时不再使用“不是真实连接”的歧义提示，而是说明设备归属仍有效、添加 links 后模拟器才使用设备间连接参数。
- `TopologyGraphEditor` 新增域卡片的域内/跨域计数和跨域 domain 路径；关系图、JSON 输入和快捷控制仍共享同一文档与写入校验，未改变 Bridge schema、后端仿真、Provider 或证据边界。
- 在用户反馈“关系图仍不直观”后，默认拓扑视图进一步改为分组式“仿真部署”布局：按设备 `group_id` 展示虚拟节点组、设备卡片、domain 归属、域内连接和跨组连接；连接编辑模式可直接在设备卡片上依次选择两个端点写入 `links`，已有连接可点击进入属性编辑。该布局只表达仿真输入，不把 `group_id`、domain 或 links 描述为真实主机、机箱、NVLink、PCIe 或物理网络。
- 验证：上一轮拓扑相关 Vitest **80/80**、拓扑 Playwright **3/3**、快捷控制拓扑相关 Playwright **2/2**；本轮分组部署与卡片连线回归 **27/27**，拓扑 Playwright **3/3**；修改文件 Prettier、ESLint、`vue-tsc`、`git diff --check` 和生产 build 通过。1440px 页面截图复核了分组部署布局与有连接状态；4173 仅用于临时浏览器验证，未部署到 5173。

## 2026-10-16 拓扑显卡连接工作台重构（前置方案，已被上方最终收口覆盖）

- 新建实验的拓扑主路径收敛为“显卡连线”：默认打开仿真连接清单，按“源设备 → 目标设备 → 添加仿真连接”完成最常用的 links 编辑；已有连接继续在清单中按端点、domain、域内/跨域类型查看，并可编辑或删除。
- 设备清单和域清单不再与连接编辑连续展开，改为“高级拓扑设置”默认收起；部署概览、网络模型和关系图也收进“更多拓扑视图”，关系图只作为辅助定位，不改变 topology JSON、Bridge schema 或仿真语义。
- 连接参数带宽/延迟改为可选展开项，首屏只保留设备端点和 domain；summary 收敛为设备、仿真连接、domain 三个主指标。所有新文案继续明确这是仿真输入，不代表真实物理网络。
- 验证：拓扑/结构化组件 57 tests passed；Topology Playwright 3/3；快捷控制拓扑连接 Playwright 2/2；vue-tsc、改动文件 ESLint、Prettier 和 git diff --check 通过。4173 仅用于浏览器视觉复核，未停止、重启或替换 5173。

## 2026-10-14 Agent 结构化 JSON 草案与双视图同步（历史基线；已由 2026-10-15 条目收口）

- 配置助手的模型方案仍只接受 Bridge 已发布的标量 settings；浏览器先按实时参数目录、范围、枚举、引用和集合依赖校验，再通过现有原子写入路径生成 runtime/topology JSON 预览。预览只读展示“确认后一次性应用”，不会创建运行，也不会绕过 `additionalProperties: false` 或猜测 `device_id`、links、domains、module bindings。
- 实验页和轻量准备页的 Agent command registry 新增只读 preview handler；用户确认时仍由页面 owner 重新执行同一校验并一次性提交两份文档。任一元素或交叉引用失败，整批保持原文档和表单不变。
- 结构化 JSON 文档变更会按精确指针反向投影到快捷控制；只有单一、无歧义的 scalar 值会回填旋钮，缺失或多个 module binding 值不一致时保持“未设置”，不会猜测。两页继续共享同一 draft/session 状态，草案写入前不会创建 run。
- 该能力是前端本地预览与原子应用闭环，不新增 Bridge/后端字段或契约 revision；任意卡数配置仍需真实 `device_id`、links、domains 和后端校验，不能由设备数量或 group_id 推断物理互联拓扑。
- 2026-10-14 目录边界复核：模型上下文现在优先保留当前 runtime trace 中每一条 `requests[i]/tp_degree`，避免短消息预算只暴露前两条请求；`device_id` 等必须联动引用的身份键不再发送给模型（页面结构化编辑仍保留并安全拒绝单独改名）。完整的“设备数 + 每条现有请求 TP”方案会复用结构化编辑器的显式配对操作，原子同步 `participants` 到实际生成的设备集合；只改设备数或只给部分请求仍要求用户在结构化输入中选择配对，links/domains 不会被助手猜测。

## 2026-10-15 Agent 任意卡数配置收口（当前工作树）

- 配置助手不再把 8 卡作为隐含特例：Bridge 提示和前端目录均按 schema 的 `topology/devices.maxItems` 工作，新增设备由原子编辑器安全生成 `device_id` 和默认 `GPU` 类型；只有用户明确要求分组时才要求对应 `group_id`，不会猜测 links/domains。
- 设备数与请求 TP/participants 的组合应用现在覆盖扩容、缩容和保持卡数调整 TP。只有明确列出所有现有请求且目标 TP 与目标设备数一致时才自动重写参与设备；否则继续整批拒绝或转入结构化输入配对提示。
- 已补充 3、16、32 卡的原子应用测试及独立 16 卡 Playwright fixture 流程。未修改 Bridge schema、后端核心、5173、Provider 或 credential；任意卡数配置仍不代表物理拓扑、真实 GPU 或生产验收。

## 2026-10-15 部署 CTest 瞬态失败收口（当前工作树）

- 上一次启动器部署在 CTest #91、#97、#98、#99 返回 `wsl.exe` exit 8；同一构建目录随后对这四项连续复跑及全量 100 项复跑均通过，未发现稳定的仿真回归。
- `scripts/deploy-local-backend.ps1` 与 `scripts/update-backend.ps1` 现以 `-j1 --repeat until-pass:2` 串行执行 CTest：单个时序/资源瞬态失败最多重试一次；重复失败仍保持非零并阻止部署，不吞掉真实失败。
- 使用 `-ReuseVerifiedArtifacts -NoRestart` 的当前源码部署复核已成功，Bridge/Web 182 项 Bridge unittest、schema revision 和生产构建均通过；本次未停止、重启或替换 5173。

## 2026-10-15 强制全量部署门禁复核（当前工作树）

- 启动器日志中的 `exited with code 1` 后续定位为工作树 UI 文案/结构调整留下的 7 项 Vitest 回归，而非 CTest 或 TileSim 仿真失败。已恢复 S0-S9 身份标识在证据节点和 Agent 契约策略中的可见性，保留场景标签及结构化输入布局，并为新增运行时/请求证据文案补齐英文目录。
- 完整 Web Vitest 复跑为 **101 files / 1075 passed / 8 skipped / 0 failed**；`vue-tsc --noEmit`、改动文件 lint、contracts check、docs/deps check、生产 build 和 `git diff --check` 均 exit 0。
- 使用当前 Web 与后端工作树执行 `scripts/deploy-local-backend.ps1 -SourceRoot D:\tileSim -NoRestart` 成功：后端 CTest **100/100**、Bridge **182 tests OK**、Web 全量 Vitest **1075 passed / 8 skipped**、生产构建通过，manifest 已写入当前源码/构建摘要。未停止、重启或替换 5173。

## 2026-10-15 Agent 当前 JSON 上下文与 8 卡方案收口（当前工作树）

- 实验页和轻量准备页现在把当前 `runtime_trace`、`topology` 作为有界、只读的分段上下文随 Agent 配置请求发送；客户端按 Bridge 的单消息/总会话上限裁剪，并在缺失尾部时明确禁止模型猜测。用户原句仍是最后一条消息，页面仍由 live catalog、引用完整性和原子写入路径最终校验。
- Bridge 助手对明确的 synthetic provenance shorthand 做兼容归一化，并继续拒绝缺失请求 ID、重复 request ID、悬空设备/域/模块引用和不完整拓扑。该兼容只作用于模型返回值，不放宽用户 JSON 或运行契约。
- 当用户只要求“配置一次 N 卡实验”而 Bridge 额外拒绝了可选 `structured_inputs` 时，前端现在将其显示为非阻塞警告；设备数量、每条现有请求的 TP 与 participants 的完整配对仍可一次性应用。用户明确要求完整 JSON、links 或 domains 时，拒绝仍保持阻塞。完整 JSON 且无标量编辑的方案也可通过页面 owner 的 validator 原子写入。
- “JSON 输入”页现在与快捷控制页一样发布可写 Agent 上下文：助手可读取当前两份 JSON 并生成草案，页面 owner 仍按同一 live catalog、引用校验和原子写入路径落地；Trace package 选择页继续只解释、不提供可写草案。
- 两个可写实验页在 Bridge/schema 就绪且没有任何现有 JSON 草案时，会通过 `runExperiment.getTemplate(form.scenario_id)` 自动读取 canonical `runtime_trace` 与 `topology` 作为只读 Agent 上下文；不会打开结构化编辑器、切换模式或创建运行。用户已输入任一 JSON、切换到 Trace package 或模板请求失败时均保持原内容/页面可用，仍可使用显式“加载场景模板”入口。
- 本轮定向前端 148 tests、Bridge 助手/服务/参数面 279 tests、全量 Web Vitest **101 files / 1083 passed / 8 skipped**（含自动模板上下文与请求字段英文覆盖回归）、typecheck、lint（0 error / 2 既有 warning）、contracts/docs/deps check、生产 build、修改文件 Prettier 和 diff check 通过。全量 `format:check` 仍因 20 个既有/并行改动文件阻塞；本轮修改文件单独格式检查通过。未停止或替换 5173；未读取 credential、调用 Provider、操作用户 run、提交或推送。

## 2026-10-12 S2–S5 Bridge 矩阵与发布门禁剩余问题（第十二阶段，当前工作树）

- 未修改后端仿真计算、S1 attribution 能力或 Bridge 契约。使用仓外当前源码 CLI、临时 Bridge `18372` 和临时 runs，真实验证了 canonical `s2-execution`、`s2-kernel`、`s3-memory`、`s4-device`、`s5-collective` package：均由 CLI inspect 返回 `tilesim.trace_package.v1alpha1`、`synthetic_trace`、`uncalibrated` 后进入 Bridge，HTTP `202`，终态 `completed`。执行包边界分别为 `S2→S6`（execution/kernel）、`S3→S6`、`S4→S6`、`S5→S6`；S2/S5 保留真实 Fabric records（12/5/10 条），S3/S4 无 Fabric records。所有 manifest 为 `tilesim.bridge.artifact_manifest.v2`，run/schema/SHA-256/bytes 身份一致；没有 attribution artifact。
- Bridge 未按 package ID 猜测工件适用性。五个 package 均未请求 runtime 工件；S2/S5 的 metrics、tail-cause-chain、design-space 以带身份的 `expected_absence` descriptor 表达，S3/S4 的后端实际生成 metrics/design-space 保持 `ready`，tail 仍为带原因的 `expected_absence`；受控读取返回 descriptor 而非空事件数组。S2 显式缺少 `trace-kind` 的失败边界由 CLI/Bridge 契约保留，未新增猜测性注册。
- 独立 `4173`（代理临时 Bridge）真实浏览器检查了 1440px 浅色与 1024px 深色的 package 列表、S2/S3/S4/S5 执行页、entry boundary、provenance、fidelity、expected-absence 文案、Fabric 数量及无横向溢出。完整深链/刷新和全部原始证据入口未在本轮逐项复跑，不能写成完全通过；仍需后续浏览器工作包补齐。
- 自动化门禁：Bridge 定向 `python -m unittest test_server.py test_assistant_model.py test_parameter_surface.py` 为 275 tests 通过；全量 discovery 300 tests 中 1 项既有 `contracts.agent_orchestration_phase2.tests.test_registry` 导入 `bridge` 失败，其余通过。Web Vitest `1114 passed / 8 skipped`、contracts、typecheck、lint（0 error/2 既有 warning）、build、docs、deps、diff check 通过；`format:check` 仍被 24 个既有未修改文件阻塞。仓外 Release CTest 定向矩阵在 `PYTHONUTF8=1` 下 `13/13` 通过；默认 Windows 代码页有 3 项 Python 解码失败。全量 CTest 在 `PYTHONUTF8=1` 下 `92%`，剩余为未构建目标、既有资源路径及 RuntimeSwap/NetworkWait/PrefixCache/DenseRank/DevicePlacements 回归，未改仿真逻辑。
- 全量 Playwright 单独运行 `69 passed / 6 skipped / 4 failed / 1 not-run`；4 项均为既有 desktop screenshot drift（synthetic evidence、request evidence、dark evidence、unknown schema），未更新快照；`large-artifact-worker` 的 not-reached 未在本轮出现。结果仍仅属于本地 synthetic hosted、临时 Bridge 和前端集成证据，不代表真实 GPU、Provider、校准、held-out validation 或生产批准。未触碰 `5173`、credential、Provider、用户 run，未提交、推送或部署。

## 2026-10-13 Agent 配置助手与任意卡数扩容安全起点（当前工作树）

### 模型配置上下文补强（当前工作树）

- 配置助手请求现在把实时参数目录作为有界的只读对话上下文发送给已配置 Agent：包含精确 path、当前值、范围/枚举、结构化输入模式和集合字段模板；原始用户句子仍是最后一条消息。该上下文不改变 Bridge 契约，也不构成前端写入授权。
- 未加载结构化输入时，页面会明确告知模型 `topology/devices`、`runtime_trace/requests`、TP、participants 及其元素尚未发布，并引导用户加载模板或在 JSON 输入页粘贴两份文档；加载后才暴露实时集合目录。模型返回后仍必须通过 live catalog、引用完整性、范围和原子应用校验。
- 目录上下文按 Bridge 单消息上限裁剪，不发送完整大拓扑；目录外字段继续 fail closed。新增定向单测和 L6 浏览器断言覆盖上下文模式、最后用户消息和不创建 run 的边界。

### 2026-10-13 配置请求统一委托 Agent（当前工作树）

- 配置页的自然语言请求不再经过本地场景关键词或字段名匹配：任意卡数、吞吐/延迟描述和显式参数赋值均统一发送给已配置的 Agent 模型。
- 浏览器只对模型返回的结构化方案执行实时参数目录、范围、引用/集合完整性和原子应用校验；模型不可用或方案无法验证时 fail closed，不生成本地 fallback 方案、不写入配置、不创建 run。
- 保留模型返回后的 key 到 live catalog 解析，因为这是拒绝未知字段和保持 JSON Pointer/当前页面边界的校验步骤，不是自然语言兜底。`scenario-profiles.ts` 及本地场景推荐路径已移除。
- schema-set revision、Bridge 契约、后端核心、5173、Provider、credential、用户 run、提交和部署均未触碰。

- 先前登记的 `eight_card_trial` 确定性场景目录已从运行路径移除；卡数现在由 Agent 根据当前页面目录生成方案，页面会按契约范围校验任意目标数量。页面仍不会猜测 domains、links、module bindings 或设备分组，方案必须经实时目录和结构化输入约束验证后才能应用。
- 结构化输入面板在设备清单变化后显示明确的 TP/participants 配对选择：同步 TP 与参与设备到新集合、保留原 TP 并从新集合选择参与设备、清空 participants 保留 TP，或稍后处理。配对提示未处理时运行按钮保持禁用，用户明确选择“稍后再说”后才解除；失败的配对编辑不会清除阻塞状态。TP 大于新设备集合时拒绝静默降低，domains/links 仍由真实拓扑编辑器维护。
- Agent 应用拓扑设备数量方案后会切换到结构化输入，并通过同一配对提示继续配置；参数目录仍只发布可验证的集合大小和标量叶字段，不新增 Bridge 字段、不放宽 Schema、不生成虚构拓扑引用。版本化引擎的通用 `batch_scheduler` 继续由画像调度，页面禁用该通用控件并显示提示。
- 本阶段改动集中在 `src/features/run-experiment/`、`src/views/ExperimentView.vue`、结构化输入英文目录及对应单元/组件测试。定向测试 198 passed；全量 Vitest 1123 passed / 8 skipped；`vue-tsc --noEmit`、`pnpm lint`（0 error、2 既有 warning）、`pnpm build`、`contracts:check`、`docs:check`、`deps:check` 和 `git diff --check` 通过。未运行或修改后端核心，未触碰 5173、Provider、credential、用户 run、提交、推送或部署。
- 全仓 `pnpm format:check` 仍报告 24 个既有文件（含历史契约/文档、`scripts/generate-bridge-client.mjs`、预先存在的运行实验文件）；本阶段实际修改文件的 Prettier 检查通过，未进行无关全仓格式化。
- 该能力仍是本地参数草案与结构化输入辅助，不代表任意卡数的物理拓扑、真实 GPU、Provider、校准、held-out validation 或生产发布已验证；domains/links、设备能力和后端契约校验仍是最终门槛。

## 2026-10-13 文档整体审查复核（当前工作树）

- 本次复核只更新文档口径，没有修改前端实现、Bridge 契约、生成物或后端仿真。结论范围限定为“前端是否正确暴露和解释当前后端已经提供的能力”；后端尚未实现的 Profile、Run Intake v2 执行、真实 GPU、Provider、校准和 held-out validation 不计为前端对齐缺口。
- 当前已验证的 S0–S5 前后端边界：S0 dense package 可生成并展示 `request_attribution`；S1 runtime package 可展示四类 runtime 工件但在 dense DES 前置不足时不生成 attribution；S2 execution/kernel、S3 memory、S4 device、S5 collective 可通过当前 canonical Bridge package 进入 `completed`，页面展示 CLI 返回的 entry boundary、provenance、fidelity、Fabric 数量和带身份的 `expected_absence`，不把不适用工件解析为空数据。S2–S5 的完整深链、刷新恢复和全部原始证据入口仍属于浏览器复验项，不能写成已完全覆盖。
- 当前身份口径保持不变：canonical schema-set revision 由 `bridge/contracts/schema_set.py` 计算，当前值为 `sha256:aa9e305651fa1731de47b034fec27f2ea19089651119302c21b3698c1a97b327`；manifest、run、artifact schema、SHA-256 和 bytes 必须绑定校验；query/cache key 继续包含 run ID、backend identity、schema revision 和 artifact SHA-256。此前阶段的 revision 数字保留在各自历史记录中。

### 2026-09-28 审查项当前状态

下表是对下方历史登记的当前复核，不改写原始复现记录和当时门禁数字：

| ID                   | 当前状态                             | 当前依据                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT-20260928-001` | **已关闭**                           | `currentGuidanceBundle()` 对配置/准备路由拒绝结果分析授权；`tests/e2e/dashboard.spec.js` 与相关 Agent 测试覆盖配置页说明路径。全局 `runId` 或旧报告不能单独授权结果分析。                                                         |
| `AUDIT-20260928-002` | **已关闭**                           | `src/stores/agent-sessions.ts` 已实现 7 天过期、最多 8 个会话、约 200 KB 总上限、长度限制/redaction、当前会话删除和全部本地会话清理；不保存 credential、hidden reasoning、Provider raw response 或未展示的完整 evidence payload。 |
| `AUDIT-20260928-003` | **环境/部署项开放**                  | 5173 的执行身份一致性仍属于部署验收，不是前端功能对齐项；本轮未停止、重启或替换用户服务。                                                                                                                                         |
| `AUDIT-20260928-004` | **既有 Bridge 测试基础设施问题开放** | 全量 discovery 的 `contracts.agent_orchestration_phase2.tests.test_registry` 导入失败；定向 Bridge 套件通过，未通过排除测试掩盖。                                                                                                 |
| `AUDIT-20260928-005` | **既有格式门禁问题开放**             | 全仓 `format:check` 仍有历史未修改文件失败；本阶段实际改动文件单独检查通过，未进行无关全仓重写。                                                                                                                                  |
| `AUDIT-20260928-006` | **已关闭**                           | `AgentCopilotShell.vue` 使用无 `role="status"` 的单一 `aria-live="polite"` 状态区域；辅助功能测试确认无重复 live region，加载、模型、错误和持久化失败文案可读。                                                                   |
| `AUDIT-20260928-007` | **已关闭**                           | 结果分析进度来自真实 artifact 读取和流式阶段：读取证据及 `X/Y`、整理上下文、等待模型、模型输出、本地证据兜底和失败可重试；相关测试覆盖计数与失败回退。                                                                            |

### 当前发布判断

- 在“只负责前端，后端未实现能力不计入缺口”的范围内，已发布并已验证的前后端能力对齐；S2–S5 的 Bridge package 也已完成本地 synthetic hosted 矩阵。
- 当前不能写成“全部门禁通过”：全仓格式检查仍有既有失败，Bridge 全量 discovery 仍有既有导入错误，全量 CTest 仍有后端/环境回归，全量 E2E 仍有既有截图漂移；这些不应被归因于新的前端参数或证据契约错位。
- 真实 GPU、Provider、校准、held-out validation 和生产部署不属于本地前端对齐结论。临时 Bridge、4173 和仓外 synthetic run 均已按阶段结束后停止；5173、credential、Provider 和用户 run 未操作。

## 2026-10-12 发布门禁分类与 S2–S5 边界复验（第十一阶段，当前工作树）

- 本阶段未改实现、契约或后端仿真。第十阶段的 24 个 `format:check` 失败仍在既有未修改文件；Bridge 全量 discovery 的 `contracts.agent_orchestration_phase2.tests.test_registry` 导入 `FAMILIES` 失败，经检查还依赖当前 registry 已不存在的旧 API，属于 Bridge 内部测试／实现漂移，未通过排除测试或兼容注入掩盖。定向 Bridge 套件 275 tests 通过，全量 300 tests 中仍有 1 个导入错误。
- 全量 CTest 本轮为 86/100 通过；其余分别涉及 Windows 默认代码页的 Python 解码、未构建目标、`docs/examples/dense_timing/topology.json` 资源路径及既有 RuntimeSwap、AutomaticPrefixCache、DenseRankExecution、DevicePlacements 回归。关键定向 11 项通过；Trace package 三项在默认代码页失败、`PYTHONUTF8=1` 下通过。上述后端／测试基础设施问题仍开放，未改仿真计算。
- 当前核心源码提供可执行的 `s2_execution_trace.json`、`s3_memory_trace.json`、`s4_device_trace.json`、`s5_collective_trace.json`：S2 必须显式指定 `--trace-kind execution` 才能成功；S3/S4/S5 CLI 成功并保留 `expected_absence`、`not_covered` 和各自 provenance，不生成运行期工件。独立临时 Bridge `18371` 再次验证 dense S0 attribution `ready`（23,550,124 bytes）、S1 runtime 四工件 `ready` 且无 attribution、重复 request ID intake `422` 且无 run；manifest revision 仍为 `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`。S2–S5 的 Bridge 创建 run／manifest 矩阵本轮未完成，不能以 CLI 成功代替。
- Web 全量 Vitest 1114 passed／8 skipped，contracts、typecheck、lint（0 error／2 既有 warning）、build、docs、deps、diff check 通过。全量 E2E 单独运行 69 passed／6 skipped／4 既有截图差异／1 not-reached；未更新快照，`large-artifact-worker` 单独复跑 1 passed。独立 4173 真实 Bridge 浏览器只检查了 package 列表、dense S0 package 和执行页；完整 1440/1024 浅深主题及 S2–S5 浏览器矩阵未完成，不能算通过。以上仍仅是本地 synthetic hosted 与临时集成证据，不代表 GPU、Provider、校准、held-out 或生产批准；未触碰 5173、credential、用户 run，未提交、推送或部署。

## 2026-10-12 全量门禁与发布候选收口（第十阶段，当前工作树）

- 未修改实现、契约或后端核心。使用仓外 MSVC Release 构建（现有 `tilesim-stage8-build`，CLI 目标构建成功）和临时 Bridge `18370`：`/api/manifest` 返回 canonical `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`，backend identity 与 `24f14ca1b9985e7a1651092d4c472c057ba16c2b` 绑定一致。
- 真实临时 Bridge：dense S0 run 完成并生成 `tilesim.request_attribution.v1`（23,550,124 bytes，manifest/受控读取 SHA、bytes、run/schema/Pointer 一致）；S1 package 返回 202→completed，仅生成适用 runtime 工件且无 attribution；重复 package 保持 intake 阶段 `422 trace_package_inspect_nonzero_exit`、`/trace_package_id`，不创建 run/manifest/artifact；legacy controls run 完成。synthetic 结论仍限 consistency/exploratory。
- 独立 4173（代理 18370）真实浏览器已检查 1440 浅色、1024 深色、S0 attribution、23 MB 工件原始证据虚拟索引、`/requests/0` 深链刷新、S1 package 适用性和不可提交的 invalid package。未触碰 5173、Provider、credential 或用户 run。
- 门禁：Web Vitest `101 files / 1114 passed / 8 skipped`、typecheck、lint（0 error、既有 2 warning）、build、contracts/docs/deps/diff check 通过；`python -m py_compile` 通过。Bridge 全量 discovery `300` 项中 1 项既有 `contracts.agent_orchestration_phase2.tests.test_registry` 导入错误；`format:check` 被既有 24 个文件阻塞。全量 CTest `86/100` 通过，其余为仓外 Windows 默认 GBK 子进程解码、未构建目标、既有资源路径/仿真回归；定向关键 9 项 CTest 通过。全量 E2E 单独运行 `69 passed / 6 skipped / 4 failed / 1 not-run`，4 项均为既有 desktop screenshot drift（未更新快照）。
- 以上仍是本地 synthetic hosted execution、临时 Bridge 和前端验收，不代表真实 GPU、Provider、校准、held-out validation 或生产发布批准。历史阶段数字保持不变。

## 2026-10-11 Bridge intake 失败语义与 S1 归因边界（第九阶段，当前工作树）

- Trace package 在 `POST /api/runs` 创建 run 前必须由当前 `TileSimCLI inspect-trace-package` 重新检查。检查非零是 **intake 阶段拒绝**，canonical HTTP 语义为 `422 trace_package_inspect_nonzero_exit`、字段路径 `/trace_package_id`；不创建 run 目录、不写 run manifest，也不产生逐请求归因工件。该语义与已有 inspect endpoint/OpenAPI 错误信封和回归测试一致，不能改写成 `202 → failed`。
- 实验页将该 422 明确显示为“输入在 intake 阶段被拒绝，尚未创建 run”，保留结构化错误 code/path 和可重试入口；它不显示为运行失败或部分成功。普通运行的 `range_execution_failed` 与执行期归因的 `REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED` 不受影响。
- S1 runtime package 仍只生成运行期工件；逐请求归因继续要求后端真实 DES、dense profile、物理设备/网络/Fabric 证据及唯一 request metric identity。缺少任一前置时保持 `REQUEST_ATTRIBUTION_REQUIRES_DENSE_DES_EVIDENCE`（例如 `/dense_execution/schema_version`）fail-closed，不从 package ID、设备分组或 synthetic trace 推断归因。
- 本阶段只补齐 intake 422 的前端状态与 Bridge 无 run 回归；没有放宽 schema、降低归因前置、修改 Schema revision、触碰 5173、Provider、credential、用户 run、提交、推送或部署。验收仍属于本地 synthetic hosted/临时 Bridge 与前端测试，不是 GPU、Provider、校准、held-out 或生产批准。

## 2026-10-10 运行期证据第五阶段（当前工作树，未提交／未部署）

- 仅对已发布、无 Trace package 的 S1 输入，Bridge 在**同一次**真实 CLI hosted run 中请求 runtime events、summary、request summaries 和 analysis。后端四工件增加各自的 `schema_version` 与 `run_id`，非运行时入口的 `expected_absence` 文件是带身份的描述符而不是空事件数组；manifest 和受控读取分别核对 schema、run、SHA-256、bytes、contract/content 状态。文件未请求、缺失、校验拒绝、未知 schema、正常空数组和执行失败互不代换。Trace package 的入口边界由 CLI 检查，Bridge 不预判并不请求四工件。
- 执行页只在用户点击时读取四工件，每页 25 条后端事件／请求记录；超过 8 MB 改走原始证据查看器的按需索引/虚拟行，不在执行页解析。归因页将逐请求运行记录与真正的逐请求原因链分开；`--request-attribution-out` 在这些轻量 S1 输入上要求 dense DES host，真实 CLI 返回 `REQUEST_ATTRIBUTION_REQUIRES_DENSE_DES_EVIDENCE`，故第五工件**未开放采集**，不伪造原因链。显示级输入/指标关联仍不是事件流，不对共享批次时间做独立资源合计。
- 结果分析证据包仍以当前 run manifest 的验证身份为准，保留读取数量、字节、schema、SHA、contract/content 状态和裁剪说明；超过 8 MB 的单文件不下载进模型上下文，标为 `too_large_for_model_context`，原有全文／结构摘要预算不增加。未调用 Provider。
- 当时 schema-set revision 是 `sha256:41c9f630a5792f136700b8c469f92e8b5961f4ee55d7e652b70d84708d1aa647`，相较第四阶段的 `sha256:3538337ea5dcc9fb88ed213fa9eb177246023d1209b15d625af8f1593d8a72be` 已变化；OpenAPI、Schema 与生成类型/校验器同步，`contracts:check` 通过。当前 revision 以第六阶段条目为准。
- 仓库外 MSVC `/utf-8` 构建及七项定向 CTest 通过；五种 S1 输入的 CLI 原/新采集对照中 metrics、validation、execution envelope 完全一致，主报告只增加四条工件清单记录；合法 S3 对四开关返回 `expected_absence`。独立 18351 Bridge 与 4173 浏览器验证了五种 S1 run、受控文件读取、深链和刷新恢复；定向 fixture E2E 独立通过。均属本地 synthetic consistency/exploratory，不是 GPU、真实推理服务、真实校准、held-out 或生产批准。全量 CTest/E2E 未运行；门禁数字和命令见最终交付报告。

## 2026-10-10 逐请求归因、Trace package 与大工件第六阶段（当前工作树，未提交／未部署）

- 后端在当前执行路径闭合了逐请求归因的 dense DES 前置：请求 DES、dense profile、物理设备拓扑、网络 domains/links、非空且唯一 request metric identity，以及设备/KV、网络/Fabric 完成证据。真实 CLI 对 dense S0 package 生成 `tilesim.request_attribution.v1`；Bridge 仅在 hash-bound S0/S1 runtime entry 且检测到 dense DES 条件时请求该工件。归因 payload 保留后端 request/report/cause identity、subject/evidence refs、JSON Pointer、run/schema 绑定；Bridge 校验 run、外部 metrics identity、唯一引用和 SHA/bytes。非 dense、缺设备/网络、非 DES 均在生成前以稳定错误码和字段路径失败。重复请求目前由 S0 loader 以 `range_execution_failed` 拒绝，尚未提供 attribution 专用字段路径，不能把该项写成已闭合。
- 真实临时 Bridge 18361 已验证：S0/S1 runtime package 请求四类运行期工件；S2/S3/S4/S5 package 不请求不适用工件；dense S0 package 的 attribution `ready`，小工件可控读取；S1 synthetic 输入生成了 9,689,193-byte runtime event trace，manifest bytes/SHA 与受控读取一致。大于 8 MB 的真实事件文件原始证据页建立 Worker 索引（409,601 行、378,092 Pointer）并在刷新后恢复 `/events/0` 深链；执行页不首屏读取大文件。大于 8 MB 的归因页只展示身份和原始证据入口。
- 独立 4173 真实浏览器验证了归因按需读取、请求原因链分页、事件/归因大工件边界，以及浅色/深色 1024/1440 桌面视口；执行页运行期工件按钮只在用户点击时发起读取。结果分析单元验证大工件不调用读取、仅保留 schema/run 外的 artifact 身份、bytes、SHA、`unavailable` 与 `too_large_for_model_context`，未调用 Provider。当前 manifest revision 实测为 `sha256:77cf2fd41db5291e6f4f169cfac37564ad9d4b36a5553ff243fe2b8823ba20e6`；相对第五阶段记录存在漂移，未修改 revision 以掩盖漂移。
- 仓库外 MSVC `/utf-8` 重建并通过 11 项 CTest（第五阶段七项 + attribution/Trace package/WindTunnel）；Bridge `py_compile` 与 189 tests、定向 Vitest、contracts/typecheck/lint/docs/deps/build/diff check 通过。所有证据仍是本地 synthetic hosted execution、临时 Bridge 和前端证据链路；不是真实 GPU、Provider、校准、held-out 或生产批准。全量 CTest、全量 Vitest、全量 E2E 未运行。暂未修改 5173、Provider、credential、用户 run，也未提交、推送或部署。

## 2026-10-10 参数与推理引擎第四阶段（当前工作树，未提交／未部署）

- 仓库外 MSVC `/utf-8` 构建的 `TileSimCLI` 完成七项定向 CTest；本地 synthetic S1 hosted CLI 的 legacy、vLLM、SGLang、TensorRT-LLM 动态请求及显式 vLLM 阶段回放均 exit 0。回放 collective 保留逻辑 request 身份和输入顺序，execution envelope 结构化记录 `runtime_engine_type`、`runtime_engine_semantic_version`、`runtime_input_mode`、`semantic_profile_applied`；Web 在执行页直接从已绑定 envelope 展示，不在主 run-result 或 metrics 顶层补造字段。requested DES 与 resolved fidelity 仍独立。`vllm.0.6.tilesim_pd.v1` 缺分离、特性、dense host、放置、多 rank handoff 或必要 dense profile 时在 Fabric 前以 code/path 失败；Web 仍不发布该版本。
- `CLIHostValidationTest` 的 held-out baseline 断言保留；Windows 测试 CLI cwd 原先是临时 artifact 目录，导致相对默认 baseline 包无法读取，现从后端源根运行并继续将 artifact 放在临时目录。Bridge 真实子进程输出改为 UTF-8 严格解码，异常/缺失输出均收敛到持久化失败终态。独立 4191 默认 cp936 与 4192 `PYTHONUTF8=1` Bridge 的真实 CLI 成功运行已验证；4191 的后端失败 run 记录 exit 1、错误码、stderr 摘要与结束时间。4173 浏览器链路创建、刷新恢复动态及回放 run，非法 KV 的字段路径和辅助技术文本已验证，失败 run 概览显示原因并提供返回配置入口。所有临时 runs 均在仓库外，未触碰 5173。
- 以上只是本地 synthetic hosted execution 与临时 Bridge/浏览器集成，不是 GPU、真实推理服务、Provider、真实校准、独立 held-out 验证或生产发布批准。尚未执行全量 CTest 与全量 E2E；完整验收命令和门禁结果以本阶段最终报告为准。

## 2026-10-09 前后端参数对齐第二阶段（当前工作树，未提交／未部署）

- 受控 `custom_inputs` 修正三项正数运行 policy、`kv_admission_watermark` 的开区间下界、小拓 `run_name` 80 字符上限。后端运行入口对 synthetic runtime provenance 只支持 `synthetic_trace/uncalibrated/exploratory`，该 tuple 在 runtime Schema 与 Bridge 校验收紧；拓扑 workload 同时提供 bytes/MB 时后端优先 bytes，为避免歧义输入现要求只选一项。独立的 design-space v1、拓扑 provenance 口径未据此升级或改动。
- 受控 S1 runtime trace 可选择 `legacy_generic/legacy_generic.v1`（省略字段仍是默认）、`vllm.0.6.semantic.v1`、`sglang.0.4.semantic.v1`、`tensorrt_llm.0.12.semantic.v1`。仅发布无高级前置的调度特性子集；`phase=request` 必须显式填请求、正数容量、足额 KV、有效 TP/参与设备且设备存在于拓扑；版本化 prefill/decode 为按序回放，不与动态请求混用。表单不隐式转换阶段；小拓不提供引擎版本、特性数组或 phase 标量编辑，动态模式错误整批回滚。通用调度提示与版本化画像调度提示分离；请求 DES 与报告 resolved fidelity 仍分别显示。
- `vllm.0.6.tilesim_pd.v1`、service-time、swap、chunk、PD 分离、prefix、MoE、逐阶段通信、GPU-in-loop、真实 Trace、Cycle、Run Intake v2 均**未开放**。PD 需要完整放置、handoff 和 dense host；其余须单独闭合来源、引用、物理 host 与失败语义。版本化画像只是仿真语义，不启动真实推理服务；本轮只有 fixture／单元级合成一致性，非真实 Provider、校准或留出验证。
- 测试：定向 Vitest 110 passed；Bridge 相关套件与 400／不创建 run 检查通过；定向 fixture E2E 2 passed；contracts check、typecheck、lint（0 error、既有 2 warning）、build 通过。后端 C++ 未构建／CTest 未运行，Web 的 `/api/runs` 三画像测试只证实 Bridge intake，执行由 mock 截断，不能声称后端真实执行验收。5173、核心仓库、用户 runs 和 credential 均未操作。

## 2026-10-09 小拓全页面参数方案路由（工作树，未部署）

- 配置页首轮点名字段、但没有明确 `路径 = 值` 的方案请求，现在优先走已有的完整页面参数目录与配置模型；“运行参数：batch size、最大活动请求数、KV 容量、调度策略”中的冒号不再被误认成确定性赋值。只问页面用途/指标的句子仍走页面说明，明确赋值仍由本地目录确定性校验；冻结的八字段 Phase 1 compiler 与正式 `agent_exposed` 发布集合未更改。
- 模型方案继续按当前页面目录逐项验证，用户明确排除的设备数量、TP 或现有拓扑元素若仍出现在模型提案中，整份方案禁止应用；用户确认前不写表单。页面没有打开结构化输入时，未发布的元素路径不能凭模型建议被写入。模型不可用时，涉及扩展字段的自然语言请求给出重试或完整路径赋值提示，不再把页面可编辑字段误报为正式能力不支持。TP 与参与设备、拓扑引用和缺失 links/domains 仍按现有原子回滚/不完整方案规则阻止误用。
- 定向单元与浏览器夹具覆盖四个运行旋钮的一次方案生成及确认写入；5173 正在使用，本批不替换、不部署，真实 Provider 的新路由行为仍待用户通过正常部署流程验证。

## 2026-09-28 小拓结果分析模型接入（工作树，未部署）

- 结果分析新增独立只读模型通道 `POST /api/agent/result-analysis`，与配置/方案通道分离；模型不可用、超时或响应不完整时，前端继续使用确定性的本地结果整理，不创建运行、不修改配置、不写回报告。
- 发送给模型的不是单独三段摘要：当前 run 的 artifact manifest 会逐一经过既有 run、schema、bytes、SHA-256 校验路径读取。每个 artifact 都保留 `artifact_id`、schema、SHA-256、字节数、contract 状态和内容覆盖状态；rejected artifact 也会显式保留。
- 小文件全文进入上下文；单文件超过 12,000 字符或总证据超过 150,000 字符时降为结构摘要，验证失败标记为 `unavailable`，`not_applicable` 与 rejected 不会被伪装成已读全文。模型提示词必须报告这些覆盖事实，不能声称分析了所有证据文件。
- 已补充前端 evidence-pack、Bridge 校验、OpenAPI/生成类型、流式 API 与单元/端点测试。当前验证：Vitest **1077 passed / 8 skipped（96 files）**、Bridge **262 passed**、`contracts:check`、`docs:check`、`deps:check`、`vue-tsc --noEmit`、ESLint、`vite build`、`git diff --check` 通过；未部署 5173、未执行真实 Provider 调用。

## 2026-09-28 小拓本地会话管理（工作树，未部署）

- 助手对话已从 `App.vue` 的临时 ref 移入独立 Pinia store `src/stores/agent-sessions.ts`，使用版本化 `localStorage` 恢复多个会话；侧栏提供新建、切换和删除，会话标题从第一条用户消息生成。
- 每个会话独立保存已展示的用户/助手 transcript、typed blocks、创建/更新时间、页面 context revision，以及澄清重算所需的最近指令和 capability projection。切换会话不会执行方案或修改页面；context revision 不匹配时继续按既有 stale 规则拒绝旧草案/标记旧内容。
- 本地持久化是明确标注的有限期、可删除会话缓存：最多 8 个会话、7 天无活动后过期、总大小约 200 KB，超限按最近更新时间清理。只接受经过长度限制的可见 typed block 和 redacted 可见消息，不保存 credential、hidden reasoning、Provider raw response、未展示的完整 evidence payload 或任何运行操作；Bridge 仍不持久化 transcript。这是前端重启恢复能力，不冒充正式的服务端 Conversation/Turn store，侧栏提供当前会话删除与清理全部本地会话入口。
- 本批补充 `tests/unit/agent-sessions.test.ts`，覆盖跨 Pinia 实例恢复、会话隔离和删除最后会话后的兜底会话。当前工作树尚未部署 5173、提交或推送。

## 2026-09-28 整体审查登记（历史登记；当前状态见 2026-10-13 复核）

本轮只读审查覆盖：当前未提交工作树、前端静态门禁、Bridge Python 门禁、5173 健康状态、4173 真实浏览器路由/主题/窄桌面、助手模型结果分析、localStorage 会话恢复和 Axe 检查。除本节文档登记外未修改实现、未重启或替换 5173、未提交。

| ID                   | 优先级 | 状态         | 复现与证据                                                                                                                                                                                                                                                                                                                                                                                                                                   | 影响                                                                                                                                                   |
| -------------------- | ------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUDIT-20260928-001` | P1     | **开放**     | `tests/e2e/dashboard.spec.js:54-79` 在当前工作树失败：进入 `/experiment` 且工作区已有一个真实 run 后，提交“说明当前页面能做什么”，期望页面说明“这里可以核对当前实验参数”，实际被 `src/App.vue:1056-1057` 的 `resultQuestion` 路由到结果分析，展示运行结果摘要并调用/回退结果分析模型。根因迹象是 `currentGuidanceBundle()`（`src/App.vue:699`）只校验 run/report 身份，没有限制结果分析只能发生在结果/只读页面。                             | 实验配置页的解释问题会污染为结果分析；模型不可用时仍显示当前 run 的结果，导致配置页行为和既有 Phase 1 合同回归。                                       |
| `AUDIT-20260928-002` | P1     | **开放**     | `src/stores/agent-sessions.ts:147-217` 将完整可见用户消息、助手消息和 typed blocks 长期写入 `localStorage`；没有 retention/expiry/consent/redaction/export 记录或时间边界，只有删除当前会话。与 `docs/F9_AGENT_ORCHESTRATION/00_GUARDRAILS_AND_GLOSSARY.md:145-156`、`docs/F9_AGENT_ORCHESTRATION/05_CONVERSATION_AND_DRAFT_CONTRACTS.md:16,199-230` 的“不得保存完整对话/不得把 localStorage 当正式 conversation store/先发布留存契约”冲突。 | 用户问题和模型整理结果可能在本机浏览器永久留存；多会话数量和 block 体积也没有总上限。现有 2026-09-28 会话说明中“不会保存完整对话”的表述与实现不一致。  |
| `AUDIT-20260928-003` | P1     | **环境阻塞** | 当前 `http://127.0.0.1:5173/api/health` 返回 `execution_ready=false`、`state_digests_match=false`、`versions_match=false`，`deployment_mode=local_worktree_snapshot`；实测 `source_revision=cb2cd0bdef2a88e9ac5756ac5e739dc1495fb18d`，`build_revision=ba11e6fdb69af046dc7597e5ef5732cce029cfbe`。                                                                                                                                           | 当前 5173 服务不能作为可执行实验后端；页面可浏览、模型 descriptor/catalogue 可读，但提交运行应继续被阻止。需要通过既有部署流程恢复一致性，本轮未执行。 |
| `AUDIT-20260928-004` | P2     | **开放**     | 在 `D:\tileSim-web\bridge` 执行 `python -m unittest`，共发现 278 项但 `contracts.agent_orchestration_phase2.tests.test_registry` 导入失败：`ModuleNotFoundError: No module named 'bridge'`；其余测试完成。按仓库规定的定向 `python -m unittest test_server.py` 门禁可通过，故这是 discovery/包路径问题，不等同于 Bridge 业务失败。                                                                                                           | 全量 Bridge discovery 不能作为可靠绿灯；不同入口会得到不同结果。                                                                                       |
| `AUDIT-20260928-005` | P2     | **开放**     | `pnpm format:check` 失败，报告 26 个文件不符合 Prettier；其中包含当前改动涉及的 `src/App.vue`、`scripts/generate-bridge-client.mjs`、`docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md`，以及多份契约/文档 JSON。`pnpm lint` 无 error，但有 2 条既有 `vue/one-component-per-file` warning。                                                                                                                                  | 当前工作树不能通过完整格式门禁；是否全部由本批引入尚未拆分。                                                                                           |
| `AUDIT-20260928-006` | P2     | **开放**     | 对已打开的 `#tilesim-agent-copilot` 执行 Axe 4.13，发现 `aria-allowed-role` minor violation：`src/features/agent-copilot-shell/AgentCopilotShell.vue:413` 的 `<footer role="status" aria-live="polite">` 被判定为该元素不允许使用 `status` role。概览页面本身 Axe 无 violation。                                                                                                                                                             | 助手状态播报的语义角色不符合当前无障碍检查规则，可能影响辅助技术识别；不阻塞普通鼠标操作。                                                             |
| `AUDIT-20260928-007` | P2     | **待优化**   | 真实 run `run-20260923-164653-94a0e483` 的结果分析会先并发读取 manifest 中 9 个 artifact（包含约 1.2 MB 的 `metrics.json`），证据打包完成后才开始 SSE；期间只显示空的流式回答/“正在分析”状态，没有已读取数量、等待阶段或超时进度。当前一次浏览器调用最终返回 200，模型回答正确，未判定为功能失败。                                                                                                                                           | 大 artifact 或 Provider 较慢时用户无法区分“仍在读取证据”“等待模型”和“已卡住”，会误以为助手没有调用模型。                                               |

### 审查门禁摘要

- 前端 Vitest：**1081 passed / 8 skipped（97 files）**；`vue-tsc --noEmit`、`pnpm build`、`contracts:check`、`docs:check`、`deps:check`、`git diff --check` 通过。
- `pnpm lint`：0 error、2 warning；`pnpm format:check`：失败（26 files，见 `AUDIT-20260928-005`）。
- 全量 Playwright（本轮实际报告）：**69 passed / 6 skipped / 1 failed / 1 not run（77 tests）**；唯一失败是 `AUDIT-20260928-001`，其依赖项目导致 large-artifact-worker 本轮未覆盖。6 条 live Week 8 用例按环境条件跳过。
- 4173 浏览器只读巡检：专业与轻量主要路由均返回 200；1440/1024 宽度未发现横向溢出；概览 Axe 无 violation；助手侧栏有 `AUDIT-20260928-006`。
- `api.yhchj.com/ip` 在仓库源码中无引用，本轮登记为外部浏览器请求，未归因于 TileSim。

## 2026-09-24 专业原始证据入口（工作树，未部署）

- 专业导航以「原始证据」替代独立「AI 解释」入口；小拓仍是常用的结果分析与教学入口。旧 `/evidence-agent` 页面暂保留为深链兼容，不再出现在主导航，原 Evidence Agent 契约与历史记录未删除或改写。
- 完整 JSON 查看器从执行过程页移到独立 `/raw-evidence`，保留按需索引、搜索、复制、原始文件、manifest/SHA-256/JSON Pointer 校验；从图表和字段点击原始证据直接进入该页。旧 `/execution?...evidence_*` URL 保留查询参数并转向新入口；普通 `/execution` 不变。
- 本轮只改变页面归属和链接，不补造报告值、不改变证据身份与 Bridge 读取路径。工作树有其他未提交改动，本批未部署 5173、未提交或推送。
- 本批回归：Vitest **1070 passed / 8 skipped（95 files）**；`contracts:check`、`docs:check`、`deps:check`、`typecheck`、`lint`（2 条 warning）、`build`、`git diff --check` 通过。证据深链/失配/缺失、独立入口、帮助目录的定向 Playwright **6 passed**；执行页浅色快照及深色快照按页面归属变化重录。全仓 `format:check` 仍因其他既有/并行文件不合规而失败，本批文件单独检查通过。深色执行页旧用例的执行页快照已通过，但继续到实验配置页时检测到对比度违例（不在本批证据页范围，尚未归因）；全量 E2E 未跑。

## 2026-09-23 小拓引导与结果教学（工作树，未部署）

- 侧栏空会话询问「配置实验／分析实验结果／学习怎么看结果」。配置入口进入当前工作台的实验配置页；轻量工作台首页若带当前 run，分析入口先导航到该 run 的结果页，待报告载入后自动整理。教学解释 TTFT、TPOT、P99、吞吐与证据可信范围。自然语言的结果分析和教学问题也走这条只读路径，不创建运行、不写配置、不调用模型 Provider。
- 分析守卫核对路由 run、报告 run 与 artifact manifest 身份，轻量与专业工作台分别读取各自 store；拒绝内置示例、旧 run、schema 不支持或不匹配的报告。只引用报告已有值与后端瓶颈/原因/下一步原文，缺失值不补零、不将验证完整度视为准确率，也不将合成一致性视为真实验证。本地字段路径是报告内定位提示，不冒充正式 Evidence Agent citation。
- 用户可在结果载入后重新提问；现有对话随页面上下文变化按原规则标记过期。此节仅说明本地工作树，尚未部署到 5173。

## 2026-09-24 前端视觉收口（工作树，未部署）

- 轻量工作台首页补充三步实验流程（配置、运行观察、结果分析），空状态与最近运行卡片共享同一层级和进入动效；运行中状态点增加低频脉冲，尊重 `prefers-reduced-motion`。
- 全局交互补充独立的 `--motion-interaction` 时长，按钮、卡片、导航和小拓侧栏的悬停/开合反馈不再依赖门禁用的颜色过渡时长；专业工作台的结构与证据语义未改变。
- 本轮只做表现层改动，未新增模拟数据、图表或美术素材；已检查浅色/深色、助手侧栏和窄桌面路径。当前工作树仍未部署到 5173。

### 2026-09-24 专业工作台状态组件视觉收口（工作树，未部署）

- 证据范围提示、演示数据提示、状态标签与 `AvailabilityBadge` 统一为带语义边轨、层级文字和轻量入场/悬停反馈的状态组件；服务告警、范围说明和运行范围提示采用同一组边框/阴影节奏。小拓输入区补充桌面端式聚焦、提交与停止反馈。
- 具体时长使用独立 `--motion-interaction`，不改变 `--motion-fast` / `--motion-base` 的 0ms 约束；所有新增动画在 `prefers-reduced-motion` 下压平。未改变报告字段、证据语义、数据来源或运行流程；未生成额外插画素材（这些组件的视觉任务是语义状态表达，不需要装饰性图像）。
- 本轮验证：Vitest **1070 passed / 8 skipped（95 files）**、`vue-tsc --noEmit`、`vite build`、`git diff --check` 通过；定向 dashboard motion/P99 与 L6 小拓引导/轻量闭环 E2E **4 passed**。未部署 5173，未执行 run、Provider、commit 或 push。

### 2026-09-24 专业概览宽屏布局与结论区（工作树，未部署）

- 宽屏主容器由居中 1560px 改为侧栏后左对齐、最多 1760px（含左右内边距）。2166px 实测：内容起点 x=439 → x=240，内容宽 1496px → 1696px；1100px 窄桌面和宽屏小拓停靠态均未出现文档横向溢出。
- 概览「后端结论」由重复技术字段标题改为单一中文标题，`cause` 与 `next_action` 仍作为后端原文字段逐行显示；缺失 badge 与其说明保持不变。不改报告、证据状态或指标计算。
- 门禁：`vue-tsc --noEmit`、改动文件 ESLint/Prettier、`vite build`、`docs:check`、`deps:check`、`git diff --check` 通过；定向 Vitest **54 passed**；概览首屏与 reduced-motion E2E **2 passed**。深色外观 E2E 的可访问性/溢出断言已通过，但旧的 execution 全页图片快照在 1440px 下尺寸 1898 → 1906、像素差异 4% 而失败；该用例并非概览页，本轮未改写既有快照。4173 仅作独立视觉检查，未触碰 5173；未部署、commit 或 push。

## 2026-09-19 仓库与基线更正（**优先于下文所有 revision 与测试数字**）

本节由 2026-09-19 的盘点、文档修正与推送处置得出，未改动任何代码、契约或运行态。**下文所有 `HEAD`/revision 表述与门禁数字均为历史记录，读取时以本节为准。**

### git 真实状态与推送处置（2026-09-19）

- **推送已完成**：修复前本地是一条与远端**无共同祖先**的孤儿线（`c303ac2` → `11cef6b`），直接推送会被
  `non-fast-forward` 拒绝。处置方式是**把重建线以新提交接回 `origin/main` 主线**，全程快进、**未使用 `force`**：
  - `515e39d` `chore(recovery): reintroduce locally rebuilt work tree onto origin/main` —— 树 = 原 `11cef6b` 的树，**逐字节相同**；
  - `7c477d1` `docs(handoff): correct stale revision refs and drop leftover conflict markers`；
  - 结果：`origin/main` 由 `4d7f9fa` **快进**到 `7c477d1`，随后本节所在的文档修正提交继续追加在其后；
    历史始终是一条直线，**未使用 `force`**。
- **重建线的原始提交未丢**：`11cef6b`（含其父 `c303ac2`）已作为远端分支 `recovery/orphan-main-11cef6b` 推送保留，
  因此在远端**仍可解析、仍可追溯**。
- 接回前已核验差异（相对 `4d7f9fa`）：**100 新增 / 78 修改 / 4 改名 / 0 删除**，`+26033 / −597`；
  删除行均为有意改动，**无换行符污染**（`.gitattributes` = `* text=auto eol=lf`）。工作区文件零丢失，
  接回前后 `git status` 均为 clean、工作区内容未发生任何变化。
- **历史事故本身（背景，2026-09-18）**：本机 `.git` 对象库被外部清空。**已发布的远端历史未受损**
  （`4d7f9fa` 一直可解析，其树含 636 个受跟踪文件）。**永久丢失且不可恢复**的是当时尚未推送的 3 个本地提交
  `446f21d` / `290d1c8` / `9b2d39b`：已实测救援目录 `C:\Users\mapanwang\_tilesim_rescue`，
  `tilesim-web-backup.git` 只含 `refs/heads/main = 11cef6b`（恢复之后才建立的镜像）、`dotgit_backup/.git` 不含任何 ref，
  **两处备份都没有这三个提交**。这三个提交的**内容**已随工作区快照一并进入远端，只有提交边界与提交信息不可恢复。
- `git worktree list` 现只剩 `D:/tileSim-web`；其余 `origin/codex/*` 分支引用仍在。
- 后端仓库 `D:\tileSim` 未见同类问题（本地领先其 `origin/main` 2 个提交、有共同祖先）；**本轮未推送后端**。

### 文档卫生

- 本文件此前残留两个合并冲突标记（`>>>>>>> Stashed changes` 与 `<<<<<<< Updated upstream`），已随本节同一批次清除；
  它们也是本文件唯一的 prettier 不合规来源。紧随本节的「双工作台方案状态」与「Phase 2D handoff」两节来自当时的
  stash 侧内容，属**历史阶段记录**。
- 以下文件引用了**已不可解析**的提交号 `446f21d` / `290d1c8` / `9b2d39b`，应作为历史证据阅读，**不要**用它们做
  `git` 定位：本文件、`AGENTS.md`、`docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`、
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`、`docs/F9_AGENT_ORCHESTRATION/` 下的 `01`、`12`、
  `14` 与 `README.md`，以及归档的 `docs/archive/plans/F9_PHASE2C_WORK_PACKAGE_PROMPTS_2026-09.md` 和
  `docs/archive/agent-orchestration/phase-records/` 下的 `21`、`22`。
  其中 `4d7f9fa`（`origin/main` 在 2026-09-19 之前的位置）与 `11cef6b`（恢复线）**仍可解析**，可以照常使用。

### 2026-09-19 实测门禁（本机，工作树 clean；测量点在重建线上，接回 `origin/main` 只新增文档改动，未触碰代码与契约）

| 门禁                                              | 实测                                                                                                               | 本文下文历史值                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Web Vitest（`vitest run`）                        | **721 passed / 8 skipped，79 files**                                                                               | 596 / 8，70 files                                     |
| Bridge `python -m unittest test_server.py`        | **Ran 143 tests / OK，exit 0**                                                                                     | 143（一致）                                           |
| `generate-contract-types.mjs --check`             | exit 0                                                                                                             | —                                                     |
| `generate-bridge-client.mjs --check`              | exit 0（既有 `unknown format "date-time"` 为提示，非错误）                                                         | —                                                     |
| `check-doc-links.mjs`（`docs:check`）             | exit 0，**62 篇活跃 Markdown**                                                                                     | 43 篇                                                 |
| `check-frontend-dependencies.mjs`（`deps:check`） | exit 0，**290 源文件**                                                                                             | 255                                                   |
| `vue-tsc --noEmit`                                | exit 0                                                                                                             | —                                                     |
| Playwright 全量 e2e                               | 见下节「2026-09-19 全量 e2e 复跑」：**63 passed / 6 skipped / 0 failed，全部 69 条已覆盖**，但**非单次干净 tally** | 57 条（49 passed / 1 failed / 6 skipped / 1 not run） |

- Vitest 必须用**原始 PATH** 运行：前插 `/usr/bin:/bin` 会让 GNU tar 遮蔽 bsdtar，使
  `tests/oracles/phase0d-evidence-reproducibility*` 出现唯一红灯（本轮原始 PATH 下为 5/5 绿）。
- 本机无 C++ 工具链且 `wsl.exe` 被安全策略阻断，后端 CTest 与后端构建门禁一律 `not-run`。

### 运行态

- `127.0.0.1:5173` **未监听**（2026-09-19 实测 `listening=False`）。当前没有工作台服务在运行；
  部署与启停仍只能由人工执行，未获授权不得操作。

### 2026-09-19 全量 e2e 复跑与 `l5-lightweight-a11y.spec.js:82` 就绪性缺陷

本轮复跑**未取得单次干净 tally**，但把 2026-09-18 挂账的「1 条失败未定性」判清了，并新发现且修复 1 条就绪性缺陷。
本节只读复跑 + 1 处测试修复，未触碰产品代码、契约或运行态。

- **套件规模已变，旧基线不可直接相减**：`--workers=1 --reporter=list` 现报 `Running 69 tests`。
  2026-09-18 的 57 条基线**早于轻量工作台批次**：`l5-lightweight-a11y.spec.js`（5 条）、
  `l6-lightweight-closure.spec.js`（6 条）、`topology-editor.spec.js`（1 条）共 **12 条**当时尚不存在。
- **2026-09-18 挂账的 `dashboard.spec.js:457` 本轮两轮均通过、未复现**（整轮第 9 条，1.4s 量级）。
  该用例「`setViewportSize` 之后直接测量、无可重试前置断言」的隐患仍然存在，但本轮不构成失败，
  **未改动**，继续挂账观察。
- **新发现并已修复：`tests/e2e/l5-lightweight-a11y.spec.js:82`「shared Agent dock reserves the lightweight work
  surface on narrow desktop widths」**。首轮失败于 `expect(bounds.panel).not.toBeNull()`（取不到 `.agent-copilot-shell`）。
  根因是**测试就绪性缺陷，不是产品回归**：`src/features/agent-copilot-shell/AgentCopilotEntry.vue` 第 60-62 行以
  `import("./AgentCopilotShell.vue")` **懒加载**侧栏，模板第 158 行 `v-if="shouldMount"` 决定其**只有懒加载 resolve
  之后才进入 DOM**（在此之前只有 `.agent-copilot-entry__loading` 占位）。用例点完「打开 TileSim 助手」**立即**
  `page.evaluate` 测量，中间没有任何自动重试断言 → 抢跑。失败快照同时显示侧栏**已正确渲染**
  （含 `separator "调整助手侧栏宽度"` 与收起/展开/关闭按钮），证明产品行为本身正确。
  修复方式与同文件 `:415` 的「先等后测」一致：`click()` 之后加
  `await expect(page.locator(".agent-copilot-shell")).toBeVisible();`（**仅 +3 行，未放宽、删除或跳过任何既有断言**）。
  修复后该条通过（耗时 1.3s → 4.3s），并**解开了整轮**：其后 `l6-lightweight-closure` 全部 6 条（此前从未在整轮中
  跑到）均通过。
- **本轮 tally（同一代码状态，2026-09-19）**：
  - 运行 A：`test --workers=1 --reporter=list` → **62 passed / 6 skipped / 0 failed**（warmup 1 条 + `desktop` 67 条中
    61 passed + 6 skipped，共 68 条已跑到），`exit 1`。**exit 1 的唯一原因是已知 worker 收尾卡死**
    （`worker-1 process did not exit within 300000ms after stop, force-killed it`，落在 `desktop` 项目收尾处），
    导致 `large-artifact-worker` 那 1 条 `not-reached`，主进程随后挂住需人工终止；**没有任何用例失败**。
  - 运行 B（补齐未覆盖项）：`test --project=large-artifact-worker --no-deps --workers=1 --reporter=list` →
    **1 passed，exit 0**，无卡死。
  - 合计 **63 passed / 6 skipped / 0 failed = 69/69 全覆盖**。⚠️ 这**不是**「一次干净的全量 tally」：第 69 条由
    **单 project 复跑**补齐（`desktop` 依赖已在同一代码状态的运行 A 中全绿，故用了 `--no-deps`）。按既有口径
    `not-reached` 不得当作通过，因此**只能记为「全覆盖但非单次干净 tally」**。
- **worker 收尾卡死的追加观测**：卡死两次分别出现在「有失败产物待采集之后」与「`desktop` 项目收尾处」。
  其与用例失败的相关性**尚未定性**，但**不是**本轮改动的产物：运行 A 的失败在 `tests/e2e/**`（与产品代码无关），
  运行 B 零失败且收尾干净。
- **本机运行前提**：`pnpm` 不在 PATH，而 `playwright.config.js` 的 `webServer.command` 是 `pnpm dev`；
  因配置为 `reuseExistingServer: true`，**先在 4173 起 Vite fixture 再运行 Playwright** 即可绕过，无需安装 pnpm。
- 失败产物已复制到仓库外留存：`C:\Users\mapanwang\_tilesim_rescue\e2e-failure-20260919-1316`
  （`error-context.md`、`test-failed-1.png`、`trace.zip`）。

## 双工作台方案状态（历史方案记录；2026-09-19）

本节保留轻量工作台在 2026-09-19 的产品与验收记录，**不是当前代码或路线的事实来源**。原产品基线已归档至
`docs/archive/plans/LIGHTWEIGHT_WORKBENCH_IMPLEMENTATION_PLAN_2026-09-13.md`，当前页面、路由和 feature 清单以本文件顶部、
`docs/README.md` 与 `getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md` 的代码复核为准。历史记录中的 fixture 只证明当时的
UI/路由/状态机/契约映射，不构成 Provider、live、calibration、held-out 证据。

L6R 后续 UI remediation 已完成 P0/P1/P2/P3（**历史记录；轻量页面随后已从当前代码移出**）：`/lightweight` 负责开始/继续，`/lightweight/prepare` 直接承接新建实验，独立“任务”和“学习”入口已从主导航移除；旧 `/lightweight/tasks` 仅兼容重定向到配置页，旧 `/lightweight/learn` 仅兼容重定向到轻量首页，并且只携带合法工作台 query。教程、字段解释和证据边界收敛到右上角“页面帮助”；轻量版和专业版复用帮助基础设施，但 topic、搜索分组和路由定位按 workspace scope 完全分域，任何一侧都不得显示或跳转到另一侧的帮助主题。运行页突出后端状态、下一步动作和恢复元信息，结果页按结论→证据→细节展示并保留 resolved fidelity、provenance、artifact/schema 身份。首页已移除教程式副文案，主流程只保留状态、证据和可执行动作。fixture 桌面 E2E 已恢复为可执行用例，验证提交、状态推进、刷新恢复、artifact 校验、合法 0 与 missing、失败边界和专业版往返；当前全量 frontend（639 passed/8 skipped）、Bridge（91 tests）和完整桌面 fixture E2E（63 passed/6 skipped）门禁通过，skipped 项均为 live deployment/Provider 能力相关，fixture 仍不构成 live/calibration/held-out 证据。

轻量 run/results 深链统一等待共享 Bridge manifest/schema bootstrap；bootstrap 失败时 fail closed，不在缺少 manifest/schema 上下文时走 legacy evidence 读取路径。共享 readiness promise 会去重 App shell 与页面自身的并发 bootstrap 请求。

专业版现有的同一个右侧 `TileSim 助手` 现复用于轻量工作台，不新增第二套 Agent UI、会话或请求链。轻量配置页通过 `run-experiment` 公共 adapter 发布当前 descriptor/页面目录允许的字段和当前页面上下文，轻量运行/结果页只从合法 run 路由或 query 建立 run context；模式切换时保留同一助手状态，但旧页面 context 必须失效并替换。配置草案仍不写入表单、不自行创建 run；结果页只读分析可使用独立模型通道并在失败时回退本地证据整理。助手本地会话是有限期、可删除的可见缓存，不是服务端 Conversation store；不把 synthetic/fixture 证据升级为 live、calibration 或 held-out。

本轮在专业版和轻量版的 JSON 输入模式中加入 canonical topology request 可视化编辑器：设备节点可拖动调整前端布局，连接模式支持点选或拖拽创建显式 `links`，边属性可编辑/删除，domain 成员关系以只读虚线展示；`links` 按当前后端 `LinkSpec` 语义表示无向物理连接，前端不绘制方向箭头，也不允许同一 domain 的反向重复边；布局坐标不会写入提交 JSON，未实现设备/domain CRUD，也未修改 Bridge、schema、Profile registry 或 API surface。拓扑专项单元/组件测试为 29/29 passed，新增 desktop pointer E2E 通过（含拖动、建边、反向重复保护、属性编辑、删除和无 `x/y` 断言）。

## Phase 2D handoff

- 新增 `bridge/contracts/agent_orchestration_phase2/registry.py` 与 registry tests；它独立于 v1 Capability Catalog，发布五类 source-backed Profile v2 record、snapshot 和完整 binding。
- 所有记录均 `runtime_status=unavailable`、`agent_exposed=false`、calculator/ranking 不可用；校准和 held-out 缺失，Phase 2C lowering 继续 fail closed。
- registry 校验 source/license/regime、字段 provenance、生命周期、visibility/sensitivity、canonical digest、revision drift 和 stale snapshot；不得把 synthetic/compatibility 记录升级为真实校准证据。
- Phase 2D/2E handoff 本身不新增 calculator、Agent orchestration receipt UI、RAG、多轮、审批、Workflow、SSE/cancellation；不操作 5173、不读取 credential、不调用 Provider、不创建正式 run。当前拓扑图编辑器属于 S6 JSON 输入工作台，不改变该 Phase 2 边界。Phase 2E 不启动。

## 1. 必读

1. `AGENTS.md`
2. `docs/README.md`
3. 本文件
4. `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`
5. 当前模块 contract、公共入口和 tests

`docs/archive/` 只用于追溯，不是当前事实来源。Agent 编排模块的阶段记录（Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、
Phase 2B 发布）已归档到 `docs/archive/agent-orchestration/phase-records/`。

## 2. 当前代码事实

- Vue 前端、Python Bridge、OpenAPI/JSON Schema、generated contracts、fixture/E2E 和 immutable release 工具均在本仓库。
- 完整仿真运行仍依赖独立 TileSim 后端仓库；bootstrap 可自动克隆。Evidence Agent 外部模型为可选配置。
- Web 集成交付、部署可移植性修复和对应回归已进入公开 `origin/main`；本仓库 `HEAD == origin/main ==`
  `4d7f9fa3c330b7d6f287d12da853ec2bf481b0cb`。
- 后端本地 `main` 为 `ba11e6fdb69af046dc7597e5ef5732cce029cfbe`（含 Phase 2C 与 dense timing）；后端公开
  `origin/main` 仍为 `7b2b1cff52fdab21575609be170c3856f120120b`，即后端本地领先 2 个提交、尚未 push。
  Capability Catalog 引用的不可变证据 revision `7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由该公开仓库解析，
  并保留在公开 `codex/phase0d-backend-evidence-clean` 分支。
- 公开发布状态为 `published_clean_clone_verified`。2026-09-11 从 GitHub 全新克隆 Web 与后端后，完整 bootstrap 在
  `-NoRestart` 模式通过（该次为后端 63/63 CTest、前端 506 passed/8 skipped）。这是**带日期的历史证据**；完整部署仍必须
  保留后端 evidence revision gate。
- 2026-09-18 本轮实测门禁（含工作树未提交的 WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06、WP-2D-01 与 WP-2D-04）：
  Web Vitest **595 passed / 8 skipped**（70 files）、Bridge `unittest` **143 passed**、`vue-tsc` / `eslint src tests
scripts bridge` / `vite build` / `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255 源文件）/
  `git diff --check` 全部 passed。**Playwright 全量首次取得干净 tally**：
  `node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，
  exit 0，7.1m，无 worker 强杀**；6 条 skipped 全部是 `live-week8.spec.js` 的 deployed-Bridge 用例（需部署环境）。
  `dashboard.spec.js:2079` 在定向 ×3 与全量 ×1 下**全部通过**。
  此前「全量 2079 变红 + worker 卡死」的红已定因为 `src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，登记为
  **`DEF-BUSY-RACE-001`**，**已由 `WP-2D-04` A 部修复并关闭**（认领令牌：`state.busy` 全仓唯一写点收敛到
  `dashboard-state.ts:63`）。完整分析与验收判定见覆盖度文档 §6.1.2 / §6.4.1。`eslint .` 仓库级 10 条错误全部落在
  **未跟踪**的 `output/playwright/*.js`（用户草稿）。后端 CTest 与 fixture Playwright 全量本轮未复跑
  （本机无 C++ 工具链），必须标记为 `not-run`。本仓库 `HEAD` 仍为 `4d7f9fa`，以上改动尚未提交。
- **2026-09-18 `WP-2D-05` 后的复测（须与上一条一起读；门禁数字已更新）**：Web Vitest **596 passed / 8 skipped**
  （70 files，+1 = 本包新增用例），`vue-tsc` / `eslint src tests scripts bridge` / `prettier` / `vite build` /
  `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255）/ `git diff --check` 全部 0，Bridge 143 不变。
  **e2e 再次取得干净 tally**：`--workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，exit 0，6.4m，
  无 worker 强杀**，覆盖全部 57 条（含 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`，`ok 57`）。
  **worker 收尾卡死是间歇性既有环境缺陷、未根除**：同一会话另有 3 次运行在用例全部零失败后出现
  `worker-1 process did not exit within 300000ms after stop, force-killed it`，其中 1 次是把 `WP-2D-05` 的改动
  **逆操作回退**后跑的 A/B 对照（现象完全相同，回退已实测 `renderStatusCell = 0` / `lib/format = 0` / 旧表达式复原）
  → **与代码改动无关**。卡死落在 `desktop → large-artifact-worker` 项目切换处时，那 1 条会 `not-reached`，
  必须另起一次完整运行覆盖，**不得把 `not-reached` 当作通过**。
  **纪律**：全量 e2e 不得与其它重量级门禁并发跑——并发时曾出现 `dashboard.spec.js:2079` 的
  `toHaveURL(/\/metrics\?run=run-fixture-f1$/)` 偶发失败（收到 `/metrics`），空载定向 ×3 全部 `ok` / `EXIT=0`。
- **2026-09-18 发布批次（本文件的新口径）**：指挥方在同一会话内授权了**发布**与**契约变更窗口重开**两件事。
  工作树中已验收但未提交的 7 个工作包（`WP-2C-01a/01b`、`WP-2C-02` 服务层、`WP-2C-06`、`WP-2D-01`、`WP-2D-04`、
  `WP-2D-05`）连同文档与契约生成物**已在本地完成提交**，共 3 个提交：`290d1c8`（Phase 2C 契约与预览路由）、
  `9b2d39b`（工作台 C0 覆盖度 + 两处缺陷收口）、`446f21d`（文档与仓库卫生）。**但推送未完成**：本机对
  `github.com` 的出口被网络策略阻断（系统代理 `127.0.0.1:56943` 对 `CONNECT` 返回 502；绕过代理直连为
  `Connection was reset`；沙箱内外结果相同，连只读的 `git ls-remote` 也失败）。因此 `origin/main` **仍停在
  `4d7f9fa`**，本地领先 **3 个提交未推送**；后端仓库（`D:\tileSim`）本地领先其 `origin/main` 的 **2 个提交**
  （`8839b969` Phase 2C lowering、`ba11e6fd` merge）同样**未推送**。恢复网络后须由人工在两个仓库各执行一次
  `git push origin main`。契约方面：本次提交的契约文件全部来自**已验收的 `WP-2C-01a/01b`**（2 个新 Schema 加
  `openapi.json` / `manifest.json` / `bridge-api.schema.json`），使 `SCHEMA_SET_REVISION` 由
  `sha256:518f4da9…e43ece`（86 json）变为 `sha256:d498092a…abffab`（88 json），两个值均已按
  `bridge/server.py:135-144` 的算法独立复算；**重开后的窗口尚未被任何工作包使用**（`WP-2D-02` 与 `WP-2C-02a`
  都还没动契约文件）。发布前门禁见下一条。
- **2026-09-18 发布前门禁实测**（本机，`HEAD` 为 `4d7f9fa` + 上述工作树改动）：Web Vitest **70 files /
  596 passed / 8 skipped**、Bridge `unittest` **143 passed / OK**、`py_compile` 通过、`vue-tsc --noEmit`、
  `eslint src tests scripts bridge`、`vite build`（2760 modules）、`contracts:check`、`docs:check`（43 篇）、
  `deps:check`（255 源文件）、`git diff --check` 全部 exit 0。**`prettier --check` 对全部待发布文件有 2 条既有
  不合规**：`bridge/contracts/agent_orchestration_phase2/manifest.json` 与
  `bridge/contracts/schemas/bridge-api.schema.json` —— 已核验其 `HEAD` blob 与工作树逐字节一致且 `HEAD` 版本同样
  不合规（`git hash-object` 与 `git rev-parse HEAD:<path>` 相等），即**属既有状态、非本批次引入**；按 AO-24
  「禁止顺手修 phase2 的 `*.json`」的既有口径**未修**。全量 e2e 结果见下一条。
- **2026-09-18 全量 e2e 实测（本批次唯一未通过的门禁项）**：`--workers=1 --reporter=list` 完整跑完 57 条，
  **49 passed / 1 failed / 6 skipped / 1 did not run，exit 1，6.8m**。6 条 skipped 仍是 `live-week8.spec.js` 的
  deployed-Bridge 用例。1 条 did-not-run 是 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`：该项目
  `dependencies: ["desktop"]`，而 `desktop` 项目出现失败，故整个依赖项目未运行（**不得当作通过**）。
  唯一失败是 `tests/e2e/dashboard.spec.js:457`「overview keeps a usable first-viewport comparison and keyboard
  route round trips」：`page.locator(".overview-domain-list tr").first().boundingBox()` 返回 `null`，随后
  `bounds.y` 抛 `TypeError`。该断言**紧跟在 `setViewportSize` 之后、没有任何自动重试断言前置**；同文件 `:415`
  的写法不同（先 `await expect(...).toHaveCount(6)` 再测量），而**同一次运行中 `:415` 通过**。
  已核实该用例**在本批次前后都位于 `dashboard.spec.js:457`，本批次对该文件只有 1 处 4 行改动（`:2744` 的 C0-7
  `expected_absence` 文案断言），与本用例无关**；失败时的页面快照也显示「通信域观测」表格及其 `scale-up` 行已渲染，
  说明选择器与数据侧本身正常。**此前 `WP-2D-05` 验收时同一代码曾取得干净 tally（51 passed / 6 skipped / 0 failed），
  本轮未能复现。** 失败后连续 3 次隔离复跑（含 `--repeat-each=3`）**均在零输出状态下被强杀**：Playwright 在非 TTY
  下 stdout 全缓冲、SIGTERM 时缓冲被丢弃，故隔离结果无从判定；同时 `test-results/` 已被后续运行清空，失败产物不可回收。
  **因此本批次 e2e 门禁的结论是：49/57 通过，1 条失败未定性（flake 与回归未区分），不得记为通过。**
  待处置：环境稳定后补一次干净的全量 `--workers=1` 运行；若仍复现，按「`:415` 同款前置自动重试断言」的写法
  单独判定是测试就绪性缺陷还是产品回归（**不得为让用例变绿而放宽、删除或跳过既有断言**）。
  **2026-09-19 处置**：上述待处置已执行 —— 该条本轮两轮均通过、未复现，**未改动**；同轮另在
  `l5-lightweight-a11y.spec.js:82` 发现同类的就绪性缺陷，按其写法修复。见本节上方的
  「2026-09-19 全量 e2e 复跑与 `l5-lightweight-a11y.spec.js:82` 就绪性缺陷」。
- **契约变更窗口已由指挥方于 2026-09-18 显式重开**：本条取代本文件 §2 上文以及 AO-23 §4、AO-24 §8 中
  「窗口已关闭、后续工作包不得再动 `bridge/contracts/**/*.json`」的表述（那两句是当时的裁决记录，不再具约束力）。
  重开后 current live `sha256:d498092a…abffab` **必然作废**。随窗口一并解锁：`WP-2D-02`（C1 采集四个运行期
  工件与 C2 报告 Schema 加固，本仓库）与 `WP-2C-02a`（后端 issue serializer 补全，仓库 `D:\tileSim`）；两者仓库与
  文件集合不相交，可并行派发；`WP-2C-02a` 是 `WP-2C-02b`（端点接线）与 `WP-2C-05`（三个 lowering 标志分开
  显示）的唯一前置。**`WP-2D-02` 的步骤 0 只读探针已完成**，结论见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2.1：是非题为**「不会」**（标准配置下
  `runtime_event_trace` 的 state 恒为 `ready`；39/39 条历史 run 的 `has_runtime_event_trace` 全为 `true`，
  `false` 计数为 0），**但**引入「range 起于 S0/S1 且轨迹不可用 ⇒ 整条 run `exit 1`」的新失败面，
  `WP-2D-02` **必须按方案 B**（接受新语义 + 写成 Bridge 可见事实 + 补锁死测试）显式处理，不得静默接受。
  窗口重开后的首张契约变更必须由单一集成 owner 连同全套级联（`src/contracts/generated/**`、Bridge client、
  各文档 revision 表述）一次性处理。
- **指挥方的数据侧决策（2026-09-18）**：**真实 Profile 数据目前不可得** —— 原话为「目前没有从真实的显卡中
  采集到的数据」。因此 `GAP-PROFILE-SUCCESSOR-001`（`blocked_data`）与 Phase 2 的数据侧/执行侧**继续被阻塞**，
  五类 records 维持 `0/unavailable`，执行侧 fail closed 仍是正确结果。**不得**用规格书参数、宣传峰值、
  LLM 常识或前端静态 JSON 替代真实采集数据；`WP-2C-03/04/05` 与 `WP-2D-03` 在此前提下只能做 fail-closed
  接收与呈现。
- Phase 0D 已发布 Capability Catalog/Profile Schema v1；八个 `agent_exposed` 字段有 execution closure，五类真实 Profile
  仍为 `0/unavailable`，没有 calibration 或 held-out validation。
- Phase 1 正式 capability projection 仍是八字段本地草案边界；当前工作树另有受页面目录约束的模型配置建议和只读结果分析通道。两者都不创建 run、不绕过页面/Bridge 校验；模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信算法和 SLO 在没有后端正式能力时继续 fail closed。
- Phase 2A 的隔离候选已由 Phase 2B 正式发布并提交。契约包位于 `bridge/contracts/agent_orchestration_phase2/`，含
  五类 Profile v2、Profile Binding v1、Run Intake v2、Validation Report v1、Calculator Receipt Envelope v1、七类 typed
  receipt identity 与幂等/留存 policy；`package_revision` 为
  `sha256:59373c713f9570db857fabed29ff078e9458f7eeb28f8d559936cc95a3ecc8b6`。
- 2B 的接线范围**只到契约层**：该包只被 `bridge/contracts/openapi.json`、`bridge/contracts/schemas/bridge-api.schema.json`
  与生成物料引用；当初没有任何 Bridge service 导入其 validator。包 manifest 自报 `runtime_status = contract_only`、
  `create_run_acceptance = not_accepted_by_current_api`，五类 `profile_records` 全部为空，包内也没有 `registry.py` 与
  测试源文件（仅有过期 `__pycache__` 残留）。**该形态已被 WP-2C-01a/01b 部分取代**，见下一条。
- WP-2C-01a/01b（工作树未提交，`D:\tileSim-web`）补上了 Phase 2C 的第一条 Bridge 路由，但只做**校验与判定**：
  新增 `bridge/contracts/agent_orchestration_phase2/registry.py`（复用 `validator.py` 的 `IDENTITIES` /
  `validate_contract`，判定码与 `proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json` 的
  12 scenario / 6 expectation / 9 错误码一一对应）与 `bridge/services/run_intake.py`，经 `bridge/server.py` 的
  `POST /api/agent/run-intake-preview` 暴露。被拒判定是判定结果而非错误：**HTTP 200 + typed body**
  （`judgement.accepted = false`）；错误信封只保留给 400（信封非法/不可判定）与 503（契约或 Profile 记录不可读）。
  包 manifest 新增 `run_intake_preview` 块，`runtime_status = read_only_preview_registered`、
  `write_capability = absent`、`run_creation = not_performed`、`backend_lowering = not_wired`；
  **包级 `runtime_status` 仍为 `contract_only`**。
- 该批次改动了 `bridge/contracts/**/*.json`（新增请求/响应两个 Schema），因此 live
  `SCHEMA_SET_REVISION` 由 `sha256:518f4da9…e43ece` 变为 `sha256:d498092a…abffab`，`src/contracts/generated/**`
  已重新生成。`tests/fixtures/phase1-agent-orchestration/*.json` 与 `frozen-current-subset.json` **未被改写**；
  `sha256:3211d2df…c15d` 是 Phase 1 冻结值，与 live 值本就不相等。
  **契约变更窗口已关闭**，后续工作包不得再动 `bridge/contracts/**/*.json`。**（本条已于 2026-09-18 作废：
  窗口已由指挥方显式重开，见本文件 §2 上文 2026-09-18 条目；此处保留原文作为当时的裁决记录。）**
- 后端已完成 Phase 2C：`parse_run_intake_v2` / `lower_run_intake_v2`（`include/Core/RunIntakeLowering.h`、
  `src/Core/RunIntakeLowering.cpp`、`tests/test_run_intake_lowering.cpp`）与只读 CLI
  `validate-run-intake --run-intake <json>` / `run-intake-preview`。后端自评 `partial`，执行侧因五类 Profile records
  为空而 fail closed。**Bridge 尚未调用该 lowering**：上述预览端点只做契约校验与兼容判定，不触达 lowering，
  `/api/runs` 仍只接受 create-run v1。
- **新发现的表示性缺口（2026-09-17 复核，阻塞 Bridge 与 lowering 接线）**：CLI 的 issue 序列化
  （`src/Core/RunIntakeLowering.cpp:253-257`）每个 issue 只输出 `code` / `field_path` / `blocking`（`blocking` 硬编码
  `true`），丢弃 `message` 与 `safe_next_action`；`RunIntakeLoweringResult` 的三个 lowering 标志
  （`workload_lowered` / `execution_lowered` / `runtime_available`）在 stdout 上没有任何出口。而 Bridge 与已发布契约
  的 `backend_issues` 要求五字段齐备且禁止补造，因此当前**没有任何合法方式**把 CLI 输出接进 Bridge 契约。同时
  CLI 用 `exit 1` 表达「被判定为 blocked」并在 stdout 打印 issues JSON——**这是判定结果，不是传输失败**。
  结论：`WP-2C-02` 收窄为服务层调用与失败语义（不接线端点），端点接线另立 `WP-2C-02b`，前置是后端补 serializer
  （**已裁决：走独立后端工作包 `WP-2C-02a`**，见下文「契约窗口重开计划」）或由指挥方重新授权契约窗口；
  `WP-2C-05` 的「三个 lowering 标志分开显示」同样依赖该缺口关闭。
  详见归档的 `docs/archive/plans/F9_PHASE2C_WORK_PACKAGE_PROMPTS_2026-09.md` §4.2 / §4.2.1。
- **工作台展示覆盖度缺口（2026-09-17 审计）**：后端一次 `run` 产出十个规范 artifact 与九段跨层契约链，但
  Bridge 只请求 **7 个报告**；四个运行期工件（`--runtime-events-out` / `--runtime-summary-out` /
  `--runtime-requests-out` / `--runtime-analysis-out`）从未被采集，且 Bridge SSE 只有「运行中/终态」两种事件，
  执行期阶段级进度不可观测。已到达前端的 7 个报告里另有 **36 项字段（另加第 7b 条）已随 artifact 进入 bundle
  却没有任何页面渲染**（含 `partial_artifacts`、`capability_registry`、`contributing_factors`、`error_budget`、
  `pd_disaggregation`、三个 percentile distribution 的 p50/max、`boundary_notes`、
  `run_bound_des_evidence.state_summary` 与逐窗口 `stream_records` 等）。缺口按成本分为四类：
  **C0 纯前端**（零 `bridge/contracts` 改动，可立即开工）、**C1 Bridge 采集**（须改 `openapi.json` 的
  `report_files` / `artifacts`，会改变 `SCHEMA_SET_REVISION`，属已关闭的契约窗口）、**C2 契约面**
  （Bridge 报告 Schema 以 `additionalProperties: true` 兜底，字段展示无契约保障）、**C3 输入面**
  （Run Intake v2 全部字段、工作负载描述语言、provenance 四元、GPU 参与、Cycle 窗口等无编辑入口）。
  审计与 `WP-2D-01` 派发提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`；本轮审计未改动任何契约或代码文件。
- **C0 展示缺口已关闭（2026-09-18 验收）**：`WP-2D-01` 补齐 C0 的 36 项 + 第 7b 条并恢复五态
  `availability` 语义。实现入口 `src/features/report-coverage/`（14 文件，公共出口 `index.ts`，被 5 个 view
  按各自 section 挂载），run-bound DES 证据新增 `Week8StreamRecords.vue`。五态单一来源：新
  `availabilityFor()` 只在 `undefined | null` 时求值，缺失态回落 `adapters/dashboard-view-model.ts:4` 的同一个
  `unavailable()`（该函数本次仅加 `export`，逻辑未变）。**判定与完整门禁见覆盖度文档 §6.1.1 / §6.1.2**：
  34 文件（17 新 / 17 改 / 0 删）、`SCHEMA_SET_REVISION` 保持 `sha256:d498092a…abffab` 未变、
  `bridge/contracts` 与 `bridge/**/*.py` 零改动、未新增 `agent_exposed`、定向 Playwright 7 passed。
  因此 **C2 的「等 2D-01 验收」前置已满足**，`WP-2D-02` 只剩「窗口重开 + 步骤 0 探针」两条前置。
- **契约窗口重开计划（2026-09-17 指挥方裁决）**：C1/C2 的 `WP-2D-02` 与后端 issue serializer 缺口的工作包
  `WP-2C-02a` **合并进同一次契约变更窗口**（仓库不同、文件集合不相交，可并行派发）。派发前提有三条：窗口已由
  指挥方显式重开、`WP-2D-01` 已验收、`WP-2D-02` 的**步骤 0 探针**已有结论。窗口重开后 current live
  `sha256:d498092a…abffab` 必然作废。提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2 / §6.3。
- **C1 的风险性质（不得按「多采集一个文件」处理）**：后端在请求了某 artifact 而其 state 为 `unavailable` 时，
  `write_wind_tunnel_artifacts` 返回 false（`src/Core/WindTunnel.cpp:6414-6419`），
  `src/apps/TileSimCLI.cpp:304-309` 随即 `exit 1`，**整条 run 判为失败**。而 `runtime_event_trace` 在
  `--from S1`（Bridge 当前配置）下的 state 恰为 `has_runtime_event_trace ? ready : unavailable`。
  因此追加 `--runtime-events-out` 等四个开关**可能改变 run 终态语义**，`WP-2D-02` 必须先做只读探针再实现。
  另需注意：state 为 `expected_absence` 时后端写入的是 **artifact 描述符 JSON** 而非工件数据
  （`WindTunnel.cpp:6404-6412`），Bridge 与前端都必须能区分二者。
- Evidence Agent descriptor 保持 `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1。
- create-run 顶层保持 `tilesim.bridge.create_run_request.v1`，nested design-space v1/v2 双版本行为不变。
- F9 live model repetitions 仍为 0；fake/fixture 只证明 contract 和 synthetic consistency。人工 citation entailment 尚未完成。

Agent 编排模块的当前状态见 `docs/F9_AGENT_ORCHESTRATION/README.md` 与
`docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md`；下一批工作包见
归档的 `docs/archive/plans/F9_PHASE2C_WEB_INTEGRATION_PLAN_2026-09.md`。已归档的阶段记录在
`docs/archive/agent-orchestration/phase-records/`。

## 3. 不可破坏边界

- 不 reset、clean、覆盖用户未提交改动；没有授权不 commit/push。
- `127.0.0.1:5173` 是用户服务；没有明确部署授权不停止、不重启、不替换。
- 不读取或输出 `TILESIM_EVIDENCE_AGENT_*` 的值，不把 credential 写入仓库、日志或命令行。
- 前端不得重算模拟指标、补造 claim、升级 provenance/fidelity 或用 fixture 关闭 live/calibration/held-out Gap。
- uint64 ps/bytes/count 保持无损；requested/resolved fidelity 分离；资源语义模块保持并列；正式 citation 绑定 run/artifact/schema/SHA/Pointer/stable subject。
- Evidence 两类 409 都锁定原 key，只有显式 discard 才能开始新分析；不得自动重新调用 Provider。

## 4. 代码地图

```text
src/app/                         Router 与装配
src/contracts/                   Bridge/report contract 与 generated code
src/adapters/                    versioned payload -> stable view model
src/entities/agent-*/            Agent 本地 typed domain/context
src/features/agent-*/            Copilot Shell、intent compiler 与集成
src/features/run-experiment/     descriptor 表单和唯一 request builder
src/features/evidence-agent/     正式 Evidence Agent 展示与提交编排
src/views/                        页面编排
bridge/contracts/                OpenAPI、Schema 与正式校验
bridge/services/                 执行、capability、Evidence workflow
bridge/providers/                固定 Provider adapter
scripts/                         bootstrap、构建、部署、回滚和启动
tools/launcher/                  可选 Windows GUI 启动器源码
docs/F9_AGENT_ORCHESTRATION/     Agent 编排 current baseline、Gap、路线和验收
docs/archive/                    历史记录
```

## 5. 部署事实

- Web checkout 可位于任意 Windows 目录；脚本不得写死本机用户名或盘符。
- `scripts/bootstrap-workbench.ps1` 是干净 clone 的入口。
- 默认后端源码和 deployment worktree 是 Web checkout 的同级 `tileSim/` 与 `tileSim-backend/`，均可通过参数覆盖。
- Windows GUI 启动器由 `tools/launcher/build-launcher.ps1` 构建到 Web 根目录的 `启动TileSim工作台.exe`；
  frozen launcher 从 EXE 所在目录定位 checkout，WSL build cache 同时绑定 revision 与 deployment 源码路径。
- `runtime/`、`runs/`、`dist/`、`node_modules/` 都不进入 Git。
- 部署脚本使用 immutable `bridge + dist` snapshot；health 必须绑定 source/build/release/schema identity。

## 6. 当前优先级（2026-10-24）

1. 维护阶段 5 local-dev 优化/批处理的 bounded、人工批准和 fail-closed recovery 语义；任何预算、lease、SSE、重试或
   人工介入改动，都要同步更新阶段 5 current baseline、Bridge 定向测试和前端 Harness 测试。
2. 保持 `2026-10-19.wpd.v1` / `2026-10-19.wpe.v1`、generated client 与当前 schema-set revision
   `sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e` 一致；正式 contract 变更前先取得发布授权。
3. 五类 Profile records 继续为 `0/unavailable`；Run Intake v2 继续是只读预览，不得把 local-dev synthetic 结果描述为真实硬件、
   calibration、held-out validation 或生产 GO。
4. 启动器部署仍以后端 CTest 为硬门禁；最近的 `route_unavailable` 失败必须先修复后端 topology/domain/participants 路由匹配，
   或恢复已验证版本，不能跳过 CTest 或替换已验证部署。
5. 活跃文档只保留当前基线和未结束规范；已结束阶段、旧计划和已移除轻量工作台材料继续放在 `docs/archive/`，不要把历史数字当当前门禁。

### 历史路线快照（2026-09-19；仅供追溯）

1. 推进 Phase 2C Web 集成：把已发布的 Run Intake v2 契约接到 Bridge 与后端 lowering 之间。第一批（WP-2C-01a/01b）
   已完成严格路由与只读预览，**不创建 run**；下一批是 `WP-2C-02`，只交付 **Bridge 服务层**的 lowering 只读调用与
   失败语义（须遵守 Week 7 单槽约束：调用方注入同一把锁，`acquire(blocking=False)` 失败即容量已满）。**不接线端点**，
   因为已复核出后端 CLI 的 issue 序列化只有五字段中的三个（见 §2 的表示性缺口）；端点接线属 `WP-2C-02b`，需先关闭
   该缺口。提示词与验收清单见归档的 `docs/archive/plans/F9_PHASE2C_WORK_PACKAGE_PROMPTS_2026-09.md` §4.2 / §6.3，
   工作包见归档的 `docs/archive/plans/F9_PHASE2C_WEB_INTEGRATION_PLAN_2026-09.md`。
2. 不启动 Profile 数据工作、calculator 实现与 Web receipt UI：Phase 2 的数据侧与执行侧仍为 `blocked_*`。先关闭
   `GAP-PROFILE-SUCCESSOR-001`、`GAP-CALCULATOR-001`、`GAP-VALIDATE-001` 及并行、KV、工作负载、网络的累计执行 Gap，
   再重新审计 DoR。
3. 五类 Profile 真实记录为零时不得用产品名称、公开宣传值、LLM 常识或前端静态 JSON 补造能力；关键 unknown 必须阻塞。
4. 后续正式多轮 Agent 需要 Conversation、Draft、Validation、Clarification、Approval、Workflow、RAG 和工具 contract；
   不要在浏览器内存模拟关闭 Gap。`GAP-CLARIFY-001` 的 answer binding 是当前唯一不依赖新契约即可闭环的前端缺口。
5. 文档变更继续按 `docs/README.md` 分类；结束阶段时把 dated 记录移入
   `docs/archive/agent-orchestration/phase-records/`，并把仍然有效的结论折进 `AI_HANDOFF` 与模块 current baseline。
6. 与 2C 并行的**不受契约窗口约束**的轨道：`WP-2D-01`（工作台展示覆盖度补齐 · 第一批 C0），只做纯前端渲染
   补齐，不碰 `bridge/contracts/**/*.json`、不碰 Bridge、不新增 artifact 请求，`SCHEMA_SET_REVISION` 必须保持
   `sha256:d498092a…abffab`。范围清单（36 项 + 第 7b 条）与提示词见
   `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §3.1 / §6.1。
   **该包已于 2026-09-18 交付并验收（判定见同文档 §6.1.1）**，五态语义与 36 项 + 第 7b 条全部落地，
   `SCHEMA_SET_REVISION` 实测未变。剩余残留观察（行级 `cell()` 未走五态分派；`LayerRecordTable` /
   `f7-analysis` 仍为二元回退）登记在同一节末尾，属后续条目而非验收阻塞项。
   **上述残留与验收阶段定位的既有缺陷 `DEF-BUSY-RACE-001`（`src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，
   使全量 e2e 长期不可用）已合并为一个无前置的收口工作包 `WP-2D-04`（提示词见同文档 §6.4）。**
   **`WP-2D-04` 已于 2026-09-18 交付并验收（判定见同文档 §6.4.1）：A 部修复使 `DEF-BUSY-RACE-001` 关闭、
   全量 e2e 恢复干净 tally；B-1 / B-2 / B-3 关闭，B-4 判定「无需修改」并经复核成立。**
   该包不占用 `WP-2D-03`（C3 输入面）的编号，2D-03 仍因依赖 Profile 数据而未写提示词。
   同一文件 §6.2（`WP-2D-02`，C1+C2）与 §6.3（`WP-2C-02a`）属**契约开窗批次**，窗口未重开前不得派发；
   `WP-2D-02` 的「等 `WP-2D-01` 验收」前置**已满足**，现只剩「窗口重开 + 步骤 0 探针」。
   `WP-2D-04` 验收后新登记三条残留（`renderKeyValues()` 裸字典仍二元、屏幕与导出的**状态列**文案不一致、
   `buildList()` 容器与单元格在 unsupported_schema 下可不同态），均记在 §6.4.1；
   **指挥方已于 2026-09-18 逐条裁定（§6.4.2）**：① 与 ③ **维持现状**（渲染点无 backend scope，可得状态集恰为
   `{available, missing}`，臆造其余三态属补造；① 的二元 helper 谓词与同站点 `display()` 逐字同源，改用共享解析器
   反而会让 `""` / `"—"` 出现 class 与文案不同源），② **确认是真缺陷并派 `WP-2D-05`**（提示词见同文档 §6.5）：
   导出 HTML 的记录状态列未走屏幕同规则——未报告状态导出成 `—` / `unknown`、已报告状态导出裸 token
   （屏幕经 `statusLabel()` 译出）。
   **`WP-2D-05` 已由指挥方在同一会话内直接实施并验收（判定见同文档 §6.5.1）**：新增 `renderStatusCell()`
   （`render-html.ts:74-90`，调用点 `:100`），已报告状态走 `statusLabel()` / `statusTone()`，未报告与 `unknown`
   走共享 `missing` 态；全仓 `>—</td>` 命中数 0，`record.status` 的处理点只剩屏幕与导出两处且规则一致。
   至此 **B-2「导出与屏幕同文案同 tone」已完全达成**，`record.status || "—"` 这一形态在本仓库已不存在。
   同文档 §6 内**已无「可立即派发」的工作包**：§6.2 / §6.3 等契约窗口重开，`WP-2D-03` 等结构化输入契约与
   Profile 数据。`WP-2D-05` 未占用 `WP-2D-03` 的编号。

### 2026-09-22 「应用到面板」判据改版与一条上下文声明回归（工作树含未提交改动）

本节记录 2026-09-22 的两处修复与实测门禁。**上方第 47 行的门禁表是 2026-09-19 的历史值，不改写**；本节数字为当日实测。

- **症状**：用户点「应用到面板」反复收到「页面上下文已变化，这份改动没有写入。请重新提交。」（`parameter_plan_stale`）。
- **根因（代码可证）**：`parameter_edits` 的应用守卫只比 `plan_revision` 与当前 `context_revision` 是否相等，而该令牌
  在**任何**重发布后都会换号；`plan_revision` 取的是**提交那一刻**的值，模型回答**首字约 60 秒**，期间
  `state.bridge.checking` 翻转、描述符刷新、页面重进都会换号 ⇒ 计划**出生即过期**，令牌判据必然复发。
- **修复一（判据换位）**：新增 `src/features/agent-copilot-integration/parameter-plan.ts` 的 `assessParameterPlan()`，
  改为逐条比对计划读到的 `previous` 与页面当次发布的 `parameter_catalog[].current`：值变了 / 地址不在目录里 /
  目录为空 / 无编辑 = 拒（错误详情仍 `parameter_plan_stale`，消息指名参数与新旧值）；全相符 = 写入。
  `markAgentBlocksStale` 不再把 `parameter_edits.plan_revision` 置 null。**注意：这不是契约变更**，revision 字符串格式、
  `compareAgentContexts`、编译器 staleState 语义都未动。
- **修复二（上下文声明回归）**：上一版 keeper 在内容未变时 `return`，把**声明上下文**一并省掉。通用投影与页面发布
  **共用 provider id `app-shell`**，而路由 watch 每次路由变化都发**无参数目录**的通用投影；`ExperimentView` 位于
  `<KeepAlive include="ExperimentView">` 中（`App.vue:870`），回到页面不重新 setup ⇒ 页面不再声明 ⇒ 通用投影长期生效
  ⇒ 面板退化为「只解释」，计划令牌也对不上。现在两个页面 publisher **每次运行都发布**（revision 仍由 keeper 钉住），
  判重移到 `publishExperimentAgentContext()`（生效上下文已是该发布时跳过 registry 更新）。
- **同日实测门禁**：前端 Vitest **1007 passed / 8 skipped，93 files，exit 0**（`vue-tsc --noEmit` 0、eslint 0、
  改动文件 prettier 0）；`generate-contract-types.mjs --check` / `generate-bridge-client.mjs --check` 均 exit 0；
  `check-doc-links.mjs` exit 0（**62 篇**）；`check-frontend-dependencies.mjs` exit 0（**309 源文件**）；
  Bridge `python -m unittest test_server.py` + `test_assistant_model.py` = **199 passed / 0 failed**。
  Playwright **子集**（`l5-lightweight-a11y` + `l6-lightweight-closure` + `dashboard`）= **60 passed / 0 failed /
  0 skipped，exit 0**（7.2 分钟，无 worker 卡死行，单次干净 tally）；修复**前**同子集为 59 passed / 1 failed
  （`dashboard.spec.js:54`，即上述回归），该条单跑 3 次可稳定复现，修复后通过。
- **未操作**：未 commit、未 push、未启停 5173、未改契约 JSON；`D:\tileSim` 只读。用户需自行**重新部署**才能看到该修复
  （`scripts/deploy-local-backend.ps1 -SourceRoot D:\tileSim`；`start-workbench.ps1` 只启动已有部署，不重建前端）。
- 模块级细节见 `docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md` 末尾的三条 2026-09-22 修订。

### 2026-09-23 助手可写参数面从「13 个旋钮」扩到「整份表单」（工作树含未提交改动）

本节记录 2026-09-23 的参数面扩容与实测门禁。**上方第 47 行的门禁表是 2026-09-19 的历史值，不改写**；本节数字为当日实测。

- **用户诉求（原话）**：「当前可调整的参数中没有显卡数量或 GPU 参与模式……请提供更全面的能力，使其能够对所有参数进行修改」。
- **根因（代码可证）**：桥接侧 `bridge/providers/assistant_model.py` 的 `PARAMETER_RULES` 只由
  `bridge/contracts/experiment_descriptor.py` 的 `PARAMETER_DEFINITIONS`（**13 个 `overrides` 旋钮**）生成；
  `_validated_plan()` 只认这 13 个地址，模型给出的任何表单字段一律按 `unknown_parameter` **静默丢弃**
  （`topology/devices`、`gpu_participation_mode` 都在此列）。前端 `parameter-catalog.ts` 早就枚举了整份表单，
  但**验收在桥接侧**，所以「加显卡」这类诉求必然落空 —— 前端能规划、后端不认。
- **修复一（参数面单一真源）**：新增 `bridge/contracts/parameter_surface.py`，从三份契约 schema
  （`run-overrides` / `runtime-trace-input` / `topology-request-input`）＋描述符**推导**出全部可写地址，
  导出 `SURFACE_ADDRESSES`（**64 条**）、`resolve_address()`、`surface_catalogue_text()`。
  `assistant_model.py` 的规则表、`_validated_plan()`、目录文本（交给模型的 `parameter_catalogue_text()`）
  全部改为读它 ⇒ **校验口径与目录文本同源**，不会再出现「没告诉模型的地址反而被判未知」。
  引用型字段（`device_id`/`domain_id`/`module_name`/`src_device`/`dst_device`/`module_binding`）与容器、数组本身继续**排除**
  （一次标量赋值不能安全改名/重写引用）。元素地址用 `[i]` 占位；模型直接写 `devices[i]/...` 会被
  `address_needs_an_index` 明确拒绝（而不是含糊的未知参数）。
- **修复二（集合规模可写）**：前端新增 `kind: "count"`（**集合规模，不是 JSON 类型**），
  `parameter-catalog.ts` 增加 `topology/devices`（文案「设备数量（显卡数量）」）与 `runtime_trace/requests`
  两条规模地址；`parameter-edit.ts` 的 `COLLECTION_RESIZERS` 用既有 `setDeviceCount` 与新增 `setRequestCount`
  完成增删（缩容时若有 link/domain 仍引用将消失的设备，抛 `StructuredInputError` 并点名该设备，不静默破坏）。`gpu_participation_mode` 属顶层表单字段，随之进入可写面。
- **修复三（一次方案的长度上限）**：`MAXIMUM_SETTINGS` **20 → 40**。真机实测（8 卡方案）显示：40 条以下模型
  会同时写「集合规模 + 逐卡字段 + fabric/knob」，20 条会把后半截按 `settings_limit_exceeded` 全丢，
  与它自己写的理由矛盾。上限现随目录文本一起告知模型（SYSTEM_PROMPT 明确写出条数），
  前端 `scenario-recommendation.ts` 把 `dropped` 条数写进方案理由（`App.vue` 透传），用户能看到「还有几项没列进来」。
- **同日实测门禁**：Bridge `test_parameter_surface.py`（新）**25 passed**、`test_assistant_model.py` **62 passed**（原 55，+7）、
  `test_server.py` **170 passed** —— 三文件合计 **257 passed / 0 failed**；
  前端 Vitest **1056 passed / 8 skipped，93 files，exit 0**（`vue-tsc --noEmit` 0、eslint 0、
  改动文件 prettier 0）；`generate-contract-types.mjs --check` / `generate-bridge-client.mjs --check` 均 exit 0；
  `bridge/test_f8_schemas.mjs` 1 passed；`check-doc-links.mjs` exit 0（**62 篇**）；
  `check-frontend-dependencies.mjs` exit 0（**309 源文件**）；改动文件 `git diff --check` 0。
- **真机验证（只读，不进仓库）**：用启动器已保存的通道配置（`runtime/evidence-agent.local.json`，模型 `gpt-5.6-sol`）
  跑参数面探针。目录文本 78 行，四个关键地址全部命中（`topology/devices`、`集合规模`、
  `gpu_participation_mode`、`runtime_trace/requests[i]/tp_degree`）；模型成功给出「8 张 GPU」方案
  （`topology/devices = 8` + 逐卡 `device_type`/`group_id` + fabric/knob），当时受 20 条上限丢弃 24 条 —— 即上条修复的触发证据。
  该网关（`https://x.mkai.de5.net`）随后开始整体拒绝 chat 调用（`/v1/models` 与 `/v1/chat/completions` 均
  `HTTP 403: error code: 1010`）⇒ **这是网关侧拒绝，不是本仓库缺陷**；密钥不出后端（`no_credential_in_report: true`）。
- **未操作**：未 commit、未 push、未启停 5173、未改契约 JSON（参数面是**读**契约推导，不新增/修改任何 schema）；`D:\tileSim` 只读。
  用户需自行**重新部署**才能看到该能力（`scripts/deploy-local-backend.ps1 -SourceRoot D:\tileSim`）。
- 模块级细节见 `docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md` 末尾的 2026-09-23 修订。

### 2026-09-23 原版 Tauri 启动器接线（未执行部署）

- 原路径 `启动TileSim工作台.exe` 的原版是 Tauri 2 侧栏工作台，不是 `tools/launcher/tilesim_launcher.py` 的 Tk 界面。
  从保留的 `origin/codex/launcher-tauri-v2` 源码恢复 `tools/workbench-launcher/`；旧构建入口现转向 Tauri，
  防止再次以 PyInstaller 覆盖原版。原版窗口的概览、服务、模型、诊断、日志、主题均保留。
- 在“更新与部署”页并列提供远端 `origin/main` 更新和“部署本地工作树”。后者的 typed Rust 请求仅允许
  `scripts/deploy-local-backend.ps1 -SourceRoot <所选 Git 后端工作树> -WslDistro <校验名称>`；使用当前 Web checkout，
  不调用个人桌面 `.cmd`，不 fetch/push，不强制结束开发进程。确认框明确提示未提交文件与 5173 重启。
- Tauri 单元测试 **14 passed**、组件/状态测试 **11 passed**、fixture E2E **15 passed**，`launcher:typecheck`、
  Rust fmt/Clippy、改动文件 ESLint/Prettier、`docs:check`（62 篇）与 `deps:check`（309 源文件）通过。
  主站 `pnpm test` **93 files / 1056 passed / 8 skipped**，`pnpm typecheck`、`pnpm build`、`contracts:check`
  通过；全仓 ESLint **0 errors / 2 既有 warnings**。主站全量 e2e 本轮未跑。
  本机 Tauri 构建和 packaged self-check 通过，发布到原路径；旧版 EXE 原子备份在被 Git 忽略的
  `runtime/launcher-fallback/`。正式 EXE 的新增入口和确认框已人工检查并取消。
- **未执行本地或远端部署**，未停止/重启 5173、未读取 Provider credential、未 commit/push；工作树先前的
  界面和截图未提交改动保留。launcher fixture 使用独立 4187，检查后已停止。

### 2026-09-23 Tauri 启动器日常入口收敛

- 保留原版 Tauri 侧栏工作台，在概览页收敛为“一键启动工作台”和“重新部署当前代码”两项日常操作；
  移除重复的“启动与服务”页。已有服务就绪时只打开网页，未运行时验证并启动已有 release 后打开；
  首次无部署清单时转入本地部署确认，不隐式启动旧产物。
- 重新部署使用当前后端和 Web 工作树文件（含未提交改动），保持确认、构建、测试、发布和 5173 重启，
  成功后打开网页，失败不打开。后端目录与 WSL 配置在“部署设置”；远端 main 更新、停止服务降为折叠高级操作。
  启动器不调用个人桌面 `.cmd`，不强制结束开发进程。
- Rust 单元测试 14 passed、fixture 单元/组件 11 passed、独立 4187 E2E 17 passed、launcher typecheck exit 0；
  浅深主题与 800×600 窗口已人工检查。Tauri 构建与 packaged self-check 通过，原路径 EXE 已原子替换，
  SHA-256 `ae2aa95dfb548e4dc8b796aa463d14d4f784cbdf19e80d2a38f58ab029c9e3ff`；替换前一版在
  `runtime/launcher-fallback/启动TileSim工作台.previous-20260923-180827-42252.exe`（此前原版另有备份）。
  此批**没有执行真实部署或启停 5173**。

### 2026-09-23 启动与部署进度可见性

- 原版 Tauri 概览的启动、本地重新部署，以及折叠高级操作中的远端更新运行时，页面顶部显示
  真实脚本阶段、动态进度条、持续计时、最近一行脱敏输出和“查看完整日志”入口。
  进度条表示任务正在运行，**不显示未经脚本提供的完成百分比**；失败时解决办法置于进度区之前。
- 仍只使用 Rust typed operation 的现有阶段/日志事件，不修改部署脚本、部署清单或 5173 服务。
- Rust 单元测试 14 passed、组件测试 11 passed、4187 fixture E2E 20 passed、launcher typecheck、改动文件
  ESLint/Prettier、docs:check、`git diff --check` 均通过。800×600 浅/深主题运行态进度条已人工检查。
  Tauri packaged self-check 通过并原子更新原路径 EXE，SHA-256
  `9ea14da6bdb8d5cad1346ef75fa7b3dac8470213832888357326f0a4ac12f7b6`；更新前一版备份为
  `runtime/launcher-fallback/启动TileSim工作台.previous-20260923-183356-48660.exe`。
  未执行真实部署或启停 5173，监听进程仍为 PID 17252；没有 commit/push。

### 2026-09-23 助手同批扩容方案完整性修复（工作树，未部署）

- 16 卡示例暴露的缺口：目录此前只含已存在的设备索引；模型方案的新增设备字段被跳过，Bridge 40 项上限截断其余字段；逐项应用会留下半套配置。
- 现在仅在同一方案合法增加 `topology/devices` 或 `runtime_trace/requests` 时，投影方案明确点名的未来元素标量字段；页面应用前核对原集合规模未变，写入时先扩容再写字段，任一文档写入失败则整批回滚（包括表单改动）。未提及的 links/domains 不会被编造。
- 模型方案的 skipped、Bridge dropped、校验拒绝和未识别项逐地址列出，禁止直接应用；多节点扩容缺组号、声称 TPn 但未配置第 0 条请求的对应并行度，同样标为不完整。Bridge 设置上限提高到 64，并要求模型诚实区分设备分组与完整互联。若被修改的请求仍固定着与新 TP 不匹配的 `participants`，整批拒绝并提示先在结构化输入清空或重写；实际域与链路仍需人工核对，不能由组号推断。
- 定向前端测试覆盖 16 卡四节点乱序配置、TP16、过期规模、越界索引、回滚和不完整方案；Bridge 以及其它门禁的本轮实测结果以当前交付报告为准。没有创建运行、使用 live Provider、部署或重启 5173；现有其它工作树改动保留。

### 2026-09-23 助手与用户对话身份（工作树，未部署）

- 侧栏对话中，用户发言显示中性人物 SVG 头像和「用户」；模型发言显示「阿拓」头像及名称，保留模型 identity 的次级标识。输入标签、占位说明、空状态与页脚不再使用第二人称「你」。图像只作装饰，文字保留可访问的发言者身份；不读取个人资料或推断用户身份。
- 仅更改静态视觉资产与文案，不改变 Agent typed-block payload、上下文、模型选择、草案或执行流程；现有 5173 服务未部署。浅色/深色与窄桌面的实际验证结果见交付报告。

### 2026-09-23 进阶运行参数缺省值展示（工作树，未部署）

- `RuntimePolicyForm.vue` 对未写入 `runtime_trace.policy` 的 9 个进阶字段显示后端缺省值：数字输入以浅色 placeholder 展示，并标注「后端默认…（未写入）」；布尔下拉的空选项也明确写出默认值。填写字段才写入 JSON，清空恢复省略字段，提交语义不变。
- 展示值逐项对照当前后端 `D:\tileSim\src\Core\LayerAdapters.cpp` 缺失字段回退值；这是本地源码的静态说明，不是 Bridge descriptor 提供的动态 Profile 默认，也不保证连接到异版后端时仍相同。未改契约、Bridge 或核心仿真代码，未部署 5173。

### 2026-10-25 结果解读报告与 dashboard 复核（当前工作树，未提交）

- 结果页新增只读“结果解读报告”确认动作：仅在用户确认后调用公共导出 API；报告继续 fail-closed 校验 run、backend、schema、输入摘要、artifact 身份和 Evidence Agent binding。定向报告 Vitest 与 Edge fixture E2E 均通过；未扩展 Bridge contract、generated client、schema-set revision、allowlist 或 create-run。
- 修复前 dashboard desktop fixture 为 **54 tests / 40 passed / 14 failed**；最小修复后以单 worker 复跑为 **54 tests / 41 passed / 13 failed**。报告相关新增流程通过。剩余失败按原因登记如下：Agent 八字段与 full-surface plan 为既有 fixture/断言与当前结构化输入行为不一致；P99 table、runtime 懒加载、topology selector、boundary tooltip 和 language heading 为旧页面/fixture 选择器或文案预期；synthetic/dark 视觉快照仍与当前 dirty 视觉改动不一致；dark appearance 仍有报告覆盖面板 4.39:1 对比度缺陷。
- 本轮已将 Attribution、Execution 和 Metrics 的 disclosure summary 内说明改为 passive `InlineHelp`，修复 `nested-interactive` 并补充 passive 渲染回归测试；执行回放阶段标记也改为非 button 容器，证据链接不再嵌在激活控件内，`desktop motion` 受影响检查通过。完整 desktop 多 worker 运行曾因临时 Vite 进程退出形成 9 passed / 51 connection-refused 链式失败，不作为代码 tally；单 worker dashboard 数字才是可引用结果。
- 临时 Edge/Vite fixture 使用 4173，已停止并确认释放；5173 由既有进程监听，未停止、重启或替换。没有读取 credential、调用 Provider、操作用户 run、部署、commit 或 push。当前报告与 Agent Harness 仍仅为 `local_dev` / `synthetic_trace` / `exploratory` / `not_for_production`；Run Intake v2 DoR、Profile records、生产执行和 live acceptance 继续 blocked/pending。

## 7. 完整门禁

以 `AGENTS.md` 为准。模块测试先行，最后运行 contracts、dependency、typecheck、Vitest、lint、format、build、Bridge unittest、fixture E2E 和 `git diff --check`。需要 deployed/live 服务的测试必须保持独立并准确报告 skip。

## 8. 交接报告必填

- changed files 和职责边界；
- identity/revision 是否变化；
- canonical、uint64、stale、409、502/503/504、citation 与 retention 回归；
- fixture/live/calibration/held-out 各自状态；
- 全部门禁和 skipped 项；
- 是否操作 5173、credential、Provider、run、commit 和 push。

## 9. Phase 2 契约与 lowering 状态

- Phase 2A 候选已由 Phase 2B 正式发布并提交（`4d7f9fa`）。契约包位于
  `bridge/contracts/agent_orchestration_phase2/`，包含五类 Profile v2、Profile Binding、Run Intake、Validation、
  Calculator Receipt 与幂等/留存 policy。
- 发布覆盖 Schema、严格 validator、manifest 与生成 TypeScript/Ajv。`/api/runs` 仍不接受 Run Intake v2，真实
  Profile、calculator 与 held-out validation 仍 unavailable。WP-2C-01a/01b 已在工作树接入 `registry.py` 并注册
  `POST /api/agent/run-intake-preview`（只读预览），但该端点不做执行路由，见 §2。
- 后端已提交 Phase 2C `parse_run_intake_v2` / `lower_run_intake_v2` 与只读 CLI 入口；执行侧因五类 Profile records
  为空而 fail closed。**Bridge 侧尚未与 lowering 接线**（只读预览端点不触达 lowering）。
- 阶段记录已归档：Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、Phase 2B 发布见
  `docs/archive/agent-orchestration/phase-records/`。

## 10. 第七阶段逐请求归因错误契约与 Schema identity（工作树）

- 重复 `request_id` 在请求归因路径返回稳定的
  `REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED`，并携带 `/requests/<n>/request_id` 与原因中的相关元素指针；普通运行仍使用
  `range_execution_failed`。CLI 失败不写入归因 payload，Bridge 持久化 `cli_error_code`、`cli_field_path`、`cli_cause`、
  `cli_next_action`，前端归因入口显示失败事实、修复动作与重试入口。
- Schema-set revision 唯一由 `bridge/contracts/schema_set.py` 对当前 JSON 契约集合计算；Bridge manifest 与
  `contracts:check` 均复用并校验该 canonical 值。当前工作树 revision 为
  `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`；历史阶段报告中的 revision 保留为历史记录。
- 本阶段只覆盖本地 synthetic hosted execution、临时 Bridge 和前端测试；不开放真实 GPU、Provider、校准或 held-out validation，
  也未操作 5173、提交或部署。

### 2026-10-13 启动器本地部署增量复用（当前工作树，未部署）

- `scripts/deploy-local-backend.ps1` 新增显式 `-ReuseVerifiedArtifacts` 快速路径和 `-ForceFullValidation` 安全回退开关。启动器的“重新部署当前代码”默认请求快速路径：只有当前后端 revision、后端源码 digest、build digest、WSL 发行版、CLI 路径及 SHA-256、已记录 CTest 结果，以及 Web immutable release 的源码 digest、schema revision、受控 release 路径和 release/Bridge/static 校验全部一致时才复用；证明不足即回退原完整构建/测试流程。
- 后端未变化时复用已验证 CLI 与 CTest；Web 未变化时通过 `release-snapshot.mjs verify` 复用 immutable release；Web 有变化时仍执行契约生成物 drift check、schema-set check、Bridge `py_compile` 和生产构建。勾选“强制完整验证”或直接调用脚本不带快速开关会重新运行原有后端构建、CTest、Bridge/Web 测试和 Web 构建。
- 快速路径不改变 manifest identity、source/build digest、schema-set revision、immutable release、rollback 或 5173 重启语义；manifest 记录复用状态，后续启动也会复核 CLI SHA-256。启动器 fixture、Rust 单测/Clippy、组件和 fixture E2E 已复验；本轮未完成真实部署、未读取 credential、未调用 Provider、未操作用户 run、未提交或推送。一次误触发的脚本检查在进入 manifest/重启阶段前被中断，仅留下仓外增量构建缓存；检查开始时 5173 曾由既有 PID 监听，随后在清理该检查产生的 WSL 子进程后观察为未监听，未执行启动或重启操作，需由用户决定是否恢复服务。

### 2026-10-15 Agent 结构化 JSON 仿真拓扑方案（当前工作树，未部署）

- 助手方案现在可以在 `structured_inputs` 中一次性返回完整的 `runtime_trace` 和 `topology` JSON；拓扑可包含 `devices`、`domains`、`links`、`module_bindings`，不再要求把拓扑连线伪装成标量旋钮。Bridge 复用现有 `custom_inputs` 校验，并额外要求两个文档明确声明 `synthetic_trace`、`uncalibrated` 及合法的探索性/一致性 claim scope；连线端点、domain 成员、module binding 和自连接均在返回方案前拒绝。
- 前端在确认前展示完整 JSON 预览，使用同一 create-run validator 和拓扑解析器做原子校验；任一文档或引用失败，runtime/topology 均不写入，也不会创建 run。应用后同步进入 JSON 输入状态，仍保留用户确认、requested/resolved fidelity 分离和既有动态引擎边界。
- 该能力只生成可校验的仿真假设，不代表真实 GPU、物理链路、Provider、校准、held-out validation 或生产验证。当前工作树 `contracts:check`、`typecheck`、`lint`、`docs:check`、`deps:check`、`build`、Bridge 助手 69 tests 和定向前端 81 tests 已通过；无关历史格式问题不在本次重写范围内。未触碰 5173、credential、Provider、用户 run、提交或部署。
- OpenAPI 增加 `structured_inputs` 后，canonical schema-set revision 从前一阶段的 `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55` 变为 `sha256:aa9e305651fa1731de47b034fec27f2ea19089651119302c21b3698c1a97b327`；生成 TypeScript、Bridge client 和 schema-set 检查均已同步，未通过硬编码掩盖漂移。
- 针对一次 8 卡重试中模型把 `exploratory`、`synthetic_trace`、`uncalibrated` 错放为 runtime provenance 的对象键问题，助手协议已补充精确嵌套示例；Bridge 仅对这组三值的无歧义助手缩写归一化为 canonical provenance，其他未知结构仍 fail closed，并有回归测试覆盖。

## 2026-10-18 Agent Harness 阶段 2 当前事实

本节是当前工作树增量事实，不改写前文历史数字。Bridge 已发布 `2026-10-18.wpb.v1` successor：
`tilesim.agent_harness.experiment_draft.v2`、`tilesim.agent_harness.draft_validation_report.v1`、
`tilesim.agent_harness.approval.v2`。WP-A `2026-10-17.wpa.v1` operation/tool/draft v1/approval v1 保留兼容读取，proposal v0
仍不接受为运行时身份。

正式 API：`POST/GET/DELETE /api/agent/drafts`、`POST .../{draft_id}/validate`、`GET .../{draft_id}/events`（含 SSE stream）、
`POST/GET .../{draft_id}/approvals/{approval_id}`、`POST .../reject`、`POST .../revoke`。写请求必须携带
`Idempotency-Key`，并校验 principal/workspace、payload digest、input snapshot、schema-set revision、backend identity、
validator/policy revision。SQLite WAL 持久化 draft、validation report、approval、event identity 和 digest/有界摘要；删除、
retention 到期、validation 替换和 identity 漂移会使对象不可读或 stale。完整 create-run payload 不长期保存。

阶段 2 合同没有执行入口：`would_create_run` 固定为 `false`，没有调用 `/api/runs`、TileSimCLI、run repository create、queue
submit 或 artifact materializer。submit/cancel/retry/resume/autonomous optimization 继续关闭。Provider acceptance 继续为
`live_acceptance_pending`；当前证据是本地 deterministic/contract/unit/HTTP 测试，不是 live Provider 或 held-out validation。

# 阶段 3A 受控执行交接（2026-10-18）

Bridge execution successor revision 为 `2026-10-18.wpc.v1`，当前 schema-set revision 由 Bridge 启动时计算。
`POST /api/agent/executions` 只接受 valid draft + approved、未过期未消费 approval；它重新绑定 snapshot、schema-set、
backend、policy 和 create-run digest，消费单次 approval 后写入 side-effect ledger，并通过现有 `/api/runs` 创建唯一 run。
状态、事件、SSE/polling、cancel、retry、resume 和 result reference 均有对应 execution endpoint。unknown outcome 只进入
`recovery_required`/人工接管，取消后的迟到事件不能覆盖终态，结果只能来自 verified artifact manifest。Provider acceptance
仍为 `live_acceptance_pending`，自主优化和无人值守批量执行继续关闭。

## 2026-10-18 阶段 3A 后端受控执行收口（当前工作树，未部署）

本轮在不触碰 `127.0.0.1:5173`、TileSim C++/仿真逻辑或 Provider credential 的前提下，完成了
阶段 3A 的故障注入资产和执行边界收口。执行 successor contract 仍为 `2026-10-18.wpc.v1`，本地
schema-set revision 为 `sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50`。

新增 `bridge/test_agent_harness_stage3_matrix.py`，以 `AH3-F01`–`AH3-F26` 固定编号覆盖：未批准/非法/
stale draft、过期/撤销/replay approval、digest/schema/backend/principal 绑定、幂等 replay/conflict、队列容量、
worker/Bridge 重启、create-run timeout/non-zero/unknown、重复/乱序 event、取消迟到终态、不可重试失败、
已完成副作用 resume、artifact identity mismatch、retention/delete 和 terminal fence。每项至少核对稳定错误码、
根 JSON Pointer、retryable/unknown_outcome、operation 状态、event/ledger 副作用边界；submit/SSE/result 和唯一
`/api/runs` 入口仍由 `test_agent_harness_stage3.py` 的 hosted HTTP 测试覆盖。

执行边界新增两项 fail-closed 语义：失败 operation 只能由显式 retry 重新打开，`recovery_required` 只能显式 resume
或 cancel；result reference 生成前重新用 run repository 校验 manifest 的 schema、run、artifact 列表、SHA-256、
bytes 和 rejection set。删除 operation 会清除 request/result/error payload，只保留删除身份元数据；已删除 operation
不再可通过 stage3 lookup 读取。

仓外临时 Bridge + 当前源码 `D:\tileSim\build-ca1\Release\TileSimCLI.exe` hosted smoke（端口 `59123`）已完成：
合法 draft → validation → approval → execution → `/api/runs` → worker polling → manifest/result；单次创建
`run-20261018-181322-60b580b5`，事件 sequence `1..5`，result 保留 `synthetic_trace` / `exploratory`、requested/resolved
fidelity 和 artifact SHA/bytes。相同 execution idempotency key 返回 replay 且未增加 run；不同 payload 返回稳定 409。
临时服务和 run 位于仓外临时状态根，已停止；该 smoke 不计入 Provider acceptance。

Provider acceptance 仍为 `live_acceptance_pending`。自主优化、自动候选、多工具自主循环和无人值守实验仍未开放。
阶段 3A 仍为 **NO-GO**，直到完整 26 类故障矩阵与 hosted smoke 进入正式发布门禁并完成独立审查；本节不改写历史验收数字。

## 2026-10-18 阶段 3A 独立发布审查（当前工作树，未部署）

新增机器可校验的 release-gate 入口 `bridge/run_agent_harness_stage3_release_gate.py`、
`bridge/agent_harness/release_gate.py`、`bridge/agent_harness/hosted_smoke.py` 和
`bridge/test_agent_harness_stage3_release_gate.py`，完整清单见
归档的 [`docs/archive/agent-orchestration/phase-records/28_AGENT_HARNESS_STAGE3A_RELEASE_GATE.md`](archive/agent-orchestration/phase-records/28_AGENT_HARNESS_STAGE3A_RELEASE_GATE.md)。入口只产生仓外临时 manifest，不读取、保存或输出 Provider credential、raw response 或 hidden reasoning，也不触碰 5173。

独立复核通过 `AH3-F01`–`AH3-F26`（26/26），并使用当前源码 CLI 在仓外临时 Bridge 完成 draft → validation → approval → execution → `/api/runs` → polling/SSE → result → manifest smoke：run `run-20261018-185914-e40329ea`，event sequence `1..5`，单 run，同 key replay 不增加 run，不同 payload 为 `409 payload_conflict`；synthetic provenance 仍为 `synthetic_trace` / `exploratory`。Provider acceptance 仍为 `live_acceptance_pending`，人工 citation/evidence review 为 `not_run`；因此阶段 3A 独立发布审查结论仍为 **NO-GO**，暂不允许进入前端 execution UI 阶段。自主优化、自动候选、多工具自主循环和无人值守实验继续保持 `unavailable`/`not_exposed`。

## 2026-10-18 阶段 3A acceptance / review 准备（当前工作树，未部署）

新增仓外 redacted preparation 入口 `bridge/run_agent_harness_stage3_acceptance_prep.py`、
`bridge/agent_harness/acceptance_prep.py` 和定向测试；准备资产说明见
归档的 [`29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md`](archive/agent-orchestration/phase-records/29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md)。Provider
manifest identity 为 `tilesim.agent_harness.provider_acceptance_manifest.v1` /
`2026-10-18.3a.acceptance.v1`，人工 review package identity 为
`tilesim.agent_harness.evidence_citation_review_package.v1` / `2026-10-18.3a.review.v1`。

本轮仅验证 fail-closed 准备契约：Provider state 保持 `live_acceptance_pending`，capability probe 为
`not_run`/`not_configured`，success repetition 为 `0`，人工 review 为 `not_run`；没有调用 Provider、读取或
持久化 credential、raw response、hidden reasoning 或完整 evidence payload。3A 仍为 **NO-GO**，不允许启动
阶段 3B execution UI、阶段 4、自主候选、多工具循环或无人值守执行。

## 2026-10-18 阶段 3A 最终发布验收复核（当前工作树，未部署）

本轮使用正式 release-gate 入口、当前 schema-set、Bridge 和
`D:\tileSim\build-ca1\Release\TileSimCLI.exe` 在仓外临时状态根复跑。AH3-F01–AH3-F26 为 `26/26 pass`，
release-gate 测试套件 `54/54 pass`；hosted synthetic smoke 通过，唯一 run 为
`run-20261018-223907-c3856146`，事件序列为 `1..5`，SSE 与 polling 一致，同 key replay 未增加 run，
不同 payload 为 `409 payload_conflict`。该结果明确保持 `synthetic_trace` / `exploratory`，不计入 Provider acceptance。

仓外 redacted acceptance manifest 为
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\provider-acceptance-manifest.json`
（`sha256:142056eac084dcf47f4539a60f923e9b779cc4103c8d5ae14462b94253076abe`）；review package 为
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\evidence-citation-review-package.json`
（`sha256:963ed92dc6064a3f93ff5cf86a74e42cd49683e8d9c86fc3dbf3fdd38ddbc567`）。Provider capability probe 为
`not_run/not_configured`，四个 acceptance lane（success、refusal_or_invalid_response、timeout_or_unavailable、
identity_mismatch）均为 `not_run`，成功 repetition 为 `0`；独立人工 evidence/citation review 为
`not_run`，reviewer 数为 `0`。本轮未读取、打印或持久化 credential、token、raw Provider response、hidden reasoning
或完整敏感 evidence payload。

release-gate manifest 为
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-release-gate-d2094e8d5b7947a7993aa820c43234d9.json`
（`sha256:c5cc6e0f8381be31f53f82cfbb96f97e174d9bf7fc93c5dd714d4aa3281922c5`）。Provider acceptance 和独立人工审查
仍是强制阻塞项，阶段 3A 最终结论保持 **NO-GO**；不得启动阶段 3B execution UI、阶段 4、自主候选、多工具循环
或无人值守执行。

## 2026-10-29 LangGraph flow 前端生命周期收口（工作树，未提交）

- Web 端导航 flow 继续只使用已发布的 page id、显式 `navigate` 授权和有限预算；用户在导航卡点击一次即为页面跳转授权，通用 durable flow 卡中的 `confirm_navigation` 只作状态提示，不再产生第二次批准按钮。
- SSE、polling、重载恢复和不可重试观察错误都会按 `flow_id` 更新同一导航卡；页面、context revision、Bridge identity 或 schema revision 变化会 fail-closed 标记 stale，旧卡不会继续暴露“打开页面”操作。导航执行器保留 visited-page/attempt cursor，禁止重复已访问页面。
- 当前工作树 schema-set revision 为 `sha256:69e724a56d73a1b4fe14c698cb9ba7823de587c17e810c439377655fa4cbb237`，与 Bridge canonical 计算和 generated client 一致；本轮未修改正式 schema、generated client 或 revision 常量。
- 定向 flow/navigation/copilot lifecycle 测试 62 passed；全量 Web Vitest 130 files / 1381 passed / 8 skipped；typecheck、lint、contracts/docs/deps、Vite build 通过；Bridge `test_agent_flow.py test_agent_orchestrator.py test_server.py test_agent_intent.py` 为 258 tests / 7 skipped / OK。上述证据仍仅为 `local_dev + synthetic_trace + exploratory + not_for_production`，Run Intake v2、Provider/live acceptance 和生产执行继续 blocked。
