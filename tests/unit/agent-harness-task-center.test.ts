import { describe, expect, it } from "vitest";
import {
  filterAgentHarnessOperationsForRun,
  shouldRefreshAgentHarnessSnapshots,
} from "../../src/features/agent-harness";
import type { AgentHarnessOperation, AgentHarnessOperationSnapshot } from "../../src/lib/api/agent-harness";

const operation = (runId: string | null, operationId: string): AgentHarnessOperation => ({
  schema_identity: "tilesim.agent_harness.agent_operation.v1",
  contract_revision: "2026-10-17.wpa.v1",
  operation_id: operationId,
  turn_id: `turn-${operationId}`,
  run_id: runId,
  snapshot_digest: null,
  workflow_state: "queued",
  schema_set_revision: "sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73",
  policy_revision: "tilesim.agent_harness.policy.v1",
  backend_identity: {},
  created_at: "2026-10-17T00:00:00Z",
  updated_at: "2026-10-17T00:00:00Z",
  idempotency_key: operationId,
  request_digest: `sha256:${operationId}`,
  principal: "local-user",
  operation_kind: "read_only",
  queue_delay_ms: 0,
  attempt_count: 0,
  checkpoint_id: null,
  last_error: null,
  cancellation_fence: null,
  lease: {},
  retention: {},
});

describe("Agent Harness task-center run binding", () => {
  it("does not mix operations from another run", () => {
    expect(
      filterAgentHarnessOperationsForRun(
        [operation("run-a", "op-a"), operation("run-b", "op-b"), operation(null, "op-global")],
        "run-a",
      ).map((item) => item.operation_id),
    ).toEqual(["op-a"]);
  });

  it("only shows run-unbound operations when no run is selected", () => {
    expect(
      filterAgentHarnessOperationsForRun([operation("run-a", "op-a"), operation(null, "op-global")], null).map(
        (item) => item.operation_id,
      ),
    ).toEqual(["op-global"]);
  });

  it("refreshes active snapshots but stops at terminal and recovery boundaries", () => {
    const snapshot = (state: AgentHarnessOperation["workflow_state"]): AgentHarnessOperationSnapshot => ({
      operation: { ...operation("run-a", `op-${state}`), workflow_state: state },
      projection: null,
      error: null,
    });

    expect(shouldRefreshAgentHarnessSnapshots(undefined)).toBe(true);
    expect(shouldRefreshAgentHarnessSnapshots([snapshot("queued")])).toBe(true);
    expect(shouldRefreshAgentHarnessSnapshots([snapshot("completed")])).toBe(false);
    expect(shouldRefreshAgentHarnessSnapshots([snapshot("recovery_required")])).toBe(false);
  });
});
