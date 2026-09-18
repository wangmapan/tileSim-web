# 开发者指导 AI 实施 Agent 模块手册

> 文档 ID：`AO-17`
>
> 类型：开发执行手册
>
> 目标读者：项目负责人、集成负责人、使用多个编码 Agent 的开发者
>
> 前置阅读：[文档集入口](README.md)、[当前基线](01_CURRENT_BASELINE_AND_GAPS.md)、[路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)、[模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)

## 1. 这份手册解决什么问题

本手册说明如何把完整方案拆成多个可验证的小阶段，并指导若干 AI Agent 并行开发。重点不是让 AI “尽可能多写代码”，而是保证每个 Agent：

- 知道当前事实、目标能力和禁止范围；
- 只修改独占模块，不覆盖其他人的工作；
- 通过版本化 contract 协作，不共享隐式假设；
- 先完成模块级调试，再交给集成负责人；
- 只根据正式测试更新完成状态；
- 遇到 contract/backend/data gap 时停止模拟并上报。

建议将本文件作为每轮开发任务的总入口，但不能代替每个阶段列出的专题文档。

如果需要复制后直接启动，不要再自行拼接本文件中的模板：使用 [Phase 0–7 可直接复制的多 Agent 提示词包](18_COPY_READY_MULTI_AGENT_PROMPTS.md)。其中每个阶段都是独立、完整的主 Agent 提示词，并内含三个子 Agent 的分工、范围、测试、停止条件和交接要求。

## 2. 推荐团队结构

一个并行批次建议最多设置三条实施线和一个集成负责人：

| 角色                | 职责                                             | 是否直接写共享文件              |
| ------------------- | ------------------------------------------------ | ------------------------------- |
| 项目负责人          | 决定阶段目标、能力范围、真实数据和发布门槛       | 只批准，不直接参与并行冲突      |
| 集成负责人 Agent    | 冻结 contract、分配独占范围、合并、全仓验收      | 是，唯一 owner                  |
| Contract/领域 Agent | Schema、领域对象、validator、后端服务            | 只写自己的 contract/domain 范围 |
| Web Agent           | feature、view model、component、accessibility    | 不写正式 Schema 和后端语义      |
| Eval/Security Agent | fixtures、oracle、adversarial、failure injection | 不修改实现以“让测试通过”        |

复杂阶段可以增加一个 Profile/Data Agent 或 Retrieval Agent，但同时活跃的 Agent 越多，共享状态和评审成本越高。优先让一个 Agent 完成一个高内聚模块，而不是把同一文件按函数拆给多人。

## 3. 开发者必须掌握的事实

发任务前，开发者应明确告诉 AI：

- 当前正式 create-run 只覆盖 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md) 中的受控范围；
- 当前 Evidence Agent 是 descriptor v2、request/response/citation/snapshot v1；
- 当前单轮、最多四类任务，不具备正式多轮、主动澄清、工具、取消和跨 run 比较；
- Schema 有字段、Bridge 接受、字段真实执行、已校准、已 held-out 验证是五种不同状态；
- LLM 不负责显存、KV、单位、并行、网络、SLO、identity、citation 和权限的确定性裁决；
- Trace 来源、GPU 参与方式和仿真保真度彼此独立；
- KV Cache、设备性能和集合通信是并列资源语义；
- 未提交改动、Provider credential 和正在运行的 5173 都必须保护。

如果开发者自己不能回答“本阶段哪些字段真实执行”，不应让 AI 开始做可运行配置界面。

## 4. 文档阅读路由

### 4.1 所有 Agent 必读

1. `D:\tileSim-web\AGENTS.md`；
2. `D:\tileSim-web\docs\AI_HANDOFF.md`；
3. `D:\tileSim\AGENTS.md`；
4. [文档集入口](README.md)；
5. [约束与术语](00_GUARDRAILS_AND_GLOSSARY.md)；
6. [当前基线](01_CURRENT_BASELINE_AND_GAPS.md)；
7. [模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)；
8. 当前任务涉及的源码和测试。

必须要求 AI 完整读取，而不是只搜索关键词。

