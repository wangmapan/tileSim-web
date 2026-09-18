import type { EvidenceAgentDescriptorResponse } from "../contracts/bridge-api";
import { EvidenceAgentContractError } from "../entities/evidence-agent";

type Descriptor = EvidenceAgentDescriptorResponse;
interface PolicyErrorOutcome {
  outcome: string;
  http_status: number;
  code?: string;
  field_path: string;
  retryable: boolean;
}

export interface EvidenceAgentDescriptorPolicyView {
  identity: {
    schemaVersion: Descriptor["schema_version"];
    schemaSetRevision: string;
    descriptorRevision: string;
  };
  schemaIdentities: Descriptor["schema_identities"];
  execution: {
    mode: Descriptor["execution"]["mode"];
    timeoutMs: number;
    retry: {
      payloadIdentity: Descriptor["execution"]["retry"]["payload_identity"];
      inProcess: Descriptor["execution"]["retry"]["same_key_same_canonical_payload"]["in_process"];
      afterRestartClaimFreeBridgeTerminal: Descriptor["execution"]["retry"]["same_key_same_canonical_payload"]["after_restart_claim_free_bridge_terminal"];
      afterRestartClaimsBearingTerminal: Descriptor["execution"]["retry"]["same_key_same_canonical_payload"]["after_restart_claims_bearing_terminal"];
      afterRestartClaimFreeProviderTerminal: Descriptor["execution"]["retry"]["same_key_same_canonical_payload"]["after_restart_claim_free_provider_terminal"];
      providerReinvocation: Descriptor["execution"]["retry"]["same_key_same_canonical_payload"]["provider_reinvocation"];
      differentPayload: Descriptor["execution"]["retry"]["same_key_different_canonical_payload"];
    };
    recovery: {
      recordScope: Descriptor["execution"]["terminal_recovery"]["record_scope"];
      recordSchemaIdentity: Descriptor["execution"]["terminal_recovery"]["record_schema_identity"];
      claimFreeBridgeTerminal: Descriptor["execution"]["terminal_recovery"]["claim_free_bridge_terminal"];
      claimsBearingTerminal: Descriptor["execution"]["terminal_recovery"]["claims_bearing_terminal"];
      claimFreeProviderTerminal: Descriptor["execution"]["terminal_recovery"]["claim_free_provider_terminal"];
      providerReinvocation: Descriptor["execution"]["terminal_recovery"]["provider_reinvocation"];
    };
  };
  persistence: {
    mode: Descriptor["persistence"]["mode"];
    retentionSeconds: number;
    terminalClasses: Descriptor["persistence"]["terminal_classes"];
    payloadRetention: Descriptor["persistence"]["payload_retention"];
  };
}

function fail(field: string): never {
  throw new EvidenceAgentContractError("descriptor_policy_inconsistent", field);
}

function assertErrorOutcome(value: PolicyErrorOutcome, code: string, field: string) {
  if (
    value.outcome !== "error" ||
    value.http_status !== 409 ||
    value.code !== code ||
    value.field_path !== "/headers/Idempotency-Key" ||
    value.retryable !== false
  ) {
    fail(field);
  }
}

