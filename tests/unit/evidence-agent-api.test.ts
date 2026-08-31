/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeApi } from "../../src/lib/api";
import {
  createCompletedAgentResponse,
  createEvidenceAgentDescriptor,
  f9ApiManifest,
  f9RunId,
  f9SchemaRevision,
} from "../fixtures/evidence-agent";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(value: unknown, status = 200, revision = f9SchemaRevision) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-TileSim-Schema-Set-Revision": revision,
    },
  });
}

describe("F9 Agent API contract discovery", () => {
  it("binds the descriptor to manifest, payload and response-header revisions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(createEvidenceAgentDescriptor(false)));
    vi.stubGlobal("fetch", fetchMock);

    const descriptor = await bridgeApi.evidenceAgentCapabilities(f9ApiManifest);

    expect(descriptor.degradation.reason_code).toBe("provider_unavailable");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/agent/evidence-capabilities");
  });

  it("fails closed on a descriptor revision mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(createEvidenceAgentDescriptor(false), 200, `sha256:${"0".repeat(64)}`)),
    );

    await expect(bridgeApi.evidenceAgentCapabilities(f9ApiManifest)).rejects.toMatchObject({
      code: "evidence_agent_revision_mismatch",
    });
  });

  it("parses a structured provider_unavailable terminal response even when HTTP is 503", async () => {
    const response = createCompletedAgentResponse(`sha256:${"a".repeat(64)}`, "agent-client:provider-unavailable", {
      schema_version: "tilesim.bridge.evidence_agent_citation.v1",
      run_id: f9RunId,
      artifact_id: "metrics",
      schema_identity: "tilesim.metrics_report.v1",
      sha256: "2".repeat(64),
      json_pointer: "/request_metrics/0",
      subject: { kind: "request", id: "req-f9-p99" },
      citation_role: "direct_fact",
      availability: "available",
    });
    response.completion_state = "refused";
    response.provider = createEvidenceAgentDescriptor(false).provider;
    response.claims = [];
    response.refusal = { reason_code: "provider_unavailable", detail: "Provider not configured.", retryable: false };
    response.degradation = { state: "not_configured", reason_code: "provider_unavailable" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response, 503)));

    const terminal = await bridgeApi.createEvidenceAnalysis(
      f9ApiManifest,
      f9RunId,
      '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
      "agent-idempotency:test",
    );

    expect(terminal.httpStatus).toBe(503);
    expect(terminal.payload.refusal?.reason_code).toBe("provider_unavailable");
  });
});
