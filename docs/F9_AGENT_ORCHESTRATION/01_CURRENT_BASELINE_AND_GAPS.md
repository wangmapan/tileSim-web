# 当前基线、能力矩阵与缺口

> 文档 ID：`AO-01`
>
> 类型：事实基线
>
> 前置阅读：[约束与术语](00_GUARDRAILS_AND_GLOSSARY.md)

## 1. 审计范围

本基线来自：

- 后端 execution evidence commit `7e5a8c6a5cf738bd24608b440a61b62dee8d1881`（审计父基线
  `09c22c0efff890253a1eacf403c2979f56fd9ba6`）；
- Web runtime commit `64a741f3dfc76ef4b80352f1ca1197428de1ab25` 与 reproducibility follow-up
  `df1f24452384d328ce402ffa37affbd8c734da13`；
- `AgentOrchestration`、工作负载描述语言、引擎 profile、候选探索、WindTunnel；
- Bridge create-run/experiment descriptor/custom input/design-space schemas；
- 当前 Evidence Agent v2 descriptor 与 v1 request/response/citation/snapshot。

工作树未提交内容不构成发布基线，也不得被本任务清理或覆盖。

### 1.1 Phase 0D pre-commit 事实（2026-09-09）

- nested v1 保留 partially_calibrated、旧五类 claim scope、oversubscription 下界 0.000001、
  包含 uncertainty/tail-risk 的 uniqueness，且不应用新 DES aggregate budget。
- nested v2 承载 uncalibrated、exploratory、oversubscription 下界 1、六执行输入 uniqueness 和 DES aggregate budget。
- create-run identity 保持 v1；缺 nested identity 固定为 v1，v1/v2 identity 参与原始 canonical payload digest，
  unknown identity fail closed。
- Capability Catalog/snapshot/parameter descriptor 和五类 Profile v1 Schema 已正式进入源码契约；八字段为
  agent_exposed，五类实际 Profile 为 0/unavailable，未公开能力仍为 not_exposed。
- 八字段 execution evidence 已绑定后端 commit `7e5a8c6a…`，Git 可复现性 oracle 为 8/8；三项新增差分仍只证明
  synthetic consistency，不构成 calibration 或 held-out validation。
- Web runtime 与 Windows UTF-8 oracle portability follow-up 均已形成 Git commit；docs/evidence 仍未提交。这些 commit
  不是 5173 deployment，也不构成 live evidence。

## 2. 后端当前闭合程度

### 2.1 已有能力

- Analytical 端到端功能闭环；
- 已建模路径的确定性 DES；
- 分区 DES replay、差分、checkpoint 和恢复；
- 网络信用流控的局部 Cycle 窗口；
- 六类 Trace package intake、来源和摘要校验；
- 运行级 metrics、tail attribution、execution envelope、validation、run-bound evidence；
- 网络与硬件资源候选的 Analytical 筛选和选择性 DES；
- 工作负载描述语言的任务场景、系统结构、执行过程和证据来源；
- vLLM、SGLang、TensorRT-LLM 的最小版本化语义 profile；
- 固定步骤的结构化 Agent 编排 CLI。

### 2.2 尚未闭合

- 真实 H100/网络校准与独立 held-out 验证；
- 生产级六类 Trace 逐对象原生装载；
- 通用 Cycle；
- 广覆盖引擎语义；
- 模型/设备/网络 profile catalog；
- 模型、卡数、TP/PP/EP 到完整运行输入的正式 Web lowering；
- 全模块联合设计空间；
- 自然语言、多轮澄清、审批、工具和 durable workflow。

## 3. 当前结构化 Agent 编排

当前 `tilesim.agent.structured_intent.v1alpha1` 只支持：

```text
parse intent
  -> validate constraints and provenance
  -> freeze trace/topology configuration
  -> execute hosted range
  -> query requested artifacts
```

它没有模型调用，也没有自然语言对话。已证明的性质包括：

- 只允许已知字段和 `action=run_range`；
- Trace kind 必须与入口兼容；
- provenance 组合 fail closed；
- 输入文件有大小限制和运行前后内容检查；
- 配置 digest 与 run instance identity 可重复；
- calibrated/held-out 自报因缺少认证 evidence binding 被拒绝；
- 通用 Cycle 请求失败关闭。

可复用部分是“确定性工具序列、冻结配置、错误分类和 artifact 查询”，不能直接拿它当新会话协议。

## 4. 当前正式 Web 运行面

