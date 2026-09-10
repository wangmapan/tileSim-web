# F7 Fabric and design-space contract audit

**Audit date**: 2026-08-30  
**Run**: `run-20260830-220022-bf691f18`  
**Backend**: `D:\tileSim-week8`, branch `codex/week8-scale-system-acceptance`, revision
`4a536cc081abb20567c19ab9e94e6139f5008333`  
**Schema-set revision**: `sha256:eac6917790bf868f8fdb08e8bd45ce640d0e163c9f237abb0ce53747c1643faf`

## Closure update (2026-08-31)

The backend/Bridge contract gaps recorded below are now closed in the local contract set at
`sha256:cc9696791dc00fd533b92901abc1b838e832af3fa7f06092f1d75aaec6c39e7b`:

- `design-space` uses `tilesim.design_space_report.v1` and supplies manifest-bound candidate record EvidenceRefs,
  `pareto_front_id`, `objective_set_id`, membership, dominance, objective direction/value/unit/availability, and
  requested/resolved executed S6 knobs;
- `input-topology` uses `tilesim.s6_topology_input.v1`; metrics supplies `topology_domain_ref` with exact run,
  artifact, schema, subject ID, and JSON Pointer identity;
- candidate backend instances explicitly use `navigation_scope=artifact_record` and `bridge_run_id=null`;
- uint64 candidate counts, Fabric counters/times, and S6 knob values remain lossless and are normalized to `bigint`
  by the frontend adapter.

The frontend now validates unique stable IDs before accepting array-backed Pointers, fails duplicate/dangling/wrong
references closed, exposes candidate/objective/knob/topology evidence navigation, and preserves the same identity in
structured report v2. Legacy `design_space.report.v1alpha1` remains readable with a compatibility warning and does
not claim Pareto or topology closure.

The new contract is not deployed to the user service at `127.0.0.1:5173`; that service remains on schema revision
`sha256:eac6917790bf868f8fdb08e8bd45ce640d0e163c9f237abb0ce53747c1643faf`. Local fixture Playwright is the source of
frontend closure evidence until a separately authorized deployment occurs.

Remaining semantic boundaries are intentional: design space is `S6_only`; evidence is synthetic consistency rather
than held-out validation; Analytical/DES is not Cycle; S1/S3/S4/S5 unresolved variables are not defaulted; candidate
backend instances are not Bridge sub-runs.

## Original audit decision (superseded by the closure update)

F7 may continue with truthful read-only Fabric summaries already reported by metrics. Pareto presentation,
candidate-run navigation, executed-knob comparison, and topology-to-metrics domain navigation are blocked until the
backend supplies stable, manifest-bound identities. The frontend must not close these gaps with sorting, numeric
recomputation, string parsing, name matching, or array positions.

## Frontend slice status

The first non-blocked F7 slice is implemented locally:

- metrics artifact identity and supported-schema state are surfaced explicitly;
- domain, request contribution, and dominant phase records link to exact metrics Pointers only after unique stable-ID
  matching;
- duplicate IDs and unsupported artifact identity fail closed without a link;
- backend-reported dominant domain/kind are displayed without frontend re-ranking;
- reported ranking is separated from Pareto, candidate navigation, executed knobs, and topology join capability
  states;
- opaque candidate links remain visible as backend strings but are explicitly non-navigable;
- the same capability/degradation and evidence identity are preserved in structured report v2.

## Available facts

`metrics.system_summary` supplies supported, run-bound records for:

- `fabric_domain_utilization`;
- `request_fabric_contributions`;
- `phase_fabric_contributions`;
- queue, congestion, runtime, utilization, backpressure state/event count, and dominant domain/kind;
- exact request to dominant phase and collective IDs.

For the audited run, the report contains 1,164 Fabric records, two active domains, utilization `0.67`, backpressure
present, dominant domain `so0`, dominant kind `queue_delay`, and maximum reported delay `157.54 µs`. These are backend
report facts and may be displayed, indexed, filtered, and unit-formatted without frontend recomputation.

The topology input reports `generic-hierarchical-fabric`, four devices, two module bindings, and domains `su0` and
`so0`. The design-space report declares:

- schema `design_space.report.v1alpha1`;
- `execution_scope=S6_only`;
- lane `analytical_screening_with_selective_des_promotion`;
- source `built_in_synthetic`;
- provenance `synthetic_trace / uncalibrated / exploratory`;
- three candidates and one DES promotion;
- `runtime_scheduler`, `kv_policy`, `device_profile`, and `moe_placement` as `unresolved_not_executed`.

These declarations must remain separate from real-trace calibration or held-out validation.

## Contract gaps

1. The backend does not report Pareto front membership, front identity, or dominance relationships. Existing ranks
   are not a Pareto contract, and the frontend may not calculate or claim Pareto membership.
2. Candidate links such as `CandidateRun:...`, `MetricsReport:...`, and `ValidationReport:...` are opaque strings,
   not structured EvidenceRefs. They must not be parsed or used for navigation.
3. Analytical/DES candidate run instance IDs are not Bridge run IDs and have no independent artifact manifest.
   “Independent run instance” must not be presented as a navigable Bridge run.
4. Candidate records do not expose the complete executed S6 knob set with units, availability, and source Pointers.
5. `input-topology` is manifest-classified as non-report `not_applicable` without a supported schema identity. Matching
   topology `domain_id` text to metrics domains is not yet a versioned cross-artifact contract.
6. The design-space report has no top-level `run_id`; its current run binding exists only through the parent artifact
   manifest.

## Required backend shape

The exact versioned schema names remain a backend decision, but F7 requires equivalent semantics:

- candidate EvidenceRef:
  `{run_id, artifact_id, schema_identity, json_pointer, subject:{kind:"candidate",id:candidate_id}}`;
- Bridge-addressable candidate run/artifact manifests, or an explicit statement that candidate instances are
  non-navigable embedded records;
- `pareto_front_id`, `pareto_member`, and `dominated_by_candidate_ids` (or another explicit versioned dominance
  model);
- objective values with direction, unit, and availability supplied by the backend;
- structured executed S6 knobs, units, availability, and JSON Pointers;
- a versioned topology schema identity plus topology-domain to metrics-domain EvidenceRefs;
- top-level design-space `run_id` consistent with the artifact manifest.

## Forbidden frontend substitutes

- computing a Pareto front from displayed values;
- treating rank or array position as candidate identity;
- parsing opaque candidate/evidence link strings;
- matching topology and metrics domains by equal names alone;
- treating candidate run-instance IDs as Bridge run IDs;
- filling unresolved knobs from labels, defaults, another candidate, or UI state;
- upgrading synthetic/uncalibrated evidence to real-trace, held-out, or Cycle fidelity.

## Allowed frontend work before contract closure

- retain the existing backend-reported Fabric summary, domain table, queue/congestion/backpressure views, and
  request/phase drill-downs that already carry supported metrics artifact identity;
- change misleading copy so candidate run instances are not described as independent Bridge runs;
- add explicit `contract_gap` states for Pareto, candidate navigation, topology join, and missing executed knobs;
- add contract fixtures/tests for the future versioned response without enabling navigation until live identities
  exist.

The first four items above have now been implemented for the current contract. Future contract fixtures may be added
when the backend publishes a proposed versioned schema; the frontend will not invent that schema in advance.
