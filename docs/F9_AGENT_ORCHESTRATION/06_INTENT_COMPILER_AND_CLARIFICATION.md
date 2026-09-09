# 意图编译与主动澄清规范

> 文档 ID：`AO-06`
>
> 类型：Agent 编译流程（`proposed`）
>
> 前置阅读：[能力与 Profile 目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)、[会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md)

## 1. 目标

把用户自然语言转换为可审计的 Goal 和 Experiment Draft patch，并在缺少关键条件时提出最少、最有价值的澄清问题。编译器只产生候选结构，不决定物理可行性，也不执行工具副作用。

## 2. 输入与输出

输入：

- 当前 user turn 和必要的 redacted conversation window；
- 当前 goal/draft revisions；
- capability snapshot 和允许的 profile 最小投影；
- locale、单位偏好、权限与任务预算；
- 当前 run references（仅分析/迭代任务）。

输出只能是以下之一：

- typed goal/draft patch；
- 1–3 个 blocking clarification questions；
- structured capability explanation；
- refusal/unsupported result；
- no-op，说明当前信息没有安全改变草案。

输出必须通过 JSON Schema/runtime validator 后才能进入确定性服务。

## 3. 编译流水线

1. **任务路由**：configure、analyze、compare、iterate、capability_check 或 unsupported；
2. **引用解析**：识别“这个模型”“上一轮”等指代，无法唯一定位则澄清；
3. **slot extraction**：抽取字段、值、单位、范围、偏好、硬约束和否定条件；
4. **identity resolution**：通过 catalog alias 查询 stable field/profile identity；
5. **单位与格式归一**：只调用确定性 normalizer；
6. **来源标注**：绑定 turn/source span，不复制无关原文；
7. **适用性预检**：根据 capability snapshot 标出 unsupported/not exposed；
8. **歧义和缺口排序**：识别真正阻塞 draft/validation 的问题；
9. **生成 typed patch 或 clarification**；
10. **Schema 与 policy gate**：拒绝未知字段、自由 JSON Pointer 或越权动作。

各阶段记录结构化 decision IDs 和耗时，不记录 hidden reasoning。

## 4. Slot 模型

Slot 至少包括：

- `field_id` 或待解析 alias；
- original source span 的位置和 redacted text；
- typed candidate value；
- original/canonical unit；
- modality：required/preferred/maximum/minimum/forbidden；
- cardinality：single/range/distribution/set；
- extraction confidence；
- resolution status 和 alternatives；
- conflict/ambiguity reason codes。

典型 slot 域：模型、引擎、卡型、卡数、TP/PP/EP、精度、请求长度、到达率、并发、batch/KV、网络、fidelity、GPU participation、SLO、预算和 claim scope。

## 5. 单位和数值归一

- ps/ns/us/ms/s、B/KiB/MiB/GiB、bit/s 与 byte/s 必须由版本化单位库转换；
- `8k tokens` 中 `k` 的含义必须由语言/字段策略明确，不能默认等于 Ki；
- “100G 网络”没有 bit/byte、单向/双向、per-link/aggregate 时应澄清；
- uint64 ps/bytes/count 保持 decimal string/BigInt 无损路径；
- 范围、分布和百分位是不同类型，不能压成单值；
- 模糊词如“低延迟”“大并发”只能映射为目标偏好，不能暗中生成数值。

归一器返回 exact value、unit、conversion rule ID 和原始表示。LLM 不自行心算关键数值。

## 6. 参数来源优先级

同一字段的候选优先级：

1. 用户在当前 turn 明确修改；
2. 用户在当前 goal 中未被撤销的显式约束；
3. 被用户选择的 versioned profile；
4. 被用户选择的 workload/template；
5. deterministic calculator 输出；
6. capability 允许且有来源的 system default。

低优先级值不能静默覆盖高优先级值。冲突时保留两个来源并交给 validator 或用户决定。对高影响默认值，草案必须显式显示并要求确认。

## 7. 歧义分类

