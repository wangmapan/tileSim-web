# Phase 2C Web 集成计划

> 文档 ID：`AO-23`
>
> 类型：实施计划（`proposed`）
>
> 事实日期：2026-09-17
>
> 前置阅读：[当前基线](01_CURRENT_BASELINE_AND_GAPS.md)、[会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)、
> [确定性校验与实验规划](07_DETERMINISTIC_VALIDATION_AND_PLANNING.md)、[交付路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)、
> [契约缺口登记表](14_CONTRACT_GAP_REGISTER.md)、[模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)

## 1. 目标与边界

Phase 2C 的目标是**消除契约层与运行时层之间的断点**：让 Agent 侧生成的 Run Intake v2 能被 Bridge 严格校验、被后端
lowering 消费，并把 typed 结果（issue、binding、receipt、Validation Report）如实显示出来。

它**不是** Profile 数据工作，也**不是** Phase 2 的重新启动。五类正式 Profile records 仍为 `0/unavailable`，因此
Phase 2C 的全部产出在当前数据状态下必然是 fail closed 的——这一点必须在 UI 上如实呈现，而不是用假数据填满界面。

### 1.1 纳入

- Bridge 侧 `tilesim.bridge.agent_orchestration_run_intake.v2` 的严格路由、runtime validator 与兼容矩阵执行；
- 后端 `parse_run_intake_v2` / `lower_run_intake_v2` 的只读调用与 typed issue 透出；
- Profile / Profile Binding / Validation Report / Calculator Receipt 的只读解析与呈现；
- 前端 typed blocks 补齐 `validation_result` 之外由 2B 契约带来的新形态；
- `GAP-CLARIFY-001` 的 answer binding（不依赖新契约的独立小批次）。

### 1.2 不纳入

- 新增任何 `agent_exposed` 字段；
- 真实 model/engine/device/topology/workload Profile record；
- calculator 算法实现、物理 KV lowering、workload template registry、collective/network 累计闭包；
- 由 Agent 直接创建 run、取消 run 或写任何后端状态；
- Conversation/Turn、Approval、Workflow、RAG、跨 run 比较、MCP/A2A。

## 2. 现状：断点在哪里

| 层            | 已就绪                                                                                                                                               | 缺口                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 契约          | `bridge/contracts/agent_orchestration_phase2/` 已发布，manifest 自报 `published`                                                                     | 包内已有 `registry.py`（WP-2C-01a），但 `validator.py` 之外的运行时接线只有只读预览一条                                                                                     |
| Bridge 接线   | `openapi.json`、`schemas/bridge-api.schema.json` 与生成物料已引用该契约；`POST /api/agent/run-intake-preview`（WP-2C-01b）已注册并导入 `registry.py` | **预览端点之外没有 Bridge 路由**：不调用后端 lowering，`/api/runs` 仍只接受 create-run v1                                                                                   |
| 后端 lowering | `parse_run_intake_v2` / `lower_run_intake_v2` 已提交，CLI 提供 `validate-run-intake` / `run-intake-preview`                                          | Bridge 的 execution service 未扩展 allow-list，也没有调用点（属 WP-2C-02）                                                                                                  |
| 前端          | Phase 1 八字段草案侧栏、capability 投影、stale 隔离已可用                                                                                            | typed blocks 只覆盖 7 类，缺 `approval_request`、`operation_progress`、`evidence_result`、`citation`；`App.vue` 的 `answerAgentClarification` 只改状态文案，未回写 compiler |

后端 lowering 的关键语义（来自 `include/Core/RunIntakeLowering.h`）：

- 三态必须分开显示，不得合并：`workload_lowered`、`execution_lowered`、`runtime_available`；
- `RunIntakeIssue` 携带 `code`、`message`、`field_path`、`blocking`、`safe_next_action`，Bridge 与 UI 不得重写、
  合并或补造这些字段；
