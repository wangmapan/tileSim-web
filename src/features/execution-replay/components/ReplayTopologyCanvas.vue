<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { layoutTopology, topologyNodeLabel } from "../../run-experiment";
import type { ReplayDocument, ReplayRoute, ReplayTopologyLink } from "../model/types";
import type { ReplayLayerVisibility } from "../model/layers";
import type { ReplayMode } from "../model/modes";
import { subscribePlaybackCursor } from "../model/playback-clock";
import { intervalProgress } from "../model/playback";
import ReplayVirtualList from "./ReplayVirtualList.vue";

const props = defineProps<{
  document: ReplayDocument;
  selectedRouteId: string | null;
  selectedFabricEventId?: string | null;
  selectedCollectiveStepId?: string | null;
  cursorPs?: string | null;
  visibleLayers?: ReplayLayerVisibility;
  mode?: ReplayMode;
  /** While playback is running, beads travel the active reported link on a display clock. */
  flowMotion?: boolean;
}>();
const emit = defineEmits<{ selectRoute: [routeId: string] }>();
const layerVisible = (key: keyof ReplayLayerVisibility) => props.visibleLayers?.[key] ?? true;
const showCollectiveEvidence = () => props.mode === undefined || props.mode === "collective";
const showRouteCatalog = () => props.mode !== "collective" && props.mode !== "network";
const topologyHeading = computed(() => {
  if (props.mode === "collective") return { kicker: "集合通信", title: "集合路径" };
  if (props.mode === "network") return { kicker: "设备与链路", title: "实际路径" };
  if (props.mode === "overview") return { kicker: "执行概览", title: "当前路径" };
  return { kicker: "设备与链路", title: "拓扑" };
});
const displayRoutes = computed(() => props.document.routes.filter(networkRouteRenderable));
const ROUTE_ROW_HEIGHT = 64;
const visibleStart = ref(0);
const visibleEnd = ref(Math.min(props.document.routes.length, 24));
const routeListExpanded = ref(false);
const visibleRoutes = computed(() => displayRoutes.value.slice(visibleStart.value, visibleEnd.value));
const selectedRouteIndex = computed(() =>
  displayRoutes.value.findIndex((route) => route.routeId === props.selectedRouteId),
);
const routeById = computed(() => new Map(props.document.routes.map((route) => [route.routeId, route])));
const fabricEventById = computed(() => new Map(props.document.fabricEvents.map((event) => [event.eventId, event])));
const collectiveStepById = computed(() => new Map(props.document.collective.steps.map((step) => [step.stepId, step])));
const hasReportedPath = computed(() => displayRoutes.value.some(hasPhysicalPathEvidence));
const NODE_HALF_WIDTH = 46;
const NODE_HALF_HEIGHT = 22;
const MAX_VISIBLE_FLOW_TOKENS = 6;
const FLOW_TRAVEL_MS = 1200;

const stateLabel: Record<ReplayRoute["state"], string> = {
  available: "路径已报告",
  partial: "路径部分报告",
  route_unavailable: "路径不可用",
  no_path: "路径细节未报告",
  topology_identity_mismatch: "拓扑身份不一致",
};

function routeStateLabel(route: ReplayRoute) {
  if (route.state === "available" && route.actualPath.length >= 2 && route.events.length === 0) {
    return "执行事件未报告";
  }
  return route.state === "no_path" && !route.hasInterval ? "后端未提供实际路径" : stateLabel[route.state];
}

const nodePositions = computed(() => {
  const placed = layoutTopology(
    props.document.topology.nodes.map((node) => ({
      device_id: node.id,
      device_type: node.deviceType,
      group_id: node.groupId,
    })),
    props.document.topology.links.map((link) => ({
      link_id: link.id,
      src_device: link.source,
      dst_device: link.destination,
      domain_id: link.domainId || "",
    })),
  );
  const points = Object.values(placed);
  if (!points.length) return new Map<string, { x: number; y: number }>();
  const minX = Math.min(...points.map((position) => position.x));
  const minY = Math.min(...points.map((position) => position.y));
  return new Map(
    Object.entries(placed).map(([id, position]) => [id, { x: position.x - minX + 88, y: position.y - minY + 64 }]),
  );
});

