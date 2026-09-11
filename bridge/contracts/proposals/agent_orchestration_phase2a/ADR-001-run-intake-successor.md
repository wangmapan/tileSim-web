# ADR-001：Phase 2 运行输入 successor

- 状态：`proposed`
- 日期：2026-09-11
- 决策 owner：Bridge + 场景与探索编排模块
- 影响范围：契约设计；不改变当前 runtime

## 背景

正式 `tilesim.bridge.create_run_request.v1` 只覆盖当前场景和已发布参数子集，不能表达五类不可变 Profile、TP/PP/EP、placement、物理 KV、集合通信、工作负载模板、网络绑定、typed SLO 和预算。已发布 v1 接受集合、幂等 payload 和 retained run 不能原地改变。

## 方案比较

| 维度                      | A：发布 create-run v2                  | B：保留 create-run v1，增加显式 nested intake v2                  |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| 旧客户端 → 新服务端       | 需要双顶层路由；仍可兼容               | v1 路由完全不变                                                   |
| 新客户端 → 旧服务端       | 顶层 unknown identity，拒绝            | nested unknown identity，拒绝                                     |
| canonical 幂等 payload    | 顶层 identity 变化，全部视为新 payload | nested identity/revision/digest 参与原 payload，同 key 变化仍 409 |
| retained run 恢复         | 需在两个顶层 handler 间恢复            | 仍由 v1 顶层恢复，并保留原 nested identity                        |
| unknown identity/revision | 顶层 fail closed                       | nested fail closed                                                |
| mixed-version payload     | 顶层和嵌套组合更多                     | 只允许 intake v2 自洽组合，禁止 v1/v2 字段拼接                    |
| validation error identity | 需迁移整个错误入口                     | 可发布独立 Agent orchestration Validation Report identity         |
| run metadata identity     | 顶层变更                               | 顶层 v1 保持，metadata 额外冻结 nested identity/revision/digest   |
| 迁移成本                  | 高；Bridge/client/recovery 全链变更    | 较低；后续只新增显式 nested dispatcher 与 lowering                |

## 决策

选择 B。候选 nested identity 为 `tilesim.bridge.agent_orchestration_run_intake.v2`，顶层正式 `tilesim.bridge.create_run_request.v1` 保持不变。这里的 v2 表示 Phase 2 完整 intake 语义，与现有 `tilesim.design_space.s6_candidates.v1/v2` 不构成继承或替代关系。

路由必须读取显式 identity；identity 缺失、unknown identity/revision 或 mixed-version payload 均拒绝，不得根据字段形状猜版本。旧 create-run v1 和 nested design-space 缺 identity 固定路由 v1 的历史规则保持不变，但新 intake 不提供 omission default。

## 兼容与迁移结果

- 旧客户端对新服务端继续使用 create-run v1，接受集合不变。
- 新客户端对旧服务端收到 `unknown_nested_identity`，不得自动降级。
- v1 与 successor 之间只能走显式 migration，不能 payload 猜测。
- retained 历史 run 按原顶层/nested identity 精确重放；服务端升级不重解释 payload。
- Profile revision、digest 或 nested version 改变都会改变 canonical payload；复用同一幂等 key 时返回 `409 idempotency_payload_mismatch`。
- Validation 使用 `tilesim.bridge.agent_orchestration_validation_report.v1`，run metadata 必须保存 nested identity/revision/digest 和原 canonical payload digest。

## 后果

Phase 2B 需要新增正式 nested dispatcher、runtime validator、OpenAPI/schema-set/manifest/generated types 与 retained-run 测试。Phase 2C 需要建立从 intake Pointer 到各领域模块和网络/请求指标的累计 lowering。两者均不属于本 ADR 的 Phase 2A 实施。
