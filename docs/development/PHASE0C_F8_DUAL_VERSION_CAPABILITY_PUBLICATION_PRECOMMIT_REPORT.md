# Phase 0C F8 双版本迁移与 Capability Catalog 正式发布 pre-commit 报告

> 事实日期：2026-09-09（Asia/Shanghai）
>
> 状态：`superseded_by_phase0d_runtime_commit / phase1_not_started`
>
> Web runtime/reproducibility commits：`64a741f3dfc76ef4b80352f1ca1197428de1ab25` /
> `df1f24452384d328ce402ffa37affbd8c734da13`
>
> 后端 execution evidence commit：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`

## 1. 结论

Phase 0C 的实现和非 live hard gates 已闭合。F8 保持顶层
`tilesim.bridge.create_run_request.v1`，同时接受 nested v1/v2；v1 恢复旧语义，v2 承载严格规则。
Capability Catalog、immutable snapshot、parameter descriptor、五类 Profile family 已进入正式源码
Schema/OpenAPI/manifest/generated/runtime validator；Bridge 提供只读 snapshot endpoint，Web 提供最小只读 adapter。

Phase 0D 已将八字段执行证据绑定到独立后端 commit，并已按本报告 allow-list 创建 Web runtime commit。Commit-bound
snapshot、8/8 evidence closure 与 Windows UTF-8 oracle portability follow-up 均已通过；docs/evidence 仍待授权。
没有 push、部署/停止/重启 5173、读取 credential、调用 live Provider或创建正式 simulation run。Phase 1 未启动。

## 2. F8 兼容矩阵

| 场景                                    | 结果                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| old client → new server，五类旧 payload | nested v1 接受；与旧 HEAD canonical payload 行为一致                                      |
| new client → new server                 | nested v2 严格 provenance、oversubscription、六输入 uniqueness、DES aggregate budget 生效 |
| new client → old server                 | v2 unknown identity 正式拒绝，不降级                                                      |
| nested identity 缺失                    | 固定解释为 v1，不根据内容猜版本                                                           |
| v1/v2 同业务字段                        | identity 与 raw canonical payload digest 不同                                             |
| same key + same exact payload           | 精确 replay                                                                               |
| same key + different payload            | 409 `idempotency_payload_mismatch`                                                        |
| same key + version only changed         | 409 `idempotency_payload_mismatch`                                                        |
| retained v1 run                         | 按原 digest/identity 恢复                                                                 |
| unknown identity/revision               | fail closed                                                                               |

v1 继续接受 `partially_calibrated`、五类旧 claim scope、oversubscription 下界 `0.000001`，uniqueness
包含 uncertainty/tail-risk，且不应用新 DES aggregate budget。v2 只接受 `uncalibrated` /
`exploratory`，oversubscription 下界为 1，使用六执行输入 uniqueness，DES 请求应用 aggregate budget。
validation error、descriptor 和 run metadata 均保留实际 nested identity。顶层 shape、canonical digest 算法与幂等
检查顺序未改变，因此没有发布 create-run v2。

## 3. 正式 Capability identities 与 digest

- Catalog：`tilesim.bridge.agent_orchestration_capability_catalog.v1`
- Snapshot：`tilesim.bridge.agent_orchestration_capability_snapshot.v1`
- Parameter descriptor：`tilesim.bridge.agent_orchestration_parameter_descriptor.v1`
- Profile：model / engine / device / topology / workload v1
- Catalog revision/digest：
  `sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b`
- Contract package revision：
  `sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3`
- 当前源码 schema-set：
  `sha256:3211d2df2e166a0ebc62f0f08ad014bf15fee8fb4bda79f3372897be3c28c15d`
- Experiment descriptor revision：
  `sha256:130ff231e59c5b7900dd9d4b51b590d23022b08a8ab8ad7857355a9b45632b6b`

Snapshot revision 由 catalog content 与 runtime 注入的 release binding 共同 canonical 计算，不是静态常量，也不嵌入
未来 commit。以 Web HEAD `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`、后端 evidence commit
`7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 和上述 schema-set 构造的 pre-commit 测试向量为
`sha256:90869411f1084001371a0e0f6edf634dfa6036b34e57494600530b27b2010df9`；该向量不是已部署 release revision。

