<script setup lang="ts">
import { Activity, ChevronDown, Network, ShieldCheck, Target, Waves } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import EmptyState from "../components/EmptyState.vue";
import UtilizationMeasure from "../components/ui/UtilizationMeasure.vue";
import "../styles/workbench.css";
import RecordPager from "../components/ui/RecordPager.vue";
import { useRecordPage } from "../components/ui/useRecordPage";
import { buildFabricAnalysis } from "../features/f7-analysis";
import {
  buildFabricCompositionVisualizations,
  executionLayerName,
  ExecutionVisualizationPanel,
  semanticFieldPresentation,
} from "../features/execution-inspector";
import { formatNumber, formatPercent, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state } = useDashboard();
const { t } = useI18n();
const analysis = computed(() =>
  buildFabricAnalysis(state.bundle.metrics, state.artifactManifest, state.inputs.topology),
);
const systemSummary = computed(() => analysis.value.summary);
const domains = computed(() => analysis.value.domains);
const requests = computed(() => analysis.value.requests);
const { page: requestPage, pages: requestPages, visibleRecords: visibleRequests } = useRecordPage(requests);
const { page: domainPage, pages: domainPages, visibleRecords: visibleDomains } = useRecordPage(domains);
const domainsOpen = ref(false);
const hasReportedHotspot = computed(() =>
  Boolean(
    systemSummary.value?.dominant_fabric_backpressure_domain_id?.trim() &&
    systemSummary.value?.dominant_fabric_backpressure_kind?.trim(),
  ),
);
watch(
  () => state.bundle.metrics,
  () => {
    domainsOpen.value = false;
  },
);
const compositionVisualizations = computed(() => buildFabricCompositionVisualizations(state.bundle.metrics));

