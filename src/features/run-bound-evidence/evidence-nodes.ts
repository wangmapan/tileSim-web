import type { EvidenceRef, PhaseFabricContribution, RequestMetric, SubjectRef } from "../../contracts/report-model";
import {
  artifactAvailability,
  identityAware,
  reference,
  reportForArtifact,
  structuredReference,
  subjectMatchesRequest,
  uniqueMatch,
  uniqueStrings,
  unavailableNode,
} from "./evidence-references";
import type { BuildContext, RunBoundAvailability, RunBoundEvidenceNode, RunBoundReference, UniqueMatch } from "./types";

function buildS1Node(context: BuildContext): RunBoundEvidenceNode {
  const metrics = uniqueMatch<RequestMetric>(
    context.bundle.metrics?.request_metrics || [],
    (row) => row.request_id === context.requestId,
  );
  const runtime = uniqueMatch(
    context.inputs.runtime_trace?.requests || [],
    (row) => row.request_id === context.requestId,
  );
  if (metrics.state === "ambiguous_reference" || runtime.state === "ambiguous_reference")
    return unavailableNode("S1", "运行时请求", "ambiguous_reference", "同一 request_id 对应多条记录，拒绝按位置选择。");
  if (metrics.state === "missing" && runtime.state === "missing")
    return unavailableNode("S1", "运行时请求", "missing", "S1 输入和 request metrics 均无此 request_id。");
  const references: RunBoundReference[] = [];
  const artifacts: string[] = [];
  if (runtime.state === "available") {
    artifacts.push("input-runtime-trace");
    references.push(
      reference(
        context.manifest,
        "input-runtime-trace",
        `/requests/${runtime.index}`,
        "request",
        context.requestId,
        "S1 输入请求",
      ),
    );
  }
  if (metrics.state === "available") {
    artifacts.push("metrics");
    references.push(
      reference(
        context.manifest,
        "metrics",
        `/request_metrics/${metrics.index}`,
        "request",
        context.requestId,
        "S9 请求指标",
      ),
    );
  }
  const availability = metrics.state === "available" && runtime.state === "available" ? "available" : "partial";
  return {
    subsystem: "S1",
    title: "运行时请求",
    availability: identityAware(
      context.manifest,
      metrics.state === "available" ? ["metrics"] : artifacts,
      availability,
    ),
    detail:
      availability === "available" ? "使用 request_id 精确连接 S1 输入与请求指标。" : "只找到一个显式 request 记录。",
    entityIds: [context.requestId],
    references,
  };
}

function phaseContext(context: BuildContext): UniqueMatch<PhaseFabricContribution> {
  const summary = context.bundle.metrics?.system_summary;
  const phases = summary?.phase_fabric_contributions || [];
  const direct = uniqueMatch(phases, (row) => row.request_id === context.requestId);
  if (direct.state !== "ambiguous_reference") return direct;
  const requestContribution = uniqueMatch(
    summary?.request_fabric_contributions || [],
    (row) => row.request_id === context.requestId,
  );
  if (requestContribution.state !== "available" || !requestContribution.value.dominant_phase_id) return direct;
  return uniqueMatch(phases, (row) => row.phase_id === requestContribution.value?.dominant_phase_id);
}

function peerNode(
  subsystem: "S3" | "S4" | "S5",
  title: string,
  phase: UniqueMatch<PhaseFabricContribution>,
  context: BuildContext,
): RunBoundEvidenceNode {
  if (phase.state !== "available")
    return unavailableNode(
      subsystem,
      title,
      phase.state === "ambiguous_reference" ? "ambiguous_reference" : "contract_gap",
      phase.state === "ambiguous_reference"
        ? "request_id 对应多个 phase，且没有唯一 phase_id 选择。"
        : "没有该 request_id 的唯一 S6 phase 记录。",
    );
  const phaseValue = phase.value;
  const field = subsystem === "S3" ? "memory_event_id" : subsystem === "S4" ? "device_task_id" : "collective_id";
  if (subsystem === "S5" && phaseValue.not_s5_collective === true)
    return unavailableNode("S5", title, "not_applicable", "后端明确标记 not_s5_collective。");
  const entityId = phaseValue[field];
  if (typeof entityId !== "string" || !entityId)
    return unavailableNode(subsystem, title, "missing", "phase 缺少所需资源稳定 ID。");
  return {
    subsystem,
    title,
    availability: identityAware(context.manifest, ["metrics"], "available"),
    detail: "在 request_id 唯一匹配后读取并列资源语义稳定 ID。",
    entityIds: [entityId],
    references: [
      reference(
        context.manifest,
        "metrics",
        `/system_summary/phase_fabric_contributions/${phase.index}`,
        field.replace(/_id$/, ""),
        entityId,
        "S6 phase 资源引用",
      ),
    ],
  };
}

