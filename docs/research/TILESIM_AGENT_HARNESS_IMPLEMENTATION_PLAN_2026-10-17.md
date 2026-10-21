# TileSim Agent Harness 分阶段开发计划

> 计划日期：2026-10-17  
> 文档性质：实施计划，不代表新能力已经发布  
> 适用范围：TileSim Web、Bridge、Agent 编排服务、实验执行和后续桌面封装  
> 当前基线：Web 工作树中的受控配置助手、只读 Evidence Agent、现有 Bridge run API 和 S0–S5 证据链

## 1. 目标与现实边界

### 1.1 目标

把当前“小拓”从受控配置 Copilot 演进为一个可审计、可恢复、有限自主的实验研究 Agent：

```text
理解实验目标
  → 查询能力和当前状态
  → 生成候选配置
  → 确定性校验与预算评估
  → 用户确认或受限自主授权
  → 排队并执行实验
  → 读取已验证结果
  → 比较候选并更新最佳方案
  → 满足停止条件或继续下一轮
```

“自主”在本计划中不是无限制地让模型运行命令，而是：

- 模型负责理解目标、提出计划、选择允许的工具和解释结果；
- 确定性代码负责参数校验、资源约束、指标比较、权限和停止条件；
- Bridge/TileSimCLI 负责真正的运行和证据生成；
- 用户预先给出的预算、范围和授权决定 Agent 能走多远。

### 1.2 当前已经具备的基础

当前实现可以复用：

- 页面上下文、参数目录、结构化建议和人工确认；
- Bridge 的能力目录、实验 Schema、run 创建、幂等键、SSE 状态和 artifact manifest；
- S0–S5 的 provenance、fidelity、schema、run、SHA-256、bytes 和 JSON Pointer 校验；
- 只读 Evidence Agent 的 provider descriptor、snapshot、citation 和失败语义；
- 本地有限期会话缓存和配置页/结果页路由边界。

当前还没有、不能假定已经存在：

- 正式的多工具循环；
- 工具结果自动回传模型的版本化契约；
- 持久任务队列和重启后恢复；
- Agent operation/checkpoint；
- 人工批准后的统一执行网关；
- 跨 run 可比性和自动优化研究；
- 真实 Provider、真实校准或生产级自主运行验证。

### 1.3 必须接受的边界

这项工作不能只靠前端完成。前端可以先实现 capability-driven UI、任务观察、审批和恢复展示，但以下能力必须由 Bridge/后端提供正式契约：

- 工具注册和权限判定；
- operation、event、queue、checkpoint 和恢复；
- 实验提交、取消、重试和副作用账本；
- 结果快照、候选比较和优化状态；
- 用户/工作区权限、服务端会话和留存策略。

在后端契约未发布前，前端只能使用 fixture 或只读适配器开发，不能把本地状态伪装成真实自主执行。

## 2. 成功定义

### 2.1 首个可用版本的成功标准

完成阶段 0–4 后，用户可以：

1. 用自然语言描述一个当前支持范围内的实验目标；
2. 查看 Agent 识别出的目标、假设、缺口和候选配置；
3. 查看参数 diff、约束、预计预算和证据来源；
4. 明确批准后将实验加入队列；
5. 在 Bridge 重启或 Worker 退出后恢复任务，而不重复已完成副作用；
6. 查看真实运行状态和已验证结果；
7. 取消任务、重试可重试错误，或接管无法安全恢复的任务。

完成阶段 5 后，才允许进入“受限自主优化”：用户预先设置参数范围、运行次数、时间/资源预算和停止条件，Agent 可以自动提交下一轮候选，但不能突破这些边界。

### 2.2 发布硬门禁

以下任何一项不满足，都不能宣称进入自主执行：

- 未批准的写操作副作用为 0；
- 未授权工具调用为 0；
- 同一幂等键、同一 payload 不产生重复 run；
- checkpoint 恢复不重复已完成的 Provider/tool/run 副作用；
- 取消后的迟到结果不进入当前会话或最佳候选；
- run、artifact、schema、SHA、bytes、provenance 和 fidelity 身份校验为 100%；
- synthetic 证据不升级为 real、calibrated 或 held-out 结论；
- credential、hidden reasoning、Provider raw response 和未展示的完整 evidence payload 不进入持久化；
- 所有失败、拒答、超时、取消、恢复和人工接管路径都有自动化测试。

### 2.3 不用作成功标准的内容

