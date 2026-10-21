import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageGroup } from "../types";
import {
  buildList,
  cell,
  count,
  field,
  group,
  numberText,
  picoseconds,
  record,
  referenceText,
  stringList,
  type Scope,
} from "./shared";

export function buildTailCoverage(bundle: ReportBundle): CoverageGroup[] {
  const tail = bundle.tail;
  if (!tail) return [];
  const scope: Scope = { bundle, kind: "tail", subsystems: [] };

  const symptomFields = [
    field(scope, "symptom", tail.symptom, "/tail/symptom"),
    field(scope, "explained_entity.kind", tail.explained_entity?.kind, "/tail/explained_entity/kind"),
    field(scope, "explained_entity.id", tail.explained_entity?.id, "/tail/explained_entity/id"),
    field(
      scope,
      "observation_window.start_time_ps",
      tail.observation_window?.start_time_ps,
      "/tail/observation_window/start_time_ps",
      picoseconds,
      { mono: true },
    ),
    field(
      scope,
      "observation_window.end_time_ps",
      tail.observation_window?.end_time_ps,
      "/tail/observation_window/end_time_ps",
      picoseconds,
      { mono: true },
    ),
  ];

  const causeChain = tail.cause_chain;
  const networkIntervals = (causeChain || []).flatMap((cause, causeIndex) =>
    Array.isArray(cause.network_intervals)
      ? cause.network_intervals.map((interval, intervalIndex) => ({ cause, interval, causeIndex, intervalIndex }))
      : [],
  );
  const networkIntervalsReported = (causeChain || []).some((cause) => Array.isArray(cause.network_intervals));

  return [
    group(
      "tail-symptom",
      "症状与观测窗口",
      symptomFields,
      [],
      "symptom 是后端给出的症状陈述；explained_entity_kind 与 id 分开显示，不由前端推断归因对象。",
    ),
    group(
      "tail-contributing-factors",
      "贡献因子",
      [],
      [
        buildList(
          scope,
          "contributing_factors",
          "contributing_factors",
          tail.contributing_factors,
          "tail:/contributing_factors",
          [
            { key: "subsystem", label: "subsystem" },
            { key: "factor_code", label: "factor_code" },
            { key: "detail", label: "detail" },
            { key: "score", label: "score", numeric: true },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.subsystem ?? index)}-${String(entry.factor_code ?? index)}`,
              cells: [
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "factor_code", entry.factor_code),
                cell(scope, "detail", entry.detail),
                cell(scope, "score", entry.score, numberText, { numeric: true }),
              ],
            };
          },
          {
            description:
              "贡献因子是与 attribution_ranking 不同的一层证据：前者是报告列出的候选因子，后者是带份额的排序结果。两者分开展示，不合并、不互相换算。",
          },
        ),
      ],
      "贡献因子与下方归因排序是两层不同的证据，前端不做合并或换算。",
    ),
    group(
      "tail-evidence-links",
      "证据链接",
      [],
      [
        stringList(scope, "validation_links", tail.validation_links, "tail:/validation_links"),
        stringList(scope, "metric_evidence_links", tail.metric_evidence_links, "tail:/metric_evidence_links"),
        stringList(scope, "resource_evidence_links", tail.resource_evidence_links, "tail:/resource_evidence_links"),
      ],
      "三类链接分别是验证、指标与资源证据的引用；列出不代表这些证据已被前端读取或复核。",
    ),
    group(
      "tail-unresolved-gaps",
      "未解决缺口",
      [],
      [stringList(scope, "unresolved_gaps", tail.unresolved_gaps, "tail:/unresolved_gaps")],
    ),
    group(
      "tail-network-intervals",
      "网络等待解释区间",
      [],
      [
        buildList(
          scope,
          "cause_chain.network_intervals",
          "cause_chain.network_intervals",
          networkIntervalsReported ? networkIntervals : undefined,
          "tail:/cause_chain/*/network_intervals",
          [
            { key: "cause_id", label: "cause_id", mono: true },
            { key: "component_code", label: "component_code" },
            { key: "demand_id", label: "demand_id", mono: true },
            { key: "link_id", label: "link_id", mono: true },
            { key: "attempt", label: "attempt", numeric: true },
            { key: "start_time_ps", label: "start_time_ps", numeric: true },
            { key: "end_time_ps", label: "end_time_ps", numeric: true },
            { key: "evidence", label: "evidence" },
            { key: "unresolved_reason", label: "unresolved_reason" },
            { key: "evidence_refs", label: "evidence_refs" },
          ],
          (item) => {
            const { cause, interval, causeIndex, intervalIndex } = item as (typeof networkIntervals)[number];
            return {
              key: `${String(cause.cause_id ?? causeIndex)}-${intervalIndex}`,
              cells: [
                cell(scope, "cause_id", cause.cause_id, undefined, { mono: true }),
                cell(scope, "component_code", interval.component_code),
                cell(scope, "demand_id", interval.demand_id, undefined, { mono: true }),
                cell(scope, "link_id", interval.link_id, undefined, { mono: true }),
                cell(scope, "attempt", interval.attempt, count, { numeric: true }),
                cell(scope, "start_time_ps", interval.start_time_ps, picoseconds, { numeric: true }),
                cell(scope, "end_time_ps", interval.end_time_ps, picoseconds, { numeric: true }),
                cell(scope, "evidence", interval.evidence),
                cell(scope, "unresolved_reason", interval.unresolved_reason),
                cell(scope, "evidence_refs", interval.evidence_refs, referenceText),
              ],
            };
          },
          {
            description:
              "network_intervals 是 cause_chain 中父级网络等待的解释区间；重叠、重复和子区间不与父级等待重复计费。",
          },
        ),
      ],
      "这些区间只解释父级网络等待，不是额外延迟；前端不按区间求和。",
    ),
  ];
}
