<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  clonePageContextEnvelope,
  compareAgentContexts,
  type AgentContextAttachmentStatus,
  type PageContextEnvelope,
} from "../../entities/agent-context";
import AgentComposer from "./AgentComposer.vue";
import AgentContextBar from "./AgentContextBar.vue";
import AgentTypedBlockList from "./AgentTypedBlockList.vue";
import type {
  AgentCopilotPanelState,
  AgentCopilotSubmitPayload,
  AgentTypedBlock,
} from "../../entities/agent-orchestration";

const props = withDefaults(
  defineProps<{
    modelValue: AgentCopilotPanelState;
    context: PageContextEnvelope | null;
    blocks: readonly AgentTypedBlock[];
    currentTask?: string;
    statusLabel?: string;
    initialWidth?: number;
    minimumWidth?: number;
    maximumWidth?: number;
  }>(),
  {
    currentTask: "当前页面助手",
    statusLabel: "可以开始",
    initialWidth: 420,
    minimumWidth: 340,
    maximumWidth: 760,
  },
);

const emit = defineEmits<{
  "update:modelValue": [state: AgentCopilotPanelState];
  submit: [payload: AgentCopilotSubmitPayload];
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  resize: [width: number];
}>();

const composer = ref<InstanceType<typeof AgentComposer> | null>(null);
const panel = ref<HTMLElement | null>(null);
const width = ref(props.initialWidth);
const attachedContext = ref<PageContextEnvelope | null>(null);
let dragStartX = 0;
let dragStartWidth = 0;
let resizing = false;

const viewportMaximum = ref(props.maximumWidth);
const effectiveMaximum = computed(() =>
  Math.max(props.minimumWidth, Math.min(props.maximumWidth, viewportMaximum.value)),
);
const renderedWidth = computed(() => {
  const base = clampWidth(width.value);
  if (props.modelValue !== "expanded") return base;
  return Math.min(effectiveMaximum.value, Math.max(base, 680));
});
const panelStyle = computed(() => ({ "--agent-copilot-panel-width": `${renderedWidth.value}px` }));
const canDraft = computed(
  () =>
    props.context?.availability === "available" &&
    props.context.allowed_purposes.includes("draft") &&
    props.context.supported_actions.includes("configure_current_subset"),
);
const composerDisabled = computed(() => !props.context || props.context.availability !== "available");
const composerDisabledReason = computed(() =>
  props.context?.availability === "stale"
    ? "当前页面上下文已变化，请等待页面完成更新。"
    : "当前页面没有可用的 typed context。",
);
const contentSignature = computed(() => props.blocks.map((block) => `${block.block_type}:${block.block_id}`).join("|"));
const attachmentStatus = computed<AgentContextAttachmentStatus>(() => {
  if (!props.blocks.length) {
    return {
      state: props.context?.availability === "available" ? "fresh" : "stale",
      reason: props.context?.availability === "available" ? "none" : "context_unavailable",
      expected_revision: props.context?.context_revision ?? "",
      current_revision: props.context?.context_revision ?? "",
    };
  }
  return compareAgentContexts(attachedContext.value, props.context);
});
const statusText = computed(() =>
  attachmentStatus.value.state === "stale" && props.blocks.length ? "现有内容使用旧上下文" : props.statusLabel,
);

watch(
  contentSignature,
  (next, previous) => {
    if (next !== previous || attachedContext.value === null) {
      attachedContext.value = props.context ? clonePageContextEnvelope(props.context) : null;
    }
  },
  { immediate: true },
);

watch(
  () => [props.minimumWidth, props.maximumWidth, props.initialWidth] as const,
  () => {
    width.value = clampWidth(width.value);
    updateViewportMaximum();
  },
);

function clampWidth(value: number): number {
  return Math.round(Math.min(effectiveMaximum.value, Math.max(props.minimumWidth, value)));
}

