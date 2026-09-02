<script setup lang="ts">
import { ArrowRight, Braces, ChevronDown, FileJson, Play, Workflow } from "@lucide/vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { computed } from "vue";
import { formatNumber, formatPercent } from "../lib/format";
import { rawArtifactUrl } from "../features/inspect-artifact";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, dashboardView, setView } = useDashboard();
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
const primarySubsystemName = computed(() => {
  const subsystem = state.bundle.run?.bottleneck_report?.primary_subsystem;
  const labels: Record<string, string> = {
    S0: "输入与负载（S0）",
    S1: "调度与运行时（S1）",
    S2: "执行计划（S2）",
    S3: "内存与 KV（S3）",
    S4: "设备计算（S4）",
    S5: "集合通信（S5）",
    S6: "网络与通信（S6）",
  };
  return labels[subsystem || ""] ? t(labels[subsystem || ""]) : subsystem || t("未报告");
});
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

    <section class="overview-hero" data-help-anchor="overview-status">
      <div class="hero-copy">
        <p class="section-kicker">{{ t("结果摘要") }}</p>
        <div class="hero-status">
          <h2>
            {{
              dashboardView.overview.status.value === "partial" ? t("运行已完成，证据范围受限") : t("运行结果已就绪")
            }}
          </h2>
          <StatusPill :value="dashboardView.overview.status.value || 'unknown'" />
        </div>
        <p>
          {{
            dashboardView.overview.status.value === "partial"
              ? t("实验已经完成，可以查看趋势和关键指标；由于证据范围有限，不要把它当作真实硬件结论。")
              : t("实验已经完成，可以从关键数字开始查看结果。")
          }}
        </p>
        <div class="hero-actions" data-help-anchor="overview-actions">
          <button class="button button--primary" @click="setView('execution')">
            {{ t("查看执行过程") }}<Workflow :size="16" />
          </button>
          <button class="button button--secondary" @click="setView('metrics')">
            {{ t("查看性能指标") }}<ArrowRight :size="16" />
          </button>
        </div>
        <details v-if="dashboardView.overview.claimSummary.value" class="hero-technical-summary">
          <summary>{{ t("查看专业证据范围说明") }}<ChevronDown :size="14" /></summary>
          <p>{{ dashboardView.overview.claimSummary.value }}</p>
        </details>
      </div>
      <div class="hero-measure">
        <span>{{ t("本次模拟总时长") }}</span>
        <strong>{{ formatNumber(dashboardView.overview.endToEndLatencyUs.value) }}</strong>
        <small>{{ t("微秒 · 从开始到结束") }}</small>
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
      <StatCard
        :label="t('调度事件')"
        :value="formatNumber(dashboardView.overview.runtimeEventCount.value, 0)"
        :hint="t('记录调度、批处理和请求推进')"
      />
      <StatCard
        :label="t('网络通信记录')"
        :value="formatNumber(dashboardView.overview.fabricRecordCount.value, 0)"
        :hint="t('记录网络传输与等待')"
      />
      <StatCard
        :label="t('验证完整度')"
        :value="formatPercent(dashboardView.overview.validationCompleteness.value)"
        :hint="t('不是准确率或真实保证')"
      />
    </section>

    <section class="overview-primary-action" data-help-anchor="overview-finding">
      <article v-if="state.bundle.run?.bottleneck_report" class="panel finding-panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">{{ t("本次重点") }}</p>
            <h2>{{ t("当前优先检查：{area}", { area: primarySubsystemName }) }}</h2>
          </div>
        </header>
        <p>{{ t("后端报告把这个环节标记为当前主要瓶颈。先查看归因证据，再决定是否调整实验配置。") }}</p>
        <button class="button button--secondary button--wide" @click="setView('attribution')">
          {{ t("查看归因证据") }}<ArrowRight :size="16" />
        </button>
        <details class="finding-raw-disclosure">
          <summary>{{ t("查看后端原始说明") }}<ChevronDown :size="15" /></summary>
          <strong>{{ state.bundle.run.bottleneck_report.title }}</strong>
          <p>{{ state.bundle.run.bottleneck_report.detail }}</p>
        </details>
      </article>
      <article v-else class="panel next-action-panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">{{ t("下一步") }}</p>
            <h2>{{ t("继续实验") }}</h2>
          </div>
        </header>
        <p>{{ t("调整实验配置，生成一份独立结果，再与当前实验进行比较。") }}</p>
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
  </div>
</template>
