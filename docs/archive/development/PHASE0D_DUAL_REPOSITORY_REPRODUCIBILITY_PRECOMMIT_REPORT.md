# Phase 0D 双仓库可复现性 pre-commit 报告

> 事实日期：2026-09-09（Asia/Shanghai）
>
> 状态：`backend_and_web_runtime_committed / docs_not_authorized / phase1_ready_not_started`

## 1. 结论

后端 Phase 0 execution evidence 已形成独立 clean commit
`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`。Web Capability Catalog 的八条 execution evidence reference
均已重绑定到该 commit，并通过 repository/revision/path/test_case 逐项 Git 解析，结果为 8/8 verified。

Web runtime 已按精确 51 文件 allow-list 形成 commit
`64a741f3dfc76ef4b80352f1ca1197428de1ab25`。Commit 后真实 revision closure 暴露的 Windows Python stdin
编码问题已由 follow-up commit `df1f24452384d328ce402ffa37affbd8c734da13` 修复。Docs/evidence 仍未提交。
未 push、未部署或操作 5173、未读取 credential、未执行 live Provider acceptance、未创建正式 run，Phase 1 未启动。

## 2. 后端 evidence commit

- Commit：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`
- Parent：`09c22c0efff890253a1eacf403c2979f56fd9ba6`
- Message：`test(evidence): bind phase0 parameter execution evidence`
- 变更：3 files，331 insertions

精确文件：

```text
tests/test_week4_cumulative_flow.cpp
docs/development/PHASE0_PARAMETER_TRACEABILITY_MATRIX.md
docs/development/PHASE0_PARAMETER_TRACEABILITY_MATRIX.json
```

三项新增 synthetic differential 直接比较 Fabric timeline 的网络完成时间，并分别闭合：message size 到 execution
envelope、scale-up bandwidth 到 fabric latency、scale-up latency 到 request P99。它们只支持 exploration 与
synthetic consistency，不是 calibration 或 held-out validation。

## 3. Revision 与 digest

- Catalog：`sha256:726e59ba8b38adc7441b945a0faf47ab5d6f4ab244f76d7fe98b87005fa6aa7b`
- Contract package：`sha256:1fa372e1fc4eafe5b819aedd29f258732b8a53fab6b9559e964f6ee1164a4fe3`
- Schema set：`sha256:3211d2df2e166a0ebc62f0f08ad014bf15fee8fb4bda79f3372897be3c28c15d`
- Experiment descriptor：`sha256:130ff231e59c5b7900dd9d4b51b590d23022b08a8ab8ad7857355a9b45632b6b`
- Pre-commit snapshot vector：`sha256:90869411f1084001371a0e0f6edf634dfa6036b34e57494600530b27b2010df9`
- Runtime/reproducibility HEAD snapshot revision：`sha256:2411a70b7e39efc81afed7f92504b685ad9dfd8c4d3a551f7b30487db98673a0`

Pre-commit snapshot vector 使用旧 Web HEAD `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`、后端 evidence commit 与当前
schema-set 构造；它不是已部署 release revision。Runtime/reproducibility snapshot 使用 Web HEAD `df1f2445…` 和
后端 commit `7e5a8c6a…` 重新计算；catalog/package/schema-set/generated 与 8/8 evidence closure 均通过。Docs commit
会改变 release-binding revision，因此其新 snapshot 必须在 commit 后计算并作为外部验收结果报告，不能自引用写入本 commit。

## 4. Web runtime commit 精确文件（51 files）

- Commit：`64a741f3dfc76ef4b80352f1ca1197428de1ab25`
- Message：`feat(agent-orchestration): publish capability catalog and version F8 candidates`

```text
bridge/api/responses.py
bridge/contracts/experiment_descriptor.py
bridge/contracts/openapi.json
bridge/contracts/run_request.py
bridge/contracts/schemas/api-manifest.schema.json
bridge/contracts/schemas/bridge-api.schema.json
bridge/contracts/schemas/create-run-request.schema.json
bridge/contracts/schemas/design-space-candidates.schema.json
bridge/contracts/schemas/design-space-candidates-v2.schema.json
bridge/contracts/schemas/error.schema.json
bridge/contracts/schemas/experiment-descriptor.schema.json
bridge/contracts/validation.py
bridge/contracts/agent_orchestration_capability/MIGRATION_NOTE.md
bridge/contracts/agent_orchestration_capability/__init__.py
bridge/contracts/agent_orchestration_capability/catalog-content.json
bridge/contracts/agent_orchestration_capability/contract.py
bridge/contracts/agent_orchestration_capability/schemas/capability-catalog.schema.json
bridge/contracts/agent_orchestration_capability/schemas/capability-snapshot.schema.json
bridge/contracts/agent_orchestration_capability/schemas/common.schema.json
bridge/contracts/agent_orchestration_capability/schemas/device-profile.schema.json
bridge/contracts/agent_orchestration_capability/schemas/engine-profile.schema.json
bridge/contracts/agent_orchestration_capability/schemas/model-profile.schema.json
bridge/contracts/agent_orchestration_capability/schemas/parameter-descriptor.schema.json
bridge/contracts/agent_orchestration_capability/schemas/topology-profile.schema.json
bridge/contracts/agent_orchestration_capability/schemas/workload-profile.schema.json
bridge/contracts/agent_orchestration_capability/tests/test_capability_contract.py
bridge/contracts/agent_orchestration_capability/tests/test_capability_schemas.mjs
bridge/contracts/agent_orchestration_capability/tests/test_capability_service.py
bridge/server.py
bridge/services/capability_catalog.py
scripts/generate-bridge-client.mjs
src/contracts/bridge-api.ts
src/contracts/generated/bridge-client.ts
src/contracts/generated/bridge-contracts.ts
src/contracts/generated/create-run-schema.ts
src/contracts/generated/evidence-agent-validators.js
src/contracts/generated/experiment-validators.js
src/contracts/generated/agent-orchestration-capability-validators.js
src/lib/api/agent-orchestration-capabilities.ts
src/features/run-experiment/DesignSpaceInputPanel.vue
src/features/run-experiment/request.ts
bridge/test_f8_schemas.mjs
bridge/test_server.py
tests/fixtures/evidence-agent.ts
tests/fixtures/experiment-descriptor.ts
tests/fixtures/phase0c-compatibility/f8-dual-version-cases.json
tests/oracles/phase0d-evidence-reproducibility.mjs
tests/unit/agent-orchestration-capabilities.test.ts
tests/unit/experiment-schema.test.ts
tests/unit/phase0c-f8-dual-version-compatibility.test.mjs
tests/unit/phase0d-evidence-reproducibility-oracle.test.mjs
```

Commit 后 Windows portability follow-up 只包含：

```text
tests/oracles/phase0d-evidence-reproducibility.mjs
tests/unit/phase0d-evidence-reproducibility-oracle.test.mjs
```

Follow-up commit 为 `df1f24452384d328ce402ffa37affbd8c734da13`，message 为
`fix(agent-orchestration): force utf8 in reproducibility oracle`。它为三个 Python 子进程显式增加 `-X utf8`，并增加
真实 commit closure 回归测试。

## 5. Web docs/evidence commit 精确 allow-list（47 files）

```text
bridge/contracts/publication_candidates/agent_orchestration_phase0b/COMPATIBILITY_AND_MIGRATION_REVIEW.md
bridge/contracts/publication_candidates/agent_orchestration_phase0b/README.md
bridge/contracts/publication_candidates/agent_orchestration_phase0b/fixtures/capability-snapshot.publication-candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/prettier.config.mjs
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/capability-snapshot.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/common.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/device-profile.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/engine-profile.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/model-profile.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/parameter-descriptor.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/topology-profile.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/schemas/workload-profile.schema.candidate.jsonc
bridge/contracts/publication_candidates/agent_orchestration_phase0b/tests/test_publication_candidate.mjs
docs/F9_AGENT_BASED_SIMULATION_ORCHESTRATION_PLAN.md
docs/F9_AGENT_ORCHESTRATION/00_GUARDRAILS_AND_GLOSSARY.md
docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md
docs/F9_AGENT_ORCHESTRATION/02_PRODUCT_AND_USER_EXPERIENCE.md
docs/F9_AGENT_ORCHESTRATION/03_TARGET_ARCHITECTURE_AND_OWNERSHIP.md
docs/F9_AGENT_ORCHESTRATION/04_CAPABILITY_AND_PROFILE_CATALOG.md
docs/F9_AGENT_ORCHESTRATION/05_CONVERSATION_AND_DRAFT_CONTRACTS.md
docs/F9_AGENT_ORCHESTRATION/06_INTENT_COMPILER_AND_CLARIFICATION.md
docs/F9_AGENT_ORCHESTRATION/07_DETERMINISTIC_VALIDATION_AND_PLANNING.md
docs/F9_AGENT_ORCHESTRATION/08_WORKFLOW_APPROVAL_AND_EXECUTION.md
docs/F9_AGENT_ORCHESTRATION/09_RAG_EVIDENCE_AND_MEMORY.md
docs/F9_AGENT_ORCHESTRATION/10_TOOLS_SECURITY_AND_INTEROPERABILITY.md
docs/F9_AGENT_ORCHESTRATION/11_EVALUATION_OBSERVABILITY_AND_ACCEPTANCE.md
docs/F9_AGENT_ORCHESTRATION/12_DELIVERY_ROADMAP_AND_BACKLOG.md
docs/F9_AGENT_ORCHESTRATION/13_INTERVIEW_DEMO_AND_ADRS.md
docs/F9_AGENT_ORCHESTRATION/14_CONTRACT_GAP_REGISTER.md
docs/F9_AGENT_ORCHESTRATION/15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md
docs/F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md
docs/F9_AGENT_ORCHESTRATION/17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md
docs/F9_AGENT_ORCHESTRATION/18_COPY_READY_MULTI_AGENT_PROMPTS.md
docs/F9_AGENT_ORCHESTRATION/README.md
docs/development/PHASE0_CAPABILITY_EVAL_REPORT_DRAFT.md
docs/development/PHASE0B_CAPABILITY_PUBLICATION_INTEGRATION_REPORT.md
docs/development/PHASE0B_CONTRACT_DRIFT_AUDIT.md
docs/development/PHASE0B_RUNTIME_CAPABILITY_EVAL_REPORT.md
docs/development/PHASE0C_COMPATIBILITY_EVAL_REPORT.md
docs/development/PHASE0C_F8_DUAL_VERSION_CAPABILITY_PUBLICATION_PRECOMMIT_REPORT.md
docs/development/PHASE0D_DUAL_REPOSITORY_REPRODUCIBILITY_PRECOMMIT_REPORT.md
tests/fixtures/phase0-agent-orchestration/capability-profile-cases.json
tests/fixtures/phase0-agent-orchestration/capability-profile-proposal.fixture.json
tests/fixtures/phase0b-agent-orchestration/runtime-capability-cases.json
tests/fixtures/phase0b-agent-orchestration/runtime-capability-snapshot.fixture.json
tests/unit/phase0-capability-oracle.test.mjs
tests/unit/phase0b-runtime-capability-oracle.test.mjs
```

建议 message：`docs(agent-orchestration): add implementation and evaluation playbook`

## 6. Mixed ownership 与明确排除

- `bridge/test_server.py`：逐 hunk 审计后可整体进入 runtime；内容只覆盖 F8 v1/v2、幂等、八字段 lowering 和 Capability endpoint/release drift。
- `tests/fixtures/evidence-agent.ts`：可进入 runtime；唯一相关改动是 manifest 注册 Capability contract。
- `tests/fixtures/experiment-descriptor.ts`：可进入 runtime；只覆盖 nested v1/v2 options、默认 v1 和 claim-scope fixture。
- generated validators：由正式 Schema/generator 生成，`contracts:check` 无 drift，应与输入原子提交。
- `docs/AI_HANDOFF.md`：混有 Phase 0C、launcher/DPAPI、deployment、Evidence Agent 和 Trace 工作台内容；逐文件暂存无法安全拆分，明确排除。

默认排除：

```text
.prettierrc.json
README.md
bridge/README.md
docs/AI_HANDOFF.md
docs/F9_EVIDENCE_AGENT_USER_GUIDE.md
docs/TRACE_PACKAGE_WEB_PROTOTYPE.md
scripts/deploy-local-backend.ps1
scripts/start-backend.ps1
scripts/start-evidence-agent.ps1
scripts/update-backend.ps1
scripts/configure-evidence-agent.ps1
scripts/evidence-agent-settings.psm1
scripts/initialize-trace-package-catalog.ps1
scripts/repair-wsl-service.ps1
scripts/request-wsl-repair.ps1
scripts/start-workbench.ps1
tests/unit/launcher-config.test.js
tools/launcher/README.md
tools/launcher/build-launcher.ps1
tools/launcher/tilesim_launcher.py
bridge/contracts/proposals/agent_orchestration_phase0/AUDIT_BASELINE.md
bridge/contracts/proposals/agent_orchestration_phase0/README.md
bridge/contracts/proposals/agent_orchestration_phase0/canonical/canonical-digest-vectors.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/canonical/canonical_json.py
bridge/contracts/proposals/agent_orchestration_phase0/canonical/canonical_json.ts
bridge/contracts/proposals/agent_orchestration_phase0/canonical/test_canonical_digest.py
bridge/contracts/proposals/agent_orchestration_phase0/canonical/test_canonical_digest.ts
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/invalid/cases.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/capability-snapshot.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/device-profile.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/engine-semantic-profile.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/model-profile.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/parameter-descriptor.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/topology-profile.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/fixtures/valid/workload-profile.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/capability-snapshot.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/common.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/device-profile.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/engine-semantic-profile.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/model-profile.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/parameter-descriptor.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/profile-common.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/topology-profile.schema.proposal.jsonc
bridge/contracts/proposals/agent_orchestration_phase0/schemas/workload-profile.schema.proposal.jsonc
```

Phase 0 proposal 包依赖被排除的 `.prettierrc.json` JSONC override；在 committed/default formatter 配置下有 16 个 JSONC
文件不通过，因此整包不可作为本次可复现 docs commit 的一部分。

## 7. 门禁结果

| 门禁                                | 结果                                     |
| ----------------------------------- | ---------------------------------------- |
| 后端 WSL module/adjacent/cumulative | 3/3 passed                               |
| Capability Python                   | 6/6 passed                               |
| Capability Schema/Ajv               | 9 Schema + catalog + snapshot passed     |
| F8 Schema runner                    | passed                                   |
| Phase 0C compatibility              | 28/28 passed                             |
| Phase 0D reproducibility oracle     | 8/8 references verified；unit 5/5 passed |
| Bridge full unittest discover       | 105/105 passed                           |
| frontend unit                       | 417 passed，7 skipped                    |
| `pnpm contracts:check`              | passed                                   |
| `pnpm deps:check`                   | passed，207 files                        |
| `pnpm typecheck`                    | passed                                   |
| `pnpm lint`                         | passed                                   |
| `pnpm build`                        | passed；仅既有 chunk warning             |
| desktop fixture E2E                 | 47 passed，5 deployed/live tests skipped |

`pnpm format:check` 和最终 `git diff --check` 在文档更新后重新执行，以最终 pre-commit 审计结果为准。

## 8. Gap 与 Phase 1 DoR

- `GAP-CONTRACT-DRIFT-001`：`validated`；runtime commits 和 revision/generated closure 已形成。
- `GAP-CAP-001`：`validated`；后端 8/8 reference 与最终 runtime snapshot closure 已形成。
- `GAP-PROFILE-001`：`validated`；本状态只表示五类正式 Schema 已发布为 0/unavailable，真实 Profile 数据 Gap 继续开放。

Phase 1 技术 DoR 已 ready，但本任务明确不启动 Phase 1。Docs/evidence 仍需独立授权形成最终发布记录；在授权前停止在
Phase 0D。
