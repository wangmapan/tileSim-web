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

## Verification expectation

Run dependency boundaries, contract drift, typecheck, unit/component tests, lint, repo-wide formatting, production
build, and desktop Playwright. The existing user Bridge on `127.0.0.1:5173` must not be stopped or restarted.
