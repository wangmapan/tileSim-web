# TileSim Web 第二批优化：运行记录与 Trace package

日期：2026-09-07。本文记录前端展示和交互维护，不重新定义平台架构、仿真能力或证据范围。

## 1. 边界与基线

- 仅修改 `D:\tileSim-web`；未修改后端仓库、Bridge 实现、接口契约、部署和启动脚本，也未提交或切换分支。
- 本地 `main` 与已跟踪的 `origin/main` 指向 `a0d57c8785ff6dad2c0aa9d7110092dbcf50ad7f`。保留首批视觉改动、启动器及其他文档工作；修改前检查相关 diff。未执行 reset、clean 或覆盖式 checkout。
- 5173 是已启动的用户服务；本批使用独立 4173 源码预览，代理到既有后端，不替换不可变发布快照。
- 复核前端启动卡、交接、README、首批审查、既有视觉计划以及涉及的代码和测试。现行中文术语以用户提供的平台规则为准，协议中的旧编号不改写。
- WSL 已恢复；以 root 检查确认 Ubuntu-24.04 中 `/root/.codex/AGENTS.md` 不存在，无法读取该路径的全局文档约定。
- 本批修改前保存 12 张夹具基线：运行记录、Trace package 两种场景，各覆盖 1100、1440、1920px 和浅／深色。夹具名称明确标注测试性质，不是新建真实仿真数据。

## 2. 分级审查与处理

| 优先级 | 问题                                                                 | 本批处理                                                                                |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P0     | 未确认新的指标或证据语义错误                                         | 原始数值、缺失值、来源和证据边界不变                                                    |
| P1     | 运行记录刷新未传 `refresh: true`，可能直接复用 10 秒缓存             | 显式刷新失效缓存，测试连续点击确实重新请求                                              |
| P1     | 首次加载缺少内容反馈，断连与真正无运行混用空状态，失败仅有短暂通知   | 增加加载文本、`aria-busy`、持久错误提示；区分断连、空目录、筛选无结果；失败保留先前记录 |
| P1     | Trace package 按钮被 `role=listitem` 覆盖，选中状态不可访问          | 使用原生 `ul/li/button`，增加 `aria-pressed`，保留不可提交包的可检查性                  |
| P1     | 双主题回归确认运行记录对比按钮使用浏览器默认灰底，深色文字对比度不足 | 使用既有 secondary 按钮变体，不调整全局色板或放宽 axe 断言                              |
| P2     | 长运行 ID 与时间共享截断行，指标标题逐行重复                         | 原生数据表与统一单位表头；完整 ID 换行，时间独立展示，指标右对齐                        |
| P2     | 运行记录按条目执行入场动画和悬停横移；全部记录进入 DOM               | 去位移动效，前端每页最多渲染 25 行；仍对全部已加载记录筛选                              |
| P2     | Trace 身份、校准和允许结论范围混排在嵌套卡片；SHA 行留下空白格       | 目录改为分隔列表；先展示来源与证据边界，再展示身份和完整 SHA；移除详情内层卡片          |
| P2     | 实验确认区与侧栏均为无名称的 complementary landmark                  | 为现有确认区补可访问名称；全页 axe 检查通过                                             |

分页只限制已加载数组的 DOM 展示，不改变服务器列表 API、顺序或两次运行对比规则，不宣称实现服务端分页。

## 3. 调研依据与视觉方案

沿用 `FRONTEND_VISUAL_AUDIT_2026-09-06.md` 中已记录的 14 个官方参考，完整来源、借鉴点和不照搬范围见该报告。本批未重新取得完整在线参考内容，不把补充检索尝试计作新的调研成果。

本批具体采用：

