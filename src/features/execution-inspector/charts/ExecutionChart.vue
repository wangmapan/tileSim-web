<script setup lang="ts">
import { BarChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { init, use, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LayerVisualization } from "../model/types";
import { chartOption } from "./chart-options";

use([BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

const props = defineProps<{ visualization: LayerVisualization }>();
const emit = defineEmits<{ rowSelected: [index: number] }>();
const host = ref<HTMLDivElement | null>(null);
let chart: EChartsType | null = null;
let observer: ResizeObserver | null = null;
let appearanceObserver: MutationObserver | null = null;

function renderChart() {
  if (!host.value) return;
  if (!chart) {
    chart = init(host.value, undefined, { renderer: "svg" });
    chart.on("click", (event) => {
      if (typeof event.dataIndex === "number") emit("rowSelected", event.dataIndex);
    });
  }
  chart.setOption(chartOption(props.visualization), true);
}

onMounted(async () => {
  await nextTick();
  renderChart();
  if (typeof ResizeObserver !== "undefined" && host.value) {
    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(host.value);
  }
  if (typeof MutationObserver !== "undefined") {
    appearanceObserver = new MutationObserver(() => renderChart());
    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-appearance", "data-theme"],
    });
  }
});

watch(
  () => props.visualization,
  () => renderChart(),
  { deep: true },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  appearanceObserver?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div
    ref="host"
    class="execution-chart"
    role="img"
    :aria-label="`${visualization.title}，${visualization.description}`"
  ></div>
</template>
