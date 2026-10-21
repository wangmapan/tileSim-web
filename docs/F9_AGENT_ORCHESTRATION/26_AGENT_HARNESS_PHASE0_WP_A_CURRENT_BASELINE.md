# Agent Harness 阶段 0 / WP-A 当前基线与提案

## 2026-10-18 阶段 2 Bridge 增量

阶段 2 正式 successor revision 为 `2026-10-18.wpb.v1`，新增 `experiment_draft.v2`、
`draft_validation_report.v1`、`approval.v2`。API、权限、SQLite WAL、retention、stale/replay 和 22 类异常测试已补齐；
`would_create_run` 固定为 `false`，不开放 submit/cancel/retry/resume/autonomous optimization，Provider acceptance 仍 pending；定向阶段 2 测试现为 26 项。

当前 canonical schema-set revision：`sha256:c7a23b668d29415315e1eca4fd8dc0a5ebdff908b8420a6e187f33cc710efb42`。

### 2026-10-18 WP-B Web 接入补充

前端已登记正式 successor adapter：`src/lib/api/agent-harness.ts` 使用生成 client 接入 draft 创建/读取/删除/events、validation、approval 创建/读取/reject/revoke。adapter 对 successor contract revision、canonical schema-set、backend/principal/workspace、snapshot 与 digest 做 fail-closed 校验，并拒绝任何 `would_create_run !== false` 响应；写请求统一发送 `Idempotency-Key`。TanStack Query 的 key 保留 draft/approval identity、backend identity、schema-set revision 与 digest。

Task Center/Copilot 的公共 feature index 新增 Draft Card、Validation Block、Approval Block。展示状态、参数 diff、evidence refs、预算、风险、field result/JSON Pointer、stale/expiry/rejected/revoked 与单次使用提示；审批按钮仅通过上层 mutation 触发状态变化，不创建 run。服务端对象是唯一真相，不写 localStorage/Pinia，不开放 submit/cancel/retry/resume、自主优化或 Provider 能力。

> 文档 ID：`AO-26`
>
> 事实日期：2026-10-17
>
> 状态：本文件开头与第 1–7 节保留阶段 0 / WP-A 的 proposal-only 历史快照；当前 Bridge successor v1 与 Web 只读同步见第 0、8–11 节。除阶段 2 draft/validation/approval 记录接口外，执行写工具和自主运行仍未开放。

本文件是当前事实补充，不改写 `01_CURRENT_BASELINE_AND_GAPS.md` 的历史数字。契约草案位于
[`docs/contracts/proposals/agent-harness/README.md`](../contracts/proposals/agent-harness/README.md)，前端只读 fixture
adapter 位于 `src/entities/agent-orchestration/agent-harness-fixture-adapter.ts`。

## 0. 2026-10-17 Bridge successor contract current baseline

WP-A 后端已在 `bridge` 发布正式 successor contract：revision
`2026-10-17.wpa.v1`，schema identity 前缀 `tilesim.agent_harness.*.v1`，包括
`agent_operation`、`agent_turn`、`workflow_event`、`checkpoint`、`tool_call`、`tool_result`、
`experiment_draft`、`approval`、`study`、`candidate` 和错误 envelope。canonical OpenAPI 为
`bridge/contracts/openapi.json`，JSON Schema 位于 `bridge/contracts/schemas/agent-harness/`，Python
持久化/校验实现位于 `bridge/agent_harness/`。proposal revision `2026-10-17.wpa.v0` 不接受为运行时输入。

Bridge 现在使用 SQLite WAL migration 1 的单机 durable MVP，提供 bounded worker queue、重启恢复到
`recovery_required`、checkpoint、event replay/sequence 去重、side-effect ledger、retention/delete 和
Last-Event-ID SSE/polling。队列并发复用 `TILESIM_MAX_ACTIVE_RUNS`；不宣称分布式 HA，worker 不绕过既有
`/api/runs` 或 TileSimCLI，也不创建 run。

四个只读工具已发布：`get_capability_catalog`、`get_run_status`、`list_run_evidence`、
`query_verified_metrics`。工具 scope、run/snapshot binding、artifact manifest/SHA/bytes/JSON Pointer 和
principal 均 fail closed；write tools、shell/path/URL/network、自主优化和无人值守批量实验保持关闭。
Provider 状态为 `live_acceptance_pending`，没有 credential 或 fake 结果被当作 live acceptance。

