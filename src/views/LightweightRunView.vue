<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowRight, RefreshCw } from "@lucide/vue";
import { RouterLink, useRoute } from "vue-router";
import { runExperiment } from "../features/run-experiment";
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
function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}
const runId = computed(() => {
  const candidate = firstString(route.params.runId) || firstString(route.query.run) || "";
  return /^run-[\w-]+$/.test(candidate) ? candidate : "";
});
const current = ref(store.run.value?.runId === runId.value ? store.run.value : null);
const loading = ref(true);
const error = ref("");
let timer: number | undefined;
const terminal = computed(() =>
  ["completed", "succeeded", "failed", "unavailable", "incomplete"].includes(current.value?.status || ""),
);
const label = computed(
  () =>
    ({
      preparing: t("准备中"),
      queued: t("排队中"),
      running: t("运行中"),
      completed: t("已完成"),
      succeeded: t("已完成"),
      failed: t("失败"),
      unavailable: t("服务不可用"),
      incomplete: t("结果不完整"),
    })[current.value?.status || ""] || t("等待状态"),
);
const statusDetail = computed(() => {
  const status = current.value?.status || "";
  return (
    {
      preparing: t("后端已接收请求，正在准备执行环境。"),
      queued: t("请求已进入队列；页面会继续读取后端状态。"),
      running: t("后端正在执行；不会显示前端估算的百分比或剩余时间。"),
      completed: t("运行已完成，可以读取真实报告和证据。"),
      succeeded: t("运行已完成，可以读取真实报告和证据。"),
      failed: t("后端返回失败；修正配置后可以重新提交。"),
      unavailable: t("当前无法从 Bridge 读取状态，请检查连接后重试。"),
      incomplete: t("运行结束但报告字段不完整；缺失内容不会被补成 0。"),
    }[status] || t("等待后端返回运行状态。")
  );
});
const pollingLabel = computed(() => (terminal.value ? t("已停止自动轮询（终态）") : t("每 5 秒读取一次后端状态")));
const query = computed(() => ({
  ...preserveWorkbenchQuery(route.query),
  ...(runId.value ? { run: runId.value } : {}),
}));

function context() {
  const identity = state.bridge.identity;
  return {
    backendRevision: [
      identity?.source_revision,
      identity?.build_revision,
      identity?.source_state_digest,
      identity?.build_state_digest,
      identity?.deployment_ref,
    ]
      .filter(Boolean)
      .join("|"),
    manifest: state.bridge.manifest,
  };
}

