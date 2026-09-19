# 归档说明

本目录保存已完成阶段、旧执行提示词和 dated validation evidence，用于审计与追溯，不是当前实现或下一步的事实来源。

- `development/`：F0–F10、Phase 0–0D 和界面评审历史证据。
- `plans/`：已执行完毕或被当前 Agent 编排路线替代的旧计划、旧维护提示词和旧并行工作流。
- `agent-orchestration/`：Agent 编排模块的已结束阶段记录与旧候选。
  - `phase0-proposal/`、`phase0b-publication-candidate/`：Phase 0 proposal 与 Phase 0B publication candidate；不是 runtime contract。
  - `phase-records/`：Phase 1 Web 本地验收、Phase 2 DoR 审计、Phase 2A 契约候选、Phase 2B 契约发布。这四篇是 dated 阶段证据，
    其"当前状态"结论一律不再有效；Phase 2A/2B 的契约侧结论已被正式发布取代，数据侧阻塞结论仍然有效。

AI 只有在追溯决定、测试来源或历史回归时才读取这里。当前状态以 `docs/AI_HANDOFF.md`、正式 contracts 和模块 current baseline 为准。
