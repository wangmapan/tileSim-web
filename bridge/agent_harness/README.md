# Agent Harness Bridge 后端（WP-A successor contract）

事实日期：2026-10-17。正式契约 revision 为 `2026-10-17.wpa.v1`，schema identity 前缀为
`tilesim.agent_harness.*.v1`。这不是前端 proposal 的直接发布；Bridge 的
`contracts/openapi.json`、`contracts/schemas/agent-harness/` 与 Python validator/store 才是 canonical
实现。旧 proposal revision `2026-10-17.wpa.v0` 只用于迁移对照，不接受为运行时身份。

Bridge 使用 SQLite WAL 单机 durable MVP（迁移版本 1），保存 operation/event/checkpoint/tool identity、approval
元数据和 side-effect ledger 的 digest/状态；不保存 credential、hidden reasoning、Provider raw response、完整未展示
evidence/artifact payload 或任意 shell 输出。它提供原子提交、重启恢复、事件回放、严格 sequence、删除和 retention
元数据，但不宣称分布式 HA 队列。

队列并发与已有 `TILESIM_MAX_ACTIVE_RUNS` 共用上限，worker 具有 bounded queue、lease/heartbeat 字段、visibility
timeout 配置、attempt count 和有限退避。Bridge 重启后 running/retrying/waiting_tool 会进入
`recovery_required`；unknown side effect 禁止盲重试。`/api/runs` 和 TileSimCLI 入口保持原样，Harness worker 不创建
run，也不改变仿真逻辑。

已发布只读工具：`get_capability_catalog`、`get_run_status`、`list_run_evidence`、`query_verified_metrics`。工具
registry 是 closed input/output、固定 revision、scope、timeout 和 permission decision；未知 tool/scope、跨主体 run、
snapshot、manifest/SHA/bytes/Pointers 不匹配均 fail closed。没有 shell/path/URL/network/write tool。

路由：

- `GET /api/agent/harness-capabilities`、`GET /api/agent/tools`
- `GET/POST /api/agent/operations`，`GET/DELETE /api/agent/operations/{operation_id}`
- `GET /api/agent/operations/{operation_id}/events` 与 `/events/stream`（Last-Event-ID 为 sequence；`/events/stream` 是当前 durable 事件的可恢复回放，发送已有事件/终态后关闭连接，客户端应以 polling 作为持续观察真源，不宣称实时长连接）
- `POST /api/agent/operations/{operation_id}/{cancel|resume|retry}`、`POST .../checkpoint`
- `GET /api/agent/checkpoints/{checkpoint_id}`、`POST /api/agent/tools/call`

终态不可回到 running；取消 fence 隔离迟到结果；event id+payload digest 去重，乱序/冲突拒绝；同 key 同 canonical
payload 重放，同 key 不同 payload 返回 `idempotency_payload_mismatch`。错误统一包含稳定 code、JSON Pointer、retryable、
terminal_failure、unknown_outcome。

当前 Provider acceptance 为 `live_acceptance_pending`：本实现只保留 adapter/contract/unit tests，不读取或打印
credential，不把 fake Provider 测试计为 live acceptance。自主优化、无人值守批量实验、写工具和前端生成客户端同步
均未开放。Web 后续应同步 `openapi.json` 的新 operationId、Schemas/DTO 与 client 生成物；本工作包不修改前端生成客户端。
