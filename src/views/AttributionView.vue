<script setup lang="ts">
import { Braces, ChevronDown, GitCommitHorizontal, ShieldCheck, Target, TriangleAlert } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import RecordPager from "../components/ui/RecordPager.vue";
import { useRecordPage } from "../components/ui/useRecordPage";
import { partitionCausalAttributions, RunBoundEvidencePanel } from "../features/run-bound-evidence";
import {
  attributionSource,
  buildAttributionVisualization,
  causeSource,
  ExecutionVisualizationPanel,
} from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";
const { state } = useDashboard();
const { t, isEnglish } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const selectedEvidenceRequestId = computed(() => evidenceSelection.requestForRun(state.runId));
const activeSection = ref<"chain" | "attribution">("chain");
const partitionedAttributions = computed(() =>
  partitionCausalAttributions(state.bundle.tail?.attribution_ranking || []),
);
const causalAttributionRanking = computed(() => partitionedAttributions.value.causal);
const outputPlaneAttributions = computed(() => partitionedAttributions.value.outputPlane);
const {
  page: rankingPage,
  pages: rankingPages,
  visibleRecords: visibleRanking,
} = useRecordPage(causalAttributionRanking);
const { page: outputPage, pages: outputPages, visibleRecords: visibleOutput } = useRecordPage(outputPlaneAttributions);
const causes = computed(() =>
  (state.bundle.tail?.cause_chain || []).map((item, sourceIndex) => ({ item, sourceIndex })),
);
const { page: causePage, pages: causePages, visibleRecords: visibleCauses } = useRecordPage(causes);
const auditOpen = ref(false);
const causesOpen = ref(false);
watch(
  () => state.bundle.tail,
  () => {
    auditOpen.value = false;
    causesOpen.value = false;
  },
);
const attributionVisualization = computed(() =>
  buildAttributionVisualization(
    causalAttributionRanking.value.map(({ item }) => item),
    (item) => attributionSource(state.bundle.tail?.attribution_ranking || [], item.attribution_id),
  ),
);

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}

function shareWidth(share: number | undefined) {
  return typeof share === "number" && Number.isFinite(share) && share >= 0 && share <= 1 ? `${share * 100}%` : null;
}

function shareOutOfRange(share: number | undefined) {
  return typeof share === "number" && Number.isFinite(share) && (share < 0 || share > 1);
}
</script>

