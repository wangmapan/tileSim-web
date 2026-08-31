<script setup lang="ts">
import { Bot, Braces, CircleSlash2, FileCheck2, LockKeyhole, Send, ShieldCheck } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
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
  PendingEvidenceAgentSubmission,
  PreparedEvidenceAgentRequest,
  ValidatedEvidenceAgentResult,
} from "../../../entities/evidence-agent";
import { useI18n, currentLocale } from "../../../i18n";
import { artifactEvidenceRoute } from "../../inspect-artifact";
import { buildRunBoundEvidenceChain } from "../../run-bound-evidence";
import { buildStructuredPerformanceReport } from "../../structured-report";
import { EvidenceAgentContractError } from "../errors";
import { buildEvidenceAgentRequest, evidenceAgentBackendIdentity } from "../request-builder";

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
  pending: PendingEvidenceAgentSubmission | null;
  submissionError: string;
}>();
const emit = defineEmits<{
  requestSelected: [requestId: string];
  submitPrepared: [prepared: PreparedEvidenceAgentRequest, binding: EvidenceAgentBinding];
  discardPending: [];
}>();
const { t } = useI18n();
const question = ref(t("请解释当前 request 的 P99 与尾延迟证据边界。"));
const taskKind = ref<EvidenceAgentRequest["task_kind"]>("explain_p99");
const localError = ref("");

const backendIdentity = computed(() => evidenceAgentBackendIdentity(props.health));
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
    props.agentState !== "submitting",
);
const visibleClaims = computed(() => (props.agentState === "stale" ? [] : props.agentResult?.response.claims || []));
const statusLabels: Record<string, string> = {
  idle: "等待提问",
  submitting: "正在生成证据草稿",
  available_draft: "待确认草稿",
  refused: "已拒答",
  partial: "部分结果",
  truncated: "输出已截断",
  timeout: "请求超时",
  cancelled: "请求已取消",
  stale: "结果已过期",
  concurrency_limit: "并发槽已占用",
  provider_unavailable: "Provider 未配置",
  provider_disabled: "Provider 已禁用",
  unsupported_schema: "不支持的 Schema",
  contract_error: "Agent 契约不可用",
};

const taskLabels: Record<EvidenceAgentRequest["task_kind"], string> = {
  explain_p99: "解释 P99",
  explain_tail: "解释尾延迟",
  summarize_validation: "总结验证边界",
  draft_conditional_recommendations: "起草条件建议",
};

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

function citationRoute(citation: (typeof visibleClaims.value)[number]["citations"][number]) {
  return artifactEvidenceRoute({
    runId: citation.run_id,
    artifactId: citation.artifact_id,
    sha256: citation.sha256,
    pointer: citation.json_pointer,
  });
}
</script>

