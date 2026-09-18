/**
 * English catalog for WP-2D-01 (backend simulation-flow display coverage).
 * Keys here must stay unique across every catalog; see
 * `tests/unit/i18n-model-coverage.test.js`.
 */
export const reportCoverageEnglishCatalog: Readonly<Record<string, string>> = {
  报告已提供: "Reported",
  是: "Yes",
  否: "No",
  报告字段覆盖: "Reported field coverage",
  "{fields} 个字段 · {records} 条记录": "{fields} fields · {records} records",
  "{title} 分页": "{title} pagination",

  "（报告为空字符串）": "(empty string in report)",
  "（未写出）": "(not written)",
  "（空列表）": "(empty list)",
  "报告提供了该列表，但条目数为 0。": "The report provided this list, but it has 0 entries.",
  后端未写出该字段: "The backend did not write this field",
  "后端未提供逐窗口 stream_records。": "The backend provided no per-window stream_records.",

  /* Availability copy -------------------------------------------------- */
  "后端报告提供了该字段；前端只做显示、来源标注与显示级换算。":
    "The backend report provides this field; the front end only displays it, traces its source, and performs display-level conversions.",
  "后端未写出该字段，且该环节按请求边界属于预期缺省，不是采集失败。":
    "The backend did not write this field, and this stage is an expected absence for the requested boundary — not a collection failure.",
  "请求的仿真范围不覆盖该字段，报告不会给出对应数值。":
    "The requested simulation range does not cover this field, so the report provides no value for it.",
  "报告未提供该字段；前端不会推算、补造或用其它总量代替。":
    "The report does not provide this field; the front end will not infer it, fabricate it, or substitute another total.",
  "报告版本尚未适配，该字段未解析；原始 JSON 仍完整保留。":
    "This report version is not adapted yet, so the field is unparsed; the raw JSON is still preserved in full.",

  /* C0-1 run coverage -------------------------------------------------- */
  运行入口与执行路径: "Run entry point and execution path",
  "summary 的入口与路径字段已随 run 报告到达前端；这里只渲染，不推断执行方式。":
    "The entry-point and path fields of summary already reach the front end with the run report; this page renders them without inferring how the run executed.",
  "后端结论：cause 与 next_action": "Backend verdict: cause and next_action",
  后端结论: "Backend verdict",
  "cause 与 next_action": "cause and next_action",
  "这两个字段由后端原样给出，前端不改写、不摘编、不降级为提示文案。":
    "Both fields are given verbatim by the backend; the front end never rewrites, condenses, or downgrades them into a generic tip.",
  "next_action 是后端给出的权威下一步操作建议；这里逐字显示，不改写、不摘编、不降级为提示文案。":
    "next_action is the backend's authoritative next-step guidance; it is shown verbatim, never rewritten, condensed, or downgraded into a generic tip.",
  缺失产物与缺失原因: "Absent artifacts and why they are absent",
  "partial_artifacts（JSON 键名 artifacts）": "partial_artifacts (JSON key: artifacts)",
  "后端为本次 run 请求的每个产物写出 state 与 absence_reason；缺失原因原样展示，不由前端推断。未被后端写出的 payload_json 按缺失标记，不视为损坏报告。":
    "The backend writes state and absence_reason for every artifact requested by this run; absence reasons are shown as-is and never inferred by the front end. A payload_json the backend did not write is marked missing, not treated as a corrupt report.",
  "后端为本次 run 请求的每个产物写出 state 与 absence_reason；这里原样展示，不由前端补造缺失原因。":
    "The backend writes state and absence_reason for every artifact requested by this run; they are shown as-is and the front end never invents an absence reason.",
  "能力登记表（analytical / DES / Cycle）": "Capability registry (analytical / DES / Cycle)",
  "capability_registry.entries": "capability_registry.entries",
  "登记每个子系统的三种精度能力，以及该子系统的 DES 能力是否被 host 契约强制要求。":
    "Registers each subsystem's capability at the three fidelity tiers, and whether that subsystem's DES capability is required by the host contract.",
  "能力登记是后端的能力声明，不表示该精度已在本次运行中被采集；des_required_for_host_contract 为否不能读成「已满足」。":
    'The capability registry is a backend capability declaration; it does not mean that tier was captured in this run. des_required_for_host_contract = false must not be read as "satisfied".',
  "DES 契约聚合": "DES contract aggregates",
  "聚合计数与缺口来自 multi_granularity_profile；前端不做归因、不重算比例。":
    "The aggregate counts and gaps come from multi_granularity_profile; the front end does not attribute or recompute ratios.",
  "DES 契约缺口": "DES contract gaps",
  des_contract_gaps: "des_contract_gaps",
  逐子系统实现状态: "Per-subsystem implementation status",
  "multi_granularity_profile.entries": "multi_granularity_profile.entries",
  "逐子系统的实现状态与缺口原样保留；effective_tier 是后端解析结果，不由前端推断。":
    "Per-subsystem implementation status and gaps are preserved as-is; effective_tier is the backend's resolution result, not inferred by the front end.",
  瓶颈报告的支撑产物: "Artifacts supporting the bottleneck report",
  "bottleneck_report.supporting_artifacts": "bottleneck_report.supporting_artifacts",
  "瓶颈结论所引用的 artifact_id 列表；列出不代表这些 artifact 已被再次读取或校验。":
    "The artifact_id list referenced by the bottleneck conclusion; listing them does not mean they were re-read or re-validated.",
  "解析后的精度画像 · 聚合标志": "Resolved fidelity profile · aggregate flags",
  "has_* 是后端聚合事实；false 表示后端没有发现该类偏移，不表示前端已完成校验。":
    "The has_* values are backend aggregate facts; false means the backend found no such deviation, not that the front end completed a validation.",
  "解析后的精度画像 · 逐环节状态": "Resolved fidelity profile · per-stage state",
  "resolved_fidelity_profile.entries": "resolved_fidelity_profile.entries",
  "requested 与 actual fidelity 分开显示；downgraded、fallback、not_covered、expected_absence 各自独立，不合并成一种状态。":
    "Requested and actual fidelity are shown separately; downgraded, fallback, not_covered, and expected_absence stay independent and are never collapsed into one state.",

  /* C0-2 metrics coverage --------------------------------------------- */
  "分布摘要（sample_count / p50 / p95 / p99 / max）": "Distribution summaries (sample_count / p50 / p95 / p99 / max)",
  "三个分布摘要各自独立展示 p50、p95、p99 与 max；不把某一分位数当作整体结论。":
    "Each of the three distribution summaries shows p50, p95, p99 and max independently; no single percentile is presented as the overall conclusion.",
  "观测窗口为 0 表示该边界没有产生可观测样本；后端会另行写出 boundary_notes。":
    "An observation window of 0 means this boundary produced no observable sample; the backend writes boundary_notes separately.",
  后端边界说明: "Backend boundary notes",
  boundary_notes: "boundary_notes",
  "后端明确写下的边界说明（例如「观测窗口为 0，吞吐按 0 报告」）；原样显示，不改写。":
    'Boundary statements the backend wrote explicitly (for example "the observation window is 0 and throughput is reported as 0"); shown as-is, never rewritten.',
  资源边界证据: "Resource boundary evidence",
  "has_evidence 为 false 时下列明细按缺失标记；前端不会用请求数或总量推算。":
    "When has_evidence is false the details below are marked missing; the front end never infers them from request counts or totals.",
  "PD 分离（prefill / decode）": "PD disaggregation (prefill / decode)",
  "PD 分离字段来自 system_summary.pd_disaggregation；延迟与等待时间按后端字段分开显示，不相加解释。":
    "The disaggregation fields come from system_summary.pd_disaggregation; latency and wait times stay separate per backend field and are never summed into one explanation.",
  请求边界与能力计数: "Request boundary and capability counts",
  "计数与版本号来自后端；unsupported_reason 为空字符串表示后端未给出原因，不等于缺失。":
    "The counts and version strings come from the backend; an empty unsupported_reason means the backend gave no reason, which is not the same as missing.",
  "精度解析聚合与 DES 契约": "Fidelity resolution aggregates and DES contract",
  "四个 has_* 与四个计数分别对应 downgrade / fallback / not_covered / expected_absence，互不合并。":
    "The four has_* flags and the four counts map to downgrade / fallback / not_covered / expected_absence respectively and are never merged.",
  "指标侧 DES 契约缺口": "DES contract gaps (metrics side)",
  "des_contract.des_contract_gaps": "des_contract.des_contract_gaps",
  指标侧逐环节精度解析: "Per-stage fidelity resolution (metrics side)",
  resolution_entries: "resolution_entries",
  逐请求时间与样本标志: "Per-request timing and sample flags",
  request_metrics: "request_metrics",
  "时间戳与 ps 值走无损 JSON 路径，显示换算保留原始整数；has_*_sample 为 false 表示后端没有把该请求纳入对应分位数样本。":
    "Timestamps and ps values travel the lossless JSON path and the raw integer is preserved next to the display conversion; has_*_sample = false means the backend did not include that request in the corresponding percentile sample.",
  "分位数主体（P50 / P95 / P99）": "Percentile subjects (P50 / P95 / P99)",
  percentile_subjects: "percentile_subjects",
  "P50、P95、P99 三种分位数条目全部保留；selection_rule 与 selected_request_id 由后端给出，前端不自行挑选代表请求。":
    "P50, P95 and P99 subject entries are all retained; selection_rule and selected_request_id come from the backend and the front end never picks a representative request on its own.",
  网络时间线与占用: "Fabric timeline and utilization",
  "has_fabric_timeline 为 false 表示后端没有写出网络时间线；该布尔事实不得显示为「已采集」。":
    'has_fabric_timeline = false means the backend wrote no fabric timeline; this boolean fact must never be displayed as "captured".',

  /* C0-3 validation coverage ------------------------------------------- */
  验证范围与基线: "Validation scope and baseline",
  "validation_scope、validation_lane 与 evidence_tier 由后端写出；前端不把 evidence_tier 升级为更强结论。":
    "validation_scope, validation_lane and evidence_tier are written by the backend; the front end never upgrades evidence_tier into a stronger claim.",
  "Trace 来源明细": "Trace provenance detail",
  "source_id / generation_path / capture_or_generation_time / upstream_tooling 用于追溯数据来源；不得据此推断 provenance 等级。":
    "source_id / generation_path / capture_or_generation_time / upstream_tooling trace where the data came from; they must not be used to infer a provenance tier.",
  误差预算矩阵: "Error budget matrix",
  error_budget: "error_budget",
  "这是验证报告自身的误差预算条目；与 S8 校准产物中的 relative_error_budget 不是同一字段，两者不合并显示。":
    "These are the validation report's own error-budget entries; they are not the same field as relative_error_budget in S8 calibration output, and the two are never merged.",
  基准清单: "Benchmark manifests",
  校准输入: "Calibration inputs",
  "验证侧 DES 契约": "DES contract (validation side)",
  "契约状态与满足计数来自验证报告；缺口列表在下方单独列出，不并入计数。":
    "The contract state and satisfaction counts come from the validation report; the gap list is shown separately below and is never folded into the counts.",
  "验证侧 DES 契约缺口": "DES contract gaps (validation side)",
  精度解析聚合: "Fidelity resolution aggregates",
  验证检查的结构化引用: "Structured references of validation checks",
  checks: "checks",
  "subject_refs / evidence_refs 是后端给出的可导航引用；空列表表示该检查没有附引用。":
    "subject_refs / evidence_refs are navigable references from the backend; an empty list means that check carries no reference.",
  精度解析条目的结构化引用: "Structured references of fidelity resolution entries",
  "后端未给条目写出引用时按缺失标记，不用其它字段代替。":
    "When the backend wrote no references for an entry it is marked missing rather than substituted with another field.",
  "后端未提供 resolution_entries。": "The backend provided no resolution_entries.",

  /* C0-4 tail coverage -------------------------------------------------- */
  症状与观测窗口: "Symptom and observation window",
  "symptom 是后端给出的症状陈述；explained_entity_kind 与 id 分开显示，不由前端推断归因对象。":
    "symptom is the backend's symptom statement; explained_entity_kind and id are shown separately and the front end never infers the attributed entity.",
  贡献因子: "Contributing factors",
  contributing_factors: "contributing_factors",
  "贡献因子是与 attribution_ranking 不同的一层证据：前者是报告列出的候选因子，后者是带份额的排序结果。两者分开展示，不合并、不互相换算。":
    "Contributing factors are a different layer of evidence from attribution_ranking: the former lists candidate factors, the latter is a ranked result with shares. They are displayed separately and never merged or converted into each other.",
  "贡献因子与下方归因排序是两层不同的证据，前端不做合并或换算。":
    "Contributing factors and the attribution ranking below are two different layers of evidence; the front end neither merges them nor converts between them.",
  证据链接: "Evidence links",
  "三类链接分别是验证、指标与资源证据的引用；列出不代表这些证据已被前端读取或复核。":
    "The three link lists reference validation, metric and resource evidence respectively; listing them does not mean the front end read or reviewed that evidence.",
  未解决缺口: "Unresolved gaps",

  /* C0-5 execution envelope ------------------------------------------- */
  信封身份与时间边界: "Envelope identity and time boundaries",
  "信封身份字段已随 execution-envelope artifact 到达前端；这里只渲染，不据此推断运行期事件是否被采集。":
    "The envelope identity fields already reach the front end with the execution-envelope artifact; they are only rendered here and never used to infer whether runtime events were captured.",
  采集布尔事实: "Capture boolean facts",
  "has_runtime_event_trace 与 has_tail_cause_chain_report 是布尔事实：为 false 时如实显示为「否」，不使用颜色或文案暗示已采集。":
    'has_runtime_event_trace and has_tail_cause_chain_report are boolean facts: false is shown truthfully as "No", with no colour or wording implying they were captured.',
  信封说明: "Envelope notes",
  "后端写出的信封级说明，原样显示。": "Envelope-level notes written by the backend, shown as-is.",
  阶段的引用: "Stage references",
  stages: "stages",
  "stage 的 subject_refs / evidence_refs 是后端给出的可导航引用；空列表表示该阶段没有附引用。":
    "A stage's subject_refs / evidence_refs are navigable references from the backend; an empty list means that stage carries no reference.",

  /* C0-6 run-bound DES evidence --------------------------------------- */
  逐窗口提交明细: "Per-window commit detail",
  "{count} 条窗口记录": "{count} window records",
  "后端标记 stream_records_truncated = true：列表已被后端截断，前端不做静默截断。":
    "The backend marked stream_records_truncated = true: the list was truncated by the backend, and the front end does not truncate it silently.",
  "后端标记 stream_records_truncated = false：列表未被后端截断。":
    "The backend marked stream_records_truncated = false: the list was not truncated by the backend.",
  "后端未写出 stream_records_truncated。": "The backend did not write stream_records_truncated.",
  窗口记录分页: "Window record pagination",
  "stream.records 证据": "stream.records evidence",

  /* Panels -------------------------------------------------------------- */
  "主运行报告 · 完整字段覆盖": "Run report · full field coverage",
  "补齐 run-result.json 中此前未渲染的字段；全部来自当前 run bundle，不新增任何数据请求。":
    "Completes the fields of run-result.json that were not rendered before; everything comes from the current run bundle and no new data request is added.",
  "指标报告 · 完整字段覆盖": "Metrics report · full field coverage",
  "补齐 metrics.json 中此前未渲染的字段；ps 值走无损路径，显示换算保留原始整数。":
    "Completes the fields of metrics.json that were not rendered before; ps values travel the lossless path and the raw integer is kept next to the display conversion.",
  "验证报告 · 完整字段覆盖": "Validation report · full field coverage",
  "补齐 validation.json 中此前未渲染的字段；验证报告的误差预算与 S8 校准预算分开显示。":
    "Completes the fields of validation.json that were not rendered before; the validation report's error budget and the S8 calibration budget stay separate.",
  "慢请求归因报告 · 完整字段覆盖": "Tail cause-chain report · full field coverage",
  "补齐 tail-cause-chain.json 中此前未渲染的字段；贡献因子与归因排序是两层证据，分开展示。":
    "Completes the fields of tail-cause-chain.json that were not rendered before; contributing factors and the attribution ranking are two layers of evidence and stay separate.",
  "执行信封 · 完整字段覆盖": "Execution envelope · full field coverage",
  "补齐 execution-envelope.json 中此前未渲染的字段；布尔采集事实如实显示，不用颜色暗示已采集。":
    "Completes the fields of execution-envelope.json that were not rendered before; capture boolean facts are shown truthfully, with no colour implying capture.",
};
