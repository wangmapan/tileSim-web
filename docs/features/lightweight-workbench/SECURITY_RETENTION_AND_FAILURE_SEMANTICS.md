# 安全、留存与失败语义

## 1. 数据边界

轻量版默认处理 public 或 workspace-internal context；不扩大现有 data classification、allowed purposes 或权限。输入经现有 `redactSingleTurnInstruction` 后才进入 compiler。不得读取、显示或记录 Provider credential。

允许保存：

- `tilesim-web.workbench-mode.v1` 等非敏感 UI preference；
- 已有应用允许的 run/artifact/schema identity 引用。

本地助手缓存允许保存（仅限浏览器本地、有限期、可删除）：

- 经过 redaction 和长度限制的、用户可见的消息与已展示 typed blocks；缓存最多 8 个会话、7 天无活动后过期、总大小约 200 KB，超限按最近更新时间清理。
- UI 必须明确说明这不是服务端 Conversation store，并提供删除当前会话和清理全部缓存的入口。

禁止保存：

- 无期限或未经裁剪的完整用户问题、完整对话、raw response、hidden reasoning；
- credential、token、系统提示词、未脱敏日志；
- 将未经裁剪的草案正文写入 localStorage 以模拟 Conversation/Draft；本地缓存中的可见 draft summary 仍受上述期限、大小和删除规则约束。

## 2. 证据与可信度

- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 原样展示，禁止相互升级。
- requested fidelity 与 resolved fidelity 分开；Analytical/DES 不得写成 Cycle。
- synthetic consistency 不称为 held-out validation。
- 64 位 ps/bytes/count 沿用无损 JSON 路径；轻量显示换算必须标注“显示值”并可追溯原值。

## 3. 失败分类与 UI 行为

| 失败/状态              | 用户应看到什么                           | 是否重试                            |
| ---------------------- | ---------------------------------------- | ----------------------------------- |
| Bridge unavailable     | “本地 Bridge 未连接；已验证内容仍可查看” | 可重试连接                          |
| capability unavailable | “当前能力目录不可用，未生成草案”         | 可重试，不伪造结果                  |
| 400 validation         | 指出字段/格式和修正建议                  | 用户修正后重试                      |
| 409 stale/conflict     | 锁定原 key，说明页面或证据已变化         | 仅显式丢弃后开始新分析              |
| 502/503/504            | 区分上游不可用、超时、服务错误           | 遵循现有 retry policy；不自动改参数 |
| unsupported schema     | 显示 schema revision 与支持范围          | 进入专业支持页面/联系维护者         |
| unknown/missing        | 说明缺哪个事实以及为何不能猜             | 补充或保持 unknown                  |

失败提示必须说明副作用：首期轻量动作均不创建 run、不调用 Provider、不改变实验表单。

## 4. 留存与审计

当前助手仍不是服务端 Conversation/Draft，也不承诺服务端留存；浏览器端允许恢复多个受限的可见会话缓存。缓存只保存经过 redaction/长度限制的可见消息和 typed blocks，受 7 天过期、8 个会话、约 200 KB 总量和显式删除规则约束。当前参数草案仍只在页面内有效；若未来需要服务器留存，必须新增 retention policy、用户可见删除、审计事件和契约版本，不能直接扩大 localStorage。

安全回归包括：redaction、未知值、权限拒绝、stale key、citation 绑定、uint64 无损、日志不泄露输入/credential。fixture 不得替代 live/calibration/held-out 证据。

## 5. 威胁模型

| 威胁                              | 入口                              | 防护                                                  |
| --------------------------------- | --------------------------------- | ----------------------------------------------------- |
| prompt 中包含 credential/隐私信息 | 自然语言输入                      | 现有 redaction；日志和遥测不记录文本                  |
| 恶意 deep link 注入 run/query     | URL                               | allowlist + 格式校验；不把 query 拼入 HTML/命令       |
| stale 结果被当作当前结果          | 浏览器多标签/Bridge revision 变化 | context/schema/backend identity 绑定；明显 stale 状态 |
| UI 伪造可用能力                   | 静态模板或 fallback               | capability gate fail closed；模板与正式结果分离       |
| uint64 精度损失改变结论           | JSON/显示换算                     | 无损解析；原始值可追溯；禁止 Number 强转              |
| 模式切换越权                      | 轻量进入专业页                    | 复用现有权限；模式偏好不参与授权判断                  |

## 6. 错误展示最低字段

每个错误卡至少包含：用户可读标题、stable error code、发生阶段、是否可重试、是否产生副作用、下一步和可展开 technical details。technical details 可以包含 schema/backend identity、correlation id、timestamp，不包含输入正文、raw response、stack trace 或 credential。

## 7. 清除与退出语义

- `清除输入`：只清 textarea，不清当前 run。
- `丢弃草案`：清当前内存 typed blocks，保留 mode preference 和 run。
- `重新选择工作台`：清 mode preference，返回 `/`，不清 run/历史。
- `清理全部本地会话`：删除浏览器缓存中的全部可见会话并留下空白本地会话；这不删除 run/历史或任何服务端对象。
