# 评测、可观测性与验收规范

> 文档 ID：`AO-11`
>
> 类型：质量与发布规范（`proposed`）
>
> 前置阅读：[产品与用户体验](02_PRODUCT_AND_USER_EXPERIENCE.md)、[工具安全](10_TOOLS_SECURITY_AND_INTEROPERABILITY.md)

## 1. 目标

用可重复评测和确定性硬门禁回答四个问题：Agent 是否完成实际任务、是否易用、是否遵守专业语义、是否准确且安全。测试、模拟 fixture、live Provider、真实校准和 held-out validation 必须分别报告。

## 2. 证据等级

验收报告分别列出：

- unit/component/contract/E2E；
- deterministic simulation behavior；
- synthetic consistency；
- fake Provider adapter tests；
- live Provider repetitions；
- human citation entailment review；
- real-trace calibration；
- independent held-out real-trace validation；
- usability study。

低等级证据不能关闭高等级门禁。当前 F9 live model repetitions 为 0，人工 citation entailment review 未执行；这些状态不得被本地 fixture 改写。

## 3. 数据集治理

建立互斥集合：

- `train`：prompt/规则开发；
- `validation`：模型、retriever、阈值和候选选择；
- `test`：发布前冻结评测；
- `held_out_adversarial`：由不同人员维护，覆盖安全、歧义和边界。

每条 case 包含 stable ID、task、locale、input、catalog/profile/backend revisions、expected structured result、allowed variants、forbidden outcomes、oracle source 和 risk class。数据集版本和 digest 进入报告。

禁止用 test/held-out case 调 prompt 后再次报告同一集合结果。

## 4. 覆盖矩阵

至少覆盖：

- 中文、英文、中英混合、错别字和术语别名；
- dense/MoE、单机/多机、短/长上下文、稳定/突发请求；
- model/engine/device/topology/workload profile 缺失或冲突；
- TP/PP/EP、KV、显存、网络、SLO、预算；
- Analytical/DES/Cycle、三种 Trace source、三种 GPU participation；
- missing/zero/not applicable/not covered/unsupported；
- partial/refused/truncated/stale、两类 409、502/503/504/cancelled；
- crash/retry/reconnect/duplicate/out-of-order；
- prompt injection、越权工具、跨 workspace/run 泄漏和 secret exfiltration。

## 5. 分层指标

| 层       | 指标                                                             |
| -------- | ---------------------------------------------------------------- |
| 任务路由 | classification accuracy、unsupported recall                      |
| 意图编译 | exact field/value/unit/source span、Schema validity              |
| 澄清     | blocking-field recall、无意义追问率、平均轮数                    |
| 草案     | field coverage、source attribution、compile equivalence          |
| 校验     | infeasible detection、false accept/reject、repair correctness    |
| 候选规划 | constraint satisfaction、determinism、budget/stop correctness    |
| RAG      | exact hit、recall@k、nDCG、context precision/recall、no-answer   |
| 回答     | atomic entailment、citation precision/coverage、faithfulness     |
| 工具     | tool selection/arguments、permission、duplicate side effect      |
| 工作流   | goal success、recovery、cancel、human intervention               |
| 体验     | first-task success、time-to-valid-draft/run、SUS/访谈            |
| 运维     | p50/p95/p99 latency、token/cost、queue、failure、checkpoint size |

Ragas 可参考语义质量；Schema、citation identity、uint64、permission、provenance、fidelity 和副作用使用自有 deterministic oracle。

## 6. 全阶段硬门禁

以下必须为 100% 或 0：

- unknown/unsupported 字段进入可运行草案：0；
- Schema、单位、uint64、request canonicalization 错误：0；
- validation 不通过仍创建 run：0；
- approval 前写副作用：0；
- same key/different payload 被接受：0；
- crash/retry 产生重复 Provider/run 副作用：0；
- run/backend/schema/snapshot 变化后旧 claims 可见：0；
- citation identity/value/unit mismatch：0；
- provenance/fidelity/validation 升级：0；
- secret/raw Provider/hidden reasoning 持久化或日志泄漏：0；
- permission/ACL/cross-workspace bypass：0。

任一 hard gate 失败阻断发布，不与平均语义得分抵消。

## 7. 分阶段门槛

### Phase 1

- 当前正式字段 unsupported recall=1.00；
- draft → create-run canonical equivalence=1.00；
- 100+ 条双语意图；
- 当前子集 valid draft task completion ≥ 0.80；
- 无 run side effect。

