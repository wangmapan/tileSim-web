# TileSim Web AI Handoff

**事实日期**：2026-09-17（下文历史记录）／2026-09-19（本机实测基线，见「2026-09-19 仓库与基线更正」）

**产品范围**：电脑网页端、local Bridge、版本化契约和 Windows/WSL 本地部署

**当前状态**：Phase 1 全局 Agent 侧栏与八字段本地草案已发布；Phase 2A/2B 契约已正式发布并提交（`4d7f9fa`）；后端 Phase 2C
Run Intake Lowering 已落地，Bridge 侧 Run Intake v2 **只读预览**端点（WP-2C-01a/01b，工作树未提交）已注册但仍未与 lowering
接线；五类 Profile 真实记录仍为 `0/unavailable`，因此 Phase 2 的执行与数据侧仍被阻塞；未部署 5173

## 2026-10-12 S2–S5 Bridge 矩阵与发布门禁剩余问题（第十二阶段，当前工作树）

- 未修改后端仿真计算、S1 attribution 能力或 Bridge 契约。使用仓外当前源码 CLI、临时 Bridge `18372` 和临时 runs，真实验证了 canonical `s2-execution`、`s2-kernel`、`s3-memory`、`s4-device`、`s5-collective` package：均由 CLI inspect 返回 `tilesim.trace_package.v1alpha1`、`synthetic_trace`、`uncalibrated` 后进入 Bridge，HTTP `202`，终态 `completed`。执行包边界分别为 `S2→S6`（execution/kernel）、`S3→S6`、`S4→S6`、`S5→S6`；S2/S5 保留真实 Fabric records（12/5/10 条），S3/S4 无 Fabric records。所有 manifest 为 `tilesim.bridge.artifact_manifest.v2`，run/schema/SHA-256/bytes 身份一致；没有 attribution artifact。
- Bridge 未按 package ID 猜测工件适用性。五个 package 均未请求 runtime 工件；S2/S5 的 metrics、tail-cause-chain、design-space 以带身份的 `expected_absence` descriptor 表达，S3/S4 的后端实际生成 metrics/design-space 保持 `ready`，tail 仍为带原因的 `expected_absence`；受控读取返回 descriptor 而非空事件数组。S2 显式缺少 `trace-kind` 的失败边界由 CLI/Bridge 契约保留，未新增猜测性注册。
- 独立 `4173`（代理临时 Bridge）真实浏览器检查了 1440px 浅色与 1024px 深色的 package 列表、S2/S3/S4/S5 执行页、entry boundary、provenance、fidelity、expected-absence 文案、Fabric 数量及无横向溢出。完整深链/刷新和全部原始证据入口未在本轮逐项复跑，不能写成完全通过；仍需后续浏览器工作包补齐。
- 自动化门禁：Bridge 定向 `python -m unittest test_server.py test_assistant_model.py test_parameter_surface.py` 为 275 tests 通过；全量 discovery 300 tests 中 1 项既有 `contracts.agent_orchestration_phase2.tests.test_registry` 导入 `bridge` 失败，其余通过。Web Vitest `1114 passed / 8 skipped`、contracts、typecheck、lint（0 error/2 既有 warning）、build、docs、deps、diff check 通过；`format:check` 仍被 24 个既有未修改文件阻塞。仓外 Release CTest 定向矩阵在 `PYTHONUTF8=1` 下 `13/13` 通过；默认 Windows 代码页有 3 项 Python 解码失败。全量 CTest 在 `PYTHONUTF8=1` 下 `92%`，剩余为未构建目标、既有资源路径及 RuntimeSwap/NetworkWait/PrefixCache/DenseRank/DevicePlacements 回归，未改仿真逻辑。
- 全量 Playwright 单独运行 `69 passed / 6 skipped / 4 failed / 1 not-run`；4 项均为既有 desktop screenshot drift（synthetic evidence、request evidence、dark evidence、unknown schema），未更新快照；`large-artifact-worker` 的 not-reached 未在本轮出现。结果仍仅属于本地 synthetic hosted、临时 Bridge 和前端集成证据，不代表真实 GPU、Provider、校准、held-out validation 或生产批准。未触碰 `5173`、credential、Provider、用户 run，未提交、推送或部署。

## 2026-10-13 Agent 配置助手与 8 卡扩容安全起点（当前工作树）

### 模型配置上下文补强（当前工作树）

- 配置助手请求现在把实时参数目录作为有界的只读对话上下文发送给已配置 Agent：包含精确 path、当前值、范围/枚举、结构化输入模式和集合字段模板；原始用户句子仍是最后一条消息。该上下文不改变 Bridge 契约，也不构成前端写入授权。
- 普通旋钮页会明确告知模型 `topology/devices`、`runtime_trace/requests`、TP、participants 及其元素尚未发布，并引导用户先启用“用表单配置全部输入”；结构化输入页才暴露实时集合目录。模型返回后仍必须通过 live catalog、引用完整性、范围和原子应用校验。
- 目录上下文按 Bridge 单消息上限裁剪，不发送完整大拓扑；目录外字段继续 fail closed。新增定向单测和 L6 浏览器断言覆盖上下文模式、最后用户消息和不创建 run 的边界。

### 2026-10-13 配置请求统一委托 Agent（当前工作树）

- 配置页的自然语言请求不再经过本地场景关键词或字段名匹配：8 卡、吞吐/延迟描述和显式参数赋值均统一发送给已配置的 Agent 模型。
- 浏览器只对模型返回的结构化方案执行实时参数目录、范围、引用/集合完整性和原子应用校验；模型不可用或方案无法验证时 fail closed，不生成本地 fallback 方案、不写入配置、不创建 run。
- 保留模型返回后的 key 到 live catalog 解析，因为这是拒绝未知字段和保持 JSON Pointer/当前页面边界的校验步骤，不是自然语言兜底。`scenario-profiles.ts` 及本地场景推荐路径已移除。
- schema-set revision、Bridge 契约、后端核心、5173、Provider、credential、用户 run、提交和部署均未触碰。

- 先前登记的 `eight_card_trial` 确定性场景目录已从运行路径移除；“8 卡／8 GPU／八卡”现在由 Agent 根据当前页面目录生成方案。页面仍不会猜测 domains、links、module bindings 或设备分组，方案必须经实时目录和结构化输入约束验证后才能应用。
- 结构化输入面板在设备清单变化后显示明确的 TP/participants 配对选择：同步 TP 与参与设备到新集合、保留原 TP 并从新集合选择参与设备、清空 participants 保留 TP，或稍后处理。配对提示未处理时运行按钮保持禁用，用户明确选择“稍后再说”后才解除；失败的配对编辑不会清除阻塞状态。TP 大于新设备集合时拒绝静默降低，domains/links 仍由真实拓扑编辑器维护。
- Agent 应用拓扑设备数量方案后会切换到结构化输入，并通过同一配对提示继续配置；参数目录仍只发布可验证的集合大小和标量叶字段，不新增 Bridge 字段、不放宽 Schema、不生成虚构拓扑引用。版本化引擎的通用 `batch_scheduler` 继续由画像调度，页面禁用该通用控件并显示提示。
- 本阶段改动集中在 `src/features/run-experiment/`、`src/views/ExperimentView.vue`、结构化输入英文目录及对应单元/组件测试。定向测试 198 passed；全量 Vitest 1123 passed / 8 skipped；`vue-tsc --noEmit`、`pnpm lint`（0 error、2 既有 warning）、`pnpm build`、`contracts:check`、`docs:check`、`deps:check` 和 `git diff --check` 通过。未运行或修改后端核心，未触碰 5173、Provider、credential、用户 run、提交、推送或部署。
- 全仓 `pnpm format:check` 仍报告 24 个既有文件（含历史契约/文档、`scripts/generate-bridge-client.mjs`、预先存在的运行实验文件）；本阶段实际修改文件的 Prettier 检查通过，未进行无关全仓格式化。
- 该能力仍是本地参数草案与结构化输入辅助，不代表 8 卡物理拓扑、真实 GPU、Provider、校准、held-out validation 或生产发布已验证；domains/links、设备能力和后端契约校验仍是最终门槛。

## 2026-10-13 文档整体审查复核（当前工作树）

- 本次复核只更新文档口径，没有修改前端实现、Bridge 契约、生成物或后端仿真。结论范围限定为“前端是否正确暴露和解释当前后端已经提供的能力”；后端尚未实现的 Profile、Run Intake v2 执行、真实 GPU、Provider、校准和 held-out validation 不计为前端对齐缺口。
- 当前已验证的 S0–S5 前后端边界：S0 dense package 可生成并展示 `request_attribution`；S1 runtime package 可展示四类 runtime 工件但在 dense DES 前置不足时不生成 attribution；S2 execution/kernel、S3 memory、S4 device、S5 collective 可通过当前 canonical Bridge package 进入 `completed`，页面展示 CLI 返回的 entry boundary、provenance、fidelity、Fabric 数量和带身份的 `expected_absence`，不把不适用工件解析为空数据。S2–S5 的完整深链、刷新恢复和全部原始证据入口仍属于浏览器复验项，不能写成已完全覆盖。
- 当前身份口径保持不变：canonical schema-set revision 由 `bridge/contracts/schema_set.py` 计算，当前值为 `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`；manifest、run、artifact schema、SHA-256 和 bytes 必须绑定校验；query/cache key 继续包含 run ID、backend identity、schema revision 和 artifact SHA-256。

### 2026-09-28 审查项当前状态

下表是对下方历史登记的当前复核，不改写原始复现记录和当时门禁数字：

