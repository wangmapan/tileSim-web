<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const page = computed(() => {
  switch (route.name) {
    case "lightweight_learn":
      return {
        eyebrow: "学习",
        title: "从基础概念开始",
        description: "概念卡和快速导览将在 L2 开放。",
      };
    case "lightweight_tasks":
      return {
        eyebrow: "任务",
        title: "选择一个目标",
        description: "了解、准备、解读和示例任务将在 L2 开放。",
      };
    case "lightweight_prepare":
      return {
        eyebrow: "草案",
        title: "在当前页面保留你的草案",
        description: "单轮草案和字段校验将在 L3 开放；刷新后不会恢复正文。",
      };
    case "lightweight_results":
      return {
        eyebrow: "结果",
        title: "查看已有运行",
        description: "只读结果摘要和 stale/unsupported 状态将在 L4 开放。",
      };
    default:
      return {
        eyebrow: "开始",
        title: "从一个清晰目标开始",
        description: "轻量工作台的任务首页将在 L2 开放。",
      };
  }
});
</script>

<template>
  <section class="lightweight-placeholder" aria-labelledby="lightweight-placeholder-title">
    <p class="section-kicker">{{ page.eyebrow }}</p>
    <h1 id="lightweight-placeholder-title">{{ page.title }}</h1>
    <p class="lightweight-placeholder__lead">{{ page.description }}</p>
    <div class="lightweight-placeholder__notice" role="status">
      <strong>当前阶段：L1b</strong>
      <span>L2/L3 尚未开放。本页仅提供独立工作台 Shell、导航和模式切换，不会调用 Agent、Provider 或创建正式运行。</span>
    </div>
  </section>
</template>

<style scoped>
.lightweight-placeholder {
  max-width: 760px;
  padding: clamp(24px, 5vw, 52px);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
  box-shadow: var(--shadow);
}
.lightweight-placeholder h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.lightweight-placeholder__lead {
  max-width: 620px;
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.6;
}
.lightweight-placeholder__notice {
  display: grid;
  gap: 7px;
  margin-top: 30px;
  padding: 16px;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  background: var(--accent-soft);
  line-height: 1.55;
}
.lightweight-placeholder__notice strong {
  color: var(--ink);
}
</style>
