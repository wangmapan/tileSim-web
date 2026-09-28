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
    /** Whether the current page can accept parameter edits (prototype). */
    allowParameterEdit?: boolean;
    /** True while a streamed assistant answer is still arriving. */
    busy?: boolean;
    /** Whether this Bridge publishes an assistant model channel at all. */
    modelChannel?: boolean;
    /** The model identities the channel publishes; empty means the list could not be read. */
    modelCatalogue?: readonly string[];
    /** The identity the next answer will use. */
    modelSelected?: string;
    /** True while the catalogue is being read or a switch is being applied. */
    modelPending?: boolean;
  }>(),
  {
    modelValue: "closed",
    currentTask: "当前页面助手",
    statusLabel: "可以开始",
    initialWidth: 420,
    focusOnOpen: false,
    loader: undefined,
    allowParameterEdit: false,
    busy: false,
    modelChannel: false,
    modelCatalogue: () => [],
    modelSelected: "",
    modelPending: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [state: AgentCopilotPanelState];
  submit: [payload: AgentCopilotSubmitPayload];
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  apply: [blockId: string];
  cancel: [];
  resize: [width: number];
  /** The user picked one of the published model identities. */
  "select-model": [model: string];
  /** The user asked for the model catalogue to be read again. */
  "refresh-models": [];
  start: [task: "configure" | "analyze" | "learn"];
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
          :allow-parameter-edit="allowParameterEdit"
          :busy="busy"
          :model-channel="modelChannel"
          :model-catalogue="modelCatalogue"
          :model-selected="modelSelected"
          :model-pending="modelPending"
          @update:model-value="setState"
          @submit="emit('submit', $event)"
          @answer="emit('answer', $event)"
          @apply="emit('apply', $event)"
          @cancel="emit('cancel')"
          @resize="emit('resize', $event)"
          @select-model="emit('select-model', $event)"
          @refresh-models="emit('refresh-models')"
          @start="emit('start', $event)"
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
  /* The fixed host can retain the panel's intrinsic width while the panel
     itself is collapsed to a narrow rail. Let clicks pass through that
     transparent host area so workspace controls underneath remain usable. */
  pointer-events: none;
  overflow-x: hidden;
}

.agent-copilot-entry > * {
  pointer-events: auto;
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
  max-width: 100%;
  height: 100dvh;
  overflow-x: hidden;
}

/* v-show keeps the shell mounted while it is collapsed. Constrain the flex
   host to the rail width as well; otherwise its old open width remains a
   pointer-event surface over the workspace controls beneath it. */
.agent-copilot-entry[data-state="collapsed"] .agent-copilot-entry__panel-host {
  flex: 0 0 52px;
  width: 52px;
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
