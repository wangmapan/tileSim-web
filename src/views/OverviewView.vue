<script setup lang="ts">
import { ArrowRight, Braces, ChevronDown, FileJson, Play, Workflow } from "@lucide/vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import UtilizationMeasure from "../components/ui/UtilizationMeasure.vue";
import "../styles/workbench.css";
import { computed } from "vue";
import { formatNumber, formatPercent } from "../lib/format";
import { rawArtifactUrl } from "../features/inspect-artifact";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, dashboardView, setView } = useDashboard();
const { t } = useI18n();
const networkSummary = computed(() => state.bundle.metrics?.system_summary);
const previewDomains = computed(() => networkSummary.value?.fabric_domain_utilization?.slice(0, 6) || []);
const artifactCopy: Record<string, [string, string]> = {
  "input-runtime-trace": ["Runtime trace", "输入"],
  "input-topology": ["Fabric topology", "输入"],
  "input-design-space-candidates": ["Design-space candidates", "输入"],
  "run-result": ["Run result", "结果"],
  metrics: ["Metrics", "结果"],
  validation: ["Validation", "证据"],
  "tail-cause-chain": ["Tail cause chain", "证据"],
  "execution-envelope": ["Execution envelope", "事件"],
  "design-space": ["Design space", "结果"],
};
const artifacts = computed(() =>
  (state.artifactManifest?.artifacts || []).map((entry) => ({
    id: entry.artifact_id,
    label: artifactCopy[entry.artifact_id]?.[0] || entry.file_name,
    kind: artifactCopy[entry.artifact_id]?.[1] || "工件",
    bytes: entry.bytes,
  })),
);
const primarySubsystemName = computed(() => {
  const subsystem = state.bundle.run?.bottleneck_report?.primary_subsystem;
  const labels: Record<string, string> = {
    S0: "工作负载抽象与负载描述语言模块",
    S1: "推理引擎与服务运行时模块",
    S2: "执行语义建模模块",
    S3: "KV Cache 建模模块",
    S4: "设备性能建模模块",
    S5: "集合通信语义模块",
    S6: "网络与硬件资源模块",
  };
  return labels[subsystem || ""] ? t(labels[subsystem || ""]) : subsystem || t("未报告");
});
</script>

