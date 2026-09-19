# TileSim 轻量工作台页面优化正式方案

**状态**：P0/P1/P2/P3 已完成；L6R 发布前复验通过（Provider/live/calibration/held-out 仍未执行）  
**日期**：2026-09-16  
**范围**：电脑网页端；仅涉及 TileSim Web 轻量工作台的页面结构、信息层级、可用性与回归验收。

> **实施修订（2026-09-16）**：任务与学习不再作为轻量工作台主导航板块。`/lightweight/tasks`
> 和 `/lightweight/learn` 保留为兼容 URL，并分别重定向到新建实验和开始页；主流程只保留“开始 / 新建实验 /
> 结果”。字段解释、教程和证据边界统一由右上角“页面帮助”承载，且帮助主题按专业版/轻量版 workspace
> scope 完全分域。专业版现有同一个 `TileSim 助手` 由应用根层复用于轻量工作台，保持同一面板、会话输入和
> typed context；助手只能解释或生成本地草案，不写入表单、不创建 run、不调用 Provider。

## 1. 历史问题与修复结论

历史审查确认轻量工作台的主要问题不是颜色或装饰，而是信息架构没有真正落地：当时
`/lightweight`、`/lightweight/tasks`、`/lightweight/learn` 都指向 `LightweightWorkbenchView.vue`，
且视图没有根据 `route.name` 分发内容，因此三个页面实际显示同一套首页内容。该问题已由本轮
路由重定向、页面帮助收敛和轻量主流程修复；以下目标与验收条目保留为修复依据。

这与产品基线不一致。轻量版必须是可运行的简化工作台，而不是学习中心；当前正式页面职责由“开始”“新建实验”“结果”分别承担，任务与学习仅保留兼容重定向和页面帮助承载能力。

本方案采用“先修复页面职责，再统一视觉层级，最后补齐回归门禁”的顺序，不复制 Bridge、request builder、validator 或 report adapter。

## 2. 当前审查证据

### 2.1 路由与页面职责（历史问题与当前实现）

以下表格记录历史问题修复后的当前路由配置：

| 路由                       | 当前实现                       | 应有职责                                     |
| -------------------------- | ------------------------------ | -------------------------------------------- |
| `/lightweight`             | `LightweightWorkbenchView.vue` | 开始/继续实验、最近 run、结果摘要            |
| `/lightweight/tasks`       | 兼容重定向                     | 重定向到新建实验；不再作为主导航板块         |
| `/lightweight/learn`       | 兼容重定向                     | 重定向到开始页；说明内容由右上角页面帮助承载 |
| `/lightweight/prepare`     | `LightweightPrepareView.vue`   | 配置、校验、正式提交                         |
| `/lightweight/runs/:runId` | `LightweightRunView.vue`       | 后端真实运行状态与恢复                       |
| `/lightweight/results`     | `LightweightResultsView.vue`   | 真实报告摘要与必要图表                       |

历史审查曾发现 `/lightweight`、`/lightweight/tasks`、`/lightweight/learn` 共享同一首页视图，且任务/学习内容与主流程脱节。该问题已在本轮修复：任务和学习 URL 现在仅作兼容重定向，场景选择由配置入口承载，概念说明由轻量 workspace 的页面帮助承载；它们不再作为独立主导航页面或工作台前置门槛。

### 2.2 已确认的视觉问题（修复前基线）

- 首页、任务页、学习页内容重复，用户无法建立页面心智模型。
- 首页空状态与主 CTA 层级过于接近，容易出现两个同权重“创建”动作。
- 辅助入口（Agent、专业版、页面帮助）与主流程距离不足，视觉上仍像并列功能。
- 配置页内容较长，确认与提交动作在滚动后不易持续发现。
- 页面存在较多 panel/card 边界，信息密度与阅读节奏不稳定。
- 页面已具备真实状态语义，但状态、元信息和下一步动作还需要更稳定的结构化呈现。

### 2.3 不属于本方案的问题

- 不修改 canonical experiment/run/report contract。
- 不调用 Provider，不部署或重启 `127.0.0.1:5173`。
- 不创建生产正式 run。
- 不为移动端扩展实现；窄桌面仅做不溢出和可操作性验证。
- 不把 fixture 结果升级为 live、calibration 或 held-out 证据。

## 3. 目标信息架构

### 3.1 开始 `/lightweight`

首屏唯一主任务是“开始或继续实验”。

