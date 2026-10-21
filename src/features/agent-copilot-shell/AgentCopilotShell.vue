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
import {
  AgentHarnessOperationCard,
  AgentHarnessTaskCenter,
  AgentHarnessToolTimeline,
  AgentHarnessOptimizationPanel,
  AgentHarnessBatchPanel,
} from "../agent-harness";
import type {
  AgentHarnessBatchDetail,
  AgentHarnessBatchSession,
  AgentHarnessOptimizationDetail,
  AgentHarnessOptimizationSession,
} from "../../lib/api/agent-harness";
import type {
  AgentHarnessDraftTaskCenterItem,
  AgentHarnessTaskCenterItem,
  AgentHarnessExecutionTaskCenterItem,
  AgentHarnessToolTimelineItem,
} from "../agent-harness";
import type { AgentHarnessOperationProjection } from "../../lib/api/agent-harness";
import type {
  AgentCopilotPanelState,
  AgentCopilotSubmitPayload,
  AgentSessionSummary,
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
    /** Locally persisted conversations available to this assistant panel. */
    sessions?: readonly AgentSessionSummary[];
    /** The conversation whose messages and blocks are currently displayed. */
    activeSessionId?: string;
    /** True when this browser rejected the local persistence write. */
    persistenceError?: boolean;
    /** Human-readable local retention policy for the visible session cache. */
    retentionNotice?: string;
    /** Whether the Bridge published the Harness surface for this session. */
    harnessAvailable?: boolean;
    /** Optional formal v1 read-only Harness observation; null keeps the sidebar proposal-only. */
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
    currentTask: "当前页面助手",
    statusLabel: "可以开始",
    initialWidth: 420,
    minimumWidth: 340,
    maximumWidth: 760,
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
  /** The user pressed "应用到面板" on a parameter-edits block. */
  apply: [blockId: string];
  /** The user stopped a streamed answer. */
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
  start: [task: "configure" | "analyze" | "learn"];
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

/** The one id the model label points at; the panel is a single instance in this app. */
const modelSelectId = "tilesim-agent-model-select";
const sessionSelectId = "tilesim-agent-session-select";

const composer = ref<InstanceType<typeof AgentComposer> | null>(null);
const panel = ref<HTMLElement | null>(null);
const timeline = ref<HTMLElement | null>(null);
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

/**
 * The identities the select offers.
 *
 * The identity actually in force is always kept in the list even when the service no longer publishes
 * it: a control that silently showed a different model than the one answering would be a lie about the
 * thing the user is looking at. A catalogue that could not be read is offered as nothing at all -
 * showing the current identity as the only, unselectable option would hide the way to try again.
 */
const modelOptions = computed(() => {
  const published = props.modelCatalogue;
  if (!published.length) return published;
  const selected = props.modelSelected;
  if (!selected || published.includes(selected)) return published;
  return [selected, ...published];
});

/** What the panel says when it has no list to offer: a reason, and what is still answering. */
const modelUnavailableText = computed(() =>
  props.modelSelected ? `模型列表暂时读不到，仍在用 ${props.modelSelected}` : "模型列表暂时读不到",
);

function onModelChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.value) emit("select-model", target.value);
}

function onOptimizationApprove(sessionId: string, candidateId: string): void {
  emit("optimization-approve", sessionId, candidateId);
}
function onOptimizationPause(sessionId: string): void {
  emit("optimization-pause", sessionId);
}
function onOptimizationResume(sessionId: string): void {
  emit("optimization-resume", sessionId);
}
function onOptimizationRetry(sessionId: string): void {
  emit("optimization-retry", sessionId);
}
function onOptimizationCancel(sessionId: string): void {
  emit("optimization-cancel", sessionId);
}
function onBatchCreate(payload: {
  candidateSetText: string;
  objectivePath: string;
  direction: "minimize" | "maximize";
}): void {
  emit("batch-create", payload);
}

function onSessionChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.value) emit("select-session", target.value);
}

watch(
  contentSignature,
  (next, previous) => {
    if (next !== previous || attachedContext.value === null) {
      attachedContext.value = props.context ? clonePageContextEnvelope(props.context) : null;
    }
  },
  { immediate: true },
);

/**
 * Keeps a growing answer in view without fighting the user.
 *
 * The follow is decided from the position *before* the new content was laid out, so a reader who
 * scrolled up to re-read an earlier turn is left where they are, while a reader at the bottom watches
 * the answer being written.
 */
watch(
  () => props.blocks,
  () => {
    const element = timeline.value;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > 120) return;
    void nextTick(() => {
      element.scrollTop = element.scrollHeight;
    });
  },
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

