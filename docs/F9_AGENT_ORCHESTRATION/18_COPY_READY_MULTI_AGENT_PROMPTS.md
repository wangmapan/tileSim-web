# Phase 0–7 可直接复制的多 Agent 提示词包

> 文档 ID：`AO-18`
>
> 类型：开发任务提示词包
>
> 使用方式：每次只复制一个阶段的完整代码块，交给该阶段主 Agent
>
> 前置阅读：[开发者指导 AI 实施手册](17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md)、[模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)

## 1. 使用规则

- 每个提示词默认使用四个并发槽位：主 Agent 兼集成负责人，另建三个子 Agent。
- 提示词不需要再拼接公共安全段；每个代码块都可以独立复制。
- 每次只启动一个 Phase。阶段验收和 Gap 更新完成后再启动下一阶段。
- 主 Agent 必须先核对当前 commit、工作树、runtime descriptor 和文件 owner，不能把本文日期当作当前运行事实。
- 如果环境不支持子 Agent，则把提示词中的三个子任务分别开成三个独立任务，并保留一个单独的集成任务。

## 2. Phase 0：能力目录与 Profile 真源

```text
你是 TileSim“基于 Agent 的仿真编排模块”Phase 0 主 Agent兼集成负责人。请使用总计四个并发槽位：你负责总控和集成，并创建三个子 Agent。

阶段目标：建立正式、版本化、可审计的参数 capability catalog 和 model、engine、device、topology、workload 五类最小 Profile；形成“用户术语 -> stable field_id -> 正式 request Pointer -> 后端 lowering -> 状态/事件 -> artifact evidence -> execution test”的追踪矩阵。本阶段不实现聊天、右侧栏、Provider 调用或 run 写操作。

开始前你和所有子 Agent完整阅读：
1. D:\tileSim-web\AGENTS.md
2. D:\tileSim-web\docs\AI_HANDOFF.md
3. D:\tileSim\AGENTS.md
4. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\README.md
5. 00_GUARDRAILS_AND_GLOSSARY.md
6. 01_CURRENT_BASELINE_AND_GAPS.md
7. 03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md
8. 04_CAPABILITY_AND_PROFILE_CATALOG.md
9. 11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md
10. 14_CONTRACT_GAP_REGISTER.md
11. 15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md
12. 17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md
13. 当前工作涉及的后端 registries、CLI、contracts、reports、tests 和 Web generated contracts。

先对 D:\tileSim-web 和 D:\tileSim 执行 git status --short、git rev-parse HEAD、git worktree list，记录而不修改。保护所有未提交改动；不得 reset、clean、覆盖、擅自 commit/push。不得读取或输出 TILESIM_EVIDENCE_AGENT_*；不得执行 live Provider acceptance；不得停止、重启或部署 127.0.0.1:5173。后端验证遵守 Linux-first，Web/Bridge 使用 fixture 或临时端口。

创建三个子 Agent，并为它们分配互不重叠的 worktree 和独占文件范围：

1. phase0_contract_catalog：设计 parameter descriptor、capability snapshot、五类 Profile Schema proposal、status/reason codes、revision/digest 和兼容策略；增加 schema-local fixtures 和 Python/TypeScript canonical vectors。不得修改 UI、正式 Schema 根索引、manifest 或 generated clients；这些共享文件由你单槽集成。不得从“Schema 中有字段”推断 executed。

2. phase0_backend_traceability：只读审计当前字段的 described/accepted/validated/lowered/executed/observable/calibrated/held-out 状态，并在后端模块局部范围补 execution/adjacent tests。不得为让字段变成可用而临时接线，不得把历史测试当真实校准，不得修改 Contract Agent 文件或 Web。

3. phase0_eval_security：独立建立 unknown field/profile、ambiguous alias、expired/revoked revision、missing source、calibration self-claim、uint64/单位、组合冲突和 drift fixtures/oracles。不得修改业务实现或测试 oracle 来迁就实现。

你负责：发布文件 ownership table；审核事实矩阵；冻结 contract proposal；独占 OpenAPI/Schema 根、generated files、manifest、README、当前基线和 Gap Register；按 contract -> registry/adapter -> fixture/test -> generated client（只有正式批准后）-> docs 顺序集成。

实施批次：
- Batch 0：只读审计、commit/descriptor、所有权和现状矩阵。
- Batch 1：Schema proposal、reason codes、Profile 最小字段、canonical vectors。
- Batch 2：最小 registry/projection；未批准正式 contract 时停在 proposal/fixture。
- Batch 3：module-local、adjacent、execution evidence、drift/security tests。
- Batch 4：集成、格式、依赖和文档状态。

必须保持：Evidence Agent descriptor 为 tilesim.bridge.evidence_agent_descriptor.v2，request/response/citation/snapshot 保持 v1；current create-run identity 不变，除非 Bridge 正式发布 successor；Trace source、GPU participation、requested/resolved fidelity 分开；uint64 无损；未 executed 字段不得 agent_exposed、进入候选或 ranking。

调试顺序：Schema/runtime validator -> canonical vectors -> registry unit -> adjacent request/lowering -> execution evidence -> drift/negative -> dependency/type/lint/format。

验收：每个 agent_exposed 字段有 execution evidence；五类 Profile 有 ID/revision/source/valid regime；unknown/expired/profile-missing/calibration self-claim fail closed；runtime descriptor 与文档冲突时 runtime fail closed；只按正式证据更新 GAP-CAP-001 和 GAP-PROFILE-001。

停止条件：contract 无法表达；字段无真实 lowering/execution；Profile 无 owner/source；涉及私有主设计决策；需要部署 5173、读取 credential 或执行 live Provider。停止时登记 Gap，禁止前端或 fixture 模拟。

每个子 Agent最终报告：职责边界、worktree/branch、changed files、输入/输出 contract、测试命令和结果、未运行测试、security/provenance、remaining gaps、是否触碰共享文件/5173/credential/live Provider、建议合并顺序。

你最终运行阶段相关测试和仓库完整门禁。共享工作树仍有其他写入时，等待全部完成再跑全仓门禁。最终报告列出职责边界、五类 Profile、identity 变化、execution evidence、Gap、全部测试、live/calibration/held-out 状态，并明确未部署 5173。
```