以下内容不能单独证明 Agent 已经可用：

- 能够生成一段看起来合理的自然语言；
- fixture 中成功调用一次模型；
- 前端显示了“队列”或“正在优化”动画；
- 模型输出了一份没有经过 Schema 校验的 JSON；
- 一次 synthetic run 的性能数字变好；
- 引入了某个 Agent 框架、向量库或 MCP。

## 3. 目标架构

```text
Web / Desktop UI
       │
       ▼
Agent Gateway
  ├─ conversation/turn
  ├─ model gateway
  ├─ tool policy
  └─ budget policy
       │
       ▼
Durable Workflow Adapter
  ├─ operation state machine
  ├─ event log
  ├─ checkpoint store
  ├─ retry/cancel/resume
  └─ side-effect ledger
       │
       ├──────────────► Tool Registry / Permission Gateway
       │                         ├─ read-only evidence tools
       │                         ├─ draft/validate tools
       │                         └─ approved submit tool
       │
       ▼
Bridge Control Plane
  ├─ capability and schema
  ├─ create-run / status / cancel
  ├─ artifact manifest and verified reads
  └─ backend identity
       │
       ▼
TileSimCLI / execution workers
       │
       ▼
Verified run artifacts → comparison/evaluation → next candidate
```

### 3.1 组件职责

| 组件             | 负责                                           | 不负责                                   |
| ---------------- | ---------------------------------------------- | ---------------------------------------- |
| Web/桌面 UI      | 展示任务、审批、进度、差异、结果和错误         | 不决定能力、不执行 shell、不维护运行真相 |
| Agent Gateway    | 模型调用、上下文、工具选择、预算和模型输出解析 | 不绕过 Bridge，不直接写运行目录          |
| Workflow Adapter | 状态、事件、checkpoint、恢复、取消、重试       | 不定义仿真指标和硬件事实                 |
| Tool Registry    | 工具 Schema、权限、幂等、输入/输出 digest      | 不暴露任意 shell、文件或 URL             |
| Bridge           | 正式契约、能力、运行、工件和身份校验           | 不把模型猜测当成执行事实                 |
| Optimizer        | 候选生成、指标比较、约束和停止条件             | 不伪造指标、不改变历史报告               |
| TileSimCLI       | 实际仿真和报告生成                             | 不理解用户自然语言                       |

### 3.2 运行方式选择

第一版不立即绑定具体编排框架。先定义 TileSim 自有的 operation/event/checkpoint/tool 契约，再做最多两个候选的限时验证：

- 一个轻量的自有状态机/worker adapter；
- 一个成熟 durable workflow runtime，例如 Temporal、DBOS、Restate、LangGraph durable adapter 或同等方案。

选择标准：Windows/WSL 兼容性、持久化、重启恢复、取消、幂等、备份迁移、可观测性、部署复杂度和维护成本。不得同时引入多个 workflow runtime。若候选都超过运维预算，保留同步实现，不强行上框架。

MCP 只作为未来外部适配层，内部 Bridge contract 仍是事实来源；A2A 和多 Agent 不属于首个可用版本的前置条件。

## 4. 核心契约与状态模型

### 4.1 最小正式对象

所有对象都必须有 schema identity、revision 和生成类型：

| 对象               | 作用                     | 必须绑定                                                     |
| ------------------ | ------------------------ | ------------------------------------------------------------ |
| `agent_operation`  | 一次完整目标任务         | operation、conversation、policy、model、workflow revision    |
| `agent_turn`       | 一轮用户/模型交互        | turn、parent turn、snapshot、conversation revision           |
| `workflow_event`   | 可重放的状态事件         | event ID、sequence、operation、node、created_at              |
| `checkpoint`       | 节点完成后的恢复点       | operation、workflow/code/policy revision、state digest       |
| `tool_call`        | 一次工具调用请求         | tool revision、input digest、approval/permission             |
| `tool_result`      | 工具的结构化结果         | output identity、status、evidence references                 |
| `experiment_draft` | 尚未执行的候选配置       | input snapshot、field diff、validator revision、expiry       |
| `approval`         | 用户批准某个精确草案     | draft digest、principal、policy、expiry                      |
| `study`            | 一组受预算约束的优化实验 | objective、constraints、budget、stop policy                  |
| `candidate`        | 一次候选配置和结果       | candidate digest、run ID、metrics snapshot、parent candidate |

### 4.2 Operation 状态机

