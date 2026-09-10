# F6B / Week 8 run-bound evidence contract gaps

## Current resolution (2026-08-30)

The Week 8 backend and Bridge delivery closed the F6B blockers recorded by the original audit below. The active
schema-set revision is
`sha256:eac6917790bf868f8fdb08e8bd45ce640d0e163c9f237abb0ce53747c1643faf`, with artifact manifest
`tilesim.bridge.artifact_manifest.v2` and supported versioned metrics, tail, execution-envelope, validation, and
week8-run-evidence artifacts.

The frontend now consumes backend-selected percentile subjects, stable `cause_id`/`attribution_id`/`stage_id`/
`check_id`, structured subjects and EvidenceRefs, manifest-bound SHA-256 identities, and the bounded Week 8
execution summary. It validates raw response bytes, keeps uint64 values lossless, and fails closed for duplicate IDs,
dangling/wrong references, schema/run/hash/byte mismatches, unsupported schemas, and legacy compatibility.

The original gap list and backend prompt remain below as provenance for the contract decision. They are historical,
not current instructions. Current F7 gaps are tracked separately in `docs/contracts/F7_CONTRACT_AUDIT.md`.

## Audit boundary

Audited backend: `D:\tileSim-week8`, branch `codex/week8-scale-system-acceptance`, revision
`4a536cc081abb20567c19ab9e94e6139f5008333`, source-state digest
`ea6a953dbd6561096d3b29839fd116944217c6df5c51d9cd26bab0a1df091906`.

Week 8 adds these internal S7 contracts:

- `tilesim.simulation.partitioned_des.v1`
- `tilesim.simulation.partitioned_des_state_summary.v1`
- `tilesim.simulation.partitioned_des_checkpoint_archive.v1`

They are currently C++ library/test contracts. `TileSimCLI run` does not emit them, the execution envelope does not
reference them, and the Bridge artifact allow-list does not expose them. The frontend therefore treats Week 8
partition/checkpoint evidence as `contract_gap`, not as missing runtime data.

## Stable joins available now

The first F6B frontend slice uses only these explicit backend fields:

| Hop                               | Stable join                                      | Evidence location after unique-ID match                                                  |
| --------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| request → S1                      | `request_id`                                     | runtime input `/requests/{matched-index}` and metrics `/request_metrics/{matched-index}` |
| request → S6 request contribution | `request_id`                                     | metrics `/system_summary/request_fabric_contributions/{matched-index}`                   |
| S6 request → dominant phase       | `dominant_phase_id` → `phase_id`                 | metrics `/system_summary/phase_fabric_contributions/{matched-index}`                     |
| dominant phase → S3               | `memory_event_id`                                | matched phase record                                                                     |
| dominant phase → S4               | `device_task_id`                                 | matched phase record                                                                     |
| dominant phase → S5               | `collective_id`, or explicit `not_s5_collective` | matched phase record                                                                     |
| tail → request                    | `TailCauseChainReport.explained_entity.id`       | tail `/explained_entity`                                                                 |

Array positions above are calculated only after a unique stable-ID match. They are JSON Pointers, never join keys.
The Bridge artifact manifest supplies the run binding, schema-set revision, schema identity, and artifact SHA-256.

## Historical contract gaps that blocked complete F6B

1. Metrics, validation, tail, and execution-envelope reports need supported versioned schema identities. Legacy
   unversioned compatibility reports remain readable but cannot be presented as a closed F6B contract.
2. Percentile summaries do not identify their member/selected requests. The frontend cannot infer which request is
   P99 from latency equality, sorting, nearest value, or array position.
3. Tail cause-chain and attribution-ranking entries lack stable entry IDs and structured evidence references.
   `cause_code`, `component_code`, prose, and opaque `evidence_link` strings are not cross-artifact join keys.
4. S7 stages have `stage_id`, but no structured request/cause subjects or evidence references.
5. S8 checks have `check_id`, but no structured request/cause subjects or evidence references.
6. Week 8 partition state, differential result, stream-record summary, and checkpoint metadata are not run artifacts.
   There is no execution-envelope reference that proves which S7 execution produced them.
7. Bridge cannot register or verify Week 8 artifacts until the CLI emits fixed filenames/schema identities and the
   artifacts are added to its allow-list and artifact manifest.

## Minimum backend contract shape

The exact names may follow backend conventions, but the semantics must be explicit and versioned.

### Shared evidence reference

Every cross-artifact hop should carry a structured reference equivalent to:

```json
{
  "run_id": "run-...",
  "artifact_id": "metrics",
  "schema_identity": "tilesim....v1",
  "json_pointer": "/system_summary/phase_fabric_contributions/0",
  "subject": { "kind": "fabric_phase", "id": "phase-0" }
}
```

`artifact_id + json_pointer + subject.kind + subject.id` must be stable and machine validated. The Bridge artifact
manifest binds the target to its SHA-256; do not embed an artifact's own SHA-256 inside itself because that creates a
self-hash cycle. Cross-artifact SHA-256 may be emitted when already known, but the manifest remains authoritative.

### Metrics / P99

- Add a versioned metrics schema identity.
- For every reported percentile intended for request navigation, provide structured subject references, including
  metric kind, percentile, request ID, and an explicit backend selection/tie rule.
- If no single request represents a percentile, say so explicitly and provide the backend-selected member set or
  `not_applicable`; do not force one request.

### Tail / S9

