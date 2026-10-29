<script setup lang="ts">
import { computed, ref } from "vue";
import { Server, Plus, Trash2 } from "@lucide/vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import { topologyDeviceFields, topologyDeviceMaxItems, type SchemaFieldMeta } from "./input-schema-meta";
import {
  participantDeviceIdsOf,
  deviceReferences,
  addTopologyDevice,
  parseJsonDocument,
  patchJsonDocument,
  removeDevice,
  renameDevice,
  setGpuCount,
  topologyDevicesOf,
  StructuredInputError,
  type DeviceCountChange,
  type JsonObject,
} from "./structured-input";
import { TOPOLOGY_NODE_TYPES, topologyNodeType } from "./topology-node-types";

const props = withDefaults(defineProps<{ modelValue: string; fieldPath?: string }>(), { fieldPath: "" });
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "notice", payload: { tone: "info" | "warning"; message: string }): void;
  (event: "device-count-change", payload: { ids: string[] }): void;
}>();
const { t } = useI18n();

/**
 * Plain-language labels. The contract key stays available as a hover tooltip so
 * the field can still be matched against a backend diagnostic Pointer.
 */
const DEVICE_LABEL_SOURCE: Record<string, string> = {
  device_id: "设备编号",
  device_type: "设备类型",
  group_id: "分组编号",
};

const editableFields: SchemaFieldMeta[] = topologyDeviceFields.filter((field) => field.kind === "string");
/** Non-string device fields (if the contract ever adds one) are reported, not silently dropped. */
const unrenderedFields = computed(() => topologyDeviceFields.filter((field) => field.kind !== "string"));

function deviceLabel(meta: SchemaFieldMeta): string {
  const source = DEVICE_LABEL_SOURCE[meta.key];
  return source ? t(source) : meta.key;
}

const localError = ref("");
const parsed = computed(() => parseJsonDocument(props.modelValue, "Fabric topology"));
const documentValue = computed<JsonObject | null>(() => (parsed.value.ok ? parsed.value.value : null));
const devices = computed<unknown[] | null>(() => (documentValue.value ? topologyDevicesOf(documentValue.value) : null));
const rowIndexes = computed(() => (devices.value || []).map((_, index) => index));
const deviceCount = computed(
  () =>
    devices.value?.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        topologyNodeType((entry as JsonObject).device_type).participant,
    ).length ?? 0,
);
const selectedNewDeviceType = ref("GPU");
const customNewDeviceType = ref("");
const nodeTypeChoices = TOPOLOGY_NODE_TYPES;
const customNodeChoice = {
  value: "__custom__",
  label: "自定义类型",
  prefix: "node",
  category: "unknown",
  participant: false,
} as const;
const deviceTypeSuggestions = computed(() => {
  const values = new Set<string>(nodeTypeChoices.map((entry) => entry.value));
  for (const value of devices.value || []) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const type = (value as JsonObject).device_type;
      if (typeof type === "string" && type.trim()) values.add(type.trim());
    }
  }
  return [...values];
});
const groupSuggestions = computed(() => {
  const values = new Set<string>();
  for (const value of devices.value || []) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const group = (value as JsonObject).group_id;
      if (typeof group === "string" && group.trim()) values.add(group.trim());
    }
  }
  return [...values];
});

