import type {
  ArtifactAllowListEntry,
  EvidenceAgentRequest,
  EvidenceAgentResponse,
} from "../../contracts/generated/bridge-contracts";
import type { ReportBundle, RunInputs } from "../../contracts/report-model";

export type EvidenceAgentUiState =
  | "idle"
  | "submitting"
  | "available_draft"
  | "refused"
  | "partial"
  | "truncated"
  | "timeout"
  | "cancelled"
  | "stale"
  | "concurrency_limit"
  | "provider_unavailable"
  | "unsupported_schema"
  | "contract_error";

export interface EvidenceArtifactRoots {
  [artifactId: string]: unknown;
}

export interface PreparedEvidenceAgentRequest {
  request: EvidenceAgentRequest;
  canonicalText: string;
  payloadDigest: string;
  inputSnapshotDigest: string;
  artifactRoots: EvidenceArtifactRoots;
}

export interface EvidenceAgentRequestSource {
  bundle: ReportBundle;
  inputs: RunInputs;
  allowList: ArtifactAllowListEntry[];
}

export interface ValidatedEvidenceAgentResult {
  state: EvidenceAgentUiState;
  response: EvidenceAgentResponse;
  invalidClaimIds: string[];
  detail: string;
}

export interface EvidenceAgentBinding {
  runId: string;
  backendIdentity: string;
  schemaSetRevision: string;
  inputSnapshotDigest: string;
}

export interface PendingEvidenceAgentSubmission extends EvidenceAgentBinding {
  payloadDigest: string;
  idempotencyKey: string;
  clientRequestId: string;
}

export class EvidenceAgentContractError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "EvidenceAgentContractError";
    this.code = code;
  }
}
