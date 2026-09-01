<script setup lang="ts">
import { Activity, ChevronDown, Network, ShieldCheck, Target, Waves } from "@lucide/vue";
import { computed } from "vue";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import { buildFabricAnalysis } from "../features/f7-analysis";
import { formatNumber, formatPercent } from "../lib/format";
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

function utilizationWidth(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.max(0, Math.min(value * 100, 100))}%` : null;
}
</script>

<template>
  <EmptyState v-if="!systemSummary" title="没有 Fabric 域数据" />
  <div v-else class="view-stack">
    <details class="panel fabric-contract-strip">
      <summary>
        <ShieldCheck :size="18" />
        <div>
          <strong>{{ t("Metrics-backed Fabric 证据") }}</strong>
          <p>{{ t("查看 Schema、SHA-256 与精确链接边界") }}</p>
        </div>
        <span>{{ analysis.artifactAvailability }}</span>
        <ChevronDown :size="17" />
      </summary>
      <dl>
        <div>
          <dt>contract</dt>
          <dd>{{ analysis.artifactAvailability }}</dd>
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

    <section class="stat-grid stat-grid--three">
      <StatCard
        :label="t('总体利用率')"
        :value="formatPercent(systemSummary?.fabric_utilization_ratio)"
        :hint="t('跨活跃 Fabric 域')"
        accent
      />
      <StatCard
        :label="t('最大背压')"
        :value="`${formatNumber(systemSummary?.max_fabric_backpressure_delay_us)} µs`"
        :hint="t('当前观测窗口')"
      />
      <StatCard :label="t('活跃域')" :value="formatNumber(domains.length, 0)" hint="Scale-up / Scale-out" />
    </section>

    <article class="panel fabric-hotspot-panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">BACKEND-REPORTED HOTSPOT</p>
          <h2>{{ t("后端报告的主导 Fabric 热点") }}</h2>
          <p>{{ t("这里不按延迟重排或推断原因，只展示 system_summary 的显式 dominant 字段。") }}</p>
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
          <dd>{{ systemSummary?.dominant_fabric_backpressure_kind || t("缺失") }}</dd>
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

    <details v-if="domains.length" class="panel fabric-domain-disclosure">
      <summary>
        <div>
          <small>DOMAIN EVIDENCE</small>
          <strong>{{ t("域 Topology 与证据详情") }}</strong>
        </div>
        <span>{{ domains.length }} domains</span>
        <ChevronDown :size="17" />
      </summary>
      <section class="domain-grid">
        <article
          v-for="(domain, domainIndex) in domains"
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
            <small v-else>{{ domain.availability }}</small>
          </div>
          <section v-if="domain.topologyDomain" class="domain-topology-contract">
            <header>
              <strong>{{ t("Topology domain") }}</strong>
              <span>{{ domain.topologyDomain.domain_type }} / {{ domain.topologyDomain.domain_kind }}</span>
            </header>
            <dl>
              <div>
                <dt>{{ t("模块绑定") }}</dt>
                <dd>{{ domain.topologyDomain.module_binding || t("不适用") }}</dd>
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
          <small v-else class="domain-topology-status">topology: {{ domain.topologyAvailability }}</small>
        </article>
      </section>
    </details>

    <article class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">DOMAIN COMPARISON</p>
          <h2>{{ t("域明细") }}</h2>
          <p>{{ t("利用率描述模拟 Fabric 的占用，不等同于真实集群链路计数器。") }}</p>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("域") }}</th>
              <th class="numeric">{{ t("记录数") }}</th>
              <th class="numeric">{{ t("利用率") }}</th>
              <th class="numeric">{{ t("队列延迟") }}</th>
              <th class="numeric">{{ t("拥塞延迟") }}</th>
              <th class="numeric">{{ t("运行时间") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(domain, domainIndex) in domains" :key="`${domain.domain_id}-${domainIndex}`">
              <td>
                <strong>{{ domain.domain_id }}</strong>
              </td>
              <td class="numeric">{{ formatNumber(domain.record_count, 0) }}</td>
              <td class="numeric">{{ formatPercent(domain.utilization_ratio) }}</td>
              <td class="numeric">{{ formatNumber(domain.queue_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.congestion_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.runtime_us) }} µs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <article class="panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">REQUEST / DOMINANT PHASE</p>
          <h2>{{ t("请求级 Fabric contribution") }}</h2>
          <p>
            {{ t("按后端报告顺序展示 request；dominant phase 只通过 request_id 和 phase_id 的唯一稳定匹配连接。") }}
          </p>
        </div>
        <div class="panel-count">{{ requests.length }} requests</div>
      </header>
      <div v-if="requests.length" class="table-wrap">
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
            <tr v-for="(request, requestIndex) in requests" :key="`${request.request_id}-${requestIndex}`">
              <td>
                <code>{{ request.request_id || t("缺失") }}</code>
              </td>
              <td class="numeric">{{ formatNumber(request.record_count, 0) }}</td>
              <td class="numeric">{{ formatNumber(request.queue_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(request.congestion_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(request.runtime_us) }} µs</td>
              <td>
                <strong>{{ request.dominant_domain_id || t("缺失") }}</strong>
                <small>{{ request.dominant_delay_kind || t("缺失") }}</small>
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
                  <small v-if="!request.evidence.sourcePath">{{ request.availability }}</small>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="panel-empty-copy">{{ t("没有 request_fabric_contributions") }}</p>
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
      <span>{{ analysis.topologyJoinAvailability }}</span>
    </section>
  </div>
</template>