export function adaptEvidenceAgentDescriptor(descriptor: Descriptor): EvidenceAgentDescriptorPolicyView {
  const retry = descriptor.execution.retry;
  const recovery = descriptor.execution.terminal_recovery;
  const persistence = descriptor.persistence;

  if (
    persistence.mode.storage_scope !== recovery.record_scope ||
    persistence.mode.record_schema_identity !== recovery.record_schema_identity
  ) {
    fail("/persistence/mode");
  }
  if (
    retry.payload_identity !== "tilesim.bridge.canonical_json.v1_sha256" ||
    retry.same_key_same_canonical_payload.in_process !== "exact_terminal_replay" ||
    retry.same_key_same_canonical_payload.after_restart_claim_free_bridge_terminal !==
      "exact_terminal_replay_from_redacted_record" ||
    recovery.claim_free_bridge_terminal.outcome !== "exact_terminal_replay" ||
    recovery.claim_free_bridge_terminal.source !== "redacted_terminal_metadata"
  ) {
    fail("/execution/terminal_recovery/claim_free_bridge_terminal");
  }
  if (
    retry.same_key_same_canonical_payload.after_restart_claims_bearing_terminal !==
      "error_terminal_result_not_retained" ||
    retry.same_key_same_canonical_payload.after_restart_claim_free_provider_terminal !==
      "error_terminal_result_not_retained"
  ) {
    fail("/execution/retry/same_key_same_canonical_payload");
  }
  if (
    retry.same_key_same_canonical_payload.provider_reinvocation !== recovery.provider_reinvocation ||
    recovery.provider_reinvocation !== "forbidden"
  ) {
    fail("/execution/terminal_recovery/provider_reinvocation");
  }
  assertErrorOutcome(
    retry.same_key_different_canonical_payload,
    "idempotency_payload_mismatch",
    "/execution/retry/same_key_different_canonical_payload",
  );
  assertErrorOutcome(
    recovery.claims_bearing_terminal,
    "terminal_result_not_retained",
    "/execution/terminal_recovery/claims_bearing_terminal",
  );
  assertErrorOutcome(
    recovery.claim_free_provider_terminal,
    "terminal_result_not_retained",
    "/execution/terminal_recovery/claim_free_provider_terminal",
  );
  if (
    persistence.mode.record_kind !== "redacted_terminal_metadata_only" ||
    Object.values(persistence.payload_retention).some((retained) => retained !== false) ||
    persistence.terminal_classes.claim_free_bridge_terminal.terminal_metadata_retained !== true ||
    persistence.terminal_classes.claim_free_bridge_terminal.exact_response_recoverable_after_restart !== true ||
    persistence.terminal_classes.claims_bearing_terminal.terminal_metadata_retained !== true ||
    persistence.terminal_classes.claims_bearing_terminal.validated_model_claims_retained !== false ||
    persistence.terminal_classes.claims_bearing_terminal.exact_response_recoverable_after_restart !== false ||
    persistence.terminal_classes.claim_free_provider_terminal.terminal_metadata_retained !== true ||
    persistence.terminal_classes.claim_free_provider_terminal.validated_provider_response_retained !== false ||
    persistence.terminal_classes.claim_free_provider_terminal.exact_response_recoverable_after_restart !== false
  ) {
    fail("/persistence");
  }

  return {
    identity: {
      schemaVersion: descriptor.schema_version,
      schemaSetRevision: descriptor.schema_set_revision,
      descriptorRevision: descriptor.descriptor_revision,
    },
    schemaIdentities: descriptor.schema_identities,
    execution: {
      mode: descriptor.execution.mode,
      timeoutMs: descriptor.execution.timeout_ms,
      retry: {
        payloadIdentity: retry.payload_identity,
        inProcess: retry.same_key_same_canonical_payload.in_process,
        afterRestartClaimFreeBridgeTerminal:
          retry.same_key_same_canonical_payload.after_restart_claim_free_bridge_terminal,
        afterRestartClaimsBearingTerminal: retry.same_key_same_canonical_payload.after_restart_claims_bearing_terminal,
        afterRestartClaimFreeProviderTerminal:
          retry.same_key_same_canonical_payload.after_restart_claim_free_provider_terminal,
        providerReinvocation: retry.same_key_same_canonical_payload.provider_reinvocation,
        differentPayload: retry.same_key_different_canonical_payload,
      },
      recovery: {
        recordScope: recovery.record_scope,
        recordSchemaIdentity: recovery.record_schema_identity,
        claimFreeBridgeTerminal: recovery.claim_free_bridge_terminal,
        claimsBearingTerminal: recovery.claims_bearing_terminal,
        claimFreeProviderTerminal: recovery.claim_free_provider_terminal,
        providerReinvocation: recovery.provider_reinvocation,
      },
    },
    persistence: {
      mode: persistence.mode,
      retentionSeconds: persistence.retention_seconds,
      terminalClasses: persistence.terminal_classes,
      payloadRetention: persistence.payload_retention,
    },
  };
}