function submit(payload: { instruction: string }): void {
  attachedContext.value = props.context ? clonePageContextEnvelope(props.context) : null;
  emit("submit", {
    instruction: payload.instruction,
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

    <div v-show="modelValue === 'collapsed'" class="agent-copilot-shell__rail">
      <strong aria-hidden="true">AI</strong>
      <span class="agent-copilot-shell__rail-status" :data-stale="attachmentStatus.state === 'stale'"></span>
      <button type="button" aria-label="展开 TileSim 助手" @click="setState('open')">展开</button>
      <button type="button" aria-label="关闭 TileSim 助手" @click="setState('closed')">关闭</button>
    </div>

    <header v-show="modelValue !== 'collapsed'" class="agent-copilot-shell__header">
      <div>
        <span>小拓 · TileSim 助手</span>
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

    <div
      v-if="sessions.length"
      v-show="modelValue !== 'collapsed'"
      class="agent-copilot-shell__sessions"
      data-agent-sessions
    >
      <label :for="sessionSelectId">会话</label>
      <select :id="sessionSelectId" :value="activeSessionId" title="切换已保存的助手会话" @change="onSessionChange">
        <option v-for="session in sessions" :key="session.id" :value="session.id">
          {{ session.title }}{{ session.message_count ? ` · ${session.message_count} 条消息` : "" }}
        </option>
      </select>
      <button type="button" aria-label="新建会话" title="新建会话" @click="emit('new-session')">新建</button>
      <button
        type="button"
        aria-label="删除当前会话"
        title="删除当前会话"
        @click="emit('delete-session', activeSessionId)"
      >
        删除
      </button>
      <button type="button" aria-label="清理全部本地会话" title="清理全部本地会话" @click="emit('clear-all-sessions')">
        清理全部
      </button>
      <p v-if="retentionNotice" class="agent-copilot-shell__retention">{{ retentionNotice }}</p>
    </div>

    <div v-if="modelChannel && modelValue !== 'collapsed'" class="agent-copilot-shell__model" data-agent-model-bar>
      <label :for="modelSelectId">模型</label>
      <template v-if="modelOptions.length">
        <select
          :id="modelSelectId"
          :value="modelSelected"
          :disabled="modelPending"
          title="选择本次会话使用的模型；切换只在后端本次运行期间有效，要长期生效请在启动器里保存"
          @change="onModelChange"
        >
          <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
        </select>
        <span>{{ modelPending ? "正在切换…" : "本次运行有效" }}</span>
      </template>
      <template v-else>
        <span>{{ modelPending ? "正在读取模型列表…" : modelUnavailableText }}</span>
        <button type="button" :disabled="modelPending" @click="emit('refresh-models')">重试</button>
      </template>
    </div>

    <AgentContextBar v-show="modelValue !== 'collapsed'" :context="context" :attachment-status="attachmentStatus" />

    <div v-if="harnessAvailable" v-show="modelValue !== 'collapsed'" class="agent-copilot-shell__harness">
      <AgentHarnessOperationCard v-if="harnessProjection" :projection="harnessProjection" />
      <AgentHarnessToolTimeline :items="harnessToolTimeline" />
      <AgentHarnessTaskCenter
        v-if="harnessTaskCenter.length || harnessDrafts.length || harnessExecutions.length"
        :items="harnessTaskCenter"
        :drafts="harnessDrafts"
        :executions="harnessExecutions"
        @cancel="emit('execution-cancel', $event)"
        @retry="emit('execution-retry', $event)"
        @resume="emit('execution-resume', $event)"
      />
      <AgentHarnessOptimizationPanel
        :sessions="optimizationSessions"
        :detail="optimizationDetail"
        :pending="optimizationPending"
        :create-pending="optimizationCreatePending"
        @approve="onOptimizationApprove"
        @pause="onOptimizationPause"
        @resume="onOptimizationResume"
        @retry="onOptimizationRetry"
        @cancel="onOptimizationCancel"
        @create="emit('optimization-create', $event)"
      />
      <AgentHarnessBatchPanel
        :batches="batchSessions"
        :detail="batchDetail"
        :pending="batchPending"
        :create-pending="batchCreatePending"
        @create="onBatchCreate"
        @approve="emit('batch-approve', $event)"
        @start="emit('batch-start', $event)"
        @pause="emit('batch-pause', $event)"
        @resume="emit('batch-resume', $event)"
        @retry="emit('batch-retry', $event)"
        @cancel="emit('batch-cancel', $event)"
      />
    </div>

    <div
      v-show="modelValue !== 'collapsed'"
      ref="timeline"
      class="agent-copilot-shell__timeline"
      role="log"
      aria-live="off"
      aria-label="助手对话记录"
    >
      <AgentTypedBlockList
        :blocks="blocks"
        @answer="emit('answer', $event)"
        @apply="emit('apply', $event)"
        @start="emit('start', $event)"
      />
    </div>

    <AgentComposer
      v-show="modelValue !== 'collapsed'"
      ref="composer"
      :disabled="composerDisabled"
      :disabled-reason="composerDisabledReason"
      :busy="busy"
      @submit="submit"
      @cancel="emit('cancel')"
    />

    <div v-show="modelValue !== 'collapsed'" class="agent-copilot-shell__footer" aria-live="polite" aria-atomic="true">
      <span>{{ statusText }}</span>
      <span v-if="persistenceError" class="agent-copilot-shell__persistence-warning">
        本机存储不可用，本次对话只保留到页面关闭
      </span>
      <span v-if="allowParameterEdit">描述场景或接着追问 · 仅在确认后写入，不会创建运行</span>
      <span v-else>{{ canDraft ? "仅生成草案 · 不会开始运行" : "仅解释当前页面 · 不会修改实验或开始运行" }}</span>
    </div>
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
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line-strong);
  color: var(--ink);
  background: var(--panel);
  box-shadow: -8px 0 24px rgb(20 33 44 / 8%);
  overflow: hidden;
  animation: agent-panel-in 260ms var(--ease-emphasized) backwards;
}

.agent-copilot-shell--expanded {
  box-shadow: -12px 0 34px rgb(20 33 44 / 12%);
}

.agent-copilot-shell--collapsed {
  width: 52px;
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
  box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent);
}

