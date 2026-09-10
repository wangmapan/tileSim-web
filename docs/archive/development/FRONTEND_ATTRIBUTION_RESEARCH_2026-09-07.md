# TileSim Web 第四批：联网素材调研与归因工作区优化

日期：2026-09-07。本批从官方页面重新联网收集设计依据，并落实到归因工作区，不是复述前三批参考清单。本文只记录前端维护，不改变仿真架构、精度定义或证据边界。

## 1. 工作边界与基线

- 仅修改 `D:\tileSim-web`；后端、Bridge 实现、接口契约和部署／启动脚本不变。未提交、暂存、reset、clean 或切换分支。
- 先阅读启动卡、交接、README、执行可视化设计及相关代码／测试，检查已有 diff。用户的现行中文术语优先于前端启动卡中的旧编号约定。
- 本地 `main` 与已跟踪的 `origin/main` 为 `a0d57c8785ff6dad2c0aa9d7110092dbcf50ad7f`，ahead／behind 为 0／0；未将其表述成重新 fetch 的远程事实。
- 修改前保存完整 dirty-tree diff 和状态清单：`runtime/visual-batch4-working-diff-before.patch`、`runtime/visual-batch4-status-before.txt`。前三批及其他工作流的未提交修改保留。
- 4173 为源码预览，5173 仍是用户已有服务；本批不重启、不替换后端或发布快照。
- 先建立归因页夹具截图基线：1100、1440、1920px，浅／深色，审计与原因链关闭／展开，合计 12 张。夹具只用于隔离浏览器测试，不写入真实实验目录。

## 2. 本次联网参考与素材记录

通用搜索工具本轮未返回可读取的结果，因此改用直接 HTTPS 读取官方文档并用浏览器查看页面。以下 10 个来源均在本次任务中成功获取实质内容；记录保存在 `runtime/visual-batch4-research.json`。Linear、Primer、Grafana 另有浏览器渲染截图供本地审查。

日期说明：Linear 参考文章发布于 2024-03-28，这里借鉴的是其设计方法，不声称该图就是 2026 年最新版界面。带 `latest` 的官方文档地址仅表示本次访问地址。

