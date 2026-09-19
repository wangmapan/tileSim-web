<script setup lang="ts">
import { ChevronDown, Layers3 } from "@lucide/vue";
import { computed } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { useI18n } from "../../../i18n";
import type { CoverageGroup } from "../types";
import AvailabilityBadge from "./AvailabilityBadge.vue";
import CoverageListTable from "./CoverageListTable.vue";

const props = defineProps<{ title: string; description?: string; groups: CoverageGroup[] }>();
const { t } = useI18n();
const fieldCount = computed(() => props.groups.reduce((total, group) => total + group.fields.length, 0));
const recordCount = computed(() =>
  props.groups.reduce(
    (total, group) => total + group.lists.reduce((subtotal, list) => subtotal + list.records.length, 0),
    0,
  ),
);
</script>

<template>
  <details class="panel coverage-panel" data-help-anchor="report-coverage">
    <summary class="panel-header">
      <div>
        <p class="section-kicker">{{ t("报告字段覆盖") }}</p>
        <h2>{{ t(props.title) }}</h2>
        <p v-if="props.description">{{ t(props.description) }}</p>
      </div>
      <span class="coverage-panel__count">
        <Layers3 :size="15" />{{
          t("{fields} 个字段 · {records} 条记录", { fields: fieldCount, records: recordCount })
        }}
      </span>
      <ChevronDown :size="17" />
    </summary>

    <div class="coverage-panel__body">
      <section v-for="group in props.groups" :key="group.key" class="coverage-group">
        <header class="coverage-group__header">
          <div>
            <h3>{{ t(group.title) }}</h3>
            <p v-if="group.description">{{ t(group.description) }}</p>
          </div>
          <AvailabilityBadge v-if="group.availability !== 'available'" :availability="group.availability" compact />
        </header>

        <dl v-if="group.fields.length" class="coverage-fields">
          <div v-for="item in group.fields" :key="item.key" class="coverage-field">
            <dt>
              <code>{{ item.label }}</code>
            </dt>
            <dd>
              <template v-if="item.text !== null">
                <code v-if="!item.fact" class="coverage-field__value">{{ item.text }}</code>
                <output v-else class="coverage-field__fact">{{ item.text }}</output>
              </template>
              <AvailabilityBadge v-else :availability="item.availability" compact />
              <span v-for="path in item.sourcePaths" :key="path" class="coverage-field__source">
                <ArtifactEvidenceLink :source-path="path" />
              </span>
            </dd>
          </div>
        </dl>

        <CoverageListTable v-for="list in group.lists" :key="list.key" :list="list" />
      </section>
    </div>
  </details>
</template>

<style scoped>
.coverage-panel {
  min-width: 0;
}
.coverage-panel__count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font: var(--text-xs) var(--font-mono);
}
.coverage-panel__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 16px 16px;
  min-width: 0;
}
.coverage-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.coverage-group__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.coverage-group__header h3 {
  margin: 0;
  font: 650 var(--text-sm) var(--font-sans);
}
.coverage-group__header p {
  margin: 4px 0 0;
  max-width: 72ch;
  color: var(--muted);
  font-size: var(--text-xs);
}
.coverage-fields {
  display: grid;
  grid-template-columns: minmax(180px, 320px) minmax(0, 1fr);
  gap: 4px 16px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-subtle);
}
.coverage-field {
  display: contents;
}
.coverage-field dt {
  min-width: 0;
}
.coverage-field dt code {
  font: 600 var(--text-xs) var(--font-mono);
  overflow-wrap: anywhere;
}
.coverage-field dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  min-width: 0;
}
.coverage-field__value {
  font: var(--text-xs) var(--font-mono);
  overflow-wrap: anywhere;
}
.coverage-field__fact {
  font: 650 var(--text-xs) var(--font-sans);
}
.coverage-field__source {
  display: inline-flex;
}
</style>
