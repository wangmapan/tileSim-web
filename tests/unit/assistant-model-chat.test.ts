/**
 * @vitest-environment jsdom
 *
 * The chat route is what makes the assistant panel read like a conversation: the
 * answer has to appear while it is still being written, and the turns before it
 * have to travel with the question. These pin the two things that decide whether
 * that works - which frames are believed, and what the panel is told - plus the
 * one thing that must not change: a channel that is missing, unreachable, or
 * interrupted comes back as something the caller can fall back from, never as a
 * thrown error and never as a plan that claims to have written or run anything.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAssistantChat, type AssistantChatMessage } from "../../src/lib/api/assistant-model";
import { BRIDGE_SCHEMA_SET_REVISION } from "../../src/contracts/generated/bridge-contracts";

afterEach(() => vi.unstubAllGlobals());

const schemaSetRevision = BRIDGE_SCHEMA_SET_REVISION;
const chatEnvelope = "tilesim.bridge.assistant_model_chat.v1";

function plan(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "tilesim.bridge.assistant_model_plan.v1",
    schema_set_revision: schemaSetRevision,
    protocol: "tilesim.assistant_model.v1",
    provider_id: "tilesim_assistant_openai_v1",
    model_id: "deepseek-v4-flash",
    served_model: "deepseek-v4-flash",
    instruction: "再激进一点",
    answer_state: "settings",
    title: "低延迟 / 在线服务",
    rationale: "把批压小，并发降一档。",
    settings: [{ key: "max_batch_size", value: "4", why: "压住尾延迟。" }],
    dropped: [],
    applied: false,
    executed: false,
    ...overrides,
  };
}

/** One server-sent event frame, written exactly the way the Bridge writes it. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function proseFrame(text: string): string {
  return frame("prose", { schema_version: chatEnvelope, text });
}

/** A response whose body is the given frames, delivered as one event-stream. */
function streamResponse(frames: readonly string[] = []): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-TileSim-Schema-Set-Revision": schemaSetRevision,
      "X-TileSim-API-Version": "tilesim.bridge.api.v1",
    },
  });
}

/**
 * A response whose body dies part of the way through, as a dropped connection does.
 *
 * The failure is raised on the pull *after* the queued frames, because a stream that is errored while
 * it is still being constructed discards what it had queued - and "the answer arrived, then the socket
 * closed" is exactly the case a reader has to survive.
 */
function brokenStreamResponse(frames: readonly string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < frames.length) {
        controller.enqueue(encoder.encode(frames[index]));
        index += 1;
        return;
      }
      controller.error(new Error("socket closed"));
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-TileSim-Schema-Set-Revision": schemaSetRevision,
      "X-TileSim-API-Version": "tilesim.bridge.api.v1",
    },
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Collects what the panel would have been told while the stream was open, in order. */
function recorder() {
  const answers: string[] = [];
  const plans: unknown[] = [];
  return {
    answers,
    plans,
    callbacks: {
      onAnswer: (text: string) => answers.push(text),
      onPlan: (value: unknown) => plans.push(value),
    },
  };
}

const conversation: AssistantChatMessage[] = [
  { role: "user", content: "低延迟在线服务" },
  { role: "assistant", content: "先压小批量。" },
  { role: "user", content: "再激进一点" },
];

function ask(recorderResult: ReturnType<typeof recorder>, options: { signal?: AbortSignal } = {}) {
  return streamAssistantChat(
    { messages: conversation, panel_values: { max_batch_size: "8" } },
    recorderResult.callbacks,
    options,
  );
}

