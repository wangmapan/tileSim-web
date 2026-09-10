# F6A Week 7 Evidence Closure — 2026-08-30

本文件是阶段性验证记录。当前事实和下一步以 `AGENTS.md`、`docs/AI_HANDOFF.md` 与 `docs/FRONTEND_DEVELOPMENT_PLAN.md` 为准。

## 后端身份

- source：`D:\tileSim` 本地 `main`
- revision：`4a536cc081abb20567c19ab9e94e6139f5008333`
- deployment：content-digest-bound `local_worktree_snapshot`
- health：`versions_match=true`、`state_digests_match=true`、`execution_ready=true`

## 完成范围

- 新增 `/evidence-lab`，展示 S8 offline calibration fixture、S9 report-field evidence map 和固定五步 deterministic orchestration。
- 新增三个 allow-listed Bridge endpoint 和登记 JSON Schema；浏览器不能传任意路径、命令或参数。
- 将后端 S9 `attribution_audit` 接入归因页与结构化报告。
- 保留中英文、电脑端 overflow、主题、动效和 SPA 深链接行为。

## Review closure

1. 三个 Week 7 操作从并发改为顺序执行，与 Bridge 单槽容量一致。
2. backend-global 证据页不再清除当前 run。
3. Week 7 CLI 输出按登记 Schema 校验必需字段、类型、最小值和有限数。
4. Week 7 query key 加入 backend identity 与 `schema_set_revision`。
5. E2E fixture 模拟真实单槽容量，防止回归为并发请求。

## 验证结果

- TileSim CTest：58/58
- frontend unit/component：97/97
- Bridge unittest：36/36
- desktop Playwright：18/18
- contracts、dependencies、typecheck、lint、format、build 和 diff check：通过

## 证据边界与后续

- offline fixture 只支持 workflow consistency，不是硬件校准或 held-out fidelity evidence。
- deterministic orchestration 不是生成具体根因/优化建议的语言 Agent。
- F6A 页面是 backend-global；下一阶段 F6B 应通过正式 run-bound contract 串联 S7 execution envelope、S8 validation 和 S9 metrics/attribution，不能在前端用时间近似或文本相似度伪造关联。