## 3. Phase 1：右侧只读对话栏与当前参数草案

```text
你是 TileSim“基于 Agent 的仿真编排模块”Phase 1 主 Agent兼集成负责人。使用四个并发槽位：你负责总控/共享集成，创建三个子 Agent。

目标：实现电脑网页端跨页面右侧 Agent 对话栏的只读 Shell，并将用户自然语言编译为当前正式 create-run 参数子集的 typed experiment draft、字段来源、diff 和 deterministic validation。本阶段 create-run 调用必须为 0；不模拟正式多轮持久化；不扩写模型、卡数、TP/PP/EP 等未闭合能力。

全员完整阅读 D:\tileSim-web\AGENTS.md、docs\AI_HANDOFF.md、D:\tileSim\AGENTS.md，AO 文档 README、00、01、02、04、05、06、07、11、14、15、16、17，以及当前 run-experiment request builder/descriptor/tests、Evidence Agent feature/store/API/adapter/contracts/tests、App Shell/router/workspace-run 公共接口。

先只读检查两个仓库的 status/HEAD/worktrees 和 runtime descriptor。保护未提交改动；不 reset/clean/覆盖/commit/push；不读取 Provider secret；不做 live Provider；不操作 5173。保留现有 data-help-anchor，不改 guided-help catalog/i18n；App Shell、router、全局 CSS/i18n/store、generated client 和 shared E2E 由你单槽维护。

创建三个子 Agent并分配独立 worktree：

1. phase1_intent_compiler：独占新 intent-compiler/domain-adapter 目录及单元测试。输入冻结 capability projection 和 redacted turn；输出 task route、typed slots、单位归一、draft patch 或最多 1–3 个 blocking questions。不得输出 digest/key/approval/tool call，不得调用 Provider/create-run/store，不得用 LLM 心算单位和数值。覆盖中英混合、否定/修改/范围、100G、8k token、unknown/unsupported、uint64 和 Schema breakout。

2. phase1_copilot_web：独占 agent-copilot-shell、agent-context entities、typed blocks、模块样式和 component tests。实现 closed/collapsed/open/expanded、resize、Context Bar、Timeline、Composer、lazy load、error isolation；只用 fixture 展示 explanation/capability/draft/validation/error。提供 AgentContextProvider/Registry 公共接口，但不修改业务页面、不抓 DOM、不访问 feature 内部 store。

3. phase1_draft_eval：独占 current-subset draft/value-source/view model fixtures、至少 100 条双语意图、canonical request equivalence oracle、component/E2E 专用测试。覆盖 missing/zero/null/not applicable、units/Pointer、Context stale、DOM/键盘/焦点。不得修改 compiler/Web 实现，失败时提供 case ID 和最小复现。

你先冻结 Page Context Envelope、typed blocks、draft view model 和 current-field fixture，再让三线并行。按 compiler/draft -> shell -> App Shell lazy integration -> shared E2E 顺序集成。侧栏 Shell 不得拥有业务状态；每个页面以后通过独立 context adapter 接入。

必须保持 Evidence Agent v2/v1 family、canonical request builder、idempotency/stale/两类 409/502/503/504、citation、uint64 和 provenance。侧栏不能创建 key、调用 Provider、创建 run、重新构建 payload或持久化完整问题/claims。

调试：compiler unit -> draft runtime validation -> 与手工表单 canonical equivalence -> shell component -> context registry -> keyboard/focus/IME/zoom/reduced-motion -> fixture E2E -> dependency/type/lint/format/build。

验收：current formal subset request equivalence=1.00；unknown/unsupported 接受=0；单位/Pointer/uint64=1.00；打开/关闭/切路由不清除 run、表单或 query；无 DOM scraping/feature-internal import；Provider/create-run 调用均为 0；用户能看出当前能力、附加上下文和“草案不是运行”。

停止条件：需要 conversation persistence、approval、写工具、模型/卡数/并行、跨 run 或 SSE/cancel 时更新对应 Gap，不在浏览器模拟。

各 Agent按 AO-17 第 23 节交接。你最终运行完整 Web/Bridge 门禁和 git diff --check，报告 changed files、identity、DOM/键盘、无副作用、未完成 Gap，并明确未部署 5173、未执行 live Provider。
```

