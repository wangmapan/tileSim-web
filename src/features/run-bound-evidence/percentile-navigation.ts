import type { ReportBundle, RunInputs } from "../../contracts/report-model";
import type { ArtifactManifestResponse } from "../../lib/api";
import { identityAware, reference, subjectId, uniqueStrings } from "./evidence-references";
import type { PercentileNavigation, RequestOption } from "./types";

export function requestOptions(bundle: ReportBundle, inputs: RunInputs): RequestOption[] {
  const order: string[] = [];
  const values = new Map<string, RequestOption>();
  const ensure = (requestId: string) => {
    if (!values.has(requestId)) {
      order.push(requestId);
      values.set(requestId, { requestId, hasRuntimeInput: false, hasMetrics: false, isTailExplainedEntity: false });
    }
    return values.get(requestId)!;
  };
  for (const request of inputs.runtime_trace?.requests || []) ensure(request.request_id).hasRuntimeInput = true;
  for (const request of bundle.metrics?.request_metrics || []) ensure(request.request_id).hasMetrics = true;
  const tailRequestId = bundle.tail?.explained_entity?.id;
  if (tailRequestId) ensure(tailRequestId).isTailExplainedEntity = true;
  return order.map((requestId) => values.get(requestId)!);
}

export function percentileNavigations(
  bundle: ReportBundle,
  manifest: ArtifactManifestResponse | null,
): PercentileNavigation[] {
  const subjects = bundle.metrics?.percentile_subjects || [];
  return subjects
    .map((subject, index): PercentileNavigation => {
      const memberSet = new Set(subject.member_request_ids);
      const requestRefs = subject.subject_refs.filter((ref) => ref.kind === "request").map(subjectId);
      const base = {
        key: `${subject.metric_kind}:${subject.percentile}:${index}`,
        metricKind: subject.metric_kind,
        percentile: subject.percentile,
        valuePs: subject.value_ps,
        selectionRule: subject.selection_rule,
        semantics: subject.selection_semantics,
        selectedRequestId: subject.selected_request_id || null,
        memberRequestIds: subject.member_request_ids,
        reference: reference(
          manifest,
          "metrics",
          `/percentile_subjects/${index}`,
          "percentile_subject",
          `${subject.metric_kind}:p${subject.percentile}`,
          "percentile subject",
        ),
      };
      const duplicateIdentity = subjects.filter(
        (candidate) => candidate.metric_kind === subject.metric_kind && candidate.percentile === subject.percentile,
      ).length;
      if (duplicateIdentity !== 1)
        return {
          ...base,
          reference: null,
          availability: "ambiguous_reference",
          detail: "metric_kind 与 percentile 没有唯一对应的 subject。",
        };
      if (!uniqueStrings(subject.member_request_ids) || !uniqueStrings(requestRefs))
        return { ...base, availability: "ambiguous_reference", detail: "percentile member/subject ID 不是唯一集合。" };
      if (subject.selection_semantics === "single_request") {
        const selected = subject.selected_request_id;
        const requestMatches = (bundle.metrics?.request_metrics || []).filter(
          (request) => request.request_id === selected,
        );
        const valid =
          Boolean(selected) && memberSet.has(selected) && requestRefs.length === 1 && requestRefs[0] === selected;
        return {
          ...base,
          availability:
            valid && requestMatches.length === 1 ? identityAware(manifest, ["metrics"], "available") : "contract_gap",
          detail:
            valid && requestMatches.length === 1
              ? "后端明确选择了唯一 percentile request，可安全导航。"
              : "selected/member/subject_refs 不一致。",
        };
      }
      if (subject.selection_semantics === "tie_no_single_request") {
        const membersExist = [...memberSet].every(
          (id) => (bundle.metrics?.request_metrics || []).filter((request) => request.request_id === id).length === 1,
        );
        const valid =
          !subject.selected_request_id &&
          memberSet.size > 1 &&
          requestRefs.length === memberSet.size &&
          requestRefs.every((id) => memberSet.has(id)) &&
          membersExist;
        return {
          ...base,
          selectedRequestId: null,
          availability: valid ? identityAware(manifest, ["metrics"], "available") : "contract_gap",
          detail: valid
            ? "后端声明并列 member set；前端不会强选单个 request。"
            : "tie member set 与 subject_refs 不一致。",
        };
      }
      const valid = !subject.selected_request_id && memberSet.size === 0 && requestRefs.length === 0;
      return {
        ...base,
        selectedRequestId: null,
        availability: valid ? "not_applicable" : "contract_gap",
        detail: valid ? "后端明确声明该 percentile 不适用。" : "not_applicable 仍携带了 request identity。",
      };
    })
    .filter((subject) => subject.percentile === 99);
}
