# Phase 2C 派发提示词与验收协议

> 文档 ID：`AO-24`
>
> 类型：实施协议（`proposed`）
>
> 事实日期：2026-09-17
>
> 前置阅读：[23 Phase 2C Web 集成计划](23_PHASE2C_WEB_INTEGRATION_PLAN.md)、
> [15 模块边界与并行开发](15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)、
> [17 开发者 AI 实施手册](17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md)
>
> 用途：指挥方向执行 Agent 派发单个工作包时，直接复制第 3/4 节的提示词；执行方按第 5 节回传；指挥方按第 6 节验收。

## 1. 角色与流程

| 角色                       | 职责                                                                                                     | 禁止                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 指挥方（本仓库审查侧）     | 核对代码事实、定义工作包与写入边界、编写提示词、审查回传、决定是否进入下一批次、独占契约发布与生成物更新 | 未审查通过即推进下一批次             |
| 执行方（另一个开发 Agent） | 在指定写入范围内实施**单个**工作包、运行门禁、按第 5 节回传                                              | 跨工作包改动、注册契约、commit、push |

流程：派发（第 3/4 节）→ 执行方实施并自测 → 回传（第 5 节）→ 指挥方验收（第 6 节）→ 通过则派发下一批次；退回则返工，
返工期间不得开始新批次。

批次划分：

| 批次 | 路由 | 工作包                                                | 依赖                | 状态         |
| ---- | ---- | ----------------------------------------------------- | ------------------- | ------------ |
| 1    | A    | `WP-2C-01a` Bridge Run Intake v2 内核（无 HTTP 端点） | 无                  | 已验收       |
| 1    | B    | `WP-2C-06` clarification answer binding               | 无                  | 已验收       |
| 2    | A    | `WP-2C-01b` 端点注册与契约级联（指挥方 owner）        | 批次 1 A            | 已验收       |
| 2    | B    | `WP-2C-02` 后端 lowering 只读调用（服务层）           | 批次 2 A            | **本次派发** |
| 3    | A    | `WP-2C-02b` 端点接线（前置：表示性缺口关闭）          | 批次 2 B + 缺口关闭 | 待审查后     |
| 3    | B    | `WP-2C-03` / `WP-2C-04` / `WP-2C-05`                  | 批次 2 B            | 待审查后     |

`WP-2C-02` 的范围已在 §4.2.1 收窄为**服务层**：派发前复核发现后端 CLI 的 issue 序列化只输出 5 个必需字段中的 3 个，
端点接线被该表示性缺口阻塞，因此另立 `WP-2C-02b`。

## 2. 派发前公共约束（每个提示词都隐含；执行方必须先读）

### 2.1 schema-set 摘要约束（关键）

`SCHEMA_SET_REVISION` 是对 `bridge/contracts/**/*.json` 全量内容计算的 sha256（`bridge/server.py:134-143`，**含
`proposals/`**）。因此**新增、修改或删除该目录下任何 `.json` 都会改变 schema-set revision**，并由集成 owner 在
契约发布批次中连同生成物一并处理。纯 `.py` 文件（如既有 `validator.py`、新增 `registry.py`）**不**参与该摘要，可安全新增。

已实测（2026-09-17 复核；数值随 WP-2C-01b 契约级联更新）：WP-2C-01b 合入前 live 值为 `sha256:518f4da9…e43ece`，
WP-2C-01b 新增两个 `.json` 后 live 值为 `sha256:d498092a…abffab`。`sha256:3211d2df…c15d` 是固化在
`tests/fixtures/phase1-agent-orchestration/*.json` 里的 **Phase 1 冻结值**，两者本就不相等，且没有任何活跃断言把
live 值钉死。`frozen-current-subset.json` 是历史证据、被测试当作数据消费，不得为对齐 live 而改写。

结论：需要改动契约 JSON 的工作包属于契约发布批次，由单一集成 owner 在独立批次中连同级联一起处理。

### 2.2 本机环境事实