<template>
  <div class="evidence-agent-stack">
    <section class="panel evidence-agent-hero" aria-labelledby="evidence-agent-title">
      <header>
        <div class="evidence-agent-icon"><Bot :size="24" /></div>
        <div>
          <p class="section-kicker">F9B · READ-ONLY EVIDENCE AGENT</p>
          <h2 id="evidence-agent-title">{{ t("只读证据 Agent") }}</h2>
          <p>{{ t("只在已验证的 run、artifact、SHA-256、JSON Pointer 与 stable subject 上生成独立草稿。") }}</p>
        </div>
        <span class="evidence-agent-state" :data-state="displayState">{{
          t(statusLabels[displayState] || displayState)
        }}</span>
      </header>

      <div v-if="descriptorStatus === 'supported' && descriptor" class="evidence-agent-identity-grid">
        <div>
          <small>{{ t("Descriptor") }}</small
          ><code>{{ descriptor.schema_version }}</code>
        </div>
        <div>
          <small>{{ t("Schema revision") }}</small
          ><code>{{ descriptor.schema_set_revision }}</code>
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

      <div v-if="!capabilityAvailable" class="evidence-agent-unavailable" role="status">
        <CircleSlash2 :size="20" />
        <div>
          <strong>{{ t("正式能力当前不可用") }}</strong>
          <p>{{ descriptor?.degradation.detail || descriptorError }}</p>
          <code>{{ descriptor?.degradation.reason_code || descriptorError }}</code>
        </div>
      </div>
    </section>

    <section v-if="descriptor" class="evidence-agent-contract-grid">
      <article class="panel evidence-agent-contract-card">
        <header>
          <LockKeyhole :size="18" /><strong>{{ t("工具与安全边界") }}</strong>
        </header>
        <dl>
          <div>
            <dt>{{ t("允许") }}</dt>
            <dd>
              <code>{{ descriptor.tools.allowed.join(" · ") }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("禁止") }}</dt>
            <dd>
              <code>{{ descriptor.tools.forbidden.join(" · ") }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("扩张 allow-list") }}</dt>
            <dd>
              <code>{{ descriptor.tools.allow_list_expansion }}</code>
            </dd>
          </div>
        </dl>
      </article>
      <article class="panel evidence-agent-contract-card">
        <header>
          <FileCheck2 :size="18" /><strong>{{ t("执行与留存") }}</strong>
        </header>
        <dl>
          <div>
            <dt>{{ t("执行模式") }}</dt>
            <dd>
              <code>{{ descriptor.execution.mode }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("超时") }}</dt>
            <dd>{{ descriptor.execution.timeout_ms }} ms</dd>
          </div>
          <div>
            <dt>{{ t("留存") }}</dt>
            <dd>
              <code>{{ descriptor.persistence.mode }}</code>
            </dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="panel evidence-agent-compose">
      <header class="panel-header">
        <div>
          <p class="section-kicker">RUN-BOUND SNAPSHOT</p>
          <h2>{{ t("准备证据问题") }}</h2>
          <p>{{ t("只有 supported artifact 和精确 stable-ID Pointer 会进入请求 allow-list。") }}</p>
        </div>
        <div class="panel-count">
          <ShieldCheck :size="16" />{{ t("{count} 个 supported artifacts", { count: supportedArtifacts.length }) }}
        </div>
      </header>
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
              {{ t(taskLabels[kind]) }}
            </option>
          </select>
        </label>
        <label class="evidence-agent-question">
          <span>{{ t("问题（不受信任内容）") }}</span>
          <textarea
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
          <span>{{ t("仅同一 canonical payload 可复用该 Idempotency-Key。") }}</span>
          <button class="button button--secondary" @click="emit('discardPending')">{{ t("放弃待恢复请求") }}</button>
        </div>
        <p v-if="localError || submissionError" class="evidence-agent-error" role="alert">
          {{ localError || submissionError }}
        </p>
      </div>
    </section>

    <section v-if="agentResult" class="panel evidence-agent-result" :aria-label="t('Agent 独立草稿')">
      <header class="panel-header">
        <div>
          <p class="section-kicker">ATOMIC CLAIMS · USER CONFIRMATION REQUIRED</p>
          <h2>{{ t("Agent 独立草稿") }}</h2>
          <p>{{ t("每条事实单独验证引用；结果不会覆盖 deterministic report。") }}</p>
        </div>
        <span class="evidence-agent-state" :data-state="agentState">{{
          t(statusLabels[agentState] || agentState)
        }}</span>
      </header>
      <div v-if="agentState === 'stale'" class="evidence-agent-unavailable" role="alert">
        <CircleSlash2 :size="20" />
        <div>
          <strong>{{ t("结果与当前 run 不再匹配") }}</strong>
          <p>{{ t("已隐藏旧 claims，不能挂接到当前证据。") }}</p>
        </div>
      </div>
      <div v-else-if="agentResult.response.refusal" class="evidence-agent-unavailable" role="status">
        <CircleSlash2 :size="20" />
        <div>
          <strong>{{ agentResult.response.refusal.reason_code }}</strong>
          <p>{{ agentResult.response.refusal.detail }}</p>
        </div>
      </div>
      <ol v-else class="evidence-agent-claims">
        <li v-for="claim in visibleClaims" :key="claim.claim_id">
          <header>
            <code>{{ claim.claim_kind }}</code
            ><span>{{ claim.claim_id }}</span>
          </header>
          <p>{{ claim.text }}</p>
          <div class="evidence-agent-citations">
            <RouterLink
              v-for="citation in claim.citations"
              :key="`${citation.artifact_id}:${citation.json_pointer}:${citation.subject.kind}:${citation.subject.id}`"
              :to="citationRoute(citation)"
            >
              <Braces :size="14" /><span
                ><code>{{ citation.artifact_id }}{{ citation.json_pointer }}</code
                ><small
                  >{{ citation.subject.kind }} · {{ citation.subject.id }} · {{ citation.availability
                  }}<template v-if="citation.value">
                    · {{ citation.value.decimal
                    }}<template v-if="citation.unit"> {{ citation.unit }}</template></template
                  ></small
                ></span
              >
            </RouterLink>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
