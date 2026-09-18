# 分层结果可视化设计

**范围**：电脑网页端 `ExecutionView`、`MetricsView`、`FabricView`、`DesignSpaceView`、`AttributionView`
**原则**：图表只做可追溯的显示级整理，不生成模拟事实或提升证据等级。

## 1. 统一阅读协议

每张图仍需在模型与设计记录中回答四件事：

1. **回答的问题**：限定图表能回答的一个问题。
2. **先看哪里**：告诉普通用户先定位哪个条目或关系。
3. **解释边界**：明确不能从图中推出的结论、子系统和证据等级。
4. **查看数据与证据**：展示完整等价字段表、字段模式、`derivation`、单位和精确 EvidenceRef 入口。

页面不再把前三项渲染成并排解释卡。图表下方只显示一句简要说明，专业边界、字段来源和证据按需在“查看数据与证据”中展开，避免说明层抢占图形阅读空间。

图点选只选择已有字段行，不生成新 identity。入口继续由 `ArtifactEvidenceLink` 使用当前 workspace 的
`{runId, artifactId, sha256, pointer}` 解析；run、Schema、artifact manifest 或 SHA 不匹配时失败关闭。图中限制为前 12 项时
必须显示限制说明，字段表保留全部行。

## 2. 图型决策

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

跨页深化图表：

| 页面 / 图                   | 回答的问题                               | 来源                                                                      | derivation        | 降级与边界                                                          |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| Metrics 请求延迟比较        | 哪些请求的 TTFT/TPOT/端到端延迟更高      | `metrics:/request_metrics/*/{ttft_ps,tpot_ps,end_to_end_latency_ps}`      | `unit_conversion` | 无 request 时不画；boundary 缺值保持 missing，真实 0 保持 0         |
| Fabric 通信域时间构成       | 各域 runtime/queue/congestion 分别有多少 | `metrics:/system_summary/fabric_domain_utilization/*/{runtime_us,...}`    | `identity`        | 无域记录时不从系统或 request 汇总反推                               |
| Fabric 请求通信时间构成     | 哪些请求更多时间落在执行、排队或拥塞     | `metrics:/system_summary/request_fabric_contributions/*/{runtime_us,...}` | `identity`        | 无请求贡献时不从 phase、顺序或数值补造                              |
| Design Space 正式 objective | 候选如何权衡、哪些是正式 Pareto member   | `design-space-report:/candidates/*/objectives/*` 与正式 membership        | `identity`        | 两维/两个完整候选时散点；否则单 objective 条形；无 objective 时不画 |
| Attribution S0-S6 延迟贡献  | 报告 score 分配给哪些 S0-S6 记录         | `tail:/attribution_ranking/*/{rank,subsystem,score_ps,share}`             | `unit_conversion` | S7/S8/S9 永久隔离到输出记录表；不参与 causal ranking                |

Design Space 只消费正式 objectives、Pareto membership、dominance 和 rank；不使用 projected 字段重建 Pareto，也不计算
promotion reason，`execution_scope` 保持 `S6_only`。Attribution 图保持报告顺序；S7 是执行宿主，S8/S9 是验证与输出面。

不使用折线图表示无序子系统或请求，不使用饼图表示原因链，不把 fidelity 映射到未经定义的连续数轴，不从散点图推断因果。

F6B run-bound panel 使用节点卡和证据表而不是因果图：S3/S4/S5 固定并列，S7/S8/S9 只表达执行宿主、验证和输出引用，不进入 causal ranking。高密度 EvidenceRef 默认收起，可通过键盘展开；稳定 ID 与 Pointer 文本仍完整保留。

## 3. 证据与换算

每个可视化模型必须包含：`kind`、`rationale`、`sourcePaths`、`derivation`、`unit`、原始表格行和缺失原因。

- `identity`：直接显示报告值。
- `display_group`：按报告 ID 去重或分组。
- `display_sum`：只对同组、同单位的后端字段求展示级合计。
- `unit_conversion`：S7 以最早合法 stage 为零点将相对 ps 安全换算为 ns；Metrics/Attribution 将 ps 安全换算为 µs；表格始终保留原始 ps 字符串。
- 真实 `0` 保留为 `0`；missing 使用 `null`，不得转成零。
- 可视化区显式提示 missing、负数量/延迟和超出 `[0, 1]` 的比例；异常值仍保留在字段表中，不静默裁掉。
- 图中最多显示报告顺序前 12 项，字段表保留全部行；结构化记录每次渲染 50 条，可继续加载。

图表下方始终保留类型选择依据、字段表和 JSON 路径。图表是摘要入口，原始 JSON artifact 仍是最终查看面。

字段位置统一写成 `artifact-id:/json/pointer`；包含 `*` 或 `{field,...}` 的位置是多记录字段模式，不冒充单一 evidence pointer。当前精确记录已使用可刷新恢复的 `{runId, artifactId, sha256, pointer}`；聚合来源和通配路径仍只显示字段模式，不伪造单点链接。

## 4. 实现边界

```text
execution-inspector/model/visualizations.ts  报告 -> 可视化模型
execution-inspector/model/analysis-visualizations.ts  跨页纯展示模型
execution-inspector/charts/chart-options.ts  模型 -> ECharts option
execution-inspector/charts/ExecutionChart.vue 生命周期、SVG、resize、dispose
execution-inspector/components/             图表说明、字段表、记录表
Execution/Fabric/Metrics/DesignSpace/Attribution views  页面编排
```

ECharts 采用 core tree-shaking、SVG renderer 和异步组件。2026-09-02 深化完成时，`chart-runtime` 为
`339.15 kB / 114.22 kB gzip`，`chart-renderer` 为 `181.86 kB / 61.49 kB gzip`。稳定版体检将 ECharts 6.0.0
升级到修复 `GHSA-fgmj-fm8m-jvvx` 的 6.1.0 后，二者分别为 `346.65 kB / 118.84 kB gzip` 与
`182.65 kB / 61.80 kB gzip`；`ExecutionChart` 包装 chunk 保持约 `4.50 kB / 2.07 kB gzip`。新增跨页纯展示模型为
`9.29 kB / 4.09 kB gzip`，共享 panel 为 `8.11 kB / 3.14 kB gzip`。核心图表运行时没有增加图型或进入同步入口，
不能改为全量 `import * as echarts`。

ECharts 自动 aria 已关闭，避免其内部对无损 uint64 生成 `NaN` 描述；外层本地化 `role=img` 与相邻字段表提供等价的可访问名称和完整数据。`prefers-reduced-motion` 同时关闭图表和 CSS 动效。

## 5. 测试要求

- 纯模型：类型选择、S3/S4 去重、少样本降级、零与缺失、S5 series 映射、S7 无损时间。
- 组件：无数据和 matrix 不初始化图表，字段路径可见。
- Desktop Playwright：SVG 出现、图型切换、axe、文字/页面横向溢出和截图。
- Build：确认图表仍是 Execution route 的异步 chunk，并记录异常体积变化。

2026-09-02 深化回归新增：请求级真实 0/missing、正式 objective 不重算 Pareto、S7/S8/S9 排名隔离、图点选后的
run/artifact/SHA/Pointer 四维绑定、Fabric 双构成图、完整字段表行数、English、dark/light、axe、reduced-motion 和
1440px overflow。所有页面继续复用同一个按需 SVG ECharts runtime，不增加全量 import。
