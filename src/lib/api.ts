import type { CreateRunRequest } from "../contracts/bridge-api";
import { generatedBridgeClient } from "./api/client";
import { getApiManifest, SUPPORTED_BRIDGE_API_VERSION } from "./api/manifest";
import {
  getArtifactManifest,
  getArtifactText,
  getVerifiedArtifact,
  getVerifiedArtifactText,
  getVerifiedReports,
  rawArtifactUrl,
} from "./api/artifacts";
import { waitForRun } from "./api/run-events";
import { getExperimentDescriptor } from "./api/experiment-schema";
import { getEvidenceAgentDescriptor, postEvidenceAgentAnalysis } from "./api/evidence-agent";
import { getTracePackageCatalog, postTracePackageInspect } from "./api/trace-packages";

export type {
  ApiManifestResponse,
  ApiRun,
  ArtifactManifestEntry,
  ArtifactManifestResponse,
  CapabilitiesResponse,
  CatalogResponse,
  CreateRunRequest,
  CreateRunResponse,
  EvidenceAgentCitation,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
  ExperimentDescriptorResponse,
  HealthResponse,
  TracePackageCatalogResponse,
  TracePackageInspectResponse,
  Week7CalibrationResponse,
  Week7EvidenceMapResponse,
  Week7OrchestrationResponse,
} from "../contracts/bridge-api";
export type { WaitForRunOptions } from "./api/run-events";
export { BridgeApiError } from "./api/errors";
export { apiRequest } from "./api/transport";
export { rawArtifactUrl, SUPPORTED_BRIDGE_API_VERSION };

export const bridgeApi = {
  manifest: getApiManifest,
  health: () => generatedBridgeClient.health(),
  catalog: () => generatedBridgeClient.catalog(),
  capabilities: () => generatedBridgeClient.capabilities(),
  experimentSchema: getExperimentDescriptor,
  evidenceAgentCapabilities: getEvidenceAgentDescriptor,
  tracePackages: getTracePackageCatalog,
  inspectTracePackage: postTracePackageInspect,
  createEvidenceAnalysis: postEvidenceAgentAnalysis,
  week7EvidenceMap: () => generatedBridgeClient.week7EvidenceMap(),
  runWeek7CalibrationExample: () => generatedBridgeClient.runWeek7CalibrationExample(),
  runWeek7OrchestrationExample: () => generatedBridgeClient.runWeek7OrchestrationExample(),
  listRuns: () => generatedBridgeClient.listRuns(),
  getRun: (runId: string) => generatedBridgeClient.getRun(runId),
  getReports: (runId: string) => generatedBridgeClient.getReports(runId),
  getArtifactManifest,
  getVerifiedArtifact,
  getVerifiedArtifactText,
  getVerifiedReports,
  getArtifact: (runId: string, artifact: string) => generatedBridgeClient.getArtifact(runId, artifact),
  getArtifactText,
  getTemplate: (scenarioId: string) => generatedBridgeClient.getTemplate(scenarioId),
  getInput: (runId: string) => generatedBridgeClient.getArtifact(runId, "input-runtime-trace"),
  renameRun: (runId: string, runName: string) => generatedBridgeClient.renameRun(runId, { run_name: runName }),
  createRun: (payload: CreateRunRequest, idempotencyKey: string) =>
    generatedBridgeClient.createRun(payload, idempotencyKey),
  waitForRun,
};
