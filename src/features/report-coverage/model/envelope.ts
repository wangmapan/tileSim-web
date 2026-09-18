import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageGroup } from "../types";
import {
  bool,
  buildList,
  cell,
  count,
  field,
  group,
  picoseconds,
  record,
  referenceText,
  stringList,
  type Scope,
} from "./shared";

export function buildEnvelopeCoverage(bundle: ReportBundle): CoverageGroup[] {
  const envelope = bundle.execution_envelope;
  if (!envelope) return [];
  const scope: Scope = { bundle, kind: "execution_envelope", subsystems: [] };
  const provenance = envelope.trace_provenance;

  const identityFields = [
    field(scope, "envelope_id", envelope.envelope_id, "/execution-envelope/envelope_id"),
    field(scope, "trace_name", envelope.trace_name, "/execution-envelope/trace_name"),
    field(scope, "range_label", envelope.range_label, "/execution-envelope/range_label"),
    field(scope, "start_time_ps", envelope.start_time_ps, "/execution-envelope/start_time_ps", picoseconds, {
      mono: true,
    }),
    field(scope, "end_time_ps", envelope.end_time_ps, "/execution-envelope/end_time_ps", picoseconds, { mono: true }),
    field(
      scope,
      "runtime_event_count",
      envelope.runtime_event_count,
      "/execution-envelope/runtime_event_count",
      count,
      {
        mono: true,
      },
    ),
    field(
      scope,
      "fabric_record_count",
      envelope.fabric_record_count,
      "/execution-envelope/fabric_record_count",
      count,
      {
        mono: true,
      },
    ),
    field(scope, "trace_provenance.source_id", provenance?.source_id, "/execution-envelope/trace_provenance/source_id"),
    field(
      scope,
      "trace_provenance.generation_path",
      provenance?.generation_path,
      "/execution-envelope/trace_provenance/generation_path",
    ),
    field(
      scope,
      "trace_provenance.trace_kind",
      provenance?.trace_kind,
      "/execution-envelope/trace_provenance/trace_kind",
    ),
  ];

  const captureFields = [
    field(
      scope,
      "has_runtime_event_trace",
      envelope.has_runtime_event_trace,
      "/execution-envelope/has_runtime_event_trace",
      bool,
      { fact: true },
    ),
    field(
      scope,
      "has_tail_cause_chain_report",
      envelope.has_tail_cause_chain_report,
      "/execution-envelope/has_tail_cause_chain_report",
      bool,
      { fact: true },
    ),
    field(scope, "evidence_refs", envelope.evidence_refs, "/execution-envelope/evidence_refs", referenceText, {
      mono: true,
    }),
  ];

  return [
    group(
      "envelope-identity",
      "信封身份与时间边界",
      identityFields,
      [],
      "信封身份字段已随 execution-envelope artifact 到达前端；这里只渲染，不据此推断运行期事件是否被采集。",
    ),
    group(
      "envelope-capture-facts",
      "采集布尔事实",
      captureFields,
      [],
      "has_runtime_event_trace 与 has_tail_cause_chain_report 是布尔事实：为 false 时如实显示为「否」，不使用颜色或文案暗示已采集。",
    ),
    group(
      "envelope-notes",
      "信封说明",
      [],
      [
        stringList(scope, "notes", envelope.notes, "execution-envelope:/notes", {
          description: "后端写出的信封级说明，原样显示。",
        }),
      ],
    ),
    group(
      "envelope-stage-refs",
      "阶段的引用",
      [],
      [
        buildList(
          scope,
          "stages",
          "stages",
          envelope.stages,
          "execution-envelope:/stages",
          [
            { key: "stage_id", label: "stage_id", mono: true },
            { key: "subsystem", label: "subsystem" },
            { key: "stage_kind", label: "stage_kind" },
            { key: "subject_refs", label: "subject_refs" },
            { key: "evidence_refs", label: "evidence_refs" },
          ],
          (item, index) => {
            const entry = record(item);
            return {
              key: `${String(entry.stage_id ?? index)}`,
              cells: [
                cell(scope, "stage_id", entry.stage_id, undefined, { mono: true }),
                cell(scope, "subsystem", entry.subsystem),
                cell(scope, "stage_kind", entry.stage_kind),
                cell(scope, "subject_refs", entry.subject_refs, referenceText),
                cell(scope, "evidence_refs", entry.evidence_refs, referenceText),
              ],
            };
          },
          { description: "stage 的 subject_refs / evidence_refs 是后端给出的可导航引用；空列表表示该阶段没有附引用。" },
        ),
      ],
    ),
  ];
}
