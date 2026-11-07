<script setup lang="ts">
import { computed } from "vue";
import type { ReplayDocument } from "../model/types";
import { replayLayerDefinitions, type ReplayLayerKey, type ReplayLayerVisibility } from "../model/layers";

const props = defineProps<{
  document: ReplayDocument;
  visibility: ReplayLayerVisibility;
}>();
const emit = defineEmits<{ "update:visibility": [visibility: ReplayLayerVisibility] }>();
const definitions = computed(() => replayLayerDefinitions(props.document));

function availabilityLabel(value: string) {
  return (
    {
      available: "已报告",
      partial: "部分报告",
      missing: "未报告",
      expected_absence: "预期缺省",
      not_covered: "未覆盖",
      unsupported_schema: "不支持",
    }[value] || "未报告"
  );
}

function toggle(key: ReplayLayerKey) {
  const definition = definitions.value.find((item) => item.key === key);
  if (!definition || definition.availability === "not_covered" || definition.availability === "missing") return;
  emit("update:visibility", { ...props.visibility, [key]: !props.visibility[key] });
}

function setCore() {
  const next = Object.fromEntries(
    definitions.value.map((definition) => [definition.key, definition.defaultVisible && definition.count > 0]),
  ) as ReplayLayerVisibility;
  emit("update:visibility", next);
}

function setAll() {
  emit(
    "update:visibility",
    Object.fromEntries(
      definitions.value.map((definition) => [definition.key, definition.count > 0]),
    ) as ReplayLayerVisibility,
  );
}

function clearAll() {
  emit(
    "update:visibility",
    Object.fromEntries(definitions.value.map((definition) => [definition.key, false])) as ReplayLayerVisibility,
  );
}
</script>

<template>
  <section class="replay-layer-selector" aria-label="回放分层选择">
    <div class="replay-layer-selector__heading">
      <div>
        <span class="section-kicker">分层展示</span>
        <h3>选择要查看的证据层</h3>
      </div>
      <div class="replay-layer-selector__actions">
        <button type="button" @click="setCore">核心层</button>
        <button type="button" @click="setAll">全部已报告</button>
        <button type="button" @click="clearAll">清空</button>
      </div>
    </div>
    <p class="replay-layer-selector__hint">回放动画只移动已报告数据；未报告层不会生成推断动画。</p>
    <div class="replay-layer-selector__grid" role="group" aria-label="证据层">
      <label
        v-for="definition in definitions"
        :key="definition.key"
        class="replay-layer-selector__item"
        :class="{ 'is-disabled': definition.count === 0 && definition.availability !== 'available' }"
      >
        <input
          type="checkbox"
          :checked="visibility[definition.key]"
          :disabled="definition.count === 0 && definition.availability !== 'available'"
          :aria-label="definition.label"
          @change="toggle(definition.key)"
        />
        <span class="replay-layer-selector__copy">
          <strong>{{ definition.label }}</strong>
          <small>{{ definition.description }}</small>
        </span>
        <span class="replay-layer-selector__meta">
          {{ availabilityLabel(definition.availability)
          }}<template v-if="definition.count"> · {{ definition.count }} 条</template>
        </span>
      </label>
    </div>
  </section>
</template>

<style scoped>
.replay-layer-selector {
  padding: 14px 22px 16px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--surface-subtle);
}
.replay-layer-selector__heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: end;
}
.replay-layer-selector h3 {
  margin: 4px 0 0;
  font-size: 15px;
}
.replay-layer-selector__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.replay-layer-selector__actions button {
  padding: 5px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: var(--surface);
  font-size: var(--text-xs);
}
.replay-layer-selector__actions button:hover,
.replay-layer-selector__actions button:focus-visible {
  border-color: var(--accent);
  color: var(--ink);
}
.replay-layer-selector__hint {
  margin: 8px 0 12px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-layer-selector__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 7px;
}
.replay-layer-selector__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  cursor: pointer;
}
.replay-layer-selector__item.is-disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
.replay-layer-selector__item input {
  accent-color: var(--accent);
}
.replay-layer-selector__copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.replay-layer-selector__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs);
}
.replay-layer-selector__copy small,
.replay-layer-selector__meta {
  color: var(--muted);
  font-size: 10px;
}
.replay-layer-selector__meta {
  white-space: nowrap;
}
@media (max-width: 700px) {
  .replay-layer-selector__heading {
    align-items: start;
    flex-direction: column;
  }
}
</style>
