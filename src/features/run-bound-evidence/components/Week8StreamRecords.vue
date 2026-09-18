<script setup lang="ts">
import { computed } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";
import { useI18n } from "../../../i18n";
import { formatNumber, formatPicoseconds } from "../../../lib/format";
import type { Week8StreamRecord } from "../types";

const props = defineProps<{ records: Week8StreamRecord[]; truncated: boolean | null; sourcePath: string | null }>();
const { t } = useI18n();
const recordPages = computed(() => props.records);
const { page, pages: pageCount, visibleRecords } = useRecordPage(recordPages);
</script>

<template>
  <section class="week8-stream-records">
    <header>
      <strong>{{ t("逐窗口提交明细") }}</strong>
      <span>{{ t("{count} 条窗口记录", { count: props.records.length }) }}</span>
    </header>
    <p v-if="props.truncated === true" class="week8-stream-records__warning">
      {{ t("后端标记 stream_records_truncated = true：列表已被后端截断，前端不做静默截断。") }}
    </p>
    <p v-else-if="props.truncated === false" class="week8-stream-records__note">
      {{ t("后端标记 stream_records_truncated = false：列表未被后端截断。") }}
    </p>
    <p v-else class="week8-stream-records__note">{{ t("后端未写出 stream_records_truncated。") }}</p>

    <div v-if="props.records.length" class="table-wrap week8-stream-records__scroll" role="region" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">window_start_ps</th>
            <th scope="col">window_end_ps</th>
            <th scope="col">partition_id</th>
            <th scope="col" class="numeric">committed_event_count</th>
            <th scope="col">committed_event_digest</th>
            <th scope="col">{{ t("证据") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in visibleRecords" :key="entry.index">
            <td>
              <code v-if="entry.windowStartPs !== null">{{ formatNumber(entry.windowStartPs) }}</code>
              <span v-else class="week8-stream-records__missing">{{ t("后端未写出该字段") }}</span>
              <small v-if="entry.windowStartPs !== null">{{ formatPicoseconds(entry.windowStartPs) }}</small>
            </td>
            <td>
              <code v-if="entry.windowEndPs !== null">{{ formatNumber(entry.windowEndPs) }}</code>
              <span v-else class="week8-stream-records__missing">{{ t("后端未写出该字段") }}</span>
              <small v-if="entry.windowEndPs !== null">{{ formatPicoseconds(entry.windowEndPs) }}</small>
            </td>
            <td>
              <code v-if="entry.partitionId !== null">{{ entry.partitionId }}</code>
              <span v-else class="week8-stream-records__missing">{{ t("后端未写出该字段") }}</span>
            </td>
            <td class="numeric">
              <span v-if="entry.committedEventCount !== null">{{ formatNumber(entry.committedEventCount) }}</span>
              <span v-else class="week8-stream-records__missing">{{ t("后端未写出该字段") }}</span>
            </td>
            <td>
              <code v-if="entry.committedEventDigest !== null" class="week8-stream-records__digest">{{
                entry.committedEventDigest
              }}</code>
              <span v-else class="week8-stream-records__missing">{{ t("后端未写出该字段") }}</span>
            </td>
            <td><ArtifactEvidenceLink :source-path="entry.sourcePath" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="week8-stream-records__note">{{ t("后端未提供逐窗口 stream_records。") }}</p>
    <RecordPager v-model:page="page" :pages="pageCount" :label="t('窗口记录分页')" />
    <ArtifactEvidenceLink v-if="props.sourcePath" :source-path="props.sourcePath" label="stream.records 证据" />
  </section>
</template>

<style scoped>
.week8-stream-records {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.week8-stream-records > header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.week8-stream-records > header span {
  color: var(--muted);
  font: var(--text-xs) var(--font-mono);
}
.week8-stream-records__warning {
  margin: 0;
  color: var(--warning-ink);
  font-size: var(--text-xs);
}
.week8-stream-records__note {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
}
.week8-stream-records__missing {
  color: var(--muted);
  font-size: var(--text-xs);
}
.week8-stream-records__scroll {
  max-height: 320px;
  overflow: auto;
}
.week8-stream-records__scroll table {
  width: 100%;
  border-collapse: collapse;
}
.week8-stream-records__scroll th,
.week8-stream-records__scroll td {
  padding: 5px 9px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  font-size: var(--text-xs);
}
.week8-stream-records__scroll th {
  position: sticky;
  top: 0;
  background: var(--table-header);
  font: 600 var(--text-xs) var(--font-mono);
}
.week8-stream-records__scroll td code {
  display: block;
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
.week8-stream-records__scroll td small {
  color: var(--muted);
}
.week8-stream-records__digest {
  max-width: 32ch;
}
.week8-stream-records__scroll .numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