<template>
  <div class="view-stack overview-view">
    <section v-if="state.isDemo" class="demo-notice">
      <div>
        <Braces :size="18" /><span
          ><strong>{{ t("正在浏览内置示例") }}</strong
          >{{ t("内置数据，非本地运行") }}</span
        >
      </div>
      <button class="text-button" @click="setView('history')">{{ t("打开已有运行") }}<ArrowRight :size="15" /></button>
    </section>

    <section class="analysis-stage overview-stage" data-help-anchor="overview-status">
      <div class="analysis-stage__primary">
        <div class="analysis-stage__heading">
          <h2>{{ t("运行摘要") }}</h2>
          <StatusPill :value="dashboardView.overview.status.value || 'unknown'" />
        </div>
        <div class="hero-measure">
          <span>{{ t("本次模拟总时长") }}</span>
          <div>
            <strong>{{ formatNumber(dashboardView.overview.endToEndLatencyUs.value) }}</strong
            ><small>µs</small>
          </div>
          <span>{{ t("仿真时间，非程序运行耗时") }}</span>
        </div>
        <nav
          class="analysis-stage__actions overview-analysis-index"
          :aria-label="t('分析路径')"
          data-help-anchor="overview-actions"
        >
          <button class="button" @click="setView('execution')">{{ t("查看执行过程") }}<Workflow :size="16" /></button>
          <button class="button" @click="setView('metrics')">{{ t("查看性能指标") }}<ArrowRight :size="16" /></button>
          <button class="button" @click="setView('validation')">{{ t("结果可信度") }}</button>
        </nav>
      </div>
      <div class="analysis-stage__secondary overview-primary-action" data-help-anchor="overview-finding">
        <article v-if="state.bundle.run?.bottleneck_report" class="finding-panel">
          <p class="section-kicker">{{ t("主要瓶颈 · 后端报告") }}</p>
          <h2>{{ primarySubsystemName }}</h2>
          <button class="button button--secondary" @click="setView('attribution')">
            {{ t("查看归因证据") }}<ArrowRight :size="16" />
          </button>
          <details class="finding-raw-disclosure">
            <summary>{{ t("查看后端原始说明") }}<ChevronDown :size="15" /></summary>
            <strong>{{ state.bundle.run.bottleneck_report.title }}</strong>
            <p>{{ state.bundle.run.bottleneck_report.detail }}</p>
          </details>
        </article>
        <article v-else>
          <p class="section-kicker">{{ t("瓶颈归因") }}</p>
          <h2>{{ t("未提供瓶颈报告") }}</h2>
          <button class="button button--primary" @click="setView('experiment')">
            <Play :size="16" />{{ t("配置新实验") }}
          </button>
        </article>
        <details v-if="dashboardView.overview.claimSummary.value" class="hero-technical-summary">
          <summary>{{ t("证据范围") }}<ChevronDown :size="14" /></summary>
          <p>{{ dashboardView.overview.claimSummary.value }}</p>
        </details>
      </div>
    </section>

    <section class="stat-grid" data-help-anchor="overview-metrics">
      <StatCard
        :label="t('吞吐')"
        :value="`${formatNumber(dashboardView.overview.throughputRequestsPerSecond.value)} req/s`"
        :hint="
          t('{done}/{total} 请求完成', {
            done: dashboardView.overview.completedRequestCount.value ?? '—',
            total: dashboardView.overview.requestCount.value ?? '—',
          })
        "
        accent
      />
      <StatCard :label="t('调度事件')" :value="formatNumber(dashboardView.overview.runtimeEventCount.value, 0)" />
      <StatCard :label="t('网络通信记录')" :value="formatNumber(dashboardView.overview.fabricRecordCount.value, 0)" />
      <StatCard
        :label="t('验证完整度')"
        :value="formatPercent(dashboardView.overview.validationCompleteness.value)"
        :hint="t('字段覆盖，非准确率')"
      />
    </section>

    <section class="overview-observation-layout">
      <article class="overview-network-observation">
        <header class="workbench-section-heading">
          <div>
            <h2>{{ t("通信域观测") }}</h2>
          </div>
          <button class="text-button" @click="setView('fabric')">
            {{ t("查看网络与通信") }}<ArrowRight :size="16" />
          </button>
        </header>
        <template v-if="previewDomains.length">
          <div class="table-wrap overview-network-scroll" role="region" :aria-label="t('通信域观测')" tabindex="0">
            <table class="overview-network-table">
              <thead>
                <tr>
                  <th scope="col">{{ t("域") }}</th>
                  <th scope="col">{{ t("利用率") }}<small>0–100%</small></th>
                  <th scope="col" class="numeric">{{ t("队列延迟") }}<small>µs</small></th>
                  <th scope="col" class="numeric">{{ t("拥塞延迟") }}<small>µs</small></th>
                </tr>
              </thead>
              <tbody class="overview-domain-list">
                <tr v-for="(domain, index) in previewDomains" :key="`${domain.domain_id}-${index}`">
                  <th scope="row">{{ domain.domain_id }}</th>
                  <td>
                    <UtilizationMeasure
                      :value="domain.utilization_ratio"
                      :text="formatPercent(domain.utilization_ratio)"
                    />
                  </td>
                  <td class="numeric">{{ formatNumber(domain.queue_delay_us) }}</td>
                  <td class="numeric">{{ formatNumber(domain.congestion_delay_us) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="workbench-note">
            {{ t("按报告顺序显示前 {count} 个域；占用不等于拥塞或瓶颈排名。", { count: previewDomains.length }) }}
            {{ t("延迟沿用报告字段，不相加解释为请求耗时。") }}
          </p>
        </template>
        <div v-else class="overview-network-empty">
          <p>{{ t("尚无通信域占用记录") }}</p>
          <span>{{ t("当前报告未提供逐域占用，不以请求数或总时长推算。") }}</span>
        </div>
      </article>
    </section>

    <details v-if="state.runId" class="panel artifact-disclosure">
      <summary>
        <span
          ><FileJson :size="18" /><span
            ><strong>{{ t("原始工件") }}</strong
            ><small>{{ t("按需打开本次运行的 JSON 证据") }}</small></span
          ></span
        >
        <span>{{ artifacts.length }} {{ t("个文件") }} <ChevronDown :size="16" /></span>
      </summary>
      <div class="artifact-grid artifact-grid--disclosed">
        <a
          v-for="artifact in artifacts"
          :key="artifact.id"
          :href="rawArtifactUrl(state.runId, artifact.id)"
          target="_blank"
          rel="noopener"
          class="artifact-link"
        >
          <FileJson :size="18" /><span
            ><strong>{{ artifact.label }}</strong
            ><small>{{ t(artifact.kind) }} · {{ formatNumber(artifact.bytes, 0) }} bytes</small></span
          ><ArrowRight :size="15" />
        </a>
      </div>
    </details>
  </div>
</template>
