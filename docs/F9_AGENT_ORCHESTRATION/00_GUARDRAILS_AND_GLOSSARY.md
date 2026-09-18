# 约束、术语与证据边界

> 文档 ID：`AO-00`
>
> 类型：规范性约束
>
> 前置阅读：[文档集入口](README.md)

## 1. 目标

本文件定义所有后续实现都必须保持的系统边界。任何 Agent、RAG、工具或前端体验改动都不能降低这些约束。

## 2. 产品原则

### 2.1 实用性

Agent 必须帮助用户完成具体仿真任务：配置、校验、运行、分析或迭代。纯聊天、泛化建议和无法转成实验的文本不算产品能力。

### 2.2 易用性

普通用户默认看到目标、缺口、方案、风险、等待和结果。身份、SHA、Pointer、contract revision 等专业细节按需展开。开发过程说明不得作为页面主文案。

### 2.3 专业性

模型、推理引擎、并行、KV Cache、设备、集合通信、网络、保真度和证据必须使用明确专业语义。推荐必须说明参数来源、假设、单位、支持状态和适用范围。

### 2.4 准确性

LLM 负责语言理解、歧义识别、候选解释和结果叙述；确定性代码负责 Schema、身份、数值、单位、约束、权限、幂等、citation 和运行提交。

## 3. 当前架构词汇

新文档和用户说明以中文模块名为主：

- 工作负载抽象与负载描述语言模块；
- 推理引擎与服务运行时模块；
- 执行语义建模模块；
- KV Cache 建模模块；
- 设备性能建模模块；
- 集合通信语义模块；
- 网络与硬件资源模块；
- 统一仿真内核模块；
- 场景与探索编排模块；
- 校准验证与指标归因模块；
- 基于 Agent 的仿真编排模块。

旧路径或现有 contract 仍可能使用 `S0-S9`。引用时必须写出精确代码值，并说明它是兼容标识，不能作为新设计的主要词汇。

## 4. 五层目标系统与控制平面

目标系统只有五层：

1. 工作负载与请求层；
2. 推理引擎与服务运行时层；
3. 执行语义与并行层；
4. 资源语义层；
5. 网络与硬件资源层。

仿真执行与控制平面独立存在，不是第六层。它承载全局事件时间轴、状态提交、反馈路由、保真度后端、校准、结果处理和实验编排。

资源语义层中的 KV Cache、设备性能和集合通信是并列关注点，不得画成虚假线性链。

## 5. 必须保持的反馈链

```mermaid
flowchart LR
    N[网络完成、拥塞或反压] --> R[资源操作完成或等待]
    R --> F[执行片段依赖]
    F --> M[模型执行调用]
    M --> E[推理引擎调度]
    E --> Q[请求级 TTFT、TPOT、吞吐与尾延迟]
```

Agent 可以解释这条链，但不能凭模型生成新的物理因果关系。因果或贡献必须来自正式执行记录和归因报告。

## 6. 建模粒度与仿真保真度

必须分开：

- 建模粒度：request、batch、iteration、operator、Tile 粒度、cache page、Flow；
- 仿真保真度：Analytical、DES、Cycle。

Tile 是建模粒度，不是系统层、对象类型或生命周期所有者。新文档使用“Tile 粒度分区描述”和“执行片段”。

Analytical 用于广泛筛选；DES 处理动态排序、竞争、等待与反馈；Cycle 只用于具有目标时钟和周期状态的局部机制。GPU 参与不自动等于 Cycle。

## 7. Trace 来源与 GPU 参与方式

Trace 来源：

- `real_trace`：真实系统采集；
- `synthetic_trace`：合成输入；
- `compatibility_harness_trace`：兼容或语义仿真工具提取。

GPU 参与方式：

- `gpu_free`：无 GPU 依赖仿真；
- `gpu_assisted_trace`：仿真前使用 GPU 获取真实观测；
- `gpu_in_loop`：仿真期间执行独立 GPU 任务片段。

两组字段正交。Trace 来源不能从 GPU 参与方式推断，反之亦然。

## 8. 证据和结论范围

报告必须区分：

- analytical behavior checked；
- DES behavior checked；
- cycle-level behavior checked；
- synthetic consistency checked；
- real-trace calibration performed；
- held-out real-trace validation performed。

允许结论范围从低到高为：探索、合成一致性、有限外推、相似区间条件预测、真实校准验证。低等级证据不得升级为高等级结论。

当前没有足够真实 H100/网络校准和独立 held-out 验证时，“某模型一定需要几张卡”“P99 一定是多少”只能作为带假设的可执行候选或条件预测。

## 9. Agent 写操作规则

- Agent 必须先生成草案，不能直接生成并执行 CLI 字符串。
- 正式运行只能走场景与探索编排模块/Bridge create-run 入口。
- 用户确认前写副作用为零。
- 确认只对精确 draft digest 和 revisions 有效。
- 修改任何参数后旧确认立即失效。
- retry/recovery 不得重复 Provider 调用或 create-run 副作用。
- Agent 不得获得通用 shell、任意文件、任意 URL 或任意数据库写权限。

## 10. Evidence Agent 兼容边界

除非 Bridge 正式发布新版本：

- descriptor identity 保持 `tilesim.bridge.evidence_agent_descriptor.v2`；
- request/response/citation/snapshot 保持 v1；
- 同 key/同 canonical payload 进程内精确 replay；
- claim-free Bridge terminal 才能按 descriptor 跨重启恢复；
- claims-bearing 与 claim-free Provider terminal 跨重启返回正式 `409 terminal_result_not_retained`；
- same key/different payload 返回 `409 idempotency_payload_mismatch`；
- 两类 409 都锁定原 key，只有用户显式 discard 才能产生新 key；
- 不自动重新调用 Provider；
- run/backend/schema revision/snapshot digest 任一变化立即 stale 并隐藏 claims；
- 502/503/504 继续使用正式 EvidenceAgentResponse。

多轮、异步取消、跨 run 比较或工具执行不能塞进旧协议。

## 11. 数据与留存禁止项

默认不得新增持久化：

- credential；
- hidden reasoning；
- Provider raw response；
- 未经授权的完整用户问题；
- 完整 artifact payload；
- validated claims 的额外长期副本。

需要保存用户可见对话时，必须先发布 retention、redaction、expiry、delete 和 consent 契约。

## 12. 数值与身份

- uint64 ps/bytes/count 必须使用无损解析与序列化；
- 不允许先转 JavaScript `number` 再生成 payload 或 citation；
- citation 必须精确绑定 run、artifact、schema、SHA-256、Pointer 和 stable subject；
- requested fidelity、resolved fidelity、execution mode 分开；
- `0`、missing、not applicable、expected absence、not covered、unsupported 必须区分；
- 模型文本不得重写、合并、补造、重算或推断后端 atomic claim。

## 13. 何时必须停止实现

出现以下任一情况时，AI 必须停止前端兼容模拟并登记 contract gap：

- 当前 Schema 无法表达状态或 identity；
- 新功能会改变模块范围、保真度或证据边界；
- profile 缺少版本或证据来源；
- 参数能被接受但未证明影响执行；
- 写操作没有 idempotency/approval/recovery 语义；
- retention 或权限责任人不明确；
- 需要使用私有主设计资料重新定义公开架构。
