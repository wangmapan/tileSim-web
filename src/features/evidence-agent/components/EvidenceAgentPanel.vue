<script setup lang="ts">
import { CircleSlash2, Send, ShieldCheck } from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";
import { adaptEvidenceAgentDescriptor } from "../../../adapters/evidence-agent-descriptor";
import type {
  ArtifactManifestResponse,
  ApiManifestResponse,
  EvidenceAgentDescriptorResponse,
  HealthResponse,
} from "../../../contracts/bridge-api";
import type { EvidenceAgentRequest } from "../../../contracts/generated/bridge-contracts";
import type { ReportBundle, RunInputs } from "../../../contracts/report-model";
import type {
  EvidenceAgentBinding,
  EvidenceAgentUiState,
  PreparedEvidenceAgentRequest,
  RetainedEvidenceAgentSubmission,
  ValidatedEvidenceAgentResult,
} from "../../../entities/evidence-agent";
import { useI18n, currentLocale } from "../../../i18n";
import { buildRunBoundEvidenceChain } from "../../run-bound-evidence";
import { buildStructuredPerformanceReport } from "../../structured-report";
import { EvidenceAgentContractError } from "../errors";
import { buildEvidenceAgentRequest, evidenceAgentBackendIdentity } from "../request-builder";
import EvidenceAgentContractPolicy from "./EvidenceAgentContractPolicy.vue";
import EvidenceAgentResultPanel from "./EvidenceAgentResultPanel.vue";
import EvidenceAgentServiceDetails from "./EvidenceAgentServiceDetails.vue";
import EvidenceAgentSubmissionLeaseNotice from "./EvidenceAgentSubmissionLeaseNotice.vue";
import EvidenceAgentSubmissionPreview from "./EvidenceAgentSubmissionPreview.vue";
import EvidenceAgentTaskCards from "./EvidenceAgentTaskCards.vue";

const props = defineProps<{
  descriptor: EvidenceAgentDescriptorResponse | null;
  descriptorStatus: "supported" | "legacy_compatibility" | "contract_error";
  descriptorError: string;
  runId: string | null;
  runName: string;
  selectedRequestId: string | null;
  manifest: ArtifactManifestResponse | null;
  apiManifest: ApiManifestResponse | null;
  health: HealthResponse | null;
  bundle: ReportBundle;
  inputs: RunInputs;
  agentState: EvidenceAgentUiState;
  agentResult: ValidatedEvidenceAgentResult | null;
  pending: RetainedEvidenceAgentSubmission | null;
  prepared: PreparedEvidenceAgentRequest | null;
  submissionError: string;
}>();
const emit = defineEmits<{
  requestSelected: [requestId: string];
  submitPrepared: [prepared: PreparedEvidenceAgentRequest, binding: EvidenceAgentBinding];
  discardPending: [];
}>();
const { t } = useI18n();
const question = ref(t("请解释当前 request 的 P99 与尾延迟证据边界。"));
const questionInput = ref<HTMLTextAreaElement | null>(null);
const taskKind = ref<EvidenceAgentRequest["task_kind"]>("explain_p99");
const localError = ref("");

