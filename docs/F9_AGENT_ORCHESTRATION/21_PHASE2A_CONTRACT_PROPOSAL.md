# Phase 2A 契约 publication candidate

> 文档 ID：`AO-21`
>
> 契约状态：`proposed`；交付状态：`pre_commit_ready`；四个契约 Gap 为 `designing`，完整 Phase 2 仍为 `blocked`
>
> 事实日期：2026-09-11
>
> 候选真源：`bridge/contracts/proposals/agent_orchestration_phase2a/`

## 1. 当前问题与阶段边界

五类正式 Profile v1 已发布，但记录数均为 0、runtime 为 unavailable；正式 create-run v1 无法表达模型、设备、引擎、TP/PP/EP、placement、物理 KV、集合通信、工作负载模板、网络绑定与 typed SLO；统一 Validation Report 和七类确定性 calculator receipt 也未发布。因此不能直接补前端字段或把 Phase 1 本地草案当成可运行输入。

Phase 2A 只冻结可评审 proposal。它不注册 OpenAPI/schema-set/manifest，不生成生产类型，不增加 endpoint，不改变 capability snapshot 或 `agent_exposed` 字段，不实现 lowering，不创建 run。所有 fixtures 仅有 `fixture_only` / `synthetic_consistency` 证明范围。

## 2. 后端已有的局部能力

只读核对表明，后端已经存在可供后续 Phase 2C 使用的局部原语：

- 工作负载抽象与负载描述语言模块能无损解析 uint64 decimal string，并表达 TP/PP、MoE、设备/端点、来源与三类约束；
- 推理引擎与服务运行时模块已有 vLLM、SGLang、TensorRT-LLM 最小版本化语义 Profile，runtime 保持逻辑 KV 所有权并接收网络/KV pressure feedback；
- KV Cache 建模模块独占物理页、容量、驻留、迁移、remote read 和 data-ready；
- 设备性能建模模块当前默认 analytical model 未校准，不能冒充正式 Device Profile；
- 集合通信语义模块支持 ring/tree/hierarchical 并生成网络 demand；网络与硬件资源模块拥有 path、queue、congestion 和 completion；
- 累计测试证明网络 completion/backpressure 可沿资源操作、执行片段、模型调用、runtime 反馈到请求指标；它没有证明本候选字段的 lowering；
- 校准验证与指标归因模块区分 fixture/real、calibration/held-out，并拒绝自报 evidence 升级。

这些能力是 Phase 2C lowering 输入，不是 Phase 2A 已闭环的执行或保真度证据。

## 3. Successor 决策

五类 Profile 不修改已发布 v1，而采用明确 v2 identity：

| family   | proposal identity                                        |
| -------- | -------------------------------------------------------- |
| model    | `tilesim.bridge.agent_orchestration_model_profile.v2`    |
| engine   | `tilesim.bridge.agent_orchestration_engine_profile.v2`   |
| device   | `tilesim.bridge.agent_orchestration_device_profile.v2`   |
| topology | `tilesim.bridge.agent_orchestration_topology_profile.v2` |
| workload | `tilesim.bridge.agent_orchestration_workload_profile.v2` |

运行输入选择 ADR 方案 B：顶层正式 `tilesim.bridge.create_run_request.v1` 保持不变，后续在其下发布显式、版本化 nested `tilesim.bridge.agent_orchestration_run_intake.v2`。这最小化旧客户端、幂等 key、retained run 和恢复语义变化。新 intake identity 必填；缺失、unknown revision 或 mixed-version 一律 fail closed，禁止从 payload 形状猜版本。完整比较见候选目录的 `ADR-001-run-intake-successor.md`。

## 4. Contract family

### 4.1 Profile 与 field-level provenance

每个 Profile 包含 schema identity/revision、stable profile ID、profile revision、canonical digest、display metadata、source reference/kind、license、valid regime、introduced/updated/expiry/status、calibration、held-out validation、allowed claim scope、sensitivity、visibility 和 typed facts。

每个事实字段独立携带 `value`、`unit` 和 `provenance`；provenance 明确区分 `observed`、`externally_specified`、`inferred`、`modelled`、`user_supplied`，并绑定 source reference、source field、时间、confidence 与 evidence scope。只有顶层笼统 provenance 或任一事实缺 provenance 都拒绝。synthetic/compatibility fixture 不能声明 calibrated、held-out validated 或 real-calibrated claim。

