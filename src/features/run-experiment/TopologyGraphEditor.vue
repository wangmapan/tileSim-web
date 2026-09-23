<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Link2, MousePointer2, Plus, Trash2, Unlink, X } from "@lucide/vue";
import { useI18n } from "../../i18n";
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
  type TopologyDomain,
} from "./topology-graph";

/**
 * Two switches keep one canvas in both work modes.
 *
 * `readOnly` turns the canvas into a preview: the graph still follows whatever
 * the JSON says, but every editing gesture is refused, and the chrome that only
 * makes sense while editing (connect mode, link properties, domain chips,
 * module bindings) is not rendered at all.
 *
 * `showJson` hides the raw JSON textarea, which is how the quick-control tab
 * stays mouse-only. Both default to the long-standing editor behaviour so a
 * caller that passes neither keeps exactly what it had.
 */
const props = withDefaults(
  defineProps<{ modelValue: string; fieldPath?: string; readOnly?: boolean; showJson?: boolean }>(),
  { fieldPath: "", readOnly: false, showJson: true },
);
const emit = defineEmits<{ (event: "update:modelValue", value: string): void }>();
const { t } = useI18n();
const instanceId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const jsonEditorId = computed(() => `topology-json-editor-${instanceId}`);
const jsonErrorId = computed(() => `topology-json-editor-error-${instanceId}`);
const parsed = ref(parseTopologyDocument(props.modelValue));
const envelope = ref<Record<string, unknown> | null>(parseTopologyDocument(props.modelValue).envelope);
const CANVAS_WIDTH = 760;
const DEVICE_X_GAP = 190;
const DEVICE_Y_START = 68;
const DEVICE_Y_GAP = 105;
const DOMAIN_Y_START = 230;
const DOMAIN_Y_GAP = 78;
const positions = ref<Record<string, { x: number; y: number }>>({});
const domainPositions = ref<Record<string, { x: number; y: number }>>({});
const selectedLink = ref<number | null>(null);
const connecting = ref(false);
const selectedDomainId = ref("");
const drag = ref<{ id: string; offsetX: number; offsetY: number } | null>(null);
const pendingConnection = ref<string | null>(null);
const graph = computed(() => parsed.value.document);
const links = computed(() => graph.value?.links || []);
const domains = computed(() => graph.value?.domains || []);
const devices = computed(() => graph.value?.devices || []);
const hasGraph = computed(() => Boolean(graph.value));
const selected = computed(() => (selectedLink.value === null ? null : links.value[selectedLink.value] || null));
const deviceColumns = computed(() =>
  Math.min(
    4,
    Math.max(1, devices.value.length <= 4 ? devices.value.length : Math.ceil(Math.sqrt(devices.value.length))),
  ),
);
const deviceRows = computed(() => Math.max(1, Math.ceil(devices.value.length / deviceColumns.value)));
const domainColumns = computed(() => Math.min(4, Math.max(1, domains.value.length)));
const domainRows = computed(() => Math.max(1, Math.ceil(domains.value.length / domainColumns.value)));
const domainYStart = computed(() => DOMAIN_Y_START + Math.max(0, deviceRows.value - 1) * DEVICE_Y_GAP);
const canvasHeight = computed(() => Math.max(370, domainYStart.value + (domainRows.value - 1) * DOMAIN_Y_GAP + 72));
const topologyFieldError = computed(() => {
  const path = props.fieldPath || "";
  return path === "/custom_inputs/topology" || path.startsWith("/custom_inputs/topology/");
});
const membershipEdges = computed(() =>
  domains.value.flatMap((domain) => {
    const seen = new Set<string>();
    return domain.member_devices.flatMap((deviceId) => {
      if (seen.has(deviceId) || !positions.value[deviceId] || !domainPositions.value[domain.domain_id]) return [];
      seen.add(deviceId);
      return [{ domain, deviceId }];
    });
  }),
);

function columnX(index: number, columns: number) {
  if (columns <= 1) return CANVAS_WIDTH / 2;
  const gap = Math.min(DEVICE_X_GAP, (CANVAS_WIDTH - 180) / (columns - 1));
  return (CANVAS_WIDTH - gap * (columns - 1)) / 2 + (index % columns) * gap;
}

