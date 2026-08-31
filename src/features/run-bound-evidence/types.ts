import type { PercentileSubject, LosslessInteger, ReportBundle, RunInputs } from "../../contracts/report-model";
import type { ArtifactManifestResponse } from "../../lib/api";

export type RunBoundAvailability =
  | "available"
  | "partial"
  | "run_scope_only"
  | "not_applicable"
  | "missing"
  | "ambiguous_reference"
  | "invalid_reference"
  | "artifact_identity_missing"
  | "unsupported_schema"
  | "legacy_compatibility"
  | "contract_gap";

export interface RequestOption {
  requestId: string;
  hasRuntimeInput: boolean;
  hasMetrics: boolean;
  isTailExplainedEntity: boolean;
}

export interface RunBoundReference {
  artifactId: string;
  schemaIdentity: string;
  sha256: string | null;
  jsonPointer: string;
  sourcePath: string;
  entityKind: string;
  entityId: string;
  label: string;
}

export interface RunBoundEvidenceNode {
  subsystem: "S1" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9";
  title: string;
  availability: RunBoundAvailability;
  detail: string;
  entityIds: string[];
  references: RunBoundReference[];
}

export interface PercentileNavigation {
  key: string;
  metricKind: PercentileSubject["metric_kind"];
  percentile: PercentileSubject["percentile"];
  valuePs: LosslessInteger;
  selectionRule: string;
  semantics: PercentileSubject["selection_semantics"];
  selectedRequestId: string | null;
  memberRequestIds: string[];
  availability: RunBoundAvailability;
  detail: string;
  reference: RunBoundReference | null;
}

export interface Week8ExecutionSummary {
  availability: RunBoundAvailability;
  requestedFidelity: string | null;
  resolvedFidelity: string | null;
  executionMode: string | null;
  fallback: { policy: string; used: boolean; reason: string } | null;
  provenance: { sourceMode: string; calibrationLevel: string; allowedClaimScope: string } | null;
  stateSummary: {
    logicalTimePs: LosslessInteger;
    partitionCount: LosslessInteger;
    committedEventCount: LosslessInteger;
    pendingEventCount: LosslessInteger;
  } | null;
  differential: {
    compared: boolean;
    matched: boolean;
    partitionedDigest: string;
    referenceDigest: string;
    mismatchCode: string;
  } | null;
  stream: { recordCount: LosslessInteger; totalRecordCount: LosslessInteger; truncated: boolean } | null;
  checkpoint: {
    archiveSchemaIdentity: string;
    archiveDigest: string;
    partitionConfigurationDigest: string;
    checkpointLogicalTimePs: LosslessInteger;
    committedEventCount: LosslessInteger;
    pendingEventCount: LosslessInteger;
    completedIdentityCount: LosslessInteger;
    subjectVersionCount: LosslessInteger;
    payloadAvailability: string;
  } | null;
  reference: RunBoundReference | null;
  detail: string;
}

export interface RunBoundEvidenceChain {
  runId: string | null;
  requestId: string | null;
  contractState: "versioned" | "compatibility_unversioned" | "unsupported_schema";
  requestOptions: RequestOption[];
  percentileSubjects: PercentileNavigation[];
  nodes: RunBoundEvidenceNode[];
  week8Execution: Week8ExecutionSummary;
  gaps: string[];
}

export type UniqueMatch<T> =
  | { state: "available"; value: T; index: number }
  | { state: "missing" | "ambiguous_reference"; value: null; index: -1 };

export interface BuildContext {
  runId: string;
  requestId: string;
  bundle: ReportBundle;
  inputs: RunInputs;
  manifest: ArtifactManifestResponse | null;
  gaps: string[];
}
