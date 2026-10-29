<script setup lang="ts">
import { REPLAY_SPEED_OPTIONS, replaySpeedLabel } from "../model/speed";

defineProps<{
  isPlaying: boolean;
  speed: number;
  canPlay: boolean;
  canStep: boolean;
  canStepStage?: boolean;
  canStepCollective?: boolean;
  reducedMotion: boolean;
  cursorPs: string | null;
}>();

const emit = defineEmits<{
  toggle: [];
  reset: [];
  previous: [];
  next: [];
  previousStage: [];
  nextStage: [];
  previousCollective: [];
  nextCollective: [];
  "update:speed": [value: number];
}>();
</script>

<template>
  <div class="replay-controls" role="group" aria-label="执行回放控制">
    <div class="replay-controls__group replay-controls__group--primary" role="group" aria-label="播放与步进">
      <button class="button button--secondary" type="button" :disabled="!canStep" @click="emit('previous')">
        上一步
      </button>
      <button
        class="button button--primary replay-controls__play"
        type="button"
        :disabled="!canPlay"
        :aria-pressed="isPlaying"
        :aria-label="isPlaying ? '暂停执行回放' : reducedMotion ? '按事件前进' : '播放执行回放'"
        @click="emit('toggle')"
      >
        {{ isPlaying ? "暂停" : reducedMotion ? "前进" : "播放" }}
      </button>
      <button class="button button--secondary" type="button" :disabled="!canStep" @click="emit('next')">下一步</button>
    </div>
    <div class="replay-controls__group" role="group" aria-label="阶段步进">
      <button
        class="button button--secondary"
        type="button"
        :disabled="!canStep || canStepStage === false"
        title="跳到上一阶段"
        @click="emit('previousStage')"
      >
        上一阶段
      </button>
      <button
        class="button button--secondary"
        type="button"
        :disabled="!canStep || canStepStage === false"
        title="跳到下一阶段"
        @click="emit('nextStage')"
      >
        下一阶段
      </button>
    </div>
    <div
      v-if="canStepCollective"
      class="replay-controls__group replay-controls__group--collective"
      role="group"
      aria-label="集合步骤步进"
    >
      <button
        class="button button--secondary"
        type="button"
        title="跳到上一集合步骤"
        @click="emit('previousCollective')"
      >
        集合 −
      </button>
      <button class="button button--secondary" type="button" title="跳到下一集合步骤" @click="emit('nextCollective')">
        集合 +
      </button>
    </div>
    <button class="button button--secondary" type="button" :disabled="!canStep" @click="emit('reset')">重置</button>
    <label class="replay-speed">
      <span>慢放速度</span>
      <select
        class="replay-speed__select"
        :value="speed"
        aria-label="播放速度"
        @change="emit('update:speed', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="value in REPLAY_SPEED_OPTIONS" :key="value" :value="value">
          {{ replaySpeedLabel(value) }}
        </option>
      </select>
    </label>
    <small v-if="reducedMotion" class="replay-reduced-motion">已启用减少动态效果，自动播放已停用</small>
    <code v-if="cursorPs !== null" class="replay-cursor-readout">{{ cursorPs }} ps</code>
  </div>
</template>

<style scoped>
.replay-controls .button {
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel-strong);
  box-shadow: var(--shadow-hairline);
  transition:
    color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized);
}

.replay-controls .button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--surface-muted);
  box-shadow: 0 5px 12px -9px color-mix(in srgb, var(--ink) 70%, transparent);
  transform: translateY(-1px);
}

.replay-controls .button:active:not(:disabled) {
  box-shadow: none;
  transform: translateY(0) scale(0.99);
}

.replay-controls .button:focus-visible,
.replay-speed__select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.replay-controls .button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

.replay-controls .button--primary {
  color: var(--on-accent, #fff);
  border-color: var(--accent);
  background: var(--accent);
}

.replay-controls .button--primary:hover:not(:disabled) {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
}

.replay-controls .button--primary[aria-pressed="true"] {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent),
    0 6px 16px -10px var(--accent);
}

.replay-controls .button--secondary:hover:not(:disabled) {
  border-color: var(--accent);
}

.replay-controls__play {
  min-width: 70px;
}

.replay-controls__group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
}

.replay-controls__group--primary {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
}

.replay-speed {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  margin-left: auto;
  color: var(--muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.replay-speed__select {
  min-width: 74px;
  min-height: 34px;
  padding: 6px 28px 6px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background-color: var(--control-bg);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position:
    calc(100% - 15px) 50%,
    calc(100% - 10px) 50%;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  outline: none;
  transition:
    color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard);
}

.replay-speed__select:hover:not(:disabled) {
  border-color: var(--accent);
  background-color: var(--surface-muted);
}

.replay-speed__select:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.replay-speed__select:active:not(:disabled) {
  border-color: var(--accent-hover);
  background-color: var(--surface-muted);
}

.replay-speed__select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.replay-speed__select option {
  color: var(--ink);
  background: var(--panel-strong);
}

.replay-reduced-motion {
  color: var(--muted);
}

.replay-cursor-readout {
  min-width: 9ch;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--line));
  border-radius: var(--radius-control);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 64%, var(--surface));
  text-align: right;
}

@media (max-width: 900px) {
  .replay-controls__group {
    flex: 1 1 auto;
  }

  .replay-controls__group .button {
    flex: 1 1 auto;
  }

  .replay-speed {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .replay-controls .button,
  .replay-speed__select {
    transition: none;
  }
}
</style>
