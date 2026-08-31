<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { EvidenceAgentBinding, PreparedEvidenceAgentRequest } from "../entities/evidence-agent";
import {
  EvidenceAgentContractError,
  EvidenceAgentPanel,
  evidenceAgentBackendIdentity,
  evidenceAgentFailure,
  submitEvidenceAgentAnalysis,
} from "../features/evidence-agent";
import { useDashboard } from "../store/dashboard";
import { useEvidenceAgentStore } from "../stores/evidence-agent";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";

const { state } = useDashboard();
const selection = useEvidenceSelectionStore();
const agentStore = useEvidenceAgentStore();
const route = useRoute();
const router = useRouter();
const submissionError = ref("");
const selectedRequestId = computed(() => selection.requestForRun(state.runId));
const backendIdentity = computed(() => evidenceAgentBackendIdentity(state.bridge.identity));

function selectRequest(requestId: string) {
  if (!state.runId || !requestId) return;
  selection.select(state.runId, requestId);
  void router.push({
    name: route.name || "evidence_agent",
    query: { ...route.query, run: state.runId, evidence_request: requestId },
  });
}

async function submitPrepared(prepared: PreparedEvidenceAgentRequest, binding: EvidenceAgentBinding) {
  submissionError.value = "";
  if (!state.bridge.manifest || !state.evidenceAgent.descriptor) return;
  agentStore.attachPrepared(prepared);
  const pending = agentStore.begin(binding, prepared.payloadDigest, prepared.request.client_request_id);
  if (pending.clientRequestId !== prepared.request.client_request_id) {
    submissionError.value = "idempotency_client_request_mismatch";
    throw new EvidenceAgentContractError(submissionError.value);
  }
  try {
    const result = await submitEvidenceAgentAnalysis({
      manifest: state.bridge.manifest,
      descriptor: state.evidenceAgent.descriptor,
      prepared,
      binding,
      idempotencyKey: pending.idempotencyKey,
    });
    agentStore.complete(result, binding);
  } catch (error) {
    const failure = evidenceAgentFailure(error);
    submissionError.value = failure.code;
    agentStore.fail(failure.state, failure.code, failure.keepPending);
  }
}

watch(
  () => [state.runId, backendIdentity.value, state.artifactManifest?.schema_set_revision] as const,
  ([runId, identity, revision]) => {
    agentStore.synchronize({ runId: runId || "", backendIdentity: identity, schemaSetRevision: revision || "" });
  },
  { immediate: true },
);
</script>

<template>
  <EvidenceAgentPanel
    :descriptor="state.evidenceAgent.descriptor"
    :descriptor-status="state.evidenceAgent.status"
    :descriptor-error="state.evidenceAgent.error"
    :run-id="state.runId"
    :run-name="state.runName"
    :selected-request-id="selectedRequestId"
    :manifest="state.artifactManifest"
    :api-manifest="state.bridge.manifest"
    :health="state.bridge.identity"
    :bundle="state.bundle"
    :inputs="state.inputs"
    :agent-state="agentStore.state"
    :agent-result="agentStore.result"
    :pending="agentStore.pending"
    :submission-error="submissionError"
    @request-selected="selectRequest"
    @submit-prepared="submitPrepared"
    @discard-pending="agentStore.discardPending"
  />
</template>
