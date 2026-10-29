<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  clonePageContextEnvelope,
  compareAgentContexts,
  type AgentContextAttachmentStatus,
  type PageContextEnvelope,
} from "../../entities/agent-context";
import AgentComposer from "./AgentComposer.vue";
import AgentTypedBlockList from "./AgentTypedBlockList.vue";
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
    flowResumePending?: boolean;
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
    flowResumePending: false,
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
  "report-confirm": [blockId: string];
  "flow-resume": [
    payload: {
      blockId: string;
      action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | "cancel" | "reject";
      intent?: "explain" | "existing_run_analysis" | "user_report" | "configuration_draft";
    },
  ];
  "navigation-confirm": [blockId: string];
  "navigation-cancel": [blockId: string];
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
    :class="[`agent-copilot-shell--${modelValue}`, { 'is-resizing': resizing }]"
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

    <header
      v-show="modelValue !== 'collapsed'"
      class="agent-copilot-shell__header"
      :data-busy="busy"
      :data-context-state="attachmentStatus.state"
    >
      <div class="agent-copilot-shell__brand">
        <span class="agent-copilot-shell__brandline">
          <span class="agent-copilot-shell__brandmark" aria-hidden="true">✦</span>
          <span>小拓 · TileSim 助手</span>
          <span
            v-if="busy || attachmentStatus.state === 'stale'"
            class="agent-copilot-shell__presence"
            aria-hidden="true"
          ></span>
          <em v-if="busy || attachmentStatus.state === 'stale'">
            {{ busy ? "生成中" : "页面已更新" }}
          </em>
        </span>
        <strong>告诉我你想做什么</strong>
      </div>
      <div class="agent-copilot-shell__header-actions">
        <button type="button" title="收起助手侧栏" @click="setState('collapsed')">收起</button>
        <button
          type="button"
          :aria-pressed="modelValue === 'expanded'"
          :title="modelValue === 'expanded' ? '恢复标准宽度' : '展开助手侧栏'"
          @click="setState(modelValue === 'expanded' ? 'open' : 'expanded')"
        >
          {{ modelValue === "expanded" ? "恢复" : "展开" }}
        </button>
        <button type="button" title="关闭助手侧栏" @click="setState('closed')">关闭</button>
      </div>
    </header>

    <details
      v-if="modelValue !== 'collapsed' && (sessions.length || modelChannel)"
      class="agent-copilot-shell__settings"
    >
      <summary>设置</summary>
      <div v-if="sessions.length" class="agent-copilot-shell__sessions" data-agent-sessions>
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
        <button
          type="button"
          aria-label="清理全部本地会话"
          title="清理全部本地会话"
          @click="emit('clear-all-sessions')"
        >
          清理全部
        </button>
        <p v-if="retentionNotice" class="agent-copilot-shell__retention">{{ retentionNotice }}</p>
      </div>

      <div v-if="modelChannel" class="agent-copilot-shell__model" data-agent-model-bar>
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
    </details>

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
        :flow-resume-pending="flowResumePending"
        @answer="emit('answer', $event)"
        @apply="emit('apply', $event)"
        @report-confirm="emit('report-confirm', $event)"
        @flow-resume="emit('flow-resume', $event)"
        @navigation-confirm="emit('navigation-confirm', $event)"
        @navigation-cancel="emit('navigation-cancel', $event)"
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
  --agent-header-bg: #102b3e;
  --agent-header-text: #eff8fb;
  --agent-header-soft: #c7dbe5;
  --agent-header-muted: #91aebb;
  --agent-ink: var(--ink);
  --agent-panel: var(--panel);
  position: relative;
  z-index: 35;
  width: var(--agent-copilot-panel-width);
  min-width: 0;
  max-width: calc(100vw - 48px);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  border-left: 1px solid color-mix(in srgb, var(--agent-header-bg) 28%, var(--line-strong));
  color: var(--agent-ink);
  background: var(--agent-panel);
  box-shadow: -16px 0 40px rgb(18 31 43 / 14%);
  overflow: hidden;
  transition:
    width var(--motion-panel, 220ms) var(--ease-emphasized, ease),
    box-shadow var(--motion-panel, 220ms) var(--ease-standard, ease),
    border-color var(--motion-interaction, 150ms) var(--ease-standard, ease);
  animation: agent-panel-in 320ms var(--ease-emphasized) backwards;
}

.agent-copilot-shell.is-resizing {
  transition: none;
}

