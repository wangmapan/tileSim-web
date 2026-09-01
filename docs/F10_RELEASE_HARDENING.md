# F10 Release Hardening Gate

**Date**: 2026-09-01
**Status**: source closure implemented; clean-environment and temporary-process release rehearsal open

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

## 3. Required release rehearsal

Run the following against a clean machine or disposable VM, not an already prepared developer checkout:

1. install the documented Node, pnpm, Python and WSL prerequisites;
2. clone the exact Web and TileSim revisions and run frozen-lockfile install;
3. run the complete frontend, Bridge, Schema/OpenAPI, canonical digest, Python compile and desktop Playwright gates;
4. build and deploy to a temporary port, create a run, restore it after process restart, compare two runs and export the
   complete structured report through the Worker path;
5. on a non-5173 temporary port, inject a post-manifest startup failure and prove the previous immutable snapshot process,
   health identity and schema revision are restored; the manifest/Python/static byte restoration portion is automated;
6. verify artifact response bytes, manifest byte count and SHA-256 for every supported artifact used by the acceptance run;
7. record the release identity matrix with `pnpm release:identity -- --deployment <path> --artifacts <path> --output <path>`
   and confirm that no P0/P1 issue remains open.

The real `127.0.0.1:5173` service may be switched only in an explicitly authorized deployment window after the disposable
rehearsal passes.

## 4. F9-specific release gate

F9 remains `live-blocked` until the F9C source is deployed and all required `TILESIM_EVIDENCE_AGENT_*` names are configured
without exposing their values. The authenticated probe must exactly match protocol/provider/model/revision. Real success,
refusal and timeout samples, at least five repetitions for every safety/refusal boundary, and two-reviewer citation
entailment review must all pass. Live repetitions remain `0` until those events are recorded.

## 5. Stop conditions

- any source/build/state/schema/artifact identity mismatch;
- deployment rollback does not restore the previous healthy identity;
- any F9 hard-gate or citation entailment failure;
- any provenance/fidelity promotion or uint64 loss;
- any open P0/P1 release issue.

These conditions block validation rather than becoming warnings.