function buildS6Node(phase: UniqueMatch<PhaseFabricContribution>, context: BuildContext): RunBoundEvidenceNode {
  if (phase.state !== "available")
    return unavailableNode(
      "S6",
      "Fabric request phase",
      phase.state === "ambiguous_reference" ? "ambiguous_reference" : "missing",
      phase.state === "ambiguous_reference"
        ? "request_id 对应多个 phase，拒绝按 rank 选择。"
        : "没有该 request_id 的 S6 phase。",
    );
  const phaseId = phase.value.phase_id;
  if (!phaseId) return unavailableNode("S6", "Fabric request phase", "contract_gap", "S6 phase 缺少稳定 phase_id。");
  return {
    subsystem: "S6",
    title: "Fabric request phase",
    availability: identityAware(context.manifest, ["metrics"], "available"),
    detail: "使用 request_id 唯一匹配，并以 phase_id 作为 S6 实体身份。",
    entityIds: [context.requestId, phaseId],
    references: [
      reference(
        context.manifest,
        "metrics",
        `/system_summary/phase_fabric_contributions/${phase.index}`,
        "fabric_phase",
        phaseId,
        "S6 phase",
      ),
    ],
  };
}

function matchingSubjects(subjects: SubjectRef[] | undefined, requestId: string): boolean {
  return Boolean(subjects?.some((subject) => subjectMatchesRequest(subject, requestId)));
}

function outputNode(subsystem: "S7" | "S8" | "S9", title: string, context: BuildContext): RunBoundEvidenceNode {
  const entries: Array<{
    stableId: string | undefined;
    subjectRefs: SubjectRef[] | undefined;
    evidenceRefs: EvidenceRef[] | undefined;
    pointer: string;
  }> =
    subsystem === "S7"
      ? (context.bundle.execution_envelope?.stages || []).map((entry, index) => ({
          stableId: entry.stage_id,
          subjectRefs: entry.subject_refs,
          evidenceRefs: entry.evidence_refs,
          pointer: `/stages/${index}`,
        }))
      : subsystem === "S8"
        ? (context.bundle.validation?.checks || []).map((entry, index) => ({
            stableId: entry.check_id,
            subjectRefs: entry.subject_refs,
            evidenceRefs: entry.evidence_refs,
            pointer: `/checks/${index}`,
          }))
        : [
            ...(context.bundle.tail?.cause_chain || []).map((entry, index) => ({
              stableId: entry.cause_id,
              subjectRefs: entry.subject_refs,
              evidenceRefs: entry.evidence_refs,
              pointer: `/cause_chain/${index}`,
            })),
            ...(context.bundle.tail?.attribution_ranking || []).map((entry, index) => ({
              stableId: entry.attribution_id,
              subjectRefs: entry.subject_refs,
              evidenceRefs: entry.evidence_refs,
              pointer: `/attribution_ranking/${index}`,
            })),
          ];
  const artifactId = subsystem === "S7" ? "execution-envelope" : subsystem === "S8" ? "validation" : "tail-cause-chain";
  if (!reportForArtifact(context.bundle, artifactId))
    return unavailableNode(
      subsystem,
      title,
      artifactAvailability(context.manifest, artifactId) || "missing",
      "当前 run 缺少所需 artifact。",
    );
  const matches = entries.filter((entry) => matchingSubjects(entry.subjectRefs, context.requestId));
  if (!matches.length) {
    const legacy = artifactAvailability(context.manifest, artifactId) === "legacy_compatibility";
    return unavailableNode(
      subsystem,
      title,
      legacy ? "legacy_compatibility" : "contract_gap",
      legacy
        ? "旧报告只能确认 run-level association，不能声称完整跨子系统证据闭环。"
        : "没有匹配当前 request 的 subject_refs。",
    );
  }
  const stableIds = matches.map((entry) => entry.stableId);
  if (stableIds.some((id) => typeof id !== "string" || !id) || !uniqueStrings(stableIds as string[]))
    return unavailableNode(subsystem, title, "ambiguous_reference", "输出面 stable ID 缺失或重复。");
  const references: RunBoundReference[] = [];
  let availability: RunBoundAvailability = identityAware(context.manifest, [artifactId], "available");
  for (const entry of matches) {
    const stableId = entry.stableId as string;
    references.push(
      reference(
        context.manifest,
        artifactId,
        entry.pointer,
        subsystem === "S7" ? "stage" : subsystem === "S8" ? "check" : "cause_or_attribution",
        stableId,
        `${subsystem} stable record`,
      ),
    );
    for (const evidence of entry.evidenceRefs || []) {
      const checked = structuredReference(context, evidence, `${subsystem} EvidenceRef`);
      if (checked.reference) references.push(checked.reference);
      if (checked.availability === "partial") availability = "partial";
      else if (!["available", "not_applicable"].includes(checked.availability)) {
        availability = checked.availability;
        context.gaps.push(checked.detail);
      }
    }
  }
  return {
    subsystem,
    title,
    availability,
    detail: "输出面记录通过 request subject_refs 与稳定 ID 绑定；EvidenceRef 已逐项校验。",
    entityIds: stableIds as string[],
    references,
  };
}

export function buildEvidenceNodes(context: BuildContext): RunBoundEvidenceNode[] {
  const phase = phaseContext(context);
  return [
    buildS1Node(context),
    peerNode("S3", "Memory / KV", phase, context),
    peerNode("S4", "Device", phase, context),
    peerNode("S5", "Collective", phase, context),
    buildS6Node(phase, context),
    outputNode("S7", "统一执行宿主", context),
    outputNode("S8", "验证报告", context),
    outputNode("S9", "Tail 归因", context),
  ];
}