| ID                   | 当前状态                             | 当前依据                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT-20260928-001` | **已关闭**                           | `currentGuidanceBundle()` 对配置/准备路由拒绝结果分析授权；`tests/e2e/dashboard.spec.js` 与相关 Agent 测试覆盖配置页说明路径。全局 `runId` 或旧报告不能单独授权结果分析。                                                         |
| `AUDIT-20260928-002` | **已关闭**                           | `src/stores/agent-sessions.ts` 已实现 7 天过期、最多 8 个会话、约 200 KB 总上限、长度限制/redaction、当前会话删除和全部本地会话清理；不保存 credential、hidden reasoning、Provider raw response 或未展示的完整 evidence payload。 |
| `AUDIT-20260928-003` | **环境/部署项开放**                  | 5173 的执行身份一致性仍属于部署验收，不是前端功能对齐项；本轮未停止、重启或替换用户服务。                                                                                                                                         |
| `AUDIT-20260928-004` | **既有 Bridge 测试基础设施问题开放** | 全量 discovery 的 `contracts.agent_orchestration_phase2.tests.test_registry` 导入失败；定向 Bridge 套件通过，未通过排除测试掩盖。                                                                                                 |
| `AUDIT-20260928-005` | **既有格式门禁问题开放**             | 全仓 `format:check` 仍有历史未修改文件失败；本阶段实际改动文件单独检查通过，未进行无关全仓重写。                                                                                                                                  |
| `AUDIT-20260928-006` | **已关闭**                           | `AgentCopilotShell.vue` 使用无 `role="status"` 的单一 `aria-live="polite"` 状态区域；辅助功能测试确认无重复 live region，加载、模型、错误和持久化失败文案可读。                                                                   |
| `AUDIT-20260928-007` | **已关闭**                           | 结果分析进度来自真实 artifact 读取和流式阶段：读取证据及 `X/Y`、整理上下文、等待模型、模型输出、本地证据兜底和失败可重试；相关测试覆盖计数与失败回退。                                                                            |

### 当前发布判断

- 在“只负责前端，后端未实现能力不计入缺口”的范围内，已发布并已验证的前后端能力对齐；S2–S5 的 Bridge package 也已完成本地 synthetic hosted 矩阵。
- 当前不能写成“全部门禁通过”：全仓格式检查仍有既有失败，Bridge 全量 discovery 仍有既有导入错误，全量 CTest 仍有后端/环境回归，全量 E2E 仍有既有截图漂移；这些不应被归因于新的前端参数或证据契约错位。
- 真实 GPU、Provider、校准、held-out validation 和生产部署不属于本地前端对齐结论。临时 Bridge、4173 和仓外 synthetic run 均已按阶段结束后停止；5173、credential、Provider 和用户 run 未操作。

## 2026-10-12 发布门禁分类与 S2–S5 边界复验（第十一阶段，当前工作树）

- 本阶段未改实现、契约或后端仿真。第十阶段的 24 个 `format:check` 失败仍在既有未修改文件；Bridge 全量 discovery 的 `contracts.agent_orchestration_phase2.tests.test_registry` 导入 `FAMILIES` 失败，经检查还依赖当前 registry 已不存在的旧 API，属于 Bridge 内部测试／实现漂移，未通过排除测试或兼容注入掩盖。定向 Bridge 套件 275 tests 通过，全量 300 tests 中仍有 1 个导入错误。
- 全量 CTest 本轮为 86/100 通过；其余分别涉及 Windows 默认代码页的 Python 解码、未构建目标、`docs/examples/dense_timing/topology.json` 资源路径及既有 RuntimeSwap、AutomaticPrefixCache、DenseRankExecution、DevicePlacements 回归。关键定向 11 项通过；Trace package 三项在默认代码页失败、`PYTHONUTF8=1` 下通过。上述后端／测试基础设施问题仍开放，未改仿真计算。
- 当前核心源码提供可执行的 `s2_execution_trace.json`、`s3_memory_trace.json`、`s4_device_trace.json`、`s5_collective_trace.json`：S2 必须显式指定 `--trace-kind execution` 才能成功；S3/S4/S5 CLI 成功并保留 `expected_absence`、`not_covered` 和各自 provenance，不生成运行期工件。独立临时 Bridge `18371` 再次验证 dense S0 attribution `ready`（23,550,124 bytes）、S1 runtime 四工件 `ready` 且无 attribution、重复 request ID intake `422` 且无 run；manifest revision 仍为 `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`。S2–S5 的 Bridge 创建 run／manifest 矩阵本轮未完成，不能以 CLI 成功代替。
- Web 全量 Vitest 1114 passed／8 skipped，contracts、typecheck、lint（0 error／2 既有 warning）、build、docs、deps、diff check 通过。全量 E2E 单独运行 69 passed／6 skipped／4 既有截图差异／1 not-reached；未更新快照，`large-artifact-worker` 单独复跑 1 passed。独立 4173 真实 Bridge 浏览器只检查了 package 列表、dense S0 package 和执行页；完整 1440/1024 浅深主题及 S2–S5 浏览器矩阵未完成，不能算通过。以上仍仅是本地 synthetic hosted 与临时集成证据，不代表 GPU、Provider、校准、held-out 或生产批准；未触碰 5173、credential、用户 run，未提交、推送或部署。

## 2026-10-12 全量门禁与发布候选收口（第十阶段，当前工作树）

- 未修改实现、契约或后端核心。使用仓外 MSVC Release 构建（现有 `tilesim-stage8-build`，CLI 目标构建成功）和临时 Bridge `18370`：`/api/manifest` 返回 canonical `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`，backend identity 与 `24f14ca1b9985e7a1651092d4c472c057ba16c2b` 绑定一致。
- 真实临时 Bridge：dense S0 run 完成并生成 `tilesim.request_attribution.v1`（23,550,124 bytes，manifest/受控读取 SHA、bytes、run/schema/Pointer 一致）；S1 package 返回 202→completed，仅生成适用 runtime 工件且无 attribution；重复 package 保持 intake 阶段 `422 trace_package_inspect_nonzero_exit`、`/trace_package_id`，不创建 run/manifest/artifact；legacy controls run 完成。synthetic 结论仍限 consistency/exploratory。
- 独立 4173（代理 18370）真实浏览器已检查 1440 浅色、1024 深色、S0 attribution、23 MB 工件原始证据虚拟索引、`/requests/0` 深链刷新、S1 package 适用性和不可提交的 invalid package。未触碰 5173、Provider、credential 或用户 run。
- 门禁：Web Vitest `101 files / 1114 passed / 8 skipped`、typecheck、lint（0 error、既有 2 warning）、build、contracts/docs/deps/diff check 通过；`python -m py_compile` 通过。Bridge 全量 discovery `300` 项中 1 项既有 `contracts.agent_orchestration_phase2.tests.test_registry` 导入错误；`format:check` 被既有 24 个文件阻塞。全量 CTest `86/100` 通过，其余为仓外 Windows 默认 GBK 子进程解码、未构建目标、既有资源路径/仿真回归；定向关键 9 项 CTest 通过。全量 E2E 单独运行 `69 passed / 6 skipped / 4 failed / 1 not-run`，4 项均为既有 desktop screenshot drift（未更新快照）。
- 以上仍是本地 synthetic hosted execution、临时 Bridge 和前端验收，不代表真实 GPU、Provider、校准、held-out validation 或生产发布批准。历史阶段数字保持不变。

## 2026-10-11 Bridge intake 失败语义与 S1 归因边界（第九阶段，当前工作树）

- Trace package 在 `POST /api/runs` 创建 run 前必须由当前 `TileSimCLI inspect-trace-package` 重新检查。检查非零是 **intake 阶段拒绝**，canonical HTTP 语义为 `422 trace_package_inspect_nonzero_exit`、字段路径 `/trace_package_id`；不创建 run 目录、不写 run manifest，也不产生逐请求归因工件。该语义与已有 inspect endpoint/OpenAPI 错误信封和回归测试一致，不能改写成 `202 → failed`。
- 实验页将该 422 明确显示为“输入在 intake 阶段被拒绝，尚未创建 run”，保留结构化错误 code/path 和可重试入口；它不显示为运行失败或部分成功。普通运行的 `range_execution_failed` 与执行期归因的 `REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED` 不受影响。
- S1 runtime package 仍只生成运行期工件；逐请求归因继续要求后端真实 DES、dense profile、物理设备/网络/Fabric 证据及唯一 request metric identity。缺少任一前置时保持 `REQUEST_ATTRIBUTION_REQUIRES_DENSE_DES_EVIDENCE`（例如 `/dense_execution/schema_version`）fail-closed，不从 package ID、设备分组或 synthetic trace 推断归因。
- 本阶段只补齐 intake 422 的前端状态与 Bridge 无 run 回归；没有放宽 schema、降低归因前置、修改 Schema revision、触碰 5173、Provider、credential、用户 run、提交、推送或部署。验收仍属于本地 synthetic hosted/临时 Bridge 与前端测试，不是 GPU、Provider、校准、held-out 或生产批准。

## 2026-10-10 运行期证据第五阶段（当前工作树，未提交／未部署）

- 仅对已发布、无 Trace package 的 S1 输入，Bridge 在**同一次**真实 CLI hosted run 中请求 runtime events、summary、request summaries 和 analysis。后端四工件增加各自的 `schema_version` 与 `run_id`，非运行时入口的 `expected_absence` 文件是带身份的描述符而不是空事件数组；manifest 和受控读取分别核对 schema、run、SHA-256、bytes、contract/content 状态。文件未请求、缺失、校验拒绝、未知 schema、正常空数组和执行失败互不代换。Trace package 的入口边界由 CLI 检查，Bridge 不预判并不请求四工件。
- 执行页只在用户点击时读取四工件，每页 25 条后端事件／请求记录；超过 8 MB 改走原始证据查看器的按需索引/虚拟行，不在执行页解析。归因页将逐请求运行记录与真正的逐请求原因链分开；`--request-attribution-out` 在这些轻量 S1 输入上要求 dense DES host，真实 CLI 返回 `REQUEST_ATTRIBUTION_REQUIRES_DENSE_DES_EVIDENCE`，故第五工件**未开放采集**，不伪造原因链。显示级输入/指标关联仍不是事件流，不对共享批次时间做独立资源合计。
- 结果分析证据包仍以当前 run manifest 的验证身份为准，保留读取数量、字节、schema、SHA、contract/content 状态和裁剪说明；超过 8 MB 的单文件不下载进模型上下文，标为 `too_large_for_model_context`，原有全文／结构摘要预算不增加。未调用 Provider。
- 当时 schema-set revision 是 `sha256:41c9f630a5792f136700b8c469f92e8b5961f4ee55d7e652b70d84708d1aa647`，相较第四阶段的 `sha256:3538337ea5dcc9fb88ed213fa9eb177246023d1209b15d625af8f1593d8a72be` 已变化；OpenAPI、Schema 与生成类型/校验器同步，`contracts:check` 通过。当前 revision 以第六阶段条目为准。
- 仓库外 MSVC `/utf-8` 构建及七项定向 CTest 通过；五种 S1 输入的 CLI 原/新采集对照中 metrics、validation、execution envelope 完全一致，主报告只增加四条工件清单记录；合法 S3 对四开关返回 `expected_absence`。独立 18351 Bridge 与 4173 浏览器验证了五种 S1 run、受控文件读取、深链和刷新恢复；定向 fixture E2E 独立通过。均属本地 synthetic consistency/exploratory，不是 GPU、真实推理服务、真实校准、held-out 或生产批准。全量 CTest/E2E 未运行；门禁数字和命令见最终交付报告。

## 2026-10-10 逐请求归因、Trace package 与大工件第六阶段（当前工作树，未提交／未部署）

- 后端在当前执行路径闭合了逐请求归因的 dense DES 前置：请求 DES、dense profile、物理设备拓扑、网络 domains/links、非空且唯一 request metric identity，以及设备/KV、网络/Fabric 完成证据。真实 CLI 对 dense S0 package 生成 `tilesim.request_attribution.v1`；Bridge 仅在 hash-bound S0/S1 runtime entry 且检测到 dense DES 条件时请求该工件。归因 payload 保留后端 request/report/cause identity、subject/evidence refs、JSON Pointer、run/schema 绑定；Bridge 校验 run、外部 metrics identity、唯一引用和 SHA/bytes。非 dense、缺设备/网络、非 DES 均在生成前以稳定错误码和字段路径失败。重复请求目前由 S0 loader 以 `range_execution_failed` 拒绝，尚未提供 attribution 专用字段路径，不能把该项写成已闭合。
- 真实临时 Bridge 18361 已验证：S0/S1 runtime package 请求四类运行期工件；S2/S3/S4/S5 package 不请求不适用工件；dense S0 package 的 attribution `ready`，小工件可控读取；S1 synthetic 输入生成了 9,689,193-byte runtime event trace，manifest bytes/SHA 与受控读取一致。大于 8 MB 的真实事件文件原始证据页建立 Worker 索引（409,601 行、378,092 Pointer）并在刷新后恢复 `/events/0` 深链；执行页不首屏读取大文件。大于 8 MB 的归因页只展示身份和原始证据入口。
- 独立 4173 真实浏览器验证了归因按需读取、请求原因链分页、事件/归因大工件边界，以及浅色/深色 1024/1440 桌面视口；执行页运行期工件按钮只在用户点击时发起读取。结果分析单元验证大工件不调用读取、仅保留 schema/run 外的 artifact 身份、bytes、SHA、`unavailable` 与 `too_large_for_model_context`，未调用 Provider。当前 manifest revision 实测为 `sha256:77cf2fd41db5291e6f4f169cfac37564ad9d4b36a5553ff243fe2b8823ba20e6`；相对第五阶段记录存在漂移，未修改 revision 以掩盖漂移。
- 仓库外 MSVC `/utf-8` 重建并通过 11 项 CTest（第五阶段七项 + attribution/Trace package/WindTunnel）；Bridge `py_compile` 与 189 tests、定向 Vitest、contracts/typecheck/lint/docs/deps/build/diff check 通过。所有证据仍是本地 synthetic hosted execution、临时 Bridge 和前端证据链路；不是真实 GPU、Provider、校准、held-out 或生产批准。全量 CTest、全量 Vitest、全量 E2E 未运行。暂未修改 5173、Provider、credential、用户 run，也未提交、推送或部署。

## 2026-10-10 参数与推理引擎第四阶段（当前工作树，未提交／未部署）

- 仓库外 MSVC `/utf-8` 构建的 `TileSimCLI` 完成七项定向 CTest；本地 synthetic S1 hosted CLI 的 legacy、vLLM、SGLang、TensorRT-LLM 动态请求及显式 vLLM 阶段回放均 exit 0。回放 collective 保留逻辑 request 身份和输入顺序，execution envelope 结构化记录 `runtime_engine_type`、`runtime_engine_semantic_version`、`runtime_input_mode`、`semantic_profile_applied`；Web 在执行页直接从已绑定 envelope 展示，不在主 run-result 或 metrics 顶层补造字段。requested DES 与 resolved fidelity 仍独立。`vllm.0.6.tilesim_pd.v1` 缺分离、特性、dense host、放置、多 rank handoff 或必要 dense profile 时在 Fabric 前以 code/path 失败；Web 仍不发布该版本。
- `CLIHostValidationTest` 的 held-out baseline 断言保留；Windows 测试 CLI cwd 原先是临时 artifact 目录，导致相对默认 baseline 包无法读取，现从后端源根运行并继续将 artifact 放在临时目录。Bridge 真实子进程输出改为 UTF-8 严格解码，异常/缺失输出均收敛到持久化失败终态。独立 4191 默认 cp936 与 4192 `PYTHONUTF8=1` Bridge 的真实 CLI 成功运行已验证；4191 的后端失败 run 记录 exit 1、错误码、stderr 摘要与结束时间。4173 浏览器链路创建、刷新恢复动态及回放 run，非法 KV 的字段路径和辅助技术文本已验证，失败 run 概览显示原因并提供返回配置入口。所有临时 runs 均在仓库外，未触碰 5173。
- 以上只是本地 synthetic hosted execution 与临时 Bridge/浏览器集成，不是 GPU、真实推理服务、Provider、真实校准、独立 held-out 验证或生产发布批准。尚未执行全量 CTest 与全量 E2E；完整验收命令和门禁结果以本阶段最终报告为准。

## 2026-10-09 前后端参数对齐第二阶段（当前工作树，未提交／未部署）

- 受控 `custom_inputs` 修正三项正数运行 policy、`kv_admission_watermark` 的开区间下界、小拓 `run_name` 80 字符上限。后端运行入口对 synthetic runtime provenance 只支持 `synthetic_trace/uncalibrated/exploratory`，该 tuple 在 runtime Schema 与 Bridge 校验收紧；拓扑 workload 同时提供 bytes/MB 时后端优先 bytes，为避免歧义输入现要求只选一项。独立的 design-space v1、拓扑 provenance 口径未据此升级或改动。
- 受控 S1 runtime trace 可选择 `legacy_generic/legacy_generic.v1`（省略字段仍是默认）、`vllm.0.6.semantic.v1`、`sglang.0.4.semantic.v1`、`tensorrt_llm.0.12.semantic.v1`。仅发布无高级前置的调度特性子集；`phase=request` 必须显式填请求、正数容量、足额 KV、有效 TP/参与设备且设备存在于拓扑；版本化 prefill/decode 为按序回放，不与动态请求混用。表单不隐式转换阶段；小拓不提供引擎版本、特性数组或 phase 标量编辑，动态模式错误整批回滚。通用调度提示与版本化画像调度提示分离；请求 DES 与报告 resolved fidelity 仍分别显示。
- `vllm.0.6.tilesim_pd.v1`、service-time、swap、chunk、PD 分离、prefix、MoE、逐阶段通信、GPU-in-loop、真实 Trace、Cycle、Run Intake v2 均**未开放**。PD 需要完整放置、handoff 和 dense host；其余须单独闭合来源、引用、物理 host 与失败语义。版本化画像只是仿真语义，不启动真实推理服务；本轮只有 fixture／单元级合成一致性，非真实 Provider、校准或留出验证。
- 测试：定向 Vitest 110 passed；Bridge 相关套件与 400／不创建 run 检查通过；定向 fixture E2E 2 passed；contracts check、typecheck、lint（0 error、既有 2 warning）、build 通过。后端 C++ 未构建／CTest 未运行，Web 的 `/api/runs` 三画像测试只证实 Bridge intake，执行由 mock 截断，不能声称后端真实执行验收。5173、核心仓库、用户 runs 和 credential 均未操作。

## 2026-10-09 小拓全页面参数方案路由（工作树，未部署）

- 配置页首轮点名字段、但没有明确 `路径 = 值` 的方案请求，现在优先走已有的完整页面参数目录与配置模型；“运行参数：batch size、最大活动请求数、KV 容量、调度策略”中的冒号不再被误认成确定性赋值。只问页面用途/指标的句子仍走页面说明，明确赋值仍由本地目录确定性校验；冻结的八字段 Phase 1 compiler 与正式 `agent_exposed` 发布集合未更改。
- 模型方案继续按当前页面目录逐项验证，用户明确排除的设备数量、TP 或现有拓扑元素若仍出现在模型提案中，整份方案禁止应用；用户确认前不写表单。页面没有打开结构化输入时，未发布的元素路径不能凭模型建议被写入。模型不可用时，涉及扩展字段的自然语言请求给出重试或完整路径赋值提示，不再把页面可编辑字段误报为正式能力不支持。TP 与参与设备、拓扑引用和缺失 links/domains 仍按现有原子回滚/不完整方案规则阻止误用。
- 定向单元与浏览器夹具覆盖四个运行旋钮的一次方案生成及确认写入；5173 正在使用，本批不替换、不部署，真实 Provider 的新路由行为仍待用户通过正常部署流程验证。

## 2026-09-28 小拓结果分析模型接入（工作树，未部署）

- 结果分析新增独立只读模型通道 `POST /api/agent/result-analysis`，与配置/方案通道分离；模型不可用、超时或响应不完整时，前端继续使用确定性的本地结果整理，不创建运行、不修改配置、不写回报告。
- 发送给模型的不是单独三段摘要：当前 run 的 artifact manifest 会逐一经过既有 run、schema、bytes、SHA-256 校验路径读取。每个 artifact 都保留 `artifact_id`、schema、SHA-256、字节数、contract 状态和内容覆盖状态；rejected artifact 也会显式保留。
- 小文件全文进入上下文；单文件超过 12,000 字符或总证据超过 150,000 字符时降为结构摘要，验证失败标记为 `unavailable`，`not_applicable` 与 rejected 不会被伪装成已读全文。模型提示词必须报告这些覆盖事实，不能声称分析了所有证据文件。
- 已补充前端 evidence-pack、Bridge 校验、OpenAPI/生成类型、流式 API 与单元/端点测试。当前验证：Vitest **1077 passed / 8 skipped（96 files）**、Bridge **262 passed**、`contracts:check`、`docs:check`、`deps:check`、`vue-tsc --noEmit`、ESLint、`vite build`、`git diff --check` 通过；未部署 5173、未执行真实 Provider 调用。

## 2026-09-28 小拓本地会话管理（工作树，未部署）

- 助手对话已从 `App.vue` 的临时 ref 移入独立 Pinia store `src/stores/agent-sessions.ts`，使用版本化 `localStorage` 恢复多个会话；侧栏提供新建、切换和删除，会话标题从第一条用户消息生成。
- 每个会话独立保存已展示的用户/助手 transcript、typed blocks、创建/更新时间、页面 context revision，以及澄清重算所需的最近指令和 capability projection。切换会话不会执行方案或修改页面；context revision 不匹配时继续按既有 stale 规则拒绝旧草案/标记旧内容。
- 本地持久化是明确标注的有限期、可删除会话缓存：最多 8 个会话、7 天无活动后过期、总大小约 200 KB，超限按最近更新时间清理。只接受经过长度限制的可见 typed block 和 redacted 可见消息，不保存 credential、hidden reasoning、Provider raw response、未展示的完整 evidence payload 或任何运行操作；Bridge 仍不持久化 transcript。这是前端重启恢复能力，不冒充正式的服务端 Conversation/Turn store，侧栏提供当前会话删除与清理全部本地会话入口。
- 本批补充 `tests/unit/agent-sessions.test.ts`，覆盖跨 Pinia 实例恢复、会话隔离和删除最后会话后的兜底会话。当前工作树尚未部署 5173、提交或推送。

## 2026-09-28 整体审查登记（历史登记；当前状态见 2026-10-13 复核）

本轮只读审查覆盖：当前未提交工作树、前端静态门禁、Bridge Python 门禁、5173 健康状态、4173 真实浏览器路由/主题/窄桌面、助手模型结果分析、localStorage 会话恢复和 Axe 检查。除本节文档登记外未修改实现、未重启或替换 5173、未提交。

| ID                   | 优先级 | 状态         | 复现与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 影响                                                                                                                                                   |
| -------------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUDIT-20260928-001` | P1     | **开放**     | `tests/e2e/dashboard.spec.js:54-79` 在当前工作树失败：进入 `/experiment` 且工作区已有一个真实 run 后，提交“说明当前页面能做什么”，期望页面说明“这里可以核对当前实验参数”，实际被 `src/App.vue:1056-1057` 的 `resultQuestion` 路由到结果分析，展示运行结果摘要并调用/回退结果分析模型。根因迹象是 `currentGuidanceBundle()`（`src/App.vue:699`）只校验 run/report 身份，没有限制结果分析只能发生在结果/只读页面。                                                                                                                            | 实验配置页的解释问题会污染为结果分析；模型不可用时仍显示当前 run 的结果，导致配置页行为和既有 Phase 1 合同回归。                                       |
| `AUDIT-20260928-002` | P1     | **开放**     | `src/stores/agent-sessions.ts:147-217` 将完整可见用户消息、助手消息和 typed blocks 长期写入 `localStorage`；没有 retention/expiry/consent/redaction/export 记录或时间边界，只有删除当前会话。与 `docs/features/lightweight-workbench/SECURITY_RETENTION_AND_FAILURE_SEMANTICS.md:12-16,39-41`、`docs/F9_AGENT_ORCHESTRATION/00_GUARDRAILS_AND_GLOSSARY.md:145-156`、`docs/F9_AGENT_ORCHESTRATION/05_CONVERSATION_AND_DRAFT_CONTRACTS.md:16,199-230` 的“不得保存完整对话/不得把 localStorage 当正式 conversation store/先发布留存契约”冲突。 | 用户问题和模型整理结果可能在本机浏览器永久留存；多会话数量和 block 体积也没有总上限。现有 2026-09-28 会话说明中“不会保存完整对话”的表述与实现不一致。  |
| `AUDIT-20260928-003` | P1     | **环境阻塞** | 当前 `http://127.0.0.1:5173/api/health` 返回 `execution_ready=false`、`state_digests_match=false`、`versions_match=false`，`deployment_mode=local_worktree_snapshot`；实测 `source_revision=cb2cd0bdef2a88e9ac5756ac5e739dc1495fb18d`，`build_revision=ba11e6fdb69af046dc7597e5ef5732cce029cfbe`。                                                                                                                                                                                                                                          | 当前 5173 服务不能作为可执行实验后端；页面可浏览、模型 descriptor/catalogue 可读，但提交运行应继续被阻止。需要通过既有部署流程恢复一致性，本轮未执行。 |
| `AUDIT-20260928-004` | P2     | **开放**     | 在 `D:\tileSim-web\bridge` 执行 `python -m unittest`，共发现 278 项但 `contracts.agent_orchestration_phase2.tests.test_registry` 导入失败：`ModuleNotFoundError: No module named 'bridge'`；其余测试完成。按仓库规定的定向 `python -m unittest test_server.py` 门禁可通过，故这是 discovery/包路径问题，不等同于 Bridge 业务失败。                                                                                                                                                                                                          | 全量 Bridge discovery 不能作为可靠绿灯；不同入口会得到不同结果。                                                                                       |
| `AUDIT-20260928-005` | P2     | **开放**     | `pnpm format:check` 失败，报告 26 个文件不符合 Prettier；其中包含当前改动涉及的 `src/App.vue`、`scripts/generate-bridge-client.mjs`、`docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md`、`docs/features/lightweight-workbench/AGENT_INTEGRATION_BOUNDARY.md`，以及多份契约/文档 JSON。`pnpm lint` 无 error，但有 2 条既有 `vue/one-component-per-file` warning。                                                                                                                                                            | 当前工作树不能通过完整格式门禁；是否全部由本批引入尚未拆分。                                                                                           |
| `AUDIT-20260928-006` | P2     | **开放**     | 对已打开的 `#tilesim-agent-copilot` 执行 Axe 4.13，发现 `aria-allowed-role` minor violation：`src/features/agent-copilot-shell/AgentCopilotShell.vue:413` 的 `<footer role="status" aria-live="polite">` 被判定为该元素不允许使用 `status` role。概览页面本身 Axe 无 violation。                                                                                                                                                                                                                                                            | 助手状态播报的语义角色不符合当前无障碍检查规则，可能影响辅助技术识别；不阻塞普通鼠标操作。                                                             |
| `AUDIT-20260928-007` | P2     | **待优化**   | 真实 run `run-20260923-164653-94a0e483` 的结果分析会先并发读取 manifest 中 9 个 artifact（包含约 1.2 MB 的 `metrics.json`），证据打包完成后才开始 SSE；期间只显示空的流式回答/“正在分析”状态，没有已读取数量、等待阶段或超时进度。当前一次浏览器调用最终返回 200，模型回答正确，未判定为功能失败。                                                                                                                                                                                                                                          | 大 artifact 或 Provider 较慢时用户无法区分“仍在读取证据”“等待模型”和“已卡住”，会误以为助手没有调用模型。                                               |

