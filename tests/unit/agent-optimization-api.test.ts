import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
} from "../../src/lib/api/agent-harness";
import {
  getAgentOptimizationAuthorization,
  getAgentOptimizationSession,
  createAgentOptimizationAuthorization,
  revokeAgentOptimizationAuthorization,
  observeAgentOptimizationEvents,
} from "../../src/lib/api/agent-optimization";

const headers = {
  "content-type": "text/event-stream; charset=utf-8",
  "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
  "x-tilesim-schema-set-revision": AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
};
const provenance = {
  deployment_mode: "local_dev",
  source_mode: "synthetic_trace",
  claim_scope: "exploratory",
  production_status: "not_for_production",
};
const digest = (character: string) => `sha256:${character.repeat(64)}`;

function authorizationFixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_identity: "tilesim.agent_harness.optimization_authorization.v1",
    contract_revision: "2026-10-28.wpf.v1",
    authorization_id: "authz-local-1",
    session_id: "opt-detail",
    principal: "local-user",
    workspace_id: "local",
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: { backend_revision: "bridge-test" },
    input_snapshot_digest: digest("a"),
    autonomy_level: "bounded_autonomous",
    budget: {
      max_rounds: 5,
      max_runs: 5,
      max_seconds: 900,
      max_failures: 2,
      max_model_calls: 24,
      max_tool_calls_per_round: 4,
      max_navigation_attempts: 4,
      max_run_creations: 1,
      max_execution_time_ms: 900_000,
    },
    parameter_grants: [],
    objective: { metric_path: "/metrics/p95_ps", direction: "minimize", minimum_improvement: 0, plateau_rounds: 3 },
    tool_allowlist: ["query_verified_metrics"],
    allowed_pages: ["overview", "metrics"],
    allowed_actions: ["analyze", "navigate"],
    protected: {
      source_mode: "synthetic_trace",
      claim_scope: "exploratory",
      schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
      backend_identity: { backend_revision: "bridge-test" },
    },
    status: "active",
    issued_by: "local-user",
    issued_at: "2026-10-19T00:00:00Z",
    expires_at: "2099-10-19T00:00:00Z",
    revoked_at: null,
    provenance,
    authorization_digest: digest("d"),
    ...overrides,
  };
}

function event(sessionId: string, sequence = 1, overrides: Record<string, unknown> = {}) {
  return {
    schema_identity: "tilesim.agent_harness.optimization_event.v1",
    contract_revision: AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
    session_id: sessionId,
    event_id: `event-${sequence}`,
    sequence,
    state: sequence === 1 ? "running" : "completed",
    node: "worker",
    payload_digest: digest(String(sequence)),
    created_at: "2026-10-19T00:00:00Z",
    provenance,
    ...overrides,
  };
}

function streamResponse(frames: readonly string[], responseHeaders: Record<string, string> = headers): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((frame) => controller.enqueue(encoder.encode(frame)));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: responseHeaders });
}

