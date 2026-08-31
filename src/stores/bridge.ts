import { reactive } from "vue";
import { defineStore } from "pinia";
import type { BridgeState } from "../entities/dashboard/types";
import type { EvidenceAgentDescriptorResponse, ExperimentDescriptorResponse } from "../contracts/bridge-api";

export const useBridgeStore = defineStore("bridge", () => {
  const bridge = reactive<BridgeState>({
    connected: false,
    available: false,
    checking: true,
    synchronized: false,
    title: "正在检查后端",
    detail: "正在读取独立运行环境",
    identity: null,
    manifest: null,
  });
  const catalog = reactive<Record<string, unknown> & { scenarios: unknown[]; fidelity_policies: string[] }>({
    scenarios: [],
    fidelity_policies: ["des", "default"],
  });
  const capabilities = reactive<
    Record<string, unknown> & {
      default_gpu_participation_mode: string;
      cycle_scope: string;
      dependencies: Record<string, unknown>;
      run_surface?: Record<string, unknown>;
    }
  >({
    default_gpu_participation_mode: "gpu_free",
    cycle_scope: "S6_hotspot_refinement_only",
    dependencies: {},
    run_surface: {},
  });

  const experiment = reactive<{
    descriptor: ExperimentDescriptorResponse | null;
    status: "supported" | "legacy_compatibility" | "contract_error";
    error: string;
  }>({
    descriptor: null,
    status: "legacy_compatibility",
    error: "experiment_descriptor_unavailable",
  });

  const evidenceAgent = reactive<{
    descriptor: EvidenceAgentDescriptorResponse | null;
    status: "supported" | "legacy_compatibility" | "contract_error";
    error: string;
  }>({
    descriptor: null,
    status: "contract_error",
    error: "evidence_agent_unavailable",
  });

  return { bridge, catalog, capabilities, experiment, evidenceAgent };
});
