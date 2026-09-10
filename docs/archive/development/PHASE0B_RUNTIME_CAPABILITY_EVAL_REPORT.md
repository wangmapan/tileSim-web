# Phase 0B Runtime Capability 独立评估报告

> 状态：`fixture_only_eval`；不是 runtime contract、发布批准、校准或 held-out validation
>
> 事实日期：2026-09-08（Asia/Shanghai）
>
> 独占 worktree / branch：`D:\tileSim-worktrees\phase0b-runtime-eval` / `codex/ao-phase0b-eval`

## 1. 结论

Phase 0B publication candidate 的结构与声明语义通过独立 oracle：41/41 tests passed。候选包含 8 个
`agent_exposed` 字段、5 类 Profile family Schema、0 条实际 Profile 数据，且以失败关闭方式处理 backend、schema-set、
experiment descriptor、catalog revision 以及未知 identity/status。canonical digest 检查覆盖 Unicode code-point key order、数组
顺序保持、无损 `uint64` 和 binary float 拒绝。快照安全投影未发现 credential、artifact payload、Provider response、用户问题或
claims 字段。

该结果不代表正式发布。候选仍为 `publication_candidate`，activation 为 `unavailable`；尚未加入正式 Schema 根或 manifest，
Bridge 未提供正式 immutable snapshot，Web generated types/runtime validator 尚未生成。F8 漂移审计还确认 dirty F8 在复用 v1
identity 下破坏 5 类旧 payload，具名 owner/handoff 未验证，独立 `bridge/test_f8_schemas.mjs` 失败，且没有 Git 可复现的最终
目标 revision。因此 Phase 1 DoR 的独立裁决是 **blocked**。

## 2. 职责边界、输入与输出

本 Agent 只建立 Phase 0B 专用 fixtures、unit/contract oracle 和本脱敏报告。没有修改正式 contract、F8 文件、业务实现、
generated client、OpenAPI/Schema 根、manifest、Bridge 服务、UI 或后端。

主要输入：

- 源码基线：Web HEAD `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`；后端 HEAD
  `09c22c0efff890253a1eacf403c2979f56fd9ba6`；八字段执行事实以 `D:\tileSim` 的
  `docs/development/PHASE0_PARAMETER_TRACEABILITY_MATRIX.json` 和后端测试为权威；
- Phase 0 proposal、既有独立 Eval fixture/oracle、AO 契约与验收规则；
- Drift Agent 最终报告：`GAP-CONTRACT-DRIFT-001=open/blocking`；
- Catalog Agent publication candidate，只读路径：
  `D:\tileSim-worktrees\phase0b-catalog-publication\bridge\contracts\publication_candidates\agent_orchestration_phase0b`。

输出 contract：

- `runtime-capability-snapshot.fixture.json` 是冻结的 `fixture_only` oracle 输入，fixture identity 与 runtime snapshot identity
  明确不同；
- `runtime-capability-cases.json` 是负向、边界、drift、canonical 和 DoR 用例集；
- `phase0b-runtime-capability-oracle.test.mjs` 是独立判断逻辑，不导入或复用 candidate validator；
- 本报告只记录脱敏、可复现的结构和测试事实。

## 3. Identity、revision 与 binding

独立交叉验证通过的 publication candidate：

| 对象               | identity / revision / digest                                                                                                                             | 状态                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Contract package   | `sha256:cf2f833dd91fd08559c11b71f53e26282ed89bb84a59ef20e04636e6da4a49a0`                                                                                | `publication_candidate`                           |
| Capability catalog | `tilesim.bridge.agent_orchestration_capability_catalog.v1` / `sha256:dd8954774ce812c29a2915cc8acab2e3c0d82d32347bfbfd04fffa40c15b9fa5`                   | `publication_candidate`                           |
| Immutable snapshot | `tilesim.bridge.agent_orchestration_capability_snapshot.v1` / `sha256:6dc417cc000b9718088bd653cc28b7c6aef71d286531795d4a03a4fd0d7185fd`                  | `publication_candidate`; activation `unavailable` |
| Eval fixture       | `tilesim.fixture.agent_orchestration.phase0b.runtime_capability_snapshot.v1` / `sha256:a0f80ae800a2dee52f0dd1b5dfbcc684174582892616ca8ffaf33749d4bffaf5` | `fixture_only`                                    |

候选正确地区分三类 binding：

1. execution evidence / compatibility baseline 绑定 Git 可复现的 Web HEAD contract：schema-set
   `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c`、experiment descriptor v1
   revision `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059`；
2. source target 不携带任何具体 revision，结构化表示为 `target_pending` + runtime `unavailable`，reason codes 为
   `source_target_revision_pending` 与 `binding_compatibility_review_pending`；
