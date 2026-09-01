# F9 Evidence Agent Contract Audit

**Audit date**: 2026-09-01
**Scope**: read-only evidence Agent for the TileSim desktop web product  
**Status**: Bridge descriptor v2 recovery/retention contract, generated DTO/runtime validators, frontend consumers and
source deployment closed; authenticated Provider configuration and live model evaluation remain open

## 1. Decision

TileSim Web now consumes the versioned read-only Agent contract published by the Bridge. The deterministic structured report still keeps `agent_analysis.status=not_generated`; an Agent result is a separate, run-bound, user-confirmed draft and never replaces report facts.

The next safe split is:

- **F9A, complete**: contract audit, evaluation specification, 36-case machine-readable catalog and deterministic contract tests.
- **F9B, frontend descriptor v2 adaptation complete**: generated DTO/runtime validators, fixture, manifest-bound API validation,
  stable descriptor policy adapter, UI retry/recovery/persistence/payload-retention rendering and both structured 409 recovery
  states consume the v2 policy. The adapter performs no digest or integer conversion.
- **F9C, source deployed**: the fixed-endpoint Provider adapter, authenticated capability probe, read-only record projection,
  strict output validation and safe terminal failures are implemented and covered by Bridge tests.
- **F9C model acceptance, blocked**: 5173 now publishes the Agent endpoints and descriptor v2, but no TileSim-specific
  Provider configuration is present and live repetitions are `0`. No fake success is used to close this boundary.

The current source schema-set revision is
`sha256:be0c2274a37b765de93ced0c2720d36da9e8db10977b1e688da8fd7e91882f4d`; descriptor revision is
`sha256:d68d4d18046e99452e56ac442ac9e4382e3cbcb593cf2bf228fbbd06a7c6f851`, prompt revision is
`tilesim.evidence_agent.prompt_template.v2`, and policy revision is `tilesim.evidence_agent.read_only_policy.v2`.
The frontend discovers `GET /api/agent/evidence-capabilities` and
`POST /api/runs/{run_id}/agent/evidence-analyses` from `/api/manifest.evidence_agent`, then binds manifest, payload and
response headers to that revision. The running 5173 service now publishes the same schema set and descriptor revision;
the capability route returns formal `provider_unavailable` because its required dedicated configuration is absent.

## 2. Evidence inspected

| Surface                      | Existing identity or location                                                               | What F9 may reuse                                                                                     | Limitation                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Structured export            | `tilesim.web.structured-performance-report.v2` in `src/features/structured-report/model.ts` | run identity, evidence boundary, artifact index, canonical process model, S1-S9 evidence, F7 appendix | Frontend compatibility contract, not a backend canonical report schema                 |
| Run-bound evidence           | `src/features/run-bound-evidence/`                                                          | exact stable-ID resolution, manifest identity, SHA-256, JSON Pointer, availability/degradation states | Only verified references may enter an Agent input allow-list                           |
| Artifact manifest            | `tilesim.bridge.artifact_manifest.v2`                                                       | run binding, `schema_set_revision`, artifact ID, schema identity, bytes and SHA-256                   | A manifest entry alone does not prove that a claim is supported by a record            |
| Week 7 orchestration         | `POST /api/week7/orchestration-example`, `tilesim.agent.orchestration_report.v1alpha1`      | deterministic allow-listed tool-call example                                                          | Backend-global fixed synthetic intent; not a language Agent and not run-bound analysis |
| Experiment descriptor        | `GET /api/experiment-schema`                                                                | capability/revision fail-closed precedent                                                             | Describes experiment input, not Agent availability or permissions                      |
| Structured report Agent slot | `/agent_analysis`                                                                           | explicit `not_generated` state                                                                        | Must remain unchanged until a separately versioned result is verified                  |

OpenAPI now exposes the versioned capability and analysis endpoints plus closed descriptor, request, response, citation and snapshot-reference schemas. Provider availability remains a runtime capability state, not a frontend inference.

