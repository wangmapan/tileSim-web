<script setup lang="ts">
import { AlertTriangle, BarChart3, Braces, Info, TableProperties } from "@lucide/vue";
import { computed, defineAsyncComponent } from "vue";
import { formatNumber, formatPercent } from "../../../lib/format";
import type { LayerVisualization } from "../model/types";
import { useI18n } from "../../../i18n";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";

const ExecutionChart = defineAsyncComponent(() => import("../charts/ExecutionChart.vue"));

const props = defineProps<{ visualization: LayerVisualization; compact?: boolean }>();
const { t } = useI18n();
const chartable = computed(() => ["bar", "stacked-bar", "scatter", "timeline"].includes(props.visualization.kind));
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
          <h3>{{ visualization.title }}</h3>
          <span>{{ t(kindLabels[visualization.kind]) }}</span>
        </div>
        <p>{{ visualization.description }}</p>
      </div>
    </header>

    <template v-if="chartable && visualization.rows.length">
      <ExecutionChart :visualization="visualization" />
      <p v-if="visualization.rows.length > 12" class="visualization-limit-note">
        {{ t("图中按报告顺序显示前 12 项；下方字段表保留全部 {count} 项。", { count: visualization.rows.length }) }}
      </p>
    </template>
    <div v-else-if="visualization.kind === 'matrix'" class="visualization-matrix">
      <div v-for="row in visualization.rows" :key="row.label">
        <code>{{ row.label }}</code>
        <strong>{{ display(row.values[0], visualization.columns[0]) }}</strong>
        <small>{{ row.sourcePath || "—" }}</small>
      </div>
    </div>
    <div v-else class="visualization-empty">
      <Info :size="17" /><span>{{ visualization.emptyReason }}</span>
    </div>

    <div class="visualization-rationale">
      <Info :size="15" /><span
        ><strong>{{ t("类型依据：") }}</strong
        >{{ visualization.rationale }}</span
      >
    </div>

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

    <details v-if="visualization.rows.length" class="visualization-data" :open="visualization.kind === 'matrix'">
      <summary>
        <span><Braces :size="15" />{{ t("图表数据与 JSON 字段") }}</span
        ><small>{{ t("{count} 行", { count: visualization.rows.length }) }}</small>
      </summary>
      <div class="visualization-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t("实体") }}</th>
              <th v-for="column in visualization.columns" :key="column">{{ column }}</th>
              <th>{{ t("JSON 字段来源") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visualization.rows" :key="`${visualization.id}-${row.label}`">
              <th scope="row">{{ row.label }}</th>
              <td v-for="(value, index) in row.values" :key="index">
                {{ display(value, visualization.columns[index]) }}
                <small v-if="row.rawValues?.[index]">raw: {{ row.rawValues[index] }} ps</small>
              </td>
              <td>
                <code>{{ row.sourcePath || "—" }}</code>
                <ArtifactEvidenceLink :source-path="row.sourcePath" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <footer v-if="visualization.sourcePaths.length">
      <span>{{ t("字段范围") }}</span
      ><code v-for="path in visualization.sourcePaths" :key="path">{{ path }}</code>
    </footer>
  </section>
</template>
