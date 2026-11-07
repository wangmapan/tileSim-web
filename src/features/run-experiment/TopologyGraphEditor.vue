<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  LayoutGrid,
  LocateFixed,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "@lucide/vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import DeviceInventoryForm from "./DeviceInventoryForm.vue";
import TopologyLinkProperties from "./TopologyLinkProperties.vue";
import bridgeIllustration from "../../assets/topology-nodes/bridge.png";
import cpuHostIllustration from "../../assets/topology-nodes/cpu-host.png";
import gpuIllustration from "../../assets/topology-nodes/gpu.png";
import nicIllustration from "../../assets/topology-nodes/nic.png";
import routerIllustration from "../../assets/topology-nodes/router.png";
import storageIllustration from "../../assets/topology-nodes/storage.png";
import switchIllustration from "../../assets/topology-nodes/switch.png";
import unknownIllustration from "../../assets/topology-nodes/unknown.png";
import { moduleBindingFields, moduleBindingOverrideFields, type SchemaFieldMeta } from "./input-schema-meta";
import {
  addModuleBinding,
  moduleBindingNamesOf,
  isJsonObject,
  nextModuleBindingName,
  patchJsonDocument,
  removeModuleBinding,
  renameModuleBinding,
  setModuleBindingKind,
  setModuleBindingText,
  StructuredInputError,
  topologyDomainsOf,
  type DomainType,
  type JsonObject,
} from "./structured-input";
import {
  parseTopologyDocument,
  topologyJson,
  type TopologyDevice,
  type TopologyDocument,
  type TopologyLink,
} from "./topology-graph";
import {
  topologyNodeCategory,
  topologyNodeLabel,
  topologyNodeType,
  type TopologyNodeType,
} from "./topology-node-types";
import {
  decideTopologyConnection,
  superNodeForDevice,
  topologySuperNodes,
  type TopologySuperNode,
} from "./topology-supernodes";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    fieldPath?: string;
    readOnly?: boolean;
    showJson?: boolean;
    showGraph?: boolean;
    showModuleSettings?: boolean;
    topologyNodeTypes?: readonly TopologyNodeType[];
  }>(),
  {
    fieldPath: "",
    readOnly: false,
    showJson: true,
    showGraph: true,
    showModuleSettings: true,
    topologyNodeTypes: () => [],
  },
);
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "device-count-change", payload: { ids: string[] }): void;
  (event: "notice", payload: { tone: "info" | "warning"; message: string }): void;
}>();
const { t } = useI18n();
const instanceId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const jsonEditorId = computed(() => `topology-json-editor-${instanceId}`);
const jsonErrorId = computed(() => `topology-json-editor-error-${instanceId}`);
const parsed = ref(parseTopologyDocument(props.modelValue));
const envelope = ref<Record<string, unknown> | null>(parsed.value.envelope);
const selectedLink = ref<number | null>(null);
const selectedDeviceId = ref<string | null>(null);
const pendingConnection = ref<string | null>(null);
const drag = ref<{
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  moved: boolean;
} | null>(null);
const positions = ref<Record<string, { x: number; y: number }>>({});
const arrangementApplied = ref(false);
const arrangementSignature = ref("");
const editorRegion = ref<HTMLElement | null>(null);
const fullscreenSupported = ref(false);
const isFullscreen = ref(false);
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const panDrag = ref<{
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null>(null);
const workbenchNotice = ref<{ tone: "info" | "warning"; message: string } | null>(null);
const clearPending = ref(false);
const CANVAS_WIDTH = 760;
const DEVICE_X_GAP = 190;
const DEVICE_Y_START = 86;
const DEVICE_Y_GAP = 110;
const ARRANGEMENT_DEVICE_Y_GAP = 132;
const ARRANGEMENT_GROUP_ROW_GAP = 72;
const ARRANGEMENT_CARD_HEIGHT = 86;
const ARRANGEMENT_INNER_X_GAP = 144;
const ARRANGEMENT_ROW_GAP = 48;
const ARRANGEMENT_SIDE_INSET = 48;
const NODE_HALF_WIDTH = 58;
const NODE_HALF_HEIGHT = 36;
const GROUP_PADDING_X = 68;
const GROUP_PADDING_TOP = 78;
const GROUP_PADDING_BOTTOM = 54;
const topologyIllustrations: Record<string, string> = {
  bridge: bridgeIllustration,
  cpu: cpuHostIllustration,
  gpu: gpuIllustration,
  nic: nicIllustration,
  router: routerIllustration,
  storage: storageIllustration,
  switch: switchIllustration,
};
const graph = computed(() => parsed.value.document);
const links = computed(() => graph.value?.links || []);
const domains = computed(() => graph.value?.domains || []);
const devices = computed(() => graph.value?.devices || []);
const hasGraph = computed(() => Boolean(graph.value));
const editableEmptyGraph = computed(() => props.showGraph && !props.readOnly && !props.modelValue.trim() && !parsed.value.error);
const showGraphWorkspace = computed(() => props.showGraph && (hasGraph.value || editableEmptyGraph.value));
const emptyWorkbenchDocument = JSON.stringify({
  topology: { devices: [], module_bindings: [], domains: [], links: [] },
});
const workbenchModelValue = computed(() => (props.modelValue.trim() ? props.modelValue : emptyWorkbenchDocument));
const selected = computed(() => (selectedLink.value === null ? null : links.value[selectedLink.value] || null));
const selectedDevice = computed(() =>
  selectedDeviceId.value ? devices.value.find((device) => device.device_id === selectedDeviceId.value) || null : null,
);
const superNodes = computed(() => topologySuperNodes(devices.value, domains.value));
/**
 * Layout follows compute-group display projections. The scale_out domain is
 * an endpoint scope and therefore never creates a layout group of its own.
 */
const domainComponents = computed<TopologyDevice[][]>(() => {
  const owned = new Set(superNodes.value.flatMap((node) => node.devices.map((device) => device.device_id)));
  const unowned = devices.value.filter((device) => !owned.has(device.device_id));
  return [...superNodes.value.map((node) => node.devices), ...(unowned.length ? [unowned] : [])];
});
const superNodeBounds = computed(() =>
  superNodes.value
    .map((node) => {
      const members = node.devices
        .map((device) => positions.value[device.device_id])
        .filter((position): position is { x: number; y: number } => Boolean(position));
      if (!members.length) return null;
      const minX = Math.min(...members.map((position) => position.x));
      const maxX = Math.max(...members.map((position) => position.x));
      const minY = Math.min(...members.map((position) => position.y));
      const maxY = Math.max(...members.map((position) => position.y));
      return {
        node,
        x: minX - GROUP_PADDING_X,
        y: minY - GROUP_PADDING_TOP,
        width: Math.max(200, maxX - minX + GROUP_PADDING_X * 2),
        height: Math.max(160, maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM),
      };
    })
    .filter((bounds): bounds is { node: TopologySuperNode; x: number; y: number; width: number; height: number } =>
      Boolean(bounds),
    ),
);
type CrossLinkBundle = {
  key: string;
  domainId: string;
  sourceNodeId: string;
  targetNodeId: string;
  linkIndexes: number[];
};
const crossLinkBundles = computed<CrossLinkBundle[]>(() => {
  const bundles = new Map<string, CrossLinkBundle>();
  links.value.forEach((link, index) => {
    if (linkKind(link) !== "cross") return;
    const sourceNode = superNodeForDevice(link.src_device, superNodes.value);
    const targetNode = superNodeForDevice(link.dst_device, superNodes.value);
    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return;
    const [sourceNodeId, targetNodeId] = [sourceNode.id, targetNode.id].sort();
    const key = `${link.domain_id}::${sourceNodeId}::${targetNodeId}`;
    const existing = bundles.get(key);
    if (existing) existing.linkIndexes.push(index);
    else bundles.set(key, { key, domainId: link.domain_id, sourceNodeId, targetNodeId, linkIndexes: [index] });
  });
  return [...bundles.values()];
});
function groupDisplayLabel(node: TopologySuperNode) {
  const groupIds = [...new Set(node.devices.map((device) => device.group_id).filter(Boolean))];
  return groupIds.length === 1 ? groupIds[0] || node.label : node.label;
}
const arrangementGroups = computed(() =>
  domainComponents.value.map((devicesInGroup) => {
    const columns = groupColumns(devicesInGroup.length);
    const rows = Math.max(1, Math.ceil(devicesInGroup.length / columns));
    return {
      devices: devicesInGroup,
      columns,
      rows,
      width: (columns - 1) * ARRANGEMENT_INNER_X_GAP + 124,
      height: (rows - 1) * ARRANGEMENT_DEVICE_Y_GAP + ARRANGEMENT_CARD_HEIGHT,
    };
  }),
);
const arrangementRows = computed(() => {
  const rows: (typeof arrangementGroups.value)[] = [];
  let current: typeof arrangementGroups.value = [];
  let currentWidth = 0;
  const maxWidth = CANVAS_WIDTH - ARRANGEMENT_SIDE_INSET * 2;
  arrangementGroups.value.forEach((group) => {
    const nextWidth = current.length ? currentWidth + ARRANGEMENT_ROW_GAP + group.width : group.width;
    if (current.length && nextWidth > maxWidth) {
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(group);
    currentWidth += current.length > 1 ? ARRANGEMENT_ROW_GAP + group.width : group.width;
  });
  if (current.length) rows.push(current);
  return rows;
});
const deviceColumns = computed(() =>
  Math.min(
    4,
    Math.max(1, devices.value.length <= 4 ? devices.value.length : Math.ceil(Math.sqrt(devices.value.length))),
  ),
);
const deviceRows = computed(() => Math.max(1, Math.ceil(devices.value.length / deviceColumns.value)));
const defaultCanvasHeight = computed(() =>
  Math.max(240, DEVICE_Y_START + Math.max(0, deviceRows.value - 1) * DEVICE_Y_GAP + 145),
);
const arrangedCanvasHeight = computed(() =>
  Math.max(
    240,
    links.value.length
      ? Math.max(...Object.values(positions.value).map((position) => position.y), DEVICE_Y_START) + 92
      : DEVICE_Y_START +
          arrangementRows.value.reduce(
            (height, row) => height + Math.max(...row.map((group) => group.height)) + ARRANGEMENT_GROUP_ROW_GAP,
            0,
          ) +
          44,
  ),
);
const canvasHeight = computed(() =>
  arrangementApplied.value ? arrangedCanvasHeight.value : defaultCanvasHeight.value,
);
const topologyFieldError = computed(() => {
  const path = props.fieldPath || "";
  return path === "/custom_inputs/topology" || path.startsWith("/custom_inputs/topology/");
});
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;
const ZOOM_BUTTON_STEP = 0.1;
const zoomOptions = Array.from({ length: 30 }, (_, index) => (index + 1) / 10);
const WORKSPACE_HEIGHT = 520;
// The SVG viewport stays fixed while the scene can extend beyond it. That is
// what makes the workspace effectively infinite: large layouts are explored by
// panning instead of shrinking the whole graph to fit.
const viewBoxHeight = computed(() => Math.max(WORKSPACE_HEIGHT, canvasHeight.value));
const sceneOffsetY = computed(() => Math.max(0, (viewBoxHeight.value - canvasHeight.value) / 2));
const sceneTransform = computed(() => {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = canvasHeight.value / 2;
  return `translate(${pan.value.x} ${pan.value.y + sceneOffsetY.value}) translate(${centerX} ${centerY}) scale(${zoom.value}) translate(${-centerX} ${-centerY})`;
});
const canvasStyle = computed(() => ({
  width: "100%",
  minWidth: "0",
  height: "100%",
  minHeight: "0",
}));

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === editorRegion.value;
}
function toggleFullscreen() {
  const element = editorRegion.value;
  if (!element || !fullscreenSupported.value) return;
  const action = document.fullscreenElement === element ? document.exitFullscreen?.() : element.requestFullscreen?.();
  if (action instanceof Promise) {
    void action.catch(() => {
      // Browsers may reject fullscreen when it was not initiated by a user gesture.
    });
  }
}
function setZoom(value: number) {
  zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(value * 100) / 100));
}
function zoomIn() {
  setZoom(zoom.value + ZOOM_BUTTON_STEP);
}
function zoomOut() {
  setZoom(zoom.value - ZOOM_BUTTON_STEP);
}
function resetView() {
  zoom.value = 1;
  pan.value = { x: 0, y: 0 };
}
function requestClearCanvas() {
  if (props.readOnly || !graph.value) return;
  clearPending.value = true;
}
function cancelClearCanvas() {
  clearPending.value = false;
}
function clearCanvas() {
  if (props.readOnly || !graph.value || !clearPending.value) return;
  updateDocument((document) => {
    document.devices = [];
    document.links = [];
    document.domains = [];
  });
  clearPending.value = false;
  selectedLink.value = null;
  pendingConnection.value = null;
  positions.value = {};
  arrangementApplied.value = false;
  arrangementSignature.value = "";
  resetView();
  emit("device-count-change", { ids: [] });
  emit("notice", { tone: "info", message: t("画布已清除。") });
}
function selectZoom(event: Event) {
  const value = Number((event.target as HTMLSelectElement | null)?.value);
  if (Number.isFinite(value)) setZoom(value);
}
function zoomOptionLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

