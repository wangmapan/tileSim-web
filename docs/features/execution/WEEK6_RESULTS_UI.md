# TileSim 结果界面与证据规则

**适用范围**：当前电脑网页端  
**事实来源**：TileSim run artifacts  
**当前受控执行面**：`S1 -> S6`

## 1. 页面结构

- 运行概览：端到端结论、关键指标、运行事实和主要瓶颈。
- 分层结果：`S0 -> S1 -> S2 -> {S3,S4,S5} -> S6`。
- 性能指标：请求级 TTFT、TPOT、latency、throughput 和 tail。
- Fabric 分析：域、利用率、queue、congestion 和 backpressure。
- 尾延迟归因：attribution ranking 和 cause chain。
- 证据与验证：provenance、calibration、validation lane、claim scope 和 fidelity resolution。
- 设计空间：当前仅展示 `execution_scope=S6_only`。
- 运行记录：恢复、重命名和最多两个 run 的比较。
- 新建实验：受控参数、JSON 输入和 S6 candidate manifest。
- 结构化报告导出：单文件 HTML 中汇总 S0-S9、聚合前性能明细和机器可读 JSON。
- Week 8 run-bound 证据链：从后端声明的 P99/request 展示 S1、并列 S3/S4/S5、S6、S7/S8/S9 与 manifest-bound EvidenceRef。
- Week 7 证据工作台：backend-global S8 offline fixture、S9 field evidence map 和确定性五步编排；详细边界见 `docs/features/execution/WEEK7_EVIDENCE_UI.md`。

“分层结果”中的 S3、S4、S5 是同一资源语义层内的并列子系统，不是顺序执行链。S7 只作为 execution host/envelope 摘要；S8/S9 是 validation 和 output plane。

## 2. 字段来源

| 子系统 | 主要来源                                          | 页面含义                                              |
| ------ | ------------------------------------------------- | ----------------------------------------------------- |
| S0     | `validation.trace_provenance`、resolution entries | 输入来源、校准和允许声明                              |
| S1     | runtime trace、`run.summary`、request metrics     | 策略、请求、TTFT/TPOT 和完成状态                      |
| S2     | resolution entries、multi-granularity profile     | lowering、requested/resolved fidelity 和实现限制      |
| S3     | `phase_fabric_contributions[*].memory_*`          | KV/memory event、匹配和延迟                           |
| S4     | `phase_fabric_contributions[*].device_*`          | task、profile、occupancy、contention 和延迟           |
| S5     | resource convergence、collective ID               | collective 分组、phase 和资源汇合                     |
| S6     | system summary、request fabric contributions      | Fabric 域、利用率、排队、拥塞和背压                   |
| S7     | execution envelope stages                         | 全局宿主阶段与时间窗口                                |
| S8     | validation report                                 | provenance、校准、检查和 claim scope                  |
| S9     | metrics、tail report                              | TTFT、TPOT、吞吐、P95/P99、原因链与 attribution audit |

完整 bundle 的核心报告是 run、metrics、validation 和 tail；design-space 与 execution-envelope 是可选报告。旧 bundle 缺少可选报告时保持缺失，不补造空对象。

## 3. Artifact 与完整性

版本化 Bridge 可以暴露以下 allow-listed JSON：

- `input-runtime-trace.json`
- `input-topology.json`
- `input-design-space-candidates.json`（可选）
- `run-result.json`
- `metrics.json`
- `validation.json`
- `tail-cause-chain.json`
- `execution-envelope.json`（可选）
- `week8-run-evidence.json`（DES run 可选；只展示 bounded summary/checkpoint metadata）
- `design-space.json`（可选）

前端先固定 API/schema-set revision，再读取 artifact manifest，并逐项校验 SHA-256 和 schema identity。revision、hash 或 identity 不一致时失败关闭。私有 `run-metadata.json` 不属于浏览器 allow-list。

