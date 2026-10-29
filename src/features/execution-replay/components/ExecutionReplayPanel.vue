<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../contracts/bridge-api";
import type { ReportBundle, RunInputs } from "../../../contracts/report-model";
import { useExecutionReplayQuery } from "../queries/useExecutionReplayQuery";
import { coverageLabel, routeStateLabel } from "../model/coverage";
import { normalizeReplayDocument } from "../model/normalize";
import { nextPlaybackTime, nextStageTime } from "../model/playback";
import { clampReplaySpeed, DEFAULT_REPLAY_SPEED } from "../model/speed";
import ReplayControls from "./ReplayControls.vue";
import ReplayDetailsPanel from "./ReplayDetailsPanel.vue";
import ReplayTimeline from "./ReplayTimeline.vue";
import ReplayTopologyCanvas from "./ReplayTopologyCanvas.vue";
import ReplayCollectivePanel from "./ReplayCollectivePanel.vue";

const props = defineProps<{
  runId: string | null;
  bundle: ReportBundle;
  inputs: RunInputs;
  artifactManifest: ArtifactManifestResponse | null;
  backendIdentity: string;
  schemaSetRevision: string;
  bridgeManifest: ApiManifestResponse | null;
}>();

const query = useExecutionReplayQuery({
  runId: computed(() => props.runId),
  backendRevision: computed(() => props.backendIdentity),
  schemaSetRevision: computed(() => props.schemaSetRevision),
  artifactManifest: computed(() => props.artifactManifest),
  bridgeManifest: computed(() => props.bridgeManifest),
  runtimeTrace: computed(() => props.inputs.runtime_trace),
});
const isPlaying = ref(false);
// Playback is an inspection aid rather than a wall-clock benchmark. Start at
// 1/2000 of the simulated timeline so a user can follow an active hop and its
// payload without having to discover the speed control first.
const speed = ref(DEFAULT_REPLAY_SPEED);
const cursorPs = ref<string | null>(null);
const selectedEventId = ref<string | null>(null);
const selectedRouteId = ref<string | null>(null);
const selectedFabricEventId = ref<string | null>(null);
const selectedCollectiveStepId = ref<string | null>(null);
const selectedStageId = ref<string | null>(null);
const reducedMotion = ref(false);
let frame: number | null = null;
let lastFrame = 0;
// Keep sub-millisecond playback progress between animation frames. Without
// this remainder, low speeds and short traces can quantize to zero forever
// (or effectively run at 1x because every frame is rounded up to 1 ms).
let playbackRemainderMs = 0;
// Preserve the fractional simulated-picosecond numerator that integer
// division would otherwise discard on very short traces (for example a
// 1-ps range). The denominator is the 1000 ms playback second.
let playbackRemainderNumerator = 0n;
let reducedMotionQuery: MediaQueryList | null = null;