| 事实                                    | 对执行方的影响                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm` 不在 PATH                        | 用等价 node 调用：`node node_modules/vitest/vitest.mjs`、`node node_modules/prettier/bin/prettier.cjs`、`node scripts/*.mjs`；报告中注明实际使用的形式 |
| 无 C++ 工具链，`wsl.exe` 被安全策略阻止 | 不要求运行后端 CTest；但**不得**因此跳过 Bridge 的 Python 门禁                                                                                         |
| 5173 上的 Bridge 由用户掌控，可能未运行 | 测试必须用进程内 handler 或临时端口；不得启动、停止或替换 5173                                                                                         |

### 2.3 既有红灯（不得声称通过）

`python -m unittest bridge/contracts/proposals/agent_orchestration_phase2a/tests/test_phase2a_oracle.py` 在当前 `main`
上为 **6 tests / 1 failed**：`test_current_contract_drift_and_proposal_isolation` 断言 2A proposal 的 identity 不得出现
在正式契约中，而 Phase 2B 发布（`4d7f9fa`）已把 `tilesim.bridge.agent_orchestration_model_profile.v2` 等注册进
`bridge/contracts/openapi.json`。这是 2B 之后的既有失败。

执行方只需要证明**自己没有让它变差**；不得顺手修改该测试或 2A 提案目录（退役提案会改变 schema-set revision，属契约
发布批次）。

## 3. 批次 1 · A 路提示词：`WP-2C-01a`

将下面整段（```text 代码块内）复制给执行 Agent。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的 Bridge 实现 Agent。本次只做工作包 WP-2C-01a，不要扩展到其他工作包，
也不要顺手优化无关代码。

开始前必须完整读取：
1. D:\tileSim-web\AGENTS.md
2. D:\tileSim-web\docs\AI_HANDOFF.md
3. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\23_PHASE2C_WEB_INTEGRATION_PLAN.md（工作包定义与写入边界）
4. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\24_PHASE2C_WORK_PACKAGE_PROMPTS.md 第 2 节（派发前公共约束）
5. bridge/contracts/agent_orchestration_phase2/validator.py、manifest.json、schemas/run-intake.schema.json、
   schemas/idempotency-retention-policy.schema.json
6. bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json、
   ADR-001-run-intake-successor.md、tests/test_phase2a_oracle.py
7. bridge/server.py（端点协调与 SCHEMA_SET_REVISION 计算）、bridge/api/responses.py、
   bridge/contracts/validation.py（RequestValidationError 与 nested_schema_identity 既有模式）、
   bridge/test_server.py（测试风格与既有断言）

任务目标：把已发布的 Run Intake v2 契约接到 Bridge 服务层，提供严格的 identity/revision 解析与兼容矩阵判定。
本批次**不新增 HTTP 端点**，只交付「注册表 + 服务 + 测试 + 建议端点规格」。

必须做的事：
1. 新增 bridge/contracts/agent_orchestration_phase2/registry.py：
   - 复用既有 validator.py 的 validate_contract / IDENTITIES / canonical_digest / ContractValidationError，
     不得复制或改写其校验逻辑，也不得在 registry 里重新实现 JSON Schema 校验；
   - identity 解析：缺失 schema_identity、未知 schema_identity、未知 schema_revision、mixed version payload、
     expected_revision 不匹配，各自返回稳定且可区分的判定结果；
   - 兼容矩阵判定：判定码必须与 bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/
     compatibility-matrix.json 的 12 个 scenario 一一对应（unknown_nested_identity、explicit_migration_required、
     unsupported_contract_identity、missing_contract_identity、unknown_contract_identity、
     unknown_contract_revision、mixed_contract_version、idempotency_payload_mismatch、
     validation_report_stale）。不得发明新码；若认为确需新码，停止并作为阻塞点上报；
   - 幂等与留存：按 idempotency-retention-policy.schema.json 判定 exact replay / payload mismatch（409 语义）、
     forbidden_persistence 集合；不得引入任何持久化写入；
   - 更新 bridge/contracts/agent_orchestration_phase2/__init__.py 的导出（.py 不在 schema-set 摘要内）。
2. 新增 bridge/services/run_intake.py：单一服务入口，只做「校验 + 判定 + typed 结果组装」。
   - 不得导入 bridge/repositories/runs.py；不得写 runs/；不得创建 run；不得触碰 run 生命周期；
   - 结果必须保留后端语义区分：issue 的 code / message / field_path / blocking / safe_next_action 原样透出，
     不得合并、重写或补造；
   - 五类 Profile 记录为空时，组合解析必须返回 fail-closed 结论（profile_missing 语义），不得产生候选或 ranking。
3. 在 bridge/test_server.py 增加测试（unittest，沿用该文件既有风格；直接调用服务/registry，不经 HTTP）：
   - 兼容矩阵 12 个 scenario 全覆盖；
   - Run Intake v2 正例（语义参照 bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/
     run-intake.json，但不得修改该 fixture）；
   - 负例：缺 identity、未知 identity、未知 revision、mixed version、revision 不匹配、payload mismatch；
   - forbidden_persistence 集合校验；
   - Profile binding 缺失/为空时 fail closed。
4. 在回传报告中给出「建议的 HTTP 端点规格」（path、method、请求体 identity、状态码与 error code 映射、
   响应体字段、需要联动的契约文件），但**不要实现端点**，不要改 openapi.json / bridge-api.schema.json / 生成物。

硬边界（违反即退回）：
- 禁止新增、修改或删除 bridge/contracts/ 下任何 .json 文件（会改变 SCHEMA_SET_REVISION 并级联前端 fixture 与文档）；
- 禁止修改任何已发布 identity 或 revision；禁止新增 agent_exposed 字段；
- 禁止修改前端（src/**）；禁止修改 bridge/server.py 的路由；禁止 commit / push / deploy；
- 禁止 reset、clean、stash 或任何覆盖式 checkout；保护工作树中其他 Agent 与用户的改动；
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider；禁止创建正式 run。

完成后运行（本机 pnpm 可能不在 PATH，若不可用请用 node 等价调用并说明用了哪种）：
  cd d:/tileSim-web/bridge && python -m unittest test_server.py
  cd d:/tileSim-web && python -m py_compile bridge/contracts/agent_orchestration_phase2/registry.py \
      bridge/contracts/agent_orchestration_phase2/__init__.py bridge/services/run_intake.py bridge/test_server.py
  cd d:/tileSim-web && python -m unittest bridge/contracts/proposals/agent_orchestration_phase2a/tests/test_phase2a_oracle.py
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && git diff --check

按 AO-24 第 5 节的七节结构回传，并明确回答：SCHEMA_SET_REVISION 是否变化（必须为「否」）、是否新增或修改或删除
bridge/contracts 下 .json（必须为「否」）、是否新增 agent_exposed 字段（否）、是否创建 run（否）、是否触碰 5173
（否）、是否 commit 或 push（否）。
```

## 4. 派发提示词（B 路）

### 4.1 批次 1：`WP-2C-06` 澄清回答绑定

将下面整段（```text 代码块内）复制给执行 Agent。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的前端实现 Agent。本次只做工作包 WP-2C-06（澄清回答绑定），不要碰 Bridge
后端，也不要扩展其他前端功能。

开始前必须完整读取：
1. D:\tileSim-web\AGENTS.md
2. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\23_PHASE2C_WEB_INTEGRATION_PLAN.md（WP-2C-06 定义与写入边界）
3. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md
4. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\14_CONTRACT_GAP_REGISTER.md 中 `GAP-CLARIFY-001` 的条目
5. src/App.vue（尤其 132-187 行的 submitAgentInstruction 与 answerAgentClarification）
6. src/features/agent-intent-compiler/（compiler.ts 的 genericAmbiguity 与 clarificationQuestion、index.ts、
   constants.ts、normalizers.ts）、src/entities/agent-orchestration/phase1-contracts.ts
7. src/features/agent-copilot-shell/AgentTypedBlockList.vue（clarification block 与 answer 事件）、
   AgentCopilotShell.vue、AgentCopilotEntry.vue
8. tests/unit/agent-intent-compiler.test.ts、tests/components/agent-copilot-shell.test.ts（测试风格）

问题（当前事实）：选项按钮已经 emit answer 事件，payload 为
{ question_id, option_id, serialized_value }，并已经冒泡到 src/App.vue 的 answerAgentClarification；但该函数目前只把
状态文案改成「请在输入框中补充选择后重新提交」，**没有回写 compiler 输入，也没有重算草案**，因此选项点击实际无效。

要实现的确定性闭环：
1. 新增绑定模块（建议 src/features/agent-intent-compiler/clarification-binding.ts，并列入该 feature 的
   index.ts 公共导出）：
   - 输入：当前 clarification block 的 question、所选 option、上一次提交的 instruction、capability 投影、
     当前 current_values、locale、context；
   - 必须校验 question_id 属于当前 block，且 option_id 属于该 question 的 options；不匹配时返回显式失败
     （不得静默忽略，也不得伪造草案）；
   - 澄清有两类形态，必须分别处理：
     a) 字段消歧：option_id 形如 field:<field_id>、serialized_value 为 field_id。这类问题不能用 current_values
        表达，必须把所选字段的 canonical alias（复用 feature 内既有别名表）回注到原 instruction 文本后重新编译，
        并保持原 instruction 的其余部分不变；
     b) 值澄清：option_id 形如 option:<field_id>:<n>、serialized_value 为候选值。同样改写该字段自己的 clause
        （`<canonical alias> = <value>`），value_type 与 canonical_unit 必须取自 capability 字段投影，不得猜测类型。
        **本条的初版口径（"通过 current_values 注入"）已由 WP-2C-06 实测推翻，见下方勘误。**
   - 不得修改 src/entities/agent-orchestration/phase1-contracts.ts 或任何 entities 契约类型（IntentCompilerInput、
     ClarificationQuestion 等属共享契约，不在本工作包写入范围内）。若判断必须扩类型才能闭合，停止并作为设计阻塞点
     上报，不要自行扩类型；
   - 不得新增契约、不得新增持久化（localStorage/sessionStorage 一律不得使用）。
2. 更新 src/App.vue 的 answerAgentClarification（**仅**该回调及其紧密相关的最小改动）：
   - 接收 payload，调用绑定模块，重新执行 compileIntent，并用新结果替换侧栏 typed blocks；
   - 重算失败时按现有 formal error block 路径呈现，并保留主工作台状态不变；
   - 旧草案不得被描述为仍有效；若实现选择保留旧 block，必须使用既有 stale 机制，不得自造状态字段。
3. 新增测试（沿用仓库既有 vitest 风格）：
   - 单元测试覆盖两类澄清形态的绑定、question_id/option_id 不匹配的拒绝、重算后旧草案不再有效；
   - 组件或集成测试覆盖「点击选项 → 触发重算 → 侧栏显示更新后的结果」；
   - 修改文案时不得扩大共享 i18n legacy catalog：新英文文案写入 src/i18n/workstreams/。

硬边界（违反即退回）：
- 写入范围仅限 src/features/agent-intent-compiler/**、src/features/agent-copilot-shell/**（若确有必要）、
  src/i18n/workstreams/**、src/App.vue（仅 clarification 回调）；禁止修改 src/store/dashboard.ts、
  其他 feature 内部文件与任何 entities 契约类型；
- 禁止修改 bridge/**、禁止修改任何契约或生成物；禁止 commit / push / deploy；
- 禁止 reset、clean、stash 或覆盖式 checkout；保护工作树中其他 Agent 与用户的改动；
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider；禁止创建正式 run。

完成后运行（本机 pnpm 可能不在 PATH，请用 node 等价调用并说明实际形式）：
  cd d:/tileSim-web && node node_modules/vitest/vitest.mjs run tests/unit tests/components
  cd d:/tileSim-web && node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
  cd d:/tileSim-web && node node_modules/eslint/bin/eslint.js .   （或 node_modules/.bin 下等价入口）
  cd d:/tileSim-web && node node_modules/prettier/bin/prettier.cjs --check "src/**/*.{ts,vue}" "tests/**/*.ts"
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && git diff --check

