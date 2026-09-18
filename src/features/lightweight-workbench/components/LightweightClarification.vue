<script setup lang="ts">
defineProps<{ questions: readonly string[] }>();
</script>
<template>
  <section v-if="questions.length" class="lightweight-clarification" role="status">
    <strong>还需要确认</strong>
    <ul>
      <li v-for="question in questions" :key="question">{{ question }}</li>
    </ul>
  </section>
</template>
<style scoped>
.lightweight-clarification {
  padding: 12px;
  border: 1px solid var(--warning);
  border-radius: var(--radius-control);
  background: var(--warning-soft);
}
.lightweight-clarification ul {
  margin: 6px 0 0;
  padding-left: 20px;
}
</style>
