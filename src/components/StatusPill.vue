<script setup>
import { computed } from "vue";
import { statusLabel, statusTone } from "../lib/format";

const props = defineProps({ value: { type: String, default: "unknown" }, tone: { type: String, default: "" } });
const resolvedTone = computed(() => props.tone || statusTone(props.value));
</script>

<template>
  <span class="status-pill" :class="`status-pill--${resolvedTone}`">{{ statusLabel(value) }}</span>
</template>