按 AO-24 第 5 节的七节结构回传，并明确回答：是否修改了任何契约或 entities 类型（必须为「否」）、是否新增持久化
（否）、既有 515 passed / 8 skipped 是否下降（不得下降）、是否触碰 5173（否）、是否 commit 或 push（否）。
```

### 4.1.1 勘误：值澄清不能用 `current_values` 注入（WP-2C-06 实测推翻，已裁决）

AO-24 初版把 B 路值澄清的实现口径写成「必须通过 `current_values` 注入」。执行方实测该口径**不可行**，指挥方复验后
**采纳修正**，本节取代初版措辞：

- `compileIntent` 只在 `compiler.ts:222` 把 `current_values[fieldId]` 透传给 `normalizeCandidate`，而
  `normalizeCandidate`（`normalizers.ts:396-402`）仅在 `fieldId === "s0.workload.message_size_multiplier"` 时把它
  交给 `normalizeMultiplier`；integer（173）、enum（237）、bandwidth（305）、latency（349）四类只从 clause 文本归一。
  此外 `compiler.ts:380-381` 用它做 draft diff 的 baseline，因此把答案写进 `current_values` 反而会命中
  `valuesEqual` 短路，产出 `no_op / values_unchanged`。
- 实测现象：区间指令 + 答案写进 `current_values` → **仍是同一条 `range_requires_single_value` 澄清**（选项不变，
  点击零效果）；否定枚举同理仍返回 `negated_enum_requires_replacement`。
- 裁决：两类澄清形态**统一走 instruction clause 改写**；`current_values` 原样透传，只承担 baseline 角色。
  `tests/unit/agent-clarification-binding.test.ts` 已把该结论钉成回归测试，防止后续再按旧口径"修正"回去。
- 有意保留的语义（非缺陷、已有测试固定）：回答值澄清时，该字段 clause 上原有的区间/否定措辞会被替换为单个显式值
  （`横向扩展时延设置为 1 到 3 us` + 选 3 → `scale-out latency = 3 us`）。选项值一律取自 `option.serialized_value`，
  类型与规范单位取自 capability 字段投影，任何时候都不猜测、不补造。

### 4.2 批次 2：`WP-2C-02`（服务层，不接线端点）

将下面整段（```text 代码块内）复制给执行 Agent。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的 Bridge 实现 Agent。本次只做工作包 WP-2C-02（后端 lowering 只读调用层，
服务层范围），不要扩展到其他工作包，也不要顺手优化无关代码。