const backendIdentity = computed(() => evidenceAgentBackendIdentity(props.health));
const descriptorPolicy = computed(() => (props.descriptor ? adaptEvidenceAgentDescriptor(props.descriptor) : null));
const chain = computed(() =>
  buildRunBoundEvidenceChain({
    runId: props.runId,
    requestId: props.selectedRequestId,
    bundle: props.bundle,
    inputs: props.inputs,
    artifactManifest: props.manifest,
  }),
);
const supportedArtifacts = computed(
  () => props.manifest?.artifacts.filter((entry) => entry.contract_status === "supported") || [],
);
const supportedArtifactIds = computed(() => new Set(supportedArtifacts.value.map((entry) => entry.artifact_id)));
const citableReferences = computed(() => {
  const references = [
    ...chain.value.percentileSubjects.flatMap((subject) => (subject.reference ? [subject.reference] : [])),
    ...chain.value.nodes.flatMap((node) => node.references),
    ...(chain.value.week8Execution.reference ? [chain.value.week8Execution.reference] : []),
  ];
  const unique = new Map<string, (typeof references)[number]>();
  for (const reference of references) {
    const artifact = props.manifest?.artifacts.find((entry) => entry.artifact_id === reference.artifactId);
    if (
      artifact?.contract_status !== "supported" ||
      artifact.schema_identity !== reference.schemaIdentity ||
      artifact.sha256 !== reference.sha256
    ) {
      continue;
    }
    unique.set(
      `${reference.artifactId}\u0000${reference.jsonPointer}\u0000${reference.entityKind}\u0000${reference.entityId}`,
      reference,
    );
  }
  return [...unique.values()];
});
const citableArtifactCount = computed(() => new Set(citableReferences.value.map((entry) => entry.artifactId)).size);
const previewProvenance = computed(
  () =>
    chain.value.week8Execution.provenance || {
      sourceMode: "not_covered",
      calibrationLevel: "not_covered",
      allowedClaimScope: "not_covered",
    },
);
const snapshotReadiness = computed(() => {
  if (!props.runId) {
    return { state: "missing" as const, title: "先运行一次实验", detail: "AI 只能解释已经完成的实验结果。" };
  }
  if (!props.manifest) {
    return { state: "loading" as const, title: "正在读取实验结果", detail: "请稍候，证据清单仍在加载。" };
  }
  if (!supportedArtifactIds.value.has("metrics")) {
    return {
      state: "unavailable" as const,
      title: "当前实验不能用于提问",
      detail: "这次实验没有生成正式 metrics 证据。请重新运行实验，旧结果无法补齐。",
    };
  }
  if (!props.selectedRequestId) {
    return { state: "select" as const, title: "请选择一个 request", detail: "选择后才能把问题绑定到具体请求。" };
  }
  return {
    state: "ready" as const,
    title: "可以开始提问",
    detail: "选择问题类型，确认问题内容，然后点击“生成证据草稿”。",
  };
});
const snapshotReady = computed(() => snapshotReadiness.value.state === "ready");
const capabilityAvailable = computed(
  () =>
    props.descriptorStatus === "supported" &&
    props.descriptor?.availability === "available" &&
    props.descriptor.provider.configured &&
    props.descriptor.availability_predicate.evaluated_available,
);
const currentDraftMatchesPending = computed(() => {
  if (!props.pending || !props.prepared) return false;
  const request = props.prepared.request;
  return (
    props.prepared.payloadDigest === props.pending.payloadDigest &&
    props.prepared.inputSnapshotDigest === props.pending.inputSnapshotDigest &&
    request.run_id === props.pending.runId &&
    request.client_request_id === props.pending.clientRequestId &&
    request.locale === currentLocale() &&
    request.task_kind === taskKind.value &&
    request.user_question.content === question.value.trim()
  );
});
const mustDiscardBeforeSubmit = computed(() => Boolean(props.pending && !currentDraftMatchesPending.value));
const canSubmit = computed(
  () =>
    capabilityAvailable.value &&
    Boolean(
      props.runId &&
      props.manifest &&
      props.apiManifest &&
      props.health &&
      props.selectedRequestId &&
      question.value.trim(),
    ) &&
    snapshotReady.value &&
    !mustDiscardBeforeSubmit.value &&
    !["submitting", "terminal_result_not_retained", "idempotency_payload_mismatch"].includes(props.agentState) &&
    !(props.pending && props.agentState === "stale"),
);
const errorCode = computed(() => localError.value || props.submissionError);
const errorMessage = computed(() => {
  if (errorCode.value === "insufficient_evidence") {
    return t("当前实验没有足够的正式证据，Agent 请求没有发送。请重新运行实验后再提问。");
  }
  if (errorCode.value === "question_length_invalid") return t("请输入一个简短、明确的问题。");
  return errorCode.value;
});

