# 产品与用户体验规范

> 文档 ID：`AO-02`
>
> 类型：产品与交互规范（`proposed`）
>
> 前置阅读：[约束与术语](00_GUARDRAILS_AND_GLOSSARY.md)、[当前基线](01_CURRENT_BASELINE_AND_GAPS.md)

## 1. 目标

把基于 Agent 的仿真编排模块设计成一个能完成实际工作的研究助手，而不是只有空白输入框的聊天页面。用户应能用普通语言描述目标，在少量澄清后得到可审计的实验草案；确认后由正式运行入口执行，并从证据化结果继续下一轮实验。

四条产品验收轴是：实用性、易用性、专业性、准确性。任何界面或交互改动都必须说明改善了哪一条轴及其测量方式。

## 2. 非目标

- 不把当前单轮 Evidence Agent 描述成多轮研究助手。
- 不用前端表单模拟后端尚未执行的模型、设备、并行或 SLO 能力。
- 不让用户通过聊天绕过 Schema、审批、权限、预算或 provenance 门禁。
- 不把 SHA、Pointer、contract revision 等开发细节长期放在默认主视图。
- 不以“回复更长”“Agent 更多”作为能力增强。

## 3. 用户画像

| 用户             | 主要目标                             | 默认信息密度                     | 主要风险                                  |
| ---------------- | ------------------------------------ | -------------------------------- | ----------------------------------------- |
| 初次使用者       | 快速完成一个可信示例并理解结果       | 普通语言、任务模板、渐进展开     | 不知道要提供哪些条件，把预测当实测        |
| 推理服务工程师   | 配置模型、引擎、并行、请求和 KV 策略 | 参数差异、约束、执行影响         | 使用未建模引擎特性或不可能配置            |
| 网络/硬件研究者  | 比较拓扑、带宽、时延、拥塞和反压     | 网络假设、流量、归因和候选范围   | 把局部网络结论扩写成端到端因果            |
| 性能/容量规划者  | 在 SLO 和预算下寻找候选              | 假设、区间、可比性和风险         | 缺少真实校准时得到过度确定结论            |
| 平台开发与评审者 | 检查契约、证据、恢复、安全和评测     | identity、digest、事件、citation | 测试 fixture 被误当 live 或 fidelity 证据 |

“新手/专业”是展示层级，不是两套业务逻辑。两种视图必须读取同一草案、验证报告、运行和证据对象。

## 4. 必须覆盖的真实任务

| ID      | 用户任务                              | 最小成功输出                                  | 当前状态                          |
| ------- | ------------------------------------- | --------------------------------------------- | --------------------------------- |
| `JT-01` | 用一句话调整当前正式八参数面          | 无副作用草案、来源和差异                      | Phase 1 可实现                    |
| `JT-02` | 说明某字段为何不能配置                | capability 状态、责任模块和解锁条件           | 依赖 `GAP-CAP-001`                |
| `JT-03` | 指定模型、卡型和卡数                  | profile 绑定或明确缺失，不猜默认值            | Phase 2，当前有 gap               |
| `JT-04` | 选择 vLLM/SGLang/TensorRT-LLM         | 精确语义 profile、版本和 unsupported features | Phase 2，Web lowering 未闭合      |
| `JT-05` | 配置请求长度、到达率、并发和突发      | workload template/分布草案与单位              | Phase 2，普通配置面未发布         |
| `JT-06` | 检查 TP/PP/EP、placement 和显存可行性 | 确定性校验报告和修复候选                      | Phase 2，需 profile 和 calculator |
| `JT-07` | 在 SLO/预算约束下规划实验             | 有界候选、预算和停止原因                      | Phase 2+，SLO contract gap        |
| `JT-08` | 确认并创建正式 run                    | 精确 diff、审批绑定、幂等 operation           | Phase 4                           |
| `JT-09` | 查看运行进度、失败或取消              | 可恢复状态、正式错误和取消边界                | Phase 4                           |
| `JT-10` | 分析当前 run 的结论和限制             | atomic claims、精确 citation、无越级结论      | 当前 Evidence Agent 的受限子集    |
| `JT-11` | 比较两个兼容 run                      | comparability report、逐 run citation         | Phase 6，当前 contract gap        |
| `JT-12` | 从结果生成下一轮可验证实验            | 新草案、变更理由、预期观察而非保证结论        | Phase 6                           |

