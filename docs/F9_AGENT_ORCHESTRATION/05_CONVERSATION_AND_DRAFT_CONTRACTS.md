# 会话、草案与操作契约族

> 文档 ID：`AO-05`
>
> 类型：契约设计（`proposed`；不得视为已发布 identity）
>
> 前置阅读：[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)、[能力目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)

## 1. 目标

定义多轮澄清、实验草案、确定性校验、审批、执行和比较需要的对象边界。本文只定义 contract family 和字段要求，最终 schema identity、版本和 endpoint 必须由 Bridge 正式提案、兼容性评审和生成流程确定。

## 2. 非目标

- 不修改 Evidence Agent v1 request/response/citation/snapshot；
- 不把浏览器 localStorage 当作正式 conversation store；
- 不持久化 hidden reasoning 或 Provider raw response；
- 不用自然语言 transcript 直接恢复运行副作用；
- 不在一个“message”对象里混装 draft、approval、tool result 和 artifact。

## 3. Contract Family

| 逻辑对象              | 用途                                | 持久化策略                               |
| --------------------- | ----------------------------------- | ---------------------------------------- |
| Conversation          | 一个用户目标的容器、权限和保留策略  | 明确 consent 后有限期保存                |
| Turn                  | 有序用户/Agent 交互与结构化结果引用 | redacted 可见文本；不存 hidden reasoning |
| Goal                  | 当前规范化目标、约束和完成定义      | 与 draft 分离、revisioned                |
| Experiment Draft      | 可编辑、可编译的 typed 参数草案     | revisioned；保存最小字段与来源           |
| Validation Report     | 确定性规则和 calculator 结果        | 绑定 draft/profile/policy digests        |
| Approval              | 用户对精确可执行对象的授权          | 审计保存，不含 credential                |
| Operation/Event       | 长任务、工具和恢复状态              | 按 retention 保存最小事件                |
| Comparison Set/Report | 跨 run 的身份、输入差异和可比性     | 引用 run，不复制 artifact 正文           |

## 4. 通用 Envelope

所有对象至少包含：

- `schema_identity`、`schema_revision`；
- stable object ID、workspace/principal binding；
- `created_at`、`updated_at` 或 immutable revision time；
- parent/reference IDs 与 revisions；
- canonical digest（适用时）；
- backend/schema-set/catalog/profile/policy revisions（适用时）；
- retention class、expiry 和 redaction status；
- structured status 与 stable reason codes。

时间戳不能参与本应稳定的 payload digest；canonicalization 规则必须跨 Python/TypeScript 有固定 vectors。

## 5. Conversation

最低字段：

- `conversation_id`、workspace/principal；
- `purpose`：configure/analyze/compare/iterate/capability_check；
- current goal/draft/operation references；
- ordered turn sequence/current revision；
- locale/timezone/unit preferences；
- granted scopes 和 data classifications；
- retention consent、expiry、delete status；
- status：active/awaiting_user/awaiting_approval/running/completed/failed/cancelled/expired。

conversation 只是编排容器，不是 run 或 Provider session。一个 conversation 可以引用多个 run，但每条 claim/citation 仍绑定 owning run。

## 6. Turn

最低字段：

- `turn_id`、conversation ID、monotonic sequence；
- actor：user/agent/system/tool（system/tool 内容必须结构化）；
- user-visible content 的 redacted 版本；
- input/output object references；
- detected language、task kind、model/prompt/policy revisions；
- token/tool/retrieval budgets 与实际使用摘要；
- terminal status：accepted/needs_clarification/draft_updated/refused/failed/cancelled；
- safety/redaction flags。

不保存 chain-of-thought。需要审计时保存规则 ID、选中的字段、调用了哪些工具及其结构化结果摘要。

并发提交使用 `expected_conversation_revision`。不匹配返回正式 conflict，不让后到响应覆盖新 turn。

## 7. Goal

Goal 描述“用户要完成什么”，而不是如何执行。最低字段：

- objective type、success criteria；
- workload intent、model/engine/device/topology preferences；
- SLO、budget、time/cost limits；
- required/optional/forbidden constraints；
- provenance/claim-scope expectation；
- unresolved questions 和 assumptions；
- source spans：每项来自哪些 user turns。

goal revision 改变时，依赖 draft、validation 和 approval 必须 stale。

## 8. Experiment Draft

最低字段：

- `draft_id`、immutable `draft_revision`；
- goal/catalog/profile revisions；
- target request family；
- typed `field_values`；
- applicability 与 unresolved fields；
- compile status 和 compiled request reference/digest；
- assumptions、warnings、alternatives；
- estimated run/candidate budget（由确定性服务提供）；
- allowed claim scope ceiling。

每个 field value 包含：

- stable `field_id`；
- typed canonical value 和 canonical unit；
- 用户原始表达的最小 source span；
- `value_source`：user/profile/template/calculator/system；
- source identity/revision；
- confidence 只用于语言抽取，不替代 validation；
- status：explicit/inferred_candidate/defaulted/ambiguous/unresolved/not_applicable；
- optional alternatives 和冲突 rule IDs。

Draft patch 使用 field ID 和预期 draft revision，不接受任意 JSON Patch 指向私有字段。删除值与设置 `null` 必须有不同语义。

## 9. Validation Report

最低字段：

