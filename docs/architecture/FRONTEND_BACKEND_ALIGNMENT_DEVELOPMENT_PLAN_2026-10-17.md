# TileSim 前后端能力对齐开发计划

**计划日期**：2026-10-17  
**适用仓库**：`D:\tileSim-web`（前端）  
**对照后端**：`D:\tileSim`，`main@5e44dbb0`  
**计划性质**：活跃开发计划，不代表功能已经完成或已通过真实设备校准。

## 1. 复核结论

当前前端不是完全不能读取后端新报告，而是部分字段通过 `[key: string]: unknown` 兜底，导致数据可以进入页面，却没有稳定的类型、可视化、证据跳转和缺失语义。前端现状应定义为：

- 基础运行、回放、Trace Package 元数据和部分 PD 汇总已经存在；
- 请求级 KV/设备/网络等待、Profile lineage、网络归因子区间、多 Rank 证据链仍未完整表达；
- 输入表单仍以旧的版本化引擎子集为准，不能直接把后端 Dense host 的全部字段视为已发布能力；
- 所有展示仍必须区分真实观测、合成 Trace、兼容性抽取、模型推断和校准声明范围。

本计划只覆盖前端与 Web Bridge 契约的对齐，不把模拟器功能实现、真实 GPU 采集或真实网络校准伪装成前端完成项。

## 2. 本次复核的关键事实

### 2.1 后端报告已存在的字段

后端 `include/Core/SimulationTypes.h` 和 `src/Core/SimulationTypes.cpp` 已序列化以下请求级字段：

- 等待：`network_wait_ps`、`network_backpressure_ps`、`kv_wait_ps`、`kv_allocation_wait_ps`、`kv_pressure_wait_ps`、`kv_remote_read_wait_ps`、`kv_migration_wait_ps`、`kv_pd_handoff_wait_ps`、`device_wait_ps`、`collective_wait_ps`；
- KV 规模和身份：`kv_bytes_read`、`kv_bytes_migrated`、`kv_eviction_bytes`、`kv_source_identity`、`kv_destination_identity`、`dominant_kv_wait_reason`；
- Profile lineage：`device_profile`、`device_profile_selection`、`device_profile_asset_id`、`device_profile_claim_scope`，以及对应的 Network Profile 字段；
- PD 关联：阶段贡献中的 `pd_handoff_id`、`pd_disaggregation_group_id`、源/目的 placement group；
- 尾延迟原因链中的 `network_intervals[]`，每个区间包含 component、demand、link、attempt、起止时间和证据引用。

网络 Profile 的选择值至少包括 `exact`、`interpolated`、`portable_fallback`。设备 Profile scope policy 为 `strict` 或 `matching_only`；网络 Profile scope policy 也有 `strict`/`matching_only` 语义。前端不得把 fallback 或缺证据显示成已校准。

### 2.2 后端输入能力的边界

后端 Dense execution 解析并校验 `pd_prefill_device`、`pd_decode_device`、`pd_decode_devices`、`explicit_rank_execution`、`device_placements`、`device_performance_profile`、`device_profile_environment` 和 `device_profile_scope_policy`。

但是 `src/S1_Runtime/EngineSemanticProfile.cpp` 中的 `vllm.0.6.tilesim_pd.v1` 当前：

- 支持 `disaggregated_serving`；
- 明确不支持 `prefix_cache`、`preemption_recompute`、`heterogeneous_pd`、`multi_rank_pd`。

因此“Dense host 有多 Rank 执行分支”不等于“vLLM 语义画像已发布多 Rank 能力”。前端必须以版本化 semantic profile、requested features 和后端 capability/错误返回为准，保持 unsupported 功能 fail-closed。

### 2.3 Trace Package 的真实现状

前端已有 Trace Package catalog/inspect API、来源模式、校准级别、claim scope、manifest SHA、六类角色和完整性状态展示，相关文件包括：

- `src/features/run-experiment/TracePackageInputPanel.vue`
- `src/lib/api/trace-packages.ts`
- `bridge/contracts/schemas/trace-package-catalog.schema.json`
- `bridge/contracts/schemas/trace-package-inspect.schema.json`

当前 Web schema 仍只承载基础 `artifact_integrity`。后端 CLI/core 文档描述的对象计数、`evidence_only`/`executable`、observed/inferred、snapshot digest 和 `TRACE_OBJECT_*` 细节，必须先确认 Bridge 是否实际暴露；若未暴露，前端不得从 package ID 或现有摘要猜测，应提出 Bridge contract 扩展或明确标记 unavailable。

