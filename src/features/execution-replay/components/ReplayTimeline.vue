<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { eventState, stageState } from "../model/playback";
import { relativePercent, eventTime } from "../model/normalize";
import type {
  ReplayCollectiveStep,
  ReplayDocument,
  ReplayEvent,
  ReplayFabricEvent,
  ReplayRoute,
  ReplayStage,
} from "../model/types";

const props = defineProps<{
  document: ReplayDocument;
  cursorPs: string | null;
  selectedEventId: string | null;
  selectedRouteId?: string | null;
  selectedFabricEventId?: string | null;
  selectedCollectiveStepId?: string | null;
  selectedStageId?: string | null;
}>();
const emit = defineEmits<{
  selectEvent: [eventId: string];
  selectRoute: [routeId: string];
  selectFabricEvent: [eventId: string];
  selectCollectiveStep: [stepId: string];
  selectStage: [stageId: string];
  "update:cursor": [cursorPs: string];
}>();

// A timeline marker is an interactive DOM node. Rendering several thousand of
// them at once makes every cursor update expensive and can lock the browser
// while Vue patches the four tracks. Keep the compact marker view for normal
// runs and move large traces to the virtual evidence list below. No evidence
// is discarded: every row remains addressable through that list.
const LARGE_MARKER_THRESHOLD = 400;
const LARGE_LIST_ROW_HEIGHT = 40;
const LARGE_LIST_VIEWPORT_HEIGHT = 360;
const LARGE_LIST_OVERSCAN = 8;
const largeListScrollTop = ref(0);
const largeListViewport = ref<HTMLElement | null>(null);
const largeEvidenceExpanded = ref(false);
let largeListFrame: number | null = null;
const hasTimelineRange = computed(() => {
  if (!props.document.startPs || !props.document.endPs) return false;
  return props.document.hasValidRange && BigInt(props.document.endPs) > BigInt(props.document.startPs);
});
const timedStages = computed(() =>
  hasTimelineRange.value ? props.document.stages.filter((stage) => stageCursor(stage) !== null) : [],
);
const untimedStages = computed(() =>
  hasTimelineRange.value ? props.document.stages.filter((stage) => stageCursor(stage) === null) : props.document.stages,
);
const timedRoutes = computed(() =>
  hasTimelineRange.value ? props.document.routes.filter((route) => Boolean(route.timing)) : [],
);
const untimedRoutes = computed(() =>
  hasTimelineRange.value ? props.document.routes.filter((route) => !route.timing) : props.document.routes,
);
const timedEvents = computed(() => (hasTimelineRange.value ? props.document.events : []));
const untimedEvents = computed(() => (hasTimelineRange.value ? [] : props.document.events));
const timedFabricEvents = computed(() => (hasTimelineRange.value ? props.document.fabricEvents : []));
const untimedFabricEvents = computed(() => (hasTimelineRange.value ? [] : props.document.fabricEvents));
const timedCollectiveSteps = computed(() => (hasTimelineRange.value ? props.document.collective.steps : []));
const untimedCollectiveSteps = computed(() => (hasTimelineRange.value ? [] : props.document.collective.steps));
const isLarge = (length: number) => length > LARGE_MARKER_THRESHOLD;
const largeTrackState = computed(() => ({
  stages: isLarge(timedStages.value.length || untimedStages.value.length),
  // Keep the existing compact event track for medium traces, but expose the
  // complete set in the virtual evidence list. Very large traces skip marker
  // DOM entirely because a single 8k-event run otherwise freezes playback.
  events: isLarge(timedEvents.value.length || untimedEvents.value.length),
  routes: isLarge(timedRoutes.value.length || untimedRoutes.value.length),
  fabricEvents: isLarge(timedFabricEvents.value.length || untimedFabricEvents.value.length),
  collective: isLarge(timedCollectiveSteps.value.length || untimedCollectiveSteps.value.length),
}));
const hasLargeEvidence = computed(() => Object.values(largeTrackState.value).some(Boolean));
const visibleStages = computed(() => (largeTrackState.value.stages ? [] : timedStages.value));
const visibleEvents = computed(() => (largeTrackState.value.events ? [] : timedEvents.value));
const visibleRoutes = computed(() => (largeTrackState.value.routes ? [] : timedRoutes.value));
const visibleFabricEvents = computed(() => (largeTrackState.value.fabricEvents ? [] : timedFabricEvents.value));
const visibleCollectiveSteps = computed(() => (largeTrackState.value.collective ? [] : timedCollectiveSteps.value));
const visibleUntimedStages = computed(() => (largeTrackState.value.stages ? [] : untimedStages.value));
const visibleUntimedEvents = computed(() => (largeTrackState.value.events ? [] : untimedEvents.value));
const visibleUntimedRoutes = computed(() => (largeTrackState.value.routes ? [] : untimedRoutes.value));
const visibleUntimedFabricEvents = computed(() =>
  largeTrackState.value.fabricEvents ? [] : untimedFabricEvents.value,
);
const visibleUntimedCollectiveSteps = computed(() =>
  largeTrackState.value.collective ? [] : untimedCollectiveSteps.value,
);
const evidenceRows = computed<EvidenceRow[]>(() => [
  ...props.document.stages.map((stage, index) => stageRow(stage, index)),
  ...props.document.events.map((event, index) => eventRow(event, index)),
  ...props.document.routes.map((route, index) => routeRow(route, index)),
  ...props.document.fabricEvents.map((event, index) => fabricEventRow(event, index)),
  ...props.document.collective.steps.map((step, index) => collectiveRow(step, index)),
]);
const largeListStart = computed(() =>
  Math.max(
    0,
    Math.min(
      Math.max(0, evidenceRows.value.length - 1),
      Math.floor(largeListScrollTop.value / LARGE_LIST_ROW_HEIGHT) - LARGE_LIST_OVERSCAN,
    ),
  ),
);
const largeListEnd = computed(() =>
  Math.min(
    evidenceRows.value.length,
    largeListStart.value + Math.ceil(LARGE_LIST_VIEWPORT_HEIGHT / LARGE_LIST_ROW_HEIGHT) + LARGE_LIST_OVERSCAN * 2,
  ),
);
const visibleEvidenceRows = computed(() => evidenceRows.value.slice(largeListStart.value, largeListEnd.value));
const largeListHeight = computed(() => evidenceRows.value.length * LARGE_LIST_ROW_HEIGHT);
const evidenceSummary = computed(() =>
  (
    [
      ["阶段", props.document.stages.length],
      ["运行期事件", props.document.events.length],
      ["Fabric 路径", props.document.routes.length],
      ["Fabric 事件", props.document.fabricEvents.length],
      ["集合步骤", props.document.collective.steps.length],
    ] as Array<[string, number]>
  )
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · "),
);
const selectedEvidenceIndex = computed(() => {
  let offset = props.document.stages.length;
  const stageIndex = props.document.stages.findIndex((stage) => stage.stageId === props.selectedStageId);
  if (stageIndex >= 0) return stageIndex;
  const eventIndex = props.document.events.findIndex((event) => event.eventId === props.selectedEventId);
  if (eventIndex >= 0) return offset + eventIndex;
  offset += props.document.events.length;
  const routeIndex = props.document.routes.findIndex((route) => route.routeId === props.selectedRouteId);
  if (routeIndex >= 0) return offset + routeIndex;
  offset += props.document.routes.length;
  const fabricIndex = props.document.fabricEvents.findIndex((event) => event.eventId === props.selectedFabricEventId);
  if (fabricIndex >= 0) return offset + fabricIndex;
  offset += props.document.fabricEvents.length;
  const collectiveIndex = props.document.collective.steps.findIndex(
    (step) => step.stepId === props.selectedCollectiveStepId,
  );
  return collectiveIndex >= 0 ? offset + collectiveIndex : -1;
});

