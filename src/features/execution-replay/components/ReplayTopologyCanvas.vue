<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import type { ReplayDocument, ReplayRoute } from "../model/types";
import { intervalProgress } from "../model/playback";
import ReplayVirtualList from "./ReplayVirtualList.vue";

const props = defineProps<{
  document: ReplayDocument;
  selectedRouteId: string | null;
  selectedFabricEventId?: string | null;
  selectedCollectiveStepId?: string | null;
  cursorPs?: string | null;
}>();
const emit = defineEmits<{ selectRoute: [routeId: string] }>();
const ROUTE_ROW_HEIGHT = 64;
const visibleStart = ref(0);
const visibleEnd = ref(Math.min(props.document.routes.length, 24));
const routeListExpanded = ref(false);
const visibleRoutes = computed(() => props.document.routes.slice(visibleStart.value, visibleEnd.value));
const selectedRouteIndex = computed(() =>
  props.document.routes.findIndex((route) => route.routeId === props.selectedRouteId),
);
const routeById = computed(() => new Map(props.document.routes.map((route) => [route.routeId, route])));
const fabricEventById = computed(() => new Map(props.document.fabricEvents.map((event) => [event.eventId, event])));
const collectiveStepById = computed(() => new Map(props.document.collective.steps.map((step) => [step.stepId, step])));
const hasReportedPath = computed(() =>
  props.document.routes.some((route) => route.state === "available" && route.actualPath.length >= 2),
);
const NODE_WIDTH = 108;
const CELL_WIDTH = 132;
const ROW_HEIGHT = 78;
const PADDING_X = 34;
const PADDING_Y = 34;

const stateLabel: Record<ReplayRoute["state"], string> = {
  available: "路径已报告",
  partial: "路径部分报告",
  route_unavailable: "路径不可用",
  no_path: "路径细节未报告",
  topology_identity_mismatch: "拓扑身份不一致",
};

function routeStateLabel(route: ReplayRoute) {
  return route.state === "no_path" && !route.hasInterval ? "后端未提供实际路径" : stateLabel[route.state];
}

function nodeX(index: number) {
  return PADDING_X + (index % columns()) * CELL_WIDTH + NODE_WIDTH / 2;
}

function nodeY(index: number) {
  return PADDING_Y + Math.floor(index / columns()) * ROW_HEIGHT + 22;
}

function columns() {
  const count = props.document.topology.nodes.length;
  return Math.min(5, Math.max(1, Math.ceil(Math.sqrt(count || 1))));
}

function canvasWidth() {
  return PADDING_X * 2 + columns() * CELL_WIDTH;
}

function canvasHeight() {
  const rows = Math.ceil(props.document.topology.nodes.length / columns());
  return PADDING_Y * 2 + Math.max(1, rows) * ROW_HEIGHT;
}

const nodePositions = computed(() => {
  const positions = new Map<string, { x: number; y: number }>();
  props.document.topology.nodes.forEach((node, index) => {
    positions.set(node.id, { x: nodeX(index), y: nodeY(index) });
  });
  return positions;
});

const topologyLinksById = computed(() => new Map(props.document.topology.links.map((link) => [link.id, link])));