### 审查门禁摘要

- 前端 Vitest：**1081 passed / 8 skipped（97 files）**；`vue-tsc --noEmit`、`pnpm build`、`contracts:check`、`docs:check`、`deps:check`、`git diff --check` 通过。
- `pnpm lint`：0 error、2 warning；`pnpm format:check`：失败（26 files，见 `AUDIT-20260928-005`）。
- 全量 Playwright（本轮实际报告）：**69 passed / 6 skipped / 1 failed / 1 not run（77 tests）**；唯一失败是 `AUDIT-20260928-001`，其依赖项目导致 large-artifact-worker 本轮未覆盖。6 条 live Week 8 用例按环境条件跳过。
- 4173 浏览器只读巡检：专业与轻量主要路由均返回 200；1440/1024 宽度未发现横向溢出；概览 Axe 无 violation；助手侧栏有 `AUDIT-20260928-006`。
- `api.yhchj.com/ip` 在仓库源码中无引用，本轮登记为外部浏览器请求，未归因于 TileSim。

## 2026-09-24 专业原始证据入口（工作树，未部署）

- 专业导航以「原始证据」替代独立「AI 解释」入口；小拓仍是常用的结果分析与教学入口。旧 `/evidence-agent` 页面暂保留为深链兼容，不再出现在主导航，原 Evidence Agent 契约与历史记录未删除或改写。
- 完整 JSON 查看器从执行过程页移到独立 `/raw-evidence`，保留按需索引、搜索、复制、原始文件、manifest/SHA-256/JSON Pointer 校验；从图表和字段点击原始证据直接进入该页。旧 `/execution?...evidence_*` URL 保留查询参数并转向新入口；普通 `/execution` 不变。
- 本轮只改变页面归属和链接，不补造报告值、不改变证据身份与 Bridge 读取路径。工作树有其他未提交改动，本批未部署 5173、未提交或推送。
- 本批回归：Vitest **1070 passed / 8 skipped（95 files）**；`contracts:check`、`docs:check`、`deps:check`、`typecheck`、`lint`（2 条 warning）、`build`、`git diff --check` 通过。证据深链/失配/缺失、独立入口、帮助目录的定向 Playwright **6 passed**；执行页浅色快照及深色快照按页面归属变化重录。全仓 `format:check` 仍因其他既有/并行文件不合规而失败，本批文件单独检查通过。深色执行页旧用例的执行页快照已通过，但继续到实验配置页时检测到对比度违例（不在本批证据页范围，尚未归因）；全量 E2E 未跑。

## 2026-09-23 小拓引导与结果教学（工作树，未部署）

- 侧栏空会话询问「配置实验／分析实验结果／学习怎么看结果」。配置入口进入当前工作台的实验配置页；轻量工作台首页若带当前 run，分析入口先导航到该 run 的结果页，待报告载入后自动整理。教学解释 TTFT、TPOT、P99、吞吐与证据可信范围。自然语言的结果分析和教学问题也走这条只读路径，不创建运行、不写配置、不调用模型 Provider。
- 分析守卫核对路由 run、报告 run 与 artifact manifest 身份，轻量与专业工作台分别读取各自 store；拒绝内置示例、旧 run、schema 不支持或不匹配的报告。只引用报告已有值与后端瓶颈/原因/下一步原文，缺失值不补零、不将验证完整度视为准确率，也不将合成一致性视为真实验证。本地字段路径是报告内定位提示，不冒充正式 Evidence Agent citation。
- 用户可在结果载入后重新提问；现有对话随页面上下文变化按原规则标记过期。此节仅说明本地工作树，尚未部署到 5173。

## 2026-09-24 前端视觉收口（工作树，未部署）