type EvidenceRow = {
  key: string;
  kind: "stage" | "event" | "route" | "fabric" | "collective";
  index: number;
  label: string;
  detail: string;
  sourcePath: string;
  at: string;
};

function stageRow(stage: ReplayStage, index: number): EvidenceRow {
  return {
    key: `stage-${stage.stageId}`,
    kind: "stage",
    index,
    label: stage.label,
    detail: stage.timing ? `${stage.timing.startPs} – ${stage.timing.endPs} ps` : `${stage.pointPs || "未定时"} ps`,
    sourcePath: stage.sourcePath,
    at: stage.timing?.startPs || stage.pointPs || "0",
  };
}

function eventRow(event: ReplayEvent, index: number): EvidenceRow {
  return {
    key: `event-${event.eventId}`,
    kind: "event",
    index,
    label: event.label,
    detail: `${eventTime(event)} ps`,
    sourcePath: event.sourcePath,
    at: eventTime(event),
  };
}

function routeRow(route: ReplayRoute, index: number): EvidenceRow {
  return {
    key: `route-${route.routeId}`,
    kind: "route",
    index,
    label: route.routeId,
    detail: route.actualPath.join(" → ") || "后端未提供实际路径",
    sourcePath: route.sourcePath,
    at: route.timing?.startPs || "0",
  };
}

