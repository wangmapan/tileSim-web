<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRight } from "@lucide/vue";
import { RouterLink, useRoute } from "vue-router";
import { fetchRunEvidence } from "../features/run-evidence";
import { normalizeApiReports } from "../lib/reports";
import { useDashboard } from "../store/dashboard";
import { useLightweightStore } from "../stores/lightweight";
import { useI18n } from "../i18n";
import { preserveWorkbenchQuery } from "../features/lightweight-workbench";

const route = useRoute();
const { state, ensureBridgeReady } = useDashboard();
const store = useLightweightStore();
const { t } = useI18n();
const runId = computed(() => {
  const value = Array.isArray(route.query.run) ? route.query.run[0] : route.query.run;
  if (typeof value === "string") return /^run-[\w-]+$/.test(value) ? value : "";
  return store.run.value?.runId || "";
});
const loading = ref(false);
const error = ref("");
const loadedEvidenceRunId = ref<string | null>(store.reports.bundle ? store.run.value?.runId || null : null);
const bundle = computed(() => store.reports.bundle);
const metrics = computed(() => bundle.value?.metrics);
const runReport = computed(() => bundle.value?.run);
const summary = computed(() => runReport.value?.summary || {});
const domains = computed(() => metrics.value?.system_summary?.fabric_domain_utilization || []);
const stages = computed(() => bundle.value?.execution_envelope?.stages || []);
const artifacts = computed(() => store.reports.artifactManifest?.artifacts || []);
const rejectedArtifacts = computed(() => store.reports.artifactManifest?.rejected_artifacts || []);
const expectedSchemaRevision = computed(() => {
  const value = Array.isArray(route.query.schema_set_revision)
    ? route.query.schema_set_revision[0]
    : route.query.schema_set_revision;
  return typeof value === "string" && value ? value : store.run.value?.schemaSetRevision || null;
});
const expectedArtifactSha = computed(() => {
  const value = Array.isArray(route.query.artifact_sha256)
    ? route.query.artifact_sha256[0]
    : route.query.artifact_sha256;
  return typeof value === "string" && value ? value.toLowerCase() : null;
});
const hasUnsupportedArtifact = computed(() =>
  artifacts.value.some((artifact) => !["supported", "not_applicable"].includes(artifact.contract_status)),
);
const hasVerifiedArtifact = computed(() =>
  artifacts.value.some((artifact) => artifact.contract_status === "supported"),
);
const staleManifest = computed(() => {
  const expected = expectedSchemaRevision.value;
  const actual = store.reports.artifactManifest?.schema_set_revision;
  const manifestRunId = store.reports.artifactManifest?.run_id;
  const runMismatch = Boolean(runId.value && manifestRunId && manifestRunId !== runId.value);
  const schemaMismatch = Boolean(expected && actual && expected !== actual);
  const reportRunIds = [
    (runReport.value as (typeof runReport.value & { run_id?: string }) | null)?.run_id,
    (metrics.value as (typeof metrics.value & { run_id?: string }) | null)?.run_id,
  ].filter((value): value is string => Boolean(value));
  const reportRunMismatch = reportRunIds.some((value) => value !== runId.value);
  const artifactMismatch = Boolean(
    expectedArtifactSha.value &&
    artifacts.value.length &&
    !artifacts.value.some((artifact) => {
      const sha = String(artifact.sha256).toLowerCase();
      return sha === expectedArtifactSha.value || `sha256:${sha}` === expectedArtifactSha.value;
    }),
  );
  return runMismatch || schemaMismatch || artifactMismatch || reportRunMismatch;
});
const hasCurrentBundle = computed(() =>
  Boolean(
    bundle.value &&
    runId.value &&
    (store.reports.artifactManifest?.run_id === runId.value ||
      (!store.reports.artifactManifest && loadedEvidenceRunId.value === runId.value)),
  ),
);
const resolvedFidelity = computed(
  () =>
    runReport.value?.resolved_fidelity_profile?.entries
      ?.map((entry) => entry.actual_fidelity)
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" · ") || t("后端未提供"),
);
const resultState = computed<string>(() => {
  if (staleManifest.value) return "stale";
  if (rejectedArtifacts.value.length || hasUnsupportedArtifact.value) return "unsupported_schema";
  if (!runReport.value) return "missing";
  if (["failed", "unavailable", "incomplete"].includes(runReport.value.status || "")) {
    return runReport.value.status || "incomplete";
  }
  return "available";
});
const resultStateLabel = computed(
  () =>
    (
      ({
        available: t("可用"),
        missing: t("missing"),
        unsupported_schema: t("unsupported schema"),
        stale: t("stale"),
        incomplete: t("结果不完整"),
        failed: t("运行失败"),
        unavailable: t("服务不可用"),
      }) as Record<string, string>
    )[resultState.value] || resultState.value,
);
const chartAvailable = computed(
  () => resultState.value === "available" && hasVerifiedArtifact.value && domains.value.length > 0,
);
const chartBoundary = computed(() => {
  if (resultState.value === "stale") return t("报告身份已过期或与当前 run 不一致，未生成可用图表。");
  if (resultState.value === "unsupported_schema") return t("报告 schema 不受支持，未生成可用图表。");
  if (!hasVerifiedArtifact.value) return t("缺少已验证 artifact manifest，未生成演示图表。");
  return t("该报告没有逐域利用率字段（missing / not covered），未生成演示图表。");
});
function display(value: unknown, unit = "") {
  if (value === undefined || value === null || value === "") return t("missing");
  return `${String(value)}${unit ? ` ${unit}` : ""}`;
}
function context() {
  const i = state.bridge.identity;
  return {
    backendRevision: [
      i?.source_revision,
      i?.build_revision,
      i?.source_state_digest,
      i?.build_state_digest,
      i?.deployment_ref,
    ]
      .filter(Boolean)
      .join("|"),
    manifest: state.bridge.manifest,
  };
}
let evidenceRequestSequence = 0;
async function loadEvidence() {
  const requestSequence = ++evidenceRequestSequence;
  error.value = "";
  if (!runId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const bridgeReady = await ensureBridgeReady();
  if (requestSequence !== evidenceRequestSequence) return;
  if (!bridgeReady) {
    error.value = t("本地 Bridge 暂不可用，未读取真实报告。") as string;
    loading.value = false;
    return;
  }
  const manifestRunId = store.reports.artifactManifest?.run_id;
  // A report bundle is only reusable when its verified manifest is bound to
  // the run in the current URL. This prevents a route change from displaying
  // the previous run's cached Pinia report.
  if (bundle.value && manifestRunId === runId.value) {
    loadedEvidenceRunId.value = runId.value;
    loading.value = false;
    return;
  }
  if (bundle.value && !manifestRunId && loadedEvidenceRunId.value === runId.value) {
    loading.value = false;
    return;
  }
  loadedEvidenceRunId.value = null;
  try {
    const evidence = await fetchRunEvidence(runId.value, context());
    if (requestSequence !== evidenceRequestSequence) return;
    store.setReports({
      bundle: normalizeApiReports(evidence.payload.reports),
      inputs: evidence.inputs,
      artifactManifest: evidence.artifactManifest,
    });
    loadedEvidenceRunId.value = runId.value;
  } catch (e) {
    if (requestSequence !== evidenceRequestSequence) return;
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (requestSequence === evidenceRequestSequence) loading.value = false;
  }
}
watch(() => route.fullPath, loadEvidence, { immediate: true });
</script>

<template>
  <div class="lightweight-results" aria-labelledby="lightweight-results-title">
    <header class="lightweight-page__heading">
      <p class="section-kicker">{{ t("结果摘要") }}</p>
      <h1 id="lightweight-results-title">{{ runId || t("尚无运行") }}</h1>
    </header>
    <section v-if="loading" class="panel lightweight-result-state" role="status">{{ t("正在读取真实报告…") }}</section>
    <section v-else-if="error" class="panel lightweight-result-state lightweight-result-state--error" role="alert">
      <strong>{{ t("结果暂不可用") }}</strong
      ><span>{{ error }}</span>
    </section>
    <template v-else-if="hasCurrentBundle"
      ><section class="panel lightweight-result-state" data-help-anchor="lightweight_results-summary">
        <div>
          <span class="status-badge" :data-status="resultState">{{ resultStateLabel }}</span>
          <h2>
            {{
              ["completed", "succeeded", "success"].includes(runReport?.status || "")
                ? t("运行成功")
                : t("结果状态待确认")
            }}
          </h2>
        </div>
        <dl class="lightweight-metrics">
          <div>
            <dt>{{ t("端到端延迟") }}</dt>
            <dd>{{ display(summary.end_to_end_latency_us, "µs") }}</dd>
            <small>run.summary.end_to_end_latency_us</small>
          </div>
          <div>
            <dt>{{ t("吞吐") }}</dt>
            <dd>{{ display(metrics?.summary?.throughput_requests_per_second, "req/s") }}</dd>
            <small>metrics.summary.throughput_requests_per_second</small>
          </div>
          <div>
            <dt>TTFT</dt>
            <dd>{{ display(metrics?.tail_latency_summary?.ttft_ps?.p95_ps, "ps") }}</dd>
            <small>metrics.tail_latency_summary.ttft_ps.p95_ps</small>
          </div>
          <div>
            <dt>TPOT</dt>
            <dd>{{ display(metrics?.tail_latency_summary?.tpot_ps?.p95_ps, "ps") }}</dd>
            <small>metrics.tail_latency_summary.tpot_ps.p95_ps</small>
          </div>
          <div>
            <dt>{{ t("资源利用率") }}</dt>
            <dd>
              {{
                display(
                  metrics?.system_summary?.fabric_utilization_ratio == null
                    ? null
                    : `${(metrics.system_summary.fabric_utilization_ratio * 100).toFixed(1)}%`,
                )
              }}
            </dd>
            <small>metrics.system_summary.fabric_utilization_ratio</small>
          </div>
          <div>
            <dt>{{ t("主要瓶颈") }}</dt>
            <dd>{{ runReport?.bottleneck_report?.primary_subsystem || t("unavailable") }}</dd>
            <small>run.bottleneck_report.primary_subsystem</small>
          </div>
        </dl>
        <div class="lightweight-provenance">
          <span
            >{{ t("Trace") }} <code>{{ runReport?.summary?.trace_name || t("missing") }}</code></span
          >
          <span
            >{{ t("来源") }} <code>{{ metrics?.trace_provenance?.source_mode || t("missing") }}</code></span
          >
          <span
            >{{ t("fidelity") }} <code>{{ resolvedFidelity }}</code></span
          >
          <span
            >{{ t("证据层级") }} <code>{{ metrics?.evidence_tier || t("unavailable") }}</code></span
          >
          <span
            >{{ t("数据通道") }} <code>{{ metrics?.metric_lane || t("unavailable") }}</code></span
          >
        </div>
      </section>
      <section class="panel lightweight-chart" data-help-anchor="lightweight_results-chart">
        <header>
          <div>
            <p class="section-kicker">{{ t("必要图表") }}</p>
            <h2>{{ t("通信域利用率（%）") }}</h2>
          </div>
          <span>{{ t("metrics.system_summary.fabric_domain_utilization · 后端字段") }}</span>
        </header>
        <div v-if="chartAvailable" class="bar-list">
          <div v-for="domain in domains" :key="String(domain.domain_id)" class="bar-row">
            <span>{{ domain.domain_id || t("未命名域") }}</span>
            <div class="bar-track">
              <i
                v-if="domain.utilization_ratio != null"
                :style="{ width: `${Math.max(0, Math.min(100, Number(domain.utilization_ratio) * 100))}%` }"
              ></i>
              <span v-else class="bar-missing">{{ t("missing") }}</span>
            </div>
            <strong>{{
              domain.utilization_ratio == null
                ? t("missing")
                : `${(Number(domain.utilization_ratio) * 100).toFixed(1)}%`
            }}</strong>
          </div>
        </div>
        <div v-else class="lightweight-missing">
          {{ chartBoundary }}
        </div>
      </section>
      <section class="panel lightweight-timeline">
        <header>
          <div>
            <p class="section-kicker">{{ t("执行阶段时间线") }}</p>
            <h2>{{ t("后端报告阶段") }}</h2>
          </div>
          <span>{{ t("execution envelope") }}</span>
        </header>
        <ol v-if="stages.length">
          <li v-for="stage in stages" :key="stage.stage_id">
            <strong>{{ stage.stage_id }}</strong
            ><span>{{ stage.subsystem || t("未标注模块") }} · {{ stage.stage_kind || t("阶段") }}</span
            ><small>{{ stage.detail || t("无阶段说明") }}</small>
          </li>
        </ol>
        <div v-else class="lightweight-missing">
          {{ t("报告未提供 execution envelope 阶段（missing / not covered）。") }}
        </div>
      </section>
      <section class="panel lightweight-integrity" data-help-anchor="lightweight_results-integrity">
        <header>
          <div>
            <p class="section-kicker">{{ t("证据索引") }}</p>
            <h2>{{ t("报告与 schema 身份") }}</h2>
          </div>
          <span>{{ artifacts.length ? t("manifest 已验证") : t("manifest missing") }}</span>
        </header>
        <dl class="lightweight-integrity__grid">
          <div>
            <dt>run ID</dt>
            <dd>
              <code>{{ runId }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("schema revision") }}</dt>
            <dd>
              <code>{{ store.reports.artifactManifest?.schema_set_revision || t("missing") }}</code>
            </dd>
          </div>
          <div v-for="artifact in artifacts" :key="artifact.artifact_id" class="lightweight-integrity__artifact">
            <dt>{{ artifact.artifact_id }} · {{ artifact.contract_status }}</dt>
            <dd>
              <code>{{ artifact.sha256 }}</code>
            </dd>
          </div>
        </dl>
        <p v-if="rejectedArtifacts.length" class="lightweight-integrity__warning" role="alert">
          {{ t("存在被拒绝或旧 schema artifact；相关字段不会被展示为可用结果。") }}
        </p>
      </section>
      <section class="lightweight-result-actions">
        <RouterLink
          class="button button--secondary"
          :to="{ name: 'overview', query: preserveWorkbenchQuery(route.query) }"
          >{{ t("进入专业版查看完整细节") }}<ArrowRight :size="16" /></RouterLink
        ><RouterLink
          class="text-link"
          :to="{ name: 'lightweight_run', params: { runId }, query: preserveWorkbenchQuery(route.query) }"
          >{{ t("返回运行状态") }}</RouterLink
        >
      </section></template
    >
    <section v-else class="panel lightweight-result-state">
      <h2>{{ t("尚无可用结果") }}</h2>
    </section>
  </div>
