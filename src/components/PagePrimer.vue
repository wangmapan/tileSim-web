<script setup lang="ts">
import { Lightbulb, Star } from "@lucide/vue";
import { useI18n } from "../i18n";

defineProps<{
  title: string;
  description: string;
  emphasis: string;
}>();
const { t } = useI18n();
</script>

<template>
  <section class="page-primer" :aria-label="title">
    <div class="page-primer__icon"><Lightbulb :size="21" /></div>
    <div class="page-primer__copy">
      <small>{{ t("先看这里") }}</small>
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
    <div class="page-primer__emphasis"><Star :size="16" fill="currentColor" />{{ emphasis }}</div>
  </section>
</template>
