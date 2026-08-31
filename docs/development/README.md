# Development Evidence Index

本目录保存阶段性验证证据，不是当前开发状态来源。后续 AI 应先读取仓库 `AGENTS.md` 和 `docs/AI_HANDOFF.md`。

## 当前有效记录

- `FRONTEND_READABILITY_REVIEW_2026-08-31.md`：全仓可读性审查、i18n/Bridge 状态分离和稳定 ID Pointer 统一。
- `FRONTEND_COUPLING_REFACTOR_2026-08-31.md`：F6B evidence model 与 F7 presentation 的职责拆分、边界审计和保留债务。
- `F7_FABRIC_SLICE_2026-08-30.md`：metrics-backed Fabric hotspot、request/phase Pointer、F7 capability degradation 和结构化导出同步。
- `F6B_WEEK8_EVIDENCE_2026-08-30.md`：Week 8 run-bound S1-S9、artifact identity、无损整数、结构化导出 v2、live 验收和完整门禁闭合。
- `F6A_WEEK7_EVIDENCE_2026-08-30.md`：Week 7 S8/S9 证据工作台、归因审计、review hardening、部署身份和完整门禁。
- `F5_REVIEW_HARDENING_2026-08-29.md`：证据身份、工件入口、Pointer 错误、资源生命周期、键盘和 Bridge 容量 review closure。
- `F5D_PROGRESS_2026-08-29.md`：SHA-256 绑定 evidence link、Pointer 往返和失败关闭。
- `F5C_PROGRESS_2026-08-29.md`：大型 JSON 行窗口、虚拟滚动、搜索定位和 DOM 门禁。
- `f5c_artifact_virtual_baseline_2026-08-29.json`：F5C 五样本索引、搜索和行窗口机器基线。
- `F5B_PROGRESS_2026-08-29.md`：Artifact Worker、取消/stale-result 和浏览器性能门禁。
- `f5b_artifact_worker_baseline_2026-08-29.json`：F5B 五样本索引与搜索机器基线。
- `F5A_PROGRESS_2026-08-29.md`：大型工件固定样本、性能基线和 Worker contract。
- `f5a_artifact_baseline_2026-08-29.json`：F5A 五样本机器基线。
- `F4_PROGRESS_2026-08-27.md`：F4 最终结构和验收。
- `F4_REVIEW_2026-08-28.md`：F4 并发、依赖方向和损坏工件加固。

## 历史快照

- F0：工作树、部署、样本、视觉和性能基线。
- F1：fixture、字段、无障碍与视觉回归。
- F2：TypeScript、compatibility schema、adapter 和 review。
- F3：Bridge/OpenAPI/SSE/幂等与故障矩阵。

配套小写 `.json` 文件是当时的机器记录，应原样保留。历史文件中的路径、测试数量、“下一阶段”和服务状态只描述记录日期，不应用作当前决策依据。
