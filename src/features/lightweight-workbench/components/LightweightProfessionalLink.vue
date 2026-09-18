<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { persistWorkbenchMode, preserveWorkbenchQuery } from "../model";
const route = useRoute();
const carriedQuery = computed(() => preserveWorkbenchQuery(route.query));
function professional() {
  persistWorkbenchMode("professional");
}
</script>
<template>
  <RouterLink
    class="lightweight-professional-link"
    :to="{ name: 'overview', query: carriedQuery }"
    @click="professional"
    >返回专业工作台</RouterLink
  >
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
