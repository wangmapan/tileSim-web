<script setup lang="ts">
import { Star } from "@lucide/vue";
import { useI18n } from "../../../i18n";

defineProps<{ text: string }>();
const { t } = useI18n();
</script>

<template>
  <aside class="key-takeaway" role="note" :aria-label="t('重点')">
    <Star :size="16" aria-hidden="true" />
    <span
      ><strong>{{ t("重点") }}：</strong>{{ t(text) }}</span
    >
  </aside>
</template>