function fabricEventRow(event: ReplayFabricEvent, index: number): EvidenceRow {
  const at = event.timing.type === "instant" ? event.timing.atPs : event.timing.startPs;
  return {
    key: `fabric-${event.eventId}`,
    kind: "fabric",
    index,
    label: event.label,
    detail: `${event.routeId}${event.linkId ? ` · ${event.linkId}` : ""} · ${at} ps`,
    sourcePath: event.sourcePath,
    at,
  };
}

function collectiveRow(step: ReplayCollectiveStep, index: number): EvidenceRow {
  return {
    key: `collective-${step.stepId}`,
    kind: "collective",
    index,
    label: `${step.collectiveId} · ${step.phaseLabel || step.phaseId}`,
    detail: `round ${step.round} / chunk ${step.chunk} · ${step.timing.startPs} – ${step.timing.endPs} ps`,
    sourcePath: step.sourcePath,
    at: step.timing.startPs,
  };
}

function onLargeListScroll(event: Event) {
  const nextScrollTop = (event.currentTarget as HTMLElement).scrollTop;
  if (largeListFrame !== null) cancelAnimationFrame(largeListFrame);
  largeListFrame = requestAnimationFrame(() => {
    largeListFrame = null;
    largeListScrollTop.value = nextScrollTop;
  });
}

function onLargeListKeydown(event: KeyboardEvent) {
  const viewport = largeListViewport.value;
  if (!viewport) return;
  const page = Math.max(LARGE_LIST_ROW_HEIGHT, viewport.clientHeight - LARGE_LIST_ROW_HEIGHT);
  if (event.key === "Home") viewport.scrollTop = 0;
  else if (event.key === "End") viewport.scrollTop = Math.max(0, largeListHeight.value - viewport.clientHeight);
  else if (event.key === "PageUp") viewport.scrollTop -= page;
  else if (event.key === "PageDown") viewport.scrollTop += page;
  else return;
  event.preventDefault();
  largeListScrollTop.value = viewport.scrollTop;
}

function onLargeEvidenceToggle(event: Event) {
  largeEvidenceExpanded.value = (event.currentTarget as HTMLDetailsElement).open;
}

function activateEvidenceRow(row: EvidenceRow) {
  if (row.kind === "stage") emit("selectStage", props.document.stages[row.index].stageId);
  else if (row.kind === "event") emit("selectEvent", props.document.events[row.index].eventId);
  else if (row.kind === "route") emit("selectRoute", props.document.routes[row.index].routeId);
  else if (row.kind === "fabric") emit("selectFabricEvent", props.document.fabricEvents[row.index].eventId);
  else emit("selectCollectiveStep", props.document.collective.steps[row.index].stepId);
}

function evidenceKindLabel(kind: EvidenceRow["kind"]): string {
  return {
    stage: "阶段",
    event: "运行事件",
    route: "路径",
    fabric: "Fabric 事件",
    collective: "集合步骤",
  }[kind];
}
watch(
  () => props.document.runId,
  () => {
    largeEvidenceExpanded.value = false;
    largeListScrollTop.value = 0;
    void nextTick(() => {
      if (largeListViewport.value) largeListViewport.value.scrollTop = 0;
    });
  },
);
watch(selectedEvidenceIndex, (index) => {
  if (index < 0) return;
  largeEvidenceExpanded.value = true;
  void nextTick(() => {
    if (!largeListViewport.value) return;
    const top = index * LARGE_LIST_ROW_HEIGHT;
    largeListViewport.value.scrollTop = top;
    largeListScrollTop.value = top;
  });
});
onMounted(() => {
  const index = selectedEvidenceIndex.value;
  if (index < 0) return;
  largeEvidenceExpanded.value = true;
  void nextTick(() => {
    if (!largeListViewport.value) return;
    const top = index * LARGE_LIST_ROW_HEIGHT;
    largeListViewport.value.scrollTop = top;
    largeListScrollTop.value = top;
  });
});
onBeforeUnmount(() => {
  if (largeListFrame !== null) cancelAnimationFrame(largeListFrame);
});
const fallbackEvidenceLabel = computed(() => (hasTimelineRange.value ? "未定时证据" : "无法映射到全局时间轴"));