```text
draft
  → submitted
  → queued
  → running
      ├─ waiting_tool
      ├─ waiting_approval
      ├─ retrying
      ├─ completed
      ├─ failed
      └─ cancelled
```

规则：

- terminal operation 不原地改回 `running`；恢复产生新事件并保留原状态；
- `retrying` 只能用于明确标记为 retryable 的失败；
- 结果未知时进入 `recovery_required` 或 `manual_intervention_required`，不得盲目重提；
- 取消建立 cancellation fence，迟到事件只能记录，不能改变当前终态；
- 新的 run、schema、backend identity 或 policy revision 会使旧 draft/approval/checkpoint 失效；
- 客户端必须带 `expected_revision`，并发更新冲突返回稳定错误。

### 4.3 不保存的内容

持久化只保留继续任务所需的最小状态：

- 身份、状态、revision、digest、计数、错误码和引用；
- 已展示的摘要、参数 diff 和 artifact identity；
- 工具输入/输出的 digest，不保存完整 raw payload，除非契约明确允许且有留存期限。

禁止保存 credential、hidden reasoning、Provider raw response、未展示的完整 artifact/evidence payload。会话与任务都必须支持过期、用户删除和管理员按策略清理。

## 5. 工具设计

### 5.1 工具分级

#### L0：只读工具

- `get_capability_catalog`
- `get_experiment_schema`
- `get_run_status`
- `list_run_evidence`
- `get_subject_record`
- `query_verified_metrics`
- `get_fidelity_and_provenance`
- `compare_compatible_runs`

#### L1：无副作用草案工具

- `draft_experiment_request`
- `validate_experiment_request`
- `estimate_experiment_budget`
- `compare_with_current_inputs`
- `recommend_next_candidate`

#### L2：有副作用工具

- `submit_experiment`
- `cancel_experiment`
- `retry_experiment`

L2 工具必须要求人工审批或预先声明的受限自主 policy；第一版只开放 `submit_experiment`，取消和重试先由用户界面触发。

### 5.2 工具调用协议

每次工具调用至少包含：

```json
{
  "operation_id": "...",
  "turn_id": "...",
  "tool_name": "validate_experiment_request",
  "tool_revision": "...",
  "input_digest": "sha256:...",
  "input": {},
  "run_scope": { "run_id": null, "snapshot_digest": "..." },
  "approval_id": null,
  "idempotency_key": "..."
}
```

返回值必须区分：

- `succeeded`：结果完整且可继续；
- `rejected`：输入或权限不允许；
- `retryable_failure`：外部暂时失败；
- `terminal_failure`：不可恢复失败；
- `unknown_outcome`：副作用是否发生无法确认。

模型只接收工具契约规定的结构化结果；工具调用结果回传后，模型必须重新生成下一动作，并再次通过 policy gate。工具不能通过文本偷偷注入新的权限或扩大 run/artifact scope。

### 5.3 第一批工具的落地顺序

1. `get_capability_catalog`：验证能力发现和版本隔离；
2. `get_run_status`：验证 operation/run 绑定；
3. `list_run_evidence`：验证 artifact identity 和权限；
4. `query_verified_metrics`：验证无损数值和证据引用；
5. `draft_experiment_request`：验证草案、diff 和 stale；
6. `validate_experiment_request`：验证 Schema、约束和预算；
7. `submit_experiment`：最后才开放，并必须有 approval。

每增加一个工具，必须增加成功、参数错误、越权、重复调用、超时、重启、错误 revision 和 prompt injection 测试。

## 6. 分阶段开发路线

> 周期为单个熟悉现有仓库的全职工程师、后端执行依赖可用、无需同时建设真实 GPU 校准的粗略估计。多个团队可以并行，但契约和集成阶段必须串行。

### 阶段 0：冻结基线和发布门禁（1–2 周）

**目标**：让后续工作有可测的起点，不改变当前产品行为。

**工作内容**：

- 冻结当前 Web/Bridge/CLI/schema-set/backend identity；
- 记录当前可用能力、不可用能力和后端未闭合字段；
- 建立 30–50 个代表性任务的初始评测集；
- 固定成功、拒答、越权、stale、timeout、provider unavailable 和 invalid artifact 样例；
- 记录当前模型调用 p50/p95、成本、失败率和会话留存现状；
- 设计 threat model 和字段留存矩阵；
- 产出目标架构 ADR、数据生命周期 ADR 和工具权限矩阵。

