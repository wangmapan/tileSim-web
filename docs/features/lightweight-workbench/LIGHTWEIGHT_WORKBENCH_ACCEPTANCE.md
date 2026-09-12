# 双工作台验收标准

## 1. P0 功能验收

| 编号 | 场景 | 通过条件 |
| --- | --- | --- |
| F-01 | 首次进入 `/` | 首屏只需一次判断即可看到等权“专业版/轻量版”入口；无隐藏入口 |
| F-02 | 入口跳转 | 两个 CTA 分别进入正确 shell；浏览器后退/刷新可恢复 |
| F-03 | 轻量任务首页 | 了解、准备、解读、示例四类任务可见；每卡说明人群/耗时/产物/只读性 |
| F-04 | 首次成功路径 | 自然语言输入后显示理解摘要、状态、限制和下一步；明确“草案，尚未创建运行” |
| F-05 | Agent 状态 | draft、clarification、unknown、missing、unsupported、unavailable、stale、validation error 均有独立文案和动作 |
| F-06 | 专业衔接 | 从轻量结果到专业详情的链接保留合法 run/artifact/schema 引用；不创建新 run |
| F-07 | 模式切换 | 顶栏始终可切换；切换不清除当前 run-bound 状态、不覆盖专业表单 |
| F-08 | 深链接 | `/lightweight/results?run=run-*`、专业现有 URL 可复制打开；非法/过期引用显示错误而非猜测 |

## 2. 契约与安全验收

- 适配器只通过公开 Agent feature 入口读取 capability、compile、typed blocks 和 redaction。
- 未调用 Provider、未读取 credential、未调用 create-run、未创建正式 run。
- Query key 保留 run ID、backend identity、schema-set revision、artifact SHA-256（适用时）。
- `0`、missing、expected absence、not covered、unsupported schema、not applicable 不混淆；provenance/fidelity 不升级。
- 不持久化完整输入、raw response、hidden reasoning 或完整对话；只保存非敏感 UI preference。

## 3. 可用性与无障碍验收

- 桌面窗口 800×600、1024×768、1440×900 均可完成入口到结果摘要。
- 200% 缩放无横向滚动；键盘可完成所有核心动作；焦点可见且顺序合理。
- 深浅主题、reduced-motion、axe serious/critical 均通过；状态不依赖颜色。
- 新手可在无术语预备知识下回答：我在哪、正在做什么、是否真的运行、下一步是什么。

## 4. 回归门禁

按仓库完整门禁执行：`pnpm contracts:check`、`pnpm docs:check`、`pnpm deps:check`、`pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`、Bridge py_compile/unittest、`git diff --check`、`pnpm test:e2e`。保留现有专业版测试和 skipped 语义；fixture 不能充当 live/calibration/held-out 证据。

## 5. 发布与回滚验收

发布前确认：变更文件仅落在轻量 feature/view/router/文案和本目录文档；Agent、Evidence、Bridge、Provider、后端 identity/revision 不变。若任一 P0 失败，移除轻量路由、view、入口选择页和 feature 装配即可回到专业版；不得 reset 或覆盖用户未提交改动。

## 6. 负向测试（必须失败关闭）

| ID | 输入/条件 | 期望 |
| --- | --- | --- |
| N-01 | 非法 `run` query | 不发 run 请求，显示格式错误 |
| N-02 | snapshot revision 与 context 不同 | 不 compile，显示 stale |
| N-03 | capability 声明 unavailable | 不显示可编辑控件/默认值 |
| N-04 | uint64 超过 JS 安全整数 | 原值无损，显示换算可追溯 |
| N-05 | synthetic/compatibility fixture | 不显示 real/held-out 文案 |
| N-06 | 快速重复提交 | 只有一个 pending/结果，不产生伪多轮 |
| N-07 | localStorage 抛错或禁用 | 入口和切换可用，仅不记忆偏好 |
| N-08 | Bridge 断开后切换模式 | 保留当前 run/已验证内容，不伪造在线 |
| N-09 | 输出含 unknown + validation error | 两种状态分别显示，不归并成成功草案 |
| N-10 | query 包含脚本/命令字符 | 被拒绝或安全编码，不进入 DOM/命令 |

## 7. 内容与遥测验收

- 四类任务卡包含适用人群、预计时间、产物和副作用。
- 每个状态遵循 `CONTENT_AND_COPY_GUIDELINES.md`，中英文按钮意图一致。
- 遥测仅发枚举/时延桶/hash；测试断言不包含 instruction、field value、raw response、credential。
- 选择页可在 capability/Bridge 请求失败时独立呈现。

## 8. 需求追踪

| 产品需求 | 验收 |
| --- | --- |
| PR-01/PR-02 | F-01、F-02、F-03 |
| PR-03/PR-08 | F-06、F-07、F-08、N-08 |
| PR-04/PR-05 | F-03、F-04、可用性验收 |
| PR-06 | F-05、N-02–N-05、N-09 |
| PR-07 | 契约/安全验收、内容验收 |
| PR-09 | 主题、国际化、无障碍验收 |
| PR-10 | 遥测验收 |
