<script setup lang="ts">
import { ArrowRight, Compass, SlidersHorizontal } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  emitLightweightTelemetry,
  persistWorkbenchMode,
  readWorkbenchMode,
  type WorkbenchMode,
} from "../features/lightweight-workbench";
import { useI18n } from "../i18n";

const route = useRoute();
const { t } = useI18n();
const recentMode = ref<WorkbenchMode | null>(readWorkbenchMode());

onMounted(() => emitLightweightTelemetry("workbench_choice_viewed"));

const carriedQuery = computed(() => {
  const query: Record<string, string> = {};
  const run = typeof route.query.run === "string" ? route.query.run : "";
  if (/^run-[\w-]+$/.test(run)) query.run = run;
  for (const key of ["artifact_sha256", "schema_set_revision", "from"]) {
    const value = route.query[key];
    if (typeof value === "string" && value) query[key] = value;
  }
  return query;
});

function choose(mode: WorkbenchMode): void {
  persistWorkbenchMode(mode);
  recentMode.value = mode;
  emitLightweightTelemetry("workbench_selected", { mode, source: "root" });
}

const recentLabel = computed(() => {
  if (!recentMode.value) return "";
  return t(`上次使用：${recentMode.value === "lightweight" ? "轻量版" : "专业版"}`);
});
</script>

<template>
  <main class="workbench-entry" aria-labelledby="workbench-entry-title">
    <div class="workbench-entry__inner">
      <div class="workbench-entry__bar">
        <span class="workbench-entry__wordmark" aria-hidden="true">T</span>
        <span class="workbench-entry__product">
          <strong>TileSim</strong>
          <small>{{ t("TileSim 仿真实验台") }}</small>
        </span>
      </div>

      <header class="workbench-entry__header">
        <h1 id="workbench-entry-title">{{ t("选择适合你的工作台") }}</h1>
        <p class="workbench-entry__lede">
          {{ t("两种工作台共享同一套仿真事实和公开能力，但使用不同的信息组织方式。之后可以随时切换。") }}
        </p>
        <p v-if="recentLabel" class="workbench-entry__recent" role="status" aria-live="polite">
          <span class="workbench-entry__recent-dot" aria-hidden="true"></span>{{ recentLabel }}
        </p>
      </header>

      <section class="workbench-entry__choices ts-stagger" :aria-label="t('工作台选择')">
        <article class="workbench-choice-card ts-lift">
          <div class="workbench-choice-card__icon" aria-hidden="true"><Compass :size="19" /></div>
          <div class="workbench-choice-card__content">
            <div>
              <p class="workbench-choice-card__kicker">{{ t("适合刚开始接触 TileSim 的用户") }}</p>
              <h2>{{ t("轻量版") }}</h2>
            </div>
            <dl class="workbench-choice-card__details">
              <div>
                <dt>{{ t("可以完成") }}</dt>
                <dd>{{ t("创建实验、提交正式 run、查看运行状态和结果摘要。") }}</dd>
              </div>
              <div>
                <dt>{{ t("正式运行") }}</dt>
                <dd>{{ t("支持在当前公开能力范围内创建正式 run；Agent 仍不能越权提交。") }}</dd>
              </div>
            </dl>
          </div>
          <RouterLink
            class="workbench-choice-card__action button button--primary"
            :to="{ name: 'lightweight', query: carriedQuery }"
            @click="choose('lightweight')"
          >
            {{ t("进入轻量版") }} <ArrowRight :size="16" aria-hidden="true" />
          </RouterLink>
        </article>

        <article class="workbench-choice-card ts-lift">
          <div class="workbench-choice-card__icon" aria-hidden="true"><SlidersHorizontal :size="19" /></div>
          <div class="workbench-choice-card__content">
            <div>
              <p class="workbench-choice-card__kicker">{{ t("适合需要完整参数与证据链的用户") }}</p>
              <h2>{{ t("专业版") }}</h2>
            </div>
            <dl class="workbench-choice-card__details">
              <div>
                <dt>{{ t("可以完成") }}</dt>
                <dd>{{ t("编辑实验输入、创建和观察运行、查看指标、验证、证据与历史。") }}</dd>
              </div>
              <div>
                <dt>{{ t("正式运行") }}</dt>
                <dd>{{ t("进入后可按现有权限创建正式运行，并查看完整结果。") }}</dd>
              </div>
            </dl>
          </div>
          <RouterLink
            class="workbench-choice-card__action button button--primary"
            :to="{ name: 'overview', query: carriedQuery }"
            @click="choose('professional')"
          >
            {{ t("进入专业版") }} <ArrowRight :size="16" aria-hidden="true" />
          </RouterLink>
        </article>
      </section>

      <p class="workbench-entry__footnote">
        {{ t("不确定时，可以先从轻量版开始；模式切换不会清除已有运行或证据引用。") }}
      </p>
    </div>
  </main>
</template>

<style scoped>
/* A product surface, not a landing page: one left-aligned intro block over a
   real comparison, sized so the two cards read as a choice rather than as two
   identical marketing tiles. */
.workbench-entry {
  min-height: 100dvh;
  padding: 0 0 clamp(32px, 6vw, 72px);
  color: var(--ink);
  background: var(--surface);
}

.workbench-entry__inner {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 56px);
}

.workbench-entry__bar {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 64px;
  margin-bottom: clamp(26px, 5vw, 56px);
  border-bottom: 1px solid var(--line);
}

.workbench-entry__wordmark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.workbench-entry__product {
  display: grid;
  gap: 1px;
  line-height: 1.25;
}

.workbench-entry__product strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.workbench-entry__product small {
  color: var(--muted);
  font-size: var(--text-xs);
}

.workbench-entry__header {
  max-width: 640px;
  margin: 0 0 clamp(22px, 4vw, 36px);
}

.workbench-entry h1 {
  margin: 0 0 10px;
  font-size: clamp(23px, 3.2vw, 30px);
  font-weight: 600;
  line-height: 1.28;
  letter-spacing: -0.022em;
  text-wrap: balance;
}

.workbench-entry__lede {
  max-width: 56ch;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-md);
  line-height: 1.65;
}

.workbench-entry__recent {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 14px 0 0;
  color: var(--muted);
  font-size: var(--text-xs);
}

.workbench-entry__recent-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
}

.workbench-entry__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 20px;
}

.workbench-choice-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 16px 14px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
  box-shadow: var(--shadow-hairline);
}

.workbench-choice-card__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.workbench-choice-card__content {
  min-width: 0;
}

.workbench-choice-card h2 {
  margin: 4px 0 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.012em;
}

.workbench-choice-card__kicker {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 400;
}

.workbench-choice-card__details {
  display: grid;
  gap: 14px;
  margin: 20px 0 0;
}

.workbench-choice-card__details div {
  display: grid;
  gap: 3px;
}

.workbench-choice-card__details dt {
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 500;
}

.workbench-choice-card__details dd {
  margin: 0;
  font-size: var(--text-md);
  line-height: 1.6;
}

/* Sits under the copy instead of spanning the card, so the two columns keep a
   text-like rhythm rather than two identical full-width bars. */
.workbench-choice-card__action {
  grid-column: 2;
  justify-self: start;
  min-height: 38px;
  padding: 8px 15px;
  border-radius: var(--radius-control);
  text-decoration: none;
}

.workbench-choice-card__action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.workbench-entry__footnote {
  margin: 22px 0 0;
  color: var(--muted);
  font-size: var(--text-xs);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .workbench-entry__choices {
    grid-template-columns: 1fr;
  }

  .workbench-entry__product small {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workbench-entry,
  .workbench-entry * {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
