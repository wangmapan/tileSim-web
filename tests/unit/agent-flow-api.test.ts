import { afterEach, describe, expect, it, vi } from "vitest";
// The browser tsconfig intentionally does not include Node's ambient types;
// this one regression invokes the native loader only at test runtime.
// @ts-expect-error Node types are not part of the browser project.
import { execFileSync } from "node:child_process";
declare const process: { execPath: string; cwd(): string };
import {
  AGENT_FLOW_CONTRACT_REVISION,
  AGENT_FLOW_API_VERSION,
  AGENT_FLOW_EVENT_SCHEMA_IDENTITY,
  AGENT_FLOW_SCHEMA_IDENTITY,
  AGENT_FLOW_SCHEMA_SET_REVISION,
  AGENT_FLOW_REVOKE_SCHEMA_IDENTITY,
  AGENT_FLOW_START_SCHEMA_IDENTITY,
  createAgentFlow,
  getAgentFlow,
  getAgentFlowEvents,
  observeAgentFlowEvents,
  resumeAgentFlow,
  revokeAgentFlowAuthorization,
  agentFlowResumeIdempotencyState,
} from "../../src/lib/api/agent-flow";
import { agentFlowStartRequest as validateAgentFlowStartRequest } from "../../src/contracts/generated/agent-flow-validators.js";

const jsonHeaders = {
  "content-type": "application/json",
  "x-tilesim-schema-set-revision": AGENT_FLOW_SCHEMA_SET_REVISION,
  "x-tilesim-api-version": AGENT_FLOW_API_VERSION,
};

function binding(flowId = "flow-test") {
  return {
    session_id: "session-test",
    flow_id: flowId,
    run_id: "run-test",
    run_context_revision: "ctx-1",
    backend_identity: { backend: "fixture" },
    schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
    input_snapshot_digest: null,
    artifact_bindings: [],
  };
}

function state(flowId = "flow-test", eventSequence = 1) {
  return {
    schema_identity: AGENT_FLOW_SCHEMA_IDENTITY,
    contract_revision: AGENT_FLOW_CONTRACT_REVISION,
    flow_id: flowId,
    session_id: "session-test",
    principal: "local-user",
    workspace_id: "local-workspace",
    intent: "user_report",
    status: "waiting_user",
    node: "await_user_confirmation",
    event_sequence: eventSequence,
    binding: binding(flowId),
    pending_action: "confirm_report",
    approval: null,
    authorization: null,
    validation: null,
    evidence: { status: "deterministic_fallback" },
    report: { status: "not_started" },
    terminal_reason: null,
    checkpoint_id: "checkpoint-test",
    created_at: "2026-10-25T00:00:00Z",
    updated_at: "2026-10-25T00:00:01Z",
  };
}

function event(sequence: number, flowId = "flow-test") {
  return {
    schema_identity: AGENT_FLOW_EVENT_SCHEMA_IDENTITY,
    contract_revision: AGENT_FLOW_CONTRACT_REVISION,
    event_id: `event-${sequence}`,
    sequence,
    flow_id: flowId,
    session_id: "session-test",
    node: "await_user_confirmation",
    event_type: "approval_required",
    state: state(flowId, sequence),
    binding: binding(flowId),
    pending_action: "confirm_report",
    payload: {},
    created_at: "2026-10-25T00:00:01Z",
  };
}