当时的 Web 同步清单要求重新生成 operation DTO、schemas、OpenAPI operationId 和 capability types；该清单已在
后续只读接入批次完成，详见第 8–11 节。当前仍保留 proposal fixture 页面作为非运行时展示，不开放写工具。

本轮验证：`python -m py_compile`（Bridge Harness 文件）通过；Harness Python/HTTP 故障注入
`23 passed`；既有 Bridge `test_server.py` `185 passed`；Ajv Harness schema contract 通过；
`pnpm contracts:check`、schema-set drift check（当前 `sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73`）和
`git diff --check` 通过。未改 TileSim C++、未操作 5173、未调用真实 Provider。

## 1. 冻结基线

本节记录 2026-10-17 proposal-only 冻结时点；其中的 `not_exposed`、schema-set 和门槛结论保留为阶段 0
历史快照。Bridge successor v1 与 Web 只读接入的当前事实见第 0 节及第 8–11 节，不覆盖本节历史记录。

### 1.1 身份与 schema-set

| 项目                       | 当前事实                                                                                                                          | 状态           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Web 工作树                 | 已存在用户未提交改动；本工作包不覆盖、不 reset、不 commit                                                                         | `current_fact` |
| Bridge schema-set revision | `sha256:d7abac1889dd1b8a05bae7972fec3c7bd448053393daaf52afc3af893cde793e`（由 `python bridge/check_schema_set_revision.py` 读取） | `current_fact` |
| 正式 run API               | `tilesim.bridge.create_run_request.v1`，既有 `/api/runs`                                                                          | `current_fact` |
| 正式 Evidence Agent        | descriptor `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 为 v1 family                         | `current_fact` |
| Agent Harness schema-set   | 不在 Bridge `bridge/contracts` schema-set；仅有 `tilesim.agent_harness.*.v0` proposal identities                                  | `not_exposed`  |
| 当前 5173                  | 本任务不探测、不停止、不重启、不替换                                                                                              | `out_of_scope` |

### 1.2 Agent、Bridge、run 与 S0–S5 证据链

| 层             | 已支持 / 可校验 / 已暴露                                                                                                | 已执行或已验证的边界                                                                                                                  | 当前缺口                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Agent Copilot  | 当前页面上下文、能力投影、确定性字段草案、参数 diff、结构化输入预览                                                     | 页面 owner 再校验；不创建 run；不持久化服务端 operation                                                                               | 多工具循环、durable turn、operation/event/checkpoint、真实队列          |
| Evidence Agent | descriptor-driven 当前 run 只读解释；allow-list、run/snapshot/schema/SHA/Pointer/stable subject 校验；六态 availability | authenticated capability probe 路径和 fake-provider contract tests；live repetitions 与人工 citation entailment review 仍为 0/pending | 多轮 conversation、跨 run、工具调用、取消/SSE、durable recovery         |
| Bridge run API | capability、experiment schema、`POST /api/runs`、status/events/artifacts、幂等和 manifest                               | 真实 Bridge/CLI 语义以正式契约和运行 artifact 为准                                                                                    | Agent operation、队列、checkpoint、approval gateway、side-effect ledger |
| S0             | dense attribution / workload boundary 与现有报告展示                                                                    | 只展示已报告的 S0 evidence                                                                                                            | Agent 不重算指标或生成新 attribution                                    |
| S1             | runtime trace、scheduler/batch/KV 等已声明字段和现有 artifact                                                           | schema、run、SHA/bytes、provenance/fidelity 边界                                                                                      | Agent 不把可编辑字段升级为 profile/calibration                          |
| S2             | execution/kernel package 边界                                                                                           | 作为并列证据读取，不改 causal flow                                                                                                    | 无 Harness tool contract                                                |
| S3             | memory package / expected absence 语义                                                                                  | `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6` 中的 peer                                                                                        | 不从缺失值补造资源指标                                                  |
| S4             | device package / expected absence 语义                                                                                  | 只显示 Bridge 返回的 availability                                                                                                     | 真实设备 profile 与校准不可用                                           |
| S5             | collective package / expected absence 语义                                                                              | 只显示 Bridge 返回的 availability                                                                                                     | 不将 S3/S4/S5 串成新因果链                                              |

当前不能宣称：多工具循环、任务队列、checkpoint、自动优化、真实 Provider 生产能力、真实 GPU、校准或 held-out
validation。现有五类正式 Profile records 仍为 `0/unavailable`；Run Intake v2 仍不是 `/api/runs` 的执行入口。

## 2. 能力矩阵与权限矩阵

状态语义固定为：`available`（正式能力可调用）、`unavailable`（后端/Provider 当前不可用）、`not_exposed`（契约或
权限没有发布）、`rejected`（确定性校验拒绝）、`failed`（已执行但失败）、`cancelled`（用户取消且 late result 被隔离）、
`completed`（正式终态）。fixture 的 `completed` 只表示 reducer 投影完成，不能代表真实后端完成。

| 能力                            | Web 展示                            | Bridge 正式入口                                  | 当前状态                                              | 阶段 1 前门槛                               |
| ------------------------------- | ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------- |
| capability/schema 读取          | 是                                  | `/api/manifest`、descriptor/capability endpoints | `available`（按发布 revision）                        | 现有 revision binding 不回退                |
| 当前 run/status/artifact 读取   | 是                                  | 既有 run-bound read APIs                         | `available`（有合法 run 时）                          | 保留 run/snapshot/SHA/Pointer               |
| Evidence Agent 解释             | 是                                  | F9 descriptor + analysis endpoint                | provider 状态按 descriptor；live acceptance `pending` | 不将 fake fixture 计入 live                 |
| 参数草案/校验                   | 是（页面 owner）                    | 既有 schema/preview 路径                         | `available` 作为草案；`creates_run=false`             | 不绕过表单 validator                        |
| `agent_operation`               | fixture-only                        | 无                                               | `not_exposed`                                         | 正式 schema、store、replay 评审             |
| `workflow_event` / `checkpoint` | fixture-only                        | 无                                               | `not_exposed`                                         | durable runtime + ledger                    |
| tool call/result                | 只读展示模型                        | 无 Harness tool registry                         | `not_exposed`                                         | closed tool schema + policy gate            |
| approval                        | 只读提案模型                        | 无 approval gateway                              | `not_exposed`                                         | server principal/policy/expiry              |
| submit/cancel/retry             | 既有手工 run UI 不等于 Harness 工具 | `/api/runs` 不是 Harness submit                  | Harness `not_exposed`                                 | approval + idempotency + side-effect ledger |
| study/candidate/optimization    | 无真实入口                          | 无                                               | `not_exposed`                                         | 阶段 5 前不得自主提交                       |

### 2.1 最小权限

| 权限                        | 阶段 0/WP-A                  | 允许的输入                                    | 禁止                                         |
| --------------------------- | ---------------------------- | --------------------------------------------- | -------------------------------------------- |
| `agent:read_capability`     | 只读记录                     | manifest/descriptor identity 与 revision      | 修改能力目录                                 |
| `agent:read_evidence`       | 复用既有 Evidence Agent 边界 | 当前 run allow-list、verified record identity | 跨 run、任意文件、URL、shell                 |
| `agent:draft_experiment`    | fixture/页面本地草案         | schema 可表达字段、diff、digest               | 创建 run、写 localStorage 当 operation store |
| `agent:validate_experiment` | 复用确定性 validator         | closed request、snapshot binding              | 放宽 schema、补造 profile                    |
| `agent:submit_experiment`   | `not_exposed`                | 无                                            | 未批准写操作、自动队列                       |
| `agent:cancel_experiment`   | 仍由现有用户 run UI 负责     | 当前 run API 已有语义                         | 由 Harness fixture 伪造取消                  |
| `agent:manage_study`        | `not_exposed`                | 无                                            | 自动优化、跨 run 排名                        |

工具 scope 必须是闭合的 run/snapshot/artifact allow-list；`allow_shell=false`、`allow_arbitrary_path=false`、
`allow_arbitrary_url=false`、`allow_network=false`。artifact 文本、用户输入、模型输出和 fixture 均是不可信数据。

## 3. 数据生命周期与删除语义

阶段 0/WP-A 只保留源码 fixture 和已展示的摘要，不保存任何用户 operation。未来正式实现必须分层留存：

| 数据             | 最小保留内容                                                            | 禁止保留                                                                     | 删除/过期                                                             |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| operation/turn   | identity、state、revision、digest、计数、错误码和展示摘要               | credential、hidden reasoning、Provider raw response、未展示 evidence payload | 用户删除按 operation graph 原子删除；重复删除返回同一已删除结果       |
| workflow event   | event id、sequence、state、payload digest、producer revision            | 完整 artifact/claims raw payload                                             | retention 到期删除；删除失败必须 `retention_delete_failed`            |
| checkpoint       | state digest、completed side-effect identities、resume policy           | 工具原始输入/输出和 secret                                                   | 仅在 revision 匹配时可恢复；旧 revision 标 stale                      |
| tool call/result | tool/revision、input/output digest、permission、scope、terminal outcome | 任意 shell/path/URL、完整 raw output                                         | 与 operation 一致删除；未知副作用不能靠删除掩盖                       |
| draft/approval   | diff digest、snapshot、validator/policy revision、expiry、principal     | 未展示完整请求 payload、credential                                           | draft/approval expiry 后只读；schema/run/snapshot/policy 变化即 stale |
| study/candidate  | objective/constraint/budget digest、candidate identity 和引用           | 自动优化历史、未验证 metrics                                                 | 阶段 5 未发布；proposal 删除不影响历史 run                            |

Fixture adapter 是内存只读函数，不使用 `localStorage`，不创建 run，不写 `runs/`，不承载服务端真相。

## 4. WP-A 状态与恢复语义

提案对象与 JSON Schema 见 [`docs/contracts/proposals/agent-harness/README.md`](../contracts/proposals/agent-harness/README.md)。
所有对象携带 `schema_identity`、`contract_revision`、`operation_id`、`turn_id`、`run_id`、`snapshot_digest` 和
`policy_revision`；proposal identity 不加入当前 Bridge schema-set。

```text
draft → submitted → queued → running
                          ├→ waiting_tool
                          ├→ waiting_approval
                          ├→ retrying
                          ├→ completed
                          ├→ failed
                          ├→ cancelled
                          ├→ recovery_required
                          └→ manual_intervention_required