开始前必须完整读取：
1. D:\tileSim-web\AGENTS.md、D:\tileSim-web\docs\AI_HANDOFF.md
2. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\23_PHASE2C_WEB_INTEGRATION_PLAN.md（WP-2C-02 定义）
3. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\24_PHASE2C_WORK_PACKAGE_PROMPTS.md 第 2 节与 §4.2.1（本轮范围裁决，
   必须先读完再动手）
4. bridge/services/week7.py（本次要镜像的既有模式：OPERATIONS 固定 argv、Week7ExecutionError 的
   code/message/retryable 三段式、process_runner 注入、45 秒超时、非有限数拒绝、响应契约校验）
5. bridge/services/execution.py（既有 CLI 命令构造与 process_runner 注入点，本次新增能力的落点）
6. bridge/server.py（run_week7_operation 的「CLI 可执行性 → backend identity → 单槽 429」三段式裁决、
   week7_operation_lock、只读预览端点 preview_agent_run_intake）
7. bridge/services/run_intake.py（normalize_backend_issues 的五字段硬约束、preview 返回体组装）
8. bridge/contracts/schemas/agent-orchestration-run-intake-preview-response.schema.json（$defs.backendIssue 的
   required 五字段）
9. bridge/test_server.py（unittest 风格、mock.patch.object 故障注入、week7 单槽容量测试的写法）
10. 后端仓库（**只读，禁止修改**）：D:\tileSim\src\apps\TileSimCLI.cpp:138-157、
    D:\tileSim\src\Core\RunIntakeLowering.cpp:239-257、D:\tileSim\include\Core\RunIntakeLowering.h

任务目标：在 Bridge 服务层建立「只读调用后端 Run Intake v2 校验/lowering」的调用层与其完整失败语义，并把该调用的
**无损性（lossless-ness）结论**作为正式交付物上报。**本包不接线到任何 HTTP 端点**——原因见 §4.2.1 的范围裁决，
必须先读懂那一条再决定实现边界，不要试图"顺手"把 lowering 接进预览端点。

已实测事实（你必须自行复核，不得只照抄；复核结果与下面不符时以你的实测为准并在回传 §6 说明）：
- CLI 入口：`TileSimCLI validate-run-intake --run-intake <json 文件路径>`。`run-intake-preview` 是同一分支上的
  别名，行为完全相同；`--run-intake` 只接受**文件路径**，不接受内联 JSON（TileSimCLI.cpp:138-157）。
- 退出码语义：parse 或 lower 失败 → stdout 打印 issues JSON 且 **exit 1**；成功 → exit 0。
  也就是说 **「exit 1 + stdout 可解析为 JSON」是一个被判定过的结果（judged outcome），不是传输失败**。
  这与 WP-2C-01b 对「被拒判定走 HTTP 200 typed body」的裁决同源，必须同样处理。
- **序列化缺口（本包最重要的发现，必须用证据复核）**：`serialize_run_intake_issues()`
  （D:\tileSim\src\Core\RunIntakeLowering.cpp:253-257）对每个 issue 只输出 `code`、`field_path`、`blocking`
  （且 `blocking` 被硬编码为 `true`），**完全丢弃 `message` 与 `safe_next_action`**；同时
  `RunIntakeLoweringResult` 的三个 lowering 标志（`workload_lowered`、`execution_lowered`、`runtime_available`）
  **没有任何序列化出口**。
  而 Bridge 侧 `run_intake.normalize_backend_issues()` 与已发布契约 `$defs.backendIssue` 都要求 issue 同时携带
  `code`/`message`/`field_path`/`blocking`/`safe_next_action` **五个**字段，且明文禁止补造。
  → 结论：**当前 CLI 的 stdout 无法填充契约的 `backend_issues`**。你不得用任何方式绕过这一点。

