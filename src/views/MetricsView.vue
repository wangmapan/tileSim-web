<script setup lang="ts">
import { ArrowDown, ArrowUp, TimerReset } from "@lucide/vue";
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import InlineHelp from "../components/InlineHelp.vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber, formatPicoseconds, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { isLosslessInteger } from "../contracts/lossless-json";
import type { LosslessInteger, RequestMetric, SourcedValue } from "../contracts/report-model";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { RequestEvidenceAction } from "../features/run-bound-evidence";
import {
  buildRequestLatencyVisualization,
  ExecutionVisualizationPanel,
  requestMetricSource,
} from "../features/execution-inspector";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";
import { availabilityDescription, availabilityLabel, ReportCoveragePanel } from "../features/report-coverage";

const { state, dashboardView } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const requestLatencyVisualization = computed(() => buildRequestLatencyVisualization(state.bundle.metrics));
const metricsTraceProvenance = computed(() => {
  const metricsProvenance = state.bundle.metrics?.trace_provenance || {};
  const validationProvenance = state.bundle.validation?.trace_provenance || {};
  return {
    source_mode: validationProvenance.source_mode || metricsProvenance.source_mode,
    calibration_level: validationProvenance.calibration_level || metricsProvenance.calibration_level,
    allowed_claim_scope: validationProvenance.allowed_claim_scope || metricsProvenance.allowed_claim_scope,
    trace_kind: validationProvenance.trace_kind || metricsProvenance.trace_kind,
  };
});

function selectEvidenceRequest(requestId: string) {
  if (state.runId) evidenceSelection.select(state.runId, requestId);
}

/**
 * C0-7: `SourcedValue.availability` keeps its five distinct states; a reported
 * `0` stays a value, while each missing state renders its own label + reason.
 */
function metricValue(metric: SourcedValue<number | LosslessInteger>, unit: string) {
  return metric.availability === "available"
    ? `${formatNumber(metric.value)} ${unit}`
    : availabilityLabel(metric.availability);
}

function readablePicoseconds(metric: SourcedValue<number | LosslessInteger>) {
  return metric.availability === "available" ? formatPicoseconds(metric.value) : availabilityLabel(metric.availability);
}

function completionHint(
  completed: SourcedValue<number | LosslessInteger>,
  total: SourcedValue<number | LosslessInteger>,
) {
  const label = t("{done}/{total} 请求完成", {
    done: metricCount(completed),
    total: metricCount(total),
  });
  return total.availability === "available" ? label : `${label} · ${availabilityDescription(total.availability)}`;
}

function metricCount(metric: SourcedValue<number | LosslessInteger>) {
  return metric.availability === "available" ? formatNumber(metric.value) : availabilityLabel(metric.availability);
}

type RequestLatencyField = "ttft_ps" | "tpot_ps" | "end_to_end_latency_ps";
function requestSampleState(request: RequestMetric, field: RequestLatencyField) {
  const flag =
    field === "ttft_ps"
      ? request.has_ttft_sample
      : field === "tpot_ps"
        ? request.has_tpot_sample
        : request.has_end_to_end_latency_sample;
  if (flag === false) return "未采样";
  if (flag === true && isLosslessInteger(request[field])) {
    const provenance = request.metric_provenance?.[field];
    const source = request[`${field}_source`];
    const traceProvenance = metricsTraceProvenance.value;
    const labels: string[] = [];
    if (provenance?.kind === "inferred" || provenance?.kind === "modelled" || source === "inferred") {
      labels.push("推断值");
    } else if (provenance?.kind === "externally_specified" || provenance?.kind === "user_supplied") {
      labels.push("外部指定值");
    } else if (provenance?.kind === "observed" || source === "observed") {
      labels.push("观测值");
    } else if (source === "fallback") {
      labels.push("fallback 结果");
    }
    if (source === "synthetic" || traceProvenance?.source_mode === "synthetic_trace") {
      labels.push("合成有效样本");
    } else if (traceProvenance?.source_mode === "compatibility_harness_trace") {
      labels.push("兼容测试数据");
    }
    if (traceProvenance?.calibration_level === "uncalibrated") labels.push("未校准");
    return labels.length ? labels.join(" · ") : "有效样本";
  }
  return "不可用";
}

