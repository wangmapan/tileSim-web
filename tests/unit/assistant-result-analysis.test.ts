/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAssistantResultAnalysis, type AssistantChatMessage } from "../../src/lib/api/assistant-model";

afterEach(() => vi.unstubAllGlobals());

const schema = "tilesim.bridge.result_analysis_chat.v1";
const conversation: AssistantChatMessage[] = [{ role: "user", content: "请指出当前结果重点" }];
const context = {
  run_id: "run-result-1",
  sections: [{ title: "速览", body: "吞吐 12 req/s（/metrics/summary）。" }],
  evidence_paths: ["/metrics/summary"],
  evidence: {
    manifest_status: "verified" as const,
    artifact_count: 1,
    full_content_count: 1,
    summary_only_count: 0,
    unavailable_count: 0,
    rejected_count: 0,
    artifacts: [
      {
        artifact_id: "metrics",
        file_name: "metrics.json",
        report_kind: "metrics",
        schema_identity: "tilesim.metrics_report.v1",
        sha256: "a".repeat(64),
        bytes: "120",
        contract_status: "supported" as const,
        content_status: "full" as const,
        content: { summary: { throughput_requests_per_second: 12 } },
      },
    ],
    rejected_artifacts: [],
  },
};

function response(frames: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((frame) => controller.enqueue(encoder.encode(frame)));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("result analysis model stream", () => {
  it("streams only the read-only prose route and replays the verified context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response([
          frame("prose", { schema_version: schema, text: "重点是吞吐。" }),
          frame("prose", { schema_version: schema, text: "重点是吞吐，仍需核对 P99。" }),
          frame("done", { schema_version: schema }),
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const answers: string[] = [];

    const outcome = await streamAssistantResultAnalysis(
      { messages: conversation, context },
      { onAnswer: (text) => answers.push(text) },
    );

    expect(outcome).toMatchObject({ answer: "重点是吞吐，仍需核对 P99。", failure: "", cancelled: false });
    expect(answers).toEqual(["重点是吞吐。", "重点是吞吐，仍需核对 P99。"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/agent/result-analysis");
    expect(JSON.parse(String(init.body))).toEqual({ messages: conversation, context });
  });

  it("returns null for an unavailable optional channel so the caller can use deterministic guidance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(
      streamAssistantResultAnalysis({ messages: conversation, context }, { onAnswer: () => undefined }),
    ).resolves.toBeNull();
  });

  it("keeps a safe diagnostic when the Bridge rejects the evidence contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "invalid_result_analysis_request" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      streamAssistantResultAnalysis({ messages: conversation, context }, { onAnswer: () => undefined }),
    ).resolves.toMatchObject({
      answer: "",
      failure: "模型请求未通过校验（invalid_result_analysis_request）。",
      cancelled: false,
    });
  });
});