unknown schema 不进入旧结构化视图，但完整原始 JSON 仍可查看。损坏的可选 artifact 不阻断合法报告；损坏或缺失主 run artifact 返回结构化错误。

## 4. 允许的前端派生

前端只能做可追溯的浏览级处理：

- S3 按 `memory_event_id` 去重。
- S4 按 `device_task_id` 去重。
- S5 按 `collective_id` 分组，对组内后端 phase 字段求和。
- execution-envelope 的 ps 时间差可换算为 µs；S7 图表可以最早合法 stage 为零点换算相对 ns，但字段表必须保留原始 ps。
- 排序、索引、过滤、格式化和单位展示必须保留来源路径。

分层结果的图型、字段和降级规则见 `docs/architecture/EXECUTION_VISUALIZATION_DESIGN.md`。S0/S2 使用状态矩阵，不把分类状态数量化；S4 至少 3 个完整 latency–occupancy 样本才使用散点图；无数据时显示原因和字段表，不初始化空图。

这些处理不是新的模拟指标。后端聚合存在时优先展示后端值；前端去重计数只用于浏览和关联。

## 5. 必须保持的证据边界

- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 分开显示。
- synthetic consistency 不等于 held-out validation。
- requested fidelity 与 resolved fidelity 分开显示。
- Analytical、DES、Cycle 只按后端实际声明展示。
- Cycle 当前只允许表示真实 S6 hotspot refinement。
- missing、expected absence、not covered、unsupported schema、not applicable 和真实数值 `0` 不得混淆。
- boundary run 可以没有端到端 TTFT/TPOT；页面显示“不适用”。
- `allowed_claim_scope`、`validation_lane`、`evidence_tier` 和 `calibration_level` 始终可见。
- 当前没有独立 PR4 Trace 页面；canonical trace 作为 run artifact 查看。
- 导出报告不生成具体根因和优化建议；只保留后端已有 attribution/cause chain，并预留 `agent_analysis`。
- `attribution_audit` 的守恒、份额、传播完整度和 issues 由后端报告；前端原样展示，不重新判定。
- Week 7 offline fixture 与 evidence map 是 backend-global 示例，不得混入当前 run 的 S8/S9 证据。
- P99 request 只能来自 `metrics.percentile_subjects` 的 selection semantics；tie/no-single-request 不得强选，缺字段不得按 latency 排序推断。
- S7/S8/S9 只能作为 execution/validation/output 证据节点，不进入前端 causal ranking。

## 6. 当前代码位置

- 页面：`src/views/`
- 结果模型：`src/features/execution-inspector/model/`
- artifact 查看：`src/components/JsonArtifactPanel.vue`、`src/features/inspect-artifact/`
- report registry/adapter：`src/adapters/`、`src/lib/reports.ts`
- 无损 JSON：`src/contracts/lossless-json.ts`
- workspace state：`src/stores/workspace.ts`
- controller facade：`src/store/dashboard.ts`
- Bridge artifact integrity：`src/lib/api/artifacts.ts`
- Week 7 backend-global evidence：`src/features/week7-evidence/`、`src/views/Week7EvidenceView.vue`
- Week 8 run-bound evidence：`src/features/run-bound-evidence/`、`src/stores/evidence-selection.ts`
- structured report v2：`src/features/structured-report/`
- 分域样式：`src/styles/`

## 7. 当前验证基线

- 97 frontend unit/component tests。
- 36 Bridge unittests。
- 18 desktop Playwright tests。
- desktop 深链接、浏览器历史、unknown schema、held-out provenance、boundary 指标、legacy bundle、axe、视觉和文字 overflow 均在自动门禁内。

大型 artifact 已在 F5C 使用专用 Worker 完成无损格式化、搜索、Pointer 索引和最多 300 行的按需窗口；F5D 又以 run、artifact、SHA-256 和 Pointer 打通结构化字段到原始证据的刷新可恢复跳转。聚合或通配来源不伪造成单一 Pointer。
