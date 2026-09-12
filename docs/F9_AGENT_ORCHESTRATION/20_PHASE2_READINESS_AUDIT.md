# Phase 2 Definition of Ready 审计

> 文档 ID：`AO-20`
>
> 事实日期：2026-09-11
>
> 阶段状态：`blocked`（仅既有 Phase 1 八字段切片为 `partially_ready`）

> 后续复审：Phase 2D registry 虽已达到 `pre_commit_ready`，Phase 2E DoR 复审仍为
> `blocked_data`/`blocked_calibration`/`blocked_contract`/`blocked_backend`；见
> [Phase 2E DoR 审计](25_PHASE2E_DOR_AUDIT.md)。
>
> Web 审计基线：`32a8703d66d9b4acd5ca6e4661a5608f6ce33720`
>
> 后端审计基线：`a876859a44f660c4627dab495034d52b4ae61f57`
>
> 不可变 execution-evidence revision：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`

## 1. 裁决

完整 Phase 2 不满足 Definition of Ready，必须停止实现。当前只可继续使用 Phase 1 已发布的八字段本地草案切片；
不得新增 model、engine、device、card count、TP/PP/EP、placement、物理 KV、集合通信算法、工作负载模板或 SLO
的 `agent_exposed` 能力。

阻塞由三类独立事实共同形成：

1. 正式 Capability Catalog 的 model、engine、device、topology、workload 五类 Profile 记录全部为
   `0/unavailable`，且 published v1 Schema/runtime validator 主动把记录数冻结为零；
2. `tilesim.bridge.create_run_request.v1` 没有 Phase 2 字段或已发布 successor，Phase 1 草案也不是正式 Bridge Draft；
3. 后端已有若干模块局部原语和手工运行时 Trace 累计链，但工作负载描述语言、TP/PP/EP、物理 KV、生产执行片段、
   集合通信和网络反馈尚未由 Phase 2 正式输入累计闭合。

因此，本批不实施 `WP-PROFILE-02` 至 `WP-LOWER-01`，不启动 `phase2_web_eval`，不修改 OpenAPI、Schema-set、
generated types/client、manifest、App Shell、共享 store 或运行时 descriptor。

## 2. 审计范围与安全边界

审计读取了 F9 Agent 编排规范、Phase 0/1 源码与测试、Bridge Capability Catalog/OpenAPI/Schema/runtime validator，
以及后端工作负载描述语言、三引擎语义 Profile、模型执行调用与执行片段、KV Cache、设备性能、集合通信、网络、
Trace package、场景与探索编排、校准、provenance、execution evidence 和累计链测试。

本批只进行了只读源码/运行时身份检查和测试。没有读取 Provider credential，没有调用 live Provider，没有创建正式 run，
没有访问部署 worktree 进行设计或写入，也没有停止、重启、替换或部署 `127.0.0.1:5173`。

## 3. 仓库、worktree 与运行时身份

| 项目                        | 当前事实                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Web                         | `D:\tileSim-web`，`HEAD == origin/main == 32a8703d...`，审计开始时工作树 clean                                                         |
| 后端                        | `D:\tileSim`，`HEAD == origin/main == a876859a...`；既存未跟踪 `build-local/` 原样保留                                                 |
| 后端部署 worktree           | `D:\tileSim-backend`，detached `a876859a...`，仅核对 worktree identity                                                                 |
| Web 其他 worktree           | detached review worktree `a0d57c8785ff6dad2c0aa9d7110092dbcf50ad7f`                                                                    |
| execution evidence          | `7e5a8c6a...` 可由 Git 解析，位于 `codex/phase0d-backend-evidence-clean`；三条引用测试路径与当前 HEAD 内容等价                         |
| Schema-set                  | `sha256:3211d2df2e166a0ebc62f0f08ad014bf15fee8fb4bda79f3372897be3c28c15d`                                                              |
| Capability Catalog          | `tilesim.bridge.agent_orchestration_capability_catalog.v1` / `sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b` |
| Capability contract package | `sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3`                                                              |
| create-run                  | `tilesim.bridge.create_run_request.v1`                                                                                                 |
| nested design-space         | `tilesim.design_space.s6_candidates.v1` 和 `.v2`；默认 v1                                                                              |
| Evidence Agent              | descriptor `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1                                   |
| Phase 1 local contract      | `tilesim.web.agent_orchestration.phase1.local.v1`                                                                                      |

