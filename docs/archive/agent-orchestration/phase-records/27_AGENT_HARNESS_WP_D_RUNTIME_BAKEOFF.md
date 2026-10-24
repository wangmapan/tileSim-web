# Agent Harness WP-D Durable Runtime Bake-off

事实日期：2026-10-18

状态：评估完成；不引入第二个 workflow runtime，阶段 3/4/5 仍为 NO-GO。

本记录只评估已经发布的 `2026-10-17.wpa.v1` operation contract 与 Bridge 当前实现，不开放
新的写工具、run 创建、审批写入、自动重试或自主运行。所有结论均来自仓库代码、Schema、故障注入测试和
前端只读接入；没有连接 Provider、没有运行外部服务，也没有把 fake/fixture 结果计为 live acceptance。

## 决策（ADR-AH-001）

在 TileSim 的当前 Windows/WSL 单机产品范围内，暂时保留 Bridge 自有的 SQLite WAL + bounded worker
实现作为唯一 Harness runtime。暂不引入 Temporal、DBOS、Restate、LangGraph durable adapter 或其它第二个
runtime。原因是当前发布能力仍是单机只读工具观察，外部 runtime 不会增加已验证的仿真能力，却会新增部署、
身份绑定、迁移、运维和故障语义。

这不是“分布式队列已就绪”的声明。当前实现的边界仍是：单主机、有限队列、SQLite WAL、lease/visibility
recovery、event sequence/dedupe、checkpoint digest 和 side-effect ledger metadata；它不宣称 HA、跨主机
调度、真实 Provider acceptance 或自动创建 run。

## 同一 contract 的比较矩阵

| 维度                     | 当前 Bridge runtime（已实现）                                            | 外部 durable runtime 候选（未引入）                       | 结论                                           |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------- |
| operation/event identity | `tilesim.agent_harness.*.v1`、固定 revision、事件 sequence + digest      | 需要 adapter 映射同一 identity，不能替换 TileSim contract | 当前实现满足只读观察；不因框架而改 contract    |
| 重启恢复                 | SQLite WAL；running/retrying/waiting_tool 收敛为 `recovery_required`     | 需额外验证 worker、任务历史和 Bridge identity 恢复        | 当前测试已覆盖；外部候选无本仓证据             |
| checkpoint               | 保存 state digest、event sequence、side-effect digest、revision binding  | 需要保证 payload redaction、revision stale 和迁移语义一致 | 保留当前模型，暂不迁移                         |
| 取消与迟到结果           | cancellation fence；迟到终态被拒绝                                       | 需证明 cancellation fence 不被 runtime 重放绕过           | 当前实现有故障注入测试                         |
| 重复/乱序事件            | event id + payload digest 去重；sequence 冲突/缺口进入恢复               | 需要 adapter 维持相同 fail-closed 语义                    | 前端按 snapshot/event 展示，禁止客户端修复顺序 |
| 幂等与未知副作用         | operation/tool/side-effect idempotency key；`unknown_outcome` 禁止盲重试 | 需把外部 activity retry 与 ledger 完全绑定                | 当前语义更小且可审计                           |
| 迁移与备份               | 单一 SQLite migration version；备份/恢复仍需发布门禁                     | 需新增外部 schema、服务和备份策略                         | 当前先不增加运维面                             |
| Windows/WSL 部署         | 与现有 Bridge、state root 和启动脚本同进程                               | 需要额外服务、凭据、网络和本地开发依赖                    | 当前产品范围更适配                             |
| 可观测性                 | 只保留 bounded identity/digest/status/error/count                        | 可获得 runtime telemetry，但不能保存 raw prompt/response  | 先补 redacted metrics，再评估外部 runtime      |
| 真实执行闭环             | Harness worker 不创建 TileSim run；前端只读                              | 外部 runtime 也不能越过 approval/create-run contract      | 两者均不能作为阶段 4 GO 证据                   |

## 可复现验收清单

WP-D 的“已验证”只指当前 Bridge 本地故障注入与契约测试，不是性能 benchmark：

- `bridge/test_agent_harness.py` 覆盖 Bridge 重启、worker/lease 恢复、checkpoint、重复/乱序 event、取消 fence、
  approval expiry metadata、tool idempotency、unknown outcome、retention delete、schema/backend identity binding；
- `bridge/test_agent_harness_schemas.mjs` 编译全部 Agent Harness v1 Schema，并拒绝额外 raw response 字段；
- Web 只读 adapter 覆盖 operation detail 的 run/snapshot/backend binding、事件缺口恢复、SSE/polling 和 task-center
  只读展示；
