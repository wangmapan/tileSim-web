<script setup lang="ts">
import { Bot, CircleSlash2, Send, ShieldCheck } from "@lucide/vue";
import { computed, nextTick, ref } from "vue";
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
import { evidenceAgentStatusLabels, evidenceAgentTaskLabels } from "../presentation";
import { buildEvidenceAgentRequest, evidenceAgentBackendIdentity } from "../request-builder";
import EvidenceAgentContractPolicy from "./EvidenceAgentContractPolicy.vue";
import EvidenceAgentResultPanel from "./EvidenceAgentResultPanel.vue";

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
const snapshotReadiness = computed(() => {
  if (!props.runId) {
    return { state: "missing" as const, title: "先运行一次实验", detail: "Agent 只能解释已经完成的实验结果。" };
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
const displayState = computed(() => {
  if (props.descriptorStatus !== "supported") return "contract_error";
  if (!capabilityAvailable.value) return props.descriptor?.degradation.reason_code || "provider_unavailable";
  return props.agentState;
});
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
  <div class="evidence-agent-stack">
    <section class="panel evidence-agent-hero" aria-labelledby="evidence-agent-title">
      <header>
        <div class="evidence-agent-icon"><Bot :size="24" /></div>
        <div>
          <p class="section-kicker">READ-ONLY EVIDENCE ANALYSIS</p>
          <h2 id="evidence-agent-title">{{ t("只读证据 Agent") }}</h2>
          <p>{{ t("只在已验证的 run、artifact、SHA-256、JSON Pointer 与 stable subject 上生成独立草稿。") }}</p>
        </div>
        <span class="evidence-agent-state" :data-state="displayState">{{
          t(evidenceAgentStatusLabels[displayState] || displayState)
        }}</span>
      </header>

      <details v-if="descriptorStatus === 'supported' && descriptor" class="evidence-agent-identity-disclosure">
        <summary>
          <span>
            <strong>{{ t("契约身份详情") }}</strong>
            <small>{{ t("Descriptor、Schema、Provider 与模型 revision") }}</small>
          </span>
        </summary>
        <div class="evidence-agent-identity-grid">
          <div>
            <small>{{ t("Descriptor") }}</small
            ><code>{{ descriptor.schema_version }}</code>
          </div>
          <div>
            <small>{{ t("Schema revision") }}</small
            ><code>{{ descriptor.schema_set_revision }}</code>
          </div>
          <div>
            <small>{{ t("Descriptor revision") }}</small
            ><code>{{ descriptor.descriptor_revision }}</code>
          </div>
          <div>
            <small>{{ t("Provider / model") }}</small
            ><code>{{ descriptor.provider.provider_id }} / {{ descriptor.provider.model_id }}</code>
          </div>
          <div>
            <small>{{ t("Model revision") }}</small
            ><code>{{ descriptor.provider.model_revision }}</code>
          </div>
        </div>
      </details>

      <div v-if="!capabilityAvailable" class="evidence-agent-unavailable" role="status">
        <CircleSlash2 :size="20" />
        <div>
          <strong>{{ t("正式能力当前不可用") }}</strong>
          <p>{{ descriptor?.degradation.detail || descriptorError }}</p>
          <code>{{ descriptor?.degradation.reason_code || descriptorError }}</code>
        </div>
      </div>
    </section>

    <section class="panel evidence-agent-compose">
      <header class="panel-header">
        <div>
          <p class="section-kicker">VERIFIED RUN SNAPSHOT</p>
          <h2>{{ t("准备证据问题") }}</h2>
          <p>{{ t("只有 supported artifact 和精确 stable-ID Pointer 会进入请求 allow-list。") }}</p>
        </div>
        <div class="panel-count">
          <ShieldCheck :size="16" />{{
            t("{supported}/{total} 份正式证据可用", {
              supported: supportedArtifacts.length,
              total: manifest?.artifacts.length || 0,
            })
          }}
        </div>
      </header>
      <ol class="evidence-agent-steps" :aria-label="t('使用步骤')">
        <li>
          <span>1</span><strong>{{ t("选择 request") }}</strong
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
        <label>
          <span>{{ t("当前 request") }}</span>
          <select :value="selectedRequestId || ''" :disabled="!runId" @change="chooseRequest">
            <option value="" disabled>{{ t("请选择请求") }}</option>
            <option v-for="option in chain.requestOptions" :key="option.requestId" :value="option.requestId">
              {{ option.requestId }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t("任务类型") }}</span>
          <select v-model="taskKind" :disabled="!capabilityAvailable">
            <option v-for="kind in descriptor?.supported_task_kinds || []" :key="kind" :value="kind">
              {{ t(evidenceAgentTaskLabels[kind]) }}
            </option>
          </select>
        </label>
        <label class="evidence-agent-question">
          <span>{{ t("问题（不受信任内容）") }}</span>
          <textarea
            ref="questionInput"
            v-model="question"
            :maxlength="descriptor?.limits.maximum_question_characters || 4000"
            :disabled="!capabilityAvailable"
          ></textarea>
        </label>
        <div class="evidence-agent-submit-row">
          <p>
            <code>{{ runId || "run_missing" }}</code
            ><br />{{ t("草稿不会写回确定性报告事实区。") }}
          </p>
          <button class="button" :disabled="!canSubmit" @click="submit">
            <Send :size="16" />{{ agentState === "submitting" ? t("正在生成…") : t("生成证据草稿") }}
          </button>
        </div>
        <div v-if="pending" class="evidence-agent-pending" role="status">
          <code>{{ pending.idempotencyKey }}</code>
          <span v-if="agentState === 'terminal_result_not_retained'">
            {{
              t(
                "Bridge 重启后未保留先前 claims 终态；原 Idempotency-Key 已锁定，前端不会换 key、重调 Provider 或标记为已恢复。",
              )
            }}
          </span>
          <span v-else-if="agentState === 'idempotency_payload_mismatch'">
            {{
              t(
                "Bridge 已拒绝同一 Idempotency-Key 下的不同 canonical payload；原 key 保持锁定，不会自动重试或调用 Provider。",
              )
            }}
          </span>
          <span v-else-if="agentState === 'stale'">
            {{
              t(
                "当前 run、backend、schema revision 或 snapshot digest 已变化；旧 Idempotency-Key 保持锁定，需显式放弃后才能开始新分析。",
              )
            }}
          </span>
          <span v-else-if="mustDiscardBeforeSubmit">
            {{
              t(
                "当前表单不是旧 Idempotency-Key 对应的完整 canonical payload；这通常发生在刷新页面或编辑问题后。前端已阻止冲突提交，请先显式放弃旧分析。",
              )
            }}
          </span>
          <span v-else>{{ t("仅同一 canonical payload 可复用该 Idempotency-Key。") }}</span>
          <button class="button button--secondary" :disabled="agentState === 'submitting'" @click="discardAndStartNew">
            {{
              agentState === "terminal_result_not_retained"
                ? t("明确放弃该终态并开始新分析")
                : agentState === "idempotency_payload_mismatch"
                  ? t("明确放弃旧分析并开始新分析")
                  : agentState === "stale"
                    ? t("明确放弃当前分析并开始新分析")
                    : mustDiscardBeforeSubmit
                      ? t("放弃旧分析并开始新问题")
                      : t("明确放弃当前分析并开始新分析")
            }}
          </button>
        </div>
        <div v-if="agentState === 'idempotency_payload_mismatch'" class="evidence-agent-unavailable" role="alert">
          <CircleSlash2 :size="20" />
          <div>
            <strong>{{ t("幂等键已绑定到不同载荷") }}</strong>
            <p>
              {{ t("当前请求不会以该 key 重试，也不会自动换 key 调用 Provider；只有显式放弃后才能创建新的分析请求。") }}
            </p>
            <code>idempotency_payload_mismatch</code>
          </div>
        </div>
        <div v-if="agentState === 'terminal_result_not_retained'" class="evidence-agent-unavailable" role="alert">
          <CircleSlash2 :size="20" />
          <div>
            <strong>{{ t("无法恢复先前的 claims 终态") }}</strong>
            <p>
              {{
                t(
                  "当前 metadata-only 留存无法跨 Bridge 进程重放完整模型结果。不会自动调用 Provider；只有显式放弃后才能创建新的分析请求。",
                )
              }}
            </p>
            <code>terminal_result_not_retained</code>
          </div>
        </div>
        <div v-if="errorCode" class="evidence-agent-error" role="alert">
          <strong>{{ errorMessage }}</strong>
          <code>{{ errorCode }}</code>
        </div>
      </div>
    </section>

    <EvidenceAgentContractPolicy
      v-if="descriptor && descriptorPolicy"
      :descriptor="descriptor"
      :policy="descriptorPolicy"
      :api-manifest="apiManifest"
    />

    <EvidenceAgentResultPanel v-if="agentResult" :agent-state="agentState" :agent-result="agentResult" />
  </div>
</template>
