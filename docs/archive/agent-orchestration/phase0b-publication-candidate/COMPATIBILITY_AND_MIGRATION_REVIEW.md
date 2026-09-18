# Phase 0B Capability Catalog 兼容与迁移评审

## 结论

本候选是新的只读 contract family；相对现有 OpenAPI/create-run/Evidence contract，建议采用 additive endpoint + generated client 的发布方式。它不修改 create-run payload、canonicalization、idempotency、Evidence 终态、citation 或 retention 语义，因此本候选本身不要求 create-run successor。

但候选尚不能进入正式 schema-set：当前 F8 工作树对 design-space provenance、oversubscription 下界、candidate canonicalization 和 DES promotion budget 有 validation tightening/semantic changes。Drift Agent 已将其判为 breaking，且 named owner/handoff 尚未验证；`GAP-CONTRACT-DRIFT-001` 保持 open/blocking。目标源码 revision 尚未冻结，必须等待 successor/dual-version 决策与对应 Git commit；clean HEAD 的旧 v1 contract 只能作为 evidence/compatibility baseline，dirty/5173 binding 只能作为非目标观察记录。

## 版本与 binding

| 状态                                        | schema-set                                                                | experiment descriptor                                                                                                 | create-run                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Phase 0 execution evidence                  | `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c` | `tilesim.bridge.experiment_descriptor.v1` / `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059` | `tilesim.bridge.create_run_request.v1`                                         |
| clean HEAD compatibility baseline           | `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c` | `tilesim.bridge.experiment_descriptor.v1` / `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059` | `tilesim.bridge.create_run_request.v1`                                         |
| Phase 1 source target                       | 待 successor/dual-version 决策和 Git commit                               | `target_pending` / `unavailable`                                                                                      | identity/revision 待冻结                                                       |
| 2026-09-08 只读观察的非目标 5173 / dirty F8 | `sha256:2214c4eae8361bc46fce52163832eb0ba9b9438692c2ff147cbd1b56a2df2af8` | `tilesim.bridge.experiment_descriptor.v1` / `sha256:1ef962150e0cfa19d27116a3176f23881f7a790cd23b8ef4ebaf3e7885aef4f1` | `tilesim.bridge.create_run_request.v1`（breaking 旧 payload；不得作为 target） |

候选 snapshot 保存 evidence binding、结构化 pending source target 和 observed non-target runtime binding。pending source target 不包含 backend/schema/descriptor/create-run 的具体 revision，避免把兼容基线冒充开发目标。目标冻结后，任何 backend/schema/descriptor/catalog mismatch 都使投影 stale，并隐藏 `agent_exposed` 集合；不能静默重算或回落到旧 binding。

## 兼容政策

- 首次发布没有正式 predecessor；unknown identity/revision/status fail closed。
- 同一 v1 family 只允许 additive optional change。删除字段、收紧约束、改变单位、digest material、support state 解释或 drift 行为必须发布 successor。
- snapshot 和 catalog revision immutable；事实变化发布新 revision，不原地改写。
- Profile schema 发布与 Profile 数据发布分开。空目录使用 `actual_profile_count=0` 和结构化缺失状态，不创建占位 H100、模型、拓扑或 workload。
- `calibrated`/`held_out_validated` 只能由受信 receipt registry 升级；Profile 自报或 synthetic fixture 无权升级。

## 集成顺序

1. F8 Drift Agent 给出逐 payload 兼容结论和目标源码 binding。
2. 项目负责人批准本目录 identity 命名和 v1 compatibility policy。
3. 集成负责人将 Schema 加入正式根/OpenAPI/manifest，生成 Python/TypeScript 类型与 runtime validator。
4. Bridge 只读 endpoint 返回 immutable snapshot，并在 binding mismatch 时失败关闭。
5. Eval Agent 独立运行 revision/status/uint64/digest/泄漏 oracle。

在第 1、2 步完成前，`GAP-CAP-001`、`GAP-PROFILE-001` 保持未关闭，Phase 1 DoR 不得由本候选单独判定为通过。