### 4.2 按角色追加阅读

| 角色                  | 追加必读                                 |
| --------------------- | ---------------------------------------- |
| Product/Web UX        | 02、05、16                               |
| Architecture/Contract | 03、04、05、08、10、14                   |
| Intent Compiler       | 04、05、06、07、11                       |
| Validator/Calculator  | 04、07、11、14                           |
| Workflow/Approval     | 05、08、10、11                           |
| RAG/Evidence          | 05、09、10、11                           |
| Web 右侧栏            | 02、05、08、15、16                       |
| Eval/Security         | 09、10、11、14                           |
| Integrator            | 03、11、12、14、15、16 和所有 Agent 交接 |

### 4.3 需要时读取，不默认扩散

- 后端公开架构和具体模块合同：当字段或执行语义涉及对应模块时读取；
- F9 contract audit/evaluation spec：修改当前 Evidence Agent 时读取；
- 历史进度文档：只用于追溯，不覆盖当前 handoff；
- 外部框架文档：只在技术 bake-off 时读取，不直接改写产品边界；
- 私有主设计资料：只读，且不得从记忆重新发布。

## 5. 开始一个并行批次前

集成负责人先完成以下只读检查：

1. `git status --short`：记录两个仓库已有改动；
2. `git rev-parse HEAD`：记录 Web 和后端基线；
3. `git worktree list`：确认没有路径/分支冲突；
4. 读取运行时 contract/descriptor，而不是假设文档已部署；
5. 确定本批次的 `REQ-*`、`GAP-*`、`WP-*`；
6. 冻结输入 contract revision 和 fixture digest；
7. 建立文件所有权表；
8. 为每条线定义模块级测试；
9. 明确本批次是否允许外部网络、写操作或 live Provider；默认都不允许；
10. 指定唯一集成负责人和合并顺序。

不要让实施 Agent 通过停止或替换 `127.0.0.1:5173` 来获得测试环境。Bridge 使用临时端口，前端使用 Vite/Playwright fixture。

## 6. Worktree 与文件所有权

### 6.1 推荐方式

每个实施 Agent 使用独立 Git worktree 和 `codex/` 前缀分支。由开发者或集成负责人创建和核对 worktree；不要让多个 Agent 自行猜路径。

概念命名：

```text
codex/ao-contract-phase-N
codex/ao-backend-phase-N
codex/ao-web-phase-N
codex/ao-eval-phase-N
codex/ao-integration-phase-N
```

若必须共享一个工作树，只能在路径完全不相交、共享文件单一 owner、所有 Agent 明知共享状态的情况下进行。任一 Agent 发现意外改动，应停止覆盖并通知集成负责人。

### 6.2 所有权清单

每个任务提示词都必须包含：

```text
允许修改：<精确目录或文件列表>
禁止修改：<共享文件和其他 Agent 目录>
只读依赖：<contract、fixture、源码路径>
共享文件 owner：<集成负责人>
生成物 owner：<contract/integration Agent>
```

禁止用“相关文件都可以改”作为范围。

### 6.3 高冲突文件

以下默认只由集成负责人修改：

- OpenAPI/Schema 根索引和生成类型；
- manifest/schema-set revision；
- package lock 和依赖配置；
- App Shell、router、全局导航；
- 全局 i18n、PagePrimer/guided-help catalog；
- 全局 store/controller；
- shared E2E spec 和视觉快照；
- README、当前基线和 Gap 状态。

实施 Agent 对这些文件只提交变更建议或局部 fixture。

## 7. 一个高质量 AI 提示词的结构

每个任务提示词至少包含十二部分：

1. **角色**：例如“你负责 deterministic validation，不负责 UI”；
2. **目标**：一个可独立验收的结果；
3. **事实基线**：commit、contract identity、当前能力；
4. **必读材料**：明确路径和阅读顺序；
5. **独占修改范围**；
6. **禁止修改范围**；
7. **输入/输出接口**；
8. **必须保持的不变量**；
9. **小批次实施顺序**；
10. **每批调试命令和预期结果**；
11. **停止条件和需要上报的 Gap**；
12. **最终报告格式**。

