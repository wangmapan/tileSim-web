<script setup lang="ts">
defineProps<{
  tone: "positive" | "warning" | "danger" | "neutral";
  label: string;
}>();
</script>

<template>
  <span class="status-mark" :class="`status-mark--${tone}`">
    <span class="status-mark__shape" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>
