# F7 metrics-backed Fabric slice

**Date**: 2026-08-30  
**Status**: partial implementation; blocked contract capabilities remain explicit

## Scope

This slice implements only F7 work supported by current versioned run artifacts. It does not add Pareto computation,
candidate-run navigation, topology name matching, or inferred executed knobs.

## Delivered

- A public `f7-analysis` feature model for artifact identity, availability, unique stable-ID matching, and F7
  capability states.
- Fabric domain cards retain backend order and exact `domain_id` identity.
- A backend-reported hotspot section displays explicit dominant domain/kind, backpressure count, and observation
  window from `metrics.system_summary`.
- Request contribution rows display backend queue/congestion/runtime values, dominant domain/kind, phase, and
  collective.
- Exact source links use:
  - `metrics:/system_summary/fabric_domain_utilization/{matched-index}` after unique `domain_id` matching;
  - `metrics:/system_summary/request_fabric_contributions/{matched-index}` after unique `request_id` matching;
  - `metrics:/system_summary/phase_fabric_contributions/{matched-index}` after unique `phase_id` matching.
- Duplicate stable IDs, missing identities, legacy contracts, rejected/unsupported artifacts, and dangling phases do
  not produce navigable links.
- The design-space page now distinguishes backend `final_rank` from missing Pareto membership and labels opaque
  candidate strings as non-navigable.
- Structured report v2 exports Fabric artifact identity, exact references, topology join degradation, and F7
  capability states.

## Explicit blockers

- `pareto`: no backend front/membership/dominance contract;
- `candidate_navigation`: no structured candidate EvidenceRef or Bridge-addressable candidate artifact manifest;
- `executed_s6_knobs`: no complete executed knob records with units, availability, and Pointer;
- `topology_domain_join`: no supported topology schema identity or topology-domain EvidenceRef.

The full backend request remains in `docs/F7_CONTRACT_AUDIT.md`.

## Verification

- contracts drift, dependency boundaries, typecheck, lint, and production build: passed;
- frontend unit/component: 124/124;
- desktop Playwright: 21/21, with two environment-gated live tests skipped when coordinates are absent;
- live Week 8 service: 2/2 (F6B request chain and F7 metrics-backed Fabric);
- F7 desktop/live coverage includes exact metrics SHA/Pointer, backend order, topology degradation, bilingual text,
  keyboard-accessible export overflow regions, axe, and page overflow;
- repo-wide Prettier and `git diff --check`: passed; the five previously blocked Bridge JSON Schema files were
  formatted after explicit authorization without changing their parsed JSON semantics.