不要只说“实现一个强大的 Agent”。这种提示无法界定完成、权限和准确性。

## 8. 总控提示词模板

以下模板交给集成负责人 Agent：

```text
你是基于 Agent 的仿真编排模块本阶段集成负责人。

阶段目标：<Phase/Stage、用户任务和明确非目标>
事实基线：Web <commit>，后端 <commit>，contract <identity/revision>。

开始前完整阅读：
- D:\tileSim-web\AGENTS.md
- D:\tileSim-web\docs\AI_HANDOFF.md
- D:\tileSim\AGENTS.md
- docs/F9_AGENT_ORCHESTRATION/README.md
- 00、01、11、12、14、15，以及本阶段专题文档

先执行只读审计：两个仓库 git status、相关 contract/descriptor、源码与测试。
保护所有未提交改动。不得 reset、clean、覆盖、擅自提交或推送。
不得读取或输出 TILESIM_EVIDENCE_AGENT_* 的值。
不得执行 live Provider acceptance。
不得停止、重启或部署 127.0.0.1:5173。

你的职责：
1. 冻结本批次接口和 fixture；
2. 为 Contract/Backend/Web/Eval Agent 分配互不重叠的独占路径；
3. 审核每条线的测试和交接，不替它们写临时跨模块补丁；
4. 按 contract -> service -> generated client -> Web -> E2E -> docs 顺序集成；
5. 运行完整门禁并只根据证据更新 Gap 状态。

必须保持：<本阶段不变量列表>。
发现 Schema 无法表达、字段未真实执行、权限/留存不明确时，停止实现并登记 Gap。

最终报告：各模块接口、合并顺序、测试结果、失败/未完成项、contract identity、
安全与留存、live/人工验收状态、是否触碰 5173。
```

## 9. 实施 Agent 提示词模板

```text
你是 <模块名称> 的独占开发 Agent。

目标：<一个模块级、可测试的结果>。
你不负责：<邻接模块与全局集成>。

必读：<公共必读> + <角色专题文档> + <源码/测试路径>。
输入 contract：<identity/revision/digest>。
输出 contract：<明确对象/port/fixture>。

允许修改：
- <路径 A>
- <路径 B>

禁止修改：
- <共享文件>
- <其他 Agent 独占目录>

必须保持：
- <identity/uint64/stale/idempotency/citation/provenance 等>

实施顺序：
1. 先增加/更新模块 fixture 和失败用例；
2. 最小实现通过 module-local tests；
3. 增加 adjacent contract tests；
4. 运行格式/类型/依赖检查；
5. 检查自己的 diff，不触碰范围外文件。

调试时不得修改测试 oracle 迁就实现。发现 contract/backend/data gap 时停止并报告 Gap，
不要在前端、prompt 或 fixture 中模拟正式能力。

最终报告：职责边界、changed files、接口/identity 变化、测试命令和结果、
security/retention/evidence 验证、remaining gaps、共享文件与 5173 触碰情况。
```

## 10. Eval/Security Agent 提示词模板

```text
你是独立 Eval/Security Agent。你不实现业务逻辑，也不修改实现让测试通过。

根据 <contract revision> 和 <requirements/gaps> 建立：
- 正例、边界、失败、stale、权限和 adversarial fixtures；
- deterministic oracle；
- train/validation/test/held-out 分离；
- module/adjacent/E2E 测试建议；
- hard gate 报告。

重点覆盖：unknown/unsupported、uint64、provenance/fidelity、approval、idempotency、
crash/cancel、citation、prompt injection、cross-workspace/run leakage、redaction/retention。

不得执行 live Provider acceptance，除非当前任务由所有者单独明确授权。
发现实现与 contract 冲突时提交最小复现和 owner，不直接改 contract 或业务代码。
```

## 11. 阶段总览