发布一个阶段前，必须用真实用户任务而非组件数量验证价值。

## 5. 目标交互流程

1. 用户选择任务模板或直接描述目标。
2. 系统即时显示已识别条件、缺失条件和当前能力范围。
3. Agent 每轮最多提出 1–3 个真正阻塞的问题；非阻塞项使用显式、可追溯的默认候选，并等待用户确认。
4. 系统生成 typed experiment draft，逐字段标出用户提供、profile、模板、计算器或系统默认来源。
5. 确定性 validator 输出错误、警告、未知项、可执行范围和修复候选。
6. 用户查看“将要做什么、为何这样做、预计等待、数据可信范围和副作用”，再批准精确草案。
7. 工作流通过 Bridge 正式入口创建 run，展示进度和恢复状态。
8. 结果默认按“结论、依据、限制、下一步”呈现；专业身份和 citation 细节按需展开。
9. 用户可克隆结果为新草案，但旧运行和原始证据不可被改写。

当前 contract 未发布第 3–9 步所需对象时，产品只能停留在明确标记的设计或只读原型，不得在浏览器本地伪造正式会话。

## 6. 信息架构

目标工作区由四个同步区域组成：

- **对话与目标**：用户语言、Agent 澄清、支持范围和建议；
- **实验草案**：结构化字段、来源、差异、单位和高级参数；
- **校验与审批**：阻塞错误、警告、预算、证据范围和确认动作；
- **运行与结果**：operation、进度、正式 artifact、结论、依据、限制和下一步。

在桌面端可并排展示对话与草案，但必须保证：选择一个字段时两侧定位到同一 stable field ID；修改草案会创建新 revision 并使旧 validation/approval 失效；对话文本本身不是运行输入真源。

整个工作台应通过 [全局右侧 Agent 对话栏](16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md) 提供统一入口。侧栏跨页面保持，但每个 turn 固定当前页面、run 和用户选择的最小上下文 snapshot；各业务页面通过 typed context adapter 接入，侧栏不得读取 DOM 或直接修改业务 store。

## 7. 渐进披露

### 7.1 普通视图

优先显示：

- 当前目标和仍需回答的问题；
- 推荐方案及可选方案之间的关键差异；
- 可执行/不可执行及原因；
- 预计运行规模、等待时间和结论可信范围；
- 结论、依据、限制、下一步。

### 7.2 专业视图

按需显示：

- model/engine/device/topology/workload profile identity 与 revision；
- draft/request digest、Schema identity、backend identity；
- stable field ID、JSON Pointer、artifact SHA-256、citation subject；
- requested/resolved fidelity、execution mode、provenance 和 validation receipts；
- workflow event、idempotency、checkpoint 和恢复信息。

默认界面不得出现只对开发 AI 有意义的提示，例如“保持 v1 contract”“不要重算 payload”。这些属于本文档、契约或测试，而不是面向用户的小字。

## 8. 首次使用体验

空状态必须提供三个真实且能力受控的入口：

1. “配置一个当前支持的实验”；
2. “分析当前运行结果”；
3. “检查某个设想目前是否可执行”。

样例文案必须由 capability catalog 生成或随版本固定，不能展示当前运行面不支持的完整模型/多卡配置。页面应先用一个当前八参数面的例子完成首个成功任务，再解释模型、卡数和并行是后续能力。

## 9. 文案与失败语义