### Phase 2–3

- calculator golden/property tests 全通过；
- profile/combination gaps fail closed；
- 中位阻塞澄清轮数 ≤ 2；
- approval stale/revision conflict 全覆盖；
- 外部首次任务成功率目标 ≥ 0.80。

### Phase 4–6

- 每个有副作用 node crash matrix 全通过；
- evidence recall@5 目标 ≥ 0.95；
- citation precision/uint64 exactness=1.00；
- no-answer false positive=0；
- comparability bypass=0；
- 10 个真实任务逐项报告成功率和耗时。

目标阈值需在实现前冻结；未达到时报告实际值，不调低后覆盖历史失败。

## 8. 模型与 Prompt 变更评测

模型、endpoint、prompt、policy、temperature、tool schema 或 output parser 任一变化时：

1. 记录候选 revision；
2. 运行 deterministic hard gates；
3. 运行 validation/test/adversarial；
4. 比较任务成功、拒绝、延迟、成本和稳定性；
5. 做固定重复次数的 live eval（仅专门授权环境）；
6. 人工抽查高风险 citation；
7. 满足门槛后发布并保留回滚 revision。

不因模型“更强”跳过评测。

## 9. Live Provider Acceptance

Live acceptance 必须由明确授权的独立任务执行，不读取或输出 `TILESIM_EVIDENCE_AGENT_*` 值。至少覆盖 success、refusal、timeout/不可用、重复一致性、output limit、malformed/invalid citation 防护和 retention/redaction。

报告只保存 provider/model identity、policy revision、case ID、结构化终态、延迟/用量摘要和人工判定，不保存 credential/raw response/hidden reasoning。Fake Provider 只验证 adapter 和 contract。

## 10. 人工 Citation Entailment

采用双人独立复核：每个 atomic claim 判定 entailed/not entailed/unclear，核对数值、单位、主体、范围、provenance/fidelity 和 citation Pointer。分歧由第三人仲裁。

抽样覆盖全部 task kinds、partial/refused/truncated、边界数值和多 artifact。正式关闭 F9 live gate 前记录 repetitions、reviewer agreement、失败 case 和修复 revision。

## 11. 可观测性

建议 OpenTelemetry trace 层次：

- conversation/turn；
- intent compile；
- capability/profile lookup；
- validation/calculator；
- approval；
- workflow operation/node；
- tool call；
- run creation/monitor；
- retrieval/rerank；
- evidence generation/validation。

Span attributes 只记录 stable IDs、revisions、digest 前缀或非敏感摘要、状态、计数、耗时、budget 和 error code。禁止记录 prompt 正文、完整 user question、artifact payload、credential、raw response、hidden reasoning 或 validated claims 副本。

## 12. 运行指标与告警

监控：capability drift、Schema validation failures、stale rate、approval abandonment、tool denial、duplicate conflict、workflow recovery、retrieval no-answer、citation rejection、Provider 502/503/504、queue/latency/cost 和 redaction failure。

告警必须能定位 revision 和失败层，不能自动重调 Provider 或创建新 run。高风险 hard gate 线上失败触发 kill switch/rollback。

## 13. 可复现评测报告

每份报告记录：code commit、backend/schema/catalog/profile/model/prompt/policy/tool/workflow/index revisions、dataset digest、环境、命令、重复次数、原始结构化指标、失败 case IDs 和已知限制。

报告不提交 credential、raw prompts/responses 或受限 artifact。图表和摘要必须可从 redacted metrics 重建。

## 14. 用户体验研究

每阶段至少让目标用户完成当前已支持任务，不先解释内部架构。记录完成率、时间、澄清轮数、求助点、错误恢复、可信度理解和专业术语误解。

关键问题：用户是否知道系统现在能做什么、为什么需要某个参数、哪些结论只是探索、何时产生副作用、如何从失败继续。

## 15. 发布与回滚

发布包绑定全部 revisions 和 eval report。采用 shadow/read-only → limited opt-in → default rollout。任何 hard gate、identity drift、权限、重复副作用或 retention 失败立即关闭写能力并回滚；只读 capability/草案可在安全时保留。

## 16. 更新触发器

任何模型、prompt、retriever、profile、calculator、contract、workflow、tool、security policy、UX task 或验收阈值变化时，更新对应 dataset 和本文。当前 live repetitions 或人工复核状态变化时，同时更新 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md) 和总方案。
