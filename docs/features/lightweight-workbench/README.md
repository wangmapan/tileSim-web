# TileSim 双工作台方案（轻量版 + 专业版）

状态：`L1b complete / L2 pending`（L0 决策已于 2026-09-12 确认；L1a 完成根页双入口与路由合同，L1b 完成独立轻量 Shell、导航和模式切换）。

本目录是“并列双工作台”重设计的唯一方案入口。主页 `/` 的第一屏必须让用户在两个同等地位的入口中选择：

- **专业版**：面向熟悉仿真、网络和性能概念的用户，保留现有完整导航、实验表单、运行、指标、验证、证据和历史能力。
- **轻量版**：面向基础知识储备较少的用户，拥有独立的信息架构、任务流、教学内容和结果摘要；不是专业版的隐藏子页或缩小皮肤。

两种工作台只在事实和能力层复用：Agent 公开入口、capability snapshot、intent compiler、typed output、canonical contract、证据与错误语义。页面编排、导航、文案层级和交互节奏分别设计。

## 文档索引

L0 审计报告：[`L0_BASELINE_AND_DECISION_AUDIT.md`](L0_BASELINE_AND_DECISION_AUDIT.md)

| 文档                                                                                       | 用途                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)                                         | 目标、用户、范围、指标、非目标与产品决策        |
| [LIGHTWEIGHT_WORKBENCH_DESIGN.md](LIGHTWEIGHT_WORKBENCH_DESIGN.md)                         | 轻量版端到端体验、页面结构、首次成功路径        |
| [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md)                                 | 双工作台 sitemap、导航、入口、深链接和模式切换  |
| [USER_RESEARCH_AND_COMPETITOR_REVIEW.md](USER_RESEARCH_AND_COMPETITOR_REVIEW.md)           | 官方资料调研、竞品模式、可迁移结论              |
| [AGENT_INTEGRATION_BOUNDARY.md](AGENT_INTEGRATION_BOUNDARY.md)                             | 轻量版可消费的 Agent 能力与明确禁止事项         |
| [STATE_AND_ROUTING_DESIGN.md](STATE_AND_ROUTING_DESIGN.md)                                 | 路由、状态机、持久化、刷新/后退语义             |
| [ACCESSIBILITY_AND_RESPONSIVE_DESIGN.md](ACCESSIBILITY_AND_RESPONSIVE_DESIGN.md)           | 电脑网页端无障碍、键盘、缩放和响应式要求        |
| [SECURITY_RETENTION_AND_FAILURE_SEMANTICS.md](SECURITY_RETENTION_AND_FAILURE_SEMANTICS.md) | 安全、留存、redaction、unknown/stale/error 语义 |
| [CONTENT_AND_COPY_GUIDELINES.md](CONTENT_AND_COPY_GUIDELINES.md)                           | 轻量内容模型、状态词典、文案与国际化边界        |
| [OBSERVABILITY_AND_TELEMETRY.md](OBSERVABILITY_AND_TELEMETRY.md)                           | 允许记录的事件、性能指标与隐私限制              |
| [DECISION_LOG_AND_OPEN_QUESTIONS.md](DECISION_LOG_AND_OPEN_QUESTIONS.md)                   | 已冻结方向、实施前问题与明确延期                |
| [LIGHTWEIGHT_WORKBENCH_ACCEPTANCE.md](LIGHTWEIGHT_WORKBENCH_ACCEPTANCE.md)                 | 功能、契约、可用性、回归与发布验收              |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)                                           | 分阶段实施、DoR/DoD、测试和回滚                 |

## 当前裁决

现有 `src/features/lightweight-workbench/**` 原型仅作为探索草稿，不作为最终信息架构的约束。用户确认本方案前，不继续添加页面功能，也不把原型扩展成正式产品。

## 不变的工程边界

- 不修改 Agent entities/store/context、Agent compiler、Agent integration、Evidence Agent、Bridge contract、后端生产代码或 Provider 配置。
- 轻量版只能通过 Agent 公共 `index.ts` 消费能力；不复制 compiler、validator、capability catalog、request builder 或 typed block 定义。
- 不创建正式 run、不调用 Provider、不读取 credential、不在浏览器模拟 Conversation/Workflow/RAG/Approval。
- 不猜测 unknown，不把 unsupported/unavailable/stale 升级成可用，不把 synthetic consistency 说成 held-out validation。
- 专业版已有路由、表单、Agent、Evidence、run 状态必须通过回归验收；产品范围只包含电脑网页端。
