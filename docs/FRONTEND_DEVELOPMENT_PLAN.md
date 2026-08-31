# TileSim Web Development Plan

**面向对象**：AI coding agent  
**范围**：`D:\tileSim-web` 电脑网页端、local Bridge、契约和部署脚本  
**当前日期**：2026-08-31

开始工作前先读仓库 `AGENTS.md` 和 `docs/AI_HANDOFF.md`。本文件只定义阶段目标和验收，不重复架构细节。

## 1. 当前状态

| 阶段  | 状态      | 结果                                                                                  |
| ----- | --------- | ------------------------------------------------------------------------------------- |
| F0    | validated | 工作树、后端 identity、样本、视觉和性能基线                                           |
| F1    | validated | fixture、字段审计、Playwright、axe、视觉和 overflow 回归                              |
| F2    | validated | TypeScript、compatibility schema、adapter、无损整数和 unknown-schema fallback         |
| F3    | validated | versioned Bridge contract、generated client、artifact integrity、SSE、幂等和恢复      |
| F4    | validated | Router、Pinia、TanStack Query、feature 边界、模块拆分和依赖门禁                       |
| F5A-D | validated | 大型工件 Worker、虚拟浏览和 SHA-256 绑定 evidence pointer                             |
| F6A   | validated | Week 7 S8 校准、S9 字段血缘/归因审计和确定性 Agent 编排                               |
| F6B   | validated | Week 8 run-bound S1-S9 联动、真实服务验收和完整仓库门禁均已闭合                       |
| F7    | validated | 正式 Pareto、candidate artifact、executed S6 knobs 与 topology join 已闭合            |
| F8    | validated | 正式 experiment descriptor、revision fail-closed、8 字段表单与 request Pointer 已闭合 |
| F9A   | completed | contract audit、评测规格与 36-case 机器可读 hard gate 已完成                          |
| F9B   | adapted   | 正式 Agent descriptor/request/response/citation 契约与 read-only UI 已完成前端适配    |
| F9C   | blocked   | provider 未配置；等待 live success/refusal 与重复模型评测，不以 mock 关闭             |
| F10   | planned   | 发布硬化                                                                              |

F6B、F7 与 F8 已在 `D:\tileSim-week8` 的真实 Week 8 Bridge 上完成 live acceptance。F9B 前端适配后的基线为
184/184 unit/component、56/56 Bridge、24/24 desktop fixture Playwright 和 4/4 live Week 8/F7/F8 Playwright。F8
已消费正式 `GET /api/experiment-schema`，以 `field_id` 为身份、`request_json_pointer` 为唯一序列化/错误映射，
并完成 manifest/payload/header revision 三方失败关闭。F9B 已消费正式 evidence Agent runtime contract，完成
revision/digest/idempotency/citation/stale/degradation 的失败关闭；当前 provider 正式返回 unavailable，因此只关闭前端
contract adaptation，不声称 live Agent closure，也不以 mock success 绕过。
详见 `docs/F8_EXPERIMENT_ORCHESTRATION_AUDIT.md`、`docs/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`、
`docs/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md` 和 `docs/development/F7_FORMAL_CONTRACT_CLOSURE_2026-08-31.md`。

## 2. 全阶段约束

- 后端报告是模拟事实来源；前端不补造指标。
- canonical flow 是 `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6`。
- provenance、calibration、validation、evidence、claim scope 和 resolved fidelity 不得升级。
- `0`、missing、expected absence、not covered、unsupported 和 not applicable 必须区分。
- 只维护电脑网页端；移动端不进入实现或发布门禁。
- 每次修改保持 unknown schema、旧报告、boundary run 和历史只读能力。
- 阶段只有在代码、测试、文档和完整门禁齐全时才能标记 validated。

## 3. F5：大型工件与 evidence pointer

### 目标

让 10 MB/100,000 行级 artifact 可搜索、可定位、可复制且不阻塞主线程，并建立结构化指标到原始证据的稳定跳转。

### 为什么现在做

F5A 基线确认旧 JSON viewer 的主线程整体格式化和 `<pre>` 渲染会造成长任务、内存复制与 DOM 膨胀；F5A-F5D 已关闭大型浏览和可信 evidence pointer，为 F6-F9 提供稳定证据入口。

### 实施阶段

1. **F5A 基线与 contract**（validated）
   - 固定 10 MB、100,000 行、超长单行、无损整数和 unknown schema fixture。
   - 定义 Worker request/result/error/cancel contract 和 artifact identity。
   - 记录打开、索引、首批搜索、内存和 DOM 基线。
2. **F5B Worker 索引**（validated）
   - 将格式化、行索引、文本搜索和 JSON Pointer 索引移出主线程。
   - run/artifact/hash 切换时取消或丢弃 stale result。
   - Worker 失败时保持完整下载和可理解错误，不静默返回部分数据。
