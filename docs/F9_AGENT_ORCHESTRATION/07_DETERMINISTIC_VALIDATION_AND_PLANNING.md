# 确定性校验与实验规划规范

> 文档 ID：`AO-07`
>
> 类型：领域校验与规划设计（`proposed`）
>
> 前置阅读：[能力与 Profile 目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)、[意图编译](06_INTENT_COMPILER_AND_CLARIFICATION.md)

## 1. 目标

用确定性代码判断实验草案是否可表达、可执行和在什么证据范围内可解释，并生成数量受控的候选。LLM 可以解释结果，但不能参与关键算术、约束求解、排序或准入。

## 2. 输入与输出

输入：immutable draft revision、capability/profile snapshots、validation policy、backend/schema identity、预算和用户目标。

输出：正式 Validation Report，包括 blocking errors、warnings、unknowns、calculator receipts、compiled request、candidate plan、等待/成本估计及 claim-scope ceiling。

所有 calculator 输出都必须带算法 revision、输入 references、单位、舍入策略和 uncertainty/unknown 状态。

## 3. 校验层次

按顺序 fail closed：

1. Schema/type/uint64/enum；
2. field applicability 和 capability 状态；
3. profile identity/revision/completeness；
4. 单字段范围；
5. 跨字段和组合约束；
6. lowering/execution/evidence coverage；
7. resource feasibility；
8. fidelity/provenance/claim scope；
9. budget/candidate limits；
10. compiled request canonical validation。

后续层不能把前一层的 unknown 自动变为 pass。

## 4. Validation Issue

每个 issue 包含：stable rule ID、severity（error/warning/info）、blocking、status（fail/unknown/stale）、field/profile references、机器可读 facts、用户说明、repair candidates 和 supporting receipt。

禁止把 unknown 降格为 warning 后继续创建 run。允许运行的 warning 必须有明确 policy 和可接受的 claim scope。

## 5. Memory 与权重计算器

计算器分别报告：

- model weights；
- runtime/engine 固定开销；
- activations/workspaces；
- KV Cache capacity；
- fragmentation/reserve；
- per-device placement 和余量；
- unknown/unmodelled portions。

权重和 KV 计算必须读取 model profile、dtype/quantization 和 engine/KV semantic profile，不使用通用“70B × 2 bytes”替代正式 profile。若公式需要未知布局、压缩或共享参数，结果为区间或 unknown。

结果必须区分“静态可容纳”“运行时峰值估计”“经过实测校准”。通过显存校验不代表性能/SLO 可达。

## 6. KV Cache 计算器

输入至少包括模型 KV 结构、dtype、request length/distribution、并发、page/block semantics、prefix reuse、reserve/watermark 和 placement。

输出包括 bytes per token/request、logical capacity、physical occupancy range、fragmentation、eviction/handoff risk 和 assumptions。逻辑 cache policy 归推理引擎与服务运行时模块，物理页、驻留和传输归 KV Cache 建模模块，receipt 必须保持两者边界。

## 7. 并行与 Placement 校验器

校验：

- TP/PP/EP degree 和 device count 的整除/映射；
- model layer/expert/head 约束；
- engine profile 的 feature support；
- topology domain、link 和 endpoint connectivity；
- rank/device 唯一性和同域/跨域 placement 约束；
- collective semantic availability；
- workload 到 execution fragments 的 lowering coverage；
- failure/spare/reserved device policy。

它只判断配置结构和已建模路径，不根据卡数直接保证吞吐或时延。

## 8. 请求与工作负载校验器

校验请求数、prompt/decode 分布、arrival process、rate/burst/concurrency、prefix/session 语义、seed、trace source 和 scaling policy。生成 synthetic trace 时必须记录生成方法和 allowed claim scope；不能伪造 device/network execution observation。

请求分布的截断、离散化和采样误差必须进入 receipt。用户给出平均值时不能自动构造 P99 分布。

## 9. 网络与通信校验器

校验：

- bandwidth/latency 单位、方向和 per-link/aggregate；
- topology endpoints、links、domains、routing/transport binding；
- oversubscription、MTU、queue/credit compatibility；
- collective participants 与网络 endpoints；
- 纵向/横向扩展网络和 Tile 原生通信的适用范围；
- communication demand 与实际 path/queue/congestion state 的所有权。

