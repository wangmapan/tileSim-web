# F6B / Week 8 run-bound evidence closure record

**Date**: 2026-08-30  
**Status**: validated; implementation, live acceptance, and repository gates complete

## Runtime identity

- Service: `127.0.0.1:5173` (read-only verification; not restarted by this work)
- Backend: `D:\tileSim-week8`
- Branch: `codex/week8-scale-system-acceptance`
- Revision: `4a536cc081abb20567c19ab9e94e6139f5008333`
- Schema-set revision: `sha256:eac6917790bf868f8fdb08e8bd45ce640d0e163c9f237abb0ce53747c1643faf`
- Artifact manifest: `tilesim.bridge.artifact_manifest.v2`
- Live run: `run-20260830-220022-bf691f18`
- Live selected request: `req_prefill_0`
- Health: `versions_match=true`, `state_digests_match=true`, `execution_ready=true`

## Delivered frontend behavior

- Artifact manifest v2 identity, raw response byte count, SHA-256, schema identity, schema revision, and run binding
  validation with fail-closed degradation.
- Lossless JSON parsing and bigint handling for uint64 ps/bytes/count fields.
- Backend-selected P99 percentile subject semantics: single request, tie/no-single-request member set, and
  not-applicable.
- Request-bound S1, peer S3/S4/S5, S6, S7 stage, S8 check, and S9 cause/attribution nodes using stable IDs and
  structured EvidenceRefs only.
- Week 8 requested/resolved fidelity, execution mode, fallback, state summary, differential, stream counts/truncation,
  and bounded checkpoint metadata.
- Accurate degradation for duplicate/dangling/wrong references, manifest/hash/byte/schema/run mismatches,
  unsupported schemas, run-only association, not-applicable, missing identity, and legacy compatibility.
- Shared request selection and recoverable `run + evidence_request` deep link.
- Localized desktop UI, themes, overflow, keyboard, axe, reduced-motion, and compact high-density evidence rendering.
- Structured performance report v2 now preserves the same selected request, percentile subjects, S1-S9 nodes,
  artifact SHA-256/JSON Pointers, Week 8 summary, gaps, and bigint values. It never auto-selects P99 during export.

## Evidence rules retained

- S3/S4/S5 remain peers; no sequential S3 → S4 → S5 chain is created.
- Array indexes are used only to materialize a JSON Pointer after exact unique stable-ID matching.
- No latency sorting/equality, nearest value, timestamp proximity, text/name similarity, rank, or opaque link parsing
  is used as a join.
- S7-S9 remain execution/validation/output planes and are excluded from causal ranking.
- Synthetic and compatibility provenance are not upgraded to real-trace or held-out fidelity.
- Requested fidelity, resolved fidelity, and execution mode remain separate; Analytical/DES are not labeled Cycle.

## Verification

The implementation was accepted against the live Week 8 run, including the request highlight, S1 applicability,
S7 accessibility wrapper, expandable evidence references, and a dedicated live Bridge Playwright smoke test.

Final closure-pass results after explicit authorization to format the five Bridge contract files:

- contracts drift, dependency boundaries, typecheck, lint, production build, and repo-wide Prettier: passed;
- frontend unit/component: 124/124;
- Bridge: 40/40;
- desktop Playwright: 21/21, with two environment-gated live tests skipped when coordinates are absent;
- live Week 8 smoke against the existing 5173 service: 2/2;
- `git diff --check`: passed (only pre-existing line-ending notices);
- semantic JSON hashes for all five formatted Bridge contract files were unchanged.

The Playwright pass also caught and closed an AA contrast regression during the execution-flow entrance animation.
The final motion keeps a single 280 ms transform, retains reduced-motion behavior, and no longer fades evidence text
through insufficient-contrast intermediate colors.

## Closed formal blocker

Repository-wide `pnpm format:check` previously reported formatting drift in five Bridge-owned contract files:

- `bridge/contracts/openapi.json`
- `bridge/contracts/schemas/artifact-manifest.schema.json`
- `bridge/contracts/schemas/f6b-common.schema.json`
- `bridge/contracts/schemas/metrics-report.schema.json`
- `bridge/contracts/schemas/week8-run-evidence.schema.json`

The user explicitly authorized modification on 2026-08-31. The files were formatted with Prettier, their parsed JSON
semantic hashes remained identical, generated contracts were refreshed without drift, and the repo-wide gate passed.
No frontend runtime or evidence semantics changed. F6B is now `validated`.

## Next phase

Proceed only with the F7 contract audit and truthful metrics-backed Fabric UI. Pareto, candidate navigation,
topology-domain joins, and executed-knob comparisons remain blocked as documented in `docs/F7_CONTRACT_AUDIT.md`.
