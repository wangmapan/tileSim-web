import { queryClient } from "../../lib/query-client";
import { bridgeApi } from "../../lib/api";
import { BridgeApiError } from "../../lib/api";

function backendIdentity(health: Record<string, unknown>): string {
  return [
    health.source_revision,
    health.build_revision,
    health.source_state_digest,
    health.build_state_digest,
    health.deployment_ref,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
}

export async function fetchBridgeBootstrap({ refresh = false } = {}) {
  if (refresh) await queryClient.invalidateQueries({ queryKey: ["bridge", "bootstrap"] });
  return queryClient.fetchQuery({
    queryKey: ["bridge", "bootstrap"],
    staleTime: refresh ? 0 : 15_000,
    queryFn: async () => {
      const manifest = await bridgeApi.manifest();
      const [health, catalog, capabilities] = await Promise.all([
        bridgeApi.health(),
        bridgeApi.catalog(),
        bridgeApi.capabilities(),
      ]);
      const manifestRecord = manifest as unknown as Record<string, unknown>;
      if (manifest.legacy_unversioned === true) {
        return {
          manifest,
          health,
          catalog,
          capabilities,
          experimentDescriptor: null,
          experimentDescriptorStatus: "legacy_compatibility" as const,
          experimentDescriptorError: "experiment_descriptor_unavailable",
          evidenceAgentDescriptor: null,
          evidenceAgentDescriptorStatus: "legacy_compatibility" as const,
          evidenceAgentDescriptorError: "evidence_agent_unavailable",
        };
      }
      const identity = backendIdentity(health as unknown as Record<string, unknown>);
      const experimentDescriptorResult = manifestRecord.experiment_descriptor
        ? await queryClient
            .fetchQuery({
              queryKey: ["bridge", "experiment-schema", identity, manifest.schema_set_revision],
              staleTime: refresh ? 0 : 15_000,
              queryFn: () => bridgeApi.experimentSchema(manifest),
            })
            .then((descriptor) => ({ descriptor, status: "supported" as const, error: "" }))
            .catch((error) => ({
              descriptor: null,
              status: "contract_error" as const,
              error: error instanceof BridgeApiError ? error.code : "experiment_descriptor_fetch_failed",
            }))
        : {
            descriptor: null,
            status: "contract_error" as const,
            error: "experiment_descriptor_unavailable",
          };
      const evidenceAgentDescriptorResult = manifestRecord.evidence_agent
        ? await queryClient
            .fetchQuery({
              queryKey: ["bridge", "evidence-agent-capabilities", identity, manifest.schema_set_revision],
              staleTime: refresh ? 0 : 15_000,
              queryFn: () => bridgeApi.evidenceAgentCapabilities(manifest),
            })
            .then((descriptor) => ({ descriptor, status: "supported" as const, error: "" }))
            .catch((error) => ({
              descriptor: null,
              status: "contract_error" as const,
              error: error instanceof BridgeApiError ? error.code : "evidence_agent_descriptor_fetch_failed",
            }))
        : {
            descriptor: null,
            status: "contract_error" as const,
            error: "evidence_agent_unavailable",
          };
      return {
        manifest,
        health,
        catalog,
        capabilities,
        experimentDescriptor: experimentDescriptorResult.descriptor,
        experimentDescriptorStatus: experimentDescriptorResult.status,
        experimentDescriptorError: experimentDescriptorResult.error,
        evidenceAgentDescriptor: evidenceAgentDescriptorResult.descriptor,
        evidenceAgentDescriptorStatus: evidenceAgentDescriptorResult.status,
        evidenceAgentDescriptorError: evidenceAgentDescriptorResult.error,
      };
    },
  });
}
