import type {
  AgentHarnessExplorationAuthorization,
  AgentHarnessExplorationBudget,
  AgentHarnessExplorationCandidate,
  AgentHarnessExplorationEvent,
  AgentHarnessExplorationSession,
  AgentHarnessExplorationStopReason,
} from "../../contracts/generated/agent-harness";

export type ExplorationDetail = {
  session: AgentHarnessExplorationSession;
  candidate: AgentHarnessExplorationCandidate | null;
  evaluation?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  events?: AgentHarnessExplorationEvent[];
};
export type ExplorationResponse = {
  session: AgentHarnessExplorationSession;
  detail: ExplorationDetail;
  provenance: Record<string, unknown>;
};
export type ExplorationAuthorizationResponse = ExplorationResponse & {
  authorization: AgentHarnessExplorationAuthorization;
  autonomous_started: boolean;
  idempotent_replay?: boolean;
};
export type ExplorationCreateRequest = {
  context: Record<string, unknown>;
  objective?: {
    metric_path: string;
    direction: "minimize" | "maximize";
    minimum_improvement?: number;
    plateau_rounds?: number;
  };
  parameter_grants: Array<{ pointer: string; min: number; max: number; step: number; kind?: string }>;
  base_config: Record<string, unknown>;
  run_request?: Record<string, unknown>;
  budget?: Partial<AgentHarnessExplorationBudget>;
  session_id?: string;
  /** A user-confirmed deployment exploration plan. This is never accepted from model prose. */
  planning_plan?: Record<string, unknown>;
};
export type ExplorationPlanningRequest = { context: Record<string, unknown>; request?: Record<string, unknown> };
export type ExplorationPlanningResponse = {
  plan: Record<string, unknown>;
  provenance: Record<string, unknown>;
  side_effects: { run_created: false; slot_claimed: false; executor_called: false; page_locked: false };
};
/** Read-only planning state rendered before an exploration session exists. */
export type ExplorationPlanningState = {
  plan: Record<string, unknown>;
  request?: ExplorationCreateRequest | null;
  instruction?: string;
};
export type ExplorationStopReason = AgentHarnessExplorationStopReason | null;

export const EXPLORATION_TERMINAL_STATES = [
  "completed",
  "cancelled",
  "parameter_validation_failed",
  "run_failed",
  "authorization_expired",
  "authorization_revoked",
  "budget_exhausted",
  "context_expired",
  "recovery_required",
  "manual_intervention_required",
] as const;
export type ExplorationState =
  | "waiting_authorization"
  | "exploring"
  | "waiting_run"
  | "comparing"
  | "paused"
  | (typeof EXPLORATION_TERMINAL_STATES)[number];
export const EXPLORATION_ACTIVE_STATES = ["exploring", "waiting_run", "comparing", "paused"] as const;
export function isExplorationActiveState(value: unknown): value is (typeof EXPLORATION_ACTIVE_STATES)[number] {
  return typeof value === "string" && (EXPLORATION_ACTIVE_STATES as readonly string[]).includes(value);
}
export function isExplorationTerminalState(value: unknown): value is (typeof EXPLORATION_TERMINAL_STATES)[number] {
  return typeof value === "string" && (EXPLORATION_TERMINAL_STATES as readonly string[]).includes(value);
}
