import { describe, expect, it } from "vitest";
import { adaptEvidenceAgentDescriptor } from "../../src/adapters/evidence-agent-descriptor";
import type { EvidenceAgentDescriptorResponse } from "../../src/contracts/bridge-api";
import { createEvidenceAgentDescriptor } from "../fixtures/evidence-agent";

describe("F9 descriptor v2 adapter", () => {
  it("maps structured retry, recovery, persistence, and payload retention without changing v1 child identities", () => {
    const view = adaptEvidenceAgentDescriptor(createEvidenceAgentDescriptor());

    expect(view.identity.schemaVersion).toBe("tilesim.bridge.evidence_agent_descriptor.v2");
    expect(view.schemaIdentities).toMatchObject({
      request: "tilesim.bridge.evidence_agent_request.v1",
      response: "tilesim.bridge.evidence_agent_response.v1",
      citation: "tilesim.bridge.evidence_agent_citation.v1",
      snapshot_reference: "tilesim.bridge.evidence_snapshot_reference.v1",
    });
    expect(view.execution.retry).toMatchObject({
      inProcess: "exact_terminal_replay",
      afterRestartClaimFreeBridgeTerminal: "exact_terminal_replay_from_redacted_record",
      afterRestartClaimsBearingTerminal: "error_terminal_result_not_retained",
      afterRestartClaimFreeProviderTerminal: "error_terminal_result_not_retained",
      providerReinvocation: "forbidden",
    });
    expect(view.execution.recovery.claimsBearingTerminal).toMatchObject({
      http_status: 409,
      code: "terminal_result_not_retained",
      field_path: "/headers/Idempotency-Key",
      retryable: false,
    });
    expect(view.persistence.mode).toEqual({
      storage_scope: "run_local",
      record_kind: "redacted_terminal_metadata_only",
      record_schema_identity: "tilesim.bridge.evidence_agent_terminal_record.v2",
    });
    expect(Object.values(view.persistence.payloadRetention)).toEqual([false, false, false, false, false, false, false]);
  });

  it("fails closed when persistence and terminal recovery advertise different record identities", () => {
    const descriptor = structuredClone(createEvidenceAgentDescriptor()) as EvidenceAgentDescriptorResponse;
    descriptor.execution.terminal_recovery.record_schema_identity = "tilesim.bridge.evidence_agent_terminal_record.v2";
    (descriptor.persistence.mode as { record_schema_identity: string }).record_schema_identity =
      "tilesim.bridge.evidence_agent_terminal_record.invalid";

    expect(() => adaptEvidenceAgentDescriptor(descriptor)).toThrowError(
      expect.objectContaining({ code: "descriptor_policy_inconsistent" }),
    );
  });

  it("fails closed if any protected payload class is advertised as retained", () => {
    const descriptor = structuredClone(createEvidenceAgentDescriptor()) as EvidenceAgentDescriptorResponse;
    (descriptor.persistence.payload_retention as { user_question_retained: boolean }).user_question_retained = true;

    expect(() => adaptEvidenceAgentDescriptor(descriptor)).toThrowError(
      expect.objectContaining({ code: "descriptor_policy_inconsistent" }),
    );
  });
});
