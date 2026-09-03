# TileSim Web 并行深化工作流

**日期**：2026-09-02
**范围**：Evidence Agent、可视化、页面帮助与逐步指引
**目标**：允许三个 Agent 在独立 worktree/分支中尽可能并行开发，并在最后由一个集成任务统一合并、更新快照和运行完整门禁。

## 1. 当前耦合结论

前端没有已知依赖环或跨 feature 越界调用，`pnpm deps:check` 继续通过。当前耦合主要是单文件职责和共享文件冲突，而不是架构失控：

- `EvidenceAgentPanel.vue` 仍同时编排 readiness、问题表单、request preparation、lease/409 提示与焦点恢复；属于中高耦合，但服务 identity 展示已经移出。
- `ExecutionView.vue`、`DesignSpaceView.vue` 和 execution visualization model 仍较大；属于中等职责耦合，适合按纯 presentation/template 小批次继续拆。
- `english-catalog.ts` 是三个任务都会触碰的高冲突共享文件。
- 视觉快照、`App.vue` 和路由级页面是并行合并时的冲突热点。

本轮已完成保守拆分与基础深化：

1. 页面引导定义从 navigation model 移到 `src/features/guided-help/`；typed catalog、非模态 host、稳定 anchor、术语、空状态入口、原始证据/unsupported guide 和双语可访问性回归已闭合。
2. Evidence Agent 服务身份、task cards、提交预览、lease/409 提示与 atomic claim 分组移到纯展示组件；Panel 保留编排，store/API/builder/validator 未移动。
3. 执行路线普通语言映射移到 `execution-inspector/presentation.ts`；Metrics/Fabric/Design Space/Attribution 分析图进入独立 `analysis-visualizations.ts`，统一显示问题、第一眼、解释边界、完整字段表和证据身份。
4. 新增三份 workstream i18n fragment；并行任务不得继续把新文案直接写入共享 legacy catalog。
5. 新增 guide、Agent presentation、analysis visualization 与跨页 E2E；最终集成已人工查看并统一更新四张视觉快照。

本轮没有迁移 store、API、request builder、response validator、canonical digest、无损整数、F7 formal ranking/Pareto 或 Bridge contract。

## 2. 并行所有权

| 工作流     | 独占范围                                                                                                                                                   | 不得修改                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Agent 模块 | `src/features/evidence-agent/**`、Agent store/entity/API/adapter、F9 专用测试与文档、`src/i18n/workstreams/evidence-agent.ts`                              | 全局帮助、ECharts、其他页面业务逻辑              |
| 可视化     | `execution-inspector/**`、chart runtime/renderer、Execution/Metrics/Fabric/Attribution/DesignSpace 的可视化子组件、`src/i18n/workstreams/visualization.ts` | Agent 状态机、guided-help 定义、Bridge contract  |
| 页面帮助   | `src/features/guided-help/**`、帮助组件/样式、PagePrimer、帮助测试、`src/i18n/workstreams/guided-help.ts`                                                  | Agent request/store、图表数据模型、Bridge/Schema |

页面中的 `data-help-anchor` 由页面所有者添加；帮助任务只维护 anchor contract 和 guide 定义。这样可视化任务与帮助任务不会同时重写同一大页面。

## 3. 共享文件规则

- 三个任务使用独立 `codex/` 分支和独立 Git worktree；不要让三个 Agent 直接写同一个工作目录。
- 并行期间不要修改 `src/i18n/english-catalog.ts`；只写各自 fragment。
- 并行期间不要更新 Playwright PNG；各任务只提交语义断言。快照由最终集成任务统一生成和人工检查。
- `App.vue` 只由页面帮助任务修改。
- `src/styles/evidence-agent.css`、可视化分域 CSS 和未来 `guided-help.css` 分别由对应任务持有。
- 若必须修改共享 contract/type，先暂停相关工作流并形成一份显式接口变更，再同步三方。

## 4. 后续批次的集成顺序

1. 合并页面帮助基础设施和稳定 anchor contract。
2. 合并可视化组件；保持已登记 anchor，不让帮助定义依赖 DOM 层级。
3. 合并 Agent 模块；只通过 guide public API 登记帮助内容。
4. 合并三份 i18n fragment，运行重复 key/翻译覆盖检查。
5. 统一更新视觉快照并逐页做中英文、深色、overflow、键盘、axe 和 reduced-motion 检查。
6. 运行 `AGENTS.md` 完整门禁；不得部署 5173，也不得用 fixture 关闭 F9 live acceptance。

本轮基础集成结果：263/263 frontend、29/29 desktop fixture Playwright、contracts/deps/type/lint/format/build 与
`git diff --check` 通过；5 个 live deployment 用例按环境门禁跳过。未部署 5173，F9 live repetitions 仍为 0。

## 5. 三份计划与提示词

- [Evidence Agent 深化计划](NEXT_AGENT_MODULE_DEVELOPMENT_PLAN.md)
- [可视化深化计划](NEXT_VISUALIZATION_DEVELOPMENT_PLAN.md)
- [页面帮助与逐步指引计划](NEXT_GUIDED_HELP_DEVELOPMENT_PLAN.md)

三份文档末尾各包含一份可以直接作为新任务首条消息使用的中文提示词。