function updateViewportMaximum(): void {
  const viewportWidth = typeof window === "undefined" ? props.maximumWidth + 48 : window.innerWidth;
  viewportMaximum.value = Math.max(props.minimumWidth, viewportWidth - 48);
  const next = clampWidth(width.value);
  if (next !== width.value) width.value = next;
}

function setWidth(value: number): void {
  const next = clampWidth(value);
  if (next === width.value) return;
  width.value = next;
  emit("resize", next);
}

function startResize(event: PointerEvent): void {
  if (props.modelValue === "collapsed") return;
  resizing = true;
  dragStartX = event.clientX;
  dragStartWidth = renderedWidth.value;
  window.addEventListener("pointermove", onResizeMove);
  window.addEventListener("pointerup", stopResize, { once: true });
  event.preventDefault();
}

function onResizeMove(event: PointerEvent): void {
  if (!resizing) return;
  setWidth(dragStartWidth + dragStartX - event.clientX);
}

function stopResize(): void {
  resizing = false;
  window.removeEventListener("pointermove", onResizeMove);
}

function onResizeKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowLeft") setWidth(renderedWidth.value + 16);
  else if (event.key === "ArrowRight") setWidth(renderedWidth.value - 16);
  else if (event.key === "Home") setWidth(props.minimumWidth);
  else if (event.key === "End") setWidth(effectiveMaximum.value);
  else return;
  event.preventDefault();
}

function setState(state: AgentCopilotPanelState): void {
  emit("update:modelValue", state);
}

function onEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (props.modelValue === "expanded") setState("open");
  else if (props.modelValue === "open") setState("collapsed");
  else if (props.modelValue === "collapsed") setState("closed");
  event.stopPropagation();
}

function submit(payload: { instruction: string; purpose: "explain" | "draft" }): void {
  attachedContext.value = props.context ? clonePageContextEnvelope(props.context) : null;
  emit("submit", {
    instruction: payload.instruction,
    purpose: payload.purpose,
    context_revision: props.context?.context_revision ?? null,
  });
}

async function focusComposer(): Promise<void> {
  await nextTick();
  await composer.value?.focus();
}

defineExpose({ focusComposer, panel, width });

onMounted(() => {
  updateViewportMaximum();
  window.addEventListener("resize", updateViewportMaximum);
});

onBeforeUnmount(() => {
  stopResize();
  window.removeEventListener("resize", updateViewportMaximum);
});
</script>

<template>
  <aside
    id="tilesim-agent-copilot"
    ref="panel"
    class="agent-copilot-shell"
    :class="`agent-copilot-shell--${modelValue}`"
    :style="panelStyle"
    :data-state="modelValue"
    aria-label="TileSim 助手"
    @keydown="onEscape"
  >
    <button
      v-if="modelValue !== 'collapsed'"
      class="agent-copilot-shell__resize"
      type="button"
      role="separator"
      aria-label="调整助手侧栏宽度"
      aria-orientation="vertical"
      :aria-valuemin="minimumWidth"
      :aria-valuemax="effectiveMaximum"
      :aria-valuenow="renderedWidth"
      title="拖动，或使用左右方向键调整宽度"
      @pointerdown="startResize"
      @keydown="onResizeKeydown"
    ></button>

    <template v-if="modelValue === 'collapsed'">
      <div class="agent-copilot-shell__rail">
        <strong aria-hidden="true">AI</strong>
        <span class="agent-copilot-shell__rail-status" :data-stale="attachmentStatus.state === 'stale'"></span>
        <button type="button" aria-label="展开 TileSim 助手" @click="setState('open')">展开</button>
        <button type="button" aria-label="关闭 TileSim 助手" @click="setState('closed')">关闭</button>
      </div>
    </template>

    <template v-else>
      <header class="agent-copilot-shell__header">
        <div>
          <span>TileSim 助手</span>
          <strong>{{ currentTask }}</strong>
        </div>
        <div class="agent-copilot-shell__header-actions">
          <button type="button" @click="setState('collapsed')">收起</button>
          <button
            type="button"
            :aria-pressed="modelValue === 'expanded'"
            @click="setState(modelValue === 'expanded' ? 'open' : 'expanded')"
          >
            {{ modelValue === "expanded" ? "恢复" : "展开" }}
          </button>
          <button type="button" @click="setState('closed')">关闭</button>
        </div>
      </header>

      <AgentContextBar :context="context" :attachment-status="attachmentStatus" />

      <div class="agent-copilot-shell__timeline" role="log" aria-live="polite" aria-relevant="additions text">
        <AgentTypedBlockList :blocks="blocks" @answer="emit('answer', $event)" />
      </div>

      <AgentComposer
        ref="composer"
        :disabled="composerDisabled"
        :disabled-reason="composerDisabledReason"
        :allow-draft="canDraft"
        @submit="submit"
      />

      <footer class="agent-copilot-shell__footer" role="status" aria-live="polite">
        <span>{{ statusText }}</span>
        <span>仅生成草案 · 不会开始运行</span>
      </footer>
    </template>
  </aside>
