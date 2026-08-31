<script setup lang="ts">
import { Braces, CircleSlash2 } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { EvidenceAgentUiState, ValidatedEvidenceAgentResult } from "../../../entities/evidence-agent";
import { useI18n } from "../../../i18n";
import { artifactEvidenceRoute } from "../../inspect-artifact";
import { evidenceAgentStatusLabels } from "../presentation";

const props = defineProps<{
  agentState: EvidenceAgentUiState;
  agentResult: ValidatedEvidenceAgentResult;
}>();
const { t } = useI18n();
const visibleClaims = computed(() => (props.agentState === "stale" ? [] : props.agentResult.response.claims));

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
  <section class="panel evidence-agent-result" :aria-label="t('Agent 独立草稿')">
    <header class="panel-header">
      <div>
        <p class="section-kicker">ATOMIC CLAIMS · USER CONFIRMATION REQUIRED</p>
        <h2>{{ t("Agent 独立草稿") }}</h2>
        <p>{{ t("每条事实单独验证引用；结果不会覆盖 deterministic report。") }}</p>
      </div>
      <span class="evidence-agent-state" :data-state="agentState">{{
        t(evidenceAgentStatusLabels[agentState] || agentState)
      }}</span>
    </header>
    <div v-if="agentState === 'stale'" class="evidence-agent-unavailable" role="alert">
      <CircleSlash2 :size="20" />
      <div>
        <strong>{{ t("结果与当前证据绑定不再匹配") }}</strong>
        <p>{{ t("run、backend、schema revision 或 snapshot digest 已变化；旧 claims 已隐藏。") }}</p>
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
                  · {{ citation.value.decimal }}<template v-if="citation.unit"> {{ citation.unit }}</template></template
                ></small
              ></span
            >
          </RouterLink>
        </div>
      </li>
    </ol>
  </section>
</template>
