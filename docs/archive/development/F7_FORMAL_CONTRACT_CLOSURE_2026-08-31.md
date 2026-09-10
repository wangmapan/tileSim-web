# F7 formal Fabric and design-space frontend closure

**Date**: 2026-08-31  
**Local schema-set revision**: `sha256:cc9696791dc00fd533b92901abc1b838e832af3fa7f06092f1d75aaec6c39e7b`  
**User service**: deployed to `127.0.0.1:5173` after explicit authorization

Final health verification reports `versions_match=true`, `state_digests_match=true`, and `execution_ready=true`.
The deployed source/build digest is `b1711365831a47090bf3d6bec237e065b8bed4b1a09d8c055d6c61b8be7d67d0`, and
the live manifest advertises the formal F7 schema-set revision above.

## Scope

This increment adapts TileSim Web to the formal F7 contracts without modifying the backend or Bridge implementation.
The frontend accepts the new design-space and topology identities while retaining legacy v1alpha1 read-only behavior.

## Implemented contract path

- `design-space:/candidates/{index}` is exposed only after a unique `candidate_id` match and exact candidate
  EvidenceRef validation.
- Objective evidence uses `/candidates/{index}/objectives/{index}` with the stable subject
  `${candidate_id}::${objective_id}`.
- S6 knob evidence uses requested/resolved value Pointers under
  `/candidates/{index}/executed_s6_knobs/{index}` with `${candidate_id}::${knob_id}`.
- Metrics domain records use their formal `topology_domain_ref`; the referenced topology record must be the unique
  `fabric_domain_id` match and must carry its exact `/topology/domains/{index}` Pointer.
- Candidate `backend_run_instance_id` is displayed as a backend instance, never as a Bridge run; navigation remains
  inside the parent run's artifact.

No join uses time proximity, numeric equality, report order, name similarity, opaque-link parsing, or inferred
defaults. Array positions are accepted only as the Pointer location after unique stable-ID resolution.

## Lossless values and degradation

The lossless JSON transport is retained. Formal candidate counts, uint64 S6 knobs, and Fabric domain
`record_count/busy_time_ps/observation_window_ps` are normalized to `bigint`. Zero stays available zero;
`not_applicable` stays null and is displayed separately.

Duplicate stable IDs become `ambiguous_reference`; dangling or wrong run/schema/subject/Pointer becomes
`invalid_reference`; missing artifact identity becomes `artifact_identity_missing`; valid records with unavailable
objectives or knobs are `partial`; legacy reports remain `legacy_compatibility`. Invalid references never receive a
navigable source path.

## UI and accessibility

Fabric now shows the joined topology domain type/kind, module binding, member devices, and topology evidence.
Design Space shows the formal Pareto/objective identities, membership/dominance, candidate artifact navigation,
objectives, and requested/resolved S6 knobs. New text is in the bilingual catalog. Reduced-motion now disables CSS
animations and transitions instead of reducing them to a near-zero interval; formal F7 pages pass axe and desktop
overflow checks.

## Verification

- generated contract drift check: passed after `pnpm contracts:generate`;
- frontend unit/component suite: includes formal/legacy F7, duplicate/dangling/wrong references, topology binding,
  uint64 above `Number.MAX_SAFE_INTEGER`, zero/not-applicable, provenance, and structured export;
- desktop Playwright: formal candidate/objective/knob/topology navigation, axe, overflow, and reduced-motion covered;
- live acceptance run `run-20260831-121324-bbba5cdd`: all nine downloaded artifacts match manifest byte counts and
  SHA-256 values, with no rejected artifacts;
- live Playwright: 3/3 passed for the request-bound F6B chain, formal topology-to-metrics domain evidence, and formal
  Pareto/candidate/objective/requested-resolved knob evidence;
- the repo-wide formatter passed after explicit authorization to format
  `design-space-report.schema.json`, `topology-input.schema.json`, and `bridge/test_f7_schemas.mjs`; both schemas retain
  the same normalized JSON SHA-256, so the formatting-only change did not alter contract semantics.

Exact final command counts are recorded in `docs/AI_HANDOFF.md` after the complete gate run.
