# 可视化深化计划

**状态**：统一阅读协议与第一批跨页图已实现；后续性能/联动深化 planned
**并行所有权**：execution-inspector、Execution/Metrics/Fabric/Design Space/Attribution 的可视化子组件、分域样式、测试与文档

## 目标

让普通用户先看懂“这张图回答什么、先看哪里、下一步做什么”，专业用户仍可按需核对完整字段、单位、Schema、SHA-256、JSON Pointer 和原始记录。可视化只能解释后端已报告事实，不能成为第二套模拟或归因引擎。

## 当前耦合

- `model/visualizations.ts` 仍同时处理 S0-S7 图型选择、展示级聚合、缺失降级和部分文案，是后续加图时最明显的内部热点。
- `ExecutionView.vue` 已把普通语言环节名称、摘要、说明和指标标签迁到 `execution-inspector/presentation.ts`，但页面仍负责状态、导出和多个详情区编排。
- `DesignSpaceView.vue` 与 `f7-analysis/model.ts` 较大；候选详情模板和正式 contract validation 不应在同一批次一起移动。
- 样式耦合高于运行时依赖耦合：`execution.css`、`design-space.css` 和 `analysis.css` 各自承载多个组件域，且由 `main.css` 全局载入。
- 交互图表与结构化报告各有展示判断；新增图型时必须避免图表、表格与导出语义漂移。
- 当前 ECharts 保持按需 `echarts/core`、SVG renderer 与异步 runtime/renderer chunk；新增注册会影响全部图表用户。

本轮已完成 `execution-inspector/presentation.ts` 的纯展示提取，并在独立
`model/analysis-visualizations.ts` 中增加 Metrics 请求延迟、Fabric 域/请求时间构成、正式 Design Space objective 候选和
S0-S6 attribution 图。所有图使用“回答的问题/先看哪里/解释边界/数据与证据”协议、完整等价表格、精确 ps 原值和
当前 run evidence identity；S7-S9 输出记录与 causal ranking 分区。下一批可抽取无状态
`DesignCandidateDetail.vue`，但不得同时重写 F7 model 或更改正式 rank/Pareto 语义。

## 开发阶段

### A. 建立统一阅读协议（已完成第一批）

每张图固定提供四层说明：

1. 这张图回答什么；
2. 第一眼先看哪里；
3. 能得出什么、不能得出什么；
4. 如何查看完整数据与正式证据。

扩展稳定 presentation model，保留 `kind`、`derivation`、`unit`、`sourcePaths`、原始行与缺失原因。普通语言说明不能写入事实模型，也不能生成新的仿真结论。

### B. 五个页面逐页深化

- Metrics：先解释吞吐、TTFT、TPOT、端到端延迟，再用后端报告值比较请求；不发明健康阈值。
- Execution：保持 `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6`，先回答请求走到哪一步，再按需展示 fidelity、S7 时间轴和原始记录。
- Fabric：用构成展示 runtime、queue 和 congestion；热点只能来自后端显式报告，topology join 不可用时失败关闭。
- Design Space：基于正式 objectives 与 Pareto membership 展示候选；不重算 Pareto、dominance、rank 或 promotion reason，始终标记 `execution_scope=S6_only`。
- Attribution：普通用户先看已报告的 S0-S6 贡献；S7/S8/S9 输出记录单独分区，不进入 latency causal ranking。

### C. 跨页面联动

- 共享 request/candidate/subsystem 选择继续使用稳定 ID。
- 图、等价表格和 evidence pointer 使用同一选择与 identity。
- run/backend/schema/artifact SHA 改变时清除或隔离不兼容选择。
- 简单模式只改变 disclosure，不删除证据或正式限制。

### D. 性能与可访问性

- 新增图型前后记录 chart runtime/renderer 体积；继续按需注册，禁止全量 ECharts import。
- 小型比例条与状态矩阵优先使用 HTML/CSS；不要只为“有图”引入新图型。
- 图中限制数量时必须明确说明，等价表格保留完整数据，不静默抽样。
- 验证键盘、axe、深浅色、英文长文本、1440×1000 overflow 和 reduced motion。
- 每张图必须有可访问名称、文本说明和等价表格。

### E. 文档与回归

更新 `EXECUTION_VISUALIZATION_DESIGN.md`、本计划、总开发计划和交接文档。逐图记录数据源、derivation、降级、普通语言阅读提示、证据边界和包体增量。

## 必须保持

- S3/S4/S5 始终并列；S7 是统一执行宿主；S8/S9 不进入 latency causal ranking。
- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 不得相互升级。
- requested fidelity、resolved fidelity 和 execution mode 分开；Analytical/DES 不显示为 Cycle。
- uint64 ps/bytes/count 走无损路径；人类可读换算旁可查看精确原值。
- 真实 0、missing、expected absence、not covered、unsupported schema 和 not applicable 不得混淆。
- Design Space 不在前端重算正式 Pareto、dominance、rank 或 promotion reason。

## 验收