- 轻量工作台首页补充三步实验流程（配置、运行观察、结果分析），空状态与最近运行卡片共享同一层级和进入动效；运行中状态点增加低频脉冲，尊重 `prefers-reduced-motion`。
- 全局交互补充独立的 `--motion-interaction` 时长，按钮、卡片、导航和小拓侧栏的悬停/开合反馈不再依赖门禁用的颜色过渡时长；专业工作台的结构与证据语义未改变。
- 本轮只做表现层改动，未新增模拟数据、图表或美术素材；已检查浅色/深色、助手侧栏和窄桌面路径。当前工作树仍未部署到 5173。

### 2026-09-24 专业工作台状态组件视觉收口（工作树，未部署）

- 证据范围提示、演示数据提示、状态标签与 `AvailabilityBadge` 统一为带语义边轨、层级文字和轻量入场/悬停反馈的状态组件；服务告警、范围说明和运行范围提示采用同一组边框/阴影节奏。小拓输入区补充桌面端式聚焦、提交与停止反馈。
- 具体时长使用独立 `--motion-interaction`，不改变 `--motion-fast` / `--motion-base` 的 0ms 约束；所有新增动画在 `prefers-reduced-motion` 下压平。未改变报告字段、证据语义、数据来源或运行流程；未生成额外插画素材（这些组件的视觉任务是语义状态表达，不需要装饰性图像）。
- 本轮验证：Vitest **1070 passed / 8 skipped（95 files）**、`vue-tsc --noEmit`、`vite build`、`git diff --check` 通过；定向 dashboard motion/P99 与 L6 小拓引导/轻量闭环 E2E **4 passed**。未部署 5173，未执行 run、Provider、commit 或 push。

### 2026-09-24 专业概览宽屏布局与结论区（工作树，未部署）

- 宽屏主容器由居中 1560px 改为侧栏后左对齐、最多 1760px（含左右内边距）。2166px 实测：内容起点 x=439 → x=240，内容宽 1496px → 1696px；1100px 窄桌面和宽屏小拓停靠态均未出现文档横向溢出。
- 概览「后端结论」由重复技术字段标题改为单一中文标题，`cause` 与 `next_action` 仍作为后端原文字段逐行显示；缺失 badge 与其说明保持不变。不改报告、证据状态或指标计算。
- 门禁：`vue-tsc --noEmit`、改动文件 ESLint/Prettier、`vite build`、`docs:check`、`deps:check`、`git diff --check` 通过；定向 Vitest **54 passed**；概览首屏与 reduced-motion E2E **2 passed**。深色外观 E2E 的可访问性/溢出断言已通过，但旧的 execution 全页图片快照在 1440px 下尺寸 1898 → 1906、像素差异 4% 而失败；该用例并非概览页，本轮未改写既有快照。4173 仅作独立视觉检查，未触碰 5173；未部署、commit 或 push。

## 2026-09-19 仓库与基线更正（**优先于下文所有 revision 与测试数字**）

本节由 2026-09-19 的盘点、文档修正与推送处置得出，未改动任何代码、契约或运行态。**下文所有 `HEAD`/revision 表述与门禁数字均为历史记录，读取时以本节为准。**

### git 真实状态与推送处置（2026-09-19）

- **推送已完成**：修复前本地是一条与远端**无共同祖先**的孤儿线（`c303ac2` → `11cef6b`），直接推送会被
  `non-fast-forward` 拒绝。处置方式是**把重建线以新提交接回 `origin/main` 主线**，全程快进、**未使用 `force`**：
  - `515e39d` `chore(recovery): reintroduce locally rebuilt work tree onto origin/main` —— 树 = 原 `11cef6b` 的树，**逐字节相同**；
  - `7c477d1` `docs(handoff): correct stale revision refs and drop leftover conflict markers`；
  - 结果：`origin/main` 由 `4d7f9fa` **快进**到 `7c477d1`，随后本节所在的文档修正提交继续追加在其后；
    历史始终是一条直线，**未使用 `force`**。
- **重建线的原始提交未丢**：`11cef6b`（含其父 `c303ac2`）已作为远端分支 `recovery/orphan-main-11cef6b` 推送保留，
  因此在远端**仍可解析、仍可追溯**。
- 接回前已核验差异（相对 `4d7f9fa`）：**100 新增 / 78 修改 / 4 改名 / 0 删除**，`+26033 / −597`；
  删除行均为有意改动，**无换行符污染**（`.gitattributes` = `* text=auto eol=lf`）。工作区文件零丢失，
  接回前后 `git status` 均为 clean、工作区内容未发生任何变化。
- **历史事故本身（背景，2026-09-18）**：本机 `.git` 对象库被外部清空。**已发布的远端历史未受损**
  （`4d7f9fa` 一直可解析，其树含 636 个受跟踪文件）。**永久丢失且不可恢复**的是当时尚未推送的 3 个本地提交
  `446f21d` / `290d1c8` / `9b2d39b`：已实测救援目录 `C:\Users\mapanwang\_tilesim_rescue`，
  `tilesim-web-backup.git` 只含 `refs/heads/main = 11cef6b`（恢复之后才建立的镜像）、`dotgit_backup/.git` 不含任何 ref，
  **两处备份都没有这三个提交**。这三个提交的**内容**已随工作区快照一并进入远端，只有提交边界与提交信息不可恢复。
- `git worktree list` 现只剩 `D:/tileSim-web`；其余 `origin/codex/*` 分支引用仍在。
- 后端仓库 `D:\tileSim` 未见同类问题（本地领先其 `origin/main` 2 个提交、有共同祖先）；**本轮未推送后端**。

### 文档卫生

- 本文件此前残留两个合并冲突标记（`>>>>>>> Stashed changes` 与 `<<<<<<< Updated upstream`），已随本节同一批次清除；
  它们也是本文件唯一的 prettier 不合规来源。紧随本节的「双工作台方案状态」与「Phase 2D handoff」两节来自当时的
  stash 侧内容，属**历史阶段记录**。