## 3. Existing trustworthy input boundary

An eligible F9 input can be assembled only after the existing deterministic pipeline succeeds:

```text
/api/manifest revision
  -> run artifact manifest
  -> raw response bytes + byte count + SHA-256
  -> supported schema adapter
  -> exact stable-ID and JSON Pointer validation
  -> structured-performance-report.v2
  -> immutable Agent input snapshot
```

The input snapshot may include only facts already present in the verified structured report and its referenced artifacts. The Agent must read the embedded structured JSON, not parse the rendered HTML. The following identities must remain available to the response validator:

- `run_id`
- `schema_set_revision`
- `artifact_id`
- `schema_identity`
- artifact `sha256`
- `json_pointer`
- `subject.kind` and `subject.id`, where applicable
- stable request, phase, memory event, device task, collective, stage, check, cause and attribution IDs
- `source_mode`, `calibration_level`, `allowed_claim_scope`, validation lane and evidence tier
- requested fidelity, resolved fidelity and execution mode as separate values

The frontend must freeze this snapshot for one analysis request. A run switch, manifest revision change, artifact hash change, or backend identity change makes the result stale and non-displayable as current evidence.

## 4. Delivered production contracts

The Backend/Bridge has supplied the following contract surfaces. The requirements below remain the acceptance criteria enforced by generated runtime validators and the F9 feature.

### 4.1 Capability descriptor

A versioned, cache-safe descriptor is required to state:

- whether the evidence Agent is available, unavailable, disabled, or degraded;
- supported input and output schema identities;
- provider, model, model revision, prompt/template revision and policy revision;
- supported languages and maximum input/output limits;
- allowed tool classes and an explicit declaration that shell, arbitrary file, arbitrary HTTP and arbitrary path access are unavailable;
- persistence, retention and redaction policy;
- timeout, cancellation, concurrency and retry semantics;
- schema-set revision compatibility and response headers used for revision binding.

Capability must be a structured predicate. The frontend must not parse a human-readable unavailable reason to enable controls.

### 4.2 Analysis request

A closed request schema is required with at least:

- request schema identity and schema-set revision;
- run ID and immutable input snapshot digest;
- structured report schema identity and complete report payload or an exact registered report reference;
- artifact/citation allow-list containing the verified identities above;
- requested locale and explicitly selected task kind;
- idempotency key and client request ID;
- optional user question treated as untrusted content, separate from system policy and evidence.

The contract must define whether the Bridge accepts an embedded report or a server-side registered snapshot. It must not accept a browser-supplied filesystem path or URL.

### 4.3 Analysis response

A closed response schema is required with at least:

- response schema identity, request ID, run ID and input snapshot digest;
- completion state such as completed, refused, failed, cancelled or truncated;
- model/provider identity plus model, prompt/template and policy revisions actually used;
- ordered draft sections and atomic claims;
- stable claim ID, claim kind, text, confidence semantics if confidence is exposed, and exact citations for each evidentiary claim;
- refusal object with stable machine-readable reason code and safe user-facing detail;
- degradation and truncation declarations;
- audit/tool log containing only allow-listed operations and digests, without secrets or hidden chain-of-thought;
- generated time, expiry/staleness semantics and persistence identity if results are stored.

The frontend needs atomic claims because citation coverage cannot be validated reliably against a free-form answer-level citation list.

### 4.4 Citation object

Each citation must be a closed structured object containing:

- run ID;
- artifact ID;
- schema identity;
- artifact SHA-256;
- JSON Pointer;
- subject kind and stable subject ID when the claim concerns an entity;
- optional value field only if its lossless representation and unit are defined by the contract;
- citation role, for example direct fact, reported attribution, validation boundary or provenance constraint.

The Bridge must verify that citations are members of the request allow-list, resolve to the same raw artifact bytes, and point to the claimed subject. The frontend must independently re-check the returned identities against its frozen snapshot before enabling navigation.