### 4.2 不可变 Profile reference 与组合

统一 reference 为 `family + profile_id + identity + revision + digest`。组合 identity 为 `tilesim.bridge.agent_orchestration_profile_binding.v1`，必须同时绑定 model、engine、device、topology、workload、fidelity 与 GPU participation mode。以下状态全部 fail closed，并有稳定错误码：missing、unknown、unavailable、ambiguous、expired、revision/digest mismatch、incompatible、calibration missing、execution evidence missing。

### 4.3 Run intake

`tilesim.bridge.agent_orchestration_run_intake.v2` 包含不可变 Profile 组合、device count、TP/PP/EP、显式 placement、KV policy/capacity、collective policy、workload template/允许覆盖、topology/network binding、requested fidelity、独立的 GPU participation mode、独立的 trace source、typed SLO，以及 candidate/run/simulation-time/wall-time budget。所有 ps、bytes 和 count 使用 canonical uint64 decimal string，最大值为 `18446744073709551615`；decimal 也使用 canonical string，单位显式，禁止 JSON binary float 和 exponent 记法。

### 4.4 Validation Report

新 identity 为 `tilesim.bridge.agent_orchestration_validation_report.v1`，不复用现有运行后 `tilesim.validation_report.v1`。报告绑定 input draft/intake digest、Profile snapshot、capability snapshot、backend/schema revisions、validation policy，并包含 overall status、typed issues、calculator receipts、compiled request preview、field-to-Pointer map、candidate plan、budget、claim-scope ceiling 与 stale binding。

Issue 冻结 stable rule ID、severity、blocking、status、field/Profile references、machine facts、repair candidates、supporting receipt、retryable 与 safe next action；category 完整区分 invalid、infeasible、unsupported、unknown、stale、profile missing、revision mismatch、calibration missing、evidence scope insufficient、lowering missing、budget exceeded、calculator unavailable 和 internal failure。

### 4.5 Calculator Receipt

通用 envelope identity 为 `tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1`。七个 typed identity 分别对应 model weight/memory、KV capacity、parallelism、placement、collective/network、workload distribution、SLO/budget。每个 receipt 固定 calculator identity、algorithm revision、stable input references、units、exact/interval/unknown result、rounding policy、assumptions、uncertainty、rule IDs、repair candidates 和 claim-scope ceiling。隐藏推理和 LLM 文本不参与关键算术，也不得持久化。

## 5. 兼容矩阵

| 场景                       | 结果                   | error code                      |
| -------------------------- | ---------------------- | ------------------------------- |
| 旧客户端 → 新服务端        | 接受，按 v1 原语义     | —                               |
| 新客户端 → 旧服务端        | 拒绝                   | `unknown_nested_identity`       |
| v1 → successor             | 拒绝隐式升级           | `explicit_migration_required`   |
| successor → v1             | 拒绝降级               | `unsupported_contract_identity` |
| identity 缺失              | 拒绝                   | `missing_contract_identity`     |
| unknown identity           | 拒绝                   | `unknown_contract_identity`     |
| unknown revision           | 拒绝                   | `unknown_contract_revision`     |
| mixed-version payload      | 拒绝                   | `mixed_contract_version`        |
| exact replay               | 接受原结果             | —                               |
| same key、payload mismatch | 拒绝                   | `idempotency_payload_mismatch`  |
| retained historical run    | 按原 identity 精确重放 | —                               |
| stale Profile binding      | 拒绝执行               | `validation_report_stale`       |

## 6. Stale、幂等与留存

Profile revision/digest、capability snapshot、backend/schema revision、validation policy、calculator algorithm、workload template、compiled request 任一改变，或 approval 缺失/过期，都使旧 Validation Report stale，必须重新校验，不能局部沿用旧结论。

同 key + 同 canonical payload 只允许精确 replay；结果未保留时返回 terminal-not-retained，不能创建新 run。同 key + 不同 payload 返回 409。contract version 或 Profile revision 参与 canonical payload，因此它们变化等价于 payload mismatch。crash/retry 只能恢复或终态化，不得重复副作用。delete/expiry 后只留 key tombstone，不留 payload/result；credential、hidden reasoning、raw Provider response 永不持久化。

