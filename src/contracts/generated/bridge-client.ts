// Generated from bridge/contracts/openapi.json. Do not edit by hand.

import type {
  AgentOrchestrationCapabilitySnapshotResponse,
  ApiManifestResponse,
  ApiRun,
  ArtifactManifestResponse,
  CapabilitiesResponse,
  CatalogResponse,
  CreateRunRequest,
  CreateRunResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
  ExperimentDescriptorResponse,
  HealthResponse,
  RenameRunRequest,
  RenameRunResponse,
  ReportsResponse,
  RunListResponse,
  TemplateResponse,
  TracePackageCatalogResponse,
  TracePackageInspectResponse,
  Week7CalibrationResponse,
  Week7EvidenceMapResponse,
  Week7OrchestrationResponse,
} from "./bridge-contracts";

export interface BridgeApiTransport {
  request<T>(path: string, options?: RequestInit): Promise<T>;
}

export const bridgePaths = {
  manifest: () => "/manifest",
  health: () => "/health",
  catalog: () => "/catalog",
  capabilities: () => "/capabilities",
  experimentSchema: () => "/experiment-schema",
  tracePackages: () => "/trace-packages",
  inspectTracePackage: (packageId: string) => `/trace-packages/${encodeURIComponent(packageId)}/inspect`,
  evidenceAgentCapabilities: () => "/agent/evidence-capabilities",
  agentOrchestrationCapabilities: () => "/agent/orchestration-capabilities",
  week7EvidenceMap: () => "/week7/evidence-map",
  runWeek7CalibrationExample: () => "/week7/calibration-example",
  runWeek7OrchestrationExample: () => "/week7/orchestration-example",
  getTemplate: (scenarioId: string) => `/templates/${encodeURIComponent(scenarioId)}`,
  listRuns: () => "/runs",
  createRun: () => "/runs",
  getRun: (runId: string) => `/runs/${encodeURIComponent(runId)}`,
  getRunEvents: (runId: string) => `/runs/${encodeURIComponent(runId)}/events`,
  getReports: (runId: string) => `/runs/${encodeURIComponent(runId)}/reports`,
  getArtifactManifest: (runId: string) => `/runs/${encodeURIComponent(runId)}/artifacts`,
  getArtifact: (runId: string, artifactId: string) =>
    `/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(artifactId)}`,
  renameRun: (runId: string) => `/runs/${encodeURIComponent(runId)}/name`,
  createEvidenceAnalysis: (runId: string) => `/runs/${encodeURIComponent(runId)}/agent/evidence-analyses`,
} as const;

export class GeneratedBridgeClient {
  constructor(private readonly transport: BridgeApiTransport) {}

  manifest(): Promise<ApiManifestResponse> {
    return this.transport.request<ApiManifestResponse>(bridgePaths.manifest(), {});
  }

  health(): Promise<HealthResponse> {
    return this.transport.request<HealthResponse>(bridgePaths.health(), {});
  }

  catalog(): Promise<CatalogResponse> {
    return this.transport.request<CatalogResponse>(bridgePaths.catalog(), {});
  }

  capabilities(): Promise<CapabilitiesResponse> {
    return this.transport.request<CapabilitiesResponse>(bridgePaths.capabilities(), {});
  }

  experimentSchema(): Promise<ExperimentDescriptorResponse> {
    return this.transport.request<ExperimentDescriptorResponse>(bridgePaths.experimentSchema(), {});
  }

  tracePackages(): Promise<TracePackageCatalogResponse> {
    return this.transport.request<TracePackageCatalogResponse>(bridgePaths.tracePackages(), {});
  }

  inspectTracePackage(packageId: string): Promise<TracePackageInspectResponse> {
    return this.transport.request<TracePackageInspectResponse>(bridgePaths.inspectTracePackage(packageId), {
      method: "POST",
    });
  }

  evidenceAgentCapabilities(): Promise<EvidenceAgentDescriptorResponse> {
    return this.transport.request<EvidenceAgentDescriptorResponse>(bridgePaths.evidenceAgentCapabilities(), {});
  }

  agentOrchestrationCapabilities(): Promise<AgentOrchestrationCapabilitySnapshotResponse> {
    return this.transport.request<AgentOrchestrationCapabilitySnapshotResponse>(
      bridgePaths.agentOrchestrationCapabilities(),
      {},
    );
  }

  week7EvidenceMap(): Promise<Week7EvidenceMapResponse> {
    return this.transport.request<Week7EvidenceMapResponse>(bridgePaths.week7EvidenceMap(), {});
  }

  runWeek7CalibrationExample(): Promise<Week7CalibrationResponse> {
    return this.transport.request<Week7CalibrationResponse>(bridgePaths.runWeek7CalibrationExample(), {
      method: "POST",
    });
  }

  runWeek7OrchestrationExample(): Promise<Week7OrchestrationResponse> {
    return this.transport.request<Week7OrchestrationResponse>(bridgePaths.runWeek7OrchestrationExample(), {
      method: "POST",
    });
  }

  getTemplate(scenarioId: string): Promise<TemplateResponse> {
    return this.transport.request<TemplateResponse>(bridgePaths.getTemplate(scenarioId), {});
  }

  listRuns(): Promise<RunListResponse> {
    return this.transport.request<RunListResponse>(bridgePaths.listRuns(), {});
  }

  createRun(body: CreateRunRequest, idempotencyKey: string): Promise<CreateRunResponse> {
    return this.transport.request<CreateRunResponse>(bridgePaths.createRun(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  getRun(runId: string): Promise<ApiRun> {
    return this.transport.request<ApiRun>(bridgePaths.getRun(runId), {});
  }

  getReports(runId: string): Promise<ReportsResponse> {
    return this.transport.request<ReportsResponse>(bridgePaths.getReports(runId), {});
  }

  getArtifactManifest(runId: string): Promise<ArtifactManifestResponse> {
    return this.transport.request<ArtifactManifestResponse>(bridgePaths.getArtifactManifest(runId), {});
  }

  getArtifact(runId: string, artifactId: string): Promise<unknown> {
    return this.transport.request<unknown>(bridgePaths.getArtifact(runId, artifactId), {});
  }

  renameRun(runId: string, body: RenameRunRequest): Promise<RenameRunResponse> {
    return this.transport.request<RenameRunResponse>(bridgePaths.renameRun(runId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  createEvidenceAnalysis(
    runId: string,
    body: EvidenceAgentRequest,
    idempotencyKey: string,
  ): Promise<EvidenceAgentResponse> {
    return this.transport.request<EvidenceAgentResponse>(bridgePaths.createEvidenceAnalysis(runId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }
}
