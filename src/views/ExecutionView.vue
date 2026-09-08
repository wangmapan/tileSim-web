<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  Braces,
  ChevronDown,
  Download,
  GitBranch,
  Layers3,
  ShieldCheck,
  Target,
  TimerReset,
} from "@lucide/vue";
import { computed, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import JsonArtifactPanel from "../components/JsonArtifactPanel.vue";
import StatusPill from "../components/StatusPill.vue";
import {
  attributionSource,
  buildExecutionResult,
  executionLayerHeadline,
  executionLayerName,
  executionMetricLabel,
  executionStageSource,
  ExecutionVisualizationPanel,
  LayerRecordTable,
  validationCheckSource,
} from "../features/execution-inspector";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import type { ExecutionStage } from "../contracts/report-model";
import { isLosslessInteger, losslessIntegerToBigInt } from "../contracts/lossless-json";
import type { LayerId } from "../features/execution-inspector";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { useEvidenceSelectionStore } from "../stores/evidence-selection";

type ExecutionResult = ReturnType<typeof buildExecutionResult>;
type ExecutionLayer = ExecutionResult["layers"][number];

const { state, notify } = useDashboard();
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const selectedEvidenceRequestId = computed(() => evidenceSelection.requestForRun(state.runId));
const selectedId = ref<LayerId>("S1");
const exportingReport = ref(false);
const result = computed(() => buildExecutionResult(state.bundle, state.inputs));
const layerById = computed(() => new Map(result.value.layers.map((layer) => [layer.id, layer])));
const selected = computed(() => layerById.value.get(selectedId.value) || result.value.layers[0]);
const hasResult = computed(() => Boolean(state.bundle.run || state.bundle.metrics || state.bundle.validation));

const evidenceLabels: Record<string, string> = {
  reported: "有报告记录",
  declaration_only: "仅解析声明",
  expected_absence: "预期缺省",
  not_covered: "未覆盖",
  missing: "没有明细",
};

function displayHeadline(layer: ExecutionLayer | undefined) {
  if (!layer?.headline) return "—";
  return typeof layer.headline.value === "number"
    ? formatNumber(layer.headline.value, 0)
    : String(layer.headline.value);
}

function friendlyHeadline(layer: ExecutionLayer | undefined) {
  return executionLayerHeadline(layer, displayHeadline(layer));
}

function durationUs(stage: ExecutionStage | undefined) {
  if (!stage || !isLosslessInteger(stage.start_time_ps) || !isLosslessInteger(stage.end_time_ps)) return "—";
  const delta = losslessIntegerToBigInt(stage.end_time_ps) - losslessIntegerToBigInt(stage.start_time_ps);
  if (delta < 0n) return "—";
  const hundredths = delta / 10_000n;
  const whole = hundredths / 100n;
  const fraction = String(hundredths % 100n).padStart(2, "0");
  return `${formatNumber(String(whole))}.${fraction}`;
}

function displayValue(value: unknown, unit = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (unit === "%ratio") return formatPercent(value, 1);
  if (unit === "bytes" && typeof value === "number") return `${formatNumber(value / 1_048_576)} MiB`;
  if (typeof value === "number") return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function checkLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    pass: "通过",
    passed: "通过",
    warn: "提醒",
    warning: "提醒",
    fail: "失败",
  };
  return t((status && labels[status]) || status || "未知");
}

async function exportStructuredReport() {
  if (exportingReport.value) return;
  exportingReport.value = true;
  try {
    const { downloadStructuredPerformanceReport } = await import("../features/structured-report");
    const filename = await downloadStructuredPerformanceReport({
      bundle: state.bundle,
      inputs: state.inputs,
      runId: state.runId,
      runName: state.runName,
      artifactManifest: state.artifactManifest,
      selectedRequestId: selectedEvidenceRequestId.value,
    });
    notify(t("已导出 {filename}", { filename }), "positive");
  } catch (error) {
    notify(
      t("导出结构化报告失败：{message}", { message: error instanceof Error ? error.message : String(error) }),
      "danger",
    );
  } finally {
    exportingReport.value = false;
  }
}
</script>

