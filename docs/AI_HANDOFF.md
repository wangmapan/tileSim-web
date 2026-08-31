# TileSim Web AI Handoff

**事实日期**：2026-08-31  
**当前阶段**：F6B/F7/F8 validated；F9B read-only evidence Agent frontend adapted  
**下一阶段**：等待 provider 可用后执行 F9 live success/refusal 与重复模型评测；不得用 mock 关闭  
**产品范围**：只维护电脑网页端

## 1. 当前事实卡

- 前端仓库：`D:\tileSim-web`
- 后端架构只读仓库：`D:\tileSim`
- 当前 5173 来源：`D:\tileSim-week8`，branch `codex/week8-scale-system-acceptance`，revision `4a536cc081abb20567c19ab9e94e6139f5008333`
- 当前 schema-set revision：`sha256:5c6653e0fd7c367300ce5eba3200575e81170911ec952557f948931c6cb545aa`
- 当前 5173 部署身份：`versions_match=true`、`state_digests_match=true`、`execution_ready=true`；source/build digest
  均为 `b1711365831a47090bf3d6bec237e065b8bed4b1a09d8c055d6c61b8be7d67d0`。
- 当前基线：61/61 TileSim CTest、184/184 frontend、56/56 Bridge、24/24 desktop fixture Playwright、4/4
  live Week 8/F7/F8 Playwright
- 工作树包含多阶段连续未提交改动；不得 reset、clean、覆盖或擅自提交。
- `127.0.0.1:5173` 是用户服务；除非用户明确要求部署，不停止、不重启、不替换。
- F7 TypeScript 生成物、正式页面与 5173 schema revision 已同步。live acceptance run
  `run-20260831-121324-bbba5cdd` 的 9 个 artifact 均通过原始 bytes、manifest byte count 与 SHA-256 复核，
  `rejected_artifacts=[]`。
- F8 已消费正式 `GET /api/experiment-schema`：manifest/payload/header revision 三方绑定，`field_id` 为表单身份，
  `request_json_pointer` 为唯一序列化与错误定位映射，descriptor 驱动 enum/range/unit/applicability/capability。
  S2/S3/S4/S5 保持 `not_exposed`；Cycle、real trace 和 compatibility harness trace 保持 unavailable；closed
  create-run 与 design-space Schema 已生成浏览器 runtime validator。获得用户明确授权后，目标 revision 已部署到
  5173，health/manifest/descriptor 与 4/4 live Playwright 均通过，F8 状态为 validated。
- F9B 已消费正式 manifest-discovered evidence Agent capability/analysis endpoint、descriptor/request/response/citation/
  snapshot schema 和 generated client/runtime validator。36-case catalog 是不可删减 hard gate；request 使用 canonical
  UTF-8 JSON、无损整数、verified supported artifact allow-list 和独立 idempotency key；response 逐 atomic claim 复核
  run/artifact/schema/SHA/Pointer/stable subject，并保持 provenance/fidelity/架构边界。正式 provider 当前未配置，UI
  显示 `provider_unavailable`、禁用提交、无 mock claims；结构化报告仍保持 `agent_analysis=not_generated`。
- repo-wide Prettier 已在获得明确授权后闭合：两个新增 F7 Schema 与 `bridge/test_f7_schemas.mjs` 仅做格式化；
  两份 Schema 的规范化 JSON SHA-256 前后不变，未改变契约语义。

TileSim Web 是本地实验与证据工作台。Python Bridge 调用指定 `TileSimCLI` 并托管 allow-listed artifacts；后端报告是模拟事实来源，前端不得运行第二套模拟、重算指标或补造跨子系统关系。

## 2. 前 10 分钟

1. 读取 `AGENTS.md`、本文件和 `D:\tileSim\AGENTS.md`。
2. 在 `D:\tileSim-web` 执行 `git status --short`；只识别任务相关文件，不清理现有改动。
3. 检查当前服务身份，不要先运行部署脚本：

   ```powershell
   Invoke-RestMethod http://127.0.0.1:5173/api/health | ConvertTo-Json -Depth 8
   Invoke-RestMethod http://127.0.0.1:5173/api/manifest | ConvertTo-Json -Depth 8
   ```

