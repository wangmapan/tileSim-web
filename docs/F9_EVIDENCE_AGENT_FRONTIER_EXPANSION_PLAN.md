# Evidence Agent 前沿技术调研与拓展计划

> 调研日期：2026-09-02
>
> 目标：把当前 Evidence Agent 从“单轮、当前 run、严格引用的证据解释器”，演进为可用于求职面试展示的“可验证仿真研究 Agent”。
>
> 本文是设计与路线图，不代表下述新协议已经由 Bridge 发布。任何 proposed identity、endpoint 或状态都必须经过正式契约设计、生成代码和兼容性评审后才能实现。

## 1. 执行摘要

不建议把项目扩展成普通聊天机器人，也不建议第一步就引入多 Agent 或把全部 artifact 切块写进向量数据库。

TileSim 最有辨识度的方向是：

> 一个能够围绕仿真实验进行多轮澄清、结构化证据检索、跨-run比较、实验规划和受控执行，同时保持逐条引用、无损数值、来源边界与人工确认的研究型 Agent。

推荐的建设顺序：

1. 先完成真实 Provider 验收和可观测性基线；
2. 建设当前 run 的结构化混合 RAG；
3. 发布多轮会话、异步任务和逐轮证据绑定契约；
4. 将流程改造成可恢复的 deterministic + agentic workflow；
5. 增加只读 MCP 工具，再增加需要人工确认的实验草案工具；
6. 最后做跨-run比较、有限多 Agent 协作和模型/提示优化。

这条路线同时覆盖面试中常见的系统设计主题：RAG、Agent orchestration、memory、tool use、MCP、durable execution、human-in-the-loop、observability、evaluation、security 和 contract evolution。

## 2. 当前基线

当前 Evidence Agent 已经具备一些比普通 Demo 更扎实的能力：

- descriptor v2 驱动的能力发现；
- request/response/citation/snapshot v1；
- 绑定当前 run、request、backend、schema revision 和 snapshot digest；
- atomic claim 与精确 run/artifact/schema/SHA-256/JSON Pointer/stable subject citation；
- uint64 ps/bytes/count 无损展示；
- Provider 输出、citation、身份和终态校验；
- 两类正式 409、stale、partial、refused、truncated、502/503/504 的区分；
- 明确禁止静默 Provider 重调；
- 问题、artifact payload、raw response、claims、credential 和 hidden reasoning 不做新增持久化。

当前主要缺口：

- live Provider 尚不可用，live repetitions 为 0；
- 当前是单轮同步请求，没有澄清式多轮对话；
- 没有检索索引、query planning、hybrid retrieval 和 reranking；
- 没有 Agent workflow checkpoint；
- 没有受控工具调用或实验执行闭环；
- 没有跨-run比较；
- 没有面向 RAG、工具和长任务的系统化评测集。

## 2A. 可行性与成熟度审计

### 2A.1 当前实现约束

当前 Bridge 是 Python 标准库 `ThreadingHTTPServer`，Evidence Agent 使用同步终态、进程内 operation lock、闭合
Schema、生成客户端和严格 Provider adapter。仓库尚未引入检索数据库、embedding runtime、消息队列、workflow
engine 或 conversation store。

这意味着：

- Phase 0 可以直接在现有实现上完成；
- Phase 1 的 exact/metadata/lexical retrieval 可以渐进加入，但向量检索必须由评测证明必要性；
- Phase 2 可以先发布同步多轮契约，异步执行不能用后台线程或前端轮询伪装；
- Phase 3 以后是 Bridge/契约/运维共同演进，不是单纯前端功能；
- MCP、A2A 和多 Agent 只能作为已验证内部能力的适配层，不能成为内部事实真源。

### 2A.2 运行状态真源

当前文档中的 Provider 状态记录并不完全一致：F9 评测规范和用户指南记录 `provider_unavailable`，F10 的发布文档
记录 authenticated probe available，但同样确认 live repetitions 为 0、acceptance pending。任何路线图或演示都不能
从这些静态文字推断目标环境的实时状态。

Phase 0 必须先生成一份不可变的 live acceptance manifest，绑定 deployment/release、descriptor、Provider/model、
prompt/policy revision、测试时间、重复次数和结果摘要。在该 manifest 完成前，对外统一表述为
`live acceptance pending`，而不是“已接入”或“不可用”的永久结论。

### 2A.3 成熟度判定

每一阶段同时满足以下三类条件才算完成：

1. **产品有用**：解决一个真实用户任务，并通过无答案、失败和边界场景；
2. **工程可运行**：有版本化契约、迁移/回滚、可观测性、预算和故障恢复证据；
3. **可以讲清**：保留 ADR、架构/时序图、冻结评测集、前后指标、失败案例和可复现 Demo。

只完成 UI、框架接线或一次成功模型调用，不算阶段完成。

### 2A.4 单人实施量级

以下是一个熟悉当前仓库的全职工程师、已有 Provider 权限、复用现有契约/测试基础时的粗粒度量级，不是交付承诺：

| 阶段    | 预计量级 | 主要风险                                   |
| ------- | -------- | ------------------------------------------ |
| Phase 0 | 1–2 周   | Provider 权限、live 样本和双人复核         |
| Phase 1 | 3–5 周   | 黄金问题集、检索质量和无损 evidence index  |
| Phase 2 | 3–5 周   | 会话/留存契约、并发与旧 snapshot 隔离      |
| Phase 3 | 4–8 周   | durable runtime 运维、幂等和故障恢复       |
| Phase 4 | 4–6 周   | 工具权限、审批和副作用隔离                 |
| Phase 5 | 4–8 周   | 跨-run可比性、多主体 citation 和上下文隔离 |
| Phase 6 | 持续演进 | 数据泄漏、过拟合、模型/成本漂移            |

Phase 0 + Phase 1 是最小有用产品；Phase 2 + Phase 3 形成成熟的可交互作品；Phase 4 只需完成一个只读工具和
一个人工确认的实验草案闭环，就已经有足够系统深度。Phase 5/6 不应成为首个可用版本的前置条件。

## 3. 外部项目调研

### 3.1 编排、状态与持久执行