必须做的事（全部在 Bridge 服务层；不得新增路由、不得改契约 JSON）：
1. 在 bridge/services/execution.py 新增只读 lowering 调用（建议命名 run_intake_cli_validation，命名可自定，但
   docstring 必须写明「只读、不创建 run、不写 runs/、不做任何持久化」）：
   - 命令构造必须是固定 allow-list：`[str(tilesim_cli), "validate-run-intake", "--run-intake", str(staged)]`。
     **不接受任何来自请求的 argv、路径或参数**；客户端只能提供 intake 内容本身。
   - intake 文档必须先落到**受控临时目录**（`tempfile`，不得落在 `runs/`、`RUNS_ROOT`、仓库工作树或
     D:\tileSim 后端工作树内），并在 `finally` 中删除。写入必须是忠实重序列化
     （`json.dumps(document, ensure_ascii=False)`）：**不得**增删改任何键、不得把 64 位整数 float 化、不得接受
     非有限数（镜像 week7 的 `_reject_nonfinite`）。
   - 单槽：函数必须**强制接收调用方注入的槽对象**（例如 `slot` 参数，类型 `threading.Lock`，不给默认值），并按
     与既有 week7 端点一致的语义使用它：`acquire(blocking=False)` 失败即返回「容量已满」错误（与
     `week7_capacity_reached` 同义），**不得**退化为阻塞等待，**不得**自建一把独立锁。这样后续接线时传入
     `server.week7_operation_lock` 即可与 evidence-map / calibrate / orchestrate **共享同一把 Bridge 单槽**，
     且不改变既有三者的请求顺序。测试必须用真实对象 `server.week7_operation_lock` 验证这一点。
   - subprocess 调用镜像 week7：`cwd=tilesim_root`、`text=True`、`capture_output=True`、`timeout=45`、
     `check=False`，`process_runner` 可注入（默认 `subprocess.run`）。
   - 失败语义必须逐项可分，每项一个稳定 code，沿用 week7 的 code/message/retryable 三段式：
     a) CLI 不存在或不可执行 → `run_intake_cli_unavailable`（retryable=True）
     b) `OSError` → `run_intake_cli_execution_error`（retryable=True）
     c) `TimeoutExpired` → `run_intake_cli_timeout`（retryable=True）
     d) stdout 不是合法 JSON，或含非有限数 → `run_intake_cli_invalid_json`（retryable=False）
     e) exit code 不属于 {0, 1} → `run_intake_cli_unexpected_exit`（retryable=False）：已发布 CLI 契约只定义了
        0（accepted）与 1（blocked），其它退出码不得被猜测解释
     f) exit 0 或 1 且 stdout 可解析 → **不是错误**，返回 typed 结果（见第 2 条）
     g) 解析出的 issues 缺任一必需字段 → `run_intake_cli_issue_not_representable`（retryable=False）：
        **禁止**补造 `message` / `safe_next_action`；**禁止**把 3 字段对象塞进 `backend_issues`；
        **禁止**用 code 反查文案
2. 返回的 typed 结果必须自我说明，且不可能被误当契约类型。建议形如
   `{"operation": "validate-run-intake", "exit_code": <int>, "status": <stdout 原样 status>,
     "issues": <stdout 原样 issues 数组，逐字不重写>, "representable": <bool>,
     "non_representable_reasons": <list[str]>}`。
   `status` 与 `issues` 必须来自 CLI 输出原文：键名不改、值不改、不排序、不补字段、不丢字段；
   `representable` 只有在**每个** issue 都携带五个字段、且 `blocking` 为布尔时才可为 True。
   docstring 必须写明：**该结果不是已发布契约类型**，`representable` 为 False 时不得进入任何契约字段。
3. 在 bridge/test_server.py 增加测试（unittest；直接调用服务并注入 `process_runner`，**不启动 HTTP 服务**）：
   - 上表 a)~g) 各自独立测试，断言 code、retryable，以及「未补造字段」；
   - 「exit 1 + 合法 JSON」必须被断言为 judged outcome（不抛错、不被降级为失败、原始 issues 逐字保留）；
   - 单槽：持锁时调用必须返回容量已满；释放后可正常调用（使用真实的 `server.week7_operation_lock`）；
   - 边界：argv 中只出现 allow-list 的固定元素，staged 路径由 Bridge 生成（用 mock 捕获 argv 断言，
     并断言客户端提供的任何字段都不会出现在 argv 里）；
   - 边界：调用结束后临时目录已删除，`RUNS_ROOT` 下没有新增文件、没有创建 run。
4. 在回传报告 §6/§7 中给出**序列化缺口的复核结论**（含你实测看到的 stdout 样例与退出码）与两条可选出路
   （见 §4.2.1），并明确本包未接线端点。

硬边界（违反即退回）：
- 禁止新增、修改或删除 bridge/contracts/ 下任何 .json（WP-2C-01b 已关闭契约窗口；任何契约 JSON 变更都会改变
  SCHEMA_SET_REVISION）；禁止新增 agent_exposed 字段；禁止改动任何已发布 identity 或 revision；
- 禁止新增或修改任何 HTTP 路由：不改 bridge/server.py 的 do_GET / do_POST，不改 preview_agent_run_intake 的
  现有行为。本包不得产生任何端点行为变化；
