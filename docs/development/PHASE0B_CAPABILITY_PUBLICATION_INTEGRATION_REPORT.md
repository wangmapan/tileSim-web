# Phase 0B Capability Catalog 发布集成与阻塞报告

> 阶段：Phase 0B「正式 Capability Catalog 发布与 Contract Drift 收口」
>
> 状态：`publication_candidate_complete / formal_publication_blocked`
>
> 事实日期：2026-09-08（Asia/Shanghai）
>
> 主 Agent：基于 Agent 的仿真编排模块集成负责人

## 1. 验收结论

Phase 0B 已完成 proposal 评审、F8 drift 审计、Capability/Profile publication candidate、八字段投影、独立 runtime oracle、文档收口和非 live 门禁；没有完成正式发布。Phase 1 DoR 为 **blocked**，不得启动 Phase 1。

阻塞原因不是 5173 与源码单纯版本不同，而是当前未提交 F8 在仍复用 `tilesim.design_space.s6_candidates.v1` 和 `tilesim.bridge.create_run_request.v1` identity 时破坏至少五类旧 payload；具名 F8 owner/handoff 未验证；successor 或 dual-version 迁移尚未决策；最终目标也没有 Git 可复现的源码 revision。独立 `node bridge/test_f8_schemas.mjs` 真实失败，故 `GAP-CONTRACT-DRIFT-001` 必须保持 `open/blocking`。

本阶段遵守停止条件：没有把候选加入正式 Schema 根、OpenAPI、manifest 或 schema-set；没有生成正式客户端或 runtime validator；没有接入 Bridge capability endpoint；没有修改 F8 文件；没有启动 Phase 1。

## 2. 初始基线、release state 与 ownership

- Web Git HEAD：`09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`。
- 后端 Git HEAD：`09c22c0efff890253a1eacf403c2979f56fd9ba6`。
- Git 可复现的 Web HEAD 兼容基线：schema-set `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c`；experiment descriptor v1 revision `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059`。
- 审计时 5173：Web source `09e95b0…`、backend `09c22c0…`、schema-set `sha256:2214c4eae8361bc46fce52163832eb0ba9b9438692c2ff147cbd1b56a2df2af8`、experiment descriptor v1 revision `sha256:1ef962150e0cfa19d27116a3176f23881f7a790cd23b8ef4ebaf3e7885aef4f1`、`deployed_at=2026-09-08T17:59:51.5082343+08:00`。
- 5173 因而不是 Phase 0 记录的旧 `eb6c…/de97…` contract；它是与当前 dirty F8 contract 一致的外部部署快照，但不是 Git 可复现的 Phase 1 source target，也不是本阶段部署。

| 文件或状态面                                                                 | Owner / 独占 worktree                                                                | Phase 0B 结果                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| F8 descriptor、create-run、validation、execution、generated 与相关 UI/tests  | 责任域仅能确认 `Bridge + Integration/F8`；具名 owner/handoff 未验证                  | 主 Agent 和三个子 Agent 均只读；未修改                   |
| drift audit                                                                  | `phase0b_contract_drift_audit` / `D:\tileSim-worktrees\phase0b-contract-drift-audit` | 报告已集成                                               |
| Capability/Profile publication candidate                                     | `phase0b_catalog_publication` / `D:\tileSim-worktrees\phase0b-catalog-publication`   | candidate 已集成，未正式发布                             |
| runtime fixtures、oracle 与脱敏报告                                          | `phase0b_runtime_eval` / `D:\tileSim-worktrees\phase0b-runtime-eval`                 | 已集成并独立交叉验证                                     |
| OpenAPI、Schema 根、schema-set、manifest、generated clients、Bridge endpoint | 主 Agent 单槽                                                                        | 因停止条件未满足而保持不变                               |
| AO README、handoff、baseline、catalog、roadmap、Gap Register 与本报告        | 主 Agent                                                                             | 已更新为 blocked 状态                                    |
| 后端八字段执行事实                                                           | `D:\tileSim` 源码、追踪矩阵与测试                                                    | 只读消费；未修改后端                                     |
| `127.0.0.1:5173`                                                             | 用户/外部部署状态                                                                    | 仅沿用子 Agent 的 GET 审计结果；未停止、重启、替换或部署 |

