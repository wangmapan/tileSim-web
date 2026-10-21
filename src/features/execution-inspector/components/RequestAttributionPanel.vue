<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import RecordPager from "../../../components/ui/RecordPager.vue";
import { useRecordPage } from "../../../components/ui/useRecordPage";
import { isLosslessInteger, losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import type { RunReport } from "../../../contracts/report-model";
import type { ApiRun } from "../../../contracts/generated/bridge-contracts";
import { useI18n } from "../../../i18n";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../lib/api";
import { fetchVerifiedArtifact } from "../../run-evidence";
import { RouterLink } from "vue-router";
import { analyzeNetworkIntervals } from "../model/network-intervals";
import type { NetworkWaitInterval } from "../../../contracts/report-model";

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
const tooLarge = computed(() => {
  const bytes = entry.value?.bytes;
  return isLosslessInteger(bytes) && losslessIntegerToBigInt(bytes) > 8_000_000n;
});
const reports = computed(() => (Array.isArray(payload.value?.requests) ? payload.value.requests : []));
const requestedRequestId = computed(() => chosenRequestId.value || props.selectedRequestId || "");
const matchingReports = computed(() =>
  reports.value.filter(
    (item) =>
      object(object(item).explained_entity).kind === "request" &&
      object(object(item).explained_entity).id === requestedRequestId.value,
  ),
);
const selected = computed(() =>
  requestedRequestId.value && matchingReports.value.length === 1 ? matchingReports.value[0] : null,
);
const selectionIssue = computed(() => {
  if (!reports.value.length) return "empty";
  if (!requestedRequestId.value) return "missing";
  if (matchingReports.value.length > 1) return "duplicate";
  if (!matchingReports.value.length) return "missing";
  return "";
});
const causes = computed(() =>
  Array.isArray(object(selected.value).cause_chain) ? (object(selected.value).cause_chain as unknown[]) : [],
);
const { page, pages, visibleRecords } = useRecordPage(causes);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function intervals(value: unknown): unknown[] {
  const raw = object(value).network_intervals;
  return Array.isArray(raw) ? raw : [];
}
function intervalAnalysis(value: unknown) {
  return analyzeNetworkIntervals(intervals(value) as NetworkWaitInterval[]);
}
function label(value: unknown): string {
  return value === null || value === undefined ? t("未报告") : String(value);
}
function association(value: unknown): string {
  return value === null || value === undefined || value === "" ? t("未关联") : String(value);
}
watch([() => props.runId, () => entry.value?.sha256, () => props.selectedRequestId], () => {
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
      {{ t("未请求逐请求归因。") }}
      {{
        t(
          "Bridge contract gap：后端未提供 request_attribution_applicable；当前适用性保持未知，页面不会根据 TP、设备数或拓扑数量猜测。",
        )
      }}
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
      <p v-else-if="payload && !reports.length" class="callout callout--error" role="alert">
        <strong>{{ t("请求不存在/数据不可用") }}</strong>
        {{ t("归因报告为空，没有可安全展示的请求。") }}
      </p>
      <template v-else-if="payload && reports.length">
        <label class="runtime-evidence-controls">
          <span>{{ t("请求") }}</span>
          <select v-model="chosenRequestId">
            <option value="" disabled>{{ t("选择请求") }}</option>
            <option
              v-for="(report, reportIndex) in reports"
              :key="`${label(object(report).report_id)}-${label(object(object(report).explained_entity).id)}-${reportIndex}`"
              :value="label(object(object(report).explained_entity).id)"
            >
              {{ label(object(object(report).explained_entity).id) }}
            </option>
          </select>
        </label>
        <p v-if="selectionIssue" class="callout callout--error" role="alert">
          <strong>{{ t("请求不存在/数据不可用") }}</strong>
          <span v-if="selectionIssue === 'empty'">{{ t("归因报告为空，没有可安全展示的请求。") }}</span>
          <span v-else-if="selectionIssue === 'duplicate'">{{ t("请求 ID 重复，无法确定唯一归因报告。") }}</span>
          <span v-else>{{ t("请求 ID 缺失或不在归因报告中；已停止展示原因链。") }}</span>
        </p>
        <template v-else-if="selected">
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
                <template v-for="(cause, index) in visibleRecords" :key="`${label(object(cause).cause_id)}-${index}`">
                  <tr>
                    <td>
                      <code>{{ label(object(cause).start_time_ps) }}–{{ label(object(cause).end_time_ps) }}</code>
                    </td>
                    <td>
                      <div>{{ label(object(cause).subsystem) }} · {{ label(object(cause).cause_code) }}</div>
                      <small class="attribution-associations">
                        model call={{ association(object(cause).model_execution_call_id) }} · execution={{
                          association(object(cause).execution_id)
                        }}
                        · KV={{ association(object(cause).kv_operation_id) }} · network={{
                          association(object(cause).network_demand_id)
                        }}
                        · device={{ association(object(cause).device_task_id) }} · collective={{
                          association(object(cause).collective_id)
                        }}
                      </small>
                      <small class="attribution-associations">
                        PD handoff={{ association(object(cause).pd_handoff_id) }} · group={{
                          association(object(cause).pd_disaggregation_group_id)
                        }}
                        · placement={{ association(object(cause).pd_source_placement_group_id) }} →
                        {{ association(object(cause).pd_destination_placement_group_id) }}
                      </small>
                    </td>
                    <td>
                      <code>{{ label(object(cause).evidence) }}</code>
                      <ArtifactEvidenceLink
                        :source-path="`request-attribution:/requests/${reports.indexOf(selected)}/cause_chain/${(page - 1) * 25 + index}/evidence_refs`"
                      />
                    </td>
                  </tr>
                  <tr v-if="intervals(cause).length">
                    <td colspan="3">
                      <details class="network-intervals">
                        <summary>{{ t("网络区间（解释父级网络等待，不额外累加）") }}</summary>
                        <small
                          v-if="
                            intervalAnalysis(cause).overlapPairs ||
                            intervalAnalysis(cause).duplicateCount ||
                            intervalAnalysis(cause).invalid.length
                          "
                        >
                          {{ t("重叠/重复/无效区间仅作为解释记录，不重复计费") }} · overlap={{
                            intervalAnalysis(cause).overlapPairs
                          }}
                          · duplicate={{ intervalAnalysis(cause).duplicateCount }} · invalid={{
                            intervalAnalysis(cause).invalid.length
                          }}
                        </small>
                        <ul>
                          <li
                            v-for="(interval, intervalIndex) in intervals(cause)"
                            :key="`${label(object(interval).demand_id)}-${intervalIndex}`"
                          >
                            <code
                              >{{ label(object(interval).start_time_ps) }}–{{
                                label(object(interval).end_time_ps)
                              }}
                              ps</code
                            >
                            · {{ label(object(interval).component_code) }} · demand={{
                              label(object(interval).demand_id)
                            }}
                            · link={{ label(object(interval).link_id) }} · attempt={{ label(object(interval).attempt) }}
                            <span v-if="object(interval).unresolved_reason">
                              · {{ label(object(interval).unresolved_reason) }}</span
                            >
                            <ArtifactEvidenceLink
                              :source-path="`request-attribution:/requests/${reports.indexOf(selected)}/cause_chain/${(page - 1) * 25 + index}/network_intervals/${intervalIndex}`"
                            />
                          </li>
                        </ul>
                      </details>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <RecordPager v-if="pages > 1" v-model:page="page" :pages="pages" :label="t('逐请求原因链分页')" />
        </template>
      </template>
    </template>
  </section>
</template>
