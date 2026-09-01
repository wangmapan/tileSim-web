import type { EvidenceAgentDescriptorResponse, EvidenceAgentResponse } from "../../contracts/bridge-api";
import { evidenceAgentResponse as validateEvidenceAgentResponseSchema } from "../../contracts/generated/evidence-agent-validators.js";
import type { Claim, EvidenceAgentCitation } from "../../contracts/generated/bridge-contracts";
import { canonicalJson } from "./canonical-json";
import { EvidenceAgentContractError } from "./errors";
import { recordCarriesEvidenceSubject, resolveEvidencePointer } from "./request-builder";
import type {
  EvidenceAgentBinding,
  EvidenceAgentUiState,
  PreparedEvidenceAgentRequest,
  ValidatedEvidenceAgentResult,
} from "./types";

function sameProvider(left: EvidenceAgentDescriptorResponse["provider"], right: EvidenceAgentResponse["provider"]) {
  return (
    left.configured === right.configured &&
    left.provider_id === right.provider_id &&
    left.model_id === right.model_id &&
    left.model_revision === right.model_revision
  );
}

function matchingAllowedRecord(citation: EvidenceAgentCitation, prepared: PreparedEvidenceAgentRequest) {
  const artifact = prepared.request.artifact_allow_list.find(
    (entry) =>
      entry.run_id === citation.run_id &&
      entry.artifact_id === citation.artifact_id &&
      entry.schema_identity === citation.schema_identity &&
      entry.sha256 === citation.sha256,
  );
  if (!artifact) throw new EvidenceAgentContractError("citation_not_allowed");
  const subjectMatches = artifact.allowed_records.filter(
    (record) => record.subject.kind === citation.subject.kind && record.subject.id === citation.subject.id,
  );
  if (new Set(subjectMatches.map((record) => record.json_pointer)).size > 1) {
    throw new EvidenceAgentContractError("ambiguous_reference");
  }
  const record = subjectMatches.find((candidate) => candidate.json_pointer === citation.json_pointer);
  if (!record) throw new EvidenceAgentContractError("citation_not_resolvable");
  const target = resolveEvidencePointer(prepared.artifactRoots[citation.artifact_id], citation.json_pointer);
  if (!recordCarriesEvidenceSubject(target, citation.subject)) {
    throw new EvidenceAgentContractError("citation_not_resolvable");
  }
}

function validateLosslessValue(citation: EvidenceAgentCitation) {
  if (!citation.value) {
    if (citation.unit) throw new EvidenceAgentContractError("citation_value_invalid");
    return;
  }
  if (citation.availability !== "available") {
    throw new EvidenceAgentContractError("citation_availability_value_mismatch");
  }
  if (!citation.unit || citation.value.encoding !== "decimal_string") {
    throw new EvidenceAgentContractError("citation_value_invalid");
  }
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(citation.value.decimal)) {
    throw new EvidenceAgentContractError("citation_value_invalid");
  }
  if (citation.value.numeric_kind === "uint64" && citation.value.decimal.startsWith("-")) {
    throw new EvidenceAgentContractError("citation_value_invalid");
  }
}

function validateClaimScope(claim: Claim, prepared: PreparedEvidenceAgentRequest) {
  const expected = prepared.request.snapshot_reference.evidence_scope;
  if (
    claim.scope.source_mode !== expected.source_mode ||
    claim.scope.requested_fidelity !== expected.requested_fidelity ||
    claim.scope.resolved_fidelity !== expected.resolved_fidelity ||
    claim.scope.execution_mode !== expected.execution_mode ||
    claim.scope.resource_semantics_relation !== "S3_S4_S5_peer" ||
    claim.scope.causal_subsystems.some((subsystem) => ["S7", "S8", "S9"].includes(subsystem))
  ) {
    throw new EvidenceAgentContractError("claim_scope_mismatch");
  }
  if (
    claim.claim_kind === "reported_attribution" &&
    claim.scope.attribution_semantics !== "reported_attribution_only"
  ) {
    throw new EvidenceAgentContractError("attribution_scope_mismatch");
  }
  if (
    claim.claim_kind === "conditional_recommendation" &&
    claim.scope.recommendation_semantics !== "conditional_not_executed"
  ) {
    throw new EvidenceAgentContractError("recommendation_scope_mismatch");
  }
  if (
    claim.percentile_subject &&
    canonicalJson(claim.percentile_subject) !== canonicalJson(expected.percentile_subject)
  ) {
    throw new EvidenceAgentContractError("percentile_subject_mismatch");
  }
}

function validateClaims(response: EvidenceAgentResponse, prepared: PreparedEvidenceAgentRequest) {
  const claimIds = new Set<string>();
  const citationIds = new Set<string>();
  for (const claim of response.claims) {
    if (claimIds.has(claim.claim_id)) throw new EvidenceAgentContractError("ambiguous_claim_id");
    claimIds.add(claim.claim_id);
    if (claim.claim_kind !== "help_text" && claim.citations.length === 0) {
      throw new EvidenceAgentContractError("missing_citation");
    }
    validateClaimScope(claim, prepared);
    for (const citation of claim.citations) {
      if (
        citation.schema_version !== "tilesim.bridge.evidence_agent_citation.v1" ||
        citation.run_id !== prepared.request.run_id
      ) {
        throw new EvidenceAgentContractError("citation_identity_mismatch");
      }
      const citationId = canonicalJson(citation);
      if (citationIds.has(`${claim.claim_id}\u0000${citationId}`)) {
        throw new EvidenceAgentContractError("duplicate_citation");
      }
      citationIds.add(`${claim.claim_id}\u0000${citationId}`);
      matchingAllowedRecord(citation, prepared);
      validateLosslessValue(citation);
    }
  }
}

