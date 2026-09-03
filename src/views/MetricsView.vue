<script setup lang="ts">
import { ArrowDown, ArrowUp, TimerReset } from "@lucide/vue";
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber, formatPicoseconds } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import type { LosslessInteger, SourcedValue } from "../contracts/report-model";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { RequestEvidenceAction } from "../features/run-bound-evidence";
import {
  buildRequestLatencyVisualization,
  ExecutionVisualizationPanel,
  requestMetricSource,
} from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";

const { state, dashboardView } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const requestLatencyVisualization = computed(() => buildRequestLatencyVisualization(state.bundle.metrics));

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}

function metricValue(metric: SourcedValue<number | LosslessInteger>, unit: string) {
  return metric.availability === "available" ? `${formatNumber(metric.value)} ${unit}` : t("不适用");
}

function readablePicoseconds(metric: SourcedValue<number | LosslessInteger>) {
  return metric.availability === "available" ? formatPicoseconds(metric.value) : t("不适用");
}
</script>

<template>
  <EmptyState
    v-if="!state.bundle.metrics"
    title="还没有性能结果"
    description="请先打开一次已完成的实验，或运行一个新实验。"
    action-label="新建实验"
    action-to="/experiment"
  />
  <div v-else class="view-stack">
    <section class="stat-grid" data-help-anchor="metrics-summary">
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
        :label="t('首 Token 延迟（TTFT）P95')"
        :value="readablePicoseconds(dashboardView.metrics.ttftP95Ps)"
        :hint="`P99 ${readablePicoseconds(dashboardView.metrics.ttftP99Ps)}`"
      />
      <StatCard
        :label="t('每 Token 延迟（TPOT）P95')"
        :value="readablePicoseconds(dashboardView.metrics.tpotP95Ps)"
        :hint="`P99 ${readablePicoseconds(dashboardView.metrics.tpotP99Ps)}`"
      />
      <StatCard
        :label="`${t('端到端')} P95`"
        :value="readablePicoseconds(dashboardView.metrics.endToEndP95Ps)"
        :hint="`P99 ${readablePicoseconds(dashboardView.metrics.endToEndP99Ps)}`"
      />
    </section>
    <nav class="metric-evidence-links" :aria-label="t('汇总指标证据')" data-help-anchor="metrics-evidence">
      <ArtifactEvidenceLink
        :source-path="dashboardView.metrics.throughputRequestsPerSecond.sourcePaths[0]"
        label="吞吐证据"
      />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.ttftP95Ps.sourcePaths[0]" label="首 Token 延迟证据" />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.tpotP95Ps.sourcePaths[0]" label="每 Token 延迟证据" />
      <ArtifactEvidenceLink :source-path="dashboardView.metrics.endToEndP95Ps.sourcePaths[0]" label="端到端 P95 证据" />
    </nav>

    <ExecutionVisualizationPanel :visualization="requestLatencyVisualization" />

    <article class="panel" data-help-anchor="metrics-requests">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">{{ t("逐个请求") }}</p>
          <h2>{{ t("请求级结果") }}</h2>
          <p>{{ t("比较每个请求第一次开始响应、连续生成和全部完成所需的时间。") }}</p>
        </div>
        <div class="panel-count">
          <TimerReset :size="16" />{{
            t("{count} 个请求", { count: state.bundle.metrics.request_metrics?.length || 0 })
          }}
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("请求") }}</th>
              <th>{{ t("状态") }}</th>
              <th class="numeric">{{ t("首 Token 延迟（TTFT）") }}</th>
              <th class="numeric">{{ t("每 Token 延迟（TPOT）") }}</th>
              <th class="numeric">{{ t("端到端") }}</th>
              <th class="numeric">{{ t("生成步数") }}</th>
              <th>{{ t("证据") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in state.bundle.metrics.request_metrics || []" :key="request.request_id">
              <td>
                <strong>{{ request.request_id }}</strong>
              </td>
              <td><StatusPill :value="request.status" /></td>
              <td class="numeric metric-duration">
                <strong>{{ formatPicoseconds(request.ttft_ps) }}</strong
                ><small>{{ formatNumber(request.ttft_ps) }} ps</small>
              </td>
              <td class="numeric metric-duration">
                <strong>{{ formatPicoseconds(request.tpot_ps) }}</strong
                ><small>{{ formatNumber(request.tpot_ps) }} ps</small>
              </td>
              <td class="numeric">
                <span class="metric-duration"
                  ><strong>{{ formatPicoseconds(request.end_to_end_latency_ps) }}</strong
                  ><small>{{ formatNumber(request.end_to_end_latency_ps) }} ps</small></span
                >
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

    <section class="metric-footnote" data-help-anchor="metrics-interpretation">
      <ArrowDown :size="17" />
      <p>
        <strong>{{ t("如何理解这些数字") }}</strong
        >{{ t("延迟越低通常越好，但结论必须与证据来源、负载输入和实际 fidelity 一起判断。") }}
      </p>
      <ArrowUp :size="17" />
    </section>
  </div>
</template>
