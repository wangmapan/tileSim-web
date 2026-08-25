<script setup>
defineProps({ label: String, value: String, hint: String, accent: { type: Boolean, default: false } });
</script>

<template>
  <article class="stat-card" :class="{ 'stat-card--accent': accent }">
    <p>{{ label }}</p>
    <strong>{{ value }}</strong>
    <small>{{ hint }}</small>
  </article>
</template>
