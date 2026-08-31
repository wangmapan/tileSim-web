export { default as EvidenceAgentPanel } from "./components/EvidenceAgentPanel.vue";
export { canonicalJson, sha256Prefixed } from "./canonical-json";
export { EvidenceAgentContractError } from "./errors";
export {
  buildEvidenceAgentRequest,
  buildEvidenceAgentSnapshotDigest,
  evidenceAgentBackendIdentity,
  recordCarriesEvidenceSubject,
  resolveEvidencePointer,
  type BuildEvidenceAgentRequestOptions,
  type BuildEvidenceAgentSnapshotOptions,
} from "./request-builder";
export { validateEvidenceAgentResult } from "./response-validator";
export { evidenceAgentErrorState, evidenceAgentFailure, submitEvidenceAgentAnalysis } from "./submission";
export type {
  EvidenceAgentBinding,
  EvidenceAgentUiState,
  PreparedEvidenceAgentRequest,
  ValidatedEvidenceAgentResult,
} from "./types";
