# Agent Harness 阶段 3A Provider / 人工审查准备基线（2026-10-18）

状态：**准备完成，验收仍为 pending，发布仍为 NO-GO**。

本记录只登记可复用的 redacted acceptance preparation contract，不代表 Provider
acceptance 或人工审查已经完成。当前环境未配置完整的
`TILESIM_EVIDENCE_AGENT_*` Provider 配置，因此本轮没有发起网络 probe、Provider
请求或真实 acceptance repetition；也没有读取、输出或持久化 credential。

## 固定身份

| 项目                         | 值                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Execution contract           | `2026-10-18.wpc.v1`                                                                     |
| Schema-set revision          | `sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50`               |
| Evidence descriptor          | `tilesim.bridge.evidence_agent_descriptor.v2`                                           |
| Evidence descriptor revision | 以当前 Bridge `DESCRIPTOR_REVISION` 为准，未在本文复制 digest                           |
| Provider protocol            | `tilesim.evidence_agent_provider.v1`                                                    |
| Acceptance manifest          | `tilesim.agent_harness.provider_acceptance_manifest.v1` / `2026-10-18.3a.acceptance.v1` |
| Human review package         | `tilesim.agent_harness.evidence_citation_review_package.v1` / `2026-10-18.3a.review.v1` |
| Provider state               | `live_acceptance_pending`                                                               |
| Capability probe             | `not_run` / `not_configured`                                                            |
| Human review                 | `not_run`                                                                               |
| Release decision             | **NO-GO**                                                                               |

## 机器可校验准备资产

`bridge/run_agent_harness_stage3_acceptance_prep.py` 只生成调用方指定的仓外
redacted JSON 文件：

- `provider-acceptance-manifest.json`：固定 Provider case ID、descriptor/prompt/policy
  revision、backend/schema identity、probe 状态、repetition、bounded latency/cost
  摘要、request/response digest 占位、terminal/hard-gate 状态和 retention flags；
- `evidence-citation-review-package.json`：acceptance manifest digest、可选 hosted
  manifest digest、operation/run/snapshot/artifact/claim 的最小字段契约、citation
  字段清单和 reviewer 状态。

默认生成的状态是：

```text
Provider acceptance       live_acceptance_pending
Capability probe          not_run
Success repetitions       0
Human citation review     not_run
Reviewer count            0
```

`--run-probe` 仅在完整 Provider 配置已经由受控环境提供时，调用现有
authenticated capability adapter；probe `passed` 仍不能把 acceptance 变成 accepted，
必须另有成功 repetition、身份/Schema/引用校验和独立 reviewer 记录。

## Fail-closed 规则

- `accepted` 必须同时有 passed capability probe、至少一次 success repetition 和
  `reviewer_state=completed`；否则 manifest 校验失败。
- 人工 review `completed` 必须至少有两名独立 reviewer；没有 reviewer 记录时保持
  `not_run`。
- preparation manifest 拒绝 credential、API key、raw Provider response、prompt、
  evidence payload 和 hidden reasoning 字段；只保留 identity、digest、状态和 bounded
  metadata。
- request/response digest、snapshot、artifact SHA/bytes、JSON Pointer、stable subject、
  provenance、requested/resolved fidelity 和 claim scope 是 review package 的固定字段，
  但本轮没有真实 case，因此不填充伪造 case。
- synthetic hosted smoke 只能作为独立的 synthetic exploratory evidence，不能填入
  live Provider acceptance 或人工 entailment 结论。

## 当前阻塞与边界

Provider acceptance 仍缺少真实 authenticated repetition；人工 citation/evidence
review 仍缺少独立 reviewer 和 review timestamps。阶段 3B 前端执行 UI、Provider
驱动的运行、自动候选、多工具循环、自主优化和无人值守实验继续关闭。

下一步必须在有明确授权的 Provider/reviewer 环境中生成仓外不可变 manifest，并将
manifest digest 与 3A release-gate 关联；在此之前不得把状态改成 GO，也不得启动 3B。

## 2026-10-18 本轮最终验收复核状态

本轮未发现受控 Provider 配置或独立 reviewer 记录，因此没有调用 capability probe、Provider acceptance repetition
或人工审查。仓外 redacted 准备资产已实际生成并校验：

- Provider manifest：`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\provider-acceptance-manifest.json`
  ，identity `tilesim.agent_harness.provider_acceptance_manifest.v1`，revision `2026-10-18.3a.acceptance.v1`，digest
  `sha256:142056eac084dcf47f4539a60f923e9b779cc4103c8d5ae14462b94253076abe`。
- Review package：`C:\Users\mapanwang\AppData\Local\Temp\tilesim-stage3a-final-479997e0bd7246849a705890c1f10d5b\evidence-citation-review-package.json`
  ，identity `tilesim.agent_harness.evidence_citation_review_package.v1`，revision `2026-10-18.3a.review.v1`，digest
  `sha256:963ed92dc6064a3f93ff5cf86a74e42cd49683e8d9c86fc3dbf3fdd38ddbc567`。

实际状态仍为：Provider `live_acceptance_pending`；probe `not_run/not_configured`；四个 acceptance lane 均
`not_run`；success repetition `0`；review `not_run`；reviewer count `0`。这些文件只含最小 identity、digest、状态和
bounded 元数据，未包含 credential、token、raw Provider response、prompt、hidden reasoning 或完整 evidence payload。
此前 release-gate 的 26/26 故障矩阵和 hosted synthetic smoke 通过，但它们不能替代真实 Provider acceptance 或独立
人工 review。因此最终结论保持 **NO-GO**，阶段 3B execution UI、阶段 4、自主候选、多工具循环和无人值守执行继续关闭。

## 2026-10-18 延续开发：部署身份诊断

`run_agent_harness_stage3_acceptance_prep.py` 现在接受显式 `--deployment-manifest`；未提供时仅读取本地
`runtime/backend-current.json`（如果存在），不会修改 manifest。脱敏 acceptance manifest 新增
`deployment_identity` 诊断，比较 manifest schema-set、当前源码 schema-set、source/build revision、source/build
state digest、`versions_match` 和整体 `identity_match`。

本轮对当前本地 manifest 的诊断为：

- `status=deployment_schema_mismatch`；
- manifest schema-set：`sha256:d7abac1889dd1b8a05bae7972fec3c7bd448053393daaf52afc3af893cde793e`；
- 当前源码 schema-set：`sha256:ce5ac94634375b58c62c6d47ec70a6f45441c02c789eb61bfa928425222dec50`；
- source/build revision match：`true`；source/build state digest match：`true`；`backend_versions_match=true`；
- overall `identity_match=false`，因此 acceptance 仍 fail-closed。

任一 source/build revision 或 state digest 缺失时，诊断返回 bounded `deployment_identity_incomplete`，不会把缺失字段视为匹配。

普通终端未继承启动器解密环境时，Provider 只记录 `not_run/not_configured`；配置元数据测试只验证公开
provider/model/revision identity，不返回 API key。即使进程已继承 Provider 配置，deployment identity 未达到 `matched` 时
`--run-probe` 也只记录 bounded `blocked/deployment_identity_mismatch`，不会发起 Provider 请求。人工
evidence/citation review 仍为 `not_run`，不由 Agent 自证完成。
