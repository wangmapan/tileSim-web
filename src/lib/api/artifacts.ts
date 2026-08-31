import { bridgePaths } from "../../contracts/generated/bridge-client";
import { losslessIntegerToBigInt, parseJsonLossless } from "../../contracts/lossless-json";
import type { ArtifactManifestEntry, ArtifactManifestResponse } from "../../contracts/bridge-api";
import { BridgeApiError } from "./errors";
import { t } from "../../i18n";
import { generatedBridgeClient } from "./client";
import { apiRoots, isRecord, rawJsonBytesRequest, rawJsonTextRequest } from "./transport";
import { SUPPORTED_BRIDGE_API_VERSION } from "./manifest";

export async function getArtifactManifest(runId: string, expectedRevision?: string): Promise<ArtifactManifestResponse> {
  const manifest = (await generatedBridgeClient.getArtifactManifest(runId)) as unknown as ArtifactManifestResponse;
  if (
    manifest.schema_version !== "tilesim.bridge.artifact_manifest.v2" ||
    manifest.api_version !== SUPPORTED_BRIDGE_API_VERSION ||
    typeof manifest.schema_set_revision !== "string" ||
    !manifest.schema_set_revision.startsWith("sha256:")
  ) {
    throw new BridgeApiError(t("运行工件清单使用了不受支持的契约。"), {
      status: 0,
      code: "unsupported_artifact_manifest",
      retryable: false,
    });
  }
  if (manifest.run_id !== runId) {
    throw new BridgeApiError(t("运行工件清单与请求的 run ID 不一致。"), {
      status: 0,
      code: "artifact_manifest_run_mismatch",
      retryable: false,
    });
  }
  if (expectedRevision && manifest.schema_set_revision !== expectedRevision) {
    throw new BridgeApiError(t("运行工件清单与当前 Bridge schema-set revision 不一致。"), {
      status: 0,
      code: "schema_set_revision_mismatch",
      retryable: false,
    });
  }
  validateArtifactEntries(manifest);
  return manifest;
}

interface ArtifactContract {
  fileName: string;
  reportKind: string | null;
  schemaIdentities?: string[];
  requiresRunBinding?: boolean;
  runBindingExemptSchemaIdentities?: string[];
}

const artifactContracts: Record<string, ArtifactContract> = {
  "input-runtime-trace": { fileName: "input-runtime-trace.json", reportKind: null },
  "input-topology": {
    fileName: "input-topology.json",
    reportKind: null,
    schemaIdentities: ["tilesim.s6_topology_input.v1"],
    requiresRunBinding: true,
  },
  "input-design-space-candidates": { fileName: "input-design-space-candidates.json", reportKind: null },
  "run-result": {
    fileName: "run-result.json",
    reportKind: "run",
    schemaIdentities: ["wind_tunnel.run.v1alpha1"],
    requiresRunBinding: true,
  },
  metrics: {
    fileName: "metrics.json",
    reportKind: "metrics",
    schemaIdentities: ["tilesim.metrics_report.v1"],
    requiresRunBinding: true,
  },
  validation: {
    fileName: "validation.json",
    reportKind: "validation",
    schemaIdentities: ["tilesim.validation_report.v1"],
    requiresRunBinding: true,
  },
  "tail-cause-chain": {
    fileName: "tail-cause-chain.json",
    reportKind: "tail",
    schemaIdentities: ["tilesim.tail_cause_chain_report.v1"],
    requiresRunBinding: true,
  },
  "design-space": {
    fileName: "design-space.json",
    reportKind: "design_space",
    schemaIdentities: ["design_space.report.v1alpha1", "tilesim.design_space_report.v1"],
    requiresRunBinding: true,
    runBindingExemptSchemaIdentities: ["design_space.report.v1alpha1"],
  },
  "execution-envelope": {
    fileName: "execution-envelope.json",
    reportKind: "execution_envelope",
    schemaIdentities: ["tilesim.s7_execution_envelope.v1"],
    requiresRunBinding: true,
  },
  "week8-run-evidence": {
    fileName: "week8-run-evidence.json",
    reportKind: "run_bound_des_evidence",
    schemaIdentities: ["tilesim.s7_run_bound_des_evidence.v1"],
    requiresRunBinding: true,
  },
};

function failIdentity(code: string, message: string): never {
  throw new BridgeApiError(t(message), { status: 0, code, retryable: false });
}

