# 能力与 Profile 目录规范

## Phase 2D registry 数据收口（2026-09-12）

Capability Catalog/Profile v1 保持冻结：五类实际 profile 仍为 `0/unavailable`，其 identity、digest
和 agent-exposed closure 不变。Phase 2D 通过独立 registry 发布五条 Profile v2 数据记录（model、engine、
device、topology、workload），并为每个事实保留 source reference、source field、provenance kind 与
evidence scope。

registry 记录的 lifecycle 为 `available` 仅表示记录可被审计查询；其 `runtime_status=unavailable`、
`execution_status=missing`、`agent_exposed=false`、`calculator_eligible=false`、
`ranking_eligible=false`。因此查询/snapshot/binding 可用不等于 run intake、lowering 或 calculator 可执行。
校准与独立 held-out 均为 `missing`，synthetic/compatibility 记录最高只能声明
`synthetic_consistency`。未知、过期、撤销、来源/license/regime/provenance/digest/revision 不完整的记录
均 fail closed。

具体 profile id、来源和测试矩阵见 [Phase 2D Profile Data Acceptance](24_PHASE2D_PROFILE_DATA_ACCEPTANCE.md)。

> Phase 0D 发布状态（2026-09-09）：正式 catalog/snapshot/parameter descriptor 与五类 Profile v1 Schema 已进入
> Schema/OpenAPI/manifest/generated/runtime validator。Catalog revision 为
> sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b，contract package revision 为
> sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3。八字段正式 agent_exposed，
> 五类实际 Profile 仍为 0/unavailable。八字段 execution evidence 已绑定后端 commit
> 7e5a8c6a5cf738bd24608b440a61b62dee8d1881 并通过 8/8 Git 可复现性检查；Web runtime commit 为
> 64a741f3dfc76ef4b80352f1ca1197428de1ab25，reproducibility follow-up 为
> df1f24452384d328ce402ffa37affbd8c734da13，其 snapshot revision 为 sha256:2411a70b…673a0。当前未部署 release。

> 文档 ID：`AO-04`
>
> 类型：数据与契约设计（正式 v1 contract + 后续演进规则，对应 `GAP-CAP-001`、`GAP-PROFILE-001`）
>
> 前置阅读：[当前基线](01_CURRENT_BASELINE_AND_GAPS.md)、[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)

> Phase 0 实施状态（2026-09-08）：proposal Schema、fixtures、canonical vectors、八字段执行追踪与独立 oracle
> 已建立，但尚未通过正式 successor 评审，也未进入 OpenAPI、schema-set、manifest 或 generated client。
> 当前工作树另有范围外正式 F8 contract 漂移，见 `GAP-CONTRACT-DRIFT-001`；在 owner 完成 identity/兼容性裁决前，
> 本 proposal 不得作为修补或隐式 successor。

> Phase 0B 评审状态（2026-09-08）：已形成 identity/digest 冻结的 publication candidate，并由 41/41 独立 oracle
> 验证八字段闭包、五类空 Profile family、drift/uint64/canonical/redaction fail-closed。candidate 的
> `source_target_binding` 仍为 `target_pending/unavailable`。由于 F8 在复用 v1 identity 下存在 breaking change、
> 具名 owner 未交接且独立 F8 Schema runner 失败，正式发布继续阻塞。

## 1. 目标

建立 Agent、表单、validator 和后端共同使用的唯一能力真源，精确回答：一个参数是否可识别、可校验、可提交、真实执行、已校准、已独立验证，以及在哪些版本和条件下成立。

## 2. 非目标

- 不把现有 Schema 字段自动标记为可执行能力；
- 不把产品文档或 LLM 常识当作设备/模型性能 profile；
- 不在 catalog 中保存 credential、运行 artifact 正文或用户会话；
- 不用一个布尔 `supported` 抹平接受、执行、校准和验证差异。

## 3. 目录分层

目录由三类对象组成：

1. **parameter descriptor**：稳定字段 identity、类型、单位、约束、适用条件和 lowering；
2. **profile**：模型、引擎、设备、拓扑和工作负载模板的版本化事实集合；
3. **capability snapshot**：在特定 backend/schema/profile revisions 下，某字段或组合的可用状态。

## 4. Parameter Descriptor

每个 descriptor 至少包含：