上表 Schema-set 的正式完整值为
`sha256:3211d2df2e166a0ebc62f0f08ad014bf15fee8fb4bda79f3372897be3c28c15d`。为避免手工转录错误，最终值必须以
`bridge/contracts/openapi.json`、`GET /api/manifest` 和 generated contract drift gate 为准。

对 5173 只执行了允许的 identity GET：`/api/manifest` 和 `/api/experiment-schema` 返回上述 identity；
`/api/health` 与 `/api/agent/orchestration-capabilities` 在 5 秒只读超时内未返回。该超时未通过重启、替换或部署规避，
也不改变源码契约的 fail-closed 裁决。

## 4. DoR 逐项裁决

| #   | 审计问题                                                                   | 裁决                  | 当前证据与结论                                                                                                                                                           |
| --- | -------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 是否存在正式 model Profile 数据                                            | `blocked_data`        | Catalog model record `0/unavailable`；只有 published Schema，没有正式模型记录                                                                                            |
| 2   | 是否存在正式 engine Profile 数据                                           | `blocked_data`        | Catalog engine record `0/unavailable`；后端三个最小语义 Profile 是 `partially_ready` 前置，不是 Catalog record，也不能由 create-run 选择                                 |
| 3   | 是否存在正式 device Profile 数据                                           | `blocked_data`        | Catalog device record `0/unavailable`；`analytical_default` 和硬编码模型参数不计正式或实测 Profile                                                                       |
| 4   | 是否存在正式 topology Profile 数据                                         | `blocked_data`        | Catalog topology record `0/unavailable`；custom topology input 不是 immutable reusable Profile registry                                                                  |
| 5   | 是否存在正式 workload Profile/Template 数据                                | `blocked_data`        | Catalog workload record `0/unavailable`；工作负载描述语言和 synthetic loader 不是 published template registry                                                            |
| 6   | Profile 是否具备 identity、revision、source、license、valid regime、expiry | `blocked_contract`    | v1 envelope 有 identity/revision/digest 与粗粒度 source mode，但缺结构化 source reference/revision、license、valid regime、expiry/lifecycle；且无 record                 |
| 7   | observed、inferred、modelled 是否分开                                      | `blocked_contract`    | 正式 v1 没有 per-fact 分类字段；历史 proposal fixture 不能升级为 runtime contract                                                                                        |
| 8   | calibration 和 held-out validation 是否准确声明                            | `blocked_calibration` | 当前全部明确声明 missing，声明本身准确；没有可支持 Phase 2 结论的真实校准或独立 held-out 资产                                                                            |
| 9   | 模型、设备、卡数、TP/PP/EP 是否进入正式 request                            | `blocked_contract`    | create-run v1 只含 scenario/fidelity/gpu mode/八字段 overrides/custom runtime trace+topology/design-space/trace package；无 Phase 2 字段                                 |
| 10  | 字段是否真实 lowered/executed                                              | `blocked_backend`     | TP 和 placement 有旧 Trace/局部传播，PP/EP/正式卡数和 Profile selection 未形成托管执行闭包                                                                               |
| 11  | 是否累计影响执行片段、KV、集合通信、网络事件和请求指标                     | `blocked_backend`     | 手工运行时 Trace 的已建模 DES 链可闭合，但不能证明 Phase 2 正式字段；生产路径没有调用通用 `ExecutionFragmentBuilder` 完成该转换                                          |
| 12  | 是否有 create-run successor 或正式 workload intake                         | `blocked_contract`    | 仍只有 create-run v1；`trace_package_id` 是既存包引用，不是 typed workload-template/Phase 2 intake                                                                       |
| 13  | 是否有确定性 Validation Report contract                                    | `blocked_contract`    | `tilesim.validation_report.v1` 是运行后 `run_id/checks` 报告；Phase 1 issue/draft 是本地 contract，二者都不是 Phase 2 draft/profile/calculator/compiled-request 绑定报告 |
| 14  | 是否有足够证据让 Phase 2 字段成为 `agent_exposed`                          | `blocked_backend`     | 正式集合仍只有既有八字段；所有 Phase 2 字段必须继续 fail closed                                                                                                          |

## 5. 五类正式 Profile 清单

