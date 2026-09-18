# 页面帮助与逐步指引深化计划

**状态**：implemented；全仓门禁已通过
**并行所有权**：`src/features/guided-help/**`、帮助组件/样式、PagePrimer、帮助测试与 guided-help i18n fragment

## 目标

让没有 TileSim、LLM serving 或仿真背景的用户，在每个模块都能知道“这页做什么、先点哪里、重点看什么、下一步去哪”，同时把术语、Schema、identity、SHA、Pointer、fidelity、DES/Pareto 等专业内容保留在按需展开层。

## 实施结果（2026-09-02）

- `src/features/guided-help/` 已形成独立公共入口、typed schema、按模块 guide 文件、route/embedded catalog 和纯内存状态；guide 数据不访问 store、Bridge、Schema 或其他 feature 内部文件。
- `PagePrimer` 默认显示普通语言用途与有文字标签的黄色“重点”；`GuidedHelpHost` / `GuidedStepPanel` 提供非模态 3–4 步指引、跳过、关闭、重新打开、上一步/下一步与下一页建议。
- `TermHelp` 和最后一层高级 disclosure 承载术语、Schema identity、SHA-256、Pointer、完整 JSON 与契约说明；原始证据查看器有独立 embedded guide。
- 所有步骤使用 `data-help-anchor="<guide-id>-<semantic-name>"`，不依赖 CSS 层级。条件内容不可见时明确播报当前状态，不伪造页面目标。
- 当前步骤不进入 localStorage/sessionStorage；Escape 关闭外层指引并恢复触发器焦点，内层 disclosure 先关闭自身并恢复焦点。
- 空状态提供“新建实验” CTA；帮助文案单独进入 `src/i18n/workstreams/guided-help.ts`。

模块路径如下：

| 模块               | 步骤                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| 运行概览           | 状态与限制 → 关键数字 → 后端报告重点 → 下一条分析路径                    |
| 新建实验           | 命名/场景 → 输入与 trace 来源 → requested/resolved fidelity → 提交预览   |
| 执行过程           | canonical flow → 选中环节 → 指标/记录 → S7 execution host                |
| 性能指标           | 汇总指标 → 稳定证据入口 → 请求表 → 解释边界                              |
| 网络与通信         | 总体状态 → 后端热点 → 通信域 → request contribution                      |
| 慢请求原因         | request 选择 → 并列资源证据链 → S9 归因页签 → 审计                       |
| 结果可信度         | 允许声明范围 → open gaps → provenance/calibration → resolved fidelity    |
| 方案对比           | execution scope → 候选/细化数量 → 排名/P95/P99 → 候选证据                |
| 运行记录与 A/B     | 搜索运行 → 打开 → 选择 A/B → 可比性与差异                                |
| AI 解释            | availability → request → question → 用户确认与 citations                 |
| 校准与追踪         | evidence map → calibration → field lineage → deterministic orchestration |
| Unsupported Schema | fail-closed 原因 → identity/issues → raw JSON → 安全恢复路径             |
| JSON/原始证据      | 展开 → artifact → 搜索/Pointer → identity/SHA 复核                       |

可访问性回归覆盖 `ol` / `aria-current`、`aria-live=polite`、`aria-expanded/controls`、纯键盘操作、Escape 焦点恢复、axe、reduced-motion 自动滚动、中英文与桌面 overflow。语义回归固定 S3/S4/S5 并列、S7 host、S8/S9 不进入 causal ranking、trace provenance 不升级、requested/resolved fidelity 分离、synthetic consistency 不冒充 held-out validation、状态不混淆、uint64 无损和 AI 需用户确认。

## 接手前脚手架与差距（历史）

本轮开始时只有 PagePrimer 和 typed guide 脚手架，稳定页面 anchor、空状态 CTA、完整焦点/双语/E2E 验收尚未闭合。上述差距现已全部关闭；本节只保留为开发历史，不再代表当前状态。下一轮不应重建 host 或第二套 guide catalog，而应在现有系统上深化条件页面状态、跨模块下一步建议和术语精简。

## 开发阶段

### A. 闭合低耦合帮助基础

- 复核现有 typed guide schema、分路由 guide、嵌入 guide、术语和公共入口，补齐唯一性与双语覆盖。
- 复核现有 `GuidedHelpHost.vue`、`GuidedStepPanel.vue`、`TermHelp.vue`、`KeyTakeaway.vue` 与内存态，闭合焦点、Escape、locale 和 route 切换回归。
- guide 定义为纯数据，不访问 store、Bridge、report Schema 或其他 feature 内部文件。
- 使用稳定 `data-help-anchor`，不使用 DOM 层级选择器。
- 采用非模态、可跳过、可重新打开的帮助；当前步骤只保存在内存，不新增持久化。

### B. 每个模块的任务路径