function requestLatency(request: RequestMetric, field: RequestLatencyField) {
  const stateLabel = requestSampleState(request, field);
  if (stateLabel === "未采样" || stateLabel === "不可用") return stateLabel;
  return formatPicoseconds(request[field]);
}

function requestWait(request: RequestMetric, field: keyof RequestMetric) {
  return isLosslessInteger(request[field]) ? formatPicoseconds(request[field]) : availabilityLabel("missing");
}

function requestBytes(request: RequestMetric, field: keyof RequestMetric) {
  return isLosslessInteger(request[field]) ? `${formatNumber(request[field])} bytes` : availabilityLabel("missing");
}

function requestIdentity(request: RequestMetric, field: keyof RequestMetric) {
  return typeof request[field] === "string" && request[field] ? request[field] : availabilityLabel("missing");
}

function requestProfileSelection(request: RequestMetric, field: keyof RequestMetric) {
  return typeof request[field] === "string" && request[field]
    ? statusLabel(request[field])
    : availabilityLabel("missing");
}

function provenanceLabel(value: unknown) {
  return typeof value === "string" && value ? statusLabel(value) : statusLabel("unknown");
}

const deviceMetrics = computed(() => state.bundle.metrics?.system_summary?.device_metrics || []);
const pdDisaggregation = computed(() => state.bundle.metrics?.system_summary?.pd_disaggregation);
const systemSummary = computed(() => state.bundle.metrics?.system_summary || {});
const fabricDomainUtilization = computed(() => systemSummary.value.fabric_domain_utilization || []);
const phaseFabricContributions = computed(() => systemSummary.value.phase_fabric_contributions || []);
const requestFabricContributions = computed(() => systemSummary.value.request_fabric_contributions || []);
const resourceConvergence = computed(() => state.bundle.metrics?.resource_convergence);
const representativeDeviceTaskCount = computed(() => systemSummary.value.representative_device_task_count);
const unmappedDeviceTaskCount = computed(() => systemSummary.value.unmapped_device_task_count);
const missingDeviceTaskCount = computed(() => resourceConvergence.value?.missing_device_task_count);
function hasPositiveInteger(value: unknown) {
  return isLosslessInteger(value) && BigInt(value) > 0n;
}

const hasFabricEvidence = computed(
  () =>
    Boolean(systemSummary.value.has_fabric_timeline) ||
    fabricDomainUtilization.value.length > 0 ||
    phaseFabricContributions.value.length > 0 ||
    requestFabricContributions.value.length > 0 ||
    hasPositiveInteger(systemSummary.value.fabric_record_count),
);
const hasDeviceMappingWarning = computed(() => {
  const hasUnmappedTasks =
    hasPositiveInteger(unmappedDeviceTaskCount.value) || hasPositiveInteger(missingDeviceTaskCount.value);
  const allDevicesHaveNoTasks =
    deviceMetrics.value.length > 0 &&
    deviceMetrics.value.every((device) => device.evidence_state === "no_device_tasks");
  const tasksExistWithoutDeviceRows =
    deviceMetrics.value.length === 0 && hasPositiveInteger(representativeDeviceTaskCount.value);
  return hasUnmappedTasks && (allDevicesHaveNoTasks || tasksExistWithoutDeviceRows);
});

function metricCountValue(value: unknown) {
  return isLosslessInteger(value) ? formatNumber(value, 0) : availabilityLabel("missing");
}

function metricTimeValue(value: unknown) {
  return isLosslessInteger(value) ? formatPicoseconds(value) : availabilityLabel("missing");
}

function metricBytesValue(value: unknown) {
  return isLosslessInteger(value) ? `${formatNumber(value)} bytes` : availabilityLabel("missing");
}