这里的 identity/revision 是 **Profile family Schema**，不是实际 Profile record。由于记录数为零，不存在可报告的
profile identity、profile revision、source 或 availability 个体值。

| Family   | 正式记录数 | Family Schema identity                                   | Schema revision                                                           | 数据/运行时状态                   | 校准/held-out     |
| -------- | ---------: | -------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- | ----------------- |
| model    |          0 | `tilesim.bridge.agent_orchestration_model_profile.v1`    | `sha256:e06ad8cc9519785452d8658606ee11d46b2366d4325f6b2499083e482b3d4bd4` | `profile_missing` / `unavailable` | missing / missing |
| engine   |          0 | `tilesim.bridge.agent_orchestration_engine_profile.v1`   | `sha256:8d778f13edcc0fa8a2fac0c1414955ac4cd66477a03584a82d6daf5663cb49db` | `conditional` / `unavailable`     | missing / missing |
| device   |          0 | `tilesim.bridge.agent_orchestration_device_profile.v1`   | `sha256:354ca8377a64ec1b53c196b505cc156ae1d1d25cc7baf94fc0d8b984ea122c96` | `profile_missing` / `unavailable` | missing / missing |
| topology |          0 | `tilesim.bridge.agent_orchestration_topology_profile.v1` | `sha256:2acb2127e3eb93d82438a32972526c75d12b6bb0eebc8cb003d691fa237b0458` | `profile_missing` / `unavailable` | missing / missing |
| workload |          0 | `tilesim.bridge.agent_orchestration_workload_profile.v1` | `sha256:ab4517a4d7ba52fe7c2b80f00e0a8b0083468bc0ba88125a15f525ef0e63f836` | `profile_missing` / `unavailable` | missing / missing |

权威记录位于
`D:\tileSim-web\bridge\contracts\agent_orchestration_capability\catalog-content.json:603`。
`common.schema.json:75`、`capability-catalog.schema.json:56` 和 `contract.py:124` 进一步证明 v1 正式语义冻结为
`actual_profile_count=0`、`runtime_availability=unavailable`、五类 record array 为空。真实 registry 必须发布 successor，
不能在同一 v1 identity 下填入静态 JSON。

后端 `src/S1_Runtime/EngineSemanticProfile.cpp` 有以下三个最小语义版本：

- `vllm.0.6.semantic.v1`；
- `sglang.0.4.semantic.v1`；
- `tensorrt_llm.0.12.semantic.v1`。

它们能校验已声明的 feature 并进入局部运行时状态机，但缺 Catalog record 所需的 immutable source/license/regime/lifecycle，
没有真实校准或 held-out，且 create-run v1 不能选择 engine。因此正式 engine Profile 数仍为零。

## 6. 当前 `agent_exposed` 基线

| 字段                                  | 正式 request Pointer                          | 当前执行闭包                                             | 证据范围                            |
| ------------------------------------- | --------------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `s0.workload.message_size_multiplier` | `/overrides/workload/message_size_multiplier` | runtime message bytes → network demand → request metrics | exploration / synthetic consistency |
| `s1.runtime.batch_scheduler`          | `/overrides/runtime/batch_scheduler`          | runtime deterministic scheduling                         | exploration / synthetic consistency |
| `s1.runtime.max_batch_size`           | `/overrides/runtime/max_batch_size`           | batch membership/model-call path                         | exploration / synthetic consistency |
| `s1.runtime.kv_capacity_tokens`       | `/overrides/runtime/kv_capacity_tokens`       | **逻辑** KV admission only；不代表物理 KV 容量           | exploration / synthetic consistency |
| `s6.fabric.scale_up_bandwidth_gbps`   | `/overrides/fabric/scale_up_bandwidth_gbps`   | 纵向扩展网络 DES                                         | exploration / synthetic consistency |
| `s6.fabric.scale_up_latency_us`       | `/overrides/fabric/scale_up_latency_us`       | 纵向扩展网络 DES                                         | exploration / synthetic consistency |
| `s6.fabric.scale_out_bandwidth_gbps`  | `/overrides/fabric/scale_out_bandwidth_gbps`  | 横向扩展网络 Analytical                                  | exploration / synthetic consistency |
| `s6.fabric.scale_out_latency_us`      | `/overrides/fabric/scale_out_latency_us`      | 横向扩展网络 Analytical                                  | exploration / synthetic consistency |