- 禁止修改 D:\tileSim（后端仓库）的任何文件，包括它的 serializer 与 CLI；该仓库只读查阅，缺口如实上报；
- 禁止改前端（src/**）；禁止 commit / push / deploy；
- 禁止 reset、clean、stash 或任何覆盖式 checkout；保护工作树中其他 Agent 与用户的改动；
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider；禁止创建 run、禁止写 runs/；
- 禁止把「exit 1」当成传输失败，也禁止把「空的 issues 数组」当作「后端没有问题」呈现。

完成后运行（本机 pnpm 可能不在 PATH，请用 node 等价调用并说明实际形式）：
  cd d:/tileSim-web/bridge && python -m py_compile services/execution.py test_server.py
  cd d:/tileSim-web/bridge && python -m unittest test_server.py
  cd d:/tileSim-web && python -m unittest bridge/contracts/proposals/agent_orchestration_phase2a/tests/test_phase2a_oracle.py
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && node scripts/check-frontend-dependencies.mjs
  cd d:/tileSim-web && node node_modules/vitest/vitest.mjs run        （证明前端基线未回归）
  cd d:/tileSim-web && git diff --check
  git status --porcelain bridge/contracts            （必须无 .json 变化）

按 AO-24 第 5 节的七节结构回传，并明确回答：SCHEMA_SET_REVISION 是否变化（必须为「否」，并给出你实测的
sha256 前缀）、是否新增或修改或删除 bridge/contracts 下 .json（必须为「否」）、是否新增或修改任何 HTTP 路由
（必须为「否」）、是否修改 D:\tileSim 任何文件（必须为「否」）、是否新增 agent_exposed 字段（否）、是否创建 run
（否）、是否触碰 5173（否）、是否 commit 或 push（否）。
```

### 4.2.1 范围裁决：WP-2C-02 不接线端点（指挥方裁决，2026-09-17）

AO-23 §3 给 WP-2C-02 的退出条件里有一条「`execution_ready = false` 时端点返回可用性错误而不是空结果」。派发前
复核后端 CLI 的**实际序列化出口**后发现该条**当前不可实现**，据此把本包范围收窄为服务层：

- `D:\tileSim\src\Core\RunIntakeLowering.cpp:253-257` 的 `serialize_run_intake_issues()` 对每个 issue 只输出
  `code` / `field_path` / `blocking`（`blocking` 被硬编码为 `true`），丢弃 `message` 与 `safe_next_action`；
  `RunIntakeLoweringResult` 的三个 lowering 标志（`workload_lowered` / `execution_lowered` /
  `runtime_available`）在 stdout 上没有任何出口。
- Bridge 侧 `run_intake.normalize_backend_issues()`（`bridge/services/run_intake.py:85-118`）与已发布契约
  `$defs.backendIssue`（`required: [code, message, field_path, blocking, safe_next_action]`）都要求五字段齐备，
  且明文禁止补造。因此**没有任何合法方式**把当前 CLI 的输出放进 `backend_issues`。
- 若强行接线，端点只剩两种可能，两者都不可接受：把 3 字段对象塞进契约（schema 会拒），或在每次已注册 intake 上
  返回 503——后者会推翻已验收的 WP-2C-01b 行为（已注册 intake 返回 HTTP 200 typed body，13 条端点测试钉死）。
- 因此本包只交付**服务层调用与失败语义**，端点接线另立 `WP-2C-02b`，其前置条件是关闭下列表示性缺口之一：

  1. **后端补 serializer（推荐）**：让 `serialize_run_intake_issues()` 输出完整五字段并带上三个 lowering 标志。
     这属 `D:\tileSim` 仓库的独立工作包，需要它自己的门禁与验收，不在本轮派发范围内。
  2. **契约开窗**：新增一份显式的 3 字段投影 Schema 并重新注册端点响应。这会再次改变 `SCHEMA_SET_REVISION`，
     必须由指挥方重新授权契约窗口，执行方不得自行实施（见 §7 退回条件）。

同一缺口也直接阻塞 WP-2C-05 的「三个 lowering 标志分开显示」，应在 2C 收尾时与 `WP-2C-02b` 一并处理。

## 5. 回传格式（执行方必须逐节回答，缺项视为未完成）

1. **工作包与范围**：实现了什么；明确没做什么。
2. **精确 changed files**：新增 / 修改 / 删除的完整路径清单，不得只给统计数字。
3. **关键实现说明**：判定顺序、码表来源、函数签名、与既有模块的接线点（文件:行号）。
4. **门禁结果表**：逐项 `passed` / `failed` / `skipped` / `not-run`，含实际命令与关键输出。
5. **安全与契约副作用**：`SCHEMA_SET_REVISION` 是否变化、是否新增或修改或删除 `bridge/contracts` 下 `.json`、
   是否新增 `agent_exposed` 字段、是否创建 run、是否触碰 5173、是否 commit / push。
6. **已知限制与不确定项**：没做到、没验证或存疑的，如实列出，不得用「应该没问题」代替。
7. **建议的下一步**：A 路附建议端点规格；B 路附遗留缺口。

## 6. 验收清单（指挥方逐项核验）

### 6.1 A 路（`WP-2C-01a`）

| #   | 通过条件                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `registry.py` 复用 `validator.py` 的 `IDENTITIES` / `validate_contract`，未复制一套校验逻辑                                                                                                                                           |
| 2   | 12 个 scenario 全覆盖，判定码与 `compatibility-matrix.json` 完全一致，无自造码                                                                                                                                                        |
| 3   | unknown identity / unknown revision / mixed version / revision 不匹配一律 fail closed                                                                                                                                                 |
| 4   | 幂等与留存判定符合 policy schema，且全链路无持久化写入                                                                                                                                                                                |
| 5   | 服务不导入 `repositories/runs.py`，不写 `runs/`，不创建 run                                                                                                                                                                           |
| 6   | 新测试离线可运行，不依赖 5173 或外部进程                                                                                                                                                                                              |
| 7   | `git status --porcelain bridge/contracts` 无 `.json` 变化；`SCHEMA_SET_REVISION` 不变（以**实测 live 值**为准：01a 批次为 `sha256:518f4da9…`；01b 之后为 `sha256:d498092a…`。`sha256:3211d2df…` 是 Phase 1 冻结值，三者本就互不相等） |
| 8   | 2A oracle 结果仍为 6 tests / 1 failed（未变差）                                                                                                                                                                                       |
| 9   | 无前端改动、无 commit                                                                                                                                                                                                                 |

### 6.2 B 路（`WP-2C-06`）

| #   | 通过条件                                                                                 |
| --- | ---------------------------------------------------------------------------------------- |
| 1   | 选项点击真正回写 compiler 输入并重算，不再只改状态文案                                   |
| 2   | 绑定携带 `question_id` + `option_id` + `serialized_value`，并校验归属；不匹配时显式失败  |
| 3   | 两类澄清形态都有覆盖测试（字段消歧与值澄清均走 instruction clause 回注；见 §4.1.1 勘误） |
| 4   | 未修改任何 entities 契约类型、未新增持久化                                               |
| 5   | 既有前端基线 515 passed / 8 skipped 不下降，新增测试覆盖 answer binding                  |
| 6   | 无 `bridge/**` 改动、无共享 i18n catalog 扩张、无 commit                                 |

### 6.3 B 路（`WP-2C-02`，服务层）

| #   | 通过条件                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 命令 argv 是固定 allow-list，客户端提供的任何字段都不出现在 argv 中（有 mock 捕获 argv 的断言）                                                                       |
| 2   | intake 只落到受控临时目录并在 `finally` 删除；`RUNS_ROOT` 下无新增文件、无 run 创建                                                                                   |
| 3   | 单槽由调用方注入、`acquire(blocking=False)` 失败即返回容量已满；测试用真实 `server.week7_operation_lock` 验证共享，未自建独立锁                                       |
| 4   | `run_intake_cli_unavailable` / `_execution_error` / `_timeout` / `_invalid_json` / `_unexpected_exit` / `_issue_not_representable` 各自有独立测试，retryable 取值正确 |
| 5   | 「exit 1 + 合法 JSON」被断言为 judged outcome：不抛错、原始 `status` 与 `issues` 逐字保留                                                                             |
| 6   | 未补造 `message` / `safe_next_action`，也未把 3 字段对象放进 `backend_issues`                                                                                         |
| 7   | 无新增/修改 HTTP 路由，`preview_agent_run_intake` 行为不变（01b 的 13 条端点测试全部仍通过）                                                                          |
| 8   | `git status --porcelain bridge/contracts` 无 `.json` 变化；`SCHEMA_SET_REVISION` 仍为 `sha256:d498092a…abffab`                                                        |
| 9   | `D:\tileSim` 无任何文件改动；2A oracle 仍为 6 tests / 1 failed（未变差）；Bridge `unittest` ≥ 121 且新增测试全部通过                                                  |
| 10  | 报告 §6/§7 给出了序列化缺口的实测证据与两条可选出路，且明确声明本包未接线端点                                                                                         |

## 7. 退回条件（命中任一即退回，不得进入批次 2）

- 改动 `bridge/contracts/**/*.json`，或改动任何已发布 identity / revision；
- 自造兼容矩阵错误码，或删改 2A 提案与 oracle 测试；
- 创建 run、写 `runs/`、触碰 5173、读取 credential、调用 live Provider；
- 用静态 JSON、产品宣传值或 LLM 常识补造 Profile、calculator 或 validation 结论；
- 补造后端 issue 的 `message` / `safe_next_action`，或把 3 字段 issue 塞进 `backend_issues`；
- 新增或修改 HTTP 路由、修改 `D:\tileSim` 后端仓库、或按「契约开窗」自行改动契约；
- 未运行门禁却声称通过，或把 `failed` / `skipped` 写成 `passed`；
- 跨工作包改动（例如 A 路改前端、B 路改 Bridge），或在退回期间开始新批次。

## 8. 后续批次

- 批次 2 A：`WP-2C-01b` 端点注册与契约级联（指挥方 owner），需同时处理 `SCHEMA_SET_REVISION` 变更、
  `tests/fixtures/phase1-agent-orchestration/*.json` 与文档 revision 声明。
  **状态（2026-09-17）：已交付并验收**（工作树未提交）。新增两个 Schema 与 `POST /api/agent/run-intake-preview`，
  live revision 为 `sha256:d498092a…abffab`；`frozen-current-subset.json` 未被改写；端点级测试 13 条。
  该批次的**契约变更窗口就此关闭**，后续工作包不得再动 `bridge/contracts/**/*.json`。**（2026-09-18 更新：
  该窗口已由指挥方显式重开，本条不再具约束力；此处保留原文作为当时的裁决记录。）**
- 批次 2 B：`WP-2C-02` 后端 lowering 只读调用。**状态（2026-09-17）：提示词已就绪，见 §4.2**；范围已由 §4.2.1
  收窄为服务层（不接线端点），原因是后端 CLI 的 issue 序列化只输出五字段中的三个。
- 批次 3 A：`WP-2C-02b` 端点接线。**前置条件未满足**：必须先关闭 §4.2.1 的表示性缺口。裁决（2026-09-17）：
  该缺口由**独立的后端工作包 `WP-2C-02a`** 关闭（仓库 = `D:\tileSim`，只改后端 serializer 与 CLI 退出码，
  不开契约窗口），提示词见
  [`../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md) §6.3；
  它与展示覆盖度轨道的 `WP-2D-02` **共享同一契约变更窗口但文件集合不相交**，可并行派发。
  后端 3 字段 issue 序列化与三个 lowering 标志出口是本包唯一前置，不再走契约开窗路线。
