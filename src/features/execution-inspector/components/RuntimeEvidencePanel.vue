<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";
import { fetchVerifiedArtifact } from "../../run-evidence";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../lib/api";
import { useI18n } from "../../../i18n";
import { losslessIntegerToBigInt } from "../../../contracts/lossless-json";

type EvidenceId = "runtime-events" | "runtime-summary" | "runtime-requests" | "runtime-analysis";
const definitions: { id: EvidenceId; label: string; description: string }[] = [
  { id: "runtime-events", label: "运行期事件", description: "后端事件流，保留事件时间、请求、批次与逻辑步。" },
  { id: "runtime-summary", label: "运行期汇总", description: "后端原始计数与顺序证据，不与指标报告重复累加。" },
  { id: "runtime-requests", label: "逐请求运行记录", description: "到达、准入、首次发批与完成时间均为后端已有值。" },
  {
    id: "runtime-analysis",
    label: "运行期分析原件",
    description: "包含汇总、逐请求与事件的完整后端工件；不重复计算。",
  },
];

const props = defineProps<{
  runId: string | null;
  artifactManifest: ArtifactManifestResponse | null;
  backendRevision: string;
  bridgeManifest: ApiManifestResponse | null;
}>();
const { t } = useI18n();
const selected = ref<EvidenceId>("runtime-events");
const payload = ref<unknown>(null);
const loading = ref(false);
const error = ref("");
const entry = computed(() => props.artifactManifest?.artifacts.find((item) => item.artifact_id === selected.value));
const tooLarge = computed(() => entry.value && losslessIntegerToBigInt(entry.value.bytes) > 8_000_000n);
const rejected = computed(() =>
  props.artifactManifest?.rejected_artifacts.find((item) => item.artifact_id === selected.value),
);
const record = computed(() =>
  payload.value && typeof payload.value === "object" && !Array.isArray(payload.value)
    ? (payload.value as Record<string, unknown>)
    : null,
);
const events = computed(() => (Array.isArray(record.value?.events) ? record.value.events : []));
const requests = computed(() => (Array.isArray(record.value?.requests) ? record.value.requests : []));
const { page: eventPage, pages: eventPages, visibleRecords: visibleEvents } = useRecordPage(events);
const { page: requestPage, pages: requestPages, visibleRecords: visibleRequests } = useRecordPage(requests);
const activeDefinition = computed(() => definitions.find((item) => item.id === selected.value)!);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function value(value: unknown): string {
  if (value === null || value === undefined) return t("未报告");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function reset() {
  payload.value = null;
  error.value = "";
  loading.value = false;
}

watch([selected, () => props.runId, () => entry.value?.sha256], reset);

async function load() {
  const runId = props.runId;
  const selectedEntry = entry.value;
  if (!runId || !selectedEntry || loading.value || tooLarge.value) return;
  const selectedHash = selectedEntry.sha256;
  loading.value = true;
  error.value = "";
  try {
    const result = await fetchVerifiedArtifact(runId, selectedEntry, {
      backendRevision: props.backendRevision,
      manifest: props.bridgeManifest,
    });
    if (props.runId === runId && entry.value?.sha256 === selectedHash) payload.value = result;
  } catch (reason) {
    if (props.runId === runId && entry.value?.sha256 === selectedHash)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="panel runtime-evidence-panel" aria-label="后端运行期证据">
    <header class="panel-header">
      <div>
        <p class="section-kicker">{{ t("推理引擎与服务运行时模块") }}</p>
        <h2>{{ t("后端运行期证据") }}</h2>
        <p>{{ t("这些是后端写出的工件；输入请求与指标的显示级关联不是事件流。只在选择后读取。") }}</p>
      </div>
    </header>
    <div class="runtime-evidence-controls">
      <label>
        <span>{{ t("工件") }}</span>
        <select v-model="selected">
          <option v-for="definition in definitions" :key="definition.id" :value="definition.id">
            {{ t(definition.label) }}
          </option>
        </select>
      </label>
      <button class="button button--secondary" type="button" :disabled="!entry || loading || tooLarge" @click="load">
        {{ loading ? t("正在校验并读取…") : t("按需读取") }}
      </button>
    </div>
    <p class="structured-note">{{ t(activeDefinition.description) }}</p>
    <p v-if="!artifactManifest" role="status">{{ t("当前运行没有可信工件清单，不能读取运行期证据。") }}</p>
    <p v-else-if="rejected" role="alert">
      {{ t("工件被校验拒绝") }}：{{ rejected.reason }} · {{ rejected.json_pointer }}
    </p>
    <p v-else-if="!entry" role="status">
      {{ t("未请求此工件；Trace package 或非运行时入口没有被推断为可用事件流。") }}
    </p>
    <template v-else>
      <p class="runtime-evidence-identity">
        {{ entry.content_status === "expected_absence" ? t("期望缺席描述符（没有事件数据）") : t("已就绪") }}
        · {{ entry.contract_status }} · <code>{{ entry.schema_identity || t("无数据 Schema") }}</code> ·
        {{ entry.bytes }} bytes · SHA-256 <code>{{ entry.sha256 }}</code>
        <ArtifactEvidenceLink :source-path="`${selected}:/`" />
      </p>
      <p v-if="error" role="alert">{{ t("读取或校验失败") }}：{{ error }}</p>
      <p v-if="tooLarge" role="status">{{ t("大工件不在此页解析；请到原始证据查看器按需索引和分页查看。") }}</p>
      <p v-if="entry.content_status === 'expected_absence' && record" role="status">
        {{ value(record.absence_reason) }} · {{ value(record.detail) }}
      </p>
      <template v-else-if="record">
        <div v-if="selected === 'runtime-summary' || selected === 'runtime-analysis'" class="runtime-evidence-facts">
          <span
            v-for="field in [
              'total_events',
              'first_event_time_ps',
              'last_event_time_ps',
              'peak_active_requests',
              'monotonic_time_order',
            ]"
            :key="field"
          >
            <code>{{ field }}</code
            >: {{ value(object(selected === "runtime-analysis" ? record.summary : record)[field]) }}
            <ArtifactEvidenceLink
              :source-path="`${selected}:${selected === 'runtime-analysis' ? '/summary' : ''}/${field}`"
            />
          </span>
        </div>
        <div
          v-if="selected === 'runtime-events' || selected === 'runtime-analysis'"
          class="table-wrap runtime-evidence-table"
          role="region"
          :aria-label="t('运行期事件')"
          tabindex="0"
        >
          <p v-if="!events.length">{{ t("事件集合为空（后端已提供空数组），不是工件缺失。") }}</p>
          <table v-else>
            <thead>
              <tr>
                <th>{{ t("事件时间 (ps)") }}</th>
                <th>{{ t("类型 / 逻辑步") }}</th>
                <th>{{ t("请求 / 批次") }}</th>
                <th>{{ t("证据") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in visibleEvents" :key="(eventPage - 1) * 25 + index">
                <td>
                  <code>{{ value(object(item).event_time_ps) }}</code>
                </td>
                <td>{{ value(object(item).kind) }} · {{ value(object(item).logical_step) }}</td>
                <td>
                  <code>{{ value(object(item).request_id) }}</code> / <code>{{ value(object(item).batch_id) }}</code
                  ><small>{{ value(object(item).batch_request_ids) }}</small>
                </td>
                <td><ArtifactEvidenceLink :source-path="`${selected}:/events/${(eventPage - 1) * 25 + index}`" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <RecordPager
          v-if="events.length && (selected === 'runtime-events' || selected === 'runtime-analysis')"
          v-model:page="eventPage"
          :pages="eventPages"
          :label="t('运行期事件分页')"
        />
        <div
          v-if="selected === 'runtime-requests' || selected === 'runtime-analysis'"
          class="table-wrap runtime-evidence-table"
          role="region"
          :aria-label="t('逐请求运行记录')"
          tabindex="0"
        >
          <p v-if="!requests.length">{{ t("逐请求集合为空（后端已提供空数组），不是工件缺失。") }}</p>
          <table v-else>
            <thead>
              <tr>
                <th>{{ t("请求") }}</th>
                <th>{{ t("到达 / 准入 (ps)") }}</th>
                <th>{{ t("首批 / 完成 (ps)") }}</th>
                <th>{{ t("KV tokens") }}</th>
                <th>{{ t("证据") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in visibleRequests" :key="(requestPage - 1) * 25 + index">
                <th scope="row">
                  <code>{{ value(object(item).request_id) }}</code>
                </th>
                <td>{{ value(object(item).arrival_time_ps) }} / {{ value(object(item).admit_time_ps) }}</td>
                <td>
                  {{ value(object(item).first_batch_issue_time_ps) }} / {{ value(object(item).completion_time_ps) }}
                </td>
                <td>{{ value(object(item).final_kv_tokens) }}</td>
                <td>
                  <ArtifactEvidenceLink :source-path="`${selected}:/requests/${(requestPage - 1) * 25 + index}`" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <RecordPager
          v-if="requests.length && (selected === 'runtime-requests' || selected === 'runtime-analysis')"
          v-model:page="requestPage"
          :pages="requestPages"
          :label="t('逐请求记录分页')"
        />
      </template>
    </template>
  </section>
</template>

<style scoped>
.runtime-evidence-panel {
  padding-bottom: 16px;
}
.runtime-evidence-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  padding: 0 20px 12px;
}
.runtime-evidence-controls label {
  display: grid;
  gap: 5px;
  min-width: min(100%, 260px);
}
.runtime-evidence-panel > p,
.runtime-evidence-facts {
  margin: 8px 20px;
}
.runtime-evidence-identity {
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 0.85rem;
}
.runtime-evidence-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}
.runtime-evidence-facts > span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}
.runtime-evidence-table {
  margin: 12px 20px 0;
  max-width: calc(100% - 40px);
}
.runtime-evidence-table td,
.runtime-evidence-table th {
  vertical-align: top;
}
.runtime-evidence-table small {
  display: block;
  color: var(--muted);
}
</style>