3. **F5C 虚拟浏览**（validated）
   - 虚拟化行展示，DOM 行数不超过 300。
   - 支持搜索结果导航、字段列选择和 pointer 定位。
   - 复制/下载使用完整原文，不复制过滤后的子集。
4. **F5D evidence link**（validated）
   - 统一 `{runId, artifactId, sha256, pointer}`。
   - 指标、validation、attribution 和 execution inspector 可跳到对应证据。
   - unknown/legacy artifact 仍可定位原始文本，不伪造结构化 pointer。

### 验收

- 10 MB artifact 打开后界面保持可交互。
- 索引完成后常规搜索首批结果不超过 500 ms。
- 100,000 行视图 DOM 行数不超过 300。
- 快速切换 run/artifact 不显示旧结果。
- 64 位 ps/bytes、schema identity、SHA-256 和完整复制内容不变。
- evidence link 可从结构化字段跳转并返回。
- 相对 F5A 基线无未解释的 20% 以上性能回退。
- F0-F4 全部门禁保持通过。

## 4. 后续阶段

### F6A：Week 7 证据闭环（validated）

- **目标**：忠实展示后端 S8 calibration workflow、S9 report-field evidence lineage、`attribution_audit` 和确定性 Agent tool-call log。
- **边界**：只运行仓库固定的只读 fixture/命令；offline fixture 不是真实硬件校准；Agent 不生成根因或优化建议。
- **验收**：三个 endpoint 受 allow-list、identity、容量和超时门禁保护；页面中英文无溢出并可刷新；归因 audit 与结构化导出字段一致；SPA 刷新不丢失页面。

### F6B：run-bound S7/S8/S9 联动（validated）

**目标**：从具体 P99/request 或 tail cause 出发，在一个 run 身份下定位 S1、并列 S3/S4/S5、S6、S7 execution envelope、S8 validation 和 S9 attribution。

**为什么**：当前各页面能分别展示完整证据，但用户仍需手工比对。F6A 的 Week 7 页面是 backend-global 固定 fixture，不能充当具体 run 的关联证据。

**实施批次**：

1. 盘点 reports bundle 中已有 request、phase、collective、event、stage、validation 和 cause ID，形成可 join / 缺失 / 禁止推断清单。
2. 在 contract/adapter 层定义 run-bound link 与 availability reason；只使用后端稳定 ID、登记 JSON Pointer 或明确 contract 映射。
3. 建立 request/cause/evidence 共享选择状态和可恢复深链接；切 run 时清理不兼容选择并拒绝 stale result。
4. 在 Metrics、Attribution、Execution 间加入证据链、时间窗和适合的数据图表；每一跳保留单位与 evidence pointer。
5. 同步结构化导出，覆盖 boundary、legacy、unknown schema、缺失 join、损坏 hash、快速切 run、双语 overflow、键盘和 axe。

**验收标准**：

- 完整样本中的 P99/request 可定位到 S1、并列 S3/S4/S5、S6、S7、S8/S9；每一跳包含 run + artifact + SHA-256 + pointer 或稳定 contract ID。
- S3/S4/S5 的 fan-out/fan-in 始终并列；不使用时间接近、数组下标或文本相似度伪造 join。
- boundary run 不伪造 TTFT/TPOT；legacy、unknown schema 和缺关联显示准确 availability reason。
- backend-global fixture 不混入 run-bound 证据；切 run、刷新和浏览器历史不会泄漏旧选择。
- 64 位 ps/bytes 无损，页面与导出一致；电脑端中英文、键盘、axe、reduced motion、SPA 刷新和完整门禁通过。

**非目标**：不在前端重新模拟或推断因果；不接入语言 Agent；不做移动端；不把 Analytical/DES 提升为 Cycle。若缺稳定 join key，应先补后端 contract，而不是用前端启发式绕过。

### F7：Fabric 与设计空间

- **目标**：topology、queue/congestion/backpressure 热点、Pareto 和 Analytical -> DES funnel。
- **边界**：保持 `execution_scope=S6_only`；promotion hint 不等于实际原因；Cycle 不升级为 sweep tier。
- **验收**：图表能回到候选 run 和 artifact，聚合与报告一致，未执行变量保持 `unresolved_not_executed`。
- **正式 closure**：后端提供 `tilesim.design_space_report.v1` 与 `tilesim.s6_topology_input.v1`；前端已展示 Pareto membership/dominance/objectives、candidate artifact-record、requested/resolved S6 knobs 和 topology-domain EvidenceRef，并同步 structured report v2。
- **失败关闭**：duplicate ID、dangling dominance、wrong Pointer/run/schema/subject、候选伪 Bridge run 和 synthetic provenance 升级均不产生导航；legacy v1alpha1 保留兼容警告。
- **部署状态**：正式 F7 revision 已部署到 5173，并通过 3/3 live Week 8/F7 Playwright。

