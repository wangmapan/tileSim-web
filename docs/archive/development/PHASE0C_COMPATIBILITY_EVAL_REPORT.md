# Phase 0C F8 双版本迁移兼容性独立评估

> 状态：`final pre-commit compatibility closure / 28 of 28 passed`
>
> 日期：2026-09-09（Asia/Shanghai）
>
> Worktree / branch：`D:\tileSim-worktrees\phase0b-runtime-eval` / `codex/ao-phase0b-eval`

## 1. 结论

独立 compatibility oracle 已建立并完成最终复跑。加载正式 F8 集成源码、当前 Web 集成根和隔离旧版本根后，生产
validator、默认路由、old-server refusal、幂等、descriptor/schema 与 generated closure 共 **28/28 passed**。
Phase 0C compatibility closure 已完成；Web 源码仍处于未提交状态，不能据此宣称已发布或已部署。

初次集成审计发现的两个阻塞均已关闭：

| Case ID                              | old result                             | new result                                                               | 预期                        | Owner                     | Blocking |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------ | --------------------------- | ------------------------- | -------- |
| `P0C-F8-LEGACY-FIXTURE-PRESERVATION` | 旧 fixture 应保留                      | runner 已恢复并执行 `partially_calibrated`、`exploratory_s6_only`、`0.5` | v1 旧语义保留且 runner 通过 | `phase0c_f8_dual_version` | 否       |
| `P0C-GENERATED-VERSION-CLOSURE`      | descriptor/schema/generated 应为 v1+v2 | generated client 已包含 v1/v2 并与默认 v1 一致                           | v1/v2/default closure 一致  | 主 Agent集成槽            | 否       |

Oracle 预期没有为实现结果放宽：最终复跑继续检查旧 fixture 的实际文本并独立扫描 generated artifacts。

## 2. 只读审计与 ownership

Phase 0C 开始前只读核对：

- Web HEAD：`09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`；
- 后端 HEAD：`09c22c0efff890253a1eacf403c2979f56fd9ba6`；
- Web 主工作树存在未提交 F8 改动；后端主工作树存在既有测试/文档改动；
- 5173 仅执行 GET 身份复核，未部署、停止、重启或写入；
- F8 实施 worktree：`D:\tileSim-worktrees\phase0b-contract-drift-audit`，只读加载；
- Capability worktree 只读加载其 Phase 0B candidate，不修改 Catalog 生产候选；
- 本 Agent 只新增 Phase 0C fixtures、独立 test、报告；未修改 Phase 0B oracle 或任何生产 contract。

| 范围                                                            | Owner                            | 本 Agent操作 |
| --------------------------------------------------------------- | -------------------------------- | ------------ |
| nested v1/v2 Schema、validation、execution、F8 fixture/局部测试 | `phase0c_f8_dual_version`        | 只读交叉验证 |
| Capability Catalog 正式 publication                             | `phase0c_capability_publication` | 只读         |
| OpenAPI、manifest、generated clients、共享集成                  | 主 Agent                         | 只读观察     |
| compatibility fixtures、oracle、脱敏报告                        | 本 Agent                         | 独占新增     |

## 3. 兼容矩阵

### 3.1 old client → new server

旧 nested v1 payload 必须继续接受以下五类旧语义；同一 payload 在 old HEAD 与 new v1 的 oracle 结果均为 `accept`：

1. `calibration_level=partially_calibrated`；
2. `allowed_claim_scope=exploratory_s6_only`；
3. `oversubscription_factor=0.5`；
4. 仅 `uncertainty_score` / `tail_risk` 不同的候选仍 distinct；
5. DES fidelity 不应用新增 aggregate promotion budget。

对应的 new v2 结果均为 `reject`，严格规则只在显式 v2 下生效。

### 3.2 new v2 → new server

独立 oracle 覆盖并在 F8 worktree 通过：

- 严格 v2 最小合法 payload 接受；
- partial calibration、旧 claim scope、`oversubscription < 1` 拒绝；
- 新六项执行输入 uniqueness 拒绝只改变 risk metadata 的 duplicate；
- DES aggregate budget 超限拒绝；
- default fidelity 不触发 DES-only aggregate budget。

### 3.3 new v2 → old server

old HEAD server 对显式 `tilesim.design_space.s6_candidates.v2` 返回正式 reject（字段为
`/design_space_candidates/schema_version`），不会把 v2 降级成 v1。未知 nested identity 和未知 descriptor revision 同样
失败关闭。