## 3. F8 兼容结论与目标源码

Web HEAD 接受、当前 dirty F8 在相同 v1 identity 下拒绝的实测旧 payload 包括：

1. `calibration_level=partially_calibrated`；
2. `allowed_claim_scope=exploratory_s6_only`；
3. `oversubscription_factor=0.5`；
4. 仅 `uncertainty_score` / `tail_risk` 不同的候选对；
5. 触发新增 DES promotion aggregate budget 上限的 manifest。

同 key/同 exact canonical payload 的 retained-run replay 与同 key/不同 payload 的 `409 idempotency_payload_mismatch` 顺序保持，但这不能修复新 key 下旧 payload 被拒。create-run family 字符串仍为 v1，也不等价于语义兼容。

F8 若保留当前新规则，必须二选一：

1. 发布 `tilesim.design_space.s6_candidates.v2`，让 create-run v1 在迁移期同时支持 nested v1/v2；或
2. 发布 `tilesim.bridge.create_run_request.v2`，并保留 create-run v1 的旧语义。

最终 source target 必须绑定上述决策落地、owner 交接、旧/新客户端矩阵和 F8 tests 闭合后的 Git commit，以及由同一 commit 计算的 schema-set/descriptor/create-run revisions。当前状态只能表示为 `target_pending/unavailable`，不得绑定 dirty tree 或 5173。

## 4. Publication candidate identity

以下都是冻结并通过 oracle 的 **candidate**，不是正式 runtime publication：

| 对象                 | identity / revision / digest                                                                                                                             | 状态                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Contract package     | `sha256:cf2f833dd91fd08559c11b71f53e26282ed89bb84a59ef20e04636e6da4a49a0`                                                                                | `publication_candidate`                        |
| Capability catalog   | `tilesim.bridge.agent_orchestration_capability_catalog.v1` / `sha256:dd8954774ce812c29a2915cc8acab2e3c0d82d32347bfbfd04fffa40c15b9fa5`                   | `publication_candidate`                        |
| Immutable snapshot   | `tilesim.bridge.agent_orchestration_capability_snapshot.v1` / `sha256:6dc417cc000b9718088bd653cc28b7c6aef71d286531795d4a03a4fd0d7185fd`                  | `publication_candidate`; runtime `unavailable` |
| Parameter descriptor | `tilesim.bridge.agent_orchestration_parameter_descriptor.v1`                                                                                             | `publication_candidate`                        |
| Eval fixture         | `tilesim.fixture.agent_orchestration.phase0b.runtime_capability_snapshot.v1` / `sha256:a0f80ae800a2dee52f0dd1b5dfbcc684174582892616ca8ffaf33749d4bffaf5` | `fixture_only`                                 |

`source_target_binding` 只允许 `status=target_pending`、`runtime_availability=unavailable`、`source_target_revision_pending` 和 `binding_compatibility_review_pending`；不携带伪造的目标 revision。旧 HEAD binding 只作为 execution evidence/compatibility baseline；dirty/5173 的 `2214…/1ef…` 只作为 `not_publishable` observation。

## 5. 八字段 candidate 与执行证据

八字段均通过 `described -> accepted -> validated -> lowered -> executed -> observable` 闭包，并可作为 `agent_exposed` candidate；全部保持 `calibrated=denied`、`held_out_validated=denied`，claim scope ceiling 仅为 `exploration` 和 `synthetic_consistency`。