.agent-copilot-shell--expanded {
  box-shadow: -20px 0 54px rgb(18 31 43 / 22%);
}

.agent-copilot-shell--collapsed {
  width: 58px;
  border-left-color: var(--nav-border);
  background: var(--agent-header-bg);
}

.agent-copilot-shell__resize {
  position: absolute;
  z-index: 4;
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
  width: 2px;
  background: transparent;
  transition: background-color var(--motion-interaction) var(--ease-standard);
}

.agent-copilot-shell__resize:hover::after,
.agent-copilot-shell__resize:focus-visible::after {
  background: var(--accent);
}

.agent-copilot-shell__header {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  min-height: 86px;
  padding: 16px 14px 15px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--agent-header-text) 15%, var(--agent-header-bg));
  color: var(--agent-header-text);
  background: var(--agent-header-bg);
  box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--accent) 76%, transparent);
  isolation: isolate;
}

.agent-copilot-shell__header::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(108deg, color-mix(in srgb, var(--accent) 18%, transparent), transparent 46%),
    linear-gradient(180deg, transparent 54%, color-mix(in srgb, #000 17%, transparent));
  content: "";
  pointer-events: none;
}

.agent-copilot-shell__header[data-busy="true"]::after {
  position: absolute;
  right: 14px;
  bottom: 0;
  left: 18px;
  height: 2px;
  background: var(--accent);
  content: "";
  animation: agent-header-progress 1.4s var(--ease-standard) infinite;
  transform-origin: left;
}

.agent-copilot-shell__brand {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.agent-copilot-shell__brandline {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  color: var(--agent-header-soft);
  font-size: var(--text-sm);
  line-height: 1.2;
}

.agent-copilot-shell__brandline > span:not(.agent-copilot-shell__brandmark):not(.agent-copilot-shell__presence) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-copilot-shell__brandline em {
  flex: 0 0 auto;
  color: var(--hero-accent, var(--accent));
  font-size: var(--text-xs);
  font-style: normal;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-copilot-shell__brandmark {
  display: grid;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--hero-accent, var(--accent)) 58%, transparent);
  border-radius: 7px;
  color: var(--agent-header-bg);
  background: var(--hero-accent, var(--accent));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-accent, var(--accent)) 13%, transparent);
  font-size: 14px;
  line-height: 1;
}

.agent-copilot-shell__presence,
.agent-copilot-shell__rail-status {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--positive);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--positive) 18%, transparent);
}

.agent-copilot-shell__header[data-context-state="stale"] .agent-copilot-shell__presence,
.agent-copilot-shell__rail-status[data-stale="true"] {
  background: var(--warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 18%, transparent);
}

.agent-copilot-shell__header[data-busy="true"] .agent-copilot-shell__presence {
  animation: agent-presence-pulse 1.1s ease-in-out infinite;
  background: var(--hero-accent, var(--accent));
}

.agent-copilot-shell__brand strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--agent-header-text);
  font-size: 20px;
  line-height: 1.35;
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
  min-height: 30px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  color: var(--agent-header-soft);
  background: transparent;
  cursor: pointer;
  font-size: var(--text-xs);
  transition:
    color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized);
}

.agent-copilot-shell__header-actions button:hover,
.agent-copilot-shell__header-actions button:focus-visible,
.agent-copilot-shell__rail button:hover,
.agent-copilot-shell__rail button:focus-visible {
  border-color: color-mix(in srgb, var(--agent-header-text) 22%, transparent);
  color: var(--agent-header-text);
  background: color-mix(in srgb, var(--agent-header-text) 10%, transparent);
  transform: translateY(-1px);
}

.agent-copilot-shell__header-actions button:last-child:hover,
.agent-copilot-shell__header-actions button:last-child:focus-visible {
  border-color: color-mix(in srgb, var(--danger) 70%, transparent);
  color: var(--danger-ink);
}

.agent-copilot-shell__sessions,
.agent-copilot-shell__model {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid var(--line);
  font-size: var(--text-sm);
}

.agent-copilot-shell__sessions {
  flex-wrap: wrap;
  color: var(--muted);
  background: var(--panel);
}

.agent-copilot-shell__model {
  color: var(--muted);
  background: var(--surface-subtle);
}

.agent-copilot-shell__sessions::before,
.agent-copilot-shell__model::before {
  display: grid;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  color: var(--accent-ink);
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}

