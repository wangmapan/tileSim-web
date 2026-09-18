<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  LightweightTaskCards,
  preserveWorkbenchQuery,
  type LightweightTaskTemplate,
} from "../features/lightweight-workbench";
import { useI18n } from "../i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const query = computed(() => preserveWorkbenchQuery(route.query));

function chooseTask(template: LightweightTaskTemplate) {
  void router.push({
    name: "lightweight_prepare",
    query: { ...query.value, task: template.id },
  });
}
</script>

<template>
  <div
    class="lightweight-tasks-view"
    aria-labelledby="lightweight-tasks-title"
    data-help-anchor="lightweight_tasks-prepare"
  >
    <header class="lightweight-page__heading" data-help-anchor="lightweight_tasks-boundary">
      <p class="section-kicker">{{ t("任务") }}</p>
      <h1 id="lightweight-tasks-title">{{ t("选择一个实验任务") }}</h1>
    </header>

    <LightweightTaskCards @select="chooseTask" />
  </div>
</template>

<style scoped>
.lightweight-tasks-view {
  display: grid;
  gap: 24px;
  max-width: 1080px;
}
</style>