## 3. 开发原则与不变量

1. 先读 `D:\tileSim-web\AGENTS.md`、本计划和 `docs/getting-started/AI_FRONTEND_DEVELOPMENT_REFERENCE.md`；保留当前工作树用户改动，不执行 `reset --hard`、`checkout`、全量覆盖或无关格式化。
2. 修改生成契约时，源文件优先于生成文件；按项目脚本运行 `contracts:generate`/`contracts:check`，不得只手改 `src/contracts/generated/*`。
3. 后端大整数时间、字节数和计数继续使用 `LosslessInteger`，不得直接转换为普通 JavaScript `number`。
4. 缺失、零值、`not_applicable`、`not_covered`、`fallback` 和 `unavailable` 必须可区分；不能把缺字段渲染成 0。
5. KV/设备/网络分项等待可能重叠。页面可以并列展示，但不得把分项简单相加替代父级等待或请求延迟。
6. `network_intervals` 是父等待的解释区间，不是额外延迟；前端不重算后端归因总和。
7. 真实 Trace、synthetic Trace、compatibility harness Trace 及其 claim scope 必须显式展示；合成一致性不能写成真实校准。
8. 动态调度和回放继续分开；不支持的引擎特性、Trace 关联或 Profile 条件必须明确拒绝或显示受限状态。
9. 不因本地前端测试、Bridge mock 或仿真成功宣称真实 GPU、真实网络、held-out validation 或年度保真度通过。

## 4. 工作包与依赖

### P0：结果契约和诊断闭环

| ID     | 工作包             | 主要文件                                                                                                   | 当前状态                                   | 开发内容                                                                                                                                                  | 验收门                                                                            |
| ------ | ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| FE-C01 | 报告模型补齐       | `src/contracts/report-model.ts`、`src/contracts/bridge-api.ts`                                             | 旧字段明确，新字段多由 unknown 兜底        | 为 RequestMetric、PhaseFabricContribution、RequestFabricContribution、CauseItem、system summary 建立明确类型；补等待、KV、Profile、PD 和 network interval | TypeScript 能直接访问新字段；所有 ps/bytes/count 保持 lossless；旧报告仍可解析    |
| FE-C02 | 请求级等待诊断     | `src/views/MetricsView.vue` 及请求详情组件                                                                 | 只显示吞吐、TTFT、TPOT、E2E、decode steps  | 增加 KV、网络、设备、集合通信等待；KV 分项、字节、源/目的身份、dominant reason；重叠说明和 unavailable 状态                                               | 对完整、新旧缺字段、零值三种 fixture 渲染正确；不把缺字段变成 0                   |
| FE-C03 | Profile 命中与回退 | `src/features/execution-inspector/model/records.ts`、`stats.ts`、相关展示组件                              | 只显示基础 device profile/延迟             | 显示 profile ID、selection、asset ID、claim scope、match/fallback/not-covered；统一设备和网络语义                                                         | `exact`/`interpolated`/`portable_fallback`/空值均有明确文案和证据入口             |
| FE-C04 | PD/多 Rank 证据链  | Metrics、Execution Inspector、Fabric 详情                                                                  | 已有部分 PD 汇总和请求字段，但缺请求级链路 | 展示 handoff、disaggregation group、源/目的 placement group；在已有证据引用能力内串起 request → phase → KV/network demand → wait                          | 单 Rank、已声明多 Rank、无 handoff 三类报告均不误判；无证据时显示 unavailable     |
| FE-C05 | 网络子区间归因     | `src/views/AttributionView.vue`、`src/features/execution-inspector/components/RequestAttributionPanel.vue` | 原因链未展开 `network_intervals`           | 支持 queue、serialization、service、propagation、completion、retry、release、unresolved；显示 demand/link/attempt/evidence refs                           | 子区间可折叠、可定位，且明确“解释父等待，不额外累加”                              |
| FE-C06 | Coverage 扩展      | `src/features/report-coverage/model/metrics.ts`                                                            | 只覆盖旧 request metrics 和部分 PD summary | 为 KV、wait、Profile、PD identity、network intervals 增加 JSON Pointer 和状态分类                                                                         | coverage 可区分 missing/not applicable/not covered/fallback；指针与真实 JSON 对齐 |

### P0：运行输入和 Bridge 边界