function point(value: string | null, index = 0, count = 1): number {
  if (value !== null) {
    const percentage = relativePercent(value, props.document.startPs, props.document.endPs);
    if (percentage !== null) return percentage;
  }
  return count > 1 ? (index / (count - 1)) * 100 : 0;
}

function seek(event: Event) {
  if (!props.document.startPs || !props.document.endPs) return;
  const input = event.target as HTMLInputElement;
  const span = BigInt(props.document.endPs) - BigInt(props.document.startPs);
  const offset = (span * BigInt(Math.round(Number(input.value) * 100))) / 10000n;
  emit("update:cursor", String(BigInt(props.document.startPs) + offset));
}

function cursorPoint() {
  return point(props.cursorPs);
}

function stageCursor(stage: ReplayDocument["stages"][number]): string | null {
  return stage.timing?.startPs || stage.pointPs || null;
}

function activateStage(stage: ReplayDocument["stages"][number]) {
  emit("selectStage", stage.stageId);
  const cursor = stageCursor(stage);
  if (cursor) emit("update:cursor", cursor);
}
</script>

<template>
  <div class="replay-timeline" role="region" aria-label="执行回放时间轴" data-help-anchor="replay-timeline">
    <div v-if="document.hasValidRange && document.startPs && document.endPs" class="replay-timeline__seek">
      <input
        type="range"
        min="0"
        max="100"
        step="0.01"
        :value="cursorPoint()"
        aria-label="时间游标"
        :aria-valuetext="`${cursorPs || document.startPs} ps`"
        @input="seek"
      />
      <span>{{ cursorPs || document.startPs }} ps</span>
    </div>
    <p v-else class="replay-timeline__empty">没有合法的全局时间区间；仅显示已报告的点事件和阶段摘要。</p>
    <p v-if="hasLargeEvidence" class="replay-timeline__limit" role="status">
      {{ evidenceSummary }} · 原始证据未被截断；大数据轨道改用可滚动窗口，逐条证据仍可滚动查看。
    </p>
    <div v-if="visibleStages.length" class="replay-track replay-track--stages">
      <div class="replay-track__label">执行阶段</div>
      <div class="replay-track__canvas">
        <template v-for="(stage, stageIndex) in visibleStages" :key="stage.stageId">
          <button
            type="button"
            class="replay-marker replay-marker--stage"
            :class="[
              `replay-marker--${stageState(stage, cursorPs || document.startPs || '0')}`,
              { 'is-selected': selectedStageId === stage.stageId },
            ]"
            :style="{
              left: `${point(stageCursor(stage), stageIndex, visibleStages.length)}%`,
              width: stage.timing
                ? `${Math.max(point(stage.timing.endPs) - point(stage.timing.startPs), 0.5)}%`
                : undefined,
            }"
            :aria-pressed="selectedStageId === stage.stageId"
            :aria-label="stage.label"
            :aria-current="selectedStageId === stage.stageId ? 'step' : undefined"
            :title="stage.label"
            @click="activateStage(stage)"
          >
            <span>{{ stage.label }}</span>
          </button>
          <span
            class="replay-stage-evidence"
            :class="{ 'is-visible': selectedStageId === stage.stageId }"
            :style="{
              left: `${point(stageCursor(stage), stageIndex, visibleStages.length)}%`,
            }"
          >
            <ArtifactEvidenceLink :source-path="stage.sourcePath" :label="`${stage.label} 证据`" />
          </span>
        </template>
        <span class="replay-cursor" :style="{ left: `${cursorPoint()}%` }" aria-hidden="true"></span>
      </div>
    </div>
    <div
      v-if="untimedStages.length"
      class="replay-untimed"
      role="group"
      :aria-label="`${fallbackEvidenceLabel} · 阶段`"
    >
      <span class="replay-untimed__label">{{ hasTimelineRange ? "未定时阶段" : fallbackEvidenceLabel }}</span>
      <div class="replay-untimed__items" role="list">
        <div v-for="stage in visibleUntimedStages" :key="stage.stageId" class="replay-untimed__item" role="listitem">
          <button
            type="button"
            :class="{ 'is-selected': selectedStageId === stage.stageId }"
            :aria-pressed="selectedStageId === stage.stageId"
            @click="activateStage(stage)"
          >
            {{ stage.label }}
          </button>
          <ArtifactEvidenceLink :source-path="stage.sourcePath" label="证据" />
        </div>
      </div>
    </div>
    <div v-if="visibleEvents.length" class="replay-track replay-track--events">
      <div class="replay-track__label">运行期事件</div>
      <div class="replay-track__canvas">
        <button
          v-for="(event, eventIndex) in visibleEvents"
          :key="event.eventId"
          class="replay-marker replay-marker--event"
          :class="[
            `replay-marker--${eventState(event, cursorPs || document.startPs || '0')}`,
            { 'is-selected': selectedEventId === event.eventId },
          ]"
          :style="{ left: `${point(eventTime(event), eventIndex, visibleEvents.length)}%` }"
          type="button"
          :aria-label="`${event.label} ${eventTime(event)} ps`"
          :aria-pressed="selectedEventId === event.eventId"
          @click="emit('selectEvent', event.eventId)"
        >
          <span class="replay-marker__dot"></span>
          <span class="replay-marker__tooltip">{{ event.label }} · {{ eventTime(event) }} ps</span>
        </button>
        <span class="replay-cursor" :style="{ left: `${cursorPoint()}%` }" aria-hidden="true"></span>
      </div>
    </div>
    <div
      v-if="untimedEvents.length || untimedFabricEvents.length || untimedCollectiveSteps.length"
      class="replay-untimed"
      role="group"
      :aria-label="`${fallbackEvidenceLabel} · 运行期`"
    >
      <span class="replay-untimed__label">{{ fallbackEvidenceLabel }}</span>
      <div class="replay-untimed__items" role="list">
        <div
          v-for="event in visibleUntimedEvents"
          :key="`event-${event.eventId}`"
          class="replay-untimed__item"
          role="listitem"
        >
          <button
            type="button"
            :class="{ 'is-selected': selectedEventId === event.eventId }"
            :aria-pressed="selectedEventId === event.eventId"
            @click="emit('selectEvent', event.eventId)"
          >
            {{ event.label }} · {{ eventTime(event) }} ps
          </button>
          <ArtifactEvidenceLink :source-path="event.sourcePath" label="证据" />
        </div>
        <div
          v-for="event in visibleUntimedFabricEvents"
          :key="`fabric-${event.eventId}`"
          class="replay-untimed__item"
          role="listitem"
        >
          <button
            type="button"
            :class="{ 'is-selected': selectedFabricEventId === event.eventId }"
            :aria-pressed="selectedFabricEventId === event.eventId"
            @click="emit('selectFabricEvent', event.eventId)"
          >
            {{ event.label }} · {{ event.routeId }}
          </button>
          <ArtifactEvidenceLink :source-path="event.sourcePath" label="证据" />
        </div>
        <div
          v-for="step in visibleUntimedCollectiveSteps"
          :key="`collective-${step.stepId}`"
          class="replay-untimed__item"
          role="listitem"
        >
          <button
            type="button"
            :class="{ 'is-selected': selectedCollectiveStepId === step.stepId }"
            :aria-pressed="selectedCollectiveStepId === step.stepId"
            @click="emit('selectCollectiveStep', step.stepId)"
          >
            {{ step.collectiveId }} · r{{ step.round }} / c{{ step.chunk }}
          </button>
          <ArtifactEvidenceLink :source-path="step.sourcePath" label="证据" />
        </div>
      </div>
    </div>
    <div v-if="visibleRoutes.length || visibleFabricEvents.length" class="replay-track replay-track--routes">
      <div class="replay-track__label">Fabric 路径</div>
      <div class="replay-track__canvas">
        <button
          v-for="(route, routeIndex) in visibleRoutes"
          :key="route.routeId"
          type="button"
          class="replay-marker replay-marker--route"
          :class="[`replay-marker--${route.state}`, { 'is-selected': selectedRouteId === route.routeId }]"
          :style="{
            left: `${point(route.timing?.startPs || null, routeIndex, visibleRoutes.length)}%`,
            width: route.timing
              ? `${Math.max(point(route.timing.endPs) - point(route.timing.startPs), 0.8)}%`
              : undefined,
          }"
          :aria-label="`${route.routeId} ${route.state}`"
          :aria-pressed="selectedRouteId === route.routeId"
          @click="emit('selectRoute', route.routeId)"
        >
          <span class="replay-marker__dot"></span>
          <span class="replay-marker__tooltip">{{ route.actualPath.join(" → ") || "后端未提供实际路径" }}</span>
        </button>
        <button
          v-for="event in visibleFabricEvents"
          :key="event.eventId"
          type="button"
          class="replay-marker replay-marker--fabric-event"
          :class="{ 'is-selected': selectedFabricEventId === event.eventId }"
          :aria-label="`${event.label} ${event.routeId}`"
          :aria-pressed="selectedFabricEventId === event.eventId"
          :style="{ left: `${point(event.timing.type === 'instant' ? event.timing.atPs : event.timing.startPs)}%` }"
          @click="emit('selectFabricEvent', event.eventId)"
        >
          <span class="replay-marker__dot"></span>
        </button>
        <span class="replay-cursor" :style="{ left: `${cursorPoint()}%` }" aria-hidden="true"></span>
      </div>
    </div>
    <div
      v-if="untimedRoutes.length"
      class="replay-untimed"
      role="group"
      :aria-label="`${fallbackEvidenceLabel} · 路径`"
    >
      <span class="replay-untimed__label">{{ hasTimelineRange ? "未定时路径" : fallbackEvidenceLabel }}</span>
      <div class="replay-untimed__items" role="list">
        <div v-for="route in visibleUntimedRoutes" :key="route.routeId" class="replay-untimed__item" role="listitem">
          <button
            type="button"
            :class="{ 'is-selected': selectedRouteId === route.routeId }"
            :aria-pressed="selectedRouteId === route.routeId"
            @click="emit('selectRoute', route.routeId)"
          >
            {{ route.routeId }} · {{ route.actualPath.join(" → ") || "路径未报告" }}
          </button>
          <ArtifactEvidenceLink :source-path="route.sourcePath" label="证据" />
        </div>
      </div>
    </div>
    <div v-if="visibleCollectiveSteps.length" class="replay-track replay-track--collective">
      <div class="replay-track__label">集合步骤</div>
      <div class="replay-track__canvas">
        <button
          v-for="step in visibleCollectiveSteps"
          :key="step.stepId"
          type="button"
          class="replay-marker replay-marker--collective"
          :class="{ 'is-selected': selectedCollectiveStepId === step.stepId }"
          :style="{
            left: `${point(step.timing.startPs)}%`,
            width: `${Math.max(point(step.timing.endPs) - point(step.timing.startPs), 0.8)}%`,
          }"
          :aria-label="`${step.collectiveId} ${step.phaseId} round ${step.round} chunk ${step.chunk}`"
          :aria-pressed="selectedCollectiveStepId === step.stepId"
          @click="emit('selectCollectiveStep', step.stepId)"
        >
          <span>{{ step.collectiveId }} · r{{ step.round }} / c{{ step.chunk }}</span>
        </button>
        <span class="replay-cursor" :style="{ left: `${cursorPoint()}%` }" aria-hidden="true"></span>
      </div>
    </div>
    <details
      v-if="hasLargeEvidence"
      class="replay-large-evidence"
      aria-label="全部回放证据"
      :open="largeEvidenceExpanded"
      @toggle="onLargeEvidenceToggle"
    >
      <summary class="replay-large-evidence__summary">
        <header class="replay-large-evidence__header">
          <div>
            <span class="section-kicker">全部已报告证据</span>
            <h3>逐条查看</h3>
          </div>
          <span class="replay-large-evidence__summary-meta">
            <span class="replay-large-evidence__count">共 {{ evidenceRows.length }} 条</span>
            <span class="replay-large-evidence__summary-caret" aria-hidden="true">⌄</span>
          </span>
        </header>
      </summary>
      <div
        ref="largeListViewport"
        class="replay-large-evidence__viewport"
        role="list"
        :aria-label="`全部回放证据，共 ${evidenceRows.length} 条`"
        tabindex="0"
        @scroll="onLargeListScroll"
        @keydown="onLargeListKeydown"
      >
        <div class="replay-large-evidence__spacer" :style="{ height: `${largeListHeight}px` }">
          <div
            v-for="(row, rowOffset) in visibleEvidenceRows"
            :key="row.key"
            class="replay-large-evidence__row"
            role="listitem"
            :aria-setsize="evidenceRows.length"
            :aria-posinset="largeListStart + rowOffset + 1"
            :style="{ transform: `translateY(${(largeListStart + rowOffset) * LARGE_LIST_ROW_HEIGHT}px)` }"
          >
            <button
              type="button"
              class="replay-large-evidence__select"
              :title="`${row.label} · ${row.detail}`"
              @click="activateEvidenceRow(row)"
            >
              <span class="replay-large-evidence__kind">{{ evidenceKindLabel(row.kind) }}</span>
              <span class="replay-large-evidence__label">{{ row.label }}</span>
              <span class="replay-large-evidence__detail">{{ row.detail }}</span>
            </button>
            <ArtifactEvidenceLink :source-path="row.sourcePath" label="证据" />
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.replay-timeline {
  min-width: 0;
  padding: 18px 22px 22px;
}