function utilizationWidth(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.max(0, Math.min(value * 100, 100))}%` : null;
}

function semanticField(field: string, value: unknown) {
  return semanticFieldPresentation(field, value);
}

function moduleBinding(value: string | undefined) {
  return value && /^S[0-6]$/.test(value) ? executionLayerName(value) : value || t("不适用");
}
</script>

<template>
  <EmptyState
    v-if="!systemSummary"
    title="还没有网络与通信数据"
    description="请先打开一次包含网络指标的实验，或运行一个新实验。"
    action-label="新建实验"
    action-to="/experiment"
  />
  <div v-else class="view-stack fabric-view">
    <section class="analysis-stage fabric-stage">
      <div class="analysis-stage__primary fabric-summary" data-help-anchor="fabric-summary">
        <p class="section-kicker">{{ t("网络观测") }}</p>
        <h2>{{ t("最长通信等待") }}</h2>
        <div class="hero-measure">
          <div>
            <strong>{{ formatNumber(systemSummary.max_fabric_backpressure_delay_us) }}</strong
            ><small>µs</small>
          </div>
          <span>{{ t("当前观测窗口") }}</span>
        </div>
        <dl class="fabric-stage__support">
          <div>
            <dt>{{ t("通信资源占用") }}</dt>
            <dd>
              <UtilizationMeasure
                :value="systemSummary.fabric_utilization_ratio"
                :text="formatPercent(systemSummary.fabric_utilization_ratio)"
              />
              <small>{{ t("所有活跃通信范围的总体占用") }}</small>
            </dd>
          </div>
          <div>
            <dt>{{ t("通信范围数量") }}</dt>
            <dd>
              {{ formatNumber(domains.length, 0) }}
              <small>{{ t("本次实验涉及的通信范围") }}</small>
            </dd>
          </div>
        </dl>
      </div>
      <article class="analysis-stage__secondary fabric-hotspot-panel" data-help-anchor="fabric-hotspot">
        <header class="panel-header panel-header--row">
          <div>
            <h2>{{ t(hasReportedHotspot ? "当前主要通信瓶颈" : "主要通信瓶颈信息不完整") }}</h2>
            <p v-if="!hasReportedHotspot">{{ t("主导域或延迟类型未报告；请查看逐域指标，不按利用率猜测瓶颈。") }}</p>
          </div>
          <ArtifactEvidenceLink source-path="metrics:/system_summary" />
        </header>
        <dl class="fabric-hotspot-grid">
          <div>
            <dt><Target :size="14" />{{ t("主导域") }}</dt>
            <dd>{{ systemSummary?.dominant_fabric_backpressure_domain_id || t("缺失") }}</dd>
          </div>
          <div>
            <dt>{{ t("主导延迟") }}</dt>
            <dd>{{ statusLabel(systemSummary?.dominant_fabric_backpressure_kind) }}</dd>
          </div>
          <div>
            <dt>{{ t("背压事件") }}</dt>
            <dd>{{ formatNumber(systemSummary?.fabric_backpressure_event_count, 0) }}</dd>
          </div>
          <div>
            <dt>{{ t("观测窗口") }}</dt>
            <dd>{{ formatNumber(systemSummary?.fabric_observation_window_ps) }} ps</dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="analysis-visualization-stack" :aria-label="t('通信时间构成图')">
      <ExecutionVisualizationPanel
        v-for="visualization in compositionVisualizations"
        :key="visualization.id"
        :visualization="visualization"
        show-boundary
      />
    </section>

    <details class="panel fabric-contract-strip">
      <summary>
        <ShieldCheck :size="18" />
        <div>
          <strong>{{ t("专业证据与契约信息") }}</strong>
          <p>{{ t("需要审计或排查问题时，再查看 Schema、SHA-256 和精确证据链接。") }}</p>
        </div>
        <span>{{ t("按需查看") }}</span>
        <ChevronDown :size="17" />
      </summary>
      <dl>
        <div>
          <dt>contract</dt>
          <dd>
            <strong>{{ semanticField("availability", analysis.artifactAvailability).valueLabel }}</strong>
            <small v-if="semanticField('availability', analysis.artifactAvailability).valueDescription">
              {{ semanticField("availability", analysis.artifactAvailability).valueDescription }}
            </small>
            <code>availability = {{ analysis.artifactAvailability }}</code>
          </dd>
        </div>
        <div>
          <dt>schema</dt>
          <dd>{{ analysis.artifactEvidence.schemaIdentity || t("缺失") }}</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>{{ analysis.artifactEvidence.sha256 || t("缺失") }}</dd>
        </div>
      </dl>
    </details>

    <details
      v-if="domains.length"
      class="panel fabric-domain-disclosure"
      data-help-anchor="fabric-domains"
      :open="domainsOpen"
      @toggle="domainsOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary>
        <div>
          <small>{{ t("专业详情") }}</small>
          <strong>{{ t("通信范围与证据详情") }}</strong>
        </div>
        <span>{{ t("{count} 个范围", { count: domains.length }) }}</span>
        <ChevronDown :size="17" />
      </summary>
      <section v-if="domainsOpen" class="domain-grid">
        <article
          v-for="(domain, domainIndex) in visibleDomains"
          :key="`${domain.domain_id}-${domainIndex}`"
          class="domain-card"
        >
          <header>
            <div class="domain-icon"><Network :size="19" /></div>
            <div>
              <small>FABRIC DOMAIN</small>
              <h2>{{ domain.domain_id }}</h2>
            </div>
            <strong>{{ formatPercent(domain.utilization_ratio) }}</strong>
          </header>
          <div class="utilization-track">
            <span
              v-if="utilizationWidth(domain.utilization_ratio)"
              :style="{ width: utilizationWidth(domain.utilization_ratio)! }"
            ></span>
          </div>
          <dl>
            <div>
              <dt><Activity :size="14" />{{ t("执行记录") }}</dt>
              <dd>{{ formatNumber(domain.record_count, 0) }}</dd>
            </div>
            <div>
              <dt><Waves :size="14" />{{ t("队列延迟") }}</dt>
              <dd>{{ formatNumber(domain.queue_delay_us) }} µs</dd>
            </div>
            <div>
              <dt>{{ t("拥塞延迟") }}</dt>
              <dd>{{ formatNumber(domain.congestion_delay_us) }} µs</dd>
            </div>
            <div>
              <dt>{{ t("运行时间") }}</dt>
              <dd>{{ formatNumber(domain.runtime_us) }} µs</dd>
            </div>
          </dl>
          <div class="domain-evidence-row">
            <ArtifactEvidenceLink v-if="domain.evidence.sourcePath" :source-path="domain.evidence.sourcePath" />
            <small v-else>
              {{ semanticField("availability", domain.availability).valueLabel }}
              <code>availability = {{ domain.availability }}</code>
            </small>
          </div>
          <section v-if="domain.topologyDomain" class="domain-topology-contract">
            <header>
              <strong>{{ t("Topology domain") }}</strong>
              <span>{{ domain.topologyDomain.domain_type }} / {{ domain.topologyDomain.domain_kind }}</span>
            </header>
            <dl>
              <div>
                <dt>{{ t("模块绑定") }}</dt>
                <dd>
                  {{ moduleBinding(domain.topologyDomain.module_binding) }}
                  <code v-if="domain.topologyDomain.module_binding">{{ domain.topologyDomain.module_binding }}</code>
                </dd>
              </div>
              <div>
                <dt>{{ t("成员设备") }}</dt>
                <dd>{{ domain.topologyDomain.member_devices?.join(", ") || t("未报告") }}</dd>
              </div>
            </dl>
            <ArtifactEvidenceLink
              v-if="domain.topologyEvidence.sourcePath"
              :source-path="domain.topologyEvidence.sourcePath"
              label="Topology 证据"
            />
          </section>
          <small v-else class="domain-topology-status">
            {{ semanticField("availability", domain.topologyAvailability).valueLabel }}
            <code>topology availability = {{ domain.topologyAvailability }}</code>
          </small>
        </article>
      </section>
      <RecordPager v-if="domainsOpen" v-model:page="domainPage" :pages="domainPages" :label="t('通信范围详情分页')" />
    </details>

    <article class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">{{ t("逐项比较") }}</p>
          <h2>{{ t("通信范围明细") }}</h2>
          <p>{{ t("利用率描述模拟 Fabric 的占用，不等同于真实集群链路计数器。") }}</p>
        </div>
      </header>
      <div class="table-wrap fabric-table-scroll" role="region" :aria-label="t('通信范围明细')" tabindex="0">
        <table class="fabric-domain-table">
          <thead>
            <tr>
              <th>{{ t("域") }}</th>
              <th class="numeric">{{ t("记录数") }}</th>
              <th class="numeric">{{ t("利用率") }}</th>
              <th class="numeric">{{ t("队列延迟") }}</th>
              <th class="numeric">{{ t("拥塞延迟") }}</th>
              <th class="numeric">{{ t("运行时间") }}</th>
              <th>{{ t("证据") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(domain, domainIndex) in visibleDomains" :key="`${domain.domain_id}-${domainIndex}`">
              <td>
                <strong>{{ domain.domain_id }}</strong>
              </td>
              <td class="numeric">{{ formatNumber(domain.record_count, 0) }}</td>
              <td class="numeric">{{ formatPercent(domain.utilization_ratio) }}</td>
              <td class="numeric">{{ formatNumber(domain.queue_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.congestion_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.runtime_us) }} µs</td>
              <td>
                <ArtifactEvidenceLink
                  v-if="domain.evidence.sourcePath"
                  :source-path="domain.evidence.sourcePath"
                /><small v-else>
                  {{ semanticField("availability", domain.availability).valueLabel }}
                  <code>availability = {{ domain.availability }}</code>
                </small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <RecordPager v-model:page="domainPage" :pages="domainPages" :label="t('通信范围明细分页')" />
    </article>

    <article class="panel" data-help-anchor="fabric-requests">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">{{ t("请求与主导阶段") }}</p>
          <h2>{{ t("请求级 Fabric contribution") }}</h2>
          <p>
            {{ t("按后端报告顺序展示 request；dominant phase 只通过 request_id 和 phase_id 的唯一稳定匹配连接。") }}
          </p>
        </div>
        <div class="panel-count">{{ requests.length }} requests</div>
      </header>
      <div
        v-if="requests.length"
        class="table-wrap fabric-table-scroll"
        role="region"
        :aria-label="t('请求级 Fabric contribution')"
        tabindex="0"
      >
        <table class="fabric-request-table">
          <thead>
            <tr>
              <th>request_id</th>
              <th class="numeric">{{ t("记录数") }}</th>
              <th class="numeric">{{ t("队列延迟") }}</th>
              <th class="numeric">{{ t("拥塞延迟") }}</th>
              <th class="numeric">{{ t("运行时间") }}</th>
              <th>{{ t("主导域 / 类型") }}</th>
              <th>{{ t("主导 phase / collective") }}</th>
              <th>{{ t("证据") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(request, requestIndex) in visibleRequests" :key="`${request.request_id}-${requestIndex}`">
              <td>
                <code>{{ request.request_id || t("缺失") }}</code>
              </td>
              <td class="numeric">{{ formatNumber(request.record_count, 0) }}</td>
              <td class="numeric">{{ formatNumber(request.queue_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(request.congestion_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(request.runtime_us) }} µs</td>
              <td>
                <strong>{{ request.dominant_domain_id || t("缺失") }}</strong>
                <small>{{ statusLabel(request.dominant_delay_kind) }}</small>
              </td>
              <td>
                <strong>{{ request.dominant_phase_id || t("缺失") }}</strong>
                <small>{{ request.dominant_collective_id || t("不适用") }}</small>
              </td>
              <td>
                <span class="fabric-evidence-actions">
                  <ArtifactEvidenceLink
                    v-if="request.evidence.sourcePath"
                    :source-path="request.evidence.sourcePath"
                    label="request 证据"
                  />
                  <ArtifactEvidenceLink
                    v-if="request.dominantPhaseEvidence.sourcePath"
                    :source-path="request.dominantPhaseEvidence.sourcePath"
                    label="phase 证据"
                  />
                  <small v-if="!request.evidence.sourcePath">
                    {{ semanticField("availability", request.availability).valueLabel }}
                    <code>availability = {{ request.availability }}</code>
                  </small>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="panel-empty-copy">{{ t("没有 request_fabric_contributions") }}</p>
      <RecordPager v-model:page="requestPage" :pages="requestPages" :label="t('请求通信贡献分页')" />
    </article>

    <section
      class="design-scope-banner fabric-topology-gap"
      :class="{ 'fabric-topology-gap--available': analysis.topologyJoinAvailability === 'available' }"
    >
      <Network :size="19" />
      <div>
        <strong v-if="analysis.topologyJoinAvailability === 'available'">
          {{ t("Topology → metrics domain：正式契约已验证") }}
        </strong>
        <strong v-else>{{ t("Topology → metrics domain：不可用") }}</strong>
        <p v-if="analysis.topologyJoinAvailability === 'available'">
          {{
            t(
              "metrics 的 topology_domain_ref 已按 run、schema、subject ID 与精确 JSON Pointer 连接到 topology artifact。",
            )
          }}
        </p>
        <p v-else>
          {{
            t("没有通过正式 topology EvidenceRef 校验；页面不会按同名 domain_id、数组位置或文本建立跨 artifact 导航。")
          }}
        </p>
      </div>
      <span>
        {{ semanticField("availability", analysis.topologyJoinAvailability).valueLabel }}
        <code>availability = {{ analysis.topologyJoinAvailability }}</code>
      </span>
    </section>
  </div>
</template>
