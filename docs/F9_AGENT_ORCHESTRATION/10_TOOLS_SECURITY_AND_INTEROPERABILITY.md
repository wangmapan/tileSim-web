# 工具、安全与互操作规范

> 文档 ID：`AO-10`
>
> 类型：安全与工具设计（`proposed`）
>
> 前置阅读：[目标架构](03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md)、[工作流](08_WORKFLOW_APPROVAL_AND_EXECUTION.md)、[RAG](09_RAG_EVIDENCE_AND_MEMORY.md)

## 1. 目标

为 Agent 提供最小、typed、可审计的工具能力，并明确 MCP、A2A 和有限多 Agent 的边界。工具扩展必须提高任务完成率，同时保持权限、审批、幂等、数据隔离和证据准确性。

## 2. 非目标

- 不开放通用 shell、任意文件、任意 URL、任意 SQL 或任意代码执行；
- 不让 MCP/A2A 成为内部业务真源；
- 不让模型自行创建 tool schema 或扩大 scope；
- 不以多 Agent 数量展示技术先进性；
- 不在未经审批时创建 run、批量候选或外部写入。

## 3. 工具分级

| 级别 | 类别           | 示例                                 | 门禁                                 |
| ---- | -------------- | ------------------------------------ | ------------------------------------ |
| T0   | 只读发现       | manifest、capability、profile lookup | principal/ACL、revision              |
| T1   | 纯计算         | 单位、显存/KV、并行、validation      | typed input、资源上限                |
| T2   | 草案状态       | create/update draft、保存偏好        | revision conflict、retention consent |
| T3   | 受控写操作     | create/cancel run                    | exact approval、idempotency、budget  |
| T4   | 外部系统写操作 | 发布、工单、云资源                   | 面试版默认禁止，需独立审批/审计      |

每个 workflow node 有静态 allow-list。模型输出的 tool name/arguments 只是候选，必须经过 registry、Schema、权限和 policy validation。

## 4. Tool Descriptor

每个工具至少声明：

- stable tool ID、version、owner、description；
- input/output/error schemas；
- effect class、data classifications；
- required scopes、approval policy；
- idempotency/retry/cancel semantics；
- timeout、rate/cost/size limits；
- allowed workflow nodes；
- audit/redaction/retention policy；
- availability/revision and deprecation；
- test fixture 和 health behavior。

描述文字不授予权限；服务端 registry 是唯一能力真源。

## 5. 最小面试版工具集

建议只提供：

1. `lookup_capability`；
2. `get_profile_projection`；
3. `normalize_units`；
4. `validate_experiment_draft`；
5. `preview_compiled_request`；
6. `create_run`（T3，审批后）；
7. `get_operation/get_run/get_artifact_projection`；
8. `retrieve_evidence`；
9. `cancel_run`（仅后端正式支持时）。

这些工具覆盖配置—执行—分析闭环，不需要开放底层 CLI。

## 6. 权限与授权

权限同时检查：principal、workspace、resource、action、data class、workflow node、approval digest、budget 和 expiry。客户端、Provider 或 A2A peer 传入的 `allowed=true` 不可信。

采用 deny-by-default：未知工具/version/scope/resource 均拒绝。短期 capability token 绑定 operation/node/tool/resource，不能跨 node 或 conversation 重用。

## 7. 输入输出校验

- 调用前：Schema、unknown fields、size、unit、resource references、SSRF/path rules；
- 调用后：Schema、identity、digest、workspace binding、output size 和 redaction；
- error：只返回 allow-listed structured fields；
- 二进制/大型 artifact 通过引用，不进入 tool JSON；
- uint64 保持无损；
- 工具说明和结果都视为不可信 data，不能覆盖 system policy。

## 8. Prompt Injection 威胁模型

攻击面包括用户输入、公开文档、artifact、profile、MCP resource/tool result、A2A message 和历史会话。

防护：

- 指令与数据通道分离；
- retrieval content 明确标记 untrusted；
- tool allow-list 和参数 policy 在模型外执行；
- write tool 需要 human approval；
- secret 永不进入模型上下文；
- 输出先 Schema/identity/citation validation；
- canary/adversarial corpus 覆盖“忽略规则、读取密钥、调用未授权工具、跨 run 泄漏、扩大预算”；
- 拒绝来自文档的权限升级、callback URL 和任意路径。