function authorizedFlow(flowId = "flow-test", eventSequence = 1, status: "waiting_user" | "cancelled" = "waiting_user") {
  const value = state(flowId, eventSequence);
  return {
    ...value,
    intent: "navigation" as const,
    status,
    node: status === "cancelled" ? "terminal" : value.node,
    pending_action: status === "cancelled" ? null : ("confirm_navigation" as const),
    terminal_reason: status === "cancelled" ? "authorization_revoked" : null,
    authorization: {
      status: status === "cancelled" ? "revoked" as const : "active" as const,
      authorization_id: "authz-test",
      authorization_digest: "sha256:" + "a".repeat(64),
      budget: {
        max_navigation_attempts: 2,
        max_model_calls: 1,
        max_tool_calls_per_round: 1,
        max_run_creations: 1,
        max_execution_time_ms: 30_000,
      },
      usage: { navigation_attempts: 0, model_calls: 1, tool_calls_per_round: 0, run_creations: 0, execution_time_ms: 0 },
      remaining: { max_navigation_attempts: 2, max_model_calls: 0, max_tool_calls_per_round: 1, max_run_creations: 1, max_execution_time_ms: 30_000 },
    },
    current_page: "overview",
    current_page_capabilities: ["overview"],
    current_context_revision: "ctx-1",
    required_capabilities: ["metrics"],
    allowed_pages: ["metrics"],
    allowed_actions: ["navigate"],
    visited_pages: [],
    navigation_attempts: 0,
    max_navigation_attempts: 2,
  };
}

function revokeEvent(flowId = "flow-test", sequence = 2) {
  const flow = authorizedFlow(flowId, sequence, "cancelled");
  return {
    ...event(sequence, flowId),
    event_type: "terminal" as const,
    node: "authorization",
    pending_action: null,
    state: flow,
    binding: flow.binding,
    payload: { reason: "authorization_revoked", status: "cancelled" },
  };
}

