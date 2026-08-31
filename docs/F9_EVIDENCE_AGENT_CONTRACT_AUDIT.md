# F9 Evidence Agent Contract Audit

**Audit date**: 2026-08-31  
**Scope**: read-only evidence Agent for the TileSim desktop web product  
**Status**: runtime contract delivered and frontend adapted; live success remains blocked by `provider_unavailable`

## 1. Decision

TileSim Web now consumes the versioned read-only Agent contract published by the Bridge. The deterministic structured report still keeps `agent_analysis.status=not_generated`; an Agent result is a separate, run-bound, user-confirmed draft and never replaces report facts.

The next safe split is:

- **F9A, complete**: contract audit, evaluation specification, 36-case machine-readable catalog and deterministic contract tests.
- **F9B, frontend adapted**: generated DTO/client/runtime validators, capability discovery, canonical request digest, idempotency recovery, atomic citation validation, stale isolation and desktop unavailable presentation are implemented.
- **F9C/live acceptance, blocked**: the formal descriptor reports `provider.configured=false`, `availability=unavailable` and `provider_unavailable`; no mock success is used to close this boundary.

The active schema-set revision is `sha256:5c6653e0fd7c367300ce5eba3200575e81170911ec952557f948931c6cb545aa`. The frontend discovers `GET /api/agent/evidence-capabilities` and `POST /api/runs/{run_id}/agent/evidence-analyses` from `/api/manifest.evidence_agent`, then binds manifest, payload and response headers to that revision.

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
| `GET /api/agent/evidence-capabilities`            | `tilesim.bridge.evidence_agent_descriptor.v1` | capability, revisions, limits and policy                 |
| `POST /api/runs/{run_id}/agent/evidence-analyses` | `tilesim.bridge.evidence_agent_request.v1`    | create one immutable run-bound analysis                  |
| response/result                                   | `tilesim.bridge.evidence_agent_response.v1`   | completion, claims, citations, refusal and audit summary |
| citation definition                               | `tilesim.bridge.evidence_agent_citation.v1`   | exact evidence identity and subject binding              |

If asynchronous execution is used, OpenAPI must additionally define status polling or SSE, cancellation and terminal-state recovery. Idempotency must specify same-key/same-payload reuse and same-key/different-payload conflict.

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
- same-key/same-payload idempotency recovery without retaining question/result content;
- atomic citation validation, stale-result isolation and exact artifact navigation;
- formal `provider_unavailable` desktop presentation with no successful mock claim.

### Still blocked by provider availability

- a configured provider and formally available capability descriptor;
- a real terminal success/refusal response from the live endpoint;
- repeated live model evaluation, human entailment review and production latency/timeout observations;
- any claim that F9 is live-validated rather than contract-adapted.

## 10. Closure checklist

F9 may be marked validated only when:

- OpenAPI and closed JSON Schemas deliver every contract in section 4;
- manifest, descriptor/header and request/response revisions fail closed;
- all citations independently resolve against verified raw bytes and exact subjects;
- the complete evaluation gate in `F9_EVIDENCE_AGENT_EVALUATION_SPEC.md` passes;
- the draft remains separate from deterministic report facts and requires user confirmation;
- desktop Chinese/English, overflow, keyboard, axe and reduced-motion acceptance passes;
- live tests use a real contract surface and do not weaken evidence rules with mocks.
