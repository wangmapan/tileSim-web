# Phase 2A Agent 编排契约候选

状态：`proposal_only` / `pre_commit_ready` 候选，不是正式 runtime contract。

本目录为基于 Agent 的仿真编排模块 Phase 2A 的隔离 publication candidate。它不进入正式 OpenAPI、schema-set、manifest、generated production types、endpoint、service 或 repository。所有 fixture 均为 `fixture_only`，只证明 Schema、canonical、兼容、stale、幂等和留存语义的一致性，不是 Profile 数据、校准或 held-out validation 证据。

## 目录

- `proposal-manifest.json`：proposal identity、内容寻址 Schema revision 与注册排除项。
- `current-formal-baseline.json`：只读冻结的当前正式 identity/revision 漂移基线。
- `ADR-001-run-intake-successor.md`：create-run successor 方案比较与决策。
- `schemas/`：五类 Profile v2、Profile 组合、nested run intake、Validation Report、calculator receipt、幂等/留存 policy。
- `fixtures/`：正负例、canonical/uint64/decimal/unit 边界、兼容矩阵和语义矩阵。
- `tests/test_phase2a_oracle.py`：Python canonical、digest、provenance、兼容与 redaction oracle。
- `tests/unit/phase2a-contract-proposal.test.ts`：仓库级 TypeScript/Ajv oracle，位于仓库 `tests/unit/`。

## 本地门禁

```powershell
python -m unittest bridge/contracts/proposals/agent_orchestration_phase2a/tests/test_phase2a_oracle.py
pnpm exec vitest run tests/unit/phase2a-contract-proposal.test.ts
```

任何后续正式发布必须另行完成 Phase 2B 评审、分配正式 revision、注册 OpenAPI/schema-set/manifest、生成生产类型，并保持旧 identity 接受集合。不得把本目录直接复制到正式 Schema 目录后宣称发布完成。
