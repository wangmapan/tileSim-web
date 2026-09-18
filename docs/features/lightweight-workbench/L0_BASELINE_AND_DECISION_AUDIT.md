# Phase L0：双工作台基线与决策审计

**审计日期**：2026-09-12
**工作目录**：`D:\tileSim-web`
**L0 状态**：`L1b complete`（产品负责人于 2026-09-12 确认 Q-01–Q-06；L1a/L1b 已完成，L2 尚未开始）
**范围**：电脑网页端、local Bridge、现有版本化契约；不含移动端、部署和后端生产改造。

## 1. 当前基线

### 1.1 工作树与证据边界

审计开始时 `git status --short --branch` 为 `main...origin/main`，工作树存在用户未提交改动，且有未跟踪的轻量工作台方案/原型文件。改动覆盖 Bridge 契约与 `server.py`、部署脚本、`docs/AI_HANDOFF.md`/Agent 阶段文档、`src/App.vue`、`src/app/router.ts`、`src/components/AppHeader.vue`、`src/views/OverviewView.vue`、`src/features/lightweight-workbench/**`、`src/views/LightweightWorkbenchView.vue` 和轻量单测，另有 `.playwright-cli/` 与 Phase 2D registry 文件。以上均视为用户资产，本阶段未 reset、clean、stash、回滚、覆盖、commit 或 push。

当前事实以 `docs/AI_HANDOFF.md` 和本目录方案为准：F0–F8/F10 已验证；F9 descriptor v2 已部署且 capability probe 为 available，但 live Provider acceptance、人工 citation entailment review 和 F9 live model repetitions 仍未完成。synthetic/fixture 只能证明契约或一致性，不能升级为 real/calibration/held-out 证据。

### 1.2 专业版现状

当前 `src/app/router.ts` 的专业路由为：

| 路由              | 当前职责          |
| ----------------- | ----------------- |
| `/overview`       | 运行概览与结论    |
| `/execution`      | 执行过程          |
| `/metrics`        | 性能指标          |
| `/fabric`         | 网络与通信        |
| `/attribution`    | 慢请求原因        |
| `/validation`     | 结果可信度        |
| `/evidence-agent` | Evidence Agent    |
| `/evidence-lab`   | Week 7 证据实验室 |
| `/design-space`   | 方案对比          |
| `/history`        | 运行记录          |
| `/experiment`     | 新建实验表单      |

专业版由 `App.vue` 装配 `AppSidebar`、`AppHeader`、`EvidenceStrip`、`GuidedHelpHost` 和全局 `AgentCopilotEntry`。`AppSidebar` 的导航模型仍按“分析/实验/工具”分组，并保留“新建实验”和 Bridge 健康卡片。专业表单支持 controls/json/trace-package 等输入模式，依 `create_run_request.v1` 与运行时 descriptor/capability 的交集校验；请求 fidelity 与运行后的 resolved fidelity 分开。

正式 run 由 `run-experiment` 公共入口调用 Bridge：带 `Idempotency-Key` 创建 `/api/runs`，Bridge 先校验 schema、能力、后端 identity 和容量，再异步执行；前端用 SSE（`Last-Event-ID`）并回退轮询等待 `preparing → running → completed/failed`，完成后读取 reports、inputs 与 artifact manifest。Pinia workspace 保存当前 run、报告和工件清单，history/session 保存有限的导航、对比和提交恢复信息；URL 中的合法 `run-*` 可触发只读恢复。无效或 stale 引用不得创建新 run。

### 1.3 轻量版当前原型

当前代码只有 `/lightweight` 单一路由，`/lightweight-workbench` 兼容重定向；没有 `/lightweight/learn|tasks|prepare|results` 子路由。根路径 `/` 仍由 `restoredEntryRoute()` 重定向到专业 `/overview`，或在已有 `tilesim-web.workbench-mode.v1=lightweight` 时重定向到 `/lightweight`，并非独立的双入口选择页。