- 五类 Profile 为空时执行侧 fail closed 是**正确行为**，不是缺陷。

### 2.1 契约摘要约束（派发前必读）

`SCHEMA_SET_REVISION` 是对 `bridge/contracts/**/*.json` 全量内容计算的 sha256（`bridge/server.py:134-143`，**含
`proposals/`**）。因此**新增、修改或删除该目录下任何 `.json` 都会改变 schema-set revision**。纯 `.py` 文件
（`validator.py`、新增的 `registry.py`）不参与该摘要，可安全新增。

已实测事实（2026-09-17 复核；数值随 WP-2C-01b 契约级联更新）：

- WP-2C-01b 合入前的 live 值为 `sha256:518f4da9…e43ece`；WP-2C-01b 新增两个 `.json`（请求/响应 Schema）后
  live 值为 `sha256:d498092a…abffab`（`bridge/contracts` 下 88 个 `.json`，改前 86 个）。`sha256:3211d2df…c15d`
  是 **Phase 1 冻结值**，固化在 `tests/fixtures/phase1-agent-orchestration/*.json` 与（已归档的）AO-20 中，两者本就
  不相等——**没有任何活跃 fixture、断言或代码把 live 值钉死**（`518f4da9` 与 `d498092a` 在全仓 0 命中）。
- 因此 revision 变化的实际级联面 = 重新生成生成物（`pnpm contracts:generate`，含 `src/contracts/generated/**`
  与 Bridge client）＋ 文档中引用 revision 的表述。`frozen-current-subset.json` 是 Phase 1 的历史证据、被测试当作
  **数据**消费，**不得**为对齐 live 而被改写。
- 摘要按**解析后的 JSON**（`sort_keys=True`、`separators=(",",":")`）计算，因此纯空白/格式化调整不改变 revision。

推论：任何需要改动契约 JSON 的工作包都属于契约发布动作，必须由单一集成 owner 在独立批次中连同级联一并处理。

## 3. 工作包

### WP-2C-01a Bridge 侧 Run Intake v2 内核（P0，无依赖，可立即开始）——状态：已交付并验收（工作树未提交）

- 在 `bridge/contracts/agent_orchestration_phase2/` 下补 `registry.py`（`.py` 不参与 schema-set 摘要，可安全新增）：
  identity/revision 解析、`expected_revision` 校验、兼容矩阵判定。判定码**必须**与
  `bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json` 的 12 个 scenario 一一
  对应（`unknown_nested_identity`、`explicit_migration_required`、`unsupported_contract_identity`、
  `missing_contract_identity`、`unknown_contract_identity`、`unknown_contract_revision`、`mixed_contract_version`、
  `idempotency_payload_mismatch`、`validation_report_stale`）；不得发明新码。
- 在 `bridge/services/` 新增单一 Run Intake 服务；错误形态复用既有
  `bridge/api/responses.py::write_error(nested_schema_identity=…)` 与
  `bridge/contracts/validation.py::RequestValidationError` 模式，不新增 error schema。
- **本批不新增 HTTP 端点**：端点注册会改动 `bridge/contracts/openapi.json`，从而改变 `SCHEMA_SET_REVISION` 并级联
  前端 fixture 与文档（见 §2.1），因此只交付「注册表 + 服务 + 测试 + 建议端点规格」，端点注册属 WP-2C-01b。
- **只做校验与预览**：不创建 run、不写 `runs/`、不触碰 `bridge/repositories/runs.py` 的 run 生命周期。
- 退出条件：positive/negative 用例覆盖完整兼容矩阵；未注册 identity 与 unknown revision 一律 fail closed；
  `python -m unittest test_server.py` 通过且 `SCHEMA_SET_REVISION` 未变化。

### WP-2C-01b 端点注册与契约级联（P0，依赖 WP-2C-01a，由单一集成 owner 实施）——状态：已交付并验收（工作树未提交）