### 3.4 默认路由与 identity

- 顶层 identity 保持 `tilesim.bridge.create_run_request.v1`；
- 未提供 nested `schema_version` 固定解析为 v1；
- 禁止通过 payload 内容推断版本；
- v1 与 v2 使用相同业务字段时，nested identity 不同，canonical payload/digest 不同；
- 新 key + 旧 v1 payload 继续通过 v1 validator；
- retained v1 run 按保存的 v1 identity 和 exact digest 恢复。

## 4. 幂等与 canonical

独立 ledger oracle 覆盖：

- same key / same exact canonical payload → exact replay（HTTP 200 replay semantics）；
- same key / different field → `409 idempotency_payload_mismatch`；
- same key / 仅 nested version 不同 → 同样视为 different payload 并返回 409；
- retained v1 run 在新服务重启后仍按原 digest/identity replay；
- 新 key + 旧 v1 payload → 新 run 使用 v1 validator，不进入 v2。

canonical digest 仍使用顶层 request material；改变 nested `schema_version` 必须改变 digest。没有修改既有 canonicalization 算法、
Idempotency-Key 生成或比较顺序。

## 5. descriptor/schema/generated 版本闭包

F8 实施接口已冻结为：

- Schema：`design-space-candidates.schema.json`（v1）与 `design-space-candidates-v2.schema.json`（v2）；
- create-run 顶层保持 v1，并通过 `oneOf` 接受 nested v1/v2；
- descriptor 声明 `design_space_candidate_schema_options` 与
  `default_design_space_candidate_schema_identity=v1`；
- `ValidatedRunRequest.design_space_candidate_schema_identity` 与 error `nested_schema_identity` 用于保存实际版本；
- run metadata 需保留同名 nested identity。

最终集成源码的 Schema、descriptor、Python validator 与 generated client 均符合 v1/v2 预期。顶层 create-run 保持 v1，
nested v1/v2 和默认 v1 集合一致，`P0C-GENERATED-VERSION-CLOSURE` 已关闭。

## 6. `bridge/test_f8_schemas.mjs` 门禁

独立 oracle 要求 runner 继续包含并实际执行旧 fixture 值 `partially_calibrated`、`exploratory_s6_only` 与 `0.5`，随后 runner
必须 exit 0。最终源码满足该要求；旧 case 没有被删除或改写为 v2。

## 7. 测试结果

最终复跑：

- Phase 0C 完整环境 compatibility oracle：28/28 passed；
- `bridge/test_f8_schemas.mjs`：passed；
- Bridge full unittest discover：105/105 passed；
- frontend `pnpm test`：417 passed，7 skipped；
- Phase 0D evidence reproducibility oracle：8/8 references verified；
- 旧 HEAD server v2 refusal：passed（隔离旧 worktree，未修改）；
- `pnpm contracts:check`、typecheck、lint、build：passed；
- desktop fixture Playwright：47 passed，5 个 deployed/live tests skipped。

初次审计的 26 passed / 2 failed 是集成前历史证据，已被上述最终 28/28 结果取代。未运行 live Provider、真实校准、
held-out validation 或正式 simulation run；skipped/未运行项不计为通过。

## 8. Security、retention、provenance 与操作声明

- Fixtures 只包含 synthetic compatibility facts、identity、revision、digest、case ID 和预期状态；
- 不包含 credential、Provider response、用户问题、artifact payload 或 `TILESIM_EVIDENCE_AGENT_*`；
- 未调用 Provider，未创建正式 run；
- 未部署、停止、重启或替换 5173；
- 未修改 F8 生产实现、formal Schema、generated client、Capability Catalog、Phase 0B oracle 或 UI；
- 未 reset、clean、stash、checkout 覆盖、commit 或 push。

## 9. 剩余发布门禁

1. Web runtime/reproducibility commits `64a741f3dfc76ef4b80352f1ca1197428de1ab25` /
   `df1f24452384d328ce402ffa37affbd8c734da13` 已形成；
2. 真实 Web/backend revision 的 catalog/package/schema-set/generated/runtime snapshot closure 已通过；
3. Windows UTF-8 oracle portability follow-up 已通过；docs/evidence commit 仍需独立授权；
4. 继续排除 mixed-ownership、launcher、deployment、Evidence Agent 和 Trace 文件；本任务不启动 Phase 1。

Phase 0C compatibility 与 Web runtime/reproducibility 发布已闭合；本任务停在 Phase 0D docs/evidence checkpoint，
不自动开始 Phase 1。