```

- terminal `completed` / `failed` / `cancelled` 不允许原地回到 `running`；恢复必须是新 revision/新事件，或创建新 operation。
- `retrying` 只接受明确 `retryable=true` 的失败；`unknown_outcome` 进入 `recovery_required` 或
  `manual_intervention_required`，禁止盲目重试。
- event 以 `event_id` 去重，以单调 `sequence` + `dedupe_key` 防重；重复 sequence 冲突、乱序或缺口进入恢复检查。
- 取消建立 cancellation fence；迟到结果只记为 `cancelled_late_result`，不得覆盖取消终态。
- schema-set、run、snapshot、policy 或 workflow revision 变化时，旧 draft/approval/checkpoint 变为 stale；不自动复用旧审批。
- approval digest 绑定精确 draft digest、principal、policy revision、snapshot 和 expiry；过期/拒绝/内容变化都不产生副作用。
- 错误包含稳定 `code`、`field_path`（JSON Pointer 或 `null`）、`retryable`、`terminal_failure` 和 `unknown_outcome`。

## 5. 评测资产

[`tests/fixtures/agent-harness/phase0-evaluation-manifest.json`](../../tests/fixtures/agent-harness/phase0-evaluation-manifest.json) 固定
19 个互斥 case，拆为 train、validation、test、held-out-adversarial。fixture 只验证契约/reducer/展示边界，不能计为
Provider live repetition、真实 run 或 calibration evidence。

覆盖项：成功调用、参数非法、capability 不可用、schema revision 不一致、stale draft、approval 过期、Provider timeout、
Bridge 重启、worker 崩溃、重复 event、乱序 event、重复 resume、取消、unknown outcome、prompt injection、tool scope 越权、
跨 run 泄漏、重复副作用。所有副作用期望均为 `0`；held-out-adversarial 不参与调参。

## 6. 阶段 0 / WP-A Go/No-Go

以下结论属于 proposal-only 冻结时点的历史门槛；随着 Bridge successor v1 已发布，阶段 1 仅限只读观察的当前
Go/No-Go 见第 8–11 节。写工具、自主运行、审批/队列写入和真实 Provider 仍保持 NO-GO。

当前结论：**NO-GO for Phase 1**。

已满足：能力矩阵、数据生命周期、权限矩阵、互斥评测 manifest、proposal schema/OpenAPI、状态机、错误和恢复规则、前端
fixture adapter 与组件/单元测试。

未满足的进入阶段 1 条件：

1. Bridge 尚未发布 `agent_operation` / `workflow_event` / `tool_call` 等正式 successor schema、OpenAPI 和生成物；
2. 没有 durable operation store、checkpoint store、side-effect ledger、queue、resume/cancel API；
3. 没有只读 tool registry 的真实 capability/policy endpoint；
4. Provider live acceptance repetitions、人工 citation entailment review 仍待完成；
5. 当前工作包未执行或开放任何自主运行、自动优化或真实 Provider 调用。

只有以上门槛在后端正式发布并通过故障注入、权限、留存、回放和跨 run 隔离验收后，才可进入阶段 1。

## 7. 本工作包验证记录

2026-10-17 在不连接/重启 `127.0.0.1:5173` 的前提下执行：

- 相关 Harness Vitest：**3 files / 11 tests passed**；全量 Web Vitest：**109 files / 1129 passed / 8 skipped**。
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`：exit 0。
- 全量 ESLint：exit 0，2 个既有 `vue/one-component-per-file` warning，无 error；新增文件定向 ESLint：exit 0。
- 新增/修改文件 Prettier：exit 0。
- `node scripts/check-doc-links.mjs`：`Checked 68 active Markdown files.`
- `node scripts/check-frontend-dependencies.mjs`：`Frontend dependency boundaries passed for 326 source files.`
- `node scripts/generate-contract-types.mjs --check`、`node scripts/generate-bridge-client.mjs --check`：exit 0；`python bridge/check_schema_set_revision.py`：保持
  `sha256:d7abac1889dd1b8a05bae7972fec3c7bd448053393daaf52afc3af893cde793e`。
