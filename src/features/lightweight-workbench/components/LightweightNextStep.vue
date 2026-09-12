<script setup lang="ts">
import { persistWorkbenchMode } from "../model";
function professional() {
  persistWorkbenchMode("professional");
}
</script>
<template>
  <section class="lightweight-next-step" aria-labelledby="next-step-title">
    <div>
      <p class="section-kicker">第五步</p>
      <h2 id="next-step-title">下一步</h2>
      <p>这是草案，尚未创建运行。你可以回到专业工作台查看完整参数和证据。</p>
    </div>
    <RouterLink class="button button--secondary" to="/overview" @click="professional">打开专业工作台</RouterLink>
  </section>
</template>
<style scoped>
.lightweight-next-step {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-next-step h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-next-step p {
  margin: 4px 0 0;
  color: var(--muted);
}
@media (max-width: 560px) {
  .lightweight-next-step {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