原型的主要问题：

1. `App.vue` 无条件装配专业 `AppSidebar`/`AppHeader`/全局 Agent dock；轻量页面没有独立 shell 或独立导航。
2. `OverviewView.vue` 在无 run 时嵌入 `LightweightEntryCards`，使轻量入口成为专业 Overview 的附属内容，违反“并列而非从属”和根页首屏等权要求。
3. `LightweightWorkbenchView.vue` 把了解、准备、解读、示例压在一个页面，以内存 `result` 和固定 prompt 切换模拟任务；URL 不反映任务，也不能独立深链接或恢复结果页。
4. 原型在 setup 时直接写入 mode preference；`persistWorkbenchMode` 未包裹存储异常处理，且自动重定向规则与“首屏先选择”的产品约束尚未冻结。
5. 结果摘要把 typed blocks 以 JSON `pre` 展开，字段行使用“未设置”而没有完整的 unknown/missing/not-covered/unsupported 语义和证据层级；没有 run/artifact/schema query 绑定的结果页。
6. 原型上下文固定为 `run_ref: null`，支持动作中包含 `configure_current_subset`；这不能被解释为已获得正式 run 创建或专业表单写入权限。

可复用部分：`src/features/lightweight-workbench/index.ts` 的公共出口、`createLightweightAgentAdapter` 的单轮投影、`LightweightTaskCards`/理解摘要/限制/下一步组件骨架、模式 preference key、以及针对八字段 draft/unknown/unsupported 的 Vitest fixture。复用时必须重做路由、shell、状态语义、文案和可访问性验收，不能把原型直接扩展成产品。

### 1.4 Agent、Bridge、Provider 基线

轻量可消费的公开入口仅包括 capability snapshot、Phase 1 projection、`compileIntent`、typed-block 映射、单轮 redaction、context envelope 与 stale 标记。当前八个 `agent_exposed` 字段为：

- `s0.workload.message_size_multiplier`
- `s1.runtime.batch_scheduler`
- `s1.runtime.max_batch_size`
- `s1.runtime.kv_capacity_tokens`（conditional，逻辑 admission；物理 KV 仍有 gap）
- `s6.fabric.scale_up_bandwidth_gbps`
- `s6.fabric.scale_up_latency_us`
- `s6.fabric.scale_out_bandwidth_gbps`
- `s6.fabric.scale_out_latency_us`

模型、engine、device、topology、workload 选择、TP/PP/EP、placement、物理 KV、集合通信算法、SLO、ranking、calculator、calibration 和 held-out validation 当前为 `not_exposed`、`unavailable` 或缺口状态，轻量版只能显示原因，不能提供伪造控件或默认值。

Bridge 的 capability endpoint 为 `GET /api/agent/orchestration-capabilities`，响应必须绑定 manifest 的 `schema_set_revision`、catalog revision 和 backend release identity；revision 不匹配时 fail closed。正式 run endpoint `/api/runs` 是唯一创建入口，轻量首期不得调用。Evidence Agent 是另一条 run-bound 只读链路：`POST /api/runs/{run}/agent/evidence-analyses`，必须绑定 artifact manifest、run、schema/revision、snapshot digest 和 citation pointer；Provider 是可选配置，未配置或不可用时返回受控 unavailable/refusal，禁止自动 replay 或把 claim-free terminal 当作成功结论。

## 2. 双工作台目标

- `/` 第一屏直接呈现两个等权入口：“进入专业版”和“进入轻量版”。
- 专业版保留现有完整导航、实验表单、run、指标、验证、Evidence Agent、历史和旧 URL。
- 轻量版拥有独立 shell、独立导航和独立任务流，首批任务为“了解、准备、解读、示例”。
- 两者只共享 canonical 事实、公开 Agent 能力、契约、状态和证据引用，不共享页面组织方式。
- 轻量首次成功路径在不创建 run、不调用 Provider 的前提下，完成“选择目标 → 描述问题 → 看到 Agent 理解/澄清/限制 → 知道下一步”。

