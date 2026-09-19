# 决策记录与未决问题

> L0 审计日期：2026-09-12。本文记录的是进入 L1 前的产品与边界输入，不授权任何源码、Bridge、Provider 或 Agent 契约变更。

## 已冻结决策

| ID | 决策 | 冻结含义 |
| --- | --- | --- |
| D-01 | `/` 为两个等权工作台入口的选择页 | 首屏同时呈现“进入专业版”和“进入轻量版”，不把轻量入口藏在专业 Overview。 |
| D-02 | 两个工作台使用独立 shell 与独立导航 | 可以共享设计 token、公共 UI 和事实/能力适配，但不得共享页面信息架构或把轻量版做成专业版皮肤。 |
| D-03 | 轻量首期为只读、单轮、内存态草案 | 不创建正式 run、不修改专业表单、不保存完整问题/响应；当前草案仅在页面生命周期内有效。 |
| D-04 | 共享 canonical 事实与公开 Agent 能力，不共享页面编排 | 字段值、状态、provenance、fidelity、schema/revision 只能来自既有公开入口。 |
| D-05 | 所有能力与状态 fail closed | `unknown`、`missing`、`unsupported`、`unavailable`、`stale`、`not covered` 不得被 UI 或 Agent 猜测、补齐或升级成成功。 |
| D-06 | 首批任务按“了解、准备、解读、示例”组织 | 任务卡先说明目标、耗时、只读性和产物，再进入对应页面；示例必须标注 example。 |
| D-07 | 轻量→专业是查看/继续处理的路由跳转 | 只携带合法 run/artifact/schema 查询引用；不复制内部 store，不创建新 run。 |
| D-08 | URL、server state、workspace/session state、UI preference 分层 | URL 只放可复制引用；Query key 保留 run、backend identity、schema-set revision、artifact SHA-256（适用时）；草案正文不进入 localStorage。 |
| D-09 | 专业版保护优先 | 现有专业路由、表单、Agent 侧栏、Evidence Agent、run 恢复和旧 URL 必须保持可用；进入 backend-global 页面不得清除当前 run。 |
| D-10 | 产品范围仅为电脑网页端 | 不增加移动端专属实现、导航或验收。 |

## 推荐默认值（尚未替代产品确认）

| ID | 推荐值 | 依据/影响 |
| --- | --- | --- |
| R-01 | 根路径始终渲染选择页；仅弱提示最近模式，不自动重定向 | 满足“主页第一屏双入口”并降低模式记忆造成的误入；需要多一次点击。 |
| R-02 | 轻量首期采用真实子路由：`/lightweight/learn`、`/tasks`、`/prepare`、`/results` | 支持深链接、后退/前进和可测试的任务边界；实现量略增。 |
| R-03 | 刷新或关闭页面不恢复草案正文 | 当前无 Draft/Conversation/retention contract；仅保留非敏感模式偏好。 |
| R-04 | 结果解读只允许读取用户已有且可验证的 run | 复用现有查询与权限，不创建或复制 run。 |
| R-05 | 首批四类任务，每类最多两个模板 | 控制认知负担，避免模板暗示未开放能力。 |
| R-06 | 浏览器存储不可用时退化为本次会话记忆 | 入口和切换仍可用，偏好不应阻塞核心体验。 |

## 产品确认记录（2026-09-12）

产品负责人已确认 Q-01–Q-06，确认内容与“推荐默认值”一致：根页不自动跳转、轻量使用真实子路由、草案不跨刷新恢复、结果仅读已有合法 run、每类最多两个模板，且模式偏好对所有用户一致并不参与授权。

## 必须由产品负责人确认的问题（已确认）

| ID | 问题 | 当前建议 | 未确认前的处理 |
| --- | --- | --- | --- |
| Q-01 | 访问 `/` 是否允许按最近模式自动进入 | 不自动进入，仅弱提示最近模式 | 已确认；根页始终显示选择页。 |
| Q-02 | 轻量导航首期是否拆分为真实子路由 | 是 | 已确认；L1a 写入路由合同。 |
| Q-03 | “我的草案”刷新后是否保留 | 不保留 | 已确认；只允许页面生命周期内存态。 |
| Q-04 | “解读结果”是否可选择已有 run | 只读读取合法 run | 已确认；不创建或复制 run。 |
| Q-05 | 四类任务的首批模板数量 | 每类最多两个 | 已确认；不扩展现有原型模板。 |
| Q-06 | 轻量版入口与最近模式偏好是否对所有用户一致 | 是；偏好不参与授权 | 已确认；任何权限、团队或 retention 变化仍需另立决策。 |

产品确认已完成；本阶段批准范围仅为 L1a 根页双入口与路由合同，不代表批准 Provider 调用、正式 run 创建、多轮 Conversation、Draft 持久化、权限、retention、Bridge contract 或 Agent capability。

## 明确延期的能力

- 多轮 Conversation、自动保存/跨设备 Draft、协作分享。
- 从轻量版一键创建或执行正式 run、修改专业实验表单的隐式动作。
- Provider 调用、RAG、Workflow、Approval、工具编排和 SSE/cancellation 新契约。
- 模型、engine、device、topology、workload、并行度、物理 KV、集合通信算法和 SLO 推荐。
- 成本预测、SLO 预测、自动优化、ranking、calibration 或 held-out validation 推断。
- 移动端、离线 PWA、账号/团队权限重构和新的 retention 策略。

任何延期能力重新进入范围时，必须先发布相应 Agent/Bridge contract、权限、审计、留存和失败语义，再重新完成 DoR 审计。