watch(
  () => props.descriptor?.supported_task_kinds,
  (supported) => {
    if (supported?.length && !supported.includes(taskKind.value)) taskKind.value = supported[0];
  },
  { immediate: true },
);

function currentClientRequestId() {
  const pending = props.pending;
  if (
    pending &&
    pending.runId === props.runId &&
    pending.backendIdentity === backendIdentity.value &&
    pending.schemaSetRevision === props.manifest?.schema_set_revision
  ) {
    return pending.clientRequestId;
  }
  return `agent-client:${crypto.randomUUID()}`;
}

function chooseRequest(event: Event) {
  emit("requestSelected", (event.target as HTMLSelectElement).value);
}

async function discardAndStartNew() {
  localError.value = "";
  emit("discardPending");
  await nextTick();
  questionInput.value?.focus();
}

async function submit() {
  localError.value = "";
  if (!canSubmit.value || !props.runId || !props.manifest || !props.apiManifest || !props.descriptor || !props.health)
    return;
  try {
    const structuredReport = buildStructuredPerformanceReport({
      bundle: props.bundle,
      inputs: props.inputs,
      runId: props.runId,
      runName: props.runName,
      artifactManifest: props.manifest,
      selectedRequestId: props.selectedRequestId,
    });
    const prepared = await buildEvidenceAgentRequest({
      runId: props.runId,
      selectedRequestId: props.selectedRequestId,
      manifest: props.manifest,
      descriptor: props.descriptor,
      health: props.health,
      structuredReport,
      bundle: props.bundle,
      inputs: props.inputs,
      locale: currentLocale(),
      taskKind: taskKind.value,
      question: question.value,
      clientRequestId: currentClientRequestId(),
    });
    emit("submitPrepared", prepared, {
      runId: props.runId,
      backendIdentity: backendIdentity.value,
      schemaSetRevision: props.manifest.schema_set_revision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    });
  } catch (error) {
    localError.value =
      error instanceof EvidenceAgentContractError ? error.code : error instanceof Error ? error.message : String(error);
  }
}
</script>