## 4. 能力与 Profile 状态

正式 `agent_exposed` 字段：

1. `s0.workload.message_size_multiplier`
2. `s1.runtime.batch_scheduler`
3. `s1.runtime.max_batch_size`
4. `s1.runtime.kv_capacity_tokens`
5. `s6.fabric.scale_up_bandwidth_gbps`
6. `s6.fabric.scale_up_latency_us`
7. `s6.fabric.scale_out_bandwidth_gbps`
8. `s6.fabric.scale_out_latency_us`

八字段均为 described/accepted/validated/lowered/executed/observable/agent_exposed affirmed；calibrated 与
held_out_validated 均 denied。claim scope ceiling 仅 exploration/synthetic_consistency。
`kv_capacity_tokens` 保持 conditional 并绑定 `GAP-KV-001`；scale-out 当前 resolved fidelity 为 Analytical。

五类 Profile Schema 已正式发布，实际记录数均为 0，runtime availability 均为 unavailable。engine data status
保持 conditional；其余 family 为 profile_missing。model/device/engine selection、TP/PP/EP、物理 KV、
集合通信算法和 SLO 继续 not_exposed。没有创建 H100、模型、引擎、拓扑或 workload 假数据。

## 5. API、generated 与 Web

- OpenAPI/manifest 注册 `GET /api/agent/orchestration-capabilities`。
- endpoint 返回 validated immutable snapshot；release metadata missing/unknown/drift 时返回结构化 503。
- schema-set/header/snapshot/catalog/package binding 不一致时失败关闭。
- generated TypeScript types、Bridge client、F8 v1/v2 validators 和 Capability standalone validator 已生成。
- Web 只新增只读 API/validation adapter；未修改 App Shell、全局导航、PagePrimer 或 guided help。
- Evidence Agent descriptor 保持 v2；request/response/citation/snapshot-reference 保持 v1。

## 6. 测试

| 门禁                                                 | 结果                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| F8 Python module tests                               | 24/24 passed                                                |
| `bridge/test_f8_schemas.mjs`                         | passed                                                      |
| Phase 0C independent compatibility oracle            | 28/28 passed                                                |
| Capability local Ajv                                 | 9 Schema + catalog + snapshot passed                        |
| Capability Python tests                              | 6/6 passed                                                  |
| Phase 0D evidence reproducibility oracle             | 8/8 references verified；unit 5/5 passed                    |
| Bridge full unittest                                 | 105/105 passed                                              |
| frontend `pnpm test`                                 | 417 passed, 7 skipped                                       |
| `pnpm contracts:check`                               | passed                                                      |
| `pnpm deps:check`                                    | passed，207 source files                                    |
| `pnpm typecheck`                                     | passed                                                      |
| `pnpm lint`                                          | passed                                                      |
| `pnpm format:check`                                  | passed                                                      |
| `pnpm build`                                         | passed；仅既有 chunk-size warning                           |
| `pnpm test:e2e`                                      | passed；52 total，5 个需 live 坐标的 deployed tests skipped |
| WSL rebuilt backend module/adjacent/cumulative tests | 3/3 passed                                                  |
| 两仓库 `git diff --check`                            | passed                                                      |

所有 unit/fixture/CI/desktop E2E 仅证明契约与 synthetic consistency，不是 calibration、held-out 或 live acceptance。

## 7. Gap 与 Phase 1 DoR

- `GAP-CONTRACT-DRIFT-001`：`validated`；双版本、旧/新客户端、幂等、retained replay 与
  generated closure 已通过并形成 Git 可复现 source target。
- `GAP-CAP-001`：`validated`；正式 catalog/snapshot/endpoint 与八字段 revision closure 已通过。
- `GAP-PROFILE-001`：`validated`；本状态只表示五类正式 Schema 和 0/unavailable 已通过；真实 Profile
  source/licensing/calibration 是后续独立数据 Gap。

