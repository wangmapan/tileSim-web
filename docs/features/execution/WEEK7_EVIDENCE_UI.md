# Week 7 证据工作台

**范围**：电脑网页端 `/evidence-lab`  
**状态**：F6A validated and deployed  
**数据边界**：backend-global 固定示例，不绑定当前 run

## 1. 页面回答什么

页面用于验证最新 TileSim 后端已经暴露三类结构化证据：

1. S8 offline calibration fixture 的完整 workflow、误差预算和资产摘要。
2. S9 report field 到 source object、computation rule、validation check 和 allowed claim 的证据映射。
3. 固定 synthetic intent 的五步确定性工具编排、输入/输出 digest 和产物状态。

它不回答“当前 run 为什么慢”或“应如何优化”。当前 orchestration 是可复现的结构化工具调用示例，不是生成根因和优化建议的语言 Agent。

## 2. Bridge contract

| Endpoint                                | Schema                                          | 含义                         |
| --------------------------------------- | ----------------------------------------------- | ---------------------------- |
| `GET /api/week7/evidence-map`           | `tilesim.s9.report_field_evidence_map.v1alpha1` | S9 报告字段的证据和声明规则  |
| `POST /api/week7/calibration-example`   | `tilesim.calibration.workflow_report.v1alpha1`  | 仓库内置 offline fixture     |
| `POST /api/week7/orchestration-example` | `tilesim.agent.orchestration_report.v1alpha1`   | 固定 synthetic intent 的编排 |

Bridge 不接受浏览器提交的路径、命令或额外 CLI 参数。执行前要求 source/build identity 一致；CLI 输出按 `bridge/contracts/schemas/week7-*.schema.json` 校验 schema version、必需字段、类型、最小值和有限数，畸形响应失败关闭。

三个操作共享一个非阻塞单槽。前端 `src/features/week7-evidence/queries.ts` 必须按 evidence map -> calibration -> orchestration 顺序执行；并发请求会触发 retryable `429 week7_capacity_reached`。

## 3. 证据边界

- calibration fixture 固定标记为 `offline_fixture_consistency` / `workflow_consistency_only`；不得显示为真实硬件校准、held-out validation 或最终 fidelity claim。
- evidence map 说明后端字段的来源和允许声明，不证明某个具体 run 已满足该声明。
- orchestration 的 digest 和 tool log 证明流程可复现，不证明模拟结果正确，也不生成自然语言分析。
- S8/S9 是 validation/output subsystem，不要求 canonical subsystem trace。
- 当前 run state 与 backend-global page state 分离；进入 `/evidence-lab` 不清除当前 run。

## 4. S9 attribution audit

run-bound `tail-cause-chain.json` 可包含 `attribution_audit`：

- `status` 与 `evidence_tier`
- `score_total_ps` 与 `share_sum`
- `conserved`
- `propagation_complete`
- `issues`

这些字段在 `AttributionView` 和结构化报告 S9 章节原样保留。前端只格式化显示，不重算守恒、份额或传播状态；缺失 audit 保持缺失。

## 5. 身份、缓存与实现位置

- Query key：operation + backend identity + `schema_set_revision`。
- backend identity 或 contract revision 变化后必须重新获取，不可复用旧 fixture 响应。
- 页面：`src/views/Week7EvidenceView.vue`
- feature：`src/features/week7-evidence/`
- transport：`src/lib/api.ts`、`src/contracts/generated/bridge-client.ts`
- Bridge service：`bridge/services/week7.py`
- contracts：`bridge/contracts/openapi.json`、`bridge/contracts/schemas/week7-*.schema.json`

## 6. 修改验收

- 三个请求保持顺序，单槽 fixture 不出现自触发 429。
- backend/schema identity 改变会使 query cache 失效。
- response schema 不完整、数值非有限或路径越界时失败关闭。
- backend-global 页面导航不丢失当前 run，刷新 `/evidence-lab` 不返回 404。
- 中英文长字段在电脑端安全换行；表格只在 `.table-wrap` 内横向滚动。
- `attribution_audit` 在页面、导出 JSON 和人读 HTML 中一致。
- unit、Bridge unittest、desktop Playwright、typecheck、lint、build 和 `git diff --check` 通过。
