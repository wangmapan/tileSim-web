import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_BATCH_CONTRACT_REVISION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
} from "../../src/contracts/generated/agent-harness";
import {
  BATCH_PROVENANCE,
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
      sequence: 2,
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
});
