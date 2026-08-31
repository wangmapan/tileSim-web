import type { ApiManifestResponse, ExperimentDescriptorResponse } from "../../contracts/bridge-api";
import { experimentDescriptor as validateExperimentDescriptorSchema } from "../../contracts/generated/experiment-validators.js";
import { t } from "../../i18n";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata, isRecord } from "./transport";

const revisionPattern = /^sha256:[0-9a-f]{64}$/;

function contractError(code: string, detail: string): BridgeApiError {
  return new BridgeApiError(t("F8 实验契约不可用：{detail}", { detail }), {
    status: 0,
    code,
    retryable: false,
  });
}

export async function getExperimentDescriptor(manifest: ApiManifestResponse): Promise<ExperimentDescriptorResponse> {
  const manifestRecord = manifest as unknown as Record<string, unknown>;
  const advertised = isRecord(manifestRecord.experiment_descriptor) ? manifestRecord.experiment_descriptor : null;
  if (manifest.legacy_unversioned === true || !advertised) {
    throw contractError("experiment_descriptor_unavailable", "experiment_descriptor_unavailable");
  }
  if (
    advertised.endpoint !== "GET /api/experiment-schema" ||
    advertised.schema_identity !== "tilesim.bridge.experiment_descriptor.v1" ||
    advertised.create_run_schema_identity !== "tilesim.bridge.create_run_request.v1"
  ) {
    throw contractError("experiment_descriptor_identity_mismatch", "experiment_descriptor_identity_mismatch");
  }

  const { payload, schemaSetRevision } =
    await apiRequestWithMetadata<ExperimentDescriptorResponse>("/experiment-schema");
  if (!validateExperimentDescriptorSchema(payload)) {
    throw contractError("invalid_experiment_descriptor", "invalid_experiment_descriptor");
  }
  if (
    !revisionPattern.test(schemaSetRevision) ||
    payload.schema_set_revision !== manifest.schema_set_revision ||
    schemaSetRevision !== manifest.schema_set_revision
  ) {
    throw contractError("experiment_schema_revision_mismatch", "experiment_schema_revision_mismatch");
  }
  if (
    payload.schema_version !== advertised.schema_identity ||
    payload.create_run_schema_identity !== advertised.create_run_schema_identity ||
    !revisionPattern.test(payload.descriptor_revision)
  ) {
    throw contractError("experiment_descriptor_identity_mismatch", "experiment_descriptor_identity_mismatch");
  }
  return payload;
}