八字段 evidence reference 全部绑定不可变 revision `7e5a8c6a...`，但 `calibrated=false`、
`held_out_validated=false`。这些字段继续属于 Phase 1 既有切片，不得用来推导模型容量、设备性能或 SLO 可达性。

## 7. Phase 2 字段到执行证据矩阵

| 能力              | stable field/profile identity                      | 正式 request Pointer                        | lowering                                               | execution/evidence                              | 裁决                                       |
| ----------------- | -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------ |
| 模型选择与结构    | 无正式 record                                      | 无                                          | 无正式 Profile lowering                                | 无                                              | `blocked_contract` + `blocked_data`        |
| 引擎选择          | 后端有三个局部 semantic version，Catalog 无 record | 无                                          | 局部 runtime 可加载；create-run 不可选                 | 局部测试，不是正式 Web 链                       | `partially_ready` / 总体阻塞               |
| 设备与显存        | 无正式 record                                      | 无                                          | `analytical_default` 不是 Profile lowering             | 无真实设备证据                                  | `blocked_data` + `blocked_backend`         |
| 卡数              | 无正式 field                                       | 无                                          | 无 rank/device/topology 累计转换                       | 无                                              | `blocked_contract` + `blocked_backend`     |
| TP                | 旧 Trace/WDL 有字段                                | 无                                          | 可到 runtime participants 和 collective annotation     | 局部路径                                        | `partially_ready`                          |
| PP                | WDL 有字段                                         | 无                                          | 无 hosted lowering                                     | 无累计证据                                      | `blocked_backend`                          |
| EP/MoE            | WDL 有字段                                         | 无                                          | hosted path 明确拒绝未接线 MoE routing                 | 无累计证据                                      | `blocked_backend`                          |
| placement         | 旧 runtime 有 `placement_group_id`                 | 无                                          | 字符串传播及部分 endpoint fallback                     | 未连接 WDL device mapping                       | `partially_ready`                          |
| 物理 KV           | 无正式 field/Profile                               | 无                                          | 当前八字段只到逻辑 admission；物理模块可独立执行       | 未由 model/device Profile 驱动                  | `blocked_backend`                          |
| 工作负载模板/分布 | 无正式 Profile record                              | 无 typed template Pointer                   | synthetic loader/Trace package entry projection        | 六类包只做 presence/hash，非逐对象原生 lowering | `blocked_contract` + `blocked_backend`     |
| 拓扑 Profile      | 无正式 record                                      | 无 Profile Pointer；有 custom topology JSON | custom topology 可执行                                 | 不是 reusable Profile resolver                  | `blocked_data`                             |
| 集合通信算法      | 无正式 field                                       | 无                                          | runtime annotation → collective state machine 局部闭合 | 无 Phase 2 algorithm/parallel selection 链      | `partially_ready` / 总体阻塞               |
| typed SLO/预算    | 无正式 SLO field                                   | 无                                          | 只有后运行 error budget 与候选数/传输数护栏            | 无 planning receipt                             | `blocked_contract` + `blocked_calibration` |

现有手工运行时 Trace 的 DES 路径可以形成：集合通信 demand → endpoint/path → queue/congestion → network completion/
backpressure → resource completion → model-call/runtime → request metrics。`tests/test_week4_cumulative_flow.cpp` 证明 message、bandwidth、
latency 会改变完成时间、execution envelope 和 P99；但该测试从相邻后端边界开始，不证明上述 Phase 2 字段的正式 lowering。

## 8. 确定性 calculator/validator 审计

当前没有一个正式 Phase 2 calculator receipt 同时包含 algorithm identity/revision、stable input/profile references、units、
rounding policy、assumptions、uncertainty/unknown、rule IDs、typed repair candidates 和 claim-scope ceiling。

