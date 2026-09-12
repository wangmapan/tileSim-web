<script setup lang="ts">
import { ArrowRight, Compass, SlidersHorizontal } from "@lucide/vue";
import { persistWorkbenchMode } from "../model";
function choose(mode: "professional" | "lightweight") {
  persistWorkbenchMode(mode);
}
</script>

<template>
  <section class="lightweight-entry" aria-labelledby="workbench-entry-title">
    <div class="lightweight-entry__intro">
      <p class="section-kicker">TileSim 工作台</p>
      <h2 id="workbench-entry-title">选择适合你的工作方式</h2>
      <p>两种入口使用同一个 Agent、能力目录和校验规则；区别只在信息呈现方式。</p>
    </div>
    <div class="lightweight-entry__cards">
      <a class="lightweight-entry-card" href="/lightweight" @click="choose('lightweight')">
        <span class="lightweight-entry-card__icon"><Compass :size="20" aria-hidden="true" /></span>
        <span><strong>轻量工作台</strong><small>用任务卡和普通语言，逐步整理一个当前支持的参数草案。</small></span>
        <ArrowRight :size="18" aria-hidden="true" />
      </a>
      <a class="lightweight-entry-card" href="/overview" @click="choose('professional')">
        <span class="lightweight-entry-card__icon"><SlidersHorizontal :size="20" aria-hidden="true" /></span>
        <span><strong>专业工作台</strong><small>直接使用完整导航、实验表单、运行结果和证据详情。</small></span>
        <ArrowRight :size="18" aria-hidden="true" />
      </a>
    </div>
  </section>
</template>

<style scoped>
.lightweight-entry {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
  box-shadow: var(--shadow);
}
.lightweight-entry__intro {
  display: grid;
  gap: 4px;
}
.lightweight-entry h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-entry p {
  margin: 0;
  color: var(--muted);
}
.lightweight-entry__cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.lightweight-entry-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 92px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  color: var(--ink);
  background: var(--surface-subtle);
  text-align: left;
  cursor: pointer;
}
.lightweight-entry-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.lightweight-entry-card__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: var(--accent);
  background: var(--accent-soft);
}
.lightweight-entry-card span:nth-child(2) {
  display: grid;
  gap: 4px;
}
.lightweight-entry-card small {
  color: var(--muted);
  line-height: 1.45;
}
@media (max-width: 700px) {
  .lightweight-entry__cards {
    grid-template-columns: 1fr;
  }
}
</style>