建议顺序：

1. 页面标题与一句用途说明；
2. 主行动区：新建实验或继续当前实验；
3. 最近活动：最近 run 的状态、run ID、requested fidelity、更新时间；
4. 结果摘要：仅在有合法报告时展示；
5. 辅助入口：右上角页面帮助、共享 TileSim 助手、进入专业版。

空状态只显示创建实验引导，不显示空的结果图表或等权学习卡片。

### 3.2 任务与学习（兼容 URL，不是主导航）

任务与学习页的历史职责已收敛为兼容入口：`/lightweight/tasks` 只保留合法工作台 query
并重定向到 `/lightweight/prepare`，`/lightweight/learn` 只保留合法 query 并重定向到
`/lightweight`。任务选择由配置入口承载，输入来源、fidelity、provenance、artifact、schema
revision、状态和 synthetic/compatibility 边界说明由轻量 workspace 的右上角页面帮助承载。
两条兼容 URL 都不创建 run、不显示伪 KPI，也不构成运行前置学习门槛；正式 run 仍只能在配置页
校验通过后提交。

## 4. 视觉与布局方案

### 4.1 统一页面骨架

保留现有 TileSim token，不新增视觉系统：

- 内容最大宽度：`960–1080px`；
- 页面区块间距：`24–32px`；
- panel 内间距：`16–24px`；
- 主内容与辅助内容之间使用明确分隔线或空间分组；
- 减少嵌套 panel、重复边框和过度圆角；
- 不使用渐变、玻璃拟态、发光或装饰性 KPI；
- 状态颜色必须配合文字与结构，不得单独依赖颜色。

### 4.2 首页层级

- “新建实验”保留唯一 primary CTA；
- 空状态中的创建动作使用 secondary CTA；
- Agent 和专业版入口移到辅助区；学习内容统一收敛到轻量页面帮助；
- 最近 run 使用紧凑列表或单一活动 panel，不与主行动区等权；
- 没有真实结果时使用受控空状态，不绘制装饰性图表。

### 4.3 配置页层级

页面按以下分组：

1. 实验身份：名称、场景、requested fidelity；
2. 输入与来源：输入模式、trace 来源、available/unavailable 原因；
3. 常用参数：只展示当前 capability 允许的字段；
4. 高级设置：默认折叠，提供进入专业版入口；
5. 确认提交：canonical request 状态、来源、fidelity、不可用项和副作用说明。

桌面端确认提交区使用 sticky 定位，保持校验状态和提交动作可见；窄桌面下恢复普通流布局，避免遮挡字段。

### 4.4 运行页层级

采用“状态头部 → 下一步 → 运行元信息 → 阶段列表”的顺序：

- 状态头部只突出当前状态和失败/不可用原因；
- 下一步动作放在首屏：查看结果、进入专业版、返回工作台；
- run ID、backend identity、schema revision、artifact SHA-256、requested/resolved fidelity 使用稳定元信息区；
- 不显示没有后端证据的百分比或剩余时间。

### 4.5 结果页层级

采用“结论 → 证据 → 细节”：

1. 结果完整性和状态；
2. 真实关键指标；
3. 有分析目的的图表；
4. 来源、fidelity、provenance 和缺失字段；
5. 进入专业版。

每个指标保留字段路径、单位、来源和数据状态。`0` 必须显示为 0，missing 不得转换为 0；没有字段时不生成装饰性图表。

## 5. 技术改造方案

### 5.1 路由分发

当前采用轻量公共壳 + 正式运行页面视图：

- `LightweightWorkbenchView.vue`：只负责 `/lightweight` 首页；
- `LightweightTasksView.vue` 与 `LightweightLearnView.vue` 仅作为历史兼容实现保留，不由当前路由装配；
- `/lightweight/tasks`、`/lightweight/learn` 只做 allowlist query 的兼容重定向；
- `LightweightWorkbenchShell.vue`：继续负责导航、主题和模式切换；
- router 将旧名称保留为 redirect，不再提供独立任务/学习主流程。

页面帮助由 `guided-help` 公共基础设施提供；`scope="lightweight"` 与 `scope="professional"` 分别过滤主题、
搜索分组、定位动作和相关页面跳转。两个工作台共享 Agent 外壳，但不共享页面帮助目录。

### 5.2 公共能力边界