.replay-timeline__seek {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.replay-timeline__seek input {
  width: 100%;
  accent-color: var(--accent);
}

.replay-timeline__seek span {
  color: var(--muted);
  font: 600 var(--text-xs) var(--font-mono);
}

.replay-timeline__empty {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: var(--text-sm);
}

.replay-track {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 68px;
}

.replay-track__label {
  color: var(--muted);
  font-size: var(--text-xs);
}

.replay-track__canvas {
  position: relative;
  min-width: 0;
  height: 42px;
  border-top: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
  background: var(--surface-subtle);
}

.replay-track__canvas::before {
  position: absolute;
  inset: 20px 0 auto;
  border-top: 1px dashed var(--line);
  content: "";
}

.replay-marker {
  position: absolute;
  top: 7px;
  min-width: 4px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  color: var(--ink);
  background: var(--accent-soft);
  cursor: pointer;
  text-align: left;
}

.replay-marker:focus-visible {
  z-index: 2;
  outline: 2px solid var(--accent-hover);
  outline-offset: 2px;
}

.replay-marker--stage {
  overflow: hidden;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
}

.replay-marker--stage span {
  display: block;
  overflow: hidden;
  padding: 4px 6px;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.replay-marker--stage .artifact-evidence-link {
  display: none;
}

.replay-marker--event {
  top: 13px;
  width: 10px;
  height: 16px;
  margin-left: -5px;
  border: 2px solid color-mix(in srgb, var(--warning) 72%, var(--panel-strong));
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--warning) 18%, transparent);
}

