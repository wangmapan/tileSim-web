<script setup lang="ts">
import { ArrowRight, Compass, SlidersHorizontal } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { persistWorkbenchMode, readWorkbenchMode, type WorkbenchMode } from "../features/lightweight-workbench";

const route = useRoute();
const recentMode = ref<WorkbenchMode | null>(readWorkbenchMode());

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
}

const recentLabel = computed(() => {
  if (!recentMode.value) return "";
  return `上次使用：${recentMode.value === "lightweight" ? "轻量版" : "专业版"}`;
});
</script>

<template>
  <main class="workbench-entry" aria-labelledby="workbench-entry-title">
    <div class="workbench-entry__inner">
      <header class="workbench-entry__header">
        <p class="workbench-entry__eyebrow">TileSim 仿真实验台</p>
        <h1 id="workbench-entry-title">选择适合你的工作台</h1>
        <p class="workbench-entry__lede">
          两种工作台共享同一套仿真事实和公开能力，但使用不同的信息组织方式。之后可以随时切换。
        </p>
        <p v-if="recentLabel" class="workbench-entry__recent" role="status" aria-live="polite">{{ recentLabel }}</p>
      </header>

      <section class="workbench-entry__choices" aria-label="工作台选择">
        <article class="workbench-choice-card">
          <div class="workbench-choice-card__icon" aria-hidden="true"><Compass :size="24" /></div>
          <div class="workbench-choice-card__content">
            <div>
              <p class="workbench-choice-card__kicker">适合刚开始接触 TileSim 的用户</p>
              <h2>轻量版</h2>
            </div>
            <dl class="workbench-choice-card__details">
              <div>
                <dt>可以完成</dt>
                <dd>了解概念、准备单轮配置草案、阅读已有结果摘要和示例。</dd>
              </div>
              <div>
                <dt>正式运行</dt>
                <dd>不会创建正式运行；草案只在当前页面有效。</dd>
              </div>
            </dl>
          </div>
          <RouterLink
            class="workbench-choice-card__action button button--primary"
            :to="{ name: 'lightweight', query: carriedQuery }"
            @click="choose('lightweight')"
          >
            进入轻量版 <ArrowRight :size="17" aria-hidden="true" />
          </RouterLink>
        </article>

        <article class="workbench-choice-card">
          <div class="workbench-choice-card__icon" aria-hidden="true"><SlidersHorizontal :size="24" /></div>
          <div class="workbench-choice-card__content">
            <div>
              <p class="workbench-choice-card__kicker">适合需要完整参数与证据链的用户</p>
              <h2>专业版</h2>
            </div>
            <dl class="workbench-choice-card__details">
              <div>
                <dt>可以完成</dt>
                <dd>编辑实验输入、创建和观察运行、查看指标、验证、证据与历史。</dd>
              </div>
              <div>
                <dt>正式运行</dt>
                <dd>进入后可按现有权限创建正式运行，并查看完整结果。</dd>
              </div>
            </dl>
          </div>
          <RouterLink
            class="workbench-choice-card__action button button--primary"
            :to="{ name: 'overview', query: carriedQuery }"
            @click="choose('professional')"
          >
            进入专业版 <ArrowRight :size="17" aria-hidden="true" />
          </RouterLink>
        </article>
      </section>

      <p class="workbench-entry__footnote">不确定时，可以先从轻量版开始；模式切换不会清除已有运行或证据引用。</p>
    </div>
  </main>
</template>

<style scoped>
.workbench-entry {
  min-height: 100dvh;
  padding: clamp(28px, 7vw, 84px) clamp(20px, 5vw, 72px);
  color: var(--ink);
  background: var(--surface);
}

.workbench-entry__inner {
  width: min(1080px, 100%);
  margin: 0 auto;
}

.workbench-entry__header {
  max-width: 760px;
  margin: 0 auto clamp(28px, 5vw, 52px);
  text-align: center;
}

.workbench-entry__eyebrow,
.workbench-choice-card__kicker {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.workbench-entry h1 {
  margin: 10px 0 12px;
  font-size: clamp(30px, 5vw, 48px);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.workbench-entry__lede {
  max-width: 680px;
  margin: 0 auto;
  color: var(--muted);
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.6;
}

.workbench-entry__recent {
  display: inline-block;
  margin: 16px 0 0;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: var(--text-sm);
}

.workbench-entry__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 18px;
}

.workbench-choice-card {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr auto;
  gap: 18px 16px;
  min-width: 0;
  min-height: 330px;
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-panel);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.workbench-choice-card__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  color: var(--accent);
  background: var(--surface-subtle);
}

.workbench-choice-card__content {
  min-width: 0;
}

.workbench-choice-card h2 {
  margin: 8px 0 0;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.15;
}

.workbench-choice-card__details {
  display: grid;
  gap: 14px;
  margin: 24px 0 0;
}

.workbench-choice-card__details div {
  display: grid;
  gap: 4px;
}

.workbench-choice-card__details dt {
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.workbench-choice-card__details dd {
  margin: 0;
  line-height: 1.55;
}

.workbench-choice-card__action {
  grid-column: 1 / -1;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  text-decoration: none;
}

.workbench-choice-card__action:focus-visible,
.workbench-choice-card:focus-within {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 3px;
}

.workbench-entry__footnote {
  margin: 22px auto 0;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 760px) {
  .workbench-entry__choices {
    grid-template-columns: 1fr;
  }

  .workbench-choice-card {
    min-height: 0;
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
