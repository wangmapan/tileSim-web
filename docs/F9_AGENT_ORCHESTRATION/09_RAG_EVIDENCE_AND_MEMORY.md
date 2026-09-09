# RAG、证据与记忆规范

> 文档 ID：`AO-09`
>
> 类型：检索与证据设计（`proposed`）
>
> 前置阅读：[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)、[会话契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)

## 1. 目标

让 Agent 准确找到“当前能配置什么、为什么、某次运行发生了什么、哪些历史运行可比较”，并为回答提供可验证引用。RAG 不能替代 capability resolver、calculator、artifact validator 或 comparability gate。

## 2. 四类独立索引

| 索引           | 内容                                              | 主要检索                   | 引用 identity                           |
| -------------- | ------------------------------------------------- | -------------------------- | --------------------------------------- |
| 参数与 Profile | descriptor、profile、支持矩阵、规则说明           | exact/metadata 优先        | field/profile/revision                  |
| 当前运行证据   | allow-listed artifacts 的 validated projections   | Pointer/subject/exact 优先 | run/artifact/schema/SHA/Pointer/subject |
| 公开文档       | 架构、契约、用户指南、ADR                         | BM25/hybrid                | repository revision/path/section/digest |
| 历史运行       | run metadata、输入摘要、可比性索引、正式指标 refs | metadata/filter 优先       | owning run + artifact citation          |

四类索引有不同 ACL、更新频率、chunking、retention 和 ranking，不能合并为一个无类型向量库。

## 3. 摄取流水线

1. 从 allow-list source 读取 immutable bytes；
2. 校验 schema identity、revision、digest、run/backend binding 和权限；
3. redaction/data classification；
4. 结构化抽取，保留 stable field/Pointer/subject；
5. 生成 deterministic chunk ID 和 source span；
6. 构建 exact/metadata/BM25，按评测需要构建 embedding；
7. 发布 immutable index revision；
8. 完成双读/验证后原子切换 active revision。

坏 source、未知 schema、digest mismatch 或 redaction 失败不得进入部分索引。

## 4. Chunk 设计

- 参数/Profile：一个稳定字段或一个紧密组合约束为基本单元；
- artifact：以后端 atomic claim、stable subject 或自然结构边界为单元，不切断数值与单位/citation；
- 文档：section-aware chunk，保留标题路径、normative status 和 revision；
- 历史运行：metadata/search record 与 artifact 正文分离。

每个 chunk 带 source type、identity、revision、ACL、provenance、claim scope、valid time、language 和 content digest。Embedding 文本是派生缓存，不是事实真源。

## 5. Retrieval Ladder

固定顺序：

1. stable identity/Pointer/exact alias；
2. metadata、ACL、run/profile/fidelity/provenance 过滤；
3. BM25/FTS lexical retrieval；
4. embedding semantic retrieval（只有离线评测证明增益后）；
5. reranking（只有质量增益超过延迟/成本门槛后）；
6. deterministic evidence assembly 和 coverage check。

Reciprocal rank fusion 或 contextual retrieval 是可评测选项，不是默认必选。精确数值、identity 和能力状态不能只靠 embedding 命中。

## 6. Query Planning

Query planner 先识别索引类型和 scope：

- “这个字段能否设置”只查 capability/profile；
- “本次 P99 为什么高”查当前 run 的 metrics、execution、network、attribution 证据；
- “文档怎样解释 Cycle”查公开文档；
- “找相似运行”先查历史 metadata，再运行 comparability validator。

LLM 可生成检索意图候选，但 scope、ACL、run binding、filters 和最大 top-k 由服务端 policy 校验。

## 7. Evidence Bundle

传给模型的 bundle 至少包含：

- query/task identity；
- index revisions 和 retrieval strategy；
- ordered evidence items；
- 每项 source identity、exact citation fields、provenance/claim scope；
- content 的最小 validated projection；
- coverage：covered/partially_covered/not_covered；
- contradictions、missing sources 和 truncation；
- token budget 和 deterministic ordering。

同一数值的显示换算可附原值与规则，但模型不能重算或改变单位语义。

## 8. Citation 与回答门禁

