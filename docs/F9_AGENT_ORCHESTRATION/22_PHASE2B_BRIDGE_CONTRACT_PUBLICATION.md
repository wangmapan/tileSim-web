# Phase 2B Bridge 契约发布

状态：`pre_commit_ready`（仅契约发布，未进入 Phase 2C）。

本阶段发布五类 Profile v2 Schema、Profile Binding v1、Run Intake v2、Validation Report v1、Calculator Receipt Envelope v1、七类 typed receipt identity，以及幂等/留存 policy contract。Schema 使用严格字段闭包、十进制字符串 uint64、decimal canonical 约束和字段级 provenance。

运行时边界保持不变：当前 `/api/runs` 不接受 Run Intake v2；calculator、真实 Profile、calibration、held-out validation、lowering 和 runtime execution 仍不可用。Capability Snapshot v1 与 Evidence Agent v1/v2 兼容语义不变，幂等/留存策略仅为 contract-only。

正式 package manifest 位于 `bridge/contracts/agent_orchestration_phase2/manifest.json`，生成的 TypeScript/Ajv 物料位于 `src/contracts/generated/agent-orchestration-phase2-validators.js` 与 `bridge-contracts.ts`。
