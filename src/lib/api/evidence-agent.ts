import type {
  ApiManifestResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentResponse,
  ErrorResponse,
} from "../../contracts/bridge-api";
import { adaptEvidenceAgentDescriptor } from "../../adapters/evidence-agent-descriptor";
import {
  evidenceAgentDescriptor as validateEvidenceAgentDescriptor,
  evidenceAgentError as validateEvidenceAgentError,
  evidenceAgentResponse as validateEvidenceAgentResponse,
} from "../../contracts/generated/evidence-agent-validators.js";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { t } from "../../i18n";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, apiRoots, isRecord } from "./transport";

const revisionPattern = /^sha256:[0-9a-f]{64}$/;

function contractError(code: string, detail: string, status = 0): BridgeApiError {
  return new BridgeApiError(t("证据 Agent 契约不可用：{detail}", { detail }), {
    status,
    code,
    retryable: false,
  });
}

function schemaSetRevisionHeader(response: Response, manifest: ApiManifestResponse): string {
  const revision = response.headers.get("x-tilesim-schema-set-revision") || "";
  if (!revisionPattern.test(revision) || revision !== manifest.schema_set_revision) {
    throw contractError("evidence_agent_revision_mismatch", "response_header_revision_mismatch", response.status);
  }
  return revision;
}

function expectedTerminalHttpStatus(payload: EvidenceAgentResponse): number | null {
  const reason = payload.refusal?.reason_code;
  if (reason === "provider_unavailable") {
    return payload.completion_state === "refused" ? 503 : null;
  }
  if (reason === "timeout") return payload.completion_state === "timeout" ? 504 : null;
  if (reason === "cancelled") return payload.completion_state === "cancelled" ? 200 : null;
  if (reason === "concurrency_limit") return payload.completion_state === "refused" ? 200 : null;
  if (payload.completion_state === "timeout" || payload.completion_state === "cancelled") return null;
  if (payload.completion_state === "failed") return 502;
  return 200;
}

function validateEvidenceAgentErrorMapping(response: Response, envelope: ErrorResponse) {
  const idempotencyCodes = ["terminal_result_not_retained", "idempotency_payload_mismatch"];
  const isIdempotencyError = idempotencyCodes.includes(envelope.error.code);
  if (response.status === 409 && !isIdempotencyError) {
    throw contractError("invalid_evidence_agent_response", "unexpected_409_error_code", response.status);
  }
  if (!isIdempotencyError) return;
  if (
    response.status !== 409 ||
    envelope.error.field_path !== "/headers/Idempotency-Key" ||
    envelope.error.retryable !== false
  ) {
    throw contractError("invalid_evidence_agent_response", "idempotency_error_mapping_mismatch", response.status);
  }
}

function advertisedAgent(manifest: ApiManifestResponse) {
  const value = (manifest as unknown as Record<string, unknown>).evidence_agent;
  if (manifest.legacy_unversioned === true || !isRecord(value)) {
    throw contractError("evidence_agent_unavailable", "evidence_agent_unavailable");
  }
  return value;
}

function endpointPath(value: unknown, method: "GET" | "POST", runId?: string): string {
  if (typeof value !== "string") throw contractError("evidence_agent_endpoint_invalid", "endpoint_missing");
  const prefix = `${method} /api/`;
  if (!value.startsWith(prefix) || value.includes("://") || value.includes("..")) {
    throw contractError("evidence_agent_endpoint_invalid", "endpoint_not_allow_listed");
  }
  let path = `/${value.slice(prefix.length)}`;
  if (runId) path = path.replace("{run_id}", encodeURIComponent(runId));
  if (path.includes("{") || path.includes("}")) {
    throw contractError("evidence_agent_endpoint_invalid", "endpoint_template_unresolved");
  }
  return path;
}

function validateAdvertisedIdentities(advertised: Record<string, unknown>) {
  const expected = {
    descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2",
    request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
    response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
    citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1",
    snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1",
    structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
    idempotency_header: "Idempotency-Key",
    execution_mode: "synchronous_terminal",
  } as const;
  for (const [field, value] of Object.entries(expected)) {
    if (advertised[field] !== value) {
      throw contractError("evidence_agent_identity_mismatch", `${field}_mismatch`);
    }
  }
}

