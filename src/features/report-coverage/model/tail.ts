import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageGroup } from "../types";
import { buildList, cell, field, group, numberText, picoseconds, record, stringList, type Scope } from "./shared";

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
  ];
}
