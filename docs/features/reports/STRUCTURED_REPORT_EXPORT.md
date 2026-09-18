# 结构化性能报告导出

**入口**：分层结果页 → `导出结构化报告`  
**格式**：可离线打开和打印的单文件 HTML  
**Schema**：`tilesim.web.structured-performance-report.v2`

## 1. 目标与边界

导出文件用于完整查看一次模拟沿 S0-S9 的性能证据：

- 全局性能摘要、运行身份和 evidence boundary。
- `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6` 分层指标、记录、图表数据和字段来源。
- S7 execution envelope 和统一时间轴。
- S8 provenance、fidelity resolution、validation checks 和 open gaps。
- S9 request metrics、tail summary、后端已报告 attribution/cause chain 和 `attribution_audit`。
- F6B 当前 request 的 P99 subject、S1/S3/S4/S5/S6/S7/S8/S9 节点、稳定 ID、Artifact SHA-256、JSON Pointer 和 availability。
- Week 8 requested/resolved fidelity、execution mode、fallback、state summary、differential、stream count/truncation 和 checkpoint metadata。
- F7 metrics artifact identity、domain/request/dominant-phase Pointer、topology join degradation，以及 reported ranking/Pareto/candidate navigation/executed knobs capability 状态。
- 聚合前的 workload requests、phase contributions、request contributions 和 domain utilization 明细。
- Artifact schema-set revision、SHA-256 和 schema identity（manifest 可用时）。

前端不重新模拟，不把显示级聚合升级为后端事实，也不自行生成根因或优化建议。报告中的 `agent_analysis` 固定为 `not_generated`；后续 Agent 应基于 evidence pointer 和 provenance 生成独立、有引用的分析结果。

## 2. 双重表示

HTML 正文面向人阅读，包含目录、状态卡、表格、轻量图形、字段质量提醒和打印样式。文件末尾包含：

人读 HTML 跟随导出时的界面语言；内嵌机器可读 JSON 保持稳定 schema、原始字段名和证据值，不因语言切换改写。

```html
<script type="application/json" id="tilesim-structured-report">
  { ...完整结构化报告... }
</script>
```

后续 Agent 或自动化工具应读取该节点，而不是反向解析 HTML 表格。HTML 文本和嵌入 JSON 分别转义，报告字段不能闭合 script 或注入可执行标记。

## 3. 数据规则

- 真实 `0` 的 availability 是 `available`；缺失是 `null + missing`。
- 64 位 ps/bytes 保留 lossless JSON 字符串；S7 图形只使用安全的相对换算。
- JavaScript `bigint` 通过 JSON replacer 写成精确十进制字符串；导出前不得先经过原生 `response.json()` 或有损 `JSON.parse`。
- `run_bound_evidence.selected_request_id` 只来自当前页面的显式选择。没有选择时写入 `null + missing`，即使后端报告了 single-request P99，也不由导出过程自动选择。
- percentile subject 保留后端的 `selection_semantics`、selected/member request IDs 和 subject EvidenceRef；tie/no-single-request 不强选实体。
- run-bound references 逐项保留 `run_id`、`artifact_id`、`schema_identity`、manifest SHA-256、`json_pointer` 和稳定 subject ID。数组位置仅是稳定 ID 唯一匹配后的 Pointer 位置。
- S3/S4 去重、S5 分组求和和图型降级沿用 `EXECUTION_VISUALIZATION_DESIGN.md`。
- 图表同时给出数值文字；异常比例、负值和缺字段显示质量提醒，不静默裁掉原值。
- 后端 `bottleneck_report`、attribution 和 cause chain 标记为“后端报告”，不能冒充 Agent 推断。
- 后端 `attribution_audit` 的守恒、份额、传播完整度和 issues 原样保留；前端不重算 audit 结论。
- imported/legacy bundle 没有 artifact manifest 时，schema revision 和 SHA-256 保持缺失。

## 4. 实现位置

```text
src/features/structured-report/model.ts        报告 schema 与 S0-S9 构建
src/features/structured-report/render-html.ts  安全单文件 HTML 渲染
src/features/structured-report/download.ts     文件名和浏览器下载
src/features/structured-report/index.ts        feature 公共入口
```

`ExecutionView` 只能通过 feature 公共入口触发导出。导出是纯前端操作，不调用 Bridge、不修改 run，也不操作 5173。

导出模块只在用户点击时异步加载。2026-08-28 构建基线：Execution route 约 `39.72 kB / 13.22 kB gzip`，包含人读 design-space 章节的结构化报告异步 chunk 约 `27.44 kB / 9.65 kB gzip`。

## 5. 测试与已知限制

自动测试覆盖：

- S0-S9 和聚合前证据数组齐全。
- F6B 所选 request、P99 subject、并列 S3/S4/S5、S7-S9 引用与 Week 8 metadata 一致。
- design-space 人读章节保留候选排名、晋级、运行实例、完整候选字段与 Analytical/DES 分歧。
- Agent 分析保持空值。
- S9 `attribution_audit` 在人读章节和内嵌 JSON 中保留且一致。
- zero/missing、无损 ps、artifact SHA-256 不变。
- 超过 `Number.MAX_SAFE_INTEGER` 的 bigint 在嵌入 JSON 中保持精确十进制；无选择时不自动选择 P99。
- 文件名、HTML 和嵌入 JSON 安全转义。
- 浏览器真实下载、离线打开、axe 和 overflow。

当前导出在主线程同步组装完整 HTML。超大型报告的 Worker、流式生成和专项性能门禁是后续性能硬化债务；不得用截断记录来伪装性能优化。