- `Push-Location bridge; python -m unittest test_server.py; Pop-Location`：**185 tests / OK**。
- `git diff --check`：exit 0。
- 未运行 e2e；本工作包没有改动路由、真实 run、Bridge endpoint 或部署资产。

## 8. 阶段 1 Web 只读接入后续记录（2026-10-17）

本节登记 WP-A 后续前端接入，不覆盖第 0–7 节的阶段 0 历史基线。Bridge 已正式发布 successor contract：revision
`2026-10-17.wpa.v1`、schema-set revision
`sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73`。Web 通过生成的 v1 DTO/client 和 API adapter
接入四个只读工具：`get_capability_catalog`、`get_run_status`、`list_run_evidence`、`query_verified_metrics`。

接入边界：adapter 校验 API/version、schema-set、contract/tool revision、backend/run/snapshot、artifact manifest 的
schema/SHA/bytes/JSON Pointer，以及 `succeeded`、`rejected`、`retryable_failure`、`terminal_failure`、
`unknown_outcome`；operation projection 使用 durable event snapshot，支持 event 去重/乱序拒绝、terminal fence、SSE
`Last-Event-ID` 和 polling fallback。只读 operation metadata 不等于仿真 run 副作用；Web 没有写工具 client surface。

因此本文件的第 6 节“阶段 1 前门槛”中关于“后端尚未发布”的表述是阶段 0 当时事实；阶段 1 Web 进入 **只读 GO**，但
写工具、自主优化、无人值守实验、checkpoint/approval 写入和 live Provider acceptance 仍为 **NO-GO**。

