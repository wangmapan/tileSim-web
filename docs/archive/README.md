# 归档说明

本目录保存已完成阶段、旧执行提示词和 dated validation evidence，用于审计与追溯，不是当前实现或下一步的事实来源。

- `development/`：F0–F10、Phase 0–0D 和界面评审历史证据。
- `plans/`：已执行完毕或被当前 Agent 编排路线替代的旧计划、旧维护提示词和旧并行工作流。
- `agent-orchestration/`：Agent 编排模块的已结束阶段记录与旧候选。
  - `phase0-proposal/`、`phase0b-publication-candidate/`：Phase 0 proposal 与 Phase 0B publication candidate；不是 runtime contract。
  - `phase-records/`：Phase 1 Web 本地验收、Phase 2 DoR 审计、Phase 2A 契约候选、Phase 2B 契约发布。这四篇是 dated 阶段证据，
    其"当前状态"结论一律不再有效；Phase 2A/2B 的契约侧结论已被正式发布取代，数据侧阻塞结论仍然有效。
    **2026-09-23 追加归档两篇**：`24_PHASE2D_PROFILE_DATA_ACCEPTANCE.md`（Phase 2D 只读 Profile registry 验收）
    与 `25_PHASE2E_DOR_AUDIT.md`（Phase 2E 裁决 `blocked_data`）。两篇此前留在 `docs/F9_AGENT_ORCHESTRATION/`
    但不在该模块活跃清单内、也未被任何文档引用；结论已折进该模块 `README.md` §0.2 与 `docs/AI_HANDOFF.md`。
    归档只搬位置，编号与内容不改写（`24` 号曾同时存在两个文件，另一个仍在活跃目录）。

AI 只有在追溯决定、测试来源或历史回归时才读取这里。当前状态以 `docs/AI_HANDOFF.md`、正式 contracts 和模块 current baseline 为准。