- 以下文件引用了**已不可解析**的提交号 `446f21d` / `290d1c8` / `9b2d39b`，应作为历史证据阅读，**不要**用它们做
  `git` 定位：本文件、`AGENTS.md`、`docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`、
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`、`docs/F9_AGENT_ORCHESTRATION/` 下的 `01`、`12`、
  `14`、`24` 与 `README.md`，以及 `docs/archive/agent-orchestration/phase-records/` 下的 `21`、`22`。
  其中 `4d7f9fa`（`origin/main` 在 2026-09-19 之前的位置）与 `11cef6b`（恢复线）**仍可解析**，可以照常使用。

### 2026-09-19 实测门禁（本机，工作树 clean；测量点在重建线上，接回 `origin/main` 只新增文档改动，未触碰代码与契约）

| 门禁                                              | 实测                                                                                                               | 本文下文历史值                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Web Vitest（`vitest run`）                        | **721 passed / 8 skipped，79 files**                                                                               | 596 / 8，70 files                                     |
| Bridge `python -m unittest test_server.py`        | **Ran 143 tests / OK，exit 0**                                                                                     | 143（一致）                                           |
| `generate-contract-types.mjs --check`             | exit 0                                                                                                             | —                                                     |
| `generate-bridge-client.mjs --check`              | exit 0（既有 `unknown format "date-time"` 为提示，非错误）                                                         | —                                                     |
| `check-doc-links.mjs`（`docs:check`）             | exit 0，**62 篇活跃 Markdown**                                                                                     | 43 篇                                                 |
| `check-frontend-dependencies.mjs`（`deps:check`） | exit 0，**290 源文件**                                                                                             | 255                                                   |
| `vue-tsc --noEmit`                                | exit 0                                                                                                             | —                                                     |
| Playwright 全量 e2e                               | 见下节「2026-09-19 全量 e2e 复跑」：**63 passed / 6 skipped / 0 failed，全部 69 条已覆盖**，但**非单次干净 tally** | 57 条（49 passed / 1 failed / 6 skipped / 1 not run） |

- Vitest 必须用**原始 PATH** 运行：前插 `/usr/bin:/bin` 会让 GNU tar 遮蔽 bsdtar，使
  `tests/oracles/phase0d-evidence-reproducibility*` 出现唯一红灯（本轮原始 PATH 下为 5/5 绿）。
- 本机无 C++ 工具链且 `wsl.exe` 被安全策略阻断，后端 CTest 与后端构建门禁一律 `not-run`。

### 运行态

- `127.0.0.1:5173` **未监听**（2026-09-19 实测 `listening=False`）。当前没有工作台服务在运行；
  部署与启停仍只能由人工执行，未获授权不得操作。

### 2026-09-19 全量 e2e 复跑与 `l5-lightweight-a11y.spec.js:82` 就绪性缺陷

本轮复跑**未取得单次干净 tally**，但把 2026-09-18 挂账的「1 条失败未定性」判清了，并新发现且修复 1 条就绪性缺陷。
本节只读复跑 + 1 处测试修复，未触碰产品代码、契约或运行态。

- **套件规模已变，旧基线不可直接相减**：`--workers=1 --reporter=list` 现报 `Running 69 tests`。
  2026-09-18 的 57 条基线**早于轻量工作台批次**：`l5-lightweight-a11y.spec.js`（5 条）、
  `l6-lightweight-closure.spec.js`（6 条）、`topology-editor.spec.js`（1 条）共 **12 条**当时尚不存在。
- **2026-09-18 挂账的 `dashboard.spec.js:457` 本轮两轮均通过、未复现**（整轮第 9 条，1.4s 量级）。
  该用例「`setViewportSize` 之后直接测量、无可重试前置断言」的隐患仍然存在，但本轮不构成失败，
  **未改动**，继续挂账观察。
- **新发现并已修复：`tests/e2e/l5-lightweight-a11y.spec.js:82`「shared Agent dock reserves the lightweight work
  surface on narrow desktop widths」**。首轮失败于 `expect(bounds.panel).not.toBeNull()`（取不到 `.agent-copilot-shell`）。
  根因是**测试就绪性缺陷，不是产品回归**：`src/features/agent-copilot-shell/AgentCopilotEntry.vue` 第 60-62 行以
  `import("./AgentCopilotShell.vue")` **懒加载**侧栏，模板第 158 行 `v-if="shouldMount"` 决定其**只有懒加载 resolve
  之后才进入 DOM**（在此之前只有 `.agent-copilot-entry__loading` 占位）。用例点完「打开 TileSim 助手」**立即**
  `page.evaluate` 测量，中间没有任何自动重试断言 → 抢跑。失败快照同时显示侧栏**已正确渲染**
  （含 `separator "调整助手侧栏宽度"` 与收起/展开/关闭按钮），证明产品行为本身正确。
  修复方式与同文件 `:415` 的「先等后测」一致：`click()` 之后加
  `await expect(page.locator(".agent-copilot-shell")).toBeVisible();`（**仅 +3 行，未放宽、删除或跳过任何既有断言**）。
  修复后该条通过（耗时 1.3s → 4.3s），并**解开了整轮**：其后 `l6-lightweight-closure` 全部 6 条（此前从未在整轮中
  跑到）均通过。
- **本轮 tally（同一代码状态，2026-09-19）**：
  - 运行 A：`test --workers=1 --reporter=list` → **62 passed / 6 skipped / 0 failed**（warmup 1 条 + `desktop` 67 条中
    61 passed + 6 skipped，共 68 条已跑到），`exit 1`。**exit 1 的唯一原因是已知 worker 收尾卡死**
    （`worker-1 process did not exit within 300000ms after stop, force-killed it`，落在 `desktop` 项目收尾处），
    导致 `large-artifact-worker` 那 1 条 `not-reached`，主进程随后挂住需人工终止；**没有任何用例失败**。
  - 运行 B（补齐未覆盖项）：`test --project=large-artifact-worker --no-deps --workers=1 --reporter=list` →
    **1 passed，exit 0**，无卡死。
  - 合计 **63 passed / 6 skipped / 0 failed = 69/69 全覆盖**。⚠️ 这**不是**「一次干净的全量 tally」：第 69 条由
    **单 project 复跑**补齐（`desktop` 依赖已在同一代码状态的运行 A 中全绿，故用了 `--no-deps`）。按既有口径
    `not-reached` 不得当作通过，因此**只能记为「全覆盖但非单次干净 tally」**。
- **worker 收尾卡死的追加观测**：卡死两次分别出现在「有失败产物待采集之后」与「`desktop` 项目收尾处」。
  其与用例失败的相关性**尚未定性**，但**不是**本轮改动的产物：运行 A 的失败在 `tests/e2e/**`（与产品代码无关），
  运行 B 零失败且收尾干净。
- **本机运行前提**：`pnpm` 不在 PATH，而 `playwright.config.js` 的 `webServer.command` 是 `pnpm dev`；
  因配置为 `reuseExistingServer: true`，**先在 4173 起 Vite fixture 再运行 Playwright** 即可绕过，无需安装 pnpm。
- 失败产物已复制到仓库外留存：`C:\Users\mapanwang\_tilesim_rescue\e2e-failure-20260919-1316`
  （`error-context.md`、`test-failed-1.png`、`trace.zip`）。

## 双工作台方案状态

`docs/features/lightweight-workbench/LIGHTWEIGHT_WORKBENCH_PLAN.md` 是当前唯一轻量工作台产品基线。轻量版必须支持新建实验、必要配置、校验、正式 run、运行状态、结果摘要和真实图表；相比专业版只减少复杂信息，不减少工作台闭环。L6R fixture 只证明 UI/路由/状态机/契约映射，不构成 Provider、live、calibration、held-out 证据。现有 Agent、Bridge、Provider、schema、权限和失败语义边界保持不变；专业版现有路由、表单、Agent、Evidence 和 run 状态仍是回归基线。

L6R 后续 UI remediation 已完成 P0/P1/P2/P3：`/lightweight` 负责开始/继续，`/lightweight/prepare` 直接承接新建实验，独立“任务”和“学习”入口已从主导航移除；旧 `/lightweight/tasks` 仅兼容重定向到配置页，旧 `/lightweight/learn` 仅兼容重定向到轻量首页，并且只携带合法工作台 query。教程、字段解释和证据边界收敛到右上角“页面帮助”；轻量版和专业版复用帮助基础设施，但 topic、搜索分组和路由定位按 workspace scope 完全分域，任何一侧都不得显示或跳转到另一侧的帮助主题。运行页突出后端状态、下一步动作和恢复元信息，结果页按结论→证据→细节展示并保留 resolved fidelity、provenance、artifact/schema 身份。首页已移除教程式副文案，主流程只保留状态、证据和可执行动作。fixture 桌面 E2E 已恢复为可执行用例，验证提交、状态推进、刷新恢复、artifact 校验、合法 0 与 missing、失败边界和专业版往返；当前全量 frontend（639 passed/8 skipped）、Bridge（91 tests）和完整桌面 fixture E2E（63 passed/6 skipped）门禁通过，skipped 项均为 live deployment/Provider 能力相关，fixture 仍不构成 live/calibration/held-out 证据。

轻量 run/results 深链统一等待共享 Bridge manifest/schema bootstrap；bootstrap 失败时 fail closed，不在缺少 manifest/schema 上下文时走 legacy evidence 读取路径。共享 readiness promise 会去重 App shell 与页面自身的并发 bootstrap 请求。

专业版现有的同一个右侧 `TileSim 助手` 现复用于轻量工作台，不新增第二套 Agent UI、会话或请求链。轻量配置页通过 `run-experiment` 公共 adapter 发布当前 descriptor/页面目录允许的字段和当前页面上下文，轻量运行/结果页只从合法 run 路由或 query 建立 run context；模式切换时保留同一助手状态，但旧页面 context 必须失效并替换。配置草案仍不写入表单、不自行创建 run；结果页只读分析可使用独立模型通道并在失败时回退本地证据整理。助手本地会话是有限期、可删除的可见缓存，不是服务端 Conversation store；不把 synthetic/fixture 证据升级为 live、calibration 或 held-out。

本轮在专业版和轻量版的 JSON 输入模式中加入 canonical topology request 可视化编辑器：设备节点可拖动调整前端布局，连接模式支持点选或拖拽创建显式 `links`，边属性可编辑/删除，domain 成员关系以只读虚线展示；`links` 按当前后端 `LinkSpec` 语义表示无向物理连接，前端不绘制方向箭头，也不允许同一 domain 的反向重复边；布局坐标不会写入提交 JSON，未实现设备/domain CRUD，也未修改 Bridge、schema、Profile registry 或 API surface。拓扑专项单元/组件测试为 29/29 passed，新增 desktop pointer E2E 通过（含拖动、建边、反向重复保护、属性编辑、删除和无 `x/y` 断言）。

## Phase 2D handoff

- 新增 `bridge/contracts/agent_orchestration_phase2/registry.py` 与 registry tests；它独立于 v1 Capability Catalog，发布五类 source-backed Profile v2 record、snapshot 和完整 binding。
- 所有记录均 `runtime_status=unavailable`、`agent_exposed=false`、calculator/ranking 不可用；校准和 held-out 缺失，Phase 2C lowering 继续 fail closed。
- registry 校验 source/license/regime、字段 provenance、生命周期、visibility/sensitivity、canonical digest、revision drift 和 stale snapshot；不得把 synthetic/compatibility 记录升级为真实校准证据。
- Phase 2D/2E handoff 本身不新增 calculator、Agent orchestration receipt UI、RAG、多轮、审批、Workflow、SSE/cancellation；不操作 5173、不读取 credential、不调用 Provider、不创建正式 run。当前拓扑图编辑器属于 S6 JSON 输入工作台，不改变该 Phase 2 边界。Phase 2E 不启动。

## 1. 必读

1. `AGENTS.md`
2. `docs/README.md`
3. 本文件
4. `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`
5. 当前模块 contract、公共入口和 tests

`docs/archive/` 只用于追溯，不是当前事实来源。Agent 编排模块的阶段记录（Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、
Phase 2B 发布）已归档到 `docs/archive/agent-orchestration/phase-records/`。

## 2. 当前代码事实

- Vue 前端、Python Bridge、OpenAPI/JSON Schema、generated contracts、fixture/E2E 和 immutable release 工具均在本仓库。
- 完整仿真运行仍依赖独立 TileSim 后端仓库；bootstrap 可自动克隆。Evidence Agent 外部模型为可选配置。
- Web 集成交付、部署可移植性修复和对应回归已进入公开 `origin/main`；本仓库 `HEAD == origin/main ==`
  `4d7f9fa3c330b7d6f287d12da853ec2bf481b0cb`。
- 后端本地 `main` 为 `ba11e6fdb69af046dc7597e5ef5732cce029cfbe`（含 Phase 2C 与 dense timing）；后端公开
  `origin/main` 仍为 `7b2b1cff52fdab21575609be170c3856f120120b`，即后端本地领先 2 个提交、尚未 push。
  Capability Catalog 引用的不可变证据 revision `7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由该公开仓库解析，
  并保留在公开 `codex/phase0d-backend-evidence-clean` 分支。
- 公开发布状态为 `published_clean_clone_verified`。2026-09-11 从 GitHub 全新克隆 Web 与后端后，完整 bootstrap 在
  `-NoRestart` 模式通过（该次为后端 63/63 CTest、前端 506 passed/8 skipped）。这是**带日期的历史证据**；完整部署仍必须
  保留后端 evidence revision gate。
- 2026-09-18 本轮实测门禁（含工作树未提交的 WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06、WP-2D-01 与 WP-2D-04）：
  Web Vitest **595 passed / 8 skipped**（70 files）、Bridge `unittest` **143 passed**、`vue-tsc` / `eslint src tests
scripts bridge` / `vite build` / `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255 源文件）/
  `git diff --check` 全部 passed。**Playwright 全量首次取得干净 tally**：
  `node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，
  exit 0，7.1m，无 worker 强杀**；6 条 skipped 全部是 `live-week8.spec.js` 的 deployed-Bridge 用例（需部署环境）。
  `dashboard.spec.js:2079` 在定向 ×3 与全量 ×1 下**全部通过**。
  此前「全量 2079 变红 + worker 卡死」的红已定因为 `src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，登记为
  **`DEF-BUSY-RACE-001`**，**已由 `WP-2D-04` A 部修复并关闭**（认领令牌：`state.busy` 全仓唯一写点收敛到
  `dashboard-state.ts:63`）。完整分析与验收判定见覆盖度文档 §6.1.2 / §6.4.1。`eslint .` 仓库级 10 条错误全部落在
  **未跟踪**的 `output/playwright/*.js`（用户草稿）。后端 CTest 与 fixture Playwright 全量本轮未复跑
  （本机无 C++ 工具链），必须标记为 `not-run`。本仓库 `HEAD` 仍为 `4d7f9fa`，以上改动尚未提交。
- **2026-09-18 `WP-2D-05` 后的复测（须与上一条一起读；门禁数字已更新）**：Web Vitest **596 passed / 8 skipped**
  （70 files，+1 = 本包新增用例），`vue-tsc` / `eslint src tests scripts bridge` / `prettier` / `vite build` /
  `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255）/ `git diff --check` 全部 0，Bridge 143 不变。
  **e2e 再次取得干净 tally**：`--workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，exit 0，6.4m，
  无 worker 强杀**，覆盖全部 57 条（含 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`，`ok 57`）。
  **worker 收尾卡死是间歇性既有环境缺陷、未根除**：同一会话另有 3 次运行在用例全部零失败后出现
  `worker-1 process did not exit within 300000ms after stop, force-killed it`，其中 1 次是把 `WP-2D-05` 的改动
  **逆操作回退**后跑的 A/B 对照（现象完全相同，回退已实测 `renderStatusCell = 0` / `lib/format = 0` / 旧表达式复原）
  → **与代码改动无关**。卡死落在 `desktop → large-artifact-worker` 项目切换处时，那 1 条会 `not-reached`，
  必须另起一次完整运行覆盖，**不得把 `not-reached` 当作通过**。
  **纪律**：全量 e2e 不得与其它重量级门禁并发跑——并发时曾出现 `dashboard.spec.js:2079` 的
  `toHaveURL(/\/metrics\?run=run-fixture-f1$/)` 偶发失败（收到 `/metrics`），空载定向 ×3 全部 `ok` / `EXIT=0`。
- **2026-09-18 发布批次（本文件的新口径）**：指挥方在同一会话内授权了**发布**与**契约变更窗口重开**两件事。
  工作树中已验收但未提交的 7 个工作包（`WP-2C-01a/01b`、`WP-2C-02` 服务层、`WP-2C-06`、`WP-2D-01`、`WP-2D-04`、
  `WP-2D-05`）连同文档与契约生成物**已在本地完成提交**，共 3 个提交：`290d1c8`（Phase 2C 契约与预览路由）、
  `9b2d39b`（工作台 C0 覆盖度 + 两处缺陷收口）、`446f21d`（文档与仓库卫生）。**但推送未完成**：本机对
  `github.com` 的出口被网络策略阻断（系统代理 `127.0.0.1:56943` 对 `CONNECT` 返回 502；绕过代理直连为
  `Connection was reset`；沙箱内外结果相同，连只读的 `git ls-remote` 也失败）。因此 `origin/main` **仍停在
  `4d7f9fa`**，本地领先 **3 个提交未推送**；后端仓库（`D:\tileSim`）本地领先其 `origin/main` 的 **2 个提交**
  （`8839b969` Phase 2C lowering、`ba11e6fd` merge）同样**未推送**。恢复网络后须由人工在两个仓库各执行一次
  `git push origin main`。契约方面：本次提交的契约文件全部来自**已验收的 `WP-2C-01a/01b`**（2 个新 Schema 加
  `openapi.json` / `manifest.json` / `bridge-api.schema.json`），使 `SCHEMA_SET_REVISION` 由
  `sha256:518f4da9…e43ece`（86 json）变为 `sha256:d498092a…abffab`（88 json），两个值均已按
  `bridge/server.py:135-144` 的算法独立复算；**重开后的窗口尚未被任何工作包使用**（`WP-2D-02` 与 `WP-2C-02a`
  都还没动契约文件）。发布前门禁见下一条。
- **2026-09-18 发布前门禁实测**（本机，`HEAD` 为 `4d7f9fa` + 上述工作树改动）：Web Vitest **70 files /
  596 passed / 8 skipped**、Bridge `unittest` **143 passed / OK**、`py_compile` 通过、`vue-tsc --noEmit`、
  `eslint src tests scripts bridge`、`vite build`（2760 modules）、`contracts:check`、`docs:check`（43 篇）、
  `deps:check`（255 源文件）、`git diff --check` 全部 exit 0。**`prettier --check` 对全部待发布文件有 2 条既有
  不合规**：`bridge/contracts/agent_orchestration_phase2/manifest.json` 与
  `bridge/contracts/schemas/bridge-api.schema.json` —— 已核验其 `HEAD` blob 与工作树逐字节一致且 `HEAD` 版本同样
  不合规（`git hash-object` 与 `git rev-parse HEAD:<path>` 相等），即**属既有状态、非本批次引入**；按 AO-24
  「禁止顺手修 phase2 的 `*.json`」的既有口径**未修**。全量 e2e 结果见下一条。
- **2026-09-18 全量 e2e 实测（本批次唯一未通过的门禁项）**：`--workers=1 --reporter=list` 完整跑完 57 条，
  **49 passed / 1 failed / 6 skipped / 1 did not run，exit 1，6.8m**。6 条 skipped 仍是 `live-week8.spec.js` 的
  deployed-Bridge 用例。1 条 did-not-run 是 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`：该项目
  `dependencies: ["desktop"]`，而 `desktop` 项目出现失败，故整个依赖项目未运行（**不得当作通过**）。
  唯一失败是 `tests/e2e/dashboard.spec.js:457`「overview keeps a usable first-viewport comparison and keyboard
  route round trips」：`page.locator(".overview-domain-list tr").first().boundingBox()` 返回 `null`，随后
  `bounds.y` 抛 `TypeError`。该断言**紧跟在 `setViewportSize` 之后、没有任何自动重试断言前置**；同文件 `:415`
  的写法不同（先 `await expect(...).toHaveCount(6)` 再测量），而**同一次运行中 `:415` 通过**。
  已核实该用例**在本批次前后都位于 `dashboard.spec.js:457`，本批次对该文件只有 1 处 4 行改动（`:2744` 的 C0-7
  `expected_absence` 文案断言），与本用例无关**；失败时的页面快照也显示「通信域观测」表格及其 `scale-up` 行已渲染，
  说明选择器与数据侧本身正常。**此前 `WP-2D-05` 验收时同一代码曾取得干净 tally（51 passed / 6 skipped / 0 failed），
  本轮未能复现。** 失败后连续 3 次隔离复跑（含 `--repeat-each=3`）**均在零输出状态下被强杀**：Playwright 在非 TTY
  下 stdout 全缓冲、SIGTERM 时缓冲被丢弃，故隔离结果无从判定；同时 `test-results/` 已被后续运行清空，失败产物不可回收。
  **因此本批次 e2e 门禁的结论是：49/57 通过，1 条失败未定性（flake 与回归未区分），不得记为通过。**
  待处置：环境稳定后补一次干净的全量 `--workers=1` 运行；若仍复现，按「`:415` 同款前置自动重试断言」的写法
  单独判定是测试就绪性缺陷还是产品回归（**不得为让用例变绿而放宽、删除或跳过既有断言**）。
  **2026-09-19 处置**：上述待处置已执行 —— 该条本轮两轮均通过、未复现，**未改动**；同轮另在
  `l5-lightweight-a11y.spec.js:82` 发现同类的就绪性缺陷，按其写法修复。见本节上方的
  「2026-09-19 全量 e2e 复跑与 `l5-lightweight-a11y.spec.js:82` 就绪性缺陷」。
- **契约变更窗口已由指挥方于 2026-09-18 显式重开**：本条取代本文件 §2 上文以及 AO-23 §4、AO-24 §8 中
  「窗口已关闭、后续工作包不得再动 `bridge/contracts/**/*.json`」的表述（那两句是当时的裁决记录，不再具约束力）。
  重开后 current live `sha256:d498092a…abffab` **必然作废**。随窗口一并解锁：`WP-2D-02`（C1 采集四个运行期
  工件与 C2 报告 Schema 加固，本仓库）与 `WP-2C-02a`（后端 issue serializer 补全，仓库 `D:\tileSim`）；两者仓库与
  文件集合不相交，可并行派发；`WP-2C-02a` 是 `WP-2C-02b`（端点接线）与 `WP-2C-05`（三个 lowering 标志分开
  显示）的唯一前置。**`WP-2D-02` 的步骤 0 只读探针已完成**，结论见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2.1：是非题为**「不会」**（标准配置下
  `runtime_event_trace` 的 state 恒为 `ready`；39/39 条历史 run 的 `has_runtime_event_trace` 全为 `true`，
  `false` 计数为 0），**但**引入「range 起于 S0/S1 且轨迹不可用 ⇒ 整条 run `exit 1`」的新失败面，
  `WP-2D-02` **必须按方案 B**（接受新语义 + 写成 Bridge 可见事实 + 补锁死测试）显式处理，不得静默接受。
  窗口重开后的首张契约变更必须由单一集成 owner 连同全套级联（`src/contracts/generated/**`、Bridge client、
  各文档 revision 表述）一次性处理。
- **指挥方的数据侧决策（2026-09-18）**：**真实 Profile 数据目前不可得** —— 原话为「目前没有从真实的显卡中
  采集到的数据」。因此 `GAP-PROFILE-SUCCESSOR-001`（`blocked_data`）与 Phase 2 的数据侧/执行侧**继续被阻塞**，
  五类 records 维持 `0/unavailable`，执行侧 fail closed 仍是正确结果。**不得**用规格书参数、宣传峰值、
  LLM 常识或前端静态 JSON 替代真实采集数据；`WP-2C-03/04/05` 与 `WP-2D-03` 在此前提下只能做 fail-closed
  接收与呈现。
- Phase 0D 已发布 Capability Catalog/Profile Schema v1；八个 `agent_exposed` 字段有 execution closure，五类真实 Profile
  仍为 `0/unavailable`，没有 calibration 或 held-out validation。
- Phase 1 正式 capability projection 仍是八字段本地草案边界；当前工作树另有受页面目录约束的模型配置建议和只读结果分析通道。两者都不创建 run、不绕过页面/Bridge 校验；模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信算法和 SLO 在没有后端正式能力时继续 fail closed。
- Phase 2A 的隔离候选已由 Phase 2B 正式发布并提交。契约包位于 `bridge/contracts/agent_orchestration_phase2/`，含
  五类 Profile v2、Profile Binding v1、Run Intake v2、Validation Report v1、Calculator Receipt Envelope v1、七类 typed
  receipt identity 与幂等/留存 policy；`package_revision` 为
  `sha256:59373c713f9570db857fabed29ff078e9458f7eeb28f8d559936cc95a3ecc8b6`。
- 2B 的接线范围**只到契约层**：该包只被 `bridge/contracts/openapi.json`、`bridge/contracts/schemas/bridge-api.schema.json`
  与生成物料引用；当初没有任何 Bridge service 导入其 validator。包 manifest 自报 `runtime_status = contract_only`、
  `create_run_acceptance = not_accepted_by_current_api`，五类 `profile_records` 全部为空，包内也没有 `registry.py` 与
  测试源文件（仅有过期 `__pycache__` 残留）。**该形态已被 WP-2C-01a/01b 部分取代**，见下一条。
- WP-2C-01a/01b（工作树未提交，`D:\tileSim-web`）补上了 Phase 2C 的第一条 Bridge 路由，但只做**校验与判定**：
  新增 `bridge/contracts/agent_orchestration_phase2/registry.py`（复用 `validator.py` 的 `IDENTITIES` /
  `validate_contract`，判定码与 `proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json` 的
  12 scenario / 6 expectation / 9 错误码一一对应）与 `bridge/services/run_intake.py`，经 `bridge/server.py` 的
  `POST /api/agent/run-intake-preview` 暴露。被拒判定是判定结果而非错误：**HTTP 200 + typed body**
  （`judgement.accepted = false`）；错误信封只保留给 400（信封非法/不可判定）与 503（契约或 Profile 记录不可读）。
  包 manifest 新增 `run_intake_preview` 块，`runtime_status = read_only_preview_registered`、
  `write_capability = absent`、`run_creation = not_performed`、`backend_lowering = not_wired`；
  **包级 `runtime_status` 仍为 `contract_only`**。
- 该批次改动了 `bridge/contracts/**/*.json`（新增请求/响应两个 Schema），因此 live
  `SCHEMA_SET_REVISION` 由 `sha256:518f4da9…e43ece` 变为 `sha256:d498092a…abffab`，`src/contracts/generated/**`
  已重新生成。`tests/fixtures/phase1-agent-orchestration/*.json` 与 `frozen-current-subset.json` **未被改写**；
  `sha256:3211d2df…c15d` 是 Phase 1 冻结值，与 live 值本就不相等。
  **契约变更窗口已关闭**，后续工作包不得再动 `bridge/contracts/**/*.json`。**（本条已于 2026-09-18 作废：
  窗口已由指挥方显式重开，见本文件 §2 上文 2026-09-18 条目；此处保留原文作为当时的裁决记录。）**
- 后端已完成 Phase 2C：`parse_run_intake_v2` / `lower_run_intake_v2`（`include/Core/RunIntakeLowering.h`、
  `src/Core/RunIntakeLowering.cpp`、`tests/test_run_intake_lowering.cpp`）与只读 CLI
  `validate-run-intake --run-intake <json>` / `run-intake-preview`。后端自评 `partial`，执行侧因五类 Profile records
  为空而 fail closed。**Bridge 尚未调用该 lowering**：上述预览端点只做契约校验与兼容判定，不触达 lowering，
  `/api/runs` 仍只接受 create-run v1。
- **新发现的表示性缺口（2026-09-17 复核，阻塞 Bridge 与 lowering 接线）**：CLI 的 issue 序列化
  （`src/Core/RunIntakeLowering.cpp:253-257`）每个 issue 只输出 `code` / `field_path` / `blocking`（`blocking` 硬编码
  `true`），丢弃 `message` 与 `safe_next_action`；`RunIntakeLoweringResult` 的三个 lowering 标志
  （`workload_lowered` / `execution_lowered` / `runtime_available`）在 stdout 上没有任何出口。而 Bridge 与已发布契约
  的 `backend_issues` 要求五字段齐备且禁止补造，因此当前**没有任何合法方式**把 CLI 输出接进 Bridge 契约。同时
  CLI 用 `exit 1` 表达「被判定为 blocked」并在 stdout 打印 issues JSON——**这是判定结果，不是传输失败**。
  结论：`WP-2C-02` 收窄为服务层调用与失败语义（不接线端点），端点接线另立 `WP-2C-02b`，前置是后端补 serializer
  （**已裁决：走独立后端工作包 `WP-2C-02a`**，见下文「契约窗口重开计划」）或由指挥方重新授权契约窗口；
  `WP-2C-05` 的「三个 lowering 标志分开显示」同样依赖该缺口关闭。
  详见 `docs/F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md` §4.2 / §4.2.1。
- **工作台展示覆盖度缺口（2026-09-17 审计）**：后端一次 `run` 产出十个规范 artifact 与九段跨层契约链，但
  Bridge 只请求 **7 个报告**；四个运行期工件（`--runtime-events-out` / `--runtime-summary-out` /
  `--runtime-requests-out` / `--runtime-analysis-out`）从未被采集，且 Bridge SSE 只有「运行中/终态」两种事件，
  执行期阶段级进度不可观测。已到达前端的 7 个报告里另有 **36 项字段（另加第 7b 条）已随 artifact 进入 bundle
  却没有任何页面渲染**（含 `partial_artifacts`、`capability_registry`、`contributing_factors`、`error_budget`、
  `pd_disaggregation`、三个 percentile distribution 的 p50/max、`boundary_notes`、
  `run_bound_des_evidence.state_summary` 与逐窗口 `stream_records` 等）。缺口按成本分为四类：
  **C0 纯前端**（零 `bridge/contracts` 改动，可立即开工）、**C1 Bridge 采集**（须改 `openapi.json` 的
  `report_files` / `artifacts`，会改变 `SCHEMA_SET_REVISION`，属已关闭的契约窗口）、**C2 契约面**
  （Bridge 报告 Schema 以 `additionalProperties: true` 兜底，字段展示无契约保障）、**C3 输入面**
  （Run Intake v2 全部字段、工作负载描述语言、provenance 四元、GPU 参与、Cycle 窗口等无编辑入口）。
  审计与 `WP-2D-01` 派发提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`；本轮审计未改动任何契约或代码文件。