## 9. WP-C 只读 Task Center 后续记录（2026-10-17）

Web 增加 `AgentHarnessTaskCenter`，通过正式 operation list adapter 展示当前 run 绑定的任务 snapshot；它不读取或写入
localStorage 作为任务 store，跨 run operation 会被过滤，operation list 不可用时显示 `unavailable`。取消、恢复、重试和
审批写入继续保持 `not_exposed`，没有新增后端能力、写请求或 run 副作用。

本批验证：Harness 定向 Vitest **5 files / 24 tests passed**；全量 Web Vitest **111 files / 1142 passed / 8 skipped**；
`vue-tsc --noEmit`、全量 ESLint（2 条既有 warning，无 error）、目标文件 Prettier、`docs:check`、`deps:check`、
`contracts:check`、生产构建和 `git diff --check` 均通过。未操作 `127.0.0.1:5173`。

## 10. 事件快照与 WP-D runtime 评估后续记录（2026-10-18）

Task Center 现在先按当前 run 过滤 operation list，再读取正式 operation detail/events；跨 run operation 不会触发 detail
读取。单个 detail 读取失败保持 `unavailable`，事件 sequence 缺口进入 `recovery_required`；operation card 展示已校验
的 sequence、node、state、created_at 和终态标记。前端仍无 cancel/resume/retry/checkpoint/approval 写入。