### 4.5 Refusal and audit behavior

Stable refusal reasons are required for at least:

- insufficient evidence;
- citation not allowed or not resolvable;
- unsupported schema or stale revision;
- run binding mismatch;
- conflicting or ambiguous stable identity;
- claim outside provenance or fidelity scope;
- unsafe tool/path/network request;
- prompt injection or policy conflict;
- input too large or output truncated;
- provider unavailable, timeout or cancellation.

Human text is display-only. Branching must use the stable code.

## 5. Published surface

The following names are published in OpenAPI and consumed through generated frontend types/client methods.

| Surface                                           | Identity                                      | Purpose                                                  |
| ------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `GET /api/agent/evidence-capabilities`            | `tilesim.bridge.evidence_agent_descriptor.v2` | capability, revisions, limits and policy                 |
| `POST /api/runs/{run_id}/agent/evidence-analyses` | `tilesim.bridge.evidence_agent_request.v1`    | create one immutable run-bound analysis                  |
| response/result                                   | `tilesim.bridge.evidence_agent_response.v1`   | completion, claims, citations, refusal and audit summary |
| citation definition                               | `tilesim.bridge.evidence_agent_citation.v1`   | exact evidence identity and subject binding              |

If asynchronous execution is used, OpenAPI must additionally define status polling or SSE, cancellation and terminal-state recovery. Idempotency must specify same-key/same-payload reuse and same-key/different-payload conflict.

### 5.1 Delivered F9C Provider boundary

The Bridge owns one versioned JSON/HTTPS protocol, `tilesim.evidence_agent_provider.v1`. Provider configuration is read only
from the following process environment variables; browser requests cannot supply or override them:

- `TILESIM_EVIDENCE_AGENT_PROVIDER=tilesim_json_https_v1`
- `TILESIM_EVIDENCE_AGENT_ENDPOINT`
- `TILESIM_EVIDENCE_AGENT_API_KEY`
- `TILESIM_EVIDENCE_AGENT_MODEL`
- `TILESIM_EVIDENCE_AGENT_MODEL_REVISION`
- optional `TILESIM_EVIDENCE_AGENT_TIMEOUT_MS`
- optional `TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS`

The adapter does not consume generic `OPENAI_*` variables. It rejects non-loopback HTTP, redirects, URL userinfo, query and
fragment components. Availability becomes true only after an authenticated probe exactly matches protocol, capability,
provider, model and model revision.

Analysis input contains a fixed system policy, an empty tool list, untrusted user-question isolation and only the allow-listed
records resolved from already verified artifacts. The Bridge validates the returned request/run/digest, schema-set,
provider/model revisions, claim IDs, citations, SHA-256, JSON Pointers, stable subjects, provenance, fidelity and subsystem
scope before returning claims. Timeout, transport failure, invalid JSON, invalid citation and provider identity mismatch
become closed `EvidenceAgentResponse` terminals using the documented `502/503/504` statuses; raw Provider output is never
used as a fallback answer.

Python and Node golden vectors independently verify Unicode code-point key ordering, array preservation and lossless uint64
canonical decimal tokens. The request snapshot digest now uses the request-root identity
`tilesim.bridge.evidence_agent_request.v1`; locale, task kind, client request ID and untrusted question remain outside the
material digest as declared by the descriptor.

## 6. Mandatory claim rules

The response validator and UI must enforce these rules before a draft can be shown as evidence-backed:

