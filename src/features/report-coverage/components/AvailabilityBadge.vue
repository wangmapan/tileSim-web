<script setup lang="ts">
import { computed } from "vue";
import type { Availability } from "../../../contracts/report-model";
import { availabilityDescription, availabilityLabel, availabilityTone } from "../availability";

const props = defineProps<{ availability: Availability; compact?: boolean }>();
const label = computed(() => availabilityLabel(props.availability));
const description = computed(() => availabilityDescription(props.availability));
const tone = computed(() => availabilityTone(props.availability));
</script>

<template>
  <span class="availability-badge" :class="`availability-badge--${tone}`" :data-availability="props.availability">
    <span class="availability-badge__label">{{ label }}</span>
    <span v-if="!props.compact && description" class="availability-badge__detail">{{ description }}</span>
  </span>
</template>

<style scoped>
.availability-badge {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 3px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface-subtle);
  font: var(--text-sm) var(--font-sans);
  line-height: 1.35;
}
.availability-badge__label {
  font-weight: 600;
}
.availability-badge__detail {
  font-weight: 400;
  color: var(--muted);
}
.availability-badge--positive {
  border-color: var(--positive);
  background: var(--positive-soft);
  color: var(--positive-ink);
}
.availability-badge--warning {
  border-color: var(--warning);
  background: var(--warning-soft);
  color: var(--warning-ink);
}
.availability-badge--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
  color: var(--danger-ink);
}
.availability-badge--neutral {
  border-color: var(--line-strong);
  background: var(--surface-muted);
  color: var(--neutral-ink);
}
.availability-badge--positive .availability-badge__detail,
.availability-badge--warning .availability-badge__detail,
.availability-badge--danger .availability-badge__detail {
  color: inherit;
  opacity: 0.85;
}
</style>