4. 根据任务读取对应 feature、公共 `index.ts`、contract 和测试；历史原因只在需要时查 `docs/development/`。
5. 确认任务是 review/诊断还是授权实现。页面开发优先使用 Vite/Playwright fixture；Bridge 测试使用临时端口，不碰 5173。

如 shell 找不到 Node/pnpm，先加入本机 runtime：

```powershell
$env:Path='C:\Users\mapanwang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\mapanwang\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;'+$env:Path
```

## 3. 不可破坏的架构与证据边界

- 使用 canonical subsystem `S0-S9`；flow 显示为 `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6`。
- S3/S4/S5 是并列资源语义，不能画成顺序链。S7 是统一执行宿主；S8/S9 是 validation/output subsystem。
- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 不得互相升级。
- synthetic consistency 不等于 held-out validation；offline calibration fixture 不等于真实硬件校准。
- requested fidelity 和 resolved fidelity 分开；Analytical/DES 不得描述为 Cycle。Cycle 当前只表示真实 S6 hotspot refinement。
- `0`、missing、expected absence、not covered、unsupported schema 和 not applicable 必须区分；boundary run 可以没有 TTFT/TPOT。
- 64 位 ps/bytes 使用 lossless JSON，不先转成 JavaScript `number`。
- 当前 report schemas 是前端 compatibility contract，不得称为后端 canonical schema。
- 结构化报告的 `agent_analysis=not_generated`；现有 deterministic orchestration 不是生成根因或建议的语言 Agent。

当前设计空间固定 `execution_scope=S6_only`。未执行的 S1/S3/S4/S5 变量保持 `unresolved_not_executed`；`analytical_rank`、`final_rank` 和 promotion hint 不能被前端扩写成两套独立数值或真实原因。

## 4. 当前能力与代码地图

```text
src/app/                    Router、应用装配
src/contracts/              Bridge/report 类型、无损 JSON、generated client
src/adapters/               versioned report -> stable view model
src/features/               独立业务能力；跨 feature 只走公共 index.ts
src/views/                  路由页面编排，不直接调用 bridgeApi
src/components/ui/          无 store/feature/API/report schema 的通用 primitive
src/stores/                 Pinia workspace/session/bridge/history state
src/store/                  dashboard compatibility controller 与状态装配
src/lib/api/                transport、manifest、artifact integrity、SSE
src/i18n/                   双语词典、locale 持久化
src/theme/                  主题状态与 DOM token
src/styles/                 foundation token 与分域 CSS
bridge/api/                 HTTP response/header/CORS/SSE
bridge/contracts/           OpenAPI、JSON Schema、请求校验
bridge/services/            execution 与 Week 7 固定操作
bridge/repositories/        run metadata、artifact manifest、原子写入
bridge/infra/               Git、部署与 runtime identity
```

关键入口：

- 大型 JSON 与 evidence pointer：`src/features/inspect-artifact/`、`src/components/JsonArtifactPanel.vue`
- 分层图表：`src/features/execution-inspector/{model,charts,components}`
- 稳定证据 Pointer：`src/features/execution-inspector/model/evidence-pointers.ts`
- F6B run-bound evidence：`src/features/run-bound-evidence/`（reference、percentile、node、Week 8 summary 已分离）
- F7 presentation：`src/features/f7-analysis/{model,presentation}.ts`
- F8 experiment schema：`src/features/run-experiment/model.ts`、`docs/F8_EXPERIMENT_ORCHESTRATION_AUDIT.md`
- F9 runtime/adaptation：`src/features/evidence-agent/`、`src/lib/api/evidence-agent.ts`、
  `src/stores/evidence-agent.ts`、`src/views/EvidenceAgentView.vue`
- F9 contract/evaluation：`docs/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`、
  `docs/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`、`tests/fixtures/f9-agent-evaluation-cases.json`
- 结构化导出：`src/features/structured-report/`
- Week 7：`src/features/week7-evidence/`、`src/views/Week7EvidenceView.vue`、`bridge/services/week7.py`
- run-bound S9 audit：`src/views/AttributionView.vue`、`src/features/structured-report/model.ts`
- Bridge contract：`bridge/contracts/openapi.json`、`bridge/contracts/schemas/`

