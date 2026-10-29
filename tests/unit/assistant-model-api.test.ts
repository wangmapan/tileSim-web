/**
 * @vitest-environment jsdom
 *
 * The assistant-model channel is optional, and that optionality is the whole
 * point: a machine with no model configured must behave exactly like before, so
 * every way of failing has to come back as `null` rather than an exception the
 * caller would have to know about. These pin that, plus the one thing the client
 * refuses to accept: a response that claims to have written or run something.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAssistantModelCatalogue,
  fetchAssistantModelDescriptor,
  requestAssistantPlan,
  selectAssistantModel,
} from "../../src/lib/api/assistant-model";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../src/contracts/generated/bridge-contracts";

afterEach(() => vi.unstubAllGlobals());

const schemaSetRevision = BRIDGE_SCHEMA_SET_REVISION;
const apiVersion = "tilesim.bridge.api.v1";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-TileSim-Schema-Set-Revision": schemaSetRevision,
      "X-TileSim-API-Version": apiVersion,
    },
  });
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "tilesim.bridge.assistant_model_plan.v1",
    schema_set_revision: schemaSetRevision,
    protocol: "tilesim.assistant_model.v1",
    provider_id: "tilesim_assistant_openai_v1",
    model_id: "deepseek-v4-flash",
    served_model: "deepseek-v4-flash",
    instruction: "跑一个高吞吐场景",
    title: "高吞吐 / 离线批量",
    rationale: "把每批塞满、放宽容纳上限。",
    settings: [{ key: "max_batch_size", value: "64", why: "提高每批处理量以吃满带宽。" }],
    dropped: [],
    answer_state: "settings",
    applied: false,
    executed: false,
    ...overrides,
  };
}

describe("assistant model plan request", () => {
  it("returns the proposal and sends the instruction to the scenario-plan route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(plan()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantPlan("跑一个高吞吐场景");

    expect(result?.title).toBe("高吞吐 / 离线批量");
    expect(result?.settings[0]).toMatchObject({ key: "max_batch_size", value: "64" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/agent/scenario-plan");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ instruction: "跑一个高吞吐场景" });
  });

  it("returns null when this Bridge has no channel configured (503)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "assistant_model_unavailable",
              message: "No assistant model channel is configured.",
              retryable: false,
            },
          },
          503,
        ),
      ),
    );

    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it("returns null when the route is not published yet (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { schema_version: "tilesim.bridge.error.v1", error: { code: "not_found", message: "unknown route" } },
            404,
          ),
        ),
    );

    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it("returns null when the transport itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it("returns null for a non-JSON answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>proxy error</html>", { headers: { "Content-Type": "text/html" } })),
    );

    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it.each([
    ["a foreign protocol", { protocol: "tilesim.something_else.v1" }],
    ["a reply that claims it was written", { applied: true }],
    ["a reply that claims it created a run", { executed: true }],
    ["a reply with no settings array", { settings: null }],
  ])("refuses %s", async (_label, overrides) => {
    // A channel that reports having written or run something is not trusted: the
    // panel's own click is the only thing allowed to write, so anything that
    // disagrees with that is treated as no answer at all.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(plan(overrides))));

    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it.each([
    ["a stale schema revision", { schema_set_revision: `sha256:${"f".repeat(64)}` }],
    ["an unknown top-level field", { extra: "unexpected" }],
    ["a plan whose instruction does not match the request", { instruction: "另一条请求" }],
  ])("fails closed for %s", async (_label, overrides) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(plan(overrides))));
    await expect(requestAssistantPlan("跑一个高吞吐场景")).resolves.toBeNull();
  });

  it("keeps dropped keys visible so the panel can explain what the model proposed but the contract refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse(plan({ dropped: [{ key: "no_such_parameter", reason: "不在参数目录里" }] }))),
    );

    const result = await requestAssistantPlan("跑一个高吞吐场景");

    expect(result?.dropped).toEqual([{ key: "no_such_parameter", reason: "不在参数目录里" }]);
  });
});

function descriptor(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "tilesim.bridge.assistant_model_descriptor.v1",
    schema_set_revision: schemaSetRevision,
    protocol: "tilesim.assistant_model.v1",
    availability: "available",
    configured: true,
    degradation_state: "available",
    detail: "The assistant model channel is configured for this Bridge process.",
    provider: {
      configured: true,
      provider_id: "tilesim_assistant_openai_v1",
      model_id: "deepseek-v4-flash",
      model_revision: "deepseek-v4-flash",
    },
    limits: { maximum_instruction_characters: 2000, maximum_settings: 20 },
    ...overrides,
  };
}

function catalogue(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "tilesim.bridge.assistant_model_catalogue.v1",
    schema_set_revision: schemaSetRevision,
    protocol: "tilesim.assistant_model.v1",
    provider_id: "tilesim_assistant_openai_v1",
    models: ["deepseek-v4-flash", "glm-5.1"],
    count: 2,
    selected_model: "deepseek-v4-flash",
    session_override: false,
    ...overrides,
  };
}

function selection(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "tilesim.bridge.assistant_model_selection.v1",
    schema_set_revision: schemaSetRevision,
    protocol: "tilesim.assistant_model.v1",
    provider_id: "tilesim_assistant_openai_v1",
    selected_model: "glm-5.1",
    previous_model: "deepseek-v4-flash",
    in_force: true,
    persisted: false,
    session_only: true,
    ...overrides,
  };
}

describe("assistant model channel descriptor", () => {
  it("reports a configured channel so the panel knows to offer its controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(descriptor()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAssistantModelDescriptor();

    expect(result?.provider.model_id).toBe("deepseek-v4-flash");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/agent/assistant-model");
  });

  it("reads an unconfigured channel as no channel at all", async () => {
    // `configured: false` is the published way of saying "this machine has no model". The panel
    // must read it as "leave the panel alone", never as "the feature is broken".
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            descriptor({ configured: false, availability: "unavailable", degradation_state: "not_configured" }),
          ),
        ),
    );

    await expect(fetchAssistantModelDescriptor()).resolves.toBeNull();
  });

  it.each([
    ["a 404 from a Bridge that does not publish the route", jsonResponse({}, 404)],
    ["a payload that is not a descriptor", jsonResponse({ protocol: "something.else" })],
  ])("returns null for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(fetchAssistantModelDescriptor()).resolves.toBeNull();
  });
});

describe("assistant model catalogue request", () => {
  it("returns the published identities and asks the catalogue route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(catalogue()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAssistantModelCatalogue();

    expect(result?.models).toEqual(["deepseek-v4-flash", "glm-5.1"]);
    expect(result?.selected_model).toBe("deepseek-v4-flash");
    expect(result?.session_override).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/agent/assistant-model-catalogue");
  });

  it("rejects a catalogue containing malformed identities instead of silently changing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(catalogue({ models: ["glm-5.1", "", "  ", 7, "x"], count: 5 }))),
    );

    await expect(fetchAssistantModelCatalogue()).resolves.toBeNull();
  });

  it("returns null when nothing usable is left, rather than emptying the dropdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(catalogue({ models: ["", "   "], count: 2 }))));

    await expect(fetchAssistantModelCatalogue()).resolves.toBeNull();
  });

  it("rejects a catalogue whose selected identity is not published in the model list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(catalogue({ selected_model: "model-not-in-list" }))));

    await expect(fetchAssistantModelCatalogue()).resolves.toBeNull();
  });

  it.each([
    ["no channel configured", jsonResponse({}, 503)],
    ["a route this Bridge does not publish", jsonResponse({}, 404)],
    ["a payload that is not a catalogue", jsonResponse({ models: ["glm-5.1"] })],
    ["a payload whose models are not an array", jsonResponse(catalogue({ models: "glm-5.1" }))],
    ["a payload whose selected_model is missing", jsonResponse(catalogue({ selected_model: undefined }))],
  ])("returns null for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(fetchAssistantModelCatalogue()).resolves.toBeNull();
  });

  it("returns null when the transport itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchAssistantModelCatalogue()).resolves.toBeNull();
  });
});

describe("assistant model selection request", () => {
  it("posts the identity and returns the confirmed switch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(selection()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await selectAssistantModel("glm-5.1");

    expect(result?.selected_model).toBe("glm-5.1");
    expect(result?.persisted).toBe(false);
    expect(result?.session_only).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/agent/assistant-model-selection");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ model: "glm-5.1" });
  });

  it("binds a selection request to the active assistant session without putting identity in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(selection()));
    vi.stubGlobal("fetch", fetchMock);

    await selectAssistantModel("glm-5.1", { sessionId: "assistant-session-a" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-TileSim-Assistant-Session"]).toBe("assistant-session-a");
    expect(JSON.parse(String(init.body))).toEqual({ model: "glm-5.1" });
  });

  it.each([
    ["a reply that claims it saved the configuration", { persisted: true }],
    ["a reply that claims the choice is permanent", { session_only: false }],
    ["a reply that does not confirm the switch", { in_force: false }],
    ["a reply that confirms a different identity", { selected_model: "" }],
  ])("refuses %s", async (_label, overrides) => {
    // The saved configuration belongs to the launcher. A channel claiming to have written it is not
    // trusted, and neither is one that will not say plainly that the choice is this session's only.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(selection(overrides))));

    await expect(selectAssistantModel("glm-5.1")).resolves.toBeNull();
  });

  it.each([
    ["an identity the Bridge refuses (400)", jsonResponse({}, 400)],
    ["no channel configured (503)", jsonResponse({}, 503)],
    ["a route this Bridge does not publish (404)", jsonResponse({}, 404)],
  ])("returns null for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(selectAssistantModel("glm-5.1")).resolves.toBeNull();
  });

  it("returns null when the transport itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(selectAssistantModel("glm-5.1")).resolves.toBeNull();
  });
});