**前端产物**：

- capability-driven 的实验/结果/任务界面草图；
- 统一的 operation/task/approval UI model；
- fixture adapter，但不显示为真实后端能力；
- 任务状态、工具事件、恢复提示的组件测试。

**后端产物**：

- capability matrix、评测 manifest、policy manifest；
- proposed schemas 和错误码清单；
- Provider live acceptance 记录（若 Provider 尚未可用，明确标记 pending）。

**完成门禁**：

- 能从一份 manifest 复现当前能力和测试集合；
- 旧页面和现有 run API 行为不变；
- 评测集分为 train/validation/test/held-out adversarial，集合互斥；
- 未解决的后端能力被标成 `unavailable`/`not_exposed`，没有前端伪入口。

**停止条件**：能力矩阵、身份绑定或当前失败语义不清楚时，不能进入工具开发。

### 阶段 1：只读工具和模型动作边界（2–3 周）

**目标**：实现第一条真实的“模型选择工具 → 得到结构化结果 → 再决定下一步”链路，但不产生运行副作用。

**工作内容**：

- 发布 tool registry、tool descriptor、tool call/result schema；
- 实现 L0 只读工具；
- 建立模型动作解析器：只能输出 `assistant_message`、`tool_call`、`clarification` 或 `draft`；
- policy gate 检查工具是否允许、scope 是否匹配、参数是否闭合；
- 结果回传模型时只提供工具 Schema 允许的字段；
- 记录每次调用的 operation、tool revision、input/output digest 和终态。

**前端产物**：

- 工具调用时间线；
- 工具进行中、成功、拒绝、重试和不可用状态；
- 结构化结果和引用展开；
- 不支持工具不显示为可点击能力；
- 保留当前配置页/结果页路由隔离。

**完成门禁**：

- 只读工具成功率、参数错误和权限拒绝均有测试；
- 模型不能通过自然语言或工具结果扩大 scope；
- 工具结果能被下一次模型调用正确消费；
- 任意工具路径都不会创建 run、修改配置或写报告；
- prompt injection、恶意 artifact 和越权 tool call 通过回归测试。

**停止条件**：工具调用无法做到闭合 Schema、权限可审计或结果可回放时，不进入执行阶段。

### 阶段 2：正式草案、预算和人工确认（2–3 周）

**目标**：让 Agent 能生成“可执行但尚未执行”的实验方案。

**工作内容**：

- 发布 `experiment_draft`、`validation_report`、`approval` 契约；
- 将自然语言目标编译到现有 `create-run-request` 或后续正式 successor；
- 复用 capability catalog、parameter surface 和确定性 validator；
- 生成旧值→新值 diff、单位、假设、证据、预算和风险；
- approval 绑定精确 draft digest、snapshot、policy revision 和 expiry；
- 任一字段变化、页面上下文变化或 schema revision 变化都使 approval 失效；
- 用户拒绝、过期和修改后重新提交都不产生 run。

**前端产物**：

- Draft card、validation issues、diff view、approval dialog；
- “没有创建运行”的明确状态；
- 失败修复建议和重新生成入口；
- 结构化输入与助手草案双向同步，但不让助手绕过表单和 Bridge。

**完成门禁**：

- draft 编译结果与手工表单 builder 等价；
- 未声明字段、不支持引擎、非法 TP/topology、越界数值全部 fail closed；
- approval 前 run 创建次数为 0；
- stale、并发修改、重复提交和 approval replay 测试通过。

**停止条件**：无法证明审批前零副作用、或草案与正式 request 不等价时，不开放 submit tool。

### 阶段 3：持久任务队列和可恢复工作流（3–5 周）

**目标**：把一次短 HTTP 请求升级为可观察、可暂停、可恢复的长任务。

**工作内容**：

- 实现 operation/event/checkpoint 存储；
- 实现有限并发的持久队列；
- 对任务和工具执行增加 lease、heartbeat、visibility timeout；
- 实现 `start`、`status`、`cancel`、`resume`、`retry` 和 `inspect-checkpoint`；
- 为 Provider、tool、create-run 和 artifact read 定义 side-effect ledger；
- 设计 at-least-once event delivery、event ID 去重和 sequence fence；
- 支持 SSE 断线恢复和 polling fallback；
- 记录 queue delay、运行时间、重试次数和人工接管原因。

**前端产物**：

