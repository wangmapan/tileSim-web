<script setup lang="ts">
import { computed, ref, watch } from "vue";
import StatusPill from "../../../components/StatusPill.vue";
import { formatNumber, formatPercent } from "../../../lib/format";
import type { ExecutionRecord } from "../model/types";
import { useI18n } from "../../../i18n";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";

const props = defineProps<{ records: ExecutionRecord[] }>();
const { t } = useI18n();
const visibleCount = ref(50);
const columns = computed(() => [...new Set(props.records.flatMap((record) => record.facts.map((fact) => fact.label)))]);
const visibleRecords = computed(() => props.records.slice(0, visibleCount.value));

watch(
  () => props.records,
  () => (visibleCount.value = 50),
);

function factFor(record: ExecutionRecord, label: string) {
  return record.facts.find((fact) => fact.label === label);
}

function display(value: unknown, unit = "") {
  if (value === null || value === undefined || value === "") return t("缺失");
  if (unit === "%ratio") return formatPercent(value, 1);
  if (unit === "bytes" && typeof value === "number") return `${formatNumber(value / 1_048_576, 3)} MiB`;
  return `${typeof value === "number" ? formatNumber(value, 3) : value}${unit && !unit.startsWith("%") ? ` ${unit}` : ""}`;
}
</script>

<template>
  <div class="record-table-scroll">
    <table class="record-table">
      <thead>
        <tr>
          <th>{{ t("记录") }}</th>
          <th>{{ t("状态") }}</th>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in visibleRecords" :key="record.id">
          <th scope="row">
            <code>{{ record.id }}</code
            ><strong>{{ record.title }}</strong
            ><small v-if="record.subtitle">{{ record.subtitle }}</small>
            <ArtifactEvidenceLink v-if="record.sourcePath" :source-path="record.sourcePath" />
          </th>
          <td>
            <StatusPill v-if="record.status && record.status !== 'unknown'" :value="record.status" /><span v-else
              >—</span
            >
          </td>
          <td v-for="column in columns" :key="column" :class="{ 'record-value--missing': !factFor(record, column) }">
            {{
              factFor(record, column)
                ? display(factFor(record, column)?.value, factFor(record, column)?.unit)
                : t("不适用")
            }}
          </td>
        </tr>
      </tbody>
    </table>
    <button v-if="visibleCount < records.length" class="record-table-more" @click="visibleCount += 50">
      {{
        t("再显示 {count} 条（当前 {visible}/{total}）", {
          count: Math.min(50, records.length - visibleCount),
          visible: visibleRecords.length,
          total: records.length,
        })
      }}
    </button>
  </div>
</template>