WP-D 的比较矩阵和决策见 [`27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md`](27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md)：
当前只保留 Bridge 自有 SQLite WAL + bounded worker 作为只读 operation source，不引入第二个 workflow runtime。

本轮验证：Harness 定向 Vitest **3 files / 18 passed**；全量 Web Vitest **111 files / 1145 passed / 8 skipped**；Bridge
`test_server.py + test_agent_harness.py` **208 tests / OK**；Schema Ajv、`contracts:check`、`docs:check`、`deps:check`、
`vue-tsc --noEmit`、目标 lint/Prettier、生产构建和 `git diff --check` 通过。未操作 `127.0.0.1:5173`。

## 11. Task Center 只读刷新后续记录（2026-10-18）

Task Center 对正式 operation snapshot 使用 5 秒只读刷新；completed/failed/cancelled、recovery_required 和
manual_intervention_required 到达后停止刷新。刷新不调用任何 Harness 写入口、不创建 run，也不把浏览器状态当作服务端
operation store。定向 Harness 测试为 **3 files / 19 passed**；全量 Web Vitest 最终收口为 **111 files / 1146 passed /
8 skipped**。第 10 节的 **1145/18** 是同日刷新逻辑完成时的中间快照，保留作历史记录，不作为最终门禁数字。

## 12. 阶段 2 草案 / 校验 / 审批前置审计（2026-10-18）

阶段 2 当前结论：**NO-GO**。本审计没有新增前端写 surface、fixture 成功态或本地草案/审批 store。

当前正式 v1 只发布了 `agent_operation`、`workflow_event`、四个只读工具和 operation/checkpoint/approval 的后端内部
能力；不能据此宣称阶段 2 的 draft/validation/approval 闭环已经发布。具体缺口如下：

- canonical OpenAPI 没有 `/api/agent/drafts`、`/validate`、draft events、draft delete 或按 draft 绑定 approval 的公开端点；
  现有 `/api/agent/approvals` 与 `/api/agent/approvals/{approval_digest}` 标记为 backend-only，且没有 draft 资源和
  `reject` / `revoke` 动作的正式路由。
- `tilesim.agent_harness.experiment_draft.v1` 目前只有 `draft_digest`、`creates_run=false`、`diff_digest` 和
  `validator_revision` 四个专有字段；没有阶段 2 要求的 field diffs、assumptions、evidence refs、budget、risk、status、
  expiry、parameter catalog revision 或 input snapshot binding。
- 当前没有 `draft_validation_report` schema identity、OpenAPI response、生成 client DTO 或正式 validator revision binding。
- 当前生成 client 没有 draft/validation/approval 的操作方法；Bridge approval handler 只接受最小 approval 元数据，未形成
  草案 digest、snapshot、schema-set、backend、policy、principal 和一次性消费的完整闭合语义。
- 现有 `parameter-catalog.ts`、`parameter-edit.ts`、结构化输入和 create-run validator 只能支持页面内预览/校验，不能
  替代服务端 draft store、权限、留存、stale/expiry/revoke 或审批审计。

因此阶段 2 前端只登记 contract gap，不实现批准/拒绝按钮、不调用 `/api/agent/approvals`、不把 proposal fixture 显示为
正式草案，不把 localStorage 或 Pinia 状态当作服务端真相，也不改变 `/api/runs`、TileSimCLI 或既有仿真逻辑。进入阶段 2
实施前，后端必须先发布闭合 draft/validation/approval Schema、OpenAPI、生成物、权限与持久化/删除语义，并通过
schema-set drift、幂等、stale/expiry/reject/revoke/replay 和零 run 副作用门禁。

# 2026-10-18 阶段 2 Bridge 增量