## 7. 验证范围

候选门禁覆盖严格 JSON、每个 contract Schema 正负例、unknown field、identity/revision fail closed、五类 field-level provenance、七类 receipt identity、canonical Python/TypeScript 等价、uint64/decimal/unit 边界、compatibility matrix、stale、幂等、redaction/retention，以及当前正式 identity drift。门禁只证明 contract consistency，不证明真实 Profile、真实校准、held-out validation、后端 lowering 或可执行闭环。

## 8. 后续输入与仍阻塞事项

Phase 2B 的输入是已评审的本候选：正式发布时必须注册 OpenAPI/schema-set/manifest、生成生产 types/client、实现显式 nested routing/runtime validator、retained-run recovery 与 compatibility tests；发布需要新的明确授权。

Phase 2C 必须实现从每个 intake Pointer 到工作负载抽象与负载描述语言模块、推理引擎与服务运行时模块、执行语义建模模块、KV Cache 建模模块、设备性能建模模块、集合通信语义模块、网络与硬件资源模块和统一仿真内核模块的累计 lowering，并证明网络 completion/backpressure 到请求指标的反馈链。

仍阻塞：五类经授权真实 Profile 数据和 license/source 审核、设备/链路/通信/runtime 分层校准、独立 held-out 数据、calculator 正式算法与 golden/property 风险组合证据、Profile 组合兼容规则，以及 Phase 2 字段的执行和 observable closure。故四个目标 Gap 仅为 `designing`，不得标为 implementing/validated，完整 Phase 2 继续 `blocked`。

## 9. E2E 稳定性收口

Phase 2A 初次默认 `pnpm test:e2e` 为 45 passed、6 deployed/live skipped、5 failed。逐项复核和受控复跑结论如下：

| 初次失败项                    | 分类                 | 证据与处理                                                                                                     |
| ----------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Phase 1 Agent Copilot 草案    | fixture 启动问题     | 与主题用例同时命中 Vite 冷启动和首次模块转换；单 worker 5.8 秒通过，显式预热后默认并发两轮分别 9.2/6.9 秒通过  |
| Week 7 evidence chain         | fixture 同步问题     | `.global-busy` 尚在加载 fixture 时遮挡 disclosure；单 worker 3.1 秒通过，增加明确 idle 等待后两轮为 2.9/3.8 秒 |
| RGB spectrum                  | fixture 启动问题     | 与首个 `/experiment` 同时触发冷启动；单 worker 4.4 秒通过，预热后两轮为 7.0/5.4 秒                             |
| offline desktop visual review | 并发资源竞争         | 本身已有 180 秒测试预算，单 worker 1.8 分钟通过；降低到仍并发的 2 workers 后连续两轮通过                       |
| 14 MB artifact Worker         | 固定 30 秒测试级超时 | 30 秒是 Playwright 生命周期，不是性能 SLO；120 秒诊断运行 47.1 秒且全部断言通过，不构成真实性能回退            |

未发现产品行为错误或真实性能回退。冷启动预热项目在 desktop 并发测试前顺序访问 `/overview` 与 `/experiment`；普通 desktop 项保持 2 workers 并发。14 MB 用例保留大产物、Worker 路径、完整索引、Pointer、结果正确性、`searchMs < 500` 和主线程 responsiveness 断言，只使用该用例专属 `test.slow()`，并在 desktop 项完成后运行。Week 7 用例显式等待 fixture busy 状态结束并使用该长链专属 slow 生命周期。没有全局提高 E2E timeout。

修复后连续两次默认 `pnpm test:e2e` 均为 51 passed、6 deployed/live skipped、0 failed；14 MB worker 分别为 4.6 秒和 4.0 秒。六个 skip 继续只对应需要已部署 Week 8 Bridge 的 live acceptance，本任务未操作 `127.0.0.1:5173`。因此 Phase 2A 交付状态由 `pre_commit_blocked_by_e2e` 更新为 `pre_commit_ready`，但 proposal 仍未正式发布，Phase 2B 未启动。
