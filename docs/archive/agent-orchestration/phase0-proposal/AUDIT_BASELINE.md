# Phase 0 Contract Audit Baseline

审计日期：2026-09-08。审计为只读；原始工作树已有改动均保留。

## Git / worktree 基线

| 路径                                           | branch / HEAD                                                            | 初始状态摘要                          |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| `D:\tileSim-worktrees\phase0-contract-catalog` | `codex/ao-contract-phase-0` / `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42` | clean                                 |
| `D:\tileSim-web`                               | `main` / `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`                      | 既有 tracked/untracked 改动；只读保护 |
| `D:\tileSim`                                   | `main` / `09c22c0efff890253a1eacf403c2979f56fd9ba6`                      | 既有 untracked 文档；只读保护         |

`git worktree list --porcelain` 已核对：本任务 worktree 归属 `D:\tileSim-web`，路径和 branch 无冲突；后端 Phase 0 worktree 属于另一仓库和另一 Agent。

## 正式 contract 与 generated contract 审计

1. 本 worktree 的 `bridge/server.py --print-schema-set-revision` 返回冻结 runtime schema-set `sha256:eb6c0d…e7095c`。
2. `bridge/contracts/experiment_descriptor.py` 计算的 descriptor revision 为冻结值 `sha256:de97e5…8c68d059`，正式 identity 仍为 `tilesim.bridge.experiment_descriptor.v1`。
3. 正式 create-run identity 为 `tilesim.bridge.create_run_request.v1`。八个普通参数通过 `/overrides/...` Pointer 进入受控 request schema；Schema 接受与 F8 descriptor `available` 不能单独证明 lowering/executed/observable。
4. F8 Schema test 检查 descriptor、request Pointer、enum/range、八字段唯一性、Trace source 和并列资源语义边界；它是 contract/一致性证据，不是执行、校准或 held-out 证据。
5. Evidence Agent descriptor 为 v2 且 revision 与冻结值一致；request/response/citation/snapshot 保持 v1。现有 canonical contract 为 `tilesim.bridge.canonical_json.v1`，支持跨 Python/Node lossless large integer vectors。
6. `scripts/generate-bridge-client.mjs` 只从正式 OpenAPI 和 Schema roots 生成 `src/contracts/generated/*`。proposal 不加入这些 roots，因此不会改变 generated clients、manifest 或 schema-set。
7. 当前正式 contract 没有五类统一 Profile family，也没有表达十维能力状态、Profile combination resolution、deprecation/stale 的完整 capability snapshot。这正是 `GAP-CAP-001` 与 `GAP-PROFILE-001`，本目录只给 proposal，不将 Gap 标为 validated。

## 结论

- frozen identities 无 drift；本任务无需也不得修改正式 identity。
- 当前八字段中 `described`、`accepted`、`validated`、`ui_exposed` 可由正式 contract/descriptor 审计；`lowered`、`executed`、`observable` 必须等待后端 traceability owner 的逐字段证据后才能 affirm。
- `calibrated`、`held_out_validated` 不能由 fixture、CI、Profile 自报或 synthetic consistency affirm。
- Proposal fixture 将未审计 execution 维度保持 `unknown`，并强制 `agent_exposed=denied`。
