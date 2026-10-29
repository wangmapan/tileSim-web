# 执行回放字段支持矩阵（M0）

本矩阵记录 M1 使用的现有 artifact 字段。它不是新的 Bridge contract；字段值仍由现有 artifact manifest、SHA-256 校验和 run 绑定提供。

| 字段 / 事实                          | 来源 artifact                                                  | JSON Pointer / 字段模式                                                                         | 当前是否可用             | 语义                          | M1                                    | 缺失时显示                                       | 未来 contract                |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------- | ------------------------------------- | ------------------------------------------------ | ---------------------------- |
| 执行阶段、开始/结束时间              | `execution-envelope` (`tilesim.s7_execution_envelope.v1`)      | `/stages/*/stage_id`, `/stages/*/subsystem`, `/stages/*/start_time_ps`, `/stages/*/end_time_ps` | 可用（区间可能缺端点）   | interval / phase              | 支持                                  | 仅阶段摘要；不补默认时长                         | 否                           |
| envelope 全局时间范围                | `execution-envelope`                                           | `/start_time_ps`, `/end_time_ps`                                                                | 可用时使用               | interval / aggregate          | 支持                                  | 使用合法阶段或事件点边界；都没有则显示无时间范围 | 否                           |
| runtime 事件类型与时间               | `runtime-events` (`tilesim.s1_runtime_event_trace.v1`)         | `/events/*/kind`, `/events/*/event_time_ps`, `/events/*/logical_step`                           | 按 manifest 按需可用     | point event                   | 支持                                  | 受控“运行期事件未报告”状态                       | 否                           |
| request / batch 归属                 | `runtime-events`                                               | `/events/*/request_id`, `/events/*/batch_id`, `/events/*/batch_request_ids`                     | 随事件逐条可用           | point event metadata          | 支持                                  | 显示“请求/批次未报告”                            | 否                           |
| runtime event 原始顺序               | `runtime-events`                                               | `/events/*` 的数组索引；可选 `/events/*/event_id`                                               | 可用                     | point event order             | 支持；相同时间戳保持数组顺序          | 显示 source index                                | 否                           |
| runtime request 到达/准入/完成       | `runtime-requests` (`tilesim.s1_runtime_request_summaries.v1`) | `/requests/*/{arrival_time_ps,admit_time_ps,completion_time_ps}`                                | artifact 存在时可用      | aggregate / request summary   | M1 仅作为覆盖说明，不复制成事件       | 请求摘要未报告                                   | 否                           |
| phase Fabric contribution            | `metrics` (`tilesim.metrics_report.v1`)                        | `/system_summary/phase_fabric_contributions/*`                                                  | 可用时可读               | aggregate                     | 仅显示摘要覆盖，不伪装成逐条事件      | “通信阶段聚合未报告”                             | 否（完整细粒度回放需要）     |
| Fabric route interval                | 现有 Fabric evidence / runtime analysis artifact               | `*/evidence/fabric/timeline/*/{start_time_ps,finish_time_ps}`                                   | 取决于 artifact 是否登记 | interval / aggregate          | M1 不播放路径，仅保留 coverage 边界   | “底层路径未报告”                                 | 是，需稳定 artifact identity |
| `actual_path` / `link_endpoints`     | Fabric route evidence                                          | `*/evidence/fabric/timeline/*/actual_path`, `*/link_endpoints`                                  | 取决于记录               | topology reference            | M1 不从 topology 推断路径             | “实际路径未报告”                                 | 是                           |
| Fabric execution events              | Fabric route evidence                                          | `*/evidence/fabric/timeline/*/execution_events/*`                                               | 取决于记录               | point / interval（后端定义）  | M1 不展开为 runtime marker            | “链路事件未报告”                                 | 是                           |
| topology device/domain/link identity | `input-topology` (`tilesim.s6_topology_input.v1`)              | `/topology/{devices,domains,links}/*`                                                           | 输入 artifact 存在时可用 | topology reference            | M1 只作为证据边界，不推断实际经过路径 | “拓扑输入未报告”                                 | 否                           |
| artifact run / schema / SHA 绑定     | artifact manifest + verified artifact path                     | manifest `run_id`, `artifacts/*/{artifact_id,schema_identity,sha256,bytes}`                     | 可用                     | identity / evidence reference | 必须通过；失败则受控拒绝              | “证据身份不一致”                                 | 否                           |

## 状态约定

- `available`：artifact 已通过 manifest、SHA、schema 和 run 绑定，且字段存在。
- `partial`：存在部分可回放字段（例如阶段有区间但 runtime trace 缺失）。
- `missing`：当前 run 没有登记该 artifact，不能把空数组当成缺失事实。
- `expected_absence`：manifest 提供后端签名的期望缺席描述符。
- `not_covered`：artifact 或报告明确声明当前边界不覆盖该事实。
- `unsupported_schema`：artifact 被拒绝或 schema identity 不受支持。

M1 不新增 `tilesim.execution_replay.v1`，不把 `phase_fabric_contributions`、topology 配置或 synthetic trace 升级成逐条真实执行事件。
