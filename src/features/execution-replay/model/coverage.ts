import type { ReplayAvailability, ReplayCoverage, ReplayArtifactPayload, ReplayRouteState } from "./types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function payloadValue(payload: ReplayArtifactPayload | unknown | null | undefined): unknown {
  if (payload && typeof payload === "object" && "value" in payload && "artifactId" in payload) {
    return (payload as ReplayArtifactPayload).value;
  }
  return payload ?? null;
}

export function payloadAvailability(
  payload: ReplayArtifactPayload | unknown | null | undefined,
  fallback: ReplayAvailability = "missing",
): ReplayAvailability {
  if (payload && typeof payload === "object" && "availability" in payload) {
    return (payload as ReplayArtifactPayload).availability;
  }
  return payload == null ? fallback : "available";
}

export function hasArray(value: unknown, key: string): boolean {
  return Array.isArray(record(value)[key]);
}

export function buildReplayCoverage(input: {
  stages: ReplayAvailability;
  runtimeEvents: ReplayAvailability;
  requestSummaries: ReplayAvailability;
  phaseFabric: ReplayAvailability;
  fabricRoutes: ReplayAvailability;
  topology: ReplayAvailability;
  collectiveSteps: ReplayAvailability;
  hasStageRecords: boolean;
  hasEventRecords: boolean;
}): ReplayCoverage {
  // A verified execution-replay artifact is the canonical source for the
  // fine-grained Fabric/collective tracks. Its presence makes the older
  // aggregate phase-fabric contribution optional for replay completeness;
  // otherwise a real run with full route evidence is incorrectly shown as a
  // partial replay solely because the legacy metrics field is absent.
  const canonicalFineGrainedReplayAvailable =
    input.fabricRoutes === "available" && input.collectiveSteps === "available" && input.topology === "available";
  const statuses = [
    input.stages,
    input.runtimeEvents,
    input.requestSummaries,
    ...(canonicalFineGrainedReplayAvailable ? [] : [input.phaseFabric]),
    input.fabricRoutes,
    input.topology,
    input.collectiveSteps,
  ];
  const reasons: string[] = [];
  if (input.runtimeEvents !== "available") reasons.push("运行期事件未完整提供，回放不会生成空动画。");
  if (input.fabricRoutes !== "available") reasons.push("底层 Fabric 实际路径未完整提供。");
  if (input.phaseFabric !== "available" && !canonicalFineGrainedReplayAvailable)
    reasons.push("通信阶段只有聚合或未报告证据。");
  if (input.collectiveSteps !== "available") reasons.push("collective round/chunk 未报告；未从聚合指标生成步骤。");

  let status: ReplayAvailability;
  if (statuses.includes("unsupported_schema")) status = "unsupported_schema";
  else if (statuses.includes("not_covered") && !input.hasEventRecords && !input.hasStageRecords) status = "not_covered";
  // An expected-absence artifact is only the whole replay state when there
  // are no other reported records. A reported execution stage still gives
  // the user usable replay evidence, so keep the aggregate state partial.
  else if (statuses.includes("expected_absence") && !input.hasEventRecords && !input.hasStageRecords)
    status = "expected_absence";
  else if (!input.hasStageRecords && !input.hasEventRecords) status = "missing";
  else if (statuses.some((value) => ["missing", "not_covered", "partial", "expected_absence"].includes(value)))
    status = "partial";
  else status = "available";
  return { ...input, status, reasons };
}

export function coverageLabel(status: ReplayAvailability): string {
  return {
    available: "已提供",
    partial: "部分提供",
    missing: "未报告",
    expected_absence: "预期缺省",
    not_covered: "未覆盖",
    unsupported_schema: "不支持的 Schema",
  }[status];
}

export function routeStateLabel(state: ReplayRouteState): string {
  return {
    available: "路径已报告",
    partial: "路径部分报告",
    route_unavailable: "路径不可用",
    no_path: "路径细节未报告",
    topology_identity_mismatch: "拓扑身份不一致",
  }[state];
}
