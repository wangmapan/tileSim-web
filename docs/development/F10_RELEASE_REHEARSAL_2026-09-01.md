# F10 Release Rehearsal Evidence — 2026-09-01

## Scope and decision

This record covers the immutable TileSim Web release rehearsal, the authorized local deployment and the live deployment
surface. It does not claim F9 model acceptance: no authenticated TileSim Evidence Agent Provider configuration was
available, so live model repetitions remain `0`.

## Rehearsal evidence

- Temporary port: `58173` (the user service on `5173` was not used for fault injection).
- Rehearsal identity: `run-20260901-121421-34852`.
- Created TileSim run: `run-20260901-121426-a52fbe64`.
- Initial immutable snapshot: `execution_ready=true`.
- Injected candidate: TileSim CLI path deliberately absent; `execution_ready=false`.
- Recovery: previous manifest and immutable snapshot restarted with `execution_ready=true`.
- State retention: the completed run remained readable after the recovered process started.
- Byte boundary: the release snapshot verified its Bridge and static byte digests before startup.

This proves the non-5173 process, health, schema and run-state recovery path with a real Bridge process. It is separate
from the unit test that verifies exact manifest/Python/static-byte recovery in a temporary directory.

## Authorized 5173 deployment identity

- TileSim source/build revision: `4a536cc081abb20567c19ab9e94e6139f5008333`.
- TileSim source/build state digest: `sha256:77b6e56cf4b9739492b848c1fb11d2eb9215631f60760e86748e307ea5e6f665`.
- TileSim Web revision at the first deployment: `5727b5cdc3e7e5c970bf9c9ce7cf525c09376144`.
- Schema-set revision: `sha256:be0c2274a37b765de93ced0c2720d36da9e8db10977b1e688da8fd7e91882f4d`.
- Release identity: `tilesim.web.release_snapshot.v1`.
- Release digest: `3163b6f32d5594ff093f2010fdcc041d1437f97df2099b2d57ccc811dfee1afa`.
- Health decision: `execution_ready=true`, `versions_match=true`, `state_digests_match=true`.
- F9 surface: descriptor v2 and the formal analysis route were available; absent dedicated Provider configuration was
  represented as `provider_unavailable`.

The final release digest is expected to change after the accessibility and release-audit fixes in this branch are
committed and redeployed. This record retains the first deployment identity; the final handoff must record the new one.

## Run and artifact traceability

Acceptance run `run-20260831-121324-bbba5cdd` was re-read from the deployed Bridge. All nine artifact response bodies
matched both the manifest byte count and SHA-256 digest, and `rejected_artifacts=[]`. The generated
`tilesim.web.release_identity_matrix.v1` included TileSim source/build/state, TileSim Web source/build/release, schema set,
run and artifact identities. It omitted Provider/model/prompt/policy because no successful exact authenticated probe was
available; omission is the required safe state.

## Live browser result before final redeploy

The live suite used request `req_prefill_0` from the acceptance run:

- F6B request-bound evidence: passed;
- F7 Fabric: passed;
- F8 experiment descriptor: passed;
- F9 descriptor v2 and unavailable UI: passed;
- F7 Design Space: failed only on a 4.41–4.47 axe color-contrast finding in the deployed pre-fix static snapshot.

The color token was corrected in source. A final immutable redeploy and 5/5 live rerun are required before this record is
closed.

## Remaining gates

- run the complete source/Bridge/fixture suite after the final fixes;
- commit and push the release candidate;
- redeploy the pushed revision and obtain 5/5 live browser acceptance;
- clone the remote branch into a disposable directory, install with the frozen lockfile and rerun the complete gates;
- confirm a clean worktree and no open P0/P1 release issue.

F9 model success/refusal/timeout, repeated model evaluation and two-reviewer citation entailment remain external release
blockers, not failures of the deployed descriptor/Bridge contract.