依赖规则由 `scripts/check-frontend-dependencies.mjs` 执行。`src/store/dashboard.ts` 仍是兼容 controller，应逐 feature 迁移，不能重新集中业务状态，也不要一次性删除。

## 5. 状态、身份与数据流

```text
Bridge artifact
  -> manifest schema-set revision
  -> artifact SHA-256 + schema identity
  -> versioned adapter
  -> TanStack Query cache
  -> Pinia workspace
  -> feature model
  -> view/component/export
```

- server state 使用 TanStack Query；workspace/session/history/Bridge UI state 使用 Pinia。
- Query identity 保留 run ID、backend identity、`schema_set_revision` 和 artifact SHA-256。
- localStorage 只保存 view、run ID、最多两个 comparison ID、语言和主题；sessionStorage 只保存未确认 submission；报告正文不持久化。
- 快速 run 导航使用 synchronization revision 丢弃旧响应；URL 请求的 run 和已经校验加载的 run 必须分离。
- Week 7 是 backend-global state：query key 包含 backend identity + schema revision，页面导航不得清除当前 run。
- Week 7 三个固定 CLI 操作共享单槽，按 evidence map -> calibration -> orchestration 顺序执行。

## 6. F6B 与 F7 closure

F6B 已完成 manifest v2/raw bytes/SHA/run binding 校验、无损 uint64、后端 P99 subject、S1/并列
S3/S4/S5/S6/S7/S8/S9、Week 8 execution、降级状态、共享选择、深链接、双语/主题/无障碍、live smoke
和 structured report v2。此前唯一剩余的 5 个 Bridge Schema 格式门禁已在获得明确授权后闭合，F6B 状态为
`validated`。完整记录见 `docs/development/F6B_WEEK8_EVIDENCE_2026-08-30.md`。

F7 后端/Bridge 已交付正式 `tilesim.design_space_report.v1` 与 `tilesim.s6_topology_input.v1`。前端现已闭合
Pareto membership/dominance、candidate artifact-record navigation、objective refs、requested/resolved S6 knobs 和
metrics `topology_domain_ref`。所有链接在唯一稳定 ID 匹配后才接受精确 Pointer；duplicate/dangling/wrong
run/schema/subject/Pointer 失败关闭。backend instance 不是 Bridge run，legacy v1alpha1 不声称完整 closure。
正式 F7 live run 已验证 request-bound F6B 链、Pareto/candidate/objective/requested-resolved knob，以及
topology domain → metrics domain 导航；浏览器验收同时覆盖 SHA/Pointer、axe 和桌面 overflow。
详见 `docs/F7_CONTRACT_AUDIT.md`、`docs/development/F7_FABRIC_SLICE_2026-08-30.md` 和
`docs/development/F7_FORMAL_CONTRACT_CLOSURE_2026-08-31.md`。

以下 F6B 目标与验收保留为已实现能力的历史定义。

### 目标与原因

让用户从一个具体 P99/request 或 tail cause 出发，沿正式后端身份定位 S1、并列 S3/S4/S5、S6、S7 execution envelope、S8 validation 和 S9 attribution，而不是在多个页面手工比对。F6A 只证明 backend-global Week 7 workflow 可用，不能替代 run-bound 关联。

### 建议实施批次

1. **契约盘点**：审计 `reports` bundle、execution envelope、validation、metrics、tail 中已有稳定 ID、时间和 pointer；列出可 join、缺失和禁止推断的字段。
2. **run-bound link model**：在 contract/adapter 层定义显式关联和 availability reason；只接受后端 ID、登记 pointer 或确定性 contract 映射，不用时间接近、数组下标或文本相似度拼接。
3. **共享选择状态**：建立 request/cause/evidence selection feature；路由深链接包含 run 和稳定实体 ID，跨 Metrics、Attribution、Execution 导航可恢复。
4. **联动展示**：先做表格/时间窗/证据链，再只为适合的数据选图；tooltip 显示单位、来源和 evidence link，boundary/legacy/unknown schema 明确降级。
5. **导出和回归**：结构化报告保留同一 run-bound link、availability 和原始 pointer；增加 unit/component/desktop E2E、双语 overflow、axe、快速切 run 和损坏证据测试。

