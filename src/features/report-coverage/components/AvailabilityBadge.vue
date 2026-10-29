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
  position: relative;
  padding: 3px 8px;
  padding-left: 18px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface-subtle);
  font: var(--text-sm) var(--font-sans);
  line-height: 1.35;
  box-shadow: var(--shadow-hairline);
  /* Coverage is an evidence boundary, not a decorative status pulse. A
     partially faded badge can drop an otherwise AA-safe warning/missing label
     below contrast during initial render and make the state look uncertain. */
  animation: none;
  transition:
    border-color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard);
}
.availability-badge::before {
  content: "";
  position: absolute;
  top: 9px;
  left: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.82;
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
.availability-badge:hover {
  box-shadow: var(--shadow);
}
/* No opacity here. The label/detail hierarchy is already carried by weight
   (600 against 400), and dimming the detail on top of that pushed 14px
   `--warning-ink` on `--warning-soft` down to 4.26:1 — under the 4.5:1 the
   accessibility suite requires, and short of it in a way that only showed up
   once the surrounding surfaces resolved to a colour axe could measure. */
.availability-badge--positive .availability-badge__detail,
.availability-badge--warning .availability-badge__detail,
.availability-badge--danger .availability-badge__detail {
  color: inherit;
}
</style>