### F8：Schema 驱动实验编排

- **目标**：由 capabilities/schema 生成边界、source mode、fidelity 和 subsystem 参数表单。
- **验收**：表单和 JSON request 等价；不支持能力不能提交；前后端错误指向同一 field；重连不重复运行。
- **正式 closure**：正式 descriptor 驱动 enum/range/unit/order/applicability/capability；8 个 exposed 字段使用
  `field_id` 和 `request_json_pointer`，S2/S3/S4/S5 保持 `not_exposed`，Cycle/real/compatibility source 保持
  unavailable；request preview、submit、精确错误 Pointer 和幂等复用共享同一 builder。
- **失败关闭**：manifest、descriptor payload 与 header 的 schema revision 不一致时不使用缓存；unknown/duplicate
  Pointer 显示 contract error，不按名称、数组下标或文本猜测。
- **部署状态**：正式 F8 revision 已部署到 5173，并通过 live Week 8/F7/F8 Playwright。

### F9：只读证据 Agent（F9A complete；F9B adapted；F9C live blocked）

- **目标**：只在稳定 evidence link 上解释报告并生成待确认草稿。
- **已完成 F9A**：盘点结构化报告、run-bound evidence、manifest 和 Week 7 deterministic orchestration；定义
  threat model、引用完整性、拒答、安全、provenance/fidelity、availability、uint64、跨 run 隔离与桌面验收门禁；
  `tests/fixtures/f9-agent-evaluation-cases.json` 提供机器可读 hard-gate catalog。
- **F9B 已适配**：Bridge 已交付 versioned capability、request、response、atomic claim/citation、refusal、
  model/prompt/policy identity、audit、idempotency/timeout/cancel/persistence contract；前端从 manifest 发现 endpoint，
  使用 canonical digest、verified allow-list、逐 claim citation 复核和 stale 隔离。
- **F9C blocker**：正式 descriptor 为 `provider.configured=false` / `provider_unavailable`。页面保持 unavailable、禁用提交且
  不显示模拟 claims；等待 provider 可用后再做 live success/refusal 和重复模型评测。
- **验收**：所有数值结论包含 run、artifact、pointer 和 provenance；缺失信息不补值；无 shell、任意文件或任意 HTTP。
- **导出接入**：读取结构化报告内嵌 JSON；以独立结果填充根因和建议，不修改确定性事实区。
- **禁止绕过**：不调用 provider/未登记 endpoint，不解析 HTML 或 opaque link，不按时间、数组位置、数值、名称或文本
  建立关系，不用 mock success 把 F9 标记 validated。

### F10：发布硬化

- **目标**：验证前端、Bridge、部署脚本和指定 TileSim revision 作为一个系统工作。
- **验收**：空环境可安装、运行、恢复、比较和导出；失败部署保留上一版 manifest；source/build/state/schema/artifact 可追溯；无 P0/P1。

## 5. 质量门

普通变更至少运行受影响的 typecheck、unit/component tests、lint 和 build。跨页面、状态、Bridge、contract 或发布变更运行 `AGENTS.md` 中完整门禁。

额外规则：

- 页面变更：desktop Playwright、键盘、axe、视觉和 overflow。
- 动效变更：默认时长保持短促且不循环装饰；`prefers-reduced-motion` 同时关闭 CSS 与图表动效；静态报告面板不添加误导性的 hover 位移。
- contract 变更：generated drift、unknown schema、旧报告和 artifact integrity。
- Bridge 变更：临时端口 unittest、超时/重启/partial artifact/幂等/metadata 并发。
- 部署变更：只有用户明确授权才允许切换 5173；失败时保留上一版 deployment manifest。

## 6. 外部依赖与 blocker

- report schema 当前是前端 compatibility contract，不得称为后端 canonical schema。
- held-out fidelity claim 依赖真实 trace、校准资产和 S8 验证，不可用 synthetic fixture 关闭。
- GPU/Cycle/ASTRA 等能力以 Bridge capabilities 和后端实际实现为准，不能用前端开关模拟。
- blocker 记录在当前阶段文档；不能通过 mock、删除检查或降低解释标准关闭。

## 7. 参考入口

- 当前接手：`docs/AI_HANDOFF.md`
- 结果字段与证据：`docs/WEEK6_RESULTS_UI.md`
- Week 7 固定证据：`docs/WEEK7_EVIDENCE_UI.md`
- F9 Agent 契约审计：`docs/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`
- F9 Agent 评测规格：`docs/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`
- Bridge contract：`bridge/README.md`
- 历史证据：`docs/development/README.md`
- 后端 canonical 架构：`D:\tileSim\AGENTS.md`
