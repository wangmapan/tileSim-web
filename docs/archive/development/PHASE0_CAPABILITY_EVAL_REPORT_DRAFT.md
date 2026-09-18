# Phase 0 Capability/Profile Eval Report（草案）

> 报告状态：`draft`，`fixture_only`，未发布运行时契约
>
> 评测角色：独立 Eval/Security Agent
>
> 评测日期：2026-09-06（fixture 固定时钟）
>
> Web 基线：`09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`
>
> 后端只读基线：`09c22c0efff890253a1eacf403c2979f56fd9ba6`

## 1. 结论

Phase 0 独立评测数据与 deterministic oracle 已建立。当前数据集包含 33 个 case：6 个 validation、18 个 test、9 个 held-out adversarial。oracle 对 unknown identity、歧义、生命周期、revision drift、来源与适用区间缺失、证据等级自报、无损 uint64、单位、边界、组合冲突和 Agent 暴露闭包执行 fail closed。

本报告不宣布 capability/profile 正式 contract 已发布，不宣布任何字段完成真实校准或独立 held-out 验证，也不关闭 live Provider 或人工 citation entailment 门禁。独立 fixture 中的两个 `agent_exposed=true` 条目仅用于验证状态闭包和 evidence-reference 形状；其实际 runtime 状态必须由 Backend Traceability Agent 的字段追踪矩阵和正式 proposal 共同裁决。

## 2. 职责与文件所有权

本评测线只负责：

- proposed/non-published capability/profile fixture；
- 正例、边界、失败、drift 和 adversarial case；
- 不依赖业务实现的 deterministic oracle；
- redacted eval report 草案。

独占写入范围：

- `tests/fixtures/phase0-agent-orchestration/**`；
- `tests/unit/phase0-capability-oracle.test.mjs`；
- `docs/development/PHASE0_CAPABILITY_EVAL_REPORT_DRAFT.md`。

未修改业务实现、正式 JSON Schema、OpenAPI、generated contracts/clients、manifest/schema-set revision、package/lock、共享 oracle、其他文档或测试。后端仓库全程只读。

## 3. 基线与输入 Contract

冻结输入：

| 输入                  | Identity / revision                                                                                                       | 状态              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Runtime schema set    | `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c`                                                 | 只读绑定          |
| Experiment descriptor | `tilesim.bridge.experiment_descriptor.v1` / `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059`     | 正式现有 identity |
| Create-run request    | `tilesim.bridge.create_run_request.v1`                                                                                    | 正式现有 identity |
| Evidence descriptor   | `tilesim.bridge.evidence_agent_descriptor.v2` / `sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357` | 正式现有 identity |
| Evidence request      | `tilesim.bridge.evidence_agent_request.v1`                                                                                | 正式现有 identity |
| Evidence response     | `tilesim.bridge.evidence_agent_response.v1`                                                                               | 正式现有 identity |
| Evidence citation     | `tilesim.bridge.evidence_agent_citation.v1`                                                                               | 正式现有 identity |
| Evidence snapshot     | `tilesim.bridge.evidence_snapshot_reference.v1`                                                                           | 正式现有 identity |

本线没有修改上述 identity 或 revision，没有发布 successor。输出 fixture identity 为 `tilesim.fixture.agent_orchestration.phase0.capability_profile_proposal.v0`，并强制 `publication_status=proposed_non_published_fixture`；它不是 Bridge contract identity。

## 4. 独立 Fixture

`capability-profile-proposal.fixture.json` 包含：

- AO-04 多维状态：`described`、`accepted`、`validated`、`lowered`、`executed`、`observable`、`calibrated`、`held_out_validated`、`ui_exposed`、`agent_exposed`；
- parameter descriptor 的 stable `field_id`、alias、owner、type/unit、约束、正式 request target、lowering、execution evidence references、evidence output、source、valid regime 和 lifecycle；
- model、engine semantic、device、topology、workload 五类最小 Profile fixture；
- model × engine × device × topology × workload × fidelity × GPU participation × Trace source 的组合输入；
- 与当前 experiment/create-run/Evidence identity 的只读绑定；
- canonical UTF-8 JSON SHA-256 fixture revision。

设备和模型条目均为 generic/reviewed fixture，没有硬编码 H100 性能，也不从产品名推断结构或性能。工作负载和拓扑均明确为 synthetic fixture。

文件 SHA-256（原始 bytes）：

| 文件                                       | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `capability-profile-proposal.fixture.json` | `172509cbd935c1f5e416c74b75888ae0f4631816673b90920027146a1c75cc8e` |
| `capability-profile-cases.json`            | `64235cb784aabd8e6c73bd92f978e4f59704d38c7e96a6454d13e3eb7e8ecc14` |
| `phase0-capability-oracle.test.mjs`        | `9b04d5aa6609c092d639d09d43629c66fac53cb660de8451ebb0f5599bbe005a` |

