import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageField, CoverageGroup } from "../types";
import {
  buildList,
  bool,
  cell,
  count,
  field,
  group,
  jsonText,
  numberText,
  record,
  stringList,
  type Scope,
} from "./shared";

export interface RunVerdict {
  cause: CoverageField;
  nextAction: CoverageField;
}

/**
 * `cause` and `next_action` sit at the same level of the run report and are the
 * backend's own verdict. They are exposed separately from the (collapsible)
 * coverage panel so `next_action` is never demoted to an ordinary hint.
 */
export function buildRunVerdict(bundle: ReportBundle): RunVerdict | null {
  const run = bundle.run;
  if (!run) return null;
  const scope: Scope = { bundle, kind: "run", subsystems: [] };
  return {
    cause: field(scope, "cause", run.cause, "/run/cause"),
    nextAction: field(scope, "next_action", run.next_action, "/run/next_action"),
  };
}

const fidelityEntryColumns = [
  { key: "subsystem", label: "subsystem" },
  { key: "requested_fidelity", label: "requested_fidelity" },
  { key: "actual_fidelity", label: "actual_fidelity" },
  { key: "resolution", label: "resolution" },
  { key: "state", label: "state" },
  { key: "downgraded", label: "downgraded" },
  { key: "fallback", label: "fallback" },
  { key: "not_covered", label: "not_covered" },
  { key: "expected_absence", label: "expected_absence" },
  { key: "claim_scope_impact", label: "claim_scope_impact" },
  { key: "detail", label: "detail" },
];

function fidelityEntryRecord(scope: Scope, item: unknown, index: number) {
  const entry = record(item);
  return {
    key: `${String(entry.subsystem ?? index)}`,
    cells: [
      cell(scope, "subsystem", entry.subsystem),
      cell(scope, "requested_fidelity", entry.requested_fidelity),
      cell(scope, "actual_fidelity", entry.actual_fidelity),
      cell(scope, "resolution", entry.resolution),
      cell(scope, "state", entry.state),
      cell(scope, "downgraded", entry.downgraded, bool),
      cell(scope, "fallback", entry.fallback, bool),
      cell(scope, "not_covered", entry.not_covered, bool),
      cell(scope, "expected_absence", entry.expected_absence, bool),
      cell(scope, "claim_scope_impact", entry.claim_scope_impact),
      cell(scope, "detail", entry.detail),
    ],
  };
}

