<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { EvidenceAgentBinding, PreparedEvidenceAgentRequest } from "../entities/evidence-agent";
import {
  EvidenceAgentPanel,
  evidenceAgentBackendIdentity,
  evidenceAgentFailure,
  buildEvidenceAgentSnapshotDigest,
  submitEvidenceAgentAnalysis,
} from "../features/evidence-agent";
import { buildStructuredPerformanceReport } from "../features/structured-report";
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
let bindingSynchronizationRevision = 0;
let bindingSynchronization: Promise<void> = Promise.resolve();

async function synchronizedCurrentBinding(): Promise<EvidenceAgentBinding> {
  for (;;) {
    const synchronization = bindingSynchronization;
    await synchronization;
    if (synchronization === bindingSynchronization) return agentStore.currentBindingSnapshot();
  }
}

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
  let submissionKey: string | undefined;
  try {
    const pending = agentStore.begin(binding, prepared.payloadDigest, prepared.request.client_request_id);
    submissionKey = pending.idempotencyKey;
    agentStore.attachPrepared(prepared);
    const result = await submitEvidenceAgentAnalysis({
      manifest: state.bridge.manifest,
      descriptor: state.evidenceAgent.descriptor,
      prepared,
      currentBinding: synchronizedCurrentBinding,
      idempotencyKey: pending.idempotencyKey,
    });
    agentStore.complete(result, binding, pending.idempotencyKey);
  } catch (error) {
    const failure = evidenceAgentFailure(error);
    if (!agentStore.fail(failure.state, failure.code, submissionKey)) return;
    submissionError.value = agentStore.state === "stale" ? "" : failure.code;
  }
}

function discardCurrentAnalysis() {
  submissionError.value = "";
  agentStore.discardPending();
}

watch(
  () =>
    [
      state.runId,
      backendIdentity.value,
      state.bridge.identity,
      state.artifactManifest,
      state.evidenceAgent.descriptor,
      selectedRequestId.value,
      state.bundle,
      state.inputs,
    ] as const,
  ([runId, identity, health, manifest, descriptor, requestId, bundle, inputs]) => {
    const synchronizationRevision = ++bindingSynchronizationRevision;
    agentStore.synchronize({
      runId: runId || "",
      backendIdentity: identity,
      schemaSetRevision: manifest?.schema_set_revision || "",
      inputSnapshotDigest: "",
    });
    bindingSynchronization = (async () => {
      let inputSnapshotDigest = "";
      if (runId && health && manifest && descriptor) {
        try {
          const structuredReport = buildStructuredPerformanceReport({
            bundle,
            inputs,
            runId,
            runName: state.runName,
            artifactManifest: manifest,
            selectedRequestId: requestId,
          });
          inputSnapshotDigest = await buildEvidenceAgentSnapshotDigest({
            runId,
            selectedRequestId: requestId,
            manifest,
            descriptor,
            health,
            structuredReport,
            bundle,
            inputs,
          });
        } catch {
          // An incomplete or invalid current snapshot cannot match a retained analysis.
        }
      }
      if (synchronizationRevision !== bindingSynchronizationRevision) return;
      agentStore.synchronize({
        runId: runId || "",
        backendIdentity: identity,
        schemaSetRevision: manifest?.schema_set_revision || "",
        inputSnapshotDigest,
      });
    })();
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
    @discard-pending="discardCurrentAnalysis"
  />
</template>
