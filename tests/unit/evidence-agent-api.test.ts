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
    const descriptor = createEvidenceAgentDescriptor(false);
    descriptor.descriptor_revision = `sha256:${"0".repeat(64)}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(descriptor)));

    await expect(bridgeApi.evidenceAgentCapabilities(f9ApiManifest)).rejects.toMatchObject({
      code: "evidence_agent_identity_mismatch",
    });
  });

  it("fails closed when the descriptor response header does not match the manifest schema set", async () => {
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

  it.each([
    [502, "failed", "unsupported_schema"],
    [504, "timeout", "timeout"],
  ] as const)("parses a formal %i terminal response", async (status, completionState, reasonCode) => {
    const response = createCompletedAgentResponse(`sha256:${"a".repeat(64)}`, `agent-client:http-${status}`, {
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
    response.completion_state = completionState;
    response.claims = [];
    response.refusal = { reason_code: reasonCode, detail: reasonCode, retryable: status === 504 };
    response.degradation = { state: reasonCode, reason_code: reasonCode };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response, status)));

    const terminal = await bridgeApi.createEvidenceAnalysis(
      f9ApiManifest,
      f9RunId,
      '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
      `agent-idempotency:http-${status}`,
    );

    expect(terminal.httpStatus).toBe(status);
    expect(terminal.payload.completion_state).toBe(completionState);
    expect(terminal.payload.refusal?.reason_code).toBe(reasonCode);
  });

  it("fails closed when HTTP status contradicts the formal terminal completion state", async () => {
    const response = createCompletedAgentResponse(`sha256:${"a".repeat(64)}`, "agent-client:wrong-http-status", {
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response, 502)));

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:wrong-http-status",
      ),
    ).rejects.toMatchObject({
      status: 502,
      code: "evidence_agent_terminal_status_mismatch",
    });
  });

  it("rejects a 503 provider_unavailable terminal with a contradictory completion state", async () => {
    const response = createCompletedAgentResponse(
      `sha256:${"a".repeat(64)}`,
      "agent-client:wrong-provider-completion",
      {
        schema_version: "tilesim.bridge.evidence_agent_citation.v1",
        run_id: f9RunId,
        artifact_id: "metrics",
        schema_identity: "tilesim.metrics_report.v1",
        sha256: "2".repeat(64),
        json_pointer: "/request_metrics/0",
        subject: { kind: "request", id: "req-f9-p99" },
        citation_role: "direct_fact",
        availability: "available",
      },
    );
    response.completion_state = "failed";
    response.claims = [];
    response.refusal = { reason_code: "provider_unavailable", detail: "contradictory", retryable: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response, 503)));

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:wrong-provider-completion",
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "evidence_agent_terminal_status_mismatch",
    });
  });

  it("rejects an error envelope for formal 502/503/504 terminal statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "provider_unavailable",
              message: "Wrong envelope for a formal terminal.",
              field_path: "/provider",
              retryable: true,
            },
            request_id: "request-wrong-terminal-envelope",
          },
          503,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:wrong-terminal-envelope",
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "invalid_evidence_agent_response",
    });
  });

  it("keeps terminal_result_not_retained as a structured 409 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "terminal_result_not_retained",
              message: "The claims terminal was intentionally not retained.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "request-terminal-not-retained",
          },
          409,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:retained-gap",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "terminal_result_not_retained",
      retryable: false,
      fieldPath: "/headers/Idempotency-Key",
      requestId: "request-terminal-not-retained",
    });
  });

  it("keeps idempotency_payload_mismatch as a structured 409 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "idempotency_payload_mismatch",
              message: "The key is already bound to a different canonical payload.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "request-idempotency-payload-mismatch",
          },
          409,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:payload-mismatch",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "idempotency_payload_mismatch",
      retryable: false,
      fieldPath: "/headers/Idempotency-Key",
    });
  });

  it("rejects an informal 409 object that is not the formal Bridge error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "terminal_result_not_retained",
              message: "Missing the formal envelope identity.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "request-informal-error",
          },
          409,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:informal-error",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "invalid_evidence_agent_response",
    });
  });

  it("rejects an unexpected error code in a formal 409 envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "provider_unavailable",
              message: "This code is not a formal 409 outcome.",
              field_path: "/provider",
              retryable: false,
            },
            request_id: "request-unexpected-409-code",
          },
          409,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:unexpected-409-code",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "invalid_evidence_agent_response",
    });
  });

  it("fails closed when a formal 409 error has a stale schema-set header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "terminal_result_not_retained",
              message: "Formal error with stale revision.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "request-stale-error-revision",
          },
          409,
          `sha256:${"0".repeat(64)}`,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:stale-error-revision",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "evidence_agent_revision_mismatch",
    });
  });

  it("fails closed when a terminal recovery code does not use the fixed 409 mapping", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "terminal_result_not_retained",
              message: "The mapping is intentionally malformed.",
              field_path: "/request",
              retryable: true,
            },
            request_id: "request-invalid-error-mapping",
          },
          409,
        ),
      ),
    );

    await expect(
      bridgeApi.createEvidenceAnalysis(
        f9ApiManifest,
        f9RunId,
        '{"schema_version":"tilesim.bridge.evidence_agent_request.v1"}',
        "agent-idempotency:invalid-error-mapping",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "invalid_evidence_agent_response",
    });
  });
});
