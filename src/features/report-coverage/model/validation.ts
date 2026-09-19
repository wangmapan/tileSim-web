import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageGroup } from "../types";
import {
  buildList,
  bool,
  cell,
  count,
  field,
  group,
  numberText,
  record,
  referenceText,
  stringList,
  type Scope,
} from "./shared";

export function buildValidationCoverage(bundle: ReportBundle): CoverageGroup[] {
  const validation = bundle.validation;
  if (!validation) return [];
  const scope: Scope = { bundle, kind: "validation", subsystems: [] };
  const control = validation.resolution_control;
  const desContract = validation.des_contract;
  const provenance = validation.trace_provenance;

  const scopeFields = [
    field(scope, "validation_scope", validation.validation_scope, "/validation/validation_scope"),
    field(scope, "validation_lane", validation.validation_lane, "/validation/validation_lane"),
    field(scope, "evidence_tier", validation.evidence_tier, "/validation/evidence_tier"),
    field(scope, "claim_scope_summary", validation.claim_scope_summary, "/validation/claim_scope_summary"),
    field(scope, "baseline_package_id", validation.baseline_package_id, "/validation/baseline_package_id"),
  ];

  const provenanceFields = [
    field(scope, "trace_provenance.source_id", provenance?.source_id, "/validation/trace_provenance/source_id"),
    field(
      scope,
      "trace_provenance.generation_path",
      provenance?.generation_path,
      "/validation/trace_provenance/generation_path",
    ),
    field(
      scope,
      "trace_provenance.capture_or_generation_time",
      provenance?.capture_or_generation_time,
      "/validation/trace_provenance/capture_or_generation_time",
    ),
    field(
      scope,
      "trace_provenance.upstream_tooling",
      provenance?.upstream_tooling,
      "/validation/trace_provenance/upstream_tooling",
    ),
    field(scope, "trace_provenance.trace_kind", provenance?.trace_kind, "/validation/trace_provenance/trace_kind"),
    field(scope, "trace_provenance.source_mode", provenance?.source_mode, "/validation/trace_provenance/source_mode"),
    field(
      scope,
      "trace_provenance.calibration_level",
      provenance?.calibration_level,
      "/validation/trace_provenance/calibration_level",
    ),
    field(
      scope,
      "trace_provenance.allowed_claim_scope",
      provenance?.allowed_claim_scope,
      "/validation/trace_provenance/allowed_claim_scope",
    ),
  ];

  const desContractFields = [
    field(
      scope,
      "des_contract.des_contract_state",
      desContract?.des_contract_state,
      "/validation/des_contract/des_contract_state",
    ),
    field(
      scope,
      "des_contract.des_required_subsystem_count",
      desContract?.des_required_subsystem_count,
      "/validation/des_contract/des_required_subsystem_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "des_contract.des_satisfied_subsystem_count",
      desContract?.des_satisfied_subsystem_count,
      "/validation/des_contract/des_satisfied_subsystem_count",
      count,
      { mono: true },
    ),
  ];

  const resolutionFields = [
    field(scope, "resolution_control.range_label", control?.range_label, "/validation/resolution_control/range_label"),
    field(
      scope,
      "resolution.has_downgrades",
      control?.has_downgrades,
      "/validation/resolution_control/has_downgrades",
      bool,
      {
        fact: true,
      },
    ),
    field(
      scope,
      "resolution.has_fallbacks",
      control?.has_fallbacks,
      "/validation/resolution_control/has_fallbacks",
      bool,
      {
        fact: true,
      },
    ),
    field(
      scope,
      "resolution.has_not_covered",
      control?.has_not_covered,
      "/validation/resolution_control/has_not_covered",
      bool,
      {
        fact: true,
      },
    ),
    field(
      scope,
      "resolution.has_expected_absence",
      control?.has_expected_absence,
      "/validation/resolution_control/has_expected_absence",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "resolution.downgrade_count",
      control?.downgrade_count,
      "/validation/resolution_control/downgrade_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "resolution.fallback_count",
      control?.fallback_count,
      "/validation/resolution_control/fallback_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "resolution.not_covered_count",
      control?.not_covered_count,
      "/validation/resolution_control/not_covered_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "resolution.expected_absence_count",
      control?.expected_absence_count,
      "/validation/resolution_control/expected_absence_count",
      count,
      { mono: true },
    ),
    field(
      scope,
      "resolution.dominant_resolution",
      control?.dominant_resolution,
      "/validation/resolution_control/dominant_resolution",
    ),
    field(
      scope,
      "resolution.dominant_subsystem",
      control?.dominant_subsystem,
      "/validation/resolution_control/dominant_subsystem",
    ),
    field(
      scope,
      "resolution.dominant_detail",
      control?.dominant_detail,
      "/validation/resolution_control/dominant_detail",
    ),
    field(
      scope,
      "resolution.claim_scope_summary",
      control?.claim_scope_summary,
      "/validation/resolution_control/claim_scope_summary",
    ),
  ];

  return [
    group(
      "validation-scope",
      "验证范围与基线",
      scopeFields,
      [],
      "validation_scope、validation_lane 与 evidence_tier 由后端写出；前端不把 evidence_tier 升级为更强结论。",
    ),
    group(
      "validation-provenance-detail",
      "Trace 来源明细",
      provenanceFields,
      [],
      "source_id / generation_path / capture_or_generation_time / upstream_tooling 用于追溯数据来源；不得据此推断 provenance 等级。",
    ),
    group(
      "validation-error-budget",
      "误差预算矩阵",
      [],
      [
        buildList(
          scope,
          "error_budget",
          "error_budget",
          validation.error_budget,
          "validation:/error_budget",
          [
            { key: "metric_id", label: "metric_id", mono: true },
            { key: "subsystem", label: "subsystem" },
            { key: "observed_value", label: "observed_value", numeric: true },
            { key: "expected_value", label: "expected_value", numeric: true },
            { key: "absolute_error", label: "absolute_error", numeric: true },
            { key: "tolerance", label: "tolerance", numeric: true },
            { key: "unit", label: "unit" },
            { key: "status", label: "status" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.metric_id ?? index)}`,
              cells: [
                cell(scope, "metric_id", entry.metric_id, undefined, { mono: true }),
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "observed_value", entry.observed_value, numberText, { numeric: true }),
                cell(scope, "expected_value", entry.expected_value, numberText, { numeric: true }),
                cell(scope, "absolute_error", entry.absolute_error, numberText, { numeric: true }),
                cell(scope, "tolerance", entry.tolerance, numberText, { numeric: true }),
                cell(scope, "unit", entry.unit),
                cell(scope, "status", entry.status),
              ],
            };
          },
          {
            description:
              "这是验证报告自身的误差预算条目；与 S8 校准产物中的 relative_error_budget 不是同一字段，两者不合并显示。",
          },
        ),
      ],
    ),
    group(
      "validation-benchmark-manifests",
      "基准清单",
      [],
      [stringList(scope, "benchmark_manifests", validation.benchmark_manifests, "validation:/benchmark_manifests")],
    ),
    group(
      "validation-calibration-inputs",
      "校准输入",
      [],
      [stringList(scope, "calibration_inputs", validation.calibration_inputs, "validation:/calibration_inputs")],
    ),
    group(
      "validation-des-contract",
      "验证侧 DES 契约",
      desContractFields,
      [],
      "契约状态与满足计数来自验证报告；缺口列表在下方单独列出，不并入计数。",
    ),
    group(
      "validation-des-contract-gaps",
      "验证侧 DES 契约缺口",
      [],
      [
        stringList(
          scope,
          "des_contract.des_contract_gaps",
          desContract?.des_contract_gaps,
          "validation:/des_contract/des_contract_gaps",
        ),
      ],
    ),
    group(
      "validation-resolution-control",
      "精度解析聚合",
      resolutionFields,
      [],
      "四个 has_* 与四个计数分别对应 downgrade / fallback / not_covered / expected_absence，互不合并。",
    ),
    group(
      "validation-checks-refs",
      "验证检查的结构化引用",
      [],
      [
        buildList(
          scope,
          "checks",
          "checks",
          validation.checks,
          "validation:/checks",
          [
            { key: "check_id", label: "check_id", mono: true },
            { key: "subsystem", label: "subsystem" },
            { key: "status", label: "status" },
            { key: "subject_refs", label: "subject_refs" },
            { key: "evidence_refs", label: "evidence_refs" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.check_id ?? index)}`,
              cells: [
                cell(scope, "check_id", entry.check_id, undefined, { mono: true }),
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "status", entry.status),
                cell(scope, "subject_refs", entry.subject_refs, referenceText),
                cell(scope, "evidence_refs", entry.evidence_refs, referenceText),
              ],
            };
          },
          { description: "subject_refs / evidence_refs 是后端给出的可导航引用；空列表表示该检查没有附引用。" },
        ),
      ],
    ),
    group(
      "validation-resolution-entry-refs",
      "精度解析条目的结构化引用",
      [],
      [
        buildList(
          scope,
          "resolution_entries",
          "resolution_entries",
          validation.resolution_entries,
          "validation:/resolution_entries",
          [
            { key: "subsystem", label: "subsystem" },
            { key: "subject_refs", label: "subject_refs" },
            { key: "evidence_refs", label: "evidence_refs" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.subsystem ?? index)}`,
              cells: [
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "subject_refs", entry.subject_refs, referenceText),
                cell(scope, "evidence_refs", entry.evidence_refs, referenceText),
              ],
            };
          },
          {
            description: "后端未给条目写出引用时按缺失标记，不用其它字段代替。",
            emptyEntryNote: "后端未提供 resolution_entries。",
          },
        ),
      ],
    ),
  ];
}
