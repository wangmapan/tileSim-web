<script setup lang="ts">
import { Braces, FileCheck2, LockKeyhole, ShieldCheck } from "@lucide/vue";
import { computed } from "vue";
import type { EvidenceAgentDescriptorPolicyView } from "../../../adapters/evidence-agent-descriptor";
import type { ApiManifestResponse, EvidenceAgentDescriptorResponse } from "../../../contracts/bridge-api";
import { useI18n } from "../../../i18n";

const props = defineProps<{
  descriptor: EvidenceAgentDescriptorResponse;
  policy: EvidenceAgentDescriptorPolicyView;
  apiManifest: ApiManifestResponse | null;
}>();
const { t } = useI18n();

const retentionItems = computed(() => {
  const retention = props.policy.persistence.payloadRetention;
  return [
    { label: "用户问题", retained: retention.user_question_retained },
    { label: "snapshot payload", retained: retention.snapshot_payload_retained },
    { label: "artifact payload", retained: retention.artifact_payload_retained },
    { label: "Provider raw response", retained: retention.provider_raw_response_retained },
    { label: "validated model claims", retained: retention.validated_model_claims_retained },
    { label: "credential", retained: retention.credentials_retained },
    { label: "hidden reasoning", retained: retention.hidden_reasoning_retained },
  ];
});

const formalTerminalStatuses = computed(() => {
  const responseSchema = props.policy.schemaIdentities.response;
  const errorSchema = props.apiManifest?.error_schema_version || "tilesim.bridge.error.v1";
  return [
    {
      status: 409,
      label: "终态结果未留存",
      schema: errorSchema,
      outcome: [
        props.policy.execution.recovery.claimsBearingTerminal.code,
        `field_path=${props.policy.execution.recovery.claimsBearingTerminal.field_path}`,
        `retryable=${props.policy.execution.recovery.claimsBearingTerminal.retryable}`,
      ].join(" · "),
    },
    {
      status: 409,
      label: "幂等载荷不匹配",
      schema: errorSchema,
      outcome: [
        props.policy.execution.retry.differentPayload.code,
        `field_path=${props.policy.execution.retry.differentPayload.field_path}`,
        `retryable=${props.policy.execution.retry.differentPayload.retryable}`,
      ].join(" · "),
    },
    { status: 502, label: "Provider 响应失败", schema: responseSchema, outcome: "completion_state=failed" },
    {
      status: 503,
      label: "Provider 不可用",
      schema: responseSchema,
      outcome: "completion_state=refused · reason_code=provider_unavailable",
    },
    { status: 504, label: "请求超时", schema: responseSchema, outcome: "completion_state=timeout" },
  ];
});
</script>