- **C0 展示缺口已关闭（2026-09-18 验收）**：`WP-2D-01` 补齐 C0 的 36 项 + 第 7b 条并恢复五态
  `availability` 语义。实现入口 `src/features/report-coverage/`（14 文件，公共出口 `index.ts`，被 5 个 view
  按各自 section 挂载），run-bound DES 证据新增 `Week8StreamRecords.vue`。五态单一来源：新
  `availabilityFor()` 只在 `undefined | null` 时求值，缺失态回落 `adapters/dashboard-view-model.ts:4` 的同一个
  `unavailable()`（该函数本次仅加 `export`，逻辑未变）。**判定与完整门禁见覆盖度文档 §6.1.1 / §6.1.2**：
  34 文件（17 新 / 17 改 / 0 删）、`SCHEMA_SET_REVISION` 保持 `sha256:d498092a…abffab` 未变、
  `bridge/contracts` 与 `bridge/**/*.py` 零改动、未新增 `agent_exposed`、定向 Playwright 7 passed。
  因此 **C2 的「等 2D-01 验收」前置已满足**，`WP-2D-02` 只剩「窗口重开 + 步骤 0 探针」两条前置。
- **契约窗口重开计划（2026-09-17 指挥方裁决）**：C1/C2 的 `WP-2D-02` 与后端 issue serializer 缺口的工作包
  `WP-2C-02a` **合并进同一次契约变更窗口**（仓库不同、文件集合不相交，可并行派发）。派发前提有三条：窗口已由
  指挥方显式重开、`WP-2D-01` 已验收、`WP-2D-02` 的**步骤 0 探针**已有结论。窗口重开后 current live
  `sha256:d498092a…abffab` 必然作废。提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2 / §6.3。
- **C1 的风险性质（不得按「多采集一个文件」处理）**：后端在请求了某 artifact 而其 state 为 `unavailable` 时，
  `write_wind_tunnel_artifacts` 返回 false（`src/Core/WindTunnel.cpp:6414-6419`），
  `src/apps/TileSimCLI.cpp:304-309` 随即 `exit 1`，**整条 run 判为失败**。而 `runtime_event_trace` 在
  `--from S1`（Bridge 当前配置）下的 state 恰为 `has_runtime_event_trace ? ready : unavailable`。
  因此追加 `--runtime-events-out` 等四个开关**可能改变 run 终态语义**，`WP-2D-02` 必须先做只读探针再实现。
  另需注意：state 为 `expected_absence` 时后端写入的是 **artifact 描述符 JSON** 而非工件数据
  （`WindTunnel.cpp:6404-6412`），Bridge 与前端都必须能区分二者。
