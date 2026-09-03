<script setup>
import { FileQuestion } from "@lucide/vue";
import { useI18n } from "../i18n";
const { t } = useI18n();
defineProps({
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  actionLabel: { type: String, default: "" },
  actionTo: { type: String, default: "" },
});
</script>

<template>
  <div class="empty-state">
    <FileQuestion :size="24" />
    <strong>{{ t(title || "暂无数据") }}</strong>
    <p>{{ t(description || "请先打开一次完整运行或导入对应报告。") }}</p>
    <a v-if="actionLabel && actionTo" class="button button--primary" :href="actionTo">
      {{ t(actionLabel) }}
    </a>
  </div>
</template>
