<script setup lang="ts">
import { computed, onMounted } from "vue";
import { ArrowRight, Play, SlidersHorizontal } from "@lucide/vue";
import { RouterLink, useRoute, type RouteLocationRaw } from "vue-router";
import { useDashboard } from "../store/dashboard";
import { useLightweightStore } from "../stores/lightweight";
import { useI18n } from "../i18n";
import { preserveWorkbenchQuery } from "../features/lightweight-workbench";

const { state, ensureBridgeReady, loadHistory } = useDashboard();
const lightweight = useLightweightStore();
const route = useRoute();
const { t } = useI18n();
const query = computed(() => preserveWorkbenchQuery(route.query));
const requestedRunId = computed(() => {
  const value = Array.isArray(route.query.run) ? route.query.run[0] : route.query.run;
  return typeof value === "string" && /^run-[\w-]+$/.test(value) ? value : "";
});
const recentRun = computed(() => {
  // A run query is an explicit identity handoff (for example when returning
  // from the professional workspace). Never let the generic "most recent"
  // fallback render a different run while history is still loading.
  if (requestedRunId.value) {
    if (lightweight.run.value?.runId === requestedRunId.value) return lightweight.run.value;
    return state.history.runs.find((run) => run.run_id === requestedRunId.value) || null;
  }
  return lightweight.run.value || state.history.runs[0] || null;
});
const hasExperiment = computed(() => Boolean(recentRun.value || requestedRunId.value));
const runId = computed<string>(
  () =>
    requestedRunId.value ||
    String((recentRun.value && "runId" in recentRun.value ? recentRun.value.runId : recentRun.value?.run_id) || ""),
);
const runName = computed(
  () =>
    (recentRun.value && "runName" in recentRun.value ? recentRun.value.runName : recentRun.value?.run_name) ||
    runId.value,
);
const runStatus = computed(() => recentRun.value?.status || "");
const fidelity = computed(
  () =>
    (recentRun.value && "requestedFidelity" in recentRun.value
      ? recentRun.value.requestedFidelity
      : recentRun.value?.fidelity_policy) || t("missing"),
);
const runRoute = computed<RouteLocationRaw>(() => ({
  name: "lightweight_run",
  params: { runId: String(runId.value) },
  query: query.value,
}));
const resultsRoute = computed<RouteLocationRaw>(() => ({
  name: "lightweight_results",
  query: { ...query.value, run: String(runId.value) },
}));
const professionalRoute = computed<RouteLocationRaw>(() => ({
  name: "overview",
  query: { ...query.value, ...(runId.value ? { run: runId.value } : {}) },
}));
onMounted(() => {
  // The child view mounts before App.vue's bootstrap hook.  Wait on the
  // shared readiness gate so a fresh lightweight landing page can restore
  // recent runs instead of silently showing the empty state.
  void (async () => {
    if (await ensureBridgeReady()) await loadHistory({ quiet: true });
  })();
});
const statusLabel = (status: string | undefined) =>
  ({
    preparing: t("准备中"),
    queued: t("排队中"),
    running: t("运行中"),
    completed: t("已完成"),
    succeeded: t("已完成"),
    failed: t("失败"),
    unavailable: t("服务不可用"),
    incomplete: t("结果不完整"),
  })[status || ""] || t("尚无运行");
</script>

