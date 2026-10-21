import type {
  AgentHarnessApprovalV2,
  AgentHarnessDraftValidationReportV1,
  AgentHarnessExperimentDraftV2,
  AgentHarnessOperation,
  AgentHarnessOperationProjection,
  AgentHarnessOperationSnapshot,
  AgentHarnessExecutionProjection,
} from "../../lib/api/agent-harness";
import type { AgentHarnessToolTimelineItem } from "./components/AgentHarnessToolTimeline.vue";
import type { AgentHarnessAvailability } from "../../entities/agent-orchestration";

export type AgentHarnessTaskControlAvailability = "not_exposed" | "unavailable";

export interface AgentHarnessTaskCenterItem {
  id: string;
  title: string;
  availability: AgentHarnessAvailability;
  projection: AgentHarnessOperationProjection | null;
  toolTimeline?: readonly AgentHarnessToolTimelineItem[];
  cancel: AgentHarnessTaskControlAvailability;
  approval: AgentHarnessTaskControlAvailability;
  unavailableReason?: string | null;
}

export interface AgentHarnessDraftTaskCenterItem {
  id: string;
  draft: AgentHarnessExperimentDraftV2;
  validation?: AgentHarnessDraftValidationReportV1 | null;
  approval?: AgentHarnessApprovalV2 | null;
  unavailableReason?: string | null;
}

export interface AgentHarnessExecutionTaskCenterItem {
  id: string;
  title?: string;
  projection: AgentHarnessExecutionProjection | null;
  result?: Record<string, unknown> | null;
  pendingAction?: "cancel" | "retry" | "resume" | null;
  unavailableReason?: string | null;
}

const stoppedWorkflowStates = new Set([
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "manual_intervention_required",
]);

/**
 * Polling is only a read refresh. It stops at terminal/recovery states so the
 * browser never turns a recovery boundary into an implicit resume loop.
 */
export function shouldRefreshAgentHarnessSnapshots(
  snapshots: readonly AgentHarnessOperationSnapshot[] | undefined,
): boolean {
  if (!snapshots) return true;
  if (!snapshots.length) return false;
  return snapshots.some((snapshot) => {
    if (snapshot.error) return true;
    if (snapshot.projection?.stale_reason || snapshot.projection?.requires_recovery) return false;
    const state = snapshot.projection?.state || snapshot.operation.workflow_state;
    return !stoppedWorkflowStates.has(state);
  });
}

/** Keep operation summaries bound to the currently selected run. */
export function filterAgentHarnessOperationsForRun(
  operations: readonly AgentHarnessOperation[],
  runId: string | null,
): AgentHarnessOperation[] {
  return operations.filter((operation) => operation.run_id === runId);
}