## 4. Phase 2：模型、设备、并行和确定性计算器

```text
你是 TileSim Agent 编排 Phase 2 主 Agent兼集成负责人，使用你自己加三个子 Agent。只有 Phase 0 capability/profile 正式发布，且工作负载到六类 Trace、TP/PP/EP、KV、集合通信、网络和请求指标累计链满足 DoR 才实施；否则只做审计并将阶段标为 blocked。

全员完整阅读两个 AGENTS.md、Web AI_HANDOFF、AO README、00、01、03、04、05、06、07、10、11、12、14、15、17，以及后端工作负载描述语言、三个引擎语义 Profile、执行片段、KV Cache、设备性能、集合通信、网络、Trace-package/create-run 和累计链测试。

先检查两个仓库 status/HEAD/worktrees 和 runtime contracts。保护未提交改动；不操作 5173、credential/live Provider；不 commit/push；后端 Linux-first。逐项证明 Profile 有 revision/source、目标字段真实 lowered/executed、provenance 正式、create-run successor 或 workload intake 已发布。缺失时停止相应能力。

三个子 Agent：
1. phase2_profile_data：独占 Profile registry/schema-local fixtures；负责五类 Profile 的 identity/source/valid regime、observed/inferred/modelled、calibration status。禁止从产品名猜结构或性能。
2. phase2_calculators：独占 deterministic calculators/tests；负责 weights/memory、KV、TP/PP/EP、placement、network、request/SLO/budget。输出必须有 input refs、unit、algorithm revision、uncertainty/unknown；禁止调用 LLM。
3. phase2_lowering_chain：独占 draft lowering、adjacent conversion 和 cumulative-chain tests；证明字段进入拥有者模块、执行片段、资源语义、网络和请求指标，禁止只做 JSON 接受测试。

第一批完成后，用空闲槽位启动 phase2_web_eval，独占高级 draft/validation receipt 组件和 fixtures/tests；只展示服务端 receipt，不复制公式，不改 App Shell/global store。

你独占 contract roots/generated types/manifest/shared integration/docs。跨 Agent只传 immutable Profile snapshot、Validation Report 和 compiled request fixtures。

调试：Profile schema/source/expiry -> calculator golden/property/overflow -> model×engine×device×topology×workload 组合 -> adjacent lowering -> 累计链 -> fidelity/provenance/GPU mode -> Web receipt/E2E。

验收：不可行配置 false accept=0；unknown 不变默认；uint64 无损；卡数/并行建议是确定性候选；synthetic 不升级；无真实校准时不输出部署保证；所有 exposed 字段有累计执行证据。

停止条件：Profile/data/calibration/lowering 缺失；字段只存 identity 不影响执行；SLO 无 metric/window/scope；基础链未闭合却要求全模块设计空间。更新对应 MODEL/DEVICE/ENGINE/PARALLEL/KV/WORKLOAD/NETWORK/SLO/CALIBRATION Gap，不模拟。

运行模块、相邻层、连通性、累计链、Web/Bridge 和全仓门禁。报告每个 Profile/calculator/执行路径、真实校准/held-out 状态和未关闭 Gap；明确未部署 5173。
```

