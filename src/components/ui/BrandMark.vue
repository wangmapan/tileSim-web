<script setup lang="ts">
import mark from "../../assets/tilesim-mark.svg";
const maskUrl = `url(${JSON.stringify(mark)})`;
</script>

<template>
  <span class="brand-mark" aria-hidden="true" :style="{ '--brand-mark-url': maskUrl }"></span>
</template>

<style scoped>
.brand-mark {
  display: block;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  background: currentColor;
  mask: var(--brand-mark-url) center / contain no-repeat;
}
</style>
