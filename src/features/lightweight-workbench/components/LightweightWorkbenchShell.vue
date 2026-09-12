<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { preserveWorkbenchQuery } from "../model";
import WorkbenchModeSwitcher from "./WorkbenchModeSwitcher.vue";

const route = useRoute();
const navigation = [
  { name: "lightweight", label: "开始", description: "轻量工作台首页" },
  { name: "lightweight_learn", label: "学习", description: "概念学习入口" },
  { name: "lightweight_tasks", label: "任务", description: "任务模板入口" },
  { name: "lightweight_prepare", label: "草案", description: "当前页面草案" },
  { name: "lightweight_results", label: "结果", description: "已有运行结果" },
] as const;
const carriedQuery = computed(() => preserveWorkbenchQuery(route.query));
</script>

<template>
  <div class="lightweight-shell">
    <header class="lightweight-shell__header">
      <RouterLink class="lightweight-shell__brand" :to="{ name: 'lightweight', query: carriedQuery }">
        <span class="lightweight-shell__mark" aria-hidden="true">T</span>
        <span><strong>TileSim</strong><small>轻量工作台</small></span>
      </RouterLink>
      <div class="lightweight-shell__actions">
        <span class="lightweight-shell__status">只读 · 当前阶段</span>
        <WorkbenchModeSwitcher />
      </div>
    </header>

    <div class="lightweight-shell__body">
      <aside class="lightweight-shell__sidebar" aria-label="轻量工作台导航">
        <nav class="lightweight-shell__nav">
          <RouterLink
            v-for="item in navigation"
            :key="item.name"
            class="lightweight-shell__nav-link"
            :to="{ name: item.name, query: carriedQuery }"
            exact-active-class="is-active"
            :title="item.description"
          >
            <span>{{ item.label }}</span>
            <small>{{ item.description }}</small>
          </RouterLink>
        </nav>

        <details class="lightweight-shell__help" open>
          <summary>帮助与限制</summary>
          <p>轻量版用于理解、准备和阅读，不会创建正式运行。</p>
          <p>L2/L3 尚未开放；Agent、模板业务和结果摘要将在后续阶段单独验收。</p>
        </details>
      </aside>

      <main class="lightweight-shell__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.lightweight-shell {
  min-height: 100vh;
  color: var(--ink);
  background: var(--surface);
}
.lightweight-shell__header {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 68px;
  padding: 12px clamp(18px, 4vw, 52px);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  backdrop-filter: blur(10px);
}
.lightweight-shell__brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: inherit;
  text-decoration: none;
}
.lightweight-shell__brand > span:last-child {
  display: grid;
  gap: 2px;
}
.lightweight-shell__brand strong {
  font-size: 18px;
  letter-spacing: -0.02em;
}
.lightweight-shell__brand small {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-shell__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  color: var(--accent);
  background: var(--panel);
  font-weight: 700;
}
.lightweight-shell__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lightweight-shell__status {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-shell__body {
  display: grid;
  grid-template-columns: minmax(190px, 240px) minmax(0, 1fr);
  gap: clamp(24px, 4vw, 58px);
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: clamp(24px, 5vw, 56px) clamp(18px, 4vw, 52px) 72px;
}
.lightweight-shell__sidebar {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.lightweight-shell__nav {
  display: grid;
  gap: 5px;
}
.lightweight-shell__nav-link {
  display: grid;
  gap: 3px;
  padding: 11px 13px;
  border-left: 3px solid transparent;
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  color: var(--muted);
  text-decoration: none;
  transition:
    color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    background-color var(--motion-fast) var(--ease-standard);
}
.lightweight-shell__nav-link:hover,
.lightweight-shell__nav-link.is-active {
  border-left-color: var(--accent);
  color: var(--ink);
  background: var(--accent-soft);
}
.lightweight-shell__nav-link span {
  font-weight: 650;
}
.lightweight-shell__nav-link small {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-shell__help {
  padding-top: 18px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}
.lightweight-shell__help summary {
  color: var(--ink);
  cursor: pointer;
  font-weight: 650;
}
.lightweight-shell__help p {
  margin: 10px 0 0;
}
.lightweight-shell__content {
  min-width: 0;
}
@media (max-width: 760px) {
  .lightweight-shell__header {
    align-items: flex-start;
    flex-direction: column;
  }
  .lightweight-shell__actions {
    justify-content: space-between;
    width: 100%;
  }
  .lightweight-shell__body {
    grid-template-columns: 1fr;
    gap: 24px;
    padding-top: 24px;
  }
  .lightweight-shell__sidebar {
    gap: 16px;
  }
  .lightweight-shell__nav {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }
  .lightweight-shell__nav-link {
    padding: 9px 7px;
    border-left: 0;
    border-bottom: 3px solid transparent;
    border-radius: var(--radius-control);
    text-align: center;
  }
  .lightweight-shell__nav-link:hover,
  .lightweight-shell__nav-link.is-active {
    border-bottom-color: var(--accent);
    border-left-color: transparent;
  }
  .lightweight-shell__nav-link small {
    display: none;
  }
}
@media (max-width: 440px) {
  .lightweight-shell__status {
    display: none;
  }
}
</style>
