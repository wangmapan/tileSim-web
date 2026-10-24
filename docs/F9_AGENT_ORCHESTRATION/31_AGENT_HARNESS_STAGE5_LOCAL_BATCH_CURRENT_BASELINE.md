# Agent Harness 阶段 5 Local-Dev 当前基线

## 2026-10-24 当前工作树修正

本文件下方的 2026-10-22 收尾证据保留为 dated 记录。当前工作树已有 Bridge contract/generated 文件改动，
`python bridge/check_schema_set_revision.py` 实测 schema-set 为
`sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`；因此“未修改 JSON contract/schema-set、未触发生成物更新”
只适用于 2026-10-22 收尾批次，不能用于当前工作树。任何后续 contract 修改仍须运行 `pnpm contracts:generate` 与 drift check。

## 2026-10-22 收尾判定

本地开发阶段已闭合，判定为 `LOCAL_PHASE5_PASS`，不构成生产 GO。收尾范围覆盖以下遗留安全语义：

- `candidate_set` 数量不得超过 `budget.max_candidates`；`max_runs`、`max_seconds`、`max_failures` 和 `max_retries` 均按硬边界执行，失败计数和批次起始时间不会因 worker 重启被清零。
- `on_failure=continue` 只允许在失败数低于硬上限时继续；`on_failure=stop` 在首个已知失败后停止。
- 显式 retry 只允许明确可重试且非未知结果的失败，受 `max_retries` 限制；每次 retry 清理旧 execution identity，生成新的 draft/validation/approval/idempotency fence，并重新等待人工批准。
- `recovery_required` 的确认不会盲目重提未知副作用；确认后转为 `manual_intervention_required`，前端提供明确提示，进入人工介入后不再显示取消或盲重试入口。
- worker 在暂停和正式 execution 等待期间持续 heartbeat，结束时释放 lease；超时或非终态执行结果进入 recovery，而不是伪造失败或完成。
- Batch API 验证 detail/event 的 batch identity，SSE 复用共享 framing、lossless JSON 和正式 API root；查询流切换时会中止旧 stream，避免旧事件污染新 batch。

收尾证据：Bridge Stage 5/相关 Stage 3 定向测试 **21 passed / 0 failed**，前端 Harness 定向测试 **35 passed / 0 failed**，
`vue-tsc --noEmit` 通过。没有修改 JSON contract/schema-set，未触发生成物更新。`tests/fixtures/agent-harness/phase5-local-evaluation-manifest.json`
仍是声明性 fixture，不是 live evidence；Provider live acceptance、真实硬件、独立生产 evidence/citation review、独立 validation
run 与生产 GO 继续保持 pending。

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
