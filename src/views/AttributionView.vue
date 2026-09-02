<script setup lang="ts">
import { Braces, ChevronDown, GitCommitHorizontal, ShieldCheck, Target, TriangleAlert } from "@lucide/vue";
import { computed, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { partitionCausalAttributions, RunBoundEvidencePanel } from "../features/run-bound-evidence";
import {
  attributionSource,
  buildAttributionVisualization,
  causeSource,
  ExecutionVisualizationPanel,
} from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";
const { state } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const selectedEvidenceRequestId = computed(() => evidenceSelection.requestForRun(state.runId));
const activeSection = ref<"chain" | "attribution">("chain");
const partitionedAttributions = computed(() =>
  partitionCausalAttributions(state.bundle.tail?.attribution_ranking || []),
);
const causalAttributionRanking = computed(() => partitionedAttributions.value.causal);
const outputPlaneAttributions = computed(() => partitionedAttributions.value.outputPlane);
const attributionVisualization = computed(() =>
  buildAttributionVisualization(
    causalAttributionRanking.value.map(({ item }) => item),
    (item) => attributionSource(state.bundle.tail?.attribution_ranking || [], item.attribution_id),
  ),
);

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}
</script>

<template>
  <div class="view-stack evidence-workspace">
    <nav class="evidence-workspace-tabs" :aria-label="t('请求证据视图')">
      <button
        type="button"
        :class="{ active: activeSection === 'chain' }"
        :aria-pressed="activeSection === 'chain'"
        @click="activeSection = 'chain'"
      >
        {{ t("跨子系统证据链") }}
      </button>
      <button
        type="button"
        data-help-anchor="attribution-ranking"
        :class="{ active: activeSection === 'attribution' }"
        :aria-pressed="activeSection === 'attribution'"
        :disabled="!state.bundle.tail?.attribution_ranking"
        @click="activeSection = 'attribution'"
      >
        {{ t("S9 尾延迟归因") }}
      </button>
    </nav>

    <RunBoundEvidencePanel
      v-if="activeSection === 'chain'"
      :run-id="state.runId"
      :bundle="state.bundle"
      :inputs="state.inputs"
      :artifact-manifest="state.artifactManifest"
      :selected-request-id="selectedEvidenceRequestId"
      @request-selected="selectEvidenceRequest"
    />

    <template v-else>
      <EmptyState
        v-if="!state.bundle.tail?.attribution_ranking"
        title="还没有慢请求原因可看"
        description="请先打开一次包含请求归因结果的实验，或运行一个新实验。"
        action-label="新建实验"
        action-to="/experiment"
      />
      <template v-else>
        <section class="attribution-intro attribution-primary-summary">
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

        <details
          v-if="state.bundle.tail.attribution_audit"
          class="panel attribution-audit attribution-secondary-disclosure"
          data-help-anchor="attribution-audit"
        >
          <summary class="panel-header">
            <div>
              <p class="section-kicker">ATTRIBUTION AUDIT</p>
              <h2>{{ t("归因守恒与传播审计") }}</h2>
              <p>{{ t("直接展示 S9 报告的审计结论；守恒通过不代表传播链已经完整。") }}</p>
            </div>
            <span
              class="status-pill"
              :class="
                state.bundle.tail.attribution_audit.status === 'passed'
                  ? 'status-pill--positive'
                  : 'status-pill--warning'
              "
              >{{ state.bundle.tail.attribution_audit.status || t("未报告") }}</span
            >
            <ChevronDown :size="17" />
          </summary>
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
        </details>

        <details
          v-if="state.bundle.tail.cause_chain?.length"
          class="panel attribution-secondary-disclosure attribution-cause-disclosure"
        >
          <summary class="panel-header">
            <div>
              <p class="section-kicker">CAUSE CHAIN</p>
              <h2>{{ t("共享时间轴上的原因链") }}</h2>
              <p>{{ t("这是报告提供的有序解释，不应单独视为现实因果证明。") }}</p>
            </div>
            <span>{{ state.bundle.tail.cause_chain.length }} causes</span>
            <ChevronDown :size="17" />
          </summary>
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
        </details>

        <ExecutionVisualizationPanel :visualization="attributionVisualization" />

        <article class="panel attribution-ranking-panel">
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

        <section v-if="outputPlaneAttributions.length" class="scope-callout attribution-scope-note">
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

        <article v-if="outputPlaneAttributions.length" class="panel attribution-output-plane">
          <header class="panel-header">
            <div>
              <p class="section-kicker">S7 / S8 / S9 OUTPUT RECORDS</p>
              <h2>{{ t("执行宿主、验证与输出记录") }}</h2>
              <p>{{ t("这些记录原样保留供审计，但与上方 S0–S6 latency causal ranking 明确分区。") }}</p>
            </div>
          </header>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>rank</th>
                  <th>subsystem</th>
                  <th>component</th>
                  <th class="numeric">share</th>
                  <th class="numeric">score_ps</th>
                  <th>{{ t("报告说明") }}</th>
                  <th>{{ t("证据") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ item } in outputPlaneAttributions"
                  :key="item.attribution_id || `${item.rank}-${item.subsystem}`"
                >
                  <td>{{ item.rank ?? t("缺失") }}</td>
                  <td>
                    <code>{{ item.subsystem || t("缺失") }}</code>
                  </td>
                  <td>{{ item.component_code || t("缺失") }}</td>
                  <td class="numeric">{{ formatPercent(item.share) }}</td>
                  <td class="numeric">
                    <code>{{ formatNumber(item.score_ps) }}</code>
                  </td>
                  <td>{{ item.detail || t("未报告") }}</td>
                  <td>
                    <ArtifactEvidenceLink
                      :source-path="
                        attributionSource(state.bundle.tail?.attribution_ranking || [], item.attribution_id)
                      "
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <div class="scope-callout attribution-scope-note">
          <Braces :size="18" />
          <p>
            <strong>{{ t("解释边界") }}</strong
            >{{ t("未覆盖的系统行为应继续保留为 unresolved gap；归因排序不能替代真实系统实验。") }}
          </p>
        </div>
      </template>
    </template>
  </div>
</template>