| 阶段    | 主要结果                              | 可并行开发线                         | 主要验收                            |
| ------- | ------------------------------------- | ------------------------------------ | ----------------------------------- |
| Phase 0 | 能力目录和 Profile 最小契约           | Catalog/Backend audit/Eval           | exposed 字段都有 execution evidence |
| Phase 1 | 当前参数自然语言草案 + 右侧只读 Shell | Compiler/Web Shell/Eval              | request 等价、无副作用              |
| Phase 2 | 模型、设备、并行、工作负载与计算器    | Profiles/Calculators/Web/Eval        | 累计链和不可行配置 fail closed      |
| Phase 3 | 多轮、草案 revision、审批             | Conversation/Approval/Web/Eval       | stale/并发/留存/审批正确            |
| Phase 4 | 可恢复执行、进度和取消                | Workflow/Run adapter/Web/Eval        | crash/retry 无重复副作用            |
| Phase 5 | 分域 RAG 和 Evidence 一体化           | Ingestion/Retrieval/Evidence UI/Eval | recall、citation、no-answer、安全   |
| Phase 6 | 跨 run 比较和下一轮实验               | Comparability/Planning/Web/Eval      | 不兼容比较被阻止                    |
| Phase 7 | MCP、可观测性、Demo 和作品收敛        | Tools/OTel/Security/Demo             | 权限、注入、完整演示和报告          |

## 12. Phase 0：能力真源

### 12.1 开发目标

发布 parameter descriptor/capability snapshot 和五类 Profile 最小 Schema，建立字段到执行证据的 traceability matrix。此阶段不做自然语言写入。

### 12.2 Agent 分工

- Contract Agent：独占 capability/profile schemas、canonical vectors；
- Backend Audit Agent：只读追踪 field → request → lowering → state/event → artifact/test；
- Eval Agent：unsupported、not_exposed、unresolved、profile drift fixtures；
- Integrator：统一生成类型和 manifest revision。

### 12.3 调试顺序

1. Schema/parser 单元测试；
2. canonical digest 的 Python/TypeScript vectors；
3. registry 与 descriptor 双向覆盖；
4. 每个 `agent_exposed` 字段的 lowering/execution test；
5. capability drift 和未知 revision fail closed；
6. Web inspector fixture，不接 Provider。

### 12.4 验收

- described/accepted/validated/lowered/executed/observable/calibrated/held-out 分开；
- exposed 且未 executed 的字段数量为 0；
- 五类 Profile 有 identity、revision、source、valid regime；
- missing/expired/unknown profile 不产生默认结论；
- 更新 `GAP-CAP-001`、`GAP-PROFILE-001` 的真实状态。

### 12.5 停止条件

字段只有文档或 Schema、找不到后端执行影响、profile 无 owner/source、校准状态靠自报时停止。

## 13. Phase 1：自然语言草案与右侧只读 Shell

### 13.1 开发目标

用户能在右侧栏描述当前正式参数子集，得到无副作用 typed draft、字段来源、diff 和 deterministic validation；不创建 run，不模拟多轮持久化。

### 13.2 Agent 分工

- Compiler Agent：task routing、slot、alias、unit normalization；
- Web Shell Agent：独占右侧 Shell、Context Registry 和 typed blocks；
- Draft UI Agent：独占 draft/validation presentation；
- Eval Agent：100+ 双语意图、单位、歧义、unsupported 和键盘/E2E；
- Integrator：App Shell、全局入口、generated client 和 shared E2E。

Web Shell 与 Draft UI 通过 frozen view model 协作，不同时修改 App Shell 或同一 store。

### 13.3 调试顺序

1. 用纯函数测试 slot/alias/unit；
2. typed output runtime validation；
3. draft builder 与手工表单 builder 的 canonical payload 对比；
4. Web component fixtures：closed/collapsed/open/expanded、typed blocks；
5. Context Envelope 的 route/run/selection/stale；
6. 键盘、焦点、中文 IME、200% zoom、reduced-motion；
7. fixture E2E 证明打开侧栏不清除 run 或表单。

### 13.4 验收

- current subset request equivalence=100%；
- unknown/unsupported 接受率=0；
- uint64/单位/Pointer 正确率=100%；
- Provider 未配置时行为正式且可恢复；
- 侧栏没有 create-run 调用；
- 页面通过 context adapter 接入，不抓 DOM 或 import feature 内部文件。