## 5. Phase 3：正式多轮、草案版本与审批

```text
你是 TileSim Agent 编排 Phase 3 主 Agent兼集成负责人，使用一个主 Agent加三个子 Agent。目标是发布正式 Conversation/Turn/Goal、immutable Draft revision 和 Approval contract，使右侧栏支持可恢复多轮澄清与精确审批；本阶段不创建 run，除非项目负责人另行明确扩大范围。

全员完整阅读公共必读文档和 AO 00、02、03、05、06、08、10、11、14、15、16、17，以及认证、workspace/session、Evidence lease/store 和 Web server-state 代码。先检查工作树/HEAD/worktrees。保护改动；不操作 5173/credential/live Provider；不持久化 hidden reasoning、raw Provider response、完整 artifact 或额外 claims；Evidence v2/v1 不变。

子 Agent：
1. phase3_conversation_draft：独占 Conversation/Turn/Goal、turn ordering、Draft revisions/patch/source、repository ports/tests；实现 expected revision conflict、immutable revision、delete vs null、goal/draft stale；不负责 UI/approval/Provider。
2. phase3_approval_retention：独占 approval principal/scope/digests/expiry/revoke/consume/stale、retention consent/expiry/delete/redaction tests；批准绑定 exact draft/validation/compiled request/revisions，绝不调用 create-run。
3. phase3_web_conversation_eval：独占 timeline/composer/clarification/approval blocks、cross-route fixtures、keyboard/focus/concurrency E2E和 adversarial cases；不得用 localStorage 消息数组冒充正式 store。

你独占 OpenAPI/Schema roots/generated clients、Bridge API coordination、App Shell/shared integration/docs。先冻结 object identity、status/error、retention 和 stale semantics，再并行。

集成顺序：Schema/fixtures -> conversation/draft state machines -> approval/retention -> Bridge endpoints/repository -> generated client -> Web -> concurrency/security E2E。

调试：合法/非法 transition；turn sequence；双窗口 revision conflict；out-of-order response；goal/draft/profile/policy drift；approval mismatch/expiry/revoke；retention opt-in/out/delete/export；跨 workspace/run；刷新/路由连续性。

验收：参数变化后旧 approval 成功=0；跨 conversation/workspace 泄漏=0；无 consent 时不承诺 transcript 恢复；credential/raw response/hidden reasoning 持久化=0；每轮最多 1–3 个 blocking questions；聊天文本不成为执行真源。

停止条件：认证/retention owner 不明确；Schema 无法表达并发/stale；想复用 Evidence request 表达 turn history；批准仅在客户端；需要 create-run 才能完成。更新 CONV/CLARIFY/DRAFT/APPROVAL/MEMORY Gap。

按 AO-17 交接并运行 contract/repository/component/concurrency/redaction/security 和全仓门禁。报告正式 identity、迁移策略、Gap 和未部署 5173。
```

