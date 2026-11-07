# 算子、Kernel 与执行划分接入：当前基线

本文件是该模块 current baseline。当前实现位于未提交工作树；没有部署或替换 5173，后端仓库没有本任务写入。仓库原有未提交修改全部保留。

## 用户流程与状态归属

实验页的四种执行来源互斥：默认模型、Kernel 策略、TileLang 源码、执行划分。默认模式不发送 execution_input；选中其他来源后必须完成当前请求的真实 CLI 校验。来源、模型、请求、后端身份或 schema revision 改变都会使收据失效。无效 JSON、数组及上传文件使提交关闭，保留上一次可编辑文档但不能拿旧配置创建运行。

- `kernel-authoring` 拥有草案、结构校验、来源切换、选择与校验收据；descriptor 使用 TanStack Query，key 含 backend identity 与 schema revision。
- `execution-partition-editor` 拥有节点、依赖、资源、窗口、缓冲池及只读拓扑预览，通过公共 index.ts 协作。
- `run-experiment` 组装正式 CreateRunRequest；ExperimentView 只编排。
- `execution-inspector` 校验输入/CPU 结果/资源操作工件并显示来源及 Pointer；`execution-replay` 复用原游标和播放状态，不新增第二套控制器。
- 工件 Query key 含 run ID、backend identity、schema revision、artifact SHA256。SHA/字节数/run 绑定检查失败不会展示为有效证据。大整数沿用 lossless-json，显示差值使用 BigInt。

## 正式 Bridge 合同与后端路径

新增 `execution-input.schema.json`、`operator-execution.schema.json`、`operator-validation.schema.json`，扩展 create-run-request / run / bridge-api / OpenAPI，重新生成客户端与类型。custom-run-inputs 保持 runtime_trace + topology 原合同，不塞入未声明字段。

`GET /api/operator-execution` 对身份匹配的当前 CLI 在临时目录执行三种来源的准入探测，返回每种 available/unavailable 与原因。身份不匹配时 fail closed。`POST /api/operator-execution/validate` 使用完整 CreateRunRequest 执行同一准备和真实 CLI；创建运行还会再次准入，不能重用过期浏览器收据绕过后端校验。探测和校验使用现有 Week7 CLI 互斥槽。

| 模式                | 运行输入与实际路径                                                                               | 消费检查                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Kernel strategy     | 结构化 `kernel_execution` 注入冻结 trace 的 `dense_execution.kernel_execution`                   | 每个配置 selector 都必须出现在报告的 explicit Kernel 策略中                        |
| TileLang source     | 上传源码作为数据交给后端受信 AST parser，生成 program，放入 `dense_execution.tilelang_kernels[]` | 每个 selection_id 都必须报告 source Kernel SHA；形状/实例/Rank/输出组合由 CLI 准入 |
| execution partition | 冻结 `input-execution-partitions.json`，传入 `TileSimCLI run --execution-partitions <文件>`      | 后端必须报告 partition_operations；窗口未匹配或未消费由 CLI 拒绝                   |

统一执行命令走既有 `services/execution.py` 的 TileSimCLI `run --mode dev --from S1 --to S6 --fidelity-policy des --trace ... --topology ...`，收集 execution envelope、request attribution、runtime 和 execution replay。运行后再次验证配置消费；缺失则 failed，不会创建 completed 假证据。

当前 Run Intake 限定显式 custom inputs、s1_des_example、DES，拒绝与 overrides、trace package、design-space candidates 混用。只允许 closed schema 字段。禁止用户注入完成时间、物理 KV 状态或网络完成事件。Kernel 策略配置覆盖整 phase/operator，按实例策略选择后端尚不支持，UI 明确 not_covered。

TP1 的 device-only 运行可以真实没有网络窗口。此类运行不请求旧 run-bound DES package（该包要求非空网络窗口）；request-attribution 只在匹配本运行 input-execution 且网络集合为空、网络等待为 0 时允许空网络证据。这不会伪造网络活动。

上传 Python 不被 import/eval；Bridge 用 `python -I` 调用后端维护的 `scripts/kernel_bridge/tilelang.py` 对源码做 AST lowering。此受信 parser 需要与部署一起存在。materialized 程序另调用真实 `TileSimCLI run-kernel-program`，保存独立 CPU 语义结果；structure_only 不要求物化数值 payload，不因超出数值预算而禁止结构执行。

## 编辑和证据覆盖

Kernel 支持硬件/策略/网格/source_reference 结构编辑、增加/复制/删除、aggregate/expanded、同一文档高级 JSON、重复 selector、dtype、线程/寄存器/共享内存检查。launch grid、实际模型形状与策略消费最终由 CLI 核验，错误保留字段路径。