| ID     | 工作包                 | 主要文件                                                                                                         | 当前状态                                   | 开发内容                                                                                                                                    | 验收门                                                                                                    |
| ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FE-I01 | 引擎/PD 输入矩阵       | `src/features/run-experiment/runtime-engine.ts`、`RuntimeEngineForm.vue`、`RequestTableForm.vue`、生成 validator | 前端仍静态隐藏 `vllm.0.6.tilesim_pd.v1`    | 对齐已发布 semantic profile 和 feature 列表；开放前置条件完整的单 Rank PD；多 Rank 只有在后端 capability 明确发布时开放                     | 版本、requested_features、placement、handoff、回放/动态约束和后端错误路径一致；unsupported 仍 fail-closed |
| FE-B01 | Bridge applicability   | `bridge/services/execution.py`、相关测试                                                                         | `dense_request_evidence` 依赖旧启发式条件  | 复用后端 inspect/capability 或明确的 contract 字段；不要自行用 TP/domain 数量推断 dense attribution 适用性                                  | CLI/Bridge/页面对相同输入给出一致适用性和失败码                                                           |
| FE-T01 | Trace Package 对象检查 | `TracePackageInputPanel.vue`、`src/lib/api/trace-packages.ts`、Bridge schema                                     | 已有 catalog、provenance、完整性、六类角色 | 先确认 Bridge 输出；能取到时展示对象数量、usage、observed/inferred、snapshot digest、逐项错误；取不到时显示 unavailable 并记录 contract gap | 不从 package ID 猜测；完整性通过不等同于校准通过；`TRACE_OBJECT_*` 保留 role/location/code/message        |

### P1：高级输入、深层追溯和测试资产

| ID     | 工作包                       | 主要文件                                   | 开发内容                                                                                                          | 验收门                                                               |
| ------ | ---------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| FE-I02 | Dense Execution/Profile 输入 | 运行输入组件、schema、参数目录             | 增加只读摘要，随后提供严格结构化编辑：device profile、环境、scope policy、PD 设备组、显式 rank、device placements | 字段有 schema、引用校验和后端错误映射；不以设备名称替代 profile 身份 |
| FE-T02 | 六类 Trace 关联视图          | Trace Package 与 Execution 详情            | 在后端实际提供索引时展示 request→batch→iteration→execution→KV→network flow 的可追溯链                             | 每条跳转保留 package/run/snapshot 身份；缺关联时明确显示缺口         |
| FE-C07 | 来源和声明范围               | 报告头、Metrics、Validation、Trace 页面    | 统一显示 source mode、calibration level、allowed/effective claim scope、observed/inferred                         | synthetic/compatibility/real 及 calibrated/held-out 不混写           |
| FE-I03 | Network Profile 绑定输入     | 网络配置和 schema                          | 对齐 `profile_timing_scope`、`profile_scope_policy` 和 lineage 字段                                               | strict/matching_only 语义清楚；多跳/聚合不被前端拆成单跳假设         |
| FE-Q01 | 兼容 fixture                 | `tests/`、必要 fixtures                    | 建立旧报告、完整新报告、缺字段、零值、单 Rank PD、多 Rank 声明、不同 profile selection、不同 provenance fixture   | 测试覆盖结果契约、渲染和回退状态                                     |
| FE-Q02 | 语义边界回归                 | `tests/unit`、`tests/components`、必要 E2E | 覆盖动态/回放隔离、unsupported fail-closed、lossless、evidence link、snapshot/manifest 绑定                       | 定向测试和全量门禁均可复现；不依赖真实 Provider/GPU                  |

### P2：统一体验和可视化

- FE-U01：统一“等待原因—数值—证据—来源—声明范围”诊断组件，避免 Metrics、Execution、Attribution 各自定义一套文案。
- FE-U02：长时间戳、字节和事件计数的格式化及大数据量渲染优化，保留 lossless 语义。
- FE-U03：多 Rank/placement/handoff 的拓扑证据图；只表达仿真对象，不宣称真实物理拓扑。
- FE-U04：快照不一致、Trace 对象错序、关联缺失、Profile 不适用时提供可操作的失败说明。
- FE-U05：在报告入口统一标识 Analytical、DES、Cycle、synthetic consistency、real-trace calibration 和 held-out validation 的范围。

## 5. 推荐实现顺序