function resetPositions(items: TopologyDevice[], domainItems: TopologyDomain[]) {
  const next: Record<string, { x: number; y: number }> = {};
  items.forEach((device, index) => {
    const column = index % deviceColumns.value;
    const row = Math.floor(index / deviceColumns.value);
    const previous = positions.value[device.device_id];
    const maxX = CANVAS_WIDTH - 62;
    const maxY = Math.max(38, canvasHeight.value - 36);
    next[device.device_id] = previous
      ? { x: Math.max(62, Math.min(maxX, previous.x)), y: Math.max(38, Math.min(maxY, previous.y)) }
      : {
          x: columnX(column, deviceColumns.value),
          y: DEVICE_Y_START + row * DEVICE_Y_GAP,
        };
  });
  positions.value = next;
  const nextDomains: Record<string, { x: number; y: number }> = {};
  domainItems.forEach((domain, index) => {
    const column = index % domainColumns.value;
    const row = Math.floor(index / domainColumns.value);
    // Domain nodes are an auto-laid-out, read-only representation of
    // membership (only device nodes are draggable). Recompute their anchor
    // whenever the device grid changes so they cannot remain at a stale y
    // coordinate and overlap newly added device rows.
    nextDomains[domain.domain_id] = {
      x: columnX(column, domainColumns.value),
      y: domainYStart.value + row * DOMAIN_Y_GAP,
    };
  });
  domainPositions.value = nextDomains;
}
watch(
  () => props.modelValue,
  (value) => {
    const selectedIndex = selectedLink.value;
    const next = parseTopologyDocument(value);
    parsed.value = next;
    envelope.value = next.envelope;
    if (next.document) {
      resetPositions(next.document.devices, next.document.domains);
      // Parent/template changes invalidate an in-progress connection gesture.
      // Otherwise a removed source device could be written back into the next link.
      pendingConnection.value = null;
      selectedLink.value = selectedIndex !== null && (next.document.links || [])[selectedIndex] ? selectedIndex : null;
      if (!next.document.domains.some((domain) => domain.domain_id === selectedDomainId.value)) {
        selectedDomainId.value = "";
      }
    } else {
      selectedLink.value = null;
      selectedDomainId.value = "";
      pendingConnection.value = null;
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
    y: rect.height ? ((event.clientY - rect.top) / rect.height) * canvasHeight.value : 0,
  };
}
function startNode(event: PointerEvent, device: TopologyDevice) {
  if (props.readOnly) return;
  if (connecting.value) {
    // Connection mode is a two-step gesture: retain the first node until a
    // different node receives pointerup. This supports both click-to-connect
    // and drag-to-connect without accidentally cancelling on source pointerup.
    if (!pendingConnection.value) pendingConnection.value = device.device_id;
    return;
  }
  const p = point(event);
  const position = positions.value[device.device_id] || p;
  drag.value = { id: device.device_id, offsetX: p.x - position.x, offsetY: p.y - position.y };
  (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
}
function moveNode(event: PointerEvent) {
  if (!drag.value) return;
  const p = point(event);
  positions.value = {
    ...positions.value,
    [drag.value.id]: {
      x: Math.max(62, Math.min(CANVAS_WIDTH - 62, p.x - drag.value.offsetX)),
      y: Math.max(38, Math.min(canvasHeight.value - 36, p.y - drag.value.offsetY)),
    },
  };
}
function endNode(event: PointerEvent, target?: TopologyDevice) {
  if (drag.value) drag.value = null;
  if (props.readOnly || !connecting.value || !pendingConnection.value || !target) return;
  const source = pendingConnection.value;
  if (source === target.device_id) {
    // Keep the source armed after a click. The next device click can then
    // complete a keyboard/mouse click-to-connect gesture; Escape or a canvas
    // release still provides an explicit way to cancel it.
    return;
  }
  pendingConnection.value = null;
  const domain = domains.value.find((candidate) => candidate.domain_id === selectedDomainId.value);
  if (!domain) {
    parsed.value = {
      document: graph.value,
      envelope: envelope.value,
      error: domains.value.length
        ? "无法连接：请先在连接模式中明确选择 domain。"
        : "无法连接：请先定义至少一个 domain。",
    };
    return;
  }
  if (
    links.value.some(
      (link) =>
        link.domain_id === domain.domain_id &&
        ((link.src_device === source && link.dst_device === target.device_id) ||
          (link.src_device === target.device_id && link.dst_device === source)),
    )
  )
    return;
  updateDocument((doc) => {
    doc.links = [
      ...(doc.links || []),
      { src_device: source, dst_device: target.device_id, domain_id: domain.domain_id },
    ];
  });
  selectedLink.value = links.value.length - 1;
}
function endCanvasPointer() {
  drag.value = null;
  // A pointer released on the canvas background cancels an incomplete
  // connection gesture instead of leaving a stale source node armed.
  if (connecting.value) pendingConnection.value = null;
}
function deleteSelected() {
  if (selectedLink.value === null) return;
  const index = selectedLink.value;
  updateDocument((doc) => {
    doc.links = (doc.links || []).filter((_, linkIndex) => linkIndex !== index);
  });
  selectedLink.value = null;
}
function updateLinkField(field: "domain_id" | "bandwidth_gbps" | "latency_us", value: string) {
  if (selectedLink.value === null) return;
  updateDocument((doc) => {
    const link = (doc.links || [])[selectedLink.value as number];
    if (!link) return;
    if (field === "domain_id") link.domain_id = value;
    else if (value.trim() === "") delete link[field];
    else {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) return;
      link[field] = numeric;
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
  if (event.key === "Escape") {
    if (!isEditable) {
      connecting.value = false;
      pendingConnection.value = null;
    }
  }
  if (
    !isEditable &&
    !isInteractiveControl &&
    (event.key === "Delete" || event.key === "Backspace") &&
    selectedLink.value !== null
  ) {
    deleteSelected();
  }
}
function deviceLabel(device: TopologyDevice) {
  return device.device_type ? `${device.device_id} · ${device.device_type}` : device.device_id;
}
function domainLabel(domain: TopologyDomain) {
  return t("域 {id}，{type}，{count} 个成员设备", {
    id: domain.domain_id,
    type: domain.domain_type,
    count: domain.member_devices.length,
  });
}
function linkLabel(link: { src_device: string; dst_device: string; domain_id: string }) {
  return t("连接 {src} 与 {dst}，domain {domain}", {
    src: link.src_device,
    dst: link.dst_device,
    domain: link.domain_id,
  });
}
function nodeKeydown(event: KeyboardEvent, device: TopologyDevice) {
  if (props.readOnly) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (!connecting.value) return;
  if (!pendingConnection.value) pendingConnection.value = device.device_id;
  else endNode(event as unknown as PointerEvent, device);
}
function linkKeydown(event: KeyboardEvent, index: number) {
  if (props.readOnly) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    selectedLink.value = index;
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    event.stopPropagation();
    selectedLink.value = index;
    deleteSelected();
  }
}
function selectLink(index: number) {
  if (props.readOnly) return;
  selectedLink.value = index;
}
function toggleConnecting() {
  if (props.readOnly) return;
  connecting.value = !connecting.value;
  if (!connecting.value) pendingConnection.value = null;
}
function eventValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value || "";
}

/* ------------------------------------------------- module_bindings overrides */

const moduleBindings = computed<Record<string, unknown>[]>(
  () => (graph.value?.module_bindings || []) as Record<string, unknown>[],
);
const bindingIndexes = computed(() => moduleBindings.value.map((_, index) => index));

const OVERRIDE_LABEL_SOURCE: Record<string, string> = {
  bandwidth_gbps: "带宽（Gbps）",
  latency_us: "延迟（us）",
  queue_factor: "队列系数",
  oversubscription_factor: "超额订阅系数",
};

const LINK_LABEL_SOURCE: Record<string, string> = {
  domain_id: "所属域",
  bandwidth_gbps: "带宽（Gbps）",
  latency_us: "延迟（us）",
};

/** Link property labels stay Chinese; the contract key survives as a tooltip. */
function linkFieldLabel(field: "domain_id" | "bandwidth_gbps" | "latency_us"): string {
  const source = LINK_LABEL_SOURCE[field];
  return source ? t(source) : field;
}

function overrideLabel(field: SchemaFieldMeta): string {
  const source = OVERRIDE_LABEL_SOURCE[field.key];
  return source ? t(source) : field.key;
}

function bindingName(index: number): string {
  const binding = moduleBindings.value[index];
  const name = binding?.module_name;
  return typeof name === "string" && name.length ? name : `#${index + 1}`;
}

function overrideValue(index: number, key: string): string {
  const params = moduleBindings.value[index]?.override_params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return "";
  const value = (params as Record<string, unknown>)[key];
  return value === undefined || value === null ? "" : String(value);
}

function overrideHint(field: SchemaFieldMeta): string {
  const below = field.exclusiveMinimum !== null ? `> ${field.exclusiveMinimum}` : `${field.minimum ?? "-∞"}`;
  return `${below} ~ ${field.maximum ?? "+∞"}`;
}

/**
 * Writes `module_bindings[].override_params`. Values outside the contract range
 * are refused instead of being written, because the editor's own strict parser
 * would reject the document and blank the graph.
 */
function updateModuleOverride(index: number, field: SchemaFieldMeta, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  updateDocument((document_) => {
    const binding = (document_.module_bindings || [])[index];
    if (!binding) return;
    const existing = binding.override_params;
    const params =
      existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {};
    if (raw.trim() === "") {
      delete params[field.key];
    } else {
      const numeric = Number(raw);
      const belowMinimum =
        field.exclusiveMinimum !== null
          ? numeric <= field.exclusiveMinimum
          : field.minimum !== null
            ? numeric < field.minimum
            : false;
      const aboveMaximum = field.maximum !== null ? numeric > field.maximum : false;
      if (!Number.isFinite(numeric) || belowMinimum || aboveMaximum) return;
      params[field.key] = numeric;
    }
    binding.override_params = params;
  });
}

/* ------------------------------------------- module_bindings as an editable list */

type ModuleMessage = { tone: "info" | "warning" | "error"; text: string };

const moduleMessage = ref<ModuleMessage | null>(null);

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

/** Optional string keys this panel writes; an empty value removes the key. */
const MODULE_TEXT_KEYS = ["module_version", "config_profile"] as const;

const moduleKindValues = computed<readonly string[]>(
  () => moduleBindingFields.find((field) => field.key === "module_kind")?.enumValues || [],
);

function moduleLabel(key: string): string {
  const source = MODULE_LABEL_SOURCE[key];
  return source ? t(source) : key;
}

function moduleKindLabel(value: string): string {
  const source = MODULE_KIND_LABEL_SOURCE[value];
  return source ? t(source) : value;
}

function bindingPath(index: number, key: string): string {
  return `/custom_inputs/topology/topology/module_bindings/${index}/${key}`;
}

function bindingText(index: number, key: string): string {
  const value = moduleBindings.value[index]?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Module edits go through the raw JSON text rather than the parsed graph, so the
 * envelope and every key this panel does not render survive the round trip. The
 * helpers refuse impossible edits (duplicate name, module a domain still binds)
 * instead of writing a document the strict parser would reject.
 */
function updateModuleList(mutate: (document: JsonObject) => ModuleMessage | null) {
  let message: ModuleMessage | null = null;
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

/** Renaming a module rewrites every `domains[].module_binding` that named it. */
function updateModuleName(index: number, event: Event) {
  const current = bindingText(index, "module_name");
  const next = eventValue(event).trim();
  if (!current || next === current) return;
  const bound = domains.value.filter((domain) => domain.module_binding === current).length;
  updateModuleList((document) => {
    renameModuleBinding(document, current, next);
    return {
      tone: "info",
      text: bound
        ? t("已把模型 {from} 改名为 {to}，并同步更新了 {count} 个域的绑定。", {
            from: current,
            to: next,
            count: bound,
          })
        : t("已把模型 {from} 改名为 {to}。", { from: current, to: next }),
    };
  });
}

function updateModuleKind(index: number, event: Event) {
  const name = bindingText(index, "module_name");
  const next = eventValue(event) as DomainType;
  if (!name || next === bindingText(index, "module_kind")) return;
  const mismatched = domains.value
    .filter((domain) => domain.module_binding === name && domain.domain_type !== next)
    .map((domain) => domain.domain_id);
  updateModuleList((document) => {
    setModuleBindingKind(document, name, next);
    return mismatched.length
      ? {
          tone: "warning",
          text: t("模型 {name} 的类型已改为 {kind}，但域 {domains} 的类型对不上，请核对。", {
            name,
            kind: moduleKindLabel(next),
            domains: mismatched.join("、"),
          }),
        }
      : { tone: "info", text: t("模型 {name} 的类型已改为 {kind}。", { name, kind: moduleKindLabel(next) }) };
  });
}

/** Optional text keys stay silent: the input itself is the feedback. */
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
        <strong>{{ t("网络拓扑") }}</strong
        ><small v-if="readOnly">{{ t("只读预览：改下面的 JSON 文本，图会立刻跟着变。") }}</small
        ><small v-else>{{ t("拖动节点调整布局；开启连接后，从一个设备拖到另一个设备即可写入 links。") }}</small>
      </div>
      <template v-if="!readOnly">
        <button
          type="button"
          class="button button--secondary"
          :class="{ active: connecting }"
          :aria-pressed="connecting"
          @click="toggleConnecting"
        >
          <Link2 :size="15" />{{ connecting ? t("退出连接") : t("连接设备") }}
        </button>
        <label v-if="connecting" class="topology-domain-picker"
          >{{ t("连接 domain")
          }}<select v-model="selectedDomainId" :aria-label="t('选择连接 domain')">
            <option value="">{{ t("请选择") }}</option>
            <option v-for="domain in domains" :key="domain.domain_id" :value="domain.domain_id">
              {{ domain.domain_id }}
            </option>
          </select></label
        >
      </template>
    </div>
    <p v-if="parsed.error" class="topology-editor__error" role="alert">{{ parsed.error }}</p>
    <div v-if="!hasGraph" class="topology-editor__empty">
      <MousePointer2 :size="18" /><span>{{ t("输入合法拓扑 JSON 后，这里会显示设备与连接。") }}</span>
    </div>
    <div v-else class="topology-editor__body" :class="{ 'topology-editor__body--selected': selected }">
      <svg
        class="topology-canvas"
        :viewBox="`0 0 ${CANVAS_WIDTH} ${canvasHeight}`"
        :height="canvasHeight"
        role="group"
        :aria-label="t('设备连接图')"
        @pointermove="moveNode"
        @pointerup="endCanvasPointer"
        @pointercancel="endCanvasPointer"
      >
        <g class="topology-memberships" aria-hidden="true">
          <line
            v-for="item in membershipEdges"
            :key="`membership-${item.domain.domain_id}-${item.deviceId}`"
            class="topology-membership"
            :x1="positions[item.deviceId]?.x"
            :y1="positions[item.deviceId]?.y"
            :x2="domainPositions[item.domain.domain_id]?.x"
            :y2="domainPositions[item.domain.domain_id]?.y"
          />
        </g>
        <g class="topology-domain-nodes" :aria-label="t('域成员关系')">
          <g
            v-for="domain in domains"
            :key="`domain-${domain.domain_id}`"
            class="topology-domain-node"
            :class="`topology-domain-node--${domain.domain_type}`"
            :transform="`translate(${domainPositions[domain.domain_id]?.x || 0},${domainPositions[domain.domain_id]?.y || 0})`"
            role="img"
            :aria-label="domainLabel(domain)"
          >
            <rect x="-74" y="-22" width="148" height="44" rx="7" />
            <text class="topology-domain-node__id" text-anchor="middle" y="-3">{{ domain.domain_id }}</text>
            <text class="topology-domain-node__meta" text-anchor="middle" y="13">
              {{ t("{count} 个设备", { count: domain.member_devices.length }) }}
            </text>
          </g>
        </g>
        <g class="topology-links">
          <g
            v-for="(link, index) in links"
            :key="`${link.src_device}-${link.dst_device}-${index}`"
            class="topology-link"
            :class="{ selected: selectedLink === index }"
            :tabindex="readOnly ? -1 : 0"
            :role="readOnly ? 'img' : 'button'"
            :aria-label="linkLabel(link)"
            @click.stop="selectLink(index)"
            @keydown="linkKeydown($event, index)"
          >
            <line
              class="topology-link__hit"
              :x1="positions[link.src_device]?.x"
              :y1="positions[link.src_device]?.y"
              :x2="positions[link.dst_device]?.x"
              :y2="positions[link.dst_device]?.y"
            />
            <line
              :x1="positions[link.src_device]?.x"
              :y1="positions[link.src_device]?.y"
              :x2="positions[link.dst_device]?.x"
              :y2="positions[link.dst_device]?.y"
            />
            <text
              :x="((positions[link.src_device]?.x || 0) + (positions[link.dst_device]?.x || 0)) / 2"
              :y="((positions[link.src_device]?.y || 0) + (positions[link.dst_device]?.y || 0)) / 2 - 8"
            >
              {{ link.domain_id }}
            </text>
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
          :aria-label="t('设备 {label}', { label: deviceLabel(device) })"
          @keydown="nodeKeydown($event, device)"
          @pointerdown.stop="startNode($event, device)"
          @pointerup.stop="endNode($event, device)"
        >
          <rect x="-62" y="-27" width="124" height="54" rx="7" />
          <text class="topology-device__id" text-anchor="middle" y="-3">{{ device.device_id }}</text>
          <text v-if="device.device_type" class="topology-device__type" text-anchor="middle" y="14">
            {{ device.device_type }}
          </text>
        </g>
      </svg>
      <div class="topology-editor__legend" :aria-label="t('拓扑图例')">
        <span><i class="topology-legend-line topology-legend-line--solid" />{{ t("实线：显式连接（links）") }}</span>
        <span
          ><i class="topology-legend-line topology-legend-line--dashed" />{{
            t("虚线：domain 成员关系（仅展示）")
          }}</span
        >
        <span class="topology-editor__count">{{
          t("{devices} 个设备 · {domains} 个 domain · {links} 条显式连接", {
            devices: devices.length,
            domains: domains.length,
            links: links.length,
          })
        }}</span>
      </div>
      <p v-if="!links.length && !readOnly" class="topology-editor__empty-note">
        {{
          t(
            "当前没有显式 links；图中的虚线只表达设备属于哪个 domain，不会写入 links。开启“连接设备”后，可拖拽两个设备创建连接。",
          )
        }}
      </p>
      <aside v-if="selected && !readOnly" class="topology-link-panel" :aria-label="t('连接属性')">
        <header>
          <strong>{{ t("连接属性") }}</strong
          ><button type="button" class="icon-button" :aria-label="t('关闭连接属性')" @click="selectedLink = null">
            <X :size="15" />
          </button>
        </header>
        <small>{{ selected.src_device }} ↔ {{ selected.dst_device }}</small>
        <label title="domain_id"
          >{{ linkFieldLabel("domain_id")
          }}<select :value="selected.domain_id" @change="updateLinkField('domain_id', eventValue($event))">
            <option v-for="domain in domains" :key="domain.domain_id" :value="domain.domain_id">
              {{ domain.domain_id }}
            </option>
          </select></label
        >
        <label title="bandwidth_gbps"
          >{{ linkFieldLabel("bandwidth_gbps")
          }}<input
            :value="selected.bandwidth_gbps ?? ''"
            type="number"
            min="0"
            step="any"
            @input="updateLinkField('bandwidth_gbps', eventValue($event))"
        /></label>
        <label title="latency_us"
          >{{ linkFieldLabel("latency_us")
          }}<input
            :value="selected.latency_us ?? ''"
            type="number"
            min="0"
            step="any"
            @input="updateLinkField('latency_us', eventValue($event))"
        /></label>
        <button type="button" class="button button--danger" @click="deleteSelected">
          <Trash2 :size="14" />{{ t("删除连接") }}
        </button>
      </aside>
    </div>
    <div v-if="graph && domains.length && !readOnly" class="topology-domains" :aria-label="t('拓扑域')">
      <span>{{ t("拓扑域") }}</span
      ><button
        v-for="domain in domains"
        :key="domain.domain_id"
        type="button"
        :class="{ active: selectedDomainId === domain.domain_id }"
        @click="selectedDomainId = domain.domain_id"
      >
        {{
          t("{id} · {type} · {count} 个设备", {
            id: domain.domain_id,
            type: domain.domain_type,
            count: domain.member_devices.length,
          })
        }}
      </button>
    </div>
    <div v-if="graph && !readOnly" class="topology-module-bindings" :aria-label="t('模块绑定参数')">
      <header>
        <div>
          <strong>{{ t("模块绑定参数") }}</strong>
          <small>{{
            t("每行一个网络模型（module_bindings）；域必须绑定其中一个，所以这里空着就没法新增域。最多 {max} 个。", {
              max: topologyModuleBindingMaxItems,
            })
          }}</small>
        </div>
        <button type="button" class="button button--secondary" @click="addOneModule">
          <Plus :size="15" />{{ t("新增模型") }}
        </button>
      </header>
      <p v-if="!moduleBindings.length" class="structured-note">
        {{ t("还没有网络模型。点「新增模型」加一条，再把它绑给需要的域。") }}
      </p>
      <div v-for="index in bindingIndexes" :key="`binding-${index}`" class="topology-module-binding">
        <div class="topology-module-binding__meta">
          <label :data-input-path="bindingPath(index, 'module_name')" title="module_name">
            <span>{{ moduleLabel("module_name") }}</span>
            <input
              type="text"
              spellcheck="false"
              :value="bindingText(index, 'module_name')"
              :aria-label="`${moduleLabel('module_name')} ${index + 1}`"
              :aria-invalid="fieldPath === bindingPath(index, 'module_name')"
              @change="updateModuleName(index, $event)"
            />
          </label>
          <label :data-input-path="bindingPath(index, 'module_kind')" title="module_kind">
            <span>{{ moduleLabel("module_kind") }}</span>
            <select
              :value="bindingText(index, 'module_kind')"
              :aria-label="`${moduleLabel('module_kind')} ${index + 1}`"
              :aria-invalid="fieldPath === bindingPath(index, 'module_kind')"
              @change="updateModuleKind(index, $event)"
            >
              <option v-for="value in moduleKindValues" :key="`kind-${value}`" :value="value">
                {{ moduleKindLabel(value) }}
              </option>
            </select>
          </label>
          <label v-for="key in MODULE_TEXT_KEYS" :key="`${index}-${key}`" :title="key">
            <span>{{ moduleLabel(key) }}</span>
            <input
              type="text"
              spellcheck="false"
              :value="bindingText(index, key)"
              :aria-label="`${bindingName(index)} ${moduleLabel(key)}`"
              @change="updateModuleText(index, key, $event)"
            />
          </label>
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
          <small class="topology-module-binding__hint">{{
            t("以下几项写进 module_bindings[].override_params；留空表示省略该键。")
          }}</small>
          <label
            v-for="field in moduleBindingOverrideFields"
            :key="`${index}-${field.key}`"
            class="topology-module-binding__field"
          >
            <span
              >{{ overrideLabel(field) }} <small>{{ overrideHint(field) }}</small></span
            >
            <input
              type="number"
              step="any"
              :value="overrideValue(index, field.key)"
              :aria-label="`${bindingName(index)} ${overrideLabel(field)}`"
              @change="updateModuleOverride(index, field, $event)"
            />
            <code>{{ field.key }}</code>
          </label>
        </div>
      </div>
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
    <div v-if="showJson" class="topology-editor__json">
      <label :for="jsonEditorId">{{ t("Fabric topology JSON") }}</label
      ><textarea
        :id="jsonEditorId"
        :value="modelValue"
        spellcheck="false"
        :aria-invalid="Boolean(parsed.error) || topologyFieldError"
        :aria-describedby="topologyFieldError ? jsonErrorId : undefined"
        @input="emit('update:modelValue', eventValue($event))"
      />
      <small v-if="topologyFieldError" :id="jsonErrorId" class="topology-editor__field-error">
        {{ t("后端指出拓扑字段：{path}", { path: props.fieldPath }) }}
      </small>
    </div>
    <p v-else-if="topologyFieldError" class="topology-editor__error" role="alert">
      {{ t("后端指出拓扑字段：{path}", { path: props.fieldPath }) }}
    </p>
    <small v-if="!readOnly" class="topology-editor__hint"
      ><Unlink :size="13" />{{
        t("布局坐标仅存在于本次编辑，不会写入提交 JSON。边属性保持缺失与 0 的原始语义。")
      }}</small
    >
  </section>
</template>