- validation identity/revision；
- exact draft digest、catalog/profile/policy revisions；
- overall：valid/invalid/unknown/stale；
- issue list：severity、blocking、rule ID、field refs、message、repair candidates；
- calculator results：typed inputs/outputs、units、uncertainty、algorithm revision；
- applicability/lowering/execution coverage；
- compiled request schema identity、digest 和 preview；
- budget/wait/claim-scope summaries。

语言模型可以解释 issue，但不能增删、降级或改写 blocking 状态。

## 10. Approval

最低字段：

- approval ID、principal、scope；
- exact draft、validation、compiled request digests；
- backend/schema/catalog/profile/workflow revisions；
- allowed operations、candidate/run/cost/time upper bounds；
- issued/expiry time；
- status：pending/approved/rejected/revoked/expired/consumed/stale；
- confirmation method 和可审计用户动作。

Approval 是 capability，不是聊天里的“好的”。任何绑定值变化后都不能自动迁移。批量审批必须列出全部候选 identity 和硬上限。

## 11. Operation 与 Event

Operation 最低字段：

- operation ID、type、workflow revision；
- approval 和 compiled request references；
- idempotency key/payload digest；
- state、current node、attempt 和 checkpoint；
- run/tool-call references；
- progress、budget usage、cancel request/fence；
- terminal result/error reference。

Event 是 append-only，包含 event ID、sequence、type、node、time、public payload summary 和 redaction。事件用于恢复和 UI，不保存 Provider 原始内容。

Operation 状态至少区分：queued/running/awaiting_user/awaiting_approval/cancel_requested/cancelled/succeeded/failed/expired/stale。Provider timeout、create-run conflict 和用户取消保持不同终态。

## 12. Comparison Set 与 Report

Comparison Set 只保存 run references、用户选择和目标，不复制报告。Comparison Report 至少包含：

- each run/backend/schema/profile/fidelity/provenance identity；
- input diff 和可比字段；
- comparability overall 与逐规则结果；
- allowed comparison/causal claim scope；
- metric/claim references，保持 owning run citation；
- unresolved/not executed fields；
- refusal reason 和修复建议。

不兼容 run 可以做并排事实展示，但不能生成差异归因或优劣结论。

## 13. 状态传播

| 变化                                 | 必须失效的下游对象                           |
| ------------------------------------ | -------------------------------------------- |
| 新用户 turn 改变 goal                | draft、validation、approval；已完成 run 不变 |
| draft 字段变化                       | validation、approval、未开始 operation       |
| catalog/profile/policy revision 变化 | validation、approval；draft 标 stale         |
| approval 到期/撤回                   | 未提交的写 tool；只读分析仍可用              |
| compiled payload 变化                | idempotency lease 不可复用为“同 payload”     |
| run/backend/schema/snapshot 变化     | Evidence claims 隐藏并 stale                 |
| comparison membership 变化           | comparison report 和其 claims stale          |

## 14. 错误与冲突

契约错误使用稳定 code，至少覆盖：revision conflict、stale dependency、unknown field/profile、ambiguous input、validation failed、approval required/expired/mismatch、budget exceeded、idempotency payload mismatch、terminal not retained、tool denied、operation not cancellable、retention denied。

错误 envelope 必须携带当前 revisions、可安全重试性和用户动作；不得以 HTTP code 文本替代领域终态。

## 15. 数据留存与删除

默认最小化：

- credential 永不进入对象；
- hidden reasoning 和 Provider raw response 不保存；
- artifact payload 只通过 immutable reference 访问；
- validated claims 不额外长期复制；
- 用户原文只在明确 consent、redaction 和期限下保存；
- operation audit 保存对象 identity、rule/tool IDs、digest 和终态，不保存敏感正文。

删除 conversation 时删除可删 transcript/draft 副本和索引项，但不能修改受正式运行审计或合规保留约束的 run metadata；UI 必须说明二者边界。

## 16. 安全

- principal/workspace binding 服务端校验，不能信任客户端 ID；
- user-visible content 与 structured control fields 分离；
- Provider 不能生成 approval、idempotency key、permission scope 或 canonical digest；
- turn/retrieval/tool output 全部带不可信来源标记；
- 导出时二次 redaction，不导出 credential、hidden reasoning 或 restricted profile。

## 17. 测试与验收

- 每个 Schema 的合法/非法 fixture 和 forward-compatibility policy；
- canonical digest Python/TypeScript vectors，含 uint64 边界；
- concurrent turns、out-of-order response 和 expected revision conflict；
- draft patch、null/delete、applicability 和 source attribution；
- catalog/profile drift 使 validation/approval stale；
- approval expiry/reject/revoke/consume 和参数变化；
- operation crash/replay/cancel/late terminal；
- comparison citation 保持 owning run；
- retention consent/expiry/delete/export/redaction；
- 当前 Evidence Agent v2/v1 兼容门禁不变。

## 18. 依赖、阻塞与更新触发器

正式发布前必须解决 `GAP-CONV-001`、`GAP-DRAFT-001`、`GAP-VALIDATE-001`、`GAP-APPROVAL-001` 和 `GAP-WORKFLOW-001`。流程细节见 [意图编译](06_INTENT_COMPILER_AND_CLARIFICATION.md) 与 [工作流](08_WORKFLOW_APPROVAL_AND_EXECUTION.md)。

任何对象字段、终态、retention 或 digest 规则变化都必须更新本文、生成类型、OpenAPI/JSON Schema、fixture、compatibility note 和 E2E。