<template>
  <EmptyState
    v-if="!hasResult"
    title="还没有执行过程可看"
    description="请先打开一次已完成的实验，或运行一个新实验。"
    action-label="新建实验"
    action-to="/experiment"
  />
  <div v-else class="view-stack execution-view">
    <section class="panel execution-map-panel">
      <header class="panel-header panel-header--row">
        <div>
          <h2>{{ t("请求执行路线") }}</h2>
        </div>
        <div class="execution-map-actions">
          <div class="panel-count">
            <GitBranch :size="16" />{{ state.bundle.run?.summary?.range_label || t("边界未知") }}
          </div>
          <button class="button button--secondary" :disabled="exportingReport" @click="exportStructuredReport">
            <Download :size="16" />{{ exportingReport ? t("生成中…") : t("导出完整技术报告") }}
          </button>
        </div>
      </header>

      <div class="execution-flow" :aria-label="t('TileSim 分层执行链路')" data-help-anchor="execution-flow">
        <button
          v-for="id in ['S0', 'S1', 'S2']"
          :key="id"
          class="flow-node"
          :class="{ active: selectedId === id, muted: layerById.get(id)?.evidenceState === 'expected_absence' }"
          :aria-pressed="selectedId === id"
          aria-controls="execution-layer-detail"
          @click="selectedId = id"
        >
          <span>{{ id }}</span>
          <strong>{{ executionLayerName(id) }}</strong>
          <small>{{ friendlyHeadline(layerById.get(id)) }}</small>
        </button>
        <ArrowRight class="flow-arrow flow-arrow--one" :size="18" />
        <ArrowRight class="flow-arrow flow-arrow--two" :size="18" />
        <ArrowRight class="flow-arrow flow-arrow--three" :size="18" />

        <div class="resource-peer-group">
          <small>{{ t("三个并列资源环节") }}</small>
          <button
            v-for="id in ['S3', 'S4', 'S5']"
            :key="id"
            class="flow-node flow-node--peer"
            :class="{ active: selectedId === id }"
            :aria-pressed="selectedId === id"
            aria-controls="execution-layer-detail"
            @click="selectedId = id"
          >
            <span>{{ id }}</span>
            <strong>{{ executionLayerName(id) }}</strong>
            <small>{{ friendlyHeadline(layerById.get(id)) }}</small>
          </button>
        </div>

        <button
          class="flow-node flow-node--fabric"
          :class="{ active: selectedId === 'S6' }"
          :aria-pressed="selectedId === 'S6'"
          aria-controls="execution-layer-detail"
          @click="selectedId = 'S6'"
        >
          <span>S6</span>
          <strong>{{ executionLayerName("S6") }}</strong>
          <small>{{ friendlyHeadline(layerById.get("S6")) }}</small>
        </button>
      </div>
    </section>

    <section class="execution-detail-layout">
      <article id="execution-layer-detail" class="panel layer-detail-panel" data-help-anchor="execution-detail">
        <header class="layer-detail-header">
          <div>
            <h2>{{ executionLayerName(selected.id) }}</h2>
            <p>{{ selected.role }}</p>
          </div>
          <div class="layer-detail-status">
            <StatusPill :value="selected.resolution?.actual_fidelity || 'unknown'" />
            <StatusPill :value="selected.evidenceState" />
          </div>
        </header>

        <div class="layer-metric-grid" :aria-label="t('本层关键指标')">
          <div v-for="metric in selected.stats" :key="metric.label" class="layer-metric">
            <small>{{ executionMetricLabel(metric.label) }}</small>
            <strong :title="String(metric.value ?? '')">{{ displayValue(metric.value, metric.unit) }}</strong>
            <span v-if="metric.hint">{{ metric.hint }}</span>
            <ArtifactEvidenceLink v-if="metric.sourcePath" :source-path="metric.sourcePath" />
          </div>
        </div>

        <div class="layer-visualizations" :aria-label="t('本层数据可视化')">
          <ExecutionVisualizationPanel
            v-for="visualization in selected.visualizations"
            :key="visualization.id"
            :visualization="visualization"
          />
        </div>

        <details class="layer-evidence-disclosure layer-context-disclosure">
          <summary>
            <span><ShieldCheck :size="16" />{{ t("实现证据与字段边界") }}</span>
            <small>{{ t(evidenceLabels[selected.evidenceState] || selected.evidenceState) }}</small>
            <ChevronDown :size="17" />
          </summary>
          <div class="layer-insight-grid">
            <article>
              <header>
                <Braces :size="17" /><strong>{{ t("后端原始说明") }}</strong>
              </header>
              <p>{{ selected.detail }}</p>
            </article>
            <article>
              <header>
                <ShieldCheck :size="17" /><strong>{{ t("当前实现证据") }}</strong>
              </header>
              <p>{{ selected.implementation?.evidence || t("本次报告没有提供该层的实现说明。") }}</p>
            </article>
            <article class="layer-insight--gap">
              <header>
                <AlertTriangle :size="17" /><strong>{{ t("仍有限制") }}</strong>
              </header>
              <p>{{ selected.implementation?.gap || t("本次报告没有单独声明该层的实现限制。") }}</p>
            </article>
          </div>

          <dl class="layer-source-list">
            <div>
              <dt>{{ t("证据状态") }}</dt>
              <dd>{{ t(evidenceLabels[selected.evidenceState] || selected.evidenceState) }}</dd>
            </div>
            <div>
              <dt>{{ t("报告字段") }}</dt>
              <dd>
                <code>{{ selected.source }}</code>
                <ArtifactEvidenceLink :source-path="selected.source" />
              </dd>
            </div>
            <div>
              <dt>{{ t("独立 canonical trace") }}</dt>
              <dd>{{ t("当前网页报告包未提供") }}</dd>
            </div>
          </dl>
        </details>

        <details v-if="selected.checks.length" class="layer-evidence-disclosure">
          <summary>
            <span><ShieldCheck :size="16" />{{ t("本层验证检查") }}</span>
            <small>{{ t("{count} 项", { count: selected.checks.length }) }}</small>
            <ChevronDown :size="17" />
          </summary>
          <ul class="layer-check-list">
            <li v-for="check in selected.checks" :key="check.check_id">
              <StatusPill :value="check.status" />
              <div>
                <strong>{{ check.check_id }}</strong>
                <p>{{ check.detail }}</p>
                <ArtifactEvidenceLink
                  :source-path="validationCheckSource(state.bundle.validation?.checks || [], check.check_id)"
                />
              </div>
              <small>{{ checkLabel(check.status) }}</small>
            </li>
          </ul>
        </details>

        <details v-if="selected.attribution.length" class="layer-evidence-disclosure">
          <summary>
            <span><Target :size="16" />{{ t("本层尾延迟归因") }}</span>
            <small>{{ t("{count} 项", { count: selected.attribution.length }) }}</small>
            <ChevronDown :size="17" />
          </summary>
          <ol class="layer-attribution-list">
            <li v-for="item in selected.attribution" :key="`${item.rank}-${item.component_code}`">
              <span>{{ item.rank }}</span>
              <div>
                <strong>{{ item.component_code }}</strong>
                <p>{{ item.detail }}</p>
                <small>{{ item.evidence_link }}</small>
                <ArtifactEvidenceLink
                  :source-path="attributionSource(state.bundle.tail?.attribution_ranking || [], item.attribution_id)"
                />
              </div>
              <b>{{ displayValue(item.share, "%ratio") }}</b>
            </li>
          </ol>
        </details>

        <details class="record-disclosure" :disabled="!selected.records.length">
          <summary>
            <span><Braces :size="16" />{{ t("查看结构化记录") }}</span>
            <small>{{
              selected.records.length
                ? t("{count} 条 · 全部字段分批显示", { count: selected.records.length })
                : t("本层没有可展开记录")
            }}</small>
            <ChevronDown :size="17" />
          </summary>
          <LayerRecordTable v-if="selected.records.length" :records="selected.records" />
        </details>
      </article>

      <details class="panel stage-panel execution-secondary-disclosure" data-help-anchor="execution-host">
        <summary class="panel-header">
          <div>
            <p class="section-kicker">{{ t("仿真执行与控制平面") }}</p>
            <h2>{{ t("统一时间轴记录") }}</h2>
            <p>{{ t("这里记录各环节在同一模拟时间线上的开始和结束。") }}</p>
          </div>
          <span>{{ t("{count} 个阶段", { count: result.stages.length }) }}</span>
          <TimerReset :size="20" />
          <ChevronDown :size="17" />
        </summary>
        <div class="stage-panel-body">
          <ExecutionVisualizationPanel :visualization="result.timeline" compact />
          <ol v-if="result.stages.length" class="stage-list">
            <li v-for="stage in result.stages" :key="stage.stage_id">
              <span>{{ stage.subsystem }}</span>
              <div>
                <strong>{{ stage.stage_kind?.replaceAll("_", " ") }}</strong>
                <p>{{ stage.detail }}</p>
              </div>
              <small>{{ durationUs(stage) }} µs</small>
              <ArtifactEvidenceLink
                :source-path="executionStageSource(state.bundle.execution_envelope?.stages || [], stage.stage_id)"
              />
            </li>
          </ol>
          <p v-else class="panel-empty-copy">{{ t("当前报告包没有 execution envelope 阶段记录。") }}</p>
        </div>
      </details>
    </section>

    <section class="execution-support-grid">
      <details class="panel support-card execution-secondary-disclosure">
        <summary>
          <Layers3 :size="18" />
          <div>
            <small>RESOURCE CONVERGENCE</small><strong>{{ t("资源语义汇合") }}</strong>
          </div>
          <span>{{ result.resourceConvergence ? t("已报告") : t("未报告") }}</span>
          <ChevronDown :size="17" />
        </summary>
        <div class="support-card-body">
          <template v-if="result.resourceConvergence">
            <p>{{ result.resourceConvergence.summary || t("报告提供了资源汇合统计。") }}</p>
            <dl>
              <div>
                <dt>Collective phases</dt>
                <dd>{{ formatNumber(result.resourceConvergence.collective_phase_count, 0) }}</dd>
              </div>
              <div>
                <dt>{{ t("已汇合请求") }}</dt>
                <dd>{{ formatNumber(result.resourceConvergence.converged_request_count, 0) }}</dd>
              </div>
              <div>
                <dt>{{ t("缺失内存事件") }}</dt>
                <dd>{{ formatNumber(result.resourceConvergence.missing_memory_event_count, 0) }}</dd>
              </div>
              <div>
                <dt>{{ t("缺失设备任务") }}</dt>
                <dd>{{ formatNumber(result.resourceConvergence.missing_device_task_count, 0) }}</dd>
              </div>
            </dl>
          </template>
          <p v-else>{{ t("当前报告没有资源语义汇合摘要。") }}</p>
        </div>
      </details>
    </section>

    <section class="execution-boundary-note">
      <Braces :size="17" />
      <p>
        <strong>{{ t("字段边界") }}</strong
        >{{
          t(
            "本页只重组当前后端报告。计数去重仅用于避免同一 S3/S4/S5 证据随多个 Fabric phase 重复展示，不改变模拟结果，也不把关联证据升级为独立 trace。",
          )
        }}
      </p>
    </section>

    <JsonArtifactPanel />
  </div>
</template>