- Evidence Agent descriptor 保持 `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1。
- create-run 顶层保持 `tilesim.bridge.create_run_request.v1`，nested design-space v1/v2 双版本行为不变。
- F9 live model repetitions 仍为 0；fake/fixture 只证明 contract 和 synthetic consistency。人工 citation entailment 尚未完成。

Agent 编排模块的当前状态见 `docs/F9_AGENT_ORCHESTRATION/README.md` 与
`docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md`；下一批工作包见
`docs/F9_AGENT_ORCHESTRATION/23_PHASE2C_WEB_INTEGRATION_PLAN.md`。已归档的阶段记录在
`docs/archive/agent-orchestration/phase-records/`。

## 3. 不可破坏边界

- 不 reset、clean、覆盖用户未提交改动；没有授权不 commit/push。
- `127.0.0.1:5173` 是用户服务；没有明确部署授权不停止、不重启、不替换。
- 不读取或输出 `TILESIM_EVIDENCE_AGENT_*` 的值，不把 credential 写入仓库、日志或命令行。
- 前端不得重算模拟指标、补造 claim、升级 provenance/fidelity 或用 fixture 关闭 live/calibration/held-out Gap。
- uint64 ps/bytes/count 保持无损；requested/resolved fidelity 分离；资源语义模块保持并列；正式 citation 绑定 run/artifact/schema/SHA/Pointer/stable subject。
- Evidence 两类 409 都锁定原 key，只有显式 discard 才能开始新分析；不得自动重新调用 Provider。

## 4. 代码地图

```text
src/app/                         Router 与装配
src/contracts/                   Bridge/report contract 与 generated code
src/adapters/                    versioned payload -> stable view model
src/entities/agent-*/            Agent 本地 typed domain/context
src/features/agent-*/            Copilot Shell、intent compiler 与集成
src/features/run-experiment/     descriptor 表单和唯一 request builder
src/features/evidence-agent/     正式 Evidence Agent 展示与提交编排
src/views/                        页面编排
bridge/contracts/                OpenAPI、Schema 与正式校验
bridge/services/                 执行、capability、Evidence workflow
bridge/providers/                固定 Provider adapter
scripts/                         bootstrap、构建、部署、回滚和启动
tools/launcher/                  可选 Windows GUI 启动器源码
docs/F9_AGENT_ORCHESTRATION/     Agent 编排 current baseline、Gap、路线和验收
docs/archive/                    历史记录
```

## 5. 部署事实

- Web checkout 可位于任意 Windows 目录；脚本不得写死本机用户名或盘符。
- `scripts/bootstrap-workbench.ps1` 是干净 clone 的入口。
- 默认后端源码和 deployment worktree 是 Web checkout 的同级 `tileSim/` 与 `tileSim-backend/`，均可通过参数覆盖。
- Windows GUI 启动器由 `tools/launcher/build-launcher.ps1` 构建到 Web 根目录的 `启动TileSim工作台.exe`；
  frozen launcher 从 EXE 所在目录定位 checkout，WSL build cache 同时绑定 revision 与 deployment 源码路径。
- `runtime/`、`runs/`、`dist/`、`node_modules/` 都不进入 Git。
- 部署脚本使用 immutable `bridge + dist` snapshot；health 必须绑定 source/build/release/schema identity。

## 6. 当前优先级

1. 推进 Phase 2C Web 集成：把已发布的 Run Intake v2 契约接到 Bridge 与后端 lowering 之间。第一批（WP-2C-01a/01b）
   已完成严格路由与只读预览，**不创建 run**；下一批是 `WP-2C-02`，只交付 **Bridge 服务层**的 lowering 只读调用与
   失败语义（须遵守 Week 7 单槽约束：调用方注入同一把锁，`acquire(blocking=False)` 失败即容量已满）。**不接线端点**，
   因为已复核出后端 CLI 的 issue 序列化只有五字段中的三个（见 §2 的表示性缺口）；端点接线属 `WP-2C-02b`，需先关闭
   该缺口。提示词与验收清单见 `docs/F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md` §4.2 / §6.3，
   工作包见 `docs/F9_AGENT_ORCHESTRATION/23_PHASE2C_WEB_INTEGRATION_PLAN.md`。
2. 不启动 Profile 数据工作、calculator 实现与 Web receipt UI：Phase 2 的数据侧与执行侧仍为 `blocked_*`。先关闭
   `GAP-PROFILE-SUCCESSOR-001`、`GAP-CALCULATOR-001`、`GAP-VALIDATE-001` 及并行、KV、工作负载、网络的累计执行 Gap，
   再重新审计 DoR。
3. 五类 Profile 真实记录为零时不得用产品名称、公开宣传值、LLM 常识或前端静态 JSON 补造能力；关键 unknown 必须阻塞。
4. 后续正式多轮 Agent 需要 Conversation、Draft、Validation、Clarification、Approval、Workflow、RAG 和工具 contract；
   不要在浏览器内存模拟关闭 Gap。`GAP-CLARIFY-001` 的 answer binding 是当前唯一不依赖新契约即可闭环的前端缺口。
5. 文档变更继续按 `docs/README.md` 分类；结束阶段时把 dated 记录移入
   `docs/archive/agent-orchestration/phase-records/`，并把仍然有效的结论折进 `AI_HANDOFF` 与模块 current baseline。
6. 与 2C 并行的**不受契约窗口约束**的轨道：`WP-2D-01`（工作台展示覆盖度补齐 · 第一批 C0），只做纯前端渲染
   补齐，不碰 `bridge/contracts/**/*.json`、不碰 Bridge、不新增 artifact 请求，`SCHEMA_SET_REVISION` 必须保持
   `sha256:d498092a…abffab`。范围清单（36 项 + 第 7b 条）与提示词见
   `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §3.1 / §6.1。
   **该包已于 2026-09-18 交付并验收（判定见同文档 §6.1.1）**，五态语义与 36 项 + 第 7b 条全部落地，
   `SCHEMA_SET_REVISION` 实测未变。剩余残留观察（行级 `cell()` 未走五态分派；`LayerRecordTable` /
   `f7-analysis` 仍为二元回退）登记在同一节末尾，属后续条目而非验收阻塞项。
   **上述残留与验收阶段定位的既有缺陷 `DEF-BUSY-RACE-001`（`src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，
   使全量 e2e 长期不可用）已合并为一个无前置的收口工作包 `WP-2D-04`（提示词见同文档 §6.4）。**
   **`WP-2D-04` 已于 2026-09-18 交付并验收（判定见同文档 §6.4.1）：A 部修复使 `DEF-BUSY-RACE-001` 关闭、
   全量 e2e 恢复干净 tally；B-1 / B-2 / B-3 关闭，B-4 判定「无需修改」并经复核成立。**
   该包不占用 `WP-2D-03`（C3 输入面）的编号，2D-03 仍因依赖 Profile 数据而未写提示词。
   同一文件 §6.2（`WP-2D-02`，C1+C2）与 §6.3（`WP-2C-02a`）属**契约开窗批次**，窗口未重开前不得派发；
   `WP-2D-02` 的「等 `WP-2D-01` 验收」前置**已满足**，现只剩「窗口重开 + 步骤 0 探针」。
   `WP-2D-04` 验收后新登记三条残留（`renderKeyValues()` 裸字典仍二元、屏幕与导出的**状态列**文案不一致、
   `buildList()` 容器与单元格在 unsupported_schema 下可不同态），均记在 §6.4.1；
   **指挥方已于 2026-09-18 逐条裁定（§6.4.2）**：① 与 ③ **维持现状**（渲染点无 backend scope，可得状态集恰为
   `{available, missing}`，臆造其余三态属补造；① 的二元 helper 谓词与同站点 `display()` 逐字同源，改用共享解析器
   反而会让 `""` / `"—"` 出现 class 与文案不同源），② **确认是真缺陷并派 `WP-2D-05`**（提示词见同文档 §6.5）：
   导出 HTML 的记录状态列未走屏幕同规则——未报告状态导出成 `—` / `unknown`、已报告状态导出裸 token
   （屏幕经 `statusLabel()` 译出）。
   **`WP-2D-05` 已由指挥方在同一会话内直接实施并验收（判定见同文档 §6.5.1）**：新增 `renderStatusCell()`
   （`render-html.ts:74-90`，调用点 `:100`），已报告状态走 `statusLabel()` / `statusTone()`，未报告与 `unknown`
   走共享 `missing` 态；全仓 `>—</td>` 命中数 0，`record.status` 的处理点只剩屏幕与导出两处且规则一致。
   至此 **B-2「导出与屏幕同文案同 tone」已完全达成**，`record.status || "—"` 这一形态在本仓库已不存在。
   同文档 §6 内**已无「可立即派发」的工作包**：§6.2 / §6.3 等契约窗口重开，`WP-2D-03` 等结构化输入契约与
   Profile 数据。`WP-2D-05` 未占用 `WP-2D-03` 的编号。

### 2026-09-22 「应用到面板」判据改版与一条上下文声明回归（工作树含未提交改动）

本节记录 2026-09-22 的两处修复与实测门禁。**上方第 47 行的门禁表是 2026-09-19 的历史值，不改写**；本节数字为当日实测。

- **症状**：用户点「应用到面板」反复收到「页面上下文已变化，这份改动没有写入。请重新提交。」（`parameter_plan_stale`）。
- **根因（代码可证）**：`parameter_edits` 的应用守卫只比 `plan_revision` 与当前 `context_revision` 是否相等，而该令牌
  在**任何**重发布后都会换号；`plan_revision` 取的是**提交那一刻**的值，模型回答**首字约 60 秒**，期间
  `state.bridge.checking` 翻转、描述符刷新、页面重进都会换号 ⇒ 计划**出生即过期**，令牌判据必然复发。
- **修复一（判据换位）**：新增 `src/features/agent-copilot-integration/parameter-plan.ts` 的 `assessParameterPlan()`，
  改为逐条比对计划读到的 `previous` 与页面当次发布的 `parameter_catalog[].current`：值变了 / 地址不在目录里 /
  目录为空 / 无编辑 = 拒（错误详情仍 `parameter_plan_stale`，消息指名参数与新旧值）；全相符 = 写入。
  `markAgentBlocksStale` 不再把 `parameter_edits.plan_revision` 置 null。**注意：这不是契约变更**，revision 字符串格式、
  `compareAgentContexts`、编译器 staleState 语义都未动。
- **修复二（上下文声明回归）**：上一版 keeper 在内容未变时 `return`，把**声明上下文**一并省掉。通用投影与页面发布
  **共用 provider id `app-shell`**，而路由 watch 每次路由变化都发**无参数目录**的通用投影；`ExperimentView` 位于
  `<KeepAlive include="ExperimentView">` 中（`App.vue:870`），回到页面不重新 setup ⇒ 页面不再声明 ⇒ 通用投影长期生效
  ⇒ 面板退化为「只解释」，计划令牌也对不上。现在两个页面 publisher **每次运行都发布**（revision 仍由 keeper 钉住），
  判重移到 `publishExperimentAgentContext()`（生效上下文已是该发布时跳过 registry 更新）。
- **同日实测门禁**：前端 Vitest **1007 passed / 8 skipped，93 files，exit 0**（`vue-tsc --noEmit` 0、eslint 0、
  改动文件 prettier 0）；`generate-contract-types.mjs --check` / `generate-bridge-client.mjs --check` 均 exit 0；
  `check-doc-links.mjs` exit 0（**62 篇**）；`check-frontend-dependencies.mjs` exit 0（**309 源文件**）；
  Bridge `python -m unittest test_server.py` + `test_assistant_model.py` = **199 passed / 0 failed**。
  Playwright **子集**（`l5-lightweight-a11y` + `l6-lightweight-closure` + `dashboard`）= **60 passed / 0 failed /
  0 skipped，exit 0**（7.2 分钟，无 worker 卡死行，单次干净 tally）；修复**前**同子集为 59 passed / 1 failed
  （`dashboard.spec.js:54`，即上述回归），该条单跑 3 次可稳定复现，修复后通过。
- **未操作**：未 commit、未 push、未启停 5173、未改契约 JSON；`D:\tileSim` 只读。用户需自行**重新部署**才能看到该修复
  （`scripts/deploy-local-backend.ps1 -SourceRoot D:\tileSim`；`start-workbench.ps1` 只启动已有部署，不重建前端）。
- 模块级细节见 `docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md` 末尾的三条 2026-09-22 修订。

### 2026-09-23 助手可写参数面从「13 个旋钮」扩到「整份表单」（工作树含未提交改动）

本节记录 2026-09-23 的参数面扩容与实测门禁。**上方第 47 行的门禁表是 2026-09-19 的历史值，不改写**；本节数字为当日实测。

- **用户诉求（原话）**：「当前可调整的参数中没有显卡数量或 GPU 参与模式……请提供更全面的能力，使其能够对所有参数进行修改」。
- **根因（代码可证）**：桥接侧 `bridge/providers/assistant_model.py` 的 `PARAMETER_RULES` 只由
  `bridge/contracts/experiment_descriptor.py` 的 `PARAMETER_DEFINITIONS`（**13 个 `overrides` 旋钮**）生成；
  `_validated_plan()` 只认这 13 个地址，模型给出的任何表单字段一律按 `unknown_parameter` **静默丢弃**
  （`topology/devices`、`gpu_participation_mode` 都在此列）。前端 `parameter-catalog.ts` 早就枚举了整份表单，
  但**验收在桥接侧**，所以「加显卡」这类诉求必然落空 —— 前端能规划、后端不认。
- **修复一（参数面单一真源）**：新增 `bridge/contracts/parameter_surface.py`，从三份契约 schema
  （`run-overrides` / `runtime-trace-input` / `topology-request-input`）＋描述符**推导**出全部可写地址，
  导出 `SURFACE_ADDRESSES`（**64 条**）、`resolve_address()`、`surface_catalogue_text()`。
  `assistant_model.py` 的规则表、`_validated_plan()`、目录文本（交给模型的 `parameter_catalogue_text()`）
  全部改为读它 ⇒ **校验口径与目录文本同源**，不会再出现「没告诉模型的地址反而被判未知」。
  引用型字段（`device_id`/`domain_id`/`module_name`/`src_device`/`dst_device`/`module_binding`）与容器、数组本身继续**排除**
  （一次标量赋值不能安全改名/重写引用）。元素地址用 `[i]` 占位；模型直接写 `devices[i]/...` 会被
  `address_needs_an_index` 明确拒绝（而不是含糊的未知参数）。
- **修复二（集合规模可写）**：前端新增 `kind: "count"`（**集合规模，不是 JSON 类型**），
  `parameter-catalog.ts` 增加 `topology/devices`（文案「设备数量（显卡数量）」）与 `runtime_trace/requests`
  两条规模地址；`parameter-edit.ts` 的 `COLLECTION_RESIZERS` 用既有 `setDeviceCount` 与新增 `setRequestCount`
  完成增删（缩容时若有 link/domain 仍引用将消失的设备，抛 `StructuredInputError` 并点名该设备，不静默破坏）。`gpu_participation_mode` 属顶层表单字段，随之进入可写面。
- **修复三（一次方案的长度上限）**：`MAXIMUM_SETTINGS` **20 → 40**。真机实测（8 卡方案）显示：40 条以下模型
  会同时写「集合规模 + 逐卡字段 + fabric/knob」，20 条会把后半截按 `settings_limit_exceeded` 全丢，
  与它自己写的理由矛盾。上限现随目录文本一起告知模型（SYSTEM_PROMPT 明确写出条数），
  前端 `scenario-recommendation.ts` 把 `dropped` 条数写进方案理由（`App.vue` 透传），用户能看到「还有几项没列进来」。
- **同日实测门禁**：Bridge `test_parameter_surface.py`（新）**25 passed**、`test_assistant_model.py` **62 passed**（原 55，+7）、
  `test_server.py` **170 passed** —— 三文件合计 **257 passed / 0 failed**；
  前端 Vitest **1056 passed / 8 skipped，93 files，exit 0**（`vue-tsc --noEmit` 0、eslint 0、
  改动文件 prettier 0）；`generate-contract-types.mjs --check` / `generate-bridge-client.mjs --check` 均 exit 0；
  `bridge/test_f8_schemas.mjs` 1 passed；`check-doc-links.mjs` exit 0（**62 篇**）；
  `check-frontend-dependencies.mjs` exit 0（**309 源文件**）；改动文件 `git diff --check` 0。
- **真机验证（只读，不进仓库）**：用启动器已保存的通道配置（`runtime/evidence-agent.local.json`，模型 `gpt-5.6-sol`）
  跑参数面探针。目录文本 78 行，四个关键地址全部命中（`topology/devices`、`集合规模`、
  `gpu_participation_mode`、`runtime_trace/requests[i]/tp_degree`）；模型成功给出「8 张 GPU」方案
  （`topology/devices = 8` + 逐卡 `device_type`/`group_id` + fabric/knob），当时受 20 条上限丢弃 24 条 —— 即上条修复的触发证据。
  该网关（`https://x.mkai.de5.net`）随后开始整体拒绝 chat 调用（`/v1/models` 与 `/v1/chat/completions` 均
  `HTTP 403: error code: 1010`）⇒ **这是网关侧拒绝，不是本仓库缺陷**；密钥不出后端（`no_credential_in_report: true`）。