### 13.5 停止条件

需要 conversation persistence、正式写操作、模型/卡数等未执行字段时登记 Gap，不用本地消息列表或 prompt 默认绕过。

## 14. Phase 2：Profile、计算器和完整配置

### 14.1 前置条件

模型/设备/引擎/拓扑/工作负载 Profile 正式发布；工作负载到六类 Trace、TP/PP/EP、KV、集合通信、网络和请求指标的累计链闭合。

### 14.2 Agent 分工

- Profile/Data Agent：版本、source、regime、calibration receipt；
- Calculator Agent：memory/KV/parallel/placement/network/SLO；
- Lowering Agent：draft → 正式 request/工作负载 intake；
- Web Agent：高级草案和 validation receipts；
- Eval Agent：组合、边界、property/golden、累计链。

### 14.3 调试顺序

1. 每个 calculator 的 pure golden vectors 和 property tests；
2. profile missing/unknown/expired；
3. model × engine × device × topology × workload 风险组合；
4. lowering adjacent conversion tests；
5. 累计链测试到网络反压和请求指标；
6. UI 只展示服务端 receipt，不复制公式；
7. synthetic、calibrated、held-out claim scope 回归。

### 14.4 验收

- 所有不可行配置 fail closed；
- 关键未知输入输出 unknown，不由 LLM 猜；
- 并行、KV、设备、集合通信、网络边界正确；
- 卡数建议是带假设的可执行候选，不是模型预测；
- 没有真实校准时不输出部署保证。

## 15. Phase 3：多轮、草案 Revision 与审批

### 15.1 Agent 分工

- Conversation Agent：Conversation/Turn/Goal、顺序和并发；
- Draft Agent：immutable revisions、patch 和 source；
- Approval Agent：digest/scope/expiry/revoke/stale；
- Web Conversation Agent：timeline/composer/clarification/approval blocks；
- Security/Eval Agent：retention、cross-workspace、approval bypass。

### 15.2 调试顺序

1. state machine 和非法 transition；
2. expected revision conflict；
3. draft/profile/policy 变化的 stale 传播；
4. approval mismatch/expiry/revoke；
5. consent/expiry/delete/redaction；
6. 跨页面 continuation 和 context snapshot；
7. 双窗口并发编辑 E2E。

### 15.3 验收

- 参数变化后旧 approval 可用次数=0；
- 跨 conversation/workspace 泄漏=0；
- hidden reasoning/raw response/credential 持久化=0；
- 中位阻塞澄清轮数目标≤2；
- transcript 未获 consent 时不承诺刷新恢复。

## 16. Phase 4：可恢复执行

### 16.1 Agent 分工

- Workflow Agent：Operation/Event/Checkpoint graph；
- Run Adapter Agent：create-run idempotency/commit record/query；
- Streaming Agent：SSE/poll snapshot/event sequence；
- Web Agent：approval、progress、recovery/cancel blocks；
- Chaos Agent：每个 side-effect node 的 crash matrix。

### 16.2 调试顺序

对每个副作用节点依次注入：调用前崩溃、外部提交后本地记录前、记录后 event 前、重复 event、进程重启、客户端重连。

再测试：same key/same payload、same key/different payload、transport unknown、approval expiry、budget exhaustion、cancel fence 和 late result。

### 16.3 验收

- approval 前 create-run 调用数=0；
- 同一 operation 的 observable run 副作用=1；
- payload mismatch 正式冲突；
- crash/retry 不重复 Provider 或 run；
- 断流不等于 workflow failure；
- 取消未获后端 acknowledgment 时不显示“已取消”。

## 17. Phase 5：分域 RAG 与证据

### 17.1 Agent 分工

- Ingestion Agent：allow-list source、schema/SHA/run binding、chunk IDs；
- Retrieval Agent：exact/metadata/BM25 baseline 和 optional semantic bake-off；
- Evidence Agent：bundle、atomic claim 和 citation validator；
- Web Evidence Agent：evidence blocks、details 和 stale presentation；
- Eval/Security Agent：recall、no-answer、injection、ACL 和 deletion。

