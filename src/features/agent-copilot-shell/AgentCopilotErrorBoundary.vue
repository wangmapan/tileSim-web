<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";

const emit = defineEmits<{ retry: []; close: [] }>();
const failed = ref(false);

onErrorCaptured(() => {
  failed.value = true;
  return false;
});

function retry(): void {
  failed.value = false;
  emit("retry");
}
</script>

<template>
  <slot v-if="!failed" />
  <aside v-else class="agent-copilot-boundary" aria-label="TileSim 助手" role="alert">
    <p>限制</p>
    <h2>助手侧栏暂时无法显示</h2>
    <span>主工作台仍可继续使用，现有运行和页面状态没有被修改。</span>
    <div>
      <button type="button" @click="retry">重新载入侧栏</button>
      <button type="button" @click="emit('close')">关闭</button>
    </div>
  </aside>
</template>

<style scoped>
.agent-copilot-boundary {
  width: min(420px, calc(100vw - 48px));
  min-height: 220px;
  align-self: start;
  padding: 20px;
  border-left: 1px solid var(--danger);
  color: var(--ink);
  background: var(--panel);
}

.agent-copilot-boundary p,
.agent-copilot-boundary h2,
.agent-copilot-boundary span {
  overflow-wrap: anywhere;
}

.agent-copilot-boundary p {
  margin: 0 0 4px;
  color: var(--danger-ink);
  font-size: var(--text-micro);
  font-weight: 700;
}

.agent-copilot-boundary h2 {
  margin: 0;
  font-size: var(--text-lg);
}

.agent-copilot-boundary span {
  display: block;
  margin-top: 7px;
  color: var(--muted);
}

.agent-copilot-boundary div {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.agent-copilot-boundary button {
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  cursor: pointer;
}
</style>
