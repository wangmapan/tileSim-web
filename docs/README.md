# TileSim Web 文档入口

本文档树按“当前事实优先、稳定设计其次、历史证据最后”组织。AI 不得从文件日期推断当前状态。

2026-10-29 复核：当前工作树为 Web `HEAD=28016188951338a033eedeb9f8303c08e38ee7bd`（工作树含既有未提交改动），Bridge schema-set
revision 为 `sha256:0085e3a4e89576fff168f29d811be581c7107b9bd3f8fabf9834d651f3c606b3`。
Agent flow HTTP 路由是 deterministic transition adapter，LangGraph runtime 仍为 optional/not active；flow
继续限定为 `local_dev + synthetic_trace + exploratory + not_for_production`，不创建 run、不调用 Provider；详见
[`AI_HANDOFF.md`](AI_HANDOFF.md) 最新 dated 条目与 [`bridge/README.md`](../bridge/README.md) 当前事实。
Agent Harness 阶段 5 local-dev 批处理已通过 `LOCAL_PHASE5_PASS`，但仍不是生产 GO；2026-10-23
启动器部署因后端 CTest 的 `route_unavailable` 失败而保持未部署。当前细节以
[`AI_HANDOFF.md`](AI_HANDOFF.md)、模块 current baseline 和运行时 contract 为准。

## 必读顺序

