<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, shallowRef, watch } from "vue";
import type { PageContextEnvelope } from "../../entities/agent-context";
import AgentCopilotErrorBoundary from "./AgentCopilotErrorBoundary.vue";
import type {
  AgentHarnessOperationProjection,
  AgentHarnessOptimizationDetail,
  AgentHarnessOptimizationSession,
  AgentHarnessBatchDetail,
  AgentHarnessBatchSession,
} from "../../lib/api/agent-harness";
import type {
  AgentHarnessDraftTaskCenterItem,
  AgentHarnessExecutionTaskCenterItem,
  AgentHarnessTaskCenterItem,
  AgentHarnessToolTimelineItem,
} from "../agent-harness";
import type {
  AgentCopilotPanelState,
  AgentCopilotSubmitPayload,
  AgentSessionSummary,
  AgentTypedBlock,
} from "../../entities/agent-orchestration";

type LazyAgentCopilotModule = { default: object };

const props = withDefaults(
  defineProps<{
    modelValue?: AgentCopilotPanelState;
    context: PageContextEnvelope | null;
    blocks: readonly AgentTypedBlock[];
    flowResumePending?: boolean;
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
    sessions?: readonly AgentSessionSummary[];
    activeSessionId?: string;
    persistenceError?: boolean;
    retentionNotice?: string;
    harnessAvailable?: boolean;
    harnessProjection?: AgentHarnessOperationProjection | null;
    harnessToolTimeline?: readonly AgentHarnessToolTimelineItem[];
    harnessTaskCenter?: readonly AgentHarnessTaskCenterItem[];
    harnessDrafts?: readonly AgentHarnessDraftTaskCenterItem[];
    harnessExecutions?: readonly AgentHarnessExecutionTaskCenterItem[];
    optimizationSessions?: readonly AgentHarnessOptimizationSession[];
    optimizationDetail?: AgentHarnessOptimizationDetail | null;
    optimizationPending?: boolean;
    optimizationCreatePending?: boolean;
    batchSessions?: readonly AgentHarnessBatchSession[];
    batchDetail?: AgentHarnessBatchDetail | null;
    batchPending?: boolean;
    batchCreatePending?: boolean;
  }>(),
  {
    modelValue: "closed",
    currentTask: "当前页面助手",
    flowResumePending: false,
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
    sessions: () => [],
    activeSessionId: "",
    persistenceError: false,
    retentionNotice: "",
    harnessAvailable: true,
    harnessProjection: null,
    harnessToolTimeline: () => [],
    harnessTaskCenter: () => [],
    harnessDrafts: () => [],
    harnessExecutions: () => [],
    optimizationSessions: () => [],
    optimizationDetail: null,
    optimizationPending: false,
    optimizationCreatePending: false,
    batchSessions: () => [],
    batchDetail: null,
    batchPending: false,
    batchCreatePending: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [state: AgentCopilotPanelState];
  submit: [payload: AgentCopilotSubmitPayload];
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  apply: [blockId: string];
  "report-confirm": [blockId: string];
  "flow-resume": [
    payload: {
      blockId: string;
      action: "clarify_intent" | "confirm_report" | "confirm_draft" | "cancel" | "reject";
      intent?: "explain" | "existing_run_analysis" | "user_report" | "configuration_draft";
    },
  ];
  "navigation-confirm": [blockId: string];
  "navigation-cancel": [blockId: string];
  cancel: [];
  resize: [width: number];
  /** The user picked one of the published model identities. */
  "select-model": [model: string];
  /** The user asked for the model catalogue to be read again. */
  "refresh-models": [];
  "new-session": [];
  "select-session": [sessionId: string];
  "delete-session": [sessionId: string];
  "clear-all-sessions": [];
  start: [task: "capabilities" | "configure" | "analyze"];
  "execution-cancel": [operationId: string];
  "execution-retry": [operationId: string];
  "execution-resume": [operationId: string];
  "optimization-approve": [sessionId: string, candidateId: string];
  "optimization-pause": [sessionId: string];
  "optimization-resume": [sessionId: string];
  "optimization-retry": [sessionId: string];
  "optimization-cancel": [sessionId: string];
  "optimization-create": [
    payload: { objectivePath: string; direction: "minimize" | "maximize"; baseConfigText: string },
  ];
  "batch-approve": [batchId: string];
  "batch-start": [batchId: string];
  "batch-pause": [batchId: string];
  "batch-resume": [batchId: string];
  "batch-retry": [batchId: string];
  "batch-cancel": [batchId: string];
  "batch-create": [payload: { candidateSetText: string; objectivePath: string; direction: "minimize" | "maximize" }];
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

function forwardOptimizationApprove(sessionId: string, candidateId: string): void {
  emit("optimization-approve", sessionId, candidateId);
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
      aria-label="打开 TileSim 助手"
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
          :flow-resume-pending="flowResumePending"
          :current-task="currentTask"
          :status-label="statusLabel"
          :initial-width="initialWidth"
          :allow-parameter-edit="allowParameterEdit"
          :busy="busy"
          :model-channel="modelChannel"
          :model-catalogue="modelCatalogue"
          :model-selected="modelSelected"
          :model-pending="modelPending"
          :sessions="sessions"
          :active-session-id="activeSessionId"
          :persistence-error="persistenceError"
          :retention-notice="retentionNotice"
          :harness-available="harnessAvailable"
          :harness-projection="harnessProjection"
          :harness-tool-timeline="harnessToolTimeline"
          :harness-task-center="harnessTaskCenter"
          :harness-drafts="harnessDrafts"
          :harness-executions="harnessExecutions"
          :optimization-sessions="optimizationSessions"
          :optimization-detail="optimizationDetail"
          :optimization-pending="optimizationPending"
          :optimization-create-pending="optimizationCreatePending"
          :batch-sessions="batchSessions"
          :batch-detail="batchDetail"
          :batch-pending="batchPending"
          :batch-create-pending="batchCreatePending"
          @update:model-value="setState"
          @submit="emit('submit', $event)"
          @answer="emit('answer', $event)"
          @apply="emit('apply', $event)"
          @report-confirm="emit('report-confirm', $event)"
          @flow-resume="emit('flow-resume', $event)"
          @navigation-confirm="emit('navigation-confirm', $event)"
          @navigation-cancel="emit('navigation-cancel', $event)"
          @cancel="emit('cancel')"
          @resize="emit('resize', $event)"
          @select-model="emit('select-model', $event)"
          @refresh-models="emit('refresh-models')"
          @new-session="emit('new-session')"
          @select-session="emit('select-session', $event)"
          @delete-session="emit('delete-session', $event)"
          @clear-all-sessions="emit('clear-all-sessions')"
          @start="emit('start', $event)"
          @execution-cancel="emit('execution-cancel', $event)"
          @execution-retry="emit('execution-retry', $event)"
          @execution-resume="emit('execution-resume', $event)"
          @optimization-approve="forwardOptimizationApprove"
          @optimization-pause="emit('optimization-pause', $event)"
          @optimization-resume="emit('optimization-resume', $event)"
          @optimization-retry="emit('optimization-retry', $event)"
          @optimization-cancel="emit('optimization-cancel', $event)"
          @optimization-create="emit('optimization-create', $event)"
          @batch-approve="emit('batch-approve', $event)"
          @batch-start="emit('batch-start', $event)"
          @batch-pause="emit('batch-pause', $event)"
          @batch-resume="emit('batch-resume', $event)"
          @batch-retry="emit('batch-retry', $event)"
          @batch-cancel="emit('batch-cancel', $event)"
          @batch-create="emit('batch-create', $event)"
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
  min-height: 42px;
  padding: 8px 13px 8px 38px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line-strong));
  border-radius: 10px;
  color: var(--nav-text);
  background: var(--nav);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  font-weight: 600;
}

.agent-copilot-entry__trigger::before {
  position: absolute;
  width: 20px;
  height: 20px;
  margin-left: -27px;
  border-radius: 7px;
  color: var(--nav);
  background: var(--hero-accent, var(--accent));
  content: "✦";
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.agent-copilot-entry__trigger:hover {
  border-color: var(--accent);
  background: var(--nav-soft);
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
  flex: 0 0 58px;
  width: 58px;
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
