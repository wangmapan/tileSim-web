# Agent Harness 阶段 3 本地开发闭环

本文件登记阶段 3 的本地个人使用路径。它不是生产发布批准，也不改变正式
`2026-10-18.wpc.v1` contract 的 fail-closed 规则。

## local-dev 身份

`bridge/run_agent_harness_local_dev.py` 从当前 TileSim checkout、Bridge schema-set、
生成客户端和 CLI 能力快照生成一个新的、不可变的脱敏 manifest。默认写入仓外临时目录，
不会覆盖 `runtime/backend-current.json`，也不会修改其 schema-set、digest 或 identity。

manifest 的 `deployment_mode` 为 `local_dev`，并记录 source/build revision、source/build
state digest、schema-set revision、backend identity、capability identity、来源和生成时间。
Provider 配置不参与本地路径；若启动器没有可继承的 Provider 环境，输出明确为
`provider_unavailable_for_local_dev`，且不会读取或保存 credential。

## 本地门禁

使用 `--run-hosted-smoke` 时，命令会在仓外临时端口/状态目录运行受控 synthetic Bridge，
验证 draft → validation → approval → execution → `/api/runs` → result、事件 replay、SSE、
幂等 replay/conflict 和 artifact identity。输出只能是：

- `LOCAL_ONLY_PASS`
- `synthetic_trace`
- `exploratory`
- `not_for_production`

本地 gate 的 review 状态为 `review_not_required_for_local_dev`，生产状态固定为
`production_acceptance_pending`。这不能升级为真实 Provider acceptance、calibrated、held-out
validation 或生产 GO。

## 前端 3B 边界

`src/lib/api/agent-harness.ts` 的 successor adapter 只调用正式 WPC endpoint：

- submit：`POST /api/agent/executions`
- status/events/result：对应 GET endpoint
- event stream：SSE，断线后 polling 使用 `Last-Event-ID`
- mutation：正式 cancel/retry/resume endpoint

所有写请求使用 `Idempotency-Key`；adapter 在展示前核对 contract/schema、draft/approval/
validation、principal/workspace、policy、snapshot、backend、run 和 artifact manifest identity。
前端不创建 run、不使用 localStorage 或 Pinia 作为 operation store、不自动 retry unknown outcome。
Task Center 的执行卡明确显示 local-dev、synthetic、exploratory 和 not-for-production 边界。

阶段 4 的多工具自主循环、自动候选、自动优化、无人值守批量实验以及外部 MCP/A2A 仍关闭。