function frame(eventName: string, value: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(value)}\n\n`;
}

function optimizationDetail(
  candidateOverrides: Record<string, unknown> = {},
  sessionOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const sessionId = "opt-detail";
  const session = {
    schema_identity: "tilesim.agent_harness.optimization_session.v1",
    contract_revision: AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
    session_id: sessionId,
    principal: "local-user",
    workspace_id: "local",
    input_snapshot_digest: digest("a"),
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: { backend_revision: "bridge-test" },
    policy_revision: "tilesim.agent_harness.local_optimization.policy.v1",
    objective: { metric_path: "/metrics/p95_ps", direction: "minimize" },
    constraints: [],
    budget: { max_iterations: 1 },
    base_config: { scenario_id: "fixture" },
    local_dev: true,
    automatic_submission: false,
    state: "waiting_approval",
    provenance,
    ...sessionOverrides,
  };
  const candidate = {
    schema_identity: "tilesim.agent_harness.optimization_candidate.v1",
    contract_revision: AGENT_HARNESS_OPTIMIZATION_CONTRACT_REVISION,
    candidate_id: "candidate-detail",
    session_id: sessionId,
    candidate_digest: digest("c"),
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    config: { scenario_id: "fixture" },
    diff: {},
    status: "waiting_approval",
    origin: "model",
    authorization_id: null,
    provenance,
    ...candidateOverrides,
  };
  return {
    session,
    candidate,
    candidates: [candidate],
    iterations: [],
    events: [],
    checkpoint: null,
    approval: null,
    tool_invocations: [],
  };
}

function jsonResponse(payload: unknown, responseHeaders: Record<string, string> = headers): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...responseHeaders, "content-type": "application/json" },
  });
}

describe("Agent Harness optimization adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", { location: { port: "5173" } });
  });

  it.each([
    ["model", null],
    ["rule", "authorization-local-1"],
  ] as const)("accepts closed candidate origin=%s with authorization_id=%s", async (origin, authorizationId) => {
    const detail = optimizationDetail({ origin, authorization_id: authorizationId });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail })));

    await expect(getAgentOptimizationSession("opt-detail")).resolves.toMatchObject({
      candidate: { origin, authorization_id: authorizationId },
      candidates: [{ origin, authorization_id: authorizationId }],
    });
  });

  it.each([
    ["unknown origin", { origin: "user" }, "invalid_candidate_origin"],
    ["malformed authorization id", { authorization_id: 42 }, "invalid_authorization"],
  ] as const)("rejects candidate detail with %s", async (_label, mutation, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: optimizationDetail(mutation) })));
    await expect(getAgentOptimizationSession("opt-detail")).rejects.toMatchObject({ code });
  });

  it("accepts a bootstrap session that becomes bounded-autonomous after authorization", async () => {
    const authorization = authorizationFixture();
    const detail = optimizationDetail(
      {},
      {
        // The session is created with this compatibility field false; the
        // authorization endpoint grants autonomous turns afterwards.
        automatic_submission: false,
        autonomy: "auto",
        authorization_id: authorization.authorization_id,
        authorization,
        agent_turns: [],
      },
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail })));

    await expect(getAgentOptimizationSession("opt-detail")).resolves.toMatchObject({
      session: {
        automatic_submission: false,
        autonomy: "auto",
        authorization_id: "authz-local-1",
        authorization: { status: "active" },
        agent_turns: [],
      },
    });
  });

  it("rejects an auto session whose authorization envelope is missing", async () => {
    const detail = optimizationDetail(
      {},
      { automatic_submission: false, autonomy: "auto", authorization_id: "authz-missing" },
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail })));

    await expect(getAgentOptimizationSession("opt-detail")).rejects.toMatchObject({
      code: "local_dev_boundary_violation",
    });
  });

  it("rejects an auto session whose envelope is not the bounded-autonomous grant", async () => {
    const detail = optimizationDetail(
      {},
      {
        automatic_submission: false,
        autonomy: "auto",
        authorization_id: "authz-human",
        authorization: authorizationFixture({ authorization_id: "authz-human", autonomy_level: "human_approves_each" }),
      },
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail })));

    await expect(getAgentOptimizationSession("opt-detail")).rejects.toMatchObject({
      code: "local_dev_boundary_violation",
    });
  });

  it("reads a closed authorization envelope through the generated authorization endpoint", async () => {
    const authorization = authorizationFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ authorization, session_id: "opt-detail", provenance })));
    await expect(getAgentOptimizationAuthorization("opt-detail")).resolves.toMatchObject({
      authorization_id: "authz-local-1",
      budget: { max_model_calls: 24, max_navigation_attempts: 4 },
    });
  });

  it("rejects an authorization envelope with an unknown field", async () => {
    const authorization = authorizationFixture({ extra: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ authorization, session_id: "opt-detail", provenance })));
    await expect(getAgentOptimizationAuthorization("opt-detail")).rejects.toMatchObject({ code: "invalid_authorization" });
  });

  it("sends the explicit budget and allowlists through the generated authorization writer", async () => {
    const authorization = authorizationFixture();
    const detail = optimizationDetail({}, { autonomy: "auto", authorization_id: authorization.authorization_id, authorization });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ authorization, session: detail.session, detail, provenance }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createAgentOptimizationAuthorization("opt-detail", {
        autonomy_level: "bounded_autonomous",
        budget: {
          max_model_calls: 24,
          max_tool_calls_per_round: 4,
          max_navigation_attempts: 4,
          max_run_creations: 1,
          max_execution_time_ms: 900_000,
        },
        parameter_grants: [],
        objective: { metric_path: "/metrics/p95_ps", direction: "minimize" },
        tool_allowlist: ["query_verified_metrics"],
        allowed_pages: ["overview", "metrics"],
        allowed_actions: ["analyze", "navigate"],
      }, "auth-idempotency-1"),
    ).resolves.toMatchObject({ session: { authorization_id: "authz-local-1" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/optimization/sessions/opt-detail/authorization");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ budget: { max_model_calls: 24, max_run_creations: 1 } });
  });

  it("requires a revoked status from the generated authorization revoke writer", async () => {
    const authorization = authorizationFixture({ status: "revoked", revoked_at: "2026-10-28T00:30:00Z" });
    const detail = optimizationDetail({}, { authorization_id: authorization.authorization_id, authorization });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ authorization, session: detail.session, detail, provenance }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(revokeAgentOptimizationAuthorization("opt-detail", "auth-revoke-1")).resolves.toMatchObject({ session: { authorization_id: "authz-local-1" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/optimization/sessions/opt-detail/authorization/revoke");
  });

  it("uses the generated optimization stream path and accepts a complete event sequence", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          frame("workflow", event("opt/1")),
          frame("terminal", { session_id: "opt/1", state: "completed" }),
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const received: Record<string, unknown>[] = [];
    await expect(
      observeAgentOptimizationEvents("opt/1", { onEvent: (value) => received.push(value) }),
    ).resolves.toBeUndefined();
    expect(received).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/optimization/sessions/opt%2F1/events/stream");
  });

  it("accepts named Agent diagnostic frames alongside the workflow compatibility frame", async () => {
    const diagnostic = event("opt/1", 2, { node: "agent.step" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            frame("workflow", event("opt/1")),
            frame("workflow", diagnostic),
            frame("agent.step", diagnostic),
            frame("terminal", { session_id: "opt/1", state: "completed" }),
          ]),
        ),
    );
    const onEvent = vi.fn();
    await expect(observeAgentOptimizationEvents("opt/1", { onEvent })).resolves.toBeUndefined();
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1][0]).toMatchObject({ sequence: 2, node: "agent.step" });
  });

  it("rejects a named diagnostic frame whose event name does not match its node", async () => {
    const diagnostic = event("opt/1", 1, { node: "agent.verdict" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([frame("agent.step", diagnostic)])));
    await expect(observeAgentOptimizationEvents("opt/1")).rejects.toMatchObject({
      code: "invalid_event",
      fieldPath: "/events/node",
    });
  });

  it.each([
    ["foreign session", { session_id: "other" }, "session_binding_mismatch"],
    ["unknown schema", { schema_identity: "tilesim.other.v1" }, "schema_identity_mismatch"],
    ["bad digest", { payload_digest: "not-a-digest" }, "invalid_optimization_event"],
    ["bad provenance", { provenance: { ...provenance, source_mode: "real_trace" } }, "provenance_mismatch"],
  ])("rejects an optimization event with %s", async (_label, mutation, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([frame("workflow", event("opt/1", 1, mutation))])));
    await expect(observeAgentOptimizationEvents("opt/1")).rejects.toMatchObject({ code });
  });

  it("rejects a terminal frame that does not carry a terminal state for the requested session", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            frame("workflow", event("opt/1")),
            frame("terminal", { session_id: "opt/1", state: "running" }),
          ]),
        ),
    );
    await expect(observeAgentOptimizationEvents("opt/1")).rejects.toMatchObject({ code: "invalid_optimization_event" });
  });

  it("rejects an optimization stream that ends before a terminal frame", async () => {
    const onEvent = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([frame("workflow", event("opt/1"))])));

    await expect(observeAgentOptimizationEvents("opt/1", { onEvent })).rejects.toMatchObject({
      code: "incomplete_optimization_stream",
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects a stream whose schema metadata is stale before forwarding frames", async () => {
    const staleHeaders = { ...headers, "x-tilesim-schema-set-revision": `sha256:${"f".repeat(64)}` };
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([frame("workflow", event("opt/1"))], staleHeaders));
    vi.stubGlobal("fetch", fetchMock);
    const onEvent = vi.fn();
    await expect(observeAgentOptimizationEvents("opt/1", { onEvent })).rejects.toMatchObject({
      code: "schema_revision_mismatch",
    });
    expect(onEvent).not.toHaveBeenCalled();
  });
});