const canvasFrame = computed(() => {
  const positions = [...nodePositions.value.values()];
  if (!positions.length) return { minX: 0, minY: 0, width: 760, height: 280 };
  const minX = Math.min(...positions.map((position) => position.x)) - 96;
  const minY = Math.min(...positions.map((position) => position.y)) - 96;
  const maxX = Math.max(...positions.map((position) => position.x)) + 96;
  const maxY = Math.max(...positions.map((position) => position.y)) + 84;
  return {
    minX,
    minY,
    width: Math.max(360, maxX - minX),
    height: Math.max(280, maxY - minY),
  };
});

const nodesById = computed(() => new Map(props.document.topology.nodes.map((node) => [node.id, node])));

function linkCrossesGroups(link: ReplayTopologyLink) {
  const sourceGroup = nodesById.value.get(link.source)?.groupId;
  const destinationGroup = nodesById.value.get(link.destination)?.groupId;
  return Boolean(sourceGroup && destinationGroup && sourceGroup !== destinationGroup);
}

const groupFrames = computed(() => {
  const grouped = new Map<string, Array<{ x: number; y: number }>>();
  for (const node of props.document.topology.nodes) {
    const groupId = node.groupId?.trim();
    const position = groupId ? nodePositions.value.get(node.id) : undefined;
    if (!groupId || !position) continue;
    const points = grouped.get(groupId) || [];
    points.push(position);
    grouped.set(groupId, points);
  }
  return [...grouped.entries()].map(([id, points]) => {
    const minX = Math.min(...points.map((point) => point.x)) - 64;
    const maxX = Math.max(...points.map((point) => point.x)) + 64;
    const minY = Math.min(...points.map((point) => point.y)) - 46;
    const maxY = Math.max(...points.map((point) => point.y)) + 40;
    return { id, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
});

const topologyLinksById = computed(() => new Map(props.document.topology.links.map((link) => [link.id, link])));

function compactLabel(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function nodePosition(id: string) {
  return nodePositions.value.get(id) || null;
}

function isRouteActive(route: ReplayRoute, cursorPs = props.cursorPs) {
  if (
    !networkRouteRenderable(route) ||
    !hasPhysicalPathEvidence(route) ||
    !cursorPs ||
    !route.timing ||
    route.state !== "available" ||
    !route.hasInterval
  )
    return false;
  const cursor = BigInt(cursorPs);
  return cursor >= BigInt(route.timing.startPs) && cursor < BigInt(route.timing.endPs);
}

function networkRouteRenderable(route: ReplayRoute) {
  return props.mode !== "network" || (route.actualPath.length >= 2 && route.events.length > 0);
}

function hasPhysicalPathEvidence(route: ReplayRoute) {
  return route.state === "available" && route.actualPath.length >= 2 && route.events.length > 0;
}

function routeIsFocused(route: ReplayRoute) {
  // Collective steps and Fabric records share the backend-reported phase_id.
  // Joining on that identity lets a selected allreduce/allgather step light up
  // its real route without deriving a path from topology or aggregate metrics.
  const matchesCollectiveStep = Boolean(
    selectedCollectivePhaseId.value && selectedCollectivePhaseId.value === route.phaseId,
  );
  return (
    networkRouteRenderable(route) &&
    hasPhysicalPathEvidence(route) &&
    (props.selectedRouteId === route.routeId || matchesCollectiveStep || isRouteActive(route))
  );
}

const selectedCollectivePhaseId = computed(() =>
  showCollectiveEvidence() && layerVisible("collective")
    ? props.document.collective.steps.find((step) => step.stepId === props.selectedCollectiveStepId)?.phaseId || null
    : null,
);

const focusedRoutes = computed(() =>
  layerVisible("fabric") ? props.document.routes.filter((route) => routeIsFocused(route)) : [],
);
const activeRoutes = computed(() =>
  layerVisible("fabric") ? props.document.routes.filter((route) => isRouteActive(route)) : [],
);
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
const currentCollectiveStep = computed(() =>
  showCollectiveEvidence() && layerVisible("collective")
    ? selectedCollectiveStep.value ||
      props.document.collective.steps.find((step) => timingActive(step.timing, props.cursorPs || null)) ||
      null
    : null,
);

function routeForPhase(phaseId: string | undefined) {
  if (!phaseId) return null;
  return (
    props.document.routes.find(
      (route) =>
        networkRouteRenderable(route) &&
        hasPhysicalPathEvidence(route) &&
        route.phaseId === phaseId &&
        route.actualPath.length >= 2,
    ) || null
  );
}

const currentFabricEvent = computed(() => {
  if (!layerVisible("fabric")) return null;
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
  if (!layerVisible("fabric")) return null;
  const route = fabricEvent
    ? routeById.value.get(fabricEvent.routeId) || null
    : (props.selectedRouteId && routeById.value.get(props.selectedRouteId)) ||
      props.document.routes.find((candidate) => isRouteActive(candidate)) ||
      null;
  if (route && (!networkRouteRenderable(route) || !hasPhysicalPathEvidence(route))) return null;
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

type ReplayFlowToken = {
  key: string;
  x: number;
  y: number;
  angle: number;
  title: string;
  kind: "collective" | "fabric";
};

type ReplayRouteSegment = {
  key: string;
  routeId: string;
  source: { x: number; y: number };
  destination: { x: number; y: number };
};

function trimRouteSegment(source: { x: number; y: number }, destination: { x: number; y: number }) {
  const dx = destination.x - source.x;
  const dy = destination.y - source.y;
  const scaleX = Math.abs(dx) > 0 ? NODE_HALF_WIDTH / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 0 ? NODE_HALF_HEIGHT / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const inset = Math.min(scaleX, scaleY, 0.42);
  return {
    source: { x: source.x + dx * inset, y: source.y + dy * inset },
    destination: { x: destination.x - dx * inset, y: destination.y - dy * inset },
  };
}

function routePoints(route: ReplayRoute): Array<{ x: number; y: number }> | null {
  if (!hasPhysicalPathEvidence(route)) return null;
  if (route.linkIds.length !== route.actualPath.length - 1) return null;
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < route.actualPath.length - 1; index += 1) {
    const linkId = route.linkIds[index];
    const baseId = linkId.replace(/::(?:forward|reverse)$/, "");
    const link = topologyLinksById.value.get(linkId) || topologyLinksById.value.get(baseId);
    if (!link) return null;
    const sourceId = route.actualPath[index];
    const destinationId = route.actualPath[index + 1];
    const position = linkPosition(link);
    if (!position) return null;
    if (link.source === sourceId && link.destination === destinationId) {
      if (!points.length) points.push(position.source);
      points.push(position.destination);
    } else if (link.source === destinationId && link.destination === sourceId) {
      if (!points.length) points.push(position.destination);
      points.push(position.source);
    } else return null;
  }
  return points.length >= 2 ? points : null;
}

function travelPoints(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return points;
  const first = trimRouteSegment(points[0], points[1]).source;
  const last = trimRouteSegment(points[points.length - 2], points[points.length - 1]).destination;
  return points.length === 2 ? [first, last] : [first, ...points.slice(1, -1), last];
}

function flowTravelProgress(key: string, now: number) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 33 + key.charCodeAt(index)) >>> 0;
  return ((now + (hash % FLOW_TRAVEL_MS)) % FLOW_TRAVEL_MS) / FLOW_TRAVEL_MS;
}

function tokenPositionForRoute(
  route: ReplayRoute,
  timing: FlowTiming,
  cursorPs = props.cursorPs,
  progressOverride?: number,
): { x: number; y: number; angle: number } | null {
  if (progressOverride === undefined && !cursorPs) return null;
  const points = travelPoints(routePoints(route) || []);
  if (points.length < 2) return null;
  const progress = progressOverride ?? intervalProgress(cursorPs || "0", timing);
  const segment = Math.min(points.length - 2, Math.floor(progress * (points.length - 1)));
  const fraction = progress * (points.length - 1) - segment;
  const from = points[segment];
  const to = points[segment + 1];
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
  };
}

const activeCollectiveSteps = computed(() =>
  showCollectiveEvidence() && layerVisible("collective")
    ? props.document.collective.steps.filter((step) => timingActive(step.timing, props.cursorPs || null))
    : [],
);
const activeFlowRoutes = computed(() => {
  const routes = new Map<string, { route: ReplayRoute; timing: FlowTiming }>();
  for (const route of activeRoutes.value) {
    if (route.timing) routes.set(route.routeId, { route, timing: route.timing });
  }
  // A collective phase can be the only timing evidence for a joined route.
  // Keep the path, but use the collective interval for its directional rail.
  for (const step of activeCollectiveSteps.value) {
    const route = routeForPhase(step.phaseId);
    if (route && !routes.has(route.routeId)) routes.set(route.routeId, { route, timing: step.timing });
  }
  return [...routes.values()];
});

const activeRouteSegments = computed<ReplayRouteSegment[]>(() => {
  const result: ReplayRouteSegment[] = [];
  for (const { route } of activeFlowRoutes.value) {
    const points = routePoints(route);
    if (!points) continue;
    for (let index = 0; index < points.length - 1; index += 1) {
      const segment = trimRouteSegment(points[index], points[index + 1]);
      result.push({
        key: `${route.routeId}-${index}`,
        routeId: route.routeId,
        source: segment.source,
        destination: segment.destination,
      });
    }
  }
  return result;
});

function tokensForCursor(cursor: string | null, motionNow?: number): ReplayFlowToken[] {
  if (!cursor) return [];
  const result: ReplayFlowToken[] = [];
  const seen = new Set<string>();
  const collectiveSteps =
    showCollectiveEvidence() && layerVisible("collective")
      ? props.document.collective.steps.filter((step) => timingActive(step.timing, cursor))
      : [];
  const collectiveRouteIds = new Set(
    collectiveSteps.map((step) => routeForPhase(step.phaseId)?.routeId).filter((routeId): routeId is string => Boolean(routeId)),
  );
  for (const route of layerVisible("fabric") ? props.document.routes.filter(networkRouteRenderable) : []) {
    if (!route.timing || !isRouteActive(route, cursor) || collectiveRouteIds.has(route.routeId)) continue;
    const position = tokenPositionForRoute(
      route,
      route.timing,
      cursor,
      motionNow === undefined ? undefined : flowTravelProgress(route.routeId, motionNow),
    );
    if (!position || seen.has(route.routeId)) continue;
    seen.add(route.routeId);
    result.push({ key: `route-${route.routeId}`, ...position, title: route.routeId, kind: "fabric" });
  }
  for (const step of collectiveSteps) {
    const route = routeForPhase(step.phaseId);
    if (!route || seen.has(`collective-${step.stepId}`)) continue;
    const position = tokenPositionForRoute(
      route,
      step.timing,
      cursor,
      motionNow === undefined ? undefined : flowTravelProgress(step.stepId, motionNow),
    );
    if (!position) continue;
    seen.add(`collective-${step.stepId}`);
    result.push({
      key: `collective-${step.stepId}`,
      ...position,
      title: step.phaseLabel || step.collectiveId,
      kind: "collective",
    });
  }
  return result;
}

function layoutTokens(tokens: ReplayFlowToken[]) {
  const lanes = new Map<string, number>();
  return tokens.slice(0, MAX_VISIBLE_FLOW_TOKENS).map((token) => {
    const laneKey = `${Math.round(token.angle)}:${Math.round(token.x / 24)}:${Math.round(token.y / 24)}`;
    const lane = lanes.get(laneKey) || 0;
    lanes.set(laneKey, lane + 1);
    if (!lane) return token;
    const radians = (token.angle * Math.PI) / 180;
    const shift = lane * 12;
    return {
      ...token,
      x: token.x - Math.sin(radians) * shift,
      y: token.y + Math.cos(radians) * shift,
    };
  });
}

const flowTokenPositions = computed(() => tokensForCursor(props.cursorPs || null));
const visibleFlowTokens = computed(() => layoutTokens(flowTokenPositions.value));

const topologyRoot = ref<HTMLElement | null>(null);
let unsubscribePlayback: (() => void) | null = null;
let clockCursor: string | null = null;

function paintTokenNodes(tokens: ReplayFlowToken[]) {
  const nodes = topologyRoot.value?.querySelectorAll<SVGGElement>(".replay-topology__flow-token");
  if (!nodes?.length) return;
  const placed = new Map(tokens.map((token) => [token.key, token]));
  nodes.forEach((node) => {
    const token = placed.get(node.getAttribute("data-token") || "");
    if (!token) return;
    node.setAttribute("transform", `translate(${token.x} ${token.y}) rotate(${token.angle})`);
  });
}

function paintTokens(cursor: string) {
  clockCursor = cursor;
  if (props.flowMotion) {
    paintFlowMotion(performance.now());
    return;
  }
  paintTokenNodes(layoutTokens(tokensForCursor(cursor)));
}

function paintFlowMotion(now: number) {
  const cursor = clockCursor || props.cursorPs || null;
  if (!cursor) return;
  const tokens = tokensForCursor(cursor, now)
    .slice(0, MAX_VISIBLE_FLOW_TOKENS)
    .map((token) => {
      let hash = 0;
      for (let index = 0; index < token.key.length; index += 1) hash = (hash * 33 + token.key.charCodeAt(index)) >>> 0;
      const shift = (hash % 3) - 1;
      if (!shift) return token;
      const radians = (token.angle * Math.PI) / 180;
      const distance = shift * 11;
      return {
        ...token,
        x: token.x - Math.sin(radians) * distance,
        y: token.y + Math.cos(radians) * distance,
      };
    });
  paintTokenNodes(tokens);
}

watch(
  () => props.flowMotion,
  (playing) => {
    if (playing) return;
    if (props.cursorPs) paintTokens(props.cursorPs);
  },
);

onMounted(() => {
  unsubscribePlayback = subscribePlaybackCursor(paintTokens);
});
onUpdated(() => {
  if (props.flowMotion) {
    paintFlowMotion(performance.now());
    return;
  }
  if (clockCursor) paintTokens(clockCursor);
});
onBeforeUnmount(() => {
  unsubscribePlayback?.();
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
  () => displayRoutes.value.length,
  (total) => {
    if (visibleStart.value >= total) visibleStart.value = 0;
    visibleEnd.value = Math.min(total, Math.max(visibleEnd.value, visibleStart.value + 1));
  },
);
</script>

<template>
  <section
    ref="topologyRoot"
    class="replay-topology"
    aria-label="设备与链路回放"
    data-help-anchor="replay-evidence"
  >
    <header class="replay-topology__header">
      <div>
        <span class="section-kicker">{{ topologyHeading.kicker }}</span>
        <h3>{{ topologyHeading.title }}</h3>
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
        <span v-if="activeFlowRoutes.length">
          <small>同时活动流</small>
          <code>{{ activeFlowRoutes.length }} 条</code>
        </span>
      </div>
    </div>
    <p v-else class="replay-flow-readout replay-flow-readout--empty" role="status">
      播放或选择一条已报告路径后，这里会显示数据方向与数据量；未报告的 bytes 不会被推测。
    </p>
    <div v-if="document.topology.nodes.length" class="replay-topology__canvas">
      <svg
        class="replay-topology__svg"
        :style="{ '--replay-canvas-width': `${canvasFrame.width}px` }"
        :viewBox="`${canvasFrame.minX} ${canvasFrame.minY} ${canvasFrame.width} ${canvasFrame.height}`"
        role="img"
        aria-labelledby="replay-topology-title"
        aria-describedby="replay-topology-description"
        focusable="false"
      >
        <title id="replay-topology-title">设备与链路拓扑</title>
        <desc id="replay-topology-description">
          底图使用已验证拓扑的设备和链路。圆点只沿当前游标下已报告的路径移动。
        </desc>
        <defs>
          <marker
            id="replay-flow-arrow"
            class="replay-topology__flow-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>
        <g v-if="groupFrames.length" class="replay-topology__groups" data-layer="groups">
          <g v-for="frame in groupFrames" :key="frame.id">
            <rect :x="frame.x" :y="frame.y" :width="frame.width" :height="frame.height" rx="8" />
            <text :x="frame.x + 14" :y="frame.y + 20">{{ frame.id }}</text>
          </g>
        </g>
        <g v-if="layerVisible('topology')" class="replay-topology__links" data-layer="topology">
          <template v-for="link in document.topology.links" :key="link.id">
            <line
              v-if="cachedLinkPosition(link)"
              :x1="cachedLinkPosition(link)!.source.x"
              :y1="cachedLinkPosition(link)!.source.y"
              :x2="cachedLinkPosition(link)!.destination.x"
              :y2="cachedLinkPosition(link)!.destination.y"
              :class="{
                'is-cross': linkCrossesGroups(link),
                'is-highlighted': selectedLinkIncludes(link.id),
                'is-active': activeLinkIncludes(link.id),
              }"
            />
          </template>
        </g>
        <g
          v-if="layerVisible('fabric') || layerVisible('collective')"
          class="replay-topology__flow-links"
          aria-hidden="true"
          data-layer="flow"
        >
          <line
            v-for="segment in activeRouteSegments"
            :key="segment.key"
            :x1="segment.source.x"
            :y1="segment.source.y"
            :x2="segment.destination.x"
            :y2="segment.destination.y"
            class="replay-topology__flow-link"
            marker-end="url(#replay-flow-arrow)"
          />
        </g>
        <g
          v-if="
            layerVisible('topology') || layerVisible('device') || layerVisible('fabric') || layerVisible('collective')
          "
          class="replay-topology__nodes"
          data-layer="nodes"
        >
          <g
            v-for="node in document.topology.nodes"
            :key="node.id"
            :transform="`translate(${nodePosition(node.id)?.x || 0}, ${nodePosition(node.id)?.y || 0})`"
            :class="{ 'is-highlighted': selectedPathIncludes(node.id), 'is-active': activePathIncludes(node.id) }"
          >
            <title>{{ node.label }} · {{ topologyNodeLabel(node.deviceType) }}</title>
            <rect x="-46" y="-22" width="92" height="44" rx="8" />
            <text class="replay-topology__node-id" y="-2" text-anchor="middle">{{ compactLabel(node.label) }}</text>
            <text y="14" text-anchor="middle" class="replay-topology__node-type">
              {{ compactLabel(topologyNodeLabel(node.deviceType), 14) }}
            </text>
          </g>
        </g>
        <g
          v-for="token in visibleFlowTokens"
          :key="token.key"
          class="replay-topology__flow-token"
          :data-token="token.key"
          :class="[`is-${token.kind}`, { 'is-selected': token.key === `route-${selectedRouteId}` }]"
          :transform="`translate(${token.x} ${token.y}) rotate(${token.angle})`"
          aria-hidden="true"
        >
          <title>{{ token.title }}</title>
          <circle class="replay-topology__flow-trail" cx="-18" r="2.2" />
          <circle class="replay-topology__flow-trail replay-topology__flow-trail--mid" cx="-10" r="3.2" />
          <circle class="replay-topology__flow-dot" r="5.5" />
        </g>
      </svg>
    </div>
    <p v-if="document.topology.nodes.length" class="replay-topology__legend">
      <span v-if="groupFrames.length">实线是同一计算组，虚线是不同计算组。</span>
      <span>播放时圆点沿当前已报告的活动链路流动，暂停后停在该时刻的位置。</span>
      <span v-if="flowTokenPositions.length > visibleFlowTokens.length">
        同时有 {{ activeFlowRoutes.length }} 条活动流，图上画出 {{ visibleFlowTokens.length }} 条。
      </span>
    </p>
    <details
      v-if="showRouteCatalog() && displayRoutes.length && layerVisible('fabric')"
      id="replay-topology-route-list"
      class="replay-topology__routes"
      :open="routeListExpanded"
      @toggle="onRouteListToggle"
    >
      <summary class="replay-topology__routes-summary">
        <span class="replay-topology__route-count">后端路径证据 · {{ displayRoutes.length }} 条</span>
        <span class="replay-topology__summary-meta">
          <span>按需查看</span>
          <span class="replay-topology__summary-caret" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <ReplayVirtualList
        v-slot="{ startIndex, topSpacerHeight, bottomSpacerHeight }"
        :total="displayRoutes.length"
        :row-height="ROUTE_ROW_HEIGHT"
        :active-index="selectedRouteIndex"
        :aria-label="`已报告路径，共 ${displayRoutes.length} 条`"
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
          :aria-setsize="displayRoutes.length"
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
    <p
      v-else-if="showRouteCatalog() && layerVisible('fabric') && document.topology.nodes.length"
      class="replay-topology__empty"
    >
      后端未提供实际路径。
    </p>
    <p v-else-if="showRouteCatalog() && document.topology.nodes.length" class="replay-topology__empty">
      Fabric 层已隐藏，已报告路径不会画在图上。
    </p>
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
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 18px;
  margin: 0 0 10px;
  padding: 8px 12px;
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
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}
.replay-flow-readout__facts span {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 6px;
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
  display: flex;
  justify-content: center;
  min-height: 240px;
  max-height: min(70vh, 760px);
  overflow: auto;
  background:
    linear-gradient(var(--surface-subtle), var(--surface-subtle)),
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 58%);
  overscroll-behavior: contain;
}
.replay-topology__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 8px 0 0;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-topology__groups rect {
  fill: color-mix(in srgb, var(--accent) 4%, var(--surface));
  stroke: color-mix(in srgb, var(--line-strong) 75%, transparent);
  stroke-width: 1;
}
.replay-topology__groups text {
  fill: var(--muted);
  font-size: 11px;
}
.replay-topology__svg {
  display: block;
  width: min(100%, var(--replay-canvas-width));
  height: auto;
  margin-inline: auto;
  overflow: visible;
}
.replay-topology__links line {
  stroke: color-mix(in srgb, var(--line-strong) 88%, var(--muted));
  stroke-width: 1.75;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.replay-topology__links line.is-highlighted {
  stroke: var(--accent);
  stroke-width: 4;
}
.replay-topology__links line.is-cross:not(.is-active):not(.is-highlighted) {
  stroke-dasharray: 6 5;
}
.replay-topology__links line.is-active {
  stroke: var(--accent);
  stroke-width: 3.5;
}
.replay-topology__flow-link {
  stroke: var(--accent);
  stroke-width: 1.75;
  stroke-linecap: round;
  opacity: 0.72;
  vector-effect: non-scaling-stroke;
  marker-end: url(#replay-flow-arrow);
}
.replay-topology__flow-arrow path {
  fill: var(--accent);
}
.replay-topology__nodes g {
  color: var(--ink);
}
.replay-topology__nodes rect {
  fill: var(--surface);
  stroke: color-mix(in srgb, var(--line-strong) 70%, transparent);
  stroke-width: 1;
}
.replay-topology__nodes g.is-highlighted rect,
.replay-topology__nodes g.is-active rect {
  fill: var(--accent-soft);
  stroke: var(--accent);
  stroke-width: 1.5;
}
.replay-topology__nodes text {
  fill: currentColor;
  font-size: 13px;
  font-weight: 650;
}
.replay-topology__flow-dot {
  fill: var(--accent);
  stroke: var(--surface);
  stroke-width: 2;
}
.replay-topology__flow-halo {
  fill: color-mix(in srgb, var(--accent) 18%, transparent);
  stroke: color-mix(in srgb, var(--accent) 55%, transparent);
  stroke-width: 1;
  opacity: 0.7;
}
.replay-topology__flow-trail {
  fill: var(--accent);
  opacity: 0.28;
}
.replay-topology__flow-trail--mid {
  opacity: 0.5;
}
.replay-topology__flow-core {
  fill: var(--on-accent, #fff);
  pointer-events: none;
}
.replay-topology__node-type {
  fill: var(--muted) !important;
  font-size: 10px !important;
  font-weight: 500;
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
