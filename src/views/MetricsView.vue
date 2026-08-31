<script setup lang="ts">
import { ArrowDown, ArrowUp, TimerReset } from "@lucide/vue";
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import type { LosslessInteger, SourcedValue } from "../contracts/report-model";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { RequestEvidenceAction, RunBoundEvidencePanel } from "../features/run-bound-evidence";
import { requestMetricSource } from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";

const { state, dashboardView } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const selectedEvidenceRequestId = computed(() => evidenceSelection.requestForRun(state.runId));

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}

function metricValue(metric: SourcedValue<number | LosslessInteger>, unit: string) {
  return metric.availability === "available" ? `${formatNumber(metric.value)} ${unit}` : t("不适用");
}
</script>

<template>
  <EmptyState v-if="!state.bundle.metrics" title="没有性能指标报告" />
  <div v-else class="view-stack">
    <section class="stat-grid">
      <StatCard
        :label="t('吞吐')"
        :value="metricValue(dashboardView.metrics.throughputRequestsPerSecond, 'req/s')"
        :hint="
          t('{done}/{total} 请求完成', {
            done: dashboardView.metrics.completedRequestCount.value ?? '—',
            total: dashboardView.metrics.requestCount.value ?? '—',
          })
        "
        accent
      />
      <StatCard
        label="TTFT P95"
        :value="metricValue(dashboardView.metrics.ttftP95Ps, 'ps')"
        :hint="`P99 ${metricValue(dashboardView.metrics.ttftP99Ps, 'ps')}`"
      />
      <StatCard
        label="TPOT P95"
        :value="metricValue(dashboardView.metrics.tpotP95Ps, 'ps')"
        :hint="`P99 ${metricValue(dashboardView.metrics.tpotP99Ps, 'ps')}`"
      />
      <StatCard
        :label="`${t('端到端')} P95`"
        :value="metricValue(dashboardView.metrics.endToEndP95Ps, 'ps')"
        :hint="`P99 ${metricValue(dashboardView.metrics.endToEndP99Ps, 'ps')}`"
      />
    </section>
    <nav class="metric-evidence-links" :aria-label="t('汇总指标证据')">
      <ArtifactEvidenceLink
        :source-path="dashboardView.metrics.throughputRequestsPerSecond.sourcePaths[0]"
        label="吞吐证据"
      />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.ttftP95Ps.sourcePaths[0]" label="TTFT P95 证据" />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.tpotP95Ps.sourcePaths[0]" label="TPOT P95 证据" />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.endToEndP95Ps.sourcePaths[0]" label="端到端 P95 证据" />
    </nav>

    <RunBoundEvidencePanel
      :run-id="state.runId"
      :bundle="state.bundle"
      :inputs="state.inputs"
      :artifact-manifest="state.artifactManifest"
      :selected-request-id="selectedEvidenceRequestId"
      @request-selected="selectEvidenceRequest"
    />

    <article class="panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">REQUEST METRICS</p>
          <h2>{{ t("请求级结果") }}</h2>
          <p>{{ t("每个请求在统一时间轴上的首 token、逐 token 与完成时延。") }}</p>
        </div>
        <div class="panel-count">
          <TimerReset :size="16" />{{ state.bundle.metrics.request_metrics?.length || 0 }} requests
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("请求") }}</th>
              <th>{{ t("状态") }}</th>
              <th class="numeric">TTFT</th>
              <th class="numeric">TPOT</th>
              <th class="numeric">{{ t("端到端") }}</th>
              <th class="numeric">Decode steps</th>
              <th>{{ t("证据") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in state.bundle.metrics.request_metrics || []" :key="request.request_id">
              <td>
                <strong>{{ request.request_id }}</strong>
              </td>
              <td><StatusPill :value="request.status" /></td>
              <td class="numeric">{{ formatNumber(request.ttft_ps) }} <small>ps</small></td>
              <td class="numeric">{{ formatNumber(request.tpot_ps) }} <small>ps</small></td>
              <td class="numeric">
                <strong>{{ formatNumber(request.end_to_end_latency_ps) }}</strong> <small>ps</small>
              </td>
              <td class="numeric">{{ formatNumber(request.decode_step_count, 0) }}</td>
              <td>
                <div class="request-evidence-actions">
                  <ArtifactEvidenceLink
                    :source-path="requestMetricSource(state.bundle.metrics.request_metrics || [], request.request_id)"
                  />
                  <RequestEvidenceAction
                    :run-id="state.runId"
                    :request-id="request.request_id"
                    @request-selected="selectEvidenceRequest"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <section class="metric-footnote">
      <ArrowDown :size="17" />
      <p>
        <strong>{{ t("如何理解这些数字") }}</strong
        >{{ t("延迟越低通常越好，但结论必须与证据来源、负载输入和实际 fidelity 一起判断。") }}
      </p>
      <ArrowUp :size="17" />
    </section>
  </div>
</template>