1. [`../AGENTS.md`](../AGENTS.md)：仓库规则与完整门禁。
2. [`AI_HANDOFF.md`](AI_HANDOFF.md)：当前代码、阶段、风险和下一步。
3. [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、部署、验证与 AI 接手。
4. [`getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md`](getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md)：**前端开发任务**的代码地图、状态归属、本机可跑命令与硬约束速查。
5. 当前任务对应目录。

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

- [`AI_BACKEND_BASELINE_ALIGNMENT_2026-10-24.md`](AI_BACKEND_BASELINE_ALIGNMENT_2026-10-24.md)：远端 v0.0.1 与本地后端扩展的前端适配差异、计划和保留声明。

### 接手与开发参考（`getting-started/`）

- [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、一键部署、图形启动器与常见故障。
- [`getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md`](getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md)：前端开发的接手一页图 ——
  代码地图（`views`/`features`/`stores`/`contracts` 边界）、路由 ↔ view 对照、状态归属（TanStack Query vs Pinia）、
  契约与生成物规则、**无 pnpm 环境的等价可跑命令**、实测门禁基线、本机特有的坑、按任务的文档路由与证据红线。

### Agent 编排模块（`F9_AGENT_ORCHESTRATION/`）

模块入口与阅读顺序见 [`F9_AGENT_ORCHESTRATION/README.md`](F9_AGENT_ORCHESTRATION/README.md)。其中
`00`–`18` 是稳定规范与流程文档，`26` 和 `31` 是当前 Agent Harness 基线；已结束阶段记录和已执行计划均在
`archive/agent-orchestration/` 或 `archive/plans/`。

### 契约审计（`contracts/`）

- [`F6B_WEEK8_CONTRACT_GAPS.md`](contracts/F6B_WEEK8_CONTRACT_GAPS.md)：Week 8 证据链契约缺口。
- [`F7_CONTRACT_AUDIT.md`](contracts/F7_CONTRACT_AUDIT.md)：F7 fabric slice 契约审计。
- [`F8_EXPERIMENT_ORCHESTRATION_AUDIT.md`](contracts/F8_EXPERIMENT_ORCHESTRATION_AUDIT.md)：实验编排契约审计。
- [`F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`](contracts/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md)：Evidence Agent 契约审计；正式能力以运行时
  descriptor 为准。
- [`F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`](contracts/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md)：Evidence Agent 评测规范与 hard gate。
- [`agent-harness/README.md`](contracts/proposals/agent-harness/README.md)：Agent Harness proposal-only 对象、状态、错误、恢复和迁移登记；正式运行时与当前阶段见 [`F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md) 和 [`F9_AGENT_ORCHESTRATION/31_AGENT_HARNESS_STAGE5_LOCAL_BATCH_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/31_AGENT_HARNESS_STAGE5_LOCAL_BATCH_CURRENT_BASELINE.md)。

### 功能说明（`features/`）

- [`evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md`](features/evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md)：Evidence Agent 使用指南。
- [`execution/WEEK6_RESULTS_UI.md`](features/execution/WEEK6_RESULTS_UI.md)：运行结果界面说明。
- [`execution/WEEK7_EVIDENCE_UI.md`](features/execution/WEEK7_EVIDENCE_UI.md)：Week 7 证据界面说明。
- [`reports/STRUCTURED_REPORT_EXPORT.md`](features/reports/STRUCTURED_REPORT_EXPORT.md)：结构化报告导出。
- [`traces/TRACE_PACKAGE_WEB_PROTOTYPE.md`](features/traces/TRACE_PACKAGE_WEB_PROTOTYPE.md)：Trace package Web 原型说明。

### 架构、部署与研究

- [`architecture/AGENT_INTERVIEW_READINESS_REMEDIATION_PLAN_2026-10-29.md`](architecture/AGENT_INTERVIEW_READINESS_REMEDIATION_PLAN_2026-10-29.md)：Agent 面试准备质量审查、问题矩阵、分阶段修复路线和当前允许/禁止叙事。
- [`architecture/FRONTEND_BACKEND_ALIGNMENT_DEVELOPMENT_PLAN_2026-10-17.md`](architecture/FRONTEND_BACKEND_ALIGNMENT_DEVELOPMENT_PLAN_2026-10-17.md)：基于后端 `main@5e44dbb0` 的 **2026-10-17 dated** 前端契约、结果诊断、输入和 Trace Package 对齐开发计划；当前差异以本页的 `AI_BACKEND_BASELINE_ALIGNMENT_2026-10-24.md` 为准。
- [`architecture/EXECUTION_VISUALIZATION_DESIGN.md`](architecture/EXECUTION_VISUALIZATION_DESIGN.md)：执行可视化设计。
- [`architecture/EXECUTION_REPLAY_DESIGN.md`](architecture/EXECUTION_REPLAY_DESIGN.md)：执行回放的完整设计方案、现有证据复用、集合通信下钻、动画、性能、契约和分阶段落地计划。
- [`architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md)：后端仿真流程与前端专业工作台的
  展示覆盖度审计、四类缺口（C0 纯前端 / C1 Bridge 采集 / C2 契约面 / C3 输入面）与 `WP-2D-01` 派发提示词。
- [`deployment/F10_RELEASE_HARDENING.md`](deployment/F10_RELEASE_HARDENING.md)：发布加固与回滚。
- [`deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md`](deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md)：Windows 启动器构建、验收和回滚。
- [`deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md)：当前 Windows 安装器、离线 ZIP、WSL/native runtime、DPAPI 配置、升级回滚和实施门槛。
- [`deployment/ONE_CLICK_INSTALL_PLAN.md`](deployment/ONE_CLICK_INSTALL_PLAN.md)：旧计划的兼容入口；与当前决策不一致时以上述 2026-10-24 方案为准。
- [`research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md`](research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)：Agent 编排总方案。
- [`research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md`](research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md)：Evidence Agent 前沿扩展研究。
- [`research/TILESIM_AGENT_HARNESS_IMPLEMENTATION_PLAN_2026-10-17.md`](research/TILESIM_AGENT_HARNESS_IMPLEMENTATION_PLAN_2026-10-17.md)：Agent Harness 分阶段落地计划，涵盖工具、队列、恢复、受控执行和自主优化。
- [`F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md)：阶段 0/WP-A 当前基线、能力/权限矩阵、生命周期、评测 manifest 与 go/no-go。

## 归档分层（`archive/`）

- `archive/README.md`：归档说明与目录语义。
- `archive/development/`：F0–F10、Phase 0–0D 与界面评审的 dated 证据。
- `archive/plans/`：已执行完毕或被替代的旧计划、旧维护提示词和旧并行工作流。
- `archive/agent-orchestration/`：Agent 编排模块的已结束阶段。
  - `phase0-proposal/`、`phase0b-publication-candidate/`：早期 proposal 与候选，不是 runtime contract。
  - `phase-records/`：Phase 1–3A/3B、WP-D 等已结束阶段的 dated 验收和决策记录。
  - `plans/`：已执行完毕的 Phase 2C 和其他历史实施/修复计划。

## 更新规则

- 当前状态只写入 `AI_HANDOFF.md` 和对应模块 current baseline。
- 部署步骤变化时同步根 `README.md`、部署手册和脚本测试。
- 正式 identity、revision 和错误语义以运行时 contract 为准。
- 历史报告保留原文并移入 archive，不把旧测试数字改写成当前数字。
- 已完成的计划、一次性交接提示词和被当前路线替代的协作说明统一移入 `archive/plans/`。
- 结束一个阶段时，把该阶段的 dated 记录移入 `archive/agent-orchestration/phase-records/`，并把仍然有效的结论折进
  `AI_HANDOFF.md` 与模块 current baseline。
- 新文档必须放入对应目录，并从本页“活跃文档索引”或模块入口可达。活跃文档不得链接到已归档的阶段结论当作当前事实。

## Agent Harness 当前事实（2026-10-24）

阶段 2/3/4 的 dated 记录已归档；当前 local-dev 能力以阶段 5 baseline 为准：优化与批处理都使用独立 SQLite WAL、
人工批准、bounded execution 和 fail-closed recovery，批处理 contract 为 `2026-10-19.wpe.v1`、tool registry
为 `2026-10-19.tools.v3`。阶段 5 收尾为 `LOCAL_PHASE5_PASS`，所有结果仍标记 `local_dev`、`synthetic_trace`、
`exploratory`、`not_for_production`，Provider live acceptance、真实硬件、独立 evidence/citation review 和生产 GO
继续 pending。详见 [`31_AGENT_HARNESS_STAGE5_LOCAL_BATCH_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/31_AGENT_HARNESS_STAGE5_LOCAL_BATCH_CURRENT_BASELINE.md)。

阶段 2C Run Intake v2 仍是后端 lowering/只读边界，未成为 `/api/runs` 的执行入口；五类 Profile records 仍为
`0/unavailable`，不得新增 `agent_exposed` 字段或把 local-dev 结果升级为生产证据。
