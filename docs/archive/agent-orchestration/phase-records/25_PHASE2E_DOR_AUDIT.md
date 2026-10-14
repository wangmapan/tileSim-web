# Phase 2E DoR 审计

> 审计日期：2026-09-12
> 阶段裁决：`blocked_data`（同时存在 `blocked_calibration`、`blocked_contract`、`blocked_backend`）
> 允许状态：停在审计，不进入 Phase 2E calculator/Validation Report/typed receipt 实现，不进入 Phase 2F

本轮是只读审计、证据整理和审计 fixture/oracle 更新。没有修改 Profile registry 事实，没有新增
`agent_exposed` 字段，没有生成伪造 Profile、校准、held-out、ranking、绝对性能或部署保证。

## 1. 总体裁决

Phase 2D registry 提供了五类可追溯的条件记录，但没有任何可用或可执行组合：每类 registry entry
的 `runtime_status=unavailable`，`agent_exposed=false`，`calculator_eligible=false`，
`ranking_eligible=false`，`executable_combinations()` 为空，默认 profile query 返回空集。因此
Phase 2E 不能把 registry 的结构性事实当作 calculator 输入闭包。

| DoR 领域                  | 裁决                                   | 根因                                                                                                                                                      |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile availability      | `blocked_data`                         | 五类均无 available/runtime-executable record                                                                                                              |
| provenance/claim scope    | `blocked_data` + `blocked_contract`    | model record 存在 reviewed-registry fact 被标为 `observed`，且 calibration missing 时 claim scope 为 `real_calibrated_validation`；审计已记录，未修改事实 |
| calibration               | `blocked_calibration`                  | 五类 `calibration_status=missing`，没有 real-device/link/runtime calibration receipt                                                                      |
| held-out                  | `blocked_calibration`                  | 五类 `held_out_validation_status=missing`，没有独立 held-out 数据或报告                                                                                   |
| calculator                | `blocked_contract` + `blocked_backend` | 只有 schema/validator/fixture；无生产 calculator、algorithm implementation 或 receipt 进入 lowering                                                       |
| Validation Report         | `blocked_contract`                     | schema 存在但仅 contract-only；未绑定 approval，也没有 runtime planner/report service                                                                     |
| lowering/evidence closure | `blocked_backend`                      | Phase 2C 仍对缺失/不可用 Profile fail closed；没有从 receipt 到执行片段、资源、网络、指标和 evidence 的 Phase 2E 闭环                                     |
| Phase 2F                  | 不允许                                 | Phase 2E DoR 未满足，且不能由 synthetic consistency 或 CI 替代真实校准/held-out                                                                           |

## 2. 五类 Profile registry 记录

以下是 registry 当前实际 entry（数量为每类 1 条条件记录，但可用/可执行数量为 0）；这与 v1
Capability Catalog 的五类 `0/unavailable` 保持一致，不能填回 v1。

