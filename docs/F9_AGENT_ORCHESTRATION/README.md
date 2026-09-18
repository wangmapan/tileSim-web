# 基于 Agent 的仿真编排模块文档集

> 文档集 ID：`tilesim.docs.agent_orchestration.v1alpha1`
>
> 状态：Phase 1 右侧只读草案侧栏已集成 `main`；Phase 2A/2B 契约已正式发布（`4d7f9fa`）；后端 Phase 2C Run Intake
> Lowering 已落地，Bridge 侧 Run Intake v2 只读预览端点（WP-2C-01b）已注册，但只做校验与判定，既不调用后端
> lowering 也不创建 run，两侧之间仍缺显式路由；五类 Profile 真实记录仍为 `0/unavailable`，因此完整 Phase 2 的执行与
> 数据侧仍为 `blocked`
>
> 事实日期：2026-09-17
>
> Web 基线：`4d7f9fa3c330b7d6f287d12da853ec2bf481b0cb`（`HEAD == origin/main`，工作树 clean）
>
> 后端基线：本地 `main` 为 `ba11e6fdb69af046dc7597e5ef5732cce029cfbe`；公开 `origin/main` 仍为
> `7b2b1cff52fdab21575609be170c3856f120120b`（后端本地领先 2 个提交，尚未 push）
>
> 不可变 execution evidence revision：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`

本目录是一套供后续 AI Agent、开发者和评审者共同阅读的实施规范：稳定设计在前，当前事实在 `AI_HANDOFF` 与本目录
`00`/`01`，已结束阶段证据在 `docs/archive/agent-orchestration/phase-records/`。

总览见 [基于 Agent 的仿真编排模块完整开发方案](../research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)。
当前 Evidence Agent 的实际使用方式见 [Evidence Agent 使用指南](../features/evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md)。

## 0. 当前状态快照（2026-09-17 实测）

### 0.1 模块代码事实

| 模块                                                 | 规模              | 职责                                                                                                                                           |
| ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/agent-copilot-shell/`                  | 7 文件 / 1670 行  | Entry（懒加载）、Shell（四态 + resize）、Composer、ContextBar、TypedBlockList、ErrorBoundary                                                   |
| `src/features/agent-intent-compiler/`                | 10 文件 / 1887 行 | 八字段确定性意图编译、别名、单位归一、澄清、unsupported；含 WP-2C-06 新增的 `clarification-binding.ts` / `clause-selection.ts`（工作树未提交） |
| `src/features/agent-copilot-integration/`            | 3 文件 / 253 行   | 能力投影（读 Bridge capability snapshot）、block 组装、stale 标记                                                                              |
| `src/entities/agent-context` + `agent-orchestration` | 5 文件 / 497 行   | Context Envelope 注册表与本地 typed 契约 v1                                                                                                    |

挂载点：`src/App.vue`（全局常驻侧栏，lazy mount，dock 宽度随状态变化）。

### 0.2 契约与运行时状态

