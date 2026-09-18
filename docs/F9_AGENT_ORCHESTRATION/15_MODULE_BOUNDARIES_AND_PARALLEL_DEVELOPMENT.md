# 模块边界与并行开发规范

> 文档 ID：`AO-15`
>
> 类型：工程所有权与协作规范（`proposed`）
>
> 前置阅读：[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)、[会话契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)、[路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)

## 1. 目标

将基于 Agent 的仿真编排模块拆成高内聚、低耦合、可独立测试和可由多个开发 Agent 并行交付的工作单元。每个单元必须有单一业务所有者、版本化输入输出、独占写入范围和明确禁止依赖。

并行的前提是接口先稳定，不是让多个 Agent 同时编辑共享文件后再人工消冲突。

## 2. 拆分原则

- 按业务能力和状态所有权拆分，不按页面区域或模型 prompt 拆分；
- 跨模块只传 immutable、typed、versioned objects；
- 每个持久状态只有一个 owner，其他模块只保存 reference；
- 领域服务不依赖 Web、Provider SDK、MCP 或具体 workflow framework；
- LLM adapter、deterministic core、I/O adapter 分层；
- 当前正式 create-run 和 Evidence Agent 保持独立兼容边界；
- 共享 Schema、generated files、全局入口和依赖锁由单一集成 owner 修改；
- 每个模块可用自己的 fixture 在没有 Provider、5173 和其他模块进程时测试。

## 3. 建议模块清单

| 模块                       | 拥有的状态/规则                                   | 输入                               | 输出                             | 可独立开发                  |
| -------------------------- | ------------------------------------------------- | ---------------------------------- | -------------------------------- | --------------------------- |
| `capability-catalog`       | field/profile identities、支持矩阵、revision      | 后端 registries/contracts          | capability snapshot/query result | 是                          |
| `conversation-domain`      | conversation/turn/goal revision 与 retention refs | authenticated commands             | conversation snapshots/events    | 是，先有 schema             |
| `experiment-draft`         | draft/value source/patch/digest                   | goal、catalog refs                 | immutable draft revision         | 是                          |
| `intent-compiler`          | task routing、slot、clarification policy          | redacted turn + catalog projection | typed patch/question             | 是，用 fake model adapter   |
| `deterministic-planning`   | validators/calculators/candidate rules            | draft + profiles + policy          | validation report/plan           | 是，纯函数优先              |
| `approval-domain`          | approval scope/expiry/revoke/stale                | exact digests + principal          | approval envelope                | 是，需 auth interface       |
| `workflow-runtime`         | operation/event/checkpoint/node transitions       | approved snapshot                  | operation events/results         | 是，用 fake tools           |
| `run-adapter`              | create-run compile/commit/query mapping           | compiled formal request            | run identity/terminal            | 是，针对正式 Bridge fixture |
| `evidence-retrieval`       | source ingestion/index/bundle/citation refs       | scoped query + source refs         | evidence bundle                  | 是，用 immutable fixtures   |
| `evidence-analysis`        | atomic response validation                        | evidence bundle + task             | claims/citations/terminal        | 是，兼容现有 Evidence Agent |
| `tool-registry-security`   | tool descriptors/scopes/policies/audit            | candidate tool call                | allow/deny + validated result    | 是                          |
| `agent-workspace-web`      | 页面编排、临时 UI 选择、焦点                      | generated clients/view models      | 用户动作/展示                    | 是，fixture 驱动            |
| `agent-copilot-shell`      | 右侧栏布局、生命周期、typed block registry        | conversation/context object refs   | 跨页面对话工作区                 | 是，需 App Shell 集成 owner |
| `agent-context-adapters`   | 各页面最小只读上下文映射                          | feature public model               | Page Context Envelope            | 是，按 feature 独占         |
| `evaluation-observability` | datasets/oracles/report/telemetry schema          | revisions + traces                 | metrics/gate decision            | 是                          |

模块名称是目标逻辑包，不要求一次性重命名现有目录。迁移使用 facade/adapter 渐进完成。

## 4. 唯一状态所有者

