# Agent Harness Contract Proposal（WP-A）

> 状态：`proposal_non_published` · revision `2026-10-17.wpa.v0`
>
> 本目录是设计登记，不是 `bridge/contracts` 正式契约；不进入当前 schema-set、OpenAPI、generated client 或任何 Bridge 路由。

## 1. 对象 identity

| 对象               | proposed schema identity                    | 最小职责                                          |
| ------------------ | ------------------------------------------- | ------------------------------------------------- |
| `agent_operation`  | `tilesim.agent_harness.agent_operation.v0`  | 一次完整任务与状态真相的未来容器                  |
| `agent_turn`       | `tilesim.agent_harness.agent_turn.v0`       | 一轮用户/模型动作，绑定 parent turn 与 snapshot   |
| `workflow_event`   | `tilesim.agent_harness.workflow_event.v0`   | 可重放、可去重的状态事件                          |
| `checkpoint`       | `tilesim.agent_harness.checkpoint.v0`       | revision 绑定的最小恢复点                         |
| `tool_call`        | `tilesim.agent_harness.tool_call.v0`        | 闭合工具请求、scope、permission 和幂等键          |
| `tool_result`      | `tilesim.agent_harness.tool_result.v0`      | 结构化终态、digest、evidence refs 和错误          |
| `experiment_draft` | `tilesim.agent_harness.experiment_draft.v0` | 尚未执行的输入 diff；`creates_run=false`          |
| `approval`         | `tilesim.agent_harness.approval.v0`         | 精确 draft digest 的人工确认；`creates_run=false` |
| `study`            | `tilesim.agent_harness.study.v0`            | 预算/约束/停止策略草案；自动提交关闭              |
| `candidate`        | `tilesim.agent_harness.candidate.v0`        | 候选 identity；本阶段不绑定真实 run/metrics       |

所有对象共享 proposal revision、`operation_id`、`turn_id`、`run_id`、`snapshot_digest`、`schema_set_revision` 和
`policy_revision`。`run_id`/`snapshot_digest` 可为 `null`，但不得用默认值伪造绑定。

## 2. 状态、结果和错误

Operation workflow state 为：`draft`、`submitted`、`queued`、`running`、`waiting_tool`、`waiting_approval`、`retrying`、
`completed`、`failed`、`cancelled`、`recovery_required`、`manual_intervention_required`。

Tool outcome 为：`succeeded`、`rejected`、`retryable_failure`、`terminal_failure`、`unknown_outcome`。

用户可见 availability 必须区分：`available`、`unavailable`、`not_exposed`、`rejected`、`failed`、`cancelled`、`completed`。
错误 envelope 至少包含：

```json
{
  "schema_identity": "tilesim.agent_harness.error.v0",
  "contract_revision": "2026-10-17.wpa.v0",
  "code": "stale_draft",
  "field_path": "/draft_digest",
  "retryable": false,
  "terminal_failure": true,
  "unknown_outcome": false
}
```

提案错误码覆盖参数非法、能力不可用/未暴露、schema revision 不一致、stale draft、approval 过期/过期后 stale、Provider
timeout、Bridge/worker 故障、重复/乱序 event、重复 resume、取消后的迟到结果、unknown side effect、prompt injection、tool
scope 越权、跨 run 泄漏、重复副作用、留存删除失败和 terminal mutation。`field_path` 使用 JSON Pointer；没有单一字段时为 `null`。

## 3. Event 与幂等

- event delivery 按 at-least-once 设计；客户端/未来 workflow adapter 以 `event_id` 去重，`sequence` 单调递增，
  `dedupe_key` 防止同义副作用重复登记。
- `event_id` 重复但 payload digest 相同：精确去重；相同 id、不同 digest：拒绝并进入恢复检查。
- sequence 缺口、乱序、重复 sequence 或 producer revision 不匹配：不得猜测状态，进入 `recovery_required`。
- 同一 `idempotency_key` 必须绑定 canonical payload/input digest；不同 payload 返回 `idempotency_payload_mismatch`，禁止换 key 静默重提。
- terminal operation 不得原地改为 `running`；恢复产生新事件/新 revision，或新建 operation。
- cancel 建立 cancellation fence；迟到结果只写安全的 rejected/late 事件，不能覆盖 `cancelled`。

## 4. Approval 与 stale

Approval digest 覆盖 draft digest、principal、snapshot、run、schema-set、policy revision 和用户可见 diff；approval 必须带
`approved_at`、`expires_at`，且不保存完整未展示请求。以下任一变化都会 stale：

- schema-set 或对象 revision；
- target run、snapshot digest 或 backend identity；
- draft 内容/validator revision；
- policy、tool revision 或 approval expiry。

stale/expired/rejected approval 不可被 resume、retry 或 submit 重放。审批前与审批拒绝后的副作用目标均为 0。

## 5. 留存与责任边界

Bridge/未来 workflow service 负责 operation/event/checkpoint、权限、幂等、队列、side-effect ledger、retention/delete 和
正式 run/artifact identity；模型只输出结构化动作候选。Web 负责显示状态、事件、diff、审批和错误，不决定 capability、不创建
operation、不执行 shell/path/URL、不把 localStorage 当 operation store。现有 `/api/runs` 仍是既有 run API，不是 Harness submit gateway。

禁止持久化 credential、hidden reasoning、Provider raw response 和未展示的完整 evidence payload。工具 scope 永远关闭 shell、任意
文件路径和任意 URL；artifact/用户/模型文本按不可信输入处理。

## 6. 迁移说明

当前 WP-A 不修改 Bridge contract、OpenAPI、schema-set revision 或生成物，因此没有运行时迁移。未来正式发布必须：

1. 以新 identity/revision 发布 Schema 与 OpenAPI，并生成 TypeScript/Python artifacts；
2. 提供旧客户端 `not_exposed` / `unavailable` 的兼容响应，不把 proposal identity 当正式响应；
3. 先发布 read-only capability/policy，再发布 operation/event/checkpoint store；
4. 通过重复 event、乱序、Bridge 重启、worker 崩溃、重复 resume、cancel、unknown outcome、审批 stale、越权和重复副作用门禁；
5. 在后端能力、评测 manifest 和 live acceptance 形成证据前，不打开阶段 1 工具循环。
