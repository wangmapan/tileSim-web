import { reactive, ref } from "vue";
import { defineStore } from "pinia";
import type {
  EvidenceAgentBinding,
  EvidenceAgentUiState,
  PendingEvidenceAgentSubmission,
  PreparedEvidenceAgentRequest,
  ValidatedEvidenceAgentResult,
} from "../entities/evidence-agent";
import { EvidenceAgentContractError } from "../entities/evidence-agent";

const storageKey = "tilesim-web.evidence-agent-submission.v1";

function restorePending(): PendingEvidenceAgentSubmission | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    const fields = [
      "runId",
      "backendIdentity",
      "schemaSetRevision",
      "inputSnapshotDigest",
      "payloadDigest",
      "idempotencyKey",
      "clientRequestId",
    ];
    return value && fields.every((field) => typeof value[field] === "string" && value[field]) ? value : null;
  } catch {
    return null;
  }
}

function savePending(value: PendingEvidenceAgentSubmission | null) {
  try {
    if (value) window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    // Pinia memory state still protects the current view.
  }
}

function randomToken(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

export const useEvidenceAgentStore = defineStore("evidence-agent", () => {
  const state = ref<EvidenceAgentUiState>("idle");
  const detail = ref("");
  const pending = ref<PendingEvidenceAgentSubmission | null>(restorePending());
  const prepared = ref<PreparedEvidenceAgentRequest | null>(null);
  const result = ref<ValidatedEvidenceAgentResult | null>(null);
  const resultBinding = reactive<EvidenceAgentBinding>({
    runId: "",
    backendIdentity: "",
    schemaSetRevision: "",
    inputSnapshotDigest: "",
  });

  function begin(binding: EvidenceAgentBinding, payloadDigest: string, clientRequestId: string) {
    if (pending.value) {
      const sameBinding =
        pending.value.runId === binding.runId &&
        pending.value.backendIdentity === binding.backendIdentity &&
        pending.value.schemaSetRevision === binding.schemaSetRevision &&
        pending.value.inputSnapshotDigest === binding.inputSnapshotDigest;
      if (!sameBinding || pending.value.payloadDigest !== payloadDigest) {
        throw new EvidenceAgentContractError("idempotency_payload_conflict");
      }
      state.value = "submitting";
      return pending.value;
    }
    const next: PendingEvidenceAgentSubmission = {
      ...binding,
      payloadDigest,
      idempotencyKey: randomToken("agent-idempotency"),
      clientRequestId,
    };
    pending.value = next;
    savePending(next);
    state.value = "submitting";
    detail.value = "";
    return next;
  }

  function attachPrepared(value: PreparedEvidenceAgentRequest) {
    prepared.value = value;
  }

  function complete(value: ValidatedEvidenceAgentResult, binding: EvidenceAgentBinding) {
    result.value = value;
    Object.assign(resultBinding, binding);
    state.value = value.state;
    detail.value = value.detail;
    pending.value = null;
    savePending(null);
  }

  function fail(nextState: EvidenceAgentUiState, nextDetail: string, keepPending = false) {
    state.value = nextState;
    detail.value = nextDetail;
    if (!keepPending) {
      pending.value = null;
      savePending(null);
    }
  }

  function discardPending() {
    pending.value = null;
    savePending(null);
    if (state.value === "submitting") state.value = "idle";
  }

  function synchronize(binding: Omit<EvidenceAgentBinding, "inputSnapshotDigest">) {
    if (!result.value) return;
    if (
      resultBinding.runId !== binding.runId ||
      resultBinding.backendIdentity !== binding.backendIdentity ||
      resultBinding.schemaSetRevision !== binding.schemaSetRevision
    ) {
      state.value = "stale";
      detail.value = "stale";
    }
  }

  function resetForTests() {
    state.value = "idle";
    detail.value = "";
    pending.value = null;
    prepared.value = null;
    result.value = null;
    Object.assign(resultBinding, { runId: "", backendIdentity: "", schemaSetRevision: "", inputSnapshotDigest: "" });
    savePending(null);
  }

  return {
    state,
    detail,
    pending,
    prepared,
    result,
    resultBinding,
    begin,
    attachPrepared,
    complete,
    fail,
    discardPending,
    synchronize,
    resetForTests,
  };
});
