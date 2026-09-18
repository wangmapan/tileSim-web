import type { ApiManifestResponse } from "../../contracts/bridge-api";
import { BridgeApiError } from "./errors";
import { t } from "../../i18n";
import { generatedBridgeClient } from "./client";

export const SUPPORTED_BRIDGE_API_VERSION = "tilesim.bridge.api.v1";

export async function getApiManifest(): Promise<ApiManifestResponse> {
  let manifest: ApiManifestResponse;
  try {
    manifest = await generatedBridgeClient.manifest();
  } catch (error) {
    if (error instanceof BridgeApiError && error.status === 404) {
      return {
        schema_version: "tilesim.bridge.manifest.legacy_unversioned",
        api_version: "tilesim.bridge.api.legacy_unversioned",
        schema_set_revision: "legacy:unversioned",
        error_schema_version: "",
        artifact_manifest_schema_version: "",
        known_report_schema_identities: {},
        endpoints: {},
        legacy_unversioned: true,
      };
    }
    throw error;
  }
  const compatible =
    manifest.schema_version === "tilesim.bridge.manifest.v1" &&
    manifest.api_version === SUPPORTED_BRIDGE_API_VERSION &&
    manifest.error_schema_version === "tilesim.bridge.error.v1" &&
    manifest.artifact_manifest_schema_version === "tilesim.bridge.artifact_manifest.v2" &&
    manifest.run_creation?.idempotency_header === "Idempotency-Key" &&
    manifest.run_creation.idempotency_required === true &&
    manifest.run_events?.resume_header === "Last-Event-ID" &&
    manifest.run_events.media_type === "text/event-stream" &&
    typeof manifest.schema_set_revision === "string" &&
    manifest.schema_set_revision.startsWith("sha256:");
  if (!compatible) {
    throw new BridgeApiError(t("不支持的 Bridge API 契约：{version}", { version: manifest.api_version || "unknown" }), {
      status: 0,
      code: "unsupported_api_contract",
      retryable: false,
    });
  }
  return manifest;
}