onMounted(() => {
  fullscreenSupported.value = typeof editorRegion.value?.requestFullscreen === "function";
  document.addEventListener("fullscreenchange", syncFullscreenState);
  syncFullscreenState();
});
watch(editorRegion, (element) => {
  fullscreenSupported.value = typeof element?.requestFullscreen === "function";
  if (element) syncFullscreenState();
});
onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", syncFullscreenState);
});

function layoutSignature(document: TopologyDocument) {
  const deviceSignature = document.devices
    .map((device) => `${device.device_id}:${device.device_type || ""}:${device.group_id || ""}`)
    .sort()
    .join("|");
  const domainSignature = document.domains
    .map((domain) => `${domain.domain_id}:${domain.domain_type}:${[...domain.member_devices].sort().join(",")}`)
    .sort()
    .join("|");
  const linkSignature = (document.links || [])
    .map((link) => `${link.src_device}:${link.dst_device}:${link.domain_id}`)
    .sort()
    .join("|");
  return `${deviceSignature}||${domainSignature}||${linkSignature}`;
}

function columnX(index: number, columns: number) {
  if (columns <= 1) return CANVAS_WIDTH / 2;
  const gap = Math.min(DEVICE_X_GAP, (CANVAS_WIDTH - 180) / (columns - 1));
  return (CANVAS_WIDTH - gap * (columns - 1)) / 2 + (index % columns) * gap;
}
function groupColumns(size: number) {
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(size))));
}
function resetPositions(items: TopologyDevice[]) {
  const next: Record<string, { x: number; y: number }> = {};
  const maxY = Math.max(36, canvasHeight.value - 36);
  items.forEach((device, index) => {
    const column = index % deviceColumns.value;
    const row = Math.floor(index / deviceColumns.value);
    const previous = positions.value[device.device_id];
    next[device.device_id] = previous
      ? { ...previous }
      : {
          x: columnX(column, deviceColumns.value),
          y: Math.min(maxY, DEVICE_Y_START + row * DEVICE_Y_GAP),
        };
  });
  positions.value = next;
}
function arrangeByDomain() {
  if (props.readOnly || !devices.value.length) return;
  const next: Record<string, { x: number; y: number }> = {};
  let groupStartY = DEVICE_Y_START;
  arrangementRows.value.forEach((row) => {
    const rowWidth = row.reduce((width, group) => width + group.width, 0) + (row.length - 1) * ARRANGEMENT_ROW_GAP;
    let groupStartX = (CANVAS_WIDTH - rowWidth) / 2;
    row.forEach((group) => {
      const groupCenterX = groupStartX + group.width / 2;
      group.devices.forEach((device, memberIndex) => {
        const column = memberIndex % group.columns;
        const deviceRow = Math.floor(memberIndex / group.columns);
        next[device.device_id] = {
          x: groupCenterX + (column - (group.columns - 1) / 2) * ARRANGEMENT_INNER_X_GAP,
          y: groupStartY + deviceRow * ARRANGEMENT_DEVICE_Y_GAP,
        };
      });
      groupStartX += group.width + ARRANGEMENT_ROW_GAP;
    });
    groupStartY += Math.max(...row.map((group) => group.height)) + ARRANGEMENT_GROUP_ROW_GAP;
  });
  positions.value = next;
  arrangementApplied.value = true;
  if (graph.value) arrangementSignature.value = layoutSignature(graph.value);
  pendingConnection.value = null;
}
watch(
  () => props.modelValue,
  (value) => {
    const next = parseTopologyDocument(value);
    parsed.value = next;
    envelope.value = next.envelope;
    pendingConnection.value = null;
    if (next.document) {
      const signature = layoutSignature(next.document);
      if (arrangementApplied.value && arrangementSignature.value !== signature) {
        arrangementApplied.value = false;
        arrangementSignature.value = "";
      }
      const physicalGroupCount = new Set(next.document.devices.map((device) => device.group_id).filter(Boolean)).size;
      const shouldArrange =
        !Object.keys(positions.value).length && next.document.devices.length > 0 && physicalGroupCount > 1;
      resetPositions(next.document.devices);
      if (shouldArrange) arrangeByDomain();
      if (selectedLink.value !== null && !next.document.links?.[selectedLink.value]) selectedLink.value = null;
      if (
        selectedDeviceId.value &&
        !next.document.devices.some((device) => device.device_id === selectedDeviceId.value)
      ) {
        selectedDeviceId.value = null;
      }
    } else {
      selectedLink.value = null;
      positions.value = {};
      arrangementApplied.value = false;
      arrangementSignature.value = "";
    }
  },
  { immediate: true },
);
function updateDocument(mutator: (document: TopologyDocument) => void) {
  if (!graph.value) return;
  const next = JSON.parse(JSON.stringify(graph.value)) as TopologyDocument;
  mutator(next);
  const text = topologyJson(
    envelope.value ? ({ ...envelope.value, topology: next } as unknown as TopologyDocument) : next,
  );
  parsed.value = parseTopologyDocument(text);
  emit("update:modelValue", text);
}
function updateFromWorkbench(value: string) {
  workbenchNotice.value = null;
  emit("update:modelValue", value);
}
function handleWorkbenchNotice(payload: { tone: "info" | "warning"; message: string }) {
  workbenchNotice.value = payload;
  emit("notice", payload);
}
function handleWorkbenchDeviceCount(payload: { ids: string[] }) {
  emit("device-count-change", payload);
}
function point(event: PointerEvent) {
  const current = event.currentTarget as SVGElement | null;
  const target = event.target as SVGElement | null;
  const svg = current instanceof SVGSVGElement ? current : current?.ownerSVGElement || target?.ownerSVGElement;
  if (!svg) return { x: 0, y: 0 };
  const ctm = svg.getScreenCTM?.();
  if (ctm && typeof DOMPoint !== "undefined") {
    try {
      const inverse = ctm.inverse();
      const transformed = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
      return { x: transformed.x, y: transformed.y };
    } catch {
      // Fall through to the bounding-box approximation for browsers that do
      // not expose an invertible CTM during layout/teardown.
    }
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: rect.width ? ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH : 0,
    y: rect.height ? ((event.clientY - rect.top) / rect.height) * viewBoxHeight.value : 0,
  };
}
function graphPoint(event: PointerEvent) {
  const p = point(event);
  const centerX = CANVAS_WIDTH / 2;
  const centerY = canvasHeight.value / 2;
  return {
    x: (p.x - pan.value.x - centerX) / zoom.value + centerX,
    y: (p.y - pan.value.y - sceneOffsetY.value - centerY) / zoom.value + centerY,
  };
}
function deviceAtPoint(event: PointerEvent, excludeId = "") {
  const p = graphPoint(event);
  return devices.value.find((device) => {
    if (device.device_id === excludeId) return false;
    const position = positions.value[device.device_id];
    return position && Math.abs(p.x - position.x) <= NODE_HALF_WIDTH && Math.abs(p.y - position.y) <= NODE_HALF_HEIGHT;
  });
}
function svgForEvent(event: PointerEvent) {
  const current = event.currentTarget as SVGElement | null;
  const target = event.target as SVGElement | null;
  if (current instanceof SVGSVGElement) return current;
  return current?.ownerSVGElement || target?.ownerSVGElement || null;
}
function captureDragPointer(event: PointerEvent) {
  const svg = svgForEvent(event);
  if (!svg || typeof svg.setPointerCapture !== "function") return;
  try {
    svg.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort in test DOMs and older embedded browsers.
  }
}
function releaseDragPointer(event: PointerEvent) {
  const svg = svgForEvent(event);
  if (!svg || typeof svg.hasPointerCapture !== "function" || !svg.hasPointerCapture(event.pointerId)) return;
  try {
    svg.releasePointerCapture(event.pointerId);
  } catch {
    // The browser may release capture automatically during pointer cancellation.
  }
}
function startNode(event: PointerEvent, device: TopologyDevice) {
  selectDevice(device);
  if (props.readOnly) return;
  if (drag.value) return;
  event.preventDefault();
  const p = graphPoint(event);
  const position = positions.value[device.device_id] || p;
  if (!pendingConnection.value) pendingConnection.value = device.device_id;
  drag.value = {
    id: device.device_id,
    pointerId: event.pointerId,
    offsetX: p.x - position.x,
    offsetY: p.y - position.y,
    originX: position.x,
    originY: position.y,
    startX: p.x,
    startY: p.y,
    moved: false,
  };
  captureDragPointer(event);
}
function moveNode(event: PointerEvent) {
  if (panDrag.value) {
    if (panDrag.value.pointerId !== event.pointerId) return;
    const p = point(event);
    pan.value = {
      x: panDrag.value.originX + p.x - panDrag.value.startX,
      y: panDrag.value.originY + p.y - panDrag.value.startY,
    };
    return;
  }
  if (!drag.value) return;
  if (drag.value.pointerId !== event.pointerId) return;
  const p = graphPoint(event);
  const target = deviceAtPoint(event, drag.value.id);
  if (target) {
    positions.value = {
      ...positions.value,
      [drag.value.id]: { x: drag.value.originX, y: drag.value.originY },
    };
    return;
  }
  if (!drag.value.moved && Math.hypot(p.x - drag.value.startX, p.y - drag.value.startY) < 5) return;
  drag.value.moved = true;
  positions.value = {
    ...positions.value,
    [drag.value.id]: {
      x: p.x - drag.value.offsetX,
      y: p.y - drag.value.offsetY,
    },
  };
}
function startPan(event: PointerEvent) {
  if (props.readOnly || drag.value || panDrag.value) return;
  if (event.button !== 0 && event.pointerType !== "touch") return;
  event.preventDefault();
  const p = point(event);
  panDrag.value = {
    pointerId: event.pointerId,
    startX: p.x,
    startY: p.y,
    originX: pan.value.x,
    originY: pan.value.y,
  };
  pendingConnection.value = null;
  captureDragPointer(event);
}
function endNode(event: PointerEvent, target: TopologyDevice) {
  if (props.readOnly) return;
  if (panDrag.value?.pointerId === event.pointerId) {
    releaseDragPointer(event);
    panDrag.value = null;
    return;
  }
  if (drag.value && drag.value.pointerId !== event.pointerId) return;
  const source = pendingConnection.value || drag.value?.id;
  if (source && source !== target.device_id) {
    if (drag.value?.moved) {
      positions.value = {
        ...positions.value,
        [drag.value.id]: { x: drag.value.originX, y: drag.value.originY },
      };
    }
    completeConnection(source, target.device_id);
  } else if (drag.value?.moved || source === target.device_id) pendingConnection.value = null;
  releaseDragPointer(event);
  drag.value = null;
}
function endCanvasPointer(event: PointerEvent) {
  if (panDrag.value) {
    if (panDrag.value.pointerId !== event.pointerId) return;
    releaseDragPointer(event);
    panDrag.value = null;
    return;
  }
  if (drag.value && drag.value.pointerId !== event.pointerId) return;
  const source = pendingConnection.value || drag.value?.id;
  const target = deviceAtPoint(event, drag.value?.id);
  if (source && target && source !== target.device_id) {
    if (drag.value?.moved) {
      positions.value = {
        ...positions.value,
        [drag.value.id]: { x: drag.value.originX, y: drag.value.originY },
      };
    }
    completeConnection(source, target.device_id);
  } else if (drag.value?.moved || !drag.value) pendingConnection.value = null;
  releaseDragPointer(event);
  drag.value = null;
}
function cancelDrag(event: PointerEvent) {
  if (panDrag.value && panDrag.value.pointerId === event.pointerId) {
    releaseDragPointer(event);
    panDrag.value = null;
    return;
  }
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  positions.value = {
    ...positions.value,
    [drag.value.id]: { x: drag.value.originX, y: drag.value.originY },
  };
  pendingConnection.value = null;
  releaseDragPointer(event);
  drag.value = null;
}
function completeConnection(source: string, target: string) {
  if (props.readOnly || source === target) return;
  pendingConnection.value = null;
  const decision = decideTopologyConnection(source, target, devices.value, domains.value);
  if (!decision.allowed) {
    const message = decision.reason;
    parsed.value = { document: graph.value, envelope: envelope.value, error: message };
    emit("notice", { tone: "warning", message });
    return;
  }
  const existingIndex = links.value.findIndex(
    (link) =>
      (link.src_device === source && link.dst_device === target) ||
      (link.src_device === target && link.dst_device === source),
  );
  if (existingIndex >= 0) {
    updateDocument((document) => {
      document.links = (document.links || []).filter((_, index) => index !== existingIndex);
    });
    selectedLink.value = null;
    return;
  }
  updateDocument((document) => {
    document.links = [
      ...(document.links || []),
      { src_device: source, dst_device: target, domain_id: decision.domain.domain_id },
    ];
  });
  selectedLink.value = links.value.length - 1;
}
function selectConnectionDevice(device: TopologyDevice) {
  if (props.readOnly) return;
  if (!pendingConnection.value) pendingConnection.value = device.device_id;
  else completeConnection(pendingConnection.value, device.device_id);
}
function selectLink(index: number) {
  selectedLink.value = index;
  selectedDeviceId.value = null;
}
function selectDevice(device: TopologyDevice) {
  selectedDeviceId.value = device.device_id;
  selectedLink.value = null;
}
function deleteSelected() {
  if (selectedLink.value === null) return;
  const index = selectedLink.value;
  updateDocument((document) => {
    document.links = (document.links || []).filter((_, linkIndex) => linkIndex !== index);
  });
  selectedLink.value = null;
}
function updateLinkField(field: "domain_id" | "bandwidth_gbps" | "latency_us", value: string) {
  if (selectedLink.value === null) return;
  updateDocument((document) => {
    const link = (document.links || [])[selectedLink.value as number];
    if (!link) return;
    if (field === "domain_id") link.domain_id = value;
    else if (value.trim() === "") delete link[field];
    else {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) link[field] = numeric;
    }
  });
}
function keydown(event: KeyboardEvent) {
  if (props.readOnly) return;
  const target = event.target as HTMLElement | null;
  const isEditable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  const isInteractiveControl = Boolean(
    target?.closest("button, a, [role='button'], [role='checkbox'], [role='switch']"),
  );
  if (event.key === "Escape" && !isEditable) pendingConnection.value = null;
  if (
    !isEditable &&
    !isInteractiveControl &&
    (event.key === "Delete" || event.key === "Backspace") &&
    selectedLink.value !== null
  ) {
    deleteSelected();
  }
}
function nodeKeydown(event: KeyboardEvent, device: TopologyDevice) {
  if (props.readOnly || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  selectConnectionDevice(device);
}
function linkKeydown(event: KeyboardEvent, index: number) {
  if (props.readOnly) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectedLink.value = index;
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    selectedLink.value = index;
    deleteSelected();
  }
}
function eventValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value || "";
}
function deviceLabel(device: TopologyDevice) {
  return device.device_type ? `${device.device_id} · ${topologyNodeLabel(device.device_type)}` : device.device_id;
}
function compactNodeText(value: string, limit: number) {
  return [...value].length > limit ? `${[...value].slice(0, Math.max(1, limit - 1)).join("")}…` : value;
}
function deviceCardId(device: TopologyDevice) {
  return compactNodeText(device.device_id, 18);
}
function deviceCardType(device: TopologyDevice) {
  return compactNodeText(topologyNodeLabel(device.device_type), 14);
}
function deviceIllustration(device: TopologyDevice) {
  const key = topologyNodeType(device.device_type).value.trim().toLowerCase();
  return topologyIllustrations[key] || unknownIllustration;
}
function deviceTitle(device: TopologyDevice) {
  const group = deviceGroupLabel(device);
  if (!group)
    return t("设备 {device}，类型 {type}", { device: deviceLabel(device), type: device.device_type || t("未指定") });
  return t("设备 {device}，类型 {type}，计算组 {group}", {
    device: deviceLabel(device),
    type: device.device_type || t("未指定"),
    group,
  });
}
function linkLabel(link: TopologyLink) {
  return t("连接 {src} 与 {dst}，domain {domain}，{kind}", {
    src: link.src_device,
    dst: link.dst_device,
    domain: link.domain_id,
    kind: link.link_id ? `${linkKindLabel(link)}，link_id ${link.link_id}` : linkKindLabel(link),
  });
}
function linkKind(link: TopologyLink): "inside" | "cross" {
  const source = devices.value.find((device) => device.device_id === link.src_device);
  const target = devices.value.find((device) => device.device_id === link.dst_device);
  if (source?.group_id && target?.group_id) return source.group_id === target.group_id ? "inside" : "cross";
  const domain = domains.value.find((candidate) => candidate.domain_id === link.domain_id);
  return domain?.domain_type === "scale_up" ? "inside" : "cross";
}
function linkKindLabel(link: TopologyLink) {
  return t(linkKind(link) === "inside" ? "组内通信（scale_up）" : "组间通信（scale_out）");
}
function linkKindText(link: TopologyLink) {
  const domain = domains.value.find((candidate) => candidate.domain_id === link.domain_id);
  const relation = linkKind(link);
  const expected = relation === "inside" ? "scale_up" : "scale_out";
  const domainType = domain?.domain_type;
  if (!domainType || domainType === expected) return linkKindLabel(link);
  return t("{relation} · {domain}（域类型 {domainType}）", {
    relation: linkKindLabel(link),
    domain: compactNodeText(link.domain_id, 14),
    domainType,
  });
}
function linkBadgeWidth(link: TopologyLink) {
  return Math.min(190, Math.max(92, [...linkKindText(link)].length * 7 + 18));
}
function deviceGroupLabel(device: TopologyDevice) {
  const superNode = superNodeForDevice(device.device_id, superNodes.value);
  return superNode ? superNode.label : t("未分配");
}
function linkMidpoint(link: TopologyLink) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return { x: 0, y: 0 };
  if (linkKind(link) === "cross") {
    const controlY = Math.max(20, (source.y + target.y) / 2 - 60);
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + 2 * controlY + target.y) / 4,
    };
  }
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}
function crossLabelLane(link: TopologyLink, index: number) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return { x: 0, y: 0 };
  // Cross-domain edges are visually noisy at the geometric midpoint (the
  // exact place where several diagonals meet). Alternate two side rails and
  // use a small vertical rhythm so every badge remains legible without
  // relying on collision-dependent cascading.
  const side = index % 2 === 0 ? 1 : -1;
  const vertical = ((index % 3) - 1) * 28;
  const horizontal = Math.abs(target.y - source.y) < 30 ? 0 : side * 96;
  return {
    x: horizontal,
    y: Math.abs(target.y - source.y) < 30 ? -48 + vertical : vertical,
  };
}
function linkParallelOffsetVector(link: TopologyLink, index: number) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return { x: 0, y: 0 };
  const peers = links.value
    .map((candidate, peerIndex) => ({ candidate, peerIndex }))
    .filter(
      ({ candidate }) =>
        (candidate.src_device === link.src_device && candidate.dst_device === link.dst_device) ||
        (candidate.src_device === link.dst_device && candidate.dst_device === link.src_device),
    );
  if (peers.length < 2) return { x: 0, y: 0 };
  const slot = peers.findIndex(({ peerIndex }) => peerIndex === index);
  const offset = (slot - (peers.length - 1) / 2) * 10;
  const length = Math.hypot(target.x - source.x, target.y - source.y) || 1;
  return {
    x: -((target.y - source.y) / length) * offset,
    y: ((target.x - source.x) / length) * offset,
  };
}
function linkBadgeBasePosition(link: TopologyLink, index = -1) {
  const midpoint = linkMidpoint(link);
  const offset = index >= 0 ? linkParallelOffsetVector(link, index) : { x: 0, y: 0 };
  if (linkKind(link) === "cross") {
    const lane = crossLabelLane(link, index);
    return { x: midpoint.x + lane.x + offset.x, y: midpoint.y + lane.y + offset.y };
  }
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return midpoint;
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  return horizontal
    ? { x: midpoint.x + offset.x, y: midpoint.y - 42 + offset.y }
    : { x: midpoint.x + 82 + offset.x, y: midpoint.y + offset.y };
}
const linkBadgePositions = computed(() => {
  const basePositions = links.value.map((link, index) => linkBadgeBasePosition(link, index));
  const result = basePositions.map((position) => ({ ...position }));
  const placed: { index: number; x: number; y: number; width: number; height: number }[] = [];
  const nodeBoxes = devices.value.map((device) => {
    const position = positions.value[device.device_id];
    return position ? { x: position.x, y: position.y, width: NODE_HALF_WIDTH * 2, height: NODE_HALF_HEIGHT * 2 } : null;
  });
  const intersectsNode = (x: number, y: number, width: number, height: number) =>
    nodeBoxes.some(
      (node) =>
        node &&
        Math.abs(x - node.x) < (width + node.width) / 2 + 16 &&
        Math.abs(y - node.y) < (height + node.height) / 2 + 16,
    );
  [...basePositions.keys()]
    .sort((left, right) => basePositions[left].y - basePositions[right].y || left - right)
    .forEach((index) => {
      const base = basePositions[index];
      const width = linkBadgeWidth(links.value[index]);
      const candidates = [
        { x: base.x, y: base.y },
        { x: base.x, y: base.y - 30 },
        { x: base.x, y: base.y + 30 },
        { x: base.x, y: base.y + 60 },
        { x: base.x, y: base.y + 86 },
        { x: base.x, y: base.y + 112 },
        { x: base.x - Math.min(120, width / 2 + 30), y: base.y },
        { x: base.x + Math.min(120, width / 2 + 30), y: base.y },
        ...Array.from({ length: 8 }, (_, attempt) => ({ x: base.x, y: base.y - 60 - attempt * 26 })),
      ];
      const chosen = candidates.find(
        (candidate) =>
          candidate.x - width / 2 >= 12 &&
          candidate.x + width / 2 <= CANVAS_WIDTH - 12 &&
          !intersectsNode(candidate.x, candidate.y, width, 18) &&
          !placed.some(
            (other) =>
              Math.abs(candidate.x - other.x) < (width + other.width) / 2 + 12 &&
              Math.abs(candidate.y - other.y) < (18 + other.height) / 2 + 8,
          ),
      ) || { x: base.x, y: base.y };
      result[index] = chosen;
      placed.push({ index, ...chosen, width, height: 18 });
    });
  return result;
});
function linkBadgePosition(link: TopologyLink, index: number) {
  return linkBadgePositions.value[index] || linkBadgeBasePosition(link, index);
}
function linkPath(link: TopologyLink) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return "";
  const controlY = Math.max(20, (source.y + target.y) / 2 - 60);
  return `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2} ${controlY} ${target.x} ${target.y}`;
}
function crossBundleBounds(bundle: CrossLinkBundle) {
  const source = superNodeBounds.value.find((bounds) => bounds.node.id === bundle.sourceNodeId);
  const target = superNodeBounds.value.find((bounds) => bounds.node.id === bundle.targetNodeId);
  return source && target ? { source, target } : null;
}
function crossBundleLane(bundle: CrossLinkBundle) {
  const siblings = crossLinkBundles.value.filter(
    (candidate) => candidate.sourceNodeId === bundle.sourceNodeId && candidate.targetNodeId === bundle.targetNodeId,
  );
  const index = siblings.findIndex((candidate) => candidate.key === bundle.key);
  return { index: Math.max(0, index), count: Math.max(1, siblings.length) };
}
function crossBundlePath(bundle: CrossLinkBundle) {
  const bounds = crossBundleBounds(bundle);
  if (!bounds) return "";
  const { source, target } = bounds;
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const lane = crossBundleLane(bundle);
  const laneOffset = (lane.index - (lane.count - 1) / 2) * 24;
  if (Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)) {
    const forward = targetCenter.x >= sourceCenter.x;
    const start = { x: forward ? source.x + source.width : source.x, y: sourceCenter.y + laneOffset };
    const end = { x: forward ? target.x : target.x + target.width, y: targetCenter.y + laneOffset };
    const curve = Math.max(28, Math.abs(end.x - start.x) * 0.3);
    return `M ${start.x} ${start.y} C ${start.x + (forward ? curve : -curve)} ${start.y}, ${end.x - (forward ? curve : -curve)} ${end.y}, ${end.x} ${end.y}`;
  }
  const forward = targetCenter.y >= sourceCenter.y;
  const start = { x: sourceCenter.x + laneOffset, y: forward ? source.y + source.height : source.y };
  const end = { x: targetCenter.x + laneOffset, y: forward ? target.y : target.y + target.height };
  const curve = Math.max(28, Math.abs(end.y - start.y) * 0.3);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + (forward ? curve : -curve)}, ${end.x} ${end.y - (forward ? curve : -curve)}, ${end.x} ${end.y}`;
}
function crossBundlePosition(bundle: CrossLinkBundle) {
  const bounds = crossBundleBounds(bundle);
  if (!bounds) return { x: 0, y: 0 };
  const source = bounds.source;
  const target = bounds.target;
  const lane = crossBundleLane(bundle);
  const laneOffset = (lane.index - (lane.count - 1) / 2) * 24;
  return {
    x:
      (source.x + source.width / 2 + target.x + target.width / 2) / 2 +
      (Math.abs(target.x + target.width / 2 - (source.x + source.width / 2)) <
      Math.abs(target.y + target.height / 2 - (source.y + source.height / 2))
        ? laneOffset
        : 0),
    y:
      (source.y + source.height / 2 + target.y + target.height / 2) / 2 -
      18 +
      (Math.abs(target.x + target.width / 2 - (source.x + source.width / 2)) >=
      Math.abs(target.y + target.height / 2 - (source.y + source.height / 2))
        ? laneOffset
        : 0),
  };
}
function crossBundleLabel(bundle: CrossLinkBundle) {
  return t("组间通道 · {count} 条", { count: bundle.linkIndexes.length });
}
function crossBundleLabelWidth(bundle: CrossLinkBundle) {
  return Math.min(230, Math.max(150, [...crossBundleLabel(bundle)].length * 7 + 18));
}
function crossLinkIsBundled(index: number) {
  return crossLinkBundles.value.some((bundle) => bundle.linkIndexes.includes(index));
}
function linkParallelOffset(link: TopologyLink, index: number) {
  const offset = linkParallelOffsetVector(link, index);
  if (!offset.x && !offset.y) return "";
  return `translate(${offset.x.toFixed(2)} ${offset.y.toFixed(2)})`;
}

const moduleBindings = computed<Record<string, unknown>[]>(
  () => (graph.value?.module_bindings || []) as Record<string, unknown>[],
);
const bindingIndexes = computed(() => moduleBindings.value.map((_, index) => index));
const moduleMessage = ref<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
const MODULE_TEXT_KEYS = ["module_version", "config_profile"] as const;
const moduleKindValues = computed<readonly string[]>(
  () => moduleBindingFields.find((field) => field.key === "module_kind")?.enumValues || [],
);
const moduleVersionSuggestions = computed(() => {
  const values = new Set<string>();
  for (const binding of moduleBindings.value) {
    const value = binding.module_version;
    if (typeof value === "string" && value.trim()) values.add(value.trim());
  }
  return [...values];
});
const moduleProfileSuggestions = computed(() => {
  const values = new Set<string>();
  for (const binding of moduleBindings.value) {
    const value = binding.config_profile;
    if (typeof value === "string" && value.trim()) values.add(value.trim());
  }
  return [...values];
});
const OVERRIDE_LABEL_SOURCE: Record<string, string> = {
  bandwidth_gbps: "带宽（Gbps）",
  latency_us: "延迟（us）",
  queue_factor: "队列系数",
  oversubscription_factor: "超额订阅系数",
};
const MODULE_LABEL_SOURCE: Record<string, string> = {
  module_name: "模型名",
  module_kind: "类型",
  module_version: "版本",
  config_profile: "配置档",
};
const MODULE_KIND_LABEL_SOURCE: Record<string, string> = {
  scale_up: "机内高速互联（scale_up）",
  scale_out: "跨机网络（scale_out）",
};
function overrideLabel(field: SchemaFieldMeta) {
  return t(OVERRIDE_LABEL_SOURCE[field.key] || field.key);
}
function bindingName(index: number) {
  const value = moduleBindings.value[index]?.module_name;
  return typeof value === "string" && value ? value : `#${index + 1}`;
}
function bindingText(index: number, key: string) {
  const value = moduleBindings.value[index]?.[key];
  return typeof value === "string" ? value : "";
}
function overrideValue(index: number, key: string) {
  const params = moduleBindings.value[index]?.override_params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return "";
  const value = (params as Record<string, unknown>)[key];
  return value === undefined || value === null ? "" : String(value);
}
function overrideHint(field: SchemaFieldMeta) {
  const below = field.exclusiveMinimum !== null ? `> ${field.exclusiveMinimum}` : `${field.minimum ?? "-∞"}`;
  return `${below} ~ ${field.maximum ?? "+∞"}`;
}
const MODULE_OVERRIDE_PRESETS: Readonly<Record<string, readonly number[]>> = {
  bandwidth_gbps: [25, 100, 400, 800, 1600],
  latency_us: [0.5, 1, 5, 10, 25],
  queue_factor: [0, 0.5, 1, 2],
  oversubscription_factor: [1, 1.25, 2, 4],
};
function overridePresetValues(field: SchemaFieldMeta): number[] {
  return (MODULE_OVERRIDE_PRESETS[field.key] || []).filter(
    (value) =>
      (field.minimum === null || value >= field.minimum) &&
      (field.maximum === null || value <= field.maximum) &&
      (field.exclusiveMinimum === null || value > field.exclusiveMinimum),
  );
}
function overrideListId(field: SchemaFieldMeta): string | undefined {
  return overridePresetValues(field).length ? `module-override-${field.key}-presets` : undefined;
}
function moduleLabel(key: string) {
  return t(MODULE_LABEL_SOURCE[key] || key);
}
function moduleKindLabel(value: string) {
  return t(MODULE_KIND_LABEL_SOURCE[value] || value);
}
function bindingPath(index: number, key: string) {
  return `/custom_inputs/topology/topology/module_bindings/${index}/${key}`;
}
function updateModuleOverride(index: number, field: SchemaFieldMeta, event: Event) {
  const raw = eventValue(event);
  updateDocument((document) => {
    const binding = (document.module_bindings || [])[index];
    if (!binding) return;
    const params =
      binding.override_params && typeof binding.override_params === "object" && !Array.isArray(binding.override_params)
        ? (binding.override_params as Record<string, unknown>)
        : {};
    if (!raw.trim()) delete params[field.key];
    else {
      const numeric = Number(raw);
      const below =
        field.exclusiveMinimum !== null ? numeric <= field.exclusiveMinimum : numeric < (field.minimum ?? -Infinity);
      if (!Number.isFinite(numeric) || below || (field.maximum !== null && numeric > field.maximum)) return;
      params[field.key] = numeric;
    }
    binding.override_params = params;
  });
}
function updateModuleList(
  mutate: (document: JsonObject) => { tone: "info" | "warning" | "error"; text: string } | null,
) {
  let message: { tone: "info" | "warning" | "error"; text: string } | null = null;
  try {
    const next = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      message = mutate(draft);
    });
    emit("update:modelValue", next);
    moduleMessage.value = message;
  } catch (error) {
    moduleMessage.value = {
      tone: "error",
      text: error instanceof StructuredInputError ? error.message : String(error),
    };
  }
}
function addOneModule() {
  updateModuleList((document) => {
    const name = nextModuleBindingName(moduleBindingNamesOf(document).map((entry) => entry.name));
    addModuleBinding(document, { module_name: name, module_kind: "scale_up" });
    return {
      tone: "warning",
      text: t("已新增模型 {name}（机内高速互联）。名字只是占位符，请改成你实际要用的模块名。", { name }),
    };
  });
}
function updateModuleName(index: number, event: Event) {
  const current = bindingText(index, "module_name");
  const next = eventValue(event).trim();
  if (!current || next === current) return;
  updateModuleList((document) => {
    renameModuleBinding(document, current, next);
    return { tone: "info", text: t("已把模型 {from} 改名为 {to}。", { from: current, to: next }) };
  });
}
function updateModuleKind(index: number, event: Event) {
  const name = bindingText(index, "module_name");
  const next = eventValue(event) as DomainType;
  if (!name || next === bindingText(index, "module_kind")) return;
  updateModuleList((document) => {
    const mismatched = (topologyDomainsOf(document) || [])
      .filter(
        (entry): entry is JsonObject =>
          isJsonObject(entry) && entry.module_binding === name && entry.domain_type !== next,
      )
      .map((entry) => String(entry.domain_id || ""))
      .filter(Boolean);
    if (mismatched.length) {
      throw new StructuredInputError(
        t("模型 {name} 仍被这些通信域使用：{domains}，不能改成 {kind}；请先在通信域中改绑匹配模型。", {
          name,
          domains: mismatched.join("、"),
          kind: moduleKindLabel(next),
        }),
      );
    }
    setModuleBindingKind(document, name, next);
    return { tone: "info", text: t("模型 {name} 的类型已改为 {kind}。", { name, kind: moduleKindLabel(next) }) };
  });
}
function updateModuleText(index: number, key: (typeof MODULE_TEXT_KEYS)[number], event: Event) {
  const name = bindingText(index, "module_name");
  if (!name) return;
  const raw = eventValue(event);
  if (raw.trim() === bindingText(index, key)) return;
  updateModuleList((document) => {
    setModuleBindingText(document, name, key, raw);
    return null;
  });
}
function dropModule(index: number) {
  const name = bindingText(index, "module_name");
  if (!name) return;
  updateModuleList((document) => {
    removeModuleBinding(document, name);
    return { tone: "info", text: t("已删除模型 {name}。", { name }) };
  });
}
</script>

