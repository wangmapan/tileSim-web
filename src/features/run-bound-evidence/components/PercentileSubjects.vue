<script setup lang="ts">
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { useI18n } from "../../../i18n";
import { formatNumber } from "../../../lib/format";
import type { PercentileNavigation } from "../types";

defineProps<{ subjects: PercentileNavigation[]; selectedRequestId: string | null }>();
const emit = defineEmits<{ requestSelected: [requestId: string] }>();
const { t } = useI18n();
const metricLabels = { ttft_ps: "TTFT", tpot_ps: "TPOT", end_to_end_latency_ps: "端到端延迟" };
const selectionLabels = {
  single_request: "单个请求",
  tie_no_single_request: "并列请求",
  not_applicable: "不适用",
};
function canNavigate(subject: PercentileNavigation, member: string) {
  return (
    subject.semantics === "single_request" &&
    subject.availability === "available" &&
    subject.selectedRequestId === member
  );
}
</script>

<template>
  <section v-if="subjects.length" class="percentile-subjects" :aria-label="t('后端选择的 P99 对象')">
    <header>
      <h3>{{ t("后端选择的 P99 对象") }}</h3>
      <p>{{ t("请求关联以报告记录为准。") }}</p>
    </header>
    <div class="percentile-table-scroll" role="region" :aria-label="t('P99 请求关联表')" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">{{ t("指标") }}</th>
            <th scope="col" class="percentile-value">P99 (ps)</th>
            <th scope="col">{{ t("关联请求") }}</th>
            <th scope="col">{{ t("选择与校验") }}</th>
            <th scope="col">{{ t("证据") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="subject in subjects" :key="subject.key">
            <th scope="row">{{ t(metricLabels[subject.metricKind] || subject.metricKind) }}</th>
            <td class="percentile-value">{{ formatNumber(subject.valuePs) }}</td>
            <td>
              <ul v-if="subject.memberRequestIds.length" class="percentile-members">
                <li v-for="member in subject.memberRequestIds" :key="member">
                  <button
                    v-if="canNavigate(subject, member)"
                    type="button"
                    :aria-current="member === selectedRequestId ? 'true' : undefined"
                    @click="emit('requestSelected', member)"
                  >
                    {{ member }}
                  </button>
                  <code v-else>{{ member }}</code>
                  <span v-if="member === selectedRequestId">{{ t("当前请求") }}</span>
                </li>
              </ul>
              <span v-else class="percentile-unavailable">{{ t("无关联请求") }}</span>
            </td>
            <td>
              <p v-if="!['available', 'not_applicable'].includes(subject.availability)" class="percentile-warning">
                {{ t("关联未通过校验") }}
              </p>
              <details>
                <summary>{{ t(selectionLabels[subject.semantics] || subject.semantics) }}</summary>
                <dl>
                  <dt>{{ t("指标字段") }}</dt>
                  <dd>
                    <code>{{ subject.metricKind }}</code>
                  </dd>
                  <dt>{{ t("选择语义") }}</dt>
                  <dd>
                    <code>{{ subject.semantics }}</code>
                  </dd>
                  <dt>{{ t("选择规则") }}</dt>
                  <dd>
                    <code>{{ subject.selectionRule }}</code>
                  </dd>
                  <dt>{{ t("校验结果") }}</dt>
                  <dd>
                    {{ t(subject.detail) }} <code>{{ subject.availability }}</code>
                  </dd>
                </dl>
              </details>
            </td>
            <td>
              <ArtifactEvidenceLink
                v-if="subject.reference"
                :source-path="subject.reference.sourcePath"
                :label="t('原始记录')"
              />
              <span v-else class="percentile-unavailable">{{ t("引用不可用") }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.percentile-subjects {
  margin: 0 22px 24px;
}
.percentile-subjects > header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 20px;
  margin-bottom: 12px;
}
.percentile-subjects h3 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
}
.percentile-subjects header p {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
}
.percentile-table-scroll {
  overflow-x: auto;
}
.percentile-table-scroll:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
table {
  width: 100%;
  min-width: 640px;
  table-layout: fixed;
  border-collapse: collapse;
}
th,
td {
  padding: 13px 12px;
  vertical-align: top;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
  overflow-wrap: anywhere;
  font-size: var(--text-xs);
}
thead th {
  padding-top: 0;
  color: var(--muted);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
thead th:first-child {
  width: 16%;
}
thead th:nth-child(2) {
  width: 22%;
}
thead th:nth-child(3) {
  width: 28%;
}
thead th:nth-child(4) {
  width: 22%;
}
thead th:last-child {
  width: 12%;
}
th:first-child,
td:first-child {
  padding-left: 0;
}
th:last-child,
td:last-child {
  padding-right: 0;
}
tbody th {
  font-weight: 500;
}
tbody tr:last-child td {
  border-bottom: 1px solid var(--line);
}
tr:hover {
  background: transparent;
}
.percentile-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
td.percentile-value {
  font-family: var(--font-mono);
}
.percentile-members {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.percentile-members li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.percentile-members button {
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--accent-hover);
  background: transparent;
  font: inherit;
  font-family: var(--font-mono);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--line-strong);
  cursor: pointer;
  overflow-wrap: anywhere;
  text-align: left;
}
.percentile-members button:hover {
  text-decoration-color: currentColor;
}
.percentile-members span,
.percentile-unavailable {
  color: var(--muted);
  font-size: var(--text-micro);
}
summary {
  cursor: pointer;
}
dl {
  margin: 10px 0 0;
}
dt {
  margin-top: 8px;
  color: var(--muted);
}
dd {
  margin: 0;
}
code {
  padding: 0;
  background: none;
  font-size: var(--text-micro);
  white-space: normal;
}
.percentile-warning {
  margin: 0 0 5px;
  color: var(--warning-ink);
}
:deep(.artifact-evidence-link) {
  font-weight: 400;
}
</style>
