<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import type { ReplayCollectiveModel } from "../model/types";
import ReplayVirtualList from "./ReplayVirtualList.vue";

const props = defineProps<{ collective: ReplayCollectiveModel; selectedStepId: string | null }>();
const emit = defineEmits<{ selectStep: [stepId: string] }>();
const ROW_HEIGHT = 78;
const visibleStart = ref(0);
const visibleEnd = ref(Math.min(props.collective.steps.length, 32));
const expanded = ref(false);
const displayedSteps = computed(() => props.collective.steps.slice(visibleStart.value, visibleEnd.value));
const hasReportedSteps = computed(() => props.collective.supported && props.collective.steps.length > 0);
const hasVerifiedEmptyArtifact = computed(
  () =>
    props.collective.availability === "available" && props.collective.supported && props.collective.steps.length === 0,
);
const availabilityLabel = computed(() => {
  if (hasVerifiedEmptyArtifact.value) return "已验证 · 无步骤";
  if (hasReportedSteps.value)
    return `${props.collective.steps.length} 个已报告步骤${props.collective.availability === "partial" ? " · 部分提供" : ""}`;
  return {
    expected_absence: "预期缺省",
    not_covered: "未覆盖",
    missing: "未报告",
    unsupported_schema: "不支持的 Schema",
    partial: "部分提供",
    available: "已提供",
  }[props.collective.availability];
});
const emptyText = computed(() =>
  hasVerifiedEmptyArtifact.value
    ? "后端已验证当前运行没有集合步骤。"
    : props.collective.reason || "当前没有可显示的集合步骤。",
);

const selectedIndex = computed(() => props.collective.steps.findIndex((step) => step.stepId === props.selectedStepId));

function updateVisibleRange(start: number, end: number) {
  visibleStart.value = start;
  visibleEnd.value = end;
}

function onToggle(event: Event) {
  expanded.value = (event.currentTarget as HTMLDetailsElement).open;
}

watch(
  () => props.collective.steps.length,
  (total) => {
    if (visibleStart.value >= total) visibleStart.value = 0;
    visibleEnd.value = Math.min(total, Math.max(visibleEnd.value, visibleStart.value + 1));
  },
);
watch(
  () => props.selectedStepId,
  (stepId) => {
    // Selecting a step from the timeline or topology is an explicit request
    // to inspect its row, so reveal the otherwise quiet evidence section.
    if (stepId) expanded.value = true;
  },
);
</script>

<template>
  <details class="replay-collective" aria-label="集合通信步骤" :open="expanded" @toggle="onToggle">
    <summary class="replay-collective__summary">
      <header class="replay-collective__header">
        <div>
          <span class="section-kicker">集合通信</span>
          <h3>
            {{
              hasReportedSteps
                ? "已报告 round / chunk"
                : hasVerifiedEmptyArtifact
                  ? "集合步骤（无记录）"
                  : "集合步骤证据"
            }}
          </h3>
        </div>
        <span class="replay-collective__summary-meta">
          <span class="replay-collective__availability" :data-status="collective.availability">
            {{ availabilityLabel }}
          </span>
          <span class="replay-collective__summary-caret" aria-hidden="true">⌄</span>
        </span>
      </header>
    </summary>
    <p v-if="!collective.steps.length" class="replay-collective__empty">
      {{ emptyText }}
    </p>
    <div v-if="displayedSteps.length" class="replay-collective__table-wrap">
      <ReplayVirtualList
        v-slot="{ startIndex, topSpacerHeight, bottomSpacerHeight }"
        :total="collective.steps.length"
        :row-height="ROW_HEIGHT"
        :active-index="selectedIndex"
        role="region"
        :aria-label="`集合通信步骤，共 ${collective.steps.length} 条`"
        @range-change="updateVisibleRange"
      >
        <table class="replay-collective__table" :aria-rowcount="collective.steps.length">
          <thead>
            <tr>
              <th scope="col">集合 / 阶段</th>
              <th scope="col">round / chunk</th>
              <th scope="col">时间 (ps)</th>
              <th scope="col">source → destination</th>
              <th scope="col">bytes</th>
              <th scope="col">依赖</th>
              <th scope="col">证据</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="topSpacerHeight" class="replay-collective__virtual-spacer" aria-hidden="true">
              <td colspan="7" :style="{ height: `${topSpacerHeight}px` }"></td>
            </tr>
            <tr
              v-for="(step, index) in displayedSteps"
              :key="step.stepId"
              :class="{ 'is-selected': selectedStepId === step.stepId }"
              :aria-selected="selectedStepId === step.stepId"
              :aria-posinset="startIndex + index + 1"
              :aria-setsize="collective.steps.length"
            >
              <td
                data-label="集合 / 阶段"
                :aria-label="`集合 / 阶段：${step.collectiveId} ${step.phaseLabel || step.phaseId}`"
              >
                <button
                  type="button"
                  class="replay-collective__step"
                  :aria-pressed="selectedStepId === step.stepId"
                  @click="emit('selectStep', step.stepId)"
                >
                  <code>{{ step.collectiveId }}</code>
                  <span :title="step.phaseId">{{ step.phaseLabel || step.phaseId }}</span>
                </button>
              </td>
              <td data-label="round / chunk" :aria-label="`round / chunk：${step.round} / ${step.chunk}`">
                <code>{{ step.round }} / {{ step.chunk }}</code>
              </td>
              <td data-label="时间 (ps)" :aria-label="`时间：${step.timing.startPs} – ${step.timing.endPs} ps`">
                <code>{{ step.timing.startPs }} – {{ step.timing.endPs }}</code>
              </td>
              <td
                data-label="source → destination"
                :aria-label="`source 到 destination：${step.sourceDevice} 到 ${step.destinationDevice}`"
              >
                <code>{{ step.sourceDevice }} → {{ step.destinationDevice }}</code>
              </td>
              <td data-label="bytes" :aria-label="`bytes：${step.bytes}`">
                <code>{{ step.bytes }}</code>
              </td>
              <td
                data-label="依赖"
                :aria-label="`依赖：${step.dependencies === null ? '未报告' : step.dependencies.length ? step.dependencies.join(', ') : '无依赖'}`"
              >
                <code>{{
                  step.dependencies === null
                    ? "未报告"
                    : step.dependencies.length
                      ? step.dependencies.join(", ")
                      : "无依赖"
                }}</code>
              </td>
              <td data-label="证据" aria-label="证据">
                <ArtifactEvidenceLink :source-path="step.sourcePath" label="证据" />
              </td>
            </tr>
            <tr v-if="bottomSpacerHeight" class="replay-collective__virtual-spacer" aria-hidden="true">
              <td colspan="7" :style="{ height: `${bottomSpacerHeight}px` }"></td>
            </tr>
          </tbody>
        </table>
      </ReplayVirtualList>
    </div>
  </details>
