# Agent 编排 Phase 0B Capability Catalog Publication Candidate

状态：`publication_candidate`。本目录不在正式 OpenAPI、Schema 根、manifest 或 schema-set 中；只有项目负责人批准 identity 且集成负责人完成单槽发布后，才能改为 runtime contract。

## 候选 identity

| 对象                 | 候选 identity                                                |
| -------------------- | ------------------------------------------------------------ |
| catalog              | `tilesim.bridge.agent_orchestration_capability_catalog.v1`   |
| immutable snapshot   | `tilesim.bridge.agent_orchestration_capability_snapshot.v1`  |
| parameter descriptor | `tilesim.bridge.agent_orchestration_parameter_descriptor.v1` |
| model Profile        | `tilesim.bridge.agent_orchestration_model_profile.v1`        |
| engine Profile       | `tilesim.bridge.agent_orchestration_engine_profile.v1`       |
| device Profile       | `tilesim.bridge.agent_orchestration_device_profile.v1`       |
| topology Profile     | `tilesim.bridge.agent_orchestration_topology_profile.v1`     |
| workload Profile     | `tilesim.bridge.agent_orchestration_workload_profile.v1`     |

未知 identity、revision、support state、reason code 或 binding 全部失败关闭。candidate 的 catalog/snapshot revision 与 digest 由 `tilesim.bridge.canonical_json.v1` 对显式 digest material 计算。

- contract package revision：`sha256:cf2f833dd91fd08559c11b71f53e26282ed89bb84a59ef20e04636e6da4a49a0`
- catalog revision/digest：`sha256:dd8954774ce812c29a2915cc8acab2e3c0d82d32347bfbfd04fffa40c15b9fa5`
- snapshot revision/digest：`sha256:6dc417cc000b9718088bd653cc28b7c6aef71d286531795d4a03a4fd0d7185fd`

## 权威事实与绑定

- 八字段执行事实以 `D:\tileSim` 后端 revision `09c22c0efff890253a1eacf403c2979f56fd9ba6` 和 `docs/development/PHASE0_PARAMETER_TRACEABILITY_MATRIX.json` 为权威。
- Phase 0 execution evidence 原始 binding 是 schema-set `sha256:eb6c0d...e7095c`、experiment descriptor `sha256:de97e5...8c68d059`。
- 2026-09-08 本 Agent 只读 GET 观察到 5173 已是 schema-set `sha256:2214c4...2af8`、experiment descriptor `sha256:1ef962...f4f1`；create-run 仍为 v1。该部署变化不是本 Agent 所为，也不是可发布源码基线。
- candidate 将 Phase 0 `evidence_binding`、尚未冻结的 `source_target_binding` 和 `observed_non_target_runtime_binding` 分开。旧 HEAD 的 `eb6c...` / `de97...` 只属于 evidence/compatibility baseline，不是已决定的 Phase 1 source target。`source_target_binding` 为结构化 `target_pending` / `unavailable`，activation 保持 `unavailable`，直到 successor/dual-version、Git commit、F8 owner handoff、兼容裁决和 identity 审批完成。

## 发布投影

八个字段可作为 `agent_exposed` candidate，因为 `described/accepted/validated/lowered/executed/observable` 均有证据。`calibrated` 和 `held_out_validated` 均为 `denied`；claim scope ceiling 仅为 `exploration` 与 `synthetic_consistency`。

`s1.runtime.kv_capacity_tokens` 保持 `conditional` 并绑定 `GAP-KV-001`。两个横向扩展网络字段的当前默认 resolved fidelity 为 `Analytical`；不得从 requested DES 推断为 DES。

model/device/engine 选择、TP/PP/EP、物理 KV 策略、集合通信算法和 SLO 不在 candidate 的 `agent_exposed` 集合中。

## Profile family 与实际数据

五类 family Schema 均已形成 publication candidate；本目录不包含任何实际 Profile：model/device/topology/workload 为 `profile_missing`，engine 为 `conditional` 且 runtime `unavailable`。校准和 independent held-out 状态分别为 `calibration_missing`、`held_out_validation_missing`。

## 本地验证

```powershell
node tests/test_publication_candidate.mjs
python -m json.tool fixtures/capability-snapshot.publication-candidate.jsonc
git diff --check
```

测试不启动 Bridge、不操作 5173、不调用 Provider、不读取 credential，也不创建 run。
