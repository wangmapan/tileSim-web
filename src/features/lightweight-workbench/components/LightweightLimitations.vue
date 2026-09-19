<script setup lang="ts">
import { LIGHTWEIGHT_LIMITATIONS } from "../model";
</script>
<template>
  <section class="lightweight-limitations" aria-labelledby="limitations-title">
    <div>
      <p class="section-kicker">第四步</p>
      <h2 id="limitations-title">依据和限制</h2>
    </div>
    <ul>
      <li v-for="item in LIGHTWEIGHT_LIMITATIONS" :key="item">{{ item }}</li>
    </ul>
    <p>轻量工作台只改变呈现方式，不会把 unavailable、unknown 或 stale 变成可用。</p>
  </section>
</template>
<style scoped>
.lightweight-limitations {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface-subtle);
}
.lightweight-limitations h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-limitations ul {
  margin: 0;
  padding-left: 20px;
}
.lightweight-limitations p {
  margin: 0;
  color: var(--muted);
}
</style>