## 3. 已冻结决策

以下决策已具备足够的产品/架构清晰度，已在 `DECISION_LOG_AND_OPEN_QUESTIONS.md` 登记：双入口根页、独立 shell、共享事实不共享 IA、轻量只读单轮内存态、四类首批任务、状态 fail-closed、专业版保护、合法引用的专业衔接、URL/server/workspace/UI preference 分层以及仅覆盖电脑网页端。

特别约束：轻量永远不调用 Provider、不创建正式 run、不修改专业表单、不模拟 Conversation/Workflow/RAG/Approval；任何执行性能力须先有正式 Agent/Bridge contract、权限、审计、retention 和失败语义。

## 4. 未决问题与推荐默认值

推荐默认值为工程输入，不等于产品批准：

| 问题                       | 推荐默认                                                   |
| -------------------------- | ---------------------------------------------------------- |
| `/` 是否自动进入最近模式   | 不自动进入；根页始终显示双入口，仅弱提示最近模式           |
| 轻量是否拆真实子路由       | 是：`/lightweight/learn`、`/tasks`、`/prepare`、`/results` |
| 刷新后是否保留草案         | 不保留正文，仅页面生命周期内存态                           |
| 解读结果是否可选择已有 run | 只读读取合法、可验证的现有 run                             |
| 首批模板数量               | 四类任务，每类最多两个模板                                 |
| localStorage 禁用时        | 入口可用，偏好退化为本次会话记忆                           |

Q-01–Q-06 已由产品负责人于 2026-09-12 确认（详见决策日志）。本阶段批准范围仅为 L1a 根页双入口与路由合同，不代表批准 Provider 调用、正式 run 创建、多轮 Conversation、Draft 持久化、权限、retention、Bridge contract 或 Agent capability。

## 5. 专业版保护清单

- `/overview` 及现有专业路由、旧深链接和 `?view=`/`dashboard-state` 兼容逻辑保持可用。
- 专业 `AppSidebar`、表单校验、create-run idempotency、SSE/轮询恢复、artifact manifest 和 history 不被轻量状态覆盖。
- 模式切换不清除当前 run、artifact、schema revision、专业表单或 Evidence selection；backend-global 页面不清除 run-bound 状态。
- 不把轻量任务卡嵌回专业 Overview 作为唯一入口；根页入口权重相等。
- 不改变专业 Agent 侧栏的 context registry、typed block、stale 和错误语义。
- 任何 schema、identity、provenance、fidelity 或 uint64 行为回归必须先于 L1 发布门禁。

## 6. Agent / Bridge / Provider 禁止事项