| 官方来源                                                                                                                    | 具体可借鉴设计                                               | 适合 TileSim 的原因与本批取舍                                          | 不照搬部分                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)                                                | 降低侧栏、标题和面板噪声，校正层级、对齐与密度；控制改版范围 | 将归因对象前置，用中性背景与分隔线替代大渐变；保留原有业务入口         | 不复制侧栏、品牌配色、倾斜产品宣传图或问题管理流程              |
| [GitHub Primer DataTable](https://primer.style/product/components/data-table/)                                              | 每行实体、每列属性，明确列宽、对齐、行标题和分页             | 贡献项有排名、说明、份额、精确 ps 与证据，适合原生数据表而非重复图卡   | 不引入 React 组件；不自动排序或改变后端排名；不照搬仓库业务字段 |
| [NVIDIA Nsight Systems User Guide](https://docs.nvidia.com/nsight-systems/UserGuide/index.html)                             | 围绕实际资源命名、局部范围和性能相关内容组织分析             | 先明确归因对象，再阅读已有时间／分数与局部证据；不增加无数据的视图     | 不把仿真分数画成 GPU 实测 Timeline，也不暗示 Cycle 校验成立     |
| [Grafana Bar gauge](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/bar-gauge/) | 条长对应数值，范围可明确设置；说明数据变换与显示配置         | 份额已有固定语义，明确 0–100% 范围，零值为零长度；异常保留原文且不绘条 | 不使用自动 min/max 拉伸、不新增聚合、仪表盘卡片或告警阈值       |
| [Weights & Biases Workspaces](https://docs.wandb.ai/models/track/workspaces)                                                | 数据表、面板与分区各司其职；支持从概览进入配置和明细         | 图表回答整体贡献，表格负责逐项证据，审计与原因记录按需展开             | 不创建假运行、自动生成大量图表、保存视图或实验管理新能力        |
| [Ray Dashboard](https://docs.ray.io/en/latest/ray-observability/getting-started.html)                                       | 运行列表通过稳定 ID 进入详情，任务／资源／分析入口区分       | 归因对象、贡献项与证据入口保持实体身份；不把所有百分比做成运行状态     | 不把任务状态等同于硬件占用，不照搬集群管理功能                  |
| [Jaeger Frontend UI](https://www.jaegertracing.io/docs/2.10/deployment/frontend-ui/)                                        | 元信息中的可配置深链、查询范围与依赖视图上限                 | 保留原始 artifact、SHA 与 Pointer；控制可见记录数而非渲染所有详情      | 不把 cause_chain 重建为 span 父子树；不添加推断出的 DAG         |
| [Stripe Dashboard basics](https://docs.stripe.com/dashboard/basics)                                                         | 总体信息与可操作列表分工，点击实体查看详情                   | 将摘要与证据明细分开，使用稳定行操作，减少同质指标卡                   | 不复制财务指标、营销型总览或品牌渐变                            |
| [Notion Sidebar](https://www.notion.com/help/navigate-with-the-sidebar)                                                     | 分组、显示数量和按需展开帮助组织内容                         | 审计、原因记录可以折叠；摘要边界不能因此藏起来                         | 不新建嵌套导航、不引入文档树，也不把 Trace 六类包改成页面层级   |
| [OpenSearch Trace analytics](https://docs.opensearch.org/latest/observing-your-data/trace/ta-dashboards/)                   | trace 概览、表格／Gantt 与 span 详情分工，按实际实体下钻     | 保留“对象—贡献—精确证据”的阅读路径；有序解释与现实因果证明分开         | 不将服务关联图当硬件拓扑，不用延迟共现推断网络因果              |

另尝试了 Vercel Geist introduction 与 Datadog Trace view：HTTP 返回 200，但本轮文本抽取没有得到足够的可分析段落；不把它们计入上述 10 个完成来源，也不据此声称看过完整产品 UI。

### 素材许可与采用方式

上述每条参考均按同一许可边界记录：仅参考公开说明与设计原则；没有取得图片、品牌标志、字体或完整页面的再分发授权，因此不将其引入产品或版本管理。开源产品不意味着其网站截图与商标可任意再使用。

- 本地研究截图：`runtime/visual-review/batch4/references/linear.png`、`primer.png`、`grafana.png`。这些文件只在 Git 忽略目录，不作为 TileSim 资产发布。
- 实现素材：现有 Lucide 图标、原生 `table/dl/ol/details`、现有中性色／状态 token 和 CSS 份额条。
- 未使用第三方产品代码、图片、位图背景、字体或新增运行时依赖。没有新增装饰性网格、流光、节点、照片或模型生成图片。
- 网络拓扑、Timeline 和 Flame Chart 本次仅研究设计原则，不因参考产品具有这些图形就为 TileSim 补造路径、时间范围或层级关系。

## 3. 分级审查与方案

| 优先级 | 实际问题                                                               | 本批处理                                                                        |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P1     | CSS `order` 把图表排在归因对象前面，视觉顺序与 DOM／键盘阅读顺序不一致 | 按真实 DOM 顺序排列对象、图表、贡献表、审计、原因链和输出记录，删除对应视觉重排 |
| P1     | 份额条最低绘制 1%，零和缺失被画成非零贡献                              | 有效范围内按原值绘制，0 的宽度为 0；缺失无条，越界保留数值并说明不绘条          |
| P1     | 可选审计布尔字段被真假判断归为失败／不完整                             | 区分 true、false 与未报告，不将缺失解释为失败                                   |
| P1     | 展开审计的警示文字使用图形警示色，浅色背景实测对比度约 4.17:1          | 改用已有 `warning-ink` 文本 token，不放宽 axe 检查                              |
| P2     | 大渐变摘要位于图表之后，英文质量字段缺少就近解释                       | 去掉渐变；对象和质量字段前置，增加精确证据入口并说明不是准确率                  |
| P2     | 贡献项使用无列标题的混合行布局；长文本、百分比与 ps 缺少稳定对齐       | 原生数据表、明确字段与单位、正常大小写、长文本换行；窄桌面提供可聚焦水平滚动区  |
| P2     | 原因与审计关闭时仍生成内部 DOM；列表入场与条形填充动画重复             | 详情按需生成；贡献／原因／输出记录复用每页 25 条分页；去掉对应入场和填充动效    |

方案先输出给用户再实施。不调整默认的请求证据链入口，不添加模拟路径，不重新排名，不重算总分或份额，不改变 provenance、校准与允许结论范围。

## 4. 实施文件与验证方式

| 文件                                             | 实施与验证重点                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/views/AttributionView.vue`                  | 对象优先的 DOM 顺序、表格、真实份额、缺失布尔值、证据入口、按需详情与分页；继续使用原始唯一稳定 ID 的证据解析器 |
| `src/styles/analysis.css`                        | 中性摘要、对齐与长字段、静态条、域内滚动焦点、审计文字对比度；保留第三批网络样式                                |
| `src/i18n/workstreams/attribution-review.ts`     | 新增本轮中英文文案，避免扩大旧公共翻译目录                                                                      |
| `src/i18n/workstream-catalogs.ts`                | 注册本轮目录，保留已有目录                                                                                      |
| `src/features/guided-help/guides/attribution.ts` | 同步“尾延迟归因”按钮名称，不改引导锚点                                                                          |
| `tests/components/attribution-review.test.js`    | 0／missing／越界份额、超安全整数原文、原始排名、分页 Pointer、缺失审计、英文与数据替换清理                      |
| `tests/unit/i18n-model-coverage.test.js`         | 翻译键唯一所有权与原有覆盖                                                                                      |
| `tests/e2e/dashboard.spec.js`                    | 双主题三宽度截图、全页 axe、英文键盘分页、精确 SHA／Pointer、普通与 reduced-motion、真实 DOM／布局顺序          |

复用第三批的 `RecordPager` 与 `useRecordPage`，未复制分页逻辑。既有 hash-bound 测试改为先通过键盘展开审计，再执行原来的 `partial_attribution` 与传播缺口断言；未删除或放宽它们。现有四张 golden 快照未更新。

## 5. 验证结果

- `pnpm contracts:check`、`pnpm deps:check`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 与 `git diff --check` 通过。依赖边界检查覆盖 195 个源文件；契约生成物无漂移，保留既有 date-time 格式提示。
- `pnpm test`：49 个文件、291 个测试通过，包含已有异步 ECharts 初始化／卸载保护。
- 浏览器专项：3／3 通过。完整 E2E 最终为 39 通过、5 跳过，见 `runtime/visual-batch4-e2e.log`；跳过项依赖独立部署坐标，不等同于 live 验收通过。
- 完整回归中，未改动的校准工具用例曾因 global-busy 遮罩拦截点击而超时；未调整该用例或相关业务代码，单独复跑 1／1 与整套复跑均通过。保留 `runtime/visual-batch4-e2e-week7-timeout.log` 和 `visual-batch4-week7-recheck.log`，不声称该偶发问题已定位修复。
- `pnpm format:check` 全仓通过；独立增量补丁通过只读反向检查，并确认本批范围外的既有 tracked diff 未变化。
- WSL Bridge Python 编译检查与 unittest：77 个测试通过，使用隔离测试服务，不操作用户的 5173。
- 截图矩阵：前后各 12 张夹具原图，覆盖 1100／1440／1920px 与浅／深色；人工检查摘要层级、数据大小写、表格滚动与展开详情。
- 无障碍回归中修正了新证据链接在定义列表中的位置、标题层级与既有审计文字对比度，保留完整 axe 断言。普通动效模式下证据列表不淡入；reduced-motion 继续生效。

真实连接只读复核：打开既有运行 `run-20260904-124802-ab027472`，归因对象为 `req_prefill_0`，报告置信度 75%、完整度 85%，仍明确这些字段不是准确率。新增对象入口成功定位完整 JSON 的 `/explained_entity` 第 18 行，SHA 为 `adfa8f7a197625cd6e4175d4cbbb185702b46525fcf1a11e2adf16d0e0798f07`。

健康复核：`execution_ready`、`versions_match`、`state_digests_match` 均为 true，后端 revision 仍为 `09c22c0efff890253a1eacf403c2979f56fd9ba6`。没有提交新的真实实验、重命名记录或调用 Provider；这不是新的真实校准或留出验证。

## 6. 性能与构建体积

下表为 Vite 日志中的 kB（gzip），与第三批最终构建对比。

| 产物            | 修改前           | 修改后           |
| --------------- | ---------------- | ---------------- |
| 主入口 JS       | 848.50（191.90） | 850.11（192.45） |
| 主 CSS          | 155.82（26.37）  | 156.86（26.50）  |
| AttributionView | 23.57（7.47）    | 26.75（8.26）    |
| chart-runtime   | 346.65（118.84） | 346.65（118.84） |

主入口 gzip 增加约 0.55 kB，CSS 约 0.13 kB，归因路由约 0.79 kB。没有新增依赖、图表实例、全局监听器、定时器或后台动画，没有新增 chunk 类型；仍保留既有入口大于 500 kB 警告。

分页限制已加载数据的可见 DOM，不是服务端分页，不减少报告传输与完整数组内存。公共图表继续异步加载；本轮未修改 ECharts 实例或数据构建器。完整报告适配与稳定 ID 查找仍处理已加载记录，本批没有修复所有大规模计算复杂度，也没有新增 FPS／内存基准，不能将行数限制夸大为已测得的帧率提升。

## 7. 交付物与后续

- 完整原图：`runtime/visual-review/batch4/before/`、`after/`；真实运行的双主题截图单独放在 `live/`，不与夹具混淆。
- 前后对照：`runtime/visual-review/batch4/attribution-light-comparison.png`、`attribution-dark-comparison.png`，使用相同宽度、相同截取范围并标记测试夹具。
- 本轮独立增量：`runtime/visual-review/batch4/batch4-only.patch`；相对本轮开始时工作树，不包含前三批或其他工作。仅供审阅，不应重复应用到当前工作树。
- 验证与调研记录：`runtime/visual-batch4-*.log`、`visual-batch4-research.json`、`visual-batch4-live.json`。截图、参考页面和研究摘录均在 Git 忽略目录，不进入产品资产。

后续优先项：统一仍存在的旧编号中文显示映射；只有真实字段充分时再推进请求等待与执行窗口联动；独立评估大入口拆分与证据 ID 查找复杂度。5173 保持原部署，本批新界面在 4173 源码预览；发布需单独授权。

AI 生成感复核：删除渐变与无意义动效，不增加同质卡片或装饰关系图。辨识度来自真实归因对象、报告排名、份额、ps 原文、审计边界与证据下钻；去掉所有装饰后，阅读顺序仍成立。