## 6. Phase 4：可恢复执行、进度与取消

```text
你是 TileSim Agent 编排 Phase 4 主 Agent兼集成负责人。使用一个主 Agent加三个子 Agent。目标是将 approved immutable request 通过唯一正式入口创建 run，并用 Operation/Event/Checkpoint 实现进度、崩溃恢复、断线续接和正式取消。禁止绕过 Bridge/create-run，禁止浏览器内存冒充 durable workflow。

全员阅读公共必读及 AO 03、05、08、10、11、14、15、16、17；读取 create-run idempotency、run repository、SSE/poll、execution recovery、Evidence lease/409 tests 和 Bridge failure-injection ports。检查两个仓库 status/HEAD/worktrees。保护改动；不操作 5173/credential/live Provider；不自动换 key；不 commit/push。

子 Agent：
1. phase4_workflow_runtime：独占 Operation/Event/Checkpoint state machine、node contracts、repository 和 fake-tool tests。节点声明 typed I/O、effect、retry、timeout、checkpoint、cancel、redaction；不实现 create-run transport。
2. phase4_run_adapter_stream：独占 approved request -> create-run adapter、idempotency/commit record/outbox/query、operation snapshot/event sequence和临时端口 tests。same key/same payload 精确 replay；same key/different payload conflict；transport unknown 先查询，不能换 key。
3. phase4_chaos_web：独占 crash matrix、progress/recovery/cancel blocks、SSE reconnect/gap/duplicate/out-of-order fixtures和 E2E；不得修改实现迁就 oracle。

你独占 shared contracts/generated clients/API routing/App Shell/docs。先冻结 operation states、error codes、commit boundaries 和 cancel fence。

每个副作用节点测试：调用前崩溃；外部提交后本地记录前；记录后 event 前；重复 event；服务重启；客户端重连。再测 approval stale/expired、budget、502/503/504、cancel requested/ack/unsupported/pending 和 late terminal。

验收：approval 前 create-run=0；一个 operation observable run side effect=1；crash/retry 不重复 Provider/run；断流不等于失败；后端未确认时不显示已取消；late result 不越过 fence；两类 409 不混淆。

停止条件：入口无可查询 identity/idempotency；approval 无服务端验证；checkpoint 需保存敏感 payload；后端无 cancel contract 却要求 UI 宣称取消。更新 WORKFLOW/CANCEL/TOOLS Gap。

运行 state machine、repository、Bridge 临时端口、chaos、SSE/component/E2E、安全/redaction和全仓门禁。报告 crash points、side-effect count、cancel semantics 和未部署 5173。
```

## 7. Phase 5：分域 RAG、Evidence 与记忆