const document = computed(() =>
  normalizeReplayDocument({
    runId: props.runId,
    backendIdentity: props.backendIdentity,
    schemaSetRevision: props.schemaSetRevision,
    artifactSha256: query.artifactSha.value,
    envelope: props.bundle.execution_envelope,
    runtimeEvents: query.result.value.runtimeEvents,
    runtimeRequests: query.result.value.runtimeRequests,
    fabricRoutes: query.result.value.fabricRoutes,
    collectiveSteps: query.result.value.collectiveSteps,
    metrics: props.bundle.metrics,
    // Topology is bound to the verified artifact manifest and fetched through
    // the same evidence path as Fabric/collective data. Never fall back to
    // the editable input snapshot here: it is not sufficient evidence for
    // replay path highlighting.
    topology: query.result.value.topology,
  }),
);
const evidenceCount = computed(
  () =>
    [
      ...document.value.events,
      ...document.value.stages,
      ...document.value.routes,
      ...document.value.fabricEvents,
      ...document.value.collective.steps,
    ].filter((item) => item.availability !== "unsupported_schema").length,
);
const activeCursor = computed(() => cursorPs.value || document.value.startPs || "0");
const routeHeadline = computed(() => {
  if (document.value.fabricRouteState !== "no_path") return routeStateLabel(document.value.fabricRouteState);
  return document.value.routes.some((route) => route.hasInterval) ? "路径细节未报告" : "后端未提供实际路径";
});
const hasSuccessfulEvidence = computed(
  () =>
    document.value.stages.some((stage) => stage.availability !== "unsupported_schema") ||
    [
      query.result.value.runtimeEvents,
      query.result.value.runtimeRequests,
      query.result.value.fabricRoutes,
      query.result.value.collectiveSteps,
      query.result.value.topology,
    ].some((payload) => payload?.availability === "available"),
);
const artifactShaById = computed<Record<string, string>>(() =>
  Object.fromEntries((props.artifactManifest?.artifacts || []).map((entry) => [entry.artifact_id, entry.sha256])),
);
const playbackTimes = computed<string[]>(() =>
  [
    ...new Set(
      [
        ...document.value.events.flatMap((event) =>
          event.timing.type === "interval" ? [event.timing.startPs, event.timing.endPs] : [event.timing.atPs],
        ),
        ...document.value.stages
          .flatMap((stage) => [stage.timing?.startPs, stage.timing?.endPs, stage.pointPs])
          .filter((value): value is string => Boolean(value)),
        ...document.value.routes
          .flatMap((route) => [route.timing?.startPs, route.timing?.endPs])
          .filter((value): value is string => Boolean(value)),
        ...document.value.fabricEvents.flatMap((event) =>
          event.timing.type === "interval" ? [event.timing.startPs, event.timing.endPs] : [event.timing.atPs],
        ),
        ...document.value.collective.steps.flatMap((step) => [step.timing.startPs, step.timing.endPs]),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)),
);
const documentSignature = computed(() =>
  [
    props.runId || "none",
    query.queryKey.value.join("|"),
    document.value.startPs || "",
    document.value.endPs || "",
    document.value.stages
      .map((stage) => `${stage.stageId}:${stage.timing?.startPs || stage.pointPs || ""}:${stage.timing?.endPs || ""}`)
      .join(","),
    document.value.events
      .map((event) => {
        const timing =
          event.timing.type === "instant" ? event.timing.atPs : `${event.timing.startPs}-${event.timing.endPs}`;
        return `${event.eventId}:${event.kind}:${timing}:${event.state || ""}`;
      })
      .join(","),
    document.value.routes
      .map(
        (route) =>
          `${route.routeId}:${route.state}:${route.actualPath.join(">")}:${route.linkIds.join(">")}:${
            route.timing ? `${route.timing.startPs}-${route.timing.endPs}` : ""
          }`,
      )
      .join(","),
    document.value.fabricEvents
      .map((event) => {
        const timing =
          event.timing.type === "instant" ? event.timing.atPs : `${event.timing.startPs}-${event.timing.endPs}`;
        return `${event.eventId}:${event.routeId}:${event.linkId || ""}:${timing}`;
      })
      .join(","),
    document.value.collective.steps
      .map(
        (step) =>
          `${step.stepId}:${step.collectiveId}:${step.phaseId}:${step.round}:${step.chunk}:${step.timing.startPs}-${step.timing.endPs}:${step.sourceDevice}->${step.destinationDevice}:${step.bytes}`,
      )
      .join(","),
    document.value.topology.nodes.map((node) => `${node.id}:${node.label}:${node.deviceType || ""}`).join(","),
    document.value.topology.links.map((link) => `${link.id}:${link.source}->${link.destination}`).join(","),
  ].join(";"),
);

function resetCursor() {
  // Reset is a playback command as well as a seek. Leaving RAF alive here
  // makes the cursor jump back and immediately run forward again, which is
  // especially confusing when the reset button is used while paused.
  stopPlayback();
  cursorPs.value = document.value.startPs || playbackTimes.value[0] || null;
  selectedEventId.value = null;
  selectedRouteId.value = null;
  selectedFabricEventId.value = null;
  selectedCollectiveStepId.value = null;
  selectedStageId.value = null;
}

function stopFrame() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function stopPlayback() {
  isPlaying.value = false;
  stopFrame();
  lastFrame = 0;
  playbackRemainderMs = 0;
  playbackRemainderNumerator = 0n;
}

function tick(now: number) {
  if (!isPlaying.value) return;
  if (!lastFrame) lastFrame = now;
  // A suspended tab can deliver a very large delta when it becomes visible
  // again. Cap one frame so a brief backgrounding does not jump over the
  // entire trace; the following frames continue from the same cursor.
  const elapsed = Math.min(250, Math.max(0, now - lastFrame));
  lastFrame = now;
  const start = document.value.startPs;
  const end = document.value.endPs;
  if (!start || !end || !document.value.hasValidRange) {
    stopPlayback();
    return;
  }
  const span = BigInt(end) - BigInt(start);
  // One playback second covers one simulated interval at 1x; all conversion is
  // display/playback scaling and the original ps value remains lossless.
  const playbackSpeed = Number.isFinite(speed.value) && speed.value > 0 ? speed.value : DEFAULT_REPLAY_SPEED;
  const scaledElapsedMs = elapsed * playbackSpeed + playbackRemainderMs;
  const wholeElapsedMs = Math.floor(scaledElapsedMs);
  playbackRemainderMs = scaledElapsedMs - wholeElapsedMs;
  const numerator = span * BigInt(wholeElapsedMs) + playbackRemainderNumerator;
  const increment = numerator / 1000n;
  playbackRemainderNumerator = numerator % 1000n;
  const next = BigInt(activeCursor.value) + increment;
  if (next >= BigInt(end)) {
    cursorPs.value = end;
    stopPlayback();
  } else {
    cursorPs.value = String(next);
    frame = requestAnimationFrame(tick);
  }
}

function togglePlayback() {
  if (!document.value.startPs || !document.value.endPs || !document.value.hasValidRange) return;
  // Respect the operating-system preference by turning Play into a single
  // evidence step. This keeps the control useful without starting a
  // continuous RAF loop that the user explicitly asked us to avoid.
  if (reducedMotion.value) {
    if (isPlaying.value) stopPlayback();
    else step(1);
    return;
  }
  if (isPlaying.value) stopPlayback();
  else {
    // Reaching the end is a normal playback state. Starting playback again
    // must replay the trace from its beginning instead of scheduling a frame
    // that immediately stops at the already-reached end boundary.
    if (BigInt(activeCursor.value) >= BigInt(document.value.endPs)) {
      cursorPs.value = document.value.startPs;
      playbackRemainderMs = 0;
      playbackRemainderNumerator = 0n;
    }
    isPlaying.value = true;
    lastFrame = 0;
    frame = requestAnimationFrame(tick);
  }
}

function step(direction: 1 | -1) {
  stopPlayback();
  cursorPs.value = nextPlaybackTime(activeCursor.value, playbackTimes.value, direction);
}

function stepStage(direction: 1 | -1) {
  stopPlayback();
  cursorPs.value = nextStageTime(activeCursor.value, document.value.stages, direction);
}

const collectiveTimes = computed(() =>
  [...new Set(document.value.collective.steps.flatMap((step) => [step.timing.startPs, step.timing.endPs]))].sort(
    (a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0),
  ),
);

function stepCollective(direction: 1 | -1) {
  stopPlayback();
  if (!collectiveTimes.value.length) return;
  cursorPs.value = nextPlaybackTime(activeCursor.value, collectiveTimes.value, direction);
}

function seekCursor(value: string) {
  stopPlayback();
  cursorPs.value = value;
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(target.tagName) ||
      target.getAttribute("role") === "button")
  )
    return;
  if (event.key === " ") {
    event.preventDefault();
    togglePlayback();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    if (event.shiftKey) stepStage(1);
    else step(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (event.shiftKey) stepStage(-1);
    else step(-1);
  } else if (event.key === "Home") {
    event.preventDefault();
    resetCursor();
  } else if (event.key === "End") {
    event.preventDefault();
    stopPlayback();
    cursorPs.value = document.value.endPs || playbackTimes.value.at(-1) || null;
  }
}