function jsonResponse(payload: unknown, headers: Record<string, string> = jsonHeaders) {
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("LangGraph flow API contract boundaries", () => {
  it("keeps the generated Agent Flow validator directly importable and strict", () => {
    const valid = {
      schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      session_id: "session-test",
      user_goal: "Explain the current page",
      intent: "explain",
      run_id: null,
      run_context_revision: null,
      backend_identity: {},
      schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
      input_snapshot_digest: null,
      artifact_bindings: [],
    };
    expect(validateAgentFlowStartRequest(valid)).toBe(true);
    expect(
      validateAgentFlowStartRequest({
        ...valid,
        artifact_bindings: [
          { artifact_id: "metrics", schema_identity: "tilesim.metrics_report.v1", sha256: "a".repeat(64), bytes: "01" },
        ],
      }),
    ).toBe(false);
  });

  it("rejects an untrusted flow state that names an unpublished navigation page", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ flow: { ...state(), current_page: "router.push" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAgentFlow("flow-test", binding())).rejects.toMatchObject({
      code: "invalid_flow_payload",
      fieldPath: "/flow/current_page",
    });
  });

  it("sends the independent flow identity and scope on start", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ flow: state(), idempotent_replay: false }));
    vi.stubGlobal("fetch", fetchMock);
    const request = {
      schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      session_id: "session-test",
      user_goal: "生成当前结果解读报告",
      intent: "user_report" as const,
      run_id: "run-test",
      run_context_revision: "ctx-1",
      backend_identity: { backend: "fixture" },
      schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
      input_snapshot_digest: null,
      artifact_bindings: [],
    };
    await createAgentFlow(request, "idempotency-flow-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/flows",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idempotency-flow-1",
          "X-TileSim-Scopes": expect.stringContaining("agent:start_flow"),
        }),
      }),
    );
  });

  it("fails closed before transport when a start or resume request drifts from the generated schema", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createAgentFlow(
        {
          schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
          contract_revision: AGENT_FLOW_CONTRACT_REVISION,
          session_id: "session-test",
          user_goal: "Explain",
          intent: "explain",
          run_id: null,
          run_context_revision: null,
          backend_identity: {},
          schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
          input_snapshot_digest: null,
          artifact_bindings: [],
          unexpected: true,
        } as never,
        "generated-request-drift",
      ),
    ).rejects.toMatchObject({ code: "invalid_flow_payload", fieldPath: "/request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invokes the generated validator through Node's native ESM loader", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { agentFlowStartRequest } from "./src/contracts/generated/agent-flow-validators.js";
const value = { schema_identity: "${AGENT_FLOW_START_SCHEMA_IDENTITY}", contract_revision: "${AGENT_FLOW_CONTRACT_REVISION}", session_id: "session-test", user_goal: "Explain", intent: "explain", run_id: null, run_context_revision: null, backend_identity: {}, schema_set_revision: "${AGENT_FLOW_SCHEMA_SET_REVISION}", input_snapshot_digest: null, artifact_bindings: [] };
process.stdout.write(String(agentFlowStartRequest(value)));`,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(output.trim()).toBe("true");
  });

  it("rejects a stale binding instead of returning a flow from another context", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ flow: state() })));
    await expect(getAgentFlow("flow-test", { ...binding(), run_context_revision: "ctx-old" })).rejects.toMatchObject({
      code: "stale_binding",
    });
  });

  it("rejects a flow payload whose binding revision disagrees with response metadata", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          flow: { ...state(), binding: { ...binding(), schema_set_revision: "sha256:" + "e".repeat(64) } },
        }),
      ),
    );
    await expect(getAgentFlow("flow-test")).rejects.toMatchObject({ code: "schema_revision_mismatch" });
  });

  it("rejects a status response for a different flow id", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ flow: state("flow-other") })));
    await expect(getAgentFlow("flow-test")).rejects.toMatchObject({
      code: "binding_mismatch",
      fieldPath: "/flow/flow_id",
    });
  });

  it("rejects a terminal flow that still exposes a pending action", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ flow: { ...state(), status: "completed", pending_action: "confirm_report" } }),
        ),
    );
    await expect(getAgentFlow("flow-test")).rejects.toMatchObject({
      code: "invalid_flow_payload",
      fieldPath: "/flow/pending_action",
    });
  });

  it("rejects replay events with a sequence gap before exposing them", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ flow: state("flow-test", 2), events: [event(2)], after_sequence: 0, terminal: false }),
        ),
    );
    await expect(getAgentFlowEvents("flow-test", 0, binding())).rejects.toMatchObject({ code: "event_sequence_gap" });
  });

  it("rejects non-integral or negative event cursors before transport", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAgentFlowEvents("flow-test", -1, binding())).rejects.toMatchObject({
      code: "invalid_event_sequence",
      fieldPath: "/after_sequence",
    });
    await expect(getAgentFlowEvents("flow-test", 1.5, binding())).rejects.toMatchObject({
      code: "invalid_event_sequence",
      fieldPath: "/after_sequence",
    });
    await expect(
      observeAgentFlowEvents("flow-test", { lastEventSequence: -1, binding: binding() }),
    ).rejects.toMatchObject({
      code: "invalid_event_sequence",
      fieldPath: "/last_event_sequence",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an event response whose events do not reach the published flow cursor", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ flow: state("flow-test", 2), events: [], after_sequence: 1, terminal: false }),
        ),
    );
    await expect(getAgentFlowEvents("flow-test", 1, binding())).rejects.toMatchObject({ code: "event_sequence_gap" });
  });

  it("rejects an SSE event belonging to a different flow", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`id: 1\nevent: flow\ndata: ${JSON.stringify(event(1, "other-flow"))}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    const onEvent = vi.fn();
    await expect(observeAgentFlowEvents("flow-test", { onEvent, binding: binding() })).rejects.toMatchObject({
      code: "invalid_event_sequence",
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("rejects an SSE event whose nested state belongs to another flow", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const otherFlow = event(1, "flow-other");
    const misrouted = { ...otherFlow, flow_id: "flow-test" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`id: 1\nevent: flow\ndata: ${JSON.stringify(misrouted)}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test")).rejects.toMatchObject({
      code: "binding_mismatch",
    });
  });

  it("rejects an SSE stream that ends with an incomplete event frame", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`id: 1\nevent: flow\ndata: ${JSON.stringify(event(1))}`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test", { binding: binding() })).rejects.toMatchObject({
      message: "incomplete_sse_frame",
    });
  });

  it("rejects an SSE frame with an unpublished event type", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`id: 1\nevent: unknown\ndata: ${JSON.stringify(event(1))}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test", { binding: binding() })).rejects.toMatchObject({
      code: "invalid_event_type",
    });
  });

  it("rejects an SSE flow frame that carries an id or event without JSON data", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("id: 1\nevent: flow\n\n", {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test", { binding: binding() })).rejects.toMatchObject({
      code: "invalid_event_type",
      fieldPath: "/events/data",
    });
  });

  it("rejects an SSE flow frame whose id is absent or does not match the event sequence", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: flow\ndata: ${JSON.stringify(event(1))}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test", { binding: binding() })).rejects.toMatchObject({
      code: "event_sequence_gap",
    });
  });

  it("rejects an SSE flow payload whose binding revision is stale", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const stale = {
      ...event(1),
      binding: { ...binding(), schema_set_revision: "sha256:" + "e".repeat(64) },
      state: { ...state(), binding: { ...binding(), schema_set_revision: "sha256:" + "e".repeat(64) } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`id: 1\nevent: flow\ndata: ${JSON.stringify(stale)}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentFlowEvents("flow-test", { binding: binding() })).rejects.toMatchObject({
      code: "schema_revision_mismatch",
    });
  });

  it("rejects a terminal SSE state that is not aligned with the accepted event cursor", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const terminal = { ...state("flow-test", 2), status: "draft_ready", pending_action: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: terminal\ndata: ${JSON.stringify(terminal)}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(
      observeAgentFlowEvents("flow-test", { binding: binding(), lastEventSequence: 1 }),
    ).rejects.toMatchObject({
      code: "event_sequence_gap",
    });
  });

  it("rejects a terminal SSE frame without a published flow state", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: terminal\ndata: ${JSON.stringify({ flow_id: "flow-test", status: "completed" })}\n\n`, {
          status: 200,
          headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(
      observeAgentFlowEvents("flow-test", { binding: binding(), lastEventSequence: 1 }),
    ).rejects.toMatchObject({
      code: "invalid_event_type",
    });
  });

  it("rejects flow data that arrives after an accepted terminal SSE frame", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const terminal = { ...state("flow-test", 1), status: "completed", pending_action: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `event: terminal\ndata: ${JSON.stringify(terminal)}\n\nid: 2\nevent: flow\ndata: ${JSON.stringify(event(2))}\n\n`,
          {
            status: 200,
            headers: { ...jsonHeaders, "content-type": "text/event-stream; charset=utf-8" },
          },
        ),
      ),
    );
    const onTerminal = vi.fn();
    const onEvent = vi.fn();
    await expect(
      observeAgentFlowEvents("flow-test", { binding: binding(), lastEventSequence: 1, onTerminal, onEvent }),
    ).rejects.toMatchObject({
      code: "invalid_event_sequence",
      fieldPath: "/events/terminal",
    });
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("rejects a start response whose binding changes any requested identity", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = {
      schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      session_id: "session-test",
      user_goal: "生成当前结果解读报告",
      intent: "user_report" as const,
      run_id: "run-test",
      run_context_revision: "ctx-1",
      backend_identity: { backend: "fixture" },
      schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
      input_snapshot_digest: null,
      artifact_bindings: [],
    };
    for (const [mutation, expectedCode] of [
      [{ run_id: "run-other" }, "binding_mismatch"],
      [{ backend_identity: { backend: "other" } }, "binding_mismatch"],
      [{ schema_set_revision: "sha256:" + "f".repeat(64) }, "schema_revision_mismatch"],
      [
        {
          artifact_bindings: [
            { artifact_id: "metrics", schema_identity: "metrics.v1", sha256: "a".repeat(64), bytes: "1" },
          ],
        },
        "binding_mismatch",
      ],
    ]) {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          flow: { ...state(), binding: { ...state().binding, ...(mutation as Record<string, unknown>) } },
          idempotent_replay: false,
        }),
      );
      await expect(createAgentFlow(request, `binding-${Object.keys(mutation)[0]}`)).rejects.toMatchObject({
        code: expectedCode,
      });
    }
  });

  it("rejects a flow response when API or schema headers are absent", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ flow: state() }, { "content-type": "application/json" })),
    );
    const request = {
      schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      session_id: "session-test",
      user_goal: "生成当前结果解读报告",
      intent: "user_report" as const,
      run_id: "run-test",
      run_context_revision: "ctx-1",
      backend_identity: { backend: "fixture" },
      schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
      input_snapshot_digest: null,
      artifact_bindings: [],
    };
    await expect(createAgentFlow(request, "missing-metadata-1")).rejects.toMatchObject({
      code: "unsupported_api_contract",
    });
  });

  it("rejects a flow response with a malformed identity binding", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mutations = [
      { backend_identity: null },
      { schema_set_revision: "stale" },
      { input_snapshot_digest: "not-a-digest" },
      { run_context_revision: null },
      { session_id: "s".repeat(129) },
      {
        artifact_bindings: [
          { artifact_id: "metrics", schema_identity: "metrics.v1", sha256: "sha256:" + "a".repeat(64), bytes: "01" },
        ],
      },
    ];
    for (const mutation of mutations) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ flow: { ...state(), binding: { ...binding(), ...mutation } } }));
      await expect(getAgentFlow("flow-test")).rejects.toMatchObject({ code: "invalid_flow_binding" });
    }
  });

  it("rejects unknown state fields and malformed timestamps before exposing flow state", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ flow: { ...state(), unexpected: true } }));
    await expect(getAgentFlow("flow-test")).rejects.toMatchObject({
      code: "invalid_flow_payload",
      fieldPath: "/flow/unexpected",
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ flow: { ...state(), created_at: "not-a-date" } }));
    await expect(getAgentFlow("flow-test")).rejects.toMatchObject({
      code: "invalid_flow_payload",
      fieldPath: "/flow/created_at",
    });
  });

  it("replays a resume after a lost response with the same bounded idempotency key", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const request = {
      schema_identity: "tilesim.agent_flow.resume_request.v1" as const,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      flow_id: "flow-test",
      session_id: "session-test",
      action: "confirm_report" as const,
      pending_action: "confirm_report" as const,
      current_binding: binding(),
      current_event_sequence: 1,
      intent: "user_report" as const,
      clarification: null,
      reason: null,
    };
    const firstKey = await agentFlowResumeIdempotencyState(request);
    const retryKey = await agentFlowResumeIdempotencyState(request, firstKey);
    expect(firstKey).toEqual(retryKey);
    expect(firstKey.key).toMatch(/^flow-resume-[0-9a-f]{64}$/);
    expect(firstKey.key.length).toBeLessThanOrEqual(128);
    const nextSequenceKey = await agentFlowResumeIdempotencyState(
      { ...request, current_event_sequence: request.current_event_sequence + 1 },
      firstKey,
    );
    expect(nextSequenceKey.key).not.toBe(firstKey.key);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("response lost after commit"))
      .mockResolvedValueOnce(
        jsonResponse({ flow: state(), events: [], idempotent_replay: true, action: "confirm_report" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(resumeAgentFlow(request.flow_id, request, firstKey.key)).rejects.toBeInstanceOf(TypeError);
    await resumeAgentFlow(request.flow_id, request, retryKey.key);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(firstKey.key);
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe(firstKey.key);
  });

  it("rejects a resume response whose events do not reach its flow cursor", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const request = {
      schema_identity: "tilesim.agent_flow.resume_request.v1" as const,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      flow_id: "flow-test",
      session_id: "session-test",
      action: "confirm_report" as const,
      pending_action: "confirm_report" as const,
      current_binding: binding(),
      current_event_sequence: 1,
      intent: "user_report" as const,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ flow: state("flow-test", 2), events: [], idempotent_replay: false, action: "confirm_report" }),
        ),
    );
    await expect(resumeAgentFlow("flow-test", request, "resume-cursor-gap")).rejects.toMatchObject({
      code: "event_sequence_gap",
    });
  });

  it("validates authorization revoke requests and requires a terminal revoke action", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const flow = authorizedFlow();
    const request = {
      schema_identity: AGENT_FLOW_REVOKE_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      flow_id: flow.flow_id,
      session_id: flow.session_id,
      current_binding: flow.binding,
      current_event_sequence: flow.event_sequence,
      authorization_id: "authz-test",
      authorization_digest: "sha256:" + "a".repeat(64),
      authorization_budget: flow.authorization!.budget,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        flow: authorizedFlow("flow-test", 2, "cancelled"),
        events: [revokeEvent()],
        idempotent_replay: false,
        action: "revoke_authorization",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(revokeAgentFlowAuthorization(flow.flow_id, request, "flow-revoke-test-001")).resolves.toMatchObject({
      action: "revoke_authorization",
      flow: { status: "cancelled", authorization: { status: "revoked" } },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/flows/flow-test/authorization/revoke");

    await expect(
      revokeAgentFlowAuthorization(flow.flow_id, { ...request, unexpected: true } as never, "flow-revoke-test-002"),
    ).rejects.toMatchObject({ code: "invalid_flow_payload" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a revoke response action or event cursor is stale", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const flow = authorizedFlow();
    const request = {
      schema_identity: AGENT_FLOW_REVOKE_SCHEMA_IDENTITY,
      contract_revision: AGENT_FLOW_CONTRACT_REVISION,
      flow_id: flow.flow_id,
      session_id: flow.session_id,
      current_binding: flow.binding,
      current_event_sequence: flow.event_sequence,
      authorization_id: "authz-test",
      authorization_digest: "sha256:" + "a".repeat(64),
      authorization_budget: flow.authorization!.budget,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          flow: authorizedFlow("flow-test", 2, "cancelled"),
          events: [],
          idempotent_replay: false,
          action: "resume",
        }),
      ),
    );
    await expect(revokeAgentFlowAuthorization(flow.flow_id, request, "flow-revoke-test-003")).rejects.toMatchObject({
      code: "invalid_flow_payload",
    });
  });

  it("rejects state status and pending-action values outside the published enums", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const [field, value] of [
      ["status", "waiting_for_model"],
      ["pending_action", "auto_confirm"],
    ] as const) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ flow: { ...state(), [field]: value } }));
      await expect(getAgentFlow("flow-test")).rejects.toMatchObject({
        code: "invalid_flow_payload",
        fieldPath: `/flow/${field}`,
      });
    }
  });

  it("rejects unknown or missing fields in flow response envelopes", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ flow: state(), idempotent_replay: false, extra: true }));
    await expect(
      createAgentFlow(
        {
          schema_identity: AGENT_FLOW_START_SCHEMA_IDENTITY,
          contract_revision: AGENT_FLOW_CONTRACT_REVISION,
          session_id: "session-test",
          user_goal: "Explain",
          intent: "explain",
          run_id: null,
          run_context_revision: null,
          backend_identity: {},
          schema_set_revision: AGENT_FLOW_SCHEMA_SET_REVISION,
          input_snapshot_digest: null,
          artifact_bindings: [],
        },
        "envelope-extra-1",
      ),
    ).rejects.toMatchObject({ code: "invalid_flow_payload", fieldPath: "/response/extra" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ flow: state() }));
    await expect(getAgentFlow("flow-test")).resolves.toMatchObject({ flow_id: "flow-test" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ flow: state(), events: [], after_sequence: 0, terminal: "false" }));
    await expect(getAgentFlowEvents("flow-test", 0, binding())).rejects.toMatchObject({
      code: "invalid_flow_payload",
      fieldPath: "/response/terminal",
    });
  });

  it("rejects events with an unpublished event type before exposing them", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          flow: state(),
          events: [{ ...event(1), event_type: "model_reasoning" }],
          after_sequence: 0,
          terminal: false,
        }),
      ),
    );
    await expect(getAgentFlowEvents("flow-test", 0, binding())).rejects.toMatchObject({
      code: "invalid_event_type",
      fieldPath: "/events/event_type",
    });
  });
});