- 把 WP-2C-01a 的服务接到 HTTP 面：`bridge/server.py` 只做端点协调，契约注册落在
  `bridge/contracts/openapi.json`、`bridge/contracts/schemas/bridge-api.schema.json` 与生成物料；
- 必须一并处理 schema-set 变更的级联：运行 `pnpm contracts:generate` 重新生成 `src/contracts/generated/**` 与
  Bridge client，并更新 `01`/`README` 中引用 revision 的表述；**不要**改写
  `tests/fixtures/phase1-agent-orchestration/*.json`（Phase 1 冻结证据，见 §2.1）；
- 退出条件：`pnpm contracts:check` 通过且生成物与源一致；级联文件全部同步；不得改变任何已发布 identity 常量或
  per-schema `$id`（派生的 schema-set revision 变化是预期且必须的）。

实际交付（2026-09-17）：

- 新增 `bridge/contracts/schemas/agent-orchestration-run-intake-preview-request.schema.json`
  （`…run_intake_preview_request.v1`，闭包信封，只允许客户端提供 `intake`）与
  `…-response.schema.json`（`…run_intake_preview_response.v1`，逐字镜像 `run_intake.preview()` 输出）；
  两者已加入 `bridge/contracts/schemas/bridge-api.schema.json`；
- `bridge/contracts/openapi.json` 新增 path `/agent/run-intake-preview`（`operationId: previewAgentRunIntake`，
  响应 200/400/503/default）与 `x-tilesim-contract.agent_orchestration_phase2.run_intake_preview` 元数据块；
  包 manifest 新增同名块，`runtime_status = read_only_preview_registered`，包级 `runtime_status` 保持 `contract_only`；
- 服务层新增 `preview_request_payload()`（信封闭包校验）与 `preview_run_intake_request()`（信封 + 判定）；
  `server.py` 新增只做协调的 `preview_agent_run_intake()`；
- 端点级测试 13 条（临时端口，不触碰 5173）：注册一致性、Schema 闭包、词汇表与冻结兼容矩阵一致、
  `idempotency` 恒为 `null`、v1-without-nested 走 `old_client_to_new_server`、被拒判定走 HTTP 200 typed body、
  空 Profile 触发 5×`profile_missing`、契约不可读时 503、以及无 run 创建/无写入边界；
- 级联与门禁：`contracts:check`、`docs:check`、`deps:check`、`vue-tsc --noEmit`、`eslint`、Vitest 535 全绿；
  Bridge `unittest` 121 passed；新 live schema-set revision 为 `sha256:d498092a…abffab`（88 个 `.json`）。

已知遗留（本包不修）：`bridge/contracts/agent_orchestration_phase2/validator.py::_required` 的 `field_path`
拼接在默认 `path="/"` 下会产出 `//device_count` 双斜杠，端点在错误信封中原样透出该既有形态。

### WP-2C-02 后端 lowering 只读调用与 typed issue 透出（P0，依赖 WP-2C-01a + WP-2C-01b）

- 扩展 `bridge/services/execution.py` 的 CLI allow-list，增加 `validate-run-intake --run-intake <json>`；
- **必须遵守 Week 7 的单槽约束**：新增的 CLI 操作与既有 `evidence-map` / `calibrate` / `orchestrate` 共享 Bridge 单槽，
  不得绕过串行化，也不得改变既有三者的请求顺序；
- 把后端原始 issue JSON 原样透出（`code`/`message`/`field_path`/`blocking`/`safe_next_action`），Bridge 只做包装；
- 工具不可用时返回正式的 unavailable 状态，不得降级为"通过"。
- 退出条件：CLI 缺失、超时、非零退出、格式错误各自有独立测试；`execution_ready = false` 时端点返回可用性错误而不是
  空结果。

**范围裁决（2026-09-17，指挥方）：本包收窄为服务层，不接线端点。** 派发前复核后端 CLI 的实际序列化出口发现：