网络 calculator 不能凭模型知识生成不存在的通信量；需求必须来自 workload/execution/collective 正式 lowering 或声明的 trace。

## 10. Fidelity、GPU 与 provenance 校验

分别校验 requested fidelity、resolved capability 和 execution mode。Trace source 与 GPU participation 是正交字段。

- real trace 可在 `gpu_free` 重放；
- `gpu_in_loop` 不自动等于 Cycle；
- GPU-assisted observation 不自动验证目标规模网络；
- Analytical/DES/Cycle 结论范围独立；
- synthetic consistency 不能提升为 calibrated/held-out validation。

无法满足用户所需 claim scope 时，validator 返回可运行但低范围候选或 blocking gap，由用户决定，不能修改 provenance 标签。

## 11. SLO 与预算规划器

SLO 必须有 metric identity、aggregation/percentile、scope、unit、target、measurement window 和 evidence requirement。TTFT、TPOT、E2E latency、throughput、P99 link latency 不能用“延迟”统一代替。

预算包括：candidate 数、run 数、fidelity promotion、最大事件/请求规模、wall-clock、Provider/tool token/call 和可选计算成本。预算门禁发生在副作用前。

若没有可靠性能 surrogate 或已校准模型，规划器只能把 SLO 作为筛选/观测目标，不能在运行前声称可达。

## 12. 候选生成

候选由确定性枚举、约束求解或版本化优化器生成，必须有：

- search dimensions 和允许值；
- 固定 seed/algorithm revision；
- hard constraints、objectives 和 tie-break；
- max candidates/runs/cost/time；
- pruning/promote/stop reasons；
- 每个候选与 base draft 的 exact diff；
- 哪些字段真实执行、哪些 unresolved。

第一阶段只在当前网络与硬件资源限定的正式设计空间内工作。TP/PP/EP、KV、device、runtime 或 MoE 未进入累计执行链前，不得放入 ranking。

## 13. 编译与请求等价

Validator 最后调用正式 request builder，生成：schema identity、canonical payload、digest、field-to-Pointer map 和 preview。当前八参数子集必须与现有手工表单 builder 逐字节 canonical 等价。

编译器不得：

- 丢失 uint64 精度；
- 把 missing 写成 zero/null；
- 发送 not_applicable 字段；
- 绕过 descriptor enum/range；
- 使用 profile 显示名代替 stable identity；
- 写入未 executed 字段。

## 14. 修复候选

每个 repair candidate 是 typed patch，包含解决的 rule IDs、新增假设、对预算/claim scope 的影响和是否需要用户确认。LLM 只能解释或排序用户偏好，不能改写 patch。

自动修复只允许无损、无歧义格式归一；卡数、并行、模型、请求分布、fidelity、provenance 和成本变化都需用户明确选择。

## 15. 错误与失败

区分：invalid、infeasible、unsupported、unknown、stale、budget_exceeded、calculator_unavailable、lowering_missing、profile_missing、evidence_scope_insufficient 和 internal_failure。每类都返回 retryable 和 safe next action。

计算器异常不能回退到 LLM 估算。部分 calculator 成功时 overall 仍按阻塞项决定，不能展示为完整 valid。

## 16. 安全与留存

Calculator 是纯函数或只读服务，不接收 credential、任意代码或任意路径。Receipt 保存 inputs 的 stable references/digests 和必要公开值，不复制敏感 profile 或用户 artifact。

## 17. 测试与验收

- property-based/boundary tests：uint64、单位、范围、整除、溢出和舍入；
- golden vectors：memory/KV/parallel/network/workload calculators；
- model × engine × device × topology × workload 风险组合；
- unknown/profile missing/unsupported/calibration missing；
- lowering 和 execution evidence coverage；
- candidate determinism、budget、tie-break、stop reason；
- synthetic/provenance/fidelity 不升级；
- compiled request 与现有 builder 等价；
- 累计链：工作负载 → 引擎 → 执行片段 → 资源语义 → 网络 → 请求指标。

所有 hard constraint 误放行为 0；未经执行字段进入候选或 ranking 为 0。

## 18. 依赖与更新触发器

依赖后端 profile、lowering 和 execution tests。算法、单位库、规则、profile schema、正式 request 或设计空间变化时，必须发布新 revision，重跑历史 golden/counterexample corpus，并更新 [能力目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)、[评测](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md) 与 [Gap Register](14_CONTRACT_GAP_REGISTER.md)。
