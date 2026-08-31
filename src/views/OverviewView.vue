<script setup lang="ts">
import {
  ArrowRight,
  Braces,
  ChevronDown,
  Clock3,
  FileJson,
  Gauge,
  Network,
  Play,
  ShieldCheck,
  Workflow,
} from "@lucide/vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { computed } from "vue";
import { formatNumber, formatPercent } from "../lib/format";
import { rawArtifactUrl } from "../features/inspect-artifact";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, dashboardView, evidence, setView, filteredRuns, openRun } = useDashboard();
const { t } = useI18n();
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

function tailAttributionLabel() {
  const metric = dashboardView.value.overview.hasTailAttribution;
  if (metric.availability !== "available") return t("不适用");
  return metric.value ? t("已生成") : t("未生成");
}
</script>

<template>
  <div class="view-stack">
    <section v-if="state.isDemo" class="demo-notice">
      <div>
        <Braces :size="18" /><span
          ><strong>{{ t("正在浏览内置示例") }}</strong
          >{{ t("这些数字用于说明界面结构，不是一次新的本地运行。") }}</span
        >
      </div>
      <button class="text-button" @click="setView('history')">{{ t("打开已有运行") }}<ArrowRight :size="15" /></button>
    </section>

    <section class="overview-hero">
      <div class="hero-copy">
        <p class="section-kicker">RUN SUMMARY</p>
        <div class="hero-status">
          <h2>
            {{
              dashboardView.overview.status.value === "partial" ? t("运行已完成，证据范围受限") : t("运行结果已就绪")
            }}
          </h2>
          <StatusPill :value="dashboardView.overview.status.value || 'unknown'" />
        </div>
        <p>
          {{ dashboardView.overview.claimSummary.value || t("打开验证报告以确认本次运行可支持的结论。") }}
        </p>
        <div class="hero-actions">
          <button class="button button--primary" @click="setView('execution')">
            {{ t("查看分层结果") }}<Workflow :size="16" />
          </button>
          <button class="button button--secondary" @click="setView('metrics')">
            {{ t("查看性能指标") }}<ArrowRight :size="16" />
          </button>
        </div>
      </div>
      <div class="hero-measure">
        <span>{{ t("端到端模拟窗口") }}</span>
        <strong>{{ formatNumber(dashboardView.overview.endToEndLatencyUs.value) }}</strong>
        <small>{{
          t("微秒 · {path} execution", { path: dashboardView.overview.executionPath.value || "hosted" })
        }}</small>
      </div>
    </section>

    <section class="stat-grid">
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
      <StatCard
        :label="t('运行时事件')"
        :value="formatNumber(dashboardView.overview.runtimeEventCount.value, 0)"
        hint="S1 runtime evidence"
      />
      <StatCard
        :label="t('Fabric 记录')"
        :value="formatNumber(dashboardView.overview.fabricRecordCount.value, 0)"
        hint="S6 realization records"
      />
      <StatCard
        :label="t('验证完整度')"
        :value="formatPercent(dashboardView.overview.validationCompleteness.value)"
        :hint="t('不是准确率或真实保证')"
      />
    </section>

    <section class="two-column-layout">
      <article class="panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">RUN FACTS</p>
            <h2>{{ t("本次运行") }}</h2>
          </div>
        </header>
        <dl class="fact-list">
          <div>
            <dt><Gauge :size="16" />{{ t("执行边界") }}</dt>
            <dd>{{ dashboardView.overview.rangeLabel.value || "—" }}</dd>
          </div>
          <div>
            <dt><Network :size="16" />{{ t("统一宿主") }}</dt>
            <dd>{{ dashboardView.overview.hostPath.value || "—" }}</dd>
          </div>
          <div>
            <dt><ShieldCheck :size="16" />{{ t("证据通道") }}</dt>
            <dd>{{ evidence.lane.replaceAll("_", " ") }}</dd>
          </div>
          <div>
            <dt><Clock3 :size="16" />{{ t("尾归因") }}</dt>
            <dd>{{ tailAttributionLabel() }}</dd>
          </div>
        </dl>
      </article>

      <article v-if="state.bundle.run?.bottleneck_report" class="panel finding-panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">PRIMARY FINDING · {{ state.bundle.run.bottleneck_report.primary_subsystem }}</p>
            <h2>{{ state.bundle.run.bottleneck_report.title }}</h2>
          </div>
        </header>
        <p>{{ state.bundle.run.bottleneck_report.detail }}</p>
        <button class="button button--secondary button--wide" @click="setView('attribution')">
          {{ t("查看归因证据") }}<ArrowRight :size="16" />
        </button>
      </article>
      <article v-else class="panel next-action-panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">NEXT ACTION</p>
            <h2>{{ t("继续实验") }}</h2>
          </div>
        </header>
        <p>{{ t("调整调度、batch、KV 或 Fabric 参数，生成一份独立的可对比运行。") }}</p>
        <button class="button button--primary button--wide" @click="setView('experiment')">
          <Play :size="16" />{{ t("配置新实验") }}
        </button>
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

    <article v-if="state.bridge.connected && filteredRuns.length" class="panel compact-recent">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">RECENT RUNS</p>
          <h2>{{ t("最近实验") }}</h2>
        </div>
        <button class="text-button" @click="setView('history')">{{ t("查看全部") }}<ArrowRight :size="15" /></button>
      </header>
      <div class="recent-list">
        <button v-for="run in filteredRuns.slice(0, 3)" :key="run.run_id" @click="openRun(run.run_id)">
          <span
            ><strong>{{ run.run_name || t("未命名实验") }}</strong
            ><small>{{ run.input_mode || "legacy" }} · {{ run.run_id }}</small></span
          >
          <span class="recent-metric">{{ formatNumber(run.digest?.end_to_end_latency_us) }} µs</span
          ><ArrowRight :size="16" />
        </button>
      </div>
    </article>
  </div>
</template>