| 字段                                  | request JSON Pointer                          | execution evidence                                                      | 边界                                               |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `s0.workload.message_size_multiplier` | `/overrides/workload/message_size_multiplier` | `tests/test_week4_cumulative_flow.cpp` larger-message differential      | mixed                                              |
| `s1.runtime.batch_scheduler`          | `/overrides/runtime/batch_scheduler`          | `tests/test_runtime_batch_lowering.cpp` FIFO / decode-priority ordering | mixed                                              |
| `s1.runtime.max_batch_size`           | `/overrides/runtime/max_batch_size`           | `tests/test_runtime_batch_lowering.cpp` batch membership                | mixed                                              |
| `s1.runtime.kv_capacity_tokens`       | `/overrides/runtime/kv_capacity_tokens`       | `tests/test_runtime_batch_lowering.cpp` KV pressure/admission           | `conditional`；仅逻辑 admission；`GAP-KV-001` 保留 |
| `s6.fabric.scale_up_bandwidth_gbps`   | `/overrides/fabric/scale_up_bandwidth_gbps`   | `tests/test_week4_cumulative_flow.cpp` lower-bandwidth differential     | DES                                                |
| `s6.fabric.scale_up_latency_us`       | `/overrides/fabric/scale_up_latency_us`       | `tests/test_week4_cumulative_flow.cpp` higher-latency differential      | DES                                                |
| `s6.fabric.scale_out_bandwidth_gbps`  | `/overrides/fabric/scale_out_bandwidth_gbps`  | `tests/test_modular_fabric.cpp` scale-out analytical execution          | resolved `Analytical`                              |
| `s6.fabric.scale_out_latency_us`      | `/overrides/fabric/scale_out_latency_us`      | `tests/test_modular_fabric.cpp` scale-out analytical execution          | resolved `Analytical`                              |

## 6. Profile family 与不公开能力

model、engine、device、topology、workload 五类 Profile Schema 都只有 publication candidate，尚未进入正式 Schema 根。实际 Profile 数据全部为 0，runtime availability 全部为 `unavailable`：

- model/workload：`profile_missing`；
- engine：`conditional`，但实际记录仍为 0；
- device/topology：`profile_missing`、`calibration_missing`；
- 五类均为 `held_out_validation_missing`。

Profile 缺失不阻止当前八字段的 fixture/candidate 解析，但继续阻止 model/device/engine selection、TP/PP/EP。物理 KV 策略、集合通信算法和 SLO 也保持 `not_exposed`。没有创建 H100、模型结构、引擎、拓扑或 workload 的虚假数据。

## 7. Identity 与行为保持情况

- Evidence Agent descriptor 保持 `tilesim.bridge.evidence_agent_descriptor.v2` / `sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357`；Evidence request/response/citation/snapshot-reference 保持 v1。
- create-run identity 仍为 `tilesim.bridge.create_run_request.v1`，但 dirty F8 的 nested 接受集合存在 breaking drift，不能据 family 名称宣称兼容。
- experiment descriptor family 仍为 v1；Git HEAD revision 为 `de97…`，dirty/5173 revision 为 `1ef…`，正式目标 pending。
- 本阶段没有改变两类 409、Provider retry、stale claims、502/503/504、citation binding、requested/resolved fidelity、execution mode、Trace source、GPU participation 或 uint64 语义。

## 8. 测试与门禁

通过：

