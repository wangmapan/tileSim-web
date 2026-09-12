<script setup lang="ts">
const emit = defineEmits<{ select: [task: string] }>();
const tasks = [
  { id: "understand", title: "了解当前实验配置", detail: "看看当前页面和八个正式参数。" },
  { id: "draft", title: "准备基础参数草案", detail: "用一句话调整 batch、KV 或网络参数。" },
  { id: "explain", title: "解释已有结果", detail: "了解结果页面中的结论、依据和限制。" },
  { id: "examples", title: "浏览示例场景", detail: "先从内置示例开始熟悉工作台。" },
];
</script>

<template>
  <section class="lightweight-task-cards" aria-labelledby="lightweight-task-title">
    <div>
      <p class="section-kicker">第一步</p>
      <h2 id="lightweight-task-title">你想完成什么？</h2>
    </div>
    <div class="lightweight-task-grid">
      <button
        v-for="task in tasks"
        :key="task.id"
        type="button"
        class="lightweight-task-card"
        @click="emit('select', task.id)"
      >
        <strong>{{ task.title }}</strong
        ><span>{{ task.detail }}</span>
      </button>
    </div>
    <p class="lightweight-task-note">模型、设备、多卡并行、SLO 和正式运行目前显示为“当前版本暂不可用”。</p>
  </section>
</template>

<style scoped>
.lightweight-task-cards {
  display: grid;
  gap: 14px;
}
.lightweight-task-cards h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.lightweight-task-card {
  display: grid;
  gap: 5px;
  min-height: 92px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  color: var(--ink);
  background: var(--panel);
  text-align: left;
  cursor: pointer;
}
.lightweight-task-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.lightweight-task-card span {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-task-note {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}
@media (max-width: 600px) {
  .lightweight-task-grid {
    grid-template-columns: 1fr;
  }
}
</style>