<template>
  <div class="lightweight-home" aria-labelledby="lightweight-home-title">
    <header class="lightweight-home__hero" data-help-anchor="lightweight-start-primary">
      <div>
        <p class="section-kicker">{{ t("轻量工作台") }}</p>
        <h1 id="lightweight-home-title">{{ t("开始或继续一次实验") }}</h1>
      </div>
      <RouterLink class="button button--primary lightweight-home__cta" :to="{ name: 'lightweight_prepare', query }"
        ><Play :size="18" />{{ t("新建实验") }}</RouterLink
      >
    </header>

    <section v-if="!hasExperiment" class="panel lightweight-empty" aria-live="polite">
      <div class="lightweight-empty__icon" aria-hidden="true"><SlidersHorizontal :size="24" /></div>
      <div>
        <h2>{{ t("还没有实验，创建第一个实验") }}</h2>
      </div>
      <RouterLink class="button button--secondary" :to="{ name: 'lightweight_prepare', query }"
        >{{ t("创建第一个实验") }}<ArrowRight :size="16"
      /></RouterLink>
    </section>

    <section v-else class="lightweight-grid" data-help-anchor="lightweight-start-recent">
      <article class="panel lightweight-card">
        <header>
          <p class="section-kicker">{{ t("当前实验 / 最近运行") }}</p>
          <h2>{{ runName }}</h2>
        </header>
        <dl>
          <div>
            <dt>{{ t("状态") }}</dt>
            <dd><span class="status-dot" :data-status="runStatus"></span>{{ statusLabel(runStatus) }}</dd>
          </div>
          <div>
            <dt>run ID</dt>
            <dd>
              <code>{{ runId }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("requested fidelity") }}</dt>
            <dd>{{ fidelity }}</dd>
          </div>
        </dl>
        <RouterLink class="text-link" :to="runRoute">{{ t("查看真实运行状态") }} <ArrowRight :size="15" /></RouterLink>
      </article>
      <article class="panel lightweight-card" data-help-anchor="lightweight-start-results">
        <p class="section-kicker">{{ t("结果摘要") }}</p>
        <template v-if="lightweight.reports.bundle || runStatus === 'completed'"
          ><h2>{{ t("结果可查看") }}</h2>
          <RouterLink class="button button--secondary" :to="resultsRoute">{{ t("查看结果摘要") }}</RouterLink></template
        ><template v-else
          ><h2>{{ t("完成一次运行后显示结果") }}</h2></template
        >
      </article>
    </section>

    <section class="lightweight-home__secondary">
      <RouterLink class="panel lightweight-assist" :to="professionalRoute"
        ><SlidersHorizontal :size="20" /><span
          ><strong>{{ t("进入专业版") }}</strong></span
        ><ArrowRight :size="16"
      /></RouterLink>
    </section>
  </div>
</template>

<style scoped>
.lightweight-home {
  display: grid;
  gap: 28px;
  max-width: 1080px;
}
.lightweight-home__hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.lightweight-home h1 {
  margin: 6px 0 10px;
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.1;
}
.lightweight-home__cta {
  min-height: 48px;
  white-space: nowrap;
}
.lightweight-empty {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  padding: 24px 26px;
  border-left: 3px solid var(--accent);
}
.lightweight-empty h2 {
  margin: 0;
}
.lightweight-empty__icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  color: var(--accent);
}
.lightweight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.lightweight-card {
  display: grid;
  gap: 16px;
  padding: 22px;
}
.lightweight-card h2 {
  margin: 5px 0 0;
}
.lightweight-card p {
  color: var(--muted);
}
.lightweight-card dl {
  display: grid;
  gap: 12px;
  margin: 0;
}
.lightweight-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.lightweight-card dt {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-card dd {
  margin: 0;
  font-weight: 650;
}
.status-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 7px;
  border-radius: 50%;
  background: var(--muted);
}
.status-dot[data-status="completed"] {
  background: var(--success);
}
.status-dot[data-status="failed"] {
  background: var(--danger);
}
.status-dot[data-status="running"],
.status-dot[data-status="preparing"] {
  background: var(--warning);
}
.text-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
.lightweight-home__secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.lightweight-assist {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  color: inherit;
  text-decoration: none;
}
.lightweight-assist span {
  display: grid;
  gap: 3px;
  flex: 1;
}
.lightweight-assist small {
  color: var(--muted);
}
@media (max-width: 760px) {
  .lightweight-home__hero {
    align-items: stretch;
    flex-direction: column;
  }
  .lightweight-empty,
  .lightweight-grid,
  .lightweight-home__secondary {
    grid-template-columns: 1fr;
  }
  .lightweight-empty {
    justify-items: start;
  }
}
</style>