- `D:\tileSim\src\Core\RunIntakeLowering.cpp:253-257` 的 `serialize_run_intake_issues()` 每个 issue 只输出 `code` /
  `field_path` / `blocking`（`blocking` 硬编码 `true`），丢弃 `message` 与 `safe_next_action`；
  `RunIntakeLoweringResult` 的三个 lowering 标志没有任何 stdout 出口；
- Bridge 侧 `run_intake.normalize_backend_issues()` 与已发布契约 `$defs.backendIssue` 都要求五字段齐备且禁止补造，
  因此**没有合法方式**把当前 CLI 输出放进 `backend_issues`；
- 强行接线只会退化为两种不可接受的结果（schema 拒绝，或推翻 WP-2C-01b 已验收的「已注册 intake 返回 HTTP 200
  typed body」行为）。

因此本包的 CLI 退出码语义与 WP-2C-01b 同源：**`exit 1` + stdout 可解析为 JSON = 被判定过的结果**，不是传输失败；
端点接线另立 `WP-2C-02b`，前置条件是关闭表示性缺口（推荐后端补 serializer；契约开窗需指挥方重新授权并级联
`SCHEMA_SET_REVISION`）。同一缺口也阻塞 WP-2C-05 的「三个 lowering 标志分开显示」。派发提示词与验收清单见
[AO-24 §4.2 / §4.2.1 / §6.3](24_PHASE2C_WORK_PACKAGE_PROMPTS.md)。

### WP-2C-03 Profile / Profile Binding 只读解析（P1，依赖 WP-2C-01a）

- 用 `validator.py` 的 `validate_contract` 解析五类 Profile v2 与 Profile Binding v1；
- **不得**在 Bridge 或前端 hardcode H100/模型性能/拓扑参数；
- 五类 records 仍为空时，组合解析必须返回 `unknown/profile_missing` 并阻塞，不得生成候选或 ranking；
- 退出条件：missing、expired、revoked、revision/digest mismatch、calibration missing、execution evidence missing
  六类状态的负例测试全部通过。

### WP-2C-04 Validation Report v1 与 Calculator Receipt Envelope v1 只读接收（P1，依赖 WP-2C-01a）

- 只实现**接收与校验**：Schema 已发布，但后端没有 generator，也没有 calculator 算法；
- schema 校验通过的 receipt 只能以 `contract_only` 呈现，必须有明确文案说明它不来自真实计算；
- 关键 unknown 必须阻塞，不得回退到 LLM 估算或前端公式。
- 退出条件：receipt 的 `algorithm identity/revision`、`units`、`rounding`、`assumptions`、`uncertainty`、
  `rule IDs`、`claim-scope ceiling` 全部按契约原样展示；无 receipt 时显示 unsupported 而不是空态。

### WP-2C-05 前端 typed block 扩展与 fail-closed 呈现（P1，依赖 WP-2C-02）

- `src/features/agent-copilot-shell/AgentTypedBlockList.vue` 按契约新增 intake/validation/receipt 三类展示形态；
- 三个 lowering 标志分开显示，不得把 `workload_lowered = true` 描述成"可执行"；
- blocking issue 必须显示 `safe_next_action`，非 blocking issue 不得被描述为阻塞；
- `execution_ready = false` 时按现有 formal error block 路径呈现，不新增模拟数据。
- 退出条件：component 测试覆盖"合法 intake""identity 缺失""Profile missing""后端不可用"四条路径；无新增 i18n 共享
  catalog 扩张（新文案写入 `src/i18n/workstreams/`）。

### WP-2C-06 clarification answer binding（P1，独立于 2C，可并行）

- `src/App.vue` 的 `answerAgentClarification` 目前只设置状态文案；需要把选项回写到
  `src/features/agent-intent-compiler/` 的 compiler 输入并重算草案；
