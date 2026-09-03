import type {
  ApiManifestResponse,
  TracePackageCatalogResponse,
  TracePackageInspectResponse,
} from "../../contracts/bridge-api";
import { t } from "../../i18n";
import { bridgePaths } from "../../contracts/generated/bridge-client";
import { BridgeApiError } from "./errors";
import { apiRequestWithMetadata } from "./transport";

const revisionPattern = /^sha256:[0-9a-f]{64}$/;

function validateBinding(
  payload: TracePackageCatalogResponse | TracePackageInspectResponse,
  responseRevision: string,
  manifest: ApiManifestResponse,
  expectedSchema: string,
) {
  if (
    payload.schema_version !== expectedSchema ||
    payload.trace_package_schema_identity !== "tilesim.trace_package.v1alpha1" ||
    !revisionPattern.test(payload.schema_set_revision) ||
    payload.schema_set_revision !== manifest.schema_set_revision ||
    responseRevision !== manifest.schema_set_revision
  ) {
    throw new BridgeApiError(t("Trace package 契约身份或 schema revision 不一致。"), {
      status: 0,
      code: "trace_package_contract_mismatch",
      retryable: false,
    });
  }
}

export async function getTracePackageCatalog(manifest: ApiManifestResponse): Promise<TracePackageCatalogResponse> {
  const { payload, schemaSetRevision } = await apiRequestWithMetadata<TracePackageCatalogResponse>(
    bridgePaths.tracePackages(),
  );
  validateBinding(payload, schemaSetRevision, manifest, "tilesim.bridge.trace_package_catalog.v1");
  return payload;
}

export async function postTracePackageInspect(
  packageId: string,
  manifest: ApiManifestResponse,
): Promise<TracePackageInspectResponse> {
  const { payload, schemaSetRevision } = await apiRequestWithMetadata<TracePackageInspectResponse>(
    bridgePaths.inspectTracePackage(packageId),
    { method: "POST" },
  );
  validateBinding(payload, schemaSetRevision, manifest, "tilesim.bridge.trace_package_inspect.v1");
  if (payload.package.package_id !== packageId) {
    throw new BridgeApiError(t("Trace package 检查结果与所选 package ID 不一致。"), {
      status: 0,
      code: "trace_package_id_mismatch",
      retryable: false,
    });
  }
  return payload;
}