function metricRatioValue(value: unknown) {
  return typeof value === "number" ? `${formatNumber(value * 100)}%` : availabilityLabel("missing");
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
        :hint="completionHint(dashboardView.metrics.completedRequestCount, dashboardView.metrics.requestCount)"
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

    <ReportCoveragePanel section="metrics" :bundle="state.bundle" />

    <section class="panel metrics-provenance" data-help-anchor="metrics-provenance">
      <header class="panel-header">
        <div>
          <p class="section-kicker">{{ t("指标来源与声明范围") }}</p>
          <h2>{{ t("Trace provenance") }}</h2>
          <p>{{ t("以下字段由后端报告直接提供；缺失时不推断真实采集或校准状态。") }}</p>
        </div>
      </header>
      <dl class="metrics-pd-summary">
        <div>
          <dt>{{ t("来源模式") }}</dt>
          <dd>{{ provenanceLabel(metricsTraceProvenance.source_mode) }}</dd>
        </div>
        <div>
          <dt>{{ t("校准级别") }}</dt>
          <dd>{{ provenanceLabel(metricsTraceProvenance.calibration_level) }}</dd>
        </div>
        <div>
          <dt>{{ t("声明范围") }}</dt>
          <dd>{{ provenanceLabel(metricsTraceProvenance.allowed_claim_scope) }}</dd>
        </div>
        <div>
          <dt>{{ t("Trace 类型") }}</dt>
          <dd>{{ provenanceLabel(metricsTraceProvenance.trace_kind) }}</dd>
        </div>
      </dl>
    </section>

    <ExecutionVisualizationPanel :visualization="requestLatencyVisualization" />

    <article class="panel" data-help-anchor="metrics-requests">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">{{ t("逐个请求") }}</p>
          <h2>{{ t("请求级结果") }}</h2>
          <InlineHelp :text="t('比较每个请求第一次开始响应、连续生成和全部完成所需的时间。')" />
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
                <strong>{{ requestLatency(request, "ttft_ps") }}</strong
                ><small>{{ t(requestSampleState(request, "ttft_ps")) }}</small>
              </td>
              <td class="numeric metric-duration">
                <strong>{{ requestLatency(request, "tpot_ps") }}</strong
                ><small>{{ t(requestSampleState(request, "tpot_ps")) }}</small>
              </td>
              <td class="numeric">
                <span class="metric-duration"
                  ><strong>{{ requestLatency(request, "end_to_end_latency_ps") }}</strong
                  ><small>{{ t(requestSampleState(request, "end_to_end_latency_ps")) }}</small></span
                >
              </td>
              <td class="numeric">
                {{
                  isLosslessInteger(request.decode_step_count)
                    ? formatNumber(request.decode_step_count, 0)
                    : availabilityLabel("missing")
                }}
              </td>
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

    <section class="panel metrics-diagnostics" data-help-anchor="metrics-waits">
      <header class="panel-header">
        <div>
          <p class="section-kicker">{{ t("请求级等待与归因") }}</p>
          <h2>{{ t("网络、KV、设备与集合通信等待") }}</h2>
          <p>{{ t("这些字段由后端直接报告；KV、设备和网络分项可能重叠，不能相加替代父级等待或请求延迟。") }}</p>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("请求") }}</th>
              <th>{{ t("网络等待") }}</th>
              <th>{{ t("KV 等待") }}</th>
              <th>{{ t("设备等待") }}</th>
              <th>{{ t("集合通信等待") }}</th>
              <th>{{ t("主导等待原因") }}</th>
              <th>{{ t("KV 字节与身份") }}</th>
              <th>{{ t("Profile lineage") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in state.bundle.metrics.request_metrics || []"
              :key="`${request.request_id}-diagnostics`"
            >
              <td>
                <strong>{{ request.request_id }}</strong>
              </td>
              <td>
                {{ requestWait(request, "network_wait_ps")
                }}<small v-if="isLosslessInteger(request.network_backpressure_ps)">
                  · backpressure {{ requestWait(request, "network_backpressure_ps") }}</small
                >
              </td>
              <td>
                {{ requestWait(request, "kv_wait_ps")
                }}<small>
                  · alloc {{ requestWait(request, "kv_allocation_wait_ps") }} · pressure
                  {{ requestWait(request, "kv_pressure_wait_ps") }} · remote
                  {{ requestWait(request, "kv_remote_read_wait_ps") }} · migration
                  {{ requestWait(request, "kv_migration_wait_ps") }} · PD handoff
                  {{ requestWait(request, "kv_pd_handoff_wait_ps") }}</small
                >
              </td>
              <td>{{ requestWait(request, "device_wait_ps") }}</td>
              <td>{{ requestWait(request, "collective_wait_ps") }}</td>
              <td>
                {{ requestIdentity(request, "dominant_wait_reason")
                }}<small v-if="request.dominant_kv_wait_reason"> · KV {{ request.dominant_kv_wait_reason }}</small>
              </td>
              <td>
                <div>
                  read {{ requestBytes(request, "kv_bytes_read") }} · migrated
                  {{ requestBytes(request, "kv_bytes_migrated") }} · evicted
                  {{ requestBytes(request, "kv_eviction_bytes") }}
                </div>
                <small
                  >{{ requestIdentity(request, "kv_source_identity") }} →
                  {{ requestIdentity(request, "kv_destination_identity") }}</small
                >
              </td>
              <td>
                <div>
                  {{ requestIdentity(request, "device_profile") }} ·
                  {{ requestProfileSelection(request, "device_profile_selection") }}
                </div>
                <small
                  >{{ requestIdentity(request, "device_profile_asset_id") }} ·
                  {{ requestIdentity(request, "device_profile_claim_scope") }}</small
                >
                <div>
                  {{ requestIdentity(request, "network_profile") }} ·
                  {{ requestProfileSelection(request, "network_profile_selection") }}
                </div>
                <small
                  >{{ requestIdentity(request, "network_profile_asset_id") }} ·
                  {{ requestIdentity(request, "network_profile_claim_scope") }}</small
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="deviceMetrics.length || pdDisaggregation || hasFabricEvidence || resourceConvergence"
      class="panel metrics-device-summary"
      data-help-anchor="metrics-devices"
    >
      <header class="panel-header">
        <div>
          <p class="section-kicker">{{ t("模型化设备与虚拟 Fabric") }}</p>
          <h2>{{ t("GPU-free 仿真中的卡使用与拓扑连接") }}</h2>
          <p>
            {{
              t(
                "GPU-free 表示不依赖真实 GPU；下方只展示后端报告的模型化设备活动和虚拟 Fabric 记录，不把硬件计数器缺失解释为仿真未执行。",
              )
            }}
          </p>
        </div>
      </header>
      <dl class="metrics-pd-summary">
        <div>
          <dt>{{ t("代表性设备任务") }}</dt>
          <dd>{{ metricCountValue(representativeDeviceTaskCount) }}</dd>
        </div>
        <div>
          <dt>{{ t("未映射设备任务") }}</dt>
          <dd>{{ metricCountValue(unmappedDeviceTaskCount) }}</dd>
        </div>
        <div>
          <dt>{{ t("Fabric 记录") }}</dt>
          <dd>{{ metricCountValue(systemSummary.fabric_record_count) }}</dd>
        </div>
        <div>
          <dt>{{ t("活跃 Fabric 域") }}</dt>
          <dd>{{ metricCountValue(systemSummary.active_fabric_domain_count) }}</dd>
        </div>
        <div>
          <dt>{{ t("Fabric 利用率") }}</dt>
          <dd>{{ metricRatioValue(systemSummary.fabric_utilization_ratio) }}</dd>
        </div>
        <div>
          <dt>{{ t("Fabric 忙碌时间") }}</dt>
          <dd>{{ metricTimeValue(systemSummary.fabric_busy_time_ps) }}</dd>
        </div>
        <div>
          <dt>{{ t("拥塞事件") }}</dt>
          <dd>{{ metricCountValue(systemSummary.fabric_backpressure_event_count) }}</dd>
        </div>
        <div>
          <dt>{{ t("硬件计数器") }}</dt>
          <dd>{{ t("GPU-free 不采集") }}</dd>
        </div>
      </dl>
      <p v-if="hasDeviceMappingWarning" class="metric-footnote">
        <strong>{{ t("设备归属需要后端修复") }}</strong>
        {{
          t(
            "报告显示设备任务归属不完整：存在未映射或缺失的设备任务；当前每张卡的 0 不能解释为 GPU 未参与，需修复设备任务到拓扑设备的归属后才能按卡汇总。",
          )
        }}
      </p>
      <div v-if="deviceMetrics.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("设备") }}</th>
              <th>{{ t("证据状态") }}</th>
              <th>{{ t("任务数") }}</th>
              <th>{{ t("模型显存") }}</th>
              <th>{{ t("服务时间") }}</th>
              <th>{{ t("活跃时间") }}</th>
              <th>{{ t("观测窗口") }}</th>
              <th>{{ t("利用率") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in deviceMetrics" :key="device.device_id">
              <td>
                <strong>{{ device.device_id || availabilityLabel("missing") }}</strong
                ><small>{{ device.device_type || "—" }} · {{ device.group_id || "—" }}</small>
              </td>
              <td>
                {{ device.evidence_state ? provenanceLabel(device.evidence_state) : availabilityLabel("missing")
                }}<small>{{
                  device.hardware_counter_state ? provenanceLabel(device.hardware_counter_state) : "—"
                }}</small>
              </td>
              <td>
                {{ metricCountValue(device.task_count)
                }}<small
                  >prefill {{ metricCountValue(device.prefill_task_count) }} · decode
                  {{ metricCountValue(device.decode_task_count) }}</small
                >
              </td>
              <td>{{ metricBytesValue(device.modeled_memory_bytes) }}</td>
              <td>{{ metricTimeValue(device.service_time_ps) }}</td>
              <td>{{ metricTimeValue(device.active_time_ps) }}</td>
              <td>{{ metricTimeValue(device.observation_window_ps) }}</td>
              <td>{{ metricRatioValue(device.active_time_ratio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="hasFabricEvidence" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("虚拟 Fabric 域") }}</th>
              <th>{{ t("记录数") }}</th>
              <th>{{ t("忙碌时间") }}</th>
              <th>{{ t("观测窗口") }}</th>
              <th>{{ t("利用率") }}</th>
              <th>{{ t("排队 / 拥塞") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="domain in fabricDomainUtilization" :key="domain.domain_id">
              <td>
                <strong>{{ domain.domain_id || availabilityLabel("missing") }}</strong>
                <small v-if="domain.topology_domain_ref?.json_pointer">
                  {{ domain.topology_domain_ref.json_pointer }}
                </small>
              </td>
              <td>{{ metricCountValue(domain.record_count) }}</td>
              <td>{{ metricTimeValue(domain.busy_time_ps) }}</td>
              <td>{{ metricTimeValue(domain.observation_window_ps) }}</td>
              <td>{{ metricRatioValue(domain.utilization_ratio) }}</td>
              <td>
                queue
                {{
                  typeof domain.queue_delay_us === "number"
                    ? `${formatNumber(domain.queue_delay_us)} µs`
                    : availabilityLabel("missing")
                }}<small
                  >congestion
                  {{
                    typeof domain.congestion_delay_us === "number"
                      ? `${formatNumber(domain.congestion_delay_us)} µs`
                      : availabilityLabel("missing")
                  }}</small
                >
              </td>
            </tr>
            <tr v-if="!fabricDomainUtilization.length">
              <td colspan="6">{{ t("Fabric 已有汇总证据，但没有按域拆分记录。") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="resourceConvergence" class="metric-footnote">
        <strong>{{ t("资源收敛") }}</strong>
        {{ resourceConvergence.summary || availabilityLabel("missing") }} · {{ t("缺失设备任务") }}
        {{ metricCountValue(missingDeviceTaskCount) }}
      </p>
      <dl v-if="pdDisaggregation" class="metrics-pd-summary">
        <div>
          <dt>{{ t("handoff 证据") }}</dt>
          <dd>{{ pdDisaggregation.has_handoff_evidence ? t("已报告") : t("未关联") }}</dd>
        </div>
        <div>
          <dt>{{ t("主导请求") }}</dt>
          <dd>{{ pdDisaggregation.dominant_handoff_request_id || t("未关联") }}</dd>
        </div>
        <div>
          <dt>{{ t("handoff / disaggregation group") }}</dt>
          <dd>
            {{ pdDisaggregation.dominant_handoff_id || t("未关联") }} /
            {{ pdDisaggregation.dominant_source_placement_group_id || t("未关联") }} →
            {{ pdDisaggregation.dominant_destination_placement_group_id || t("未关联") }}
          </dd>
        </div>
        <div>
          <dt>{{ t("handoff 等待") }}</dt>
          <dd>
            {{
              isLosslessInteger(pdDisaggregation.decode_wait_for_handoff_ps)
                ? formatPicoseconds(pdDisaggregation.decode_wait_for_handoff_ps)
                : availabilityLabel("missing")
            }}
          </dd>
        </div>
      </dl>
    </section>

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