Bridge 正式 create-run identity 是 `tilesim.bridge.create_run_request.v1`，当前能力：

- scenario：`s1_des_example`；
- fidelity：`default`、`des`；
- GPU participation：`gpu_free`；
- input modes：controls、JSON、synthetic Trace package；
- 一个受控 runtime trace + topology custom input；
- strict network/hardware design-space manifest；
- idempotent create-run 与运行状态恢复。

普通表单正式暴露八个参数：

| 中文模块                       | 参数                                                |
| ------------------------------ | --------------------------------------------------- |
| 工作负载抽象与负载描述语言模块 | message size multiplier                             |
| 推理引擎与服务运行时模块       | batch scheduler、max batch size、KV capacity tokens |
| 网络与硬件资源模块             | 纵向/横向扩展网络 bandwidth 和 latency              |

执行语义、KV Cache 物理语义、设备性能和集合通信的更多参数保持 `not_exposed`。

## 5. 参数能力状态

| 参数域                    | Schema 描述                            | 确定性校验                  | 当前普通 UI | 当前执行影响                 | 状态                             |
| ------------------------- | -------------------------------------- | --------------------------- | ----------- | ---------------------------- | -------------------------------- |
| 模型 ID                   | 有                                     | 非空                        | 无          | 主要为身份                   | `backend_gap`                    |
| 模型结构/权重/dtype       | 无正式 catalog                         | 无统一校验                  | 无          | 无正式 lowering              | `contract_gap` + `data_gap`      |
| 引擎类型/语义版本         | 有三个 profile                         | 有版本/feature 校验         | 无          | 局部状态机有影响             | `backend_gap`                    |
| 卡型                      | topology `device_type`                 | 字符串级                    | 无          | 无版本化性能真源             | `data_gap`                       |
| 卡数                      | device list                            | 唯一性与 placement 部分校验 | 无          | custom topology 可影响参与者 | `backend_gap`                    |
| 张量并行                  | 工作负载与 runtime request 有字段      | 范围/设备数部分校验         | 无          | 局部路径可使用               | `backend_gap`                    |
| 流水线并行                | 工作负载描述语言有字段                 | 与设备数校验                | 无          | 未形成正式 Web 累计链        | `backend_gap`                    |
| 专家并行/MoE              | 工作负载描述语言有字段                 | 专家数、top-k、整除约束     | 无          | 未形成正式联合执行面         | `backend_gap`                    |
| 请求数量/长度/到达        | 工作负载描述语言和 custom trace 有字段 | 有范围与 bounded array      | JSON        | custom runtime path 可使用   | `current_fact`，但不是普通配置面 |
| batch/scheduler           | 有                                     | 有                          | 有          | 写入 runtime trace           | `current_fact`                   |
| KV capacity               | 有                                     | 有                          | 有          | 写入 runtime trace           | `current_fact`                   |
| KV page/handoff/watermark | custom trace 有                        | 有                          | 无          | 部分 runtime 语义            | `backend_gap`                    |
| 网络带宽/延迟             | 有                                     | 有                          | 有          | 写入 topology binding        | `current_fact`                   |
| 复杂 topology             | custom input 有                        | 有                          | JSON        | 当前网络执行可使用           | `current_fact`，专业 UI 缺失     |
| SLO                       | 候选 promotion policy 有局部字段       | 局部                        | 无          | 不是正式 create-run 目标     | `contract_gap`                   |
| 设计空间                  | strict manifest                        | 有                          | 有入口      | 网络与硬件资源、固定双端点   | `current_fact`，范围受限         |
| 真实容量规划              | 无充分资产                             | 不可验收                    | 无          | 无 held-out 证据             | `data_gap`                       |

## 6. 当前引擎 Profile

| 引擎         | 语义版本                        | 已声明支持                                                                        | 已声明不支持                                      |
| ------------ | ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| vLLM         | `vllm.0.6.semantic.v1`          | continuous batching、chunked prefill、prefix cache、preemption recompute          | speculative decode、pipeline parallel async       |
| SGLang       | `sglang.0.4.semantic.v1`        | continuous batching、chunked prefill、radix prefix cache、prefix-aware scheduling | speculative decode、hierarchical cache controller |
| TensorRT-LLM | `tensorrt_llm.0.12.semantic.v1` | inflight batching、paged KV cache、capacity-aware scheduling                      | speculative decode、disaggregated serving         |

这些版本是语义 profile 基线，不等于对应真实软件版本的完整行为模型，也不代表经过真实设备校准。

