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
    const result = await requestAgentIntent(request());
    expect(result?.intent).toBe("navigation");
    expect(result?.candidate_pages[0]?.page_id).toBe("metrics");
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
    await expect(requestAgentIntent(request())).resolves.toBeNull();
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
    await expect(requestAgentIntent(request())).resolves.toBeNull();
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
    await expect(requestAgentIntent(malformed)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