| 项目                                                                                                       | 已验证的关键机制                                                                                                                             | 对 TileSim 的启示                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)                                      | 在一个 graph 中混合 deterministic step 与 LLM step；强调 persistence、durable execution、streaming、human-in-the-loop、memory 和 time travel | Evidence Agent 应显式建模状态机；证据校验、权限和提交必须是确定性节点，模型只处理需要语言理解的节点 |
| [AutoGen AgentChat](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html) | 高层 Agent/Team API，底层是 event-driven core；包含 GraphFlow、Swarm、memory/RAG、state、termination 和 tracing                              | 多 Agent 应以角色、上下文和权限隔离为理由，而不是为了展示“Agent 数量”                               |
| [LlamaIndex Workflows](https://developers.llamaindex.ai/python/llamaagents/workflows/)                     | event-driven、typed event、branch、loop、concurrency、streaming、state、human input 和 durable workflow                                      | Bridge 的新流程可以采用 typed event/state；每个 event 必须携带 operation/turn/snapshot identity     |
| [Pydantic AI Durable Execution](https://pydantic.dev/docs/ai/capabilities/durable_execution/overview/)     | 与 Temporal、DBOS、Prefect、Restate 集成，覆盖故障恢复、长任务、异步和 human-in-the-loop                                                     | 不应自行发明不可靠的内存任务队列；可先定义 workflow adapter，再选择一种成熟 durable runtime         |
| [Google ADK Workflows](https://adk.dev/workflows/)                                                         | graph、dynamic、collaborative 和 template workflow；强调可预测执行、职责拆分和上下文限制                                                     | 对 TileSim 最合适的是 graph/dynamic workflow；runtime routing 和 collaborative workflow 应留到后期  |

### 3.2 RAG 与检索

| 项目/技术                                                                                    | 已验证的关键机制                                                                                                                                     | 对 TileSim 的启示                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) | Contextual Embeddings + Contextual BM25；结合 embedding、BM25、rank fusion 和 reranking。其公开实验报告称失败检索降低 49%，加入 reranking 后降低 67% | 不能只做 vector top-k。TileSim 的 request ID、subsystem、schema 和指标名需要 lexical/metadata 精确匹配，再用 embedding 补充语义召回；百分比是供应商实验结果，不直接视为 TileSim 收益 |
| [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)                                  | 从文本构建 entity/relationship/claim graph 和 community hierarchy；提供 Global、Local、DRIFT、Basic search                                           | GraphRAG 适合架构文档、设计决策和跨文档概念关系，不适合替代 metrics/artifact 的精确 subject 与 Pointer 检索                                                                          |
| [LlamaIndex Workflows](https://developers.llamaindex.ai/python/llamaagents/workflows/)       | retrieval 可以作为 workflow step，与分支、循环、人类输入及 typed state 组合                                                                          | retrieval 不是一次库调用，而应成为可记录候选、过滤、rerank 和证据充足性结果的独立阶段                                                                                                |

### 3.3 记忆与会话

| 项目                                                                            | 已验证的关键机制                                                                                              | 对 TileSim 的启示                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [Letta Stateful Agents](https://docs.letta.com/v1-sdk/concepts/stateful-agents) | 将 agent、memory blocks、messages、runs/steps 和 conversations 分开；区分 in-context 与 out-of-context memory | 可以借鉴概念分层，但不能照搬“全部消息和 reasoning 永久保存”。TileSim 应默认短期、最小化、可删除，并禁止 hidden reasoning 持久化 |
| [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)           | short-term working memory 与跨 session long-term memory 分离                                                  | 先实现 conversation-local working memory；长期用户偏好必须 opt-in，并与实验事实完全分库                                         |

### 3.4 工具、协议和执行边界

| 项目/协议                                                                                    | 已验证的关键机制                                                                                                      | 对 TileSim 的启示                                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [Model Context Protocol](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture) | Host/client/server；capability/version discovery；tools、resources、prompts；stdio 与 Streamable HTTP；通知和进度     | 可以把 TileSim 的只读报告查询做成 MCP resources/tools，但内部 canonical contract 不应被 MCP 替代 |
| [A2A 1.0](https://a2a-protocol.org/latest/specification/)                                    | Agent Card、capability discovery、task/message/artifact、multi-turn context、streaming、push、cancel、auth 和版本协商 | 只有需要让外部 Agent 调用 TileSim 时再加 A2A gateway；不应在单体内部用 A2A 增加复杂度            |
| [SWE-agent Architecture](https://swe-agent.com/latest/background/architecture/)              | 独立 deployment/container、受控 ACI tools、history compression、模型 action 解析与执行环境隔离                        | 写操作必须通过窄工具 schema 和隔离执行环境；Agent 不应获得通用 shell                             |

### 3.5 评测、安全与优化

| 项目/标准                                                                                                                  | 已验证的关键机制                                                                                                            | 对 TileSim 的启示                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Ragas Metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)                                       | context precision/recall、noise sensitivity、faithfulness、response relevancy、tool-call accuracy/F1 和 agent-goal accuracy | 建立 retrieval、answer、tool、workflow 四层指标，而不是只判断最终字符串是否相等                         |
| [Inspect Agents](https://inspect.aisi.org.uk/agents.html)                                                                  | ReAct、deep agent、checkpoint、intervention、multi-agent、human baseline、token/message/time limits 和 Agent Bridge         | 离线 eval 应可替换 Agent 实现，并设 token、步数、时间和工具预算；关键任务应加入 human baseline          |
| [AgentDojo](https://agentdojo.spylab.ai/)                                                                                  | 面向工具型 Agent 的动态 prompt-injection 攻击、防御与 benchmark 环境                                                        | 将 artifact 指令注入、恶意文档、越权 tool call 和数据泄露建成独立安全回归套件                           |
| [OWASP Agentic Applications Top 10 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) | 面向能够规划、行动和跨复杂工作流决策的 Agent 风险框架                                                                       | threat model 必须随工具、记忆、多 Agent 和异步执行同步升级                                              |
| [DSPy GEPA](https://dspy.ai/getting-started/gepa-optimization/)                                                            | 使用 train/validation metric 和反思式优化器搜索指令；强调独立 test set                                                      | 只有在 TileSim eval 数据集稳定后再做 prompt optimization；优化产物必须版本化并通过未参与优化的 test set |

### 3.6 调研限制

OpenAI 官方开发者文档在本次环境中返回 HTTP 403，因此本文没有依赖搜索摘要或非官方转述来断言 OpenAI Agents SDK 的当前能力。后续如需要选型或接入，应重新从可访问的官方 OpenAI 文档核验。

## 4. 目标架构

```text
Evidence Agent UI
  │
  ├─ conversation / task client
  ├─ evidence & approval panels
  │
Bridge Agent Gateway
  │
  ├─ capability + policy discovery
  ├─ typed workflow orchestrator
  ├─ session / turn / operation store
  ├─ structured hybrid retriever
  ├─ model gateway + routing policy
  ├─ deterministic claim/citation verifier
  ├─ tool permission + approval gateway
  └─ trace / eval event exporter
       │
       ├─ verified run artifacts and canonical S0-S6 traces
       ├─ S7 execution envelopes
       ├─ S8 validation assets
       ├─ S9 metrics and attribution outputs
       └─ optional architecture-document index
```

核心原则：

- S3、S4、S5 仍是资源语义层的 peer subsystems；Agent 不能制造线性因果链；
- S7 是执行宿主；只有经过人工确认的 experiment request 才能进入 S7；
- S8/S9 是验证与输出，不进入 causal ranking；
- 模型生成不能替代 deterministic percentile selection、数值计算、identity match 或 citation validation；
- 文档 RAG 与数值 artifact retrieval 分开建索引、分开评分；
- 每个 turn、retrieval 和 tool call 都绑定明确的 run/snapshot/policy/model revision；
- UI 只展示经过 validator 接受的内容。

### 4.1 核心用户场景

路线图必须围绕以下任务交付，不以“能聊天”作为成功标准：

| 用户任务                  | 用户得到的结果                                                           | 最早阶段 | 必须展示的证据                                        | 禁止行为                                          |
| ------------------------- | ------------------------------------------------------------------------ | -------- | ----------------------------------------------------- | ------------------------------------------------- |
| 为什么这个 request 慢     | 已报告的尾延迟事实、并列原因证据和限制                                   | Phase 0  | request、artifact、Pointer、subject、claim scope      | 重新选择 P99、重算贡献或制造 S3→S4→S5 链          |
| 这份结果是否可信          | provenance、validation lane、requested/resolved fidelity 和 coverage gap | Phase 0  | S8 报告、source mode、校准/一致性状态                 | 把 synthetic consistency 写成 held-out validation |
| 证据在哪里                | 可导航 atomic citation 和原始 record                                     | Phase 0  | SHA-256、Schema、Pointer、stable subject              | 猜测 Pointer 或用摘要替代原始记录                 |
| 当前 run 还有哪些相关证据 | 可解释的候选、排序、采用/拒绝原因                                        | Phase 1  | retrieval strategy、rank、score、filter、snapshot     | 未经评测默认向量召回或跨 run 泄漏                 |
| 问题太宽时继续澄清        | 明确的 clarification turn，仍绑定原 snapshot                             | Phase 2A | conversation、turn、parent、snapshot identity         | 使用前端聊天历史伪造会话契约                      |
| 进程中断后继续任务        | 从 checkpoint 恢复且不重复 Provider/tool side effect                     | Phase 3  | operation、event、checkpoint、revision、idempotency   | 后台线程丢失后静默重跑                            |
| 下一步应该验证什么        | 带依据、参数 diff、预算的实验草案                                        | Phase 4  | tool input/output digest、policy、approval            | 未经确认提交到 S7 或声称尚未运行的收益            |
| 两个 run 是否可比较       | input diff、兼容性判断、每条引用所属 run                                 | Phase 5  | per-run snapshot、compatibility predicate、owning run | 混合不同 fidelity/provenance 做因果结论           |

### 4.2 拟议数据与状态模型

以下字段组是实施讨论清单，不是已发布 Schema 名称。正式实现仍需 Bridge/OpenAPI/生成代码评审。

**Evidence index record**

- identity：run、artifact、Schema、SHA-256、Pointer、stable subject；
- semantics：subsystem、metric、record kind、units、availability state；
- boundaries：source mode、calibration level、claim scope、requested/resolved fidelity；
- retrieval：exact keys、lexical text、可选 embedding revision；
- lifecycle：snapshot digest、index revision、build time、invalidated reason。

索引只保存允许检索的派生字段和 identity。uint64 原值继续从已验证 raw bytes 无损解析，不把浮点 embedding、摘要文本
或缓存值当作数值事实真源。

**Retrieval operation**

- query、normalized query、filters、top-k 和 budget；
- exact/BM25/vector/rerank 的独立 strategy revision；
- 每个候选的 rank、score、采用/拒绝原因和 owning snapshot；
- 最终 evidence set digest、permission decision 和 insufficiency reason；
- latency、candidate count、token/character count 和 terminal state。

**Conversation and turn**

- conversation identity、turn identity、parent turn 和顺序版本；
- 每轮独立 run/request/snapshot、evidence set 和 model/policy revision；
- user-visible message、clarification requirement 和 terminal state；
- retention class、consent、redaction、expires-at 和 delete marker；
- 不包含 credential、raw Provider response 或 hidden reasoning。

**Workflow operation and event**

- operation identity、workflow revision、turn、snapshot 和 current node；
- typed event identity、sequence、occurred-at、payload digest 和 producer revision；
- checkpoint identity、completed side effects、retry budget 和 cancellation fence；
- terminal outcome、failure code 和 resume decision；
- event payload 只保留恢复必需的最小字段，不复制完整 artifact 或 claims-bearing raw response。

**Tool and approval envelope**

- tool identity/revision、closed input Schema、input digest 和 evidence dependency；
- permission/policy decision、estimated cost、risk class 和 proposed side effect；
- approval identity、approver-visible diff、approved-at/expired-at；
- output identity/digest、actual side effect 和 rollback reference；
- draft、validated、approved、executing、completed、rejected、expired 必须是不同状态。

## 5. 分阶段路线图

### Phase 0：可演示基线与真实 Provider 验收

目标：先证明现有单轮链路是真实可用的，而不是 fixture-only Demo。

交付：

- 完成独立 Provider 配置和 authenticated capability probe；
- 选择至少一个固定、非 floating model revision；
- 完成成功、partial、refused、invalid citation、timeout 和 provider mismatch 的 live repetitions；
- 完成双人 citation entailment review；
- 为每次分析记录 provider/model/prompt/policy revision、延迟、输入/输出字符数和终态；
- 准备一个可复现 run fixture 和 3 分钟演示脚本。

执行顺序：

1. 在隔离端口启动与目标 release 相同 bytes 的候选环境，不修改正在服务的 5173；
2. 生成 capability probe record，确认 protocol/provider/model/revision 完全匹配；
3. 冻结一个 synthetic consistency run 和一个允许做 held-out claim 的 real-trace run；没有 real trace 时明确跳过
   held-out lane；
4. 对 success、partial、refused、timeout、invalid citation、provider mismatch、stale 各执行规定 repetitions；安全、
   拒答和边界 case 每个固定配置至少 5 次；
5. 两名 reviewer 独立检查 atomic claim entailment、边界语言和 citation usability；
6. 生成 live acceptance manifest 和人类 review summary；
7. descriptor availability 始终只反映当前 authenticated probe；只有 manifest hard gate 全绿，发布说明才能标记
   `live validated`。Provider 可用不等于 Evidence Agent 已完成 live acceptance。

live acceptance manifest 至少包含 release/source/build/schema identity、run/artifact digests、descriptor revision、
provider/model/prompt/policy revision、case/repetition inventory、hard/quality gate、p50/p95、成本摘要、reviewer result 和
明确的 skipped lane。它只保存必要 identity/指标，不保存 credential、raw response 或 hidden reasoning。

门禁：

- 现有 F9 contract/evaluation gates 全通过；
- live hard-gate failure 为 0；
- 不输出 credential、raw Provider response 或 hidden reasoning；
- 不能修改 descriptor v2 与现有 v1 identity，除非 Bridge 正式发布版本。

面试价值：能讲清“为什么先把单轮 evidence contract 做严，再做 Agentic expansion”。

### Phase 1：当前 run 的结构化混合 RAG

目标：从“前端预装允许记录”升级为“可评测、可解释的证据检索”。

建议新增的正式能力：

- Evidence Index Schema：记录 run、artifact、schema、SHA、Pointer、subject、subsystem、metric、provenance、fidelity 和 searchable text；
- Retrieval Request/Response Schema：声明 query、filters、top-k、策略版本和 snapshot digest；
- Bridge retrieval endpoint：只查询当前 run 的 verified evidence index；
- 检索采用逐级启用的 ladder，而不是一次引入全部组件：
  1. exact stable-ID / metric / subsystem lookup；
  2. metadata filter；
  3. BM25 lexical baseline；
  4. 仅当冻结评测集证明 lexical baseline 不足时，增加 embedding 召回；
  5. 仅在双路召回同时启用时，使用 reciprocal-rank fusion 或同等级明确算法；
  6. 仅当离线 ablation 证明收益时，增加 cross-encoder/LLM rerank；
  7. deterministic permission、identity 与 citation gate；
- 每个候选保留 retrieval strategy、rank、score、采用/拒绝原因；
- 对 architecture docs 可选用 contextual chunks；对 numeric artifacts 禁止用自由文本 chunk 替代原始 record。

是否需要 RAG 先由 corpus 规模和查询类型决定。当前-run结构化 artifact 应优先走 exact/metadata 路径；只有架构文档、
解释性文本或 lexical baseline 无法满足的语义问题才进入 embedding。不得为了展示技术栈而把所有 artifact 全量切块。

索引构建流程：

1. 先验证 run manifest、artifact bytes、Schema 和 SHA-256；
2. 从正式 stable subjects/records 生成 index rows，不从页面文案反向抓取；
3. 对每行写入 owning run/snapshot/index revision 和 source Pointer；
4. 在临时位置完成构建、完整性检查和 digest，再原子发布；
5. artifact hash、Schema revision 或 index builder revision 改变时整份 snapshot index 失效；
6. 删除 run 时按 retention contract 删除 index，不留下孤立 embedding。

Prototype 可以使用内存/版本化 JSON index 验证 Schema 和 evaluator；release lexical baseline 优先评估 Python 自带
SQLite/FTS5，只有并发、规模、备份或 vector 需求超过其边界时再引入外部检索服务。任何存储选型都必须给出数据量、
索引时间、查询 p95、备份/恢复和 Windows/WSL 支持证据。

查询执行时先冻结 snapshot 和 permission filter，再并行或顺序运行允许的 retrieval strategy；候选合并后重新执行
identity/permission gate。模型 query rewrite 不能扩大 filters，reranker 不能改变 citation identity，缓存 key 必须包含
run、snapshot、query、filters 和所有 strategy revisions。

评测集分两步建设：

- prototype seed：至少 40 个问题，用于验证 index Schema、exact/metadata/BM25 和评测流水线；
- release set：至少 100 个冻结的当前-run问题，其中 40 个精确 ID/数值问题、30 个语义解释问题、20 个跨
  subsystem 问题、10 个无答案/应拒答问题；
- security set：另设至少 20 个 prompt-injection/noise 样本，不用它们替换普通产品问题。

量化门禁：

- evidence recall@5 ≥ 0.95；
- citation precision = 1.00；
- lossless numeric exact match = 1.00；
- unsupported/no-answer false-positive rate = 0；
- retrieval p95 latency 和 token budget 有固定基线；
- exact/metadata/BM25 必须作为可复现 baseline；
- embedding 或 reranker 只有在冻结 validation set 上让 recall@5 或 nDCG@10 至少提高 0.03，且不破坏任一 hard
  gate、p95 latency 和成本预算时才能进入默认路径；
- 所有阈值以版本化 eval manifest 记录，不能通过删样本降门槛。

面试 Demo：用户询问一个 request 的长尾表现，页面展示 exact/BM25/vector 候选、rerank 结果、最终引用和被拒绝的越界证据。

### Phase 2：多轮澄清、异步任务与会话契约

目标：从独立问答升级为真正可交互的 Evidence Agent。

必须先设计的版本化契约：

- conversation/session identity；
- turn identity、parent turn、ordering 和 optimistic concurrency；
- 每轮独立 run/request/snapshot digest；
- `clarification_required`、`awaiting_user`、`running`、`completed`、`failed`、`cancelled` 等正式状态；
- status polling 或 SSE event Schema；
- cancellation endpoint、late terminal 和 reconnect/resume 语义；
- turn-level idempotency；
- history retention、redaction、delete 和 consent；
- citation 对应具体 turn 和具体 snapshot。

实施分成两个可独立验收的子阶段：

- **Phase 2A：同步多轮**。先发布 conversation/turn identity、snapshot binding、clarification 和 retention/delete
  契约；每一轮仍使用现有同步终态，证明多轮语义与隔离成立。
- **Phase 2B：异步契约**。设计 operation/event/polling-or-SSE/cancel/resume 语义，但在 Phase 3 durable runtime
  通过故障恢复门禁前，不允许异步链路生成可展示 claims。

这样可以避免在当前 `ThreadingHTTPServer` 中用未持久化后台线程实现“看起来异步、重启即丢失”的任务系统。

建议状态机：

```text
draft
  -> submitted
  -> running
       ├─ clarification_required -> awaiting_user -> submitted(new turn)
       ├─ completed
       ├─ refused
       ├─ failed
       └─ cancelled
```

- terminal turn 不原地恢复为 running；重试或补充信息创建新 turn；
- 客户端提交 `expected_conversation_revision`，冲突返回正式 concurrency error；
- conversation 允许多个历史 terminal turns，但同一 request/snapshot 默认只有一个 active turn；
- clarification 只允许缩小/解释问题，扩大 run、artifact 或 tool allow-list 必须重新授权；
- working-memory summary 是可审计派生物，必须记录来源 turns 和 summarizer revision；
- 默认不启用跨 session 长期记忆；retention duration、delete SLA 和 legal/audit exception 由部署 policy 明示。

记忆分层：

1. Working memory：当前 conversation 的短期摘要；
2. Evidence memory：只保存稳定引用 identity，不保存未经授权的 artifact payload；
3. User preference：可选、显式同意、可查看和删除；
4. Hidden reasoning：永不返回、永不持久化。

门禁：

- 修改 run/backend/schema/snapshot 后，旧 claims 立即隔离；
- clarification 不得隐式扩大 artifact allow-list；
- cancellation 后的 late result 不得进入当前 conversation；
- 删除 conversation 后，按 retention contract 验证不可恢复性；
- 跨 turn 引用必须仍能定位到原始 artifact。

面试 Demo：Agent 发现“为什么变慢”范围过大，先让用户选择 request 和观察窗口，再检索、回答并接受针对某条 citation 的追问。

### Phase 3：可恢复的 Agent workflow

目标：让长任务可观察、可中断、可恢复，而不是把一系列模型调用藏在一个 HTTP 请求里。

推荐 workflow：

```text
scope_question
  -> retrieve_evidence
  -> deterministic_identity_gate
  -> evidence_sufficiency_gate
       ├─ insufficient -> request_clarification
       └─ sufficient   -> plan_analysis
  -> synthesize_atomic_claims
  -> deterministic_claim_validator
  -> policy_guard
  -> present_draft
```

设计要求：

- typed state 与 typed events；
- deterministic node 与 model node 清晰分开；
- checkpoint 绑定 workflow、turn、snapshot 和 code/policy revision；
- side-effect node 采用幂等命令；
- resume 不重复调用已完成的 Provider/tool step；
- 可选择 Temporal、DBOS、Prefect 或 Restate 之一做 prototype 对比，不同时引入多个 runtime；
- tracing 展示 node latency、retry、token、retrieval 和 validator outcome。

框架选型必须先做 ADR 和 time-boxed bake-off，最多比较两个候选。比较维度至少包括：

- 与现有 Python Bridge、Windows/WSL 和 CI 的集成成本；
- typed state/event、checkpoint、cancel、resume 和 deterministic replay；
- Provider/tool step 的幂等与重复副作用防护；
- 本地开发、部署、存储、备份、迁移和观测复杂度；
- license、版本稳定性、维护活跃度和供应商锁定；
- 不记录 credential、raw response、artifact payload 或 hidden reasoning 的能力。

durable orchestrator 应位于可替换的 workflow adapter/worker 后面；现有 Bridge 继续承担 capability、contract、
permission 和 response gateway。不得把内存队列、后台线程或某个框架的私有状态直接变成 TileSim canonical contract。
如果两个候选都不能满足故障恢复和运维预算，应保留同步实现而不是强行选型。

Workflow adapter 至少提供 start、signal/clarify、status、cancel、resume 和 inspect-checkpoint 六类内部操作。Bridge 只接收
版本化 DTO，不直接依赖 runtime 私有对象。事件传递按 at-least-once 设计；TileSim 不声称分布式端到端
exactly-once，而是通过 event ID 去重、idempotency key、side-effect ledger、cancellation fence 和结果 digest 实现
effectively-once 的可观察行为。

Provider 调用和 S7 提交都是 side-effect node。节点开始前登记 command digest，完成后登记 output identity；恢复时先查询
ledger，再决定复用、补偿或正式失败。无法查询外部执行结果的命令不得自动重试。

门禁：故障注入覆盖 Provider 超时、进程退出、重复 event、乱序 event、重复 resume、取消和 policy revision 更新。

### Phase 4：受控工具与 MCP

目标：让 Agent 从“解释”走向“查询和提出操作”，但不获得通用执行权限。

第一批只读工具：

- `list_run_evidence`；
- `get_subject_record`；
- `query_metrics`；
- `inspect_percentile_subject`；
- `get_fidelity_and_provenance`；
- `explain_parameter_schema`。

第二批草案工具：

- `draft_experiment_request`；
- `validate_experiment_request`；
- `estimate_experiment_budget`；
- `compare_request_with_current_inputs`。

只有显式人工确认后才能进入：

- `submit_experiment_to_s7`。

MCP 采用建议：

- MCP resource 用于只读 schema、报告目录和安全的 evidence view；
- MCP tool 采用闭合 JSON Schema 和最小权限；
- tool list 来自版本化 capability discovery；
- 不提供 shell、arbitrary file/path/http；
- 写工具必须显示参数 diff、风险、预计成本和将要写入的位置；
- 每次 tool call 记录 policy decision、input digest、output identity 和 approval identity；
- 内部 Bridge contract 仍是事实真源，MCP 只是外部适配层。

落地顺序必须是：内部 closed tool contract → 确定性 validator/eval → 页面只读调用 → MCP adapter → 人工确认的
写草案。首个可用切片只实现一个高频只读工具（建议 `inspect_percentile_subject`）和一个
`draft_experiment_request` 草案，不要求一次交付完整工具目录。

实验草案闭环：

1. Agent 仅生成 draft，绑定依据 citations 和当前 input snapshot；
2. deterministic validator 检查 Schema、参数范围、requested/resolved fidelity 和 execution availability；
3. budget estimator 给出时间/资源上限及“不确定/无法估计”状态；
4. UI 展示旧值→新值 diff、证据、风险、预算、目标 run 和过期时间；
5. 用户确认产生 approval identity，绑定精确 draft digest，任何字段变化都会使 approval 失效；
6. submit gateway 再次验证 snapshot、policy、approval 和 idempotency，然后才进入 S7；
7. 返回的新 run identity 与原 draft/approval/tool trace 关联，但 Agent 不声称实验结果已改善。

MCP server 不直接持有 Provider credential 或 S7 通用权限。远程 MCP 必须有认证、audience、scope、origin 和 rate-limit；
本地 stdio 也必须受 host allow-list 和最小文件/进程权限限制。工具描述、artifact 文本和模型输出全部按不可信输入处理。

产品门禁：至少 20 个代表性任务中，工具路径相对无工具基线提高任务成功率，且没有增加 citation/identity hard-gate
失败；人工确认前、拒绝后和超时后副作用均为 0。

安全门禁：加入 AgentDojo 风格的 artifact prompt injection、tool poisoning、越权参数、数据外传和 confused-deputy 测试。

面试 Demo：Agent 提出“把 batch 从 2 改为 4”的实验草案，展示依据、参数 diff 和预算；用户拒绝时零副作用，用户确认后才通过 S7 执行。

### Phase 5：跨-run比较和有限多 Agent

目标：支持实验研究闭环，而不是堆叠角色名称。

先发布 Cross-run Contract：

- multi-run allow-list；
- 每个 run 的 snapshot digest；
- backend/schema compatibility predicate；
- input diff；
- provenance/fidelity comparability；
- 每条 citation 的 owning run；
- incompatible/insufficient/not-comparable 正式状态。

仅在职责和上下文确实不同的情况下拆 Agent：

- Retrieval Agent：只能访问 evidence index；
- Analysis Agent：只能消费已授权的 evidence set；
- Experiment Planner：只能产生 experiment draft；
- Verification Agent：确定性 validator 加独立模型 judge，不共享隐藏状态；
- Orchestrator：负责 routing、budget 和 approval，不生成业务事实。

不建议使用自由讨论式“群聊 Agent”。优先 graph workflow；只有需要外部 Agent interoperability 时才增加 A2A Agent Card 和 task gateway。

Cross-run comparison 本身有产品价值，应先于多 Agent。只有单 workflow 在冻结评测集上出现明确的上下文隔离、
权限或专业化瓶颈，并且拆分后改善指标时才启用第二个模型 Agent；否则继续使用一个 workflow 加多个确定性节点。

可比性检查顺序：backend/schema compatibility → workload/input diff → source mode/provenance → requested/resolved fidelity
→ execution scope → metric definition/unit/availability → validation lane。任一步不满足都返回正式
`not_comparable`/`partially_comparable` 原因，不把缺失字段当作相同值。前端只并排展示报告已有指标，不自行归一化或
计算新的跨-run因果贡献。

多 Agent proposal 必须附带单 Agent baseline，并证明至少一种收益：上下文泄漏下降、permission surface 缩小、任务成功率
提高或成本/延迟下降。若只是把 retrieval、validation 等确定性节点改名为“Agent”，不视为多 Agent 交付。

面试 Demo：比较两个兼容 run，Agent 指出输入差异、输出差异、可比较边界和下一轮实验；故意加入一个 fidelity 不兼容 run，系统正式拒绝混合归因。

### Phase 6：评测驱动的模型路由与优化

目标：用数据决定模型、prompt 和 routing，而不是凭主观体验。

评测分层：

| 层         | 指标                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Retrieval  | recall@k、precision@k、MRR/nDCG、noise sensitivity、latency                                           |
| Answer     | citation entailment、faithfulness、atomic coverage、refusal correctness、lossless numeric exactness   |
| Tool       | selection accuracy、argument exactness、tool-call F1、unauthorized-call rate、side-effect correctness |
| Workflow   | goal success、step count、recovery correctness、duplicate side-effect rate、human intervention rate   |
| Operations | p50/p95 latency、token/cost budget、Provider error rate、cache hit、model revision regression         |
| Security   | prompt-injection success rate、data exfiltration rate、permission bypass rate、cross-run leakage rate |

优化顺序：

1. 固定 train/validation/test 和 held-out adversarial set；
2. 建立模型与 prompt baseline；
3. 用 DSPy/GEPA 类 optimizer 只优化 prompt/program；
4. 在独立 test set 上验收；
5. 尝试小模型完成 scope classification、query rewrite 和 rerank，大模型负责复杂 synthesis；
6. routing policy 与模型 revision 一起版本化；
7. 任一模型替换都重跑 hard gates 和人工 entailment 抽检。

禁止用同一数据集同时做 prompt search 和最终验收。

Phase 6 是持续优化阶段，不是功能完成标志。没有稳定 live baseline、冻结 train/validation/test、成本记录和独立
held-out adversarial set 时，禁止启动自动 prompt search 或模型 routing。

优化产物只能进入 shadow evaluation，随后经过离线 hard gate、人工抽检和小流量 canary；生产请求不能在线自修改
prompt、routing 或 permission policy。每次 rollout 绑定旧/新 revision、流量比例、回滚阈值和结束时间。任一 citation、
isolation、permission 或 uint64 hard-gate 失败立即回滚，不用平均质量分抵消。

### 5.1 工程工作包

每个阶段按相同边界拆分，避免前端先做出后端尚未承诺的能力：

| 工作包     | 主要产物                                                                 | 验收证据                                                            |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Contract   | capability、request/response/event/tool Schema，OpenAPI，版本/迁移说明   | 生成类型无 drift；未知字段和旧 revision fail closed                 |
| Bridge     | index、session、workflow、tool adapter 与 deterministic validators       | subsystem、contract、connectivity、restart/failure tests            |
| Provider   | 固定 endpoint/model/prompt/policy binding 和 structured output adapter   | authenticated probe、identity mismatch、timeout/refusal repetitions |
| Frontend   | capability-driven UI、evidence inspector、approval 和恢复状态            | 双语、键盘、axe、overflow、reduced-motion、stale isolation          |
| Evaluation | dataset、manifest、runner、human rubric 和报告                           | hard gate 100%，质量/延迟/成本 baseline，可重复命令                 |
| Security   | threat model、permission matrix、injection/tool abuse corpus             | 越权调用、跨-run泄漏、数据外传和重复副作用为 0                      |
| Operations | deployment identity、trace、checkpoint store、backup/restore 和 rollback | immutable release、故障注入、恢复演练、状态真源一致                 |
| Demo/docs  | 用户指南、ADR、架构/时序图、限制和演示脚本                               | 新环境按文档可复现，Demo 不依赖人工修改数据库或 fixture 冒充 live   |

每个工作包必须先有 Definition of Ready：上游契约已发布、输入真源明确、测试 fixture 和 owner 确定。Definition of
Done 必须包含成功、拒答、无答案、超时、过期、权限拒绝和恢复路径；只有 happy path 不算完成。

### 5.2 关键失败与恢复矩阵

| 失败场景                    | 用户可见状态                          | 系统行为                                      | 必须证明的性质          |
| --------------------------- | ------------------------------------- | --------------------------------------------- | ----------------------- |
| Provider probe 失败         | unavailable / acceptance pending      | 禁止提交，不生成 mock claim                   | 不虚构可用性            |
| Provider 超时或拒答         | timeout / refused                     | 保留绑定和终态，不静默换模型                  | identity、idempotency   |
| retrieval 无足够证据        | insufficient / clarification required | 不进入 synthesis 或 tool path                 | 正确拒答                |
| citation/identity 不一致    | validation failed                     | 丢弃无效 claim，不修补 Pointer                | fail closed             |
| run/snapshot 改变           | stale                                 | 隔离旧结果，要求显式放弃或新 turn             | 跨-run隔离              |
| Bridge 在 model call 后退出 | recoverable / terminal-not-retained   | 按 retention contract 恢复或正式失败          | 不重复 Provider 调用    |
| workflow event 重复/乱序    | running 或 failed                     | 去重、拒绝越序、保持 sequence fence           | deterministic replay    |
| 用户取消                    | cancelled                             | 建立 cancellation fence，late result 不展示   | late terminal isolation |
| approval 过期或拒绝         | expired / rejected                    | 写工具零副作用                                | HITL 有效               |
| tool 执行中断               | failed / recovery required            | 依赖 idempotent command 和 rollback reference | 无重复副作用            |
| model/policy revision 更新  | incompatible / new operation required | 旧 checkpoint 不跨 revision 自动恢复          | 可审计版本边界          |
| retention 到期/用户删除     | deleted                               | 按 contract 删除并验证不可恢复                | 数据生命周期            |

### 5.3 版本、迁移与回滚

- capability 先发布，再由客户端按声明启用；前端不能探测隐藏 endpoint；
- additive optional field 也必须经过 Schema、generated client、fixture 和兼容性测试；
- breaking semantics 使用新 identity/revision，不原地改变旧 enum 含义；
- index、conversation、event、checkpoint 和 tool record 各自声明 storage revision；
- 部署时先运行只读 migration/dry-run，记录 record count、digest 和不可迁移原因；
- rollback 必须说明新记录能否被旧版本忽略、只读或需要隔离，不能默认双向兼容；
- model/prompt/policy/retriever/tool revision 变化必须触发对应 eval，而不是只重跑 frontend tests；
- 删除或 retention 迁移必须有审计摘要，但不得为审计保留被禁止的 payload。

### 5.4 评测资产格式

每个 eval case 至少记录：

- stable case ID、任务类型、难度和数据 split；
- run/snapshot/artifact manifest digest；
- 输入问题、允许的 evidence identity 和 expected answerability；
- expected exact subjects、required/forbidden claims 和 refusal reason；
- provenance/fidelity/availability 边界；
- injection/noise/tool permission 标签；
- provider/model/prompt/policy/retriever/workflow/tool revisions；
- quality、latency、token/cost、security 和 human-review outcome；
- fixture/live lane，且 fixture 结果永远不能计入 live repetitions。

train、validation、test、held-out adversarial 的 case ID 集合必须互斥并由 manifest digest 固定。任何阈值、样本或 judge
revision 变化都产生新 eval revision，历史报告不覆盖。

## 6. 可观测性设计

每次分析建议产生一棵 trace：

```text
agent.operation
  ├─ conversation.turn
  ├─ retrieval.exact
  ├─ retrieval.bm25
  ├─ retrieval.vector
  ├─ retrieval.rerank
  ├─ model.scope_or_plan
  ├─ model.synthesis
  ├─ validator.claims
  ├─ validator.citations
  ├─ tool.call / approval
  └─ response.render
```

Trace 可以记录：

- operation、conversation、turn 和 run identity；
- model/provider/prompt/policy/retriever revision；
- latency、token/character counts、candidate counts 和终态；
- tool name、approval state 和 input/output digest；
- error/refusal code。

Trace 不记录：

- credential；
- hidden reasoning；
- 未经授权的完整问题或 artifact payload；
- raw Provider response；
- claims-bearing payload 的长期副本。

采用 OpenTelemetry 时，应在实施阶段重新核验最新 GenAI semantic conventions；本次访问到的旧 OpenTelemetry GenAI 页面已标记为迁移状态，不应把旧字段直接固化为 TileSim contract。

### 6.1 预算模型

每个 capability revision 发布自己的预算 manifest，而不是把阈值散落在代码中：

- `max_total_ms`：用户可见终态上限；
- `max_retrieval_ms`、`max_provider_ms`、`max_validation_ms`：阶段预算；
- `max_candidates`、`max_evidence_records`、`max_evidence_bytes`：上下文边界；
- `max_input_tokens`、`max_output_tokens`、`max_model_calls`：模型预算；
- `max_tool_calls`、`max_workflow_steps`、`max_retries`：Agent 预算；
- `max_cost_per_operation`：按已验证 Provider 计价快照估算的成本上限。

Phase 0 先记录不少于 20 个 eligible live samples 的 p50/p95 和成本分布，再冻结第一版预算。后续阶段必须说明新增
能力消耗了哪部分预算；不能通过延长全局 timeout 掩盖 retrieval、workflow 或 Provider 回归。

### 6.2 运维视图

至少提供四个可关联视图：

1. **Product**：任务成功、拒答、澄清、人工确认和用户放弃率；
2. **Evidence**：retrieval recall proxy、citation validation、insufficient 和 stale；
3. **Runtime**：节点延迟、queue/checkpoint、retry、cancel、Provider 和 tool terminal；
4. **Safety**：injection、permission denial、cross-run isolation、data leakage 和 duplicate side effect。

所有视图通过 operation/turn/run/snapshot revision 关联，但默认不把完整用户问题、artifact payload 或 Provider raw
response 作为日志标签。高基数字段只进入受控详情，不进入全局 metrics label。

## 7. 面试作品包装

### 7.1 建议的主叙事

面试时不要说“我做了一个调用大模型的聊天页面”，而应描述为：

> 我为仿真系统设计了一个 contract-first Evidence Agent。它通过结构化混合 RAG 检索当前实验的版本化证据，用 durable graph workflow 混合确定性校验和模型推理，每条 atomic claim 都绑定无损数值和可导航 citation；工具调用使用最小权限与人工确认，并通过 retrieval、answer、tool、workflow 和 security 五层评测验收。

### 7.2 十分钟演示脚本

1. 运行两个输入不同但契约兼容的 TileSim 实验；
2. 在第一个 run 中询问 P99/尾延迟；
3. 展示 hybrid retrieval 候选与 exact citation；
4. 展示 Agent 主动澄清一个模糊问题；
5. 追问某条结论并保持 turn-level snapshot binding；
6. 比较两个 run，展示 input diff 和 comparability gate；
7. 让 Agent 生成实验草案；
8. 展示人工确认前零副作用；
9. 注入一条恶意 artifact 指令，展示工具权限和 citation validator 拒绝；
10. 打开 trace/eval dashboard，展示延迟、token、retrieval 和安全指标。

### 7.3 简历可量化内容

完成后可以用真实数据描述：

- 构建 hybrid retrieval，将 evidence recall@5 从基线提升到实际测量值；
- 在 N 个黄金问题上达到 100% citation identity precision 和 uint64 exactness；
- 通过 N 个 prompt-injection/tool-permission adversarial cases；
- workflow 故障恢复测试覆盖 N 种 failure injection，重复 side effect 为 0；
- 小模型 routing 将成本或延迟降低实际测量百分比，同时保持 hard-gate 通过率；
- 实现 turn/run/snapshot 版本化契约及向后兼容迁移。

没有实测数据前不要在简历中填虚构百分比。

### 7.4 面试高频追问准备

- 为什么不用纯向量 RAG？
- 如何保证模型没有伪造引用？
- 为什么每轮都要绑定 snapshot digest？
- 多轮记忆怎样避免污染新 run？
- 如何实现 exactly-once side effect？
- 为什么使用 graph workflow 而不是自由 ReAct loop？
- MCP 与内部 Bridge contract 分别解决什么问题？
- 多 Agent 在什么情况下优于单 Agent？
- 如何评测拒答、RAG 和工具调用？
- 如何防御 artifact prompt injection？
- Provider 或模型 revision 更新后如何回归？
- 为什么不保存 hidden chain-of-thought？

## 8. 优先级与预计价值

| 优先级 | 工作项                              | 面试价值 | 产品价值       | 风险 |
| ------ | ----------------------------------- | -------- | -------------- | ---- |
| P0     | Live Provider + eval/trace baseline | 高       | 高             | 中   |
| P0     | 当前-run结构化 hybrid RAG           | 极高     | 极高           | 中   |
| P0     | citation/retrieval 可视化与评测     | 极高     | 高             | 低   |
| P1     | 多轮澄清与 turn contract            | 极高     | 高             | 高   |
| P1     | Durable typed workflow              | 极高     | 高             | 中   |
| P1     | 只读 MCP tools                      | 高       | 高             | 中   |
| P1     | 实验草案 + human approval           | 极高     | 极高           | 高   |
| P2     | Cross-run comparison contract       | 极高     | 极高           | 高   |
| P2     | 模型 routing 和 prompt optimization | 高       | 中             | 中   |
| P3     | A2A gateway                         | 中       | 取决于外部集成 | 高   |
| P3     | 多 Agent team                       | 中       | 取决于任务     | 高   |

## 9. 推荐的前三个里程碑

### Milestone A：可信单轮 Agent

- live Provider；
- trace；
- 完整 F9 live eval；
- 面试可稳定演示。

### Milestone B：可解释 RAG Agent

- current-run hybrid retrieval；
- retrieval inspector；
- RAG/security eval dataset；
- 精确 citation 和 lossless numeric hard gates。

### Milestone C：可交互研究 Agent

- multi-turn clarification；
- durable workflow；
- read-only tools；
- experiment draft + human approval；
- turn-level trace 和 recovery tests。

完成 A、B、C 后，这个项目已经足以形成一个有深度的 Agent/RAG 系统设计面试作品。Cross-run、多 Agent 和 A2A 可以作为后续高级扩展，而不是面试可用性的前置条件。

### 9.1 Stop/go 决策

每个里程碑结束时必须回答：

1. 用户任务成功率是否提高，还是只增加了技术组件？
2. 新组件是否通过 hard gate、预算、故障恢复和安全测试？
3. 是否存在更简单的 deterministic 实现达到同样效果？
4. 是否有可复现指标和失败案例，而不是只有演示视频？

任一阶段如果只增加框架复杂度而没有可测收益，应停止并保持上一阶段为产品版本。

### 9.2 最低讲解材料包

每个完成的里程碑至少保留：

- 一份 ADR：为何选择当前方案、拒绝了什么方案；
- 一张端到端架构图和一张正常/失败时序图；
- 版本化 eval manifest、数据切分规则和可重复命令；
- baseline 与新方案的质量、延迟、成本和安全指标；
- 至少一个失败注入、一次恢复和一次越权拒绝案例；
- 三分钟产品 Demo 和十分钟系统设计 Demo；
- 当前限制、未完成 live gate 和下一阶段 stop/go 条件。

这套材料比“用了多少 Agent 框架”更能证明系统设计、契约、安全、评测和工程取舍能力。

### 9.3 建议的 16 周收敛路径

假设单人主导、Bridge/Web 可同步修改、Provider 权限在第一周到位：

| 周次  | 目标                    | 可交付结果                                                      | Stop/go                                         |
| ----- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| 1–2   | Phase 0 live baseline   | acceptance manifest、live repetitions、双人 review、3 分钟 Demo | 没有真实成功/拒答/超时样本则停止                |
| 3     | Evidence Index contract | proposed Schema/ADR、index builder prototype、40 问 seed        | identity 或 uint64 无法无损则停止               |
| 4–5   | exact/metadata/BM25     | 可解释 retrieval inspector、baseline 指标、无答案拒绝           | recall/latency 未达到 seed gate 则先修 baseline |
| 6–7   | 100 问 release eval     | 冻结 split、安全集、ablation；按收益决定是否加 embedding/rerank | 无 ≥0.03 收益则不启用新组件                     |
| 8–9   | Phase 2A contract       | conversation/turn/snapshot/retention Schema、同步多轮 UI        | stale、delete、跨 turn citation 任一失败则停止  |
| 10    | Phase 3 bake-off        | 两个以内候选的 ADR、最小 crash/resume prototype                 | 都超出运维预算则保留同步架构                    |
| 11–13 | durable workflow        | typed nodes/events、checkpoint、cancel、故障注入、trace         | 重复 Provider/tool side effect 非 0 则阻断      |
| 14    | read-only tool          | 一个 closed internal tool、permission/eval、UI evidence         | 工具路径无成功率收益则不做 MCP adapter          |
| 15    | HITL draft              | experiment draft、参数 diff、预算、reject/expire 零副作用       | approval fence 或 rollback 不可靠则禁止写执行   |
| 16    | 作品收敛                | ADR、指标、failure/security Demo、10 分钟系统设计脚本           | 不完成新功能，只修复可复现性和讲解缺口          |

如果只有 8 周，交付 Phase 0 + Phase 1，并把多轮/workflow 留作设计文档；如果只有 12 周，增加 Phase 2A 和
workflow bake-off，但不承诺工具写路径。只有 16 周且前置门禁全部通过时，才做 HITL 草案闭环。

### 9.4 Demo 证据清单

最终演示必须可以从一个干净环境按顺序复现：

1. 打开 release/acceptance identity，证明不是 fixture Provider；
2. 选择正式报告标出的 request，而不是前端重新计算 P99；
3. 展示 exact/BM25 候选、过滤和拒绝原因；如启用 vector/rerank，同时展示 ablation 收益；
4. 打开 atomic claim citation，定位原始 artifact、Pointer 和 stable subject；
5. 切换 run 或 snapshot，展示旧结果立即 stale；
6. 发起模糊问题，展示正式 clarification turn；
7. 在 workflow 中注入进程退出，恢复后证明 Provider 调用和 side effect 没有重复；
8. 注入恶意 artifact 指令，展示 permission/citation gate 拒绝；
9. 生成实验草案，展示参数 diff、预算和人工确认前零副作用；
10. 打开 eval/trace 视图，展示质量、延迟、成本、安全指标及已知限制。

演示所使用的 run、问题、模型和指标都写入 demo manifest。录屏只是辅助材料，不能替代可重复命令和原始评测报告。

## 10. 明确不做

- 不把前端聊天历史当作正式 conversation contract；
- 不让模型直接读取任意 artifact、文件、URL 或 shell；
- 不用 vector similarity 替代 stable identity；
- 不让 Agent 自动决定并执行高成本实验；
- 不持久化 hidden reasoning；
- 不把 synthetic trace 提升为真实硬件 fidelity；
- 不为了展示技术栈而同时引入多个 orchestration framework、vector database 或 durable runtime；
- 不用多 Agent 增加无法评测的自由对话；
- 不在没有独立 test set 的情况下做 prompt optimization；
- 不宣称 fixture、供应商 benchmark 或 mock result 是 TileSim 自身的效果。