- [GitHub Primer](https://primer.style/)：复用语义 token、稳定控件和数据列表的对齐纪律；不复制仓库导航或品牌图形。
- [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)：减少容器装饰，将列表内容置于前景；不引入 issue 管理业务。
- [Stripe Dashboard basics](https://docs.stripe.com/dashboard/basics)：将可操作目录与结果详情分工；不引入财务卡片或营销统计。
- [Datadog Trace view](https://docs.datadoghq.com/tracing/trace_explorer/trace_view/)：分开身份、来源和证据详情；不把 Trace 包完整性解释为真实验证。

这些来源仅用于设计原则参考，未取得图片或品牌资产的再分发许可，也未使用这些资产。实现继续采用已有 Lucide、HTML 与 CSS，无新字体、图片、渐变、装饰网格、运行时依赖或背景动画。

## 4. 修改清单与兼容性

| 文件                                                                         | 变更                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/views/HistoryView.vue`                                                  | 状态分流、表格、搜索名称、强制刷新、25 行分页和选择状态            |
| `src/styles/history.css`                                                     | 中性表头、长 ID、数字对齐、键盘焦点、错误条；移除逐行位移          |
| `src/entities/dashboard/types.ts`、`src/stores/history.ts`                   | 增加前端临时 `history.error`                                       |
| `src/store/dashboard-runs.ts`                                                | 记录失败原因，重试清除错误；保留原有 toast 与缓存查询路径          |
| `src/features/run-experiment/TracePackageInputPanel.vue`                     | 原生选择控件、证据优先层级、身份字段和已报告语义角色               |
| `src/features/run-experiment/ExperimentSubmitCard.vue`                       | 为既有确认区命名，不改提交行为                                     |
| `src/styles/experiment.css`                                                  | 目录列表、证据分区、完整 SHA 和轻量状态提示；保留首批修改          |
| `src/i18n/workstreams/workflow-review.ts`、`src/i18n/workstream-catalogs.ts` | 独立维护新增英文文案，复用已有来源／校准翻译                       |
| `tests/components/history-workflow.test.js`                                  | 加载、断连、空状态、错误保留、真实刷新、分页、零与缺失值、英语     |
| `tests/components/trace-package-input.test.ts`                               | 按钮语义、选中状态、部分角色、完整性失败、证据边界和英语           |
| `tests/unit/i18n-model-coverage.test.js`                                     | 新目录纳入翻译键唯一所有权检查                                     |
| `tests/e2e/dashboard.spec.js`                                                | 桌面截图矩阵、全页 axe、错误重试、双主题英文键盘回归；保留既有断言 |

六种语义角色仅显示服务端 `semantic_roles` 已报告项，保留后端顺序；不补齐缺失角色。`complete`、SHA 校验、entry 校验、`source_mode`、`calibration_level`、`allowed_claim_scope` 与提交限制均保持原值。新增文字只明确“完整性检查不代表校准或验证通过”。

## 5. 验证

| 门禁                                                              | 结果                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm contracts:check`                                            | 通过，契约生成物无漂移；保留既有 schema date-time 格式提示                      |
| `pnpm deps:check`                                                 | 通过                                                                            |
| `pnpm typecheck`、`pnpm lint`                                     | 通过                                                                            |
| `pnpm test`                                                       | 47 个文件，284 个单元／组件测试通过；包含既有异步图表卸载保护回归               |
| `pnpm test:e2e`                                                   | 35 通过、5 个既有 live 用例跳过；未更新任何视觉快照或放宽误差                   |
| `pnpm format:check`                                               | 全仓通过；未格式化其他人的文档                                                  |
| `pnpm build`、`git diff --check`                                  | 通过；保留既有大入口 chunk 警告                                                 |
| WSL Bridge Python 编译检查与 `python3 -m unittest test_server.py` | 77 个测试通过；临时目录／测试服务，不修改用户的 5173                            |
| 双主题与桌面宽度                                                  | 本批前后各 12 张截图；修改后矩阵通过页面溢出与 axe 检查，另有英文双主题键盘检查 |

真实连接只读复核：4173 读取到既有 10 次运行；成功打开 `run-20260904-124802-ab027472` 的总览，保留探索性结果提示。真实目录返回 `synthetic-s1-demo`，展示 `synthetic_trace / uncalibrated / exploratory` 及六项已报告角色。未提交新真实实验、重命名既有运行或调用真实模型。

结束前 5173 健康检查仍为 `execution_ready=true`、`versions_match=true`、`state_digests_match=true`，源码与 CLI revision 都为 `09c22c0efff890253a1eacf403c2979f56fd9ba6`。以上只证明连接和展示工作正常，不代表新的 live 执行验收、真实校准或留出验证。

## 6. 性能与构建体积

以下为本机 Vite 输出的 kB（gzip），与上一批最终构建日志比较：

| 产物           | 修改前           | 修改后           |
| -------------- | ---------------- | ---------------- |
| 主入口         | 845.90（190.93） | 847.51（191.59） |
| CSS            | 153.27（25.76）  | 155.43（26.30）  |
| HistoryView    | 14.39（5.37）    | 17.39（6.30）    |
| ExperimentView | 54.96（16.93）   | 56.22（17.29）   |
| ExecutionChart | 4.97（2.34）     | 4.97（2.34）     |
| chart-runtime  | 346.65（118.84） | 346.65（118.84） |
| chart-renderer | 182.65（61.80）  | 182.65（61.80）  |

主入口 gzip 增加约 0.66 kB，CSS 增加约 0.54 kB，主要是状态文案与样式。两个页面仍按路由加载；未新增 chunk、图表实例、定时器、轮询或背景效果。历史列表 DOM 上限为 25 行，筛选仍针对已加载数组。本批没有新增基于大数据的运行时性能测量，不能把 DOM 限制等同于整体吞吐或内存基准提升。

## 7. 截图、差异与后续

本地交付物均在 Git 忽略的 `runtime/` 下，不提交成批截图：

- `runtime/visual-review/batch2/before/`、`after/`：前后原图。
- `runtime/visual-review/batch2/history-light-comparison.png`、`history-dark-comparison.png`：运行记录对照。
- `runtime/visual-review/batch2/trace-light-comparison.png`、`trace-dark-comparison.png`：Trace 详情对照。
- `runtime/visual-batch2-*.log`：验证日志；`runtime/visual-batch2-working-diff-before.patch`：开始时的工作树 diff。
- `runtime/visual-review/batch2/batch2-only.patch`：本批相对开始时工作树的增量 diff，不包含首批修改、后端或其他既有工作；用于审阅，不应重复应用到当前已修改工作树。

后续优先项：

1. 5173 仍是既有发布快照。本批没有部署；应在明确发布授权后走原有发布门禁。
2. 统一旧编号的中文显示映射，保留次级技术标识，不重命名接口或私有设计对象。
3. 在真实字段足够时优化网络热点、等待与执行窗口联动，不能补造路径或反压因果。
4. Trace 目录仍一次性显示全部已发现包；大目录的服务端分页／渐进加载与首屏大 chunk 另行评估，不扩大本批契约范围。
5. Evidence Agent 的真实模型评测及校准／留出验证仍属于独立未闭合工作。

AI 生成感复核：本批删除同质包卡片、详情套卡片、选择光圈和列表位移。新增元素均表达真实身份、证据边界、加载失败或操作状态；没有虚假趋势、营销文案或装饰性技术图形。浅／深色布局一致，长标识与英文文本不依赖省略重要字段取得整齐。
