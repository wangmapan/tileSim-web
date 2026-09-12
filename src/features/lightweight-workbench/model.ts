import type {
  AgentTypedBlock,
  DraftField,
  PageContextEnvelope,
  Phase1CapabilityProjection,
} from "../../entities/agent-orchestration";

export type WorkbenchMode = "professional" | "lightweight";

export const WORKBENCH_MODE_STORAGE_KEY = "tilesim-web.workbench-mode.v1";

const WORKBENCH_QUERY_KEYS = ["run", "artifact_sha256", "schema_set_revision", "from"] as const;

function firstQueryString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function preserveWorkbenchQuery(query: Record<string, unknown>): Record<string, string> {
  const carried: Record<string, string> = {};
  const run = firstQueryString(query.run);
  if (run && /^run-[\w-]+$/.test(run)) carried.run = run;
  for (const key of WORKBENCH_QUERY_KEYS.slice(1)) {
    const value = firstQueryString(query[key]);
    if (value) carried[key] = value;
  }
  return carried;
}

export type LightweightResultStatus =
  "idle" | "draft" | "clarification_required" | "unsupported" | "unknown" | "validation_error" | "stale" | "error";

export interface LightweightFieldView {
  field_id: string;
  original_value: string | null;
  proposed_value: string;
  unit: string;
  source: DraftField["value_source"];
  validation: DraftField["validation_issues"];
  stale: boolean;
}

export interface LightweightAgentViewModel {
  status: LightweightResultStatus;
  summary: string;
  blocks: readonly AgentTypedBlock[];
  fields: readonly LightweightFieldView[];
  missing: readonly string[];
  limitations: readonly string[];
  context: PageContextEnvelope;
  capability: Phase1CapabilityProjection | null;
}

// Ephemeral handoff only; never serialized as conversation or draft storage.
let ephemeralResult: LightweightAgentViewModel | null = null;
export function rememberLightweightResult(result: LightweightAgentViewModel | null): void {
  ephemeralResult = result;
}
export function restoreLightweightResult(): LightweightAgentViewModel | null {
  return ephemeralResult;
}

export function readWorkbenchMode(): WorkbenchMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY);
    return value === "professional" || value === "lightweight" ? value : null;
  } catch {
    return null;
  }
}

export function persistWorkbenchMode(mode: WorkbenchMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKBENCH_MODE_STORAGE_KEY, mode);
  } catch {
    // Preferences are optional and must not block entry navigation.
  }
}

export function createLightweightContext(revision = `lightweight:${Date.now()}`): PageContextEnvelope {
  return {
    contract_revision: "tilesim.web.agent_orchestration.phase1.local.v1",
    page_id: "lightweight-workbench",
    route_name: "lightweight",
    context_revision: revision,
    workspace_ref: null,
    run_ref: null,
    selected_entity: null,
    resources: [],
    supported_actions: ["explain", "configure_current_subset", "check_capability"],
    data_classification: "public",
    allowed_purposes: ["explain", "draft"],
    expires_at: null,
    display_label: "轻量工作台",
    availability: "available",
  };
}

export const LIGHTWEIGHT_LIMITATIONS = [
  "当前仅支持八个正式参数字段的单轮草案。",
  "模型、设备、卡数、TP/PP/EP、物理 KV、SLO 和工作负载模板尚未开放。",
  "不会创建正式运行、调用 Provider 或保存完整对话。",
] as const;