## 7. 当前设计空间边界

strict candidate 可执行字段：

- bandwidth；
- base latency；
- oversubscription；
- request count；
- message bytes；
- release interval。

执行使用两个固定 endpoint 的网络与硬件资源模型。runtime scheduler、KV policy、device profile 和 MoE placement 在正式报告中保持 `unresolved_not_executed`。Agent 不得把这些字段放进排名解释。

## 8. 当前 Evidence Agent

### 8.1 已有

- 当前 run/request 的四类 descriptor-driven task；
- canonical request、idempotency lease、严格 response validator；
- atomic claim 与精确 citation；
- stale 隔离；
- partial/refused/truncated 和两类 409；
- 502/503/504 正式终态；
- authenticated capability probe。

### 8.2 没有

- conversation/session；
- Agent 主动澄清；
- 持久分析历史；
- 跨 run 比较；
- 工具调用；
- SSE/cancellation；
- live Provider acceptance repetitions 和双人 citation entailment review。

## 9. 当前测试证据解释

`D:\tileSim-web\AGENTS.md` 当前记录 61/61 后端 CTest、265/265 frontend、78/78 Bridge、29/29 fixture Playwright，F9 live model repetitions 为 0。这些是历史或当前交接事实，后续实现必须重新运行相关门禁。

测试通过只能证明功能/契约行为，不等于真实系统 fidelity。真实校准和 held-out validation 必须使用相应证据资产。

### 9.1 Phase 0 capability/Profile 批次（2026-09-08）

- 已建立 parameter descriptor、capability snapshot 与五类 Profile 的 `proposal_only` Schema、fixture 和
  Python/TypeScript canonical digest vectors；它们不属于正式 OpenAPI 或 schema-set。
- 已审计当前八个正式字段。八字段均有 descriptor、request Pointer、确定性校验、Bridge lowering、后端执行影响和
  artifact/test 证据；它们均未完成真实校准或独立 held-out validation。
- 当前可观察性是 input artifact 与执行事件/指标的组合证据，尚无稳定的 per-field causal receipt，因此正式 capability
  catalog 退出条件仍未满足。
- model、device、topology、workload template 缺正式 versioned Profile 真源；engine 只有三个最小 conditional semantic
  profile，且 create-run v1 不能选择 engine。
- 独立 Eval/Security 数据集包含 33 个 fixture case，并覆盖 unknown、alias ambiguity、expiry/revocation、revision drift、
  source/regime 缺失、证据自报升级、uint64、单位、边界、组合冲突和 Agent 暴露闭包。该结果是 fixture consistency，
  不是 live、calibration 或 held-out evidence。
- 本批没有发布 successor，也没有修改 Evidence Agent v2/v1 family、create-run v1 或运行中 5173。
- 全仓门禁期间，工作树出现不属于本批 ownership 的正式 F8 contract/generated/UI 改动；其源码 schema-set revision
  变为 `sha256:2214c4eae8361bc46fce52163832eb0ba9b9438692c2ff147cbd1b56a2df2af8`，源码 experiment descriptor revision
  变为 `sha256:1ef962150e0cfa19d27116a3176f23881f7a790cd23b8ef4ebaf3e7885aef4f1`。

### 9.2 Phase 0B publication candidate 与 drift 裁决（2026-09-08）

- 只读审计发现 5173 已由本任务之外的动作更新为上述 `2214c4…` / `1ef962…` deployed state；本任务没有部署、
  停止或重启它。部署对齐不构成源码发布或兼容证明。
- F8 在复用 `tilesim.design_space.s6_candidates.v1` / create-run v1 identity 下破坏五类旧 payload：provenance、
  claim scope、oversubscription 下界、canonical candidate uniqueness 和 DES promotion aggregate budget。
  具名 owner/handoff 未验证，`bridge/test_f8_schemas.mjs` 仍失败；`GAP-CONTRACT-DRIFT-001` 保持 `open/blocking`。
- Phase 0B capability publication candidate identity 为 `tilesim.bridge.agent_orchestration_capability_catalog.v1`；package、
  catalog、snapshot digest 分别为 `sha256:cf2f833d…a49a0`、`sha256:dd895477…b9fa5`、
  `sha256:6dc417cc…185fd`。它只存在于 publication-candidate 路径，未加入正式 OpenAPI/schema-set/manifest/runtime。
