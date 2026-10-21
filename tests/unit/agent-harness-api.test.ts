import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_CONTRACT_REVISION,
  AGENT_HARNESS_SCHEMA_SET_REVISION,
  callAgentHarnessReadOnlyTool,
  executeAgentHarnessReadOnlyTool,
  getAgentHarnessCapabilities,
  getAgentHarnessOperations,
  getAgentHarnessOperationSnapshots,
  observeAgentHarnessOperation,
  getAgentHarnessToolCatalog,
  projectAgentHarnessEvents,
  type AgentHarnessOperation,
  type AgentHarnessWorkflowEvent,
} from "../../src/lib/api/agent-harness";

const backendIdentity = { backend_revision: "backend-test", source_revision: "source-test" };
const headers = {
  "content-type": "application/json",
  "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
  "x-tilesim-schema-set-revision": AGENT_HARNESS_SCHEMA_SET_REVISION,
};

function response(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...headers, ...extraHeaders } });
}

function operation(state: AgentHarnessOperation["workflow_state"] = "running"): AgentHarnessOperation {
  return {
    schema_identity: "tilesim.agent_harness.agent_operation.v1",
    contract_revision: AGENT_HARNESS_CONTRACT_REVISION,
    operation_id: "op-test",
    turn_id: "turn-test",
    run_id: "run-test",
    snapshot_digest: "sha256:snapshot",
    workflow_state: state,
    schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
    policy_revision: "tilesim.agent_harness.policy.v1",
    backend_identity: backendIdentity,
    created_at: "2026-10-17T00:00:00Z",
    updated_at: "2026-10-17T00:00:00Z",
    idempotency_key: "harness-test",
    request_digest: "sha256:request",
    principal: "local-user",
    operation_kind: "read_only",
    queue_delay_ms: 0,
    attempt_count: 1,
    checkpoint_id: null,
    last_error: null,
    cancellation_fence: null,
    lease: {},
    retention: {},
  };
}

function event(
  sequence: number,
  state: AgentHarnessWorkflowEvent["workflow_state"],
  id = `event-${sequence}`,
): AgentHarnessWorkflowEvent {
  return {
    schema_identity: "tilesim.agent_harness.workflow_event.v1",
    contract_revision: AGENT_HARNESS_CONTRACT_REVISION,
    operation_id: "op-test",
    turn_id: "turn-test",
    run_id: "run-test",
    snapshot_digest: "sha256:snapshot",
    workflow_state: state,
    schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
    policy_revision: "tilesim.agent_harness.policy.v1",
    backend_identity: backendIdentity,
    created_at: "2026-10-17T00:00:00Z",
    updated_at: "2026-10-17T00:00:00Z",
    event_id: id,
    sequence,
    parent_event_id: null,
    node: "worker",
    payload_digest: `sha256:${String(sequence).padStart(64, "0")}`,
    terminal: state === "completed" || state === "failed" || state === "cancelled",
    idempotency_key: "harness-test",
  };
}

function capability() {
  return {
    schema_identity: "tilesim.agent_harness.capability_snapshot.v1",
    contract_revision: AGENT_HARNESS_CONTRACT_REVISION,
    schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
    policy_revision: "tilesim.agent_harness.policy.v1",
    backend_identity: backendIdentity,
    durable_store: { kind: "sqlite_wal" },
    workflow_states: ["queued", "running", "completed"],
    tools: ["get_capability_catalog", "get_run_status", "list_run_evidence", "query_verified_metrics"].map(
      (tool_name) => ({
        tool_name,
        tool_revision: "1",
        required_scope: tool_name === "get_capability_catalog" ? "agent:read_capability" : "agent:read_run",
        timeout_ms: 2000,
        retryable: true,
        description: "read-only",
        input_schema: { type: "object" },
        output_schema: { type: "object" },
        permission: {
          allow_shell: false,
          allow_arbitrary_path: false,
          allow_arbitrary_url: false,
          allow_network: false,
        },
      }),
    ),
    write_tools: [],
    autonomous_optimization: false,
    provider_acceptance: "live_acceptance_pending",
  };
}