| 状态                          | 唯一 owner                         | 其他模块的允许形式                |
| ----------------------------- | ---------------------------------- | --------------------------------- |
| capability/profile truth      | `capability-catalog`/后端 registry | immutable snapshot reference      |
| user goal/conversation order  | `conversation-domain`              | conversation/goal revision        |
| experiment parameters         | `experiment-draft`                 | draft ID/revision/digest          |
| validity/feasibility          | `deterministic-planning`           | validation report reference       |
| permission to execute         | `approval-domain`                  | approval ID/scope/digest          |
| long-running progress         | `workflow-runtime`                 | operation snapshot/event sequence |
| run and artifact truth        | 现有 Bridge/run repository         | run/artifact references           |
| evidence index                | `evidence-retrieval`               | index revision/evidence bundle    |
| user-visible claims           | formal Evidence response           | immutable response reference      |
| UI disclosure/focus           | `agent-workspace-web`              | 不向后端反写为业务真源            |
| 右侧栏布局和 context registry | `agent-copilot-shell`              | 只保存 UI 偏好和 typed references |
| 页面业务上下文                | 各 feature `agent-context-adapter` | 只读 Context Envelope             |

禁止 conversation store 内嵌完整 artifact、workflow store 复制 profile、Web store 复制正式 validation 规则。

## 5. 建议代码边界

以下是目标结构示意，不是授权本任务立即搬迁现有代码：

```text
bridge/
  contracts/agent_orchestration/       # 单一 contract owner
  services/agent_gateway/              # API 协调
  services/capability_catalog/         # capability/profile projection
  services/conversation/               # conversation + draft commands
  services/validation/                 # deterministic planning adapter
  services/workflows/                  # operation state machine
  services/retrieval/                   # scoped indexes/evidence bundles
  services/tooling/                     # registry, permission, audit
  providers/                            # LLM/embedding/rerank adapters only

src/
  contracts/                            # generated only
  entities/agent-orchestration/         # stable client domain/view models
  entities/agent-context/               # Page Context Envelope 与 typed actions
  features/agent-copilot-shell/         # 右侧栏、context registry、typed blocks
  features/agent-conversation/          # turn/goal interaction
  features/agent-draft/                 # draft editor/source/diff
  features/agent-validation/            # issues/calculator receipts
  features/agent-approval/              # approval preview/action
  features/agent-operation/             # progress/recovery/cancel
  features/agent-evidence/              # result/citation presentation
  features/agent-capability/            # capability/profile inspector
  views/AgentWorkspaceView.vue          # composition only
```

跨 feature 仅通过公开 `index.ts` 和 stable entity types；view 不直接调用 Bridge；通用 UI 不访问 store、feature 或 report schema。

## 6. 模块接口规范

每个模块必须公开：

- command/query names；
- input/output/error schemas；
- owned identities/revisions；
- idempotency、stale 和 concurrency behavior；
- synchronous/async boundary；
- permission/data classification；
- fixture builder；
- compatibility policy；
- metrics and health contract。

模块内部类、数据库表、prompt 和 framework node 不得成为跨模块接口。

## 7. 依赖规则

允许：

```text
Web feature -> generated contract/client -> Bridge facade
Bridge facade -> domain service interface -> repository/adapter
workflow -> typed tool interface -> run/retrieval/domain adapter
LLM adapter -> compiler/analyzer port (structured candidate only)
```

禁止：

- compiler 直接调用 create-run；
- Web 直接访问 Provider 或重建 payload/citation；
- validator 依赖 conversation transcript 或 UI store；
- retrieval 直接批准/执行工具；
- Provider adapter 查询数据库决定权限；
- MCP/A2A adapter 直接访问内部 repository；
- 任一模块 import 另一个 feature 的内部文件；
- 两个模块共同更新同一可变记录。

## 8. Contract-first 并行批次

### Batch A：接口冻结

由 contract owner 独占 Schema、OpenAPI、错误码、canonical vectors 和 generated clients。其他 Agent 只 review，不同时写生成物。

### Batch B：并行实现

契约冻结后可以并行：

- Agent 1：domain/Bridge service；
- Agent 2：Web feature/view model；
- Agent 3：fixtures/eval/security cases；
- 集成 owner：generated files、manifest、共享入口。

每条线只消费冻结版本；发现缺口时提交 contract change proposal，不在本地扩字段。

### Batch C：集成

按 contract → backend/service → generated client → Web → E2E → docs/eval 顺序合并。任一层失败退回 owning agent，不在集成分支做跨模块临时 patch。

## 9. 并行任务模板

每个开发 Agent 的提示词必须包含：

