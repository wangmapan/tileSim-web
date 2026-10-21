// Generated from bridge/contracts/openapi.json. Do not edit by hand.

import type {
  AgentOrchestrationCapabilitySnapshotResponse,
  AgentOrchestrationRunIntakePreviewRequest,
  AgentOrchestrationRunIntakePreviewResponse,
  ApiManifestResponse,
  ApiRun,
  ArtifactManifestResponse,
  AssistantModelCatalogueResponse,
  AssistantModelDescriptorResponse,
  AssistantModelPlanRequest,
  AssistantModelPlanResponse,
  AssistantModelSelectionRequest,
  AssistantModelSelectionResponse,
  BatchActionRequest,
  BatchApprovalRequest,
  BatchCreateRequest,
  BatchEventsResponse,
  BatchListResponse,
  BatchResponse,
  CapabilitiesResponse,
  CatalogResponse,
  CreateRunRequest,
  CreateRunResponse,
  DeleteRunResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
  ExperimentDescriptorResponse,
  HealthResponse,
  OptimizationActionRequest,
  OptimizationApprovalRequest,
  OptimizationApprovalResponse,
  OptimizationSessionCreateRequest,
  OptimizationSessionEventsResponse,
  OptimizationSessionListResponse,
  OptimizationSessionResponse,
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
  assistantModelDescriptor: () => "/agent/assistant-model",
  listOptimizationSessions: () => "/agent/optimization/sessions",
  createOptimizationSession: () => "/agent/optimization/sessions",
  getOptimizationSession: (sessionId: string) => `/agent/optimization/sessions/${encodeURIComponent(sessionId)}`,
  getOptimizationSessionEvents: (sessionId: string) =>
    `/agent/optimization/sessions/${encodeURIComponent(sessionId)}/events`,
  streamOptimizationSessionEvents: (sessionId: string) =>
    `/agent/optimization/sessions/${encodeURIComponent(sessionId)}/events/stream`,
  approveOptimizationCandidate: (sessionId: string, candidateId: string) =>
    `/agent/optimization/sessions/${encodeURIComponent(sessionId)}/candidates/${encodeURIComponent(candidateId)}/approve`,
  mutateOptimizationSession: (sessionId: string, action: string) =>
    `/agent/optimization/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(action)}`,
  listBatches: () => "/agent/batches",
  createBatch: () => "/agent/batches",
  getBatch: (batchId: string) => `/agent/batches/${encodeURIComponent(batchId)}`,
  getBatchEvents: (batchId: string) => `/agent/batches/${encodeURIComponent(batchId)}/events`,
  streamBatchEvents: (batchId: string) => `/agent/batches/${encodeURIComponent(batchId)}/events/stream`,
  approveBatch: (batchId: string) => `/agent/batches/${encodeURIComponent(batchId)}/approve`,
  mutateBatch: (batchId: string, action: string) =>
    `/agent/batches/${encodeURIComponent(batchId)}/${encodeURIComponent(action)}`,
  assistantModelCatalogue: () => "/agent/assistant-model-catalogue",
  selectAssistantModel: () => "/agent/assistant-model-selection",
  planAgentScenario: () => "/agent/scenario-plan",
  streamAgentScenarioChat: () => "/agent/scenario-chat",
  streamAgentResultAnalysis: () => "/agent/result-analysis",
  evidenceAgentCapabilities: () => "/agent/evidence-capabilities",
  agentOrchestrationCapabilities: () => "/agent/orchestration-capabilities",
  previewAgentRunIntake: () => "/agent/run-intake-preview",
  week7EvidenceMap: () => "/week7/evidence-map",
  runWeek7CalibrationExample: () => "/week7/calibration-example",
  runWeek7OrchestrationExample: () => "/week7/orchestration-example",
  getTemplate: (scenarioId: string) => `/templates/${encodeURIComponent(scenarioId)}`,
  listRuns: () => "/runs",
  createRun: () => "/runs",
  getRun: (runId: string) => `/runs/${encodeURIComponent(runId)}`,
  deleteRun: (runId: string) => `/runs/${encodeURIComponent(runId)}`,
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

  assistantModelDescriptor(): Promise<AssistantModelDescriptorResponse> {
    return this.transport.request<AssistantModelDescriptorResponse>(bridgePaths.assistantModelDescriptor(), {});
  }

  listOptimizationSessions(): Promise<OptimizationSessionListResponse> {
    return this.transport.request<OptimizationSessionListResponse>(bridgePaths.listOptimizationSessions(), {});
  }

  createOptimizationSession(
    body: OptimizationSessionCreateRequest,
    idempotencyKey: string,
  ): Promise<OptimizationSessionResponse> {
    return this.transport.request<OptimizationSessionResponse>(bridgePaths.createOptimizationSession(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  getOptimizationSession(sessionId: string): Promise<OptimizationSessionResponse> {
    return this.transport.request<OptimizationSessionResponse>(bridgePaths.getOptimizationSession(sessionId), {});
  }

  getOptimizationSessionEvents(sessionId: string): Promise<OptimizationSessionEventsResponse> {
    return this.transport.request<OptimizationSessionEventsResponse>(
      bridgePaths.getOptimizationSessionEvents(sessionId),
      {},
    );
  }

  approveOptimizationCandidate(
    sessionId: string,
    candidateId: string,
    body: OptimizationApprovalRequest,
    idempotencyKey: string,
  ): Promise<OptimizationApprovalResponse> {
    return this.transport.request<OptimizationApprovalResponse>(
      bridgePaths.approveOptimizationCandidate(sessionId, candidateId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      },
    );
  }

  mutateOptimizationSession(
    sessionId: string,
    action: string,
    body: OptimizationActionRequest,
    idempotencyKey: string,
  ): Promise<OptimizationSessionResponse> {
    return this.transport.request<OptimizationSessionResponse>(
      bridgePaths.mutateOptimizationSession(sessionId, action),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      },
    );
  }

  listBatches(): Promise<BatchListResponse> {
    return this.transport.request<BatchListResponse>(bridgePaths.listBatches(), {});
  }

  createBatch(body: BatchCreateRequest, idempotencyKey: string): Promise<BatchResponse> {
    return this.transport.request<BatchResponse>(bridgePaths.createBatch(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  getBatch(batchId: string): Promise<BatchResponse> {
    return this.transport.request<BatchResponse>(bridgePaths.getBatch(batchId), {});
  }

  getBatchEvents(batchId: string): Promise<BatchEventsResponse> {
    return this.transport.request<BatchEventsResponse>(bridgePaths.getBatchEvents(batchId), {});
  }

  approveBatch(batchId: string, body: BatchApprovalRequest, idempotencyKey: string): Promise<BatchResponse> {
    return this.transport.request<BatchResponse>(bridgePaths.approveBatch(batchId), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  mutateBatch(
    batchId: string,
    action: string,
    body: BatchActionRequest,
    idempotencyKey: string,
  ): Promise<BatchResponse> {
    return this.transport.request<BatchResponse>(bridgePaths.mutateBatch(batchId, action), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  assistantModelCatalogue(): Promise<AssistantModelCatalogueResponse> {
    return this.transport.request<AssistantModelCatalogueResponse>(bridgePaths.assistantModelCatalogue(), {});
  }

  selectAssistantModel(body: AssistantModelSelectionRequest): Promise<AssistantModelSelectionResponse> {
    return this.transport.request<AssistantModelSelectionResponse>(bridgePaths.selectAssistantModel(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  planAgentScenario(body: AssistantModelPlanRequest): Promise<AssistantModelPlanResponse> {
    return this.transport.request<AssistantModelPlanResponse>(bridgePaths.planAgentScenario(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  previewAgentRunIntake(
    body: AgentOrchestrationRunIntakePreviewRequest,
  ): Promise<AgentOrchestrationRunIntakePreviewResponse> {
    return this.transport.request<AgentOrchestrationRunIntakePreviewResponse>(bridgePaths.previewAgentRunIntake(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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

  deleteRun(runId: string): Promise<DeleteRunResponse> {
    return this.transport.request<DeleteRunResponse>(bridgePaths.deleteRun(runId), { method: "DELETE" });
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
