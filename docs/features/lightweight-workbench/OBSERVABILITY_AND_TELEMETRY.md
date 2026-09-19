# 可观测性与遥测边界

## 1. 目标

只衡量入口是否可发现、首次路径是否完成、哪类状态阻塞用户以及模式切换是否成功；不建立内容监控或用户画像系统。

## 2. 允许记录的事件

| 事件 | 必填属性 | 禁止属性 |
| --- | --- | --- |
| `workbench_choice_viewed` | anonymous session id、viewport bucket | 问题文本、run 内容 |
| `workbench_selected` | `mode`、source (`root`/`switcher`) | 用户身份、输入内容 |
| `lightweight_task_selected` | task id、example flag | 自由文本 |
| `lightweight_submit_started` | task id、context revision hash（不可逆） | 原始 instruction |
| `lightweight_result_state` | canonical state、provenance class、latency bucket | raw response、field value |
| `lightweight_switch_to_professional` | source section、target route class | 完整 query payload |
| `lightweight_error` | stable error code、retryable、latency bucket | stack trace、credential |

事件属性使用枚举和 hash；不要发送 run 名称、artifact 内容、设备序列号、用户输入或 Agent 响应。

## 3. 性能与健康指标

- 入口选择页首屏渲染/可交互时间。
- capability snapshot 请求成功率、失败分类和 p50/p95 延迟。
- 提交到 typed block 的本地处理延迟。
- stale、unsupported、unknown、validation error 的比例（仅状态类别）。
- 专业版回归错误率和轻量到专业跳转成功率。

任何指标异常只触发诊断，不自动改变 capability、fidelity、provenance 或用户状态。

## 4. 日志与调试

生产日志只允许稳定错误码、route class、schema/backend identity 和 correlation id；输入 redaction 前后的文本都不得记录。fixture/本地调试可使用更详细日志，但测试必须验证没有 credential、raw response 或 hidden reasoning 泄露。

## 5. 数据生命周期

事件 retention 遵循仓库现有策略；UI preference 与遥测不得互相充当草案存储。用户关闭遥测时，核心入口和 Agent 状态必须仍可用，仅减少统计维度。
