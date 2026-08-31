import { reactive, ref } from "vue";
import { defineStore } from "pinia";
import type {
  EvidenceAgentBinding,
  EvidenceAgentUiState,
  PreparedEvidenceAgentRequest,
  RetainedEvidenceAgentSubmission,
  ValidatedEvidenceAgentResult,
} from "../entities/evidence-agent";
import { EvidenceAgentContractError } from "../entities/evidence-agent";

const storageKey = "tilesim-web.evidence-agent-submission.v1";

function restorePending(): RetainedEvidenceAgentSubmission | null {
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

function savePending(value: RetainedEvidenceAgentSubmission | null) {
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

function sameBinding(left: EvidenceAgentBinding, right: EvidenceAgentBinding) {
  return (
    left.runId === right.runId &&
    left.backendIdentity === right.backendIdentity &&
    left.schemaSetRevision === right.schemaSetRevision &&
    left.inputSnapshotDigest === right.inputSnapshotDigest
  );
}

export const useEvidenceAgentStore = defineStore("evidence-agent", () => {
  const state = ref<EvidenceAgentUiState>("idle");
  const stateBeforeStale = ref<EvidenceAgentUiState | null>(null);
  const detail = ref("");
  const pending = ref<RetainedEvidenceAgentSubmission | null>(restorePending());
  const prepared = ref<PreparedEvidenceAgentRequest | null>(null);
  const result = ref<ValidatedEvidenceAgentResult | null>(null);
  const resultBinding = reactive<EvidenceAgentBinding>({
    runId: "",
    backendIdentity: "",
    schemaSetRevision: "",
    inputSnapshotDigest: "",
  });
  const currentBinding = reactive<EvidenceAgentBinding>({
    runId: "",
    backendIdentity: "",
    schemaSetRevision: "",
    inputSnapshotDigest: "",
  });

  function begin(binding: EvidenceAgentBinding, payloadDigest: string, clientRequestId: string) {
    synchronize(binding);
    if (pending.value) {
      if (
        !sameBinding(pending.value, binding) ||
        pending.value.payloadDigest !== payloadDigest ||
        pending.value.clientRequestId !== clientRequestId
      ) {
        throw new EvidenceAgentContractError("idempotency_payload_mismatch");
      }
      result.value = null;
      state.value = "submitting";
      return pending.value;
    }
    const next: RetainedEvidenceAgentSubmission = {
      ...binding,
      payloadDigest,
      idempotencyKey: randomToken("agent-idempotency"),
      clientRequestId,
    };
    pending.value = next;
    savePending(next);
    result.value = null;
    state.value = "submitting";
    detail.value = "";
    return next;
  }

  function attachPrepared(value: PreparedEvidenceAgentRequest) {
    prepared.value = value;
  }

  function ownsSubmission(idempotencyKey?: string) {
    return !idempotencyKey || pending.value?.idempotencyKey === idempotencyKey;
  }

  function complete(value: ValidatedEvidenceAgentResult, binding: EvidenceAgentBinding, idempotencyKey?: string) {
    if (!ownsSubmission(idempotencyKey)) return false;
    result.value = value;
    Object.assign(resultBinding, binding);
    state.value = value.state;
    detail.value = value.detail;
    stateBeforeStale.value = null;
    return true;
  }

  function fail(nextState: EvidenceAgentUiState, nextDetail: string, idempotencyKey?: string) {
    if (!ownsSubmission(idempotencyKey)) return false;
    if (pending.value && !sameBinding(pending.value, currentBinding)) {
      if (state.value !== "stale") stateBeforeStale.value = state.value;
      state.value = "stale";
      detail.value = "stale";
      return true;
    }
    state.value = nextState;
    detail.value = nextDetail;
    stateBeforeStale.value = null;
    return true;
  }

  function discardPending() {
    pending.value = null;
    prepared.value = null;
    result.value = null;
    Object.assign(resultBinding, { runId: "", backendIdentity: "", schemaSetRevision: "", inputSnapshotDigest: "" });
    savePending(null);
    state.value = "idle";
    detail.value = "";
    stateBeforeStale.value = null;
  }

  function synchronize(binding: EvidenceAgentBinding) {
    Object.assign(currentBinding, binding);
    const stale =
      (pending.value && !sameBinding(pending.value, binding)) || (result.value && !sameBinding(resultBinding, binding));
    if (stale) {
      if (state.value !== "stale") stateBeforeStale.value = state.value;
      state.value = "stale";
      detail.value = "stale";
    } else if (state.value === "stale" && stateBeforeStale.value) {
      state.value = stateBeforeStale.value;
      detail.value = result.value?.detail || "";
      stateBeforeStale.value = null;
    }
  }

  function currentBindingSnapshot(): EvidenceAgentBinding {
    return { ...currentBinding };
  }

  function resetForTests() {
    state.value = "idle";
    stateBeforeStale.value = null;
    detail.value = "";
    pending.value = null;
    prepared.value = null;
    result.value = null;
    Object.assign(resultBinding, { runId: "", backendIdentity: "", schemaSetRevision: "", inputSnapshotDigest: "" });
    Object.assign(currentBinding, { runId: "", backendIdentity: "", schemaSetRevision: "", inputSnapshotDigest: "" });
    savePending(null);
  }

  return {
    state,
    detail,
    pending,
    prepared,
    result,
    resultBinding,
    currentBinding,
    begin,
    attachPrepared,
    complete,
    fail,
    discardPending,
    synchronize,
    currentBindingSnapshot,
    resetForTests,
  };
});