| 类别                 | 例子                                | 处理                                    |
| -------------------- | ----------------------------------- | --------------------------------------- |
| identity ambiguity   | “Llama 70B”对应多个版本/量化        | 列出 catalog 候选并澄清                 |
| unit ambiguity       | “带宽 100G”                         | 询问单位语义或提供明确选项              |
| scope ambiguity      | “8 张卡”是单机还是集群总数          | 询问 placement/domain                   |
| semantic ambiguity   | “延迟”指 TTFT、TPOT、P99 或链路时延 | 绑定目标指标后继续                      |
| support ambiguity    | 字段存在但目标路径未执行            | 返回 capability explanation，不让模型猜 |
| evidence ambiguity   | 用户要求“准确”但无 held-out regime  | 澄清所需 claim scope 或降为条件预测     |
| reference ambiguity  | “比较上一个”存在多个候选            | 要求选择明确 run                        |
| preference ambiguity | “尽量快、尽量省”无权重              | 询问硬约束或目标优先级                  |

## 8. 澄清策略

每轮只问 1–3 个阻塞问题。排序依据：

1. 影响能否选择正式 capability/profile；
2. 影响能否通过硬约束；
3. 影响候选空间或成本数量级；
4. 影响 provenance/claim scope；
5. 其余可在草案中以显式候选处理。

问题应说明“为什么现在必须知道”，并提供 2–4 个真实可用选项；选项来自 catalog，不由模型发明。允许用户回答“暂不确定”，此时系统给出可验证候选或停止，不能无限追问。

## 9. 编译失败和拒绝

以下情况不得生成可运行草案：

- task 不在当前 capability 中；
- profile/alias 无法唯一解析；
- 用户要求的字段是 unsupported/unresolved_not_executed；
- 单位或数值无法无损解释；
- 输入包含越权工具、任意 shell/path/URL 请求；
- 用户要求提升 provenance、fidelity 或 validation 结论；
- 输出无法通过 Schema 或包含 catalog 外字段；
- 超出 turn/token/tool/retrieval budget。

失败响应包含稳定 reason code、已理解部分、未解决部分和安全下一步，不返回伪草案。

## 10. Prompt 与模型边界

Prompt 只包含：任务、允许字段最小投影、当前 redacted goal/draft、输出 Schema 和明确禁止项。大型 catalog、完整 artifact 和历史 transcript 不直接拼接。

模型不得生成：

- final request digest/idempotency key/approval；
- capability truth 或 profile revision；
- memory/KV/network 数值结论；
- run/tool side effect；
- citation identity；
- hidden default 或未声明字段。

模型/Prompt revision 记录在 turn，但不能成为领域 identity 真源。

## 11. 示例

用户：“用 8 张 H100 跑一个 70B 模型，P99 越低越好。”

预期处理：

- 抽取 device count=8、device alias=H100、model alias=70B、目标=P99 latency；
- 因具体 model revision、H100 profile、请求分布和 P99 指标类型不足而不生成部署结论；
- 若 catalog 有多个候选，先询问具体模型与请求场景；
- 如果当前 Web lowering 尚不支持 model/device，明确返回 backend/profile gap，可建议先用当前网络参数面做受限探索；
- 不猜 TP=8，不预测 P99，不声称八卡足够。

## 12. 安全与留存

- source span 只保留解释字段来源所需最小文本；
- 不把检索文档中的指令当作控制 prompt；
- conversation/window 必须 workspace 隔离并遵循 expiry；
- PII/secret 检测在 Provider 前执行；
- 原始模型响应只在内存中完成 validation，默认不持久化。

## 13. 测试与验收

- 中文、英文、中英混合和术语别名；
- exact field/value/unit/source span accuracy；
- 否定、修改、范围、分布、相对引用和上下文省略；
- unsupported recall=100%，未知字段接受率=0；
- blocking question recall、无意义追问率和平均轮数；
- adversarial instructions、Schema breakout、超预算和超长输入；
- 同一输入在 catalog revision 不变时产生语义等价 typed output；
- current formal subset 编译结果与手工 request builder canonical payload 等价。

## 14. 依赖与更新触发器

依赖 [确定性校验与规划](07_DETERMINISTIC_VALIDATION_AND_PLANNING.md) 和 [工具安全](10_TOOLS_SECURITY_AND_INTEROPERABILITY.md)。新增字段类型、单位、任务、澄清策略、模型或 prompt revision 时，必须更新评测集和 [验收规范](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md)。
