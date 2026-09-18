import type { AgentOrchestrationCapabilitySnapshotResponse, ApiManifestResponse } from "../../contracts/bridge-api";
import { agentOrchestrationCapabilitySnapshot as validateSnapshotSchema } from "../../contracts/generated/agent-orchestration-capability-validators.js";
import { t } from "../../i18n";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, isRecord } from "./transport";

const revisionPattern = /^sha256:[0-9a-f]{64}$/;

function contractError(code: string): BridgeApiError {
  return new BridgeApiError(t("Agent 编排能力契约不可用：{detail}", { detail: code }), {
    status: 0,
    code,
    retryable: false,
  });
}

function advertisedContract(manifest: ApiManifestResponse): Record<string, unknown> {
  const manifestRecord = manifest as unknown as Record<string, unknown>;
  const advertised = manifestRecord.agent_orchestration_capability;
  if (manifest.legacy_unversioned === true || !isRecord(advertised)) {
    throw contractError("agent_orchestration_capability_unavailable");
  }
  if (
    advertised.endpoint !== "GET /api/agent/orchestration-capabilities" ||
    advertised.snapshot_schema_identity !== "tilesim.bridge.agent_orchestration_capability_snapshot.v1" ||
    advertised.catalog_schema_identity !== "tilesim.bridge.agent_orchestration_capability_catalog.v1" ||
    advertised.parameter_descriptor_schema_identity !== "tilesim.bridge.agent_orchestration_parameter_descriptor.v1" ||
    !revisionPattern.test(String(advertised.catalog_revision)) ||
    !revisionPattern.test(String(advertised.contract_package_revision))
  ) {
    throw contractError("agent_orchestration_capability_identity_mismatch");
  }
  return advertised;
}

export function validateAgentOrchestrationCapabilitySnapshot(
  payload: unknown,
  manifest: ApiManifestResponse,
  responseSchemaSetRevision: string,
): AgentOrchestrationCapabilitySnapshotResponse {
  const advertised = advertisedContract(manifest);
  if (!validateSnapshotSchema(payload)) {
    throw contractError("invalid_agent_orchestration_capability_snapshot");
  }
  const snapshot = payload as AgentOrchestrationCapabilitySnapshotResponse;
  if (
    !revisionPattern.test(responseSchemaSetRevision) ||
    responseSchemaSetRevision !== manifest.schema_set_revision ||
    snapshot.release_binding.schema_set_revision !== manifest.schema_set_revision
  ) {
    throw contractError("agent_orchestration_capability_schema_revision_mismatch");
  }
  if (
    snapshot.schema_identity !== advertised.snapshot_schema_identity ||
    snapshot.catalog.schema_identity !== advertised.catalog_schema_identity ||
    snapshot.catalog.catalog_revision !== advertised.catalog_revision ||
    snapshot.catalog.contract_package_revision !== advertised.contract_package_revision
  ) {
    throw contractError("agent_orchestration_capability_binding_mismatch");
  }
  return snapshot;
}

export async function getAgentOrchestrationCapabilitySnapshot(
  manifest: ApiManifestResponse,
): Promise<AgentOrchestrationCapabilitySnapshotResponse> {
  advertisedContract(manifest);
  const { payload, schemaSetRevision } = await apiRequestWithMetadata<AgentOrchestrationCapabilitySnapshotResponse>(
    "/agent/orchestration-capabilities",
  );
  return validateAgentOrchestrationCapabilitySnapshot(payload, manifest, schemaSetRevision);
}
