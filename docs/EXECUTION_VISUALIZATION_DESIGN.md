# 分层结果可视化设计

**范围**：电脑网页端 `ExecutionView`  
**原则**：图表只做可追溯的显示级整理，不生成模拟事实或提升证据等级。

## 1. 图型决策

| 区域              | 表现                     | 选择原因                                   | 降级规则                                 |
| ----------------- | ------------------------ | ------------------------------------------ | ---------------------------------------- |
| S0 provenance     | 字段矩阵                 | 来源、校准和声明范围是分类状态             | 缺字段明确显示“缺失”                     |
| S1 request tokens | 分组水平条形图           | 请求是离散类别，token 是同单位数量         | 无请求时只显示原因                       |
| S2 fidelity       | 字段矩阵                 | requested/resolved fidelity 不是连续分数   | 缺声明时显示“缺失”                       |
| S3 memory         | 水平条形图               | 比较离散 memory event 的延迟               | 无 `memory_latency_us` 时只显示原因      |
| S4 device         | latency–occupancy 散点图 | 两个定量变量的分布关系                     | 少于 3 个完整点时改为 latency 条形图     |
| S5 collective     | 堆叠水平条形图           | 同一 collective 下同单位时间字段的相对构成 | 缺 runtime/queue/congestion 时只显示原因 |
| S6 request fabric | 堆叠水平条形图           | 请求级时间贡献构成                         | 缺请求贡献时不画                         |
| S6 domain         | 利用率水平条形图         | 域是离散类别，条形比饼图易比较近似比例     | 缺 utilization 时不画                    |
| S7 stages         | range bar 时间轴         | start/end 是真实区间                       | 非法、负时长或超安全范围时失败关闭       |

不使用折线图表示无序子系统或请求，不使用饼图表示原因链，不把 fidelity 映射到未经定义的连续数轴，不从散点图推断因果。

F6B run-bound panel 使用节点卡和证据表而不是因果图：S3/S4/S5 固定并列，S7/S8/S9 只表达执行宿主、验证和输出引用，不进入 causal ranking。高密度 EvidenceRef 默认收起，可通过键盘展开；稳定 ID 与 Pointer 文本仍完整保留。

## 2. 证据与换算

每个可视化模型必须包含：`kind`、`rationale`、`sourcePaths`、`derivation`、`unit`、原始表格行和缺失原因。

- `identity`：直接显示报告值。
- `display_group`：按报告 ID 去重或分组。
- `display_sum`：只对同组、同单位的后端字段求展示级合计。
- `unit_conversion`：S7 以最早合法 stage 为零点，将相对 ps 安全换算为 ns；表格保留原始 ps 字符串。
- 真实 `0` 保留为 `0`；missing 使用 `null`，不得转成零。
- 可视化区显式提示 missing、负数量/延迟和超出 `[0, 1]` 的比例；异常值仍保留在字段表中，不静默裁掉。
- 图中最多显示报告顺序前 12 项，字段表保留全部行；结构化记录每次渲染 50 条，可继续加载。

图表下方始终保留类型选择依据、字段表和 JSON 路径。图表是摘要入口，原始 JSON artifact 仍是最终查看面。

字段位置统一写成 `artifact-id:/json/pointer`；包含 `*` 或 `{field,...}` 的位置是多记录字段模式，不冒充单一 evidence pointer。当前精确记录已使用可刷新恢复的 `{runId, artifactId, sha256, pointer}`；聚合来源和通配路径仍只显示字段模式，不伪造单点链接。

## 3. 实现边界

```text
execution-inspector/model/visualizations.ts  报告 -> 可视化模型
execution-inspector/charts/chart-options.ts  模型 -> ECharts option
execution-inspector/charts/ExecutionChart.vue 生命周期、SVG、resize、dispose
execution-inspector/components/             图表说明、字段表、记录表
ExecutionView.vue                            页面编排
```

ECharts 采用 core tree-shaking、SVG renderer 和异步组件。2026-08-30 构建结果：Execution route 约 `40.57 kB / 13.39 kB gzip`；图表异步 chunk 约 `527.21 kB / 178.62 kB gzip`。它不会进入首屏或其他路由，但后续增加图型前必须复查该预算，不能改为全量 `import * as echarts`。

ECharts 自动 aria 已关闭，避免其内部对无损 uint64 生成 `NaN` 描述；外层本地化 `role=img` 与相邻字段表提供等价的可访问名称和完整数据。`prefers-reduced-motion` 同时关闭图表和 CSS 动效。

## 4. 测试要求

- 纯模型：类型选择、S3/S4 去重、少样本降级、零与缺失、S5 series 映射、S7 无损时间。
- 组件：无数据和 matrix 不初始化图表，字段路径可见。
- Desktop Playwright：SVG 出现、图型切换、axe、文字/页面横向溢出和截图。
- Build：确认图表仍是 Execution route 的异步 chunk，并记录异常体积变化。
