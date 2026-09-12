<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { persistWorkbenchMode, preserveWorkbenchQuery } from "../model";

const route = useRoute();
const isLightweight = computed(() => route.meta.workspace === "lightweight");
const targetName = computed(() => (isLightweight.value ? "overview" : "lightweight"));
const targetLabel = computed(() => (isLightweight.value ? "专业工作台" : "轻量工作台"));
const carriedQuery = computed(() => preserveWorkbenchQuery(route.query));

function choose(): void {
  persistWorkbenchMode(isLightweight.value ? "professional" : "lightweight");
}
</script>

<template>
  <RouterLink
    class="workbench-mode-switcher"
    :to="{ name: targetName, query: carriedQuery }"
    :aria-label="`切换到${targetLabel}`"
    @click="choose"
  >
    <span aria-hidden="true">↔</span>
    <span>{{ targetLabel }}</span>
  </RouterLink>
</template>

<style scoped>
.workbench-mode-switcher {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 7px 11px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color var(--motion-fast) var(--ease-standard),
    background-color var(--motion-fast) var(--ease-standard);
}
.workbench-mode-switcher:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.workbench-mode-switcher:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}
</style>
