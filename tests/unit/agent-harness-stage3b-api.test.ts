import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  getAgentHarnessExecutionResult,
  mutateAgentHarnessExecution,
  observeAgentHarnessExecution,
  submitAgentHarnessExecution,
} from "../../src/lib/api/agent-harness";

const backend = { backend_revision: "local", source_revision: "local" };
const digest = (char = "a") => `sha256:${char.repeat(64)}`;
const headers = {
  "content-type": "application/json",
  "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
  "x-tilesim-schema-set-revision": AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
};
function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers });
}
function operation(state: string = "queued") {
  return {
    schema_identity: "tilesim.agent_harness.execution_operation.v1",
    contract_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
    execution_id: "execution-1",
    operation_id: "operation-1",
    draft_id: "draft-1",
    approval_id: "approval-1",
    validation_id: "validation-1",
    draft_digest: digest("b"),
    approval_digest: digest("c"),
    input_snapshot_digest: digest("d"),
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: backend,
    policy_revision: "tilesim.agent_harness.policy.v1",
    workflow_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
    idempotency_key: "execution-key",
    request_digest: digest("e"),
    principal: "local-user",
    workspace_id: "local-workspace",
    run_id: null,
    state,
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:00:00Z",
    attempt_count: 0,
    retryable: false,
    unknown_outcome: false,
    cancellation_fence: null,
    result: null,
    error: null,
  };
}
function genericOperation() {
  return {
    schema_identity: "tilesim.agent_harness.agent_operation.v1",
    contract_revision: "2026-10-17.wpa.v1",
    operation_id: "operation-1",
    turn_id: "turn-1",
    run_id: null,
    snapshot_digest: digest("d"),
    workflow_state: "queued",
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    policy_revision: "tilesim.agent_harness.policy.v1",
    backend_identity: backend,
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:00:00Z",
    idempotency_key: "execution-key",
    request_digest: digest("e"),
    principal: "local-user",
    operation_kind: "controlled_execution",
    queue_delay_ms: 0,
    attempt_count: 0,
    checkpoint_id: null,
    last_error: null,
    cancellation_fence: null,
    lease: {},
    retention: {},
  };
}
function event(sequence: number, state: string, terminal = false) {
  return {
    schema_identity: "tilesim.agent_harness.execution_event.v1",
    contract_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
    event_id: `event-${sequence}`,
    sequence,
    operation_id: "operation-1",
    execution_id: "execution-1",
    draft_id: "draft-1",
    approval_id: "approval-1",
    run_id: null,
    node: state,
    state,
    created_at: "2026-10-19T00:00:00Z",
    payload_digest: digest(String(sequence)),
    terminal,
    retryable: false,
  };
}

describe("formal WPC execution adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { port: "5173" } });
    vi.restoreAllMocks();
  });

  it("submits only the formal endpoint and carries Idempotency-Key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ execution: operation(), operation: genericOperation() }, 202));
    vi.stubGlobal("fetch", fetchMock);
    const result = await submitAgentHarnessExecution(
      {
        schema_identity: "tilesim.agent_harness.execution_request.v1",
        contract_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
        draft_id: "draft-1",
        approval_id: "approval-1",
        validation_id: "validation-1",
        draft_digest: digest("b"),
        approval_digest: digest("c"),
        input_snapshot_digest: digest("d"),
        schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
        backend_identity: backend,
        policy_revision: "tilesim.agent_harness.policy.v1",
        workflow_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
        create_run_request: { scenario_id: "s1", fidelity_policy: "des" },
        create_run_request_digest: digest("e"),
        idempotency_key: "request-key",
      },
      { idempotencyKey: "request-key" },
    );
    expect(result.execution.operation_id).toBe("operation-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/executions", expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("request-key");
  });

  it("uses polling after SSE failure and preserves Last-Event-ID", async () => {
    const running = operation("running");
    const completed = { ...running, state: "completed", run_id: "run-1" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ execution: running, operation: genericOperation() }))
      .mockResolvedValueOnce(new Response("offline", { status: 503, headers }))
      .mockResolvedValueOnce(
        response({
          execution: completed,
          operation: { ...genericOperation(), workflow_state: "completed", run_id: "run-1" },
          events: [event(1, "completed", true)],
          after_sequence: 0,
          terminal: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const projection = await observeAgentHarnessExecution("operation-1", { maxPollAttempts: 1, preferSse: true });
    expect(projection.state).toBe("completed");
    expect(projection.source).toBe("polling");
    expect(fetchMock.mock.calls[2][1].headers["Last-Event-ID"]).toBeUndefined();
  });

  it("rejects result references bound to another operation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          execution: { ...operation("completed"), run_id: "run-1" },
          operation: { ...genericOperation(), workflow_state: "completed", run_id: "run-1" },
        }),
      )
      .mockResolvedValueOnce(
        response({
          result: {
            schema_identity: "tilesim.agent_harness.execution_result_reference.v1",
            contract_revision: AGENT_HARNESS_EXECUTION_CONTRACT_REVISION,
            operation_id: "other",
            execution_id: "execution-1",
            draft_id: "draft-1",
            approval_id: "approval-1",
            run_id: "run-1",
            run_status: "completed",
            manifest_schema_identity: "tilesim.bridge.artifact_manifest.v2",
            manifest_digest: digest("f"),
            schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
            requested_fidelity: "des",
            resolved_fidelity: "des",
            provenance: {},
            artifacts: [],
            rejected_artifacts: [],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAgentHarnessExecutionResult("operation-1")).rejects.toMatchObject({
      code: "result_binding_mismatch",
    });
  });

  it("sends explicit cancel/retry/resume mutations with a bounded key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ execution: operation("cancelled"), operation: genericOperation(), action: "cancel" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await mutateAgentHarnessExecution("operation-1", "cancel", { idempotencyKey: "cancel-key" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/executions/operation-1/cancel");
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("cancel-key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe("cancel");
  });
});
