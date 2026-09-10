# 基于 Agent 的仿真编排模块文档集

> 文档集 ID：`tilesim.docs.agent_orchestration.v1alpha1`
>
> 状态：Phase 1 Web 八字段只读草案侧栏已完成本地 Git 集成；正式写工作流仍未启动
>
> 事实日期：2026-09-10
>
> 后端 execution evidence commit：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`
>
> Web Phase 1 开发基线：`b46b9783bdd8a8ed330cffe549327e4e381b6f03`

Phase 0B 开发基线为后端 `09c22c0efff890253a1eacf403c2979f56fd9ba6`、Web
`09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`。2026-09-08 的只读审计发现 `127.0.0.1:5173`
已由本任务之外的动作更新为 schema-set `sha256:2214c4ea…2af8`、experiment descriptor
`sha256:1ef96215…f4f1`；本批未部署、停止、重启或替换该服务。该 deployed state 与 dirty F8 源码一致，
但同一 v1 identity 下破坏旧 payload，不能作为正式源码目标。

Phase 0C 已恢复 nested v1 的旧接受集合，并新增 nested v2 承载严格规则；create-run v1 双版本兼容矩阵和独立
oracle 已通过。正式 Capability Catalog、snapshot、parameter descriptor 与五类 Profile Schema 已进入
OpenAPI/schema-set/manifest/generated/runtime validator，Bridge 与 Web 只读 adapter 已闭合。Phase 0D 已把八字段执行证据
绑定到独立后端 commit，Web runtime/reproducibility commits 为 `64a741f3…` / `df1f2445…`，Git 可复现性 oracle
为 8/8，runtime/reproducibility HEAD snapshot 为 `sha256:2411a70b…673a0`，docs/evidence commit 为
`b46b9783bdd8a8ed330cffe549327e4e381b6f03`。未部署 5173。
Phase 1 已在 Web 开发基线之上实现本地、单轮、无副作用的八字段参数草案：全局右侧栏、最小只读页面上下文、
确定性意图编译、typed blocks、stale 隔离和 128 条 fixture eval 已完成。该实现不发布新的 Bridge contract，
不创建运行，不调用 Evidence Provider，也不关闭正式 Draft、Validation、Conversation、Approval 或 Workflow Gap。
准确验收记录见 [Phase 1 Web 本地验收](19_PHASE1_WEB_LOCAL_ACCEPTANCE.md)。

本目录是一套供后续 AI Agent、开发者和评审者共同阅读的实施规范。它将总路线图拆成可独立执行的专题文档，并明确区分当前事实、拟议设计、契约缺口和远期研究项。

总览见 [基于 Agent 的仿真编排模块完整开发方案](../research/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md)。当前 Evidence Agent 的实际使用方式见 [Evidence Agent 使用指南](../features/evidence-agent/F9_EVIDENCE_AGENT_USER_GUIDE.md)。

## 1. AI 必读协议

任何接手该模块的 AI 在修改代码或契约前必须：

1. 阅读 `D:\tileSim-web\AGENTS.md`、`D:\tileSim-web\docs\AI_HANDOFF.md` 和 `D:\tileSim\AGENTS.md`。
2. 阅读本文件、[约束与术语](00_GUARDRAILS_AND_GLOSSARY.md) 和 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md)。
3. 根据任务类型读取下表指定专题；不得只读路线图标题后直接实现。
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

| 顺序 | 文档                                                                   | 何时必读                         | 核心输出                                   |
| ---- | ---------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ |
| 00   | [约束与术语](00_GUARDRAILS_AND_GLOSSARY.md)                            | 所有任务                         | 不可破坏边界、中文模块词汇、证据等级       |
| 01   | [当前基线与缺口](01_CURRENT_BASELINE_AND_GAPS.md)                      | 所有任务                         | 代码事实、参数能力矩阵、gap register 入口  |
| 02   | [产品与用户体验](02_PRODUCT_AND_USER_EXPERIENCE.md)                    | 产品、前端、交互、Demo           | 用户任务、信息架构、状态与文案规则         |
| 03   | [目标架构与职责](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)              | 架构、服务拆分、跨模块改动       | 组件、所有权、数据流和依赖方向             |
| 04   | [能力与 Profile 目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)            | 参数、模型、硬件、模板任务       | Profile 模型、支持状态、发布与失效规则     |
| 05   | [会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)               | Schema、Bridge、generated client | contract family、状态、identity、retention |
| 06   | [意图编译与主动澄清](06_INTENT_COMPILER_AND_CLARIFICATION.md)          | LLM、prompt、compiler、对话      | 编译流水线、slot、歧义和澄清策略           |
| 07   | [确定性校验与实验规划](07_DETERMINISTIC_VALIDATION_AND_PLANNING.md)    | 约束、计算器、候选规划           | validators、calculators、SLO 和候选边界    |
| 08   | [工作流、审批与执行](08_WORKFLOW_APPROVAL_AND_EXECUTION.md)            | 异步、恢复、取消、写工具         | workflow state、HITL、幂等和故障语义       |
| 09   | [RAG、证据与记忆](09_RAG_EVIDENCE_AND_MEMORY.md)                       | 检索、引用、会话记忆             | 四类索引、retrieval ladder、retention      |
| 10   | [工具、安全与互操作](10_TOOLS_SECURITY_AND_INTEROPERABILITY.md)        | tool calling、MCP、A2A、多 Agent | 权限矩阵、威胁模型、协议边界               |
| 11   | [评测、可观测性与验收](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md)  | 测试、上线、模型切换             | dataset、metrics、hard gates、trace        |
| 12   | [交付路线图与工作包](12_DELIVERY_ROADMAP_AND_BACKLOG.md)               | 排期、拆任务、并行协作           | phase、依赖、DoR/DoD、backlog              |
| 13   | [面试 Demo 与 ADR](13_INTERVIEW_DEMO_AND_ADRS.md)                      | 作品包装、技术选型               | 演示脚本、ADR 清单、简历证据               |
| 14   | [契约缺口登记表](14_CONTRACT_GAP_REGISTER.md)                          | 任何新增能力前                   | 稳定 gap ID、owner、阻塞与退出条件         |
| 15   | [模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md) | 拆任务、多 Agent、集成           | 独占范围、接口、共享文件和合并顺序         |
| 16   | [全局右侧 Agent 对话栏](16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md)          | App Shell、跨页面助手、对话交互  | 侧栏、页面上下文、typed blocks 和分期接入  |
| 17   | [开发者指导 AI 实施手册](17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md)        | 启动阶段、多 Agent、调试和验收   | 必读路由、提示词模板、分工和门禁           |
| 18   | [Phase 0–7 可复制提示词包](18_COPY_READY_MULTI_AGENT_PROMPTS.md)       | 实际启动一个并行开发阶段         | 八个完整总控提示词和三路子 Agent 分工      |
| 19   | [Phase 1 Web 本地验收](19_PHASE1_WEB_LOCAL_ACCEPTANCE.md)              | Phase 1 复核、集成和交接         | 实现边界、门禁、证据等级与 remaining Gap   |

## 4. 按任务路由阅读

| 任务                    | 必读文档                           |
| ----------------------- | ---------------------------------- |
| 扩展普通语言参数配置    | 00、01、02、04、05、06、07、11、14 |
| 增加多轮会话            | 00、01、05、06、08、09、10、11、14 |
| 允许 Agent 创建实验     | 00、01、03、05、07、08、10、11、14 |
| 接入 RAG                | 00、01、03、09、10、11、14         |
| 增加模型/设备 Profile   | 00、01、04、07、11、12、14         |
| 做跨运行比较            | 00、01、05、07、08、09、11、14     |
| 接入 MCP/A2A            | 00、03、05、08、10、11、14         |
| 拆多 Agent              | 00、03、08、09、10、11、13、14     |
| 多个开发 Agent 并行实施 | 00、03、05、11、12、14、15         |
| 实现跨页面右侧对话栏    | 00、02、03、05、08、10、15、16     |
| 组织多个 AI 开发和验收  | 00、01、11、12、14、15、17         |
| 复制提示词启动某一阶段  | 01、12、14、15、17、18             |
| 准备面试演示            | 01、02、11、12、13、14             |

## 5. 单一事实来源

| 事实                                         | 权威来源                                            |
| -------------------------------------------- | --------------------------------------------------- |
| 目标系统架构、模块边界、保真度和证据原则     | `D:\tileSim\AGENTS.md` 及后端公开架构文档           |
| 后端真实可执行能力                           | `D:\tileSim` 源码、CLI、测试和正式报告              |
| Bridge 可提交能力                            | OpenAPI、JSON Schema、runtime capability/descriptor |
| 前端可用能力                                 | Bridge descriptor 与生成类型的交集                  |
| resolved fidelity、validation 和 attribution | 当前 run 的正式执行包络和报告                       |
| Evidence Agent 能力                          | `tilesim.bridge.evidence_agent_descriptor.v2`       |
| 本文档中的新增对象                           | `proposed`，直到 Bridge 正式发布相应契约            |

项目所有者点对点提供的私有主设计资料不得被重新整理进本目录。公开文档只引用仓库可见资料。

## 6. 变更纪律

- 每个实现 PR 应引用一个或多个 `REQ-*`、`GAP-*` 或 Phase 工作项。
- 修改支持状态时必须同时更新 01、04 和 14。
- 修改 contract family 时必须同时更新 05、生成类型、fixture 和兼容性说明。
- 修改工作流终态时必须同时更新 08、11 和 E2E。
- 修改 RAG/citation/retention 时必须同时更新 09、10 和 11。
- 修改总排期时更新 12；总览只保留高层结论，不复制逐项 backlog。
- 拆分并行任务或改变代码所有权时更新 15；共享契约和生成物始终由单一集成 owner 更新。
- 文档结论不得覆盖正式运行时 descriptor；二者冲突时运行时能力 fail closed，并登记 drift。

## 7. 当前最近行动

优先完成：

1. 审计 Phase 2 的五类真实 Profile、模型/设备/引擎选择、TP/PP/EP、物理 KV、工作负载和网络累计链 DoR；
2. 五类 Profile 的正式 Schema 保持已发布但实际数据为 0/unavailable，真实 source/licensing/calibration Gap 继续开放；
3. Phase 1 Web 只读草案侧栏已完成 `validated` 本地集成；正式 Draft、Validation、Conversation、Approval、Workflow、
   RAG 与写工具仍需新契约；
4. 不自动启动 Phase 2，也不把本地草案能力描述成外部模型对话或正式运行能力。

当前 catalog revision 为 `sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b`，
contract package revision 为 `sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3`，
schema-set revision 为 `sha256:3211d2df2e166a0ebc62f0f08ad014bf15fee8fb4bda79f3372897be3c28c15d`。
`GAP-CAP-001`、`GAP-PROFILE-001`、`GAP-CONTRACT-DRIFT-001` 均为 `validated`。其中 Profile 状态只表示五类
Schema 已发布且正确表达 0/unavailable；真实 Profile source/licensing/calibration 仍是独立数据 Gap。