1. Every numeric, comparative, causal, bottleneck or recommendation claim has at least one valid direct citation.
2. A citation matches the frozen run, schema-set revision, artifact identity, raw-byte SHA-256 and exact JSON Pointer.
3. Entity claims match an exact unique stable subject ID. Duplicate or dangling IDs fail closed.
4. Citation pointers are resolved only after stable-ID match; array index is location, never identity.
5. Reported attribution may be explained as reported attribution. The Agent may not manufacture a new causal ranking.
6. S3, S4 and S5 remain peer resource-semantics subsystems. They are never rewritten as a sequential chain.
7. S7 is the execution host; S8/S9 are validation/output. They cannot be ranked as latency-producing causes.
8. `synthetic_trace` and `compatibility_harness_trace` never become real trace, held-out validation or hardware fidelity.
9. Requested fidelity, resolved fidelity and execution mode remain separate. Analytical/DES never becomes Cycle.
10. `0`, missing, expected absence, not covered, unsupported schema and not applicable remain distinct.
11. uint64 ps/bytes/count values remain lossless in input, citations and rendered text.
12. Recommendations are conditional drafts tied to cited reported facts; they do not claim an unexecuted optimization result.

## 7. Forbidden frontend workarounds

The frontend must not:

- call an undocumented endpoint or provider directly;
- place provider credentials in browser code or storage;
- parse opaque `evidence_link` strings;
- join by time proximity, window overlap, numeric equality, rank, array position, name, title, code or text similarity;
- let the model browse arbitrary paths, files or URLs;
- send unverified raw artifacts or cross-run history outside the frozen allow-list;
- accept answer-level citations as coverage for uncited atomic claims;
- repair a wrong run ID, Pointer, schema identity, SHA-256 or subject ID heuristically;
- display partial/truncated output as complete;
- write Agent content into deterministic report fields or silently persist it as simulation fact;
- use a mocked successful response to mark F9 validated.

## 8. Degradation and display states

F9 needs distinct presentation states; these are frontend view semantics, not proposed backend enum values.

| State                 | Required behavior                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `not_configured`      | No production Agent contract; keep `agent_analysis=not_generated`                            |
| `unavailable`         | Capability explicitly unavailable; show structured reason without enabling submit            |
| `contract_gap`        | Required identity, revision, claim or citation field absent; fail closed                     |
| `unsupported_schema`  | Preserve raw result for diagnostics but do not render it as analysis                         |
| `stale`               | Run/backend/revision/hash no longer matches frozen input; do not attach to current run       |
| `ambiguous_reference` | Duplicate stable ID; disable citation navigation and reject affected claim                   |
| `partial`             | Explicit partial completion; show only independently valid claims and a prominent boundary   |
| `refused`             | Show refusal code/detail; do not synthesize a fallback answer                                |
| `available_draft`     | All displayed claims pass identity and citation validation; user confirmation still required |

## 9. Frontend implementation boundary

### Implemented now

- generated descriptor/request/response/citation types and standalone Ajv validators;
- manifest-driven capability/analysis endpoint discovery and schema revision failure closure;
- canonical UTF-8 JSON with Unicode code-point ordering and lossless bigint decimal tokens;
- supported-artifact allow-list construction from verified manifest identities and exact stable-ID Pointers;
- same-key/same-payload in-process exact recovery, plus disk recovery for claim-free Bridge terminals, without retaining the
  question or claims-bearing model response;
- frontend submission leases remain bound to the original Idempotency-Key after a terminal response; the same canonical
  payload replays that terminal, while a different payload remains a visible conflict until explicit user discard;
- atomic citation validation, stale-result isolation and exact artifact navigation;
- current-context validation compares run, backend identity, schema-set revision and input snapshot digest after the response
  arrives; any changed binding hides claims, preserves the old key and requires explicit discard before a new analysis;
- once a submission key exists, completion, retryable failures and non-retryable contract/transport failures all retain the
  lease; stale responses still undergo complete terminal, output-limit, claim and citation validation before claims are hidden;
- distinct `failed`/`provider_unavailable`/`timeout` presentation for formal `502/503/504` response contracts;
- explicit `terminal_result_not_retained` recovery boundary that preserves and locks the original Idempotency-Key until the
  user discards it, without automatic Provider replay or a recovered label;
- formal `provider_unavailable` desktop presentation with no successful mock claim.

### Still blocked by provider availability