.replay-marker--completed {
  opacity: 1;
}

.replay-marker--pending {
  border-color: var(--line-strong);
  color: var(--muted);
  background: var(--surface-muted);
  opacity: 1;
}

.replay-marker--active {
  box-shadow:
    0 0 0 2px var(--ink),
    0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent);
  opacity: 1;
}

.replay-marker.is-selected {
  box-shadow:
    0 0 0 2px var(--accent-hover),
    0 4px 10px -6px var(--accent);
  z-index: 2;
}

.replay-marker__dot {
  display: block;
  width: 100%;
  height: 100%;
}

.replay-marker__tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  display: none;
  width: max-content;
  max-width: 220px;
  padding: 5px 7px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  font-size: 11px;
  transform: translateX(-50%);
  z-index: 3;
}

.replay-marker:hover .replay-marker__tooltip,
.replay-marker:focus-visible .replay-marker__tooltip {
  display: block;
}

.replay-cursor {
  position: absolute;
  top: -5px;
  bottom: -5px;
  width: 2px;
  background: var(--danger);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--danger) 32%, transparent);
  pointer-events: none;
}

.replay-timeline__limit {
  margin: -8px 0 14px;
  color: var(--muted);
  font-size: var(--text-xs);
}

.replay-large-evidence {
  min-width: 0;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.replay-large-evidence__summary {
  display: block;
  cursor: pointer;
  list-style: none;
}
.replay-large-evidence__summary::-webkit-details-marker {
  display: none;
}
.replay-large-evidence__summary:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 4px;
  border-radius: var(--radius-control);
}
.replay-large-evidence__summary-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.replay-large-evidence__summary-caret {
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 160ms var(--ease-standard);
}
.replay-large-evidence[open] .replay-large-evidence__summary-caret {
  transform: rotate(180deg);
}