```text
你是 TileSim Agent 编排 Phase 5 主 Agent兼集成负责人，使用一个主 Agent和三个子 Agent。目标是实现参数/Profile、当前运行证据、公开文档、历史运行四类独立索引和 Evidence Bundle，使右侧栏准确解释配置和结果。RAG 不替代 capability resolver、calculator、artifact validator、comparability 或 citation gate。

全员阅读公共必读、F9 contract audit/evaluation spec、AO 04、05、09、10、11、14、15、16、17，以及 artifact manifest/raw bytes/SHA、Evidence validators、retention 和 query keys。检查工作树/HEAD。保护改动；不读取 credential或执行 live Provider；不操作 5173；不复制完整 artifact/claims；embedding store 不是真源；uint64 无损。

子 Agent第一批：
1. phase5_ingestion_index：独占 source allow-list、bytes/schema/SHA/run binding、redaction、deterministic chunk IDs、四类 index adapters和 rebuild tests；坏 source 不进入部分索引。
2. phase5_retrieval_bundle：独占 exact -> metadata -> BM25 baseline、query planning、ACL/scope、Evidence Bundle/coverage/contradiction/no-answer；embedding/reranker 只能 feature-flagged，不改变 baseline。
3. phase5_evidence_security_eval：独占 atomic claim/citation tests、retrieval dataset、injection/ACL/delete/adversarial 和 redacted metrics；不用单一 LLM judge 关闭 hard gates。

第一批后轮换一个空闲槽实现 phase5_web_evidence：独占右侧栏 evidence/citation/no-answer/stale blocks和 component/E2E；不修改 response validator/store core。

你独占 index/evidence contracts、generated clients、Evidence adapter integration、共享配置/docs。Evidence descriptor v2和 v1 family 不变；Evidence Bundle 使用新 contract，不塞入旧 request。

调试：bad ingestion -> deterministic rebuild -> exact/metadata -> BM25 -> ACL/run filters -> bundle coverage/contradiction -> atomic citation -> malicious sources -> retention/delete/reindex -> optional semantic bake-off -> Web。

验收：exact identity/citation/uint64=1.00；recall@5目标>=0.95；no-answer false positive=0；ACL/cross-run leakage=0；provenance/fidelity upgrade=0；stale/partial/refused/truncated/409/502/503/504 不回归；语义检索无显著收益则关闭。

停止条件：source 无 immutable identity/digest；需要任意 URL ingestion；citation 缺 run/artifact/schema/SHA/Pointer/subject；retention/delete 不清；GraphRAG 被要求用于数值真源。更新 RAG/MEMORY/OBS/GRAPHRAG Gap。

报告四类索引、基线/可选检索对比、硬门禁；明确 live citation review 仍需独立授权，未部署 5173。
```

## 8. Phase 6：跨运行比较与实验迭代

```text
你是 TileSim Agent 编排 Phase 6 主 Agent兼集成负责人，使用一个主 Agent和三个子 Agent。目标是发布 Comparison Set/Comparability Report，比较兼容 run、拒绝不兼容因果比较，并从结果创建新 immutable draft；原 run/artifact 永不修改。

全员阅读公共必读、AO 05、07、08、09、11、12、14、15、16、17，以及 run manifest、execution envelope、validation/attribution、design-space、history/comparison 代码测试。检查工作树；不操作 5173/live Provider/credential；不在前端直接相减报告；citation 始终保持 owning run；S3/S4/S5 并列、S7 是执行宿主、S8/S9 不进入 causal ranking。

子 Agent：
1. phase6_comparability：独占 comparison contracts/rules/tests；输入 run/backend/schema/profile/requested-resolved fidelity/provenance/trace/calibration identities，输出 compatible/incompatible/unknown/stale、允许 claim scope和逐规则原因。
2. phase6_iteration_planning：独占 run -> new draft references、input diff、bounded candidates、budget/promotion/stop/tie-break tests；不复制 claims，不改原 artifact，不把未执行字段加入 ranking。
3. phase6_web_eval：独占 comparison/iteration blocks、owning-run citations、拒绝状态、clone-draft fixtures和 adversarial E2E；不实现自己的 metric comparator。

你独占 shared schema/generated/history integration/docs；先冻结 comparability oracle，再允许 Web/LLM 解释。

调试：identity equality/diff -> profile/fidelity/provenance -> metric availability -> owning citations -> incompatible/unknown/stale -> candidate determinism/budget -> clone draft -> Web/E2E。

验收：comparability bypass=0；不兼容 run 只能并排展示；每个 claim/citation 保持 owning run；budget和 stop reason 可审计；当前 network/hardware design-space 外字段不排名；下一轮 draft 重新 validation/approval。

停止条件：无正式 comparability contract；run 缺 profile/provenance/fidelity identity；要求跨 run 合并 citation；把 analytical 排名扩写成真实原因。更新 COMPARE/DRAFT/VALIDATE Gap。

按 AO-17 交接，运行规则、planner、Web/E2E 和全仓门禁。报告比较范围、拒绝案例、candidate boundary 和未部署 5173。
```