| 命令/范围                                                                                                              | 结果                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| publication candidate local validator                                                                                  | 8 Schema、8 字段、5 空 Profile family，passed                                           |
| Phase 0 + Phase 0B oracle                                                                                              | 45 passed、1 skipped；跳过项是未设置外部 candidate root 的交叉验证                      |
| Phase 0B oracle with candidate root                                                                                    | 41/41 passed，0 skipped                                                                 |
| `pnpm contracts:check`                                                                                                 | passed；生成物与当前 dirty contract 一致，不代表 v1 语义兼容                            |
| `pnpm deps:check`                                                                                                      | passed，205 source files                                                                |
| `pnpm typecheck`                                                                                                       | passed                                                                                  |
| `pnpm test`                                                                                                            | 388 passed、1 skipped；跳过项同为 candidate env 未设置                                  |
| `pnpm lint`                                                                                                            | passed                                                                                  |
| `pnpm format:check`                                                                                                    | passed                                                                                  |
| `pnpm build`                                                                                                           | passed；仅有既存 chunk-size warning                                                     |
| `pnpm test:e2e`                                                                                                        | 47 passed、5 skipped；5 个均为未提供 live 坐标的 deployed tests，不计作 live acceptance |
| Bridge `py_compile`                                                                                                    | passed                                                                                  |
| Bridge `python -m unittest discover -s bridge -p 'test*.py' -v`                                                        | 94/94 passed；使用隔离测试状态，没有操作用户 5173                                       |
| WSL Ubuntu 24.04 后端：`TileSimModularFabricTest`、`TileSimRuntimeBatchLoweringTest`、`TileSimWeek4CumulativeFlowTest` | 3/3 passed                                                                              |
| WSL Ubuntu 24.04 后端：`TileSimF7FabricContractTest`                                                                   | 1/1 passed；覆盖 module/adjacent/connectivity/cumulative/evidence                       |
| 两仓库 `git diff --check`                                                                                              | passed                                                                                  |

真实失败：

- `node bridge/test_f8_schemas.mjs`：失败于旧 fixture 的 `/allowed_claim_scope=exploratory_s6_only` 与 dirty F8 Schema 的 `const=exploratory` 冲突。这是 drift 审计所述 breaking change 与 F8 测试未闭合的直接证据；本阶段未修改 fixture 或 F8 Schema 来掩盖失败。

未运行或不能计为通过：

- live deployment acceptance、live Provider acceptance、真实校准、独立 held-out real-trace validation；
- 5 个需显式 live 坐标的 Playwright 用例只记录为 skipped；
- synthetic fixture、CI、unit、E2E 和后端一致性测试均不构成真实系统保真度或 2026 年度验收证据。

## 9. Phase 1 DoR 裁决

结果：**blocked**。

已经满足但不足以打开 Phase 1：八字段执行闭包、Profile 缺失的候选表示、范围外能力不暴露、fixture 开发不依赖 5173、candidate 与独立 oracle 一致。

未满足：正式 capability contract、正式五类 Profile Schema、Bridge immutable snapshot endpoint、Web generated types/runtime validator、F8 successor/dual-version 决策、具名 owner handoff、Git 可复现 source target、跨 source/snapshot/generated/tests 的同 revision 闭包，以及 `GAP-CONTRACT-DRIFT-001` 收口。

## 10. Changed files 与操作声明

本阶段集成的新增资产：

- `bridge/contracts/publication_candidates/agent_orchestration_phase0b/**`；
- `docs/development/PHASE0B_CONTRACT_DRIFT_AUDIT.md`；
- `docs/development/PHASE0B_RUNTIME_CAPABILITY_EVAL_REPORT.md`；
- `docs/development/PHASE0B_CAPABILITY_PUBLICATION_INTEGRATION_REPORT.md`；
- `tests/fixtures/phase0b-agent-orchestration/**`；
- `tests/unit/phase0b-runtime-capability-oracle.test.mjs`。

本阶段更新的仓库可见状态文档：

- `docs/AI_HANDOFF.md`；
- `docs/F9_AGENT_ORCHESTRATION/README.md`；
- `01_CURRENT_BASELINE_AND_GAPS.md`；
- `04_CAPABILITY_AND_PROFILE_CATALOG.md`；
- `12_DELIVERY_ROADMAP_AND_BACKLOG.md`；
- `14_CONTRACT_GAP_REGISTER.md`。

所有 candidate Schema/fixture 使用 `.jsonc`；candidate 目录内 `.json` 数量为 0，不会被 Bridge `rglob("*.json")` 收入正式 schema-set。

明确声明：保护了两个仓库原有未提交改动；未 reset、clean、stash、checkout 覆盖、commit 或 push；未修改 F8 owner 文件；未部署、停止、重启或替换 5173；未创建正式 simulation run；未读取或输出 `TILESIM_EVIDENCE_AGENT_*` 或其他 credential；未调用 live Provider。Phase 0B 到此停止，不自动进入 Phase 1。