| 状态                      | 用户主文案原则                            | 不得混淆为              |
| ------------------------- | ----------------------------------------- | ----------------------- |
| 缺少必要条件              | 说明缺什么、为何阻塞，并只问必要问题      | Provider 拒绝或系统错误 |
| unsupported               | 指出当前版本未声明该能力及可用替代        | 参数填写错误            |
| infeasible                | 展示确定性冲突、相关字段和修复候选        | 模型意见                |
| partial                   | 明确哪些请求已回答、哪些没有              | 完整成功                |
| refused                   | 保留正式拒绝理由和允许的下一步            | 503 或用户输入错误      |
| truncated                 | 标示输出因正式限制未完整返回              | partial 推理结果        |
| stale                     | 隐藏旧 claims，说明哪一项 identity 已变化 | 请求失败                |
| 409 payload mismatch      | 保留原 key，要求显式放弃或恢复原 payload  | terminal 未留存         |
| 409 terminal not retained | 说明终态不可恢复且不会重调 Provider       | payload mismatch        |
| 502                       | 上游输出无效或网关失败的正式响应          | 503 unavailable         |
| 503                       | Provider 当前不可用                       | 504 timeout             |
| 504                       | Provider 在时限内未完成                   | cancelled               |
| cancelled                 | 用户或策略取消，late result 不再展示      | timeout                 |

错误必须关联稳定字段或 workflow step，并提供下一项可执行动作。禁止只显示“Something went wrong”。

## 10. 等待与成本预期

提交前显示：

- 将执行的 fidelity 和 execution mode；
- candidate/run 数量上限；
- 预计队列与执行时间的区间及来源；
- 工具、Provider 和运行预算；
- 可取消阶段和不能回滚的副作用；
- 结果将支持的 claim scope。

如果系统没有可靠估计器，显示“当前没有可靠等待时间估计”，不能由 LLM 猜测时间。

## 11. 无障碍与键盘

- 所有核心任务仅用键盘可完成，DOM 顺序与视觉顺序一致；
- 对话提交、草案保存、错误定位、批准、取消和 citation 展开使用原生可聚焦控件；
- 校验失败将焦点移动到错误摘要，再允许跳转到字段；
- 异步状态用礼貌 live region，破坏性或阻塞错误用 alert；
- stale 或取消后焦点回到明确的恢复/新建入口；
- 不仅用颜色区分 error/warning/unknown/supported；
- reduced-motion 下禁用非必要动效；
- 支持 200% 缩放、中文长文本和英文 identity 换行。

## 12. 产品指标与验收

| 轴     | 指标                      | Phase 1 门槛       | 面试版目标                |
| ------ | ------------------------- | ------------------ | ------------------------- |
| 实用性 | 任务完成率                | 当前支持子集 ≥ 80% | 10 个任务逐项报告         |
| 实用性 | time-to-valid-draft       | 记录 p50/p95       | 相对手工表单有测量改进    |
| 易用性 | 中位阻塞澄清轮数          | ≤ 2                | 按用户画像拆分            |
| 易用性 | 首次任务成功率            | ≥ 80%              | 5 名以上外部试用者        |
| 专业性 | 字段来源覆盖率            | 100%               | profile/单位/状态均可追溯 |
| 准确性 | unsupported 误宣称        | 0                  | hard gate                 |
| 准确性 | validation 后无效 request | 0                  | hard gate                 |
| 安全   | 未审批写操作              | 0                  | hard gate                 |

百分比是未来验收目标，不代表当前已达到。

## 13. 测试

- 任务级 component/E2E：覆盖 `JT-01` 至当前阶段所有可用任务；
- DOM 回归：普通/专业视图读取相同对象，不复制或改写 claims；
- 键盘、焦点、读屏、200% 缩放、reduced-motion；
- partial/refused/truncated/stale、两类 409、502/503/504 独立 fixture；
- capability drift、profile missing、validation stale、approval stale；
- 用户研究：首次使用 think-aloud、完成时间、错误恢复和术语理解。

## 14. 依赖、阻塞与更新触发器

依赖 [能力与 Profile 目录](04_CAPABILITY_AND_PROFILE_CATALOG.md)、[会话与草案契约](05_CONVERSATION_AND_DRAFT_CONTRACTS.md) 和 [评测规范](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md)。

以下变化必须更新本文：用户任务范围、默认能力、错误终态、approval/cancel 行为、数据留存政策或可用性门槛变化。