<template>
  <div class="evidence-agent-stack" data-help-anchor="evidence_agent-availability">
    <div
      v-if="!capabilityAvailable"
      class="panel evidence-agent-unavailable evidence-agent-unavailable--standalone"
      role="status"
    >
      <CircleSlash2 :size="20" />
      <div>
        <strong>{{ t("AI 解释当前不可用") }}</strong>
        <p>{{ t("当前后端没有提供可用的 AI 解释能力。你仍可查看实验结果，稍后再试或检查服务配置。") }}</p>
        <details class="evidence-agent-error-detail">
          <summary>{{ t("查看技术原因") }}</summary>
          <p>{{ descriptor?.degradation.detail || descriptorError }}</p>
          <code>{{ descriptor?.degradation.reason_code || descriptorError }}</code>
        </details>
      </div>
    </div>

    <section class="panel evidence-agent-compose">
      <header class="panel-header">
        <div>
          <p class="section-kicker">{{ t("开始提问") }}</p>
          <h2>{{ t("选择要解释的请求和问题") }}</h2>
          <p>{{ t("页面只会把当前实验中可引用的结果发送给 AI。") }}</p>
        </div>
        <div class="panel-count">
          <ShieldCheck :size="16" />{{
            t("{supported}/{total} 份引用依据可用", {
              supported: supportedArtifacts.length,
              total: manifest?.artifacts.length || 0,
            })
          }}
        </div>
      </header>
      <ol class="evidence-agent-steps" :aria-label="t('使用步骤')">
        <li>
          <span>1</span><strong>{{ t("选择请求") }}</strong
          ><small>{{ t("决定要解释哪一次请求。") }}</small>
        </li>
        <li>
          <span>2</span><strong>{{ t("输入问题") }}</strong
          ><small>{{ t("可以直接使用默认问题。") }}</small>
        </li>
        <li>
          <span>3</span><strong>{{ t("生成解释") }}</strong
          ><small>{{ t("通常需要约一分钟，请等待结果区出现。") }}</small>
        </li>
      </ol>
      <div class="evidence-agent-readiness" :data-state="snapshotReadiness.state" role="status">
        <ShieldCheck v-if="snapshotReady" :size="20" />
        <CircleSlash2 v-else :size="20" />
        <span>
          <strong>{{ t(snapshotReadiness.title) }}</strong>
          <small>{{ t(snapshotReadiness.detail) }}</small>
        </span>
        <RouterLink
          v-if="snapshotReadiness.state === 'missing' || snapshotReadiness.state === 'unavailable'"
          :to="{ name: 'experiment' }"
          class="button button--secondary"
        >
          {{ t("重新运行实验") }}
        </RouterLink>
      </div>
      <div class="evidence-agent-form">
        <label data-help-anchor="evidence_agent-request">
          <span>{{ t("当前请求") }}</span>
          <select :value="selectedRequestId || ''" :disabled="!runId" @change="chooseRequest">
            <option value="" disabled>{{ t("请选择请求") }}</option>
            <option v-for="option in chain.requestOptions" :key="option.requestId" :value="option.requestId">
              {{ option.requestId }}
            </option>
          </select>
        </label>
        <EvidenceAgentTaskCards
          v-model="taskKind"
          :supported-task-kinds="descriptor?.supported_task_kinds || []"
          :disabled="!capabilityAvailable"
        />
        <label class="evidence-agent-question" data-help-anchor="evidence_agent-question">
          <span>{{ t("你想了解什么？") }}</span>
          <textarea
            ref="questionInput"
            v-model="question"
            :maxlength="descriptor?.limits.maximum_question_characters || 4000"
            :disabled="!capabilityAvailable"
          ></textarea>
        </label>
        <EvidenceAgentSubmissionPreview
          :request-id="selectedRequestId"
          :citation-location-count="citableReferences.length"
          :citation-artifact-count="citableArtifactCount"
          :source-mode="previewProvenance.sourceMode"
          :calibration-level="previewProvenance.calibrationLevel"
          :allowed-claim-scope="previewProvenance.allowedClaimScope"
          :requested-fidelity="chain.week8Execution.requestedFidelity || 'not_covered'"
          :resolved-fidelity="chain.week8Execution.resolvedFidelity || 'not_covered'"
          :execution-mode="chain.week8Execution.executionMode || 'not_covered'"
          :timeout-ms="descriptor?.execution.timeout_ms || 0"
        />
        <div class="evidence-agent-submit-row">
          <p>
            {{ t("生成的解释不会改动原始实验结果。") }}
          </p>
          <button class="button" :disabled="!canSubmit" @click="submit">
            <Send :size="16" />{{ agentState === "submitting" ? t("正在生成…") : t("生成解释") }}
          </button>
        </div>
        <EvidenceAgentSubmissionLeaseNotice
          v-if="pending"
          :pending="pending"
          :agent-state="agentState"
          :must-discard-before-submit="mustDiscardBeforeSubmit"
          @discard="discardAndStartNew"
        />
        <div v-if="errorCode" class="evidence-agent-error" role="alert">
          <strong>{{ errorMessage }}</strong>
          <code>{{ errorCode }}</code>
        </div>
      </div>
    </section>

    <EvidenceAgentServiceDetails v-if="descriptorStatus === 'supported' && descriptor" :descriptor="descriptor" />

    <EvidenceAgentContractPolicy
      v-if="descriptor && descriptorPolicy"
      :descriptor="descriptor"
      :policy="descriptorPolicy"
      :api-manifest="apiManifest"
    />

    <EvidenceAgentResultPanel
      v-if="agentResult"
      :agent-state="agentState"
      :agent-result="agentResult"
      data-help-anchor="evidence_agent-result"
    />
  </div>
</template>
