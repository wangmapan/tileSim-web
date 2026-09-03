# F10 Release Hardening Gate

**Date**: 2026-09-01
**Status**: validated for immutable release, rollback, traceability and disposable-install mechanics; stable-candidate rehearsal repeated 2026-09-02

## 1. Release decision

F10 is not validated by a successful local build alone. A release candidate must bind one TileSim source/build/state,
one TileSim Web source/build, one Bridge schema set, and the exact run/artifact identities observed by the browser. F9 adds
provider/model/prompt/policy identities only after a successful authenticated probe; fixture Provider output never qualifies.

## 2. Implemented source gates

- structured report generation and HTML rendering run in `structured-report.worker.ts`; synchronous generation is a complete
  fallback rather than a truncated export;
- ECharts remains asynchronously loaded and is split into independently cacheable runtime and SVG-renderer chunks;
- dashboard run/history/comparison/restore coordination is separated from the compatibility facade;
- both deployment modes record `web_source_revision`, `web_source_state_digest`, `web_build_digest`, immutable release
  identity/digests and `schema_set_revision` alongside TileSim source/build/state identity;
- every candidate copies its runtime `bridge/` and `dist/` bytes into a content-addressed, immutable
  `runtime/releases/<release-id>` snapshot. `release.json` binds normalized paths, exact file counts, byte counts and SHA-256
  digests; mutable `runs/` state remains outside the snapshot;
- `start-backend.ps1` verifies the snapshot before stopping the old service, starts the Bridge and static host from that
  snapshot, then requires health to report the same Web release/source/build/Bridge/static and schema identities;
- a failed restart atomically restores the previous manifest and restarts the previous immutable snapshot; a rollback
  failure is never reported as success. A temporary-directory post-manifest failure test proves the previous manifest and
  exact Python/static bytes remain recoverable without touching port 5173;
- `release-identity.mjs` generates `tilesim.web.release_identity_matrix.v1` from explicit deployment and artifact manifests.
  Evidence Agent provider/model/prompt/policy fields are accepted only from an explicit exact authenticated-probe record;
  the tool does not read Provider environment variables.

## 3. Release rehearsal status

Completed on 2026-09-01:

- a content-addressed release snapshot was started on temporary port `58173` with `execution_ready=true`;
- a real `s1_des_example` run completed and remained readable after process restart;
- a candidate with a deliberately missing TileSim CLI was observed as `execution_ready=false` and was rejected;
- restoring the previous manifest and immutable snapshot restored the healthy process, schema identity and completed run;
- the authorized `127.0.0.1:5173` switch published matching source/build/state/release/schema identities;
- the live acceptance run's nine artifact response bodies matched manifest byte counts and SHA-256 values;
- `tilesim.web.release_identity_matrix.v1` bound TileSim, Web, release, schema, run and artifact identities. Provider identity
  was correctly omitted because no authenticated probe had succeeded.

The final release gate ran against a disposable clone of the remote branch rather than the prepared developer checkout:

1. the exact remote Web revision was cloned into a new directory and installed with `pnpm --frozen-lockfile`;
2. frontend, Bridge, Schema/OpenAPI, canonical digest, Python compile and desktop Playwright gates passed;
3. the clean checkout exposed CRLF/LF-only false drift in contract generation and repo-wide Prettier;
4. repository text is now checked out as LF and contract drift checks normalize line endings without changing generated
   contract semantics;
5. a final fresh clone passed contract drift, formatting, build and the complete test suite with a clean worktree;
6. the final P0/P1 sweep found no open release issue.

The authorized `127.0.0.1:5173` switch and the subsequent final release switch both used the immutable snapshot path. Any
future switch must still use an explicitly authorized deployment window and the same rollback rules.

### Stable-candidate rehearsal · 2026-09-02

The post-integration stable candidate was rehearsed again on isolated port `58173` without touching `5173`:

- release digest `13c87c6846debfa84ce7c03d3ce6eed97dc7b36c6811d3929c73b27e14ce9405` started with
  `execution_ready=true` and schema set `sha256:92acce87f4f611893fafb2bf81dd1fa4fac509316ea2b5215a60f1995688871e`;
- real run `run-20260902-141146-20233a97` completed;
- a deliberately missing CLI changed the candidate to `execution_ready=false`;
- restoring the manifest returned `execution_ready=true`, retained the completed run, and verified immutable bytes;
- the deployed `5173` service remained healthy and retained its existing completed run throughout the rehearsal.

## 4. F9-specific release gate

F9C source and descriptor v2 are deployed, and the authenticated Provider probe now exactly matches the required
protocol/provider/model/revision and reports available. F9 remains `acceptance-pending`: real success, refusal and timeout
samples, at least five repetitions for every safety/refusal boundary, and two-reviewer citation entailment review must all
pass. Live model repetitions remain `0` until those events are recorded.

## 5. Stop conditions

- any source/build/state/schema/artifact identity mismatch;
- deployment rollback does not restore the previous healthy identity;
- any F9 hard-gate or citation entailment failure;
- any provenance/fidelity promotion or uint64 loss;
- any open P0/P1 release issue.

These conditions block validation rather than becoming warnings.