- 目标 requirement/work package/GAP IDs；
- 必读文档和审计基线；
- 独占允许修改的路径；
- 明确禁止修改的共享/其他模块路径；
- 输入 contract identity/revision/digest；
- 预期输出和不变量；
- module-local tests 和交付证据；
- 未提交改动、5173、credential/live Provider 保护要求；
- 完成后报告 changed files、tests、remaining gaps，不擅自 commit/push。

没有独占范围的任务不得并行启动。

## 10. 共享文件单一 Owner

高冲突文件必须由集成 owner 统一维护：

- OpenAPI/JSON Schema 根索引和 generated clients；
- package lock、依赖配置、构建脚本；
- app router、全局导航、全局 i18n catalog；
- 全局 Pinia/dashboard compatibility controller；
- PagePrimer/guided-help catalog；
- manifest/schema-set revision；
- 总文档入口、跨模块 capability registry；
- shared E2E snapshot。

业务 Agent 将所需变更写成小型 proposal/fixture 或新增模块局部文件，由 owner 集成。禁止为了一个新 feature 顺手重构共享全局文件。

## 11. 冲突热点与隔离方式

| 热点                | 冲突原因               | 隔离方式                                    |
| ------------------- | ---------------------- | ------------------------------------------- |
| Contract/generation | 改一处触发大批生成物   | contract owner 单槽；其余消费 fixture       |
| Global store        | 多 feature 争用状态    | 每域独立 store/query key；只存 references   |
| i18n                | 大型共享字典           | workstream-local catalog，最后汇总          |
| E2E                 | 同一 spec/snapshot     | 每模块独立 spec；视觉快照集中更新           |
| CSS                 | 全局 selector/token    | feature-scoped 样式，不覆盖 foundation      |
| Request builder     | canonical payload 敏感 | 保留唯一 builder/facade，增加 adapter tests |
| Evidence validator  | citation/uint64 敏感   | 独立 package 和 vectors，不复制实现         |
| Docs status         | 多任务宣布完成         | 基线/Gap Register 由集成 owner 更新         |

## 12. 测试金字塔与替身

每模块至少提供：

- pure unit tests；
- contract fixture tests；
- port/adapter tests；
- failure/stale/security tests；
- adjacent-module contract test。

替身必须明确身份：fake Provider、fake clock、in-memory repository、fixture Bridge。替身不声称 live、真实校准或 held-out。每个模块的测试不得要求停止或重启 5173。

累计 E2E 由集成 owner 运行，覆盖 conversation → draft → validation → approval → operation → run → evidence；模块 Agent 不各自复制一条完整 E2E。

## 13. 版本与兼容

- 先 additive optional change，后 deprecate，最后 major removal；
- unknown identity/revision fail closed；
- adapter 明确 old → stable model 的语义，不改 canonical payload；
- fixture 按 contract version 分目录；
- 模块升级通过 compatibility matrix，不依赖同时部署；
- rollback 保留上一 contract/service/client 组合；
- Evidence Agent descriptor v2 和 v1 family 在正式 successor 前保持不变。

## 14. 集成门禁

每个并行批次合并前检查：

- 独占路径没有交叉写入；
- contract revision 与生成物一致；
- dependency check 无反向或 feature-internal import；
- module tests 与 adjacent contract tests 通过；
- uint64/canonical digest/citation vectors 通过；
- stale/409/502/503/504 和 redaction 不回归；
- 全仓 type/test/lint/format/build/E2E/diff 门禁由集成 owner 执行；
- 工作树中的用户和其他 Agent 改动保持原样。

## 15. 模块完成报告

每个 Agent 结束时只报告自己的：

- 职责边界和公开接口；
- changed files；
- contract/revision 是否变化；
- module/adjacent tests；
- security/retention/evidence checks；
- unresolved GAP IDs；
- 是否触碰 shared files、5173、credential、live Provider；
- 建议集成顺序。

不替其他模块宣布全仓完成，不擅自提交或推送。

## 16. 更新触发器

新增模块、改变状态 owner、共享文件、并行策略、contract version、framework、跨 feature import 或集成顺序时必须更新本文。若两个开发 Agent 仍需频繁修改同一文件，优先重新划分边界或抽 stable interface，而不是增加合并协调成本。

开发者实际启动并行 Agent 时，还必须使用 [开发者指导 AI 实施手册](17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md) 中的提示词结构、阶段分工、调试阶梯和交接格式。
