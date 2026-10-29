import type { ArtifactManifestResponse } from "../../../contracts/bridge-api";
import type { ReportBundle, RunInputs } from "../../../contracts/report-model";

export type ReplayAvailability =
  "available" | "partial" | "missing" | "expected_absence" | "not_covered" | "unsupported_schema";

export type ReplayEventTiming =
  { type: "instant"; atPs: string } | { type: "interval"; startPs: string; endPs: string };

export type ReplayRouteState = "available" | "partial" | "route_unavailable" | "no_path" | "topology_identity_mismatch";

export interface ReplayEvent {
  eventId: string;
  sequence: string;
  sourceIndex: number;
  kind: string;
  label: string;
  timing: ReplayEventTiming;
  requestId?: string;
  batchId?: string;
  state?: string;
  sourcePath: string;
  sourceArtifact: string;
  sourceSchema?: string;
  availability: ReplayAvailability;
  detail?: string;
}

export interface ReplayStage {
  stageId: string;
  label: string;
  subsystem?: string;
  timing?: { startPs: string; endPs: string };
  pointPs?: string;
  sourcePath: string;
  sourceArtifact: string;
  availability: ReplayAvailability;
  detail?: string;
}

export interface ReplayTopologyNode {
  id: string;
  label: string;
  deviceType?: string;
  sourcePath: string;
}

export interface ReplayTopologyLink {
  id: string;
  source: string;
  destination: string;
  domainId?: string;
  sourcePath: string;
}

export interface ReplayTopology {
  availability: ReplayAvailability;
  nodes: ReplayTopologyNode[];
  links: ReplayTopologyLink[];
  sourcePath: string;
  sourceArtifact: string;
}

export interface ReplayFabricEvent {
  eventId: string;
  routeId: string;
  linkId?: string;
  kind: string;
  label: string;
  timing: ReplayEventTiming;
  sourcePath: string;
  sourceArtifact: string;
  availability: ReplayAvailability;
}

export interface ReplayRoute {
  routeId: string;
  requestId?: string;
  phaseId?: string;
  actualPath: string[];
  linkIds: string[];
  timing?: { startPs: string; endPs: string };
  sourcePath: string;
  sourceArtifact: string;
  availability: ReplayAvailability;
  state: ReplayRouteState;
  hasInterval: boolean;
  events: ReplayFabricEvent[];
}

export interface ReplayCollectiveStep {
  stepId: string;
  collectiveId: string;
  phaseId: string;
  /** Human-readable label from the backend-reported collective phase. */
  phaseLabel?: string;
  round: string;
  chunk: string;
  timing: { startPs: string; endPs: string };
  sourceDevice: string;
  destinationDevice: string;
  bytes: string;
  dependencies: string[] | null;
  sourcePath: string;
  sourceArtifact: string;
  availability: ReplayAvailability;
}

export interface ReplayCollectiveModel {
  availability: ReplayAvailability;
  supported: boolean;
  steps: ReplayCollectiveStep[];
  sourcePath: string;
  sourceArtifact: string;
  reason: string;
}

export interface ReplayTraceProvenance {
  sourceMode: string | null;
  calibrationLevel: string | null;
  allowedClaimScope: string | null;
}

export interface ReplayCoverage {
  status: ReplayAvailability;
  stages: ReplayAvailability;
  runtimeEvents: ReplayAvailability;
  requestSummaries: ReplayAvailability;
  phaseFabric: ReplayAvailability;
  fabricRoutes: ReplayAvailability;
  topology: ReplayAvailability;
  collectiveSteps: ReplayAvailability;
  reasons: string[];
}

export interface ReplayDocument {
  runId: string | null;
  backendIdentity: string;
  schemaSetRevision: string;
  artifactSha256: string | null;
  startPs: string | null;
  endPs: string | null;
  hasValidRange: boolean;
  stages: ReplayStage[];
  events: ReplayEvent[];
  topology: ReplayTopology;
  routes: ReplayRoute[];
  fabricEvents: ReplayFabricEvent[];
  fabricRouteState: ReplayRouteState;
  collective: ReplayCollectiveModel;
  traceProvenance: ReplayTraceProvenance;
  coverage: ReplayCoverage;
}

export interface ReplayArtifactPayload {
  value: unknown;
  artifactId: string;
  sha256: string;
  schemaIdentity?: string;
  availability: ReplayAvailability;
}

export interface ReplayNormalizeInput {
  runId: string | null;
  backendIdentity?: string;
  schemaSetRevision?: string;
  artifactSha256?: string | null;
  envelope?: unknown;
  runtimeEvents?: ReplayArtifactPayload | unknown | null;
  runtimeRequests?: ReplayArtifactPayload | unknown | null;
  fabricRoutes?: ReplayArtifactPayload | unknown | null;
  collectiveSteps?: ReplayArtifactPayload | unknown | null;
  metrics?: unknown | null;
  topology?: unknown | null;
}

export interface ExecutionReplayPropsSource {
  runId: string | null;
  bundle: ReportBundle;
  inputs: RunInputs;
  artifactManifest: ArtifactManifestResponse | null;
  backendIdentity: string;
  schemaSetRevision: string;
  bridgeManifest: unknown;
}