export function buildRunCoverage(bundle: ReportBundle): CoverageGroup[] {
  const run = bundle.run;
  if (!run) return [];
  const scope: Scope = { bundle, kind: "run", subsystems: [] };
  const profile = run.resolved_fidelity_profile;
  const granularity = run.multi_granularity_profile;
  const registry = granularity?.capability_registry;
  const bottleneck = run.bottleneck_report;

  const routingFields = [
    field(
      scope,
      "summary.preferred_entrypoint",
      run.summary?.preferred_entrypoint,
      "/run/summary/preferred_entrypoint",
    ),
    field(scope, "summary.host_path", run.summary?.host_path, "/run/summary/host_path"),
    field(scope, "summary.execution_path", run.summary?.execution_path, "/run/summary/execution_path"),
    field(
      scope,
      "summary.has_tail_attribution",
      run.summary?.has_tail_attribution,
      "/run/summary/has_tail_attribution",
      bool,
      {
        fact: true,
      },
    ),
    field(scope, "run.completeness", run.completeness, "/run/completeness", numberText),
    field(scope, "run.error_code", run.error_code, "/run/error_code"),
  ];

  const aggregateFields = [
    field(
      scope,
      "multi_granularity_profile.requested_tier",
      granularity?.requested_tier,
      "/run/multi_granularity_profile/requested_tier",
    ),
    field(
      scope,
      "requested_tier_state",
      granularity?.requested_tier_state,
      "/run/multi_granularity_profile/requested_tier_state",
    ),
    field(
      scope,
      "unsupported_reason",
      granularity?.unsupported_reason,
      "/run/multi_granularity_profile/unsupported_reason",
    ),
    field(
      scope,
      "des_completion_state",
      granularity?.des_completion_state,
      "/run/multi_granularity_profile/des_completion_state",
    ),
    field(
      scope,
      "des_contract_state",
      granularity?.des_contract_state,
      "/run/multi_granularity_profile/des_contract_state",
    ),
    field(
      scope,
      "des_required_subsystem_count",
      granularity?.des_required_subsystem_count,
      "/run/multi_granularity_profile/des_required_subsystem_count",
      count,
    ),
    field(
      scope,
      "des_satisfied_subsystem_count",
      granularity?.des_satisfied_subsystem_count,
      "/run/multi_granularity_profile/des_satisfied_subsystem_count",
      count,
    ),
    field(scope, "has_des_gap", granularity?.has_des_gap, "/run/multi_granularity_profile/has_des_gap", bool, {
      fact: true,
    }),
    field(scope, "has_cycle_gap", granularity?.has_cycle_gap, "/run/multi_granularity_profile/has_cycle_gap", bool, {
      fact: true,
    }),
    field(scope, "multi_granularity_profile.summary", granularity?.summary, "/run/multi_granularity_profile/summary"),
  ];

  const fidelityFlagFields = [
    field(
      scope,
      "resolved_fidelity_profile.range_label",
      profile?.range_label,
      "/run/resolved_fidelity_profile/range_label",
    ),
    field(scope, "has_downgrades", profile?.has_downgrades, "/run/resolved_fidelity_profile/has_downgrades", bool, {
      fact: true,
    }),
    field(scope, "has_fallbacks", profile?.has_fallbacks, "/run/resolved_fidelity_profile/has_fallbacks", bool, {
      fact: true,
    }),
    field(scope, "has_not_covered", profile?.has_not_covered, "/run/resolved_fidelity_profile/has_not_covered", bool, {
      fact: true,
    }),
    field(
      scope,
      "has_expected_absence",
      profile?.has_expected_absence,
      "/run/resolved_fidelity_profile/has_expected_absence",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "resolved_fidelity_profile.claim_scope_summary",
      profile?.claim_scope_summary,
      "/run/resolved_fidelity_profile/claim_scope_summary",
    ),
  ];

  const capabilityList = buildList(
    scope,
    "capability_registry.entries",
    "capability_registry.entries",
    registry?.entries,
    "run:/multi_granularity_profile/capability_registry/entries",
    [
      { key: "subsystem", label: "subsystem" },
      { key: "subsystem_name", label: "subsystem_name" },
      { key: "analytical_capability", label: "analytical_capability" },
      { key: "des_capability", label: "des_capability" },
      { key: "cycle_capability", label: "cycle_capability" },
      { key: "des_contract_role", label: "des_contract_role" },
      { key: "des_required_for_host_contract", label: "des_required_for_host_contract" },
    ],
    (item, index) => {
      const entry = record(item);
      return {
        key: `${String(entry.subsystem ?? index)}-${String(entry.des_contract_role ?? "")}`,
        cells: [
          cell(scope, "subsystem", entry.subsystem),
          cell(scope, "subsystem_name", entry.subsystem_name),
          cell(scope, "analytical_capability", entry.analytical_capability),
          cell(scope, "des_capability", entry.des_capability),
          cell(scope, "cycle_capability", entry.cycle_capability),
          cell(scope, "des_contract_role", entry.des_contract_role),
          cell(scope, "des_required_for_host_contract", entry.des_required_for_host_contract, bool),
        ],
      };
    },
    { description: "登记每个子系统的三种精度能力，以及该子系统的 DES 能力是否被 host 契约强制要求。" },
  );

  const implementationList = buildList(
    scope,
    "multi_granularity_profile.entries",
    "multi_granularity_profile.entries",
    granularity?.entries,
    "run:/multi_granularity_profile/entries",
    [
      { key: "subsystem", label: "subsystem" },
      { key: "subsystem_name", label: "subsystem_name" },
      { key: "analytical_status", label: "analytical_status" },
      { key: "des_status", label: "des_status" },
      { key: "cycle_status", label: "cycle_status" },
      { key: "effective_tier", label: "effective_tier" },
      { key: "evidence", label: "evidence" },
      { key: "gap", label: "gap" },
    ],
    (item, index) => {
      const entry = record(item);
      return {
        key: `${String(entry.subsystem ?? index)}`,
        cells: [
          cell(scope, "subsystem", entry.subsystem),
          cell(scope, "subsystem_name", entry.subsystem_name),
          cell(scope, "analytical_status", entry.analytical_status),
          cell(scope, "des_status", entry.des_status),
          cell(scope, "cycle_status", entry.cycle_status),
          cell(scope, "effective_tier", entry.effective_tier),
          cell(scope, "evidence", entry.evidence),
          cell(scope, "gap", entry.gap),
        ],
      };
    },
    { description: "逐子系统的实现状态与缺口原样保留；effective_tier 是后端解析结果，不由前端推断。" },
  );

  return [
    group(
      "run-summary-routing",
      "运行入口与执行路径",
      routingFields,
      [],
      "summary 的入口与路径字段已随 run 报告到达前端；这里只渲染，不推断执行方式。",
    ),
    group(
      "run-next-action",
      "后端结论：cause 与 next_action",
      [
        field(scope, "run.status", run.status, "/run/status"),
        field(scope, "run.cause", run.cause, "/run/cause"),
        field(scope, "run.next_action", run.next_action, "/run/next_action"),
      ],
      [],
      "next_action 是后端给出的权威下一步操作建议；这里逐字显示，不改写、不摘编、不降级为提示文案。",
    ),
    group(
      "partial-artifacts",
      "缺失产物与缺失原因",
      [],
      [
        buildList(
          scope,
          "run.artifacts",
          "partial_artifacts（JSON 键名 artifacts）",
          run.artifacts,
          "run:/artifacts",
          [
            { key: "artifact_id", label: "artifact_id", mono: true },
            { key: "state", label: "state" },
            { key: "evidence_requirement", label: "evidence_requirement" },
            { key: "absence_reason", label: "absence_reason" },
            { key: "detail", label: "detail" },
            { key: "payload_json", label: "payload_json", mono: true },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.artifact_id ?? index)}`,
              cells: [
                cell(scope, "artifact_id", entry.artifact_id, undefined, { mono: true }),
                cell(scope, "state", entry.state),
                cell(scope, "evidence_requirement", entry.evidence_requirement),
                cell(scope, "absence_reason", entry.absence_reason),
                cell(scope, "detail", entry.detail),
                cell(scope, "payload_json", entry.payload_json, jsonText, { mono: true }),
              ],
            };
          },
          {
            description:
              "后端为本次 run 请求的每个产物写出 state 与 absence_reason；缺失原因原样展示，不由前端推断。未被后端写出的 payload_json 按缺失标记，不视为损坏报告。",
          },
        ),
      ],
      "后端为本次 run 请求的每个产物写出 state 与 absence_reason；这里原样展示，不由前端补造缺失原因。",
    ),
    group(
      "capability-registry",
      "能力登记表（analytical / DES / Cycle）",
      [
        field(
          scope,
          "capability_registry.registry_version",
          registry?.registry_version,
          "/run/multi_granularity_profile/capability_registry/registry_version",
        ),
      ],
      [capabilityList],
      "能力登记是后端的能力声明，不表示该精度已在本次运行中被采集；des_required_for_host_contract 为否不能读成「已满足」。",
    ),
    group(
      "des-aggregates",
      "DES 契约聚合",
      aggregateFields,
      [],
      "聚合计数与缺口来自 multi_granularity_profile；前端不做归因、不重算比例。",
    ),
    group(
      "des-contract-gaps",
      "DES 契约缺口",
      [],
      [
        stringList(
          scope,
          "des_contract_gaps",
          granularity?.des_contract_gaps,
          "run:/multi_granularity_profile/des_contract_gaps",
        ),
      ],
    ),
    group("multi-granularity-entries", "逐子系统实现状态", [], [implementationList]),
    group(
      "bottleneck-supporting-artifacts",
      "瓶颈报告的支撑产物",
      [],
      [
        stringList(
          scope,
          "bottleneck_report.supporting_artifacts",
          bottleneck?.supporting_artifacts,
          "run:/bottleneck_report/supporting_artifacts",
          { description: "瓶颈结论所引用的 artifact_id 列表；列出不代表这些 artifact 已被再次读取或校验。" },
        ),
      ],
    ),
    group(
      "resolved-fidelity-flags",
      "解析后的精度画像 · 聚合标志",
      fidelityFlagFields,
      [],
      "has_* 是后端聚合事实；false 表示后端没有发现该类偏移，不表示前端已完成校验。",
    ),
    group(
      "resolved-fidelity-entries",
      "解析后的精度画像 · 逐环节状态",
      [],
      [
        buildList(
          scope,
          "resolved_fidelity_profile.entries",
          "resolved_fidelity_profile.entries",
          profile?.entries,
          "run:/resolved_fidelity_profile/entries",
          fidelityEntryColumns,
          (item, index) => fidelityEntryRecord(scope, item, index),
          {
            description:
              "requested 与 actual fidelity 分开显示；downgraded、fallback、not_covered、expected_absence 各自独立，不合并成一种状态。",
          },
        ),
      ],
    ),
  ];
}