- 批次 3 B：`WP-2C-03` / `WP-2C-04` / `WP-2C-05`，在 Profile 数据与 Validation Report generator 仍缺失的前提下
  只能是 fail-closed 接收与呈现；`WP-2C-05` 的「三个 lowering 标志分开显示」同样依赖上述缺口关闭。

### 8.1 并行独立轨道：工作台展示覆盖度（`WP-2D-xx`）

与 2C 无关、且在窗口关闭期间不受其约束的一条独立轨道（**2026-09-18 窗口已重开，见 §8.1 表下更新**）：把「已随 run bundle 到达前端、但零渲染」的后端字段
补齐为展示项。需求来源与可直接复制的派发提示词见
[`../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md) §6。

| 批次 | 工作包      | 范围                                                                                                                                      | 前置                                                                                                                       | 状态                                                                                                        |
| ---- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| —    | `WP-2D-01`  | C0 纯前端展示补齐（36 项 + 第 7b 条）＋ 五态语义                                                                                          | 无                                                                                                                         | **已交付并验收（2026-09-18），判定见覆盖度文档 §6.1.1**                                                     |
| —    | `WP-2D-02`  | C1 + C2：采集四个运行期工件 + 把稳定字段写进 Schema                                                                                       | ~~指挥方重开契约窗口~~（**2026-09-18 已重开**）；~~步骤 0 探针~~（**已完成，见 §6.2.1**）；~~`WP-2D-01` 已验收~~（已满足） | **提示词已就绪；三条前置全部满足 → 可派发**                                                                 |
| —    | `WP-2C-02a` | 后端 issue serializer 补全（仓库 `D:\tileSim`）                                                                                           | 与 `WP-2D-02` 同窗口；文件集合不相交                                                                                       | **提示词已就绪，可随窗口并行派发**                                                                          |
| —    | `WP-2D-03`  | C3 输入面：Run Intake v2 编辑入口等                                                                                                       | Profile 数据与后端表示性缺口关闭                                                                                           | 未授权，提示词未写                                                                                          |
| —    | `WP-2D-04`  | 缺陷收口：`DEF-BUSY-RACE-001`（busy 泄漏竞态）＋ 五态语义残留（行级 `cell()` / `LayerRecordTable` / 导出 HTML / `f7-analysis`）           | 无                                                                                                                         | **已交付并验收（2026-09-18）：缺陷关闭，B-1/B-2/B-3 关闭，B-4 判定无需修改；判定见覆盖度文档 §6.4.1**       |
| —    | `WP-2D-05`  | 导出状态列收尾：把 `renderRecords()` 的状态列改为与屏幕同规则（`statusLabel()` + `statusTone()`；未报告 / `unknown` 走共享 `missing` 态） | 无                                                                                                                         | **已交付并验收（2026-09-18，由指挥方直接实施，§6.5.1）：全仓 `>—</td>` 归零，B-2「同文案同 tone」完全达成** |

> **2026-09-18 更新（窗口重开 + 探针完成）**：指挥方已显式重开契约变更窗口，且 `WP-2D-02` 的**步骤 0 只读探针**
> 已完成（结论见覆盖度文档 §6.2.1）。因此本表中 `WP-2D-02` 的「窗口未重开前不得派发」、§8 批次 2A 的
> 「窗口就此关闭」等表述**均不再具约束力**；`WP-2D-02` 与 `WP-2C-02a` 现可**并行派发**（仓库与文件集合不相交）。

> `WP-2C-02a` 虽然编号属 2C 轨道，但其提示词与需求依据落在
> [`../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md) §6.3，
> 因为该缺口是审计阶段发现的（见该文 §4 P3 行）。