- binding 必须携带问题 ID 与所选选项，重算后旧 draft 标记 stale；
- 退出条件：`GAP-CLARIFY-001` 的 answer binding 部分有单元测试；无持久化对话历史；不引入新契约。

### 3.1 依赖顺序

```text
WP-2C-01a ──> WP-2C-01b ──> WP-2C-02 ──> WP-2C-05
    ├──> WP-2C-03
    └──> WP-2C-04
WP-2C-06（并行，独立于 2C）
```

## 4. 写入边界与文件所有权

| 范围                | 允许写入                                                                                                                              | 禁止写入                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| WP-2C-01a           | `bridge/contracts/agent_orchestration_phase2/**`（仅 `.py`）、`bridge/services/`（新增文件）、`bridge/test_server.py`                 | `bridge/contracts/**/*.json`、`bridge/server.py`、前端              |
| WP-2C-01b           | `bridge/server.py`、`bridge/contracts/openapi.json`、`bridge/contracts/schemas/**`、`src/contracts/generated/**`、级联 fixture 与文档 | 任何既有 identity/revision                                          |
| WP-2C-02            | `bridge/services/execution.py`、`bridge/test_server.py`                                                                               | `bridge/repositories/runs.py` 的 run 生命周期                       |
| WP-2C-03 / WP-2C-04 | `bridge/services/`、`bridge/contracts/agent_orchestration_phase2/**`                                                                  | 五类 Profile Schema 语义、catalog content                           |
| WP-2C-05            | `src/features/agent-copilot-shell/**`、`src/features/agent-copilot-integration/**`、`src/i18n/workstreams/**`                         | `src/App.vue` 布局、`src/store/dashboard.ts`、其他 feature 内部文件 |
| WP-2C-06            | `src/features/agent-intent-compiler/**`、`src/App.vue`（仅 clarification 回调）                                                       | 正式 contract、其他 feature 的 store                                |

生成物（`src/contracts/generated/**`）由单一集成 owner 更新。WP-2C-01a 阶段**不修改**任何契约身份或 revision；
WP-2C-01b 是唯一被授权的契约变更批次，它已按 `AGENTS.md` 运行 `pnpm contracts:generate` 并同步生成结果，
派生出的 schema-set revision 变化（`sha256:518f4da9…e43ece` → `sha256:d498092a…abffab`）是预期且必须的。
`WP-2C-02` 及之后的工作包**不得**再改动 `bridge/contracts/**/*.json`。

通用硬边界（适用于上表所有工作包）：除 WP-2C-01b 明确列出的契约文件外，**禁止新增、修改或删除
`bridge/contracts/` 下任何 `.json`**（见 §2.1）。工作包拆分、派发提示词与验收协议见
[AO-24 Phase 2C 派发提示词与验收协议](24_PHASE2C_WORK_PACKAGE_PROMPTS.md)。

## 5. 门禁与退出条件

每个工作包完成后至少运行：

```text
pnpm contracts:check
pnpm docs:check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
python -m py_compile <改动触及的 bridge 模块>
python -m unittest test_server.py
git diff --check
```

涉及前端展示变更时追加 `pnpm build` 与 `pnpm test:e2e`（Playwright 使用自带的 Vite fixture，不触碰 5173）。

Phase 2C 整体退出条件：

1. Run Intake v2 在 Bridge 侧有完整兼容矩阵与负例覆盖，unknown identity/revision 全部 fail closed；
2. 后端 lowering 的 typed issue 在 UI 上原样可达，且三个 lowering 标志分开显示；
3. 五类 Profile 为空时，端到端结果是明确的 `unknown/profile_missing`，UI 不产生任何候选或 ranking；
4. **没有**新增 `agent_exposed` 字段，**没有**创建 run，**没有**新增长期持久化的 instruction/raw response；
5. 前端不重算、不补造任何模拟指标。

## 6. 明确禁止