| family   | count / available | profile id                         | profile revision                                                          | canonical digest                                                          | source kind                   | license / regime                                  | calibration | held-out | claim scope                               |
| -------- | ----------------: | ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- | ----------- | -------- | ----------------------------------------- |
| model    |             1 / 0 | `mistralai.mistral-7b-v0.1`        | `sha256:8b26205d2a6492f9bf220c81bb13314b1689390815737c67ca97e705c9aa11dd` | `sha256:36f5141d3717fe1fa7c48ccb26b82342b86e81693a2664d2ac75571de6ebe12e` | `reviewed_registry`           | Apache-2.0 / public config facts, no timing claim | missing     | missing  | **错误地为** `real_calibrated_validation` |
| engine   |             1 / 0 | `vllm.0.6.semantic.v1`             | `sha256:4c5791b89255796a3c289437c6918d27e8823fd5a796a25985d3c4efca0f2150` | `sha256:59a2a315f48cc12a00fa812bf1da2fc492c40d4b219f2fe4cff2508422e205b8` | `reviewed_registry`           | NOASSERTION / backend-local semantic subset       | missing     | missing  | exploration                               |
| device   |             1 / 0 | `nvidia.a100-80gb-sxm`             | `sha256:ebd15b4f98972e898f157b28185b1fa08b9c639b298f560b8fa9174a232f778f` | `sha256:0bf05e28a2799b204b1674753cde19dcda20aa749e9ad57a73678f964fc90857` | `vendor_specification`        | NOASSERTION / structural specification only       | missing     | missing  | exploration                               |
| topology |             1 / 0 | `generic-hierarchical-fabric.4gpu` | `sha256:ca72a5a8852e9c719aa083b8b91c4d6a686a2a7b7187f0aae337c4299ced84e3` | `sha256:19cba74159d7e774859ce4babbe51e11731ddeafc1f1fbab62bbe8cf49a46dd6` | `compatibility_harness_trace` | NOASSERTION / fixture only                        | missing     | missing  | synthetic_consistency                     |
| workload |             1 / 0 | `s0-synthetic-example.seed7`       | `sha256:b01f45c3caaab76ed0bfc88887266344c58cf38b773cd9b7cb673ce4955b8c09` | `sha256:5c29c868413f5a0acc3d95e1d7eb0b7bd219e6a1ed3cd71a1470b49eedebe2a3` | `synthetic_trace`             | NOASSERTION / no-GPU synthetic fixture            | missing     | missing  | synthetic_consistency                     |

来源目录具有 URI/path、source kind、license、revision 和 valid regime；但 `working-tree` source
revision 不是可复现的 immutable source digest，且 reviewed registry 不等于 real observation。
审计发现 model 的 Hugging Face 配置/model-card 字段被 `_fact()` 归为 `observed`，同时其 calibration
仍为 missing 却声明 `real_calibrated_validation`；该事实未被修改，必须阻塞后续正式 calculator。

## 3. Calculator、Validation Report 与 typed receipt

Phase 2B 的正式 package manifest 仍声明：

- `runtime_status=contract_only`；
- `calculator_status=receipt_contract_only`；
- `validation_report_status=schema_and_validator_only`；
- `create_run_acceptance=not_accepted_by_current_api`；
- 七类 typed receipt identity 只有 schema-level publication。

Calculator receipt schema 能表达 `calculator_identity`、`algorithm_revision`、stable
`input_references`、units、exact/interval/unknown、rounding、assumptions、uncertainty、rule IDs、
repair candidates、claim-scope ceiling 和 typed facts，但没有生产 algorithm/service、golden/property/
boundary/risk-combination corpus 或将 receipt 注入 lowering 的调用链。Phase 2A valid fixtures 是
`fixture_only`，不能作为实现证据。

Validation Report schema 能表达 input binding、Profile snapshot、Capability snapshot、backend/schema
revision、validation policy、issues、receipts、compiled request preview、Pointer map、candidate plan、
budget、claim ceiling 和 stale binding；但当前 validator 不建立这些引用之间的完整 digest closure，
schema 也没有 approval binding 字段，Bridge 没有对应 runtime report service。因此它仍是 contract-only，
不能作为可执行 planning 或 approval 依据。

## 4. 输入到执行的闭包

| 边界                                                 | 当前证据                                                                        | Phase 2E 裁决                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Profile → binding                                    | binding 可构造 identity/revision/digest，但 builder 不检查 runtime availability | 仅可审计引用，不能证明可执行           |
| binding → intake                                     | Run Intake v2 schema/parser 已存在，后端对缺 Profile 返回 fail closed           | `blocked_backend`                      |
| receipt → compiled request                           | 无 calculator service、无 receipt consumer、无 compiled request producer        | `blocked_contract` + `blocked_backend` |
| compiled request → execution fragments               | Phase 2C 未将这些 Profile refs 接入生产 ExecutionFragmentBuilder                | `blocked_backend`                      |
| execution → KV/device/collective/network             | 既有手工 Trace 累计链可证明局部机制，但不是 Phase 2 输入闭包                    | `blocked_backend`                      |
| network/resource feedback → request metrics/evidence | 既有局部 DES chain 有证据；没有 Phase 2E receipt-owned evidence                 | `blocked_backend`                      |
| approval/idempotency/retention                       | proposal 定义了 stale/409/tombstone 语义；没有 Phase 2E runtime operation       | `blocked_contract`                     |