function selectEvent(id: string) {
  stopPlayback();
  selectedEventId.value = id;
  selectedRouteId.value = null;
  selectedFabricEventId.value = null;
  selectedCollectiveStepId.value = null;
  selectedStageId.value = null;
  const event = document.value.events.find((item) => item.eventId === id);
  if (event) cursorPs.value = event.timing.type === "instant" ? event.timing.atPs : event.timing.startPs;
}

function selectRoute(id: string) {
  stopPlayback();
  selectedRouteId.value = id;
  selectedEventId.value = null;
  selectedFabricEventId.value = null;
  selectedCollectiveStepId.value = null;
  selectedStageId.value = null;
  const route = document.value.routes.find((item) => item.routeId === id);
  if (route?.timing) cursorPs.value = route.timing.startPs;
  else if (route?.events[0]) {
    cursorPs.value =
      route.events[0].timing.type === "instant" ? route.events[0].timing.atPs : route.events[0].timing.startPs;
  }
}

function selectFabricEvent(id: string) {
  const event = document.value.fabricEvents.find((item) => item.eventId === id);
  if (!event) return;
  stopPlayback();
  selectedFabricEventId.value = id;
  selectedCollectiveStepId.value = null;
  selectedEventId.value = null;
  selectedStageId.value = null;
  selectedRouteId.value = event.routeId;
  cursorPs.value = event.timing.type === "instant" ? event.timing.atPs : event.timing.startPs;
}