- Add stable `cause_id` to every cause-chain entry and stable `attribution_id` to every ranking entry.
- Add `subject_refs` and `evidence_refs` as structured arrays.
- References to S3/S4/S5/S6 must use contract IDs such as `memory_event_id`, `device_task_id`, `collective_id`,
  `phase_id`, and `request_id`; S3/S4/S5 remain peers.
- Preserve `explained_entity.kind` and `explained_entity.id`; do not silently upgrade a tail example to P99.

### Execution envelope / S7

- Add a versioned execution-envelope schema identity.
- Keep stable `stage_id`; add structured `subject_refs` for request/cause IDs and `evidence_refs` for source records.
- Reference a run-bound Week 8 summary artifact from the envelope when partitioned DES actually executed.
- Report requested fidelity separately from resolved fidelity and execution mode. Analytical or DES must never be
  labeled Cycle.

### Validation / S8

- Add a versioned validation schema identity.
- Keep stable `check_id`; add structured `subject_refs` and `evidence_refs`.
- Keep `real_trace`, `synthetic_trace`, and `compatibility_harness_trace` claims distinct. Synthetic consistency is
  not held-out validation.

### Week 8 run artifacts

Expose a bounded, read-only, versioned artifact produced by the normal CLI run path. At minimum it should preserve:

- execution mode and fallback reason;
- `PartitionedDesStateSummary` fields, provenance, validation lane, and claim scope;
- differential `compared/matched`, digests, and mismatch code;
- stream-record count/truncation metadata and, if exposed, records with `partition_id`, window bounds, event count,
  and digest;
- checkpoint metadata: archive schema, `archive_digest`, `partition_configuration_digest`, checkpoint logical time,
  counts, and provenance. A full checkpoint payload need not be rendered by the frontend.

Register each emitted artifact in the Bridge fixed allow-list with filename, schema identity, media type, byte count,
and SHA-256. Update the schema-set revision. Preserve all 64-bit ps/bytes values losslessly across CLI JSON, Bridge
validation, generated TypeScript, parsing, and rendering.

## Forbidden frontend joins

- timestamp proximity, overlapping time windows, or nearest latency;
- array index or rank as entity identity;
- equal numeric values;
- similar names, titles, `cause_code`, `component_code`, or prose matching;
- parsing opaque `evidence_link` text;
- treating `0`, missing, expected absence, not covered, unsupported schema, and not applicable as equivalent;
- upgrading synthetic or compatibility evidence into real-trace/held-out evidence.

## Historical copy/paste prompt for the backend Agent

```text
请在 D:\tileSim-week8 中补齐 F6B 的 run-bound S7/S8/S9 契约。只修改后端/CLI/Bridge 范围，不修改
D:\tileSim-web。先阅读仓库 AGENTS.md，并保护现有未提交改动。

目标：让前端可从后端明确指定的 P99 request 或 tail explained request，沿稳定结构化引用定位到 S1、
并列 S3/S4/S5、S6、S7 execution envelope、S8 validation 和 S9 attribution。不得使用时间接近、数组
下标、名称相似、文本匹配或解析 opaque evidence_link 建立关联。

请实现并验证：
1. 为 metrics、validation、tail、execution-envelope 提供受支持的版本化 schema identity。
2. 在 metrics percentile 输出中提供后端确定的结构化 request subject refs，并定义 tie/no-single-request 语义；
   不要求前端从数值排序推断 P99。
3. 为 tail cause-chain/ranking 增加稳定 cause_id/attribution_id、subject_refs、evidence_refs；资源引用使用
   request_id、phase_id、memory_event_id、device_task_id、collective_id，保持 S3/S4/S5 并列。
4. 为 S7 stage 和 S8 check 增加 request/cause subject_refs 与结构化 evidence_refs，保留稳定 stage_id/check_id。
5. 将 Week 8 partitioned DES 接入正常 TileSimCLI run 输出：至少暴露 run-bound state summary、execution mode、
   fallback、differential、stream truncation/count，以及 checkpoint metadata；在 execution envelope 中结构化引用。
   不必把完整 checkpoint 事件负载作为网页展示数据。
6. 在 Bridge 固定 allow-list 和 artifact manifest 注册新增 artifact，校验 schema identity、schema_set_revision、
   bytes 和 SHA-256。artifact 自身不得嵌入自身 SHA 造成 self-hash cycle；由 manifest 绑定 SHA。
7. 全链路无损保留 uint64 ps/bytes；区分 0、missing、expected absence、not covered、unsupported schema、
   not applicable。requested fidelity 与 resolved fidelity 分开；Analytical/DES 不得标为 Cycle；real/synthetic/
   compatibility provenance 不得互相升级。
8. 增加 schema、CLI、Bridge、artifact manifest、重复 ID/悬空引用/错误 SHA/unsupported schema 的失败关闭测试，
   并报告具体产物文件名、schema identity、JSON Pointer 和测试结果。

前端当前可消费的字段与完整缺口见 D:\tileSim-web\docs\F6B_WEEK8_CONTRACT_GAPS.md。若需要改变已有
report schema，请版本化升级，不要静默改变 legacy 字段语义。
```

## Frontend degradation behavior

- Exact unique ID + manifest SHA: `available` or `partial`.
- Duplicate stable ID: `ambiguous_reference`; no link is chosen.
- Report exists but only run-level association is known: `run_scope_only`.
- A contract declares the hop irrelevant: `not_applicable`.
- Required identity is absent: `missing` or `contract_gap`, according to whether the schema promises it.
- Artifact manifest/SHA is absent: `artifact_identity_missing`.
- Legacy report identity: display with a compatibility warning; never claim complete F6B closure.