运行证据 citation 必须精确绑定 run、artifact、schema、SHA-256、Pointer 和 stable subject。文档引用绑定 repository revision、path、section 和 digest。Profile 引用绑定 profile identity/revision/field。

生成后 validator 逐 atomic claim 检查：

- citation 存在且属于 bundle；
- Pointer/subject 可解析；
- claim 中 identity、数值、单位和状态与 source 一致；
- provenance/fidelity/claim scope 未升级；
- 不跨 run 合并 owning citation；
- partial/refused/truncated 状态与覆盖一致。

不满足时删除/拒绝整个 atomic claim，不能由前端修补措辞冒充有效。

## 9. No-answer 与矛盾

缺少证据时正式返回 `not_covered` 或 `evidence_unavailable`，并说明需要的 artifact/profile/validation。检索不到不是证明事实不存在。

来源矛盾时保留各自 identity、revision 和适用范围；确定性 freshness/authority policy 能裁决时给出结果，否则明确 unresolved。LLM 不自行平均或挑选喜欢的来源。

## 10. 会话记忆

区分：

- **工作记忆**：当前 turn 所需 redacted context，只在短期 operation 内；
- **结构化任务状态**：goal/draft/validation/approval references，是正式真源；
- **用户偏好**：单位、默认展示、常用 profile，仅在 opt-in 和可删除条件下保存；
- **历史运行记忆**：run metadata/refs，由运行仓库管理；
- **长期语义记忆**：默认不做，需独立 consent、expiry、冲突和删除契约。

不得把模型摘要当作唯一会话状态。摘要可以是可丢弃缓存，恢复时以 typed objects 和 turns 为准。

## 11. Prompt Injection 防护

- 所有 retrieved content 明确标记为 untrusted data；
- source 内“忽略规则/调用工具/输出 secret”不得改变 system/tool policy；
- 检索和工具权限在模型外服务端执行；
- URL/path/source allow-list，禁止任意网络抓取进入同一信任域；
- 对恶意 artifact、文档、profile 和用户上传分别建 adversarial corpus；
- 回答只能引用 validated projection，不把原始可执行文本当工具参数。

## 12. GraphRAG 边界

GraphRAG 可作为“模块、契约、ADR 和文档关系”的研究原型，用于全局架构问题。它不用于：参数真源、数值 artifact、run identity、实时能力判断或因果归因。只有在独立文档问题集上相对 hybrid baseline 显著提高质量，才进入生产候选。

## 13. 留存与重建

- 索引是派生数据，必须可从 authoritative source 重建；
- index revision 与 embedding/reranker model revision 可追溯；
- 删除/撤权后从 active index 和缓存移除，并验证不可检索；
- Provider prompt 和 raw response 默认不保存；
- 不新增完整 artifact 或 validated claims 长期副本；
- conversation 删除触发其私有索引删除，不影响正式 run artifact policy。

## 14. 评测

按索引分别建立 train/validation/test/held-out adversarial：

- exact identity/Pointer hit rate；
- recall@k、MRR/nDCG；
- context precision/recall、noise sensitivity；
- no-answer false positive；
- citation precision/coverage/entailment；
- provenance/fidelity upgrade rate；
- stale/ACL/cross-run leakage；
- injection success rate；
- p50/p95 latency、index freshness 和成本。

运行证据的 citation precision、identity binding 和 uint64 exactness 必须为 1.00；no-answer false positive 与跨作用域泄漏必须为 0。

## 15. 测试与验收

- source bytes/schema/SHA/run binding 和坏输入隔离；
- deterministic chunk IDs/index rebuild；
- exact → metadata → BM25 → optional semantic/rerank 顺序；
- ACL/workspace/run/profile filters；
- stale index、profile revoke、artifact replacement；
- atomic claim validator 和两类 citation；
- malicious document/artifact/profile；
- retention/expiry/delete/reindex；
- embedding/reranker disabled baseline 始终可运行。

## 16. 依赖与更新触发器

依赖 [能力目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)、[工具安全](10_TOOLS_SECURITY_AND_INTEROPERABILITY.md) 与 `GAP-RAG-001`。新增索引、source、embedding/reranker、memory class、citation 类型或 retention 变化时，必须更新本文和 [评测规范](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md)。
