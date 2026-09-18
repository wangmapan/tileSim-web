<script setup lang="ts">
import { useI18n } from "../../../i18n";

const { t } = useI18n();

withDefaults(
  defineProps<{
    title?: string;
  }>(),
  { title: "需要帮助？" },
);
</script>

<template>
  <details class="lightweight-help-panel">
    <summary>{{ t(title) }}</summary>
    <div class="lightweight-help-panel__body">
      <p>{{ t("页面说明已移至右上角页面帮助。") }}</p>
      <p class="lightweight-help-panel__boundary">{{ t("主流程只保留配置、提交、运行状态和结果。") }}</p>
    </div>
  </details>
</template>

<style scoped>
.lightweight-help-panel {
  border-top: 1px solid var(--line);
  padding-top: 14px;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}
.lightweight-help-panel summary {
  color: var(--ink);
  cursor: pointer;
  font-weight: 650;
}
.lightweight-help-panel__body {
  display: grid;
  gap: 10px;
  padding-top: 10px;
}
.lightweight-help-panel__body p,
.lightweight-help-panel__body ul {
  margin: 0;
}
.lightweight-help-panel__body ul {
  display: grid;
  gap: 5px;
  padding-left: 20px;
}
.lightweight-help-panel__boundary {
  color: var(--ink-soft);
}
</style>