export async function getEvidenceAgentDescriptor(
  manifest: ApiManifestResponse,
): Promise<EvidenceAgentDescriptorResponse> {
  const advertised = advertisedAgent(manifest);
  validateAdvertisedIdentities(advertised);
  const path = endpointPath(advertised.capability_endpoint, "GET");
  const { payload, schemaSetRevision } = await apiRequestWithMetadata<EvidenceAgentDescriptorResponse>(path);
  if (!validateEvidenceAgentDescriptor(payload)) {
    throw contractError("invalid_evidence_agent_descriptor", "descriptor_schema_invalid");
  }
  if (
    !revisionPattern.test(schemaSetRevision) ||
    payload.schema_set_revision !== manifest.schema_set_revision ||
    schemaSetRevision !== manifest.schema_set_revision
  ) {
    throw contractError("evidence_agent_revision_mismatch", "manifest_payload_header_revision_mismatch");
  }
  if (
    payload.schema_version !== advertised.descriptor_schema_identity ||
    payload.schema_identities.request !== advertised.request_schema_identity ||
    payload.schema_identities.response !== advertised.response_schema_identity ||
    payload.schema_identities.citation !== advertised.citation_schema_identity ||
    payload.schema_identities.snapshot_reference !== advertised.snapshot_reference_schema_identity ||
    payload.schema_identities.structured_report !== advertised.structured_report_schema_identity ||
    !revisionPattern.test(payload.descriptor_revision) ||
    payload.descriptor_revision !== advertised.descriptor_revision
  ) {
    throw contractError("evidence_agent_identity_mismatch", "descriptor_identity_mismatch");
  }
  const predicateAvailable = payload.provider.configured === payload.availability_predicate.expected_value;
  if (
    payload.availability_predicate.evaluated_available !== predicateAvailable ||
    (payload.availability === "available") !== predicateAvailable
  ) {
    throw contractError("evidence_agent_capability_mismatch", "availability_predicate_mismatch");
  }
  try {
    adaptEvidenceAgentDescriptor(payload);
  } catch {
    throw contractError("invalid_evidence_agent_descriptor", "descriptor_policy_inconsistent");
  }
  return payload;
}

export interface EvidenceAgentTerminalResponse {
  payload: EvidenceAgentResponse;
  schemaSetRevision: string;
  httpStatus: number;
}

export async function postEvidenceAgentAnalysis(
  manifest: ApiManifestResponse,
  runId: string,
  canonicalRequestText: string,
  idempotencyKey: string,
): Promise<EvidenceAgentTerminalResponse> {
  const advertised = advertisedAgent(manifest);
  validateAdvertisedIdentities(advertised);
  const path = endpointPath(advertised.analysis_endpoint, "POST", runId);
  const response = await fetch(`${apiRoots()[0]}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: canonicalRequestText,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw contractError("non_json_response", `http_${response.status}`, response.status);
  }
  let payload: unknown;
  try {
    payload = parseJsonLossless(await response.text());
  } catch {
    throw contractError("invalid_evidence_agent_response", "response_json_invalid", response.status);
  }
  if (!response.ok && validateEvidenceAgentError(payload)) {
    if ([502, 503, 504].includes(response.status)) {
      throw contractError("invalid_evidence_agent_response", "terminal_error_envelope_forbidden", response.status);
    }
    const envelope = payload as ErrorResponse;
    if (envelope.schema_version !== manifest.error_schema_version) {
      throw contractError("invalid_evidence_agent_response", "error_schema_identity_mismatch", response.status);
    }
    schemaSetRevisionHeader(response, manifest);
    validateEvidenceAgentErrorMapping(response, envelope);
    throw new BridgeApiError(envelope.error.message || t("证据 Agent 请求失败。"), {
      status: response.status,
      code: envelope.error.code,
      fieldPath: envelope.error.field_path,
      requestId: envelope.request_id,
      retryable: envelope.error.retryable,
    });
  }
  if (!validateEvidenceAgentResponse(payload)) {
    throw contractError("invalid_evidence_agent_response", "response_schema_invalid", response.status);
  }
  const validatedPayload = payload as EvidenceAgentResponse;
  const schemaSetRevision = schemaSetRevisionHeader(response, manifest);
  if (validatedPayload.schema_set_revision !== manifest.schema_set_revision) {
    throw contractError("evidence_agent_revision_mismatch", "response_revision_mismatch", response.status);
  }
  const expectedStatus = expectedTerminalHttpStatus(validatedPayload);
  if (expectedStatus === null || response.status !== expectedStatus) {
    throw contractError("evidence_agent_terminal_status_mismatch", "terminal_http_status_mismatch", response.status);
  }
  return { payload: validatedPayload, schemaSetRevision, httpStatus: response.status };
}
