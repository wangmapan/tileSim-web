import {
  fixtureProjection,
  projectWorkflowEvents,
  type AgentHarnessProjection,
  type AgentOperation,
  type AgentOperationState,
  type WorkflowEvent,
  type WorkflowProjection,
} from "./agent-harness-contract";

export interface AgentHarnessFixtureDocument {
  source: "fixture";
  publication_status: "proposal_non_published";
  operations: readonly AgentOperation[];
  events: readonly WorkflowEvent[];
}

export interface AgentHarnessFixtureAdapter {
  getOperation(operationId: string): AgentOperation | null;
  projectOperation(operationId: string): AgentHarnessProjection;
  projectEvents(operationId: string): WorkflowProjection;
}

/**
 * Read-only adapter for component/unit tests. It has no write method and does
 * not use localStorage, a service worker, a queue, or the Bridge run API.
 */
export function createAgentHarnessFixtureAdapter(document: AgentHarnessFixtureDocument): AgentHarnessFixtureAdapter {
  const operations = new Map(document.operations.map((operation) => [operation.operation_id, operation]));
  const eventsByOperation = new Map<string, WorkflowEvent[]>();
  for (const event of document.events) {
    const events = eventsByOperation.get(event.operation_id) ?? [];
    events.push(event);
    eventsByOperation.set(event.operation_id, events);
  }

  function getOperation(operationId: string) {
    return operations.get(operationId) ?? null;
  }

  function projectEvents(operationId: string): WorkflowProjection {
    const operation = getOperation(operationId);
    const events = eventsByOperation.get(operationId) ?? [];
    return projectWorkflowEvents(events, events.length ? "draft" : (operation?.state ?? "draft"));
  }

  function projectOperation(operationId: string): AgentHarnessProjection {
    const operation = getOperation(operationId);
    if (!operation) {
      return {
        source: "fixture",
        publication_status: "proposal_non_published",
        availability: "not_exposed",
        state: null,
        operation_id: null,
        turn_id: null,
        run_id: null,
        snapshot_digest: null,
        event_count: 0,
        duplicate_event_ids: [],
        rejected_event_ids: [],
        stale_reason: null,
        error: null,
      };
    }
    return fixtureProjection(projectEvents(operationId), operation.operation_id);
  }

  return { getOperation, projectOperation, projectEvents };
}

export function operationStateForDisplay(
  operation: Pick<AgentOperation, "state" | "availability"> | null,
): AgentOperationState | "unavailable" | "not_exposed" {
  if (!operation) return "not_exposed";
  if (operation.availability === "unavailable" || operation.availability === "not_exposed")
    return operation.availability;
  return operation.state;
}
