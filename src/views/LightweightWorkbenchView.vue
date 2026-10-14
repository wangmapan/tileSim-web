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

    <section v-if="!hasExperiment" class="panel lightweight-empty ts-rise" aria-live="polite">
      <div class="lightweight-empty__icon" aria-hidden="true"><SlidersHorizontal :size="22" /></div>
      <div>
        <h2>{{ t("还没有实验，创建第一个实验") }}</h2>
      </div>
      <RouterLink class="button button--secondary" :to="{ name: 'lightweight_prepare', query }"
        >{{ t("创建第一个实验") }}<ArrowRight :size="16"
      /></RouterLink>
    </section>

    <ol v-if="!hasExperiment" class="lightweight-home__steps ts-stagger" aria-label="实验流程">
      <li>
        <span class="lightweight-home__step-index">01</span>
        <span><strong>配置实验</strong><small>选择场景与运行参数</small></span>
      </li>
      <li>
        <span class="lightweight-home__step-index">02</span>
        <span><strong>运行并观察</strong><small>跟踪阶段进度与执行状态</small></span>
      </li>
      <li>
        <span class="lightweight-home__step-index">03</span>
        <span><strong>分析结果</strong><small>整理重点并核对证据边界</small></span>
      </li>
    </ol>

    <section v-else class="lightweight-grid ts-stagger" data-help-anchor="lightweight-start-recent">
      <article class="panel lightweight-card ts-lift">
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
      <article class="panel lightweight-card ts-lift" data-help-anchor="lightweight-start-results">
        <p class="section-kicker">{{ t("结果摘要") }}</p>
        <template v-if="lightweight.reports.bundle || runStatus === 'completed'"
          ><h2>{{ t("结果可查看") }}</h2>
          <RouterLink class="button button--secondary" :to="resultsRoute">{{ t("查看结果摘要") }}</RouterLink></template
        ><template v-else
          ><h2>{{ t("完成一次运行后显示结果") }}</h2></template
        >
      </article>
    </section>

    <section class="lightweight-home__secondary ts-rise">
      <RouterLink class="panel lightweight-assist ts-lift" :to="professionalRoute"
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
  gap: 22px;
  max-width: 1080px;
}
.lightweight-home__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
  position: relative;
}
.lightweight-home__hero::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--accent),
    color-mix(in srgb, var(--accent) 12%, transparent) 56%,
    transparent
  );
  transform-origin: left;
  animation: lightweight-rule-in 700ms var(--ease-emphasized) backwards;
}
/* The heading is a page title, not a hero: at 46px it read as a landing page
   banner and pushed the actual work below the fold. */
.lightweight-home h1 {
  margin: 4px 0 0;
  font-size: clamp(22px, 2.4vw, 26px);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
}
.lightweight-home__cta {
  min-height: 40px;
  white-space: nowrap;
}
.lightweight-empty {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 26px;
  border-color: color-mix(in srgb, var(--accent) 22%, var(--line));
  background: color-mix(in srgb, var(--accent-soft) 52%, var(--panel));
  box-shadow: var(--shadow);
}
.lightweight-empty h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.012em;
}
.lightweight-empty__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-control);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  animation: lightweight-icon-in 500ms var(--ease-emphasized) 100ms backwards;
}
.lightweight-home__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: -4px 0 0;
  padding: 0;
  list-style: none;
  border-block: 1px solid var(--line);
}
.lightweight-home__steps li {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
  padding: 16px 18px;
}
.lightweight-home__steps li + li {
  border-left: 1px solid var(--line);
}
.lightweight-home__steps li > span:last-child {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.lightweight-home__step-index {
  color: var(--accent);
  font: 650 var(--text-xs) var(--font-mono);
  letter-spacing: 0.04em;
}
.lightweight-home__steps strong {
  font-size: var(--text-sm);
  font-weight: 650;
}
.lightweight-home__steps small {
  color: var(--muted);
  font-size: var(--text-xs);
  line-height: 1.45;
}
.lightweight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.lightweight-card {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 22px;
}
.lightweight-card h2 {
  margin: 5px 0 0;
  overflow-wrap: anywhere;
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
  font-weight: 600;
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
  background: var(--positive);
}
.status-dot[data-status="failed"] {
  background: var(--danger);
}
.status-dot[data-status="running"],
.status-dot[data-status="preparing"] {
  background: var(--warning);
  animation: lightweight-status-pulse 1.8s var(--ease-standard) infinite;
}
.text-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
.text-link:hover {
  color: var(--accent-hover);
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
@keyframes lightweight-rule-in {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}
@keyframes lightweight-icon-in {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.88);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes lightweight-status-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--warning) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--warning) 18%, transparent);
  }
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
  .lightweight-home__steps {
    grid-template-columns: 1fr;
  }
  .lightweight-home__steps li + li {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
  .lightweight-empty {
    justify-items: start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lightweight-home__hero::after,
  .lightweight-empty__icon,
  .status-dot[data-status="running"],
  .status-dot[data-status="preparing"] {
    animation: none;
  }
}
</style>