3. 5173/dirty tree 观察值 `sha256:2214c4eae8361bc46fce52163832eb0ba9b9438692c2ff147cbd1b56a2df2af8` / descriptor
   `sha256:1ef962150e0cfa19d27116a3176f23881f7a790cd23b8ef4ebaf3e7885aef4f1` 被标记为
   `observed_non_target_runtime_binding.status=not_publishable`；
4. catalog revision 独立参与 compatibility check，并在任何不一致时失败关闭。

Oracle 明确拒绝把 HEAD-old `eb6c…` / `de97…` 或 dirty/5173 的 `2214…` / `1ef…` 当成正式 source target。前者只能是
evidence/compatibility baseline，后者只能是兼容评审未完成的观察状态；两者都不能替代具名 owner、successor/dual-version
决策、测试闭包和 Git 可复现的最终发布 revision。

Evidence identities 保持不变：descriptor v2 revision `sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357`，
request/response/citation/snapshot-reference 均为 v1。create-run 仍声明 v1，但 F8 breaking 漂移未解决，不能据此宣称兼容。

## 4. 八字段执行闭包

八字段均要求 `described -> accepted -> validated -> lowered -> executed -> observable` 为 `affirmed`，`agent_exposed` 为
`affirmed`，同时 `calibrated` 与 `held_out_validated` 必须为 `denied`。claim scope ceiling 固定为 `exploration` 和
`synthetic_consistency`。

| 字段                                  | request JSON Pointer                          | execution evidence                                                       | 边界                                                   |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `s0.workload.message_size_multiplier` | `/overrides/workload/message_size_multiplier` | `tests/test_week4_cumulative_flow.cpp` larger-message differential       | mixed                                                  |
| `s1.runtime.batch_scheduler`          | `/overrides/runtime/batch_scheduler`          | `tests/test_runtime_batch_lowering.cpp` FIFO vs decode-priority ordering | mixed                                                  |
| `s1.runtime.max_batch_size`           | `/overrides/runtime/max_batch_size`           | `tests/test_runtime_batch_lowering.cpp` batch membership                 | mixed                                                  |
| `s1.runtime.kv_capacity_tokens`       | `/overrides/runtime/kv_capacity_tokens`       | `tests/test_runtime_batch_lowering.cpp` KV pressure/admission            | `conditional`；仅 logical admission；保留 `GAP-KV-001` |
| `s6.fabric.scale_up_bandwidth_gbps`   | `/overrides/fabric/scale_up_bandwidth_gbps`   | `tests/test_week4_cumulative_flow.cpp` lower-bandwidth differential      | DES                                                    |
| `s6.fabric.scale_up_latency_us`       | `/overrides/fabric/scale_up_latency_us`       | `tests/test_week4_cumulative_flow.cpp` higher-latency differential       | DES                                                    |
| `s6.fabric.scale_out_bandwidth_gbps`  | `/overrides/fabric/scale_out_bandwidth_gbps`  | `tests/test_modular_fabric.cpp` scale-out analytical execution           | resolved `Analytical`                                  |
| `s6.fabric.scale_out_latency_us`      | `/overrides/fabric/scale_out_latency_us`      | `tests/test_modular_fabric.cpp` scale-out analytical execution           | resolved `Analytical`                                  |

任一 closure dimension 被降级而仍声明 `agent_exposed`、任何 calibration/held-out 升级、scale-out 被描述成 DES、缺失执行证据或
request Pointer 漂移，oracle 都会拒绝。

## 5. Profile family 与不可暴露能力

五类 Schema identity 均在候选中存在：model、engine、device、topology、workload。Oracle 允许 Schema 从
`publication_candidate` 晋级为 `published` 时实际 Profile 记录仍为 0，证明“发布 Schema”不要求伪造 H100、模型结构、引擎、
拓扑或 workload 数据。

当前数据状态：

- model/device/topology/workload：`profile_missing`；
- engine：`conditional`，但 actual count 仍为 0；
- 五类 runtime availability 均为 `unavailable`；
- calibration 与 independent held-out validation 仍缺失。

Profile 缺失不阻塞当前八字段的 fixture 能力解析；它必须阻塞 model/device/engine selection、TP/PP/EP。physical KV policy、
collective algorithm 和 SLO 也保持 `not_exposed`。未知 capability/identity/status 全部失败关闭。

## 6. Canonical、uint64、drift 与安全 oracle

覆盖结果：

