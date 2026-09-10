# F5D 可信 Evidence Link

**状态**：2026-08-29 validated  
**范围**：结构化字段到完整 JSON 工件的 SHA-256 绑定深链接；不改变或补造报告指标

## 已完成

- 统一 evidence identity 为 runId、artifactId、sha256 和 JSON Pointer。
- metrics、validation、attribution 和 execution inspector 的精确字段来源可跳到 Execution 页的完整 JSON viewer。
- 链接携带 run、artifact、SHA-256 和 Pointer；浏览器后退、前进和刷新均可恢复同一证据位置。
- JSON viewer 使用 Worker pointer index 定位并高亮实际行，不在主线程扫描或重新解析报告。
- 只为无通配符的精确来源生成链接；包含星号、字段集合或多个来源的聚合路径继续显示文字，不伪造单一 Pointer。
- 链接目标必须存在于当前可信 artifact manifest，且 URL SHA-256 必须与清单一致；篡改身份时失败关闭。
- legacy/unknown schema 仍能通过可信 artifact identity 和原始 Pointer 使用相同定位器，不套用旧结构化解释。

## 覆盖位置

- Metrics：吞吐、TTFT/TPOT/端到端 P95 和请求级记录。
- Validation：resolved fidelity、validation check 和 open gap。
- Attribution：cause chain 和 attribution ranking。
- Execution inspector：统计、记录、图表数据、validation、attribution、S7 stage 和 S9 cause chain。

## 验收

- Frontend：90/90 Vitest。
- Bridge：28/28 unittest。
- Desktop：12/12 Playwright。
- metrics -> JSON -> back/forward -> refresh 往返通过。
- validation、attribution 和 execution 页桌面 overflow 与可访问性门禁通过。
- 14.3 MB Worker 搜索、行窗口、完整复制和 F5C DOM 上限保持通过。
- TypeScript、ESLint、Prettier、contract drift、依赖方向、production build 和 git diff --check 通过。

## 下一步

F5A-F5D 已关闭大型工件浏览与证据跳转。下一阶段进入 F6：以现有可信 evidence link 为基础联动 S7 执行阶段、S8 validation 和 S9 metrics/attribution，不改变 canonical S0-S6 语义。