- **未操作**：未 commit、未 push、未启停 5173、未改契约 JSON（参数面是**读**契约推导，不新增/修改任何 schema）；`D:\tileSim` 只读。
  用户需自行**重新部署**才能看到该能力（`scripts/deploy-local-backend.ps1 -SourceRoot D:\tileSim`）。
- 模块级细节见 `docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md` 末尾的 2026-09-23 修订。

### 2026-09-23 原版 Tauri 启动器接线（未执行部署）

- 原路径 `启动TileSim工作台.exe` 的原版是 Tauri 2 侧栏工作台，不是 `tools/launcher/tilesim_launcher.py` 的 Tk 界面。
  从保留的 `origin/codex/launcher-tauri-v2` 源码恢复 `tools/workbench-launcher/`；旧构建入口现转向 Tauri，
  防止再次以 PyInstaller 覆盖原版。原版窗口的概览、服务、模型、诊断、日志、主题均保留。
- 在“更新与部署”页并列提供远端 `origin/main` 更新和“部署本地工作树”。后者的 typed Rust 请求仅允许
  `scripts/deploy-local-backend.ps1 -SourceRoot <所选 Git 后端工作树> -WslDistro <校验名称>`；使用当前 Web checkout，
  不调用个人桌面 `.cmd`，不 fetch/push，不强制结束开发进程。确认框明确提示未提交文件与 5173 重启。
- Tauri 单元测试 **14 passed**、组件/状态测试 **11 passed**、fixture E2E **15 passed**，`launcher:typecheck`、
  Rust fmt/Clippy、改动文件 ESLint/Prettier、`docs:check`（62 篇）与 `deps:check`（309 源文件）通过。
  主站 `pnpm test` **93 files / 1056 passed / 8 skipped**，`pnpm typecheck`、`pnpm build`、`contracts:check`
  通过；全仓 ESLint **0 errors / 2 既有 warnings**。主站全量 e2e 本轮未跑。
  本机 Tauri 构建和 packaged self-check 通过，发布到原路径；旧版 EXE 原子备份在被 Git 忽略的
  `runtime/launcher-fallback/`。正式 EXE 的新增入口和确认框已人工检查并取消。
- **未执行本地或远端部署**，未停止/重启 5173、未读取 Provider credential、未 commit/push；工作树先前的
  界面和截图未提交改动保留。launcher fixture 使用独立 4187，检查后已停止。

### 2026-09-23 Tauri 启动器日常入口收敛

- 保留原版 Tauri 侧栏工作台，在概览页收敛为“一键启动工作台”和“重新部署当前代码”两项日常操作；
  移除重复的“启动与服务”页。已有服务就绪时只打开网页，未运行时验证并启动已有 release 后打开；
  首次无部署清单时转入本地部署确认，不隐式启动旧产物。
- 重新部署使用当前后端和 Web 工作树文件（含未提交改动），保持确认、构建、测试、发布和 5173 重启，
  成功后打开网页，失败不打开。后端目录与 WSL 配置在“部署设置”；远端 main 更新、停止服务降为折叠高级操作。
  启动器不调用个人桌面 `.cmd`，不强制结束开发进程。
- Rust 单元测试 14 passed、fixture 单元/组件 11 passed、独立 4187 E2E 17 passed、launcher typecheck exit 0；
  浅深主题与 800×600 窗口已人工检查。Tauri 构建与 packaged self-check 通过，原路径 EXE 已原子替换，
  SHA-256 `ae2aa95dfb548e4dc8b796aa463d14d4f784cbdf19e80d2a38f58ab029c9e3ff`；替换前一版在
  `runtime/launcher-fallback/启动TileSim工作台.previous-20260923-180827-42252.exe`（此前原版另有备份）。
  此批**没有执行真实部署或启停 5173**。

### 2026-09-23 启动与部署进度可见性

- 原版 Tauri 概览的启动、本地重新部署，以及折叠高级操作中的远端更新运行时，页面顶部显示
  真实脚本阶段、动态进度条、持续计时、最近一行脱敏输出和“查看完整日志”入口。
  进度条表示任务正在运行，**不显示未经脚本提供的完成百分比**；失败时解决办法置于进度区之前。
- 仍只使用 Rust typed operation 的现有阶段/日志事件，不修改部署脚本、部署清单或 5173 服务。
- Rust 单元测试 14 passed、组件测试 11 passed、4187 fixture E2E 20 passed、launcher typecheck、改动文件
  ESLint/Prettier、docs:check、`git diff --check` 均通过。800×600 浅/深主题运行态进度条已人工检查。
  Tauri packaged self-check 通过并原子更新原路径 EXE，SHA-256
  `9ea14da6bdb8d5cad1346ef75fa7b3dac8470213832888357326f0a4ac12f7b6`；更新前一版备份为
  `runtime/launcher-fallback/启动TileSim工作台.previous-20260923-183356-48660.exe`。
  未执行真实部署或启停 5173，监听进程仍为 PID 17252；没有 commit/push。

### 2026-09-23 助手同批扩容方案完整性修复（工作树，未部署）

- 16 卡示例暴露的缺口：目录此前只含已存在的设备索引；模型方案的新增设备字段被跳过，Bridge 40 项上限截断其余字段；逐项应用会留下半套配置。
- 现在仅在同一方案合法增加 `topology/devices` 或 `runtime_trace/requests` 时，投影方案明确点名的未来元素标量字段；页面应用前核对原集合规模未变，写入时先扩容再写字段，任一文档写入失败则整批回滚（包括表单改动）。未提及的 links/domains 不会被编造。
- 模型方案的 skipped、Bridge dropped、校验拒绝和未识别项逐地址列出，禁止直接应用；多节点扩容缺组号、声称 TPn 但未配置第 0 条请求的对应并行度，同样标为不完整。Bridge 设置上限提高到 64，并要求模型诚实区分设备分组与完整互联。若被修改的请求仍固定着与新 TP 不匹配的 `participants`，整批拒绝并提示先在结构化输入清空或重写；实际域与链路仍需人工核对，不能由组号推断。
- 定向前端测试覆盖 16 卡四节点乱序配置、TP16、过期规模、越界索引、回滚和不完整方案；Bridge 以及其它门禁的本轮实测结果以当前交付报告为准。没有创建运行、使用 live Provider、部署或重启 5173；现有其它工作树改动保留。

### 2026-09-23 助手与用户对话身份（工作树，未部署）

- 侧栏对话中，用户发言显示中性人物 SVG 头像和「用户」；模型发言显示「阿拓」头像及名称，保留模型 identity 的次级标识。输入标签、占位说明、空状态与页脚不再使用第二人称「你」。图像只作装饰，文字保留可访问的发言者身份；不读取个人资料或推断用户身份。
- 仅更改静态视觉资产与文案，不改变 Agent typed-block payload、上下文、模型选择、草案或执行流程；现有 5173 服务未部署。浅色/深色与窄桌面的实际验证结果见交付报告。

### 2026-09-23 进阶运行参数缺省值展示（工作树，未部署）

- `RuntimePolicyForm.vue` 对未写入 `runtime_trace.policy` 的 9 个进阶字段显示后端缺省值：数字输入以浅色 placeholder 展示，并标注「后端默认…（未写入）」；布尔下拉的空选项也明确写出默认值。填写字段才写入 JSON，清空恢复省略字段，提交语义不变。
- 展示值逐项对照当前后端 `D:\tileSim\src\Core\LayerAdapters.cpp` 缺失字段回退值；这是本地源码的静态说明，不是 Bridge descriptor 提供的动态 Profile 默认，也不保证连接到异版后端时仍相同。未改契约、Bridge 或核心仿真代码，未部署 5173。

## 7. 完整门禁

以 `AGENTS.md` 为准。模块测试先行，最后运行 contracts、dependency、typecheck、Vitest、lint、format、build、Bridge unittest、fixture E2E 和 `git diff --check`。需要 deployed/live 服务的测试必须保持独立并准确报告 skip。

## 8. 交接报告必填

- changed files 和职责边界；
- identity/revision 是否变化；
- canonical、uint64、stale、409、502/503/504、citation 与 retention 回归；
- fixture/live/calibration/held-out 各自状态；
- 全部门禁和 skipped 项；
- 是否操作 5173、credential、Provider、run、commit 和 push。

## 9. Phase 2 契约与 lowering 状态

- Phase 2A 候选已由 Phase 2B 正式发布并提交（`4d7f9fa`）。契约包位于
  `bridge/contracts/agent_orchestration_phase2/`，包含五类 Profile v2、Profile Binding、Run Intake、Validation、
  Calculator Receipt 与幂等/留存 policy。
- 发布覆盖 Schema、严格 validator、manifest 与生成 TypeScript/Ajv。`/api/runs` 仍不接受 Run Intake v2，真实
  Profile、calculator 与 held-out validation 仍 unavailable。WP-2C-01a/01b 已在工作树接入 `registry.py` 并注册
  `POST /api/agent/run-intake-preview`（只读预览），但该端点不做执行路由，见 §2。
- 后端已提交 Phase 2C `parse_run_intake_v2` / `lower_run_intake_v2` 与只读 CLI 入口；执行侧因五类 Profile records
  为空而 fail closed。**Bridge 侧尚未与 lowering 接线**（只读预览端点不触达 lowering）。
- 阶段记录已归档：Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、Phase 2B 发布见
  `docs/archive/agent-orchestration/phase-records/`。

## 10. 第七阶段逐请求归因错误契约与 Schema identity（工作树）

- 重复 `request_id` 在请求归因路径返回稳定的
  `REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED`，并携带 `/requests/<n>/request_id` 与原因中的相关元素指针；普通运行仍使用
  `range_execution_failed`。CLI 失败不写入归因 payload，Bridge 持久化 `cli_error_code`、`cli_field_path`、`cli_cause`、
  `cli_next_action`，前端归因入口显示失败事实、修复动作与重试入口。
- Schema-set revision 唯一由 `bridge/contracts/schema_set.py` 对当前 JSON 契约集合计算；Bridge manifest 与
  `contracts:check` 均复用并校验该 canonical 值。当前工作树 revision 为
  `sha256:5ccd91c7457235b67ee9bc6731c887ca580bdf8bb74e171f9ef5fc56a8614b55`；历史阶段报告中的 revision 保留为历史记录。
- 本阶段只覆盖本地 synthetic hosted execution、临时 Bridge 和前端测试；不开放真实 GPU、Provider、校准或 held-out validation，
  也未操作 5173、提交或部署。

### 2026-10-13 启动器本地部署增量复用（当前工作树，未部署）

- `scripts/deploy-local-backend.ps1` 新增显式 `-ReuseVerifiedArtifacts` 快速路径和 `-ForceFullValidation` 安全回退开关。启动器的“重新部署当前代码”默认请求快速路径：只有当前后端 revision、后端源码 digest、build digest、WSL 发行版、CLI 路径及 SHA-256、已记录 CTest 结果，以及 Web immutable release 的源码 digest、schema revision、受控 release 路径和 release/Bridge/static 校验全部一致时才复用；证明不足即回退原完整构建/测试流程。
- 后端未变化时复用已验证 CLI 与 CTest；Web 未变化时通过 `release-snapshot.mjs verify` 复用 immutable release；Web 有变化时仍执行契约生成物 drift check、schema-set check、Bridge `py_compile` 和生产构建。勾选“强制完整验证”或直接调用脚本不带快速开关会重新运行原有后端构建、CTest、Bridge/Web 测试和 Web 构建。
- 快速路径不改变 manifest identity、source/build digest、schema-set revision、immutable release、rollback 或 5173 重启语义；manifest 记录复用状态，后续启动也会复核 CLI SHA-256。启动器 fixture、Rust 单测/Clippy、组件和 fixture E2E 已复验；本轮未完成真实部署、未读取 credential、未调用 Provider、未操作用户 run、未提交或推送。一次误触发的脚本检查在进入 manifest/重启阶段前被中断，仅留下仓外增量构建缓存；检查开始时 5173 曾由既有 PID 监听，随后在清理该检查产生的 WSL 子进程后观察为未监听，未执行启动或重启操作，需由用户决定是否恢复服务。