`WP-2D-01` 的硬边界与 2C 各批次一致（零 `bridge/contracts/**` 改动、零 `bridge/**/*.py` 改动、零路由改动、
不改后端仓库、不 commit），因此**可与 2C 的批次并行执行**；但两条轨道不得修改同一文件集合。
**该包已于 2026-09-18 交付并验收**：34 个文件（17 新增 / 17 修改，0 删除），`SCHEMA_SET_REVISION` 保持
`sha256:d498092a…abffab` 未变，vitest 580 passed / 8 skipped，Bridge 143 OK。
`WP-2D-02` 是**唯一被授权修改 `bridge/contracts/**/*.json`** 的工作包；它与 `WP-2D-01` 不得并行
（该约束现已无实际意义——2D-01 已完成，C2 的「等 2D-01 验收」前置已满足，只剩窗口重开一条）。

`WP-2D-04` 与 2C 各批次、与 `WP-2D-02` 都**没有文件集合交集**（零契约改动、零 Bridge 改动、不新增 artifact 请求），
因此可与 2C 批次并行派发，且是**唯一被授权改动 `src/store/**`** 的前端工作包（仅限 `dashboard.ts` /
`dashboard-runs.ts` / `dashboard-state.ts` 三个文件）。它不占用 `WP-2D-03` 的编号。

`WP-2D-05` 同样零契约改动、零 Bridge 改动、不新增 artifact 请求，范围**只有 2 个文件**
（`src/features/structured-report/render-html.ts` 的 `renderRecords()` 状态列 +
`tests/unit/structured-report.test.ts`）；它由指挥方直接实施（用户指示「你直接改」），因此**不适用**执行方/指挥方
分离复验，记录方式见覆盖度文档 §6.5.1。该包**不占用** `WP-2D-03` 的编号，也**未**放宽 §6.4.2 中
「① 与 ③ 维持现状」的裁定（包内明确列为「做了即退回」）。

后续批次的提示词在上一批次验收通过后由指挥方补充，不得提前复制使用。
截至 2026-09-18，本表内**已无「可立即派发」的工作包**：剩下的是契约窗口重开（`WP-2D-02` / `WP-2C-02a`）
与 `WP-2D-03` 的前置（结构化输入契约 / Profile 数据）。