1. 概览：确认限制 → 看关键数字 → 看当前重点 → 选择下一页。
2. 新建实验：命名 → 选择场景 → 调整常用参数 → 运行前检查 → 提交等待。
3. 执行过程：选环节 → 读摘要 → 看图 → 按需查证据。
4. 性能指标：理解吞吐/延迟 → 理解 P95/P99 → 选请求 → 看慢请求原因。
5. 网络与通信：看瓶颈 → 区分排队/拥塞 → 看通信范围 → 按需查 request/Topology。
6. 慢请求原因：选请求 → 看主导原因 → 看并列 S3/S4/S5 → 看 S7/S8/S9 输出 → 必要时询问 AI。
7. 结果可信度：看来源 → 校准 → 可用范围 → 未关闭问题。
8. 方案对比：确认比较范围 → 比 P95/P99 → 看前两名 → 再展开 DES/Pareto/契约。
9. 运行记录：搜索 → 打开 → 选基线 A → 选变体 B → 读 B-A。
10. AI 解释：确认 readiness → 选请求/任务 → 生成 → 审核 claims/citations → 必要时显式 discard。
11. 校准与追踪：理解用途 → 选择校准/血缘/编排 → 看边界 → 按需查 SHA/字段。
12. Unsupported Schema/原始证据：理解失败关闭 → 确认数据仍在 → 查看/导出 → 选择恢复路径。

### C. 渐进披露与术语

默认只显示用途、一个重点结论、当前操作和一个明确下一步。术语、ID、Schema、SHA、Pointer、canonical、fidelity、Pareto 和 DES 通过术语按钮、details、“查看技术依据”或“定位原始证据”进入。不得隐藏限制或把结论写得更强。

### D. 测试

- 每个桌面路由都有 guide，step ID 唯一，guide/term 英文翻译完整。
- 上一步/下一步/关闭/重开、locale 切换保持 step、Escape 与焦点恢复。
- 中文/英文、1440×1000 和较窄桌面视口无横向 overflow。
- axe、键盘、ARIA、reduced-motion；原始 ID/Pointer 不翻译不改写。

## 并行边界

帮助任务不重写 Agent 状态机或图表模型。页面 anchor 由对应页面所有者添加；帮助任务维护 anchor 清单和 guide。新英文文案只进入 `src/i18n/workstreams/guided-help.ts`。

## 后续任务提示词

```text
请在 D:\tileSim-web 接手 TileSim Web 的页面帮助与逐步指引工作。

开始前完整阅读 AGENTS.md、docs/AI_HANDOFF.md、D:\tileSim\AGENTS.md、docs/FRONTEND_VISUAL_REFINEMENT_PLAN.md、docs/PARALLEL_FRONTEND_WORKSTREAMS.md 和 docs/NEXT_GUIDED_HELP_DEVELOPMENT_PLAN.md。

你在独立 worktree/分支中工作。主要负责 src/features/guided-help/**、PagePrimer、帮助组件/样式、帮助测试和 src/i18n/workstreams/guided-help.ts。不要修改共享 english-catalog.ts，不进入 Evidence Agent 的 request/store/validator，不修改图表数据模型、Bridge、Schema、OpenAPI、canonical digest 或无损 uint64。保护已有改动，不 reset、clean、覆盖、提交或推送，除非父任务明确要求；不要停止、重启或部署 127.0.0.1:5173。

目标是让没有领域背景的用户逐页知道：这页解决什么问题、第一步看/点哪里、重点结论是什么、下一步去哪、专业术语和原始证据在哪里按需查看。复用并审查现有 typed guide schema、分路由纯数据 guide、GuidedHelpHost、GuidedStepPanel、TermHelp 和 KeyTakeaway，不重复创建第二套帮助系统。现有稳定 data-help-anchor、键盘/焦点、双语和 E2E 已闭合；后续重点是条件页面状态、空状态 CTA、跨模块下一步建议和术语精简。帮助继续保持非模态、可跳过、可重开且仅使用内存状态。

覆盖概览、新建实验、执行、性能、网络、慢请求原因、可信度、方案对比、历史 A/B、AI 解释、校准追踪、Unsupported Schema 和 JSON/原始证据查看器。默认只显示用途、重点、当前操作和下一步；Schema/identity/SHA/Pointer/fidelity/DES/Pareto 等按需展开。不得重算、推断、补造或升级 provenance/fidelity；S3/S4/S5 并列，S7 host，S8/S9 不进入 causal ranking。

所有功能必须键盘可用，使用 ol/aria-current、aria-live=polite、aria-expanded/controls；Escape 关闭并恢复焦点；不依赖 hover/颜色；reduced-motion 禁止平滑滚动和装饰动画；中英文无横向 overflow；原始证据 ID/Pointer 不翻译。

补齐 guide coverage、step/translation uniqueness、组件交互、空状态 CTA、双语 overflow、axe、焦点和 reduced-motion 测试。完成后运行 pnpm contracts:check、deps:check、typecheck、test、lint、format:check、build、test:e2e 和 git diff --check。最终报告逐模块列出步骤、默认/专业内容层级、术语、可访问性结果、并行文件边界和未闭合问题，并明确未部署 5173。
```
