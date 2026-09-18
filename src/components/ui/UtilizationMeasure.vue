<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value?: number | null; text: string }>();
const width = computed(() =>
  typeof props.value === "number" && Number.isFinite(props.value) && props.value >= 0 && props.value <= 1
    ? `${props.value * 100}%`
    : null,
);
</script>

<template>
  <div class="utilization-measure">
    <span class="utilization-measure__track" aria-hidden="true">
      <span v-if="width !== null" :style="{ width }"></span>
    </span>
    <strong>{{ text }}</strong>
  </div>
</template>

<style scoped>
.utilization-measure {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(4ch, auto);
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.utilization-measure__track {
  display: block;
  height: 8px;
  background: var(--line);
}
.utilization-measure__track > span {
  display: block;
  height: 100%;
  background: var(--accent);
}
.utilization-measure > strong {
  color: var(--ink);
  font: 550 var(--text-lg) var(--font-mono);
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
