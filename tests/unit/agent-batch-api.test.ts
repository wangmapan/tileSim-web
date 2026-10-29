import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_BATCH_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
} from "../../src/contracts/generated/agent-harness";
import {
  BATCH_PROVENANCE,
  getAgentBatch,
  getAgentBatchEvents,
  listAgentBatches,
  observeAgentBatchEvents,
} from "../../src/lib/api/agent-batch";

const headers: Record<string, string> = {
  "content-type": "application/json",
  "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
  "x-tilesim-schema-set-revision": AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
};

function batch(schemaSetRevision: string = AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION) {
  return {
    schema_identity: "tilesim.agent_harness.batch_session.v1",
    contract_revision: AGENT_HARNESS_BATCH_CONTRACT_REVISION,
    batch_id: "batch-test",
    schema_set_revision: schemaSetRevision,
    local_dev: true,
    approval_required: true,
    provenance: BATCH_PROVENANCE,
  };
}

function jsonResponse(payload: unknown, responseHeaders: Record<string, string> = headers) {
  return new Response(JSON.stringify(payload), { status: 200, headers: responseHeaders });
}

afterEach(() => vi.unstubAllGlobals());

describe("Stage 5 batch API boundaries", () => {
  it("rejects stale batch identity even when the server response is otherwise shaped correctly", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const stale = `sha256:${"f".repeat(64)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { batches: [batch(stale)] },
          {
            ...headers,
            "x-tilesim-schema-set-revision": stale,
          },
        ),
      ),
    );

    await expect(listAgentBatches()).rejects.toMatchObject({ code: "schema_revision_mismatch" });
  });

  it("rejects an SSE gap before forwarding an event to the query layer", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const event = {
      schema_identity: "tilesim.agent_harness.batch_event.v1",
      contract_revision: AGENT_HARNESS_BATCH_CONTRACT_REVISION,
      batch_id: "batch-test",
      event_id: "event-2",
      sequence: 2,
      state: "running",
      node: "worker",
      payload_digest: `sha256:${"2".repeat(64)}`,
      created_at: "2026-10-19T00:00:00Z",
      provenance: BATCH_PROVENANCE,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: workflow\ndata: ${JSON.stringify(event)}\n\n`, {
          status: 200,
          headers: { ...headers, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    const onEvent = vi.fn();

    await expect(observeAgentBatchEvents("batch-test", { onEvent })).rejects.toMatchObject({
      code: "event_sequence_gap",
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("rejects an empty replay from another batch", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          batch_id: "batch-other",
          events: [],
          after_sequence: 4,
          terminal: true,
          provenance: BATCH_PROVENANCE,
        }),
      ),
    );

    await expect(getAgentBatchEvents("batch-test", "4")).rejects.toMatchObject({ code: "batch_id_mismatch" });
  });

  it("rejects a replay whose returned cursor differs from the requested cursor", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          batch_id: "batch-test",
          events: [],
          after_sequence: 5,
          terminal: false,
          provenance: BATCH_PROVENANCE,
        }),
      ),
    );

    await expect(getAgentBatchEvents("batch-test", "4")).rejects.toMatchObject({ code: "event_sequence_gap" });
  });

  it("rejects a batch detail that carries an unvalidated event", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ batch: batch(), candidates: [], events: [{ batch_id: "batch-test", sequence: 1 }] }),
        ),
    );

    await expect(getAgentBatch("batch-test")).rejects.toMatchObject({ code: "schema_identity_mismatch" });
  });

  it("rejects an SSE response whose contract headers are stale", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const stale = `sha256:${"e".repeat(64)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
            "x-tilesim-schema-set-revision": stale,
          },
        }),
      ),
    );

    await expect(observeAgentBatchEvents("batch-test")).rejects.toMatchObject({ code: "schema_revision_mismatch" });
  });

  it("rejects a terminal SSE frame that is not a published batch state", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: terminal\ndata: ${JSON.stringify({ batch_id: "batch-test", state: "running" })}\n\n`, {
          status: 200,
          headers: { ...headers, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );
    await expect(observeAgentBatchEvents("batch-test")).rejects.toMatchObject({ code: "invalid_batch_event" });
  });

  it("rejects a batch stream that ends before a terminal frame", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const event = {
      schema_identity: "tilesim.agent_harness.batch_event.v1",
      contract_revision: AGENT_HARNESS_BATCH_CONTRACT_REVISION,
      batch_id: "batch-test",
      event_id: "event-1",
      sequence: 1,
      state: "running",
      node: "worker",
      payload_digest: `sha256:${"1".repeat(64)}`,
      created_at: "2026-10-19T00:00:00Z",
      provenance: BATCH_PROVENANCE,
    };
    const onEvent = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: workflow\nid: 1\ndata: ${JSON.stringify(event)}\n\n`, {
          status: 200,
          headers: { ...headers, "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );

    await expect(observeAgentBatchEvents("batch-test", { onEvent })).rejects.toMatchObject({
      code: "incomplete_batch_stream",
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