function terminalState(response: EvidenceAgentResponse): EvidenceAgentUiState {
  if (response.staleness.state === "stale") return "stale";
  if (response.refusal?.reason_code === "provider_unavailable") return "provider_unavailable";
  if (response.refusal?.reason_code === "concurrency_limit") return "concurrency_limit";
  if (response.completion_state === "timeout") return "timeout";
  if (response.completion_state === "cancelled") return "cancelled";
  if (response.completion_state === "failed") return "failed";
  if (response.completion_state === "refused") return "refused";
  if (response.completion_state === "truncated" || response.truncated) return "truncated";
  if (response.completion_state === "partial" || response.partial) return "partial";
  return "available_draft";
}

export function validateEvidenceAgentResult(
  response: EvidenceAgentResponse,
  prepared: PreparedEvidenceAgentRequest,
  descriptor: EvidenceAgentDescriptorResponse,
  currentBinding: EvidenceAgentBinding,
): ValidatedEvidenceAgentResult {
  if (!validateEvidenceAgentResponseSchema(response)) {
    throw new EvidenceAgentContractError("unsupported_schema");
  }
  if (
    response.schema_set_revision !== descriptor.schema_set_revision ||
    response.run_id !== prepared.request.run_id ||
    response.client_request_id !== prepared.request.client_request_id ||
    response.input_snapshot_digest !== prepared.inputSnapshotDigest ||
    !sameProvider(descriptor.provider, response.provider) ||
    response.revisions.prompt_template_revision !== descriptor.revisions.prompt_template_revision ||
    response.revisions.policy_revision !== descriptor.revisions.policy_revision
  ) {
    throw new EvidenceAgentContractError("response_binding_mismatch");
  }
  if (
    response.audit_summary.hidden_reasoning_returned ||
    response.audit_summary.operations.some((operation) => !descriptor.tools.allowed.includes(operation))
  ) {
    throw new EvidenceAgentContractError("unsafe_tool_request");
  }
  if (!Number.isFinite(Date.parse(response.generated_at))) {
    throw new EvidenceAgentContractError("generated_at_invalid");
  }
  const expectedBindings = new Set(["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"]);
  if (
    response.staleness.binding_fields.length !== expectedBindings.size ||
    response.staleness.binding_fields.some((field) => !expectedBindings.has(field))
  ) {
    throw new EvidenceAgentContractError("staleness_contract_invalid");
  }
  const contextStale =
    currentBinding.runId !== response.run_id ||
    currentBinding.schemaSetRevision !== response.schema_set_revision ||
    currentBinding.inputSnapshotDigest !== response.input_snapshot_digest ||
    currentBinding.backendIdentity !==
      [
        prepared.request.snapshot_reference.backend_identity.source_revision,
        prepared.request.snapshot_reference.backend_identity.build_revision,
        prepared.request.snapshot_reference.backend_identity.source_state_digest,
        prepared.request.snapshot_reference.backend_identity.build_state_digest,
      ].join("|");
  const hasRefusal = Boolean(response.refusal);
  const refusalOnlyTerminal = ["refused", "failed", "timeout", "cancelled"].includes(response.completion_state);
  const reason = response.refusal?.reason_code;
  const reasonCompletionMismatch =
    (reason === "provider_unavailable" && response.completion_state !== "refused") ||
    (reason === "timeout" && response.completion_state !== "timeout") ||
    (reason === "cancelled" && response.completion_state !== "cancelled") ||
    (reason === "concurrency_limit" && response.completion_state !== "refused") ||
    (response.completion_state === "timeout" && reason !== "timeout") ||
    (response.completion_state === "cancelled" && reason !== "cancelled");
  if (
    (response.completion_state === "completed" && (response.claims.length === 0 || hasRefusal)) ||
    (refusalOnlyTerminal && (!hasRefusal || response.claims.length > 0)) ||
    reasonCompletionMismatch ||
    response.partial !== (response.completion_state === "partial") ||
    response.truncated !== (response.completion_state === "truncated")
  ) {
    throw new EvidenceAgentContractError("completion_state_invalid");
  }
  if (
    response.claims.length > descriptor.limits.maximum_claims ||
    response.claims.reduce((length, claim) => length + Array.from(claim.text).length, 0) >
      descriptor.limits.maximum_output_characters
  ) {
    throw new EvidenceAgentContractError("output_limit_exceeded");
  }
  validateClaims(response, prepared);
  if (contextStale || response.staleness.state === "stale") {
    return {
      state: "stale",
      response,
      invalidClaimIds: response.claims.map((claim) => claim.claim_id),
      detail: "stale",
    };
  }
  return {
    state: terminalState(response),
    response,
    invalidClaimIds: [],
    detail: response.refusal?.reason_code || response.degradation.reason_code || response.completion_state,
  };
}
