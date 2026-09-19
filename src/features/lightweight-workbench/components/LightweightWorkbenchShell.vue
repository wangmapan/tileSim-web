<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { preserveWorkbenchQuery } from "../model";
import WorkbenchModeSwitcher from "./WorkbenchModeSwitcher.vue";
import { useI18n } from "../../../i18n";
import { guideFor, GuidedHelpHost, PagePrimer } from "../../guided-help";

const { t } = useI18n();

const route = useRoute();
const navigation = [
  { name: "lightweight", label: "开始" },
  { name: "lightweight_prepare", label: "新建实验" },
  { name: "lightweight_results", label: "结果" },
] as const;
const carriedQuery = computed(() => preserveWorkbenchQuery(route.query, route.params.runId));
const guide = computed(() => {
  const routeName = route.name === "lightweight_status" ? "lightweight_run" : route.name;
  return guideFor(typeof routeName === "string" ? routeName : "lightweight");
});
</script>

<template>
  <div class="lightweight-shell">
    <header class="lightweight-shell__header">
      <RouterLink class="lightweight-shell__brand" :to="{ name: 'lightweight', query: carriedQuery }">
        <span class="lightweight-shell__mark" aria-hidden="true">T</span>
        <span
          ><strong>TileSim</strong><small>{{ t("轻量工作台") }}</small></span
        >
      </RouterLink>
      <div class="lightweight-shell__actions">
        <span class="lightweight-shell__status">{{ t("简化实验工作台") }}</span>
        <PagePrimer v-if="guide" :guide="guide" />
        <WorkbenchModeSwitcher />
      </div>
    </header>

    <div class="lightweight-shell__body">
      <aside class="lightweight-shell__sidebar" :aria-label="t('轻量工作台导航')">
        <nav class="lightweight-shell__nav">
          <RouterLink
            v-for="item in navigation"
            :key="item.label"
            class="lightweight-shell__nav-link"
            :to="{ name: item.name, query: carriedQuery }"
            exact-active-class="is-active"
          >
            <span>{{ t(item.label) }}</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="lightweight-shell__content">
        <slot />
      </main>
    </div>
    <GuidedHelpHost v-if="guide" :default-guide-id="guide.id" scope="lightweight" />
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
  background: var(--surface);
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
.lightweight-shell__content {
  min-width: 0;
}
/* Keep the shared Agent dock from covering the primary work surface on
   desktop windows. The dock itself follows the same cap below 1600px, so
   reserving the matching width keeps sticky submit actions and result identity
   fields reachable while the assistant is open.
   At the smallest supported width the dock intentionally becomes a full
   overlay; users can close/collapse it to return to the work surface. */
@media (min-width: 721px) {
  .lightweight-shell[data-agent-copilot-state="open"],
  .lightweight-shell[data-agent-copilot-state="expanded"],
  .lightweight-shell[data-agent-copilot-state="collapsed"] {
    margin-right: min(var(--agent-copilot-dock-width, 0px), 48vw);
  }
}
/* Collapse the two-column shell early enough for browser zoom and narrow
   desktop windows. At 200% zoom a nominal 800px viewport has roughly the
   same usable width as a 400px layout; keeping the sidebar stacked avoids
   horizontal overflow while preserving all navigation links. */
@media (max-width: 1200px) {
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
}
@media (max-width: 440px) {
  .lightweight-shell__status {
    display: none;
  }
}
</style>