TileLang 支持上传/粘贴源码、arguments JSON 上传/结构/JSON 编辑、float16/bfloat16、phase/operator/精确实例、多 selection、rank_programs、rank_cost_profiles JSON、输出策略/有限槽/准入策略。条件不满足的 output 选项禁用并说明原因。显示结构、形状、payload 预算、结构模式和可执行性各自的状态；CLI 收据显示实际 SHA、selected function、M/N/K、分块、stages、workers、threads、lowering、input values、cost/claim scope。

划分支持 program/model/revision、请求阶段与 token 窗口、device/allreduce/sendrecv 资源、placement/stream、依赖、buffer producer/consumer/capacity 与来源。预览检查重复身份/窗口、缺失依赖、环、窗口覆盖、拓扑参与方、字节数、缓冲 placement 和部分静态死锁风险；CLI 执行检查实际窗口消费和缓冲死锁。覆盖检查不证明算子集合数值等价。

执行页提供配置/源码 SHA、原始输入、Kernel timing、片段、Rank、tensor 坐标、服务/排队/资源、动态 buffer pool 字段、依赖、原始 Pointer 和回放深链。回放复用已报告片段/Kernel launch、buffer grant/阶段事件及请求指标区间，与设备/集合通信/Fabric 共用时间游标。未独立报告的 operator/wave 区间仍 not_covered，不按 wave_count 生成时间。CPU timeline 单独显示 start/begin/done、worker/task/k、slot/state/owner/mask、队列、资源与依赖。

输入工件 `input-execution` 保存冻结文档、lowered dense、配置 SHA、源码/程序 SHA 与 run ID；`input-execution-partitions` 保存 CLI 使用的划分；`source-semantics` 保存各程序 CPU 状态/结果或结构模式 not_covered 原因。所有工件各有清单 SHA256。

## 声明范围与未覆盖能力

- program schema：`tilesim.tilelang_kernel_program.v1`；lowering：`declared_async_ring_v1`。
- input values：`bounded_integer_A3K5mod7_B2N3mod5_v1` 或 `not_materialized_execution_structure_v1`。
- cost scope：`declared_uncalibrated_not_compiled_gpu_timing`。
- source claim scope：`cpu_source_semantics_and_synthetic_consistency`；划分及策略是 synthetic consistency / exploratory。
- Kernel timing：`modeled_synchronized_waves_not_measured_cta_timing`。
- CPU 数值语义、合成一致性、声明成本、真实 Trace、真实校准及 held-out validation 分开表达。没有 GPU 编译、逐 CTA 实测、GPU numerical correctness、真实校准或 held-out 验收。
- 后端 strict source subset 支持声明式 Persistent lowering；这不等于通用 persistent Kernel 策略或实际 GPU persistent 执行。策略不支持 persistent、Split-K、任意映射/PTX/SASS、自动调优。
- 当前显式 TP2/rank/有限输出仅在后端实际准入范围内，未开放任意异构 Rank、MoE/PD 等冲突组合或 Web restore 提交。
- descriptor fingerprint 等后端未报告字段保持 missing；完整分 wave/独立 operator 时间区间不由前端补造。

## 验证与复现

隔离 native 测试使用 `D:/tileSim/build-msys-topology-20261031/TileSimCLI.exe`，SHA256 `6073b64576eee4cf966abc8eab4ac512899bb1e89d75ec53fbcae79ce7990132`。测试 harness 身份仅绑定此二进制，不声明它与当前 dirty 后端源码一致。生产身份不匹配仍 unavailable，未修改生产身份策略。

运行 native 浏览器测试前，在独立终端启动 `tests/e2e/operator-native-bridge.py --port 5189` 与 Vite 4185，配置 `TILESIM_OPERATOR_TEST_BRIDGE=http://127.0.0.1:5189`；测试使用系统 Edge。测试运行完成后停止这些专用进程，不触碰 5173。

本模块定向单元/组件 38/38、相邻回放回归 93/93、Bridge 联合 unittest 219/219、native Playwright 7/7 已通过；Bridge native 测试覆盖三模式、源 AST 拒绝/物化限制、64 位、重复字段、完整消费检查、真实 HTTP create、显式 TP2 有限输出、allreduce/sendrecv 和缓冲。浏览器覆盖真实创建/完成/证据/游标/Pointer、CPU 独立结果、拒绝无假运行、来源不可用、unsupported schema、pending、主题、宽度及键盘。最终测试数量与全仓门禁差异见 AI_HANDOFF 最新条目。

视觉验收使用 light/dark、1440/1180 桌面与 reduced motion。Kernel 表格在内部横向滚动；长中文 program ID、SHA/路径可换行或 title 截断。pending/unavailable/unsupported 视觉用测试响应检查展示，不冒充后端成功执行；正常运行截图来自 native CLI 生成工件。

## 门禁命令与结果

