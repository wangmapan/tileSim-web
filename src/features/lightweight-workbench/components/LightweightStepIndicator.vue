<script setup lang="ts">
defineProps<{ current?: number }>();
</script>
<template>
  <ol class="lightweight-steps" aria-label="轻量工作台步骤">
    <li v-for="step in ['选择目标', '描述目标', '查看理解', '依据和限制', '下一步']" :key="step">{{ step }}</li>
  </ol>
</template>
<style scoped>
.lightweight-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-steps li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lightweight-steps li::before {
  content: counter(list-item);
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-size: 11px;
}
</style>