.agent-copilot-shell__sessions::before {
  content: "↺";
}

.agent-copilot-shell__model::before {
  content: "◈";
}

.agent-copilot-shell__sessions label,
.agent-copilot-shell__model label {
  flex: 0 0 auto;
  color: var(--ink-soft);
  font-weight: 650;
}

.agent-copilot-shell__sessions select,
.agent-copilot-shell__model select {
  min-width: 0;
  flex: 1 1 auto;
  max-width: 100%;
  padding: 5px 7px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  font: inherit;
  text-overflow: ellipsis;
  transition:
    border-color var(--motion-interaction) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard);
}

.agent-copilot-shell__sessions select:focus-visible,
.agent-copilot-shell__model select:focus-visible {
  border-color: var(--accent);
  outline: none;
  box-shadow: var(--ring);
}

.agent-copilot-shell__sessions button,
.agent-copilot-shell__model button {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: var(--panel);
  cursor: pointer;
  font: inherit;
  transition:
    color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized);
}

.agent-copilot-shell__sessions button:hover,
.agent-copilot-shell__model button:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
  background: var(--accent-soft);
  transform: translateY(-1px);
}

.agent-copilot-shell__model span {
  flex: 0 0 auto;
  max-width: 42%;
  overflow-wrap: anywhere;
  text-align: right;
}

.agent-copilot-shell__settings {
  flex: 0 0 auto;
  min-width: 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
  background: var(--surface-inset);
}

.agent-copilot-shell__settings > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  padding: 6px 14px;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: 650;
  list-style: none;
}

.agent-copilot-shell__settings > summary::-webkit-details-marker {
  display: none;
}

.agent-copilot-shell__settings > summary::after {
  color: var(--muted);
  content: "⌄";
  font-size: 16px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform var(--motion-interaction) var(--ease-standard);
}

.agent-copilot-shell__settings[open] > summary::after {
  transform: rotate(180deg);
}

.agent-copilot-shell__settings > summary:hover,
.agent-copilot-shell__settings > summary:focus-visible {
  color: var(--accent-ink);
  background: var(--surface-muted);
}

.agent-copilot-shell__settings > summary:focus-visible {
  outline: none;
  box-shadow: inset var(--ring);
}

.agent-copilot-shell__retention {
  flex: 1 1 100%;
  margin: 0 0 0 30px;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.agent-copilot-shell__timeline {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: var(--text-md);
  line-height: 1.55;
  background: var(--surface-subtle);
  scrollbar-color: var(--line-strong) transparent;
}

.agent-copilot-shell__timeline::before {
  position: absolute;
  inset: 0 0 auto;
  height: 64px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-subtle) 82%, transparent), transparent);
  content: "";
  pointer-events: none;
}

.agent-copilot-shell__timeline > :deep(*) {
  position: relative;
  min-width: 0;
  max-width: 100%;
}

.agent-copilot-shell__footer {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 10px;
  padding: 7px 14px 8px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: var(--surface-inset);
  font-size: var(--text-xs);
}

.agent-copilot-shell__footer span {
  overflow-wrap: anywhere;
}

.agent-copilot-shell__footer > span:first-child {
  color: var(--accent-ink);
  font-weight: 650;
}

.agent-copilot-shell__persistence-warning {
  color: var(--warning-ink);
}

.agent-copilot-shell__rail {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  padding: 16px 5px;
  color: var(--agent-header-text);
  background: var(--agent-header-bg);
}

.agent-copilot-shell__rail > strong {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--hero-accent, var(--accent)) 55%, transparent);
  border-radius: 8px;
  color: var(--agent-header-bg);
  background: var(--hero-accent, var(--accent));
  font-size: var(--text-xs);
}

.agent-copilot-shell__rail-status {
  width: 7px;
  height: 7px;
}

.agent-copilot-shell__rail button {
  min-width: 36px;
  color: var(--agent-header-soft);
  padding: 6px 3px;
  writing-mode: vertical-rl;
}

@keyframes agent-panel-in {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes agent-header-progress {
  0% {
    opacity: 0.35;
    transform: scaleX(0.2);
  }
  55% {
    opacity: 1;
    transform: scaleX(0.82);
  }
  100% {
    opacity: 0.35;
    transform: scaleX(0.25);
  }
}

@keyframes agent-presence-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 13%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 5%, transparent);
  }
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

  .agent-copilot-shell.agent-copilot-shell--collapsed {
    width: 58px;
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
