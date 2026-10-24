<script setup>
import {
  Braces,
  Cpu,
  Database,
  Gauge,
  Network,
  PackageSearch,
  RotateCcw,
  SlidersHorizontal,
  Table2,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import DeviceInventoryForm from "./DeviceInventoryForm.vue";
import DomainInventoryForm from "./DomainInventoryForm.vue";
import RequestTableForm from "./RequestTableForm.vue";
import RuntimeEngineForm from "./RuntimeEngineForm.vue";
import RuntimePolicyForm from "./RuntimePolicyForm.vue";
import TopologyGraphEditor from "./TopologyGraphEditor.vue";
import {
  clearParticipants,
  parseJsonDocument,
  patchJsonDocument,
  rewriteParticipantsForExistingTp,
  rewriteRequestParallelism,
  readControlPointer,
  writeControlPointer,
} from "./structured-input";
import { engineModeOf } from "./runtime-engine";

const form = defineModel("form", { type: Object, required: true });
const mode = defineModel("mode", { type: String, required: true });
const runtimeJson = defineModel("runtimeJson", { type: String, required: true });
const topologyJson = defineModel("topologyJson", { type: String, required: true });
const pairingPending = defineModel("pairingPending", { type: Boolean, default: false });
/**
 * Off until the user turns the structured editors on from the quick-control tab.
 * While it is off this panel keeps emitting `overrides` exactly as it did
 * before, so nothing about the quick-control path changes by itself — the
 * channel only moves to `custom_inputs` once the knobs alone can no longer
 * express what the user asked for.
 */
const structuredInput = defineModel("structuredInput", { type: Boolean, default: false });
const props = defineProps({
  surface: { type: Object, required: true },
  controlGroups: { type: Array, required: true },
  fieldPath: { type: String, default: "" },
  errorMessage: { type: String, default: "" },
  compact: { type: Boolean, default: false },
  modelIds: { type: Array, default: () => [] },
});
defineEmits([
  "reset-controls",
  "load-template",
  "load-bundle",
  "load-json-file",
  "use-structured-input",
  "disable-structured-input",
]);
const { t } = useI18n();
const showFieldContracts = ref(false);
const topologyAdvancedOpen = ref(false);
const pairingPrompt = ref(null);
const structuredNotice = ref("");
const structuredNoticeTone = ref("info");
const controlFields = computed(() => (props.controlGroups || []).flatMap((group) => group.fields));
const moduleOrder = ["workload", "runtime", "requests", "topology", "fabric"];
const moduleSubsystem = {
  workload: "S0",
  runtime: "S1",
  fabric: "S6",
};
const moduleCopy = {
  workload: {
    label: "工作负载",
    description: "通信负载输入",
    structured: false,
    status: "快捷参数",
    structuredStatus: "快捷参数",
  },
  runtime: {
    label: "运行策略",
    description: "调度、批处理与 KV 准入",
    structured: true,
    status: "运行时参数",
    structuredStatus: "含进阶策略",
  },
  requests: {
    label: "请求",
    description: "请求行、模型与参与设备",
    structured: true,
    status: "需要完整输入",
    structuredStatus: "可编辑请求表",
  },
  topology: {
    label: "拓扑",
    description: "显卡、网络域与连线",
    structured: true,
    status: "需要完整输入",
    structuredStatus: "可编辑拓扑",
  },
  fabric: {
    label: "互联参数",
    description: "Scale-up 与 Scale-out",
    structured: false,
    status: "快捷参数",
    structuredStatus: "快捷参数",
  },
};
const activeModule = ref("runtime");
const activeControlGroups = computed(() => {
  const subsystem = moduleSubsystem[activeModule.value];
  return subsystem ? props.controlGroups.filter((group) => group.subsystem === subsystem) : [];
});
const moduleCards = computed(() =>
  moduleOrder.map((id) => {
    const group = props.controlGroups.find((item) => item.subsystem === moduleSubsystem[id]);
    const fieldCount = group?.fields.length || 0;
    const needsStructuredInput = moduleCopy[id].structured;
    return {
      id,
      ...moduleCopy[id],
      fieldCount,
      status: needsStructuredInput && structuredInput.value ? moduleCopy[id].structuredStatus : moduleCopy[id].status,
      available: needsStructuredInput ? props.surface.inputModes.includes("json") : fieldCount > 0,
      hasError: fieldPathBelongsToModule(props.fieldPath, id),
    };
  }),
);

function fieldPathBelongsToModule(path, module) {
  if (!path) return false;
  const subsystem = moduleSubsystem[module];
  if (
    subsystem &&
    props.controlGroups.some(
      (group) => group.subsystem === subsystem && group.fields.some((field) => field.requestJsonPointer === path),
    )
  ) {
    return true;
  }
  if (module === "runtime") return path.startsWith("/custom_inputs/runtime_trace/policy") || path.includes("/engine_");
  if (module === "requests") return path.startsWith("/custom_inputs/runtime_trace/requests");
  if (module === "topology") return path.startsWith("/custom_inputs/topology");
  return false;
}

function selectModule(module) {
  activeModule.value = module;
}

watch(
  () => props.fieldPath,
  (path) => {
    const module = moduleOrder.find((item) => fieldPathBelongsToModule(path, item));
    if (module) activeModule.value = module;
  },
  { immediate: true },
);
const NUMERIC_PRESETS = {
  "s0.workload.message_size_multiplier": [0.5, 1, 2, 4],
  "s1.runtime.max_batch_size": [1, 4, 8, 16, 32, 64],
  "s1.runtime.kv_capacity_tokens": [4096, 8192, 16384, 32768, 65536],
  "s1.runtime.max_active_requests": [1, 4, 8, 16, 32, 64],
  "s1.runtime.initial_kv_tokens": [0, 1024, 4096, 8192],
  "s1.runtime.kv_admission_watermark": [0.5, 0.75, 0.9, 0.95, 1],
  "s1.runtime.long_context_threshold_tokens": [2048, 4096, 8192, 16384, 32768],
  "s1.runtime.decode_penalty_per_threshold": [0, 0.1, 0.25, 0.5, 1],
  "s6.fabric.scale_up_bandwidth_gbps": [100, 400, 800, 1600],
  "s6.fabric.scale_up_latency_us": [0.5, 1, 2, 5],
  "s6.fabric.scale_out_bandwidth_gbps": [25, 100, 400, 800],
  "s6.fabric.scale_out_latency_us": [1, 5, 10, 25],
};
function numericPresetValues(field) {
  const values = NUMERIC_PRESETS[field.fieldId] || [];
  return values.filter(
    (value) => (field.minimum == null || value >= field.minimum) && (field.maximum == null || value <= field.maximum),
  );
}
function numericListId(field) {
  return numericPresetValues(field).length
    ? `control-${field.fieldId.replace(/[^a-z0-9]+/gi, "-")}-presets`
    : undefined;
}
const engineMode = computed(() => {
  const parsed = parseJsonDocument(runtimeJson.value, "Runtime trace");
  return parsed.ok ? engineModeOf(parsed.value) : "generic";
});

function deviceIdsFromTopology(text) {
  const parsed = parseJsonDocument(text, "Fabric topology");
  if (!parsed.ok) return null;
  const topology = parsed.value.topology;
  if (!topology || typeof topology !== "object" || Array.isArray(topology)) return null;
  const devices = topology.devices;
  if (!Array.isArray(devices)) return null;
  return devices
    .map((device) => (device && typeof device === "object" && !Array.isArray(device) ? device.device_id : null))
    .filter((id) => typeof id === "string" && id.length > 0);
}

/**
 * Assistant plans can resize topology/devices without going through the
 * DeviceInventoryForm's native input event. Observe that same document change
 * so the coupled TP/participants decision is still required and visible.
 */
let previousDeviceIds = null;

function setPairingPrompt(ids) {
  pairingPrompt.value = ids.length ? { ids } : null;
  pairingPending.value = Boolean(pairingPrompt.value);
}

watch(
  () => topologyJson.value,
  (next) => {
    const current = deviceIdsFromTopology(next);
    const previous = previousDeviceIds;
    previousDeviceIds = current;
    if (!structuredInput.value || !current || !previous || current.length === previous.length) return;
    if (!runtimeJson.value.trim()) return;
    setPairingPrompt(current);
  },
  { immediate: true },
);

/**
 * R3: shrinking or growing the device inventory changes nothing on its own —
 * the shipped template pins `participants` to gpu0..gpu3, and only an omitted
 * participants list makes the engine derive members from the inventory by
 * tp_degree. So the change is surfaced with two explicit choices instead of
 * being applied silently.
 */
function onDeviceCountChange(payload) {
  if (!payload.ids.length) return;
  // DeviceInventoryForm emits this event for ordinary field edits too (for
  // example a device rename). Only a count change alters the TP/participants
  // coupling; a same-sized identity update already rewrites its references.
  if (previousDeviceIds && payload.ids.length === previousDeviceIds.length) return;
  if (!runtimeJson.value.trim()) {
    structuredNoticeTone.value = "warning";
    structuredNotice.value = t("设备清单已变化，但 runtime trace 还是空的：加载模板后再决定请求表里的参与设备怎么办。");
    return;
  }
  setPairingPrompt(payload.ids);
}

function onBlockNotice(payload) {
  structuredNoticeTone.value = payload.tone;
  structuredNotice.value = payload.message;
}

function applyPairing(kind) {
  const ids = pairingPrompt.value?.ids || [];
  const outcome = { count: 0, missing: 0 };
  let applied = false;
  try {
    if (kind === "parallelism") {
      runtimeJson.value = patchJsonDocument(runtimeJson.value, "Runtime trace", (draft) => {
        outcome.count = rewriteRequestParallelism(draft, ids);
      });
      structuredNoticeTone.value = "info";
      structuredNotice.value = t("已把 {count} 条请求的 TP 与参与设备同步到 {devices}。请继续核对 domains 和 links。", {
        count: outcome.count,
        devices: ids.join("、"),
      });
    } else if (kind === "participants") {
      runtimeJson.value = patchJsonDocument(runtimeJson.value, "Runtime trace", (draft) => {
        outcome.count = rewriteParticipantsForExistingTp(draft, ids);
      });
      structuredNoticeTone.value = "info";
      structuredNotice.value = t(
        "已按原 TP 为 {count} 条请求选择参与设备。请确认每条请求的 TP/participants 与拓扑一致。",
        {
          count: outcome.count,
        },
      );
    } else {
      runtimeJson.value = patchJsonDocument(runtimeJson.value, "Runtime trace", (draft) => {
        const result = clearParticipants(draft);
        outcome.count = result.cleared;
        outcome.missing = result.missingTpDegree;
      });
      structuredNoticeTone.value = "info";
      structuredNotice.value = t("已清空 {count} 条请求的参与设备；其中 {missing} 条没填并行卡数，需要补上。", {
        count: outcome.count,
        missing: outcome.missing,
      });
    }
    applied = true;
  } catch (error) {
    structuredNoticeTone.value = "warning";
    structuredNotice.value = error instanceof Error ? error.message : String(error);
  }
  // A failed coupling edit must keep the run blocked. Clearing the prompt here
  // would make the page look settled while the old TP/participants relation
  // still cannot satisfy the resized topology.
  if (applied) setPairingPrompt([]);
}

/**
 * The knobs and the policy form both claim the same keys once the structured
 * editor is open, so an edited knob is mirrored into the document immediately.
 * Only the changed knob is written, which leaves values typed directly into the
 * form alone. `lastKnobs` is a local snapshot because a deep watcher reports the
 * same (already mutated) object for both the new and the old value.
 */
let lastKnobs = { ...(form.value.parameterValues || {}) };
watch(
  () => form.value.parameterValues,
  () => {
    const current = { ...(form.value.parameterValues || {}) };
    const changed = new Set(Object.keys(current).filter((fieldId) => current[fieldId] !== lastKnobs[fieldId]));
    Object.keys(lastKnobs).forEach((fieldId) => {
      if (!(fieldId in current)) changed.add(fieldId);
    });
    lastKnobs = current;
    if (!structuredInput.value || !changed.size) return;
    const notes = [];
    for (const field of controlFields.value) {
      if (!changed.has(field.fieldId)) continue;
      const raw = current[field.fieldId];
      const value = raw === undefined || raw === null || raw === "" ? undefined : raw;
      const result = writeControlPointer({
        runtimeJson: runtimeJson.value,
        topologyJson: topologyJson.value,
        pointer: field.requestJsonPointer,
        value,
      });
      runtimeJson.value = result.runtimeJson;
      topologyJson.value = result.topologyJson;
      if (result.note) notes.push(result.note);
    }
    if (notes.length) {
      structuredNoticeTone.value = "warning";
      structuredNotice.value = notes.map((note) => note.message).join(" ");
    }
  },
  { deep: true },
);

/**
 * Keep the quick-control view following edits made in the structured JSON
 * editors (including an assistant-approved JSON plan).  The document remains
 * canonical while the structured channel is open; this watcher only projects
 * scalar values back into controls whose pointers have an exact document
 * owner.  Unsupported projections, such as the workload multiplier, are left
 * untouched rather than guessed.
 */
watch(
  [runtimeJson, topologyJson, structuredInput, controlFields],
  () => {
    if (!structuredInput.value) return;
    const next = { ...(form.value.parameterValues || {}) };
    let changed = false;
    for (const field of controlFields.value) {
      const result = readControlPointer({
        runtimeJson: runtimeJson.value,
        topologyJson: topologyJson.value,
        pointer: field.requestJsonPointer,
      });
      if (!result.supported) continue;
      const value = result.found ? result.value : undefined;
      if (next[field.fieldId] !== value) changed = true;
      next[field.fieldId] = value;
    }
    if (changed) form.value.parameterValues = next;
    lastKnobs = { ...next };
  },
  { deep: true, immediate: true },
);

watch(mode, (next) => {
  if (next !== "controls") setPairingPrompt([]);
});
</script>

<template>
  <article class="panel form-section">
    <header class="form-section-title">
      <span>02</span>
      <div>
        <h2>{{ t("输入方式") }}</h2>
        <InlineHelp v-if="!props.compact" :text="t('先选输入方式，再调整需要的参数。')" />
      </div>
    </header>
    <div class="experiment-input-toolbar">
      <div class="segmented-control">
        <button
          :class="{ active: mode === 'controls' }"
          :disabled="!surface.inputModes.includes('controls')"
          @click="mode = 'controls'"
        >
          <SlidersHorizontal :size="16" />{{ t("快捷控制") }}
        </button>
        <button
          :class="{ active: mode === 'json' }"
          :disabled="!surface.inputModes.includes('json')"
          @click="mode = 'json'"
        >
          <Braces :size="16" />{{ t("JSON 输入") }}
        </button>
        <button
          :class="{ active: mode === 'trace_package' }"
          :disabled="!surface.inputModes.includes('trace_package')"
          @click="mode = 'trace_package'"
        >
          <PackageSearch :size="16" />{{ t("Trace package") }}
        </button>
      </div>
      <button
        v-if="mode === 'controls'"
        class="text-button"
        :aria-pressed="showFieldContracts"
        @click="showFieldContracts = !showFieldContracts"
      >
        <Braces :size="14" />{{ showFieldContracts ? t("隐藏字段契约") : t("显示字段契约") }}
      </button>
    </div>

    <section v-if="mode === 'controls'" class="structured-area experiment-module-layout">
      <header class="structured-block__header structured-area__header">
        <SlidersHorizontal :size="17" />
        <div>
          <strong>{{ t("输入模块") }}</strong>
          <small>{{ t("按模块切换，逐步完成运行策略、请求与拓扑。") }}</small>
        </div>
        <button
          v-if="!structuredInput"
          type="button"
          class="button button--secondary structured-entry-button"
          :disabled="!surface.inputModes.includes('json')"
          @click="$emit('use-structured-input')"
        >
          <Table2 :size="15" />{{ t("启用完整输入") }}
        </button>
        <button v-else type="button" class="text-button" @click="$emit('disable-structured-input')">
          <RotateCcw :size="14" />{{ t("停用，回到只用旋钮") }}
        </button>
      </header>

      <p v-if="structuredInput" class="structured-note structured-note--info" role="status">
        {{ t("完整输入已启用。上方参数会同步到对应的输入文档。") }}
      </p>
      <p
        v-if="structuredNotice"
        class="structured-note"
        :class="`structured-note--${structuredNoticeTone}`"
        role="status"
      >
        {{ structuredNotice }}
      </p>
      <div v-if="pairingPrompt" class="structured-note structured-note--warning" role="alert">
        <p>
          {{
            t("设备清单现在是 {count} 张卡。只加卡而不改请求不会改变结果，请选择如何处理请求表：", {
              count: pairingPrompt.ids.length,
            })
          }}
        </p>
        <div class="structured-actions">
          <button type="button" class="button button--secondary" @click="applyPairing('parallelism')">
            {{ t("① 同步 TP 与参与设备到新集合") }}
          </button>
          <button type="button" class="button button--secondary" @click="applyPairing('participants')">
            {{ t("② 保留原 TP，按新集合选择参与设备") }}
          </button>
          <button type="button" class="button button--secondary" @click="applyPairing('clear')">
            {{ t("③ 清空参与设备，保留并行卡数") }}
          </button>
          <button type="button" class="text-button" @click="setPairingPrompt([])">{{ t("稍后再说") }}</button>
        </div>
      </div>

      <div class="experiment-module-navigation" role="tablist" :aria-label="t('输入模块')">
        <button
          v-for="card in moduleCards"
          :key="card.id"
          type="button"
          role="tab"
          class="experiment-module-card"
          :class="{ 'is-active': activeModule === card.id, 'has-error': card.hasError, 'is-disabled': !card.available }"
          :aria-selected="activeModule === card.id"
          :aria-controls="`experiment-module-panel-${card.id}`"
          :data-module="card.id"
          @click="selectModule(card.id)"
        >
          <span class="experiment-module-card__icon" aria-hidden="true">
            <Database v-if="card.id === 'workload'" :size="18" />
            <Cpu v-else-if="card.id === 'runtime'" :size="18" />
            <Table2 v-else-if="card.id === 'requests'" :size="18" />
            <Network v-else-if="card.id === 'topology'" :size="18" />
            <Gauge v-else :size="18" />
          </span>
          <span class="experiment-module-card__body">
            <strong>{{ t(card.label) }}</strong>
            <small>{{ t(card.description) }}</small>
          </span>
          <span class="experiment-module-card__meta" :class="{ 'is-error': card.hasError }">
            {{ card.hasError ? t("需要检查") : t(card.status) }}
          </span>
        </button>
      </div>

      <Transition name="module-panel" mode="out-in">
        <div
          :id="`experiment-module-panel-${activeModule}`"
          :key="activeModule"
          class="experiment-module-stage"
          role="tabpanel"
          :aria-label="t(moduleCopy[activeModule].label)"
        >
          <div class="experiment-module-stage__heading">
            <div>
              <span class="section-kicker">{{ t("当前调整模块") }}</span>
              <h3>{{ t(moduleCopy[activeModule].label) }}</h3>
              <p>{{ t(moduleCopy[activeModule].description) }}</p>
            </div>
            <span v-if="moduleCopy[activeModule].structured && !structuredInput" class="module-state-chip">
              {{ t("需要完整输入") }}
            </span>
            <span v-else class="module-state-chip module-state-chip--ready">{{ t("可直接调整") }}</span>
          </div>

          <div v-if="activeControlGroups.length" class="control-sections">
            <section v-for="group in activeControlGroups" :key="group.subsystem" class="schema-control-group">
              <header>
                <Cpu v-if="group.subsystem === 'S1'" :size="17" />
                <Database v-else-if="group.subsystem === 'S0'" :size="17" />
                <Network v-else :size="17" />
                <div>
                  <strong>{{ group.title }}</strong>
                  <InlineHelp v-if="!props.compact" :text="`${group.subsystem} · ${t(group.detail)}`" />
                </div>
                <button v-if="group.subsystem === 'S1'" class="text-button" @click="$emit('reset-controls')">
                  <RotateCcw :size="14" />{{ t("清除可选参数") }}
                </button>
              </header>
              <div class="form-grid">
                <label
                  v-for="field in group.fields"
                  :key="field.fieldId"
                  class="field"
                  :class="{ 'field--invalid': fieldPath === field.requestJsonPointer }"
                  :data-field-id="field.fieldId"
                  :data-field-path="field.requestJsonPointer"
                >
                  <span
                    >{{ t(field.label) }} <small v-if="field.unit">{{ field.unit }}</small></span
                  >
                  <select
                    v-if="field.kind === 'select'"
                    v-model="form.parameterValues[field.fieldId]"
                    :disabled="
                      !field.available ||
                      (structuredInput && engineMode !== 'generic' && field.fieldId === 's1.runtime.batch_scheduler')
                    "
                    :aria-invalid="fieldPath === field.requestJsonPointer"
                  >
                    <option v-if="!field.explicitDefaultAvailable" :value="undefined">
                      {{ t("未设置（省略字段）") }}
                    </option>
                    <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                  </select>
                  <input
                    v-else
                    v-model.number="form.parameterValues[field.fieldId]"
                    type="number"
                    :list="numericListId(field)"
                    :disabled="
                      !field.available ||
                      (structuredInput && engineMode !== 'generic' && field.fieldId === 's1.runtime.batch_scheduler')
                    "
                    :min="field.minimum"
                    :max="field.maximum"
                    :step="field.step"
                    :placeholder="field.explicitDefaultAvailable ? undefined : t('未设置（省略字段）')"
                    :aria-invalid="fieldPath === field.requestJsonPointer"
                  />
                  <datalist v-if="field.kind !== 'select' && numericListId(field)" :id="numericListId(field)">
                    <option v-for="value in numericPresetValues(field)" :key="value" :value="value" />
                  </datalist>
                  <small v-if="showFieldContracts || fieldPath === field.requestJsonPointer" class="field-help"
                    ><code>{{ field.fieldId }}</code> · <code>{{ field.requestJsonPointer }}</code></small
                  >
                  <small v-if="!field.available" class="field-error">{{ field.unavailableReason }}</small>
                  <small v-if="fieldPath === field.requestJsonPointer" class="field-error">{{
                    field.requestJsonPointer
                  }}</small>
                </label>
              </div>
              <small v-if="showFieldContracts" class="schema-source-note">
                {{ group.fields[0]?.contractStatus }} ·
                {{
                  group.fields[0]?.contractStatus === "backend_descriptor"
                    ? t("正式后端参数描述契约")
                    : t("旧版兼容参数描述")
                }}
              </small>
            </section>
          </div>

          <div v-if="!structuredInput && moduleCopy[activeModule].structured" class="module-input-gate">
            <div class="module-input-gate__icon"><Table2 :size="20" /></div>
            <div>
              <strong>{{ t("这个模块需要完整输入") }}</strong>
              <p>{{ t("请求、设备和拓扑会写入 custom_inputs；启用后仍会保留当前快捷参数。") }}</p>
            </div>
            <button
              type="button"
              class="button button--secondary"
              :disabled="!surface.inputModes.includes('json')"
              @click="$emit('use-structured-input')"
            >
              {{ t("启用并继续") }}
            </button>
          </div>

          <div v-if="structuredInput" class="structured-stack">
            <template v-if="activeModule === 'runtime'">
              <template v-if="runtimeJson.trim()">
                <RuntimeEngineForm v-model="runtimeJson" :field-path="fieldPath" />
                <RuntimePolicyForm v-model="runtimeJson" :field-path="fieldPath" />
              </template>
              <p v-else class="structured-note structured-note--warning" role="alert">
                {{ t("runtime trace 还是空的。请先加载场景模板，或到 JSON 输入页签粘贴内容。") }}
              </p>
            </template>

            <RequestTableForm
              v-else-if="activeModule === 'requests' && runtimeJson.trim()"
              v-model="runtimeJson"
              :topology-json="topologyJson"
              :model-ids="props.modelIds"
              :field-path="fieldPath"
              :error-message="errorMessage"
            />
            <p v-else-if="activeModule === 'requests'" class="structured-note structured-note--warning" role="alert">
              {{ t("runtime trace 还是空的。请先加载场景模板，或到 JSON 输入页签粘贴内容。") }}
            </p>

            <template v-else-if="activeModule === 'topology'">
              <section class="topology-connection-entry" :aria-label="t('显卡连接')">
                <header class="topology-connection-entry__header">
                  <div>
                    <strong>{{ t("显卡连接") }}</strong>
                    <InlineHelp :text="t('最常用的拓扑操作：把一张显卡拖到另一张显卡，添加一条仿真连接。')" />
                  </div>
                  <span class="topology-status-chip topology-status-chip--simulation">{{ t("仿真输入") }}</span>
                </header>
                <TopologyGraphEditor
                  v-model="topologyJson"
                  :field-path="fieldPath"
                  :show-json="false"
                  :show-module-bindings="topologyAdvancedOpen"
                  @device-count-change="onDeviceCountChange"
                  @notice="onBlockNotice"
                />
              </section>
              <button
                type="button"
                class="topology-advanced-toggle"
                :aria-expanded="topologyAdvancedOpen"
                @click="topologyAdvancedOpen = !topologyAdvancedOpen"
              >
                <span>
                  <strong>{{ t("高级拓扑设置") }}</strong>
                  <InlineHelp :text="t('需要改卡数、domain 成员或网络模型时再展开')" :interactive="false" />
                </span>
                <span class="topology-advanced-disclosure__hint">{{
                  topologyAdvancedOpen ? t("收起") : t("默认收起")
                }}</span>
              </button>
              <DeviceInventoryForm
                v-show="topologyAdvancedOpen"
                v-model="topologyJson"
                :field-path="fieldPath"
                @notice="onBlockNotice"
                @device-count-change="onDeviceCountChange"
              />
              <DomainInventoryForm
                v-show="topologyAdvancedOpen"
                v-model="topologyJson"
                :field-path="fieldPath"
                @notice="onBlockNotice"
              />
            </template>
          </div>
        </div>
      </Transition>
    </section>

    <div v-else-if="mode === 'json'" class="json-editor-section">
      <div class="json-toolbar">
        <button class="button button--secondary" @click="$emit('load-template')">
          <Database :size="15" />{{ t("加载场景模板") }}
        </button>
        <label class="button button--ghost"
          >{{ t("导入完整输入包")
          }}<input type="file" accept="application/json,.json" @change="$emit('load-bundle', $event)"
        /></label>
      </div>
      <div class="json-grid">
        <label
          ><span
            >Runtime trace JSON
            <label class="inline-file"
              >{{ t("导入")
              }}<input
                type="file"
                accept="application/json,.json"
                @change="$emit('load-json-file', $event, 'runtime')" /></label></span
          ><textarea
            v-model="runtimeJson"
            spellcheck="false"
            :aria-invalid="
              fieldPath === '/custom_inputs/runtime_trace' || fieldPath.startsWith('/custom_inputs/runtime_trace/')
            "
            :aria-describedby="fieldPath.startsWith('/custom_inputs/runtime_trace') ? 'runtime-json-error' : undefined"
            :placeholder="t('加载模板或粘贴运行时 Trace')"
          ></textarea>
          <small
            v-if="fieldPath.startsWith('/custom_inputs/runtime_trace')"
            id="runtime-json-error"
            class="field-error"
            role="alert"
            ><code>{{ fieldPath }}</code> · {{ errorMessage }}</small
          >
        </label>
        <div class="topology-input-column">
          <!--
            The JSON tab owns typing: the graph is a read-only preview that
            follows the textarea, so topology input happens in exactly one way —
            editing this JSON. The import button stays because it is the file
            equivalent of the "导入" control the runtime textarea already has.
          -->
          <TopologyGraphEditor v-model="topologyJson" :field-path="fieldPath" read-only />
          <label class="inline-file topology-import"
            >{{ t("导入拓扑 JSON")
            }}<input type="file" accept="application/json,.json" @change="$emit('load-json-file', $event, 'topology')"
          /></label>
        </div>
      </div>
    </div>
    <div v-else class="trace-package-state">
      {{ t("从下方受控目录选择 package；浏览器不会发送或显示服务器文件路径。") }}
    </div>
  </article>
</template>