function validateArtifactEntries(manifest: ArtifactManifestResponse) {
  if (!Array.isArray(manifest.artifacts) || !Array.isArray(manifest.rejected_artifacts)) {
    failIdentity("invalid_artifact_manifest", "运行工件清单缺少有效的 artifacts/rejected_artifacts 数组。");
  }
  const ids = new Set<string>();
  for (const entry of manifest.artifacts) {
    const contract = artifactContracts[entry.artifact_id];
    if (!contract || ids.has(entry.artifact_id)) {
      failIdentity("ambiguous_artifact_identity", "运行工件清单包含未知或重复的 artifact ID。");
    }
    ids.add(entry.artifact_id);
    if (
      entry.file_name !== contract.fileName ||
      entry.report_kind !== contract.reportKind ||
      entry.media_type !== "application/json" ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      !["supported", "legacy_compatibility", "not_applicable"].includes(entry.contract_status)
    ) {
      failIdentity("artifact_identity_mismatch", "运行工件清单中的文件名、类型或 SHA-256 身份无效。");
    }
    try {
      if (losslessIntegerToBigInt(entry.bytes) < 0n) throw new TypeError();
    } catch {
      failIdentity("artifact_byte_count_invalid", "运行工件清单中的字节数不是无损非负整数。");
    }
    if (
      entry.contract_status === "supported" &&
      contract.schemaIdentities &&
      !contract.schemaIdentities.includes(entry.schema_identity)
    ) {
      failIdentity("artifact_schema_identity_mismatch", "运行工件清单中的 schema identity 与固定契约不一致。");
    }
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new BridgeApiError(t("当前浏览器无法校验运行工件哈希。"), {
      status: 0,
      code: "artifact_hash_unavailable",
      retryable: false,
    });
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function artifactSchemaIdentity(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.contract_version === "string") return value.contract_version;
  return typeof value.schema_version === "string" ? value.schema_version : "";
}

export async function getVerifiedArtifactText(runId: string, entry: ArtifactManifestEntry): Promise<string> {
  const bytes = await rawJsonBytesRequest(bridgePaths.getArtifact(runId, entry.artifact_id));
  if (BigInt(bytes.byteLength) !== losslessIntegerToBigInt(entry.bytes)) {
    throw new BridgeApiError(t("运行工件 {artifact} 的字节数与清单不一致。", { artifact: entry.artifact_id }), {
      status: 0,
      code: "artifact_byte_count_mismatch",
      retryable: false,
    });
  }
  const actualHash = await sha256Hex(bytes);
  if (actualHash !== entry.sha256.toLowerCase()) {
    throw new BridgeApiError(t("运行工件 {artifact} 的 SHA-256 与清单不一致。", { artifact: entry.artifact_id }), {
      status: 0,
      code: "artifact_hash_mismatch",
      retryable: false,
    });
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BridgeApiError(t("本地服务返回了无效的 UTF-8 JSON 工件。"), {
      status: 0,
      code: "invalid_artifact_encoding",
      retryable: false,
    });
  }
}

export async function getVerifiedArtifact(runId: string, entry: ArtifactManifestEntry): Promise<unknown> {
  const text = await getVerifiedArtifactText(runId, entry);
  const value = parseJsonLossless(text);
  if (artifactSchemaIdentity(value) !== entry.schema_identity) {
    throw new BridgeApiError(
      t("运行工件 {artifact} 的 schema identity 与清单不一致。", { artifact: entry.artifact_id }),
      {
        status: 0,
        code: "artifact_schema_identity_mismatch",
        retryable: false,
      },
    );
  }
  const contract = artifactContracts[entry.artifact_id];
  if (
    contract?.requiresRunBinding &&
    !contract.runBindingExemptSchemaIdentities?.includes(entry.schema_identity) &&
    entry.contract_status === "supported"
  ) {
    const artifactRunId = isRecord(value)
      ? typeof value.run_id === "string"
        ? value.run_id
        : isRecord(value.summary) && typeof value.summary.run_id === "string"
          ? value.summary.run_id
          : ""
      : "";
    if (artifactRunId !== runId) {
      throw new BridgeApiError(t("运行工件 {artifact} 的 run ID 与当前运行不一致。", { artifact: entry.artifact_id }), {
        status: 0,
        code: "artifact_run_binding_mismatch",
        retryable: false,
      });
    }
  }
  return value;
}

export function getArtifactText(runId: string, artifactId: string): Promise<string> {
  return rawJsonTextRequest(bridgePaths.getArtifact(runId, artifactId));
}

export async function getVerifiedReports(runId: string, manifest: ArtifactManifestResponse) {
  const reports: Record<string, unknown> = {};
  await Promise.all(
    manifest.artifacts
      .filter((entry) => entry.report_kind && entry.contract_status !== "not_applicable")
      .map(async (entry) => {
        reports[entry.report_kind as string] = await getVerifiedArtifact(runId, entry);
      }),
  );
  return { run_id: runId, reports };
}

export function rawArtifactUrl(runId: string, artifact: string): string {
  const root = ["5173", "4173"].includes(window.location.port) ? "/api" : apiRoots()[0];
  return `${root}${bridgePaths.getArtifact(runId, artifact)}`;
}