function selectCollectiveStep(id: string) {
  const step = document.value.collective.steps.find((item) => item.stepId === id);
  if (!step) return;
  stopPlayback();
  selectedCollectiveStepId.value = id;
  selectedFabricEventId.value = null;
  selectedEventId.value = null;
  selectedStageId.value = null;
  selectedRouteId.value = null;
  cursorPs.value = step.timing.startPs;
}

function selectStage(id: string) {
  const stage = document.value.stages.find((item) => item.stageId === id);
  if (!stage) return;
  stopPlayback();
  selectedStageId.value = id;
  selectedEventId.value = null;
  selectedRouteId.value = null;
  selectedFabricEventId.value = null;
  selectedCollectiveStepId.value = null;
  cursorPs.value = stage.timing?.startPs || stage.pointPs || cursorPs.value;
}

watch(documentSignature, resetCursor, { immediate: true });
onMounted(() => {
  reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
  reducedMotion.value = reducedMotionQuery?.matches || false;
  reducedMotionQuery?.addEventListener?.("change", onReducedMotionChange);
});

function onReducedMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches;
  if (event.matches) stopPlayback();
}

function updateSpeed(value: number) {
  speed.value = clampReplaySpeed(value);
  // Changing the rate must never create a jump based on elapsed time that was
  // accumulated under the previous rate. The simulated cursor remains intact;
  // only the next frame's wall-clock conversion is reset.
  if (isPlaying.value) {
    lastFrame = 0;
    playbackRemainderMs = 0;
    playbackRemainderNumerator = 0n;
  }
}

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener?.("change", onReducedMotionChange);
  stopPlayback();
});
</script>

