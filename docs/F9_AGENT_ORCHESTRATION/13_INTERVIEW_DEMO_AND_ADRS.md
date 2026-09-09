# 面试 Demo、作品材料与 ADR 计划

> 文档 ID：`AO-13`
>
> 类型：作品交付与决策记录（`proposed`）
>
> 前置阅读：[产品体验](02_PRODUCT_AND_USER_EXPERIENCE.md)、[路线图](12_DELIVERY_ROADMAP_AND_BACKLOG.md)

## 1. 目标

把项目展示为一个严谨的“自然语言 → typed 草案 → 确定性校验 → 人工审批 → 可恢复仿真 → 精确证据”的系统工程作品。演示必须区分当前已实现能力、目标设计和真实验证状态。

## 2. 核心叙事

建议表述：

> TileSim 是一个网络中心的大模型推理仿真平台。我为它设计并逐步实现 contract-first 的对话式研究 Agent：语言模型只理解目标和解释结果，版本化 Profile 与确定性求解器负责参数和可行性，人工审批后复用正式仿真入口，结果通过分域 RAG 和精确 citation 回到可验证证据；工作流同时验证幂等、崩溃恢复、取消、权限和 prompt injection。

这比“接了一个模型聊天”更能体现领域建模、后端契约、Agent 工程、可靠性、安全、评测和产品设计。

## 3. 两套 Demo 状态

### 3.1 当前事实 Demo

只能展示当前正式八参数、现有 run 和 Evidence Agent 四类任务。明确说明：单轮、无主动澄清、无工具/跨 run；live repetitions 为 0 时不声称模型已验收。

### 3.2 目标闭环 Demo

只有相应 phase 和门禁完成后，才展示模型、卡数、TP/PP/EP、审批创建 run、恢复、RAG 和比较。未完成部分使用架构图/contract 说明，不能用 fixture 假装生产能力。

## 4. 十分钟目标 Demo

| 时间       | 演示                                     | 要证明的能力                            |
| ---------- | ---------------------------------------- | --------------------------------------- |
| 0:00–1:00  | 输入模型、卡数、引擎、请求和 SLO 目标    | 自然语言任务不是固定四问                |
| 1:00–2:00  | Catalog 解析 profile 并只问两个阻塞问题  | 能力真源和主动澄清                      |
| 2:00–3:00  | 生成两个 typed draft，显示字段来源       | 可审计、无隐藏默认                      |
| 3:00–4:00  | 故意设置冲突 TP/PP/EP                    | 确定性 validator 拒绝                   |
| 4:00–5:00  | 展示显存/KV/网络假设、预算和 claim scope | 专业性与准确性                          |
| 5:00–6:00  | 用户批准 exact diff 后创建 run           | human-in-the-loop 和权限                |
| 6:00–7:00  | 注入 worker crash 并恢复                 | checkpoint/idempotency，无重复 run      |
| 7:00–8:00  | 展示结论、依据、限制、下一步             | 结果易读且证据化                        |
| 8:00–9:00  | 展开 citation 并比较兼容 run             | SHA/Pointer/owning run 和 comparability |
| 9:00–10:00 | 注入恶意文档/越权工具                    | prompt injection/permission hard gate   |

## 5. 当前能力下的可执行 Demo

在 Phase 1 前可用 5–7 分钟：

1. 展示 descriptor 驱动的四类 Evidence Agent 任务；
2. 提交前说明 request、可引用证据数量、可信范围和等待；
3. 展示 atomic claims 的结论/依据/限制；
4. 展开 run/artifact/schema/SHA/Pointer/subject；
5. 用 fixture 演示 stale、两类 409、502/503/504，并明确 fixture 身份；
6. 展示总方案、能力矩阵和 Gap Register，说明为何当前不模拟多轮或卡数建议。

## 6. 故障注入清单

- catalog/profile revision drift；
- malformed LLM structured output；
- unsupported field；
- impossible parallel/placement；
- approval expired/mismatch；
- create-run commit 前后 crash；
- duplicate event/SSE reconnect；
- cancel fence 后 late terminal；
- retrieval miss/contradiction；
- invalid citation/uint64 boundary；
- malicious artifact/tool result；
- cross-workspace resource reference。

每次故障展示“系统拒绝了什么、保留了什么、用户如何继续”，不只展示报错堆栈。

## 7. 离线与现场保障