<template>
  <details class="panel evidence-agent-policy-disclosure">
    <summary>
      <span class="evidence-agent-policy-heading">
        <FileCheck2 :size="18" />
        <span>
          <strong>{{ t("契约策略与恢复详情") }}</strong>
          <small>{{ t("查看重放、跨重启恢复、留存边界和正式 HTTP 终态") }}</small>
        </span>
      </span>
      <span class="evidence-agent-policy-summary">
        <code>{{ t("进程内精确 replay") }}</code>
        <code>{{ t("metadata-only retention") }}</code>
        <code>409 / 502 / 503 / 504</code>
      </span>
    </summary>
    <section class="evidence-agent-contract-grid">
      <article class="evidence-agent-contract-card">
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
          <div>
            <dt>{{ t("并列资源语义") }}</dt>
            <dd><code>S3 · S4 · S5</code></dd>
          </div>
          <div>
            <dt>{{ t("执行宿主") }}</dt>
            <dd><code>S7</code></dd>
          </div>
          <div>
            <dt>{{ t("非 causal ranking") }}</dt>
            <dd><code>S8 · S9</code></dd>
          </div>
        </dl>
      </article>
      <article class="evidence-agent-contract-card">
        <header>
          <FileCheck2 :size="18" /><strong>{{ t("重放与终态恢复") }}</strong>
        </header>
        <dl>
          <div>
            <dt>{{ t("执行模式") }}</dt>
            <dd>
              <code>{{ policy.execution.mode }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("超时") }}</dt>
            <dd>{{ policy.execution.timeoutMs }} ms</dd>
          </div>
          <div>
            <dt>{{ t("进程内精确 replay") }}</dt>
            <dd>
              <span class="evidence-agent-contract-detail">{{
                t("同 key、同 canonical payload 精确返回同一终态，不再次调用 Provider。")
              }}</span>
              <code>{{ policy.execution.retry.inProcess }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("claim-free Bridge terminal") }}</dt>
            <dd>
              <span class="evidence-agent-contract-detail">{{
                t("metadata-only record 可在 Bridge 重启后精确恢复。")
              }}</span>
              <code
                >{{ policy.execution.retry.afterRestartClaimFreeBridgeTerminal }} ·
                {{ policy.execution.recovery.claimFreeBridgeTerminal.source }}</code
              >
            </dd>
          </div>
          <div>
            <dt>{{ t("claims-bearing terminal") }}</dt>
            <dd>
              <span class="evidence-agent-contract-detail">{{
                t("模型 claims 不留存；Bridge 重启后返回正式 409。")
              }}</span>
              <code
                >HTTP {{ policy.execution.recovery.claimsBearingTerminal.http_status }} ·
                {{ policy.execution.recovery.claimsBearingTerminal.code }} · retryable=false</code
              >
            </dd>
          </div>
          <div>
            <dt>{{ t("claim-free Provider terminal") }}</dt>
            <dd>
              <span class="evidence-agent-contract-detail">{{
                t("Provider terminal payload 不留存；Bridge 重启后返回正式 409。")
              }}</span>
              <code
                >HTTP {{ policy.execution.recovery.claimFreeProviderTerminal.http_status }} ·
                {{ policy.execution.recovery.claimFreeProviderTerminal.code }} · retryable=false</code
              >
            </dd>
          </div>
          <div>
            <dt>{{ t("Provider 重新调用") }}</dt>
            <dd>
              <span class="evidence-agent-contract-detail">{{ t("不可恢复分支禁止重新调用 Provider。") }}</span>
              <code>{{ policy.execution.recovery.providerReinvocation }}</code>
            </dd>
          </div>
        </dl>
      </article>
      <article class="evidence-agent-contract-card">
        <header>
          <ShieldCheck :size="18" /><strong>{{ t("metadata-only retention") }}</strong>
        </header>
        <dl>
          <div>
            <dt>{{ t("记录类型") }}</dt>
            <dd>
              <code>{{ policy.persistence.mode.record_kind }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("存储范围") }}</dt>
            <dd>
              <code>{{ policy.persistence.mode.storage_scope }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("记录 Schema") }}</dt>
            <dd>
              <code>{{ policy.persistence.mode.record_schema_identity }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("保留时间") }}</dt>
            <dd>{{ policy.persistence.retentionSeconds }} s</dd>
          </div>
        </dl>
        <strong class="evidence-agent-contract-subtitle">{{ t("全部禁止留存项") }}</strong>
        <ul class="evidence-agent-retention-list" :aria-label="t('全部禁止留存项')">
          <li v-for="item in retentionItems" :key="item.label">
            <span>{{ t(item.label) }}</span>
            <code>{{ item.retained ? t("允许留存") : t("禁止留存") }}</code>
          </li>
        </ul>
      </article>
      <article class="evidence-agent-contract-card">
        <header>
          <Braces :size="18" /><strong>{{ t("正式 HTTP 终态") }}</strong>
        </header>
        <ul class="evidence-agent-terminal-list" :aria-label="t('正式 HTTP 终态')">
          <li v-for="terminal in formalTerminalStatuses" :key="`${terminal.status}:${terminal.outcome}`">
            <code class="evidence-agent-http-status">HTTP {{ terminal.status }}</code>
            <span>
              <strong>{{ t(terminal.label) }}</strong>
              <code>{{ terminal.schema }}</code>
              <code>{{ terminal.outcome }}</code>
            </span>
          </li>
        </ul>
      </article>
    </section>
  </details>
</template>
