<script setup lang="ts">
import type { LightweightAgentViewModel } from "../model";
defineProps<{ result: LightweightAgentViewModel }>();
</script>
<template>
  <div class="lightweight-draft-summary">
    <strong>{{ result.summary }}</strong
    ><span>这是草案，尚未创建运行。</span>
  </div>
</template>
<style scoped>
.lightweight-draft-summary {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
}
.lightweight-draft-summary span {
  color: var(--muted);
}
</style>