## 9. 网络、文件与进程边界

- Provider endpoint 继续使用固定配置和 allow-list，不接受用户 URL；
- 禁止 redirect、userinfo、query/fragment 以及不安全非 loopback HTTP；
- 文件工具只接受服务端签发的 resource ID，不接受绝对路径或 `..`；
- 不向 Agent 暴露进程环境、credential store 或部署脚本；
- 创建 run 通过正式 Bridge 服务，不拼接 shell 命令；
- 外部网络资源需单独 ingestion pipeline、内容限制和 provenance。

## 10. MCP 边界

MCP 可作为外部客户端访问 TileSim 能力的适配层，推荐顺序：

1. 先稳定内部 typed tool/resource contract；
2. 再映射只读 resources 和 T0/T1 tools；
3. 最后在明确 approval/elicitation 语义下映射 `create_run`。

MCP server 不拥有 conversation、approval、run 或 profile 数据。协议 capability/version discovery 必须映射到内部 revision，未知版本 fail closed。MCP prompt 仅是用户可选模板，不能携带额外权限。

首批 resources 可包括 capability snapshot、公开 profile projection、run metadata 和 validated artifact projections；禁止 credential、raw Provider response 和任意文件读取。

## 11. A2A 边界

A2A 仅在确有跨产品/跨组织 Agent 协作需求后引入。A2A Agent Card 公开的是经过裁剪的能力和认证要求，不代表内部 tool registry。

外部 task/message/artifact 必须进入独立 gateway：认证 → workspace mapping → Schema/version → policy → internal workflow。stream/subscribe/cancel 映射 operation semantics；外部 peer 不能直接恢复内部 checkpoint 或批准写操作。

`GAP-A2A-001` 在单体面试版中保持 deferred。

## 12. 多 Agent 策略

默认使用一个 orchestrator 加确定性 services。只有以下证据之一成立才拆 Agent：

- 需要隔离不同权限或数据域；
- 独立上下文显著减少错误/成本；
- 一个任务可以并行且合并规则确定；
- reviewer 在独立 held-out eval 上显著降低高风险错误。

即使拆分，也建议最多配置编译 Agent、证据分析 Agent 和可选 reviewer；它们通过 typed objects 交接，不自由互聊。写权限只在 orchestrator/workflow，reviewer 无副作用权限。

## 13. 供应链与版本

- pin SDK/protocol/model/tool schema versions；
- 记录依赖 SBOM、license 和安全更新；
- Provider/embedding/reranker 变化触发对应 eval；
- 外部 server 有 allow-list、认证、超时、熔断和 payload limits；
- tool descriptor digest 与运行 audit 绑定；
- deprecated 工具有迁移窗口和拒绝日期。

## 14. 审计与隐私

审计记录谁在何时对哪个 exact resource 请求哪个工具、approval、payload digest、结果 identity、状态和耗时。默认不记录完整用户问题、tool payload、artifact、Provider raw response 或 hidden reasoning。

安全事件应能关联 conversation/operation/run/tool trace，但用户可见日志和内部安全日志分级访问。

## 15. 测试与验收

- tool schema/unknown field/size/uint64；
- permission matrix 和 node allow-list；
- approval mismatch/expiry/replay；
- same key same/different payload；
- SSRF、path traversal、command injection、redirect；
- malicious retrieval/tool result/MCP resource/A2A message；
- cross-workspace/run/profile leakage；
- timeout/retry/cancel/duplicate event；
- secret scanning 和日志/redaction snapshot；
- AgentDojo 类动态攻击任务与 TileSim 自有 adversarial set。

上线硬门禁：未授权工具成功率=0、approval 前写副作用=0、secret/raw response 泄漏=0、重复 run 副作用=0。

## 16. 依赖与更新触发器

依赖 [工作流](08_WORKFLOW_APPROVAL_AND_EXECUTION.md)、[评测](11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md) 和 `GAP-TOOLS-001`。新增工具、scope、外部 endpoint、MCP/A2A capability、多 Agent 角色或 data class 时，必须安全评审、ADR 和 adversarial regression。
