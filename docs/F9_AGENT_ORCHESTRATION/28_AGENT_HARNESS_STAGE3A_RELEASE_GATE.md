# Agent Harness 阶段 3A 独立发布门禁（2026-10-18）

状态：**NO-GO**。本记录是当前工作树的独立审查事实，不改写历史验收数字，也不代表已部署版本。

## 门禁身份

| 项目                              | 记录                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| Release-gate schema               | `tilesim.agent_harness.stage3a_release_gate.v1`                           |
| Gate revision                     | `2026-10-18.3a.v1`                                                        |
| Execution contract                | `2026-10-18.wpc.v1`                                                       |
| Schema-set revision               | `sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50` |
| Backend source/build revision     | `5e44dbb0abb1d1b73d6131b9212277e4ea97d2c8`                                |
| Backend source/build state digest | `4ee7fdaca4252d2fae5a9418c23e6a453a907964b7dd4a368c964651a4ebb7fc`        |
| Synthetic CLI SHA-256             | `99633e8d50ec91038c21c64eb8a10ae11a0805840ee9c38cbc036f8f64ee0768`        |
| Synthetic CLI bytes               | `3073024`                                                                 |
| Reviewer state                    | `independent_review_completed_no_go`                                      |

机器可校验入口是 `bridge/run_agent_harness_stage3_release_gate.py`，对应测试为
`bridge/test_agent_harness_stage3_release_gate.py`。入口只写调用方指定的仓外临时 manifest；不读取、保存或输出 Provider credential、raw response 或 hidden reasoning。

Provider acceptance 与人工 evidence/citation review 的 redacted 准备资产由
[`29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md`](29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md) 和
`bridge/run_agent_harness_stage3_acceptance_prep.py` 登记；当前仍为 `live_acceptance_pending` / `not_run`，不改变本门禁的
**NO-GO** 结论。

## AH3-F01–AH3-F26

26 个 case 均由 `Stage3FaultMatrixTest` 通过，并在 release-gate manifest 中登记稳定 case ID、测试名、error code、JSON Pointer、retryable、operation state、event sequence、ledger、副作用计数、run/artifact 计数和 payload redaction 结果。 durable store 注入 case 的 HTTP/CLI 观测明确标记为 `not_applicable`/`0`，不会从 fixture 推断真实 HTTP 或 CLI 结果；正式 HTTP submit/status/events/SSE/result 由 `Stage3HttpTest` 覆盖。

| ID      | Case                         | Result | Stable code                        | State / recovery     |
| ------- | ---------------------------- | ------ | ---------------------------------- | -------------------- |
| AH3-F01 | 未批准 draft submit          | pass   | `approval_not_found`               | queued / not entered |
| AH3-F02 | invalid draft                | pass   | `state_conflict`                   | queued / not entered |
| AH3-F03 | stale draft                  | pass   | `approval_not_found`               | queued / not entered |
| AH3-F04 | expired approval             | pass   | `approval_expired`                 | queued / not entered |
| AH3-F05 | revoked approval             | pass   | `approval_rejected`                | queued / not entered |
| AH3-F06 | approval replay              | pass   | `approval_not_found`               | queued / not entered |
| AH3-F07 | digest mismatch              | pass   | `stale_draft`                      | queued / not entered |
| AH3-F08 | schema revision mismatch     | pass   | `schema_revision_mismatch`         | queued / not entered |
| AH3-F09 | backend identity mismatch    | pass   | `backend_identity_mismatch`        | queued / not entered |
| AH3-F10 | principal/workspace mismatch | pass   | `principal_forbidden`              | queued / not entered |
| AH3-F11 | same key + same payload      | pass   | `idempotent_replay`                | queued / not entered |
| AH3-F12 | same key + different payload | pass   | `idempotency_payload_mismatch`     | queued / not entered |
| AH3-F13 | queue capacity               | pass   | `queue_capacity_reached`           | queued / not entered |
| AH3-F14 | worker crash                 | pass   | `bridge_restart_recovery_required` | recovery_required    |
| AH3-F15 | Bridge restart               | pass   | `bridge_restart_recovery_required` | recovery_required    |
| AH3-F16 | create-run timeout           | pass   | `run_timeout`                      | recovery_required    |
| AH3-F17 | create-run nonzero           | pass   | `create_run_failed`                | failed               |
| AH3-F18 | create-run unknown outcome   | pass   | `recovery_required`                | recovery_required    |
| AH3-F19 | duplicate event              | pass   | `idempotent_replay`                | queued / sequence 1  |
| AH3-F20 | out-of-order event           | pass   | `event_out_of_order`               | queued               |
| AH3-F21 | cancel late terminal         | pass   | `cancelled_late_result`            | cancelled            |
| AH3-F22 | retry non-retryable          | pass   | `retry_not_allowed`                | failed               |
| AH3-F23 | resume completed side effect | pass   | `terminal_mutation`                | completed            |
| AH3-F24 | artifact identity mismatch   | pass   | `artifact_manifest_invalid`        | failed               |
| AH3-F25 | retention/delete             | pass   | `operation_not_found`              | deleted              |
| AH3-F26 | terminal fence               | pass   | `terminal_mutation`                | completed            |