## 9. Phase 7：工具、安全、可观测性和面试作品

```text
你是 TileSim Agent 编排 Phase 7 主 Agent兼集成负责人，使用一个主 Agent和三个子 Agent。目标是在稳定内部 contract 上增加有限 typed tools/MCP adapter、redacted observability、安全评测和可重复面试 Demo。A2A、GraphRAG 和 reviewer Agent 只有独立评测证明价值后才启用。

全员阅读公共必读、AO 08、09、10、11、12、13、14、15、16、17，以及认证、approval、workflow、Provider adapter、安全配置、发布/回滚文档。检查工作树。保护改动；不读/输出 credential；普通开发不执行 live Provider；不操作 5173；不开放 shell/任意文件/任意 URL/任意 SQL；MCP 只是 adapter。

子 Agent：
1. phase7_tool_mcp_security：独占 typed tool registry、T0/T1 tools、经审批 T3 create-run mapping、permission/idempotency/audit和 MCP adapter tests。每个工具有 Schema/effect/scope/timeout/budget/retry/cancel/redaction。A2A deferred。
2. phase7_observability_demo：独占 redacted OTel/audit schema、metrics、ADR/Demo/eval-report tooling。Span 只记 IDs/revisions/digest摘要/status/count/latency/budget，不记 prompt、完整问题、artifact、raw response、hidden reasoning或 claims副本。
3. phase7_adversarial_eval：独占 prompt injection、malicious artifact/profile/tool/MCP resource、SSRF、redirect、path traversal、command injection、approval bypass、cross-workspace/run、duplicate side-effect数据集和测试；不修改实现/oracle迁就结果。

你独占 shared tool contracts/generated clients、server registration、App Shell integration、release manifest、Demo 状态和文档。

调试：tool schema -> deny-by-default permissions -> approval/idempotency -> MCP discovery/read-only -> write failure injection -> OTel redaction snapshot -> injection/SSRF/path/tool abuse -> full workflow Demo -> rollback/kill switch。

验收：未授权工具成功=0；approval 前写=0；duplicate run=0；secret/raw response/hidden reasoning泄漏=0；任意 URL/path/shell拒绝；OTel无敏感 payload；Demo区分 fixture/live/synthetic/calibrated/held-out；指标来自冻结 eval report。

本提示词不授权 live Provider。Live success/refusal/timeout repetitions和双人 citation entailment review必须由项目负责人另开明确授权任务；未执行时状态保持 0/未完成。

停止条件：工具无 owner/schema/effect/idempotency；MCP直接访问 repository；endpoint不受 allow-list；日志需保存敏感内容；Demo要求 fixture冒充 live。更新 TOOLS/MCP/A2A/OBS/EVAL/LIVE/CITATION-REVIEW Gap。

按 AO-17 交接并运行工具、安全、redaction、workflow、Demo和全仓门禁。最终报告权限矩阵、攻击结果、side effects、telemetry、Demo/ADR、live/人工复核状态，并明确未部署 5173。
```

## 10. 项目负责人阶段验收检查单

不要只看 Agent 的自然语言总结。每阶段至少复核：

1. `git status --short` 和 changed-file list 是否符合独占范围；
2. 是否有多个 Agent 修改同一 contract、App Shell、global store、i18n 或 E2E snapshot；
3. runtime descriptor 与文档声称能力是否一致；
4. 是否同时覆盖负例、stale、权限、恢复和 retention；
5. fixture、fake Provider、live、calibration、held-out 是否分别报告；
6. 是否为通过测试而放宽 validator、删除 oracle 或加入 silent fallback；
7. Gap 是否在证据不足时被错误关闭；
8. 是否读取 credential、操作 5173、擅自 commit/push；
9. 下一阶段 DoR 是否满足；
10. 全仓门禁是否由集成负责人在所有写入结束后运行。

任一项无法确认时，暂停下一阶段，要求 owning Agent 给出最小证据或修复。
