# Frontend-wide readability review

**Date**: 2026-08-31  
**Scope**: Vue/TypeScript frontend, frontend tests, and frontend documentation only

## Review summary

The repository-wide dependency check found no feature cycle, no view that calls `bridgeApi` directly, and no view
or shared component that imports another feature's internal model/component path. The main readability costs were
large mixed-purpose files, repeated status branching, and evidence Pointer construction spread across views and
models.

No `eslint-disable`, TypeScript suppression, TODO/FIXME/HACK marker, debug console call, or explicit `any` was found
in task-owned frontend source. Generated contracts and validators were excluded from manual size-based review.

## Improvements completed

### Translation runtime and catalog

The English catalog moved to `src/i18n/english-catalog.ts`. `src/i18n/index.ts` now contains only locale state,
interpolation, persistence, and the public i18n API. Translation data changes no longer obscure runtime behavior.

### Bridge status presentation

Bridge availability, synchronization, title, revision shortening, and detail text moved from the dashboard
compatibility controller to the pure `bridge-status/model.ts` feature model. The dashboard now applies one explicit
presentation result instead of maintaining nested status ternaries.

### Stable evidence Pointer construction

Execution evidence navigation now uses one stable-ID Pointer model. It covers request metrics, runtime requests,
phase/resource records, fabric request/domain records, validation checks, attribution/cause records, execution
stages, fidelity resolution entries, and implementation entries.

Rules enforced by the helper:

- an ID must be present and match exactly one record;
- duplicate or dangling IDs return no navigable Pointer;
- a repeated memory/device/collective ID may fall back to the same record's unique `phase_id`;
- no object `indexOf`, bare display rank, array position, wildcard selector, name, or opaque link becomes identity;
- aggregate groups without one unique record remain non-navigable.

The shared rule replaced Pointer assembly in execution views, Metrics, Validation, Attribution, execution records,
visualizations, and structured report stage records. `ArtifactEvidenceLink` now accepts an absent source and renders
nothing, keeping fail-closed branches readable.

## Tests added or strengthened

- Bridge status presentation states: synchronized, legacy read-only, version mismatch, and unavailable;
- stable Pointer success, suffix fields, missing ID, duplicate ID, and multi-phase collective ambiguity;
- i18n coverage now scans every separated F6B evidence model file rather than only the orchestration entry.

## Remaining readability debt

- `JsonArtifactPanel.vue` still combines connected state with Worker/search/cancellation orchestration. Extracting a
  controller remains worthwhile but must be paired with explicit stale-response and cancellation tests.
- `structured-report/model.ts` remains a large assembler. Split it by report section after the F7 contract pack
  lands, avoiding a second move when Pareto/candidate/topology sections become formal.
- `RunBoundEvidencePanel.vue` and `DesignSpaceView.vue` are template-heavy. Their scripts are now small; component
  extraction should follow real reuse or independent interaction boundaries rather than a line-count target.
- `english-catalog.ts` is intentionally large data, not runtime coupling. Split it by product domain only when
  translation ownership or loading strategy requires it.
- The ECharts async chunk remains above the bundler warning threshold; this is a performance-loading debt, not a
  readability blocker.

## Verification

- generated TypeScript contracts were refreshed after concurrent local F7 contract changes; contract drift passes;
- dependency boundaries, typecheck, lint, frontend-owned formatting, production build, and `git diff --check` pass;
- unit/component: 134/134;
- desktop Playwright: 21/21, with two environment-gated live tests skipped;
- repo-wide Prettier remains blocked only by two newly added Bridge-owned files that were not included in the
  previous explicit formatting authorization:
  - `bridge/contracts/schemas/design-space-report.schema.json`;
  - `bridge/contracts/schemas/topology-input.schema.json`.

The previously authorized `artifact-manifest.schema.json` and `f6b-common.schema.json` were formatted without
changing their parsed semantic hashes.

The user Bridge on `127.0.0.1:5173` was not stopped, restarted, replaced, or used by the default desktop fixtures.