- 场景选择只更新轻量 draft/context，不直接触发 `runExperiment.create`；
- 提交继续复用 `src/features/run-experiment/index.ts`；
- 运行状态继续复用 `runExperiment.getStatus`；
- 结果继续复用 `fetchRunEvidence` 与 `normalizeApiReports`；
- 视图不得导入 `bridgeApi`、内部 feature 文件或复制 validator/request builder；
- query 保留 `run`、`artifact_sha256`、`schema_set_revision`、`from`；
- backend identity 与 schema-set revision 继续进入 run-bound 查询上下文。

### 5.3 状态与恢复

- 场景选择、草稿和已提交 run 分开存储；
- 刷新合法 run URL 时按 run ID 恢复，不根据页面计时器猜测状态；
- 模式切换不得清除 run、artifact、schema 或 backend identity；
- 失败、unavailable、incomplete、stale 和 unsupported 使用统一的状态 view model；
- Agent 状态仍只允许 draft/explain/check capability，不得调用正式 run 创建。

## 6. 测试补强方案

### 6.1 单元测试

新增或更新：

- 三个页面的标题、主 CTA 和核心区域互不重复；
- 旧 tasks/learn URL 只验证 allowlist query 重定向，不再渲染任务卡或学习卡；
- 轻量页面帮助包含状态、fidelity、provenance、missing 和 trace 边界说明，并与专业版 topic 分域；
- 首页没有实验时只有一个 primary CTA；
- 配置页 sticky 提交区在桌面启用、窄桌面关闭；
- 页面不直接调用 `bridgeApi`；
- 页面不包含前端进度伪造、不把 missing 转成 0。

### 6.2 桌面 E2E

至少覆盖：

1. `/lightweight`、`/lightweight/prepare`、`/lightweight/results` 内容和标题不同；并验证 `/lightweight/tasks`、
   `/lightweight/learn` 兼容重定向及 query allowlist；
2. 兼容 tasks/learn URL → 对应正式开始/配置页面；
3. 首页 → prepare → 校验 → mock run → 状态 → 结果；
4. failed、unavailable、incomplete、stale；
5. 重复提交复用 idempotency key；
6. 刷新运行页按合法 run ID 恢复；
7. 结果页 → 专业版 → 返回轻量版，query 上下文保留；
8. 1440px、1024px、800px 和 200% 等效缩放；
9. light/dark、reduced-motion、键盘焦点和无横向滚动。

fixture 只证明 UI、路由、状态机和契约映射，不得作为 live/calibration/held-out 证据。

## 7. 实施顺序

### P0：修复页面职责

- 将 tasks/learn 收敛为兼容重定向，不再作为主流程视图；
- 从轻量主流程移除任务卡和学习卡，保留页面帮助入口；
- 增加页面差异化单测和路由 E2E；
- 删除或改写将整个轻量版描述为只读的主流程文案。

**完成记录（2026-09-14—2026-09-16）**：主导航已收敛为开始、新建实验和结果；旧任务/学习 URL 改为兼容重定向，页面帮助迁移到右上角并完成专业/轻量分域。L6 fixture 闭环用例已恢复执行，并通过正式提交、状态推进、刷新恢复、真实 artifact 校验、合法 0/missing、失败 run 与专业版往返。共享 TileSim 助手已接入轻量配置页，并验证跨工作台保留面板输入、旧 context 标记 stale。

### P1：统一主流程层级

- 首页主 CTA、空状态、辅助入口重排；
- 配置页分段与 sticky 确认提交区；
- 运行页状态头部和元信息区压缩；
- 结果页指标/图表/证据顺序统一。

**完成记录（2026-09-14）**：运行页已收敛为“状态头部 → 下一步动作 → 运行元信息”的首屏结构，补充后端状态说明、轮询终止提示、artifact SHA-256 与 schema revision；失败、不可用和不完整状态均提供重新配置出口。结果页已按“结论 → 证据 → 细节”重排，来源、数据通道、resolved fidelity 与证据层级独立展示，图表标题标注单位与字段来源，manifest 完整性和 artifact 身份集中在证据索引区。

### P2：状态与边界回归

- 统一状态 view model；
- 补齐 stale、unsupported、incomplete、missing 和 0 值回归；
- 修复 mock Bridge bootstrap，使 L6 闭环 E2E 不再因初始化契约缺失而 skipped。