所有 26 case 的重复副作用均为 `false`，禁止 payload 残留均为 `false`。F16/F18 的 unknown side effect 进入 `recovery_required`；F21 的迟到结果被 cancellation fence 拒绝；F25 删除后 stage3 lookup 不可读。

## Hosted synthetic smoke

使用仓外临时 Bridge、当前源码 `TileSimCLI.exe` 和临时状态根复跑一次完整路径：

- run：`run-20261018-185914-e40329ea`
- draft → validation → approval → execution → `/api/runs` → polling → SSE → result reference → artifact manifest
- event sequence：`1..5`；SSE sequence 与 polling 一致
- run count：`1`；同 key replay 仍为同一 run；不同 payload：HTTP `409` / `payload_conflict`
- provenance：`synthetic_trace`；claim scope：`exploratory`
- requested/resolved fidelity：`des` / `des`
- artifact manifest：9 项，全部绑定同一 run；SHA-256 与 bytes 已记录在仓外 release-gate manifest
- 失败路径不伪造 completed；rejected/unavailable/expected_absence 不转换为空成功

临时 Bridge、run、SQLite 和输出均已在 smoke 结束后删除；未操作 `127.0.0.1:5173`。

## 独立审查清单

| 项目                                                           | 状态      | 依据                                                            |
| -------------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| execution contract / OpenAPI / Schema / generated drift        | pass      | `pnpm contracts:check`                                          |
| WP-A/WP-B/WP-C revision 关系                                   | pass      | `2026-10-17.wpa.v1` → `2026-10-18.wpb.v1` → `2026-10-18.wpc.v1` |
| proposal v0 runtime rejection                                  | pass      | stage2/stage3 validator                                         |
| `/api/runs` 唯一真实运行入口                                   | pass      | stage3 submit gateway + hosted smoke                            |
| operation/run/artifact identity binding                        | pass      | result reference + manifest revalidation                        |
| retry/resume side-effect fence                                 | pass      | AH3-F22/F23 + runtime mutation tests                            |
| unknown outcome no blind retry                                 | pass      | AH3-F16/F18                                                     |
| cancel late-event fence                                        | pass      | AH3-F21                                                         |
| delete/redaction/retention                                     | pass      | AH3-F25                                                         |
| queue/checkpoint/ledger frontend-independent                   | pass      | durable store/worker tests                                      |
| no second workflow runtime                                     | pass      | WP-D bakeoff decision                                           |
| autonomous optimization/candidates/unattended execution closed | pass      | capability/document review                                      |
| Provider status matches actual probe                           | blocked   | `live_acceptance_pending`; no live repetition executed          |
| citation/provenance/claim-boundary human review                | blocked   | no human review artifact supplied                               |
| release decision                                               | **NO-GO** | Provider and human review blockers                              |

## 下一阶段边界

阶段 3A 不满足进入前端 execution UI 的 go 条件。前端继续保持只读/不可用显示；不开放自主优化、自动候选、多工具自主循环、无人值守实验或真实 Provider 能力。

## 2026-10-18 本轮最终验收复跑记录

使用 `bridge/run_agent_harness_stage3_release_gate.py`、正式 Bridge、当前 schema-set 和
`D:\tileSim\build-ca1\Release\TileSimCLI.exe` 复跑，结果如下：

- AH3-F01–AH3-F26：`26/26 pass`；release-gate suite：`54/54 pass`。
- Hosted synthetic smoke：`pass`；run `run-20261018-223907-c3856146`；event/SSE/polling sequence `1..5`；
  run count `1`；same-key replay run count `1`；different payload `409 payload_conflict`。
- Synthetic evidence 明确标记 `synthetic_trace` / `exploratory`，requested/resolved fidelity 为 `des/des`，不进入
  Provider acceptance 或 real-calibrated claim。
- Provider capability probe：`not_run/not_configured`；四个固定 lane
  （success、refusal_or_invalid_response、timeout_or_unavailable、identity_mismatch）均 `not_run`；成功 repetition `0`。
- 独立人工 evidence/citation review：`not_run`；reviewer count `0`。

仓外 redacted 资产：acceptance manifest
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\provider-acceptance-manifest.json`
（`sha256:142056eac084dcf47f4539a60f923e9b779cc4103c8d5ae14462b94253076abe`），review package
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\evidence-citation-review-package.json`
（`sha256:963ed92dc6064a3f93ff5cf86a74e42cd49683e8d9c86fc3dbf3fdd38ddbc567`），release-gate manifest
`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-release-gate-d2094e8d5b7947a7993aa820c43234d9.json`
（`sha256:c5cc6e0f8381be31f53f82cfbb96f97e174d9bf7fc93c5dd714d4aa3281922c5`）。本轮没有读取、输出或持久化
credential、token、raw Provider response、hidden reasoning 或完整敏感 evidence payload。

发布门禁结论仍为 **NO-GO**，阻塞项为真实 Provider acceptance 和独立人工 evidence/citation review；不允许进入
3B execution UI 或阶段 4。