- Agent Task Center；
- 队列列表、当前节点、等待原因、重试记录、检查点摘要；
- 暂停、取消、恢复和人工接管操作；
- 断线重连后恢复正确状态；
- 不伪造百分比，进度只显示真实阶段和计数。

**推荐先实现的有限状态**：

```text
queued → running → waiting_tool → running
                  ├→ retrying → running
                  ├→ waiting_approval
                  ├→ completed
                  ├→ failed
                  └→ cancelled
```

**完成门禁**：

- Worker 崩溃、Bridge 重启、Provider timeout、重复 event、乱序 event、重复 resume、取消和审批过期均有故障注入；
- 已完成工具和 run 不会因恢复重复执行；
- 无法确定副作用是否发生时进入人工接管，不自动重提；
- 旧 operation、run、snapshot 和 policy revision 不会被新任务污染；
- operation event 可重放并得到相同状态。

**停止条件**：恢复后出现重复 run、重复扣费或旧结果覆盖新结果时，暂停所有自主写操作，只保留只读和草案模式。

### 阶段 4：受控执行闭环（3–4 周）

**目标**：在阶段 2/3 稳定后，完成“批准 → 排队 → 创建 run → 监控 → 结果回传”。

**工作内容**：

- 将 `submit_experiment` 接入统一 workflow；
- submit 前重新读取 capability、schema-set、backend identity 和当前 snapshot；
- 使用 create-run 既有幂等语义，不另造旁路 CLI 命令；
- 监控 run SSE、artifact manifest 和终态；
- 将结果转换为 Agent 可消费的 verified result reference；
- 保留 requested/resolved fidelity、provenance、availability 和 expected absence；
- 支持用户取消、重试可重试失败和人工接管未知状态。

**前端产物**：

- 执行确认页；
- 任务和 run identity 关联；
- 运行状态/工件读取进度；
- 失败、重试、恢复和取消说明；
- 结果页与助手上下文绑定当前 run，旧 run 不能被错误分析。

**完成门禁**：

- 审批前创建 run 为 0；
- 同一 approval/draft/idempotency key 不产生重复 run；
- 失败没有伪造 completed 或 artifact；
- 结果只来自 manifest 绑定的 verified artifact；
- 端到端浏览器测试覆盖批准、等待、失败、恢复、取消和刷新。

**发布策略**：

先以人工批准的单候选执行发布；默认关闭自动连续提交。只有在连续运行、恢复、取消和成本门禁稳定后，才进入阶段 5。

### 阶段 5：有限自主优化（4–6 周）

**目标**：让 Agent 在明确预算内自动尝试候选配置，并找出可验证的更优结果。

**用户必须先声明**：

- 优化目标，例如吞吐最大化、p99 最小化或成本最小化；
- 硬约束，例如准确性、显存、设备数、SLO 和 fidelity；
- 可修改字段和禁止修改字段；
- 最大候选数、最大并发、最大总耗时、最大资源/成本；
- 最低改善幅度、连续无改善停止次数和失败上限；
- 是否允许自动提交，或每轮都需要批准。

**优化循环**：

1. 冻结 baseline 配置和结果快照；
2. 解析目标、约束和可编辑字段；
3. 生成 1–3 个候选，不超过预算；
4. 确定性校验候选并去重；
5. 加入队列，按资源限制执行；
6. 读取 verified artifacts 和指标；
7. 由后端确定性比较候选和 baseline；
8. 记录 improvement、约束状态和证据；
9. 生成下一轮候选或触发停止条件；
10. 输出最佳候选、未验证假设和停止原因。

**候选算法的落地顺序**：

- 第一版：规则 + 小范围网格/Latin Hypercube；
- 第二版：单目标 Bayesian Optimization/TPE；
- 多目标：Pareto 前沿；
- 运行昂贵时再考虑多保真度或 Successive Halving。

模型只负责候选解释和提出变更；指标排名、约束检查和停止判定必须由确定性代码完成。

**完成门禁**：

- 所有候选可追溯到 parent candidate 和输入 snapshot；
- 运行次数、并发、成本和总时间永不超过 policy；
- 候选重复率受控；
- 结果不可比较时不更新最佳候选；
- synthetic 结果只能产生 exploratory/consistency 结论；
- 至少在独立验证 run 上确认“最佳”不是偶然噪声；
- 连续无改善、失败过多、预算耗尽和人工停止均能正常终止。

**第一版明确不做**：在线自行修改 prompt、权限、模型路由、停止条件或参数上限。