- 没有对外部 runtime 运行 benchmark，也没有把 SQLite 单机测试外推为吞吐、HA、跨主机恢复或 Provider 能力。

## Go / No-Go

| 门禁                                                  | 当前结论                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 继续使用单机 Bridge runtime 作为只读 operation source | **GO（限只读观察）**                                                                  |
| 引入第二个 workflow runtime                           | **NO-GO**：尚无独立 benchmark、迁移方案、运维预算或故障证据                           |
| 阶段 2 draft/approval 写入                            | **NO-GO**：本批没有发布相应前端写 surface                                             |
| 阶段 3 可恢复任务队列 UI/自动 resume                  | **NO-GO**：前端只消费 snapshot/event，不写 queue/checkpoint                           |
| 阶段 4 受控执行闭环                                   | **NO-GO**：真实 Provider acceptance、profile records 和 create-run successor 仍未满足 |
| 阶段 5 自主优化                                       | **NO-GO**：明确不开放                                                                 |

## 重新评估触发条件

只有在以下条件同时具备时才重新打开外部 runtime bake-off：

1. 正式写工具、approval、create-run、cancel/resume/retry 的 successor contract 已发布并通过 Schema/OpenAPI drift check；
2. 至少一个真实 Provider acceptance repetition、人工 citation entailment review 和 side-effect ledger 验收完成；
3. 以同一 operation fixture 对当前 runtime 与单一候选执行重启、checkpoint、取消、重复事件、幂等、迁移和部署测试；
4. 输出可审计的延迟/失败率/存储增长/备份恢复/运维成本数据，且不保存 credential、hidden reasoning、raw response 或
   未展示 evidence payload；
5. 独立 go/no-go 审查确认引入候选不会扩大 shell、路径、URL、网络或跨 run 权限边界。

在这些条件满足前，任何“runtime 可用”“队列稳定”或“自动恢复已上线”的文案都不得出现在前端能力目录中。

## 2026-10-18 阶段 3A 收口补充

本轮没有引入第二个 runtime。当前 SQLite WAL + bounded worker 继续作为唯一受控执行 runtime，并新增
`AH3-F01`–`AH3-F26` 故障注入矩阵与仓外 synthetic hosted smoke。矩阵覆盖 admission、幂等、队列容量、worker/Bridge
重启、create-run unknown outcome、事件序列、取消/重试/恢复、artifact manifest 绑定、retention/delete 和终态 fence；
hosted smoke 使用当前源码 synthetic TileSimCLI 在临时端口完成一次人工批准的单 run 闭环。

这批证据只证明单机、单候选、synthetic exploratory 路径的可审计性，不证明 HA、跨主机调度、Provider acceptance 或
无人值守执行。`failed` 只可显式 retry，`recovery_required` 只可显式 resume/cancel；manifest 在结果引用前再次核对
schema、run、SHA、bytes 与 rejection set。阶段 3A 仍为 NO-GO，Provider acceptance 保持 `live_acceptance_pending`，
自主优化、自动候选和多工具自主循环继续关闭。

## 2026-10-18 独立发布审查补充

已把阶段 3A 故障矩阵和 hosted smoke 从报告文字提升为可执行 release-gate 入口：
`bridge/run_agent_harness_stage3_release_gate.py` 会在仓外临时状态根运行定向 Stage 3 测试，
可选地启动仓外临时 Bridge + synthetic CLI，输出带 contract/schema/backend/CLI identity、case ID、
artifact SHA/bytes/run binding 和 reviewer/provider 状态的 redacted manifest。当前 26/26 matrix pass、hosted smoke pass，
但 Provider acceptance 为 `live_acceptance_pending`、人工 citation review 尚未完成，独立审查结论仍为 **NO-GO**。

## 2026-10-18 acceptance / review 准备补充

本轮仅新增仓外 redacted preparation contract 与校验入口，未引入第二个 runtime，也未调用 Provider。固定的
Provider acceptance manifest 和 evidence/citation review package identity 见
[`29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md`](29_AGENT_HARNESS_STAGE3A_ACCEPTANCE_PREFLIGHT.md)。当前
Provider 仍为 `live_acceptance_pending`，人工 review 为 `not_run`，因此不改变 runtime bake-off 的 NO-GO 边界，
也不允许阶段 3B 或阶段 4 启动。
