import type {
  ApiManifestResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentResponse,
} from "../../contracts/bridge-api";
import {
  evidenceAgentDescriptor as validateEvidenceAgentDescriptor,
  evidenceAgentResponse as validateEvidenceAgentResponse,
} from "../../contracts/generated/evidence-agent-validators.js";
import { parseJsonLossless } from "../../contracts/lossless-json";
import { t } from "../../i18n";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, apiRoots, isRecord } from "./transport";

const revisionPattern = /^sha256:[0-9a-f]{64}$/;

function contractError(code: string, detail: string, status = 0): BridgeApiError {
  return new BridgeApiError(t("F9 Agent 契约不可用：{detail}", { detail }), {
    status,
    code,
    retryable: false,
  });
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
    descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v1",
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
    !revisionPattern.test(payload.descriptor_revision)
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
  if (!validateEvidenceAgentResponse(payload)) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    if (!response.ok && error) {
      throw new BridgeApiError(typeof error.message === "string" ? error.message : t("F9 Agent 请求失败。"), {
        status: response.status,
        code: typeof error.code === "string" ? error.code : `http_${response.status}`,
        fieldPath: typeof error.field_path === "string" ? error.field_path : null,
        requestId: response.headers.get("x-request-id") || "",
        retryable: error.retryable === true,
      });
    }
    throw contractError("invalid_evidence_agent_response", "response_schema_invalid", response.status);
  }
  const validatedPayload = payload as EvidenceAgentResponse;
  const schemaSetRevision = response.headers.get("x-tilesim-schema-set-revision") || "";
  if (
    !revisionPattern.test(schemaSetRevision) ||
    schemaSetRevision !== manifest.schema_set_revision ||
    validatedPayload.schema_set_revision !== manifest.schema_set_revision
  ) {
    throw contractError("evidence_agent_revision_mismatch", "response_revision_mismatch", response.status);
  }
  return { payload: validatedPayload, schemaSetRevision, httpStatus: response.status };
}
