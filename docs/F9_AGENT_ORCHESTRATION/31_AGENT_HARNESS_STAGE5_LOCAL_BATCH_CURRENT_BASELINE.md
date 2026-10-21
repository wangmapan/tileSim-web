# Agent Harness 阶段 5 Local-Dev 当前基线

## 范围

阶段 5 在本地个人使用范围提供受控批量实验编排。contract revision 为
`2026-10-19.wpe.v1`，tool registry 为 `2026-10-19.tools.v3`。所有输出固定标记
`local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`；生产 Provider、真实硬件、
独立生产 evidence/citation review 与生产 GO 仍保持 `production_acceptance_pending`。

## 契约与边界

批量对象包括 batch/session、experiment plan、candidate set、run slot、objective、budget、并发策略、
停止策略、checkpoint、summary、per-run result、failure/recovery record 和 event。对象绑定
contract/schema-set、principal、workspace、snapshot、backend、policy 与 digest。`max_concurrency` 当前固定为
1，自动批量执行只有在显式 `local_dev=true`、`approval_required=true` 且人工批准之后才可开启。

所有副作用仍经正式 `POST /api/agent/executions`，批量层不新增 `/api/runs` 入口，不接受 shell、任意路径、
任意 URL、任意网络或外部 MCP/A2A。Bridge 使用独立 SQLite WAL batch store，保留最小身份/digest/状态和有界
checkpoint，不保存 credential、raw Provider response、hidden reasoning 或完整敏感 evidence payload。

## 状态与恢复

批量状态为 `draft → validated → waiting_approval → queued → running`，并支持 `paused`、`completed`、
`failed`、`cancelled`、`recovery_required` 和 `manual_intervention_required`。Bridge/worker 重启会把 queued/running
批次围栏到 `recovery_required`；未知副作用不得盲目重试。事件带单调 sequence、SSE `Last-Event-ID` 回放和
polling fallback。审批单次消费、幂等 key replay/conflict、取消终态围栏、lease/heartbeat、checkpoint、retention/delete
均 fail-closed。

完成度补充：每个 completed candidate 现在必须通过 execution result identity、snapshot/schema/backend、local synthetic
provenance 及 `query_verified_metrics` allowlist 后，才会保存单一 objective JSON Pointer 的数值和最小 evidence
引用。Batch summary 会记录 `best_candidate_id`、`best_value`、`evaluated_count`、`no_improvement_count` 与
明确 stop reason（`candidate_set_exhausted`、`run_budget_exhausted`、`time_budget_exhausted`、
`failure_budget`、`no_improvement`）。暂停后恢复会重新回到 `running` 并持续 lease heartbeat；SSE 乱序/缺口由
前端拒绝并回退到 contiguous polling replay。删除会清除 batch 的 candidate/event/checkpoint/lease 有界记录。

## 评测资产

`tests/fixtures/agent-harness/phase5-local-evaluation-manifest.json` 将 train、validation、test、
held-out-adversarial 分离，覆盖成功单候选/多候选、暂停恢复、预算停止、recovery、取消、identity mismatch、
事件缺口和重复候选。fixture 不是 live evidence，不能升级为校准、held-out 或生产结论。