这些 raw-file digest 会在后续格式化或交叉验证修改后变化；fixture 内部 revision 由排除 `fixture_revision` 自身后的 canonical JSON material 决定。

## 5. 覆盖矩阵

| 风险             | Case                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| unknown          | unknown snapshot field、field、profile、support state                     |
| alias            | field/profile ambiguous alias                                             |
| lifecycle        | expired、revoked                                                          |
| drift            | profile revision、catalog revision                                        |
| provenance       | missing profile source、missing valid regime                              |
| evidence upgrade | calibration self-claim、held-out self-claim、synthetic claim upgrade      |
| uint64           | maximum、overflow、unsafe JSON number                                     |
| unit             | exact Mbps→Gbps、unknown/case-confused unit                               |
| boundary         | min、below min、max、above max、integer step/type                         |
| combination      | valid、Cycle、`gpu_in_loop`、`real_trace` conflicts                       |
| exposure         | unexecuted field exposed、secret field exposed、executed without evidence |

数据集 split 是互斥的。`test` 和 `held_out_adversarial` case ID 已冻结，不应用于调 oracle 后再次报告同一集合结果。

## 6. Deterministic Oracle

oracle 强制以下不变量：

1. 未知 property、identity、revision 和枚举 fail closed。
2. `agent_exposed` 必须是 `accepted && validated && lowered && executed` 的子集。
3. `executed` 或 `observable` 必须同时存在 lowering 状态、execution evidence reference 和 artifact evidence output。
4. `secret` 字段不得 Agent 暴露。
5. Profile 必须有唯一 family、immutable revision、source、valid regime 和 lifecycle。
6. expired/revoked Profile 不可用于当前 snapshot。
7. `calibrated` 必须绑定受信校准 registry receipt；普通 Profile 自报失败。
8. `held_out_validated` 必须绑定独立 held-out registry receipt，并以 calibration 为前置。
9. uint64 必须使用规范十进制字符串，最大值为 `18446744073709551615`；JavaScript number 路径拒绝。
10. 单位换算使用整数/有理数运算，不经过二进制浮点。
11. Profile 组合逐 family 检查 scenario、requested fidelity、GPU participation 和 Trace source valid regime。
12. `synthetic_trace` 的 claim scope 不得升级为 held-out validation。

## 7. 当前测试结果

已运行：

```text
node --test tests/unit/phase0-capability-oracle.test.mjs
```

本 worktree 独立运行结果：5 tests、4 pass、0 fail、1 skip；skip 原因为 Contract proposal 尚未集成到本 worktree。核心 4 个 tests 全部通过，33/33 dataset cases 满足预期，重复求值结果一致。

只读绑定 Contract Agent worktree 后运行：

```text
$env:PHASE0_CONTRACT_PROPOSAL_ROOT='D:\tileSim-worktrees\phase0-contract-catalog\bridge\contracts\proposals\agent_orchestration_phase0'
node --test tests/unit/phase0-capability-oracle.test.mjs
```

结果：5 tests、5 pass、0 fail、0 skip。独立 oracle 复核了 Contract proposal fixture 的 `proposal_only`、canonical digest、未知 identity/revision fail closed、Agent 暴露执行闭包、五类 Profile source/valid regime、snapshot binding 和 successor 为空等不变量。

集成工作树将 runner 接入仓库统一的 Vitest API，并保持 oracle/fixture 判定逻辑不变：

```text
pnpm exec vitest run tests/unit/phase0-capability-oracle.test.mjs
```

集成结果：5/5 通过；随后 repo-wide `pnpm test` 为 348/348 通过。runner import 与 lint 等价修复会改变上表 oracle 文件的
raw-bytes SHA-256，但不改变两份 fixture 的 canonical revision 或 33/33 case 结论。

未运行“将本线独立 fixture 直接送入 Contract Agent JSON Schema”的测试。原因是两者刻意使用不同的 proposal 包络和状态表示：本线为独立 evaluation fixture，Contract proposal 使用 `dimensions.*.state=affirmed/denied/unknown/not_applicable` 及其 schema-local envelope。不存在无损直接 Schema 映射；本线没有添加 adapter，也没有修改 oracle 迁就 proposal。交叉验证方向是由独立 oracle 读取 Contract proposal 自带 fixtures。

格式检查首次发现两个新增文件需要 Prettier；随后仅对本线允许文件运行定向格式化。最终格式检查和 `git diff --check` 在交叉验证后重跑并记录。

