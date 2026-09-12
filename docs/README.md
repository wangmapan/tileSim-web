# TileSim Web 文档入口

本文档树按“当前事实优先、稳定设计其次、历史证据最后”组织。AI 不得从文件日期推断当前状态。

## 必读顺序

1. [`../AGENTS.md`](../AGENTS.md)：仓库规则与完整门禁。
2. [`AI_HANDOFF.md`](AI_HANDOFF.md)：当前代码、阶段、风险和下一步。
3. [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、部署、验证与 AI 接手。
4. 当前任务对应目录。

## 目录分类

| 目录                      | 内容                                     | 当前决策权                      |
| ------------------------- | ---------------------------------------- | ------------------------------- |
| `architecture/`           | 前端架构、数据流、可视化设计             | 有，须与代码和契约核对          |
| `contracts/`              | F6–F9、Evidence Agent 与实验编排契约审计 | 有，正式 Schema/descriptor 优先 |
| `deployment/`             | immutable release、回滚和部署安全        | 有                              |
| `features/`               | 面向用户和维护者的功能说明               | 有                              |
| `F9_AGENT_ORCHESTRATION/` | Agent 编排规范、Gap 与阶段验收           | 有                              |
| `research/`               | Agent/RAG/长期产品方案                   | 设计输入，不代表已实现          |
| `archive/`                | 已结束阶段、旧提示词和 dated evidence    | 无                              |
| `development/`            | 旧链接兼容入口                           | 无                              |

轻量工作台说明见 [`features/lightweight-workbench/README.md`](features/lightweight-workbench/README.md)。

## 更新规则

- 当前状态只写入 `AI_HANDOFF.md` 和对应模块 current baseline。
- 部署步骤变化时同步根 `README.md`、部署手册和脚本测试。
- 正式 identity、revision 和错误语义以运行时 contract 为准。
- 历史报告保留原文并移入 archive，不把旧测试数字改写成当前数字。
- 已完成的计划、一次性交接提示词和被当前路线替代的协作说明统一移入 `archive/plans/`。
- 新文档必须放入对应目录并从本页或模块入口可达。