function rowAt(index: number): JsonObject | null {
  const value = devices.value?.[index];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function cellValue(index: number, key: string): string {
  const value = rowAt(index)?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function deviceId(index: number): string {
  return cellValue(index, "device_id");
}

function describeReferences(references: { domains: string[]; links: number[] }): string {
  const parts: string[] = [];
  if (references.domains.length) parts.push(`domains: ${references.domains.join("、")}`);
  if (references.links.length) parts.push(`links: ${references.links.map((index) => `#${index + 1}`).join("、")}`);
  return parts.join("；");
}

/**
 * Reads the device list out of the patched text. `props.modelValue` still holds
 * the previous value until the parent re-renders, so the emitted payload must be
 * derived from the new text rather than from `devices`.
 */
function announceDeviceIds(next: string) {
  const nextDocument = parseJsonDocument(next, "Fabric topology");
  emit("device-count-change", { ids: nextDocument.ok ? participantDeviceIdsOf(nextDocument.value) : [] });
}

function applyDeviceCount(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const count = Number(raw);
  if (!Number.isInteger(count)) {
    localError.value = t("卡数必须是整数。");
    return;
  }
  try {
    // The mutator runs inside the patch helper, so the result is collected in a
    // box: a plain `let` would stay narrowed to `null` at the use site.
    const outcome: { change: DeviceCountChange | null } = { change: null };
    const next = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      outcome.change = setGpuCount(draft, count);
    });
    emit("update:modelValue", next);
    localError.value = "";
    const change = outcome.change;
    if (change && (change.removed.length || change.cleaned.length)) {
      const cleanedText = change.cleaned.length
        ? change.cleaned.map((references) => describeReferences(references)).join(" / ")
        : t("无");
      emit("notice", {
        tone: "warning",
        message: t("卡数减少，已删除 {removed}，并清理了引用：{cleaned}", {
          removed: change.removed.join("、"),
          cleaned: cleanedText,
        }),
      });
    }
    announceDeviceIds(next);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

/** GPU count is a convenience control; other node roles are added explicitly. */
function addDeviceOfType(deviceType: string) {
  const customType = customNewDeviceType.value.trim();
  const choice =
    deviceType === customNodeChoice.value
      ? { ...customNodeChoice, value: customType || "Unknown" }
      : nodeTypeChoices.find((entry) => entry.value === deviceType) || topologyNodeType(deviceType);
  if (deviceType === customNodeChoice.value && !customType) {
    localError.value = t("自定义节点类型不能为空。");
    return;
  }
  try {
    const next = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      if (choice.participant) setGpuCount(draft, deviceCount.value + 1);
      else addTopologyDevice(draft, choice.value, choice.prefix);
    });
    emit("update:modelValue", next);
    localError.value = "";
    emit("notice", {
      tone: "info",
      message: choice.participant
        ? t("已新增 GPU。")
        : t("已新增 {type} 节点；它不会自动成为请求参与设备。", { type: choice.label }),
    });
    announceDeviceIds(next);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function addOneDevice() {
  addDeviceOfType(selectedNewDeviceType.value);
}

function updateField(field: SchemaFieldMeta, index: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (field.key === "device_id") {
    const next = raw.trim();
    const current = deviceId(index);
    if (next === current) return;
    if (!next) {
      localError.value = t("设备编号不能为空。");
      return;
    }
    try {
      const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
        renameDevice(draft, current, next),
      );
      emit("update:modelValue", updated);
      localError.value = "";
      emit("notice", {
        tone: "info",
        message: t("已把 {from} 改名为 {to}，并同步更新了 domains 与 links 中的引用。", { from: current, to: next }),
      });
      announceDeviceIds(updated);
    } catch (error) {
      localError.value = error instanceof StructuredInputError ? error.message : String(error);
    }
    return;
  }
  const value = raw.trim();
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      const target = topologyDevicesOf(draft)?.[index];
      if (!target || typeof target !== "object" || Array.isArray(target)) return;
      // Optional string fields with maxLength: an empty box means "omit the key".
      if (!value) delete (target as JsonObject)[field.key];
      else (target as JsonObject)[field.key] = value;
    });
    emit("update:modelValue", updated);
    localError.value = "";
    announceDeviceIds(updated);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function dropDevice(index: number) {
  const target = deviceId(index);
  if (!target) return;
  const references = documentValue.value ? deviceReferences(documentValue.value, target) : { domains: [], links: [] };
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      removeDevice(draft, target);
    });
    emit("update:modelValue", updated);
    localError.value = "";
    if (references.domains.length || references.links.length) {
      emit("notice", {
        tone: "warning",
        message: t("删除 {device} 时它仍被引用（{refs}），已一并从 domains 与 links 中移除。", {
          device: target,
          refs: describeReferences(references),
        }),
      });
    } else {
      emit("notice", { tone: "info", message: t("已删除 {device}。", { device: target }) });
    }
    announceDeviceIds(updated);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function cellPath(index: number, key: string): string {
  return `/custom_inputs/topology/topology/devices/${index}/${key}`;
}
</script>

