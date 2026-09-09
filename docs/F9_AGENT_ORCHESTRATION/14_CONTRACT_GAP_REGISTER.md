# 契约与能力缺口登记表

> 文档 ID：`AO-14`
>
> 类型：规范性缺口台账（持续更新）
>
> 前置阅读：[当前基线](01_CURRENT_BASELINE_AND_GAPS.md)、[路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)

## 1. 目标

用稳定 Gap ID 阻止“当前契约表达不了，就先在前端模拟”的实现。每个缺口记录状态、owner、依赖、退出条件和明确禁止的兼容做法。

## 2. 状态

- `open`：已确认且未形成正式设计；
- `designing`：正在写 contract/ADR，尚不可实现为正式能力；
- `blocked_backend`：等待后端语义/lowering；
- `blocked_data`：等待 profile/calibration/held-out 资产；
- `implementing`：正式 contract 已批准并进入实现；
- `validated`：实现和门禁完成；
- `validated_pre_commit`：实现和门禁完成，但仍等待用户授权 commit 形成 Git 可复现发布点；
- `deferred`：有意后置；
- `rejected`：明确不采用，保留原因。

只有正式证据满足退出条件才能改为 `validated`。

## 3. Gap Register

| Gap                       | 状态            | Owner                    | 缺口                                                                                                                                      | 关键依赖                                           | 退出条件                                                                         | 禁止的前端模拟                                            |
| ------------------------- | --------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GAP-CAP-001`             | validated       | 后端 + Bridge            | 正式 catalog/snapshot/endpoint、八字段投影、generated/runtime validator 与 release-binding fail-closed 已闭合；backend/Web commits 已形成 | 后续真实 registry/profile source 另行演进          | 真实 Web/backend revision 的 8/8 reference、generated 与 snapshot closure 已通过 | 从 Schema/表单猜 supported                                |
| `GAP-PROFILE-001`         | validated       | 各领域模块               | 五类 v1 Schema 正式发布并表达 0/unavailable；未创建任何假 Profile                                                                         | 真实 source/licensing/calibration 仍是后续数据 Gap | 本状态仅表示“正式 Schema + 0/unavailable”已通过                                  | 在 UI hardcode H100/模型性能                              |
| `GAP-CONTRACT-DRIFT-001`  | validated       | Bridge + Integration/F8  | nested v1 旧语义恢复，v2 承载严格规则，create-run v1 双版本；独立矩阵 28/28 与 F8 runner 通过                                             | 无 Phase 0 阻塞                                    | generated/schema-set/revision closure 已通过                                     | 静默部署、把 dirty state 当 release、继续复用 breaking v1 |
| `GAP-DRAFT-001`           | open            | Bridge                   | typed Experiment Draft                                                                                                                    | capability catalog                                 | draft schema、revision、source、digest 和 patch semantics 发布                   | localStorage 自造正式草案                                 |
| `GAP-VALIDATE-001`        | open            | 后端领域服务             | 统一 deterministic Validation Report                                                                                                      | profiles/calculators/lowering                      | rule IDs、receipts、compile result 和 hard gates 发布                            | 用 LLM 文本判断可行                                       |
| `GAP-CONV-001`            | open            | Bridge                   | Conversation/Turn/Goal                                                                                                                    | retention/auth/concurrency                         | 多轮 schema、revision conflict、expiry/delete 发布                               | 把 Evidence request 当 turn history                       |
| `GAP-COPILOT-UI-001`      | open            | Web + Integration        | 全局右侧 Agent Shell 和页面上下文接口                                                                                                     | App Shell owner/context contract                   | Shell、Context Envelope、typed blocks、跨路由和无障碍门禁完成                    | 抓 DOM、复制业务 store 或暗示未发布能力                   |
| `GAP-CLARIFY-001`         | open            | Agent service            | 主动澄清结果契约                                                                                                                          | conversation + capability                          | blocking questions/answer binding/limits 发布并评测                              | 仅在前端追加聊天气泡                                      |
| `GAP-APPROVAL-001`        | open            | Bridge/Auth              | exact draft approval                                                                                                                      | identity/digest/principal                          | expiry/revoke/stale/scope 服务端强制                                             | 用确认按钮布尔值授权                                      |
| `GAP-WORKFLOW-001`        | open            | Bridge services          | Operation/Event/Checkpoint                                                                                                                | approval/idempotency                               | durable graph、恢复、event sequence 和审计通过 crash tests                       | 浏览器内存假装长任务                                      |
| `GAP-CANCEL-001`          | open            | 后端 + Bridge            | run/tool cancellation contract                                                                                                            | operation/backend cancel                           | cancel fence、ack、late result 语义发布                                          | 隐藏 UI 就说已取消                                        |
| `GAP-RAG-001`             | open            | Bridge evidence          | 分域 evidence index/bundle                                                                                                                | source allow-list/citation                         | index revisions、retrieval strategy、ACL 和 bundle schema 发布                   | 浏览器向量库复制 artifact                                 |
| `GAP-MEMORY-001`          | open            | Product + Security       | 用户可见会话/偏好留存                                                                                                                     | consent/redaction/delete                           | retention classes、expiry、export/delete 和测试发布                              | 永久存完整问题/回答                                       |
| `GAP-COMPARE-001`         | open            | 校准验证与指标归因模块   | 跨 run comparability contract                                                                                                             | input/profile/fidelity/provenance                  | report 能判兼容范围并保持 owning citation                                        | 前端直接相减不同 run 指标                                 |
| `GAP-TOOLS-001`           | open            | Bridge/Security          | typed tool registry/permission                                                                                                            | auth/approval/audit                                | tool descriptors、scopes、effect/idempotency 发布                                | 让模型调用任意 endpoint/CLI                               |
| `GAP-MCP-001`             | deferred        | Bridge                   | MCP adapter                                                                                                                               | stable internal tools                              | read-only resources/T0-T1 tests；写工具另验收                                    | 把 MCP 当业务数据库                                       |
| `GAP-A2A-001`             | deferred        | Architecture             | 外部 Agent gateway                                                                                                                        | auth/task/operation semantics                      | 明确业务需求、Agent Card/version/security/eval                                   | 内部 Agent 自由互聊冒充 A2A                               |
| `GAP-SLO-001`             | open            | 校准验证与指标归因模块   | typed SLO 和目标可达性                                                                                                                    | metric identity/profile/calibration                | metric/window/scope/target contract 和 planner 发布                              | 把“低延迟”转成任意 P99 数值                               |
| `GAP-MODEL-001`           | blocked_data    | 工作负载 + 设备性能      | 模型结构与权重真源                                                                                                                        | model profile assets                               | 关键结构/dtype/KV 字段有版本和证据                                               | 用名称/参数量猜完整模型                                   |
| `GAP-DEVICE-001`          | blocked_data    | 设备性能建模模块         | 设备容量/性能 profile                                                                                                                     | measurements/calibration                           | 理论/模型/实测分离并声明 regime                                                  | 把公开峰值当有效性能                                      |
| `GAP-ENGINE-001`          | blocked_backend | 推理引擎与服务运行时模块 | 引擎选择正式 Web lowering                                                                                                                 | semantic profiles/create-run                       | 选择影响状态机且有累计链测试                                                     | 只保存显示名称                                            |
| `GAP-PARALLEL-001`        | blocked_backend | 执行语义 + 集合通信      | TP/PP/EP/placement 累计链                                                                                                                 | model/engine/device/topology                       | 从 request 到执行片段、通信、网络和指标测试                                      | 仅校验整除就声称可运行                                    |
| `GAP-KV-001`              | blocked_backend | 引擎运行时 + KV Cache    | 逻辑策略到物理 KV 语义                                                                                                                    | engine/model/device profiles                       | page/capacity/residency/transfer feedback 累计闭合                               | 前端显存公式代替 KV 模块                                  |
| `GAP-WORKLOAD-001`        | blocked_backend | 工作负载模块             | 普通请求目标到六类 Trace                                                                                                                  | workload template/generator                        | 分布、来源、seed、provenance 和转换测试                                          | 用平均值伪造完整分布                                      |
| `GAP-NETWORK-001`         | blocked_data    | 网络与硬件资源模块       | 可复用拓扑/网络 profile                                                                                                                   | topology/calibration assets                        | versioned profiles、规模/方向/单位和 valid regime                                | 猜测 NVLink/IB 拓扑参数                                   |
| `GAP-CALIBRATION-001`     | blocked_data    | 校准验证与指标归因模块   | H100/网络真实校准                                                                                                                         | real measurements                                  | 正式 receipts 和声明 regime                                                      | synthetic/fake fixture 标 calibrated                      |
| `GAP-HELDOUT-001`         | blocked_data    | 校准验证与指标归因模块   | 独立 held-out validation                                                                                                                  | frozen calibration + independent data              | 分离数据与正式报告                                                               | CI/平均分替代 held-out                                    |
| `GAP-LIVE-001`            | open            | F9 acceptance owner      | Evidence Agent live repetitions                                                                                                           | authorized Provider environment                    | success/refusal/timeout repetitions 和报告完成                                   | fake Provider 关闭 live gate                              |
| `GAP-CITATION-REVIEW-001` | open            | 双人评审                 | 人工 citation entailment                                                                                                                  | live outputs/review protocol                       | 双人复核、分歧仲裁和记录完成                                                     | 自动 validator 代替全部人工复核                           |
| `GAP-OBS-001`             | open            | Platform                 | redacted Agent telemetry                                                                                                                  | event IDs/data classification                      | OTel/audit schema、redaction 和 access tests                                     | 把 prompt/raw response 写日志                             |
| `GAP-EVAL-001`            | open            | QA/Product               | 独立 Agent eval 体系                                                                                                                      | datasets/oracles                                   | 四分数据集、hard gates、可重复报告                                               | 用单一 LLM judge 决定上线                                 |
| `GAP-GRAPHRAG-001`        | deferred        | Research                 | 文档 GraphRAG                                                                                                                             | hybrid baseline/dataset                            | 独立问题集有显著收益且安全通过                                                   | 用于参数/数值/run 真源                                    |
| `GAP-REVIEWER-001`        | deferred        | Research                 | reviewer Agent                                                                                                                            | baseline error/eval budget                         | held-out 高风险错误显著下降                                                      | 多 Agent 投票替代规则                                     |

## 4. Gap 详情模板

新增 Gap 必须补充：

- ID、标题、提出日期和状态；
- 当前事实与最小复现；
- 用户价值/风险；
- 受影响模块、contract 和数据；
- owner/approver；
- 前置依赖；
- 候选方案和 ADR；
- security/retention/evidence/fidelity impact；
- migration/compatibility；
- test oracle 和退出条件；
- 明确禁止的模拟或 workaround；
- last reviewed date。

## 5. 优先处理顺序

1. `GAP-CAP-001`、`GAP-PROFILE-001`；
2. `GAP-DRAFT-001`、`GAP-VALIDATE-001`；
3. `GAP-COPILOT-UI-001` 的只读 Shell 和 Context Envelope；
4. `GAP-MODEL/DEVICE/ENGINE/PARALLEL/KV/WORKLOAD/NETWORK-*`；
5. `GAP-CONV/CLARIFY/APPROVAL-*`；
6. `GAP-WORKFLOW/CANCEL/OBS-*`；
7. `GAP-RAG/COMPARE/TOOLS/EVAL-*`；
8. MCP、GraphRAG、reviewer、A2A 等 deferred 项。

这保证基础仿真与参数执行先于开放式 Agent 扩展。

## 6. 状态更新规则

- `open → designing`：owner、ADR 和 schema draft 已建立；
- `designing → implementing`：contract identity/version 经过正式评审；
- `implementing → validated`：全部退出条件和门禁有 evidence；
- 任一 execution/profile/evidence 回退：转回对应 blocked/open，依赖能力 fail closed；
- deferred 项只有明确用户价值和 eval 预算后才能进入 designing。

状态变更必须同步 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md)、[能力目录](04_CAPABILITY_AND_PROFILE_CATALOG.md) 和 [路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)。

## 7. 当前结论

最近可安全实现的是：能力目录设计、Profile 最小契约、当前正式八参数面的无副作用自然语言草案和确定性等价校验。模型/卡型/卡数/TP/PP/EP 的完整执行、多轮审批、取消、跨 run、RAG 写工具均仍有明确 gap；在它们关闭前，只能展示能力检查或版本化设计，不能宣称已可用。
