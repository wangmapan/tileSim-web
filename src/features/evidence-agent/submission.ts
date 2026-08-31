import type { ApiManifestResponse, EvidenceAgentDescriptorResponse } from "../../contracts/bridge-api";
import { BridgeApiError, bridgeApi } from "../../lib/api";
import { EvidenceAgentContractError } from "./errors";
import { validateEvidenceAgentResult } from "./response-validator";
import type { EvidenceAgentBinding, PreparedEvidenceAgentRequest } from "./types";

export function evidenceAgentErrorState(code: string) {
  if (code === "provider_unavailable") return "provider_unavailable" as const;
  if (code === "concurrency_limit") return "concurrency_limit" as const;
  if (code === "timeout") return "timeout" as const;
  if (code === "cancelled") return "cancelled" as const;
  if (code === "unsupported_schema") return "unsupported_schema" as const;
  return "contract_error" as const;
}

export async function submitEvidenceAgentAnalysis({
  manifest,
  descriptor,
  prepared,
  binding,
  idempotencyKey,
}: {
  manifest: ApiManifestResponse;
  descriptor: EvidenceAgentDescriptorResponse;
  prepared: PreparedEvidenceAgentRequest;
  binding: EvidenceAgentBinding;
  idempotencyKey: string;
}) {
  const terminal = await bridgeApi.createEvidenceAnalysis(
    manifest,
    prepared.request.run_id,
    prepared.canonicalText,
    idempotencyKey,
  );
  return validateEvidenceAgentResult(terminal.payload, prepared, descriptor, binding);
}

export function evidenceAgentFailure(error: unknown) {
  const code =
    error instanceof EvidenceAgentContractError || error instanceof BridgeApiError
      ? error.code
      : "evidence_agent_request_failed";
  return {
    code,
    state: evidenceAgentErrorState(code),
    keepPending: error instanceof BridgeApiError && error.retryable,
  };
}