describe("formal Agent Harness v1 read-only adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { port: "5173" } });
    vi.restoreAllMocks();
  });

  it("validates capability identity, revision and closed read-only surface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(capability()));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAgentHarnessCapabilities()).resolves.toMatchObject({
      schema_identity: "tilesim.agent_harness.capability_snapshot.v1",
      write_tools: [],
      autonomous_optimization: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/harness-capabilities", expect.anything());
  });

  it("validates the read-only operation list before exposing task-center data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ operations: [operation("queued")] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAgentHarnessOperations()).resolves.toMatchObject([
      { operation_id: "op-test", workflow_state: "queued" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/operations", expect.anything());
  });

  it("filters the operation list before reading durable event snapshots", async () => {
    const selected = { ...operation("running"), run_id: "run-selected" };
    const other = { ...operation("running"), operation_id: "op-other", turn_id: "turn-other", run_id: "run-other" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ operations: [selected, other] }))
      .mockResolvedValueOnce(
        response({
          operation: selected,
          events: [
            { ...event(1, "queued"), run_id: selected.run_id },
            { ...event(2, "running"), run_id: selected.run_id },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const snapshots = await getAgentHarnessOperationSnapshots("run-selected");

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].operation.operation_id).toBe("op-test");
    expect(snapshots[0].projection?.events).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/agent/operations/op-test");
  });

  it("fails closed on schema-set and backend identity drift", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ...capability(), schema_set_revision: "sha256:stale" })),
    );
    await expect(getAgentHarnessCapabilities()).rejects.toMatchObject({ code: "schema_revision_mismatch" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          schema_identity: "tilesim.agent_harness.tool_catalog.v1",
          contract_revision: "2026-10-17.tools.v1",
          schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
          backend_identity: { backend_revision: "other" },
          tools: [],
          write_tools: [],
        }),
      ),
    );
    await expect(getAgentHarnessToolCatalog(backendIdentity)).rejects.toMatchObject({
      code: "backend_identity_mismatch",
    });
  });

  it("projects duplicate, out-of-order and late events without rewinding terminal state", () => {
    const projection = projectAgentHarnessEvents(
      [
        event(1, "queued"),
        event(2, "running"),
        event(2, "running", "duplicate-id"),
        event(3, "completed"),
        event(4, "running"),
      ],
      operation("running"),
    );
    expect(projection.state).toBe("recovery_required");
    expect(projection.requires_recovery).toBe(true);
    expect(projection.late_event_ids).toContain("event-4");
  });

  it("requires recovery when an event sequence has a gap", () => {
    const projection = projectAgentHarnessEvents([event(1, "queued"), event(3, "running")], operation("running"));
    expect(projection.state).toBe("recovery_required");
    expect(projection.rejected_event_ids).toContain("event-3");
  });

  it("rejects events bound to another run instead of displaying them", () => {
    const foreign = { ...event(1, "running", "foreign"), run_id: "run-other" };
    const projection = projectAgentHarnessEvents([foreign], operation("running"));
    expect(projection.state).toBe("recovery_required");
    expect(projection.events).toHaveLength(0);
    expect(projection.rejected_event_ids).toContain("foreign");
  });

  it("keeps rejected, retryable and unknown outcomes distinct", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      response({
        operation: operation("completed"),
        tool_result: {
          schema_identity: "tilesim.agent_harness.tool_result.v1",
          contract_revision: AGENT_HARNESS_CONTRACT_REVISION,
          operation_id: "op-test",
          turn_id: "turn-test",
          run_id: "run-test",
          snapshot_digest: "sha256:snapshot",
          workflow_state: "completed",
          schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
          policy_revision: "tilesim.agent_harness.policy.v1",
          backend_identity: backendIdentity,
          created_at: "2026-10-17T00:00:00Z",
          updated_at: "2026-10-17T00:00:00Z",
          tool_call_id: "call-test",
          tool_name: "get_run_status",
          tool_revision: "1",
          outcome: "unknown_outcome",
          output_digest: null,
          retryable: false,
          terminal_failure: false,
          unknown_outcome: true,
          error_code: "tool_unknown_outcome",
          field_path: null,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await callAgentHarnessReadOnlyTool("op-test", "get_run_status", {
      run_id: "run-test",
      snapshot_digest: "sha256:snapshot",
    });
    expect(result.outcome).toBe("unknown_outcome");
    expect(result.status).toBe("unknown_outcome");
    expect(result.error?.code).toBe("tool_unknown_outcome");
  });

  it("rejects unknown scope and does not issue a write-tool request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await callAgentHarnessReadOnlyTool("op-test", "get_run_status", {
      run_id: "run-test",
      scope: "agent:submit",
    });
    expect(result.outcome).toBe("rejected");
    expect(result.error?.code).toBe("tool_scope_denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a read-only operation and calls one allow-listed tool without exposing writes", async () => {
    const op = { ...operation("running"), run_id: null, snapshot_digest: null };
    const result = {
      schema_identity: "tilesim.agent_harness.tool_result.v1",
      contract_revision: AGENT_HARNESS_CONTRACT_REVISION,
      operation_id: op.operation_id,
      turn_id: op.turn_id,
      run_id: op.run_id,
      snapshot_digest: op.snapshot_digest,
      workflow_state: "completed",
      schema_set_revision: AGENT_HARNESS_SCHEMA_SET_REVISION,
      policy_revision: op.policy_revision,
      backend_identity: backendIdentity,
      created_at: op.created_at,
      updated_at: op.updated_at,
      tool_call_id: "call-test",
      tool_name: "get_capability_catalog",
      tool_revision: "1",
      outcome: "succeeded",
      output_digest: "sha256:output",
      retryable: false,
      terminal_failure: false,
      unknown_outcome: false,
      error_code: null,
      field_path: null,
      result: capability(),
      replayed: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ operation: op, idempotent_replay: false }, 202))
      .mockResolvedValueOnce(response({ operation: { ...op, workflow_state: "completed" }, tool_result: result }));
    vi.stubGlobal("fetch", fetchMock);
    const invocation = await executeAgentHarnessReadOnlyTool("get_capability_catalog");
    expect(invocation.outcome).toBe("succeeded");
    expect(invocation.operation?.operation_id).toBe("op-test");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tool_name).toBe("get_capability_catalog");
  });

  it("falls back from a disconnected SSE stream to durable polling with Last-Event-ID", async () => {
    const running = operation("running");
    const completed = { ...running, workflow_state: "completed" as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ operation: running, events: [event(1, "queued"), event(2, "running")] }))
      .mockResolvedValueOnce(response({ error: { code: "stream_down", message: "offline", retryable: true } }, 503))
      .mockResolvedValueOnce(response({ operation: completed, events: [event(3, "completed")] }));
    vi.stubGlobal("fetch", fetchMock);
    const projection = await observeAgentHarnessOperation("op-test", { maxPollAttempts: 1, preferSse: true });
    expect(projection.state).toBe("completed");
    expect(projection.source).toBe("polling");
    expect(fetchMock.mock.calls[2][1].headers["Last-Event-ID"]).toBe("2");
  });
});