.replay-large-evidence__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.replay-large-evidence__header h3 {
  margin: 3px 0 0;
  font-size: 15px;
}

.replay-large-evidence__count {
  color: var(--muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.replay-large-evidence__viewport {
  position: relative;
  height: min(360px, 42vh);
  min-height: 180px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-subtle);
  contain: strict;
}

.replay-large-evidence__spacer {
  position: relative;
  min-width: 0;
}

.replay-large-evidence__row {
  position: absolute;
  top: 0;
  inset-inline: 0;
  display: grid;
  grid-template-columns: max-content minmax(0, 0.8fr) minmax(0, 1.4fr) max-content;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 4px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  background: var(--surface);
}

.replay-large-evidence__select {
  display: grid;
  grid-column: 1 / span 3;
  grid-template-columns: max-content minmax(0, 0.8fr) minmax(0, 1.4fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 32px;
  padding: 0;
  border: 0;
  color: var(--ink);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.replay-large-evidence__select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.replay-large-evidence__kind {
  color: var(--muted);
  font-size: 10px;
  text-transform: uppercase;
}

.replay-large-evidence__label,
.replay-large-evidence__detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs);
}

.replay-large-evidence__detail {
  color: var(--muted);
  font-family: var(--font-mono);
}

@media (max-width: 700px) {
  .replay-large-evidence__row {
    grid-template-columns: max-content minmax(0, 1fr) max-content;
  }

  .replay-large-evidence__select {
    grid-template-columns: max-content minmax(0, 1fr);
  }

  .replay-large-evidence__detail {
    grid-column: 2 / -1;
  }
}
.replay-marker--route {
  top: 7px;
  height: 27px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--accent-soft);
}
.replay-marker--route.replay-marker--partial,
.replay-marker--route.replay-marker--no_path {
  border-style: dashed;
  border-color: var(--line-strong);
  background: var(--surface-muted);
}
.replay-marker--route.replay-marker--route_unavailable,
.replay-marker--route.replay-marker--topology_identity_mismatch {
  border-color: var(--danger-ink);
  background: var(--surface-muted);
}
.replay-marker--fabric-event {
  top: 13px;
  width: 8px;
  height: 16px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--warning);
}
.replay-marker--fabric-event.is-selected {
  box-shadow: 0 0 0 2px var(--accent-hover);
  z-index: 2;
}
.replay-marker--collective {
  top: 7px;
  height: 27px;
  overflow: hidden;
  border: 1px solid var(--positive-ink);
  color: var(--ink);
  background: color-mix(in srgb, var(--positive-ink) 16%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.replay-marker--collective span {
  display: block;
  overflow: hidden;
  padding: 5px 6px;
  font-size: 10px;
  text-overflow: ellipsis;
}
.replay-stage-evidence {
  position: absolute;
  top: -21px;
  left: 0;
  z-index: 2;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}
.replay-marker--stage:hover + .replay-stage-evidence,
.replay-marker--stage:focus-visible + .replay-stage-evidence,
.replay-stage-evidence.is-visible {
  visibility: visible;
  pointer-events: auto;
}

.replay-untimed {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  margin-top: 4px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-untimed__label {
  padding-top: 6px;
}
.replay-untimed__items {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.replay-untimed__item {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  padding: 4px 0;
}
.replay-untimed__item button {
  min-width: 0;
  padding: 4px 7px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: var(--surface-muted);
  text-align: left;
}
.replay-untimed__item button.is-selected,
.replay-untimed__item button:hover {
  border-color: var(--accent);
  color: var(--ink);
  background: var(--accent-soft);
}
</style>
