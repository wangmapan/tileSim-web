<script setup lang="ts">
import { persistWorkbenchMode } from "../model";
function professional() {
  persistWorkbenchMode("professional");
}
</script>
<template>
  <RouterLink class="lightweight-professional-link" to="/overview" @click="professional">返回专业工作台</RouterLink>
</template>
<style scoped>
.lightweight-professional-link {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
.lightweight-professional-link:hover {
  text-decoration: underline;
}
</style>
