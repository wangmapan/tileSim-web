<script setup lang="ts">
import { AlertTriangle, BarChart3, Braces, Info, TableProperties } from "@lucide/vue";
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { formatNumber, formatPercent } from "../../../lib/format";
import type { LayerVisualization } from "../model/types";
import { useI18n } from "../../../i18n";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";

const ExecutionChart = defineAsyncComponent(() => import("../charts/ExecutionChart.vue"));

const props = defineProps<{ visualization: LayerVisualization; compact?: boolean; showBoundary?: boolean }>();
const { t } = useI18n();
const records = computed(() => props.visualization.rows);
const { page, pages, visibleRecords } = useRecordPage(records);
const dataOpen = ref(props.visualization.kind === "matrix");
const hasStatus = computed(() => records.value.some((row) => row.status));
const chartable = computed(() => ["bar", "stacked-bar", "scatter", "timeline"].includes(props.visualization.kind));
const selectedRowIndex = ref<number | null>(null);
const selectedRow = computed(() =>
  selectedRowIndex.value === null ? null : props.visualization.rows[selectedRowIndex.value] || null,
);
const selectedEvidencePaths = computed(() =>
  [selectedRow.value?.sourcePath, ...(selectedRow.value?.valueSourcePaths || [])].filter(
    (path, index, paths): path is string => Boolean(path) && paths.indexOf(path) === index,
  ),
);
const kindLabels: Record<string, string> = {
  none: "仅字段表",
  matrix: "状态矩阵",
  bar: "水平条形图",
  "stacked-bar": "堆叠水平条形图",
  scatter: "散点图",
  timeline: "区间时间轴",
};
const dataIssues = computed(() =>
  props.visualization.rows.flatMap((row) =>
    row.values.flatMap((value, index) => {
      const column = props.visualization.columns[index] || t("字段 {index}", { index: index + 1 });
      const source = row.sourcePath || "—";
      if (value === null) return [t("{label} · {column} 缺失（{source}）", { label: row.label, column, source })];
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      const isRatio = props.visualization.unit === "%" || column.toLowerCase().includes("occupancy");
      if (isRatio && (value < 0 || value > 1))
        return [t("{label} · {column}={value} 超出 [0, 1]（{source}）", { label: row.label, column, value, source })];
      if (!isRatio && value < 0)
        return [t("{label} · {column}={value} 为负值（{source}）", { label: row.label, column, value, source })];
      return [];
    }),
  ),
);

watch([() => props.visualization.id, records], () => {
  selectedRowIndex.value = null;
});
watch([() => props.visualization.id, () => props.visualization.kind], () => {
  dataOpen.value = props.visualization.kind === "matrix";
});

function display(value: string | number | null, column: string) {
  if (value === null || value === "") return t("缺失");
  if (props.visualization.unit === "%" || column.toLowerCase().includes("occupancy")) return formatPercent(value, 1);
  return typeof value === "number" ? formatNumber(value, 3) : value;
}
</script>

