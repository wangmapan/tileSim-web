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
let disposed = false;
let pendingFrame: number | null = null;
let renderPending = false;
let resizePending = false;

function renderChart() {
  if (disposed || !host.value) return;
  if (!chart) {
    chart = init(host.value, undefined, { renderer: "svg" });
    chart.on("click", (event) => {
      if (typeof event.dataIndex === "number") emit("rowSelected", event.dataIndex);
    });
  }
  chart.setOption(chartOption(props.visualization), true);
}

function scheduleUpdate(render: boolean, resize = false) {
  if (disposed) return;
  renderPending ||= render;
  resizePending ||= resize;
  if (pendingFrame !== null) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    if (disposed) return;
    if (resizePending) chart?.resize();
    if (renderPending) renderChart();
    renderPending = false;
    resizePending = false;
  });
}

onMounted(async () => {
  await nextTick();
  if (disposed || !host.value) return;
  renderChart();
  if (typeof ResizeObserver !== "undefined" && host.value) {
    observer = new ResizeObserver(() => scheduleUpdate(false, true));
    observer.observe(host.value);
  }
  if (typeof MutationObserver !== "undefined") {
    appearanceObserver = new MutationObserver(() => scheduleUpdate(true));
    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-appearance", "data-theme"],
    });
  }
});

watch(
  () => props.visualization,
  () => scheduleUpdate(true),
  { deep: true },
);

onBeforeUnmount(() => {
  disposed = true;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  pendingFrame = null;
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