### 17.2 调试顺序

1. ingestion 对坏 bytes/schema/SHA fail closed；
2. deterministic chunk/index rebuild；
3. exact/metadata/BM25 baseline；
4. evidence bundle coverage/contradiction；
5. atomic citation identity/value/unit validation；
6. malicious document/artifact/profile；
7. embedding/reranker offline bake-off；无显著增益则关闭；
8. retention/delete/reindex。

### 17.3 验收

- evidence recall@5 目标≥0.95；
- citation precision 和 uint64 exactness=1.00；
- no-answer false positive=0；
- provenance/fidelity upgrade=0；
- ACL/cross-run leakage=0；
- 当前 Evidence Agent 两类 409、stale、502/503/504 不回归。

## 18. Phase 6：比较和迭代

### 18.1 Agent 分工

- Comparability Agent：input/profile/fidelity/provenance rules；
- Planning Agent：run → new draft、bounded candidates；
- Web Agent：comparison blocks、owning-run citations、diff；
- Eval Agent：不兼容 run、unresolved fields 和 ranking boundaries。

### 18.2 调试和验收

- compatible/incompatible/unknown/stale 规则逐项测试；
- 每条 metric/claim 保留 owning run；
- 不兼容 run 只能并排展示，不能差异归因；
- candidate budget、promotion、stop reason deterministic；
- 当前网络与硬件资源限定范围外字段不参与 ranking；
- 下一轮 draft 不修改原 run 或 artifact。

## 19. Phase 7：工具、可观测性和面试作品

### 19.1 Agent 分工

- Tool Security Agent：registry、permission、approval、MCP adapter；
- Observability Agent：redacted OTel/audit；
- Adversarial Agent：prompt injection、SSRF、path、tool abuse；
- Demo Agent：脚本、offline fixture、ADR、eval report；
- Integrator：冻结发布组合和回滚。

### 19.2 调试和验收

- 未授权 tool success=0；
- approval 前 write tool=0；
- secret/raw response/hidden reasoning 泄漏=0；
- SSRF/path traversal/arbitrary URL/shell 全部拒绝；
- OTel 不记录敏感 payload；
- Demo 明确区分 fixture、live、synthetic、calibrated 和 held-out；
- A2A、GraphRAG、reviewer Agent 只有 eval 证明收益后再启用。

## 20. 通用调试阶梯

所有阶段按从小到大的顺序调试：

1. **Schema/runtime validator**：先验证输入输出形状；
2. **纯领域单元**：不启动服务、不调用 Provider；
3. **Adapter/Repository**：使用 fake clock、in-memory repository、fixture Provider；
4. **Adjacent contract**：只跨一个模块边界；
5. **Bridge 临时端口**：验证 HTTP、header、error envelope、idempotency；
6. **Web component**：fixture/MSW、键盘、焦点、DOM；
7. **Fixture E2E**：独立 Vite，不碰 5173；
8. **Cumulative flow**：工作负载到网络与请求指标；
9. **全仓门禁**；
10. **Live/人工验收**：独立授权任务，不能由普通开发测试替代。

出现底层失败时先修底层，不在上层增加 fallback 隐藏错误。

## 21. 分层测试命令

具体命令以仓库 `AGENTS.md`、`package.json` 和当前构建系统为准。Web 常用门禁：

```powershell
pnpm contracts:check
pnpm deps:check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm test:e2e
git diff --check
```

Bridge contract/service 修改还需执行当前 handoff 规定的 Python compile/unit tests。后端模块遵循 `D:\tileSim\AGENTS.md` 的 Linux-first/WSL 测试路径，至少包含 module-local、adjacent-layer conversion、connectivity 和 cumulative-chain tests。

实施 Agent 先运行自己的相关测试；全仓门禁只由集成负责人在全部写入完成后运行，避免并行任务互相影响结果。

## 22. 如何判断测试失败属于谁