未运行：

- live Provider acceptance：当前任务明确禁止；
- 真实校准/独立 held-out validation：没有授权资产，fixture 不可替代；
- 5173 deployment/smoke：当前任务明确禁止操作用户服务；
- 后端 build/CTest：后端为只读审计依赖，本线不拥有后端实现；
- 全仓 Web/Bridge/E2E：由集成负责人在所有并行写入结束后统一运行。

## 8. Security、Provenance 与 Retention

- fixture 不包含 credential、Provider endpoint、raw response、hidden reasoning、用户问题或 artifact payload；
- 未读取、记录或输出任何 `TILESIM_EVIDENCE_AGENT_*` 值；
- 未调用 Provider，未进行外部网络请求；
- 未创建 run 或其他业务副作用；
- Profile source、valid regime、calibration 和 held-out receipt 分开校验；
- `synthetic_trace`、GPU participation、requested fidelity、resolved fidelity/execution evidence 保持独立；
- fixture 只应随测试代码保留，不得进入 runtime catalog、共享 registry 或用户会话存储；
- oracle 错误只输出 stable code 和非敏感 identity，不输出 profile/artifact 正文。

## 9. 证据状态

| 类别                      | 当前状态                         | 可支持的结论                         |
| ------------------------- | -------------------------------- | ------------------------------------ |
| Fixture/oracle            | 33-case deterministic check 通过 | proposal 结构与 fail-closed 规则一致 |
| Fake Provider             | 未使用                           | 无                                   |
| Live Provider             | 未执行，repetitions 保持 0       | 无                                   |
| Synthetic consistency     | 仅 contract/fixture consistency  | 不能升级为 calibration               |
| Real-trace calibration    | 未执行                           | `GAP-CALIBRATION-001` 保持           |
| Independent held-out      | 未执行                           | `GAP-HELDOUT-001` 保持               |
| Human citation entailment | 未执行                           | `GAP-CITATION-REVIEW-001` 保持       |

## 10. Remaining Gaps

- `GAP-CAP-001`：等待正式 capability snapshot contract、registry/projection 和完整 execution traceability；
- `GAP-PROFILE-001`：等待五类 Profile 正式 owner/source/licensing/valid-regime 审批与发布；
- `GAP-EVAL-001`：本数据集是首批 33-case，不满足完整四分数据集和发布级规模；
- `GAP-CALIBRATION-001`：无真实校准 receipt；
- `GAP-HELDOUT-001`：无独立 held-out 数据与报告；
- `GAP-LIVE-001`：live Provider repetitions 为 0；
- `GAP-CITATION-REVIEW-001`：人工双人 citation entailment 未执行。

## 11. 交叉验证与建议合并顺序

Contract Agent 当前 proposal 已完成一次只读交叉检查：

- proposal 自带 fixture 保持 `contract_status=proposal_only`，未声明正式 predecessor/successor；
- parameter descriptor 的 `lowered/executed/observable` 为 `unknown`，`agent_exposed=denied`，没有把 UI/Schema 暴露升级为执行；
- 五类 Profile fixture 均有 source 与 valid regime，内容明确为 contract fixture/profile missing；
- capability snapshot 精确绑定冻结的 runtime/experiment/create-run/Evidence identities；
- parameter、五类 Profile 与 snapshot 的 canonical digest 均由独立实现重算一致；
- synthetic workload 保持 uncalibrated 和 contract/synthetic claim scope；
- proposal invalid fixture 已覆盖 Agent 暴露越权、held-out 无 calibration、unknown reason、digest self-reference、accepted 无 request target、unknown schema revision、ambiguous alias、missing source 和 synthetic calibration self-claim。

Proposal JSON Schema 自身的 Ajv schema-local runner 属于 Contract Agent 测试，不在本线重复执行；集成负责人应结合 Contract Agent 交接结果验收。expired/revoked 的具体 Schema 表达不与本线独立 fixture 直接映射，本线 33-case oracle 已分别覆盖，正式 runtime contract 仍需在后续批准时定义时间/撤回 registry 语义。

建议合并顺序：contract proposal → 后端只读追踪矩阵/局部测试 → 本 Eval fixtures/oracle → Contract Agent 交叉验证修订 → 集成 owner 的正式 generated/manifest/docs（仅批准后）。

## 12. 操作声明

- 未触碰共享正式 Schema、OpenAPI、generated clients、manifest、package/lock 或业务实现；
- 未触碰 `127.0.0.1:5173`；
- 未读取 credential；
- 未执行 live Provider；
- 未 commit、未 push；
- 未使用 reset、clean 或 checkout 覆盖任何改动。