| Calculator/validator             | 当前可复用原语                                                         | 缺失输出/边界                                                                             | 裁决                                 |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| model weight/memory              | 设备 analytical defaults、shape cost 原语                              | model Profile、dtype/layout、versioned algorithm、uncertainty receipt                     | blocked                              |
| KV capacity                      | page round-up、fragmentation、physical capacity/pressure state machine | model KV structure/dtype、profile refs、receipt；hosted path 仍可 auto-provision          | blocked；模块原语 partial            |
| TP/PP/EP                         | 非零、`TP × PP <= device_count`、expert/EP 整除                        | layer/head/expert/engine/topology 联合约束、rank map、typed repairs                       | blocked；结构检查 partial            |
| placement                        | device ID/endpoint existence 局部检查                                  | rank/device/domain/port/path、spare/reserved policy、receipt                              | blocked；结构检查 partial            |
| collective/network compatibility | collective preflight 和网络执行期状态机                                | unknown/incompatible planning fail-closed、Profile binding、algorithm receipt             | blocked；执行原语 partial            |
| workload distribution            | seeded uniform integer、jitter/burst synthetic generation              | 正式 template/distribution/percentile/rate/concurrency、sampling uncertainty、无损 uint64 | blocked；synthetic generator partial |
| typed SLO/budget                 | run 后 error budget、候选/传输数量护栏                                 | metric/window/scope/unit/target/evidence requirement、规划 receipt                        | blocked                              |

通过显存、整除或局部 collective preflight 不代表性能或 SLO 可达。Calculator 异常或未知输入不得回退到 LLM 估算。

## 9. 组合解析结果

`model × engine × device × topology × workload` 的正式可执行组合数为 **0**。这不是组合均“不兼容”，而是五类 Profile
记录均为空且没有正式 combination resolver；正确结果是 `unknown/profile_missing` 并阻塞，而不是生成候选或 ranking。

后端三个最小 engine semantic Profile、generic device defaults、custom topology 和 synthetic workload 不能拼接为“真实组合”。
它们的 source、license、valid regime、calibration 与 held-out 证据不满足 Phase 2 Profile contract，且 create-run v1 不表达该组合。

## 10. uint64、provenance、fidelity 与 calibration

- Phase 1 draft 使用 decimal string/BigInt 保持 uint64/decimal 无损，进入现有 bounded request builder 前才做 safe-integer 检查；
- 后端平台 contract 有大于 `2^53` 的局部 uint64 fixture，但工作负载 JSON parser 的部分 number/double 路径不能作为
  Phase 2 无损 intake 证据；
- requested fidelity、resolved fidelity、execution mode 分开；当前通用 Cycle 请求仍 fail closed；
- Trace source 与 GPU participation 正交，当前 Web create-run 只开放 `gpu_free`；
- synthetic Trace 保持 `uncalibrated/exploratory`，compatibility harness 不升级；
- 当前八字段只支持 exploration/synthetic consistency；真实 calibration 和独立 held-out 均未完成。

## 11. 稳定 Gap 与后端工作包