| 字段                            | 含义                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `field_id`                      | 跨 UI/Agent 稳定身份，不使用显示名称作 key                   |
| `owner_module`                  | 中文模块所有者及必要的兼容代码标识                           |
| `value_type`                    | string/enum/boolean/int/uint64/decimal/object/list/reference |
| `canonical_unit`                | 规范单位；无单位时显式 `null`                                |
| `accepted_units`                | 输入别名、倍率和大小写策略                                   |
| `constraints`                   | min/max/step/enum/cardinality/relational rules               |
| `applicability`                 | 适用条件表达式及不适用原因                                   |
| `default_policy`                | none/profile/template/system，并标明来源 revision            |
| `request_target`                | 正式 request identity 与 JSON Pointer                        |
| `lowering_stage`                | 进入哪个后端模块的转换节点                                   |
| `evidence_outputs`              | 可证明字段被执行的 artifact/field references                 |
| `sensitivity`                   | public/internal/restricted/secret；secret 不进入 Agent       |
| `status`                        | 下述多维能力状态                                             |
| `introduced_at`/`deprecated_at` | 兼容生命周期                                                 |

### 4.1 多维能力状态

每个字段组合必须分别报告：

- `described`：有正式 descriptor；
- `accepted`：正式 request 能接收；
- `validated`：有确定性语法和跨字段校验；
- `lowered`：会进入拥有者模块；
- `executed`：在目标 execution path 中真实改变状态或事件；
- `observable`：有正式产物证明执行；
- `calibrated`：在声明 regime 绑定校准证据；
- `held_out_validated`：在声明 regime 有独立留出验证；
- `ui_exposed`：当前 Web 可提交；
- `agent_exposed`：Agent 可建议或写入草案。

只有 `accepted && validated && lowered && executed` 才能进入可运行草案。`calibrated` 和 `held_out_validated` 决定 claim scope，不决定字段是否能运行。

## 5. 支持状态和原因

状态枚举应至少区分：`available`、`conditional`、`not_exposed`、`unsupported`、`unresolved_not_executed`、`profile_missing`、`calibration_missing`、`temporarily_unavailable`、`deprecated`。

每个非 available 状态必须带稳定 `reason_code`、用户说明、阻塞依赖和可选替代。UI 或 LLM 不得根据 reason 文本反推状态。

## 6. Profile Family

### 6.1 Model Profile

最低字段：

- stable model ID、provider/organization、family、version/revision；
- dense/MoE、layer count、hidden size、attention/KV heads、head dimension；
- parameter count、active parameter count、expert count/top-k；
- supported dtypes/quantization、weight bytes 计算输入；
- context/token limits、KV bytes-per-token 的计算来源；
- tokenizer/reference identity（需要时）；
- observed/inferred/modelled 字段标签；
- evidence source、license、valid regime、expiry/deprecation。

不得只凭营销型号推断模型结构。缺少关键字段时 memory/KV calculator 必须返回 unknown。

### 6.2 Engine Semantic Profile

最低字段：

- engine family、软件版本范围、semantic profile identity/revision；
- triggers、owned state、ordered decisions、tie-breaking；
- batching、prefill/decode、preemption、prefix/KV interaction；
- TP/PP/EP、MoE、disaggregation、speculative decode 支持状态；
- 输出事件和相邻模块接口；
- unsupported/conditional features；
- trace replay 与 dynamic state-machine 支持矩阵。

当前三个最小 profile 只代表已声明子集，不能扩写为真实引擎的完整实现。

### 6.3 Device Profile

最低字段：

- device ID、vendor/model/revision、memory capacity/type；
- compute/memory/interconnect capabilities；
- 支持 dtype 和必要 topology ports；
- timing/resource model identity、测量条件和 uncertainty；
- driver/runtime/compiler/library versions；
- source mode、calibration receipt、valid regime；
- GPU participation compatibility。

理论峰值与实测有效值必须是不同字段；未经校准的 device profile 只能支持探索性结论。

### 6.4 Topology Profile

最低字段：

- devices、endpoints、domains、links、ports；
- 纵向/横向扩展网络分类；
- bandwidth、base latency、duplex、oversubscription、MTU/flow-control 能力；
- routing/transport/collective binding；
- placement constraints、failure/disabled resources；
- source、revision、校准和适用规模。

网络 demand 与实际 path/queue/congestion/completion 的所有权必须分开。

### 6.5 Workload Template

最低字段：

- task/scenario identity 和版本；
- request count、prompt/decode length 分布；
- arrival process、rate、burst、concurrency；
- model/engine constraints；
- session/prefix/cache reuse 语义；
- trace source、generation method、calibration level、allowed claim scope；
- scaling policy、seed 和 reproducibility fields；
- 允许用户覆盖的字段及范围。

## 7. 组合能力

单个 profile 可用不代表组合可用。Capability resolver 输入至少包含 model × engine × device × topology × workload × fidelity × GPU participation，输出：

- `combination_status`；
- 适用/不适用字段；
- 组合约束和冲突；
- 可用 lowering path；
- evidence/claim scope 上限；
- 需要的 calculator 和 validation policies；
- unresolved modules。