### 阶段 6：证据检索、跨 run 比较和研究闭环（3–5 周）

**目标**：让 Agent 能解释“为什么推荐”、比较兼容实验并设计下一轮研究。

**工作内容**：

- 构建 verified evidence index；
- 先实现 exact stable ID、metadata filter、SQLite FTS5/BM25；
- 仅在评测证明 lexical baseline 不足时增加 embedding/reranker；
- 发布 cross-run comparison contract；
- 检查 backend/schema compatibility、输入差异、provenance、fidelity、metric 定义和 validation lane；
- 每条引用保留 owning run、artifact、SHA、schema 和 Pointer；
- 生成下一轮实验草案，但仍受阶段 2 的审批和阶段 5 的 policy 约束。

**完成门禁**：

- evidence recall@5、citation precision、numeric exactness 和 no-answer false-positive 有固定阈值；
- 不兼容 run 返回 `not_comparable`/`partially_comparable`，不强行混合；
- 不从页面文字反向建立 evidence index；
- artifact hash、schema 或 builder revision 变化会使 index snapshot 失效；
- embedding/reranker 没有独立 validation 增益就不进入默认路径。

### 阶段 7：桌面封装和外部集成（可选，2–4 周）

**目标**：改善本地长任务、通知和 CLI/GPU 使用体验，不改变 Agent 核心架构。

**适合桌面端的能力**：

- 本地 TileSimCLI 启动和健康检查；
- 长任务后台运行、系统通知和断线恢复；
- 本地 workspace/credential 的受控接入；
- 日志和诊断包导出。

**不放入桌面端的能力**：

- Agent 真相状态；
- 共享任务队列；
- 运行权限和审批；
- 实验比较和最佳候选记录；
- Provider credential 的明文持久化。

优先保留 Web 端作为远程查看和协作入口。桌面封装只有在本地执行和后台任务确实带来收益时才实施。

## 7. 失败恢复矩阵

| 场景              | 用户看到的状态 | 系统行为                              | 是否自动重试     |
| ----------------- | -------------- | ------------------------------------- | ---------------- |
| Provider timeout  | 可重试         | 保留 operation/checkpoint，按预算重试 | 是，有限次数     |
| Bridge 暂时不可用 | 可重试         | 退避后重试，保持原幂等键              | 是               |
| CLI 非零退出      | 执行失败       | 保存稳定错误码、字段路径和日志摘要    | 仅 policy 允许时 |
| 参数/Schema 无效  | 输入被拒绝     | 不入队、不创建 run                    | 否               |
| 容量已满          | 排队           | 等待队列或提示调整并发                | 否，等待资源     |
| 副作用结果未知    | 需要人工处理   | 查询 side-effect ledger/Bridge 状态   | 否，禁止盲重提   |
| Worker 崩溃       | 恢复中         | 从最后 checkpoint 恢复                | 是               |
| 重复/乱序事件     | 处理中         | event ID 去重或拒绝越序               | 不重复执行       |
| 用户取消          | 已取消         | 设置 cancellation fence，忽略迟到终态 | 否               |
| Approval 过期     | 需重新确认     | 草案保持只读，重新审批                | 否               |
| Run/snapshot 变化 | 草案过期       | 标记 stale，要求重新编译              | 否               |
| 工件校验失败      | 证据不可用     | 不进入分析和优化排名                  | 否               |

## 8. 安全、权限和留存

### 8.1 权限模型

至少区分：

- `agent:read_capability`
- `agent:read_evidence`
- `agent:draft_experiment`
- `agent:validate_experiment`
- `agent:submit_experiment`
- `agent:cancel_experiment`
- `agent:manage_study`

权限由服务端根据 principal/workspace/target run 判断，不能信任浏览器传入的 allow-list。

### 8.2 Prompt injection 防护

以下全部视为不可信输入：用户问题、artifact 文本、模型输出、工具描述、文档内容和外部 Provider 响应。

- evidence 文本不能改变系统权限；
- 工具结果不能追加工具或扩大 scope；
- 模型输出必须经过结构化解析；
- 工具参数不能包含任意路径、shell 或 URL；
- 每个 tool call 重新做 policy check；
- 建立恶意 artifact、tool poisoning、越权参数、数据外传和 confused-deputy 测试集。

### 8.3 留存规则

