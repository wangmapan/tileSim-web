<script setup lang="ts">
import { Braces, CircleSlash2 } from "@lucide/vue";
import { computed, nextTick, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { EvidenceAgentUiState, ValidatedEvidenceAgentResult } from "../../../entities/evidence-agent";
import { useI18n } from "../../../i18n";
import { artifactEvidenceRoute } from "../../inspect-artifact";
import { evidenceAgentStatusLabels, groupEvidenceAgentClaims, type EvidenceAgentClaimGroupId } from "../presentation";

const props = defineProps<{ agentState: EvidenceAgentUiState; agentResult: ValidatedEvidenceAgentResult }>();
const { isEnglish, t } = useI18n();
const resultHeading = ref<HTMLElement | null>(null);
const visibleClaims = computed(() => (props.agentState === "stale" ? [] : props.agentResult.response.claims));
const claimGroups = computed(() => groupEvidenceAgentClaims(visibleClaims.value));
const groupLabels: Record<EvidenceAgentClaimGroupId, { zh: string; en: string }> = {
  conclusion: { zh: "结论", en: "Findings" },
  limitations: { zh: "限制", en: "Limitations" },
  next_steps: { zh: "下一步", en: "Next steps" },
  help: { zh: "补充说明", en: "Guidance" },
};
const resultBoundary = computed(() => {
  const messages: Partial<Record<EvidenceAgentUiState, { zh: string; en: string }>> = {
    partial: {
      zh: "部分结果保留已验证 claims；未完成部分不会由前端补写。",
      en: "The partial result keeps independently validated claims; the UI does not fill in unfinished content.",
    },
    truncated: {
      zh: "输出已截断，现有 claims 不能视为完整回答。",
      en: "Output was truncated; the returned claims are not a complete answer.",
    },
    refused: {
      zh: "服务已正式拒答；页面不会生成替代结论。",
      en: "The service formally refused the request; the UI does not generate a fallback conclusion.",
    },
    failed: {
      zh: "正式 HTTP 502 EvidenceAgentResponse；completion_state=failed。",
      en: "Formal HTTP 502 EvidenceAgentResponse; completion_state=failed.",
    },
    provider_unavailable: {
      zh: "正式 HTTP 503 EvidenceAgentResponse；reason_code=provider_unavailable。",
      en: "Formal HTTP 503 EvidenceAgentResponse; reason_code=provider_unavailable.",
    },
    timeout: {
      zh: "正式 HTTP 504 EvidenceAgentResponse；completion_state=timeout。",
      en: "Formal HTTP 504 EvidenceAgentResponse; completion_state=timeout.",
    },
    cancelled: {
      zh: "请求已取消；前端不会把未完成输出补成终态。",
      en: "The request was cancelled; the UI does not turn unfinished output into a terminal answer.",
    },
    concurrency_limit: {
      zh: "服务正在处理另一项分析；本次请求没有生成结论。",
      en: "The service is processing another analysis; this request produced no conclusion.",
    },
  };
  const message = messages[props.agentState];
  return message ? message[isEnglish.value ? "en" : "zh"] : "";
});

function groupLabel(groupId: EvidenceAgentClaimGroupId) {
  return groupLabels[groupId][isEnglish.value ? "en" : "zh"];
}

function emptyGroupLabel() {
  return isEnglish.value ? "No atomic claim in this category." : "当前没有此类 atomic claim。";
}

function evidenceLabel(count: number) {
  return isEnglish.value ? `Evidence (${count})` : `依据（${count}）`;
}
const refusalTitle = computed(() => {
  const refusal = props.agentResult.response.refusal;
  if (!refusal) return "";
  if (refusal.reason_code === "insufficient_evidence") {
    return visibleClaims.value.length ? t("部分问题缺少足够证据") : t("没有足够证据生成结论");
  }
  return refusal.reason_code;
});

function citationRoute(citation: (typeof visibleClaims.value)[number]["citations"][number]) {
  return artifactEvidenceRoute({
    runId: citation.run_id,
    artifactId: citation.artifact_id,
    sha256: citation.sha256,
    pointer: citation.json_pointer,
  });
}

onMounted(async () => {
  await nextTick();
  resultHeading.value?.focus({ preventScroll: true });
  resultHeading.value?.scrollIntoView?.({ behavior: "auto", block: "start" });
});
</script>

<template>
  <section
    class="panel evidence-agent-result"
    :aria-label="t('Agent 独立草稿')"
    data-help-anchor="evidence_agent-result"
  >
    <header class="panel-header">
      <div>
        <p class="section-kicker">ATOMIC CLAIMS · USER CONFIRMATION REQUIRED</p>
        <h2 ref="resultHeading" tabindex="-1">{{ t("Agent 独立草稿") }}</h2>
        <p>{{ t("每条事实单独验证引用；结果不会覆盖 deterministic report。") }}</p>
      </div>
      <span class="evidence-agent-state" :data-state="agentState">{{
        t(evidenceAgentStatusLabels[agentState] || agentState)
      }}</span>
    </header>

    <details v-if="agentState !== 'stale'" class="evidence-agent-result-identity">
      <summary>{{ t("专业详情") }}</summary>
      <dl>
        <div>
          <dt>request_id</dt>
          <dd>
            <code>{{ agentResult.response.request_id }}</code>
          </dd>
        </div>
        <div>
          <dt>completion_state</dt>
          <dd>
            <code>{{ agentResult.response.completion_state }}</code>
          </dd>
        </div>
        <div>
          <dt>run_id</dt>
          <dd>
            <code>{{ agentResult.response.run_id }}</code>
          </dd>
        </div>
        <div>
          <dt>input_snapshot_digest</dt>
          <dd>
            <code>{{ agentResult.response.input_snapshot_digest }}</code>
          </dd>
        </div>
        <div>
          <dt>Provider / model</dt>
          <dd>
            <code>{{ agentResult.response.provider.provider_id }} / {{ agentResult.response.provider.model_id }}</code>
          </dd>
        </div>
        <div>
          <dt>model_revision</dt>
          <dd>
            <code>{{ agentResult.response.provider.model_revision }}</code>
          </dd>
        </div>
        <div>
          <dt>prompt_revision</dt>
          <dd>
            <code>{{ agentResult.response.revisions.prompt_template_revision }}</code>
          </dd>
        </div>
        <div>
          <dt>policy_revision</dt>
          <dd>
            <code>{{ agentResult.response.revisions.policy_revision }}</code>
          </dd>
        </div>
      </dl>
    </details>

    <div v-if="agentState === 'stale'" class="evidence-agent-unavailable" role="alert">
      <CircleSlash2 :size="20" />
      <div>
        <strong>{{ t("结果与当前证据绑定不再匹配") }}</strong>
        <p>{{ t("run、backend、schema revision 或 snapshot digest 已变化；旧 claims 已隐藏。") }}</p>
      </div>
    </div>
    <div v-else-if="resultBoundary" class="evidence-agent-result-boundary" :data-state="agentState" role="status">
      <CircleSlash2 :size="20" />
      <p>{{ t(resultBoundary) }}</p>
    </div>
    <div v-if="agentState !== 'stale' && agentResult.response.refusal" class="evidence-agent-refusal" role="status">
      <CircleSlash2 :size="20" />
      <div>
        <strong>{{ refusalTitle }}</strong>
        <p>{{ agentResult.response.refusal.detail }}</p>
        <code>{{ agentResult.response.refusal.reason_code }}</code>
      </div>
    </div>

    <div v-if="agentState !== 'stale' && visibleClaims.length" class="evidence-agent-claim-groups">
      <section
        v-for="group in claimGroups.filter((entry) => entry.id !== 'help' || entry.claims.length)"
        :key="group.id"
        class="evidence-agent-claim-group"
        :data-group="group.id"
      >
        <header>
          <h3>{{ groupLabel(group.id) }}</h3>
          <span>{{ group.claims.length }}</span>
        </header>
        <ol v-if="group.claims.length" class="evidence-agent-claims">
          <li
            v-for="entry in group.claims"
            :key="entry.claim.claim_id"
            :data-claim-kind="entry.claim.claim_kind"
            :data-original-index="entry.originalIndex"
          >
            <p class="evidence-agent-claim-text">{{ entry.claim.text }}</p>
            <details v-if="entry.claim.citations.length" class="evidence-agent-claim-evidence">
              <summary><Braces :size="14" />{{ evidenceLabel(entry.claim.citations.length) }}</summary>
              <ol class="evidence-agent-citations">
                <li
                  v-for="(citation, citationIndex) in entry.claim.citations"
                  :key="`${citation.artifact_id}:${citation.json_pointer}:${citation.subject.kind}:${citation.subject.id}`"
                >
                  <RouterLink :to="citationRoute(citation)">
                    <Braces :size="14" />{{
                      isEnglish ? `Open source evidence ${citationIndex + 1}` : `打开原始证据 ${citationIndex + 1}`
                    }}
                  </RouterLink>
                  <details class="evidence-agent-citation-identity">
                    <summary>{{ t("专业详情") }}</summary>
                    <dl>
                      <div>
                        <dt>artifact_id</dt>
                        <dd>
                          <code>{{ citation.artifact_id }}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>schema_identity</dt>
                        <dd>
                          <code>{{ citation.schema_identity }}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>sha256</dt>
                        <dd>
                          <code>{{ citation.sha256 }}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>json_pointer</dt>
                        <dd>
                          <code>{{ citation.json_pointer }}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>subject</dt>
                        <dd>
                          <code>{{ citation.subject.kind }} · {{ citation.subject.id }}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>availability</dt>
                        <dd>
                          <code>{{ citation.availability }}</code>
                        </dd>
                      </div>
                      <div v-if="citation.value">
                        <dt>value</dt>
                        <dd>
                          <code
                            >{{ citation.value.decimal
                            }}<template v-if="citation.unit"> {{ citation.unit }}</template></code
                          >
                        </dd>
                      </div>
                    </dl>
                  </details>
                </li>
              </ol>
            </details>
            <details class="evidence-agent-claim-identity">
              <summary>{{ t("专业详情") }}</summary>
              <dl>
                <div>
                  <dt>claim_id</dt>
                  <dd>
                    <code>{{ entry.claim.claim_id }}</code>
                  </dd>
                </div>
                <div>
                  <dt>claim_kind</dt>
                  <dd>
                    <code>{{ entry.claim.claim_kind }}</code>
                  </dd>
                </div>
                <div>
                  <dt>original_index</dt>
                  <dd>
                    <code>{{ entry.originalIndex }}</code>
                  </dd>
                </div>
                <div>
                  <dt>source_mode</dt>
                  <dd>
                    <code>{{ entry.claim.scope.source_mode }}</code>
                  </dd>
                </div>
                <div>
                  <dt>requested_fidelity</dt>
                  <dd>
                    <code>{{ entry.claim.scope.requested_fidelity }}</code>
                  </dd>
                </div>
                <div>
                  <dt>resolved_fidelity</dt>
                  <dd>
                    <code>{{ entry.claim.scope.resolved_fidelity }}</code>
                  </dd>
                </div>
                <div>
                  <dt>execution_mode</dt>
                  <dd>
                    <code>{{ entry.claim.scope.execution_mode }}</code>
                  </dd>
                </div>
                <div>
                  <dt>causal_subsystems</dt>
                  <dd>
                    <code>{{ entry.claim.scope.causal_subsystems.join(" · ") }}</code>
                  </dd>
                </div>
              </dl>
            </details>
          </li>
        </ol>
        <p v-else class="evidence-agent-claim-group-empty">{{ emptyGroupLabel() }}</p>
      </section>
    </div>
    <div
      v-else-if="agentState !== 'stale' && !agentResult.response.refusal"
      class="evidence-agent-unavailable"
      role="status"
    >
      <CircleSlash2 :size="20" />
      <strong>{{ t("当前响应没有可展示的结论") }}</strong>
    </div>
  </section>
</template>