因此不能生成组合兼容性结论、性能 ranking、绝对 TTFT/TPOT/吞吐、SLO 可达性或部署保证。
`unknown`、`profile_missing`、`unavailable` 与 `incompatible` 不能互相替换；当前没有 combination
resolver，正确结果仍是 unknown/blocking，而不是“全部不兼容”或自动候选。

## 5. Fail-closed、stale、幂等与 uint64

- registry query 默认不返回 unavailable entry；unknown family、visibility/sensitivity mismatch、expired/revoked 记录被排除。
- snapshot 绑定 registry revision 与五类 profile refs；revision/digest 改变会触发 stale。
- registry negative tests 覆盖 digest mismatch、source/license/provenance 缺失、unknown、snapshot stale、synthetic self-promotion 和确定性排序。
- Profile binding 可被构造但不代表 runtime-ready；这是本审计记录的 `binding_does_not_prove_executability` 风险。
- proposal/manifest 定义 same-key same-payload exact replay、same-key different-payload 409、revision drift stale、expiry/delete tombstone 和 forbidden persistence；当前没有 Phase 2E operation service，因此只能判为 contract-only，不能声称 runtime enforcement。
- 现有 registry typed 数值均为 canonical decimal strings，未见浮点、指数或超出 uint64 的值。JSON Schema 的 uint64 pattern/maximum 具备边界表达，但 Python profile validator 对 typed fact 的 overflow enforcement 不完整，记录为 `uint64_validator_boundary_gap`，不得进入 calculator。

## 6. 前端与证据边界

审计未发现 Phase 2E frontend mock、默认 Profile、隐式 calculator fallback 或新的 `agent_exposed` 字段；前端只保留既有 Phase 1 八字段与历史运行报告 contract。`src` 没有 registry endpoint/UI 引用。synthetic consistency、compatibility fixture、CI 和局部后端链均未被当作 real calibration 或 held-out validation。

## 7. 审计 fixture/oracle 与门禁

专用审计材料：

- `bridge/contracts/agent_orchestration_phase2/tests/fixtures/phase2e-dor-audit.json`
- `bridge/contracts/agent_orchestration_phase2/tests/test_phase2e_dor_audit.py`

覆盖：五类记录数量/availability、source/license/regime/lifecycle、字段 provenance 分类、claim-scope
升级、calculator/Validation Report contract-only、binding/snapshot stale、组合数、uint64 canonical
边界、无前端 mock/曝光和不可声称项。审计测试必须对已知阻塞事实保持通过，不能把 blocker 改成 warning 或删除断言。

## 8. 当前 Gap Register 更新与停止条件

Phase 2E 相关 Gap 维持/更新为：

- `GAP-PROFILE-SUCCESSOR-001`：数据层仍 `blocked_data`，model claim/provenance mismatch 必须先修正并复核；
- `GAP-CALIBRATION-001`、`GAP-HELDOUT-001`：`blocked_calibration`；
- `GAP-CALCULATOR-001`：`blocked_contract` + `blocked_backend`，七类 receipt 尚无实现和执行证据；
- `GAP-VALIDATE-001`：`blocked_contract`，缺 runtime binding/approval/compiled closure；
- `GAP-RUN-INTAKE-001`、`GAP-ENGINE-001`、`GAP-PARALLEL-001`、`GAP-KV-001`、`GAP-WORKLOAD-001`、`GAP-NETWORK-001`、`GAP-SLO-001`：继续 `blocked_backend` 或 `blocked_contract`，不可由本轮审计关闭。

停止条件满足：Phase 2E DoR 标记为 `blocked_data`（并列 `blocked_calibration`、`blocked_contract`、
`blocked_backend`），不允许进入 Phase 2E 实现或 Phase 2F。

本轮未 commit、未 push、未部署，未读取 credential，未调用 live Provider，未创建正式 simulation run，
未停止/重启/替换 `127.0.0.1:5173`。后端既有 `build-local/` 和 Web lightweight-workbench 未跟踪/未提交改动均保留。