</template>

<style scoped>
.agent-copilot-shell {
  position: relative;
  z-index: 35;
  width: var(--agent-copilot-panel-width);
  min-width: 0;
  max-width: calc(100vw - 48px);
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  border-left: 1px solid var(--line-strong);
  color: var(--ink);
  background: var(--panel);
  box-shadow: -8px 0 24px rgb(20 33 44 / 8%);
  overflow: hidden;
}

.agent-copilot-shell--expanded {
  box-shadow: -12px 0 34px rgb(20 33 44 / 12%);
}

.agent-copilot-shell--collapsed {
  width: 52px;
  grid-template-rows: 1fr;
}

.agent-copilot-shell__resize {
  position: absolute;
  z-index: 2;
  inset: 0 auto 0 -5px;
  width: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  touch-action: none;
}

.agent-copilot-shell__resize::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 4px;
  width: 1px;
  background: transparent;
}

.agent-copilot-shell__resize:hover::after,
.agent-copilot-shell__resize:focus-visible::after {
  background: var(--accent);
}

.agent-copilot-shell__header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
  padding: 9px 10px 9px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.agent-copilot-shell__header > div:first-child {
  display: grid;
  min-width: 0;
}

.agent-copilot-shell__header > div:first-child span {
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-copilot-shell__header > div:first-child strong {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-copilot-shell__header-actions {
  display: flex;
  gap: 3px;
}

.agent-copilot-shell__header-actions button,
.agent-copilot-shell__rail button {
  min-height: 32px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: transparent;
  cursor: pointer;
  font-size: var(--text-xs);
}

.agent-copilot-shell__header-actions button:hover,
.agent-copilot-shell__rail button:hover {
  border-color: var(--line);
  color: var(--ink);
  background: var(--surface-muted);
}

.agent-copilot-shell__timeline {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--panel);
}

.agent-copilot-shell__footer {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 10px;
  padding: 6px 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: var(--surface-subtle);
  font-size: var(--text-micro);
}

.agent-copilot-shell__footer span {
  overflow-wrap: anywhere;
}

.agent-copilot-shell__rail {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  padding: 14px 5px;
}

.agent-copilot-shell__rail > strong {
  color: var(--accent);
  font-size: var(--text-xs);
}

.agent-copilot-shell__rail-status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--positive);
}

.agent-copilot-shell__rail-status[data-stale="true"] {
  background: var(--warning);
}

.agent-copilot-shell__rail button {
  min-width: 34px;
  padding: 5px 3px;
  writing-mode: vertical-rl;
}

@media (max-width: 720px) {
  .agent-copilot-shell:not(.agent-copilot-shell--collapsed) {
    width: calc(100vw - 16px);
    max-width: none;
  }

  .agent-copilot-shell__header {
    align-items: flex-start;
  }

  .agent-copilot-shell__header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-copilot-shell,
  .agent-copilot-shell * {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