.agent-copilot-shell__header > div:first-child {
  display: grid;
  min-width: 0;
}

.agent-copilot-shell__header > div:first-child span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-copilot-shell__header > div:first-child span::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 13%, transparent);
}

.agent-copilot-shell__header > div:first-child strong {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-copilot-shell__header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 3px;
  white-space: nowrap;
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

.agent-copilot-shell__header-actions button,
.agent-copilot-shell__rail button {
  transition:
    color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized);
}

.agent-copilot-shell__header-actions button:hover,
.agent-copilot-shell__rail button:hover {
  transform: translateY(-1px);
}

.agent-copilot-shell__model {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  background: var(--surface-subtle);
  font-size: var(--text-micro);
}

.agent-copilot-shell__sessions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  background: var(--panel);
  font-size: var(--text-micro);
}

.agent-copilot-shell__sessions label {
  flex: 0 0 auto;
}

.agent-copilot-shell__sessions select {
  min-width: 0;
  flex: 1 1 auto;
  padding: 4px 6px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  font: inherit;
  text-overflow: ellipsis;
}

.agent-copilot-shell__sessions button {
  flex: 0 0 auto;
  min-height: 27px;
  padding: 3px 7px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: var(--panel);
  cursor: pointer;
  font: inherit;
}

.agent-copilot-shell__sessions button:hover {
  border-color: var(--accent);
  color: var(--ink);
  background: var(--surface-muted);
}

.agent-copilot-shell__model label {
  flex: 0 0 auto;
}

.agent-copilot-shell__model select {
  min-width: 0;
  flex: 1 1 auto;
  max-width: 100%;
  padding: 3px 6px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  font: inherit;
}

.agent-copilot-shell__model select:disabled {
  color: var(--muted);
}

.agent-copilot-shell__model span {
  flex: 0 0 auto;
  overflow-wrap: anywhere;
  text-align: right;
}

.agent-copilot-shell__retention {
  flex: 1 1 100%;
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.agent-copilot-shell__harness {
  flex: 0 1 min(34dvh, 420px);
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--line-strong) transparent;
}

.agent-copilot-shell__harness > :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.agent-copilot-shell__model button {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 2px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  cursor: pointer;
  font: inherit;
}

.agent-copilot-shell__model button:disabled {
  cursor: default;
  color: var(--muted);
}

.agent-copilot-shell__timeline {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--surface-subtle) 88%, var(--canvas));
  scrollbar-color: var(--line-strong) transparent;
}

/* Grid items otherwise retain their min-content width. Long evidence paths and
   model responses must wrap inside the bounded panel instead of widening its
   fixed host by a few pixels. */
.agent-copilot-shell__timeline > :deep(*) {
  min-width: 0;
  max-width: 100%;
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

@keyframes agent-panel-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.agent-copilot-shell__footer span {
  overflow-wrap: anywhere;
}

.agent-copilot-shell__persistence-warning {
  color: var(--warning);
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

@media (min-width: 721px) and (max-width: 1599px) {
  .agent-copilot-shell {
    width: min(var(--agent-copilot-panel-width), 48vw);
  }

  /* The scoped media rule has the same specificity as the base collapsed
     rule; keep the rail narrow instead of restoring the open panel width. */
  .agent-copilot-shell.agent-copilot-shell--collapsed {
    width: 52px;
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