| 失败                               | 首要 owner                             |
| ---------------------------------- | -------------------------------------- |
| Schema/identity/generated drift    | Contract Agent                         |
| field 被接受但未执行               | Capability/Backend Agent               |
| 数值/单位/可行性错误               | Validator/Calculator Agent             |
| approval/idempotency/recovery      | Workflow/Run Adapter Agent             |
| citation/SHA/Pointer/subject       | Evidence Agent                         |
| layout/DOM/keyboard/focus          | Web owning Agent                       |
| cross-feature import/dependency    | Web owning Agent + Integrator          |
| prompt injection/permission bypass | Tool/Security owner                    |
| full E2E wiring                    | Integrator；再回派到最小 owning module |

不要让 Eval Agent 修改 oracle 来消除失败，也不要让 Integrator长期接管模块内部 bug。

## 23. 每批交接格式

每个 Agent 必须提交以下文字交接：

```text
任务/工作包：
职责边界：
基线和输入 contract：
修改文件：
公开接口/identity 变化：
保持的不变量：
运行的测试与结果：
未运行的测试及原因：
security/redaction/retention：
fixture/live/calibration/held-out 状态：
剩余 Gap 和阻塞：
是否修改共享文件：
是否触碰 5173、credential、live Provider：
建议合并顺序：
```

“测试都通过”必须附命令、case 数或清晰结果；不能只给口头结论。

## 24. 集成负责人验收流程

1. 收集所有交接和 changed-file lists；
2. 检查文件所有权是否越界；
3. 检查 contract identity/revision 和 generated files；
4. 先合并 contract/fixture，再合并后端和 Web；
5. 运行 module/adjacent tests；
6. 运行 failure/security/redaction tests；
7. 运行完整 Web/Bridge/后端门禁；
8. 复核工作树，确认没有覆盖用户改动；
9. 更新 capability/status/Gap/路线图，但只写有证据的状态；
10. 输出最终报告，不擅自部署、提交或推送。

## 25. 什么时候必须让 AI 停止

在以下情况明确要求 AI 停止实现并报告：

- contract 无法表达所需状态、identity 或错误；
- 字段没有确定性 lowering/execution evidence；
- profile 缺少版本、来源或 valid regime；
- 写操作没有 approval/idempotency/recovery；
- retention/permission owner 不明确；
- 需要重启/部署用户 5173 才能继续；
- 需要读取 Provider credential 或执行未授权 live acceptance；
- 发现范围外未提交改动且无法安全绕开；
- 测试 oracle 和正式 descriptor 冲突；
- 新功能会改变模块、fidelity、provenance 或校准边界但没有设计决策。

停止不是失败。正确登记 Gap 比做一个看似可用但不准确的前端模拟更有价值。

## 26. 常见错误提示词

避免：

- “参考热门项目，把 Agent 做得完善一点”；
- “你可以修改任何相关文件”；
- “测试失败就自行调整”；
- “做成像 ChatGPT 一样”；
- “自动选择最佳卡数”；
- “几个 Agent 一起改，最后解决冲突”；
- “顺便部署看看”；
- “保存上下文方便以后用”。

替换为可测试目标、精确范围、正式 contract、权限边界和退出条件。

## 27. 推荐的第一个实际开发批次

在当前基线上，最安全且最有作品价值的批次是：

1. Contract Agent 设计 capability snapshot 和最小 Page Context Envelope；
2. Backend Audit Agent 完成当前八参数的 execution traceability；
3. Web Agent 在独立 feature 内实现只读 Agent Copilot Shell 和 context fixtures；
4. Eval Agent 建立侧栏布局、上下文、键盘、unsupported 和无副作用测试；
5. Integrator 最后接入 App Shell，并确认不改现有 Evidence contract。

该批次完成后，用户能在右侧栏知道当前页面和 Agent 能做什么，但还不能通过对话创建 run。下一批再实现当前八参数面的 typed natural-language draft。

## 28. 更新触发器

阶段、角色、文件 ownership、测试命令、contract、Agent 数量、工作树策略或验收门槛变化时更新本文。每次启动新并行批次前，集成负责人应复核本手册是否仍与当前 `AGENTS.md`、handoff、runtime descriptor 和 [Gap Register](14_CONTRACT_GAP_REGISTER.md) 一致。
