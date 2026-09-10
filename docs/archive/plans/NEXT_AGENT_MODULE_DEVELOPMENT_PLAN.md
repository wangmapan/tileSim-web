# Evidence Agent 模块深化计划

**状态**：基础深化已实现；高级能力与 live acceptance planned
**并行所有权**：Evidence Agent feature、store/entity/API/adapter、F9 专用测试和文档

## 目标

在不改变 descriptor v2、request/response/citation/snapshot v1、canonical digest 和幂等恢复语义的前提下，让普通用户能够完成“选择请求 → 选择问题 → 生成 → 阅读结论 → 核对引用 → 理解限制”的完整流程。

## 当前耦合

- `EvidenceAgentPanel.vue` 仍是中高耦合编排组件，拥有约 17 个 props，并同时协调 readiness、表单、request preparation、lease/409、显式 discard 和焦点。
- `EvidenceAgentView.vue` 与 Panel 分别为 stale binding 和正式提交构建 snapshot 相关输入，未来字段变化存在双点修改风险。
- `request-builder.ts` 同时拥有 Pointer/subject、allow-list、provenance/fidelity scope、snapshot digest 和 request build；后续应分阶段拆，不能一次迁移。
- store 的 lease、sessionStorage、四维 stale 和 late response 归属正确但依赖状态转换顺序，适合先补显式 transition tests。

本轮已抽出 `EvidenceAgentServiceDetails.vue`、`EvidenceAgentSubmissionLeaseNotice.vue`、
`EvidenceAgentSubmissionPreview.vue` 和 `EvidenceAgentTaskCards.vue`；结果按“结论/限制/下一步/补充说明”展示，但保留
atomic claim 原文、原始索引与完整 citation identity。Panel 仍负责编排，store、builder、validator 和 API 没有迁移。
descriptor v2、两类 409、502/503/504、四维 stale 和 citation 语义均未升级 identity。

## 开发阶段

### A. 稳定内部边界（展示级已完成，纯状态边界待后续）

1. 保持现有展示组件只接收 props/events，不创建 key、不访问 store、不提交 Provider。
2. 按 builder、validator、state、component 拆分大测试文件，但不删除断言。
3. 为 lease/stale/late response 建立显式状态转换表。
4. 形成 `evidence-reference` 与 `snapshot-builder` 的版本化拆分设计；第二批再实现。

### B. 普通语言提问流程（基础已完成）

- 由 descriptor 的 `supported_task_kinds` 生成任务卡，不开放未声明能力。
- 用普通语言解释四种任务：P99、尾延迟、结果可信度、条件性下一步。
- 提交前显示当前请求、可引用证据数、数据来源/可信范围和预计等待时间。
- unavailable、缺 metrics、未选请求、stale 和两类 409 各自只给一个明确下一步。

### C. 结果阅读闭环（基础已完成）

- 保持 atomic claim 原始边界；前端不合并、改写、重算或补造结论。
- 默认按“结论、依据、限制、下一步”展示；run/artifact/SHA/Pointer/subject 放入专业详情。
- partial、refused、truncated、stale、409、502、503、504 保持正式且互不混淆。
- citation 继续精确绑定 run、artifact、schema、SHA、Pointer 和 stable subject。

### D. 新契约能力设计

多轮对话、持久分析历史、跨 run 比较、异步/SSE、取消恢复、claims 持久化和自动执行建议均不能在现有契约下前端模拟。先提交 Bridge contract gap、身份/revision、幂等、retention 和 redaction 设计。

### E. F9 正式验收

36-case catalog 继续作为 hard gate；正式 Provider 可用后完成 success/refusal/timeout、每个关键配置至少 5 次重复评测和双人 citation entailment review。通过前 F9 保持 live-blocked。

## 必须保持

- 同 key/同 canonical payload 进程内精确 replay；不同 payload 返回正式 409 mismatch。
- claims-bearing 或 claim-free Provider terminal 跨重启返回 `terminal_result_not_retained`，不自动重新调用 Provider。
- 两类 409 锁定原 key，只有显式 discard 才能生成新 key。
- run/backend/schema revision/snapshot digest 任一变化立即 stale 并隐藏 claims。
- 502/503/504 继续使用正式 EvidenceAgentResponse。
- 不新增 question、artifact payload、raw response、validated claims、credential 或 hidden reasoning 持久化。
- S3/S4/S5 并列，S7 是执行宿主，S8/S9 不进入 causal ranking；provenance/fidelity 不升级；uint64 无损。

## 验收

运行 Evidence Agent unit/component/E2E、36-case catalog、contracts/deps/type/lint/format/build、完整 fixture Playwright 和 `git diff --check`。不得触碰或部署 5173，不执行 live Provider acceptance。

## 后续任务提示词

```text
请在 D:\tileSim-web 深入扩展 Evidence Agent 前端模块。

开始前完整阅读 AGENTS.md、docs/AI_HANDOFF.md、D:\tileSim\AGENTS.md、docs/F9_EVIDENCE_AGENT_CONTRACT_AUDIT.md、docs/F9_EVIDENCE_AGENT_EVALUATION_SPEC.md 和 docs/PARALLEL_FRONTEND_WORKSTREAMS.md。

你在独立 worktree/分支中工作。独占范围是 src/features/evidence-agent/**、src/stores/evidence-agent.ts、src/entities/evidence-agent/**、src/lib/api/evidence-agent.ts、src/adapters/evidence-agent-descriptor.ts、F9 专用测试/文档以及 src/i18n/workstreams/evidence-agent.ts。不要修改全局 PagePrimer、guided-help、ECharts、其他业务页面或共享 english-catalog.ts。保护已有改动，不 reset、clean、覆盖、提交或推送，除非父任务明确要求；不要停止、重启或部署 127.0.0.1:5173，不读取或输出 TILESIM_EVIDENCE_AGENT_* 的值，不执行 live acceptance。

先审查并保留现有 EvidenceAgentServiceDetails、SubmissionLeaseNotice、SubmissionPreview、TaskCards 和 ResultPanel，
不要重复创建第二套组件。下一批优先把 lease/stale/late-response 状态转换提炼成可独立测试的纯状态边界，并按
evidence-reference / snapshot-builder 设计渐进降低 request-builder 耦合；每次只迁移一个纯逻辑边界，稳定 facade 和
canonical digest 输出必须不变。

继续深化 descriptor 驱动的普通语言流程与结果阅读，但不得改写、合并、补造或重算 atomic claims，citation 必须继续
精确绑定 run/artifact/schema/SHA/Pointer/stable subject。多轮、跨 run、持久历史、SSE/cancel 等只形成版本化 contract gap。

必须保持 descriptor v2、request/response/citation/snapshot v1、canonical digest、无损 uint64、四维 stale、两类 409 原 key 锁定、显式 discard、新 key 生成纪律，以及 502/503/504 正式状态。多轮对话、跨 run Agent 比较、持久历史、SSE/cancel 等若契约不能表达，只提交版本化 contract gap，不做 compatibility 模拟。

完成后运行 pnpm contracts:check、deps:check、typecheck、test、lint、format:check、build、test:e2e 和 git diff --check。最终报告说明拆分边界、identity 是否变化、幂等/409/502/503/504/stale/citation/retention 回归、仍需新契约的能力、F9 live repetitions/人工审查状态，并明确未部署 5173。
```