- `uint64` 只接受十进制字符串；`0` 与 `18446744073709551615` 接受，overflow、前导零和 JS unsafe number 拒绝；
- canonical key 排序使用 Unicode code point，而不是 UTF-16 code unit；
- object 输入 key 顺序不影响 canonical JSON/digest；array 顺序保持且影响 digest；
- lossless integer 可以按声明 Pointer 以未加引号的精确十进制形式进入 canonical material；
- binary float 拒绝，不允许经 JS rounding 静默进入 digest；
- backend/schema-set/experiment descriptor/catalog mismatch 均失败关闭；malformed/unknown revision、identity、status 失败关闭；
- capability snapshot 递归检查禁止 `credential`、`credentials`、`api_key`、`artifact_payload`、`provider_response`、
  `user_question`、`claims` 成员。

该安全检查只证明候选和 fixture 的静态投影不含上述内容；没有读取 Provider 配置、credential、Provider response、用户问题或
artifact payload，也没有执行 retention/live Provider acceptance。

## 7. Phase 1 DoR oracle

结果：`blocked`。精确阻塞原因：

1. `formal_capability_contract_not_published`；
2. `immutable_snapshot_unavailable`；
3. `generated_types_missing`；
4. `runtime_validator_missing`；
5. `profile_schemas_not_formally_published`；
6. `f8_breaking_change_reuses_v1_identity`；
7. `f8_named_owner_handoff_not_verified`；
8. `git_reproducible_target_revision_missing`；
9. `cross_artifact_revision_coherence_not_proven`。

已经满足但不足以打开 Phase 1 的部分包括：八字段执行闭包、Profile 缺失的正式候选表示、范围外能力不暴露、fixture 开发不依赖
5173。`GAP-CONTRACT-DRIFT-001` 必须保持 `open/blocking`，直到 F8 owner 完成交接、successor 或 dual-version migration
确定、旧/新客户端和幂等矩阵闭合、全部契约测试通过并形成 Git 可复现发布 revision。

## 8. 测试

已运行：

- 无候选环境变量的独立 fixture oracle：40 passed，1 skipped（只跳过外部 candidate 交叉验证）；
- 设置 `PHASE0B_CATALOG_CANDIDATE_ROOT` 后的完整独立 oracle：41/41 passed；
- Catalog Agent 自身 `node tests/test_publication_candidate.mjs`：8 Schema、8 fields、5 empty Profile families，passed；
- 定向 Prettier write/check：passed；
- `git diff --check`：passed。

调试中 oracle 曾两次准确失败关闭：第一次是 Catalog Agent 更新双 binding 但尚未重算 digest；第二次是候选把 HEAD-old 直接
当作 source target。Catalog Agent 随后改为无具体 revision 的 `target_pending/unavailable`、重算 package/catalog/snapshot
digest 并冻结上述最终值，两边测试才同时通过。该过程证明 oracle 没有迁就 stale digest 或错误 source target。

未运行：全仓 `pnpm` 门禁、Bridge API 临时端口 tests、后端 Linux/WSL module/adjacent/connectivity/cumulative tests、live
deployment tests、真实校准、held-out validation、live Provider acceptance。这些由主集成 Agent 在单槽正式集成后运行；本报告
不把未运行或跳过解释为通过。

## 9. Changed files、操作声明与建议集成顺序

Changed files 仅为：

- `tests/fixtures/phase0b-agent-orchestration/runtime-capability-snapshot.fixture.json`；
- `tests/fixtures/phase0b-agent-orchestration/runtime-capability-cases.json`；
- `tests/unit/phase0b-runtime-capability-oracle.test.mjs`；
- `docs/development/PHASE0B_RUNTIME_CAPABILITY_EVAL_REPORT.md`。

明确声明：未触碰正式 contract、F8、generated client、业务实现、共享测试、后端或 `D:\tileSim-web` 主工作树；未停止、重启、
替换或部署 5173；未 POST 正式 run；未读取 `TILESIM_EVIDENCE_AGENT_*` 或其他 credential；未调用 live Provider；未 reset、
clean、stash、commit 或 push。

建议集成顺序：

1. F8 具名 owner 确认目标语义，并以正式 successor 或 dual-version migration 解决 v1 breaking change；
2. 冻结 Git 可复现的 source target、schema-set、descriptor 和 create-run/nested manifest identities；
3. 项目负责人批准 capability/Profile identities，主 Agent 单槽发布正式 Schema 根和 manifest；
4. 从同一 revision 生成 Python/TypeScript types 与 runtime validators，并接入 Bridge immutable snapshot；
5. 集成本 Eval fixture/oracle，重新绑定最终 revisions，运行 Bridge 临时端口 tests 与全仓门禁；
6. 仅在 `GAP-CONTRACT-DRIFT-001` 收口且全部 DoR 条件同时满足后，重新裁决 Phase 1。

本 Agent 在 Phase 0B Runtime Eval 交付后停止，不进入 Phase 1。