### 验收标准

- 一个有完整证据的 P99/request 可从 S9 定位到 S1、并列 S3/S4/S5、S6、S7 和 S8；每一跳都有 run、artifact、SHA-256、pointer 或明确 contract ID。
- S3/S4/S5 的 fan-out/fan-in 在 UI 和数据模型中保持并列。
- boundary、legacy、unknown schema 或缺关联时显示准确原因，不伪造 TTFT/TPOT、空节点或零值。
- backend/global fixture 不混入 run-bound 证据；切 run 后旧选择和旧 query 结果不能泄漏。
- 64 位时间无损，所有换算有单位与原始值；导出与页面字段一致。
- 中英文电脑端无页面横向溢出，键盘、axe、reduced-motion 和 SPA 刷新通过。
- 完整门禁通过，且文档同步更新。

### 非目标

- 不在前端推断因果、重新聚合模拟指标或补造后端 join key。
- 不把 S1/S3 提升为 DES，不把 Cycle 扩成全栈 tier。
- 不在 F6B 接入语言 Agent、任意 shell/HTTP/文件访问。
- 不做移动端适配，也不顺带重写全部 dashboard controller。

如果后端缺少稳定 join key，先形成 contract gap 清单并在后端补齐；不要用脆弱的前端启发式关闭 F6B。

## 7. 保留债务

- 结构化报告仍在主线程同步生成完整 HTML；超大型导出的 Worker/流式生成属于性能硬化债务，不得靠截断记录规避。
- ECharts 异步 chunk 约 527 kB / 179 kB gzip；新增图型前复查适用性和体积，不改成全量 import。
- `src/store/dashboard.ts` 与 `bridge/server.py` 保留兼容 facade/wrapper；只做渐进迁移。
- 后端正式 canonical report schema、真实 calibration assets 和 held-out validation 尚未由前端工作关闭。
- F9 provider 当前正式 unavailable；在 provider 可用并通过 live success/refusal、重复模型 hard gate 与人工 entailment
  review 前，不得把 fixture available-draft 或 contract adaptation 描述为 live validated。

F0-F6A 的阶段过程、性能基线和 review closure 已移到 `docs/development/README.md`，不要把历史测试数或旧路径带回当前文档。

2026-08-31 的前端耦合审计与渐进拆分记录见
`docs/development/FRONTEND_COUPLING_REFACTOR_2026-08-31.md`。
同日的全仓可读性审查、i18n/Bridge 状态分离和 Pointer 统一记录见
`docs/development/FRONTEND_READABILITY_REVIEW_2026-08-31.md`。

## 8. 验证与部署

完整门禁以 `AGENTS.md` 为准。修改 Bridge contract 后执行 `pnpm contracts:generate` 并提交生成结果；普通任务只运行 `pnpm contracts:check`。

当前 5173 是 `D:\tileSim-week8` 的用户服务。只有用户明确授权后才执行任何重新部署：

```powershell
.\scripts\deploy-local-backend.ps1 -SourceRoot D:\tileSim-week8
```

`scripts/update-backend.ps1` 会切换到独立 `D:\tileSim-backend` 的干净 `origin/main` 模式，不能当作无风险的日常检查命令。详细模式见 `README.md`。

## 9. 文档导航

- 当前阶段计划：`docs/FRONTEND_DEVELOPMENT_PLAN.md`
- Week 5/6 run 结果：`docs/WEEK6_RESULTS_UI.md`
- Week 7 backend-global 证据：`docs/WEEK7_EVIDENCE_UI.md`
- 图型与降级：`docs/EXECUTION_VISUALIZATION_DESIGN.md`
- 结构化导出：`docs/STRUCTURED_REPORT_EXPORT.md`
- F9 Agent 契约审计：`docs/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md`
- F9 Agent 评测规格：`docs/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md`
- Bridge contract：`bridge/README.md`
- 历史验证索引：`docs/development/README.md`
- 后端 canonical 架构：`D:\tileSim\AGENTS.md`