- a complete TileSim-specific provider configuration and successful authenticated capability probe;
- a real terminal success/refusal response from the live endpoint;
- repeated live model evaluation, human entailment review and production latency/timeout observations;
- any claim that F9 is live-validated rather than contract-adapted.

### Versioned persistence contract closure

Descriptor identity `tilesim.bridge.evidence_agent_descriptor.v2` replaces the contradictory v1 strings with closed branch
objects. `/execution/retry/same_key_same_canonical_payload` states that every in-process terminal is replayed exactly, a
claim-free Bridge terminal is reconstructed after restart from redacted metadata, and claims-bearing or claim-free Provider
terminals return `error_terminal_result_not_retained`; `/execution/retry/.../provider_reinvocation=forbidden` prevents silent
regeneration. `/execution/retry/same_key_different_canonical_payload` fixes HTTP 409, `idempotency_payload_mismatch`,
`/headers/Idempotency-Key` and `retryable=false`.

`/execution/terminal_recovery` publishes the same branches and formal 409 envelope. `/persistence/mode` is now a structured
object with `storage_scope=run_local`, `record_kind=redacted_terminal_metadata_only` and record identity
`tilesim.bridge.evidence_agent_terminal_record.v2`. The persistence policy explicitly forbids retention of user questions,
snapshot/artifact payloads, Provider raw responses, validated model claims, credentials and hidden reasoning. Request,
response, citation and snapshot-reference fields did not change and remain v1.

## 10. Closure checklist

F9 may be marked validated only when:

- OpenAPI and closed JSON Schemas deliver every contract in section 4;
- manifest, descriptor/header and request/response revisions fail closed;
- all citations independently resolve against verified raw bytes and exact subjects;
- the complete evaluation gate in `F9_EVIDENCE_AGENT_EVALUATION_SPEC.md` passes;
- the draft remains separate from deterministic report facts and requires user confirmation;
- desktop Chinese/English, overflow, keyboard, axe and reduced-motion acceptance passes;
- live tests use a real contract surface and do not weaken evidence rules with mocks.
- authenticated provider identity and all prompt/policy/model revisions are recorded for every live repetition;
- cross-process terminal recovery semantics are versioned consistently without contradicting the retention policy.

## 11. Current verification evidence

- source revisions printed by the Bridge match schema set `sha256:be0c2274…`, descriptor `sha256:d68d4d18…`, prompt v2 and
  policy v2;
- `pnpm contracts:generate` updates only `bridge-contracts.ts` and `evidence-agent-validators.js`; `pnpm contracts:check` passes;
- `pnpm typecheck`, dependency boundaries, lint and production build pass with no descriptor v1 consumer remaining;
- Bridge discovery runs 75/75 tests, including Provider configuration/probe/transport/output/recovery coverage and explicit
  removal of claim-free Provider refusal content from the redacted terminal record;
- the F9 Schema/OpenAPI inventory remains 36/36;
- Python and Node canonical digest golden gates both pass two vectors;
- frontend unit/component tests pass 226/226, including 61/61 targeted Agent descriptor-adapter, API, validation, store and
  component cases;
- desktop fixture Playwright passes 25/25, including configured availability, atomic citation navigation, partial/truncated,
  stale isolation, formal `502/503/504` terminals, idempotency, `409 terminal_result_not_retained` and
  `409 idempotency_payload_mismatch` recovery boundaries;
- the generated Evidence Agent validator bundle now includes `tilesim.bridge.error.v1`; informal error objects, stale error
  headers, malformed fixed-409 fields, `502/503/504` error envelopes and HTTP/completion-state contradictions fail closed;
- live model repetitions remain `0`; the running 5173 service is upgraded but correctly reports `provider_unavailable`
  because all required dedicated Provider variables are absent;
- repo-wide Prettier and `git diff --check` pass; `bridge/test_f9_canonical_digest.mjs` was changed only by Prettier and both
  canonical digest implementations still pass the same two golden vectors.
