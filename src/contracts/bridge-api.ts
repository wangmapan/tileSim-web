import type {
  ApiManifestResponse as VersionedApiManifestResponse,
  ApiRun,
  AgentOrchestrationCapabilitySnapshotResponse,
  ArtifactManifestEntry as GeneratedArtifactManifestEntry,
  ArtifactManifestResponse as GeneratedArtifactManifestResponse,
  CapabilitiesResponse,
  CatalogResponse,
  CreateRunRequest,
  CreateRunResponse,
  EvidenceAgentCitation,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
  ErrorResponse,
  ExperimentDescriptorResponse,
  HealthResponse,
  TracePackageCatalogResponse,
  TracePackageInspectResponse,
  Week7CalibrationResponse,
  Week7EvidenceMapResponse,
  Week7OrchestrationResponse,
} from "./generated/bridge-contracts";

export type {
  ApiRun,
  AgentOrchestrationCapabilitySnapshotResponse,
  CapabilitiesResponse,
  CatalogResponse,
  CreateRunRequest,
  CreateRunResponse,
  EvidenceAgentCitation,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
  ErrorResponse,
  ExperimentDescriptorResponse,
  HealthResponse,
  TracePackageCatalogResponse,
  TracePackageInspectResponse,
  Week7CalibrationResponse,
  Week7EvidenceMapResponse,
  Week7OrchestrationResponse,
};

export type ArtifactByteCount = number | string | bigint;

export interface ArtifactManifestEntry extends Omit<GeneratedArtifactManifestEntry, "bytes"> {
  bytes: ArtifactByteCount;
}

export interface ArtifactManifestResponse extends Omit<GeneratedArtifactManifestResponse, "artifacts"> {
  artifacts: ArtifactManifestEntry[];
}

export interface LegacyApiManifestResponse {
  schema_version: "tilesim.bridge.manifest.legacy_unversioned";
  api_version: "tilesim.bridge.api.legacy_unversioned";
  schema_set_revision: "legacy:unversioned";
  error_schema_version: "";
  artifact_manifest_schema_version: "";
  known_report_schema_identities: Record<string, string[]>;
  endpoints: Record<string, string>;
  run_creation?: undefined;
  run_events?: undefined;
  trace_packages?: undefined;
  legacy_unversioned: true;
}

export type ApiManifestResponse = VersionedApiManifestResponse | LegacyApiManifestResponse;
