<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, shallowRef, watch } from "vue";
import type { PageContextEnvelope } from "../../entities/agent-context";
import AgentCopilotErrorBoundary from "./AgentCopilotErrorBoundary.vue";
import type {
  AgentCopilotPanelState,
  AgentCopilotSubmitPayload,
  AgentTypedBlock,
} from "../../entities/agent-orchestration";

type LazyAgentCopilotModule = { default: object };

const props = withDefaults(
  defineProps<{
    modelValue?: AgentCopilotPanelState;
    context: PageContextEnvelope | null;
    blocks: readonly AgentTypedBlock[];
    currentTask?: string;
    statusLabel?: string;
    initialWidth?: number;
    focusOnOpen?: boolean;
    loader?: () => Promise<LazyAgentCopilotModule>;
  }>(),
  {
    modelValue: "closed",
    currentTask: "当前页面助手",
    statusLabel: "可以开始",
    initialWidth: 420,
    focusOnOpen: false,
    loader: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [state: AgentCopilotPanelState];
  submit: [payload: AgentCopilotSubmitPayload];
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  resize: [width: number];
}>();

const state = shallowRef<AgentCopilotPanelState>(props.modelValue);
const component = shallowRef<object | null>(null);
const componentKey = shallowRef(0);
const loading = shallowRef(false);
const loadError = shallowRef(false);
const shell = shallowRef<{ focusComposer?: () => Promise<void> } | null>(null);
const trigger = shallowRef<HTMLButtonElement | null>(null);
let lastTrigger: HTMLElement | null = null;

const shouldMount = computed(() => Boolean(component.value));

watch(
  () => props.modelValue,
  (value) => {
    state.value = value;
    if (value !== "closed") void ensureLoaded();
  },
);

async function defaultLoader(): Promise<LazyAgentCopilotModule> {
  return import("./AgentCopilotShell.vue");
}

function setLoadedComponent(value: object): void {
  component.value = markRaw(value);
}

async function ensureLoaded(): Promise<void> {
  if (component.value || loading.value) return;
  loading.value = true;
  loadError.value = false;
  try {
    const module = await (props.loader || defaultLoader)();
    setLoadedComponent(module.default);
    await nextTick();
    if (props.focusOnOpen) await shell.value?.focusComposer?.();
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function setState(next: AgentCopilotPanelState): void {
  const previous = state.value;
  state.value = next;
  emit("update:modelValue", next);
  if (next !== "closed") {
    if (previous === "closed")
      lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void ensureLoaded();
  } else {
    void restoreFocus();
  }
}

async function open(): Promise<void> {
  lastTrigger = trigger.value;
  setState("open");
  await ensureLoaded();
}

async function restoreFocus(): Promise<void> {
  await nextTick();
  (lastTrigger || trigger.value)?.focus();
}

function retryLoad(): void {
  component.value = null;
  loadError.value = false;
  componentKey.value += 1;
  void ensureLoaded();
}

function retryBoundary(): void {
  componentKey.value += 1;
}

defineExpose({ open, state, isLoaded: shouldMount });

onMounted(() => {
  if (state.value !== "closed") void ensureLoaded();
});
</script>

<template>
  <div class="agent-copilot-entry" :data-state="state">
    <button
      v-show="state === 'closed'"
      ref="trigger"
      class="agent-copilot-entry__trigger"
      type="button"
      aria-controls="tilesim-agent-copilot"
      :aria-expanded="state !== 'closed'"
      @click="open"
    >
      打开 TileSim 助手
    </button>

    <aside v-if="loading && !shouldMount" class="agent-copilot-entry__loading" aria-label="TileSim 助手" role="status">
      正在载入助手侧栏…
    </aside>

    <aside
      v-else-if="loadError && !shouldMount"
      class="agent-copilot-entry__error"
      aria-label="TileSim 助手"
      role="alert"
    >
      <strong>助手侧栏载入失败</strong>
      <span>主工作台未受影响。</span>
      <div>
        <button type="button" @click="retryLoad">重试</button>
        <button type="button" @click="setState('closed')">关闭</button>
      </div>
    </aside>

    <div v-if="shouldMount" v-show="state !== 'closed'" class="agent-copilot-entry__panel-host">
      <AgentCopilotErrorBoundary @retry="retryBoundary" @close="setState('closed')">
        <component
          :is="component"
          :key="componentKey"
          ref="shell"
          :model-value="state"
          :context="context"
          :blocks="blocks"
          :current-task="currentTask"
          :status-label="statusLabel"
          :initial-width="initialWidth"
          @update:model-value="setState"
          @submit="emit('submit', $event)"
          @answer="emit('answer', $event)"
          @resize="emit('resize', $event)"
        />
      </AgentCopilotErrorBoundary>
    </div>
  </div>
</template>

<style scoped>
.agent-copilot-entry {
  position: fixed;
  z-index: 34;
  inset: 0 0 auto auto;
  display: flex;
  justify-content: flex-end;
  max-width: 100vw;
}

.agent-copilot-entry__trigger {
  position: fixed;
  right: 16px;
  bottom: 16px;
  margin: 0;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  font-weight: 600;
}

.agent-copilot-entry__trigger:hover {
  border-color: var(--accent);
  background: var(--surface-muted);
}

.agent-copilot-entry__panel-host {
  min-width: 0;
  height: 100dvh;
}

.agent-copilot-entry__loading,
.agent-copilot-entry__error {
  width: min(420px, calc(100vw - 48px));
  min-height: 120px;
  padding: 18px;
  border-left: 1px solid var(--line-strong);
  color: var(--ink);
  background: var(--panel);
}

.agent-copilot-entry__error {
  display: grid;
  align-content: start;
  gap: 4px;
  border-left-color: var(--danger);
}

.agent-copilot-entry__error span {
  color: var(--muted);
}

.agent-copilot-entry__error div {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.agent-copilot-entry__error button {
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .agent-copilot-entry,
  .agent-copilot-entry * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
