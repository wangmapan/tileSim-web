# TileSim Web 文档入口

本文档树按“当前事实优先、稳定设计其次、历史证据最后”组织。AI 不得从文件日期推断当前状态。

2026-10-18 增量：Bridge Agent Harness 阶段 2 已发布 draft/validation/approval successor `2026-10-18.wpb.v1`；
详见 [`AI_HANDOFF.md`](AI_HANDOFF.md) 和 [`../bridge/README.md`](../bridge/README.md)。

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

### 接手与开发参考（`getting-started/`）

- [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、一键部署、图形启动器与常见故障。
- [`getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md`](getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md)：前端开发的接手一页图 ——
  代码地图（`views`/`features`/`stores`/`contracts` 边界）、路由 ↔ view 对照、状态归属（TanStack Query vs Pinia）、
  契约与生成物规则、**本机无 pnpm 的可跑命令**、实测门禁基线、本机特有的坑、按任务的文档路由与证据红线。

### Agent 编排模块（`F9_AGENT_ORCHESTRATION/`）

模块入口与阅读顺序见 [`F9_AGENT_ORCHESTRATION/README.md`](F9_AGENT_ORCHESTRATION/README.md)。其中
`00`–`18` 是规范与流程文档，`23`（Phase 2C Web 集成计划）与 `24`（派发提示词与验收协议）是下一批工作包。

### 契约审计（`contracts/`）

- [`F6B_WEEK8_CONTRACT_GAPS.md`](contracts/F6B_WEEK8_CONTRACT_GAPS.md)：Week 8 证据链契约缺口。
- [`F7_CONTRACT_AUDIT.md`](contracts/F7_CONTRACT_AUDIT.md)：F7 fabric slice 契约审计。
- [`F8_EXPERIMENT_ORCHESTRATION_AUDIT.md`](contracts/F8_EXPERIMENT_ORCHESTRATION_AUDIT.md)：实验编排契约审计。
- [`F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`](contracts/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md)：Evidence Agent 契约审计；正式能力以运行时
  descriptor 为准。
- [`F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`](contracts/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md)：Evidence Agent 评测规范与 hard gate。
- [`agent-harness/README.md`](contracts/proposals/agent-harness/README.md)：Agent Harness 阶段 0/WP-A proposal-only 对象、状态、错误、恢复和迁移登记；正式 v1 只读接入与当前事实见 [`F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md)。

### 功能说明（`features/`）

- [`evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md`](features/evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md)：Evidence Agent 使用指南。
- [`execution/WEEK6_RESULTS_UI.md`](features/execution/WEEK6_RESULTS_UI.md)：运行结果界面说明。
- [`execution/WEEK7_EVIDENCE_UI.md`](features/execution/WEEK7_EVIDENCE_UI.md)：Week 7 证据界面说明。
- [`reports/STRUCTURED_REPORT_EXPORT.md`](features/reports/STRUCTURED_REPORT_EXPORT.md)：结构化报告导出。
- [`traces/TRACE_PACKAGE_WEB_PROTOTYPE.md`](features/traces/TRACE_PACKAGE_WEB_PROTOTYPE.md)：Trace package Web 原型说明。

### 架构、部署与研究

- [`architecture/FRONTEND_BACKEND_ALIGNMENT_DEVELOPMENT_PLAN_2026-10-17.md`](architecture/FRONTEND_BACKEND_ALIGNMENT_DEVELOPMENT_PLAN_2026-10-17.md)：基于后端 `main@5e44dbb0` 的前端契约、结果诊断、输入和 Trace Package 对齐开发计划。
- [`architecture/EXECUTION_VISUALIZATION_DESIGN.md`](architecture/EXECUTION_VISUALIZATION_DESIGN.md)：执行可视化设计。
- [`architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md)：后端仿真流程与前端专业工作台的
  展示覆盖度审计、四类缺口（C0 纯前端 / C1 Bridge 采集 / C2 契约面 / C3 输入面）与 `WP-2D-01` 派发提示词。
- [`deployment/F10_RELEASE_HARDENING.md`](deployment/F10_RELEASE_HARDENING.md)：发布加固与回滚。
- [`deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md`](deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md)：Windows 启动器构建、验收和回滚。
- [`deployment/DEPLOYMENT_READINESS.md`](deployment/DEPLOYMENT_READINESS.md)：当前可打包性、对外部署欠缺、实测证据和补齐路线。
- [`deployment/ONE_CLICK_INSTALL_PLAN.md`](deployment/ONE_CLICK_INSTALL_PLAN.md)：面向其他使用者的一键安装发行包计划、阶段目标和验收矩阵。
- [`research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md`](research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)：Agent 编排总方案。
- [`research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md`](research/F9_EVIDENCE_AGENT_FRONTIER_EXPANSION_PLAN.md)：Evidence Agent 前沿扩展研究。
- [`research/TILESIM_AGENT_HARNESS_IMPLEMENTATION_PLAN_2026-10-17.md`](research/TILESIM_AGENT_HARNESS_IMPLEMENTATION_PLAN_2026-10-17.md)：Agent Harness 分阶段落地计划，涵盖工具、队列、恢复、受控执行和自主优化。
- [`F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md`](F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md)：阶段 0/WP-A 当前基线、能力/权限矩阵、生命周期、评测 manifest 与 go/no-go。
- [`F9_AGENT_ORCHESTRATION/27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md`](F9_AGENT_ORCHESTRATION/27_AGENT_HARNESS_WP_D_RUNTIME_BAKEOFF.md)：WP-D durable runtime 评估、比较矩阵与继续引入 runtime 的 go/no-go。

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

# Agent Harness 阶段 2 当前事实（2026-10-18）

Bridge 已发布 draft/validation/approval successor `2026-10-18.wpb.v1`。canonical identity、API、权限、retention、
stale/replay 语义和零 run 副作用证据见 [`bridge/README.md`](../bridge/README.md) 与 `docs/AI_HANDOFF.md`；proposal-only
对象仍仅作历史设计输入。

# Agent Harness 阶段 3 local-dev / 3B 当前事实（2026-10-19）

本地个人使用路径已完成 `LOCAL_ONLY_PASS`：新的 `local_dev` deployment manifest 通过当前源码/Bridge/生成物/CLI
identity 校验，AH3-F01–AH3-F26 为 26/26，前端已接入正式 WPC submit、状态、事件、SSE、polling、result、cancel、
retry 和 resume。证据固定为 `local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`；生产 Provider
acceptance、成功 repetition 和独立生产 review 仍 pending。正式 release-gate 虽为 54/54 pass，结论仍为 `NO-GO`，
不得把本地结果描述为生产 GO。阶段 4 继续关闭。详见 [`30_AGENT_HARNESS_STAGE3_LOCAL_DEV_3B.md`](F9_AGENT_ORCHESTRATION/30_AGENT_HARNESS_STAGE3_LOCAL_DEV_3B.md)。

# Agent Harness 阶段 3A

受控执行 successor contract 与 endpoint 说明位于 `F9_AGENT_ORCHESTRATION/README.md`、
`F9_AGENT_ORCHESTRATION/26_AGENT_HARNESS_PHASE0_WP_A_CURRENT_BASELINE.md` 和
`D:\tileSim-web\bridge\README.md`。阶段 3A 只支持人工批准后的单次实验，Provider acceptance 仍待验收。