function compactLabel(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function nodePosition(id: string) {
  return nodePositions.value.get(id) || null;
}

function isRouteActive(route: ReplayRoute) {
  if (!props.cursorPs || !route.timing || route.state !== "available" || !route.hasInterval) return false;
  const cursor = BigInt(props.cursorPs);
  return cursor >= BigInt(route.timing.startPs) && cursor < BigInt(route.timing.endPs);
}

function routeIsFocused(route: ReplayRoute) {
  // Collective steps and Fabric records share the backend-reported phase_id.
  // Joining on that identity lets a selected allreduce/allgather step light up
  // its real route without deriving a path from topology or aggregate metrics.
  const matchesCollectiveStep = Boolean(
    selectedCollectivePhaseId.value && selectedCollectivePhaseId.value === route.phaseId,
  );
  return (
    route.state === "available" &&
    (props.selectedRouteId === route.routeId || matchesCollectiveStep || isRouteActive(route))
  );
}

const selectedCollectivePhaseId = computed(
  () => props.document.collective.steps.find((step) => step.stepId === props.selectedCollectiveStepId)?.phaseId || null,
);

const focusedRoutes = computed(() => props.document.routes.filter((route) => routeIsFocused(route)));
const activeRoutes = computed(() => props.document.routes.filter((route) => isRouteActive(route)));
const routeNodeIds = (routes: ReplayRoute[]) => new Set(routes.flatMap((route) => route.actualPath));
const routeLinkIds = (routes: ReplayRoute[]) =>
  new Set(
    routes.flatMap((route) =>
      route.linkIds.flatMap((linkId) => [linkId, linkId.replace(/::(?:forward|reverse)$/, "")]),
    ),
  );
const focusedNodeIds = computed(() => routeNodeIds(focusedRoutes.value));
const focusedLinkIds = computed(() => routeLinkIds(focusedRoutes.value));
const activeNodeIds = computed(() => routeNodeIds(activeRoutes.value));
const activeLinkIds = computed(() => routeLinkIds(activeRoutes.value));

type FlowTiming = { startPs: string; endPs: string };
type FlowReadout = {
  kind: "collective" | "fabric";
  title: string;
  phaseId?: string;
  round?: string;
  chunk?: string;
  source: string | null;
  destination: string | null;
  bytes: string | null;
  route: ReplayRoute | null;
  timing: FlowTiming | null;
};

function timingActive(timing: { type: "instant"; atPs: string } | FlowTiming, cursor: string | null) {
  if (!cursor) return false;
  if ("type" in timing) return BigInt(cursor) === BigInt(timing.atPs);
  return BigInt(cursor) >= BigInt(timing.startPs) && BigInt(cursor) <= BigInt(timing.endPs);
}

const selectedCollectiveStep = computed(
  () => (props.selectedCollectiveStepId && collectiveStepById.value.get(props.selectedCollectiveStepId)) || null,
);
const currentCollectiveStep = computed(
  () =>
    selectedCollectiveStep.value ||
    props.document.collective.steps.find((step) => timingActive(step.timing, props.cursorPs || null)) ||
    null,
);

function routeForPhase(phaseId: string | undefined) {
  if (!phaseId) return null;
  return (
    props.document.routes.find(
      (route) => route.state === "available" && route.phaseId === phaseId && route.actualPath.length >= 2,
    ) || null
  );
}

const currentFabricEvent = computed(() => {
  return (
    (props.selectedFabricEventId && fabricEventById.value.get(props.selectedFabricEventId)) ||
    props.document.fabricEvents.find((event) => timingActive(event.timing, props.cursorPs || null)) ||
    null
  );
});

const currentFlow = computed<FlowReadout | null>(() => {
  const collective = currentCollectiveStep.value;
  if (collective) {
    return {
      kind: "collective",
      title: collective.phaseLabel || collective.collectiveId,
      phaseId: collective.phaseId,
      round: collective.round,
      chunk: collective.chunk,
      source: collective.sourceDevice,
      destination: collective.destinationDevice,
      bytes: collective.bytes,
      route: routeForPhase(collective.phaseId),
      timing: collective.timing,
    };
  }

  const fabricEvent = currentFabricEvent.value;
  const route = fabricEvent
    ? routeById.value.get(fabricEvent.routeId) || null
    : (props.selectedRouteId && routeById.value.get(props.selectedRouteId)) ||
      props.document.routes.find((candidate) => isRouteActive(candidate)) ||
      null;
  if (!fabricEvent && !route) return null;
  const path = route?.actualPath || [];
  return {
    kind: "fabric",
    title: fabricEvent?.label || "已报告路径",
    phaseId: route?.phaseId,
    source: path[0] || null,
    destination: path.at(-1) || null,
    bytes: null,
    route,
    timing: fabricEvent?.timing.type === "interval" ? fabricEvent.timing : route?.timing || null,
  };
});

function flowTimingProgress(timing: FlowTiming | null) {
  if (!timing || !props.cursorPs) return 0;
  return intervalProgress(props.cursorPs, timing);
}

const flowTokenPosition = computed(() => {
  const flow = currentFlow.value;
  const route = flow?.route;
  if (!flow || !route || route.state !== "available" || route.actualPath.length < 2) return null;
  // A token is allowed only when every actual hop is backed by a reported
  // route link and that link is present in the verified topology artifact.
  // The node path alone is never enough to invent a physical connection.
  if (route.linkIds.length !== route.actualPath.length - 1) return null;
  const routeSegments = route.linkIds.map((linkId, index) => {
    const baseId = linkId.replace(/::(?:forward|reverse)$/, "");
    const link = topologyLinksById.value.get(linkId) || topologyLinksById.value.get(baseId);
    if (!link) return null;
    const sourceId = route.actualPath[index];
    const destinationId = route.actualPath[index + 1];
    if (link.source === sourceId && link.destination === destinationId) {
      return linkPosition(link);
    }
    if (link.source === destinationId && link.destination === sourceId) {
      const position = linkPosition(link);
      return position ? { source: position.destination, destination: position.source } : null;
    }
    return null;
  });
  if (routeSegments.some((segment) => !segment)) return null;
  const safeSegments = routeSegments as Array<{
    source: { x: number; y: number };
    destination: { x: number; y: number };
  }>;
  const safePoints = [safeSegments[0].source, ...safeSegments.map((segment) => segment.destination)];
  const segment = flowTimingProgress(flow.timing) * (safePoints.length - 1);
  const index = Math.min(safePoints.length - 2, Math.floor(segment));
  const fraction = segment - index;
  const from = safePoints[index];
  const to = safePoints[index + 1];
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
});

const flowPathText = computed(() => {
  const flow = currentFlow.value;
  if (!flow) return "";
  if (flow.source && flow.destination) return `${flow.source} → ${flow.destination}`;
  return "路径端点未报告";
});

const flowStatusLabel = computed(() => {
  const timing = currentFlow.value?.timing;
  const cursor = props.cursorPs;
  if (!timing || !cursor) return "时间未报告";
  const cursorValue = BigInt(cursor);
  if (cursorValue < BigInt(timing.startPs)) return "待发生";
  if (cursorValue >= BigInt(timing.endPs)) return "已完成";
  return "传输中";
});

const flowAriaLabel = computed(() => {
  const flow = currentFlow.value;
  if (!flow) return "当前没有处于活动区间的已报告数据流";
  const bytes = flow.bytes === null ? "数据量未报告" : `${flow.bytes} bytes`;
  return `${flow.title}，${flowPathText.value}，${bytes}`;
});

function pathText(route: ReplayRoute) {
  return route.actualPath.length ? route.actualPath.join(" → ") : "后端未提供实际路径";
}

function selectedPathIncludes(id: string) {
  return focusedNodeIds.value.has(id);
}

function selectedLinkIncludes(id: string) {
  return focusedLinkIds.value.has(id);
}

function activePathIncludes(id: string) {
  return activeNodeIds.value.has(id);
}

function activeLinkIncludes(id: string) {
  return activeLinkIds.value.has(id);
}

function linkPosition(link: ReplayDocument["topology"]["links"][number]) {
  const source = nodePosition(link.source);
  const destination = nodePosition(link.destination);
  return source && destination ? { source, destination } : null;
}

const linkPositions = computed(() => {
  const positions = new Map<string, { source: { x: number; y: number }; destination: { x: number; y: number } }>();
  props.document.topology.links.forEach((link) => {
    const position = linkPosition(link);
    if (position) positions.set(link.id, position);
  });
  return positions;
});

function cachedLinkPosition(link: ReplayDocument["topology"]["links"][number]) {
  return linkPositions.value.get(link.id) || null;
}

function updateVisibleRange(start: number, end: number) {
  visibleStart.value = start;
  visibleEnd.value = end;
}

function onRouteListToggle(event: Event) {
  routeListExpanded.value = (event.currentTarget as HTMLDetailsElement).open;
}

watch(
  () => props.selectedRouteId,
  (routeId) => {
    if (routeId) routeListExpanded.value = true;
  },
  { immediate: true },
);
watch(
  () => props.document.routes.length,
  (total) => {
    if (visibleStart.value >= total) visibleStart.value = 0;
    visibleEnd.value = Math.min(total, Math.max(visibleEnd.value, visibleStart.value + 1));
  },
);
</script>

<template>
  <section class="replay-topology" aria-label="设备与链路回放" data-help-anchor="replay-evidence">
    <header class="replay-topology__header">
      <div>
        <span class="section-kicker">设备与链路</span>
        <h3>{{ hasReportedPath ? "已报告物理路径" : "实际路径证据" }}</h3>
      </div>
      <span class="replay-topology__availability" :data-status="document.topology.availability">
        {{
          document.topology.availability === "available"
            ? "拓扑已验证"
            : document.topology.availability === "partial"
              ? "拓扑部分报告"
              : "拓扑未报告"
        }}
      </span>
    </header>
    <p v-if="!document.topology.nodes.length" class="replay-topology__empty">拓扑输入未报告；路径不会从配置推断。</p>
    <div v-if="currentFlow" class="replay-flow-readout" aria-live="polite" :aria-label="flowAriaLabel">
      <div class="replay-flow-readout__heading">
        <span class="section-kicker">当前数据流</span>
        <strong>{{ currentFlow.title }}</strong>
        <span class="replay-flow-readout__status">{{ flowStatusLabel }}</span>
      </div>
      <div class="replay-flow-readout__facts">
        <span>
          <small>方向</small>
          <code>{{ flowPathText }}</code>
        </span>
        <span>
          <small>数据量</small>
          <code>{{ currentFlow.bytes === null ? "后端未报告" : `${currentFlow.bytes} bytes` }}</code>
        </span>
        <span v-if="currentFlow.kind === 'collective'">
          <small>集合步骤</small>
          <code>round {{ currentFlow.round }} · chunk {{ currentFlow.chunk }}</code>
        </span>
        <span v-else>
          <small>链路</small>
          <code>{{ currentFlow.route?.linkIds.join(" → ") || "未报告" }}</code>
        </span>
      </div>
    </div>
    <p v-else class="replay-flow-readout replay-flow-readout--empty" role="status">
      播放或选择一条已报告路径后，这里会显示数据方向与数据量；未报告的 bytes 不会被推测。
    </p>
    <div v-if="document.topology.nodes.length" class="replay-topology__canvas">
      <svg
        class="replay-topology__svg"
        :style="{ '--replay-canvas-width': `${canvasWidth()}px` }"
        :viewBox="`0 0 ${canvasWidth()} ${canvasHeight()}`"
        role="img"
        aria-labelledby="replay-topology-title"
        aria-describedby="replay-topology-description"
        focusable="false"
      >
        <title id="replay-topology-title">设备与链路拓扑示意</title>
        <desc id="replay-topology-description">
          图中只展示已报告 topology 节点和链路；实际路径请通过下方路径列表查看。
        </desc>
        <g class="replay-topology__links">
          <template v-for="link in document.topology.links" :key="link.id">
            <line
              v-if="cachedLinkPosition(link)"
              :x1="cachedLinkPosition(link)!.source.x"
              :y1="cachedLinkPosition(link)!.source.y"
              :x2="cachedLinkPosition(link)!.destination.x"
              :y2="cachedLinkPosition(link)!.destination.y"
              :class="{ 'is-highlighted': selectedLinkIncludes(link.id), 'is-active': activeLinkIncludes(link.id) }"
            />
          </template>
        </g>
        <g class="replay-topology__nodes">
          <g
            v-for="(node, index) in document.topology.nodes"
            :key="node.id"
            :transform="`translate(${nodeX(index)}, ${nodeY(index)})`"
            :class="{ 'is-highlighted': selectedPathIncludes(node.id), 'is-active': activePathIncludes(node.id) }"
          >
            <title>{{ node.label }} · {{ node.deviceType || "设备" }}</title>
            <rect x="-54" y="-22" width="108" height="44" rx="4" />
            <text y="-2" text-anchor="middle">{{ compactLabel(node.label) }}</text>
            <text y="13" text-anchor="middle" class="replay-topology__node-type">
              {{ compactLabel(node.deviceType || "设备", 15) }}
            </text>
          </g>
        </g>
        <g v-if="flowTokenPosition" class="replay-topology__flow-token" aria-hidden="true">
          <title>{{ flowAriaLabel }}</title>
          <circle :cx="flowTokenPosition.x" :cy="flowTokenPosition.y" r="8" />
          <circle :cx="flowTokenPosition.x" :cy="flowTokenPosition.y" r="3" class="replay-topology__flow-core" />
        </g>
      </svg>
    </div>
    <details
      v-if="document.routes.length"
      id="replay-topology-route-list"
      class="replay-topology__routes"
      :open="routeListExpanded"
      @toggle="onRouteListToggle"
    >
      <summary class="replay-topology__routes-summary">
        <span class="replay-topology__route-count">后端路径证据 · {{ document.routes.length }} 条</span>
        <span class="replay-topology__summary-meta">
          <span>按需查看</span>
          <span class="replay-topology__summary-caret" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <ReplayVirtualList
        v-slot="{ startIndex, topSpacerHeight, bottomSpacerHeight }"
        :total="document.routes.length"
        :row-height="ROUTE_ROW_HEIGHT"
        :active-index="selectedRouteIndex"
        :aria-label="`已报告路径，共 ${document.routes.length} 条`"
        @range-change="updateVisibleRange"
      >
        <div
          v-if="topSpacerHeight"
          class="replay-route-row__spacer"
          :style="{ height: `${topSpacerHeight}px` }"
          aria-hidden="true"
        ></div>
        <div
          v-for="(route, index) in visibleRoutes"
          :key="route.routeId"
          role="listitem"
          :aria-posinset="startIndex + index + 1"
          :aria-setsize="document.routes.length"
        >
          <button
            type="button"
            class="replay-route-row__select"
            :class="{ 'is-selected': selectedRouteId === route.routeId }"
            :aria-pressed="selectedRouteId === route.routeId"
            :aria-label="`${route.routeId} · ${routeStateLabel(route)}：${pathText(route)}`"
            :title="`${route.routeId} · ${pathText(route)}`"
            @click="emit('selectRoute', route.routeId)"
          >
            <span class="replay-route-row__state" :data-state="route.state">{{ routeStateLabel(route) }}</span>
            <span class="replay-route-row__path">{{ pathText(route) }}</span>
          </button>
          <ArtifactEvidenceLink :source-path="route.sourcePath" label="证据" />
        </div>
        <div
          v-if="bottomSpacerHeight"
          class="replay-route-row__spacer"
          :style="{ height: `${bottomSpacerHeight}px` }"
          aria-hidden="true"
        ></div>
      </ReplayVirtualList>
    </details>
    <p v-else class="replay-topology__empty">后端未提供实际路径。</p>
  </section>
</template>

<style scoped>
.replay-topology {
  min-width: 0;
  padding: 18px 20px 20px;
  border-top: 1px solid var(--line);
}
.replay-topology__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.replay-topology h3 {
  margin: 4px 0 12px;
  font-size: 16px;
}
.replay-topology__availability,
.replay-topology__empty,
.replay-topology__limit {
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-topology__limit {
  margin: 8px 0 0;
}
.replay-topology__route-count {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-topology__availability[data-status="available"] {
  color: var(--positive-ink);
}
.replay-topology__availability[data-status="partial"] {
  color: var(--warning-ink, var(--warning));
}
.replay-flow-readout {
  display: grid;
  gap: 9px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--line));
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--accent-soft) 46%, var(--surface));
  box-shadow: var(--shadow-hairline);
}
.replay-flow-readout--empty {
  color: var(--muted);
  background: var(--surface-subtle);
  box-shadow: none;
}
.replay-flow-readout__heading {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: baseline;
}
.replay-flow-readout__heading strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
}
.replay-flow-readout__status {
  margin-left: auto;
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--line));
  border-radius: 999px;
  color: var(--accent);
  font-size: 10px;
  white-space: nowrap;
}
.replay-flow-readout__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
}
.replay-flow-readout__facts span {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.replay-flow-readout__facts small {
  color: var(--muted);
  font-size: 10px;
}
.replay-flow-readout__facts code {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.replay-topology__canvas {
  min-height: 220px;
  max-height: min(62vh, 640px);
  overflow: auto;
  background: var(--surface-subtle);
  overscroll-behavior: contain;
  scrollbar-gutter: stable both-edges;
}
.replay-topology__svg {
  display: block;
  width: max(100%, var(--replay-canvas-width));
  height: auto;
  max-width: none;
  overflow: visible;
}
.replay-topology__links line {
  stroke: var(--line-strong);
  stroke-width: 2;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.replay-topology__links line.is-highlighted {
  stroke: var(--accent);
  stroke-width: 4;
}
.replay-topology__links line.is-active {
  stroke: var(--accent);
  stroke-width: 3.5;
  stroke-dasharray: 5 8;
  animation: replay-link-flow 900ms linear infinite;
}
.replay-topology__nodes g {
  color: var(--ink);
}
.replay-topology__nodes rect {
  fill: var(--surface);
  stroke: var(--line-strong);
  stroke-width: 1.5;
}
.replay-topology__nodes g.is-highlighted rect {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 3;
}
.replay-topology__nodes g.is-active rect {
  animation: replay-node-pulse 1200ms var(--ease-standard) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.replay-topology__nodes text {
  fill: currentColor;
  font-size: 12px;
}
.replay-topology__flow-token circle:first-child {
  fill: var(--accent);
  stroke: var(--panel-strong);
  stroke-width: 3;
  filter: drop-shadow(0 2px 4px color-mix(in srgb, var(--accent) 40%, transparent));
  animation: replay-flow-token-pulse 900ms var(--ease-standard) infinite;
}
.replay-topology__flow-core {
  fill: var(--on-accent, #fff);
  pointer-events: none;
}
.replay-topology__node-type {
  fill: var(--muted) !important;
  font-size: 10px !important;
}
.replay-topology__routes {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}
.replay-topology__routes-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 7px 0;
  cursor: pointer;
  list-style: none;
}
.replay-topology__routes-summary::-webkit-details-marker {
  display: none;
}
.replay-topology__routes-summary:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 3px;
  border-radius: var(--radius-control);
}
.replay-topology__summary-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}
.replay-topology__summary-caret {
  font-size: 16px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 160ms var(--ease-standard);
}
.replay-topology__routes[open] .replay-topology__summary-caret {
  transform: rotate(180deg);
}
.replay-topology__routes > [role="list"] {
  display: grid;
  gap: 6px;
}
.replay-topology__routes > [role="list"] > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 10px;
  align-items: center;
}
.replay-topology__routes > [role="list"] > div:not(.replay-route-row__spacer) {
  height: 64px;
}
.replay-topology__routes > [role="list"] > .replay-route-row__spacer {
  display: block;
  padding: 0;
  border: 0;
}
.replay-route-row__select {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding: 8px 10px;
  height: 40px;
  overflow: hidden;
  border: 1px solid var(--line);
  color: var(--ink);
  background: transparent;
  text-align: left;
}
.replay-route-row__select:hover,
.replay-route-row__select.is-selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.replay-route-row__state {
  color: var(--muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}
.replay-route-row__state[data-state="available"] {
  color: var(--positive-ink);
}
.replay-route-row__state[data-state="route_unavailable"],
.replay-route-row__state[data-state="topology_identity_mismatch"] {
  color: var(--danger-ink);
}
.replay-route-row__path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 11px var(--font-mono);
}

@keyframes replay-link-flow {
  to {
    stroke-dashoffset: -26;
  }
}

@keyframes replay-node-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 0 color-mix(in srgb, var(--accent) 0%, transparent));
  }
  50% {
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 42%, transparent));
  }
}
@keyframes replay-flow-token-pulse {
  0%,
  100% {
    opacity: 0.86;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .replay-topology__links line.is-active,
  .replay-topology__nodes g.is-active rect,
  .replay-topology__flow-token circle:first-child {
    animation: none;
  }
}

@media (max-width: 560px) {
  .replay-topology__canvas {
    min-height: 180px;
    max-height: 52vh;
  }

  .replay-topology__routes > [role="list"] > div {
    grid-template-columns: 1fr max-content;
  }
  .replay-route-row__select {
    grid-template-columns: 1fr;
    height: 48px;
  }
  .replay-route-row__path {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .replay-flow-readout__facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