| Gap                         | Owner                                             | 退出条件                                                                                                                                                        | 最小后端/契约工作包                                                                       |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GAP-PROFILE-SUCCESSOR-001` | 各领域 Profile owner + Bridge                     | 发布 successor/兼容矩阵；typed facts、source/license/regime/expiry、observed/inferred/modelled、撤回/过期/drift；至少一个经授权真实 record                      | Profile contract proposal → runtime registry → canonical digest 与 lifecycle negatives    |
| `GAP-CALCULATOR-001`        | 后端 deterministic-planning 领域服务 + 各资源模块 | 七类 calculator/validator 均有 versioned receipt；关键 unknown 阻塞；golden/property/boundary/risk-combination 全通过                                           | 纯领域 calculator ports、receipt contract、规则库和测试 corpus                            |
| `GAP-RUN-INTAKE-001`        | Bridge + 场景与探索编排模块                       | create-run successor 或正式 workload intake 接收 Phase 2 compiled refs，unknown revision fail closed，并有 lowering/execution evidence                          | successor Schema/parser、compatibility matrix、compiled request fixture；本阶段不创建 run |
| `GAP-VALIDATE-001`          | 后端领域服务                                      | 正式 Validation Report 绑定 exact draft/profile/catalog/policy/backend/schema；含 typed issues、receipts、compiled request digest/Pointer、预算和 claim ceiling | validator/planner、runtime validator、generated types、negative fixtures                  |
| `GAP-ENGINE-001`            | 推理引擎与服务运行时模块                          | engine selection 真实选择 versioned state machine，并有 model-call 与下游差分累计测试                                                                           | engine profile binding 和 create-run/workload intake lowering                             |
| `GAP-PARALLEL-001`          | 执行语义建模模块 + 集合通信语义模块               | card/TP/PP/EP/placement 到 rank/device/topology、执行片段、collective/network、metrics 全链闭合                                                                 | hosted parallel lowering、生产 `ExecutionFragmentBuilder` 接线、adjacent/cumulative tests |
| `GAP-KV-001`                | 推理引擎与服务运行时模块 + KV Cache 建模模块      | 逻辑策略和物理 page/capacity/residency/transfer/data-ready 分权接入并反馈请求指标                                                                               | Profile 驱动物理容量、禁止 auto-provision 掩盖压力、迁移/反馈差分测试                     |
| `GAP-WORKLOAD-001`          | 工作负载抽象与负载描述语言模块                    | WDL/template 转换为六类核心 Trace，保留 seed/provenance/identity 并从 WDL 起始通过累计链                                                                        | 六包生成/原生加载、逐对象守恒和 cumulative tests                                          |
| `GAP-NETWORK-001`           | 网络与硬件资源模块                                | versioned topology Profile 与 device/rank/endpoint/domain/path resolver 发布                                                                                    | Profile resolver、collective demand endpoint binding、queue/congestion/feedback tests     |
| `GAP-SLO-001`               | 校准验证与指标归因模块                            | metric/window/scope/unit/target/evidence contract 与 planner 发布                                                                                               | typed SLO/budget schema、policy 和 observation-only behavior tests                        |

推荐前置闭包顺序：Profile successor contract/data → 工作负载描述语言到六类 Trace → 正式 draft/Validation Report/run intake →
TP/PP/EP/placement 与生产执行片段 → 物理 KV → 集合通信/拓扑/网络累计闭包 → calculator/组合 resolver → Web typed receipts。
这不是授权开始设计空间搜索；基础仿真转换仍优先。

## 12. 本批验收记录

本批只允许文档与 Gap 收口。最终门禁结果在集成结束后填写；deployed/live tests 必须单列 skip，不计为通过。

## 13. 明确未实施事项

- 未实现正式多轮 Conversation、持久聊天历史、Approval、create-run 写操作、SSE/cancellation、RAG、跨 run 比较、MCP/A2A；
- 未新增 Profile record、calculator、Validation Report、request successor、lowering 或 Web receipt UI；
- 未变更任何正式 contract identity/revision；
- 未把公开产品名、理论峰值、fixture、synthetic consistency 或 LLM 常识当作正式 Profile、校准或 held-out 证据。

## 12. 非 live 门禁结果

| 范围                                   | 结果                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Web contracts                          | passed；generated contract types/client 无漂移。AJV 对既有 `date-time` format 输出 ignored warning                     |
| Web docs                               | passed；42 个活动 Markdown 链接通过                                                                                    |
| Web dependencies/typecheck/lint/format | passed；首轮 5 个本批 Markdown 文件触发 Prettier，机械格式化后复跑通过                                                 |
| Web unit/component                     | 65 files；508 passed，8 skipped；包含 Phase 1 draft、canonical、uint64、stale、provenance/fidelity 和 Agent Shell 回归 |
| Web build                              | passed；保留既有大于 500 kB chunk warning                                                                              |
| Web fixture E2E                        | 50 passed，6 skipped；6 项均为 deployed/live Bridge 用例，未计作通过                                                   |
| Bridge `py_compile`                    | passed；覆盖相关生产、contract、service 和 test 模块                                                                   |
| Bridge unittest                        | 105/105 passed                                                                                                         |
| 后端 WSL Release build                 | passed；`CMAKE_BUILD_TYPE=Release`，全部目标构建成功                                                                   |
| 后端 CTest                             | 63/63 passed；module、adjacent、connectivity、cumulative、evidence/provenance 等标签均通过                             |
| 两仓 `git diff --check`                | passed；最终复核见本批交接状态                                                                                         |

测试只证明当前契约、功能和 synthetic consistency，没有把五类空 Profile、缺失 calculator/lowering、真实 calibration 或
held-out validation 升级为 ready。Web 没有新增 Phase 2 交互；既有 Phase 1 侧栏的键盘、焦点、桌面宽度、主题和
reduced-motion fixture E2E 继续通过。

## 13. 交付状态

本批只改文档并停在 `pre_commit_ready`。未 commit、push 或 deploy；未操作 5173 的进程生命周期；未读取 credential，
未调用 live Provider，未创建正式 run。后端既有未跟踪 `build-local/` 保持原样。