至少覆盖图型选择与降级、0 与 missing、S3/S4/S5 并列 DOM、S7 无损时间、S8/S9 排名隔离、图表与完整字段表一致、Design Space 不重算、证据 identity、双语、键盘、axe、overflow、reduced motion 和异步 chart chunk。运行完整前端门禁；不得部署 5173 或执行 live Provider acceptance。

## 后续任务提示词

```text
请在 D:\tileSim-web 接手 TileSim Web 的可视化深入拓展工作。

开始前完整阅读：

- D:\tileSim-web\AGENTS.md
- D:\tileSim-web\docs\AI_HANDOFF.md
- D:\tileSim\AGENTS.md
- D:\tileSim-web\docs\EXECUTION_VISUALIZATION_DESIGN.md
- D:\tileSim-web\docs\FRONTEND_DEVELOPMENT_PLAN.md
- D:\tileSim-web\docs\FRONTEND_VISUAL_REFINEMENT_PLAN.md
- D:\tileSim-web\docs\PARALLEL_FRONTEND_WORKSTREAMS.md

先执行 git status --short 并保护全部改动。使用独立 worktree/分支；不得 reset、clean、覆盖、回滚、擅自提交或推送。不要停止、重启或部署 127.0.0.1:5173；页面验证使用 Playwright fixture 或临时 4173。

你的所有权范围：src/features/execution-inspector/**，Execution/Metrics/Fabric/DesignSpace/Attribution 的可视化专用纯展示组件、对应分域样式、unit/component/Playwright 测试以及可视化文档。新英文文案只写 src/i18n/workstreams/visualization.ts。

不要修改 Evidence Agent submission/store/contract/provider 逻辑、src/features/guided-help/**、共享 english-catalog.ts、Bridge、Schema、OpenAPI、canonical digest 或 dashboard compatibility controller 的状态所有权。若必须改共享页面，只做登记过的最小接入并在报告中列出冲突风险。

目标是让普通用户先理解“这张图回答什么、先看哪里、下一步做什么”，专业用户仍能核对完整字段、单位、Schema、SHA-256、JSON Pointer 和原始记录。复用现有 `analysis-visualizations.ts` 与“回答的问题 / 先看哪里 / 解释边界 / 数据与证据”协议，不创建第二套图表模型；继续深化跨页选择、Design Candidate 纯展示边界、图表/导出一致性和性能。普通语言说明只能是 presentation，不能写入事实模型。

必须保持：

1. canonical flow 只能显示为 S0 -> S1 -> S2 -> {S3,S4,S5} -> S6。
2. S3/S4/S5 始终并列；S7 是执行宿主；S8/S9 不进入 latency causal ranking。
3. provenance source mode 不得升级；requested fidelity、resolved fidelity、execution mode 分开；Analytical/DES 不得显示成 Cycle。
4. uint64 ps/bytes/count 无损；0、missing、expected absence、not covered、unsupported schema 和 not applicable 分开。
5. 前端只展示、索引、排序、分组和做可追溯显示换算，不重算模拟指标、不补造因果。
6. Design Space 不重算 Pareto、dominance、rank 或 promotion reason，保持 execution_scope=S6_only。
7. 每张图都有等价字段表、来源、derivation、单位、缺失/降级原因和证据入口；限制条目时明确说明且完整表格不截断。

分阶段工作。现有请求延迟、Fabric 构成、formal-objective candidate 和 S0-S6 attribution 图是基线，不要重复实现：

- Metrics：通俗解释吞吐/TTFT/TPOT/端到端并比较后端报告值，不发明阈值。
- Execution：强化“请求走到哪一步”，保留并列资源语义和 S7 host。
- Fabric：解释 runtime/queue/congestion，禁止猜测 topology join。
- Design Space：基于正式 objectives/Pareto membership 展示候选，点选后定位正式 artifact record。
- Attribution：S0-S6 causal ranking 与 S7/S8/S9 输出记录视觉分区。
- 跨页保持 request/candidate/subsystem 稳定 ID、evidence identity 和 stale 隔离。

新增图型前后记录 ECharts runtime/renderer 体积；继续使用 echarts/core 和按需注册，禁止 import * as echarts。小型图优先 HTML/CSS。验证 SVG/DOM 密度、主题重绘、ResizeObserver、键盘、axe、中英文、深浅色、长 ID、1440×1000 overflow 和 reduced motion。

至少补齐图型选择/降级、0 与 missing、S3/S4/S5 并列 DOM、S7 无损时间、S8/S9 排名隔离、图表/完整表格一致、Design Space 不重算、evidence identity、异步 chart chunk 和无全量 ECharts import 测试。

完成后运行 pnpm contracts:check、pnpm deps:check、pnpm typecheck、pnpm test、pnpm lint、pnpm format:check、pnpm build、pnpm test:e2e 和 git diff --check。不要执行 live Provider acceptance，不要部署 5173。

最终报告说明新增/调整图表、每张图的问题/来源/derivation/降级、普通用户路径、S0-S9 与证据边界、ECharts chunk 前后体积、无损整数/等价表格/可访问性结果、全部测试、共享文件和未闭合 blocker。
```
