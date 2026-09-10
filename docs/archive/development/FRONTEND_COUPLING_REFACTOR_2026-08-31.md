# Frontend coupling audit and incremental separation

**Date**: 2026-08-31  
**Scope**: frontend Vue/TypeScript only; no Bridge, backend, deployment, or runtime service changes

## Audit result

The dependency-boundary check passed before the refactor. Views do not call the Bridge transport directly, and no
cross-feature imports bypass another feature's public `index.ts`. The primary issue was therefore responsibility
coupling inside individual files rather than an existing dependency cycle.

The highest actionable hotspot was `run-bound-evidence/model.ts`: one file owned public types, artifact identity,
JSON Pointer validation, percentile selection semantics, S1-S9 node construction, and Week 8 execution summaries.
`DesignSpaceView.vue` also contained pure candidate/capability presentation rules that were coupled to page
orchestration.

## Completed separation

The run-bound evidence feature now has explicit internal boundaries:

- `types.ts`: public view-model types and internal build context;
- `evidence-references.ts`: manifest identity, stable subject ID, and JSON Pointer validation;
- `percentile-navigation.ts`: backend-declared percentile semantics and request options;
- `evidence-nodes.ts`: S1, peer S3/S4/S5, S6, and S7-S9 output-node construction;
- `week8-execution.ts`: Week 8 fidelity, fallback, stream, differential, and checkpoint summary;
- `model.ts`: orchestration only;
- `index.ts`: unchanged public feature boundary for consumers.

The F7 feature now owns deterministic Design Space presentation helpers in `f7-analysis/presentation.ts`. The view
continues to orchestrate page state and render components, while rank deltas, metric formatting, bound display,
candidate knob/link projection, and capability labels no longer live in the view.

No evidence rule changed: percentile selection remains backend-declared, S3/S4/S5 remain peers, exact stable IDs
must precede array-derived Pointers, and S7-S9 stay outside causal ranking.

## 2026-09-01 follow-up

Two additional responsibility hotspots were separated without changing their feature-level public imports:

- `run-experiment/model.ts` is now a 17-line compatibility facade. Internal ownership is split into `types.ts`,
  `parameter-contract.ts`, `surface.ts`, `form.ts`, and `request.ts`, separating descriptor/capability adaptation from
  mutable form reconciliation and request validation/serialization. The existing `run-experiment/index.ts` surface is
  unchanged, including exact error-Pointer resolution.
- `EvidenceAgentPanel.vue` now owns page-level Agent composition and submission preparation only. Descriptor v2
  retry/recovery/retention presentation lives in `EvidenceAgentContractPolicy.vue`; validated terminal result and
  citation rendering lives in `EvidenceAgentResultPanel.vue`; shared task/status labels live in `presentation.ts`.

The experiment model was reduced from 827 lines to a facade plus cohesive modules (largest: 471 lines). The Evidence
Agent panel was reduced from 614 to 325 lines, with extracted components of 224 and 80 lines. Descriptor identity,
canonical digest, lossless uint64 handling, idempotency behavior, HTTP terminal mapping, S3/S4/S5 peer semantics, S7
host semantics, and S8/S9 ranking boundaries are unchanged.

## Deferred hotspots

- `JsonArtifactPanel.vue` still combines a connected component with Worker cancellation/search orchestration. A
  future split should introduce an injected artifact-inspection controller/composable together with race and
  cancellation tests; a mechanical template split would not reduce the real coupling.
- `structured-report/model.ts` remains a sizable export assembler. Split it by report section only when the F7
  contract pack lands, so the new Pareto/candidate/topology sections are not moved twice.
- `i18n/index.ts` is large mainly because it is a flat translation dictionary, not because it creates runtime
  dependency cycles. Locale catalog splitting is useful maintenance work but lower risk/priority than the two
  responsibility boundaries addressed here.
- Generated validators and generated contract types are excluded from manual size-based refactoring.

## 2026-09-02 conservative parallelization split

A repo-wide follow-up again found no frontend dependency cycle or view-to-Bridge boundary violation. The remaining
risk is responsibility coupling and shared-file contention. A conservative split was made before three independent
product workstreams begin:

- guided-help definitions moved out of `entities/navigation/model.ts` into a dedicated feature. Its routed and
  embedded guides use a typed catalog; `catalog.ts` deliberately avoids the Windows module-resolution collision that
  would occur between a `guides.ts` file and the `guides/` directory. Typed 3-5 step definitions, terms, memory state,
  a non-modal host, pure presentation components, stable page anchors, empty-state actions, keyboard/focus behavior,
  bilingual coverage, and interaction/E2E closure are in place.
- Evidence Agent provider/descriptor/model/revision details moved to `EvidenceAgentServiceDetails.vue`. Task cards,
  submission preview, lease/409 messaging, and result grouping also moved to pure presentation components. Request
  construction, store ownership, response validation, canonical digest, and terminal state semantics remain in their
  existing owners.
- Execution plain-language subsystem names, headline, explanations, and metric labels moved to
  `execution-inspector/presentation.ts`. Metrics, Fabric, Design Space, and Attribution analysis charts moved to the
  separate `analysis-visualizations.ts` presentation model. Report facts, export, and page state did not move.
- three i18n workstream fragments were added so Agent, visualization, and help work can append English text without
  concurrently editing the large legacy catalog.

Current hotspots remain `EvidenceAgentPanel.vue`, `ExecutionView.vue`, `DesignSpaceView.vue`,
`execution-inspector/model/visualizations.ts`, and broad CSS domains. `src/store/dashboard.ts` remains a compatibility
facade and is not a size-driven refactor target. The next safe extractions are a pure Agent lease/stale/late-response
transition boundary, versioned evidence-reference and snapshot-builder helpers, and a stateless Design Space
candidate-detail component. Deeper store, request-builder, F7 model, CSS cascade, and chart runtime work must be
isolated and regression-tested separately.

Three workstreams must use separate worktrees and the ownership map in `docs/PARALLEL_FRONTEND_WORKSTREAMS.md`.
Global snapshots and shared-file integration belong to a final integration task, not to concurrent agents.

## Verification expectation

Run dependency boundaries, contract drift, typecheck, unit/component tests, lint, repo-wide formatting, production
build, and desktop Playwright. The existing user Bridge on `127.0.0.1:5173` must not be stopped or restarted.