| 层                | 事实                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability 契约   | Catalog `tilesim.bridge.agent_orchestration_capability_catalog.v1` / `sha256:726e59ba…aa7b`；package `sha256:1fa372e1…4fe3`；schema-set（live，本轮实测）`sha256:d498092a…abffab`——`sha256:3211d2df…c15d` 是 Phase 1 冻结值，两者本就不相等                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Phase 2B 契约包   | `bridge/contracts/agent_orchestration_phase2/`，`publication_status = published`，`package_revision = sha256:59373c71…c8b6`；含五类 Profile v2、Profile Binding v1、Run Intake v2、Validation Report v1、Calculator Receipt Envelope v1 与幂等/留存 policy                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Bridge 运行时接线 | **只读预览已接线，其余能力仍为契约层**。`registry.py` 由 `bridge/services/run_intake.py` 导入，并经 `bridge/server.py` 的 `POST /api/agent/run-intake-preview` 暴露（请求信封 `…run_intake_preview_request.v1`、响应 `…run_intake_preview_response.v1`）；端点只校验与判定，不创建 run、不写 `runs/`，也不调用后端 lowering。被拒判定是**判定结果**而非错误：以 HTTP 200 + `judgement.accepted = false` 的 typed body 返回；错误信封只保留给 400（信封非法/不可判定）与 503（发布契约或 Profile 记录不可读）。包 manifest 新增 `run_intake_preview.runtime_status = read_only_preview_registered`，包级 `runtime_status` 仍为 `contract_only`、`create_run_acceptance` 仍为 `not_accepted_by_current_api` |
| 后端 lowering     | 已落地 `Core::parse_run_intake_v2` / `Core::lower_run_intake_v2`（`include/Core/RunIntakeLowering.h`、`src/Core/RunIntakeLowering.cpp`、`tests/test_run_intake_lowering.cpp`），CLI 提供只读 `validate-run-intake --run-intake <json>` / `run-intake-preview` 入口。后端自评 `partial`，执行侧因五类 Profile 记录为空而 fail closed                                                                                                                                                                                                                                                                                                                                                                       |
| 五类 Profile 记录 | 全部 `0/unavailable`，v1/v2 Schema 均主动把记录数冻结为零，无 calibration 与 held-out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| create-run        | 顶层仍为 `tilesim.bridge.create_run_request.v1`，`/api/runs` 不接受 Run Intake v2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Evidence Agent    | descriptor `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1；live repetitions 与人工 citation entailment review 均未完成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 0.3 门禁基线（本轮实测）

| 门禁               | 结果                                                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Vitest         | 535 passed / 8 skipped（含 WP-2C-06 新增 20 条，工作树未提交）                                                                                                                                                                                |
| Bridge `unittest`  | 121 passed（含 WP-2C-01a 新增 17 条、WP-2C-01b 端点级 13 条，工作树未提交）                                                                                                                                                                   |
| 后端 CTest         | 本机无 C++ 工具链，**未复跑**；以已部署版本的独立门禁为准                                                                                                                                                                                     |
| Playwright fixture | 本轮**尝试复跑但未取得完整 tally**：`--reporter=list` 下观察到 50 个 `ok`、0 个 `not ok`，随后 Playwright 自身因 worker 退出超时（每 worker 300s）强制 kill 并以 exit 1 结束，故**不得记为 passed**；与 WP-2C-01b（仅 Bridge 契约与文档）无关 |
| `git diff --check` | passed                                                                                                                                                                                                                                        |

文档中的任何历史测试数字（例如 archived phase records 里的 505/105/63/265）都是**当时**的事实，不得当作当前基线引用。

## 1. AI 必读协议

任何接手该模块的 AI 在修改代码或契约前必须：

1. 阅读 `D:\tileSim-web\AGENTS.md`、`D:\tileSim-web\docs\AI_HANDOFF.md` 和 `D:\tileSim\AGENTS.md`。
2. 阅读本文件、[约束与术语](00_GUARDRAILS_AND_GLOSSARY.md) 和 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md)。
3. 根据任务类型读取第 4 节指定专题；不得只读路线图标题后直接实现。
4. 检查两个仓库的工作树，保护所有未提交改动。
5. 把“Schema 中有字段”“Bridge 接受字段”“字段真实影响执行”“已校准”“已独立验证”视为五种不同状态。
6. 若任务需要当前契约无法表达的多轮、工具、取消、跨运行比较或持久化，先登记 contract gap，不在前端模拟。
7. 不读取、记录或输出任何 Provider credential；不通过开发任务执行 live Provider acceptance。
8. 不停止、重启或部署 `127.0.0.1:5173`，除非用户在当前任务中明确授权。

## 2. 规范词与状态标签

本文档集使用以下规范词：

- **必须/MUST**：违反即破坏契约、安全或证据边界。
- **应当/SHOULD**：默认实现方式；偏离时需要 ADR 和测试证据。
- **可以/MAY**：可选增强，不是当前验收前置条件。

事实状态使用以下标签：

| 标签                  | 含义                                       |
| --------------------- | ------------------------------------------ |
| `current_fact`        | 已由当前源码、正式契约或有效测试证据确认   |
| `historical_evidence` | 曾经通过，但不能替代当前重新验证           |
| `proposed`            | 本文建议的设计，尚未发布                   |
| `contract_gap`        | 当前契约无法表达，必须先版本化设计         |
| `backend_gap`         | 契约可能表达，但后端执行语义尚未闭合       |
| `data_gap`            | 缺少真实 profile、校准资产或 held-out 证据 |
| `research_option`     | 只有评测证明收益后才考虑的技术             |

## 3. 文档清单与阅读顺序

### 3.1 活跃文档

| 顺序 | 文档                                                                   | 何时必读                           | 核心输出                                   |
| ---- | ---------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| 00   | [约束与术语](00_GUARDRAILS_AND_GLOSSARY.md)                            | 所有任务                           | 不可破坏边界、中文模块词汇、证据等级       |
| 01   | [当前基线与缺口](01_CURRENT_BASELINE_AND_GAPS.md)                      | 所有任务                           | 代码事实、参数能力矩阵、gap register 入口  |
| 02   | [产品与用户体验](02_PRODUCT_AND_USER_EXPERIENCE.md)                    | 产品、前端、交互、Demo             | 用户任务、信息架构、状态与文案规则         |
| 03   | [目标架构与职责](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)              | 架构、服务拆分、跨模块改动         | 组件、所有权、数据流和依赖方向             |
| 04   | [能力与 Profile 目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)            | 参数、模型、硬件、模板任务         | Profile 模型、支持状态、发布与失效规则     |
| 05   | [会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)               | Schema、Bridge、generated client   | contract family、状态、identity、retention |
| 06   | [意图编译与主动澄清](06_INTENT_COMPILER_AND_CLARIFICATION.md)          | LLM、prompt、compiler、对话        | 编译流水线、slot、歧义和澄清策略           |
| 07   | [确定性校验与实验规划](07_DETERMINISTIC_VALIDATION_AND_PLANNING.md)    | 约束、计算器、候选规划             | validators、calculators、SLO 和候选边界    |
| 08   | [工作流、审批与执行](08_WORKFLOW_APPROVAL_AND_EXECUTION.md)            | 异步、恢复、取消、写工具           | workflow state、HITL、幂等和故障语义       |
| 09   | [RAG、证据与记忆](09_RAG_EVIDENCE_AND_MEMORY.md)                       | 检索、引用、会话记忆               | 四类索引、retrieval ladder、retention      |
| 10   | [工具、安全与互操作](10_TOOLS_SECURITY_AND_INTEROPERABILITY.md)        | tool calling、MCP、A2A、多 Agent   | 权限矩阵、威胁模型、协议边界               |
| 11   | [评测、可观测性与验收](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md)  | 测试、上线、模型切换               | dataset、metrics、hard gates、trace        |
| 12   | [交付路线图与工作包](12_DELIVERY_ROADMAP_AND_BACKLOG.md)               | 排期、拆任务、并行协作             | phase、依赖、DoR/DoD、backlog              |
| 13   | [面试 Demo 与 ADR](13_INTERVIEW_DEMO_AND_ADRS.md)                      | 作品包装、技术选型                 | 演示脚本、ADR 清单、简历证据               |
| 14   | [契约缺口登记表](14_CONTRACT_GAP_REGISTER.md)                          | 任何新增能力前                     | 稳定 gap ID、owner、阻塞与退出条件         |
| 15   | [模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md) | 拆任务、多 Agent、集成             | 独占范围、接口、共享文件和合并顺序         |
| 16   | [全局右侧 Agent 对话栏](16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md)          | App Shell、跨页面助手、对话交互    | 侧栏、页面上下文、typed blocks 和分期接入  |
| 17   | [开发者指导 AI 实施手册](17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md)        | 启动阶段、多 Agent、调试和验收     | 必读路由、提示词模板、分工和门禁           |
| 18   | [Phase 0–7 可复制提示词包](18_COPY_READY_MULTI_AGENT_PROMPTS.md)       | 实际启动一个并行开发阶段           | 八个完整总控提示词和三路子 Agent 分工      |
| 23   | [Phase 2C Web 集成计划](23_PHASE2C_WEB_INTEGRATION_PLAN.md)            | 下一步实施、拆工作包、写任务提示词 | 现状缺口、工作包、写入边界、门禁和退出条件 |
| 24   | [Phase 2C 派发提示词与验收协议](24_PHASE2C_WORK_PACKAGE_PROMPTS.md)    | 派发工作包、审查执行方回传         | 批次划分、可复制提示词、回传格式、验收清单 |

### 3.2 已归档的阶段记录

以下四篇是 dated 阶段证据，**不是当前事实来源**。只有追溯决定、测试来源或历史回归时才读取。

| 原序号 | 归档路径                                                                                                                                            | 归档原因                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 19     | [`phase-records/19_PHASE1_WEB_LOCAL_ACCEPTANCE.md`](../archive/agent-orchestration/phase-records/19_PHASE1_WEB_LOCAL_ACCEPTANCE.md)                 | Phase 1 已结束并集成 `main`             |
| 20     | [`phase-records/20_PHASE2_READINESS_AUDIT.md`](../archive/agent-orchestration/phase-records/20_PHASE2_READINESS_AUDIT.md)                           | 契约侧 `blocked` 裁决已被 2A/2B/2C 取代 |
| 21     | [`phase-records/21_PHASE2A_CONTRACT_PROPOSAL.md`](../archive/agent-orchestration/phase-records/21_PHASE2A_CONTRACT_PROPOSAL.md)                     | 候选已由 Phase 2B 正式发布取代          |
| 22     | [`phase-records/22_PHASE2B_BRIDGE_CONTRACT_PUBLICATION.md`](../archive/agent-orchestration/phase-records/22_PHASE2B_BRIDGE_CONTRACT_PUBLICATION.md) | Phase 2B 已提交完成（`4d7f9fa`）        |

## 4. 按任务路由阅读

| 任务                     | 必读文档                           |
| ------------------------ | ---------------------------------- |
| 扩展普通语言参数配置     | 00、01、02、04、05、06、07、11、14 |
| 增加多轮会话             | 00、01、05、06、08、09、10、11、14 |
| 允许 Agent 创建实验      | 00、01、03、05、07、08、10、11、14 |
| 接入 RAG                 | 00、01、03、09、10、11、14         |
| 增加模型/设备 Profile    | 00、01、04、07、11、12、14         |
| 做跨运行比较             | 00、01、05、07、08、09、11、14     |
| 接入 MCP/A2A             | 00、03、05、08、10、11、14         |
| 拆多 Agent               | 00、03、08、09、10、11、13、14     |
| 多个开发 Agent 并行实施  | 00、03、05、11、12、14、15         |
| 实现跨页面右侧对话栏     | 00、02、03、05、08、10、15、16     |
| 组织多个 AI 开发和验收   | 00、01、11、12、14、15、17         |
| 复制提示词启动某一阶段   | 01、12、14、15、17、18             |
| 推进 Phase 2C Web 集成   | 01、05、07、12、14、15、23         |
| 派发任务给其他开发 Agent | 01、12、14、15、17、23、24         |
| 准备面试演示             | 01、02、11、12、13、14             |

## 5. 单一事实来源

| 事实                                         | 权威来源                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| 目标系统架构、模块边界、保真度和证据原则     | `D:\tileSim\AGENTS.md` 及后端公开架构文档                   |
| 后端真实可执行能力                           | `D:\tileSim` 源码、CLI、测试和正式报告                      |
| Bridge 可提交能力                            | OpenAPI、JSON Schema、runtime capability/descriptor         |
| 前端可用能力                                 | Bridge descriptor 与生成类型的交集                          |
| resolved fidelity、validation 和 attribution | 当前 run 的正式执行包络和报告                               |
| Evidence Agent 能力                          | `tilesim.bridge.evidence_agent_descriptor.v2`               |
| Phase 2 契约与运行时边界                     | `bridge/contracts/agent_orchestration_phase2/manifest.json` |
| 本文档中的新增对象                           | `proposed`，直到 Bridge 正式发布相应契约                    |

项目所有者点对点提供的私有主设计资料不得被重新整理进本目录。公开文档只引用仓库可见资料。

## 6. 变更纪律

- 每个实现 PR 应引用一个或多个 `REQ-*`、`GAP-*` 或 Phase 工作项。
- 修改支持状态时必须同时更新 01、04 和 14。
- 修改 contract family 时必须同时更新 05、生成类型、fixture 和兼容性说明。
- 修改工作流终态时必须同时更新 08、11 和 E2E。
- 修改 RAG/citation/retention 时必须同时更新 09、10 和 11。
- 修改总排期时更新 12；总览只保留高层结论，不复制逐项 backlog。
- 拆分并行任务或改变代码所有权时更新 15；共享契约和生成物始终由单一集成 owner 更新。
- 结束一个阶段时：把该阶段的 dated 记录移入 `docs/archive/agent-orchestration/phase-records/`，并把仍然有效的结论
  折进 01、12、14；不要在阶段文档里原地改写历史数字。
- 文档结论不得覆盖正式运行时 descriptor；二者冲突时运行时能力 fail closed，并登记 drift。

## 7. 当前最近行动

当前**可安全推进**的是 Phase 2C 的 Web/Bridge 侧集成（契约已发布、后端 lowering 已就绪，但两者之间还没有接线），
而不是新增 `agent_exposed` 字段或启动 Profile 数据工作。

1. 按 [AO-23 Phase 2C Web 集成计划](23_PHASE2C_WEB_INTEGRATION_PLAN.md) 推进 `WP-2C-01a` 起的工作包；第一批只做
   Bridge 侧 Run Intake v2 的严格路由与 typed 校验，不创建 run。派发提示词、回传格式与验收清单见
   [AO-24 派发提示词与验收协议](24_PHASE2C_WORK_PACKAGE_PROMPTS.md)。
2. 派发前必须遵守 AO-23 §2.1：`SCHEMA_SET_REVISION` 覆盖 `bridge/contracts/**/*.json`，改动任何契约 JSON 都会级联
   前端 fixture 与文档，因此只有契约发布批次（`WP-2C-01b`）可以触碰，且由单一集成 owner 实施。
3. 五类 Profile 正式记录保持 `0/unavailable`；在真实数据、license/source 审核和 calibration 到位前，不得新增
   `agent_exposed` 字段，也不得把模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信或 SLO 显示为可用。
4. `GAP-DRAFT-001`、`GAP-VALIDATE-001`、`GAP-CLARIFY-001` 中，`GAP-CLARIFY-001` 的 answer binding 是当前唯一
   不依赖新契约就能闭环的前端缺口，可作为并行小批次。
5. 只有 [02A/02B 契约](14_CONTRACT_GAP_REGISTER.md)、真实数据与后端累计执行证据同时满足时，才重新审计 Phase 2 的
   Definition of Ready。

`GAP-CAP-001`、`GAP-PROFILE-001`、`GAP-CONTRACT-DRIFT-001`、`GAP-COPILOT-UI-001` 为 `validated`。其中 Profile 状态只
表示五类 Schema 已发布且正确表达 0/unavailable；真实 Profile source/licensing/calibration 仍是独立数据 Gap。