Phase 1 技术 DoR hard gates 已满足；后端 execution evidence 与 Web runtime/reproducibility Git 发布点已形成。
Docs/evidence 尚未提交；本任务不自动启动 Phase 1。

## 8. Web runtime commit 文件记录

正式契约与 Bridge：

- `bridge/api/responses.py`
- `bridge/contracts/experiment_descriptor.py`
- `bridge/contracts/openapi.json`
- `bridge/contracts/run_request.py`
- `bridge/contracts/schemas/api-manifest.schema.json`
- `bridge/contracts/schemas/bridge-api.schema.json`
- `bridge/contracts/schemas/create-run-request.schema.json`
- `bridge/contracts/schemas/design-space-candidates.schema.json`
- `bridge/contracts/schemas/design-space-candidates-v2.schema.json`
- `bridge/contracts/schemas/error.schema.json`
- `bridge/contracts/schemas/experiment-descriptor.schema.json`
- `bridge/contracts/validation.py`
- `bridge/contracts/agent_orchestration_capability/**`
- `bridge/server.py`
- `bridge/services/capability_catalog.py`

生成与 Web：

- `scripts/generate-bridge-client.mjs`
- `src/contracts/bridge-api.ts`
- `src/contracts/generated/bridge-client.ts`
- `src/contracts/generated/bridge-contracts.ts`
- `src/contracts/generated/create-run-schema.ts`
- `src/contracts/generated/evidence-agent-validators.js`
- `src/contracts/generated/experiment-validators.js`
- `src/contracts/generated/agent-orchestration-capability-validators.js`
- `src/lib/api/agent-orchestration-capabilities.ts`
- `src/features/run-experiment/DesignSpaceInputPanel.vue`
- `src/features/run-experiment/request.ts`

测试与 fixture：

- `bridge/test_f8_schemas.mjs`
- `bridge/test_server.py`
- `tests/fixtures/evidence-agent.ts`
- `tests/fixtures/experiment-descriptor.ts`
- `tests/fixtures/phase0c-compatibility/f8-dual-version-cases.json`
- `tests/unit/agent-orchestration-capabilities.test.ts`
- `tests/unit/experiment-schema.test.ts`
- `tests/unit/phase0c-f8-dual-version-compatibility.test.mjs`
- `tests/oracles/phase0d-evidence-reproducibility.mjs`
- `tests/unit/phase0d-evidence-reproducibility-oracle.test.mjs`

文档：

- `docs/F9_AGENT_ORCHESTRATION/README.md`
- `docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md`
- `docs/F9_AGENT_ORCHESTRATION/04_CAPABILITY_AND_PROFILE_CATALOG.md`
- `docs/F9_AGENT_ORCHESTRATION/12_DELIVERY_ROADMAP_AND_BACKLOG.md`
- `docs/F9_AGENT_ORCHESTRATION/14_CONTRACT_GAP_REGISTER.md`
- `docs/development/PHASE0C_COMPATIBILITY_EVAL_REPORT.md`
- 本报告。

`docs/AI_HANDOFF.md` 同时含有 launcher、部署、Evidence Agent 和 Trace 工作台内容，属于 mixed ownership，明确不进入
本次 runtime 或 docs/evidence commit。

## 9. 受保护的既有工作树改动

Web 工作树还包含 Phase 0 proposal、Evidence Agent/launcher/部署/Trace 和 mixed-ownership 文档等既有未提交改动，包括：
`.prettierrc.json`、根/Bridge README、`docs/AI_HANDOFF.md`、Phase 0 proposal、F9/Trace 文档、
launcher/configuration/deployment scripts 和 `tools/launcher/**`。它们均未被 reset、clean、stash、restore 或覆盖。
后端主工作树历史中的用户合并提交仍保留 Week7/8 文档，未跟踪 `build-local/` 也保持不变；Catalog 只绑定独立 clean
evidence commit `7e5a8c6a5cf738bd24608b440a61b62dee8d1881`。

建议 Web runtime local commit message：

`feat(agent-orchestration): publish capability catalog and version F8 candidates`
