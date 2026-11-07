<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <section class="replay-track-panel" aria-label="执行概览轨道">
    <header v-if="title || description" class="replay-track-panel__header">
      <div>
        <span class="section-kicker">时间线</span>
        <h3 v-if="title">{{ title }}</h3>
      </div>
      <p v-if="description">{{ description }}</p>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.replay-track-panel {
  min-width: 0;
}
.replay-track-panel__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px 0;
}
.replay-track-panel__header h3 {
  margin: 4px 0 0;
  font-size: 15px;
}
.replay-track-panel__header p {
  max-width: 440px;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
  text-align: right;
}
@media (max-width: 720px) {
  .replay-track-panel__header {
    align-items: start;
    flex-direction: column;
    gap: 6px;
  }
  .replay-track-panel__header p {
    text-align: left;
  }
}
</style>