| 命令                                                                                                                                                                                                | 本轮结果                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm contracts:check`                                                                                                                                                                              | pass；revision `sha256:bcdc6fe220816a68247353d8d488ad682ca3b3ee585112528e12985a71b0c2a2`                  |
| `pnpm docs:check` / `pnpm deps:check`                                                                                                                                                               | pass；60 篇 / 376 源文件                                                                                  |
| `pnpm typecheck` / `pnpm build` / `git diff --check`                                                                                                                                                | pass；build 有既有大 chunk 警告                                                                           |
| `pnpm exec vitest run tests/unit/operator-authoring.test.ts tests/unit/operator-replay.test.ts tests/components/operator-authoring.test.ts tests/components/operator-evidence.test.ts`              | 38 passed                                                                                                 |
| `pnpm test`                                                                                                                                                                                         | 1512 passed / 8 skipped / 1 failed，141 files；既有 TopologyGraphEditor 的“拓扑输入”缺英文翻译            |
| `python -m unittest test_server.py test_operator_execution.py`（bridge 目录，native Python 3.12）                                                                                                   | 219 passed；本模块 22 项，真实 native 分支本机没有 skip                                                   |
| `python -m py_compile server.py api/responses.py contracts/validation.py contracts/run_request.py contracts/execution_input.py services/execution.py services/operator_execution.py`（bridge 目录） | pass                                                                                                      |
| `node node_modules/@playwright/test/cli.js test --config tests/e2e/operator.playwright.config.js`                                                                                                   | 7 passed；需上述隔离服务与环境变量                                                                        |
| `pnpm lint`                                                                                                                                                                                         | fail；4 个既有错误：ReplayTopologyCanvas 未使用 hasReportedPath；tmp/pw-check.js、tmp/pw-replay-visual.js |
| `pnpm format:check`                                                                                                                                                                                 | fail；129 个既有文件有格式问题，包括原有 schema、源码、tmp 与生成工具文件                                 |
| 本任务新增与增量文件的 `pnpm exec eslint …` / `pnpm exec prettier --check …`                                                                                                                        | pass；AI_HANDOFF 的原有整份格式问题没有大面积重写                                                         |

全量常规 fixture e2e 与后端 CTest 本批 not-run；专项 native E2E 结果不替代它们。门禁日志与视觉 PNG 在 tmp 下，未加入版本控制。

## 维护与后续计划

保留严格来源选择和逐配置消费检查，任何扩展先修改正式 schema 再生成客户端。后续如支持按 Kernel 实例策略、恢复、独立 wave/operator 时间线、真实校准，先扩展后端 descriptor/工件合同和准入测试，再开放界面；不在前端推断缺失能力。部署时需要重新跑实际部署身份下的门禁，当前隔离 native 验证不替代生产验收。

## 本任务文件清单

新增：

- `bridge/contracts/execution_input.py`；`bridge/services/operator_execution.py`；`bridge/test_operator_execution.py`。
- `bridge/contracts/schemas/{execution-input,operator-execution,operator-validation}.schema.json`。
- `src/contracts/execution-authoring.ts`；`src/components/ExecutionInputFields.vue`。
- `src/features/kernel-authoring/{index.ts,model.ts,OperatorAuthoringPanel.vue,operator-authoring.css}`。
- `src/features/execution-partition-editor/{index.ts,model.ts,ExecutionPartitionEditor.vue}`。
- `src/features/execution-inspector/model/operator-evidence.ts`；`components/OperatorEvidencePanel.vue`；`components/SourceSemanticsPanel.vue`。
- `tests/unit/{operator-authoring,operator-replay}.test.ts`；`tests/components/{operator-authoring,operator-evidence}.test.ts`；`tests/fixtures/operator-execution.json`。
- `tests/e2e/operator-authoring.spec.js`；`operator-native-bridge.py`；`operator.playwright.config.js`。
- 本 current baseline 文档。

增量修改（文件可能同时有用户原有修改，本任务不归属整份 diff）：

- Bridge：`server.py`、`contracts/run_request.py`、`services/execution.py`、`repositories/runs.py`、`contracts/openapi.json`、`contracts/schemas/{bridge-api,create-run-request,run}.schema.json`、`README.md`。
- 生成器：`scripts/generate-bridge-client.mjs`；对应生成的 `src/contracts/generated/{bridge-client,bridge-contracts,create-run-schema,experiment-validators,agent-harness,agent-intent-validators}`。
- 前端：`src/lib/api.ts`、`src/lib/api/artifacts.ts`；`src/features/run-experiment/{request,types}.ts`；`src/features/execution-inspector/index.ts`。
- 回放：`src/features/execution-replay/{queries/useExecutionReplayQuery.ts,model/normalize.ts,model/types.ts,model/layers.ts,components/ExecutionReplayPanel.vue}`。
- 编排：`src/views/{ExperimentView,ExecutionView}.vue`；文档入口 `docs/README.md`、`docs/AI_HANDOFF.md`、前端开发参考。

`tmp/`、`test-results/`、`dist/` 是本地检查产物，不加入版本控制。本清单不包含本任务之外的已有 dirty 修改。
