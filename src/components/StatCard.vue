<script setup>
import InlineHelp from "./InlineHelp.vue";

defineProps({
  label: String,
  value: String,
  hint: String,
  accent: { type: Boolean, default: false },
  tone: { type: String, default: "accent" },
});
</script>

<template>
  <article class="stat-card" :class="[{ 'stat-card--accent': accent }, `stat-card--${tone}`]">
    <p class="stat-card__label">
      <span>{{ label }}</span>
      <InlineHelp v-if="hint" :text="hint" />
    </p>
    <strong>{{ value }}</strong>
  </article>
</template>