- 准备固定、明确标注的 offline fixtures，不依赖现场 Provider；
- 准备 live 与 fixture 状态指示，避免误述；
- 预生成但可验证的 run artifacts，保留 schema/SHA；
- 不在演示前替换用户的 5173；
- 有 2 分钟短版和架构-only fallback；
- 录屏只作为备用，不替代可重复测试；
- 演示分支/commit、dataset、命令和结果冻结。

## 8. 架构讲解要点

- 为什么不让 LLM 计算显存、KV 或网络；
- 为什么 Schema 字段、accepted、executed、calibrated、held-out 是不同状态；
- 为什么 KV Cache、设备性能和集合通信是并列资源语义；
- 为什么 Trace source、GPU participation 和 fidelity 正交；
- 为什么 approval 绑定 digest 而不是自然语言；
- 如何处理 crash-before/after commit；
- 为什么 exact/metadata/BM25 在数值证据前优先于向量检索；
- 如何保证 atomic claim 和 citation 不跨 run；
- 为什么先单 Agent graph，后按权限/评测拆分。

## 9. ADR 清单

每份 ADR 包含 context、decision、alternatives、consequences、security/evidence impact、migration、test 和 revisit trigger。

| ADR          | 决策                                             |
| ------------ | ------------------------------------------------ |
| `ADR-AO-001` | contract-first typed draft，不执行自由 JSON/CLI  |
| `ADR-AO-002` | LLM 与 deterministic validator/calculator 分工   |
| `ADR-AO-003` | capability/profile 多维状态而非单一 supported    |
| `ADR-AO-004` | 单 Agent typed workflow 优先于开放多 Agent       |
| `ADR-AO-005` | approval 绑定 exact digests/revisions            |
| `ADR-AO-006` | operation/event/checkpoint 与幂等提交模型        |
| `ADR-AO-007` | 四类独立索引和 retrieval ladder                  |
| `ADR-AO-008` | atomic claim/citation validation 和 no-answer    |
| `ADR-AO-009` | 内部 typed tools，MCP 仅适配层                   |
| `ADR-AO-010` | 最小 retention、无 hidden reasoning/raw response |
| `ADR-AO-011` | deterministic hard gates + semantic eval         |
| `ADR-AO-012` | A2A/GraphRAG/reviewer Agent 按收益后置           |

## 10. 仓库作品材料

建议形成：

- 当前能力与限制清晰的 README；
- 本 AI 可读文档集；
- versioned schemas/generated clients；
- 体系化 fixtures/eval dataset；
- crash/security/citation 测试；
- 一份 redacted eval report；
- ADR 目录；
- Demo 脚本、架构图和录屏；
- 已知限制、真实校准和 live status 页面。

不要提交私有主设计文档、credential、Provider raw response、真实敏感 artifact 或未授权模型数据。

## 11. 可量化简历证据

只填写实测值：

- N 个双语意图的字段/单位准确率；
- 首次有效草案率、平均澄清轮数、time-to-first-run；
- N 个 profile/constraint rules 和累计链覆盖；
- RAG recall@5、citation precision、no-answer false positive；
- N 个 crash points、恢复率和 duplicate side effects；
- N 条 adversarial cases 的 bypass rate；
- p95 latency、token/cost 和 reranker 增益；
- 外部用户任务完成率。

禁止写没有测量的“提升 30%”，也不把 CTest 数量当作 Agent 产品准确率。

## 12. 面试问答准备

需要能回答：

- 为什么不是普通 RAG Chatbot？
- 为什么不用一个热门框架直接完成？
- 如何保证模型不越权或重复创建实验？
- 如何验证 citation 真支持 claim？
- 模型/卡数建议在缺少真实校准时有何意义？
- 如果 embedding、GraphRAG 或多 Agent 没有收益怎么办？
- 怎样把当前单轮 Evidence Agent 迁移到新会话而不破坏 v1/v2？
- Windows 本地开发与 Linux-first 后端验证如何协调？

回答必须引用 ADR、测试和实际指标，而不是只谈概念。

## 13. 验收

- 演示从 clean documented setup 可重复；
- 现场不需要读取/展示 secret；
- 当前事实和目标设计有视觉/语言区分；
- 每个关键动作能展开对应 contract/event/citation；
- 至少一个 validator 拒绝、一次 crash 恢复和一次 injection 拒绝；
- 所有展示指标可追溯到 eval report；
- 未实现能力不会以 mock/live 混淆。

## 14. 更新触发器

每完成 phase、ADR 决策、live/eval 状态或 Demo 能力变化时更新本文。若演示内容超过 [当前基线](01_CURRENT_BASELINE_AND_GAPS.md)，先更新基线和正式 runtime descriptor。