**补强记录（2026-09-14）**：结果状态 view model 现在显式区分 `available`、`missing`、`unsupported_schema`、`incomplete`、`failed` 与 `unavailable`；拒绝 artifact 时不再将结果标记为可用。新增页面契约回归，锁定运行页的恢复元信息、终态轮询和重新配置动作，以及结果页的 provenance、resolved fidelity、0/missing 与无字段不生成装饰性图表语义。

**当前状态**：mock Bridge bootstrap 已补齐 manifest、artifact 与真实 fixture 文件映射；run-bound
页面还会等待共享 manifest bootstrap 完成后才读取 status/evidence，bootstrap 不可用时 fail closed。
L6 相关桌面用例、拓扑 pointer E2E 与全量前端/Bridge/构建门禁均已复跑通过。live deployment/Provider
相关 6 项仍保持 skipped，不构成 live/calibration/held-out 证据。

### P3：发布前验证

- 运行完整 frontend、Bridge、fixture E2E、typecheck、lint、format、build 和 docs 门禁；
- 单独列出 live/Provider/calibration/held-out skipped；
- 用户授权后再考虑部署 5173。

**本轮验收记录（2026-09-16）**：frontend 全量 `pnpm test` 通过（639 passed，8 skipped），Bridge `test_server.py` 通过（91 tests），完整桌面 fixture E2E 通过（63 passed，6 skipped）。另有轻量 L5/L6 与拓扑专项 11/11 passed。skipped 项均为 live deployment / Provider 能力相关测试，未计入 fixture 通过数；未执行 Provider、live、calibration 或 held-out 证据验收。首页教程式副文案已移除，保留状态、证据和可执行动作；run/results 深链先等待共享 manifest/schema bootstrap，失败时 fail closed；新增导航竞态回归，确保被新路由取代的 run 恢复不会遗留全局 busy 状态。

## 8. 验收标准

### 功能

- 开始、新建实验和结果三个正式页面的内容、标题、主 CTA 和页面目标不同；任务/学习旧 URL 只兼容重定向；
- 用户无需进入学习页即可创建和提交正式 run；
- 旧任务 URL 兼容重定向到真实配置流程；
- 轻量页面帮助不混入专业版主题；共享 Agent 不创建 run 或改变实验表单；
- 模式切换与刷新恢复不丢失合法上下文。

### 视觉与可用性

- 首页首屏只有一个 primary CTA；
- 配置页滚动时提交动作仍可发现；
- 运行页首屏能看懂当前状态和下一步；
- 结果页能区分 0、missing、not covered、unsupported、stale；
- 1440px、1024px、800px 桌面宽度无横向滚动；
- 200% 等效缩放下核心流程仍可操作；
- 键盘焦点可见，reduced-motion 正常，light/dark 主题可读。

### 证据与安全

- 不新增前端模拟指标或伪造进度；
- 不升级 synthetic/compatibility 到 real/calibrated/held-out；
- 不调用 Provider，不读取 credential，不创建生产 run；
- 不改动专业版既有路由和 run 语义。

## 9. 风险与回滚

| 风险                                | 预防                                           | 回滚方式                                |
| ----------------------------------- | ---------------------------------------------- | --------------------------------------- |
| 拆分视图导致 query 丢失             | 复用 `preserveWorkbenchQuery`，增加路由回归    | 恢复为公共容器并保留显式 route 分支     |
| 场景选择改变 canonical payload      | 场景选择只更新 draft/context，不直接写 request | 删除隐式预填，仅保留显式配置            |
| sticky 提交区遮挡内容               | 桌面启用、窄桌面关闭，并做首屏截图检查         | 移除 sticky，保留普通底部操作区         |
| 文案误把 Agent 边界扩大为工作台只读 | 主流程文案与 Agent 文案分离                    | 以产品基线文案替换主流程 copy           |
| fixture bootstrap 不完整            | 共享完整 manifest fixture，先跑独立 L6 E2E     | 保持 skipped 并在报告中单列，不误报通过 |

## 10. 交付报告要求

实施完成后报告必须包含：

1. 修改文件及职责；
2. 三个页面职责是否已分离；
3. 新建实验闭环结果；
4. idempotency、刷新恢复和模式切换结果；
5. 视觉、无障碍、窄桌面和主题检查结果；
6. 全部门禁及 skipped 项；
7. fixture/live/calibration/held-out 证据边界；
8. 尚未支持的高级能力；
9. 是否操作 5173、Provider、credential、正式 run、commit、push。