<template>
  <section
    class="panel execution-replay-panel"
    tabindex="0"
    aria-label="执行回放"
    data-help-anchor="replay-controls"
    aria-keyshortcuts="Space ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End"
    @keydown="onKeydown"
  >
    <header class="panel-header panel-header--row">
      <div>
        <p class="section-kicker">执行回放</p>
        <h2>已观测事件回放 / 阶段摘要</h2>
      </div>
      <div class="replay-coverage-status" :data-status="document.coverage.status">
        {{ coverageLabel(document.coverage.status) }} · {{ evidenceCount }} 条已报告证据
      </div>
    </header>
    <p v-if="query.result.value.loading" class="panel-empty-copy">正在校验并读取运行期事件…</p>
    <p v-else-if="query.result.value.error && !hasSuccessfulEvidence" class="panel-empty-copy" role="alert">
      读取运行期证据失败：{{ query.result.value.error }}
    </p>
    <p v-else-if="query.result.value.error" class="panel-empty-copy" role="status">
      部分运行期证据不可用，已保留可验证内容：{{ query.result.value.error }}
    </p>
    <div class="replay-identity">
      <span
        >时间范围：<code>{{ document.startPs || "未报告" }}</code> –
        <code>{{ document.endPs || "未报告" }}</code> ps</span
      >
      <span>运行期事件：{{ coverageLabel(document.coverage.runtimeEvents) }}</span>
      <span>底层路径：{{ routeHeadline }}</span>
      <span>
        来源模式：{{ document.traceProvenance.sourceMode || "未报告" }} · 校准：{{
          document.traceProvenance.calibrationLevel || "未报告"
        }}
        · 声明范围：{{ document.traceProvenance.allowedClaimScope || "未报告" }}
      </span>
    </div>
    <ReplayControls
      :is-playing="isPlaying"
      :speed="speed"
      :can-play="Boolean(document.hasValidRange && document.startPs && document.endPs && playbackTimes.length > 0)"
      :can-step="playbackTimes.length > 0"
      :can-step-stage="document.stages.some((stage) => Boolean(stage.timing || stage.pointPs))"
      :reduced-motion="reducedMotion"
      :cursor-ps="cursorPs"
      :can-step-collective="document.collective.steps.length > 0"
      @toggle="togglePlayback"
      @reset="resetCursor"
      @previous="step(-1)"
      @next="step(1)"
      @previous-stage="stepStage(-1)"
      @next-stage="stepStage(1)"
      @previous-collective="stepCollective(-1)"
      @next-collective="stepCollective(1)"
      @update:speed="updateSpeed"
    />
    <div class="replay-main-grid">
      <ReplayTimeline
        :key="`${document.runId || 'none'}:${document.artifactSha256 || 'none'}`"
        :document="document"
        :cursor-ps="cursorPs"
        :selected-event-id="selectedEventId"
        :selected-route-id="selectedRouteId"
        :selected-fabric-event-id="selectedFabricEventId"
        :selected-collective-step-id="selectedCollectiveStepId"
        :selected-stage-id="selectedStageId"
        @select-event="selectEvent"
        @select-route="selectRoute"
        @select-fabric-event="selectFabricEvent"
        @select-collective-step="selectCollectiveStep"
        @select-stage="selectStage"
        @update:cursor="seekCursor"
      />
      <aside class="replay-side-column" aria-label="执行回放观察视图">
        <ReplayTopologyCanvas
          :key="`${document.runId || 'none'}:${document.artifactSha256 || 'none'}`"
          :document="document"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :cursor-ps="cursorPs"
          @select-route="selectRoute"
        />
        <ReplayDetailsPanel
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :selected-stage-id="selectedStageId"
          :artifact-sha-by-id="artifactShaById"
        />
      </aside>
    </div>
    <div class="replay-evidence-grid">
      <ReplayCollectivePanel
        :key="`${document.runId || 'none'}:${document.artifactSha256 || 'none'}`"
        :collective="document.collective"
        :selected-step-id="selectedCollectiveStepId"
        @select-step="selectCollectiveStep"
      />
    </div>
    <div v-if="document.coverage.status !== 'available'" class="replay-coverage-note">
      <span>当前回放含未报告或不完整证据；未生成推断路径、步骤或动画。</span>
      <details v-if="document.coverage.reasons.length">
        <summary>查看覆盖说明</summary>
        <ul>
          <li v-for="reason in document.coverage.reasons" :key="reason">{{ reason }}</li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
.execution-replay-panel {
  overflow: visible;
}
.execution-replay-panel:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 3px;
}
.replay-coverage-status {
  color: var(--muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}
.replay-coverage-status[data-status="available"] {
  color: var(--positive-ink);
}
.replay-coverage-status[data-status="unsupported_schema"] {
  color: var(--danger-ink);
}
.replay-identity {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0 22px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-identity code {
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}
.replay-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.replay-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(340px, 0.85fr);
  align-items: start;
  gap: 0;
  min-width: 0;
}
.replay-side-column {
  position: sticky;
  top: 12px;
  display: grid;
  align-self: start;
  max-height: calc(100vh - 132px);
  overflow: auto;
  overscroll-behavior: contain;
  border-left: 1px solid var(--line);
  background: var(--surface-subtle);
  scrollbar-gutter: stable;
}
.replay-side-column > :deep(.replay-topology) {
  border-top: 0;
  border-bottom: 1px solid var(--line);
}
.replay-side-column > :deep(.replay-details) {
  border-left: 0;
}
.replay-coverage-note {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  margin: 0;
  padding: 10px 22px 16px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-coverage-note details {
  min-width: 0;
}
.replay-coverage-note summary {
  cursor: pointer;
  color: var(--ink-soft);
}
.replay-coverage-note ul {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
  padding-left: 18px;
}
.replay-evidence-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-top: 1px solid var(--line);
}
.replay-evidence-grid > * {
  min-width: 0;
}
.replay-evidence-grid > :last-child {
  border-top: 0;
}
@media (max-width: 900px) {
  .replay-main-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .replay-evidence-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .replay-side-column {
    position: static;
    max-height: none;
    overflow: visible;
    border-left: 0;
  }
}
</style>
