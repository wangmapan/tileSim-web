# Phase 2D Profile Data Acceptance

> 状态：`pre_commit_ready`（本阶段不自动 commit/push）
> 事实日期：2026-09-12
> 范围：只读 Profile v2 registry、snapshot、binding 与 provenance 校验

Phase 2D 发布独立的 `tilesim.bridge.agent_orchestration_profile_registry.v1` 数据路径，
不修改 `tilesim.bridge.agent_orchestration_capability_catalog.v1`、Capability snapshot v1、
create-run v1、nested design-space v1/v2、Evidence descriptor v2、Evidence request/response/
citation/snapshot v1 或 Phase 1 local contract v1。v1 catalog 的五类 profile 计数仍为
`0/unavailable`。

## 已发布数据

五类各有一个 source-backed v2 record：

| family   | profile id                         | source kind                   | claim scope             | calibration / held-out | runtime / exposure      |
| -------- | ---------------------------------- | ----------------------------- | ----------------------- | ---------------------- | ----------------------- |
| model    | `mistralai.mistral-7b-v0.1`        | `reviewed_registry`           | `exploration`           | `missing` / `missing`  | `unavailable` / `false` |
| engine   | `vllm.0.6.semantic.v1`             | `reviewed_registry`           | `exploration`           | `missing` / `missing`  | `unavailable` / `false` |
| device   | `nvidia.a100-80gb-sxm`             | `vendor_specification`        | `exploration`           | `missing` / `missing`  | `unavailable` / `false` |
| topology | `generic-hierarchical-fabric.4gpu` | `compatibility_harness_trace` | `synthetic_consistency` | `missing` / `missing`  | `unavailable` / `false` |
| workload | `s0-synthetic-example.seed7`       | `synthetic_trace`             | `synthetic_consistency` | `missing` / `missing`  | `unavailable` / `false` |

每条事实都有 `value`、`unit` 和字段级 `provenance`；typed uint64 使用十进制字符串，不能以
`0` 猜测未知值。来源目录同时记录 URI/path、source kind、revision、SPDX license 或
`NOASSERTION`、valid regime 和 claim scope。Mistral 配置使用固定 Hugging Face commit
`27d67f1b5f57dc0953326b2601d68371d40ea8da`；拓扑与 workload 明确标注为 fixture/synthetic。

## Fail-closed 规则

- profile schema identity/revision、profile revision 或 canonical digest 不匹配即拒绝；
- source、license、valid regime 或字段 provenance 缺失/不一致即拒绝；
- unknown、expired、revoked、visibility/sensitivity 不匹配的记录不会出现在查询结果；
- synthetic/compatibility/user-input 不能自报 `calibrated`、`validated` 或更高 claim scope；
- snapshot 绑定 registry revision 与全部 profile references，revision 漂移即 stale；
- binding 必须包含五类 profile 的 identity/revision/digest；未知 profile 不能绑定；
- 所有当前记录 `agent_exposed=false`、`calculator_eligible=false`、`ranking_eligible=false`，
  `executable_combinations()` 为空。Phase 2C lowering 仍保持 `profile_missing` 等 fail-closed 结果。

只读 Bridge 查询入口为 `/api/agent/orchestration-profiles`（支持 `family`、`visibility`、`sensitivity` 查询参数），snapshot 入口为 `/api/agent/orchestration-profile-snapshot`。实现与测试：`bridge/contracts/agent_orchestration_phase2/registry.py`、
`bridge/contracts/agent_orchestration_phase2/tests/test_registry.py`。本阶段没有 calculator、
前端页面、RAG、多轮会话、审批、Workflow、SSE/cancellation，也没有操作 5173、读取 credential、
调用 Provider 或创建正式 run。

## 尚未声称的能力

这些 records 只提供可追溯的结构性输入和查询/snapshot/binding 验证。没有真实设备校准、独立
held-out validation、Phase 2C lowering 执行闭环或正式 run intake，因此不得作为可执行组合、排名
依据、硬件等价性或生产保真度证据。后续 Phase 2E 不在本阶段启动。