async function refresh() {
  if (!runId.value) {
    loading.value = false;
    return;
  }
  const requestedRunId = runId.value;
  loading.value = true;
  error.value = "";
  try {
    // A deep-linked child mounts before App.vue's onMounted bootstrap. Wait
    // for the shared manifest/schema bootstrap so status reads never fall
    // through to a legacy or context-free API path.
    const bridgeReady = await ensureBridgeReady();
    if (requestedRunId !== runId.value) return;
    if (!bridgeReady) {
      error.value = t("本地 Bridge 暂不可用，未读取运行状态。") as string;
      current.value = {
        runId: requestedRunId,
        runName: current.value?.runName || store.run.value?.runName || requestedRunId,
        payloadText: current.value?.payloadText || store.run.value?.payloadText || "",
        artifactSha256: current.value?.artifactSha256 || null,
        schemaSetRevision: current.value?.schemaSetRevision || null,
        backendIdentity: state.bridge.identity,
        requestedFidelity: current.value?.requestedFidelity || store.run.value?.requestedFidelity || null,
        resolvedFidelity: current.value?.resolvedFidelity || null,
        status: "unavailable",
        stage: current.value?.stage || null,
        error: error.value,
        startedAt: current.value?.startedAt || null,
        updatedAt: current.value?.updatedAt || null,
      };
      store.setRun(current.value);
      return;
    }
    const run = await runExperiment.getStatus(requestedRunId);
    if (requestedRunId !== runId.value) return;
    current.value = {
      runId: requestedRunId,
      runName: run.run_name || store.run.value?.runName || requestedRunId,
      payloadText: store.run.value?.payloadText || "",
      artifactSha256: null,
      schemaSetRevision: state.bridge.manifest?.schema_set_revision || null,
      backendIdentity: state.bridge.identity,
      requestedFidelity: run.fidelity_policy || store.run.value?.requestedFidelity || null,
      resolvedFidelity: null,
      status: run.status || "unavailable",
      stage: run.status || null,
      error: run.error || run.failure_code || null,
      startedAt: run.created_at || null,
      updatedAt: run.finished_at || new Date().toISOString(),
    };
    store.setRun(current.value);
    const status = current.value?.status || "";
    if (terminal.value && ["completed", "succeeded"].includes(status)) {
      const evidence = await fetchRunEvidence(requestedRunId, context());
      if (requestedRunId !== runId.value) return;
      store.setReports({
        bundle: normalizeApiReports(evidence.payload.reports),
        inputs: evidence.inputs,
        artifactManifest: evidence.artifactManifest,
      });
      const artifact =
        evidence.artifactManifest?.artifacts.find((entry) => entry.artifact_id === "run-result") ||
        evidence.artifactManifest?.artifacts[0];
      const resolved =
        store.reports.bundle?.run?.resolved_fidelity_profile?.entries?.find((entry) => entry.actual_fidelity)
          ?.actual_fidelity ||
        store.reports.bundle?.metrics?.resolution_entries?.find((entry) => entry.actual_fidelity)?.actual_fidelity ||
        null;
      store.updateRun({
        artifactSha256: artifact?.sha256 || null,
        schemaSetRevision: evidence.artifactManifest?.schema_set_revision || current.value?.schemaSetRevision,
        resolvedFidelity: resolved,
      });
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    if (!current.value)
      current.value = {
        runId: runId.value,
        runName: runId.value,
        payloadText: "",
        artifactSha256: null,
        schemaSetRevision: null,
        backendIdentity: state.bridge.identity,
        requestedFidelity: null,
        resolvedFidelity: null,
        status: "unavailable",
        stage: null,
        error: error.value,
        startedAt: null,
        updatedAt: null,
      };
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
  timer = window.setInterval(() => {
    if (!terminal.value) void refresh();
  }, 5000);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="lightweight-run" aria-labelledby="lightweight-run-title">
    <header class="lightweight-page__heading">
      <p class="section-kicker">{{ t("运行状态") }}</p>
      <h1 id="lightweight-run-title">{{ current?.runName || runId }}</h1>
    </header>
    <section v-if="loading && !current" class="panel lightweight-state" role="status">
      {{ t("正在读取运行状态…") }}
    </section>
    <section v-else class="panel lightweight-state" data-help-anchor="lightweight_run-status">
      <div class="lightweight-state__top">
        <div>
          <span class="status-badge" :data-status="current?.status">{{ label }}</span>
          <h2>
            {{
              current?.status === "failed"
                ? t("运行失败")
                : current?.status === "unavailable"
                  ? t("Bridge 不可用")
                  : current?.status === "incomplete"
                    ? t("结果不完整")
                    : label
            }}
          </h2>
        </div>
        <button class="button button--ghost" @click="refresh"><RefreshCw :size="15" />{{ t("刷新") }}</button>
      </div>
      <p v-if="current?.error" class="lightweight-error" role="alert">{{ current.error }}</p>
      <p class="lightweight-state__detail">{{ statusDetail }}</p>
      <dl class="lightweight-meta" data-help-anchor="lightweight_run-identity">
        <div>
          <dt>run ID</dt>
          <dd>
            <code>{{ runId }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ t("backend identity") }}</dt>
          <dd>
            {{
              current?.backendIdentity?.deployment_ref ||
              current?.backendIdentity?.build_revision ||
              current?.backendIdentity?.source_revision ||
              t("unavailable")
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t("requested fidelity") }}</dt>
          <dd>{{ current?.requestedFidelity || t("missing") }}</dd>
        </div>
        <div>
          <dt>{{ t("resolved fidelity") }}</dt>
          <dd>{{ current?.resolvedFidelity || t("后端完成后提供") }}</dd>
        </div>
        <div>
          <dt>{{ t("artifact SHA-256") }}</dt>
          <dd>
            <code>{{ current?.artifactSha256 || t("完成后从 manifest 读取") }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ t("schema revision") }}</dt>
          <dd>
            <code>{{ current?.schemaSetRevision || t("unavailable") }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ t("当前阶段") }}</dt>
          <dd>{{ current?.stage || t("状态等待更新") }}</dd>
        </div>
        <div>
          <dt>{{ t("更新时间") }}</dt>
          <dd>{{ current?.updatedAt || t("unavailable") }}</dd>
        </div>
      </dl>
      <p class="lightweight-polling" role="status" aria-live="polite">{{ pollingLabel }}</p>
      <div class="lightweight-state__actions" data-help-anchor="lightweight_run-actions">
        <RouterLink
          v-if="['completed', 'succeeded', 'incomplete'].includes(current?.status || '')"
          class="button button--primary"
          :to="{ name: 'lightweight_results', query }"
          >{{ t("查看结果") }}<ArrowRight :size="16" /></RouterLink
        ><RouterLink class="button button--secondary" :to="{ name: 'overview', query }">{{
          t("进入专业版")
        }}</RouterLink
        ><RouterLink
          v-if="['failed', 'unavailable', 'incomplete'].includes(current?.status || '')"
          class="button button--ghost"
          :to="{ name: 'lightweight_prepare', query }"
          >{{ t("重新配置") }}</RouterLink
        ><RouterLink class="text-link" :to="{ name: 'lightweight', query }">{{ t("返回工作台") }}</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lightweight-run {
  display: grid;
  gap: 20px;
  max-width: 980px;
}
.lightweight-state {
  display: grid;
  gap: 20px;
  padding: 24px;
}
.lightweight-state__top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-state h2 {
  margin: 10px 0 0;
}
.status-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  font-weight: 700;
}
.status-badge[data-status="failed"],
.status-badge[data-status="unavailable"],
.status-badge[data-status="incomplete"] {
  background: var(--danger-soft);
}
.status-badge[data-status="queued"],
.status-badge[data-status="preparing"],
.status-badge[data-status="running"] {
  background: var(--warning-soft);
}
.status-badge[data-status="completed"],
.status-badge[data-status="succeeded"] {
  background: var(--success-soft);
}
.lightweight-error {
  margin: 0;
  padding: 12px;
  border-left: 3px solid var(--danger);
  background: var(--danger-soft);
}
.lightweight-state__detail,
.lightweight-polling {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}
.lightweight-polling {
  padding-top: 2px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.lightweight-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 0;
}
.lightweight-meta div {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.lightweight-meta dt {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-meta dd {
  margin: 4px 0 0;
  font-weight: 650;
  word-break: break-word;
}
.lightweight-state__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.text-link {
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
@media (max-width: 760px) {
  .lightweight-meta {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .lightweight-state {
    padding: 18px;
  }
  .lightweight-state__top {
    align-items: flex-start;
    flex-direction: column;
  }
  .lightweight-meta {
    grid-template-columns: 1fr;
  }
}
</style>
