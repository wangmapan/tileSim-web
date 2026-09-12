# 状态与路由设计

## 1. 路由契约

| 路由 | 责任 | 是否 run-bound |
| --- | --- | --- |
| `/` | 工作台选择/最近模式入口 | 否 |
| `/lightweight` | 轻量任务首页 | 否，可读取当前内存草案 |
| `/lightweight/learn` | 概念学习 | 否 |
| `/lightweight/tasks` | 任务/模板 | 否 |
| `/lightweight/prepare` | Agent 单轮草案 | 否 |
| `/lightweight/results?run=run-*` | 轻量结果摘要 | 是（只读） |
| `/overview` 及现有专业路由 | 专业工作台 | 依现有定义 |

现有 `/lightweight-workbench` 兼容重定向保留。旧 `?view=`、`dashboard-state` 兼容逻辑不得被新模式状态覆盖。

## 2. 状态分层

### URL 状态

可复制、可审计的状态：route、合法 run ID、artifact SHA、schema revision、来源标记。URL 不含完整问题文本、raw response 或 credential。

### Pinia workspace/session 状态

当前 run、run-bound report、bridge manifest、连接状态、当前轻量 section、单轮草案和 stale 标记。刷新后只按已有恢复策略恢复；不把完整会话写入 localStorage。

### 非敏感 UI preference

`tilesim-web.workbench-mode.v1`：`lightweight | professional`。损坏值视为不存在。可选的引导完成标记也必须独立版本化且不含内容。

## 3. 轻量状态机

```text
idle
  → task_selected
  → instruction_ready
  → submitting
  → {draft | clarification | explanation | unsupported | validation_error | unavailable}
  → stale（context/run/schema 变化）
```

每个终态都有可见的下一步；`submitting` 只表示本地确定性解析/能力读取，不暗示 Provider 或正式仿真正在执行。

## 4. 切换规则

- 从轻量到专业：路由跳转；保留合法 run ID 和 report query；不复制内部 store，不创建 run。
- 从专业到轻量：默认进入 `/lightweight`；如果用户从已有结果进入，使用 `/lightweight/results?run=...` 只读呈现。
- 上下文 revision 变化：旧草案标记 stale；禁止自动迁移或静默重算。
- Bridge disconnected：保留已验证页面内容，但新能力请求显示 unavailable；不清除当前 run。
- 浏览器后退/前进：以 URL 为准恢复页面；与 Pinia 不一致时走现有导航同步，不删除 run-bound 状态。

## 5. 查询与缓存

能力 snapshot、manifest 等 server state 继续使用 TanStack Query；workspace/session/history/bridge UI state 继续使用 Pinia。Query key 必须包含 run ID、backend identity、schema-set revision、artifact SHA-256（适用时）。轻量版不新增第二套缓存或数据源。

## 6. 恢复矩阵

| 事件 | 恢复来源 | 允许恢复 | 不允许 |
| --- | --- | --- | --- |
| 首次打开 `/` | 无 | 选择页 | 自动猜测模式 |
| 再次打开 `/` | mode preference | 最近工作台入口 | 恢复完整草案/问题 |
| 刷新 `/lightweight/prepare` | Pinia（若仍在同一页生命周期） | 当前 section、pending 取消 | 从 localStorage 拼回对话 |
| 打开带 `run` 的结果 URL | URL + 现有 run store | 只读摘要/证据 | 创建或复制 run |
| 后退/前进 | URL | 对应页面与 query | 清除专业 run |
| Bridge 重连 | manifest/query | 重新取 snapshot | 自动重算旧结果 |

## 7. 状态转换表

| 当前状态 | 事件 | 目标状态 | 副作用 |
| --- | --- | --- | --- |
| idle | 选任务 | task_selected | 仅 UI 状态 |
| task_selected | 输入有效 | instruction_ready | 不调用 Bridge |
| instruction_ready | 提交 | submitting | 生成 request digest |
| submitting | canonical draft | draft | 内存保存 typed blocks |
| submitting | clarification | clarification | 不填充猜测值 |
| submitting | unsupported/unavailable/error | terminal status | 显示 retry/next step |
| 任意结果 | context/schema/run 变化 | stale | 锁定旧结果 |
| stale | 显式丢弃 | idle | 清除当前内存草案，不删服务器数据 |