- 用前端静态 JSON、产品宣传名、理论峰值或 LLM 常识填充五类 Profile；
- 把 fixture 或 synthetic consistency 描述成 calibration 或 held-out validation；
- 把 `contract_only` 的 receipt 呈现成真实计算结果；
- 在 Bridge 或前端重新实现后端 lowering 的语义；
- 为让页面"看起来完整"而绕过 fail closed；
- 停止、重启或部署 `127.0.0.1:5173`；读取或输出任何 credential；
- 未授权 commit/push/deploy。

## 7. 依赖与阻塞

| 阻塞项                                    | 影响的工作包             | 解除条件                                               |
| ----------------------------------------- | ------------------------ | ------------------------------------------------------ |
| 五类真实 Profile record 缺失              | WP-2C-03、端到端验收     | 经授权真实数据 + license/source 审核 + lifecycle 证据  |
| calculator 算法与后端领域服务未实现       | WP-2C-04                 | `GAP-CALCULATOR-001` 退出条件                          |
| Validation Report 无后端 generator        | WP-2C-04、WP-2C-05       | `GAP-VALIDATE-001` 退出条件                            |
| 物理 KV / collective / network 累计未闭合 | 执行侧验收               | `GAP-KV-001`、`GAP-NETWORK-001` 等                     |
| 后端工具链不在本机                        | CTest、后端构建门禁      | WSL/CI 环境可用                                        |
| 2A proposal oracle 在当前 `main` 既有失败 | WP-2C-01a 的 oracle 门禁 | 提案退役批次（会改变 schema-set revision，属契约发布） |

上述阻塞不阻止 WP-2C-01a、WP-2C-01b 与 WP-2C-02 的实施——它们只依赖已发布的契约与已提交的 lowering 接口。
2A proposal oracle 的既有失败（`test_current_contract_drift_and_proposal_isolation`，6 tests / 1 failed）是 Phase 2B
发布后的必然结果，执行方只需证明未使其变差，不得自行修改该测试或提案目录。

## 8. 任务提示词

可直接复制的完整派发提示词、回传格式与验收清单见
[AO-24 Phase 2C 派发提示词与验收协议](24_PHASE2C_WORK_PACKAGE_PROMPTS.md)。撰写新提示词时必须遵守：

```text
请在 D:\tileSim-web 实施 Agent 编排模块 <工作包 ID>（见 AO-23 §3 与 AO-24 §1 的批次划分）。

开始前完整读取：AGENTS.md、docs/AI_HANDOFF.md、D:\tileSim\AGENTS.md、
docs/F9_AGENT_ORCHESTRATION/00_GUARDRAILS_AND_GLOSSARY.md、01_CURRENT_BASELINE_AND_GAPS.md、
05_CONVERSATION_AND_DRAFT_CONTRACTS.md、14_CONTRACT_GAP_REGISTER.md、23_PHASE2C_WEB_INTEGRATION_PLAN.md、
24_PHASE2C_WORK_PACKAGE_PROMPTS.md，以及本工作包涉及的 contract、服务和测试。

写入范围严格限定为该工作包在 AO-23 §4 声明的目录。禁止新增、修改或删除 bridge/contracts/ 下任何 .json
（WP-2C-01b 除外）。保护工作树中其他 Agent 与用户的改动，不 reset、clean、覆盖、commit 或 push。不停止、重启或
部署 127.0.0.1:5173，不读取或输出任何 credential，不调用 live Provider，不创建正式 run。

五类正式 Profile records 仍为 0/unavailable，执行侧 fail closed 是正确结果。不得用静态 JSON、产品宣传值或 LLM 常识
补造 Profile、calculator 结果或 validation 结论；不得把 contract_only 的 receipt 呈现为真实计算。

完成后运行 AO-23 §5 列出的门禁，按 AO-24 §5 的七节结构回传，逐项报告 passed/failed/skipped/not-run，并说明
identity/revision 是否变化、是否新增 agent_exposed 字段、是否创建 run、是否触碰 5173。
```