</template>

<style scoped>
.lightweight-results {
  display: grid;
  gap: 20px;
  max-width: 1080px;
}
.lightweight-result-state,
.lightweight-chart {
  display: grid;
  gap: 18px;
  padding: 24px;
}
.lightweight-result-state--error {
  border-left: 3px solid var(--danger);
}
.status-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--success-soft);
  font-weight: 700;
}
.status-badge[data-status="failed"],
.status-badge[data-status="unavailable"],
.status-badge[data-status="incomplete"],
.status-badge[data-status="unsupported_schema"],
.status-badge[data-status="stale"] {
  background: var(--danger-soft);
}
.status-badge[data-status="missing"] {
  background: var(--warning-soft);
}
.lightweight-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 0;
}
.lightweight-metrics div {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.lightweight-metrics dt {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-metrics dd {
  margin: 5px 0 2px;
  font-size: 20px;
  font-weight: 750;
}
.lightweight-metrics small {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.lightweight-provenance {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-provenance span {
  display: inline-flex;
  gap: 5px;
  align-items: baseline;
}
.lightweight-provenance code {
  color: var(--ink-soft);
  font-size: var(--text-xs);
}
.lightweight-chart header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-timeline {
  display: grid;
  gap: 16px;
  padding: 24px;
}
.lightweight-timeline header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-timeline h2 {
  margin: 5px 0 0;
}
.lightweight-timeline ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 22px;
}
.lightweight-timeline li {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-left: 2px solid var(--accent);
  background: var(--surface-subtle);
}
.lightweight-timeline li span,
.lightweight-timeline li small,
.lightweight-timeline header > span {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-chart h2 {
  margin: 5px 0 0;
}
.lightweight-chart header > span {
  color: var(--muted);
  font-size: var(--text-sm);
}
.bar-list {
  display: grid;
  gap: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 130px 1fr 70px;
  align-items: center;
  gap: 10px;
}
.bar-track {
  height: 10px;
  background: var(--surface-subtle);
  border-radius: 99px;
  overflow: hidden;
}
.bar-track i {
  display: block;
  height: 100%;
  background: var(--accent);
}
.bar-missing {
  display: block;
  padding: 0 6px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.bar-row strong {
  text-align: right;
  font-size: var(--text-sm);
}
.lightweight-missing {
  padding: 18px;
  border: 1px dashed var(--line-strong);
  color: var(--muted);
}
.lightweight-integrity {
  display: grid;
  gap: 16px;
  padding: 20px 24px;
}
.lightweight-integrity header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-integrity h2 {
  margin: 5px 0 0;
}
.lightweight-integrity header > span {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-integrity__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 0;
}
.lightweight-integrity__grid div {
  min-width: 0;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}
.lightweight-integrity__grid dt {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-integrity__grid dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.lightweight-integrity__artifact {
  grid-column: 1 / -1;
}
.lightweight-integrity__warning {
  margin: 0;
  padding: 10px 12px;
  color: var(--warning-ink);
  background: var(--warning-soft);
  font-size: var(--text-sm);
}
.lightweight-result-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.text-link {
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
@media (max-width: 760px) {
  .lightweight-metrics {
    grid-template-columns: 1fr 1fr;
  }
  .bar-row {
    grid-template-columns: 90px 1fr 60px;
  }
  .lightweight-integrity__grid {
    grid-template-columns: 1fr;
  }
}
</style>