- working memory、operation event、checkpoint、tool digest、draft、approval 和 candidate identity 分开留存；
- 默认短期留存，用户可删除；
- 不保存 hidden reasoning、credential、raw Provider response 和未展示完整 evidence payload；
- 删除必须同时清理 conversation、operation、checkpoint、index 和本地缓存；
- retention/删除失败不能静默报告成功。

## 9. 评测体系

### 9.1 数据集

建立互斥的：

- `train`：开发期提示和解析调整；
- `validation`：选择策略、预算和检索配置；
- `test`：发布前一次性验收；
- `held-out-adversarial`：越权、注入、跨 run 泄漏、重复副作用和恶意工件。

至少覆盖：

- 中文、英文、中英混合；
- 同义词、单位、缺字段、冲突字段、不支持字段；
- 引擎、设备、TP、KV、batch、请求和拓扑边界；
- stale、timeout、partial、refused、409、429、502、503、504；
- 长任务断线、Worker 重启、重复事件、取消和审批过期。

### 9.2 指标

| 层     | 指标                                                                      |
| ------ | ------------------------------------------------------------------------- |
| 意图   | 字段提取准确率、单位准确率、不支持能力拒绝率                              |
| 澄清   | 阻塞字段召回率、无意义追问率、平均轮数                                    |
| 草案   | Schema 有效率、表单等价率、stale 正确率                                   |
| 工具   | tool selection/argument accuracy、越权率、重复副作用率                    |
| 工作流 | 任务成功率、恢复正确率、取消正确率、人工接管率                            |
| 证据   | recall@k、citation precision、numeric exactness、no-answer false-positive |
| 优化   | baseline 改善、约束满足率、候选重复率、停止准确率                         |
| 运维   | queue delay、p50/p95、token/cost、失败率、checkpoint 大小                 |
| 安全   | prompt injection、数据外传、跨 run 泄漏、permission bypass                |

LLM judge 只能作为辅助指标，不能替代 Schema、identity、权限、数值和副作用 hard gate。

## 10. 项目组织和交付顺序

### 10.1 推荐开发流

每个阶段都按以下顺序：

1. ADR 和契约草案；
2. fixture 和失败样例；
3. Bridge/worker 确定性实现；
4. 前端 capability-driven 接入；
5. 单元、契约、故障注入和浏览器测试；
6. 临时环境验收；
7. 更新 `AI_HANDOFF.md` 和模块 current baseline；
8. 通过 stop/go 后再开始下一阶段。

### 10.2 并行边界

可以并行：

- 前端任务中心 UI 与后端契约 fixture；
- 工具面板与工具 Schema/validator；
- 评测 runner 与只读工具实现；
- 无障碍测试与状态组件。

必须串行：

- capability/schema 冻结 → 工具调用；
- tool result/permission → 执行提交；
- checkpoint/recovery → 自主队列；
- verified result/comparability → 自动优化。

不要让多个 Agent 同时修改：

- `bridge/contracts/openapi.json` 和生成物；
- operation/event/checkpoint schema；
- 全局 Agent shell、router 和共享 i18n；
- 同一份优化器和停止策略。

### 10.3 现实时间表

以一个全职工程师为基准：

| 时间        | 交付目标 | 产品状态                   |
| ----------- | -------- | -------------------------- |
| 第 1–2 周   | 阶段 0   | 基线、评测和契约准备完成   |
| 第 3–5 周   | 阶段 1   | 真实只读工具闭环           |
| 第 6–8 周   | 阶段 2   | 草案、预算、审批完成       |
| 第 9–13 周  | 阶段 3   | 可恢复任务队列             |
| 第 14–17 周 | 阶段 4   | 人工批准执行闭环           |
| 第 18–23 周 | 阶段 5   | 受限自主优化 MVP           |
| 第 24–28 周 | 阶段 6   | 证据检索和跨 run 研究闭环  |
| 之后        | 阶段 7   | 视本地执行需求决定桌面封装 |

如果只有 8 周：做到阶段 2，交付高质量草案和审批，不承诺自主执行。  
如果只有 12 周：做到阶段 3，交付可恢复队列，但默认仍需人工提交。  
只有阶段 0–4 全部通过，才开始阶段 5 的自主优化。

## 11. 风险和止损