```text
FE-C01 ─┬─> FE-C02 ─┬─> FE-C04
        ├─> FE-C03 ├─> FE-C05
        └─> FE-C06 └─> FE-C07

FE-I01 ─> FE-B01
FE-T01 ─> FE-T02
FE-C01 + FE-I01 + FE-T01 ─> FE-Q01/FE-Q02
P0 全部通过 ─> FE-I02/FE-I03 ─> P2 体验项
```

首个可交付切片应是：

1. 明确报告和 Bridge 读取类型；
2. Metrics 展示请求级等待与 KV 诊断；
3. Execution 展示 Profile lineage；
4. Attribution 展开网络子区间；
5. 运行配置不再错误隐藏已发布的单 Rank PD，同时继续拒绝未发布的多 Rank semantic feature；
6. 完成旧/新/缺字段 fixture 与定向测试。

## 6. 验收与证据要求

每个工作包完成时至少记录：

- 变更文件和契约来源；
- 定向单元/组件测试命令及结果；
- `pnpm typecheck`、`pnpm contracts:check`、相关 lint、生产构建和 `git diff --check` 状态；
- 若涉及 Bridge schema，说明是否重新生成类型，以及 schema-set revision 是否变化；
- 若后端字段尚未通过 Bridge 暴露，明确记录为 contract gap，不用前端 mock 冒充真实运行能力；
- 所有报告结论注明是本地 synthetic consistency、compatibility cross-check、real calibration 还是 held-out validation。

建议 P0 完成门：

1. 旧报告和新报告均可打开；
2. 缺字段、零值、fallback、not-covered 均显示正确；
3. 请求级 KV/network/device/collective 等待可查看且不重复计时；
4. Profile 和 Trace provenance 可追溯；
5. 网络子区间可展开且父子关系说明清晰；
6. 动态与回放、支持与不支持语义没有静默转换；
7. 全量前端门禁通过，未覆盖的真实校准边界在交付记录中明确保留。

## 7. 需要新 agent 避免的错误

- 不要因为类型上有 `[key: string]: unknown` 就把字段当成已支持；
- 不要把 `vllm.0.6.tilesim_pd.v1` 的 Dense host 多 Rank 代码等同于 semantic profile 已支持 `multi_rank_pd`；
- 不要在前端根据 package ID、TP 数量、设备数量或 domain 数量猜测 Trace/归因适用性；
- 不要把 `portable_fallback`、synthetic trace 或 uncalibrated profile 展示为真实测量；
- 不要修改用户工作树中与本计划无关的现有改动；
- 不要用 `number` 替换已有的 lossless 时间/字节/计数表示；
- 不要把网络子区间、KV 分项等待或并行阶段简单求和为新的端到端延迟。

## 8. 2026-10-17 前端对齐复核记录

本轮前端已完成并验证：

- 请求归因按 `selectedRequestId` 严格匹配 `explained_entity.kind=request`；请求缺失、重复或空报告均失败关闭，不再回退到第一条报告。
- Metrics 和请求延迟图按 `has_ttft_sample`、`has_tpot_sample`、`has_end_to_end_latency_sample` 区分有效样本、未采样、不可用、推断、synthetic、fallback 与未校准结果。
- RequestMetric、设备汇总、KV/network/device/collective 等待、Profile lineage、PD handoff 与 `network_intervals` 已建立前端类型和展示；网络区间只解释父级等待，不重复计费。
- Bridge applicability 只接受后端显式布尔值；缺失时保持 `unknown/unsupported`。Trace Package 尚未暴露对象数量、`evidence_only/executable`、observed/inferred 和 snapshot digest，页面保持 unknown 并记录 contract gap。
- 后端 runtime event、runtime request、artifact bytes、run digest count 以及兼容报告摘要的 uint64 字段已在源 Schema 使用 lossless uint64 定义，并通过 `pnpm contracts:generate` 生成前端类型；比较、排序和格式化不再接受不安全 number。
- `metrics-report.schema.json`、`tail-cause-chain-report.schema.json` 与 `request-attribution.schema.json` 已补齐请求级等待/KV/Profile、设备汇总、PD handoff、fabric contribution、`request_network_wait_intervals`、`network_intervals` 和 attribution ranking 的正式字段定义；对应 TypeScript 与 Ajv 输出均由 `pnpm contracts:generate` 生成。

本轮验证结果与未完成的 Bridge contract gap 以交付报告为准；本地 synthetic fixture、CI 结果和 fallback 结果不代表真实 GPU、真实网络校准或 held-out validation。