阶段 2 正式 successor revision 为 `2026-10-18.wpb.v1`，schema identities 为
`tilesim.agent_harness.experiment_draft.v2`、`tilesim.agent_harness.draft_validation_report.v1`、
`tilesim.agent_harness.approval.v2`。draft/validation/approval API 已注册并绑定 principal、workspace、snapshot、
schema-set、backend、policy 和 digest；SQLite WAL 保存有界摘要和事件。`would_create_run` 固定 false，submit、cancel、
retry、resume、autonomous optimization 和 Provider live acceptance 均未开放。阶段 2 定向 HTTP 测试覆盖 22 类异常/越权，
并断言创建、校验、审批、拒绝、撤销、删除全流程 run 副作用为 0；validation 与 approval action 均有 durable idempotency
replay fence，events/SSE 读取使用 `agent:read_draft`。

# 阶段 3A successor 记录（2026-10-18）

在 WP-A/WP-B 基线之上，Bridge 新增 `2026-10-18.wpc.v1` 受控 execution contract。该记录不改变 WP-A/WP-B
已发布语义：execution operation 单独绑定 `draft_id`、`approval_id`、validation、digest、snapshot、backend、
schema-set、policy、workflow revision、idempotency key 和唯一 `run_id`。

`POST /api/agent/executions` 是 submit gateway；approval consume 采用 durable single-use fence。它把 create-run
side effect 写入同一 SQLite WAL ledger，然后通过现有 `/api/runs` 创建运行并由现有 bounded worker 监控。SSE/polling
使用 durable event sequence 与 `Last-Event-ID`，worker/Bridge 重启将未决未知副作用收敛到
`recovery_required`，不自动重提。`cancel` 建立 cancellation fence，`retry` 仅接受明确 retryable 且无 unknown
outcome 的失败，`resume` 先核对 checkpoint/schema/backend/policy identity；artifact manifest 失败不会伪造 completed。

## 2026-10-18 阶段 3A 收口增量（当前工作树，未部署）

本轮新增 26 类故障注入矩阵 `AH3-F01`–`AH3-F26`（见
`bridge/test_agent_harness_stage3_matrix.py`），并用现有 hosted HTTP 测试覆盖 submit/status/events/SSE/result
和唯一 `/api/runs` 入口。覆盖 draft/approval admission 与 digest/revision/identity fence、幂等 replay/conflict、
队列容量、worker/Bridge restart、create-run timeout/non-zero/unknown、event dedupe/sequence、cancel late result、
retry/resume、artifact manifest identity、retention/delete 和 terminal fence。

执行边界已收口：`failed` 只能通过显式 retry 重新打开，`recovery_required` 只能显式 resume/cancel；manifest 在 result
reference 前按当前 run directory 重新校验 schema-set、run id、allow-list、SHA-256、bytes 与 rejection set；删除 operation
会清除 request/result/error payload 并隐藏 stage3 lookup。故障结果只保留 bounded error code、root JSON Pointer、
retryable/unknown_outcome、operation state 和 side-effect ledger 状态。

仓外 synthetic hosted smoke 已完成一次，证明合法 draft → validation → approval → execution → `/api/runs` → result 的
单 run 链路、事件 sequence `1..5`、SSE/polling 可观察、manifest/provenance/fidelity 绑定，以及同 key replay/不同 payload
409。该 smoke 仅是 synthetic exploratory evidence，不改变历史数字，也不计为 live Provider acceptance。

阶段 3A 当前结论仍为 **NO-GO**：Provider acceptance 仍为 `live_acceptance_pending`，正式发布门禁尚待独立审查；
自主优化、自动候选、多工具自主循环和无人值守实验继续保持未开放。

## 2026-10-18 阶段 3A 独立发布审查增量

release-gate manifest/test entry 已落地：`bridge/agent_harness/release_gate.py`、
`bridge/agent_harness/hosted_smoke.py`、`bridge/run_agent_harness_stage3_release_gate.py` 和
`bridge/test_agent_harness_stage3_release_gate.py`。入口登记 `AH3-F01`–`AH3-F26` 的稳定结果与身份/副作用/删除字段，
并可在仓外临时目录复跑 synthetic hosted smoke。当前 26/26 pass，hosted smoke pass；Provider 仍
`live_acceptance_pending`，人工 evidence/citation review `not_run`，阶段 3A 保持 **NO-GO**，不进入前端 execution UI。

