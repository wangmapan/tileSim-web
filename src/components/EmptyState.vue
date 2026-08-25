<script setup>
import { FileQuestion } from "@lucide/vue";
defineProps({
  title: { type: String, default: "暂无数据" },
  description: { type: String, default: "请先打开一次完整运行或导入对应报告。" },
});
</script>

<template>
  <div class="empty-state">
    <FileQuestion :size="24" />
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
  </div>
</template>