</template>

<style scoped>
.replay-collective {
  min-width: 0;
  padding: 18px 20px 20px;
  border-top: 1px solid var(--line);
}
.replay-collective__summary {
  display: block;
  cursor: pointer;
  list-style: none;
}
.replay-collective__summary::-webkit-details-marker {
  display: none;
}
.replay-collective__summary:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 4px;
  border-radius: var(--radius-control);
}
.replay-collective__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.replay-collective h3 {
  margin: 4px 0 0;
  font-size: 16px;
}
.replay-collective__summary-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.replay-collective__summary-caret {
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 160ms var(--ease-standard);
}
.replay-collective[open] .replay-collective__summary-caret {
  transform: rotate(180deg);
}
.replay-collective__availability,
.replay-collective__empty {
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-collective__availability[data-status="available"] {
  color: var(--positive-ink);
}
.replay-collective__limit {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-collective__table-wrap {
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
.replay-collective__table-wrap .replay-virtual-list {
  min-height: 180px;
}
.replay-collective__table {
  width: 100%;
  min-width: 760px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--text-xs);
}
.replay-collective__table th,
.replay-collective__table td {
  min-width: 0;
  padding: 8px 9px;
  border-top: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
.replay-collective__virtual-spacer td {
  padding: 0;
  border: 0;
}
.replay-collective__table th {
  color: var(--muted);
  font-weight: 600;
}
.replay-collective__table tr.is-selected td {
  background: var(--accent-soft);
}
.replay-collective__table tbody tr:not(.replay-collective__virtual-spacer) {
  height: 78px;
}
.replay-collective__table tbody tr:not(.replay-collective__virtual-spacer) td {
  max-height: 78px;
  overflow: hidden;
}
.replay-collective__step {
  display: grid;
  gap: 3px;
  padding: 0;
  border: 0;
  color: var(--ink);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.replay-collective__step span {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.replay-collective__table code,
.replay-collective__table td > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

.replay-collective__table td code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .replay-collective__table {
    min-width: 0;
  }

  .replay-collective__table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .replay-collective__table,
  .replay-collective__table tbody,
  .replay-collective__table tr,
  .replay-collective__table td {
    display: block;
    width: 100%;
  }

  .replay-collective__table tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 14px;
    padding: 7px 0;
    border-top: 1px solid var(--line);
    height: 78px;
    overflow: hidden;
  }

  .replay-collective__table td {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 8px;
    padding: 6px 0;
    border: 0;
  }

  .replay-collective__table td::before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
  }

  .replay-collective__table td:first-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .replay-collective__table tr {
    grid-template-columns: minmax(0, 1fr);
  }

  .replay-collective__table td {
    grid-template-columns: 7rem minmax(0, 1fr);
  }
}
</style>
