<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";
import { losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import type { RunReport } from "../../../contracts/report-model";
import type { ApiRun } from "../../../contracts/generated/bridge-contracts";
import { useI18n } from "../../../i18n";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../lib/api";
import { fetchVerifiedArtifact } from "../../run-evidence";
import { RouterLink } from "vue-router";

const props = defineProps<{
  runId: string | null;
  run: RunReport | null;
  runMetadata?: ApiRun | null;
  artifactManifest: ArtifactManifestResponse | null;
  backendRevision: string;
  bridgeManifest: ApiManifestResponse | null;
  selectedRequestId: string | null;
}>();
const { t } = useI18n();
const payload = ref<Record<string, unknown> | null>(null);
const error = ref("");
const loading = ref(false);
const chosenRequestId = ref("");
const entry = computed(() =>
  props.artifactManifest?.artifacts.find((item) => item.artifact_id === "request-attribution"),
);
const rejected = computed(() =>
  props.artifactManifest?.rejected_artifacts.find((item) => item.artifact_id === "request-attribution"),
);
const declared = computed(() => props.run?.artifacts?.find((item) => item.artifact_id === "request_attribution"));
const attributionFailure = computed(() => {
  const code = props.runMetadata?.cli_error_code || props.run?.error_code;
  return code === "REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED"
    ? {
        code,
        path: props.runMetadata?.cli_field_path || props.run?.field_path || "",
        cause: props.runMetadata?.cli_cause || props.run?.cause || "",
        nextAction: props.runMetadata?.cli_next_action || props.run?.next_action || "请修改重复的 request_id 后重试。",
      }
    : null;
});
const tooLarge = computed(() => !!entry.value && losslessIntegerToBigInt(entry.value.bytes) > 8_000_000n);
const reports = computed(() => (Array.isArray(payload.value?.requests) ? payload.value.requests : []));
const selected = computed(() => {
  const id = chosenRequestId.value || props.selectedRequestId;
  return (reports.value.find(
    (item) => object(item).explained_entity && object(object(item).explained_entity).id === id,
  ) || reports.value[0]) as unknown;
});
const causes = computed(() =>
  Array.isArray(object(selected.value).cause_chain) ? (object(selected.value).cause_chain as unknown[]) : [],
);
const { page, pages, visibleRecords } = useRecordPage(causes);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function label(value: unknown): string {
  return value === null || value === undefined ? t("未报告") : String(value);
}
watch([() => props.runId, () => entry.value?.sha256], () => {
  payload.value = null;
  error.value = "";
  chosenRequestId.value = "";
});

async function load() {
  const runId = props.runId;
  const artifact = entry.value;
  if (!runId || !artifact || loading.value || tooLarge.value) return;
  loading.value = true;
  error.value = "";
  try {
    const verified = await fetchVerifiedArtifact(runId, artifact, {
      backendRevision: props.backendRevision,
      manifest: props.bridgeManifest,
    });
    if (props.runId === runId && entry.value?.sha256 === artifact.sha256) {
      payload.value = object(verified);
    }
  } catch (reason) {
    if (props.runId === runId && entry.value?.sha256 === artifact.sha256)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="panel attribution-runtime-boundary" aria-label="逐请求关键路径归因工件">
    <header class="panel-header">
      <div>
        <p class="section-kicker">{{ t("校准验证与指标归因模块") }}</p>
        <h2>{{ t("逐请求关键路径归因") }}</h2>
        <p>{{ t("仅展示后端 dense DES 的原因链和证据引用；共享批次时间不是可加总的独立资源成本。") }}</p>
      </div>
    </header>
    <div v-if="attributionFailure" class="callout callout--error" role="alert">
      <strong>{{ t("逐请求归因未生成") }}</strong>
      <p>
        <code>{{ attributionFailure.code }}</code>
      </p>
      <p>{{ t("请求 ID 重复，归因输入未通过校验。") }}</p>
      <p v-if="attributionFailure.path">
        {{ t("字段路径") }}：<code>{{ attributionFailure.path }}</code>
      </p>
      <p v-if="attributionFailure.cause">
        <code>{{ attributionFailure.cause }}</code>
      </p>
      <p>{{ attributionFailure.nextAction }}</p>
      <p>{{ t("当前 run 未产生逐请求归因工件；没有部分成功的原因链可供查看。") }}</p>
      <RouterLink class="button button--secondary" to="/experiment">{{ t("修改请求 ID 后重试") }}</RouterLink>
    </div>
    <p v-else-if="!artifactManifest" role="status">{{ t("没有可信工件清单，无法读取归因。") }}</p>
    <p v-else-if="rejected" role="alert">
      {{ t("归因工件被校验拒绝") }}：{{ rejected.reason }} · <code>{{ rejected.json_pointer }}</code>
    </p>
    <p v-else-if="!entry && declared?.state === 'unavailable'" role="status">
      {{ t("归因不可用") }}：{{ declared.detail || t("dense DES 的设备、网络或请求指标证据不足。") }}
    </p>
    <p v-else-if="!entry" role="status">
      {{ t("未请求逐请求归因。轻量运行缺少 dense DES 设备及网络证据；非运行时入口不适用。") }}
    </p>
    <template v-else>
      <p class="runtime-evidence-identity">
        {{ entry.content_status === "expected_absence" ? t("期望缺席描述符") : t("后端归因已生成") }} ·
        {{ entry.contract_status }} · <code>{{ entry.schema_identity }}</code> · {{ entry.bytes }} bytes · SHA-256
        <code>{{ entry.sha256 }}</code>
        <ArtifactEvidenceLink source-path="request-attribution:/" />
      </p>
      <p v-if="tooLarge" role="status">
        {{ t("工件超过 8 MB；此页不读取全文。请在原始证据查看器按需索引请求、原因链与证据引用。") }}
        <ArtifactEvidenceLink source-path="request-attribution:/requests/0" />
      </p>
      <button v-else type="button" class="button button--secondary" :disabled="loading" @click="load">
        {{ loading ? t("正在校验并读取…") : t("按需读取归因") }}
      </button>
      <p v-if="error" role="alert">{{ t("归因读取失败") }}：{{ error }}</p>
      <p v-if="payload?.state === 'expected_absence'" role="status">
        {{ label(payload.absence_reason) }} · {{ label(payload.detail) }}
      </p>
      <template v-else-if="payload && reports.length">
        <label class="runtime-evidence-controls">
          <span>{{ t("请求") }}</span>
          <select v-model="chosenRequestId">
            <option
              v-for="report in reports"
              :key="label(object(report).report_id)"
              :value="label(object(object(report).explained_entity).id)"
            >
              {{ label(object(object(report).explained_entity).id) }}
            </option>
          </select>
        </label>
        <p>
          {{ label(object(selected).symptom) }} · {{ t("原因段") }} {{ causes.length }} · {{ t("后端报告置信度") }}
          {{ label(object(selected).confidence) }}
          <ArtifactEvidenceLink :source-path="`request-attribution:/requests/${reports.indexOf(selected)}`" />
        </p>
        <div class="table-wrap runtime-evidence-table" role="region" :aria-label="t('逐请求原因链')" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>{{ t("时间范围 (ps)") }}</th>
                <th>{{ t("模块 / 原因") }}</th>
                <th>{{ t("后端证据引用") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(cause, index) in visibleRecords" :key="label(object(cause).cause_id)">
                <td>
                  <code>{{ label(object(cause).start_time_ps) }}–{{ label(object(cause).end_time_ps) }}</code>
                </td>
                <td>{{ label(object(cause).subsystem) }} · {{ label(object(cause).cause_code) }}</td>
                <td>
                  <code>{{ label(object(cause).evidence) }}</code>
                  <ArtifactEvidenceLink
                    :source-path="`request-attribution:/requests/${reports.indexOf(selected)}/cause_chain/${(page - 1) * 25 + index}/evidence_refs`"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <RecordPager v-if="pages > 1" v-model:page="page" :pages="pages" :label="t('逐请求原因链分页')" />
      </template>
    </template>
  </section>
</template>