- 不在轻量版 import Agent store/entity、compiler/validator/catalog/request builder 的内部实现；跨 feature 仅经公共 `index.ts`。
- 不把 `0`、missing、expected absence、not covered、unsupported schema、not applicable 互相替换；不将 `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 升级。
- 不重算模拟指标，不把 Analytical/DES 描述成 Cycle，不把 synthetic consistency 描述成 held-out validation。
- 不调用 `POST /api/runs`，不构造 create-run request，不调用 Evidence Provider，不读取 credential。
- 不在浏览器模拟多轮对话、RAG、Workflow、Approval、工具执行、自动优化或 ranking。
- 不持久化完整 instruction、raw response、hidden reasoning、credential 或完整会话；mode preference 之外的草案只留在页面生命周期。
- revision/context/stale/409 冲突时锁定原 key，必须由用户显式丢弃后才开始新分析；不得自动重算或 Provider replay。
- 保持 64 位 ps/bytes/count 无损 JSON 路径；显示级换算必须标注并可追溯原值。

## 7. 路由和状态边界

| 边界              | 规则                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 根页              | `/` 只负责模式选择/最近模式入口，不依赖 capability 请求，不绑定 run。                                                                         |
| 轻量路由          | `/lightweight/*` 负责任务、学习、单轮草案和只读结果；不能创建 run。                                                                           |
| 专业路由          | `/overview` 及现有路由继续负责完整配置、执行、指标、验证、证据和历史。                                                                        |
| URL 状态          | 只放 route、合法 `run-*`、`artifact_sha256`、`schema_set_revision`、可选 `from=lightweight`；不放问题正文或 raw response。                    |
| Server state      | TanStack Query 继续管理 capability/manifest/run 查询；query key 保留 run、backend identity、schema-set revision、artifact SHA-256（适用时）。 |
| Workspace/session | Pinia 保留当前 run、artifact、bridge、history、当前 section 和轻量内存草案；刷新不拼回完整 Conversation。                                     |
| 偏好              | `tilesim-web.workbench-mode.v1` 仅允许 `lightweight                                                                                           | professional`；损坏或不可用时回退选择页/会话记忆，不参与授权。 |
| stale             | context、backend identity、schema revision 或 artifact 变化时旧草案/结果标记 stale，锁定原 key，显式丢弃后才可新一轮。                        |

## 8. L1 进入条件

L1 实现只有在产品负责人确认 Q-01–Q-06、设计评审确认双入口/独立 IA、工程评审确认 Agent/Bridge 边界后才能开始。进入时必须满足：

1. 根页入口、`/lightweight/*` 命名和 `/overview` 专业归属写入已批准决策。
2. 轻量只读、单轮、内存态和四类任务范围无歧义。
3. 专业版回归清单、旧 URL、run/artifact/schema/stale 传递规则有可执行测试计划。
4. 不需要修改 Bridge contract、Agent 内部、Provider 或后端生产代码；如发现需要，退回方案评审。
5. L1 PR 切片可独立回滚，且不覆盖本工作树已有改动。

## 9. L0 DoD

- [x] 规定文档、当前源码公共入口和 Bridge/Agent 边界已阅读并核对。
- [x] `git status`/worktree 已检查，用户改动已识别且保留。
- [x] 双入口、轻量/专业职责、路由/状态恢复和 Agent 能力缺口已写明。
- [x] 未决产品问题与明确延期能力单列，未替产品负责人决定高影响事项。
- [x] L1 进入条件、专业保护清单和禁止事项可直接拆任务。
- [x] 本阶段未修改 Vue/router/Agent/Bridge/Provider/后端生产代码，未部署、未重启 5173。
- [x] 产品负责人于 2026-09-12 确认 Q-01–Q-06；L1a 获准开始。
- [x] `pnpm docs:check` 与 `git diff --check` 在 L0 阶段通过。

## 10. 风险和阻塞项

| 风险/阻塞                                                  | 影响                                    | 处置                                                   |
| ---------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Q-01–Q-06                                                  | 已确认；不再阻塞 L1a                    | 后续阶段仍不得扩大到未批准的 Agent/Provider/执行能力。 |
| 当前原型挂在专业壳/Overview                                | 易把轻量版误解为简化皮肤                | L1 必须先拆独立 shell 与入口；原型仅作探索参考。       |
| 五类 Profile 为 0/unavailable，Agent capability gap 未闭合 | 不能承诺模型/设备/并行/物理 KV/SLO/执行 | 轻量界面 fail closed，延期到正式契约和证据闭合。       |
| 工作树有大量并行未提交改动                                 | 覆盖或混入风险                          | 只改本任务文档；不 reset/clean/stash/commit。          |
| Provider/live/calibration/held-out 未完成                  | 结果可信度和 Evidence 叙述受限          | 仅显示 canonical 状态和 provenance，不升级证据。       |

## L0 验证记录

本阶段计划/已执行命令：

```powershell
git status --short --branch
git worktree list
pnpm docs:check
git diff --check
```

结果：`pnpm docs:check` 通过（Checked 61 active Markdown files）；`git diff --check` 通过。未执行完整测试、Bridge unittest、E2E、部署、Provider 调用、credential 读取、正式 run、commit 或 push。
