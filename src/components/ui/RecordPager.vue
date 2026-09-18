<script setup lang="ts">
import { useI18n } from "../../i18n";

defineProps<{ page: number; pages: number; label: string }>();
defineEmits<{ "update:page": [page: number] }>();
const { t } = useI18n();
</script>

<template>
  <nav v-if="pages > 1" class="record-pager" :aria-label="label">
    <span role="status">{{ t("第 {page} / {pages} 页", { page, pages }) }}</span>
    <button
      class="button button--secondary button--small"
      :disabled="page === 1"
      @click="$emit('update:page', page - 1)"
    >
      {{ t("上一页") }}
    </button>
    <button
      class="button button--secondary button--small"
      :disabled="page === pages"
      @click="$emit('update:page', page + 1)"
    >
      {{ t("下一页") }}
    </button>
  </nav>
</template>

<style scoped>
.record-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}
.record-pager > span {
  margin-right: auto;
  color: var(--muted);
  font: var(--text-sm) var(--font-mono);
}
</style>
