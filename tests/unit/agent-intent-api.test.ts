import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_INTENT_CONTRACT_REVISION,
  AGENT_INTENT_PROTOCOL,
  AGENT_INTENT_REQUEST_SCHEMA,
  AGENT_INTENT_RESPONSE_SCHEMA,
  requestAgentIntent,
} from "../../src/lib/api/agent-intent";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../src/contracts/generated/bridge-contracts";
import type { AgentIntentRequest } from "../../src/contracts/bridge-api";

const headers = {
  "content-type": "application/json",
  "x-tilesim-schema-set-revision": BRIDGE_SCHEMA_SET_REVISION,
  "x-tilesim-api-version": "tilesim.bridge.api.v1",
};

function request(): AgentIntentRequest {
  return {
    schema_identity: AGENT_INTENT_REQUEST_SCHEMA,
    contract_revision: AGENT_INTENT_CONTRACT_REVISION,
    session_id: "session-intent",
    user_goal: "打开性能指标",
    current_page: {
      page_id: "overview",
      route_name: "overview",
      context_revision: "ctx-1",
      capability_ids: ["overview"],
    },
    page_catalog: [
      { page_id: "overview", route_name: "overview", capability_ids: ["overview"], supports_run: true },
      { page_id: "metrics", route_name: "metrics", capability_ids: ["metrics", "run_bound"], supports_run: true },
    ],
    run_id: "run-intent",
    run_context_revision: "run-ctx-1",
    backend_identity: { backend_revision: "fixture" },
    schema_set_revision: BRIDGE_SCHEMA_SET_REVISION,
    input_snapshot_digest: null,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    schema_identity: AGENT_INTENT_RESPONSE_SCHEMA,
    contract_revision: AGENT_INTENT_CONTRACT_REVISION,
    schema_set_revision: BRIDGE_SCHEMA_SET_REVISION,
    protocol: AGENT_INTENT_PROTOCOL,
    session_id: "session-intent",
    user_goal: "打开性能指标",
    intent: "navigation",
    current_page_id: "overview",
    current_context_revision: "ctx-1",
    run_id: "run-intent",
    run_context_revision: "run-ctx-1",
    backend_identity: { backend_revision: "fixture" },
    input_snapshot_digest: null,
    candidate_pages: [
      { page_id: "metrics", route_name: "metrics", required_capabilities: ["metrics"], reason: "查看指标" },
    ],
    required_capabilities: ["metrics"],
    risk_level: "low",
    requires_user_confirmation: true,
    suggested_steps: [{ kind: "navigate", description: "打开指标页", page_id: "metrics" }],
    clarification_questions: [],
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("model-driven agent intent API", () => {
  it("accepts a bound closed-world navigation proposal", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(response()), { status: 200, headers });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onFailure = vi.fn();
    const result = await requestAgentIntent(request(), { onFailure });
    expect(result?.intent).toBe("navigation");
    expect(result?.candidate_pages[0]?.page_id).toBe("metrics");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports a safe structured diagnostic for an unavailable intent provider", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    const secret = "secret-provider-credential";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              request_id: secret,
              error: { code: "agent_intent_provider_unavailable", message: secret, retryable: true },
              raw_response: secret,
            }),
            { status: 503, headers: { ...headers, "x-request-id": secret } },
          ),
      ),
    );
    const onFailure = vi.fn();

    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "bridge_error",
      code: "agent_intent_provider_unavailable",
      status: 503,
      retryable: true,
    });
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain(secret);
  });

  it("preserves a bounded 404 diagnostic when the Bridge is too old to publish intent", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404, headers })));
    const onFailure = vi.fn();

    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith({
      kind: "bridge_error",
      code: "http_404",
      status: 404,
      retryable: false,
    });
  });

  it("does not expose arbitrary response-controlled error codes", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    const secret = "sk-provider-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: secret, message: secret } }), { status: 503, headers }),
      ),
    );
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "bridge_error",
      code: "bridge_error",
      status: 503,
      retryable: false,
    });
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain(secret);
  });

  it("rejects an invented page and unknown intent without exposing the payload", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              response({
                intent: "run_arbitrary_function",
                candidate_pages: [
                  { page_id: "https://evil.invalid", route_name: "evil", required_capabilities: [], reason: "x" },
                ],
              }),
            ),
            { status: 200, headers },
          ),
      ),
    );
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "invalid_response",
      code: "invalid_response",
      status: null,
      retryable: false,
    });
  });

  it("fails closed when the schema-set response header is stale", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(response()), {
            status: 200,
            headers: { ...headers, "x-tilesim-schema-set-revision": "sha256:" + "0".repeat(64) },
          }),
      ),
    );
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "schema_revision_mismatch",
      code: "schema_revision_mismatch",
      status: null,
      retryable: false,
    });
  });

  it("fails closed when the model changes the input snapshot binding", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(response({ input_snapshot_digest: "sha256:" + "f".repeat(64) })), {
          status: 200,
          headers,
        }),
      ),
    );
    await expect(requestAgentIntent(request())).resolves.toBeNull();
  });

  it("fails closed when a model response changes the bound run or backend", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify(
            response({
              run_id: "run-other",
              backend_identity: { backend_revision: "other" },
            }),
          ),
          { status: 200, headers },
        ),
      ),
    );
    await expect(requestAgentIntent(request())).resolves.toBeNull();
  });

  it("fails closed when the model repeats a candidate page", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify(
            response({
              candidate_pages: [
                { page_id: "metrics", route_name: "metrics", required_capabilities: ["metrics"], reason: "先看指标" },
                { page_id: "metrics", route_name: "metrics", required_capabilities: ["metrics"], reason: "再次看指标" },
              ],
            }),
          ),
          { status: 200, headers },
        ),
      ),
    );
    await expect(requestAgentIntent(request())).resolves.toBeNull();
  });

  it("fails closed without throwing when an untyped caller omits the page catalog", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const malformed = { ...request(), page_catalog: undefined } as unknown as AgentIntentRequest;
    const onFailure = vi.fn();
    await expect(requestAgentIntent(malformed, { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "preflight_request_invalid",
      code: "preflight_request_invalid",
      status: null,
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, {}, { page_id: "metrics", capability_ids: null }])(
    "diagnoses malformed page catalog entries without sending a request: %j",
    async (entry) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const malformed = { ...request(), page_catalog: [entry] } as unknown as AgentIntentRequest;
      const onFailure = vi.fn();
      await expect(requestAgentIntent(malformed, { onFailure })).resolves.toBeNull();
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith({
        kind: "preflight_request_invalid",
        code: "preflight_request_invalid",
        status: null,
        retryable: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports malformed JSON as an invalid response without exposing its contents", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json-secret", { status: 200, headers })),
    );
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "invalid_response",
      code: "invalid_response",
      status: null,
      retryable: false,
    });
  });

  it("reports a non-JSON success response as an invalid response", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("provider-secret", { status: 200 })));
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledWith({
      kind: "invalid_response",
      code: "invalid_response",
      status: 200,
      retryable: false,
    });
  });

  it("reports transport failure without exposing an exception's message", async () => {
    vi.stubGlobal("window", { location: { port: "" } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret transport detail")));
    const onFailure = vi.fn();
    await expect(requestAgentIntent(request(), { onFailure })).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      kind: "transport_failure",
      code: "transport_failure",
      status: null,
      retryable: true,
    });
  });

  it("keeps fail-closed return behaviour when the diagnostic callback throws", async () => {
    const malformed = { ...request(), page_catalog: undefined } as unknown as AgentIntentRequest;
    await expect(
      requestAgentIntent(malformed, {
        onFailure() {
          throw new Error("diagnostic consumer failed");
        },
      }),
    ).resolves.toBeNull();
  });
});