<template>
  <section
    class="topology-editor"
    :class="{ 'topology-editor--readonly': readOnly, 'topology-editor--settings-only': !showGraph }"
    :aria-label="t('网络拓扑可视化编辑器')"
    tabindex="-1"
    @keydown="keydown"
  >
    <div v-if="showGraph" class="topology-editor__toolbar">
      <strong class="visually-hidden">{{ t("拓扑连接") }}</strong>
      <div v-if="!readOnly" class="topology-editor__toolbar-actions">
        <button
          v-if="hasGraph"
          type="button"
          class="button button--secondary button--small topology-arrange-button"
          @click="arrangeByDomain"
        >
          <LayoutGrid :size="14" />{{ t("自动排布") }}
        </button>
        <button
          v-if="hasGraph"
          type="button"
          class="button button--danger button--small topology-clear-button"
          :aria-label="t('清除画布')"
          :title="t('清除画布')"
          data-clear-canvas
          @click="requestClearCanvas"
        >
          <Trash2 :size="14" />{{ t("清除画布") }}
        </button>
      </div>
    </div>
    <div v-if="showGraph && hasGraph" class="topology-summary" :aria-label="t('拓扑摘要')">
      <div class="topology-summary__metric">
        <strong>{{ devices.length }}</strong
        ><span>{{ t("节点") }}</span>
      </div>
      <div class="topology-summary__metric">
        <strong>{{ links.length }}</strong
        ><span>{{ t("已连接") }}</span>
      </div>
      <div class="topology-summary__metric">
        <strong>{{ domains.length }}</strong
        ><span>{{ t("通信域") }}</span>
      </div>
      <div class="topology-summary__metric">
        <strong>{{ superNodes.length }}</strong
        ><span>{{ t("计算组") }}</span>
      </div>
    </div>
    <p v-if="showGraph && hasGraph" class="topology-graph-note topology-graph-note--workflow">
      {{
        t("先在设备清单中给每张卡指定一个计算组，再在「互联参数」中配置通信域；这里仅查看和编辑设备之间的后端 links。")
      }}
    </p>
    <p v-if="showGraph && parsed.error" class="topology-editor__error" role="alert">{{ parsed.error }}</p>
    <div v-if="showGraphWorkspace" class="topology-workspace">
      <DeviceInventoryForm
        v-if="!isFullscreen && !readOnly"
        class="topology-resource-list"
        :model-value="workbenchModelValue"
        :field-path="fieldPath"
        :topology-node-types="props.topologyNodeTypes"
        @update:model-value="updateFromWorkbench"
        @device-count-change="handleWorkbenchDeviceCount"
        @notice="handleWorkbenchNotice"
      />
      <div
        ref="editorRegion"
        class="topology-direct-canvas"
        :data-arrangement-applied="arrangementApplied ? 'true' : undefined"
      >
        <div class="topology-direct-canvas__controls">
          <div v-if="isFullscreen" class="topology-workbench__title">
            <strong>{{ t("拓扑编辑工作台") }}</strong>
            <span>{{ t("添加节点、分配域并编辑连接") }}</span>
          </div>
          <button
            v-if="isFullscreen && !readOnly"
            type="button"
            class="button button--secondary button--small topology-arrange-button topology-fullscreen-arrange"
            :aria-label="t('自动排布')"
            :title="t('自动排布')"
            data-fullscreen-arrange
            @click="arrangeByDomain"
          >
            <LayoutGrid :size="14" />{{ t("自动排布") }}
          </button>
          <button
            v-if="isFullscreen && !readOnly"
            type="button"
            class="button button--danger button--small topology-clear-button"
            :aria-label="t('清除画布')"
            :title="t('清除画布')"
            data-fullscreen-clear-canvas
            @click="requestClearCanvas"
          >
            <Trash2 :size="14" />{{ t("清除画布") }}
          </button>
          <div class="topology-zoom-controls" role="group" :aria-label="t('画布缩放')">
            <button
              type="button"
              class="icon-button"
              :aria-label="t('缩小')"
              :title="t('缩小')"
              :disabled="zoom <= ZOOM_MIN"
              data-zoom-out
              @click="zoomOut"
            >
              <ZoomOut :size="15" />
            </button>
            <select
              class="topology-zoom-controls__select"
              :value="String(zoom)"
              :aria-label="t('选择缩放比例')"
              :title="t('选择缩放比例')"
              data-zoom-select
              @change="selectZoom"
            >
              <option v-for="value in zoomOptions" :key="value" :value="String(value)">
                {{ zoomOptionLabel(value) }}
              </option>
            </select>
            <button
              type="button"
              class="icon-button"
              :aria-label="t('重置视图')"
              :title="t('重置视图')"
              data-view-reset
              @click="resetView"
            >
              <LocateFixed :size="15" />
            </button>
            <button
              type="button"
              class="icon-button"
              :aria-label="t('放大')"
              :title="t('放大')"
              :disabled="zoom >= ZOOM_MAX"
              data-zoom-in
              @click="zoomIn"
            >
              <ZoomIn :size="15" />
            </button>
          </div>
          <button
            v-if="fullscreenSupported"
            type="button"
            class="button button--secondary button--small topology-fullscreen-button"
            :aria-label="isFullscreen ? t('退出全屏') : t('全屏编辑')"
            :title="isFullscreen ? t('退出全屏') : t('全屏编辑')"
            data-fullscreen-toggle
            @click="toggleFullscreen"
          >
            <Minimize2 v-if="isFullscreen" :size="14" />
            <Maximize2 v-else :size="14" />
            {{ isFullscreen ? t("退出全屏") : t("全屏编辑") }}
          </button>
          <div
            v-if="clearPending"
            class="topology-canvas-confirmation"
            role="alertdialog"
            :aria-label="t('确认清除画布')"
          >
            <div>
              <strong>{{ t("确认清除画布？") }}</strong>
              <span>{{ t("会删除当前拓扑中的所有节点、仿真域和连接；网络模型参数保留。") }}</span>
            </div>
            <div class="topology-canvas-confirmation__actions">
              <button type="button" class="button button--danger button--small" data-clear-confirm @click="clearCanvas">
                {{ t("确认清除") }}
              </button>
              <button
                type="button"
                class="button button--secondary button--small"
                data-clear-cancel
                @click="cancelClearCanvas"
              >
                {{ t("取消") }}
              </button>
            </div>
          </div>
        </div>
        <aside v-if="isFullscreen" class="topology-workbench__sidebar" :aria-label="t('拓扑节点')">
          <header class="topology-workbench__panel-header">
            <div>
              <strong>{{ t("拓扑节点") }}</strong>
            </div>
          </header>
          <DeviceInventoryForm
            :model-value="modelValue"
            :field-path="fieldPath"
            :topology-node-types="props.topologyNodeTypes"
            @update:model-value="updateFromWorkbench"
            @device-count-change="handleWorkbenchDeviceCount"
            @notice="handleWorkbenchNotice"
          />
          <p
            v-if="workbenchNotice"
            class="topology-workbench__notice"
            :class="{ 'topology-workbench__notice--warning': workbenchNotice.tone === 'warning' }"
            role="status"
          >
            {{ workbenchNotice.message }}
          </p>
        </aside>
        <aside v-if="isFullscreen && selected && !readOnly" class="topology-workbench__properties">
          <TopologyLinkProperties
            :link="selected"
            :domains="domains"
            @delete="deleteSelected"
            @update-field="updateLinkField($event.field, $event.value)"
          />
        </aside>
        <div v-if="pendingConnection" class="topology-direct-canvas__instruction">
          <MousePointer2 :size="15" />
          <span>{{ t("已选择 {device}，拖到另一个节点。", { device: pendingConnection }) }}</span>
        </div>
        <div class="topology-canvas-scroll">
          <svg
            class="topology-canvas topology-canvas--direct"
            :class="{ 'topology-canvas--panning': panDrag }"
            :viewBox="`0 0 ${CANVAS_WIDTH} ${viewBoxHeight}`"
            :height="viewBoxHeight"
            :style="canvasStyle"
            role="group"
            :aria-label="t('设备连接图')"
            @pointerdown="startPan"
            @pointermove="moveNode"
            @pointerup="endCanvasPointer"
            @pointercancel="cancelDrag"
          >
            <rect class="topology-canvas__background" x="0" y="0" width="100%" height="100%" aria-hidden="true" />
            <g class="topology-scene" :transform="sceneTransform">
              <g class="topology-supernodes" :aria-label="t('计算组')">
                <g v-for="bounds in superNodeBounds" :key="`super-node-${bounds.node.id}`" class="topology-supernode">
                  <rect
                    class="topology-supernode__container"
                    :x="bounds.x"
                    :y="bounds.y"
                    :width="bounds.width"
                    :height="bounds.height"
                    rx="18"
                  />
                  <text class="topology-supernode__label" :x="bounds.x + 16" :y="bounds.y + 24">
                    {{ t("计算组 {id}", { id: groupDisplayLabel(bounds.node) }) }}
                  </text>
                  <text class="topology-supernode__kind" :x="bounds.x + 16" :y="bounds.y + 42">
                    {{ t("{count} 个设备 · 设备归属", { count: bounds.node.devices.length }) }}
                  </text>
                </g>
              </g>
              <g
                v-for="bundle in crossLinkBundles"
                :key="`cross-bundle-${bundle.key}`"
                class="topology-group-link"
                :class="{ selected: selectedLink !== null && bundle.linkIndexes.includes(selectedLink) }"
                :tabindex="readOnly ? -1 : 0"
                :role="readOnly ? 'img' : 'button'"
                :aria-label="crossBundleLabel(bundle)"
                @click.stop="selectLink(bundle.linkIndexes[0])"
                @keydown.enter.prevent="selectLink(bundle.linkIndexes[0])"
                @keydown.space.prevent="selectLink(bundle.linkIndexes[0])"
              >
                <title>{{ crossBundleLabel(bundle) }}</title>
                <path class="topology-group-link__hit" :d="crossBundlePath(bundle)" />
                <path class="topology-group-link__path" :d="crossBundlePath(bundle)" />
                <g
                  class="topology-group-link__badge"
                  :transform="`translate(${crossBundlePosition(bundle).x}, ${crossBundlePosition(bundle).y})`"
                >
                  <rect
                    :x="-crossBundleLabelWidth(bundle) / 2"
                    y="-10"
                    :width="crossBundleLabelWidth(bundle)"
                    height="18"
                    rx="4"
                  />
                  <text class="topology-group-link__kind" text-anchor="middle" y="3">
                    {{ crossBundleLabel(bundle) }}
                  </text>
                </g>
              </g>
              <g class="topology-links">
                <g
                  v-for="(link, index) in links"
                  :key="`${link.src_device}-${link.dst_device}-${index}`"
                  class="topology-link"
                  :class="[`topology-link--${linkKind(link)}`, { selected: selectedLink === index }]"
                  :transform="linkParallelOffset(link, index)"
                  :tabindex="readOnly ? -1 : 0"
                  :role="readOnly ? 'img' : 'button'"
                  :aria-label="linkLabel(link)"
                  @pointerdown.stop
                  @click.stop="selectLink(index)"
                  @keydown="linkKeydown($event, index)"
                >
                  <line
                    v-if="linkKind(link) === 'inside'"
                    class="topology-link__hit"
                    :x1="positions[link.src_device]?.x"
                    :y1="positions[link.src_device]?.y"
                    :x2="positions[link.dst_device]?.x"
                    :y2="positions[link.dst_device]?.y"
                  />
                  <path v-else-if="!crossLinkIsBundled(index)" class="topology-link__hit" :d="linkPath(link)" />
                  <line
                    v-if="linkKind(link) === 'inside'"
                    :x1="positions[link.src_device]?.x"
                    :y1="positions[link.src_device]?.y"
                    :x2="positions[link.dst_device]?.x"
                    :y2="positions[link.dst_device]?.y"
                  />
                  <path v-else-if="!crossLinkIsBundled(index)" :d="linkPath(link)" />
                  <g
                    v-if="linkKind(link) === 'inside' || !crossLinkIsBundled(index)"
                    class="topology-link__badge"
                    :transform="`translate(${linkBadgePosition(link, index).x}, ${linkBadgePosition(link, index).y - 13})`"
                  >
                    <title>{{ linkLabel(link) }}</title>
                    <rect :x="-linkBadgeWidth(link) / 2" y="-10" :width="linkBadgeWidth(link)" height="18" rx="4" />
                    <text class="topology-link__kind" text-anchor="middle" y="3">
                      {{ linkKindText(link) }}
                    </text>
                  </g>
                </g>
              </g>
              <g
                v-for="device in devices"
                :key="device.device_id"
                class="topology-device"
                :class="[
                  `topology-device--${topologyNodeCategory(device.device_type)}`,
                  { pending: pendingConnection === device.device_id },
                ]"
                :transform="`translate(${positions[device.device_id]?.x || 0},${positions[device.device_id]?.y || 0})`"
                :tabindex="readOnly ? -1 : 0"
                :role="readOnly ? 'img' : 'button'"
                :aria-label="deviceTitle(device)"
                @keydown="nodeKeydown($event, device)"
                @pointerdown.stop="startNode($event, device)"
                @pointerup.stop="endNode($event, device)"
                @click.stop="selectDevice(device)"
              >
                <title>{{ deviceTitle(device) }}</title>
                <image
                  class="topology-device__illustration"
                  :href="deviceIllustration(device)"
                  x="-42"
                  y="-34"
                  width="84"
                  height="54"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  draggable="false"
                />
                <rect class="topology-device__hit-area" x="-58" y="-36" width="116" height="72" rx="8" />
                <text class="topology-device__id" text-anchor="middle" y="12">{{ deviceCardId(device) }}</text>
                <text v-if="device.device_type" class="topology-device__type" text-anchor="middle" y="27">
                  {{ deviceCardType(device) }}
                </text>
              </g>
            </g>
          </svg>
        </div>
        <div class="topology-direct-canvas__legend">
          <span><i class="topology-legend-line topology-legend-line--inside" />{{ t("实线：同一计算组的端点") }}</span>
          <span><i class="topology-legend-line topology-legend-line--cross" />{{ t("虚线：不同计算组的端点") }}</span>
          <span v-if="superNodes.length"
            ><i class="topology-legend-box" />{{ t("边框：计算组（来自 devices[].group_id）") }}</span
          >
          <span v-if="!links.length" class="topology-direct-canvas__empty">{{ t("当前还没有节点连接") }}</span>
        </div>
        <p v-if="links.length || superNodes.length" class="topology-graph-note topology-graph-note--semantics">
          {{
            t(
              "设备卡只属于一个计算组；通信域是后端的网络资源。scale_up 表示组内连接，scale_out 表示组间连接，后者的端点集合可以与前者重叠，但不会让设备再次归属另一个计算组。",
            )
          }}
        </p>
        <div v-if="crossLinkBundles.length" class="topology-cross-links">
          <span class="topology-cross-links__note">{{
            t("组间连接在图中汇总为通信通道；点击下方端点对可编辑单条后端 link。")
          }}</span>
          <div
            v-for="bundle in crossLinkBundles"
            :key="`cross-list-${bundle.key}`"
            class="topology-cross-links__bundle"
          >
            <strong>{{ crossBundleLabel(bundle) }}</strong>
            <div class="topology-cross-links__items">
              <button
                v-for="linkIndex in bundle.linkIndexes"
                :key="`cross-detail-${linkIndex}`"
                type="button"
                class="topology-cross-links__item"
                @click="selectLink(linkIndex)"
              >
                {{ links[linkIndex].src_device }} → {{ links[linkIndex].dst_device }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showGraph && !hasGraph && readOnly" class="topology-editor__empty">
        <MousePointer2 :size="18" /><span>{{ t("输入合法拓扑 JSON 后，这里会显示节点与连接。") }}</span>
      </div>
      <aside v-if="selectedDevice && !isFullscreen" class="topology-device-inspector" :aria-label="t('选中对象详情')">
        <header>
          <strong>{{ t("选中对象") }}</strong>
          <span>{{ t("设备") }}</span>
        </header>
        <dl>
          <div>
            <dt>{{ t("设备编号") }}</dt>
            <dd>
              <code>{{ selectedDevice.device_id }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("设备类型") }}</dt>
            <dd>{{ topologyNodeLabel(selectedDevice.device_type) }}</dd>
          </div>
          <div>
            <dt>{{ t("计算组") }}</dt>
            <dd>{{ selectedDevice.group_id || t("未分配") }}</dd>
          </div>
        </dl>
        <p class="topology-inspector-note">{{ t("设备只属于一个计算组；通信域端点在互联参数中单独管理。") }}</p>
      </aside>
      <TopologyLinkProperties
        v-if="selected && !readOnly && !isFullscreen"
        :link="selected"
        :domains="domains"
        @delete="deleteSelected"
        @update-field="updateLinkField($event.field, $event.value)"
      />
      <aside
        v-if="selected && readOnly && !isFullscreen"
        class="topology-device-inspector topology-link-inspector-readonly"
        :aria-label="t('选中连接详情')"
      >
        <header>
          <strong>{{ t("选中对象") }}</strong>
          <span>{{ t("连接") }}</span>
        </header>
        <dl>
          <div>
            <dt>{{ t("端点") }}</dt>
            <dd>
              <code>{{ selected.src_device }} ↔ {{ selected.dst_device }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t("通信关系") }}</dt>
            <dd>{{ linkKindLabel(selected) }}</dd>
          </div>
          <div>
            <dt>{{ t("通信域") }}</dt>
            <dd>
              <code>{{ selected.domain_id }}</code>
            </dd>
          </div>
        </dl>
      </aside>
    </div>
    <section v-if="graph && !readOnly && showModuleSettings" class="topology-model-settings">
      <div class="topology-model-settings__body">
        <header class="topology-section-header">
          <div>
            <strong>{{ t("模块绑定参数") }}</strong>
          </div>
          <button type="button" class="button button--secondary" @click="addOneModule">
            <Plus :size="15" />{{ t("新增模型") }}
          </button>
        </header>
        <p v-if="!moduleBindings.length" class="structured-note">
          {{ t("还没有网络模型。点「新增模型」加一条，再绑定给需要的域。") }}
        </p>
        <div v-for="index in bindingIndexes" :key="`binding-${index}`" class="topology-module-binding">
          <div class="topology-module-binding__meta">
            <label :data-input-path="bindingPath(index, 'module_name')" title="module_name"
              ><span>{{ moduleLabel("module_name") }}</span
              ><input
                type="text"
                spellcheck="false"
                :value="bindingText(index, 'module_name')"
                :aria-label="`${moduleLabel('module_name')} ${index + 1}`"
                @change="updateModuleName(index, $event)"
            /></label>
            <label :data-input-path="bindingPath(index, 'module_kind')" title="module_kind"
              ><span>{{ moduleLabel("module_kind") }}</span
              ><select
                :value="bindingText(index, 'module_kind')"
                :aria-label="`${moduleLabel('module_kind')} ${index + 1}`"
                @change="updateModuleKind(index, $event)"
              >
                <option v-for="value in moduleKindValues" :key="`kind-${value}`" :value="value">
                  {{ moduleKindLabel(value) }}
                </option>
              </select></label
            >
            <label v-for="key in MODULE_TEXT_KEYS" :key="`${index}-${key}`" :title="key"
              ><span>{{ moduleLabel(key) }}</span
              ><input
                type="text"
                spellcheck="false"
                :value="bindingText(index, key)"
                :list="
                  key === 'module_version'
                    ? 'topology-module-version-suggestions'
                    : 'topology-module-profile-suggestions'
                "
                :aria-label="`${bindingName(index)} ${moduleLabel(key)}`"
                @change="updateModuleText(index, key, $event)"
            /></label>
            <button
              type="button"
              class="icon-button"
              :aria-label="t('删除模型 {name}', { name: bindingName(index) })"
              @click="dropModule(index)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
          <div class="topology-module-binding__params">
            <label
              v-for="field in moduleBindingOverrideFields"
              :key="`${index}-${field.key}`"
              class="topology-module-binding__field"
              ><span
                >{{ overrideLabel(field) }} <InlineHelp :text="overrideHint(field)" :label="t('查看字段范围')" /></span
              ><input
                type="number"
                step="any"
                :list="overrideListId(field)"
                :value="overrideValue(index, field.key)"
                :aria-label="`${bindingName(index)} ${overrideLabel(field)}`"
                @change="updateModuleOverride(index, field, $event)"
            /></label>
          </div>
        </div>
        <template v-for="field in moduleBindingOverrideFields" :key="`override-presets-${field.key}`">
          <datalist v-if="overrideListId(field)" :id="overrideListId(field)">
            <option v-for="value in overridePresetValues(field)" :key="value" :value="value" />
          </datalist>
        </template>
        <datalist id="topology-module-version-suggestions">
          <option v-for="value in moduleVersionSuggestions" :key="value" :value="value" />
        </datalist>
        <datalist id="topology-module-profile-suggestions">
          <option v-for="value in moduleProfileSuggestions" :key="value" :value="value" />
        </datalist>
        <p
          v-if="moduleMessage"
          class="structured-note"
          :class="{
            'structured-note--warning': moduleMessage.tone === 'warning',
            'structured-note--error': moduleMessage.tone === 'error',
          }"
          role="status"
        >
          {{ moduleMessage.text }}
        </p>
      </div>
    </section>
    <div v-if="showJson" class="topology-editor__json">
      <label :for="jsonEditorId">{{ t("拓扑输入") }}</label
      ><textarea
        :id="jsonEditorId"
        :value="modelValue"
        spellcheck="false"
        :aria-invalid="Boolean(parsed.error) || topologyFieldError"
        :aria-describedby="topologyFieldError ? jsonErrorId : undefined"
        @input="emit('update:modelValue', eventValue($event))"
      /><small v-if="topologyFieldError" :id="jsonErrorId" class="topology-editor__field-error">{{
        t("后端指出拓扑字段：{path}", { path: props.fieldPath })
      }}</small>
    </div>
    <p v-else-if="topologyFieldError" class="topology-editor__error" role="alert">
      {{ t("后端指出拓扑字段：{path}", { path: props.fieldPath }) }}
    </p>
  </section>
</template>