例如 engine 支持 TP=8、device count=8 并不自动证明 topology/collective/执行片段路径已闭合。

## 8. 来源与优先级

从高到低：正式运行时 descriptor/contract → 后端 versioned registry → 经过审核的 profile artifact → 用户在草案中显式提供的候选 → 模板默认。文档文本和模型常识只能用于提出候选或澄清，不能覆盖更高优先级事实。

所有默认值必须返回 `value_source`、source identity/revision 和适用原因。用户显式值优先，但仍受 deterministic validation。

## 9. 发布、失效与漂移

- 整个 catalog 和每个 profile 都有 canonical digest；
- profile 是 immutable revision，修改事实必须发布新 revision；
- capability snapshot 绑定 backend identity、schema-set、catalog 和 policy revisions；
- profile 被撤回、过期或证据失效时，依赖草案转 stale；
- 服务启动和 CI 检查 descriptor、request schema、lowering 与 catalog 的双向覆盖；
- 未知字段、未知状态、未知 revision 必须 fail closed；
- 删除/收紧能力属于破坏性变化，必须迁移说明和 fixture。

## 10. Agent 查询接口要求

查询必须是 typed、可筛选和可解释的，至少支持：

- 按用户术语/alias 找 stable identity；
- 按模块、task、support state、fidelity 和 profile 过滤；
- 获取某字段为何可用/不可用；
- 解析一个组合并返回冲突；
- 获取变化后的 diff；
- 返回最小投影，避免把整个 catalog 塞入 prompt。

每个查询响应带 catalog revision、匹配方式、候选排序依据和 ambiguity。LLM 不能自行选择两个同名 profile 中的一个。

## 11. 错误语义

稳定错误至少包括：unknown field/profile、ambiguous alias、revision mismatch、profile expired、combination unsupported、lowering missing、execution evidence missing、calibration missing、policy unavailable。

错误对象包含 code、field/profile references、blocking、repair options 和 current revisions；人类文案是展示字段，不是控制流。

## 12. 安全与留存

- catalog 只保存公开或授权元数据，不保存 credential；
- restricted profile 通过 principal/policy 过滤后再返回；
- 用户上传 profile 必须隔离、校验、标注来源，不能自动进入共享 catalog；
- 外部文档中的 prompt 指令视为不可信文本；
- profile 删除/撤回应有审计事件，历史 run 仍引用当时 immutable revision。

## 13. 测试与验收

- Schema、canonical digest、别名、单位和 revision round-trip；
- 每个 `agent_exposed` 字段都有 request lowering 和 execution evidence 测试；
- 每个 `unresolved_not_executed` 字段都不能进入候选或 ranking；
- model × engine × device × topology × workload pairwise/风险组合测试；
- profile missing/expired/drift 和 unsupported feature fail closed；
- 无损 uint64、decimal 和单位边界；
- catalog 生成的 UI/Agent 可用范围一致；
- 校准/held-out 状态不能由普通 profile 自报升级。

验收产物包括字段 traceability matrix：用户术语 → `field_id` → request Pointer → lowering stage → execution test → evidence output。

## 14. 依赖与更新触发器

本规范是 [意图编译](06_INTENT_COMPILER_AND_CLARIFICATION.md)、[确定性规划](07_DETERMINISTIC_VALIDATION_AND_PLANNING.md) 和 [RAG](09_RAG_EVIDENCE_AND_MEMORY.md) 的前置。

新增参数、profile、后端 lowering、校准 receipt、正式 UI 暴露或 claim scope 变化时，必须同步更新本文、[当前基线](01_CURRENT_BASELINE_AND_GAPS.md) 与 [Gap Register](14_CONTRACT_GAP_REGISTER.md)。

Phase 0 proposal 已归档到 `docs/archive/agent-orchestration/phase0-proposal/`；Phase 0B publication candidate 已归档到
`docs/archive/agent-orchestration/phase0b-publication-candidate/`。两者都只用于评审和 fixture 验证；candidate 全部
Schema/fixture 使用 `.jsonc`，不进入当前 Bridge 的正式 `*.json` schema-set 扫描。未知 identity/revision 必须失败关闭，
且不得由 UI、Agent 或 registry 当作已发布 contract 自动发现。

Phase 0C 正式路径为 `bridge/contracts/agent_orchestration_capability/`；其中 `catalog-content.json` 和
`schemas/*.schema.json` 进入 Bridge schema-set，`bridge/services/capability_catalog.py` 负责 non-self-referential
release binding 和 immutable snapshot。Phase 0/0B proposal/candidate 保留为历史评审材料，不再是 runtime 真源。
