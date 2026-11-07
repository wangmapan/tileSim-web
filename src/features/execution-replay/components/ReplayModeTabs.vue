<script setup lang="ts">
import { replayModeDefinitions, type ReplayMode } from "../model/modes";

defineProps<{ modelValue: ReplayMode }>();
const emit = defineEmits<{ "update:modelValue": [mode: ReplayMode] }>();
</script>

<template>
  <nav class="replay-mode-tabs" aria-label="回放视图模式" data-help-anchor="replay-modes">
    <button
      v-for="mode in replayModeDefinitions"
      :key="mode.key"
      type="button"
      class="replay-mode-tabs__tab"
      :class="{ 'is-active': modelValue === mode.key }"
      :aria-selected="modelValue === mode.key"
      role="tab"
      :tabindex="modelValue === mode.key ? 0 : -1"
      :title="mode.description"
      @click="emit('update:modelValue', mode.key)"
    >
      <strong>{{ mode.label }}</strong>
    </button>
  </nav>
</template>

<style scoped>
.replay-mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 22px 0;
  border-top: 1px solid var(--line);
  background: var(--surface-subtle);
}

.replay-mode-tabs__tab {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 10px 12px 11px;
  border: 1px solid var(--line);
  border-bottom-color: var(--line-strong);
  border-radius: var(--radius-control) var(--radius-control) 0 0;
  color: var(--muted);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
}

.replay-mode-tabs__tab strong {
  color: var(--ink-soft);
  font-size: var(--text-sm);
}

.replay-mode-tabs__tab small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
}

.replay-mode-tabs__tab:hover,
.replay-mode-tabs__tab:focus-visible,
.replay-mode-tabs__tab.is-active {
  border-color: var(--accent);
  color: var(--ink);
  background: var(--surface);
}

.replay-mode-tabs__tab.is-active {
  border-bottom: 2px solid var(--accent);
}

.replay-mode-tabs__tab.is-active strong {
  color: var(--accent);
}

@media (max-width: 720px) {
  .replay-mode-tabs {
    grid-template-columns: 1fr;
    padding-inline: 14px;
  }
  .replay-mode-tabs__tab {
    border-radius: var(--radius-control);
  }
}
</style>
