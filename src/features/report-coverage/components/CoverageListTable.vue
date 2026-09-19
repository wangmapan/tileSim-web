<script setup lang="ts">
import { computed } from "vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";
import { useI18n } from "../../../i18n";
import type { CoverageCell, CoverageList } from "../types";
import AvailabilityBadge from "./AvailabilityBadge.vue";

const props = defineProps<{ list: CoverageList }>();
const { t } = useI18n();
const rows = computed(() =>
  props.list.records.map((entry) => ({
    key: entry.key,
    cells: props.list.columns.map(
      (column): CoverageCell =>
        entry.cells.find((item) => item.key === column.key) ?? {
          key: column.key,
          label: column.label,
          text: null,
          availability: "missing",
        },
    ),
  })),
);
const { page, pages, visibleRecords } = useRecordPage(rows);
const available = computed(() => props.list.availability === "available");
</script>

<template>
  <section class="coverage-list">
    <header class="coverage-list__header">
      <div>
        <h4>{{ t(props.list.title) }}</h4>
        <p v-if="props.list.description">{{ t(props.list.description) }}</p>
      </div>
      <span class="coverage-list__count">{{ t("{count} 条", { count: props.list.records.length }) }}</span>
    </header>

    <div v-if="available && props.list.records.length" class="table-wrap coverage-list__scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in props.list.columns"
              :key="column.key"
              scope="col"
              :class="{ numeric: column.numeric, mono: column.mono }"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in visibleRecords" :key="entry.key">
            <td
              v-for="(cell, index) in entry.cells"
              :key="`${entry.key}-${props.list.columns[index]?.key ?? index}`"
              :class="{ numeric: props.list.columns[index]?.numeric, mono: props.list.columns[index]?.mono }"
            >
              <code v-if="cell.text !== null && props.list.columns[index]?.mono">{{ cell.text }}</code>
              <span v-else-if="cell.text !== null">{{ cell.text }}</span>
              <AvailabilityBadge v-else :availability="cell.availability" compact />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="coverage-empty">
      <AvailabilityBadge v-if="!available" :availability="props.list.availability" compact />
      <p>{{ t(props.list.emptyNote) }}</p>
    </div>
    <RecordPager v-model:page="page" :pages="pages" :label="t('{title} 分页', { title: t(props.list.title) })" />
  </section>
</template>

<style scoped>
.coverage-list {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  overflow: hidden;
}
.coverage-list__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
.coverage-list__header h4 {
  margin: 0;
  font: 650 var(--text-sm) var(--font-mono);
}
.coverage-list__header p {
  margin: 4px 0 0;
  max-width: 72ch;
  color: var(--muted);
  font-size: var(--text-xs);
}
.coverage-list__count {
  color: var(--muted);
  font: var(--text-xs) var(--font-mono);
}
.coverage-list__scroll {
  max-height: 420px;
  overflow: auto;
}
.coverage-list__scroll table {
  width: 100%;
  border-collapse: collapse;
}
.coverage-list__scroll th,
.coverage-list__scroll td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  font-size: var(--text-xs);
}
.coverage-list__scroll th {
  position: sticky;
  top: 0;
  background: var(--table-header);
  font: 600 var(--text-xs) var(--font-mono);
}
.coverage-list__scroll td.mono,
.coverage-list__scroll th.mono {
  font-family: var(--font-mono);
}
.coverage-list__scroll td.numeric,
.coverage-list__scroll th.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.coverage-empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.coverage-empty p {
  margin: 0;
  max-width: 72ch;
  color: var(--muted);
  font-size: var(--text-xs);
}
</style>