- candidate 把 source target 表示为 `target_pending/unavailable`，没有把 Git HEAD 或 dirty/5173 revision 冒充最终目标。
  八字段投影与五类空 Profile family 通过 41/41 独立 oracle，但 Phase 1 DoR 仍为 `blocked`。

### 9.3 Phase 0C 双版本与正式发布（2026-09-09）

- nested v1 旧语义、nested v2 严格语义及 create-run v1 双版本兼容均已实现；独立 28/28 oracle、
  F8 Schema runner、canonical/idempotency 和 retained v1 replay 均通过。
- Phase 0D 重绑定后的 Capability Catalog revision 为
  `sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b`；contract package revision 为
  `sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3`。
- 正式 snapshot endpoint、manifest/OpenAPI、generated types/runtime validators 和 Web 只读 adapter 已闭合；
  release source identity 与 catalog content digest 分开，未在 contract 中嵌入未来 commit。
- 三个 Gap 已达到 `validated`；后端 evidence、Web runtime/reproducibility commits 与最终 closure 均已形成。

### 9.4 Phase 0D 双仓库可复现性收口（2026-09-09）

- 后端三文件 evidence commit 为 `7e5a8c6a5cf738bd24608b440a61b62dee8d1881`；Catalog 八条 reference 的
  repository/revision/path/test_case 均可从该 commit 解析。
- Web runtime/reproducibility commits 为 `64a741f3dfc76ef4b80352f1ca1197428de1ab25` 与
  `df1f24452384d328ce402ffa37affbd8c734da13`；runtime/reproducibility HEAD snapshot revision 为
  `sha256:2411a70b7e39efc81afed7f92504b685ad9dfd8c4d3a551f7b30487db98673a0`。
- Catalog/schema-set revision 分别为 `sha256:726e59ba…aa7b` 与 `sha256:3211d2df…c15d`；以当前 Web HEAD 和
  后端 evidence commit 构造的 pre-commit snapshot vector 为 `sha256:90869411…0df9`。
- F8 compatibility 为 28/28，Phase 0D oracle unit 为 5/5，完整 Bridge 为 105/105，frontend 为 417 passed、
  7 skipped，desktop fixture E2E 为 47 passed、5 个 deployed/live tests skipped。
- Web runtime 与 docs/evidence 必须分别按精确 allow-list 获得授权；不得把 launcher、deployment、Evidence Agent、
  Trace prototype、mixed-ownership 文档或 Phase 0 proposal 包带入提交。

## 10. 优先缺口

| 优先级 | Gap                                                | 原因                                      |
| ------ | -------------------------------------------------- | ----------------------------------------- |
| P0     | `GAP-CAP-001` 参数能力目录                         | validated；8/8 与 snapshot closure 完成   |
| P0     | `GAP-PROFILE-001` Profile family                   | Schema 已发布；真实数据仍为独立后续 Gap   |
| P0     | `GAP-CONTRACT-DRIFT-001` 正式契约漂移              | validated；双版本与 revision closure 完成 |
| P0     | `GAP-DRAFT-001` typed experiment draft             | LLM 输出无法安全进入正式运行面            |
| P0     | `GAP-VALIDATE-001` deterministic validation report | 缺少跨 profile/参数的统一可行性结果       |
| P1     | `GAP-CONV-001` conversation/turn                   | 不能正式多轮澄清                          |
| P1     | `GAP-APPROVAL-001` approval envelope               | 不能安全授权写操作                        |
| P1     | `GAP-WORKFLOW-001` operation/event/checkpoint      | 不能 durable 执行与取消                   |
| P1     | `GAP-RAG-001` evidence index/retrieval             | 当前证据选择面有限，无法评测召回          |
| P2     | `GAP-COMPARE-001` comparability contract           | 不能正式跨 run 分析                       |
| P2     | `GAP-TOOLS-001` tool registry/permission           | 不能安全扩展工具生态                      |
| P3     | `GAP-A2A-001` external agent gateway               | 只有外部集成需求出现后才需要              |

完整状态见 [契约缺口登记表](14_CONTRACT_GAP_REGISTER.md)。

## 11. 基线更新触发器

以下事件发生时必须更新本文件：

- Bridge 发布新的 create-run 或 experiment descriptor；
- 工作负载描述语言正式接入 Web 托管运行；
- 新 profile 或引擎 feature 进入累计链；
- 设计空间不再是网络与硬件资源限定范围；
- 真实校准或 held-out 资产完成；
- Evidence Agent descriptor/request/response 版本变化；
- 当前测试或 live acceptance 状态变化。
