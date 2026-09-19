<script setup lang="ts">
import { computed } from "vue";
import type { ReportBundle } from "../../../contracts/report-model";
import { buildCoverage, type CoverageSection } from "../model";
import CoveragePanel from "./CoveragePanel.vue";

const props = defineProps<{ section: CoverageSection; bundle: ReportBundle }>();

const titles: Record<CoverageSection, string> = {
  run: "主运行报告 · 完整字段覆盖",
  metrics: "指标报告 · 完整字段覆盖",
  validation: "验证报告 · 完整字段覆盖",
  tail: "慢请求归因报告 · 完整字段覆盖",
  execution_envelope: "执行信封 · 完整字段覆盖",
};

const descriptions: Record<CoverageSection, string> = {
  run: "补齐 run-result.json 中此前未渲染的字段；全部来自当前 run bundle，不新增任何数据请求。",
  metrics: "补齐 metrics.json 中此前未渲染的字段；ps 值走无损路径，显示换算保留原始整数。",
  validation: "补齐 validation.json 中此前未渲染的字段；验证报告的误差预算与 S8 校准预算分开显示。",
  tail: "补齐 tail-cause-chain.json 中此前未渲染的字段；贡献因子与归因排序是两层证据，分开展示。",
  execution_envelope: "补齐 execution-envelope.json 中此前未渲染的字段；布尔采集事实如实显示，不用颜色暗示已采集。",
};

const groups = computed(() => buildCoverage(props.bundle, props.section));
</script>

<template>
  <CoveragePanel
    v-if="groups.length"
    :title="titles[props.section]"
    :description="descriptions[props.section]"
    :groups="groups"
  />
</template>