| 风险             | 早期信号                               | 止损措施                                              |
| ---------------- | -------------------------------------- | ----------------------------------------------------- |
| 后端字段未闭合   | 页面能填但指标不受影响                 | 标记 `not_exposed`，禁止进入 Agent catalog            |
| 自由循环失控     | 步骤、工具或成本无上限                 | 强制 max steps/tool calls/cost/run budget             |
| 重试造成重复运行 | 同一候选出现多个 run                   | 立即关闭自动提交，检查 side-effect ledger             |
| RAG 过度工程     | 小语料引入复杂向量服务                 | 先用 exact/metadata/BM25，评测无增益不升级            |
| 多 Agent 复杂度  | 上下文不一致、权限变宽                 | 保持单 workflow，只有评测证明需要才拆分               |
| 性能结论不可信   | synthetic 被说成真实性能               | provenance/fidelity/claim-scope gate 阻断             |
| 桌面化过早       | UI 重写但执行仍无恢复                  | 桌面封装推迟到阶段 4 稳定后                           |
| Provider 漂移    | 模型、版本或协议变化                   | descriptor probe、revision pin 和 acceptance manifest |
| 数据留存超标     | raw payload 或 hidden reasoning 被写入 | retention test 失败即阻断发布                         |

## 12. 第一批实际开发任务

正式开始时，只做以下四个工作包：

### WP-A：Agent Harness Contract Proposal

- 定义 operation、turn、event、checkpoint、tool call/result、draft、approval；
- 定义错误码、retryable、unknown outcome 和 revision；
- 产出 OpenAPI/JSON Schema 草案和迁移说明；
- 不接真实执行。

### WP-B：Read-only Tool Slice

- 实现 capability、run status、artifact list、verified metric 四个只读工具；
- 加入权限、digest、scope 和 prompt injection 测试；
- 前端显示真实工具状态；
- 不创建 run。

### WP-C：Task Center Fixture/UI

- 实现任务列表、阶段、事件、错误、恢复、取消和审批组件；
- 只消费 fixture/正式 read-only contract；
- 覆盖键盘、读屏、深色、1024/1440 桌面布局和刷新恢复；
- 不伪造自主执行。

### WP-D：Durable Runtime Bake-off

- 以同一 operation contract 比较最多两个 workflow runtime；
- 对比重启、checkpoint、取消、重复事件、幂等、迁移和部署成本；
- 输出 ADR 和 go/no-go；
- 未完成前不引入第二个 runtime。

## 13. 明确不做

- 不让模型生成并执行任意 CLI 命令；
- 不把前端 localStorage 会话当成服务端任务状态；
- 不在没有 checkpoint 和 side-effect ledger 时开放后台自主运行；
- 不把“页面可编辑”当成“后端已经执行”；
- 不猜模型、GPU、拓扑、KV 或引擎 profile；
- 不把 synthetic consistency 写成真实硬件、校准或 held-out 结果；
- 不用空数组、默认值或页面文案掩盖 `unavailable`、`not_applicable`、`rejected` 和 `not_covered`；
- 不在没有独立 test set 的情况下自动优化 prompt、模型路由或权限策略；
- 不把桌面 App 当作后端队列和恢复系统的替代品；
- 不以引入框架、MCP、A2A 或多 Agent 的数量作为交付标准。

## 14. 关联文档和外部依据

仓库内：

- [F9 Evidence Agent 前沿扩展研究](F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md)
- [基于 Agent 的仿真编排总方案](F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)
- [F9 Agent 编排文档入口](../F9_AGENT_ORCHESTRATION/README.md)
- [F9 Evidence Agent 评测规范](../contracts/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md)
- [Bridge API 说明](../../bridge/README.md)
- [前端开发参考](../getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md)

外部调研依据：

- [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)：持久化工作流、人机协作和恢复；
- [Temporal](https://docs.temporal.io/)：长任务、重启恢复和活动幂等；
- [MCP 架构](https://modelcontextprotocol.io/docs/learn/architecture)：工具、资源和能力发现；
- [A2A 规范](https://a2a-protocol.org/latest/specification/)：外部 Agent 任务互操作；
- [OWASP Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)：Agent 安全风险；
- [AgentDojo](https://agentdojo.spylab.ai/)：工具调用和 prompt injection 评测；
- [Ragas 指标](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)：检索和回答评测；
- [DSPy GEPA](https://dspy.ai/getting-started/gepa-optimization/)：评测驱动的 prompt/program 优化。

本计划的外部资料用于提炼工程原则，不表示 TileSim 必须直接依赖这些项目。所有正式能力仍以 TileSim 自己的版本化契约、Bridge 能力目录和真实验收为准。