describe("assistant chat stream", () => {
  it("shows the answer while it is still being written, then hands over the plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            proseFrame("先压小批量。"),
            proseFrame("先压小批量。并发上限也降一点。"),
            frame("plan", plan()),
            frame("done", { schema_version: chatEnvelope }),
          ]),
        ),
    );
    const record = recorder();

    const outcome = await ask(record);

    // Every prose frame carries the answer *so far*, so the panel re-renders the
    // growing text rather than appending deltas it would have to reassemble.
    expect(record.answers).toEqual(["先压小批量。", "先压小批量。并发上限也降一点。"]);
    expect(outcome?.answer).toBe("先压小批量。并发上限也降一点。");
    expect(record.plans).toHaveLength(1);
    expect(outcome?.plan?.settings[0]).toMatchObject({ key: "max_batch_size", value: "4" });
    expect(outcome?.failure).toBe("");
    expect(outcome?.cancelled).toBe(false);
  });

  it("replays the transcript and the panel values with the turn", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(streamResponse([proseFrame("好。"), frame("done", { schema_version: chatEnvelope })]));
    vi.stubGlobal("fetch", fetchMock);

    await ask(recorder());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/agent/scenario-chat");
    expect(init.method).toBe("POST");
    // The stream is only accepted as a stream if the client asks for one.
    expect(init.headers.Accept).toBe("text/event-stream");
    // The Bridge keeps no transcript: the turns the panel already shows are the
    // context, and the panel's current values ride along as read-only context.
    expect(JSON.parse(String(init.body))).toEqual({
      messages: conversation,
      panel_values: { max_batch_size: "8" },
    });
  });

  it("falls back when this Bridge has no channel configured (503)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: { code: "assistant_model_unavailable", message: "no channel", retryable: true },
          },
          503,
        ),
      ),
    );
    const record = recorder();

    await expect(ask(record)).resolves.toBeNull();

    // Nothing was half-rendered and the caller is free to answer locally.
    expect(record.answers).toEqual([]);
  });

  it("falls back when the route is not published yet (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 404)));

    await expect(ask(recorder())).resolves.toBeNull();
  });

  it("falls back when the transport fails before the first byte", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(ask(recorder())).resolves.toBeNull();
  });

  it("falls back for a 200 that is not an event stream", async () => {
    // A proxy that answers with an HTML error page must not be read as a stream.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>proxy error</html>", { headers: { "Content-Type": "text/html" } })),
    );

    await expect(ask(recorder())).resolves.toBeNull();
  });

  it("keeps the prose that arrived and reports the failure the stream carried", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([
          proseFrame("先压小批量。"),
          frame("error", {
            schema_version: chatEnvelope,
            code: "assistant_model_timeout",
            message: "模型没有在限定时间内答完。",
            retryable: true,
          }),
        ]),
      ),
    );

    const outcome = await ask(recorder());

    // The stream stops being a stream at that point, so how the turn ended is
    // reported once, by the outcome - never as a second, racing signal.
    expect(outcome?.answer).toBe("先压小批量。");
    expect(outcome?.plan).toBeNull();
    expect(outcome?.failure).toBe("模型没有在限定时间内答完。");
  });

  it("reports a stream cut mid-answer as an interruption", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(brokenStreamResponse([proseFrame("先压小批量。")])));

    const outcome = await ask(recorder());

    expect(outcome?.answer).toBe("先压小批量。");
    expect(outcome?.plan).toBeNull();
    expect(outcome?.failure).toBe("模型回答的连接中断了。");
  });

  it("reports an abandoned turn as cancelled rather than as a failure", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException("aborted", "AbortError"));
      }),
    );

    const outcome = await ask(recorder(), { signal: controller.signal });

    // A stop the user asked for is not something to apologise for, and it is not
    // the same as a channel that could not be reached.
    expect(outcome).toEqual({ answer: "", plan: null, failure: "", cancelled: true });
  });

  it("reports a turn stopped mid-answer as cancelled, keeping what was already shown", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        const response = brokenStreamResponse([proseFrame("先压小批量。")]);
        controller.abort();
        return response;
      }),
    );
    const record = recorder();

    const outcome = await ask(record, { signal: controller.signal });

    expect(outcome?.cancelled).toBe(true);
    expect(outcome?.failure).toBe("");
    expect(outcome?.answer).toBe("先压小批量。");
  });

  it("fails closed when the stream closes without a done and validated plan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([proseFrame("只收到半句")])));
    const outcome = await ask(recorder());
    expect(outcome?.failure).toBe("模型回答没有正常结束。");
  });

  it("rejects frames after done instead of accepting a late plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            proseFrame("已完成"),
            frame("done", { schema_version: chatEnvelope }),
            frame("plan", plan()),
          ]),
        ),
    );
    const record = recorder();

    const outcome = await ask(record);

    expect(outcome?.plan).toBeNull();
    expect(outcome?.failure).toBe("模型回答格式不受支持。");
    expect(record.plans).toEqual([]);
  });

  it("fails closed on an unknown event type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([frame("future_event", {})])));
    const outcome = await ask(recorder());
    expect(outcome?.failure).toBe("模型回答格式不受支持。");
  });

  it("does not read a stream from a stale Bridge contract", async () => {
    const response = streamResponse([proseFrame("不应展示")]);
    response.headers.set("X-TileSim-Schema-Set-Revision", `sha256:${"f".repeat(64)}`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const record = recorder();
    await expect(ask(record)).resolves.toBeNull();
    expect(record.answers).toEqual([]);
  });

  it.each([
    ["a foreign protocol", { protocol: "tilesim.something_else.v1" }],
    ["a plan that claims it was written", { applied: true }],
    ["a plan that claims it created a run", { executed: true }],
    ["a plan with no settings array", { settings: null }],
  ])("refuses %s, even mid-stream", async (_label, overrides) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamResponse([proseFrame("好。"), frame("plan", plan(overrides))])),
    );
    const record = recorder();

    const outcome = await ask(record);

    // The panel's own click is the only thing allowed to write, so a proposal
    // that disagrees with that is treated as no proposal at all.
    expect(outcome?.plan).toBeNull();
    expect(record.plans).toEqual([]);
  });

  it("ignores a prose frame that is not this channel's envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([frame("prose", { schema_version: "tilesim.something_else.v1", text: "你好" })]),
        ),
    );
    const record = recorder();

    const outcome = await ask(record);

    expect(record.answers).toEqual([]);
    expect(outcome?.answer).toBe("");
    expect(outcome?.failure).toBe("模型回答没有正常结束。");
  });

  it("ignores a frame whose data cannot be read instead of ending the stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            "event: prose\ndata: {not json\n\n",
            proseFrame("先压小批量。"),
            frame("done", { schema_version: chatEnvelope }),
          ]),
        ),
    );
    const record = recorder();

    const outcome = await ask(record);

    expect(record.answers).toEqual([]);
    expect(outcome?.failure).toBe("模型回答格式不受支持。");
  });
});
