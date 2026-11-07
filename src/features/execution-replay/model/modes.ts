import type { ReplayDocument, ReplayRoute } from "./types";

export type ReplayMode = "overview" | "collective" | "network";

export interface ReplayModeDefinition {
  key: ReplayMode;
  label: string;
  description: string;
}

export const replayModeDefinitions: ReplayModeDefinition[] = [
  { key: "overview", label: "执行概览", description: "阶段、运行事件和设备通信摘要" },
  { key: "collective", label: "集合通信", description: "逻辑参与者与已报告物理路径分开查看" },
  { key: "network", label: "设备与链路", description: "以拓扑作为空间投影查看实际路径" },
];

export interface ReplayParticipant {
  id: string;
  sourceDevices: string[];
  destinationDevices: string[];
  stepCount: number;
  bytes: string[];
  sourcePath: string;
}

/**
 * Build a display-only participant summary from canonical collective steps.
 * It intentionally keeps source and destination identities separate from the
 * physical route. No topology ordering or path is inferred here.
 */
export function collectiveParticipants(document: ReplayDocument): ReplayParticipant[] {
  const groups = new Map<string, ReplayParticipant>();
  for (const step of document.collective.steps) {
    const current = groups.get(step.collectiveId) || {
      id: step.collectiveId,
      sourceDevices: [],
      destinationDevices: [],
      stepCount: 0,
      bytes: [],
      sourcePath: step.sourcePath,
    };
    if (!current.sourceDevices.includes(step.sourceDevice)) current.sourceDevices.push(step.sourceDevice);
    if (!current.destinationDevices.includes(step.destinationDevice))
      current.destinationDevices.push(step.destinationDevice);
    if (!current.bytes.includes(step.bytes)) current.bytes.push(step.bytes);
    current.stepCount += 1;
    groups.set(step.collectiveId, current);
  }
  return [...groups.values()];
}

/** Only routes with a backend-reported actual_path are physical-path rows. */
export function reportedNetworkRoutes(document: ReplayDocument): ReplayRoute[] {
  return document.routes.filter(
    (route) => route.actualPath.length >= 2 && route.state === "available" && route.events.length > 0,
  );
}
