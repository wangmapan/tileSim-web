<script setup lang="ts">
import { Braces, GitCommitHorizontal, ShieldCheck, Target, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { partitionCausalAttributions, RunBoundEvidencePanel } from "../features/run-bound-evidence";
import { attributionSource, causeSource } from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";
const { state } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const selectedEvidenceRequestId = computed(() => evidenceSelection.requestForRun(state.runId));
const partitionedAttributions = computed(() =>
  partitionCausalAttributions(state.bundle.tail?.attribution_ranking || []),
);
const causalAttributionRanking = computed(() => partitionedAttributions.value.causal);
const outputPlaneAttributions = computed(() => partitionedAttributions.value.outputPlane);

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}
</script>

<template>
  <EmptyState v-if="!state.bundle.tail?.attribution_ranking" title="没有尾延迟归因报告" />
  <div v-else class="view-stack">
    <section class="attribution-intro">
      <div>
        <p class="section-kicker">EXPLAINED ENTITY</p>
        <div class="entity-id">
          <Target :size="21" /><strong>{{ state.bundle.tail.explained_entity?.id || "unknown" }}</strong>
        </div>
        <p>{{ t("当前尾部请求的跨子系统解释对象。") }}</p>
      </div>
      <dl>
        <div>
          <dt>Confidence</dt>
          <dd>{{ formatPercent(state.bundle.tail.confidence) }}</dd>
        </div>
        <div>
          <dt>Completeness</dt>
          <dd>{{ formatPercent(state.bundle.tail.completeness) }}</dd>
        </div>
      </dl>
    </section>

    <RunBoundEvidencePanel
      :run-id="state.runId"
      :bundle="state.bundle"
      :inputs="state.inputs"
      :artifact-manifest="state.artifactManifest"
      :selected-request-id="selectedEvidenceRequestId"
      @request-selected="selectEvidenceRequest"
    />

    <article v-if="state.bundle.tail.attribution_audit" class="panel attribution-audit">
      <header class="panel-header">
        <div>
          <p class="section-kicker">ATTRIBUTION AUDIT</p>
          <h2>{{ t("归因守恒与传播审计") }}</h2>
          <p>{{ t("直接展示 S9 报告的审计结论；守恒通过不代表传播链已经完整。") }}</p>
        </div>
        <span
          class="status-pill"
          :class="
            state.bundle.tail.attribution_audit.status === 'passed' ? 'status-pill--positive' : 'status-pill--warning'
          "
          >{{ state.bundle.tail.attribution_audit.status || t("未报告") }}</span
        >
      </header>
      <dl class="attribution-audit-grid">
        <div>
          <dt>{{ t("证据层级") }}</dt>
          <dd>{{ state.bundle.tail.attribution_audit.evidence_tier || t("未报告") }}</dd>
        </div>
        <div>
          <dt>{{ t("归因总分") }}</dt>
          <dd>{{ formatNumber(state.bundle.tail.attribution_audit.score_total_ps) }} ps</dd>
        </div>
        <div>
          <dt>{{ t("份额合计") }}</dt>
          <dd>{{ formatNumber(state.bundle.tail.attribution_audit.share_sum) }}</dd>
        </div>
        <div>
          <dt>{{ t("分数守恒") }}</dt>
          <dd :class="state.bundle.tail.attribution_audit.conserved ? 'audit-pass' : 'audit-warning'">
            <ShieldCheck v-if="state.bundle.tail.attribution_audit.conserved" :size="16" />
            <TriangleAlert v-else :size="16" />
            {{ state.bundle.tail.attribution_audit.conserved ? t("通过") : t("未通过") }}
          </dd>
        </div>
        <div>
          <dt>{{ t("传播完整") }}</dt>
          <dd :class="state.bundle.tail.attribution_audit.propagation_complete ? 'audit-pass' : 'audit-warning'">
            <ShieldCheck v-if="state.bundle.tail.attribution_audit.propagation_complete" :size="16" />
            <TriangleAlert v-else :size="16" />
            {{ state.bundle.tail.attribution_audit.propagation_complete ? t("完整") : t("不完整") }}
          </dd>
        </div>
      </dl>
      <div v-if="state.bundle.tail.attribution_audit.issues?.length" class="attribution-audit-issues">
        <TriangleAlert :size="18" />
        <div>
          <strong>{{ t("未关闭问题") }}</strong>
          <code v-for="issue in state.bundle.tail.attribution_audit.issues" :key="issue">{{ issue }}</code>
        </div>
      </div>
    </article>

    <article v-if="state.bundle.tail.cause_chain?.length" class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">CAUSE CHAIN</p>
          <h2>{{ t("共享时间轴上的原因链") }}</h2>
          <p>{{ t("这是报告提供的有序解释，不应单独视为现实因果证明。") }}</p>
        </div>
      </header>
      <ol class="cause-chain">
        <li
          v-for="(cause, index) in state.bundle.tail.cause_chain"
          :key="cause.cause_id || `${cause.subsystem}-${index}`"
        >
          <span>{{ index + 1 }}</span>
          <div>
            <small>{{ cause.subsystem }}</small
            ><strong>{{ cause.title || cause.cause_code }}</strong>
            <p>{{ cause.evidence }}</p>
          </div>
          <GitCommitHorizontal :size="18" />
          <ArtifactEvidenceLink :source-path="causeSource(state.bundle.tail.cause_chain || [], cause.cause_id)" />
        </li>
      </ol>
    </article>

    <article class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">ATTRIBUTION RANKING</p>
          <h2>{{ t("贡献排序") }}</h2>
          <p>{{ t("按报告中的 picosecond 证据排序。") }}</p>
        </div>
      </header>
      <div class="ranking-list">
        <div
          v-for="{ item } in causalAttributionRanking"
          :key="item.attribution_id || `${item.rank}-${item.subsystem}`"
          class="ranking-row"
        >
          <span class="rank-index">{{ String(item.rank).padStart(2, "0") }}</span>
          <div class="rank-copy">
            <small>{{ item.subsystem }}</small
            ><strong>{{ item.component_code }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <div class="rank-bar"><span :style="{ width: `${Math.max((item.share || 0) * 100, 1)}%` }"></span></div>
          <div class="rank-score">
            <strong>{{ formatPercent(item.share) }}</strong
            ><small>{{ formatNumber(item.score_ps) }} ps</small>
          </div>
          <ArtifactEvidenceLink
            :source-path="attributionSource(state.bundle.tail.attribution_ranking || [], item.attribution_id)"
          />
        </div>
      </div>
    </article>

    <section v-if="outputPlaneAttributions.length" class="scope-callout">
      <TriangleAlert :size="18" />
      <p>
        <strong>{{ t("输出面不是延迟因果来源") }}</strong
        >{{
          t("报告中的 S7/S8/S9 项保留为输出面记录，但不会进入 S0-S6 causal ranking：{ids}", {
            ids: outputPlaneAttributions.map(({ item }) => item.attribution_id || item.subsystem).join(", "),
          })
        }}
      </p>
    </section>

    <div class="scope-callout">
      <Braces :size="18" />
      <p>
        <strong>{{ t("解释边界") }}</strong
        >{{ t("未覆盖的系统行为应继续保留为 unresolved gap；归因排序不能替代真实系统实验。") }}
      </p>
    </div>
  </div>
</template>
