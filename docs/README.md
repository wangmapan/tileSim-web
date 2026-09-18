# TileSim Web 文档入口

本文档树按“当前事实优先、稳定设计其次、历史证据最后”组织。AI 不得从文件日期推断当前状态。

## 必读顺序

1. [`../AGENTS.md`](../AGENTS.md)：仓库规则与完整门禁。
2. [`AI_HANDOFF.md`](AI_HANDOFF.md)：当前代码、阶段、风险和下一步。
3. [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、部署、验证与 AI 接手。
4. 当前任务对应目录。

## 目录分类

| 目录                      | 内容                                     | 当前决策权                      |
| ------------------------- | ---------------------------------------- | ------------------------------- |
| `architecture/`           | 前端架构、数据流、可视化设计             | 有，须与代码和契约核对          |
| `contracts/`              | F6–F9、Evidence Agent 与实验编排契约审计 | 有，正式 Schema/descriptor 优先 |
| `deployment/`             | immutable release、回滚和部署安全        | 有                              |
| `features/`               | 面向用户和维护者的功能说明               | 有                              |
| `F9_AGENT_ORCHESTRATION/` | Agent 编排规范、Gap 与阶段验收           | 有                              |
| `research/`               | Agent/RAG/长期产品方案                   | 设计输入，不代表已实现          |
| `archive/`                | 已结束阶段、旧提示词和 dated evidence    | 无                              |
| `development/`            | 旧链接兼容入口                           | 无                              |

## 活跃文档索引

本索引是“新文档必须从本页或模块入口可达”这条规则的落地清单。新增活跃文档时必须同时登记到这里。

### Agent 编排模块（`F9_AGENT_ORCHESTRATION/`）

模块入口与阅读顺序见 [`F9_AGENT_ORCHESTRATION/README.md`](F9_AGENT_ORCHESTRATION/README.md)。其中
`00`–`18` 是规范与流程文档，`23` 是下一批工作包计划。

### 契约审计（`contracts/`）

- [`F6B_WEEK8_CONTRACT_GAPS.md`](contracts/F6B_WEEK8_CONTRACT_GAPS.md)：Week 8 证据链契约缺口。
- [`F7_CONTRACT_AUDIT.md`](contracts/F7_CONTRACT_AUDIT.md)：F7 fabric slice 契约审计。
- [`F8_EXPERIMENT_ORCHESTRATION_AUDIT.md`](contracts/F8_EXPERIMENT_ORCHESTRATION_AUDIT.md)：实验编排契约审计。
- [`F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`](contracts/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md)：Evidence Agent 契约审计；正式能力以运行时
  descriptor 为准。
- [`F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`](contracts/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md)：Evidence Agent 评测规范与 hard gate。

### 功能说明（`features/`）

- [`evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md`](features/evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md)：Evidence Agent 使用指南。
- [`execution/WEEK6_RESULTS_UI.md`](features/execution/WEEK6_RESULTS_UI.md)：运行结果界面说明。
- [`execution/WEEK7_EVIDENCE_UI.md`](features/execution/WEEK7_EVIDENCE_UI.md)：Week 7 证据界面说明。
- [`reports/STRUCTURED_REPORT_EXPORT.md`](features/reports/STRUCTURED_REPORT_EXPORT.md)：结构化报告导出。
- [`traces/TRACE_PACKAGE_WEB_PROTOTYPE.md`](features/traces/TRACE_PACKAGE_WEB_PROTOTYPE.md)：Trace package Web 原型说明。

### 架构、部署与研究

- [`architecture/EXECUTION_VISUALIZATION_DESIGN.md`](architecture/EXECUTION_VISUALIZATION_DESIGN.md)：执行可视化设计。
- [`architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md)：后端仿真流程与前端专业工作台的
  展示覆盖度审计、四类缺口（C0 纯前端 / C1 Bridge 采集 / C2 契约面 / C3 输入面）与 `WP-2D-01` 派发提示词。
- [`deployment/F10_RELEASE_HARDENING.md`](deployment/F10_RELEASE_HARDENING.md)：发布加固与回滚。
- [`research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md`](research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)：Agent 编排总方案。
- [`research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md`](research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md)：Evidence Agent 前沿扩展研究。

## 归档分层（`archive/`）

- `archive/README.md`：归档说明与目录语义。
- `archive/development/`：F0–F10、Phase 0–0D 与界面评审的 dated 证据。
- `archive/plans/`：已执行完毕或被替代的旧计划、旧维护提示词和旧并行工作流。
- `archive/agent-orchestration/`：Agent 编排模块的已结束阶段。
  - `phase0-proposal/`、`phase0b-publication-candidate/`：早期 proposal 与候选，不是 runtime contract。
  - `phase-records/`：Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、Phase 2B 发布。

## 更新规则

- 当前状态只写入 `AI_HANDOFF.md` 和对应模块 current baseline。
- 部署步骤变化时同步根 `README.md`、部署手册和脚本测试。
- 正式 identity、revision 和错误语义以运行时 contract 为准。
- 历史报告保留原文并移入 archive，不把旧测试数字改写成当前数字。
- 已完成的计划、一次性交接提示词和被当前路线替代的协作说明统一移入 `archive/plans/`。
- 结束一个阶段时，把该阶段的 dated 记录移入 `archive/agent-orchestration/phase-records/`，并把仍然有效的结论折进
  `AI_HANDOFF.md` 与模块 current baseline。
- 新文档必须放入对应目录，并从本页“活跃文档索引”或模块入口可达。活跃文档不得链接到已归档的阶段结论当作当前事实。