<template>
  <section class="device-inventory" :aria-label="t('设备清单')">
    <header class="structured-block__header device-inventory__header">
      <Server :size="16" />
      <div>
        <span
          ><strong>{{ t("设备清单") }}</strong
          ><InlineHelp :text="t('GPU 会参与请求；交换机、路由器等只作为拓扑节点。')"
        /></span>
      </div>
      <label class="device-inventory__count"
        ><span>{{ t("GPU 卡数") }}</span
        ><input
          type="number"
          min="0"
          :max="topologyDeviceMaxItems"
          step="1"
          :value="deviceCount"
          :aria-label="t('GPU 卡数')"
          @change="applyDeviceCount"
      /></label>
      <div class="device-inventory__add">
        <select v-model="selectedNewDeviceType" :aria-label="t('新增节点类型')">
          <option v-for="choice in nodeTypeChoices" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
          <option :value="customNodeChoice.value">{{ t(customNodeChoice.label) }}</option>
        </select>
        <input
          v-if="selectedNewDeviceType === customNodeChoice.value"
          v-model="customNewDeviceType"
          class="device-inventory__custom-type"
          :placeholder="t('例如：DPU')"
          :aria-label="t('自定义节点类型')"
        />
        <button type="button" class="button button--secondary" @click="addOneDevice">
          <Plus :size="15" />{{ t("新增节点") }}
        </button>
      </div>
    </header>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!devices" class="structured-note structured-note--warning" role="alert">
      {{ t("topology JSON 缺少 devices 数组，设备清单暂不可编辑。") }}
    </p>
    <p v-else-if="!devices.length" class="structured-note">
      {{ t("当前没有节点。可先设置 GPU 卡数，或从新增节点菜单选择交换机等拓扑节点。") }}
    </p>

    <ul v-else class="device-inventory__rows">
      <li v-for="index in rowIndexes" :key="`device-row-${index}`" class="device-inventory-row">
        <span class="device-inventory-row__index">{{ index + 1 }}</span>
        <label
          v-for="field in editableFields"
          :key="`${index}-${field.key}`"
          :data-input-path="cellPath(index, field.key)"
          :title="field.key"
        >
          <span>{{ deviceLabel(field) }}</span>
          <select
            v-if="field.key === 'device_type'"
            :value="cellValue(index, field.key)"
            :aria-label="`${deviceLabel(field)} ${index + 1}`"
            :aria-invalid="fieldPath === cellPath(index, field.key)"
            @change="updateField(field, index, $event)"
          >
            <option value="">{{ t("未指定") }}</option>
            <option v-for="choice in nodeTypeChoices" :key="`${index}-${choice.value}`" :value="choice.value">
              {{ choice.label }}
            </option>
            <option
              v-if="
                cellValue(index, field.key) &&
                !nodeTypeChoices.some((choice) => choice.value === cellValue(index, field.key))
              "
              :value="cellValue(index, field.key)"
            >
              {{ cellValue(index, field.key) }}
            </option>
          </select>
          <input
            v-else
            type="text"
            spellcheck="false"
            :value="cellValue(index, field.key)"
            :list="
              field.key === 'device_type'
                ? 'topology-device-type-suggestions'
                : field.key === 'group_id'
                  ? 'topology-device-group-suggestions'
                  : undefined
            "
            :aria-label="`${deviceLabel(field)} ${index + 1}`"
            :aria-invalid="fieldPath === cellPath(index, field.key)"
            @change="updateField(field, index, $event)"
          />
        </label>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('删除设备 {device}', { device: deviceId(index) })"
          @click="dropDevice(index)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>

    <datalist id="topology-device-type-suggestions">
      <option v-for="value in deviceTypeSuggestions" :key="value" :value="value" />
    </datalist>
    <datalist id="topology-device-group-suggestions">
      <option v-for="value in groupSuggestions" :key="value" :value="value" />
    </datalist>

    <p v-if="localError" class="structured-note structured-note--error" role="alert">{{ localError }}</p>
    <p v-else-if="unrenderedFields.length" class="structured-note structured-note--warning">
      {{
        t("契约里还有 {count} 个非字符串设备字段没有控件，请直接在原始 JSON 里编辑：{fields}", {
          count: unrenderedFields.length,
          fields: unrenderedFields.map((field) => field.key).join("、"),
        })
      }}
    </p>
  </section>
</template>