<template>
  <section
    class="visualization-panel"
    :class="{ 'visualization-panel--compact': compact }"
    :data-chart-kind="visualization.kind"
  >
    <header>
      <div class="visualization-title-icon">
        <BarChart3 v-if="chartable" :size="17" /><TableProperties v-else :size="17" />
      </div>
      <div>
        <div class="visualization-title-line">
          <h3>{{ t(visualization.title) }}</h3>
          <span>{{ t(kindLabels[visualization.kind]) }}</span>
        </div>
      </div>
    </header>

    <template v-if="chartable && visualization.rows.length">
      <ExecutionChart :visualization="visualization" @row-selected="selectedRowIndex = $event" />
      <p v-if="visualization.rows.length > 12" class="visualization-limit-note">
        {{ t("图中按报告顺序显示前 12 项；下方字段表分页保留全部 {count} 项。", { count: visualization.rows.length }) }}
      </p>
      <div v-if="selectedRow" class="visualization-selection" aria-live="polite">
        <div>
          <small>{{ t("已选择图表项") }}</small>
          <strong>{{ selectedRow.label }}</strong>
          <span v-if="selectedRow.status">{{ selectedRow.status }}</span>
          <p v-if="selectedRow.detail">{{ selectedRow.detail }}</p>
        </div>
        <span v-if="selectedEvidencePaths.length" class="visualization-selection__evidence">
          <ArtifactEvidenceLink
            v-for="path in selectedEvidencePaths"
            :key="path"
            :source-path="path"
            label="查看当前 run 的正式证据"
          />
        </span>
        <small v-else>{{ t("该图表项没有可导航的精确 evidence pointer。") }}</small>
      </div>
    </template>
    <div v-else-if="visualization.kind === 'matrix'" class="visualization-matrix">
      <div v-for="row in visibleRecords" :key="row.label">
        <code>{{ row.label }}</code>
        <strong>{{ display(row.values[0], visualization.columns[0]) }}</strong>
        <small>{{ row.sourcePath || "—" }}</small>
      </div>
    </div>
    <div v-else class="visualization-empty">
      <Info :size="17" /><span>{{ visualization.emptyReason }}</span>
    </div>

    <RecordPager
      v-if="visualization.kind === 'matrix' && !dataOpen"
      v-model:page="page"
      :pages="pages"
      :label="`${t(visualization.title)} · ${t('数据分页')}`"
    />
    <p class="visualization-caption">{{ t(visualization.description) }}</p>
    <p v-if="showBoundary && visualization.boundary" class="visualization-boundary">
      {{ t("解读边界") }} · {{ t(visualization.boundary) }}
    </p>

    <div v-if="dataIssues.length" class="visualization-issues" role="status">
      <AlertTriangle :size="16" />
      <div>
        <strong>{{ t("字段质量提醒") }}</strong>
        <ul>
          <li v-for="issue in dataIssues.slice(0, 5)" :key="issue">{{ issue }}</li>
        </ul>
        <small v-if="dataIssues.length > 5">{{
          t("另有 {count} 项，请查看下方字段表。", { count: dataIssues.length - 5 })
        }}</small>
      </div>
    </div>

    <details
      v-if="visualization.rows.length"
      class="visualization-data"
      :open="dataOpen"
      @toggle="dataOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary>
        <span><Braces :size="15" />{{ t("查看数据与证据") }}</span
        ><small>{{ t("{count} 行", { count: visualization.rows.length }) }}</small>
      </summary>
      <template v-if="dataOpen">
        <dl class="visualization-contract">
          <div>
            <dt>{{ t("来源") }}</dt>
            <dd>
              <code>{{ visualization.sourcePaths.join(" · ") || t("没有字段来源") }}</code>
            </dd>
          </div>
          <div>
            <dt>derivation</dt>
            <dd>
              <code>{{ visualization.derivation }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("单位") }}</dt>
            <dd>{{ visualization.unit || t("不适用") }}</dd>
          </div>
        </dl>
        <div
          class="visualization-table-scroll"
          role="region"
          :aria-label="`${t(visualization.title)} · ${t('数据与证据')}`"
          tabindex="0"
        >
          <table>
            <thead>
              <tr>
                <th>{{ t("实体") }}</th>
                <th v-for="column in visualization.columns" :key="column">{{ t(column) }}</th>
                <th v-if="hasStatus">{{ t("报告状态") }}</th>
                <th>{{ t("JSON 字段来源") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in visibleRecords" :key="`${visualization.id}-${page}-${rowIndex}`">
                <th scope="row">{{ row.label }}</th>
                <td v-for="(value, index) in row.values" :key="index">
                  {{ display(value, visualization.columns[index]) }}
                  <small v-if="row.rawValues?.[index]">
                    {{ visualization.rawColumns?.[index] || "raw" }}: {{ row.rawValues[index] }}
                    {{ visualization.rawUnit }}
                  </small>
                  <ArtifactEvidenceLink
                    v-if="row.valueSourcePaths?.[index]"
                    :source-path="row.valueSourcePaths[index]"
                    :label="`${visualization.columns[index]} 证据`"
                  />
                </td>
                <td v-if="hasStatus">
                  <code>{{ row.status || t("未报告") }}</code>
                  <small v-if="row.detail">{{ row.detail }}</small>
                </td>
                <td>
                  <code>{{ row.sourcePath || "—" }}</code>
                  <ArtifactEvidenceLink :source-path="row.sourcePath" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <RecordPager v-model:page="page" :pages="pages" :label="`${t(visualization.title)} · ${t('数据分页')}`" />
      </template>
    </details>

    <footer v-if="visualization.sourcePaths.length">
      <span>{{ t("字段范围") }}</span
      ><code v-for="path in visualization.sourcePaths" :key="path">{{ path }}</code>
    </footer>
  </section>
</template>

<style scoped>
.visualization-data[open] > :not(summary) {
  animation: none;
}
.visualization-boundary {
  margin: 0;
  padding: 0 18px 14px;
  color: var(--muted);
  font-size: var(--text-xs);
  line-height: 1.6;
}
.visualization-table-scroll:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