<template>
  <div class="view-stack evidence-workspace attribution-view">
    <nav class="evidence-workspace-tabs" :aria-label="t('请求证据视图')">
      <button
        type="button"
        :class="{ active: activeSection === 'chain' }"
        :aria-pressed="activeSection === 'chain'"
        @click="activeSection = 'chain'"
      >
        {{ isEnglish ? "Cross-module evidence" : "跨模块证据链" }}
      </button>
      <button
        type="button"
        data-help-anchor="attribution-ranking"
        :class="{ active: activeSection === 'attribution' }"
        :aria-pressed="activeSection === 'attribution'"
        :disabled="!state.bundle.tail?.attribution_ranking"
        @click="activeSection = 'attribution'"
      >
        {{ t("尾延迟归因") }}
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
        <section class="attribution-intro attribution-primary-summary" :aria-label="t('归因对象与报告质量')">
          <div>
            <p class="section-kicker">{{ t("归因对象") }}</p>
            <h2 class="entity-id">
              <Target :size="18" /><strong>{{ state.bundle.tail.explained_entity?.id || t("未报告") }}</strong>
            </h2>
            <ArtifactEvidenceLink v-if="state.bundle.tail.explained_entity" source-path="tail:/explained_entity" />
          </div>
          <dl>
            <div>
              <dt>{{ t("报告置信度") }}</dt>
              <dd>
                {{ formatPercent(state.bundle.tail.confidence)
                }}<ArtifactEvidenceLink
                  v-if="state.bundle.tail.confidence !== undefined"
                  source-path="tail:/confidence"
                />
              </dd>
            </div>
            <div>
              <dt>{{ t("证据完整度") }}</dt>
              <dd>
                {{ formatPercent(state.bundle.tail.completeness)
                }}<ArtifactEvidenceLink
                  v-if="state.bundle.tail.completeness !== undefined"
                  source-path="tail:/completeness"
                />
              </dd>
            </div>
          </dl>
          <p class="attribution-reading-note">{{ t("置信度与完整度是报告字段，不代表真实系统准确率。") }}</p>
        </section>

        <ExecutionVisualizationPanel :visualization="attributionVisualization" show-boundary />

        <article class="panel attribution-ranking-panel">
          <header class="panel-header">
            <div>
              <p class="section-kicker">{{ t("报告贡献项") }}</p>
              <h2>{{ t("贡献排序") }}</h2>
              <p>{{ t("保留报告顺序与原始排名；份额条使用固定 0–100% 范围，不重新归一化。") }}</p>
            </div>
          </header>
          <div
            v-if="causalAttributionRanking.length"
            class="table-wrap attribution-table-scroll"
            role="region"
            :aria-label="t('贡献排序')"
            tabindex="0"
          >
            <table class="attribution-ranking-table">
              <thead>
                <tr>
                  <th scope="col">{{ t("报告排名") }}</th>
                  <th scope="col">{{ t("贡献项与说明") }}</th>
                  <th scope="col">{{ t("报告份额") }}</th>
                  <th scope="col" class="numeric">{{ t("归因分数") }} (ps)</th>
                  <th scope="col">{{ t("证据") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="{ item, sourceIndex } in visibleRanking" :key="sourceIndex" class="ranking-row">
                  <td class="rank-index">{{ item.rank ?? t("未报告") }}</td>
                  <th scope="row" class="rank-copy">
                    <small>{{ item.subsystem }}</small
                    ><strong>{{ item.component_code || t("未报告") }}</strong>
                    <p v-if="item.detail">{{ item.detail }}</p>
                  </th>
                  <td class="attribution-share">
                    <strong>{{ formatPercent(item.share) }}</strong>
                    <div class="rank-bar" aria-hidden="true">
                      <span v-if="shareWidth(item.share) !== null" :style="{ width: shareWidth(item.share)! }"></span>
                    </div>
                    <small v-if="shareOutOfRange(item.share)" class="attribution-share-warning">{{
                      t("超出 0–100%，不绘制份额条")
                    }}</small>
                  </td>
                  <td class="numeric">
                    <code>{{ formatNumber(item.score_ps) }}</code>
                  </td>
                  <td>
                    <ArtifactEvidenceLink
                      :source-path="attributionSource(state.bundle.tail.attribution_ranking || [], item.attribution_id)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="attribution-no-records">
            {{ t("没有可展示的延迟贡献项；执行、验证与输出记录不作为延迟原因。") }}
          </p>
          <RecordPager v-model:page="rankingPage" :pages="rankingPages" :label="t('贡献项分页')" />
        </article>

        <details
          v-if="state.bundle.tail.attribution_audit"
          class="panel attribution-audit attribution-secondary-disclosure"
          data-help-anchor="attribution-audit"
          :open="auditOpen"
          @toggle="auditOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="panel-header">
            <div>
              <p class="section-kicker">{{ t("报告审计") }}</p>
              <h2>{{ t("归因守恒与传播审计") }}</h2>
              <p>{{ t("直接展示归因报告的审计结论；守恒通过不代表传播链完整。") }}</p>
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
          <template v-if="auditOpen">
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
                <dd
                  :class="
                    state.bundle.tail.attribution_audit.conserved === true
                      ? 'audit-pass'
                      : state.bundle.tail.attribution_audit.conserved === false
                        ? 'audit-warning'
                        : ''
                  "
                >
                  <ShieldCheck v-if="state.bundle.tail.attribution_audit.conserved === true" :size="16" />
                  <TriangleAlert v-else-if="state.bundle.tail.attribution_audit.conserved === false" :size="16" />
                  {{
                    state.bundle.tail.attribution_audit.conserved === true
                      ? t("通过")
                      : state.bundle.tail.attribution_audit.conserved === false
                        ? t("未通过")
                        : t("未报告")
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ t("传播完整") }}</dt>
                <dd
                  :class="
                    state.bundle.tail.attribution_audit.propagation_complete === true
                      ? 'audit-pass'
                      : state.bundle.tail.attribution_audit.propagation_complete === false
                        ? 'audit-warning'
                        : ''
                  "
                >
                  <ShieldCheck v-if="state.bundle.tail.attribution_audit.propagation_complete === true" :size="16" />
                  <TriangleAlert
                    v-else-if="state.bundle.tail.attribution_audit.propagation_complete === false"
                    :size="16"
                  />
                  {{
                    state.bundle.tail.attribution_audit.propagation_complete === true
                      ? t("完整")
                      : state.bundle.tail.attribution_audit.propagation_complete === false
                        ? t("不完整")
                        : t("未报告")
                  }}
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
            <div class="attribution-audit-evidence"><ArtifactEvidenceLink source-path="tail:/attribution_audit" /></div>
          </template>
        </details>

        <details
          v-if="state.bundle.tail.cause_chain?.length"
          class="panel attribution-secondary-disclosure attribution-cause-disclosure"
          :open="causesOpen"
          @toggle="causesOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="panel-header">
            <div>
              <p class="section-kicker">{{ t("有序解释") }}</p>
              <h2>{{ t("共享时间轴上的原因链") }}</h2>
              <p>{{ t("这是报告提供的有序解释，不应单独视为现实因果证明。") }}</p>
            </div>
            <span>{{ t("{count} 条原因记录", { count: state.bundle.tail.cause_chain.length }) }}</span>
            <ChevronDown :size="17" />
          </summary>
          <template v-if="causesOpen">
            <ol class="cause-chain">
              <li v-for="{ item: cause, sourceIndex } in visibleCauses" :key="sourceIndex">
                <span>{{ sourceIndex + 1 }}</span>
                <div>
                  <small>{{ cause.subsystem }}</small
                  ><strong>{{ cause.title || cause.cause_code }}</strong>
                  <p>{{ cause.evidence }}</p>
                </div>
                <GitCommitHorizontal :size="18" />
                <ArtifactEvidenceLink :source-path="causeSource(state.bundle.tail.cause_chain || [], cause.cause_id)" />
              </li>
            </ol>
            <RecordPager v-model:page="causePage" :pages="causePages" :label="t('原因记录分页')" />
          </template>
        </details>

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
              <p class="section-kicker">{{ t("非因果输出记录") }}</p>
              <h2>{{ t("执行宿主、验证与输出记录") }}</h2>
              <p>{{ t("这些记录原样保留供审计，但与上方 S0–S6 latency causal ranking 明确分区。") }}</p>
            </div>
          </header>
          <div
            class="table-wrap attribution-table-scroll"
            role="region"
            :aria-label="t('执行宿主、验证与输出记录')"
            tabindex="0"
          >
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
                <tr v-for="{ item, sourceIndex } in visibleOutput" :key="sourceIndex">
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
          <RecordPager v-model:page="outputPage" :pages="outputPages" :label="t('输出记录分页')" />
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
