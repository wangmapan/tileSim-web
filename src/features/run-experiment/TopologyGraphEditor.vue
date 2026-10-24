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
  Unlink,
  ZoomIn,
  ZoomOut,
} from "@lucide/vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import DeviceInventoryForm from "./DeviceInventoryForm.vue";
import DomainInventoryForm from "./DomainInventoryForm.vue";
import TopologyLinkProperties from "./TopologyLinkProperties.vue";
import {
  moduleBindingFields,
  moduleBindingOverrideFields,
  topologyModuleBindingMaxItems,
  type SchemaFieldMeta,
} from "./input-schema-meta";
import {
  addModuleBinding,
  moduleBindingNamesOf,
  nextModuleBindingName,
  patchJsonDocument,
  removeModuleBinding,
  renameModuleBinding,
  setModuleBindingKind,
  setModuleBindingText,
  StructuredInputError,
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

const props = withDefaults(
  defineProps<{
    modelValue: string;
    fieldPath?: string;
    readOnly?: boolean;
    showJson?: boolean;
    showModuleBindings?: boolean;
  }>(),
  { fieldPath: "", readOnly: false, showJson: true, showModuleBindings: true },
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
const ARRANGEMENT_DEVICE_Y_GAP = 180;
const ARRANGEMENT_GROUP_ROW_GAP = 72;
const ARRANGEMENT_CARD_HEIGHT = 72;
const ARRANGEMENT_INNER_X_GAP = 150;
const ARRANGEMENT_ROW_GAP = 48;
const ARRANGEMENT_SIDE_INSET = 48;
const graph = computed(() => parsed.value.document);
const links = computed(() => graph.value?.links || []);
const domains = computed(() => graph.value?.domains || []);
const devices = computed(() => graph.value?.devices || []);
const hasGraph = computed(() => Boolean(graph.value));
const selected = computed(() => (selectedLink.value === null ? null : links.value[selectedLink.value] || null));
/**
 * A device may belong to more than one domain. Treat overlapping domains as
 * one visual component so the one-click layout never duplicates a card.
 * Devices without a domain remain one-card components.
 */
const domainComponents = computed<TopologyDevice[][]>(() => {
  const parent = new Map<string, string>();
  devices.value.forEach((device) => parent.set(device.device_id, device.device_id));
  const find = (id: string): string => {
    const current = parent.get(id) || id;
    if (current === id) return current;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const join = (left: string, right: string) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  domains.value.forEach((domain) => {
    const members = domain.member_devices.filter((id) => parent.has(id));
    members.slice(1).forEach((member) => join(members[0], member));
  });
  const groups = new Map<string, TopologyDevice[]>();
  devices.value.forEach((device) => {
    const root = find(device.device_id);
    const group = groups.get(root) || [];
    group.push(device);
    groups.set(root, group);
  });
  return [...groups.values()];
});
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
    DEVICE_Y_START +
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
const viewBoxHeight = computed(() => WORKSPACE_HEIGHT);
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
    .map((device) => `${device.device_id}:${device.group_id || ""}`)
    .sort()
    .join("|");
  const domainSignature = document.domains
    .map((domain) => `${domain.domain_id}:${domain.domain_type}:${[...domain.member_devices].sort().join(",")}`)
    .sort()
    .join("|");
  return `${deviceSignature}||${domainSignature}`;
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
      resetPositions(next.document.devices);
      if (selectedLink.value !== null && !next.document.links?.[selectedLink.value]) selectedLink.value = null;
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
    return position && Math.abs(p.x - position.x) <= 62 && Math.abs(p.y - position.y) <= 36;
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
  } else if (drag.value?.moved) pendingConnection.value = null;
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
  const sourceDevice = devices.value.find((device) => device.device_id === source);
  const targetDevice = devices.value.find((device) => device.device_id === target);
  const sameGroup = Boolean(
    sourceDevice?.group_id && targetDevice?.group_id && sourceDevice.group_id === targetDevice.group_id,
  );
  const preferredDomainType = sameGroup ? "scale_up" : "scale_out";
  const domain =
    domains.value.find(
      (candidate) =>
        candidate.domain_type === preferredDomainType &&
        candidate.member_devices.includes(source) &&
        candidate.member_devices.includes(target),
    ) ||
    domains.value.find(
      (candidate) => candidate.member_devices.includes(source) && candidate.member_devices.includes(target),
    ) ||
    domains.value.find((candidate) => candidate.domain_type === preferredDomainType) ||
    domains.value[0];
  if (!domain) {
    parsed.value = { document: graph.value, envelope: envelope.value, error: "无法连接：请先定义至少一个 domain。" };
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
      { src_device: source, dst_device: target, domain_id: domain.domain_id },
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
  if (!props.readOnly) selectedLink.value = index;
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
  return device.device_type ? `${device.device_id} · ${device.device_type}` : device.device_id;
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
  const domain = domains.value.find((candidate) => candidate.domain_id === link.domain_id);
  return domain?.domain_type === "scale_up" ? "inside" : "cross";
}
function linkKindLabel(link: TopologyLink) {
  return t(linkKind(link) === "inside" ? "域内通信" : "跨域通信");
}
function linkKindText(link: TopologyLink) {
  return `${linkKindLabel(link)} · ${link.domain_id}${link.link_id ? ` · ${link.link_id}` : ""}`;
}
function linkBadgeWidth(link: TopologyLink) {
  return Math.min(190, Math.max(92, [...linkKindText(link)].length * 7 + 18));
}
function deviceDomainLabel(device: TopologyDevice) {
  const ids = domains.value
    .filter((domain) => domain.member_devices.includes(device.device_id))
    .map((domain) => domain.domain_id);
  if (!ids.length) return t("未入域");
  return t("域 · {domains}", { domains: ids.length === 1 ? ids[0] : `${ids[0]} +${ids.length - 1}` });
}
function linkMidpoint(link: TopologyLink) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return { x: 0, y: 0 };
  if (linkKind(link) === "cross") {
    const controlY = Math.max(20, (source.y + target.y) / 2 - 60);
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 4 + controlY / 2 };
  }
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}
function linkBadgeBasePosition(link: TopologyLink) {
  const midpoint = linkMidpoint(link);
  if (linkKind(link) === "cross") return midpoint;
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return midpoint;
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  return horizontal ? { x: midpoint.x, y: midpoint.y - 42 } : { x: midpoint.x + 82, y: midpoint.y };
}
const linkBadgePositions = computed(() => {
  const basePositions = links.value.map((link) => linkBadgeBasePosition(link));
  const collisionGroups = new Map<string, number[]>();
  basePositions.forEach((position, index) => {
    // A 28px bucket keeps exact and near-exact labels together without
    // repeatedly scanning every link for every badge. Exact parallel links
    // therefore stay cheap even in large synthetic topologies.
    const key = `${Math.round(position.x / 28)}:${Math.round(position.y / 28)}`;
    const group = collisionGroups.get(key) || [];
    group.push(index);
    collisionGroups.set(key, group);
  });
  const result = basePositions.map((position) => ({ ...position }));
  collisionGroups.forEach((indexes) => {
    indexes.forEach((linkIndex, slot) => {
      const link = links.value[linkIndex];
      if (!link) return;
      const offset = (slot - (indexes.length - 1) / 2) * 22;
      result[linkIndex] = {
        x: basePositions[linkIndex].x,
        y: basePositions[linkIndex].y + offset,
      };
    });
  });
  return result;
});
function linkBadgePosition(link: TopologyLink, index: number) {
  return linkBadgePositions.value[index] || linkBadgeBasePosition(link);
}
function linkPath(link: TopologyLink) {
  const source = positions.value[link.src_device];
  const target = positions.value[link.dst_device];
  if (!source || !target) return "";
  const controlY = Math.max(20, (source.y + target.y) / 2 - 60);
  return `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2} ${controlY} ${target.x} ${target.y}`;
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
    :class="{ 'topology-editor--readonly': readOnly }"
    :aria-label="t('网络拓扑可视化编辑器')"
    tabindex="-1"
    @keydown="keydown"
  >
    <div class="topology-editor__toolbar">
      <div>
        <strong>{{ t("显卡连接") }}</strong>
        <InlineHelp
          :text="
            readOnly
              ? t('只读预览：改下面的 JSON 文本，显卡和连线会立刻跟着变。')
              : t('空白区域可平移画布；拖动显卡调整位置；拖到另一张卡新增连接；再次拖同一对移除连接。')
          "
        />
      </div>
      <div v-if="!readOnly" class="topology-editor__toolbar-actions">
        <button
          v-if="hasGraph"
          type="button"
          class="button button--secondary button--small topology-arrange-button"
          @click="arrangeByDomain"
        >
          <LayoutGrid :size="14" />{{ t("按域一键排布") }}
        </button>
        <InlineHelp :text="t('只调整画布位置，不修改拓扑 JSON。')" />
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
        <span class="topology-status-chip topology-status-chip--simulation">{{ t("拖拽编辑") }}</span>
      </div>
    </div>
    <div v-if="hasGraph" class="topology-summary" :aria-label="t('拓扑摘要')">
      <div class="topology-summary__metric">
        <strong>{{ devices.length }}</strong
        ><span>{{ t("显卡") }}</span>
      </div>
      <div class="topology-summary__metric">
        <strong>{{ links.length }}</strong
        ><span>{{ t("已连接") }}</span>
      </div>
      <div class="topology-summary__metric">
        <strong>{{ domains.length }}</strong
        ><span>{{ t("仿真域") }}</span>
      </div>
    </div>
    <p v-if="parsed.error" class="topology-editor__error" role="alert">{{ parsed.error }}</p>
    <div v-if="hasGraph" ref="editorRegion" class="topology-direct-canvas">
      <div class="topology-direct-canvas__controls">
        <div v-if="isFullscreen" class="topology-workbench__title">
          <strong>{{ t("显卡连接工作台") }}</strong>
          <span>{{ t("在这里添加显卡、分配仿真域并编辑连接") }}</span>
        </div>
        <button
          v-if="isFullscreen && !readOnly"
          type="button"
          class="button button--secondary button--small topology-arrange-button topology-fullscreen-arrange"
          :aria-label="t('按域一键排布')"
          :title="t('按域一键排布')"
          data-fullscreen-arrange
          @click="arrangeByDomain"
        >
          <LayoutGrid :size="14" />{{ t("按域一键排布") }}
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
            <span>{{ t("会删除当前拓扑中的所有显卡、仿真域和连接；网络模型参数保留。") }}</span>
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
      <aside v-if="isFullscreen" class="topology-workbench__sidebar" :aria-label="t('显卡与仿真域')">
        <header class="topology-workbench__panel-header">
          <div>
            <strong>{{ t("显卡与仿真域") }}</strong>
            <small>{{ t("这里的修改会直接写入当前拓扑输入") }}</small>
          </div>
        </header>
        <DeviceInventoryForm
          :model-value="modelValue"
          :field-path="fieldPath"
          @update:model-value="updateFromWorkbench"
          @device-count-change="handleWorkbenchDeviceCount"
          @notice="handleWorkbenchNotice"
        />
        <DomainInventoryForm
          :model-value="modelValue"
          :field-path="fieldPath"
          @update:model-value="updateFromWorkbench"
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
      <div class="topology-direct-canvas__instruction">
        <MousePointer2 :size="15" />
        <span v-if="pendingConnection">{{ t("已选择 {device}，拖到另一张卡。", { device: pendingConnection }) }}</span>
        <InlineHelp
          v-else
          :text="t('空白区域可平移画布；拖动显卡调整位置；拖到另一张卡新增连接；再次拖同一对移除连接。')"
        />
        <InlineHelp
          v-if="domains.length"
          :text="t('同组显卡优先使用 scale_up 域，不同组显卡优先使用 scale_out 域；点击连线可改所属 domain。')"
        />
        <small v-if="arrangementApplied" class="topology-direct-canvas__arranged-note">
          {{ t("已按 domain 分组排布；拖动卡片仍可微调位置。") }}
        </small>
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
            <g class="topology-links">
              <g
                v-for="(link, index) in links"
                :key="`${link.src_device}-${link.dst_device}-${index}`"
                class="topology-link"
                :class="[`topology-link--${linkKind(link)}`, { selected: selectedLink === index }]"
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
                <path v-else class="topology-link__hit" :d="linkPath(link)" />
                <line
                  v-if="linkKind(link) === 'inside'"
                  :x1="positions[link.src_device]?.x"
                  :y1="positions[link.src_device]?.y"
                  :x2="positions[link.dst_device]?.x"
                  :y2="positions[link.dst_device]?.y"
                />
                <path v-else :d="linkPath(link)" />
                <g
                  class="topology-link__badge"
                  :transform="`translate(${linkBadgePosition(link, index).x}, ${linkBadgePosition(link, index).y - 13})`"
                >
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
              :class="{ pending: pendingConnection === device.device_id }"
              :transform="`translate(${positions[device.device_id]?.x || 0},${positions[device.device_id]?.y || 0})`"
              :tabindex="readOnly ? -1 : 0"
              :role="readOnly ? 'img' : 'button'"
              :aria-label="t('设备 {label}', { label: `${deviceLabel(device)}，${deviceDomainLabel(device)}` })"
              @keydown="nodeKeydown($event, device)"
              @pointerdown.stop="startNode($event, device)"
              @pointerup.stop="endNode($event, device)"
            >
              <title>{{ deviceDomainLabel(device) }}</title>
              <rect x="-62" y="-36" width="124" height="72" rx="8" />
              <text class="topology-device__id" text-anchor="middle" y="-4">{{ device.device_id }}</text>
              <text v-if="device.device_type" class="topology-device__type" text-anchor="middle" y="12">
                {{ device.device_type }}
              </text>
              <text class="topology-device__domain" text-anchor="middle" y="28">{{ deviceDomainLabel(device) }}</text>
            </g>
          </g>
        </svg>
      </div>
      <div class="topology-direct-canvas__legend">
        <span><i class="topology-legend-line topology-legend-line--inside" />{{ t("实线：域内通信") }}</span>
        <span><i class="topology-legend-line topology-legend-line--cross" />{{ t("虚线：跨域通信") }}</span>
        <span class="topology-direct-canvas__legend-note">{{ t("卡片下方的域标签用于核对归属") }}</span>
        <span v-if="!links.length" class="topology-direct-canvas__empty">{{ t("当前还没有显卡连接") }}</span>
      </div>
    </div>
    <div v-if="!hasGraph" class="topology-editor__empty">
      <MousePointer2 :size="18" /><span>{{ t("输入合法拓扑 JSON 后，这里会显示显卡与连接。") }}</span>
    </div>
    <TopologyLinkProperties
      v-if="selected && !readOnly && !isFullscreen"
      :link="selected"
      :domains="domains"
      @delete="deleteSelected"
      @update-field="updateLinkField($event.field, $event.value)"
    />
    <details
      v-if="graph && !readOnly && showModuleBindings"
      class="topology-advanced-disclosure topology-editor__advanced"
    >
      <summary>
        <span
          ><strong>{{ t("网络模型参数") }}</strong
          ><InlineHelp :text="t('只有需要改模型或连接参数时再展开')" :interactive="false" /></span
        ><span>{{ t("高级") }}</span>
      </summary>
      <div class="topology-advanced-disclosure__body">
        <header class="topology-section-header">
          <div>
            <strong>{{ t("模块绑定参数") }}</strong
            ><InlineHelp
              :text="
                t('每行一个网络模型；域必须绑定其中一个。最多 {max} 个。', {
                  max: topologyModuleBindingMaxItems,
                })
              "
            />
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
            <InlineHelp :text="t('以下几项写进 module_bindings[].override_params；留空表示省略该键。')" />
            <label
              v-for="field in moduleBindingOverrideFields"
              :key="`${index}-${field.key}`"
              class="topology-module-binding__field"
              ><span
                >{{ overrideLabel(field) }} <small>{{ overrideHint(field) }}</small></span
              ><input
                type="number"
                step="any"
                :list="overrideListId(field)"
                :value="overrideValue(index, field.key)"
                :aria-label="`${bindingName(index)} ${overrideLabel(field)}`"
                @change="updateModuleOverride(index, field, $event)"
              /><code>{{ field.key }}</code></label
            >
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
    </details>
    <div v-if="showJson" class="topology-editor__json">
      <label :for="jsonEditorId">{{ t("Fabric topology JSON") }}</label
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
    <div v-if="!readOnly" class="topology-editor__hint">
      <Unlink :size="13" /><InlineHelp
        :text="t('画布位置只用于本次编辑，不会写入提交 JSON；连接属性保留缺失与 0 的原始语义。')"
      />
    </div>
  </section>
</template>