Provider acceptance 仍为 `live_acceptance_pending`；本阶段不开放自主优化、自动候选生成或无人值守批量实验。

## 2026-10-18 阶段 3A acceptance / review 准备增量

新增 `bridge/agent_harness/acceptance_prep.py`、`bridge/run_agent_harness_stage3_acceptance_prep.py` 和定向测试，
登记仓外 redacted Provider acceptance manifest 与人工 evidence/citation review package。Provider manifest 使用
`tilesim.agent_harness.provider_acceptance_manifest.v1` / `2026-10-18.3a.acceptance.v1`，review package 使用
`tilesim.agent_harness.evidence_citation_review_package.v1` / `2026-10-18.3a.review.v1`；当前 probe 为
`not_run`/`not_configured`、success repetition 为 0、review 为 `not_run`。未读取或持久化 credential、raw
Provider response、hidden reasoning 或完整 evidence payload。阶段 3A 仍 **NO-GO**，不得启动阶段 3B。

## 2026-10-18 阶段 3A 最终发布验收复核（当前工作树，未部署）

本轮 release-gate 使用正式 Bridge、`2026-10-18.wpc.v1`、schema-set
`sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50` 和当前
`D:\tileSim\build-ca1\Release\TileSimCLI.exe`。AH3-F01–AH3-F26 为 `26/26 pass`，release-gate 定向套件为
`54/54 pass`，hosted synthetic smoke 为 `pass`：run `run-20261018-223907-c3856146`，事件 `1..5`，单 run，
SSE/polling 序列一致，同 key replay 不增 run，不同 payload 返回 `409 payload_conflict`。provenance 仍为
`synthetic_trace`、claim scope 仍为 `exploratory`，不升级为真实校准或 Provider acceptance。

本轮仓外脱敏 acceptance manifest：
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\provider-acceptance-manifest.json`
（`sha256:142056eac084dcf47f4539a60f923e9b779cc4103c8d5ae14462b94253076abe`）；review package：
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\evidence-citation-review-package.json`
（`sha256:963ed92dc6064a3f93ff5cf86a74e42cd49683e8d9c86fc3dbf3fdd38ddbc567`）。Provider 状态为
`live_acceptance_pending`，probe 为 `not_run/not_configured`，四个固定 acceptance case lane 均 `not_run`，成功
repetition 为 `0`；人工 review 为 `not_run`、reviewer 数为 `0`。release-gate manifest digest 为
`sha256:c5cc6e0f8381be31f53f82cfbb96f97e174d9bf7fc93c5dd714d4aa3281922c5`。

因此阶段 3A 仍为 **NO-GO**，阻塞项仅包括真实 Provider capability/acceptance repetition 和独立人工
evidence/citation review；不得以 synthetic smoke、fixture 或本地模拟响应替代，亦不得启动阶段 3B。

## 2026-10-18 阶段 3A 延续开发：部署与 Provider 诊断（当前工作树，未部署）

acceptance-prep 新增纯函数部署身份诊断，并支持显式 `--deployment-manifest`。默认只读取当前本地
`runtime/backend-current.json`（存在时），不会手工修改或伪造 manifest 匹配。诊断输出仅包含路径、schema/revision/digest
和布尔状态；schema 不一致时返回 bounded `deployment_schema_mismatch`，不进入 acceptance。

本地当前 manifest 的实际诊断为：manifest schema-set `sha256:d7abac1889dd1b8a05bae7972fec3c7bd448053393daaf52afc3af893cde793e`，
当前源码 schema-set `sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50`，schema 不匹配；source/build revision
及 state digest 相互一致，但整体 `identity_match=false`。Provider 环境未从普通终端继承时保持
`not_run/not_configured`；配置进程测试只检查公开 provider/model/revision metadata，绝不暴露 API key。
任一 source/build revision 或 state digest 缺失时诊断保持 `deployment_identity_incomplete`，不会把缺失升级为匹配。

本轮没有执行真实 Provider acceptance、repetition 或人工 review；Provider 仍 `live_acceptance_pending`，四个 case 仍
`not_run`，成功 repetition 为 `0`，reviewer 为 `0`，阶段 3A 继续 **NO-GO**。
